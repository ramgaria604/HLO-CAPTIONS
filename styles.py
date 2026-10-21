"""Caption grouping, emphasis detection, style presets and the ASS caption builder."""
import copy
import json
import os
import re

from fonts_util import resolve

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


def build_captions(words, per=3, max_keys=1, max_gap=0.7, max_len=3.2):
    """words: [(start, end, text)] -> list of captions with *emphasis* markup and word times."""
    caps, cur = [], []

    def flush():
        if not cur:
            return
        toks = [{"t": w[2], "key": False} for w in cur]
        if toks:
            toks[-1]["key"] = True
        for i in pick_keys(toks, max_keys):
            toks[i]["key"] = True
        text = " ".join(f"*{t['t']}*" if t["key"] else t["t"] for t in toks)
        caps.append({"id": len(caps) + 1, "start": round(cur[0][0], 2), "end": round(cur[-1][1], 2),
                     "text": text, "wt": [[round(w[0], 2), round(w[1], 2)] for w in cur]})

    for w in words:
        if cur:
            gap = w[0] - cur[-1][1]
            if len(cur) >= per or gap > max_gap or (w[1] - cur[0][0]) > max_len:
                flush()
                cur = []
        cur.append(w)
        if re.search(r"[.!?]$", w[2]):
            flush()
            cur = []
    flush()
    return caps


