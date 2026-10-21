'use strict';
const $ = id => document.getElementById(id);
const S = {
  filename: null, meta: null, captions: [], rawWords: [], style: null, presets: [], custom: [], presetId: null,
  cuts: [], zoom: false, previewCuts: false, slots: [], selected: null, fonts: [], status: {}, styleVer: 0,
  edited: false, busy: false,
  // Motion Graphics & AI Director
  graphics: [], selectedGraphic: null, aiPlan: null, mgTemplates: [], graphicDirty: false, projectName: 'My Video Project',
  // Effects & Audio state
  aspect: 'original', speed: 1.0, speedScope: 'all',
  bgMusic: null, musicVol: 30, voiceVol: 100, musicFade: true,
  effects: { kenBurns: false, vignette: false, sharpen: false, cinemaBar: false },
  exportQuality: 'balanced', exportFormat: 'mp4', exportEngine: 'ffmpeg',
  selectedCat: 'all', presetSearch: ''
};
const vid = $('vid'), stage = $('stage'), capbox = $('capbox'), mgStage = $('mgStage');
const capCanvas = $('captionCanvas'), capCanvasBehind = $('captionCanvasBehind');
const capCtx = capCanvas ? capCanvas.getContext('2d') : null;
const capCtxBehind = capCanvasBehind ? capCanvasBehind.getContext('2d') : null;

