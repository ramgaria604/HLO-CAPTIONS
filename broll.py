"""Pexels b-roll: keyword suggestions, search and download."""
import re
from pathlib import Path
from urllib.parse import urlparse

import requests

from styles import STOP, caption_words, _score

SEARCH_URLS = ["https://api.pexels.com/videos/search", "https://api.pexels.com/v1/videos/search"]


def keyword_for(text):
    words = re.findall(r"[A-Za-z][A-Za-z'-]+", text.replace("*", " "))
    ranked = sorted(((_score(w), i, w) for i, w in enumerate(words)), key=lambda x: (-x[0], x[1]))
    picks = [w for sc, _, w in ranked if sc >= 4][:2]
    return " ".join(picks).lower()


def suggest_slots(captions, duration, max_slots=6, min_gap=4.0, length=2.5):
    """Pick spread-out moments that have a strong keyword. Times are on the original video."""
    cands = []
    for c in captions:
        q = keyword_for(c.get("text", ""))
        if q:
            sc = max((_score(t["t"]) for t in caption_words(c)), default=0)
            cands.append((sc, float(c["start"]), q, c.get("text", "").replace("*", "")))
    cands.sort(key=lambda x: -x[0])
    chosen = []
    for sc, start, q, txt in cands:
        if start < 1.0 or start > duration - 1.0:
            continue
        if all(abs(start - c["start"]) >= min_gap for c in chosen):
            chosen.append({"start": round(start, 2), "end": round(min(duration, start + length), 2),
                           "query": q, "text": txt})
        if len(chosen) >= max_slots:
            break
    chosen.sort(key=lambda c: c["start"])
    for i, c in enumerate(chosen):
        c["id"] = i + 1
    return chosen


def pick_file(files, target_w=720):
    mp4 = [f for f in files if str(f.get("file_type", "")).lower() == "video/mp4" and f.get("link")] or \
          [f for f in files if f.get("link")]
    if not mp4:
        return None
    ok = [f for f in mp4 if (f.get("width") or 0) >= min(target_w, 540)]
    pool = ok or mp4
    return min(pool, key=lambda f: abs((f.get("width") or 0) - target_w))


def search(query, key, orientation="portrait", per_page=9):
    if not key:
        raise RuntimeError("Add your free Pexels API key first.")
    params = {"query": query, "per_page": per_page, "orientation": orientation, "size": "medium"}
    last = None
    for url in SEARCH_URLS:
        r = requests.get(url, headers={"Authorization": key}, params=params, timeout=25)
        if r.status_code == 404:
            last = r
            continue
        if r.status_code in (401, 403):
            raise RuntimeError("Pexels says the API key is not valid.")
        if r.status_code == 429:
            raise RuntimeError("Pexels rate limit reached. Wait a while and try again.")
        if r.status_code != 200:
            raise RuntimeError(f"Pexels error {r.status_code}.")
        return parse(r.json())
    raise RuntimeError(f"Pexels search not found ({last.status_code if last else '?'}).")


def parse(data):
    out = []
    for v in data.get("videos", []):
        f = pick_file(v.get("video_files", []))
        if not f:
            continue
        out.append({"id": v.get("id"), "thumb": v.get("image"), "duration": v.get("duration"),
                    "page": v.get("url"), "credit": (v.get("user") or {}).get("name", ""),
                    "url": f["link"], "w": f.get("width"), "h": f.get("height")})
    return out


def allowed_url(url):
    try:
        u = urlparse(url)
    except Exception:
        return False
    return u.scheme == "https" and (u.hostname or "").endswith("pexels.com")


def download(url, dest: Path, max_mb=120):
    if dest.exists() and dest.stat().st_size > 10000:
        return dest
    if not allowed_url(url):
        raise RuntimeError("Only Pexels video links are allowed.")
    tmp = dest.with_suffix(".part")
    size = 0
    with requests.get(url, stream=True, timeout=60) as r:
        if r.status_code != 200:
            raise RuntimeError(f"Could not download b-roll ({r.status_code}).")
        with open(tmp, "wb") as f:
            for chunk in r.iter_content(1024 * 256):
                size += len(chunk)
                if size > max_mb * 1024 * 1024:
                    raise RuntimeError("B-roll clip is too large.")
                f.write(chunk)
    tmp.replace(dest)
    return dest
