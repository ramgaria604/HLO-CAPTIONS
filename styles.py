"""Caption grouping, emphasis detection, style presets and the ASS caption builder."""
import copy
from functools import lru_cache
import json
import math
import os
import re

from pathlib import Path
from fonts_util import resolve, FONTS_DIR
import ink_layout
from fontTools.ttLib import TTFont



def find_font_file(role):
    if not isinstance(role, dict):
        role = {}
    font = (role.get("font") or "Poppins").replace(" ", "")
    weight = role.get("weight", 700 if role.get("bold") else 400)
    italic = bool(role.get("italic"))
    candidates = [
        f"{font}-{weight}{'-italic' if italic else ''}.ttf",
        f"{font}-{weight}.ttf",
        f"{font}-Regular.ttf" if weight == 400 else f"{font}-Bold.ttf",
        f"{font}.ttf",
    ]
    for c in candidates:
        p = FONTS_DIR / c
        if p.exists():
            return str(p)
    for p in FONTS_DIR.glob("*.ttf"):
        p_name = p.stem.lower().replace("-", "").replace(" ", "")
        if font.lower() in p_name and str(weight) in p_name:
            return str(p)
    for p in FONTS_DIR.glob("*.ttf"):
        if font.lower() in p.stem.lower().replace("-", "").replace(" ", ""):
            return str(p)
    return str(FONTS_DIR / "Poppins-700.ttf")


@lru_cache(maxsize=128)
def get_ass_font_info(font_file):
    """
    Returns (font_family_name, ratio) where font_family_name is nameID 1,
    which libass matches 100% against fonts/ without falling back to Arial.
    """
    try:
        tt = TTFont(str(font_file), lazy=True)
        upem = tt["head"].unitsPerEm
        ascent = tt["OS/2"].usWinAscent
        descent = tt["OS/2"].usWinDescent
        ratio = (ascent + descent) / upem
        font_name = None
        for rec in tt["name"].names:
            if rec.nameID == 1:
                font_name = rec.toUnicode()
                break
        if not font_name:
            font_name = Path(font_file).stem
        return font_name, ratio
    except Exception:
        return "Arial", 1.0

STOP = set("""a an the and or but if so to of in on at for from by with as is are was were be been being am i you he she it
we they me my your his her its our their this that these those there here do does did done have has had will would can could
should may might just very really also than then too not no yes oh um uh like get got gonna wanna about into over out up
down off again more most some any all each both few other such only own same what which who whom when where why how im ive
dont cant wont thats lets going""".split())


# ---------------------------------------------------------------- words & captions
def tokenize(text):
    """'So *Tonight* is' -> [{'t':'So','key':False}, {'t':'Tonight','key':True}, ...]"""
    out, in_key = [], False
    for tok in str(text).split():
        starts, ends = tok.startswith("*"), tok.endswith("*") and len(tok) > 1
        if starts:
            in_key = True
        clean = tok.strip("*")
        if clean:
            out.append({"t": clean, "key": in_key})
        if ends:
            in_key = False
    return out


def _score(word):
    w = re.sub(r"[^\w']", "", word, flags=re.UNICODE)
    if not w or w.lower() in STOP:
        return 0
    s = len(w)
    if any(c.isdigit() for c in w):
        s += 4
    if word.endswith(("!", "?")):
        s += 1
    return s


def pick_keys(tokens, max_keys=1):
    scored = sorted(((_score(t["t"]), i) for i, t in enumerate(tokens)), key=lambda x: (-x[0], x[1]))
    keys = {i for sc, i in scored[:max_keys] if sc >= 4}
    return keys


def build_captions(words, per=3, max_keys=1, max_gap=0.85, max_len=3.4):
    """Group timed words into plain-text captions with seamless gap-closing and no misplaced words."""
    caps, cur = [], []

    # Filter out immediate duplicate stutters (e.g. "tum tum", "the the")
    clean_words = []
    for w in words:
        wt = str(w[2]).strip()
        if clean_words:
            prev_wt = str(clean_words[-1][2]).strip()
            # If identical word spoken within 0.7s of each other, merge into one
            if wt.lower() == prev_wt.lower() and (w[0] - clean_words[-1][1]) <= 0.7:
                clean_words[-1] = (clean_words[-1][0], max(clean_words[-1][1], w[1]), clean_words[-1][2])
                continue
        clean_words.append(w)

    def flush():
        if not cur:
            return
        toks = [{"t": str(w[2]).replace("*", ""), "key": False} for w in cur]
        if toks:
            toks[-1]["key"] = True
        for i in pick_keys(toks, max_keys):
            toks[i]["key"] = True
        text = " ".join(t["t"] for t in toks)
        caption_words = [{"t": token["t"], "word": token["t"], "key": token["key"],
                          "start": round(word[0], 2), "s": round(word[0], 2),
                          "end": round(word[1], 2), "e": round(word[1], 2)}
                         for word, token in zip(cur, toks) if token["t"]]

        # Prevent misplaced orphan 1-word captions by merging with preceding caption if appropriate
        if len(caption_words) == 1 and caps and len(caps[-1]["words"]) < 4:
            prev = caps[-1]
            prev["words"].extend(caption_words)
            prev["text"] = prev["text"] + " " + text
            prev["end"] = round(cur[-1][1], 2)
            prev["wt"].extend([[round(w[0], 2), round(w[1], 2)] for w in cur])
            return

        caps.append({"id": len(caps) + 1, "start": round(cur[0][0], 2), "end": round(cur[-1][1], 2),
                     "text": text, "words": caption_words,
                     "wt": [[round(w[0], 2), round(w[1], 2)] for w in cur]})

    for w in clean_words:
        if cur:
            gap = w[0] - cur[-1][1]
            if len(cur) >= per or gap > max_gap or (w[1] - cur[0][0]) > max_len:
                flush()
                cur = []
        cur.append(w)
        if re.search(r"[.!?।]$", w[2]):
            flush()
            cur = []
    flush()

    # Seamless gap-closing: keep caption container visible between sentences
    # but do NOT stretch the word's own pronunciation boundary artificially
    for i in range(len(caps) - 1):
        inter_gap = caps[i + 1]["start"] - caps[i]["end"]
        if 0 < inter_gap <= 0.75:
            caps[i]["end"] = caps[i + 1]["start"]

    return caps


def clean_captions_data(captions, remove_fillers=True, remove_repeats=True, close_gaps=True):
    """Deep clean filler sounds (uh, um), repeated words, and close timing gaps."""
    FILLERS = {
        "uh", "um", "umm", "uhh", "er", "ah", "ahh", "hmm", "haan", "haa",
        "achha", "accha", "[music]", "[applause]", "(laughter)", "[laughter]"
    }
    raw_words = []
    for cap in captions:
        supplied = cap.get("words")
        if supplied and isinstance(supplied, list):
            for w in supplied:
                text = str(w.get("word", w.get("t", ""))).strip()
                if text:
                    s = float(w.get("start", w.get("s", cap.get("start", 0))))
                    e = float(w.get("end", w.get("e", cap.get("end", s))))
                    raw_words.append((s, e, text))
        else:
            txt = str(cap.get("text", "")).strip()
            if txt:
                toks = txt.split()
                s = float(cap.get("start", 0))
                e = float(cap.get("end", s + 1.0))
                dur = max(0.1, (e - s) / max(1, len(toks)))
                for idx, t in enumerate(toks):
                    raw_words.append((s + idx * dur, s + (idx + 1) * dur, t))

    fillers_count = 0
    repeats_count = 0
    gaps_count = 0

    cleaned_words = []
    for w in raw_words:
        clean_tok = re.sub(r"[^\w\s]", "", w[2].lower()).strip()
        if remove_fillers and clean_tok in FILLERS:
            fillers_count += 1
            continue

        if remove_repeats and cleaned_words:
            prev_tok = re.sub(r"[^\w\s]", "", cleaned_words[-1][2].lower()).strip()
            if clean_tok and clean_tok == prev_tok and (w[0] - cleaned_words[-1][1]) <= 0.85:
                repeats_count += 1
                cleaned_words[-1] = (cleaned_words[-1][0], max(cleaned_words[-1][1], w[1]), cleaned_words[-1][2])
                continue

        cleaned_words.append(w)

    if not cleaned_words:
        return captions, fillers_count, repeats_count, gaps_count

    # Build balanced captions with clean phrasing
    new_caps = build_captions(cleaned_words, per=3, max_keys=1)
    gaps_count = max(0, len(new_caps) - 1)

    return new_caps, fillers_count, repeats_count, gaps_count


def caption_words(cap):
    """Words of a caption with start/end times. Uses real timings when the word count still matches."""
    supplied = cap.get("words")
    if isinstance(supplied, list) and supplied and all(isinstance(item, dict) for item in supplied):
        out = []
        for item in supplied:
            text = str(item.get("t") or item.get("word") or item.get("text") or "").replace("*", "")
            if not text:
                continue
            start = float(item.get("s", item.get("start", cap.get("start", 0))))
            end = float(item.get("e", item.get("end", cap.get("end", start))))
            out.append({"t": text, "key": bool(item.get("key")), "s": start, "e": end})
        if out:
            return out
    toks = tokenize(cap.get("text", ""))
    if not toks:
        return []
    s, e = float(cap["start"]), float(cap["end"])
    wt = cap.get("wt")
    if wt and len(wt) == len(toks):
        for t, (a, b) in zip(toks, wt):
            t["s"], t["e"] = float(a), float(b)
    else:
        weights = [len(t["t"]) + 1 for t in toks]
        total, pos = sum(weights), s
        for t, wgt in zip(toks, weights):
            d = (e - s) * wgt / total
            t["s"], t["e"] = pos, pos + d
            pos += d
    return toks