// ------------------------------------------------------------------ helpers
function el(tag, props, ...kids) {
  const e = document.createElement(tag);
  for (const k in (props || {})) {
    const v = props[k];
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v === true) e.setAttribute(k, '');
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const c of kids.flat()) { if (c == null) continue; e.append(c.nodeType ? c : document.createTextNode(c)); }
  return e;
}
function notice(msg, kind) { const n = $('notice'); n.textContent = msg; n.className = 'notice ' + (kind || ''); }
async function api(url, body) {
  let r, d = {};
  try {
    r = await fetch(url, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    d = await r.json();
  } catch (e) { throw new Error('Could not reach the app. Is the PowerShell window still running?'); }
  if (!r.ok || d.error) throw new Error(d.error || ('Request failed (' + r.status + ')'));
  return d;
}
const clone = o => JSON.parse(JSON.stringify(o));
const fmtT = s => { s = Math.max(0, s || 0); const m = Math.floor(s / 60); return m + ':' + String(Math.floor(s % 60)).padStart(2, '0'); };
const dur = () => (S.meta && S.meta.duration) || vid.duration || 0;
const num = (v, d) => { const n = parseFloat(v); return isFinite(n) ? n : d; };
function setBusy(btn, on, label) { btn.disabled = on; if (!btn.dataset.l) btn.dataset.l = btn.textContent; btn.textContent = on ? label : btn.dataset.l; }

// ------------------------------------------------------------------ History (Undo / Redo)
const History = {
  undoStack: [],
  redoStack: [],
  maxStates: 40,

  snapshot() {
    return {
      captions: clone(S.captions || []),
      cuts: clone(S.cuts || []),
      style: S.style ? clone(S.style) : null,
      presetId: S.presetId,
      graphics: clone(S.graphics || [])
    };
  },

  push(desc = 'Action') {
    this.undoStack.push(this.snapshot());
    if (this.undoStack.length > this.maxStates) this.undoStack.shift();
    this.redoStack = [];
    this.updateButtons();
  },

  undo() {
    if (!this.undoStack.length) return;
    this.redoStack.push(this.snapshot());
    const state = this.undoStack.pop();
    this.apply(state);
    notice('↩ Undo', 'ok');
  },

  redo() {
    if (!this.redoStack.length) return;
    this.undoStack.push(this.snapshot());
    const state = this.redoStack.pop();
    this.apply(state);
    notice('↪ Redo', 'ok');
  },

  apply(state) {
    if (!state) return;
    S.captions = clone(state.captions || []);
    S.cuts = clone(state.cuts || []);
    if (state.style) S.style = clone(state.style);
    S.presetId = state.presetId;
    S.graphics = clone(state.graphics || []);
    S.styleVer = (S.styleVer || 0) + 1;
    S.graphicDirty = true;
    capSig = '';
    renderCapList();
    renderCuts();
    renderTimeline();
    renderPresets();
    renderCaption(vid.currentTime || 0);
    renderMotionGraphics(vid.currentTime || 0);
    this.updateButtons();
  },

  updateButtons() {
    const canUndo = this.undoStack.length > 0;
    const canRedo = this.redoStack.length > 0;
    const bUndo = $('btnUndo'), bRedo = $('btnRedo');
    const tlUndo = $('tlUndoBtn'), tlRedo = $('tlRedoBtn');
    if (bUndo) bUndo.disabled = !canUndo;
    if (bRedo) bRedo.disabled = !canRedo;
    if (tlUndo) tlUndo.disabled = !canUndo;
    if (tlRedo) tlRedo.disabled = !canRedo;
  }
};

// ------------------------------------------------------------------ MediaPipe SelfieSegmentation & Smart Head Tracking
let selfieSegmentation = null;
let segRunning = false;
let lastSegVideoTime = -1;

function initMediaPipe() {
  if (selfieSegmentation) return;
  if (typeof SelfieSegmentation === 'undefined') {
    return;
  }
  try {
    selfieSegmentation = new SelfieSegmentation({
      locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`
    });
    selfieSegmentation.setOptions({
      modelSelection: 1,
      selfieMode: false
    });
    selfieSegmentation.onResults(onSegmentationResults);
    console.log('[MediaPipe] SelfieSegmentation initialized successfully');
  } catch (err) {
    console.warn('[MediaPipe] Init error:', err);
  }
}
window.addEventListener('load', () => { if (!selfieSegmentation) initMediaPipe(); });

function onSegmentationResults(results) {
  segRunning = false;
  const pcv = $('personCanvas');
  if (!pcv || !vid || !results.segmentationMask) return;

  if (pcv.width !== vid.videoWidth || pcv.height !== vid.videoHeight) {
    pcv.width = vid.videoWidth || 1080;
    pcv.height = vid.videoHeight || 1920;
  }

  const ctx = pcv.getContext('2d');
  ctx.save();
  ctx.clearRect(0, 0, pcv.width, pcv.height);
  // Mask
  ctx.drawImage(results.segmentationMask, 0, 0, pcv.width, pcv.height);
  // Keep only person pixels from video
  ctx.globalCompositeOperation = 'source-in';
  ctx.drawImage(results.image, 0, 0, pcv.width, pcv.height);
  ctx.restore();

  // === SMART HEAD TRACKING ===
  try {
    const sampleW = 120;
    const sampleH = Math.round(120 * (pcv.height / pcv.width));
    if (!window._headSampleCanvas) {
      window._headSampleCanvas = document.createElement('canvas');
    }
    const sc = window._headSampleCanvas;
    if (sc.width !== sampleW || sc.height !== sampleH) {
      sc.width = sampleW; sc.height = sampleH;
    }
    const sctx = sc.getContext('2d', { willReadFrequently: true });
    sctx.drawImage(results.segmentationMask, 0, 0, sampleW, sampleH);
    const data = sctx.getImageData(0, 0, sampleW, sampleH).data;

    let detectedY = -1;
    // Scan rows from top to bottom in middle 70% width
    for (let y = 0; y < sampleH; y++) {
      let count = 0;
      const rowOffset = y * sampleW * 4;
      for (let x = Math.round(sampleW * 0.15); x < Math.round(sampleW * 0.85); x++) {
        if (data[rowOffset + x * 4] > 60) count++;
      }
      if (count >= 3) {
        detectedY = y;
        break;
      }
    }
    if (detectedY >= 0) {
      const normY = detectedY / sampleH;
      S.smoothHeadY = S.smoothHeadY !== undefined ? S.smoothHeadY * 0.7 + normY * 0.3 : normY;
    }
  } catch (e) {}
}

function processSegmentationFrame() {
  if (!selfieSegmentation && typeof SelfieSegmentation !== 'undefined') initMediaPipe();
  if (!selfieSegmentation || segRunning || !vid || vid.paused || vid.ended) return;
  if (!stage.classList.contains('behind-active')) return;
  const t = vid.currentTime;
  if (Math.abs(t - lastSegVideoTime) < 0.04) return;
  lastSegVideoTime = t;
  segRunning = true;
  selfieSegmentation.send({ image: vid }).catch(() => { segRunning = false; });
}

// ------------------------------------------------------------------ words (same rules as the server)
function tokenize(text) {
  const out = []; let inKey = false;
  for (const tok of String(text).split(/\s+/).filter(Boolean)) {
    const starts = tok.startsWith('*'), ends = tok.endsWith('*') && tok.length > 1;
    if (starts) inKey = true;
    const clean = tok.replace(/^\*+|\*+$/g, '');
    if (clean) out.push({ t: clean, key: inKey });
    if (ends) inKey = false;
  }
  return out;
}
function capWords(c) {
  const toks = tokenize(c.text); if (!toks.length) return [];
  const s = +c.start, e = +c.end;
  if (c.wt && c.wt.length === toks.length) toks.forEach((t, i) => { t.s = c.wt[i][0]; t.e = c.wt[i][1]; });
  else {
    const w = toks.map(t => t.t.length + 1), tot = w.reduce((a, b) => a + b, 0); let pos = s;
    toks.forEach((t, i) => { const d = (e - s) * w[i] / tot; t.s = pos; t.e = pos + d; pos += d; });
  }
  return toks;
}
function capEnd(c, words) { return Math.max(+c.end, words.length ? words[words.length - 1].e : 0); }
function linesOf(words, layout) {
  if (layout === 'line') return [words];
  const lines = []; let cur = [];
  for (const w of words) { if (cur.length && cur[cur.length - 1].key !== w.key) { lines.push(cur); cur = []; } cur.push(w); }
  if (cur.length) lines.push(cur);
  return lines;
}

// ------------------------------------------------------------------ caption preview
let capSig = '', capEls = [];
function wordCss(r, em, customColor, preset, isKey) {
  const sh = [];
  let color = customColor || r.color;
  const st = preset || S.style;
  const isScreen = !!(st && (st.blendMode === 'screen' || st.blendMode === 'screen_25'));

  // Exact Reference 1: Dual Neon Aura ("And I'm schizophrenic" - Frame 11)
  if (st && st.refDualNeon) {
    if (isKey) {
      color = '#00D2FF';
      sh.push('0 0 14px rgba(0, 210, 255, 0.85)', '0 0 32px rgba(0, 210, 255, 0.5)');
    } else {
      color = '#FFE600';
      sh.push('0 0 12px rgba(255, 230, 0, 0.75)', '0 0 26px rgba(255, 230, 0, 0.45)');
    }
  } else if (st && st.shadow3D && r.shadow3D && (st.id === 'ref_crimson_3d' || color === '#EF4444')) {
    // Exact Reference 3: Crimson 3D Volumetric ("cell" / "life is cell" - Frame 10 & 13)
    sh.push(
      '1px 1px 0 #991B1B',
      '2px 2px 0 #7F1D1D',
      '3px 3px 0 #450A0A',
      '4px 4px 0 #1A0000',
      '0 0 20px rgba(239, 68, 68, 0.75)'
    );
  } else if (st && st.shadow3D && !isScreen) {
    const sc = r.shadowColor || '#000000';
    sh.push(
      `1px 1px 0 ${sc}`,
      `2px 2px 0 ${sc}`,
      `3px 3px 0 ${sc}`,
      `4px 4px 0 ${sc}`,
      `5px 5px 0 ${sc}`,
      `6px 6px 0 ${sc}`,
      `0 8px 18px rgba(0,0,0,0.85)`
    );
  } else if (r.shadow > 0) {
    const d = r.shadow * em;
    sh.push(`${d}px ${d}px 0 ${r.shadowColor}`);
  }

  // Exact Reference 2: Chromatic Aberration RGB split ("she suck" - Frame 8)
  if (st && st.chromaticAberration) {
    sh.push('-2.5px 0 rgba(255, 30, 80, 0.85)', '2.5px 0 rgba(0, 220, 255, 0.85)');
  }

  // Reduced tight glow for other presets
  if (!st?.refDualNeon && r.glowSize > 0 && r.glow) {
    const g = Math.max(2, Math.min(6, r.glowSize * em * 0.35));
    sh.push(`0 0 ${g}px ${r.glow}`);
  }

  // Strong contrast shadow so text NEVER fades into light or dark video scenes
  if (!st?.refDualNeon && !st?.chromaticAberration) {
    sh.push(`0 2px 6px rgba(0,0,0,0.85)`);
  }

  let extra = '';
  // Reference 2: Dark kinetic pill highlight behind filler words
  if (st && st.pillBox && !isKey) {
    extra += `background:rgba(10, 10, 15, 0.92);padding:2px 10px;border-radius:6px;box-shadow:0 4px 14px rgba(0,0,0,0.5);display:inline-block;margin:0 2px;`;
  }
  if (st && st.badge && isKey) {
    const bg = st.badge;
    const tc = st.badgeTextColor || '#000000';
    extra += `background:${bg};color:${tc} !important;padding:2px 10px;border-radius:8px;box-shadow:0 4px 14px rgba(0,0,0,0.5);display:inline-block;`;
  }
  if (st && st.rotation) {
    extra += `transform:rotate(${st.rotation}deg);display:inline-block;`;
  }
  // Subtle tight edge bloom
  if (st && st.glowBloom && r.glow && !st.refDualNeon) {
    extra += `filter:drop-shadow(0 0 4px ${r.glow});`;
  }
  if (isScreen) {
    extra += `opacity:0.96;`;
  }

  // Multi-color blended gradients / Chrome Studio
  if (st && isKey && st.keyGradient) {
    extra += `background:${st.keyGradient};-webkit-background-clip:text;-webkit-text-fill-color:transparent;display:inline-block;`;
  } else if (st && !isKey && st.textGradient) {
    extra += `background:${st.textGradient};-webkit-background-clip:text;-webkit-text-fill-color:transparent;display:inline-block;`;
  } else if (st && st.textGradient && !st.keyGradient) {
    extra += `background:${st.textGradient};-webkit-background-clip:text;-webkit-text-fill-color:transparent;display:inline-block;`;
  }

  // Zero-stroke when outline is 0 or transparent
  let outlineCss = '';
  if (r.outline > 0 && r.outlineColor && r.outlineColor !== 'transparent') {
    const strokeWidth = r.outline * em * 2;
    outlineCss = `-webkit-text-stroke:${strokeWidth}px ${r.outlineColor};paint-order:stroke fill;`;
  }

  return `font-family:"${r.font}","${r.fallback}",sans-serif;font-size:${em}px;color:${color};` +
    `font-weight:${r.bold ? 800 : 400};font-style:${r.italic ? 'italic' : 'normal'};text-transform:${r.upper ? 'uppercase' : 'none'};` +
    outlineCss + (sh.length ? `text-shadow:${sh.join(',')};` : '') + extra;
}
function activeCaption(t) {
  let best = null;
  for (const c of S.captions) {
    const ws = capWords(c); const end = capEnd(c, ws);
    if (t >= +c.start - 0.001 && t < end) { if (!best || +c.start >= +best.start) best = c; }
  }
  return best;
}
// ================================================================== MULTI-PASS KINETIC CANVAS TYPOGRAPHY ENGINE (1:1 AFTER EFFECTS FIDELITY)

function getWordPop(w, t, showAll, anim) {
  if (showAll || !anim || anim === 'none') return { visible: true, scale: 1.0, dx: 0, dy: 0, opacity: 1 };
  if (!w) return { visible: true, scale: 1.0, dx: 0, dy: 0, opacity: 1 };

  if (typeof w.s === 'number') {
    const dt = t - w.s;

    if (anim === 'slide-up' || anim === 'slide-down' || anim === 'slide-left' || anim === 'slide-right' || (typeof anim === 'string' && anim.startsWith('slide'))) {
      if (dt < 0) {
        return { visible: true, scale: 1.0, dx: 0, dy: 0, opacity: 1 };
      }
      if (dt < 0.25) {
        const p = Math.max(0, Math.min(1, dt / 0.25));
        const ease = 1 - Math.pow(1 - p, 3);
        const dist = 24 * (1 - ease);
        let dx = 0, dy = 0;
        if (anim === 'slide-up') dy = dist;
        else if (anim === 'slide-down') dy = -dist;
        else if (anim === 'slide-left') dx = -dist;
        else if (anim === 'slide-right') dx = dist;
        return { visible: true, scale: 1.0, dx, dy, opacity: Math.max(0.4, p) };
      }
      return { visible: true, scale: 1.0, dx: 0, dy: 0, opacity: 1 };
    }

    if (dt >= 0 && dt < 0.20) {
      const p = Math.max(0, dt / 0.20);
      const s = (p < 0.5) ? 0.95 + 0.20 * (p / 0.5) : 1.15 - 0.15 * ((p - 0.5) / 0.5);
      return { visible: true, scale: s, dx: 0, dy: 0, opacity: 1 };
    }
  }

  return { visible: true, scale: 1.0, dx: 0, dy: 0, opacity: 1 };
}

function drawDualNeonPass(ctxFore, ctxBehind, words, t, st, W, H, base, isBehind, showAll) {
  const kRole = st.key || {}, fRole = st.filler || {};
  const kSize = Math.max(24, Math.round(base * (kRole.size || 0.165)));
  const fSize = Math.max(18, Math.round(base * (fRole.size || 0.115)));
  const leading = st.leading || 0.88;
  const cY = H * (st.position || 0.38);

  const l1Words = words.filter(w => !w.key);
  const l2Words = words.filter(w => w.key);
  const hasBoth = l1Words.length > 0 && l2Words.length > 0;
  
  const line1 = hasBoth ? l1Words : words.slice(0, Math.ceil(words.length / 2));
  const line2 = hasBoth ? l2Words : words.slice(Math.ceil(words.length / 2));

  const y1 = line2.length ? (cY - (fSize * leading) / 2) : cY;
  const y2 = line1.length ? (cY + (kSize * leading) / 2) : cY;

  // --- Line 1: Electric Yellow ("And I'm" - Frame 11) ---
  if (line1.length) {
    const txt1 = line1.map(w => w.t).join(' ');
    const anim1 = getWordPop(line1[0], t, showAll, st.animation);
    ctxFore.save();
    ctxFore.translate(W / 2 + (anim1.dx || 0), y1 + (anim1.dy || 0));
    ctxFore.scale(anim1.scale || 1, anim1.scale || 1);
    if (typeof anim1.opacity === 'number') ctxFore.globalAlpha *= anim1.opacity;
    ctxFore.font = `800 ${fSize}px "Poppins", "Montserrat", sans-serif`;
    ctxFore.textAlign = 'center';
    ctxFore.textBaseline = 'middle';

    // Pass 1: Multi-tier Exponential Optical Bloom
    ctxFore.save();
    ctxFore.globalCompositeOperation = 'lighter';
    ctxFore.shadowColor = 'rgba(229, 255, 32, 0.40)';
    ctxFore.shadowBlur = Math.round(base * 0.08);
    ctxFore.fillStyle = '#E5FF20';
    ctxFore.fillText(txt1, 0, 0);

    ctxFore.shadowColor = 'rgba(229, 255, 32, 0.80)';
    ctxFore.shadowBlur = Math.round(base * 0.035);
    ctxFore.fillText(txt1, 0, 0);
    ctxFore.restore();

    // Pass 2: Downward bevel extrusion
    ctxFore.fillStyle = '#8B9900';
    ctxFore.fillText(txt1, 0, 1.2);

    // Pass 3: 100% Solid Crisp Core
    ctxFore.fillStyle = '#E5FF20';
    ctxFore.fillText(txt1, 0, 0);

    // Pass 4: Top Specular Sheen
    ctxFore.strokeStyle = 'rgba(255, 255, 255, 0.70)';
    ctxFore.lineWidth = Math.max(1, Math.round(base * 0.003));
    ctxFore.strokeText(txt1, 0, -0.6);

    ctxFore.restore();
  }

  // --- Line 2: Luminous Cyan ("schizophrenic" - Frame 11) ---
  if (line2.length) {
    const txt2 = line2.map(w => w.t.toLowerCase()).join(' ');
    const anim2 = getWordPop(line2[0], t, showAll, st.animation);
    const ctxTarget = (isBehind && ctxBehind) ? ctxBehind : ctxFore;

    ctxTarget.save();
    ctxTarget.translate(W / 2 + (anim2.dx || 0), y2 + (anim2.dy || 0));
    ctxTarget.scale(anim2.scale || 1, anim2.scale || 1);
    if (typeof anim2.opacity === 'number') ctxTarget.globalAlpha *= anim2.opacity;
    ctxTarget.font = `800 ${kSize}px "Poppins", "Montserrat", sans-serif`;
      ctxTarget.textAlign = 'center';
      ctxTarget.textBaseline = 'middle';

      // Pass 1: Deep Optical Cyan Bloom (Deep Glow Curve)
      ctxTarget.save();
      ctxTarget.globalCompositeOperation = 'lighter';
      ctxTarget.shadowColor = 'rgba(0, 200, 255, 0.45)';
      ctxTarget.shadowBlur = Math.round(base * 0.12);
      ctxTarget.fillStyle = '#00E5FF';
      ctxTarget.fillText(txt2, 0, 0);

      ctxTarget.shadowColor = 'rgba(0, 240, 255, 0.85)';
      ctxTarget.shadowBlur = Math.round(base * 0.045);
      ctxTarget.fillText(txt2, 0, 0);
      ctxTarget.restore();

      // Pass 2: 3D Bevel/Extrusion
      ctxTarget.fillStyle = '#0055AA';
      ctxTarget.fillText(txt2, 1.2, 2.0);

      // Pass 3: Front Face Cyan Vertical Gradient
      const grad = ctxTarget.createLinearGradient(0, -kSize / 2, 0, kSize / 2);
      grad.addColorStop(0, '#38E1FF');
      grad.addColorStop(1, '#0088EE');
      ctxTarget.fillStyle = grad;
      ctxTarget.fillText(txt2, 0, 0);

      // Pass 4: Razor-sharp Top Rim Specular Highlight
      ctxTarget.strokeStyle = 'rgba(255, 255, 255, 0.90)';
      ctxTarget.lineWidth = Math.max(1, Math.round(base * 0.0035));
      ctxTarget.strokeText(txt2, 0, -0.6);

      ctxTarget.restore();
    }
  }

function drawKineticLensPass(ctxFore, ctxBehind, words, t, st, W, H, base, isBehind, showAll) {
  const kRole = st.key || {}, fRole = st.filler || {};
  const cY = H * (st.position || 0.44);
  const total = words.length;

  ctxFore.save();
  ctxFore.textAlign = 'center';
  ctxFore.textBaseline = 'middle';

  const wordMetrics = words.map(w => {
    const isK = w.key;
    const fs = Math.max(18, Math.round(base * (isK ? (kRole.size || 0.17) : (fRole.size || 0.09))));
    ctxFore.font = `${isK ? 800 : 700} ${fs}px "Poppins", "Arial Black", sans-serif`;
    return { w, fs, width: ctxFore.measureText(w.t).width };
  });

  const spacing = 16;
  const totalWidth = wordMetrics.reduce((sum, m) => sum + m.width, 0) + (total - 1) * spacing;
  let curX = (W - totalWidth) / 2;

  for (let i = 0; i < total; i++) {
    const m = wordMetrics[i];
    const centerX = curX + m.width / 2;
    curX += m.width + spacing;

    const anim = getWordPop(m.w, t, showAll, st.animation);
    if (!anim.visible) continue;

    const curveY = cY + Math.pow(centerX - W / 2, 2) * 0.00035;

    ctxFore.save();
    ctxFore.translate(centerX, curveY);
    ctxFore.scale(anim.scale, anim.scale);
    ctxFore.font = `${m.w.key ? 800 : 700} ${m.fs}px "Poppins", "Arial Black", sans-serif`;

    // Secondary words: dark rounded kinetic pill backing (Frame 8)
    if (!m.w.key && st.pillBox) {
      const padX = 12, padY = 6;
      ctxFore.save();
      ctxFore.fillStyle = 'rgba(10, 10, 15, 0.90)';
      ctxFore.shadowColor = 'rgba(0, 0, 0, 0.65)';
      ctxFore.shadowBlur = 12;
      const rx = -m.width / 2 - padX;
      const ry = -m.fs / 2 - padY / 2;
      const rw = m.width + padX * 2;
      const rh = m.fs + padY;
      ctxFore.beginPath();
      ctxFore.roundRect ? ctxFore.roundRect(rx, ry, rw, rh, 6) : ctxFore.rect(rx, ry, rw, rh);
      ctxFore.fill();
      ctxFore.restore();
    }

    // Chromatic Aberration: Sub-pixel RGB Split (Frame 8)
    if (st.chromaticAberration) {
      ctxFore.save();
      ctxFore.globalCompositeOperation = 'lighter';
      ctxFore.fillStyle = 'rgba(255, 30, 80, 0.85)';
      ctxFore.fillText(m.w.t, -3.2, -1.0);
      ctxFore.fillStyle = 'rgba(0, 220, 255, 0.85)';
      ctxFore.fillText(m.w.t, 3.2, 1.0);
      ctxFore.restore();
    }

    // Solid Core
    if (m.w.key) {
      ctxFore.save();
      ctxFore.shadowColor = 'rgba(147, 51, 234, 0.85)';
      ctxFore.shadowBlur = 16;
      ctxFore.fillStyle = '#7B2CBF';
      ctxFore.fillText(m.w.t, 0, 0);
      ctxFore.restore();

      ctxFore.fillStyle = '#9333EA';
      ctxFore.fillText(m.w.t, 0, 0);
    } else {
      ctxFore.fillStyle = '#FFFFFF';
      ctxFore.fillText(m.w.t, 0, 0);
    }

    ctxFore.restore();
  }

  ctxFore.restore();
}

function drawCrimson3DPass(ctxFore, ctxBehind, words, t, st, W, H, base, isBehind, showAll) {
  if (!words || !words.length) return;
  const kRole = st.key || {}, fRole = st.filler || {};
  const fs = Math.max(26, Math.round(base * (kRole.size || 0.17)));
  const cY = H * (st.position || 0.46);
  const text = words.map(w => w.t.toLowerCase()).join(' ');

  const anim = getWordPop(words[0], t, showAll, st.animation);
  const ctxTarget = (isBehind && ctxBehind) ? ctxBehind : ctxFore;

  // Pass 1: Volumetric Ambient Red Flare Halo behind text (Frame 10 & 13)
  ctxTarget.save();
  const flare = ctxTarget.createRadialGradient(W / 2, cY, 10, W / 2, cY, fs * 2.8);
  flare.addColorStop(0, 'rgba(224, 26, 64, 0.45)');
  flare.addColorStop(0.5, 'rgba(180, 10, 40, 0.20)');
  flare.addColorStop(1, 'rgba(140, 0, 20, 0)');
  ctxTarget.fillStyle = flare;
  ctxTarget.beginPath();
  ctxTarget.arc(W / 2, cY, fs * 2.8, 0, Math.PI * 2);
  ctxTarget.fill();
  ctxTarget.restore();

  // Pass 2 & 3: 3D Directional Extrusion & Front Bevel Face
  ctxTarget.save();
  ctxTarget.translate(W / 2 + (anim.dx || 0), cY + (anim.dy || 0));
  ctxTarget.scale(anim.scale || 1, anim.scale || 1);
  if (typeof anim.opacity === 'number') ctxTarget.globalAlpha *= anim.opacity;
  ctxTarget.font = `800 ${fs}px "Poppins", "Arial Black", sans-serif`;
  ctxTarget.textAlign = 'center';
  ctxTarget.textBaseline = 'middle';

  // 3D Extrusion Stack
  for (let step = 6; step >= 1; step--) {
    ctxTarget.fillStyle = (step > 3) ? '#180005' : '#4A0010';
    ctxTarget.fillText(text, step * 0.9, step * 1.2);
  }

  // Front Face Crimson Gradient
  const faceGrad = ctxTarget.createLinearGradient(0, -fs / 2, 0, fs / 2);
  faceGrad.addColorStop(0, '#FF2A55');
  faceGrad.addColorStop(1, '#B80D2A');
  ctxTarget.fillStyle = faceGrad;
  ctxTarget.fillText(text, 0, 0);

  // Top/Outer Specular Sheen Rim
  ctxTarget.strokeStyle = 'rgba(255, 85, 120, 0.85)';
  ctxTarget.lineWidth = Math.max(1, Math.round(base * 0.003));
  ctxTarget.strokeText(text, 0, -0.6);

  ctxTarget.restore();
}

function drawChromeStudioPass(ctxFore, ctxBehind, words, t, st, W, H, base, isBehind, showAll) {
  const kRole = st.key || {}, fRole = st.filler || {};
  const kSize = Math.max(26, Math.round(base * (kRole.size || 0.17)));
  const fSize = Math.max(14, Math.round(base * (fRole.size || 0.065)));
  const cY = H * (st.position || 0.42);

  const l1Words = words.filter(w => w.key);
  const l2Words = words.filter(w => !w.key);
  const hasBoth = l1Words.length > 0 && l2Words.length > 0;

  const keyWords = hasBoth ? l1Words : words.slice(0, 1);
  const subWords = hasBoth ? l2Words : words.slice(1);

  const y1 = cY - kSize * 0.35;
  const y2 = cY + fSize * 1.5;

  // --- Line 1: Specular Metallic Chrome ("Slate" - Frame 15) ---
  if (keyWords.length) {
    const txt1 = keyWords.map(w => w.t).join(' ');
    const anim1 = getWordPop(keyWords[0], t, showAll, st.animation);

    ctxFore.save();
    ctxFore.translate(W / 2 + (anim1.dx || 0), y1 + (anim1.dy || 0));
    ctxFore.scale(anim1.scale || 1, anim1.scale || 1);
    if (typeof anim1.opacity === 'number') ctxFore.globalAlpha *= anim1.opacity;
    ctxFore.font = `900 ${kSize}px "Poppins", "Montserrat", sans-serif`;
    ctxFore.textAlign = 'center';
    ctxFore.textBaseline = 'middle';

    // Pass 1: Blinding White Optical Flare Bloom
    ctxFore.save();
    ctxFore.globalCompositeOperation = 'lighter';
    ctxFore.shadowColor = 'rgba(255, 255, 255, 0.55)';
    ctxFore.shadowBlur = Math.round(base * 0.12);
    ctxFore.fillStyle = '#FFFFFF';
    ctxFore.fillText(txt1, 0, 0);

    ctxFore.shadowColor = 'rgba(255, 255, 255, 0.90)';
    ctxFore.shadowBlur = Math.round(base * 0.04);
    ctxFore.fillText(txt1, 0, 0);
    ctxFore.restore();

    // Pass 2: Bevel Shadow
    ctxFore.fillStyle = '#0F172A';
    ctxFore.fillText(txt1, 0, 2.5);

    // Pass 3: Multi-Stop Specular Metallic Chrome Gradient
    const grad = ctxFore.createLinearGradient(0, -kSize / 2, 0, kSize / 2);
    grad.addColorStop(0.0, '#FFFFFF');
    grad.addColorStop(0.35, '#E2E8F0');
    grad.addColorStop(0.55, '#94A3B8');
    grad.addColorStop(0.75, '#475569');
    grad.addColorStop(1.0, '#CBD5E1');
    ctxFore.fillStyle = grad;
    ctxFore.fillText(txt1, 0, 0);

    // Pass 4: Top Specular Sheen Stroke
    ctxFore.strokeStyle = '#FFFFFF';
    ctxFore.lineWidth = Math.max(1, Math.round(base * 0.003));
    ctxFore.strokeText(txt1, 0, -0.6);

    ctxFore.restore();
  }

  // --- Line 2: Tracked-Out Crisp White Subtext ("A C A D E M Y" - Frame 15) ---
  if (subWords.length) {
    const rawSub = subWords.map(w => w.t.toUpperCase()).join(' ');
    const txt2 = rawSub.split('').join('  ');
    const anim2 = getWordPop(subWords[0], t, showAll, st.animation);

    ctxFore.save();
    ctxFore.translate(W / 2 + (anim2.dx || 0), y2 + (anim2.dy || 0));
    ctxFore.scale(anim2.scale || 1, anim2.scale || 1);
    if (typeof anim2.opacity === 'number') ctxFore.globalAlpha *= anim2.opacity;
    ctxFore.font = `700 ${fSize}px "Inter", "Helvetica", sans-serif`;
    ctxFore.textAlign = 'center';
    ctxFore.textBaseline = 'middle';
    ctxFore.fillStyle = '#FFFFFF';
    ctxFore.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctxFore.shadowBlur = 8;
    ctxFore.fillText(txt2, 0, 0);
    ctxFore.restore();
  }
}

const VIRAL_COMBOS = [
  { small: '#FFFFFF', big: '#FFE600', glow: '#FFE600' }, // Cyber Yellow & White
  { small: '#E0F2FE', big: '#00F0FF', glow: '#00F0FF' }, // Neon Cyan & Ice
  { small: '#FFFFFF', big: '#FF4D00', glow: '#FF6A00' }, // Sunset Flame & White
  { small: '#FFFFFF', big: '#39FF14', glow: '#39FF14' }, // Toxic Lime & White
  { small: '#FFFFFF', big: '#FF1493', glow: '#FF69B4' }, // Hot Pink & White
  { small: '#F3E8FF', big: '#C084FC', glow: '#A855F7' }, // Electric Violet & Lavender
  { small: '#FEF9C3', big: '#FFD700', glow: '#F59E0B' }, // Imperial Gold & Soft Yellow
  { small: '#F0FDFA', big: '#10B981', glow: '#34D399' }, // Emerald Mint & Snow
];

function canvasRolePaint(ctx, role, fallback, extent) {
  const gradientCss = role && (role.keyGradient || role.textGradient);
  if (!gradientCss || typeof gradientCss !== 'string') return fallback;
  const match = gradientCss.match(/linear-gradient\(\s*([-\d.]+)deg\s*,\s*(.+)\)/i);
  if (!match || !ctx.createLinearGradient) return fallback;
  const rawParts = match[2].split(/,(?![^()]*\))/).map(c => c.trim()).filter(Boolean);
  if (rawParts.length < 2) return rawParts[0] || fallback;
  const radians = (parseFloat(match[1]) - 90) * Math.PI / 180;
  const dx = Math.cos(radians) * extent / 2, dy = Math.sin(radians) * extent / 2;
  const gradient = ctx.createLinearGradient(-dx, -dy, dx, dy);
  rawParts.forEach((part, index) => {
    const tokens = part.trim().split(/\s+/);
    let color = tokens[0];
    let stop = index / (rawParts.length - 1);
    if (tokens.length > 1 && tokens[1].endsWith('%')) {
      stop = Math.max(0, Math.min(1, parseFloat(tokens[1]) / 100));
    }
    try {
      gradient.addColorStop(stop, color);
    } catch (e) {}
  });
  return gradient;
}

function drawStandardCanvasPass(ctxFore, ctxBehind, words, t, st, W, H, base, isBehind, showAll) {
  const ctx = isBehind && ctxBehind ? ctxBehind : ctxFore;
  if (!words || !words.length) return;
  const kRole = st.key || {}, fRole = st.filler || {};
  const cY = H * (st.position || 0.68);

  // 1. Split into 2 lines
  let line1 = [], line2 = [];
  if (words.length === 1) {
    line2 = [words[0]];
  } else if (words.length === 2) {
    line1 = [words[0]];
    line2 = [words[1]];
  } else if (words.length === 3) {
    line1 = [words[0], words[1]];
    line2 = [words[2]];
  } else if (words.length === 4) {
    line1 = [words[0], words[1]];
    line2 = [words[2], words[3]];
  } else {
    const splitIdx = Math.max(1, Math.floor(words.length / 2));
    line1 = words.slice(0, splitIdx);
    line2 = words.slice(splitIdx);
  }

  // 2. Word sizing: small words + one BIG word at last
  let smallFs = Math.max(14, Math.round(base * (fRole.size || 0.072)));
  let bigFs = Math.max(20, Math.round(base * (kRole.size || 0.12)));
  const leading = 1.12;
  const keyItalic = kRole.italic ? 'italic ' : '';
  const fillerItalic = fRole.italic ? 'italic ' : '';
  const keyWeight = kRole.bold !== false ? 900 : 700;
  const fillerWeight = fRole.bold ? 700 : 500;
  const keyFontFam = (kRole.font ? `"${kRole.font}", ` : "") + '"Montserrat", "Poppins", sans-serif';
  const fillerFontFam = (fRole.font ? `"${fRole.font}", ` : "") + '"Montserrat", "Poppins", sans-serif';

  // 3. Different combinations of colours
  let smallColor = fRole.color || '#FFFFFF';
  let bigColor = (st.highlight && st.highlight.color) || kRole.color || st.highlightColor || '#FFE600';
  let glowColor = kRole.glow || bigColor;

  const hasExplicitColor = !!(kRole.keyGradient || (st.highlight && st.highlight.color) || (kRole.color && kRole.color !== '#FFFFFF' && kRole.color !== 'white'));
  if (!hasExplicitColor) {
    const hash = Math.abs((words[0]?.t || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) + (words.length * 5));
    const combo = VIRAL_COMBOS[hash % VIRAL_COMBOS.length];
    smallColor = combo.small;
    bigColor = combo.big;
    glowColor = combo.glow;
  }

  // Animation calculation
  const anim1 = line1.length ? getWordPop(line1[0], t, showAll, st.animation) : { visible: false, scale: 1 };
  const lastWord = line2[line2.length - 1];
  const anim2 = getWordPop(lastWord, t, showAll, st.animation);

  const txt1 = line1.map(w => (fRole.upper !== false ? w.t.toUpperCase() : w.t)).join(' ');
  const earlyWords = line2.slice(0, -1);
  const earlyTxt = earlyWords.map(w => (fRole.upper !== false ? w.t.toUpperCase() : w.t)).join(' ');
  const lastTxt = lastWord ? (kRole.upper !== false ? lastWord.t.toUpperCase() : lastWord.t) : '';

  // Scale both caption lines together so even long phrases stay within the safe frame.
  ctx.save();
  ctx.font = `${fillerItalic}${fillerWeight} ${smallFs}px ${fillerFontFam}`;
  const line1Width = line1.length ? ctx.measureText(txt1).width : 0;
  const earlyWidth = earlyWords.length ? ctx.measureText(earlyTxt).width : 0;
  ctx.font = `${keyItalic}${keyWeight} ${bigFs}px ${keyFontFam}`;
  const lastWidth = lastTxt ? ctx.measureText(lastTxt).width : 0;
  ctx.restore();
  const naturalLine2Width = earlyWords.length ? earlyWidth + smallFs * 0.42 + lastWidth : lastWidth;
  const fitScale = Math.min(1, W * 0.84 / Math.max(1, line1Width, naturalLine2Width));
  smallFs = Math.max(11, Math.floor(smallFs * fitScale));
  bigFs = Math.max(16, Math.floor(bigFs * fitScale));
  const topPad = line1.length ? smallFs * leading * 0.72 : 0;
  const bottomPad = bigFs * leading * 0.65;
  const anchorY = Math.max(topPad + 8, Math.min(H - bottomPad - 8, cY));
  const y1 = line1.length ? (anchorY - topPad) : anchorY;
  const y2 = line1.length ? (anchorY + bottomPad) : anchorY;

  let totalW2 = 0, startX = 0, lastX = 0;
  if (line2.length) {
    if (earlyWords.length) {
      ctx.save();
      ctx.font = `${fillerItalic}${fillerWeight} ${smallFs}px ${fillerFontFam}`;
      const earlyW = ctx.measureText(earlyTxt).width;
      ctx.font = `${keyItalic}${keyWeight} ${bigFs}px ${keyFontFam}`;
      const lastW = ctx.measureText(lastTxt).width;
      ctx.restore();
      const gapW = smallFs * 0.42;
      totalW2 = earlyW + gapW + lastW;
      startX = -totalW2 / 2;
      lastX = startX + earlyW + gapW;
    }
  }

  // --- Background Pill backing (e.g. terminal_type or retro_tv) ---
  if (st.pill) {
    const totalBoxW = Math.max(line1Width, naturalLine2Width) + smallFs * 1.5;
    const totalBoxH = (y2 - y1) + bigFs * 1.4;
    const pillY = (y1 + y2) / 2;
    ctx.save();
    ctx.fillStyle = st.pill;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(W / 2 - totalBoxW / 2, pillY - totalBoxH / 2, totalBoxW, totalBoxH, 10) : ctx.rect(W / 2 - totalBoxW / 2, pillY - totalBoxH / 2, totalBoxW, totalBoxH);
    ctx.fill();
    ctx.restore();
  }

  // --- PASS 1: High-Contrast Crisp Solid Base with Black Outline & Drop Shadow ---
  // Line 1: Small words
  if (line1.length) {
    ctx.save();
    ctx.translate(W / 2 + (anim1.dx || 0), y1 + (anim1.dy || 0));
    ctx.scale(anim1.scale || 1, anim1.scale || 1);
    if (typeof anim1.opacity === 'number') ctx.globalAlpha = anim1.opacity;
    ctx.font = `${fillerItalic}${fillerWeight} ${smallFs}px ${fillerFontFam}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = fRole.shadowColor || 'rgba(0, 0, 0, 0.90)';
    ctx.shadowBlur = Math.round(base * 0.02) + 6;
    ctx.strokeStyle = fRole.outlineColor || '#000000';
    ctx.lineWidth = Math.max(2, Math.round(smallFs * 0.15));
    ctx.strokeText(txt1, 0, 0);
    ctx.fillStyle = canvasRolePaint(ctx, fRole, smallColor, base);
    ctx.fillText(txt1, 0, 0);
    ctx.restore();
  }

  // Line 2: Small earlier words + BIG LAST WORD
  if (line2.length) {
    ctx.save();
    ctx.translate(W / 2 + (anim2.dx || 0), y2 + (anim2.dy || 0));
    ctx.scale(anim2.scale || 1, anim2.scale || 1);
    if (typeof anim2.opacity === 'number') ctx.globalAlpha = anim2.opacity;
    ctx.textBaseline = 'middle';

    const isBoxMode = st.highlight && st.highlight.mode === 'box';

    if (earlyWords.length) {
      // Earlier words (small)
      ctx.font = `${fillerItalic}${fillerWeight} ${smallFs}px ${fillerFontFam}`;
      ctx.textAlign = 'left';
      ctx.shadowColor = fRole.shadowColor || 'rgba(0, 0, 0, 0.90)';
      ctx.shadowBlur = Math.round(base * 0.02) + 6;
      ctx.strokeStyle = fRole.outlineColor || '#000000';
      ctx.lineWidth = Math.max(2, Math.round(smallFs * 0.15));
      ctx.strokeText(earlyTxt, startX, 0);
      ctx.fillStyle = canvasRolePaint(ctx, fRole, smallColor, base);
      ctx.fillText(earlyTxt, startX, 0);

      // BIG last word
      ctx.font = `${keyItalic}${keyWeight} ${bigFs}px ${keyFontFam}`;
      if (isBoxMode) {
        const padX = Math.max(6, Math.round(bigFs * 0.22));
        const padY = Math.max(3, Math.round(bigFs * 0.12));
        const boxW = lastWidth + padX * 2;
        const boxH = bigFs * 1.18;
        ctx.save();
        ctx.fillStyle = st.highlight.color || '#FFE600';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(lastX - padX, -boxH / 2, boxW, boxH, 6) : ctx.rect(lastX - padX, -boxH / 2, boxW, boxH);
        ctx.fill();
        ctx.restore();

        ctx.fillStyle = st.highlight.textColor || '#111111';
        ctx.fillText(lastTxt, lastX, 0);
      } else {
        ctx.shadowColor = kRole.shadowColor || 'rgba(0, 0, 0, 0.90)';
        ctx.shadowBlur = Math.round(base * 0.02) + 8;
        ctx.strokeStyle = kRole.outlineColor || '#000000';
        ctx.lineWidth = Math.max(3, Math.round(bigFs * 0.18));
        ctx.strokeText(lastTxt, lastX, 0);
        ctx.fillStyle = canvasRolePaint(ctx, kRole, bigColor, base);
        ctx.fillText(lastTxt, lastX, 0);
      }
    } else {
      // Single last word on line 2 (BIG, centered)
      ctx.font = `${keyItalic}${keyWeight} ${bigFs}px ${keyFontFam}`;
      ctx.textAlign = 'center';
      if (isBoxMode) {
        const padX = Math.max(8, Math.round(bigFs * 0.24));
        const boxW = lastWidth + padX * 2;
        const boxH = bigFs * 1.18;
        ctx.save();
        ctx.fillStyle = st.highlight.color || '#FFE600';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(-boxW / 2, -boxH / 2, boxW, boxH, 6) : ctx.rect(-boxW / 2, -boxH / 2, boxW, boxH);
        ctx.fill();
        ctx.restore();

        ctx.fillStyle = st.highlight.textColor || '#111111';
        ctx.fillText(lastTxt, 0, 0);
      } else {
        ctx.shadowColor = kRole.shadowColor || 'rgba(0, 0, 0, 0.90)';
        ctx.shadowBlur = Math.round(base * 0.02) + 8;
        ctx.strokeStyle = kRole.outlineColor || '#000000';
        ctx.lineWidth = Math.max(3, Math.round(bigFs * 0.18));
        ctx.strokeText(lastTxt, 0, 0);
        ctx.fillStyle = canvasRolePaint(ctx, kRole, bigColor, base);
        ctx.fillText(lastTxt, 0, 0);
      }
    }
    ctx.restore();
  }

  // --- PASS 2: Optical 10% Screen Blend (Gentle glow accent) ---
  ctx.save();
  const blendMode = ['screen', 'soft-light', 'overlay', 'lighter'].includes(st.blendMode) ? st.blendMode : 'screen';
  ctx.globalCompositeOperation = blendMode;
  ctx.globalAlpha = blendMode === 'screen' ? 0.10 : 0.08;
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = Math.round(base * 0.07);
  ctx.fillStyle = glowColor;

  if (line1.length) {
    ctx.save();
    ctx.translate(W / 2 + (anim1.dx || 0), y1 + (anim1.dy || 0));
    ctx.scale(anim1.scale || 1, anim1.scale || 1);
    if (typeof anim1.opacity === 'number') ctx.globalAlpha *= anim1.opacity;
    ctx.font = `${fillerItalic}${fillerWeight} ${smallFs}px ${fillerFontFam}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(txt1, 0, 0);
    ctx.restore();
  }

  if (line2.length && !(st.highlight && st.highlight.mode === 'box')) {
    ctx.save();
    ctx.translate(W / 2 + (anim2.dx || 0), y2 + (anim2.dy || 0));
    ctx.scale(anim2.scale || 1, anim2.scale || 1);
    if (typeof anim2.opacity === 'number') ctx.globalAlpha *= anim2.opacity;
    ctx.textBaseline = 'middle';
    if (earlyWords.length) {
      ctx.font = `${fillerItalic}${fillerWeight} ${smallFs}px ${fillerFontFam}`;
      ctx.textAlign = 'left';
      ctx.fillText(earlyTxt, startX, 0);
      ctx.font = `${keyItalic}${keyWeight} ${bigFs}px ${keyFontFam}`;
      ctx.fillText(lastTxt, lastX, 0);
    } else {
      ctx.font = `${keyItalic}${keyWeight} ${bigFs}px ${keyFontFam}`;
      ctx.textAlign = 'center';
      ctx.fillText(lastTxt, 0, 0);
    }
    ctx.restore();
  }
  ctx.restore();
}

function drawEstateDepthPass(ctxFore, ctxBehind, words, t, st, W, H, base, showAll, capId) {
  if (!words || !words.length) return;
  const hero = words[words.length - 1];
  const heroAnim = getWordPop(hero, t, showAll, st.animation);
  const alternateHero = st.accent2 && Math.max(0, Number(capId || 1) - 1) % 2 === 1;
  const kRole = (alternateHero && st.accent2) || st.key || {}, fRole = st.filler || {};
  const heroFont = (kRole.font ? '"' + kRole.font + '", ' : '') + '"Montserrat", "Poppins", sans-serif';
  const foreFont = (fRole.font ? '"' + fRole.font + '", ' : '') + '"Montserrat", "Poppins", sans-serif';

  // Only the oversized keyword sits on the depth canvas; the segmented person stays above it.
  const ctxHero = ctxBehind || ctxFore;
  if (ctxHero) {
    const ctx = ctxHero;
    const heroText = hero.t.toUpperCase();
    const fs = Math.round(base * (st.depthAccentSize || 0.22));
    ctx.save();
    ctx.translate(W / 2 + (heroAnim.dx || 0), H * (st.depthAccentY || 0.41) + (heroAnim.dy || 0));
    ctx.scale(heroAnim.scale || 1, heroAnim.scale || 1);
    if (typeof heroAnim.opacity === 'number') ctx.globalAlpha = heroAnim.opacity;
    ctx.font = (kRole.italic ? 'italic ' : '') + (kRole.bold ? 900 : 800) + ' ' + fs + 'px ' + heroFont;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const width = Math.max(1, ctx.measureText(heroText).width);
    const stretch = 1.10;
    const fit = Math.min(1, W * 0.88 / (width * stretch));
    ctx.scale(stretch * fit, 1);
    const blendMode = ['screen', 'soft-light', 'overlay', 'lighter'].includes(st.blendMode) ? st.blendMode : 'screen';
    // Keep the preset's lettering color while avoiding a second colored halo layer.
    ctx.shadowColor = 'rgba(0,0,0,.30)';
    ctx.shadowBlur = Math.max(2, Math.round(base * 0.006));
    if (kRole.outline > 0) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(1, Math.round(base * kRole.outline));
      ctx.strokeStyle = kRole.outlineColor || '#000000';
      ctx.strokeText(heroText, 0, 0);
    }
    ctx.fillStyle = canvasRolePaint(ctx, kRole, kRole.color || st.highlightColor || '#F4CE83', base);
    ctx.fillText(heroText, 0, 0);
    ctx.restore();
  }

  // Readable subtitle remains in front and below the face, with restrained color accents.
  const subtitle = words.length > 1 ? words.slice(0, -1) : [];
  if (!ctxFore || !subtitle.length) return;
  const ctx = ctxFore;
  const text = subtitle.map(w => w.t.toUpperCase()).join(' ');
  let fs = Math.max(16, Math.round(base * (st.subtitleSize || 0.058)));
  ctx.save();
  ctx.font = (fRole.italic ? 'italic ' : '') + (fRole.bold ? 800 : 700) + ' ' + fs + 'px ' + foreFont;
  fs = Math.max(14, Math.floor(fs * Math.min(1, W * 0.84 / Math.max(1, ctx.measureText(text).width))));
  ctx.translate(W / 2, Math.max(fs + 8, Math.min(H - fs - 8, H * (st.subtitlePosition || 0.76))));
  ctx.font = (fRole.italic ? 'italic ' : '') + (fRole.bold ? 800 : 700) + ' ' + fs + 'px ' + foreFont;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,.48)';
  ctx.shadowBlur = Math.max(2, Math.round(base * 0.008));
  if (fRole.outline > 0) {
    ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(1, Math.round(base * fRole.outline));
    ctx.strokeStyle = fRole.outlineColor || '#000000'; ctx.strokeText(text, 0, 0);
  }
  let x = -ctx.measureText(text).width / 2;
  const accent = kRole.color || st.highlightColor || '#F4CE83';
  for (let i = 0; i < subtitle.length; i++) {
    const part = subtitle[i].t.toUpperCase() + (i < subtitle.length - 1 ? ' ' : '');
    ctx.fillStyle = (i % 2 === 1) ? accent : (fRole.color || '#FFFFFF');
    ctx.fillText(part, x, 0);
    x += ctx.measureText(part).width;
  }
  ctx.restore();
}

function drawSpecialFrontPass(ctx, words, t, st, W, H, base, showAll, capId) {
  if (!ctx || !words.length) return;
  const mode = st.mode || 'emphasis';
  const subtitleRole = st.filler || {};
  const activeRole = st.activeRole || st.key || {};
  const subtitleY = H * (st.subtitlePosition || 0.72);
  const heroY = H * (st.depthAccentY || st.position || 0.42);

  function drawLine(items, y, maxWidth, fallbackRole) {
    if (!items.length) return;
    const measured = [];
    ctx.save();
    let total = 0;
    for (const item of items) {
      const role = item.role || fallbackRole;
      const size = Math.max(14, Math.round(base * (role.size || 0.07)));
      const weight = role.bold ? 800 : 500;
      const font = (role.italic ? 'italic ' : '') + `${weight} ${size}px "${role.font || 'Montserrat'}",sans-serif`;
      ctx.font = font;
      if ('letterSpacing' in ctx) ctx.letterSpacing = `${(role.track || 0) * size}px`;
      const label = role.upper ? item.word.t.toUpperCase() : item.word.t;
      const width = ctx.measureText(label).width;
      measured.push({ ...item, role, size, font, label, width });
      total += width + size * 0.10;
    }
    const fit = Math.min(1, maxWidth / Math.max(1, total));
    ctx.translate(W / 2, y);
    ctx.scale(fit, 1);
    let x = -total / 2;
    for (const item of measured) {
      const role = item.role;
      ctx.save();
      ctx.translate(x + (item.anim?.dx || 0), item.anim?.dy || 0);
      ctx.scale(item.anim?.scale || 1, item.anim?.scale || 1);
      if (typeof item.anim?.opacity === 'number') ctx.globalAlpha *= item.anim.opacity;
      ctx.font = item.font;
      if ('letterSpacing' in ctx) ctx.letterSpacing = `${(role.track || 0) * item.size}px`;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,.55)';
      ctx.shadowBlur = Math.max(1, Math.round(base * 0.004));
      if (role.outline > 0) {
        ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(1, role.outline * base);
        ctx.strokeStyle = role.outlineColor || '#000000'; ctx.strokeText(item.label, 0, 0);
      }
      ctx.fillStyle = canvasRolePaint(ctx, role, role.color || '#FFFFFF', base);
      ctx.fillText(item.label, 0, 0);
      ctx.restore();
      x += item.width + item.size * 0.10;
    }
    ctx.restore();
  }

  if (mode === 'highlight') {
    const current = words.findIndex(word => t >= word.s && t < word.e);
    const activeIndex = current >= 0 ? current : (words.length - 1);
    const items = words.map((word, index) => {
      const raw = index === activeIndex ? (st.roles?.active || {}) : (st.roles?.base || {});
      const role = index === activeIndex ? activeRole : subtitleRole;
      return { word, role, anim: getWordPop(word, t, showAll, raw.enter || st.animation) };
    });
    drawLine(items, H * (st.position || 0.72), W * 0.90, subtitleRole);
    return;
  }

  if (words.length === 1) {
    const hero = words[0];
    const heroRole = st.key || {};
    const rawHero = st.roles?.accent || {};
    const heroAnim = getWordPop(hero, t, showAll, rawHero.enter || st.animation);
    drawLine([{ word: hero, role: heroRole, anim: heroAnim }], H * (st.position || 0.68), W * 0.90, heroRole);
    return;
  }

  const hero = words[words.length - 1];
  const alt = st.accent2 && Math.max(0, Number(capId || 1) - 1) % 2 === 1;
  const heroRole = (alt && st.accent2) || st.key || {};
  const rawHero = alt ? (st.roles?.accent2 || {}) : (st.roles?.accent || {});
  const heroAnim = getWordPop(hero, t, showAll, rawHero.enter || st.animation);
  drawLine([{ word: hero, role: heroRole, anim: heroAnim }], heroY, W * 0.90, heroRole);

  const subtitles = words.slice(0, -1).map(word => ({
    word,
    role: subtitleRole,
    anim: getWordPop(word, t, showAll, (st.roles?.base || {}).enter || st.animation)
  }));
  drawLine(subtitles, subtitleY, W * 0.86, subtitleRole);
}

function drawCanvasTypography(ctxFore, ctxBehind, cap, words, t, st, W, H, isBehind, showAll) {
  if (!ctxFore) return;
  const base = Math.min(W, H) * Math.max(0.6, Math.min(1.5, Number(st.fontScale) || 1));
  const presetId = st.id || '';
  const offsetX = (Number(st.offsetX) || 0) * W;
  ctxFore.save(); ctxFore.translate(offsetX, 0);
  if (ctxBehind && ctxBehind !== ctxFore) { ctxBehind.save(); ctxBehind.translate(offsetX, 0); }
  if (st.isSpecial && st.depthAccent) {
    drawEstateDepthPass(ctxFore, ctxBehind, words, t, st, W, H, base, showAll, cap.id);
  } else if (st.isSpecial) {
    drawSpecialFrontPass(ctxFore, words, t, st, W, H, base, showAll, cap.id);
  } else if (st.depthAccent) {
    drawEstateDepthPass(ctxFore, ctxBehind, words, t, st, W, H, base, showAll, cap.id);
  } else if (presetId === 'ref_dual_neon' || st.refDualNeon) {
    drawDualNeonPass(ctxFore, ctxBehind, words, t, st, W, H, base, isBehind, showAll);
  } else if (presetId === 'ref_kinetic_split' || st.chromaticAberration) {
    drawKineticLensPass(ctxFore, ctxBehind, words, t, st, W, H, base, isBehind, showAll);
  } else if (presetId === 'ref_crimson_3d' || st.shadow3D || presetId.includes('crimson')) {
    drawCrimson3DPass(ctxFore, ctxBehind, words, t, st, W, H, base, isBehind, showAll);
  } else if (presetId === 'ref_chrome_studio' || st.chromeSpecular || presetId.includes('chrome')) {
    drawChromeStudioPass(ctxFore, ctxBehind, words, t, st, W, H, base, isBehind, showAll);
  } else {
    drawStandardCanvasPass(ctxFore, ctxBehind, words, t, st, W, H, base, isBehind, showAll);
  }
  if (ctxBehind && ctxBehind !== ctxFore) ctxBehind.restore();
  ctxFore.restore();
}

// Preview caption controls: drag to position, wheel/trackpad to resize.
let captionAdjustMode = false, captionDrag = null;
function syncCaptionScaleControl() {
  const value = Math.round((Number(S.style?.fontScale) || 1) * 100);
  if ($('captionScale')) $('captionScale').value = value;
  if ($('captionScaleOut')) $('captionScaleOut').textContent = value + '%';
}
if ($('captionAdjustBtn')) $('captionAdjustBtn').addEventListener('click', () => {
  captionAdjustMode = !captionAdjustMode;
  $('captionAdjustBtn').setAttribute('aria-pressed', String(captionAdjustMode));
  $('captionAdjustBtn').classList.toggle('on', captionAdjustMode);
  stage.classList.toggle('caption-adjust-mode', captionAdjustMode);
  if (captionAdjustMode) notice('Drag over a caption to move it. Use the mouse wheel to resize.', 'ok');
});
if ($('captionScale')) $('captionScale').addEventListener('input', e => {
  if (!S.style) return;
  S.style.fontScale = Math.max(.6, Math.min(1.5, Number(e.target.value) / 100));
  syncCaptionScaleControl(); touchStyle();
});
stage.addEventListener('pointerdown', e => {
  if (!captionAdjustMode || !S.style || !S.captions.length) return;
  const r = stage.getBoundingClientRect(), y = (e.clientY - r.top) / r.height;
  const st = S.style;
  let target = 'position';
  if (st.isSpecial && st.mode !== 'highlight') {
    const heroY = Number(st.depthAccentY || st.position || .42);
    const subtitleY = Number(st.subtitlePosition || .72);
    target = Math.abs(y - heroY) < Math.abs(y - subtitleY) ? 'depthAccentY' : 'subtitlePosition';
  }
  captionDrag = { target, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY,
    x: Number(st.offsetX) || 0, y: Number(st[target] || st.position || .72) };
  stage.setPointerCapture(e.pointerId); e.preventDefault();
});
stage.addEventListener('pointermove', e => {
  if (!captionDrag || e.pointerId !== captionDrag.pointerId) return;
  const r = stage.getBoundingClientRect();
  S.style.offsetX = Math.max(-.10, Math.min(.10, captionDrag.x + (e.clientX - captionDrag.startX) / r.width));
  S.style[captionDrag.target] = Math.max(.05, Math.min(.95, captionDrag.y + (e.clientY - captionDrag.startY) / r.height));
  touchStyle();
});
function endCaptionDrag(e) {
  if (!captionDrag || (e && e.pointerId !== captionDrag.pointerId)) return;
  captionDrag = null;
}
stage.addEventListener('pointerup', endCaptionDrag);
stage.addEventListener('pointercancel', endCaptionDrag);
stage.addEventListener('wheel', e => {
  if (!captionAdjustMode || !S.style) return;
  e.preventDefault();
  S.style.fontScale = Math.max(.6, Math.min(1.5, (Number(S.style.fontScale) || 1) + (e.deltaY < 0 ? .04 : -.04)));
  syncCaptionScaleControl(); touchStyle();
}, { passive:false });
syncCaptionScaleControl();

function renderCaption(t) {
  let cap = activeCaption(t);
  const showAll = Boolean(vid.paused || !cap);
  if (!cap && vid.paused && S.selected != null) { cap = S.captions.find(c => c.id === S.selected); }
  
  if (capbox) capbox.textContent = '';
  const cBehind = $('capboxBehind');
  if (cBehind) cBehind.textContent = '';

  const W = stage.clientWidth, H = stage.clientHeight;
  const dpr = window.devicePixelRatio || 1;

  if (capCanvas && (capCanvas.width !== Math.round(W * dpr) || capCanvas.height !== Math.round(H * dpr))) {
    capCanvas.width = Math.round(W * dpr);
    capCanvas.height = Math.round(H * dpr);
  }
  if (capCanvasBehind && (capCanvasBehind.width !== Math.round(W * dpr) || capCanvasBehind.height !== Math.round(H * dpr))) {
    capCanvasBehind.width = Math.round(W * dpr);
    capCanvasBehind.height = Math.round(H * dpr);
  }

  if (capCtx) {
    capCtx.setTransform(1, 0, 0, 1, 0, 0);
    capCtx.clearRect(0, 0, capCanvas.width, capCanvas.height);
    capCtx.scale(dpr, dpr);
  }
  if (capCtxBehind) {
    capCtxBehind.setTransform(1, 0, 0, 1, 0, 0);
    capCtxBehind.clearRect(0, 0, capCanvasBehind.width, capCanvasBehind.height);
    capCtxBehind.scale(dpr, dpr);
  }

  if (!cap) {
    stage.classList.remove('behind-active');
    return;
  }

  const st = S.style || {};
  const isBehind = !!st.behindPerson;
  stage.classList.toggle('behind-active', isBehind);

  const words = capWords(cap);
  if (!words || !words.length) return;

  drawCanvasTypography(capCtx, capCtxBehind, cap, words, t, st, W, H, isBehind, showAll);
}

// ------------------------------------------------------------------ dynamic responsive stage (NO BLANK SPACES)
function fitStageToVideo() {
  const wrap = $('canvasWrap') || document.querySelector('.canvas-wrap') || document.querySelector('.stagewrap');
  if (!wrap) return;
  const wrapW = wrap.clientWidth - 24;
  const wrapH = wrap.clientHeight - 24;
  if (wrapW <= 0 || wrapH <= 0) return;

  let vidW = vid.videoWidth || (S.meta && S.meta.width) || 1080;
  let vidH = vid.videoHeight || (S.meta && S.meta.height) || 1920;

  if (S.aspect && S.aspect !== 'original') {
    const parts = S.aspect.split(':').map(Number);
    if (parts.length === 2 && parts[0] && parts[1]) {
      vidW = parts[0];
      vidH = parts[1];
    }
  }

  const ar = vidW / vidH;
  let targetW = wrapW;
  let targetH = targetW / ar;
  if (targetH > wrapH) {
    targetH = wrapH;
    targetW = targetH * ar;
  }

  stage.style.width = Math.round(targetW) + 'px';
  stage.style.height = Math.round(targetH) + 'px';
  stage.style.setProperty('--ar', ar);
}
window.addEventListener('resize', fitStageToVideo);
window.addEventListener('orientationchange', () => setTimeout(fitStageToVideo, 250));
vid.addEventListener('loadedmetadata', fitStageToVideo);

// ------------------------------------------------------------------ motion graphics stage overlay (3D Reference Video Suite)
function renderMotionGraphics(t) {
  if (!mgStage) return;
  let active = S.graphics.filter(g => g.enabled !== false && t >= g.start && t <= g.end);
  if (!active.length && vid.paused && S.selectedGraphic) {
    const sel = S.graphics.find(g => g.id === S.selectedGraphic);
    if (sel && sel.enabled !== false) active = [sel];
  }
  const sig = active.map(g => `${g.id}:${g.start}:${g.end}:${JSON.stringify(g.data)}:${g.position}:${g.id === S.selectedGraphic}`).join('|');
  if (mgStage.dataset.sig === sig && !S.graphicDirty) return;
  mgStage.dataset.sig = sig;
  S.graphicDirty = false;
  mgStage.textContent = '';

  for (const g of active) {
    const isSel = (g.id === S.selectedGraphic);
    const pos = g.position || 'bottom_left';
    const enterAnim = (g.animation && g.animation.enter) || 'fade_slide_down';
    const card = el('div', { class: `mg-card mg-pos-${pos} mg-anim-${enterAnim}${isSel ? ' sel' : ''}` });
    const inner = el('div', { class: 'mg-card-inner' });
    const acc = (g.data && g.data.accentColor) || '#38bdf8';
    const bg = (g.data && g.data.bgColor) || 'rgba(15, 23, 42, 0.92)';
    inner.style.borderColor = acc;
    inner.style.background = bg;

    // ========================================================
    // TRUE 3D REFERENCE VISUALS (NO CARD BOXES - 1:1 FIDELITY)
    // ========================================================
    if (g.type === 'isometric_phone_card') {
      const wrapper = el('div', { class: `mg-card mg-pos-${pos} mg-anim-${enterAnim}${isSel ? ' sel' : ''}`, style: 'background:transparent;border:none;box-shadow:none;' });
      wrapper.innerHTML = `
        <div class="mg-phone-3d-wrapper">
          <div class="mg-phone-3d-body">
            <div class="mg-phone-notch"></div>
            <div class="mg-phone-header">
              <div class="mg-phone-avatar">⚡</div>
              <div class="mg-phone-profile-info">
                <b>${(g.data && g.data.handle) || '@creator_studio'}</b>
                <span>${(g.data && g.data.followers) || '+328'} followers · 53 posts</span>
              </div>
            </div>
            <div class="mg-phone-actions">
              <div class="mg-phone-btn">Edit profile</div>
              <div class="mg-phone-btn">Share profile</div>
            </div>
            <div class="mg-phone-cards-layer">
              <div class="mg-phone-3d-card mg-phone-card-1">
                <div style="font-size:8px;font-weight:800;color:#c084fc;">★ REEL</div>
                <div style="font-size:10px;font-weight:800;margin-top:2px;">Slate Life</div>
                <div style="font-size:8px;color:#94a3b8;margin-top:34px;">👁 ${(g.data && g.data.views) || '3,878'}</div>
              </div>
              <div class="mg-phone-3d-card mg-phone-card-2">
                <div style="font-size:9px;font-weight:900;color:#38bdf8;">BLENDER 3D</div>
                <div style="font-size:8px;opacity:0.85;margin-top:2px;">Motion Pro</div>
                <div style="font-size:8px;font-weight:800;color:#FFE600;margin-top:45px;">⚡ ${(g.data && g.data.followers) || '+328'} FOLLOWER</div>
              </div>
            </div>
            <div class="mg-phone-bottom-nav">
              <span>⌂</span><span>🔍</span><span>▶</span><span>👤</span>
            </div>
          </div>
        </div>
      `;
      wrapper.onclick = (e) => { e.stopPropagation(); selectGraphic(g.id); };
      mgStage.append(wrapper);
      continue;
    } else if (g.type === 'neon_badge_aura') {
      const wrapper = el('div', { class: `mg-card mg-pos-${pos} mg-anim-${enterAnim}${isSel ? ' sel' : ''}`, style: 'background:transparent;border:none;box-shadow:none;' });
      const title = (g.data && g.data.title) || 'SLATE';
      const sub = (g.data && g.data.subtitle) || 'ACADEMY';
      wrapper.innerHTML = `
        <div class="mg-neon-cube-wrapper">
          <div class="mg-neon-cube-body">
            <b>${title}</b>
            <span>${sub}</span>
          </div>
        </div>
      `;
      wrapper.onclick = (e) => { e.stopPropagation(); selectGraphic(g.id); };
      mgStage.append(wrapper);
      continue;
    } else if (g.type === 'crimson_ambient_spotlight' || g.type === 'occlusion_prison_bars') {
      const wrapper = el('div', { class: `mg-card mg-bars-scene mg-anim-${enterAnim}${isSel ? ' sel' : ''}`, style: 'inset:0;width:100%;height:100%;background:transparent;border:none;box-shadow:none;' });
      const txt = (g.data && (g.data.title || g.data.text)) || 'life is cell';
      wrapper.innerHTML = `
        <div class="mg-bars-grid">
          <div class="mg-bar-pole"></div>
          <div class="mg-bar-pole"></div>
          <div class="mg-bar-pole"></div>
          <div class="mg-bar-pole"></div>
          <div class="mg-bar-pole"></div>
          <div class="mg-bar-pole"></div>
        </div>
        <div class="mg-bars-text">${txt}</div>
      `;
      wrapper.onclick = (e) => { e.stopPropagation(); selectGraphic(g.id); };
      mgStage.append(wrapper);
      continue;
    } else if (g.type === 'split_kinetic_title') {
      const wrapper = el('div', { class: `mg-card mg-pos-${pos} mg-anim-${enterAnim}${isSel ? ' sel' : ''}`, style: 'background:transparent;border:none;box-shadow:none;' });
      const topT = (g.data && g.data.topText) || "AND I'M";
      const botT = (g.data && g.data.bottomText) || "UNSTOPPABLE";
      wrapper.innerHTML = `
        <div class="mg-kinetic-split-pure">
          <div class="mg-kinetic-split-top">${topT}</div>
          <div class="mg-kinetic-split-bottom">${botT}</div>
        </div>
      `;
      wrapper.onclick = (e) => { e.stopPropagation(); selectGraphic(g.id); };
      mgStage.append(wrapper);
      continue;
    }

    if (g.type === 'cyber_hud_metric') {
      inner.className = 'mg-card-inner mg-card-hud';
      const stRow = el('div', { text: `● ${(g.data && g.data.status) || 'LIVE METRIC'}` });
      stRow.style.cssText = `font-size:10px;font-weight:800;color:#34d399;letter-spacing:0.08em;`;
      const metric = el('div', { text: (g.data && g.data.metric) || '98.4%' });
      metric.style.cssText = `font-family:'Anton',Impact,sans-serif;font-size:38px;font-weight:900;color:${acc};line-height:1;`;
      const lbl = el('div', { text: (g.data && g.data.label) || 'RETENTION RATE' });
      lbl.style.cssText = `font-size:10px;font-weight:700;color:#94a3b8;letter-spacing:0.06em;`;
      inner.append(stRow, metric, lbl);
    } else if (g.type === 'profit_money_callout') {
      inner.className = 'mg-card-inner mg-card-profit';
      const val = el('div', { text: (g.data && g.data.value) || '+$25,400' });
      val.style.cssText = `font-family:'Anton',Impact,sans-serif;font-size:38px;font-weight:900;color:#22c55e;line-height:1;text-shadow:0 0 20px rgba(34,197,94,0.6);`;
      const lbl = el('div', { text: (g.data && g.data.label) || 'NET REVENUE' });
      lbl.style.cssText = `font-size:11px;font-weight:800;color:#FFFFFF;letter-spacing:0.06em;`;
      inner.append(val, lbl);
    } else if (g.type === 'statistic_counter' || g.type === 'price_callout') {
      const val = el('div', { text: (g.data && g.data.value) || '+85%' });
      val.style.cssText = `font-family:'Anton',Impact,sans-serif;font-size:36px;font-weight:900;color:${acc};line-height:1;`;
      const lbl = el('div', { text: (g.data && g.data.label) || 'KEY METRIC' });
      lbl.style.cssText = `font-family:'Poppins',sans-serif;font-size:11px;font-weight:800;color:#FFFFFF;text-transform:uppercase;letter-spacing:0.06em;`;
      const sub = el('div', { text: (g.data && g.data.subtext) || '' });
      sub.style.cssText = `font-family:'Poppins',sans-serif;font-size:10px;color:#94a3b8;`;
      inner.append(val, lbl, sub);
    } else if (g.type === 'lower_third') {
      const tag = el('span', { text: (g.data && g.data.tag) || 'SPEAKER' });
      tag.style.cssText = `background:${acc};color:#0a0b1a;font-size:9px;font-weight:800;padding:2px 6px;border-radius:4px;display:inline-block;width:max-content;`;
      const title = el('div', { text: (g.data && g.data.title) || 'SPEAKER NAME' });
      title.style.cssText = `font-family:'Poppins',sans-serif;font-size:16px;font-weight:800;color:#FFFFFF;`;
      const sub = el('div', { text: (g.data && g.data.subtitle) || '' });
      sub.style.cssText = `font-family:'Poppins',sans-serif;font-size:11px;color:#cbd5e1;`;
      inner.append(tag, title, sub);
    } else if (g.type === 'animated_title') {
      const sub = el('div', { text: (g.data && g.data.subtitle) || 'CHAPTER' });
      sub.style.cssText = `font-size:10px;font-weight:800;color:${acc};letter-spacing:0.08em;text-transform:uppercase;`;
      const title = el('div', { text: (g.data && g.data.title) || 'SECTION TITLE' });
      title.style.cssText = `font-family:'Poppins',sans-serif;font-size:17px;font-weight:800;color:#FFFFFF;`;
      inner.append(sub, title);
    } else if (g.type === 'call_to_action') {
      const title = el('div', { text: (g.data && g.data.title) || 'SUBSCRIBE FOR MORE' });
      title.style.cssText = `font-size:15px;font-weight:800;color:#FFFFFF;`;
      const sub = el('div', { text: (g.data && g.data.subtitle) || '' });
      sub.style.cssText = `font-size:11px;color:#cbd5e1;`;
      const btn = el('div', { text: (g.data && g.data.buttonText) || 'LINK IN BIO' });
      btn.style.cssText = `background:${acc};color:#0a0b1a;font-size:11px;font-weight:800;padding:4px 12px;border-radius:6px;width:max-content;margin-top:4px;`;
      inner.append(title, sub, btn);
    } else if (g.type === 'financial_chart') {
      inner.className = 'mg-card-inner mg-card-chart';
      const badge = el('div', { class: 'chart-badge', text: (g.data && g.data.badge) || '▲ +148% SURGE' });
      const val = el('div', { class: 'chart-value', text: (g.data && g.data.value) || '+$84,500' });
      const sub = el('div', { class: 'chart-sub', text: (g.data && g.data.label) || 'MARKET TRAJECTORY' });
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 240 70');
      svg.setAttribute('class', 'chart-svg-anim');
      const gradId = 'chartGrad_' + (g.id || 'def');
      svg.innerHTML = `
        <defs>
          <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${acc}" stop-opacity="0.5"/>
            <stop offset="100%" stop-color="${acc}" stop-opacity="0.0"/>
          </linearGradient>
        </defs>
        <path d="M 0 60 Q 60 55 100 35 T 180 20 T 240 10 L 240 70 L 0 70 Z" fill="url(#${gradId})" />
        <path d="M 0 60 Q 60 55 100 35 T 180 20 T 240 10" fill="none" stroke="${acc}" stroke-width="3" stroke-linecap="round" class="chart-line-draw"/>
        <circle cx="238" cy="11" r="4.5" fill="#FFFFFF" stroke="${acc}" stroke-width="2.5" class="chart-pulse-dot"/>
      `;
      inner.append(badge, val, sub, svg);
    } else if (g.type === 'classified_dossier') {
      inner.className = 'mg-card-inner mg-card-dossier';
      const stamp = el('div', { class: 'dossier-stamp', text: (g.data && g.data.stamp) || 'DECLASSIFIED' });
      const header = el('div', { class: 'dossier-header', text: (g.data && g.data.header) || 'INTERNAL EVIDENCE MEMO' });
      const highlight = el('div', { class: 'dossier-highlight', text: (g.data && g.data.highlight) || 'CRITICAL ADMISSION' });
      const redRow = el('div', { class: 'dossier-redacted-row' });
      const r1 = el('span', { class: 'dossier-redact-bar' });
      const r2 = el('span', { class: 'dossier-redact-bar reveal' });
      redRow.append(r1, r2);
      const context = el('div', { class: 'dossier-context', text: (g.data && g.data.context) || 'Subject confirmed under classified protocol' });
      inner.append(stamp, header, highlight, redRow, context);
    } else if (g.type === 'timeline_milestone') {
      inner.className = 'mg-card-inner mg-card-timeline';
      const tag = el('div', { class: 'timeline-tag', text: (g.data && g.data.tag) || 'HISTORICAL TURNING POINT' });
      const yr = el('div', { class: 'timeline-year', text: (g.data && g.data.year) || '1971' });
      const title = el('div', { class: 'timeline-event', text: (g.data && g.data.title) || 'BRETTON WOODS COLLAPSE' });
      const sub = el('div', { class: 'timeline-sub', text: (g.data && g.data.subtitle) || 'Fiat monetary expansion era begins' });
      inner.append(tag, yr, title, sub);
    } else if (g.type === 'versus_split') {
      inner.className = 'mg-card-inner mg-card-versus';
      const sA = el('div', { class: 'versus-side side-a', text: (g.data && g.data.sideA) || 'CONVENTIONAL' });
      const vs = el('div', { class: 'versus-badge', text: 'VS' });
      const sB = el('div', { class: 'versus-side side-b', text: (g.data && g.data.sideB) || 'EXPONENTIAL' });
      inner.append(sA, vs, sB);
    } else {
      const title = el('div', { text: (g.data && (g.data.title || g.data.keyword || g.data.location || g.data.quote)) || g.name });
      title.style.cssText = `font-size:15px;font-weight:800;color:#FFFFFF;`;
      const sub = el('div', { text: (g.data && (g.data.subtitle || g.data.tag || g.data.label || g.data.author)) || '' });
      sub.style.cssText = `font-size:11px;color:${acc};`;
      inner.append(sub, title);
    }

    card.append(inner);
    card.addEventListener('click', ev => {
      ev.stopPropagation();
      selectGraphic(g.id);
    });
    mgStage.append(card);
  }
}


// ------------------------------------------------------------------ main loop, transport, timeline
const activeCuts = () => S.cuts.filter(c => c.on);
S.tlZoom = 1;

function tick() {
  const t = vid.currentTime || 0;
  if (S.previewCuts && !vid.paused) {
    for (const c of activeCuts()) {
      if (t >= c.a && t < c.b - 0.03) { vid.currentTime = c.b; break; }
    }
  }
  renderCaption(vid.currentTime || 0);
  renderMotionGraphics(vid.currentTime || 0);
  processSegmentationFrame();
  $('timeLbl').textContent = fmtT(vid.currentTime) + ' / ' + fmtT(dur());
  const D = dur();
  if (D && D > 0) {
    const pct = Math.min(100, Math.max(0, (vid.currentTime / D) * 100));
    $('playhead').style.left = pct + '%';
    // Auto-scroll viewport while playing if zoomed
    if (!vid.paused && S.tlZoom > 1) {
      const vp = $('tlViewport');
      const sc = $('tlScrollable');
      if (vp && sc) {
        const phPx = (pct / 100) * sc.scrollWidth;
        if (phPx > vp.scrollLeft + vp.clientWidth - 50 || phPx < vp.scrollLeft + 50) {
          vp.scrollLeft = phPx - vp.clientWidth / 2;
        }
      }
    }
  }
  requestAnimationFrame(tick);
}

function renderRuler(D) {
  const ruler = $('tlRuler');
  if (!ruler) return;
  ruler.textContent = '';
  if (!D || D <= 0) return;
  const step = D > 120 ? 10 : (D > 60 ? 5 : (D > 20 ? 2 : 1));
  for (let sec = 0; sec <= D; sec += step) {
    const pct = (sec / D) * 100;
    const tick = el('div', { class: 'tl-ruler-tick major' });
    tick.style.left = pct + '%';
    const time = el('span', { class: 'tl-ruler-time', text: fmtT(sec) });
    time.style.left = pct + '%';
    ruler.append(tick, time);
  }
}

function drawWaveform() {
  const canvas = $('waveformCanvas');
  if (!canvas) return;
  const w = canvas.offsetWidth || 800;
  const h = canvas.offsetHeight || 32;
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  const D = dur();
  if (!D || D <= 0) return;

  const bars = Math.floor(w / 3);
  ctx.fillStyle = '#38bdf8';
  for (let i = 0; i < bars; i++) {
    const t = (i / bars) * D;
    // Check if within active speech/caption
    const isSpeech = S.captions.some(c => t >= c.start && t <= c.end);
    let amp = isSpeech ? 0.35 + 0.55 * Math.abs(Math.sin(i * 0.4) * Math.cos(i * 0.2)) : 0.08 + 0.06 * Math.sin(i);
    const bh = Math.max(3, amp * (h - 6));
    const bx = i * 3;
    const by = (h - bh) / 2;
    ctx.globalAlpha = isSpeech ? 0.75 : 0.2;
    ctx.fillRect(bx, by, 2, bh);
  }
  ctx.globalAlpha = 1.0;
}

let tlDrag = null; // { type: 'left'|'right'|'move', cap, startX, origStart, origEnd, width }

function renderTimeline() {
  const D = dur();
  const lanes = { c: $('laneCaps'), g: $('laneGraphics'), x: $('laneCuts'), b: $('laneBroll') };
  Object.values(lanes).forEach(l => { if (l) l.textContent = ''; });
  if (!D || D <= 0) return;

  renderRuler(D);
  drawWaveform();

  // Update enable states of timeline buttons
  if ($('splitCapBtn')) $('splitCapBtn').disabled = !S.captions.length;
  if ($('addCapTlBtn')) $('addCapTlBtn').disabled = !S.filename;
  if ($('delCapBtn')) $('delCapBtn').disabled = !S.selected;

  // Render Captions Track with draggable trim handles
  for (const c of S.captions) {
    const isSel = (c.id === S.selected);
    const leftPct = (c.start / D) * 100;
    const widthPct = Math.max(0.4, ((c.end - c.start) / D) * 100);

    const b = el('div', { class: 'blk cap' + (isSel ? ' sel' : ''), title: c.text });
    b.style.left = leftPct + '%';
    b.style.width = widthPct + '%';

    const hLeft = el('div', { class: 'handle left', title: 'Drag to trim start' });
    const txt = el('span', { class: 'blk-text', text: c.text.replace(/\*/g, '') });
    const hRight = el('div', { class: 'handle right', title: 'Drag to trim end' });

    // Handle left drag (trim start)
    hLeft.addEventListener('mousedown', ev => {
      ev.stopPropagation();
      tlDrag = { type: 'left', cap: c, startX: ev.clientX, origStart: c.start, origEnd: c.end, D };
    });

    // Handle right drag (trim end)
    hRight.addEventListener('mousedown', ev => {
      ev.stopPropagation();
      tlDrag = { type: 'right', cap: c, startX: ev.clientX, origStart: c.start, origEnd: c.end, D };
    });

    // Body drag / select
    b.addEventListener('mousedown', ev => {
      if (ev.target.classList.contains('handle')) return;
      S.selected = c.id;
      vid.currentTime = c.start;
      capSig = '';
      renderCapList();
      renderTimeline();
      tlDrag = { type: 'move', cap: c, startX: ev.clientX, origStart: c.start, origEnd: c.end, D };
    });

    b.append(hLeft, txt, hRight);
    lanes.c.append(b);
  }

  // Render Motion Graphics Track
  if (lanes.g) {
    for (const g of S.graphics) {
      const isSel = (g.id === S.selectedGraphic);
      const leftPct = (g.start / D) * 100;
      const widthPct = Math.max(0.4, ((g.end - g.start) / D) * 100);

      const b = el('div', { class: 'blk mg' + (isSel ? ' sel' : ''), title: g.name || g.type });
      b.style.left = leftPct + '%';
      b.style.width = widthPct + '%';

      const hLeft = el('div', { class: 'handle left', title: 'Trim start' });
      const txt = el('span', { class: 'blk-text', text: (g.data && (g.data.title || g.data.value || g.data.keyword || g.data.location)) || g.name || g.type });
      const hRight = el('div', { class: 'handle right', title: 'Trim end' });

      hLeft.addEventListener('mousedown', ev => {
        ev.stopPropagation();
        tlDrag = { type: 'mg_left', item: g, startX: ev.clientX, origStart: g.start, origEnd: g.end, D };
      });
      hRight.addEventListener('mousedown', ev => {
        ev.stopPropagation();
        tlDrag = { type: 'mg_right', item: g, startX: ev.clientX, origStart: g.start, origEnd: g.end, D };
      });
      b.addEventListener('mousedown', ev => {
        if (ev.target.classList.contains('handle')) return;
        selectGraphic(g.id);
        vid.currentTime = g.start;
        tlDrag = { type: 'mg_move', item: g, startX: ev.clientX, origStart: g.start, origEnd: g.end, D };
      });

      b.append(hLeft, txt, hRight);
      lanes.g.append(b);
    }
  }

  // Render Cuts Track
  for (const c of S.cuts) {
    const blk = el('div', { class: 'blk cut' + (c.on ? '' : ' off'), title: 'Cut ' + (c.b - c.a).toFixed(1) + 's' });
    blk.style.left = (c.a / D * 100) + '%';
    blk.style.width = Math.max(0.3, (c.b - c.a) / D * 100) + '%';
    blk.append(el('span', { class: 'blk-text', text: 'Cut' }));
    lanes.x.append(blk);
  }

  // Render B-roll Track
  for (const s of S.slots) {
    if (s.chosen) {
      const blk = el('div', { class: 'blk br', title: s.query });
      blk.style.left = (s.start / D * 100) + '%';
      blk.style.width = Math.max(0.3, (s.end - s.start) / D * 100) + '%';
      blk.append(el('span', { class: 'blk-text', text: s.query }));
      lanes.b.append(blk);
    }
  }
}

// Window mousemove / mouseup for timeline dragging
window.addEventListener('mousemove', ev => {
  if (!tlDrag) return;
  const sc = $('tlScrollable');
  if (!sc) return;
  const totalW = sc.clientWidth;
  const dx = ev.clientX - tlDrag.startX;
  const dt = (dx / totalW) * tlDrag.D;
  const snap = $('snapToggle') && $('snapToggle').checked;

  if (tlDrag.type === 'mg_left') {
    let nStart = Math.max(0, Math.min(tlDrag.origEnd - 0.2, tlDrag.origStart + dt));
    tlDrag.item.start = +nStart.toFixed(2);
    if ($('inspStartTime')) $('inspStartTime').value = tlDrag.item.start;
    S.graphicDirty = true;
    renderTimeline();
    renderMotionGraphics(vid.currentTime || 0);
    return;
  } else if (tlDrag.type === 'mg_right') {
    let nEnd = Math.min(tlDrag.D, Math.max(tlDrag.origStart + 0.2, tlDrag.origEnd + dt));
    tlDrag.item.end = +nEnd.toFixed(2);
    if ($('inspEndTime')) $('inspEndTime').value = tlDrag.item.end;
    S.graphicDirty = true;
    renderTimeline();
    renderMotionGraphics(vid.currentTime || 0);
    return;
  } else if (tlDrag.type === 'mg_move') {
    const durG = tlDrag.origEnd - tlDrag.origStart;
    let nStart = Math.max(0, Math.min(tlDrag.D - durG, tlDrag.origStart + dt));
    tlDrag.item.start = +nStart.toFixed(2);
    tlDrag.item.end = +(nStart + durG).toFixed(2);
    if ($('inspStartTime')) $('inspStartTime').value = tlDrag.item.start;
    if ($('inspEndTime')) $('inspEndTime').value = tlDrag.item.end;
    S.graphicDirty = true;
    renderTimeline();
    renderMotionGraphics(vid.currentTime || 0);
    return;
  }

  if (tlDrag.type === 'left') {
    let nStart = Math.max(0, Math.min(tlDrag.origEnd - 0.2, tlDrag.origStart + dt));
    if (snap) {
      for (const other of S.captions) {
        if (other.id !== tlDrag.cap.id && Math.abs(other.end - nStart) < 0.25) { nStart = other.end; break; }
      }
    }
    tlDrag.cap.start = +nStart.toFixed(2);
  } else if (tlDrag.type === 'right') {
    let nEnd = Math.min(tlDrag.D, Math.max(tlDrag.origStart + 0.2, tlDrag.origEnd + dt));
    if (snap) {
      for (const other of S.captions) {
        if (other.id !== tlDrag.cap.id && Math.abs(other.start - nEnd) < 0.25) { nEnd = other.start; break; }
      }
    }
    tlDrag.cap.end = +nEnd.toFixed(2);
  } else if (tlDrag.type === 'move') {
    const dur = tlDrag.origEnd - tlDrag.origStart;
    let nStart = Math.max(0, Math.min(tlDrag.D - dur, tlDrag.origStart + dt));
    if (snap) {
      for (const other of S.captions) {
        if (other.id !== tlDrag.cap.id) {
          if (Math.abs(other.end - nStart) < 0.25) { nStart = other.end; break; }
          if (Math.abs(other.start - (nStart + dur)) < 0.25) { nStart = other.start - dur; break; }
        }
      }
    }
    tlDrag.cap.start = +nStart.toFixed(2);
    tlDrag.cap.end = +(nStart + dur).toFixed(2);
  }
  delete tlDrag.cap.wt;
  S.edited = true;
  capSig = '';
  renderCapList();
  renderTimeline();
});

window.addEventListener('mouseup', () => {
  if (tlDrag) { tlDrag = null; }
});

// Scrubbing on Timeline lanes or ruler click
function handleTlScrub(e) {
  const sc = $('tlScrollable');
  if (!sc || !dur()) return;
  const r = sc.getBoundingClientRect();
  const pct = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
  vid.currentTime = pct * dur();
}

['tlRuler', 'laneWaveform', 'laneCaps', 'laneGraphics', 'laneCuts', 'laneBroll'].forEach(id => {
  const el = $(id);
  if (el) el.addEventListener('click', handleTlScrub);
});

// Transport buttons
$('playBtn').addEventListener('click', () => { if (vid.paused) vid.play(); else vid.pause(); });
if ($('stepBackBtn')) $('stepBackBtn').addEventListener('click', () => { vid.currentTime = Math.max(0, vid.currentTime - 1); });
if ($('stepFwdBtn')) $('stepFwdBtn').addEventListener('click', () => { vid.currentTime = Math.min(dur(), vid.currentTime + 1); });
if ($('safeZoneBtn')) $('safeZoneBtn').addEventListener('click', () => {
  const sz = $('safeZoneGuides');
  if (sz) {
    sz.hidden = !sz.hidden;
    $('safeZoneBtn').classList.toggle('on', !sz.hidden);
  }
});

vid.addEventListener('play', () => $('playBtn').innerHTML = '&#10074;&#10074;');
vid.addEventListener('pause', () => $('playBtn').innerHTML = '&#9654;');
vid.addEventListener('ended', () => $('playBtn').innerHTML = '&#9654;');
vid.addEventListener('click', () => $('playBtn').click());
$('prevCuts').addEventListener('change', e => { S.previewCuts = e.target.checked; });

// Split caption at current playhead position
function splitCaptionAtPlayhead() {
  const t = vid.currentTime || 0;
  let target = S.captions.find(c => c.id === S.selected);
  if (!target || t < target.start || t > target.end) {
    target = S.captions.find(c => t >= c.start && t <= c.end);
  }
  if (!target) { notice('Position playhead over a caption to split it.', ''); return; }
  if (t - target.start < 0.2 || target.end - t < 0.2) { notice('Cannot split too close to caption boundary.', ''); return; }

  const words = target.text.split(' ');
  const splitIdx = Math.max(1, Math.floor(words.length * ((t - target.start) / (target.end - target.start))));
  const w1 = words.slice(0, splitIdx).join(' ');
  const w2 = words.slice(splitIdx).join(' ') || '...';

  const origEnd = target.end;
  History.push('Split Caption');
  target.end = +t.toFixed(2);
  target.text = w1;
  delete target.wt;

  const newId = Math.max(0, ...S.captions.map(c => c.id)) + 1;
  const newCap = { id: newId, start: +t.toFixed(2), end: origEnd, text: w2 };
  S.captions.push(newCap);
  S.selected = newId;
  S.edited = true;
  capSig = '';
  renderCapList();
  renderTimeline();
  notice('\u2702 Caption split cleanly into 2 at ' + fmtT(t), 'ok');
}
if ($('splitCapBtn')) $('splitCapBtn').addEventListener('click', splitCaptionAtPlayhead);

// Delete selected caption
function deleteSelectedCaption() {
  if (!S.selected) return;
  History.push('Delete Caption');
  S.captions = S.captions.filter(c => c.id !== S.selected);
  S.selected = S.captions[0] ? S.captions[0].id : null;
  S.edited = true;
  capSig = '';
  renderCapList();
  renderTimeline();
  notice('Caption deleted.', 'ok');
}
if ($('delCapBtn')) $('delCapBtn').addEventListener('click', deleteSelectedCaption);

// Add caption at playhead
if ($('addCapTlBtn')) $('addCapTlBtn').addEventListener('click', () => {
  const t = vid.currentTime || 0;
  const newId = Math.max(0, ...S.captions.map(c => c.id)) + 1;
  History.push('Add Caption');
  S.captions.push({ id: newId, start: +t.toFixed(2), end: +(t + 2).toFixed(2), text: 'New *Caption*' });
  S.selected = newId;
  S.edited = true;
  capSig = '';
  renderCapList();
  renderTimeline();
});

// Zoom Controls
function setTimelineZoom(z) {
  S.tlZoom = Math.max(1, Math.min(5, z));
  if ($('tlZoom')) $('tlZoom').value = S.tlZoom;
  const sc = $('tlScrollable');
  if (sc) sc.style.width = (S.tlZoom * 100) + '%';
  renderTimeline();
}
if ($('tlZoom')) $('tlZoom').addEventListener('input', e => setTimelineZoom(+e.target.value));
if ($('zoomInBtn')) $('zoomInBtn').addEventListener('click', () => setTimelineZoom(S.tlZoom + 0.5));
if ($('zoomOutBtn')) $('zoomOutBtn').addEventListener('click', () => setTimelineZoom(S.tlZoom - 0.5));
if ($('zoomFitBtn')) $('zoomFitBtn').addEventListener('click', () => setTimelineZoom(1));

// Keyboard shortcuts
document.addEventListener('keydown', e => {
  const isInput = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
  if (!isInput && S.filename) {
    if (e.code === 'Space') { e.preventDefault(); $('playBtn').click(); }
    if (e.code === 'KeyS') { e.preventDefault(); splitCaptionAtPlayhead(); }
    if (e.code === 'Delete' || e.code === 'Backspace') { e.preventDefault(); deleteSelectedCaption(); }
    if (e.code === 'ArrowLeft') { e.preventDefault(); vid.currentTime = Math.max(0, vid.currentTime - (e.shiftKey ? 5 : 1)); }
    if (e.code === 'ArrowRight') { e.preventDefault(); vid.currentTime = Math.min(dur(), vid.currentTime + (e.shiftKey ? 5 : 1)); }
  }
});

// ------------------------------------------------------------------ tabs & panels
function switchTab(name) {
  document.querySelectorAll('#panelTabs button, #tabs button').forEach(b => {
    b.classList.toggle('on', b.dataset.panel === name || b.dataset.tab === name);
  });
  document.querySelectorAll('.ppane, .pane').forEach(p => {
    p.classList.toggle('on', p.id === 'ppane-' + name || p.id === 'pane-' + name);
  });
  if (name === 'export') updateExportSummary();
}
const pTabs = $('panelTabs') || $('tabs');
if (pTabs) {
  pTabs.addEventListener('click', e => {
    const b = e.target.closest('button[data-panel], button[data-tab]');
    if (b) switchTab(b.dataset.panel || b.dataset.tab);
  });
}

// ------------------------------------------------------------------ 1 video
$('wpc').addEventListener('input', e => $('wpcOut').textContent = e.target.value);
$('maxKeys').addEventListener('input', e => $('mkOut').textContent = e.target.value);
function upload(file, onProgress) {
  return new Promise((res, rej) => {
    const fd = new FormData(); fd.append('video', file);
    const x = new XMLHttpRequest(); x.open('POST', '/api/upload');
    x.upload.onprogress = e => {
      if (e.lengthComputable) {
        const pct = Math.min(100, Math.max(0, Math.round(e.loaded / e.total * 100)));
        if (onProgress) onProgress(pct);
        notice('Uploading ' + pct + '%...', 'busy');
      }
    };
    x.onload = () => { let d = {}; try { d = JSON.parse(x.responseText); } catch (_) {} if (x.status === 200) res(d); else rej(new Error(d.error || 'Upload failed')); };
    x.onerror = () => rej(new Error('Upload failed. Is the app still running?'));
    x.send(fd);
  });
}

// Drag and drop support
const dropZone = document.querySelector('.drop');
if (dropZone) {
  ['dragenter', 'dragover'].forEach(ev => dropZone.addEventListener(ev, e => { e.preventDefault(); dropZone.classList.add('dragover'); }));
  ['dragleave', 'drop'].forEach(ev => dropZone.addEventListener(ev, e => { e.preventDefault(); dropZone.classList.remove('dragover'); }));
  dropZone.addEventListener('drop', e => {
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith('video/')) { $('file').files = e.dataTransfer.files; $('file').dispatchEvent(new Event('change')); }
  });
}


// --- Video Upload Handling with Live Progress Bar & Percentage ---
async function handleVideoUpload(f) {
  if (!f) return;
  S.videoFile = f;
  S.filename = null; S.captions = []; S.rawWords = []; S.cuts = []; S.slots = []; S.selected = null; S.edited = false;
  if ($('fileName')) $('fileName').textContent = f.name;
  vid.src = URL.createObjectURL(f);
  capSig = '';
  renderCapList(); renderCuts(); renderSlots(); renderTimeline();
  notice('⏳ Uploading 0%...', 'busy');

  const progContainer = $('uploadProgressContainer');
  const progFill = $('uploadProgressBarFill');
  const progBadge = $('uploadPercentBadge');
  const progLabel = $('uploadLabelText');
  const heroBtn = $('heroCreateBtn');

  const mediaProg = $('mediaUploadProgress');
  const mediaFill = $('mediaUploadBarFill');
  const mediaBadge = $('mediaUploadPercent');
  const mediaLabel = $('mediaUploadLabel');

  const shortName = f.name.length > 22 ? f.name.slice(0, 19) + '...' : f.name;

  const heroChooseText = $('heroChooseText');
  if (heroChooseText) heroChooseText.textContent = shortName;
  const selBox = $('heroSelectedFileBox');
  if (selBox) {
    const sizeMb = (f.size / (1024 * 1024)).toFixed(1);
    selBox.textContent = `✓ Selected: ${f.name} (${sizeMb} MB) - Uploading...`;
    selBox.style.display = 'block';
  }

  if (progContainer) progContainer.style.display = 'block';
  if (progFill) progFill.style.width = '0%';
  if (progBadge) progBadge.textContent = '0%';
  if (progLabel) progLabel.textContent = 'Uploading ' + shortName + '...';

  if (mediaProg) mediaProg.style.display = 'block';
  if (mediaFill) mediaFill.style.width = '0%';
  if (mediaBadge) mediaBadge.textContent = '0%';
  if (mediaLabel) mediaLabel.textContent = 'Uploading ' + shortName + '...';

  if (heroBtn) {
    heroBtn.disabled = true;
    heroBtn.textContent = '⏳ Uploading 0%...';
  }

  const updateProgress = (pct) => {
    if (progFill) progFill.style.width = pct + '%';
    if (progBadge) progBadge.textContent = pct + '%';
    if (mediaFill) mediaFill.style.width = pct + '%';
    if (mediaBadge) mediaBadge.textContent = pct + '%';
    if (heroBtn) heroBtn.textContent = `⏳ Uploading ${pct}%...`;
    notice(`⏳ Uploading ${pct}% (${shortName})...`, 'busy');
    if (pct >= 100) {
      if (progLabel) progLabel.textContent = 'Processing video on server...';
      if (mediaLabel) mediaLabel.textContent = 'Processing on server...';
      if (heroBtn) heroBtn.textContent = 'Processing video...';
    }
  };

  try {
    const m = await upload(f, updateProgress);
    if (progFill) progFill.style.width = '100%';
    if (progBadge) progBadge.textContent = '100%';
    if (mediaFill) mediaFill.style.width = '100%';
    if (mediaBadge) mediaBadge.textContent = '100%';

    setTimeout(() => {
      if (progContainer) progContainer.style.display = 'none';
      if (mediaProg) mediaProg.style.display = 'none';
    }, 500);

    S.filename = m.filename;
    S.meta = m;
    const ar = m.width / m.height;
    stage.style.setProperty('--ar', ar);

    // Auto-detect portrait 9:16 reels format
    if (m.height > m.width) {
      S.aspect = 'original';
      document.querySelectorAll('.aspect-btn').forEach(b => {
        b.classList.toggle('on', b.dataset.aspect === '9:16' || b.dataset.aspect === 'original');
      });
    }

    ['transcribeBtn', 'browserSpeechBtn', 'addCap', 'detectBtn', 'playBtn', 'exportBtn', 'addSlot', 'aiAnalyzeBtn', 'addGraphicBtn', 'btnSaveProj', 'btnAiMagic', 'btnAiMagicPanel'].forEach(id => {
      const el = $(id); if (el) el.disabled = false;
    });
    if ($('regroup')) $('regroup').disabled = true;
    if ($('suggestBtn')) $('suggestBtn').disabled = true;

    // Transition from Moonshot Landing to Full Editor Workspace!
    if ($('landingView')) $('landingView').style.display = 'none';
    if ($('editorWorkspace')) $('editorWorkspace').style.display = 'flex';
    if ($('btnGoToEditor')) $('btnGoToEditor').style.display = 'inline-block';
    if ($('stageEmpty')) $('stageEmpty').hidden = true;

    notice('✅ Video uploaded successfully! Choose your caption style below.', 'ok');
    switchTab('style');
    renderTimeline();

    // Accurately fit stage after editorWorkspace is visible
    requestAnimationFrame(() => {
      fitStageToVideo();
    });
    setTimeout(() => {
      fitStageToVideo();
    }, 150);

    if (heroBtn) {
      heroBtn.disabled = false;
      heroBtn.textContent = 'Create video';
    }
  } catch (err) {
    if (progContainer) progContainer.style.display = 'none';
    if (mediaProg) mediaProg.style.display = 'none';
    notice(err.message, 'bad');
    if (heroBtn) {
      heroBtn.disabled = false;
      heroBtn.textContent = 'Create video';
    }
  }
}

// Global Drag & Drop for video files
['dragenter', 'dragover'].forEach(ev => {
  window.addEventListener(ev, e => {
    e.preventDefault();
    if ($('stageEmpty')) $('stageEmpty').classList.add('dragover');
  });
});
['dragleave', 'drop'].forEach(ev => {
  window.addEventListener(ev, e => {
    e.preventDefault();
    if ($('stageEmpty')) $('stageEmpty').classList.remove('dragover');
  });
});
window.addEventListener('drop', e => {
  e.preventDefault();
  const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if (f && (f.type.startsWith('video/') || /\.(mp4|mov|mkv|webm|avi|m4v)$/i.test(f.name))) {
    handleVideoUpload(f);
  }
});

const heroDrop = $('heroDropZone');
if (heroDrop) {
  ['dragenter', 'dragover'].forEach(ev => heroDrop.addEventListener(ev, e => {
    e.preventDefault();
    heroDrop.style.borderColor = '#6366f1';
    heroDrop.style.background = 'rgba(99, 102, 241, 0.08)';
  }));
  ['dragleave', 'drop'].forEach(ev => heroDrop.addEventListener(ev, e => {
    e.preventDefault();
    heroDrop.style.borderColor = '';
    heroDrop.style.background = '';
  }));
  heroDrop.addEventListener('drop', e => {
    e.preventDefault();
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) handleVideoUpload(f);
  });
}

