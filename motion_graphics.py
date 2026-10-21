"""CaptionStudio Pro: Motion Graphics Engine & Renderer.
Provides reusable motion graphic templates, high-res RGBA card rendering with Pillow,
and FFmpeg overlay filtergraph generation with cubic-bezier easing and fade/slide animations.
"""
import os
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

from fonts_util import FONTS_DIR


TEMPLATES = [
    {
        "type": "animated_title",
        "name": "Animated Section Title",
        "category": "headings",
        "description": "Bold headline banner with vibrant accent underline and dark glass card.",
        "defaultData": {"title": "KEY CHAPTER", "subtitle": "SECTION OVERVIEW", "accentColor": "#FFE600", "bgColor": "rgba(10, 11, 26, 0.90)"},
        "defaultPosition": "top_center",
        "defaultAnimation": {"enter": "fade_slide_down", "exit": "fade_out"}
    },
    {
        "type": "lower_third",
        "name": "Speaker / Host Lower Third",
        "category": "labels",
        "description": "Sleek glassmorphic name banner with verified badge and role description.",
        "defaultData": {"title": "SPEAKER NAME", "subtitle": "CREATOR & FOUNDER", "tag": "VERIFIED", "accentColor": "#EC4899", "bgColor": "rgba(15, 23, 42, 0.92)"},
        "defaultPosition": "bottom_left",
        "defaultAnimation": {"enter": "slide_right", "exit": "fade_out"}
    },
    {
        "type": "statistic_counter",
        "name": "Statistic & Metric Counter",
        "category": "data",
        "description": "High-impact numerical callout for percentages, multipliers, and statistics.",
        "defaultData": {"value": "+85%", "label": "GROWTH METRIC", "subtext": "Month-over-month increase", "accentColor": "#38BDF8", "bgColor": "rgba(15, 23, 42, 0.92)"},
        "defaultPosition": "top_right",
        "defaultAnimation": {"enter": "scale_pop", "exit": "fade_scale"}
    },
    {
        "type": "price_callout",
        "name": "Price & Valuation Tag",
        "category": "data",
        "description": "Real-estate & commercial valuation tag with currency pill badge.",
        "defaultData": {"value": "$1,250,000", "label": "OFFER PRICE", "subtext": "Prime location estate", "accentColor": "#22C55E", "bgColor": "rgba(10, 11, 26, 0.92)"},
        "defaultPosition": "top_right",
        "defaultAnimation": {"enter": "scale_pop", "exit": "fade_scale"}
    },
    {
        "type": "location_badge",
        "name": "Geographical Location Pin",
        "category": "labels",
        "description": "City and region tag with location pin emblem.",
        "defaultData": {"location": "NEW YORK CITY", "label": "LOCATION PIN", "accentColor": "#F59E0B", "bgColor": "rgba(24, 24, 27, 0.92)"},
        "defaultPosition": "top_left",
        "defaultAnimation": {"enter": "slide_right", "exit": "fade_out"}
    },
    {
        "type": "keyword_callout",
        "name": "Kinetic Keyword Spotlight",
        "category": "callouts",
        "description": "Vibrant highlighted badge spotlighting the single most important word.",
        "defaultData": {"keyword": "MOMENTUM", "tag": "CORE PRINCIPLE", "accentColor": "#FFE600", "bgColor": "rgba(10, 11, 26, 0.94)"},
        "defaultPosition": "center",
        "defaultAnimation": {"enter": "scale_pop", "exit": "fade_scale"}
    },
    {
        "type": "quote_card",
        "name": "Quotation & Wisdom Card",
        "category": "cards",
        "description": "Elegant speech bubble with quote marks and key takeaway.",
        "defaultData": {"quote": "Focus on the input, and the output takes care of itself.", "author": "KEY PRINCIPLE", "accentColor": "#A855F7", "bgColor": "rgba(15, 23, 42, 0.92)"},
        "defaultPosition": "center",
        "defaultAnimation": {"enter": "scale_pop", "exit": "fade_out"}
    },
    {
        "type": "comparison_card",
        "name": "Versus / Comparison Card",
        "category": "cards",
        "description": "Side-by-side contrast card comparing two opposing options.",
        "defaultData": {"left": "OLD WAY", "right": "SMART WAY", "leftSub": "Slow & manual", "rightSub": "Automated & 10x faster", "accentColor": "#00F0FF", "bgColor": "rgba(15, 23, 42, 0.92)"},
        "defaultPosition": "center",
        "defaultAnimation": {"enter": "scale_pop", "exit": "fade_scale"}
    },
    {
        "type": "call_to_action",
        "name": "Conversion End Card",
        "category": "cards",
        "description": "Professional call-to-action banner with subscribe button and social prompt.",
        "defaultData": {"title": "SUBSCRIBE FOR MORE", "subtitle": "Follow for daily high-value guides", "buttonText": "LINK IN BIO", "accentColor": "#EC4899", "bgColor": "rgba(15, 23, 42, 0.95)"},
        "defaultPosition": "bottom_center",
        "defaultAnimation": {"enter": "slide_up", "exit": "fade_out"}
    },
    # --- 3D REFERENCE VIDEO SUITE (Google Drive Reference) ---
    {
        "type": "isometric_phone_card",
        "name": "3D Isometric Phone Showcase 📱",
        "category": "3d",
        "description": "3D angled smartphone with floating project cards, live view count, and follower tags (Reference Video Frame 2).",
        "defaultData": {"handle": "@creator_studio", "views": "3,878", "followers": "+328", "title": "BLENDER 3D REEL", "subtitle": "Viral Motion Project", "accentColor": "#00F0FF", "bgColor": "rgba(10, 14, 34, 0.96)"},
        "defaultPosition": "center",
        "defaultAnimation": {"enter": "scale_pop", "exit": "fade_scale"}
    },
    {
        "type": "neon_badge_aura",
        "name": "Glowing 3D Neon Badge ⚡",
        "category": "3d",
        "description": "Floating 3D frosted pill badge with pulsating radial backlight bloom (Reference Video Frame 6).",
        "defaultData": {"title": "SLATE", "subtitle": "ACADEMY", "tag": "VERIFIED PRO", "accentColor": "#00D2FF", "bgColor": "rgba(0, 80, 255, 0.92)"},
        "defaultPosition": "center",
        "defaultAnimation": {"enter": "scale_pop", "exit": "fade_scale"}
    },
    {
        "type": "split_kinetic_title",
        "name": "3D Kinetic Split Heading 💥",
        "category": "headings",
        "description": "Dual-tone 3D extruded title with lime-yellow top and electric cyan 3D shadow (Reference Video Frame 11).",
        "defaultData": {"topText": "AND I'M", "bottomText": "UNSTOPPABLE", "accentColor": "#00F0FF", "topColor": "#FFE600", "bgColor": "rgba(10, 11, 26, 0.92)"},
        "defaultPosition": "top_center",
        "defaultAnimation": {"enter": "fade_slide_down", "exit": "fade_out"}
    },
    {
        "type": "crimson_ambient_spotlight",
        "name": "Cinematic Crimson Flare 🚨",
        "category": "cinematic",
        "description": "Dramatic ambient backlight bloom flare behind the subject (Reference Video Frame 13).",
        "defaultData": {"title": "BREAKTHROUGH", "subtitle": "CRITICAL MOMENT", "accentColor": "#FF003C", "bgColor": "rgba(25, 5, 12, 0.94)"},
        "defaultPosition": "center",
        "defaultAnimation": {"enter": "scale_pop", "exit": "fade_out"}
    },
    {
        "type": "occlusion_prison_bars",
        "name": "3D Foreground Prison Bars (Reference 🚨)",
        "category": "3d",
        "description": "3D metallic cylinder jail bars in foreground with glowing crimson neon text physically sitting behind (Reference Video Frame 13).",
        "defaultData": {"title": "life is cell", "accentColor": "#EF4444", "bgColor": "rgba(10, 10, 15, 0.95)"},
        "defaultPosition": "center",
        "defaultAnimation": {"enter": "scale_pop", "exit": "fade_scale"}
    },
    {
        "type": "cyber_hud_metric",
        "name": "Cyberpunk HUD Data Meter 📊",
        "category": "data",
        "description": "Sci-fi technical brackets with live blinking status dot, wave meter, and percentage readout.",
        "defaultData": {"metric": "98.4%", "label": "RETENTION RATE", "status": "LIVE METRIC", "accentColor": "#00FF9D", "bgColor": "rgba(6, 12, 24, 0.94)"},
        "defaultPosition": "top_left",
        "defaultAnimation": {"enter": "slide_right", "exit": "fade_out"}
    },
    {
        "type": "profit_money_callout",
        "name": "Revenue Cash Pill 💰",
        "category": "data",
        "description": "Emerald glassmorphic cash card with rising profit metric and green neon glow.",
        "defaultData": {"value": "+$25,400", "label": "NET REVENUE", "subtext": "Automated sales volume", "accentColor": "#22C55E", "bgColor": "rgba(6, 32, 20, 0.94)"},
        "defaultPosition": "top_right",
        "defaultAnimation": {"enter": "scale_pop", "exit": "fade_scale"}
    },
    {
        "type": "viral_rocket_boost",
        "name": "3D Viral Rocket Boost 🚀",
        "category": "viral",
        "description": "High-impact rocket launch badge with animated flame pulse and reach statistics.",
        "defaultData": {"value": "+100K", "label": "VIRAL REACH", "subtext": "First 24 hours launch", "accentColor": "#F59E0B", "bgColor": "rgba(30, 15, 5, 0.94)"},
        "defaultPosition": "top_right",
        "defaultAnimation": {"enter": "scale_pop", "exit": "fade_scale"}
    },
    {
        "type": "verified_creator_shield",
        "name": "Verified Creator Shield 🛡️",
        "category": "labels",
        "description": "Iridescent verified shield emblem with creator handle and follower tier.",
        "defaultData": {"handle": "@TOP_CREATOR", "tier": "OFFICIAL PARTNER", "subtext": "1.2M Followers", "accentColor": "#A855F7", "bgColor": "rgba(24, 15, 45, 0.94)"},
        "defaultPosition": "bottom_left",
        "defaultAnimation": {"enter": "slide_right", "exit": "fade_out"}
    },
    {
        "type": "financial_chart",
        "name": "Financial Trend Curve & Surge 📈",
        "category": "documentary",
        "description": "After Effects animated financial vector graph with surging valuation and glowing profit metric.",
        "defaultData": {"badge": "▲ +148% SURGE", "value": "+$84,500", "label": "MARKET TRAJECTORY", "accentColor": "#10B981", "bgColor": "rgba(6, 25, 20, 0.94)"},
        "defaultPosition": "behind_person",
        "defaultAnimation": {"enter": "scale_pop", "exit": "fade_scale"}
    },
    {
        "type": "classified_dossier",
        "name": "Classified Top Secret Dossier 📁",
        "category": "documentary",
        "description": "Authentic investigative document with red confidential stamp, yellow highlight, and declassifying redactions.",
        "defaultData": {"stamp": "TOP SECRET", "header": "INTERNAL EVIDENCE MEMO", "highlight": "CRITICAL ADMISSION", "context": "Documented record declassified for review", "accentColor": "#FFE600", "bgColor": "rgba(20, 20, 24, 0.95)"},
        "defaultPosition": "behind_person",
        "defaultAnimation": {"enter": "fade_slide_down", "exit": "fade_out"}
    },
    {
        "type": "timeline_milestone",
        "name": "Historical Milestone Timeline ⏳",
        "category": "documentary",
        "description": "Historical timeline milestone with glowing year, radar ping, and event headline.",
        "defaultData": {"tag": "HISTORICAL TURNING POINT", "year": "1971", "title": "BRETTON WOODS COLLAPSE", "subtitle": "Fiat monetary expansion era begins", "accentColor": "#38BDF8", "bgColor": "rgba(10, 20, 36, 0.94)"},
        "defaultPosition": "behind_person",
        "defaultAnimation": {"enter": "slide_right", "exit": "fade_out"}
    },
    {
        "type": "versus_split",
        "name": "Versus Clash Split ⚔️",
        "category": "comparison",
        "description": "High-octane clash comparison card with lightning sparks and side-by-side opposing forces.",
        "defaultData": {"sideA": "CONVENTIONAL", "sideB": "EXPONENTIAL", "accentColor": "#F43F5E", "bgColor": "rgba(30, 10, 20, 0.94)"},
        "defaultPosition": "behind_person",
        "defaultAnimation": {"enter": "scale_pop", "exit": "fade_scale"}
    }
]



