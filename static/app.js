/* ==========================================================================
   HLO CAPTIONS - CLIENT APPLICATION (v3.04)
   164 Presets + Instant Zero-Lag Video Preview + Accurate Listening AI + Duo Pack
   ========================================================================== */

(function () {
  'use strict';

  // --- Helpers ---
  const $ = (id) => document.getElementById(id);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const round = (n, d = 2) => Number(Number(n).toFixed(d));

  // --- Global State ---
  const S = {
    file: null,
    filename: '',
    probe: { width: 1080, height: 1920, fps: 30, duration: 0 },
    captions: [],
    presets: [],
    style: null,
    activeTab: 'tabTemplates',
    drawerOpen: true,
    drawerFullscreen: false,
    bgmFilename: '',
    bgmVolume: 0.3,
    vidVolume: 1.0,
    exportJobId: null,
    exportTimer: null,
  };

  // --- DOM Elements ---
  const viewUpload = $('viewUpload');
  const viewEditor = $('viewEditor');

  // Upload elements
  const dropZone = $('dropZone');
  const fileInput = $('fileInput');
  const btnSelectFile = $('btnSelectFile');
  const langSelect = $('langSelect');
  const scriptInput = $('scriptInput');
  const uploadProgressBox = $('uploadProgressBox');
  const uploadStatusText = $('uploadStatusText');
  const uploadPercent = $('uploadPercent');
  const uploadProgressBar = $('uploadProgressBar');
  const uploadError = $('uploadError');

  // Editor elements
  const btnNewVideo = $('btnNewVideo');
  const headerFileName = $('headerFileName');
  const btnExport = $('btnExport');
  const stage = $('stage');
  const vid = $('vid');
  const captionCanvas = $('captionCanvas');
  const ctx = captionCanvas.getContext('2d');
  const btnStageFullscreen = $('btnStageFullscreen');

  // Transport elements
  const btnPlayPause = $('btnPlayPause');
  const iconPlay = $('iconPlay');
  const iconPause = $('iconPause');
  const timeCurrent = $('timeCurrent');
  const timeDuration = $('timeDuration');
  const timeScrub = $('timeScrub');
  const btnMute = $('btnMute');
  const iconVolume = $('iconVolume');
  const iconMuted = $('iconMuted');

  // Timeline elements
  const timelineSection = $('timelineSection');
  const timelineTrackWrap = $('timelineTrackWrap');
  const timelineRuler = $('timelineRuler');
  const timelineLane = $('timelineLane');
  const timelinePlayhead = $('timelinePlayhead');
  const tlTimeIndicator = $('tlTimeIndicator');

  // Drawer & Lowest Nav elements
  const drawerPanel = $('drawerPanel');
  const drawerTitle = $('drawerTitle');
  const btnDrawerExpand = $('btnDrawerExpand');
  const iconExpand = $('iconExpand');
  const iconCollapse = $('iconCollapse');
  const btnDrawerClose = $('btnDrawerClose');
  const btnToggleTimeline = $('btnToggleTimeline');

  // Presets & Templates
  const presetsGrid = $('presetsGrid');
  const selectedPresetName = $('selectedPresetName');
  const btnGenerateTemplate = $('btnGenerateTemplate');
  const btnOpenFullTemplates = $('btnOpenFullTemplates');

  // Captions list
  const captionsList = $('captionsList');
  const captionCountBadge = $('captionCountBadge');
  const btnAddCaption = $('btnAddCaption');
  const btnSyncScriptModal = $('btnSyncScriptModal');

  // Style controls
  const inputFontSize = $('inputFontSize');
  const valFontSize = $('valFontSize');
  const posButtonGroup = $('posButtonGroup');
  const colorSwatches = $('colorSwatches');
  const selectFont = $('selectFont');
  const caseButtonGroup = $('caseButtonGroup');

  // Audio controls
  const inputVidVol = $('inputVidVol');
  const valVidVol = $('valVidVol');
  const btnAddBgm = $('btnAddBgm');
  const bgmFileInput = $('bgmFileInput');
  const bgmFilename = $('bgmFilename');
  const inputBgmVol = $('inputBgmVol');
  const valBgmVol = $('valBgmVol');

  // Modals
  const modalTemplates = $('modalTemplates');
  const btnCloseTemplatesModal = $('btnCloseTemplatesModal');
  const templateSearchInput = $('templateSearchInput');
  const fullTemplatesGrid = $('fullTemplatesGrid');

  const modalScript = $('modalScript');
  const btnCloseScriptModal = $('btnCloseScriptModal');
  const modalScriptText = $('modalScriptText');
  const btnCancelScript = $('btnCancelScript');
  const btnApplyScript = $('btnApplyScript');

  const modalExport = $('modalExport');
  const btnCloseExportModal = $('btnCloseExportModal');
  const exportWorkingState = $('exportWorkingState');
  const exportDoneState = $('exportDoneState');
  const exportErrorState = $('exportErrorState');
  const exportProgressBar = $('exportProgressBar');
  const exportPercent = $('exportPercent');
  const exportProgressText = $('exportProgressText');
  const exportProgressDetail = $('exportProgressDetail');
  const exportPreviewVideo = $('exportPreviewVideo');
  const btnDownloadExport = $('btnDownloadExport');
  const exportErrorMessage = $('exportErrorMessage');
  const btnRetryExport = $('btnRetryExport');

  const toastNotification = $('toastNotification');

  // ==========================================================================
  // 133+ PRESETS TYPOGRAPHY ENGINE (DualNeon, KineticLens, Crimson3D, ChromeStudio, EstateDepth, SpecialFront, Standard)

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



  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================
  async function init() {
    setupUploadHandlers();
    setupTransportHandlers();
    setupTimelineHandlers();
    setupDrawerAndNavHandlers();
    setupStyleHandlers();
    setupAudioHandlers();
    setupModalHandlers();
    setupCanvasSizing();
    setupCaptionDragging();

    await loadPresets();
  }

  // ==========================================================================
  // LOAD PRESETS FROM SERVER + MERGE LOCAL CS_PRESETS (DUO PACK)
  // ==========================================================================
  async function loadPresets() {
    try {
      const res = await fetch('/api/presets');
      const data = await res.json();
      S.presets = data.presets || [];

      // Merge any local Duo or custom saved presets from localStorage
      try {
        const stored = JSON.parse(localStorage.getItem('cs_presets') || '[]');
        if (Array.isArray(stored) && stored.length > 0) {
          const haveNames = new Set(S.presets.map(p => p.name));
          stored.forEach(p => {
            if (!haveNames.has(p.name)) {
              S.presets.push(p);
              haveNames.add(p.name);
            }
          });
        }
      } catch(e) {}

      if (S.presets.length > 0) {
        const initial = S.presets.find(p => p.id === 'yellow_box' || p.id === 'box_pop') || S.presets[0];
        applyPreset(initial, false);
      }
      renderPresetsTab('all');
    } catch (e) {
      console.warn('Failed to load presets, using default:', e);
      applyPreset({
        id: 'box_pop',
        name: 'Box Pop Classic',
        highlightColor: '#FFE600',
        key: { font: 'Poppins', color: '#FFE600', bold: true },
        filler: { font: 'Poppins', color: '#FFFFFF' },
        position: 0.75,
        fontScale: 1.0,
      }, false);
    }
  }

  // ==========================================================================
  // VIEW SWITCHING
  // ==========================================================================
  function showView(viewId) {
    if (viewId === 'viewEditor') {
      viewUpload.classList.add('hidden');
      viewEditor.classList.remove('hidden');
      fitCanvas();
      renderTimeline();
      renderCaptionsList();
      const dragHint = $('captionDragHint');
      if (dragHint) dragHint.classList.toggle('hidden', !S.captions.length);
    } else {
      viewEditor.classList.add('hidden');
      viewUpload.classList.remove('hidden');
      vid.pause();
    }
  }

  btnNewVideo.addEventListener('click', () => {
    if (confirm('Start a new video project? Current unsaved edits will be cleared.')) {
      vid.pause();
      vid.src = '';
      S.file = null;
      S.filename = '';
      S.captions = [];
      uploadProgressBox.classList.add('hidden');
      uploadProgressBar.style.width = '0%';
      showView('viewUpload');
    }
  });

  // ==========================================================================
  // UPLOAD & TRANSCRIPTION
  // ==========================================================================
  function setupUploadHandlers() {
    btnSelectFile.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput.click();
    });

    dropZone.addEventListener('click', (e) => {
      // Allow clicking anywhere inside the drop card to open file chooser
      if (e.target !== fileInput && !e.target.closest('select') && !e.target.closest('details') && !e.target.closest('textarea')) {
        fileInput.click();
      }
    });

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) handleFileSelected(file);
    });

    ['dragenter', 'dragover'].forEach(evt => {
      dropZone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
      });
    });

    ['dragleave', 'drop'].forEach(evt => {
      dropZone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
      });
    });

    dropZone.addEventListener('drop', (e) => {
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) handleFileSelected(file);
    });

  }

  async function handleFileSelected(file) {
    S.file = file;
    headerFileName.textContent = file.name;

    // Instant local zero-latency video preview stream
    try {
      const blobUrl = URL.createObjectURL(file);
      vid.src = blobUrl;
      vid.load();
    } catch (e) {
      console.warn('Blob URL preview fallback:', e);
    }

    uploadError.classList.add('hidden');
    uploadProgressBox.classList.remove('hidden');
    uploadProgressBar.style.width = '5%';
    uploadPercent.textContent = '5%';
    uploadStatusText.textContent = 'Uploading video...';

    const formData = new FormData();
    formData.append('video', file);
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload', true);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 45);
        uploadProgressBar.style.width = pct + '%';
        uploadPercent.textContent = pct + '%';
      }
    };

    xhr.onload = async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          S.filename = res.filename;
          S.probe = {
            width: res.width || 1080,
            height: res.height || 1920,
            fps: res.fps || 30,
            duration: res.duration || 0
          };

          uploadProgressBar.style.width = '50%';
          uploadPercent.textContent = '50%';
          uploadStatusText.textContent = 'Listening with neural AI speech models...';

          await startTranscription();
        } catch (err) {
          showUploadError('Error processing video upload: ' + err.message);
        }
      } else {
        let msg = 'Upload failed (' + xhr.status + ')';
        try {
          const errRes = JSON.parse(xhr.responseText);
          if (errRes.error) msg = errRes.error;
        } catch (e) {}
        showUploadError(msg);
      }
    };

    xhr.onerror = () => showUploadError('Upload failed. Check your internet connection.');
    xhr.send(formData);
  }

  async function startTranscription() {
    const lang = langSelect.value;
    const pastedScript = scriptInput.value.trim();

    let transcribePct = 50;
    const progressInterval = setInterval(() => {
      if (transcribePct < 92) {
        transcribePct += 3;
        uploadProgressBar.style.width = transcribePct + '%';
        uploadPercent.textContent = transcribePct + '%';
      }
    }, 700);

    try {
      let endpoint = '/api/transcribe';
      uploadStatusText.textContent = 'Transcribing with Whisper speech recognition...';

      let payload = {
        filename: S.filename,
        language: lang,
        lang: lang,
        wordsPerCaption: 3,
        maxKeys: 1,
      };

      if (pastedScript.length > 0) {
        endpoint = '/api/sync_script';
        payload.script = pastedScript;
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      clearInterval(progressInterval);

      if (!res.ok) {
        let errMsg = 'Transcription note: ' + res.statusText;
        try {
          const errData = await res.json();
          if (errData.error) errMsg = errData.error;
        } catch (e) {}
        
        console.warn('Transcription notice:', errMsg);
        const dur = S.probe.duration || 5.0;
        const segDur = Math.min(dur, 3.0);
        S.captions = [{
          id: 'cap_1',
          start: 0.0,
          end: segDur,
          text: 'Add your captions here',
          words: [
            { word: 'Add', start: 0.0, end: round(segDur * 0.25, 2) },
            { word: 'your', start: round(segDur * 0.25, 2), end: round(segDur * 0.5, 2) },
            { word: 'captions', start: round(segDur * 0.5, 2), end: round(segDur * 0.75, 2) },
            { word: 'here', start: round(segDur * 0.75, 2), end: round(segDur, 2) }
          ]
        }];

        if (!vid.src || !vid.src.startsWith('blob:')) {
          vid.src = '/video/' + S.filename;
          vid.load();
        }
        setTimeout(() => showView('viewEditor'), 300);
        return;
      }

      const data = await res.json();
      uploadProgressBar.style.width = '100%';
      uploadPercent.textContent = '100%';
      uploadStatusText.textContent = 'Captions generated successfully!';

      S.captions = normalizeCaptions(data.captions || []);

      if (!vid.src || !vid.src.startsWith('blob:')) {
        vid.src = '/video/' + S.filename;
        vid.load();
      }

      setTimeout(() => {
        showView('viewEditor');
      }, 400);

    } catch (err) {
      clearInterval(progressInterval);
      showUploadError(err.message);
    }
  }

  function showUploadError(msg) {
    uploadError.textContent = msg;
    uploadError.classList.remove('hidden');
    uploadProgressBox.classList.add('hidden');
  }

  function normalizeCaptions(raw) {
    return raw.map((c, i) => {
      let words = c.words || [];
      if (!words.length && c.text) {
        const parts = c.text.split(/\s+/).filter(Boolean);
        const dur = (c.end - c.start) / Math.max(parts.length, 1);
        words = parts.map((w, idx) => ({
          word: w,
          start: c.start + idx * dur,
          end: c.start + (idx + 1) * dur
        }));
      }
      return {
        id: c.id || ('cap_' + (i + 1)),
        start: parseFloat(c.start) || 0,
        end: parseFloat(c.end) || 0,
        text: c.text || '',
        words: words.map(w => ({
          t: Array.isArray(w) ? w[2] : (w.word || w.t || ''),
          word: Array.isArray(w) ? w[2] : (w.word || w.t || ''),
          s: parseFloat(Array.isArray(w) ? w[0] : (w.start || w.s || 0)),
          start: parseFloat(Array.isArray(w) ? w[0] : (w.start || w.s || 0)),
          e: parseFloat(Array.isArray(w) ? w[1] : (w.end || w.e || 0)),
          end: parseFloat(Array.isArray(w) ? w[1] : (w.end || w.e || 0)),
          key: Boolean(w.key)
        }))
      };
    });
  }

  // ==========================================================================
  // VIDEO PLAYBACK & SCRUBBER
  // ==========================================================================
  function setupTransportHandlers() {
    btnPlayPause.addEventListener('click', togglePlay);
    vid.addEventListener('click', togglePlay);

    vid.addEventListener('play', () => {
      iconPlay.classList.add('hidden');
      iconPause.classList.remove('hidden');
      requestAnimationFrame(renderLoop);
    });

    vid.addEventListener('pause', () => {
      iconPlay.classList.remove('hidden');
      iconPause.classList.add('hidden');
      renderCanvas();
    });

    vid.addEventListener('timeupdate', () => {
      updateTransportUI();
      renderCanvas();
      syncTimelinePlayhead();
    });

    vid.addEventListener('loadedmetadata', () => {
      timeDuration.textContent = formatTime(vid.duration || 0);
      timeScrub.max = vid.duration || 100;
      if (vid.videoWidth && vid.videoHeight) {
        stage.style.aspectRatio = `${vid.videoWidth} / ${vid.videoHeight}`;
      }
      fitCanvas();
      renderTimeline();
      renderCanvas();
    });

    timeScrub.addEventListener('input', (e) => {
      vid.currentTime = parseFloat(e.target.value);
      renderCanvas();
      syncTimelinePlayhead();
    });

    btnMute.addEventListener('click', () => {
      vid.muted = !vid.muted;
      iconVolume.classList.toggle('hidden', vid.muted);
      iconMuted.classList.toggle('hidden', !vid.muted);
    });

    btnStageFullscreen.addEventListener('click', toggleFullscreen);
  }

  function togglePlay() {
    if (vid.paused || vid.ended) {
      vid.play();
    } else {
      vid.pause();
    }
  }

  function updateTransportUI() {
    const cur = vid.currentTime || 0;
    const dur = vid.duration || 0;
    timeCurrent.textContent = formatTime(cur);
    timeDuration.textContent = formatTime(dur);
    timeScrub.value = cur;
    tlTimeIndicator.textContent = formatTimeWithTenths(cur);
  }

  function formatTime(sec) {
    if (isNaN(sec) || sec < 0) sec = 0;
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function formatTimeWithTenths(sec) {
    if (isNaN(sec) || sec < 0) sec = 0;
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const t = Math.floor((sec % 1) * 10);
    return m + ':' + (s < 10 ? '0' : '') + s + '.' + t;
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      if (stage.requestFullscreen) stage.requestFullscreen();
      else if (stage.webkitRequestFullscreen) stage.webkitRequestFullscreen();
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
    }
  }

  // ==========================================================================
  // TIMELINE RENDERING & INTERACTION
  // ==========================================================================
  function setupTimelineHandlers() {
    timelineTrackWrap.addEventListener('click', (e) => {
      const rect = timelineTrackWrap.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const pct = Math.max(0, Math.min(1, clickX / rect.width));
      const dur = vid.duration || S.probe.duration || 10;
      vid.currentTime = pct * dur;
      renderCanvas();
      syncTimelinePlayhead();
    });
  }

  function renderTimeline() {
    timelineLane.innerHTML = '';
    timelineRuler.innerHTML = '';

    const dur = vid.duration || S.probe.duration || 10;
    if (dur <= 0) return;

    const step = dur > 60 ? 10 : (dur > 20 ? 5 : (dur > 10 ? 2 : 1));
    for (let t = 0; t <= dur; t += step) {
      const mark = document.createElement('span');
      mark.style.position = 'absolute';
      mark.style.left = (t / dur * 100) + '%';
      mark.style.fontSize = '9px';
      mark.style.color = '#64748b';
      mark.style.transform = 'translateX(-50%)';
      mark.textContent = t + 's';
      timelineRuler.appendChild(mark);
    }

    const curTime = vid.currentTime || 0;
    S.captions.forEach((cap, idx) => {
      const block = document.createElement('div');
      block.className = 'timeline-block' + (curTime >= cap.start && curTime <= cap.end ? ' active' : '');
      const leftPct = (cap.start / dur) * 100;
      const widthPct = Math.max(2, ((cap.end - cap.start) / dur) * 100);
      block.style.left = leftPct + '%';
      block.style.width = widthPct + '%';
      block.textContent = cap.text || `Line ${idx + 1}`;
      block.setAttribute('data-id', cap.id);

      block.addEventListener('click', (e) => {
        e.stopPropagation();
        vid.currentTime = cap.start + 0.05;
        vid.play();
      });

      timelineLane.appendChild(block);
    });

    syncTimelinePlayhead();
  }

  function syncTimelinePlayhead() {
    const dur = vid.duration || S.probe.duration || 10;
    if (dur <= 0) return;
    const cur = vid.currentTime || 0;
    const pct = Math.max(0, Math.min(100, (cur / dur) * 100));
    timelinePlayhead.style.left = pct + '%';

    $$('.timeline-block').forEach((blk) => {
      const capId = blk.getAttribute('data-id');
      const cap = S.captions.find(c => c.id === capId);
      if (cap) {
        const isActive = cur >= cap.start && cur <= cap.end;
        blk.classList.toggle('active', isActive);
      }
    });
  }

  // ==========================================================================
  // DRAWER & LOWEST NAV BAR
  // ==========================================================================
  function setupDrawerAndNavHandlers() {
    $$('.bottom-nav-btn[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-tab');
        openDrawerTab(targetId);
      });
    });

    btnToggleTimeline.addEventListener('click', () => {
      toggleTimelineView();
    });

    btnDrawerClose.addEventListener('click', () => {
      closeDrawer();
    });

    btnDrawerExpand.addEventListener('click', () => {
      toggleDrawerFullscreen();
    });

    btnGenerateTemplate.addEventListener('click', () => {
      triggerGenerateActiveTemplate();
    });

    $$('#categoryPills .cat-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        $$('#categoryPills .cat-pill').forEach(p => p.classList.toggle('active', p === pill));
        renderPresetsTab(pill.getAttribute('data-cat'));
      });
    });
  }

  function openDrawerTab(targetId) {
    S.activeTab = targetId;
    S.drawerOpen = true;
    drawerPanel.classList.remove('collapsed');

    $$('.bottom-nav-btn').forEach(btn => {
      const tabAttr = btn.getAttribute('data-tab');
      btn.classList.toggle('active', tabAttr === targetId);
    });

    $$('.tab-pane').forEach(p => p.classList.toggle('hidden', p.id !== targetId));

    const titles = {
      tabTemplates: '🎨 Choose Template (164 Available)',
      tabCaptions: '📝 Edit Captions',
      tabStyle: '🎚️ Style Options',
      tabAudio: '🎵 Audio & Music'
    };
    drawerTitle.textContent = titles[targetId] || 'Editor Options';

    if (targetId === 'tabCaptions') {
      renderCaptionsList();
    }
  }

  function closeDrawer() {
    S.drawerOpen = false;
    drawerPanel.classList.add('collapsed');
    $$('.bottom-nav-btn').forEach(b => b.classList.remove('active'));
    btnToggleTimeline.classList.add('active');
  }

  function toggleTimelineView() {
    if (S.drawerOpen) {
      closeDrawer();
      showToast('⏱️ Timeline view active');
    } else {
      openDrawerTab(S.activeTab || 'tabTemplates');
    }
  }

  function toggleDrawerFullscreen() {
    S.drawerFullscreen = !S.drawerFullscreen;
    drawerPanel.classList.toggle('fullscreen', S.drawerFullscreen);
    iconExpand.classList.toggle('hidden', S.drawerFullscreen);
    iconCollapse.classList.toggle('hidden', !S.drawerFullscreen);
  }

  function triggerGenerateActiveTemplate() {
    const pName = S.style?.name || 'Selected Template';
    btnGenerateTemplate.classList.add('generating');
    btnGenerateTemplate.innerHTML = `<span>⚡ Generating with ${pName}...</span>`;

    setTimeout(() => {
      btnGenerateTemplate.classList.remove('generating');
      btnGenerateTemplate.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
        <span>Generate with <strong id="selectedPresetName">${pName}</strong></span>
      `;
      showToast(`✨ Generated with ${pName}!`);
      renderCanvas();
      renderTimeline();
      vid.play();
    }, 280);
  }

  function showToast(msg) {
    toastNotification.textContent = msg;
    toastNotification.classList.remove('hidden');
    clearTimeout(toastNotification._timer);
    toastNotification._timer = setTimeout(() => {
      toastNotification.classList.add('hidden');
    }, 2400);
  }

  // ==========================================================================
  // TAB 1: PRESETS / TEMPLATES (Visual Distinction on every card)
  // ==========================================================================
  function renderPresetsTab(filterCat) {
    presetsGrid.innerHTML = '';
    const filtered = filterCat === 'all' 
      ? S.presets 
      : S.presets.filter(p => {
          const cat = (p.category || '').toLowerCase();
          const name = (p.name || '').toLowerCase();
          const id = (p.id || '').toLowerCase();
          if (filterCat === 'duo') return cat === 'duo' || name.startsWith('Duo ·') || Boolean(p.isDuo);
          if (filterCat === 'viral') return cat.includes('viral') || name.includes('viral') || name.includes('pop') || id.includes('hype');
          if (filterCat === 'neon') return cat.includes('neon') || name.includes('neon') || name.includes('ice') || name.includes('electric') || name.includes('glow');
          if (filterCat === 'box') return name.includes('box') || cat.includes('box') || Boolean(p.pill);
          if (filterCat === 'real-estate') return cat.includes('real-estate') || id.includes('estate');
          if (filterCat === 'colourful') return cat.includes('colourful') || cat.includes('color') || name.includes('fire') || name.includes('sunset') || name.includes('aurora');
          if (filterCat === 'minimal') return cat.includes('minimal') || cat.includes('classic') || name.includes('clean') || name.includes('sub');
          if (filterCat === 'special') return cat.includes('special') || id.includes('special') || Boolean(p.isSpecial);
          return true;
        });

    filtered.forEach(preset => {
      const card = createPresetCard(preset, false);
      presetsGrid.appendChild(card);
    });
  }

  function createPresetCard(preset, isModal) {
    const card = document.createElement('div');
    card.className = 'preset-card' + (S.style && S.style.id === preset.id ? ' active' : '');
    const kRole = preset.key || {};
    const color = preset.highlightColor || kRole.color || '#FFE600';
    const tag = preset.badge || (preset.category || 'POP').toUpperCase();

    // Unique preview text per preset
    let previewWord = preset.previewWord || '';
    if (!previewWord) {
      previewWord = (preset.name || 'VIRAL')
        .replace(/[^\w\s]/gi, '')
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .join(' ');
    }
    if (!previewWord) previewWord = 'VIRAL POP';

    const font = kRole.font || 'Poppins';
    const isItalic = kRole.italic ? 'italic' : 'normal';
    const weight = kRole.bold !== false ? '800' : '600';
    const textTransform = kRole.upper !== false ? 'uppercase' : 'none';
    const bgPill = preset.pill ? `background:${preset.pill}; padding:3px 8px; border-radius:4px;` : '';
    const textGrad = kRole.keyGradient ? `background:${kRole.keyGradient}; -webkit-background-clip:text; -webkit-text-fill-color:transparent;` : `color:${color};`;
    const glow = kRole.glow ? `text-shadow: 0 0 10px ${kRole.glow}88;` : '';

    let generateBtnHtml = '';
    if (isModal) {
      generateBtnHtml = `<button class="btn-card-generate">⚡ Generate</button>`;
    }

    card.innerHTML = `
      <span class="preset-badge-tag" style="background:${color}22; color:${color};">${tag}</span>
      <div class="preset-sample-text" style="font-family:'${font}', sans-serif; font-style:${isItalic}; font-weight:${weight}; text-transform:${textTransform}; ${textGrad} ${glow} ${bgPill}">
        ${previewWord}
      </div>
      <span class="preset-name">${preset.name || 'Template'}</span>
      ${generateBtnHtml}
    `;

    if (isModal) {
      const genBtn = card.querySelector('.btn-card-generate');
      genBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        applyPreset(preset, true);
        modalTemplates.classList.add('hidden');
      });
    }

    card.addEventListener('click', () => {
      applyPreset(preset, false);
      $$('.preset-card').forEach(c => c.classList.toggle('active', c === card));
      if (isModal) {
        modalTemplates.classList.add('hidden');
      }
    });

    return card;
  }

  function applyPreset(preset, showGenToast = false) {
    S.style = Object.assign({}, preset, {
      fontScale: S.style?.fontScale || 1.0,
      position: S.style?.position !== undefined ? S.style.position : (preset.position || 0.75),
      highlightColor: preset.highlightColor || preset.key?.color || '#FFE600',
      fontFamily: preset.key?.font || 'Poppins',
      textCase: S.style?.textCase || 'upper'
    });

    if (selectedPresetName) {
      selectedPresetName.textContent = preset.name || 'Template';
    }

    if (selectFont && preset.key?.font) {
      selectFont.value = preset.key.font;
    }

    renderCanvas();
    renderTimeline();

    if (showGenToast) {
      showToast(`✨ Generated with ${preset.name}!`);
      vid.play();
    }
  }

  // ==========================================================================
  // TAB 2: CAPTIONS LIST
  // ==========================================================================
  function renderCaptionsList() {
    captionsList.innerHTML = '';
    captionCountBadge.textContent = S.captions.length + ' lines';

    if (!S.captions.length) {
      captionsList.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding:20px; font-size:13px;">No captions found. Tap "Add Line" to create one.</div>';
      return;
    }

    const curTime = vid.currentTime || 0;

    S.captions.forEach((cap, idx) => {
      const row = document.createElement('div');
      const isCur = curTime >= cap.start && curTime <= cap.end;
      row.className = 'caption-row' + (isCur ? ' active' : '');

      row.innerHTML = `
        <button class="caption-play-btn" title="Jump to timestamp">▶</button>
        <div class="caption-center">
          <span class="caption-time-pill">${formatTime(cap.start)} - ${formatTime(cap.end)}</span>
          <textarea class="caption-text-input" rows="1">${cap.text}</textarea>
        </div>
        <button class="caption-delete-btn" title="Delete caption">&times;</button>
      `;

      row.querySelector('.caption-play-btn').addEventListener('click', () => {
        vid.currentTime = cap.start + 0.05;
        vid.play();
      });

      const textarea = row.querySelector('.caption-text-input');
      textarea.addEventListener('input', (e) => {
        cap.text = e.target.value;
        const words = cap.text.split(/\s+/).filter(Boolean);
        const dur = (cap.end - cap.start) / Math.max(words.length, 1);
        cap.words = words.map((w, wIdx) => ({
          t: w,
          word: w,
          s: cap.start + wIdx * dur,
          start: cap.start + wIdx * dur,
          e: cap.start + (wIdx + 1) * dur,
          end: cap.start + (wIdx + 1) * dur,
          key: false
        }));
        renderCanvas();
        renderTimeline();
      });

      row.querySelector('.caption-delete-btn').addEventListener('click', () => {
        S.captions.splice(idx, 1);
        renderCaptionsList();
        renderTimeline();
        renderCanvas();
      });

      captionsList.appendChild(row);
    });
  }

  btnAddCaption.addEventListener('click', () => {
    const cur = vid.currentTime || 0;
    const newCap = {
      id: 'cap_' + (S.captions.length + 1),
      start: cur,
      end: cur + 2.0,
      text: 'New caption text',
      words: [
        { t: 'New', word: 'New', s: cur, start: cur, e: cur + 0.6, end: cur + 0.6, key: false },
        { t: 'caption', word: 'caption', s: cur + 0.6, start: cur + 0.6, e: cur + 1.3, end: cur + 1.3, key: false },
        { t: 'text', word: 'text', s: cur + 1.3, start: cur + 1.3, e: cur + 2.0, end: cur + 2.0, key: true }
      ]
    };
    S.captions.push(newCap);
    S.captions.sort((a, b) => a.start - b.start);
    renderCaptionsList();
    renderTimeline();
    renderCanvas();
  });

  // ==========================================================================
  // TAB 3: STYLE CONTROLS
  // ==========================================================================
  function setupStyleHandlers() {
    inputFontSize.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      valFontSize.textContent = val + '%';
      if (!S.style) S.style = {};
      S.style.fontScale = val / 100;
      renderCanvas();
    });

    $$('#posButtonGroup .btn-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('#posButtonGroup .btn-toggle').forEach(b => b.classList.toggle('active', b === btn));
        if (!S.style) S.style = {};
        S.style.position = parseFloat(btn.getAttribute('data-pos'));
        renderCanvas();
      });
    });

    $$('#colorSwatches .swatch').forEach(swatch => {
      swatch.addEventListener('click', () => {
        $$('#colorSwatches .swatch').forEach(s => s.classList.toggle('active', s === swatch));
        const color = swatch.getAttribute('data-color');
        if (!S.style) S.style = {};
        S.style.highlightColor = color;
        if (!S.style.key) S.style.key = {};
        S.style.key.color = color;
        renderCanvas();
      });
    });

    selectFont.addEventListener('change', (e) => {
      if (!S.style) S.style = {};
      S.style.fontFamily = e.target.value;
      if (!S.style.key) S.style.key = {};
      S.style.key.font = e.target.value;
      renderCanvas();
    });

    $$('#caseButtonGroup .btn-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('#caseButtonGroup .btn-toggle').forEach(b => b.classList.toggle('active', b === btn));
        if (!S.style) S.style = {};
        S.style.textCase = btn.getAttribute('data-case');
        renderCanvas();
      });
    });
  }

  // ==========================================================================
  // TAB 4: AUDIO CONTROLS
  // ==========================================================================
  function setupAudioHandlers() {
    inputVidVol.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      valVidVol.textContent = val + '%';
      S.vidVolume = val / 100;
      vid.volume = Math.min(1.0, S.vidVolume);
    });

    btnAddBgm.addEventListener('click', () => bgmFileInput.click());

    bgmFileInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      bgmFilename.textContent = 'Uploading ' + file.name + '...';
      const fd = new FormData();
      fd.append('file', file);

      try {
        const res = await fetch('/api/upload_audio', { method: 'POST', body: fd });
        const data = await res.json();
        S.bgmFilename = data.filename || file.name;
        bgmFilename.textContent = file.name;
        showToast('🎵 Audio added!');
      } catch (err) {
        bgmFilename.textContent = 'Upload failed: ' + err.message;
      }
    });

    inputBgmVol.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      valBgmVol.textContent = val + '%';
      S.bgmVolume = val / 100;
    });
  }

  // ==========================================================================
  // CANVAS SIZING & RENDERING LOOP
  // ==========================================================================
  function setupCanvasSizing() {
    window.addEventListener('resize', fitCanvas);
    document.addEventListener('fullscreenchange', fitCanvas);
  }

  function setupCaptionDragging() {
    const hint = $('captionDragHint');
    let drag = null;
    stage.addEventListener('pointerdown', (event) => {
      if (!S.captions.length || !S.style || event.target.closest('button')) return;
      drag = { id: event.pointerId, startY: event.clientY, lastY: event.clientY, moved: false };
    });

    stage.addEventListener('pointermove', (event) => {
      if (!drag || drag.id !== event.pointerId) return;
      const rect = stage.getBoundingClientRect();
      if (!rect.height) return;
      if (!drag.moved && Math.abs(event.clientY - drag.startY) < 4) return;
      if (!drag.moved) {
        try { stage.setPointerCapture(event.pointerId); } catch (e) {}
      }
      drag.moved = true;
      event.preventDefault();
      stage.classList.add('is-caption-dragging');
      if (hint) hint.textContent = '↕ Moving captions · release to place';
      const delta = (event.clientY - drag.lastY) / rect.height;
      drag.lastY = event.clientY;
      const originalPosition = Number(S.style.position);
      const basePosition = Number.isFinite(originalPosition) ? originalPosition : 0.72;
      const moveKey = (key, fallback) => {
        const current = Number(S.style[key]);
        S.style[key] = Math.max(0.08, Math.min(0.92, (Number.isFinite(current) ? current : fallback) + delta));
      };
      moveKey('position', basePosition);
      if (S.style.depthAccent || S.style.isSpecial) {
        const depthFallback = S.style.depthAccent ? 0.41 : (basePosition || 0.42);
        moveKey('depthAccentY', Number(S.style.depthAccentY) || depthFallback);
        moveKey('subtitlePosition', S.style.subtitlePosition || 0.76);
      }
      renderCanvas();
    });

    const finish = (event) => {
      if (!drag || drag.id !== event.pointerId) return;
      const moved = drag.moved;
      drag = null;
      stage.classList.remove('is-caption-dragging');
      if (hint) hint.textContent = '✋ Touch or click and drag captions to move · Voice-synced preview';
      if (moved) renderCanvas();
    };
    stage.addEventListener('pointerup', finish);
    stage.addEventListener('pointercancel', finish);
    stage.addEventListener('lostpointercapture', finish);
  }

  function fitCanvas() {
    const rect = stage.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    if (rect.width > 0 && rect.height > 0) {
      captionCanvas.width = Math.round(rect.width * dpr);
      captionCanvas.height = Math.round(rect.height * dpr);
      renderCanvas();
    }
  }

  function renderLoop() {
    if (!vid.paused && !vid.ended) {
      renderCanvas();
      syncTimelinePlayhead();
      requestAnimationFrame(renderLoop);
    }
  }

  function renderCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const w = captionCanvas.width / dpr;
    const h = captionCanvas.height / dpr;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, captionCanvas.width, captionCanvas.height);
    ctx.scale(dpr, dpr);

    if (!S.captions.length) return;

    const t = vid.currentTime || 0;
    const activeCap = S.captions.find(c => t >= c.start && t <= c.end);
    if (!activeCap) return;

    const words = (activeCap.words || []).map(w => ({
      t: w.t || w.word || '',
      s: typeof w.s === 'number' ? w.s : (typeof w.start === 'number' ? w.start : 0),
      e: typeof w.e === 'number' ? w.e : (typeof w.end === 'number' ? w.end : 0),
      key: Boolean(w.key)
    }));

    const isBehind = Boolean(S.style && S.style.behindPerson);
    drawCanvasTypography(ctx, null, activeCap, words, t, S.style || {}, w, h, isBehind, false);
  }

  // ==========================================================================
  // MODALS HANDLERS (FULL TEMPLATES, SCRIPT SYNC, EXPORT)
  // ==========================================================================
  function setupModalHandlers() {
    btnOpenFullTemplates.addEventListener('click', () => {
      modalTemplates.classList.remove('hidden');
      renderFullTemplatesGrid('');
    });

    btnCloseTemplatesModal.addEventListener('click', () => {
      modalTemplates.classList.add('hidden');
    });

    templateSearchInput.addEventListener('input', (e) => {
      renderFullTemplatesGrid(e.target.value.toLowerCase().trim());
    });

    btnSyncScriptModal.addEventListener('click', () => {
      modalScript.classList.remove('hidden');
    });

    btnCloseScriptModal.addEventListener('click', () => {
      modalScript.classList.add('hidden');
    });

    btnCancelScript.addEventListener('click', () => {
      modalScript.classList.add('hidden');
    });

    btnApplyScript.addEventListener('click', async () => {
      const text = modalScriptText.value.trim();
      if (!text) return;

      btnApplyScript.disabled = true;
      btnApplyScript.textContent = 'Syncing...';

      try {
        const res = await fetch('/api/sync_script', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: S.filename, script: text, lang: langSelect.value })
        });
        const data = await res.json();
        if (data.captions) {
          S.captions = normalizeCaptions(data.captions);
          renderCaptionsList();
          renderTimeline();
          renderCanvas();
        }
        modalScript.classList.add('hidden');
        showToast('✍️ Script synced with audio!');
      } catch (e) {
        alert('Script sync error: ' + e.message);
      } finally {
        btnApplyScript.disabled = false;
        btnApplyScript.textContent = 'Apply & Sync Script';
      }
    });

    btnExport.addEventListener('click', startExport);

    btnCloseExportModal.addEventListener('click', () => {
      modalExport.classList.add('hidden');
      if (S.exportTimer) clearInterval(S.exportTimer);
    });

    btnRetryExport.addEventListener('click', startExport);
  }

  function renderFullTemplatesGrid(query) {
    fullTemplatesGrid.innerHTML = '';
    const filtered = S.presets.filter(p => {
      if (!query) return true;
      return (p.name || '').toLowerCase().includes(query) ||
             (p.category || '').toLowerCase().includes(query) ||
             (p.badge || '').toLowerCase().includes(query);
    });

    filtered.forEach(preset => {
      const card = createPresetCard(preset, true);
      fullTemplatesGrid.appendChild(card);
    });
  }

  // ==========================================================================
  // VIDEO EXPORT
  // ==========================================================================
  async function startExport() {
    vid.pause();
    modalExport.classList.remove('hidden');
    exportWorkingState.classList.remove('hidden');
    exportDoneState.classList.add('hidden');
    exportErrorState.classList.add('hidden');

    exportProgressBar.style.width = '3%';
    exportPercent.textContent = '3%';
    exportProgressText.textContent = 'Initiating video render...';
    exportProgressDetail.textContent = 'Applying selected style preset and burning captions.';

    try {
      const payload = {
        filename: S.filename,
        captions: S.captions,
        style: S.style,
        preset_id: S.style?.id || 'yellow_box',
        quality: 'balanced',
        aspect: 'original',
        speed: 1.0
      };

      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Server rejected export request');
      }

      const data = await res.json();
      S.exportJobId = data.job;

      pollExportStatus(S.exportJobId);

    } catch (err) {
      showExportError(err.message);
    }
  }

  function pollExportStatus(jobId) {
    if (S.exportTimer) clearInterval(S.exportTimer);

    S.exportTimer = setInterval(async () => {
      try {
        const res = await fetch('/api/jobs/' + jobId);
        if (!res.ok) return;

        const data = await res.json();
        const pct = Math.max(5, Math.min(100, Math.round(data.progress || 0)));

        exportProgressBar.style.width = pct + '%';
        exportPercent.textContent = pct + '%';
        if (data.message) {
          exportProgressText.textContent = data.message;
        }

        if (data.status === 'done' || data.download) {
          clearInterval(S.exportTimer);
          showExportComplete(data.download);
        } else if (data.status === 'error') {
          clearInterval(S.exportTimer);
          showExportError(data.message || 'Render failed on server.');
        }
      } catch (e) {
        console.warn('Status poll warning:', e);
      }
    }, 800);
  }

  function showExportComplete(filename) {
    exportWorkingState.classList.add('hidden');
    exportDoneState.classList.remove('hidden');

    const downloadUrl = '/download/' + filename;
    btnDownloadExport.href = downloadUrl;
    btnDownloadExport.download = 'captioned_' + filename;

    exportPreviewVideo.src = '/video/' + filename;
    exportPreviewVideo.load();
  }

  function showExportError(msg) {
    exportWorkingState.classList.add('hidden');
    exportErrorState.classList.remove('hidden');
    exportErrorMessage.textContent = msg;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