if ($('file')) {
  $('file').addEventListener('change', e => {
    if (e.target.files && e.target.files[0]) handleVideoUpload(e.target.files[0]);
  });
}
if ($('heroFileInput')) {
  $('heroFileInput').addEventListener('change', e => {
    if (e.target.files && e.target.files[0]) handleVideoUpload(e.target.files[0]);
  });
}
if ($('heroCreateBtn')) {
  $('heroCreateBtn').addEventListener('click', () => {
    if (S.videoFile) handleVideoUpload(S.videoFile);
    else if ($('heroFileInput')) $('heroFileInput').click();
    else if ($('file')) $('file').click();
  });
}
if ($('heroStylePickerTrigger')) {
  $('heroStylePickerTrigger').addEventListener('click', () => {
    const sec = $('moonshotGallerySection');
    if (sec) sec.scrollIntoView({ behavior: 'smooth' });
  });
}
if ($('btnBackToLanding')) {
  $('btnBackToLanding').addEventListener('click', () => {
    if ($('landingView')) $('landingView').style.display = 'flex';
    if ($('editorWorkspace')) $('editorWorkspace').style.display = 'none';
  });
}
if ($('btnGoToEditor')) {
  $('btnGoToEditor').addEventListener('click', () => {
    if ($('landingView')) $('landingView').style.display = 'none';
    if ($('editorWorkspace')) $('editorWorkspace').style.display = 'flex';
    requestAnimationFrame(() => {
      fitStageToVideo();
    });
    setTimeout(() => {
      fitStageToVideo();
    }, 100);
  });
}