# ---------------------------------------------------------------- presets
def role(font, fallback, size, color, **kw):
    r = {"font": font, "fallback": fallback, "size": size, "color": color, "outline": 0.0,
         "outlineColor": "#000000", "glow": "#FFFFFF", "glowSize": 0.0, "shadow": 0.0,
         "shadowColor": "#000000", "italic": False, "bold": False, "upper": False}
    r.update(kw)
    return r


def load_presets():
    """Load the official caption preset pack from static/presets51.json."""
    json_path = os.path.join(os.path.dirname(__file__), "static", "presets51.json")
    if not os.path.exists(json_path):
        return []
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    out = []
    for pid, p in data.items():
        big = p.get("big") or {}
        small = p.get("small") or big
        fill_colors = (big.get("fill") or {}).get("colors", ["#FFFFFF"])
        if isinstance(fill_colors, str):
            fill_colors = fill_colors.split()
        small_fill = (small.get("fill") or {}).get("colors", ["#FFFFFF"])
        if isinstance(small_fill, str):
            small_fill = small_fill.split()

        hl_color = p.get("highlightColor") or (p.get("highlight") or {}).get("color")
        key_color = fill_colors[0] if (fill_colors and fill_colors[0].upper() not in ("#FFFFFF", "#FFF")) else (hl_color or (fill_colors[0] if fill_colors else "#FFE600"))

        key_role = role(
            font=big.get("font", "Montserrat"),
            fallback=big.get("fallback", "Arial"),
            size=big.get("size", 0.12),
            color=key_color,
            bold=big.get("weight", 800) >= 700,
            italic=bool(big.get("italic", False)),
            upper=bool(big.get("upper", False)),
            shadow=(big.get("shadow") or {}).get("dy", 0.0),
            shadowColor=(big.get("shadow") or {}).get("color", "#000000"),
            glow=(big.get("glow") or {}).get("color", "#FFFFFF"),
            glowSize=(big.get("glow") or {}).get("blur", 0.0),
            outline=(big.get("stroke") or {}).get("w", 0.0),
            outlineColor=(big.get("stroke") or {}).get("color", "#000000"),
            keyGradient=f"linear-gradient({(big.get('fill') or {}).get('angle', 90)}deg, {', '.join(fill_colors)})" if len(fill_colors) > 1 else None,
            extrude=big.get("extrude"),
            track=big.get("track", 0),
        )

        filler_role = role(
            font=small.get("font", "Inter"),
            fallback=small.get("fallback", "Arial"),
            size=small.get("size", 0.06),
            color=small_fill[0] if small_fill else "#FFFFFF",
            bold=small.get("weight", 400) >= 700,
            italic=bool(small.get("italic", False)),
            upper=bool(small.get("upper", False)),
            shadow=(small.get("shadow") or {}).get("dy", 0.0),
            shadowColor=(small.get("shadow") or {}).get("color", "#000000"),
            glow=(small.get("glow") or {}).get("color", "#FFFFFF"),
            glowSize=(small.get("glow") or {}).get("blur", 0.0),
            outline=(small.get("stroke") or {}).get("w", 0.0),
            outlineColor=(small.get("stroke") or {}).get("color", "#000000"),
            textGradient=f"linear-gradient({(small.get('fill') or {}).get('angle', 90)}deg, {', '.join(small_fill)})" if len(small_fill) > 1 else None,
            extrude=small.get("extrude"),
            track=small.get("track", 0),
        )

        preset_item = {
            "id": p.get("id", pid),
            "name": p.get("name", pid),
            "category": p.get("category", "colourful"),
            "layout": p.get("layout", "line"),
            "animation": p.get("anim", "pop"),
            "wordsPerCaption": int(p.get("wordsPerCaption", 3)),
            "maxKeys": int(p.get("keyWords", 0)),
            "position": float(p.get("pos", 0.78)),
            "opacity": float(p.get("opacity", 0.90)),
            "highlightColor": p.get("highlightColor", fill_colors[0] if fill_colors else "#FFE600"),
            "gap": float(p.get("gap", 0.12)),
            "behind": p.get("behind", "none"),
            "behindPerson": bool(p.get("behindPerson") or p.get("behind") in ("first", "all")),
            "depthAccent": bool(p.get("depthAccent", False)),
            "depthAccentSize": float(p.get("depthAccentSize", 0.22)),
            "depthAccentY": float(p.get("depthAccentY", 0.41)),
            "subtitlePosition": float(p.get("subtitlePosition", 0.76)),
            "subtitleSize": float(p.get("subtitleSize", 0.058)),
            "blend": p.get("blend"),
            "blendMode": p.get("blend", p.get("blendMode")),
            "fx": p.get("fx"),
            "tagline": p.get("tagline", ""),
            "previewWord": p.get("previewWord", ""),
            "pill": p.get("pill"),
            "key": key_role,
            "filler": filler_role,
            "big": big,
            "small": small,
        }
        if p.get("badge"):
            preset_item["badge"] = p["badge"]
            preset_item["badgeTextColor"] = p.get("badgeTextColor", "#111111")
        if p.get("highlight"):
            preset_item["highlight"] = p["highlight"]
        if p.get("echoOffsetEm"):
            preset_item["echoOffsetEm"] = p["echoOffsetEm"]
        if p.get("tilt"):
            preset_item["tilt"] = p["tilt"]
        out.append(preset_item)

    # Load 26 Unique Presets
    unique_json = os.path.join(os.path.dirname(__file__), "static", "unique_presets.json")
    if os.path.exists(unique_json):
        try:
            with open(unique_json, "r", encoding="utf-8") as uf:
                u_data = json.load(uf)
            for u in u_data:
                uid = u["id"]
                ucolors = u.get("colors", ["#FFFFFF"])
                u_item = {
                    "id": uid,
                    "name": u["name"],
                    "tagline": u.get("tagline", ""),
                    "category": "unique",
                    "layout": "stack",
                    "animation": "pop",
                    "wordsPerCaption": int(u.get("wordsPerLine", 3)),
                    "maxKeys": 1,
                    "position": 0.78,
                    "opacity": 0.95,
                    "highlightColor": ucolors[-1] if ucolors else "#FFE600",
                    "previewImg": f"/static/preset_previews/{uid}.png",
                    "isUnique": True,
                    "is_remotion": True,
                    "key": role("Inter", "Arial", 0.09, ucolors[0] if ucolors else "#FFFFFF", bold=True),
                    "filler": role("Inter", "Arial", 0.05, "#FFFFFF"),
                    "big": {"font": "Inter", "weight": 800, "size": 0.09, "fill": {"colors": ucolors}},
                    "small": {"font": "Inter", "weight": 500, "size": 0.05, "fill": {"colors": ["#FFFFFF"]}}
                }
                out.append(u_item)
        except Exception as ue:
            print("Warning: could not load unique_presets.json:", ue)

    # Load the supplied Special Presets pack.
    special_json = os.path.join(os.path.dirname(__file__), "static", "special_presets", "special_presets.json")
    if os.path.exists(special_json):
        try:
            with open(special_json, "r", encoding="utf-8") as sf:
                special_data = json.load(sf)
            for p in special_data:
                roles = p.get("roles", {})
                accent = roles.get("accent", {})
                base = roles.get("base", {})
                fill = accent.get("fill", {})
                raw_colors = fill.get("colors")
                if not raw_colors:
                    if fill.get("type") == "holo":
                        colors = ["#FF5EDF", "#FFE45E", "#5EFFB1", "#5EC8FF", "#B65EFF"]
                    else:
                        colors = [accent.get("color") or "#FFFFFF"]
                else:
                    colors = list(raw_colors)
                
                grad = None
                if len(colors) > 1:
                    ang = fill.get("angle", 90)
                    col_str = ", ".join(colors)
                    grad = f"linear-gradient({ang}deg, {col_str})"
                
                base_color = base.get("color") or "#FFFFFF"
                accent_color = colors[0] if colors else (accent.get("color") or "#FFFFFF")

                special_item = {
                    "id": p["id"].replace("duo_", "special_"),
                    "name": p["name"].replace("Duo ·", "Sequence ·"),
                    "category": "special",
                    "mode": p.get("mode", "emphasis"),
                    "layout": p.get("layout", "stack"),
                    "animation": accent.get("enter", "slide-up"),
                    "wordsPerCaption": int(p.get("wordsPerPage", 3)),
                    "maxKeys": 1,
                    "position": float(p.get("posY", 0.52)),
                    "posX": float(p.get("posX", 0.5)),
                    "posY": float(p.get("posY", 0.52)),
                    "inkGap": float(p.get("inkGap", 0.03)),
                    "uppercase": bool(p.get("uppercase", False)),
                    "posCycle": p.get("posCycle"),
                    "behindPerson": accent.get("layer") == "behind",
                    "depthAccent": accent.get("layer") == "behind",
                    "depthAccentSize": max(0.12, min(0.34, float(accent.get("size", 190)) / 1080.0)),
                    "depthAccentY": 0.28 if (accent.get("layer") == "behind" or "(behind)" in str(p.get("name", "")).lower()) else float((p.get("posCycle") or [p.get("posY", 0.2)])[0]),
                    "subtitlePosition": 0.70 if (accent.get("layer") == "behind" or "(behind)" in str(p.get("name", "")).lower()) else max(0.64, min(0.82, float(p.get("posY", 0.2)) + 0.48)),
                    "subtitleSize": max(0.04, min(0.08, float(base.get("size", 62)) / 1080.0)),
                    "lineGap": p.get("lineGap", 0.86),
                    "keyRule": p.get("keyRule", "last"),
                    "enter": accent.get("enter", "slide-up"),
                    "baseEnter": base.get("enter", "slide-left"),
                    "fill": fill,
                    "roles": roles,
                    "isSpecial": True,
                    "key": {
                        "font": accent.get("font", "Montserrat"),
                        "size": round(accent.get("size", 160) / 1080.0, 3),
                        "color": accent_color,
                        "bold": bool(accent.get("bold", True)),
                        "italic": bool(accent.get("italic", False)),
                        "shadow": round(accent.get("shadow", 0) / 100.0, 3),
                        "shadowColor": accent.get("shadowColor", "#000000"),
                        "glow": accent.get("glowColor", "#FFFFFF"),
                        "glowSize": (0.0 if accent.get("glowColor", "#FFFFFF").lower() in ("#000000", "#000", "#050505", "#111111")
                                     else round(accent.get("glow", 0) / 100.0, 3)),
                        "outline": round(accent.get("outline", 0) / 1080.0, 3),
                        "outlineColor": accent.get("outlineColor", "#000000"),
                        "track": accent.get("track", 0),
                        "upper": bool(accent.get("upper", False)),
                        "keyGradient": grad
                    },
                    "filler": {
                        "font": base.get("font", "Poppins"),
                        "size": round(base.get("size", 62) / 1080.0, 3),
                        "color": base_color,
                        "bold": bool(base.get("bold", True)),
                        "italic": bool(base.get("italic", False)),
                        "shadow": round(base.get("shadow", 0) / 100.0, 3),
                        "shadowColor": base.get("shadowColor", "#000000"),
                        "glow": base.get("glowColor", "#000000"),
                        "glowSize": (0.0 if base.get("glowColor", "#000000").lower() in ("#000000", "#000", "#050505", "#111111")
                                     else round(base.get("glow", 0) / 100.0, 3)),
                        "outline": round(base.get("outline", 0) / 1080.0, 3),
                        "outlineColor": base.get("outlineColor", "#000000"),
                        "track": base.get("track", 0),
                        "upper": bool(base.get("upper", False))
                    },
                    "big": {"font": accent.get("font", "Montserrat"), "weight": accent.get("weight", 900), "size": round(accent.get("size", 160) / 1080.0, 3), "fill": fill},
                    "small": {"font": base.get("font", "Poppins"), "weight": base.get("weight", 700), "size": round(base.get("size", 62) / 1080.0, 3), "fill": {"colors": [base_color]}}
                }
                if roles.get("accent2"):
                    alt = roles["accent2"]
                    alt_fill = alt.get("fill", {})
                    alt_colors = alt_fill.get("colors") or [alt.get("color", "#FFFFFF")]
                    alt_grad = None
                    if len(alt_colors) > 1:
                        alt_grad = f"linear-gradient({alt_fill.get('angle', 90)}deg, {', '.join(alt_colors)})"
                    special_item["accent2"] = {
                        "font": alt.get("font", accent.get("font", "Montserrat")),
                        "size": round(alt.get("size", accent.get("size", 190)) / 1080.0, 3),
                        "color": alt_colors[0], "bold": bool(alt.get("bold", True)),
                        "italic": bool(alt.get("italic", False)),
                        "shadow": round(alt.get("shadow", 0) / 100.0, 3),
                        "shadowColor": alt.get("shadowColor", "#000000"),
                        "glow": alt.get("glowColor", "#FFFFFF"),
                        "glowSize": (0.0 if alt.get("glowColor", "#FFFFFF").lower() in ("#000000", "#000", "#050505", "#111111")
                                     else round(alt.get("glow", 0) / 100.0, 3)),
                        "outline": round(alt.get("outline", 0) / 1080.0, 3),
                        "outlineColor": alt.get("outlineColor", "#000000"),
                        "keyGradient": alt_grad,
                    }
                if roles.get("active"):
                    active = roles["active"]
                    active_fill = active.get("fill", {})
                    active_colors = active_fill.get("colors") or [active.get("color", "#FFFFFF")]
                    active_grad = None
                    if len(active_colors) > 1:
                        active_grad = f"linear-gradient({active_fill.get('angle', 90)}deg, {', '.join(active_colors)})"
                    special_item["activeRole"] = {
                        "font": active.get("font", base.get("font", "Montserrat")),
                        "size": round(active.get("size", 84) / 1080.0, 3),
                        "color": active_colors[0], "bold": bool(active.get("bold", True)),
                        "italic": bool(active.get("italic", False)),
                        "shadow": round(active.get("shadow", 0) / 100.0, 3),
                        "shadowColor": active.get("shadowColor", "#000000"),
                        "glow": active.get("glowColor", "#FFFFFF"),
                        "glowSize": (0.0 if active.get("glowColor", "#FFFFFF").lower() in ("#000000", "#000", "#050505", "#111111")
                                     else round(active.get("glow", 0) / 100.0, 3)),
                        "outline": round(active.get("outline", 0) / 1080.0, 3),
                        "outlineColor": active.get("outlineColor", "#000000"),
                        "track": active.get("track", 0),
                        "upper": bool(active.get("upper", False)),
                        "keyGradient": active_grad,
                    }
                out.append(special_item)
        except Exception as se:
            print("Warning: could not load special_presets.json:", se)

    # Load 31 Duo Presets Pack
    duo_json = os.path.join(os.path.dirname(__file__), "static", "duo_presets", "duo_presets.json")
    if os.path.exists(duo_json):
        try:
            with open(duo_json, "r", encoding="utf-8") as df:
                duo_data = json.load(df)
            for p in duo_data:
                roles = p.get("roles", {})
                accent = roles.get("accent", {})
                base = roles.get("base", {})
                fill = accent.get("fill", {})
                raw_colors = fill.get("colors")
                if not raw_colors:
                    if fill.get("type") == "holo":
                        colors = ["#FF5EDF", "#FFE45E", "#5EFFB1", "#5EC8FF", "#B65EFF"]
                    else:
                        colors = [accent.get("color") or "#FFFFFF"]
                else:
                    colors = list(raw_colors)
                
                grad = None
                if len(colors) > 1:
                    ang = fill.get("angle", 90)
                    col_str = ", ".join(colors)
                    grad = f"linear-gradient({ang}deg, {col_str})"
                
                base_color = base.get("color") or "#FFFFFF"
                accent_color = colors[0] if colors else (accent.get("color") or "#FFFFFF")
                preset_y = max(0.20, min(0.82, float(p.get("posY", 0.52))))
                subtitle_gap = max(0.055, min(0.09, (float(accent.get("size", 160)) + float(base.get("size", 62))) * 0.35 / 1920.0 + 0.01))
                is_behind = bool(
                    accent.get("layer") == "behind" or
                    "(behind)" in str(p.get("name", "")).lower()
                )
                accent_sz = float(accent.get("size", 230))
                base_sz = float(base.get("size", 62))
                font_span = (accent_sz + base_sz) * 0.5 / 1920.0 + 0.008
                top_y = round(0.18 - font_span, 3)

                duo_item = {
                    "id": p["id"],
                    "name": p["name"],
                    "category": p.get("category", "duo"),
                    "mode": p.get("mode", "emphasis"),
                    "layout": p.get("layout", "stack"),
                    "animation": accent.get("enter", "slide-up"),
                    "wordsPerCaption": int(p.get("wordsPerPage", 3)),
                    "maxKeys": int(p.get("maxKeys", 1)),
                    "position": (0.18 if is_behind
                                  else max(0.64, min(0.82, float(p.get("posY", 0.2)) + 0.48))),
                    "posCycle": None if is_behind else p.get("posCycle"),
                    "behindPerson": is_behind,
                    "depthAccent": is_behind,
                    "depthAccentSize": round(accent.get("size", 230) / 1080.0, 3),
                    "topY": top_y if is_behind else 0.10,
                    "depthAccentY": 0.18 if is_behind else preset_y,
                    "subtitlePosition": 0.72 if is_behind else max(0.20, min(0.90, float(p.get("subtitleY", preset_y + subtitle_gap)))),
                    "subtitleSize": round(base.get("size", 62) / 1080.0, 3),
                    "blend": p.get("blend", "screen"),
                    "blendMode": p.get("blend", "screen"),
                    "highlightColor": accent_color,
                    "isSpecial": True,
                    "isDuo": True,
                    "estateVariant": p.get("estateVariant"),
                    "wordGap": float(p.get("wordGap", 0.08)),
                    "roles": roles,
                    "previewWord": p.get("previewWord") or p.get("name", "").replace("Duo ·", "").strip().upper()[:16],
                    "badge": "DUO ⚡",
                    "key": {
                        "font": accent.get("font", "Montserrat"),
                        "size": round(accent.get("size", 160) / 1080.0, 3),
                        "color": accent_color,
                        "bold": bool(accent.get("bold", True)),
                        "italic": bool(accent.get("italic", False)),
                        "shadow": round(accent.get("shadow", 0) / 100.0, 3),
                        "shadowColor": accent.get("shadowColor", "#000000"),
                        "glow": accent.get("glowColor", "#FFFFFF"),
                        "glowSize": (0.0 if accent.get("glowColor", "#FFFFFF").lower() in ("#000000", "#000", "#050505", "#111111")
                                     else round(accent.get("glow", 0) / 100.0, 3)),
                        "outline": round(accent.get("outline", 0) / 1080.0, 3),
                        "outlineColor": accent.get("outlineColor", "#000000"),
                        "keyGradient": grad,
                        "upper": bool(accent.get("upper", True)),
                        "track": accent.get("track", 0),
                    },
                    "filler": {
                        "font": base.get("font", "Poppins"),
                        "size": round(base.get("size", 62) / 1080.0, 3),
                        "color": base_color,
                        "bold": bool(base.get("bold", True)),
                        "italic": bool(base.get("italic", False)),
                        "shadow": round(base.get("shadow", 0) / 100.0, 3),
                        "shadowColor": base.get("shadowColor", "#000000"),
                        "glow": base.get("glowColor", "#FFFFFF"),
                        "glowSize": (0.0 if base.get("glowColor", "#FFFFFF").lower() in ("#000000", "#000", "#050505", "#111111")
                                     else round(base.get("glow", 0) / 100.0, 3)),
                        "outline": round(base.get("outline", 0) / 1080.0, 3),
                        "outlineColor": base.get("outlineColor", "#000000"),
                        "track": base.get("track", 0),
                        "upper": bool(base.get("upper", False))
                    },
                    "big": {"font": accent.get("font", "Montserrat"), "weight": accent.get("weight", 900), "size": round(accent.get("size", 160) / 1080.0, 3), "fill": fill},
                    "small": {"font": base.get("font", "Poppins"), "weight": base.get("weight", 700), "size": round(base.get("size", 62) / 1080.0, 3), "fill": {"colors": [base_color]}}
                }
                if roles.get("accent2"):
                    alt = roles["accent2"]
                    alt_fill = alt.get("fill", {})
                    alt_colors = alt_fill.get("colors") or [alt.get("color", "#FFFFFF")]
                    alt_grad = None
                    if len(alt_colors) > 1:
                        alt_grad = f"linear-gradient({alt_fill.get('angle', 90)}deg, {', '.join(alt_colors)})"
                    duo_item["accent2"] = {
                        "font": alt.get("font", accent.get("font", "Montserrat")),
                        "size": round(alt.get("size", accent.get("size", 190)) / 1080.0, 3),
                        "color": alt_colors[0], "bold": bool(alt.get("bold", True)),
                        "italic": bool(alt.get("italic", False)),
                        "shadow": round(alt.get("shadow", 0) / 100.0, 3),
                        "shadowColor": alt.get("shadowColor", "#000000"),
                        "glow": alt.get("glowColor", "#FFFFFF"),
                        "glowSize": (0.0 if alt.get("glowColor", "#FFFFFF").lower() in ("#000000", "#000", "#050505", "#111111")
                                     else round(alt.get("glow", 0) / 100.0, 3)),
                        "outline": round(alt.get("outline", 0) / 1080.0, 3),
                        "outlineColor": alt.get("outlineColor", "#000000"),
                        "keyGradient": alt_grad,
                    }
                out.append(duo_item)
        except Exception as de:
            print("Warning: could not load duo_presets.json:", de)

    return out


