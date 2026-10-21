# GIVE THESE TO ANTIGRAVITY - one at a time

## Paste first (rules)
```
RULES: Do ONLY the step I give you. Do not touch other files. Do not delete anything unless the step says so.
Never say "done" until you have run it and LOOKED at the result (screenshot). If something fails, show the exact error, fix it, run again.
Finish with: files changed, how you tested, screenshot.
```

## STEP A - Add the 26 unique presets (deletes NOTHING)
```
First make a backup copy of my whole project folder.
I added the folder unique_presets_pack. It has:
- src/UniqueCaptions.tsx  (26 caption styles for Remotion, component <UniqueCaptions words styleId />, helper isUnique(id), list UNIQUE_STYLES)
- unique_presets.json     (id, name, tagline, colours for the website cards)

1) Copy src/UniqueCaptions.tsx into antigravity_presets_pack/src/. In that folder run: npm install, then npx tsc --noEmit. If a @remotion/google-fonts import name is wrong for the installed version, fix only that import.
2) In antigravity_presets_pack/src/Main.tsx: where PremiumCaptions is rendered, add: if isUnique(<the preset id prop>) render <UniqueCaptions words={words} styleId={<the preset id prop>} /> instead of PremiumCaptions. Keep everything else (person layer, graphics) as it is. Make sure python/premium_render.py passes the preset id and the words ([{t, s, e}] in seconds, after cuts) into the props.
3) Render one still of EVERY style: npx remotion still src/index.ts Captioned out/<id>.png --props=<props with words "make it pop today" and the id> --frame=40 on my test video. Look at all 26 images. If one is cut off, invisible or broken, fix ONLY that style in UniqueCaptions.tsx and render it again.
4) Copy the 26 PNGs into my website static/preset_previews/<id>.png.
5) In my website Style tab add a new group "Unique" with 26 cards (use unique_presets.json for name + tagline, the PNG as the preview image) and a search box. Selecting a card sets the preset used for export. Premium export (cuts -> Remotion render -> MP4) must work with these ids.
6) Run the website, check the browser console has no errors, show me a screenshot of the Style tab.
Do not delete or change any existing preset.
```

## STEP B (OPTIONAL - only if you want it) - delete the old website presets
```
In my website, delete ONLY the caption presets that existed before the "Unique" group (the older ones in the Style tab) and the code that only they use. First list them with file + line and wait for my OK. Keep upload, captions, timeline, cuts, B-roll, export and the new "Unique" group working. Show a screenshot and a clean browser console.
```

## Run the website with CMD (not PowerShell)
Open the project folder -> click the address bar -> type `cmd` -> Enter -> run `START_WEBSITE.cmd` -> open http://127.0.0.1:5000