function updateMoonshotSelection(presetId) {
  const p = (S.presets || []).find(x => x.id === presetId);
  if (!p) return;

  document.querySelectorAll('.moonshot-preset-card').forEach(c => {
    const isThis = (c.dataset.presetId === presetId);
    c.classList.toggle('on', isThis);
    const badge = c.querySelector('.card-selected-badge');
    if (badge) badge.style.display = isThis ? 'flex' : 'none';
  });

  const mini = $('heroStyleMiniPreview');
  const thumb = $('heroStyleThumb');
  if (mini) {
    mini.textContent = p.name ? p.name.slice(0, 2).toUpperCase() : 'Aa';
  }
  if (thumb) {
    if (p.previewImg) thumb.style.backgroundImage = `url("${p.previewImg}")`;
    else if (p.id === 'teal_gloss') thumb.style.backgroundImage = 'url("/static/ref1_teal_this_gorgeous.jpg")';
    else if (p.id === 'neon_duo') thumb.style.backgroundImage = 'url("/static/ref2_magenta_so_tonight_is_going_to.jpg")';
    else if (p.id === 'orange_pop') thumb.style.backgroundImage = 'url("/static/ref3_orange_real_estate_captions.jpg")';
    else thumb.style.backgroundImage = 'radial-gradient(circle at 35% 35%, #38bdf8 0%, #0f172a 100%)';
  }
  const pickLabel = document.querySelector('.pick-style-label span');
  if (pickLabel) pickLabel.textContent = p.name || 'Pick a style';
}