def _get_font(font_name="Poppins-Bold.ttf", size=32):
    """Safely loads a TTF font from fonts directory or falls back to default."""
    try:
        cand = FONTS_DIR / font_name
        if cand.exists():
            return ImageFont.truetype(str(cand), size)
        # Search for any TTF in fonts
        for p in FONTS_DIR.glob("*.ttf"):
            return ImageFont.truetype(str(p), size)
    except Exception:
        pass
    return ImageFont.load_default()


def _hex_to_rgb(hex_str, alpha=255):
    """Converts #RRGGBB or rgba string to (R, G, B, A)."""
    if hex_str.startswith("rgba"):
        try:
            parts = hex_str.replace("rgba(", "").replace(")", "").split(",")
            return int(parts[0]), int(parts[1]), int(parts[2]), int(float(parts[3]) * 255)
        except Exception:
            return 15, 23, 42, 230
    h = hex_str.lstrip("#")
    if len(h) == 6:
        return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), alpha
    return 255, 255, 255, alpha


def render_graphic_card(graphic, out_path, target_width=720):
    """
    Renders a motion graphic template to a transparent 32-bit RGBA PNG image file.
    Supports high-DPI crisp rendering, rounded corners, drop shadows, gradients, and typography.
    """
    g_type = graphic.get("type", "lower_third")
    data = graphic.get("data", {})
    accent_hex = data.get("accentColor", "#FFE600")
    bg_hex = data.get("bgColor", "rgba(15, 23, 42, 0.92)")

    accent_rgba = _hex_to_rgb(accent_hex, 255)
    bg_rgba = _hex_to_rgb(bg_hex, 235)

    card_w = min(int(target_width * 0.88), 640)
    card_h = 160

    if g_type in ("animated_title", "keyword_callout"):
        card_h = 130
    elif g_type in ("statistic_counter", "price_callout", "profit_money_callout", "viral_rocket_boost"):
        card_h = 170
        card_w = min(int(target_width * 0.78), 540)
    elif g_type in ("comparison_card", "quote_card"):
        card_h = 220
        card_w = min(int(target_width * 0.92), 680)
    elif g_type == "isometric_phone_card":
        card_h = 260
        card_w = min(int(target_width * 0.88), 620)
    elif g_type == "neon_badge_aura":
        card_h = 160
        card_w = min(int(target_width * 0.65), 440)
    elif g_type == "split_kinetic_title":
        card_h = 160
        card_w = min(int(target_width * 0.85), 600)
    elif g_type in ("crimson_ambient_spotlight", "cyber_hud_metric"):
        card_h = 180
        card_w = min(int(target_width * 0.82), 560)
    elif g_type == "call_to_action":
        card_h = 190
        card_w = min(int(target_width * 0.90), 660)
    elif g_type in ("financial_chart", "classified_dossier", "timeline_milestone"):
        card_h = 210
        card_w = min(int(target_width * 0.92), 680)
    elif g_type == "versus_split":
        card_h = 170
        card_w = min(int(target_width * 0.88), 620)

    # 1. Create transparent image canvas with extra room for radial aura glow
    img = Image.new("RGBA", (card_w, card_h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 2. Draw card background with rounded corners and border
    corner_r = 16

    # Draw radial back-glow for neon_badge_aura and crimson_ambient_spotlight
    if g_type in ("neon_badge_aura", "crimson_ambient_spotlight"):
        cx, cy = card_w // 2, card_h // 2
        glow_col = accent_rgba[:3]
        for rad, a in [(120, 15), (90, 25), (60, 45), (40, 70)]:
            draw.ellipse([(cx - rad, cy - rad), (cx + rad, cy + rad)], fill=(*glow_col, a))

    if g_type not in ("split_kinetic_title", "occlusion_prison_bars"):
        draw.rounded_rectangle([(3, 3), (card_w - 4, card_h - 4)], radius=corner_r, fill=bg_rgba, outline=accent_rgba, width=2)

    # 3. Render content specific to each motion graphic type
    title_font = _get_font("Poppins-Bold.ttf", 28)
    sub_font = _get_font("Poppins-Regular.ttf", 19)
    tag_font = _get_font("Poppins-Bold.ttf", 15)
    big_stat_font = _get_font("Anton-Regular.ttf", 52)

    if g_type == "animated_title":
        title = data.get("title", "KEY CHAPTER")
        subtitle = data.get("subtitle", "SECTION OVERVIEW")
        draw.rounded_rectangle([(20, 18), (80, 24)], radius=3, fill=accent_rgba)
        draw.text((90, 12), subtitle, font=tag_font, fill=accent_rgba)
        draw.text((20, 52), title, font=title_font, fill=(255, 255, 255, 255))
        draw.line([(20, 105), (card_w - 30, 105)], fill=(255, 255, 255, 40), width=1)
        draw.line([(20, 105), (140, 105)], fill=accent_rgba, width=3)

    elif g_type == "lower_third":
        title = data.get("title", "SPEAKER NAME")
        subtitle = data.get("subtitle", "CREATOR & FOUNDER")
        tag = data.get("tag", "VERIFIED")
        tag_w = len(tag) * 11 + 20
        draw.rounded_rectangle([(20, 18), (20 + tag_w, 42)], radius=6, fill=accent_rgba)
        draw.text((30, 20), tag, font=tag_font, fill=(10, 11, 26, 255))
        draw.text((20, 56), title, font=title_font, fill=(255, 255, 255, 255))
        draw.text((20, 104), subtitle, font=sub_font, fill=(203, 213, 225, 230))

    elif g_type in ("statistic_counter", "price_callout", "profit_money_callout", "viral_rocket_boost"):
        val = data.get("value", "+85%")
        label = data.get("label", "KEY METRIC")
        subtext = data.get("subtext", "Spoken highlight")
        draw.text((24, 18), val, font=big_stat_font, fill=accent_rgba)
        draw.text((26, 95), label, font=tag_font, fill=(255, 255, 255, 255))
        draw.text((26, 125), subtext, font=sub_font, fill=(148, 163, 184, 230))

    elif g_type == "isometric_phone_card":
        handle = data.get("handle", "@creator_studio")
        views = data.get("views", "3,878")
        title = data.get("title", "BLENDER 3D REEL")
        sub = data.get("subtitle", "Viral Motion Project")
        # Top phone notch / header
        draw.rounded_rectangle([(card_w // 2 - 40, 10), (card_w // 2 + 40, 20)], radius=5, fill=(40, 48, 80, 255))
        draw.text((24, 28), handle, font=tag_font, fill=accent_rgba)
        draw.text((card_w - 140, 28), "● PRO DASH", font=tag_font, fill=(52, 211, 153, 255))
        # Floating 3D thumbnail representation
        draw.rounded_rectangle([(24, 60), (card_w - 24, 180)], radius=12, fill=(20, 28, 58, 255), outline=accent_rgba, width=1)
        draw.text((40, 78), title, font=title_font, fill=(255, 255, 255, 255))
        draw.text((40, 118), sub, font=sub_font, fill=(148, 163, 184, 255))
        # View count pill
        draw.rounded_rectangle([(40, 195), (180, 230)], radius=8, fill=accent_rgba)
        draw.text((54, 202), f"👁 {views} views", font=tag_font, fill=(10, 11, 26, 255))

    elif g_type == "neon_badge_aura":
        title = data.get("title", "SLATE")
        sub = data.get("subtitle", "ACADEMY")
        tag = data.get("tag", "VERIFIED PRO")
        draw.text((card_w // 2 - len(title) * 16, 24), title, font=big_stat_font, fill=(255, 255, 255, 255))
        draw.text((card_w // 2 - len(sub) * 7, 85), sub, font=tag_font, fill=accent_rgba)
        draw.text((card_w // 2 - len(tag) * 6, 115), f"★ {tag} ★", font=sub_font, fill=(203, 213, 225, 240))

    elif g_type == "split_kinetic_title":
        top = data.get("topText", "AND I'M").upper()
        bot = data.get("bottomText", "UNSTOPPABLE").upper()
        top_col = _hex_to_rgb(data.get("topColor", "#FFE600"), 255)
        draw.text((24, 20), top, font=title_font, fill=top_col)
        # 3D shadow for bottom text
        for off in (4, 3, 2, 1):
            draw.text((24 + off, 72 + off), bot, font=big_stat_font, fill=(0, 24, 48, 255))
        draw.text((24, 72), bot, font=big_stat_font, fill=accent_rgba)

    elif g_type == "occlusion_prison_bars":
        txt = data.get("title", "life is cell")
        cx, cy = card_w // 2, card_h // 2
        # Text atmospheric red glow behind bars
        for r_off in (24, 16, 8):
            draw.text((cx - len(txt) * 11, cy - 26), txt, font=big_stat_font, fill=(239, 68, 68, 60))
        # 3D text shadow
        for off in (4, 3, 2, 1):
            draw.text((cx - len(txt) * 11 + off, cy - 26 + off), txt, font=big_stat_font, fill=(127, 29, 29, 255))
        draw.text((cx - len(txt) * 11, cy - 26), txt, font=big_stat_font, fill=(255, 60, 60, 255))
        # Foreground 3D metallic vertical bars (occluding the text)
        num_bars = 6
        spacing = card_w // (num_bars + 1)
        for b_idx in range(1, num_bars + 1):
            bx = b_idx * spacing
            draw.rectangle([(bx - 8, 0), (bx + 8, card_h)], fill=(15, 23, 42, 255))
            draw.rectangle([(bx - 5, 0), (bx + 5, card_h)], fill=(71, 85, 105, 255))
            draw.rectangle([(bx - 2, 0), (bx + 2, card_h)], fill=(203, 213, 225, 255))

    elif g_type in ("crimson_ambient_spotlight", "cyber_hud_metric"):
        title = data.get("title") or data.get("metric", "98.4%")
        sub = data.get("subtitle") or data.get("label", "RETENTION RATE")
        status = data.get("status", "ACTIVE METRIC")
        # HUD brackets
        draw.line([(15, 15), (45, 15)], fill=accent_rgba, width=2)
        draw.line([(15, 15), (15, 45)], fill=accent_rgba, width=2)
        draw.line([(card_w - 15, 15), (card_w - 45, 15)], fill=accent_rgba, width=2)
        draw.line([(card_w - 15, 15), (card_w - 15, 45)], fill=accent_rgba, width=2)
        draw.text((28, 26), f"● {status}", font=tag_font, fill=accent_rgba)
        draw.text((28, 64), title, font=big_stat_font, fill=(255, 255, 255, 255))
        draw.text((28, 130), sub, font=sub_font, fill=(148, 163, 184, 240))

    elif g_type == "verified_creator_shield":
        handle = data.get("handle", "@TOP_CREATOR")
        tier = data.get("tier", "OFFICIAL PARTNER")
        sub = data.get("subtext", "1.2M Followers")
        draw.ellipse([(24, 28), (56, 60)], fill=accent_rgba)
        draw.text((34, 32), "✓", font=title_font, fill=(10, 11, 26, 255))
        draw.text((70, 24), handle, font=title_font, fill=(255, 255, 255, 255))
        draw.text((70, 68), tier, font=tag_font, fill=accent_rgba)
        draw.text((70, 96), sub, font=sub_font, fill=(203, 213, 225, 240))

    elif g_type == "location_badge":
        loc = data.get("location", "NEW YORK")
        label = data.get("label", "LOCATION PIN")
        draw.ellipse([(22, 28), (48, 54)], fill=accent_rgba)
        draw.text((60, 20), label, font=tag_font, fill=accent_rgba)
        draw.text((60, 50), loc, font=title_font, fill=(255, 255, 255, 255))

    elif g_type == "keyword_callout":
        kw = data.get("keyword", "MOMENTUM")
        tag = data.get("tag", "CORE PRINCIPLE")
        draw.text((24, 16), tag, font=tag_font, fill=accent_rgba)
        draw.text((24, 48), kw, font=title_font, fill=(255, 255, 255, 255))

    elif g_type == "quote_card":
        quote = data.get("quote", "Focus on the input, output takes care of itself.")
        author = data.get("author", "KEY INSIGHT")
        draw.text((24, 18), "“", font=big_stat_font, fill=accent_rgba)
        draw.text((60, 22), author, font=tag_font, fill=accent_rgba)
        words = quote.split()
        lines, cur = [], []
        for w in words:
            if len(" ".join(cur + [w])) > 38:
                lines.append(" ".join(cur))
                cur = [w]
            else:
                cur.append(w)
        if cur:
            lines.append(" ".join(cur))
        y = 70
        for ln in lines[:3]:
            draw.text((24, y), ln, font=sub_font, fill=(255, 255, 255, 255))
            y += 32

    elif g_type == "call_to_action":
        title = data.get("title", "SUBSCRIBE FOR MORE")
        subtitle = data.get("subtitle", "Follow for daily high-value guides")
        btn = data.get("buttonText", "LINK IN BIO")
        draw.text((24, 20), title, font=title_font, fill=(255, 255, 255, 255))
        draw.text((24, 68), subtitle, font=sub_font, fill=(203, 213, 225, 230))
        btn_w = len(btn) * 14 + 32
        draw.rounded_rectangle([(24, 116), (24 + btn_w, 162)], radius=8, fill=accent_rgba)
        draw.text((40, 126), btn, font=tag_font, fill=(10, 11, 26, 255))
    elif g_type == "financial_chart":
        badge = data.get("badge", "▲ +148% SURGE")
        val = data.get("value", "+$84,500")
        lbl = data.get("label", "MARKET VALUATION")
        # Top badge
        bw = len(badge) * 11 + 24
        draw.rounded_rectangle([(24, 18), (24 + bw, 44)], radius=6, fill=accent_rgba)
        draw.text((34, 21), badge, font=tag_font, fill=(10, 25, 20, 255))
        draw.text((24 + bw + 14, 18), lbl, font=sub_font, fill=(203, 213, 225, 220))
        draw.text((24, 52), val, font=big_stat_font, fill=(255, 255, 255, 255))
        # Vector curve simulation with polygon fill
        pts = [(24, 185), (100, 175), (200, 155), (320, 140), (440, 115), (540, 95), (card_w - 30, 80)]
        for pi in range(len(pts) - 1):
            draw.line([pts[pi], pts[pi + 1]], fill=accent_rgba, width=4)
        draw.ellipse([(card_w - 38, 72), (card_w - 22, 88)], fill=(255, 255, 255, 255), outline=accent_rgba, width=3)

    elif g_type == "classified_dossier":
        stamp = data.get("stamp", "TOP SECRET")
        header = data.get("header", "INTERNAL EVIDENCE MEMO")
        highlight = data.get("highlight", "CRITICAL ADMISSION")
        context = data.get("context", "Documented record declassified for review")
        # Slanted stamp box
        sw = len(stamp) * 13 + 30
        draw.rounded_rectangle([(card_w - sw - 24, 16), (card_w - 24, 48)], radius=4, fill=(239, 68, 68, 240), outline=(255, 255, 255, 200), width=1)
        draw.text((card_w - sw - 12, 20), stamp, font=tag_font, fill=(255, 255, 255, 255))
        draw.text((24, 20), header, font=tag_font, fill=accent_rgba)
        # Highlighted yellow box for key evidence
        draw.rounded_rectangle([(24, 56), (card_w - 30, 106)], radius=6, fill=(255, 230, 0, 40), outline=(255, 230, 0, 180), width=1)
        draw.text((34, 68), highlight, font=title_font, fill=(255, 255, 255, 255))
        # Simulated redacted blackout bars
        draw.rectangle([(24, 122), (180, 138)], fill=(15, 15, 20, 255))
        draw.rectangle([(195, 122), (360, 138)], fill=(15, 15, 20, 255))
        draw.text((24, 155), context[:65], font=sub_font, fill=(148, 163, 184, 230))

    elif g_type == "timeline_milestone":
        tag = data.get("tag", "HISTORICAL TURNING POINT")
        year = data.get("year", "1971")
        title = data.get("title", "BRETTON WOODS COLLAPSE")
        sub = data.get("subtitle", "Fiat monetary expansion era begins")
        draw.text((24, 18), tag, font=tag_font, fill=accent_rgba)
        # Year in giant bold font
        draw.text((24, 46), year, font=big_stat_font, fill=accent_rgba)
        # Event details on the right
        draw.line([(180, 48), (180, 180)], fill=(255, 255, 255, 40), width=2)
        draw.ellipse([(174, 85), (186, 97)], fill=accent_rgba)
        draw.text((200, 60), title[:36], font=title_font, fill=(255, 255, 255, 255))
        draw.text((200, 110), sub[:55], font=sub_font, fill=(203, 213, 225, 230))

    elif g_type == "versus_split":
        side_a = data.get("sideA", "CONVENTIONAL").upper()
        side_b = data.get("sideB", "EXPONENTIAL").upper()
        mid_x = card_w // 2
        # Side A
        draw.text((30, 62), side_a, font=title_font, fill=(255, 255, 255, 255))
        # VS Circle Badge in center
        draw.ellipse([(mid_x - 30, 50), (mid_x + 30, 110)], fill=accent_rgba)
        draw.text((mid_x - 14, 68), "VS", font=tag_font, fill=(10, 11, 26, 255))
        # Side B
        draw.text((mid_x + 50, 62), side_b, font=title_font, fill=accent_rgba)

    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(str(out_path), "PNG")
    return card_w, card_h



def compute_overlay_coords(position, video_w, video_h, card_w, card_h, safe_zones=None):
    """Computes (x, y) coordinates for motion graphic placement respecting safe areas."""
    pad_x = int(video_w * 0.06)
    pad_y = int(video_h * 0.12)

    if position == "behind_person":
        # Centered horizontally, vertically positioned in upper-middle negative space behind speaker
        return (video_w - card_w) // 2, int(video_h * 0.36)
    elif position == "top_left":
        return pad_x, pad_y
    elif position == "top_center":
        return (video_w - card_w) // 2, pad_y
    elif position == "top_right":
        return video_w - card_w - pad_x, pad_y
    elif position == "center":
        return (video_w - card_w) // 2, (video_h - card_h) // 2
    elif position == "bottom_left":
        return pad_x, video_h - card_h - int(video_h * 0.22)
    elif position == "bottom_center":
        return (video_w - card_w) // 2, video_h - card_h - int(video_h * 0.22)
    elif position == "bottom_right":
        return video_w - card_w - pad_x, video_h - card_h - int(video_h * 0.22)
    return (video_w - card_w) // 2, (video_h - card_h) // 2


def build_motion_graphics_filter(graphics_list, work_dir, video_w, video_h, start_input_idx=1, in_label="[vbase]", out_label="[vout]"):
    """
    Builds the FFmpeg filtergraph segments to composite all motion graphics with smooth entrance & exit transitions.
    Generates transparent PNG cards in work_dir.
    Returns: (extra_inputs_list, filter_chains_string, final_out_label, generated_temp_files)
    """
    work_dir = Path(work_dir)
    extra_inputs = []
    filter_chains = []
    temp_files = []

    cur_label = in_label
    input_idx = start_input_idx

    active_graphics = [g for g in graphics_list if g.get("enabled", True)]
    active_graphics.sort(key=lambda g: float(g.get("start", 0)))

    for i, g in enumerate(active_graphics):
        gid = g.get("id", f"mg_{i}")
        start = max(0.0, float(g.get("start", 0)))
        end = max(start + 0.5, float(g.get("end", start + 3.0)))
        pos = g.get("position", "bottom_left")

        # 1. Render card PNG
        png_name = f"card_{gid}.png"
        png_path = work_dir / png_name
        card_w, card_h = render_graphic_card(g, png_path, target_width=video_w)
        temp_files.append(png_path)

        # 2. Add input to FFmpeg
        extra_inputs.extend(["-i", str(png_path)])

        # 3. Compute position
        x, y = compute_overlay_coords(pos, video_w, video_h, card_w, card_h)

        # 4. Generate smooth fade in / fade out filter
        fade_label = f"[mg_fade_{i}]"
        next_label = f"[mg_v_{i}]" if i < len(active_graphics) - 1 else out_label

        d_in = 0.25
        d_out = 0.25
        st_out = max(start + d_in, end - d_out)

        filter_chains.append(
            f"[{input_idx}:v]format=rgba,fade=t=in:st={start}:d={d_in}:alpha=1,"
            f"fade=t=out:st={st_out}:d={d_out}:alpha=1{fade_label}"
        )
        filter_chains.append(
            f"{cur_label}{fade_label}overlay=x={x}:y={y}:enable='between(t,{start},{end})'{next_label}"
        )

        cur_label = next_label
        input_idx += 1

    return extra_inputs, ";".join(filter_chains), cur_label, temp_files
