"""Bridge: Flask app -> Remotion. Copy the (already auto-cut) video into public/ and call render()."""
import json
import re
import shutil
import subprocess
from pathlib import Path

PACK = Path(__file__).resolve().parent.parent


def build_props(video_name, words, preset_id, graphics, palette, duration, width, height,
                fps=30, person_name=None, auto_color=False):
    """words = [(start, end, text)] on the CUT video timeline. video_name/person_name = files inside public/."""
    return {
        "videoSrc": video_name, "personSrc": person_name, "presetId": preset_id, "autoColor": auto_color,
        "words": [{"t": t, "s": round(s, 3), "e": round(e, 3)} for s, e, t in words],
        "graphics": graphics, "palette": palette,
        "durationSec": round(duration, 3), "width": width, "height": height, "fps": fps,
    }


def render(props, out_path, on_progress=None):
    remotion_bin = PACK / "node_modules" / ".bin" / "remotion.cmd"
    props_file = PACK / "props.json"
    props_file.write_text(json.dumps(props), encoding="utf-8")
    if remotion_bin.exists():
        cmd = [str(remotion_bin), "render", "src/index.ts", "Captioned", str(out_path), f"--props={props_file}"]
    else:
        npx = shutil.which("npx") or shutil.which("npx.cmd") or r"C:\Users\NIKHIL\AppData\Local\Programs\nodejs\npx.cmd"
        if not npx or not Path(npx).exists():
            raise RuntimeError("Node.js is not installed (npx not found). Install Node 18+ from nodejs.org.")
        cmd = [str(npx), "remotion", "render", "src/index.ts", "Captioned", str(out_path), f"--props={props_file}"]
    p = subprocess.Popen(cmd, cwd=PACK, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    tail = []
    for line in p.stdout:
        tail = (tail + [line.strip()])[-15:]
        m = re.search(r"(\d+)/(\d+)", line)
        if m and on_progress and int(m.group(2)) > 50:
            on_progress(100.0 * int(m.group(1)) / int(m.group(2)))
    p.wait()
    if p.returncode != 0:
        raise RuntimeError("Remotion render failed:\n" + "\n".join(tail))
    return out_path
