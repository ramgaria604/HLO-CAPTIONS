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
  user: null,
  currentProjectId: null,
  credits: 1,
  aspect: 'original',
  chunkMode: '3',
  autoEmojis: 'above',
  autoSfx: true,
  sfxVolume: 0.7,
  watermark: { text: '', platform: 'instagram', position: 'bottom-right', opacity: 0.8 },
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

    const dur = 0.20;
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
      const anim = getWordPop(wo.w, t, showAll, st.animation || o.role.enter || 'pop');

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

function drawCanvasTypography(ctxFore, ctxBehind, cap, words, t, st, W, H, isBehind, showAll) {
  if (!ctxFore) return;
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
      syncUserUI();
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
            body: JSON.stringify({ name, email })
          });
          const data = await res.json();
          if (!res.ok || !data.ok) {
            throw new Error(data.error || 'Login failed. Please use your valid Gmail.');
          }
          if (data.ok && data.user) {
            S.user = data.user;
            try { localStorage.setItem('cs_user', JSON.stringify(S.user)); } catch (_) {}
            // Sync exact server credits for this user
            if (typeof data.credits === 'number') {
              S.credits = data.credits;
              localStorage.setItem('cs_credits', String(S.credits));
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
          picture: payload.picture
        })
      }).then(r => r.json()).then(data => {
        if (data.ok && data.user) {
          S.user = data.user;
          try { localStorage.setItem('cs_user', JSON.stringify(S.user)); } catch (_) {}
          // Sync exact server credits for this Gmail account
          if (typeof data.credits === 'number') {
            S.credits = data.credits;
            localStorage.setItem('cs_credits', String(S.credits));
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

    let saved = localStorage.getItem('cs_credits');
    S.credits = saved !== null ? parseInt(saved, 10) : 1;
    if (isNaN(S.credits)) S.credits = 1;
    updateCreditsUI();

    // Verify credits with server in background to enforce 1-Free-Export limit across tabs/refresh
    const userAccountId = (S.user && S.user.id) ? S.user.id : deviceId;
    const userEmail = S.user ? (S.user.email || '') : '';
    fetch('/api/credits/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: userAccountId, email: userEmail, user_id: S.user ? S.user.id : null })
    }).then(r => r.json()).then(data => {
      if (typeof data.credits === 'number') {
        // If server says user already used their 1 free export, sync local state
        S.credits = Math.min(S.credits, data.credits);
        localStorage.setItem('cs_credits', String(S.credits));
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

        const res = await fetch('/api/coupons/redeem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: code,
            user_id: S.user ? S.user.id : null,
            device_id: deviceId
          })
        });

        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error || 'Invalid code');
        }

        S.credits = (S.credits || 0) + (data.added_credits || 10);
        localStorage.setItem('cs_credits', String(S.credits));
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
              S.credits = verifyData.total_credits || ((S.credits || 0) + (verifyData.credits_added || 1));
              localStorage.setItem('cs_credits', String(S.credits));
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
    setupDrawerAndNavHandlers();
    setupStyleHandlers();
    setupAudioHandlers();
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

    let lastSfxCapId = null;
    vid.addEventListener('timeupdate', () => {
      updateTransportUI();
      renderCanvas();
      syncTimelinePlayhead();

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

    if (btnStageFullscreen) btnStageFullscreen.addEventListener('click', toggleFullscreen);
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
      block.appendChild(durTag);

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
        const newEnd = Math.max(drag.origStart + 0.2, Math.min(totalDur, drag.origEnd + deltaSec));
        cap.end = Math.round(newEnd * 100) / 100;
        vid.currentTime = cap.end;
      } else if (drag.mode === 'left') {
        const newStart = Math.max(0, Math.min(drag.origEnd - 0.2, drag.origStart + deltaSec));
        cap.start = Math.round(newStart * 100) / 100;
        vid.currentTime = cap.start;
      } else if (drag.mode === 'move') {
        let newStart = drag.origStart + deltaSec;
        let newEnd = newStart + drag.origDur;
        if (newStart < 0) {
          newStart = 0;
          newEnd = drag.origDur;
        } else if (newEnd > totalDur) {
          newEnd = totalDur;
          newStart = Math.max(0, totalDur - drag.origDur);
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
        vid.currentTime = cap.start;
        if (timelineScrollContainer) {
          timelineScrollContainer.scrollLeft = cap.start * pxPerSec;
        }
        renderCanvas();
        syncTimelinePlayhead();
        vid.play().catch(() => {});
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

  function drawWatermark(ctx, W, H) {
    const wm = S.watermark;
    if (!wm || !wm.text || !wm.text.trim()) return;
    const text = wm.text.trim();
    const opacity = typeof wm.opacity === 'number' ? wm.opacity : 0.8;
    const pos = wm.position || 'bottom-right';
    const platform = wm.platform || 'instagram';

    let icon = '';
    if (platform === 'instagram') icon = '📷 ';
    else if (platform === 'youtube') icon = '▶️ ';
    else if (platform === 'tiktok') icon = '🎵 ';
    else if (platform === 'twitter') icon = '𝕏 ';

    const label = icon + text;
    const fontSize = Math.max(12, Math.min(20, Math.round(H * 0.02)));

    ctx.save();
    ctx.font = `700 ${fontSize}px "Poppins", sans-serif`;
    ctx.textBaseline = 'middle';
    const metrics = ctx.measureText(label);
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

    ctx.globalAlpha = opacity;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 1;
    const r = 8;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, boxW, boxH, r);
    else ctx.rect(x, y, boxW, boxH);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, x + padX, y + boxH / 2);
    ctx.restore();
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
    const topicWord = words.find(w => !['this', 'that', 'with', 'from', 'have', 'what', 'your', 'about'].includes(w)) || 'secret';

    const hooks = [
      {
        badge: '🔥 HIGH CURIOSITY',
        text: `Wait until the very end, especially if you care about ${topicWord}! 🤫`
      },
      {
        badge: '🛑 STOP SCROLLING',
        text: `Stop scrolling! 99% of people are doing this completely wrong ❌`
      },
      {
        badge: '🚀 VIRAL VALUE',
        text: `Nobody is talking about this crazy ${topicWord} hack in 2026... 💡`
      }
    ];

    const list = $('hooksList');
    if (!list) return;
    list.innerHTML = '';
    hooks.forEach(h => {
      const card = document.createElement('div');
      card.className = 'hook-card';
      card.innerHTML = `
        <div class="hook-info">
          <span class="hook-badge">${h.badge}</span>
          <div class="hook-text">${h.text}</div>
        </div>
        <button type="button" class="btn-insert-hook">+ Insert at 0s-3s</button>
      `;
      card.querySelector('.btn-insert-hook').addEventListener('click', () => {
        insertHookCaption(h.text);
        $('modalHooks').classList.add('hidden');
      });
      list.appendChild(card);
    });

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

  function renderCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const w = captionCanvas.width / dpr;
    const h = captionCanvas.height / dpr;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, captionCanvas.width, captionCanvas.height);
    ctx.scale(dpr, dpr);

    const t = vid.currentTime || 0;
    let activeCap = S.captions.find(c => t >= c.start && t <= c.end);

    // If no active caption at the exact currentTime:
    if (!activeCap) {
      if (S.captions.length > 0) {
        // While paused, scrubbing, or before speech starts:
        // Always preview the closest or first caption so the template style is 100% visible on the video!
        if (vid.paused) {
          activeCap = S.captions.find(c => t <= c.end) || S.captions[0];
        } else {
          drawWatermark(ctx, w, h);
          return;
        }
      } else {
        // If no captions exist yet, draw sample text using selected template
        drawSampleCaptionPreview(ctx, w, h, S.style || {});
        drawWatermark(ctx, w, h);
        return;
      }
    }

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
    drawAutoEmojis(ctx, activeCap, words, t, S.style || {}, w, h);
    drawWatermark(ctx, w, h);
  }

  // ==========================================================================
  // MODALS HANDLERS (FULL TEMPLATES, SCRIPT SYNC, EXPORT)
  // ==========================================================================
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

    btnExport.addEventListener('click', startExport);

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

  let activeDirectExport = null;

  async function startDirectCanvasExport() {
    const rawW = vid.videoWidth || S.probe?.width || 1080;
    const rawH = vid.videoHeight || S.probe?.height || 1920;

    // Standard 1080p maximum constraint
    let W = rawW;
    let H = rawH;
    if (W > 1920 || H > 1920) {
      const scale = Math.min(1920 / W, 1920 / H);
      W = Math.round(W * scale);
      H = Math.round(H * scale);
    }
    W = W % 2 === 0 ? W : W - 1;
    H = H % 2 === 0 ? H : H - 1;

    const recCanvas = document.createElement('canvas');
    recCanvas.width = W;
    recCanvas.height = H;
    const recCtx = recCanvas.getContext('2d', { alpha: false, desynchronized: true });

    // Identify supported MediaRecorder MIME type
    const mimeCandidates = [
      'video/mp4;codecs=avc1,mp4a.40.2',
      'video/mp4;codecs=avc1',
      'video/mp4',
      'video/webm;codecs=h264,opus',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm'
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

    // Audio stream capture
    let audioTrack = null;
    let streamFromVid = null;
    if (typeof vid.captureStream === 'function') {
      try { streamFromVid = vid.captureStream(); } catch (_) {}
    } else if (typeof vid.mozCaptureStream === 'function') {
      try { streamFromVid = vid.mozCaptureStream(); } catch (_) {}
    }

    if (streamFromVid && streamFromVid.getAudioTracks().length > 0) {
      audioTrack = streamFromVid.getAudioTracks()[0];
    }

    const canvasStream = recCanvas.captureStream ? recCanvas.captureStream(fps) : recCanvas.mozCaptureStream(fps);
    const combinedTracks = [canvasStream.getVideoTracks()[0]];
    if (audioTrack) {
      combinedTracks.push(audioTrack);
    }
    const exportStream = new MediaStream(combinedTracks);

    const recOptions = {
      videoBitsPerSecond: 12000000
    };
    if (chosenMime) recOptions.mimeType = chosenMime;

    const recorder = new MediaRecorder(exportStream, recOptions);
    const chunks = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    let isCancelled = false;
    let animFrameId = null;

    activeDirectExport = {
      stop: () => {
        isCancelled = true;
        if (animFrameId) cancelAnimationFrame(animFrameId);
        try { vid.pause(); } catch (_) {}
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

    // Prepare video from frame 0
    vid.pause();
    vid.currentTime = 0;
    vid.muted = true;

    await new Promise((resolve) => {
      const onSeek0 = () => {
        vid.removeEventListener('seeked', onSeek0);
        resolve();
      };
      vid.addEventListener('seeked', onSeek0, { once: true });
      setTimeout(onSeek0, 400);
    });

    recorder.start(100);

    // Smooth real-time playback recording - NO choppy seek jumping!
    try {
      await vid.play();
    } catch (playErr) {
      console.warn('Playback play() warning:', playErr);
    }

    let finishDone = false;
    const finishRecording = async () => {
      if (finishDone) return;
      finishDone = true;
      if (animFrameId) cancelAnimationFrame(animFrameId);
      vid.pause();

      updateExportPipeline(2, 'Done ✓', 'Packaging MP4...');
      exportProgressText.textContent = 'Finalizing 1080p video file...';
      exportProgressDetail.textContent = 'Packaging crystal-clear audio and zero-lag video streams.';
      exportProgressBar.style.width = '100%';
      exportPercent.textContent = '100%';

      try {
        recorder.stop();
      } catch (_) {}
    };

    const renderLoop = () => {
      if (isCancelled || finishDone) return;

      const curTime = vid.currentTime;

      // 1. Draw smooth video frame
      try {
        recCtx.drawImage(vid, 0, 0, W, H);
      } catch (err) {}

      // 2. Draw caption using EXACT same canvas typography engine
      const activeCap = S.captions.find(c => curTime >= c.start && curTime <= c.end);
      if (activeCap) {
        const words = (activeCap.words || []).map(w => ({
          t: w.t || w.word || '',
          s: typeof w.s === 'number' ? w.s : (typeof w.start === 'number' ? w.start : 0),
          e: typeof w.e === 'number' ? w.e : (typeof w.end === 'number' ? w.end : 0),
          key: Boolean(w.key),
          color: w.color || undefined
        }));

        drawCanvasTypography(recCtx, null, activeCap, words, curTime, S.style || {}, W, H, isBehind, false);
        drawAutoEmojis(recCtx, activeCap, words, curTime, S.style || {}, W, H);
      }

      // 3. Watermark
      drawWatermark(recCtx, W, H);

      // 4. Update progress UI smoothly
      const pct = Math.min(99, Math.max(5, Math.round((curTime / Math.max(0.1, duration)) * 100)));
      exportProgressBar.style.width = pct + '%';
      exportPercent.textContent = pct + '%';
      exportProgressText.textContent = `Rendering video smoothly (${pct}%)...`;
      exportProgressDetail.textContent = 'Recording 100% exact canvas fonts, colors & box highlights.';
      updateExportPipeline(1, `Recording ${Math.round(curTime)}s / ${Math.round(duration)}s`, 'Queued');

      if (curTime >= duration || vid.ended) {
        finishRecording();
        return;
      }

      animFrameId = requestAnimationFrame(renderLoop);
    };

    animFrameId = requestAnimationFrame(renderLoop);

    // Safety timeout in case vid.ended doesn't fire
    const maxRecordTimeMs = (duration + 2) * 1000;
    setTimeout(() => {
      if (!finishDone && !isCancelled) finishRecording();
    }, maxRecordTimeMs);
    updateExportPipeline(2, 'Done ✓', 'Packaging MP4...');
    exportProgressText.textContent = 'Finalizing 1080p video file...';
    exportProgressDetail.textContent = 'Packaging crystal-clear audio and video streams.';
    exportProgressBar.style.width = '100%';
    exportPercent.textContent = '100%';

    const finishExportPromise = new Promise((resolve) => {
      recorder.onstop = async () => {
        try {
          const recordedBlob = new Blob(chunks, { type: chosenMime || 'video/mp4' });
          const ext = (chosenMime && chosenMime.includes('webm')) ? 'webm' : 'mp4';

          S.credits = Math.max(0, S.credits - 1);
          localStorage.setItem('cs_credits', String(S.credits));
          updateCreditsUI();

          const devId = localStorage.getItem('cs_device_id');
          const userEmail = S.user ? (S.user.email || '') : '';
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

          const formData = new FormData();
          formData.append('video', recordedBlob, `canvas_export.${ext}`);
          formData.append('originalVideo', S.filename || '');
          if (S.bgmFilename) formData.append('bgMusic', S.bgmFilename);
          if (S.bgmVolume != null) formData.append('musicVol', Math.round(S.bgmVolume * 100));
          if (S.voiceoverFilename && btnReplaceVoiceover.classList.contains('active')) {
            formData.append('voiceover', S.voiceoverFilename);
          }

          let serverDownloadUrl = null;
          try {
            const controller = new AbortController();
            const fetchTimeout = setTimeout(() => controller.abort(), 15000);
            const res = await fetch('/api/save_canvas_export', {
              method: 'POST',
              body: formData,
              signal: controller.signal
            });
            clearTimeout(fetchTimeout);
            if (res.ok) {
              const data = await res.json();
              if (data.ok && data.download) {
                serverDownloadUrl = data.download;
              }
            }
          } catch (netErr) {
            console.warn('Canvas export server packaging timeout/error, serving client blob:', netErr);
          }

          const finalUrl = serverDownloadUrl || URL.createObjectURL(recordedBlob);
          updateExportPipeline(3);
          showExportComplete(finalUrl);
          resolve();
        } catch (postErr) {
          console.warn('save_canvas_export error, using local blob:', postErr);
          const recordedBlob = new Blob(chunks, { type: chosenMime || 'video/mp4' });
          const directBlobUrl = URL.createObjectURL(recordedBlob);
          updateExportPipeline(3);
          showExportComplete(directBlobUrl);
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

    // High-Fidelity Server Export:
    // STRICT SAME-ENGINE CANVAS EXPORT:
    // Guarantees 100% exact colors, typography, highlights and ZERO lag!
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
        watermark: S.watermark,
        auto_sfx: Boolean(S.autoSfx !== false)
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
          S.credits = Math.max(0, S.credits - 1);
          localStorage.setItem('cs_credits', String(S.credits));
          updateCreditsUI();
          // Sync deduction with server
          const devId = localStorage.getItem('cs_device_id');
          const uEmail = S.user ? (S.user.email || '') : '';
          const uName = S.user ? (S.user.name || '') : '';
          fetch('/api/credits/consume', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ device_id: devId, email: uEmail, name: uName })
          }).catch(() => {});
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
      if (isBlob) {
        const a = document.createElement('a');
        a.href = targetDownloadUrl;
        a.download = targetFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        window.location.href = targetDownloadUrl;
      }
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