PRESETS = load_presets()
DEFAULT_STYLE = PRESETS[0] if PRESETS else {
    "id": "teal_gloss", "name": "Teal Liquid (Reference 🌊)", "category": "reference",
    "layout": "stack", "animation": "pop", "wordsPerCaption": 3, "maxKeys": 1,
    "position": 0.78, "highlightColor": "#22D3C8", "gap": 0.04, "behind": "all",
    "opacity": 0.90,
    "key": role("Montserrat", "Arial", 0.09, "#22D3C8", bold=True),
    "filler": role("Inter", "Arial", 0.05, "#FFFFFF", italic=True),
}

def _num(v, lo, hi, default):
    try:
        return max(lo, min(hi, float(v)))
    except (TypeError, ValueError):
        return default


def _hex(v, default="#FFFFFF"):
    return v if isinstance(v, str) and re.fullmatch(r"#[0-9A-Fa-f]{6}", v) else default


def _text(v, default, n=60):
    v = str(v or default)[:n]
    return re.sub(r"[^\w .,\-()&]", "", v, flags=re.UNICODE) or default


def clean_role(r, d):
    r = r or {}
    out = {
        "font": _text(r.get("font"), d["font"]), "fallback": _text(r.get("fallback"), d["fallback"]),
        "size": _num(r.get("size"), 0.02, 0.30, d["size"]),
        "color": r.get("color") or d["color"],
        "outline": _num(r.get("outline"), 0, 0.25, d["outline"]),
        "outlineColor": r.get("outlineColor") or d["outlineColor"],
        "glow": r.get("glow") or d["glow"], "glowSize": _num(r.get("glowSize"), 0, 0.25, d["glowSize"]),
        "shadow": _num(r.get("shadow"), 0, 0.2, d["shadow"]),
        "shadowColor": r.get("shadowColor") or d["shadowColor"],
        "track": float(_num(r.get("track"), -0.5, 0.5, 0.0)),
        "italic": bool(r.get("italic")), "bold": bool(r.get("bold")), "upper": bool(r.get("upper")),
    }
    if "keyGradient" in r:
        out["keyGradient"] = r["keyGradient"]
    if "textGradient" in r:
        out["textGradient"] = r["textGradient"]
    if "fill" in r:
        out["fill"] = r["fill"]
    if "layer" in r:
        out["layer"] = r["layer"]
    if "weight" in r:
        out["weight"] = r["weight"]
    return out


