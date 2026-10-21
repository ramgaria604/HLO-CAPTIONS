# Duo presets (31) - give to Antigravity (delete NOTHING)

## Paste first
```
RULES: Do ONLY this task. Do not touch unrelated files. Do not delete anything. Never say "done" until you have run it and looked at the result (screenshot). If something fails, show the exact error, fix it, run again.
```

## Task
```
Make a backup copy of my whole project folder first.
I added the folder duo_presets_pack with 31 ready-made presets (static/duo_presets/duo_presets.json). They are fully configured - do NOT redesign them.
1) Copy static/duo_presets/ into my website's static/ folder and put get_fonts.py next to app.py. Add <script src="/static/duo_presets/duo_presets_loader.js"></script> to my main page so the presets appear in the Style tab (My presets, localStorage cs_presets). If the Style tab reads presets elsewhere, make it list these as cards (grouped by name prefix "Duo ·") with a search box.
2) Open /static/duo_presets/preview.html and show me a screenshot.
3) Fonts: run  python get_fonts.py  (needs internet) so the fonts are in the fonts/ folder; tell me which fonts failed. In Remotion (antigravity_presets_pack/src/CaptionPresets.tsx) load every font used by the presets with @remotion/google-fonts (27 fonts: see the "font" values in the JSON); fix any wrong import names.
4) Honour these preset fields in the premium (Remotion) export: mode, layout, blend, wordsPerPage, uppercase, removePunct, posX, posY, posCycle (vertical position per caption, repeating), lineGap, keyRule ('last' = the last word of each caption is the BIG one), behindRule (all / first / alternate), overGraphics, and per role (base / active / accent / accent2 = big-word style for every 2nd caption): font, size, weight, italic, color, outline, outlineColor, shadow, shadowColor, glow, glowColor, track, upper, layer ('front'|'behind'), enter ('slide-left'|'slide-right'|'slide-up'|'slide-down' - small words first, big word ~0.5s later), dx, dy, rotate, opacity, fill {type: solid|gradient|liquid|grunge|flow|chrome|holo, colors, angle, hi, lo, speed}.
   Draw order: behind captions -> person cut-out (python/mask.py) -> front captions -> graphics (if overGraphics: ... -> graphics -> front captions).
   Every line must auto-fit: if a word is wider than 92% of the frame width, shrink its font so it fits.
5) Render stills (caption 1 and caption 2) for 6 different presets (3 behind-head, 3 in front) on my test video with the person cut-out, and show them. Fix ONLY real bugs and tell me what you fixed.
FFmpeg/ASS export: use role.color as colour, weight>=700 as bold, normal pop animation, ignore textures; also shrink long words to fit the width.
```

## Run (CMD, not PowerShell)
Open the project folder -> click the address bar -> type cmd -> Enter -> START_WEBSITE.cmd -> open http://127.0.0.1:5000
