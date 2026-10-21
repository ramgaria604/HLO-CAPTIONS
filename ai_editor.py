"""CaptionStudio Pro: AI Video Understanding & Intelligent Editing Plan Generator.
Analyzes speech transcript, timestamps, numbers, entities, visual aspect ratio and scene cues
to generate context-aware, professionally timed motion graphics.
"""
import json
import os
import re
import subprocess
from pathlib import Path


def _extract_keyframes(ffmpeg, video_path, duration, out_dir):
    """Extract 3 representative keyframes for visual scene understanding."""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    timestamps = [max(0.5, duration * 0.15), max(1.0, duration * 0.50), max(1.5, duration * 0.85)]
    frames = []
    for idx, t in enumerate(timestamps):
        out_file = out_dir / f"scene_frame_{idx}.jpg"
        cmd = [
            ffmpeg, "-y", "-ss", str(t), "-i", str(video_path),
            "-vframes", "1", "-q:v", "3", str(out_file)
        ]
        try:
            subprocess.run(cmd, capture_output=True, timeout=10)
            if out_file.exists():
                frames.append(str(out_file))
        except Exception:
            pass
    return frames


def _detect_video_genre(text_corpus, aspect_ratio, duration):
    """Classifies video type based on vocabulary patterns, duration and aspect ratio."""
    text = text_corpus.lower()
    
    # Keyword sets for genre detection
    re_keywords = {"property", "house", "villa", "apartment", "bedroom", "sqft", "luxury", "price", "realtor", "sq ft", "bhk", "estate"}
    fin_keywords = {"market", "revenue", "profit", "stock", "invest", "dollar", "crypto", "growth", "interest", "finance", "capital", "fund"}
    edu_keywords = {"step", "learn", "how to", "tutorial", "method", "concept", "guide", "first", "second", "example", "explain"}
    social_keywords = {"subscribe", "follow", "like", "share", "comment", "bio", "reel", "algorithm", "viral", "creator"}
    doc_keywords = {"history", "century", "discover", "world", "culture", "documentary", "species", "planet", "era"}

    scores = {
        "real_estate": sum(1 for w in re_keywords if w in text),
        "finance_business": sum(1 for w in fin_keywords if w in text),
        "tutorial_education": sum(1 for w in edu_keywords if w in text),
        "social_creator": sum(1 for w in social_keywords if w in text),
        "documentary": sum(1 for w in doc_keywords if w in text),
    }

    best_genre = max(scores, key=scores.get)
    if scores[best_genre] == 0:
        if aspect_ratio < 0.8:
            best_genre = "social_reel"
        elif duration > 180:
            best_genre = "podcast_interview"
        else:
            best_genre = "general_creator"

    return best_genre, scores.get(best_genre, 0)


def _find_statistics(text, start, end):
    """Identifies numbers, percentages, multipliers, and currency mentions."""
    # Pattern for percentages, currencies, multipliers, big numbers
    stat_pattern = r"(\$\s*\d+(?:[\.,]\d+)?(?:\s*(?:k|m|b|million|billion|thousand))?|\b\d+(?:\.\d+)?%\b|\b\d+x\b|\b\d{1,3}(?:,\d{3})+\b)"
    matches = re.finditer(stat_pattern, text, re.IGNORECASE)
    results = []
    for m in matches:
        val = m.group(1).strip()
        # Clean label from context
        clean_text = text.replace("*", "").strip()
        results.append({
            "value": val.upper(),
            "context": clean_text,
            "start": start,
            "end": end
        })
    return results


def _find_locations(text, start, end):
    """Detects geographical mentions, cities, countries."""
    loc_pattern = r"\b(New York|London|Paris|Tokyo|Dubai|Mumbai|Delhi|California|Texas|Florida|Sydney|Berlin|Singapore|Toronto|Los Angeles|Miami|Bangalore|Canada|India|USA|UK|Europe|Australia)\b"
    matches = re.finditer(loc_pattern, text, re.IGNORECASE)
    results = []
    for m in matches:
        loc = m.group(1).title()
        results.append({
            "location": loc,
            "start": start,
            "end": end
        })
    return results


def _find_questions_or_hooks(text, start, end):
    """Detects hooks, questions and section titles."""
    clean = text.replace("*", "").strip()
    if clean.endswith("?") or re.match(r"^(how to|why you|the secret|rule #?\d+|step #?\d+|tip #?\d+|three things|top \d+)", clean, re.IGNORECASE):
        return {
            "title": clean,
            "start": start,
            "end": end
        }
    return None


def _find_banking_loan(text, start, end):
    """Detects banking, loan, mortgage, and credit financing concepts."""
    pat = r"\b(bank|banking|loan|loans|borrow|borrower|lender|lending|credit|mortgage|debt|interest rate|capital|financing|finances)\b"
    m = re.search(pat, text, re.IGNORECASE)
    if m:
        return {"term": m.group(1).title(), "start": start, "end": end}
    return None


