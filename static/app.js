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
  const cleanCaptionText = (value) => String(value ?? '').replace(/\*/g, '');

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
    voiceoverFilename: '',
    voiceoverVoice: 'special_voice',
    vidVolume: 1.0,
    exportJobId: null,
    exportTimer: null,
    exportPayload: null,
    exportRecovered: false,
    generateAfterPicker: false,
  };

  // --- DOM Elements ---
  const viewUpload = $('viewUpload');
  const viewEditor = $('viewEditor');

  // Upload elements
  const dropZone = $('dropZone');
  const fileInput = $('fileInput');
  const btnSelectFile = $('btnSelectFile');
  const btnGenerateCaptions = $('btnGenerateCaptions');
  const selectedMediaName = $('selectedMediaName');
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
  const btnCleanCaptions = $('btnCleanCaptions');

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
  const voiceoverText = $('voiceoverText');
  const voiceoverVoice = $('voiceoverVoice');
  const btnGenerateVoiceover = $('btnGenerateVoiceover');
  const btnReplaceVoiceover = $('btnReplaceVoiceover');
  const voiceoverStatus = $('voiceoverStatus');
  const voiceoverAudio = $('voiceoverAudio');

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
  if (showAll || !w) return { visible: true, scale: 1.0, dx: 0, dy: 0, opacity: 1.0 };

  if (typeof w.s === 'number') {
    const dt = t - w.s;

    // Word not yet reached in speech: hidden, keep layout position
    if (dt < 0) {
      return { visible: false, scale: 1.0, dx: 0, dy: 0, opacity: 0.0 };
    }

    const dur = 0.20;
    if (dt < dur) {
      const p = Math.max(0, Math.min(1, dt / dur));
      const ease = 1 - Math.pow(1 - p, 3);
      let dx = 0, dy = 0, scale = 1.0;
      const enterAnim = anim || 'pop';
      if (enterAnim === 'slide-up') {
        dy = 24 * (1 - ease);
      } else if (enterAnim === 'slide-down') {
        dy = -24 * (1 - ease);
      } else if (enterAnim === 'slide-left') {
        dx = 24 * (1 - ease);
      } else if (enterAnim === 'slide-right') {
        dx = -24 * (1 - ease);
      } else if (enterAnim === 'pop' || enterAnim === 'bounce') {
        scale = 0.88 + 0.12 * ease;
      }
      return { visible: true, scale, dx, dy, opacity: ease };
    }

    // Word already spoken: stays fully visible and stable at exactly (0,0)
    return { visible: true, scale: 1.0, dx: 0, dy: 0, opacity: 1.0 };
  }

  return { visible: true, scale: 1.0, dx: 0, dy: 0, opacity: 1.0 };
}

function drawDualNeonPass(ctxFore, ctxBehind, words, t, st, W, H, base, isBehind, showAll) {
  const kRole = st.key || {}, fRole = st.filler || {};
  const kSize = Math.max(24, Math.round(base * (kRole.size || 0.165)));
  const fSize = Math.max(18, Math.round(base * (fRole.size || 0.115)));
  const leading = st.leading || 0.88;
  const cY = H * (st.position || 0.38);

  // Preserve exact chronological reading order (never scramble words by key)
  let line1 = [], line2 = [];
  if (words.length <= 3) {
    line1 = words;
    line2 = [];
  } else {
    const mid = Math.ceil(words.length / 2);
    line1 = words.slice(0, mid);
    line2 = words.slice(mid);
  }

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

  // Preserve exact chronological reading order
  let keyWords = [], subWords = [];
  if (words.length <= 2) {
    keyWords = words.slice(0, 1);
    subWords = words.slice(1);
  } else {
    const mid = Math.ceil(words.length / 2);
    keyWords = words.slice(0, mid);
    subWords = words.slice(mid);
  }

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

  // 1. Line splitting: 1-3 words stay on 1 single punchy line; 4+ words split cleanly in half
  let lines = [];
  if (words.length <= 3) {
    lines = [words];
  } else {
    const mid = Math.ceil(words.length / 2);
    lines = [words.slice(0, mid), words.slice(mid)];
  }

  // 2. Preserve each preset's authentic designer font and typography
  const presetFont = st.fontFamily || st.font || (kRole && kRole.font) || (fRole && fRole.font) || 'Montserrat';
  const fontFam = `"${presetFont}", "Poppins", sans-serif`;
  let fs = Math.max(18, Math.round(base * (st.fontSize || fRole.size || kRole.size || 0.082)));
  const leading = 1.18;

  // 3. Preserve each preset's authentic colors, highlights & gradients
  let smallColor = fRole.color || st.color || '#FFFFFF';
  let bigColor = (st.highlight && st.highlight.color) || kRole.color || st.highlightColor || '#FFE600';
  let glowColor = kRole.glow || st.glow || bigColor;

  // 4. Measure words per line & calculate safe auto-fit scale
  ctx.save();
  ctx.font = `800 ${fs}px ${fontFam}`;
  let maxLineWidth = 0;
  const measuredLines = lines.map(lineWords => {
    let lineWidth = 0;
    const wordObjs = lineWords.map((w, idx) => {
      const isKey = Boolean(w.key);
      const isUpper = isKey ? (kRole.upper !== false) : (fRole.upper !== false);
      const txt = isUpper ? w.t.toUpperCase() : w.t;
      ctx.font = `${isKey ? 900 : 800} ${fs}px ${fontFam}`;
      const width = ctx.measureText(txt).width;
      const spaceWidth = (idx < lineWords.length - 1) ? ctx.measureText(' ').width : 0;
      lineWidth += width + spaceWidth;
      return { w, txt, isKey, width, spaceWidth };
    });
    if (lineWidth > maxLineWidth) maxLineWidth = lineWidth;
    return { wordObjs, lineWidth };
  });
  ctx.restore();

  // If text width exceeds 84% safe screen width, scale font size down proportionally
  const fitScale = Math.min(1.0, (W * 0.84) / Math.max(1, maxLineWidth));
  if (fitScale < 1.0) {
    fs = Math.max(14, Math.floor(fs * fitScale));
  }

  // Vertical placement
  const lineH = fs * leading;
  const totalH = lines.length * lineH;
  const startY = cY - (totalH / 2) + (lineH / 2);

  // Background pill backing if requested by preset
  if (st.pill) {
    const boxW = Math.min(W * 0.92, maxLineWidth * fitScale + fs * 1.6);
    const boxH = totalH + fs * 0.8;
    ctx.save();
    ctx.fillStyle = st.pill;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(W / 2 - boxW / 2, cY - boxH / 2, boxW, boxH, 12) : ctx.rect(W / 2 - boxW / 2, cY - boxH / 2, boxW, boxH);
    ctx.fill();
    ctx.restore();
  }

  // 5. Render words line by line with left-to-right fade-in animation
  measuredLines.forEach((mLine, lineIdx) => {
    const lineY = startY + lineIdx * lineH;

    // Recalculate word measurements with final font size
    ctx.save();
    ctx.font = `800 ${fs}px ${fontFam}`;
    const scaledSpaceWidth = Math.max(fs * 0.28, ctx.measureText(' ').width);
    let actualLineWidth = 0;
    mLine.wordObjs.forEach((wo, idx) => {
      ctx.font = `${wo.isKey ? 900 : 800} ${fs}px ${fontFam}`;
      wo.width = ctx.measureText(wo.txt).width;
      wo.spaceWidth = (idx < mLine.wordObjs.length - 1) ? scaledSpaceWidth : 0;
      actualLineWidth += wo.width + wo.spaceWidth;
    });
    ctx.restore();

    let curX = (W - actualLineWidth) / 2;
    if (st.align === 'left') curX = W * 0.09;
    else if (st.align === 'right') curX = W * 0.91 - actualLineWidth;

    mLine.wordObjs.forEach(wo => {
      const anim = getWordPop(wo.w, t, showAll, st.animation);

      // Only draw if word has started fading in or showAll
      if (anim.visible && anim.opacity > 0.01) {
        ctx.save();
        const wordCenterX = curX + wo.width / 2;
        ctx.translate(wordCenterX + (anim.dx || 0), lineY + (anim.dy || 0));
        ctx.scale(anim.scale || 1, anim.scale || 1);
        ctx.globalAlpha = Math.max(0, Math.min(1, anim.opacity));
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const isBoxMode = wo.isKey && st.highlight && st.highlight.mode === 'box';
        ctx.font = `${wo.isKey ? (kRole.italic ? 'italic ' : '') + '900' : (fRole.italic ? 'italic ' : '') + '800'} ${fs}px ${fontFam}`;

        if (isBoxMode) {
          const padX = Math.max(6, Math.round(fs * 0.22));
          const boxW = wo.width + padX * 2;
          const boxH = fs * 1.20;
          ctx.save();
          ctx.fillStyle = st.highlight.color || '#FFE600';
          ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.roundRect ? ctx.roundRect(-boxW / 2, -boxH / 2, boxW, boxH, 6) : ctx.rect(-boxW / 2, -boxH / 2, boxW, boxH);
          ctx.fill();
          ctx.restore();

          ctx.fillStyle = st.highlight.textColor || '#111111';
          ctx.fillText(wo.txt, 0, 0);
        } else {
          // Glow / Shadow
          ctx.shadowColor = wo.isKey ? (kRole.shadowColor || 'rgba(0, 0, 0, 0.90)') : (fRole.shadowColor || 'rgba(0, 0, 0, 0.90)');
          ctx.shadowBlur = Math.round(base * 0.02) + (wo.isKey ? 8 : 5);

          // Outline stroke
          ctx.strokeStyle = wo.isKey ? (kRole.outlineColor || '#000000') : (fRole.outlineColor || '#000000');
          ctx.lineWidth = Math.max(2, Math.round(fs * (wo.isKey ? 0.17 : 0.14)));
          ctx.strokeText(wo.txt, 0, 0);

          // Fill text
          ctx.fillStyle = wo.isKey ? canvasRolePaint(ctx, kRole, bigColor, base) : canvasRolePaint(ctx, fRole, smallColor, base);
          ctx.fillText(wo.txt, 0, 0);
        }

        ctx.restore();
      }

      // Advance X by this word's exact measured width plus a natural space
      curX += wo.width + wo.spaceWidth;
    });
  });
}

