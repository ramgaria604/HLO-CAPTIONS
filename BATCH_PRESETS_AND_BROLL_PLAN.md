# Batch Plan: Presets (C2, C3) & B-Roll (D1, D2) + A2

**Date:** 2026-11-22  
**Target Environment:** Test Branch (`test`)  
**Scope:** Presets Consistency & B-Roll Preview/Export Parity  

---

## 1. Summary of Items in this Batch

| ID | Area | Target File | Exact Line(s) | Summary of Change |
| :--- | :--- | :--- | :--- | :--- |
| **C2** | Presets | `static/app.js` | Lines 16579–16710 | Deprecate / clean up dead uncalled function `getTemplateThumbnailUrl` |
| **C3** | Presets | `static/app.js` | Lines 17079–17085 | Normalize preset `roles` in `applyPreset` so legacy flat presets always have `{ accent, base }` |
| **D1** | B-Roll | `static/app.js` | Lines 23210, 23236, 23251, 23270, 23282 | Use `drawCoverVideo(ctx, bv, ...)` in `startFrameExport` so B-roll clips use `object-fit: cover` instead of stretching |
| **D2** | B-Roll | `static/app.js` | Lines 23199–23202 | Tighten B-roll playback time sync tolerance in export loop from `0.15s` to `0.04s` (~1 frame) |
| **A2** | Positions | `static/app.js` | Line 6081 | Change `drawWhitePillKaraokePass` font size to `Math.round(Math.min(W, H) * 0.052 * fontScale)` |

---

## 2. Line-by-Line Code Comparison

### Item C2: Deprecate Dead Function `getTemplateThumbnailUrl`
- **File:** `static/app.js`
- **Lines:** 16579–16710
- **Current Code:**
  ```javascript
  const _templateThumbnailCache = new Map();

  function getTemplateThumbnailUrl(preset) {
    if (_templateThumbnailCache.has(preset.id)) {
      return _templateThumbnailCache.get(preset.id);
    }
    // ... 130 lines of canvas thumbnail generation ...
  ```
- **Issue:** Function is completely unused. Preset cards are rendered natively by DOM elements in `createPresetCard` (line 16719).
- **Proposed Fix:** Add an explicit deprecation note or remove the dead code body so it no longer clutters codebase maintenance.

---

### Item C3: Normalize Preset Roles in `applyPreset`
- **File:** `static/app.js`
- **Lines:** 17079–17085
- **Current Code:**
  ```javascript
  const clonedRoles = preset.roles ? JSON.parse(JSON.stringify(preset.roles)) : undefined;
  const defaultPos = Number.isFinite(Number(preset.position)) ? Number(preset.position) : 0.75;
  const defaultFont = preset.roles?.accent?.font || preset.key?.font || preset.fontFamily || 'Poppins';
  const defaultHi = preset.highlightColor || preset.roles?.accent?.color || preset.key?.color || '#FFE600';
  const defaultBase = preset.baseColor || preset.roles?.base?.color || '#FFFFFF';
  S.style = Object.assign({}, preset, {
    roles: clonedRoles || preset.roles,
  ```
- **Proposed Code:**
  ```javascript
  const defaultPos = Number.isFinite(Number(preset.position)) ? Number(preset.position) : 0.75;
  const defaultFont = preset.roles?.accent?.font || preset.key?.font || preset.fontFamily || 'Poppins';
  const defaultHi = preset.highlightColor || preset.roles?.accent?.color || preset.key?.color || '#FFE600';
  const defaultBase = preset.baseColor || preset.roles?.base?.color || '#FFFFFF';
  const clonedRoles = preset.roles
    ? JSON.parse(JSON.stringify(preset.roles))
    : {
        accent: { color: defaultHi, font: defaultFont },
        base: { color: defaultBase, font: defaultFont }
      };
  S.style = Object.assign({}, preset, {
    roles: clonedRoles,
  ```
- **Safety Guarantee:** Presets that already define `roles` are 100% unchanged. Legacy presets gain a safe fallback, preventing runtime `undefined` access in typography rendering passes.

