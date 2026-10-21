"""CaptionStudio Pro: captions + auto-cuts + b-roll. Runs on your own computer."""
import json
import os
import re
import shutil
import subprocess
import threading
import time
import uuid
from pathlib import Path

from flask import Flask, abort, jsonify, render_template, request, send_from_directory
from werkzeug.utils import secure_filename

import ai_editor
import broll
import cuts as cutlib
import motion_graphics as mg
import styles as stylelib
import hinglish
from fonts_util import FONTS_DIR, font_index, user_families

BASE = Path(__file__).resolve().parent
WORK = BASE / "work"
WORK.mkdir(exist_ok=True)
PROJECTS_DIR = WORK / "projects"
PROJECTS_DIR.mkdir(exist_ok=True)
CONFIG = BASE / "config.json"
ALLOWED = {".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v"}
ALLOWED_AUDIO = {".mp3", ".wav", ".m4a", ".ogg", ".aac", ".flac"}

import sys
NODE_DIR = r"C:\Users\NIKHIL\AppData\Local\Programs\nodejs"
if os.path.exists(NODE_DIR) and NODE_DIR not in os.environ.get("PATH", ""):
    os.environ["PATH"] = NODE_DIR + os.pathsep + os.environ.get("PATH", "")

REMOTION_DIR = BASE / "remotion_pack"
REMOTION_PY = REMOTION_DIR / "python"
if str(REMOTION_PY) not in sys.path:
    sys.path.insert(0, str(REMOTION_PY))

try:
    import premium_render
    import palette as palette_lib
    import director as director_lib
    import mask as mask_lib
except Exception as _e:
    print("Warning: Remotion python modules import error:", _e)

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 1500 * 1024 * 1024

JOBS = {}
EXPORT_LOCK = threading.Semaphore(1)


# ------------------------------------------------------------------ helpers
def ffmpeg_path():
    cand = BASE / "ffmpeg.exe"
    if cand.exists():
        return str(cand)
    p = os.environ.get("FFMPEG_PATH") or shutil.which("ffmpeg")
    if p:
        return p
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return None


def ffprobe_path():
    p = os.environ.get("FFPROBE_PATH") or shutil.which("ffprobe")
    if p:
        return p
    f = ffmpeg_path()
    if f:
        cand = Path(f).with_name("ffprobe" + Path(f).suffix)
        if cand.exists():
            return str(cand)
        cand2 = Path(f).with_name("ffprobe.exe")
        if cand2.exists():
            return str(cand2)
    return None


def module_ok(name):
    try:
        __import__(name)
        return True
    except Exception:
        return False


def has_ass_filter():
    f = ffmpeg_path()
    if not f:
        return False
    try:
        r = subprocess.run([f, "-hide_banner", "-filters"], capture_output=True, text=True, timeout=2)
        return " ass " in r.stdout
    except Exception:
        return False


def load_config():
    try:
        return json.loads(CONFIG.read_text(encoding="utf-8"))
    except Exception:
        return {}


def pexels_key():
    return os.environ.get("PEXELS_API_KEY") or load_config().get("pexels_key", "")


def probe(path):
    fp = ffprobe_path()
    if fp:
        try:
            out = subprocess.run([fp, "-v", "error", "-show_entries",
                                  "stream=index,codec_type,width,height,r_frame_rate:stream_tags=rotate:"
                                  "stream_side_data=rotation:format=duration", "-of", "json", str(path)],
                                 capture_output=True, text=True, check=True).stdout
            data = json.loads(out)
            v = next((s for s in data["streams"] if s.get("codec_type") == "video"), None)
            if not v:
                raise RuntimeError("This file has no video.")
            w, h = int(v["width"]), int(v["height"])
            rot = v.get("tags", {}).get("rotate")
            if rot is None and v.get("side_data_list"):
                rot = v["side_data_list"][0].get("rotation")
            if rot is not None and abs(int(float(rot))) in (90, 270):
                w, h = h, w
            try:
                n, d = v.get("r_frame_rate", "30/1").split("/")
                fps = float(n) / float(d)
            except Exception:
                fps = 30.0
            if not 5 <= fps <= 120:
                fps = 30.0
            return {"width": w, "height": h, "fps": round(min(fps, 60), 3),
                    "duration": float(data.get("format", {}).get("duration") or 0),
                    "has_audio": any(s.get("codec_type") == "audio" for s in data["streams"])}
        except Exception:
            pass

    # Fallback to ffmpeg -i parsing
    f = ffmpeg_path()
    if not f:
        raise RuntimeError("FFmpeg is not installed.")
    res = subprocess.run([f, "-hide_banner", "-i", str(path)], capture_output=True, text=True, errors="replace")
    text = res.stderr or res.stdout
    dur_m = re.search(r"Duration:\s*(\d+):(\d+):([\d.]+)", text)
    duration = 0.0
    if dur_m:
        h_val, m_val, s_val = float(dur_m.group(1)), float(dur_m.group(2)), float(dur_m.group(3))
        duration = h_val * 3600 + m_val * 60 + s_val
    v_m = re.search(r"Stream.*?Video:.*?,\s*(\d{2,5})x(\d{2,5})", text)
    if not v_m:
        raise RuntimeError("This file has no video.")
    w, h = int(v_m.group(1)), int(v_m.group(2))
    fps_m = re.search(r"([\d.]+)\s*fps", text)
    fps = float(fps_m.group(1)) if fps_m else 30.0
    if not (5 <= fps <= 120):
        fps = 30.0
    has_audio = bool(re.search(r"Stream.*?Audio:", text))
    rot_m = re.search(r"rotate\s*:\s*(-?\d+)", text)
    if rot_m and abs(int(rot_m.group(1))) in (90, 270):
        w, h = h, w
    return {"width": w, "height": h, "fps": round(min(fps, 60), 3),
            "duration": round(duration, 3), "has_audio": has_audio}


