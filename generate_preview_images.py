"""
Generate high quality 9:16 preview cards for all 26 unique presets.
Saves to static/preset_previews/<id>.png.
"""
import os
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

BASE_DIR = Path(__file__).resolve().parent
STATIC_PREVIEWS = BASE_DIR / "static" / "preset_previews"
STATIC_PREVIEWS.mkdir(parents=True, exist_ok=True)

JSON_PATH = BASE_DIR / "unique_presets_pack" / "unique_presets.json"
if not JSON_PATH.exists():
    JSON_PATH = Path(r"C:\Users\NIKHIL\.gemini\antigravity\brain\2aa04f04-f317-405e-87c8-13c3239de329\unique_presets_pack\unique_presets.json")

with open(JSON_PATH, "r", encoding="utf-8") as f:
    presets = json.load(f)

W, H = 270, 420  # 9:14 card aspect ratio

# Find system font or fallback
font_title = ImageFont.load_default()
font_sub = ImageFont.load_default()
font_word = ImageFont.load_default()

for p in presets:
    pid = p["id"]
    name = p["name"]
    tagline = p.get("tagline", "")
    colors = p.get("colors", ["#FFFFFF", "#00F0FF"])
    c1 = colors[0] if colors else "#FFFFFF"
    c2 = colors[1] if len(colors) > 1 else colors[0]
    c3 = colors[2] if len(colors) > 2 else c2

    # 1. Create base background image (dark cinematic card)
    img = Image.new("RGBA", (W, H), (14, 17, 26, 255))
    draw = ImageDraw.Draw(img)

    # Subtle radial or diagonal gradient glow in background
    for y in range(H):
        ratio = y / H
        r = int(14 + (25 - 14) * ratio)
        g = int(17 + (32 - 17) * ratio)
        b = int(26 + (50 - 26) * ratio)
        draw.line([(0, y), (W, y)], fill=(r, g, b, 255))

    # Top accent pill
    draw.rounded_rectangle([16, 16, 16 + 70, 34], radius=9, fill=(35, 45, 68, 200))
    draw.text((26, 19), "UNIQUE", fill=(0, 240, 255, 255), font=font_title)

    # Center simulated caption text
    center_y = 190

    if pid == "u_news_bar":
        # Breaking News Bar
        draw.rectangle([16, center_y - 20, 75, center_y + 12], fill="#D90429")
        draw.text((22, center_y - 14), "LIVE", fill="#FFFFFF", font=font_title)
        draw.rectangle([75, center_y - 20, W - 16, center_y + 12], fill="#1E232F")
        draw.text((85, center_y - 14), "BREAKING NEWS", fill="#FFFFFF", font=font_title)
        draw.rectangle([16, center_y + 16, W - 16, center_y + 38], fill="#FFFFFF")
        draw.text((24, center_y + 20), "MAKE IT POP TODAY", fill="#000000", font=font_title)

    elif pid == "u_ransom_cutout":
        # Ransom cutouts
        tiles = [("MAKE", "#FF6B9A", "#FFFFFF", -6), ("IT", "#59D6FF", "#000000", 5), ("POP", "#FFD23B", "#111111", -3)]
        tx = 24
        for word, bg, fg, tilt in tiles:
            draw.rounded_rectangle([tx, center_y - 10, tx + 65, center_y + 35], radius=4, fill=bg)
            draw.text((tx + 12, center_y + 4), word, fill=fg, font=font_title)
            tx += 75

    elif pid == "u_neon_sign":
        # Neon sign
        draw.rounded_rectangle([20, center_y - 25, W - 20, center_y + 45], radius=8, outline="#FF63D8", width=2)
        draw.text((45, center_y - 8), "FLICKER NEON", fill="#FF63D8", font=font_title)
        draw.text((65, center_y + 12), "POP TODAY", fill="#7A2BFF", font=font_title)

    elif pid == "u_comic_burst":
        # Comic burst
        draw.ellipse([40, center_y - 30, W - 40, center_y + 45], fill="#FFE14D", outline="#E4002B", width=3)
        draw.text((85, center_y - 5), "POW!!", fill="#E4002B", font=font_title)

    elif pid == "u_typewriter":
        # Terminal typewriter
        draw.rounded_rectangle([20, center_y - 20, W - 20, center_y + 35], radius=6, fill="#0B0E12", outline="#223040", width=1)
        draw.text((32, center_y - 5), "> make it pop _", fill="#7CFFB2", font=font_title)

    elif pid == "u_arcade":
        # Retro 8-bit arcade
        draw.rectangle([25, center_y - 15, W - 25, center_y + 35], fill="#1A1230", outline="#FFE600", width=2)
        draw.text((50, center_y - 2), "1UP POP TODAY", fill="#FFE600", font=font_title)

    elif pid == "u_highlighter_box" or pid == "u_marker_swipe":
        # Highlight Box
        draw.rounded_rectangle([30, center_y - 10, W - 30, center_y + 35], radius=6, fill="#FFE14D")
        draw.text((55, center_y + 2), "MAKE IT POP", fill="#111111", font=font_title)

    elif pid == "u_chat_bubble":
        # Chat bubble
        draw.rounded_rectangle([25, center_y - 20, W - 25, center_y + 30], radius=14, fill="#0A84FF")
        draw.text((50, center_y - 4), "Make it pop today", fill="#FFFFFF", font=font_title)

    elif pid == "u_chalkboard":
        # Chalkboard
        draw.rounded_rectangle([18, center_y - 25, W - 18, center_y + 40], radius=6, fill="#1F3A2E", outline="#8B5A2B", width=4)
        draw.text((45, center_y - 5), "Make it pop today", fill="#F4F7F2", font=font_title)

    elif pid == "u_emoji_pop":
        # Emoji pop
        draw.text((40, center_y - 10), "MAKE IT POP 🔥", fill="#FFD23B", font=font_title)

    elif pid == "u_glitch_rgb":
        # RGB Glitch
        draw.text((43, center_y - 8), "RGB GLITCH", fill="#FF0A45", font=font_title)
        draw.text((47, center_y - 12), "RGB GLITCH", fill="#00F0FF", font=font_title)
        draw.text((45, center_y - 10), "RGB GLITCH", fill="#FFFFFF", font=font_title)

    elif pid == "u_glass_aurora":
        # Glass aurora
        draw.rounded_rectangle([25, center_y - 20, W - 25, center_y + 35], radius=25, fill=(35, 40, 70, 180), outline="#FF5EA8", width=2)
        draw.text((60, center_y - 4), "AURORA GLASS", fill="#FFFFFF", font=font_title)

    else:
        # Standard vibrant styling with exact preset colors
        draw.text((45, center_y - 15), "MAKE IT", fill=c1, font=font_title)
        draw.text((45, center_y + 8), "POP TODAY", fill=c2, font=font_title)

    # Bottom card footer: Name and Tagline
    draw.rectangle([0, H - 90, W, H], fill=(12, 14, 22, 230))
    draw.line([(0, H - 90), (W, H - 90)], fill=(255, 255, 255, 25))

    # Name
    draw.text((16, H - 80), name[:22], fill="#FFFFFF", font=font_title)

    # Color dots
    dx = W - 16 - (len(colors) * 14)
    for c in colors:
        draw.ellipse([dx, H - 76, dx + 8, H - 68], fill=c)
        dx += 14

    # Tagline
    draw.text((16, H - 56), tagline[:38], fill="#94A3B8", font=font_sub)
    if len(tagline) > 38:
        draw.text((16, H - 42), tagline[38:76], fill="#64748B", font=font_sub)

    # Save PNG
    out_file = STATIC_PREVIEWS / f"{pid}.png"
    img.save(out_file, "PNG")

print(f"Generated {len(presets)} preview PNGs in {STATIC_PREVIEWS}.")
