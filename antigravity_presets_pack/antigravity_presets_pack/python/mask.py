"""Person-only transparent WebM for 'text behind the person'. Best effort: needs
   pip install mediapipe opencv-python numpy   (slow on weak PCs; skip if it fails)."""
import subprocess


def make_person_webm(ffmpeg, video, out_path, width, height, fps=30, on_progress=None):
    try:
        import cv2
        import mediapipe as mp
        import numpy as np
    except Exception:
        raise RuntimeError("Install: pip install mediapipe opencv-python numpy")
    seg = mp.solutions.selfie_segmentation.SelfieSegmentation(model_selection=1)
    cap = cv2.VideoCapture(str(video))
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 1
    cmd = [ffmpeg, "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", f"{width}x{height}",
           "-r", str(fps), "-i", "-", "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "0", "-crf", "30", str(out_path)]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    i = 0
    prev = None
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        frame = cv2.resize(frame, (width, height))
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        m = seg.process(rgb).segmentation_mask
        if prev is not None:
            m = 0.55 * m + 0.45 * prev          # temporal smoothing = no flicker on the edges
        prev = m
        m = cv2.GaussianBlur(m, (9, 9), 0)
        alpha = (np.clip((m - 0.4) / 0.2, 0, 1) * 255).astype("uint8")
        p.stdin.write(np.dstack([rgb, alpha]).tobytes())
        i += 1
        if on_progress and i % 15 == 0:
            on_progress(100.0 * i / total)
    p.stdin.close(); p.wait(); cap.release()
    return out_path
