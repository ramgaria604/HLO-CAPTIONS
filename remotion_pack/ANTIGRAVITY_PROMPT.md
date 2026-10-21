# PASTE THIS WHOLE FILE INTO ANTIGRAVITY (Agent mode)

You are working inside my project. My website is the Flask app `captionstudio` and it already works. **Do not break or remove any existing feature.**
I added the folder `antigravity_presets_pack` (Remotion + presets). Your job is ONLY about **caption presets and motion graphics**. Everything is already written; you must wire it in, run it, look at the result, and make it match my reference pictures.

## 0. Look at the references first
Open the 3 images in `references/` and study them closely before touching code:
1. `ref1_teal_this_gorgeous.jpg`  - small thin white italic word "this" + HUGE heavy rounded word "Gorgeous" with a liquid teal texture: bright teal on the left/right ends, dark teal in the middle, light cyan swoosh streaks. The speaker's head is IN FRONT of the word (text is behind her).
2. `ref2_magenta_so_tonight_is_going_to.jpg` - bold magenta-to-purple word line "So Tonight Is" with very tight word spacing and a soft pale-pink glow, plus an elegant white script line "Going To" with a pink glow. The makeup brush is in front of the script.
3. `ref3_orange_real_estate_captions.jpg` - small white lowercase words ("you can add", "estate") + HUGE heavy orange words ("Real", "Captions") with a vivid orange grunge texture with torn dark-red patches and almost no shadow. "Real" is BEHIND her head, "Captions" is IN FRONT of her body, small words are in front. Words are scattered (not one straight line).