---

### Item D1: B-Roll Aspect Ratio Cover Crop (`object-fit: cover`)
- **File:** `static/app.js`
- **Lines:** 23210, 23236, 23251, 23270, 23282
- **Current Code (stretching/distorting B-roll):**
  ```javascript
  // Drawer / Above:
  ctx.drawImage(bv, 0, 0, W, drawerSplitY);

  // Below:
  ctx.drawImage(bv, 0, H / 2, W, H / 2);

  // Circle:
  ctx.drawImage(bv, winX, winY, diam, diam);

  // Window / PIP / Zoom:
  ctx.drawImage(bv, winX, winY, winW, winH);

  // Full screen:
  ctx.drawImage(bv, 0, 0, W, H);
  ```
- **Proposed Code (using existing `drawCoverVideo` helper):**
  ```javascript
  // Drawer / Above:
  drawCoverVideo(ctx, bv, 0, 0, W, drawerSplitY);

  // Below:
  drawCoverVideo(ctx, bv, 0, H / 2, W, H / 2);

  // Circle:
  drawCoverVideo(ctx, bv, winX, winY, diam, diam);

  // Window / PIP / Zoom:
  drawCoverVideo(ctx, bv, winX, winY, winW, winH);

  // Full screen:
  drawCoverVideo(ctx, bv, 0, 0, W, H);
  ```
- **Visual Parity:** Matches preview CSS `object-fit: cover` exactly 1:1, eliminating all horizontal and vertical video distortion in exports.

---

### Item D2: B-Roll Export Playback Frame-Level Synchronization
- **File:** `static/app.js`
- **Lines:** 23199–23202
- **Current Code:**
  ```javascript
  const bv = brollElements[activeBroll.id];
  const brollT = Math.max(0, t - activeBroll.start);
  if (Math.abs(bv.currentTime - brollT) > 0.15) {
    try { bv.currentTime = brollT; } catch (_) {}
  }
  ```
- **Proposed Code:**
  ```javascript
  const bv = brollElements[activeBroll.id];
  const brollT = Math.max(0, t - activeBroll.start);
  if (Math.abs(bv.currentTime - brollT) > 0.04) {
    try { bv.currentTime = brollT; } catch (_) {}
  }
  ```
- **Benefit:** Tightens playback time-drift from ~4.5 frames (0.15s) down to ~1 frame (0.04s at 25-30fps), preventing visual jumps or lagging video frames during export.

---

### Item A2: White Pill Karaoke Font Scaling Parity
- **File:** `static/app.js`
- **Line:** 6081
- **Current Code:**
  ```javascript
  const fontSize = Math.round(W * 0.052 * fontScale);
  ```
- **Proposed Code (User-specified exact formula):**
  ```javascript
  const fontSize = Math.round(Math.min(W, H) * 0.052 * fontScale);
  ```
- **Visual Parity:**
  - On 9:16 vertical video (`W = 1080, H = 1920`): `Math.min(W, H) == 1080 == W`. Font size is **100% IDENTICAL** to before.
  - On 16:9 landscape video (`W = 1920, H = 1080`): `Math.min(W, H) == 1080`. Font size scales proportionately from 1080 rather than ballooning to 100px+, preventing caption edge clipping.

---

## 3. How to Test After Edits

1. **B-Roll Export Test:**
   - Add a stock B-roll clip (e.g. from Pexels) in `drawer`, `circle`, or `window` layout.
   - Preview it and verify `object-fit: cover` cropping.
   - Export video. Verify in the exported MP4 that the B-roll is cleanly cropped without stretching or distortion.
2. **Preset Schema Test:**
   - Select multiple presets (both newer duo presets and classic presets).
   - Verify all preview captions render with correct colors, fonts, and highlights without console errors.
3. **White Pill Test:**
   - Select "White Pill Karaoke" preset.
   - Verify font size on 9:16 vertical video is identical to before.
   - Toggle to 16:9 or 1:1 ratio. Verify the white pill stays neatly scaled inside the safe area.
