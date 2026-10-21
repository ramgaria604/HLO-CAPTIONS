import os
import sys
import json
import shutil
import subprocess
from pathlib import Path

BASE = Path(__file__).resolve().parent
ROOT_DIR = BASE.parent
OUT_DIR = BASE / "out"
OUT_DIR.mkdir(exist_ok=True)
STATIC_PREVIEWS = ROOT_DIR / "static" / "preset_previews"
STATIC_PREVIEWS.mkdir(exist_ok=True)

REMOTION_BIN = str(BASE / "node_modules" / ".bin" / "remotion.cmd")
JSON_PATH = ROOT_DIR / "unique_presets_pack" / "unique_presets.json"
if not JSON_PATH.exists():
    JSON_PATH = Path(r"C:\Users\NIKHIL\.gemini\antigravity\brain\2aa04f04-f317-405e-87c8-13c3239de329\unique_presets_pack\unique_presets.json")

with open(JSON_PATH, "r", encoding="utf-8") as f:
    presets = json.load(f)

print(f"Loaded {len(presets)} unique presets to render.", flush=True)

test_words = [
    {"t": "make", "s": 0.2, "e": 0.6},
    {"t": "it", "s": 0.6, "e": 0.9},
    {"t": "pop", "s": 0.9, "e": 1.4},
    {"t": "today", "s": 1.4, "e": 2.0}
]

for idx, p in enumerate(presets):
    pid = p["id"]
    out_png = OUT_DIR / f"{pid}.png"
    dest_png = STATIC_PREVIEWS / f"{pid}.png"

    if dest_png.exists() and dest_png.stat().st_size > 1000:
        print(f"[{idx+1}/{len(presets)}] Already exists: {pid}", flush=True)
        continue

    props = {
        "videoSrc": "input.mp4",
        "words": test_words,
        "presetId": pid,
        "durationSec": 5,
        "width": 1080,
        "height": 1920,
        "fps": 30
    }
    props_file = BASE / f"temp_props_{pid}.json"
    props_file.write_text(json.dumps(props), encoding="utf-8")

    cmd = f'"{REMOTION_BIN}" still src/index.ts Captioned "{out_png}" --props="{props_file}" --frame=40 --log=error'
    print(f"[{idx+1}/{len(presets)}] Rendering still for {pid}...", flush=True)
    res = subprocess.run(cmd, cwd=str(BASE), shell=True, capture_output=True, text=True)
    if props_file.exists():
        props_file.unlink()

    if out_png.exists():
        shutil.copy2(str(out_png), str(dest_png))
        print(f"  -> OK ({out_png.stat().st_size} bytes)", flush=True)
    else:
        print(f"  -> Error: {res.stderr or res.stdout}", flush=True)

print("\nDone rendering stills.", flush=True)
