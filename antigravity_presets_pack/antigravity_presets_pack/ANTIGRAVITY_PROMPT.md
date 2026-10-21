# PASTE THIS WHOLE FILE INTO ANTIGRAVITY (Agent mode)

You are working inside my project. My website is the Flask app `captionstudio` and it already works. **Do not break or remove any existing feature.**
I added the folder `antigravity_presets_pack` (Remotion + presets). Your job is ONLY about **caption presets and motion graphics**. Everything is already written; you must wire it in, run it, look at the result, and make it match my reference pictures.

## 0. Look at the references first
Open the 3 images in `references/` and study them closely before touching code:
1. `ref1_teal_this_gorgeous.jpg`  - small thin white italic word "this" + HUGE heavy rounded word "Gorgeous" with a liquid teal texture: bright teal on the left/right ends, dark teal in the middle, light cyan swoosh streaks. The speaker's head is IN FRONT of the word (text is behind her).
2. `ref2_magenta_so_tonight_is_going_to.jpg` - bold magenta-to-purple word line "So Tonight Is" with very tight word spacing and a soft pink neon glow, plus an elegant white script line "Going To" with a pink glow. The makeup brush is in front of the script.
3. `ref3_orange_real_estate_captions.jpg` - small white lowercase words ("you can add", "estate") + HUGE heavy orange words ("Real", "Captions") with a grunge/liquid orange-to-red texture and a dark red hard shadow. "Real" is BEHIND her head, "Captions" is IN FRONT of her body, small words are in front. Words are scattered (not one straight line).

## 1. What is already done (read these files)
- `src/fx.ts` - SVG feTurbulence + CSS gradient layers (`fxBackground`, `FX.teal`, `FX.orange`) = the liquid / grunge texture clipped to the text, slowly drifting each frame. No Remotion import, so it also runs in `lab/preset-lab.html`.
- `src/CaptionPresets.tsx` - 16 presets. The three reference presets are `teal_gloss`, `neon_duo`, `orange_pop` and use `fx.ts`. New fields: `behind: 'none' | 'first' | 'all'` (which BIG words go behind the person), `gap` (space between words), `fx` (texture).
- `src/Main.tsx` - draws: behind-captions -> person cut-out video -> front-captions -> graphics.
- `src/Graphics.tsx` - motion graphics (kinetic text, lower third, counter, arrow, sticker, b-roll, zoom punch).
- `python/` - `premium_render.py`, `mask.py` (person cut-out WebM with alpha), `director.py`, `palette.py`.
- `lab/preset-lab.html` - quick browser test page for the textures (serve the `lab` folder with `python -m http.server 8765`, open `http://127.0.0.1:8765/preset-lab.html`). Use it to tune looks in seconds without rendering video.

## 2. Do this, in order
1. In `antigravity_presets_pack` run `npm install`. Fix any TypeScript/build error. Put any test video at `public/input.mp4`.
2. Make a test props file with real words (e.g. "this gorgeous home", "so tonight is going to", "you can add real estate captions"), then for each of `teal_gloss`, `neon_duo`, `orange_pop` render a still with
   `npx remotion still src/index.ts Captioned out_<id>.png --props=<file> --frame=45`
   and **compare each still with its reference image**. Be strict. Fix until they look the same in: font weight and size ratio (big word much larger than small word), colours, texture (liquid streaks for teal, grunge for orange), glow (magenta), hard dark shadow, tight spacing, script font (Great Vibes), word positions. Tune only `src/fx.ts` and the preset values in `src/CaptionPresets.tsx`.
3. Text behind the person: run `python/mask.py -> make_person_webm` on the test video (needs `pip install mediapipe opencv-python numpy`), pass the file as `personSrc`, render `orange_pop` and `teal_gloss`, and confirm: big word hidden by the head/body where they overlap, the second big word and small words stay in front. If mediapipe's old `mp.solutions` API is missing, switch to the current mediapipe Tasks ImageSegmenter or `rembg`. If it is too slow, process at 720p and upscale the mask. If it fails, skip with a clear message in the UI - never crash the export.
4. In my website's Style tab show all 16 presets as cards with a small live preview (use the same colours/fonts; CSS is fine), group the 3 reference presets at the top with a "Reference style" label. Add the checkbox "Text behind person" (only enabled for presets with `behind` != 'none'); when ticked create the person WebM and pass `personSrc`, otherwise render without it.
5. Keep the simple old FFmpeg/ASS path for the plain presets. Premium presets export: apply auto-cuts first, re-time words/graphics to the cut video, copy the cut video into `public/`, build props with `python/premium_render.py` and render with progress on my existing progress bar, return the MP4.
6. Motion graphics (Graphics tab, optional switch): keep what exists; improve with SVG path-draw animations: hand-drawn circle around a word, animated underline/scribble, animated arrow, starburst/pop sticker, checkmark pop, price/stat counter. Use `pathLength={1}` + `strokeDashoffset` for drawing. Each event must be editable (type, text, time, position).
7. Render a 10-second clip with ALL 16 presets, save screenshots in `preset_screenshots/`, look at every one, and fix anything broken (cut-off text, overlapping, unreadable, wrong font, flicker).
8. Finally tell me the exact steps to start the website using **Command Prompt (cmd)**, not PowerShell. Use `START_WEBSITE.cmd` from this pack (edit the folder name inside if my Flask app folder is different).

## Rules
- Fonts come from `@remotion/google-fonts` (Poppins, Great Vibes, Inter, Anton, Playfair Display...). Never rely on fonts installed on my PC.
- Sizes are fractions of min(width,height) so the look is identical for 1080x1920 and 1920x1080.
- Don't add paid services. Don't delete my existing files. Keep code simple and commented.
- If something in this brief is impossible, say so and give the closest working alternative; do not silently skip it.
