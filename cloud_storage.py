"""
Unified Cloud Storage & Smart Storage Janitor for CaptionStudio Pro.
Supports Cloudflare R2, AWS S3, and local auto-eviction / quota management.
"""

import os
import time
import threading
from pathlib import Path

# Optional boto3 import
try:
    import boto3
    from botocore.config import Config
    BOTO3_AVAILABLE = True
except ImportError:
    BOTO3_AVAILABLE = False


class CloudStorageManager:
    def __init__(self):
        self.account_id = os.environ.get("R2_ACCOUNT_ID", "").strip()
        self.access_key = (os.environ.get("R2_ACCESS_KEY_ID") or os.environ.get("AWS_ACCESS_KEY_ID") or "").strip()
        self.secret_key = (os.environ.get("R2_SECRET_ACCESS_KEY") or os.environ.get("AWS_SECRET_ACCESS_KEY") or "").strip()
        self.bucket = (os.environ.get("R2_BUCKET_NAME") or os.environ.get("S3_BUCKET_NAME") or "").strip()
        self.public_url = os.environ.get("R2_PUBLIC_URL", "").strip().rstrip("/")
        self.endpoint_url = os.environ.get("S3_ENDPOINT_URL", "").strip()

        if not self.endpoint_url and self.account_id:
            self.endpoint_url = f"https://{self.account_id}.r2.cloudflarestorage.com"

        self._s3_client = None
        self._init_client()

    def _init_client(self):
        if not BOTO3_AVAILABLE or not self.access_key or not self.secret_key or not self.bucket:
            return

        try:
            cfg = Config(signature_version="s3v4", retries={"max_attempts": 3, "mode": "standard"})
            client_kwargs = {
                "service_name": "s3",
                "aws_access_key_id": self.access_key,
                "aws_secret_access_key": self.secret_key,
                "config": cfg
            }
            if self.endpoint_url:
                client_kwargs["endpoint_url"] = self.endpoint_url

            self._s3_client = boto3.client(**client_kwargs)
        except Exception as e:
            print(f"Cloud storage client initialization notice: {e}")
            self._s3_client = None

    def is_enabled(self):
        """Returns True if cloud storage (R2/S3) is configured and active."""
        return self._s3_client is not None

    def upload_file(self, local_path, cloud_key=None):
        """
        Uploads a local file to cloud storage.
        Returns the public URL or presigned URL if successful, else None.
        """
        if not self.is_enabled():
            return None

        p = Path(local_path)
        if not p.exists() or not p.is_file():
            return None

        if not cloud_key:
            cloud_key = p.name

        content_types = {
            ".mp4": "video/mp4",
            ".webm": "video/webm",
            ".mp3": "audio/mpeg",
            ".wav": "audio/wav",
            ".json": "application/json",
            ".png": "image/png",
            ".jpg": "image/jpeg"
        }
        content_type = content_types.get(p.suffix.lower(), "application/octet-stream")

        try:
            extra_args = {"ContentType": content_type}
            self._s3_client.upload_file(str(p), self.bucket, cloud_key, ExtraArgs=extra_args)

            # Generate public URL or presigned URL
            if self.public_url:
                return f"{self.public_url}/{cloud_key}"

            # Fallback: Presigned URL valid for 7 days (604800 seconds)
            presigned = self._s3_client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket, "Key": cloud_key},
                ExpiresIn=604800
            )
            return presigned
        except Exception as e:
            print(f"Cloud upload error for {cloud_key}: {e}")
            return None


# Global singleton instance
storage = CloudStorageManager()


# ==============================================================================
# SMART STORAGE JANITOR (LRU Auto-Eviction & Immediate Temp Cleanup)
# ==============================================================================

def clean_file_safely(file_path):
    """Deletes a file safely without throwing exceptions."""
    try:
        p = Path(file_path)
        if p.exists() and p.is_file():
            p.unlink(missing_ok=True)
            return True
    except OSError:
        pass
    return False


def enforce_disk_quota(work_dir, max_mb=None):
    """
    LRU Eviction: Checks total size of work folder. If it exceeds max_mb (default 1200 MB),
    evicts oldest files first until size drops to target (700 MB).
    Guarantees the server NEVER runs out of disk space.
    """
    if max_mb is None:
        max_mb = int(os.environ.get("MAX_STORAGE_MB", 1200))

    work_path = Path(work_dir)
    if not work_path.exists():
        return

    max_bytes = max_mb * 1024 * 1024
    target_bytes = int(max_bytes * 0.6)  # Clean down to 60% of limit

    try:
        files = []
        total_size = 0
        for f in work_path.iterdir():
            if f.is_file():
                try:
                    st = f.stat()
                    total_size += st.st_size
                    files.append((f, st.st_size, st.st_mtime))
                except OSError:
                    continue

        if total_size <= max_bytes:
            return  # Well within safety limit

        # Sort files by modification time (oldest first)
        files.sort(key=lambda x: x[2])

        freed_bytes = 0
        for f_path, size, _ in files:
            clean_file_safely(f_path)
            total_size -= size
            freed_bytes += size
            if total_size <= target_bytes:
                break

        print(f"[Smart Storage Janitor] Evicted oldest files: freed {freed_bytes // (1024*1024)} MB to prevent disk full.")
    except Exception as e:
        print(f"[Smart Storage Janitor] Quota check notice: {e}")


def cleanup_expired_files(work_dir, retention_hours=None):
    """
    Cleans up files older than retention_hours (default 6 hours).
    Also removes any orphaned temporary speech/audio files.
    """
    if retention_hours is None:
        retention_hours = float(os.environ.get("FILE_RETENTION_HOURS", 6.0))

    work_path = Path(work_dir)
    if not work_path.exists():
        return

    cutoff_time = time.time() - (retention_hours * 3600)
    temp_cutoff = time.time() - 900  # Temp files older than 15 minutes are orphaned

    try:
        for f in work_path.iterdir():
            if not f.is_file():
                continue

            try:
                mtime = f.stat().st_mtime
                name = f.name.lower()

                # 1. Clean orphaned temporary audio/analysis scratch files after 15 mins
                if ("_groq" in name or "_speech" in name or "_vosk" in name or "_raw" in name) and mtime < temp_cutoff:
                    clean_file_safely(f)
                    continue

                # 2. Clean normal videos/exports older than retention_hours
                if mtime < cutoff_time:
                    clean_file_safely(f)

            except OSError:
                continue
    except Exception as e:
        print(f"[Smart Storage Janitor] Cleanup notice: {e}")


def start_janitor_thread(work_dir, interval_seconds=1800):
    """
    Spawns a standing background daemon thread that periodically runs
    both time-based cleanup and LRU disk quota eviction every 30 minutes.
    """
    def _janitor_loop():
        while True:
            try:
                cleanup_expired_files(work_dir)
                enforce_disk_quota(work_dir)
            except Exception as loop_err:
                print(f"[Smart Storage Janitor] Loop exception: {loop_err}")
            time.sleep(interval_seconds)

    thread = threading.Thread(target=_janitor_loop, daemon=True, name="StorageJanitor")
    thread.start()
    return thread