### Measured from the reference pictures (frame is 1080 wide)
- Font of the BIG words in all 3 references is a wide, heavy geometric sans = **Montserrat Black/ExtraBold** (not Poppins - Poppins is too narrow).
- teal: "Gorgeous" is ~905px wide, cap height ~115px (font ~172px = size 0.16). Small "this" is thin white italic, ~52px, placed LEFT above the big word (not centred).
- magenta: "SoTonightIs" is ~935px wide with NO spaces (tracking about -0.045em), soft pale-pink halo (not a hard neon). Script "Going To" ~635px wide, thin white-pink script.
- orange: "Captions" ~795px wide, "Real" ~440px wide (bigger font than Captions). Mostly vivid flat orange (#FF5A00) with torn dark-red patches (about 25-30% of the area) and tiny light-orange smears. NOT glossy, NOT mostly red. Almost no drop shadow.

## 1. What is already done (read these files)
- `src/fx.ts` - SVG feTurbulence + CSS gradient layers (`fxBackground`, `FX.teal`, `FX.orange`) = the liquid / grunge texture clipped to the text, slowly drifting each frame. No Remotion import, so it also runs in `lab/preset-lab.html`.
- `src/CaptionPresets.tsx` - 16 base presets, plus `src/PresetsExtra.ts` = 35 more (51 in total, merged automatically into `PRESETS` / `PRESET_LIST`). The three reference presets are `teal_gloss`, `neon_duo`, `orange_pop` and use `fx.ts`. New fields: `behind: 'none' | 'first' | 'all'` (which BIG words go behind the person), `gap` (space between words), `fx` (texture).
- `src/Main.tsx` - draws: behind-captions -> person cut-out video -> front-captions -> graphics.
- `src/Graphics.tsx` - motion graphics (kinetic text, lower third, counter, arrow, sticker, b-roll, zoom punch).
- `python/` - `premium_render.py`, `mask.py` (person cut-out WebM with alpha), `director.py`, `palette.py`.
- `lab/gallery.html` - one page showing all 35 extra presets on a colourful test background (serve `lab` with `python -m http.server 8765`, open `http://127.0.0.1:8765/gallery.html`).
- `lab/preset-lab.html` - quick browser test page for the textures (serve the `lab` folder with `python -m http.server 8765`, open `http://127.0.0.1:8765/preset-lab.html`). Use it to tune looks in seconds without rendering video.

## 2. Do this, in order
1. In `antigravity_presets_pack` run `npm install`. Fix any TypeScript/build error. Put any test video at `public/input.mp4`.
2. MOST IMPORTANT RULE: never say a preset is finished until you have put your rendered still NEXT TO the reference image and they look the same. `lab/compare.html?s=teal|neon|orange` already shows how I compared (it uses Poppins stretched as a stand-in; you must use the real Montserrat via Remotion). Write down what is different (size, width, colour, texture, glow, position), change ONE thing, render again, compare again. Repeat at least 3 rounds per reference preset.
3. Make a test props file with real words (e.g. "this gorgeous home", "so tonight is going to", "you can add real estate captions"), then for each of `teal_gloss`, `neon_duo`, `orange_pop` render a still with
   `npx remotion still src/index.ts Captioned out_<id>.png --props=<file> --frame=45`
   and **compare each still with its reference image**. Be strict. Fix until they look the same in: font weight and size ratio (big word much larger than small word), colours, texture (liquid streaks for teal, grunge for orange), glow (magenta), hard dark shadow, tight spacing, script font (Great Vibes), word positions. Tune only `src/fx.ts` and the preset values in `src/CaptionPresets.tsx`.
4. Text behind the person: run `python/mask.py -> make_person_webm` on the test video (needs `pip install mediapipe opencv-python numpy`), pass the file as `personSrc`, render `orange_pop` and `teal_gloss`, and confirm: big word hidden by the head/body where they overlap, the second big word and small words stay in front. If mediapipe's old `mp.solutions` API is missing, switch to the current mediapipe Tasks ImageSegmenter or `rembg`. If it is too slow, process at 720p and upscale the mask. If it fails, skip with a clear message in the UI - never crash the export.
5. In my website's Style tab show all 51 presets as cards with a small live preview (use the same colours/fonts; CSS is fine), group the 3 reference presets at the top with a "Reference style" label. Add the checkbox "Text behind person" (only enabled for presets with `behind` != 'none'); when ticked create the person WebM and pass `personSrc`, otherwise render without it.
6. Keep the simple old FFmpeg/ASS path for the plain presets. Premium presets export: apply auto-cuts first, re-time words/graphics to the cut video, copy the cut video into `public/`, build props with `python/premium_render.py` and render with progress on my existing progress bar, return the MP4.
7. Motion graphics (Graphics tab, optional switch): keep what exists; improve with SVG path-draw animations: hand-drawn circle around a word, animated underline/scribble, animated arrow, starburst/pop sticker, checkmark pop, price/stat counter. Use `pathLength={1}` + `strokeDashoffset` for drawing. Each event must be editable (type, text, time, position).
8. Render a 10-second clip with ALL 51 presets, save screenshots in `preset_screenshots/`, look at every one, and fix anything broken (cut-off text, overlapping, unreadable, wrong font, flicker).
9. Finally tell me the exact steps to start the website using **Command Prompt (cmd)**, not PowerShell. Use `START_WEBSITE.cmd` from this pack (edit the folder name inside if my Flask app folder is different).

## 3. The 35 extra presets (multi-colour, blend with the video)
They live in `src/PresetsExtra.ts`. They are NOT two flat colours: they use animated multi-colour gradients (`fx kind flow`), chrome, holographic, liquid, grunge, and presets that melt into the footage with CSS `mix-blend-mode` (`blend`: screen, overlay, soft-light, hard-light, multiply, difference). New animations: `rise`, `flip`.
- Make sure `src/CaptionPresets.tsx` compiles: I added Google font imports (Pacifico, Lobster, Oswald, ArchivoBlack, Righteous, Caveat, Rubik). If any module name is wrong for the installed `@remotion/google-fonts` version, fix the import.
- Render a still of EVERY preset in `PRESETS` (use the words "make it pop" and a real person video), look at each, and fix any that is unreadable, clipped, flickering, or whose blend mode makes the text invisible on that video.
- In my website Style tab show all 51 as cards in groups: Reference style (teal_gloss, neon_duo, orange_pop), Colourful gradients, Blend with video, Classic. Add a search box and a favourite star.
- Presets with `blend` must also work in the Remotion export (mix-blend-mode is applied on the caption block in `PremiumCaptions`). Show a small note "blends with your video" on those cards.
- Keep the user able to edit a preset: colours (fill stops), font, size, position, animation, blend mode, saved as "My presets".

## Rules
- Fonts come from `@remotion/google-fonts` (Poppins, Great Vibes, Inter, Anton, Playfair Display...). Never rely on fonts installed on my PC.
- Sizes are fractions of min(width,height) so the look is identical for 1080x1920 and 1920x1080.
- Don't add paid services. Don't delete my existing files. Keep code simple and commented.
- If something in this brief is impossible, say so and give the closest working alternative; do not silently skip it.
