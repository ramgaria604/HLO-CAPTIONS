import os
import json

styles_file = "styles.py"
with open(styles_file, "r", encoding="utf-8") as f:
    content = f.read()

start_marker = "DEFAULT_STYLE = {"
end_marker = "def _num(v, lo, hi, default):"

if start_marker in content and end_marker in content:
    idx_start = content.index(start_marker)
    idx_end = content.index(end_marker)

    new_code = '''def load_presets():
    """Load the official 51 presets from static/presets51.json."""
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
        small_fill = (small.get("fill") or {}).get("colors", ["#FFFFFF"])

        key_role = role(
            font=big.get("font", "Montserrat"),
            fallback="Arial",
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
            fallback="Arial",
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
            "position": float(p.get("pos", 0.60)),
            "highlightColor": p.get("highlightColor", fill_colors[0] if fill_colors else "#FFE600"),
            "gap": float(p.get("gap", 0.12)),
            "behind": p.get("behind", "none"),
            "behindPerson": bool(p.get("behindPerson") or p.get("behind") in ("first", "all")),
            "blend": p.get("blend"),
            "fx": p.get("fx"),
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
    return out


PRESETS = load_presets()
DEFAULT_STYLE = PRESETS[0] if PRESETS else {
    "id": "teal_gloss", "name": "Teal Liquid (Reference 🌊)", "category": "reference",
    "layout": "stack", "animation": "pop", "wordsPerCaption": 3, "maxKeys": 1,
    "position": 0.40, "highlightColor": "#22D3C8", "gap": 0.04, "behind": "all",
    "key": role("Montserrat", "Arial", 0.16, "#22D3C8", bold=True),
    "filler": role("Inter", "Arial", 0.06, "#FFFFFF", italic=True),
}

'''
    updated = content[:idx_start] + new_code + content[idx_end:]
    with open(styles_file, "w", encoding="utf-8") as f:
        f.write(updated)
    print("SUCCESS: styles.py updated with 51 presets!")
else:
    print("ERROR: Markers not found in styles.py!")