def clean_style(s):
    s = dict(s or {})
    d = DEFAULT_STYLE
    palette = [c for c in s.get("palette", []) if isinstance(c, str) and c.startswith("#")]
    is_special = bool(s.get("isSpecial"))
    key_role = clean_role(s.get("key"), d["key"])
    filler_role = clean_role(s.get("filler"), d["filler"])
    active_role = clean_role(s.get("activeRole"), d["key"])
    accent2_role = clean_role(s.get("accent2"), d["key"]) if s.get("accent2") else None
    if is_special:
        for role in (key_role, filler_role, active_role, accent2_role):
            if role is not None:
                role["shadowColor"] = "#000000"
                role["shadow"] = 0
                role["glowSize"] = 0

    anim = str(s.get("animation") or s.get("anim") or "pop").lower()
    valid_anims = ("pop", "bounce", "slide-up", "slide-down", "zoom", "fade", "none", "static", "highlight", "slide-right-soft")
    if anim not in valid_anims:
        anim = "pop"

    # Start with all original fields to preserve user customized values
    out = dict(s)
    out.update({
        "id": s.get("id", "custom"),
        "name": _text(s.get("name"), "Custom", 40),
        "category": s.get("category", "all"),
        "isDuo": bool(s.get("isDuo", False)),
        "estateVariant": s.get("estateVariant"),
        "wordGap": float(_num(s.get("wordGap"), 0.01, 0.30, 0.08)),
        "previewWord": _text(s.get("previewWord"), "CAPTIONS", 18),
        "layout": s.get("layout") if s.get("layout") in ("stack", "line") else ("stack" if s.get("isDuo") else "line"),
        "animation": anim,
        "anim": anim,
        "mode": s.get("mode") if s.get("mode") in ("emphasis", "highlight") else "emphasis",
        "wordsPerCaption": int(_num(s.get("wordsPerCaption"), 1, 8, 3)),
        "maxKeys": int(_num(s.get("maxKeys"), 0, 3, 1)),
        "position": _num(s.get("position"), 0.1, 0.95, 0.68),
        "opacity": _num(s.get("opacity"), 0.4, 1.0, 1.0),
        "highlightColor": s.get("highlightColor") or key_role.get("color") or "#FFE600",
        "baseColor": s.get("baseColor") or filler_role.get("color") or "#FFFFFF",
        "_customColorActive": bool(s.get("_customColorActive", False)),
        "key": key_role,
        "filler": filler_role,
        "activeRole": active_role,
        "accent2": accent2_role,
        "palette": palette,
        "rotation": float(s.get("rotation", 0.0)),
        "fontScale": float(_num(s.get("fontScale"), 0.6, 1.5, 1.0)),
        "offsetX": float(_num(s.get("offsetX"), -0.10, 0.10, 0.0)),
        "scaleX": float(_num(s.get("scaleX"), 0.7, 1.5, 1.0)),
    })
    return out


# ---------------------------------------------------------------- ASS builder

def _hex_to_rgb(h):
    h = str(h).lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    if len(h) != 6:
        return (255, 255, 255)
    try:
        return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))
    except Exception:
        return (255, 255, 255)


def _rgb_to_ass(rgb):
    return f"&H{rgb[2]:02X}{rgb[1]:02X}{rgb[0]:02X}&"


def _interpolate_gradient_color(colors, t):
    if not colors:
        return "&HFFFFFF&"
    if len(colors) == 1:
        return _rgb_to_ass(_hex_to_rgb(colors[0]))
    t = max(0.0, min(1.0, float(t)))
    segments = len(colors) - 1
    seg = min(int(t * segments), segments - 1)
    seg_t = (t - seg / segments) * segments
    c1 = _hex_to_rgb(colors[seg])
    c2 = _hex_to_rgb(colors[seg + 1])
    r = int(round(c1[0] + (c2[0] - c1[0]) * seg_t))
    g = int(round(c1[1] + (c2[1] - c1[1]) * seg_t))
    b = int(round(c1[2] + (c2[2] - c1[2]) * seg_t))
    return _rgb_to_ass((r, g, b))

def get_gradient_angle(role, style):
    if not isinstance(role, dict):
        role = {}
    if not isinstance(style, dict):
        style = {}

    # 1. Direct role fill angle
    fill = role.get("fill") if isinstance(role.get("fill"), dict) else {}
    if fill.get("angle") is not None:
        try:
            return float(fill["angle"])
        except (ValueError, TypeError):
            pass

    # 2. Roles accent fill angle
    roles = style.get("roles") or {}
    accent = roles.get("accent") or {}
    if isinstance(accent, dict):
        acc_fill = accent.get("fill") if isinstance(accent.get("fill"), dict) else {}
        if acc_fill.get("angle") is not None:
            try:
                return float(acc_fill["angle"])
            except (ValueError, TypeError):
                pass

    # 3. Big fill angle
    big = style.get("big") or {}
    if isinstance(big, dict):
        big_fill = big.get("fill") if isinstance(big.get("fill"), dict) else {}
        if big_fill.get("angle") is not None:
            try:
                return float(big_fill["angle"])
            except (ValueError, TypeError):
                pass

    # 4. Regex from gradient string
    for grad_str in [
        role.get("keyGradient"),
        role.get("textGradient"),
        accent.get("keyGradient"),
        style.get("keyGradient"),
        style.get("secondaryGradient"),
        style.get("textGradient"),
    ]:
        if grad_str and isinstance(grad_str, str) and "linear-gradient" in grad_str.lower():
            m = re.search(r"linear-gradient\(\s*([-\d.]+)deg", grad_str, re.IGNORECASE)
            if m:
                try:
                    return float(m.group(1))
                except (ValueError, TypeError):
                    pass

    return 90.0  # standard horizontal default