def caption_words(cap):
    """Words of a caption with start/end times. Uses real timings when the word count still matches."""
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

        key_role = role(
            font=big.get("font", "Montserrat"),
            fallback=big.get("fallback", "Arial"),
            size=big.get("size", 0.12),
            color=fill_colors[0] if fill_colors else "#FFFFFF",
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
                    "position": (float(p.get("posY", 0.52)) if accent.get("layer") == "behind"
                                  else max(0.64, min(0.82, float(p.get("posY", 0.2)) + 0.48))),
                    "posCycle": p.get("posCycle"),
                    "behindPerson": accent.get("layer") == "behind",
                    "depthAccent": accent.get("layer") == "behind",
                    "depthAccentSize": max(0.12, min(0.34, float(accent.get("size", 190)) / 1080.0)),
                    "depthAccentY": float((p.get("posCycle") or [p.get("posY", 0.2)])[0]),
                    "subtitlePosition": max(0.64, min(0.82, float(p.get("posY", 0.2)) + 0.48)),
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
    return {
        "font": _text(r.get("font"), d["font"]), "fallback": _text(r.get("fallback"), d["fallback"]),
        "size": _num(r.get("size"), 0.02, 0.30, d["size"]),
        "color": _hex(r.get("color"), d["color"]),
        "outline": _num(r.get("outline"), 0, 0.25, d["outline"]),
        "outlineColor": _hex(r.get("outlineColor"), d["outlineColor"]),
        "glow": _hex(r.get("glow"), d["glow"]), "glowSize": _num(r.get("glowSize"), 0, 0.25, d["glowSize"]),
        "shadow": _num(r.get("shadow"), 0, 0.2, d["shadow"]),
        "shadowColor": _hex(r.get("shadowColor"), d["shadowColor"]),
        "italic": bool(r.get("italic")), "bold": bool(r.get("bold")), "upper": bool(r.get("upper")),
    }


def clean_style(s):
    s = s or {}
    d = DEFAULT_STYLE
    palette = [c for c in s.get("palette", []) if isinstance(c, str) and c.startswith("#")]
    is_special = bool(s.get("isSpecial"))
    key_role = clean_role(s.get("key"), d["key"])
    filler_role = clean_role(s.get("filler"), d["filler"])
    active_role = clean_role(s.get("activeRole"), d["key"])
    accent2_role = clean_role(s.get("accent2"), d["key"]) if s.get("accent2") else None
    if is_special:
        # Retain each preset's text palette but remove its colored shadow/halo layer.
        for role in (key_role, filler_role, active_role, accent2_role):
            if role is not None:
                role["shadowColor"] = "#000000"
                role["shadow"] = 0
                role["glowSize"] = 0
    return {
        "id": s.get("id", "custom"),
        "name": _text(s.get("name"), "Custom", 40),
        "category": s.get("category", "all"),
        "layout": s.get("layout") if s.get("layout") in ("stack", "line") else "stack",
        "animation": s.get("animation") if s.get("animation") in ("pop", "highlight", "none") else "pop",
        "mode": s.get("mode") if s.get("mode") in ("emphasis", "highlight") else "emphasis",
        "wordsPerCaption": int(_num(s.get("wordsPerCaption"), 1, 8, 3)),
        "maxKeys": int(_num(s.get("maxKeys"), 0, 3, 1)),
        "position": _num(s.get("position"), 0.1, 0.95, 0.78),
        "opacity": _num(s.get("opacity"), 0.4, 1.0, 0.90),
        "highlightColor": _hex(s.get("highlightColor"), "#FFE600"),
        "key": key_role, "filler": filler_role,
        "activeRole": active_role,
        "accent2": accent2_role,
        # Unique Moonshot features
        "palette": palette,
        "badge": s.get("badge"),
        "badgeTextColor": s.get("badgeTextColor", "#000000"),
        "rotation": float(s.get("rotation", 0.0)),
        "shadow3D": bool(s.get("shadow3D", False)),
        "karaokeDim": bool(s.get("karaokeDim", False)),
        "glowBloom": bool(s.get("glowBloom", False)),
        "blendMode": s.get("blendMode"),
        "behindPerson": bool(s.get("behindPerson", False)),
        "depthAccent": bool(s.get("depthAccent", False)),
        "depthAccentSize": float(_num(s.get("depthAccentSize"), 0.12, 0.34, 0.22)),
        "depthAccentY": float(_num(s.get("depthAccentY"), 0.20, 0.62, 0.41)),
        "subtitlePosition": float(_num(s.get("subtitlePosition"), 0.58, 0.90, 0.76)),
        "subtitleSize": float(_num(s.get("subtitleSize"), 0.035, 0.09, 0.058)),
        "fontScale": float(_num(s.get("fontScale"), 0.6, 1.5, 1.0)),
        "offsetX": float(_num(s.get("offsetX"), -0.10, 0.10, 0.0)),
        "scaleX": float(_num(s.get("scaleX"), 0.7, 1.5, 1.0)),
        "refDualNeon": bool(s.get("refDualNeon", False)),
        "chromaticAberration": bool(s.get("chromaticAberration", False)),
        "lensDistort": bool(s.get("lensDistort", False)),
        "pillBox": bool(s.get("pillBox", False)),
        "pillBg": s.get("pillBg"),
        "chromeSpecular": bool(s.get("chromeSpecular", False)),
        "behindBars": bool(s.get("behindBars", False)),
        "motionGraphic3D": s.get("motionGraphic3D"),
        "leading": float(s.get("leading", 1.0)),
        "multiColorGradients": s.get("multiColorGradients"),
        "keyGradient": s.get("keyGradient"),
        "secondaryGradient": s.get("secondaryGradient"),
        "textGradient": s.get("textGradient"),
        "big": s.get("big"),
        "small": s.get("small"),
        "fx": s.get("fx"),
        "blend": s.get("blend"),
        "pill": s.get("pill"),
        "highlight": s.get("highlight"),
        "posCycle": s.get("posCycle"),
        "lineGap": s.get("lineGap"),
        "keyRule": s.get("keyRule"),
        "enter": s.get("enter"),
        "fill": s.get("fill"),
        "roles": s.get("roles"),
        "isSpecial": s.get("isSpecial"),
    }


# ---------------------------------------------------------------- ASS builder
def _c(hex_color):
    h = hex_color.lstrip("#")
    if len(h) == 6:
        return f"&H{h[4:6]}{h[2:4]}{h[0:2]}&".upper()
    return "&HFFFFFF&"


def _esc(t):
    return t.replace("\\", "").replace("{", "(").replace("}", ")")


def ts(sec):
    cs = int(round(max(0, sec) * 100))
    h, cs = divmod(cs, 360000)
    m, cs = divmod(cs, 6000)
    s, cs = divmod(cs, 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def _lines(words, layout):
    if layout == "line":
        return [words]
    lines, cur = [], []
    for w in words:
        if cur and cur[-1]["key"] != w["key"]:
            lines.append(cur)
            cur = []
        cur.append(w)
    if cur:
        lines.append(cur)
    return lines


def _chunk_text(words, style, W, H, layer, ev_start):
    """Text for one caption event. layer = 'glow' or 'main'."""
    base = min(W, H)
    roles = {True: style["key"], False: style["filler"]}
    res = {k: resolve(r) for k, r in roles.items()}
    if style.get("accent2"):
        res["accent2"] = resolve(style["accent2"])
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
        for w in line:
            r = word_role(w)
            tx = w["T"]
            _, font_ratio = resolve(r)
            em = r["size"] * base * font_ratio * style.get("fontScale", 1.0)
            est += len(tx) * em * (0.68 if r["upper"] else 0.56) + em * 0.3
        scale_x = float(style.get("scaleX", 1.0))
        scale = min(1.0, 0.86 * W / (est * scale_x)) if est else 1.0
        scale = max(scale, 0.20 if style.get("depthAccent") else 0.45)
        parts = []
        for i, w in enumerate(line):
            r = word_role(w)
            name, ratio = res[w.get("_role", w["key"])]
            em = r["size"] * base * scale * style.get("fontScale", 1.0)
            fs = max(8, round(em * ratio))
            reveal = max(0, int(round((w["s"] - ev_start) * 1000)))
            end_ms = max(reveal + 60, int(round((w["e"] - ev_start) * 1000)))

            # Multi-color assignment
            w_color = r["color"]
            if palette:
                if w["key"]:
                    w_color = r["color"] if r["color"] != "#FFFFFF" else palette[-1]
                else:
                    w_color = palette[word_idx % len(palette)]
            word_idx += 1

            tags = [f"\\fn{name}", f"\\fs{fs}", f"\\b{1 if r['bold'] else 0}", f"\\i{1 if r['italic'] else 0}",
                    f"\\fscx{round(100 * float(style.get('scaleX', 1.0)))}", "\\fscy100"]
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

            if anim == "pop":
                if reveal > 40:
                    tags.append("\\alpha&HFF&")
                    tags.append(f"\\t({reveal},{reveal + 1},{shown})")
                if layer == "main" or True:
                    tags.append(f"\\t({reveal},{reveal + 110},\\fscx112\\fscy112)")
                    tags.append(f"\\t({reveal + 110},{reveal + 210},\\fscx100\\fscy100)")
            elif anim == "highlight" and layer == "main":
                hl = style["highlightColor"]
                tags.append(f"\\t({reveal},{reveal + 1},\\1c{_c(hl)})")
                tags.append(f"\\t({end_ms},{end_ms + 1},\\1c{_c(w_color)})")

            if style.get("isSpecial") and style.get("mode") == "highlight" and w.get("_active"):
                active = style.get("activeRole") or r
                active_scale = 108 if active.get("size", r["size"]) >= r["size"] else 100
                tags.append(f"\\t({reveal},{max(reveal + 1, end_ms)},\\1c{_c(active.get('color', w_color))}\\fscx{active_scale}\\fscy{active_scale})")
                tags.append(f"\\t({max(reveal, end_ms - 70)},{end_ms + 70},\\1c{_c(w_color)}\\fscx100\\fscy100)")

            txt = w["T"]
            parts.append("{" + "".join(tags) + "}" + ("" if i == 0 else " ") + _esc(txt))
        out_lines.append("".join(parts))
    return "\\N".join(out_lines)


def build_depth_ass(captions, style, W, H):
    """Return a large behind-person keyword and readable foreground subtitle."""
    base = clean_style(style)
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
    x = max(0, min(W, int(W * (0.5 + style.get("offsetX", 0.0)))))
    y = int(H * style["position"])
    has_glow = not style.get("isSpecial") and any(style[k]["glowSize"] > 0 for k in ("key", "filler"))
    header = (
        "[Script Info]\nScriptType: v4.00+\n"
        f"PlayResX: {W}\nPlayResY: {H}\nWrapStyle: 2\nScaledBorderAndShadow: yes\n\n"
        "[V4+ Styles]\n"
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, "
        "Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, "
        "MarginR, MarginV, Encoding\n"
        "Style: Cap,Arial,40,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,5,0,0,0,1\n\n"
        "[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
    )
    caps = sorted((c for c in captions if c.get("words")), key=lambda c: c["start"])
    rows = []
    for i, c in enumerate(caps):
        words = []
        for w in c["words"]:
            w = dict(w)
            w["T"] = w["t"].upper() if style["key" if w["key"] else "filler"]["upper"] else w["t"]
            words.append(w)
        ev_start = min(w["s"] for w in words)
        ev_end = max(c["end"], max(w["e"] for w in words))
        if i + 1 < len(caps):
            ev_end = min(ev_end, caps[i + 1]["start"])
        ev_end = max(ev_end, ev_start + 0.25)
        pos = f"{{\\an5\\pos({x},{y})}}"
        if has_glow:
            rows.append(f"Dialogue: 0,{ts(ev_start)},{ts(ev_end)},Cap,,0,0,0,,{pos}"
                        + _chunk_text(words, style, W, H, "glow", ev_start))
        rows.append(f"Dialogue: 1,{ts(ev_start)},{ts(ev_end)},Cap,,0,0,0,,{pos}"
                    + _chunk_text(words, style, W, H, "main", ev_start))
    return header + "\n".join(rows) + "\n"
