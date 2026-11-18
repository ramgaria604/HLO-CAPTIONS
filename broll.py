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


DEFAULT_COVERR_KEY = "18ba66e400506eb19feea5b6d1eff495"


def search_coverr(query, key=None, orientation="portrait", per_page=12):
    k = key or DEFAULT_COVERR_KEY
    headers = {
        "Authorization": f"Bearer {k}",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    params = {
        "query": query,
        "urls": "true",
        "page_size": per_page
    }
    r = requests.get("https://api.coverr.co/videos", headers=headers, params=params, timeout=20)
    if r.status_code == 401:
        raise RuntimeError("Coverr says the API key is not valid.")
    if r.status_code != 200:
        raise RuntimeError(f"Coverr API error {r.status_code}.")
    data = r.json()
    out = []
    for v in data.get("hits", []):
        urls = v.get("urls") or {}
        mp4_link = urls.get("mp4") or urls.get("mp4_download")
        if not mp4_link:
            base_fn = v.get("base_filename")
            if base_fn:
                mp4_link = f"https://cdn.coverr.co/videos/{base_fn}/1080p.mp4"
        if not mp4_link:
            continue

        dur_val = 0.0
        try:
            dur_val = round(float(v.get("duration", 0)), 1)
        except (TypeError, ValueError):
            pass

        out.append({
            "id": v.get("id") or v.get("video_id") or v.get("objectID"),
            "thumb": v.get("thumbnail") or v.get("poster") or "",
            "duration": dur_val,
            "page": f"https://coverr.co/videos/{v.get('slug', '')}",
            "credit": (v.get("contributor") or {}).get("fullname") or "Coverr",
            "url": mp4_link,
            "w": v.get("max_width", 1920),
            "h": v.get("max_height", 1080),
            "provider": "coverr"
        })
    return out


def search(query, key=None, orientation="portrait", per_page=9, provider="auto"):
    # If explicit Coverr key or provider is coverr, use Coverr
    if provider == "coverr" or (key and len(key) == 32):
        return search_coverr(query, key or DEFAULT_COVERR_KEY, orientation, per_page)

    # If valid 56-char Pexels key is provided, try Pexels first
    if key and len(key) > 40:
        try:
            params = {"query": query, "per_page": per_page, "orientation": orientation, "size": "medium"}
            for url in SEARCH_URLS:
                r = requests.get(url, headers={"Authorization": key}, params=params, timeout=20)
                if r.status_code == 200:
                    return parse(r.json())
        except Exception:
            pass

    # Seamless fallback to Coverr with active key!
    return search_coverr(query, DEFAULT_COVERR_KEY, orientation, per_page)


def parse(data):
    out = []
    for v in data.get("videos", []):
        f = pick_file(v.get("video_files", []))
        if not f:
            continue
        out.append({"id": v.get("id"), "thumb": v.get("image"), "duration": v.get("duration"),
                    "page": v.get("url"), "credit": (v.get("user") or {}).get("name", ""),
                    "url": f["link"], "w": f.get("width"), "h": f.get("height"),
                    "provider": "pexels"})
    return out


def allowed_url(url):
    try:
        u = urlparse(url)
    except Exception:
        return False
    host = (u.hostname or "").lower()
    return u.scheme in ("http", "https") and (
        host.endswith("pexels.com") or
        host.endswith("coverr.co") or
        host.endswith("mux.com")
    )


def download(url, dest: Path, max_mb=120):
    if dest.exists() and dest.stat().st_size > 10000:
        return dest
    if not allowed_url(url):
        raise RuntimeError("Only Pexels or Coverr video links are allowed.")
    tmp = dest.with_suffix(".part")
    size = 0
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    with requests.get(url, headers=headers, stream=True, timeout=60) as r:
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