def get_gradient_colors(role, style):
    if not isinstance(role, dict):
        role = {}
    if not isinstance(style, dict):
        style = {}

    # 1. Direct role fill dict
    fill = role.get("fill") if isinstance(role.get("fill"), dict) else {}
    raw_cols = fill.get("colors")
    if not raw_cols and fill.get("type") == "holo":
        raw_cols = ["#FF5EDF", "#FFE45E", "#5EFFB1", "#5EC8FF", "#B65EFF"]
    if raw_cols and isinstance(raw_cols, (list, tuple)):
        valid = [c for c in raw_cols if isinstance(c, str) and c.startswith("#")]
        if len(valid) > 1:
            return valid

    # 2. Direct role gradient strings
    for grad_str in (role.get("keyGradient"), role.get("textGradient"), (role.get("fill") if isinstance(role.get("fill"), str) else None)):
        if grad_str and isinstance(grad_str, str) and "linear-gradient" in grad_str.lower():
            hexes = re.findall(r"#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b", grad_str)
            if len(hexes) > 1:
                return [f"#{''.join(c*2 for c in h[1:])}" if len(h) == 4 else h for h in hexes]

    # 3. Roles accent fill dict or gradient strings
    roles = style.get("roles") or {}
    accent = roles.get("accent") if isinstance(roles.get("accent"), dict) else {}
    if accent and (role.get("layer") == "behind" or role is accent or not role.get("color")):
        acc_fill = accent.get("fill") if isinstance(accent.get("fill"), dict) else {}
        acc_cols = acc_fill.get("colors")
        if acc_cols and isinstance(acc_cols, (list, tuple)):
            valid = [c for c in acc_cols if isinstance(c, str) and c.startswith("#")]
            if len(valid) > 1:
                return valid
        for grad_str in (accent.get("keyGradient"), accent.get("textGradient")):
            if grad_str and isinstance(grad_str, str) and "linear-gradient" in grad_str.lower():
                hexes = re.findall(r"#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b", grad_str)
                if len(hexes) > 1:
                    return [f"#{''.join(c*2 for c in h[1:])}" if len(h) == 4 else h for h in hexes]

    # If role has an explicit color and had no gradient in role or accent, it is solid!
    if role.get("color") and not (role.get("keyGradient") or role.get("fill")):
        return None

    # 4. Fallback for older presets without roles dict
    for grad_str in (style.get("keyGradient"), style.get("secondaryGradient"), style.get("textGradient")):
        if grad_str and isinstance(grad_str, str) and "linear-gradient" in grad_str.lower():
            hexes = re.findall(r"#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b", grad_str)
            if len(hexes) > 1:
                return [f"#{''.join(c*2 for c in h[1:])}" if len(h) == 4 else h for h in hexes]

    big = style.get("big") if isinstance(style.get("big"), dict) else {}
    big_fill = big.get("fill") if isinstance(big.get("fill"), dict) else {}
    big_cols = big_fill.get("colors")
    if big_cols and isinstance(big_cols, (list, tuple)):
        valid = [c for c in big_cols if isinstance(c, str) and c.startswith("#")]
        if len(valid) > 1:
            return valid

    return None


def _c(hex_color):
    h = str(hex_color or "").strip().lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    if len(h) == 6:
        return f"&H{h[4:6]}{h[2:4]}{h[0:2]}&".upper()
    return "&HFFFFFF&"


def _esc(t):
    return t.replace("*", "").replace("\\", "").replace("{", "(").replace("}", ")")


