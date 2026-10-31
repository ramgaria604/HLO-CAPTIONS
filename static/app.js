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

  // High-performance text measurement caching for smooth 30fps exports
  const MAX_EXPORT_PARTICLES = 20;
  if (typeof CanvasRenderingContext2D !== 'undefined' && CanvasRenderingContext2D.prototype.measureText) {
    const _nativeMeasureText = CanvasRenderingContext2D.prototype.measureText;
    const _textMetricsCache = new Map();
    CanvasRenderingContext2D.prototype.measureText = function (text) {
      const key = (this.font || '') + ':::' + text;
      let cached = _textMetricsCache.get(key);
      if (cached) return cached;
      cached = _nativeMeasureText.call(this, text);
      if (_textMetricsCache.size >= 2500) _textMetricsCache.clear();
      _textMetricsCache.set(key, cached);
      return cached;
    };
  }

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
  user: null,
  currentProjectId: null,
  credits: 1,
  aspect: 'original',
  chunkMode: '3',
  autoEmojis: 'above',
    previewPerfMode: (() => {
      const isPhone = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (window.innerWidth <= 768 && !/iPad/i.test(navigator.userAgent));
      const saved = localStorage.getItem('cs_preview_perf_mode');
      return saved !== null ? (saved === 'true') : isPhone;
    })(),
    exportQuality: (() => {
      const isPhone = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (window.innerWidth <= 768 && !/iPad/i.test(navigator.userAgent));
      return localStorage.getItem('captionstudio_export_quality') || (isPhone ? 'balanced' : 'high');
    })(),
  autoSfx: true,
  sfxVolume: 0.7,
  watermark: { text: '', platform: 'instagram', position: 'bottom-right', opacity: 0.8 },
  brolls: [],
  autoZoom: {
    enabled: true,
    interval: 10,
    duration: 3.5,
    speed: 0.6,
    scale: 1.10
  },
  progressBar: { enabled: true, position: 'bottom' },
  bigType: true,
  realEstateConfig: {
    enabled: false,
    bigType: true,
    paletteLock: 'auto',
    cameraPunch: true,
    personGlow: true,
    lowerThird: false,
    locationTag: false,
    depthShadow: !(/Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (window.innerWidth <= 768 && !/iPad/i.test(navigator.userAgent))),
    presenterName: '',
    presenterRole: ''
  },
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
  const ctx = captionCanvas ? captionCanvas.getContext('2d') : null;
  const behindCanvas = $('behindCanvas');
  const behindCtx = behindCanvas ? behindCanvas.getContext('2d') : null;
  const personCanvas = $('personCanvas');
  const personCtx = personCanvas ? personCanvas.getContext('2d') : null;
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
  const timelineScrollContainer = $('timelineScrollContainer') || $('timelineTrackWrap');
  const timelineRibbon = $('timelineRibbon');
  const timelineRuler = $('timelineRuler');
  const timelineLane = $('timelineLane');
  const timelinePlayhead = $('timelinePlayhead');
  const tlTimeIndicator = $('tlTimeIndicator');
  let pxPerSec = 80;
  let isUserScrubbingTimeline = false;

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
  const btnConvertToHinglish = $('btnConvertToHinglish');

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

    const dur = 0.25;
    if (dt < dur) {
      const p = Math.max(0, Math.min(1, dt / dur));
      const ease = 1 - Math.pow(1 - p, 3);
      let dx = 0, dy = 0, scale = 1.0;
      const enterAnim = anim || 'pop';
      if (enterAnim === 'slide-up') {
        dy = 28 * (1 - ease);
      } else if (enterAnim === 'slide-down') {
        dy = -28 * (1 - ease);
      } else if (enterAnim === 'slide-left') {
        dx = 32 * (1 - ease);
      } else if (enterAnim === 'slide-right') {
        dx = -32 * (1 - ease);
      } else if (enterAnim === 'fade') {
        scale = 1.0;
      } else if (enterAnim === 'pop' || enterAnim === 'bounce') {
        scale = 0.84 + 0.16 * ease;
      } else if (enterAnim === 'zoom') {
        scale = 0.50 + 0.50 * ease;
      } else if (enterAnim === 'none' || enterAnim === 'static') {
        scale = 1.0;
      }
      return { visible: true, scale, dx, dy, opacity: (enterAnim === 'none' || enterAnim === 'static') ? 1.0 : ease };
    }

    // Word already spoken: stays fully visible and stable at exactly (0,0)
    return { visible: true, scale: 1.0, dx: 0, dy: 0, opacity: 1.0 };
  }

  return { visible: true, scale: 1.0, dx: 0, dy: 0, opacity: 1.0 };
}

// Configurable threshold: lines whose vertical center is <= this ratio are 'behind', lines below are 'front'
const BEHIND_LINE_MAX_Y_RATIO = 0.45;

function getLineLayer(lineObj, st, frameH) {
  if (lineObj && lineObj.role && lineObj.role.layer === 'behind') return 'behind';
  if (lineObj && lineObj.role && lineObj.role.layer === 'front') return 'front';
  if (st && st.roles && st.roles.accent && st.roles.accent.layer === 'behind') {
    if (lineObj && lineObj.isHero) return 'behind';
  }
  const y = typeof lineObj.y === 'number' ? lineObj.y : ((st.depthAccentY || st.posY || st.position || 0.5) * frameH);
  return (y / (frameH || 1)) <= BEHIND_LINE_MAX_Y_RATIO ? 'behind' : 'front';
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

function canvasRolePaint(ctx, role, fallback, extent, box) {
  const gradientCss = role && (role.keyGradient || role.textGradient);
  if (!gradientCss || typeof gradientCss !== 'string') return fallback;
  const match = gradientCss.match(/linear-gradient\(\s*([-\d.]+)deg\s*,\s*(.+)\)/i);
  if (!match || !ctx.createLinearGradient) return fallback;
  const rawParts = match[2].split(/,(?![^()]*\))/).map(c => c.trim()).filter(Boolean);
  if (rawParts.length < 2) return rawParts[0] || fallback;

  const angle = parseFloat(match[1]);
  const normAngle = ((angle % 360) + 360) % 360;

  let x1, y1, x2, y2;
  const w = box && typeof box.w === 'number' ? box.w : extent;
  const h = box && typeof box.h === 'number' ? box.h : extent;
  const bx = box && typeof box.x === 'number' ? box.x : 0;
  const by = box && typeof box.y === 'number' ? box.y : 0;

  const isHorizontal = (normAngle >= 45 && normAngle <= 135) || (normAngle >= 225 && normAngle <= 315);

  if (isHorizontal) {
    if (normAngle >= 225 && normAngle <= 315) {
      x1 = bx + w; y1 = by + h / 2; x2 = bx; y2 = by + h / 2;
    } else {
      x1 = bx; y1 = by + h / 2; x2 = bx + w; y2 = by + h / 2;
    }
  } else {
    if (normAngle >= 135 && normAngle <= 225) {
      x1 = bx + w / 2; y1 = by; x2 = bx + w / 2; y2 = by + h;
    } else {
      x1 = bx + w / 2; y1 = by + h; x2 = bx + w / 2; y2 = by;
    }
  }

  const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
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
  let smallColor = st.baseColor || fRole.color || st.color || '#FFFFFF';
  let bigColor = st.highlightColor || (st.highlight && st.highlight.color) || kRole.color || '#FFE600';
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
        const wDx = (Number(wo.w && wo.w.dx) || 0) * W;
        const wDy = (Number(wo.w && wo.w.dy) || 0) * H;
        ctx.translate(wordCenterX + (anim.dx || 0) + wDx, lineY + (anim.dy || 0) + wDy);
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
          const isGlowActive = st.glowEnabled !== false;
          const gColor = st.glowColor || (kRole && kRole.glow) || st.highlightColor || '#FFE600';
          const gBlur = Math.max(6, Math.round(Number(st.glowBlur) || 18));

          if (isGlowActive && wo.isKey) {
            ctx.save();
            ctx.shadowColor = gColor;
            ctx.shadowBlur = gBlur;
            ctx.strokeText(wo.txt, 0, 0);
            ctx.shadowBlur = gBlur * 1.8;
            ctx.fillText(wo.txt, 0, 0);
            ctx.restore();
          }

          // Glow / Shadow
          ctx.shadowColor = wo.isKey ? (kRole.shadowColor || 'rgba(0, 0, 0, 0.90)') : (fRole.shadowColor || 'rgba(0, 0, 0, 0.90)');
          ctx.shadowBlur = Math.round(base * 0.02) + (wo.isKey ? 8 : 5);

          // Outline stroke
          ctx.strokeStyle = wo.isKey ? (kRole.outlineColor || '#000000') : (fRole.outlineColor || '#000000');
          ctx.lineWidth = Math.max(2, Math.round(fs * (wo.isKey ? 0.17 : 0.14)));
          ctx.strokeText(wo.txt, 0, 0);

          // Fill text
          const wordBox = { x: -wo.width / 2, y: -fs / 2, w: wo.width, h: fs };
          ctx.fillStyle = wo.isKey ? canvasRolePaint(ctx, kRole, bigColor, fs, wordBox) : canvasRolePaint(ctx, fRole, smallColor, fs, wordBox);
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
  const scale = Math.max(0.24, Math.min(W / 1080, H / 1920)) * (Number(st.fontScale) || 1);
  const getRolePx = (r, defaultPx) => {
    const s = Number(r.size) || defaultPx;
    return Math.max(16, s > 1 ? s * scale : s * H);
  };

  const layoutFn = getLayoutStackFn();
  let lay;

  if (isBehindPreset) {
    const heroY = typeof st.depthAccentY === 'number' ? st.depthAccentY : 0.25;
    const accentPx = getRolePx(accentRole, 230);
    const basePx = getRolePx(baseRole, 60);
    const fontSpan = (accentPx + basePx) * 0.5 / H + 0.008;
    const defaultTop = Math.max(0.02, Number((heroY - fontSpan).toFixed(3)));
    const topY = typeof st.topY === 'number' ? st.topY : defaultTop;
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
    let lineLayer = 'front';
    if (o.role && o.role.layer === 'behind') {
      lineLayer = 'behind';
    } else if (o.role && o.role.layer === 'front') {
      lineLayer = 'front';
    } else if (o.isHero && (o.role?.layer === 'behind' || st.roles?.accent?.layer === 'behind')) {
      lineLayer = 'behind';
    } else if (st.behindPerson || st.depthAccent || isBehindPreset || isBehind) {
      // Automatic rule: upper part of frame (<= 45%) is 'behind', lower part is 'front'
      const lineCenterY = (typeof o.y === 'number' ? o.y : (posY * H)) / H;
      lineLayer = (lineCenterY <= BEHIND_LINE_MAX_Y_RATIO) ? 'behind' : 'front';
    }

    const isBehindPerson = (lineLayer === 'behind');
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
      const anim = getWordPop(wo.w, t, showAll, st.animation || o.role.enter || 'pop');

      // Keep word place in line - if not yet arrived, opacity is 0 (do not shift/re-layout)
      if (anim.opacity > 0) {
        targetCtx.save();
        // Slide / enter animation ends at exactly translate(0, 0).
        // Role dx/dy is NOT applied to lines of stack layout.
        const wDx = (Number(wo.w && wo.w.dx) || 0) * W;
        const wDy = (Number(wo.w && wo.w.dy) || 0) * H;
        targetCtx.translate(curX + (anim.dx || 0) + wDx, o.baseline + (anim.dy || 0) + wDy);
        targetCtx.scale(anim.scale || 1, anim.scale || 1);
        targetCtx.globalAlpha *= (typeof anim.opacity === 'number' ? anim.opacity : 1.0);
        targetCtx.textBaseline = 'alphabetic';
        targetCtx.textAlign = 'left';

        // Outlines & shadows
        let outlineWidth = 0;
        let outlineColor = '#000000';
        if (st.outlineMode === 'none') {
          outlineWidth = 0;
        } else if (st.outlineMode === 'glow') {
          outlineWidth = Math.max(2, Math.round(o.size * 0.05));
          outlineColor = st.highlightColor || '#FFE600';
        } else {
          outlineWidth = Math.max(1, (o.role.outline || 3) * (o.size / 70));
          outlineColor = o.role.outlineColor || '#000000';
        }
        if (st.glowEnabled !== false && (st.glowEnabled || (o.role && o.role.glow))) {
          const gColor = st.glowColor || (o.role && o.role.glow) || '#FFE600';
          const gBlur = Math.max(8, Math.round(Number(st.glowBlur) || 18));
          targetCtx.save();
          targetCtx.shadowColor = gColor;
          targetCtx.shadowBlur = gBlur;
          targetCtx.shadowOffsetX = 0;
          targetCtx.shadowOffsetY = 0;
          targetCtx.fillText(wo.txt, 0, 0);
          targetCtx.restore();
        }

        if (outlineWidth > 0) {
          targetCtx.lineJoin = 'round';
          targetCtx.lineWidth = outlineWidth;
          targetCtx.strokeStyle = outlineColor;
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
        const basePaintColor = o.isHero ? (st.highlightColor || o.role.color || '#FFE600') : (st.baseColor || o.role.color || '#FFFFFF');
        const wordBox = { x: 0, y: -o.size * 0.85, w: wo.width, h: o.size * 0.85 };
        targetCtx.fillStyle = canvasRolePaint(targetCtx, o.role, basePaintColor, o.size, wordBox);
        targetCtx.fillText(wo.txt, 0, 0);
        targetCtx.restore();
      }

      curX += wo.width + spaceWidth;
    });

    targetCtx.restore();
  });
}


  // ==========================================================================
  // SPECIAL REAL ESTATE VIDEO TEMPLATE ENGINE (AUTO-OVERLAP, FIT & DEPTH)
  // ==========================================================================
  const HERO_HEAD_GAP_RATIO = 0.28;
  const BEHIND_SAFE_MARGIN = 0.08;
  const HERO_MAX_WIDTH_RATIO = 0.84;
  const GLITCH_DURATION = 0.06;

  // Auto-overlap & Depth Constants
  const TARGET_OVERLAP = 0.30;
  const MIN_OVERLAP = 0.18;
  const MAX_OVERLAP = 0.45;
  const MIN_VISIBLE_RATIO = 0.55;
  const SHADOW_BLUR = 6;
  const SHADOW_OFFSET_X = 8;
  const SHADOW_OFFSET_Y = 8;
  const SHADOW_OPACITY = 0.35;
  const PARALLAX_MAX_PX = 6.0;
  const Y_SMOOTH_TIME = 0.25;
  const RECHECK_INTERVAL = 0.25;
  const READABILITY_SHIFT_RATIO = 0.04;

  const REAL_ESTATE_KEYWORDS = new Set([
    'luxury', 'penthouse', 'bedroom', 'bedrooms', 'bath', 'baths', 'bathroom', 'bathrooms',
    'sqft', 'pool', 'view', 'views', 'price', 'million', 'modern', 'kitchen', 'terrace',
    'balcony', 'estate', 'mansion', 'villa', 'property', 'interior', 'exterior', 'garage',
    'amenities', 'location', 'downtown', 'skyline', 'suite', 'residence', 'residences',
    'custom', 'architecture', 'smart', 'private', 'gated', 'waterfront', 'oceanfront',
    'rooftop', 'designer', 'elegance', 'exquisite', 'master', 'closet', 'garden', 'patio'
  ]);

  const POWER_HERO_WORDS = new Set([
    'free', 'click', 'comment', 'caption', 'captions', 'animated', 'colorful',
    'premium', 'link', 'style', 'viral', 'reels', 'easy', 'fast'
  ]);

  const REAL_ESTATE_STOPWORDS = new Set([
    // English stopwords
    'this', 'that', 'with', 'from', 'have', 'what', 'your', 'about', 'video', 'just', 'like',
    'there', 'their', 'when', 'which', 'will', 'then', 'they', 'the', 'and', 'for', 'are',
    'but', 'not', 'you', 'all', 'any', 'can', 'had', 'her', 'was', 'one', 'our', 'out',
    'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two',
    'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use', 'into',
    'here', 'come', 'look', 'take', 'make', 'good', 'some', 'than', 'them', 'very',
    // Extended Hindi / Hinglish / Pronoun / Filler stopwords
    'tu', 'tujhe', 'tujhko', 'tera', 'teri', 'tere', 'main', 'mujhe', 'mera', 'meri', 'mere',
    'hum', 'humein', 'aap', 'aapko', 'tum', 'tumhein', 'bas', 'ek', 'hi', 'bhi', 'toh', 'to',
    'na', 'nahi', 'nahin', 'wo', 'woh', 'ye', 'yeh', 'jo', 'jab', 'tab', 'kar', 'karo', 'karna',
    'karta', 'karti', 'kuch', 'sab', 'mein', 'me', 'se', 'ko', 'ka', 'ki', 'ke', 'par',
    'pe', 'ne', 'aur', 'ya', 'likh', 'likho', 'likhna', 'bhej', 'bhejo', 'bhejna', 'de', 'dena',
    'doonga', 'dunga', 'lena', 'chahiye', 'hai', 'hain', 'tha', 'the',
    'bhai', 'bro', 'yaar', 'dost', 'sun', 'suno', 'dekho', 'dekh', 'chalo', 'abhi', 'phir', 'fir',
    'bol', 'bolo', 'bolna', 'batao', 'bata', 'batana', 'apna', 'apni', 'apne'
  ]);

  const REAL_ESTATE_PALETTES = {
    teal:   { id: 'teal',   name: 'Teal Cyan',      gradient: ['#00f5d4', '#00bbf9'], accent: '#00f5d4' },
    purple: { id: 'purple', name: 'Purple Violet',  gradient: ['#d946ef', '#8b5cf6'], accent: '#d946ef' },
    pink:   { id: 'pink',   name: 'Pink Magenta',   gradient: ['#ff007f', '#ff758c'], accent: '#ff007f' },
    lime:   { id: 'lime',   name: 'Lime Green',     gradient: ['#a3e635', '#22c55e'], accent: '#a3e635' },
    sky:    { id: 'sky',    name: 'Sky Blue',       gradient: ['#38bdf8', '#2563eb'], accent: '#38bdf8' },
    gold:   { id: 'gold',   name: 'Gold Amber',     gradient: ['#fde047', '#f59e0b'], accent: '#fde047' }
  };

  const REAL_ESTATE_PALETTE_KEYS = ['teal', 'purple', 'pink', 'lime', 'sky', 'gold'];

  const KNOWN_CITY_LOCATIONS = [
    { key: 'beverly hills', label: 'BEVERLY HILLS, CA' },
    { key: 'los angeles',   label: 'LOS ANGELES, CA' },
    { key: 'manhattan',     label: 'MANHATTAN, NY' },
    { key: 'new york',      label: 'NEW YORK, NY' },
    { key: 'miami',         label: 'MIAMI, FL' },
    { key: 'dubai',         label: 'DOWNTOWN DUBAI' },
    { key: 'london',        label: 'MAYFAIR, LONDON' },
    { key: 'austin',        label: 'AUSTIN, TX' },
    { key: 'malibu',        label: 'MALIBU, CA' },
    { key: 'aspen',         label: 'ASPEN, CO' },
    { key: 'monaco',        label: 'MONTE CARLO, MONACO' },
    { key: 'sydney',        label: 'SYDNEY, AUSTRALIA' }
  ];

  function seededRandom(seed) {
    const x = Math.sin(Number(seed) * 9999 + 1) * 10000;
    return x - Math.floor(x);
  }

  function easeOutBack(x) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  }

  function easeOutQuad(x) {
    return 1 - (1 - x) * (1 - x);
  }

  function easeOutCubic(x) {
    return 1 - Math.pow(1 - x, 3);
  }

  // Strip leading and trailing punctuation (commas, periods, quotes, ?, !, etc.)
  function cleanWordForHero(wordStr) {
    if (!wordStr) return '';
    return String(wordStr)
      .trim()
      .toLowerCase()
      .replace(/^[^a-zA-Z0-9$€£¥₹]+|[^a-zA-Z0-9$€£¥₹]+$/g, '');
  }

  function getCleanDisplayHeroText(wordStr) {
    if (!wordStr) return '';
    return String(wordStr)
      .trim()
      .replace(/^[^a-zA-Z0-9$€£¥₹]+|[^a-zA-Z0-9$€£¥₹]+$/g, '')
      .toUpperCase();
  }

  function isPriceOrNumber(str) {
    if (!str) return false;
    return /[\$€£¥₹]|\d/.test(str);
  }

  function formatNumberCounter(text, progress) {
    if (progress >= 1) return text;
    const m = String(text).match(/^([^0-9.]*)([0-9,.]+)(.*)$/);
    if (!m) return text;
    const prefix = m[1] || '';
    const numStr = m[2].replace(/,/g, '');
    const suffix = m[3] || '';
    const targetNum = parseFloat(numStr);
    if (isNaN(targetNum)) return text;

    const currentVal = targetNum * Math.max(0, Math.min(1, progress));
    let formattedVal;
    if (numStr.includes('.')) {
      const decimals = (numStr.split('.')[1] || '').length;
      formattedVal = currentVal.toFixed(decimals);
    } else {
      formattedVal = Math.round(currentVal).toLocaleString();
    }
    return prefix + formattedVal + suffix;
  }

  function getDetectedCityLocation() {
    if (!S.captions || S.captions.length === 0) return 'BEVERLY HILLS, CA';
    const allText = S.captions.map(c => c.text || '').join(' ').toLowerCase();
    for (const item of KNOWN_CITY_LOCATIONS) {
      if (allText.includes(item.key)) {
        return item.label;
      }
    }
    return 'BEVERLY HILLS, CA';
  }

  function getPersonMaskHeadTop(maskCanvas, outH) {
    if (!maskCanvas || !maskCanvas.width || !maskCanvas.height) return null;
    try {
      const mw = maskCanvas.width;
      const mh = maskCanvas.height;
      const mctx = maskCanvas.getContext('2d', { willReadFrequently: true }) || maskCanvas.getContext('2d');
      if (!mctx) return null;
      const imgData = mctx.getImageData(0, 0, mw, mh);
      const data = imgData.data;
      const xStart = Math.floor(mw * 0.25);
      const xEnd = Math.floor(mw * 0.75);
      for (let y = 0; y < mh; y += 2) {
        const rowOffset = y * mw * 4;
        for (let x = xStart; x < xEnd; x += 4) {
          if (data[rowOffset + x * 4 + 3] > 64) {
            return (y / mh) * outH;
          }
        }
      }
    } catch (_) {}
    return null;
  }

  function getPersonCentroidX(maskCanvas) {
    if (!maskCanvas || !maskCanvas.width || !maskCanvas.height) return 0;
    try {
      const mw = maskCanvas.width;
      const mh = maskCanvas.height;
      const mctx = maskCanvas.getContext('2d', { willReadFrequently: true }) || maskCanvas.getContext('2d');
      if (!mctx) return 0;
      const scanY = Math.floor(mh * 0.15);
      const scanH = Math.floor(mh * 0.35);
      const imgData = mctx.getImageData(0, scanY, mw, scanH);
      const data = imgData.data;
      let sumX = 0, count = 0;
      for (let y = 0; y < scanH; y += 4) {
        const row = y * mw * 4;
        for (let x = 0; x < mw; x += 4) {
          if (data[row + x * 4 + 3] > 64) {
            sumX += x;
            count++;
          }
        }
      }
      if (count > 0) {
        const avgX = (sumX / count) / mw;
        return (avgX - 0.5) * 2;
      }
    } catch (_) {}
    return 0;
  }

  function computeHeroMaskOverlap(maskCanvas, heroX, heroY, heroW, heroH, W, H) {
    if (!maskCanvas || !maskCanvas.width || !maskCanvas.height) return 0;
    try {
      const mw = maskCanvas.width;
      const mh = maskCanvas.height;
      const mctx = maskCanvas.getContext('2d', { willReadFrequently: true }) || maskCanvas.getContext('2d');
      if (!mctx) return 0;

      const sx = Math.max(0, Math.min(mw - 1, Math.floor((heroX / W) * mw)));
      const sy = Math.max(0, Math.min(mh - 1, Math.floor((heroY / H) * mh)));
      const sw = Math.max(1, Math.min(mw - sx, Math.ceil((heroW / W) * mw)));
      const sh = Math.max(1, Math.min(mh - sy, Math.ceil((heroH / H) * mh)));

      const imgData = mctx.getImageData(sx, sy, sw, sh);
      const data = imgData.data;
      const numX = 12;
      const numY = 6;
      let covered = 0;
      let total = 0;

      for (let iy = 0; iy < numY; iy++) {
        const sampleY = Math.floor((iy + 0.5) * (sh / numY));
        const rowOffset = sampleY * sw * 4;
        for (let ix = 0; ix < numX; ix++) {
          const sampleX = Math.floor((ix + 0.5) * (sw / numX));
          total++;
          if (data[rowOffset + sampleX * 4 + 3] > 64) {
            covered++;
          }
        }
      }
      return total > 0 ? (covered / total) : 0;
    } catch (_) {
      return 0;
    }
  }

  function findOptimalAutoOverlapY(maskCanvas, heroX, heroW, heroH, headTopY, W, H) {
    const yMin = Math.max(H * BEHIND_SAFE_MARGIN, (headTopY !== null ? headTopY - 0.05 * H : H * 0.20));
    const chestY = headTopY !== null ? (headTopY + 0.40 * H) : (H * 0.55);
    const yMax = Math.min(H * (1 - BEHIND_SAFE_MARGIN) - heroH, chestY);
    const step = 0.02 * H;

    let bestY = null;
    let bestDiff = 999;
    let bestOverlap = 0;

    for (let candY = yMin; candY <= yMax; candY += step) {
      const overlap = computeHeroMaskOverlap(maskCanvas, heroX, candY, heroW, heroH, W, H);
      if (overlap >= MIN_OVERLAP && overlap <= MAX_OVERLAP) {
        const diff = Math.abs(overlap - TARGET_OVERLAP);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestY = candY;
          bestOverlap = overlap;
        }
      }
    }

    if (bestY === null) {
      bestY = headTopY !== null ? (headTopY + H * HERO_HEAD_GAP_RATIO) : (H * 0.30);
      bestOverlap = computeHeroMaskOverlap(maskCanvas, heroX, bestY, heroW, heroH, W, H);
    }

    return { y: bestY, overlap: bestOverlap };
  }

  function getRealEstateCameraPunch(t, captions) {
    if (!captions || captions.length === 0) return 1.0;
    let lastPunchTime = -999;
    for (let i = 0; i < captions.length; i++) {
      const cap = captions[i];
      const words = cap.words || [];
      const hasTrigger = words.some(w => {
        const clean = cleanWordForHero(w.t || w.word || '');
        return isPriceOrNumber(clean) || REAL_ESTATE_KEYWORDS.has(clean) || POWER_HERO_WORDS.has(clean);
      });
      if (hasTrigger && cap.start - lastPunchTime >= 1.5) {
        lastPunchTime = cap.start;
        const dt = t - cap.start;
        if (dt >= 0 && dt <= 0.95) {
          if (dt < 0.25) {
            return 1.0 + 0.05 * easeOutCubic(dt / 0.25);
          } else if (dt <= 0.55) {
            return 1.05;
          } else {
            const p = (dt - 0.55) / 0.40;
            return 1.05 - 0.05 * easeOutQuad(Math.min(1, p));
          }
        }
      }
    }
    return 1.0;
  }

  // Scored word ranking with power words & strict stopword rejection
  function scoreRealEstateWord(w, idx) {
    const raw = String(w.t || w.word || '');
    const clean = cleanWordForHero(raw);
    if (!clean) return -999;
    // Strict stopword rejection: even if w.key === true, ALWAYS reject stopwords!
    if (REAL_ESTATE_STOPWORDS.has(clean)) return -999;
    if (Boolean(w.key)) return 1000 - idx;
    if (POWER_HERO_WORDS.has(clean) || REAL_ESTATE_KEYWORDS.has(clean)) return 800 - idx;
    if (isPriceOrNumber(clean)) return 700 - idx;
    if (clean.length >= 4) return 400 + clean.length * 10 - idx;
    return -50;
  }

  const _reCaptionCache = new Map();
  let _lastLoggedHeroCapIdx = -1;

  function analyzeRealEstateCaption(cap, words, passedCapIdx, showAll) {
    let capIdx = -1;
    if (cap && typeof cap.index === 'number') {
      capIdx = cap.index;
    } else if (S.captions && S.captions.length > 0) {
      capIdx = S.captions.findIndex(c => c === cap || (c.id != null && c.id === cap.id) || (Math.abs(c.start - cap.start) < 0.001));
    }
    if (capIdx === -1) {
      capIdx = Number(passedCapIdx) || 0;
    }
    const cacheKey = (cap.id || capIdx) + ':::' + words.map(w => w.t || w.word || '').join('|');
    if (_reCaptionCache.has(cacheKey)) {
      return _reCaptionCache.get(cacheKey);
    }

    // Score all candidates
    const candidates = words.map((w, idx) => {
      const raw = String(w.t || w.word || '');
      const clean = cleanWordForHero(raw);
      const isStop = !clean || REAL_ESTATE_STOPWORDS.has(clean);
      const score = isStop ? -999 : scoreRealEstateWord(w, idx);
      return { word: w, raw, clean, idx, score };
    });

    // Rank candidates
    const ranked = candidates.slice().sort((a, b) => b.score - a.score);

    // Only accept words scoring >= 400 that are strictly not in the stopword list
    const validCandidates = ranked.filter(c => c.score >= 400 && !REAL_ESTATE_STOPWORDS.has(c.clean));
    const hasValidHeroWord = validCandidates.length > 0;

    const heroCandidate = hasValidHeroWord ? validCandidates[0] : null;
    const heroIdx = heroCandidate ? heroCandidate.idx : -1;
    const heroWord = heroCandidate ? heroCandidate.word : null;
    const rawHeroText = heroWord ? (heroWord.t || heroWord.word || '') : '';
    // Never draw trailing punctuation on the hero word
    const heroText = getCleanDisplayHeroText(rawHeroText);
    const heroIsNum = isPriceOrNumber(heroText);

    // Logging: console.log('[HERO PICK]', captionIndex, chosenWord, candidates with scores) once per caption
    if (_lastLoggedHeroCapIdx !== capIdx && !showAll) {
      _lastLoggedHeroCapIdx = capIdx;
      const chosenWord = hasValidHeroWord ? heroCandidate.raw : 'NONE (normal in-front)';
      const candidateSummary = candidates.map(c => `${c.raw}(${c.score})`).join(', ');
      console.log('[HERO PICK]', capIdx, chosenWord, candidateSummary);
    }

    // ALL words before heroIdx
    let topWords = heroIdx > 0 ? words.slice(0, heroIdx) : [];
    // ALL words after heroIdx
    let bottomWords = heroIdx >= 0 && heroIdx < words.length - 1 ? words.slice(heroIdx + 1) : [];

    // Requirement 7: If the bottom line is only one word, merge it into the top line
    if (bottomWords.length === 1) {
      topWords = topWords.concat(bottomWords);
      bottomWords = [];
    }

    const topLines = [];
    if (topWords.length >= 3) {
      const chunkSize = topWords.length >= 5 ? 3 : 2;
      for (let i = 0; i < topWords.length; i += chunkSize) {
        topLines.push(topWords.slice(i, i + chunkSize));
      }
    } else if (topWords.length > 0) {
      topLines.push(topWords);
    }

    const bottomLines = [];
    if (bottomWords.length >= 3) {
      const chunkSize = bottomWords.length >= 5 ? 3 : 2;
      for (let i = 0; i < bottomWords.length; i += chunkSize) {
        bottomLines.push(bottomWords.slice(i, i + chunkSize));
      }
    } else if (bottomWords.length > 0) {
      bottomLines.push(bottomWords);
    }

    let palette;
    const lock = (S.realEstateConfig && S.realEstateConfig.paletteLock) || 'auto';
    if (lock !== 'auto' && REAL_ESTATE_PALETTES[lock]) {
      palette = REAL_ESTATE_PALETTES[lock];
    } else {
      // Rotation: cycle palettes so each caption has a different palette, never same twice in a row
      let pIdx = Math.abs(capIdx) % REAL_ESTATE_PALETTE_KEYS.length;
      if (heroIsNum || heroText.includes('MILLION') || heroText.includes('PRICE')) {
        pIdx = REAL_ESTATE_PALETTE_KEYS.indexOf('gold');
      }
      let chosenKey = REAL_ESTATE_PALETTE_KEYS[pIdx];
      if (capIdx > 0) {
        const prevPIdx = (capIdx - 1) % REAL_ESTATE_PALETTE_KEYS.length;
        const prevKey = REAL_ESTATE_PALETTE_KEYS[prevPIdx];
        if (chosenKey === prevKey && REAL_ESTATE_PALETTE_KEYS.length > 1) {
          pIdx = (pIdx + 1) % REAL_ESTATE_PALETTE_KEYS.length;
          chosenKey = REAL_ESTATE_PALETTE_KEYS[pIdx];
        }
      }
      palette = REAL_ESTATE_PALETTES[chosenKey];
    }

    const analyzed = {
      heroIdx,
      heroWord,
      heroText,
      heroIsNum,
      hasValidHeroWord,
      topWords,
      topLines,
      bottomWords,
      bottomLines,
      palette,
      capIdx
    };

    if (_reCaptionCache.size > 200) _reCaptionCache.clear();
    _reCaptionCache.set(cacheKey, analyzed);
    return analyzed;
  }

  // Normal in-front caption layout when no word qualifies as a hero word (does not force a hero)
  function drawNormalInFrontCaption(ctx, cap, words, t, stTime, capDur, W, H, showAll) {
    if (!ctx || !words || words.length === 0) return;

    const fontSize = Math.round(W * 0.056);
    const font = `800 ${fontSize}px 'Montserrat', 'Poppins', sans-serif`;
    const lineSpacing = fontSize * 1.34;

    const lines = [];
    const chunkSize = words.length >= 6 ? 4 : (words.length >= 4 ? 3 : words.length);
    for (let i = 0; i < words.length; i += chunkSize) {
      lines.push(words.slice(i, i + chunkSize));
    }

    const totalH = lines.length * lineSpacing;
    const startY = Math.round(H * 0.72 - (totalH / 2));
    const alpha = showAll ? 1.0 : Math.min(1.0, stTime / 0.12);

    lines.forEach((lineChunk, lineIdx) => {
      const lineText = lineChunk.map(w => w.t || w.word || '').join(' ').toUpperCase();
      ctx.save();
      ctx.font = font;
      const metrics = ctx.measureText(lineText);
      const lineW = metrics.width;
      let lineX = Math.round((W - lineW) / 2);
      lineX = Math.max(W * BEHIND_SAFE_MARGIN, Math.min(W * (1 - BEHIND_SAFE_MARGIN) - lineW, lineX));
      const curY = startY + lineIdx * lineSpacing;

      ctx.globalAlpha = alpha;

      // Dark translucent glass pill behind line
      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      const padX = 14;
      const padY = 5;
      ctx.beginPath();
      ctx.roundRect(lineX - padX, curY - padY, lineW + padX * 2, fontSize + padY * 2, 8);
      ctx.fill();

      // High contrast: dark stroke of 3px plus soft shadow + pure white text
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.95)';
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
      ctx.shadowBlur = 6;
      ctx.strokeText(lineText, lineX, curY);

      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(lineText, lineX, curY);
      ctx.restore();
    });
  }

  // Draw Core Special Real Estate Caption Layout (BELOW / IN FRONT PLACEMENT)
  function drawSpecialRealEstateTemplate(ctxFore, ctxBehind, cap, words, t, st, W, H, isBehind, showAll, isPreview = false) {
    if (!ctxFore || !cap || !words || words.length === 0) return;

    const capIdx = S.captions.indexOf(cap) !== -1 ? S.captions.indexOf(cap) : 0;
    const data = analyzeRealEstateCaption(cap, words, capIdx, showAll);

    const stTime = Math.max(0, t - cap.start);
    const capDur = Math.max(0.1, cap.end - cap.start);

    // GHOSTING FIX: If next caption has already started, do not draw this hero word
    const nextCap = (S.captions && capIdx + 1 < S.captions.length) ? S.captions[capIdx + 1] : null;
    const hasNextImmediate = Boolean(nextCap && typeof nextCap.start === 'number' && nextCap.start <= cap.end + 0.04);

    if (nextCap && typeof nextCap.start === 'number' && t >= nextCap.start && !showAll) {
      return; // Stop rendering immediately so two hero words NEVER overlap in time
    }

    // If no word qualifies as hero, render normal in-front caption layout below
    if (!data.hasValidHeroWord) {
      drawNormalInFrontCaption(ctxFore, cap, words, t, stTime, capDur, W, H, showAll);
      return;
    }

    // ALL CAPTIONS ARE DRAWN IN FRONT (BELOW / LOWER-THIRD)
    const targetCtx = ctxFore;

    // Exit fade (only if there is a gap to next caption)
    let exitAlpha = 1.0;
    let exitScale = 1.0;
    if (!hasNextImmediate && !showAll) {
      const exitWindow = Math.min(0.10, Math.max(0.04, capDur * 0.20));
      if (capDur > exitWindow && stTime >= (capDur - exitWindow)) {
        const exitP = Math.min(1.0, (stTime - (capDur - exitWindow)) / exitWindow);
        exitAlpha = 1.0 - exitP;
        exitScale = 1.0 - 0.05 * exitP;
      }
    }

    let displayHeroText = data.heroText;
    if (data.heroIsNum && !showAll) {
      const numProgress = Math.min(1, Math.max(0, stTime / 0.50));
      displayHeroText = formatNumberCounter(data.heroText, numProgress);
    }
    displayHeroText = getCleanDisplayHeroText(displayHeroText);

    // FIT CALCULATION: Reduce font size until measured width at PEAK scale <= 0.84 * W
    const maxAllowedHeroWidth = HERO_MAX_WIDTH_RATIO * W;
    const peakEntranceScale = 1.10;
    const letterSpacing = 2;
    const strokePadding = 8;

    let heroFontSize = Math.round(W * 0.17);
    ctxFore.save();
    while (heroFontSize > 14) {
      const testFont = `900 ${heroFontSize}px 'Montserrat', 'Impact', 'Anton', sans-serif`;
      ctxFore.font = testFont;
      const m = ctxFore.measureText(displayHeroText);
      const rawW = m.width + Math.max(0, displayHeroText.length - 1) * letterSpacing + strokePadding;
      const peakW = rawW * peakEntranceScale;
      if (peakW <= maxAllowedHeroWidth) {
        break;
      }
      heroFontSize = Math.max(14, Math.floor(heroFontSize * (maxAllowedHeroWidth / peakW)));
    }
    const heroFont = `900 ${heroFontSize}px 'Montserrat', 'Impact', 'Anton', sans-serif`;
    if (typeof document !== 'undefined' && document.fonts && document.fonts.load) {
      try { document.fonts.load(heroFont); } catch (_) {}
    }
    ctxFore.font = heroFont;
    const heroMetrics = ctxFore.measureText(displayHeroText);
    const heroW = heroMetrics.width + Math.max(0, displayHeroText.length - 1) * letterSpacing;
    const heroH = heroFontSize * 0.82;
    ctxFore.restore();

    // Horizontal position clamped within safe margins
    let heroX = Math.round((W - heroW) / 2);
    heroX = Math.max(W * BEHIND_SAFE_MARGIN, Math.min(W * (1 - BEHIND_SAFE_MARGIN) - heroW, heroX));

    // ========================================================================
    // VERTICAL PLACEMENT: BELOW (LOWER-THIRD / BOTTOM AREA OF VIDEO)
    // ========================================================================
    const numTopLines = data.topLines ? data.topLines.length : 0;
    const topFontSize = Math.round(W * 0.046);
    const topLineSpacing = topFontSize * 1.30;
    const totalTopH = numTopLines > 0 ? (numTopLines * topLineSpacing + 6) : 0;

    const numBottomLines = data.bottomLines ? data.bottomLines.length : 0;
    const bottomFontSize = Math.round(W * 0.052);
    const bottomLineSpacing = bottomFontSize * 1.30;
    const totalBottomH = numBottomLines > 0 ? (numBottomLines * bottomLineSpacing + 8) : 0;

    // Total block height
    const totalBlockH = totalTopH + heroH + 16 + totalBottomH;

    // Anchor block around 74% down the screen (BELOW), clamped inside safe margins
    let blockTopY = Math.round(H * 0.74 - (totalBlockH * 0.45));
    if (blockTopY + totalBlockH > H * (1 - BEHIND_SAFE_MARGIN)) {
      blockTopY = H * (1 - BEHIND_SAFE_MARGIN) - totalBlockH;
    }
    if (blockTopY < H * 0.45) {
      blockTopY = Math.round(H * 0.45);
    }

    const startTopY = blockTopY;
    const heroY = blockTopY + totalTopH + (totalTopH > 0 ? 6 : 0);
    const startBottomY = heroY + heroH + 16;

    // Floating subtle sine wave
    const floatY = (!showAll) ? Math.sin(stTime * (2 * Math.PI / 2.5)) * 2.5 : 0;

    // Horizontal mirror flip (1 in 8 captions, seeded)
    const hasFlip = (capIdx % 8 === 3) || (seededRandom(capIdx + 77) < 0.125);
    let flipScaleX = 1.0;
    if (hasFlip && !showAll && stTime < 0.08) {
      flipScaleX = -1.0 + 2.0 * (stTime / 0.08);
    }

    // ------------------------------------------------------------------------
    // 1. DRAW TOP LINES (IN FRONT) - ALL WORDS BEFORE HERO
    // ------------------------------------------------------------------------
    if (numTopLines > 0) {
      if (useBigType) {
        const smallFontSize = Math.max(16, Math.round(heroFontSize * 0.32));
        const topLineSpacing = smallFontSize + 14;
        data.topLines.forEach((lineChunk, lineIdx) => {
          const lineText = lineChunk.map(w => w.t || w.word || '').join(' ').toUpperCase();
          const curY = startTopY + lineIdx * topLineSpacing;
          const topAlpha = (showAll ? 1.0 : Math.min(1.0, stTime / 0.12)) * exitAlpha;
          drawBigTypeSmallLine(ctxFore, lineText, W / 2, curY, smallFontSize, W, H, topAlpha);
        });
      } else {
        const topFont = `700 ${topFontSize}px 'Montserrat', 'Poppins', sans-serif`;

        data.topLines.forEach((lineChunk, lineIdx) => {
          const lineText = lineChunk.map(w => w.t || w.word || '').join(' ').toUpperCase();
          targetCtx.save();
          targetCtx.font = topFont;
          const metrics = targetCtx.measureText(lineText);
          const lineW = metrics.width;
          let lineX = Math.round((W - lineW) / 2);
          lineX = Math.max(W * BEHIND_SAFE_MARGIN, Math.min(W * (1 - BEHIND_SAFE_MARGIN) - lineW, lineX));
          const curY = startTopY + lineIdx * topLineSpacing;

          const topAlpha = showAll ? 1.0 : Math.min(1.0, stTime / 0.12) * exitAlpha;
          targetCtx.globalAlpha = topAlpha;

          targetCtx.fillStyle = 'rgba(15, 23, 42, 0.70)';
          const pillPadX = 12;
          const pillPadY = 4;
          targetCtx.beginPath();
          targetCtx.roundRect(lineX - pillPadX, curY - pillPadY, lineW + pillPadX * 2, topFontSize + pillPadY * 2, 6);
          targetCtx.fill();

          targetCtx.textAlign = 'left';
          targetCtx.textBaseline = 'top';
          targetCtx.strokeStyle = 'rgba(0, 0, 0, 0.95)';
          targetCtx.lineWidth = 3;
          targetCtx.lineJoin = 'round';
          targetCtx.shadowColor = 'rgba(0, 0, 0, 0.85)';
          targetCtx.shadowBlur = 6;
          targetCtx.strokeText(lineText, lineX, curY);

          targetCtx.fillStyle = '#FFFFFF';
          targetCtx.fillText(lineText, lineX, curY);
          targetCtx.restore();
        });
      }
    }

    // ------------------------------------------------------------------------
    // 2. DRAW HERO WORD (BEHIND PERSON IF isBehindPerson, ELSE FRONT)
    // ------------------------------------------------------------------------
    const drawCtx = heroTargetCtx;
    drawCtx.save();
    drawCtx.globalAlpha = exitAlpha;

    const heroCenterX = heroX + heroW / 2;
    const heroCenterY = heroY + heroH / 2;
    drawCtx.translate(heroCenterX, heroCenterY + floatY);
    drawCtx.scale(flipScaleX * exitScale, exitScale);
    drawCtx.translate(-heroCenterX, -heroCenterY);

    const heroGrad = drawCtx.createLinearGradient(heroX, heroY, heroX + heroW, heroY + heroH);
    heroGrad.addColorStop(0, data.palette.gradient[0]);
    heroGrad.addColorStop(1, data.palette.gradient[1]);

    if (useBigType && heroMetricsObj) {
      drawBigTypeHeroWord(drawCtx, heroMetricsObj, heroX, heroY, heroGrad, '#111111', exitAlpha, {
        stTime,
        charStagger: Math.min(0.04, 0.25 / Math.max(1, displayHeroText.length)),
        charAnimDur: 0.14,
        showAll
      });
    } else {
      const letters = displayHeroText.split('');
      const charMetrics = [];
      drawCtx.font = heroFont;
      for (let ci = 0; ci < letters.length; ci++) {
        charMetrics.push(drawCtx.measureText(letters[ci]).width);
      }
      const totalCharW = charMetrics.reduce((acc, m) => acc + m, 0) + (letters.length - 1) * letterSpacing;
      let curCharX = Math.round((W - totalCharW) / 2);

      const maxEntranceTotalTime = 0.25;
      const charAnimDur = 0.12;
      const numLetters = Math.max(1, letters.length);
      const charStagger = numLetters > 1 
        ? Math.min(0.03, (maxEntranceTotalTime - charAnimDur) / (numLetters - 1))
        : 0;

      if (!showAll && stTime < GLITCH_DURATION) {
        const glitchP = 1.0 - (stTime / GLITCH_DURATION);
        const maxGlitchOffset = Math.round(18 * glitchP);
        const glitchScrunchScale = 1.0 - (0.08 * glitchP);

        drawCtx.save();
        drawCtx.translate(heroCenterX, heroCenterY);
        drawCtx.scale(glitchScrunchScale, 1.0);
        drawCtx.translate(-heroCenterX, -heroCenterY);

        drawCtx.font = heroFont;
        drawCtx.textAlign = 'left';
        drawCtx.textBaseline = 'top';

        drawCtx.save();
        drawCtx.globalAlpha = 0.35 * glitchP * exitAlpha;
        drawCtx.fillStyle = '#ff0055';
        drawCtx.fillText(displayHeroText, heroX - maxGlitchOffset, heroY);
        drawCtx.restore();

        drawCtx.save();
        drawCtx.globalAlpha = 0.35 * glitchP * exitAlpha;
        drawCtx.fillStyle = '#00f5d4';
        drawCtx.fillText(displayHeroText, heroX + maxGlitchOffset, heroY);
        drawCtx.restore();

        drawCtx.restore();
      }

      drawCtx.textAlign = 'left';
      drawCtx.textBaseline = 'top';
      drawCtx.strokeStyle = 'rgba(0, 0, 0, 0.95)';
      drawCtx.lineWidth = 4;
      drawCtx.lineJoin = 'round';
      drawCtx.shadowColor = 'rgba(0, 0, 0, 0.75)';
      drawCtx.shadowBlur = 12;
      drawCtx.shadowOffsetY = 4;

      for (let ci = 0; ci < letters.length; ci++) {
        const charDelay = ci * charStagger;
        let charYOffset = 0;
        let charAlpha = 1.0;

        if (!showAll && stTime < charDelay + charAnimDur) {
          if (stTime < charDelay) {
            charYOffset = 18;
            charAlpha = 0;
          } else {
            const p = Math.min(1.0, (stTime - charDelay) / charAnimDur);
            charYOffset = (1 - easeOutBack(p)) * 18;
            charAlpha = Math.min(1.0, p * 2.0);
          }
        }

        if (charAlpha > 0) {
          drawCtx.save();
          drawCtx.globalAlpha = exitAlpha * charAlpha;
          drawCtx.strokeText(letters[ci], curCharX, heroY + charYOffset);
          drawCtx.fillStyle = heroGrad;
          drawCtx.fillText(letters[ci], curCharX, heroY + charYOffset);
          drawCtx.restore();
        }
        curCharX += charMetrics[ci] + letterSpacing;
      }
    }

    // Underline swipe (matching measured word width)
    if (!showAll || showAll) {
      const swipeP = showAll ? 1.0 : Math.min(1.0, Math.max(0, stTime / 0.20));
      const maxUnderlineW = Math.min(heroW, (W * (1 - BEHIND_SAFE_MARGIN)) - heroX);
      const barW = Math.max(0, maxUnderlineW * swipeP);
      drawCtx.save();
      drawCtx.shadowColor = data.palette.accent;
      drawCtx.shadowBlur = 8;
      drawCtx.fillStyle = data.palette.accent;
      drawCtx.fillRect(heroX, heroY + heroH + 6, barW, Math.max(3, Math.round(H * 0.005)));
      drawCtx.restore();
    }

    drawCtx.restore();

    // ------------------------------------------------------------------------
    // 3. DRAW BOTTOM LINES (IN FRONT) - ALL WORDS AFTER HERO
    // ------------------------------------------------------------------------
    if (numBottomLines > 0) {
      if (useBigType) {
        const smallFontSize = Math.max(16, Math.round(heroFontSize * 0.32));
        const bottomLineSpacing = smallFontSize + 14;
        data.bottomLines.forEach((lineChunk, lineIdx) => {
          const lineText = lineChunk.map(w => w.t || w.word || '').join(' ').toUpperCase();
          const curLineY = startBottomY + lineIdx * bottomLineSpacing;
          const lineAlpha = (showAll ? 1.0 : Math.min(1.0, stTime / 0.12)) * exitAlpha;
          drawBigTypeSmallLine(ctxFore, lineText, W / 2, curLineY, smallFontSize, W, H, lineAlpha);
        });
      } else {
        const bottomFont = `800 ${bottomFontSize}px 'Montserrat', 'Poppins', sans-serif`;

        data.bottomLines.forEach((lineChunk, lineIdx) => {
          const lineText = lineChunk.map(w => w.t || w.word || '').join(' ').toUpperCase();
          targetCtx.save();
          targetCtx.font = bottomFont;
          const metrics = targetCtx.measureText(lineText);
          const lineW = metrics.width;
          let lineX = Math.round((W - lineW) / 2);
          lineX = Math.max(W * BEHIND_SAFE_MARGIN, Math.min(W * (1 - BEHIND_SAFE_MARGIN) - lineW, lineX));

          const lineStart = lineIdx * 0.04;
          let lineAlpha = 1.0;
          let lineYOffset = 0;

          if (!showAll && stTime < lineStart + 0.12) {
            if (stTime < lineStart) {
              lineAlpha = 0;
              lineYOffset = 12;
            } else {
              const p = Math.min(1.0, (stTime - lineStart) / 0.12);
              lineAlpha = p;
              lineYOffset = (1 - easeOutQuad(p)) * 12;
            }
          }

          const curLineY = startBottomY + lineIdx * bottomLineSpacing + lineYOffset;

          if (lineAlpha > 0) {
            targetCtx.globalAlpha = lineAlpha * exitAlpha;

            targetCtx.fillStyle = 'rgba(15, 23, 42, 0.75)';
            const bPadX = 14;
            const bPadY = 5;
            targetCtx.beginPath();
            targetCtx.roundRect(lineX - bPadX, curLineY - bPadY, lineW + bPadX * 2, bottomFontSize + bPadY * 2, 8);
            targetCtx.fill();

            targetCtx.textAlign = 'left';
            targetCtx.textBaseline = 'top';
            targetCtx.strokeStyle = 'rgba(0, 0, 0, 0.95)';
            targetCtx.lineWidth = 3;
            targetCtx.lineJoin = 'round';
            targetCtx.shadowColor = 'rgba(0, 0, 0, 0.85)';
            targetCtx.shadowBlur = 6;
            targetCtx.strokeText(lineText, lineX, curLineY);

            targetCtx.fillStyle = '#FFFFFF';
            targetCtx.fillText(lineText, lineX, curLineY);
          }

          targetCtx.restore();
        });
      }
    }

    // 1. Lower Third (First 3.0 seconds) - Only drawn if presenter name is typed
    const presName = (cfg.presenterName || '').trim();
    if (cfg.lowerThird !== false && presName.length > 0 && t >= 0.25 && t <= 2.90) {
      let ltAlpha = 1.0;
      let ltSlideY = 0;
      if (t < 0.60) {
        const pIn = (t - 0.25) / 0.35;
        ltAlpha = Math.min(1, Math.max(0, pIn));
        ltSlideY = (1 - easeOutQuad(pIn)) * 30;
      } else if (t > 2.50) {
        const pOut = (t - 2.50) / 0.40;
        ltAlpha = Math.max(0, 1 - pOut);
        ltSlideY = pOut * 20;
      }

      ctx.save();
      ctx.globalAlpha = ltAlpha;

      const ltW = Math.round(W * 0.75);
      const ltH = Math.round(H * 0.08);
      const ltX = Math.round(W * 0.08);
      const ltY = Math.round(H * 0.84 + ltSlideY);

      // Dark glass container
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.roundRect(ltX, ltY, ltW, ltH, 12);
      ctx.fill();

      // Gold/Cyan accent bar
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.roundRect(ltX + 3, ltY + 8, 4, ltH - 16, 2);
      ctx.fill();

      // Presenter Name
      const presName = (cfg.presenterName || 'Alex Rivera').trim();
      const presRole = (cfg.presenterRole || 'Luxury Real Estate Specialist').trim();

      ctx.shadowColor = 'transparent';
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `800 ${Math.round(ltH * 0.38)}px 'Montserrat', sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(presName, ltX + 18, ltY + Math.round(ltH * 0.16));

      // Presenter Role
      ctx.fillStyle = '#fde047';
      ctx.font = `600 ${Math.round(ltH * 0.26)}px 'Montserrat', sans-serif`;
      ctx.fillText(presRole, ltX + 18, ltY + Math.round(ltH * 0.58));

      ctx.restore();
    }

    // 2. Location Tag (Top Left)
    if (cfg.locationTag) {
      const cityText = getDetectedCityLocation();
      const pulse = 1.0 + 0.035 * Math.sin(t * (2 * Math.PI / 3.0));

      ctx.save();
      const tagFontSize = Math.round(W * 0.028);
      ctx.font = `700 ${tagFontSize}px 'Montserrat', sans-serif`;
      const textMetrics = ctx.measureText(cityText);
      const tagW = textMetrics.width + 36;
      const tagH = tagFontSize + 16;
      const tagX = Math.round(W * 0.08);
      const tagY = Math.round(H * 0.08);

      ctx.translate(tagX + tagW / 2, tagY + tagH / 2);
      ctx.scale(pulse, pulse);
      ctx.translate(-(tagX + tagW / 2), -(tagY + tagH / 2));

      // Glass pill
      ctx.fillStyle = 'rgba(15, 23, 42, 0.80)';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.roundRect(tagX, tagY, tagW, tagH, tagH / 2);
      ctx.fill();

      // Vector Pin Icon
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      const pinX = tagX + 14;
      const pinY = tagY + tagH / 2;
      ctx.arc(pinX, pinY - 2, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(pinX - 4, pinY - 2);
      ctx.lineTo(pinX, pinY + 5);
      ctx.lineTo(pinX + 4, pinY - 2);
      ctx.fill();

      // Location Text
      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(cityText, tagX + 24, tagY + tagH / 2);

      ctx.restore();
    }
  }


function drawCanvasTypography(ctxFore, ctxBehind, cap, words, t, st, W, H, isBehind, showAll, isPreview = false) {
  if (!ctxFore) return;
  if (st && (st.videoTemplate === 'popStudio' || (S.popStudioConfig && S.popStudioConfig.enabled))) {
    return;
  }

  // B3 Export Parity: Caption manual positioning & scale (ratio offsets relative to W, H)
  const capDx = (Number(cap && cap.dx) || 0) * W;
  const capDy = (Number(cap && cap.dy) || 0) * H;
  const capScale = (cap && typeof cap.scale === 'number' && cap.scale > 0) ? cap.scale : 1.0;
  const hasCapTransform = capDx !== 0 || capDy !== 0 || capScale !== 1.0;

  if (hasCapTransform) {
    const origCx = W * 0.5;
    const origCy = H * (Number(st && (st.position || st.posY)) || 0.65);
    ctxFore.save();
    ctxFore.translate(origCx + capDx, origCy + capDy);
    ctxFore.scale(capScale, capScale);
    ctxFore.translate(-origCx, -origCy);
    if (ctxBehind && ctxBehind !== ctxFore) {
      ctxBehind.save();
      ctxBehind.translate(origCx + capDx, origCy + capDy);
      ctxBehind.scale(capScale, capScale);
      ctxBehind.translate(-origCx, -origCy);
    }
  }

  try {
    if (st && (st.videoTemplate === 'specialRealEstate' || (S.realEstateConfig && S.realEstateConfig.enabled))) {
      drawSpecialRealEstateTemplate(ctxFore, ctxBehind, cap, words, t, st, W, H, isBehind, showAll, isPreview);
    } else {
      const base = Math.max(260, Math.min(W, H)) * Math.max(0.7, Math.min(1.5, Number(st.fontScale) || 1));
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
  } finally {
    if (hasCapTransform) {
      if (ctxBehind && ctxBehind !== ctxFore) ctxBehind.restore();
      ctxFore.restore();
    }
  }

  // Layout boxes recording for tap-to-edit hit-testing
  try {
    recordCaptionLayoutBox(cap, words, st, W, H, capDx, capDy, capScale);
  } catch (err) {
    // Keep playback and export functioning even if bounding box recorder throws
  }
}

// Preview caption controls: drag to position, wheel/trackpad to resize.



  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================

  // ==========================================================================
  // AUTHENTICATION & PROJECT SAVE / LOAD SUITE
  // ==========================================================================
  function syncUserUI() {
    const user = S.user;
    const homePill = $('homeUserPill');
    const homeAvatar = $('homeUserAvatar');
    const homeName = $('homeUserName');
    const btnHomeLogin = $('btnHomeLogin');

    const editorPill = $('editorUserPill');
    const editorAvatar = $('editorUserAvatar');
    const editorName = $('editorUserName');
    const btnEditorLogin = $('btnEditorLogin');

    if (user && user.name) {
      if (homePill) homePill.classList.remove('hidden');
      if (btnHomeLogin) btnHomeLogin.classList.add('hidden');
      if (homeAvatar) homeAvatar.src = user.picture || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.id || 'creator'}`;
      if (homeName) homeName.textContent = user.name.split(' ')[0];

      if (editorPill) editorPill.classList.remove('hidden');
      if (btnEditorLogin) btnEditorLogin.classList.add('hidden');
      if (editorAvatar) editorAvatar.src = user.picture || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.id || 'creator'}`;
      if (editorName) editorName.textContent = user.name.split(' ')[0];
    } else {
      if (homePill) homePill.classList.add('hidden');
      if (btnHomeLogin) btnHomeLogin.classList.remove('hidden');

      if (editorPill) editorPill.classList.add('hidden');
      if (btnEditorLogin) btnEditorLogin.classList.remove('hidden');
    }
  }

  function setupAuthHandlers() {
    try {
      const stored = localStorage.getItem('cs_user');
      if (stored) S.user = JSON.parse(stored);
    } catch (_) {}
    syncUserUI();

    const modalLogin = $('modalLogin');
    const btnCloseLogin = $('btnCloseLoginModal');
    const btnHomeLogin = $('btnHomeLogin');
    const btnEditorLogin = $('btnEditorLogin');
    const btnHomeLogout = $('btnHomeLogout');
    const btnEditorLogout = $('btnEditorLogout');
    const btnGoogleAuth = $('btnGoogleAuth');
    const quickLoginForm = $('quickLoginForm');

    const openLogin = () => { if (modalLogin) modalLogin.classList.remove('hidden'); };
    const closeLogin = () => { if (modalLogin) modalLogin.classList.add('hidden'); };

    if (btnHomeLogin) btnHomeLogin.addEventListener('click', openLogin);
    if (btnEditorLogin) btnEditorLogin.addEventListener('click', openLogin);
    if (btnCloseLogin) btnCloseLogin.addEventListener('click', closeLogin);

    const logout = () => {
      S.user = null;
      try { localStorage.removeItem('cs_user'); } catch (_) {}
      S.credits = 0;
      syncUserUI();
      updateCreditsUI();
      showToast('👋 Logged out');
    };
    if (btnHomeLogout) btnHomeLogout.addEventListener('click', logout);
    if (btnEditorLogout) btnEditorLogout.addEventListener('click', logout);

    if (quickLoginForm) {
      quickLoginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = ($('inputLoginEmail') && $('inputLoginEmail').value.trim().toLowerCase()) || '';
        const name = ($('inputLoginName') && $('inputLoginName').value.trim()) || (email.split('@')[0] || 'Creator');
        if (!email || !email.includes('@') || !email.includes('.')) {
          showToast('Please enter a valid Gmail / Email address!');
          return;
        }
        try {
          const res = await fetch('/api/auth/google', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name,
              email,
              client_credits: S.credits,
              free_used: S.credits === 0 && localStorage.getItem('cs_free_used') === 'true'
            })
          });
          const data = await res.json();
          if (!res.ok || !data.ok) {
            throw new Error(data.error || 'Login failed. Please use your valid Gmail.');
          }
          if (data.ok && data.user) {
            S.user = data.user;
            try { localStorage.setItem('cs_user', JSON.stringify(S.user)); } catch (_) {}
            // Sync exact server credits for this user across any device
            if (typeof data.credits === 'number') {
              saveUserCredits(data.credits);
            }
            syncUserUI();
            updateCreditsUI();
            closeLogin();
            showToast('🎉 Welcome, ' + S.user.name + '!');
            if (S.pendingExportAfterLogin) {
              S.pendingExportAfterLogin = false;
              setTimeout(() => startExport(), 400);
            }
          }
        } catch (err) {
          showToast(err.message || 'Login error');
        }
      });
    }

    if (btnGoogleAuth) {
      btnGoogleAuth.addEventListener('click', () => {
        if (window.google && window.google.accounts && window.google.accounts.id) {
          window.google.accounts.id.prompt((notification) => {
            if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
              // If One Tap is suppressed, click the rendered official Google button
              const renderedBtn = document.querySelector('#googleOfficialBtn div[role="button"]');
              if (renderedBtn) renderedBtn.click();
            }
          });
        } else {
          showToast('Google Sign-In is loading, please wait 2 seconds...');
        }
      });
    }

    const REAL_GOOGLE_CLIENT_ID = '799671274857-1uje4vg6uavppt1cb37fapudick0to29.apps.googleusercontent.com';

    function initGoogleAuth() {
      if (!window.google || !window.google.accounts || !window.google.accounts.id) return;
      try {
        window.google.accounts.id.initialize({
          client_id: REAL_GOOGLE_CLIENT_ID,
          callback: handleGoogleCredentialResponse,
          auto_select: false
        });

        const btnContainer = $('googleOfficialBtn');
        if (btnContainer) {
          btnContainer.innerHTML = '';
          window.google.accounts.id.renderButton(btnContainer, {
            theme: 'filled_blue',
            size: 'large',
            shape: 'rectangular',
            width: 300,
            text: 'continue_with'
          });
        }
      } catch (err) {
        console.warn('Google Auth init warning:', err);
      }
    }

    initGoogleAuth();
    // In case script loads async
    window.addEventListener('load', () => setTimeout(initGoogleAuth, 500));
  }

  function handleGoogleCredentialResponse(response) {
    if (!response || !response.credential) return;
    try {
      const base64Url = response.credential.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
      const payload = JSON.parse(jsonPayload);

      fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: payload.sub,
          email: payload.email,
          name: payload.name,
          picture: payload.picture,
          client_credits: S.credits,
          free_used: S.credits === 0 && localStorage.getItem('cs_free_used') === 'true'
        })
      }).then(r => r.json()).then(data => {
        if (data.ok && data.user) {
          S.user = data.user;
          try { localStorage.setItem('cs_user', JSON.stringify(S.user)); } catch (_) {}
          // Sync exact server credits for this Gmail account across any device
          if (typeof data.credits === 'number') {
            saveUserCredits(data.credits);
          }
          syncUserUI();
          updateCreditsUI();
          const modalLogin = $('modalLogin');
          if (modalLogin) modalLogin.classList.add('hidden');
          showToast('🎉 Signed in as ' + S.user.name);
          if (S.pendingExportAfterLogin) {
            S.pendingExportAfterLogin = false;
            setTimeout(() => startExport(), 400);
          }
        }
      });
    } catch (e) {
      console.warn('Google credential decode error:', e);
    }
  }

  function setupProjectHandlers() {
    const btnSave = $('btnSaveProject');
    const btnHomeProjects = $('btnHomeProjects');
    const btnEditorProjects = $('btnEditorProjects');
    const modalProjects = $('modalProjects');
    const btnCloseProjects = $('btnCloseProjectsModal');

    const openProjectsModal = async () => {
      if (!modalProjects) return;
      modalProjects.classList.remove('hidden');
      renderProjectsList();
    };

    if (btnHomeProjects) btnHomeProjects.addEventListener('click', openProjectsModal);
    if (btnEditorProjects) btnEditorProjects.addEventListener('click', openProjectsModal);
    if (btnCloseProjects) btnCloseProjects.addEventListener('click', () => modalProjects.classList.add('hidden'));

    if (btnSave) {
      btnSave.addEventListener('click', async () => {
        if (!S.captions || !S.captions.length) {
          showToast('⚠️ No captions to save yet!');
          return;
        }

        const defaultName = S.filename ? S.filename.replace(/\.[^/.]+$/, '') : 'Untitled Project';
        const projName = prompt('Enter a name for this project:', defaultName) || defaultName;

        btnSave.disabled = true;
        btnSave.textContent = '⏳ Saving...';

        try {
          const payload = {
            id: S.currentProjectId || ('proj_' + Date.now()),
            name: projName,
            filename: S.filename,
            captions: S.captions,
            style: S.style,
            aspect: S.aspect,
            watermark: S.watermark,
            user_id: S.user ? S.user.id : null,
            user_email: S.user ? S.user.email : null
          };

          const res = await fetch('/api/project/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const data = await res.json();
          if (data.ok) {
            S.currentProjectId = data.id;
            showToast('💾 Project "' + data.name + '" saved successfully!');
          }
        } catch (err) {
          showToast('Save failed: ' + err.message);
        } finally {
          btnSave.disabled = false;
          btnSave.textContent = '💾 Save';
        }
      });
    }
  }

  async function renderProjectsList() {
    const list = $('projectsList');
    if (!list) return;
    list.innerHTML = '<p style="color:#94a3b8; text-align:center; padding:20px;">Loading projects...</p>';

    try {
      const url = S.user ? `/api/project/list?user_id=${encodeURIComponent(S.user.id)}` : '/api/project/list';
      const res = await fetch(url);
      const data = await res.json();
      const projs = data.projects || [];

      if (!projs.length) {
        list.innerHTML = `
          <div style="text-align:center; padding:30px 10px; color:#94a3b8;">
            <div style="font-size:32px; margin-bottom:8px;">📁</div>
            <strong style="color:#fff; display:block; margin-bottom:4px;">No saved projects yet</strong>
            <p style="font-size:12px;">Create captions for a video and click "💾 Save" in the top bar!</p>
          </div>
        `;
        return;
      }

      list.innerHTML = '';
      projs.forEach(p => {
        const card = document.createElement('div');
        card.className = 'project-card';
        const dateStr = p.updated ? new Date(p.updated * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
        card.innerHTML = `
          <div class="project-info">
            <div class="project-title">${escapeHtml(p.name)}</div>
            <div class="project-meta">📄 ${p.lines || 0} lines &bull; ${escapeHtml(p.filename || 'video')} &bull; ${dateStr}</div>
          </div>
          <div class="project-actions">
            <button type="button" class="btn-open-proj">Open</button>
            <button type="button" class="btn-del-proj" title="Delete project">&times;</button>
          </div>
        `;

        card.querySelector('.btn-open-proj').addEventListener('click', async () => {
          loadProject(p.id);
        });

        card.querySelector('.btn-del-proj').addEventListener('click', async (e) => {
          e.stopPropagation();
          if (confirm(`Delete project "${p.name}"?`)) {
            await fetch(`/api/project/${encodeURIComponent(p.id)}`, { method: 'DELETE' });
            showToast('🗑️ Project deleted');
            renderProjectsList();
          }
        });

        list.appendChild(card);
      });
    } catch (err) {
      list.innerHTML = `<p style="color:#ef4444; padding:20px;">Error loading projects: ${err.message}</p>`;
    }
  }

  async function loadProject(pid) {
    try {
      showToast('⏳ Loading project...');
      const res = await fetch(`/api/project/${encodeURIComponent(pid)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Project not found');

      S.currentProjectId = data.id;
      if (data.captions) S.captions = normalizeCaptions(data.captions);
      if (data.style) S.style = data.style;
      if (data.aspect) S.aspect = data.aspect;
      if (data.watermark) S.watermark = data.watermark;
      if (data.filename) {
        S.filename = data.filename;
        headerFileName.textContent = data.filename;
      }

      viewUpload.classList.add('hidden');
      viewEditor.classList.remove('hidden');

      renderCaptionsList();
      renderTimeline();
      renderCanvas();

      const modalProjects = $('modalProjects');
      if (modalProjects) modalProjects.classList.add('hidden');

      showToast(`✓ Opened project "${data.name}"!`);
    } catch (err) {
      showToast('Error opening project: ' + err.message);
    }
  }


  // ==========================================================================
  // INSTAGRAM VIP COUPON & EXPORT CREDITS SYSTEM
  // ==========================================================================
  function saveUserCredits(val) {
    const num = Math.max(0, parseInt(val, 10) || 0);
    S.credits = num;
    localStorage.setItem('cs_credits', String(num));
    const userEmail = S.user ? (S.user.email || '').trim().toLowerCase() : '';
    if (userEmail) {
      try {
        localStorage.setItem('cs_credits_' + userEmail, String(num));
      } catch (_) {}
    }
    if (num === 0) {
      localStorage.setItem('cs_free_used', 'true');
      if (userEmail) {
        try { localStorage.setItem('cs_free_used_' + userEmail, 'true'); } catch (_) {}
      }
    } else {
      // User has positive credits! Clear free_used flags so refresh never wipes valid credits
      localStorage.removeItem('cs_free_used');
      if (userEmail) {
        try { localStorage.removeItem('cs_free_used_' + userEmail); } catch (_) {}
      }
    }
  }

  function deductCreditAfterExport() {
    saveUserCredits(Math.max(0, S.credits - 1));
    updateCreditsUI();

    const devId = localStorage.getItem('cs_device_id');
    const userEmail = S.user ? (S.user.email || '').trim().toLowerCase() : '';
    const userName = S.user ? (S.user.name || '') : '';
    if (devId || userEmail) {
      fetch('/api/credits/consume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: devId,
          email: userEmail,
          name: userName
        })
      }).catch(() => {});
    }
  }

  function updateCreditsUI() {
    const pill = $('creditPill');
    const countSpan = $('creditCount');
    const sidebarCredits = $('sidebarCreditsCount');

    let text = `${S.credits} Credits (${S.credits} Exports)`;
    if (S.credits <= 0) text = '0 Credits (Recharge to Export)';
    else if (S.credits === 1) text = '1 Credit (1 Video Export)';

    if (sidebarCredits) sidebarCredits.textContent = text;

    if (pill && countSpan) {
      if (S.credits <= 0) {
        pill.classList.add('credit-zero');
        countSpan.textContent = '🔒 0 Credits (Recharge)';
      } else {
        pill.classList.remove('credit-zero');
        countSpan.textContent = text;
      }
    }
  }

  function openCouponModal() {
    const modalCoupon = $('modalCoupon');
    if (modalCoupon) {
      modalCoupon.classList.remove('hidden');
      const input = $('inputCouponCode');
      if (input) {
        input.value = '';
        setTimeout(() => input.focus(), 100);
      }
      const msg = $('couponMsg');
      if (msg) msg.classList.add('hidden');
    }
  }

  function setupCouponHandlers() {
    // Persistent Device Fingerprint (cannot be bypassed by simple page refresh)
    let deviceId = localStorage.getItem('cs_device_id');
    if (!deviceId) {
      deviceId = 'dev_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36);
      localStorage.setItem('cs_device_id', deviceId);
    }

    // Load credits strictly linked to Gmail/Account if logged in
    const userEmail = S.user ? (S.user.email || '').trim().toLowerCase() : '';
    const userCreditKey = userEmail ? ('cs_credits_' + userEmail) : 'cs_credits';
    const freeUsedKey = userEmail ? ('cs_free_used_' + userEmail) : 'cs_free_used';

    const savedUserVal = userEmail ? localStorage.getItem(userCreditKey) : null;
    const savedGlobalVal = localStorage.getItem('cs_credits');

    let savedCredits = null;
    if (savedUserVal !== null && !isNaN(parseInt(savedUserVal, 10))) {
      savedCredits = parseInt(savedUserVal, 10);
    }
    if (savedGlobalVal !== null && !isNaN(parseInt(savedGlobalVal, 10))) {
      const gVal = parseInt(savedGlobalVal, 10);
      savedCredits = (savedCredits !== null) ? Math.max(savedCredits, gVal) : gVal;
    }

    let hasUsedFree = localStorage.getItem(freeUsedKey) === 'true' || localStorage.getItem('cs_free_used') === 'true';

    if (savedCredits !== null && savedCredits >= 0) {
      S.credits = savedCredits;
      if (savedCredits > 0) {
        hasUsedFree = false;
        localStorage.removeItem('cs_free_used');
        if (userEmail) {
          try { localStorage.removeItem(freeUsedKey); } catch (_) {}
        }
      }
    } else if (hasUsedFree) {
      S.credits = 0;
    } else {
      S.credits = 1;
      saveUserCredits(1);
    }
    updateCreditsUI();

    // Enforce 1-Free-Export per Gmail/Device with authoritative server sync
    const checkPayload = {
      device_id: deviceId,
      email: userEmail,
      user_id: S.user ? S.user.id : null,
      client_credits: S.credits,
      free_used: (S.credits === 0 && hasUsedFree)
    };

    fetch('/api/credits/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(checkPayload)
    }).then(r => r.json()).then(data => {
      if (typeof data.credits === 'number') {
        const serverCredits = Math.max(0, data.credits);
        // If client has more valid credits than server (e.g. server restarted),
        // PRESERVE the client's credits and sync them up to the server!
        if (S.credits > serverCredits) {
          saveUserCredits(S.credits);
          fetch('/api/credits/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ device_id: deviceId, email: userEmail, credits: S.credits })
          }).catch(() => {});
        } else if (serverCredits > S.credits) {
          saveUserCredits(serverCredits);
        } else {
          saveUserCredits(serverCredits);
        }
        updateCreditsUI();
      }
    }).catch(e => console.warn('Credit check notice:', e));

    const pill = $('creditPill');
    const modalCoupon = $('modalCoupon');
    const btnCloseCoupon = $('btnCloseCouponModal');
    const btnRedeem = $('btnRedeemCoupon');
    const inputCode = $('inputCouponCode');
    const msg = $('couponMsg');

    if (pill) pill.addEventListener('click', openCouponModal);
    if (btnCloseCoupon && modalCoupon) {
      btnCloseCoupon.addEventListener('click', () => modalCoupon.classList.add('hidden'));
      modalCoupon.addEventListener('click', (e) => {
        if (e.target === modalCoupon) modalCoupon.classList.add('hidden');
      });
    }

    const redeemAction = async () => {
      const code = (inputCode && inputCode.value.trim().toUpperCase()) || '';
      if (!code) {
        if (msg) {
          msg.textContent = 'Please enter a coupon code.';
          msg.className = 'coupon-msg error';
          msg.classList.remove('hidden');
        }
        return;
      }

      btnRedeem.disabled = true;
      btnRedeem.textContent = 'Verifying...';
      if (msg) msg.classList.add('hidden');

      try {
        let deviceId = localStorage.getItem('cs_device_id');
        if (!deviceId) {
          deviceId = 'dev_' + Math.random().toString(36).slice(2, 10);
          localStorage.setItem('cs_device_id', deviceId);
        }

        const userEmail = S.user ? (S.user.email || '').trim().toLowerCase() : '';
        const res = await fetch('/api/coupons/redeem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: code,
            user_id: S.user ? S.user.id : null,
            email: userEmail,
            device_id: deviceId
          })
        });

        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error || 'Invalid code');
        }

        const newBalance = typeof data.total_credits === 'number' ? data.total_credits : ((S.credits || 0) + (data.added_credits || 10));
        saveUserCredits(newBalance);
        updateCreditsUI();

        if (msg) {
          msg.textContent = data.message || `🎉 ${data.added_credits} Free Exports unlocked!`;
          msg.className = 'coupon-msg success';
          msg.classList.remove('hidden');
        }

        showToast(`🎉 ${data.added_credits} Free Exports unlocked!`);

        setTimeout(() => {
          if (modalCoupon) modalCoupon.classList.add('hidden');
          if (S.pendingExportAfterCoupon) {
            S.pendingExportAfterCoupon = false;
            startExport();
          }
        }, 1200);

      } catch (err) {
        if (msg) {
          msg.textContent = err.message || 'Invalid coupon code.';
          msg.className = 'coupon-msg error';
          msg.classList.remove('hidden');
        }
      } finally {
        btnRedeem.disabled = false;
        btnRedeem.textContent = 'Redeem';
      }
    };

    if (btnRedeem) btnRedeem.addEventListener('click', redeemAction);
    if (inputCode) {
      inputCode.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          redeemAction();
        }
      });
    }

    // Razorpay Integration Handlers
    const launchRazorpayCheckout = async (packId) => {
      try {
        if (typeof window.Razorpay === 'undefined') {
          showToast('Payment gateway loading... please retry in 2 seconds.');
          return;
        }

        let devId = localStorage.getItem('cs_device_id');
        if (!devId) {
          devId = 'dev_' + Math.random().toString(36).slice(2, 10);
          localStorage.setItem('cs_device_id', devId);
        }

        const userEmail = S.user ? (S.user.email || '') : '';
        const userName = S.user ? (S.user.name || '') : '';

        // 1. Create Order on backend
        const orderRes = await fetch('/api/payment/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pack_id: packId,
            device_id: devId,
            email: userEmail,
            name: userName
          })
        });

        const orderData = await orderRes.json();
        if (!orderRes.ok || !orderData.ok) {
          throw new Error(orderData.error || 'Failed to initialize payment');
        }

        // 2. Open official Razorpay Checkout Modal
        const options = {
          key: orderData.key_id,
          amount: orderData.amount,
          currency: orderData.currency || 'INR',
          name: 'HLO-CAPTIONS PRO',
          description: orderData.pack ? orderData.pack.title : 'Video Export Pass',
          order_id: orderData.order_id,
          theme: {
            color: '#a855f7'
          },
          prefill: {
            name: userName || '',
            email: userEmail || '',
            contact: ''
          },
          handler: async function (response) {
            // 3. Verify Payment Signature on Backend
            try {
              showToast('Verifying payment... ⏳');
              const verifyRes = await fetch('/api/payment/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  pack_id: packId,
                  device_id: devId,
                  email: userEmail,
                  name: userName
                })
              });

              const verifyData = await verifyRes.json();
              if (!verifyRes.ok || !verifyData.ok) {
                throw new Error(verifyData.error || 'Payment verification failed');
              }

              // Update Credits in UI
              const newBalance = verifyData.total_credits || ((S.credits || 0) + (verifyData.credits_added || 1));
              saveUserCredits(newBalance);
              updateCreditsUI();

              showToast(`🎉 Payment Successful! ${verifyData.credits_added} Video Exports unlocked.`);

              if (modalCoupon) modalCoupon.classList.add('hidden');

              // Automatically continue export if user was waiting
              if (S.pendingExportAfterCoupon) {
                S.pendingExportAfterCoupon = false;
                setTimeout(() => startExport(), 500);
              }

            } catch (err) {
              console.error('Payment verify error:', err);
              showToast('Verification failed: ' + err.message);
            }
          },
          modal: {
            ondismiss: function () {
              console.log('Razorpay modal dismissed by user');
            }
          }
        };

        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', function (response) {
          showToast('Payment failed: ' + (response.error.description || 'Transaction cancelled'));
        });
        rzp.open();

      } catch (err) {
        console.error('Razorpay launch error:', err);
        showToast('Payment error: ' + err.message);
      }
    };

    const btnPay10 = $('btnPayPack10');
    const btnPay50 = $('btnPayPack50');

    if (btnPay10) btnPay10.addEventListener('click', () => launchRazorpayCheckout('pack10'));
    if (btnPay50) btnPay50.addEventListener('click', () => launchRazorpayCheckout('pack50'));
  }

  async function init() {
    setupUploadHandlers();
    setupTransportHandlers();
    setupTimelineHandlers();
    setupVideoOverlayInteractions();
    setupTimelineActionBar();
    setupCaptionEditSheet();
    setupTemplateSearch();
    setupDrawerAndNavHandlers();
    setupStyleHandlers();
    setupAudioHandlers();
    setupBrollHandlers();
    setupModalHandlers();
    setupCanvasSizing();
    setupCaptionDragging();
    startKeepAliveHeartbeat();
    setupAuthHandlers();
    setupProjectHandlers();
    setupCouponHandlers();

    await loadPresets();
  }

  function startKeepAliveHeartbeat() {
    // Keep-alive heartbeat: ping server every 8 minutes so server never sleeps while tab is open
    setInterval(() => {
      fetch('/api/ping', { cache: 'no-store' }).catch(() => {});
    }, 8 * 60 * 1000);
  }

  // ==========================================================================
  // LOAD PRESETS FROM SERVER + MERGE LOCAL CS_PRESETS (DUO PACK)
  // ==========================================================================
    function createFrontShowcaseCard(preset) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'front-preset-card' + (S.style?.id === preset.id ? ' active' : '');
    card.setAttribute('aria-pressed', String(S.style?.id === preset.id));
    card.setAttribute('aria-label', `Choose ${preset.name}`);
    card.setAttribute('data-id', preset.id);

    const kRole = preset.key || preset.roles?.accent || {};
    const color = preset.highlightColor || kRole.color || '#FFE600';
    const font = kRole.font || 'Poppins';
    const isItalic = kRole.italic ? 'italic' : 'normal';
    const weight = kRole.bold !== false ? '900' : '700';
    const textTransform = kRole.upper !== false ? 'uppercase' : 'none';

    // Unique preview word
    let previewWord = preset.previewWord || '';
    if (!previewWord) {
      previewWord = (preset.name || 'VIRAL')
        .replace(/^Duo\s*[·-]\s*/i, '')
        .replace(/[^\w\s]/gi, '')
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .join(' ');
    }
    if (!previewWord) previewWord = 'VIRAL POP';

    // Category badge tag
    let tag = preset.badge || '';
    if (!tag) {
      if (preset.isDuo || preset.category === 'duo') tag = '⚡ DUO';
      else if (preset.category === 'real-estate') tag = '👑 ESTATE';
      else if (preset.name?.toLowerCase().includes('box') || preset.pill) tag = '📦 BOX';
      else if (preset.name?.toLowerCase().includes('neon') || preset.name?.toLowerCase().includes('glow')) tag = '✨ NEON';
      else if (preset.category === 'colourful') tag = '🌈 COLOR';
      else tag = (preset.category || 'POP').toUpperCase();
    }

    const isBehind = Boolean(
      preset.depthAccent ||
      preset.behindPerson ||
      (preset.roles && preset.roles.accent && preset.roles.accent.layer === 'behind') ||
      (preset.name && preset.name.toLowerCase().includes('(behind)'))
    );
    if (isBehind) tag = '👑 BEHIND';

    // Visual Art Container
    const art = document.createElement('div');
    art.className = 'front-card-art';

    const tagSpan = document.createElement('span');
    tagSpan.className = 'front-card-tag';
    tagSpan.style.background = `${color}25`;
    tagSpan.style.color = color;
    tagSpan.style.borderColor = `${color}44`;
    tagSpan.textContent = tag;
    art.appendChild(tagSpan);

    if (preset.isDuo) {
      const small = document.createElement('span');
      small.className = 'front-card-small';
      small.textContent = 'SOME MOMENTS';
      art.appendChild(small);
    }

    const big = document.createElement('strong');
    big.className = 'front-card-big';
    big.textContent = previewWord;
    big.style.fontFamily = `'${font}', sans-serif`;
    big.style.fontStyle = isItalic;
    big.style.fontWeight = weight;
    big.style.textTransform = textTransform;

    const paint = kRole.keyGradient || kRole.color || preset.highlightColor || color;
    if (preset.pill) {
      big.style.background = preset.pill;
      big.style.padding = '3px 8px';
      big.style.borderRadius = '5px';
      big.style.color = '#000';
    } else if (paint && paint.startsWith('linear-gradient(')) {
      big.style.backgroundImage = paint;
      big.style.webkitBackgroundClip = 'text';
      big.style.backgroundClip = 'text';
      big.style.color = 'transparent';
    } else {
      big.style.color = color;
      if (kRole.glow || preset.glow) {
        big.style.textShadow = `0 0 10px ${kRole.glow || color}88`;
      }
    }
    art.appendChild(big);

    // Name & Selected Check
    const nameRow = document.createElement('div');
    nameRow.className = 'front-card-name-row';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'front-card-name';
    nameSpan.textContent = preset.name.replace(/^Duo\s*[·-]\s*/i, '');

    const checkSpan = document.createElement('span');
    checkSpan.className = 'front-card-check';
    checkSpan.textContent = '✓';

    nameRow.append(nameSpan, checkSpan);
    card.append(art, nameRow);

    card.addEventListener('click', () => {
      applyPreset(preset, false);
      const selName = $('frontSelectedName') || $('duoSelectedName');
      if (selName) selName.textContent = preset.name.replace(/^Duo\s*[·-]\s*/i, '');
      $$('.front-preset-card').forEach(c => {
        const isActive = c.getAttribute('data-id') === preset.id;
        c.classList.toggle('active', isActive);
        c.setAttribute('aria-pressed', String(isActive));
      });
    });

    return card;
  }

  function renderFrontShowcasePresets(filterCat = 'all') {
    const grid = $('frontPresetGrid') || $('duoPresetGrid');
    if (!grid) return;
    grid.replaceChildren();

    const filtered = filterCat === 'all'
      ? S.presets
      : S.presets.filter(p => {
          const cat = (p.category || '').toLowerCase();
          const name = (p.name || '').toLowerCase();
          const id = (p.id || '').toLowerCase();
          if (filterCat === 'duo') return cat === 'duo' || name.startsWith('duo ·') || Boolean(p.isDuo);
          if (filterCat === 'viral') return cat.includes('viral') || name.includes('viral') || name.includes('pop') || id.includes('hype');
          if (filterCat === 'neon') return cat.includes('neon') || name.includes('neon') || name.includes('ice') || name.includes('electric') || name.includes('glow');
          if (filterCat === 'box') return name.includes('box') || cat.includes('box') || Boolean(p.pill);
          if (filterCat === 'real-estate') return cat.includes('real-estate') || id.includes('estate');
          if (filterCat === 'colourful') return cat.includes('colourful') || cat.includes('color') || name.includes('fire') || name.includes('sunset') || name.includes('aurora');
          if (filterCat === 'minimal') return cat.includes('minimal') || cat.includes('classic') || name.includes('clean') || name.includes('sub');
          if (filterCat === 'special') return cat.includes('special') || id.includes('special') || Boolean(p.isSpecial);
          return true;
        });

    const countPill = $('frontPresetCount') || $('duoPresetCount');
    if (countPill) countPill.textContent = `${filtered.length} STYLES`;

    const selectedName = $('frontSelectedName') || $('duoSelectedName');
    if (selectedName && S.style) {
      selectedName.textContent = S.style.name.replace(/^Duo\s*[·-]\s*/i, '');
    }

    if (!filtered.length) {
      grid.innerHTML = '<p class="duo-empty">No presets in this category.</p>';
      return;
    }

    filtered.forEach(preset => {
      const card = createFrontShowcaseCard(preset);
      grid.appendChild(card);
    });
  }

  function renderDuoFrontPresets() {
    renderFrontShowcasePresets('all');
  }

  function setupFrontCategoryPills() {
    const frontCatPills = $$('#frontCategoryPills .cat-pill');
    frontCatPills.forEach(pill => {
      pill.addEventListener('click', () => {
        frontCatPills.forEach(p => p.classList.toggle('active', p === pill));
        const cat = pill.getAttribute('data-cat') || 'all';
        renderFrontShowcasePresets(cat);
      });
    });
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

      // Register Special Real Estate Video Template preset
      const hasRealEstatePreset = S.presets.some(p => p.videoTemplate === 'specialRealEstate' || p.id === 'special_real_estate');
      if (!hasRealEstatePreset) {
        S.presets.unshift({
          id: 'special_real_estate',
          name: 'Special Real Estate',
          category: 'real-estate',
          videoTemplate: 'specialRealEstate',
          behindPerson: false,
          highlightColor: '#fde047',
          fontFamily: 'Montserrat',
          fontScale: 1.0,
          position: 0.50
        });
      }
      S.presets.sort((a, b) => Number(Boolean(b.isDuo)) - Number(Boolean(a.isDuo)));
      renderFrontShowcasePresets('all');
      setupFrontCategoryPills();
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
  
  let _previewBannerDismissedThisSession = false;
  function showPreviewQualityNoticeBanner() {
    if (_previewBannerDismissedThisSession || window._previewBannerDismissedThisSession) return;
    const banner = $('previewQualityBanner');
    if (banner) banner.classList.remove('hidden');
  }

  function showView(viewId) {
    if (viewId === 'viewEditor') {
      viewUpload.classList.add('hidden');
      viewEditor.classList.remove('hidden');
      document.body.classList.add('editor-active');
      document.body.classList.remove('view-upload-active');
      const eb = $('editorBody') || $('.editor-body');
      if (eb && S.drawerOpen) eb.classList.add('drawer-open');
      fitCanvas();
      renderTimeline();
      renderCaptionsList();
      const dragHint = $('captionDragHint');
      if (dragHint) dragHint.classList.toggle('hidden', !S.captions.length);

      // Auto-generate captions automatically when editor opens if not generated yet
      if ((!S.captions || S.captions.length === 0) && S.filename && !S.isTranscribing) {
        startTranscription();
      }
    } else {
      viewEditor.classList.add('hidden');
      viewUpload.classList.remove('hidden');
      document.body.classList.remove('editor-active');
      document.body.classList.add('view-upload-active');
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
      if (btnGenerateCaptions) {
        btnGenerateCaptions.disabled = false;
        btnGenerateCaptions.innerHTML = '<span>Generate captions</span><span aria-hidden="true">→</span>';
      }
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

    if (btnGenerateCaptions) {
      btnGenerateCaptions.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!S.file) {
          S.generateAfterPicker = true;
          fileInput.click();
          return;
        }
        processSelectedFile(S.file);
      });
    }

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
    if (btnGenerateCaptions) {
      btnGenerateCaptions.disabled = false;
      btnGenerateCaptions.innerHTML = '<span>Generate captions</span><span aria-hidden="true">→</span>';
    }
  }

  async function processSelectedFile(file) {
    if (!file) return;
    if (btnGenerateCaptions && btnGenerateCaptions.disabled) return;
    S.file = file;
    if (btnGenerateCaptions) {
      btnGenerateCaptions.disabled = true;
      btnGenerateCaptions.innerHTML = '<span>Generating captions…</span><span class="generate-spinner" aria-hidden="true"></span>';
    }
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
        showPreviewQualityNoticeBanner();
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
    if (btnGenerateCaptions) {
      btnGenerateCaptions.disabled = false;
      btnGenerateCaptions.innerHTML = '<span>Try generating again</span><span aria-hidden="true">↻</span>';
    }
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
      schedulePreviewFrame();
    });

    vid.addEventListener('pause', () => {
      iconPlay.classList.remove('hidden');
      iconPause.classList.add('hidden');
      cancelScheduledFrame();
      renderCanvas(true);
      syncTimelinePlayhead();
    });

    let lastSfxCapId = null;
    vid.addEventListener('timeupdate', () => {
      updateTransportUI();
      if (vid.paused) {
        renderCanvas(true);
        syncTimelinePlayhead();
      }
      syncBrollPlayback();
      syncAutoZoom();
      syncReelProgressBar();

      if (S.autoSfx !== false && !vid.paused) {
        const curT = vid.currentTime || 0;
        const curCap = S.captions.find(c => curT >= c.start && curT <= c.end);
        if (curCap && curCap.id !== lastSfxCapId) {
          lastSfxCapId = curCap.id;
          const wordsStr = (curCap.text || '').toLowerCase();
          if (['money', 'cash', 'crore', 'lakh', 'paisa', 'dollar'].some(k => wordsStr.includes(k))) {
            playSfx('chaching');
          } else if (['idea', 'secret', 'trick', 'hack', 'brain'].some(k => wordsStr.includes(k))) {
            playSfx('ding');
          } else if (['stop', 'danger', 'boom', 'alert'].some(k => wordsStr.includes(k))) {
            playSfx('boom');
          } else {
            playSfx('pop');
          }
        } else if (!curCap) {
          lastSfxCapId = null;
        }
      }
    });

    setupAspectRatioHandlers();

    // Preview Quality Selector Wiring
    const selectPreviewQuality = $('selectPreviewQuality');
    if (selectPreviewQuality) {
      selectPreviewQuality.value = S.previewQuality || 'auto';
      selectPreviewQuality.addEventListener('change', (e) => {
        S.previewQuality = e.target.value;
        updatePreviewQualityUI();
        fitCanvas();
      });
    }
    updatePreviewQualityUI();

    // Dismissible Preview Quality Banner Wiring (Session-only in-memory)
    const btnCloseBanner = $('btnClosePreviewQualityBanner');
    if (btnCloseBanner) {
      btnCloseBanner.addEventListener('click', () => {
        window._previewBannerDismissedThisSession = true;
        const banner = $('previewQualityBanner');
        if (banner) banner.classList.add('hidden');
      });
    }

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
      syncBrollPlayback();
      syncAutoZoom();
      syncReelProgressBar();
    });

    vid.addEventListener('play', () => syncBrollPlayback());
    vid.addEventListener('pause', () => syncBrollPlayback());
    vid.addEventListener('seeked', () => syncBrollPlayback());

    btnMute.addEventListener('click', () => {
      vid.muted = !vid.muted;
      iconVolume.classList.toggle('hidden', vid.muted);
      iconMuted.classList.toggle('hidden', !vid.muted);
    });

    if (btnStageFullscreen) btnStageFullscreen.addEventListener('click', toggleFullscreen);
  }

  function togglePlay() {
    if (vid.paused || vid.ended) {
      vid.play();
    } else {
      vid.pause();
    }
  }

  function formatMoonshotTime(sec) {
    if (isNaN(sec) || sec < 0) sec = 0;
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const c = Math.floor((sec % 1) * 100);
    return `${m}:${s < 10 ? '0' : ''}${s}.${c < 10 ? '0' : ''}${c}`;
  }

  function updateTransportUI() {
    const cur = vid.currentTime || 0;
    const dur = vid.duration || 0;
    timeCurrent.textContent = formatMoonshotTime(cur);
    timeDuration.textContent = formatMoonshotTime(dur);
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
  // TIMELINE RENDERING & INTERACTIVE TRIM / RESIZE HANDLERS
  // ==========================================================================
  function updateCaptionWordTimings(cap) {
    if (!cap || !cap.words || !cap.words.length) return;
    const dur = Math.max(0.1, cap.end - cap.start);
    const wDur = dur / cap.words.length;
    cap.words.forEach((w, i) => {
      w.s = Math.round((cap.start + i * wDur) * 100) / 100;
      w.start = w.s;
      w.e = Math.round((cap.start + (i + 1) * wDur) * 100) / 100;
      w.end = w.e;
    });
  }

  // ==========================================================================
  // UNDO & REDO HISTORY SYSTEM
  // ==========================================================================
  const historyStack = [];
  let historyIndex = -1;
  const MAX_HISTORY = 40;
  let isApplyingHistory = false;

  function pushHistoryState(desc = '') {
    if (isApplyingHistory) return;
    const snapshot = {
      captions: JSON.parse(JSON.stringify(S.captions || [])),
      style: JSON.parse(JSON.stringify(S.style || {})),
      desc: desc || 'Change'
    };
    if (historyIndex < historyStack.length - 1) {
      historyStack.splice(historyIndex + 1);
    }
    historyStack.push(snapshot);
    if (historyStack.length > MAX_HISTORY) {
      historyStack.shift();
    }
    historyIndex = historyStack.length - 1;
    updateUndoRedoUI();
  }

  function undo() {
    if (historyIndex > 0) {
      historyIndex--;
      applyHistorySnapshot(historyStack[historyIndex]);
      const prevDesc = historyStack[historyIndex + 1]?.desc || 'Change';
      showToast(`↩ Undone: ${prevDesc}`);
    } else {
      showToast('⚠️ Nothing to undo');
    }
  }

  function redo() {
    if (historyIndex < historyStack.length - 1) {
      historyIndex++;
      applyHistorySnapshot(historyStack[historyIndex]);
      const nextDesc = historyStack[historyIndex]?.desc || 'Change';
      showToast(`↪ Redone: ${nextDesc}`);
    } else {
      showToast('⚠️ Nothing to redo');
    }
  }

  function applyHistorySnapshot(snapshot) {
    if (!snapshot) return;
    isApplyingHistory = true;
    try {
      S.captions = JSON.parse(JSON.stringify(snapshot.captions));
      S.style = JSON.parse(JSON.stringify(snapshot.style));
      renderCaptionsList();
      renderTimeline();
      renderCanvas();
      if (selectedPresetName && S.style?.name) {
        selectedPresetName.textContent = S.style.name;
      }
    } finally {
      isApplyingHistory = false;
      updateUndoRedoUI();
    }
  }

  function updateUndoRedoUI() {
    const canUndo = historyIndex > 0;
    const canRedo = historyIndex < historyStack.length - 1;
    $$('.btn-undo').forEach(btn => {
      btn.disabled = !canUndo;
      btn.classList.toggle('disabled', !canUndo);
    });
    $$('.btn-redo').forEach(btn => {
      btn.disabled = !canRedo;
      btn.classList.toggle('disabled', !canRedo);
    });
  }

  function setupTimelineHandlers() {
    $$('#chunkModeGroup .btn-chunk-mode').forEach(btn => {
      btn.addEventListener('click', () => {
        const chunk = btn.getAttribute('data-chunk');
        setChunkMode(chunk);
      });
    });

    let isTimelineDragging = false;
    let startX = 0;
    let startScrollLeft = 0;
    let wasPlayingBeforeScrub = false;
    let dragDistance = 0;

    const onScrubStart = (e) => {
      if (e.target.closest('.tl-handle') || e.target.closest('.timeline-block')) return;
      isTimelineDragging = true;
      isUserScrubbingTimeline = true;
      startX = e.clientX;
      startScrollLeft = timelineScrollContainer.scrollLeft;
      dragDistance = 0;
      if (!vid.paused) {
        wasPlayingBeforeScrub = true;
        vid.pause();
      } else {
        wasPlayingBeforeScrub = false;
      }
      try { timelineScrollContainer.setPointerCapture(e.pointerId); } catch (_) {}
    };

    const onScrubMove = (e) => {
      if (!isTimelineDragging) return;
      const dx = e.clientX - startX;
      dragDistance = Math.max(dragDistance, Math.abs(dx));
      timelineScrollContainer.scrollLeft = startScrollLeft - dx;
      const dur = vid.duration || S.probe.duration || 10;
      const newTime = Math.max(0, Math.min(dur, timelineScrollContainer.scrollLeft / pxPerSec));
      vid.currentTime = newTime;
      renderCanvas();
      syncTimelinePlayhead();
    };

    const onScrubEnd = (e) => {
      if (!isTimelineDragging) return;
      isTimelineDragging = false;
      try { timelineScrollContainer.releasePointerCapture(e.pointerId); } catch (_) {}

      // If user tapped / clicked without dragging, jump center playhead to that point
      if (dragDistance < 4 && e) {
        const rect = timelineScrollContainer.getBoundingClientRect();
        const clickOffsetFromCenter = e.clientX - (rect.left + rect.width / 2);
        const dur = vid.duration || S.probe.duration || 10;
        const newTime = Math.max(0, Math.min(dur, (timelineScrollContainer.scrollLeft + clickOffsetFromCenter) / pxPerSec));
        vid.currentTime = newTime;
        timelineScrollContainer.scrollLeft = newTime * pxPerSec;
        renderCanvas();
        syncTimelinePlayhead();
      }

      setTimeout(() => { isUserScrubbingTimeline = false; }, 80);
      if (wasPlayingBeforeScrub) {
        vid.play().catch(() => {});
      }
    };

    if (timelineScrollContainer) {
      timelineScrollContainer.addEventListener('pointerdown', onScrubStart);
      timelineScrollContainer.addEventListener('pointermove', onScrubMove);
      timelineScrollContainer.addEventListener('pointerup', onScrubEnd);
      timelineScrollContainer.addEventListener('pointercancel', onScrubEnd);

      const timelineVideoTrack = $('timelineVideoTrack');
      if (timelineVideoTrack) {
        timelineVideoTrack.addEventListener('pointerdown', onScrubStart);
      }

      // Mouse wheel / trackpad scroll handler
      timelineScrollContainer.addEventListener('wheel', (e) => {
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
          e.preventDefault();
          timelineScrollContainer.scrollLeft += e.deltaY;
        }
        const dur = vid.duration || S.probe.duration || 10;
        const newTime = Math.max(0, Math.min(dur, timelineScrollContainer.scrollLeft / pxPerSec));
        vid.currentTime = newTime;
        renderCanvas();
        syncTimelinePlayhead();
      }, { passive: false });
    }

    // Timeline Zoom controls (+ and -)
    const btnTlZoomIn = $('btnTlZoomIn');
    const btnTlZoomOut = $('btnTlZoomOut');
    if (btnTlZoomIn) {
      btnTlZoomIn.addEventListener('click', (e) => {
        e.stopPropagation();
        pxPerSec = Math.min(160, pxPerSec + 25);
        renderTimeline();
        syncTimelinePlayhead();
        showToast(`🔍 Timeline Zoom: ${pxPerSec}px/s`);
      });
    }
    if (btnTlZoomOut) {
      btnTlZoomOut.addEventListener('click', (e) => {
        e.stopPropagation();
        pxPerSec = Math.max(45, pxPerSec - 25);
        renderTimeline();
        syncTimelinePlayhead();
        showToast(`🔍 Timeline Zoom: ${pxPerSec}px/s`);
      });
    }

    // Undo / Redo Click Handlers
    $$('.btn-undo').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        undo();
      });
    });
    $$('.btn-redo').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        redo();
      });
    });

    // Keyboard Shortcuts (Ctrl+Z / Cmd+Z, Ctrl+Y / Cmd+Shift+Z)
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') && !e.target.readOnly) {
        return;
      }
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;
      if (cmdOrCtrl && !e.altKey) {
        if (e.key.toLowerCase() === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            redo();
          } else {
            undo();
          }
        } else if (e.key.toLowerCase() === 'y') {
          e.preventDefault();
          redo();
        }
      }
    });
  }

  function renderTimeline() {
    if (!timelineLane || !timelineRuler) return;
    timelineLane.innerHTML = '';
    timelineRuler.innerHTML = '';

    const dur = vid.duration || S.probe.duration || 10;
    if (dur <= 0) return;

    // Dynamically pad ribbon so 0.0s and dur align exactly with the center red playhead (50%)
    const containerW = timelineScrollContainer ? timelineScrollContainer.clientWidth : 360;
    const halfW = containerW / 2;
    if (timelineRibbon) {
      timelineRibbon.style.paddingLeft = halfW + 'px';
      timelineRibbon.style.paddingRight = halfW + 'px';
    }

    // Ribbon track width expands sideways based on video duration
    const trackWidth = Math.ceil(dur * pxPerSec);
    timelineLane.style.width = trackWidth + 'px';
    timelineRuler.style.width = trackWidth + 'px';
    if (timelineRibbon) {
      timelineRibbon.style.width = trackWidth + 'px';
    }

    // Main Video Track (A-Roll) below captions
    const timelineVideoLane = $('timelineVideoLane');
    const timelineVideoTrack = $('timelineVideoTrack');
    const videoTrackDur = $('videoTrackDur');
    if (timelineVideoLane && timelineVideoTrack) {
      timelineVideoLane.style.width = trackWidth + 'px';
      timelineVideoTrack.style.width = trackWidth + 'px';
      if (videoTrackDur) {
        videoTrackDur.textContent = (typeof formatMoonshotTime === 'function') ? formatMoonshotTime(dur) : (dur.toFixed(1) + 's');
      }
    }

    // Ruler marks every 1 second
    const step = 1;
    for (let t = 0; t <= Math.ceil(dur); t += step) {
      const mark = document.createElement('div');
      mark.className = 'timeline-ruler-mark' + (t % 5 === 0 ? ' major' : '');
      mark.style.left = (t * pxPerSec) + 'px';
      mark.innerHTML = `<span class="ruler-tick"></span><span class="ruler-num">${t}s</span>`;
      timelineRuler.appendChild(mark);
    }

    const curTime = vid.currentTime || 0;
    S.captions.forEach((cap, idx) => {
      const block = document.createElement('div');
      block.className = 'timeline-block' + (curTime >= cap.start && curTime <= cap.end ? ' active' : '');
      const leftPx = Math.round(cap.start * pxPerSec);
      const widthPx = Math.max(36, Math.round((cap.end - cap.start) * pxPerSec));
      block.style.left = leftPx + 'px';
      block.style.width = widthPx + 'px';
      block.setAttribute('data-id', cap.id);

      // Left Trim Handle (Drag left/right to adjust start time)
      const handleL = document.createElement('div');
      handleL.className = 'tl-handle tl-handle-left';
      handleL.title = 'Drag to adjust start time';
      block.appendChild(handleL);

      // Center Text
      const textSpan = document.createElement('span');
      textSpan.className = 'tl-block-text';
      textSpan.textContent = cap.text || `Line ${idx + 1}`;
      block.appendChild(textSpan);

      // Duration Tag
      const durTag = document.createElement('span');
      durTag.className = 'tl-block-dur';
      durTag.textContent = (cap.end - cap.start).toFixed(1) + 's';
      if (widthPx > 72) {
        block.appendChild(durTag);
      }

      // Right Trim Handle (Drag left/right to adjust duration)
      const handleR = document.createElement('div');
      handleR.className = 'tl-handle tl-handle-right';
      handleR.title = 'Drag to adjust duration';
      block.appendChild(handleR);

      // Setup Drag & Resize Logic
      setupBlockDrag(block, handleL, handleR, cap, dur);

      timelineLane.appendChild(block);
    });

    syncTimelinePlayhead();
  }

  function setupBlockDrag(block, handleL, handleR, cap, totalDur) {
    let drag = null;

    const startDrag = (e, mode) => {
      e.stopPropagation();
      try { e.target.setPointerCapture(e.pointerId); } catch (_) {}
      drag = {
        pointerId: e.pointerId,
        mode: mode,
        startX: e.clientX,
        origStart: cap.start,
        origEnd: cap.end,
        origDur: cap.end - cap.start,
        moved: false
      };
      block.classList.add('is-resizing');
      if (mode === 'left') handleL.classList.add('dragging');
      if (mode === 'right') handleR.classList.add('dragging');
    };

    handleL.addEventListener('pointerdown', (e) => startDrag(e, 'left'));
    handleR.addEventListener('pointerdown', (e) => startDrag(e, 'right'));
    block.addEventListener('pointerdown', (e) => {
      if (e.target === handleL || e.target === handleR) return;
      startDrag(e, 'move');
    });

    const onPointerMove = (e) => {
      if (!drag || drag.pointerId !== e.pointerId) return;

      const deltaPx = e.clientX - drag.startX;
      if (!drag.moved && Math.abs(deltaPx) < 2) return;
      drag.moved = true;

      const deltaSec = deltaPx / pxPerSec;

      if (drag.mode === 'right') {
        const curCapIdx = S.captions.indexOf(cap);
        const nextCap = (curCapIdx < S.captions.length - 1) ? S.captions[curCapIdx + 1] : null;
        const maxR = nextCap ? nextCap.start : totalDur;
        const newEnd = Math.max(drag.origStart + 0.2, Math.min(maxR, drag.origEnd + deltaSec));
        cap.end = Math.round(newEnd * 100) / 100;
        vid.currentTime = cap.end;
      } else if (drag.mode === 'left') {
        const curCapIdx = S.captions.indexOf(cap);
        const prevCap = (curCapIdx > 0) ? S.captions[curCapIdx - 1] : null;
        const minL = prevCap ? prevCap.end : 0;
        const newStart = Math.max(minL, Math.min(drag.origEnd - 0.2, drag.origStart + deltaSec));
        cap.start = Math.round(newStart * 100) / 100;
        vid.currentTime = cap.start;
      } else if (drag.mode === 'move') {
        const curCapIdx = S.captions.indexOf(cap);
        const prevCap = (curCapIdx > 0) ? S.captions[curCapIdx - 1] : null;
        const nextCap = (curCapIdx < S.captions.length - 1) ? S.captions[curCapIdx + 1] : null;
        const minAllowedStart = prevCap ? prevCap.end : 0;
        const maxAllowedEnd = nextCap ? nextCap.start : totalDur;

        let newStart = drag.origStart + deltaSec;
        let newEnd = newStart + drag.origDur;

        if (newStart < minAllowedStart) {
          newStart = minAllowedStart;
          newEnd = newStart + drag.origDur;
        }
        if (newEnd > maxAllowedEnd) {
          newEnd = maxAllowedEnd;
          newStart = Math.max(minAllowedStart, newEnd - drag.origDur);
        }
        cap.start = Math.round(newStart * 100) / 100;
        cap.end = Math.round(newEnd * 100) / 100;
        vid.currentTime = cap.start;
      }

      updateCaptionWordTimings(cap);

      block.style.left = Math.round(cap.start * pxPerSec) + 'px';
      block.style.width = Math.max(36, Math.round((cap.end - cap.start) * pxPerSec)) + 'px';

      const durTag = block.querySelector('.tl-block-dur');
      if (durTag) durTag.textContent = (cap.end - cap.start).toFixed(1) + 's';

      if (timelineScrollContainer) {
        timelineScrollContainer.scrollLeft = vid.currentTime * pxPerSec;
      }

      renderCanvas();
      syncTimelinePlayhead();
    };

    const onPointerUp = (e) => {
      if (!drag || drag.pointerId !== e.pointerId) return;
      const wasMoved = drag.moved;
      const mode = drag.mode;
      drag = null;

      block.classList.remove('is-resizing');
      handleL.classList.remove('dragging');
      handleR.classList.remove('dragging');

      if (!wasMoved && mode === 'move') {
        selectCaption(cap.id);
      } else if (wasMoved) {
        S.captions.sort((a, b) => a.start - b.start);
        pushHistoryState('Adjust timeline: ' + (cap.text || '').slice(0, 16));
        renderTimeline();
        renderCaptionsList();
        showToast('⏱ ' + (cap.end - cap.start).toFixed(1) + 's (' + (cap.text || '').slice(0, 16) + '...)');
      }
    };

    block.addEventListener('pointermove', onPointerMove);
    block.addEventListener('pointerup', onPointerUp);
    block.addEventListener('pointercancel', onPointerUp);
    block.addEventListener('lostpointercapture', onPointerUp);
  }

  function syncTimelinePlayhead() {
    const dur = vid.duration || S.probe.duration || 10;
    if (dur <= 0) return;
    const cur = vid.currentTime || 0;

    // Playhead stays permanently locked at exact center (50%)
    if (timelinePlayhead) {
      timelinePlayhead.style.left = '50%';
    }

    if (tlTimeIndicator) {
      if (typeof formatTimeWithTenths === 'function') {
        tlTimeIndicator.textContent = formatTimeWithTenths(cur);
      } else {
        tlTimeIndicator.textContent = cur.toFixed(1) + 's';
      }
    }

    // Scroll ribbon underneath center needle during playback
    if (timelineScrollContainer && !isUserScrubbingTimeline) {
      const targetScroll = cur * pxPerSec;
      if (Math.abs(timelineScrollContainer.scrollLeft - targetScroll) > 0.5) {
        timelineScrollContainer.scrollLeft = targetScroll;
      }
    }

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
    const stagePresetBadge = $('stagePresetBadge');
    if (stagePresetBadge) {
      stagePresetBadge.addEventListener('click', () => {
        openDrawerTab('tabTemplates');
      });
    }

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
    if (targetId === 'tabTimeline') {
      closeDrawer();
      const btnNavTimeline = $('btnNavTimeline');
      if (btnNavTimeline) {
        $$('.bottom-nav-btn').forEach(b => b.classList.toggle('active', b === btnNavTimeline));
      }
      showToast('⏱️ Timeline view active');
      renderTimeline();
      syncTimelinePlayhead();
      return;
    }
    const iconChevron = $('iconDrawerChevron');
    if (iconChevron) iconChevron.style.transform = 'rotate(0deg)';
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
      tabBroll: '🎬 B-Roll & Visuals',
      tabStyle: '🎚️ Style Options',
      tabAudio: '🎵 Audio & Music'
    };
    drawerTitle.textContent = titles[targetId] || 'Editor Options';

    if (targetId === 'tabCaptions') {
      renderCaptionsList();
    } else if (targetId === 'tabBroll') {
      renderBrollTab();
    }
    requestAnimationFrame(fitCanvas);
  }

  function closeDrawer() {
    const iconChevron = $('iconDrawerChevron');
    if (iconChevron) iconChevron.style.transform = 'rotate(180deg)';
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
    const drawerModeIcon = $('drawerModeIcon');
    const drawerModeText = $('drawerModeText');
    if (drawerModeIcon) drawerModeIcon.textContent = S.drawerFullscreen ? '🗗' : '⛶';
    if (drawerModeText) drawerModeText.textContent = S.drawerFullscreen ? 'Half View' : 'Fullscreen';
    if (btnDrawerExpand) {
      btnDrawerExpand.title = S.drawerFullscreen ? 'Switch to Half screen preview' : 'Expand section to Fullscreen';
    }
    requestAnimationFrame(fitCanvas);
    showToast(S.drawerFullscreen ? '⛶ Section in Fullscreen mode' : '🗗 Section in Half screen mode');
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

  function showToast(msg, duration = 2400) {
    if (!toastNotification) return;
    toastNotification.textContent = msg;
    toastNotification.classList.remove('hidden');
    clearTimeout(toastNotification._timer);
    toastNotification._timer = setTimeout(() => {
      toastNotification.classList.add('hidden');
    }, duration);
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
    card.setAttribute('data-id', preset.id);
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.minHeight = '130px';
    card.style.height = '135px';
    card.style.overflow = 'hidden';
    card.style.boxSizing = 'border-box';

    const kRole = preset.key || preset.roles?.accent || {};
    const color = preset.highlightColor || kRole.color || '#FFE600';
    const font = kRole.font || 'Poppins';
    const isItalic = kRole.italic ? 'italic' : 'normal';
    const weight = kRole.bold !== false ? '900' : '700';
    const textTransform = kRole.upper !== false ? 'uppercase' : 'none';

    // Unique preview word
    let previewWord = preset.previewWord || '';
    if (!previewWord) {
      previewWord = (preset.name || 'VIRAL')
        .replace(/^Duo\s*[·-]\s*/i, '')
        .replace(/[^\w\s]/gi, '')
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .join(' ');
    }
    if (!previewWord) previewWord = 'VIRAL POP';

    // Category badge tag
    let tag = preset.badge || '';
    if (!tag) {
      if (preset.isDuo || preset.category === 'duo') tag = '⚡ DUO';
      else if (preset.category === 'real-estate') tag = '👑 ESTATE';
      else if (preset.name?.toLowerCase().includes('box') || preset.pill) tag = '📦 BOX';
      else if (preset.name?.toLowerCase().includes('neon') || preset.name?.toLowerCase().includes('glow')) tag = '✨ NEON';
      else if (preset.category === 'colourful') tag = '🌈 COLOR';
      else tag = (preset.category || 'POP').toUpperCase();
    }

    const isBehind = Boolean(
      preset.depthAccent ||
      preset.behindPerson ||
      (preset.roles && preset.roles.accent && preset.roles.accent.layer === 'behind') ||
      (preset.name && preset.name.toLowerCase().includes('(behind)'))
    );
    if (isBehind) tag = '👑 BEHIND';

    // Visual Art Container
    const art = document.createElement('div');
    art.className = 'preset-card-art';
    art.style.display = 'flex';
    art.style.flexDirection = 'column';
    art.style.alignItems = 'center';
    art.style.justifyContent = 'center';
    art.style.height = '92px';
    art.style.minHeight = '92px';
    art.style.position = 'relative';
    art.style.boxSizing = 'border-box';

    const tagSpan = document.createElement('span');
    tagSpan.className = 'preset-card-tag';
    tagSpan.style.background = `${color}25`;
    tagSpan.style.color = color;
    tagSpan.style.borderColor = `${color}44`;
    tagSpan.textContent = tag;
    art.appendChild(tagSpan);

    if (preset.isDuo) {
      const small = document.createElement('span');
      small.className = 'preset-card-small';
      small.textContent = 'SOME MOMENTS';
      art.appendChild(small);
    }

    const big = document.createElement('strong');
    big.className = 'preset-card-big';
    big.textContent = previewWord;
    big.style.fontFamily = `'${font}', sans-serif`;
    big.style.fontStyle = isItalic;
    big.style.fontWeight = weight;
    big.style.textTransform = textTransform;

    const paint = kRole.keyGradient || kRole.color || preset.highlightColor || color;
    if (preset.pill) {
      big.style.background = preset.pill;
      big.style.padding = '3px 8px';
      big.style.borderRadius = '5px';
      big.style.color = '#000';
    } else if (paint && paint.startsWith('linear-gradient(')) {
      big.style.backgroundImage = paint;
      big.style.webkitBackgroundClip = 'text';
      big.style.backgroundClip = 'text';
      big.style.color = 'transparent';
    } else {
      big.style.color = color;
      if (kRole.glow || preset.glow) {
        big.style.textShadow = `0 0 10px ${kRole.glow || color}88`;
      }
    }
    art.appendChild(big);

    // A5: Person silhouette in front of behind cards preview
    if (isBehind) {
      const sil = document.createElement('div');
      sil.className = 'preset-card-silhouette';
      sil.style.position = 'absolute';
      sil.style.bottom = '2px';
      sil.style.pointerEvents = 'none';
      sil.style.zIndex = '2';
      sil.innerHTML = '<svg width="42" height="42" viewBox="0 0 24 24" fill="rgba(255,255,255,0.22)" stroke="rgba(255,255,255,0.45)" stroke-width="1.25"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
      art.appendChild(sil);
    }

    // Name & Active Check Row
    const nameRow = document.createElement('div');
    nameRow.className = 'preset-card-name-row';
    nameRow.style.display = 'flex';
    nameRow.style.alignItems = 'center';
    nameRow.style.justifyContent = 'space-between';
    nameRow.style.height = '38px';
    nameRow.style.minHeight = '38px';
    nameRow.style.boxSizing = 'border-box';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'preset-name';
    nameSpan.textContent = preset.name.replace(/^Duo\s*[·-]\s*/i, '');

    const checkSpan = document.createElement('span');
    checkSpan.className = 'preset-check-icon';
    checkSpan.textContent = '✓';

    nameRow.append(nameSpan, checkSpan);
    card.append(art, nameRow);

    if (isModal) {
      const genBtn = document.createElement('button');
      genBtn.className = 'btn-card-generate';
      genBtn.textContent = '⚡ Generate';
      genBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        applyPreset(preset, true);
        modalTemplates.classList.add('hidden');
      });
      card.appendChild(genBtn);
    }

    card.addEventListener('click', () => {
      const wasActive = card.classList.contains('active');
      applyPreset(preset, false);
      $$('.preset-card').forEach(c => c.classList.toggle('active', c.getAttribute('data-id') === preset.id));
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
    // Behind person removed per user request
  }

  function applyPreset(preset, showGenToast = false) {
    pushHistoryState('Template: ' + (preset.name || 'Template'));
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
      position: Number.isFinite(Number(preset.position)) ? Number(preset.position) : 0.75,
      posY: Number.isFinite(Number(preset.position)) ? Number(preset.position) : 0.75,
      behindPerson: false,
      depthAccent: false,
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
    const stagePresetName = $('stagePresetName');
    if (stagePresetName) {
      stagePresetName.textContent = preset.name || 'Template';
    }
    const frontSelectedName = $('frontSelectedName') || $('duoSelectedName');
    if (frontSelectedName) frontSelectedName.textContent = preset.name.replace(/^Duo\s*[·-]\s*/i, '');
    $$('.preset-card').forEach(c => {
      const isMatch = c.getAttribute('data-id') === preset.id;
      c.classList.toggle('active', isMatch);
    });
    $$('.front-preset-card').forEach(card => {
      const isMatch = card.getAttribute('data-id') === preset.id || card.getAttribute('aria-label') === `Choose ${preset.name}`;
      card.classList.toggle('active', isMatch);
      card.setAttribute('aria-pressed', String(isMatch));
    });
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

      row.innerHTML = `<button class="caption-play-btn" title="Jump to timestamp">▶</button><div class="caption-center"><div class="caption-dur-controls"><button type="button" class="btn-time-step btn-step-minus" title="Decrease duration by 0.2s">-0.2s</button><span class="caption-time-pill">${formatTime(cap.start)} - ${formatTime(cap.end)} (${(cap.end - cap.start).toFixed(1)}s)</span><button type="button" class="btn-time-step btn-step-plus" title="Increase duration by 0.2s">+0.2s</button></div></div><button class="caption-delete-btn" title="Delete caption">&times;</button>`;

      const btnMinus = row.querySelector('.btn-step-minus');
      const btnPlus = row.querySelector('.btn-step-plus');
      if (btnMinus) {
        btnMinus.addEventListener('click', (e) => {
          e.stopPropagation();
          cap.end = Math.max(cap.start + 0.25, Math.round((cap.end - 0.2) * 100) / 100);
          updateCaptionWordTimings(cap);
          renderCaptionsList();
          renderTimeline();
          renderCanvas();
        });
      }
      if (btnPlus) {
        btnPlus.addEventListener('click', (e) => {
          e.stopPropagation();
          const dur = vid.duration || S.probe.duration || 10;
          cap.end = Math.min(dur, Math.round((cap.end + 0.2) * 100) / 100);
          updateCaptionWordTimings(cap);
          renderCaptionsList();
          renderTimeline();
          renderCanvas();
        });
      }
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
    // -------------------------------------------------------------------------
    // MOONSHOT TACTILE STEPPERS (Words Per Line, Size, Line Spacing, Glow)
    // -------------------------------------------------------------------------
    const chunkModes = ['1', '3', 'sentence'];
    const chunkLabels = {
      '1': '1 Word (MrBeast)',
      '3': '2-3 Words (Hormozi)',
      'sentence': 'Full Sentence'
    };
    const valWordsPerLine = $('valWordsPerLine');
    const btnStepWordsDown = $('btnStepWordsDown');
    const btnStepWordsUp = $('btnStepWordsUp');
    const btnResetWords = $('btnResetWords');

    const updateWordsUI = () => {
      if (valWordsPerLine) {
        valWordsPerLine.textContent = chunkLabels[S.chunkMode] || '2-3 Words';
      }
    };

    if (btnStepWordsDown) {
      btnStepWordsDown.addEventListener('click', () => {
        const idx = chunkModes.indexOf(String(S.chunkMode));
        const nextIdx = Math.max(0, idx - 1);
        setChunkMode(chunkModes[nextIdx]);
        updateWordsUI();
      });
    }
    if (btnStepWordsUp) {
      btnStepWordsUp.addEventListener('click', () => {
        const idx = chunkModes.indexOf(String(S.chunkMode));
        const nextIdx = Math.min(chunkModes.length - 1, idx + 1);
        setChunkMode(chunkModes[nextIdx]);
        updateWordsUI();
      });
    }
    if (btnResetWords) {
      btnResetWords.addEventListener('click', () => {
        setChunkMode('3');
        updateWordsUI();
      });
    }

    // Font Size Stepper
    const btnStepSizeDown = $('btnStepSizeDown');
    const btnStepSizeUp = $('btnStepSizeUp');
    const btnResetSize = $('btnResetSize');

    const updateFontScaleUI = () => {
      if (!S.style) S.style = {};
      if (typeof S.style.fontScale !== 'number') S.style.fontScale = 1.0;
      const px = Math.round(S.style.fontScale * 48);
      const pct = Math.round(S.style.fontScale * 100);
      if (valFontSize) valFontSize.textContent = `${pct}% (${px}px)`;
      if (inputFontSize) inputFontSize.value = String(pct);
    };

    if (btnStepSizeDown) {
      btnStepSizeDown.addEventListener('click', () => {
        if (!S.style) S.style = {};
        S.style.fontScale = Math.max(0.6, Math.round(((S.style.fontScale || 1.0) - 0.1) * 10) / 10);
        updateFontScaleUI();
        renderCanvas();
      });
    }
    if (btnStepSizeUp) {
      btnStepSizeUp.addEventListener('click', () => {
        if (!S.style) S.style = {};
        S.style.fontScale = Math.min(1.8, Math.round(((S.style.fontScale || 1.0) + 0.1) * 10) / 10);
        updateFontScaleUI();
        renderCanvas();
      });
    }
    if (btnResetSize) {
      btnResetSize.addEventListener('click', () => {
        if (!S.style) S.style = {};
        S.style.fontScale = 1.0;
        updateFontScaleUI();
        renderCanvas();
      });
    }

    // Line Spacing Stepper
    const valLineSpacing = $('valLineSpacing');
    const btnStepLineSpacingDown = $('btnStepLineSpacingDown');
    const btnStepLineSpacingUp = $('btnStepLineSpacingUp');
    const btnResetLineSpacing = $('btnResetLineSpacing');

    const updateLineSpacingUI = () => {
      if (!S.style) S.style = {};
      const sp = S.style.lineSpacing || 1.2;
      if (valLineSpacing) valLineSpacing.textContent = `${Math.round(sp * 100)}%`;
    };

    if (btnStepLineSpacingDown) {
      btnStepLineSpacingDown.addEventListener('click', () => {
        if (!S.style) S.style = {};
        S.style.lineSpacing = Math.max(0.9, Math.round(((S.style.lineSpacing || 1.2) - 0.05) * 100) / 100);
        updateLineSpacingUI();
        renderCanvas();
      });
    }
    if (btnStepLineSpacingUp) {
      btnStepLineSpacingUp.addEventListener('click', () => {
        if (!S.style) S.style = {};
        S.style.lineSpacing = Math.min(1.8, Math.round(((S.style.lineSpacing || 1.2) + 0.05) * 100) / 100);
        updateLineSpacingUI();
        renderCanvas();
      });
    }
    if (btnResetLineSpacing) {
      btnResetLineSpacing.addEventListener('click', () => {
        if (!S.style) S.style = {};
        S.style.lineSpacing = 1.2;
        updateLineSpacingUI();
        renderCanvas();
      });
    }

    // Glow Bloom Stepper
    const valGlowBlur = $('valGlowBlur');
    const btnStepGlowDown = $('btnStepGlowDown');
    const btnStepGlowUp = $('btnStepGlowUp');
    const btnResetGlow = $('btnResetGlow');

    const updateGlowBlurUI = () => {
      if (!S.style) S.style = {};
      const blur = typeof S.style.glowBlur === 'number' ? S.style.glowBlur : 18;
      if (valGlowBlur) valGlowBlur.textContent = `${blur}px Bloom`;
      if (inputGlowBlur) inputGlowBlur.value = String(blur);
    };

    if (btnStepGlowDown) {
      btnStepGlowDown.addEventListener('click', () => {
        if (!S.style) S.style = {};
        S.style.glowBlur = Math.max(4, (typeof S.style.glowBlur === 'number' ? S.style.glowBlur : 18) - 3);
        updateGlowBlurUI();
        renderCanvas();
      });
    }
    if (btnStepGlowUp) {
      btnStepGlowUp.addEventListener('click', () => {
        if (!S.style) S.style = {};
        S.style.glowBlur = Math.min(45, (typeof S.style.glowBlur === 'number' ? S.style.glowBlur : 18) + 3);
        updateGlowBlurUI();
        renderCanvas();
      });
    }
    if (btnResetGlow) {
      btnResetGlow.addEventListener('click', () => {
        if (!S.style) S.style = {};
        S.style.glowBlur = 18;
        updateGlowBlurUI();
        renderCanvas();
      });
    }

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

    // 1. Text Motion & Animation Chooser
    const valAnimName = $('valAnimName');
    $$('#animGrid .btn-anim-choice').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('#animGrid .btn-anim-choice').forEach(b => b.classList.toggle('active', b === btn));
        const anim = btn.getAttribute('data-anim') || 'pop';
        if (!S.style) S.style = {};
        S.style.animation = anim;
        S.style.anim = anim;
        if (S.style.roles?.accent) S.style.roles.accent.enter = anim;
        if (S.style.roles?.base) S.style.roles.base.enter = anim;
        const label = btn.querySelector('.anim-label')?.textContent || anim;
        if (valAnimName) valAnimName.textContent = label;
        showToast('🎬 Animation: ' + label + ' applied');
        renderCanvas();
      });
    });

    // 2. Highlight Word Color (Swatches + Custom Picker)
    const valHighlightColor = $('valHighlightColor');
    const inputCustomHighlight = $('inputCustomHighlight');

    function setHighlightColor(color) {
      if (!S.style) S.style = {};
      S.style.highlightColor = color;
      S.style._customColorActive = true;
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
      delete S.style.keyGradient;
      delete S.style.secondaryGradient;
      delete S.style.textGradient;
      delete S.style.fill;
      delete S.style.multiColorGradients;
      if (S.style.big && S.style.big.fill) delete S.style.big.fill;
      if (S.style.small && S.style.small.fill) delete S.style.small.fill;

      if (valHighlightColor) {
        valHighlightColor.textContent = color;
        valHighlightColor.style.background = color;
        valHighlightColor.style.color = (color === '#FFFFFF' || color.toLowerCase() === '#ffe600') ? '#000' : '#fff';
      }
      if (inputCustomHighlight) inputCustomHighlight.value = color;
      renderCanvas();
    }

    $$('#colorSwatches .swatch').forEach(swatch => {
      swatch.addEventListener('click', () => {
        $$('#colorSwatches .swatch').forEach(s => s.classList.toggle('active', s === swatch));
        setHighlightColor(swatch.getAttribute('data-color'));
      });
    });

    if (inputCustomHighlight) {
      inputCustomHighlight.addEventListener('input', (e) => {
        $$('#colorSwatches .swatch').forEach(s => s.classList.remove('active'));
        setHighlightColor(e.target.value);
      });
    }

    // 3. Base Subtitle Color (Swatches + Custom Picker)
    const valBaseColor = $('valBaseColor');
    const inputCustomBaseColor = $('inputCustomBaseColor');

    function setBaseColor(color) {
      if (!S.style) S.style = {};
      S.style.baseColor = color;
      if (!S.style.roles) S.style.roles = {};
      if (!S.style.roles.base) S.style.roles.base = {};
      S.style.roles.base.color = color;
      if (S.style.filler) S.style.filler.color = color;

      if (valBaseColor) {
        valBaseColor.textContent = color;
        valBaseColor.style.background = color;
        valBaseColor.style.color = (color === '#FFFFFF' || color.toLowerCase() === '#fffdd0' || color.toLowerCase() === '#ffe600') ? '#000' : '#fff';
      }
      if (inputCustomBaseColor) inputCustomBaseColor.value = color;
      renderCanvas();
    }

    $$('#baseColorSwatches .swatch').forEach(swatch => {
      swatch.addEventListener('click', () => {
        $$('#baseColorSwatches .swatch').forEach(s => s.classList.toggle('active', s === swatch));
        setBaseColor(swatch.getAttribute('data-color'));
      });
    });

    if (inputCustomBaseColor) {
      inputCustomBaseColor.addEventListener('input', (e) => {
        $$('#baseColorSwatches .swatch').forEach(s => s.classList.remove('active'));
        setBaseColor(e.target.value);
      });
    }

    // 4. Text Outline / Stroke
    const valOutlineBadge = $('valOutlineBadge');
    $$('#outlineButtonGroup .btn-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('#outlineButtonGroup .btn-toggle').forEach(b => b.classList.toggle('active', b === btn));
        const mode = btn.getAttribute('data-outline') || 'black';
        if (!S.style) S.style = {};
        S.style.outlineMode = mode;
        if (valOutlineBadge) {
          valOutlineBadge.textContent = mode === 'glow' ? 'Colored Glow' : (mode === 'none' ? 'No Outline' : 'Solid Black');
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

    // Text Glow-Up & Neon Bloom Controls
    const valGlowBadge = $('valGlowBadge');
    const valGlowColor = $('valGlowColor');
    const glowOptionsBox = $('glowOptionsBox');
    const inputCustomGlow = $('inputCustomGlow');
    const inputGlowSlider = $('inputGlowBlur');

    function setGlowColor(color) {
      if (!S.style) S.style = {};
      S.style.glowColor = color;
      if (!S.style.key) S.style.key = {};
      S.style.key.glow = color;
      if (!S.style.roles) S.style.roles = {};
      if (S.style.roles.accent) S.style.roles.accent.glow = color;
      if (valGlowColor) {
        valGlowColor.textContent = color;
        valGlowColor.style.background = color;
        valGlowColor.style.color = (color === '#FFFFFF' || color.toLowerCase() === '#ffe600') ? '#000' : '#fff';
      }
      if (inputCustomGlow) inputCustomGlow.value = color;
      renderCanvas();
    }

    $$('#glowToggleGroup .btn-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('#glowToggleGroup .btn-toggle').forEach(b => b.classList.toggle('active', b === btn));
        const isOn = btn.getAttribute('data-glow') === 'on';
        if (!S.style) S.style = {};
        S.style.glowEnabled = isOn;
        if (glowOptionsBox) glowOptionsBox.classList.toggle('is-disabled', !isOn);
        if (valGlowBadge) valGlowBadge.textContent = isOn ? 'Glow: ON' : 'Off';
        showToast(isOn ? '✨ Glow-up enabled!' : 'Glow turned off');
        renderCanvas();
      });
    });

    $$('#glowColorSwatches .swatch').forEach(swatch => {
      swatch.addEventListener('click', () => {
        $$('#glowColorSwatches .swatch').forEach(s => s.classList.toggle('active', s === swatch));
        setGlowColor(swatch.getAttribute('data-color'));
      });
    });

    if (inputCustomGlow) {
      inputCustomGlow.addEventListener('input', (e) => {
        $$('#glowColorSwatches .swatch').forEach(s => s.classList.remove('active'));
        setGlowColor(e.target.value);
      });
    }

    if (inputGlowBlur) {
      inputGlowBlur.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        if (!S.style) S.style = {};
        S.style.glowBlur = val;
        if (valGlowBlur) {
          const label = val <= 10 ? `Soft (${val}px)` : (val <= 25 ? `Medium (${val}px)` : `Ultra (${val}px)`);
          valGlowBlur.textContent = label;
        }
        renderCanvas();
      });
    }

    // Viral Auto-Emojis toggle
    const valEmojiBadge = $('valEmojiBadge');
    $$('#emojiButtonGroup .btn-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('#emojiButtonGroup .btn-toggle').forEach(b => b.classList.toggle('active', b === btn));
        const mode = btn.getAttribute('data-emoji') || 'above';
        S.autoEmojis = mode;
        if (valEmojiBadge) {
          valEmojiBadge.textContent = mode === 'above' ? 'ON (Above Word)' : (mode === 'beside' ? 'ON (Beside Word)' : 'OFF');
        }
        showToast('🔥 Auto-Emojis: ' + (mode === 'off' ? 'Off' : 'Active'));
        renderCanvas();
      });
    });

    // Custom Font Upload
    setupFontUploadHandler();

    // Watermark setup
    const inputWmText = $('inputWatermarkText');
    const inputWmOpacity = $('inputWmOpacity');
    const valWmOpacity = $('valWmOpacity');

    if (inputWmText) {
      inputWmText.addEventListener('input', (e) => {
        if (!S.watermark) S.watermark = { position: 'bottom-right', opacity: 0.8, platform: 'instagram' };
        S.watermark.text = e.target.value;
        renderCanvas();
      });
    }

    $$('#wmPlatformGroup .btn-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('#wmPlatformGroup .btn-toggle').forEach(b => b.classList.toggle('active', b === btn));
        if (!S.watermark) S.watermark = { position: 'bottom-right', opacity: 0.8 };
        S.watermark.platform = btn.getAttribute('data-platform') || 'instagram';
        renderCanvas();
      });
    });

    $$('#wmPosGroup .btn-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('#wmPosGroup .btn-toggle').forEach(b => b.classList.toggle('active', b === btn));
        if (!S.watermark) S.watermark = { platform: 'instagram', opacity: 0.8 };
        S.watermark.position = btn.getAttribute('data-pos') || 'bottom-right';
        renderCanvas();
      });
    });

    if (inputWmOpacity) {
      inputWmOpacity.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        if (valWmOpacity) valWmOpacity.textContent = val + '%';
        if (!S.watermark) S.watermark = { platform: 'instagram', position: 'bottom-right' };
        S.watermark.opacity = val / 100;
        renderCanvas();
      });
    }

    // Helper to update Zoom Badge & UI
    function updateAutoZoomBadge() {
      const badge = $('valAutoZoomBadge');
      if (badge && S.autoZoom) {
        if (!S.autoZoom.enabled) {
          badge.textContent = 'Disabled';
          badge.className = 'val-badge';
        } else {
          const intStr = S.autoZoom.interval > 0 ? `${S.autoZoom.interval}s` : 'Key';
          badge.textContent = `Smooth (${S.autoZoom.scale || 1.10}x / ${intStr})`;
          badge.className = 'val-badge badge-green';
        }
      }
    }

    // Auto-Zoom Toggle Handlers
    const btnQuickAutoZoom = $('btnQuickAutoZoom');
    if (btnQuickAutoZoom) {
      btnQuickAutoZoom.addEventListener('click', () => {
        if (!S.autoZoom) S.autoZoom = { enabled: true, interval: 10, duration: 3.5, speed: 0.6, scale: 1.10 };
        S.autoZoom.enabled = !S.autoZoom.enabled;
        btnQuickAutoZoom.classList.toggle('active', S.autoZoom.enabled);
        btnQuickAutoZoom.textContent = S.autoZoom.enabled ? '🎥 Zoom: ON' : '🎥 Zoom: OFF';
        $$('#autoZoomToggleGroup .btn-toggle').forEach(b => b.classList.toggle('active', (b.getAttribute('data-zoom') === 'on') === S.autoZoom.enabled));
        updateAutoZoomBadge();
        syncAutoZoom();
        showToast(S.autoZoom.enabled ? '🎥 Slow Dynamic Auto-Zoom enabled' : 'Auto-Zoom disabled');
      });
    }

    $$('#autoZoomToggleGroup .btn-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('#autoZoomToggleGroup .btn-toggle').forEach(b => b.classList.toggle('active', b === btn));
        if (!S.autoZoom) S.autoZoom = { enabled: true, interval: 10, duration: 3.5, speed: 0.6, scale: 1.10 };
        S.autoZoom.enabled = (btn.getAttribute('data-zoom') === 'on');
        if (btnQuickAutoZoom) {
          btnQuickAutoZoom.classList.toggle('active', S.autoZoom.enabled);
          btnQuickAutoZoom.textContent = S.autoZoom.enabled ? '🎥 Zoom: ON' : '🎥 Zoom: OFF';
        }
        updateAutoZoomBadge();
        syncAutoZoom();
      });
    });

    // Auto-Zoom Detailed Custom Controls (Interval, Duration, Speed, Scale)
    $$('#zoomIntervalGroup .btn-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('#zoomIntervalGroup .btn-toggle').forEach(b => b.classList.toggle('active', b === btn));
        if (!S.autoZoom) S.autoZoom = { enabled: true, interval: 10, duration: 3.5, speed: 0.6, scale: 1.10 };
        S.autoZoom.interval = parseFloat(btn.getAttribute('data-interval')) || 0;
        updateAutoZoomBadge();
        syncAutoZoom();
        showToast(`🎥 Zoom Frequency: ${btn.textContent.trim()}`);
      });
    });

    $$('#zoomDurationGroup .btn-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('#zoomDurationGroup .btn-toggle').forEach(b => b.classList.toggle('active', b === btn));
        if (!S.autoZoom) S.autoZoom = { enabled: true, interval: 10, duration: 3.5, speed: 0.6, scale: 1.10 };
        S.autoZoom.duration = parseFloat(btn.getAttribute('data-duration')) || 3.5;
        syncAutoZoom();
        showToast(`🎥 Zoom Hold Time: ${btn.textContent.trim()}`);
      });
    });

    $$('#zoomSpeedGroup .btn-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('#zoomSpeedGroup .btn-toggle').forEach(b => b.classList.toggle('active', b === btn));
        if (!S.autoZoom) S.autoZoom = { enabled: true, interval: 10, duration: 3.5, speed: 0.6, scale: 1.10 };
        S.autoZoom.speed = parseFloat(btn.getAttribute('data-speed')) || 0.6;
        syncAutoZoom();
        showToast(`🎥 Zoom Speed: ${btn.textContent.trim()}`);
      });
    });

    $$('#zoomScaleGroup .btn-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('#zoomScaleGroup .btn-toggle').forEach(b => b.classList.toggle('active', b === btn));
        if (!S.autoZoom) S.autoZoom = { enabled: true, interval: 10, duration: 3.5, speed: 0.6, scale: 1.10 };
        S.autoZoom.scale = parseFloat(btn.getAttribute('data-scale')) || 1.10;
        updateAutoZoomBadge();
        syncAutoZoom();
        showToast(`🎥 Zoom Scale: ${btn.textContent.trim()}`);
      });
    });

    // Moonshot UI Extra Controls: Fit Dropdown, Stage Settings, Section Style, Multi-select
    const btnFitDropdown = $('btnFitDropdown');
    const fitDropdownMenu = $('fitDropdownMenu');
    const fitLabelText = $('fitLabelText');

    if (btnFitDropdown && fitDropdownMenu) {
      btnFitDropdown.addEventListener('click', (e) => {
        e.stopPropagation();
        fitDropdownMenu.classList.toggle('hidden');
      });
      document.addEventListener('click', (e) => {
        if (!btnFitDropdown.contains(e.target)) {
          fitDropdownMenu.classList.add('hidden');
        }
      });
      $$('.fit-option').forEach(opt => {
        opt.addEventListener('click', () => {
          $$('.fit-option').forEach(o => o.classList.toggle('active', o === opt));
          const aspect = opt.getAttribute('data-aspect') || 'original';
          if (fitLabelText) {
            fitLabelText.textContent = aspect === '9:16' ? '9:16' : (aspect === '1:1' ? '1:1' : 'Fit');
          }
          fitDropdownMenu.classList.add('hidden');
          const stage = $('stage');
          if (stage) {
            stage.classList.remove('aspect-9-16', 'aspect-1-1', 'aspect-16-9');
            if (aspect === '9:16') stage.classList.add('aspect-9-16');
            else if (aspect === '1:1') stage.classList.add('aspect-1-1');
            else if (aspect === '16:9') stage.classList.add('aspect-16-9');
          }
          S.aspect = aspect;
          setupCanvasSizing();
          renderCanvas();
          showToast(`📐 Ratio: ${fitLabelText ? fitLabelText.textContent : aspect}`);
        });
      });
    }

    const btnStageSettings = $('btnStageSettings');
    if (btnStageSettings) {
      btnStageSettings.addEventListener('click', () => {
        openDrawerTab('tabStyle');
        const zoomBlock = $('zoomOptionsBlock');
        if (zoomBlock) {
          zoomBlock.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        showToast('⚙️ Adjust Auto-Zoom & Stage settings');
      });
    }

    const btnSectionStyle = $('btnSectionStyle');
    if (btnSectionStyle) {
      btnSectionStyle.addEventListener('click', () => {
        openDrawerTab('tabTemplates');
        showToast('🪟 Choose caption template style');
      });
    }

    const btnMultiSelect = $('btnMultiSelect');
    if (btnMultiSelect) {
      btnMultiSelect.addEventListener('click', () => {
        btnMultiSelect.classList.toggle('active');
        const isMulti = btnMultiSelect.classList.contains('active');
        showToast(isMulti ? '✨ Multi-select mode ON' : 'Multi-select mode OFF');
      });
    }

    // Reel Progress Bar Handlers
    $$('#progressBarToggleGroup .btn-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('#progressBarToggleGroup .btn-toggle').forEach(b => b.classList.toggle('active', b === btn));
        if (!S.progressBar) S.progressBar = { enabled: true, position: 'bottom' };
        S.progressBar.enabled = (btn.getAttribute('data-progress') === 'on');
        const badge = $('valProgressBarBadge');
        if (badge) {
          badge.textContent = S.progressBar.enabled ? 'Active' : 'Hidden';
          badge.className = S.progressBar.enabled ? 'val-badge badge-green' : 'val-badge';
        }
        syncReelProgressBar();
      });
    });

    $$('#progressBarPosGroup .btn-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('#progressBarPosGroup .btn-toggle').forEach(b => b.classList.toggle('active', b === btn));
        if (!S.progressBar) S.progressBar = { enabled: true, position: 'bottom' };
        S.progressBar.position = btn.getAttribute('data-pos') || 'bottom';
        syncReelProgressBar();
      });
    });
  }

  // ==========================================================================
  // TAB 4: AUDIO CONTROLS
  // ==========================================================================
  function setupAudioHandlers() {
    // SFX toggle
    $$('#sfxToggleGroup .btn-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('#sfxToggleGroup .btn-toggle').forEach(b => b.classList.toggle('active', b === btn));
        S.autoSfx = (btn.getAttribute('data-sfx') === 'on');
        const badge = $('valSfxBadge');
        if (badge) badge.textContent = S.autoSfx ? 'Auto Synced' : 'Muted';
        showToast(S.autoSfx ? '🔊 Auto SFX enabled' : '🔇 Auto SFX muted');
      });
    });

    // SFX sound buttons
    $$('.btn-sfx-sound').forEach(btn => {
      btn.addEventListener('click', () => {
        const snd = btn.getAttribute('data-sound');
        playSfx(snd);
      });
    });

    // SFX volume slider
    const inputSfxVol = $('inputSfxVol');
    const valSfxVol = $('valSfxVol');
    if (inputSfxVol) {
      inputSfxVol.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        if (valSfxVol) valSfxVol.textContent = val + '%';
        S.sfxVolume = val / 100;
      });
    }

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

    if (btnConvertToHinglish) {
      btnConvertToHinglish.addEventListener('click', async () => {
        if (!S.captions || !S.captions.length) {
          showToast('No captions to convert yet.');
          return;
        }
        btnConvertToHinglish.disabled = true;
        btnConvertToHinglish.textContent = '⏳ Converting...';
        try {
          const res = await fetch('/api/transliterate_hinglish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ captions: S.captions, words: S.words })
          });
          const data = await res.json();
          if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to convert captions');
          S.captions = normalizeCaptions(data.captions);
          if (data.words && data.words.length > 0) S.words = data.words;
          renderCaptionsList();
          renderTimeline();
          renderCanvas();
          showToast('🎉 All captions converted to natural Hinglish!');
        } catch (e) {
          showToast('Error: ' + e.message);
        } finally {
          btnConvertToHinglish.disabled = false;
          btnConvertToHinglish.textContent = '🔤 Hinglish (A-Z)';
        }
      });
    }

    // Voice Pack Cards & Instant Generate Buttons
    $$('.btn-pack-generate').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const vKey = btn.getAttribute('data-voice') || 'eleven_bunty';
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
        const vKey = card.getAttribute('data-voice') || 'eleven_bunty';
        if (voiceoverVoice) voiceoverVoice.value = vKey;
        $$('.voice-pack-card').forEach(c => c.classList.toggle('active', c === card));
      });
    });

  }

  // ==========================================================================
  // CANVAS SIZING & RENDERING LOOP
  // ==========================================================================
  function setupCanvasSizing() {
    window.addEventListener('resize', () => {
      fitCanvas();
      if (timelineScrollContainer && timelineRibbon) {
        const halfW = timelineScrollContainer.clientWidth / 2;
        timelineRibbon.style.paddingLeft = halfW + 'px';
        timelineRibbon.style.paddingRight = halfW + 'px';
      }
    });
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

      drag = {
        id: event.pointerId,
        startY: event.clientY,
        lastY: event.clientY,
        moved: false
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

      const cur = Number(S.style.position || S.style.posY || 0.75);
      const nextPos = Math.max(0.08, Math.min(0.92, cur + delta));
      S.style.position = nextPos;
      S.style.posY = nextPos;

      if (hint) {
        hint.textContent = '↕ Caption Position: ' + Math.round(nextPos * 100) + '% · release to place';
      }
      renderCanvas();
    });

    const finish = (event) => {
      if (!drag || drag.id !== event.pointerId) return;
      const moved = drag.moved;
      drag = null;
      stage.classList.remove('is-caption-dragging');
      if (hint) hint.textContent = '💡 Drag caption to move anywhere on video';
      if (moved) renderCanvas();
    };
    stage.addEventListener('pointerup', finish);
    stage.addEventListener('pointercancel', finish);
    stage.addEventListener('lostpointercapture', finish);
  }

  // ==========================================================================
  // PREVIEW PERFORMANCE ENGINE & ADAPTIVE QUALITY
  // ==========================================================================
  const PREVIEW_QUALITY_CONFIG = {
    smooth: {
      maxDpr: 1.0,
      fpsCap: 24,
      minFrameInterval: 1000 / 24,       // ~41.67 ms
      maxMaskRate: 6,
      minMaskInterval: 1000 / 6,          // ~166.67 ms
      maskDownscaleTarget: 128,
      enableDepthShadow: false,
      enableGlow: false,
      maxParticles: 0,
      enableFilterBlur: false
    },
    balanced: {
      maxDpr: 1.5,
      fpsCap: 30,
      minFrameInterval: 1000 / 30,       // ~33.33 ms
      maxMaskRate: 10,
      minMaskInterval: 1000 / 10,         // 100 ms
      maskDownscaleTarget: 160,
      enableDepthShadow: false,
      enableGlow: true,
      maxParticles: 10,
      enableFilterBlur: true
    },
    full: {
      maxDpr: 999, // uncapped
      fpsCap: 60,
      minFrameInterval: 0,
      maxMaskRate: 15,
      minMaskInterval: 1000 / 15,         // ~66.67 ms
      maskDownscaleTarget: 192,
      enableDepthShadow: true,
      enableGlow: true,
      maxParticles: 50,
      enableFilterBlur: true
    }
  };

  const isTouchPhoneDevice = (typeof navigator !== 'undefined' && (
    (navigator.maxTouchPoints > 0 && window.innerWidth < 900) ||
    (navigator.deviceMemory && navigator.deviceMemory <= 4)
  ));

  S.effectiveAutoQuality = isTouchPhoneDevice ? 'smooth' : 'balanced';
  S.previewQuality = 'auto'; // 'auto' | 'smooth' | 'balanced' | 'full'

  function getEffectivePreviewQuality() {
    if (S.previewQuality && S.previewQuality !== 'auto') {
      return S.previewQuality;
    }
    return S.effectiveAutoQuality || 'balanced';
  }

  let _previewDrawTimes = [];
  let _previewLowDrawStreakStart = 0;
  let _maskRunsInLastSec = 0;
  let _maskRateDisplay = 0;
  let _debugFrameCount = 0;
  let _currentFps = 0;
  let _lastDebugFpsTime = performance.now();
  let _overlayWasCleared = false;
  let lastUiUpdateTime = 0;

  function recordPreviewDrawTime(durationMs) {
    _previewDrawTimes.push(durationMs);
    if (_previewDrawTimes.length > 30) _previewDrawTimes.shift();

    if (_previewDrawTimes.length >= 10) {
      const avg = _previewDrawTimes.reduce((a, b) => a + b, 0) / _previewDrawTimes.length;
      const now = performance.now();

      // If average draw time > 24ms, step down one level
      if (avg > 24) {
        if (S.effectiveAutoQuality === 'full') {
          S.effectiveAutoQuality = 'balanced';
          _previewDrawTimes = [];
          _previewLowDrawStreakStart = 0;
          updatePreviewQualityUI();
          fitCanvas();
        } else if (S.effectiveAutoQuality === 'balanced') {
          S.effectiveAutoQuality = 'smooth';
          _previewDrawTimes = [];
          _previewLowDrawStreakStart = 0;
          updatePreviewQualityUI();
          fitCanvas();
        }
      } else if (avg < 10) {
        // If stays under 10ms for 3 seconds, allow stepping up one level
        if (!_previewLowDrawStreakStart) {
          _previewLowDrawStreakStart = now;
        } else if (now - _previewLowDrawStreakStart >= 3000) {
          _previewLowDrawStreakStart = now;
          if (S.previewQuality === 'auto') {
            if (S.effectiveAutoQuality === 'smooth') {
              S.effectiveAutoQuality = 'balanced';
              updatePreviewQualityUI();
              fitCanvas();
            } else if (S.effectiveAutoQuality === 'balanced') {
              S.effectiveAutoQuality = 'full';
              updatePreviewQualityUI();
              fitCanvas();
            }
          }
        }
      } else {
        _previewLowDrawStreakStart = 0;
      }
    }
  }

  function updateDebugBadge(drawDurationMs, effQuality) {
    const badge = $('previewDebugBadge');
    if (!badge) return;
    if (!window.location.search.includes('debug=1')) {
      if (!badge.classList.contains('hidden')) badge.classList.add('hidden');
      return;
    }
    badge.classList.remove('hidden');

    _debugFrameCount++;
    const now = performance.now();
    if (now - _lastDebugFpsTime >= 1000) {
      _currentFps = Math.round((_debugFrameCount * 1000) / Math.max(1, now - _lastDebugFpsTime));
      _debugFrameCount = 0;
      _lastDebugFpsTime = now;
      _maskRateDisplay = _maskRunsInLastSec;
      _maskRunsInLastSec = 0;
    }

    const avgDraw = _previewDrawTimes.length > 0 
      ? (_previewDrawTimes.reduce((a, b) => a + b, 0) / _previewDrawTimes.length).toFixed(1) 
      : drawDurationMs.toFixed(1);

    badge.textContent = `FPS: ${_currentFps} | Draw: ${avgDraw}ms | Quality: ${effQuality} (${S.previewQuality}) | Mask: ${_maskRateDisplay}/s`;
  }

  function updatePreviewQualityUI() {
    const eff = getEffectivePreviewQuality();
    const hint = $('previewPermanentHint');
    if (hint) {
      if (eff === 'smooth' || eff === 'balanced') {
        hint.classList.remove('hidden');
      } else {
        hint.classList.add('hidden');
      }
    }
    const select = $('selectPreviewQuality');
    if (select && select.value !== S.previewQuality) {
      select.value = S.previewQuality || 'auto';
    }
  }

  function fitCanvas() {
    const rect = stage.getBoundingClientRect();
    const effQuality = getEffectivePreviewQuality();
    const cfg = PREVIEW_QUALITY_CONFIG[effQuality] || PREVIEW_QUALITY_CONFIG.balanced;
    const dpr = Math.min(cfg.maxDpr, window.devicePixelRatio || 1);

    if (rect.width > 0 && rect.height > 0) {
      const cw = Math.max(2, Math.round(rect.width * dpr));
      const ch = Math.max(2, Math.round(rect.height * dpr));

      [captionCanvas, behindCanvas, personCanvas].forEach(cnv => {
        if (cnv) {
          if (cnv.width !== cw || cnv.height !== ch) {
            cnv.width = cw;
            cnv.height = ch;
          }
          cnv.style.width = '100%';
          cnv.style.height = '100%';
        }
      });

      renderCanvas(true);
    }
  }

  // Adaptive scheduling with requestVideoFrameCallback (fallback to requestAnimationFrame)
  let activePreviewFrameHandle = null;
  let lastPreviewDrawTime = 0;
  let isPreviewScheduled = false;

  function cancelScheduledFrame() {
    if (activePreviewFrameHandle !== null) {
      if ('cancelVideoFrameCallback' in vid && typeof vid.cancelVideoFrameCallback === 'function') {
        try { vid.cancelVideoFrameCallback(activePreviewFrameHandle); } catch (_) {}
      } else {
        try { cancelAnimationFrame(activePreviewFrameHandle); } catch (_) {}
      }
      activePreviewFrameHandle = null;
    }
    isPreviewScheduled = false;
  }

  function schedulePreviewFrame() {
    if (vid.paused || vid.ended || document.hidden) {
      cancelScheduledFrame();
      return;
    }
    if (isPreviewScheduled) return;
    isPreviewScheduled = true;

    const onFrame = () => {
      isPreviewScheduled = false;
      activePreviewFrameHandle = null;
      if (vid.paused || vid.ended || document.hidden) return;

      const effQuality = getEffectivePreviewQuality();
      const cfg = PREVIEW_QUALITY_CONFIG[effQuality] || PREVIEW_QUALITY_CONFIG.balanced;
      const now = performance.now();

      // Skip draw if last draw was less than level's frame interval ago
      if (cfg.minFrameInterval > 0 && (now - lastPreviewDrawTime) < (cfg.minFrameInterval - 2)) {
        schedulePreviewFrame();
        return;
      }

      lastPreviewDrawTime = now;
      renderCanvas(true);

      // Throttle timeline/playhead UI updates to at most 4 times per second (>= 250ms)
      if (now - lastUiUpdateTime >= 250) {
        lastUiUpdateTime = now;
        syncTimelinePlayhead();
      }

      schedulePreviewFrame();
    };

    if ('requestVideoFrameCallback' in vid && typeof vid.requestVideoFrameCallback === 'function') {
      activePreviewFrameHandle = vid.requestVideoFrameCallback(onFrame);
    } else {
      activePreviewFrameHandle = requestAnimationFrame(onFrame);
    }
  }

  function renderLoop() {
    schedulePreviewFrame();
  }

  // Stop preview loop and segmentation when tab is hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelScheduledFrame();
    } else if (!vid.paused && !vid.ended) {
      schedulePreviewFrame();
    }
  });


  // ==========================================================================
  // WEB AUDIO API SFX ENGINE & AUTO-EMOJIS & WATERMARK
  // ==========================================================================
  let audioCtx = null;
  function getAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) audioCtx = new AudioContextClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  }

  function playSfx(type) {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const vol = (S.sfxVolume !== undefined ? S.sfxVolume : 0.7);
      if (vol <= 0) return;
      const now = ctx.currentTime;
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(vol * 0.45, now);
      masterGain.connect(ctx.destination);

      if (type === 'pop') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(650, now);
        osc.frequency.exponentialRampToValueAtTime(140, now + 0.06);
        gain.gain.setValueAtTime(1.0, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.06);
      } else if (type === 'whoosh') {
        const bufferSize = Math.floor(ctx.sampleRate * 0.12);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(400, now);
        filter.frequency.exponentialRampToValueAtTime(2400, now + 0.06);
        filter.frequency.exponentialRampToValueAtTime(300, now + 0.12);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(1.0, now + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain);
        noise.start(now);
        noise.stop(now + 0.12);
      } else if (type === 'ding') {
        [1760, 3520].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now);
          gain.gain.setValueAtTime(idx === 0 ? 0.8 : 0.3, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
          osc.connect(gain);
          gain.connect(masterGain);
          osc.start(now);
          osc.stop(now + 0.35);
        });
      } else if (type === 'chaching') {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        osc1.type = 'triangle';
        osc2.type = 'sine';
        osc1.frequency.setValueAtTime(1980, now);
        osc1.frequency.setValueAtTime(2640, now + 0.05);
        osc2.frequency.setValueAtTime(3960, now + 0.05);
        gain.gain.setValueAtTime(0.7, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(masterGain);
        osc1.start(now);
        osc2.start(now + 0.05);
        osc1.stop(now + 0.4);
        osc2.stop(now + 0.4);
      } else if (type === 'boom') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(110, now);
        osc.frequency.exponentialRampToValueAtTime(38, now + 0.45);
        gain.gain.setValueAtTime(1.0, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.45);
      }
    } catch (_) {}
  }

  const EMOJI_DICT = {
    money: '💰', cash: '💸', crore: '💰', lakh: '💸', paisa: '💰', paise: '💰', earning: '💵', dollar: '💵', rich: '🤑', profit: '📈', invest: '💼', price: '🏷️',
    fire: '🔥', viral: '🔥', hot: '🔥', trending: '🔥', boom: '💥', aag: '🔥', crazy: '🤯', insane: '🤯', shock: '😱', wow: '✨',
    idea: '💡', secret: '🤫', tip: '💡', trick: '✨', hack: '⚡', brain: '🧠', mind: '🧠', dimag: '🧠', soch: '💭', plan: '📋',
    growth: '📈', grow: '🌱', scale: '🚀', views: '👀', followers: '👥', rocket: '🚀', reach: '🚀', success: '🏆', win: '🏆', winner: '🥇', jeet: '🏆',
    stop: '🛑', danger: '⚠️', ruko: '🛑', warning: '⚠️', never: '🚫', mistake: '❌', galat: '❌', alert: '🚨',
    love: '❤️', heart: '💖', like: '👍', subscribe: '🔔', follow: '👉', share: '🔗', best: '⭐', star: '⭐', top: '👑', king: '👑', no1: '🥇', number1: '🥇',
    time: '⏳', fast: '⚡', speed: '⚡', jaldi: '⏱️', second: '⏱️', minute: '⏱️', hour: '⏰', today: '📅',
    target: '🎯', goal: '🎯', focus: '👁️', real: '💯', sach: '💯', '100': '💯'
  };

  function getWordEmoji(rawWord) {
    if (!rawWord) return null;
    const clean = rawWord.toLowerCase().replace(/[^\w]/g, '');
    if (EMOJI_DICT[clean]) return EMOJI_DICT[clean];
    for (const [key, emoji] of Object.entries(EMOJI_DICT)) {
      if (clean.includes(key)) return emoji;
    }
    return null;
  }

  function drawAutoEmojis(ctx, activeCap, words, t, st, W, H) {
    if (S.autoEmojis === 'off') return;
    if (!words || !words.length) return;

    const curWord = words.find(w => t >= w.s && t <= w.e) || words[words.length - 1];
    if (!curWord) return;

    const emoji = getWordEmoji(curWord.t);
    if (!emoji) return;

    const progress = Math.max(0, Math.min(1, (t - curWord.s) / Math.max(0.1, curWord.e - curWord.s)));
    const scale = 1.0 + Math.sin(progress * Math.PI) * 0.28;
    const emojiSize = Math.max(26, Math.min(54, Math.round(H * 0.045 * (Number(st.fontScale) || 1))));

    const subY = (Number(st.subtitlePosition) || 0.75) * H;
    const isBeside = S.autoEmojis === 'beside';

    ctx.save();
    ctx.font = `${emojiSize}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const emojiY = isBeside ? subY : subY - emojiSize * 1.15;
    const emojiX = W / 2;

    ctx.translate(emojiX, emojiY);
    ctx.scale(scale, scale);
    ctx.fillText(emoji, 0, 0);
    ctx.restore();
  }

  let cachedWatermarkCanvas = null;
  let cachedWatermarkKey = '';

  function drawWatermark(ctx, W, H) {
    const wm = S.watermark;
    if (!wm || !wm.text || !wm.text.trim()) return;
    const text = wm.text.trim();
    const opacity = typeof wm.opacity === 'number' ? wm.opacity : 0.8;
    const pos = wm.position || 'bottom-right';
    const platform = wm.platform || 'instagram';

    const cacheKey = `${text}|${opacity}|${pos}|${platform}|${W}|${H}`;
    if (cachedWatermarkCanvas && cachedWatermarkKey === cacheKey) {
      ctx.drawImage(cachedWatermarkCanvas, 0, 0);
      return;
    }

    if (!cachedWatermarkCanvas) {
      cachedWatermarkCanvas = document.createElement('canvas');
    }
    if (cachedWatermarkCanvas.width !== W || cachedWatermarkCanvas.height !== H) {
      cachedWatermarkCanvas.width = W;
      cachedWatermarkCanvas.height = H;
    }
    const wmCtx = cachedWatermarkCanvas.getContext('2d');
    wmCtx.clearRect(0, 0, W, H);

    let icon = '';
    if (platform === 'instagram') icon = '📷 ';
    else if (platform === 'youtube') icon = '▶️ ';
    else if (platform === 'tiktok') icon = '🎵 ';
    else if (platform === 'twitter') icon = '𝕏 ';

    const label = icon + text;
    const fontSize = Math.max(12, Math.min(20, Math.round(H * 0.02)));

    wmCtx.save();
    wmCtx.font = `700 ${fontSize}px "Poppins", sans-serif`;
    wmCtx.textBaseline = 'middle';
    const metrics = wmCtx.measureText(label);
    const padX = 10;
    const padY = 6;
    const boxW = metrics.width + padX * 2;
    const boxH = fontSize + padY * 2;
    const margin = 20;

    let x = margin;
    let y = margin;
    if (pos === 'top-right') {
      x = W - boxW - margin;
      y = margin;
    } else if (pos === 'bottom-left') {
      x = margin;
      y = H - boxH - margin;
    } else if (pos === 'bottom-right') {
      x = W - boxW - margin;
      y = H - boxH - margin;
    }

    wmCtx.globalAlpha = opacity;
    wmCtx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    wmCtx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    wmCtx.lineWidth = 1;
    const r = 8;
    wmCtx.beginPath();
    if (wmCtx.roundRect) wmCtx.roundRect(x, y, boxW, boxH, r);
    else wmCtx.rect(x, y, boxW, boxH);
    wmCtx.fill();
    wmCtx.stroke();

    wmCtx.fillStyle = '#ffffff';
    wmCtx.fillText(label, x + padX, y + boxH / 2);
    wmCtx.restore();

    cachedWatermarkKey = cacheKey;
    ctx.drawImage(cachedWatermarkCanvas, 0, 0);
  }

  function setChunkMode(mode) {
    S.chunkMode = mode;
    $$('.btn-chunk-mode').forEach(b => b.classList.toggle('active', b.getAttribute('data-chunk') === String(mode)));

    const allWords = [];
    S.captions.forEach(c => {
      (c.words || []).forEach(w => {
        allWords.push({
          t: w.t || w.word || '',
          s: typeof w.s === 'number' ? w.s : (typeof w.start === 'number' ? w.start : 0),
          e: typeof w.e === 'number' ? w.e : (typeof w.end === 'number' ? w.end : 0),
          key: Boolean(w.key)
        });
      });
    });

    if (!allWords.length) return;

    const newCaps = [];
    let cur = [];

    const flush = () => {
      if (!cur.length) return;
      const start = cur[0].s;
      const end = cur[cur.length - 1].e;
      const text = cur.map(w => w.t).join(' ');
      if (!cur.some(w => w.key)) cur[cur.length - 1].key = true;
      newCaps.push({
        id: newCaps.length + 1,
        start: Math.round(start * 100) / 100,
        end: Math.round(end * 100) / 100,
        text: text,
        words: cur.map(w => ({ ...w }))
      });
      cur = [];
    };

    if (mode === '1' || mode === 1) {
      allWords.forEach(w => {
        cur = [w];
        flush();
      });
    } else if (mode === 'sentence') {
      allWords.forEach((w, idx) => {
        cur.push(w);
        const isPunct = /[.!?]$/.test(w.t);
        const hasGap = (idx < allWords.length - 1) && (allWords[idx + 1].s - w.e > 0.6);
        if (isPunct || hasGap || cur.length >= 7) {
          flush();
        }
      });
      flush();
    } else {
      const per = 3;
      allWords.forEach(w => {
        cur.push(w);
        if (cur.length >= per) flush();
      });
      flush();
    }

    S.captions = newCaps;
    renderCaptionsList();
    renderTimeline();
    renderCanvas();
    showToast(`⚡ Chunks: ${mode === '1' ? '1 Word' : (mode === 'sentence' ? 'Sentence' : '2-3 Words')} applied!`);
  }

  function generateViralHooks() {
    const fullText = S.captions.map(c => c.text).join(' ');
    const words = fullText.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const stopWords = new Set(['this', 'that', 'with', 'from', 'have', 'what', 'your', 'about', 'video', 'just', 'like', 'there', 'their', 'when', 'which', 'will', 'then', 'they']);
    const topicWords = words.filter(w => !stopWords.has(w));
    const topicWord = topicWords[0] || 'secret';
    const topicWord2 = topicWords[1] || 'strategy';

    const hooks = [
      {
        badge: '🔥 HIGH CURIOSITY',
        text: `Wait until the very end, especially if you care about ${topicWord}! 🤫`
      },
      {
        badge: '🛑 STOP SCROLLING',
        text: `Stop scrolling! 99% of people get ${topicWord} completely wrong ❌`
      },
      {
        badge: '🚀 VIRAL VALUE',
        text: `Nobody is talking about this crazy ${topicWord} hack in 2026... 💡`
      }
    ];

    const aiCaption = `Here is the truth about ${topicWord} and ${topicWord2} that nobody talks about 👇\n\n` +
      `Most people make the mistake of overcomplicating things. Once you understand this one simple rule, everything shifts.\n\n` +
      `📌 Save this reel so you don't lose it later!\n` +
      `💬 Drop a comment below with your thoughts.\n` +
      `🚀 Follow for daily actionable tips!`;

    const hashtags = [
      `#${topicWord}`, `#${topicWord2}`, '#reels', '#viralreels', '#reelsindia',
      '#explorepage', '#trending', '#creator', '#contentcreator', '#hacks',
      '#growth', '#motivation', '#tipsandtricks', '#learn', '#dailyreels'
    ];

    const list = $('hooksList');
    if (!list) return;
    list.innerHTML = '';

    // 1. Hook Cards
    hooks.forEach(h => {
      const card = document.createElement('div');
      card.className = 'hook-card';
      card.innerHTML = `
        <div class="hook-info">
          <span class="hook-badge">${h.badge}</span>
          <div class="hook-text">${h.text}</div>
        </div>
        <div style="display:flex; gap:6px;">
          <button type="button" class="btn-insert-hook" title="Insert as 0s-3s first caption">+ Insert</button>
          <button type="button" class="btn-copy-hook" style="background:#27273a; border:1px solid rgba(255,255,255,0.15); border-radius:6px; color:#fff; padding:0 10px; cursor:pointer;" title="Copy Hook">📋</button>
        </div>
      `;
      card.querySelector('.btn-insert-hook').addEventListener('click', () => {
        insertHookCaption(h.text);
        $('modalHooks').classList.add('hidden');
      });
      card.querySelector('.btn-copy-hook').addEventListener('click', () => {
        navigator.clipboard.writeText(h.text).then(() => showToast('Hook copied to clipboard!'));
      });
      list.appendChild(card);
    });

    // 2. AI Ready-to-Post Caption & Hashtags Card
    const postCard = document.createElement('div');
    postCard.className = 'ai-caption-card';
    postCard.innerHTML = `
      <div class="ai-caption-header">
        <span class="ai-caption-title">📝 Ready-to-Post Instagram / Shorts Caption</span>
      </div>
      <div class="ai-caption-text">${aiCaption}</div>
      <div class="ai-hashtags-wrap">
        ${hashtags.map(t => `<span class="ai-tag-pill">${t}</span>`).join('')}
      </div>
      <button type="button" class="btn-copy-ai-post">
        <span>📋 Copy Full Post & Hashtags</span>
      </button>
    `;

    postCard.querySelector('.btn-copy-ai-post').addEventListener('click', () => {
      const fullPost = `${aiCaption}\n\n${hashtags.join(' ')}`;
      navigator.clipboard.writeText(fullPost).then(() => {
        showToast('✨ Caption & hashtags copied to clipboard!');
      });
    });

    list.appendChild(postCard);

    $('modalHooks').classList.remove('hidden');
  }

  function insertHookCaption(text) {
    const hookWords = text.split(' ').map((t, idx, arr) => {
      const dur = 2.8 / arr.length;
      return {
        t: t,
        s: Math.round((idx * dur) * 100) / 100,
        e: Math.round(((idx + 1) * dur) * 100) / 100,
        key: idx === arr.length - 1 || idx === 0
      };
    });

    S.captions.forEach(c => {
      if (c.start < 2.8) {
        const shift = 2.85 - c.start;
        c.start = Math.round((c.start + shift) * 100) / 100;
        c.end = Math.round((c.end + shift) * 100) / 100;
        (c.words || []).forEach(w => {
          w.s = Math.round((w.s + shift) * 100) / 100;
          w.e = Math.round((w.e + shift) * 100) / 100;
        });
      }
    });

    const hookCap = {
      id: Date.now(),
      start: 0.0,
      end: 2.8,
      text: text,
      words: hookWords
    };

    S.captions.unshift(hookCap);
    S.captions.sort((a, b) => a.start - b.start);
    vid.currentTime = 0.05;
    renderCaptionsList();
    renderTimeline();
    renderCanvas();
    showToast('🚀 Viral Hook inserted at 0.0s - 2.8s!');
  }

  function setupFontUploadHandler() {
    const btnUpload = $('btnUploadFont');
    const inputFont = $('inputCustomFont');
    if (!btnUpload || !inputFont) return;

    btnUpload.addEventListener('click', () => inputFont.click());
    inputFont.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      btnUpload.textContent = '⏳ Uploading font...';
      try {
        const buffer = await file.arrayBuffer();
        const familyName = file.name.replace(/\.[^/.]+$/, '');
        const fontFace = new FontFace(familyName, buffer);
        await fontFace.load();
        document.fonts.add(fontFace);

        const selectFont = $('selectFont');
        if (selectFont) {
          let opt = Array.from(selectFont.options).find(o => o.value === familyName);
          if (!opt) {
            opt = document.createElement('option');
            opt.value = familyName;
            opt.textContent = `${familyName} (Custom)`;
            selectFont.appendChild(opt);
          }
          selectFont.value = familyName;
          if (!S.style) S.style = {};
          S.style.font = familyName;
          S.style.fontFamily = familyName;
        }

        const fd = new FormData();
        fd.append('file', file);
        fetch('/api/upload_font', { method: 'POST', body: fd }).catch(err => console.warn('Font upload backend warn:', err));

        btnUpload.textContent = '✓ Font Loaded: ' + familyName;
        setTimeout(() => { btnUpload.textContent = '📁 Upload Custom Font (.ttf/.otf)'; }, 3500);
        showToast('🎨 Custom font ' + familyName + ' applied!');
        renderCanvas();
      } catch (err) {
        btnUpload.textContent = '❌ Upload failed';
        setTimeout(() => { btnUpload.textContent = '📁 Upload Custom Font (.ttf/.otf)'; }, 3000);
        showToast('Error loading font: ' + err.message);
      }
    });
  }

  function setupAspectRatioHandlers() {
    const stage = $('stage');
    $$('#aspectRatioBar .btn-aspect').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('#aspectRatioBar .btn-aspect').forEach(b => b.classList.toggle('active', b === btn));
        const aspect = btn.getAttribute('data-aspect') || 'original';
        S.aspect = aspect;

        if (stage) {
          stage.classList.remove('aspect-9-16', 'aspect-1-1', 'aspect-16-9');
          if (aspect === '9:16') stage.classList.add('aspect-9-16');
          else if (aspect === '1:1') stage.classList.add('aspect-1-1');
          else if (aspect === '16:9') stage.classList.add('aspect-16-9');
        }

        setupCanvasSizing();
        renderCanvas();
        showToast('📐 Ratio: ' + (btn.textContent.trim()) + ' selected');
      });
    });
  }

    function drawSampleCaptionPreview(ctx, W, H, st) {
    const sampleCap = {
      id: 'preview_sample',
      start: 0,
      end: 999,
      text: 'VIRAL AI CAPTIONS',
      words: [
        { t: 'VIRAL', s: 0, e: 999, key: false },
        { t: 'AI', s: 0, e: 999, key: false },
        { t: 'CAPTIONS', s: 0, e: 999, key: true }
      ]
    };
    const isBehind = Boolean(
      st && (
        st.behindPerson ||
        st.depthAccent ||
        (st.roles && st.roles.accent && st.roles.accent.layer === 'behind') ||
        (st.name && st.name.toLowerCase().includes('(behind)'))
      )
    );
    drawCanvasTypography(ctx, null, sampleCap, sampleCap.words, 0, st || {}, W, H, isBehind, true);
  }


// ==========================================================================
// IN-BROWSER BEHIND-PERSON SEGMENTATION (MEDIAPIPE TASKS VISION)
// ==========================================================================
let segmenterInstance = null;
let segmenterLoadingPromise = null;
let segmenterLoadFailed = false;

// Preview Segmentation Cache & Canvases (Singletons, reused every frame)
let liveDownscaleCanvas = null;
let liveDownscaleCtx = null;
let liveMaskRawCanvas = null;
let liveMaskRawCtx = null;
let liveImageData = null;
let liveFinalCanvas = null;
let liveFinalCtx = null;
let prevLiveMaskFloats = null;
let lastLiveSegTime = 0;
let lastLiveSegTimestampMs = -1;
let lastPausedSegTime = -1;
let lastLiveMaskCanvas = null;

let livePersonCanvas = null;
let livePersonCtx = null;
let liveBehindCanvas = null;
let liveBehindCtx = null;
let liveForeCanvas = null;
let liveForeCtx = null;

// Export Segmentation Canvases & Cache (Separate from preview, reused every frame)
let exportSegDownscaleCanvas = null;
let exportSegDownscaleCtx = null;
let exportSegMaskRawCanvas = null;
let exportSegMaskRawCtx = null;
let exportSegImageData = null;
let exportPrevMaskFloats = null;
let exportSegFinalCanvas = null;
let exportSegFinalCtx = null;

let segExportCleanCanvas = null;
let segExportCleanCtx = null;
let segExportCutoutCanvas = null;
let segExportCutoutCtx = null;
let segExportBehindCanvas = null;
let segExportBehindCtx = null;
let segExportForeCanvas = null;
let segExportForeCtx = null;

async function ensureSegmenterLoaded() {
  if (segmenterInstance) return segmenterInstance;
  if (segmenterLoadFailed) return null;
  if (segmenterLoadingPromise) return segmenterLoadingPromise;

  segmenterLoadingPromise = (async () => {
    try {
      showToast('⏳ Loading AI segmentation model...');
      if (!window.MediaPipeVision) {
        try {
          const mod = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm');
          window.MediaPipeVision = mod;
        } catch (importErr) {
          console.warn('Dynamic import fallback for MediaPipe Vision:', importErr);
        }
      }

      if (!window.MediaPipeVision || !window.MediaPipeVision.FilesetResolver) {
        throw new Error('MediaPipe Vision library not available on window');
      }

      const { FilesetResolver, ImageSegmenter } = window.MediaPipeVision;
      let vision = null;
      try {
        vision = await FilesetResolver.forVisionTasks('/static/mediapipe/wasm');
      } catch (localWasmErr) {
        console.warn('Local wasm failed, trying CDN wasm:', localWasmErr);
        vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
      }

      const modelPath = '/static/mediapipe/selfie_segmenter.tflite';

      try {
        segmenterInstance = await ImageSegmenter.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: modelPath,
            delegate: 'GPU'
          },
          runningMode: 'VIDEO',
          outputConfidenceMasks: true,
          outputCategoryMask: false
        });
      } catch (gpuErr) {
        console.warn('GPU delegate failed, falling back to CPU:', gpuErr);
        segmenterInstance = await ImageSegmenter.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: modelPath,
            delegate: 'CPU'
          },
          runningMode: 'VIDEO',
          outputConfidenceMasks: true,
          outputCategoryMask: false
        });
      }

      showToast('✨ AI Behind-Person model ready');
      return segmenterInstance;
    } catch (err) {
      console.warn('Behind-person segmentation model failed to load:', err);
      segmenterLoadFailed = true;
      showToast('Behind-person effect unavailable on this device');
      return null;
    } finally {
      segmenterLoadingPromise = null;
    }
  })();

  return segmenterLoadingPromise;
}

// PROBLEM A Point 2: Separate ImageSegmenter instance specifically for export
async function createExportSegmenter() {
  if (!window.MediaPipeVision) {
    try {
      const mod = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm');
      window.MediaPipeVision = mod;
    } catch (importErr) {
      console.warn('MediaPipe Vision import error for export segmenter:', importErr);
    }
  }

  if (!window.MediaPipeVision || !window.MediaPipeVision.FilesetResolver) {
    throw new Error('MediaPipe Vision library not available');
  }

  const { FilesetResolver, ImageSegmenter } = window.MediaPipeVision;
  let vision = null;
  try {
    vision = await FilesetResolver.forVisionTasks('/static/mediapipe/wasm');
  } catch (_) {
    vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
  }

  const modelPath = '/static/mediapipe/selfie_segmenter.tflite';

  try {
    return await ImageSegmenter.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: modelPath,
        delegate: 'GPU'
      },
      runningMode: 'VIDEO',
      outputConfidenceMasks: true,
      outputCategoryMask: false
    });
  } catch (gpuErr) {
    console.warn('[BEHIND] Export segmenter GPU failed, falling back to CPU:', gpuErr);
    return await ImageSegmenter.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: modelPath,
        delegate: 'CPU'
      },
      runningMode: 'VIDEO',
      outputConfidenceMasks: true,
      outputCategoryMask: false
    });
  }
}

// Preview mask helper with adaptive downscale (128px smooth, 160px balanced, 256px paused)
function getLivePersonMask(sourceCanvasOrFrame, timestampMs, targetW, targetH, isHighQuality = false, downscaleTarget = 160, enableBlur = true) {
  if (!segmenterInstance) return null;

  const srcW = sourceCanvasOrFrame.videoWidth || sourceCanvasOrFrame.width || 256;
  const srcH = sourceCanvasOrFrame.videoHeight || sourceCanvasOrFrame.height || 256;
  const outW = targetW || srcW;
  const outH = targetH || srcH;

  const targetLong = isHighQuality ? 256 : (downscaleTarget || 160);
  const downScale = Math.min(1, targetLong / Math.max(srcW, srcH));
  const downW = Math.max(64, Math.round(srcW * downScale));
  const downH = Math.max(64, Math.round(srcH * downScale));

  if (!liveDownscaleCanvas) {
    liveDownscaleCanvas = document.createElement('canvas');
    liveDownscaleCtx = liveDownscaleCanvas.getContext('2d', { willReadFrequently: true });
  }
  if (liveDownscaleCanvas.width !== downW || liveDownscaleCanvas.height !== downH) {
    liveDownscaleCanvas.width = downW;
    liveDownscaleCanvas.height = downH;
  }

  liveDownscaleCtx.drawImage(sourceCanvasOrFrame, 0, 0, downW, downH);

  let resultMaskCanvas = null;

  try {
    let validTime = Math.max(0, Number(timestampMs) || 0);
    if (validTime <= lastLiveSegTimestampMs) {
      validTime = lastLiveSegTimestampMs + 1;
    }
    lastLiveSegTimestampMs = validTime;

    segmenterInstance.segmentForVideo(liveDownscaleCanvas, validTime, (result) => {
      try {
        if (!result || !result.confidenceMasks || result.confidenceMasks.length === 0) return;
        const confidenceMask = result.confidenceMasks[0];
        const mW = confidenceMask.width;
        const mH = confidenceMask.height;
        const floatVals = confidenceMask.getAsFloat32Array();

        if (!liveMaskRawCanvas) {
          liveMaskRawCanvas = document.createElement('canvas');
          liveMaskRawCtx = liveMaskRawCanvas.getContext('2d');
        }
        if (liveMaskRawCanvas.width !== mW || liveMaskRawCanvas.height !== mH) {
          liveMaskRawCanvas.width = mW;
          liveMaskRawCanvas.height = mH;
        }

        if (!liveImageData || liveImageData.width !== mW || liveImageData.height !== mH) {
          liveImageData = liveMaskRawCtx.createImageData(mW, mH);
        }
        const data = liveImageData.data;
        const totalPx = floatVals.length;

        if (!prevLiveMaskFloats || prevLiveMaskFloats.length !== totalPx) {
          prevLiveMaskFloats = new Float32Array(totalPx);
          for (let i = 0; i < totalPx; i++) {
            prevLiveMaskFloats[i] = floatVals[i];
          }
        } else {
          for (let i = 0; i < totalPx; i++) {
            prevLiveMaskFloats[i] = floatVals[i] * 0.7 + prevLiveMaskFloats[i] * 0.3;
          }
        }

        let nonZero = 0;
        for (let i = 0; i < totalPx; i++) {
          const conf = prevLiveMaskFloats[i];
          const alpha = conf < 0.25 ? 0 : (conf > 0.75 ? 255 : Math.round(((conf - 0.25) / 0.5) * 255));
          if (alpha > 0) nonZero++;
          const idx = i * 4;
          data[idx] = 255;
          data[idx + 1] = 255;
          data[idx + 2] = 255;
          data[idx + 3] = alpha;
        }

        if (nonZero === 0) return;

        liveMaskRawCtx.putImageData(liveImageData, 0, 0);

        if (!liveFinalCanvas) {
          liveFinalCanvas = document.createElement('canvas');
          liveFinalCtx = liveFinalCanvas.getContext('2d');
        }
        if (liveFinalCanvas.width !== outW || liveFinalCanvas.height !== outH) {
          liveFinalCanvas.width = outW;
          liveFinalCanvas.height = outH;
        }

        liveFinalCtx.clearRect(0, 0, outW, outH);
        if (enableBlur || isHighQuality) {
          liveFinalCtx.filter = 'blur(1.5px)';
          liveFinalCtx.drawImage(liveMaskRawCanvas, 0, 0, outW, outH);
          liveFinalCtx.filter = 'none';
        } else {
          liveFinalCtx.drawImage(liveMaskRawCanvas, 0, 0, outW, outH);
        }

        resultMaskCanvas = liveFinalCanvas;
      } finally {
        // PROBLEM B Point 7: Free masks every time
        if (result.confidenceMasks) {
          result.confidenceMasks.forEach(m => {
            try { m.close(); } catch (_) {}
          });
        }
        try { result.close(); } catch (_) {}
      }
    });
  } catch (segErr) {
    console.warn('[BEHIND] Live preview segmentation error:', segErr);
    return null;
  }

  return resultMaskCanvas;
}

// PROBLEM A Point 2 & 3: Export person mask helper with strictly increasing timestamps
function getExportPersonMask(segmenter, sourceCanvasOrFrame, timestampMs, targetW, targetH) {
  if (!segmenter) return null;

  const srcW = sourceCanvasOrFrame.videoWidth || sourceCanvasOrFrame.width || 256;
  const srcH = sourceCanvasOrFrame.videoHeight || sourceCanvasOrFrame.height || 256;
  const outW = targetW || srcW;
  const outH = targetH || srcH;

  const downScale = Math.min(1, 192 / Math.max(srcW, srcH));
  const downW = Math.max(64, Math.round(srcW * downScale));
  const downH = Math.max(64, Math.round(srcH * downScale));

  if (!exportSegDownscaleCanvas) {
    exportSegDownscaleCanvas = document.createElement('canvas');
    exportSegDownscaleCtx = exportSegDownscaleCanvas.getContext('2d', { willReadFrequently: true });
  }
  if (exportSegDownscaleCanvas.width !== downW || exportSegDownscaleCanvas.height !== downH) {
    exportSegDownscaleCanvas.width = downW;
    exportSegDownscaleCanvas.height = downH;
  }

  exportSegDownscaleCtx.drawImage(sourceCanvasOrFrame, 0, 0, downW, downH);

  let resultMaskCanvas = null;

  try {
    segmenter.segmentForVideo(exportSegDownscaleCanvas, timestampMs, (result) => {
      try {
        if (!result || !result.confidenceMasks || result.confidenceMasks.length === 0) return;
        const confidenceMask = result.confidenceMasks[0];
        const mW = confidenceMask.width;
        const mH = confidenceMask.height;
        const floatVals = confidenceMask.getAsFloat32Array();

        if (!exportSegMaskRawCanvas) {
          exportSegMaskRawCanvas = document.createElement('canvas');
          exportSegMaskRawCtx = exportSegMaskRawCanvas.getContext('2d');
        }
        if (exportSegMaskRawCanvas.width !== mW || exportSegMaskRawCanvas.height !== mH) {
          exportSegMaskRawCanvas.width = mW;
          exportSegMaskRawCanvas.height = mH;
        }

        if (!exportSegImageData || exportSegImageData.width !== mW || exportSegImageData.height !== mH) {
          exportSegImageData = exportSegMaskRawCtx.createImageData(mW, mH);
        }
        const data = exportSegImageData.data;
        const totalPx = floatVals.length;

        if (!exportPrevMaskFloats || exportPrevMaskFloats.length !== totalPx) {
          exportPrevMaskFloats = new Float32Array(totalPx);
          for (let i = 0; i < totalPx; i++) {
            exportPrevMaskFloats[i] = floatVals[i];
          }
        } else {
          for (let i = 0; i < totalPx; i++) {
            exportPrevMaskFloats[i] = floatVals[i] * 0.7 + exportPrevMaskFloats[i] * 0.3;
          }
        }

        let nonZeroCount = 0;
        for (let i = 0; i < totalPx; i++) {
          const conf = exportPrevMaskFloats[i];
          const alpha = conf < 0.25 ? 0 : (conf > 0.75 ? 255 : Math.round(((conf - 0.25) / 0.5) * 255));
          if (alpha > 0) nonZeroCount++;
          const idx = i * 4;
          data[idx] = 255;
          data[idx + 1] = 255;
          data[idx + 2] = 255;
          data[idx + 3] = alpha;
        }

        // PROBLEM A Point 3: Verify mask is actually populated
        if (nonZeroCount === 0) return;

        exportSegMaskRawCtx.putImageData(exportSegImageData, 0, 0);

        if (!exportSegFinalCanvas) {
          exportSegFinalCanvas = document.createElement('canvas');
          exportSegFinalCtx = exportSegFinalCanvas.getContext('2d');
        }
        if (exportSegFinalCanvas.width !== outW || exportSegFinalCanvas.height !== outH) {
          exportSegFinalCanvas.width = outW;
          exportSegFinalCanvas.height = outH;
        }

        exportSegFinalCtx.clearRect(0, 0, outW, outH);
        exportSegFinalCtx.filter = 'blur(1.5px)';
        exportSegFinalCtx.drawImage(exportSegMaskRawCanvas, 0, 0, outW, outH);
        exportSegFinalCtx.filter = 'none';

        resultMaskCanvas = exportSegFinalCanvas;
      } finally {
        if (result.confidenceMasks) {
          result.confidenceMasks.forEach(m => {
            try { m.close(); } catch (_) {}
          });
        }
        try { result.close(); } catch (_) {}
      }
    });
  } catch (segErr) {
    console.warn('[BEHIND] Export segmentForVideo exception:', segErr);
    return null;
  }

  return resultMaskCanvas;
}

  function renderCanvas(isPreview = true) {
    const drawStart = performance.now();
    try {
      const effQuality = isPreview ? getEffectivePreviewQuality() : 'full';
      const cfg = PREVIEW_QUALITY_CONFIG[effQuality] || PREVIEW_QUALITY_CONFIG.balanced;
      const dpr = isPreview ? Math.min(cfg.maxDpr, window.devicePixelRatio || 1) : 1;

      const w = captionCanvas.width / dpr;
      const h = captionCanvas.height / dpr;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, captionCanvas.width, captionCanvas.height);
      ctx.scale(dpr, dpr);

      if (behindCtx) {
        behindCtx.setTransform(1, 0, 0, 1, 0, 0);
        behindCtx.clearRect(0, 0, behindCanvas.width, behindCanvas.height);
        behindCtx.scale(dpr, dpr);
      }
      if (personCtx) {
        personCtx.setTransform(1, 0, 0, 1, 0, 0);
        personCtx.clearRect(0, 0, personCanvas.width, personCanvas.height);
        personCtx.scale(dpr, dpr);
      }

      const t = vid.currentTime || 0;
      let activeCap = S.captions.find(c => t >= c.start && t <= c.end);

      // Requirement 6: Do less work when nothing changes / no active caption
      if (!activeCap) {
        if (S.captions.length > 0) {
          if (vid.paused) {
            activeCap = S.captions.find(c => t <= c.end) || S.captions[0];
          } else {
            if (!_overlayWasCleared) {
              drawWatermark(ctx, w, h);
              _overlayWasCleared = true;
            }
            if (isPreview) {
              const elp = performance.now() - drawStart;
              recordPreviewDrawTime(elp);
              updateDebugBadge(elp, effQuality);
            }
            return;
          }
        } else {
          drawSampleCaptionPreview(ctx, w, h, S.style || {});
          drawWatermark(ctx, w, h);
          _overlayWasCleared = false;
          if (isPreview) {
            const elp = performance.now() - drawStart;
            recordPreviewDrawTime(elp);
            updateDebugBadge(elp, effQuality);
          }
          return;
        }
      }
      _overlayWasCleared = false;

      const words = (activeCap.words || []).map(w => ({
        t: w.t || w.word || '',
        s: typeof w.s === 'number' ? w.s : (typeof w.start === 'number' ? w.start : 0),
        e: typeof w.e === 'number' ? w.e : (typeof w.end === 'number' ? w.end : 0),
        key: Boolean(w.key)
      }));

      // Check for Pop Studio Scene-Based Video Template
      const isPopStudio = Boolean(
        (S.style && S.style.videoTemplate === 'popStudio') ||
        (S.popStudioConfig && S.popStudioConfig.enabled)
      );

      if (isPopStudio) {
        const popBeat = getPopBeatAtTime(t, S.captions);
        const isCardScene = Boolean(popBeat && (popBeat.scene === 'S2' || popBeat.scene === 'S4' || popBeat.scene === 'S5'));
        if (isCardScene) {
          if (vid.style.opacity !== '0') vid.style.opacity = '0';
        } else {
          if (vid.style.opacity !== '1') vid.style.opacity = '1';
        }

        drawPopStudioFrame(ctx, behindCtx || ctx, t, w, h, isPreview, isCardScene ? vid : null);
        drawWatermark(ctx, w, h);

        if (isPreview) {
          const elp = performance.now() - drawStart;
          recordPreviewDrawTime(elp);
          updateDebugBadge(elp, effQuality);
        }
        return;
      } else {
        if (vid && vid.style.opacity !== '1') vid.style.opacity = '1';
      }

      const isBehind = Boolean(
        S.style && (
          S.style.behindPerson ||
          S.style.depthAccent ||
          (S.style.roles && S.style.roles.accent && S.style.roles.accent.layer === 'behind') ||
          (S.style.name && S.style.name.toLowerCase().includes('(behind)'))
        )
      );

      // Requirement 8: Stacked canvases - hero text (behindCanvas) -> personCutout (personCanvas) -> front text (captionCanvas)
      if (isBehind && activeCap && segmenterInstance && vid.readyState >= 2) {
        // Draw typography: front lines to ctx, behind words to behindCtx
        drawCanvasTypography(ctx, behindCtx || ctx, activeCap, words, t, S.style || {}, w, h, true, false, isPreview);

        // Throttled segmentation
        if (!vid.paused) {
          const minInterval = cfg.minMaskInterval;
          const now = performance.now();
          if (now - lastLiveSegTime >= minInterval) {
            lastLiveSegTime = now;
            const tMs = Math.round(t * 1000);
            const mask = getLivePersonMask(vid, tMs, w, h, false, cfg.maskDownscaleTarget, cfg.enableFilterBlur);
            if (mask) {
              lastLiveMaskCanvas = mask;
              _maskRunsInLastSec++;
            }
          }
        } else {
          // Paused: compute 1 high-quality mask and stop
          if (Math.abs(t - lastPausedSegTime) > 0.02 || !lastLiveMaskCanvas) {
            lastPausedSegTime = t;
            const tMs = Math.round(t * 1000);
            const mask = getLivePersonMask(vid, tMs, w, h, true, 192, true);
            if (mask) lastLiveMaskCanvas = mask;
          }
        }

        if (lastLiveMaskCanvas && personCtx) {
          // Person glow (only if level enables glow)
          if (cfg.enableGlow && ((S.realEstateConfig && S.realEstateConfig.enabled && S.realEstateConfig.personGlow !== false) || (S.style && S.style.videoTemplate === 'specialRealEstate'))) {
            const capIdxGlow = S.captions.indexOf(activeCap) !== -1 ? S.captions.indexOf(activeCap) : 0;
            const dataGlow = analyzeRealEstateCaption(activeCap, words, capIdxGlow);
            const glowColor = (dataGlow && dataGlow.palette && dataGlow.palette.accent) || '#00f5d4';
            personCtx.save();
            personCtx.shadowColor = glowColor;
            personCtx.shadowBlur = 8;
            personCtx.drawImage(lastLiveMaskCanvas, 0, 0, w, h);
            personCtx.restore();
          }

          // Person cutout directly drawn onto personCanvas (layer 3)
          personCtx.save();
          personCtx.drawImage(vid, 0, 0, w, h);
          personCtx.globalCompositeOperation = 'destination-in';
          personCtx.drawImage(lastLiveMaskCanvas, 0, 0, w, h);
          personCtx.restore();
        }

        drawAutoEmojis(ctx, activeCap, words, t, S.style || {}, w, h);
      } else {
        if (isBehind && activeCap && !segmenterInstance && !segmenterLoadingPromise && !segmenterLoadFailed) {
          ensureSegmenterLoaded().catch(() => {});
        }
        drawCanvasTypography(ctx, null, activeCap, words, t, S.style || {}, w, h, isBehind, false, isPreview);
        drawAutoEmojis(ctx, activeCap, words, t, S.style || {}, w, h);
      }

      drawRealEstateOverlays(ctx, w, h, t);
      drawWatermark(ctx, w, h);

      if (isPreview) {
        const elapsed = performance.now() - drawStart;
        recordPreviewDrawTime(elapsed);
        updateDebugBadge(elapsed, effQuality);
      }
    } catch (renderErr) {
      // Requirement 10: Safety fallback
      console.warn('[PREVIEW RENDER FALLBACK]', renderErr);
      try {
        drawCanvasTypography(ctx, null, activeCap, words, t, S.style || {}, w, h, isBehind, false, false);
      } catch (_) {}
    }
  }

  // ==========================================================================
  // MODALS HANDLERS (FULL TEMPLATES, SCRIPT SYNC, EXPORT)
  // ==========================================================================

  // ==========================================================================
  // B-ROLL SYSTEM & PEXELS INTEGRATION (FULL, ABOVE, BELOW, WINDOW / PIP)
  // ==========================================================================
  let pexelsOrientation = 'portrait';
  let isAutoBrolling = false;
  let lastActiveBrollId = null;

  const FILLER_WORDS_SET = new Set([
    'um', 'umm', 'ummm', 'uh', 'uhh', 'uhhh', 'er', 'err', 'ah', 'ahh', 'hmm', 'hmmm', 'mhm'
  ]);

  function isFillerWord(w) {
    if (!w) return false;
    const clean = String(w).toLowerCase().replace(/[^a-z]/g, '');
    return FILLER_WORDS_SET.has(clean);
  }

  // Remove silent / hesitation filler words ("um", "uh", "ah", "hmm") from captions
  function removeFillerWords(showFeedback = true) {
    if (!S.captions || S.captions.length === 0) {
      if (showFeedback) showToast('No captions loaded yet.');
      return 0;
    }

    let removedCount = 0;
    const newCaptions = [];

    for (const cap of S.captions) {
      const words = cap.words || [];
      const filteredWords = words.filter(w => {
        const text = w.t || w.word || '';
        if (isFillerWord(text)) {
          removedCount++;
          return false;
        }
        return true;
      });

      if (filteredWords.length > 0) {
        const newText = filteredWords.map(w => w.t || w.word || '').join(' ').trim();
        newCaptions.push({
          ...cap,
          text: newText,
          words: filteredWords,
          start: filteredWords[0].s !== undefined ? filteredWords[0].s : (filteredWords[0].start !== undefined ? filteredWords[0].start : cap.start),
          end: filteredWords[filteredWords.length - 1].e !== undefined ? filteredWords[filteredWords.length - 1].e : (filteredWords[filteredWords.length - 1].end !== undefined ? filteredWords[filteredWords.length - 1].end : cap.end)
        });
      }
    }

    S.captions = newCaptions;
    renderCaptionsList();
    renderTimeline();
    renderCanvas();

    if (showFeedback) {
      if (removedCount > 0) {
        showToast(`✂️ Removed ${removedCount} filler word${removedCount > 1 ? 's' : ''} ("um", "uh")!`);
      } else {
        showToast('✓ No filler words found — captions are already clean!');
      }
    }
    return removedCount;
  }

  // 1-Click Magic Auto Edit: cleans "um/uh", adds B-rolls (Circle, Above, Below) & enables transition SFX
  async function runAutoEdit() {
    if (!S.captions || S.captions.length === 0) {
      showToast('Please upload a video or transcribe captions first!');
      return;
    }

    const btnHeader = $('btnAutoEditHeader');
    const btnHero = $('btnAutoEditHero');
    if (btnHeader) {
      btnHeader.disabled = true;
      btnHeader.innerHTML = '<span class="auto-edit-sparkle">⏳</span><span>Auto Editing...</span>';
    }
    if (btnHero) btnHero.disabled = true;

    try {
      showToast('⚡ Running Magic Auto Edit...');

      // 1. Remove filler words ("um", "uh", "ah", "hmm")
      const removedFillers = removeFillerWords(false);

      // 2. Ensure Auto SFX is active for punchy B-roll transitions
      S.autoSfx = true;

      // 3. Auto Add B-Rolls with smart rotating layouts: circle, above, below, window, full
      const duration = vid.duration || S.probe?.duration || 0;
      let addedBrollsCount = 0;

      if (duration > 2) {
        const suggestRes = await fetch('/api/broll/suggest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ captions: S.captions, duration })
        });
        const suggestData = await suggestRes.json();
        const slots = suggestData.slots || [];

        if (slots.length > 0) {
          const layoutPattern = ['circle', 'above', 'below', 'window', 'full'];
          const newBrolls = [];

          for (let i = 0; i < slots.length; i++) {
            const slot = slots[i];
            try {
              const searchRes = await fetch('/api/broll/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: slot.query, orientation: pexelsOrientation })
              });
              const searchData = await searchRes.json();
              const results = searchData.results || [];
              if (results.length > 0) {
                const pick = results[0];
                const layout = layoutPattern[i % layoutPattern.length];
                newBrolls.push({
                  id: 'broll_' + Date.now() + '_' + i,
                  query: slot.query,
                  text: slot.text || slot.query,
                  start: Number(slot.start),
                  end: Number(slot.end),
                  url: pick.url,
                  thumb: pick.thumb,
                  duration: pick.duration || (slot.end - slot.start),
                  credit: pick.credit || '',
                  layout: layout
                });
              }
            } catch (_) {}
          }

          if (newBrolls.length > 0) {
            S.brolls = newBrolls;
            addedBrollsCount = newBrolls.length;
            renderBrollTab();
            syncBrollPlayback();
          }
        }
      }

      // 4. Feedback
      let msg = '⚡ Magic Auto Edit Complete!';
      if (removedFillers > 0 && addedBrollsCount > 0) {
        msg = `✨ Auto Edit: Removed ${removedFillers} "um/uh" fillers & added ${addedBrollsCount} B-rolls (Circle, Above, Below) with transition SFX!`;
      } else if (addedBrollsCount > 0) {
        msg = `✨ Auto Edit: Added ${addedBrollsCount} B-rolls (Circle, Above, Below) with transition SFX!`;
      } else if (removedFillers > 0) {
        msg = `✨ Auto Edit: Removed ${removedFillers} "um/uh" filler words!`;
      }
      showToast(msg);

      // Play transition whoosh sound effect and preview
      playSfx('whoosh');
      if (S.brolls && S.brolls.length > 0) {
        vid.currentTime = Math.max(0, S.brolls[0].start - 0.5);
        syncBrollPlayback();
        vid.play().catch(() => {});
      }

    } catch (err) {
      showToast('Auto Edit error: ' + err.message);
    } finally {
      if (btnHeader) {
        btnHeader.disabled = false;
        btnHeader.innerHTML = '<span class="auto-edit-sparkle">⚡</span><span>Auto Edit</span>';
      }
      if (btnHero) btnHero.disabled = false;
    }
  }

  function setupBrollHandlers() {
    const btnAutoEditHeader = $('btnAutoEditHeader');
    const btnAutoEditHero = $('btnAutoEditHero');
    const btnRemoveFillers = $('btnRemoveFillers');

    if (btnAutoEditHeader) btnAutoEditHeader.addEventListener('click', runAutoEdit);
    if (btnAutoEditHero) btnAutoEditHero.addEventListener('click', runAutoEdit);
    if (btnRemoveFillers) btnRemoveFillers.addEventListener('click', () => removeFillerWords(true));
    const btnAutoBroll = $('btnAutoBroll');
    const btnTogglePexelsSearch = $('btnTogglePexelsSearch');
    const btnSearchPexels = $('btnSearchPexels');
    const brollSearchInput = $('brollSearchInput');
    const brollOrientGroup = $('brollOrientGroup');
    const btnClearAllBrolls = $('btnClearAllBrolls');
    const btnSavePexelsKey = $('btnSavePexelsKey');
    const inputPexelsKey = $('inputPexelsKey');

    if (btnAutoBroll) {
      btnAutoBroll.addEventListener('click', autoAddBrolls);
    }

    if (btnTogglePexelsSearch) {
      btnTogglePexelsSearch.addEventListener('click', () => {
        const card = $('brollSearchCard');
        if (card) {
          card.scrollIntoView({ behavior: 'smooth' });
          if (brollSearchInput) brollSearchInput.focus();
        }
      });
    }

    if (btnSearchPexels && brollSearchInput) {
      btnSearchPexels.addEventListener('click', () => {
        const q = brollSearchInput.value.trim();
        if (q) searchPexels(q);
      });
      brollSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const q = brollSearchInput.value.trim();
          if (q) searchPexels(q);
        }
      });
    }

    if (brollOrientGroup) {
      $$('#brollOrientGroup .btn-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
          $$('#brollOrientGroup .btn-toggle').forEach(b => b.classList.toggle('active', b === btn));
          pexelsOrientation = btn.getAttribute('data-orient') || 'portrait';
          const q = (brollSearchInput ? brollSearchInput.value.trim() : '') || 'business';
          searchPexels(q);
        });
      });
    }

    if (btnClearAllBrolls) {
      btnClearAllBrolls.addEventListener('click', () => {
        if (!confirm('Remove all B-rolls from this video?')) return;
        S.brolls = [];
        renderBrollTab();
        syncBrollPlayback();
        showToast('All B-rolls removed');
      });
    }

    if (btnSavePexelsKey && inputPexelsKey) {
      btnSavePexelsKey.addEventListener('click', async () => {
        const key = inputPexelsKey.value.trim();
        if (!key) return;
        try {
          const res = await fetch('/api/broll/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to save key');
          const status = $('pexelsKeyStatus');
          if (status) status.textContent = '✓ Pexels API key saved successfully!';
          showToast('Pexels API key saved!');
        } catch (err) {
          showToast(err.message);
        }
      });
    }

    // Check if server already has Pexels key
    fetch('/api/broll/config')
      .then(r => r.json())
      .then(d => {
        const badge = $('brollKeyBadge');
        if (badge) {
          badge.textContent = d.has_key ? '✓ Pexels Connected' : 'Pexels Free Library';
        }
      })
      .catch(() => {});
  }

  // Auto-detect caption moments & fetch B-roll clips from Pexels
  async function autoAddBrolls() {
    if (isAutoBrolling) return;
    if (!S.captions || S.captions.length === 0) {
      showToast('Please add or transcribe captions first!');
      return;
    }

    const duration = vid.duration || S.probe?.duration || 0;
    if (duration <= 2) {
      showToast('Video duration is too short for B-Roll');
      return;
    }

    const msgEl = $('brollStatusMsg');
    const setMsg = (text) => {
      if (!msgEl) return;
      msgEl.classList.remove('hidden');
      msgEl.textContent = text;
    };

    isAutoBrolling = true;
    const btn = $('btnAutoBroll');
    if (btn) btn.disabled = true;

    try {
      setMsg('🔍 Analyzing captions to detect key viral moments...');

      const suggestRes = await fetch('/api/broll/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ captions: S.captions, duration })
      });
      const suggestData = await suggestRes.json();
      const slots = suggestData.slots || [];

      if (slots.length === 0) {
        setMsg('No suitable B-Roll keywords found in captions. Try searching manually below!');
        showToast('No B-Roll slots found');
        return;
      }

      setMsg(`✨ Found ${slots.length} moments! Fetching stock videos from Pexels...`);

      // Intelligent layout rotation: Circle, Above, Below, Window, Full
      const layoutPattern = ['circle', 'above', 'below', 'window', 'full'];
      const newBrolls = [];

      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        setMsg(`🎬 Fetching clip ${i + 1}/${slots.length} for "${slot.query}"...`);

        try {
          const searchRes = await fetch('/api/broll/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: slot.query, orientation: pexelsOrientation })
          });
          const searchData = await searchRes.json();
          const results = searchData.results || [];
          if (results.length > 0) {
            const pick = results[0];
            const layout = layoutPattern[i % layoutPattern.length];
            newBrolls.push({
              id: 'broll_' + Date.now() + '_' + i,
              query: slot.query,
              text: slot.text || slot.query,
              start: Number(slot.start),
              end: Number(slot.end),
              url: pick.url,
              thumb: pick.thumb,
              duration: pick.duration || (slot.end - slot.start),
              credit: pick.credit || '',
              layout: layout
            });
          }
        } catch (clipErr) {
          console.warn('Failed to fetch clip for slot:', slot, clipErr);
        }
      }

      if (newBrolls.length > 0) {
        S.brolls = newBrolls;
        renderBrollTab();
        syncBrollPlayback();
        setMsg(`✓ Successfully added ${newBrolls.length} B-Rolls with smart layouts!`);
        showToast(`✨ Added ${newBrolls.length} B-Rolls!`);
      } else {
        setMsg('Could not find videos on Pexels for those keywords. Search manually below.');
      }
    } catch (err) {
      setMsg('Error adding B-roll: ' + err.message);
      showToast(err.message);
    } finally {
      isAutoBrolling = false;
      if (btn) btn.disabled = false;
    }
  }

  // Search Pexels with query
  async function searchPexels(query) {
    const grid = $('pexelsResultsGrid');
    if (!grid) return;
    grid.classList.remove('hidden');
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:16px; color:#a1a1aa;">Searching Pexels for "' + escapeHtml(query) + '"...</div>';

    try {
      const res = await fetch('/api/broll/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, orientation: pexelsOrientation })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to search Pexels');
      const results = data.results || [];

      if (results.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:16px; color:#71717a;">No clips found for "' + escapeHtml(query) + '". Try another keyword.</div>';
        return;
      }

      grid.innerHTML = '';
      results.forEach((item, idx) => {
        const card = document.createElement('div');
        card.className = 'pexels-card';
        card.innerHTML = `
          <div class="pexels-thumb-wrap">
            <img src="${escapeHtml(item.thumb)}" class="pexels-thumb-img" alt="Pexels Video" loading="lazy">
            <span class="pexels-dur-badge">${Math.round(item.duration || 0)}s</span>
          </div>
          <div class="pexels-card-info">
            <span class="pexels-credit">By ${escapeHtml(item.credit || 'Pexels')}</span>
            <button type="button" class="btn-add-broll" data-idx="${idx}">+ Add to Video</button>
          </div>
        `;
        const btnAdd = card.querySelector('.btn-add-broll');
        btnAdd.addEventListener('click', () => {
          addBrollFromSearch(item, query);
        });
        grid.appendChild(card);
      });
    } catch (err) {
      grid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:16px; color:#ef4444;">' + escapeHtml(err.message) + '</div>';
    }
  }

  function addBrollFromSearch(item, query) {
    const curT = vid.currentTime || 0;
    const dur = Math.min(vid.duration || 30, curT + 3.0);
    const startT = Math.round(curT * 10) / 10;
    const endT = Math.round(dur * 10) / 10;

    const newBroll = {
      id: 'broll_' + Date.now(),
      query: query || 'Stock Video',
      start: startT,
      end: endT > startT ? endT : startT + 2.5,
      url: item.url,
      thumb: item.thumb,
      duration: item.duration || 3.0,
      credit: item.credit || '',
      layout: 'full'
    };

    if (!S.brolls) S.brolls = [];
    S.brolls.push(newBroll);
    S.brolls.sort((a, b) => a.start - b.start);
    renderBrollTab();
    syncBrollPlayback();
    showToast(`Added B-Roll clip at ${startT}s!`);
  }

  // Render the B-Roll tab list
  function renderBrollTab() {
    const list = $('brollList');
    const badge = $('brollCountBadge');
    const btnClear = $('btnClearAllBrolls');
    if (!list) return;

    const brolls = S.brolls || [];
    if (badge) badge.textContent = brolls.length;
    if (btnClear) btnClear.style.display = brolls.length > 0 ? 'inline-block' : 'none';

    if (brolls.length === 0) {
      list.innerHTML = `
        <div class="broll-empty-state" id="brollEmptyState">
          <div class="empty-icon">🎬</div>
          <p>No B-Rolls added yet.</p>
          <p class="empty-sub">Click <strong>Auto Add B-Rolls</strong> to generate clips automatically from your captions, or search Pexels above.</p>
        </div>
      `;
      return;
    }

    list.innerHTML = '';
    brolls.forEach((b, idx) => {
      const card = document.createElement('div');
      card.className = 'broll-card';
      const layout = b.layout || 'full';

      card.innerHTML = `
        <div class="broll-card-top">
          <img src="${escapeHtml(b.thumb || '')}" class="broll-card-thumb" alt="B-Roll" onerror="this.style.display='none'">
          <div class="broll-card-meta">
            <span class="broll-card-title">🎬 #${idx + 1}: ${escapeHtml(b.query || 'Stock Clip')}</span>
            <span class="broll-card-timing">${b.start}s - ${b.end}s (${Math.round((b.end - b.start) * 10) / 10}s)</span>
          </div>
          <button type="button" class="btn-del-broll" title="Delete B-roll">🗑️</button>
        </div>

        <div class="broll-layout-selector-wrap">
          <span class="broll-layout-label">Display Layout</span>
          <div class="broll-layout-selector">
            <button type="button" class="broll-layout-btn ${layout === 'full' ? 'active' : ''}" data-layout="full" title="Fullscreen (Cover 100%)">
              <span class="layout-btn-icon">🖥️</span>
              <span>Full</span>
            </button>
            <button type="button" class="broll-layout-btn ${layout === 'above' ? 'active' : ''}" data-layout="above" title="Top 50% Split (Speaker Below)">
              <span class="layout-btn-icon">⬆️</span>
              <span>Above</span>
            </button>
            <button type="button" class="broll-layout-btn ${layout === 'below' ? 'active' : ''}" data-layout="below" title="Bottom 50% Split (Speaker Above)">
              <span class="layout-btn-icon">⬇️</span>
              <span>Below</span>
            </button>
            <button type="button" class="broll-layout-btn ${layout === 'circle' ? 'active' : ''}" data-layout="circle" title="Circular Bubble">
              <span class="layout-btn-icon">⭕</span>
              <span>Circle</span>
            </button>
            <button type="button" class="broll-layout-btn ${layout === 'window' ? 'active' : ''}" data-layout="window" title="Small Picture-in-Picture Floating Window">
              <span class="layout-btn-icon">🪟</span>
              <span>Window</span>
            </button>
          </div>
        </div>

        <div class="broll-time-row">
          <div class="broll-time-group">
            <span>In:</span>
            <input type="number" step="0.1" min="0" class="broll-time-input input-broll-start" value="${b.start}">
            <span>s</span>
          </div>
          <div class="broll-time-group">
            <span>Out:</span>
            <input type="number" step="0.1" min="0" class="broll-time-input input-broll-end" value="${b.end}">
            <span>s</span>
          </div>
          <button type="button" class="btn-preview-broll">
            <span>▶</span> Preview
          </button>
        </div>
      `;

      // Layout selector buttons
      card.querySelectorAll('.broll-layout-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const newLayout = btn.getAttribute('data-layout');
          b.layout = newLayout;
          card.querySelectorAll('.broll-layout-btn').forEach(b2 => b2.classList.toggle('active', b2 === btn));
          syncBrollPlayback();
        });
      });

      // Time inputs
      const inStart = card.querySelector('.input-broll-start');
      const inEnd = card.querySelector('.input-broll-end');
      inStart.addEventListener('change', () => {
        const val = parseFloat(inStart.value) || 0;
        b.start = Math.max(0, val);
        card.querySelector('.broll-card-timing').textContent = `${b.start}s - ${b.end}s (${Math.round((b.end - b.start) * 10) / 10}s)`;
        syncBrollPlayback();
      });
      inEnd.addEventListener('change', () => {
        const val = parseFloat(inEnd.value) || b.start + 1;
        b.end = Math.max(b.start + 0.5, val);
        card.querySelector('.broll-card-timing').textContent = `${b.start}s - ${b.end}s (${Math.round((b.end - b.start) * 10) / 10}s)`;
        syncBrollPlayback();
      });

      // Preview button
      const btnPrev = card.querySelector('.btn-preview-broll');
      btnPrev.addEventListener('click', () => {
        vid.currentTime = Math.max(0, b.start);
        syncBrollPlayback();
        vid.play().catch(() => {});
      });

      // Delete button
      const btnDel = card.querySelector('.btn-del-broll');
      btnDel.addEventListener('click', () => {
        S.brolls.splice(idx, 1);
        renderBrollTab();
        syncBrollPlayback();
        showToast('B-roll removed');
      });

      list.appendChild(card);
    });
  }


  // Dynamic Auto-Zoom (Slow, calm, user-configurable retention zoom)
  function syncAutoZoom() {
    if ((S.realEstateConfig && S.realEstateConfig.enabled && S.realEstateConfig.cameraPunch !== false) || (S.style && S.style.videoTemplate === 'specialRealEstate')) {
      const punchScale = getRealEstateCameraPunch(vid.currentTime || 0, S.captions);
      if (punchScale > 1.001) {
        const scaleStr = `scale(${punchScale.toFixed(4)})`;
        [vid, captionCanvas, behindCanvas, personCanvas].forEach(el => {
          if (el) {
            el.style.transform = scaleStr;
            el.style.transformOrigin = 'center center';
          }
        });
        return;
      }
    }
    [captionCanvas, behindCanvas, personCanvas].forEach(el => {
      if (el && el.style.transform) el.style.transform = '';
    });
    if (!S.autoZoom || !S.autoZoom.enabled) {
      vid.style.transform = 'scale(1.0)';
      return;
    }
    const az = S.autoZoom;
    const t = vid.currentTime || 0;
    let isZoomed = false;
    if (az.interval > 0) {
      isZoomed = (t % az.interval) < (az.duration || 3.5);
    } else {
      // Key emphasis moments (alternating every 4th line for subtle punch)
      const activeCapIdx = S.captions.findIndex(c => t >= c.start && t <= c.end);
      isZoomed = activeCapIdx !== -1 && activeCapIdx % 4 === 1;
    }
    const scaleVal = isZoomed ? (az.scale || 1.10) : 1.0;
    const speedVal = az.speed || 0.6;
    vid.style.transform = `scale(${scaleVal})`;
    vid.style.transition = `transform ${speedVal}s cubic-bezier(0.25, 1, 0.5, 1)`;
  }

  // Animated Reel Progress Bar
  function syncReelProgressBar() {
    const bar = $('reelProgressBar');
    const fill = $('reelProgressFill');
    if (!bar || !fill) return;
    if (!S.progressBar || S.progressBar.enabled === false) {
      bar.style.display = 'none';
      return;
    }
    bar.style.display = 'block';
    bar.classList.toggle('position-top', S.progressBar.position === 'top');
    const dur = vid.duration || S.probe?.duration || 0;
    const t = vid.currentTime || 0;
    const pct = dur > 0 ? Math.min(100, Math.max(0, (t / dur) * 100)) : 0;
    fill.style.width = pct + '%';
  }

  // Live real-time B-Roll playback sync with main video
  function syncBrollPlayback() {
    const brollLayer = $('brollStageLayer');
    const brollVid = $('brollVid');
    if (!brollLayer || !brollVid) return;

    const t = vid.currentTime || 0;
    const activeBroll = (S.brolls || []).find(b => b.url && t >= b.start && t <= b.end);

    if (!activeBroll) {
      brollLayer.classList.add('hidden');
      if (!brollVid.paused) {
        brollVid.pause();
      }
      lastActiveBrollId = null;
      return;
    }

    // Play punchy transition whoosh sound effect when a B-Roll appears!
    if (activeBroll.id !== lastActiveBrollId) {
      lastActiveBrollId = activeBroll.id;
      if (!vid.paused && S.autoSfx !== false) {
        playSfx('whoosh');
      }
    }

    // Active B-Roll found
    brollLayer.classList.remove('hidden');

    // Update layout classes
    brollLayer.classList.remove('broll-layout-full', 'broll-layout-above', 'broll-layout-below', 'broll-layout-window', 'broll-layout-circle');
    const layout = activeBroll.layout || 'full';
    brollLayer.classList.add('broll-layout-' + layout);

    // Trigger slick pop / slide entry animations
    if (activeBroll.id !== lastActiveBrollId) {
      brollLayer.classList.remove('broll-animate-pop', 'broll-animate-slide-down', 'broll-animate-slide-up');
      void brollLayer.offsetWidth; // trigger reflow
      if (layout === 'circle' || layout === 'window') {
        brollLayer.classList.add('broll-animate-pop');
      } else if (layout === 'above') {
        brollLayer.classList.add('broll-animate-slide-down');
      } else if (layout === 'below') {
        brollLayer.classList.add('broll-animate-slide-up');
      }
    }

    // Sync video source
    if (brollVid.src !== activeBroll.url && brollVid.currentSrc !== activeBroll.url) {
      brollVid.src = activeBroll.url;
      brollVid.load();
    }

    // Sync playback offset
    const offset = Math.max(0, t - activeBroll.start);
    if (Math.abs(brollVid.currentTime - offset) > 0.3) {
      brollVid.currentTime = offset;
    }

    // Match play/pause state
    if (!vid.paused && brollVid.paused) {
      brollVid.play().catch(() => {});
    } else if (vid.paused && !brollVid.paused) {
      brollVid.pause();
    }
  }

  function setupModalHandlers() {
    const btnViralHooks = $('btnViralHooks');
    const modalHooks = $('modalHooks');
    const btnCloseHooksModal = $('btnCloseHooksModal');

    if (btnViralHooks) {
      btnViralHooks.addEventListener('click', generateViralHooks);
    }
    if (btnCloseHooksModal && modalHooks) {
      btnCloseHooksModal.addEventListener('click', () => modalHooks.classList.add('hidden'));
      modalHooks.addEventListener('click', (e) => {
        if (e.target === modalHooks) modalHooks.classList.add('hidden');
      });
    }

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

    btnExport.addEventListener('click', () => { updateQualityPillsUI(); startExport(); });

    btnCloseExportModal.addEventListener('click', () => {
      modalExport.classList.add('hidden');
      if (activeDirectExport) {
        try { activeDirectExport.stop(); } catch (_) {}
        activeDirectExport = null;
      }
      if (S.exportTimer) clearInterval(S.exportTimer);
      if (exportElapsedInterval) clearInterval(exportElapsedInterval);
      stopTitleFlash();
    });

    btnRetryExport.addEventListener('click', startExport);
  
  // Initialize Special Real Estate Video Template UI Controls
  function initSpecialRealEstateUI() {
    const toggle = $('toggleSpecialRealEstate');
    const body = $('vtemplateRealEstateBody');
    const chkPunch = $('chkRealEstatePunch');
    const chkGlow = $('chkRealEstateGlow');
    const chkLowerThird = $('chkRealEstateLowerThird');
    const chkLocation = $('chkRealEstateLocation');
    const chkDepthShadow = $('chkRealEstateDepthShadow');
    const isPhoneUser = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (window.innerWidth <= 768 && !/iPad/i.test(navigator.userAgent));
    if (chkDepthShadow) {
      chkDepthShadow.checked = !isPhoneUser;
      if (!S.realEstateConfig) S.realEstateConfig = {};
      S.realEstateConfig.depthShadow = !isPhoneUser;
      chkDepthShadow.addEventListener('change', () => {
        if (!S.realEstateConfig) S.realEstateConfig = {};
        S.realEstateConfig.depthShadow = chkDepthShadow.checked;
        renderCanvas();
      });
    }
    const inputName = $('inputRealEstateName');
    const inputRole = $('inputRealEstateRole');

    if (toggle) {
      toggle.addEventListener('change', () => {
        const enabled = toggle.checked;
        if (!S.realEstateConfig) S.realEstateConfig = {};
        S.realEstateConfig.enabled = enabled;
        if (body) body.classList.toggle('is-disabled', !enabled);

        if (enabled) {
          if (!S.style) S.style = {};
          S.style.videoTemplate = 'specialRealEstate';
          S.style.behindPerson = false;
          showToast('👑 Special Real Estate Template activated (Bottom Placement)!');
        } else {
          if (S.style && S.style.videoTemplate === 'specialRealEstate') {
            delete S.style.videoTemplate;
          }
        }
        renderCanvas();
      });
    }

    // Palette Swatches
    const swatches = $$('#realEstatePaletteSwatches .swatch-pill');
    swatches.forEach(btn => {
      btn.addEventListener('click', () => {
        swatches.forEach(b => b.classList.toggle('active', b === btn));
        const pal = btn.getAttribute('data-palette') || 'auto';
        if (!S.realEstateConfig) S.realEstateConfig = {};
        S.realEstateConfig.paletteLock = pal;
        showToast('🎨 Palette set to: ' + pal.toUpperCase());
        renderCanvas();
      });
    });

    if (chkPunch) {
      chkPunch.addEventListener('change', () => {
        if (!S.realEstateConfig) S.realEstateConfig = {};
        S.realEstateConfig.cameraPunch = chkPunch.checked;
        renderCanvas();
      });
    }

    if (chkGlow) {
      chkGlow.addEventListener('change', () => {
        if (!S.realEstateConfig) S.realEstateConfig = {};
        S.realEstateConfig.personGlow = chkGlow.checked;
        renderCanvas();
      });
    }

    if (chkLowerThird) {
      chkLowerThird.addEventListener('change', () => {
        if (!S.realEstateConfig) S.realEstateConfig = {};
        S.realEstateConfig.lowerThird = chkLowerThird.checked;
        renderCanvas();
      });
    }

    if (chkLocation) {
      chkLocation.addEventListener('change', () => {
        if (!S.realEstateConfig) S.realEstateConfig = {};
        S.realEstateConfig.locationTag = chkLocation.checked;
        renderCanvas();
      });
    }

    if (inputName) {
      inputName.addEventListener('input', () => {
        if (!S.realEstateConfig) S.realEstateConfig = {};
        S.realEstateConfig.presenterName = inputName.value;
        renderCanvas();
      });
    }

    if (inputRole) {
      inputRole.addEventListener('input', () => {
        if (!S.realEstateConfig) S.realEstateConfig = {};
        S.realEstateConfig.presenterRole = inputRole.value;
        renderCanvas();
      });
    }

    // BIG TYPE TOGGLE CONTROLLER
    const chkBigType = $('chkRealEstateBigType');
    const btnBigTypeOn = $('btnBigTypeOn');
    const btnBigTypeOff = $('btnBigTypeOff');
    const valBigTypeBadge = $('valBigTypeBadge');

    function setBigTypeEnabled(enabled) {
      S.bigType = enabled;
      if (!S.style) S.style = {};
      S.style.bigType = enabled;
      if (!S.realEstateConfig) S.realEstateConfig = {};
      S.realEstateConfig.bigType = enabled;

      if (chkBigType) chkBigType.checked = enabled;
      if (btnBigTypeOn) btnBigTypeOn.classList.toggle('active', enabled);
      if (btnBigTypeOff) btnBigTypeOff.classList.toggle('active', !enabled);
      if (valBigTypeBadge) {
        valBigTypeBadge.textContent = enabled ? 'ON' : 'OFF';
        valBigTypeBadge.className = 'val-badge ' + (enabled ? 'badge-green' : 'badge-gray');
      }

      _bigTypeLayoutCache.clear();
      showToast('Big Type: ' + (enabled ? 'ON' : 'OFF'));
      renderCanvas(true);
    }

    if (chkBigType) {
      chkBigType.checked = S.bigType !== false;
      chkBigType.addEventListener('change', () => setBigTypeEnabled(chkBigType.checked));
    }
    if (btnBigTypeOn) btnBigTypeOn.addEventListener('click', () => setBigTypeEnabled(true));
    if (btnBigTypeOff) btnBigTypeOff.addEventListener('click', () => setBigTypeEnabled(false));
  }

  initSpecialRealEstateUI();
  initPopStudioUI();
  setupQualityPills();
    setupPreviewPerfModeToggle();
  }

  
  function updateQualityPillsUI() {
    const curQ = S.exportQuality || 'balanced';
    $$('.btn-quality-pill').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-quality') === curQ);
    });
    const stepFinalizeTitle = $('stepFinalizeTitle');
    if (stepFinalizeTitle) {
      if (curQ === 'fast') stepFinalizeTitle.textContent = '960p MP4';
      else if (curQ === 'high') stepFinalizeTitle.textContent = '1080p MP4';
      else stepFinalizeTitle.textContent = '720p MP4';
    }
  }

  
  function setupPreviewPerfModeToggle() {
    const btn = $('btnPreviewPerfMode');
    const label = $('previewPerfModeLabel');
    function updateUI() {
      const isOn = Boolean(S.previewPerfMode);
      if (btn) btn.classList.toggle('active', isOn);
      if (label) label.textContent = isOn ? 'Perf Mode: ON' : 'Perf Mode: OFF';
    }
    if (btn) {
      btn.addEventListener('click', () => {
        S.previewPerfMode = !S.previewPerfMode;
        try { localStorage.setItem('cs_preview_perf_mode', String(S.previewPerfMode)); } catch (_) {}
        updateUI();
        showToast(S.previewPerfMode ? '⚡ Performance mode ON (~8fps masks, ~160px)' : '💎 High rate mode ON (~15fps masks)', 2000);
        renderCanvas();
      });
    }
    updateUI();
  }

  function setupQualityPills() {
    $$('.btn-quality-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const q = btn.getAttribute('data-quality');
        if (!q || q === S.exportQuality) return;
        S.exportQuality = q;
        try { localStorage.setItem('captionstudio_export_quality', q); } catch (_) {}
        updateQualityPillsUI();
        if (activeDirectExport) {
          try { activeDirectExport.stop(); } catch (_) {}
          setTimeout(() => {
            if (!modalExport.classList.contains('hidden')) {
              startExport();
            }
          }, 80);
        }
      });
    });
    updateQualityPillsUI();
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
  // VIDEO EXPORT WITH REALTIME PIPELINE & COMPLETION NOTIFICATIONS
  // ==========================================================================
  let titleFlashInterval = null;
  let originalDocumentTitle = document.title;
  let exportStartTime = 0;
  let exportElapsedInterval = null;

  function stopTitleFlash() {
    if (titleFlashInterval) {
      clearInterval(titleFlashInterval);
      titleFlashInterval = null;
    }
    document.title = originalDocumentTitle;
  }

  function startTitleFlash() {
    stopTitleFlash();
    originalDocumentTitle = document.title;
    let flash = false;
    titleFlashInterval = setInterval(() => {
      document.title = flash ? '🎬 (Video Ready!) Download Captions' : '✨ Hlo Captions';
      flash = !flash;
    }, 1000);
    window.addEventListener('focus', stopTitleFlash, { once: true });
    document.addEventListener('click', stopTitleFlash, { once: true });
  }

  function playSuccessChime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        const startTime = ctx.currentTime + (i * 0.08);
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.2, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.55);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + 0.6);
      });
    } catch (e) {
      console.warn('Audio chime notice:', e);
    }
  }

  function formatTimeElapsed(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  function updateExportPipeline(step, statusText1, statusText2) {
    const s1 = $('stepCaptions');
    const s2 = $('stepFinalize');
    const st1 = $('stepStatus1');
    const st2 = $('stepStatus2');

    if (!s1 || !s2) return;

    s1.className = 'export-step-item';
    s2.className = 'export-step-item';

    if (step === 1) {
      s1.classList.add('active');
      if (st1) st1.textContent = statusText1 || 'Rendering...';
      if (st2) st2.textContent = statusText2 || 'Queued';
    } else if (step === 2) {
      s1.classList.add('completed');
      s2.classList.add('active');
      if (st1) st1.textContent = statusText1 || 'Done ✓';
      if (st2) st2.textContent = statusText2 || 'Encoding MP4...';
    } else if (step === 3) {
      s1.classList.add('completed');
      s2.classList.add('completed');
      if (st1) st1.textContent = 'Done ✓';
      if (st2) st2.textContent = 'Done ✓';
    }
  }


  // Web Audio OfflineAudioContext helper for multi-track audio mixing
  async function mixExportAudio(duration, videoBlobOrUrl) {
    const sampleRate = 44100;
    const totalFrames = Math.max(1, Math.ceil(duration * sampleRate));
    const offlineCtx = new OfflineAudioContext(2, totalFrames, sampleRate);

    const replaceOriginal = Boolean(
      S.voiceoverFilename &&
      btnReplaceVoiceover &&
      btnReplaceVoiceover.classList.contains('active')
    );

    async function decodeAudioSource(src) {
      if (!src) return null;
      try {
        let arrayBuf = null;
        if (typeof src === 'string') {
          const res = await fetch(src);
          if (!res.ok) return null;
          arrayBuf = await res.arrayBuffer();
        } else if (src instanceof Blob) {
          arrayBuf = await src.arrayBuffer();
        }
        if (arrayBuf && arrayBuf.byteLength > 0) {
          const tempCtx = new (window.AudioContext || window.webkitAudioContext)();
          const audioBuf = await tempCtx.decodeAudioData(arrayBuf);
          try { tempCtx.close(); } catch (_) {}
          return audioBuf;
        }
      } catch (err) {
        console.warn('Audio decode error:', err);
      }
      return null;
    }

    let hasAudioTrack = false;

    // 1. Voiceover (if replacing original) OR Original Video Audio
    if (replaceOriginal && S.voiceoverFilename) {
      const voBuf = await decodeAudioSource('/work/' + encodeURIComponent(S.voiceoverFilename));
      if (voBuf) {
        const voNode = offlineCtx.createBufferSource();
        voNode.buffer = voBuf;
        voNode.connect(offlineCtx.destination);
        voNode.start(0);
        hasAudioTrack = true;
      }
    } else if (videoBlobOrUrl) {
      const origBuf = await decodeAudioSource(videoBlobOrUrl);
      if (origBuf) {
        const origNode = offlineCtx.createBufferSource();
        origNode.buffer = origBuf;
        const gainNode = offlineCtx.createGain();
        gainNode.gain.value = S.vidVolume != null ? S.vidVolume : 1.0;
        origNode.connect(gainNode);
        gainNode.connect(offlineCtx.destination);
        origNode.start(0);
        hasAudioTrack = true;
      }
    }

    // 2. Background Music (looped to video length with S.bgmVolume)
    if (S.bgmFilename) {
      let bgmBuf = await decodeAudioSource('/work/' + encodeURIComponent(S.bgmFilename));
      if (!bgmBuf) {
        bgmBuf = await decodeAudioSource('/static/samples/' + encodeURIComponent(S.bgmFilename));
      }
      if (bgmBuf) {
        const bgmNode = offlineCtx.createBufferSource();
        bgmNode.buffer = bgmBuf;
        bgmNode.loop = true;
        const bgmGain = offlineCtx.createGain();
        bgmGain.gain.value = S.bgmVolume != null ? S.bgmVolume : 0.3;
        bgmNode.connect(bgmGain);
        bgmGain.connect(offlineCtx.destination);
        bgmNode.start(0);
        hasAudioTrack = true;
      }
    }

    if (!hasAudioTrack) return null;
    return await offlineCtx.startRendering();
  }

  let activeDirectExport = null;
  async function startFrameExport() {
    if (!window.Mediabunny) {
      try {
        window.Mediabunny = await import('https://cdn.jsdelivr.net/npm/mediabunny@1.65.0/+esm');
      } catch (e) {
        throw new Error('Mediabunny is not loaded: ' + e.message);
      }
    }

    const { Input, Output, Mp4OutputFormat, BufferTarget, ALL_FORMATS, BlobSource, UrlSource } = window.Mediabunny;

    const isBehindExport = Boolean(
                  (S.style && (
        S.style.behindPerson ||
        S.style.depthAccent ||
        (S.style.roles && S.style.roles.accent && S.style.roles.accent.layer === 'behind') ||
        (S.style.name && S.style.name.toLowerCase().includes('(behind)'))
      ))
    );

    // PROBLEM A Point 2: Create a SEPARATE ImageSegmenter instance just for export
    let exportSegmenter = null;
    if (isBehindExport && S.captions && S.captions.length > 0) {
      try {
        exportSegmenter = await createExportSegmenter();
      } catch (segLoadErr) {
        throw new Error('Behind-person export segmenter initialization failed: ' + (segLoadErr.message || segLoadErr));
      }
    }

    let source = null;
    let videoBlobUrl = null;

    // (a) S.file as Mediabunny BlobSource whenever it exists
    if (S.file && (S.file instanceof Blob || S.file instanceof File)) {
      source = new BlobSource(S.file);
      try { videoBlobUrl = URL.createObjectURL(S.file); } catch (_) {}
    } else {
      // (b) If S.file is missing, fetch video URL ONCE, convert response to Blob, use BlobSource
      let videoUrl = '';
      if (vid.src && vid.src.startsWith('blob:')) {
        videoUrl = vid.src;
      } else if (S.filename) {
        videoUrl = new URL('/video/' + encodeURIComponent(S.filename), window.location.href).href;
      } else if (vid.src) {
        videoUrl = new URL(vid.src, window.location.href).href;
      }

      if (videoUrl) {
        try {
          const res = await fetch(videoUrl);
          if (!res.ok) throw new Error(`HTTP ${res.status} fetching video blob`);
          const blobData = await res.blob();
          source = new BlobSource(blobData);
          try { videoBlobUrl = URL.createObjectURL(blobData); } catch (_) {}
        } catch (fetchErr) {
          console.warn('Blob fetch failed, falling back to UrlSource:', fetchErr);
          // (c) Only if that fails, use UrlSource
          try {
            source = new UrlSource(videoUrl);
          } catch (urlErr) {
            console.error('UrlSource failed:', urlErr);
          }
        }
      }
    }

    if (!source) {
      throw new Error('No video source available for frame export');
    }

    // Request Screen Wake Lock during export
    let wakeLock = null;
    try {
      if ('wakeLock' in navigator && navigator.wakeLock && typeof navigator.wakeLock.request === 'function') {
        wakeLock = await navigator.wakeLock.request('screen');
      }
    } catch (wlErr) {
      console.warn('Wake Lock request error (ignored):', wlErr);
    }

    try {
      const input = new Input({
        formats: ALL_FORMATS,
        source: source,
      });

      const output = new Output({
        format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
        target: new BufferTarget(),
      });

      const rawW = vid.videoWidth || S.probe?.width || 1280;
      const rawH = vid.videoHeight || S.probe?.height || 720;
      let targetW = rawW;
      let targetH = rawH;

      let maxLongSide = 1280;
      const curQ = S.exportQuality || 'balanced';
      if (curQ === 'fast') {
        maxLongSide = 960;
      } else if (curQ === 'high') {
        maxLongSide = 1920;
      } else {
        maxLongSide = 1280;
      }

      const currentLongSide = Math.max(targetW, targetH);
      if (currentLongSide > maxLongSide) {
        const scale = maxLongSide / currentLongSide;
        targetW = Math.round(targetW * scale);
        targetH = Math.round(targetH * scale);
      }
      targetW = targetW % 2 === 0 ? targetW : targetW - 1;
      targetH = targetH % 2 === 0 ? targetH : targetH - 1;
      targetW = Math.max(2, targetW);
      targetH = Math.max(2, targetH);

      let targetBitrate = 4000000;
      const chosenLong = Math.max(targetW, targetH);
      if (chosenLong <= 960) {
        targetBitrate = 2500000;
      } else if (chosenLong <= 1280) {
        targetBitrate = 4000000;
      } else {
        targetBitrate = 6000000;
      }

      const isBehind = Boolean(
        S.style && (
          S.style.behindPerson ||
          S.style.depthAccent ||
          (S.style.roles && S.style.roles.accent && S.style.roles.accent.layer === 'behind') ||
          (S.style.name && S.style.name.toLowerCase().includes('(behind)'))
        )
      );

      let canvas = null;
      let ctx = null;
      let exportMaskFrameIdx = 0;
      let lastExportMaskCanvas = null;
      let segExportCachedMaskCanvas = null;
      let segExportCachedMaskCtx = null;
      let cachedProgressGrad = null;
      let cachedProgressGradW = 0;
      let cachedProgressGradY = 0;

      // PROBLEM A Point 2 & 4: Track strictly increasing timestamps & consecutive failures
      let lastExportTimestampMs = -1;
      let exportFrameIndex = 0;
      let consecutiveMaskFailures = 0;

      if (document.fonts && document.fonts.load) {
        try {
          await Promise.all([
            document.fonts.load(`${Math.round(H * 0.16)}px Anton`),
            document.fonts.load(`600 ${Math.round(H * 0.05)}px Poppins`),
            document.fonts.ready
          ]);
        } catch (_) {}
      }

      const brollElements = {};
      if (S.brolls && S.brolls.length > 0) {
        for (const b of S.brolls) {
          if (b.url) {
            try {
              const bv = document.createElement('video');
              bv.crossOrigin = 'anonymous';
              bv.muted = true;
              bv.playsInline = true;
              bv.src = b.url;
              await new Promise((resolve) => {
                bv.onloadeddata = resolve;
                bv.onerror = resolve;
                setTimeout(resolve, 2500);
              });
              brollElements[b.id] = bv;
            } catch (_) {}
          }
        }
      }

      const dur = vid.duration || S.probe?.duration || 10;
      const hasAudioOverlays = Boolean(
        S.bgmFilename ||
        (S.voiceoverFilename && btnReplaceVoiceover && btnReplaceVoiceover.classList.contains('active'))
      );

      let mixedAudioBuffer = null;
      let audioSource = null;

      if (hasAudioOverlays) {
        try {
          mixedAudioBuffer = await mixExportAudio(dur, videoBlobUrl || vid.src);
          if (mixedAudioBuffer && window.Mediabunny.AudioBufferSource) {
            audioSource = new window.Mediabunny.AudioBufferSource({
              codec: 'aac',
              bitrate: 192000
            });
            output.addAudioTrack(audioSource);
          }
        } catch (audioMixErr) {
          console.warn('Audio mixing in frame export failed, continuing with original audio:', audioMixErr);
        }
      }

      const processFrame = (sample) => {
        exportFrameIndex++;
        const W = targetW;
        const H = targetH;

        if (!canvas) {
          canvas = document.createElement('canvas');
          canvas.width = W;
          canvas.height = H;
          ctx = canvas.getContext('2d');
        }

        const t = sample.timestamp || 0;

        // PROBLEM A Point 2: Strictly increasing timestamps (start at 0, in ms, never repeat or go backwards)
        let frameMs = Math.round(t * 1000);
        if (frameMs <= lastExportTimestampMs) {
          frameMs = lastExportTimestampMs + 1;
        }
        lastExportTimestampMs = frameMs;

        // 1. Dynamic Auto-Zoom
        const az = S.autoZoom;
        const isZoomed = az && az.enabled && (() => {
          if (az.interval > 0) {
            return (t % az.interval) < (az.duration || 3.5);
          }
          const idx = S.captions.findIndex(c => t >= c.start && t <= c.end);
          return idx !== -1 && idx % 4 === 1;
        })();

        const activeBroll = (S.brolls || []).find(b => b.url && t >= b.start && t <= b.end);
        const hasProgressBar = Boolean(S.progressBar && S.progressBar.enabled !== false);
        const activeCap = S.captions.find(c => t >= c.start && t <= c.end);
        const hasWatermark = Boolean(S.watermark && S.watermark.text && S.watermark.text.trim());

        // Skip all drawing work on frames with no active caption or graphic
        if (!isZoomed && !activeBroll && !hasProgressBar && !activeCap && !hasWatermark) {
          ctx.clearRect(0, 0, W, H);
          sample.draw(ctx, 0, 0, W, H);
          lastExportMaskCanvas = null;
          exportMaskFrameIdx = 0;
          return canvas;
        }

        let exportCleanFrameCanvas = null;
        if (isBehind && exportSegmenter && activeCap) {
          if (!segExportCleanCanvas) {
            segExportCleanCanvas = document.createElement('canvas');
            segExportCleanCtx = segExportCleanCanvas.getContext('2d');
          }
          if (segExportCleanCanvas.width !== W || segExportCleanCanvas.height !== H) {
            segExportCleanCanvas.width = W;
            segExportCleanCanvas.height = H;
          }
          segExportCleanCtx.clearRect(0, 0, W, H);
          const rePunch = ((S.realEstateConfig && S.realEstateConfig.enabled && S.realEstateConfig.cameraPunch !== false) || (S.style && S.style.videoTemplate === 'specialRealEstate')) ? getRealEstateCameraPunch(t, S.captions) : 1.0;
          const effZoom = isZoomed ? ((az && az.scale) || 1.10) * rePunch : rePunch;
          if (effZoom > 1.001) {
            const zW = W * effZoom;
            const zH = H * effZoom;
            const zX = (W - zW) / 2;
            const zY = (H - zH) / 2;
            sample.draw(segExportCleanCtx, zX, zY, zW, zH);
          } else {
            sample.draw(segExportCleanCtx, 0, 0, W, H);
          }
          exportCleanFrameCanvas = segExportCleanCanvas;
        }

        // Pop Studio Scene Export Hook
        const isPopStudioExport = Boolean(
          (S.style && S.style.videoTemplate === 'popStudio') ||
          (S.popStudioConfig && S.popStudioConfig.enabled)
        );
        if (isPopStudioExport) {
          ctx.clearRect(0, 0, W, H);
          drawPopStudioFrame(ctx, segExportBehindCtx || ctx, t, W, H, false, sample);
          return canvas;
        }

        // PROBLEM A Point 3: Per frame, order must be:
        // a) video frame
        ctx.clearRect(0, 0, W, H);
        const reExportPunch = ((S.realEstateConfig && S.realEstateConfig.enabled && S.realEstateConfig.cameraPunch !== false) || (S.style && S.style.videoTemplate === 'specialRealEstate')) ? getRealEstateCameraPunch(t, S.captions) : 1.0;
        const effExportZoom = isZoomed ? ((az && az.scale) || 1.10) * reExportPunch : reExportPunch;
        if (effExportZoom > 1.001) {
          const zW = W * effExportZoom;
          const zH = H * effExportZoom;
          const zX = (W - zW) / 2;
          const zY = (H - zH) / 2;
          sample.draw(ctx, zX, zY, zW, zH);
        } else {
          sample.draw(ctx, 0, 0, W, H);
        }

        // Active B-Roll
        if (activeBroll && brollElements[activeBroll.id]) {
          const bv = brollElements[activeBroll.id];
          const brollT = Math.max(0, t - activeBroll.start);
          if (Math.abs(bv.currentTime - brollT) > 0.15) {
            try { bv.currentTime = brollT; } catch (_) {}
          }
          const layout = activeBroll.layout || 'full';
          if (layout === 'above') {
            ctx.drawImage(bv, 0, 0, W, H / 2);
            ctx.strokeStyle = 'rgba(255,255,255,0.4)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, H / 2);
            ctx.lineTo(W, H / 2);
            ctx.stroke();
          } else if (layout === 'below') {
            ctx.drawImage(bv, 0, H / 2, W, H / 2);
            ctx.strokeStyle = 'rgba(255,255,255,0.4)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, H / 2);
            ctx.lineTo(W, H / 2);
            ctx.stroke();
          } else if (layout === 'circle') {
            const diam = Math.min(W, H) * 0.38;
            const winX = W - diam - (W * 0.04);
            const winY = H * 0.04;
            ctx.save();
            ctx.beginPath();
            ctx.arc(winX + diam / 2, winY + diam / 2, diam / 2, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(bv, winX, winY, diam, diam);
            ctx.restore();
            ctx.save();
            ctx.strokeStyle = 'rgba(255,255,255,0.85)';
            ctx.lineWidth = 4;
            ctx.shadowColor = 'rgba(0,0,0,0.6)';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.arc(winX + diam / 2, winY + diam / 2, diam / 2, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          } else if (layout === 'window' || layout === 'pip') {
            const winW = W * 0.44;
            const winH = H * 0.28;
            const winX = W - winW - (W * 0.04);
            const winY = H * 0.04;
            ctx.save();
            ctx.shadowColor = 'rgba(0,0,0,0.7)';
            ctx.shadowBlur = 16;
            ctx.drawImage(bv, winX, winY, winW, winH);
            ctx.strokeStyle = 'rgba(255,255,255,0.7)';
            ctx.lineWidth = 3;
            ctx.strokeRect(winX, winY, winW, winH);
            ctx.restore();
          } else {
            ctx.drawImage(bv, 0, 0, W, H);
          }
        }

        // Reel Progress Bar
        if (hasProgressBar) {
          const dur = S.probe?.duration || vid.duration || 1;
          const progress = Math.min(1, Math.max(0, t / dur));
          const barH = Math.max(4, Math.round(H * 0.007));
          const barY = S.progressBar.position === 'top' ? 0 : (H - barH);
          ctx.save();
          ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.fillRect(0, barY, W, barH);
          if (!cachedProgressGrad || cachedProgressGradW !== W || cachedProgressGradY !== barY) {
            cachedProgressGrad = ctx.createLinearGradient(0, barY, W, barY);
            cachedProgressGrad.addColorStop(0, '#ec4899');
            cachedProgressGrad.addColorStop(0.5, '#a855f7');
            cachedProgressGrad.addColorStop(1, '#00f0ff');
            cachedProgressGradW = W;
            cachedProgressGradY = barY;
          }
          ctx.fillStyle = cachedProgressGrad;
          ctx.shadowColor = '#00f0ff';
          ctx.shadowBlur = 8;
          ctx.fillRect(0, barY, W * progress, barH);
          ctx.restore();
        }

        if (activeCap) {
          const words = (activeCap.words || []).map(w => ({
            t: w.t || w.word || '',
            s: typeof w.s === 'number' ? w.s : (typeof w.start === 'number' ? w.start : 0),
            e: typeof w.e === 'number' ? w.e : (typeof w.end === 'number' ? w.end : 0),
            key: Boolean(w.key),
            color: w.color || undefined
          }));

          if (isBehind && exportCleanFrameCanvas && exportSegmenter) {
            if (!segExportBehindCanvas) {
              segExportBehindCanvas = document.createElement('canvas');
              segExportBehindCtx = segExportBehindCanvas.getContext('2d');
            }
            if (segExportBehindCanvas.width !== W || segExportBehindCanvas.height !== H) {
              segExportBehindCanvas.width = W; segExportBehindCanvas.height = H;
            }
            segExportBehindCtx.clearRect(0, 0, W, H);

            if (!segExportForeCanvas) {
              segExportForeCanvas = document.createElement('canvas');
              segExportForeCtx = segExportForeCanvas.getContext('2d');
            }
            if (segExportForeCanvas.width !== W || segExportForeCanvas.height !== H) {
              segExportForeCanvas.width = W; segExportForeCanvas.height = H;
            }
            segExportForeCtx.clearRect(0, 0, W, H);

            // Separate lines into behind and front contexts
            drawCanvasTypography(segExportForeCtx, segExportBehindCtx, activeCap, words, t, S.style || {}, W, H, true, false);

            exportMaskFrameIdx++;
            let maskCanvas = null;

            // Run person mask only on every 2nd frame, and reuse previous mask in between
            if (exportMaskFrameIdx % 2 === 1 || !lastExportMaskCanvas) {
              const newMask = getExportPersonMask(exportSegmenter, exportCleanFrameCanvas, frameMs, W, H);
              if (newMask && newMask.width === W && newMask.height === H) {
                if (!segExportCachedMaskCanvas) {
                  segExportCachedMaskCanvas = document.createElement('canvas');
                  segExportCachedMaskCtx = segExportCachedMaskCanvas.getContext('2d');
                }
                if (segExportCachedMaskCanvas.width !== W || segExportCachedMaskCanvas.height !== H) {
                  segExportCachedMaskCanvas.width = W;
                  segExportCachedMaskCanvas.height = H;
                }
                segExportCachedMaskCtx.clearRect(0, 0, W, H);
                segExportCachedMaskCtx.drawImage(newMask, 0, 0, W, H);
                lastExportMaskCanvas = segExportCachedMaskCanvas;
              }
            }
            maskCanvas = lastExportMaskCanvas;

            // PROBLEM A Point 3 & 4: Check mask validity and log
            const maskOk = Boolean(maskCanvas && maskCanvas.width === W && maskCanvas.height === H);
            if (exportFrameIndex % 30 === 0) {
              console.log('[BEHIND]', exportFrameIndex, maskOk ? 'mask ok' : 'mask missing');
            }

            if (!maskOk) {
              consecutiveMaskFailures++;
              // If mask fails 5 frames in a row, stop and throw error
              if (consecutiveMaskFailures >= 5) {
                throw new Error('Behind-person person mask failed for 5 consecutive frames. Model could not detect person in frame.');
              }
              // Isolated glitch frame: draw all lines in front
              ctx.drawImage(segExportBehindCanvas, 0, 0, W, H);
              ctx.drawImage(segExportForeCanvas, 0, 0, W, H);
              drawAutoEmojis(ctx, activeCap, words, t, S.style || {}, W, H);
            } else {
              consecutiveMaskFailures = 0;

              // PROBLEM A Point 3: Per-frame order:
              // a) video frame (already drawn to ctx)
              // b) behind captions/graphics
              ctx.drawImage(segExportBehindCanvas, 0, 0, W, H);

              // Special Real Estate: Person Glow behind person cutout
              if (((S.realEstateConfig && S.realEstateConfig.enabled && S.realEstateConfig.personGlow !== false) || (S.style && S.style.videoTemplate === 'specialRealEstate')) && maskCanvas) {
                const capIdxGlow = S.captions.indexOf(activeCap) !== -1 ? S.captions.indexOf(activeCap) : 0;
                const dataGlow = analyzeRealEstateCaption(activeCap, words, capIdxGlow);
                const glowColor = (dataGlow && dataGlow.palette && dataGlow.palette.accent) || '#00f5d4';
                ctx.save();
                ctx.shadowColor = glowColor;
                ctx.shadowBlur = 8;
                ctx.drawImage(maskCanvas, 0, 0, W, H);
                ctx.restore();
              }

              // c) person cutout (mask applied with destination-in on a separate canvas)
              if (!segExportCutoutCanvas) {
                segExportCutoutCanvas = document.createElement('canvas');
                segExportCutoutCtx = segExportCutoutCanvas.getContext('2d');
              }
              if (segExportCutoutCanvas.width !== W || segExportCutoutCanvas.height !== H) {
                segExportCutoutCanvas.width = W; segExportCutoutCanvas.height = H;
              }
              segExportCutoutCtx.clearRect(0, 0, W, H);
              segExportCutoutCtx.drawImage(exportCleanFrameCanvas, 0, 0, W, H);
              segExportCutoutCtx.globalCompositeOperation = 'destination-in';
              segExportCutoutCtx.drawImage(maskCanvas, 0, 0, W, H);
              segExportCutoutCtx.globalCompositeOperation = 'source-over';
              ctx.drawImage(segExportCutoutCanvas, 0, 0, W, H);

              // d) front captions/graphics
              ctx.drawImage(segExportForeCanvas, 0, 0, W, H);
              drawAutoEmojis(ctx, activeCap, words, t, S.style || {}, W, H);
            }
          } else {
            // Standard non-behind preset path
            lastExportMaskCanvas = null;
            exportMaskFrameIdx = 0;
            drawCanvasTypography(ctx, null, activeCap, words, t, S.style || {}, W, H, isBehind, false);
            drawAutoEmojis(ctx, activeCap, words, t, S.style || {}, W, H);
          }
        } else {
          lastExportMaskCanvas = null;
          exportMaskFrameIdx = 0;
        }

        drawRealEstateOverlays(ctx, W, H, t);
        drawWatermark(ctx, W, H);

        return canvas;
      };

      let conversion = null;
      const baseVideoConfig = {
        codec: 'avc',
        width: targetW,
        height: targetH,
        fit: 'contain',
        frameRate: 30,
        bitrate: targetBitrate,
      };

      try {
        conversion = await window.Mediabunny.Conversion.init({
          input,
          output,
          composable: Boolean(audioSource),
          audio: audioSource ? { discard: true } : { codec: 'aac' },
          video: {
            ...baseVideoConfig,
            hardwareAcceleration: 'prefer-hardware',
            process: processFrame
          }
        });
      } catch (hwInitErr) {
        console.warn('Conversion with prefer-hardware failed, retrying with no-preference:', hwInitErr);
        conversion = await window.Mediabunny.Conversion.init({
          input,
          output,
          composable: Boolean(audioSource),
          audio: audioSource ? { discard: true } : { codec: 'aac' },
          video: {
            ...baseVideoConfig,
            hardwareAcceleration: 'no-preference',
            process: processFrame
          }
        });
      }

      if (!conversion.isValid) {
        throw new Error('Mediabunny conversion is invalid');
      }

      activeDirectExport = {
        stop: () => {
          try { conversion.cancel(); } catch (_) {}
        }
      };

      let lastUiUpdate = 0;
      let lastEtaUpdateTime = 0;
      let lastEtaText = 'calculating...';

      conversion.onProgress = (progress) => {
        const now = performance.now();
        if (now - lastUiUpdate < 250 && progress < 0.99) {
          return;
        }
        lastUiUpdate = now;

        const pct = Math.min(99, Math.max(1, Math.round(progress * 100)));
        exportProgressBar.style.width = pct + '%';
        exportPercent.textContent = pct + '%';
        exportProgressText.textContent = `Rendering video with frame sync (${pct}%)...`;
        exportProgressDetail.textContent = 'Keep this screen open while exporting';
        updateExportPipeline(1, `${pct}%`, 'Queued');

        if (now - lastEtaUpdateTime >= 1000) {
          lastEtaUpdateTime = now;
          if (progress > 0.02) {
            const elapsedSec = (Date.now() - exportStartTime) / 1000;
            const totalEstimatedSec = elapsedSec / progress;
            const remainingSec = Math.max(0, Math.ceil(totalEstimatedSec - elapsedSec));
            const mins = Math.floor(remainingSec / 60);
            const secs = remainingSec % 60;
            lastEtaText = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
          }
        }

        const etaVal = $('exportEtaVal');
        if (etaVal) etaVal.textContent = lastEtaText;
      };

      updateExportPipeline(1, 'Processing Frames...', 'Queued');
      exportProgressText.textContent = 'Rendering video with frame sync...';
      exportProgressDetail.textContent = 'Encoding synchronized frame-accurate captions.';

      if (audioSource && mixedAudioBuffer) {
        await output.start();
        await Promise.all([
          conversion.execute(),
          audioSource.add(mixedAudioBuffer).then(() => audioSource.close())
        ]);
        await output.finalize();
      } else {
        await conversion.execute();
      }

      updateExportPipeline(2, 'Done ✓', 'Packaging Video...');
      exportProgressBar.style.width = '100%';
      exportPercent.textContent = '100%';
      exportProgressText.textContent = 'Finalizing MP4...';

      const buffer = output.target.buffer;
      if (!buffer || buffer.byteLength === 0) {
        throw new Error('Export buffer is empty');
      }

      const blob = new Blob([buffer], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);

      deductCreditAfterExport();
      updateExportPipeline(3);
      showExportComplete(url);
    } finally {
      // PROBLEM A Point 2: Close export segmenter when export ends
      if (exportSegmenter) {
        try {
          exportSegmenter.close();
        } catch (_) {}
        exportSegmenter = null;
      }
      if (wakeLock) {
        try {
          await wakeLock.release();
        } catch (_) {}
        wakeLock = null;
      }
    }
  }

  async function startDirectCanvasExport() {
    const rawW = vid.videoWidth || S.probe?.width || 1080;
    const rawH = vid.videoHeight || S.probe?.height || 1920;

    let W = rawW;
    let H = rawH;
    if (W > 1280 || H > 1280) {
      const scale = Math.min(1280 / W, 1280 / H);
      W = Math.round(W * scale);
      H = Math.round(H * scale);
    }
    W = W % 2 === 0 ? W : W - 1;
    H = H % 2 === 0 ? H : H - 1;

    // Transparent Canvas specifically for Caption Overlay (with Alpha channel enabled)
    const recCanvas = document.createElement('canvas');
    recCanvas.width = W;
    recCanvas.height = H;
    const recCtx = recCanvas.getContext('2d', { alpha: true });

    // WebM VP9/VP8 or H264 supported container for overlay recording
    const mimeCandidates = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm;codecs=h264',
      'video/webm',
      'video/mp4;codecs=avc1'
    ];
    let chosenMime = '';
    for (const m of mimeCandidates) {
      if (window.MediaRecorder && MediaRecorder.isTypeSupported(m)) {
        chosenMime = m;
        break;
      }
    }

    const duration = vid.duration || S.probe?.duration || 1;
    const fps = 30;
    const frameInterval = 1 / fps;
    const totalFrames = Math.max(1, Math.round(duration * fps));

    // Capture canvas stream at constant 30fps for smooth standard MediaRecorder encoding
    const canvasStream = recCanvas.captureStream ? recCanvas.captureStream(fps) : recCanvas.mozCaptureStream(fps);

    const recOptions = {
      videoBitsPerSecond: 5000000
    };
    if (chosenMime) recOptions.mimeType = chosenMime;

    const recorder = new MediaRecorder(canvasStream, recOptions);
    const chunks = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    let isCancelled = false;
    activeDirectExport = {
      stop: () => {
        isCancelled = true;
        try { recorder.stop(); } catch (_) {}
      }
    };

    const isBehind = Boolean(
      S.style && (
        S.style.behindPerson ||
        S.style.depthAccent ||
        (S.style.roles && S.style.roles.accent && S.style.roles.accent.layer === 'behind') ||
        (S.style.name && S.style.name.toLowerCase().includes('(behind)'))
      )
    );

    // Pause background video: NO SEEK JITTER OR HEAVY DECODING ON VIDEO!
    vid.pause();

    recorder.start(100);

    // HYBRID OVERLAY STEPPER:
    // Pure mathematical time ticks (t = frame / fps).
    // Guarantees 100% full duration coverage with zero lag!
    const track = canvasStream.getVideoTracks()[0];

    // Pure mathematical green-screen overlay rendering
    // Background is #00FF00 (pure green). Captions, shadows, and text are drawn on top.
    // FFmpeg chromakeys out 0x00FF00 with 100% precision, leaving pristine typography on original video!
    const startPerf = performance.now();
    let frameIdx = 0;

    while (!isCancelled) {
      // Caption time comes from the real clock so it always matches the recording
      const targetTime = (performance.now() - startPerf) / 1000;
      if (targetTime >= duration) break;

      recCtx.fillStyle = '#00FF00';
      recCtx.fillRect(0, 0, W, H);

      const activeCap = S.captions.find(c => targetTime >= c.start && targetTime <= c.end);
      if (activeCap) {
        const words = (activeCap.words || []).map(w => ({
          t: w.t || w.word || '',
          s: typeof w.s === 'number' ? w.s : (typeof w.start === 'number' ? w.start : 0),
          e: typeof w.e === 'number' ? w.e : (typeof w.end === 'number' ? w.end : 0),
          key: Boolean(w.key),
          color: w.color || undefined
        }));
        drawCanvasTypography(recCtx, null, activeCap, words, targetTime, S.style || {}, W, H, isBehind, false);
        drawAutoEmojis(recCtx, activeCap, words, targetTime, S.style || {}, W, H);
      }

      drawRealEstateOverlays(recCtx, W, H, targetTime);
      drawWatermark(recCtx, W, H);

      // Update progress UI only every 10 frames (less lag)
      if (frameIdx % 10 === 0) {
        const pct = Math.min(95, Math.max(5, Math.round((targetTime / duration) * 95)));
        exportProgressBar.style.width = pct + '%';
        exportPercent.textContent = pct + '%';
        exportProgressText.textContent = `Rendering captions ${pct}%... keep this tab open`;
      }
      frameIdx++;

      await new Promise(r => requestAnimationFrame(r));
    }

    // Flush recorder buffer
    await new Promise(r => setTimeout(r, 500));

    if (isCancelled) return;

    updateExportPipeline(2, 'Done ✓', 'Compositing Final Video...');
    exportProgressText.textContent = 'Finalizing on server... this can take 1-2 minutes';
    exportProgressDetail.textContent = 'Please keep this tab open. Do not refresh.';
    exportProgressBar.style.width = '96%';
    exportPercent.textContent = '96%';

    const finishExportPromise = new Promise((resolve) => {
      recorder.onstop = async () => {
        try {
          const recordedBlob = new Blob(chunks, { type: chosenMime || 'video/webm' });
          const ext = (chosenMime && chosenMime.includes('mp4')) ? 'mp4' : 'webm';

          const formData = new FormData();
          formData.append('video', recordedBlob, `captions_overlay.${ext}`);
          formData.append('originalVideo', S.filename || '');
          if (S.bgmFilename) formData.append('bgMusic', S.bgmFilename);
          if (S.bgmVolume != null) formData.append('musicVol', Math.round(S.bgmVolume * 100));
          if (S.voiceoverFilename && btnReplaceVoiceover.classList.contains('active')) {
            formData.append('voiceover', S.voiceoverFilename);
          }

          let serverDownloadUrl = null;
          try {
            const res = await fetch('/api/save_canvas_export', {
              method: 'POST',
              body: formData
            });
            if (res.ok) {
              const data = await res.json();
              if (data.ok && data.download) {
                serverDownloadUrl = data.download;
              }
            }
          } catch (netErr) {
            console.warn('Canvas export server packaging error, serving client blob:', netErr);
          }

          if (!serverDownloadUrl) throw new Error('Server export failed');
          deductCreditAfterExport();
          updateExportPipeline(3);
          showExportComplete(serverDownloadUrl);
          resolve();
        } catch (postErr) {
          console.warn('save_canvas_export error:', postErr);
          exportProgressText.textContent = 'Export failed, please try again.';
          exportProgressDetail.textContent = 'The server could not finish the video.';
          resolve();
        }
      };
    });

    recorder.stop();
    await finishExportPromise;
  }

  async function startExport() {
    // 1. Mandatory Sign In Check: User must sign in with Google/Email to export!
    if (!S.user || !S.user.id) {
      S.pendingExportAfterLogin = true;
      const modalLogin = $('modalLogin');
      if (modalLogin) {
        modalLogin.classList.remove('hidden');
        showToast('🔐 Please sign in with your Gmail/Account to export!');
      }
      return;
    }

    // 2. Export Credits / Paywall Check
    if (S.credits <= 0) {
      S.pendingExportAfterCoupon = true;
      openCouponModal();
      return;
    }

    vid.pause();
    modalExport.classList.remove('hidden');
    exportWorkingState.classList.remove('hidden');
    exportDoneState.classList.add('hidden');
    exportErrorState.classList.add('hidden');

    exportProgressBar.style.width = '5%';
    exportPercent.textContent = '5%';
    exportProgressText.textContent = 'Initiating Same-Engine video render...';
    exportProgressDetail.textContent = 'Preparing frame-by-frame canvas recording for 100% visual match.';

    if ('Notification' in window && Notification.permission === 'default') {
      try { Notification.requestPermission(); } catch (_) {}
    }

    if (exportElapsedInterval) clearInterval(exportElapsedInterval);
    exportStartTime = Date.now();
    const timerVal = $('exportTimerVal');
    if (timerVal) timerVal.textContent = '00:00';
    exportElapsedInterval = setInterval(() => {
      const elapsedSec = Math.floor((Date.now() - exportStartTime) / 1000);
      if (timerVal) timerVal.textContent = formatTimeElapsed(elapsedSec);
    }, 500);

    updateExportPipeline(1, 'Recording Canvas...', 'Queued');

    // Fast exporter check for Pop Studio
    if (S.popStudioConfig && S.popStudioConfig.enabled) {
      await ensurePopStudioFonts();
    }

    // Dual-engine export selector:
    const hasWebCodecs = typeof VideoEncoder !== 'undefined' && typeof VideoDecoder !== 'undefined';
    if (S.popStudioConfig && S.popStudioConfig.enabled && !hasWebCodecs) {
      if (exportElapsedInterval) clearInterval(exportElapsedInterval);
      modalExport.classList.add('hidden');
      alert("Pop Studio needs the fast exporter. Try Chrome, Edge or a newer browser");
      return;
    }
    let frameExportFailure = null;

    const isBehindStyle = Boolean(
                  (S.style && (
        S.style.behindPerson ||
        S.style.depthAccent ||
        (S.style.roles && S.style.roles.accent && S.style.roles.accent.layer === 'behind') ||
        (S.style.name && S.style.name.toLowerCase().includes('(behind)'))
      ))
    );

    if (hasWebCodecs) {
      if (!window.Mediabunny) {
        try {
          window.Mediabunny = await import('https://cdn.jsdelivr.net/npm/mediabunny@1.65.0/+esm');
        } catch (mErr) {
          console.warn('Could not load Mediabunny dynamically:', mErr);
        }
      }
      if (window.Mediabunny) {
        try {
          await startFrameExport();
          return;
        } catch (frameErr) {
          frameExportFailure = frameErr;
          console.error('[BEHIND] startFrameExport failed with full stack trace:', frameErr && frameErr.stack ? frameErr.stack : frameErr);
          
          // PROBLEM A Point 1: For any style that uses behind-person layering, ALWAYS use startFrameExport.
          // Never silently use the hybrid path. Show clear error for at least 8 seconds!
          if (isBehindStyle) {
            console.error('[BEHIND] Behind-person export failed error stack:', frameErr && frameErr.stack ? frameErr.stack : frameErr);
            const failMsg = 'Behind-person export failed: ' + (frameErr.message || String(frameErr));
            showToast(failMsg, 8000);
            exportWorkingState.classList.add('hidden');
            exportErrorState.classList.remove('hidden');
            const exportErrorMessage = $('exportErrorMessage');
            if (exportErrorMessage) exportErrorMessage.textContent = failMsg;
            if (exportElapsedInterval) clearInterval(exportElapsedInterval);
            return;
          }

          const failMsg = 'Frame export failed: ' + (frameErr.message || String(frameErr));
          showToast(failMsg, 8000);
          if (exportProgressDetail) {
            exportProgressDetail.textContent = failMsg + ' (Falling back to compatibility mode)';
          }
        }
      } else {
        frameExportFailure = new Error('Mediabunny library failed to load');
        console.error('Mediabunny missing:', frameExportFailure.stack || frameExportFailure);
        if (isBehindStyle) {
          const failMsg = 'Behind-person export failed: Mediabunny library failed to load';
          showToast(failMsg, 8000);
          exportWorkingState.classList.add('hidden');
          exportErrorState.classList.remove('hidden');
          const exportErrorMessage = $('exportErrorMessage');
          if (exportErrorMessage) exportErrorMessage.textContent = failMsg;
          if (exportElapsedInterval) clearInterval(exportElapsedInterval);
          return;
        }
        showToast('Frame export unavailable: Mediabunny not loaded', 8000);
      }
    } else {
      frameExportFailure = new Error('Browser WebCodecs (VideoEncoder/Decoder) not supported on this device');
      console.error('WebCodecs missing:', frameExportFailure.stack || frameExportFailure);
      if (isBehindStyle) {
        const failMsg = 'Behind-person export failed: Browser WebCodecs is not supported on this device';
        showToast(failMsg, 8000);
        exportWorkingState.classList.add('hidden');
        exportErrorState.classList.remove('hidden');
        const exportErrorMessage = $('exportErrorMessage');
        if (exportErrorMessage) exportErrorMessage.textContent = failMsg;
        if (exportElapsedInterval) clearInterval(exportElapsedInterval);
        return;
      }
      showToast('WebCodecs unsupported on this device. Using compatibility mode.', 8000);
    }

    // Hybrid fallback is strictly for non-behind presets
    await startDirectCanvasExport();
  }

  async function startServerExport() {
    try {
      const payload = {
        filename: S.filename,
        captions: S.captions.map(cap => ({
          ...cap,
          text: cleanCaptionText(cap.text),
          words: (cap.words || []).map(word => ({
            ...word,
            t: cleanCaptionText(word.t ?? word.word),
            word: cleanCaptionText(word.word ?? word.t),
            key: Boolean(word.key || word.isKey),
            color: word.color || word.customColor || undefined
          })).filter(word => word.t)
        })),
        style: S.style,
        preset_id: S.style?.id || 'yellow_box',
        quality: 'balanced',
        aspect: S.aspect || 'original',
        speed: 1.0,
        zoom: Boolean(S.autoZoom && S.autoZoom.enabled),
        progressBar: S.progressBar,
        watermark: S.watermark,
        auto_sfx: Boolean(S.autoSfx !== false)
      };
      if (S.brolls && S.brolls.length > 0) {
        payload.broll = S.brolls.filter(b => b.url && b.end > b.start).map((b, idx) => ({
          id: b.id || (idx + 1),
          start: Number(b.start),
          end: Number(b.end),
          url: b.url,
          layout: b.layout || 'full'
        }));
      }
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
          if (pct >= 40) {
            exportProgressDetail.textContent = 'Baking in final crisp 1080p MP4 audio & video streams.';
            updateExportPipeline(2, 'Done ✓', 'Encoding MP4...');
          } else {
            exportProgressDetail.textContent = 'Applying selected style preset and burning captions.';
            updateExportPipeline(1, 'Burning Captions...', 'Queued');
          }
        }

        if (data.status === 'done' || data.download) {
          clearInterval(S.exportTimer);
          if (exportElapsedInterval) clearInterval(exportElapsedInterval);
          deductCreditAfterExport();
          updateExportPipeline(3);
          showExportComplete(data.download);
        } else if (data.status === 'error') {
          clearInterval(S.exportTimer);
          if (exportElapsedInterval) clearInterval(exportElapsedInterval);
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
    if (exportElapsedInterval) clearInterval(exportElapsedInterval);
    exportWorkingState.classList.add('hidden');
    exportDoneState.classList.remove('hidden');

    const totalSec = exportStartTime > 0 ? Math.round((Date.now() - exportStartTime) / 1000) : 0;
    const timeStr = totalSec >= 60
      ? (Math.floor(totalSec / 60) + 'm ' + (totalSec % 60) + 's')
      : (totalSec + 's');

    const doneMeta = $('exportDoneMeta');
    if (doneMeta) {
      doneMeta.textContent = 'Completed in ' + timeStr + ' • 1080p high quality with full audio.';
    }

    const isBlob = String(filename || '').startsWith('blob:');
    let targetDownloadUrl = '';
    let targetFileName = 'captioned_video.mp4';

    if (isBlob) {
      targetDownloadUrl = filename;
      targetFileName = 'captioned_video.mp4';
      exportPreviewVideo.src = filename;
    } else {
      const file = String(filename || '').split('/').pop();
      targetDownloadUrl = String(filename || '').startsWith('/download/')
        ? filename
        : '/download/' + encodeURIComponent(file);
      targetFileName = 'captioned_' + file;
      exportPreviewVideo.src = '/video/' + encodeURIComponent(file);
    }
    btnDownloadExport.href = targetDownloadUrl;
    btnDownloadExport.download = targetFileName;
    btnDownloadExport.target = '_blank';

    // Explicit click handler to trigger direct download across all browsers
    btnDownloadExport.onclick = (e) => {
      if (!targetDownloadUrl) return;
      const a = document.createElement('a');
      a.href = targetDownloadUrl;
      a.download = targetFileName || 'captioned_video.mp4';
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        try { document.body.removeChild(a); } catch (_) {}
      }, 300);
    };

    exportPreviewVideo.load();

    playSuccessChime();
    startTitleFlash();

    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('🎬 Your Captioned Video is Ready!', {
          body: 'Render completed in ' + timeStr + '. Click here to download or preview!',
          icon: '/static/favicon.ico'
        });
      } catch (_) {}
    }

    if (typeof showToast === 'function') {
      showToast('🎉 Your video is ready to download!');
    }
  }

  function showExportError(msg) {
    if (exportElapsedInterval) clearInterval(exportElapsedInterval);
    stopTitleFlash();
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


// ============================================================================
// PART B: INTERACTIVE CAPTION TIMELINE & VIDEO TAP-TO-EDIT SUITE
// ============================================================================

window._hasShownTapEditHint = false;
window._hasScrubbedTimeline = false;
S.selectedCaptionId = null;
S.selectedWordIndex = -1;
S.editMode = 'whole'; // 'whole' | 'word'
S.cachedLayoutBoxes = [];

/**
 * B3 & B4: Record bounding boxes during render for tap-to-edit hit-testing
 */
function recordCaptionLayoutBox(cap, words, st, W, H, capDx = 0, capDy = 0, capScale = 1.0) {
  if (!cap || !words || words.length === 0 || W <= 0 || H <= 0) return;

  const stPos = Number(st && (st.position || st.posY)) || 0.65;
  const centerY = H * stPos;
  const centerX = W * 0.5;

  let totalW = 0;
  let totalH = 0;
  const wordBoxes = [];

  const estFs = Math.max(18, Math.round(Math.min(W, H) * (Number(st?.fontSize) || 0.08) * (Number(st?.fontScale) || 1.0)));
  const lineH = estFs * 1.25;

  // Approximate line distribution
  const lines = (words.length <= 3) ? [words] : [words.slice(0, Math.ceil(words.length / 2)), words.slice(Math.ceil(words.length / 2))];
  const numLines = lines.length;
  totalH = numLines * lineH;
  const startY = centerY - totalH / 2;

  lines.forEach((lWords, lIdx) => {
    const lY = startY + lIdx * lineH;
    let curX = centerX - (lWords.length * estFs * 2.2) / 2;
    lWords.forEach(w => {
      const wIdx = words.indexOf(w);
      const estW = Math.max(estFs * 1.2, (w.t || '').length * estFs * 0.55);
      const wDx = (Number(w.dx) || 0) * W;
      const wDy = (Number(w.dy) || 0) * H;
      const wx = curX + wDx + capDx;
      const wy = lY + wDy + capDy;
      wordBoxes.push({
        wordIndex: wIdx,
        word: w,
        box: {
          x: Math.max(0, Math.min(1, wx / W)),
          y: Math.max(0, Math.min(1, wy / H)),
          w: Math.max(0.04, Math.min(1, (estW * capScale) / W)),
          h: Math.max(0.02, Math.min(1, (estFs * capScale) / H))
        }
      });
      curX += estW + estFs * 0.25;
      totalW = Math.max(totalW, curX - (centerX - (lWords.length * estFs * 2.2) / 2));
    });
  });

  const capBoxX = Math.max(0, Math.min(0.9, (centerX - (totalW / 2) + capDx) / W));
  const capBoxY = Math.max(0, Math.min(0.9, (startY + capDy) / H));
  const capBoxW = Math.max(0.12, Math.min(0.96, (totalW * capScale) / W));
  const capBoxH = Math.max(0.04, Math.min(0.96, (totalH * capScale) / H));

  const entry = {
    capId: cap.id,
    box: { x: capBoxX, y: capBoxY, w: capBoxW, h: capBoxH },
    wordBoxes: wordBoxes,
    ts: performance.now()
  };

  const existIdx = S.cachedLayoutBoxes.findIndex(b => b.capId === cap.id);
  if (existIdx >= 0) {
    S.cachedLayoutBoxes[existIdx] = entry;
  } else {
    S.cachedLayoutBoxes.push(entry);
  }
}

/**
 * Select a caption for editing
 */
function selectCaption(capId, wordIndex = -1) {
  S.selectedCaptionId = capId;
  const capIdx = S.captions.findIndex(c => c.id === capId);
  if (capIdx === -1) {
    deselectCaption();
    return;
  }
  const cap = S.captions[capIdx];
  if (wordIndex >= 0) {
    S.selectedWordIndex = wordIndex;
    S.editMode = 'word';
  } else {
    S.selectedWordIndex = -1;
    S.editMode = 'whole';
  }

  // Highlight block in timeline
  $$('.timeline-block').forEach(b => {
    if (b.getAttribute('data-id') === capId) {
      b.classList.add('selected');
    } else {
      b.classList.remove('selected');
    }
  });

  // Show timeline action bar
  const actionBar = $('timelineClipActionBar');
  if (actionBar) actionBar.classList.remove('hidden');

  // Sync playhead to start of clip
  if (Math.abs((vid.currentTime || 0) - cap.start) > 0.05) {
    vid.currentTime = cap.start;
    syncTimelinePlayhead();
  }

  updateVideoEditOverlay();

  // Show first-time hint
  if (!window._hasShownTapEditHint) {
    window._hasShownTapEditHint = true;
    showToast('💡 Tap a caption to move it. Switch to One word to move a single word.');
  }

  renderCanvas();
}

/**
 * Deselect current caption and hide edit overlay
 */
function deselectCaption() {
  S.selectedCaptionId = null;
  S.selectedWordIndex = -1;
  S.editMode = 'whole';

  $$('.timeline-block').forEach(b => b.classList.remove('selected'));

  const actionBar = $('timelineClipActionBar');
  if (actionBar) actionBar.classList.add('hidden');

  const overlay = $('videoEditOverlayContainer');
  if (overlay) overlay.classList.add('hidden');

  const snapV = $('snapGuideV'); if (snapV) snapV.classList.add('hidden');
  const snapH = $('snapGuideH'); if (snapH) snapH.classList.add('hidden');

  renderCanvas();
}

/**
 * Sync bounding box and floating mini toolbar
 */
function updateVideoEditOverlay() {
  const overlay = $('videoEditOverlayContainer');
  const bbox = $('captionBoundingBox');
  const miniToolbar = $('videoEditMiniToolbar');
  const boxLabel = $('boxLabelMode');
  const stage = $('stage');
  const stageWrapper = $('stageWrapper');

  if (!overlay || !bbox || !miniToolbar || !stage || !stageWrapper) return;
  if (!S.selectedCaptionId) {
    overlay.classList.add('hidden');
    return;
  }

  const capIdx = S.captions.findIndex(c => c.id === S.selectedCaptionId);
  if (capIdx === -1) {
    deselectCaption();
    return;
  }
  const cap = S.captions[capIdx];

  overlay.classList.remove('hidden');
  bbox.classList.remove('hidden');
  miniToolbar.classList.remove('hidden');

  // Update mode pills
  const btnWhole = $('btnEditModeWhole');
  const btnWord = $('btnEditModeWord');
  if (btnWhole && btnWord) {
    if (S.editMode === 'word') {
      btnWord.classList.add('active');
      btnWhole.classList.remove('active');
      if (boxLabel) {
        boxLabel.classList.remove('hidden');
        const curWord = (cap.words && S.selectedWordIndex >= 0 && cap.words[S.selectedWordIndex]) ? cap.words[S.selectedWordIndex].t : 'word';
        boxLabel.textContent = `word: "${curWord}"`;
      }
    } else {
      btnWhole.classList.add('active');
      btnWord.classList.remove('active');
      if (boxLabel) boxLabel.classList.add('hidden');
    }
  }

  const stageRect = stage.getBoundingClientRect();
  const wrapperRect = stageWrapper.getBoundingClientRect();
  const stageLeftInWrapper = stageRect.left - wrapperRect.left;
  const stageTopInWrapper = stageRect.top - wrapperRect.top;

  const layoutItem = (S.cachedLayoutBoxes || []).find(item => item.capId === cap.id);
  let targetNormBox = layoutItem ? layoutItem.box : null;

  if (S.editMode === 'word' && S.selectedWordIndex >= 0 && layoutItem && layoutItem.wordBoxes && layoutItem.wordBoxes[S.selectedWordIndex]) {
    targetNormBox = layoutItem.wordBoxes[S.selectedWordIndex].box;
  }

  if (!targetNormBox) {
    targetNormBox = {
      x: 0.10 + (Number(cap.dx) || 0),
      y: (Number(S.style?.position) || 0.65) - 0.08 + (Number(cap.dy) || 0),
      w: 0.80 * (Number(cap.scale) || 1.0),
      h: 0.16 * (Number(cap.scale) || 1.0)
    };
  }

  const boxX = stageLeftInWrapper + targetNormBox.x * stageRect.width;
  const boxY = stageTopInWrapper + targetNormBox.y * stageRect.height;
  const boxW = Math.max(48, targetNormBox.w * stageRect.width);
  const boxH = Math.max(32, targetNormBox.h * stageRect.height);

  bbox.style.left = Math.round(boxX) + 'px';
  bbox.style.top = Math.round(boxY) + 'px';
  bbox.style.width = Math.round(boxW) + 'px';
  bbox.style.height = Math.round(boxH) + 'px';

  // Position mini toolbar near the box
  let toolbarY = boxY + boxH + 8;
  if (toolbarY + 44 > wrapperRect.height - 12) {
    toolbarY = Math.max(12, boxY - 48);
  }
  let toolbarX = boxX + (boxW / 2) - 130;
  toolbarX = Math.max(8, Math.min(wrapperRect.width - 270, toolbarX));

  miniToolbar.style.left = Math.round(toolbarX) + 'px';
  miniToolbar.style.top = Math.round(toolbarY) + 'px';
}

/**
 * Handle tap on video preview to select caption or word
 */
function handleStageTapToEdit(e) {
  if (e.target.closest('#videoEditMiniToolbar') || e.target.closest('.box-handle') || e.target.closest('#timelineClipActionBar')) {
    return;
  }
  const stage = $('stage');
  const stageWrapper = $('stageWrapper');
  if (!stage || !stageWrapper) return;

  const rect = stage.getBoundingClientRect();
  const normX = (e.clientX - rect.left) / rect.width;
  const normY = (e.clientY - rect.top) / rect.height;

  if (normX < 0 || normX > 1 || normY < 0 || normY > 1) {
    deselectCaption();
    return;
  }

  const t = vid.currentTime || 0;
  const activeCap = S.captions.find(c => t >= c.start && t <= c.end);
  const matches = (S.cachedLayoutBoxes || []).filter(item => {
    const b = item.box;
    return normX >= b.x - 0.05 && normX <= b.x + b.w + 0.05 &&
           normY >= b.y - 0.05 && normY <= b.y + b.h + 0.05;
  });

  if (matches.length > 0) {
    if (!vid.paused) {
      try { vid.pause(); } catch(_) {}
    }
    let targetItem = matches[0];
    if (matches.length > 1 && S.selectedCaptionId === targetItem.capId) {
      targetItem = matches[1];
    }
    let matchedWordIdx = -1;
    if (targetItem.wordBoxes && targetItem.wordBoxes.length > 0) {
      const matchedWord = targetItem.wordBoxes.find(wb => {
        const wbBox = wb.box;
        return normX >= wbBox.x - 0.02 && normX <= wbBox.x + wbBox.w + 0.02 &&
               normY >= wbBox.y - 0.02 && normY <= wbBox.y + wbBox.h + 0.02;
      });
      if (matchedWord) matchedWordIdx = matchedWord.wordIndex;
    }
    selectCaption(targetItem.capId, matchedWordIdx);
  } else if (activeCap) {
    if (!vid.paused) {
      try { vid.pause(); } catch(_) {}
    }
    selectCaption(activeCap.id);
  } else {
    deselectCaption();
  }
}

/**
 * Setup interactions for video bounding box dragging, scaling, and mini toolbar
 */
function setupVideoOverlayInteractions() {
  const bbox = $('captionBoundingBox');
  const overlay = $('videoEditOverlayContainer');
  const stage = $('stage');
  const stageWrapper = $('stageWrapper');
  if (!bbox || !overlay || !stage || !stageWrapper) return;

  stageWrapper.addEventListener('click', handleStageTapToEdit);

  let drag = null;

  const onPointerDown = (e) => {
    if (e.target.closest('#videoEditMiniToolbar')) return;

    const capIdx = S.captions.findIndex(c => c.id === S.selectedCaptionId);
    if (capIdx === -1) return;
    const cap = S.captions[capIdx];

    e.stopPropagation();
    try { e.target.setPointerCapture(e.pointerId); } catch(_) {}

    const handleEl = e.target.closest('.box-handle');
    const stageRect = stage.getBoundingClientRect();

    if (handleEl) {
      const handleType = handleEl.getAttribute('data-handle') || 'se';
      const bboxRect = bbox.getBoundingClientRect();
      const centerX = bboxRect.left + bboxRect.width / 2;
      const centerY = bboxRect.top + bboxRect.height / 2;
      const startDist = Math.hypot(e.clientX - centerX, e.clientY - centerY);
      drag = {
        type: 'scale',
        pointerId: e.pointerId,
        handle: handleType,
        centerX,
        centerY,
        startDist: Math.max(10, startDist),
        origScale: Number(cap.scale) || 1.0,
        capIdx,
        cap
      };
    } else {
      const isWordMode = (S.editMode === 'word' && S.selectedWordIndex >= 0 && cap.words && cap.words[S.selectedWordIndex]);
      const targetObj = isWordMode ? cap.words[S.selectedWordIndex] : cap;
      drag = {
        type: 'move',
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        origDx: Number(targetObj.dx) || 0,
        origDy: Number(targetObj.dy) || 0,
        stageW: stageRect.width,
        stageH: stageRect.height,
        isWordMode,
        targetObj,
        capIdx,
        wordIdx: isWordMode ? S.selectedWordIndex : -1,
        moved: false
      };
    }
  };

  const onPointerMove = (e) => {
    if (!drag || drag.pointerId !== e.pointerId) return;

    if (drag.type === 'scale') {
      const curDist = Math.hypot(e.clientX - drag.centerX, e.clientY - drag.centerY);
      const scaleFactor = curDist / drag.startDist;
      const newScale = Math.max(0.4, Math.min(2.5, drag.origScale * scaleFactor));
      drag.cap.scale = Math.round(newScale * 100) / 100;
      requestAnimationFrame(() => {
        renderCanvas();
        updateVideoEditOverlay();
      });
    } else if (drag.type === 'move') {
      const deltaX = e.clientX - drag.startX;
      const deltaY = e.clientY - drag.startY;
      if (!drag.moved && Math.hypot(deltaX, deltaY) < 3) return;
      drag.moved = true;

      let newDx = drag.origDx + (deltaX / drag.stageW);
      let newDy = drag.origDy + (deltaY / drag.stageH);

      // Snap guides (center and 8% safe margins)
      const snapV = $('snapGuideV');
      const snapH = $('snapGuideH');
      let didSnap = false;

      if (Math.abs(newDx) < 0.02) {
        newDx = 0;
        if (snapV) snapV.classList.remove('hidden');
        didSnap = true;
      } else if (snapV) {
        snapV.classList.add('hidden');
      }

      if (Math.abs(newDy) < 0.02) {
        newDy = 0;
        if (snapH) snapH.classList.remove('hidden');
        didSnap = true;
      } else if (snapH) {
        snapH.classList.add('hidden');
      }

      if (didSnap && navigator.vibrate) {
        try { navigator.vibrate(8); } catch(_) {}
      }

      // Safe clamp inside 8% frame margins
      newDx = Math.max(-0.42, Math.min(0.42, newDx));
      newDy = Math.max(-0.42, Math.min(0.42, newDy));

      drag.targetObj.dx = Math.round(newDx * 1000) / 1000;
      drag.targetObj.dy = Math.round(newDy * 1000) / 1000;

      requestAnimationFrame(() => {
        renderCanvas();
        updateVideoEditOverlay();
      });
    }
  };

  const onPointerUp = (e) => {
    if (!drag || drag.pointerId !== e.pointerId) return;
    const d = drag;
    drag = null;
    try { e.target.releasePointerCapture(e.pointerId); } catch(_) {}

    const snapV = $('snapGuideV'); if (snapV) snapV.classList.add('hidden');
    const snapH = $('snapGuideH'); if (snapH) snapH.classList.add('hidden');

    if (d.type === 'scale') {
      pushHistoryState('Scale caption');
      console.log('[EDIT]', 'scale', d.capIdx, -1, d.cap.scale);
    } else if (d.type === 'move' && d.moved) {
      pushHistoryState('Move caption position');
      console.log('[EDIT]', 'move', d.capIdx, d.wordIdx, { dx: d.targetObj.dx, dy: d.targetObj.dy });
    }
    renderCanvas();
    updateVideoEditOverlay();
  };

  bbox.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);

  // Mini toolbar button handlers
  const btnWhole = $('btnEditModeWhole');
  if (btnWhole) {
    btnWhole.addEventListener('click', (e) => {
      e.stopPropagation();
      S.editMode = 'whole';
      updateVideoEditOverlay();
      console.log('[EDIT]', 'mode_whole', S.selectedCaptionId, -1, 'whole');
    });
  }

  const btnWord = $('btnEditModeWord');
  if (btnWord) {
    btnWord.addEventListener('click', (e) => {
      e.stopPropagation();
      S.editMode = 'word';
      if (S.selectedWordIndex < 0) S.selectedWordIndex = 0;
      updateVideoEditOverlay();
      console.log('[EDIT]', 'mode_word', S.selectedCaptionId, S.selectedWordIndex, 'word');
    });
  }

  const btnMiniEditText = $('btnMiniEditText');
  if (btnMiniEditText) {
    btnMiniEditText.addEventListener('click', (e) => {
      e.stopPropagation();
      openCaptionEditSheet(S.selectedCaptionId);
    });
  }

  const btnMiniResetPos = $('btnMiniResetPos');
  if (btnMiniResetPos) {
    btnMiniResetPos.addEventListener('click', (e) => {
      e.stopPropagation();
      const capIdx = S.captions.findIndex(c => c.id === S.selectedCaptionId);
      if (capIdx === -1) return;
      const cap = S.captions[capIdx];
      if (S.editMode === 'word' && S.selectedWordIndex >= 0 && cap.words && cap.words[S.selectedWordIndex]) {
        cap.words[S.selectedWordIndex].dx = 0;
        cap.words[S.selectedWordIndex].dy = 0;
        console.log('[EDIT]', 'reset_word_pos', capIdx, S.selectedWordIndex, 0);
      } else {
        cap.dx = 0;
        cap.dy = 0;
        cap.scale = 1.0;
        console.log('[EDIT]', 'reset_caption_pos', capIdx, -1, 0);
      }
      pushHistoryState('Reset position');
      renderCanvas();
      updateVideoEditOverlay();
      showToast('Position reset to default');
    });
  }

  const btnMiniApplyAll = $('btnMiniApplyAll');
  if (btnMiniApplyAll) {
    btnMiniApplyAll.addEventListener('click', (e) => {
      e.stopPropagation();
      const capIdx = S.captions.findIndex(c => c.id === S.selectedCaptionId);
      if (capIdx === -1) return;
      const cap = S.captions[capIdx];
      if (confirm('Apply this caption position and scale to all captions?')) {
        S.captions.forEach((c) => {
          c.dx = cap.dx || 0;
          c.dy = cap.dy || 0;
          c.scale = cap.scale || 1.0;
        });
        pushHistoryState('Apply position to all captions');
        console.log('[EDIT]', 'apply_all_pos', capIdx, -1, { dx: cap.dx, dy: cap.dy, scale: cap.scale });
        renderCanvas();
        updateVideoEditOverlay();
        showToast('Applied position to all captions');
      }
    });
  }

  const btnMiniDone = $('btnMiniDone');
  if (btnMiniDone) {
    btnMiniDone.addEventListener('click', (e) => {
      e.stopPropagation();
      deselectCaption();
    });
  }
}

/**
 * Setup Timeline Action Bar Handlers (Split, Edit, Duplicate, Merge, Nudge, Delete, Undo, Redo)
 */
function setupTimelineActionBar() {
  const btnClipSplit = $('btnClipSplit');
  if (btnClipSplit) {
    btnClipSplit.addEventListener('click', (e) => {
      e.stopPropagation();
      const capIdx = S.captions.findIndex(c => c.id === S.selectedCaptionId);
      if (capIdx === -1) return;
      const cap = S.captions[capIdx];
      const curT = vid.currentTime || 0;
      if (curT <= cap.start + 0.15 || curT >= cap.end - 0.15) {
        showToast('⚠️ Move playhead inside caption to split');
        return;
      }

      // Split text & words
      const wordsBefore = (cap.words || []).filter(w => (w.s || cap.start) < curT);
      const wordsAfter = (cap.words || []).filter(w => (w.s || cap.start) >= curT);

      const oldEnd = cap.end;
      cap.end = Math.round(curT * 100) / 100;
      cap.words = wordsBefore;
      cap.text = wordsBefore.map(w => w.t).join(' ') || cap.text;

      const newCap = {
        id: 'cap_' + Date.now(),
        start: Math.round(curT * 100) / 100,
        end: oldEnd,
        text: wordsAfter.map(w => w.t).join(' ') || '...',
        words: wordsAfter,
        dx: cap.dx || 0,
        dy: cap.dy || 0,
        scale: cap.scale || 1.0
      };

      S.captions.splice(capIdx + 1, 0, newCap);
      pushHistoryState('Split caption');
      console.log('[EDIT]', 'split', capIdx, -1, curT);
      renderTimeline();
      renderCanvas();
      selectCaption(newCap.id);
      showToast('✂️ Caption split');
    });
  }

  const btnClipEdit = $('btnClipEdit');
  if (btnClipEdit) {
    btnClipEdit.addEventListener('click', (e) => {
      e.stopPropagation();
      openCaptionEditSheet(S.selectedCaptionId);
    });
  }

  const btnClipDup = $('btnClipDup');
  if (btnClipDup) {
    btnClipDup.addEventListener('click', (e) => {
      e.stopPropagation();
      const capIdx = S.captions.findIndex(c => c.id === S.selectedCaptionId);
      if (capIdx === -1) return;
      const cap = S.captions[capIdx];
      const dur = cap.end - cap.start;
      const nextCap = S.captions[capIdx + 1];
      const availGap = nextCap ? (nextCap.start - cap.end) : 10;
      const newDur = Math.max(0.2, Math.min(dur, availGap > 0.2 ? availGap : dur));

      const newCap = JSON.parse(JSON.stringify(cap));
      newCap.id = 'cap_' + Date.now();
      newCap.start = Math.round(cap.end * 100) / 100;
      newCap.end = Math.round((newCap.start + newDur) * 100) / 100;

      S.captions.splice(capIdx + 1, 0, newCap);
      pushHistoryState('Duplicate caption');
      console.log('[EDIT]', 'duplicate', capIdx, -1, newCap.start);
      renderTimeline();
      renderCanvas();
      selectCaption(newCap.id);
      showToast('📑 Caption duplicated');
    });
  }

  const btnClipMerge = $('btnClipMerge');
  if (btnClipMerge) {
    btnClipMerge.addEventListener('click', (e) => {
      e.stopPropagation();
      const capIdx = S.captions.findIndex(c => c.id === S.selectedCaptionId);
      if (capIdx === -1 || capIdx >= S.captions.length - 1) {
        showToast('⚠️ No next caption to merge with');
        return;
      }
      const cap = S.captions[capIdx];
      const nextCap = S.captions[capIdx + 1];

      cap.end = nextCap.end;
      cap.text = (cap.text + ' ' + nextCap.text).trim();
      cap.words = (cap.words || []).concat(nextCap.words || []);
      S.captions.splice(capIdx + 1, 1);

      pushHistoryState('Merge with next caption');
      console.log('[EDIT]', 'merge', capIdx, -1, cap.end);
      renderTimeline();
      renderCanvas();
      selectCaption(cap.id);
      showToast('🔗 Captions merged');
    });
  }

  const btnClipNudgeMinus = $('btnClipNudgeMinus');
  if (btnClipNudgeMinus) {
    btnClipNudgeMinus.addEventListener('click', (e) => {
      e.stopPropagation();
      const capIdx = S.captions.findIndex(c => c.id === S.selectedCaptionId);
      if (capIdx === -1) return;
      const cap = S.captions[capIdx];
      const prevCap = S.captions[capIdx - 1];
      const minStart = prevCap ? prevCap.end : 0;
      const newStart = Math.max(minStart, cap.start - 0.1);
      const delta = newStart - cap.start;
      if (Math.abs(delta) < 0.001) return;

      cap.start = Math.round(newStart * 100) / 100;
      cap.end = Math.round((cap.end + delta) * 100) / 100;
      updateCaptionWordTimings(cap);

      pushHistoryState('Nudge caption -0.1s');
      console.log('[EDIT]', 'nudge_minus', capIdx, -1, delta);
      renderTimeline();
      renderCanvas();
    });
  }

  const btnClipNudgePlus = $('btnClipNudgePlus');
  if (btnClipNudgePlus) {
    btnClipNudgePlus.addEventListener('click', (e) => {
      e.stopPropagation();
      const capIdx = S.captions.findIndex(c => c.id === S.selectedCaptionId);
      if (capIdx === -1) return;
      const cap = S.captions[capIdx];
      const nextCap = S.captions[capIdx + 1];
      const maxEnd = nextCap ? nextCap.start : (vid.duration || 999);
      const newEnd = Math.min(maxEnd, cap.end + 0.1);
      const delta = newEnd - cap.end;
      if (Math.abs(delta) < 0.001) return;

      cap.start = Math.round((cap.start + delta) * 100) / 100;
      cap.end = Math.round(newEnd * 100) / 100;
      updateCaptionWordTimings(cap);

      pushHistoryState('Nudge caption +0.1s');
      console.log('[EDIT]', 'nudge_plus', capIdx, -1, delta);
      renderTimeline();
      renderCanvas();
    });
  }

  const btnClipDelete = $('btnClipDelete');
  if (btnClipDelete) {
    btnClipDelete.addEventListener('click', (e) => {
      e.stopPropagation();
      const capIdx = S.captions.findIndex(c => c.id === S.selectedCaptionId);
      if (capIdx === -1) return;
      S.captions.splice(capIdx, 1);
      deselectCaption();
      pushHistoryState('Delete caption');
      console.log('[EDIT]', 'delete', capIdx, -1, 0);
      renderTimeline();
      renderCanvas();
      showToast('🗑 Caption deleted');
    });
  }

  const btnClipUndo = $('btnClipUndo');
  if (btnClipUndo) {
    btnClipUndo.addEventListener('click', (e) => {
      e.stopPropagation();
      undo();
    });
  }

  const btnClipRedo = $('btnClipRedo');
  if (btnClipRedo) {
    btnClipRedo.addEventListener('click', (e) => {
      e.stopPropagation();
      redo();
    });
  }
}

/**
 * Bottom Sheet for Caption and Word Timing Editing
 */
let editingCapId = null;

function openCaptionEditSheet(capId) {
  const sheet = $('modalCaptionEditSheet');
  const textarea = $('editSheetFullText');
  const wordsScroll = $('sheetWordsScroll');
  if (!sheet || !textarea || !wordsScroll) return;

  editingCapId = capId || S.selectedCaptionId;
  const capIdx = S.captions.findIndex(c => c.id === editingCapId);
  if (capIdx === -1) return;
  const cap = S.captions[capIdx];

  textarea.value = cap.text || '';
  renderSheetWordChips(cap);

  sheet.classList.remove('hidden');
}

function renderSheetWordChips(cap) {
  const wordsScroll = $('sheetWordsScroll');
  if (!wordsScroll) return;
  wordsScroll.innerHTML = '';

  const words = cap.words || [];
  words.forEach((w, wIdx) => {
    const chip = document.createElement('div');
    chip.className = 'sheet-word-chip' + (wIdx === S.selectedWordIndex ? ' active' : '');
    const wDur = Math.max(0.05, (w.e || cap.end) - (w.s || cap.start)).toFixed(2);

    chip.innerHTML = `
      <span class="sheet-word-text">${w.t || ''}</span>
      <span class="sheet-word-time">${wDur}s</span>
      <div class="sheet-word-btns">
        <button type="button" class="btn-word-adj btn-word-sub" data-idx="${wIdx}" title="-0.05s">-</button>
        <button type="button" class="btn-word-adj btn-word-add" data-idx="${wIdx}" title="+0.05s">+</button>
      </div>
    `;

    chip.addEventListener('click', (e) => {
      if (e.target.closest('.btn-word-adj')) return;
      S.selectedWordIndex = wIdx;
      $$('.sheet-word-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
    });

    wordsScroll.appendChild(chip);

    // Draggable divider between words
    if (wIdx < words.length - 1) {
      const divider = document.createElement('div');
      divider.className = 'sheet-word-divider';
      divider.title = 'Drag to adjust boundary';

      let divDrag = null;
      divider.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        try { divider.setPointerCapture(e.pointerId); } catch(_) {}
        divDrag = {
          startX: e.clientX,
          origEnd: w.e || cap.start,
          nextStart: words[wIdx + 1].s || cap.end,
          pointerId: e.pointerId
        };
        divider.classList.add('dragging');
      });

      divider.addEventListener('pointermove', (e) => {
        if (!divDrag || divDrag.pointerId !== e.pointerId) return;
        const delta = (e.clientX - divDrag.startX) / 80;
        const newBoundary = Math.max((w.s || cap.start) + 0.05, Math.min((words[wIdx + 1].e || cap.end) - 0.05, divDrag.origEnd + delta));
        w.e = Math.round(newBoundary * 100) / 100;
        words[wIdx + 1].s = w.e;
        const durSpan = chip.querySelector('.sheet-word-time');
        if (durSpan) durSpan.textContent = Math.max(0.05, w.e - (w.s || cap.start)).toFixed(2) + 's';
      });

      const onDivUp = (e) => {
        if (!divDrag || divDrag.pointerId !== e.pointerId) return;
        divDrag = null;
        divider.classList.remove('dragging');
        try { divider.releasePointerCapture(e.pointerId); } catch(_) {}
        renderSheetWordChips(cap);
      };

      divider.addEventListener('pointerup', onDivUp);
      divider.addEventListener('pointercancel', onDivUp);

      wordsScroll.appendChild(divider);
    }
  });

  // +/- buttons handlers
  wordsScroll.querySelectorAll('.btn-word-adj').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      const isAdd = btn.classList.contains('btn-word-add');
      const w = words[idx];
      if (!w) return;

      const delta = isAdd ? 0.05 : -0.05;
      if (idx < words.length - 1) {
        const nextW = words[idx + 1];
        const newEnd = Math.max((w.s || cap.start) + 0.05, Math.min((nextW.e || cap.end) - 0.05, (w.e || cap.end) + delta));
        w.e = Math.round(newEnd * 100) / 100;
        nextW.s = w.e;
      } else {
        w.e = Math.max((w.s || cap.start) + 0.05, Math.min(cap.end, (w.e || cap.end) + delta));
      }
      renderSheetWordChips(cap);
    });
  });
}

function setupCaptionEditSheet() {
  const sheet = $('modalCaptionEditSheet');
  const btnClose = $('btnCloseEditSheet');
  const btnCancel = $('btnCancelEditSheet');
  const btnSave = $('btnSaveEditSheet');
  const textarea = $('editSheetFullText');

  const closeSheet = () => {
    if (sheet) sheet.classList.add('hidden');
    editingCapId = null;
  };

  if (btnClose) btnClose.addEventListener('click', closeSheet);
  if (btnCancel) btnCancel.addEventListener('click', closeSheet);

  if (btnSave) {
    btnSave.addEventListener('click', () => {
      const capIdx = S.captions.findIndex(c => c.id === editingCapId);
      if (capIdx === -1) { closeSheet(); return; }
      const cap = S.captions[capIdx];
      const newText = textarea ? textarea.value.trim() : cap.text;

      cap.text = newText;
      const textWords = newText.split(/\s+/).filter(Boolean);
      if (textWords.length !== (cap.words || []).length) {
        // Words changed in text input, re-distribute proportionally
        const dur = Math.max(0.2, cap.end - cap.start);
        const wDur = dur / Math.max(1, textWords.length);
        cap.words = textWords.map((t, i) => ({
          t,
          s: Math.round((cap.start + i * wDur) * 100) / 100,
          e: Math.round((cap.start + (i + 1) * wDur) * 100) / 100
        }));
      }

      pushHistoryState('Edit caption text & word timings');
      console.log('[EDIT]', 'save_text_sheet', capIdx, -1, cap.text);
      closeSheet();
      renderTimeline();
      renderCanvas();
      renderCaptionsList();
      showToast('Caption updated');
    });
  }
}

/**
 * A5: Template Search Filter
 */
function setupTemplateSearch() {
  const searchToggle = $('btnTemplateSearchToggle');
  const searchInput = $('templateSearchInput');
  if (searchToggle && searchInput) {
    searchToggle.addEventListener('click', () => {
      searchInput.classList.toggle('hidden');
      if (!searchInput.classList.contains('hidden')) {
        searchInput.focus();
      }
    });

    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      const cards = $$('#presetsGrid .preset-card');
      cards.forEach(c => {
        const title = (c.querySelector('.preset-title')?.textContent || '').toLowerCase();
        const tag = (c.querySelector('.preset-tag')?.textContent || '').toLowerCase();
        if (!q || title.includes(q) || tag.includes(q)) {
          c.style.display = 'flex';
        } else {
          c.style.display = 'none';
        }
      });
    });
  }
}

// ============================================================================
// POP STUDIO SCENE-BASED VIDEO TEMPLATE ENGINE
// ============================================================================

const POP_PALETTES = {
  sunset: {
    id: 'sunset',
    name: 'Sunset Pop',
    bgA: '#2A1B5E',
    bgB: '#5B2EBF',
    sticker: '#FFD93D',
    accent: '#FF4D8D',
    accent2: '#3EE0FF',
    ink: '#14102B',
    light: '#FFFFFF'
  },
  mint: {
    id: 'mint',
    name: 'Mint Fresh',
    bgA: '#0F3D3E',
    bgB: '#127A6B',
    sticker: '#7CFFCB',
    accent: '#FF6B5A',
    accent2: '#FFE066',
    ink: '#0B1F20',
    light: '#FFFFFF'
  },
  cherry: {
    id: 'cherry',
    name: 'Cherry Cream',
    bgA: '#FFF3E6',
    bgB: '#FFE0D1',
    sticker: '#FF4D6D',
    accent: '#2B2D42',
    accent2: '#4D96FF',
    ink: '#2B2D42',
    light: '#FFFFFF'
  },
  neon: {
    id: 'neon',
    name: 'Midnight Neon',
    bgA: '#0B0F1F',
    bgB: '#1B1F4B',
    sticker: '#00F0FF',
    accent: '#FF2E93',
    accent2: '#B5FF3D',
    ink: '#05060F',
    light: '#FFFFFF'
  },
  bubblegum: {
    id: 'bubblegum',
    name: 'Bubblegum',
    bgA: '#FFD6E8',
    bgB: '#E6C7FF',
    sticker: '#7B4DFF',
    accent: '#FF4D8D',
    accent2: '#FFE14D',
    ink: '#1E1236',
    light: '#FFFFFF'
  }
};
const POP_PALETTE_KEYS = ['sunset', 'mint', 'cherry', 'neon', 'bubblegum'];

// Hard Constants (scaled in units u = frameWidth / 100)
const POP_CONSTANTS = {
  stickerRadius: 3.0,     // 3u
  stickerOutline: 0.7,    // 0.7u
  stickerShadow: 1.4,     // (1.4u, 1.4u)
  cornerPinSize: 1.1,     // 1.1u
  cardRadius: 5.0,        // 5u
  cardOutline: 0.9,       // 0.9u
  cardShadow: 2.0,        // (2u, 2u)
  transitionDur: 0.28,    // 0.28s total (0.14s cut midpoint)
  safeMargin: 0.06        // 6% safe margins
};

// Seeded random number generator: pure function of seed
function seededPopRandom(seed) {
  const x = Math.sin(Number(seed) * 9301.0 + 49297.0) * 233280.0;
  return x - Math.floor(x);
}

// Easing functions
function popEaseOutBack(x) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const t = Math.max(0, Math.min(1, x));
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function popEaseOutCubic(x) {
  const t = Math.max(0, Math.min(1, x));
  return 1 - Math.pow(1 - t, 3);
}

function popEaseInOutQuad(x) {
  const t = Math.max(0, Math.min(1, x));
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// Global Video Templates Engine registry
const VIDEO_TEMPLATES = {
  specialRealEstate: {
    id: 'specialRealEstate',
    name: 'Special Real Estate',
    category: 'real-estate'
  },
  popStudio: {
    id: 'popStudio',
    name: 'Pop Studio',
    category: 'pop'
  }
};

// Cache structures for offscreen sticker sprites and beats
let _popBeatsCache = null;
let _popBeatsCacheKey = '';
let _popStickerSpriteCache = {};
let _lastLoggedPopBeat = -1;
let _popSharedOffscreen = null;
let _popSharedOffscreenCtx = null;

function getPopSharedOffscreen(w, h) {
  if (!_popSharedOffscreen) {
    _popSharedOffscreen = document.createElement('canvas');
    _popSharedOffscreenCtx = _popSharedOffscreen.getContext('2d');
  }
  if (_popSharedOffscreen.width !== w || _popSharedOffscreen.height !== h) {
    _popSharedOffscreen.width = w;
    _popSharedOffscreen.height = h;
  }
  _popSharedOffscreenCtx.clearRect(0, 0, w, h);
  return { canvas: _popSharedOffscreen, ctx: _popSharedOffscreenCtx };
}

/**
 * Ensure Poppins ExtraBold, SemiBold, and Anton fonts are loaded
 */
async function ensurePopStudioFonts() {
  if (typeof document !== 'undefined' && document.fonts && document.fonts.load) {
    try {
      await Promise.all([
        document.fonts.load('800 48px Poppins'),
        document.fonts.load('900 48px Poppins'),
        document.fonts.load('600 32px Poppins'),
        document.fonts.load('900 64px Anton')
      ]);
    } catch (_) {}
  }
}

/**
 * Auto director: Resolve captions into dynamic beats (2.2s to 4.5s)
 */
function resolvePopBeats(captions) {
  if (!captions || captions.length === 0) return [];

  const cacheKey = JSON.stringify(captions.map(c => [c.id, c.start, c.end, c.text])) +
                   '_' + (S.popStudioConfig?.sceneMix || 'balanced') +
                   '_' + (S.popStudioConfig?.palette || 'auto') +
                   '_' + JSON.stringify(S.popStudioConfig?.beatOverrides || {});

  if (_popBeatsCache && _popBeatsCacheKey === cacheKey) {
    return _popBeatsCache;
  }

  const beats = [];
  let currentGroup = [];
  let groupStart = captions[0].start;

  captions.forEach((cap, idx) => {
    currentGroup.push(cap);
    const dur = cap.end - groupStart;
    const endsWithPunct = /[.!?]$/.test((cap.text || '').trim());
    const isLast = (idx === captions.length - 1);

    if (isLast || (dur >= 2.2 && (endsWithPunct || dur >= 4.2))) {
      beats.push({
        captions: currentGroup,
        start: groupStart,
        end: cap.end
      });
      currentGroup = [];
      if (!isLast) {
        groupStart = captions[idx + 1].start;
      }
    }
  });

  // Merge trailing beat shorter than 1.8s
  if (beats.length > 1) {
    const lastBeat = beats[beats.length - 1];
    if (lastBeat.end - lastBeat.start < 1.8) {
      const prevBeat = beats[beats.length - 2];
      prevBeat.end = lastBeat.end;
      prevBeat.captions = prevBeat.captions.concat(lastBeat.captions);
      beats.pop();
    }
  }

  let lastScene = null;
  let lastS4Time = -999;
  let lastPalIdx = -1;

  beats.forEach((beat, bIdx) => {
    beat.index = bIdx;
    const allWords = [];
    beat.captions.forEach(c => {
      (c.words || []).forEach(w => allWords.push(w));
    });
    beat.words = allWords;

    // Pick Title phrase and hero word
    const titleInfo = pickPopTitlePhrase(beat.captions, allWords, bIdx);
    beat.titlePhrase = titleInfo.phrase;
    beat.heroWord = titleInfo.heroWord;
    beat.hasNumber = titleInfo.hasNumber;
    beat.targetNumber = titleInfo.targetNumber;
    beat.numberLabel = titleInfo.numberLabel;

    // Palette rotation (never same sticker color twice in a row)
    const palKey = S.popStudioConfig?.palette || 'auto';
    if (palKey === 'auto') {
      let nextPalIdx = (bIdx % POP_PALETTE_KEYS.length);
      if (nextPalIdx === lastPalIdx) {
        nextPalIdx = (nextPalIdx + 1) % POP_PALETTE_KEYS.length;
      }
      lastPalIdx = nextPalIdx;
      beat.paletteKey = POP_PALETTE_KEYS[nextPalIdx];
    } else {
      beat.paletteKey = POP_PALETTES[palKey] ? palKey : 'sunset';
    }
    beat.palette = POP_PALETTES[beat.paletteKey] || POP_PALETTES.sunset;

    // Scene assignment
    const override = S.popStudioConfig?.beatOverrides?.[bIdx];
    if (override && override !== 'auto') {
      beat.scene = override;
    } else if (bIdx === 0) {
      beat.scene = 'S1';
    } else {
      const isBrollActive = (S.brolls || []).some(b => b.url && b.start < beat.end && b.end > beat.start);
      const sceneMix = S.popStudioConfig?.sceneMix || 'balanced';

      if (isBrollActive && lastScene !== 'S5') {
        beat.scene = 'S5';
      } else if (beat.hasNumber && (beat.start - lastS4Time >= 8.0) && lastScene !== 'S4' && (sceneMix !== 'calm' || seededPopRandom(bIdx * 3) > 0.4)) {
        beat.scene = 'S4';
        lastS4Time = beat.start;
      } else if (beat.heroWord && lastScene !== 'S3' && (sceneMix === 'wild' || bIdx % 3 === 2)) {
        beat.scene = 'S3';
      } else {
        if (lastScene === 'S2') {
          beat.scene = 'S1';
        } else if (lastScene === 'S1') {
          beat.scene = 'S2';
        } else {
          beat.scene = (bIdx % 2 === 1) ? 'S2' : 'S1';
        }
      }
    }

    if (beat.scene === lastScene) {
      beat.scene = (lastScene === 'S1') ? 'S2' : 'S1';
    }
    lastScene = beat.scene;

    // Seeded transition type (0: diagonal wipe, 1: circle iris, 2: vertical push)
    beat.transitionType = Math.floor(seededPopRandom(bIdx * 37 + 101) * 3);
  });

  _popBeatsCache = beats;
  _popBeatsCacheKey = cacheKey;
  return beats;
}

/**
 * Pick Title Phrase (2-4 consecutive words around best hero word)
 */
function pickPopTitlePhrase(captions, words, seed) {
  const fullText = captions.map(c => c.text || '').join(' ');

  const numMatch = fullText.match(/(\b\d+(?:\.\d+)?%?|\$\d+(?:\.\d+)?|\b\d+k\b|\b\d+m\b)/i);
  let hasNumber = Boolean(numMatch);
  let targetNumber = numMatch ? numMatch[1] : '';
  let numberLabel = '';

  if (hasNumber && numMatch) {
    const after = fullText.slice(numMatch.index + numMatch[0].length).trim().split(/\s+/).slice(0, 2).join(' ');
    numberLabel = after || 'Growth';
  }

  const STOPWORDS = new Set([
    'bhai', 'bro', 'yaar', 'dost', 'sun', 'dekho', 'chalo', 'abhi', 'phir', 'fir',
    'bol', 'bolo', 'batao', 'dena', 'lena', 'likh', 'bhej', 'doonga', 'tujhe', 'mein', 'tu',
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'it', 'its', 'this', 'that',
    'have', 'has', 'had', 'do', 'does', 'did', 'so', 'if', 'as', 'by', 'from'
  ]);

  let bestWord = null;
  let bestScore = -1;
  let bestIdx = -1;

  words.forEach((w, idx) => {
    const raw = (w.t || w.word || '').trim();
    const clean = raw.toLowerCase().replace(/^[^\w]+|[^\w]+$/g, '');
    if (!clean || STOPWORDS.has(clean) || clean.length < 2) return;

    let score = clean.length;
    if (w.key) score += 8;
    if (/[A-Z]/.test(raw[0])) score += 2;
    if (/\d/.test(clean)) score += 5;

    if (score > bestScore) {
      bestScore = score;
      bestWord = raw;
      bestIdx = idx;
    }
  });

  let phrase = '';
  if (bestIdx >= 0 && words.length > 0) {
    const startIdx = Math.max(0, bestIdx - 1);
    const endIdx = Math.min(words.length, startIdx + 3);
    const sliceWords = words.slice(startIdx, endIdx).map(w => (w.t || w.word || '').trim());
    phrase = sliceWords.join(' ');
  } else if (words.length > 0) {
    phrase = words.slice(0, Math.min(3, words.length)).map(w => (w.t || w.word || '').trim()).join(' ');
  } else {
    phrase = 'Pop Studio';
  }

  phrase = phrase.replace(/[^\w\s]+$/, '');
  if (phrase.length > 0) {
    phrase = phrase.charAt(0).toUpperCase() + phrase.slice(1);
  }

  return { phrase, heroWord: bestWord, hasNumber, targetNumber, numberLabel };
}

/**
 * Get active Pop beat at time t
 */
function getPopBeatAtTime(t, captions) {
  const beats = resolvePopBeats(captions || S.captions || []);
  if (beats.length === 0) return null;

  let active = beats.find(b => t >= b.start && t < b.end);
  if (!active) {
    active = (t >= beats[beats.length - 1].end) ? beats[beats.length - 1] : beats[0];
  }

  if (active && active.index !== _lastLoggedPopBeat) {
    _lastLoggedPopBeat = active.index;
    console.log('[POP]', active.index, active.scene, active.titlePhrase);
  }

  return active;
}

/**
 * Pre-render and cache sticker sprite (1 per beat, offscreen)
 */
function getOrRenderStickerSprite(beat, u, W) {
  const spriteKey = `${beat.index}_${beat.titlePhrase}_${beat.paletteKey}_${Math.round(u * 10)}`;
  if (_popStickerSpriteCache[spriteKey]) {
    return _popStickerSpriteCache[spriteKey];
  }

  const p = beat.palette;
  const offCanvas = document.createElement('canvas');
  const offCtx = offCanvas.getContext('2d');

  // Measure text and auto-fit to max 2 lines, width <= 78% of frameWidth
  const maxW = W * 0.78;
  let fontSize = Math.max(16, Math.min(9.0 * u, Math.max(5.5 * u, u * 7.5)));

  offCtx.font = `800 ${fontSize}px "Poppins", sans-serif`;
  let words = beat.titlePhrase.split(/\s+/);
  let lines = [];

  // Line wrapping logic
  let curLine = '';
  words.forEach(w => {
    const testLine = curLine ? (curLine + ' ' + w) : w;
    if (offCtx.measureText(testLine).width <= maxW - 6.0 * u) {
      curLine = testLine;
    } else {
      if (curLine) lines.push(curLine);
      curLine = w;
    }
  });
  if (curLine) lines.push(curLine);
  if (lines.length > 2) {
    // Squeeze into 2 lines
    fontSize = Math.max(14, fontSize * 0.85);
    offCtx.font = `800 ${fontSize}px "Poppins", sans-serif`;
    lines = [lines.slice(0, Math.ceil(lines.length / 2)).join(' '), lines.slice(Math.ceil(lines.length / 2)).join(' ')];
  }

  let textW = 0;
  lines.forEach(l => {
    textW = Math.max(textW, offCtx.measureText(l).width);
  });

  const padX = 3.5 * u;
  const padY = 2.0 * u;
  const lineH = fontSize * 1.25;
  const boxW = Math.min(maxW, textW + padX * 2);
  const boxH = lines.length * lineH + padY * 2;

  const shadowOff = POP_CONSTANTS.stickerShadow * u;
  const canvasW = Math.ceil(boxW + shadowOff + 4 * u);
  const canvasH = Math.ceil(boxH + shadowOff + 4 * u);

  offCanvas.width = canvasW;
  offCanvas.height = canvasH;

  const rad = POP_CONSTANTS.stickerRadius * u;
  const outW = POP_CONSTANTS.stickerOutline * u;
  const pinRad = POP_CONSTANTS.cornerPinSize * u;

  // 1. HARD shadow offset in ink (no blur)
  offCtx.fillStyle = p.ink;
  offCtx.beginPath();
  offCtx.roundRect ? offCtx.roundRect(shadowOff, shadowOff, boxW, boxH, rad) : offCtx.rect(shadowOff, shadowOff, boxW, boxH);
  offCtx.fill();

  // 2. Sticker Fill
  offCtx.fillStyle = p.sticker;
  offCtx.beginPath();
  offCtx.roundRect ? offCtx.roundRect(0, 0, boxW, boxH, rad) : offCtx.rect(0, 0, boxW, boxH);
  offCtx.fill();

  // 3. Outline in ink
  offCtx.strokeStyle = p.ink;
  offCtx.lineWidth = outW;
  offCtx.stroke();

  // 4. Corner pin (circle in accent at top-right with tiny 'x')
  const pinX = boxW - pinRad * 1.6;
  const pinY = pinRad * 1.6;
  offCtx.fillStyle = p.accent;
  offCtx.beginPath();
  offCtx.arc(pinX, pinY, pinRad, 0, Math.PI * 2);
  offCtx.fill();
  offCtx.strokeStyle = p.ink;
  offCtx.lineWidth = Math.max(1, outW * 0.6);
  offCtx.stroke();

  // Tiny x mark
  const xArm = pinRad * 0.45;
  offCtx.beginPath();
  offCtx.moveTo(pinX - xArm, pinY - xArm);
  offCtx.lineTo(pinX + xArm, pinY + xArm);
  offCtx.moveTo(pinX + xArm, pinY - xArm);
  offCtx.lineTo(pinX - xArm, pinY + xArm);
  offCtx.stroke();

  // 5. Text in Poppins ExtraBold (palette.ink)
  offCtx.fillStyle = p.ink;
  offCtx.font = `800 ${fontSize}px "Poppins", sans-serif`;
  offCtx.textAlign = 'center';
  offCtx.textBaseline = 'middle';

  const startY = padY + lineH / 2;
  lines.forEach((l, i) => {
    offCtx.fillText(l, boxW / 2, startY + i * lineH);
  });

  _popStickerSpriteCache[spriteKey] = {
    canvas: offCanvas,
    w: boxW,
    h: boxH,
    totalW: canvasW,
    totalH: canvasH
  };

  return _popStickerSpriteCache[spriteKey];
}

/**
 * Draw Animated Sticker Card onto Context
 */
function drawPopStickerCard(ctx, beat, t, centerX, centerY, u, W) {
  const sprite = getOrRenderStickerSprite(beat, u, W);
  if (!sprite) return;

  const tau = Math.max(0, t - beat.start);
  const remaining = Math.max(0, beat.end - t);

  // Entrance: pop-in easeOutBack scale 0.6 -> 1.0 over 0.30s
  let scale = 1.0;
  if (tau < 0.30) {
    scale = 0.6 + 0.4 * popEaseOutBack(tau / 0.30);
  }

  // Exit: over 0.12s scale 0.9 + fade
  let alpha = 1.0;
  if (remaining < 0.12) {
    const exitP = remaining / 0.12;
    scale *= (0.9 + 0.1 * exitP);
    alpha = Math.max(0, exitP);
  }

  // Tilt: settles from -6 deg to beat tilt (alternate -3 deg and +2.5 deg)
  const targetTilt = (beat.index % 2 === 0 ? -3.0 : 2.5) * (Math.PI / 180);
  const startTilt = -6.0 * (Math.PI / 180);
  let rot = targetTilt;
  if (tau < 0.35) {
    rot = startTilt + (targetTilt - startTilt) * popEaseOutCubic(tau / 0.35);
  }

  // Idle bob: 0.4u at 1.2 Hz
  const bobY = Math.sin(tau * 1.2 * 2 * Math.PI) * 0.4 * u;

  ctx.save();
  ctx.translate(centerX, centerY + bobY);
  ctx.rotate(rot);
  ctx.scale(scale, scale);
  ctx.globalAlpha *= alpha;

  ctx.drawImage(sprite.canvas, -sprite.w / 2, -sprite.h / 2);
  ctx.restore();
}

/**
 * Draw Karaoke Subtitle Line
 */
function drawPopKaraokeSubtitles(ctx, beat, activeCap, t, cX, cY, u, W) {
  if (!activeCap) return;
  const words = activeCap.words || [];
  if (words.length === 0) return;

  const p = beat.palette;
  const fs = Math.max(14, 4.6 * u);
  const strokeW = Math.max(1.5, 0.6 * u);

  ctx.save();
  ctx.font = `800 ${fs}px "Poppins", sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Strip trailing punctuation from rendered words
  const cleanWords = words.map(w => {
    const raw = (w.t || w.word || '').trim();
    const clean = raw.replace(/[.,/#!$%^&*;:{}=\-_`~()]+$/g, '');
    const wWidth = ctx.measureText(clean).width;
    return { w, clean, width: wWidth };
  });

  const spaceW = ctx.measureText(' ').width;
  const maxLineW = W * 0.88;

  // Split into 1 or 2 lines
  let lines = [];
  let curLine = [];
  let curW = 0;

  cleanWords.forEach(wo => {
    if (curLine.length > 0 && curW + spaceW + wo.width > maxLineW) {
      lines.push(curLine);
      curLine = [wo];
      curW = wo.width;
    } else {
      curLine.push(wo);
      curW += (curLine.length > 1 ? spaceW : 0) + wo.width;
    }
  });
  if (curLine.length > 0) lines.push(curLine);

  const lineH = fs * 1.25;
  const totalH = lines.length * lineH;
  const startY = cY - totalH / 2 + fs * 0.85;

  lines.forEach((lWords, lIdx) => {
    const lW = lWords.reduce((acc, wo) => acc + wo.width, 0) + Math.max(0, lWords.length - 1) * spaceW;
    let wordX = cX - lW / 2;
    const wordY = startY + lIdx * lineH;

    lWords.forEach(wo => {
      const s = typeof wo.w.s === 'number' ? wo.w.s : (activeCap.start || 0);
      const e = typeof wo.w.e === 'number' ? wo.w.e : (activeCap.end || 0);
      const isCurrent = (t >= s && t <= e);
      const isPast = (t > e);

      ctx.save();

      if (isCurrent) {
        // Current word: palette.sticker color, scale 1.08 with easeOutBack over 0.12s
        const popProgress = Math.min(1.0, (t - s) / 0.12);
        const wScale = 1.0 + 0.08 * popEaseOutBack(popProgress);

        ctx.translate(wordX + wo.width / 2, wordY - fs * 0.35);
        ctx.scale(wScale, wScale);
        ctx.translate(-(wordX + wo.width / 2), -(wordY - fs * 0.35));

        // Stroke in ink
        ctx.strokeStyle = p.ink;
        ctx.lineWidth = strokeW;
        ctx.strokeText(wo.clean, wordX, wordY);

        // Fill in sticker
        ctx.fillStyle = p.sticker;
        ctx.fillText(wo.clean, wordX, wordY);

        // Underline swipe in palette.accent
        const swipeW = wo.width * popEaseOutCubic(popProgress);
        ctx.fillStyle = p.accent;
        ctx.fillRect(wordX, wordY + 0.3 * u, swipeW, 0.45 * u);
      } else if (isPast) {
        // Spoken: full light color with ink stroke
        ctx.strokeStyle = p.ink;
        ctx.lineWidth = strokeW;
        ctx.strokeText(wo.clean, wordX, wordY);

        ctx.fillStyle = p.light;
        ctx.fillText(wo.clean, wordX, wordY);
      } else {
        // Not yet spoken: 45% opacity
        ctx.globalAlpha *= 0.45;
        ctx.strokeStyle = p.ink;
        ctx.lineWidth = strokeW;
        ctx.strokeText(wo.clean, wordX, wordY);

        ctx.fillStyle = p.light;
        ctx.fillText(wo.clean, wordX, wordY);
      }

      ctx.restore();
      wordX += wo.width + spaceW;
    });
  });

  ctx.restore();
}

/**
 * Draw S2 Doodles (Sparkles, Animated Squiggle, Circle/Plus, Emoji Sticker)
 */
function drawPopDoodles(ctx, p, beat, t, cardRect, u, isSmooth) {
  if (isSmooth) return; // Skip on smooth preview mode

  const tau = Math.max(0, t - beat.start);

  // 1. Four-point sparkles at card corners (twinkle sine wave)
  const sparkles = [
    { x: cardRect.x - 1.5 * u, y: cardRect.y - 1.5 * u, phase: 0 },
    { x: cardRect.x + cardRect.w + 1.5 * u, y: cardRect.y - 1.5 * u, phase: 1.5 },
    { x: cardRect.x - 1.5 * u, y: cardRect.y + cardRect.h + 1.5 * u, phase: 3.0 },
    { x: cardRect.x + cardRect.w + 1.5 * u, y: cardRect.y + cardRect.h + 1.5 * u, phase: 4.5 }
  ];

  ctx.fillStyle = p.accent2;
  sparkles.forEach(sp => {
    const twinkle = 0.5 + 0.5 * Math.sin(tau * 4.0 + sp.phase);
    const spSize = (1.2 + 0.8 * twinkle) * u;
    ctx.save();
    ctx.translate(sp.x, sp.y);
    ctx.beginPath();
    ctx.moveTo(0, -spSize);
    ctx.quadraticCurveTo(0, 0, spSize, 0);
    ctx.quadraticCurveTo(0, 0, 0, spSize);
    ctx.quadraticCurveTo(0, 0, -spSize, 0);
    ctx.quadraticCurveTo(0, 0, 0, -spSize);
    ctx.fill();
    ctx.restore();
  });

  // 2. Animated Squiggle near title (drawn over 0.5s via line dash offset)
  const squigProgress = Math.min(1.0, tau / 0.50);
  const squigX = cardRect.x + 3 * u;
  const squigY = cardRect.y - 4.5 * u;
  const squigW = 10 * u;

  ctx.save();
  ctx.strokeStyle = p.accent;
  ctx.lineWidth = 0.55 * u;
  ctx.lineCap = 'round';
  ctx.setLineDash([squigW * squigProgress, squigW]);

  ctx.beginPath();
  ctx.moveTo(squigX, squigY);
  ctx.bezierCurveTo(squigX + 2.5 * u, squigY - 1.5 * u, squigX + 5 * u, squigY + 1.5 * u, squigX + 7.5 * u, squigY - 1.2 * u);
  ctx.bezierCurveTo(squigX + 8.5 * u, squigY - 0.5 * u, squigX + 9.5 * u, squigY + 1.0 * u, squigX + squigW, squigY);
  ctx.stroke();
  ctx.restore();

  // 3. Accent circle & Plus sign
  ctx.fillStyle = p.accent;
  ctx.beginPath();
  ctx.arc(cardRect.x + cardRect.w - 5 * u, cardRect.y - 3.5 * u, 0.7 * u, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = p.sticker;
  ctx.lineWidth = 0.5 * u;
  const plusX = cardRect.x - 2 * u;
  const plusY = cardRect.y + cardRect.h * 0.4;
  ctx.beginPath();
  ctx.moveTo(plusX - 0.8 * u, plusY);
  ctx.lineTo(plusX + 0.8 * u, plusY);
  ctx.moveTo(plusX, plusY - 0.8 * u);
  ctx.lineTo(plusX, plusY + 0.8 * u);
  ctx.stroke();

  // 4. Emoji Sticker at card top-right (popping in with 12 deg rotation)
  if (S.popStudioConfig?.emoji !== false) {
    const emojis = ['🔥', '🚀', '⭐', '💰', '👏', '❤️'];
    const emChar = emojis[beat.index % emojis.length];
    const emX = cardRect.x + cardRect.w - 1.5 * u;
    const emY = cardRect.y - 1.0 * u;
    const emPop = Math.min(1.0, tau / 0.35);
    const emScale = popEaseOutBack(emPop);

    ctx.save();
    ctx.translate(emX, emY);
    ctx.rotate(12 * (Math.PI / 180));
    ctx.scale(emScale, emScale);
    ctx.font = `${Math.round(4.0 * u)}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emChar, 0, 0);
    ctx.restore();
  }
}

/**
 * Draw S4 Number Pop Scene (Phase 2)
 */
function drawPopSceneS4(ctx, beat, activeCap, t, W, H, u, isSmooth, videoSource) {
  const p = beat.palette;
  const tau = Math.max(0, t - beat.start);

  // 1. Flat palette background
  ctx.fillStyle = p.bgA;
  ctx.fillRect(0, 0, W, H);

  // 2. 12 rotating sunburst rays from center
  const rayAngle = (tau * 8.0) % 360 * (Math.PI / 180);
  ctx.save();
  ctx.translate(W / 2, H * 0.42);
  ctx.rotate(rayAngle);
  ctx.fillStyle = p.bgB;
  for (let i = 0; i < 12; i++) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    const a1 = (i * 30 - 7.5) * (Math.PI / 180);
    const a2 = (i * 30 + 7.5) * (Math.PI / 180);
    ctx.arc(0, 0, Math.max(W, H) * 1.2, a1, a2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // 3. Big circular sticker badge in center
  const badgeX = W / 2;
  const badgeY = H * 0.40;
  const badgeRad = 15.0 * u;
  const shadowOff = 2.0 * u;

  // Hard shadow
  ctx.fillStyle = p.ink;
  ctx.beginPath();
  ctx.arc(badgeX + shadowOff, badgeY + shadowOff, badgeRad, 0, Math.PI * 2);
  ctx.fill();

  // Badge fill & outline
  ctx.fillStyle = p.sticker;
  ctx.beginPath();
  ctx.arc(badgeX, badgeY, badgeRad, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = p.ink;
  ctx.lineWidth = 0.9 * u;
  ctx.stroke();

  // Target number counting up from 0 to target over 0.6s
  const rawNumStr = beat.targetNumber || '100%';
  const numOnly = parseFloat(rawNumStr.replace(/[^\d.]/g, '')) || 100;
  const countProgress = Math.min(1.0, tau / 0.60);
  const currentVal = Math.round(numOnly * popEaseOutCubic(countProgress));
  const displayNum = rawNumStr.replace(/\d+(?:\.\d+)?/, currentVal);

  ctx.fillStyle = p.ink;
  ctx.font = `900 ${Math.min(22 * u, 140)}px "Anton", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(displayNum, badgeX, badgeY - 1.0 * u);

  // Label sticker under badge
  const labelText = beat.numberLabel || 'Growth';
  const labelW = Math.max(16 * u, labelText.length * 2.2 * u);
  const labelH = 4.2 * u;
  const labelY = badgeY + badgeRad * 0.72;

  ctx.fillStyle = p.ink;
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(badgeX - labelW / 2 + 1.2 * u, labelY + 1.2 * u, labelW, labelH, 2 * u) : ctx.rect(badgeX - labelW / 2 + 1.2 * u, labelY + 1.2 * u, labelW, labelH);
  ctx.fill();

  ctx.fillStyle = p.accent;
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(badgeX - labelW / 2, labelY, labelW, labelH, 2 * u) : ctx.rect(badgeX - labelW / 2, labelY, labelW, labelH);
  ctx.fill();
  ctx.strokeStyle = p.ink;
  ctx.lineWidth = 0.6 * u;
  ctx.stroke();

  ctx.fillStyle = p.light;
  ctx.font = `800 ${Math.max(12, 2.5 * u)}px "Poppins", sans-serif`;
  ctx.fillText(labelText.toUpperCase(), badgeX, labelY + labelH / 2);

  // 4. Confetti burst when number lands (tau >= 0.60, cap 24 seeded pieces)
  if (!isSmooth && tau >= 0.58) {
    const burstT = Math.min(1.5, tau - 0.58);
    const colors = [p.accent, p.accent2, p.sticker, p.light];
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2 + seededPopRandom(i + 13);
      const speed = (18.0 + seededPopRandom(i * 7) * 22.0) * u;
      const cDist = speed * burstT;
      const grav = 9.8 * u * burstT * burstT * 0.8;
      const cx = badgeX + Math.cos(angle) * cDist;
      const cy = badgeY + Math.sin(angle) * cDist + grav;
      const cRot = burstT * (i % 2 === 0 ? 5 : -5);

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(cRot);
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillRect(-0.6 * u, -0.35 * u, 1.2 * u, 0.7 * u);
      ctx.restore();
    }
  }

  // 5. Speaker in circular bubble at bottom-right
  const bubDiam = W * 0.28;
  const bubX = W * 0.68;
  const bubY = H * 0.66;
  drawSpeakerBubble(ctx, videoSource, bubX, bubY, bubDiam, u, p);

  // 6. Karaoke Subtitle line at 82%
  drawPopKaraokeSubtitles(ctx, beat, activeCap, t, W / 2, H * 0.82, u, W);
}

/**
 * Draw S5 B-Roll Cutaway Scene (Phase 2)
 */
function drawPopSceneS5(ctx, beat, activeCap, t, W, H, u, isSmooth, videoSource) {
  const p = beat.palette;
  const activeBroll = (S.brolls || []).find(b => b.url && t >= b.start && t <= b.end);

  // If active B-roll element exists and has frame data:
  let brollEl = null;
  if (activeBroll) {
    brollEl = (typeof brollElements !== 'undefined' && brollElements[activeBroll.id]) ? brollElements[activeBroll.id] : $('brollVid');
  }

  if (!brollEl || (brollEl.readyState && brollEl.readyState < 2)) {
    // Fallback to S1 full frame
    drawPopSceneS1(ctx, beat, activeCap, t, W, H, u, isSmooth, videoSource);
    return;
  }

  // 1. Diagonal gradient background
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, p.bgA);
  grad.addColorStop(1, p.bgB);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // 2. B-Roll in center rounded card (84% frame width, 4:5 aspect)
  const cardW = W * 0.84;
  const cardH = cardW * 1.25;
  const cardX = (W - cardW) / 2;
  const cardY = H * 0.28;
  const rad = 5.0 * u;
  const shadowOff = 2.0 * u;

  // Hard shadow
  ctx.fillStyle = p.ink;
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(cardX + shadowOff, cardY + shadowOff, cardW, cardH, rad) : ctx.rect(cardX + shadowOff, cardY + shadowOff, cardW, cardH);
  ctx.fill();

  // B-roll video inside card with clipping
  ctx.save();
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(cardX, cardY, cardW, cardH, rad) : ctx.rect(cardX, cardY, cardW, cardH);
  ctx.clip();
  drawCoverVideo(ctx, brollEl, cardX, cardY, cardW, cardH);
  ctx.restore();

  // Card outline
  ctx.strokeStyle = p.ink;
  ctx.lineWidth = 0.9 * u;
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(cardX, cardY, cardW, cardH, rad) : ctx.rect(cardX, cardY, cardW, cardH);
  ctx.stroke();

  // 3. Speaker circular bubble overlapping bottom-right corner
  const bubDiam = W * 0.28;
  const bubX = cardX + cardW - bubDiam * 0.85;
  const bubY = cardY + cardH - bubDiam * 0.65;
  drawSpeakerBubble(ctx, videoSource, bubX, bubY, bubDiam, u, p);

  // 4. Title sticker at top (14%)
  drawPopStickerCard(ctx, beat, t, W / 2, H * 0.14, u, W);

  // 5. Karaoke at bottom (82%)
  drawPopKaraokeSubtitles(ctx, beat, activeCap, t, W / 2, H * 0.82, u, W);
}

/**
 * Draw Speaker in Circular Bubble
 */
function drawSpeakerBubble(ctx, videoSource, x, y, diam, u, p) {
  const rad = diam / 2;
  const cx = x + rad;
  const cy = y + rad;
  const shadowOff = 1.6 * u;

  // Hard shadow
  ctx.fillStyle = p.ink;
  ctx.beginPath();
  ctx.arc(cx + shadowOff, cy + shadowOff, rad, 0, Math.PI * 2);
  ctx.fill();

  // Video circle clip
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.clip();
  drawCoverVideo(ctx, videoSource, x, y, diam, diam);
  ctx.restore();

  // Ink outline
  ctx.strokeStyle = p.ink;
  ctx.lineWidth = 0.9 * u;
  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.stroke();
}

/**
 * Draw Cover Video Helper (preserving aspect ratio)
 */
function drawCoverVideo(ctx, videoEl, dx, dy, dw, dh) {
  if (!videoEl) return;
  const vw = videoEl.videoWidth || videoEl.naturalWidth || videoEl.width || dw;
  const vh = videoEl.videoHeight || videoEl.naturalHeight || videoEl.height || dh;
  if (vw <= 0 || vh <= 0) return;

  const targetAspect = dw / dh;
  const videoAspect = vw / vh;
  let sx = 0, sy = 0, sw = vw, sh = vh;

  if (videoAspect > targetAspect) {
    sw = vh * targetAspect;
    sx = (vw - sw) / 2;
  } else {
    sh = vw / targetAspect;
    sy = (vh - sh) / 2;
  }

  try {
    if (typeof videoEl.draw === 'function') {
      // Mediabunny VideoSample
      videoEl.draw(ctx, dx, dy, dw, dh);
    } else {
      ctx.drawImage(videoEl, sx, sy, sw, sh, dx, dy, dw, dh);
    }
  } catch (_) {}
}

/**
 * S1 STICKER FULL Scene
 */
function drawPopSceneS1(ctx, beat, activeCap, t, W, H, u, isSmooth, videoSource) {
  // 1. Camera punch-in: 1.0 -> 1.05 easeOutCubic over 0.25s at beat start
  const tau = Math.max(0, t - beat.start);
  let punch = 1.0;
  if (S.popStudioConfig?.punch !== false && tau < 0.25) {
    punch = 1.05 - 0.05 * popEaseOutCubic(tau / 0.25);
  }

  // Draw full frame video if source provided (in export mode)
  if (videoSource) {
    ctx.save();
    if (punch > 1.001) {
      const pW = W * punch;
      const pH = H * punch;
      ctx.translate((W - pW) / 2, (H - pH) / 2);
      drawCoverVideo(ctx, videoSource, 0, 0, pW, pH);
    } else {
      drawCoverVideo(ctx, videoSource, 0, 0, W, H);
    }
    ctx.restore();
  }

  // 2. Title sticker centered at ~60%
  drawPopStickerCard(ctx, beat, t, W / 2, H * 0.60, u, W);

  // 3. Karaoke line at ~76%
  drawPopKaraokeSubtitles(ctx, beat, activeCap, t, W / 2, H * 0.76, u, W);
}

/**
 * S2 CARD ON COLOR Scene
 */
function drawPopSceneS2(ctx, beat, activeCap, t, W, H, u, isSmooth, videoSource) {
  const p = beat.palette;
  const tau = Math.max(0, t - beat.start);

  // 1. Diagonal gradient background (bgA -> bgB)
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, p.bgA);
  grad.addColorStop(1, p.bgB);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // 2. Dot grid (dots 0.5u at 12% opacity, spaced 5u, drifting 2u/sec)
  const dotRad = 0.5 * u;
  const dotGap = 5.0 * u;
  const drift = (tau * 2.0 * u) % dotGap;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  for (let x = -dotGap + drift; x <= W + dotGap; x += dotGap) {
    for (let y = 0; y <= H; y += dotGap) {
      ctx.beginPath();
      ctx.arc(x, y, dotRad, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 3. Rounded card: 84% width, ~4:5 aspect, top at 34%
  const cardW = W * 0.84;
  const cardH = cardW * 1.25;
  const cardX = (W - cardW) / 2;
  const cardY = H * 0.34;
  const rad = 5.0 * u;
  const shadowOff = 2.0 * u;

  // Card tilt: animates from -4 deg to -1.5 deg over 0.4s, then sways +/-0.6 deg
  let tilt = -1.5 * (Math.PI / 180);
  if (tau < 0.40) {
    tilt = (-4.0 + 2.5 * popEaseOutBack(tau / 0.40)) * (Math.PI / 180);
  } else {
    tilt += Math.sin((tau - 0.40) * 1.0 * 2 * Math.PI) * 0.6 * (Math.PI / 180);
  }

  const cardCenterX = cardX + cardW / 2;
  const cardCenterY = cardY + cardH / 2;

  ctx.save();
  ctx.translate(cardCenterX, cardCenterY);
  ctx.rotate(tilt);
  ctx.translate(-cardCenterX, -cardCenterY);

  // Hard shadow
  ctx.fillStyle = p.ink;
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(cardX + shadowOff, cardY + shadowOff, cardW, cardH, rad) : ctx.rect(cardX + shadowOff, cardY + shadowOff, cardW, cardH);
  ctx.fill();

  // Video inside card with clipping
  ctx.save();
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(cardX, cardY, cardW, cardH, rad) : ctx.rect(cardX, cardY, cardW, cardH);
  ctx.clip();

  if (videoSource) {
    drawCoverVideo(ctx, videoSource, cardX, cardY, cardW, cardH);
  } else if (typeof vid !== 'undefined') {
    drawCoverVideo(ctx, vid, cardX, cardY, cardW, cardH);
  }
  ctx.restore();

  // Card outline in ink
  ctx.strokeStyle = p.ink;
  ctx.lineWidth = 0.9 * u;
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(cardX, cardY, cardW, cardH, rad) : ctx.rect(cardX, cardY, cardW, cardH);
  ctx.stroke();

  // Doodles
  if (S.popStudioConfig?.doodles !== false) {
    drawPopDoodles(ctx, p, beat, t, { x: cardX, y: cardY, w: cardW, h: cardH }, u, isSmooth);
  }

  ctx.restore();

  // 4. Title sticker at ~14% (tilt +2 deg)
  drawPopStickerCard(ctx, beat, t, W / 2, H * 0.14, u, W);

  // 5. Karaoke line at ~27%
  drawPopKaraokeSubtitles(ctx, beat, activeCap, t, W / 2, H * 0.27, u, W);
}

/**
 * S3 HERO BEHIND Scene
 */
function drawPopSceneS3(ctx, beat, activeCap, t, W, H, u, isSmooth, videoSource, behindCtx) {
  // 1. Draw video full frame (if video source given in export)
  if (videoSource) {
    drawCoverVideo(ctx, videoSource, 0, 0, W, H);
  }

  const p = beat.palette;
  const heroWord = beat.heroWord || (activeCap?.words?.[0]?.t) || 'VIRAL';
  const displayHero = heroWord.toUpperCase().replace(/[^\w\s]+$/, '');

  // Anton hero font with palette gradient (sticker -> accent)
  const heroFs = Math.max(24, Math.round(W * 0.16));
  const heroTargetCtx = (behindCtx && segmenterInstance) ? behindCtx : ctx;

  heroTargetCtx.save();
  heroTargetCtx.font = `900 ${heroFs}px "Anton", sans-serif`;
  heroTargetCtx.textAlign = 'center';
  heroTargetCtx.textBaseline = 'middle';

  const heroY = H * 0.44;
  const heroGrad = heroTargetCtx.createLinearGradient(0, heroY - heroFs / 2, 0, heroY + heroFs / 2);
  heroGrad.addColorStop(0, p.sticker);
  heroGrad.addColorStop(1, p.accent);

  // Outline in ink
  heroTargetCtx.strokeStyle = p.ink;
  heroTargetCtx.lineWidth = Math.max(3, heroFs * 0.07);
  heroTargetCtx.lineJoin = 'round';
  heroTargetCtx.strokeText(displayHero, W / 2, heroY);

  // Fill in gradient
  heroTargetCtx.fillStyle = heroGrad;
  heroTargetCtx.fillText(displayHero, W / 2, heroY);
  heroTargetCtx.restore();

  // 2. Small sticker chip with supporting words in FRONT near lower third
  drawPopStickerCard(ctx, beat, t, W / 2, H * 0.65, u, W);

  // 3. Karaoke line at ~80%
  drawPopKaraokeSubtitles(ctx, beat, activeCap, t, W / 2, H * 0.80, u, W);
}

/**
 * Scene Transitions (0.28s total centered on boundary)
 */
function drawPopTransition(ctx, beat, nextBeat, t, W, H, u) {
  const transDur = POP_CONSTANTS.transitionDur; // 0.28s
  const transStart = beat.end - transDur / 2;
  const transEnd = beat.end + transDur / 2;

  if (t < transStart || t > transEnd) return;

  const progress = (t - transStart) / transDur;
  const transType = nextBeat ? nextBeat.transitionType : 0;
  const p = beat.palette;

  ctx.save();
  ctx.fillStyle = p.accent;

  if (transType === 0) {
    // (a) Diagonal band wipe in palette.accent
    const bandW = W * 0.6;
    const bandX = -bandW + (W + bandW * 2) * progress;
    ctx.beginPath();
    ctx.moveTo(bandX, 0);
    ctx.lineTo(bandX + bandW, 0);
    ctx.lineTo(bandX + bandW - H * 0.35, H);
    ctx.lineTo(bandX - H * 0.35, H);
    ctx.closePath();
    ctx.fill();
  } else if (transType === 1) {
    // (b) Circle iris centered on frame
    const maxR = Math.hypot(W, H) / 2;
    const irisR = progress < 0.5 ? (maxR * (progress / 0.5)) : (maxR * (1 - (progress - 0.5) / 0.5));
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, irisR, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // (c) Vertical push bar
    const barH = H * 0.45;
    const barY = progress < 0.5 ? (H * (1 - progress / 0.5)) : (0);
    ctx.fillRect(0, barY, W, barH);
  }

  ctx.restore();
}

/**
 * Main Pop Studio Drawing Routine (Used by both Preview and Export)
 */
function drawPopStudioFrame(ctx, behindCtx, t, W, H, isPreview, videoSource) {
  try {
    const beats = resolvePopBeats(S.captions || []);
    if (beats.length === 0) return;

    const beat = getPopBeatAtTime(t, S.captions);
    if (!beat) return;

    const u = W / 100.0;
    const effQuality = isPreview ? getEffectivePreviewQuality() : 'full';
    const isSmooth = (effQuality === 'smooth');

    const activeCap = (S.captions || []).find(c => t >= c.start && t <= c.end) || beat.captions[0];

    // Determine if we are near a beat transition
    const transDur = POP_CONSTANTS.transitionDur;
    const nextBeat = beats[beat.index + 1] || null;

    // Render active scene
    if (beat.scene === 'S2') {
      drawPopSceneS2(ctx, beat, activeCap, t, W, H, u, isSmooth, videoSource);
    } else if (beat.scene === 'S3') {
      drawPopSceneS3(ctx, beat, activeCap, t, W, H, u, isSmooth, videoSource, behindCtx);
    } else if (beat.scene === 'S4') {
      drawPopSceneS4(ctx, beat, activeCap, t, W, H, u, isSmooth, videoSource);
    } else if (beat.scene === 'S5') {
      drawPopSceneS5(ctx, beat, activeCap, t, W, H, u, isSmooth, videoSource);
    } else {
      drawPopSceneS1(ctx, beat, activeCap, t, W, H, u, isSmooth, videoSource);
    }

    // Render transition if active
    if (nextBeat) {
      drawPopTransition(ctx, beat, nextBeat, t, W, H, u);
    }

    // Subtle bottom progress bar
    const totalDur = vid.duration || S.probe?.duration || 10;
    if (totalDur > 0) {
      const barH = 0.4 * u;
      const prog = Math.min(1.0, Math.max(0, t / totalDur));
      ctx.fillStyle = beat.palette.accent;
      ctx.fillRect(0, H - barH, W * prog, barH);
    }

  } catch (err) {
    console.error('[POP STUDIO DRAW ERROR]', err);
  }
}



/**
 * Initialize Pop Studio UI Controls
 */
function initPopStudioUI() {
  const toggle = $('togglePopStudio');
  const body = $('vtemplatePopStudioBody');
  const chkDoodles = $('chkPopDoodles');
  const chkEmoji = $('chkPopEmoji');
  const chkPunch = $('chkPopPunch');

  if (toggle) {
    toggle.addEventListener('change', () => {
      const enabled = toggle.checked;
      if (!S.popStudioConfig) S.popStudioConfig = {};
      S.popStudioConfig.enabled = enabled;
      if (body) body.classList.toggle('is-disabled', !enabled);

      if (enabled) {
        if (!S.style) S.style = {};
        S.style.videoTemplate = 'popStudio';
        const reToggle = $('toggleSpecialRealEstate');
        if (reToggle && reToggle.checked) {
          reToggle.checked = false;
          if (S.realEstateConfig) S.realEstateConfig.enabled = false;
          const reBody = $('vtemplateRealEstateBody');
          if (reBody) reBody.classList.add('is-disabled');
        }
        showToast('🎉 Pop Studio Template activated!');
      } else {
        if (S.style && S.style.videoTemplate === 'popStudio') {
          delete S.style.videoTemplate;
        }
        if (typeof vid !== 'undefined' && vid) vid.style.opacity = '1';
      }
      _popBeatsCacheKey = '';
      _popStickerSpriteCache = {};
      renderPopBeatsList();
      renderCanvas();
    });
  }

  // Palette Swatches
  const swatches = $$('#popStudioPaletteSwatches .swatch-pill');
  swatches.forEach(btn => {
    btn.addEventListener('click', () => {
      swatches.forEach(b => b.classList.toggle('active', b === btn));
      const pal = btn.getAttribute('data-palette') || 'auto';
      if (!S.popStudioConfig) S.popStudioConfig = {};
      S.popStudioConfig.palette = pal;
      _popBeatsCacheKey = '';
      _popStickerSpriteCache = {};
      showToast('🎨 Pop Palette: ' + pal.toUpperCase());
      renderPopBeatsList();
      renderCanvas();
    });
  });

  // Scene Mix Segments
  const mixBtns = $$('#popStudioSceneMixGroup .btn-segment');
  mixBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      mixBtns.forEach(b => b.classList.toggle('active', b === btn));
      const mix = btn.getAttribute('data-mix') || 'balanced';
      if (!S.popStudioConfig) S.popStudioConfig = {};
      S.popStudioConfig.sceneMix = mix;
      _popBeatsCacheKey = '';
      renderPopBeatsList();
      renderCanvas();
    });
  });

  if (chkDoodles) {
    chkDoodles.addEventListener('change', () => {
      if (!S.popStudioConfig) S.popStudioConfig = {};
      S.popStudioConfig.doodles = chkDoodles.checked;
      renderCanvas();
    });
  }
  if (chkEmoji) {
    chkEmoji.addEventListener('change', () => {
      if (!S.popStudioConfig) S.popStudioConfig = {};
      S.popStudioConfig.emoji = chkEmoji.checked;
      renderCanvas();
    });
  }
  if (chkPunch) {
    chkPunch.addEventListener('change', () => {
      if (!S.popStudioConfig) S.popStudioConfig = {};
      S.popStudioConfig.punch = chkPunch.checked;
      renderCanvas();
    });
  }

  renderPopBeatsList();
}

function renderPopBeatsList() {
  const container = $('popBeatsListContainer');
  const countLabel = $('popBeatsCountLabel');
  if (!container) return;

  const beats = resolvePopBeats(S.captions || []);
  if (countLabel) countLabel.textContent = `${beats.length} beats`;
  container.innerHTML = '';

  const sceneCycle = ['auto', 'S1', 'S2', 'S3', 'S4', 'S5'];

  beats.forEach(beat => {
    const chip = document.createElement('div');
    chip.className = 'pop-beat-chip';
    const override = S.popStudioConfig?.beatOverrides?.[beat.index] || 'auto';

    chip.innerHTML = `
      <div class="pop-beat-chip-header">
        <span class="pop-beat-chip-num">#${beat.index + 1} (${beat.start.toFixed(1)}s-${beat.end.toFixed(1)}s)</span>
        <span class="pop-beat-chip-scene">${override !== 'auto' ? override : beat.scene}</span>
      </div>
      <span class="pop-beat-chip-title">${beat.titlePhrase}</span>
    `;

    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      const curIdx = sceneCycle.indexOf(override);
      const nextOverride = sceneCycle[(curIdx + 1) % sceneCycle.length];
      if (!S.popStudioConfig) S.popStudioConfig = {};
      if (!S.popStudioConfig.beatOverrides) S.popStudioConfig.beatOverrides = {};
      S.popStudioConfig.beatOverrides[beat.index] = nextOverride;

      _popBeatsCacheKey = '';
      vid.currentTime = beat.start;
      renderPopBeatsList();
      renderCanvas();
      showToast(`Beat #${beat.index + 1} scene: ${nextOverride.toUpperCase()}`);
    });

    container.appendChild(chip);
  });
}