function renderMoonshotGallery(selectedCategory = 'all') {
  const grid = $('moonshotCardsGrid');
  if (!grid) return;
  grid.innerHTML = '';

  let list = [...(S.presets || [])];
  if (selectedCategory && selectedCategory !== 'all') {
    if (selectedCategory === 'reference') {
      list = list.filter(p => p.category === 'reference' || ['electric_blue_blend', 'teal_gloss', 'neon_duo', 'orange_pop'].includes(p.id));
    } else if (selectedCategory === 'special') {
      list = list.filter(p => p.category === 'special' || (p.id || '').startsWith('special_') || (p.id || '').startsWith('duo_') || p.isSpecial);
    } else if (selectedCategory === 'unique') {
      list = list.filter(p => p.category === 'unique' || (p.id || '').startsWith('u_'));
    } else {
      list = list.filter(p => p.category === selectedCategory || (p.id || '').includes(selectedCategory));
    }
  }

  // Showcase our original flagship presets at the top
  const priority = [
    ...((S.presets || []).filter(p => p.category === 'special').map(p => p.id)),
    'electric_blue_blend', 'teal_gloss', 'neon_duo', 'orange_pop',
    'hype_yellow', 'box_pop', 'clean_cyan', 'gold_luxury', 'wipe_italic', 'mono_echo',
    'fire_gradient', 'ice_blue', 'retro_sunset', 'comic_pow',
    'u_glow_matrix', 'u_ransom_cutout', 'u_neon_sign', 'u_cinematic_minimal',
    'estate_signature', 'estate_modern', 'estate_luxe'
  ];
  list.sort((a, b) => {
    const ia = priority.indexOf(a.id);
    const ib = priority.indexOf(b.id);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return 0;
  });

  list.forEach((p) => {
    const card = document.createElement('div');
    const isSelected = (p.id === S.presetId);
    card.className = 'moonshot-preset-card' + (isSelected ? ' on' : '');
    card.dataset.presetId = p.id;

    // Authentic preset visuals & backdrops
    const bgLayer = document.createElement('div');
    bgLayer.className = 'card-bg-layer';
    if (p.id === 'teal_gloss' || p.id === 'electric_blue_blend') {
      bgLayer.style.cssText = 'position:absolute;inset:0;background:url("/static/ref1_teal_this_gorgeous.jpg") center/cover no-repeat;filter:brightness(0.85);';
    } else if (p.id === 'neon_duo') {
      bgLayer.style.cssText = 'position:absolute;inset:0;background:url("/static/ref2_magenta_so_tonight_is_going_to.jpg") center/cover no-repeat;filter:brightness(0.85);';
    } else if (p.id === 'orange_pop') {
      bgLayer.style.cssText = 'position:absolute;inset:0;background:url("/static/ref3_orange_real_estate_captions.jpg") center/cover no-repeat;filter:brightness(0.85);';
    } else if ((p.id || '').startsWith('u_')) {
      bgLayer.style.cssText = `position:absolute;inset:0;background:url("/static/preset_previews/${p.id}.png") center/cover no-repeat;filter:brightness(0.9);`;
    } else if (p.isSpecial || p.category === 'special' || (p.id || '').startsWith('special_')) {
      bgLayer.style.background = '#090d16';
    } else {
      bgLayer.style.cssText = 'position:absolute;inset:0;background:radial-gradient(circle at 50% 25%, #1e1b4b 0%, #030712 100%);';
    }

    const specialLayers = [];
    if (p.isSpecial && p.roles) {
      const accent = p.roles.accent || {};
      const fill = accent.fill || {};
      const stops = (fill.colors || [accent.color || '#F2B66D']).slice(0, 4);
      const bg = document.createElement('div');
      bg.style.cssText = `position:absolute;inset:0;z-index:1;background:radial-gradient(ellipse at 50% 34%,${stops[0]}66,transparent 45%),linear-gradient(155deg,#101827 0%,#182235 52%,#090d15 100%);`;
      const depth = document.createElement('div');
      const sampleWords = ['VALUE', 'LUXURY', 'POTENTIAL', 'ELEVATED', 'ICONIC', 'SPACE', 'YOURS'];
      const sampleIndex = Math.max(0, Number((p.id || '').match(/(\d+)$/)?.[1] || 1) - 1);
      const sample = p.previewWord || sampleWords[sampleIndex % sampleWords.length];
      depth.textContent = sample;
      const gradient = p.key && p.key.keyGradient;
      const color = accent.color || '#F2B66D';
      const fontPx = Math.min(43, Math.max(20, 260 / Math.max(4, sample.length)));
      depth.style.cssText = `position:absolute;left:50%;top:${Math.max(15,Math.min(39,(p.depthAccentY||p.position||0.22)*100))}%;z-index:${accent.layer === 'behind' ? 2 : 6};width:96%;transform:translate(-50%,-50%) scaleX(1.06);text-align:center;white-space:nowrap;overflow:hidden;font-family:"${p.key?.font || 'Montserrat'}",Montserrat,sans-serif;font-size:${fontPx}px;font-weight:${accent.weight || 900};font-style:${accent.italic ? 'italic' : 'normal'};letter-spacing:-.055em;line-height:.92;color:${color};${gradient ? `background-image:${gradient};-webkit-background-clip:text;-webkit-text-fill-color:transparent;` : ''}mix-blend-mode:screen;opacity:.94;text-shadow:0 5px 18px ${color}88,0 2px 5px #000;`;
      const person = document.createElement('div');
      person.setAttribute('aria-hidden', 'true');
      person.style.cssText = `position:absolute;left:50%;top:46%;transform:translate(-50%,-50%);z-index:4;width:58%;height:55%;opacity:.92;filter:drop-shadow(0 12px 22px rgba(0,0,0,.35));pointer-events:none;`;
      person.innerHTML = '<svg viewBox="0 0 220 300" width="100%" height="100%" preserveAspectRatio="xMidYMid meet"><defs><linearGradient id="personShade" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#d9c4a8"/><stop offset="1" stop-color="#8e735d"/></linearGradient></defs><path d="M12 300c6-66 39-99 83-105h30c45 6 77 39 83 105z" fill="#111722"/><path d="M79 184v-25h62v25c0 17-62 17-62 0" fill="url(#personShade)"/><ellipse cx="110" cy="106" rx="53" ry="69" fill="url(#personShade)"/><path d="M57 106c-7-50 17-87 55-88 42-1 62 34 50 90-8-29-22-43-51-44-24-1-40 12-54 42" fill="#242532"/><path d="M83 114h9m36 0h9" stroke="#30271f" stroke-width="4" stroke-linecap="round"/><path d="M99 143q11 8 22 0" fill="none" stroke="#6d4538" stroke-width="3" stroke-linecap="round"/></svg>';
      specialLayers.push(bg, depth, person);
    }

    const gradOverlay = document.createElement('div');
    gradOverlay.className = 'card-gradient-overlay';

    const selBadge = document.createElement('div');
    selBadge.className = 'card-selected-badge';
    selBadge.style.display = isSelected ? 'flex' : 'none';
    selBadge.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg> Selected';

    const capLayer = document.createElement('div');
    capLayer.className = 'card-caption-layer';

    const kicker = document.createElement('span');
    let kickerText = p.depthAccent ? 'DEPTH 3D' : (p.category || 'ORIGINAL').toUpperCase();
    if (p.category === 'special' || p.isSpecial || (p.id || '').startsWith('special_')) {
      kickerText = p.depthAccent ? 'SEQUENCE · BEHIND' : 'SEQUENCE · FRONT';
    }
    kicker.textContent = kickerText;
    kicker.style.cssText = 'font:700 9px Inter,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,0.7);background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:999px;padding:3px 8px;margin-bottom:8px;';

    // 2-Line Authentic Caption Preview (small words top, big highlighted word bottom)
    const line1 = document.createElement('div');
    line1.textContent = p.isSpecial ? 'SOME HOMES GET' : 'MAKE YOUR VIDEOS';
    const fFont = (p.filler && p.filler.font) ? p.filler.font : 'Montserrat';
    const fWeight = (p.filler && p.filler.bold) ? '700' : '600';
    const fColor = (p.filler && p.filler.color) ? p.filler.color : '#FFFFFF';
    line1.style.cssText = `font-family:"${fFont}", Montserrat, sans-serif; font-weight:${fWeight}; font-size:11px; letter-spacing:0.04em; color:${fColor}; text-shadow:0 2px 8px rgba(0,0,0,0.9); margin-bottom:4px;`;

    const line2 = document.createElement('div');
    line2.style.cssText = 'display:flex; align-items:center; justify-content:center; gap:5px; flex-wrap:wrap;';

    const earlySpan = document.createElement('span');
    earlySpan.textContent = p.isSpecial ? 'STAY' : 'LOOK';
    earlySpan.style.cssText = `font-family:"${fFont}", Montserrat, sans-serif; font-weight:${fWeight}; font-size:12px; color:${fColor}; text-shadow:0 2px 8px rgba(0,0,0,0.9);`;

    const bigSpan = document.createElement('span');
    const heroWord = (p.isSpecial ? 'WITH YOU' : (p.previewWord || (p.name ? p.name.replace(/Special\s*·\s*/i, '').replace(/Duo\s*·\s*/i, '').replace(/\s*\(.*\)/, '').trim() : 'VIRAL'))).toUpperCase();
    bigSpan.textContent = heroWord;

    const kFont = (p.key && p.key.font) ? p.key.font : 'Montserrat';
    const kWeight = (p.key && p.key.bold) ? '900' : '800';
    const kItalic = (p.key && p.key.italic) ? 'font-style:italic;' : '';

    if (p.isSpecial) {
      bigSpan.style.cssText = `font-family:"${fFont}",Montserrat,sans-serif;font-weight:${fWeight};font-size:12px;letter-spacing:.01em;color:${fColor};text-shadow:0 2px 8px #000;`;
      capLayer.style.top = '76%';
      capLayer.style.zIndex = '8';
    } else if (p.highlight && p.highlight.mode === 'box') {
      const boxBg = p.highlight.color || '#FFE600';
      const boxTxt = p.highlight.textColor || '#000000';
      bigSpan.style.cssText = `font-family:"${kFont}", Montserrat, sans-serif; font-weight:${kWeight}; ${kItalic} font-size:18px; letter-spacing:-0.02em; background:${boxBg}; color:${boxTxt}; padding:2px 8px; border-radius:4px; display:inline-block; font-weight:900; box-shadow:0 0 14px ${boxBg}66;`;
    } else if (p.key && p.key.keyGradient) {
      bigSpan.style.cssText = `font-family:"${kFont}", Montserrat, sans-serif; font-weight:${kWeight}; ${kItalic} font-size:22px; letter-spacing:-0.03em; background-image:${p.key.keyGradient}; -webkit-background-clip:text; -webkit-text-fill-color:transparent; filter:drop-shadow(0 0 10px rgba(255,255,255,0.4));`;
    } else {
      const col = (p.highlight && p.highlight.color) || (p.key && p.key.color) || p.highlightColor || '#FFE600';
      const glow = p.key?.glow || col;
      bigSpan.style.cssText = `font-family:"${kFont}", Montserrat, sans-serif; font-weight:${kWeight}; ${kItalic} font-size:22px; letter-spacing:-0.03em; color:${col}; text-shadow:0 0 14px ${glow}, 0 2px 6px rgba(0,0,0,0.9);`;
    }

    line2.append(earlySpan, bigSpan);
    capLayer.append(kicker, line1, line2);

    const footer = document.createElement('div');
    footer.className = 'card-footer-info';
    const catLabel = (p.category === 'special' || p.isSpecial) ? 'SEQUENCE' : (p.category || 'AI');
    const displayName = (p.name || p.id).replace(/Special\s*·\s*/i, 'Sequence · ').replace(/Duo\s*·\s*/i, 'Sequence · ');
    footer.innerHTML = `
      <span class="card-footer-name">${displayName}</span>
      <span class="card-footer-badge" style="background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.15); font-size:9px; padding:2px 6px; border-radius:4px; color:#cbd5e1;">${catLabel.toUpperCase()}</span>
    `;

    card.append(bgLayer, ...specialLayers, gradOverlay, selBadge, capLayer, footer);

    card.onclick = () => {
      applyPreset(p);
      updateMoonshotSelection(p.id);
    };

    grid.appendChild(card);
  });
}