def ts(sec):
    cs = int(round(max(0, sec) * 100))
    h, cs = divmod(cs, 360000)
    m, cs = divmod(cs, 6000)
    s, cs = divmod(cs, 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def _lines(words, layout):
    if layout == "line" or len(words) <= 3:
        return [words]
    mid = (len(words) + 1) // 2
    return [words[:mid], words[mid:]]


def _chunk_text(words, style, W, H, layer, ev_start):
    """Text for one caption event. layer = 'glow' or 'main'."""
    base = min(W, H)
    roles = {True: style["key"], False: style["filler"]}
    res = {k: resolve(r) for k, r in roles.items()}
    if style.get("accent2"):
        res["accent2"] = resolve(style["accent2"])
    gap_name, gap_ratio = res[False]
    def word_role(word):
        return style.get("accent2") if word.get("_role") == "accent2" and style.get("accent2") else roles[word["key"]]
    lines = _lines(words, style["layout"])
    out_lines = []
    anim = style["animation"]
    rot = style.get("rotation", 0.0)
    palette = style.get("palette", [])
    word_idx = 0

    for line in lines:
        est = 0.0
        for i, w in enumerate(line):
            r = word_role(w)
            tx = w["T"]
            _, font_ratio = resolve(r)
            em = r["size"] * base * font_ratio * style.get("fontScale", 1.0)
            gap_em = style["filler"]["size"] * base * gap_ratio * style.get("fontScale", 1.0)
            est += len(tx) * em * (0.68 if r["upper"] else 0.56)
            if i < len(line) - 1:
                est += gap_em * style.get("wordGap", 0.28) if style.get("estateVariant") else gap_em * 0.28
        scale_x = float(style.get("scaleX", 1.0))
        scale = min(1.0, 0.86 * W / (est * scale_x)) if est else 1.0
        scale = max(scale, 0.20 if style.get("depthAccent") or style.get("estateVariant") else 0.45)
        gap_fs = max(8, round(style["filler"]["size"] * base * gap_ratio * style.get("fontScale", 1.0) * scale))
        parts = []
        for i, w in enumerate(line):
            r = word_role(w)
            name, ratio = res[w.get("_role", w["key"])]
            em = r["size"] * base * scale * style.get("fontScale", 1.0)
            fs = max(8, round(em * ratio))
            reveal = max(0, int(round((w["s"] - ev_start) * 1000)))
            end_ms = max(reveal + 60, int(round((w["e"] - ev_start) * 1000)))

            # Multi-color assignment (exact match to canvas preview)
            if w["key"]:
                hl = (style.get("highlight") or {}).get("color") or style.get("highlightColor")
                if r.get("color") and r.get("color").upper() not in ("#FFFFFF", "#FFF"):
                    w_color = r["color"]
                elif hl and isinstance(hl, str) and hl.startswith("#") and hl.upper() not in ("#FFFFFF", "#FFF"):
                    w_color = hl
                elif r.get("color"):
                    w_color = r["color"]
                elif hl:
                    w_color = hl
                else:
                    w_color = "#FFE600"
            else:
                w_color = style.get("baseColor") or r.get("color") or "#FFFFFF"
            word_idx += 1

            tags = [f"\\fn{name}", f"\\fs{fs}", f"\\b{1 if r['bold'] else 0}", f"\\i{1 if r['italic'] else 0}",
                    f"\\fscx{round(100 * float(style.get('scaleX', 1.0)))}", "\\fscy100"]
            if style.get("estateVariant") and r.get("track"):
                tags.append(f"\\fsp{round(float(r['track']) * em, 2)}")
            if w.get("_hiddenLayer"):
                tags.append("\\alpha&HFF&")
                parts.append("{" + "".join(tags) + "}" + _esc(w["T"]))
                if i < len(line) - 1:
                    space_scale = round(max(12, min(100, 100 * style.get("wordGap", 0.12) / 0.30)))
                    parts.append(f"{{\\fn{gap_name}\\fs{gap_fs}\\b0\\i0\\fsp0\\fscx{space_scale}}} {{\\fscx100}}")
                continue
            if rot:
                tags.append(f"\\frz{rot}")

            if layer == "glow":
                if style.get("refDualNeon"):
                    glow_hex = "#00C8FF" if w["key"] else "#E5FF20"
                    gs = max(2.5, r["glowSize"] * em * 1.8)
                    tags += [f"\\1c{_c(w_color)}", "\\1a&HFF&", f"\\3c{_c(glow_hex)}", "\\3a&H30&",
                             f"\\bord{gs:.1f}", f"\\blur{gs * 1.2:.1f}", "\\shad0"]
                else:
                    gs = max(1.0, r["glowSize"] * em)
                    tags += [f"\\1c{_c(w_color)}", "\\1a&HFF&", f"\\3c{_c(r['glow'])}", "\\3a&H40&",
                             f"\\bord{gs:.1f}", f"\\blur{gs * 0.9:.1f}", "\\shad0"]
                shown = "\\3a&H30&" if style.get("refDualNeon") else "\\3a&H40&"
            else:
                if style.get("chromaticAberration") and w["key"]:
                    tags += [f"\\1c{_c('#9333EA')}", "\\3c&H00D4FF&", "\\bord1",
                             "\\shad2.5", "\\4c&HFF1E50&", "\\blur0.2"]
                elif style.get("shadow3D"):
                    shad = f"{max(3.5, r['shadow'] * em * 1.8):.1f}"
                    tags += [f"\\1c{_c(w_color)}", f"\\3c{_c('#4A0010')}",
                             "\\bord1.2", f"\\shad{shad}", "\\xshad2.5", "\\yshad3.5",
                             f"\\4c{_c('#1A0000')}", "\\blur0"]
                elif style.get("chromeSpecular"):
                    tags += [f"\\1c{_c('#FFFFFF') if w['key'] else _c('#CBD5E1')}",
                             f"\\3c{_c('#64748B')}", "\\bord0.8",
                             "\\shad2.5", f"\\4c{_c('#0F172A')}", "\\blur0.2"]
                else:
                    shad = f"{r['shadow'] * em:.1f}"
                    tags += [f"\\1c{_c(w_color)}", f"\\3c{_c(r['outlineColor'])}",
                             f"\\bord{r['outline'] * em:.1f}", f"\\shad{shad}",
                             f"\\4c{_c(r['shadowColor'])}", "\\blur0.4"]
                    alpha_val = int(max(0.0, min(1.0, 1.0 - float(style.get("opacity", 1.0)))) * 255)
                    shown = f"\\alpha&H{alpha_val:02X}&"
                    tags.append(shown)

            if anim in ("pop", "bounce"):
                if reveal > 0:
                    tags.append(r"\alpha&HFF&")
                    tags.append(f"\\t({reveal},{reveal + 40},{shown})")
                tags.append(r"\fscx84\fscy84")
                tags.append(f"\\t({reveal},{reveal + 130},\\fscx108\\fscy108)")
                tags.append(f"\\t({reveal + 130},{reveal + 210},\\fscx100\\fscy100)")
            elif anim == "slide-up":
                if reveal > 0:
                    tags.append(r"\alpha&HFF&")
                    tags.append(f"\\t({reveal},{reveal + 40},{shown})")
                tags.append(r"\fscy85")
                tags.append(f"\\t({reveal},{reveal + 180},\\fscy100)")
            elif anim == "zoom":
                if reveal > 0:
                    tags.append(r"\alpha&HFF&")
                    tags.append(f"\\t({reveal},{reveal + 40},{shown})")
                tags.append(r"\fscx55\fscy55")
                tags.append(f"\\t({reveal},{reveal + 200},\\fscx100\\fscy100)")
            elif anim == "slide-right-soft" and layer == "main":
                slide_ms = int(style.get("_slideMs", 400))
                tags.append(r"\fscx92")
                if reveal > 0:
                    tags.append(r"\alpha&HFF&")
                    tags.append(f"\\t({reveal},{reveal + 1},\\alpha&H80&)")
                    tags.append(f"\\t({reveal + 1},{reveal + slide_ms},{shown}\\fscx100)")
                else:
                    tags.append(r"\alpha&H80&")
                    tags.append(f"\\t(0,{slide_ms},{shown}\\fscx100)")
            elif anim == "highlight" and layer == "main":
                hl = style.get("highlightColor") or "#FFE600"
                tags.append(f"\\t({reveal},{reveal + 1},\\1c{_c(hl)})")
                tags.append(f"\\t({end_ms},{end_ms + 1},\\1c{_c(w_color)})")

            if style.get("isSpecial") and style.get("mode") == "highlight" and w.get("_active"):
                active = style.get("activeRole") or r
                active_scale = 108 if active.get("size", r["size"]) >= r["size"] else 100
                tags.append(f"\\t({reveal},{max(reveal + 1, end_ms)},\\1c{_c(active.get('color', w_color))}\\fscx{active_scale}\\fscy{active_scale})")
                tags.append(f"\\t({max(reveal, end_ms - 70)},{end_ms + 70},\\1c{_c(w_color)}\\fscx100\\fscy100)")

            txt = w["T"]
            parts.append("{" + "".join(tags) + "}" + _esc(txt))
            if i < len(line) - 1:
                if style.get("estateVariant"):
                    space_scale = round(max(12, min(100, 100 * style.get("wordGap", 0.08) / 0.30)))
                    parts.append(f"{{\\fn{gap_name}\\fs{gap_fs}\\b0\\i0\\fsp0\\fscx{space_scale}}} {{\\fscx100}}")
                else:
                    parts.append(f"{{\\fn{gap_name}\\fs{gap_fs}\\b0\\i0}} ")
        out_lines.append("".join(parts))
    return "\\N".join(out_lines)


def build_stack_ass(captions, style, W, H, layer_filter="all"):
    r"""
    Renders stack-layout captions (e.g. Duo presets) with exact glyph bounding box measurement,
    word-by-word stable positioning, and 100% visual parity with canvas preview.
    """
    style = clean_style(style)
    roles = style.get("roles") or {}
    base_role = roles.get("base") or style.get("filler") or {}
    accent_role_def = roles.get("accent") or style.get("key") or {}
    accent2_role_def = roles.get("accent2") or style.get("accent2")
    uppercase = bool(style.get("uppercase", True if accent_role_def.get("upper") else False))
    ink_gap = float(style.get("inkGap", 0.03))
    pos_x = float(style.get("posX", 0.5))
    pos_cycle = style.get("posCycle") or []

    header = (
        "[Script Info]\nScriptType: v4.00+\n"
        f"PlayResX: {W}\nPlayResY: {H}\nWrapStyle: 2\nScaledBorderAndShadow: yes\n\n"
        "[V4+ Styles]\n"
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, "
        "Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, "
        "MarginR, MarginV, Encoding\n"
        "Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,2,0,0,0,1\n\n"
        "[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
    )

    norm_caps = []
    for c in captions:
        w_list = c.get("words", [])
        if not w_list:
            continue
        clean_w = []
        for w in w_list:
            t = str(w.get("t") or w.get("word") or w.get("text") or "").replace("*", "")
            s = float(w.get("s", w.get("start", c.get("start", 0))))
            e = float(w.get("e", w.get("end", c.get("end", s))))
            clean_w.append({"t": t, "key": bool(w.get("key")), "s": s, "e": e})
        norm_caps.append({
            "start": float(c.get("start", 0)),
            "end": float(c.get("end", 0)),
            "words": clean_w,
            "text": c.get("text", "")
        })
    caps = sorted(norm_caps, key=lambda c: c["start"])
    rows = []

    for cap_idx, c in enumerate(caps):
        words = list(c["words"])
        if not words:
            continue
        ev_start = min(float(w.get("s", w.get("start", c["start"]))) for w in words)
        ev_end = max(c["end"], max(float(w.get("e", w.get("end", c["end"]))) for w in words))
        if cap_idx + 1 < len(caps):
            ev_end = min(ev_end, caps[cap_idx + 1]["start"])
        ev_end = max(ev_end, ev_start + 0.25)

        alt = bool(accent2_role_def) and (cap_idx % 2 == 1)
        accent_role = accent2_role_def if alt else accent_role_def

        if len(words) <= 1:
            small_words = []
            big_words = words
        else:
            small_words = words[:-1]
            big_words = [words[-1]]

        up = lambda t: t.upper() if uppercase else t
        small_text = " ".join(up(str(w.get("t") or w.get("word") or w.get("text") or "")) for w in small_words)
        big_text = " ".join(up(str(w.get("t") or w.get("word") or w.get("text") or "")) for w in big_words)

        base_font_file = find_font_file(base_role)
        accent_font_file = find_font_file(accent_role)

        scale_h = H / 1920.0
        small_size = float(base_role.get("size", 62))
        if small_size <= 1.0:
            small_size = small_size * H
        else:
            small_size = small_size * scale_h

        big_size = float(accent_role.get("size", 230))
        if big_size <= 1.0:
            big_size = big_size * H
        else:
            big_size = big_size * scale_h

        if pos_cycle and len(pos_cycle) > 0:
            pos_y = float(pos_cycle[cap_idx % len(pos_cycle)])
        else:
            pos_y = float(style.get("posY", 0.5))

        is_behind = bool(
            style.get("behindPerson") or
            style.get("depthAccent") or
            (accent_role.get("layer") == "behind") or
            ("(behind)" in str(style.get("name", "")).lower())
        )

        if is_behind:
            hero_y = float(style.get("depthAccentY", 0.25))
            font_span = (big_size + small_size) * 0.5 / H + 0.008
            default_top = round(hero_y - font_span, 3)
            top_y = float(style.get("topY", default_top))
            sub_y = float(style.get("subtitlePosition", 0.72))

            if len(words) >= 3:
                if len(words) == 3:
                    top_w = [words[0]]
                    hero_w = [words[1]]
                    bottom_w = [words[2]]
                else:
                    mid = len(words) // 2
                    key_idx = -1
                    for ki, kw in enumerate(words):
                        if kw.get("key") and 0 < ki < len(words) - 1:
                            key_idx = ki
                            break
                    if key_idx == -1:
                        key_idx = mid
                    top_w = words[:key_idx]
                    hero_w = [words[key_idx]]
                    bottom_w = words[key_idx + 1:]
            elif len(words) == 2:
                top_w = [words[0]]
                hero_w = [words[1]]
                bottom_w = []
            else:
                top_w = []
                hero_w = words
                bottom_w = []

            lay = []
            if top_w:
                top_txt = " ".join(up(w["t"]) for w in top_w)
                desc_top = {
                    "text": top_txt,
                    "font_file": base_font_file,
                    "size": small_size * 0.92,
                    "track": float(base_role.get("track", 0.0)),
                    "words": top_w,
                    "role": base_role,
                    "is_hero": False,
                    "is_top": True
                }
                lay += ink_layout.layout_stack([desc_top], W, H, pos_x=pos_x, pos_y=top_y, ink_gap=ink_gap)

            if hero_w:
                hero_txt = " ".join(up(w["t"]) for w in hero_w)
                desc_hero = {
                    "text": hero_txt,
                    "font_file": accent_font_file,
                    "size": big_size,
                    "track": float(accent_role.get("track", 0.0)),
                    "words": hero_w,
                    "role": accent_role,
                    "is_hero": True,
                    "is_top": False
                }
                lay += ink_layout.layout_stack([desc_hero], W, H, pos_x=pos_x, pos_y=hero_y, ink_gap=ink_gap)

            if bottom_w:
                bottom_txt = " ".join(up(w["t"]) for w in bottom_w)
                desc_bottom = {
                    "text": bottom_txt,
                    "font_file": base_font_file,
                    "size": small_size,
                    "track": float(base_role.get("track", 0.0)),
                    "words": bottom_w,
                    "role": base_role,
                    "is_hero": False,
                    "is_top": False
                }
                lay += ink_layout.layout_stack([desc_bottom], W, H, pos_x=pos_x, pos_y=sub_y, ink_gap=ink_gap)
        else:
            lines_in = []
            if small_words:
                lines_in.append({
                    "text": small_text,
                    "font_file": base_font_file,
                    "size": small_size,
                    "track": float(base_role.get("track", 0.0)),
                    "words": small_words,
                    "role": base_role,
                    "is_hero": False
                })
            if big_words:
                lines_in.append({
                    "text": big_text,
                    "font_file": accent_font_file,
                    "size": big_size,
                    "track": float(accent_role.get("track", 0.0)),
                    "words": big_words,
                    "role": accent_role,
                    "is_hero": True
                })
            lay = ink_layout.layout_stack(lines_in, W, H, pos_x=pos_x, pos_y=pos_y, ink_gap=ink_gap)

        for line_idx, o in enumerate(lay):
            if layer_filter == "depth" and not o["is_hero"]:
                continue
            if layer_filter == "subtitle" and o["is_hero"]:
                continue

            font_name, ratio = get_ass_font_info(o["font_file"])
            ass_fs = o["size"] * ratio
            fsp = o["track"] * o["size"]

            r = o["role"]
            is_hero = o["is_hero"]

            user_hl = style.get("highlightColor") or (style.get("highlight") or {}).get("color")
            user_base = style.get("baseColor")
            grad_colors = get_gradient_colors(r, style)

            if is_hero:
                col = user_hl or r.get("color") or (grad_colors[-1] if grad_colors else "#FFE600")
            else:
                col = user_base or r.get("color") or style.get("color") or "#FFFFFF"

            bold = 1 if (r.get("bold") or r.get("weight", 500) >= 700) else 0
            italic = 1 if r.get("italic") else 0
            outline_mode = style.get("outlineMode")
            if outline_mode == "none":
                outline_px = 0.0
                outline_col = "#000000"
            elif outline_mode == "glow":
                outline_px = max(2.0, round(o["size"] * 0.06, 1))
                outline_col = user_hl or "#FFE600"
            else:
                outline_val = float(r.get("outline", 0))
                if outline_val > 0:
                    outline_px = max(2.0, round(outline_val * (o["size"] / 70.0), 1))
                else:
                    outline_px = max(2.5, round(o["size"] * (0.08 if is_hero else 0.06), 1))
                outline_col = r.get("outlineColor", "#000000")

            anim_name = str(o["role"].get("enter") or style.get("animation") or style.get("anim") or "pop").lower()

            # Word-by-word measurement and placement along line
            line_words = o["words"]
            measured = []
            for w in line_words:
                txt = up(w["t"])
                we = ink_layout.ink_extents(o["font_file"], txt, o["size"], o["track"])
                measured.append({
                    "w": w,
                    "txt": txt,
                    "width": we["width"],
                })

            min_space = 0.16 * o["size"]
            space_extent = ink_layout.ink_extents(o["font_file"], " ", o["size"], o["track"])
            space_w = max(min_space, space_extent["width"])
            total_line_w = sum(m["width"] for m in measured) + max(0, len(measured) - 1) * space_w

            cur_x = o["x"] - total_line_w / 2.0

            for m in measured:
                w = m["w"]
                txt = m["txt"]
                w_w = m["width"]
                word_cx = cur_x + w_w / 2.0
                cur_x += w_w + space_w

                w_start = float(w.get("s", ev_start))
                w_start = max(ev_start, min(ev_end - 0.05, w_start))
                w_st_ts = ts(w_start)
                w_end_ts = ts(ev_end)

                if anim_name == "slide-up":
                    pos_tag = f"\\move({word_cx:.1f},{o['ass_y'] + 28:.1f},{word_cx:.1f},{o['ass_y']:.1f},0,200)"
                    anim_tags = [r"\alpha&HFF&\t(0,40,\alpha&H00&)"]
                elif anim_name == "slide-down":
                    pos_tag = f"\\move({word_cx:.1f},{o['ass_y'] - 28:.1f},{word_cx:.1f},{o['ass_y']:.1f},0,200)"
                    anim_tags = [r"\alpha&HFF&\t(0,40,\alpha&H00&)"]
                elif anim_name == "slide-left":
                    pos_tag = f"\\move({word_cx + 32:.1f},{o['ass_y']:.1f},{word_cx:.1f},{o['ass_y']:.1f},0,200)"
                    anim_tags = [r"\alpha&HFF&\t(0,40,\alpha&H00&)"]
                elif anim_name == "slide-right":
                    pos_tag = f"\\move({word_cx - 32:.1f},{o['ass_y']:.1f},{word_cx:.1f},{o['ass_y']:.1f},0,200)"
                    anim_tags = [r"\alpha&HFF&\t(0,40,\alpha&H00&)"]
                elif anim_name == "zoom":
                    pos_tag = f"\\pos({word_cx:.1f},{o['ass_y']:.1f})"
                    anim_tags = [r"\fscx50\fscy50\alpha&HFF&\t(0,40,\alpha&H00&)\t(0,200,0.4,\fscx100\fscy100)"]
                elif anim_name == "fade":
                    pos_tag = f"\\pos({word_cx:.1f},{o['ass_y']:.1f})"
                    anim_tags = [r"\alpha&HFF&\t(0,200,\alpha&H00&)"]
                elif anim_name in ("none", "static"):
                    pos_tag = f"\\pos({word_cx:.1f},{o['ass_y']:.1f})"
                    anim_tags = [r"\fscx100\fscy100"]
                else:  # pop / bounce
                    pos_tag = f"\\pos({word_cx:.1f},{o['ass_y']:.1f})"
                    anim_tags = [r"\fscx84\fscy84\alpha&HFF&\t(0,40,\alpha&H00&)\t(0,200,0.4,\fscx100\fscy100)"]

                tags = [
                    r"\an2",
                    pos_tag,
                    f"\\fn{font_name}",
                    f"\\fs{ass_fs:.1f}",
                    f"\\fsp{fsp:.2f}",
                    f"\\b{bold}",
                    f"\\i{italic}",
                    f"\\1c{_c(col)}",
                ]
                if outline_px > 0:
                    tags += [f"\\bord{outline_px:.1f}", f"\\3c{_c(outline_col)}"]
                else:
                    tags.append(r"\bord0")
                tags.append(r"\shad0")
                tags += anim_tags

                rows.append(f"Dialogue: {line_idx},{w_st_ts},{w_end_ts},Default,,0,0,0,,{{{ ''.join(tags) }}}{_esc(txt)}")

    return header + "\n".join(rows) + "\n"
def build_depth_ass(captions, style, W, H):
    """Return a large behind-person keyword and readable foreground subtitle."""
    base = clean_style(style)
    if (base.get("behindPerson") or base.get("depthAccent") or base.get("layout") == "stack" or base.get("isDuo") or (base.get("isSpecial") and base.get("mode") == "emphasis")):
        return build_stack_ass(captions, base, W, H, layer_filter="depth"), build_stack_ass(captions, base, W, H, layer_filter="subtitle")
    if base.get("estateVariant"):
        line_style = copy.deepcopy(base)
        line_style["layout"] = "line"
        # Keep the rendered word at the same vertical position used by the
        # editor preview (the general subtitle position is lower on the screen).
        line_style["position"] = base.get("depthAccentY", base["position"])
        behind_caps, front_caps = [], []
        for cap in captions:
            cap_words = []
            for word in cap.get("words", []):
                item = dict(word)
                item["key"] = False
                cap_words.append(item)
            if cap_words:
                cap_words[-1]["key"] = True
                behind_words = [dict(word, _hiddenLayer=(i != len(cap_words) - 1)) for i, word in enumerate(cap_words)]
                front_words = [dict(word, _hiddenLayer=(i == len(cap_words) - 1)) for i, word in enumerate(cap_words)]
                behind_caps.append({**cap, "words": behind_words})
                front_caps.append({**cap, "words": front_words})
        return build_ass(behind_caps, line_style, W, H), build_ass(front_caps, line_style, W, H)
    if base.get("isSpecial") and base.get("mode") == "highlight":
        line_style = copy.deepcopy(base)
        line_style["layout"] = "line"
        line_style["animation"] = "none"
        line_caps = []
        for cap in captions:
            words = []
            for word in cap.get("words", []):
                item = dict(word)
                item["key"] = False
                item["_active"] = True
                words.append(item)
            if words:
                line_caps.append({**cap, "words": words})
        return build_ass([], line_style, W, H), build_ass(line_caps, line_style, W, H)

    hero_style = copy.deepcopy(base)
    hero_style["position"] = base.get("depthAccentY", 0.41)
    hero_style["layout"] = "line"
    hero_style["depthAccent"] = True
    hero_style["scaleX"] = 1.10
    hero_style["key"]["size"] = base.get("depthAccentSize", 0.22)
    hero_style["position"] = max(0.05, min(0.95, hero_style["position"]))
    hero_style["key"]["upper"] = True
    hero_caps, subtitle_caps = [], []

    subtitle_style = copy.deepcopy(base)
    subtitle_style["position"] = base.get("subtitlePosition", 0.76)
    subtitle_style["layout"] = "line"
    subtitle_style["key"] = copy.deepcopy(subtitle_style["filler"])
    subtitle_style["key"]["size"] = base.get("subtitleSize", 0.058)
    subtitle_style["filler"]["size"] = base.get("subtitleSize", 0.058)
    subtitle_style["position"] = max(0.05, min(0.95, subtitle_style["position"]))
    subtitle_style["key"]["upper"] = True
    subtitle_style["filler"]["upper"] = True
    subtitle_style["palette"] = [c for c in (base.get("big", {}).get("fill", {}).get("colors", []) or [base["highlightColor"]]) if isinstance(c, str) and c.startswith("#")]

    for cap_index, cap in enumerate(captions):
        words = cap.get("words", [])
        if not words:
            continue
        hero = dict(words[-1]); hero["key"] = True
        if base.get("accent2") and cap_index % 2:
            hero["_role"] = "accent2"
        hero_caps.append({**cap, "words": [hero]})
        if len(words) > 1:
            subtitle_words = []
            for index, word in enumerate(words[:-1]):
                item = dict(word); item["key"] = index % 2 == 1
                subtitle_words.append(item)
            subtitle_caps.append({**cap, "words": subtitle_words})
    return build_ass(hero_caps, hero_style, W, H), build_ass(subtitle_caps, subtitle_style, W, H)


def build_ass(captions, style, W, H):
    """captions: list of {'start','end','words':[{'t','key','s','e'}]} already on the OUTPUT timeline."""
    style = clean_style(style)
    if style.get("layout") == "stack" or style.get("isDuo") or (style.get("isSpecial") and style.get("mode") == "emphasis"):
        return build_stack_ass(captions, style, W, H, layer_filter="all")

    k_role = style.get("key") or {}
    f_role = style.get("filler") or {}
    font_file = find_font_file(k_role if k_role.get("font") else f_role)
    font_name, ratio = get_ass_font_info(font_file)

    scale = max(260.0, min(W, H)) / 1080.0
    base_fs = float(style.get("fontSize") or f_role.get("size") or k_role.get("size") or 0.082)
    if base_fs <= 1.0:
        fs = max(18.0, round(1080.0 * scale * base_fs * float(style.get("fontScale", 1.0))))
    else:
        fs = max(18.0, round(base_fs * scale * float(style.get("fontScale", 1.0))))

    ass_fs = fs * ratio
    leading = 1.18
    line_h = fs * leading

    highlight_col = style.get("highlightColor") or k_role.get("color") or "#FFE600"
    base_col = style.get("baseColor") or f_role.get("color") or "#FFFFFF"
    anim_name = str(style.get("animation") or style.get("anim") or "pop").lower()

    pos_y_pct = float(style.get("position", 0.68))
    c_y = int(H * pos_y_pct)

    header = (
        "[Script Info]\nScriptType: v4.00+\n"
        f"PlayResX: {W}\nPlayResY: {H}\nWrapStyle: 2\nScaledBorderAndShadow: yes\n\n"
        "[V4+ Styles]\n"
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, "
        "Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, "
        "MarginR, MarginV, Encoding\n"
        "Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,2,0,0,0,1\n\n"
        "[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
    )

    norm_caps = []
    for c in captions:
        w_list = c.get("words", [])
        if not w_list:
            continue
        clean_w = []
        for w in w_list:
            t = str(w.get("t") or w.get("word") or w.get("text") or "").replace("*", "")
            s = float(w.get("s", w.get("start", c.get("start", 0))))
            e = float(w.get("e", w.get("end", c.get("end", s))))
            clean_w.append({"t": t, "key": bool(w.get("key")), "s": s, "e": e})
        norm_caps.append({
            "start": float(c.get("start", 0)),
            "end": float(c.get("end", 0)),
            "words": clean_w,
            "text": c.get("text", "")
        })
    caps = sorted(norm_caps, key=lambda c: c["start"])
    rows = []

    for cap_idx, c in enumerate(caps):
        words = list(c["words"])
        if not words:
            continue
        ev_start = min(w["s"] for w in words)
        ev_end = max(c["end"], max(w["e"] for w in words))
        if cap_idx + 1 < len(caps):
            ev_end = min(ev_end, caps[cap_idx + 1]["start"])
        ev_end = max(ev_end, ev_start + 0.25)

        if len(words) <= 3:
            lines = [words]
        else:
            mid = math.ceil(len(words) / 2)
            lines = [words[:mid], words[mid:]]

        total_h = len(lines) * line_h
        start_y = c_y - (total_h / 2.0) + (line_h / 2.0)

        for line_idx, line_words in enumerate(lines):
            line_y = start_y + line_idx * line_h

            measured = []
            for w in line_words:
                is_key = bool(w["key"])
                role = k_role if is_key else f_role
                is_upper = role.get("upper", True if is_key else False)
                txt = w["t"].upper() if is_upper else w["t"]
                we = ink_layout.ink_extents(font_file, txt, fs)
                measured.append({
                    "w": w,
                    "txt": txt,
                    "is_key": is_key,
                    "width": we["width"]
                })

            space_extent = ink_layout.ink_extents(font_file, " ", fs)
            space_w = max(fs * 0.28, space_extent["width"])
            total_line_w = sum(m["width"] for m in measured) + max(0, len(measured) - 1) * space_w

            if style.get("align") == "left":
                cur_x = W * 0.09
            elif style.get("align") == "right":
                cur_x = W * 0.91 - total_line_w
            else:
                cur_x = (W - total_line_w) / 2.0

            for m in measured:
                w = m["w"]
                txt = m["txt"]
                is_key = m["is_key"]
                w_w = m["width"]
                word_cx = cur_x + w_w / 2.0
                cur_x += w_w + space_w

                w_start = float(w.get("s", ev_start))
                w_start = max(ev_start, min(ev_end - 0.05, w_start))
                w_st_ts = ts(w_start)
                w_end_ts = ts(ev_end)

                col = highlight_col if is_key else base_col
                outline_px = max(2.5, round(fs * (0.17 if is_key else 0.14), 1))
                outline_col = (k_role if is_key else f_role).get("outlineColor") or "#000000"
                if style.get("outlineMode") == "none":
                    outline_px = 0.0

                bold = 1 if ((k_role if is_key else f_role).get("bold") or (k_role if is_key else f_role).get("weight", 700) >= 700) else 0
                italic = 1 if (k_role if is_key else f_role).get("italic") else 0

                if anim_name == "slide-up":
                    pos_tag = f"\\move({word_cx:.1f},{line_y + 28:.1f},{word_cx:.1f},{line_y:.1f},0,200)"
                    anim_tags = [r"\alpha&HFF&\t(0,40,\alpha&H00&)"]
                elif anim_name == "slide-down":
                    pos_tag = f"\\move({word_cx:.1f},{line_y - 28:.1f},{word_cx:.1f},{line_y:.1f},0,200)"
                    anim_tags = [r"\alpha&HFF&\t(0,40,\alpha&H00&)"]
                elif anim_name == "slide-left":
                    pos_tag = f"\\move({word_cx + 32:.1f},{line_y:.1f},{word_cx:.1f},{line_y:.1f},0,200)"
                    anim_tags = [r"\alpha&HFF&\t(0,40,\alpha&H00&)"]
                elif anim_name == "slide-right":
                    pos_tag = f"\\move({word_cx - 32:.1f},{line_y:.1f},{word_cx:.1f},{line_y:.1f},0,200)"
                    anim_tags = [r"\alpha&HFF&\t(0,40,\alpha&H00&)"]
                elif anim_name == "zoom":
                    pos_tag = f"\\pos({word_cx:.1f},{line_y:.1f})"
                    anim_tags = [r"\fscx50\fscy50\alpha&HFF&\t(0,40,\alpha&H00&)\t(0,200,0.4,\fscx100\fscy100)"]
                elif anim_name == "fade":
                    pos_tag = f"\\pos({word_cx:.1f},{line_y:.1f})"
                    anim_tags = [r"\alpha&HFF&\t(0,200,\alpha&H00&)"]
                elif anim_name in ("none", "static"):
                    pos_tag = f"\\pos({word_cx:.1f},{line_y:.1f})"
                    anim_tags = [r"\fscx100\fscy100"]
                else:  # pop / bounce
                    pos_tag = f"\\pos({word_cx:.1f},{line_y:.1f})"
                    anim_tags = [r"\fscx84\fscy84\alpha&HFF&\t(0,40,\alpha&H00&)\t(0,200,0.4,\fscx100\fscy100)"]

                tags = [
                    r"\an5",
                    pos_tag,
                    f"\\fn{font_name}",
                    f"\\fs{ass_fs:.1f}",
                    f"\\b{bold}",
                    f"\\i{italic}",
                    f"\\1c{_c(col)}",
                ]
                if outline_px > 0:
                    tags += [f"\\bord{outline_px:.1f}", f"\\3c{_c(outline_col)}"]
                else:
                    tags.append(r"\bord0")
                tags.append(f"\\shad{max(1.0, round(fs * 0.04, 1)):.1f}\\4c&H000000&")
                tags += anim_tags

                # Check if highlight mode is 'box' (e.g. Yellow Box Pop)
                is_box_mode = is_key and bool(style.get("highlight", {}).get("mode") == "box")
                if is_box_mode:
                    box_bg = style.get("highlight", {}).get("color") or highlight_col or "#FFE600"
                    box_fg = style.get("highlight", {}).get("textColor") or "#111111"
                    pad_x = max(6.0, round(fs * 0.24, 1))
                    pad_y = max(4.0, round(fs * 0.16, 1))
                    bw = round(w_w + pad_x * 2.0, 1)
                    bh = round(fs * 1.25, 1)
                    
                    # Box background drawn on Layer 0
                    x1 = -round(bw / 2.0, 1)
                    y1 = -round(bh / 2.0, 1)
                    x2 = round(bw / 2.0, 1)
                    y2 = round(bh / 2.0, 1)
                    box_draw = f"m {x1} {y1} l {x2} {y1} l {x2} {y2} l {x1} {y2}"
                    box_tags = [
                        r"\an5",
                        pos_tag,
                        r"\p1",
                        f"\\1c{_c(box_bg)}",
                        r"\bord0",
                        r"\shad1.5\4c&H000000&",
                    ] + anim_tags
                    rows.append(f"Dialogue: 0,{w_st_ts},{w_end_ts},Default,,0,0,0,,{{{ ''.join(box_tags) }}}{box_draw}")

                    # Box text drawn on Layer 1 on top of box
                    txt_tags = [
                        r"\an5",
                        pos_tag,
                        f"\\fn{font_name}",
                        f"\\fs{ass_fs:.1f}",
                        f"\\b{bold}",
                        f"\\i{italic}",
                        f"\\1c{_c(box_fg)}",
                        r"\bord0",
                        r"\shad0",
                    ] + anim_tags
                    rows.append(f"Dialogue: 1,{w_st_ts},{w_end_ts},Default,,0,0,0,,{{{ ''.join(txt_tags) }}}{_esc(txt)}")
                else:
                    rows.append(f"Dialogue: 0,{w_st_ts},{w_end_ts},Default,,0,0,0,,{{{ ''.join(tags) }}}{_esc(txt)}")

    return header + "\n".join(rows) + "\n"