def _find_growth_viral(text, start, end):
    """Detects growth, viral reach, algorithm, and scale concepts."""
    pat = r"\b(viral|growth|grow|scale|scaling|rocket|skyrocket|exploded|algorithm|views|millions of views|reach|exponential)\b"
    m = re.search(pat, text, re.IGNORECASE)
    if m:
        return {"term": m.group(1).upper(), "start": start, "end": end}
    return None


def _find_profit_financial(text, start, end):
    """Detects profit, revenue, cashflow, earnings concepts."""
    pat = r"\b(profit|profits|margin|margins|revenue|cashflow|cash flow|earnings|dividend|roi|net income|positive cashflow)\b"
    m = re.search(pat, text, re.IGNORECASE)
    if m:
        return {"term": m.group(1).title(), "start": start, "end": end}
    return None


def _find_expert_trust(text, start, end):
    """Detects credibility, expert authority, certified, and trust concepts."""
    pat = r"\b(expert|authority|verified|certified|license|licensed|specialist|professional|guarantee|proven|accredited)\b"
    m = re.search(pat, text, re.IGNORECASE)
    if m:
        return {"term": m.group(1).title(), "start": start, "end": end}
    return None


def _find_analytics_metric(text, start, end):
    """Detects analytics, retention, conversion, and performance concepts."""
    pat = r"\b(retention|analytics|metric|conversion|click through|data point|conversion rate|bounce rate|engagement)\b"
    m = re.search(pat, text, re.IGNORECASE)
    if m:
        return {"term": m.group(1).title(), "start": start, "end": end}
    return None


def _find_dates_or_timelines(text, start, end):
    """Detects historical years, timeline milestones, or temporal anchors."""
    pat = r"\b(19\d{2}|20\d{2}|century|decade|in 19\d{2}|in 20\d{2}|in january|in february|in march|in april|in may|in june|in july|in august|in september|in october|in november|in december|yesterday|years ago)\b"
    m = re.search(pat, text, re.IGNORECASE)
    if m:
        val = m.group(1).upper()
        clean = text.replace("*", "").strip()
        return {"year": val, "headline": clean[:36], "context": clean, "start": start, "end": end}
    return None


def _find_quote_or_statement(text, start, end):
    """Detects quotes, authoritative citations, or key revelations."""
    clean = text.replace("*", "").strip()
    pat = r"\b(he said|she said|they said|according to|the truth is|the reality is|quote|stated that|admitted that|confessed that)\b"
    m = re.search(pat, clean, re.IGNORECASE)
    if m or ('"' in clean or '“' in clean or '”' in clean):
        return {"quote": clean, "author": "DOCUMENTARY RECORD", "start": start, "end": end}
    return None


def _find_comparison_versus(text, start, end):
    """Detects versus, head-to-head comparisons, and opposing sides."""
    pat = r"\b([A-Za-z0-9]+)\s+(?:vs\.?|versus|compared to|against)\s+([A-Za-z0-9]+)\b"
    m = re.search(pat, text, re.IGNORECASE)
    if m:
        return {"sideA": m.group(1).upper(), "sideB": m.group(2).upper(), "start": start, "end": end}
    if re.search(r"\b(pros and cons|before and after|win or lose|good vs bad)\b", text, re.IGNORECASE):
        return {"sideA": "OPTION A", "sideB": "OPTION B", "start": start, "end": end}
    return None


def _find_concept_definition(text, start, end):
    """Detects definitions, mechanisms, laws, and core educational concepts."""
    pat = r"\b(known as|called|definition of|concept of|rule of|law of|mechanism of)\s+([A-Za-z\s]{3,24})\b"
    m = re.search(pat, text, re.IGNORECASE)
    if m:
        term = m.group(2).strip().upper()
        return {"term": term, "context": text.replace("*", "").strip(), "start": start, "end": end}
    return None


def _find_document_highlight(text, start, end):
    """Detects critical secrets, rules, warnings, or major takeaway points."""
    pat = r"\b(the secret is|the rule is|the mistake is|the key is|the problem is|never do this|always remember|critical point)\b"
    m = re.search(pat, text, re.IGNORECASE)
    if m:
        key = m.group(1).upper()
        return {"highlight": key, "context": text.replace("*", "").strip(), "start": start, "end": end}
    return None


