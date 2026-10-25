"""Person-only transparent WebM for 'text behind the person'."""
import subprocess
import os


def make_person_webm(ffmpeg, video, out_path, width, height, fps=30, on_progress=None):
    try:
        import cv2
        import mediapipe as mp
        import numpy as np
    except Exception as e:
        raise RuntimeError(f"Dependencies missing for person cutout: {e}. Install: pip install mediapipe opencv-python-headless numpy")

    seg = mp.solutions.selfie_segmentation.SelfieSegmentation(model_selection=1)
    cap = cv2.VideoCapture(str(video))
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 1

    # Use a practical processing resolution (max width 640, height 1136 or half WxH).
    # MediaPipe selfie_segmentation natively uses 256x256, so processing at 540x960 is optimal,
    # uses 75% less RAM (preventing Render OOM), and encodes 5x faster.
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
            m = seg.process(rgb).segmentation_mask
            if prev is not None:
                m = 0.55 * m + 0.45 * prev          # temporal smoothing = no flicker on edges
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
        err_msg = stderr.decode('utf-8', errors='ignore') if stderr else f'exit code {p.returncode}'
        raise RuntimeError(f"FFmpeg person mask failed: {err_msg}")

    return out_path