vid.addEventListener('loadedmetadata', () => { 
  if (!S.meta && vid.videoWidth && vid.videoHeight) stage.style.setProperty('--ar', vid.videoWidth / vid.videoHeight); 
  fitStageToVideo();
  renderTimeline(); 
});

$('transcribeBtn').addEventListener('click', async () => {
  if (!S.filename) return;
  const btn = $('transcribeBtn'); setBusy(btn, true, '\u23F3 Listening to your video...');
  notice('Turning speech into text on your computer. Please wait...', 'busy');
  try {
    const d = await api('/api/transcribe', { filename: S.filename, model: $('model').value, language: $('lang').value,
      wordsPerCaption: +$('wpc').value, maxKeys: +$('maxKeys').value });
    S.captions = d.captions; S.rawWords = d.words; S.edited = false; S.selected = S.captions[0] ? S.captions[0].id : null;
    capSig = ''; renderCapList(); renderTimeline(); $('regroup').disabled = false; $('suggestBtn').disabled = false;
    const timingNote = d.timing_quality === 'estimated' ? ' Word timing is estimated, so review the captions before export.' : ' Word timing came from the speech model.';
    notice('\u2705 Made ' + d.captions.length + ' captions with ' + (d.engine || 'speech recognition') + (d.language ? ' (' + d.language + ')' : '') + '.' + timingNote, d.timing_quality === 'estimated' ? '' : 'ok');
    switchTab('captions');
  } catch (err) {
    notice(err.message + ' You can also use "Browser Speech AI" or "Import SRT".', 'bad');
  }
  finally { setBusy(btn, false); }
});

// SRT / VTT Subtitle Parser
function parseSrtTime(tStr) {
  tStr = tStr.trim().replace(',', '.');
  const parts = tStr.split(':');
  if (parts.length === 3) return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
  if (parts.length === 2) return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
  return 0;
}
function parseSrt(text) {
  const blocks = text.trim().replace(/\r\n/g, '\n').split(/\n\s*\n/);
  const captions = [], rawWords = [];
  let id = 1;
  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    let timeLineIdx = lines.findIndex(l => l.includes('-->'));
    if (timeLineIdx === -1) continue;
    const timeMatch = lines[timeLineIdx].split('-->');
    const start = parseSrtTime(timeMatch[0]);
    const end = parseSrtTime(timeMatch[1].split(' ')[0]);
    const capText = lines.slice(timeLineIdx + 1).join(' ').replace(/<[^>]+>/g, '').trim();
    if (!capText) continue;
    captions.push({ id: id++, start: +start.toFixed(2), end: +end.toFixed(2), text: capText });
    const toks = capText.split(/\s+/).filter(Boolean);
    const span = Math.max(0.1, end - start) / Math.max(1, toks.length);
    toks.forEach((w, i) => {
      rawWords.push([+(start + i * span).toFixed(3), +(start + (i + 1) * span).toFixed(3), w]);
    });
  }
  return { captions, rawWords };
}
const srtIn = $('srtFile');
if (srtIn) {
  srtIn.addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const { captions, rawWords } = parseSrt(ev.target.result);
        if (!captions.length) throw new Error('No subtitle cues found in file.');
        S.captions = captions; S.rawWords = rawWords; S.edited = false;
        S.selected = captions[0] ? captions[0].id : null;
        capSig = ''; renderCapList(); renderTimeline();
        $('regroup').disabled = false;
        notice('\u2705 Imported ' + captions.length + ' captions from ' + f.name + '! Pick your favorite Moonshot preset in Style.', 'ok');
        switchTab('captions');
      } catch (err) { notice('Failed to parse subtitles: ' + err.message, 'bad'); }
    };
    reader.readAsText(f);
  });
}

// Client-Side Devanagari to Romanized Hinglish Transliterator
const HINGLISH_CLIENT_DICT = {
  'है': 'hai', 'हैं': 'hain', 'हो': 'ho', 'हूं': 'hoon', 'था': 'tha', 'थी': 'thi', 'थे': 'the',
  'में': 'mein', 'से': 'se', 'को': 'ko', 'का': 'ka', 'की': 'ki', 'के': 'ke', 'पर': 'par', 'पे': 'pe',
  'और': 'aur', 'या': 'ya', 'तो': 'toh', 'भी': 'bhi', 'ही': 'hi', 'तक': 'tak', 'नहीं': 'nahi', 'ना': 'na',
  'यह': 'yeh', 'ये': 'yeh', 'वह': 'woh', 'वो': 'woh', 'इस': 'is', 'उस': 'us', 'इन': 'in', 'उन': 'un',
  'क्या': 'kya', 'क्यों': 'kyun', 'कैसे': 'kaise', 'कब': 'kab', 'कहाँ': 'kahan', 'कहा': 'kaha',
  'हम': 'hum', 'आप': 'aap', 'तुम': 'tum', 'मैं': 'main', 'मुझे': 'mujhe', 'हमें': 'humein',
  'मेरा': 'mera', 'मेरी': 'meri', 'मेरे': 'mere', 'आपका': 'aapka', 'आपकी': 'aapki', 'आपके': 'aapke',
  'बात': 'baat', 'काम': 'kaam', 'नाम': 'naam', 'दिन': 'din', 'साल': 'saal', 'टाइम': 'time',
  'वीडियो': 'video', 'एडिटिंग': 'editing', 'फ़ोन': 'phone', 'फोन': 'phone', 'चैनल': 'channel',
  'सब्सक्राइब': 'subscribe', 'लाइक': 'like', 'शेयर': 'share', 'फॉलो': 'follow', 'कमेंट': 'comment',
  'दोस्तों': 'dosto', 'दोस्त': 'dost', 'भाई': 'bhai', 'यार': 'yaar', 'लोग': 'log', 'लोगों': 'logon',
  'आज': 'aaj', 'कल': 'kal', 'अब': 'ab', 'अभी': 'abhi', 'पहले': 'pehle', 'बाद': 'baad',
  'बहुत': 'bahut', 'ज्यादा': 'zyada', 'कम': 'kam', 'थोड़ा': 'thoda', 'अच्छा': 'achha', 'अच्छे': 'achhe',
  'करना': 'karna', 'कर': 'kar', 'करो': 'karo', 'करे': 'kare', 'करें': 'karein', 'करते': 'karte', 'करेंगे': 'karenge',
  'किया': 'kiya', 'कीजिए': 'kijiye', 'होना': 'hona', 'होता': 'hota', 'होगा': 'hoga', 'सकते': 'sakte', 'सकता': 'sakta',
  'देख': 'dekh', 'देखो': 'dekho', 'देखें': 'dekhein', 'देखना': 'dekhna', 'देखा': 'dekha',
  'सुन': 'sun', 'सुनो': 'suno', 'बोल': 'bol', 'बोलो': 'bolo', 'बता': 'bata', 'बताओ': 'batao',
  'जाना': 'jaana', 'जा': 'jaa', 'जाओ': 'jao', 'गया': 'gaya', 'गई': 'gayi', 'गए': 'gaye',
  'आना': 'aana', 'आ': 'aa', 'आओ': 'aao', 'आया': 'aaya', 'लेना': 'lena', 'ले': 'le', 'लो': 'lo', 'लिया': 'liya',
  'देना': 'dena', 'दे': 'de', 'दो': 'do', 'दिया': 'diya', 'अगर': 'agar', 'लेकिन': 'lekin', 'क्योंकि': 'kyunki',
  'यहाँ': 'yahan', 'वहाँ': 'wahan', 'अंदर': 'andar', 'बाहर': 'bahar', 'ऊपर': 'upar', 'नीचे': 'neeche', 'साथ': 'saath'
};

function devanagariToHinglishClient(text) {
  if (!text || !/[\u0900-\u097F]/.test(text)) return text;
  const V = {'अ':'a','आ':'aa','इ':'i','ई':'ee','उ':'u','ऊ':'oo','ए':'e','ऐ':'ai','ओ':'o','औ':'au'};
  const M = {'ा':'a','ि':'i','ी':'ee','ु':'u','ू':'oo','े':'e','ै':'ai','ो':'o','ौ':'au','ॉ':'o','ॅ':'e'};
  const C = {'क':'k','ख':'kh','ग':'g','घ':'gh','ङ':'ng','च':'ch','छ':'chh','ज':'j','झ':'jh','ञ':'ny',
             'ट':'t','ठ':'th','ड':'d','ढ':'dh','ण':'n','त':'t','थ':'th','द':'d','ध':'dh','न':'n',
             'प':'p','फ':'ph','ब':'b','भ':'bh','म':'m','य':'y','र':'r','ल':'l','व':'v','श':'sh',
             'ष':'sh','स':'s','ह':'h','क्ष':'ksh','त्र':'tr','ज्ञ':'gya','श्र':'shr','क़':'q','ख़':'kh',
             'ग़':'gh','ज़':'z','ड़':'r','ढ़':'rh','फ़':'f'};
  return text.split(' ').map(w => {
    const clean = w.replace(/[^\u0900-\u097F]/g, '');
    if (HINGLISH_CLIENT_DICT[clean]) return w.replace(clean, HINGLISH_CLIENT_DICT[clean]);
    let chars = [...clean], out = '', n = chars.length;
    for (let i = 0; i < n; i++) {
      let c = chars[i], next = chars[i+1] || '';
      if (V[c]) out += V[c];
      else if (C[c]) {
        out += C[c];
        if (M[next]) { out += M[next]; i++; }
        else if (next === '्') { i++; }
        else if (next === 'ं' || next === 'ँ') { out += 'an'; i++; }
        else if (next === 'ः') { out += 'ah'; i++; }
        else if (i < n - 1 && C[next]) out += 'a';
      } else if (M[c]) out += M[c];
      else if (c === 'ं' || c === 'ँ') out += 'n';
      else if (c === 'ः') out += 'h';
      else out += c;
    }
    return w.replace(clean, out || clean);
  }).join(' ');
}

// Browser Web Speech AI
let speechRec = null;
const bSpeechBtn = $('browserSpeechBtn');
if (bSpeechBtn) {
  bSpeechBtn.addEventListener('click', () => {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      alert('Browser Speech Recognition is supported natively in Google Chrome and Microsoft Edge.');
      return;
    }
    if (!S.filename) { notice('Please choose a video in step 1 first.', 'bad'); return; }
    if (speechRec) {
      try { speechRec.stop(); } catch (_) {}
      speechRec = null;
      bSpeechBtn.textContent = '🎙️ Browser Speech AI';
      notice('Finished browser speech capture.', 'ok');
      return;
    }
    const selLang = $('lang').value || 'hinglish';
    const isHinglish = selLang === 'hinglish' || selLang === 'en-IN';
    const rec = new SpeechRec();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = (isHinglish || selLang === 'hi-IN') ? 'hi-IN' : (selLang === 'auto' ? 'hi-IN' : selLang);
    bSpeechBtn.textContent = '⏹ Stop Listening';
    notice('🎙️ Listening to speech (' + (isHinglish ? 'Hinglish' : rec.lang) + ')... Video is playing. Press "Stop Listening" when done.', 'busy');
    speechRec = rec;
    vid.currentTime = 0;
    vid.play();
    rec.onresult = e => {
      const t = vid.currentTime || 0;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          let phrase = e.results[i][0].transcript.trim();
          if (isHinglish && /[\u0900-\u097F]/.test(phrase)) {
            phrase = devanagariToHinglishClient(phrase);
          }
          if (phrase) {
            const toks = phrase.split(/\s+/);
            const dur = Math.max(0.5, toks.length * 0.4);
            const start = Math.max(0, t - dur);
            const end = t;
            const id = S.captions.length + 1;
            S.captions.push({ id, start: +start.toFixed(2), end: +end.toFixed(2), text: phrase });
            const span = dur / toks.length;
            toks.forEach((w, idx) => {
              S.rawWords.push([+(start + idx * span).toFixed(3), +(start + (idx + 1) * span).toFixed(3), w]);
            });
            renderCapList(); renderTimeline();
          }
        }
      }
    };
    rec.onerror = () => { bSpeechBtn.textContent = '🎙️ Browser Speech AI'; speechRec = null; };
    rec.onend = () => {
      bSpeechBtn.textContent = '🎙️ Browser Speech AI';
      speechRec = null;
      if (S.captions.length) {
        notice('✅ Created ' + S.captions.length + ' captions via browser speech! Pick your Moonshot preset in Style.', 'ok');
        $('regroup').disabled = false;
        switchTab('captions');
      }
    };
    try { rec.start(); } catch (err) { notice('Could not start speech recognition: ' + err.message, 'bad'); }
  });
}

// ------------------------------------------------------------------ 2 captions list
function renderCapList() {
  const box = $('capList'); box.textContent = '';
  if (!S.captions.length) { box.append(el('div', { class: 'empty', text: 'No captions yet. Generate them in step 1.' })); return; }
  S.captions.sort((a, b) => a.start - b.start);
  for (const c of S.captions) {
    const mk = (key, label) => el('label', {}, label, el('input', { type: 'number', step: '0.1', min: '0', value: (+c[key]).toFixed(2),
      oninput: ev => { c[key] = num(ev.target.value, c[key]); delete c.wt; S.edited = true; capSig = ''; renderTimeline(); } }));
    const ta = el('textarea', { rows: '2', 'aria-label': 'Caption text',
      oninput: ev => { c.text = ev.target.value; S.edited = true; capSig = ''; },
      onfocus: () => { History.push('Edit Caption'); S.selected = c.id; capSig = ''; if (vid.paused) vid.currentTime = +c.start + 0.01; document.querySelectorAll('.caprow').forEach(r => r.classList.toggle('sel', r.dataset.id == c.id)); } });
    ta.value = c.text;
    box.append(el('div', { class: 'caprow' + (c.id === S.selected ? ' sel' : ''), 'data-id': c.id },
      mk('start', 'Start'), mk('end', 'End'), el('label', { class: 'txt' }, 'Text', ta),
      el('button', { class: 'x', type: 'button', title: 'Delete', text: '\u00d7', onclick: () => { History.push('Delete Caption'); S.captions = S.captions.filter(x => x.id !== c.id); S.edited = true; capSig = ''; renderCapList(); renderTimeline(); } })));
  }
}
$('addCap').addEventListener('click', () => {
  const t = vid.currentTime || 0, id = Math.max(0, ...S.captions.map(c => c.id)) + 1;
  History.push('Add Caption');
  S.captions.push({ id, start: +t.toFixed(2), end: +(t + 2).toFixed(2), text: 'Type *your* caption' });
  S.selected = id; S.edited = true; capSig = ''; renderCapList(); renderTimeline();
});
$('regroup').addEventListener('click', regroup);
async function regroup(silent) {
  if (!S.rawWords.length) return;
  History.push('Regroup Words');
  try {
    const d = await api('/api/regroup', { words: S.rawWords, per: +$('wpc').value, maxKeys: +$('maxKeys').value });
    S.captions = d.captions; S.edited = false; capSig = ''; renderCapList(); renderTimeline();
    if (silent !== true) notice('Captions regrouped.', 'ok');
  } catch (err) { notice(err.message, 'bad'); }
}