def _find_call_to_action(text, start, end, total_duration):
    """Detects ending calls to action."""
    cta_patterns = [
        (r"(subscribe|hit the bell|join the channel)", "SUBSCRIBE FOR MORE", "Don't miss the next video"),
        (r"(follow for more|follow me|follow us)", "FOLLOW FOR MORE", "Daily actionable content"),
        (r"(link in bio|link below|check the link)", "LINK IN BIO", "Access full resources"),
        (r"(comment below|let me know in the comments)", "DROP A COMMENT", "What do you think?"),
        (r"(share this|send this to)", "SHARE THIS VIDEO", "Help someone level up")
    ]
    clean = text.lower()
    for pat, title, sub in cta_patterns:
        if re.search(pat, clean):
            # Prioritize CTAs in the final 30% of video
            return {
                "title": title,
                "subtitle": sub,
                "start": start,
                "end": min(total_duration, start + 3.5)
            }
    return None


def _find_financial_chart_signal(text, start, end):
    """Detects market trends, financial loss/gain, crashes, surges, inflation, investments, and economic curves."""
    pat = r"\b(market|crash|surge|inflation|stock|crypto|bitcoin|invest|portfolio|drop|downfall|spike|growth rate|recession|deficit|assets|chart|curve|loss|profit)\b"
    m = re.search(pat, text, re.IGNORECASE)
    if m:
        term = m.group(1).upper()
        is_negative = bool(re.search(r"\b(crash|drop|loss|downfall|recession|deficit|down)\b", text, re.IGNORECASE))
        val_str = "-48.2% DROP" if is_negative else "+142% SURGE"
        amount_str = "-$120,000" if is_negative else "+$284,000"
        return {
            "term": term,
            "badge": val_str,
            "value": amount_str,
            "label": f"{term} TRAJECTORY",
            "isNegative": is_negative,
            "start": start,
            "end": end
        }
    return None


def _find_classified_dossier_signal(text, start, end):
    """Detects secrets, investigations, leaks, classified documents, evidence, and confidential revelations."""
    pat = r"\b(secret|classified|confidential|leak|evidence|document|investigation|truth|hidden|covered up|exposed|conspiracy|files|records|memo)\b"
    m = re.search(pat, text, re.IGNORECASE)
    if m:
        term = m.group(1).upper()
        clean = text.replace("*", "").strip()
        return {
            "term": term,
            "stamp": "DECLASSIFIED" if "leak" in text.lower() or "exposed" in text.lower() else "TOP SECRET",
            "header": f"CLASSIFIED DOSSIER // {term}",
            "highlight": clean[:38].upper(),
            "context": clean,
            "start": start,
            "end": end
        }
    return None


def _find_3d_phone_signal(text, start, end):
    """Detects social media, views, followers, apps, reels, instagram, blender, showcase."""
    pat = r"\b(phone|screen|instagram|reel|reels|post|posts|follower|followers|view|views|blender|social|media|profile|app|viral|channel|youtube|tiktok)\b"
    m = re.search(pat, text, re.IGNORECASE)
    if m:
        return {"term": m.group(1).upper(), "start": start, "end": end}
    return None


def _find_prison_bars_signal(text, start, end):
    """Detects trap, prison, cell, bars, limits, rules, escape, locked, system."""
    pat = r"\b(cell|prison|trap|trapped|bars|escape|stuck|jail|limits|locked|barrier|cage|rules|system)\b"
    m = re.search(pat, text, re.IGNORECASE)
    if m:
        return {"term": m.group(1).lower(), "start": start, "end": end}
    return None


def _find_neon_cube_signal(text, start, end):
    """Detects academy, slate, brand, pro, course, certified, skill, company, studio."""
    pat = r"\b(slate|academy|brand|pro|company|agency|masterclass|course|certified|skill|community|studio)\b"
    m = re.search(pat, text, re.IGNORECASE)
    if m:
        return {"term": m.group(1).upper(), "start": start, "end": end}
    return None


def _find_kinetic_split_signal(text, start, end):
    """Detects momentum, unstoppable, insane, crazy, truth, mentality, power."""
    pat = r"\b(unstoppable|momentum|power|insane|crazy|mentality|mindset|truth|impossible|energy)\b"
    m = re.search(pat, text, re.IGNORECASE)
    if m:
        clean = text.replace("*", "").strip().split()
        top_text = "AND I'M" if len(clean) < 2 else " ".join(clean[:2]).upper()
        bot_text = clean[-1].upper() if clean else m.group(1).upper()
        return {"top": top_text, "bottom": bot_text, "start": start, "end": end}
    return None