function drawEstateDepthPass(ctxFore, ctxBehind, words, t, st, W, H, base, showAll, capId) {
  if (!words || !words.length) return;
  if (st.estateVariant) {
    const subtitleRole = st.filler || {};
    const heroRole = st.key || {};
    const items = words.map((word, i) => {
      const isHero = i === words.length - 1;
      const role = isHero ? heroRole : subtitleRole;
      const raw = isHero ? (st.roles?.accent || {}) : (st.roles?.base || {});
      const label = role.upper ? word.t.toUpperCase() : role.lower ? word.t.toLowerCase() : word.t;
      const size = Math.max(12, Math.round(base * (role.size || 0.07)));
      return {word, role, raw, isHero, label, size, anim: getWordPop(word, t, showAll, raw.enter || st.animation)};
    });
    const measure = (item) => {
      const ctx = ctxFore;
      ctx.font = (item.role.italic ? 'italic ' : '') + `${item.role.bold ? 800 : 500} ${item.size}px "${item.role.font || 'Montserrat'}",sans-serif`;
      if ('letterSpacing' in ctx) ctx.letterSpacing = `${(item.role.track || 0) * item.size}px`;
      item.width = ctx.measureText(item.label).width;
    };
    items.forEach(measure);
    const gapFor = (a, b) => Math.max(2, Math.min(a.size, b.size) * (st.wordGap || 0.12));
    const lineWidth = () => items.reduce((sum, item) => sum + item.width, 0) + items.slice(0, -1).reduce((sum, item, i) => sum + gapFor(item, items[i + 1]), 0);
    const fit = Math.min(1, W * 0.92 / Math.max(1, lineWidth()));
    if (fit < 1) {
      items.forEach((item) => { item.size = Math.max(12, Math.floor(item.size * fit)); measure(item); });
    }
    const total = lineWidth();
    let x = -total / 2;
    const y = H * (st.depthAccentY || st.position || 0.63);
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const target = item.isHero && ctxBehind ? ctxBehind : ctxFore;
      if (item.anim?.opacity > 0) {
        target.save();
        target.translate(W / 2 + x + (item.anim?.dx || 0), y + (item.anim?.dy || 0));
        target.scale(item.anim?.scale || 1, item.anim?.scale || 1);
        target.globalAlpha *= item.anim?.opacity ?? 1;
        target.font = (item.role.italic ? 'italic ' : '') + `${item.role.bold ? 800 : 500} ${item.size}px "${item.role.font || 'Montserrat'}",sans-serif`;
        if ('letterSpacing' in target) target.letterSpacing = `${(item.role.track || 0) * item.size}px`;
        target.textAlign = 'left'; target.textBaseline = 'middle';
        target.shadowColor = 'rgba(0,0,0,.22)'; target.shadowBlur = Math.max(1, Math.round(base * 0.005));
        target.fillStyle = canvasRolePaint(target, item.role, item.role.color || '#FFFFFF', base);
        target.fillText(item.label, 0, 0);
        target.restore();
      }
      x += item.width + (i < items.length - 1 ? gapFor(item, items[i + 1]) : 0);
    }
    return;
  }
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

  function drawLine(items, y, maxWidth, fallbackRole, offsetX = 0) {
    if (!items.length) return;
    const measured = [];
    ctx.save();
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
    }
    const gaps = measured.slice(0, -1).map((item, i) => {
      const next = measured[i + 1];
      const smaller = item.size <= next.size ? item : next;
      ctx.save();
      ctx.font = smaller.font;
      if ('letterSpacing' in ctx) ctx.letterSpacing = `${(smaller.role.track || 0) * smaller.size}px`;
      const gap = Math.max(smaller.size * 0.28, smaller.size * (st.wordGap || 0.28));
      ctx.restore();
      return gap;
    });
    const total = measured.reduce((sum, item) => sum + item.width, 0) + gaps.reduce((sum, gap) => sum + gap, 0);
    const fit = Math.min(1, maxWidth / Math.max(1, total));
    if (fit < 1) {
      for (const item of measured) {
        item.size = Math.max(12, Math.floor(item.size * fit));
        item.font = (item.role.italic ? 'italic ' : '') + `${item.role.bold ? 800 : 500} ${item.size}px "${item.role.font || 'Montserrat'}",sans-serif`;
        ctx.font = item.font;
        if ('letterSpacing' in ctx) ctx.letterSpacing = `${(item.role.track || 0) * item.size}px`;
        item.width = ctx.measureText(item.label).width;
      }
      for (let i = 0; i < gaps.length; i++) {
        const smaller = measured[i].size <= measured[i + 1].size ? measured[i] : measured[i + 1];
        gaps[i] = Math.max(2, smaller.size * (st.wordGap || 0.08));
      }
    }
    const fittedTotal = measured.reduce((sum, item) => sum + item.width, 0) + gaps.reduce((sum, gap) => sum + gap, 0);
    ctx.translate(W / 2 + offsetX, y);
    let x = -fittedTotal / 2;
    for (let i = 0; i < measured.length; i++) {
      const item = measured[i];
      const role = item.role;
      ctx.save();
      const slideScale = Math.max(0.25, Math.min(1, W * 0.025 / 24));
      ctx.translate(x + (item.anim?.dx || 0) * slideScale, item.anim?.dy || 0);
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
      if (i < gaps.length) x += item.width + gaps[i];
    }
    ctx.restore();
  }

  // Keep the full caption line laid out, then reveal each word at its own time.
  // Measuring the whole line prevents large text size changes from creating gaps.
  if (st.estateVariant && words.length) {
    const items = words.map((word, index) => {
      const isFinal = index === words.length - 1;
      const role = isFinal ? (st.key || {}) : subtitleRole;
      const enter = isFinal ? st.roles?.accent?.enter : st.roles?.base?.enter;
      return {word, role, anim: getWordPop(word, t, showAll, enter || st.animation)};
    });
    drawLine(items, heroY, W * 0.92, subtitleRole);
    return;
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

function getLayoutStackFn() {
  if (typeof window !== 'undefined' && typeof window.layoutStack === 'function') {
    return window.layoutStack;
  }
  return function(lines, {W = 1080, H = 1920, posX = .5, posY = .5, inkGap = .03, maxWidth = .9} = {}) {
    const cv = document.createElement('canvas').getContext('2d');
    const fontStr = (l, size) => `${l.italic ? 'italic ' : ''}${l.weight} ${size}px "${l.font}"`;
    const measureInk = (l, size = l.size) => {
      cv.font = fontStr(l, size); const t = l.text, m = cv.measureText(t), n = Math.max(0, t.length - 1);
      return {width: m.width + (l.track || 0) * size * n, asc: m.actualBoundingBoxAscent, desc: m.actualBoundingBoxDescent, fA: m.fontBoundingBoxAscent, fD: m.fontBoundingBoxDescent};
    };
    const out = lines.map((l) => { const e = measureInk(l), s = e.width ? Math.min(1, maxWidth * W / e.width) : 1; return {...l, size: l.size * s, scale: s, width: e.width * s, asc: e.asc * s, desc: e.desc * s, fA: e.fA * s, fD: e.fD * s}; });
    const gaps = out.slice(1).map((o, i) => Math.max(-.2, inkGap) * Math.max(out[i].size, o.size));
    const total = out.reduce((a, o) => a + o.asc + o.desc, 0) + gaps.reduce((a, g) => a + g, 0); let y = posY * H - total / 2;
    out.forEach((o, i) => { if (i) y += gaps[i - 1]; o.inkTop = y; o.baseline = y + o.asc; o.inkBottom = o.baseline + o.desc; y = o.inkBottom; o.x = posX * W; o.gapAbove = i ? gaps[i - 1] : 0; });
    return out;
  };
}

function drawInkStackPass(ctxFore, ctxBehind, cap, words, t, st, W, H, isBehind, showAll) {
  if (!words || !words.length) return;
  const roles = st.roles || {};
  const baseRole = roles.base || st.filler || {};
  const capId = (cap && (cap.index != null ? cap.index : cap.id)) || 1;
  const alt = (st.accent2 || roles.accent2) && (Math.max(0, Number(capId) - 1) % 2 === 1);
  const accentRole = (alt && (roles.accent2 || st.accent2)) || roles.accent || st.key || {};
  const uppercase = Boolean(st.uppercase != null ? st.uppercase : accentRole.upper);
  const inkGap = typeof st.inkGap === 'number' ? st.inkGap : 0.03;
  const posX = typeof st.posX === 'number' ? st.posX : 0.5;
  let posY = typeof st.posY === 'number' ? st.posY : 0.5;
  if (Array.isArray(st.posCycle) && st.posCycle.length > 0) {
    const idx = Math.max(0, Number(capId) - 1) % st.posCycle.length;
    posY = st.posCycle[idx];
  }

  const isBehindPreset = Boolean(
    isBehind ||
    st.behindPerson ||
    st.depthAccent ||
    (accentRole && accentRole.layer === 'behind') ||
    (st.name && st.name.toLowerCase().includes('(behind)'))
  );

  const up = (txt) => uppercase ? txt.toUpperCase() : txt;
  const scale = Math.min(W / 1080, H / 1920) * (Number(st.fontScale) || 1);
  const getRolePx = (r, defaultPx) => {
    const s = Number(r.size) || defaultPx;
    return s > 1 ? s * scale : s * H;
  };

  const layoutFn = getLayoutStackFn();
  let lay;

  if (isBehindPreset) {
    const heroY = typeof st.depthAccentY === 'number' ? (st.depthAccentY >= 0.24 ? 0.18 : st.depthAccentY) : 0.18;
    const accentPx = getRolePx(accentRole, 230);
    const basePx = getRolePx(baseRole, 60);
    const fontSpan = (accentPx + basePx) * 0.5 / H + 0.008;
    const defaultTop = Math.max(0.02, Number((heroY - fontSpan).toFixed(3)));
    const topY = (typeof st.topY === 'number' && st.topY <= 0.15) ? st.topY : defaultTop;
    const subY = typeof st.subtitlePosition === 'number' ? st.subtitlePosition : 0.72;

    let topWords = [];
    let heroWords = [];
    let bottomWords = [];

    // Strict chronological order: Line 1 (Top) plays FIRST, Line 2 (Hero Middle) plays SECOND, Line 3 (Bottom) plays THIRD
    if (words.length >= 3) {
      if (words.length === 3) {
        topWords = [words[0]];
        heroWords = [words[1]];
        bottomWords = [words[2]];
      } else {
        const mid = Math.floor(words.length / 2);
        let keyIdx = words.findIndex((w, i) => w.key && i > 0 && i < words.length - 1);
        if (keyIdx === -1) keyIdx = mid;
        topWords = words.slice(0, keyIdx);
        heroWords = [words[keyIdx]];
        bottomWords = words.slice(keyIdx + 1);
      }
    } else if (words.length === 2) {
      topWords = [words[0]];
      heroWords = [words[1]];
      bottomWords = [];
    } else {
      topWords = [];
      heroWords = words;
      bottomWords = [];
    }

    lay = [];
    if (topWords.length > 0) {
      const topDesc = {
        text: topWords.map(w => up(w.t)).join(' '),
        font: baseRole.font || 'Poppins',
        size: Math.max(14, getRolePx(baseRole, 56)),
        weight: baseRole.weight || (baseRole.bold ? 700 : 500),
        italic: Boolean(baseRole.italic),
        track: Number(baseRole.track) || 0,
        isHero: false,
        lineType: 'top',
        role: baseRole,
        words: topWords
      };
      lay = lay.concat(layoutFn([topDesc], { W, H, posX, posY: topY, inkGap, maxWidth: 0.90 }));
    }

    if (heroWords.length > 0) {
      const heroDesc = {
        text: heroWords.map(w => up(w.t)).join(' '),
        font: accentRole.font || 'Montserrat',
        size: Math.max(22, getRolePx(accentRole, 230)),
        weight: accentRole.weight || (accentRole.bold ? 900 : 800),
        italic: Boolean(accentRole.italic),
        track: Number(accentRole.track) || 0,
        isHero: true,
        lineType: 'hero',
        role: accentRole,
        words: heroWords
      };
      lay = lay.concat(layoutFn([heroDesc], { W, H, posX, posY: heroY, inkGap, maxWidth: 0.90 }));
    }

    if (bottomWords.length > 0) {
      const bottomDesc = {
        text: bottomWords.map(w => up(w.t)).join(' '),
        font: baseRole.font || 'Poppins',
        size: Math.max(14, getRolePx(baseRole, 58)),
        weight: baseRole.weight || (baseRole.bold ? 700 : 500),
        italic: Boolean(baseRole.italic),
        track: Number(baseRole.track) || 0,
        isHero: false,
        lineType: 'bottom',
        role: baseRole,
        words: bottomWords
      };
      lay = lay.concat(layoutFn([bottomDesc], { W, H, posX, posY: subY, inkGap, maxWidth: 0.90 }));
    }
  } else {
    let smallWords = [];
    let bigWords = [];
    if (words.length <= 1) {
      bigWords = words;
    } else {
      smallWords = words.slice(0, -1);
      bigWords = [words[words.length - 1]];
    }

    const smallText = smallWords.map(w => up(w.t)).join(' ');
    const bigText = bigWords.map(w => up(w.t)).join(' ');

    const lineDescriptors = [];
    if (smallWords.length > 0) {
      lineDescriptors.push({
        text: smallText,
        font: baseRole.font || 'Poppins',
        size: Math.max(14, getRolePx(baseRole, 62)),
        weight: baseRole.weight || (baseRole.bold ? 700 : 500),
        italic: Boolean(baseRole.italic),
        track: Number(baseRole.track) || 0,
        isHero: false,
        role: baseRole,
        words: smallWords
      });
    }
    if (bigWords.length > 0) {
      lineDescriptors.push({
        text: bigText,
        font: accentRole.font || 'Montserrat',
        size: Math.max(18, getRolePx(accentRole, 190)),
        weight: accentRole.weight || (accentRole.bold ? 900 : 800),
        italic: Boolean(accentRole.italic),
        track: Number(accentRole.track) || 0,
        isHero: true,
        role: accentRole,
        words: bigWords
      });
    }
    lay = layoutFn(lineDescriptors, { W, H, posX, posY, inkGap, maxWidth: 0.90 });
  }

  lay.forEach((o) => {
    const isBehindPerson = o.isHero && (o.role.layer === 'behind' || st.behindPerson || st.depthAccent || isBehindPreset);
    const targetCtx = (isBehindPerson && ctxBehind) ? ctxBehind : ctxFore;
    if (!targetCtx) return;

    targetCtx.save();
    const fontStr = `${o.italic ? 'italic ' : ''}${o.weight} ${o.size}px "${o.font}", sans-serif`;
    targetCtx.font = fontStr;
    if ('letterSpacing' in targetCtx) targetCtx.letterSpacing = `${(o.track || 0) * o.size}px`;

    // Space between words must be at least 0.16 * font size; never negative margin
    const minSpace = 0.16 * o.size;
    const spaceWidth = Math.max(minSpace, targetCtx.measureText(' ').width);
    const wordObjs = o.words.map((w) => {
      const txt = up(w.t);
      const wWidth = targetCtx.measureText(txt).width;
      return { w, txt, width: wWidth };
    });

    const totalLineWidth = wordObjs.reduce((sum, wo) => sum + wo.width, 0) + Math.max(0, wordObjs.length - 1) * spaceWidth;
    let curX = o.x - totalLineWidth / 2;

    wordObjs.forEach((wo) => {
      const anim = getWordPop(wo.w, t, showAll, o.role.enter || st.animation);

      // Keep word place in line - if not yet arrived, opacity is 0 (do not shift/re-layout)
      if (anim.opacity > 0) {
        targetCtx.save();
        // Slide / enter animation ends at exactly translate(0, 0).
        // Role dx/dy is NOT applied to lines of stack layout.
        targetCtx.translate(curX + (anim.dx || 0), o.baseline + (anim.dy || 0));
        targetCtx.scale(anim.scale || 1, anim.scale || 1);
        targetCtx.globalAlpha *= (typeof anim.opacity === 'number' ? anim.opacity : 1.0);
        targetCtx.textBaseline = 'alphabetic';
        targetCtx.textAlign = 'left';

        // Outlines & shadows
        if (o.role.outline > 0) {
          targetCtx.lineJoin = 'round';
          targetCtx.lineWidth = Math.max(1, o.role.outline * (o.size / 70));
          targetCtx.strokeStyle = o.role.outlineColor || '#000000';
          targetCtx.strokeText(wo.txt, 0, 0);
        }
        if (o.role.shadow > 0) {
          targetCtx.shadowColor = o.role.shadowColor || 'rgba(0,0,0,0.6)';
          targetCtx.shadowBlur = Math.max(1, o.role.shadow * (o.size / 70));
          targetCtx.shadowOffsetY = Math.max(1, o.role.shadow * (o.size / 70) * 0.5);
        }

        // Fill paint
        if (!o.role.keyGradient && o.role.fill) {
          const fillColors = (o.role.fill.colors && o.role.fill.colors.length > 1)
            ? o.role.fill.colors
            : (o.role.fill.type === 'holo' ? ['#FF5EDF', '#FFE45E', '#5EFFB1', '#5EC8FF', '#B65EFF'] : null);
          if (fillColors) {
            o.role.keyGradient = `linear-gradient(${o.role.fill.angle || 90}deg, ${fillColors.join(',')})`;
          }
        }
        const basePaintColor = o.isHero ? (o.role.color || st.highlightColor || '#FF6200') : (o.role.color || '#FFFFFF');
        targetCtx.fillStyle = canvasRolePaint(targetCtx, o.role, basePaintColor, o.size);
        targetCtx.fillText(wo.txt, 0, 0);
        targetCtx.restore();
      }

      curX += wo.width + spaceWidth;
    });

    targetCtx.restore();
  });
}

function drawCanvasTypography(ctxFore, ctxBehind, cap, words, t, st, W, H, isBehind, showAll) {
  if (!ctxFore) return;
  const base = Math.min(W, H) * Math.max(0.6, Math.min(1.5, Number(st.fontScale) || 1));
  const presetId = st.id || '';
  const offsetX = (Number(st.offsetX) || 0) * W;
  ctxFore.save(); ctxFore.translate(offsetX, 0);
  if (ctxBehind && ctxBehind !== ctxFore) { ctxBehind.save(); ctxBehind.translate(offsetX, 0); }
  if (isBehind || (st.layout === 'stack' || st.isDuo) && (st.mode === 'emphasis' || st.category === 'duo' || !st.mode)) {
    drawInkStackPass(ctxFore, ctxBehind, cap, words, t, st, W, H, isBehind, showAll);
  } else if (st.isSpecial && st.depthAccent) {
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
  function renderDuoFrontPresets() {
    const grid = $('duoPresetGrid');
    if (!grid) return;
    const duo = S.presets.filter(p => p.isDuo);
    grid.replaceChildren();
    const count = $('duoPresetCount');
    const selectedName = $('duoSelectedName');
    if (count) count.textContent = `${duo.length} STYLES`;
    if (!duo.length) {
      grid.innerHTML = '<p class="duo-empty">Duo styles could not load. Refresh the page to try again.</p>';
      return;
    }
    duo.forEach((preset) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'duo-front-card';
      card.setAttribute('aria-pressed', String(S.style?.id === preset.id));
      card.setAttribute('aria-label', `Choose ${preset.name}`);
      const art = document.createElement('span');
      art.className = 'duo-card-art';
      const isBehind = Boolean(
        preset.depthAccent ||
        preset.behindPerson ||
        (preset.roles && preset.roles.accent && preset.roles.accent.layer === 'behind') ||
        (preset.name && preset.name.toLowerCase().includes('(behind)'))
      );
      const tag = document.createElement('span');
      tag.className = 'duo-card-tag';
      tag.textContent = isBehind ? 'BEHIND SUBJECT (HAIR/HEAD)' : 'FRONT CAPTION';
      const small = document.createElement('span');
      small.className = 'duo-card-small';
      small.textContent = 'SOME MOMENTS';
      const big = document.createElement('strong');
      big.className = 'duo-card-big';
      big.textContent = preset.previewWord || preset.name.replace(/^Duo\s*[·-]\s*/i, '').toUpperCase();
      const paint = preset.key?.keyGradient || preset.key?.color || preset.highlightColor || '#8B5CF6';
      big.style.color = preset.key?.color || preset.highlightColor || '#8B5CF6';
      if (paint.startsWith('linear-gradient(')) {
        big.style.backgroundImage = paint;
        big.style.webkitBackgroundClip = 'text';
        big.style.backgroundClip = 'text';
        big.style.color = 'transparent';
      }
      big.style.fontFamily = `'${preset.key?.font || 'Montserrat'}', sans-serif`;
      if (isBehind) {
        art.append(tag, big, small);
      } else {
        art.append(tag, small, big);
      }
      const label = document.createElement('span');
      label.className = 'duo-card-name';
      label.textContent = preset.name.replace(/^Duo\s*[·-]\s*/i, '');
      card.append(art, label);
      card.addEventListener('click', () => {
        applyPreset(preset, false);
        if (selectedName) selectedName.textContent = label.textContent;
      });
      grid.append(card);
    });
    if (selectedName) {
      const selected = duo.find(p => p.id === S.style?.id) || duo[0];
      selectedName.textContent = selected.name.replace(/^Duo\s*[·-]\s*/i, '');
    }
  }

  async function loadPresets() {
    try {
      const res = await fetch('/api/presets');
      const data = await res.json();
      S.presets = data.presets || [];

      // Merge locally saved custom presets. Server supplied Duo presets are authoritative.
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

      S.presets.sort((a, b) => Number(Boolean(b.isDuo)) - Number(Boolean(a.isDuo)));
      renderDuoFrontPresets();
      if (S.presets.length > 0) {
        const initial = S.presets.find(p => p.isDuo) || S.presets[0];
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
      renderDuoFrontPresets();
    }
  }

  // ==========================================================================
  // VIEW SWITCHING
  // ==========================================================================
  function showView(viewId) {
    if (viewId === 'viewEditor') {
      viewUpload.classList.add('hidden');
      viewEditor.classList.remove('hidden');
      const eb = $('editorBody') || $('.editor-body');
      if (eb && S.drawerOpen) eb.classList.add('drawer-open');
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
      S.voiceoverFilename = '';
      btnReplaceVoiceover.classList.remove('active');
      btnReplaceVoiceover.textContent = 'Replace original audio';
      btnReplaceVoiceover.disabled = true;
      voiceoverAudio.removeAttribute('src');
      voiceoverAudio.classList.add('hidden');
      voiceoverStatus.textContent = 'Generated audio stays private to this video project.';
      S.captions = [];
      fileInput.value = '';
      selectedMediaName.textContent = '';
      selectedMediaName.classList.add('hidden');
      btnGenerateCaptions.disabled = false;
      btnGenerateCaptions.innerHTML = '<span>Generate captions</span><span aria-hidden="true">→</span>';
      uploadError.classList.add('hidden');
      dropZone.classList.remove('is-uploading');
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
      if (dropZone.classList.contains('is-uploading')) return;
      S.generateAfterPicker = false;
      fileInput.click();
    });

    btnGenerateCaptions.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!S.file) {
        S.generateAfterPicker = true;
        fileInput.click();
        return;
      }
      processSelectedFile(S.file);
    });

    dropZone.addEventListener('click', (e) => {
      // Allow clicking anywhere inside the drop card to open file chooser
      if (!dropZone.classList.contains('is-uploading') && e.target !== fileInput && !e.target.closest('select') && !e.target.closest('details') && !e.target.closest('textarea')) {
        fileInput.click();
      }
    });

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      fileInput.value = '';
      if (file) {
        stageSelectedFile(file);
        S.generateAfterPicker = false;
        processSelectedFile(file);
      }
    });
    fileInput.addEventListener('cancel', () => { S.generateAfterPicker = false; });

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
      if (dropZone.classList.contains('is-uploading')) return;
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) {
        stageSelectedFile(file);
        processSelectedFile(file);
      }
    });

  }

  function stageSelectedFile(file) {
    S.file = file;
    headerFileName.textContent = file.name;
    selectedMediaName.textContent = 'Ready: ' + file.name;
    selectedMediaName.classList.remove('hidden');
    uploadError.classList.add('hidden');
    dropZone.classList.remove('is-uploading');

    // Instant local zero-latency video preview stream
    try {
      const blobUrl = URL.createObjectURL(file);
      vid.src = blobUrl;
      vid.load();
    } catch (e) {
      console.warn('Blob URL preview fallback:', e);
    }

    uploadError.classList.add('hidden');
    uploadProgressBox.classList.add('hidden');
    btnGenerateCaptions.disabled = false;
    btnGenerateCaptions.innerHTML = '<span>Generate captions</span><span aria-hidden="true">→</span>';
  }

  async function processSelectedFile(file) {
    if (!file || btnGenerateCaptions.disabled) return;
    S.file = file;
    btnGenerateCaptions.disabled = true;
    btnGenerateCaptions.innerHTML = '<span>Generating captions…</span><span class="generate-spinner" aria-hidden="true"></span>';
    dropZone.classList.add('is-uploading');
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
        wordsPerCaption: Number(S.style?.wordsPerCaption) || 3,
        maxKeys: Number(S.style?.maxKeys) || 1,
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
        try {
          if (voiceoverText && !voiceoverText.value.trim() && S.captions && S.captions.length > 0) {
            voiceoverText.value = S.captions.map(c => c.text).join(' ');
          }
        } catch (e) {}
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
    dropZone.classList.remove('is-uploading');
    btnGenerateCaptions.disabled = false;
    btnGenerateCaptions.innerHTML = '<span>Try generating again</span><span aria-hidden="true">↻</span>';
  }

  function normalizeCaptions(raw) {
    const list = raw.map((c, i) => {
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
      const normalizedWords = words.map(w => {
        const rawWord = Array.isArray(w) ? w[2] : (w.word || w.t || '');
        const text = cleanCaptionText(rawWord);
        const markedKey = String(rawWord ?? '').includes('*');
        return {
          t: text,
          word: text,
          s: parseFloat(Array.isArray(w) ? w[0] : (w.start || w.s || 0)),
          start: parseFloat(Array.isArray(w) ? w[0] : (w.start || w.s || 0)),
          e: parseFloat(Array.isArray(w) ? w[1] : (w.end || w.e || 0)),
          end: parseFloat(Array.isArray(w) ? w[1] : (w.end || w.e || 0)),
          key: Boolean(w.key || markedKey)
        };
      }).filter(w => w.t);

      // Close micro word gaps
      for (let j = 0; j < normalizedWords.length - 1; j++) {
        const wGap = normalizedWords[j + 1].s - normalizedWords[j].e;
        if (wGap > 0 && wGap <= 0.35) {
          normalizedWords[j].e = normalizedWords[j + 1].s;
          normalizedWords[j].end = normalizedWords[j + 1].s;
        }
      }

      return {
        id: c.id || ('cap_' + (i + 1)),
        start: parseFloat(c.start) || 0,
        end: parseFloat(c.end) || 0,
        text: cleanCaptionText(c.text || normalizedWords.map(w => w.t).join(' ')),
        words: normalizedWords
      };
    });

    // Close inter-caption gaps (eliminate flickering between sentences)
    for (let i = 0; i < list.length - 1; i++) {
      const interGap = list[i + 1].start - list[i].end;
      if (interGap > 0 && interGap <= 0.85) {
        list[i].end = list[i + 1].start;
        if (list[i].words && list[i].words.length) {
          const lastW = list[i].words[list[i].words.length - 1];
          lastW.e = list[i + 1].start;
          lastW.end = list[i + 1].start;
        }
      }
    }

    return list;
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

    setupDrawerDragHandler();
  }

  function setupDrawerDragHandler() {
    const handle = $('drawerDragHandle');
    const editorBody = $('editorBody') || $('.editor-body');
    if (!handle || !editorBody) return;

    let isDragging = false;
    let startY = 0;
    let startHeight = 0;

    handle.addEventListener('pointerdown', (e) => {
      if (e.button && e.button !== 0) return;
      isDragging = true;
      startY = e.clientY;
      startHeight = drawerPanel.getBoundingClientRect().height;
      try { handle.setPointerCapture(e.pointerId); } catch (_) {}
      handle.classList.add('dragging');
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });

    handle.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      const deltaY = startY - e.clientY;
      const editorHeight = editorBody.getBoundingClientRect().height;
      const minDrawerHeight = 160;
      const maxDrawerHeight = Math.max(minDrawerHeight, editorHeight - 190);
      const newHeight = Math.max(minDrawerHeight, Math.min(maxDrawerHeight, startHeight + deltaY));
      editorBody.style.setProperty('--drawer-height', `${Math.round(newHeight)}px`);
      fitCanvas();
    });

    const stopDragging = (e) => {
      if (!isDragging) return;
      isDragging = false;
      handle.classList.remove('dragging');
      document.body.style.userSelect = '';
      try { handle.releasePointerCapture(e.pointerId); } catch (_) {}
      fitCanvas();
    };

    handle.addEventListener('pointerup', stopDragging);
    handle.addEventListener('pointercancel', stopDragging);

    // Double-click to toggle compact (30%) vs comfortable (46%)
    handle.addEventListener('dblclick', () => {
      const editorHeight = editorBody.getBoundingClientRect().height;
      const currentHeight = drawerPanel.getBoundingClientRect().height;
      const compactH = Math.round(editorHeight * 0.30);
      const standardH = Math.round(editorHeight * 0.46);
      const targetH = (currentHeight > compactH + 30) ? compactH : standardH;
      editorBody.style.setProperty('--drawer-height', `${targetH}px`);
      fitCanvas();
    });
  }

  function openDrawerTab(targetId) {
    S.activeTab = targetId;
    S.drawerOpen = true;
    drawerPanel.classList.remove('collapsed');
    const eb = $('editorBody') || $('.editor-body');
    if (eb) eb.classList.add('drawer-open');

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
    requestAnimationFrame(fitCanvas);
  }

  function closeDrawer() {
    S.drawerOpen = false;
    drawerPanel.classList.add('collapsed');
    const eb = $('editorBody') || $('.editor-body');
    if (eb) eb.classList.remove('drawer-open');
    $$('.bottom-nav-btn').forEach(b => b.classList.remove('active'));
    btnToggleTimeline.classList.add('active');
    requestAnimationFrame(fitCanvas);
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
    requestAnimationFrame(fitCanvas);
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
      if (genBtn) {
        genBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          applyPreset(preset, true);
          modalTemplates.classList.add('hidden');
        });
      }
      card.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        applyPreset(preset, false);
        modalTemplates.classList.add('hidden');
      });
    }

    card.addEventListener('click', () => {
      const wasActive = card.classList.contains('active');
      applyPreset(preset, false);
      $$('.preset-card').forEach(c => c.classList.toggle('active', c === card));
      if (isModal) {
        if (wasActive) {
          modalTemplates.classList.add('hidden');
        } else {
          showToast(`✨ ${preset.name} active · Previewing on video`);
        }
      }
    });

    return card;
  }

  function syncBehindSliders() {
    const isBehind = Boolean(
      S.style && (
        S.style.behindPerson ||
        S.style.depthAccent ||
        (S.style.roles && S.style.roles.accent && S.style.roles.accent.layer === 'behind') ||
        (S.style.name && S.style.name.toLowerCase().includes('(behind)'))
      )
    );
    const card = $('cardBehindLayers');
    if (card) card.classList.toggle('hidden', !isBehind);
    if (!isBehind) return;

    const inputTopY = $('inputTopY');
    const inputHeroY = $('inputHeroY');
    const inputBottomY = $('inputBottomY');
    const valTopYBadge = $('valTopYBadge');
    const valHeroYBadge = $('valHeroYBadge');
    const valBottomYBadge = $('valBottomYBadge');

    const topPct = Math.round((Number(S.style?.topY) || 0.10) * 100);
    const heroPct = Math.round((Number(S.style?.depthAccentY) || 0.18) * 100);
    const botPct = Math.round((Number(S.style?.subtitlePosition) || 0.72) * 100);

    if (inputTopY) inputTopY.value = topPct;
    if (valTopYBadge) valTopYBadge.textContent = topPct + '%';
    if (inputHeroY) inputHeroY.value = heroPct;
    if (valHeroYBadge) valHeroYBadge.textContent = heroPct + '%';
    if (inputBottomY) inputBottomY.value = botPct;
    if (valBottomYBadge) valBottomYBadge.textContent = botPct + '%';
  }

  function applyPreset(preset, showGenToast = false) {
    const isBehind = Boolean(
      preset.behindPerson ||
      preset.depthAccent ||
      (preset.roles && preset.roles.accent && preset.roles.accent.layer === 'behind') ||
      (preset.name && preset.name.toLowerCase().includes('(behind)'))
    );
    const clonedRoles = preset.roles ? JSON.parse(JSON.stringify(preset.roles)) : undefined;
    S.style = Object.assign({}, preset, {
      roles: clonedRoles || preset.roles,
      fontScale: 1.0,
      position: isBehind ? 0.18 : (Number.isFinite(Number(preset.position)) ? Number(preset.position) : 0.75),
      topY: isBehind ? (Number.isFinite(Number(preset.topY)) ? Number(preset.topY) : 0.10) : 0.10,
      depthAccentY: isBehind ? (Number.isFinite(Number(preset.depthAccentY)) ? Number(preset.depthAccentY) : 0.18) : 0.18,
      subtitlePosition: isBehind ? (Number.isFinite(Number(preset.subtitlePosition)) ? Number(preset.subtitlePosition) : 0.72) : 0.72,
      behindPerson: isBehind,
      depthAccent: isBehind,
      highlightColor: preset.highlightColor || preset.roles?.accent?.color || preset.key?.color || '#FFE600',
      fontFamily: preset.roles?.accent?.font || preset.key?.font || 'Poppins',
      textCase: S.style?.textCase || 'upper'
    });
    if (isBehind && Array.isArray(S.style.posCycle)) {
      delete S.style.posCycle;
    }
    syncBehindSliders();

    if (selectedPresetName) {
      selectedPresetName.textContent = preset.name || 'Template';
    }
    const frontSelectedName = $('duoSelectedName');
    if (frontSelectedName && preset.isDuo) frontSelectedName.textContent = preset.name.replace(/^Duo\s*[·-]\s*/i, '');
    $$('.duo-front-card').forEach(card => {
      card.setAttribute('aria-pressed', String(card.getAttribute('aria-label') === `Choose ${preset.name}`));
    });

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

      row.innerHTML = `<button class="caption-play-btn" title="Jump to timestamp">▶</button><div class="caption-center"><span class="caption-time-pill">${formatTime(cap.start)} - ${formatTime(cap.end)}</span></div><button class="caption-delete-btn" title="Delete caption">&times;</button>`;
      const captionCenter = row.querySelector('.caption-center');
      const captionInput = document.createElement('textarea');
      captionInput.className = 'caption-text-input';
      captionInput.rows = 1;
      captionInput.value = cleanCaptionText(cap.text);
      captionCenter.appendChild(captionInput);

      row.querySelector('.caption-play-btn').addEventListener('click', () => {
        vid.currentTime = cap.start + 0.05;
        vid.play();
      });

      const textarea = captionInput;
      textarea.addEventListener('input', (e) => {
        const cleanValue = cleanCaptionText(e.target.value);
        if (cleanValue !== e.target.value) {
          const caret = Math.max(0, e.target.selectionStart - (e.target.value.length - cleanValue.length));
          e.target.value = cleanValue;
          e.target.setSelectionRange(caret, caret);
        }
        cap.text = cleanValue;
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
        if (S.style.isDuo || S.style.isSpecial) {
          S.style.depthAccentY = Math.max(0.20, Math.min(0.82, S.style.position));
          S.style.subtitlePosition = Math.max(0.20, Math.min(0.90, S.style.position + 0.07));
        }
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
        if (!S.style.roles) S.style.roles = {};
        if (!S.style.roles.accent) S.style.roles.accent = {};
        S.style.roles.accent.color = color;
        delete S.style.roles.accent.keyGradient;
        delete S.style.roles.accent.textGradient;
        delete S.style.roles.accent.fill;
        if (S.style.roles.accent2) {
          S.style.roles.accent2.color = color;
          delete S.style.roles.accent2.keyGradient;
          delete S.style.roles.accent2.textGradient;
          delete S.style.roles.accent2.fill;
        }
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

    const inputTopY = $('inputTopY');
    const inputHeroY = $('inputHeroY');
    const inputBottomY = $('inputBottomY');
    const valTopYBadge = $('valTopYBadge');
    const valHeroYBadge = $('valHeroYBadge');
    const valBottomYBadge = $('valBottomYBadge');

    if (inputTopY) {
      inputTopY.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        if (valTopYBadge) valTopYBadge.textContent = val + '%';
        if (!S.style) S.style = {};
        S.style.topY = val / 100;
        renderCanvas();
      });
    }

    if (inputHeroY) {
      inputHeroY.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        if (valHeroYBadge) valHeroYBadge.textContent = val + '%';
        if (!S.style) S.style = {};
        S.style.depthAccentY = val / 100;
        S.style.position = S.style.depthAccentY;
        renderCanvas();
      });
    }

    if (inputBottomY) {
      inputBottomY.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        if (valBottomYBadge) valBottomYBadge.textContent = val + '%';
        if (!S.style) S.style = {};
        S.style.subtitlePosition = val / 100;
        renderCanvas();
      });
    }
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
        fd.append('audio', file);
        const res = await fetch('/api/upload-audio', { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Audio upload failed');
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

    voiceoverVoice.addEventListener('change', () => { S.voiceoverVoice = voiceoverVoice.value; });
    let lastVoiceoverData = null;

    async function generateVoiceoverAction() {
      // 1. Auto-prefill text from script or captions, or use viral creator default
      let text = (voiceoverText && voiceoverText.value.trim()) || '';
      if (!text && S.captions && S.captions.length > 0) {
        text = S.captions.map(c => c.text).join(' ');
      }
      if (!text) {
        text = 'नमस्ते दोस्तों! आज मैं आपको बताने वाला हूँ एक ऐसा सीक्रेट जो आपकी ज़िंदगी बदल देगा।';
      }
      if (voiceoverText) voiceoverText.value = text;

      btnGenerateVoiceover.disabled = true;
      btnGenerateVoiceover.textContent = '⏳ Generating Voiceover...';
      voiceoverStatus.textContent = 'Synthesizing neural Hindi voice & applying to video...';

      try {
        const res = await fetch('/api/voiceover', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            voice: voiceoverVoice ? voiceoverVoice.value : 'special_voice',
            filename: S.filename,
            video_filename: S.filename
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Voiceover could not be generated');

        lastVoiceoverData = data;
        S.voiceoverFilename = data.filename;

        // Auto-update captions to match the new voice
        if (data.captions && data.captions.length > 0) {
          S.captions = normalizeCaptions(data.captions);
          renderCaptionsList();
          renderTimeline();
        }

        // Reload video player with the new voiceover!
        if (S.filename) {
          vid.src = '/video/' + encodeURIComponent(S.filename) + '?t=' + Date.now();
          vid.load();
        }

        voiceoverAudio.src = '/video/' + encodeURIComponent(data.filename);
        voiceoverAudio.classList.remove('hidden');

        btnReplaceVoiceover.classList.add('active');
        btnReplaceVoiceover.textContent = '✓ Voiceover Active';
        btnReplaceVoiceover.disabled = false;

        voiceoverStatus.textContent = '🎉 Voiceover generated & applied to your video!';
        showToast('🎉 Voiceover generated & applied to your video!');

        // Start playback so user immediately hears the new voice!
        setTimeout(() => {
          if (S.filename) {
            vid.currentTime = 0;
            vid.play().catch(() => {});
          } else {
            voiceoverAudio.currentTime = 0;
            voiceoverAudio.play().catch(() => {});
          }
        }, 300);

        return data;
      } catch (err) {
        voiceoverStatus.textContent = 'Error: ' + err.message;
        showToast('Voiceover error: ' + err.message);
        throw err;
      } finally {
        btnGenerateVoiceover.disabled = false;
        btnGenerateVoiceover.textContent = '🔊 Generate Voiceover';
      }
    }

    btnGenerateVoiceover.addEventListener('click', () => {
      generateVoiceoverAction().catch(() => {});
    });

    btnReplaceVoiceover.addEventListener('click', () => {
      if (!S.voiceoverFilename) return;
      btnReplaceVoiceover.classList.add('active');
      btnReplaceVoiceover.textContent = '✓ Applied to Video';
      
      // If synchronized captions were generated, update the caption track instantly
      if (lastVoiceoverData && lastVoiceoverData.captions && lastVoiceoverData.captions.length > 0) {
        S.captions = normalizeCaptions(lastVoiceoverData.captions);
        renderCaptionsList();
        renderTimeline();
        showToast('Applied new voiceover & synchronized captions!');
      } else {
        showToast('Applied new voiceover to video!');
      }

      // Synchronize video player with voiceover audio
      vid.muted = true;
      voiceoverAudio.currentTime = vid.currentTime;
      if (!vid.paused) {
        voiceoverAudio.play().catch(() => {});
      }
      voiceoverStatus.textContent = 'Voiceover active! Captions & audio are synchronized to the new voice.';
    });

    if (btnCleanCaptions) {
      btnCleanCaptions.addEventListener('click', async () => {
        if (!S.captions || !S.captions.length) {
          showToast('No captions to clean yet.');
          return;
        }
        btnCleanCaptions.disabled = true;
        btnCleanCaptions.textContent = '🧹 Cleaning...';
        try {
          const res = await fetch('/api/clean_captions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ captions: S.captions, remove_fillers: true, remove_repeats: true, close_gaps: true })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to clean captions');
          S.captions = normalizeCaptions(data.captions);
          renderCaptionsList();
          renderTimeline();
          const fCount = data.removed_fillers || 0;
          const rCount = data.removed_repeats || 0;
          showToast(`✨ Cleaned! Removed ${fCount} fillers, ${rCount} repeats, and closed gaps.`);
        } catch (e) {
          showToast('Error: ' + e.message);
        } finally {
          btnCleanCaptions.disabled = false;
          btnCleanCaptions.textContent = '🧹 Clean Gaps & Fillers';
        }
      });
    }

    // Voice Pack Cards & Instant Generate Buttons
    $$('.btn-pack-generate').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const vKey = btn.getAttribute('data-voice') || 'special_voice';
        if (voiceoverVoice) voiceoverVoice.value = vKey;
        $$('.voice-pack-card').forEach(c => c.classList.toggle('active', c.getAttribute('data-voice') === vKey));
        
        btn.textContent = '⏳ Generating...';
        btn.disabled = true;
        try {
          await generateVoiceoverAction();
          btn.textContent = '✓ Ready!';
        } catch (err) {
          btn.textContent = '⚡ Generate';
        } finally {
          setTimeout(() => {
            if (btn) {
              btn.disabled = false;
              btn.textContent = '⚡ Generate';
            }
          }, 3000);
        }
      });
    });

    $$('.voice-pack-card').forEach(card => {
      card.addEventListener('click', () => {
        const vKey = card.getAttribute('data-voice') || 'special_voice';
        if (voiceoverVoice) voiceoverVoice.value = vKey;
        $$('.voice-pack-card').forEach(c => c.classList.toggle('active', c === card));
      });
    });

  }

  // ==========================================================================
  // CANVAS SIZING & RENDERING LOOP
  // ==========================================================================
  function setupCanvasSizing() {
    window.addEventListener('resize', fitCanvas);
    document.addEventListener('fullscreenchange', fitCanvas);
    if (window.ResizeObserver && stage) {
      const ro = new ResizeObserver(() => {
        fitCanvas();
      });
      ro.observe(stage);
    }
  }

  function setupCaptionDragging() {
    const hint = $('captionDragHint');
    let drag = null;
    stage.addEventListener('pointerdown', (event) => {
      if (!S.captions.length || !S.style || event.target.closest('button')) return;
      const rect = stage.getBoundingClientRect();
      if (!rect.height) return;

      const clickNormY = (event.clientY - rect.top) / rect.height;
      const isBehindPreset = Boolean(
        S.style && (
          S.style.behindPerson ||
          S.style.depthAccent ||
          (S.style.roles && S.style.roles.accent && S.style.roles.accent.layer === 'behind') ||
          (S.style.name && S.style.name.toLowerCase().includes('(behind)'))
        )
      );

      let targetKey = 'position';
      let lineLabel = 'captions';

      if (isBehindPreset) {
        const topY = typeof S.style.topY === 'number' ? S.style.topY : 0.10;
        const heroY = typeof S.style.depthAccentY === 'number' ? S.style.depthAccentY : 0.18;
        const subY = typeof S.style.subtitlePosition === 'number' ? S.style.subtitlePosition : 0.72;

        const dTop = Math.abs(clickNormY - topY);
        const dHero = Math.abs(clickNormY - heroY);
        const dSub = Math.abs(clickNormY - subY);

        if (dTop <= dHero && dTop <= dSub) {
          targetKey = 'topY';
          lineLabel = 'Line 1 (Above Head)';
        } else if (dHero <= dTop && dHero <= dSub) {
          targetKey = 'depthAccentY';
          lineLabel = 'Line 2 (Hero Behind Head)';
        } else {
          targetKey = 'subtitlePosition';
          lineLabel = 'Line 3 (Front of Person Below)';
        }
      }

      drag = {
        id: event.pointerId,
        startY: event.clientY,
        lastY: event.clientY,
        moved: false,
        targetKey,
        lineLabel,
        isBehindPreset
      };
    });

    stage.addEventListener('pointermove', (event) => {
      if (!drag || drag.id !== event.pointerId) return;
      const rect = stage.getBoundingClientRect();
      if (!rect.height) return;
      if (!drag.moved && Math.abs(event.clientY - drag.startY) < 3) return;
      if (!drag.moved) {
        try { stage.setPointerCapture(event.pointerId); } catch (e) {}
      }
      drag.moved = true;
      event.preventDefault();
      stage.classList.add('is-caption-dragging');

      const delta = (event.clientY - drag.lastY) / rect.height;
      drag.lastY = event.clientY;

      if (drag.isBehindPreset) {
        if (drag.targetKey === 'topY') {
          const cur = Number(S.style.topY) || 0.10;
          const heroLimit = (Number(S.style.depthAccentY) || 0.18) - 0.035;
          S.style.topY = Math.max(0.02, Math.min(heroLimit, cur + delta));
        } else if (drag.targetKey === 'depthAccentY') {
          const cur = Number(S.style.depthAccentY) || 0.18;
          const subLimit = (Number(S.style.subtitlePosition) || 0.72) - 0.04;
          const nextHero = Math.max(0.06, Math.min(subLimit, cur + delta));
          S.style.depthAccentY = nextHero;
          S.style.position = nextHero;
          if (S.style.topY >= nextHero - 0.035) {
            S.style.topY = Math.max(0.02, Number((nextHero - 0.07).toFixed(3)));
          }
        } else if (drag.targetKey === 'subtitlePosition') {
          const cur = Number(S.style.subtitlePosition) || 0.72;
          const heroLimit = (Number(S.style.depthAccentY) || 0.18) + 0.04;
          S.style.subtitlePosition = Math.max(heroLimit, Math.min(0.96, cur + delta));
        }
        syncBehindSliders();
        if (hint) {
          const pct = Math.round((S.style[drag.targetKey] || 0) * 100);
          hint.textContent = `↕ Moving ${drag.lineLabel}: ${pct}% · release to place`;
        }
      } else {
        const cur = Number(S.style.position) || 0.75;
        S.style.position = Math.max(0.10, Math.min(0.95, cur + delta));
        if (hint) {
          hint.textContent = `↕ Moving Captions: ${Math.round(S.style.position * 100)}% · release to place`;
        }
      }

      renderCanvas();
    });

    const finish = (event) => {
      if (!drag || drag.id !== event.pointerId) return;
      const moved = drag.moved;
      drag = null;
      stage.classList.remove('is-caption-dragging');
      if (hint) hint.textContent = '✋ Touch or click any line to drag one-by-one · Top above head, Hero behind, Subtitle below';
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

    const isBehind = Boolean(
      S.style && (
        S.style.behindPerson ||
        S.style.depthAccent ||
        (S.style.roles && S.style.roles.accent && S.style.roles.accent.layer === 'behind') ||
        (S.style.name && S.style.name.toLowerCase().includes('(behind)'))
      )
    );
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

    modalTemplates.addEventListener('click', (e) => {
      if (e.target === modalTemplates) {
        modalTemplates.classList.add('hidden');
      }
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
        captions: S.captions.map(cap => ({
          ...cap,
          text: cleanCaptionText(cap.text),
          words: (cap.words || []).map(word => ({ ...word, t: cleanCaptionText(word.t ?? word.word), word: cleanCaptionText(word.word ?? word.t) })).filter(word => word.t)
        })),
        style: S.style,
        preset_id: S.style?.id || 'yellow_box',
        quality: 'balanced',
        aspect: 'original',
        speed: 1.0
      };
      if (S.voiceoverFilename && btnReplaceVoiceover.classList.contains('active')) {
        payload.voiceover = S.voiceoverFilename;
        payload.replaceOriginalAudio = true;
      }
      if (S.bgmFilename) {
        payload.bgMusic = S.bgmFilename;
        payload.musicVol = Math.round(S.bgmVolume * 100);
      }
      S.exportPayload = payload;
      S.exportRecovered = false;
      S.exportJobId = await queueExport(payload);
      pollExportStatus(S.exportJobId);

    } catch (err) {
      showExportError(err.message);
    }
  }

  async function queueExport(payload) {
    const res = await fetch('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Server rejected export request');
    return data.job;
  }

  async function restoreUploadedVideo() {
    if (!S.file) throw new Error('The uploaded video is no longer available. Select the video again, then export.');

    exportProgressText.textContent = 'Restoring your uploaded video...';
    exportProgressDetail.textContent = 'The server restarted, so the selected video is being uploaded again.';
    const formData = new FormData();
    formData.append('video', S.file);
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Could not re-upload the selected video. Please try selecting it again.');
    S.filename = data.filename;
    S.probe = {
      width: data.width || S.probe.width,
      height: data.height || S.probe.height,
      fps: data.fps || S.probe.fps,
      duration: data.duration || S.probe.duration
    };
  }

  async function recoverMissingVideoAndRetry() {
    if (S.exportRecovered || !S.exportPayload) return false;
    S.exportRecovered = true;
    try {
      await restoreUploadedVideo();
      S.exportPayload.filename = S.filename;
      S.exportJobId = await queueExport(S.exportPayload);
      pollExportStatus(S.exportJobId);
      return true;
    } catch (err) {
      showExportError(err.message);
      return true;
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
          if (/video (file )?not found|upload it again/i.test(data.message || '') && await recoverMissingVideoAndRetry()) {
            return;
          }
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

    // The export API already returns /download/<filename>. Avoid adding the
    // route prefix twice, and point the preview at the matching video route.
    const file = String(filename || '').split('/').pop();
    const downloadUrl = String(filename || '').startsWith('/download/')
      ? filename
      : '/download/' + encodeURIComponent(file);
    btnDownloadExport.href = downloadUrl;
    btnDownloadExport.download = 'captioned_' + file;

    exportPreviewVideo.src = '/video/' + encodeURIComponent(file);
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
