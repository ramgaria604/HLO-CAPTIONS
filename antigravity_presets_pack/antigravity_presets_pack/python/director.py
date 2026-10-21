"""AI scene director: transcript -> list of motion-graphic events (JSON). Works with ANY LLM."""
import json
import re

TYPES = {"kinetic_text", "icon", "lower_third", "counter", "arrow", "sticker", "zoom_punch", "broll"}
POS = {"top", "center", "bottom"}

PROMPT = """You are a motion-graphics director for short vertical videos.
Read the transcript (each line = start second + words). Choose where graphics help the viewer.
Return ONLY valid JSON, no text around it:
{{"graphics":[{{"start":0.0,"end":0.0,"type":"kinetic_text|icon|lower_third|counter|arrow|sticker|zoom_punch|broll","text":"","keyword":"","position":"top|center|bottom"}}]}}
Rules:
- Max 1 graphic per 3 seconds. Each lasts 1.2 to 3 seconds. Total video length is {duration:.1f}s.
- Emphasise numbers (counter), names/titles (lower_third), key claims (kinetic_text with 1-3 words),
  emotions or objects (icon/sticker), important moments (zoom_punch), places or things shown (broll with a 1-3 word English keyword).
- Never use position "center" more than twice in a row; the speaker's face is usually in the middle, prefer top or bottom.
- text: max 3 words. keyword: one English word for icons/b-roll.
Transcript:
{transcript}
"""


def transcript_text(words, per_line=8):
    lines, cur = [], []
    for w in words:
        cur.append(w)
        if len(cur) >= per_line or re.search(r"[.!?]$", w["t"]):
            lines.append(f"[{cur[0]['s']:.1f}] " + " ".join(x["t"] for x in cur)); cur = []
    if cur:
        lines.append(f"[{cur[0]['s']:.1f}] " + " ".join(x["t"] for x in cur))
    return "\n".join(lines)


def validate(raw_events, duration, min_gap=2.5):
    out, last_end = [], -99.0
    for e in sorted((x for x in raw_events if isinstance(x, dict)), key=lambda x: float(x.get("start", 0) or 0)):
        try:
            s, en = float(e["start"]), float(e["end"])
        except Exception:
            continue
        t = e.get("type")
        if t not in TYPES:
            continue
        s, en = max(0.0, s), min(duration, en)
        en = min(en, s + 3.0)
        if en - s < 0.8 or s < last_end - 0.01 + (min_gap - 3.0 if min_gap < 3 else 0) and s < last_end:
            continue
        if s - last_end < 0 or s < last_end:
            continue
        out.append({"start": round(s, 2), "end": round(en, 2), "type": t, "text": str(e.get("text", ""))[:40],
                    "keyword": str(e.get("keyword", ""))[:30],
                    "position": e.get("position") if e.get("position") in POS else "top"})
        last_end = en
    return out


def fallback_plan(words, duration):
    """No LLM available: numbers -> counter, long words -> kinetic text, spaced out."""
    ev, last = [], -99.0
    for w in words:
        t = w["t"].strip(".,!?")
        if w["s"] - last < 3.0 or w["s"] > duration - 1.5:
            continue
        if re.search(r"\d", t):
            ev.append({"start": w["s"], "end": w["s"] + 2.2, "type": "counter", "text": t, "position": "center"})
        elif len(t) >= 8:
            ev.append({"start": w["s"], "end": w["s"] + 1.8, "type": "kinetic_text", "text": t, "position": "top"})
        else:
            continue
        last = w["s"]
    return validate(ev, duration)


def plan_graphics(words, duration, llm_call=None):
    """words=[{'t','s','e'}]; llm_call(prompt:str)->str (your Gemini/Claude/OpenAI call). Falls back safely."""
    if llm_call:
        try:
            raw = llm_call(PROMPT.format(duration=duration, transcript=transcript_text(words)))
            m = re.search(r"\{.*\}", raw, re.S)
            events = validate(json.loads(m.group(0)).get("graphics", []), duration)
            if events:
                return events
        except Exception:
            pass
    return fallback_plan(words, duration)