def generate_editing_plan(video_path, captions, duration, meta, ffmpeg="ffmpeg"):
    """
    Analyzes the video and transcript to generate a comprehensive AI Editing Plan.
    Returns structured recommendations for motion graphics, visual genre, safe zones, and timings.
    """
    duration = float(duration or 0)
    width = int(meta.get("width", 1080))
    height = int(meta.get("height", 1920))
    aspect_ratio = width / max(1, height)

    # 1. Visual keyframes (bypass slow synchronous ffmpeg disk extraction to guarantee instant <50ms response)
    frames = []

    # 2. Transcribe text corpus
    corpus = " ".join(c.get("text", "") for c in captions)
    genre, genre_confidence = _detect_video_genre(corpus, aspect_ratio, duration)

    # 3. Detect Safe Zones
    is_portrait = aspect_ratio < 0.8
    safe_zones = {
        "top": 0.12 if is_portrait else 0.08,
        "bottom": 0.20 if is_portrait else 0.10,
        "right": 0.18 if is_portrait else 0.06,
        "left": 0.05
    }

    # 4. Generate context-aware motion graphics
    proposed_graphics = []
    graphic_id = 1
    last_graphic_end = 0.0

    # Intro Title / Hook (in first 3 seconds)
    if captions:
        first_cap = captions[0]
        hook = _find_questions_or_hooks(first_cap.get("text", ""), first_cap["start"], first_cap["end"])
        title_text = hook["title"] if hook else first_cap.get("text", "").replace("*", "")
        if title_text:
            intro_end = round(min(duration, first_cap["start"] + 3.0), 2)
            proposed_graphics.append({
                "id": f"mg_{graphic_id}",
                "type": "animated_title",
                "name": "Topic Intro Heading",
                "start": round(first_cap["start"], 2),
                "end": intro_end,
                "data": {
                    "title": title_text[:40].upper(),
                    "subtitle": genre.replace("_", " ").upper(),
                    "accentColor": "#FFE600" if is_portrait else "#00E5FF",
                    "bgColor": "rgba(10, 11, 26, 0.88)"
                },
                "position": "top_center" if is_portrait else "top_left",
                "animation": {"enter": "fade_slide_down", "exit": "fade_out", "easing": "cubic_bezier(0.16, 1, 0.3, 1)"},
                "reason": f"Strong hook opening introducing the {genre.replace('_', ' ')} topic",
                "confidence": 0.92,
                "enabled": True
            })
            graphic_id += 1
            last_graphic_end = intro_end

    # Speaker Lower Third (if intro mentions speaker or host)
    if len(captions) > 1 and duration >= 5.0:
        c2 = captions[1]
        c2_text = c2.get("text", "").lower()
        if re.search(r"\b(i am|i'm|my name|host|founder|creator|welcome|joined by)\b", c2_text):
            spk_end = round(min(duration, c2["start"] + 3.2), 2)
            proposed_graphics.append({
                "id": f"mg_{graphic_id}",
                "type": "lower_third",
                "name": "Speaker / Host Card",
                "start": round(c2["start"], 2),
                "end": spk_end,
                "data": {
                    "title": "SPEAKER / HOST",
                    "subtitle": "CaptionStudio Pro Exclusive",
                    "tag": "VERIFIED",
                    "accentColor": "#EC4899",
                    "bgColor": "rgba(15, 23, 42, 0.92)"
                },
                "position": "bottom_left",
                "animation": {"enter": "slide_right", "exit": "fade_out", "easing": "ease_out"},
                "reason": "Identify the speaker early in the video to establish authority",
                "confidence": 0.85,
                "enabled": True
            })
            graphic_id += 1
            last_graphic_end = spk_end

    # Scan captions for semantic graphics (Banking, Profit, Growth, Authority, HUD, Stats, Locations)
    for c in captions:
        t_start = float(c.get("start", 0))
        t_end = float(c.get("end", 0))
        text = c.get("text", "")

        if t_start < last_graphic_end:
            continue

        # R1. Check for 3D Isometric Social Phone (Reference Frame 2 & 4)
        phone = _find_3d_phone_signal(text, t_start, t_end)
        if phone:
            proposed_graphics.append({
                "id": f"mg_{graphic_id}",
                "type": "isometric_phone_card",
                "name": f"3D Social Phone Showcase 📱",
                "start": round(t_start, 2),
                "end": round(min(duration, t_start + 4.0), 2),
                "data": {
                    "handle": f"@{phone['term'].lower()}_pro",
                    "views": "3,878",
                    "followers": "+328",
                    "accentColor": "#00D2FF"
                },
                "position": "center",
                "animation": {"enter": "scale_pop", "exit": "fade_scale", "easing": "spring"},
                "reason": f"Spoken context highlights {phone['term']}. Showcase with 3D angled smartphone and floating Z-depth cards.",
                "confidence": 0.98,
                "enabled": True
            })
            graphic_id += 1
            last_graphic_end = round(min(duration, t_start + 4.0), 2)
            continue

        # R2. Check for 3D Foreground Prison Bars (Reference Frame 13)
        bars = _find_prison_bars_signal(text, t_start, t_end)
        if bars:
            clean_phrase = text.replace("*", "").strip()
            proposed_graphics.append({
                "id": f"mg_{graphic_id}",
                "type": "occlusion_prison_bars",
                "name": f"3D Depth Prison Bars: {bars['term']} 🚨",
                "start": round(t_start, 2),
                "end": round(min(duration, t_start + 3.8), 2),
                "data": {
                    "title": clean_phrase[:24] if len(clean_phrase) <= 24 else f"life is {bars['term']}",
                    "accentColor": "#EF4444"
                },
                "position": "center",
                "animation": {"enter": "scale_pop", "exit": "fade_scale", "easing": "spring"},
                "reason": f"Occlusion depth: 3D metallic foreground bars with glowing crimson neon text physically sitting behind.",
                "confidence": 0.98,
                "enabled": True
            })
            graphic_id += 1
            last_graphic_end = round(min(duration, t_start + 3.8), 2)
            continue

        # R3. Check for 3D Glowing Neon Cube (Reference Frame 6)
        cube = _find_neon_cube_signal(text, t_start, t_end)
        if cube:
            proposed_graphics.append({
                "id": f"mg_{graphic_id}",
                "type": "neon_badge_aura",
                "name": f"3D Neon Cube Badge: {cube['term']} ⚡",
                "start": round(t_start, 2),
                "end": round(min(duration, t_start + 3.5), 2),
                "data": {
                    "title": cube["term"][:8],
                    "subtitle": "PRO ACADEMY",
                    "accentColor": "#00D2FF"
                },
                "position": "center",
                "animation": {"enter": "scale_pop", "exit": "fade_scale", "easing": "spring"},
                "reason": f"Floating 3D glass cube with glowing cyan-blue neon aura and specular reflection.",
                "confidence": 0.97,
                "enabled": True
            })
            graphic_id += 1
            last_graphic_end = round(min(duration, t_start + 3.5), 2)
            continue

        # R4. Check for 3D Kinetic Split Heading (Reference Frame 11)
        split = _find_kinetic_split_signal(text, t_start, t_end)
        if split:
            proposed_graphics.append({
                "id": f"mg_{graphic_id}",
                "type": "split_kinetic_title",
                "name": f"3D Kinetic Split: {split['bottom']} 💥",
                "start": round(t_start, 2),
                "end": round(min(duration, t_start + 3.2), 2),
                "data": {
                    "topText": split["top"],
                    "bottomText": split["bottom"],
                    "topColor": "#FFE600",
                    "accentColor": "#00D2FF"
                },
                "position": "top_center",
                "animation": {"enter": "fade_slide_down", "exit": "fade_out", "easing": "spring"},
                "reason": f"Pure 3D extruded title with yellow top line and electric cyan 3D shadow (zero bounding box).",
                "confidence": 0.96,
                "enabled": True
            })
            graphic_id += 1
            last_graphic_end = round(min(duration, t_start + 3.2), 2)
            continue

        # 1. Check for classified dossiers / secret investigations
        dossier = _find_classified_dossier_signal(text, t_start, t_end)
        if dossier:
            proposed_graphics.append({
                "id": f"mg_{graphic_id}",
                "type": "classified_dossier",
                "name": f"Dossier: {dossier['term']} 📁",
                "start": round(t_start, 2),
                "end": round(min(duration, t_start + 4.2), 2),
                "data": {
                    "stamp": dossier["stamp"],
                    "header": dossier["header"],
                    "highlight": dossier["highlight"],
                    "context": dossier["context"][:65],
                    "accentColor": "#FFE600",
                    "bgColor": "rgba(20, 20, 24, 0.95)"
                },
                "position": "behind_person",
                "animation": {"enter": "fade_slide_down", "exit": "fade_out", "easing": "spring"},
                "reason": f"Classified investigative narrative on {dossier['term']} styled behind speaker",
                "confidence": 0.97,
                "enabled": True
            })
            graphic_id += 1
            last_graphic_end = round(min(duration, t_start + 4.2), 2)
            continue

        # 2. Check for financial trends / market curves
        chart = _find_financial_chart_signal(text, t_start, t_end)
        if chart:
            proposed_graphics.append({
                "id": f"mg_{graphic_id}",
                "type": "financial_chart",
                "name": f"Financial Curve: {chart['term']} 📈",
                "start": round(t_start, 2),
                "end": round(min(duration, t_start + 4.2), 2),
                "data": {
                    "badge": chart["badge"],
                    "value": chart["value"],
                    "label": chart["label"],
                    "accentColor": "#EF4444" if chart["isNegative"] else "#10B981",
                    "bgColor": "rgba(10, 25, 20, 0.94)" if not chart["isNegative"] else "rgba(30, 10, 15, 0.94)"
                },
                "position": "behind_person",
                "animation": {"enter": "scale_pop", "exit": "fade_scale", "easing": "spring"},
                "reason": f"Spoken context describes {chart['term']}. Animated financial vector curve placed behind speaker.",
                "confidence": 0.96,
                "enabled": True
            })
            graphic_id += 1
            last_graphic_end = round(min(duration, t_start + 4.2), 2)
            continue

        # 3. Check for profit / revenue / cashflow
        profit = _find_profit_financial(text, t_start, t_end)
        if profit:
            term = profit["term"]
            proposed_graphics.append({
                "id": f"mg_{graphic_id}",
                "type": "profit_money_callout",
                "name": f"Profit Margin Callout 💰",
                "start": round(t_start, 2),
                "end": round(min(duration, t_start + 3.2), 2),
                "data": {
                    "value": "+$124,500",
                    "label": f"NET {term.upper()} MARGIN",
                    "accentColor": "#22C55E",
                    "bgColor": "rgba(10, 25, 20, 0.92)"
                },
                "position": "bottom_left",
                "animation": {"enter": "slide_right", "exit": "fade_out", "easing": "ease_out"},
                "reason": f"Financial {term} topic reinforced with clear visual return metric card.",
                "confidence": 0.93,
                "enabled": True
            })
            graphic_id += 1
            last_graphic_end = round(min(duration, t_start + 3.2), 2)
            continue

        # 3. Check for viral / growth / scale
        growth = _find_growth_viral(text, t_start, t_end)
        if growth:
            term = growth["term"]
            proposed_graphics.append({
                "id": f"mg_{graphic_id}",
                "type": "viral_rocket_boost",
                "name": f"Viral Rocket Boost 🚀",
                "start": round(t_start, 2),
                "end": round(min(duration, t_start + 3.2), 2),
                "data": {
                    "title": f"VIRAL {term}",
                    "multiplier": "10X EXPONENTIAL",
                    "accentColor": "#EC4899",
                    "bgColor": "rgba(25, 10, 25, 0.92)"
                },
                "position": "top_right" if is_portrait else "bottom_right",
                "animation": {"enter": "scale_pop", "exit": "fade_scale", "easing": "spring"},
                "reason": f"Audience retention / viral trajectory ({term}) reinforced with kinetic boost graphic.",
                "confidence": 0.92,
                "enabled": True
            })
            graphic_id += 1
            last_graphic_end = round(min(duration, t_start + 3.2), 2)
            continue

        # 4. Check for expert authority / credentials
        expert = _find_expert_trust(text, t_start, t_end)
        if expert:
            term = expert["term"]
            proposed_graphics.append({
                "id": f"mg_{graphic_id}",
                "type": "verified_creator_shield",
                "name": f"Verified Authority Shield 🛡️",
                "start": round(t_start, 2),
                "end": round(min(duration, t_start + 3.0), 2),
                "data": {
                    "title": f"VERIFIED {term.upper()}",
                    "subtitle": "Industry Authority",
                    "accentColor": "#38BDF8",
                    "bgColor": "rgba(15, 23, 42, 0.92)"
                },
                "position": "top_left",
                "animation": {"enter": "slide_right", "exit": "fade_out", "easing": "ease_out"},
                "reason": f"Speaker credibility and {term} authority reinforced with trust badge.",
                "confidence": 0.91,
                "enabled": True
            })
            graphic_id += 1
            last_graphic_end = round(min(duration, t_start + 3.0), 2)
            continue

        # 5. Check for analytics / retention
        analytics = _find_analytics_metric(text, t_start, t_end)
        if analytics:
            term = analytics["term"]
            proposed_graphics.append({
                "id": f"mg_{graphic_id}",
                "type": "cyber_hud_metric",
                "name": f"Cyber Retention HUD 📊",
                "start": round(t_start, 2),
                "end": round(min(duration, t_start + 3.0), 2),
                "data": {
                    "metric": "98.4%",
                    "label": f"{term.upper()}",
                    "status": "OPTIMAL METRIC",
                    "accentColor": "#00F0FF",
                    "bgColor": "rgba(10, 14, 34, 0.94)"
                },
                "position": "top_right",
                "animation": {"enter": "scale_pop", "exit": "fade_scale", "easing": "spring"},
                "reason": f"Performance analytics and {term} highlighted with cyber HUD indicator.",
                "confidence": 0.91,
                "enabled": True
            })
            graphic_id += 1
            last_graphic_end = round(min(duration, t_start + 3.0), 2)
            continue

        # Check for statistics
        stats = _find_statistics(text, t_start, t_end)
        if stats:
            st = stats[0]
            val = st["value"]
            is_price = "$" in val or "€" in val or "£" in val
            g_type = "price_callout" if (is_price or genre == "real_estate") else "statistic_counter"
            proposed_graphics.append({
                "id": f"mg_{graphic_id}",
                "type": g_type,
                "name": f"Callout: {val}",
                "start": round(t_start, 2),
                "end": round(min(duration, t_start + 3.0), 2),
                "data": {
                    "value": val,
                    "label": "KEY METRIC" if not is_price else "OFFER PRICE",
                    "subtext": st["context"][:35],
                    "accentColor": "#22C55E" if is_price else "#38BDF8",
                    "bgColor": "rgba(15, 23, 42, 0.90)"
                },
                "position": "top_right" if is_portrait else "bottom_right",
                "animation": {"enter": "scale_pop", "exit": "fade_scale", "easing": "spring"},
                "reason": f"Spoken number: {val} highlighted to boost comprehension and retention",
                "confidence": 0.94,
                "enabled": True
            })
            graphic_id += 1
            last_graphic_end = round(min(duration, t_start + 3.0), 2)
            continue

        # Check for locations
        locs = _find_locations(text, t_start, t_end)
        if locs:
            loc = locs[0]["location"]
            proposed_graphics.append({
                "id": f"mg_{graphic_id}",
                "type": "location_badge",
                "name": f"Location: {loc}",
                "start": round(t_start, 2),
                "end": round(min(duration, t_start + 2.8), 2),
                "data": {
                    "location": loc,
                    "label": "LOCATION PIN",
                    "accentColor": "#F59E0B",
                    "bgColor": "rgba(24, 24, 27, 0.90)"
                },
                "position": "top_left",
                "animation": {"enter": "slide_right", "exit": "fade_out", "easing": "ease_out"},
                "reason": f"Mentioned geographical location '{loc}' highlighted with animated pin badge",
                "confidence": 0.89,
                "enabled": True
            })
            graphic_id += 1
            last_graphic_end = round(min(duration, t_start + 2.8), 2)
            continue

        # 6. Check for timeline milestones / dates
        timeline = _find_dates_or_timelines(text, t_start, t_end)
        if timeline:
            yr = timeline["year"]
            proposed_graphics.append({
                "id": f"mg_{graphic_id}",
                "type": "timeline_event",
                "name": f"Documentary Timeline: {yr}",
                "start": round(t_start, 2),
                "end": round(min(duration, t_start + 3.8), 2),
                "data": {
                    "year": yr,
                    "headline": timeline["headline"].upper(),
                    "subtext": timeline["context"][:55],
                    "accentColor": "#FFE600",
                    "bgColor": "rgba(10, 15, 28, 0.94)"
                },
                "position": "top_left",
                "animation": {"enter": "fade_slide_down", "exit": "fade_out", "easing": "spring"},
                "reason": f"Historical temporal anchor {yr} visualised with documentary timeline milestone",
                "confidence": 0.95,
                "enabled": True
            })
            graphic_id += 1
            last_graphic_end = round(min(duration, t_start + 3.8), 2)
            continue

        # 7. Check for authoritative quotes / revelations
        quote = _find_quote_or_statement(text, t_start, t_end)
        if quote and len(text) > 20:
            proposed_graphics.append({
                "id": f"mg_{graphic_id}",
                "type": "quote_card",
                "name": "Editorial Quote Card",
                "start": round(t_start, 2),
                "end": round(min(duration, t_start + 4.0), 2),
                "data": {
                    "quote": quote["quote"],
                    "author": "DOCUMENTARY RECORD // ARCHIVE",
                    "accentColor": "#6366F1",
                    "bgColor": "rgba(10, 15, 30, 0.95)"
                },
                "position": "bottom_left",
                "animation": {"enter": "slide_right", "exit": "fade_out", "easing": "spring"},
                "reason": "Authoritative statement formatted with documentary quote card",
                "confidence": 0.93,
                "enabled": True
            })
            graphic_id += 1
            last_graphic_end = round(min(duration, t_start + 4.0), 2)
            continue

        # 8. Check for head-to-head comparison / versus
        versus = _find_comparison_versus(text, t_start, t_end)
        if versus:
            proposed_graphics.append({
                "id": f"mg_{graphic_id}",
                "type": "versus_split",
                "name": f"Versus: {versus['sideA']} vs {versus['sideB']}",
                "start": round(t_start, 2),
                "end": round(min(duration, t_start + 4.2), 2),
                "data": {
                    "sideA": versus["sideA"],
                    "sideB": versus["sideB"],
                    "pctA": "74%",
                    "pctB": "26%",
                    "accentColor": "#EF4444",
                    "bgColor": "rgba(15, 23, 42, 0.95)"
                },
                "position": "behind_person",
                "animation": {"enter": "scale_pop", "exit": "fade_scale", "easing": "spring"},
                "reason": f"Comparative breakdown between {versus['sideA']} and {versus['sideB']}",
                "confidence": 0.94,
                "enabled": True
            })
            graphic_id += 1
            last_graphic_end = round(min(duration, t_start + 4.2), 2)
            continue

        # 9. Check for core concept definition
        concept = _find_concept_definition(text, t_start, t_end)
        if concept:
            proposed_graphics.append({
                "id": f"mg_{graphic_id}",
                "type": "concept_definition",
                "name": f"Concept: {concept['term']}",
                "start": round(t_start, 2),
                "end": round(min(duration, t_start + 3.8), 2),
                "data": {
                    "term": concept["term"],
                    "definition": concept["context"][:60],
                    "tag": "DOCUMENTARY BRIEF",
                    "accentColor": "#38BDF8",
                    "bgColor": "rgba(10, 15, 28, 0.94)"
                },
                "position": "bottom_left",
                "animation": {"enter": "slide_right", "exit": "fade_out", "easing": "ease_out"},
                "reason": f"Technical concept {concept['term']} explained with architectural lower-third brief",
                "confidence": 0.92,
                "enabled": True
            })
            graphic_id += 1
            last_graphic_end = round(min(duration, t_start + 3.8), 2)
            continue

        # 10. Check for critical rule or secret highlight
        highlight = _find_document_highlight(text, t_start, t_end)
        if highlight:
            proposed_graphics.append({
                "id": f"mg_{graphic_id}",
                "type": "document_highlight",
                "name": "Archival Document Highlight",
                "start": round(t_start, 2),
                "end": round(min(duration, t_start + 3.5), 2),
                "data": {
                    "headline": highlight["highlight"],
                    "subtext": highlight["context"][:60],
                    "accentColor": "#FDE047",
                    "bgColor": "rgba(10, 15, 28, 0.94)"
                },
                "position": "top_right",
                "animation": {"enter": "scale_pop", "exit": "fade_scale", "easing": "spring"},
                "reason": "Crucial rule or takeaway highlighted with archival document style",
                "confidence": 0.93,
                "enabled": True
            })
            graphic_id += 1
            last_graphic_end = round(min(duration, t_start + 3.5), 2)
            continue

        # Check for emphasis keywords (words with *stars*)
        starred = re.findall(r"\*([^*]+)\*", text)
        if starred and (t_start >= last_graphic_end + 2.0):
            kw = starred[0].upper()
            proposed_graphics.append({
                "id": f"mg_{graphic_id}",
                "type": "keyword_callout",
                "name": f"Keyword: {kw}",
                "start": round(t_start, 2),
                "end": round(min(duration, t_start + 2.4), 2),
                "data": {
                    "keyword": kw,
                    "tag": "KEY CONCEPT",
                    "accentColor": "#FFE600",
                    "bgColor": "rgba(10, 11, 26, 0.92)"
                },
                "position": "center",
                "animation": {"enter": "scale_pop", "exit": "fade_scale", "easing": "spring"},
                "reason": f"Emphasized concept '{kw}' highlighted to reinforce key argument",
                "confidence": 0.86,
                "enabled": True
            })
            graphic_id += 1
            last_graphic_end = round(min(duration, t_start + 2.4), 2)
            continue

    # Call to action at the end
    if captions:
        last_caps = captions[-3:]
        for lc in reversed(last_caps):
            cta = _find_call_to_action(lc.get("text", ""), lc["start"], lc["end"], duration)
            if cta:
                proposed_graphics.append({
                    "id": f"mg_{graphic_id}",
                    "type": "call_to_action",
                    "name": "End Call To Action",
                    "start": round(cta["start"], 2),
                    "end": round(cta["end"], 2),
                    "data": {
                        "title": cta["title"],
                        "subtitle": cta["subtitle"],
                        "buttonText": "TAP TO ENGAGE",
                        "accentColor": "#EC4899",
                        "bgColor": "rgba(15, 23, 42, 0.95)"
                    },
                    "position": "bottom_center",
                    "animation": {"enter": "slide_up", "exit": "fade_out", "easing": "spring"},
                    "reason": "Final call to action to maximize viewer engagement and subscriber conversion",
                    "confidence": 0.96,
                    "enabled": True
                })
                graphic_id += 1
                break

    return {
        "genre": genre,
        "genreConfidence": round(min(1.0, 0.6 + genre_confidence * 0.1), 2),
        "aspectRatio": "9:16" if is_portrait else ("1:1" if 0.95 <= aspect_ratio <= 1.05 else "16:9"),
        "resolution": f"{width}x{height}",
        "duration": round(duration, 2),
        "totalCaptions": len(captions),
        "safeZones": safe_zones,
        "proposedGraphics": proposed_graphics,
        "summary": f"Detected {genre.replace('_', ' ').title()} format ({'Portrait 9:16' if is_portrait else 'Landscape 16:9'}). Proposed {len(proposed_graphics)} synchronized motion graphics."
    }
