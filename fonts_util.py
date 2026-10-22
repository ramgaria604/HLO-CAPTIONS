"""Finds installed fonts and works out the size factor libass (the caption renderer) needs."""
import json
import os
import struct
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent
FONTS_DIR = BASE / "fonts"
CACHE_FILE = BASE / ".fonts_cache.json"
_INDEX = None      # lowercase font name -> file path
_USER_FAMILIES = None
_RATIO_CACHE = {}


def _dirs():
    dirs = [FONTS_DIR]
    if os.name == "nt":
        dirs.append(Path(os.environ.get("WINDIR", r"C:\Windows")) / "Fonts")
        local = os.environ.get("LOCALAPPDATA")
        if local:
            dirs.append(Path(local) / "Microsoft" / "Windows" / "Fonts")
    elif sys.platform == "darwin":
        dirs += [Path("/Library/Fonts"), Path("/System/Library/Fonts"), Path.home() / "Library" / "Fonts"]
    else:
        dirs += [Path("/usr/share/fonts"), Path.home() / ".fonts", Path.home() / ".local" / "share" / "fonts"]
    return [d for d in dirs if d.exists()]


def _scan_user_fonts():
    global _INDEX, _USER_FAMILIES
    from PIL import ImageFont
    if _INDEX is None:
        _INDEX = {}
    user = set(_USER_FAMILIES or [])
    for p in FONTS_DIR.glob("*"):
        if p.suffix.lower() not in (".ttf", ".otf"):
            continue
        try:
            family, style = ImageFont.truetype(str(p), 20).getname()
        except Exception:
            continue
        keys = {family.lower()}
        if style and style.lower() not in ("regular", "normal", "book"):
            keys.add(f"{family} {style}".lower())
        for k in keys:
            _INDEX.setdefault(k, str(p))
        user.add(family)
    _USER_FAMILIES = sorted(user)


def _scan():
    global _INDEX, _USER_FAMILIES
    if CACHE_FILE.exists():
        try:
            data = json.loads(CACHE_FILE.read_text(encoding="utf-8"))
            _INDEX = data.get("index", {})
            _USER_FAMILIES = data.get("user", [])
            _scan_user_fonts()
            return
        except Exception:
            pass

    from PIL import ImageFont
    index, user = {}, set()
    for d in _dirs():
        is_user = d == FONTS_DIR
        for p in (d.rglob("*") if is_user else d.glob("*")):
            if p.suffix.lower() not in (".ttf", ".otf"):
                continue
            try:
                family, style = ImageFont.truetype(str(p), 20).getname()
            except Exception:
                continue
            keys = {family.lower()}
            if style and style.lower() not in ("regular", "normal", "book"):
                keys.add(f"{family} {style}".lower())
            for k in keys:
                index.setdefault(k, str(p))
            if is_user:
                user.add(family)
    _INDEX, _USER_FAMILIES = index, sorted(user)
    try:
        CACHE_FILE.write_text(json.dumps({"index": _INDEX, "user": _USER_FAMILIES}), encoding="utf-8")
    except Exception:
        pass


def font_index():
    if _INDEX is None:
        _scan()
    return _INDEX


def user_families():
    font_index()
    return _USER_FAMILIES


def font_path(name):
    return font_index().get(str(name).lower())


def cell_ratio(path):
    """libass sizes text by (winAscent + winDescent); this returns that divided by unitsPerEm."""
    if not path:
        return 1.25
    if path in _RATIO_CACHE:
        return _RATIO_CACHE[path]
    ratio = 1.25
    try:
        with open(path, "rb") as f:
            data = f.read()
        num = struct.unpack(">H", data[4:6])[0]
        tables = {}
        for i in range(num):
            tag, _, off, _len = struct.unpack(">4sLLL", data[12 + 16 * i: 28 + 16 * i])
            tables[tag] = off
        upem = struct.unpack(">H", data[tables[b"head"] + 18: tables[b"head"] + 20])[0] or 1000
        asc = desc = 0
        if b"OS/2" in tables:
            o = tables[b"OS/2"]
            asc, desc = struct.unpack(">HH", data[o + 74: o + 78])
        if asc + desc == 0 and b"hhea" in tables:
            h = tables[b"hhea"]
            a, d = struct.unpack(">hh", data[h + 4: h + 8])
            asc, desc = a, abs(d)
        if asc + desc > 0:
            ratio = (asc + desc) / upem
    except Exception:
        pass
    _RATIO_CACHE[path] = ratio
    return ratio


def resolve(role):
    """Pick the first installed font from role['font'] then role['fallback'].
    Returns (name_for_ass, size_factor)."""
    for key in ("font", "fallback"):
        name = role.get(key)
        if name and font_path(name):
            return name, cell_ratio(font_path(name))
        # The bundled bold Montserrat file reports its internal family as
        # "Montserrat Thin". Map the requested family to that actual face so
        # FFmpeg exports don't silently fall back to Poppins/Arial.
        if name and str(name).strip().lower() == "montserrat":
            bundled = font_path("Montserrat Thin")
            if bundled:
                return "Montserrat Thin", cell_ratio(bundled)
    name = role.get("fallback") or role.get("font") or "Arial"
    return name, 1.25
