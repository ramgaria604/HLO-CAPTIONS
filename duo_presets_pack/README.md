# Duo presets (31) - unique looks, special fonts, behind-head / front, slide-in
All presets are already fully set. Open static/duo_presets/preview.html to see them all moving (head = what is behind / in front).

What makes them different
- 27 different fonts (Montserrat, Shrikhand, Abril Fatface, Bowlby One, Alfa Slab One, Lobster, Pacifico, Yellowtail, Cinzel, Cormorant Garamond, DM Serif Display, Syne, Fredoka, Bebas Neue, Anton, Righteous, Luckiest Guy, Bungee, Great Vibes ...). Small word and big word use different fonts.
- Colour pairs: white + orange / blue / navy / gold / red fire / purple holo / teal liquid / coral / ice / emerald; orange + navy; cyan + magenta; black + yellow; yellow + white outline; pink script + white; sand + teal; lavender + purple glow; pink then green; gold then white; orange then blue ...
- 16 have the BIG word BEHIND the head (small words in front). 15 have it IN FRONT, high or low (below). Some alternate behind/front inside a caption.
- Every preset slides in (left / right / up / down), small words first, then the big word.
- 4 one-line "Slide Line" presets (spoken word changes colour).
- Everything is adjustable afterwards in the Preset Maker (layer, position, slide direction, colours, fonts, glow, etc.).

Files
- static/duo_presets/duo_presets.json (the presets), duo_presets_loader.js, preview.html, fx.js
- get_fonts.py : downloads all fonts into fonts/ (for the FFmpeg export)
- ANTIGRAVITY_COMMAND.md
Needs the fields from "seen_slide_preset_update" (enter, keyRule, posCycle, accent2, layer, behindRule) - already in the Preset Maker / Remotion pack updates.
Textures (liquid, grunge, holo, chrome, flow) render fully only in the Remotion export; the FFmpeg export uses the first colour and normal pop (no slide).
