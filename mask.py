"""Person-only transparent WebM for 'text behind the person' using MediaPipe ImageSegmenter."""
import os
import subprocess
from pathlib import Path

MODEL_PATH = Path(__file__).resolve().parent / "models" / "selfie_segmenter.tflite"


def get_segmenter():
    import mediapipe as mp

    # 1. Try modern MediaPipe Tasks API (MediaPipe >= 0.10.x / 1.x)
    if MODEL_PATH.exists():
        try:
            from mediapipe.tasks import python as mp_python
            from mediapipe.tasks.python import vision as mp_vision

            base_options = mp_python.BaseOptions(model_asset_path=str(MODEL_PATH))
            options = mp_vision.ImageSegmenterOptions(
                base_options=base_options,
                running_mode=mp_vision.RunningMode.IMAGE,
                output_category_mask=True
            )
            task_segmenter = mp_vision.ImageSegmenter.create_from_options(options)

            def segment_frame_tasks(rgb_frame):
                mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
                res = task_segmenter.segment(mp_img)
                # category_mask numpy array: 1 = person, 0 = background
                mask_np = res.category_mask.numpy_view()
                return mask_np.astype("float32")

            return segment_frame_tasks
        except Exception as e:
            print("Modern ImageSegmenter init error:", e)

    # 2. Try legacy solutions API (MediaPipe < 0.10)
    try:
        if hasattr(mp, "solutions") and hasattr(mp.solutions, "selfie_segmentation"):
            legacy_seg = mp.solutions.selfie_segmentation.SelfieSegmentation(model_selection=1)

            def segment_frame_legacy(rgb_frame):
                return legacy_seg.process(rgb_frame).segmentation_mask

            return segment_frame_legacy
    except Exception as e:
        print("Legacy selfie_segmentation error:", e)

    return None


def make_person_webm(ffmpeg, video, out_path, width, height, fps=30, on_progress=None):
    try:
        import cv2
        import numpy as np
    except Exception as e:
        raise RuntimeError(f"OpenCV missing: {e}. Install: pip install opencv-python-headless numpy")

    segment_fn = get_segmenter()
    if segment_fn is None:
        raise RuntimeError("No MediaPipe selfie segmenter could be initialized. Please check models/selfie_segmenter.tflite.")

    cap = cv2.VideoCapture(str(video))
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 1

    # Optimal processing resolution (e.g. 406x720 or 540x960)
    # MediaPipe natively uses 256x256, so processing at 720p max uses 75% less RAM and runs 5x faster.
    scale = min(1.0, 720.0 / max(width, height))
    proc_w = int(round(width * scale / 2.0)) * 2
    proc_h = int(round(height * scale / 2.0)) * 2

    cmd = [
        ffmpeg, "-y", "-loglevel", "error",
        "-f", "rawvideo", "-pix_fmt", "rgba",
        "-s", f"{proc_w}x{proc_h}",
        "-r", str(fps),
        "-i", "-",
        "-c:v", "libvpx-vp9",
        "-pix_fmt", "yuva420p",
        "-deadline", "realtime",
        "-cpu-used", "8",
        "-crf", "32",
        "-b:v", "0",
        str(out_path)
    ]

    p = subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=subprocess.PIPE)
    i = 0
    prev = None

    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            frame = cv2.resize(frame, (proc_w, proc_h))
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            m = segment_fn(rgb)
            if prev is not None:
                m = 0.55 * m + 0.45 * prev
            prev = m
            m = cv2.GaussianBlur(m, (7, 7), 0)
            alpha = (np.clip((m - 0.4) / 0.2, 0, 1) * 255).astype("uint8")
            p.stdin.write(np.dstack([rgb, alpha]).tobytes())
            i += 1
            if on_progress and i % 15 == 0:
                on_progress(100.0 * i / total)
    finally:
        if p.stdin:
            p.stdin.close()
        stderr = p.communicate()[1]
        p.wait()
        cap.release()

    if p.returncode != 0:
        err_msg = stderr.decode("utf-8", errors="ignore") if stderr else f"exit code {p.returncode}"
        raise RuntimeError(f"FFmpeg person mask failed: {err_msg}")

    return out_path