// ------------------------------------------------------------------ 3 style
const ROLE_FIELDS = [
  { k: 'font', type: 'font', label: 'Font' },
  { k: 'size', type: 'range', min: .03, max: .22, step: .005, label: 'Size' },
  { k: 'color', type: 'color', label: 'Colour' },
  { k: 'outline', type: 'range', min: 0, max: .15, step: .005, label: 'Outline' },
  { k: 'outlineColor', type: 'color', label: 'Outline colour' },
  { k: 'glowSize', type: 'range', min: 0, max: .15, step: .005, label: 'Glow' },
  { k: 'glow', type: 'color', label: 'Glow colour' },
  { k: 'shadow', type: 'range', min: 0, max: .1, step: .005, label: 'Depth shadow' },
  { k: 'shadowColor', type: 'color', label: 'Shadow colour' }
];
const roleInputs = { key: {}, filler: {} };
const touchStyle = () => { S.styleVer++; capSig = ''; };
function buildRoles() {
  const box = $('roles'); box.textContent = '';
  for (const role of ['key', 'filler']) {
    const wrap = el('div', { class: 'role' }, el('h4', { text: role === 'key' ? '\u2B50 Big words' : '\u270D Small words' }));
    const grid = el('div', { class: 'row2' });
    for (const f of ROLE_FIELDS) {
      let input, out = null;
      if (f.type === 'font') {
        input = el('select', { onchange: e => { S.style[role].font = e.target.value; S.style[role].fallback = e.target.value; touchStyle(); } });
      } else if (f.type === 'range') {
        out = el('output', { text: '' });
        input = el('input', { type: 'range', min: f.min, max: f.max, step: f.step, oninput: e => { S.style[role][f.k] = +e.target.value; out.textContent = Math.round(e.target.value * 100) + '%'; touchStyle(); } });
      } else {
        input = el('input', { type: 'color', oninput: e => { S.style[role][f.k] = e.target.value; touchStyle(); } });
      }
      roleInputs[role][f.k] = { input, out };
      grid.append(el('label', {}, f.label, out, input));
    }
    wrap.append(grid);
    const checks = el('div', { class: 'checks' });
    for (const [k, label] of [['italic', 'Italic'], ['bold', 'Bold'], ['upper', 'UPPERCASE']]) {
      const cb = el('input', { type: 'checkbox', onchange: e => { S.style[role][k] = e.target.checked; touchStyle(); } });
      roleInputs[role][k] = { input: cb };
      checks.append(el('label', {}, cb, label));
    }
    wrap.append(checks); box.append(wrap);
  }
}
function fillFontOptions() {
  for (const role of ['key', 'filler']) {
    const sel = roleInputs[role].font.input; const cur = S.style ? S.style[role].font : '';
    const names = Array.from(new Set([...S.fonts, cur].filter(Boolean))).sort();
    sel.textContent = ''; names.forEach(n => sel.append(el('option', { value: n, text: n })));
    sel.value = cur;
  }
}
function syncStyleControls() {
  const st = S.style;
  syncCaptionScaleControl();
  $('s_layout').value = st.layout; $('s_animation').value = st.animation;
  $('s_position').value = st.position; $('s_positionOut').textContent = Math.round(st.position * 100) + '%';
  $('s_highlightColor').value = st.highlightColor;
  fillFontOptions();
  for (const role of ['key', 'filler']) for (const f of ROLE_FIELDS) {
    const r = roleInputs[role][f.k]; const v = st[role][f.k];
    if (f.type === 'font') continue;
    r.input.value = v; if (r.out) r.out.textContent = Math.round(v * 100) + '%';
  }
  for (const role of ['key', 'filler']) for (const k of ['italic', 'bold', 'upper']) roleInputs[role][k].input.checked = !!st[role][k];
}
$('s_layout').addEventListener('change', e => { S.style.layout = e.target.value; touchStyle(); });
$('s_animation').addEventListener('change', e => { S.style.animation = e.target.value; touchStyle(); });
$('s_position').addEventListener('input', e => { S.style.position = +e.target.value; $('s_positionOut').textContent = Math.round(e.target.value * 100) + '%'; touchStyle(); });
$('s_highlightColor').addEventListener('input', e => { S.style.highlightColor = e.target.value; touchStyle(); });

function loadCustom() { try { S.custom = JSON.parse(localStorage.getItem('cs_presets_v3') || '[]'); } catch (_) { S.custom = []; } }
function saveCustom() { try { localStorage.setItem('cs_presets_v3', JSON.stringify(S.custom)); } catch (_) {} }
function renderPresets() {
  const box = $('presets'); box.textContent = '';
  let all = [
    ...(S.presets || []).filter(p => p.category === 'special'),
    ...(S.presets || []).filter(p => p.category !== 'special'),
    ...S.custom
  ];
  if (S.selectedCat && S.selectedCat !== 'all') {
    all = all.filter(p => p.category === S.selectedCat);
  }
  if (S.presetSearch) {
    const q = S.presetSearch.toLowerCase();
    all = all.filter(p => (p.name || '').toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q));
  }
  if (!all.length) {
    box.append(el('div', { class: 'empty', style: 'grid-column: 1 / -1;', text: 'No presets matched your search.' }));
    return;
  }
  for (const p of all) {
    const isCustom = !!p.custom;
    const k = p.key, f = p.filler;
    const pv = el('div', { class: 'pv' });
    if (p.previewImg) {
      pv.style.cssText = `position:relative;width:100%;height:44px;border-radius:4px;overflow:hidden;background:#0d0f18 url("${p.previewImg}") center/cover no-repeat;display:flex;align-items:center;justify-content:center;`;
    } else if (p.id === 'ref_dual_neon' || p.refDualNeon) {
      const sYellow = el('span', { text: "And I'm ", style: 'color:#E5FF20;font-weight:800;font-size:12px;text-shadow:0 0 8px rgba(229,255,32,0.8);' });
      const sCyan = el('span', { text: "schizo", style: 'color:#00E5FF;font-weight:900;font-size:14px;text-shadow:0 0 10px rgba(0,229,255,0.9);' });
      pv.append(sYellow, sCyan);
    } else if (p.id === 'ref_kinetic_split' || p.chromaticAberration) {
      const sPill = el('span', { text: "she", style: 'background:rgba(10,10,15,0.9);color:#fff;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:700;margin-right:4px;' });
      const sSuck = el('span', { text: "suck", style: 'color:#9333EA;font-weight:900;font-size:15px;text-shadow:-1.5px 0 #FF1E50, 1.5px 0 #00E5FF;' });
      pv.append(sPill, sSuck);
    } else if (p.id === 'ref_crimson_3d' || p.shadow3D) {
      const sCell = el('span', { text: "cell", style: 'color:#FF2A55;font-weight:900;font-size:16px;text-shadow:1px 1px 0 #7F1D1D, 2px 2px 0 #450A0A, 0 0 12px rgba(239,68,68,0.7);' });
      pv.append(sCell);
    } else if (p.id === 'ref_chrome_studio' || p.chromeSpecular) {
      const sSlate = el('span', { text: "Slate", style: 'background:linear-gradient(180deg,#FFFFFF 0%,#94A3B8 60%,#475569 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-weight:900;font-size:16px;filter:drop-shadow(0 0 8px #fff);display:inline-block;' });
      pv.append(sSlate);
    } else {
      const sp1 = el('span', { text: 'YOU CAN ' });
      sp1.style.cssText = wordCss(f, 12, null, p, false);
      const sp2 = el('span', { text: 'REAL' });
      sp2.style.cssText = wordCss(k, 15, null, p, true);
      if (p.highlight && p.highlight.mode === 'box') {
        sp2.style.background = p.highlight.color || '#FFE600';
        sp2.style.color = p.highlight.textColor || '#000000';
        sp2.style.padding = '1px 5px';
        sp2.style.borderRadius = '3px';
        sp2.style.fontWeight = '900';
      } else if (k && k.keyGradient) {
        sp2.style.backgroundImage = k.keyGradient;
        sp2.style.webkitBackgroundClip = 'text';
        sp2.style.webkitTextFillColor = 'transparent';
      }
      pv.append(sp1, sp2);
    }

    const card = el('button', { type: 'button', class: 'pcard' + (p.id === S.presetId ? ' on' : ''), onclick: () => applyPreset(p) },
      pv, el('b', { text: p.name }),
      p.category ? el('small', { text: p.category.toUpperCase() }) : null,
      isCustom ? el('span', { class: 'del', text: '\u00d7', title: 'Delete', onclick: ev => { ev.stopPropagation(); S.custom = S.custom.filter(c => c.id !== p.id); saveCustom(); renderPresets(); } }) : null);
    box.append(card);
  }
  if ($('presetCountBadge')) {
    $('presetCountBadge').textContent = `${all.length} styles`;
  }
}
function applyPreset(p) {
  History.push('Apply Preset: ' + (p.name || p.id));
  S.style = clone(p); S.presetId = p.id;
  $('wpc').value = S.style.wordsPerCaption; $('wpcOut').textContent = S.style.wordsPerCaption;
  $('maxKeys').value = S.style.maxKeys; $('mkOut').textContent = S.style.maxKeys;
  syncStyleControls(); renderPresets(); touchStyle();
  if (S.rawWords.length) {
    if (!S.edited) regroup(true);
    else notice('Style applied. Press "Regroup words" in step 2 to use this style\u2019s word grouping (this resets your text edits).', '');
  }
}
$('savePreset').addEventListener('click', () => {
  const name = (window.prompt('Name your style:', 'My style') || '').trim().slice(0, 30); if (!name) return;
  const p = clone(S.style); p.name = name; p.id = 'c' + Date.now(); p.custom = true;
  S.custom.push(p); S.presetId = p.id; saveCustom(); renderPresets(); notice('\u2705 Style saved on this computer.', 'ok');
});

// Category Filter Pills & Search
if ($('catPills')) {
  $('catPills').addEventListener('click', e => {
    const btn = e.target.closest('.cat-pill');
    if (!btn) return;
    document.querySelectorAll('.cat-pill').forEach(b => b.classList.remove('on'));
    btn.classList.add('on');
    S.selectedCat = btn.dataset.cat;
    renderPresets();
  });
}
if ($('presetSearch')) {
  $('presetSearch').addEventListener('input', e => {
    S.presetSearch = e.target.value.trim();
    renderPresets();
  });
}

// ------------------------------------------------------------------ 4 auto-cut
[['c_noise', 'c_noiseOut', v => v + ' dB'], ['c_gap', 'c_gapOut', v => v + ' s'], ['c_pad', 'c_padOut', v => v + ' s']]
  .forEach(([i, o, f]) => $(i).addEventListener('input', e => $(o).textContent = f(e.target.value)));
$('detectBtn').addEventListener('click', async () => {
  const btn = $('detectBtn'); setBusy(btn, true, '\u23F3 Listening for gaps...');
  try {
    const d = await api('/api/silence', { filename: S.filename, noiseDb: +$('c_noise').value, minSilence: +$('c_gap').value, pad: +$('c_pad').value });
    S.cuts = d.cuts.map(c => ({ a: c[0], b: c[1], on: true }));
    renderCuts(); renderTimeline();
    notice(S.cuts.length ? '\u2702 Found ' + S.cuts.length + ' gaps. Tick "Preview cuts" under the video to watch the result.' : 'No gaps found. Try a higher sensitivity (closer to -20 dB) or a shorter gap.', S.cuts.length ? 'ok' : '');
  } catch (err) { notice(err.message, 'bad'); }
  finally { setBusy(btn, false); }
});
$('zoom').addEventListener('change', e => S.zoom = e.target.checked);
function renderCuts() {
  const box = $('cutList'); box.textContent = '';
  const on = activeCuts(); const saved = on.reduce((s, c) => s + c.b - c.a, 0), D = dur();
  const sm = $('cutSummary'); sm.textContent = '';
  if (S.cuts.length) sm.append(el('span', {}, 'Removing ', el('b', { text: on.length + ' gaps' }), ' \u00b7 saves ', el('b', { text: saved.toFixed(1) + ' s' }),
    D ? ' (' + Math.round(saved / D * 100) + '% shorter)' : ''));
  else sm.textContent = 'No silent gaps analysed yet.';
  S.cuts.forEach(c => {
    const cb = el('input', { type: 'checkbox', checked: c.on, onchange: e => { c.on = e.target.checked; renderCuts(); renderTimeline(); } });
    box.append(el('div', { class: 'cutrow' }, cb, el('span', { text: fmtT(c.a) + '.' + String(Math.floor((c.a % 1) * 10)) + ' \u2192 ' + fmtT(c.b) + '.' + String(Math.floor((c.b % 1) * 10)) + '  (' + (c.b - c.a).toFixed(1) + ' s)' }),
      el('button', { class: 'btn small ghost', type: 'button', text: '\u25B6 Play', onclick: () => { vid.currentTime = Math.max(0, c.a - 1); vid.play(); } })));
  });
}

// ------------------------------------------------------------------ 5 effects (NEW)
// Aspect ratio
$('aspectBar').addEventListener('click', e => {
  const btn = e.target.closest('.aspect-btn'); if (!btn) return;
  S.aspect = btn.dataset.aspect;
  document.querySelectorAll('.aspect-btn').forEach(b => b.classList.toggle('on', b === btn));
  // Update stage aspect ratio preview
  if (S.aspect !== 'original' && S.meta) {
    const [w, h] = S.aspect.split(':').map(Number);
    stage.style.setProperty('--ar', w / h);
  } else if (S.meta) {
    stage.style.setProperty('--ar', S.meta.width / S.meta.height);
  }
  fitStageToVideo();
});


// Speed
$('speedVal').addEventListener('input', e => {
  S.speed = +e.target.value;
  $('speedOut').textContent = S.speed.toFixed(1) + 'x';
});
$('speedScope').addEventListener('change', e => { S.speedScope = e.target.value; });

// Background music
$('bgMusic').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  S.bgMusic = f;
  $('bgMusicName').textContent = f.name;
  $('musicControls').style.display = '';
  $('musicFadeLabel').style.display = '';
  // Upload music
  try {
    const fd = new FormData(); fd.append('audio', f);
    const r = await fetch('/api/upload-audio', { method: 'POST', body: fd });
    const d = await r.json();
    if (d.error) throw new Error(d.error);
    S.bgMusicFile = d.filename;
    notice('\u266B Background music added: ' + f.name, 'ok');
  } catch (err) {
    notice('Music upload: ' + err.message, 'bad');
  }
});
$('musicVol').addEventListener('input', e => { S.musicVol = +e.target.value; $('musicVolOut').textContent = e.target.value + '%'; });
$('voiceVol').addEventListener('input', e => { S.voiceVol = +e.target.value; $('voiceVolOut').textContent = e.target.value + '%'; });
$('musicFade').addEventListener('change', e => { S.musicFade = e.target.checked; });

// Video effects
$('effectKenBurns').addEventListener('change', e => { S.effects.kenBurns = e.target.checked; });
$('effectVignette').addEventListener('change', e => { S.effects.vignette = e.target.checked; });
$('effectSharpen').addEventListener('change', e => { S.effects.sharpen = e.target.checked; });
$('effectCinemaBar').addEventListener('change', e => { S.effects.cinemaBar = e.target.checked; });

// ------------------------------------------------------------------ 6 b-roll
if ($('chipPexels')) $('chipPexels').addEventListener('click', () => { switchTab('broll'); if ($('keyBox')) $('keyBox').hidden = false; });
$('keySave').addEventListener('click', async () => {
  try { await api('/api/broll/config', { key: $('keyIn').value }); await loadStatus(); notice('\u2705 Pexels key saved.', 'ok'); }
  catch (err) { notice(err.message, 'bad'); }
});
$('suggestBtn').addEventListener('click', async () => {
  try {
    const d = await api('/api/broll/suggest', { captions: S.captions, duration: dur() });
    S.slots = d.slots.map(s => ({ ...s, results: [], chosen: null, loading: false }));
    renderSlots(); renderTimeline();
    notice(S.slots.length ? '\u2728 Found ' + S.slots.length + ' places for b-roll. Press Search on each one.' : 'No good spots found. Use "+ Add spot here".', S.slots.length ? 'ok' : '');
  } catch (err) { notice(err.message, 'bad'); }
});
$('addSlot').addEventListener('click', () => {
  const t = vid.currentTime || 0, id = Math.max(0, ...S.slots.map(s => s.id)) + 1;
  S.slots.push({ id, start: +t.toFixed(1), end: +Math.min(dur(), t + 2.5).toFixed(1), query: '', text: 'Added by you', results: [], chosen: null });
  renderSlots();
});
async function searchSlot(s) {
  if (!s.query.trim()) { notice('Type what you want to see, for example "coffee shop".', 'bad'); return; }
  s.loading = true; renderSlots();
  try {
    const d = await api('/api/broll/search', { query: s.query, orientation: S.meta && S.meta.width >= S.meta.height ? 'landscape' : 'portrait' });
    s.results = d.results; if (!d.results.length) notice('No clips found for "' + s.query + '". Try other words.', '');
  } catch (err) { notice(err.message, 'bad'); }
  s.loading = false; renderSlots();
}
function renderSlots() {
  const box = $('slots'); box.textContent = '';
  for (const s of S.slots) {
    const mk = (k, label) => el('label', {}, label, el('input', { type: 'number', step: '0.1', min: '0', value: s[k], oninput: e => { s[k] = num(e.target.value, s[k]); renderTimeline(); } }));
    const q = el('input', { type: 'text', value: s.query, placeholder: 'e.g. luxury kitchen', oninput: e => s.query = e.target.value, onkeydown: e => { if (e.key === 'Enter') searchSlot(s); } });
    const card = el('div', { class: 'slot' },
      el('div', { class: 'head' }, el('b', { text: 'Spot ' + s.id }),
        el('button', { class: 'x', type: 'button', text: '\u00d7', title: 'Remove spot', onclick: () => { S.slots = S.slots.filter(x => x !== s); renderSlots(); renderTimeline(); } })),
      el('div', { class: 'why', text: s.text ? '\u201c' + s.text + '\u201d' : '' }),
      el('div', { class: 'controls' }, mk('start', 'Start'), mk('end', 'End'), el('label', {}, 'Search', q),
        el('button', { class: 'btn small', type: 'button', text: s.loading ? '\u23F3 Searching...' : '\u{1F50D} Search', disabled: !!s.loading, onclick: () => searchSlot(s) })));
    if (s.chosen) card.append(el('div', { class: 'chosen' }, el('img', { src: s.chosen.thumb, alt: '' }),
      el('span', { text: '\u2705 Using clip by ' + (s.chosen.credit || 'Pexels') }),
      el('button', { class: 'btn small ghost', type: 'button', text: 'Remove', onclick: () => { s.chosen = null; renderSlots(); renderTimeline(); } })));
    if (s.results.length) {
      const grid = el('div', { class: 'results' });
      for (const r of s.results) grid.append(el('button', { type: 'button', class: 'thumb' + (s.chosen && s.chosen.id === r.id ? ' on' : ''), title: 'Use this clip',
        onclick: () => { s.chosen = r; renderSlots(); renderTimeline(); } }, el('img', { src: r.thumb, alt: '', loading: 'lazy' }), el('span', { text: Math.round(r.duration || 0) + 's' })));
      card.append(grid);
    }
    box.append(card);
  }
}

// ------------------------------------------------------------------ 7 export
function updateExportSummary() {
  const sm = $('expSummary'); sm.textContent = '';
  const chosen = S.slots.filter(s => s.chosen).length;
  const effectCount = Object.values(S.effects).filter(Boolean).length;
  sm.append(
    el('div', { class: 'stat-pills' },
      el('span', { class: 'stat-pill', text: '\u{1F4AC} ' + S.captions.length + ' captions' }),
      S.graphics.length ? el('span', { class: 'stat-pill', text: '\u{1F3A8} ' + S.graphics.length + ' graphics' }) : null,
      el('span', { class: 'stat-pill', text: '\u2702 ' + activeCuts().length + ' cuts' }),
      el('span', { class: 'stat-pill', text: '\u{1F3AC} ' + chosen + ' b-roll' }),
      effectCount ? el('span', { class: 'stat-pill', text: '\u2728 ' + effectCount + ' effects' }) : null,
      S.speed !== 1.0 ? el('span', { class: 'stat-pill', text: '\u23E9 ' + S.speed.toFixed(1) + 'x speed' }) : null,
      S.bgMusicFile ? el('span', { class: 'stat-pill', text: '\u266B Music' }) : null
    )
  );
  sm.append(el('div', { class: 'hint', text: 'Style: ' + (S.style ? S.style.name : '') + ' \u00b7 Aspect: ' + S.aspect + ' \u00b7 Quality: ' + $('exportQuality').value }));
}
$('exportQuality').addEventListener('change', e => { S.exportQuality = e.target.value; });
$('exportFormat').addEventListener('change', e => { S.exportFormat = e.target.value; });
$('exportEngine').addEventListener('change', e => { S.exportEngine = e.target.value; });
$('exportBtn').addEventListener('click', () => {
  if (!S.filename) { notice('Upload a video first to open export settings.', 'bad'); return; }
  const premiumOption = $('exportEngine').querySelector('option[value="remotion"]');
  const supportsPremium = S.presets.some(p => p.id === S.presetId && p.category === 'remotion');
  premiumOption.disabled = !supportsPremium;
  if (!supportsPremium) S.exportEngine = 'ffmpeg';
  $('exportEngine').value = S.exportEngine;
  $('exportQuality').value = S.exportQuality;
  $('exportFormat').value = S.exportFormat;
  updateExportSummary();
  const dialog = $('exportDialog');
  if (dialog && !dialog.open) {
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }
});
$('closeExportDialog').addEventListener('click', () => $('exportDialog').close());
$('exportDialog').addEventListener('click', e => {
  if (e.target === $('exportDialog')) $('exportDialog').close();
});
$('startExportBtn').addEventListener('click', async () => {
  if (!S.filename) return;
  const body = { filename: S.filename, captions: S.captions, style: S.style, cuts: activeCuts().map(c => [c.a, c.b]),
    zoom: S.zoom && activeCuts().length > 0,
    broll: S.slots.filter(s => s.chosen).map(s => ({ start: s.start, end: s.end, url: s.chosen.url, id: s.chosen.id })),
    // Motion graphics
    graphics: S.graphics,
    // New features
    aspect: S.aspect, speed: S.speed, speedScope: S.speedScope,
    bgMusic: S.bgMusicFile || null, musicVol: S.musicVol, voiceVol: S.voiceVol, musicFade: S.musicFade,
    effects: S.effects, quality: S.exportQuality, format: S.exportFormat, engine: S.exportEngine
  };
  $('result').hidden = true; $('prog').hidden = false; $('pfill').style.width = '2%'; $('pmsg').textContent = 'Starting...';
  setBusy($('exportBtn'), true, '\u23F3 Rendering...');
  try {
    const { job } = await api('/api/export', body);
    for (;;) {
      await new Promise(r => setTimeout(r, 1000));
      const j = await api('/api/jobs/' + job);
      $('pfill').style.width = Math.max(2, j.progress || 0) + '%'; $('pmsg').textContent = j.message + ' ' + Math.round(j.progress || 0) + '%';
      if (j.status === 'done') { $('resVid').src = j.download; $('dl').href = j.download; $('result').hidden = false; $('prog').hidden = true; notice('\u2705 Done! Press Download video.', 'ok'); break; }
      if (j.status === 'error') throw new Error(j.message);
    }
  } catch (err) { $('prog').hidden = true; notice(err.message, 'bad'); }
  finally { setBusy($('exportBtn'), false); }
});