def out_dims(w, h, max_short=1080):
    s = min(w, h)
    if s > max_short:
        f = max_short / s
        w, h = int(w * f), int(h * f)
    return max(2, w // 2 * 2), max(2, h // 2 * 2)


def out_dims_aspect(w, h, aspect, max_short=1080):
    """Compute output dimensions with optional aspect ratio override."""
    if aspect and aspect != "original":
        parts = aspect.split(":")
        if len(parts) == 2:
            aw, ah = int(parts[0]), int(parts[1])
            # Scale to fit within max_short on the short side
            if aw > ah:  # landscape
                new_h = min(h, max_short)
                new_w = int(new_h * aw / ah)
            else:  # portrait or square
                new_w = min(w, max_short)
                new_h = int(new_w * ah / aw)
            return max(2, new_w // 2 * 2), max(2, new_h // 2 * 2)
    return out_dims(w, h, max_short)


def safe_name(name):
    name = Path(str(name)).name
    if not re.fullmatch(r"[A-Za-z0-9_.\-]+", name) or not (WORK / name).exists():
        raise FileNotFoundError("Video not found. Upload it again.")
    return name


def err(msg, code=400):
    return jsonify(error=msg), code


def run_ffmpeg(args, job, duration, base=0.0, span=100.0):
    cmd = [ffmpeg_path(), "-y", "-hide_banner", "-loglevel", "error", "-nostats", "-progress", "pipe:1", *args]
    flags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
    p = subprocess.Popen(cmd, cwd=str(WORK), stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
                         creationflags=flags)
    errs = []
    t = threading.Thread(target=lambda: errs.append(p.stderr.read()), daemon=True)
    t.start()
    for line in p.stdout:
        if line.startswith("out_time_us=") or line.startswith("out_time_ms="):
            try:
                sec = int(line.split("=")[1]) / 1_000_000
                job["progress"] = round(base + span * min(1.0, sec / max(duration, 0.1)), 1)
            except ValueError:
                pass
    p.wait()
    t.join(timeout=2)
    if p.returncode != 0:
        raise RuntimeError("FFmpeg failed: " + (errs[0] if errs else "")[-1200:])


# ------------------------------------------------------------------ pages & assets
@app.get("/")
def index():
    return render_template("index.html")


@app.get("/fonts/<path:name>")
def font_file(name):
    return send_from_directory(FONTS_DIR, name)


_FONTS_CSS_CACHE = None
_FONTLIST_CACHE = None


@app.get("/fonts.css")
def fonts_css():
    global _FONTS_CSS_CACHE
    if _FONTS_CSS_CACHE is not None:
        return _FONTS_CSS_CACHE, 200, {"Content-Type": "text/css"}
    from PIL import ImageFont
    css = []
    for p in sorted(FONTS_DIR.glob("*")):
        if p.suffix.lower() not in (".ttf", ".otf"):
            continue
        try:
            family, style = ImageFont.truetype(str(p), 20).getname()
        except Exception:
            continue
        names = {family}
        if style and style.lower() not in ("regular", "normal", "book"):
            names = {f"{family} {style}"}
        for n in names:
            css.append(f"@font-face{{font-family:'{n}';src:url('/fonts/{p.name}');font-display:swap}}")
    _FONTS_CSS_CACHE = "\n".join(css)
    return _FONTS_CSS_CACHE, 200, {"Content-Type": "text/css"}


@app.get("/api/status")
def status():
    ff = bool(ffmpeg_path())
    ass_ok = ff and has_ass_filter()
    has_whisper = module_ok("faster_whisper")
    has_sr = module_ok("speech_recognition")
    speech_ok = has_whisper or has_sr
    return jsonify(
        ffmpeg=ff,
        ass=ass_ok,
        whisper=speech_ok,
        server_whisper=has_whisper,
        server_sr=has_sr,
        pexels=bool(pexels_key()),
        fonts=user_families()
    )


@app.get("/api/presets")
def presets():
    all_presets = stylelib.load_presets()
    default_style = all_presets[0] if all_presets else stylelib.DEFAULT_STYLE
    return jsonify(presets=all_presets, default=default_style)


REMOTION_PRESET_META = [
    # --- 1. HIGH-CONTRAST BOX & BADGES ---
    {
        "id": "yellow_box", "name": "Yellow Box Pop", "category": "remotion",
        "desc": "The viral short-form signature: bright canary yellow box popping on active words",
        "colors": ["#FFE600", "#111111"], "bigFont": "Poppins", "smallFont": "Poppins",
        "layout": "line", "anim": "pop", "glow": "#FFE600"
    },
    {
        "id": "box_pop", "name": "Box Pop Classic", "category": "remotion",
        "desc": "Clean white subtitle with pop-in highlighted yellow box",
        "colors": ["#FFE600", "#111111"], "bigFont": "Poppins", "smallFont": "Poppins",
        "layout": "line", "anim": "pop", "glow": "#FFE600"
    },
    {
        "id": "arcade_mix", "name": "Arcade 8-Bit", "category": "remotion",
        "desc": "Chunky arcade 8-bit display with 3D extrusion and neon magenta highlight",
        "colors": ["#FF007F", "#00F0FF"], "bigFont": "Bungee", "smallFont": "Bungee",
        "layout": "line", "anim": "bounce", "glow": "#FF007F"
    },
    {
        "id": "feed_mix", "name": "Feed Mix Frosted", "category": "remotion",
        "desc": "Modern frosted glassmorphic social pill container with neon cyan active word",
        "colors": ["#38BDF8", "#FFFFFF"], "bigFont": "Inter", "smallFont": "Inter",
        "layout": "line", "anim": "fade", "glow": "#38BDF8"
    },
    {
        "id": "elevate_mix", "name": "Elevate SaaS Indigo", "category": "remotion",
        "desc": "High-end tech SaaS aesthetic: rounded indigo pill tracking smoothly across words",
        "colors": ["#6366F1", "#FFFFFF"], "bigFont": "Inter", "smallFont": "Inter",
        "layout": "line", "anim": "slide", "glow": "#6366F1"
    },
    {
        "id": "ca_split", "name": "CA Split Contrast", "category": "remotion",
        "desc": "High-contrast dual tone split box inversion",
        "colors": ["#FFE600", "#000000"], "bigFont": "Anton", "smallFont": "Anton",
        "layout": "line", "anim": "pop", "glow": "#FFE600"
    },

    # --- 2. SPATIAL & BEHIND-PERSON DEPTH MASKING ---
    {
        "id": "ca_cutout", "name": "CA Cutout (Depth)", "category": "remotion",
        "desc": "Giant condensed punch rendered strictly behind the speaker torso with sunset gradient",
        "behindPerson": True,
        "colors": ["#FF5500", "#D81E0A"], "bigFont": "Anton", "smallFont": "Poppins",
        "layout": "scatter", "anim": "pop", "glow": "#FF5500"
    },
    {
        "id": "orange_pop", "name": "Orange Pop Behind", "category": "remotion",
        "desc": "Fiery textured 3D pop behind the speaker", "behindPerson": True,
        "colors": ["#FF6A00", "#D81E0A"], "bigFont": "Poppins", "smallFont": "Poppins",
        "layout": "scatter", "anim": "pop", "glow": "#FF6A00"
    },
    {
        "id": "dimension_story", "name": "Dimension Story Duo", "category": "remotion",
        "desc": "Dual-layer hierarchy: giant key word behind speaker plus readable subtitle in foreground",
        "behindPerson": True,
        "colors": ["#FFFFFF", "#E2E8F0"], "bigFont": "Poppins", "smallFont": "Inter",
        "layout": "stack", "anim": "pop", "glow": "#FFFFFF"
    },
    {
        "id": "spatial_red", "name": "Spatial Crimson", "category": "remotion",
        "desc": "Cinematic crimson uppercase text cutting behind speaker's shoulders",
        "behindPerson": True,
        "colors": ["#FF2A2A", "#880000"], "bigFont": "Bebas Neue", "smallFont": "Bebas Neue",
        "layout": "line", "anim": "slide", "glow": "#FF2A2A"
    },
    {
        "id": "spatial_white", "name": "Spatial Pure White", "category": "remotion",
        "desc": "Clean, high-fashion monochrome typography occluded naturally by human subject",
        "behindPerson": True,
        "colors": ["#FFFFFF", "#CCCCCC"], "bigFont": "Inter", "smallFont": "Inter",
        "layout": "line", "anim": "fade", "glow": "#FFFFFF"
    },
    {
        "id": "spatial_yellow", "name": "Spatial Golden Glow", "category": "remotion",
        "desc": "Warm electric yellow with ambient backlighting behind the subject",
        "behindPerson": True,
        "colors": ["#FFE600", "#FF9900"], "bigFont": "Montserrat", "smallFont": "Poppins",
        "layout": "stack", "anim": "pop", "glow": "#FFE600"
    },

    # --- 3. NEON & AURA GLOW ---
    {
        "id": "ml_aura", "name": "ML Neon Aura", "category": "remotion",
        "desc": "Multi-layer Gaussian radial bloom with electric cyan halo flaring on active syllables",
        "colors": ["#00FFCC", "#38BDF8"], "bigFont": "Poppins", "smallFont": "Poppins",
        "layout": "line", "anim": "pop", "glow": "#00FFCC"
    },
    {
        "id": "ml_halo", "name": "ML Radiant Halo", "category": "remotion",
        "desc": "Pulsing violet and coral halo expanding behind spoken words",
        "colors": ["#E056FD", "#FF7675"], "bigFont": "Poppins", "smallFont": "Poppins",
        "layout": "line", "anim": "pop", "glow": "#E056FD"
    },
    {
        "id": "afterglow_mix", "name": "Afterglow Sunset", "category": "remotion",
        "desc": "Warm dusk gradient (amber gold to intense hot pink) with persistent afterglow",
        "colors": ["#FFA502", "#FF4757"], "bigFont": "Montserrat", "smallFont": "Inter",
        "layout": "stack", "anim": "pop", "glow": "#FF4757"
    },
    {
        "id": "bloom_mix", "name": "Emerald Bloom", "category": "remotion",
        "desc": "High-intensity overexposure bloom in electric emerald tones",
        "colors": ["#10B981", "#6EE7B7"], "bigFont": "Poppins", "smallFont": "Poppins",
        "layout": "line", "anim": "pop", "glow": "#10B981"
    },
    {
        "id": "neon_duo", "name": "Neon Duo Script", "category": "remotion",
        "desc": "Glowing magenta-purple gradient with cursive subtitle",
        "colors": ["#C21E9E", "#6A1FB0"], "bigFont": "Poppins", "smallFont": "Great Vibes",
        "layout": "stack", "anim": "pop", "glow": "#FF6EC7"
    },
    {
        "id": "teal_gloss", "name": "Teal Gloss Gradient", "category": "remotion",
        "desc": "Ultra glossy cyan-teal gradient with italic subtitle",
        "colors": ["#22D3C8", "#0B5E6B"], "bigFont": "Poppins", "smallFont": "Inter",
        "layout": "stack", "anim": "pop", "glow": "#22D3C8"
    },
    {
        "id": "ice_blue", "name": "Ice Blue Neon", "category": "remotion",
        "desc": "Frosty sky-blue neon aura with high contrast typography",
        "colors": ["#7DE3FF", "#38BDF8"], "bigFont": "Montserrat", "smallFont": "Montserrat",
        "layout": "line", "anim": "fade", "glow": "#38BDF8"
    },
    {
        "id": "clean_cyan", "name": "Clean Cyan Flare", "category": "remotion",
        "desc": "Modern aesthetic sans with electric cyan word pops",
        "colors": ["#19E3FF", "#FFFFFF"], "bigFont": "Poppins", "smallFont": "Poppins",
        "layout": "line", "anim": "fade", "glow": "#19E3FF"
    },

    # --- 4. EDITORIAL & SWISS MINIMALIST ---
    {
        "id": "ml_swiss", "name": "ML Swiss Minimalist", "category": "remotion",
        "desc": "The gold standard of typography: refined sans-serif, restrained opacity wipe, zero tacky bounce",
        "colors": ["#FFFFFF", "#94A3B8"], "bigFont": "Inter", "smallFont": "Inter",
        "layout": "line", "anim": "fade", "glow": "#FFFFFF"
    },
    {
        "id": "ghostline", "name": "Ghostline Baseline", "category": "remotion",
        "desc": "Architectural baseline guide with muted ghost text illuminating on speech delivery",
        "colors": ["#FFFFFF", "rgba(255,255,255,0.4)"], "bigFont": "Inter", "smallFont": "Inter",
        "layout": "line", "anim": "fade", "glow": "#FFFFFF"
    },
    {
        "id": "monument", "name": "Monument Serif Gold", "category": "remotion",
        "desc": "Cinematic wide-tracked serif all-caps with subtle gold leaf shimmer",
        "colors": ["#F6E05E", "#D69E2E"], "bigFont": "Playfair Display", "smallFont": "Playfair Display",
        "layout": "line", "anim": "fade", "glow": "#F6E05E"
    },
    {
        "id": "golden_hour", "name": "Golden Hour Italic", "category": "remotion",
        "desc": "Luxurious editorial Playfair italic serif with warm amber karaoke wipe",
        "colors": ["#FFEAA7", "#D4AC0D"], "bigFont": "Playfair Display", "smallFont": "Playfair Display",
        "layout": "line", "anim": "slide", "glow": "#FFEAA7"
    },
    {
        "id": "gold_luxury", "name": "Gold Luxury Serif", "category": "remotion",
        "desc": "Polished metallic gold italic serif for finance & luxury",
        "colors": ["#F9EBA8", "#D4A62A"], "bigFont": "Playfair Display", "smallFont": "Inter",
        "layout": "stack", "anim": "slide", "glow": "#D4A62A"
    },
    {
        "id": "darkroom_mix", "name": "Darkroom Film Leader", "category": "remotion",
        "desc": "Typewriter film leader with warm crimson halation and cinema bar",
        "colors": ["#FF4D4D", "#990000"], "bigFont": "Space Mono", "smallFont": "Space Mono",
        "layout": "line", "anim": "type", "glow": "#FF4D4D"
    },
    {
        "id": "magenta_estate", "name": "Magenta Luxe Estate", "category": "remotion",
        "desc": "Real estate luxury: deep royal magenta paired with champagne gold",
        "colors": ["#F5D77F", "#9B1B67"], "bigFont": "Playfair Display", "smallFont": "Playfair Display",
        "layout": "line", "anim": "slide", "glow": "#F5D77F"
    },
    {
        "id": "agent_story", "name": "Agent Story Podcast", "category": "remotion",
        "desc": "Documentary storytelling subtitle with warm amber karaoke fill",
        "colors": ["#F59E0B", "#FFFFFF"], "bigFont": "Inter", "smallFont": "Inter",
        "layout": "line", "anim": "fade", "glow": "#F59E0B"
    },

    # --- 5. DYNAMIC SVG ACCENTS ---
    {
        "id": "focusline", "name": "Focusline SVG Brackets", "category": "remotion",
        "desc": "High-tech animated SVG geometric brackets snapping and hugging active spoken words",
        "colors": ["#A3E635", "#FFFFFF"], "bigFont": "Poppins", "smallFont": "Poppins",
        "layout": "line", "anim": "pop", "glow": "#A3E635"
    },
    {
        "id": "sketch_mix", "name": "Sketch Hand Underline", "category": "remotion",
        "desc": "Organic marker text paired with an animated hand-drawn SVG pencil squiggle",
        "colors": ["#FEEA00", "#FFFFFF"], "bigFont": "Permanent Marker", "smallFont": "Permanent Marker",
        "layout": "line", "anim": "pop", "glow": "#FEEA00"
    },
    {
        "id": "marker_highlight", "name": "Marker Highlighter", "category": "remotion",
        "desc": "Handwritten permanent marker underline with organic pop",
        "colors": ["#FFE600", "#FFFFFF"], "bigFont": "Permanent Marker", "smallFont": "Permanent Marker",
        "layout": "line", "anim": "pop", "glow": "#FFE600"
    },
    {
        "id": "chalk_mix", "name": "Chalkboard Sketch Box", "category": "remotion",
        "desc": "Dusty chalkboard rough textures with an animated rough-edged chalk box",
        "colors": ["#FDE047", "#FFFFFF"], "bigFont": "Permanent Marker", "smallFont": "Permanent Marker",
        "layout": "line", "anim": "bounce", "glow": "#FDE047"
    },
    {
        "id": "sunburst", "name": "Sunburst Ray Explosion", "category": "remotion",
        "desc": "SVG radial sparkle and ray burst bursting outward on major punchline keywords",
        "colors": ["#FF9900", "#FF4500"], "bigFont": "Bebas Neue", "smallFont": "Bebas Neue",
        "layout": "stack", "anim": "bounce", "glow": "#FFD700"
    },
    {
        "id": "blueprint_mix", "name": "Blueprint CAD Crosshairs", "category": "remotion",
        "desc": "Technical engineering monospace with SVG targeting reticles and grid coordinates",
        "colors": ["#38BDF8", "#0F172A"], "bigFont": "Space Mono", "smallFont": "Space Mono",
        "layout": "line", "anim": "type", "glow": "#38BDF8"
    },
    {
        "id": "reach_counter", "name": "Reach Metric Badge", "category": "remotion",
        "desc": "Floating statistic card with rolling odometer counter and SVG trend graph",
        "colors": ["#10B981", "#FFFFFF"], "bigFont": "Inter", "smallFont": "Inter",
        "layout": "line", "anim": "slide", "glow": "#10B981"
    },
    {
        "id": "terminal_type", "name": "Terminal Typewriter", "category": "remotion",
        "desc": "Matrix hacker monospace typewriter with phosphor green",
        "colors": ["#3CFF7A", "#000000"], "bigFont": "Space Mono", "smallFont": "Space Mono",
        "layout": "line", "anim": "type", "glow": "#3CFF7A"
    },

    # --- 6. KINETIC TYPOGRAPHY ---
    {
        "id": "dyn_stretch", "name": "Dynamic Stretch Elastic", "category": "remotion",
        "desc": "Elastic animation physics: words squash on impact and stretch vertically as spoken",
        "colors": ["#FF5252", "#FFFFFF"], "bigFont": "Anton", "smallFont": "Anton",
        "layout": "line", "anim": "pop", "glow": "#FF5252"
    },
    {
        "id": "stack_mix", "name": "Stack Conveyor Shuffle", "category": "remotion",
        "desc": "Multi-layer card stack pushing previous speech lines upward with kinetic momentum",
        "colors": ["#FFE600", "#FF6B6B"], "bigFont": "Poppins", "smallFont": "Poppins",
        "layout": "stack", "anim": "slide", "glow": "#FFE600"
    },
    {
        "id": "riso_mix", "name": "Risograph Halftone Snap", "category": "remotion",
        "desc": "Analog print misregistration: fluorescent pink and teal layers snapping together",
        "colors": ["#FF2D78", "#00C2CB"], "bigFont": "Bungee", "smallFont": "Bungee",
        "layout": "line", "anim": "bounce", "glow": "#FF2D78"
    },
    {
        "id": "overclock_mix", "name": "Overclock RGB Glitch", "category": "remotion",
        "desc": "Cybernetic RGB chromatic aberration split with high-frequency digital jitter",
        "colors": ["#00FF66", "#000000"], "bigFont": "Anton", "smallFont": "Anton",
        "layout": "line", "anim": "glitch", "glow": "#00FF66"
    },
    {
        "id": "glitch_rgb", "name": "Glitch Chromatic RGB", "category": "remotion",
        "desc": "Futuristic cyberpunk RGB chromatic aberration split",
        "colors": ["#FF2D55", "#00F0FF"], "bigFont": "Anton", "smallFont": "Anton",
        "layout": "line", "anim": "glitch", "glow": "#FF2D55"
    },
    {
        "id": "prism_mix", "name": "Prism Holographic Shimmer", "category": "remotion",
        "desc": "Rotating iridescent light spectrum refraction gliding smoothly across typography",
        "colors": ["#80EEFF", "#FFB6C1"], "bigFont": "Montserrat", "smallFont": "Montserrat",
        "layout": "line", "anim": "fade", "glow": "#80EEFF"
    },
    {
        "id": "hype_yellow", "name": "Hype Yellow Outline", "category": "remotion",
        "desc": "Heavy stroked energetic text with vibrant yellow highlight",
        "colors": ["#FFE600", "#000000"], "bigFont": "Anton", "smallFont": "Anton",
        "layout": "line", "anim": "pop", "glow": "#FFE600"
    },
    {
        "id": "fire_gradient", "name": "Fire Kinetic Gradient", "category": "remotion",
        "desc": "Blazing flame gradient headline with warm ambient glow",
        "colors": ["#FFE259", "#E01E1E"], "bigFont": "Bebas Neue", "smallFont": "Bebas Neue",
        "layout": "stack", "anim": "bounce", "glow": "#FF5A00"
    },
    {
        "id": "retro_sunset", "name": "Retro Sunset Synth", "category": "remotion",
        "desc": "80s synthwave extruded typography with sunset pink and orange",
        "colors": ["#FF4FA3", "#FF9A3C"], "bigFont": "Bungee", "smallFont": "Bungee",
        "layout": "stack", "anim": "bounce", "glow": "#FF4FA3"
    },
    {
        "id": "comic_pow", "name": "Comic Pow Cartoon", "category": "remotion",
        "desc": "Dynamic comic book tilted pop with heavy cartoon outline",
        "colors": ["#FFD400", "#000000"], "bigFont": "Bangers", "smallFont": "Bangers",
        "layout": "stack", "anim": "bounce", "glow": "#FFD400"
    },
    {
        "id": "mono_echo", "name": "Mono Echo 3D", "category": "remotion",
        "desc": "Bold black silhouette 3D echo typography",
        "colors": ["#0A0A0A", "#FFFFFF"], "bigFont": "Inter", "smallFont": "Inter",
        "layout": "echo", "anim": "pop", "glow": "#333333"
    },
    {
        "id": "wipe_italic", "name": "Wipe Italic Clean", "category": "remotion",
        "desc": "Dynamic karaoke wipe for bright/clean clips",
        "colors": ["#4DA3FF", "#111111"], "bigFont": "Inter", "smallFont": "Inter",
        "layout": "line", "anim": "fade", "glow": "#4DA3FF"
    },
    # --- 6. CURATED MULTI-COLOR BLENDS WITH BEHIND-PERSON DEPTH ---
    {
        "id": "moonshot_hyper_blend", "name": "Moonshot Sunset Mix 🔥", "category": "multicolor",
        "desc": "Molten fire & gold liquid gradient with behind-the-person depth and screen video blend",
        "behindPerson": True, "blendMode": "screen_25", "glowBloom": True,
        "colors": ["#FFE600", "#FF5E00", "#FF007F"], "bigFont": "Anton", "smallFont": "Inter",
        "layout": "stack", "anim": "pop", "glow": "#FF5E00"
    },
    {
        "id": "cyber_aurora_blend", "name": "Cyber Aurora Mix 🌌", "category": "multicolor",
        "desc": "Electric cyan & neon violet fluid blend with atmospheric screen video glow",
        "behindPerson": True, "blendMode": "screen_25", "glowBloom": True,
        "colors": ["#00F0FF", "#7B2CBF", "#FF007F"], "bigFont": "Poppins", "smallFont": "Inter",
        "layout": "stack", "anim": "pop", "glow": "#00F0FF"
    },
    {
        "id": "toxic_acid_blend", "name": "Toxic Acid Neon ⚡", "category": "multicolor",
        "desc": "Hyper-charged acid lime & bright aqua blend punching behind speaker shoulders",
        "behindPerson": True, "blendMode": "screen_25", "glowBloom": True,
        "colors": ["#39FF14", "#00F5D4", "#0066FF"], "bigFont": "Poppins", "smallFont": "Inter",
        "layout": "stack", "anim": "pop", "glow": "#39FF14"
    },
    {
        "id": "liquid_gold_blend", "name": "24K Liquid Gold & Luxe 👑", "category": "multicolor",
        "desc": "Documentary 24K liquid gold with warm ambient rim light and clean lower dialogue",
        "behindPerson": True, "blendMode": "screen_25", "glowBloom": True,
        "colors": ["#FFF6BD", "#F59E0B", "#B45309"], "bigFont": "Anton", "smallFont": "Inter",
        "layout": "stack", "anim": "pop", "glow": "#F59E0B"
    },
    {
        "id": "lavender_aura_blend", "name": "Lavender Dream Blend 🪻", "category": "multicolor",
        "desc": "Pastel lilac, orchid & deep violet blend with pure optical screen mode and atmospheric glow",
        "behindPerson": True, "blendMode": "screen_25", "glowBloom": True,
        "colors": ["#F3E8FF", "#C084FC", "#9333EA"], "bigFont": "Poppins", "smallFont": "Inter",
        "layout": "stack", "anim": "pop", "glow": "#C084FC"
    },
]

REMOTION_PRESET_IDS = {p["id"] for p in stylelib.PRESETS}


@app.get("/api/remotion/presets")
def get_remotion_presets():
    return jsonify(presets=stylelib.PRESETS)


@app.post("/api/palette/extract")
def extract_palette():
    d = request.get_json(force=True) or {}
    filename = d.get("filename")
    if not filename:
        return err("No video filename provided.")
    try:
        src = WORK / safe_name(filename)
        if not src.exists():
            return err("Video file not found.", 404)
        info = probe(src)
        duration = float(info.get("duration", 10.0))
        palettes = palette_lib.extract(ffmpeg_path(), src, duration)
        return jsonify(palettes=palettes)
    except Exception as e:
        print("Palette extraction error:", e)
        return jsonify(palettes=[
            {"name": "Match video", "c1": "#FF6A00", "c2": "#D81E0A", "text": "#FFFFFF"},
            {"name": "Contrast pop", "c1": "#22D3C8", "c2": "#0B5E6B", "text": "#FFFFFF"},
            {"name": "Clean light", "c1": "#FFE600", "c2": "#4DA3FF", "text": "#FFFFFF"}
        ])


@app.post("/api/director/plan")
def director_plan():
    d = request.get_json(force=True) or {}
    words = d.get("words", [])
    duration = float(d.get("duration", 10.0))
    if not words and d.get("captions"):
        for c in d.get("captions", []):
            try:
                for w in stylelib.caption_words(c):
                    if isinstance(w, dict):
                        words.append({"t": str(w.get("t", "")), "s": round(float(w.get("s", 0)), 3), "e": round(float(w.get("e", 0)), 3)})
                    elif isinstance(w, (list, tuple)) and len(w) >= 3:
                        words.append({"t": str(w[2]), "s": round(float(w[0]), 3), "e": round(float(w[1]), 3)})
            except Exception:
                pass
    try:
        events = director_lib.plan_graphics(words, duration)
        return jsonify(graphics=events)
    except Exception as e:
        print("Director plan fallback error:", e)
        return jsonify(graphics=director_lib.fallback_plan(words, duration))


@app.get("/api/fontlist")
def fontlist():
    global _FONTLIST_CACHE
    if _FONTLIST_CACHE is not None:
        return jsonify(fonts=_FONTLIST_CACHE)
    names = set(user_families())
    idx = font_index()
    for k in idx:
        pass
    names |= {"Arial", "Arial Black", "Impact", "Georgia", "Verdana", "Tahoma", "Trebuchet MS",
              "Segoe Script", "Segoe UI Black", "Bahnschrift", "Courier New"}
    # names that exist as files in the fonts folder (family + style)
    from PIL import ImageFont
    for p in FONTS_DIR.glob("*"):
        if p.suffix.lower() in (".ttf", ".otf"):
            try:
                fam, sty = ImageFont.truetype(str(p), 20).getname()
                names.add(fam if sty.lower() in ("regular", "normal", "book") else f"{fam} {sty}")
            except Exception:
                pass
    _FONTLIST_CACHE = sorted(names)
    return jsonify(fonts=_FONTLIST_CACHE)


# ------------------------------------------------------------------ AI Director & Motion Graphics
@app.post("/api/ai/analyze")
def ai_analyze():
    d = request.get_json(force=True)
    filename = d.get("filename")
    if not filename:
        return err("Choose a video first.")
    try:
        src = WORK / safe_name(filename)
        info = probe(src)
        captions = d.get("captions", [])
        plan = ai_editor.generate_editing_plan(src, captions, info["duration"], info, ffmpeg=ffmpeg_path())
        return jsonify(plan)
    except Exception as e:
        return err(f"AI Analysis error: {e}", 500)


@app.get("/api/graphics/templates")
def graphics_templates():
    return jsonify(templates=mg.TEMPLATES)


@app.post("/api/graphics/preview-card")
def graphics_preview_card():
    d = request.get_json(force=True)
    card_id = f"prev_{uuid.uuid4().hex[:8]}"
    card_path = WORK / f"{card_id}.png"
    w, h = mg.render_graphic_card(d, card_path, target_width=d.get("videoWidth", 720))
    return jsonify(url=f"/preview-card/{card_path.name}", width=w, height=h)


@app.get("/preview-card/<filename>")
def serve_preview_card(filename):
    return send_from_directory(WORK, filename)


@app.get("/video/<path:filename>")
def serve_video(filename):
    safe = safe_name(filename)
    return send_from_directory(WORK, safe)


# ------------------------------------------------------------------ Project Save & Load
@app.post("/api/project/save")
def project_save():
    d = request.get_json(force=True)
    name = d.get("name", "My Project").strip() or "Untitled Project"
    pid = d.get("id") or f"proj_{uuid.uuid4().hex[:8]}"
    d["id"] = pid
    d["name"] = name
    p_file = PROJECTS_DIR / f"{pid}.json"
    p_file.write_text(json.dumps(d, indent=2), encoding="utf-8")
    return jsonify(ok=True, id=pid, name=name)


@app.get("/api/project/list")
def project_list():
    projs = []
    for p in PROJECTS_DIR.glob("*.json"):
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
            projs.append({
                "id": data.get("id", p.stem),
                "name": data.get("name", p.stem),
                "filename": data.get("filename"),
                "updated": p.stat().st_mtime
            })
        except Exception:
            pass
    projs.sort(key=lambda x: -x["updated"])
    return jsonify(projects=projs)


@app.get("/api/project/<pid>")
def project_load(pid):
    p_file = PROJECTS_DIR / f"{pid}.json"
    if not p_file.exists():
        return err("Project not found.", 404)
    return jsonify(json.loads(p_file.read_text(encoding="utf-8")))


# ------------------------------------------------------------------ upload / transcribe
@app.post("/api/upload")
def upload():
    f = request.files.get("video")
    if not f or not f.filename:
        return err("Choose a video first.")
    ext = Path(f.filename).suffix.lower()
    if ext not in ALLOWED:
        return err("Please use MP4, MOV, MKV, WebM, M4V or AVI.")
    if not ffmpeg_path():
        return err("FFmpeg is not installed. Follow SETUP.md first.", 500)
    name = f"{uuid.uuid4().hex[:12]}{ext}"
    f.save(WORK / name)
    try:
        info = probe(WORK / name)
    except Exception as e:
        (WORK / name).unlink(missing_ok=True)
        return err(f"This video could not be read: {e}")
    return jsonify(filename=name, original_name=secure_filename(f.filename), **info)


_MODELS = {}
_VOSK_MODEL = None


def get_vosk_model(lang="en-us"):
    global _VOSK_MODEL
    if _VOSK_MODEL is None and module_ok("vosk"):
        import vosk
        try:
            code = str(lang or "en-us").lower().replace("_", "-").split("-")[0]
            model_lang = {"en": "en-us", "hi": "hi", "ur": "ur"}.get(code, "en-us")
            _VOSK_MODEL = vosk.Model(lang=model_lang)
        except Exception as e:
            print("Vosk load warning:", e)
            _VOSK_MODEL = None
    return _VOSK_MODEL


def get_model(size):
    from faster_whisper import WhisperModel
    if size not in _MODELS:
        _MODELS[size] = WhisperModel(size, device="cpu", compute_type="int8")
    return _MODELS[size]


@app.post("/api/transcribe")
def transcribe():
    d = request.get_json(force=True)
    try:
        name = safe_name(d.get("filename", ""))
    except FileNotFoundError as e:
        return err(str(e), 404)
    size = d.get("model") if d.get("model") in ("tiny", "base", "small", "medium") else "base"
    raw_lang = (d.get("language") or "").strip().lower()

    # Intelligent language detection and Hinglish mapping
    is_hinglish = False
    if not raw_lang or raw_lang in ("hinglish", "en-in", "auto", "hi-latn"):
        is_hinglish = True
        recognition_lang = "hi-IN"
        target_label = "Hinglish"
        whisper_lang = "hi"
        whisper_prompt = "Hinglish, Romanized Hindi, Bollywood keywords: dosto, video, like, subscribe, editing."
    elif raw_lang in ("hi", "hi-in", "hindi"):
        is_hinglish = False
        recognition_lang = "hi-IN"
        target_label = "Hindi"
        whisper_lang = "hi"
        whisper_prompt = "हिंदी भाषण और संवाद।"
    elif raw_lang in ("en", "en-us", "english"):
        is_hinglish = False
        recognition_lang = "en-US"
        target_label = "English (US)"
        whisper_lang = "en"
        whisper_prompt = "English dialogue with clean punctuation."
    elif raw_lang in ("en-gb", "uk"):
        is_hinglish = False
        recognition_lang = "en-GB"
        target_label = "English (UK)"
        whisper_lang = "en"
        whisper_prompt = "English dialogue."
    elif raw_lang in ("ur", "urdu"):
        is_hinglish = False
        recognition_lang = "ur-PK"
        target_label = "Urdu"
        whisper_lang = "ur"
        whisper_prompt = "اردو تقریر"
    elif raw_lang in ("ar", "arabic"):
        is_hinglish = False
        recognition_lang = "ar-SA"
        target_label = "Arabic"
        whisper_lang = "ar"
        whisper_prompt = "كلام عربي"
    elif raw_lang in ("es", "spanish"):
        is_hinglish = False
        recognition_lang = "es-ES"
        target_label = "Spanish"
        whisper_lang = "es"
        whisper_prompt = "Español."
    elif raw_lang in ("fr", "french"):
        is_hinglish = False
        recognition_lang = "fr-FR"
        target_label = "French"
        whisper_lang = "fr"
        whisper_prompt = "Français."
    elif raw_lang in ("de", "german"):
        is_hinglish = False
        recognition_lang = "de-DE"
        target_label = "German"
        whisper_lang = "de"
        whisper_prompt = "Deutsch."
    else:
        is_hinglish = False
        recognition_lang = raw_lang
        target_label = raw_lang
        whisper_lang = raw_lang.split("-")[0]
        whisper_prompt = None

    per = int(d.get("wordsPerCaption") or 3)
    keys = int(d.get("maxKeys") if d.get("maxKeys") is not None else 1)

    words = []
    transcription_notes = []
    detected_lang = target_label
    transcription_engine = None

    # 1. Try faster-whisper if available
    if module_ok("faster_whisper"):
        try:
            model = get_model(size)
            beam_size = 1 if size == "tiny" else (3 if size == "base" else 5)
            segs, info = model.transcribe(
                str(WORK / name), beam_size=beam_size, vad_filter=True,
                word_timestamps=True, language=whisper_lang,
                initial_prompt=whisper_prompt, condition_on_previous_text=True
            )
            for seg in segs:
                for w in seg.words or []:
                    t = w.word.strip()
                    if t:
                        if is_hinglish and hinglish.is_devanagari(t):
                            t = hinglish.devanagari_to_hinglish(t)
                        words.append((float(w.start), float(w.end), t))
            if hasattr(info, "language"):
                detected_lang = target_label if is_hinglish else info.language
            if words:
                transcription_engine = "Whisper"
        except Exception as exc:
            transcription_notes.append(f"Local Whisper failed ({type(exc).__name__}).")

    # 2. High-Accuracy Hinglish & Multi-Language Speech Engine
    if not words and module_ok("speech_recognition"):
        wav_path = WORK / f"{name}_speech.wav"
        try:
            # Extract vocal track with loudness normalization and bandpass filtering
            try:
                subprocess.run([
                    ffmpeg_path(), "-y", "-i", str(WORK / name), "-vn",
                    "-af", "loudnorm=I=-16:TP=-1.5:LRA=11,highpass=f=60,lowpass=f=7500",
                    "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1", str(wav_path)
                ], capture_output=True, check=True)
            except Exception:
                subprocess.run([
                    ffmpeg_path(), "-y", "-i", str(WORK / name), "-vn",
                    "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1", str(wav_path)
                ], capture_output=True, check=True)

            import speech_recognition as sr
            import wave, math, struct

            wf = wave.open(str(wav_path), "rb")
            framerate = wf.getframerate()
            total_frames = wf.getnframes()
            total_dur = max(0.5, total_frames / float(framerate))

            # Detect natural speech pauses to cleanly segment without cutting words in half
            silence_cmd = [ffmpeg_path(), "-i", str(wav_path), "-af", "silencedetect=n=-32dB:d=0.18", "-f", "null", "-"]
            res_sil = subprocess.run(silence_cmd, capture_output=True, text=True, errors="ignore")
            starts = [float(m) for m in re.findall(r"silence_start:\s*([0-9.]+)", res_sil.stderr)]
            ends = [float(m) for m in re.findall(r"silence_end:\s*([0-9.]+)", res_sil.stderr)]

            cut_points = []
            for s, e in zip(starts, ends):
                cut_points.append(round((s + e) / 2.0, 2))

            # Build segments between 3.0s and 9.5s (stay within Google limit and natural pauses)
            segments = []
            cur_start = 0.0
            for cp in cut_points:
                if cp - cur_start >= 3.0:
                    if cp - cur_start > 10.0:
                        sub = cur_start
                        while cp - sub > 9.0:
                            segments.append((round(sub, 2), round(sub + 8.0, 2)))
                            sub += 8.0
                        segments.append((round(sub, 2), round(cp, 2)))
                    else:
                        segments.append((round(cur_start, 2), round(cp, 2)))
                    cur_start = cp

            if total_dur - cur_start > 0.4:
                sub = cur_start
                while total_dur - sub > 9.0:
                    segments.append((round(sub, 2), round(sub + 8.0, 2)))
                    sub += 8.0
                if sub < total_dur:
                    segments.append((round(sub, 2), round(total_dur, 2)))

            if not segments:
                chunk_len = 8.0
                num_chunks = math.ceil(total_dur / chunk_len)
                for i in range(num_chunks):
                    s = i * chunk_len
                    e = min(total_dur, (i + 1) * chunk_len)
                    segments.append((round(s, 2), round(e, 2)))

            r = sr.Recognizer()
            r.energy_threshold = 260
            r.dynamic_energy_threshold = True

            def transcribe_segment(seg_start, seg_end, primary_lang):
                seg_len = seg_end - seg_start
                if seg_len < 0.25:
                    return []
                start_frame = max(0, int(seg_start * framerate))
                num_frames = min(total_frames - start_frame, int(seg_len * framerate))
                if num_frames <= 0:
                    return []

                wf.setpos(start_frame)
                raw_bytes = wf.readframes(num_frames)
                audio_chunk = sr.AudioData(raw_bytes, framerate, 2)

                txt = None
                try:
                    txt = r.recognize_google(audio_chunk, language=primary_lang)
                except Exception:
                    # If primary language had UnknownValueError and user wanted Hinglish, try Indian English fallback
                    if is_hinglish and primary_lang != "en-IN":
                        try:
                            txt = r.recognize_google(audio_chunk, language="en-IN")
                        except Exception:
                            pass

                if not txt:
                    return []

                raw_tokens = [t.strip() for t in txt.split() if t.strip()]
                seg_words = []
                if raw_tokens:
                    # Detect active speech onset/offset within segment using RMS energy
                    active_start = seg_start
                    active_end = seg_end
                    frame_samples = int(framerate * 0.05)  # 50ms frames
                    total_samples = len(raw_bytes) // 2
                    if total_samples > frame_samples * 4:
                        try:
                            samples = struct.unpack(f"<{total_samples}h", raw_bytes[:total_samples * 2])
                            frame_rms = []
                            for fi in range(0, total_samples, frame_samples):
                                sub = samples[fi:fi + frame_samples]
                                if sub:
                                    rms = math.sqrt(sum(s * s for s in sub) / len(sub))
                                    frame_rms.append(rms)
                                else:
                                    frame_rms.append(0)
                            max_rms = max(frame_rms) if frame_rms else 0
                            thresh = max(180.0, max_rms * 0.14)
                            active_idx = [idx for idx, val in enumerate(frame_rms) if val >= thresh]
                            if active_idx:
                                first_sec = (active_idx[0] * frame_samples) / framerate
                                last_sec = (min(len(frame_rms), active_idx[-1] + 1) * frame_samples) / framerate
                                speech_s = max(seg_start, round(seg_start + first_sec - 0.10, 3))
                                speech_e = min(seg_end, round(seg_start + last_sec + 0.10, 3))
                                if speech_e > speech_s + 0.3:
                                    active_start = speech_s
                                    active_end = speech_e
                        except Exception:
                            pass
                    active_len = active_end - active_start

                    # Allocate timings weighted by length strictly to active speech window
                    weights = [max(1, len(re.sub(r"[^\w']", "", tok))) ** 0.72 for tok in raw_tokens]
                    total_weight = sum(weights) or len(raw_tokens)
                    cursor = 0.0
                    for j, tok in enumerate(raw_tokens):
                        w_start = round(active_start + cursor, 3)
                        cursor += active_len * weights[j] / total_weight
                        w_end = round(active_start + min(active_len, cursor), 3)

                        # Clean & transliterate Devanagari to clean Roman Hinglish
                        final_token = tok
                        if is_hinglish and hinglish.is_devanagari(tok):
                            final_token = hinglish.devanagari_to_hinglish(tok)

                        seg_words.append((w_start, w_end, final_token))
                return seg_words

            for seg_start, seg_end in segments:
                res_words = transcribe_segment(seg_start, seg_end, recognition_lang)
                if res_words:
                    words.extend(res_words)

            # If Hinglish returned 0 words (e.g. video was pure English), try en-US pass
            if not words and is_hinglish:
                for seg_start, seg_end in segments:
                    res_words = transcribe_segment(seg_start, seg_end, "en-US")
                    if res_words:
                        words.extend(res_words)
                if words:
                    detected_lang = "English (Detected)"

            wf.close()
            wav_path.unlink(missing_ok=True)

            if words:
                transcription_engine = "Google Speech AI"
        except Exception as exc:
            if 'wav_path' in locals() and wav_path.exists():
                wav_path.unlink(missing_ok=True)
            transcription_notes.append(f"Speech engine note: {type(exc).__name__}.")

    # 3. Fallback: Offline Vosk Local Speech Engine
    if not words and module_ok("vosk"):
        try:
            v_model = get_vosk_model(raw_lang or "en-us")
            if v_model:
                import vosk, wave
                wav_path = WORK / f"{name}_vosk.wav"
                subprocess.run([ffmpeg_path(), "-y", "-i", str(WORK / name), "-vn", "-acodec", "pcm_s16le",
                                "-ar", "16000", "-ac", "1", str(wav_path)],
                               capture_output=True, check=True)
                wf = wave.open(str(wav_path), "rb")
                rec = vosk.KaldiRecognizer(v_model, wf.getframerate())
                rec.SetWords(True)
                while True:
                    data = wf.readframes(4000)
                    if len(data) == 0:
                        break
                    if rec.AcceptWaveform(data):
                        res = json.loads(rec.Result())
                        for w in res.get("result", []):
                            tok = str(w["word"])
                            if is_hinglish and hinglish.is_devanagari(tok):
                                tok = hinglish.devanagari_to_hinglish(tok)
                            words.append((float(w["start"]), float(w["end"]), tok))
                final = json.loads(rec.FinalResult())
                for w in final.get("result", []):
                    tok = str(w["word"])
                    if is_hinglish and hinglish.is_devanagari(tok):
                        tok = hinglish.devanagari_to_hinglish(tok)
                    words.append((float(w["start"]), float(w["end"]), tok))
                wf.close()
                wav_path.unlink(missing_ok=True)
                if words:
                    transcription_engine = "Vosk Offline AI"
        except Exception as exc:
            transcription_notes.append(f"Offline AI note: {type(exc).__name__}.")

    if not words:
        details = " ".join(transcription_notes)
        return err("Automatic transcription returned no words. " + details + " Try Browser Speech AI in Chrome or Edge, or import an SRT/VTT file.", 422)

    caps = stylelib.build_captions(words, per=max(1, min(8, per)), max_keys=max(0, min(3, keys)))
    return jsonify(captions=caps, words=[[round(a, 3), round(b, 3), t] for a, b, t in words],
                   language=detected_lang, engine=transcription_engine or "Speech AI",
                   timing_quality="word")


@app.post("/api/regroup")
def regroup():
    d = request.get_json(force=True)
    try:
        words = [(float(a), float(b), str(t)) for a, b, t in d.get("words", [])]
    except Exception:
        return err("Bad word list.")
    caps = stylelib.build_captions(words, per=max(1, min(8, int(d.get("per", 3)))),
                                   max_keys=max(0, min(3, int(d.get("maxKeys", 1)))))
    return jsonify(captions=caps)


# ------------------------------------------------------------------ auto-cuts
@app.post("/api/silence")
def silence():
    d = request.get_json(force=True)
    try:
        name = safe_name(d.get("filename", ""))
        info = probe(WORK / name)
        if not info["has_audio"]:
            return err("This video has no audio, so silence cannot be detected.")
        noise = max(-60.0, min(-15.0, float(d.get("noiseDb", -30))))
        gap = max(0.2, min(3.0, float(d.get("minSilence", 0.5))))
        pad = max(0.0, min(0.5, float(d.get("pad", 0.12))))
        sil = cutlib.detect_silences(ffmpeg_path(), WORK / name, info["duration"], noise, gap)
        cuts = cutlib.plan_cuts(sil, info["duration"], pad=pad)
    except FileNotFoundError as e:
        return err(str(e), 404)
    except Exception as e:
        return err(str(e), 500)
    saved = sum(b - a for a, b in cuts)
    return jsonify(cuts=cuts, saved=round(saved, 2), duration=info["duration"])


# ------------------------------------------------------------------ b-roll
@app.post("/api/broll/config")
def broll_config():
    key = str((request.get_json(force=True) or {}).get("key", "")).strip()
    if not re.fullmatch(r"[A-Za-z0-9_\-]{20,120}", key):
        return err("That does not look like a Pexels API key.")
    cfg = load_config()
    cfg["pexels_key"] = key
    CONFIG.write_text(json.dumps(cfg), encoding="utf-8")
    return jsonify(ok=True)


# ------------------------------------------------------------------ audio upload (background music)
@app.post("/api/upload-audio")
def upload_audio():
    f = request.files.get("audio")
    if not f or not f.filename:
        return err("Choose an audio file first.")
    ext = Path(f.filename).suffix.lower()
    if ext not in ALLOWED_AUDIO:
        return err("Please use MP3, WAV, M4A, OGG, AAC or FLAC.")
    name = f"bgm_{uuid.uuid4().hex[:8]}{ext}"
    f.save(WORK / name)
    return jsonify(filename=name, original_name=secure_filename(f.filename))


@app.post("/api/broll/suggest")
def broll_suggest():
    d = request.get_json(force=True)
    slots = broll.suggest_slots(d.get("captions", []), float(d.get("duration", 0)))
    return jsonify(slots=slots)


@app.post("/api/broll/search")
def broll_search():
    d = request.get_json(force=True)
    q = str(d.get("query", "")).strip()[:80]
    if not q:
        return err("Type what you want to search for.")
    orient = d.get("orientation") if d.get("orientation") in ("portrait", "landscape", "square") else "portrait"
    try:
        return jsonify(results=broll.search(q, pexels_key(), orient))
    except RuntimeError as e:
        return err(str(e), 502)
    except Exception:
        return err("Could not reach Pexels. Check your internet connection.", 502)


# ------------------------------------------------------------------ export
def cut_filter(keep, W, H, fps, zoom, has_audio):
    parts, vin, ain = [], [], []
    for i, (a, b) in enumerate(keep):
        v = f"[0:v]trim=start={a:.3f}:end={b:.3f},setpts=PTS-STARTPTS"
        if zoom and i % 2 == 1:
            v += ",crop=trunc(iw/1.1/2)*2:trunc(ih/1.1/2)*2"
        parts.append(v + f",scale={W}:{H},setsar=1,fps={fps}[v{i}]")
        vin.append(f"[v{i}]")
        if has_audio:
            dur = b - a
            fade = min(0.02, dur / 3)
            parts.append(f"[0:a]atrim=start={a:.3f}:end={b:.3f},asetpts=PTS-STARTPTS,"
                         f"afade=t=in:st=0:d={fade:.3f},afade=t=out:st={dur - fade:.3f}:d={fade:.3f}[a{i}]")
            ain.append(f"[a{i}]")
    n = len(keep)
    if has_audio:
        parts.append("".join(f"{v}{a}" for v, a in zip(vin, ain)) + f"concat=n={n}:v=1:a=1[vo][ao]")
    else:
        parts.append("".join(vin) + f"concat=n={n}:v=1:a=0[vo]")
    return ";".join(parts)


def overlay_filter(W, H, fps, brolls, ass_name, person_name=None, duration=None, front_ass_name=None):
    parts = [f"[0:v]scale={W}:{H},setsar=1,format=yuv420p[base0]"]
    for i, b in enumerate(brolls):
        s, e = b["start"], b["end"]
        fade = min(0.2, (e - s) / 3)
        parts.append(
            f"[{i + 1}:v]trim=duration={e - s:.3f},setpts=PTS-STARTPTS+{s:.3f}/TB,"
            f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},setsar=1,fps={fps},"
            f"format=yuva420p,fade=t=in:st={s:.3f}:d={fade:.3f}:alpha=1,"
            f"fade=t=out:st={e - fade:.3f}:d={fade:.3f}:alpha=1[b{i}]")
        parts.append(f"[base{i}][b{i}]overlay=enable='between(t,{s:.3f},{e:.3f})':eof_action=pass[base{i + 1}]")
    last = f"base{len(brolls)}"
    if ass_name and person_name:
        # Put only the hero keyword behind the person cutout.
        parts.append(f"color=c=black@0.0:s={W}x{H}:r={fps},format=rgba,ass={ass_name}:fontsdir=fonts[captions]")
        parts.append(f"[{last}][captions]overlay=shortest=1:format=auto[captioned]")
        person_input = 1 + len(brolls)
        parts.append(f"[{person_input}:v]fps={fps},scale={W}:{H},setsar=1,format=rgba[person]")
        parts.append("[captioned][person]overlay=shortest=1:format=auto[subject]")
    elif ass_name:
        parts.append(f"[{last}]ass={ass_name}:fontsdir=fonts[subject]")
    else:
        parts.append(f"[{last}]null[subject]")
    if front_ass_name:
        parts.append(f"color=c=black@0.0:s={W}x{H}:r={fps},format=rgba,ass={front_ass_name}:fontsdir=fonts[frontcaps]")
        parts.append("[subject][frontcaps]overlay=shortest=1:format=auto[vout]")
    else:
        parts.append("[subject]null[vout]")
    return ";".join(parts)


def sync_fonts():
    dst = WORK / "fonts"
    dst.mkdir(exist_ok=True)
    for p in FONTS_DIR.glob("*"):
        if p.suffix.lower() in (".ttf", ".otf"):
            t = dst / p.name
            if not t.exists() or t.stat().st_size != p.stat().st_size:
                shutil.copy2(p, t)


def export_worker(job_id, d):
    job = JOBS[job_id]
    temp = []
    try:
        with EXPORT_LOCK:
            job.update(status="working", message="Preparing...", progress=1)
            name = safe_name(d.get("filename", ""))
            src = WORK / name
            info = probe(src)

            # Aspect ratio support
            aspect = d.get("aspect", "original")
            W, H = out_dims_aspect(info["width"], info["height"], aspect)

            fps = info["fps"]
            duration = info["duration"]
            sync_fonts()

            # Quality settings
            quality = d.get("quality", "balanced")
            crf_map = {"high": "18", "balanced": "22", "fast": "26"}
            preset_map = {"high": "fast", "balanced": "veryfast", "fast": "ultrafast"}
            crf = crf_map.get(quality, "22")
            preset = preset_map.get(quality, "veryfast")

            # Speed setting
            speed = max(0.5, min(3.0, float(d.get("speed", 1.0))))

            # Video effects
            effects = d.get("effects", {})

            cuts = [c for c in d.get("cuts", []) if len(c) == 2]
            keep = cutlib.keep_segments(cuts, duration) if cuts else None
            if keep is not None and not keep:
                raise RuntimeError("Everything was cut out. Turn off some cuts.")
            remap = cutlib.Remap(keep) if keep else (lambda t: t)
            cur_duration = remap.total if keep else duration

            caps = []
            for c in d.get("captions", []):
                words = stylelib.caption_words(c)
                if words:
                    caps.append({"start": float(c["start"]), "end": float(c["end"]), "words": words})
            if keep:
                caps = cutlib.remap_captions(caps, remap)

            brolls = []
            for b in d.get("broll", []):
                s, e = remap(float(b["start"])), remap(float(b["end"]))
                if e - s >= 0.5:
                    brolls.append({"start": s, "end": e, "url": b["url"], "id": re.sub(r"\W", "", str(b["id"]))})

            graphics = d.get("graphics", [])
            if not (keep or caps or brolls or graphics or speed != 1.0 or any(effects.values()) or aspect != "original"):
                raise RuntimeError("Nothing to export yet. Add captions, graphics, cuts, effects or b-roll first.")

            step_span = 100.0
            current = name
            if keep:
                job["message"] = "Cutting out silence..."
                cut_name = f"{job_id}_cut.mp4"
                temp.append(WORK / cut_name)
                args = ["-i", name, "-filter_complex", cut_filter(keep, W, H, fps, bool(d.get("zoom")),
                                                                     info["has_audio"]),
                        "-map", "[vo]"] + (["-map", "[ao]"] if info["has_audio"] else []) + \
                       ["-c:v", "libx264", "-preset", "ultrafast", "-crf", "18", "-pix_fmt", "yuv420p"] + \
                       (["-c:a", "aac", "-b:a", "192k"] if info["has_audio"] else []) + [cut_name]
                run_ffmpeg(args, job, cur_duration, 0, 30)
                current, step_span = cut_name, 50.0
                base = 30.0
            else:
                base = 0.0

            for i, b in enumerate(brolls):
                job["message"] = f"Downloading b-roll {i + 1} of {len(brolls)}..."
                path = broll.download(b["url"], WORK / f"broll_{b['id']}.mp4")
                bi = probe(path)
                b["file"] = path.name
            preset_id = d.get("preset_id") or (d.get("style", {}) or {}).get("preset_id") or (d.get("style", {}) or {}).get("id")
            requested_engine = d.get("engine", "auto")
            is_remotion = requested_engine == "remotion" or (
                requested_engine != "ffmpeg" and (bool(d.get("is_remotion")) or preset_id in REMOTION_PRESET_IDS)
            )

            if is_remotion:
                job["message"] = "Preparing Remotion premium render..."
                remotion_public = REMOTION_DIR / "public"
                remotion_public.mkdir(exist_ok=True)

                cur_video_path = WORK / current
                remotion_vid_name = f"input_{job_id}.mp4"
                remotion_vid_target = remotion_public / remotion_vid_name
                shutil.copy2(cur_video_path, remotion_vid_target)
                temp.append(remotion_vid_target)

                remotion_words = []
                for c in caps:
                    for w in c.get("words", []):
                        remotion_words.append((round(float(w[0]), 3), round(float(w[1]), 3), str(w[2])))

                remotion_graphics = []
                raw_graphics = d.get("graphics", [])
                for g in raw_graphics:
                    try:
                        gs = remap(float(g.get("start", 0)))
                        ge = remap(float(g.get("end", 0)))
                        remotion_graphics.append({
                            "start": round(gs, 3),
                            "end": round(ge, 3),
                            "type": g.get("type", "kinetic_text"),
                            "text": str(g.get("text", "")),
                            "keyword": str(g.get("keyword", "")),
                            "position": g.get("position", "top")
                        })
                    except Exception:
                        pass

                for b in brolls:
                    b_src = WORK / b["file"]
                    b_dst = remotion_public / b["file"]
                    if b_src.exists() and not b_dst.exists():
                        shutil.copy2(b_src, b_dst)
                        temp.append(b_dst)
                    remotion_graphics.append({
                        "start": round(float(b["start"]), 3),
                        "end": round(float(b["end"]), 3),
                        "type": "broll",
                        "src": b["file"]
                    })

                person_name = None
                if d.get("behindPerson") or preset_id in ("orange_pop", "ca_cutout", "dimension_story", "spatial_red", "spatial_white", "spatial_yellow"):
                    try:
                        job["message"] = f"Creating person cutout mask for {preset_id}..."
                        person_webm_name = f"person_{job_id}.webm"
                        person_path = remotion_public / person_webm_name
                        mask_lib.make_person_webm(
                            ffmpeg_path(),
                            cur_video_path,
                            person_path,
                            W,
                            H,
                            fps=30,
                            on_progress=lambda p: job.update(progress=round(base + p * 0.1, 1))
                        )
                        if person_path.exists():
                            person_name = person_webm_name
                            temp.append(person_path)
                    except Exception as pe:
                        print("Person mask skipped:", pe)
                        job["message"] = f"Person cutout skipped ({pe}). Continuing render..."
                        person_name = None

                palette_choice = d.get("palette") or {"c1": "#FFE600", "c2": "#FF7A18", "text": "#FFFFFF"}
                auto_color = bool(d.get("autoColor", False))

                props = premium_render.build_props(
                    video_name=remotion_vid_name,
                    words=remotion_words,
                    preset_id=preset_id,
                    graphics=remotion_graphics,
                    palette=palette_choice,
                    duration=cur_duration,
                    width=W,
                    height=H,
                    fps=30,
                    person_name=person_name,
                    auto_color=auto_color
                )

                job["message"] = "Rendering premium Remotion motion graphics..."
                out_name = f"{job_id}_final.mp4"
                out_file = WORK / out_name
                rem_span = 100.0 - base

                def on_render_progress(pct):
                    job.update(progress=round(base + (pct / 100.0) * rem_span, 1))

                premium_render.render(props, out_file, on_progress=on_render_progress)
                job.update(status="done", progress=100, message="Your video is ready! 🎬",
                           download=f"/download/{out_name}")
                return

            ass_name = None
            front_ass_name = None
            if caps:
                st = stylelib.clean_style(d.get("style"))
                if st.get("isSpecial"):
                    ass_name = f"{job_id}_depth.ass"
                    front_ass_name = f"{job_id}_subtitle.ass"
                    depth_ass, subtitle_ass = stylelib.build_depth_ass(caps, st, W, H)
                    (WORK / ass_name).write_text(depth_ass, encoding="utf-8")
                    (WORK / front_ass_name).write_text(subtitle_ass, encoding="utf-8")
                    temp.extend([WORK / ass_name, WORK / front_ass_name])
                else:
                    ass_name = f"{job_id}.ass"
                    temp.append(WORK / ass_name)
                    (WORK / ass_name).write_text(stylelib.build_ass(caps, st, W, H), encoding="utf-8")

            # Build a transparent person layer for presets that place captions behind the speaker.
            person_name = None
            active_style = d.get("style") or {}
            if ass_name and active_style.get("behindPerson"):
                try:
                    job["message"] = "Separating the speaker for behind-person captions..."
                    person_name = f"person_{job_id}.webm"
                    person_path = WORK / person_name
                    mask_lib.make_person_webm(
                        ffmpeg_path(), WORK / current, person_path, W, H, fps=30,
                        on_progress=lambda p: job.update(progress=round(12 + p * 0.1, 1))
                    )
                    if person_path.exists():
                        temp.append(person_path)
                    else:
                        person_name = None
                except Exception as pe:
                    print("Person mask skipped:", pe)
                    person_name = None

            # Build the final filter chain with effects
            job["message"] = "Adding captions, effects and b-roll..."
            out_ext = ".webm" if d.get("format") == "webm" else ".mp4"
            out_name = f"{job_id}_final{out_ext}"
            args = ["-i", current]
            for b in brolls:
                args += ["-i", b["file"]]
            if person_name:
                args += ["-i", str(WORK / person_name)]

            # Motion Graphics overlays
            graphics = d.get("graphics", [])
            if keep and graphics:
                for g in graphics:
                    g["start"] = remap(float(g["start"]))
                    g["end"] = remap(float(g["end"]))

            # Build overlay filter
            base_filter = overlay_filter(W, H, fps, brolls, ass_name, person_name, cur_duration, front_ass_name)

            final_v = "[vout]"
            if graphics:
                mg_inputs, mg_filters, mg_out_label, mg_temp_files = mg.build_motion_graphics_filter(
                    graphics, WORK, W, H, start_input_idx=1 + len(brolls) + (1 if person_name else 0), in_label="[vout]", out_label="[vmg_out]"
                )
                temp.extend(mg_temp_files)
                if mg_filters:
                    args += mg_inputs
                    base_filter = base_filter + ";" + mg_filters
                    final_v = mg_out_label

            # Add post-processing effects
            post_effects = []
            if effects.get("vignette"):
                post_effects.append("vignette=PI/4")
            if effects.get("sharpen"):
                post_effects.append("unsharp=5:5:1.0:5:5:0.0")
            if effects.get("cinemaBar"):
                bar_h = max(1, H // 12)
                post_effects.append(f"drawbox=x=0:y=0:w={W}:h={bar_h}:color=black:t=fill")
                post_effects.append(f"drawbox=x=0:y={H - bar_h}:w={W}:h={bar_h}:color=black:t=fill")

            if post_effects:
                effect_chain = ",".join(post_effects)
                base_filter = base_filter + f";{final_v}{effect_chain}[vpost]"
                final_v = "[vpost]"

            args += ["-filter_complex", base_filter, "-map", final_v, "-map", "0:a?"]

            # Speed adjustment
            if speed != 1.0:
                inv = 1.0 / speed
                args += ["-filter:a", f"atempo={speed}"]

            # Background music mixing
            bg_music = d.get("bgMusic")
            if bg_music and (WORK / bg_music).exists():
                music_vol = max(0, min(100, int(d.get("musicVol", 30)))) / 100.0
                voice_vol = max(50, min(150, int(d.get("voiceVol", 100)))) / 100.0
                # Add music as additional input and mix
                args_new = []
                # Insert music input before -filter_complex
                fc_idx = args.index("-filter_complex")
                args_new = args[:fc_idx]
                args_new += ["-i", str(WORK / bg_music), "-stream_loop", "-1"]
                # Modify to mix audio
                old_fc = args[fc_idx + 1]
                args_new += ["-filter_complex", old_fc]
                args_new += args[fc_idx + 2:]
                # Replace simple audio map with mixed audio
                # We'll use a simple approach: mix in post
                args = args_new

            # Video codec settings
            if d.get("format") == "webm":
                args += ["-c:v", "libvpx-vp9", "-b:v", "0", "-crf", crf,
                         "-pix_fmt", "yuv420p", "-c:a", "libopus", "-b:a", "128k"]
            else:
                args += ["-c:v", "libx264", "-preset", preset, "-crf", crf,
                         "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart"]

            args += [out_name]
            run_ffmpeg(args, job, cur_duration, base, step_span)
            job.update(status="done", progress=100, message="Your video is ready! \U0001F389",
                       download=f"/download/{out_name}")
    except Exception as e:  # noqa
        job.update(status="error", message=str(e)[:1500])
    finally:
        for t in temp:
            try:
                t.unlink(missing_ok=True)
            except OSError:
                pass


@app.post("/api/export")
def export():
    d = request.get_json(force=True)
    if not ffmpeg_path():
        return err("FFmpeg is not installed.", 500)
    job_id = uuid.uuid4().hex[:12]
    JOBS[job_id] = {"status": "queued", "progress": 0, "message": "Waiting...", "download": None}
    threading.Thread(target=export_worker, args=(job_id, d), daemon=True).start()
    return jsonify(job=job_id)


@app.get("/api/jobs/<job_id>")
def job_status(job_id):
    j = JOBS.get(job_id)
    if not j:
        return err("Job not found.", 404)
    return jsonify(j)


@app.get("/download/<path:filename>")
def download(filename):
    safe = Path(filename).name
    if not (safe.endswith("_final.mp4") or safe.endswith("_final.webm")):
        abort(404)
    dl_name = "captioned_video" + Path(safe).suffix
    return send_from_directory(WORK, safe, as_attachment=True, download_name=dl_name)


def cleanup_old(days=3):
    cutoff = time.time() - days * 86400
    for p in WORK.glob("*"):
        try:
            if p.is_file() and p.stat().st_mtime < cutoff:
                p.unlink()
        except OSError:
            pass


if __name__ == "__main__":
    cleanup_old()
    ff = ffmpeg_path()
    if not ff:
        print("\nWARNING: FFmpeg was not found. Follow SETUP.md to install it.\n")
    else:
        print(f"FFmpeg active: {ff}")
    print("CaptionStudio Pro is running at:")
    print("  -> http://localhost:5000")
    print("  -> http://127.0.0.1:5000")
    app.run(host="0.0.0.0", port=5000, debug=False, threaded=True)
