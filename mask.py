"""Person-only transparent WebM for 'text behind the person' using OpenCV DNN or MediaPipe."""
import os
import subprocess
from pathlib import Path

MODELS_DIR = Path(__file__).resolve().parent / "models"
ONNX_MODEL_PATH = MODELS_DIR / "selfie_segmenter.onnx"
TFLITE_MODEL_PATH = MODELS_DIR / "selfie_segmenter.tflite"
LAST_INIT_ERROR = None


def get_segmenter():
    global LAST_INIT_ERROR

    # 1. Primary: OpenCV DNN with ONNX model
    # Pure CPU inference via OpenCV's built-in DNN engine.
    # Has ZERO OpenGL / GUI / X11 / libGLESv2 dependencies — 100% reliable on headless Linux / Render.
    if ONNX_MODEL_PATH.exists():
        try:
            import cv2
            net = cv2.dnn.readNetFromONNX(str(ONNX_MODEL_PATH))

            def segment_frame_opencv(rgb_frame):
                h, w = rgb_frame.shape[:2]
                blob = cv2.dnn.blobFromImage(rgb_frame, scalefactor=1.0 / 255.0, size=(256, 256), swapRB=False)
                net.setInput(blob)
                out = net.forward()
                m = out[0, 0] if out.ndim == 4 else out[0]
                m_resized = cv2.resize(m, (w, h))
                return m_resized.astype("float32")

            LAST_INIT_ERROR = "OpenCV_ONNX_Ready"
            return segment_frame_opencv
        except Exception as e:
            LAST_INIT_ERROR = f"OpenCV_ONNX_Error_{type(e).__name__}_{e}"
            print("OpenCV ONNX segmenter init error:", e)
    else:
        LAST_INIT_ERROR = f"ONNX_NotFound_at_{ONNX_MODEL_PATH}"

    # 2. Secondary: MediaPipe Tasks API
    if TFLITE_MODEL_PATH.exists():
        try:
            import mediapipe as mp
            from mediapipe.tasks import python as mp_python
            from mediapipe.tasks.python import vision as mp_vision

            model_bytes = TFLITE_MODEL_PATH.read_bytes()
            base_options = mp_python.BaseOptions(model_asset_buffer=model_bytes)
            options = mp_vision.ImageSegmenterOptions(
                base_options=base_options,
                running_mode=mp_vision.RunningMode.IMAGE,
                output_category_mask=True
            )
            task_segmenter = mp_vision.ImageSegmenter.create_from_options(options)

            def segment_frame_tasks(rgb_frame):
                mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
                res = task_segmenter.segment(mp_img)
                mask_np = res.category_mask.numpy_view()
                return mask_np.astype("float32")

            LAST_INIT_ERROR = "Tasks_Ready"
            return segment_frame_tasks
        except Exception as e:
            LAST_INIT_ERROR += f"_Tasks_Error_{type(e).__name__}_{e}"
            print("MediaPipe Tasks ImageSegmenter init error:", e)

    # 3. Tertiary: Legacy solutions API (MediaPipe < 0.10)
    try:
        import mediapipe as mp
        if hasattr(mp, "solutions") and hasattr(mp.solutions, "selfie_segmentation"):
            legacy_seg = mp.solutions.selfie_segmentation.SelfieSegmentation(model_selection=1)

            def segment_frame_legacy(rgb_frame):
                return legacy_seg.process(rgb_frame).segmentation_mask

            LAST_INIT_ERROR = "Legacy_Ready"
            return segment_frame_legacy
    except Exception as e:
        LAST_INIT_ERROR += f"_Legacy_Error_{type(e).__name__}_{e}"
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
        raise RuntimeError(f"No selfie segmenter could be initialized: {LAST_INIT_ERROR}")

    Path(out_path).parent.mkdir(parents=True, exist_ok=True)

    cap = cv2.VideoCapture(str(video))
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 1

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
            try:
                p.stdin.close()
            except Exception:
                pass
        stderr = p.communicate()[1]
        p.wait()
        cap.release()

    if p.returncode != 0:
        err_msg = stderr.decode("utf-8", errors="ignore") if stderr else f"exit code {p.returncode}"
        raise RuntimeError(f"FFmpeg person mask failed: {err_msg}")

    return out_path