// ------------------------------------------------------------------ 8 AI Director
if ($('aiAnalyzeBtn')) {
  $('aiAnalyzeBtn').addEventListener('click', async () => {
    if (!S.filename) { notice('Please choose a video in step 1 first.', 'bad'); return; }
    const btn = $('aiAnalyzeBtn');
    setBusy(btn, true, '\u23F3 Analyzing video...');
    notice('Analyzing visual frames, speech semantics, entities, and safe zones...', 'busy');
    try {
      const res = await api('/api/ai/analyze', {
        filename: S.filename,
        captions: S.captions,
        words: S.rawWords
      });
      const plan = res.plan || res;
      S.aiPlan = plan;

      $('aiPlanContainer').style.display = '';
      $('aiGenreVal').textContent = (plan.video_genre || plan.genre || 'Social Reel').replace(/_/g, ' ').toUpperCase();
      $('aiAspectVal').textContent = plan.aspect_ratio || plan.aspectRatio || '9:16 Portrait';
      $('aiConfVal').textContent = Math.round((plan.confidence || plan.genreConfidence || 0.9) * 100) + '%';
      const proposed = plan.proposed_graphics || plan.proposedGraphics || [];
      $('aiPlanCount').textContent = proposed.length;

      const list = $('aiPlanList');
      list.textContent = '';
      proposed.forEach((pg, idx) => {
        const item = el('div', { class: 'ai-plan-item' });
        const cb = el('input', { type: 'checkbox', checked: true });
        cb.dataset.idx = idx;

        const info = el('div', { class: 'ai-plan-item-info' },
          el('div', { class: 'ai-plan-item-title' },
            el('span', { class: 'ai-plan-badge', text: pg.type.replace(/_/g, ' ') }),
            el('b', { text: (pg.data && (pg.data.title || pg.data.value || pg.data.keyword || pg.data.location)) || pg.type }),
            el('span', { class: 'ai-plan-time', text: fmtT(pg.start) + ' \u2192 ' + fmtT(pg.end) })
          ),
          el('div', { class: 'ai-plan-item-why', text: '\u{1F4A1} ' + (pg.reason || 'Emphasize key statement') })
        );

        const previewBtn = el('button', { class: 'btn tiny ghost', type: 'button', text: '\u25B6 Seek', onclick: (ev) => {
          ev.stopPropagation();
          vid.currentTime = pg.start;
        }});

        item.append(cb, info, previewBtn);
        item.addEventListener('click', (ev) => {
          if (ev.target !== cb && ev.target !== previewBtn) {
            cb.checked = !cb.checked;
          }
        });
        list.append(item);
      });

      $('applyPlanBtn').disabled = false;
      notice(`\u2705 AI Analysis complete! Found ${proposed.length} motion graphic moments.`, 'ok');
    } catch (err) {
      notice('AI Analysis failed: ' + err.message, 'bad');
    } finally {
      setBusy(btn, false);
    }
  });
}

if ($('applyPlanBtn')) {
  $('applyPlanBtn').addEventListener('click', () => {
    if (!S.aiPlan) return;
    History.push('Apply AI Graphics Plan');
    const proposed = S.aiPlan.proposed_graphics || S.aiPlan.proposedGraphics || [];
    const cbs = document.querySelectorAll('#aiPlanList input[type="checkbox"]');
    let added = 0;
    cbs.forEach(cb => {
      if (cb.checked) {
        const idx = +cb.dataset.idx;
        const pg = proposed[idx];
        if (pg) {
          const newId = 'mg_ai_' + Date.now() + '_' + idx;
          S.graphics.push({
            id: newId,
            type: pg.type,
            name: pg.type.replace(/_/g, ' '),
            start: pg.start,
            end: pg.end,
            position: pg.position || 'bottom_left',
            animation: { enter: pg.animation_in || 'fade_slide_down', exit: 'fade_slide_up', duration: 0.35 },
            data: clone(pg.data || {}),
            reason: pg.reason,
            enabled: true
          });
          added++;
        }
      }
    });
    renderTimeline();
    renderMotionGraphics(vid.currentTime || 0);
    notice(`\u{1F389} Applied ${added} AI motion graphics to timeline!`, 'ok');
    switchTab('graphics');
  });
}

// ------------------------------------------------------------------ 8.1 1-Click AI Magic
async function runAiMagic(sourceBtn) {
  if (!S.filename) {
    notice('Please choose or upload a video first.', 'bad');
    return;
  }
  const btn = sourceBtn || $('btnAiMagic');
  setBusy(btn, true, '\u23F3 1-Click AI running...');
  notice('1-Click AI: Analyzing speech, motion graphics & applying Lavender Dream blend...', 'busy');

  try {
    // 1. If captions don't exist yet, run transcription automatically
    if (!S.captions || !S.captions.length) {
      notice('\u23F3 Transcribing speech with Whisper...', 'busy');
      const langVal = ($('lang') && $('lang').value) || 'auto';
      const modelVal = ($('model') && $('model').value) || 'base';
      const d = await api('/api/transcribe', {
        filename: S.filename,
        model: modelVal,
        language: langVal,
        vad_filter: true
      });
      if (d.captions) {
        S.captions = d.captions;
        S.rawWords = d.words || [];
        renderCapList();
        renderTimeline();
        if ($('regroup')) $('regroup').disabled = false;
        if ($('suggestBtn')) $('suggestBtn').disabled = false;
      }
    }

    // 2. Run AI semantic analysis for After Effects-style motion graphics
    notice('\u23F3 AI Director: Generating context-aware motion graphics...', 'busy');
    const res = await api('/api/ai/analyze', {
      filename: S.filename,
      captions: S.captions,
      words: S.rawWords
    });
    const plan = res.plan || res;
    S.aiPlan = plan;

    // Update AI director panel values if visible
    if ($('aiPlanContainer')) $('aiPlanContainer').style.display = '';
    if ($('aiGenreVal')) $('aiGenreVal').textContent = (plan.video_genre || plan.genre || 'Social Reel').replace(/_/g, ' ').toUpperCase();
    if ($('aiAspectVal')) $('aiAspectVal').textContent = plan.aspect_ratio || plan.aspectRatio || '9:16 Portrait';
    if ($('aiConfVal')) $('aiConfVal').textContent = Math.round((plan.confidence || plan.genreConfidence || 0.9) * 100) + '%';

    const proposed = plan.proposed_graphics || plan.proposedGraphics || [];
    if ($('aiPlanCount')) $('aiPlanCount').textContent = proposed.length;

    // 3. Apply the Exact Reference Preset (Dual Neon Aura - Frame 11)
    let targetPreset = S.presets.find(p => p.id === 'ref_dual_neon') ||
                       S.presets.find(p => p.id === 'ref_kinetic_split') ||
                       S.presets.find(p => p.id === 'lavender_aura_blend') ||
                       S.presets[0];
    if (targetPreset) {
      applyPreset(targetPreset);
    }

    // 4. Inject proposed 3D Motion Graphics onto timeline
    if (proposed.length > 0) {
      History.push('1-Click AI Magic');
      // Clear previous auto-generated AI graphics to prevent clutter
      S.graphics = S.graphics.filter(g => !g.id || !g.id.startsWith('mg_ai_'));
      proposed.forEach((pg, idx) => {
        const newId = 'mg_ai_' + Date.now() + '_' + idx;
        S.graphics.push({
          id: newId,
          type: pg.type,
          name: pg.type.replace(/_/g, ' '),
          start: pg.start,
          end: pg.end,
          position: pg.position || 'center',
          animation: { enter: pg.animation_in || 'scale_pop', exit: 'fade_scale', duration: 0.35 },
          data: clone(pg.data || {}),
          reason: pg.reason,
          enabled: true
        });
      });
    }

    // 5. Update stage, inspector & timeline
    renderTimeline();
    renderMotionGraphics(vid.currentTime || 0);
    renderStage();
    capSig = '';
    touchStyle();

    notice(`\u2728 1-Click AI Magic complete! Applied Reference Dual-Neon preset & placed ${proposed.length} 3D motion graphics!`, 'ok');
    switchTab('captions');
  } catch (err) {
    console.error('1-Click AI error:', err);
    notice('1-Click AI Magic error: ' + (err.message || err), 'bad');
  } finally {
    setBusy(btn, false);
  }
}

if ($('btnAiMagic')) $('btnAiMagic').addEventListener('click', () => runAiMagic($('btnAiMagic')));
if ($('btnAiMagicPanel')) $('btnAiMagicPanel').addEventListener('click', () => runAiMagic($('btnAiMagicPanel')));

// ------------------------------------------------------------------ 9 Motion Graphics & Inspector
async function loadGraphicTemplates() {
  const grid = $('mgTemplatesGrid');
  if (!grid) return;
  try {
    const d = await api('/api/graphics/templates');
    S.mgTemplates = d.templates || [];
    grid.textContent = '';
    for (const t of S.mgTemplates) {
      const card = el('div', { class: 'mg-template-card', onclick: () => addGraphicFromTemplate(t) },
        el('div', { class: 'mg-tpl-icon', text: t.icon || '\u{1F3A8}' }),
        el('div', { class: 'mg-tpl-info' },
          el('b', { text: t.name }),
          el('span', { text: t.description })
        ),
        el('button', { class: 'btn tiny ghost', type: 'button', text: '+ Add' })
      );
      grid.append(card);
    }
  } catch (err) {
    console.error('Failed to load graphics templates:', err);
  }
}

function addGraphicFromTemplate(t) {
  History.push('Add Graphic: ' + t.name);
  const curTime = vid.currentTime || 0;
  const newId = 'mg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  const newG = {
    id: newId,
    type: t.id,
    name: t.name,
    start: +curTime.toFixed(2),
    end: +(Math.min(dur() || (curTime + 3), curTime + 3)).toFixed(2),
    position: t.defaultPosition || 'bottom_left',
    animation: { enter: t.defaultEnter || 'fade_slide_down', exit: 'fade_slide_up', duration: 0.35 },
    data: clone(t.defaultData || {}),
    enabled: true
  };
  S.graphics.push(newG);
  selectGraphic(newId);
  notice(`\u2728 Added "${t.name}" at ${fmtT(curTime)}`, 'ok');
}

function selectGraphic(id) {
  S.selectedGraphic = id;
  const g = S.graphics.find(x => x.id === id);
  const inspFields = $('inspectorFields');
  const inspEmpty = $('inspectorEmpty');
  const delBtn = $('delGraphicBtn');

  if (!g) {
    if (inspFields) inspFields.style.display = 'none';
    if (inspEmpty) inspEmpty.style.display = '';
    if (delBtn) delBtn.disabled = true;
    if ($('inspectorTitle')) $('inspectorTitle').textContent = '\u2699\uFE0F Graphic Inspector';
    renderTimeline();
    renderMotionGraphics(vid.currentTime || 0);
    return;
  }

  if (inspFields) inspFields.style.display = '';
  if (inspEmpty) inspEmpty.style.display = 'none';
  if (delBtn) delBtn.disabled = false;
  if ($('inspectorTitle')) $('inspectorTitle').textContent = `\u2699\uFE0F Graphic: ${g.name || g.type}`;

  const d = g.data || {};
  if ($('inspTitle')) $('inspTitle').value = d.title || d.topText || d.keyword || d.quote || d.location || '';
  if ($('inspSubtitle')) $('inspSubtitle').value = d.subtitle || d.bottomText || d.subtext || d.tag || d.author || '';
  if ($('inspValue')) $('inspValue').value = d.value || d.views || d.metric || '';
  if ($('inspTag')) $('inspTag').value = d.label || d.tag || d.buttonText || d.handle || d.status || '';
  if ($('inspPosition')) $('inspPosition').value = g.position || 'bottom_left';
  if ($('inspEnterAnim')) $('inspEnterAnim').value = (g.animation && g.animation.enter) || 'fade_slide_down';
  if ($('inspAccentColor')) $('inspAccentColor').value = d.accentColor || '#38bdf8';
  if ($('inspBgColor')) $('inspBgColor').value = (d.bgColor && d.bgColor.startsWith('#')) ? d.bgColor : '#0f172a';
  if ($('inspStartTime')) $('inspStartTime').value = g.start;
  if ($('inspEndTime')) $('inspEndTime').value = g.end;

  S.graphicDirty = true;
  renderTimeline();
  renderMotionGraphics(vid.currentTime || 0);
}

function updateSelectedGraphic() {
  if (!S.selectedGraphic) return;
  const g = S.graphics.find(x => x.id === S.selectedGraphic);
  if (!g) return;
  if (!g.data) g.data = {};

  const titleVal = $('inspTitle') ? $('inspTitle').value : '';
  const subVal = $('inspSubtitle') ? $('inspSubtitle').value : '';
  const valVal = $('inspValue') ? $('inspValue').value : '';
  const tagVal = $('inspTag') ? $('inspTag').value : '';

  if (g.type === 'split_kinetic_title') {
    g.data.topText = titleVal;
    g.data.bottomText = subVal;
    g.data.title = titleVal;
    g.data.subtitle = subVal;
  } else if (g.type === 'isometric_phone_card') {
    g.data.title = titleVal;
    g.data.subtitle = subVal;
    if (valVal) g.data.views = valVal;
    if (tagVal) g.data.handle = tagVal;
  } else if (g.type === 'cyber_hud_metric') {
    g.data.metric = valVal || '99%';
    g.data.label = tagVal || 'METRIC';
    g.data.status = subVal || 'LIVE';
  } else if (g.type === 'profit_money_callout') {
    g.data.value = valVal || '+$10,000';
    g.data.label = tagVal || 'NET PROFIT';
  } else if (g.type === 'statistic_counter' || g.type === 'price_callout') {
    g.data.value = valVal;
    g.data.label = tagVal || 'METRIC';
    g.data.subtext = subVal;
  } else if (g.type === 'lower_third') {
    g.data.tag = tagVal || 'SPEAKER';
    g.data.title = titleVal;
    g.data.subtitle = subVal;
  } else if (g.type === 'call_to_action') {
    g.data.title = titleVal;
    g.data.subtitle = subVal;
    g.data.buttonText = tagVal || 'LEARN MORE';
  } else {
    g.data.title = titleVal;
    g.data.subtitle = subVal;
    if (valVal) g.data.value = valVal;
    if (tagVal) g.data.tag = tagVal;
  }

  if ($('inspPosition')) g.position = $('inspPosition').value;
  if ($('inspEnterAnim')) {
    if (!g.animation) g.animation = {};
    g.animation.enter = $('inspEnterAnim').value;
  }
  if ($('inspAccentColor')) g.data.accentColor = $('inspAccentColor').value;
  if ($('inspBgColor')) g.data.bgColor = $('inspBgColor').value;
  if ($('inspStartTime')) g.start = num($('inspStartTime').value, g.start);
  if ($('inspEndTime')) g.end = num($('inspEndTime').value, g.end);

  S.graphicDirty = true;
  renderTimeline();
  renderMotionGraphics(vid.currentTime || 0);
}

['inspTitle', 'inspSubtitle', 'inspValue', 'inspTag', 'inspPosition', 'inspEnterAnim', 'inspAccentColor', 'inspBgColor', 'inspStartTime', 'inspEndTime'].forEach(id => {
  const el = $(id);
  if (el) {
    el.addEventListener('input', updateSelectedGraphic);
    el.addEventListener('change', updateSelectedGraphic);
  }
});

if ($('delGraphicBtn')) {
  $('delGraphicBtn').addEventListener('click', () => {
    if (!S.selectedGraphic) return;
    History.push('Delete Graphic');
    S.graphics = S.graphics.filter(x => x.id !== S.selectedGraphic);
    selectGraphic(null);
    notice('Graphic removed from timeline.', 'ok');
  });
}

if ($('addGraphicBtn')) {
  $('addGraphicBtn').addEventListener('click', () => {
    if (S.mgTemplates.length) {
      addGraphicFromTemplate(S.mgTemplates[0]);
    } else {
      switchTab('graphics');
    }
  });
}

// ------------------------------------------------------------------ 10 Project Save & Load
if ($('btnSaveProj')) {
  $('btnSaveProj').addEventListener('click', async () => {
    const name = (window.prompt('Enter project name:', S.projectName || 'My Video Project') || '').trim();
    if (!name) return;
    S.projectName = name;
    const projectData = {
      name: S.projectName,
      filename: S.filename,
      meta: S.meta,
      captions: S.captions,
      rawWords: S.rawWords,
      graphics: S.graphics,
      cuts: S.cuts,
      slots: S.slots,
      style: S.style,
      presetId: S.presetId,
      aspect: S.aspect,
      speed: S.speed,
      speedScope: S.speedScope,
      bgMusicFile: S.bgMusicFile || null,
      musicVol: S.musicVol,
      voiceVol: S.voiceVol,
      musicFade: S.musicFade,
      effects: S.effects,
      exportQuality: S.exportQuality,
      exportFormat: S.exportFormat,
      exportEngine: S.exportEngine
    };
    try {
      await api('/api/project/save', projectData);
      notice(`\u{1F4BE} Project "${name}" saved successfully!`, 'ok');
    } catch (err) {
      notice('Save failed: ' + err.message, 'bad');
    }
  });
}

if ($('btnLoadProj')) {
  $('btnLoadProj').addEventListener('click', async () => {
    try {
      const res = await api('/api/project/list');
      const list = res.projects || [];
      if (!list.length) {
        notice('No saved projects found on this computer.', '');
        return;
      }
      const choices = list.map((p, i) => `${i + 1}. ${p.name || 'Untitled'} (${p.filename || 'no video'})`).join('\n');
      const pick = window.prompt(`Select project number to open:\n\n${choices}\n\nEnter number (1-${list.length}):`, '1');
      if (!pick) return;
      const idx = parseInt(pick, 10) - 1;
      if (idx < 0 || idx >= list.length) {
        notice('Invalid project selection.', 'bad');
        return;
      }
      const pid = list[idx].id;
      const d = await api(`/api/project/${pid}`);
      if (d) {
        S.projectName = d.name || 'My Video Project';
        if (d.filename) {
          S.filename = d.filename;
          S.meta = d.meta;
          vid.src = '/video/' + d.filename;
          $('fileName').textContent = d.filename;
          $('stageEmpty').hidden = true;
          if (d.meta) stage.style.setProperty('--ar', d.meta.width / d.meta.height);
          ['transcribeBtn', 'browserSpeechBtn', 'addCap', 'detectBtn', 'playBtn', 'exportBtn', 'addSlot', 'aiAnalyzeBtn', 'addGraphicBtn', 'btnSaveProj', 'btnAiMagic', 'btnAiMagicPanel'].forEach(id => {
            const el = $(id); if (el) el.disabled = false;
          });
        }
        if (d.captions) S.captions = d.captions;
        if (d.rawWords) S.rawWords = d.rawWords;
        if (d.graphics) S.graphics = d.graphics;
        if (d.cuts) S.cuts = d.cuts;
        if (d.slots) S.slots = d.slots;
        if (d.style) { S.style = d.style; syncStyleControls(); }
        if (d.aspect) S.aspect = d.aspect;
        if (d.speed) S.speed = d.speed;
        if (d.effects) S.effects = d.effects;
        if (d.exportQuality) S.exportQuality = d.exportQuality;
        if (d.exportFormat) S.exportFormat = d.exportFormat;
        if (d.exportEngine) S.exportEngine = d.exportEngine;
        if (d.bgMusicFile) S.bgMusicFile = d.bgMusicFile;
        capSig = '';
        renderCapList();
        renderCuts();
        renderSlots();
        renderTimeline();
        renderMotionGraphics(vid.currentTime || 0);
        notice(`\u{1F4C2} Project "${S.projectName}" loaded!`, 'ok');
      }
    } catch (err) {
      notice('Failed to load project: ' + err.message, 'bad');
    }
  });
}

// ------------------------------------------------------------------ start
async function loadStatus() {
  const s = await api('/api/status'); S.status = s;
  if ($('model')) {
    $('model').disabled = !s.server_whisper;
    $('model').title = s.server_whisper ? 'Choose the local Whisper model size.' : 'Local Whisper is unavailable with this Python environment; this setting cannot change online recognition.';
  }
  const set = (id, ok) => { if ($(id)) $(id).className = 'chip' + (id === 'chipPexels' ? ' btnchip ' : ' ') + (ok ? 'ok' : 'bad'); };
  set('chipFfmpeg', s.ffmpeg && s.ass); set('chipWhisper', s.server_whisper || s.server_sr); set('chipPexels', s.pexels);
  $('chipFfmpeg').textContent = 'FFmpeg ' + (s.ffmpeg && s.ass ? '\u2713' : '\u2717');
  $('chipWhisper').textContent = s.server_whisper ? 'Local Whisper ✓' : (s.server_sr ? 'Speech online only' : 'Speech unavailable');
  if ($('chipPexels')) $('chipPexels').textContent = 'Pexels ' + (s.pexels ? '\u2713' : '\u2717 add key');
  if ($('keyBox')) $('keyBox').hidden = !!s.pexels;
  return s;
}
(async function init() {
  buildRoles(); loadCustom();
  
  // Wire up Undo / Redo controls
  const doUndo = () => History.undo();
  const doRedo = () => History.redo();
  if ($('btnUndo')) $('btnUndo').addEventListener('click', doUndo);
  if ($('btnRedo')) $('btnRedo').addEventListener('click', doRedo);
  if ($('tlUndoBtn')) $('tlUndoBtn').addEventListener('click', doUndo);
  if ($('tlRedoBtn')) $('tlRedoBtn').addEventListener('click', doRedo);
  
  window.addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
      if (!e.ctrlKey && !e.metaKey) return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
      e.preventDefault();
      History.undo();
    } else if (((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) ||
               ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'z' || e.key === 'Z'))) {
      e.preventDefault();
      History.redo();
    }
  });
  History.updateButtons();
  initMediaPipe();

  try {
    const [p, f] = await Promise.all([api('/api/presets'), api('/api/fontlist')]);
    S.presets = p.presets; S.fonts = f.fonts;
    S.style = clone(p.presets[0]); S.presetId = p.presets[0].id; syncStyleControls(); renderPresets();
    
    // Render 9:16 vertical presets gallery and sync selection
    renderMoonshotGallery('all');
    updateMoonshotSelection(S.presetId);

    const gPills = document.querySelectorAll('.gallery-pill');
    gPills.forEach(pill => {
      pill.addEventListener('click', () => {
        gPills.forEach(x => x.classList.remove('on'));
        pill.classList.add('on');
        const cat = pill.dataset.cat || 'all';
        renderMoonshotGallery(cat);
        const heading = $('galleryHeading');
        if (heading) heading.innerHTML = `${pill.innerHTML}`;
      });
    });
    await loadGraphicTemplates();
    const s = await loadStatus();
    if (!s.ffmpeg) notice('FFmpeg is missing. Follow SETUP.md (step 2), then restart the app.', 'bad');
    else if (!s.ass) notice('Your FFmpeg cannot draw captions (no "ass" filter). Install the full build from SETUP.md.', 'bad');
    else if (!s.whisper) notice('No speech recognition engine is available. Use Browser Speech or import an SRT/VTT file.', 'bad');
    else if (!s.server_whisper) notice('Local Whisper is unavailable in this Python environment. Generate Captions uses online speech recognition and estimated word timing; review captions before export.', 'busy');
    else notice('\u{1F3AC} Ready! Step 1: choose a video to get started.', 'ok');
  } catch (err) { notice(err.message, 'bad'); }
  requestAnimationFrame(tick);
})();

