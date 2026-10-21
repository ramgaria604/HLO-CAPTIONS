"""Pick caption/graphic colours that fit the video. Needs Pillow + ffmpeg."""
import colorsys
import subprocess
import tempfile
from pathlib import Path

from PIL import Image


def _frames(ffmpeg, video, duration, n=6):
    d = Path(tempfile.mkdtemp())
    for i in range(n):
        t = duration * (i + 0.5) / n
        subprocess.run([ffmpeg, "-y", "-loglevel", "error", "-ss", f"{t:.2f}", "-i", str(video), "-frames:v", "1",
                        "-vf", "scale=160:-1", str(d / f"f{i}.png")], check=False)
    return [Image.open(p).convert("RGB") for p in sorted(d.glob("f*.png"))]


def _hex(rgb):
    return "#%02X%02X%02X" % tuple(int(x) for x in rgb)


def extract(ffmpeg, video, duration):
    imgs = _frames(ffmpeg, video, duration)
    if not imgs:
        return [{"name": "Default", "c1": "#FFE600", "c2": "#FF7A18", "text": "#FFFFFF"}]
    colors, lum = [], []
    for im in imgs:
        q = im.quantize(colors=5, method=Image.Quantize.MEDIANCUT).convert("RGB")
        for cnt, rgb in q.getcolors(10000):
            colors.append((cnt, rgb))
        lum.append(sum(im.convert("L").getdata()) / (im.width * im.height))
    brightness = sum(lum) / len(lum)
    scored = []
    for cnt, (r, g, b) in colors:
        h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        scored.append((s * v * cnt ** 0.5, (r, g, b), h))
    scored.sort(reverse=True)
    vivid = scored[0][1] if scored else (255, 122, 24)
    h = scored[0][2] if scored else 0.08
    comp = colorsys.hsv_to_rgb((h + 0.5) % 1, 0.85, 1.0)
    comp = tuple(int(c * 255) for c in comp)
    dark = brightness > 140                     # bright video -> dark text
    text = "#111111" if dark else "#FFFFFF"
    boost = lambda rgb: tuple(int(min(255, c * 1.15 + 20)) for c in rgb)
    return [
        {"name": "Match video", "c1": _hex(boost(vivid)), "c2": _hex(vivid), "text": text},
        {"name": "Contrast pop", "c1": _hex(comp), "c2": _hex(tuple(int(c * .7) for c in comp)), "text": text},
        {"name": "Clean " + ("dark" if dark else "light"), "c1": "#111111" if dark else "#FFFFFF",
         "c2": "#4DA3FF" if dark else "#FFE600", "text": text},
    ]
