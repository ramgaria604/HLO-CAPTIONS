/* ==========================================================================
   HLO CAPTIONS - CLIENT APPLICATION (v3.04)
   Viral Presets + Instant Zero-Lag Video Preview + Accurate Listening AI + Duo Pack
   ========================================================================== */

(function () {
  'use strict';

  // --- Helpers ---
  const $ = (id) => document.getElementById(id);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  window.$ = $;
  window.$$ = $$;
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
  credits: 0,
  aspect: 'original',
  chunkMode: '3',
  autoEmojis: 'above',
    previewPerfMode: (() => {
      const isPhone = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (window.innerWidth <= 768 && !/iPad/i.test(navigator.userAgent));
      const saved = localStorage.getItem('cs_preview_perf_mode');
      return saved !== null ? (saved === 'true') : isPhone;
    })(),
    exportQuality: (() => {
      return localStorage.getItem('captionstudio_export_quality') || 'high';
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
  progressBar: { enabled: false, position: 'bottom' },
  bigType: true,
  heroLook: 'solid',
  lineByLine: true,
  font: 'Poppins',
  textCase: 'upper',
  realEstateColorLock: 'auto',
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

  /**
   * Universal Caption Text Casing Helper
   * Supports 'upper' (ALL CAPS), 'title' (Title Case), 'lower' (lowercase), and 'asIs' (Original)
   */
  function applyTextCase(text, mode) {
    if (text == null) return '';
    const str = String(text);
    const m = mode || S.style?.textCase || S.textCase || 'upper';
    if (m === 'upper') {
      return str.toUpperCase();
    } else if (m === 'lower') {
      return str.toLowerCase();
    } else if (m === 'title') {
      return str.replace(/\b([a-zA-Z])/g, c => c.toUpperCase());
    } else if (m === 'asIs' || m === 'normal' || m === 'none') {
      return str;
    }
    return str.toUpperCase();
  }
  window.applyTextCase = applyTextCase;

  /**
   * Top-Level Editor Restoration after Export
   */
  function restoreEditorAfterExport() {
    try {
      if (typeof vid !== 'undefined' && vid) {
        vid.style.opacity = '1';
      }
      if (captionCanvas) {
        const cCtx = captionCanvas.getContext('2d');
        if (cCtx) cCtx.clearRect(0, 0, captionCanvas.width, captionCanvas.height);
      }
      if (behindCanvas) {
        const bCtx = behindCanvas.getContext('2d');
        if (bCtx) bCtx.clearRect(0, 0, behindCanvas.width, behindCanvas.height);
      }
      if (personCanvas) {
        const pCtx = personCanvas.getContext('2d');
        if (pCtx) pCtx.clearRect(0, 0, personCanvas.width, personCanvas.height);
      }
      renderCanvas(true);
    } catch (_) {}
  }
  window.restoreEditorAfterExport = restoreEditorAfterExport;

  /**
   * Top-Level Hero Look Controller & State Synchronizer
   */
  function setHeroLook(look) {
    if (!look) return;
    S.heroLook = look;
    if (!S.style) S.style = {};
    S.style.heroLook = look;

    const btnSeeThrough = $('btnHeroLookSeeThrough');
    const btnTexture = $('btnHeroLookTexture');
    const btnSolid = $('btnHeroLookSolid');
    const badgeLook = $('valHeroLookBadge');

    if (btnSeeThrough) btnSeeThrough.classList.toggle('active', look === 'seeThrough');
    if (btnTexture) btnTexture.classList.toggle('active', look === 'texture');
    if (btnSolid) btnSolid.classList.toggle('active', look === 'solid');

    if (badgeLook) {
      badgeLook.textContent = look.toUpperCase();
      badgeLook.className = 'val-badge ' + (look === 'solid' ? 'badge-gray' : 'badge-green');
    }

    if (typeof _heroSpriteCache !== 'undefined' && _heroSpriteCache.clear) {
      _heroSpriteCache.clear();
    }

    const labels = {
      seeThrough: 'See-Through Glass',
      texture: 'Video Texture',
      solid: 'Solid'
    };
    showToast('✨ Hero look: ' + (labels[look] || look));
    renderCanvas(true);
  }
  window.setHeroLook = setHeroLook;

  function syncHeroLookUI(look) {
    const cur = look || S.heroLook || (S.style && S.style.heroLook) || 'solid';
    const btnSeeThrough = $('btnHeroLookSeeThrough');
    const btnTexture = $('btnHeroLookTexture');
    const btnSolid = $('btnHeroLookSolid');
    const badgeLook = $('valHeroLookBadge');

    if (btnSeeThrough) btnSeeThrough.classList.toggle('active', cur === 'seeThrough');
    if (btnTexture) btnTexture.classList.toggle('active', cur === 'texture');
    if (btnSolid) btnSolid.classList.toggle('active', cur === 'solid');

    if (badgeLook) {
      badgeLook.textContent = cur.toUpperCase();
      badgeLook.className = 'val-badge ' + (cur === 'solid' ? 'badge-gray' : 'badge-green');
    }
  }
  window.syncHeroLookUI = syncHeroLookUI;

  /**
   * Top-Level Bottom Progress Line Controller
   */
  function toggleBottomProgressLine(enabled) {
    if (!S.progressBar) S.progressBar = { enabled: false, position: 'bottom' };
    S.progressBar.enabled = Boolean(enabled);
    const chk = $('chkBottomProgressLine');
    if (chk) chk.checked = S.progressBar.enabled;
    const badge = $('valProgressBarBadge');
    if (badge) {
      badge.textContent = S.progressBar.enabled ? 'Active' : 'Hidden';
      badge.className = S.progressBar.enabled ? 'val-badge badge-green' : 'val-badge';
    }
    $$('#progressBarToggleGroup .btn-toggle').forEach(b => {
      b.classList.toggle('active', (b.getAttribute('data-progress') === 'on') === S.progressBar.enabled);
    });
    if (typeof syncReelProgressBar === 'function') {
      syncReelProgressBar();
    }
    if (typeof showToast === 'function') {
      showToast('📊 Bottom Progress Line: ' + (S.progressBar.enabled ? 'ON' : 'OFF'));
    }
    renderCanvas(true);
  }
  window.toggleBottomProgressLine = toggleBottomProgressLine;

  /**
   * Top-Level Caption Font Setter
   */
  function setCaptionFont(font) {
    if (!font) return;
    if (!S.style) S.style = {};
    S.style.fontFamily = font;
    S.font = font;
    if (!S.style.key) S.style.key = {};
    S.style.key.font = font;
    if (!S.style.roles) S.style.roles = {};
    if (S.style.roles.accent) S.style.roles.accent.font = font;
    if (S.style.roles.base) S.style.roles.base.font = font;
    if (typeof _heroSpriteCache !== 'undefined' && _heroSpriteCache.clear) {
      _heroSpriteCache.clear();
    }
    if (typeof syncTypographyUI === 'function') {
      syncTypographyUI();
    }
    if (typeof showToast === 'function') {
      showToast('🔤 Font: ' + font);
    }
    renderCanvas(true);
  }
  window.setCaptionFont = setCaptionFont;

  /**
   * Top-Level Caption Text Casing Setter
   */
  function setCaptionCase(casing) {
    if (!casing) return;
    if (!S.style) S.style = {};
    S.style.textCase = casing;
    S.textCase = casing;
    if (typeof _heroSpriteCache !== 'undefined' && _heroSpriteCache.clear) {
      _heroSpriteCache.clear();
    }
    if (typeof syncTypographyUI === 'function') {
      syncTypographyUI();
    }
    const caseLabels = { upper: 'ALL CAPS', title: 'Title Case', lower: 'lowercase', asIs: 'Original' };
    if (typeof showToast === 'function') {
      showToast('Aa Casing: ' + (caseLabels[casing] || casing));
    }
    renderCanvas(true);
  }
  window.setCaptionCase = setCaptionCase;

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

    const isSlide = (anim === 'slide-up' || anim === 'slide-down' || anim === 'slide-left' || anim === 'slide-right');
    const dur = isSlide ? 0.15 : 0.25;
    if (dt < dur) {
      const p = Math.max(0, Math.min(1, dt / dur));
      const ease = 1 - Math.pow(1 - p, 3);
      let dx = 0, dy = 0, scale = 1.0;
      const enterAnim = anim || 'pop';
      if (enterAnim === 'slide-up') {
        dy = 18 * (1 - ease);
      } else if (enterAnim === 'slide-down') {
        dy = -18 * (1 - ease);
      } else if (enterAnim === 'slide-left') {
        dx = 24 * (1 - ease);
      } else if (enterAnim === 'slide-right') {
        dx = -24 * (1 - ease);
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

const BEHIND_HEAD_OVERLAP_RATIO = 0.10;

/**
 * Places a behind-person word so only `overlapRatio` (~10%) of its visible ink height
 * sits behind the speaker's detected head crown while ~90% stays cleanly above it.
 * Auto-shrinks down toward `minSize` if needed so high heads never clip the top edge.
 */
function computeBehindCrownPlacement(ctx, text, {
  W = 720,
  H = 1280,
  fontFn,
  preferredSize = 160,
  minSize = 64,
  trackEm = 0,
  isSampleCard = false,
  fallbackCrownRatio = 0.225,
  overlapRatio = BEHIND_HEAD_OVERLAP_RATIO,
  safeTopRatio = 0.030,
  extraAbovePx = 0
} = {}) {
  const txt = String(text || '');
  const detectedTop = (!isSampleCard && typeof window !== 'undefined' && typeof window._editorialHeadTopRatio === 'number')
    ? window._editorialHeadTopRatio
    : null;
  const crownRatio = Math.max(0.045, Math.min(0.46, detectedTop !== null ? detectedTop : fallbackCrownRatio));
  const isTightHeadroom = crownRatio < 0.17;
  const headCrownY = Math.round(H * crownRatio);
  const safeTopY = Math.round(H * safeTopRatio) + Math.max(0, Math.round(extraAbovePx || 0));

  const measureGlyphs = (sz) => {
    let asc = 0;
    let desc = 0;
    if (ctx && typeof fontFn === 'function') {
      ctx.save();
      try {
        ctx.font = fontFn(sz);
        if (trackEm && 'letterSpacing' in ctx) ctx.letterSpacing = `${trackEm}em`;
        const m = ctx.measureText(txt || 'H');
        if (m && typeof m.actualBoundingBoxAscent === 'number' && m.actualBoundingBoxAscent > 0) {
          asc = m.actualBoundingBoxAscent;
          desc = Math.max(0, Number(m.actualBoundingBoxDescent) || 0);
        }
      } finally {
        ctx.restore();
      }
    }
    if (!(asc > 0)) {
      const hasTall = /[A-Z0-9%bdfhklt!?]/.test(txt);
      const hasDesc = /[gjpqy,]/.test(txt);
      asc = sz * (hasTall ? 0.73 : 0.56);
      desc = sz * (hasDesc ? 0.16 : 0.02);
    }
    return { asc, desc, inkH: Math.max(1, asc + desc) };
  };

  const floorMin = isTightHeadroom
    ? Math.max(18, Math.round(Math.min(minSize, preferredSize) * 0.72))
    : Math.min(minSize, preferredSize);
  let size = Math.max(floorMin, preferredSize);
  let glyphs = measureGlyphs(size);
  const availAbove = Math.max(18, headCrownY - safeTopY);
  const visibleFrac = Math.max(0.10, 1 - overlapRatio);
  if (glyphs.inkH * visibleFrac > availAbove) {
    const maxInkH = availAbove / visibleFrac;
    const shrunk = Math.floor(size * (maxInkH / Math.max(1, glyphs.inkH)));
    size = Math.max(floorMin, Math.min(size, shrunk));
    glyphs = measureGlyphs(size);
  }

  let baseY = Math.round(headCrownY + glyphs.inkH * overlapRatio - glyphs.desc);
  const hardTopY = Math.round(H * (isTightHeadroom ? 0.016 : 0.022)) + Math.max(0, Math.round(extraAbovePx || 0));
  if (baseY - glyphs.asc < hardTopY) {
    // Shrink to fit above the subject's crown instead of shoving text down behind the eyes/face.
    const maxLiftSpan = Math.max(20, (headCrownY + glyphs.inkH * overlapRatio) - hardTopY);
    if (isTightHeadroom && glyphs.inkH > maxLiftSpan) {
      const fitShrunk = Math.floor(size * (maxLiftSpan / Math.max(1, glyphs.inkH)));
      size = Math.max(floorMin, Math.min(size, fitShrunk));
      glyphs = measureGlyphs(size);
      baseY = Math.round(headCrownY + glyphs.inkH * overlapRatio - glyphs.desc);
    }
    if (baseY - glyphs.asc < hardTopY) {
      baseY = Math.round(hardTopY + glyphs.asc);
    }
  }
  const inkTopY = Math.round(baseY - glyphs.asc);
  const inkBotY = Math.round(baseY + glyphs.desc);
  const centerY = Math.round((inkTopY + inkBotY) * 0.5);
  return {
    size,
    baseY,
    centerY,
    inkTopY,
    inkBotY,
    headCrownY,
    headTopRatio: crownRatio,
    isTightHeadroom,
    asc: glyphs.asc,
    desc: glyphs.desc,
    inkH: glyphs.inkH
  };
}

function getSubjectMaskStats() {
  if (typeof window === 'undefined') return null;
  const s = window._subjectMaskStats;
  if (!s || !s.floats || !s.w || !s.h) return null;
  return s;
}

function getSubjectBoxOcclusion(xPx, yPx, wPx, hPx, W, H) {
  const s = getSubjectMaskStats();
  if (!s || !W || !H || wPx <= 0 || hPx <= 0) return null;
  const cols = 8;
  const rows = 4;
  let fg = 0;
  let maxVal = 0;
  let total = 0;
  const x0 = Math.max(0, Math.min(1, xPx / W));
  const x1 = Math.max(x0, Math.min(1, (xPx + wPx) / W));
  const y0 = Math.max(0, Math.min(1, yPx / H));
  const y1 = Math.max(y0, Math.min(1, (yPx + hPx) / H));
  for (let r = 0; r < rows; r++) {
    const ty = y0 + ((r + 0.5) / rows) * (y1 - y0);
    const my = Math.max(0, Math.min(s.h - 1, Math.floor(ty * s.h)));
    const rowOff = my * s.w;
    for (let c = 0; c < cols; c++) {
      const tx = x0 + ((c + 0.5) / cols) * (x1 - x0);
      const mx = Math.max(0, Math.min(s.w - 1, Math.floor(tx * s.w)));
      const v = s.floats[rowOff + mx] || 0;
      if (v > 0.5) fg++;
      if (v > maxVal) maxVal = v;
      total++;
    }
  }
  return {
    coverage: total > 0 ? fg / total : 0,
    maxVal,
    centerCoverage: typeof s.centerCoverage === 'number' ? s.centerCoverage : 0,
    headTopRatio: typeof s.headTopRatio === 'number' ? s.headTopRatio : 0.28
  };
}

function chooseAdaptiveBehindTarget(ctxFore, ctxBehind, isBehind, xPx, yPx, wPx, hPx, W, H, maxOccRatio = 0.36) {
  if (!isBehind || !ctxBehind) {
    return { ctx: ctxFore || ctxBehind, promoted: false, coverage: 0 };
  }
  const occ = getSubjectBoxOcclusion(xPx, yPx, wPx, hPx, W, H);
  if (!occ) {
    return { ctx: ctxBehind, promoted: false, coverage: 0 };
  }
  const tightCloseUp = occ.headTopRatio < 0.14 && occ.coverage > Math.min(0.28, maxOccRatio);
  if (occ.coverage > maxOccRatio || tightCloseUp) {
    return { ctx: ctxFore || ctxBehind, promoted: true, coverage: occ.coverage };
  }
  return { ctx: ctxBehind, promoted: false, coverage: occ.coverage };
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

  const ov = resolveSceneStyleOverrides(st, H);
  // 2. Preserve each preset's authentic designer font and typography
  const currentCase = S.style?.textCase || S.textCase || 'upper';
  const chosenFont = S.style?.fontFamily || S.font || st.fontFamily || st.font || (kRole && kRole.font) || (fRole && fRole.font) || 'Montserrat';
  const fontFam = `"${chosenFont}", "Poppins", sans-serif`;
  let fs = Math.max(18, Math.round(base * (st.fontSize || fRole.size || kRole.size || 0.082)));
  const leading = 1.18 * ov.lineSpacingMult;
  const stdTrackStr = ov.letterTrackDelta ? `${ov.letterTrackDelta}em` : '';

  // 3. Preserve each preset's authentic colors, highlights & gradients
  let smallColor = ov.customBase || st.baseColor || fRole.color || st.color || '#FFFFFF';
  let bigColor = ov.customHighlight || st.highlightColor || (st.highlight && st.highlight.color) || kRole.color || '#FFE600';
  let glowColor = st.glowColor || kRole.glow || st.glow || bigColor;

  // 4. Measure words per line & calculate safe auto-fit scale
  ctx.save();
  ctx.font = `800 ${fs}px ${fontFam}`;
  if (stdTrackStr && 'letterSpacing' in ctx) ctx.letterSpacing = stdTrackStr;
  let maxLineWidth = 0;
  const measuredLines = lines.map(lineWords => {
    let lineWidth = 0;
    const wordObjs = lineWords.map((w, idx) => {
      const isKey = Boolean(w.key);
      const txt = applyTextCase(w.t, currentCase);
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

  // If text width exceeds safe screen width, scale font size down proportionally without cancelling fontScale
  const stdFontScale = (typeof S.style?.fontScale === 'number' && S.style.fontScale > 0)
    ? S.style.fontScale
    : ((typeof st.fontScale === 'number' && st.fontScale > 0) ? st.fontScale : 1.0);
  const maxAllowedLineWidth = Math.min(W * 0.96, W * 0.86 * Math.max(1.0, stdFontScale));
  const fitScale = Math.min(1.0, maxAllowedLineWidth / Math.max(1, maxLineWidth));
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
    if (stdTrackStr && 'letterSpacing' in ctx) ctx.letterSpacing = stdTrackStr;
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
        if (stdTrackStr && 'letterSpacing' in ctx) ctx.letterSpacing = stdTrackStr;

        if (isBoxMode) {
          const padX = Math.max(6, Math.round(fs * 0.22));
          const boxW = wo.width + padX * 2;
          const boxH = fs * 1.20;
          ctx.save();
          ctx.fillStyle = ov.customHighlight || st.highlightColor || st.highlight.color || '#FFE600';
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
          const gColor = st.glowColor || (kRole && kRole.glow) || bigColor || '#FFE600';
          const gBlur = Math.max(6, Math.round(Number(st.glowBlur) || 18));

          if (isGlowActive && (wo.isKey || (ov.hasCustomGlow && ov.customGlowEnabled))) {
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
          ctx.fillStyle = wo.isKey
            ? (ov.customHighlight || canvasRolePaint(ctx, kRole, bigColor, fs, wordBox))
            : (ov.customBase || canvasRolePaint(ctx, fRole, smallColor, fs, wordBox));
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
  const cIdx = Math.max(0, Number(capId || 1) - 1);
  const nextCap = (S.captions && cIdx + 1 < S.captions.length) ? S.captions[cIdx + 1] : null;
  if (nextCap && typeof nextCap.start === 'number' && t >= nextCap.start && !showAll) {
    return;
  }

  const heroLook = (st.heroLook && st.heroLook !== 'solid') ? st.heroLook : (S.heroLook || st.heroLook || 'solid');
  const useUnified = (heroLook !== 'solid' || S.lineByLine !== false);

  if (useUnified && words.length > 0) {
    const capIdx = Math.max(0, Number(capId || 1) - 1);
    const hero = words[words.length - 1];
    const subtitle = words.length > 1 ? words.slice(0, -1) : [];

    const targetCtx = ctxBehind || ctxFore;
    const rawFs = Math.round(base * (st.depthAccentSize || 0.22));
    const kStyle = st.key || {};
    const heroFontFn = (sz) => `${kStyle.italic ? 'italic ' : ''}${kStyle.bold !== false ? 800 : 600} ${sz}px "${kStyle.font || 'Poppins'}", sans-serif`;
    const isBehindDepth = Boolean(ctxBehind || st.behindPerson || st.depthAccent);
    const crownPlace = isBehindDepth
      ? computeBehindCrownPlacement(targetCtx, hero.t, {
          W, H,
          fontFn: heroFontFn,
          preferredSize: rawFs,
          minSize: Math.round(H * 0.068),
          trackEm: Number(kStyle.track) || -0.02,
          isSampleCard: capId === 'preview_sample',
          fallbackCrownRatio: st.depthAccentY || 0.225
        })
      : null;
    const fs = crownPlace ? crownPlace.size : rawFs;
    const heroY = crownPlace ? Math.round(crownPlace.baseY - fs * 0.88) : H * (st.depthAccentY || 0.38);
    const heroBox = { x: W / 2, y: heroY, w: W * 0.70, h: crownPlace ? crownPlace.inkH : fs, fontSize: fs };
    const heroStart = (hero && typeof hero.s === 'number') ? hero.s : 0;
    const capDur = Math.max(0.2, (hero.e || 1) - heroStart);

    renderUnifiedHeroWord(targetCtx, hero.t, capIdx, heroBox, st, W, H, t, heroStart, capDur, 1.0, false, typeof vid !== 'undefined' ? vid : null, false);

    if (subtitle.length > 0 && ctxFore) {
      const subText = subtitle.map(w => w.t).join(' ');
      const subFs = Math.max(16, Math.round(base * (st.subtitleSize || 0.058)));
      const subY = Math.max(subFs + 8, Math.min(H - subFs - 8, H * (st.subtitlePosition || 0.74)));
      const subStart = (subtitle[0] && typeof subtitle[0].s === 'number') ? subtitle[0].s : 0;
      renderUnifiedSmallLine(ctxFore, subText, W / 2, subY, subFs, 1.0, t, subStart, false);
    }
    return;
  }
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
    const rawFs = Math.round(base * (st.depthAccentSize || 0.22));
    const crownPlace = ctxBehind
      ? computeBehindCrownPlacement(ctx, heroText, {
          W, H,
          fontFn: (sz) => (kRole.italic ? 'italic ' : '') + (kRole.bold ? 900 : 800) + ' ' + sz + 'px ' + heroFont,
          preferredSize: rawFs,
          minSize: Math.round(H * 0.068),
          isSampleCard: capId === 'preview_sample',
          fallbackCrownRatio: st.depthAccentY || 0.225
        })
      : null;
    const fs = crownPlace ? crownPlace.size : rawFs;
    const heroYPos = crownPlace ? crownPlace.centerY : (H * (st.depthAccentY || 0.41));
    ctx.save();
    ctx.translate(W / 2 + (heroAnim.dx || 0), heroYPos + (heroAnim.dy || 0));
    ctx.scale(heroAnim.scale || 1, heroAnim.scale || 1);
    if (typeof heroAnim.opacity === 'number') ctx.globalAlpha = heroAnim.opacity;
    ctx.font = (kRole.italic ? 'italic ' : '') + (kRole.bold ? 900 : 800) + ' ' + fs + 'px ' + heroFont;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const width = Math.max(1, ctx.measureText(heroText).width);
    const stretch = 1.10;
    const depthFontScale = (typeof S.style?.fontScale === 'number' && S.style.fontScale > 0 ? S.style.fontScale : 1.0);
    const fit = Math.min(1, Math.min(W * 0.96, W * 0.90 * Math.max(1.0, depthFontScale)) / (width * stretch));
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
  const subScale = (typeof S.style?.fontScale === 'number' && S.style.fontScale > 0 ? S.style.fontScale : 1.0);
  const subMaxW = Math.min(W * 0.96, W * 0.86 * Math.max(1.0, subScale));
  fs = Math.max(14, Math.floor(fs * Math.min(1, subMaxW / Math.max(1, ctx.measureText(text).width))));
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
      const chosenFont = S.style?.fontFamily || S.font || role.font || 'Montserrat';
      const font = (role.italic ? 'italic ' : '') + `${weight} ${size}px "${chosenFont}",sans-serif`;
      ctx.font = font;
      if ('letterSpacing' in ctx) ctx.letterSpacing = `${(role.track || 0) * size}px`;
      const caseMode = S.style?.textCase || S.textCase || (role.upper ? 'upper' : 'upper');
      const label = applyTextCase(item.word.t, caseMode);
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
  return function(lines, {W = 1080, H = 1920, posX = .5, posY = .5, inkGap = .03, maxWidth = .96} = {}) {
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

function drawInkStackPass(ctxFore, ctxBehind, cap, words, t, st, W, H, isBehind, showAll, isPreview = false) {
  if (!words || !words.length) return;
  // Ghosting fix: If next caption has already started, do not draw this caption's lines
  const curIdx = S.captions ? S.captions.indexOf(cap) : -1;
  const nextCap = (S.captions && curIdx >= 0 && curIdx + 1 < S.captions.length) ? S.captions[curIdx + 1] : null;
  if (nextCap && typeof nextCap.start === 'number' && t >= nextCap.start && !showAll) {
    return;
  }
  const roles = st.roles || {};
  const baseRole = roles.base || st.filler || {};
  const capId = (cap && (cap.index != null ? cap.index : cap.id)) || 1;
  const rawIdx = typeof capId === 'number' ? capId : parseInt(capId, 10);
  const capIdx = (!isNaN(rawIdx) && rawIdx > 0) ? rawIdx - 1 : 0;
  const alt = (st.accent2 || roles.accent2) && (capIdx % 2 === 1);
  const accentRole = (alt && (roles.accent2 || st.accent2)) || roles.accent || st.key || {};
  const caseMode = S.style?.textCase || S.textCase || st.textCase || (st.uppercase === false || accentRole.upper === false ? (accentRole.lower ? 'lower' : 'asIs') : 'upper');
  const stackLsRaw = (typeof S.style?.lineSpacing === 'number' && S.style.lineSpacing > 0) ? S.style.lineSpacing : 1.2;
  const stackLineSpacingMult = Math.max(0.65, Math.min(1.8, stackLsRaw / 1.2));
  const stackLetterDelta = (typeof S.style?.letterSpacing === 'number' && !isNaN(S.style.letterSpacing)) ? S.style.letterSpacing : 0;
  const baseInkGap = typeof st.inkGap === 'number' ? st.inkGap : 0.03;
  const inkGap = baseInkGap + (stackLineSpacingMult - 1.0) * 0.58;
  const posX = typeof st.posX === 'number' ? st.posX : 0.5;
  let posY = typeof S.style?.posY === 'number'
    ? S.style.posY
    : (typeof S.style?.position === 'number'
        ? S.style.position
        : (typeof st.posY === 'number'
            ? st.posY
            : (typeof st.position === 'number' ? st.position : 0.67)));
  if (Array.isArray(st.posCycle) && st.posCycle.length > 0 && typeof S.style?.posY !== 'number' && typeof S.style?.position !== 'number') {
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

  const up = (txt) => applyTextCase(txt, caseMode);
  const chosenFont = S.style?.fontFamily || S.font || st.fontFamily || st.font;
  const fontScale = (typeof S.style?.fontScale === 'number' && S.style.fontScale > 0)
    ? S.style.fontScale
    : ((typeof st.fontScale === 'number' && st.fontScale > 0) ? st.fontScale : 1.0);
  const scale = Math.max(0.01, Math.min(W / 1080, H / 1920)) * fontScale;
  const getRolePx = (r, defaultPx) => {
    const s = Number(r && r.size) || defaultPx;
    const pxFromRatio = s <= 1.0 ? s * H * fontScale : s * scale;
    const pxFromDefault = defaultPx > 1.0 ? defaultPx * scale : defaultPx * H * fontScale;
    return Math.max(4, Math.max(pxFromRatio, pxFromDefault));
  };

  const layoutFn = getLayoutStackFn();
  let lay;

  if (st.adaptiveEstateFlex || st.id === 'adaptive_estate_flex') {
    const toCapTitle = (s) => (s || '').split(' ').map(w => w ? (w.charAt(0).toUpperCase() + w.slice(1)) : '').join(' ');
    const fullText = words.map(w => w.t || w.word || '').join(' ');

    // Check if caption contains numeric values / prices (e.g. 20, 25,000, 100k, 500, etc.)
    const numWordIdx = words.findIndex(w => {
      const clean = (w.t || w.word || '').replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'’]/g, '');
      return /\b\d+[\d,.]*(?:k|m|b|lakh|cr|x)?\b/i.test(clean);
    });

    // Check if caption is punch/climax word (e.g. "attention", "profit", "results", "deal")
    const isPunchBeam = (
      /attention|numbers|viral|secret|money|grow|hook|deal|profit/i.test(fullText) ||
      (capIdx % 4 === 2 && numWordIdx === -1)
    );

    lay = [];

    if (numWordIdx !== -1) {
      // SCENARIO 1 & 2: METRIC BEHIND SPEAKER'S HEAD
      const metricWordObj = words[numWordIdx];
      const otherWords = frontWordsForBehindHero(words, numWordIdx);

      // Metric 1: Rainbow Glass Hollow ('20') | Metric 2: Magenta Satin Italic ('25,000')
      const isRainbow = (capIdx % 2 === 0);

      const metricRole = {
        font: 'Poppins',
        weight: 900,
        italic: !isRainbow,
        upper: true,
        lower: false,
        layer: 'behind',
        heroLook: isRainbow ? 'seeThroughRainbow' : 'magentaSatin',
        fill: isRainbow ? null : {
          type: 'gradient',
          colors: ['#FF26BE', '#D500F9', '#580077'],
          angle: 180
        },
        shadow: 14,
        shadowColor: 'rgba(0, 0, 0, 0.85)'
      };

      const bodyRole = {
        font: 'Poppins',
        weight: 700,
        italic: false,
        color: '#FFFFFF',
        layer: 'front',
        shadow: 6,
        shadowColor: 'rgba(0, 0, 0, 0.85)'
      };

      // 1. Giant Hero Metric Word behind speaker's head (Y ~ 0.18)
      const metricFontSize = Math.max(4, getRolePx(accentRole, isRainbow ? 245 : 235));
      lay = lay.concat(layoutFn([{
        text: metricWordObj.t || metricWordObj.word || '',
        font: 'Poppins',
        size: metricFontSize,
        weight: 900,
        italic: !isRainbow,
        track: -0.02,
        isHero: true,
        role: metricRole,
        words: [metricWordObj]
      }], { W, H, posX: 0.50, posY: 0.18, inkGap, maxWidth: 0.95 }));

      // 2. Front Body sentence in front of speaker's torso (Y ~ 0.52)
      if (otherWords.length > 0) {
        lay = lay.concat(layoutFn([{
          text: toCapTitle(otherWords.map(w => w.t || w.word || '').join(' ')),
          font: 'Poppins',
          size: Math.max(4, getRolePx(baseRole, 64)),
          weight: 700,
          italic: false,
          color: '#FFFFFF',
          isHero: false,
          role: bodyRole,
          words: otherWords
        }], { W, H, posX: 0.50, posY: 0.52, inkGap, maxWidth: 0.95 }));
      }

    } else if (isPunchBeam) {
      // SCENARIO 3: CLIMAX PUNCH WORD WITH HORIZONTAL MAGENTA ANAMORPHIC FLARE BEAM
      let heroIdx = words.findIndex(w => /attention|numbers|viral|secret|money|grow|hook|deal|profit/i.test(w.t || w.word || ''));
      if (heroIdx === -1) heroIdx = words.length - 1;

      const leadWords = words.slice(0, heroIdx);
      const punchWords = [words[heroIdx]];

      const beamRole = {
        font: 'Poppins',
        weight: 900,
        italic: false,
        upper: false,
        lower: true,
        color: '#FFFFFF',
        heroLook: 'punchBeam',
        layer: 'front',
        shadow: 18,
        shadowColor: 'rgba(235, 0, 255, 0.95)'
      };

      const leadRole = {
        font: 'Poppins',
        weight: 700,
        italic: false,
        color: '#FFFFFF',
        layer: 'front',
        shadow: 6,
        shadowColor: 'rgba(0, 0, 0, 0.85)'
      };

      if (leadWords.length > 0) {
        lay = lay.concat(layoutFn([{
          text: toCapTitle(leadWords.map(w => w.t || w.word || '').join(' ')),
          font: 'Poppins',
          size: Math.max(4, getRolePx(baseRole, 64)),
          weight: 700,
          italic: false,
          color: '#FFFFFF',
          isHero: false,
          role: leadRole,
          words: leadWords
        }], { W, H, posX: 0.50, posY: 0.48, inkGap, maxWidth: 0.95 }));
      }

      lay = lay.concat(layoutFn([{
        text: (punchWords[0].t || punchWords[0].word || '').toLowerCase(),
        font: 'Poppins',
        size: Math.max(4, getRolePx(accentRole, 125)),
        weight: 900,
        italic: false,
        color: '#FFFFFF',
        track: -0.02,
        isHero: true,
        role: beamRole,
        words: punchWords
      }], { W, H, posX: 0.50, posY: 0.54, inkGap, maxWidth: 0.95 }));

    } else {
      // SCENARIO 4: EDITORIAL NARRATIVE DEPTH + TILTED ITALIC FRONT STACK
      let keyIdx = words.findIndex((w, i) => w.key && i < 3);
      if (keyIdx === -1) keyIdx = Math.min(2, Math.floor(words.length / 2));
      if (keyIdx === 0 && words.length > 1) keyIdx = 1;

      const topLeadWords = words.slice(0, keyIdx);
      const heroKeyWords = [words[keyIdx]];
      const botStackWords = words.slice(keyIdx + 1);

      const chromeRole = {
        font: 'Poppins',
        weight: 900,
        italic: false,
        upper: false,
        lower: true,
        layer: 'behind',
        heroLook: 'texture',
        fill: {
          type: 'gradient',
          colors: ['#4A1D96', '#7C3AED', '#3B0764'],
          angle: 180
        },
        shadow: 14,
        shadowColor: 'rgba(0, 0, 0, 0.85)'
      };

      const whiteTiltedRole = {
        font: 'Poppins',
        weight: 700,
        italic: true,
        color: '#FFFFFF',
        layer: 'front',
        shadow: 6,
        shadowColor: 'rgba(0, 0, 0, 0.85)'
      };

      const whiteBoldRole = {
        font: 'Poppins',
        weight: 700,
        italic: false,
        color: '#FFFFFF',
        layer: 'front',
        shadow: 6,
        shadowColor: 'rgba(0, 0, 0, 0.85)'
      };

      // 1. Tilted Italic Lead words in front of speaker (Y ~ 0.50)
      if (topLeadWords.length > 0) {
        lay = lay.concat(layoutFn([{
          text: toCapTitle(topLeadWords.map(w => w.t || w.word || '').join(' ')),
          font: 'Poppins',
          size: Math.max(4, getRolePx(whiteTiltedRole, 62)),
          weight: 700,
          italic: true,
          track: -0.01,
          isHero: false,
          role: whiteTiltedRole,
          words: topLeadWords
        }], { W, H, posX: 0.50, posY: 0.50, inkGap, maxWidth: 0.90 }));
      }

      // 2. Hero Word behind speaker's head (Y ~ 0.20)
      lay = lay.concat(layoutFn([{
        text: (heroKeyWords[0].t || heroKeyWords[0].word || '').toLowerCase(),
        font: 'Poppins',
        size: Math.max(4, getRolePx(accentRole, 215)),
        weight: 900,
        italic: false,
        track: -0.02,
        isHero: true,
        role: chromeRole,
        words: heroKeyWords
      }], { W, H, posX: 0.50, posY: 0.20, inkGap, maxWidth: 0.95 }));

      // 3. Bottom Stack in front of torso (Y ~ 0.54)
      if (botStackWords.length > 0) {
        lay = lay.concat(layoutFn([{
          text: toCapTitle(botStackWords.map(w => w.t || w.word || '').join(' ')),
          font: 'Poppins',
          size: Math.max(4, getRolePx(whiteBoldRole, 64)),
          weight: 700,
          italic: false,
          color: '#FFFFFF',
          isHero: false,
          role: whiteBoldRole,
          words: botStackWords
        }], { W, H, posX: 0.50, posY: 0.54, inkGap, maxWidth: 0.90 }));
      }
    }
  } else if (isBehindPreset) {
    const heroY = typeof st.depthAccentY === 'number' ? st.depthAccentY : 0.25;
    const accentPx = getRolePx(accentRole, 230);
    const basePx = getRolePx(baseRole, 60);
    const fontSpan = (accentPx + basePx) * 0.5 / H + 0.008;
    const defaultTop = Math.max(0.02, Number((heroY - fontSpan).toFixed(3)));
    const topY = (typeof st.topY === 'number' ? st.topY : defaultTop) - (stackLineSpacingMult - 1.0) * 0.035;
    const subY = (typeof st.subtitlePosition === 'number' ? st.subtitlePosition : 0.72) + (stackLineSpacingMult - 1.0) * 0.045;

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
        font: chosenFont || baseRole.font || 'Poppins',
        size: Math.max(4, getRolePx(baseRole, 56)),
        weight: baseRole.weight || (baseRole.bold ? 700 : 500),
        italic: Boolean(baseRole.italic),
        track: Number(baseRole.track) || 0,
        isHero: false,
        lineType: 'top',
        role: baseRole,
        words: topWords
      };
      lay = lay.concat(layoutFn([topDesc], { W, H, posX, posY: topY, inkGap, maxWidth: 0.96 }));
    }

    if (heroWords.length > 0) {
      const heroDesc = {
        text: heroWords.map(w => up(w.t)).join(' '),
        font: chosenFont || accentRole.font || 'Montserrat',
        size: Math.max(4, getRolePx(accentRole, 230)),
        weight: accentRole.weight || (accentRole.bold ? 900 : 800),
        italic: Boolean(accentRole.italic),
        track: Number(accentRole.track) || 0,
        isHero: true,
        lineType: 'hero',
        role: accentRole,
        words: heroWords
      };
      lay = lay.concat(layoutFn([heroDesc], { W, H, posX, posY: heroY, inkGap, maxWidth: 0.96 }));
    }

    if (bottomWords.length > 0) {
      const bottomDesc = {
        text: bottomWords.map(w => up(w.t)).join(' '),
        font: chosenFont || baseRole.font || 'Poppins',
        size: Math.max(4, getRolePx(baseRole, 58)),
        weight: baseRole.weight || (baseRole.bold ? 700 : 500),
        italic: Boolean(baseRole.italic),
        track: Number(baseRole.track) || 0,
        isHero: false,
        lineType: 'bottom',
        role: baseRole,
        words: bottomWords
      };
      lay = lay.concat(layoutFn([bottomDesc], { W, H, posX, posY: subY, inkGap, maxWidth: 0.96 }));
    }
  } else if (st.dubaiLuxuryStack || st.id === 'dubai_luxury_stack') {
    const accent2Role = roles.accent2 || st.accent2 || accentRole;
    const heroColor = S.style?.highlightColor || accentRole.color || '#FFC72C';
    const userBaseCol = (S.style?._customBaseColorActive && S.style.baseColor) ? S.style.baseColor : '#FFFFFF';
    const hasWhiteSplash = (S.style?.whiteSplash !== false && st.whiteSplash !== false);
    const hasWhiteBloom = (S.style?.whiteBloom !== false && st.whiteBloom !== false);
    const lineSpacingMult = stackLineSpacingMult;

    const goldRole = Object.assign({}, accentRole, {
      color: heroColor,
      whiteBloom: hasWhiteBloom,
      fill: hasWhiteSplash ? {
        type: 'chrome-gold',
        colors: ['#FFFFFF', '#FFF2A8', heroColor, '#D99000'],
        angle: 180
      } : {
        type: 'solid',
        colors: [heroColor],
        angle: 90
      },
      keyGradient: hasWhiteSplash ? `linear-gradient(180deg, #FFFFFF, #FFF2A8, ${heroColor}, #D99000)` : undefined
    });

    const stackSequentialLines = (entries) => {
      const measured = entries.map(({ desc, xAlign }) => {
        const res = layoutFn([desc], { W, H, posX: xAlign, posY, inkGap: 0, maxWidth: 0.92 });
        return res && res[0] ? res[0] : null;
      }).filter(Boolean);
      if (!measured.length) return [];
      const lineHeights = measured.map((o) => Math.max(o.size * 0.85, (o.asc || o.size * 0.72) + (o.desc || o.size * 0.14)));
      const gaps = [];
      for (let i = 1; i < measured.length; i++) {
        const maxAdj = Math.max(measured[i - 1].size, measured[i].size);
        const rawGap = Math.round(maxAdj * (0.28 * lineSpacingMult + (lineSpacingMult - 1.0) * 0.40));
        gaps.push(Math.max(Math.round(maxAdj * 0.14), rawGap));
      }
      const totalH = lineHeights.reduce((a, b) => a + b, 0) + gaps.reduce((a, b) => a + b, 0);
      let curY = Math.max(H * 0.08, Math.min(H * 0.92 - totalH, posY * H - totalH * 0.5));
      measured.forEach((o, i) => {
        if (i > 0) curY += gaps[i - 1];
        const asc = o.asc || o.size * 0.72;
        const h = lineHeights[i];
        const halfW = (o.width || o.size * 2) * 0.5;
        o.x = Math.max(W * 0.04 + halfW, Math.min(W * 0.96 - halfW, o.x));
        o.inkTop = Math.round(curY);
        o.baseline = Math.round(curY + asc);
        o.inkBottom = Math.round(curY + h);
        o.y = Math.round((o.inkTop + o.inkBottom) * 0.5);
        curY += h;
      });
      return measured;
    };

    if (words.length >= 3) {
      let keyIdx = -1;
      for (let i = words.length - 1; i >= 0; i--) {
        if (words[i].key) { keyIdx = i; break; }
      }
      if (keyIdx === -1) keyIdx = words.length - 1;

      const slots = splitThreeLinesChronological(words, keyIdx);
      const buildSlotEntry = (seg, xAlign) => {
        if (!seg || !seg.words.length) return null;
        const desc = seg.isGold ? {
          text: seg.words.map(w => w.t.toUpperCase()).join(' '),
          font: chosenFont || accentRole.font || 'Montserrat',
          size: Math.max(4, getRolePx(accentRole, 95)),
          weight: accentRole.weight || 900,
          italic: Boolean(accentRole.italic),
          track: (Number(accentRole.track) || -0.02) + stackLetterDelta,
          isHero: true,
          role: goldRole,
          words: seg.words
        } : (seg === slots.top ? {
          text: seg.words.map(w => w.t.toLowerCase()).join(' '),
          font: chosenFont || accent2Role.font || 'Poppins',
          size: Math.max(4, getRolePx(accent2Role, 104)),
          weight: accent2Role.weight || 800,
          italic: Boolean(accent2Role.italic),
          track: (Number(accent2Role.track) || -0.03) + stackLetterDelta,
          isHero: false,
          role: Object.assign({}, accent2Role, { color: userBaseCol, whiteBloom: hasWhiteBloom, lower: true, upper: false }),
          words: seg.words
        } : {
          text: seg.words.map(w => w.t).join(' '),
          font: chosenFont || baseRole.font || 'Poppins',
          size: Math.max(4, getRolePx(baseRole, 80)),
          weight: baseRole.weight || 700,
          italic: Boolean(baseRole.italic),
          track: (Number(baseRole.track) || -0.01) + stackLetterDelta,
          isHero: false,
          role: Object.assign({}, baseRole, { color: userBaseCol, whiteBloom: hasWhiteBloom }),
          words: seg.words
        });
        return { desc, xAlign };
      };
      lay = stackSequentialLines([
        buildSlotEntry(slots.top, 0.42),
        buildSlotEntry(slots.mid, 0.50),
        buildSlotEntry(slots.bot, 0.57)
      ].filter(Boolean));
    } else if (words.length === 2) {
      const keyIsFirst = Boolean(words[0].key);
      const topDesc = keyIsFirst ? {
        text: words[0].t.toUpperCase(),
        font: chosenFont || accentRole.font || 'Montserrat',
        size: Math.max(4, getRolePx(accentRole, 95)),
        weight: accentRole.weight || 900,
        italic: Boolean(accentRole.italic),
        track: (Number(accentRole.track) || -0.02) + stackLetterDelta,
        isHero: true,
        role: goldRole,
        words: [words[0]]
      } : {
        text: words[0].t.toLowerCase(),
        font: chosenFont || accent2Role.font || 'Poppins',
        size: Math.max(4, getRolePx(accent2Role, 104)),
        weight: accent2Role.weight || 800,
        italic: Boolean(accent2Role.italic),
        track: (Number(accent2Role.track) || -0.03) + stackLetterDelta,
        isHero: false,
        role: Object.assign({}, accent2Role, { color: userBaseCol, whiteBloom: hasWhiteBloom, lower: true, upper: false }),
        words: [words[0]]
      };
      const botDesc = keyIsFirst ? {
        text: words[1].t.toLowerCase(),
        font: chosenFont || accent2Role.font || 'Poppins',
        size: Math.max(4, getRolePx(accent2Role, 104)),
        weight: accent2Role.weight || 800,
        italic: Boolean(accent2Role.italic),
        track: (Number(accent2Role.track) || -0.03) + stackLetterDelta,
        isHero: false,
        role: Object.assign({}, accent2Role, { color: userBaseCol, whiteBloom: hasWhiteBloom, lower: true, upper: false }),
        words: [words[1]]
      } : {
        text: words[1].t.toUpperCase(),
        font: chosenFont || accentRole.font || 'Montserrat',
        size: Math.max(4, getRolePx(accentRole, 95)),
        weight: accentRole.weight || 900,
        italic: Boolean(accentRole.italic),
        track: (Number(accentRole.track) || -0.02) + stackLetterDelta,
        isHero: true,
        role: goldRole,
        words: [words[1]]
      };
      lay = stackSequentialLines([
        { desc: topDesc, xAlign: 0.42 },
        { desc: botDesc, xAlign: 0.57 }
      ]);
    } else {
      const midDesc = {
        text: words[0].t.toUpperCase(),
        font: chosenFont || accentRole.font || 'Montserrat',
        size: Math.max(4, getRolePx(accentRole, 95)),
        weight: accentRole.weight || 900,
        italic: Boolean(accentRole.italic),
        track: (Number(accentRole.track) || -0.02) + stackLetterDelta,
        isHero: true,
        role: goldRole,
        words: words
      };
      lay = layoutFn([midDesc], { W, H, posX: 0.50, posY, inkGap, maxWidth: 0.92 });
    }
  } else if (st.crazySunsetStack || st.id === 'crazy_sunset_stack') {
    const toCapTitle = (s) => (s || '').split(' ').map(w => w ? (w.charAt(0).toUpperCase() + w.slice(1)) : '').join(' ');
    const heroColor = S.style?.highlightColor || '#FF7A00';
    const lineSpacingMult = (typeof S.style?.lineSpacing === 'number' && S.style.lineSpacing > 0)
      ? (S.style.lineSpacing / 1.2)
      : 1.0;
    const lineGap3 = 0.052 * fontScale * lineSpacingMult;
    const lineGap2 = 0.046 * fontScale * lineSpacingMult;

    const sunsetRole = Object.assign({}, accentRole, {
      font: 'Montserrat',
      weight: 900,
      italic: false,
      color: heroColor,
      fill: {
        type: 'sunset-gradient',
        colors: ['#FFE033', '#FFB800', heroColor],
        angle: 180
      },
      keyGradient: `linear-gradient(180deg, #FFE033 0%, #FFB800 40%, ${heroColor} 100%)`,
      glow: 'rgba(255, 110, 0, 0.40)',
      glowSize: 14,
      shadow: 6,
      shadowColor: 'rgba(0, 0, 0, 0.50)'
    });

    const whiteItalicRole = Object.assign({}, baseRole, {
      font: 'Poppins',
      weight: 700,
      italic: true,
      color: '#FFFFFF',
      shadow: 5,
      shadowColor: 'rgba(0, 0, 0, 0.65)'
    });

    lay = [];
    if (words.length >= 3) {
      let keyIdx = -1;
      for (let i = 0; i < words.length; i++) {
        if (words[i].key) { keyIdx = i; break; }
      }
      if (keyIdx === -1) keyIdx = 1; // Default middle word as hero

      const topWords = words.slice(0, keyIdx);
      const heroWords = [words[keyIdx]];
      const botWords = words.slice(keyIdx + 1);

      if (topWords.length > 0) {
        lay = lay.concat(layoutFn([{
          text: toCapTitle(topWords.map(w => w.t || w.word || '').join(' ')),
          font: 'Poppins',
          size: Math.max(4, getRolePx(whiteItalicRole, 68)),
          weight: 700,
          italic: true,
          track: -0.01,
          isHero: false,
          role: whiteItalicRole,
          words: topWords
        }], { W, H, posX: 0.50, posY: posY - lineGap3, inkGap, maxWidth: 0.95 }));
      }

      lay = lay.concat(layoutFn([{
        text: toCapTitle(heroWords.map(w => w.t || w.word || '').join(' ')),
        font: 'Montserrat',
        size: Math.max(4, getRolePx(sunsetRole, 115)),
        weight: 900,
        italic: false,
        track: -0.02,
        isHero: true,
        role: sunsetRole,
        words: heroWords
      }], { W, H, posX: 0.50, posY: posY, inkGap, maxWidth: 0.95 }));

      if (botWords.length > 0) {
        lay = lay.concat(layoutFn([{
          text: toCapTitle(botWords.map(w => w.t || w.word || '').join(' ')),
          font: 'Poppins',
          size: Math.max(4, getRolePx(whiteItalicRole, 68)),
          weight: 700,
          italic: true,
          track: -0.01,
          isHero: false,
          role: whiteItalicRole,
          words: botWords
        }], { W, H, posX: 0.50, posY: posY + lineGap3, inkGap, maxWidth: 0.95 }));
      }
    } else if (words.length === 2) {
      const isFirstHero = words[0].key || !words[1].key;
      const heroWords = isFirstHero ? [words[0]] : [words[1]];
      const subWords = isFirstHero ? [words[1]] : [words[0]];

      const heroDesc = {
        text: toCapTitle(heroWords[0].t || heroWords[0].word || ''),
        font: 'Montserrat',
        size: Math.max(4, getRolePx(sunsetRole, 118)),
        weight: 900,
        italic: false,
        track: -0.02,
        isHero: true,
        role: sunsetRole,
        words: heroWords
      };

      const subDesc = {
        text: toCapTitle(subWords[0].t || subWords[0].word || ''),
        font: 'Poppins',
        size: Math.max(4, getRolePx(whiteItalicRole, 72)),
        weight: 700,
        italic: true,
        track: -0.01,
        isHero: false,
        role: whiteItalicRole,
        words: subWords
      };

      if (isFirstHero) {
        lay = lay.concat(layoutFn([heroDesc], { W, H, posX: 0.50, posY: posY - lineGap2 * 0.45, inkGap, maxWidth: 0.95 }));
        lay = lay.concat(layoutFn([subDesc], { W, H, posX: 0.50, posY: posY + lineGap2 * 0.55, inkGap, maxWidth: 0.95 }));
      } else {
        lay = lay.concat(layoutFn([subDesc], { W, H, posX: 0.50, posY: posY - lineGap2 * 0.55, inkGap, maxWidth: 0.95 }));
        lay = lay.concat(layoutFn([heroDesc], { W, H, posX: 0.50, posY: posY + lineGap2 * 0.45, inkGap, maxWidth: 0.95 }));
      }
    } else {
      const singleDesc = {
        text: toCapTitle(words[0].t || words[0].word || ''),
        font: 'Montserrat',
        size: Math.max(4, getRolePx(sunsetRole, 122)),
        weight: 900,
        italic: false,
        track: -0.02,
        isHero: true,
        role: sunsetRole,
        words: words
      };
      lay = layoutFn([singleDesc], { W, H, posX: 0.50, posY, inkGap, maxWidth: 0.95 });
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
        font: chosenFont || baseRole.font || 'Poppins',
        size: Math.max(4, getRolePx(baseRole, 62)),
        weight: baseRole.weight || (baseRole.bold ? 700 : 500),
        italic: Boolean(baseRole.italic),
        track: (Number(baseRole.track) || 0) + stackLetterDelta,
        isHero: false,
        role: baseRole,
        words: smallWords
      });
    }
    if (bigWords.length > 0) {
      lineDescriptors.push({
        text: bigText,
        font: chosenFont || accentRole.font || 'Montserrat',
        size: Math.max(4, getRolePx(accentRole, 190)),
        weight: accentRole.weight || (accentRole.bold ? 900 : 800),
        italic: Boolean(accentRole.italic),
        track: (Number(accentRole.track) || 0) + stackLetterDelta,
        isHero: true,
        role: accentRole,
        words: bigWords
      });
    }
    lay = layoutFn(lineDescriptors, { W, H, posX, posY, inkGap, maxWidth: 0.96 });
  }

  // Align behind-person hero line so ~10% overlaps behind the speaker's hair crown and ~90% stays visible above it
  const hasBehindLayerPreset = Boolean(
    isBehind ||
    isBehindPreset ||
    st.behindPerson ||
    st.depthAccent ||
    (accentRole && accentRole.layer === 'behind')
  );
  if (hasBehindLayerPreset && Array.isArray(lay) && lay.length > 0) {
    const _isInkSampleCard = Boolean(cap && cap.id === 'preview_sample');
    const behindHero = lay.find(o => o && o.isHero && getLineLayer(o, st, H) === 'behind')
      || lay.find(o => o && getLineLayer(o, st, H) === 'behind');
    if (behindHero) {
      const heroTextForPlace = behindHero.text || (behindHero.words ? behindHero.words.map(w => w.t || w.word || '').join(' ') : '');
      const origInkTop = typeof behindHero.inkTop === 'number'
        ? behindHero.inkTop
        : ((behindHero.baseline || H * 0.22) - behindHero.size * 0.72);
      const aboveLines = lay.filter(o => o && o !== behindHero && !o.isHero && (
        o.lineType === 'top' ||
        ((typeof o.inkTop === 'number' ? o.inkTop : (o.baseline || H * 0.5) - o.size * 0.72) < origInkTop &&
          (typeof o.inkBottom === 'number' ? o.inkBottom : (o.baseline || H * 0.5)) <= origInkTop + Math.round(H * 0.06))
      ));
      const lineGapPx = Math.round(H * 0.014 * stackLineSpacingMult);
      const extraAbovePx = aboveLines.reduce((acc, l) => acc + Math.max(12, Math.round((l.asc || l.size * 0.72) + (l.desc || l.size * 0.08))) + lineGapPx, 0);
      const heroFontFn = (sz) => `${behindHero.italic ? 'italic ' : ''}${behindHero.weight || 900} ${sz}px "${behindHero.font || 'Montserrat'}", sans-serif`;
      const place = computeBehindCrownPlacement(ctxBehind || ctxFore, heroTextForPlace, {
        W,
        H,
        fontFn: heroFontFn,
        preferredSize: behindHero.size || Math.round(H * 0.16),
        minSize: Math.round(H * 0.068),
        trackEm: Number(behindHero.track) || 0,
        isSampleCard: _isInkSampleCard,
        fallbackCrownRatio: typeof st.depthAccentY === 'number' ? st.depthAccentY : 0.225,
        extraAbovePx
      });
      if (place.size !== behindHero.size && behindHero.size > 0 && typeof behindHero.width === 'number') {
        behindHero.width *= (place.size / behindHero.size);
      }
      behindHero.size = place.size;
      behindHero.asc = place.asc;
      behindHero.desc = place.desc;
      behindHero.inkTop = place.inkTopY;
      behindHero.baseline = place.baseY;
      behindHero.inkBottom = place.inkBotY;
      behindHero.y = place.centerY;

      // Keep top-rim/above-hero lines cleanly above the adjusted behind word without colliding
      let cursorBot = behindHero.inkTop - Math.round(H * 0.016);
      for (let idxA = aboveLines.length - 1; idxA >= 0; idxA--) {
        const topLine = aboveLines[idxA];
        const lAsc = topLine.asc || topLine.size * 0.72;
        const lDesc = topLine.desc || topLine.size * 0.08;
        const nextBot = Math.max(Math.round(H * 0.022 + lAsc + lDesc), cursorBot);
        const shiftY = nextBot - (typeof topLine.inkBottom === 'number' ? topLine.inkBottom : (topLine.baseline + lDesc));
        topLine.inkBottom = Math.round(nextBot);
        topLine.baseline = Math.round(nextBot - lDesc);
        topLine.inkTop = Math.round(topLine.baseline - lAsc);
        if (typeof topLine.y === 'number') topLine.y += shiftY;
        cursorBot = topLine.inkTop - lineGapPx;
      }
    }
  }

  window._capdbgKeys = window._capdbgKeys || new Set();
  const capDbgKey = `${W}x${H}|${S.style && S.style.lineSpacing}`;
  if (!window._capdbgKeys.has(capDbgKey)) {
    window._capdbgKeys.add(capDbgKey);
    const topItem = lay.find(o => o.lineType === 'top' || (!o.isHero && lay.indexOf(o) === 0));
    const heroItem = lay.find(o => o.isHero || o.lineType === 'hero');
    const midItem = lay.find(o => o !== topItem && o !== heroItem);
    const topPx = topItem ? Math.round(topItem.size) : 0;
    const midPx = midItem ? Math.round(midItem.size) : 0;
    const heroPx = heroItem ? Math.round(heroItem.size) : 0;
    console.log(`[CAPDBG] mode=${isPreview ? 'preview' : 'export'} W=${W} H=${H} scale=${scale} fontScale=${fontScale} lineSpacing=${S.style && S.style.lineSpacing} top=${topPx} mid=${midPx} hero=${heroPx}`);
  }

    const heroLookStack = S.heroLook || st.heroLook || 'solid';
  const hasAdaptiveLookInLay = lay.some(o => o.isHero && o.role?.heroLook && o.role.heroLook !== 'solid');
  const useUnifiedStack = (heroLookStack !== 'solid' || S.lineByLine !== false || hasAdaptiveLookInLay) && !st.dubaiLuxuryStack && st.id !== 'dubai_luxury_stack' && !st.crazySunsetStack && st.id !== 'crazy_sunset_stack';

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
    const _oW = Math.max(40, o.width || (o.size * 2.5));
    const _oH = Math.max(24, (o.asc && o.desc) ? (o.asc + o.desc) : (o.size * 0.9));
    const _oX = (typeof o.x === 'number' ? o.x : W * 0.5) - _oW * 0.5;
    const _oY = (typeof o.inkTop === 'number')
      ? o.inkTop
      : (typeof o.baseline === 'number' ? o.baseline - o.size * 0.85 : ((typeof o.y === 'number' ? o.y : posY * H) - _oH * 0.5));
    const _adaptive = chooseAdaptiveBehindTarget(ctxFore, ctxBehind, isBehindPerson, _oX, _oY, _oW, _oH, W, H, 0.38);
    const targetCtx = _adaptive.ctx;
    if (!targetCtx) return;

    if (useUnifiedStack) {
      if (o.isHero) {
        const heroText = o.words.map(w => w.t || w.word || '').join(' ');
        const heroWordObj = o.words[0] || { s: cap.start };
        const heroStart = (heroWordObj && typeof heroWordObj.s === 'number') ? heroWordObj.s : cap.start;
        const heroBox = {
          x: Math.round(o.x - (o.width || o.size * 2) / 2),
          y: Math.round((isBehindPerson && typeof o.baseline === 'number')
            ? (o.baseline - o.size * 0.88)
            : (o.inkTop || (o.baseline - o.size * 0.86))),
          w: Math.round(o.width || (o.size * (heroText.length * 0.56))),
          h: Math.round(o.asc + o.desc || o.size * 0.90),
          fontSize: Math.round(o.size),
          centerX: o.x
        };
        const activeStyle = Object.assign({}, st, {
          heroLook: o.role?.heroLook || st.heroLook,
          noItalic: o.role?.italic === false,
          italic: o.role?.italic === true,
          key: Object.assign({}, st.key, o.role)
        });
        renderUnifiedHeroWord(targetCtx, heroText, capIdx, heroBox, activeStyle, W, H, t, heroStart, cap.end - cap.start, 1.0, isPreview, vid, showAll);
        return;
      } else {
        const lineText = o.words.map(w => w.t || w.word || '').join(' ');
        const lineStart = (o.words[0] && typeof o.words[0].s === 'number') ? o.words[0].s : cap.start;
        const isTop = (o.lineType === 'top');
        const smallCase = o.role?.upper ? 'upper' : (o.role?.lower ? 'lower' : (st.uppercase === false ? 'asIs' : 'asIs'));
        renderUnifiedSmallLine(targetCtx, lineText, o.x, o.baseline, Math.round(o.size), 1.0, t, lineStart, isTop, showAll, smallCase);
        return;
      }
    }

    targetCtx.save();
    const fontStr = `${o.italic ? 'italic ' : ''}${o.weight} ${o.size}px "${o.font}", sans-serif`;
    targetCtx.font = fontStr;
    if ('letterSpacing' in targetCtx) targetCtx.letterSpacing = `${(o.track || 0) * o.size}px`;

    // Space between words must be at least 0.16 * font size; never negative margin
    const minSpace = 0.16 * o.size;
    const spaceWidth = Math.max(minSpace, targetCtx.measureText(' ').width);
    const wordObjs = o.words.map((w) => {
      let txt = up(w.t);
      if (o.role && o.role.upper) txt = txt.toUpperCase();
      else if (o.role && o.role.lower) txt = txt.toLowerCase();
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

        if (o.role && o.role.whiteBloom) {
          targetCtx.save();
          targetCtx.shadowColor = 'rgba(255, 255, 255, 0.45)';
          targetCtx.shadowBlur = Math.round(o.size * 0.28);
          targetCtx.shadowOffsetX = 0;
          targetCtx.shadowOffsetY = 0;
          targetCtx.fillStyle = 'rgba(255, 255, 255, 0.15)';
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
    
    // Fallback: ALWAYS ensure every caption has a hero candidate so big words are NEVER missing!
    let heroCandidate = validCandidates[0];
    if (!heroCandidate && candidates.length > 0) {
      const nonStop = candidates.filter(c => !REAL_ESTATE_STOPWORDS.has(c.clean)).sort((a, b) => b.score - a.score);
      if (nonStop.length > 0) {
        heroCandidate = nonStop[0];
      } else {
        const byLength = candidates.slice().sort((a, b) => b.clean.length - a.clean.length);
        heroCandidate = byLength[0];
      }
    }
    const hasValidHeroWord = Boolean(heroCandidate);

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

    // ALL words before heroIdx stay in chronological order in topWords
    let topWords = heroIdx > 0 ? words.slice(0, heroIdx) : [];
    // ALL words after heroIdx stay in chronological order in bottomWords
    let bottomWords = heroIdx >= 0 && heroIdx < words.length - 1 ? words.slice(heroIdx + 1) : [];

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

    const normScale = (typeof S.style?.fontScale === 'number' && S.style.fontScale > 0) ? S.style.fontScale : 1.0;
    const normLsMult = (typeof S.style?.lineSpacing === 'number' && S.style.lineSpacing > 0) ? (S.style.lineSpacing / 1.2) : 1.0;
    const fontSize = Math.round(W * 0.056 * normScale);
    const font = `800 ${fontSize}px 'Montserrat', 'Poppins', sans-serif`;
    const lineSpacing = fontSize * 1.34 * normLsMult;

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

    const cfg = S.realEstateConfig || {};
    const useBigType = Boolean(S.bigType !== false && cfg.bigType !== false);
    const heroTargetCtx = (isBehind && ctxBehind) ? ctxBehind : ctxFore;

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

    const currentCase = S.style?.textCase || S.textCase || 'upper';
    let displayHeroText = data.heroText;
    if (data.heroIsNum && !showAll) {
      const numProgress = Math.min(1, Math.max(0, stTime / 0.50));
      displayHeroText = formatNumberCounter(data.heroText, numProgress);
    }
    displayHeroText = applyTextCase(getCleanDisplayHeroText(displayHeroText), currentCase);

    const reScale = (typeof S.style?.fontScale === 'number' && S.style.fontScale > 0)
      ? S.style.fontScale
      : ((typeof st.fontScale === 'number' && st.fontScale > 0) ? st.fontScale : 1.0);

    // FIT CALCULATION: Reduce font size until measured width at PEAK scale <= 0.84 * W
    const maxAllowedHeroWidth = Math.min(0.96 * W, HERO_MAX_WIDTH_RATIO * W * Math.max(1.0, reScale));
    const peakEntranceScale = 1.10;
    const letterSpacing = 2;
    const strokePadding = 8;
    let heroFontSize = Math.round(W * 0.17 * reScale);
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
    const chosenReFont = S.style?.fontFamily || S.font || 'Montserrat';
    const heroFont = `900 ${heroFontSize}px '${chosenReFont}', 'Montserrat', 'Anton', sans-serif`;
    if (typeof document !== 'undefined' && document.fonts && document.fonts.load) {
      try { document.fonts.load(heroFont); } catch (_) {}
    }
    ctxFore.font = heroFont;
    const heroMetrics = ctxFore.measureText(displayHeroText);
    const heroW = heroMetrics.width + Math.max(0, displayHeroText.length - 1) * letterSpacing;
    const heroMetricsObj = (typeof measureBigTypeHeroWord === 'function' && useBigType)
      ? measureBigTypeHeroWord(heroTargetCtx, displayHeroText, heroFontSize, W)
      : null;
    const heroH = heroFontSize * 0.82;
    ctxFore.restore();

    // Horizontal position clamped within safe margins
    let heroX = Math.round((W - heroW) / 2);
    heroX = Math.max(W * BEHIND_SAFE_MARGIN, Math.min(W * (1 - BEHIND_SAFE_MARGIN) - heroW, heroX));

    // ========================================================================
    // VERTICAL PLACEMENT: BELOW (LOWER-THIRD / BOTTOM AREA OF VIDEO)
    // ========================================================================
    const reLsMult = (typeof S.style?.lineSpacing === 'number' && S.style.lineSpacing > 0) ? (S.style.lineSpacing / 1.2) : 1.0;
    const numTopLines = data.topLines ? data.topLines.length : 0;
    const topFontSize = Math.round(W * 0.046);
    const topLineSpacing = topFontSize * 1.30 * reLsMult;
    const totalTopH = numTopLines > 0 ? (numTopLines * topLineSpacing + 6) : 0;

    const numBottomLines = data.bottomLines ? data.bottomLines.length : 0;
    const bottomFontSize = Math.round(W * 0.052);
    const bottomLineSpacing = bottomFontSize * 1.30 * reLsMult;
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
        const topLineSpacing = (smallFontSize + 14) * reLsMult;
        data.topLines.forEach((lineChunk, lineIdx) => {
          const lineText = lineChunk.map(w => w.t || w.word || '').join(' ').toLowerCase();
          const curY = startTopY + lineIdx * topLineSpacing;
          const lineStart = (lineChunk[0] && typeof lineChunk[0].s === 'number') ? lineChunk[0].s : cap.start;
          if (S.heroLook !== 'solid' || S.lineByLine !== false) {
            renderUnifiedSmallLine(ctxFore, lineText, W / 2, curY + smallFontSize * 0.75, smallFontSize, exitAlpha, t, lineStart, true, showAll);
          } else {
            const topAlpha = (showAll ? 1.0 : Math.min(1.0, stTime / 0.12)) * exitAlpha;
            drawBigTypeSmallLine(ctxFore, lineText.toUpperCase(), W / 2, curY, smallFontSize, W, H, topAlpha);
          }
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

    const heroLookVal = S.heroLook || st.heroLook || 'solid';
    if (heroLookVal !== 'solid' || S.lineByLine !== false) {
      const heroWordObj = (data.heroWord) || { s: cap.start };
      const heroStart = (heroWordObj && typeof heroWordObj.s === 'number') ? heroWordObj.s : cap.start;
      const heroBox = { x: heroX, y: heroY, w: heroW, h: heroH, fontSize: heroFontSize };
      renderUnifiedHeroWord(drawCtx, displayHeroText, capIdx, heroBox, st, W, H, t, heroStart, capDur, exitAlpha, isPreview, vid, showAll);
    } else if (useBigType && heroMetricsObj) {
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
        const bottomLineSpacing = (smallFontSize + 14) * reLsMult;
        data.bottomLines.forEach((lineChunk, lineIdx) => {
          const lineText = lineChunk.map(w => w.t || w.word || '').join(' ').toLowerCase();
          const curLineY = startBottomY + lineIdx * bottomLineSpacing;
          const lineStart = (lineChunk[0] && typeof lineChunk[0].s === 'number') ? lineChunk[0].s : cap.start;
          if (S.heroLook !== 'solid' || S.lineByLine !== false) {
            renderUnifiedSmallLine(ctxFore, lineText, W / 2, curLineY + smallFontSize * 0.75, smallFontSize, exitAlpha, t, lineStart, false, showAll);
          } else {
            const lineAlpha = (showAll ? 1.0 : Math.min(1.0, stTime / 0.12)) * exitAlpha;
            drawBigTypeSmallLine(ctxFore, lineText.toUpperCase(), W / 2, curLineY, smallFontSize, W, H, lineAlpha);
          }
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

  }

  function drawRealEstateOverlays(ctx, W, H, t) {
    if (!ctx) return;
    const cfg = S.realEstateConfig || {};
    if (!cfg.enabled && (!S.style || S.style.videoTemplate !== 'specialRealEstate')) return;

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

      const presRole = (cfg.presenterRole || 'Luxury Real Estate Specialist').trim();

      ctx.shadowColor = 'transparent';
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `800 ${Math.round(ltH * 0.38)}px 'Montserrat', sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(presName || 'Alex Rivera', ltX + 18, ltY + Math.round(ltH * 0.16));

      ctx.fillStyle = '#fde047';
      ctx.font = `600 ${Math.round(ltH * 0.26)}px 'Montserrat', sans-serif`;
      ctx.fillText(presRole, ltX + 18, ltY + Math.round(ltH * 0.58));

      ctx.restore();
    }

    // 2. Location Tag (Top Left)
    if (cfg.locationTag) {
      const cityText = typeof getDetectedCityLocation === 'function' ? getDetectedCityLocation() : 'Beverly Hills, CA';
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



// ============================================================================
// POPPINS EXTRABOLD SEE-THROUGH HERO LOOK & REAL ESTATE CLR SUITE
// ============================================================================

const REAL_ESTATE_CLR_PALETTE = [
  { id: 'emerald', name: 'Emerald', top: '#2EE6A6', bottom: '#0F7A5A' },
  { id: 'magenta', name: 'Magenta', top: '#FF3DA5', bottom: '#8A1B5E' },
  { id: 'gold',    name: 'Gold',    top: '#FFD23F', bottom: '#D18A00' },
  { id: 'sky',     name: 'Sky',     top: '#4CB8FF', bottom: '#1D63B8' },
  { id: 'navy',    name: 'Navy',    top: '#3550B8', bottom: '#121F5C' },
  { id: 'orange',  name: 'Orange',  top: '#FF8A3D', bottom: '#D1470F' },
  { id: 'violet',  name: 'Violet',  top: '#A66BFF', bottom: '#5B2BC2' }
];

function getRealEstateClrGradient(captionIndex, lockedColor = 'auto', customPalette = null) {
  const activePalette = (customPalette && Array.isArray(customPalette) && customPalette.length > 0) ? customPalette : REAL_ESTATE_CLR_PALETTE;
  if (lockedColor && lockedColor !== 'auto') {
    const found = activePalette.find(c => c.id === lockedColor);
    if (found) return { palette: found, colorIndex: activePalette.indexOf(found) };
  }
  const colorIndex = Math.max(0, Number(captionIndex) || 0) % activePalette.length;
  return { palette: activePalette[colorIndex], colorIndex };
}

let _lastLoggedUnifiedHeroCapIdx = -1;
const _heroLuminanceCache = new Map();
const _heroSpriteCache = new Map();
let _luminanceCanvas = null;
let _luminanceCtx = null;

function brightenHex(hex, percent) {
  let c = String(hex || '').replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const num = parseInt(c, 16) || 0;
  let r = (num >> 16) & 255;
  let g = (num >> 8) & 255;
  let b = num & 255;
  r = Math.min(255, Math.round(r + (255 - r) * (percent / 100)));
  g = Math.min(255, Math.round(g + (255 - g) * (percent / 100)));
  b = Math.min(255, Math.round(b + (255 - b) * (percent / 100)));
  return `rgb(${r}, ${g}, ${b})`;
}

function hexToRgba(hex, alpha) {
  let c = String(hex || '').replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const num = parseInt(c, 16) || 0;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getSampledLuminanceBehindHero(videoEl, heroBox, capIndex, W, H) {
  if (_heroLuminanceCache.has(capIndex)) {
    return _heroLuminanceCache.get(capIndex);
  }
  if (!videoEl || (typeof HTMLVideoElement !== 'undefined' && !(videoEl instanceof HTMLVideoElement)) || videoEl.readyState < 2) {
    return 0.45;
  }
  try {
    if (!_luminanceCanvas) {
      _luminanceCanvas = document.createElement('canvas');
      _luminanceCanvas.width = 32;
      _luminanceCanvas.height = 32;
      _luminanceCtx = _luminanceCanvas.getContext('2d', { willReadFrequently: true });
    }
    const vw = videoEl.videoWidth || W || 1080;
    const vh = videoEl.videoHeight || H || 1920;
    const sx = Math.max(0, Math.min(vw - 1, ((heroBox.x || 0) / (W || 1080)) * vw));
    const sy = Math.max(0, Math.min(vh - 1, ((heroBox.y || 0) / (H || 1920)) * vh));
    const sw = Math.max(1, Math.min(vw - sx, ((heroBox.w || 200) / (W || 1080)) * vw));
    const sh = Math.max(1, Math.min(vh - sy, ((heroBox.h || 100) / (H || 1920)) * vh));

    _luminanceCtx.drawImage(videoEl, sx, sy, sw, sh, 0, 0, 32, 32);
    const imgData = _luminanceCtx.getImageData(0, 0, 32, 32).data;
    let totalLum = 0;
    for (let i = 0; i < imgData.length; i += 4) {
      totalLum += (0.2126 * imgData[i] + 0.7152 * imgData[i + 1] + 0.0722 * imgData[i + 2]) / 255.0;
    }
    const avgLum = totalLum / 1024.0;
    _heroLuminanceCache.set(capIndex, avgLum);
    return avgLum;
  } catch (_) {
    return 0.45;
  }
}

function getOrCreateHeroSprite(text, fontSize, isItalic, colors, heroLook, lum, isPreviewSmooth, videoEl, heroBox, W, H) {
  const chosenFont = S.style?.fontFamily || S.font || 'Poppins';
  const cacheKey = `${text}_${chosenFont}_${fontSize}_${isItalic}_${colors.top}_${colors.bottom}_${heroLook}_${lum > 0.6 ? 'bright' : (lum < 0.3 ? 'dark' : 'norm')}`;
  if (_heroSpriteCache.has(cacheKey)) {
    return _heroSpriteCache.get(cacheKey);
  }

  const pad = Math.ceil(fontSize * 0.22);
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = 10;
  tempCanvas.height = 10;
  const tempCtx = tempCanvas.getContext('2d');
  const fontStyle = isItalic ? 'italic' : 'normal';
  const fontStr = `${fontStyle} 800 ${fontSize}px "${chosenFont}", "Poppins", sans-serif`;
  tempCtx.font = fontStr;
  if ('letterSpacing' in tempCtx) tempCtx.letterSpacing = '-0.02em';

  const m = tempCtx.measureText(text);
  const textW = Math.ceil(m.width + fontSize * 0.06);
  const textH = Math.ceil(fontSize * 1.15);

  const canvasW = textW + pad * 2;
  const canvasH = textH + pad * 2;

  // 1. FILL CANVAS
  const fillCanvas = document.createElement('canvas');
  fillCanvas.width = canvasW;
  fillCanvas.height = canvasH;
  const fillCtx = fillCanvas.getContext('2d');

  fillCtx.font = fontStr;
  if ('letterSpacing' in fillCtx) fillCtx.letterSpacing = '-0.02em';
  fillCtx.textAlign = 'left';
  fillCtx.textBaseline = 'alphabetic';

  const baseLine = pad + fontSize * 0.88;

  let topAlpha = 1.0;
  let bottomAlpha = (lum > 0.6) ? 0.85 : 0.65;
  let topColor = colors.top;
  const bottomColor = colors.bottom;

  if (lum < 0.30) {
    topColor = brightenHex(colors.top, 15);
  }

  if (heroLook === 'texture' && videoEl && videoEl.readyState >= 2) {
    fillCtx.save();
    fillCtx.fillStyle = '#FFFFFF';
    fillCtx.fillText(text, pad, baseLine);
    fillCtx.globalCompositeOperation = 'source-in';

    const vw = videoEl.videoWidth || W || 1080;
    const vh = videoEl.videoHeight || H || 1920;
    const sx = Math.max(0, Math.min(vw - 1, ((heroBox.x || 0) / (W || 1080)) * vw));
    const sy = Math.max(0, Math.min(vh - 1, ((heroBox.y || 0) / (H || 1920)) * vh));
    const sw = Math.max(1, Math.min(vw - sx, ((heroBox.w || 200) / (W || 1080)) * vw));
    const sh = Math.max(1, Math.min(vh - sy, ((heroBox.h || 100) / (H || 1920)) * vh));

    fillCtx.drawImage(videoEl, sx, sy, sw, sh, pad - textW * 0.075, pad - textH * 0.075, textW * 1.15, textH * 1.15);

    fillCtx.globalCompositeOperation = 'source-atop';
    fillCtx.globalAlpha = 0.50;
    const tintGrad = fillCtx.createLinearGradient(pad, pad, pad, pad + textH);
    tintGrad.addColorStop(0, hexToRgba(topColor, 1.0));
    tintGrad.addColorStop(1, hexToRgba(bottomColor, 1.0));
    fillCtx.fillStyle = tintGrad;
    fillCtx.fillRect(0, 0, canvasW, canvasH);
    fillCtx.restore();

    fillCtx.save();
    fillCtx.lineWidth = Math.max(2, Math.round(fontSize * 0.035));
    fillCtx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    fillCtx.strokeText(text, pad, baseLine);
    fillCtx.restore();
  } else if (heroLook === 'seeThroughRainbow' || heroLook === 'rainbowHollow') {
    // Exact 1:1 match to reference video: Translucent glass fill + Thick chromatic rainbow stroke
    const seeThroughGrad = fillCtx.createLinearGradient(pad, pad, pad, pad + textH);
    seeThroughGrad.addColorStop(0, 'rgba(10, 20, 40, 0.28)');
    seeThroughGrad.addColorStop(1, 'rgba(30, 10, 60, 0.45)');

    fillCtx.save();
    fillCtx.fillStyle = seeThroughGrad;
    fillCtx.fillText(text, pad, baseLine);
    fillCtx.restore();

    fillCtx.save();
    fillCtx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    fillCtx.shadowBlur = Math.round(fontSize * 0.10);
    fillCtx.shadowOffsetX = 0;
    fillCtx.shadowOffsetY = Math.round(fontSize * 0.04);
    fillCtx.lineWidth = Math.max(4, Math.round(fontSize * 0.055));
    fillCtx.strokeStyle = 'rgba(0, 0, 0, 0.90)';
    fillCtx.strokeText(text, pad, baseLine);
    fillCtx.restore();

    fillCtx.save();
    fillCtx.lineJoin = 'round';
    fillCtx.lineWidth = Math.max(4, Math.round(fontSize * 0.045));
    const rainbowGrad = fillCtx.createLinearGradient(pad, pad, pad + textW, pad + textH);
    rainbowGrad.addColorStop(0, '#00E676');
    rainbowGrad.addColorStop(0.28, '#00B0FF');
    rainbowGrad.addColorStop(0.62, '#2979FF');
    rainbowGrad.addColorStop(1, '#D500F9');
    fillCtx.strokeStyle = rainbowGrad;
    fillCtx.strokeText(text, pad, baseLine);
    fillCtx.restore();

    fillCtx.save();
    fillCtx.lineWidth = Math.max(1, Math.round(fontSize * 0.016));
    fillCtx.strokeStyle = 'rgba(255, 255, 255, 0.70)';
    fillCtx.strokeText(text, pad, baseLine);
    fillCtx.restore();
  } else if (heroLook === 'magentaSatin') {
    // Exact 1:1 match to reference video: Vibrant Magenta-Purple Satin with 3D drop shadow
    fillCtx.save();
    fillCtx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    fillCtx.shadowBlur = Math.round(fontSize * 0.12);
    fillCtx.shadowOffsetX = Math.round(fontSize * 0.04);
    fillCtx.shadowOffsetY = Math.round(fontSize * 0.06);
    const satinGrad = fillCtx.createLinearGradient(pad, pad, pad, pad + textH);
    satinGrad.addColorStop(0, '#FF26BE');
    satinGrad.addColorStop(0.50, '#D500F9');
    satinGrad.addColorStop(1, '#580077');
    fillCtx.fillStyle = satinGrad;
    fillCtx.fillText(text, pad, baseLine);

    fillCtx.lineWidth = Math.max(2, Math.round(fontSize * 0.025));
    fillCtx.strokeStyle = 'rgba(255, 255, 255, 0.40)';
    fillCtx.strokeText(text, pad, baseLine);
    fillCtx.restore();
  } else if (heroLook === 'seeThrough') {
    // GENUINE SEE-THROUGH GLASS LOOK:
    // Translucent interior so the person/video shows through, with a glowing colored outline!
    const seeThroughGrad = fillCtx.createLinearGradient(pad, pad, pad, pad + textH);
    seeThroughGrad.addColorStop(0, hexToRgba(topColor, 0.18));
    seeThroughGrad.addColorStop(1, hexToRgba(bottomColor, 0.32));

    // 1. Semi-transparent glass fill
    fillCtx.save();
    fillCtx.fillStyle = seeThroughGrad;
    fillCtx.fillText(text, pad, baseLine);
    fillCtx.restore();

    // 2. High-contrast dark shadow on outline so it pops cleanly on light/dark backgrounds
    fillCtx.save();
    fillCtx.shadowColor = 'rgba(0, 0, 0, 0.90)';
    fillCtx.shadowBlur = Math.round(fontSize * 0.08);
    fillCtx.shadowOffsetX = 0;
    fillCtx.shadowOffsetY = Math.round(fontSize * 0.03);
    fillCtx.lineWidth = Math.max(3, Math.round(fontSize * 0.045));
    fillCtx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
    fillCtx.strokeText(text, pad, baseLine);
    fillCtx.restore();

    // 3. Vibrant luminous outline in accent color
    fillCtx.save();
    fillCtx.lineWidth = Math.max(2, Math.round(fontSize * 0.035));
    fillCtx.strokeStyle = topColor;
    fillCtx.strokeText(text, pad, baseLine);
    fillCtx.restore();

    // 4. Subtle inner glass sheen
    fillCtx.save();
    fillCtx.lineWidth = Math.max(1, Math.round(fontSize * 0.015));
    fillCtx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    fillCtx.strokeText(text, pad, baseLine);
    fillCtx.restore();
  } else {
    if (heroLook === 'solid') {
      topAlpha = 1.0;
      bottomAlpha = 1.0;
    }

    const grad = fillCtx.createLinearGradient(pad, pad, pad, pad + textH);
    grad.addColorStop(0, hexToRgba(topColor, topAlpha));
    grad.addColorStop(1, hexToRgba(bottomColor, bottomAlpha));

    fillCtx.save();
    fillCtx.shadowColor = 'rgba(0, 0, 0, 0.75)';
    fillCtx.shadowBlur = Math.round(fontSize * 0.08);
    fillCtx.shadowOffsetY = Math.round(fontSize * 0.03);
    fillCtx.fillStyle = grad;
    fillCtx.fillText(text, pad, baseLine);
    fillCtx.restore();

    // Dark edge definition for high contrast readability
    fillCtx.lineWidth = Math.max(1, Math.round(fontSize * 0.02));
    fillCtx.strokeStyle = 'rgba(0, 0, 0, 0.40)';
    fillCtx.strokeText(text, pad, baseLine);
  }

  // 2. GLOW CANVAS (pre-blurred sprite, no per-frame ctx.filter)
  let glowCanvas = null;
  if (!isPreviewSmooth && heroLook !== 'solid') {
    glowCanvas = document.createElement('canvas');
    glowCanvas.width = canvasW;
    glowCanvas.height = canvasH;
    const glowCtx = glowCanvas.getContext('2d');
    glowCtx.font = fontStr;
    if ('letterSpacing' in glowCtx) glowCtx.letterSpacing = '-0.02em';
    glowCtx.textAlign = 'left';
    glowCtx.textBaseline = 'alphabetic';

    let glowAlpha = 0.25;
    let glowBlur = fontSize * 0.03;
    if (lum < 0.30) {
      glowAlpha = 0.40;
      glowBlur = fontSize * 0.045;
    }

    glowCtx.shadowColor = hexToRgba(colors.top, glowAlpha);
    glowCtx.shadowBlur = Math.max(3, Math.round(glowBlur));
    glowCtx.fillStyle = hexToRgba(colors.top, glowAlpha);
    glowCtx.fillText(text, pad, baseLine);
  }

  const sprite = {
    fillCanvas,
    glowCanvas,
    canvasW,
    canvasH,
    textW,
    textH,
    pad,
    baseLine
  };

  _heroSpriteCache.set(cacheKey, sprite);
  return sprite;
}

function drawSolidHeroWord(drawCtx, cleanWord, cx, drawY, fontSize, isItalic, colors, animScale, exitAlpha, W) {
  if (!drawCtx || !cleanWord) return;
  drawCtx.save();
  drawCtx.globalAlpha = (exitAlpha || 1.0);

  const fontStyle = isItalic ? 'italic ' : '';
  drawCtx.font = `${fontStyle}800 ${fontSize}px "Poppins", "Arial Black", Impact, sans-serif`;
  if ('letterSpacing' in drawCtx) drawCtx.letterSpacing = '-0.02em';
  drawCtx.textAlign = 'center';
  drawCtx.textBaseline = 'alphabetic';

  const cy = drawY + fontSize * 0.45;
  drawCtx.translate(cx, cy);
  drawCtx.scale(animScale, animScale);
  drawCtx.translate(-cx, -cy);

  const baseLine = drawY + fontSize * 0.88;

  // Strong dark shadow for 100% visibility on any background
  drawCtx.shadowColor = 'rgba(0, 0, 0, 0.85)';
  drawCtx.shadowBlur = Math.round(fontSize * 0.08);
  drawCtx.shadowOffsetX = 0;
  drawCtx.shadowOffsetY = Math.round(fontSize * 0.03);

  // Dark outline stroke
  drawCtx.lineWidth = Math.max(2, Math.round(fontSize * 0.035));
  drawCtx.strokeStyle = 'rgba(0, 0, 0, 0.90)';
  drawCtx.strokeText(cleanWord, cx, baseLine);

  // Solid color / gradient fill
  const topCol = colors?.top || '#FFE600';
  const botCol = colors?.bottom || topCol;
  if (topCol !== botCol) {
    const grad = drawCtx.createLinearGradient(cx, drawY, cx, drawY + fontSize);
    grad.addColorStop(0, topCol);
    grad.addColorStop(1, botCol);
    drawCtx.fillStyle = grad;
  } else {
    drawCtx.fillStyle = topCol;
  }
  drawCtx.fillText(cleanWord, cx, baseLine);

  drawCtx.restore();
}

function drawSafePlainCaptions(ctx, cap, words, W, H) {
  if (!ctx || !words || !words.length) return;
  ctx.save();
  const text = words.map(w => w.t || w.word || '').join(' ');
  const fs = Math.max(16, Math.round(W * 0.055));
  ctx.font = `800 ${fs}px "Poppins", "Arial Black", Impact, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const cx = W / 2;
  const cy = H * 0.75;
  ctx.shadowColor = 'rgba(0,0,0,0.85)';
  ctx.shadowBlur = 6;
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#000000';
  ctx.strokeText(text, cx, cy);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(text, cx, cy);
  ctx.restore();
}

function renderUnifiedHeroWord(drawCtx, heroWord, capIndex, heroBox, st, W, H, t, heroStart, capDur, exitAlpha, isPreview, videoEl, showAll = false) {
  if (!drawCtx || !heroWord) return;

  const validCapIdx = typeof capIndex === 'number' && !isNaN(capIndex) ? Math.max(0, capIndex) : 0;
  const allowItalic = st.allowItalicCycle !== false && !st.noItalic && st.roles?.accent?.italic !== false && st.key?.italic !== false;
  const isItalic = (st.italic === true) || (allowItalic && (validCapIdx % 2 === 1));
  const fontStyle = isItalic ? 'italic ' : '';
  const rawClean = heroWord.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'’]/g, '').trim();
  if (!rawClean) return;
  const currentCase = S.style?.textCase || S.textCase || st.textCase || (st.roles?.accent?.lower ? 'lower' : (st.uppercase === false ? 'lower' : 'upper'));
  const cleanWord = applyTextCase(rawClean, currentCase);

  const isReClr = Boolean(
    st.id === 'special_03' ||
    st.id === 'duo_03' ||
    st.id === 'editorial_depth_stack' ||
    (st.name && st.name.toLowerCase().includes('real estate clr')) ||
    (st.name && st.name.toLowerCase().includes('editorial')) ||
    st.heroPalette
  );

  let colors;
  let colorIndex = 0;
  if (isReClr) {
    const lock = S.realEstateColorLock || (S.style && S.style.lockedColor) || 'auto';
    const clrData = getRealEstateClrGradient(capIndex, lock, st.heroPalette);
    colors = clrData.palette;
    colorIndex = clrData.colorIndex;
  } else {
    const kRole = st.roles?.accent || st.key || {};
    let gradA = '#FFE600';
    let gradB = '#FF8A00';
    if (kRole.fill && kRole.fill.colors && kRole.fill.colors.length >= 2) {
      gradA = kRole.fill.colors[0];
      gradB = kRole.fill.colors[1];
    } else if (kRole.keyGradient && kRole.keyGradient.includes('linear-gradient')) {
      const match = kRole.keyGradient.match(/#[0-9a-fA-F]{3,6}|rgb\([^)]+\)/g);
      if (match && match.length >= 2) {
        gradA = match[0];
        gradB = match[1];
      } else if (match && match.length === 1) {
        gradA = match[0];
        gradB = match[0];
      }
    } else {
      const baseCol = st.highlightColor || kRole.color || '#FFE600';
      gradA = baseCol;
      gradB = baseCol;
    }
    colors = { id: 'custom', top: gradA, bottom: gradB };
    colorIndex = Math.max(0, Number(capIndex) || 0) % 7;
  }

  const heroLook = S.heroLook || st.heroLook || 'solid';

  if (_lastLoggedUnifiedHeroCapIdx !== capIndex) {
    _lastLoggedUnifiedHeroCapIdx = capIndex;
    console.log('[HERO]', capIndex, cleanWord, heroLook, colorIndex);
  }

  let animScale = 1.0;
  let clipReveal = 1.0;
  const useLineByLine = S.lineByLine !== false;
  const isPaused = (videoEl && videoEl.paused) || vid.paused;
  if (useLineByLine && !showAll && !isPaused && (capDur == null || capDur < 100)) {
    const elapsed = Math.max(0, t - heroStart);
    const scaleP = Math.min(1.0, elapsed / 0.28);
    const c1 = 1.70158;
    const c3 = c1 + 1;
    const eased = 1 + c3 * Math.pow(scaleP - 1, 3) + c1 * Math.pow(scaleP - 1, 2);
    animScale = 0.92 + 0.08 * Math.max(0, Math.min(1.15, eased));
    clipReveal = Math.max(0.15, Math.min(1.0, elapsed / 0.22));
  } else {
    animScale = 1.0;
    clipReveal = 1.0;
  }

  const lum = getSampledLuminanceBehindHero(videoEl, heroBox, capIndex, W, H);
  const effQuality = isPreview ? getEffectivePreviewQuality() : 'full';
  const isPreviewSmooth = (effQuality === 'smooth');

  const heroFontScale = (typeof S.style?.fontScale === 'number' && S.style.fontScale > 0)
    ? S.style.fontScale
    : ((typeof st.fontScale === 'number' && st.fontScale > 0) ? st.fontScale : 1.0);
  const maxAllowedW = Math.min(0.96 * W, 0.86 * W * Math.max(1.0, heroFontScale));
  let fontSize = heroBox.fontSize || Math.round(W * 0.17 * heroFontScale);
  drawCtx.save();
  drawCtx.font = `${fontStyle}800 ${fontSize}px "Poppins", sans-serif`;
  if ('letterSpacing' in drawCtx) drawCtx.letterSpacing = '-0.02em';
  let m = drawCtx.measureText(cleanWord);
  if (m.width > maxAllowedW) {
    fontSize = Math.max(16, Math.floor(fontSize * (maxAllowedW / m.width)));
  }
  drawCtx.restore();

  const cx = (heroBox && heroBox.centerX != null)
    ? heroBox.centerX
    : ((heroBox && heroBox.w && heroBox.w > 0) ? (heroBox.x + heroBox.w / 2) : (heroBox ? heroBox.x : W / 2));
  const drawY = Math.round(heroBox ? heroBox.y : H * 0.4);

  if (heroLook === 'punchBeam') {
    // Exact 1:1 match to reference video: Electric Magenta Horizontal Anamorphic Lens Flare Beam
    drawCtx.save();
    const beamW = Math.max(W * 0.72, cleanWord.length * fontSize * 0.65);
    const beamH = fontSize * 0.75;
    const beamY = drawY + fontSize * 0.45;
    const beamGrad = drawCtx.createRadialGradient(cx, beamY, 8, cx, beamY, beamW);
    beamGrad.addColorStop(0, 'rgba(255, 0, 210, 0.95)');
    beamGrad.addColorStop(0.30, 'rgba(235, 0, 255, 0.70)');
    beamGrad.addColorStop(0.65, 'rgba(160, 0, 255, 0.25)');
    beamGrad.addColorStop(1, 'rgba(160, 0, 255, 0)');
    drawCtx.fillStyle = beamGrad;
    drawCtx.beginPath();
    drawCtx.ellipse(cx, beamY, beamW, beamH, 0, 0, Math.PI * 2);
    drawCtx.fill();
    drawCtx.restore();

    drawCtx.save();
    drawCtx.globalAlpha = (exitAlpha || 1.0);
    drawCtx.font = `900 ${fontSize}px "Poppins", "Montserrat", sans-serif`;
    drawCtx.textAlign = 'center';
    drawCtx.textBaseline = 'alphabetic';
    drawCtx.shadowColor = 'rgba(235, 0, 255, 0.95)';
    drawCtx.shadowBlur = Math.round(fontSize * 0.20);
    drawCtx.fillStyle = '#FFFFFF';
    drawCtx.fillText(cleanWord, cx, drawY + fontSize * 0.88);
    drawCtx.restore();
    return;
  }

  // Default / Solid look path (SAFETY NET: immediately draws crisp visible text)
  if (heroLook === 'solid') {
    drawSolidHeroWord(drawCtx, cleanWord, cx, drawY, fontSize, isItalic, colors, animScale, exitAlpha, W);
    drawCtx.globalAlpha = 1.0;
    drawCtx.globalCompositeOperation = 'source-over';
    return;
  }

  // Safety net: try creating sprite, fallback to solid if empty, 0-size, or throws
  let sprite = null;
  try {
    sprite = getOrCreateHeroSprite(cleanWord, fontSize, isItalic, colors, heroLook, lum, isPreviewSmooth, videoEl, heroBox, W, H);
    if (!sprite || !sprite.fillCanvas || sprite.fillCanvas.width === 0 || sprite.fillCanvas.height === 0) {
      sprite = null;
    }
  } catch (err) {
    console.warn('[HERO SPRITE FALLBACK]', err);
    sprite = null;
  }

  if (!sprite) {
    drawSolidHeroWord(drawCtx, cleanWord, cx, drawY, fontSize, isItalic, colors, animScale, exitAlpha, W);
    drawCtx.globalAlpha = 1.0;
    drawCtx.globalCompositeOperation = 'source-over';
    return;
  }

  const drawX = Math.round(cx - sprite.textW / 2);

  drawCtx.save();
  drawCtx.globalAlpha = (exitAlpha || 1.0);

  if (useLineByLine && clipReveal < 1.0) {
    const revealH = sprite.textH * clipReveal;
    drawCtx.beginPath();
    drawCtx.rect(
      drawX - sprite.pad,
      drawY - sprite.pad + (sprite.textH - revealH),
      sprite.canvasW,
      revealH + sprite.pad * 2
    );
    drawCtx.clip();
  }

  const cy = drawY + sprite.textH / 2;
  drawCtx.translate(cx, cy);
  drawCtx.scale(animScale, animScale);
  drawCtx.translate(-cx, -cy);

  if (heroLook === 'seeThrough') {
    // Directly draw the translucent see-through glass sprite
    drawCtx.drawImage(sprite.fillCanvas, drawX - sprite.pad, drawY - sprite.pad);
  } else if (isPreviewSmooth) {
    drawCtx.drawImage(sprite.fillCanvas, drawX - sprite.pad, drawY - sprite.pad);
  } else {
    if (sprite.glowCanvas) {
      drawCtx.drawImage(sprite.glowCanvas, drawX - sprite.pad, drawY - sprite.pad);
    }
    drawCtx.drawImage(sprite.fillCanvas, drawX - sprite.pad, drawY - sprite.pad);

    drawCtx.save();
    let blended = false;
    try {
      drawCtx.globalCompositeOperation = 'overlay';
      drawCtx.globalAlpha = (exitAlpha || 1.0) * 0.35;
      drawCtx.drawImage(sprite.fillCanvas, drawX - sprite.pad, drawY - sprite.pad);
      blended = true;
    } catch (_) {}
    if (!blended) {
      try {
        drawCtx.globalCompositeOperation = 'soft-light';
        drawCtx.globalAlpha = (exitAlpha || 1.0) * 0.35;
        drawCtx.drawImage(sprite.fillCanvas, drawX - sprite.pad, drawY - sprite.pad);
        blended = true;
      } catch (_) {}
    }
    if (!blended) {
      drawCtx.globalCompositeOperation = 'source-over';
      drawCtx.globalAlpha = (exitAlpha || 1.0) * 0.20;
      drawCtx.drawImage(sprite.fillCanvas, drawX - sprite.pad, drawY - sprite.pad);
    }
    drawCtx.restore();
  }

  drawCtx.restore();
  drawCtx.globalAlpha = 1.0;
  drawCtx.globalCompositeOperation = 'source-over';
}

function renderUnifiedSmallLine(ctxFore, lineText, centerX, baselineY, fontSize, exitAlpha, t, lineStart, isTopLine, showAll = false, caseMode = 'asIs') {
  if (!ctxFore || !lineText) return;
  let cleanLine = lineText;
  if (caseMode === 'lower') {
    cleanLine = lineText.toLowerCase();
  } else if (caseMode === 'upper') {
    cleanLine = lineText.toUpperCase();
  } else if (caseMode === 'title') {
    cleanLine = lineText.replace(/\b([a-zA-Z])/g, c => c.toUpperCase());
  } else if (caseMode === 'asIs' || caseMode === 'normal' || !caseMode) {
    cleanLine = lineText;
  }

  let alpha = (exitAlpha || 1.0);
  let dy = 0;

  const useLineByLine = S.lineByLine !== false;
  if (useLineByLine && !showAll) {
    const elapsed = Math.max(0, t - lineStart);
    const dur = 0.18;
    const p = Math.min(1.0, elapsed / dur);
    alpha *= p;
    if (isTopLine) {
      dy = (1.0 - p) * -10;
    } else {
      dy = (1.0 - p) * 10;
    }
  }

  if (alpha <= 0.001) return;

  ctxFore.save();
  ctxFore.font = `600 ${fontSize}px "Poppins", sans-serif`;
  ctxFore.textAlign = 'center';
  ctxFore.textBaseline = 'alphabetic';
  ctxFore.globalAlpha = alpha;

  const curY = baselineY + dy;

  ctxFore.shadowColor = 'rgba(0, 0, 0, 0.85)';
  ctxFore.shadowBlur = 6;
  ctxFore.shadowOffsetX = 0;
  ctxFore.shadowOffsetY = 2;

  // Strong dark stroke for crystal clear front-line readability on all backgrounds
  ctxFore.lineWidth = 3;
  ctxFore.strokeStyle = 'rgba(0, 0, 0, 0.75)';
  ctxFore.strokeText(cleanLine, centerX, curY);

  ctxFore.fillStyle = '#FFFFFF';
  ctxFore.fillText(cleanLine, centerX, curY);

  ctxFore.restore();
}

let _fontsLoadStatus = { poppins: 'loading', poppinsItalic: 'loading', poppinsSemi: 'loading', anton: 'loading' };

async function ensureHeroFontsLoaded() {
  if (typeof document !== 'undefined' && document.fonts && document.fonts.load) {
    try {
      await document.fonts.load('800 100px "Poppins"');
      _fontsLoadStatus.poppins = 'ready';
    } catch (e) {
      console.warn('[FONT] Poppins 800 failed to load, falling back to system sans-serif', e);
      _fontsLoadStatus.poppins = 'fallback';
    }
    try {
      await document.fonts.load('italic 800 100px "Poppins"');
      _fontsLoadStatus.poppinsItalic = 'ready';
    } catch (e) {
      console.warn('[FONT] Poppins italic 800 failed to load, falling back to system sans-serif', e);
      _fontsLoadStatus.poppinsItalic = 'fallback';
    }
    try {
      await document.fonts.load('600 48px "Poppins"');
      _fontsLoadStatus.poppinsSemi = 'ready';
    } catch (e) {
      console.warn('[FONT] Poppins 600 failed to load, falling back to system sans-serif', e);
      _fontsLoadStatus.poppinsSemi = 'fallback';
    }
    try {
      await document.fonts.load('48px "Anton"');
      _fontsLoadStatus.anton = 'ready';
    } catch (e) {
      console.warn('[FONT] Anton failed to load, falling back to system sans-serif', e);
      _fontsLoadStatus.anton = 'fallback';
    }
    if (typeof _heroSpriteCache !== 'undefined' && _heroSpriteCache) _heroSpriteCache.clear();
    try { renderCanvas(true); } catch (_) {}
  }
}


// ============================================================================
// 1:1 ADAPTIVE ESTATE MULTI-FLEX RENDER ENGINE (Exact Match to Reference Video)
// ============================================================================

function drawAdaptiveEstateFlexPass(ctxFore, ctxBehind, cap, words, t, st, W, H, isBehind, showAll, isPreview) {
  if (!words || !words.length) return;

  const isSampleCard = Boolean(cap && cap.id === 'preview_sample');
  const capStart = (cap && typeof cap.start === 'number') ? cap.start : (words[0] && typeof words[0].s === 'number' ? words[0].s : 0);
  const capEnd = (cap && typeof cap.end === 'number') ? cap.end : (words[words.length - 1] && typeof words[words.length - 1].e === 'number' ? words[words.length - 1].e : capStart + 2.5);
  const hasValidT = (typeof t === 'number' && !isNaN(t));
  const evalT = isSampleCard ? (capStart + 999) : (hasValidT ? t : (capStart + 1.0));
  const fullInstant = isSampleCard || !hasValidT || Boolean(showAll && evalT <= capStart + 0.04);

  const timeRem = fullInstant ? 1.0 : Math.max(0, capEnd - evalT);
  const exitFade = fullInstant ? 1.0 : Math.min(1, timeRem / 0.14);
  if (exitFade <= 0.005) return;

  const targetBehind = (isBehind && ctxBehind) ? ctxBehind : ctxFore;
  const ov = resolveSceneStyleOverrides(st, H);
  const flexScale = Math.max(0.5, Math.min(2.0, Number(st?.fontScale) || 1.0));
  const flexFam = ov.pickFontFam('"Poppins", "Montserrat", sans-serif');
  const flexPosY = (y) => Math.round(y + ov.posDeltaY);
  const capsList = (typeof S !== 'undefined' && S && Array.isArray(S.captions)) ? S.captions : [];
  const foundIdx = (cap && capsList.length > 0) ? capsList.indexOf(cap) : -1;
  const rawIdx = (cap && cap.index != null) ? Number(cap.index) - 1 : parseInt(cap && cap.id, 10) - 1;
  const capIdx = foundIdx >= 0 ? foundIdx : (!isNaN(rawIdx) && rawIdx >= 0 ? rawIdx : 0);

  const userCase = st && st.textCase;
  const applyFlexCase = (s) => {
    if (!s) return '';
    if (userCase === 'upper') return s.toUpperCase();
    if (userCase === 'lower') return s.toLowerCase();
    return s;
  };
  const cleanToken = (raw, keepComma) => {
    const s = String(raw || '').replace(/["'’()[\]{}]/g, '').trim();
    return applyFlexCase(keepComma ? s.replace(/[.!?;:]+$/g, '') : s.replace(/[.,!?;:]+$/g, ''));
  };
  const wordStartTime = (w, fallback) => {
    if (w && typeof w.s === 'number') return w.s;
    if (w && typeof w.start === 'number') return w.start;
    return fallback;
  };
  const easeOutCubic = (x) => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);

  const measureFlexWidth = (ctx, text, fontSize, trackEm) => {
    if (!text) return 0;
    const m = ctx.measureText(text);
    const w = (m && typeof m.width === 'number') ? m.width : text.length * fontSize * 0.56;
    if ('letterSpacing' in ctx) return w;
    return Math.max(0, w + Math.max(0, text.length - 1) * fontSize * (trackEm || 0));
  };
  const fitFlexFont = (ctx, text, weight, italic, idealPx, minPx, maxW, trackEm) => {
    const effTrack = ov.trackEmWith(trackEm || 0);
    let size = Math.round(idealPx * flexScale);
    if (!text) return size;
    ctx.save();
    ctx.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${flexFam}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${effTrack}em`;
    const rawW = measureFlexWidth(ctx, text, size, effTrack);
    ctx.restore();
    if (rawW > maxW && rawW > 0) {
      size = Math.max(Math.round(minPx), Math.floor(size * (maxW / rawW)));
    }
    return size;
  };
  const isNumericToken = (raw) => {
    const clean = String(raw || '').replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'’]/g, '');
    return /^\$?\d[\d,.]*(?:k|m|b|cr|x|%)?$/i.test(clean);
  };
  const pickLongestWordIdx = (arr, startI, endI) => {
    let bestI = startI;
    let bestLen = -1;
    const stopSet = new Set(['a', 'an', 'the', 'to', 'at', 'in', 'on', 'of', 'for', 'with', 'and', 'or', 'your', 'you', 'those']);
    for (let i = startI; i <= endI; i++) {
      if (!arr[i]) continue;
      const txt = cleanToken(arr[i].t || arr[i].word || '', false);
      const low = txt.toLowerCase();
      const score = txt.length + (arr[i].key ? 6 : 0) - (stopSet.has(low) ? 8 : 0);
      if (score > bestLen) {
        bestLen = score;
        bestI = i;
      }
    }
    return bestI;
  };

  // Progressive clean white word-by-word reveal (with optional dark halo border over bright text)
  const drawProgressiveWords = (ctx, wordObjs, x, baselineY, fontSize, weight, italic, align, trackEm, withDarkEdge, outFadeP) => {
    if (!wordObjs || !wordObjs.length) return { left: x, right: x, width: 0 };
    const tokens = wordObjs.map((w, idx) => ({
      txt: cleanToken(w.t || w.word || '', true),
      s: wordStartTime(w, capStart + idx * 0.14)
    })).filter(it => it.txt);
    if (!tokens.length) return { left: x, right: x, width: 0 };

    const effTrack = ov.trackEmWith(trackEm || 0);
    const fullStr = tokens.map(it => it.txt).join(' ');
    const fitSize = fitFlexFont(ctx, fullStr, weight, italic, fontSize, Math.round(H * 0.018), W * 0.88, trackEm);
    ctx.save();
    ctx.font = `${italic ? 'italic ' : ''}${weight} ${fitSize}px ${flexFam}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${effTrack}em`;
    const spaceW = measureFlexWidth(ctx, ' ', fitSize, effTrack);
    const segs = tokens.map((it, i) => ({
      txt: it.txt,
      s: it.s,
      w: measureFlexWidth(ctx, it.txt, fitSize, effTrack) + (i < tokens.length - 1 ? spaceW * 0.85 : 0)
    }));
    const totalW = segs.reduce((acc, s) => acc + s.w, 0);
    ctx.restore();

    let startX = x;
    if (align === 'center') startX = x - totalW * 0.5;
    else if (align === 'right') startX = x - totalW;

    const adjY = flexPosY(baselineY);
    ov.recordSceneBox(cap, W, H, startX, adjY - fitSize, totalW, fitSize * 1.25);

    const outAlpha = (typeof outFadeP === 'number') ? Math.max(0, 1 - outFadeP) : 1.0;
    let curX = startX;
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i];
      const p = fullInstant ? 1.0 : Math.min(1, Math.max(0, (evalT - seg.s) / 0.14));
      if (p > 0.01 && outAlpha > 0.01) {
        const ep = easeOutCubic(p);
        const yOff = fullInstant ? 0 : Math.round((1 - ep) * H * 0.010);
        ctx.save();
        try {
          ctx.globalAlpha = exitFade * outAlpha * Math.min(1, p * 1.4);
          ctx.font = `${italic ? 'italic ' : ''}${weight} ${fitSize}px ${flexFam}`;
          if ('letterSpacing' in ctx) ctx.letterSpacing = `${effTrack}em`;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'alphabetic';
          if (withDarkEdge) {
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            ctx.strokeStyle = 'rgba(10, 8, 18, 0.42)';
            ctx.lineWidth = Math.max(1.2, Math.round(fitSize * 0.052));
            ctx.strokeText(seg.txt, Math.round(curX), Math.round(adjY + yOff));
          }
          ov.applyGlow(ctx, 'rgba(0, 0, 0, 0.62)', Math.max(3, Math.round(H * 0.006)));
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = Math.round(H * 0.002);
          ctx.fillStyle = ov.pickBase('#FFFFFF');
          ctx.fillText(seg.txt, Math.round(curX), Math.round(adjY + yOff));
        } finally {
          ctx.restore();
        }
      }
      curX += seg.w;
    }
    return { left: startX, right: startX + totalW, width: totalW, size: fitSize };
  };

  // Single crisp front hero word with soft fade/scale entrance
  const drawFrontWord = (ctx, text, x, baselineY, fontSize, weight, italic, align, startTime, trackEm, withGlow) => {
    if (!text) return;
    if (!fullInstant && evalT < startTime - 0.02) return;
    const p = fullInstant ? 1.0 : Math.min(1, Math.max(0, (evalT - startTime) / 0.16));
    const ep = easeOutCubic(p);
    const alpha = exitFade * ep;
    if (alpha <= 0.01) return;
    const sc = fullInstant ? 1.0 : (0.94 + 0.06 * ep);
    const effTrack = ov.trackEmWith(trackEm || 0);
    const effSize = Math.round(fontSize * flexScale);
    const adjY = flexPosY(baselineY);

    ctx.save();
    try {
      ctx.globalAlpha = alpha;
      ctx.font = `${italic ? 'italic ' : ''}${weight} ${effSize}px ${flexFam}`;
      if ('letterSpacing' in ctx) ctx.letterSpacing = `${effTrack}em`;
      ctx.textAlign = align;
      ctx.textBaseline = 'alphabetic';
      const fw = measureFlexWidth(ctx, text, effSize, effTrack);
      const bx0 = align === 'center' ? (x - fw * 0.5) : (align === 'right' ? x - fw : x);
      ov.recordSceneBox(cap, W, H, bx0, adjY - effSize, fw, effSize * 1.25);
      const midY = adjY - effSize * 0.30;
      ctx.translate(x, midY);
      ctx.scale(sc, sc);
      ctx.translate(-x, -midY);
      if (withGlow) {
        ov.applyGlow(ctx, 'rgba(224, 24, 255, 0.90)', Math.max(10, Math.round(H * 0.022)));
      } else {
        ov.applyGlow(ctx, 'rgba(0, 0, 0, 0.56)', Math.max(4, Math.round(H * 0.007)));
        ctx.shadowOffsetY = Math.round(H * 0.002);
      }
      ctx.fillStyle = withGlow ? ov.pickHi('#FFFFFF') : ov.pickBase('#FFFFFF');
      ctx.fillText(text, x, adjY);
    } finally {
      ctx.restore();
    }
  };

  // Dynamic head-crown ratio when segmentation detects subject
  const detectedTop = (!isSampleCard && typeof window !== 'undefined' && typeof window._editorialHeadTopRatio === 'number')
    ? window._editorialHeadTopRatio
    : null;
  if (detectedTop !== null && cap && typeof cap._latchedFlexTopRatio !== 'number') {
    cap._latchedFlexTopRatio = Math.max(0.14, Math.min(0.32, detectedTop));
  }
  const headCrown = (cap && typeof cap._latchedFlexTopRatio === 'number') ? cap._latchedFlexTopRatio : 0.215;

  // Classify caption into 1 of 4 Adaptive Estate Multi-Flex treatments matching ref 1rV3_dmUo_LDgq6oGDTDfyIJ9VL-93WuX
  const fullText = words.map(w => w.t || w.word || '').join(' ');
  const numWordIdx = words.findIndex(w => isNumericToken(w.t || w.word || ''));
  let numCountBefore = 0;
  if (foundIdx > 0) {
    for (let c = 0; c < foundIdx; c++) {
      const cw = capsList[c] && capsList[c].words;
      if (Array.isArray(cw) && cw.some(ww => isNumericToken(ww.t || ww.word || ''))) numCountBefore++;
    }
  } else {
    numCountBefore = capIdx;
  }

  let styleMode = 1;
  if (isSampleCard) {
    styleMode = 1;
  } else if (numWordIdx !== -1) {
    styleMode = (/\b(lakh|lakhs|cr|crore)\b/i.test(fullText) && numCountBefore === 0) ? 1 : ((numCountBefore % 2 === 0) ? 1 : 2);
  } else if (capIdx % 4 !== 3 && /\b(attention|profit|results|secret|viral|money|grow|hook|deal|offer|invest|return)\b/i.test(fullText)) {
    styleMode = 3;
  } else {
    styleMode = (capIdx % 4) + 1;
  }

  if (styleMode === 1) {
    // STYLE 1: Hollow Emerald-Teal-Blue-Violet Outline ('20') Behind + 'listed at' Top-Left + 'lakh' in '0' + Waist Sentence
    let numIdx = numWordIdx !== -1 ? numWordIdx : pickLongestWordIdx(words, 0, words.length - 1);
    const metricRaw = isSampleCard ? '20' : cleanToken(words[numIdx]?.t || words[numIdx]?.word || '', false);
    const metricWord = metricRaw || '20';
    const metricStart = wordStartTime(words[numIdx], capStart + 0.40);

    let preWords = words.slice(0, numIdx);
    let postWords = words.slice(numIdx + 1);
    let topLabelWords = [];
    let unitWordObj = null;
    let waistWords = [];

    if (isSampleCard) {
      topLabelWords = [{ t: 'listed', s: 0 }, { t: 'at', s: 0 }];
      unitWordObj = { t: 'lakh', s: 0 };
      waistWords = [{ t: 'Imagine', s: 0 }, { t: 'a', s: 0 }, { t: 'home', s: 0 }];
    } else {
      if (preWords.length >= 3) {
        waistWords = preWords.slice(0, preWords.length - 2);
        topLabelWords = preWords.slice(preWords.length - 2);
      } else {
        topLabelWords = preWords;
      }
      if (postWords.length > 0) {
        const p0 = cleanToken(postWords[0].t || postWords[0].word || '', false).toLowerCase();
        if (['lakh', 'lakhs', 'cr', 'crore', 'k', 'm', 'b', 'rs', 'inr', 'usd', 'sqft', 'per', 'only'].includes(p0) || (postWords.length <= 2 && /^[a-z]{1,5}$/i.test(p0))) {
          unitWordObj = postWords[0];
          waistWords = waistWords.concat(postWords.slice(1));
        } else {
          waistWords = waistWords.concat(postWords);
        }
      }
    }

    const heroCenterX = Math.round(W * 0.50);
    const heroCenterY = Math.round(H * Math.max(0.18, Math.min(0.28, headCrown + 0.014)));
    const numFontSize = fitFlexFont(targetBehind, metricWord, 700, false, H * 0.355, H * 0.16, W * 0.72, -0.025);
    const numBaseY = Math.round(heroCenterY + numFontSize * 0.36);

    ctxFore.save();
    ctxFore.font = `700 ${numFontSize}px "Poppins", "Montserrat", sans-serif`;
    if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = '-0.025em';
    const numW = measureFlexWidth(ctxFore, metricWord, numFontSize, -0.025);
    ctxFore.restore();

    // 1. Giant Hollow Rainbow-Cool Stroke on targetBehind
    const numP = fullInstant ? 1.0 : (evalT >= metricStart - 0.03 ? Math.min(1, Math.max(0, (evalT - metricStart) / 0.18)) : 0);
    if (numP > 0.01) {
      const nep = easeOutCubic(numP);
      const nScale = fullInstant ? 1.0 : (0.94 + 0.06 * nep);
      const topY = numBaseY - numFontSize * 0.74;
      const botY = numBaseY + numFontSize * 0.04;
      targetBehind.save();
      try {
        targetBehind.globalAlpha = exitFade * nep;
        targetBehind.translate(heroCenterX, heroCenterY);
        targetBehind.scale(nScale, nScale);
        targetBehind.translate(-heroCenterX, -heroCenterY);

        targetBehind.font = `700 ${numFontSize}px ${flexFam}`;
        if ('letterSpacing' in targetBehind) targetBehind.letterSpacing = `${ov.trackEmWith(-0.025)}em`;
        targetBehind.textAlign = 'center';
        targetBehind.textBaseline = 'alphabetic';
        targetBehind.lineWidth = Math.max(5, Math.round(numFontSize * 0.022));
        targetBehind.lineJoin = 'round';
        targetBehind.lineCap = 'round';

        ov.applyGlow(targetBehind, 'rgba(0, 0, 0, 0.28)', Math.max(4, Math.round(H * 0.006)));
        targetBehind.shadowOffsetY = Math.round(H * 0.002);

        if (ov.customHighlight) {
          targetBehind.strokeStyle = ov.customHighlight;
        } else {
          const coolGrad = targetBehind.createLinearGradient(heroCenterX, topY, heroCenterX, botY);
          coolGrad.addColorStop(0.00, '#5EDB43');
          coolGrad.addColorStop(0.28, '#14B387');
          coolGrad.addColorStop(0.56, '#144BD4');
          coolGrad.addColorStop(0.84, '#5616D0');
          coolGrad.addColorStop(1.00, '#7212DA');
          targetBehind.strokeStyle = coolGrad;
        }
        targetBehind.strokeText(metricWord, heroCenterX, numBaseY);
      } finally {
        targetBehind.restore();
      }
    }

    // 2. Top-Left Italic Label ('listed at') overlapping top-left corner of hero
    if (topLabelWords.length > 0) {
      const heroLeft = heroCenterX - numW * 0.5;
      const preX = Math.max(W * 0.052, Math.round(heroLeft - numW * 0.16));
      const preBaseY = Math.max(H * 0.075, Math.round(numBaseY - numFontSize * 0.67 - (ov.lineSpacingMult - 1.0) * numFontSize * 0.25));
      drawProgressiveWords(ctxFore, topLabelWords, preX, preBaseY, Math.round(H * 0.031), 800, true, 'left', -0.02, false);
    }

    // 3. Unit Word ('lakh') inside inner cavity of '0' / right side of hero
    if (unitWordObj) {
      const unitTxt = cleanToken(unitWordObj.t || unitWordObj.word || '', false);
      if (unitTxt) {
        const unitStart = wordStartTime(unitWordObj, metricStart - 0.06);
        const unitX = Math.round(heroCenterX + numW * 0.205);
        const unitBaseY = Math.round(heroCenterY + H * 0.022);
        drawFrontWord(ctxFore, unitTxt, unitX, unitBaseY, Math.round(H * 0.032), 600, false, 'center', unitStart, -0.015, false);
      }
    }

    // 4. Waist Subtitle ('Imagine a home')
    if (waistWords.length > 0) {
      drawProgressiveWords(ctxFore, waistWords, Math.round(W * 0.50), Math.round(H * 0.533 + (ov.lineSpacingMult - 1.0) * H * 0.032), Math.round(H * 0.035), 600, false, 'center', -0.015, false);
    }

  } else if (styleMode === 2) {
    // STYLE 2: Bold Italic Vivid Magenta ('25,000') Behind + Italic White 'a month' Above '00' + Waist Subtitle
    let numIdx = numWordIdx !== -1 ? numWordIdx : pickLongestWordIdx(words, 0, words.length - 1);
    const metricRaw = isSampleCard ? '25,000' : cleanToken(words[numIdx]?.t || words[numIdx]?.word || '', true);
    const metricWord = metricRaw || '25,000';
    const metricStart = wordStartTime(words[numIdx], capStart + 0.35);

    let waistWords = words.slice(0, numIdx);
    let postWords = words.slice(numIdx + 1);
    let topRightWords = [];
    if (postWords.length > 0) {
      topRightWords = postWords.slice(0, 2);
      if (postWords.length > 2) waistWords = waistWords.concat(postWords.slice(2));
    }

    const heroCenterX = Math.round(W * 0.50);
    const heroCenterY = Math.round(H * Math.max(0.155, Math.min(0.255, headCrown - 0.008)));
    const numFontSize = fitFlexFont(targetBehind, metricWord, 900, true, H * 0.132, H * 0.080, W * 0.72, -0.04);
    const numBaseY = Math.round(heroCenterY + numFontSize * 0.35);

    ctxFore.save();
    ctxFore.font = `italic 900 ${numFontSize}px ${flexFam}`;
    if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${ov.trackEmWith(-0.04)}em`;
    const numW = measureFlexWidth(ctxFore, metricWord, numFontSize, -0.04);
    ctxFore.restore();

    const numP = fullInstant ? 1.0 : (evalT >= metricStart - 0.03 ? Math.min(1, Math.max(0, (evalT - metricStart) / 0.14)) : 0);
    if (numP > 0.01) {
      const nep = easeOutCubic(numP);
      const nScale = fullInstant ? 1.0 : (0.94 + 0.06 * nep);
      const gTop = numBaseY - numFontSize * 0.76;
      targetBehind.save();
      try {
        targetBehind.globalAlpha = exitFade * nep;
        targetBehind.translate(heroCenterX, heroCenterY);
        targetBehind.scale(nScale, nScale);
        targetBehind.translate(-heroCenterX, -heroCenterY);

        targetBehind.font = `italic 900 ${numFontSize}px ${flexFam}`;
        if ('letterSpacing' in targetBehind) targetBehind.letterSpacing = `${ov.trackEmWith(-0.04)}em`;
        targetBehind.textAlign = 'center';
        targetBehind.textBaseline = 'alphabetic';

        ov.applyGlow(targetBehind, 'rgba(0, 0, 0, 0.45)', Math.max(6, Math.round(H * 0.008)));
        targetBehind.shadowOffsetY = Math.round(H * 0.003);

        if (ov.customHighlight) {
          targetBehind.fillStyle = ov.customHighlight;
        } else {
          const magGrad = targetBehind.createLinearGradient(0, gTop, 0, numBaseY + numFontSize * 0.05);
          magGrad.addColorStop(0.00, '#BD2EE6');
          magGrad.addColorStop(0.45, '#B810E6');
          magGrad.addColorStop(1.00, '#D926E8');
          targetBehind.fillStyle = magGrad;
        }
        targetBehind.fillText(metricWord, heroCenterX, numBaseY);
      } finally {
        targetBehind.restore();
      }
    }

    // Top-right italic qualifier ('a month') nestled along upper rim of '00'
    if (topRightWords.length > 0) {
      const noteX = Math.round(heroCenterX + numW * 0.12);
      const noteBaseY = Math.max(H * 0.070, Math.round(numBaseY - numFontSize * 0.77 - (ov.lineSpacingMult - 1.0) * numFontSize * 0.25));
      drawProgressiveWords(ctxFore, topRightWords, noteX, noteBaseY, Math.round(H * 0.025), 800, true, 'center', -0.02, false);
    }

    // Front Waist Subtitle ('With a tenant paying')
    if (waistWords.length > 0) {
      drawProgressiveWords(ctxFore, waistWords, Math.round(W * 0.50), Math.round(H * 0.530 + (ov.lineSpacingMult - 1.0) * H * 0.032), Math.round(H * 0.035), 600, false, 'center', -0.015, false);
    }

  } else if (styleMode === 3) {
    // STYLE 3: Lead Phrase Above Upper-Left Rim + Climax Word ('attention') over Horizontal Anamorphic Magenta Glow
    let heroIdx = words.findIndex(w => /\b(attention|profit|results|secret|viral|money|grow|hook|deal|offer|invest|return)\b/i.test(w.t || w.word || ''));
    if (heroIdx === -1) heroIdx = pickLongestWordIdx(words, Math.max(0, words.length - 2), words.length - 1);

    const punchTxt = cleanToken(words[heroIdx]?.t || words[heroIdx]?.word || '', false) || 'attention';
    const punchStart = wordStartTime(words[heroIdx], capStart + 0.50);
    const leadWords = words.slice(0, heroIdx);
    const extraPostWords = words.slice(heroIdx + 1);

    const punchFontSize = fitFlexFont(ctxFore, punchTxt, 900, false, H * 0.078, H * 0.046, W * 0.59, -0.03);
    const punchX = Math.round(W * 0.49);
    const punchBaseY = Math.round(H * 0.538);
    const punchCenterY = Math.round(punchBaseY - punchFontSize * 0.28);

    ctxFore.save();
    ctxFore.font = `900 ${punchFontSize}px "Poppins", "Montserrat", sans-serif`;
    if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = '-0.03em';
    const punchW = measureFlexWidth(ctxFore, punchTxt, punchFontSize, -0.03);
    ctxFore.restore();

    const punchP = fullInstant ? 1.0 : (evalT >= punchStart - 0.06 ? Math.min(1, Math.max(0, (evalT - (punchStart - 0.04)) / 0.16)) : 0);
    if (punchP > 0.01) {
      const pep = easeOutCubic(punchP);
      const maxRx = Math.max(W * 0.30, punchW * 0.68);
      const maxRy = Math.max(H * 0.036, punchFontSize * 0.68);

      // Multi-layer elliptical horizontal anamorphic magenta/violet neon flare
      ctxFore.save();
      try {
        ctxFore.globalAlpha = exitFade * pep;
        const drawGlowEllipse = (cx, cy, rx, ry, stops) => {
          ctxFore.save();
          ctxFore.translate(cx, cy);
          ctxFore.scale(1, ry / Math.max(1, rx));
          const g = ctxFore.createRadialGradient(0, 0, 2, 0, 0, rx);
          for (let s = 0; s < stops.length; s++) g.addColorStop(stops[s][0], stops[s][1]);
          ctxFore.fillStyle = g;
          ctxFore.beginPath();
          ctxFore.arc(0, 0, rx, 0, Math.PI * 2);
          ctxFore.fill();
          ctxFore.restore();
        };

        drawGlowEllipse(punchX, punchCenterY, maxRx * 1.10, maxRy * 1.15, [
          [0.00, 'rgba(182, 16, 236, 0.76)'],
          [0.52, 'rgba(155, 10, 215, 0.42)'],
          [1.00, 'rgba(130, 8, 195, 0.00)']
        ]);
        drawGlowEllipse(punchX, punchCenterY, maxRx * 0.88, maxRy * 0.66, [
          [0.00, 'rgba(244, 48, 255, 0.88)'],
          [0.55, 'rgba(218, 22, 248, 0.48)'],
          [1.00, 'rgba(180, 12, 230, 0.00)']
        ]);
        drawGlowEllipse(punchX, punchCenterY, maxRx * 1.15, Math.max(H * 0.014, maxRy * 0.24), [
          [0.00, 'rgba(255, 118, 255, 0.56)'],
          [0.55, 'rgba(240, 64, 255, 0.24)'],
          [1.00, 'rgba(220, 20, 250, 0.00)']
        ]);
      } finally {
        ctxFore.restore();
      }
    }

    // Heavy crisp white climax word ('attention') on front layer
    drawFrontWord(ctxFore, punchTxt, punchX, punchBaseY, punchFontSize, 900, false, 'center', punchStart, -0.03, true);

    // Lead phrase ('Those numbers get your') overlapping upper-left rim of punch word
    if (leadWords.length > 0) {
      const punchLeft = punchX - punchW * 0.5;
      const leadX = Math.max(W * 0.06, Math.round(punchLeft - W * 0.072));
      const leadBaseY = Math.round(punchBaseY - punchFontSize * 0.47);
      drawProgressiveWords(ctxFore, leadWords, leadX, leadBaseY, Math.round(H * 0.030), 600, false, 'left', -0.015, true);
    }

    if (extraPostWords.length > 0) {
      drawProgressiveWords(ctxFore, extraPostWords, punchX, Math.round(punchBaseY + punchFontSize * 0.42), Math.round(H * 0.029), 600, false, 'center', -0.015, true);
    }

  } else {
    // STYLE 4: Deep Indigo-to-Amethyst Crystal Split Horizon ('listing') Behind + 'A great' Top-Left + 'helps you / picture / everyday life / there'
    let behindIdx = words.findIndex((w, i) => w.key && i >= 1 && i <= 3);
    if (behindIdx === -1) {
      behindIdx = words.length >= 5
        ? pickLongestWordIdx(words, 1, Math.min(3, words.length - 2))
        : pickLongestWordIdx(words, 0, Math.min(2, words.length - 1));
    }
    const heroWord = cleanToken(words[behindIdx]?.t || words[behindIdx]?.word || '', false) || 'listing';
    const heroStart = wordStartTime(words[behindIdx], capStart + 0.16);
    const topWords = words.slice(0, behindIdx);
    const afterBehind = words.slice(behindIdx + 1);

    const heroX = Math.round(W * 0.50);
    const heroCenterY = Math.round(H * Math.max(0.165, Math.min(0.265, headCrown - 0.002)));
    const heroFontSize = fitFlexFont(targetBehind, heroWord, 900, false, H * 0.140, H * 0.080, W * 0.72, -0.04);
    const heroBaseY = Math.round(heroCenterY + heroFontSize * 0.33);

    ctxFore.save();
    ctxFore.font = `900 ${heroFontSize}px "Poppins", "Montserrat", sans-serif`;
    if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = '-0.04em';
    const heroW = measureFlexWidth(ctxFore, heroWord, heroFontSize, -0.04);
    ctxFore.restore();

    // 1. Giant Amethyst Crystal Split-Horizon Word Behind Head
    const heroP = fullInstant ? 1.0 : (evalT >= heroStart - 0.04 ? Math.min(1, Math.max(0, (evalT - heroStart) / 0.18)) : 0);
    if (heroP > 0.01) {
      const hep = easeOutCubic(heroP);
      const hScale = fullInstant ? 1.0 : (0.95 + 0.05 * hep);

      const drawHeroBase = (c, ox, oy) => {
        if (ov.customHighlight) {
          c.fillStyle = ov.customHighlight;
        } else {
          const g = c.createLinearGradient(0, oy - heroFontSize * 0.72, 0, oy + heroFontSize * 0.22);
          g.addColorStop(0.00, '#180544');
          g.addColorStop(0.51, '#21065E');
          g.addColorStop(0.555, '#540EB8');
          g.addColorStop(0.59, '#8820F4');
          g.addColorStop(0.75, '#7614E8');
          g.addColorStop(1.00, '#580BC0');
          c.fillStyle = g;
        }
        c.fillText(heroWord, ox, oy);
      };

      targetBehind.save();
      try {
        targetBehind.globalAlpha = exitFade * hep;
        targetBehind.translate(heroX, heroCenterY);
        targetBehind.scale(hScale, hScale);
        targetBehind.translate(-heroX, -heroCenterY);

        let crystalRendered = false;
        if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
          const pad = Math.max(12, Math.round(heroFontSize * 0.14));
          const cW = Math.min(W, Math.max(40, Math.ceil(heroW + pad * 2)));
          const cH = Math.min(H, Math.max(40, Math.ceil(heroFontSize * 1.25)));
          const oxLeft = Math.round(heroX - cW * 0.5);
          const oyTop = Math.round(heroBaseY - heroFontSize * 0.84);
          const off = document.createElement('canvas');
          off.width = cW;
          off.height = cH;
          const octx = off.getContext && off.getContext('2d');
          if (octx) {
            octx.font = `900 ${heroFontSize}px "Poppins", "Montserrat", sans-serif`;
            if ('letterSpacing' in octx) octx.letterSpacing = '-0.04em';
            octx.textAlign = 'center';
            octx.textBaseline = 'alphabetic';
            const localX = heroX - oxLeft;
            const localY = heroBaseY - oyTop;
            drawHeroBase(octx, localX, localY);

            // Clipped crystalline facet planes + horizon sheen inside glyph silhouettes
            octx.globalCompositeOperation = 'source-atop';
            const facets = [
              [0.05, 0.50, 0.22, 0.12, 0.34, 0.74, 'rgba(186, 118, 255, 0.24)'],
              [0.16, 0.88, 0.36, 0.36, 0.52, 0.92, 'rgba(20, 4, 58, 0.26)'],
              [0.32, 0.45, 0.50, 0.08, 0.64, 0.68, 'rgba(216, 170, 255, 0.20)'],
              [0.52, 0.84, 0.72, 0.40, 0.84, 0.96, 'rgba(28, 5, 72, 0.24)'],
              [0.64, 0.48, 0.82, 0.14, 0.96, 0.72, 'rgba(204, 142, 255, 0.22)'],
              [0.74, 0.92, 0.90, 0.52, 1.00, 0.98, 'rgba(232, 198, 255, 0.18)']
            ];
            for (let f = 0; f < facets.length; f++) {
              const ft = facets[f];
              octx.fillStyle = ft[6];
              octx.beginPath();
              octx.moveTo(ft[0] * cW, ft[1] * cH);
              octx.lineTo(ft[2] * cW, ft[3] * cH);
              octx.lineTo(ft[4] * cW, ft[5] * cH);
              octx.closePath();
              octx.fill();
            }
            const hBarY = localY - heroFontSize * 0.26;
            const hGlow = octx.createLinearGradient(0, hBarY - 8, 0, hBarY + 12);
            hGlow.addColorStop(0.0, 'rgba(220, 175, 255, 0.00)');
            hGlow.addColorStop(0.45, 'rgba(230, 192, 255, 0.28)');
            hGlow.addColorStop(1.0, 'rgba(180, 90, 255, 0.00)');
            octx.fillStyle = hGlow;
            octx.fillRect(0, hBarY - 8, cW, 20);

            targetBehind.shadowColor = 'rgba(0, 0, 0, 0.50)';
            targetBehind.shadowBlur = Math.max(6, Math.round(H * 0.009));
            targetBehind.shadowOffsetY = Math.round(H * 0.003);
            targetBehind.drawImage(off, oxLeft, oyTop);

            // Crisp razor-thin lilac outer highlight rim
            targetBehind.shadowColor = 'transparent';
            targetBehind.shadowBlur = 0;
            targetBehind.shadowOffsetY = 0;
            targetBehind.font = `900 ${heroFontSize}px "Poppins", "Montserrat", sans-serif`;
            if ('letterSpacing' in targetBehind) targetBehind.letterSpacing = '-0.04em';
            targetBehind.textAlign = 'center';
            targetBehind.textBaseline = 'alphabetic';
            targetBehind.strokeStyle = 'rgba(232, 205, 255, 0.34)';
            targetBehind.lineWidth = Math.max(1.0, H * 0.0010);
            targetBehind.strokeText(heroWord, heroX, heroBaseY);
            crystalRendered = true;
          }
        }

        if (!crystalRendered) {
          targetBehind.font = `900 ${heroFontSize}px "Poppins", "Montserrat", sans-serif`;
          if ('letterSpacing' in targetBehind) targetBehind.letterSpacing = '-0.04em';
          targetBehind.textAlign = 'center';
          targetBehind.textBaseline = 'alphabetic';
          targetBehind.shadowColor = 'rgba(0, 0, 0, 0.50)';
          targetBehind.shadowBlur = Math.max(6, Math.round(H * 0.009));
          targetBehind.shadowOffsetY = Math.round(H * 0.003);
          drawHeroBase(targetBehind, heroX, heroBaseY);
          targetBehind.shadowColor = 'transparent';
          targetBehind.strokeStyle = 'rgba(232, 205, 255, 0.34)';
          targetBehind.lineWidth = Math.max(1.0, H * 0.0010);
          targetBehind.strokeText(heroWord, heroX, heroBaseY);
        }
      } finally {
        targetBehind.restore();
      }
    }

    // 2. Top-Left Italic Lead ('A great') overlapping top-left corner of behind word
    if (topWords.length > 0) {
      const heroLeft = heroX - heroW * 0.5;
      const topX = Math.max(W * 0.055, Math.round(heroLeft + W * 0.004));
      const topBaseY = Math.max(H * 0.075, Math.round(heroBaseY - heroFontSize * 0.55));
      drawProgressiveWords(ctxFore, topWords, topX, topBaseY, Math.round(H * 0.031), 800, true, 'left', -0.02, false);
    }

    // 3. Waist Kinetic Composition ('helps you' -> italic 'picture' -> 'everyday life' -> 'there')
    if (afterBehind.length > 0) {
      let waistLead = [];
      let waistHeroObj = null;
      let waistSub = [];

      if (afterBehind.length === 1) {
        waistHeroObj = afterBehind[0];
      } else if (afterBehind.length === 2) {
        waistLead = [afterBehind[0]];
        waistHeroObj = afterBehind[1];
      } else {
        const twoLen = (cleanToken(afterBehind[0].t || afterBehind[0].word, false) + ' ' + cleanToken(afterBehind[1].t || afterBehind[1].word, false)).length;
        const w2Len = cleanToken(afterBehind[2].t || afterBehind[2].word, false).length;
        if (twoLen <= 12 && w2Len >= 4) {
          waistLead = afterBehind.slice(0, 2);
          waistHeroObj = afterBehind[2];
          waistSub = afterBehind.slice(3);
        } else {
          waistLead = [afterBehind[0]];
          waistHeroObj = afterBehind[1];
          waistSub = afterBehind.slice(2);
        }
      }

      const wHeroTxt = waistHeroObj ? cleanToken(waistHeroObj.t || waistHeroObj.word || '', false) : '';
      const wHeroStart = waistHeroObj ? wordStartTime(waistHeroObj, capStart + 0.85) : capStart;
      const wHeroSize = fitFlexFont(ctxFore, wHeroTxt, 900, true, H * 0.066, H * 0.038, W * 0.68, -0.03);
      const wHeroBaseY = Math.round(H * 0.526);

      ctxFore.save();
      ctxFore.font = `italic 900 ${wHeroSize}px "Poppins", "Montserrat", sans-serif`;
      if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = '-0.03em';
      const wHeroW = measureFlexWidth(ctxFore, wHeroTxt, wHeroSize, -0.03);
      ctxFore.restore();

      const wHeroLeft = heroX - wHeroW * 0.5;
      const wHeroRight = heroX + wHeroW * 0.5;

      // Render bold italic waist hero ('picture') FIRST so 'helps you' sits crisply over its upper-left rim
      drawFrontWord(ctxFore, wHeroTxt, heroX, wHeroBaseY, wHeroSize, 900, true, 'center', wHeroStart, -0.03, false);

      if (waistLead.length > 0) {
        const leadBaseY = Math.round(wHeroBaseY - wHeroSize * 0.44);
        drawProgressiveWords(ctxFore, waistLead, Math.round(wHeroLeft + W * 0.004), leadBaseY, Math.round(H * 0.030), 600, false, 'left', -0.015, true);
      }

      if (waistSub.length > 0) {
        const subBaseY = Math.round(wHeroBaseY + wHeroSize * 0.36);
        if (waistSub.length >= 3) {
          const headSub = waistSub.slice(0, -1);
          const finalSub = [waistSub[waistSub.length - 1]];
          const swapStart = wordStartTime(finalSub[0], wHeroStart + 0.55);
          const outP = fullInstant ? 0 : (evalT >= swapStart - 0.06 ? Math.min(1, Math.max(0, (evalT - (swapStart - 0.06)) / 0.08)) : 0);
          if (outP < 0.99) {
            drawProgressiveWords(ctxFore, headSub, heroX, subBaseY, Math.round(H * 0.034), 700, false, 'center', -0.015, true, outP);
          }
          if (fullInstant || evalT >= swapStart - 0.02) {
            drawProgressiveWords(ctxFore, finalSub, Math.round(wHeroRight + W * 0.012), subBaseY, Math.round(H * 0.034), 700, false, 'right', -0.015, true);
          }
        } else {
          drawProgressiveWords(ctxFore, waistSub, heroX, subBaseY, Math.round(H * 0.034), 700, false, 'center', -0.015, true);
        }
      }
    }
  }
}

function drawEditorialDepthStackPass(ctxFore, ctxBehind, cap, words, t, st, W, H, isBehind, showAll, isPreview) {
  if (!words || !words.length) return;
  const ov = resolveSceneStyleOverrides(st, H);
  const edFam = ov.pickFontFam('"Poppins", "Montserrat", sans-serif');
  const edFontScale = Math.max(0.5, Math.min(2.0, Number(st?.fontScale) || 1.0));
  const edCase = st && st.textCase;
  const edHTrk = ov.trackEmWith(-0.068);
  const edLTrk = ov.trackEmWith(-0.03);

  const isSampleCard = Boolean(cap && cap.id === 'preview_sample');
  const targetBehind = (isBehind && ctxBehind) ? ctxBehind : ctxFore;

  // Resolve real index in S.captions so even captions sit Top and odd captions sit Waist
  const captionsArr = (typeof S !== 'undefined' && Array.isArray(S.captions)) ? S.captions : null;
  let capIdx = (captionsArr && cap) ? captionsArr.indexOf(cap) : -1;
  if (capIdx === -1) {
    const capId = (cap && (cap.index != null ? cap.index : cap.id)) || 1;
    const rawIdx = typeof capId === 'number' ? capId : parseInt(capId, 10);
    capIdx = (!isNaN(rawIdx) && rawIdx > 0) ? rawIdx - 1 : 0;
  }

  // Exact 8-palette left-to-right jewel gradients sampled directly from reference video (19u9oQHSraYLhZowNFfRH1qsMad22SovD)
  const palettes = [
    { left: '#2E208E', mid: '#191054', right: '#0A062E' }, // 0 Top: Deep Indigo-Navy ("seen")
    { left: '#1AAAE8', mid: '#0B70B0', right: '#043356' }, // 1 Waist: Glossy Sky-Blue ("remembered")
    { left: '#2E9F4A', mid: '#156130', right: '#072413' }, // 2 Top: Emerald Green ("difference")
    { left: '#8230C4', mid: '#5C1D8F', right: '#280946' }, // 3 Waist: Violet Purple ("story")
    { left: '#2E52CC', mid: '#192F88', right: '#09133C' }, // 4 Top: Royal Cobalt ("detail")
    { left: '#80B548', mid: '#568432', right: '#294418' }, // 5 Waist: Olive Chartreuse ("meaning")
    { left: '#1D9885', mid: '#0E5A53', right: '#042422' }, // 6 Top: Deep Teal ("imagining")
    { left: '#DD6B48', mid: '#9F422C', right: '#541F13' }  // 7 Waist: Warm Terracotta ("home")
  ];

  const easeOutCubic = (x) => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);
  const measureWidth = (c, str, fallbackPx) => {
    if (c && typeof c.measureText === 'function') {
      const m = c.measureText(str);
      if (m && typeof m.width === 'number') return m.width;
    }
    return String(str || '').length * fallbackPx * 0.54;
  };
  const cleanHeroWord = (txt) => {
    const s = String(txt || '').replace(/^[""'`.,/#!$%^&*;:{}=\-_~()?]+|[""'`.,/#!$%^&*;:{}=\-_~()?]+$/g, '');
    if (edCase === 'upper') return s.toUpperCase();
    if (edCase === 'asIs') return s;
    if (edCase === 'title') return s.replace(/\b\w/g, (c) => c.toUpperCase());
    return s.toLowerCase();
  };
  const cleanLeadWord = (txt) => {
    const s = String(txt || '').replace(/^[""']+|[,.;:!?""']+$/g, '');
    if (edCase === 'upper') return s.toUpperCase();
    if (edCase === 'lower') return s.toLowerCase();
    return s;
  };

  const normalizeWords = (wordList, fallbackStart, fallbackEnd) => {
    const arr = (wordList || []).map(w => ({
      t: w.t || w.word || '',
      s: typeof w.s === 'number' ? w.s : (typeof w.start === 'number' ? w.start : fallbackStart),
      e: typeof w.e === 'number' ? w.e : (typeof w.end === 'number' ? w.end : fallbackEnd),
      key: Boolean(w.key)
    })).filter(w => w.t);
    const step = arr.length > 0 ? Math.max(0.18, (fallbackEnd - fallbackStart) / arr.length) : 0.25;
    arr.forEach((w, i) => {
      if (w.s === 0 && w.e === 0 && fallbackEnd > fallbackStart) {
        w.s = fallbackStart + i * step;
        w.e = fallbackStart + (i + 1) * step;
      }
    });
    return arr;
  };

  // Draws one [White Lead + Giant Colored Hero] stack in either 'top' or 'waist' position
  const drawEditorialPair = (leadList, heroObj, slot, pal, fadeAlpha, evalT, fullInstant) => {
    const heroRaw = heroObj ? (heroObj.t || heroObj.word || '') : '';
    const heroText = cleanHeroWord(heroRaw) || 'seen';
    const heroStart = (heroObj && typeof heroObj.s === 'number') ? heroObj.s : 0;

    let heroFontSize = Math.round(H * 0.128 * edFontScale);
    targetBehind.save();
    targetBehind.font = `900 ${heroFontSize}px ${edFam}`;
    if ('letterSpacing' in targetBehind) targetBehind.letterSpacing = `${edHTrk}em`;
    const rawHeroW = measureWidth(targetBehind, heroText, heroFontSize);
    targetBehind.restore();

    const maxHeroW = W * 0.90;
    if (rawHeroW > maxHeroW && rawHeroW > 0) {
      heroFontSize = Math.max(Math.round(H * 0.055), Math.floor(heroFontSize * (maxHeroW / rawHeroW)));
    }

    const heroX = Math.round(W * 0.50);
    let heroBaselineY;
    let heroInkTopY;
    if (slot === 'top') {
      const crownPlace = computeBehindCrownPlacement(targetBehind, heroText, {
        W,
        H,
        fontFn: (sz) => `900 ${sz}px ${edFam}`,
        preferredSize: heroFontSize,
        minSize: Math.round(H * 0.055),
        trackEm: edHTrk,
        isSampleCard,
        fallbackCrownRatio: 0.225,
        extraAbovePx: (leadList && leadList.length > 0) ? Math.round(H * 0.048) : 0
      });
      heroFontSize = crownPlace.size;
      heroBaselineY = Math.round(crownPlace.baseY + ov.posDeltaY);
      heroInkTopY = Math.round(crownPlace.inkTopY + ov.posDeltaY);
    } else {
      const heroCenterY = Math.round(H * 0.620 + ov.posDeltaY);
      heroBaselineY = Math.round(heroCenterY + heroFontSize * 0.28);
      heroInkTopY = Math.round(heroBaselineY - heroFontSize * 0.58);
    }
    ov.recordSceneBox(cap, W, H, heroX - W * 0.42, heroInkTopY - H * 0.05, W * 0.84, (heroBaselineY - heroInkTopY) + H * 0.08);

    // Hero entrance curve ("how it comes"): slides gently rightwards into center while sharpening out of blur
    const heroAge = fullInstant ? 1.0 : Math.max(0, evalT - heroStart);
    const heroP = fullInstant ? 1.0 : easeOutCubic(Math.min(1, heroAge / 0.26));
    const heroVisible = fullInstant || (evalT >= heroStart - 0.02);

    if (heroVisible && fadeAlpha > 0.005) {
      // Top keyword draws on targetBehind (behind person cutout); lower waist keyword draws in front (ctxFore) so it stays visible
      const heroCtx = (slot === 'waist') ? ctxFore : targetBehind;
      const hasBehindLayer = Boolean(isBehind && ctxBehind);
      const layerOpacity = isSampleCard ? 0.92 : (hasBehindLayer ? 0.96 : 0.72);
      const heroAlpha = fadeAlpha * Math.min(1, heroP * 1.45) * layerOpacity;
      const slideX = fullInstant ? 0 : Math.round(-W * 0.095 * (1 - heroP));
      const heroScale = fullInstant ? 1.0 : (0.96 + 0.04 * heroP);
      const blurPx = fullInstant ? 0 : Math.round(9 * Math.pow(1 - heroP, 2) * 10) / 10;

      heroCtx.save();
      try {
        heroCtx.globalAlpha = heroAlpha;
        if (blurPx > 0.2 && 'filter' in heroCtx) {
          heroCtx.filter = `blur(${blurPx.toFixed(1)}px)`;
        }
        heroCtx.translate(heroX + slideX, heroBaselineY);
        heroCtx.scale(heroScale, heroScale);
        heroCtx.translate(-heroX, -heroBaselineY);

        heroCtx.font = `900 ${heroFontSize}px ${edFam}`;
        heroCtx.textAlign = 'center';
        heroCtx.textBaseline = 'alphabetic';
        if ('letterSpacing' in heroCtx) heroCtx.letterSpacing = `${edHTrk}em`;

        const finalHeroW = Math.max(W * 0.26, measureWidth(heroCtx, heroText, heroFontSize));
        const gradLeft = heroX - finalHeroW * 0.52;
        const gradRight = heroX + finalHeroW * 0.52;
        const horizGrad = heroCtx.createLinearGradient(gradLeft, 0, gradRight, 0);
        horizGrad.addColorStop(0.00, pal.left);
        horizGrad.addColorStop(0.52, pal.mid);
        horizGrad.addColorStop(1.00, pal.right);

        ov.applyGlow(heroCtx, 'rgba(0, 0, 0, 0.22)', 8, 1);
        heroCtx.shadowOffsetX = 0;
        heroCtx.shadowOffsetY = 2;

        heroCtx.fillStyle = ov.customHighlight || horizGrad;
        heroCtx.fillText(heroText, heroX, heroBaselineY);
      } finally {
        if ('filter' in heroCtx) heroCtx.filter = 'none';
        heroCtx.restore();
      }
    }

    // 2. Small White Lead Line sitting RIGHT along top rim of Hero word (ctxFore Layer 4)
    const cleanTokens = (leadList || [])
      .map(w => ({ txt: cleanLeadWord(w.t || w.word || ''), s: w.s }))
      .filter(w => w.txt);

    if (cleanTokens.length > 0 && fadeAlpha > 0.005) {
      const leadWeight = slot === 'top' ? '700' : '500';
      let leadFontSize = Math.round(H * 0.038 * edFontScale);
      const fullLeadStr = cleanTokens.map(w => w.txt).join(' ');

      ctxFore.save();
      ctxFore.font = `${leadWeight} ${leadFontSize}px ${edFam}`;
      if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${edLTrk}em`;
      const rawLeadW = measureWidth(ctxFore, fullLeadStr, leadFontSize);
      ctxFore.restore();

      const maxLeadW = W * 0.88;
      if (rawLeadW > maxLeadW && rawLeadW > 0) {
        leadFontSize = Math.max(Math.round(H * 0.020), Math.floor(leadFontSize * (maxLeadW / rawLeadW)));
      }

      const leadGap = Math.round((ov.lineSpacingMult - 1.0) * heroFontSize * 0.26);
      const leadBaselineY = Math.max(
        Math.round(H * 0.025 + leadFontSize * 0.80),
        Math.round(Math.min(heroBaselineY - heroFontSize * 0.54, heroInkTopY - Math.round(H * 0.004)) - leadGap)
      );

      ctxFore.save();
      try {
        ctxFore.font = `${leadWeight} ${leadFontSize}px ${edFam}`;
        if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${edLTrk}em`;
        ctxFore.textAlign = 'left';
        ctxFore.textBaseline = 'alphabetic';
        ctxFore.fillStyle = ov.pickBase('#FFFFFF');
        ov.applyGlow(ctxFore, 'rgba(0, 0, 0, 0.65)', 8, 1);
        ctxFore.shadowOffsetX = 0;
        ctxFore.shadowOffsetY = 2;

        const totalLineW = measureWidth(ctxFore, fullLeadStr, leadFontSize);
        const startX = Math.round(W * 0.50 - totalLineW * 0.50);

        for (let i = 0; i < cleanTokens.length; i++) {
          const tok = cleanTokens[i];
          const prefixStr = i > 0 ? (cleanTokens.slice(0, i).map(x => x.txt).join(' ') + ' ') : '';
          const wordX = startX + measureWidth(ctxFore, prefixStr, leadFontSize);
          const wordW = measureWidth(ctxFore, tok.txt, leadFontSize);

          const wAge = fullInstant ? 1.0 : Math.max(0, evalT - (typeof tok.s === 'number' ? tok.s : 0));
          const wp = fullInstant ? 1.0 : easeOutCubic(Math.min(1, wAge / 0.22));
          if (!fullInstant && evalT < (typeof tok.s === 'number' ? tok.s : 0) - 0.02) continue;

          // Exact per-word horizontal slide-in behind left edge mask ("Some |omes", "A |ew", "a |lace")
          const slideShift = fullInstant ? 0 : (-wordW * 0.44 * (1 - wp));
          const wordAlpha = fadeAlpha * Math.min(1, wp * 1.6);

          ctxFore.save();
          ctxFore.globalAlpha = wordAlpha;
          ctxFore.beginPath();
          ctxFore.rect(wordX - 2, leadBaselineY - leadFontSize * 1.25, wordW + 24, leadFontSize * 1.65);
          ctxFore.clip();
          ctxFore.fillText(tok.txt, wordX + slideShift, leadBaselineY);
          ctxFore.restore();
        }
      } finally {
        ctxFore.restore();
      }
    }
  };

  // Sample Thumbnail / Showcase Fallback Card (matches ref frame 2.60s pairing)
  if (isSampleCard) {
    drawEditorialPair(
      [{ t: 'Some' }, { t: 'homes' }, { t: 'get' }],
      { t: 'seen' },
      'top',
      palettes[0],
      1.0,
      999,
      true
    );
    drawEditorialPair(
      [{ t: 'A' }, { t: 'few' }, { t: 'get' }],
      { t: 'remembered' },
      'waist',
      palettes[1],
      1.0,
      999,
      true
    );
    return;
  }

  const capStart = (cap && typeof cap.start === 'number') ? cap.start : (words[0] && typeof words[0].s === 'number' ? words[0].s : 0);
  const capEnd = (cap && typeof cap.end === 'number') ? cap.end : (words[words.length - 1] && typeof words[words.length - 1].e === 'number' ? words[words.length - 1].e : capStart + 2.5);
  const normWords = normalizeWords(words, capStart, capEnd);

  // Determine evaluation time: when paused before caption starts at t=0, show crisp resting frame; otherwise track live time t
  const evalT = (typeof t === 'number')
    ? ((showAll && t < capStart) ? capStart + Math.max(0.4, (capEnd - capStart) * 0.65) : t)
    : capEnd;
  const fullInstant = typeof t !== 'number';

  // Single long caption (>= 6 words): split naturally into paired Top + Waist scene
  if (normWords.length >= 6) {
    let splitAt = Math.ceil(normWords.length / 2);
    for (let k = Math.max(2, splitAt - 1); k <= Math.min(normWords.length - 2, splitAt + 1); k++) {
      if (/[,.;!?]$/.test(normWords[k - 1].t)) {
        splitAt = k;
        break;
      }
    }
    const topSlice = normWords.slice(0, splitAt);
    const waistSlice = normWords.slice(splitAt);
    const timeRem = fullInstant ? 1.0 : Math.max(0, capEnd - evalT);
    const exitFade = fullInstant ? 1.0 : Math.min(1, Math.max(0, timeRem / 0.24));

    drawEditorialPair(
      topSlice.slice(0, -1),
      topSlice[topSlice.length - 1],
      'top',
      palettes[(capIdx * 2) % palettes.length],
      exitFade,
      evalT,
      fullInstant
    );
    drawEditorialPair(
      waistSlice.slice(0, -1),
      waistSlice[waistSlice.length - 1],
      'waist',
      palettes[(capIdx * 2 + 1) % palettes.length],
      exitFade,
      evalT,
      fullInstant
    );
    return;
  }

  // Standard <= 5 word caption cadence: Even captions render at Top; Odd captions render at Waist while lingering prev Top smoothly fades out
  const isOddWaist = (capIdx % 2 === 1);
  const nextCap = (captionsArr && capIdx >= 0 && capIdx + 1 < captionsArr.length) ? captionsArr[capIdx + 1] : null;
  const prevCap = (captionsArr && capIdx > 0) ? captionsArr[capIdx - 1] : null;

  if (isOddWaist && prevCap) {
    const prevGap = capStart - (typeof prevCap.end === 'number' ? prevCap.end : capStart);
    if (prevGap <= 1.2) {
      const pStart = typeof prevCap.start === 'number' ? prevCap.start : 0;
      const pEnd = typeof prevCap.end === 'number' ? prevCap.end : capStart;
      const prevWords = normalizeWords(prevCap.words || (prevCap.text || '').split(/\s+/).map(tx => ({ t: tx })), pStart, pEnd);
      if (prevWords.length > 0) {
        // Hold Top at 100% until 60% into Waist caption so both sit crisp together (like 2.60s), then fade cleanly out
        const waistDur = Math.max(0.5, capEnd - capStart);
        const waistProg = fullInstant ? 0.3 : Math.max(0, (evalT - capStart) / waistDur);
        const topCarryFade = waistProg <= 0.60 ? 1.0 : Math.max(0, 1.0 - (waistProg - 0.60) / 0.28);
        if (topCarryFade > 0.01) {
          drawEditorialPair(
            prevWords.slice(0, -1),
            prevWords[prevWords.length - 1],
            'top',
            palettes[(capIdx - 1) % palettes.length],
            topCarryFade,
            evalT,
            true // prev Top already finished entering; hold sharp while fading out
          );
        }
      }
    }
  }

  // Exit fade for current caption ("how it goes")
  const holdIntoWaist = !isOddWaist && nextCap && ((nextCap.start - capEnd) <= 0.85);
  const timeRem = fullInstant ? 1.0 : Math.max(0, capEnd - evalT);
  const currExitFade = (fullInstant || holdIntoWaist) ? 1.0 : Math.min(1, Math.max(0, timeRem / 0.22));

  drawEditorialPair(
    normWords.slice(0, -1),
    normWords[normWords.length - 1],
    isOddWaist ? 'waist' : 'top',
    palettes[capIdx % palettes.length],
    currExitFade,
    evalT,
    fullInstant
  );
}

function drawRealEstateDepthSplitPass(ctxFore, ctxBehind, cap, words, t, st, W, H, isBehind, showAll, isPreview) {
  if (!words || !words.length) return;
  const ov = resolveSceneStyleOverrides(st, H);
  const reFam = ov.pickFontFam('"Inter", "Montserrat", sans-serif');
  const reFontScale = Math.max(0.5, Math.min(2.0, Number(st?.fontScale) || 1.0));
  ov.recordSceneBox(cap, W, H, W * 0.12, Math.round(H * 0.48 + ov.posDeltaY), W * 0.76, H * 0.24 * ov.lineSpacingMult);

  const isSampleCard = Boolean(cap && cap.id === 'preview_sample');
  const capStart = (cap && typeof cap.start === 'number') ? cap.start : (words[0] && typeof words[0].s === 'number' ? words[0].s : 0);
  const capEnd = (cap && typeof cap.end === 'number') ? cap.end : (words[words.length - 1] && typeof words[words.length - 1].e === 'number' ? words[words.length - 1].e : capStart + 2.5);
  const hasValidT = (typeof t === 'number' && !isNaN(t));
  const evalT = isSampleCard ? (capStart + 999) : (hasValidT ? t : (capStart + 1.0));
  const fullInstant = isSampleCard || !hasValidT || Boolean(showAll && evalT <= capStart + 0.04);

  const timeRem = fullInstant ? 1.0 : Math.max(0, capEnd - evalT);
  const exitFade = fullInstant ? 1.0 : Math.min(1, timeRem / 0.08);
  if (exitFade <= 0.005) return;

  const targetBehind = (isBehind && ctxBehind) ? ctxBehind : ctxFore;
  const capsList = (typeof S !== 'undefined' && S && Array.isArray(S.captions)) ? S.captions : [];
  const foundCapIdx = (cap && capsList.length > 0) ? capsList.indexOf(cap) : -1;
  const rawIdx = foundCapIdx >= 0
    ? foundCapIdx
    : (cap && typeof cap.index === 'number' && cap.index > 0 ? cap.index - 1 : 0);
  const modeIdx = isSampleCard ? 0 : (rawIdx % 4);

  const userCase = st && st.textCase;
  const applyRECase = (s) => {
    if (!s) return '';
    if (userCase === 'upper') return s.toUpperCase();
    if (userCase === 'lower') return s.toLowerCase();
    return s;
  };
  const cleanREToken = (raw, keepEndPunct) => {
    const cleaned = String(raw || '').replace(/["'’()[\]{}]/g, '').trim();
    const stripped = keepEndPunct ? cleaned.replace(/[?!;]+$/g, '') : cleaned.replace(/[.,!?;:]+$/g, '');
    return applyRECase(stripped);
  };
  const easeOutCubic = (x) => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);
  const wordStartTime = (w, fallback) => {
    if (w && typeof w.s === 'number') return w.s;
    if (w && typeof w.start === 'number') return w.start;
    return fallback;
  };

  const measureREWidth = (ctx, text, fontSize, trackEm) => {
    const m = ctx.measureText(text);
    const w = (m && typeof m.width === 'number') ? m.width : String(text || '').length * fontSize * 0.56;
    if ('letterSpacing' in ctx) return w;
    return Math.max(0, w + Math.max(0, String(text || '').length - 1) * fontSize * (trackEm || 0));
  };

  const fitREFont = (ctx, text, weight, idealPx, minPx, maxW, trackEm) => {
    const trk = ov.trackEmWith(trackEm);
    let size = Math.round(idealPx * reFontScale);
    if (!text) return size;
    ctx.save();
    ctx.font = `${weight} ${size}px ${reFam}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${trk}em`;
    const rawW = measureREWidth(ctx, text, size, trk);
    ctx.restore();
    if (rawW > maxW && rawW > 0) {
      size = Math.max(Math.round(minPx), Math.floor(size * (maxW / rawW)));
    }
    return size;
  };

  // Renders molten glossy crimson-orange glass hero word matching ref 10LAPPaIBR5ikZAt6tLiaGmijB-kWujdc
  const drawMoltenHero = (ctx, text, x, baselineY, fontSize, startTime, fadeMult, opacityScale, outFadeP) => {
    if (!text) return;
    if (!fullInstant && evalT < startTime - 0.02) return;
    const p = fullInstant ? 1.0 : Math.min(1.0, Math.max(0, (evalT - startTime) / 0.12));
    const ep = easeOutCubic(p);
    const outAlpha = (typeof outFadeP === 'number') ? Math.max(0, 1 - outFadeP) : 1.0;
    const alpha = exitFade * fadeMult * ep * opacityScale * outAlpha;
    if (alpha <= 0.01) return;

    const blurIn = fullInstant ? 0 : 4.5 * Math.pow(1 - p, 2);
    const blurOut = (typeof outFadeP === 'number' && outFadeP > 0) ? 4.0 * outFadeP : 0;
    const blurPx = Math.round((blurIn + blurOut) * 10) / 10;
    const scaleIn = fullInstant ? 1.0 : (0.94 + 0.06 * ep);
    const scaleOut = (typeof outFadeP === 'number' && outFadeP > 0) ? (1.0 - 0.05 * outFadeP) : 1.0;
    const scale = scaleIn * scaleOut;
    const adjY = Math.round(baselineY + (ctx === ctxFore ? ov.posDeltaY : 0));

    ctx.save();
    try {
      ctx.globalAlpha = alpha;
      if (blurPx > 0.2 && 'filter' in ctx) ctx.filter = `blur(${blurPx.toFixed(1)}px)`;
      ctx.font = `900 ${fontSize}px ${reFam}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      const trackEm = ov.trackEmWith(-0.035);
      if ('letterSpacing' in ctx) ctx.letterSpacing = `${trackEm}em`;

      const boxW = Math.max(W * 0.22, measureREWidth(ctx, text, fontSize, trackEm));
      const midY = adjY - fontSize * 0.36;
      ctx.translate(x, midY);
      ctx.scale(scale, scale);
      ctx.translate(-x, -midY);

      const phase = fullInstant ? 0 : Math.sin(evalT * 1.6) * 0.03;
      const g = ctx.createLinearGradient(
        x - boxW * 0.52,
        adjY - fontSize * 0.88,
        x + boxW * 0.52,
        adjY + fontSize * 0.16
      );
      g.addColorStop(0.00, '#FF6A08');
      g.addColorStop(Math.max(0.06, Math.min(0.24, 0.16 + phase)), '#F24B04');
      g.addColorStop(Math.max(0.22, Math.min(0.42, 0.34 - phase * 0.5)), '#920B04');
      g.addColorStop(Math.max(0.40, Math.min(0.56, 0.49 + phase * 0.5)), '#7E0602');
      g.addColorStop(Math.max(0.54, Math.min(0.70, 0.62 - phase * 0.5)), '#FA5405');
      g.addColorStop(Math.max(0.68, Math.min(0.84, 0.76 + phase * 0.4)), '#9B0D05');
      g.addColorStop(Math.max(0.82, Math.min(0.95, 0.89 - phase * 0.4)), '#FF5D07');
      g.addColorStop(1.00, '#D83804');

      ov.applyGlow(ctx, 'rgba(0, 0, 0, 0.40)', Math.max(4, Math.round(H * 0.006)), 1);
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = Math.round(H * 0.002);
      ctx.fillStyle = ov.customHighlight || g;
      ctx.fillText(text, x, adjY);
    } finally {
      if ('filter' in ctx) ctx.filter = 'none';
      ctx.restore();
    }
  };

  // Renders clean Inter white supporting words (400 light / 700-800 bold) with soft optical entrance
  const drawCleanWhite = (ctx, text, x, baselineY, fontSize, weight, align, startTime, fadeMult, trackEm, outFadeP) => {
    if (!text) return;
    if (!fullInstant && evalT < startTime - 0.02) return;
    const p = fullInstant ? 1.0 : Math.min(1.0, Math.max(0, (evalT - startTime) / 0.11));
    const ep = easeOutCubic(p);
    const outAlpha = (typeof outFadeP === 'number') ? Math.max(0, 1 - outFadeP) : 1.0;
    const alpha = exitFade * fadeMult * ep * outAlpha;
    if (alpha <= 0.01) return;

    const blurIn = fullInstant ? 0 : 3.8 * Math.pow(1 - p, 2);
    const blurOut = (typeof outFadeP === 'number' && outFadeP > 0) ? 3.5 * outFadeP : 0;
    const blurPx = Math.round((blurIn + blurOut) * 10) / 10;
    const scale = fullInstant ? 1.0 : (0.96 + 0.04 * ep);
    const trk = ov.trackEmWith(trackEm);
    const adjY = Math.round(baselineY + (ctx === ctxFore ? ov.posDeltaY : 0));

    ctx.save();
    try {
      ctx.globalAlpha = alpha;
      if (blurPx > 0.2 && 'filter' in ctx) ctx.filter = `blur(${blurPx.toFixed(1)}px)`;
      ctx.font = `${weight} ${fontSize}px ${reFam}`;
      ctx.textAlign = align;
      ctx.textBaseline = 'alphabetic';
      if ('letterSpacing' in ctx) ctx.letterSpacing = `${trk}em`;

      ctx.translate(x, adjY);
      ctx.scale(scale, scale);
      ctx.translate(-x, -adjY);

      ov.applyGlow(ctx, 'rgba(0, 0, 0, 0.44)', Math.max(3, Math.round(H * 0.006)), 1);
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = Math.round(H * 0.002);
      ctx.fillStyle = ov.pickBase('#FFFFFF');
      ctx.fillText(text, x, adjY);
    } finally {
      if ('filter' in ctx) ctx.filter = 'none';
      ctx.restore();
    }
  };

  // Helper to resolve swapped-word pair visibility & fade progression cleanly
  const resolveSwap = (aObj, bObj, fallbackSwapDelay) => {
    const aTxt = aObj ? cleanREToken(aObj.t || aObj.word || '', true) : '';
    const bTxt = bObj ? cleanREToken(bObj.t || bObj.word || '', true) : '';
    const aStart = aObj ? wordStartTime(aObj, capStart) : capStart;
    const bStart = bObj ? wordStartTime(bObj, aStart + fallbackSwapDelay) : (aStart + 999);
    if (!aTxt || !bTxt || fullInstant) {
      return { showA: Boolean(aTxt), aTxt, aStart, aOutP: 0, showB: Boolean(!aTxt && bTxt), bTxt, bStart };
    }
    const swapOutStart = bStart - 0.08;
    const aOutP = evalT >= swapOutStart ? Math.min(1, Math.max(0, (evalT - swapOutStart) / 0.08)) : 0;
    const showA = aOutP < 0.99;
    const showB = evalT >= bStart - 0.02;
    return { showA, aTxt, aStart, aOutP, showB, bTxt, bStart };
  };

  const n = words.length;
  const heroX = Math.round(W * 0.50);

  const maskStats = (!isSampleCard) ? getSubjectMaskStats() : null;
  const isTightCloseUp = Boolean(maskStats && (maskStats.headTopRatio < 0.16 || maskStats.centerCoverage > 0.52));

  // Renders an array of word tokens sequentially in clean white on one centered or aligned row
  // without erasing earlier words in the group.
  const drawProgressiveTokenRow = (ctx, tokenObjs, centerX, baselineY, fontSize, weight, trackEm, minStart, keepPunct, gapPx) => {
    if (!tokenObjs || !tokenObjs.length) return;
    const items = tokenObjs.map((w, idx) => ({
      txt: cleanREToken(w.t || w.word || '', keepPunct),
      start: wordStartTime(w, minStart + idx * 0.12)
    })).filter(it => Boolean(it.txt));
    if (!items.length) return;

    const fullLine = items.map(it => it.txt).join(' ');
    const trk = ov.trackEmWith(trackEm);
    let fitSize = fontSize;
    ctx.save();
    ctx.font = `${weight} ${fitSize}px ${reFam}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${trk}em`;
    const spaceW = Math.max(4, measureREWidth(ctx, ' ', fitSize, trk), gapPx || 0);
    const totalW = measureREWidth(ctx, fullLine, fitSize, trk);
    const maxRowW = W * 0.86;
    if (totalW > maxRowW && totalW > 0) {
      fitSize = Math.max(Math.round(H * 0.022), Math.floor(fitSize * (maxRowW / totalW)));
      ctx.font = `${weight} ${fitSize}px ${reFam}`;
    }
    const itemWidths = items.map(it => measureREWidth(ctx, it.txt, fitSize, trk));
    const spW = Math.max(Math.round(fitSize * 0.28), measureREWidth(ctx, ' ', fitSize, trk));
    const rowW = itemWidths.reduce((a, b) => a + b, 0) + spW * Math.max(0, items.length - 1);
    ctx.restore();

    let curX = Math.round(centerX - rowW * 0.5);
    items.forEach((it, idx) => {
      drawCleanWhite(ctx, it.txt, curX, baselineY, fitSize, weight, 'left', it.start, 1.0, trackEm);
      curX += Math.round(itemWidths[idx] + spW);
    });
  };

  if (modeIdx === 0) {
    // MODE 1: Split Behind-Head Depth Hero + Top Pair + Waist Hero w/ Small Centered Accent
    let lightText = '', lightStart = capStart;
    let boldText = '', boldStart = capStart + 0.14;
    let topHeroObj = null, waistSmallObjs = [], waistHeroObj = null;

    if (isSampleCard) {
      lightText = 'you can';
      boldText = 'add';
      topHeroObj = { t: 'Real', s: 0 };
      waistSmallObjs = [{ t: 'estate', s: 0 }];
      waistHeroObj = { t: 'Captions', s: 0 };
    } else if (n >= 6) {
      lightText = words.slice(0, 2).map(w => cleanREToken(w.t || w.word, true)).filter(Boolean).join(' ');
      lightStart = wordStartTime(words[0], capStart);
      boldText = cleanREToken(words[2].t || words[2].word, false);
      boldStart = wordStartTime(words[2], lightStart + 0.16);
      topHeroObj = words[3];
      waistHeroObj = words[5];
      // Preserve words[4] and ALL trailing words words[6..n-1] so zero words are ever dropped.
      waistSmallObjs = [words[4], ...words.slice(6)];
    } else if (n === 5) {
      lightText = cleanREToken(words[0].t || words[0].word, true);
      lightStart = wordStartTime(words[0], capStart);
      boldText = cleanREToken(words[1].t || words[1].word, false);
      boldStart = wordStartTime(words[1], lightStart + 0.14);
      topHeroObj = words[2];
      waistSmallObjs = [words[3]];
      waistHeroObj = words[4];
    } else if (n === 4) {
      lightText = cleanREToken(words[0].t || words[0].word, true);
      lightStart = wordStartTime(words[0], capStart);
      boldText = cleanREToken(words[1].t || words[1].word, false);
      boldStart = wordStartTime(words[1], lightStart + 0.14);
      topHeroObj = words[2];
      waistHeroObj = words[3];
    } else if (n === 3) {
      lightText = cleanREToken(words[0].t || words[0].word, true);
      lightStart = wordStartTime(words[0], capStart);
      topHeroObj = words[1];
      waistHeroObj = words[2];
    } else if (n === 2) {
      topHeroObj = words[0];
      waistHeroObj = words[1];
    } else {
      topHeroObj = words[0];
    }

    const topHeroText = topHeroObj ? cleanREToken(topHeroObj.t || topHeroObj.word, false) : '';
    const rawTopHeroSize = fitREFont(targetBehind, topHeroText || 'CAPTION', 900, H * 0.133, H * 0.064, W * 0.86, -0.035);
    const hasTopLead = Boolean(lightText || boldText);
    const leadRoomPx = hasTopLead ? Math.round(H * 0.056) : Math.round(H * 0.012);
    const crownPlace = computeBehindCrownPlacement(ctxFore, topHeroText || 'CAPTION', {
      fontFn: (sz) => `900 ${sz}px ${reFam}`,
      trackEm: ov.trackEmWith(-0.035),
      preferredSize: rawTopHeroSize,
      minSize: Math.round(H * 0.056),
      W,
      H,
      isSampleCard,
      fallbackCrownRatio: 0.275,
      overlapRatio: isTightCloseUp ? 0.18 : 0.28,
      safeTopRatio: 0.044,
      extraAbovePx: leadRoomPx
    });

    const topHeroFontSize = crownPlace.size;
    const topHeroBaseY = crownPlace.baseY;
    let topHeroW = Math.round(W * 0.56);
    if (topHeroText) {
      ctxFore.save();
      ctxFore.font = `900 ${topHeroFontSize}px ${reFam}`;
      if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${ov.trackEmWith(-0.035)}em`;
      topHeroW = Math.max(40, Math.round(measureREWidth(ctxFore, topHeroText, topHeroFontSize, ov.trackEmWith(-0.035))));
      ctxFore.restore();
    }

    // Automatically keep behind-head depth on wide shots, and promote to foreground
    // if close-up subject framing would hide > 36% of the hero word.
    const topAdaptive = chooseAdaptiveBehindTarget(
      ctxFore,
      targetBehind,
      true,
      heroX - topHeroW * 0.5,
      crownPlace.inkTopY,
      topHeroW,
      crownPlace.inkH,
      W,
      H,
      0.36
    );
    const topHeroCtx = topAdaptive.ctx;
    const behindOpacity = topAdaptive.promoted ? 0.94 : (isSampleCard ? 0.96 : (isBehind && ctxBehind ? 0.98 : 0.90));
    if (topHeroText) {
      drawMoltenHero(topHeroCtx, topHeroText, heroX, topHeroBaseY, topHeroFontSize, wordStartTime(topHeroObj, capStart + 0.22), 1.0, behindOpacity);
    }

    // Top flanking pair placed directly above Top Hero while respecting the top safe border.
    let lightFontSize = crownPlace.isTightHeadroom ? Math.round(H * 0.034) : Math.round(H * 0.039);
    let boldFontSize = crownPlace.isTightHeadroom ? Math.round(H * 0.050) : Math.round(H * 0.060);
    const leadMinTopBaseY = Math.round(H * 0.030 + Math.max(lightFontSize, boldFontSize) * 0.78);
    const rawLeadBaseY = Math.round(crownPlace.inkTopY - Math.max(H * 0.008, topHeroFontSize * 0.05) - (ov.lineSpacingMult - 1.0) * topHeroFontSize * 0.22);
    const topLeadBaseY = Math.max(leadMinTopBaseY, rawLeadBaseY);

    if (lightText && boldText) {
      const measurePair = (lfs, bfs) => {
        ctxFore.save();
        ctxFore.font = `400 ${lfs}px ${reFam}`;
        if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${ov.trackEmWith(-0.02)}em`;
        const lW = measureREWidth(ctxFore, lightText, lfs, -0.02);
        ctxFore.font = `800 ${bfs}px ${reFam}`;
        if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${ov.trackEmWith(-0.03)}em`;
        const bW = measureREWidth(ctxFore, boldText, bfs, -0.03);
        ctxFore.restore();
        return { lw: lW, bw: bW };
      };
      let gap = Math.round(W * 0.034);
      let dims = measurePair(lightFontSize, boldFontSize);
      const maxPairW = W * 0.86;
      if (dims.lw + gap + dims.bw > maxPairW && (dims.lw + gap + dims.bw) > 0) {
        const s = maxPairW / (dims.lw + gap + dims.bw);
        lightFontSize = Math.max(12, Math.floor(lightFontSize * s));
        boldFontSize = Math.max(16, Math.floor(boldFontSize * s));
        gap = Math.max(6, Math.floor(gap * s));
        dims = measurePair(lightFontSize, boldFontSize);
      }
      const startX = Math.round(heroX - (dims.lw + gap + dims.bw) * 0.5);
      drawCleanWhite(ctxFore, lightText, startX, topLeadBaseY, lightFontSize, 400, 'left', lightStart, 1.0, -0.02);
      drawCleanWhite(ctxFore, boldText, startX + dims.lw + gap, topLeadBaseY, boldFontSize, 800, 'left', boldStart, 1.0, -0.03);
    } else if (lightText || boldText) {
      const txt = boldText || lightText;
      const fs = fitREFont(ctxFore, txt, boldText ? 800 : 400, boldText ? boldFontSize : lightFontSize, Math.round(H * 0.022), W * 0.86, -0.025);
      const wt = boldText ? 800 : 400;
      const ts = boldText ? boldStart : lightStart;
      drawCleanWhite(ctxFore, txt, heroX, topLeadBaseY, fs, wt, 'center', ts, 1.0, -0.025);
    }

    // Lower Waist Molten Hero + Progressive White Supporting Tokens inside center
    if (waistHeroObj) {
      const wHeroText = cleanREToken(waistHeroObj.t || waistHeroObj.word, true);
      const wHeroSize = fitREFont(ctxFore, wHeroText, 900, H * 0.120, H * 0.060, W * 0.78, -0.038);
      const wHeroBaseY = Math.round(H * 0.614 + wHeroSize * 0.35 + (ov.lineSpacingMult - 1.0) * H * 0.026);
      drawMoltenHero(ctxFore, wHeroText, heroX, wHeroBaseY, wHeroSize, wordStartTime(waistHeroObj, capStart + 0.50), 1.0, 0.90);

      if (waistSmallObjs.length) {
        const smallSize = Math.round(H * 0.044);
        const smallBaseY = Math.round(H * 0.606 + smallSize * 0.32 + (ov.lineSpacingMult - 1.0) * H * 0.026);
        drawProgressiveTokenRow(ctxFore, waistSmallObjs, heroX, smallBaseY, smallSize, 700, -0.02, capStart + 0.42, true);
      }
    }
  } else if (modeIdx === 1) {
    // MODE 2: Mid-Torso Stack + Progressive Lead Row + Molten Hero ("this in One Click.")
    const topObj = words[0];
    const leadObjs = n >= 3 ? words.slice(1, n - 1) : [];
    const endHeroObj = n >= 2 ? words[n - 1] : null;

    if (topObj) {
      const topTxt = cleanREToken(topObj.t || topObj.word, false);
      const topSize = fitREFont(ctxFore, topTxt, 800, H * 0.092, H * 0.050, W * 0.72, -0.03);
      const topX = isTightCloseUp ? heroX : Math.round(W * 0.44);
      drawCleanWhite(ctxFore, topTxt, topX, Math.round(H * 0.548 - (ov.lineSpacingMult - 1.0) * H * 0.026), topSize, 800, 'center', wordStartTime(topObj, capStart), 1.0, -0.03);
    }

    const endHeroTxt = endHeroObj ? cleanREToken(endHeroObj.t || endHeroObj.word, true) : '';
    const endHeroStart = endHeroObj ? wordStartTime(endHeroObj, capStart + 0.35) : capStart;
    const leadItems = leadObjs.map((w, idx) => ({
      txt: cleanREToken(w.t || w.word || '', true),
      start: wordStartTime(w, capStart + 0.14 + idx * 0.10)
    })).filter(it => Boolean(it.txt));

    let leadSize = Math.round(H * 0.034);
    let fierySize = fitREFont(ctxFore, endHeroTxt || 'Click.', 900, H * 0.064, H * 0.040, W * 0.62, -0.035);
    const rowBaseY = Math.round(H * 0.610 + (ov.lineSpacingMult - 1.0) * H * 0.026);

    if (leadItems.length && endHeroTxt) {
      const fullLeadStr = leadItems.map(it => it.txt).join(' ');
      const measureCombinedRow = (ls, fs) => {
        ctxFore.save();
        ctxFore.font = `400 ${ls}px ${reFam}`;
        if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${ov.trackEmWith(-0.02)}em`;
        const lwVal = measureREWidth(ctxFore, fullLeadStr, ls, ov.trackEmWith(-0.02));
        ctxFore.font = `900 ${fs}px ${reFam}`;
        if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${ov.trackEmWith(-0.035)}em`;
        const fwVal = measureREWidth(ctxFore, endHeroTxt, fs, ov.trackEmWith(-0.035));
        ctxFore.restore();
        return { lw: lwVal, fw: fwVal };
      };
      let gap = Math.round(W * 0.024);
      let dims = measureCombinedRow(leadSize, fierySize);
      const maxRowW = W * 0.86;
      // Split into 2 clean rows if too many words would shrink typography below readable scale.
      if (leadItems.length >= 4 || (dims.lw + gap + dims.fw > maxRowW * 1.32)) {
        drawProgressiveTokenRow(ctxFore, leadObjs, heroX, Math.round(H * 0.594), leadSize, 400, -0.02, capStart + 0.14, true);
        drawMoltenHero(ctxFore, endHeroTxt, heroX, Math.round(H * 0.664), fierySize, endHeroStart, 1.0, 0.90);
      } else {
        if (dims.lw + gap + dims.fw > maxRowW && (dims.lw + gap + dims.fw) > 0) {
          const s = maxRowW / (dims.lw + gap + dims.fw);
          leadSize = Math.max(12, Math.floor(leadSize * s));
          fierySize = Math.max(Math.round(H * 0.032), Math.floor(fierySize * s));
          gap = Math.max(6, Math.floor(gap * s));
          dims = measureCombinedRow(leadSize, fierySize);
        }
        const leftEdge = Math.round(heroX - (dims.lw + gap + dims.fw) * 0.5);
        ctxFore.save();
        ctxFore.font = `400 ${leadSize}px ${reFam}`;
        if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${ov.trackEmWith(-0.02)}em`;
        const spW = Math.max(Math.round(leadSize * 0.28), measureREWidth(ctxFore, ' ', leadSize, ov.trackEmWith(-0.02)));
        const widths = leadItems.map(it => measureREWidth(ctxFore, it.txt, leadSize, ov.trackEmWith(-0.02)));
        ctxFore.restore();
        let curX = leftEdge;
        leadItems.forEach((it, idx) => {
          drawCleanWhite(ctxFore, it.txt, curX, rowBaseY, leadSize, 400, 'left', it.start, 1.0, -0.02);
          curX += Math.round(widths[idx] + spW);
        });
        const fieryX = Math.round(leftEdge + dims.lw + gap + dims.fw * 0.5);
        drawMoltenHero(ctxFore, endHeroTxt, fieryX, rowBaseY, fierySize, endHeroStart, 1.0, 0.90);
      }
    } else if (leadItems.length) {
      drawProgressiveTokenRow(ctxFore, leadObjs, heroX, rowBaseY, leadSize, 400, -0.02, capStart + 0.14, true);
    } else if (endHeroTxt) {
      drawMoltenHero(ctxFore, endHeroTxt, heroX, rowBaseY, fierySize, endHeroStart, 1.0, 0.90);
    }
  } else {
    // MODE 3: Flanking Edge Frame + Balanced Molten Centerpiece ("first, go to Whitestair.com" / "and see your Sales Skyrocket.")
    let leftObj = null, rightObj = null, tailObj = null, centerWords = [];
    if (n >= 4) {
      leftObj = words[0];
      rightObj = words[1];
      tailObj = words[2];
      centerWords = words.slice(3);
    } else if (n === 3) {
      leftObj = words[0];
      rightObj = words[1];
      centerWords = [words[2]];
    } else if (n === 2) {
      leftObj = words[0];
      centerWords = [words[1]];
    } else {
      centerWords = [words[0]];
    }

    const edgeInset = isTightCloseUp ? 0.088 : 0.075;
    const leftEdgeX = Math.round(W * edgeInset);
    const rightEdgeX = Math.round(W * (1 - edgeInset));
    const flankSize = Math.round(H * 0.032);
    const topFlankBaseY = Math.round(H * 0.456);

    if (leftObj) {
      const lTxt = cleanREToken(leftObj.t || leftObj.word, true);
      const lFs = fitREFont(ctxFore, lTxt, 400, flankSize, Math.round(H * 0.021), W * 0.38, -0.02);
      drawCleanWhite(ctxFore, lTxt, leftEdgeX, topFlankBaseY, lFs, 400, 'left', wordStartTime(leftObj, capStart), 1.0, -0.02);
    }
    if (rightObj) {
      const rTxt = cleanREToken(rightObj.t || rightObj.word, true);
      const rFs = fitREFont(ctxFore, rTxt, 400, flankSize, Math.round(H * 0.021), W * 0.38, -0.02);
      drawCleanWhite(ctxFore, rTxt, rightEdgeX, topFlankBaseY, rFs, 400, 'right', wordStartTime(rightObj, capStart + 0.08), 1.0, -0.02);
    }
    if (tailObj) {
      const tTxt = cleanREToken(tailObj.t || tailObj.word, true);
      const tailSize = fitREFont(ctxFore, tTxt, 800, H * 0.045, Math.round(H * 0.024), W * 0.42, -0.025);
      drawCleanWhite(ctxFore, tTxt, rightEdgeX, Math.round(H * 0.642), tailSize, 800, 'right', wordStartTime(tailObj, capStart + 0.16), 1.0, -0.025);
    }

    const centerItems = centerWords.map((w, idx) => ({
      txt: cleanREToken(w.t || w.word || '', true),
      start: wordStartTime(w, capStart + 0.16 + idx * 0.09)
    })).filter(it => Boolean(it.txt));

    if (centerItems.length) {
      const fullCenter = centerItems.map(it => it.txt).join(' ');
      const idealCenterSize = Math.round(H * 0.074);
      ctxFore.save();
      ctxFore.font = `900 ${idealCenterSize}px ${reFam}`;
      if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${ov.trackEmWith(-0.035)}em`;
      const rawCenterW = measureREWidth(ctxFore, fullCenter, idealCenterSize, ov.trackEmWith(-0.035));
      ctxFore.restore();

      const lines = [];
      if (centerItems.length >= 2 && rawCenterW > W * 0.84) {
        const splitAt = Math.ceil(centerItems.length / 2);
        lines.push(centerItems.slice(0, splitAt));
        lines.push(centerItems.slice(splitAt));
      } else {
        lines.push(centerItems);
      }

      const rowGapPx = Math.round(H * 0.068);
      const startRowY = lines.length === 2 ? Math.round(H * 0.514) : Math.round(H * 0.532);
      lines.forEach((lineItems, lineIdx) => {
        const lineStr = lineItems.map(it => it.txt).join(' ');
        const lineFs = fitREFont(ctxFore, lineStr, 900, H * (lines.length === 2 ? 0.064 : 0.076), H * 0.036, W * 0.84, -0.035);
        const lineY = startRowY + lineIdx * rowGapPx;
        ctxFore.save();
        ctxFore.font = `900 ${lineFs}px ${reFam}`;
        if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${ov.trackEmWith(-0.035)}em`;
        const spW = Math.max(Math.round(lineFs * 0.25), measureREWidth(ctxFore, ' ', lineFs, ov.trackEmWith(-0.035)));
        const widths = lineItems.map(it => measureREWidth(ctxFore, it.txt, lineFs, ov.trackEmWith(-0.035)));
        ctxFore.restore();
        const totalLineW = widths.reduce((a, b) => a + b, 0) + spW * Math.max(0, lineItems.length - 1);
        let curX = Math.round(heroX - totalLineW * 0.5);
        lineItems.forEach((it, idx) => {
          const itemCenterX = Math.round(curX + widths[idx] * 0.5);
          drawMoltenHero(ctxFore, it.txt, itemCenterX, lineY, lineFs, it.start, 1.0, 0.90);
          curX += Math.round(widths[idx] + spW);
        });
      });
    }
  }
}

function drawElectricKineticStackPass(ctxFore, cap, words, t, st, W, H, showAll, isPreview) {
  if (!words || !words.length) return;
  const ov = resolveSceneStyleOverrides(st, H);
  const ekFam = ov.pickFontFam('"Montserrat", "Inter", sans-serif');
  const ekHi = ov.pickHi('#F0D314');
  const ekBase = ov.pickBase('#FFFFFF');
  const ekFontScale = Math.max(0.5, Math.min(2.0, Number(st?.fontScale) || 1.0));
  const ekUserCase = st && st.textCase;

  const isSampleCard = Boolean(cap && cap.id === 'preview_sample');
  const capStart = (cap && typeof cap.start === 'number') ? cap.start : (words[0] && typeof words[0].s === 'number' ? words[0].s : 0);
  const capEnd = (cap && typeof cap.end === 'number') ? cap.end : (words[words.length - 1] && typeof words[words.length - 1].e === 'number' ? words[words.length - 1].e : capStart + 2.5);
  const hasValidT = (typeof t === 'number' && !isNaN(t));
  const evalT = isSampleCard ? (capStart + 999) : (hasValidT ? t : (capStart + 1.0));
  const fullInstant = isSampleCard || !hasValidT || Boolean(showAll && evalT <= capStart + 0.04);

  const timeRem = fullInstant ? 1.0 : Math.max(0, capEnd - evalT);
  const exitAlpha = fullInstant ? 1.0 : Math.min(1, timeRem / 0.06);
  if (exitAlpha <= 0.005) return;

  const capsList = (typeof S !== 'undefined' && S && Array.isArray(S.captions)) ? S.captions : [];
  const foundIdx = (cap && capsList.length > 0) ? capsList.indexOf(cap) : -1;
  const capIdx = foundIdx >= 0
    ? foundIdx
    : (cap && typeof cap.index === 'number' && cap.index > 0 ? cap.index - 1 : 0);
  const isRightAligned = !isSampleCard && (capIdx % 2 === 1);

  const cleanET = (raw) => String(raw || '').replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'’]/g, '').trim();
  const wordStartTime = (w, fallback) => {
    if (w && typeof w.s === 'number') return w.s;
    if (w && typeof w.start === 'number') return w.start;
    return fallback;
  };
  const easeOutCubic = (x) => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);

  const measureEKWidth = (ctx, text, fontSize, trackEm) => {
    const m = ctx.measureText(text);
    const w = (m && typeof m.width === 'number') ? m.width : String(text || '').length * fontSize * 0.56;
    if ('letterSpacing' in ctx) return w;
    return Math.max(0, w + Math.max(0, String(text || '').length - 1) * fontSize * (trackEm || 0));
  };

  const fitEKFont = (ctx, text, weight, idealPx, minPx, maxW, trackEm) => {
    let px = Math.round(idealPx);
    if (!text) return px;
    ctx.save();
    ctx.font = `${weight} ${px}px ${ekFam}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${trackEm}em`;
    const rawW = measureEKWidth(ctx, text, px, trackEm);
    ctx.restore();
    if (rawW > maxW && rawW > 0) {
      px = Math.max(Math.round(minPx), Math.floor(px * (maxW / rawW)));
    }
    return px;
  };
  const applyEKCase = (str, defLower) => {
    if (ekUserCase === 'upper') return str.toUpperCase();
    if (ekUserCase === 'lower') return str.toLowerCase();
    if (ekUserCase === 'title') return str.replace(/\b\w/g, (c) => c.toUpperCase());
    if (ekUserCase === 'asIs') return str;
    return defLower ? str.toLowerCase() : str.toUpperCase();
  };

  let line1Text = '';
  let line2Text = '';
  let line3Text = '';
  let line1Start = capStart;
  let line2Start = capStart + 0.35;
  let line3Start = capStart + 0.70;

  if (isSampleCard) {
    line1Text = applyEKCase('BUILD', false);
    line2Text = applyEKCase('INTENT', false);
    line3Text = applyEKCase('daily', true);
  } else if (words.length >= 3) {
    line1Text = applyEKCase(cleanET(words[0].t || words[0].word), false);
    line2Text = applyEKCase(cleanET(words[1].t || words[1].word), false);
    line3Text = applyEKCase(words.slice(2).map(w => cleanET(w.t || w.word)).filter(Boolean).join(' '), true);
    line1Start = wordStartTime(words[0], capStart);
    line2Start = wordStartTime(words[1], line1Start + 0.35);
    line3Start = wordStartTime(words[2], line2Start + 0.35);
  } else if (words.length === 2) {
    line1Text = applyEKCase(cleanET(words[0].t || words[0].word), false);
    line3Text = applyEKCase(cleanET(words[1].t || words[1].word), true);
    line1Start = wordStartTime(words[0], capStart);
    line3Start = wordStartTime(words[1], line1Start + 0.35);
  } else {
    line1Text = applyEKCase(cleanET(words[0].t || words[0].word), false);
    line1Start = wordStartTime(words[0], capStart);
  }

  const trk12 = ov.trackEmWith(-0.025);
  const trk3 = ov.trackEmWith(-0.040);
  const l1FontSize = fitEKFont(ctxFore, line1Text, 800, H * 0.050 * ekFontScale, H * 0.028, W * 0.62, trk12);
  const l2FontSize = fitEKFont(ctxFore, line2Text, 800, H * 0.050 * ekFontScale, H * 0.028, W * 0.68, trk12);
  const l3FontSize = fitEKFont(ctxFore, line3Text, 900, H * 0.072 * ekFontScale, H * 0.036, W * 0.76, trk3);

  // Measure actual widths for crisp viewport-safe staggering
  const getW = (txt, wt, px, trk) => {
    if (!txt) return 0;
    ctxFore.save();
    ctxFore.font = `${wt} ${px}px ${ekFam}`;
    if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${trk}em`;
    const w = measureEKWidth(ctxFore, txt, px, trk);
    ctxFore.restore();
    return w;
  };
  const w1 = getW(line1Text, 800, l1FontSize, trk12);
  const w2 = getW(line2Text, 800, l2FontSize, trk12);
  const w3 = getW(line3Text, 900, l3FontSize, trk3);

  const ekPosRatio = (typeof st?.posY === 'number') ? st.posY : ((typeof st?.position === 'number') ? st.position : 0.775);
  const l1BaseY = Math.round(H * ekPosRatio);
  const l2BaseY = Math.round(l1BaseY + l1FontSize * 0.88 * ov.lineSpacingMult);
  const l3BaseY = line2Text
    ? Math.round(l2BaseY + l3FontSize * 0.68 * ov.lineSpacingMult)
    : Math.round(l1BaseY + l3FontSize * 0.74 * ov.lineSpacingMult);
  ov.recordSceneBox(cap, W, H, W * 0.14, l1BaseY - l1FontSize, W * 0.72, (l3BaseY - l1BaseY) + l3FontSize * 1.3);

  let x1, x2, x3, alignMode;
  if (isRightAligned) {
    // Odd captions: right-aligned cascade (stair-left edge expansion like CLEAN / CHOICES / compound)
    alignMode = 'right';
    const minNeededX = Math.round(Math.max(w1, w2, w3) + W * 0.08);
    const rightAnchor = Math.min(Math.round(W * 0.90), Math.max(Math.round(W * 0.74), minNeededX));
    x1 = rightAnchor;
    x2 = rightAnchor;
    x3 = rightAnchor;
  } else {
    // Even captions: staggered left-to-right staircase (like BUILD / INTENT / daily & EVERY / FRAME / matters)
    alignMode = 'left';
    x1 = Math.round(W * 0.25);
    const idealX2 = Math.round(x1 + W * 0.075);
    x2 = Math.max(Math.round(W * 0.10), Math.min(idealX2, Math.round(W * 0.92 - w2)));
    const idealX3 = line2Text ? Math.round(x2 + W * 0.045) : Math.round(x1 + W * 0.075);
    x3 = Math.max(Math.round(W * 0.10), Math.min(idealX3, Math.round(W * 0.92 - w3)));
  }

  const drawKineticLine = (txt, wt, px, trk, xPos, baseY, color, startTime, slideDistPx) => {
    if (!txt) return;
    if (!fullInstant && evalT < startTime - 0.02) return;
    const age = fullInstant ? 1.0 : Math.max(0, evalT - startTime);
    const p = fullInstant ? 1.0 : Math.min(1.0, age / 0.15);
    const ep = easeOutCubic(p);
    const alpha = exitAlpha * ep;
    if (alpha <= 0.01) return;

    const blurPx = fullInstant ? 0 : Math.round(6.5 * Math.pow(1 - p, 2) * 10) / 10;
    const dy = fullInstant ? 0 : Math.round(slideDistPx * Math.pow(1 - p, 2));

    ctxFore.save();
    try {
      ctxFore.globalAlpha = alpha;
      if (blurPx > 0.2 && 'filter' in ctxFore) ctxFore.filter = `blur(${blurPx.toFixed(1)}px)`;
      ctxFore.font = `${wt} ${px}px ${ekFam}`;
      ctxFore.textAlign = alignMode;
      ctxFore.textBaseline = 'alphabetic';
      if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${trk}em`;
      ov.applyGlow(ctxFore, 'rgba(0, 0, 0, 0.45)', Math.max(3, Math.round(H * 0.006)), 1);
      ctxFore.shadowOffsetX = 0;
      ctxFore.shadowOffsetY = Math.round(H * 0.002);
      ctxFore.fillStyle = color;
      ctxFore.fillText(txt, xPos, baseY + dy);
    } finally {
      if ('filter' in ctxFore) ctxFore.filter = 'none';
      ctxFore.restore();
    }
  };

  drawKineticLine(line1Text, 800, l1FontSize, trk12, x1, l1BaseY, ekHi, line1Start, 8);
  if (line2Text) drawKineticLine(line2Text, 800, l2FontSize, trk12, x2, l2BaseY, ekBase, line2Start, 10);
  if (line3Text) drawKineticLine(line3Text, 900, l3FontSize, trk3, x3, l3BaseY, ekBase, line3Start, 14);
}

function drawCrazySunsetStackPass(ctxFore, cap, words, t, st, W, H, showAll, isPreview) {
  if (!ctxFore || !words || !words.length) return;

  const isSampleCard = Boolean(cap && cap.id === 'preview_sample');
  const capStart = (cap && typeof cap.start === 'number') ? cap.start : (words[0] && typeof words[0].s === 'number' ? words[0].s : 0);
  const capEnd = (cap && typeof cap.end === 'number') ? cap.end : (words[words.length - 1] && typeof words[words.length - 1].e === 'number' ? words[words.length - 1].e : capStart + 2.5);
  const hasValidT = (typeof t === 'number' && !isNaN(t));
  const evalT = isSampleCard ? (capStart + 999) : (hasValidT ? t : (capStart + 1.0));
  const fullInstant = isSampleCard || !hasValidT || Boolean(showAll && evalT <= capStart + 0.04);

  const timeRem = fullInstant ? 1.0 : Math.max(0, capEnd - evalT);
  const exitFade = fullInstant ? 1.0 : Math.min(1, timeRem / 0.08);
  if (exitFade <= 0.005) return;

  const capsList = (typeof S !== 'undefined' && S && Array.isArray(S.captions)) ? S.captions : [];
  const foundIdx = (cap && capsList.length > 0) ? capsList.indexOf(cap) : -1;
  const rawIdx = (cap && cap.index != null) ? Number(cap.index) - 1 : parseInt(cap && cap.id, 10) - 1;
  const capIdx = foundIdx >= 0 ? foundIdx : (!isNaN(rawIdx) && rawIdx >= 0 ? rawIdx : 0);

  const userCase = st && st.textCase;
  const formatCSToken = (raw) => {
    const s = String(raw || '').replace(/["'’()[\]{}]/g, '').trim();
    if (!s) return '';
    if (userCase === 'upper') return s.toUpperCase();
    if (userCase === 'lower') return s.toLowerCase();
    return s.replace(/^([a-zA-Z])/, (c) => c.toUpperCase());
  };
  const wordStartTime = (w, fallback) => {
    if (w && typeof w.s === 'number') return w.s;
    if (w && typeof w.start === 'number') return w.start;
    return fallback;
  };
  const easeOutCubic = (x) => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);

  const measureCSWidth = (ctx, text, fontSize, trackEm) => {
    if (!text) return 0;
    const m = ctx.measureText(text);
    const w = (m && typeof m.width === 'number') ? m.width : text.length * fontSize * 0.56;
    if ('letterSpacing' in ctx) return w;
    return Math.max(0, w + Math.max(0, text.length - 1) * fontSize * (trackEm || 0));
  };
  const fitCSFont = (ctx, text, fontFamily, weight, italic, idealPx, minPx, maxW, trackEm) => {
    let size = Math.round(idealPx);
    if (!text) return size;
    ctx.save();
    ctx.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${fontFamily}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${trackEm || 0}em`;
    const rawW = measureCSWidth(ctx, text, size, trackEm);
    ctx.restore();
    if (rawW > maxW && rawW > 0) {
      size = Math.max(Math.round(minPx), Math.floor(size * (maxW / rawW)));
    }
    return size;
  };

  // Determine hero range ([heroStartIdx..heroEndIdx]): honors contiguous .key flags (1-2 words) or scores best content word
  let keyStart = -1;
  let keyEnd = -1;
  for (let i = 0; i < words.length; i++) {
    if (words[i] && words[i].key) {
      if (keyStart === -1) keyStart = i;
      if (i - keyStart <= 1) keyEnd = i;
    } else if (keyStart !== -1) {
      break;
    }
  }
  if (keyStart === -1) {
    const stopSet = new Set(['a', 'an', 'the', 'to', 'in', 'on', 'at', 'of', 'for', 'with', 'and', 'or', 'are', 'you', 'our', 'we', 'your', 'is', 'be', 'it', 'see', 'this', 'that']);
    let bestScore = -999;
    let bestIdx = Math.min(words.length - 1, Math.floor(words.length / 2));
    for (let i = 0; i < words.length; i++) {
      const raw = String(words[i].t || words[i].word || '').trim();
      const alpha = raw.replace(/[^a-zA-Z0-9]/g, '');
      const low = alpha.toLowerCase();
      const midBonus = (words.length >= 3 && i === 1) ? 0.45 : 0;
      const punctBonus = /[?!]$/.test(raw) ? 3 : 0;
      const score = alpha.length * 2 - (stopSet.has(low) ? 10 : 0) + punctBonus + midBonus;
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    keyStart = bestIdx;
    keyEnd = bestIdx;
  }

  const topWords = isSampleCard ? [{ t: 'Are', s: 0 }, { t: 'You', s: 0 }] : words.slice(0, keyStart);
  const heroWords = isSampleCard ? [{ t: 'Ready', s: 0, key: true }] : words.slice(keyStart, keyEnd + 1);
  const botWords = isSampleCard ? [] : words.slice(keyEnd + 1);

  const heroText = heroWords.map(w => formatCSToken(w.t || w.word || '')).filter(Boolean).join(' ');
  const topText = topWords.map(w => formatCSToken(w.t || w.word || '')).filter(Boolean).join(' ');
  const botText = botWords.map(w => formatCSToken(w.t || w.word || '')).filter(Boolean).join(' ');

  const heroStart = wordStartTime(heroWords[0], topWords.length ? capStart + 0.42 : capStart);
  const topStart = topWords.length ? wordStartTime(topWords[0], capStart) : capStart;
  const botStart = botWords.length ? wordStartTime(botWords[0], heroStart + 0.48) : (heroStart + 0.48);

  const ov = resolveSceneStyleOverrides(st, H);
  const posYRatio = (typeof st?.posY === 'number') ? st.posY : ((typeof st?.position === 'number') ? st.position : 0.702);
  const fontScale = Math.max(0.5, Math.min(2.0, Number(st?.fontScale) || 1.0));
  const centerX = Math.round(W * 0.50);
  const heroFontFam = ov.pickFontFam('"Montserrat", "Poppins", sans-serif');
  const subFontFam = ov.pickFontFam('"Poppins", "Montserrat", sans-serif');
  const hTrk = ov.trackEmWith(-0.025);
  const sTrk = ov.trackEmWith(-0.015);

  const heroSize = fitCSFont(ctxFore, heroText, heroFontFam, 900, false, H * 0.128 * fontScale, H * 0.044, W * 0.88, hTrk);
  const idealSub = Math.max(H * 0.035, Math.min(H * 0.055, heroSize * 0.47));
  const topSize = topText ? fitCSFont(ctxFore, topText, subFontFam, 800, true, idealSub, H * 0.024, W * 0.84, sTrk) : 0;
  const botSize = botText ? fitCSFont(ctxFore, botText, subFontFam, 800, true, idealSub, H * 0.024, W * 0.84, sTrk) : 0;

  ctxFore.save();
  ctxFore.font = `900 ${heroSize}px ${heroFontFam}`;
  if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${hTrk}em`;
  const heroW = measureCSWidth(ctxFore, heroText, heroSize, hTrk);
  ctxFore.restore();

  // Compute balanced center anchor for 1/2/3-tier stack around posYRatio
  const heroCapH = Math.round(heroSize * 0.73);
  let heroCenterOffsetY = 0;
  if (topText && !botText) heroCenterOffsetY = Math.round(topSize * 0.34);
  else if (!topText && botText) heroCenterOffsetY = -Math.round(botSize * 0.28);
  const heroBaseY = Math.round(H * posYRatio + heroCapH * 0.48 + heroCenterOffsetY);
  const heroTopY = heroBaseY - heroCapH;

  // Tight interlocking offsets scaled cleanly by lineSpacingMult
  const spGap = (ov.lineSpacingMult - 1.0) * heroSize * 0.35;
  const perchedTopBaseY = Math.round(heroTopY + heroSize * 0.055 - spGap);
  const preHeroCenterY = Math.round(H * posYRatio + topSize * 0.24);
  const glideUpP = fullInstant ? 1.0 : (evalT >= heroStart - 0.04 ? easeOutCubic(Math.min(1, (evalT - (heroStart - 0.04)) / 0.16)) : 0);
  const topBaseY = Math.round(preHeroCenterY + (perchedTopBaseY - preHeroCenterY) * glideUpP);
  const botBaseY = Math.round(heroBaseY + botSize * 0.70 * ov.lineSpacingMult);
  ov.recordSceneBox(cap, W, H, centerX - Math.max(W * 0.30, heroW * 0.55), heroTopY - topSize * 1.1, Math.max(W * 0.60, heroW * 1.1), heroCapH + topSize * 1.4 + botSize * 1.4);

  // Helper to paint crisp white italic accent line with soft optical unblur & drop shadow
  const drawSubItalicLine = (text, startTime, targetBaseY, size) => {
    if (!text) return;
    if (!fullInstant && evalT < startTime - 0.02) return;
    const p = fullInstant ? 1.0 : Math.min(1, Math.max(0, (evalT - startTime) / 0.16));
    const ep = easeOutCubic(p);
    const alpha = exitFade * Math.min(1, p * 1.35);
    if (alpha <= 0.01) return;

    const blurPx = fullInstant ? 0 : Math.round(4.0 * Math.pow(1 - p, 2) * 10) / 10;
    const scale = fullInstant ? 1.0 : (1.06 - 0.06 * ep);

    ctxFore.save();
    try {
      ctxFore.globalAlpha = alpha;
      if (blurPx > 0.2 && 'filter' in ctxFore) ctxFore.filter = `blur(${blurPx.toFixed(1)}px)`;
      ctxFore.font = `italic 800 ${size}px ${subFontFam}`;
      if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${sTrk}em`;
      ctxFore.textAlign = 'center';
      ctxFore.textBaseline = 'alphabetic';

      const midY = targetBaseY - size * 0.30;
      ctxFore.translate(centerX, midY);
      ctxFore.scale(scale, scale);
      ctxFore.translate(-centerX, -midY);

      ov.applyGlow(ctxFore, 'rgba(0, 0, 0, 0.72)', Math.max(4, Math.round(H * 0.008)), 1);
      ctxFore.shadowOffsetX = 0;
      ctxFore.shadowOffsetY = Math.max(2, Math.round(H * 0.002));
      ctxFore.fillStyle = ov.pickBase('#FFFFFF');
      ctxFore.fillText(text, centerX, targetBaseY);
    } finally {
      if ('filter' in ctxFore) ctxFore.filter = 'none';
      ctxFore.restore();
    }
  };

  // 1. Paint Giant Sunset Diagonal Wave Hero FIRST so small white italic lines lock cleanly in front
  if (heroText && (fullInstant || evalT >= heroStart - 0.03)) {
    const p = fullInstant ? 1.0 : Math.min(1, Math.max(0, (evalT - (heroStart - 0.02)) / 0.16));
    const ep = easeOutCubic(p);
    const alpha = exitFade * ep;
    if (alpha > 0.01) {
      const blurPx = fullInstant ? 0 : Math.round(5.0 * Math.pow(1 - p, 2) * 10) / 10;
      const scale = fullInstant ? 1.0 : (0.91 + 0.09 * ep);
      const midY = heroBaseY - heroSize * 0.34;
      const boxW = Math.max(W * 0.28, heroW);
      const phase = fullInstant ? 0 : Math.sin(evalT * 2.1 + capIdx * 1.3) * 0.04;

      ctxFore.save();
      try {
        ctxFore.globalAlpha = alpha;
        if (blurPx > 0.2 && 'filter' in ctxFore) ctxFore.filter = `blur(${blurPx.toFixed(1)}px)`;
        ctxFore.font = `900 ${heroSize}px ${heroFontFam}`;
        if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${hTrk}em`;
        ctxFore.textAlign = 'center';
        ctxFore.textBaseline = 'alphabetic';

        ctxFore.translate(centerX, midY);
        ctxFore.scale(scale, scale);
        ctxFore.translate(-centerX, -midY);

        const grad = ctxFore.createLinearGradient(
          centerX - boxW * 0.56,
          heroBaseY - heroSize * 0.84,
          centerX + boxW * 0.56,
          heroBaseY + heroSize * 0.22
        );
        const clampS = (v) => Math.max(0.02, Math.min(0.98, v));
        grad.addColorStop(0.00, '#FF5800');
        grad.addColorStop(clampS(0.18 + phase), '#FFCC42');
        grad.addColorStop(clampS(0.35 - phase * 0.5), '#FFE86E');
        grad.addColorStop(clampS(0.54 + phase), '#FF6A02');
        grad.addColorStop(clampS(0.73 - phase * 0.5), '#FFE262');
        grad.addColorStop(clampS(0.89 + phase * 0.4), '#FF7D0C');
        grad.addColorStop(1.00, '#EC4A00');

        ov.applyGlow(ctxFore, 'rgba(0, 0, 0, 0.46)', Math.max(4, Math.round(H * 0.007)), 1);
        ctxFore.shadowOffsetX = 0;
        ctxFore.shadowOffsetY = Math.max(2, Math.round(H * 0.003));
        ctxFore.fillStyle = ov.customHighlight || grad;
        ctxFore.fillText(heroText, centerX, heroBaseY);
      } finally {
        if ('filter' in ctxFore) ctxFore.filter = 'none';
        ctxFore.restore();
      }
    }
  }

  // 2. Paint Small White Italic Lines OVER Sunset Hero Edges
  drawSubItalicLine(topText, topStart, topBaseY, topSize);
  drawSubItalicLine(botText, botStart, botBaseY, botSize);
}

function drawPrismGlassDepthPass(ctxFore, ctxBehind, cap, words, t, st, W, H, isBehind, showAll, isPreview) {
  if (!ctxFore || !words || !words.length) return;

  const isSampleCard = Boolean(cap && cap.id === 'preview_sample');
  const capStart = (cap && typeof cap.start === 'number') ? cap.start : (words[0] && typeof words[0].s === 'number' ? words[0].s : 0);
  const capEnd = (cap && typeof cap.end === 'number') ? cap.end : (words[words.length - 1] && typeof words[words.length - 1].e === 'number' ? words[words.length - 1].e : capStart + 2.5);
  const hasValidT = (typeof t === 'number' && !isNaN(t));
  const evalT = isSampleCard ? (capStart + 999) : (hasValidT ? t : (capStart + 1.0));
  const fullInstant = isSampleCard || !hasValidT || Boolean(showAll && evalT <= capStart + 0.04);

  const timeRem = fullInstant ? 1.0 : Math.max(0, capEnd - evalT);
  const exitFade = fullInstant ? 1.0 : Math.min(1, timeRem / 0.12);
  if (exitFade <= 0.005) return;

  const targetBehind = (isBehind && ctxBehind) ? ctxBehind : ctxFore;
  const capsList = (typeof S !== 'undefined' && S && Array.isArray(S.captions)) ? S.captions : [];
  const foundIdx = (cap && capsList.length > 0) ? capsList.indexOf(cap) : -1;
  const rawIdx = (cap && cap.index != null) ? Number(cap.index) - 1 : parseInt(cap && cap.id, 10) - 1;
  const capIdx = foundIdx >= 0 ? foundIdx : (!isNaN(rawIdx) && rawIdx >= 0 ? rawIdx : 0);

  const userCase = st && st.textCase;
  const cleanTok = (raw, keepPunct) => {
    const s = String(raw || '').replace(/["'’()[\]{}]/g, '').trim();
    const out = keepPunct ? s.replace(/[:;]+$/g, '') : s.replace(/[.,!?;:]+$/g, '');
    if (userCase === 'upper') return out.toUpperCase();
    if (userCase === 'lower') return out.toLowerCase();
    return out;
  };
  const wordStartTime = (w, fallback) => {
    if (w && typeof w.s === 'number') return w.s;
    if (w && typeof w.start === 'number') return w.start;
    return fallback;
  };
  const easeOutCubic = (x) => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);

  const measurePGWidth = (ctx, text, fontSize, trackEm) => {
    if (!text) return 0;
    const m = ctx.measureText(text);
    const w = (m && typeof m.width === 'number') ? m.width : text.length * fontSize * 0.56;
    if ('letterSpacing' in ctx) return w;
    return Math.max(0, w + Math.max(0, text.length - 1) * fontSize * (trackEm || 0));
  };
  const fitPGFont = (ctx, text, fontStrFn, idealPx, minPx, maxW, trackEm) => {
    let size = Math.round(idealPx);
    if (!text) return size;
    ctx.save();
    ctx.font = fontStrFn(size);
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${trackEm || 0}em`;
    const rawW = measurePGWidth(ctx, text, size, trackEm);
    ctx.restore();
    if (rawW > maxW && rawW > 0) {
      size = Math.max(Math.round(minPx), Math.floor(size * (maxW / rawW)));
    }
    return size;
  };
  const drawRoundRectPath = (ctx, x, y, w, h, r) => {
    const rad = Math.min(r, w * 0.5, h * 0.5);
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, w, h, rad);
      return;
    }
    ctx.moveTo(x + rad, y);
    ctx.lineTo(x + w - rad, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
    ctx.lineTo(x + w, y + h - rad);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
    ctx.lineTo(x + rad, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
    ctx.lineTo(x, y + rad);
    ctx.quadraticCurveTo(x, y, x + rad, y);
    ctx.closePath();
  };
  const isMultiplierNum = (raw) => {
    const cl = String(raw || '').replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'’]/g, '');
    return /^\$?\d[\d,.]*(?:x|k|m|b|cr|%)?$/i.test(cl);
  };
  const pickBestHeroIdx = (arr) => {
    const stopSet = new Set(['a', 'an', 'the', 'to', 'at', 'in', 'on', 'of', 'for', 'with', 'and', 'or', 'your', 'you', 'this', 'one', 'that', 'they', 'how', 'starts', 'here', 'pure']);
    let bestI = 0;
    let bestScore = -999;
    for (let i = 0; i < arr.length; i++) {
      if (!arr[i]) continue;
      const cl = cleanTok(arr[i].t || arr[i].word || '', false);
      const s = cl.length * 2 + (arr[i].key ? 200 : 0) - (stopSet.has(cl.toLowerCase()) ? 14 : 0);
      if (s > bestScore) { bestScore = s; bestI = i; }
    }
    return bestI;
  };

  // Dynamic head-crown alignment (places behind word via computeBehindCrownPlacement with ~10% overlap)
  const heroX = Math.round(W * 0.50);
  const fontScale = Math.max(0.5, Math.min(2.0, Number(st?.fontScale) || 1.0));
  const ov = resolveSceneStyleOverrides(st, H);
  const posY = (y) => Math.round(y + ov.posDeltaY);
  const foreY = (ratio, rowIdx, lineStep) => posY(H * ratio + (rowIdx || 0) * (lineStep || 0) * (ov.lineSpacingMult - 1.0));

  const numIdx = words.findIndex(w => isMultiplierNum(w.t || w.word || ''));
  let styleMode = 1;
  if (isSampleCard) {
    styleMode = 1;
  } else if (numIdx !== -1 && capIdx % 4 !== 1 && capIdx % 4 !== 2) {
    styleMode = 4;
  } else {
    styleMode = (capIdx % 4) + 1;
  }

  if (styleMode === 1) {
    // MODE 1: Frosted Ice Glass Word Behind Head ('LUXURY') + Dark Frosted Pill ('THIS ONE') + Champagne Italic Serif ('detail sells')
    let bIdx = pickBestHeroIdx(words);
    const heroRaw = isSampleCard ? 'LUXURY' : cleanTok(words[bIdx]?.t || words[bIdx]?.word || '', false);
    const behindTxt = heroRaw ? (userCase === 'lower' ? heroRaw.toLowerCase() : heroRaw.toUpperCase()) : 'LUXURY';
    const heroStart = wordStartTime(words[bIdx], capStart + 0.05);

    let remaining = isSampleCard ? [] : frontWordsForBehindHero(words, bIdx);
    let pillWords = [];
    let serifWords = [];
    if (isSampleCard) {
      pillWords = [{ t: 'THIS', s: 0 }, { t: 'ONE', s: 0 }];
      serifWords = [{ t: 'detail', s: 0 }, { t: 'sells', s: 0 }];
    } else if (remaining.length >= 3) {
      const splitAt = Math.min(2, Math.floor(remaining.length / 2));
      pillWords = remaining.slice(0, splitAt);
      serifWords = remaining.slice(splitAt);
    } else if (remaining.length === 2) {
      pillWords = [remaining[0]];
      serifWords = [remaining[1]];
    } else {
      serifWords = remaining;
    }

    // 1. Giant Frosted Ice Glass Word on targetBehind
    const bTrack = ov.trackEmWith(-0.025);
    const behindFontFn = (sz) => `900 ${sz}px ${ov.pickFontFam('"Montserrat", "Poppins", sans-serif')}`;
    const rawBSize = fitPGFont(targetBehind, behindTxt, behindFontFn, H * 0.165 * fontScale, H * 0.070, W * 0.88, bTrack);
    const bPlace = computeBehindCrownPlacement(targetBehind, behindTxt, {
      W, H, fontFn: behindFontFn, preferredSize: rawBSize, minSize: Math.round(H * 0.068),
      trackEm: bTrack, isSampleCard, fallbackCrownRatio: 0.225
    });
    const bSize = bPlace.size;
    const bBaseY = bPlace.baseY;
    const behindCenterY = bPlace.centerY;
    const bP = fullInstant ? 1.0 : (evalT >= heroStart - 0.03 ? Math.min(1, Math.max(0, (evalT - heroStart) / 0.18)) : 0);
    if (bP > 0.01) {
      const bep = easeOutCubic(bP);
      const sc = fullInstant ? 1.0 : (0.94 + 0.06 * bep);
      targetBehind.save();
      try {
        targetBehind.globalAlpha = exitFade * bep;
        targetBehind.translate(heroX, behindCenterY);
        targetBehind.scale(sc, sc);
        targetBehind.translate(-heroX, -behindCenterY);
        targetBehind.font = behindFontFn(bSize);
        if ('letterSpacing' in targetBehind) targetBehind.letterSpacing = `${bTrack}em`;
        targetBehind.textAlign = 'center';
        targetBehind.textBaseline = 'alphabetic';

        const g = targetBehind.createLinearGradient(0, bBaseY - bSize * 0.78, 0, bBaseY + bSize * 0.08);
        g.addColorStop(0.00, ov.customHighlight || 'rgba(255, 255, 255, 0.36)');
        g.addColorStop(0.50, ov.customHighlight || 'rgba(220, 236, 255, 0.18)');
        g.addColorStop(1.00, ov.customHighlight || 'rgba(255, 255, 255, 0.30)');
        ov.applyGlow(targetBehind, 'rgba(0, 0, 0, 0.25)', Math.max(4, Math.round(H * 0.008)));
        targetBehind.fillStyle = g;
        targetBehind.fillText(behindTxt, heroX, bBaseY);

        ov.applyGlow(targetBehind, 'rgba(225, 242, 255, 0.75)', Math.max(6, Math.round(H * 0.012)));
        targetBehind.strokeStyle = ov.customHighlight || 'rgba(255, 255, 255, 0.92)';
        targetBehind.lineWidth = Math.max(1.5, Math.round(H * 0.0022));
        targetBehind.lineJoin = 'round';
        targetBehind.strokeText(behindTxt, heroX, bBaseY);
      } finally {
        targetBehind.restore();
      }
    }

    // 2. Dark Frosted Glassmorphic Pill ('THIS ONE') at y ~ 0.635H
    if (pillWords.length > 0) {
      const pillTxt = pillWords.map(w => cleanTok(w.t || w.word || '', false)).filter(Boolean).join(' ');
      const pillLabel = userCase === 'lower' ? pillTxt.toLowerCase() : (userCase === 'title' ? pillTxt : pillTxt.toUpperCase());
      const pillStart = wordStartTime(pillWords[0], capStart + 0.18);
      const pillP = fullInstant ? 1.0 : (evalT >= pillStart - 0.02 ? Math.min(1, Math.max(0, (evalT - pillStart) / 0.15)) : 0);
      if (pillLabel && pillP > 0.01) {
        const pep = easeOutCubic(pillP);
        const pTrack = ov.trackEmWith(0.06);
        const pillFontFn = (sz) => `600 ${sz}px ${ov.pickFontFam('"Inter", "Poppins", sans-serif')}`;
        const pSize = fitPGFont(ctxFore, pillLabel, pillFontFn, H * 0.025 * fontScale, H * 0.016, W * 0.72, pTrack);
        const pillCy = foreY(0.635, -0.5, Math.round(H * 0.06));
        ctxFore.save();
        try {
          ctxFore.globalAlpha = exitFade * pep;
          ctxFore.font = pillFontFn(pSize);
          if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${pTrack}em`;
          const tw = measurePGWidth(ctxFore, pillLabel, pSize, pTrack);
          const pw = Math.round(tw + pSize * 1.45);
          const ph = Math.round(pSize * 2.05);
          const px = Math.round(heroX - pw * 0.5);
          const py = Math.round(pillCy - ph * 0.5);

          const pg = ctxFore.createLinearGradient(0, py, 0, py + ph);
          pg.addColorStop(0.0, 'rgba(32, 38, 48, 0.58)');
          pg.addColorStop(1.0, 'rgba(14, 18, 26, 0.74)');
          ov.applyGlow(ctxFore, 'rgba(0, 0, 0, 0.35)', 12);
          ctxFore.shadowOffsetY = 4;
          drawRoundRectPath(ctxFore, px, py, pw, ph, ph * 0.5);
          ctxFore.fillStyle = pg;
          ctxFore.fill();

          ctxFore.shadowColor = 'transparent';
          ctxFore.shadowBlur = 0;
          ctxFore.shadowOffsetY = 0;
          ctxFore.strokeStyle = ov.customBase || 'rgba(255, 255, 255, 0.38)';
          ctxFore.lineWidth = Math.max(1.0, H * 0.0014);
          ctxFore.stroke();

          ctxFore.textAlign = 'center';
          ctxFore.textBaseline = 'middle';
          ctxFore.fillStyle = ov.pickBase('rgba(248, 250, 252, 0.96)');
          ctxFore.fillText(pillLabel, heroX, pillCy + Math.round(pSize * 0.05));
          ov.recordSceneBox(cap, W, H, px, py, pw, ph);
        } finally {
          ctxFore.restore();
        }
      }
    }

    // 3. Warm Champagne-Gold Italic Editorial Serif ('detail sells')
    if (serifWords.length > 0) {
      const serifTxt = serifWords.map(w => cleanTok(w.t || w.word || '', true)).filter(Boolean).join(' ');
      const serifStart = wordStartTime(serifWords[0], capStart + 0.35);
      const serifP = fullInstant ? 1.0 : (evalT >= serifStart - 0.02 ? Math.min(1, Math.max(0, (evalT - serifStart) / 0.16)) : 0);
      if (serifTxt && serifP > 0.01) {
        const sep = easeOutCubic(serifP);
        const sTrack = ov.trackEmWith(-0.015);
        const serifFontFn = (sz) => `italic 700 ${sz}px ${ov.pickFontFam('"Playfair Display", Georgia, serif')}`;
        const sSize = fitPGFont(ctxFore, serifTxt, serifFontFn, H * 0.056 * fontScale, H * 0.028, W * 0.86, sTrack);
        const sBaseY = pillWords.length > 0 ? foreY(0.718, 0.5, Math.round(H * 0.07)) : foreY(0.665, 0.35, Math.round(H * 0.07));
        const yOff = fullInstant ? 0 : Math.round((1 - sep) * H * 0.012);
        ctxFore.save();
        try {
          ctxFore.globalAlpha = exitFade * sep;
          ctxFore.font = serifFontFn(sSize);
          if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${sTrack}em`;
          ctxFore.textAlign = 'center';
          ctxFore.textBaseline = 'alphabetic';
          if (ov.customHighlight) {
            ctxFore.fillStyle = ov.customHighlight;
          } else {
            const cg = ctxFore.createLinearGradient(0, sBaseY - sSize * 0.85, 0, sBaseY + sSize * 0.12);
            cg.addColorStop(0.0, '#FBE9BE');
            cg.addColorStop(0.5, '#E4B773');
            cg.addColorStop(1.0, '#C5904C');
            ctxFore.fillStyle = cg;
          }
          ov.applyGlow(ctxFore, 'rgba(0, 0, 0, 0.56)', Math.max(4, Math.round(H * 0.008)));
          ctxFore.shadowOffsetY = Math.round(H * 0.002);
          ctxFore.fillText(serifTxt, heroX, sBaseY + yOff);
          const sw = measurePGWidth(ctxFore, serifTxt, sSize, sTrack);
          ov.recordSceneBox(cap, W, H, heroX - sw * 0.5, sBaseY + yOff - sSize, sw, sSize * 1.25);
        } finally {
          ctxFore.restore();
        }
      }
    }

  } else if (styleMode === 2) {
    // MODE 2: Clean White Inter + Active Frosted Neon Mint-Cyan Pill Highlight ('Watch how / they [focus]')
    const n = words.length;
    const splitAt = n <= 2 ? n : Math.ceil(n / 2);
    const rows = [words.slice(0, splitAt), words.slice(splitAt)].filter(r => r.length > 0);

    // Determine currently spoken active word index (or keyed/final word in fullInstant)
    let activeWordRef = null;
    if (fullInstant) {
      activeWordRef = words.find(w => w && w.key) || words[n - 1];
    } else {
      for (let i = n - 1; i >= 0; i--) {
        if (evalT >= wordStartTime(words[i], capStart + i * 0.20) - 0.02) {
          activeWordRef = words[i];
          break;
        }
      }
      if (!activeWordRef) activeWordRef = words[0];
    }

    const rTrack = ov.trackEmWith(-0.025);
    const rowFontFn = (sz) => `600 ${sz}px ${ov.pickFontFam('"Inter", "Poppins", sans-serif')}`;
    const baseRowSize = Math.round(H * 0.044 * fontScale);
    const longestLine = rows.map(r => r.map(w => cleanTok(w.t || w.word || '', true)).join(' ')).sort((a, b) => b.length - a.length)[0] || '';
    const lineSize = fitPGFont(ctxFore, longestLine, rowFontFn, baseRowSize, Math.round(H * 0.022), W * 0.84, rTrack);
    const rowGap = Math.round(lineSize * 1.48 * ov.lineSpacingMult);
    const startBaseY = posY(Math.round(H * 0.575 - ((rows.length - 1) * rowGap) * 0.5));

    ctxFore.save();
    ctxFore.font = rowFontFn(lineSize);
    if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${rTrack}em`;
    const spaceW = Math.max(lineSize * 0.28, measurePGWidth(ctxFore, ' ', lineSize, rTrack));
    const pillPadX = Math.round(lineSize * 0.36);

    for (let r = 0; r < rows.length; r++) {
      const rWords = rows[r];
      const baseY = startBaseY + r * rowGap;
      const tokens = rWords.map((w, idx) => {
        const txt = cleanTok(w.t || w.word || '', true);
        const tw = measurePGWidth(ctxFore, txt, lineSize, rTrack);
        return { w, txt, tw, isActive: w === activeWordRef, s: wordStartTime(w, capStart + (r * splitAt + idx) * 0.16) };
      }).filter(it => it.txt);

      const totalW = tokens.reduce((acc, it, idx) => acc + it.tw + (it.isActive ? pillPadX * 0.8 : 0) + (idx < tokens.length - 1 ? spaceW : 0), 0);
      let curX = Math.round(heroX - totalW * 0.5);
      ov.recordSceneBox(cap, W, H, curX, baseY - lineSize, totalW, lineSize * 1.35);

      for (let i = 0; i < tokens.length; i++) {
        const tk = tokens[i];
        const p = fullInstant ? 1.0 : Math.min(1, Math.max(0, (evalT - tk.s) / 0.14));
        const ep = easeOutCubic(p);
        if (ep > 0.01) {
          ctxFore.save();
          ctxFore.globalAlpha = exitFade * Math.min(1, ep * 1.3);
          ctxFore.font = rowFontFn(lineSize);
          if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${rTrack}em`;
          ctxFore.textAlign = 'left';
          ctxFore.textBaseline = 'alphabetic';

          if (tk.isActive) {
            const boxX = Math.round(curX);
            const boxW = Math.round(tk.tw + pillPadX * 1.8);
            const boxH = Math.round(lineSize * 1.38);
            const boxY = Math.round(baseY - lineSize * 0.94);

            ctxFore.save();
            ov.applyGlow(ctxFore, 'rgba(45, 212, 191, 0.86)', Math.max(8, Math.round(H * 0.016)));
            drawRoundRectPath(ctxFore, boxX, boxY, boxW, boxH, boxH * 0.5);
            ctxFore.fillStyle = ov.customHighlight ? ov.customHighlight : 'rgba(12, 38, 42, 0.72)';
            ctxFore.fill();
            ctxFore.strokeStyle = ov.pickHi('#67F3DA');
            ctxFore.lineWidth = Math.max(1.5, Math.round(H * 0.0020));
            ctxFore.stroke();
            ctxFore.restore();

            ov.applyGlow(ctxFore, 'rgba(103, 243, 218, 0.45)', 4);
            ctxFore.fillStyle = ov.customHighlight ? '#0D1117' : ov.pickBase('#FFFFFF');
            ctxFore.fillText(tk.txt, Math.round(curX + pillPadX * 0.9), baseY);
          } else {
            ov.applyGlow(ctxFore, 'rgba(0, 0, 0, 0.62)', Math.max(3, Math.round(H * 0.006)));
            ctxFore.shadowOffsetY = Math.round(H * 0.002);
            ctxFore.fillStyle = ov.pickBase('#FFFFFF');
            ctxFore.fillText(tk.txt, Math.round(curX), baseY);
          }
          ctxFore.restore();
        }
        curX += tk.tw + (tk.isActive ? pillPadX * 0.8 : 0) + spaceW;
      }
    }
    ctxFore.restore();

  } else if (styleMode === 3) {
    // MODE 3: Brushed Titanium Chrome Depth Behind Head ('VALUE') + Sans/Serif Foreground Contrast ('starts here.')
    const bIdx = pickBestHeroIdx(words);
    const heroRaw = cleanTok(words[bIdx]?.t || words[bIdx]?.word || '', false);
    const behindTxt = heroRaw ? (userCase === 'lower' ? heroRaw.toLowerCase() : heroRaw.toUpperCase()) : 'VALUE';
    const heroStart = wordStartTime(words[bIdx], capStart + 0.06);

    const remaining = frontWordsForBehindHero(words, bIdx);
    const leadWords = remaining.length > 1 ? remaining.slice(0, -1) : [];
    const serifWord = remaining.length >= 1 ? remaining[remaining.length - 1] : null;

    // 1. Brushed Metallic Chrome Word on targetBehind
    const cTrack = ov.trackEmWith(-0.025);
    const chromeFontFn = (sz) => `900 ${sz}px ${ov.pickFontFam('"Montserrat", "Poppins", sans-serif')}`;
    const rawCSize = fitPGFont(targetBehind, behindTxt, chromeFontFn, H * 0.165 * fontScale, H * 0.072, W * 0.88, cTrack);
    const cPlace = computeBehindCrownPlacement(targetBehind, behindTxt, {
      W, H, fontFn: chromeFontFn, preferredSize: rawCSize, minSize: Math.round(H * 0.068),
      trackEm: cTrack, isSampleCard, fallbackCrownRatio: 0.225
    });
    const cSize = cPlace.size;
    const cBaseY = cPlace.baseY;
    const behindCenterY = cPlace.centerY;
    const cP = fullInstant ? 1.0 : (evalT >= heroStart - 0.03 ? Math.min(1, Math.max(0, (evalT - heroStart) / 0.18)) : 0);
    if (cP > 0.01) {
      const cep = easeOutCubic(cP);
      const sc = fullInstant ? 1.0 : (0.94 + 0.06 * cep);
      targetBehind.save();
      try {
        targetBehind.globalAlpha = exitFade * cep;
        targetBehind.translate(heroX, behindCenterY);
        targetBehind.scale(sc, sc);
        targetBehind.translate(-heroX, -behindCenterY);
        targetBehind.font = chromeFontFn(cSize);
        if ('letterSpacing' in targetBehind) targetBehind.letterSpacing = `${cTrack}em`;
        targetBehind.textAlign = 'center';
        targetBehind.textBaseline = 'alphabetic';

        if (ov.customHighlight) {
          targetBehind.fillStyle = ov.customHighlight;
        } else {
          const cg = targetBehind.createLinearGradient(heroX, cBaseY - cSize * 0.80, heroX, cBaseY + cSize * 0.08);
          cg.addColorStop(0.00, '#96A0AD');
          cg.addColorStop(0.22, '#FFFFFF');
          cg.addColorStop(0.46, '#626B7A');
          cg.addColorStop(0.56, '#DCE3EC');
          cg.addColorStop(0.80, '#434B57');
          cg.addColorStop(1.00, '#CBD2DC');
          targetBehind.fillStyle = cg;
        }

        ov.applyGlow(targetBehind, 'rgba(0, 0, 0, 0.58)', Math.max(6, Math.round(H * 0.010)));
        targetBehind.shadowOffsetY = Math.round(H * 0.004);
        targetBehind.fillText(behindTxt, heroX, cBaseY);

        targetBehind.shadowColor = 'transparent';
        targetBehind.shadowBlur = 0;
        targetBehind.strokeStyle = 'rgba(255, 255, 255, 0.52)';
        targetBehind.lineWidth = Math.max(1.0, H * 0.0012);
        targetBehind.strokeText(behindTxt, heroX, cBaseY);
      } finally {
        targetBehind.restore();
      }
    }

    // 2. Sans + Italic Serif Contrast Line at chest height ('starts' + 'here.')
    const leadTxt = leadWords.map(w => cleanTok(w.t || w.word || '', true)).filter(Boolean).join(' ');
    const serifTxt = serifWord ? cleanTok(serifWord.t || serifWord.word || '', true) : '';
    const lTrack = ov.trackEmWith(-0.02);
    const sTrack3 = ov.trackEmWith(-0.015);
    const leadFontFn = (sz) => `400 ${sz}px ${ov.pickFontFam('"Inter", "Poppins", sans-serif')}`;
    const serifFontFn = (sz) => `italic 700 ${sz}px ${ov.pickFontFam('"Playfair Display", Georgia, serif')}`;
    let lSize = Math.round(H * 0.048 * fontScale);
    let sSize = Math.round(H * 0.056 * fontScale);
    const waistBaseY = posY(H * 0.558);

    if (leadTxt && serifTxt) {
      const measurePair = (ls, ss) => {
        ctxFore.save();
        ctxFore.font = leadFontFn(ls);
        if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${lTrack}em`;
        const lw = measurePGWidth(ctxFore, leadTxt, ls, lTrack);
        ctxFore.font = serifFontFn(ss);
        if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${sTrack3}em`;
        const sw = measurePGWidth(ctxFore, serifTxt, ss, sTrack3);
        ctxFore.restore();
        return { lw, sw };
      };
      let gap = Math.round(W * 0.026);
      let d = measurePair(lSize, sSize);
      if (d.lw + gap + d.sw > W * 0.86 && d.lw + gap + d.sw > 0) {
        const sc = (W * 0.86) / (d.lw + gap + d.sw);
        lSize = Math.max(14, Math.floor(lSize * sc));
        sSize = Math.max(16, Math.floor(sSize * sc));
        gap = Math.max(6, Math.floor(gap * sc));
        d = measurePair(lSize, sSize);
      }
      const startX = Math.round(heroX - (d.lw + gap + d.sw) * 0.5);
      ov.recordSceneBox(cap, W, H, startX, waistBaseY - Math.max(lSize, sSize), d.lw + gap + d.sw, Math.max(lSize, sSize) * 1.25);
      const lP = fullInstant ? 1.0 : Math.min(1, Math.max(0, (evalT - wordStartTime(leadWords[0], capStart + 0.16)) / 0.14));
      const sP = fullInstant ? 1.0 : Math.min(1, Math.max(0, (evalT - wordStartTime(serifWord, capStart + 0.34)) / 0.16));
      if (lP > 0.01) {
        ctxFore.save();
        ctxFore.globalAlpha = exitFade * easeOutCubic(lP);
        ctxFore.font = leadFontFn(lSize);
        if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${lTrack}em`;
        ctxFore.textAlign = 'left';
        ctxFore.textBaseline = 'alphabetic';
        ov.applyGlow(ctxFore, 'rgba(0, 0, 0, 0.56)', 6);
        ctxFore.shadowOffsetY = 2;
        ctxFore.fillStyle = ov.pickBase('#FFFFFF');
        ctxFore.fillText(leadTxt, startX, waistBaseY);
        ctxFore.restore();
      }
      if (sP > 0.01) {
        ctxFore.save();
        ctxFore.globalAlpha = exitFade * easeOutCubic(sP);
        ctxFore.font = serifFontFn(sSize);
        if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${sTrack3}em`;
        ctxFore.textAlign = 'left';
        ctxFore.textBaseline = 'alphabetic';
        ov.applyGlow(ctxFore, 'rgba(255, 250, 235, 0.52)', Math.max(6, Math.round(H * 0.010)));
        ctxFore.fillStyle = ov.pickHi('#FFF9EE');
        ctxFore.fillText(serifTxt, startX + d.lw + gap, waistBaseY);
        ctxFore.restore();
      }
    } else if (serifTxt) {
      const soloSize = fitPGFont(ctxFore, serifTxt, serifFontFn, sSize, H * 0.028, W * 0.86, sTrack3);
      ctxFore.save();
      ctxFore.globalAlpha = exitFade;
      ctxFore.font = serifFontFn(soloSize);
      if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${sTrack3}em`;
      ctxFore.textAlign = 'center';
      ctxFore.textBaseline = 'alphabetic';
      ov.applyGlow(ctxFore, 'rgba(255, 250, 235, 0.50)', 8);
      ctxFore.fillStyle = ov.pickHi('#FFF9EE');
      ctxFore.fillText(serifTxt, heroX, waistBaseY);
      const sw = measurePGWidth(ctxFore, serifTxt, soloSize, sTrack3);
      ov.recordSceneBox(cap, W, H, heroX - sw * 0.5, waistBaseY - soloSize, sw, soloSize * 1.25);
      ctxFore.restore();
    }

  } else {
    // MODE 4: Fine Hollow Champagne-Gold Outline ('3X') Behind + Clean White Sans ('pure') + Glowing Champagne Serif ('Attention')
    const bIdx = numIdx !== -1 ? numIdx : pickBestHeroIdx(words);
    const heroRaw = cleanTok(words[bIdx]?.t || words[bIdx]?.word || '', false);
    const behindTxt = heroRaw ? (userCase === 'lower' ? heroRaw.toLowerCase() : heroRaw.toUpperCase()) : '3X';
    const heroStart = wordStartTime(words[bIdx], capStart + 0.05);

    const remaining = frontWordsForBehindHero(words, bIdx);
    const climaxWord = remaining.length ? remaining[remaining.length - 1] : null;
    const leadWords = remaining.length > 1 ? remaining.slice(0, -1) : [];

    // 1. Hollow Fine Champagne-Gold Hairline on targetBehind
    const oTrack4 = ov.trackEmWith(-0.025);
    const outFontFn = (sz) => `700 ${sz}px ${ov.pickFontFam('"Montserrat", "Poppins", sans-serif')}`;
    const isShortNum = behindTxt.length <= 3;
    const rawOSize = fitPGFont(targetBehind, behindTxt, outFontFn, H * (isShortNum ? 0.34 : 0.18) * fontScale, H * 0.080, W * 0.84, oTrack4);
    const oPlace = computeBehindCrownPlacement(targetBehind, behindTxt, {
      W, H, fontFn: outFontFn, preferredSize: rawOSize, minSize: Math.round(H * 0.075),
      trackEm: oTrack4, isSampleCard, fallbackCrownRatio: 0.24
    });
    const oSize = oPlace.size;
    const oBaseY = oPlace.baseY;
    const behindCenterY = oPlace.centerY;
    const oP = fullInstant ? 1.0 : (evalT >= heroStart - 0.03 ? Math.min(1, Math.max(0, (evalT - heroStart) / 0.18)) : 0);
    if (oP > 0.01) {
      const oep = easeOutCubic(oP);
      const sc = fullInstant ? 1.0 : (0.94 + 0.06 * oep);
      targetBehind.save();
      try {
        targetBehind.globalAlpha = exitFade * oep;
        targetBehind.translate(heroX, behindCenterY);
        targetBehind.scale(sc, sc);
        targetBehind.translate(-heroX, -behindCenterY);
        targetBehind.font = outFontFn(oSize);
        if ('letterSpacing' in targetBehind) targetBehind.letterSpacing = `${oTrack4}em`;
        targetBehind.textAlign = 'center';
        targetBehind.textBaseline = 'alphabetic';

        if (ov.customHighlight) {
          targetBehind.strokeStyle = ov.customHighlight;
        } else {
          const gg = targetBehind.createLinearGradient(0, oBaseY - oSize * 0.78, 0, oBaseY + oSize * 0.06);
          gg.addColorStop(0.0, '#FBE6B2');
          gg.addColorStop(0.5, '#D7AC6E');
          gg.addColorStop(1.0, '#A87D47');
          targetBehind.strokeStyle = gg;
        }
        ov.applyGlow(targetBehind, 'rgba(240, 198, 130, 0.35)', Math.max(4, Math.round(H * 0.008)));
        targetBehind.lineWidth = Math.max(2.2, Math.round(H * 0.0028));
        targetBehind.lineJoin = 'round';
        targetBehind.strokeText(behindTxt, heroX, oBaseY);
      } finally {
        targetBehind.restore();
      }
    }

    // 2. Small Crisp White Sans Lead ('pure') at y ~ 0.65H
    if (leadWords.length > 0) {
      const leadTxt = leadWords.map(w => cleanTok(w.t || w.word || '', true)).filter(Boolean).join(' ');
      const lStart = wordStartTime(leadWords[0], capStart + 0.18);
      const lP = fullInstant ? 1.0 : (evalT >= lStart - 0.02 ? Math.min(1, Math.max(0, (evalT - lStart) / 0.14)) : 0);
      if (leadTxt && lP > 0.01) {
        const lTrack4 = ov.trackEmWith(-0.015);
        const lSize = fitPGFont(ctxFore, leadTxt, (sz) => `600 ${sz}px ${ov.pickFontFam('"Inter", "Poppins", sans-serif')}`, H * 0.036 * fontScale, H * 0.020, W * 0.80, lTrack4);
        const lY = foreY(0.648, -0.5, Math.round(H * 0.065));
        ctxFore.save();
        ctxFore.globalAlpha = exitFade * easeOutCubic(lP);
        ctxFore.font = `600 ${lSize}px ${ov.pickFontFam('"Inter", "Poppins", sans-serif')}`;
        if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${lTrack4}em`;
        ctxFore.textAlign = 'center';
        ctxFore.textBaseline = 'alphabetic';
        ov.applyGlow(ctxFore, 'rgba(0, 0, 0, 0.56)', 6);
        ctxFore.shadowOffsetY = 2;
        ctxFore.fillStyle = ov.pickBase('#FFFFFF');
        ctxFore.fillText(leadTxt, heroX, lY);
        const lw4 = measurePGWidth(ctxFore, leadTxt, lSize, lTrack4);
        ov.recordSceneBox(cap, W, H, heroX - lw4 * 0.5, lY - lSize, lw4, lSize * 1.25);
        ctxFore.restore();
      }
    }

    // 3. Glowing Champagne-Gold Editorial Serif Climax ('Attention') at y ~ 0.72H
    if (climaxWord) {
      const cTxt = cleanTok(climaxWord.t || climaxWord.word || '', true);
      const cStart = wordStartTime(climaxWord, capStart + 0.34);
      const cP = fullInstant ? 1.0 : (evalT >= cStart - 0.02 ? Math.min(1, Math.max(0, (evalT - cStart) / 0.16)) : 0);
      if (cTxt && cP > 0.01) {
        const cep = easeOutCubic(cP);
        const sTrack4 = ov.trackEmWith(-0.015);
        const sFontFn = (sz) => `italic 700 ${sz}px ${ov.pickFontFam('"Playfair Display", Georgia, serif')}`;
        const sSize = fitPGFont(ctxFore, cTxt, sFontFn, H * 0.062 * fontScale, H * 0.030, W * 0.86, sTrack4);
        const cBaseY = leadWords.length > 0 ? foreY(0.720, 0.5, Math.round(H * 0.065)) : foreY(0.675, 0.35, Math.round(H * 0.065));
        ctxFore.save();
        try {
          ctxFore.globalAlpha = exitFade * cep;
          ctxFore.font = sFontFn(sSize);
          if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${sTrack4}em`;
          ctxFore.textAlign = 'center';
          ctxFore.textBaseline = 'alphabetic';

          if (ov.customHighlight) {
            ctxFore.fillStyle = ov.customHighlight;
          } else {
            const cg = ctxFore.createLinearGradient(0, cBaseY - sSize * 0.85, 0, cBaseY + sSize * 0.12);
            cg.addColorStop(0.0, '#FFF6E0');
            cg.addColorStop(0.5, '#EDBF7A');
            cg.addColorStop(1.0, '#BA803A');
            ctxFore.fillStyle = cg;
          }
          // Subtle dark readability backing shadow before golden glow
          ctxFore.save();
          ctxFore.shadowColor = 'rgba(0, 0, 0, 0.58)';
          ctxFore.shadowBlur = Math.max(6, Math.round(H * 0.010));
          ctxFore.shadowOffsetY = Math.round(H * 0.002);
          ctxFore.fillText(cTxt, heroX, cBaseY);
          ctxFore.restore();

          ov.applyGlow(ctxFore, 'rgba(247, 210, 145, 0.62)', Math.max(8, Math.round(H * 0.016)));
          ctxFore.fillText(cTxt, heroX, cBaseY);
          const cw4 = measurePGWidth(ctxFore, cTxt, sSize, sTrack4);
          ov.recordSceneBox(cap, W, H, heroX - cw4 * 0.5, cBaseY - sSize, cw4, sSize * 1.25);
        } finally {
          ctxFore.restore();
        }
      }
    }
  }
}

function drawKineticCollagePass(ctxFore, ctxBehind, cap, words, t, st, W, H, isBehind, showAll, isPreview) {
  if (!ctxFore || !words || !words.length) return;

  const isSampleCard = Boolean(cap && cap.id === 'preview_sample');
  const capStart = (cap && typeof cap.start === 'number') ? cap.start : (words[0] && typeof words[0].s === 'number' ? words[0].s : 0);
  const capEnd = (cap && typeof cap.end === 'number') ? cap.end : (words[words.length - 1] && typeof words[words.length - 1].e === 'number' ? words[words.length - 1].e : capStart + 2.5);
  const hasValidT = (typeof t === 'number' && !isNaN(t));
  const evalT = isSampleCard ? (capStart + 999) : (hasValidT ? t : (capStart + 1.0));
  const fullInstant = isSampleCard || !hasValidT || Boolean(showAll && evalT <= capStart + 0.04);

  const timeRem = fullInstant ? 1.0 : Math.max(0, capEnd - evalT);
  const exitFade = fullInstant ? 1.0 : Math.min(1, timeRem / 0.12);
  if (exitFade <= 0.005) return;

  const targetBehind = (isBehind && ctxBehind) ? ctxBehind : ctxFore;
  const capsList = (typeof S !== 'undefined' && S && Array.isArray(S.captions)) ? S.captions : [];
  const foundIdx = (cap && capsList.length > 0) ? capsList.indexOf(cap) : -1;
  const rawIdx = (cap && cap.index != null) ? Number(cap.index) - 1 : parseInt(cap && cap.id, 10) - 1;
  const capIdx = foundIdx >= 0 ? foundIdx : (!isNaN(rawIdx) && rawIdx >= 0 ? rawIdx : 0);

  const userCase = st && st.textCase;
  const cleanKC = (raw, keepPunct) => {
    const s = String(raw || '').replace(/^["'’()[\]{}]+|["'’()[\]{}]+$/g, '').trim();
    const out = keepPunct ? s.replace(/[:;]+$/g, '') : s.replace(/[.,!?;:]+$/g, '');
    if (userCase === 'upper') return out.toUpperCase();
    if (userCase === 'lower') return out.toLowerCase();
    return out;
  };
  const wordStartTime = (w, fallback) => (w && typeof w.s === 'number') ? w.s : ((w && typeof w.start === 'number') ? w.start : fallback);
  const easeOutCubic = (x) => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);
  const measureKCW = (ctx, text, fontSize, trackEm) => {
    if (!text) return 0;
    const m = ctx.measureText(text);
    const w = (m && typeof m.width === 'number') ? m.width : text.length * fontSize * 0.56;
    if ('letterSpacing' in ctx) return w;
    return Math.max(0, w + Math.max(0, text.length - 1) * fontSize * (trackEm || 0));
  };
  const fitKCFont = (ctx, text, fontStrFn, idealPx, minPx, maxW, trackEm) => {
    let size = Math.round(idealPx);
    if (!text) return size;
    ctx.save();
    ctx.font = fontStrFn(size);
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${trackEm || 0}em`;
    const rawW = measureKCW(ctx, text, size, trackEm);
    ctx.restore();
    if (rawW > maxW && rawW > 0) size = Math.max(Math.round(minPx), Math.floor(size * (maxW / rawW)));
    return size;
  };
  const drawKCRoundRect = (ctx, x, y, w, h, r) => {
    const rad = Math.min(r, w * 0.5, h * 0.5);
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') { ctx.roundRect(x, y, w, h, rad); return; }
    ctx.moveTo(x + rad, y);
    ctx.lineTo(x + w - rad, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
    ctx.lineTo(x + w, y + h - rad);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
    ctx.lineTo(x + rad, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
    ctx.lineTo(x, y + rad);
    ctx.quadraticCurveTo(x, y, x + rad, y);
    ctx.closePath();
  };
  const pickBestHeroIdx = (arr) => {
    const stopSet = new Set(['a', 'an', 'the', 'to', 'at', 'in', 'on', 'of', 'for', 'with', 'and', 'or', 'your', 'you', 'it', 'they', 'call', 'people', 'own', 'most', 'this', 'part', 'dont', "don't", 'wait']);
    let bestI = arr.length - 1;
    let bestScore = -999;
    for (let i = 0; i < arr.length; i++) {
      if (!arr[i]) continue;
      const cl = cleanKC(arr[i].t || arr[i].word || '', false);
      const s = cl.length * 2 + (arr[i].key ? 200 : 0) - (stopSet.has(cl.toLowerCase()) ? 14 : 0);
      if (s > bestScore) { bestScore = s; bestI = i; }
    }
    return bestI;
  };

  const heroX = Math.round(W * 0.50);
  const fontScale = Math.max(0.5, Math.min(2.0, Number(st?.fontScale) || 1.0));
  const ov = resolveSceneStyleOverrides(st, H);
  const posY = (y) => Math.round(y + ov.posDeltaY);
  const kcY = (ratio, rowIdx, lineStep) => posY(H * ratio + (rowIdx || 0) * (lineStep || 0) * (ov.lineSpacingMult - 1.0));
  const styleMode = isSampleCard ? 1 : ((capIdx % 4) + 1);

  if (styleMode === 1) {
    // MODE 1: Clean White Lowercase Above Acid-Lime Highlighter Brushstroke ('people call it' / '[impossible]')
    const hIdx = isSampleCard ? 3 : pickBestHeroIdx(words);
    const spKC = isSampleCard
      ? { beforeWords: [{ t: 'people', s: 0 }, { t: 'call', s: 0 }, { t: 'it', s: 0 }], heroWord: { t: 'impossible', s: 0 }, afterWords: [], beforeTxt: 'people call it', heroTxt: 'impossible', afterTxt: '' }
      : splitChronologicalAroundHero(words, hIdx, (v) => cleanKC(v, true));
    const keyObj = spKC.heroWord;
    const beforeWords = spKC.beforeWords;
    const afterWords = spKC.afterWords;
    const beforeTxt = spKC.beforeTxt;
    const keyTxt = spKC.heroTxt || 'impossible';
    const afterTxt = spKC.afterTxt;
    const beforeStart = beforeWords.length ? wordStartTime(beforeWords[0], capStart) : capStart;
    const keyStart = wordStartTime(keyObj, beforeWords.length ? beforeStart + 0.16 : capStart);
    const afterStart = afterWords.length ? wordStartTime(afterWords[0], keyStart + 0.16) : keyStart;

    const rTrack1 = ov.trackEmWith(-0.025);
    const drawKCRowText = (txt, yRatio, rowIdx, startT) => {
      if (!txt) return;
      const lP = fullInstant ? 1.0 : (evalT >= startT - 0.02 ? Math.min(1, Math.max(0, (evalT - startT) / 0.14)) : 0);
      if (lP <= 0.01) return;
      const lFontFn = (sz) => `600 ${sz}px ${ov.pickFontFam('"Inter", "Poppins", sans-serif')}`;
      const lSize = fitKCFont(ctxFore, txt, lFontFn, H * 0.042 * fontScale, H * 0.020, W * 0.86, rTrack1);
      const yPx = kcY(yRatio, rowIdx, Math.round(H * 0.07));
      ctxFore.save();
      ctxFore.globalAlpha = exitFade * easeOutCubic(lP);
      ctxFore.font = lFontFn(lSize);
      if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${rTrack1}em`;
      ctxFore.textAlign = 'center';
      ctxFore.textBaseline = 'alphabetic';
      ov.applyGlow(ctxFore, 'rgba(0, 0, 0, 0.65)', 8);
      ctxFore.shadowOffsetY = 2;
      ctxFore.fillStyle = ov.pickBase('#FFFFFF');
      ctxFore.fillText(txt, heroX, yPx);
      const tw = measureKCW(ctxFore, txt, lSize, rTrack1);
      ov.recordSceneBox(cap, W, H, heroX - tw * 0.5, yPx - lSize, tw, lSize * 1.25);
      ctxFore.restore();
    };

    const kCyRatio = (beforeTxt && afterTxt) ? 0.618 : (beforeTxt ? 0.630 : (afterTxt ? 0.578 : 0.595));
    if (beforeTxt) drawKCRowText(beforeTxt, afterTxt ? 0.548 : 0.562, -0.5, beforeStart);

    const kP = fullInstant ? 1.0 : (evalT >= keyStart - 0.02 ? Math.min(1, Math.max(0, (evalT - keyStart) / 0.16)) : 0);
    if (keyTxt && kP > 0.01) {
      const kep = easeOutCubic(kP);
      const kTrack1 = ov.trackEmWith(-0.03);
      const kFontFn = (sz) => `800 ${sz}px ${ov.pickFontFam('"Montserrat", "Inter", sans-serif')}`;
      const kSize = fitKCFont(ctxFore, keyTxt, kFontFn, H * 0.050 * fontScale, H * 0.026, W * 0.80, kTrack1);
      const kCy = kcY(kCyRatio, 0, Math.round(H * 0.07));

      ctxFore.save();
      ctxFore.font = kFontFn(kSize);
      if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${kTrack1}em`;
      const tw = measureKCW(ctxFore, keyTxt, kSize, kTrack1);
      const bw = Math.round(tw + kSize * 0.72);
      const bh = Math.round(kSize * 1.24);
      ov.recordSceneBox(cap, W, H, heroX - bw * 0.5, kCy - bh * 0.5, bw, bh);

      ctxFore.globalAlpha = exitFade * Math.min(1, kep * 1.3);
      ctxFore.translate(heroX, kCy);
      ctxFore.rotate(-0.035);

      // Jagged diagonal neon-lime brush stroke wipe
      ctxFore.save();
      ov.applyGlow(ctxFore, 'rgba(0, 0, 0, 0.45)', 10);
      ctxFore.shadowOffsetY = 3;
      const curBw = Math.max(10, Math.round(bw * (fullInstant ? 1.0 : Math.min(1, kep * 1.12))));
      const bx0 = -bw * 0.5;
      const by0 = -bh * 0.52;
      ctxFore.fillStyle = ov.pickHi('#D9FF00');
      drawKCRoundRect(ctxFore, bx0, by0, curBw, bh, Math.round(bh * 0.14));
      ctxFore.fill();
      // Secondary slanted marker under-swipe
      ctxFore.fillStyle = ov.customHighlight || '#C9EF00';
      drawKCRoundRect(ctxFore, bx0 + bw * 0.14, by0 + bh * 0.78, Math.round(curBw * 0.64), Math.round(bh * 0.28), 5);
      ctxFore.fill();
      ctxFore.restore();

      ctxFore.textAlign = 'center';
      ctxFore.textBaseline = 'middle';
      ctxFore.fillStyle = '#0D1014';
      ctxFore.fillText(keyTxt, 0, Math.round(kSize * 0.04));
      ctxFore.restore();
    }

    if (afterTxt) drawKCRowText(afterTxt, beforeTxt ? 0.692 : 0.652, 0.6, afterStart);

  } else if (styleMode === 2) {
    // MODE 2: Matte Crimson Condensed Behind Head ('BUILD') + Clean Sans + Tilted Brush Script ('your own' + 'empire')
    const bIdx = pickBestHeroIdx(words);
    const heroRaw = cleanKC(words[bIdx]?.t || words[bIdx]?.word || '', false);
    const behindTxt = heroRaw ? (userCase === 'lower' ? heroRaw.toLowerCase() : heroRaw.toUpperCase()) : 'BUILD';
    const bStart = wordStartTime(words[bIdx], capStart + 0.04);

    const remaining = frontWordsForBehindHero(words, bIdx);
    const scriptObj = remaining.length >= 1 ? remaining[remaining.length - 1] : null;
    const sansWords = remaining.length > 1 ? remaining.slice(0, -1) : [];

    // 1. Matte Crimson Condensed Behind Head
    const cTrack2 = ov.trackEmWith(-0.01);
    const crimFontFn = (sz) => `700 ${sz}px ${ov.pickFontFam('"Anton", "Montserrat", sans-serif')}`;
    const rawCSize = fitKCFont(targetBehind, behindTxt, crimFontFn, H * 0.255 * fontScale, H * 0.11, W * 0.88, cTrack2);
    const cPlace = computeBehindCrownPlacement(targetBehind, behindTxt, {
      W, H, fontFn: crimFontFn, preferredSize: rawCSize, minSize: Math.round(H * 0.085),
      trackEm: cTrack2, isSampleCard, fallbackCrownRatio: 0.225
    });
    const cSize = cPlace.size;
    const cBaseY = cPlace.baseY;
    const behindCenterY = cPlace.centerY;
    const bP = fullInstant ? 1.0 : (evalT >= bStart - 0.03 ? Math.min(1, Math.max(0, (evalT - bStart) / 0.18)) : 0);
    if (bP > 0.01) {
      const bep = easeOutCubic(bP);
      const sc = fullInstant ? 1.0 : (0.94 + 0.06 * bep);
      targetBehind.save();
      try {
        targetBehind.globalAlpha = exitFade * bep;
        targetBehind.translate(heroX, behindCenterY);
        targetBehind.scale(sc, sc);
        targetBehind.translate(-heroX, -behindCenterY);
        targetBehind.font = crimFontFn(cSize);
        if ('letterSpacing' in targetBehind) targetBehind.letterSpacing = `${cTrack2}em`;
        targetBehind.textAlign = 'center';
        targetBehind.textBaseline = 'alphabetic';

        if (ov.customHighlight) {
          targetBehind.fillStyle = ov.customHighlight;
        } else {
          const cg = targetBehind.createLinearGradient(0, cBaseY - cSize * 0.85, 0, cBaseY + cSize * 0.06);
          cg.addColorStop(0.0, '#B8222B');
          cg.addColorStop(0.6, '#96151D');
          cg.addColorStop(1.0, '#780E15');
          targetBehind.fillStyle = cg;
        }
        ov.applyGlow(targetBehind, 'rgba(0, 0, 0, 0.45)', Math.max(6, Math.round(H * 0.010)));
        targetBehind.fillText(behindTxt, heroX, cBaseY);
      } finally {
        targetBehind.restore();
      }
    }

    // 2. Sans Lead + Handwritten Script Overlay ('your own' + 'empire')
    const sansTxt = sansWords.map(w => cleanKC(w.t || w.word || '', true)).filter(Boolean).join(' ');
    const scriptTxt = scriptObj ? cleanKC(scriptObj.t || scriptObj.word || '', true) : '';
    const baseWaistY = posY(H * 0.625);

    if (sansTxt) {
      const sP = fullInstant ? 1.0 : (evalT >= wordStartTime(sansWords[0], capStart + 0.14) - 0.02 ? Math.min(1, Math.max(0, (evalT - wordStartTime(sansWords[0], capStart + 0.14)) / 0.14)) : 0);
      if (sP > 0.01) {
        const sTrack2 = ov.trackEmWith(-0.025);
        const sSize = fitKCFont(ctxFore, sansTxt, (sz) => `700 ${sz}px ${ov.pickFontFam('"Inter", "Poppins", sans-serif')}`, H * 0.048 * fontScale, H * 0.024, W * 0.86, sTrack2);
        ctxFore.save();
        ctxFore.globalAlpha = exitFade * easeOutCubic(sP);
        ctxFore.font = `700 ${sSize}px ${ov.pickFontFam('"Inter", "Poppins", sans-serif')}`;
        if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${sTrack2}em`;
        ctxFore.textAlign = 'center';
        ctxFore.textBaseline = 'alphabetic';
        ov.applyGlow(ctxFore, 'rgba(0, 0, 0, 0.65)', 8);
        ctxFore.shadowOffsetY = 2;
        ctxFore.fillStyle = ov.pickBase('#FFFFFF');
        ctxFore.fillText(sansTxt, heroX, baseWaistY);
        const sw = measureKCW(ctxFore, sansTxt, sSize, sTrack2);
        ov.recordSceneBox(cap, W, H, heroX - sw * 0.5, baseWaistY - sSize, sw, sSize * 1.25);
        ctxFore.restore();
      }
    }

    if (scriptTxt) {
      const scStart = wordStartTime(scriptObj, capStart + 0.36);
      const scP = fullInstant ? 1.0 : (evalT >= scStart - 0.02 ? Math.min(1, Math.max(0, (evalT - scStart) / 0.16)) : 0);
      if (scP > 0.01) {
        const scTrack = ov.trackEmWith(0);
        const scrFontFn = (sz) => `400 ${sz}px ${ov.pickFontFam('"Yellowtail", "Great Vibes", cursive')}`;
        const scrSize = fitKCFont(ctxFore, scriptTxt, scrFontFn, H * 0.072 * fontScale, H * 0.036, W * 0.86, scTrack);
        const scrY = sansTxt ? Math.round(baseWaistY + scrSize * 0.62 * ov.lineSpacingMult) : baseWaistY;
        ctxFore.save();
        ctxFore.globalAlpha = exitFade * easeOutCubic(scP);
        ctxFore.translate(heroX, scrY);
        ctxFore.rotate(-0.06);
        ctxFore.font = scrFontFn(scrSize);
        if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${scTrack}em`;
        ctxFore.textAlign = 'center';
        ctxFore.textBaseline = 'alphabetic';
        ov.applyGlow(ctxFore, 'rgba(0, 0, 0, 0.62)', 8);
        ctxFore.shadowOffsetY = 2;
        ctxFore.fillStyle = ov.pickBase('#FFFFFF');
        ctxFore.fillText(scriptTxt, 0, 0);
        const scw = measureKCW(ctxFore, scriptTxt, scrSize, scTrack);
        ov.recordSceneBox(cap, W, H, heroX - scw * 0.5, scrY - scrSize * 0.8, scw, scrSize * 1.2);
        ctxFore.restore();
      }
    }

  } else if (styleMode === 3) {
    // MODE 3: Brutalist Stacked Contrasting Tags (Tilted White Box 'MOST SKIP' + Jet-Black Gold Pill 'THIS PART')
    const n = words.length;
    const splitAt = n <= 1 ? 1 : Math.ceil(n / 2);
    const topRaw = words.slice(0, splitAt).map(w => cleanKC(w.t || w.word || '', true)).filter(Boolean).join(' ');
    const botRaw = words.slice(splitAt).map(w => cleanKC(w.t || w.word || '', true)).filter(Boolean).join(' ');
    const topStr = userCase === 'lower' ? topRaw.toLowerCase() : (userCase === 'title' ? topRaw : topRaw.toUpperCase());
    const botStr = userCase === 'lower' ? botRaw.toLowerCase() : (userCase === 'title' ? botRaw : botRaw.toUpperCase());
    const topStart = wordStartTime(words[0], capStart);
    const botStart = words[splitAt] ? wordStartTime(words[splitAt], capStart + 0.25) : capStart + 0.25;

    const tTrack3 = ov.trackEmWith(0.01);
    const tagFontFn = (sz) => `700 ${sz}px ${ov.pickFontFam('"Anton", "Montserrat", sans-serif')}`;
    const drawBadge = (txt, cy, tilt, bg, fg, isRound, bStart, delayScale) => {
      if (!txt) return;
      const p = fullInstant ? 1.0 : (evalT >= bStart - 0.02 ? Math.min(1, Math.max(0, (evalT - bStart) / 0.14)) : 0);
      if (p <= 0.01) return;
      const ep = easeOutCubic(p);
      const sz = fitKCFont(ctxFore, txt, tagFontFn, H * 0.046 * fontScale, H * 0.024, W * 0.78, tTrack3);
      ctxFore.save();
      ctxFore.globalAlpha = exitFade * Math.min(1, ep * 1.35);
      ctxFore.font = tagFontFn(sz);
      if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${tTrack3}em`;
      const tw = measureKCW(ctxFore, txt, sz, tTrack3);
      const pw = Math.round(tw + sz * 0.95);
      const ph = Math.round(sz * 1.48);
      const sc = fullInstant ? 1.0 : (delayScale + (1 - delayScale) * ep);
      ov.recordSceneBox(cap, W, H, heroX - pw * 0.5, cy - ph * 0.5, pw, ph);

      ctxFore.translate(heroX, cy);
      ctxFore.rotate(tilt);
      ctxFore.scale(sc, sc);
      ov.applyGlow(ctxFore, 'rgba(0, 0, 0, 0.48)', 14);
      ctxFore.shadowOffsetY = 5;
      drawKCRoundRect(ctxFore, -pw * 0.5, -ph * 0.5, pw, ph, isRound ? ph * 0.5 : Math.round(ph * 0.18));
      ctxFore.fillStyle = bg;
      ctxFore.fill();

      ctxFore.shadowColor = 'transparent';
      ctxFore.textAlign = 'center';
      ctxFore.textBaseline = 'middle';
      ctxFore.fillStyle = fg;
      ctxFore.fillText(txt, 0, Math.round(sz * 0.06));
      ctxFore.restore();
    };

    const topCy = botStr ? kcY(0.578, -0.5, Math.round(H * 0.07)) : posY(H * 0.610);
    const botCy = kcY(0.648, 0.5, Math.round(H * 0.07));
    drawBadge(topStr, topCy, -0.045, ov.pickBase('#FFFFFF'), '#0D1014', false, topStart, 0.92);
    if (botStr) drawBadge(botStr, botCy, -0.028, '#0B0D12', ov.pickHi('#FFD60A'), true, botStart, 0.92);

  } else {
    // MODE 4: Hollow Ivory Serif Outline ('NOW') Behind + Tracked White Caps ('DON'T WAIT') + Glow Cobalt Underline ('permission.')
    const bIdx = pickBestHeroIdx(words);
    const heroRaw = cleanKC(words[bIdx]?.t || words[bIdx]?.word || '', false);
    const behindTxt = heroRaw ? (userCase === 'lower' ? heroRaw.toLowerCase() : heroRaw.toUpperCase()) : 'NOW';
    const bStart = wordStartTime(words[bIdx], capStart + 0.04);

    const remaining = frontWordsForBehindHero(words, bIdx);
    const punchWord = remaining.length >= 1 ? remaining[remaining.length - 1] : null;
    const kickWords = remaining.length > 1 ? remaining.slice(0, -1) : [];

    // 1. Hollow Ivory Serif Behind Head
    const sTrack4 = ov.trackEmWith(0.03);
    const serifFontFn = (sz) => `700 ${sz}px ${ov.pickFontFam('"Cinzel", "Playfair Display", Georgia, serif')}`;
    const rawOSize = fitKCFont(targetBehind, behindTxt, serifFontFn, H * (behindTxt.length <= 4 ? 0.21 : 0.16) * fontScale, H * 0.075, W * 0.88, sTrack4);
    const oPlace = computeBehindCrownPlacement(targetBehind, behindTxt, {
      W, H, fontFn: serifFontFn, preferredSize: rawOSize, minSize: Math.round(H * 0.070),
      trackEm: sTrack4, isSampleCard, fallbackCrownRatio: 0.225
    });
    const oSize = oPlace.size;
    const oBaseY = oPlace.baseY;
    const oP = fullInstant ? 1.0 : (evalT >= bStart - 0.03 ? Math.min(1, Math.max(0, (evalT - bStart) / 0.18)) : 0);
    if (oP > 0.01) {
      const oep = easeOutCubic(oP);
      targetBehind.save();
      try {
        targetBehind.globalAlpha = exitFade * oep;
        targetBehind.font = serifFontFn(oSize);
        if ('letterSpacing' in targetBehind) targetBehind.letterSpacing = `${sTrack4}em`;
        targetBehind.textAlign = 'center';
        targetBehind.textBaseline = 'alphabetic';
        targetBehind.strokeStyle = ov.customHighlight || 'rgba(248, 245, 236, 0.90)';
        targetBehind.lineWidth = Math.max(1.5, Math.round(H * 0.0022));
        targetBehind.lineJoin = 'round';
        targetBehind.strokeText(behindTxt, heroX, oBaseY);
      } finally {
        targetBehind.restore();
      }
    }

    // 2. Small Tracked Uppercase Kicker ('DON'T WAIT')
    if (kickWords.length > 0) {
      const kRaw = kickWords.map(w => cleanKC(w.t || w.word || '', false)).filter(Boolean).join(' ');
      const kTxt = userCase === 'lower' ? kRaw.toLowerCase() : (userCase === 'title' ? kRaw : kRaw.toUpperCase());
      const kP = fullInstant ? 1.0 : (evalT >= wordStartTime(kickWords[0], capStart + 0.15) - 0.02 ? Math.min(1, Math.max(0, (evalT - wordStartTime(kickWords[0], capStart + 0.15)) / 0.14)) : 0);
      if (kTxt && kP > 0.01) {
        const kTrack4 = ov.trackEmWith(0.14);
        const kSize = fitKCFont(ctxFore, kTxt, (sz) => `600 ${sz}px ${ov.pickFontFam('"Inter", "Poppins", sans-serif')}`, H * 0.023 * fontScale, H * 0.014, W * 0.84, kTrack4);
        const kY4 = kcY(0.625, -0.5, Math.round(H * 0.065));
        ctxFore.save();
        ctxFore.globalAlpha = exitFade * easeOutCubic(kP);
        ctxFore.font = `600 ${kSize}px ${ov.pickFontFam('"Inter", "Poppins", sans-serif')}`;
        if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${kTrack4}em`;
        ctxFore.textAlign = 'center';
        ctxFore.textBaseline = 'alphabetic';
        ov.applyGlow(ctxFore, 'rgba(0, 0, 0, 0.60)', 6);
        ctxFore.fillStyle = ov.pickBase('rgba(245, 247, 250, 0.95)');
        ctxFore.fillText(kTxt, heroX, kY4);
        const kw = measureKCW(ctxFore, kTxt, kSize, kTrack4);
        ov.recordSceneBox(cap, W, H, heroX - kw * 0.5, kY4 - kSize, kw, kSize * 1.25);
        ctxFore.restore();
      }
    }

    // 3. Bold Climax Word ('permission.') with Glowing Electric Cobalt Underline
    if (punchWord) {
      const pTxt = cleanKC(punchWord.t || punchWord.word || '', true);
      const pStart = wordStartTime(punchWord, capStart + 0.34);
      const pP = fullInstant ? 1.0 : (evalT >= pStart - 0.02 ? Math.min(1, Math.max(0, (evalT - pStart) / 0.16)) : 0);
      if (pTxt && pP > 0.01) {
        const pep = easeOutCubic(pP);
        const pTrack4 = ov.trackEmWith(-0.025);
        const pFontFn = (sz) => `900 ${sz}px ${ov.pickFontFam('"Montserrat", "Inter", sans-serif')}`;
        const pSize = fitKCFont(ctxFore, pTxt, pFontFn, H * 0.056 * fontScale, H * 0.028, W * 0.86, pTrack4);
        const pBaseY = kickWords.length > 0 ? kcY(0.692, 0.5, Math.round(H * 0.065)) : kcY(0.655, 0.35, Math.round(H * 0.065));
        ctxFore.save();
        ctxFore.globalAlpha = exitFade * pep;
        ctxFore.font = pFontFn(pSize);
        if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${pTrack4}em`;
        const pw = measureKCW(ctxFore, pTxt, pSize, pTrack4);
        const barW = Math.round(pw * 1.06 * (fullInstant ? 1.0 : Math.min(1, pep * 1.1)));
        const barY = Math.round(pBaseY + pSize * 0.22);
        const barH = Math.max(4, Math.round(H * 0.0055));
        ov.recordSceneBox(cap, W, H, heroX - pw * 0.5, pBaseY - pSize, pw, pSize * 1.35);

        ctxFore.save();
        ov.applyGlow(ctxFore, 'rgba(59, 130, 246, 0.92)', Math.max(10, Math.round(H * 0.018)));
        if (ov.customHighlight) {
          ctxFore.fillStyle = ov.customHighlight;
        } else {
          const bg = ctxFore.createLinearGradient(heroX - barW * 0.5, 0, heroX + barW * 0.5, 0);
          bg.addColorStop(0.0, '#1D4ED8');
          bg.addColorStop(0.5, '#60A5FA');
          bg.addColorStop(1.0, '#1D4ED8');
          ctxFore.fillStyle = bg;
        }
        drawKCRoundRect(ctxFore, Math.round(heroX - barW * 0.5), barY, barW, barH, barH * 0.5);
        ctxFore.fill();
        ctxFore.restore();

        ctxFore.textAlign = 'center';
        ctxFore.textBaseline = 'alphabetic';
        ov.applyGlow(ctxFore, 'rgba(0, 0, 0, 0.65)', 8);
        ctxFore.shadowOffsetY = 2;
        ctxFore.fillStyle = ov.pickBase('#FFFFFF');
        ctxFore.fillText(pTxt, heroX, pBaseY);
        ctxFore.restore();
      }
    }
  }
}

function drawObsidianCouturePass(ctxFore, ctxBehind, cap, words, t, st, W, H, isBehind, showAll, isPreview) {
  if (!ctxFore || !words || !words.length) return;

  const isSampleCard = Boolean(cap && cap.id === 'preview_sample');
  const capStart = (cap && typeof cap.start === 'number') ? cap.start : (words[0] && typeof words[0].s === 'number' ? words[0].s : 0);
  const capEnd = (cap && typeof cap.end === 'number') ? cap.end : (words[words.length - 1] && typeof words[words.length - 1].e === 'number' ? words[words.length - 1].e : capStart + 2.5);
  const hasValidT = (typeof t === 'number' && !isNaN(t));
  const evalT = isSampleCard ? (capStart + 999) : (hasValidT ? t : (capStart + 1.0));
  const fullInstant = isSampleCard || !hasValidT || Boolean(showAll && evalT <= capStart + 0.04);

  const timeRem = fullInstant ? 1.0 : Math.max(0, capEnd - evalT);
  const exitFade = fullInstant ? 1.0 : Math.min(1, timeRem / 0.14);
  if (exitFade <= 0.005) return;

  const targetBehind = (isBehind && ctxBehind) ? ctxBehind : ctxFore;
  const capsList = (typeof S !== 'undefined' && S && Array.isArray(S.captions)) ? S.captions : [];
  const foundIdx = (cap && capsList.length > 0) ? capsList.indexOf(cap) : -1;
  const rawIdx = (cap && cap.index != null) ? Number(cap.index) - 1 : parseInt(cap && cap.id, 10) - 1;
  const capIdx = foundIdx >= 0 ? foundIdx : (!isNaN(rawIdx) && rawIdx >= 0 ? rawIdx : 0);

  const userCase = st && st.textCase;
  const cleanOC = (raw, keepPunct) => {
    const s = String(raw || '').replace(/^["'’()[\]{}]+|["'’()[\]{}]+$/g, '').trim();
    const out = keepPunct ? s.replace(/[:;]+$/g, '') : s.replace(/[.,!?;:]+$/g, '');
    if (userCase === 'upper') return out.toUpperCase();
    if (userCase === 'lower') return out.toLowerCase();
    return out;
  };
  const wordStartTime = (w, fallback) => (w && typeof w.s === 'number') ? w.s : ((w && typeof w.start === 'number') ? w.start : fallback);
  const easeOutCubic = (x) => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);
  const measureOCW = (ctx, text, fontSize, trackEm) => {
    if (!text) return 0;
    const m = ctx.measureText(text);
    const w = (m && typeof m.width === 'number') ? m.width : text.length * fontSize * 0.56;
    if ('letterSpacing' in ctx) return w;
    return Math.max(0, w + Math.max(0, text.length - 1) * fontSize * (trackEm || 0));
  };
  const fitOCFont = (ctx, text, fontStrFn, idealPx, minPx, maxW, trackEm) => {
    let size = Math.round(idealPx);
    if (!text) return size;
    ctx.save();
    ctx.font = fontStrFn(size);
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${trackEm || 0}em`;
    const rawW = measureOCW(ctx, text, size, trackEm);
    ctx.restore();
    if (rawW > maxW && rawW > 0) size = Math.max(Math.round(minPx), Math.floor(size * (maxW / rawW)));
    return size;
  };
  const drawOCRoundRect = (ctx, x, y, w, h, r) => {
    const rad = Math.min(r, w * 0.5, h * 0.5);
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') { ctx.roundRect(x, y, w, h, rad); return; }
    ctx.moveTo(x + rad, y);
    ctx.lineTo(x + w - rad, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
    ctx.lineTo(x + w, y + h - rad);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
    ctx.lineTo(x + rad, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
    ctx.lineTo(x, y + rad);
    ctx.quadraticCurveTo(x, y, x + rad, y);
    ctx.closePath();
  };
  const pickBestHeroIdx = (arr) => {
    const stopSet = new Set(['a', 'an', 'the', 'to', 'at', 'in', 'on', 'of', 'for', 'with', 'and', 'or', 'your', 'you', 'pure', 'exclusive', 'welcome', 'home', 'private', 'sky']);
    let bestI = 0;
    let bestScore = -999;
    for (let i = 0; i < arr.length; i++) {
      if (!arr[i]) continue;
      const cl = cleanOC(arr[i].t || arr[i].word || '', false);
      const s = cl.length * 2 + (arr[i].key ? 200 : 0) - (stopSet.has(cl.toLowerCase()) ? 14 : 0);
      if (s > bestScore) { bestScore = s; bestI = i; }
    }
    return bestI;
  };
  const isPctOrMetric = (raw) => /^\$?\d[\d,.]*(?:%|x|k|m|b|cr)?$/i.test(String(raw || '').replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'’]/g, '') + (String(raw || '').includes('%') ? '%' : ''));

  const heroX = Math.round(W * 0.50);
  const fontScale = Math.max(0.5, Math.min(2.0, Number(st?.fontScale) || 1.0));
  const ov = resolveSceneStyleOverrides(st, H);
  const posY = (y) => Math.round(y + ov.posDeltaY);
  const ocY = (ratio, rowIdx, lineStep) => posY(H * ratio + (rowIdx || 0) * (lineStep || 0) * (ov.lineSpacingMult - 1.0));

  const pctIdx = words.findIndex(w => isPctOrMetric(w.t || w.word || ''));
  let styleMode = 1;
  if (isSampleCard) {
    styleMode = 1;
  } else if (pctIdx !== -1 && capIdx % 4 !== 1 && capIdx % 4 !== 3) {
    styleMode = 3;
  } else {
    styleMode = (capIdx % 4) + 1;
  }

  if (styleMode === 1) {
    // MODE 1: Deep Emerald Metallic Serif ('ESTATE') Behind + Tracked Caps ('EXCLUSIVE') + Liquid Gold Serif Italic ('Residence')
    const bIdx = pickBestHeroIdx(words);
    const heroRaw = isSampleCard ? 'ESTATE' : cleanOC(words[bIdx]?.t || words[bIdx]?.word || '', false);
    const behindTxt = heroRaw ? (userCase === 'lower' ? heroRaw.toLowerCase() : heroRaw.toUpperCase()) : 'ESTATE';
    const bStart = wordStartTime(words[bIdx], capStart + 0.04);

    const remaining = isSampleCard ? [{ t: 'EXCLUSIVE', s: 0 }, { t: 'Residence', s: 0 }] : frontWordsForBehindHero(words, bIdx);
    const kickWords = remaining.length > 1 ? remaining.slice(0, -1) : [];
    const mainSerifWord = remaining.length >= 1 ? remaining[remaining.length - 1] : null;

    // 1. Metallic Deep Emerald Serif on targetBehind
    const emTrack = ov.trackEmWith(0.015);
    const emFontFn = (sz) => `700 ${sz}px ${ov.pickFontFam('"Cinzel", "Playfair Display", Georgia, serif')}`;
    const rawESize = fitOCFont(targetBehind, behindTxt, emFontFn, H * 0.175 * fontScale, H * 0.075, W * 0.88, emTrack);
    const ePlace = computeBehindCrownPlacement(targetBehind, behindTxt, {
      W, H, fontFn: emFontFn, preferredSize: rawESize, minSize: Math.round(H * 0.070),
      trackEm: emTrack, isSampleCard, fallbackCrownRatio: 0.225
    });
    const eSize = ePlace.size;
    const eBaseY = ePlace.baseY;
    const behindCenterY = ePlace.centerY;
    const bP = fullInstant ? 1.0 : (evalT >= bStart - 0.03 ? Math.min(1, Math.max(0, (evalT - bStart) / 0.18)) : 0);
    if (bP > 0.01) {
      const bep = easeOutCubic(bP);
      const sc = fullInstant ? 1.0 : (0.94 + 0.06 * bep);
      targetBehind.save();
      try {
        targetBehind.globalAlpha = exitFade * bep;
        targetBehind.translate(heroX, behindCenterY);
        targetBehind.scale(sc, sc);
        targetBehind.translate(-heroX, -behindCenterY);
        targetBehind.font = emFontFn(eSize);
        if ('letterSpacing' in targetBehind) targetBehind.letterSpacing = `${emTrack}em`;
        targetBehind.textAlign = 'center';
        targetBehind.textBaseline = 'alphabetic';

        if (ov.customHighlight) {
          targetBehind.fillStyle = ov.customHighlight;
        } else {
          const eg = targetBehind.createLinearGradient(0, eBaseY - eSize * 0.85, 0, eBaseY + eSize * 0.06);
          eg.addColorStop(0.00, '#326E54');
          eg.addColorStop(0.32, '#133C2C');
          eg.addColorStop(0.55, '#255D45');
          eg.addColorStop(0.85, '#092218');
          eg.addColorStop(1.00, '#2B5E47');
          targetBehind.fillStyle = eg;
        }
        ov.applyGlow(targetBehind, 'rgba(0, 0, 0, 0.68)', Math.max(6, Math.round(H * 0.012)));
        targetBehind.shadowOffsetY = Math.round(H * 0.004);
        targetBehind.fillText(behindTxt, heroX, eBaseY);

        targetBehind.shadowColor = 'transparent';
        targetBehind.strokeStyle = ov.customHighlight || 'rgba(120, 205, 160, 0.42)';
        targetBehind.lineWidth = Math.max(1.0, H * 0.0012);
        targetBehind.strokeText(behindTxt, heroX, eBaseY);
      } finally {
        targetBehind.restore();
      }
    }

    // 2. Wide-Tracked White Micro Kicker ('EXCLUSIVE')
    if (kickWords.length > 0) {
      const kRaw = kickWords.map(w => cleanOC(w.t || w.word || '', false)).filter(Boolean).join(' ');
      const kTxt = userCase === 'lower' ? kRaw.toLowerCase() : (userCase === 'title' ? kRaw : kRaw.toUpperCase());
      const kP = fullInstant ? 1.0 : (evalT >= wordStartTime(kickWords[0], capStart + 0.16) - 0.02 ? Math.min(1, Math.max(0, (evalT - wordStartTime(kickWords[0], capStart + 0.16)) / 0.14)) : 0);
      if (kTxt && kP > 0.01) {
        const kTrack1 = ov.trackEmWith(0.24);
        const kSize = fitOCFont(ctxFore, kTxt, (sz) => `500 ${sz}px ${ov.pickFontFam('"Inter", "Poppins", sans-serif')}`, H * 0.022 * fontScale, H * 0.014, W * 0.84, kTrack1);
        const kY1 = ocY(0.635, -0.5, Math.round(H * 0.07));
        ctxFore.save();
        ctxFore.globalAlpha = exitFade * easeOutCubic(kP);
        ctxFore.font = `500 ${kSize}px ${ov.pickFontFam('"Inter", "Poppins", sans-serif')}`;
        if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${kTrack1}em`;
        ctxFore.textAlign = 'center';
        ctxFore.textBaseline = 'alphabetic';
        ov.applyGlow(ctxFore, 'rgba(0, 0, 0, 0.65)', 6);
        ctxFore.fillStyle = ov.pickBase('#F8FAFC');
        ctxFore.fillText(kTxt, heroX, kY1);
        const kw = measureOCW(ctxFore, kTxt, kSize, kTrack1);
        ov.recordSceneBox(cap, W, H, heroX - kw * 0.5, kY1 - kSize, kw, kSize * 1.25);
        ctxFore.restore();
      }
    }

    // 3. Liquid Gold Italic Serif ('Residence')
    if (mainSerifWord) {
      const mTxt = cleanOC(mainSerifWord.t || mainSerifWord.word || '', true);
      const mStart = wordStartTime(mainSerifWord, capStart + 0.34);
      const mP = fullInstant ? 1.0 : (evalT >= mStart - 0.02 ? Math.min(1, Math.max(0, (evalT - mStart) / 0.16)) : 0);
      if (mTxt && mP > 0.01) {
        const mTrack1 = ov.trackEmWith(-0.015);
        const mFontFn = (sz) => `italic 700 ${sz}px ${ov.pickFontFam('"Playfair Display", Georgia, serif')}`;
        const mSize = fitOCFont(ctxFore, mTxt, mFontFn, H * 0.062 * fontScale, H * 0.032, W * 0.86, mTrack1);
        const mBaseY = kickWords.length > 0 ? ocY(0.708, 0.5, Math.round(H * 0.07)) : ocY(0.668, 0.35, Math.round(H * 0.07));
        ctxFore.save();
        ctxFore.globalAlpha = exitFade * easeOutCubic(mP);
        ctxFore.font = mFontFn(mSize);
        if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${mTrack1}em`;
        ctxFore.textAlign = 'center';
        ctxFore.textBaseline = 'alphabetic';
        let fillObj;
        if (ov.customHighlight) {
          fillObj = ov.customHighlight;
        } else {
          const gg = ctxFore.createLinearGradient(0, mBaseY - mSize * 0.85, 0, mBaseY + mSize * 0.12);
          gg.addColorStop(0.0, '#FDE8AE');
          gg.addColorStop(0.5, '#D8A852');
          gg.addColorStop(1.0, '#966520');
          fillObj = gg;
        }
        ctxFore.save();
        ctxFore.shadowColor = 'rgba(0, 0, 0, 0.72)';
        ctxFore.shadowBlur = Math.max(8, Math.round(H * 0.012));
        ctxFore.shadowOffsetY = Math.round(H * 0.003);
        ctxFore.fillStyle = fillObj;
        ctxFore.fillText(mTxt, heroX, mBaseY);
        ctxFore.restore();

        ov.applyGlow(ctxFore, 'rgba(247, 210, 145, 0.42)', Math.max(6, Math.round(H * 0.012)));
        ctxFore.fillStyle = fillObj;
        ctxFore.fillText(mTxt, heroX, mBaseY);
        const mw = measureOCW(ctxFore, mTxt, mSize, mTrack1);
        ov.recordSceneBox(cap, W, H, heroX - mw * 0.5, mBaseY - mSize, mw, mSize * 1.25);
        ctxFore.restore();
      }
    }

  } else if (styleMode === 2) {
    // MODE 2: Smoked Frosted Glass Bento Card + Left Gold Accent Stripe ('SKY PENTHOUSE' / 'Private Rooftop')
    const n = words.length;
    const splitAt = n <= 1 ? 1 : Math.ceil(n / 2);
    const r1Raw = words.slice(0, splitAt).map(w => cleanOC(w.t || w.word || '', true)).filter(Boolean).join(' ');
    const row1 = userCase === 'lower' ? r1Raw.toLowerCase() : (userCase === 'title' ? r1Raw : r1Raw.toUpperCase());
    const row2 = words.slice(splitAt).map(w => cleanOC(w.t || w.word || '', true)).filter(Boolean).join(' ');
    const pStart = wordStartTime(words[0], capStart);
    const cP = fullInstant ? 1.0 : (evalT >= pStart - 0.02 ? Math.min(1, Math.max(0, (evalT - pStart) / 0.16)) : 0);
    if (cP <= 0.01) return;

    const r1Track = ov.trackEmWith(0.03);
    const r2Track = ov.trackEmWith(-0.01);
    const r1FontFn = (sz) => `700 ${sz}px ${ov.pickFontFam('"Anton", "Montserrat", sans-serif')}`;
    const r2FontFn = (sz) => `400 ${sz}px ${ov.pickFontFam('"Inter", "Poppins", sans-serif')}`;
    const r1Size = fitOCFont(ctxFore, row1 || 'LUXURY', r1FontFn, H * 0.036 * fontScale, H * 0.020, W * 0.72, r1Track);
    const r2Size = row2 ? fitOCFont(ctxFore, row2, r2FontFn, H * 0.026 * fontScale, H * 0.016, W * 0.72, r2Track) : 0;

    ctxFore.save();
    ctxFore.font = r1FontFn(r1Size);
    if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${r1Track}em`;
    const w1 = measureOCW(ctxFore, row1, r1Size, r1Track);
    ctxFore.font = r2FontFn(r2Size || r1Size);
    if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${r2Track}em`;
    const w2 = row2 ? measureOCW(ctxFore, row2, r2Size, r2Track) : 0;

    const innerW = Math.max(w1, w2, W * 0.38);
    const cardW = Math.min(Math.round(W * 0.86), Math.round(innerW + H * 0.055));
    const cardH = Math.round(row2 ? (r1Size * 2.15 + r2Size * 1.45 * ov.lineSpacingMult) : (r1Size * 2.2));
    const cardX = Math.round(heroX - cardW * 0.5);
    const cardY = posY(Math.round(H * 0.535 - cardH * 0.5));
    const cep = easeOutCubic(cP);
    ov.recordSceneBox(cap, W, H, cardX, cardY, cardW, cardH);

    ctxFore.globalAlpha = exitFade * cep;
    ov.applyGlow(ctxFore, 'rgba(0, 0, 0, 0.55)', 22);
    ctxFore.shadowOffsetY = 8;
    const bgGrad = ctxFore.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
    bgGrad.addColorStop(0.0, 'rgba(26, 28, 34, 0.78)');
    bgGrad.addColorStop(1.0, 'rgba(12, 14, 18, 0.88)');
    drawOCRoundRect(ctxFore, cardX, cardY, cardW, cardH, Math.round(H * 0.014));
    ctxFore.fillStyle = bgGrad;
    ctxFore.fill();

    ctxFore.shadowColor = 'transparent';
    ctxFore.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctxFore.lineWidth = Math.max(1.0, H * 0.0014);
    ctxFore.stroke();

    // Left vertical liquid gold bar accent
    const barW = Math.max(4, Math.round(W * 0.010));
    const barH = Math.round(cardH * 0.62);
    const barX = cardX + Math.round(H * 0.016);
    const barY = Math.round(cardY + (cardH - barH) * 0.5);
    let barFill;
    if (ov.customHighlight) {
      barFill = ov.customHighlight;
    } else {
      const barG = ctxFore.createLinearGradient(0, barY, 0, barY + barH);
      barG.addColorStop(0.0, '#FCE5A2');
      barG.addColorStop(0.5, '#D8A852');
      barG.addColorStop(1.0, '#A67830');
      barFill = barG;
    }
    ctxFore.save();
    ov.applyGlow(ctxFore, 'rgba(216, 168, 82, 0.55)', 8);
    drawOCRoundRect(ctxFore, barX, barY, barW, barH, barW * 0.5);
    ctxFore.fillStyle = barFill;
    ctxFore.fill();
    ctxFore.restore();

    const textX = barX + barW + Math.round(H * 0.016);
    const row1BaseY = row2 ? Math.round(cardY + cardH * 0.43) : Math.round(cardY + cardH * 0.58);
    ctxFore.font = r1FontFn(r1Size);
    if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${r1Track}em`;
    ctxFore.textAlign = 'left';
    ctxFore.textBaseline = 'alphabetic';
    ctxFore.fillStyle = ov.pickHi('#E6C073');
    ctxFore.fillText(row1, textX, row1BaseY);

    if (row2) {
      ctxFore.font = r2FontFn(r2Size);
      if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${r2Track}em`;
      ctxFore.fillStyle = ov.pickBase('rgba(241, 245, 249, 0.96)');
      ctxFore.fillText(row2, textX, Math.round(row1BaseY + r2Size * 1.48 * ov.lineSpacingMult));
    }
    ctxFore.restore();

  } else if (styleMode === 3) {
    // MODE 3: Brushed Metallic Rose-Bronze Behind Head ('100%') + Italic Serif + Bold Condensed Sans ('pure CRAFT')
    const bIdx = pctIdx !== -1 ? pctIdx : pickBestHeroIdx(words);
    const heroRaw = cleanOC(words[bIdx]?.t || words[bIdx]?.word || '', false);
    const rawWithPct = (String(words[bIdx]?.t || words[bIdx]?.word || '').includes('%') && !heroRaw.includes('%')) ? (heroRaw + '%') : heroRaw;
    const behindTxt = rawWithPct ? (userCase === 'lower' ? rawWithPct.toLowerCase() : rawWithPct.toUpperCase()) : '100%';
    const bStart = wordStartTime(words[bIdx], capStart + 0.04);

    const remaining = frontWordsForBehindHero(words, bIdx);
    const boldWord = remaining.length >= 1 ? remaining[remaining.length - 1] : null;
    const serifWords = remaining.length > 1 ? remaining.slice(0, -1) : [];

    // 1. Brushed Metallic Rose-Bronze Word on targetBehind
    const rbTrack = ov.trackEmWith(-0.01);
    const rbFontFn = (sz) => `700 ${sz}px ${ov.pickFontFam('"Anton", "Montserrat", sans-serif')}`;
    const rawRSize = fitOCFont(targetBehind, behindTxt, rbFontFn, H * (behindTxt.length <= 5 ? 0.23 : 0.17) * fontScale, H * 0.085, W * 0.88, rbTrack);
    const rPlace = computeBehindCrownPlacement(targetBehind, behindTxt, {
      W, H, fontFn: rbFontFn, preferredSize: rawRSize, minSize: Math.round(H * 0.080),
      trackEm: rbTrack, isSampleCard, fallbackCrownRatio: 0.23
    });
    const rSize = rPlace.size;
    const rBaseY = rPlace.baseY;
    const behindCenterY = rPlace.centerY;
    const bP = fullInstant ? 1.0 : (evalT >= bStart - 0.03 ? Math.min(1, Math.max(0, (evalT - bStart) / 0.18)) : 0);
    if (bP > 0.01) {
      const bep = easeOutCubic(bP);
      const sc = fullInstant ? 1.0 : (0.94 + 0.06 * bep);
      targetBehind.save();
      try {
        targetBehind.globalAlpha = exitFade * bep;
        targetBehind.translate(heroX, behindCenterY);
        targetBehind.scale(sc, sc);
        targetBehind.translate(-heroX, -behindCenterY);
        targetBehind.font = rbFontFn(rSize);
        if ('letterSpacing' in targetBehind) targetBehind.letterSpacing = `${rbTrack}em`;
        targetBehind.textAlign = 'center';
        targetBehind.textBaseline = 'alphabetic';

        if (ov.customHighlight) {
          targetBehind.fillStyle = ov.customHighlight;
        } else {
          const rg = targetBehind.createLinearGradient(0, rBaseY - rSize * 0.85, 0, rBaseY + rSize * 0.06);
          rg.addColorStop(0.00, '#F5D5C3');
          rg.addColorStop(0.28, '#B87C64');
          rg.addColorStop(0.54, '#6A3C2B');
          rg.addColorStop(0.80, '#DEB09B');
          rg.addColorStop(1.00, '#854E3A');
          targetBehind.fillStyle = rg;
        }
        ov.applyGlow(targetBehind, 'rgba(0, 0, 0, 0.62)', Math.max(6, Math.round(H * 0.010)));
        targetBehind.shadowOffsetY = Math.round(H * 0.004);
        targetBehind.fillText(behindTxt, heroX, rBaseY);

        targetBehind.shadowColor = 'transparent';
        targetBehind.strokeStyle = 'rgba(255, 226, 212, 0.44)';
        targetBehind.lineWidth = Math.max(1.0, H * 0.0012);
        targetBehind.strokeText(behindTxt, heroX, rBaseY);
      } finally {
        targetBehind.restore();
      }
    }

    // 2. Inline Dual Pair at waist ('pure' Playfair italic + 'CRAFT' Anton bold)
    const serifTxt = serifWords.map(w => cleanOC(w.t || w.word || '', true)).filter(Boolean).join(' ');
    const boldRaw = boldWord ? cleanOC(boldWord.t || boldWord.word || '', true) : '';
    const boldTxt = userCase === 'lower' ? boldRaw.toLowerCase() : (userCase === 'title' ? boldRaw : boldRaw.toUpperCase());
    const waistY = ocY(0.658, 0.4, Math.round(H * 0.065));
    const sTrack3 = ov.trackEmWith(-0.01);
    const bTrack3 = ov.trackEmWith(0.01);
    if (serifTxt && boldTxt) {
      const sFontFn = (sz) => `italic 700 ${sz}px ${ov.pickFontFam('"Playfair Display", Georgia, serif')}`;
      const bFontFn = (sz) => `700 ${sz}px ${ov.pickFontFam('"Anton", "Montserrat", sans-serif')}`;
      let sSz = Math.round(H * 0.054 * fontScale);
      let bSz = Math.round(H * 0.062 * fontScale);
      let gap = Math.round(W * 0.024);
      const mPair = (ss, bs) => {
        ctxFore.save();
        ctxFore.font = sFontFn(ss);
        const sw = measureOCW(ctxFore, serifTxt, ss, sTrack3);
        ctxFore.font = bFontFn(bs);
        const bw = measureOCW(ctxFore, boldTxt, bs, bTrack3);
        ctxFore.restore();
        return { sw, bw };
      };
      let d = mPair(sSz, bSz);
      if (d.sw + gap + d.bw > W * 0.86) {
        const sc = (W * 0.86) / (d.sw + gap + d.bw);
        sSz = Math.max(14, Math.floor(sSz * sc));
        bSz = Math.max(16, Math.floor(bSz * sc));
        gap = Math.max(6, Math.floor(gap * sc));
        d = mPair(sSz, bSz);
      }
      const startX = Math.round(heroX - (d.sw + gap + d.bw) * 0.5);
      ov.recordSceneBox(cap, W, H, startX, waistY - Math.max(sSz, bSz), d.sw + gap + d.bw, Math.max(sSz, bSz) * 1.25);
      ctxFore.save();
      ctxFore.globalAlpha = exitFade;
      ctxFore.textAlign = 'left';
      ctxFore.textBaseline = 'alphabetic';
      ov.applyGlow(ctxFore, 'rgba(0, 0, 0, 0.65)', 8);
      ctxFore.shadowOffsetY = 2;
      ctxFore.fillStyle = ov.pickBase('#FFFFFF');
      ctxFore.font = sFontFn(sSz);
      if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${sTrack3}em`;
      ctxFore.fillText(serifTxt, startX, waistY);
      ctxFore.font = bFontFn(bSz);
      if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${bTrack3}em`;
      ctxFore.fillStyle = ov.pickHi('#FFFFFF');
      ctxFore.fillText(boldTxt, startX + d.sw + gap, waistY);
      ctxFore.restore();
    } else if (boldTxt) {
      const soloSz = fitOCFont(ctxFore, boldTxt, (sz) => `700 ${sz}px ${ov.pickFontFam('"Anton", sans-serif')}`, H * 0.062 * fontScale, H * 0.03, W * 0.86, bTrack3);
      ctxFore.save();
      ctxFore.globalAlpha = exitFade;
      ctxFore.font = `700 ${soloSz}px ${ov.pickFontFam('"Anton", sans-serif')}`;
      if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${bTrack3}em`;
      ctxFore.textAlign = 'center';
      ctxFore.textBaseline = 'alphabetic';
      ov.applyGlow(ctxFore, 'rgba(0, 0, 0, 0.65)', 8);
      ctxFore.fillStyle = ov.pickBase('#FFFFFF');
      ctxFore.fillText(boldTxt, heroX, waistY);
      const bw = measureOCW(ctxFore, boldTxt, soloSz, bTrack3);
      ov.recordSceneBox(cap, W, H, heroX - bw * 0.5, waistY - soloSz, bw, soloSz * 1.25);
      ctxFore.restore();
    }

  } else {
    // MODE 4: Cinema Serif Bloom ('WELCOME HOME' + soft-lit 'Timeless Design' + delicate gold hairline)
    const n = words.length;
    const splitAt = n <= 2 ? 0 : Math.min(2, Math.floor(n / 2));
    const headWords = splitAt > 0 ? words.slice(0, splitAt) : [];
    const mainWords = words.slice(splitAt);
    const headRaw = headWords.map(w => cleanOC(w.t || w.word || '', false)).filter(Boolean).join(' ');
    const headTxt = userCase === 'lower' ? headRaw.toLowerCase() : (userCase === 'title' ? headRaw : headRaw.toUpperCase());
    const mainTxt = mainWords.map(w => cleanOC(w.t || w.word || '', true)).filter(Boolean).join(' ');
    const mStart = wordStartTime(mainWords[0], capStart + 0.14);

    if (headTxt) {
      const hTrack4 = ov.trackEmWith(0.26);
      const hSize = fitOCFont(ctxFore, headTxt, (sz) => `500 ${sz}px ${ov.pickFontFam('"Inter", "Poppins", sans-serif')}`, H * 0.020 * fontScale, H * 0.013, W * 0.86, hTrack4);
      const hP = fullInstant ? 1.0 : Math.min(1, Math.max(0, (evalT - wordStartTime(headWords[0], capStart)) / 0.14));
      if (hP > 0.01) {
        const hY4 = ocY(0.625, -0.5, Math.round(H * 0.065));
        ctxFore.save();
        ctxFore.globalAlpha = exitFade * easeOutCubic(hP);
        ctxFore.font = `500 ${hSize}px ${ov.pickFontFam('"Inter", "Poppins", sans-serif')}`;
        if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${hTrack4}em`;
        ctxFore.textAlign = 'center';
        ctxFore.textBaseline = 'alphabetic';
        ov.applyGlow(ctxFore, 'rgba(0, 0, 0, 0.62)', 6);
        ctxFore.fillStyle = ov.pickHi('#E6D5B8');
        ctxFore.fillText(headTxt, heroX, hY4);
        const hw = measureOCW(ctxFore, headTxt, hSize, hTrack4);
        ov.recordSceneBox(cap, W, H, heroX - hw * 0.5, hY4 - hSize, hw, hSize * 1.25);
        ctxFore.restore();
      }
    }

    if (mainTxt) {
      const mP = fullInstant ? 1.0 : (evalT >= mStart - 0.02 ? Math.min(1, Math.max(0, (evalT - mStart) / 0.18)) : 0);
      if (mP > 0.01) {
        const mep = easeOutCubic(mP);
        const sTrack4 = ov.trackEmWith(-0.01);
        const sFontFn = (sz) => `700 ${sz}px ${ov.pickFontFam('"Playfair Display", "Cinzel", Georgia, serif')}`;
        const sSize = fitOCFont(ctxFore, mainTxt, sFontFn, H * 0.052 * fontScale, H * 0.026, W * 0.88, sTrack4);
        const mBaseY = headTxt ? ocY(0.690, 0.5, Math.round(H * 0.065)) : ocY(0.660, 0.35, Math.round(H * 0.065));

        ctxFore.save();
        ctxFore.globalAlpha = exitFade * mep;
        ctxFore.font = sFontFn(sSize);
        if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${sTrack4}em`;
        const mw = measureOCW(ctxFore, mainTxt, sSize, sTrack4);
        ctxFore.textAlign = 'center';
        ctxFore.textBaseline = 'alphabetic';
        ov.recordSceneBox(cap, W, H, heroX - mw * 0.5, mBaseY - sSize, mw, sSize * 1.35);

        // Dark readability shadow then soft ivory serif bloom
        ctxFore.save();
        ctxFore.shadowColor = 'rgba(0, 0, 0, 0.68)';
        ctxFore.shadowBlur = 8;
        ctxFore.shadowOffsetY = 2;
        ctxFore.fillStyle = ov.pickBase('#FFF9EC');
        ctxFore.fillText(mainTxt, heroX, mBaseY);
        ctxFore.restore();

        ov.applyGlow(ctxFore, 'rgba(255, 232, 185, 0.56)', Math.max(8, Math.round(H * 0.015)));
        ctxFore.fillStyle = ov.pickBase('#FFF9EC');
        ctxFore.fillText(mainTxt, heroX, mBaseY);

        // Tapered golden horizontal hairline rule cleanly underneath
        const ruleW = Math.round(Math.min(W * 0.72, mw * 0.92) * (fullInstant ? 1.0 : mep));
        const ruleY = Math.round(mBaseY + sSize * 0.34);
        if (ov.customHighlight) {
          ctxFore.fillStyle = ov.customHighlight;
        } else {
          const rg = ctxFore.createLinearGradient(heroX - ruleW * 0.5, 0, heroX + ruleW * 0.5, 0);
          rg.addColorStop(0.0, 'rgba(223, 178, 99, 0.0)');
          rg.addColorStop(0.5, 'rgba(223, 178, 99, 0.92)');
          rg.addColorStop(1.0, 'rgba(223, 178, 99, 0.0)');
          ctxFore.fillStyle = rg;
        }
        ctxFore.fillRect(Math.round(heroX - ruleW * 0.5), ruleY, ruleW, Math.max(1.5, Math.round(H * 0.0018)));
        ctxFore.restore();
      }
    }
  }
}

function drawAuroraSpatialDepthPass(ctxFore, ctxBehind, cap, words, t, st, W, H, isBehind, showAll, isPreview) {
  if (!ctxFore || !words || !words.length) return;

  const isSampleCard = Boolean(cap && cap.id === 'preview_sample');
  const capStart = (cap && typeof cap.start === 'number') ? cap.start : (words[0] && typeof words[0].s === 'number' ? words[0].s : 0);
  const capEnd = (cap && typeof cap.end === 'number') ? cap.end : (words[words.length - 1] && typeof words[words.length - 1].e === 'number' ? words[words.length - 1].e : capStart + 2.5);
  const hasValidT = (typeof t === 'number' && !isNaN(t));
  const evalT = isSampleCard ? (capStart + 999) : (hasValidT ? t : (capStart + 1.0));
  const fullInstant = isSampleCard || !hasValidT || Boolean(showAll && evalT <= capStart + 0.04);

  const timeRem = fullInstant ? 1.0 : Math.max(0, capEnd - evalT);
  const exitFade = fullInstant ? 1.0 : Math.min(1, timeRem / 0.14);
  if (exitFade <= 0.005) return;

  const targetBehind = (isBehind && ctxBehind) ? ctxBehind : ctxFore;
  const capsList = (typeof S !== 'undefined' && S && Array.isArray(S.captions)) ? S.captions : [];
  const foundIdx = (cap && capsList.length > 0) ? capsList.indexOf(cap) : -1;
  const rawIdx = (cap && cap.index != null) ? Number(cap.index) - 1 : parseInt(cap && cap.id, 10) - 1;
  const capIdx = foundIdx >= 0 ? foundIdx : (!isNaN(rawIdx) && rawIdx >= 0 ? rawIdx : 0);

  const userCase = st && st.textCase;
  const cleanAS = (raw, keepPunct) => {
    const s = String(raw || '').replace(/^["'’()[\]{}]+|["'’()[\]{}]+$/g, '').trim();
    const out = keepPunct ? s.replace(/[:;]+$/g, '') : s.replace(/[.,!?;:]+$/g, '');
    if (userCase === 'upper') return out.toUpperCase();
    if (userCase === 'lower') return out.toLowerCase();
    return out;
  };
  const wordStartTime = (w, fallback) => (w && typeof w.s === 'number') ? w.s : ((w && typeof w.start === 'number') ? w.start : fallback);
  const easeOutCubic = (x) => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);
  const measureASW = (ctx, text, fontSize, trackEm) => {
    if (!text) return 0;
    const m = ctx.measureText(text);
    const w = (m && typeof m.width === 'number') ? m.width : text.length * fontSize * 0.56;
    if ('letterSpacing' in ctx) return w;
    return Math.max(0, w + Math.max(0, text.length - 1) * fontSize * (trackEm || 0));
  };
  const fitASFont = (ctx, text, fontStrFn, idealPx, minPx, maxW, trackEm) => {
    let size = Math.round(idealPx);
    if (!text) return size;
    ctx.save();
    ctx.font = fontStrFn(size);
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${trackEm || 0}em`;
    const rawW = measureASW(ctx, text, size, trackEm);
    ctx.restore();
    if (rawW > maxW && rawW > 0) size = Math.max(Math.round(minPx), Math.floor(size * (maxW / rawW)));
    return size;
  };
  const drawASRoundRect = (ctx, x, y, w, h, r) => {
    const rad = Math.min(r, w * 0.5, h * 0.5);
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') { ctx.roundRect(x, y, w, h, rad); return; }
    ctx.moveTo(x + rad, y);
    ctx.lineTo(x + w - rad, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
    ctx.lineTo(x + w, y + h - rad);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
    ctx.lineTo(x + rad, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
    ctx.lineTo(x, y + rad);
    ctx.quadraticCurveTo(x, y, x + rad, y);
    ctx.closePath();
  };
  const pickBestHeroIdx = (arr) => {
    const stopSet = new Set(['a', 'an', 'the', 'to', 'at', 'in', 'on', 'of', 'for', 'with', 'and', 'or', 'your', 'you', 'own', 'level', 'up', 'never', 'settle', 'make', 'it', 'vision']);
    let bestI = 0;
    let bestScore = -999;
    for (let i = 0; i < arr.length; i++) {
      if (!arr[i]) continue;
      const cl = cleanAS(arr[i].t || arr[i].word || '', false);
      const s = cl.length * 2 + (arr[i].key ? 200 : 0) - (stopSet.has(cl.toLowerCase()) ? 14 : 0);
      if (s > bestScore) { bestScore = s; bestI = i; }
    }
    return bestI;
  };
  const isMultiplierMetric = (raw) => /^\$?\d[\d,.]*(?:x|%|k|m|b|cr)?$/i.test(String(raw || '').replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'’]/g, ''));

  const heroX = Math.round(W * 0.50);
  const fontScale = Math.max(0.5, Math.min(2.0, Number(st?.fontScale) || 1.0));
  const ov = resolveSceneStyleOverrides(st, H);
  const posY = (y) => Math.round(y + ov.posDeltaY);
  const asY = (ratio, rowIdx, lineStep) => posY(H * ratio + (rowIdx || 0) * (lineStep || 0) * (ov.lineSpacingMult - 1.0));

  const metricIdx = words.findIndex(w => isMultiplierMetric(w.t || w.word || ''));
  let styleMode = 1;
  if (isSampleCard) {
    styleMode = 1;
  } else if (metricIdx !== -1 && capIdx % 4 !== 1 && capIdx % 4 !== 2) {
    styleMode = 4;
  } else {
    styleMode = (capIdx % 4) + 1;
  }

  if (styleMode === 1) {
    // MODE 1: Holographic Chrome Behind ('EVOLVE') + Spatial Prism Rim Pill ('LEVEL UP') + Iridescent Line ('your reality')
    const bIdx = pickBestHeroIdx(words);
    const heroRaw = isSampleCard ? 'EVOLVE' : cleanAS(words[bIdx]?.t || words[bIdx]?.word || '', false);
    const behindTxt = heroRaw ? (userCase === 'lower' ? heroRaw.toLowerCase() : heroRaw.toUpperCase()) : 'EVOLVE';
    const bStart = wordStartTime(words[bIdx], capStart + 0.04);

    const remaining = isSampleCard ? [{ t: 'LEVEL', s: 0 }, { t: 'UP', s: 0 }, { t: 'your', s: 0 }, { t: 'reality', s: 0 }] : frontWordsForBehindHero(words, bIdx);
    let pillWords = [], subWords = [];
    if (remaining.length >= 3) {
      const splitAt = Math.min(2, Math.floor(remaining.length / 2));
      pillWords = remaining.slice(0, splitAt);
      subWords = remaining.slice(splitAt);
    } else if (remaining.length === 2) {
      pillWords = [remaining[0]];
      subWords = [remaining[1]];
    } else {
      subWords = remaining;
    }

    // 1. Holographic Iridescent Metallic Chrome behind speaker crown
    const hTrack1 = ov.trackEmWith(0.01);
    const holoFontFn = (sz) => `700 ${sz}px ${ov.pickFontFam('"Anton", "Montserrat", sans-serif')}`;
    const rawHSize = fitASFont(targetBehind, behindTxt, holoFontFn, H * 0.215 * fontScale, H * 0.090, W * 0.88, hTrack1);
    const hPlace = computeBehindCrownPlacement(targetBehind, behindTxt, {
      W, H, fontFn: holoFontFn, preferredSize: rawHSize, minSize: Math.round(H * 0.080),
      trackEm: hTrack1, isSampleCard, fallbackCrownRatio: 0.23
    });
    const hSize = hPlace.size;
    const hBaseY = hPlace.baseY;
    const behindCenterY = hPlace.centerY;
    const bP = fullInstant ? 1.0 : (evalT >= bStart - 0.03 ? Math.min(1, Math.max(0, (evalT - bStart) / 0.18)) : 0);
    if (bP > 0.01) {
      const bep = easeOutCubic(bP);
      const sc = fullInstant ? 1.0 : (0.94 + 0.06 * bep);
      targetBehind.save();
      try {
        targetBehind.globalAlpha = exitFade * bep;
        targetBehind.translate(heroX, behindCenterY);
        targetBehind.scale(sc, sc);
        targetBehind.translate(-heroX, -behindCenterY);
        targetBehind.font = holoFontFn(hSize);
        if ('letterSpacing' in targetBehind) targetBehind.letterSpacing = `${hTrack1}em`;
        targetBehind.textAlign = 'center';
        targetBehind.textBaseline = 'alphabetic';

        if (ov.customHighlight) {
          targetBehind.fillStyle = ov.customHighlight;
        } else {
          const hg = targetBehind.createLinearGradient(heroX - W * 0.36, hBaseY - hSize * 0.85, heroX + W * 0.36, hBaseY + hSize * 0.08);
          hg.addColorStop(0.00, '#A5F3FC');
          hg.addColorStop(0.28, '#FFFFFF');
          hg.addColorStop(0.54, '#C4B5FD');
          hg.addColorStop(0.78, '#93C5FD');
          hg.addColorStop(1.00, '#F9A8D4');
          targetBehind.fillStyle = hg;
        }
        ov.applyGlow(targetBehind, 'rgba(0, 0, 0, 0.65)', Math.max(6, Math.round(H * 0.012)));
        targetBehind.shadowOffsetY = Math.round(H * 0.004);
        targetBehind.fillText(behindTxt, heroX, hBaseY);

        ov.applyGlow(targetBehind, 'rgba(103, 232, 249, 0.55)', Math.max(4, Math.round(H * 0.008)));
        if (ov.customHighlight) {
          targetBehind.strokeStyle = ov.customHighlight;
        } else {
          const rimG = targetBehind.createLinearGradient(heroX - W * 0.36, 0, heroX + W * 0.36, 0);
          rimG.addColorStop(0.0, 'rgba(34, 211, 238, 0.85)');
          rimG.addColorStop(0.5, 'rgba(255, 255, 255, 0.90)');
          rimG.addColorStop(1.0, 'rgba(236, 72, 153, 0.85)');
          targetBehind.strokeStyle = rimG;
        }
        targetBehind.lineWidth = Math.max(1.2, H * 0.0014);
        targetBehind.strokeText(behindTxt, heroX, hBaseY);
      } finally {
        targetBehind.restore();
      }
    }

    // 2. Spatial Glass Pill ('LEVEL UP') with cyan-magenta gradient rim border
    if (pillWords.length > 0) {
      const pRaw = pillWords.map(w => cleanAS(w.t || w.word || '', false)).filter(Boolean).join(' ');
      const pTxt = userCase === 'lower' ? pRaw.toLowerCase() : (userCase === 'title' ? pRaw : pRaw.toUpperCase());
      const pStart = wordStartTime(pillWords[0], capStart + 0.16);
      const pP = fullInstant ? 1.0 : (evalT >= pStart - 0.02 ? Math.min(1, Math.max(0, (evalT - pStart) / 0.16)) : 0);
      if (pTxt && pP > 0.01) {
        const pep = easeOutCubic(pP);
        const pTrack1 = ov.trackEmWith(0.06);
        const pFontFn = (sz) => `600 ${sz}px ${ov.pickFontFam('"Inter", "Poppins", sans-serif')}`;
        const pSize = fitASFont(ctxFore, pTxt, pFontFn, H * 0.028 * fontScale, H * 0.018, W * 0.72, pTrack1);
        const pCy = asY(0.628, 0, Math.round(H * 0.07));
        ctxFore.save();
        try {
          ctxFore.globalAlpha = exitFade * pep;
          ctxFore.font = pFontFn(pSize);
          if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${pTrack1}em`;
          const tw = measureASW(ctxFore, pTxt, pSize, pTrack1);
          const pw = Math.round(tw + pSize * 1.45);
          const ph = Math.round(pSize * 2.05);
          const px = Math.round(heroX - pw * 0.5);
          const py = Math.round(pCy - ph * 0.5);
          ov.recordSceneBox(cap, W, H, px, py, pw, ph);

          ov.applyGlow(ctxFore, 'rgba(139, 92, 246, 0.65)', Math.max(8, Math.round(H * 0.014)));
          const bgG = ctxFore.createLinearGradient(0, py, 0, py + ph);
          bgG.addColorStop(0.0, 'rgba(16, 28, 42, 0.72)');
          bgG.addColorStop(1.0, 'rgba(12, 16, 26, 0.88)');
          drawASRoundRect(ctxFore, px, py, pw, ph, ph * 0.5);
          ctxFore.fillStyle = bgG;
          ctxFore.fill();

          ctxFore.shadowColor = 'transparent';
          if (ov.customHighlight) {
            ctxFore.strokeStyle = ov.customHighlight;
          } else {
            const bG = ctxFore.createLinearGradient(px, 0, px + pw, 0);
            bG.addColorStop(0.0, '#22D3EE');
            bG.addColorStop(0.5, '#A855F7');
            bG.addColorStop(1.0, '#EC4899');
            ctxFore.strokeStyle = bG;
          }
          ctxFore.lineWidth = Math.max(1.8, Math.round(H * 0.0020));
          ctxFore.stroke();

          ctxFore.textAlign = 'center';
          ctxFore.textBaseline = 'middle';
          ctxFore.fillStyle = ov.pickBase('#E0F7FF');
          ctxFore.fillText(pTxt, heroX, pCy + Math.round(pSize * 0.05));
        } finally {
          ctxFore.restore();
        }
      }
    }

    // 3. Pastel Prism Shimmer Foreground Line ('your reality')
    if (subWords.length > 0) {
      const sTxt = subWords.map(w => cleanAS(w.t || w.word || '', true)).filter(Boolean).join(' ');
      const sStart = wordStartTime(subWords[0], capStart + 0.34);
      const sP = fullInstant ? 1.0 : (evalT >= sStart - 0.02 ? Math.min(1, Math.max(0, (evalT - sStart) / 0.16)) : 0);
      if (sTxt && sP > 0.01) {
        const sep = easeOutCubic(sP);
        const sTrack1 = ov.trackEmWith(-0.02);
        const sFontFn = (sz) => `600 ${sz}px ${ov.pickFontFam('"Inter", "Poppins", sans-serif')}`;
        const sSize = fitASFont(ctxFore, sTxt, sFontFn, H * 0.044 * fontScale, H * 0.022, W * 0.86, sTrack1);
        const sBaseY = pillWords.length > 0 ? asY(0.708, 1, Math.round(H * 0.07)) : asY(0.665, 0, Math.round(H * 0.07));
        ctxFore.save();
        ctxFore.globalAlpha = exitFade * sep;
        ctxFore.font = sFontFn(sSize);
        if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${sTrack1}em`;
        const sw = measureASW(ctxFore, sTxt, sSize, sTrack1);
        ctxFore.textAlign = 'center';
        ctxFore.textBaseline = 'alphabetic';
        ov.applyGlow(ctxFore, 'rgba(0, 0, 0, 0.70)', 8);
        ctxFore.shadowOffsetY = 2;
        if (ov.customBase) {
          ctxFore.fillStyle = ov.customBase;
        } else {
          const sg = ctxFore.createLinearGradient(heroX - sw * 0.5, 0, heroX + sw * 0.5, 0);
          sg.addColorStop(0.0, '#FFFFFF');
          sg.addColorStop(0.45, '#FFFFFF');
          sg.addColorStop(0.75, '#C4B5FD');
          sg.addColorStop(1.0, '#F9A8D4');
          ctxFore.fillStyle = sg;
        }
        ctxFore.fillText(sTxt, heroX, sBaseY);
        ov.recordSceneBox(cap, W, H, heroX - sw * 0.5, sBaseY - sSize, sw, sSize * 1.25);
        ctxFore.restore();
      }
    }

  } else if (styleMode === 2) {
    // MODE 2: Crisp Lead ('never settle for') + Heavy Uppercase Sliced by Chromatic Laser Flare ('ORDINARY')
    const pIdx = pickBestHeroIdx(words);
    const spAS = splitChronologicalAroundHero(words, pIdx, (v) => cleanAS(v, true));
    const keyRaw2 = spAS.heroTxt || 'ORDINARY';
    const keyTxt = userCase === 'lower' ? keyRaw2.toLowerCase() : (userCase === 'title' ? keyRaw2 : keyRaw2.toUpperCase());
    const beforeTxt = spAS.beforeTxt;
    const afterTxt = spAS.afterTxt;
    const beforeStart = spAS.beforeWords.length ? wordStartTime(spAS.beforeWords[0], capStart) : capStart;
    const keyStart = wordStartTime(words[pIdx], spAS.beforeWords.length ? beforeStart + 0.16 : capStart);
    const afterStart = spAS.afterWords.length ? wordStartTime(spAS.afterWords[0], keyStart + 0.16) : keyStart;

    const rTrack2 = ov.trackEmWith(-0.02);
    const drawASRowText = (txt, yRatio, rowIdx, startT) => {
      if (!txt) return;
      const lP = fullInstant ? 1.0 : (evalT >= startT - 0.02 ? Math.min(1, Math.max(0, (evalT - startT) / 0.14)) : 0);
      if (lP <= 0.01) return;
      const lSize = fitASFont(ctxFore, txt, (sz) => `600 ${sz}px ${ov.pickFontFam('"Inter", "Poppins", sans-serif')}`, H * 0.034 * fontScale, H * 0.018, W * 0.86, rTrack2);
      const yPx = asY(yRatio, rowIdx, Math.round(H * 0.07));
      ctxFore.save();
      ctxFore.globalAlpha = exitFade * easeOutCubic(lP);
      ctxFore.font = `600 ${lSize}px ${ov.pickFontFam('"Inter", "Poppins", sans-serif')}`;
      if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${rTrack2}em`;
      ctxFore.textAlign = 'center';
      ctxFore.textBaseline = 'alphabetic';
      ov.applyGlow(ctxFore, 'rgba(0, 0, 0, 0.68)', 8);
      ctxFore.fillStyle = ov.pickBase('#FFFFFF');
      ctxFore.fillText(txt, heroX, yPx);
      const lw = measureASW(ctxFore, txt, lSize, rTrack2);
      ov.recordSceneBox(cap, W, H, heroX - lw * 0.5, yPx - lSize, lw, lSize * 1.25);
      ctxFore.restore();
    };

    const keyYRatio = (beforeTxt && afterTxt) ? 0.642 : (beforeTxt ? 0.654 : (afterTxt ? 0.600 : 0.618));
    if (beforeTxt) drawASRowText(beforeTxt, afterTxt ? 0.542 : 0.562, -0.5, beforeStart);

    const kP = fullInstant ? 1.0 : (evalT >= keyStart - 0.03 ? Math.min(1, Math.max(0, (evalT - keyStart) / 0.16)) : 0);
    if (keyTxt && kP > 0.01) {
      const kep = easeOutCubic(kP);
      const kTrack2 = ov.trackEmWith(0.01);
      const kFontFn = (sz) => `700 ${sz}px ${ov.pickFontFam('"Anton", "Montserrat", sans-serif')}`;
      const kSize = fitASFont(ctxFore, keyTxt, kFontFn, H * 0.098 * fontScale, H * 0.044, W * 0.86, kTrack2);
      const kBaseY = asY(keyYRatio, 0, Math.round(H * 0.07));
      const kCy = Math.round(kBaseY - kSize * 0.36);

      ctxFore.save();
      ctxFore.font = kFontFn(kSize);
      if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${kTrack2}em`;
      const kw = measureASW(ctxFore, keyTxt, kSize, kTrack2);
      ctxFore.globalAlpha = exitFade * kep;
      ov.recordSceneBox(cap, W, H, heroX - kw * 0.5, kBaseY - kSize, kw, kSize * 1.2);

      // Anamorphic Cyan-to-Magenta Horizontal Laser Flare behind punch word
      const drawFlareEllipse = (cx, cy, rx, ry, colA, colB) => {
        ctxFore.save();
        ctxFore.translate(cx, cy);
        ctxFore.scale(1, ry / Math.max(1, rx));
        const g = ctxFore.createRadialGradient(0, 0, 2, 0, 0, rx);
        g.addColorStop(0.0, colA);
        g.addColorStop(0.55, colB);
        g.addColorStop(1.0, 'rgba(0,0,0,0)');
        ctxFore.fillStyle = g;
        ctxFore.beginPath();
        ctxFore.arc(0, 0, rx, 0, Math.PI * 2);
        ctxFore.fill();
        ctxFore.restore();
      };
      const flareW = Math.max(W * 0.42, kw * 0.66) * (fullInstant ? 1.0 : Math.min(1, kep * 1.15));
      drawFlareEllipse(heroX - kw * 0.18, kCy, flareW, kSize * 0.62, 'rgba(0, 240, 255, 0.85)', 'rgba(34, 211, 238, 0.36)');
      drawFlareEllipse(heroX + kw * 0.18, kCy, flareW, kSize * 0.62, 'rgba(236, 72, 153, 0.85)', 'rgba(168, 85, 247, 0.36)');
      drawFlareEllipse(heroX, kCy, flareW * 1.25, Math.max(3, kSize * 0.08), 'rgba(255, 255, 255, 0.72)', 'rgba(103, 232, 249, 0.28)');

      // Chromatic Aberration Edge Splits + Pure Stark White Main Fill
      const shiftX = Math.max(1.8, Math.round(W * 0.0032));
      ctxFore.textAlign = 'center';
      ctxFore.textBaseline = 'alphabetic';
      ctxFore.fillStyle = 'rgba(0, 240, 255, 0.72)';
      ctxFore.fillText(keyTxt, heroX - shiftX, kBaseY);
      ctxFore.fillStyle = 'rgba(236, 72, 153, 0.72)';
      ctxFore.fillText(keyTxt, heroX + shiftX, kBaseY);

      ov.applyGlow(ctxFore, 'rgba(255, 255, 255, 0.45)', Math.max(4, Math.round(H * 0.008)));
      ctxFore.fillStyle = ov.pickHi('#FFFFFF');
      ctxFore.fillText(keyTxt, heroX, kBaseY);
      ctxFore.restore();
    }

    if (afterTxt) drawASRowText(afterTxt, beforeTxt ? 0.715 : 0.675, 0.5, afterStart);

  } else if (styleMode === 3) {
    // MODE 3: Aurora Neon Wireframe Behind ('FUTURE') + Clean White Sans ('own the') + Glowing Script ('moment.')
    const bIdx = pickBestHeroIdx(words);
    const heroRaw = cleanAS(words[bIdx]?.t || words[bIdx]?.word || '', false);
    const behindTxt = heroRaw ? (userCase === 'lower' ? heroRaw.toLowerCase() : heroRaw.toUpperCase()) : 'FUTURE';
    const bStart = wordStartTime(words[bIdx], capStart + 0.04);

    const remaining = frontWordsForBehindHero(words, bIdx);
    const scriptWord = remaining.length >= 1 ? remaining[remaining.length - 1] : null;
    const leadWords = remaining.length > 1 ? remaining.slice(0, -1) : [];

    // 1. Aurora Gradient Neon Wireframe on targetBehind
    const wTrack3 = ov.trackEmWith(0.015);
    const wireFontFn = (sz) => `700 ${sz}px ${ov.pickFontFam('"Anton", "Montserrat", sans-serif')}`;
    const rawWSize = fitASFont(targetBehind, behindTxt, wireFontFn, H * 0.225 * fontScale, H * 0.095, W * 0.88, wTrack3);
    const wPlace = computeBehindCrownPlacement(targetBehind, behindTxt, {
      W, H, fontFn: wireFontFn, preferredSize: rawWSize, minSize: Math.round(H * 0.080),
      trackEm: wTrack3, isSampleCard, fallbackCrownRatio: 0.23
    });
    const wSize = wPlace.size;
    const wBaseY = wPlace.baseY;
    const bP = fullInstant ? 1.0 : (evalT >= bStart - 0.03 ? Math.min(1, Math.max(0, (evalT - bStart) / 0.18)) : 0);
    if (bP > 0.01) {
      const bep = easeOutCubic(bP);
      targetBehind.save();
      try {
        targetBehind.globalAlpha = exitFade * bep;
        targetBehind.font = wireFontFn(wSize);
        if ('letterSpacing' in targetBehind) targetBehind.letterSpacing = `${wTrack3}em`;
        targetBehind.textAlign = 'center';
        targetBehind.textBaseline = 'alphabetic';

        targetBehind.fillStyle = 'rgba(180, 245, 255, 0.08)';
        targetBehind.fillText(behindTxt, heroX, wBaseY);

        if (ov.customHighlight) {
          targetBehind.strokeStyle = ov.customHighlight;
        } else {
          const ag = targetBehind.createLinearGradient(heroX - W * 0.38, 0, heroX + W * 0.38, 0);
          ag.addColorStop(0.00, '#2EE8B6');
          ag.addColorStop(0.35, '#38BDF8');
          ag.addColorStop(0.68, '#A855F7');
          ag.addColorStop(1.00, '#EC4899');
          targetBehind.strokeStyle = ag;
        }
        ov.applyGlow(targetBehind, 'rgba(56, 189, 248, 0.65)', Math.max(8, Math.round(H * 0.012)));
        targetBehind.lineWidth = Math.max(2.0, Math.round(H * 0.0024));
        targetBehind.lineJoin = 'round';
        targetBehind.strokeText(behindTxt, heroX, wBaseY);
      } finally {
        targetBehind.restore();
      }
    }

    // 2. Sans Lead + Glowing Brush Script ('own the' + 'moment.')
    const leadTxt = leadWords.map(w => cleanAS(w.t || w.word || '', true)).filter(Boolean).join(' ');
    const scriptTxt = scriptWord ? cleanAS(scriptWord.t || scriptWord.word || '', true) : '';
    const baseWaistY = posY(H * 0.622);
    if (leadTxt) {
      const lP = fullInstant ? 1.0 : (evalT >= wordStartTime(leadWords[0], capStart + 0.15) - 0.02 ? Math.min(1, Math.max(0, (evalT - wordStartTime(leadWords[0], capStart + 0.15)) / 0.14)) : 0);
      if (lP > 0.01) {
        const lTrack3 = ov.trackEmWith(-0.02);
        const lSz = fitASFont(ctxFore, leadTxt, (sz) => `700 ${sz}px ${ov.pickFontFam('"Inter", "Poppins", sans-serif')}`, H * 0.044 * fontScale, H * 0.022, W * 0.84, lTrack3);
        ctxFore.save();
        ctxFore.globalAlpha = exitFade * easeOutCubic(lP);
        ctxFore.font = `700 ${lSz}px ${ov.pickFontFam('"Inter", "Poppins", sans-serif')}`;
        if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${lTrack3}em`;
        ctxFore.textAlign = 'center';
        ctxFore.textBaseline = 'alphabetic';
        ov.applyGlow(ctxFore, 'rgba(0, 0, 0, 0.68)', 8);
        ctxFore.fillStyle = ov.pickBase('#FFFFFF');
        ctxFore.fillText(leadTxt, heroX, baseWaistY);
        const lw = measureASW(ctxFore, leadTxt, lSz, lTrack3);
        ov.recordSceneBox(cap, W, H, heroX - lw * 0.5, baseWaistY - lSz, lw, lSz * 1.25);
        ctxFore.restore();
      }
    }
    if (scriptTxt) {
      const scStart = wordStartTime(scriptWord, capStart + 0.34);
      const scP = fullInstant ? 1.0 : (evalT >= scStart - 0.02 ? Math.min(1, Math.max(0, (evalT - scStart) / 0.16)) : 0);
      if (scP > 0.01) {
        const scTrack3 = ov.trackEmWith(0);
        const scFontFn = (sz) => `400 ${sz}px ${ov.pickFontFam('"Yellowtail", "Great Vibes", cursive')}`;
        const scSz = fitASFont(ctxFore, scriptTxt, scFontFn, H * 0.072 * fontScale, H * 0.036, W * 0.86, scTrack3);
        const scY = leadTxt ? Math.round(baseWaistY + scSz * 0.62 * ov.lineSpacingMult) : baseWaistY;
        ctxFore.save();
        ctxFore.globalAlpha = exitFade * easeOutCubic(scP);
        ctxFore.translate(heroX, scY);
        ctxFore.rotate(-0.05);
        ctxFore.font = scFontFn(scSz);
        if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${scTrack3}em`;
        ctxFore.textAlign = 'center';
        ctxFore.textBaseline = 'alphabetic';
        ov.applyGlow(ctxFore, 'rgba(190, 242, 255, 0.68)', Math.max(8, Math.round(H * 0.014)));
        ctxFore.fillStyle = ov.pickHi('#FFFFFF');
        ctxFore.fillText(scriptTxt, 0, 0);
        const scw = measureASW(ctxFore, scriptTxt, scSz, scTrack3);
        ov.recordSceneBox(cap, W, H, heroX - scw * 0.5, scY - scSz * 0.8, scw, scSz * 1.2);
        ctxFore.restore();
      }
    }

  } else {
    // MODE 4: 3D Metallic Gold & Matte Obsidian Extrusion Behind ('100X') + HUD Pill ('01 // VISION') + Warm Ivory Climax ('Make It Real.')
    const bIdx = metricIdx !== -1 ? metricIdx : pickBestHeroIdx(words);
    const heroRaw = cleanAS(words[bIdx]?.t || words[bIdx]?.word || '', false);
    const behindTxt = heroRaw ? (userCase === 'lower' ? heroRaw.toLowerCase() : heroRaw.toUpperCase()) : '100X';
    const bStart = wordStartTime(words[bIdx], capStart + 0.04);

    const remaining = frontWordsForBehindHero(words, bIdx);
    let hudWords = [], climaxWords = [];
    if (remaining.length >= 5) {
      hudWords = remaining.slice(0, 2);
      climaxWords = remaining.slice(2);
    } else if (remaining.length >= 2) {
      hudWords = [remaining[0]];
      climaxWords = remaining.slice(1);
    } else {
      climaxWords = remaining;
    }

    // 1. 3D Extruded Obsidian Face + Liquid Gold Side Bevel Depth on targetBehind
    const gTrack4 = ov.trackEmWith(-0.01);
    const gFontFn = (sz) => `700 ${sz}px ${ov.pickFontFam('"Anton", "Montserrat", sans-serif')}`;
    const rawGSize = fitASFont(targetBehind, behindTxt, gFontFn, H * (behindTxt.length <= 4 ? 0.255 : 0.19) * fontScale, H * 0.095, W * 0.88, gTrack4);
    const gPlace = computeBehindCrownPlacement(targetBehind, behindTxt, {
      W, H, fontFn: gFontFn, preferredSize: rawGSize, minSize: Math.round(H * 0.085),
      trackEm: gTrack4, isSampleCard, fallbackCrownRatio: 0.235
    });
    const gSize = gPlace.size;
    const gBaseY = gPlace.baseY;
    const behindCenterY = gPlace.centerY;
    const bP = fullInstant ? 1.0 : (evalT >= bStart - 0.03 ? Math.min(1, Math.max(0, (evalT - bStart) / 0.18)) : 0);
    if (bP > 0.01) {
      const bep = easeOutCubic(bP);
      const sc = fullInstant ? 1.0 : (0.94 + 0.06 * bep);
      targetBehind.save();
      try {
        targetBehind.globalAlpha = exitFade * bep;
        targetBehind.translate(heroX, behindCenterY);
        targetBehind.scale(sc, sc);
        targetBehind.translate(-heroX, -behindCenterY);
        targetBehind.font = gFontFn(gSize);
        if ('letterSpacing' in targetBehind) targetBehind.letterSpacing = `${gTrack4}em`;
        targetBehind.textAlign = 'center';
        targetBehind.textBaseline = 'alphabetic';

        let extFill;
        if (ov.customHighlight) {
          extFill = ov.customHighlight;
        } else {
          const extG = targetBehind.createLinearGradient(0, gBaseY - gSize * 0.85, 0, gBaseY + gSize * 0.08);
          extG.addColorStop(0.0, '#FDE68A');
          extG.addColorStop(0.5, '#D99B38');
          extG.addColorStop(1.0, '#8C5A12');
          extFill = extG;
        }
        const depthSteps = Math.max(4, Math.round(H * 0.006));
        for (let k = depthSteps; k >= 1; k--) {
          targetBehind.fillStyle = extFill;
          targetBehind.fillText(behindTxt, heroX + k * 1.15, gBaseY + k * 1.15);
        }

        const faceG = targetBehind.createLinearGradient(0, gBaseY - gSize * 0.85, 0, gBaseY + gSize * 0.06);
        faceG.addColorStop(0.0, '#2A2D36');
        faceG.addColorStop(0.5, '#0F1116');
        faceG.addColorStop(1.0, '#1D2028');
        ov.applyGlow(targetBehind, 'rgba(0, 0, 0, 0.65)', Math.max(6, Math.round(H * 0.010)));
        targetBehind.fillStyle = faceG;
        targetBehind.fillText(behindTxt, heroX, gBaseY);

        targetBehind.shadowColor = 'transparent';
        targetBehind.strokeStyle = extFill;
        targetBehind.lineWidth = Math.max(1.4, H * 0.0018);
        targetBehind.strokeText(behindTxt, heroX, gBaseY);
      } finally {
        targetBehind.restore();
      }
    }

    // 2. Spatial HUD Index Pill ('01 // VISION') with glowing gold dot
    if (hudWords.length > 0) {
      const rawH = hudWords.map(w => cleanAS(w.t || w.word || '', false)).filter(Boolean).join(' ');
      const rawHud = userCase === 'lower' ? rawH.toLowerCase() : (userCase === 'title' ? rawH : rawH.toUpperCase());
      const hudTxt = /\d|\/\//.test(rawHud) ? rawHud : `${String(capIdx + 1).padStart(2, '0')} // ${rawHud}`;
      const hStart = wordStartTime(hudWords[0], capStart + 0.16);
      const hP = fullInstant ? 1.0 : (evalT >= hStart - 0.02 ? Math.min(1, Math.max(0, (evalT - hStart) / 0.15)) : 0);
      if (rawHud && hP > 0.01) {
        const hep = easeOutCubic(hP);
        const hTrack4 = ov.trackEmWith(0.10);
        const hudFontFn = (sz) => `500 ${sz}px ${ov.pickFontFam('"Inter", "Space Mono", sans-serif')}`;
        const hudSz = fitASFont(ctxFore, hudTxt, hudFontFn, H * 0.021 * fontScale, H * 0.014, W * 0.72, hTrack4);
        const hCy = asY(0.625, 0, Math.round(H * 0.07));
        ctxFore.save();
        try {
          ctxFore.globalAlpha = exitFade * hep;
          ctxFore.font = hudFontFn(hudSz);
          if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${hTrack4}em`;
          const tw = measureASW(ctxFore, hudTxt, hudSz, hTrack4);
          const dotR = Math.max(3, Math.round(hudSz * 0.22));
          const pw = Math.round(tw + hudSz * 1.9 + dotR * 2);
          const ph = Math.round(hudSz * 2.15);
          const px = Math.round(heroX - pw * 0.5);
          const py = Math.round(hCy - ph * 0.5);
          ov.recordSceneBox(cap, W, H, px, py, pw, ph);

          ov.applyGlow(ctxFore, 'rgba(0, 0, 0, 0.55)', 14);
          ctxFore.shadowOffsetY = 4;
          drawASRoundRect(ctxFore, px, py, pw, ph, ph * 0.5);
          ctxFore.fillStyle = 'rgba(16, 18, 24, 0.84)';
          ctxFore.fill();

          ctxFore.shadowColor = 'transparent';
          ctxFore.strokeStyle = 'rgba(255, 255, 255, 0.25)';
          ctxFore.lineWidth = Math.max(1.0, H * 0.0012);
          ctxFore.stroke();

          ctxFore.save();
          ctxFore.shadowColor = ov.customHighlight || 'rgba(253, 230, 138, 0.85)';
          ctxFore.shadowBlur = 8;
          ctxFore.fillStyle = ov.pickHi('#FDE68A');
          ctxFore.beginPath();
          ctxFore.arc(Math.round(px + ph * 0.55), hCy, dotR, 0, Math.PI * 2);
          ctxFore.fill();
          ctxFore.restore();

          ctxFore.textAlign = 'left';
          ctxFore.textBaseline = 'middle';
          ctxFore.fillStyle = ov.pickBase('#F3EAD8');
          ctxFore.fillText(hudTxt, Math.round(px + ph * 0.55 + dotR * 2 + hudSz * 0.45), hCy + Math.round(hudSz * 0.04));
        } finally {
          ctxFore.restore();
        }
      }
    }

    // 3. Glowing Ivory-Gold Climax Headline ('Make It Real.')
    if (climaxWords.length > 0) {
      const cTxt = climaxWords.map(w => cleanAS(w.t || w.word || '', true)).filter(Boolean).join(' ');
      const cStart = wordStartTime(climaxWords[0], capStart + 0.34);
      const cP = fullInstant ? 1.0 : (evalT >= cStart - 0.02 ? Math.min(1, Math.max(0, (evalT - cStart) / 0.16)) : 0);
      if (cTxt && cP > 0.01) {
        const cep = easeOutCubic(cP);
        const cTrack4 = ov.trackEmWith(-0.025);
        const cFontFn = (sz) => `700 ${sz}px ${ov.pickFontFam('"Inter", "Montserrat", sans-serif')}`;
        const cSz = fitASFont(ctxFore, cTxt, cFontFn, H * 0.052 * fontScale, H * 0.026, W * 0.86, cTrack4);
        const cBaseY = hudWords.length > 0 ? asY(0.706, 1, Math.round(H * 0.07)) : asY(0.668, 0, Math.round(H * 0.07));
        ctxFore.save();
        ctxFore.globalAlpha = exitFade * cep;
        ctxFore.font = cFontFn(cSz);
        if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${cTrack4}em`;
        ctxFore.textAlign = 'center';
        ctxFore.textBaseline = 'alphabetic';
        const cw4 = measureASW(ctxFore, cTxt, cSz, cTrack4);
        ov.recordSceneBox(cap, W, H, heroX - cw4 * 0.5, cBaseY - cSz, cw4, cSz * 1.25);

        let fillC4;
        if (ov.customBase) {
          fillC4 = ov.customBase;
        } else {
          const cg = ctxFore.createLinearGradient(0, cBaseY - cSz * 0.85, 0, cBaseY + cSz * 0.1);
          cg.addColorStop(0.0, '#FFFDF5');
          cg.addColorStop(1.0, '#FDE68A');
          fillC4 = cg;
        }

        ctxFore.save();
        ctxFore.shadowColor = 'rgba(0, 0, 0, 0.72)';
        ctxFore.shadowBlur = 8;
        ctxFore.shadowOffsetY = 2;
        ctxFore.fillStyle = fillC4;
        ctxFore.fillText(cTxt, heroX, cBaseY);
        ctxFore.restore();

        ov.applyGlow(ctxFore, 'rgba(253, 230, 138, 0.48)', Math.max(6, Math.round(H * 0.012)));
        ctxFore.fillStyle = fillC4;
        ctxFore.fillText(cTxt, heroX, cBaseY);
        ctxFore.restore();
      }
    }
  }
}

/**
 * Split caption words into strict spoken index order (before, hero, after) without reordering.
 */
function splitChronologicalAroundHero(words, heroIdx, cleanFn) {
  const safeWords = Array.isArray(words) ? words : [];
  const fmt = typeof cleanFn === 'function' ? cleanFn : (v) => String(v || '').trim();
  const hasHero = Number.isInteger(heroIdx) && heroIdx >= 0 && heroIdx < safeWords.length;
  const beforeWords = hasHero ? safeWords.slice(0, heroIdx) : safeWords;
  const heroWord = hasHero ? safeWords[heroIdx] : null;
  const afterWords = hasHero ? safeWords.slice(heroIdx + 1) : [];
  const joinWords = (arr) => arr.map(w => fmt((w && (w.t || w.word)) || '', false)).filter(Boolean).join(' ');
  return {
    beforeWords,
    heroWord,
    afterWords,
    beforeTxt: joinWords(beforeWords),
    heroTxt: heroWord ? fmt(heroWord.t || heroWord.word || '', false) : '',
    afterTxt: joinWords(afterWords)
  };
}

/**
 * Omit a behind-head hero word from foreground text only when it sits cleanly at the start or end,
 * avoiding a missing-word hole in the middle of a spoken foreground phrase.
 */
function frontWordsForBehindHero(words, heroIdx) {
  const safeWords = Array.isArray(words) ? words : [];
  if (safeWords.length <= 1 || heroIdx < 0 || heroIdx >= safeWords.length) return safeWords;
  if (heroIdx === 0 || heroIdx === safeWords.length - 1) return safeWords.filter((_, i) => i !== heroIdx);
  return safeWords;
}

/**
 * Partition 3+ words into top/mid/bot lines in strict 0..n-1 spoken order, keeping keyIdx highlighted.
 */
function splitThreeLinesChronological(words, keyIdx) {
  const n = words.length;
  const ki = Math.max(0, Math.min(n - 1, keyIdx));
  if (ki === 0) {
    return {
      top: { words: [words[0]], isGold: true },
      mid: { words: n >= 3 ? words.slice(1, n - 1) : [], isGold: false },
      bot: { words: n >= 3 ? [words[n - 1]] : words.slice(1), isGold: false }
    };
  }
  if (ki === n - 1) {
    return {
      top: { words: [words[0]], isGold: false },
      mid: { words: words.slice(1, n - 1), isGold: false },
      bot: { words: [words[n - 1]], isGold: true }
    };
  }
  return {
    top: { words: words.slice(0, ki), isGold: false },
    mid: { words: [words[ki]], isGold: true },
    bot: { words: words.slice(ki + 1), isGold: false }
  };
}

/**
 * Resolves explicit user Style overrides (highlight/base/glow colors, glow blur, font family,
 * line spacing, letter tracking, position delta) while leaving each preset's signature palette
 * intact until the user customizes a control.
 */
function resolveSceneStyleOverrides(st, H) {
  const lsRaw = (st && typeof st.lineSpacing === 'number' && st.lineSpacing > 0) ? st.lineSpacing : 1.2;
  const lineSpacingMult = Math.max(0.65, Math.min(1.8, lsRaw / 1.2));
  const letterTrackDelta = (st && typeof st.letterSpacing === 'number' && !isNaN(st.letterSpacing)) ? st.letterSpacing : 0;
  const customHighlight = (st && st._customColorActive && st.highlightColor) ? st.highlightColor : null;
  const customBase = (st && st._customBaseColorActive && st.baseColor) ? st.baseColor : null;
  const hasCustomGlow = Boolean(st && st._customGlowActive);
  const customGlow = (hasCustomGlow && st.glowColor) ? st.glowColor : null;
  const customGlowEnabled = (hasCustomGlow && typeof st.glowEnabled === 'boolean') ? st.glowEnabled : null;
  const customGlowBlur = (hasCustomGlow && typeof st.glowBlur === 'number') ? st.glowBlur : null;
  const customFont = (st && st._customFontActive && st.fontFamily) ? st.fontFamily : null;
  const customFontStr = customFont ? `"${customFont}", sans-serif` : null;
  const posYRatio = (st && Number.isFinite(Number(st.posY ?? st.position))) ? Number(st.posY ?? st.position) : null;
  const defPosY = (st && Number.isFinite(Number(st._defaultPosY))) ? Number(st._defaultPosY) : posYRatio;
  const posDeltaY = (H && posYRatio !== null && defPosY !== null) ? Math.round((posYRatio - defPosY) * H) : 0;
  return {
    lineSpacingMult,
    letterTrackDelta,
    customHighlight,
    customBase,
    hasCustomGlow,
    customGlow,
    customGlowEnabled,
    customGlowBlur,
    customFont,
    customFontStr,
    posYRatio,
    posDeltaY,
    pickHi: (fallback) => customHighlight || fallback,
    pickBase: (fallback) => customBase || fallback,
    pickFontFam: (fallbackFam) => customFontStr || fallbackFam,
    trackEmWith: (baseTrackEm) => (baseTrackEm || 0) + letterTrackDelta,
    applyGlow: (ctx, defColor, defBlur, blurScale) => {
      if (customGlowEnabled === false) {
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        return;
      }
      const gCol = customGlow || (customGlowEnabled === true ? (customHighlight || defColor || '#FFE600') : defColor);
      const baseBlur = (customGlowBlur !== null) ? customGlowBlur : (customGlowEnabled === true && !(defBlur > 0) ? 18 : (defBlur || 0));
      const finalBlur = Math.max(0, Math.round(baseBlur * (blurScale || 1)));
      if (finalBlur > 0 && gCol) {
        ctx.shadowColor = gCol;
        ctx.shadowBlur = finalBlur;
      } else {
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
      }
    },
    recordSceneBox: (cap, W, boxHRef, x0, y0, bw, bh) => {
      if (!cap || cap.id === 'preview_sample' || typeof recordLayoutBox !== 'function' || !W || !boxHRef) return;
      recordLayoutBox(cap.id, {
        x: Math.max(0.02, Math.min(0.95, x0 / W)),
        y: Math.max(0.02, Math.min(0.95, y0 / boxHRef)),
        w: Math.max(0.10, Math.min(0.96, bw / W)),
        h: Math.max(0.06, Math.min(0.85, bh / boxHRef))
      }, []);
    }
  };
}

/**
 * Shared setup, font-width measurement/fitting, word timing, and rounded-box helper
 * for multi-scene flagship behind-person caption presets.
 */
function initEditorialSceneRuntime(ctxFore, ctxBehind, cap, words, t, st, W, H, isBehind, extraStops) {
  const ov = resolveSceneStyleOverrides(st, H);
  const isSampleCard = Boolean(cap && cap.id === 'preview_sample');
  const capStart = (cap && typeof cap.start === 'number') ? cap.start : (words[0] && typeof words[0].s === 'number' ? words[0].s : 0);
  const capEnd = (cap && typeof cap.end === 'number') ? cap.end : (words[words.length - 1] && typeof words[words.length - 1].e === 'number' ? words[words.length - 1].e : capStart + 2.5);
  const hasValidT = (typeof t === 'number' && !isNaN(t));
  const evalT = isSampleCard ? (capStart + 999) : (hasValidT ? t : (capStart + 1.0));
  const fullInstant = isSampleCard || !hasValidT || (evalT <= capStart + 0.04 && Boolean(cap && cap._forceInstant));

  const timeRem = fullInstant ? 1.0 : Math.max(0, capEnd - evalT);
  const exitFade = fullInstant ? 1.0 : Math.min(1, timeRem / 0.14);
  const targetBehind = (isBehind && ctxBehind) ? ctxBehind : ctxFore;

  const capsList = (typeof S !== 'undefined' && S && Array.isArray(S.captions)) ? S.captions : [];
  const foundIdx = (cap && capsList.length > 0) ? capsList.indexOf(cap) : -1;
  const rawIdx = (cap && cap.index != null) ? Number(cap.index) - 1 : parseInt(cap && cap.id, 10) - 1;
  const capIdx = foundIdx >= 0 ? foundIdx : (!isNaN(rawIdx) && rawIdx >= 0 ? rawIdx : 0);

  const userCase = st && st.textCase;
  const cleanTok = (raw, keepPunct) => {
    const s = String(raw || '').replace(/^["'’()[\]{}]+|["'’()[\]{}]+$/g, '').trim();
    const out = keepPunct ? s.replace(/[:;]+$/g, '') : s.replace(/[.,!?;:]+$/g, '');
    if (userCase === 'upper') return out.toUpperCase();
    if (userCase === 'lower') return out.toLowerCase();
    return out;
  };
  const wordStart = (w, fallback) => (w && typeof w.s === 'number') ? w.s : ((w && typeof w.start === 'number') ? w.start : fallback);
  const easeOutCubic = (x) => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);
  const progFactor = (startTime, dur) => fullInstant ? 1.0 : (evalT >= startTime - 0.03 ? Math.min(1, Math.max(0, (evalT - startTime) / dur)) : 0);

  const measureW = (ctx, text, fontSize, trackEm) => {
    if (!text) return 0;
    const m = ctx.measureText(text);
    const w = (m && typeof m.width === 'number') ? m.width : text.length * fontSize * 0.56;
    if ('letterSpacing' in ctx) return w;
    return Math.max(0, w + Math.max(0, text.length - 1) * fontSize * (trackEm || 0));
  };
  const fitFont = (ctx, text, fontStrFn, idealPx, minPx, maxW, trackEm) => {
    let size = Math.round(idealPx);
    if (!text) return size;
    ctx.save();
    ctx.font = fontStrFn(size);
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${trackEm || 0}em`;
    const rawW = measureW(ctx, text, size, trackEm);
    ctx.restore();
    if (rawW > maxW && rawW > 0) size = Math.max(Math.round(minPx), Math.floor(size * (maxW / rawW)));
    return size;
  };
  const roundRectPath = (ctx, x, y, w, h, r) => {
    const rad = Math.min(r, w * 0.5, h * 0.5);
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') { ctx.roundRect(x, y, w, h, rad); return; }
    ctx.moveTo(x + rad, y);
    ctx.lineTo(x + w - rad, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
    ctx.lineTo(x + w, y + h - rad);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
    ctx.lineTo(x + rad, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
    ctx.lineTo(x, y + rad);
    ctx.quadraticCurveTo(x, y, x + rad, y);
    ctx.closePath();
  };
  const pickHeroIdx = (arr) => {
    const stopSet = new Set(['a', 'an', 'the', 'to', 'at', 'in', 'on', 'of', 'for', 'with', 'and', 'or', 'your', 'you', 'own', ...(extraStops || [])]);
    let bestI = 0;
    let bestScore = -999;
    for (let i = 0; i < arr.length; i++) {
      if (!arr[i]) continue;
      const cl = cleanTok(arr[i].t || arr[i].word || '', false);
      const s = cl.length * 2 + (arr[i].key ? 200 : 0) - (stopSet.has(cl.toLowerCase()) ? 14 : 0);
      if (s > bestScore) { bestScore = s; bestI = i; }
    }
    return bestI;
  };

  return {
    isSampleCard,
    capStart,
    capEnd,
    hasValidT,
    evalT,
    fullInstant,
    exitFade,
    targetBehind,
    capIdx,
    userCase,
    heroX: Math.round(W * 0.50),
    fontScale: Math.max(0.5, Math.min(2.0, Number(st?.fontScale) || 1.0)),
    cleanTok,
    wordStart,
    easeOutCubic,
    progFactor,
    measureW,
    fitFont,
    roundRectPath,
    pickHeroIdx,
    ov,
    lineSpacingMult: ov.lineSpacingMult,
    letterTrackDelta: ov.letterTrackDelta,
    customHighlight: ov.customHighlight,
    customBase: ov.customBase,
    customGlow: ov.customGlow,
    customGlowEnabled: ov.customGlowEnabled,
    customGlowBlur: ov.customGlowBlur,
    customFontStr: ov.customFontStr,
    posDeltaY: ov.posDeltaY,
    pickHi: ov.pickHi,
    pickBase: ov.pickBase,
    pickFontFam: ov.pickFontFam,
    trackEmWith: ov.trackEmWith,
    applyGlow: ov.applyGlow,
    recordSceneBox: (x0, y0, bw, bh) => ov.recordSceneBox(cap, W, H, x0, y0, bw, bh)
  };
}

/**
 * Renders the "Cobalt Archive" 4-scene preset:
 * 1) Sapphire Crown + Signal Vermilion Pill, 2) Mono Index + Italic Serif Brush Streak,
 * 3) Ice Outline + Frosted Glass Card, 4) Slanted Stacked Editorial Tags.
 */
function drawCobaltArchivePass(ctxFore, ctxBehind, cap, words, t, st, W, H, isBehind, showAll, isPreview) {
  if (!ctxFore || !words || !words.length) return;
  const capArg = (showAll && cap) ? Object.assign({}, cap, { _forceInstant: typeof t !== 'number' || isNaN(t) || t <= (cap.start || 0) + 0.04 }) : cap;
  const rt = initEditorialSceneRuntime(ctxFore, ctxBehind, capArg, words, t, st, W, H, isBehind, ['out', 'build', 'no', 'days', 'off', 'who']);
  if (rt.exitFade <= 0.005) return;

  const {
    isSampleCard, capStart, evalT, fullInstant, exitFade, targetBehind, capIdx, userCase, heroX, fontScale,
    cleanTok, wordStart, easeOutCubic, progFactor, measureW, fitFont, roundRectPath, pickHeroIdx,
    lineSpacingMult, customHighlight, pickHi, pickBase, pickFontFam, trackEmWith, applyGlow, posDeltaY, recordSceneBox
  } = rt;
  const shiftY = (y) => Math.round(y + posDeltaY);
  const isNumRatio = (raw) => /^\$?\d[\d.,]*(?:\/\d+|%|x|k|m|b|cr)?$/i.test(String(raw || '').replace(/[.,!?;:'"’()[\]{}]/g, (m) => m === '/' || m === '%' ? m : ''));

  const numIdx = words.findIndex(w => isNumRatio(w.t || w.word || ''));
  let styleMode = 1;
  if (isSampleCard) {
    styleMode = 1;
  } else if (numIdx !== -1 && capIdx % 4 !== 1 && capIdx % 4 !== 3) {
    styleMode = 3;
  } else {
    styleMode = (capIdx % 4) + 1;
  }

  if (styleMode === 1) {
    // MODE 1: Electric Sapphire Condensed Crown ('IMPACT') + Signal-Orange Pill ('STAND') + Clean White ('out.')
    const bIdx = pickHeroIdx(words);
    const heroRaw = isSampleCard ? 'IMPACT' : cleanTok(words[bIdx]?.t || words[bIdx]?.word || '', false);
    const behindTxt = heroRaw ? (userCase === 'lower' ? heroRaw.toLowerCase() : heroRaw.toUpperCase()) : 'IMPACT';
    const bStart = wordStart(words[bIdx], capStart + 0.04);

    const remaining = isSampleCard ? [{ t: 'STAND', s: 0 }, { t: 'out.', s: 0 }] : frontWordsForBehindHero(words, bIdx);
    const pillWord = remaining.length > 0 ? remaining[0] : null;
    const tailWords = remaining.length > 1 ? remaining.slice(1) : [];

    // 1. Giant Electric Klein-Blue -> Sapphire Gradient word behind crown (90% visible above hair, ~10% overlap)
    const crownFontFn = (sz) => `700 ${sz}px ${pickFontFam('"Anton", "Montserrat", sans-serif')}`;
    const cTrk = trackEmWith(-0.015);
    const rawSize = fitFont(targetBehind, behindTxt, crownFontFn, H * 0.255 * fontScale, H * 0.090, W * 0.90, cTrk);
    const place = computeBehindCrownPlacement(targetBehind, behindTxt, {
      W, H, fontFn: crownFontFn, preferredSize: rawSize, minSize: Math.round(H * 0.085),
      trackEm: cTrk, isSampleCard, fallbackCrownRatio: 0.23
    });
    const bP = progFactor(bStart, 0.18);
    if (bP > 0.01) {
      const bep = easeOutCubic(bP);
      const sc = fullInstant ? 1.0 : (0.94 + 0.06 * bep);
      targetBehind.save();
      try {
        targetBehind.globalAlpha = exitFade * bep;
        targetBehind.translate(heroX, place.centerY);
        targetBehind.scale(sc, sc);
        targetBehind.translate(-heroX, -place.centerY);
        targetBehind.font = crownFontFn(place.size);
        if ('letterSpacing' in targetBehind) targetBehind.letterSpacing = `${cTrk}em`;
        targetBehind.textAlign = 'center';
        targetBehind.textBaseline = 'alphabetic';

        const sg = targetBehind.createLinearGradient(heroX - W * 0.38, place.inkTopY, heroX + W * 0.38, place.inkBotY);
        sg.addColorStop(0.00, '#1D4ED8');
        sg.addColorStop(0.45, '#2563EB');
        sg.addColorStop(0.78, '#0EA5E9');
        sg.addColorStop(1.00, '#38BDF8');

        applyGlow(targetBehind, 'rgba(0, 0, 0, 0.58)', Math.max(6, Math.round(H * 0.012)), 1);
        targetBehind.shadowOffsetY = Math.round(H * 0.004);
        targetBehind.fillStyle = customHighlight || sg;
        targetBehind.fillText(behindTxt, heroX, place.baseY);

        targetBehind.shadowColor = 'rgba(56, 189, 248, 0.35)';
        targetBehind.shadowBlur = Math.max(4, Math.round(H * 0.008));
        targetBehind.strokeStyle = 'rgba(186, 230, 253, 0.42)';
        targetBehind.lineWidth = Math.max(1.0, H * 0.0012);
        targetBehind.strokeText(behindTxt, heroX, place.baseY);
      } finally {
        targetBehind.restore();
      }
    }

    // 2. Waist Foreground Row: Signal-Orange Pill ('STAND') + Crisp White ('out.')
    if (pillWord || tailWords.length > 0) {
      const pillTxt = pillWord ? cleanTok(pillWord.t || pillWord.word || '', false).toUpperCase() : '';
      const tailTxt = tailWords.map(w => cleanTok(w.t || w.word || '', true)).filter(Boolean).join(' ');
      const pStart = wordStart(pillWord, capStart + 0.16);
      const tStart = wordStart(tailWords[0] || pillWord, capStart + 0.28);
      const rowCy = shiftY(H * 0.642 + (lineSpacingMult - 1.0) * H * 0.024);
      const caFam = pickFontFam('"Poppins", "Montserrat", sans-serif');
      const pillFontFn = (sz) => `800 ${sz}px ${caFam}`;
      const tailFontFn = (sz) => `800 ${sz}px ${caFam}`;
      const pTrk = trackEmWith(0.01);
      const tTrk = trackEmWith(-0.02);

      let pSz = Math.round(H * 0.042 * fontScale);
      let tSz = Math.round(H * 0.048 * fontScale);
      const meas = () => {
        ctxFore.save();
        ctxFore.font = pillFontFn(pSz);
        const pwText = pillTxt ? measureW(ctxFore, pillTxt, pSz, pTrk) : 0;
        ctxFore.font = tailFontFn(tSz);
        const twText = tailTxt ? measureW(ctxFore, tailTxt, tSz, tTrk) : 0;
        ctxFore.restore();
        const padX = Math.round(pSz * 0.56);
        const pw = pillTxt ? Math.round(pwText + padX * 2) : 0;
        const gap = (pillTxt && tailTxt) ? Math.round(W * 0.024) : 0;
        return { pw, twText, gap, total: pw + gap + twText };
      };
      let dims = meas();
      if (dims.total > W * 0.88 && dims.total > 0) {
        const s = (W * 0.88) / dims.total;
        pSz = Math.max(14, Math.floor(pSz * s));
        tSz = Math.max(16, Math.floor(tSz * s));
        dims = meas();
      }
      const startX = Math.round(heroX - dims.total * 0.5);
      recordSceneBox(startX - 12, rowCy - Math.max(pSz, tSz) * 0.9, dims.total + 24, Math.max(pSz, tSz) * 1.8);

      if (pillTxt) {
        const pp = progFactor(pStart, 0.14);
        if (pp > 0.01) {
          const pep = easeOutCubic(pp);
          const sc = fullInstant ? 1.0 : (0.90 + 0.10 * pep);
          const ph = Math.round(pSz * 1.56);
          const px = startX;
          const py = Math.round(rowCy - ph * 0.5);
          const pcx = Math.round(px + dims.pw * 0.5);
          ctxFore.save();
          try {
            ctxFore.globalAlpha = exitFade * pep;
            ctxFore.translate(pcx, rowCy);
            ctxFore.scale(sc, sc);
            ctxFore.translate(-pcx, -rowCy);
            const pg = ctxFore.createLinearGradient(px, py, px, py + ph);
            pg.addColorStop(0.0, '#FF5B3A');
            pg.addColorStop(1.0, '#EA3815');
            applyGlow(ctxFore, 'rgba(0, 0, 0, 0.52)', Math.max(6, Math.round(H * 0.010)), 1);
            ctxFore.shadowOffsetY = 3;
            roundRectPath(ctxFore, px, py, dims.pw, ph, ph * 0.5);
            ctxFore.fillStyle = customHighlight || pg;
            ctxFore.fill();
            ctxFore.shadowColor = 'transparent';
            ctxFore.font = pillFontFn(pSz);
            if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${pTrk}em`;
            ctxFore.textAlign = 'center';
            ctxFore.textBaseline = 'middle';
            ctxFore.fillStyle = customHighlight ? '#0F172A' : '#FFFFFF';
            ctxFore.fillText(pillTxt, pcx, rowCy + Math.round(pSz * 0.05));
          } finally {
            ctxFore.restore();
          }
        }
      }

      if (tailTxt) {
        const tp = progFactor(tStart, 0.14);
        if (tp > 0.01) {
          const tep = easeOutCubic(tp);
          const tx = pillTxt ? (startX + dims.pw + dims.gap) : Math.round(heroX - dims.twText * 0.5);
          ctxFore.save();
          ctxFore.globalAlpha = exitFade * tep;
          ctxFore.font = tailFontFn(tSz);
          if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${tTrk}em`;
          ctxFore.textAlign = 'left';
          ctxFore.textBaseline = 'middle';
          applyGlow(ctxFore, 'rgba(0, 0, 0, 0.68)', Math.max(6, Math.round(H * 0.008)), 1);
          ctxFore.shadowOffsetY = 2;
          ctxFore.fillStyle = pickBase('#FFFFFF');
          ctxFore.fillText(tailTxt, tx, rowCy + Math.round(tSz * 0.04));
          ctxFore.restore();
        }
      }
    }
  } else if (styleMode === 2) {
    // MODE 2: Kinetic Mono Tag ('02 // CLARITY') + Serif Italic Contrast ('build real authority') + Glowing Sapphire Brush Streak
    const tagCount = words.length >= 4 ? 1 : (words.length >= 3 ? 1 : 0);
    const kickTok = tagCount > 0 ? cleanTok(words[0]?.t || words[0]?.word || '', false).toUpperCase() : 'CLARITY';
    const rawTag = /\d|\/\//.test(kickTok) ? kickTok : `${String(capIdx + 1).padStart(2, '0')} // ${kickTok}`;
    const bodyWords = words.length > 2 ? words.slice(1) : words;
    const splitAt = bodyWords.length >= 2 ? Math.max(1, bodyWords.length - 1) : 1;
    const line1Words = bodyWords.length > 1 ? bodyWords.slice(0, splitAt) : [];
    const line2Words = bodyWords.length > 1 ? bodyWords.slice(splitAt) : bodyWords;

    const tagP = progFactor(wordStart(words[0], capStart), 0.15);
    if (rawTag && tagP > 0.01) {
      const tep = easeOutCubic(tagP);
      const tFontFn = (sz) => `700 ${sz}px "Space Mono", "Inter", monospace`;
      const mTrk = trackEmWith(0.08);
      const tSz = fitFont(ctxFore, rawTag, tFontFn, H * 0.022 * fontScale, H * 0.014, W * 0.72, mTrk);
      const tCy = shiftY(H * 0.548);
      ctxFore.save();
      try {
        ctxFore.globalAlpha = exitFade * tep;
        ctxFore.font = tFontFn(tSz);
        if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${mTrk}em`;
        const tw = measureW(ctxFore, rawTag, tSz, mTrk);
        const pw = Math.round(tw + tSz * 1.55);
        const ph = Math.round(tSz * 1.95);
        const px = Math.round(heroX - pw * 0.5);
        const py = Math.round(tCy - ph * 0.5);
        const cg = ctxFore.createLinearGradient(px, py, px + pw, py + ph);
        cg.addColorStop(0.0, '#67E8F9');
        cg.addColorStop(1.0, '#22D3EE');
        applyGlow(ctxFore, customHighlight || 'rgba(34, 211, 238, 0.55)', Math.max(6, Math.round(H * 0.012)), 1);
        roundRectPath(ctxFore, px, py, pw, ph, Math.round(H * 0.008));
        ctxFore.fillStyle = customHighlight || cg;
        ctxFore.fill();
        ctxFore.shadowColor = 'transparent';
        ctxFore.fillStyle = '#061326';
        ctxFore.textAlign = 'center';
        ctxFore.textBaseline = 'middle';
        ctxFore.fillText(rawTag, heroX, tCy + Math.round(tSz * 0.04));
      } finally {
        ctxFore.restore();
      }
    }

    const line1Txt = line1Words.map(w => cleanTok(w.t || w.word || '', false)).filter(Boolean).join(' ');
    const line2Txt = line2Words.map(w => cleanTok(w.t || w.word || '', true)).filter(Boolean).join(' ');
    const sFam = pickFontFam('"Playfair Display", Georgia, serif');
    const serifFn = (sz) => `italic 700 ${sz}px ${sFam}`;
    const sTrk = trackEmWith(-0.015);
    const maxLineStr = line1Txt.length >= line2Txt.length ? line1Txt : line2Txt;
    const sSz = fitFont(ctxFore, maxLineStr || 'authority', serifFn, H * 0.056 * fontScale, H * 0.028, W * 0.86, sTrk);
    const l1Y = line1Txt ? shiftY(H * 0.616) : 0;
    const l2Y = line1Txt ? Math.round(l1Y + H * 0.062 * lineSpacingMult) : shiftY(H * 0.635);
    recordSceneBox(heroX - W * 0.42, (l1Y || l2Y) - sSz * 1.4, W * 0.84, H * 0.16 * lineSpacingMult);

    if (line1Txt) {
      const p1 = progFactor(wordStart(line1Words[0], capStart + 0.14), 0.16);
      if (p1 > 0.01) {
        ctxFore.save();
        ctxFore.globalAlpha = exitFade * easeOutCubic(p1);
        ctxFore.font = serifFn(sSz);
        if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${sTrk}em`;
        ctxFore.textAlign = 'center';
        ctxFore.textBaseline = 'alphabetic';
        applyGlow(ctxFore, 'rgba(0, 0, 0, 0.72)', Math.max(6, Math.round(H * 0.008)), 1);
        ctxFore.shadowOffsetY = 2;
        ctxFore.fillStyle = pickBase('#FFFFFF');
        ctxFore.fillText(line1Txt, heroX, l1Y);
        ctxFore.restore();
      }
    }
    if (line2Txt) {
      const p2 = progFactor(wordStart(line2Words[0], capStart + 0.24), 0.18);
      if (p2 > 0.01) {
        const pep2 = easeOutCubic(p2);
        ctxFore.save();
        ctxFore.font = serifFn(sSz);
        if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${sTrk}em`;
        const l2W = measureW(ctxFore, line2Txt, sSz, sTrk);
        ctxFore.restore();

        const brushW = Math.max(l2W + W * 0.05, W * 0.34) * (fullInstant ? 1.0 : pep2);
        const bx0 = Math.round(heroX - l2W * 0.5 - W * 0.025);
        const bx1 = bx0 + brushW;
        const by = Math.round(l2Y + Math.max(6, sSz * 0.18));
        ctxFore.save();
        ctxFore.globalAlpha = exitFade * pep2;
        const bg = ctxFore.createLinearGradient(bx0, by, bx1 + 4, by);
        bg.addColorStop(0.0, '#1D4ED8');
        bg.addColorStop(0.55, '#2563EB');
        bg.addColorStop(1.0, '#60A5FA');
        ctxFore.strokeStyle = customHighlight || bg;
        applyGlow(ctxFore, customHighlight || 'rgba(37, 99, 235, 0.85)', Math.max(8, Math.round(H * 0.014)), 1);
        ctxFore.lineCap = 'round';
        ctxFore.lineWidth = Math.max(4, Math.round(H * 0.0065));
        ctxFore.beginPath();
        ctxFore.moveTo(bx0, by + 2);
        ctxFore.quadraticCurveTo(bx0 + brushW * 0.48, by - Math.round(H * 0.005), bx1, by + 1);
        ctxFore.stroke();
        ctxFore.restore();

        ctxFore.save();
        ctxFore.globalAlpha = exitFade * pep2;
        ctxFore.font = serifFn(sSz);
        if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${sTrk}em`;
        ctxFore.textAlign = 'center';
        ctxFore.textBaseline = 'alphabetic';
        applyGlow(ctxFore, 'rgba(0, 0, 0, 0.72)', Math.max(6, Math.round(H * 0.008)), 1);
        ctxFore.shadowOffsetY = 2;
        ctxFore.fillStyle = pickBase('#FFFFFF');
        ctxFore.fillText(line2Txt, heroX, l2Y);
        ctxFore.restore();
      }
    }
  } else if (styleMode === 3) {
    // MODE 3: Ice-White Hollow Outline ('24/7') Behind (10% crown overlap) + Frosted Cobalt Glass Card ('NO DAYS OFF.')
    let bIdx = words.findIndex(w => isNumRatio(w.t || w.word || ''));
    if (bIdx === -1) bIdx = pickHeroIdx(words);
    const heroRaw = cleanTok(words[bIdx]?.t || words[bIdx]?.word || '', false);
    const behindTxt = heroRaw ? (userCase === 'lower' ? heroRaw.toLowerCase() : heroRaw.toUpperCase()) : '24/7';
    const bStart = wordStart(words[bIdx], capStart + 0.05);
    const remaining = frontWordsForBehindHero(words, bIdx);

    const isCompactMetric = behindTxt.length <= 5;
    const outFontFn = (sz) => `700 ${sz}px ${pickFontFam('"Anton", "Montserrat", sans-serif')}`;
    const oTrk = trackEmWith(0.01);
    const rawOSize = fitFont(targetBehind, behindTxt, outFontFn, H * (isCompactMetric ? 0.275 : 0.185) * fontScale, H * 0.080, W * 0.88, oTrk);
    const oPlace = computeBehindCrownPlacement(targetBehind, behindTxt, {
      W, H, fontFn: outFontFn, preferredSize: rawOSize, minSize: Math.round(H * 0.080),
      trackEm: oTrk, isSampleCard, fallbackCrownRatio: 0.23
    });
    const oP = progFactor(bStart, 0.18);
    if (oP > 0.01) {
      const oep = easeOutCubic(oP);
      const sc = fullInstant ? 1.0 : (0.94 + 0.06 * oep);
      targetBehind.save();
      try {
        targetBehind.globalAlpha = exitFade * oep;
        targetBehind.translate(heroX, oPlace.centerY);
        targetBehind.scale(sc, sc);
        targetBehind.translate(-heroX, -oPlace.centerY);
        targetBehind.font = outFontFn(oPlace.size);
        if ('letterSpacing' in targetBehind) targetBehind.letterSpacing = `${oTrk}em`;
        targetBehind.textAlign = 'center';
        targetBehind.textBaseline = 'alphabetic';
        targetBehind.fillStyle = customHighlight ? 'rgba(255, 255, 255, 0.08)' : 'rgba(219, 234, 254, 0.07)';
        targetBehind.fillText(behindTxt, heroX, oPlace.baseY);
        applyGlow(targetBehind, 'rgba(0, 0, 0, 0.48)', Math.max(6, Math.round(H * 0.010)), 1);
        targetBehind.strokeStyle = customHighlight || 'rgba(255, 255, 255, 0.94)';
        targetBehind.lineWidth = Math.max(2.2, Math.round(H * 0.0028));
        targetBehind.lineJoin = 'round';
        targetBehind.strokeText(behindTxt, heroX, oPlace.baseY);
      } finally {
        targetBehind.restore();
      }
    }

    const cardWords = remaining.length > 0 ? remaining : [{ t: 'NO', s: capStart + 0.15 }, { t: 'DAYS', s: capStart + 0.22 }, { t: 'OFF', s: capStart + 0.30 }];
    const cardTxt = cardWords.map(w => cleanTok(w.t || w.word || '', false)).filter(Boolean).join(' ').toUpperCase();
    const cp = progFactor(wordStart(cardWords[0], capStart + 0.16), 0.16);
    if (cardTxt && cp > 0.01) {
      const cep = easeOutCubic(cp);
      const cFontFn = (sz) => `700 ${sz}px ${pickFontFam('"Poppins", "Inter", sans-serif')}`;
      const cTrk = trackEmWith(0.03);
      const cSz = fitFont(ctxFore, cardTxt, cFontFn, H * 0.036 * fontScale, H * 0.020, W * 0.72, cTrk);
      const cardCy = shiftY(H * 0.652 + (lineSpacingMult - 1.0) * H * 0.024);
      ctxFore.save();
      try {
        ctxFore.globalAlpha = exitFade * cep;
        ctxFore.font = cFontFn(cSz);
        if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${cTrk}em`;
        const tw = measureW(ctxFore, cardTxt, cSz, cTrk);
        const dotR = Math.max(4, Math.round(cSz * 0.16));
        const pw = Math.round(tw + cSz * 1.9 + dotR * 2.5);
        const ph = Math.round(cSz * (1.25 + 1.0 * lineSpacingMult));
        const px = Math.round(heroX - pw * 0.5);
        const py = Math.round(cardCy - ph * 0.5);
        recordSceneBox(px, py, pw, ph);

        ctxFore.shadowColor = 'rgba(0, 0, 0, 0.62)';
        ctxFore.shadowBlur = Math.max(10, Math.round(H * 0.014));
        ctxFore.shadowOffsetY = 4;
        const cg = ctxFore.createLinearGradient(px, py, px, py + ph);
        cg.addColorStop(0.0, 'rgba(15, 23, 42, 0.84)');
        cg.addColorStop(1.0, 'rgba(8, 12, 24, 0.90)');
        roundRectPath(ctxFore, px, py, pw, ph, Math.round(H * 0.016));
        ctxFore.fillStyle = cg;
        ctxFore.fill();

        applyGlow(ctxFore, customHighlight || 'rgba(59, 130, 246, 0.45)', 8, 1);
        ctxFore.strokeStyle = customHighlight || 'rgba(59, 130, 246, 0.78)';
        ctxFore.lineWidth = Math.max(1.5, Math.round(H * 0.0018));
        ctxFore.stroke();

        ctxFore.shadowColor = 'transparent';
        ctxFore.textAlign = 'left';
        ctxFore.textBaseline = 'middle';
        ctxFore.fillStyle = pickBase('#FFFFFF');
        const textX = Math.round(heroX - (tw + dotR * 2.5 + cSz * 0.25) * 0.5);
        ctxFore.fillText(cardTxt, textX, cardCy + Math.round(cSz * 0.05));

        ctxFore.fillStyle = pickHi('#FF4D2D');
        ctxFore.beginPath();
        ctxFore.arc(Math.round(textX + tw + cSz * 0.24 + dotR), cardCy + Math.round(cSz * 0.08), dotR, 0, Math.PI * 2);
        ctxFore.fill();
      } finally {
        ctxFore.restore();
      }
    }
  } else {
    // MODE 4: Slanted Stacked Paper Sticker Tags (Ivory Box + Electric Klein Blue Pill)
    const splitAt = words.length >= 4 ? Math.ceil(words.length * 0.5) : (words.length >= 2 ? words.length - 1 : 1);
    const topWords = words.length > 1 ? words.slice(0, splitAt) : words;
    const botWords = words.length > 1 ? words.slice(splitAt) : [];
    const topStr = topWords.map(w => cleanTok(w.t || w.word || '', false)).filter(Boolean).join(' ').toUpperCase();
    const botStr = botWords.map(w => cleanTok(w.t || w.word || '', false)).filter(Boolean).join(' ').toUpperCase();

    const drawSticker = (txt, cx, cy, tilt, isBlue, sStart) => {
      const p = progFactor(sStart, 0.16);
      if (!txt || p <= 0.01) return;
      const ep = easeOutCubic(p);
      const sc = fullInstant ? 1.0 : (0.90 + 0.10 * ep);
      const fFn = (sz) => `900 ${sz}px ${pickFontFam('"Montserrat", "Poppins", sans-serif')}`;
      const sTrk = trackEmWith(0.01);
      const parts = txt.split(/\s+/);
      let rows = [txt];
      if (!isBlue && parts.length >= 2 && txt.length >= 11) {
        const half = Math.ceil(parts.length * 0.5);
        rows = [parts.slice(0, half).join(' '), parts.slice(half).join(' ')];
      }
      const longest = rows.reduce((a, b) => b.length > a.length ? b : a, '');
      const sz = fitFont(ctxFore, longest, fFn, H * (isBlue ? 0.038 : 0.036) * fontScale, H * 0.020, W * 0.72, sTrk);
      ctxFore.save();
      try {
        ctxFore.globalAlpha = exitFade * ep;
        ctxFore.translate(cx, cy);
        ctxFore.rotate(tilt);
        ctxFore.scale(sc, sc);
        ctxFore.font = fFn(sz);
        if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${sTrk}em`;
        const maxW = Math.max(...rows.map(r => measureW(ctxFore, r, sz, sTrk)));
        const rowH = Math.round(sz * 1.18 * lineSpacingMult);
        const pw = Math.round(maxW + sz * 1.35);
        const ph = Math.round(rows.length * rowH + sz * 0.65);

        applyGlow(ctxFore, 'rgba(0, 0, 0, 0.58)', Math.max(8, Math.round(H * 0.012)), 1);
        ctxFore.shadowOffsetY = 5;
        roundRectPath(ctxFore, -pw * 0.5, -ph * 0.5, pw, ph, isBlue ? ph * 0.5 : Math.round(H * 0.014));
        if (isBlue) {
          const bg = ctxFore.createLinearGradient(-pw * 0.5, 0, pw * 0.5, 0);
          bg.addColorStop(0.0, '#1D4ED8');
          bg.addColorStop(1.0, '#2563EB');
          ctxFore.fillStyle = customHighlight || bg;
        } else {
          ctxFore.fillStyle = '#F6F2E9';
        }
        ctxFore.fill();

        ctxFore.shadowColor = 'transparent';
        ctxFore.fillStyle = isBlue ? (customHighlight ? '#0F172A' : '#FFFFFF') : pickBase('#0B132B');
        ctxFore.textAlign = 'center';
        ctxFore.textBaseline = 'middle';
        const y0 = -((rows.length - 1) * rowH) * 0.5 + Math.round(sz * 0.04);
        rows.forEach((r, idx) => ctxFore.fillText(r, 0, Math.round(y0 + idx * rowH)));
      } finally {
        ctxFore.restore();
      }
    };

    const topCy = botStr ? shiftY(H * 0.594) : shiftY(H * 0.625);
    const botCy = Math.round(topCy + H * 0.074 * lineSpacingMult);
    recordSceneBox(heroX - W * 0.36, topCy - H * 0.055, W * 0.72, H * 0.16 * lineSpacingMult);
    drawSticker(topStr, Math.round(heroX - (botStr ? W * 0.04 : 0)), topCy, -0.055, false, wordStart(topWords[0], capStart + 0.06));
    if (botStr) {
      drawSticker(botStr, Math.round(heroX + W * 0.06), botCy, 0.025, true, wordStart(botWords[0], capStart + 0.22));
    }
  }
}

/**
 * Renders the "Celestial Monolith" 4-scene flagship preset:
 * 1) Liquid Silver Crown + Smoked Capsule + Molten Copper Italic,
 * 2) Clean Contrast Sans + Molten Copper Anamorphic Laser Streak,
 * 3) 3D Architectural Bronze Contour + Titanium Uppercase,
 * 4) Luxury Copper-Bracket Monolith Frame Card.
 */
function drawCelestialMonolithPass(ctxFore, ctxBehind, cap, words, t, st, W, H, isBehind, showAll, isPreview) {
  if (!ctxFore || !words || !words.length) return;
  const capArg = (showAll && cap) ? Object.assign({}, cap, { _forceInstant: typeof t !== 'number' || isNaN(t) || t <= (cap.start || 0) + 0.04 }) : cap;
  const rt = initEditorialSceneRuntime(ctxFore, ctxBehind, capArg, words, t, st, W, H, isBehind, ['silently', 'always', 'master', 'own', 'chapter']);
  if (rt.exitFade <= 0.005) return;

  const {
    isSampleCard, capStart, evalT, fullInstant, exitFade, targetBehind, capIdx, userCase, heroX, fontScale,
    cleanTok, wordStart, easeOutCubic, progFactor, measureW, fitFont, roundRectPath, pickHeroIdx,
    lineSpacingMult, customHighlight, pickHi, pickBase, pickFontFam, trackEmWith, applyGlow, posDeltaY, recordSceneBox
  } = rt;
  const shiftY = (y) => Math.round(y + posDeltaY);
  const isPctMetric = (raw) => /^\$?\d[\d,.]*(?:%|x|k|m|b|cr)?$/i.test(String(raw || '').replace(/[.,!?;:'"’()[\]{}]/g, (m) => m === '%' ? m : ''));

  const metricIdx = words.findIndex(w => isPctMetric(w.t || w.word || ''));
  let styleMode = 1;
  if (isSampleCard) {
    styleMode = 1;
  } else if (metricIdx !== -1 && capIdx % 4 !== 1 && capIdx % 4 !== 3) {
    styleMode = 3;
  } else {
    styleMode = (capIdx % 4) + 1;
  }

  if (styleMode === 1) {
    // MODE 1: Liquid Silver Serif Crown ('EMPIRE') + Smoked Pill ('SILENTLY') + Molten Copper Italic ('always wins.')
    const bIdx = pickHeroIdx(words);
    const heroRaw = isSampleCard ? 'EMPIRE' : cleanTok(words[bIdx]?.t || words[bIdx]?.word || '', false);
    const behindTxt = heroRaw ? (userCase === 'lower' ? heroRaw.toLowerCase() : heroRaw.toUpperCase()) : 'EMPIRE';
    const bStart = wordStart(words[bIdx], capStart + 0.04);

    const remaining = isSampleCard ? [{ t: 'SILENTLY', s: 0 }, { t: 'always', s: 0 }, { t: 'wins.', s: 0 }] : frontWordsForBehindHero(words, bIdx);
    let pillWords = [], italicWords = [];
    if (remaining.length >= 3) {
      const splitAt = Math.min(2, Math.floor(remaining.length / 2));
      pillWords = remaining.slice(0, splitAt);
      italicWords = remaining.slice(splitAt);
    } else if (remaining.length === 2) {
      pillWords = [remaining[0]];
      italicWords = [remaining[1]];
    } else {
      italicWords = remaining;
    }

    // 1. Liquid Titanium Silver Serif Behind Head (90% clear above crown, ~10% overlap)
    const silverFn = (sz) => `700 ${sz}px ${pickFontFam('"Cinzel", "Playfair Display", Georgia, serif')}`;
    const cTrk = trackEmWith(-0.01);
    const rawSSize = fitFont(targetBehind, behindTxt, silverFn, H * 0.205 * fontScale, H * 0.080, W * 0.88, cTrk);
    const sPlace = computeBehindCrownPlacement(targetBehind, behindTxt, {
      W, H, fontFn: silverFn, preferredSize: rawSSize, minSize: Math.round(H * 0.075),
      trackEm: cTrk, isSampleCard, fallbackCrownRatio: 0.23
    });
    const bP = progFactor(bStart, 0.18);
    if (bP > 0.01) {
      const bep = easeOutCubic(bP);
      const sc = fullInstant ? 1.0 : (0.94 + 0.06 * bep);
      targetBehind.save();
      try {
        targetBehind.globalAlpha = exitFade * bep;
        targetBehind.translate(heroX, sPlace.centerY);
        targetBehind.scale(sc, sc);
        targetBehind.translate(-heroX, -sPlace.centerY);
        targetBehind.font = silverFn(sPlace.size);
        if ('letterSpacing' in targetBehind) targetBehind.letterSpacing = `${cTrk}em`;
        targetBehind.textAlign = 'center';
        targetBehind.textBaseline = 'alphabetic';

        const mg = targetBehind.createLinearGradient(0, sPlace.inkTopY, 0, sPlace.inkBotY);
        mg.addColorStop(0.00, '#FFFFFF');
        mg.addColorStop(0.28, '#CBD5E1');
        mg.addColorStop(0.52, '#64748B');
        mg.addColorStop(0.76, '#E2E8F0');
        mg.addColorStop(1.00, '#94A3B8');

        applyGlow(targetBehind, 'rgba(0, 0, 0, 0.72)', Math.max(6, Math.round(H * 0.012)), 1);
        targetBehind.shadowOffsetY = Math.round(H * 0.004);
        targetBehind.fillStyle = customHighlight || mg;
        targetBehind.fillText(behindTxt, heroX, sPlace.baseY);

        targetBehind.shadowColor = 'transparent';
        targetBehind.strokeStyle = 'rgba(255, 255, 255, 0.62)';
        targetBehind.lineWidth = Math.max(1.0, H * 0.0012);
        targetBehind.strokeText(behindTxt, heroX, sPlace.baseY);
      } finally {
        targetBehind.restore();
      }
    }

    // 2. Smoked Obsidian Capsule ('SILENTLY')
    recordSceneBox(heroX - W * 0.40, shiftY(H * 0.56), W * 0.80, H * 0.16 * lineSpacingMult);
    if (pillWords.length > 0) {
      const pTxt = pillWords.map(w => cleanTok(w.t || w.word || '', false)).filter(Boolean).join(' ').toUpperCase();
      const pp = progFactor(wordStart(pillWords[0], capStart + 0.16), 0.15);
      if (pTxt && pp > 0.01) {
        const pep = easeOutCubic(pp);
        const pFn = (sz) => `600 ${sz}px ${pickFontFam('"Inter", "Poppins", sans-serif')}`;
        const pTrk = trackEmWith(0.08);
        const pSz = fitFont(ctxFore, pTxt, pFn, H * 0.026 * fontScale, H * 0.016, W * 0.72, pTrk);
        const pCy = shiftY(H * 0.598);
        ctxFore.save();
        try {
          ctxFore.globalAlpha = exitFade * pep;
          ctxFore.font = pFn(pSz);
          if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${pTrk}em`;
          const tw = measureW(ctxFore, pTxt, pSz, pTrk);
          const pw = Math.round(tw + pSz * 2.1);
          const ph = Math.round(pSz * 2.25);
          const px = Math.round(heroX - pw * 0.5);
          const py = Math.round(pCy - ph * 0.5);

          ctxFore.shadowColor = 'rgba(0, 0, 0, 0.68)';
          ctxFore.shadowBlur = Math.max(8, Math.round(H * 0.014));
          ctxFore.shadowOffsetY = 4;
          const pg = ctxFore.createLinearGradient(px, py, px, py + ph);
          pg.addColorStop(0.0, 'rgba(30, 32, 40, 0.88)');
          pg.addColorStop(1.0, 'rgba(12, 13, 18, 0.92)');
          roundRectPath(ctxFore, px, py, pw, ph, ph * 0.5);
          ctxFore.fillStyle = pg;
          ctxFore.fill();

          ctxFore.shadowColor = 'transparent';
          ctxFore.strokeStyle = customHighlight || 'rgba(226, 232, 240, 0.28)';
          ctxFore.lineWidth = Math.max(1.2, H * 0.0014);
          ctxFore.stroke();

          ctxFore.fillStyle = pickBase('#E2E8F0');
          ctxFore.textAlign = 'center';
          ctxFore.textBaseline = 'middle';
          ctxFore.fillText(pTxt, heroX, pCy + Math.round(pSz * 0.04));
        } finally {
          ctxFore.restore();
        }
      }
    }

    // 3. Glowing Molten Copper Italic ('always wins.')
    if (italicWords.length > 0) {
      const iTxt = italicWords.map(w => cleanTok(w.t || w.word || '', true)).filter(Boolean).join(' ');
      const ip = progFactor(wordStart(italicWords[0], capStart + 0.30), 0.16);
      if (iTxt && ip > 0.01) {
        const iep = easeOutCubic(ip);
        const iFn = (sz) => `italic 700 ${sz}px ${pickFontFam('"Playfair Display", Georgia, serif')}`;
        const iTrk = trackEmWith(-0.015);
        const iSz = fitFont(ctxFore, iTxt, iFn, H * 0.056 * fontScale, H * 0.028, W * 0.86, iTrk);
        const iBaseY = pillWords.length > 0 ? Math.round(shiftY(H * 0.598) + H * 0.086 * lineSpacingMult) : shiftY(H * 0.640);
        ctxFore.save();
        ctxFore.globalAlpha = exitFade * iep;
        ctxFore.font = iFn(iSz);
        if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${iTrk}em`;
        ctxFore.textAlign = 'center';
        ctxFore.textBaseline = 'alphabetic';

        const ig = ctxFore.createLinearGradient(0, iBaseY - iSz * 0.85, 0, iBaseY + iSz * 0.12);
        ig.addColorStop(0.0, '#FED7AA');
        ig.addColorStop(0.5, '#FB923C');
        ig.addColorStop(1.0, '#EA580C');

        applyGlow(ctxFore, customHighlight || 'rgba(249, 115, 22, 0.55)', Math.max(6, Math.round(H * 0.012)), 1);
        ctxFore.fillStyle = customHighlight || ig;
        ctxFore.fillText(iTxt, heroX, iBaseY);

        ctxFore.shadowColor = 'rgba(0, 0, 0, 0.65)';
        ctxFore.shadowBlur = 4;
        ctxFore.shadowOffsetY = 2;
        ctxFore.fillText(iTxt, heroX, iBaseY);
        ctxFore.restore();
      }
    }
  } else if (styleMode === 2) {
    // MODE 2: Crisp White Contrast Sans ('precision' / 'matters') + Molten Copper-Peach Anamorphic Laser Streak
    const splitAt = words.length >= 2 ? Math.max(1, words.length - 1) : 1;
    const topWords = words.length > 1 ? words.slice(0, splitAt) : [];
    const botWords = words.length > 1 ? words.slice(splitAt) : words;
    const topTxt = topWords.map(w => cleanTok(w.t || w.word || '', false)).filter(Boolean).join(' ');
    const botTxt = botWords.map(w => cleanTok(w.t || w.word || '', true)).filter(Boolean).join(' ');

    const topP = topTxt ? progFactor(wordStart(topWords[0], capStart + 0.05), 0.14) : 0;
    const botP = botTxt ? progFactor(wordStart(botWords[0], capStart + 0.18), 0.16) : 0;
    const fFn = (sz) => `800 ${sz}px ${pickFontFam('"Poppins", "Inter", sans-serif')}`;
    const cTrk = trackEmWith(-0.03);
    const maxStr = topTxt.length >= botTxt.length ? topTxt : botTxt;
    const sz = fitFont(ctxFore, maxStr || 'matters', fFn, H * 0.068 * fontScale, H * 0.034, W * 0.86, cTrk);
    const l1Y = topTxt ? shiftY(H * 0.588) : 0;
    const l2Y = topTxt ? Math.round(l1Y + H * 0.066 * lineSpacingMult) : shiftY(H * 0.625);
    recordSceneBox(heroX - W * 0.42, (l1Y || l2Y) - sz * 1.1, W * 0.84, sz * 2.5 * lineSpacingMult);

    if (botP > 0.02) {
      const fep = easeOutCubic(botP);
      const flareY = l2Y + Math.round(sz * 0.06);
      const halfSpan = Math.round(W * 0.48 * (fullInstant ? 1.0 : fep));
      ctxFore.save();
      ctxFore.globalAlpha = exitFade * Math.min(1, fep * 1.2);
      const beamG = ctxFore.createLinearGradient(heroX - halfSpan, 0, heroX + halfSpan, 0);
      beamG.addColorStop(0.00, 'rgba(234, 88, 12, 0)');
      beamG.addColorStop(0.25, 'rgba(249, 115, 22, 0.72)');
      beamG.addColorStop(0.50, 'rgba(255, 237, 213, 0.96)');
      beamG.addColorStop(0.75, 'rgba(249, 115, 22, 0.72)');
      beamG.addColorStop(1.00, 'rgba(234, 88, 12, 0)');

      ctxFore.fillStyle = customHighlight || beamG;
      applyGlow(ctxFore, customHighlight || 'rgba(249, 115, 22, 0.88)', Math.max(12, Math.round(H * 0.018)), 1);
      ctxFore.fillRect(heroX - halfSpan, flareY - Math.round(H * 0.003), halfSpan * 2, Math.max(3, Math.round(H * 0.006)));

      const radG = ctxFore.createRadialGradient(heroX, flareY, 2, heroX, flareY, Math.max(16, Math.round(W * 0.34)));
      radG.addColorStop(0.0, 'rgba(253, 186, 116, 0.38)');
      radG.addColorStop(0.5, 'rgba(234, 88, 12, 0.14)');
      radG.addColorStop(1.0, 'rgba(234, 88, 12, 0)');
      ctxFore.fillStyle = radG;
      ctxFore.beginPath();
      ctxFore.ellipse(heroX, flareY, halfSpan, Math.max(14, Math.round(H * 0.022)), 0, 0, Math.PI * 2);
      ctxFore.fill();
      ctxFore.restore();
    }

    const drawSansLine = (txt, baseY, p, col) => {
      if (!txt || p <= 0.01) return;
      ctxFore.save();
      ctxFore.globalAlpha = exitFade * easeOutCubic(p);
      ctxFore.font = fFn(sz);
      if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${cTrk}em`;
      ctxFore.textAlign = 'center';
      ctxFore.textBaseline = 'alphabetic';
      applyGlow(ctxFore, 'rgba(0, 0, 0, 0.72)', Math.max(6, Math.round(H * 0.009)), 1);
      ctxFore.shadowOffsetY = 2;
      ctxFore.fillStyle = col;
      ctxFore.fillText(txt, heroX, baseY);
      ctxFore.restore();
    };
    drawSansLine(topTxt, l1Y, topP, pickBase('#FFFFFF'));
    drawSansLine(botTxt, l2Y, botP, customHighlight || pickBase('#FFFFFF'));
  } else if (styleMode === 3) {
    // MODE 3: 3D Architectural Bronze Contour ('99%') Behind (10% crown overlap) + 'master the MINDSET'
    let bIdx = words.findIndex(w => isPctMetric(w.t || w.word || ''));
    if (bIdx === -1) bIdx = pickHeroIdx(words);
    const heroRaw = cleanTok(words[bIdx]?.t || words[bIdx]?.word || '', false);
    const behindTxt = heroRaw ? (userCase === 'lower' ? heroRaw.toLowerCase() : heroRaw.toUpperCase()) : '99%';
    const bStart = wordStart(words[bIdx], capStart + 0.05);
    const remaining = frontWordsForBehindHero(words, bIdx);
    const leadWords = remaining.length > 1 ? remaining.slice(0, -1) : [];
    const titanWord = remaining.length >= 1 ? remaining[remaining.length - 1] : null;

    const brFontFn = (sz) => `900 ${sz}px ${pickFontFam('"Montserrat", "Poppins", sans-serif')}`;
    const bTrk = trackEmWith(-0.02);
    const isShort = behindTxt.length <= 4;
    const rawBSize = fitFont(targetBehind, behindTxt, brFontFn, H * (isShort ? 0.27 : 0.18) * fontScale, H * 0.080, W * 0.88, bTrk);
    const bPlace = computeBehindCrownPlacement(targetBehind, behindTxt, {
      W, H, fontFn: brFontFn, preferredSize: rawBSize, minSize: Math.round(H * 0.075),
      trackEm: bTrk, isSampleCard, fallbackCrownRatio: 0.235
    });
    const bP = progFactor(bStart, 0.18);
    if (bP > 0.01) {
      const bep = easeOutCubic(bP);
      const sc = fullInstant ? 1.0 : (0.94 + 0.06 * bep);
      targetBehind.save();
      try {
        targetBehind.globalAlpha = exitFade * bep;
        targetBehind.translate(heroX, bPlace.centerY);
        targetBehind.scale(sc, sc);
        targetBehind.translate(-heroX, -bPlace.centerY);
        targetBehind.font = brFontFn(bPlace.size);
        if ('letterSpacing' in targetBehind) targetBehind.letterSpacing = `${bTrk}em`;
        targetBehind.textAlign = 'center';
        targetBehind.textBaseline = 'alphabetic';
        targetBehind.lineJoin = 'round';

        targetBehind.fillStyle = customHighlight ? 'rgba(255, 255, 255, 0.08)' : 'rgba(251, 146, 60, 0.08)';
        targetBehind.fillText(behindTxt, heroX, bPlace.baseY);

        const steps = Math.max(3, Math.round(H * 0.004));
        targetBehind.lineWidth = Math.max(2.0, Math.round(H * 0.0024));
        targetBehind.strokeStyle = 'rgba(124, 45, 18, 0.72)';
        for (let k = steps; k >= 1; k--) {
          targetBehind.strokeText(behindTxt, heroX + k * 0.9, bPlace.baseY + k * 0.9);
        }

        const cg = targetBehind.createLinearGradient(0, bPlace.inkTopY, 0, bPlace.inkBotY);
        cg.addColorStop(0.0, '#FED7AA');
        cg.addColorStop(0.5, '#FB923C');
        cg.addColorStop(1.0, '#C2410C');
        applyGlow(targetBehind, customHighlight || 'rgba(251, 146, 60, 0.45)', Math.max(5, Math.round(H * 0.008)), 1);
        targetBehind.strokeStyle = customHighlight || cg;
        targetBehind.lineWidth = Math.max(2.0, Math.round(H * 0.0025));
        targetBehind.strokeText(behindTxt, heroX, bPlace.baseY);
      } finally {
        targetBehind.restore();
      }
    }

    const leadBaseY = shiftY(H * 0.586 - (lineSpacingMult - 1.0) * H * 0.020);
    recordSceneBox(heroX - W * 0.42, leadBaseY - H * 0.04, W * 0.84, H * 0.16 * lineSpacingMult);
    if (leadWords.length > 0) {
      const leadTxt = leadWords.map(w => cleanTok(w.t || w.word || '', false)).filter(Boolean).join(' ');
      const lp = progFactor(wordStart(leadWords[0], capStart + 0.16), 0.14);
      if (leadTxt && lp > 0.01) {
        const lFn = (sz) => `500 ${sz}px ${pickFontFam('"Poppins", "Inter", sans-serif')}`;
        const lTrk = trackEmWith(-0.02);
        const lSz = fitFont(ctxFore, leadTxt, lFn, H * 0.044 * fontScale, H * 0.022, W * 0.84, lTrk);
        ctxFore.save();
        ctxFore.globalAlpha = exitFade * easeOutCubic(lp);
        ctxFore.font = lFn(lSz);
        if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${lTrk}em`;
        ctxFore.textAlign = 'center';
        ctxFore.textBaseline = 'alphabetic';
        applyGlow(ctxFore, 'rgba(0, 0, 0, 0.75)', 6, 1);
        ctxFore.fillStyle = pickBase('#FFFFFF');
        ctxFore.fillText(leadTxt, heroX, leadBaseY);
        ctxFore.restore();
      }
    }
    if (titanWord) {
      const tTxt = cleanTok(titanWord.t || titanWord.word || '', true).toUpperCase();
      const tp = progFactor(wordStart(titanWord, capStart + 0.28), 0.16);
      if (tTxt && tp > 0.01) {
        const tFn = (sz) => `700 ${sz}px ${pickFontFam('"Anton", "Montserrat", sans-serif')}`;
        const tTrk = trackEmWith(0.01);
        const tSz = fitFont(ctxFore, tTxt, tFn, H * 0.092 * fontScale, H * 0.044, W * 0.88, tTrk);
        const tBaseY = leadWords.length > 0 ? Math.round(leadBaseY + H * 0.088 * lineSpacingMult) : shiftY(H * 0.638);
        ctxFore.save();
        ctxFore.globalAlpha = exitFade * easeOutCubic(tp);
        ctxFore.font = tFn(tSz);
        if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${tTrk}em`;
        ctxFore.textAlign = 'center';
        ctxFore.textBaseline = 'alphabetic';
        const sg = ctxFore.createLinearGradient(0, tBaseY - tSz * 0.85, 0, tBaseY + tSz * 0.08);
        sg.addColorStop(0.0, '#FFFFFF');
        sg.addColorStop(0.55, '#CBD5E1');
        sg.addColorStop(1.0, '#94A3B8');
        applyGlow(ctxFore, 'rgba(0, 0, 0, 0.72)', Math.max(6, Math.round(H * 0.010)), 1);
        ctxFore.fillStyle = customHighlight || sg;
        ctxFore.fillText(tTxt, heroX, tBaseY);
        ctxFore.restore();
      }
    }
  } else {
    // MODE 4: Smoked Monolith Luxury Card with Glowing Copper L-Brackets ('CHAPTER IV' / 'Own Your Future.')
    const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][capIdx % 8];
    const hasShortLead = words.length >= 4 && cleanTok(words[0].t || words[0].word, false).length <= 8;
    const eyWords = hasShortLead ? words.slice(0, 1) : [];
    const mainWords = hasShortLead ? words.slice(1) : words;
    const rawEy = eyWords.length ? cleanTok(eyWords[0].t || eyWords[0].word || '', false).toUpperCase() : `CHAPTER ${roman}`;
    const mainAll = mainWords.map(w => cleanTok(w.t || w.word || '', true)).filter(Boolean);
    let headLines = [mainAll.join(' ') || 'Own Your Future.'];
    if (mainAll.length >= 3) {
      const half = Math.ceil(mainAll.length * 0.5);
      headLines = [mainAll.slice(0, half).join(' '), mainAll.slice(half).join(' ')];
    }

    const cp = progFactor(wordStart(words[0], capStart + 0.05), 0.16);
    if (cp > 0.01) {
      const cep = easeOutCubic(cp);
      const eyFn = (sz) => `600 ${sz}px ${pickFontFam('"Inter", "Poppins", sans-serif')}`;
      const hFn = (sz) => `700 ${sz}px ${pickFontFam('"Poppins", "Montserrat", sans-serif')}`;
      const eyTrk = trackEmWith(0.22);
      const hTrk = trackEmWith(-0.02);
      const eySz = fitFont(ctxFore, rawEy, eyFn, H * 0.019 * fontScale, H * 0.012, W * 0.72, eyTrk);
      const longHead = headLines.reduce((a, b) => b.length > a.length ? b : a, '');
      const hSz = fitFont(ctxFore, longHead, hFn, H * 0.044 * fontScale, H * 0.024, W * 0.76, hTrk);

      ctxFore.save();
      try {
        ctxFore.globalAlpha = exitFade * cep;
        ctxFore.font = eyFn(eySz);
        const ew = measureW(ctxFore, rawEy, eySz, eyTrk);
        ctxFore.font = hFn(hSz);
        const hw = Math.max(...headLines.map(r => measureW(ctxFore, r, hSz, hTrk)));

        const padX = Math.round(H * 0.038);
        const cw = Math.min(Math.round(W * 0.88), Math.max(Math.round(W * 0.54), Math.round(Math.max(ew, hw) + padX * 2)));
        const rowGap = Math.round(hSz * 1.18 * lineSpacingMult);
        const ch = Math.round(eySz * 2.2 * lineSpacingMult + headLines.length * rowGap + H * 0.042);
        const cx0 = Math.round(heroX - cw * 0.5);
        const cyMid = shiftY(H * 0.625);
        const cy0 = Math.round(cyMid - ch * 0.5);
        recordSceneBox(cx0, cy0, cw, ch);

        ctxFore.shadowColor = 'rgba(0, 0, 0, 0.72)';
        ctxFore.shadowBlur = Math.max(12, Math.round(H * 0.018));
        ctxFore.shadowOffsetY = 5;
        roundRectPath(ctxFore, cx0, cy0, cw, ch, Math.round(H * 0.008));
        ctxFore.fillStyle = 'rgba(8, 10, 15, 0.80)';
        ctxFore.fill();

        ctxFore.shadowColor = 'transparent';
        ctxFore.strokeStyle = customHighlight || 'rgba(251, 146, 60, 0.36)';
        ctxFore.lineWidth = Math.max(1.0, H * 0.0012);
        ctxFore.stroke();

        const bLen = Math.round(Math.min(cw, ch) * 0.16);
        const brG = ctxFore.createLinearGradient(cx0, cy0, cx0 + cw, cy0 + ch);
        brG.addColorStop(0.0, '#FDBA74');
        brG.addColorStop(0.5, '#F97316');
        brG.addColorStop(1.0, '#EA580C');
        ctxFore.strokeStyle = customHighlight || brG;
        applyGlow(ctxFore, customHighlight || 'rgba(249, 115, 22, 0.65)', 6, 1);
        ctxFore.lineWidth = Math.max(2.0, H * 0.0022);
        const drawCorner = (x, y, dx, dy) => {
          ctxFore.beginPath();
          ctxFore.moveTo(x + dx * bLen, y);
          ctxFore.lineTo(x, y);
          ctxFore.lineTo(x, y + dy * bLen);
          ctxFore.stroke();
        };
        drawCorner(cx0, cy0, 1, 1);
        drawCorner(cx0 + cw, cy0, -1, 1);
        drawCorner(cx0, cy0 + ch, 1, -1);
        drawCorner(cx0 + cw, cy0 + ch, -1, -1);

        ctxFore.shadowColor = 'transparent';
        ctxFore.font = eyFn(eySz);
        if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${eyTrk}em`;
        ctxFore.textAlign = 'center';
        ctxFore.textBaseline = 'middle';
        ctxFore.fillStyle = pickHi('#D6A87C');
        const eyY = Math.round(cy0 + H * 0.028 + eySz * 0.5);
        ctxFore.fillText(rawEy, heroX, eyY);

        ctxFore.font = hFn(hSz);
        if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${hTrk}em`;
        ctxFore.fillStyle = pickBase('#F8F5EE');
        applyGlow(ctxFore, 'rgba(0, 0, 0, 0.65)', 6, 1);
        const firstLineY = Math.round(eyY + eySz * 1.3 * lineSpacingMult + rowGap * 0.45);
        headLines.forEach((hl, i) => ctxFore.fillText(hl, heroX, Math.round(firstLineY + i * rowGap)));
      } finally {
        ctxFore.restore();
      }
    }
  }
}

/**
 * Shared foreground renderer for the 6 signature in-front-of-person presets:
 * - 'chrome'    : Chrome Liquid Mercury (smoked glass + brushed 3D chrome hero + cyan beam)
 * - 'zine'      : Tactile Torn Zine (deckled cream tape + vermilion stamp + highlighter swipe)
 * - 'volt'      : Acid Volt Ticker (telemetry tag + italic white + skewed acid-lime pill)
 * - 'porcelain' : Porcelain Editorial Ribbon (ivory silk card + espresso italic serif + diamond)
 * - 'holo'      : Holo Iridescent Aura Pill (dark quartz bar + opal holographic pill + sparkles)
 * - 'film'      : Espresso Analog Film Strip (24fps amber timestamp + cream serif + amber badge)
 */
function drawFrontSignatureScenePass(ctxFore, cap, words, t, st, W, H, showAll, presetKey) {
  if (!ctxFore || !words || !words.length) return;
  const capArg = (showAll && cap) ? Object.assign({}, cap, { _forceInstant: typeof t !== 'number' || isNaN(t) || t <= (cap.start || 0) + 0.04 }) : cap;
  const rt = initEditorialSceneRuntime(ctxFore, null, capArg, words, t, st, W, H, false, []);
  if (rt.exitFade <= 0.005) return;

  const {
    isSampleCard, capStart, fullInstant, exitFade, capIdx, userCase, heroX, fontScale,
    cleanTok, wordStart, easeOutCubic, progFactor, measureW, fitFont, roundRectPath, pickHeroIdx,
    lineSpacingMult, customHighlight, pickHi, pickBase, pickFontFam, trackEmWith, applyGlow, recordSceneBox
  } = rt;
  const applyCase = (s) => {
    const v = String(s || '');
    if (userCase === 'lower') return v.toLowerCase();
    if (userCase === 'asIs') return v;
    if (userCase === 'title') return v.replace(/\b\w/g, (ch) => ch.toUpperCase());
    return v.toUpperCase();
  };

  // Prefer user-selected gold word chip (w.key), otherwise auto-score hero word
  let heroIdx = words.findIndex(w => Boolean(w && w.key));
  if (heroIdx < 0) heroIdx = pickHeroIdx(words);
  const split = splitChronologicalAroundHero(words, heroIdx, cleanTok);

  // Monotonic spoken enter times guarantee word i+1 never appears before word i
  const wordEnterMap = new Map();
  let prevMono = capStart;
  for (let i = 0; i < words.length; i++) {
    const rawS = wordStart(words[i], prevMono + (i === 0 ? 0 : 0.14));
    const clampedS = Math.max(prevMono, rawS);
    wordEnterMap.set(words[i], clampedS);
    prevMono = clampedS;
  }
  const wordTime = (w, fallback) => (w && wordEnterMap.has(w)) ? wordEnterMap.get(w) : wordStart(w, fallback);

  const beforeEnterStart = split.beforeWords.length ? wordTime(split.beforeWords[0], capStart) : capStart;
  const heroEnterStart = split.heroWord ? wordTime(split.heroWord, split.beforeWords.length ? beforeEnterStart + 0.08 : capStart) : capStart;
  const afterEnterStart = split.afterWords.length ? wordTime(split.afterWords[0], heroEnterStart + 0.08) : heroEnterStart;

  const beforeP = isSampleCard ? 1.0 : (split.beforeTxt ? progFactor(beforeEnterStart, 0.16) : 0);
  const heroP = isSampleCard ? 1.0 : (split.heroTxt ? progFactor(heroEnterStart, 0.18) : 0);
  const afterP = isSampleCard ? 1.0 : (split.afterTxt ? progFactor(afterEnterStart, 0.16) : 0);
  if (beforeP <= 0.01 && heroP <= 0.01 && afterP <= 0.01) return;

  const anchorRatio = Math.max(0.20, Math.min(0.86, Number(st && (st.posY ?? st.position)) || 0.72));
  const cy = Math.round(H * anchorRatio);

  const drawSparkle = (ctx, x, y, r, color) => {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.quadraticCurveTo(x + r * 0.18, y - r * 0.18, x + r, y);
    ctx.quadraticCurveTo(x + r * 0.18, y + r * 0.18, x, y + r);
    ctx.quadraticCurveTo(x - r * 0.18, y + r * 0.18, x - r, y);
    ctx.quadraticCurveTo(x - r * 0.18, y - r * 0.18, x, y - r);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  /** Draw words in strict left-to-right reading order while revealing each word at its spoken timestamp. */
  const drawTimedSegment = (ctx, segWords, fullStr, anchorX, y, sz, trackEm, color, transformFn, centerAligned, fallbackT) => {
    if (!fullStr) return;
    if (isSampleCard || fullInstant || !segWords || !segWords.length) {
      ctx.textAlign = centerAligned ? 'center' : 'left';
      ctx.fillStyle = color;
      ctx.fillText(fullStr, anchorX, y);
      return;
    }
    const fmt = transformFn || ((v) => v);
    const tokens = segWords.map(w => fmt(cleanTok((w && (w.t || w.word)) || '', false))).filter(Boolean);
    if (tokens.length !== segWords.length || tokens.length === 0) {
      ctx.textAlign = centerAligned ? 'center' : 'left';
      ctx.fillStyle = color;
      ctx.fillText(fullStr, anchorX, y);
      return;
    }
    const joined = tokens.join(' ');
    const totalW = measureW(ctx, joined, sz, trackEm);
    const startX = centerAligned ? (anchorX - totalW * 0.5) : anchorX;
    const savedAlign = ctx.textAlign;
    const baseAlpha = ctx.globalAlpha;
    ctx.textAlign = 'left';
    ctx.fillStyle = color;
    for (let k = 0; k < tokens.length; k++) {
      const wp = progFactor(wordTime(segWords[k], fallbackT + k * 0.12), 0.12);
      if (wp <= 0.01) continue;
      const prefixW = k === 0 ? 0 : measureW(ctx, tokens.slice(0, k).join(' ') + ' ', sz, trackEm);
      ctx.globalAlpha = baseAlpha * easeOutCubic(wp);
      ctx.fillText(tokens[k], Math.round(startX + prefixW), y);
    }
    ctx.globalAlpha = baseAlpha;
    ctx.textAlign = savedAlign;
  };

  if (presetKey === 'chrome') {
    const beforeTxt = applyCase(isSampleCard ? 'STOP SCROLLING TO' : split.beforeTxt);
    const heroTxt = applyCase(isSampleCard ? 'UPGRADE' : (split.heroTxt || 'UPGRADE'));
    const afterTxt = applyCase(isSampleCard ? '' : split.afterTxt);
    const sFam = pickFontFam('"Inter", "Poppins", sans-serif');
    const hFam = pickFontFam('"Montserrat", "Outfit", sans-serif');
    const sFn = (sz) => `700 ${sz}px ${sFam}`;
    const hFn = (sz) => `900 ${sz}px ${hFam}`;
    const sTrk = trackEmWith(0.09);
    const hTrk = trackEmWith(-0.02);
    const bSz = beforeTxt ? fitFont(ctxFore, beforeTxt, sFn, H * 0.025 * fontScale, H * 0.014, W * 0.80, sTrk) : 0;
    const hSz = fitFont(ctxFore, heroTxt, hFn, H * 0.068 * fontScale, H * 0.032, W * 0.84, hTrk);
    const aSz = afterTxt ? fitFont(ctxFore, afterTxt, sFn, H * 0.025 * fontScale, H * 0.014, W * 0.80, sTrk) : 0;

    ctxFore.save();
    if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${sTrk}em`;
    ctxFore.font = sFn(bSz || 12);
    const bw = beforeTxt ? measureW(ctxFore, beforeTxt, bSz, sTrk) : 0;
    ctxFore.font = sFn(aSz || 12);
    const aw = afterTxt ? measureW(ctxFore, afterTxt, aSz, sTrk) : 0;
    if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${hTrk}em`;
    ctxFore.font = hFn(hSz);
    const hw = measureW(ctxFore, heroTxt, hSz, hTrk);
    ctxFore.restore();

    const maxTextW = Math.max(bw, hw, aw);
    const boxW = Math.min(Math.round(W * 0.90), Math.round(maxTextW + H * 0.065));
    const afterSlotH = aSz ? (aSz * 1.45 * lineSpacingMult + H * 0.010) : 0;
    const boxH = Math.round((bSz ? bSz * 1.45 * lineSpacingMult : 0) + hSz * 1.32 + afterSlotH + H * 0.036);
    const bx = Math.round(heroX - boxW * 0.5);
    const by = Math.round(cy - boxH * 0.5);
    const ep = easeOutCubic(Math.max(beforeP, heroP, afterP));
    recordSceneBox(bx, by, boxW, boxH);

    ctxFore.save();
    try {
      ctxFore.globalAlpha = exitFade * ep;
      ctxFore.shadowColor = 'rgba(0, 0, 0, 0.72)';
      ctxFore.shadowBlur = Math.max(12, Math.round(H * 0.020));
      ctxFore.shadowOffsetY = 6;
      const bgG = ctxFore.createLinearGradient(bx, by, bx, by + boxH);
      bgG.addColorStop(0.0, 'rgba(15, 20, 32, 0.82)');
      bgG.addColorStop(1.0, 'rgba(8, 11, 20, 0.88)');
      roundRectPath(ctxFore, bx, by, boxW, boxH, Math.round(H * 0.016));
      ctxFore.fillStyle = bgG;
      ctxFore.fill();

      ctxFore.shadowColor = 'transparent';
      ctxFore.strokeStyle = customHighlight || 'rgba(186, 230, 253, 0.28)';
      ctxFore.lineWidth = Math.max(1.2, H * 0.0014);
      ctxFore.stroke();

      ctxFore.textAlign = 'center';
      ctxFore.textBaseline = 'alphabetic';
      let cursorY = by + Math.round(H * 0.016);
      const baseTextCol = pickBase('#F8FAFC');
      if (beforeTxt) {
        cursorY += Math.round(bSz * 1.05);
        if (fullInstant || beforeP > 0.01) {
          ctxFore.font = sFn(bSz);
          if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${sTrk}em`;
          applyGlow(ctxFore, 'rgba(0, 0, 0, 0.65)', 4, 1);
          drawTimedSegment(ctxFore, isSampleCard ? null : split.beforeWords, beforeTxt, heroX, cursorY, bSz, sTrk, baseTextCol, applyCase, true, beforeEnterStart);
        }
        cursorY += Math.round(bSz * 0.35 * lineSpacingMult);
      }

      const heroBaseY = cursorY + Math.round(hSz * 0.96);
      const hep = fullInstant ? 1.0 : easeOutCubic(heroP);
      if (fullInstant || heroP > 0.01) {
        const sc = fullInstant ? 1.0 : (0.93 + 0.07 * hep);
        ctxFore.save();
        ctxFore.globalAlpha = exitFade * Math.min(1, ep) * hep;
        ctxFore.translate(heroX, heroBaseY - hSz * 0.38);
        ctxFore.scale(sc, sc);
        ctxFore.translate(-heroX, -(heroBaseY - hSz * 0.38));
        ctxFore.font = hFn(hSz);
        if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${hTrk}em`;

        const cg = ctxFore.createLinearGradient(0, heroBaseY - hSz * 0.85, 0, heroBaseY + hSz * 0.12);
        cg.addColorStop(0.00, '#FFFFFF');
        cg.addColorStop(0.28, '#E2E8F0');
        cg.addColorStop(0.52, '#64748B');
        cg.addColorStop(0.76, '#F8FAFC');
        cg.addColorStop(1.00, '#94A3B8');

        applyGlow(ctxFore, 'rgba(56, 189, 248, 0.62)', Math.max(8, Math.round(H * 0.014)), 1);
        ctxFore.fillStyle = customHighlight || cg;
        ctxFore.fillText(heroTxt, heroX, heroBaseY);

        ctxFore.shadowColor = 'transparent';
        ctxFore.strokeStyle = 'rgba(255, 255, 255, 0.72)';
        ctxFore.lineWidth = Math.max(1.0, H * 0.0012);
        ctxFore.strokeText(heroTxt, heroX, heroBaseY);
        ctxFore.restore();

        const barW = Math.round(Math.min(boxW - H * 0.04, Math.max(hw * 1.02, boxW * 0.56)) * hep);
        const barY = Math.round(heroBaseY + hSz * 0.22);
        const bgBar = ctxFore.createLinearGradient(heroX - barW * 0.5, 0, heroX + barW * 0.5, 0);
        bgBar.addColorStop(0.0, 'rgba(56, 189, 248, 0.15)');
        bgBar.addColorStop(0.5, '#67E8F9');
        bgBar.addColorStop(1.0, 'rgba(56, 189, 248, 0.15)');
        applyGlow(ctxFore, customHighlight || 'rgba(56, 189, 248, 0.85)', 8, 1);
        ctxFore.fillStyle = customHighlight || bgBar;
        roundRectPath(ctxFore, Math.round(heroX - barW * 0.5), barY, barW, Math.max(2.5, Math.round(H * 0.003)), 2);
        ctxFore.fill();
      }

      if (afterTxt && (fullInstant || afterP > 0.01)) {
        const afterBaseY = Math.round(heroBaseY + hSz * 0.34 * lineSpacingMult + aSz * 1.15);
        ctxFore.font = sFn(aSz);
        if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${sTrk}em`;
        applyGlow(ctxFore, 'rgba(0, 0, 0, 0.65)', 4, 1);
        drawTimedSegment(ctxFore, isSampleCard ? null : split.afterWords, afterTxt, heroX, afterBaseY, aSz, sTrk, baseTextCol, applyCase, true, afterEnterStart);
      }
    } finally {
      ctxFore.restore();
    }
    return;
  }

  if (presetKey === 'zine') {
    const zFam = pickFontFam('"Anton", "Impact", sans-serif');
    const zFn = (sz) => `700 ${sz}px ${zFam}`;
    const zTrkHero = trackEmWith(0.015);
    const zTrkBody = trackEmWith(0.02);
    const zHi = pickHi('#EA4C1D');
    const zBase = pickBase('#111827');
    const strips = [];
    if (isSampleCard) {
      strips.push({ txt: applyCase('REAL CREATORS'), isHero: false, tilt: -0.024, segWords: null, pFactor: 1.0, fStart: capStart });
      strips.push({ txt: applyCase('NEVER BLEND IN'), isHero: true, tilt: 0.017, segWords: null, pFactor: 1.0, fStart: capStart });
    } else {
      if (split.beforeTxt) strips.push({ txt: applyCase(split.beforeTxt), isHero: false, tilt: -0.024, segWords: split.beforeWords, pFactor: beforeP, fStart: beforeEnterStart });
      if (split.heroTxt) strips.push({ txt: applyCase(split.heroTxt), isHero: true, tilt: split.beforeTxt ? 0.017 : -0.020, segWords: split.heroWord ? [split.heroWord] : null, pFactor: heroP, fStart: heroEnterStart });
      if (split.afterTxt) strips.push({ txt: applyCase(split.afterTxt), isHero: false, tilt: -0.015, segWords: split.afterWords, pFactor: afterP, fStart: afterEnterStart });
    }
    if (!strips.length) return;

    const baseMaxSz = strips.length >= 3 ? H * 0.040 : H * 0.046;
    strips.forEach((s) => {
      s.sz = fitFont(ctxFore, s.txt, zFn, baseMaxSz * fontScale, H * 0.020, W * 0.76, s.isHero ? zTrkHero : zTrkBody);
    });
    recordSceneBox(heroX - W * 0.44, cy - H * 0.14 * lineSpacingMult, W * 0.88, H * 0.28 * lineSpacingMult);

    const drawTornStrip = (strip, stripCy) => {
      if (!strip.txt || (!fullInstant && strip.pFactor <= 0.01)) return;
      const ep = fullInstant ? 1.0 : easeOutCubic(strip.pFactor);
      const sc = fullInstant ? 1.0 : (0.90 + 0.10 * ep);
      const sz = strip.sz;
      const isHighlight = strip.isHero && (strips.length === 1 || strip !== strips[0] || !split.beforeTxt);
      ctxFore.save();
      try {
        ctxFore.font = zFn(sz);
        if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${zTrkBody}em`;
        const tw = measureW(ctxFore, strip.txt, sz, zTrkBody);
        const padX = Math.round(sz * 0.65);
        const pw = Math.min(Math.round(W * 0.88), Math.round(tw + padX * 2));
        const ph = Math.round(sz * 1.48);

        ctxFore.globalAlpha = exitFade * ep;
        ctxFore.translate(heroX, stripCy);
        ctxFore.rotate(strip.tilt);
        ctxFore.scale(sc, sc);
        const x0 = Math.round(-pw * 0.5);
        const y0 = Math.round(-ph * 0.5);

        ctxFore.shadowColor = 'rgba(0, 0, 0, 0.45)';
        ctxFore.shadowBlur = Math.max(8, Math.round(H * 0.012));
        ctxFore.shadowOffsetY = 4;

        ctxFore.beginPath();
        if (!isHighlight) {
          ctxFore.moveTo(x0, y0);
          ctxFore.lineTo(x0 + pw, y0);
          for (let s = 1; s <= 5; s++) {
            const jx = (s % 2 === 1 ? -4 : 3);
            ctxFore.lineTo(x0 + pw + jx, y0 + (ph * s) / 5);
          }
          ctxFore.lineTo(x0, y0 + ph);
          for (let s = 4; s >= 1; s--) {
            const jx = (s % 2 === 1 ? 4 : -3);
            ctxFore.lineTo(x0 + jx, y0 + (ph * s) / 5);
          }
          ctxFore.closePath();
          ctxFore.fillStyle = '#F7F2E2';
          ctxFore.fill();
        } else {
          roundRectPath(ctxFore, x0, y0, pw, ph, Math.round(H * 0.004));
          ctxFore.fillStyle = '#F9F5EB';
          ctxFore.fill();
          ctxFore.shadowColor = 'transparent';
          ctxFore.strokeStyle = zHi;
          ctxFore.lineWidth = Math.max(1.8, H * 0.0022);
          roundRectPath(ctxFore, x0 + 4, y0 + 4, pw - 8, ph - 8, Math.round(H * 0.003));
          ctxFore.stroke();

          const hlW = Math.round(tw * 0.62);
          const hlX = Math.round(-hlW * 0.35);
          const hlH = Math.round(sz * 0.92);
          ctxFore.fillStyle = customHighlight ? 'rgba(255, 255, 255, 0.35)' : 'rgba(250, 232, 20, 0.85)';
          ctxFore.fillRect(hlX, Math.round(-hlH * 0.48), hlW, hlH);
        }

        applyGlow(ctxFore, 'transparent', 0, 1);
        ctxFore.textBaseline = 'middle';
        drawTimedSegment(ctxFore, strip.segWords, strip.txt, 0, Math.round(sz * 0.04), sz, zTrkBody, isHighlight ? zHi : zBase, applyCase, true, strip.fStart);
      } finally {
        ctxFore.restore();
      }
    };

    if (strips.length === 1) {
      drawTornStrip(strips[0], cy);
    } else if (strips.length === 2) {
      drawTornStrip(strips[0], Math.round(cy - strips[0].sz * 0.78 * lineSpacingMult));
      drawTornStrip(strips[1], Math.round(cy + strips[1].sz * 0.84 * lineSpacingMult));
    } else {
      const stepY = Math.round(Math.max(strips[0].sz, strips[1].sz, strips[2].sz) * 1.62 * lineSpacingMult);
      drawTornStrip(strips[0], cy - stepY);
      drawTornStrip(strips[1], cy);
      drawTornStrip(strips[2], cy + stepY);
    }
    return;
  }

  if (presetKey === 'volt') {
    const beforeTxt = applyCase(isSampleCard ? 'BUILT' : split.beforeTxt);
    const pillTxt = applyCase(isSampleCard ? 'DIFFERENT' : (split.heroTxt || 'DIFFERENT'));
    const afterTxt = applyCase(isSampleCard ? '' : split.afterTxt);
    const tagTxt = `[FOCUS // ${String(capIdx + 1).padStart(2, '0')}]`;
    const mFn = (sz) => `700 ${sz}px "Space Mono", monospace`;
    const wFam = pickFontFam('"Montserrat", "Inter", sans-serif');
    const wFn = (sz) => `italic 900 ${sz}px ${wFam}`;
    const vTrk = trackEmWith(-0.02);
    const vHi = pickHi('#D4FF00');
    const vBase = pickBase('#FFFFFF');

    const tagSz = Math.round(H * 0.017 * fontScale);
    const fullStr = [beforeTxt, pillTxt, afterTxt].filter(Boolean).join('  ');
    const rowSz = fitFont(ctxFore, fullStr, wFn, H * 0.044 * fontScale, H * 0.015, W * 0.76, vTrk);

    ctxFore.save();
    ctxFore.font = wFn(rowSz);
    if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${vTrk}em`;
    const bw = beforeTxt ? measureW(ctxFore, beforeTxt, rowSz, vTrk) : 0;
    const pwTxt = measureW(ctxFore, pillTxt, rowSz, vTrk);
    const aw = afterTxt ? measureW(ctxFore, afterTxt, rowSz, vTrk) : 0;
    ctxFore.restore();

    const pillPadX = Math.round(rowSz * 0.56);
    const pillW = Math.round(pwTxt + pillPadX * 2);
    const pillH = Math.round(rowSz * 1.48);
    const gap1 = beforeTxt ? Math.round(rowSz * 0.34) : 0;
    const gap2 = afterTxt ? Math.round(rowSz * 0.34) : 0;
    const contentW = bw + gap1 + pillW + gap2 + aw;
    const frameW = Math.min(Math.round(W * 0.92), Math.round(Math.max(contentW + H * 0.05, H * 0.24)));
    const frameH = Math.round(pillH + tagSz * 2.0 * lineSpacingMult + H * 0.018);
    const fx0 = Math.round(heroX - frameW * 0.5);
    const fy0 = Math.round(cy - frameH * 0.5);
    const ep = easeOutCubic(Math.max(beforeP, heroP, afterP));
    recordSceneBox(fx0, fy0, frameW, frameH);

    ctxFore.save();
    try {
      ctxFore.globalAlpha = exitFade * ep;
      roundRectPath(ctxFore, fx0, fy0, frameW, frameH, Math.round(H * 0.010));
      ctxFore.fillStyle = 'rgba(8, 12, 18, 0.72)';
      ctxFore.fill();

      const bLen = Math.round(Math.min(frameW, frameH) * 0.16);
      ctxFore.strokeStyle = vHi;
      ctxFore.lineWidth = Math.max(2.0, H * 0.0022);
      const corner = (x, y, dx, dy) => {
        ctxFore.beginPath();
        ctxFore.moveTo(x + dx * bLen, y);
        ctxFore.lineTo(x, y);
        ctxFore.lineTo(x, y + dy * bLen);
        ctxFore.stroke();
      };
      corner(fx0, fy0, 1, 1);
      corner(fx0 + frameW, fy0, -1, 1);
      corner(fx0, fy0 + frameH, 1, -1);
      corner(fx0 + frameW, fy0 + frameH, -1, -1);

      const startX = Math.round(heroX - contentW * 0.5);
      const tagY = Math.round(fy0 + H * 0.012 + tagSz * 0.5);
      ctxFore.font = mFn(tagSz);
      ctxFore.textAlign = 'left';
      ctxFore.textBaseline = 'middle';
      ctxFore.fillStyle = pickBase('#CBD5E1');
      ctxFore.fillText(tagTxt, Math.round(fx0 + H * 0.018), tagY);

      const rowCy = Math.round(fy0 + frameH - pillH * 0.5 - H * 0.012);
      if (beforeTxt && (fullInstant || beforeP > 0.01)) {
        ctxFore.font = wFn(rowSz);
        if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${vTrk}em`;
        applyGlow(ctxFore, 'rgba(0, 0, 0, 0.65)', 6, 1);
        drawTimedSegment(ctxFore, isSampleCard ? null : split.beforeWords, beforeTxt, startX, rowCy, rowSz, vTrk, vBase, applyCase, false, beforeEnterStart);
      }

      const px = Math.round(startX + bw + gap1);
      if (fullInstant || heroP > 0.01) {
        const hep = fullInstant ? 1.0 : easeOutCubic(heroP);
        ctxFore.save();
        ctxFore.globalAlpha = exitFade * ep * hep;
        ctxFore.translate(px + pillW * 0.5, rowCy);
        ctxFore.transform(1, 0, -0.10, 1, 0, 0);
        applyGlow(ctxFore, customHighlight || 'rgba(212, 255, 0, 0.55)', 10, 1);
        roundRectPath(ctxFore, -pillW * 0.5, -pillH * 0.5, pillW, pillH, Math.round(pillH * 0.24));
        ctxFore.fillStyle = vHi;
        ctxFore.fill();

        ctxFore.shadowColor = 'transparent';
        ctxFore.font = wFn(rowSz);
        if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${vTrk}em`;
        ctxFore.textAlign = 'center';
        ctxFore.textBaseline = 'middle';
        ctxFore.fillStyle = '#0A0D14';
        ctxFore.fillText(pillTxt, 0, Math.round(rowSz * 0.04));
        ctxFore.restore();
      }

      if (afterTxt && (fullInstant || afterP > 0.01)) {
        const ax = Math.round(px + pillW + gap2);
        ctxFore.font = wFn(rowSz);
        if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${vTrk}em`;
        applyGlow(ctxFore, 'rgba(0, 0, 0, 0.65)', 6, 1);
        drawTimedSegment(ctxFore, isSampleCard ? null : split.afterWords, afterTxt, ax, rowCy, rowSz, vTrk, vBase, applyCase, false, afterEnterStart);
      }
    } finally {
      ctxFore.restore();
    }
    return;
  }

  if (presetKey === 'porcelain') {
    const beforeTxt = applyCase(isSampleCard ? '' : split.beforeTxt);
    const heroWord = isSampleCard ? 'effortless' : (split.heroTxt ? (userCase === 'upper' ? split.heroTxt.toUpperCase() : (userCase === 'title' ? applyCase(split.heroTxt) : split.heroTxt.toLowerCase())) : 'effortless');
    const afterTxt = applyCase(isSampleCard ? 'LUXURY HABITS' : split.afterTxt);
    const pHFam = pickFontFam('"Playfair Display", Georgia, serif');
    const pTFam = pickFontFam('"Inter", "Poppins", sans-serif');
    const hFn = (sz) => `italic 700 ${sz}px ${pHFam}`;
    const tFn = (sz) => `600 ${sz}px ${pTFam}`;
    const pHTrk = trackEmWith(-0.015);
    const pTTrk = trackEmWith(0.10);
    const pHi = pickHi('#C59B5F');
    const pBase = pickBase('#292524');

    let hSz = Math.round(H * 0.036 * fontScale);
    let tSz = Math.round(H * 0.024 * fontScale);
    const measurePorcelain = (hs, ts) => {
      ctxFore.save();
      ctxFore.font = hFn(hs);
      const hw = measureW(ctxFore, heroWord, hs, pHTrk);
      ctxFore.font = tFn(ts);
      if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${pTTrk}em`;
      const bw = beforeTxt ? measureW(ctxFore, beforeTxt, ts, pTTrk) : 0;
      const aw = afterTxt ? measureW(ctxFore, afterTxt, ts, pTTrk) : 0;
      ctxFore.restore();
      const s1 = beforeTxt ? Math.round(hs * 0.85) : 0;
      const s2 = afterTxt ? Math.round(hs * 0.85) : 0;
      return { bw, s1, hw, s2, aw, total: bw + s1 + hw + s2 + aw };
    };
    let dims = measurePorcelain(hSz, tSz);
    if (dims.total > W * 0.82 && dims.total > 0) {
      const sc = (W * 0.82) / dims.total;
      hSz = Math.max(Math.round(H * 0.018), Math.floor(hSz * sc));
      tSz = Math.max(Math.round(H * 0.012), Math.floor(tSz * sc));
      dims = measurePorcelain(hSz, tSz);
    }

    const cardW = Math.min(Math.round(W * 0.92), Math.round(dims.total + H * 0.056));
    const cardH = Math.round(Math.max(hSz, tSz) * 2.1 * lineSpacingMult);
    const cx0 = Math.round(heroX - cardW * 0.5);
    const cy0 = Math.round(cy - cardH * 0.5);
    const ep = easeOutCubic(Math.max(beforeP, heroP, afterP));
    recordSceneBox(cx0, cy0, cardW, cardH);

    const drawGoldDiamond = (dx) => {
      const dr = Math.max(3, Math.round(hSz * 0.14));
      ctxFore.fillStyle = pHi;
      ctxFore.beginPath();
      ctxFore.moveTo(dx, cy - dr);
      ctxFore.lineTo(dx + dr, cy);
      ctxFore.lineTo(dx, cy + dr);
      ctxFore.lineTo(dx - dr, cy);
      ctxFore.closePath();
      ctxFore.fill();
    };

    ctxFore.save();
    try {
      ctxFore.globalAlpha = exitFade * ep;
      ctxFore.shadowColor = 'rgba(0, 0, 0, 0.38)';
      ctxFore.shadowBlur = Math.max(10, Math.round(H * 0.016));
      ctxFore.shadowOffsetY = 4;
      const rg = ctxFore.createLinearGradient(cx0, cy0, cx0 + cardW, cy0 + cardH);
      rg.addColorStop(0.0, 'rgba(249, 246, 240, 0.95)');
      rg.addColorStop(1.0, 'rgba(232, 224, 211, 0.93)');
      roundRectPath(ctxFore, cx0, cy0, cardW, cardH, Math.round(cardH * 0.34));
      ctxFore.fillStyle = rg;
      ctxFore.fill();

      ctxFore.shadowColor = 'transparent';
      ctxFore.strokeStyle = customHighlight || 'rgba(197, 155, 95, 0.72)';
      ctxFore.lineWidth = Math.max(1.2, H * 0.0014);
      ctxFore.stroke();

      let curX = Math.round(heroX - dims.total * 0.5);
      ctxFore.textBaseline = 'middle';

      if (beforeTxt) {
        if (fullInstant || beforeP > 0.01) {
          ctxFore.font = tFn(tSz);
          if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${pTTrk}em`;
          applyGlow(ctxFore, 'transparent', 0, 1);
          drawTimedSegment(ctxFore, isSampleCard ? null : split.beforeWords, beforeTxt, curX, cy + Math.round(tSz * 0.04), tSz, pTTrk, pBase, applyCase, false, beforeEnterStart);
        }
        curX += dims.bw;
        if (fullInstant || heroP > 0.01) drawGoldDiamond(Math.round(curX + dims.s1 * 0.5));
        curX += dims.s1;
      }

      if (fullInstant || heroP > 0.01) {
        const hep = fullInstant ? 1.0 : easeOutCubic(heroP);
        ctxFore.save();
        ctxFore.globalAlpha = exitFade * ep * hep;
        ctxFore.textAlign = 'left';
        ctxFore.font = hFn(hSz);
        if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${pHTrk}em`;
        applyGlow(ctxFore, 'transparent', 0, 1);
        ctxFore.fillStyle = customHighlight || '#1C1917';
        ctxFore.fillText(heroWord, Math.round(curX), cy);
        ctxFore.restore();
      }
      curX += dims.hw;

      if (afterTxt) {
        if (fullInstant || afterP > 0.01) {
          drawGoldDiamond(Math.round(curX + dims.s2 * 0.5));
          ctxFore.font = tFn(tSz);
          if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${pTTrk}em`;
          applyGlow(ctxFore, 'transparent', 0, 1);
          drawTimedSegment(ctxFore, isSampleCard ? null : split.afterWords, afterTxt, Math.round(curX + dims.s2), cy + Math.round(tSz * 0.04), tSz, pTTrk, pBase, applyCase, false, afterEnterStart);
        }
      }
    } finally {
      ctxFore.restore();
    }
    return;
  }

  if (presetKey === 'holo') {
    const beforeTxt = applyCase(isSampleCard ? 'ONE IDEA' : split.beforeTxt);
    const pillStr = applyCase(isSampleCard ? 'CHANGES ALL' : (split.heroTxt || 'CHANGES'));
    const afterTxt = applyCase(isSampleCard ? '' : split.afterTxt);
    const oFam = pickFontFam('"Outfit", "Poppins", sans-serif');
    const oFn = (sz) => `800 ${sz}px ${oFam}`;
    const oTrk = trackEmWith(-0.015);
    const hBase = pickBase('#F8FAFC');
    const combinedStr = [beforeTxt, pillStr, afterTxt].filter(Boolean).join('  ');
    const tSz = fitFont(ctxFore, combinedStr, oFn, H * 0.032 * fontScale, H * 0.014, W * 0.72, oTrk);

    ctxFore.save();
    ctxFore.font = oFn(tSz);
    if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${oTrk}em`;
    const bw = beforeTxt ? measureW(ctxFore, beforeTxt, tSz, oTrk) : 0;
    const pwTxt = measureW(ctxFore, pillStr, tSz, oTrk);
    const aw = afterTxt ? measureW(ctxFore, afterTxt, tSz, oTrk) : 0;
    ctxFore.restore();

    const pPadX = Math.round(tSz * 0.72);
    const pillW = Math.round(pwTxt + pPadX * 2);
    const pillH = Math.round(tSz * 1.85);
    const gap1 = beforeTxt ? Math.round(tSz * 0.42) : 0;
    const gap2 = afterTxt ? Math.round(tSz * 0.42) : 0;
    const innerW = bw + gap1 + pillW + gap2 + aw;
    const barW = Math.min(Math.round(W * 0.92), Math.round(innerW + H * 0.046));
    const barH = Math.round(pillH * lineSpacingMult + H * 0.022);
    const bx = Math.round(heroX - barW * 0.5);
    const by = Math.round(cy - barH * 0.5);
    const ep = easeOutCubic(Math.max(beforeP, heroP, afterP));
    recordSceneBox(bx, by, barW, barH);

    ctxFore.save();
    try {
      ctxFore.globalAlpha = exitFade * ep;
      ctxFore.shadowColor = 'rgba(0, 0, 0, 0.55)';
      ctxFore.shadowBlur = Math.max(12, Math.round(H * 0.018));
      ctxFore.shadowOffsetY = 5;
      roundRectPath(ctxFore, bx, by, barW, barH, Math.round(barH * 0.34));
      ctxFore.fillStyle = 'rgba(18, 22, 36, 0.84)';
      ctxFore.fill();
      ctxFore.shadowColor = 'transparent';
      ctxFore.strokeStyle = customHighlight || 'rgba(255, 255, 255, 0.24)';
      ctxFore.lineWidth = Math.max(1.2, H * 0.0014);
      ctxFore.stroke();

      const startX = Math.round(heroX - innerW * 0.5);
      ctxFore.textBaseline = 'middle';
      if (beforeTxt && (fullInstant || beforeP > 0.01)) {
        ctxFore.font = oFn(tSz);
        if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${oTrk}em`;
        applyGlow(ctxFore, 'transparent', 0, 1);
        drawTimedSegment(ctxFore, isSampleCard ? null : split.beforeWords, beforeTxt, startX, cy, tSz, oTrk, hBase, applyCase, false, beforeEnterStart);
      }

      const px = Math.round(startX + bw + gap1);
      const py = Math.round(cy - pillH * 0.5);
      if (fullInstant || heroP > 0.01) {
        const hep = fullInstant ? 1.0 : easeOutCubic(heroP);
        ctxFore.save();
        ctxFore.globalAlpha = exitFade * ep * hep;
        const hg = ctxFore.createLinearGradient(px, py, px + pillW, py + pillH);
        hg.addColorStop(0.00, '#CFFAFE');
        hg.addColorStop(0.45, '#F5D0FE');
        hg.addColorStop(0.80, '#DDD6FE');
        hg.addColorStop(1.00, '#BAE6FD');
        applyGlow(ctxFore, customHighlight || 'rgba(165, 243, 252, 0.55)', 10, 1);
        roundRectPath(ctxFore, px, py, pillW, pillH, Math.round(pillH * 0.5));
        ctxFore.fillStyle = customHighlight || hg;
        ctxFore.fill();

        ctxFore.shadowColor = 'transparent';
        ctxFore.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        ctxFore.lineWidth = Math.max(1.2, H * 0.0014);
        ctxFore.stroke();

        ctxFore.font = oFn(tSz);
        if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${oTrk}em`;
        ctxFore.textAlign = 'center';
        ctxFore.textBaseline = 'middle';
        ctxFore.fillStyle = '#0F172A';
        ctxFore.fillText(pillStr, Math.round(px + pillW * 0.5), cy);

        drawSparkle(ctxFore, px + Math.round(pillH * 0.16), py + Math.round(pillH * 0.14), Math.max(5, Math.round(tSz * 0.34)), '#FFFFFF');
        drawSparkle(ctxFore, px + pillW - Math.round(pillH * 0.16), py + pillH - Math.round(pillH * 0.14), Math.max(4, Math.round(tSz * 0.28)), '#FFFFFF');
        ctxFore.restore();
      }

      if (afterTxt && (fullInstant || afterP > 0.01)) {
        const ax = Math.round(px + pillW + gap2);
        ctxFore.font = oFn(tSz);
        if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${oTrk}em`;
        applyGlow(ctxFore, 'transparent', 0, 1);
        drawTimedSegment(ctxFore, isSampleCard ? null : split.afterWords, afterTxt, ax, cy, tSz, oTrk, hBase, applyCase, false, afterEnterStart);
      }
    } finally {
      ctxFore.restore();
    }
    return;
  }

  // 'film' — Espresso Analog Film Strip: strictly chronological [before serif] -> [hero amber badge] -> [after serif]
  const stampTxt = `24FPS • ${isSampleCard ? 'GOLDEN HOUR' : `REEL ${String(capIdx + 1).padStart(2, '0')}`}`;
  const beforeSerif = applyCase(isSampleCard ? 'CHASING LIGHT' : split.beforeTxt);
  const badgeStr = applyCase(isSampleCard ? 'EVERY DAY' : (split.heroTxt || 'GOLDEN'));
  const afterSerif = applyCase(isSampleCard ? '' : split.afterTxt);
  const mFn = (sz) => `700 ${sz}px "Space Mono", monospace`;
  const sFam = pickFontFam('"Playfair Display", Georgia, serif');
  const bFam = pickFontFam('"Inter", "Poppins", sans-serif');
  const sFn = (sz) => `700 ${sz}px ${sFam}`;
  const bFn = (sz) => `700 ${sz}px ${bFam}`;
  const fSTrk = trackEmWith(-0.01);
  const fBTrk = trackEmWith(0.06);
  const fHi = pickHi('#F59E0B');
  const fBase = pickBase('#FFF7E6');

  const stampSz = Math.round(H * 0.016 * fontScale);
  let sSz = Math.round(H * 0.042 * fontScale);
  let bSz = Math.round(H * 0.022 * fontScale);
  const measureFilm = (ss, bs) => {
    ctxFore.save();
    ctxFore.font = sFn(ss);
    const bw = beforeSerif ? measureW(ctxFore, beforeSerif, ss, fSTrk) : 0;
    const aw = afterSerif ? measureW(ctxFore, afterSerif, ss, fSTrk) : 0;
    ctxFore.font = bFn(bs);
    if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${fBTrk}em`;
    const bTxtW = badgeStr ? measureW(ctxFore, badgeStr, bs, fBTrk) : 0;
    ctxFore.restore();
    const pW = badgeStr ? Math.round(bTxtW + bs * 1.4) : 0;
    const pH = badgeStr ? Math.round(bs * 1.95) : 0;
    const g1 = (beforeSerif && badgeStr) ? Math.round(ss * 0.30) : 0;
    const g2 = (afterSerif && badgeStr) ? Math.round(ss * 0.30) : 0;
    return { bw, pW, pH, aw, g1, g2, rowW: bw + g1 + pW + g2 + aw };
  };
  let fDims = measureFilm(sSz, bSz);
  if (fDims.rowW > W * 0.80 && fDims.rowW > 0) {
    const sc = (W * 0.80) / fDims.rowW;
    sSz = Math.max(Math.round(H * 0.017), Math.floor(sSz * sc));
    bSz = Math.max(Math.round(H * 0.012), Math.floor(bSz * sc));
    fDims = measureFilm(sSz, bSz);
  }

  const cardW = Math.min(Math.round(W * 0.92), Math.round(Math.max(fDims.rowW + H * 0.054, H * 0.25)));
  const cardH = Math.round(stampSz * 1.8 * lineSpacingMult + Math.max(sSz, fDims.pH) * 1.42 + H * 0.026);
  const fx0 = Math.round(heroX - cardW * 0.5);
  const fy0 = Math.round(cy - cardH * 0.5);
  const ep = easeOutCubic(Math.max(beforeP, heroP, afterP));
  recordSceneBox(fx0, fy0, cardW, cardH);

  ctxFore.save();
  try {
    ctxFore.globalAlpha = exitFade * ep;
    ctxFore.shadowColor = 'rgba(0, 0, 0, 0.65)';
    ctxFore.shadowBlur = Math.max(12, Math.round(H * 0.018));
    ctxFore.shadowOffsetY = 5;
    roundRectPath(ctxFore, fx0, fy0, cardW, cardH, Math.round(H * 0.014));
    ctxFore.fillStyle = 'rgba(22, 16, 12, 0.84)';
    ctxFore.fill();

    ctxFore.shadowColor = 'transparent';
    ctxFore.strokeStyle = customHighlight || 'rgba(217, 119, 6, 0.36)';
    ctxFore.lineWidth = Math.max(1.1, H * 0.0013);
    ctxFore.stroke();

    const stampY = Math.round(fy0 + H * 0.014 + stampSz * 0.5);
    ctxFore.font = mFn(stampSz);
    ctxFore.textAlign = 'center';
    ctxFore.textBaseline = 'middle';
    ctxFore.fillStyle = fHi;
    applyGlow(ctxFore, customHighlight || 'rgba(245, 158, 11, 0.45)', 5, 1);
    ctxFore.fillText(stampTxt, heroX, stampY);

    const rowCy = Math.round(fy0 + cardH - Math.max(sSz, fDims.pH) * 0.68 - H * 0.010);
    const startX = Math.round(heroX - fDims.rowW * 0.5);

    if (beforeSerif && (fullInstant || beforeP > 0.01)) {
      ctxFore.font = sFn(sSz);
      if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${fSTrk}em`;
      ctxFore.textBaseline = 'middle';
      applyGlow(ctxFore, 'rgba(253, 230, 138, 0.45)', 8, 1);
      drawTimedSegment(ctxFore, isSampleCard ? null : split.beforeWords, beforeSerif, startX, rowCy, sSz, fSTrk, fBase, applyCase, false, beforeEnterStart);
    }

    const bx = Math.round(startX + fDims.bw + fDims.g1);
    if (badgeStr && (fullInstant || heroP > 0.01)) {
      const hep = fullInstant ? 1.0 : easeOutCubic(heroP);
      const by = Math.round(rowCy - fDims.pH * 0.5);
      ctxFore.save();
      ctxFore.globalAlpha = exitFade * ep * hep;
      const ag = ctxFore.createLinearGradient(bx, by, bx + fDims.pW, by + fDims.pH);
      ag.addColorStop(0.0, '#B45309');
      ag.addColorStop(1.0, '#78350F');
      applyGlow(ctxFore, customHighlight || 'rgba(245, 158, 11, 0.40)', 8, 1);
      roundRectPath(ctxFore, bx, by, fDims.pW, fDims.pH, Math.round(fDims.pH * 0.5));
      ctxFore.fillStyle = customHighlight || ag;
      ctxFore.fill();

      ctxFore.shadowColor = 'transparent';
      ctxFore.strokeStyle = 'rgba(251, 191, 36, 0.55)';
      ctxFore.lineWidth = Math.max(1.0, H * 0.0012);
      ctxFore.stroke();

      ctxFore.font = bFn(bSz);
      if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${fBTrk}em`;
      ctxFore.textAlign = 'center';
      ctxFore.textBaseline = 'middle';
      ctxFore.fillStyle = customHighlight ? '#0F172A' : '#FFF7E6';
      ctxFore.fillText(badgeStr, Math.round(bx + fDims.pW * 0.5), rowCy + Math.round(bSz * 0.03));
      ctxFore.restore();
    }

    if (afterSerif && (fullInstant || afterP > 0.01)) {
      const ax = Math.round(bx + fDims.pW + fDims.g2);
      ctxFore.font = sFn(sSz);
      if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${fSTrk}em`;
      ctxFore.textBaseline = 'middle';
      applyGlow(ctxFore, 'rgba(253, 230, 138, 0.45)', 8, 1);
      drawTimedSegment(ctxFore, isSampleCard ? null : split.afterWords, afterSerif, ax, rowCy, sSz, fSTrk, fBase, applyCase, false, afterEnterStart);
    }
  } finally {
    ctxFore.restore();
  }
}

/**
 * Shared multi-word foreground line renderer for kinetic special presets:
 * - 'wordRise'   : Word Rise Line — words emerge sequentially up from below through a baseline clip mask to build the full line
 * - 'spotlight'  : Velvet Spotlight — whole line with veiled upcoming words and warm champagne radial spotlight tracking active word
 * - 'prismTiles' : Prism Kinetic Tiles — each word pops into its own frosted obsidian tile with violet->cyan active tile & micro tilt
 */
function drawKineticLineScenePass(ctxFore, cap, words, t, st, W, H, showAll, styleKey) {
  if (!ctxFore || !words || !words.length) return;
  const capArg = (showAll && cap) ? Object.assign({}, cap, { _forceInstant: typeof t !== 'number' || isNaN(t) || t <= (cap.start || 0) + 0.04 }) : cap;
  const rt = initEditorialSceneRuntime(ctxFore, null, capArg, words, t, st, W, H, false, []);
  if (rt.exitFade <= 0.005) return;

  const {
    isSampleCard, capStart, capEnd, evalT, fullInstant, exitFade, capIdx, heroX, fontScale,
    cleanTok, wordStart, easeOutCubic, measureW, roundRectPath, pickHeroIdx,
    lineSpacingMult, customHighlight, pickHi, pickBase, pickFontFam, trackEmWith, applyGlow, recordSceneBox
  } = rt;
  const anchorRatio = Math.max(0.20, Math.min(0.86, Number(st && (st.posY ?? st.position)) || 0.73));
  const cy = Math.round(H * anchorRatio);

  // Prepare normalized word tokens with fallback timestamps
  const sampleTexts = styleKey === 'wordRise'
    ? ['WORDS', 'BUILD', 'THE', 'WHOLE', 'LINE']
    : (styleKey === 'spotlight' ? ['OWN', 'EVERY', 'SINGLE', 'SECOND'] : ['CREATE', 'NEXT', 'LEVEL', 'REELS']);

  const srcWords = isSampleCard
    ? sampleTexts.map((txt, idx) => ({ t: txt, s: capStart + idx * 0.25, e: capStart + (idx + 1) * 0.25, key: idx === (styleKey === 'wordRise' ? 4 : 2) }))
    : words.slice(0, 10);

  const totalDur = Math.max(0.45, (capEnd > capStart ? capEnd - capStart : srcWords.length * 0.26));
  const stepDur = totalDur / Math.max(1, srcWords.length);
  let heroIdx = srcWords.findIndex(w => Boolean(w && w.key));
  if (heroIdx < 0) heroIdx = pickHeroIdx(srcWords);

  const items = srcWords.map((w, i) => {
    const ws = wordStart(w, capStart + i * stepDur);
    const nextWs = (i + 1 < srcWords.length) ? wordStart(srcWords[i + 1], ws + stepDur) : (capStart + totalDur);
    const we = (w && typeof w.e === 'number') ? w.e : Math.max(ws + 0.14, nextWs);
    const txt = cleanTok(w && (w.t || w.word || ''), true);
    return { text: txt, s: ws, e: we, idx: i, isHero: i === heroIdx };
  }).filter(it => it.text.length > 0);
  if (!items.length) return;

  const isTiles = styleKey === 'prismTiles';
  const isRise = styleKey === 'wordRise';
  const fontFam = pickFontFam(isTiles ? '"Outfit", "Montserrat", sans-serif' : (styleKey === 'spotlight' ? '"Poppins", "Inter", sans-serif' : '"Montserrat", "Poppins", sans-serif'));
  const fontWeight = isTiles ? 900 : (isRise ? 800 : 700);
  const trackEm = trackEmWith(isTiles ? 0.02 : -0.01);
  const maxBoxW = Math.round(W * 0.90);
  const padX = isTiles ? Math.round(H * 0.014) : 0;
  const gapX = isTiles ? Math.round(H * 0.010) : Math.round(H * 0.014);

  const layoutLines = (sz) => {
    ctxFore.save();
    ctxFore.font = `${fontWeight} ${sz}px ${fontFam}`;
    if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${trackEm}em`;
    const lines = [];
    let cur = [];
    let curW = 0;
    for (const it of items) {
      const tw = measureW(ctxFore, it.text, sz, trackEm);
      const boxW = tw + padX * 2;
      const addW = cur.length ? (gapX + boxW) : boxW;
      if (cur.length && curW + addW > maxBoxW) {
        lines.push({ width: curW, words: cur });
        cur = [Object.assign({}, it, { tw, boxW })];
        curW = boxW;
      } else {
        cur.push(Object.assign({}, it, { tw, boxW }));
        curW += addW;
      }
    }
    if (cur.length) lines.push({ width: curW, words: cur });
    ctxFore.restore();
    return lines;
  };

  let fontSize = Math.round(H * (isRise ? 0.032 : (isTiles ? 0.036 : 0.035)) * fontScale);
  const minFontSize = Math.max(12, Math.round(H * 0.019));
  const targetMaxLines = isRise ? 1 : 2;
  let lines = layoutLines(fontSize);
  while (lines.length > targetMaxLines && fontSize > minFontSize) {
    fontSize = Math.max(minFontSize, Math.round(fontSize * 0.88));
    lines = layoutLines(fontSize);
  }

  const lineH = Math.round(fontSize * (isTiles ? 1.56 : 1.36));
  const rowGap = Math.round(fontSize * 0.24 * lineSpacingMult);
  const totalH = lines.length * lineH + Math.max(0, lines.length - 1) * rowGap;
  const maxLineW = lines.reduce((m, l) => Math.max(m, l.width), 0);
  const topY = Math.round(cy - totalH * 0.5);
  recordSceneBox(heroX - maxLineW * 0.5 - H * 0.024, topY - H * 0.016, maxLineW + H * 0.048, totalH + H * 0.032);

  const easeOutBack = (x) => {
    const c1 = 1.35;
    const c3 = c1 + 1;
    const cl = Math.max(0, Math.min(1, x));
    return 1 + c3 * Math.pow(cl - 1, 3) + c1 * Math.pow(cl - 1, 2);
  };

  // Determine currently active speaking word index
  let activeIdx = fullInstant ? (isRise ? items.length - 1 : heroIdx) : -1;
  if (!fullInstant) {
    for (let i = 0; i < items.length; i++) {
      if (evalT >= items[i].s - 0.02 && evalT <= items[i].e + 0.04) {
        activeIdx = i;
      }
    }
    if (activeIdx < 0) {
      for (let i = items.length - 1; i >= 0; i--) {
        if (evalT >= items[i].s) { activeIdx = i; break; }
      }
    }
  }

  ctxFore.save();
  try {
    ctxFore.globalAlpha = exitFade;

    // Shared atmospheric container strip for wordRise & velvetSpotlight
    if (isRise || styleKey === 'spotlight') {
      const stripPadX = Math.round(H * 0.024);
      const stripPadY = Math.round(H * 0.015 * lineSpacingMult);
      const sx = Math.round(heroX - maxLineW * 0.5 - stripPadX);
      const sy = Math.round(topY - stripPadY);
      const sw = Math.round(maxLineW + stripPadX * 2);
      const sh = Math.round(totalH + stripPadY * 2);

      ctxFore.save();
      ctxFore.shadowColor = 'rgba(0, 0, 0, 0.72)';
      ctxFore.shadowBlur = Math.max(10, Math.round(H * 0.018));
      ctxFore.shadowOffsetY = 4;
      roundRectPath(ctxFore, sx, sy, sw, sh, Math.round(H * 0.015));
      ctxFore.fillStyle = styleKey === 'spotlight' ? 'rgba(10, 12, 18, 0.78)' : 'rgba(8, 12, 22, 0.62)';
      ctxFore.fill();
      ctxFore.shadowColor = 'transparent';
      ctxFore.strokeStyle = customHighlight || (styleKey === 'spotlight' ? 'rgba(252, 211, 77, 0.24)' : 'rgba(56, 189, 248, 0.28)');
      ctxFore.lineWidth = Math.max(1.0, H * 0.0012);
      ctxFore.stroke();

      // Baseline luminous beam on wordRise proportional to words revealed
      if (isRise) {
        const revealedRatio = fullInstant ? 1.0 : Math.min(1, Math.max(0.14, (Math.max(0, activeIdx) + 1) / items.length));
        const beamW = Math.round((sw - stripPadX) * revealedRatio);
        const beamX = Math.round(sx + (sw - beamW) * 0.5);
        const beamY = sy + sh - Math.max(3, Math.round(H * 0.0035));
        const beamG = ctxFore.createLinearGradient(beamX, 0, beamX + beamW, 0);
        beamG.addColorStop(0.0, 'rgba(56, 189, 248, 0.20)');
        beamG.addColorStop(0.5, '#38BDF8');
        beamG.addColorStop(1.0, 'rgba(125, 211, 252, 0.25)');
        ctxFore.fillStyle = customHighlight || beamG;
        roundRectPath(ctxFore, beamX, beamY, beamW, Math.max(2.5, Math.round(H * 0.003)), 2);
        ctxFore.fill();
      }
      ctxFore.restore();
    }

    ctxFore.font = `${fontWeight} ${fontSize}px ${fontFam}`;
    if ('letterSpacing' in ctxFore) ctxFore.letterSpacing = `${trackEm}em`;
    ctxFore.textAlign = 'center';
    ctxFore.textBaseline = 'middle';

    lines.forEach((line, rowIdx) => {
      const rowCy = Math.round(topY + rowIdx * (lineH + rowGap) + lineH * 0.5);
      let cursorX = Math.round(heroX - line.width * 0.5);

      line.words.forEach((wObj) => {
        const wCx = Math.round(cursorX + wObj.boxW * 0.5);
        const isCurrent = wObj.idx === activeIdx;
        const enterDur = isRise ? 0.22 : 0.16;
        const rawP = fullInstant ? 1.0 : (evalT >= wObj.s - 0.02 ? Math.min(1, Math.max(0, (evalT - wObj.s) / enterDur)) : 0);

        if (isRise) {
          if (rawP > 0.01) {
            const clipPadX = Math.max(6, Math.round(fontSize * 0.22));
            const clipTop = Math.round(rowCy - lineH * 0.62);
            const clipBot = Math.round(rowCy + lineH * 0.56);
            const yShift = fullInstant
              ? (isSampleCard && wObj.idx === items.length - 1 ? -Math.round(fontSize * 0.08) : 0)
              : Math.round((1 - easeOutBack(rawP)) * lineH * 1.15);

            ctxFore.save();
            ctxFore.beginPath();
            ctxFore.rect(cursorX - clipPadX, clipTop, wObj.boxW + clipPadX * 2, clipBot - clipTop);
            ctxFore.clip();

            ctxFore.globalAlpha = exitFade * Math.min(1, rawP * 2.2);
            applyGlow(ctxFore, isCurrent ? (customHighlight || 'rgba(56, 189, 248, 0.72)') : 'rgba(0, 0, 0, 0.78)', isCurrent ? Math.max(10, Math.round(fontSize * 0.36)) : 6, 1);
            ctxFore.fillStyle = isCurrent ? pickHi('#7DD3FC') : pickBase('#FFFFFF');
            ctxFore.fillText(wObj.text, wCx, rowCy + yShift);
            ctxFore.restore();
          }
        } else if (styleKey === 'spotlight') {
          const isSpoken = fullInstant ? (wObj.idx <= activeIdx) : (evalT >= wObj.s - 0.02);
          ctxFore.save();
          if (isCurrent) {
            const orbR = Math.max(wObj.boxW * 0.78, fontSize * 1.45);
            const rg = ctxFore.createRadialGradient(wCx, rowCy, 2, wCx, rowCy, orbR);
            rg.addColorStop(0.0, customHighlight || 'rgba(252, 211, 77, 0.36)');
            rg.addColorStop(0.65, 'rgba(251, 191, 36, 0.10)');
            rg.addColorStop(1.0, 'rgba(251, 191, 36, 0.0)');
            ctxFore.fillStyle = rg;
            ctxFore.beginPath();
            ctxFore.arc(wCx, rowCy, orbR, 0, Math.PI * 2);
            ctxFore.fill();

            const popT = fullInstant ? 1.0 : easeOutCubic(Math.min(1, (evalT - wObj.s) / 0.14));
            const sc = 1.0 + 0.07 * popT;
            ctxFore.translate(wCx, rowCy);
            ctxFore.scale(sc, sc);
            ctxFore.translate(-wCx, -rowCy);
            applyGlow(ctxFore, customHighlight || 'rgba(251, 191, 36, 0.72)', Math.max(10, Math.round(fontSize * 0.35)), 1);
            ctxFore.fillStyle = pickHi('#FEF08A');
          } else if (isSpoken) {
            applyGlow(ctxFore, 'rgba(0, 0, 0, 0.70)', 5, 1);
            ctxFore.fillStyle = pickBase('rgba(248, 250, 252, 0.96)');
          } else {
            ctxFore.shadowColor = 'rgba(0, 0, 0, 0.45)';
            ctxFore.shadowBlur = 4;
            ctxFore.fillStyle = customHighlight ? 'rgba(248, 250, 252, 0.40)' : 'rgba(248, 250, 252, 0.34)';
          }
          ctxFore.fillText(wObj.text, wCx, rowCy);
          ctxFore.restore();
        } else {
          if (rawP > 0.01) {
            const tileH = Math.round(fontSize * 1.44);
            const tileX = Math.round(cursorX);
            const tileY = Math.round(rowCy - tileH * 0.5);
            const ep = easeOutBack(rawP);
            const sc = fullInstant ? (isCurrent ? 1.05 : 1.0) : ((0.76 + 0.24 * ep) * (isCurrent ? 1.05 : 1.0));
            const tiltRad = (((wObj.idx + capIdx) % 2 === 0 ? -1.4 : 1.4) * Math.PI) / 180;

            ctxFore.save();
            ctxFore.globalAlpha = exitFade * Math.min(1, rawP * 2.4);
            ctxFore.translate(wCx, rowCy);
            ctxFore.rotate(tiltRad);
            ctxFore.scale(sc, sc);
            ctxFore.translate(-wCx, -rowCy);

            applyGlow(ctxFore, isCurrent ? (customHighlight || 'rgba(139, 92, 246, 0.65)') : 'rgba(0, 0, 0, 0.62)', isCurrent ? Math.max(12, Math.round(fontSize * 0.42)) : 8, 1);
            ctxFore.shadowOffsetY = 4;

            roundRectPath(ctxFore, tileX, tileY, wObj.boxW, tileH, Math.round(H * 0.011));
            if (isCurrent) {
              const pg = ctxFore.createLinearGradient(tileX, tileY, tileX + wObj.boxW, tileY + tileH);
              pg.addColorStop(0.0, '#7C3AED');
              pg.addColorStop(1.0, '#06B6D4');
              ctxFore.fillStyle = customHighlight || pg;
            } else {
              ctxFore.fillStyle = 'rgba(15, 18, 30, 0.88)';
            }
            ctxFore.fill();

            ctxFore.shadowColor = 'transparent';
            ctxFore.strokeStyle = isCurrent ? 'rgba(255, 255, 255, 0.65)' : 'rgba(148, 163, 184, 0.26)';
            ctxFore.lineWidth = Math.max(1.0, H * 0.0013);
            ctxFore.stroke();

            ctxFore.fillStyle = pickBase('#FFFFFF');
            applyGlow(ctxFore, isCurrent ? (customHighlight || 'rgba(0, 0, 0, 0.55)') : 'rgba(0, 0, 0, 0.55)', isCurrent ? 8 : 4, 1);
            ctxFore.fillText(wObj.text, wCx, rowCy + Math.round(fontSize * 0.03));
            ctxFore.restore();
          }
        }

        cursorX += wObj.boxW + gapX;
      });
    });
  } finally {
    ctxFore.restore();
  }
}

function drawCanvasTypography(ctxFore, ctxBehind, cap, words, t, st, W, H, isBehind, showAll, isPreview = false) {
  window._capdbg2Keys = window._capdbg2Keys || new Set();
  const capdbg2Key = `${isPreview}|${W}x${H}|${S.style && S.style.lineSpacing}`;
  if (!window._capdbg2Keys.has(capdbg2Key)) {
    window._capdbg2Keys.add(capdbg2Key);
    const caller = (new Error().stack || '').split('\n').slice(2, 4).join(' <- ');
    console.log(`[CAPDBG2] mode=${isPreview ? 'preview' : 'export'} W=${W} H=${H} styleId=${S.style && S.style.id} styleName=${S.style && S.style.name} layout=${S.style && S.style.layout} dubaiFlag=${S.style && S.style.dubaiLuxuryStack} isBehind=${isBehind} lineSpacing=${S.style && S.style.lineSpacing} fontScale=${S.style && S.style.fontScale} caller=${caller}`);
  }
  if (!ctxFore) return;
  _captionsDrawnCount++;
  if (st && st.videoTemplate === 'popStudio') {
    return;
  }

  // B3 Export Parity: Caption manual positioning, rotation & scale (ratio offsets relative to W, H)
  const capDx = (Number(cap && cap.dx) || 0) * W;
  const capDy = (Number(cap && cap.dy) || 0) * H;
  const capScale = (cap && typeof cap.scale === 'number' && cap.scale > 0) ? cap.scale : 1.0;
  const capRot = Number(cap && cap.rot) || 0;
  const hasCapTransform = capDx !== 0 || capDy !== 0 || capScale !== 1.0 || capRot !== 0;

  if (hasCapTransform) {
    const origCx = W * 0.5;
    const origCy = H * (Number(st && (st.position || st.posY)) || 0.65);
    const rotRad = (capRot * Math.PI) / 180;
    const applyCtxTransform = (c) => {
      c.save();
      c.translate(origCx + capDx, origCy + capDy);
      if (rotRad) c.rotate(rotRad);
      c.scale(capScale, capScale);
      c.translate(-origCx, -origCy);
    };
    applyCtxTransform(ctxFore);
    if (ctxBehind && ctxBehind !== ctxFore) {
      applyCtxTransform(ctxBehind);
    }
  }

  try {
    if (st && (st.videoTemplate === 'specialRealEstate' || (S.realEstateConfig && S.realEstateConfig.enabled))) {
      drawSpecialRealEstateTemplate(ctxFore, ctxBehind, cap, words, t, st, W, H, isBehind, showAll, isPreview);
    } else {
      const fontScale = (typeof S.style?.fontScale === 'number' && S.style.fontScale > 0)
        ? S.style.fontScale
        : ((typeof st.fontScale === 'number' && st.fontScale > 0) ? st.fontScale : 1.0);
      const base = Math.max(260, Math.min(W, H)) * Math.max(0.5, Math.min(2.5, fontScale));
      const presetId = st.id || '';
      const offsetX = (Number(st.offsetX) || 0) * W;
      ctxFore.save(); ctxFore.translate(offsetX, 0);
      if (ctxBehind && ctxBehind !== ctxFore) { ctxBehind.save(); ctxBehind.translate(offsetX, 0); }
      const frontSignatureKey =
        (st.chromeLiquid || presetId === 'chrome_liquid_mercury') ? 'chrome' :
        (st.tornZine || presetId === 'torn_zine_cutout') ? 'zine' :
        (st.acidVoltTicker || presetId === 'acid_volt_ticker') ? 'volt' :
        (st.porcelainRibbon || presetId === 'porcelain_editorial_ribbon') ? 'porcelain' :
        (st.holoAuraPill || presetId === 'holo_aura_pill') ? 'holo' :
        (st.analogFilmStrip || presetId === 'espresso_analog_film') ? 'film' : '';

      const kineticLineKey =
        (st.wordRiseCascade || presetId === 'word_rise_cascade') ? 'wordRise' :
        (st.velvetSpotlight || presetId === 'velvet_spotlight_line') ? 'spotlight' :
        (st.prismTileKinetic || presetId === 'prism_tile_kinetic') ? 'prismTiles' : '';

      if (frontSignatureKey) {
        drawFrontSignatureScenePass(ctxFore, cap, words, t, st, W, H, showAll, frontSignatureKey);
      } else if (kineticLineKey) {
        drawKineticLineScenePass(ctxFore, cap, words, t, st, W, H, showAll, kineticLineKey);
      } else if (st.adaptiveEstateFlex || st.id === 'adaptive_estate_flex') {
        drawAdaptiveEstateFlexPass(ctxFore, ctxBehind, cap, words, t, st, W, H, isBehind, showAll, isPreview);
      } else if (st.id === 'editorial_depth_stack') {
        drawEditorialDepthStackPass(ctxFore, ctxBehind, cap, words, t, st, W, H, isBehind, showAll, isPreview);
      } else if (st.id === 'real_estate_depth_split') {
        drawRealEstateDepthSplitPass(ctxFore, ctxBehind, cap, words, t, st, W, H, isBehind, showAll, isPreview);
      } else if (st.id === 'electric_kinetic_stack') {
        drawElectricKineticStackPass(ctxFore, cap, words, t, st, W, H, showAll, isPreview);
      } else if (st.crazySunsetStack || st.id === 'crazy_sunset_stack') {
        drawCrazySunsetStackPass(ctxFore, cap, words, t, st, W, H, showAll, isPreview);
      } else if (st.prismGlassDepth || st.id === 'prism_glass_depth') {
        drawPrismGlassDepthPass(ctxFore, ctxBehind, cap, words, t, st, W, H, isBehind, showAll, isPreview);
      } else if (st.kineticCollage || st.id === 'kinetic_collage') {
        drawKineticCollagePass(ctxFore, ctxBehind, cap, words, t, st, W, H, isBehind, showAll, isPreview);
      } else if (st.obsidianGoldCouture || st.id === 'obsidian_gold_couture') {
        drawObsidianCouturePass(ctxFore, ctxBehind, cap, words, t, st, W, H, isBehind, showAll, isPreview);
      } else if (st.auroraSpatialDepth || st.id === 'aurora_spatial_depth') {
        drawAuroraSpatialDepthPass(ctxFore, ctxBehind, cap, words, t, st, W, H, isBehind, showAll, isPreview);
      } else if (st.cobaltArchive || st.id === 'cobalt_archive') {
        drawCobaltArchivePass(ctxFore, ctxBehind, cap, words, t, st, W, H, isBehind, showAll, isPreview);
      } else if (st.celestialMonolith || st.id === 'celestial_monolith') {
        drawCelestialMonolithPass(ctxFore, ctxBehind, cap, words, t, st, W, H, isBehind, showAll, isPreview);
      } else if (isBehind || (st.layout === 'stack' || st.isDuo) && (st.mode === 'emphasis' || st.category === 'duo' || !st.mode)) {
        drawInkStackPass(ctxFore, ctxBehind, cap, words, t, st, W, H, isBehind, showAll, isPreview);
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
      const stored = safeLSGet('cs_user') || getCookieVal('cs_user');
      if (stored) {
        S.user = JSON.parse(stored);
        if (S.user && S.user.email) {
          safeLSSet('cs_user', JSON.stringify(S.user));
        }
      }
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
      safeLSRemove('cs_user');
      setCookieVal('cs_user', '', -1);
      safeLSRemove('cs_credits');
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
            cache: 'no-store',
            credentials: 'same-origin',
            body: JSON.stringify({
              name,
              email,
              device_id: getPersistentDeviceId(),
              client_credits: S.credits,
              has_proof: safeLSGet('cs_has_paid') === 'true' || safeLSGet('cs_coupon_used') === 'true',
              free_used: S.credits === 0 && safeLSGet('cs_free_used') === 'true'
            })
          });
          const data = await res.json();
          if (!res.ok || !data.ok) {
            throw new Error(data.error || 'Login failed. Please use your valid Gmail.');
          }
          if (data.ok && data.user) {
            S.user = data.user;
            safeLSSet('cs_user', JSON.stringify(S.user));
            setCookieVal('cs_user', JSON.stringify({ id: S.user.id, email: S.user.email, name: S.user.name }), 365);
            if (data.has_paid) safeLSSet('cs_has_paid', 'true');
            // Sync exact server credits for this user across any device
            if (typeof data.credits === 'number') {
              saveUserCredits(data.credits);
            }
            syncUserUI();
            updateCreditsUI();
            if (window.__syncCreditsFromServer) window.__syncCreditsFromServer(true);
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
              if (renderedBtn) {
                renderedBtn.click();
              } else if (typeof isInAppBrowser === 'function' && isInAppBrowser()) {
                showToast('Instagram browser blocks Google Sign-In. Opening in Chrome / Safari...');
                if (typeof openExternalBrowser === 'function') openExternalBrowser();
              }
            }
          });
        } else if (typeof isInAppBrowser === 'function' && isInAppBrowser()) {
          showToast('Google Sign-In is blocked inside Instagram. Opening Chrome / Safari...');
          if (typeof openExternalBrowser === 'function') openExternalBrowser();
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
        cache: 'no-store',
        credentials: 'same-origin',
        body: JSON.stringify({
          id: payload.sub,
          email: payload.email,
          name: payload.name,
          picture: payload.picture,
          device_id: getPersistentDeviceId(),
          client_credits: S.credits,
          has_proof: safeLSGet('cs_has_paid') === 'true' || safeLSGet('cs_coupon_used') === 'true',
          free_used: S.credits === 0 && safeLSGet('cs_free_used') === 'true'
        })
      }).then(r => r.json()).then(data => {
        if (data.ok && data.user) {
          S.user = data.user;
          safeLSSet('cs_user', JSON.stringify(S.user));
          setCookieVal('cs_user', JSON.stringify({ id: S.user.id, email: S.user.email, name: S.user.name }), 365);
          if (data.has_paid) safeLSSet('cs_has_paid', 'true');
          // Sync exact server credits for this Gmail account across any device
          if (typeof data.credits === 'number') {
            saveUserCredits(data.credits);
          }
          syncUserUI();
          updateCreditsUI();
          if (window.__syncCreditsFromServer) window.__syncCreditsFromServer(true);
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
  // Safe storage + 1st-party cookie helpers (resilient in Instagram / TikTok in-app WebViews)
  function safeLSGet(key) {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  }
  function safeLSSet(key, val) {
    try { localStorage.setItem(key, String(val)); return true; } catch (_) { return false; }
  }
  function safeLSRemove(key) {
    try { localStorage.removeItem(key); return true; } catch (_) { return false; }
  }
  function getCookieVal(name) {
    try {
      const m = document.cookie.match(new RegExp('(?:^|;\\s*)' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)'));
      return m ? decodeURIComponent(m[1]) : null;
    } catch (_) { return null; }
  }
  function setCookieVal(name, val, days) {
    try {
      const maxAge = Math.max(60, Math.round((days || 365) * 86400));
      document.cookie = name + '=' + encodeURIComponent(String(val)) + '; path=/; max-age=' + maxAge + '; SameSite=Lax';
    } catch (_) {}
  }
  function getPersistentDeviceId() {
    let devId = safeLSGet('cs_device_id') || getCookieVal('cs_device_id');
    if (!devId) {
      devId = 'dev_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36);
    }
    safeLSSet('cs_device_id', devId);
    setCookieVal('cs_device_id', devId, 365);
    return devId;
  }

  function saveUserCredits(val) {
    const num = Math.max(0, parseInt(val, 10) || 0);
    S.credits = num;
    safeLSSet('cs_credits', String(num));
    const userEmail = S.user ? (S.user.email || '').trim().toLowerCase() : '';
    if (userEmail) {
      safeLSSet('cs_credits_' + userEmail, String(num));
    }
    if (num === 0) {
      safeLSSet('cs_free_used', 'true');
      if (userEmail) {
        safeLSSet('cs_free_used_' + userEmail, 'true');
      }
    } else {
      // User has positive credits! Clear free_used flags so refresh never wipes valid credits
      safeLSRemove('cs_free_used');
      if (userEmail) {
        safeLSRemove('cs_free_used_' + userEmail);
      }
    }
  }

  function deductCreditAfterExport() {
    saveUserCredits(Math.max(0, S.credits - 1));
    updateCreditsUI();

    const devId = getPersistentDeviceId();
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
        pill.title = '0 Credits (Recharge to Export). Tap to unlock';
        countSpan.textContent = '0';
      } else {
        pill.classList.remove('credit-zero');
        pill.title = `${text}. Click to recharge credits or enter VIP code`;
        // Compact display in header chip: show number only so header never overflows mobile screens
        countSpan.textContent = `${S.credits}`;
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
      }
      const pInput = $('inputPaymentPhone');
      if (pInput) {
        const savedPhone = (localStorage.getItem('cs_user_phone') || '').replace(/\D/g, '');
        if (savedPhone) pInput.value = savedPhone;
      }
      const msg = $('couponMsg');
      if (msg) msg.classList.add('hidden');
    }
  }

  function setupCouponHandlers() {
    // Persistent Device Fingerprint (backed by both localStorage & cookie for in-app WebViews)
    const deviceId = getPersistentDeviceId();

    // Load credits strictly linked to Gmail/Account if logged in
    const userEmail = S.user ? (S.user.email || '').trim().toLowerCase() : '';
    const userCreditKey = userEmail ? ('cs_credits_' + userEmail) : 'cs_credits';
    const freeUsedKey = userEmail ? ('cs_free_used_' + userEmail) : 'cs_free_used';

    const savedUserVal = userEmail ? safeLSGet(userCreditKey) : null;
    const savedGlobalVal = safeLSGet('cs_credits');

    let savedCredits = null;
    if (savedUserVal !== null && !isNaN(parseInt(savedUserVal, 10))) {
      savedCredits = parseInt(savedUserVal, 10);
    }
    if (savedGlobalVal !== null && !isNaN(parseInt(savedGlobalVal, 10))) {
      const gVal = parseInt(savedGlobalVal, 10);
      savedCredits = (savedCredits !== null) ? Math.max(savedCredits, gVal) : gVal;
    }

    // One-time cleanup of legacy free 1-export: ensure no unearned free credit persists
    try {
      if (safeLSGet('cs_no_free_v2') !== 'true') {
        const hasRealPayment = safeLSGet('cs_has_paid') === 'true' || safeLSGet('cs_coupon_used') === 'true';
        if (!hasRealPayment) {
          safeLSRemove('cs_credits');
          if (userEmail) safeLSRemove(userCreditKey);
          savedCredits = 0;
        }
        safeLSSet('cs_no_free_v2', 'true');
      }
    } catch (_) {}

    if (savedCredits !== null && savedCredits >= 0) {
      S.credits = savedCredits;
    } else {
      S.credits = 0;
      saveUserCredits(0);
    }
    updateCreditsUI();

    // Authoritative server credit sync with retry backoff, timeout, and no-store cache
    // (fixes blank/0 credits inside Instagram WebView & bfcache restores)
    let _creditSyncInFlight = false;
    let _lastCreditSyncAt = 0;
    let _creditRetryTimer = null;

    function syncCreditsFromServer(force, attempt) {
      const retryAttempt = attempt || 0;
      const now = Date.now();
      if (_creditSyncInFlight && retryAttempt === 0) return;
      if (!force && retryAttempt === 0 && (now - _lastCreditSyncAt) < 3500) return;

      _creditSyncInFlight = true;
      const curDevId = getPersistentDeviceId();
      const curEmail = S.user ? (S.user.email || '').trim().toLowerCase() : '';
      const checkPayload = {
        device_id: curDevId,
        email: curEmail,
        user_id: S.user ? S.user.id : null,
        client_credits: S.credits
      };

      const controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => { try { controller.abort(); } catch (_) {} }, 8000) : null;

      return fetch('/api/credits/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
        cache: 'no-store',
        credentials: 'same-origin',
        signal: controller ? controller.signal : undefined,
        body: JSON.stringify(checkPayload)
      }).then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      }).then(data => {
        if (timeoutId) clearTimeout(timeoutId);
        _creditSyncInFlight = false;
        _lastCreditSyncAt = Date.now();
        if (data && typeof data.credits === 'number') {
          if (data.has_paid) safeLSSet('cs_has_paid', 'true');
          const serverCredits = Math.max(0, data.credits);
          const hasVerifiedProof = Boolean(data.has_paid) || safeLSGet('cs_has_paid') === 'true' || safeLSGet('cs_coupon_used') === 'true';
          if (S.credits > serverCredits && hasVerifiedProof) {
            saveUserCredits(S.credits);
            fetch('/api/credits/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              cache: 'no-store',
              credentials: 'same-origin',
              body: JSON.stringify({ device_id: curDevId, email: curEmail, credits: S.credits })
            }).catch(() => {});
          } else {
            S.credits = serverCredits;
            saveUserCredits(serverCredits);
          }
          updateCreditsUI();
        }
      }).catch(e => {
        if (timeoutId) clearTimeout(timeoutId);
        _creditSyncInFlight = false;
        console.warn('Credit check notice (attempt ' + (retryAttempt + 1) + '):', e);
        const retryDelays = [900, 2200, 4500];
        if (retryAttempt < retryDelays.length) {
          if (_creditRetryTimer) clearTimeout(_creditRetryTimer);
          _creditRetryTimer = setTimeout(() => {
            syncCreditsFromServer(true, retryAttempt + 1);
          }, retryDelays[retryAttempt]);
        }
      });
    }

    window.__syncCreditsFromServer = syncCreditsFromServer;
    syncCreditsFromServer(true, 0);

    window.addEventListener('pageshow', (ev) => {
      syncCreditsFromServer(Boolean(ev && ev.persisted), 0);
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        syncCreditsFromServer(false, 0);
      }
    });
    window.addEventListener('focus', () => {
      syncCreditsFromServer(false, 0);
    });

    const pill = $('creditPill');
    const modalCoupon = $('modalCoupon');
    const btnCloseCoupon = $('btnCloseCouponModal');
    const btnRedeem = $('btnRedeemCoupon');
    const inputCode = $('inputCouponCode');
    const msg = $('couponMsg');

    let _couponModalOpenedTime = 0;
    const handleOpenCoupon = (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      _couponModalOpenedTime = Date.now();
      openCouponModal();
    };
    if (pill) {
      // Standard click listener with stopPropagation (NEVER pointerup to prevent ghost tap-through on backdrop)
      pill.addEventListener('click', handleOpenCoupon);
    }
    if (btnCloseCoupon && modalCoupon) {
      btnCloseCoupon.addEventListener('click', (e) => {
        e.stopPropagation();
        modalCoupon.classList.add('hidden');
      });
    }
    if (modalCoupon) {
      modalCoupon.addEventListener('click', (e) => {
        // Prevent accidental backdrop closing from tap-through within 350ms of opening
        if (Date.now() - _couponModalOpenedTime < 350) return;
        if (e.target === modalCoupon) {
          modalCoupon.classList.add('hidden');
        }
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
        const deviceId = getPersistentDeviceId();

        const userEmail = S.user ? (S.user.email || '').trim().toLowerCase() : '';
        const res = await fetch('/api/coupons/redeem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          credentials: 'same-origin',
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
        safeLSSet('cs_coupon_used', 'true');
        safeLSSet('cs_has_paid', 'true');
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

        const devId = getPersistentDeviceId();

        const userEmail = S.user ? (S.user.email || '').trim().toLowerCase() : '';
        const userName = S.user ? (S.user.name || '') : '';

        const inputPhone = $('inputPaymentPhone');
        const phoneVal = inputPhone ? inputPhone.value.trim().replace(/\D/g, '') : '';
        const savedPhone = phoneVal || (localStorage.getItem('cs_user_phone') || '').replace(/\D/g, '');
        if (savedPhone && savedPhone.length === 10) {
          try { localStorage.setItem('cs_user_phone', savedPhone); } catch (_) {}
        }

        // 1. Create Order on backend
        const orderRes = await fetch('/api/payment/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pack_id: packId,
            device_id: devId,
            email: userEmail,
            name: userName,
            phone: savedPhone
          })
        });

        const orderData = await orderRes.json();
        if (!orderRes.ok || !orderData.ok) {
          throw new Error(orderData.error || 'Failed to initialize payment');
        }

        // 2. Open official Razorpay Checkout Modal
        const prefill = {};
        if (userName && userName.trim()) prefill.name = userName.trim();
        if (userEmail && userEmail.includes('@')) prefill.email = userEmail.trim();
        if (savedPhone && savedPhone.length === 10) {
          prefill.contact = savedPhone;
        }

        const options = {
          key: orderData.key_id,
          amount: orderData.amount,
          currency: orderData.currency || 'INR',
          name: 'HLO-CAPTIONS PRO',
          description: orderData.pack ? orderData.pack.title : 'Video Export Pass',
          order_id: orderData.order_id,
          theme: {
            color: '#7c3aed'
          },
          send_sms_hash: true,
          retry: {
            enabled: true,
            max_count: 3
          },
          prefill: prefill,
          modal: {
            confirm_close: true,
            ondismiss: function () {
              console.log('Razorpay modal dismissed by user');
            }
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
              safeLSSet('cs_has_paid', 'true');
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

    const inputPaymentPhone = $('inputPaymentPhone');
    if (inputPaymentPhone) {
      inputPaymentPhone.addEventListener('input', (e) => {
        const clean = e.target.value.replace(/\D/g, '').slice(0, 10);
        e.target.value = clean;
        if (clean.length === 10) {
          try { localStorage.setItem('cs_user_phone', clean); } catch (_) {}
        }
      });
    }
  }

  async function init() {
    const runBlock = (blockName, fn) => {
      try {
        fn();
      } catch (err) {
        console.error('[INIT]', blockName, err);
      }
    };

    // Load presets and templates early so screen is never blank
    try {
      await loadPresets();
    } catch (err) {
      console.error('[INIT]', 'loadPresets', err);
    }

    runBlock('inAppBrowserHandler', initInAppBrowserHandler);
    runBlock('uploadHandlers', setupUploadHandlers);
    runBlock('transportHandlers', setupTransportHandlers);
    runBlock('timelineHandlers', setupTimelineHandlers);
    runBlock('videoOverlayInteractions', setupVideoOverlayInteractions);
    runBlock('timelineActionBar', setupTimelineActionBar);
    runBlock('captionEditSheet', setupCaptionEditSheet);
    runBlock('templateSearch', setupTemplateSearch);
    runBlock('drawerAndNavHandlers', setupDrawerAndNavHandlers);
    runBlock('styleHandlers', setupStyleHandlers);
    runBlock('audioHandlers', setupAudioHandlers);
    runBlock('brollHandlers', setupBrollHandlers);
    runBlock('modalHandlers', setupModalHandlers);
    runBlock('canvasSizing', setupCanvasSizing);
    runBlock('captionDragging', setupCaptionDragging);
    runBlock('keepAliveHeartbeat', startKeepAliveHeartbeat);
    runBlock('authHandlers', setupAuthHandlers);
    runBlock('projectHandlers', setupProjectHandlers);
    runBlock('couponHandlers', setupCouponHandlers);
    runBlock('layoutDebugHelper', setupLayoutDebugHelper);
  }

  function startKeepAliveHeartbeat() {
    // Keep-alive heartbeat: ping server every 8 minutes while tab is open between 8:00 AM and 11:00 PM local time
    setInterval(() => {
      const hr = new Date().getHours();
      if (hr >= 8 && hr < 23) {
        fetch('/api/ping', { cache: 'no-store' }).catch(() => {});
      }
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
      big.style.color = (kRole.color && (preset.porcelainRibbon || preset.holoAuraPill || preset.acidVoltTicker || preset.tornZine || preset.prismTileKinetic)) ? kRole.color : '#000';
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
        let dispName = preset.name.replace(/^Duo\s*[·-]\s*/i, '').replace(/^Sequence\s*[·-]\s*/i, '');
    if (preset.id === 'duo_03' || preset.id === 'special_03' || dispName.toLowerCase().includes('white + navy') || dispName.toLowerCase().includes('real estate clr')) {
      dispName = 'Real Estate Clr';
      tag = '👑 REAL ESTATE';
    }
    nameSpan.textContent = dispName;

    if (preset.id === 'duo_03' || preset.id === 'special_03' || dispName === 'Real Estate Clr') {
      const dotsRow = document.createElement('div');
      dotsRow.className = 'preset-card-dots-row';
      REAL_ESTATE_CLR_PALETTE.forEach(c => {
        const dot = document.createElement('span');
        dot.className = 'mini-dot';
        dot.style.background = c.top;
        dotsRow.appendChild(dot);
      });
      art.appendChild(dotsRow);
    }

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

  let _frontActiveCat = 'all';
  let _frontSearchQuery = '';

  function renderFrontShowcasePresets(filterCat, searchQuery) {
    const grid = $('frontPresetGrid') || $('duoPresetGrid');
    if (!grid) return;
    if (typeof filterCat === 'string' && filterCat.length > 0) {
      _frontActiveCat = filterCat;
    }
    if (typeof searchQuery === 'string') {
      _frontSearchQuery = searchQuery.toLowerCase().trim();
    } else {
      const fInput = $('frontTemplateSearchInput');
      if (fInput && typeof fInput.value === 'string') {
        _frontSearchQuery = fInput.value.toLowerCase().trim();
      }
    }

    grid.innerHTML = '';

    const filtered = (S.presets || []).filter(p => matchesPresetFilter(p, _frontActiveCat, _frontSearchQuery));

    const countPill = $('frontPresetCount') || $('duoPresetCount');
    if (countPill) countPill.textContent = `${filtered.length} STYLES`;

    const selectedName = $('frontSelectedName') || $('duoSelectedName');
    if (selectedName) {
      const activeName = (S.style && S.style.name) || (filtered[0] && filtered[0].name) || 'Yellow Box Pop';
      selectedName.textContent = activeName.replace(/^Duo\s*[·-]\s*/i, '');
    }

    if (!filtered.length) {
      grid.innerHTML = `<p class="duo-empty">No templates match${_frontSearchQuery ? ` "${_frontSearchQuery}"` : ' in this category'}.</p>`;
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
    const allPill = $('#frontCategoryPills .cat-pill[data-cat="all"]');
    if (allPill && S.presets && S.presets.length) {
      allPill.textContent = `All (${S.presets.length})`;
    }
    const duoPill = $('#frontCategoryPills .cat-pill[data-cat="duo"]');
    if (duoPill && S.presets) {
      const duoCount = S.presets.filter(p => p.isDuo || (p.category === 'duo')).length;
      duoPill.textContent = `⚡ Duo Styles (${duoCount})`;
    }
    frontCatPills.forEach(pill => {
      if (pill._frontPillBound) return;
      pill._frontPillBound = true;
      pill.addEventListener('click', () => {
        frontCatPills.forEach(p => p.classList.toggle('active', p === pill));
        const cat = pill.getAttribute('data-cat') || 'all';
        renderFrontShowcasePresets(cat, _frontSearchQuery);
      });
    });

    const fSearch = $('frontTemplateSearchInput');
    if (fSearch && !fSearch._frontSearchBound) {
      fSearch._frontSearchBound = true;
      const onFrontSearch = (e) => {
        renderFrontShowcasePresets(_frontActiveCat, e.target.value);
      };
      fSearch.addEventListener('input', onFrontSearch);
      fSearch.addEventListener('search', onFrontSearch);
    }
  }

  async function loadPresets() {
    // Invalidate stale caches so old deleted duplicates never persist
    const CURRENT_PRESET_VER = 'v7.27.0';
    try {
      if (localStorage.getItem('cs_preset_version') !== CURRENT_PRESET_VER) {
        localStorage.removeItem('cs_presets_cache');
        localStorage.removeItem('cs_presets');
        localStorage.setItem('cs_preset_version', CURRENT_PRESET_VER);
      }
    } catch (_) {}

    // 0. Ensure default presets exist immediately so screen is NEVER blank
    if (!S.presets || S.presets.length === 0) {
      S.presets = [
        {
          id: "dubai_luxury_stack",
          name: "Dubai Luxury Stack",
          category: "real-estate",
          badge: "👑 DUBAI REEL",
          previewWord: "INVESTMENT",
          isDuo: true,
          isSpecial: true,
          behindPerson: false,
          depthAccent: false,
          dubaiLuxuryStack: true,
          layout: "stack",
          mode: "emphasis",
          position: 0.67,
          posY: 0.67,
          posX: 0.5,
          inkGap: 0.01,
          leading: 0.88,
          fontScale: 1.0,
          wordsPerPage: 3,
          wordsPerCaption: 3,
          maxKeys: 1,
          animation: "slide-up",
          outlineMode: "none",
          glowEnabled: false,
          highlightColor: "#FFC72C",
          baseColor: "#FFFFFF",
          key: {
            font: "Montserrat",
            size: 0.088,
            weight: 900,
            bold: true,
            italic: false,
            upper: true,
            color: "#FFC72C",
            outline: 0,
            shadow: 8,
            shadowColor: "rgba(0, 0, 0, 0.65)",
            track: -0.02
          },
          accent2: {
            font: "Poppins",
            size: 0.096,
            weight: 800,
            bold: true,
            italic: false,
            upper: false,
            lower: true,
            color: "#FFFFFF",
            outline: 0,
            shadow: 8,
            shadowColor: "rgba(0, 0, 0, 0.65)",
            track: -0.03
          },
          filler: {
            font: "Poppins",
            size: 0.044,
            weight: 700,
            bold: true,
            italic: false,
            upper: false,
            lower: true,
            color: "#FFFFFF",
            outline: 0,
            shadow: 6,
            shadowColor: "rgba(0, 0, 0, 0.65)",
            track: -0.01
          },
          roles: {
            base: {
              font: "Poppins",
              size: 48.0,
              weight: 700,
              bold: true,
              italic: false,
              upper: false,
              lower: true,
              color: "#FFFFFF",
              outline: 0,
              shadow: 6,
              shadowColor: "rgba(0, 0, 0, 0.65)",
              track: -0.01,
              enter: "slide-up",
              layer: "front"
            },
            accent: {
              font: "Montserrat",
              size: 95.0,
              weight: 900,
              bold: true,
              italic: false,
              upper: true,
              color: "#FFC72C",
              outline: 0,
              shadow: 8,
              shadowColor: "rgba(0, 0, 0, 0.65)",
              track: -0.02,
              enter: "slide-up",
              layer: "front",
              fill: {
                type: "solid",
                colors: ["#FFC72C"],
                angle: 90
              }
            },
            accent2: {
              font: "Poppins",
              size: 104.0,
              weight: 800,
              bold: true,
              italic: false,
              upper: false,
              lower: true,
              color: "#FFFFFF",
              outline: 0,
              shadow: 8,
              shadowColor: "rgba(0, 0, 0, 0.68)",
              track: -0.03,
              enter: "slide-up",
              layer: "front",
              fill: {
                type: "solid",
                colors: ["#FFFFFF"],
                angle: 90
              }
            }
          }
        },
        { id: 'yellow_box', name: 'Yellow Box Pop', category: 'box', highlightColor: '#FFE600', key: { font: 'Poppins', color: '#FFE600', bold: true }, filler: { font: 'Poppins', color: '#FFFFFF' }, position: 0.75, fontScale: 1.0, pill: '#FFE600' },
        { id: 'box_pop', name: 'Box Pop Classic', category: 'box', highlightColor: '#FFE600', key: { font: 'Poppins', color: '#FFE600', bold: true }, filler: { font: 'Poppins', color: '#FFFFFF' }, position: 0.75, fontScale: 1.0 },
        { id: 'duo_sunset', name: 'Duo Sunset Pop', isDuo: true, category: 'duo', highlightColor: '#FF6B00', key: { font: 'Poppins', color: '#FF6B00', bold: true }, filler: { font: 'Poppins', color: '#FFFFFF' }, position: 0.75, fontScale: 1.0 },
        { id: 'neon_cyan', name: 'Electric Cyan Glow', category: 'neon', highlightColor: '#00F0FF', key: { font: 'Poppins', color: '#00F0FF', bold: true, glow: '#00F0FF' }, filler: { font: 'Poppins', color: '#FFFFFF' }, position: 0.75, fontScale: 1.0 },
        { id: 'special_03', name: 'Real Estate Clr', category: 'real-estate', highlightColor: '#2EE6A6', key: { font: 'Poppins', color: '#2EE6A6', bold: true }, filler: { font: 'Poppins', color: '#FFFFFF' }, position: 0.75, fontScale: 1.0 }
      ];
      renderFrontShowcasePresets('all');
      setupFrontCategoryPills();
      const initial = S.presets[0];
      if (!S.style) applyPreset(initial, false);
      renderPresetsTab('all');
    }

    // 1. Instant cache load: render immediately so screen is never blank
    try {
      const cached = JSON.parse(localStorage.getItem('cs_presets_cache') || 'null');
      if (Array.isArray(cached) && cached.length > 0) {
        S.presets = cached;
        renderFrontShowcasePresets('all');
        setupFrontCategoryPills();
        const initial = S.presets.find(p => p.isDuo) || S.presets[0];
        if (initial && !S.style) applyPreset(initial, false);
        renderPresetsTab('all');
      }
    } catch (_) {}

    // 2. Fetch authoritative presets from server
    try {
      const res = await fetch('/api/presets');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const serverPresets = data.presets || [];
      if (serverPresets.length > 0) {
        S.presets = serverPresets;
        try { localStorage.setItem('cs_presets_cache', JSON.stringify(serverPresets)); } catch (_) {}
      }

      // Merge user custom presets ONLY (never resurrect deleted default presets)
      try {
        const stored = JSON.parse(localStorage.getItem('cs_presets') || '[]');
        if (Array.isArray(stored) && stored.length > 0) {
          const haveNames = new Set(S.presets.map(p => p.name));
          stored.forEach(p => {
            if (p.isUserCustom && !haveNames.has(p.name)) {
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
      console.warn('Failed to load server presets, using fallback:', e);
      if (!S.presets || S.presets.length === 0) {
        // Fallback core presets if network failed on first load
        S.presets = [
          { id: 'yellow_box', name: 'Yellow Box Pop', category: 'box', highlightColor: '#FFE600', key: { font: 'Poppins', color: '#FFE600', bold: true }, filler: { font: 'Poppins', color: '#FFFFFF' }, position: 0.75, fontScale: 1.0, pill: '#FFE600' },
          { id: 'box_pop', name: 'Box Pop Classic', category: 'box', highlightColor: '#FFE600', key: { font: 'Poppins', color: '#FFE600', bold: true }, filler: { font: 'Poppins', color: '#FFFFFF' }, position: 0.75, fontScale: 1.0 },
          { id: 'duo_sunset', name: 'Duo Sunset Pop', isDuo: true, category: 'duo', highlightColor: '#FF6B00', key: { font: 'Poppins', color: '#FF6B00', bold: true }, filler: { font: 'Poppins', color: '#FFFFFF' }, position: 0.75, fontScale: 1.0 },
          { id: 'neon_cyan', name: 'Electric Cyan Glow', category: 'neon', highlightColor: '#00F0FF', key: { font: 'Poppins', color: '#00F0FF', bold: true, glow: '#00F0FF' }, filler: { font: 'Poppins', color: '#FFFFFF' }, position: 0.75, fontScale: 1.0 },
          { id: 'special_03', name: 'Real Estate Clr', category: 'real-estate', highlightColor: '#2EE6A6', key: { font: 'Poppins', color: '#2EE6A6', bold: true }, filler: { font: 'Poppins', color: '#FFFFFF' }, position: 0.75, fontScale: 1.0 }
        ];
      }
      const initial = S.presets[0];
      applyPreset(initial, false);
      renderFrontShowcasePresets('all');
      setupFrontCategoryPills();
      renderPresetsTab('all');
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
      viewUpload.classList.remove('active');
      viewEditor.classList.remove('hidden');
      viewEditor.classList.add('active');
      document.body.classList.add('editor-active');
      document.body.classList.remove('view-upload-active');
      const eb = $('editorBody') || $('.editor-body');
      if (eb && S.drawerOpen) {
        openDrawerTab(S.activeTab || 'tabTemplates');
      }
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          try { fitCanvas(); } catch (_) {}
          try { renderTimeline(); } catch (_) {}
          try { renderCaptionsList(); } catch (_) {}
          try { renderCanvas(true); } catch (_) {}
        });
      });
      const dragHint = $('captionDragHint');
      if (dragHint) dragHint.classList.toggle('hidden', !S.captions.length);

      // Auto-generate captions automatically when editor opens if not generated yet
      if ((!S.captions || S.captions.length === 0) && S.filename && !S.isTranscribing) {
        startTranscription();
      }
    } else {
      viewEditor.classList.add('hidden');
      viewEditor.classList.remove('active');
      viewUpload.classList.remove('hidden');
      viewUpload.classList.add('active');
      document.body.classList.remove('editor-active');
      document.body.classList.add('view-upload-active');
      vid.pause();
    }
  }

  btnNewVideo.addEventListener('click', () => {
    if (confirm('Start a new video project? Current unsaved edits will be cleared.')) {
      vid.pause();
      vid.src = '';
      if (typeof window !== 'undefined') { window._editorialHeadTopRatio = null; window._subjectMaskStats = null; }
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

  // ==========================================================================
  // INSTAGRAM & IN-APP BROWSER GUARD (CONTINUE TO CHROME)
  // ==========================================================================
  let inAppBrowserDismissed = false;

  function isInAppBrowser() {
    const ua = navigator.userAgent || navigator.vendor || window.opera || '';
    return /Instagram|FBAN|FBAV|Threads/i.test(ua);
  }

  function openExternalBrowser() {
    const href = window.location.href;
    const isAndroid = /Android/i.test(navigator.userAgent);
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (isAndroid) {
      const cleanUrl = href.replace(/^https?:\/\//, '');
      const chromeIntent = `intent://${cleanUrl}#Intent;scheme=https;package=com.android.chrome;end;`;
      window.location.href = chromeIntent;

      setTimeout(() => {
        const fallbackIntent = `intent://${cleanUrl}#Intent;scheme=https;action=android.intent.action.VIEW;end;`;
        window.location.href = fallbackIntent;
      }, 700);
      return;
    }

    if (isIOS) {
      try {
        navigator.clipboard.writeText(href);
        if (typeof showToast === 'function') showToast('📋 Link copied! Open Safari or Chrome to paste.');
      } catch (_) {}
      const iosInstructions = $('inappIosInstructions');
      if (iosInstructions) iosInstructions.style.display = 'block';
    }
  }

  function showInAppBrowserModal() {
    const modal = $('modalInAppBrowser');
    if (!modal) return;
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const iosBox = $('inappIosInstructions');
    if (iosBox) iosBox.style.display = isIOS ? 'block' : 'none';
    modal.classList.remove('hidden');
  }

  function hideInAppBrowserModal() {
    const modal = $('modalInAppBrowser');
    if (modal) modal.classList.add('hidden');
  }

  function initInAppBrowserHandler() {
    if (isInAppBrowser()) {
      const banner = $('inappBrowserBanner');
      if (banner) banner.classList.remove('hidden');
      document.body.classList.add('is-inapp-browser');

      const btnBanner = $('btnContinueToChromeBanner');
      if (btnBanner) {
        btnBanner.addEventListener('click', (e) => {
          e.stopPropagation();
          openExternalBrowser();
        });
      }

      const btnModalChrome = $('btnContinueToChromeModal');
      if (btnModalChrome) {
        btnModalChrome.addEventListener('click', (e) => {
          e.stopPropagation();
          openExternalBrowser();
        });
      }

      const btnCloseModal = $('btnCloseInAppModal');
      if (btnCloseModal) {
        btnCloseModal.addEventListener('click', (e) => {
          e.stopPropagation();
          inAppBrowserDismissed = true;
          hideInAppBrowserModal();
        });
      }

      const btnProceed = $('btnProceedInApp');
      if (btnProceed) {
        btnProceed.addEventListener('click', (e) => {
          e.stopPropagation();
          inAppBrowserDismissed = true;
          hideInAppBrowserModal();
          fileInput.click();
        });
      }
    }
  }

  function setupUploadHandlers() {
    btnSelectFile.addEventListener('click', (e) => {
      e.stopPropagation();
      if (dropZone.classList.contains('is-uploading')) return;
      if (isInAppBrowser() && !inAppBrowserDismissed) {
        showInAppBrowserModal();
        return;
      }
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
        if (isInAppBrowser() && !inAppBrowserDismissed) {
          showInAppBrowserModal();
          return;
        }
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
    if (typeof window !== 'undefined') { window._editorialHeadTopRatio = null; window._subjectMaskStats = null; }
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

  // Fast client-side audio extraction with guaranteed 16,000 Hz hardware resampling
  async function extractAudioForTranscription(file) {
    if (file.type && file.type.startsWith('audio/')) {
      return file;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!AudioCtx) throw new Error('AudioContext unavailable');

    const audioCtx = new AudioCtx();
    let decodedBuffer;
    try {
      const arrayBuffer = await file.arrayBuffer();
      decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    } finally {
      try { audioCtx.close(); } catch (_) {}
    }

    if (!decodedBuffer) throw new Error('Could not decode audio track');

    const targetRate = 16000;
    const duration = decodedBuffer.duration;
    if (!duration || duration <= 0) throw new Error('Invalid audio duration');

    // Native high-performance hardware resampling to 16,000 Hz mono
    if (OfflineCtx) {
      const totalTargetSamples = Math.max(1, Math.ceil(duration * targetRate));
      const offlineCtx = new OfflineCtx(1, totalTargetSamples, targetRate);
      const bufferSource = offlineCtx.createBufferSource();
      bufferSource.buffer = decodedBuffer;
      bufferSource.connect(offlineCtx.destination);
      bufferSource.start(0);

      const resampledBuffer = await offlineCtx.startRendering();
      return audioBufferToWav(resampledBuffer);
    }

    // High-accuracy linear interpolation fallback if OfflineAudioContext is unavailable
    return manualResampleToWav(decodedBuffer, targetRate);
  }

  function manualResampleToWav(buffer, targetRate) {
    const srcRate = buffer.sampleRate || 48000;
    const numSrcChannels = buffer.numberOfChannels;
    const srcLen = buffer.length;
    const srcMono = new Float32Array(srcLen);
    for (let c = 0; c < numSrcChannels; c++) {
      const ch = buffer.getChannelData(c);
      for (let i = 0; i < srcLen; i++) srcMono[i] += ch[i] / numSrcChannels;
    }
    const ratio = srcRate / targetRate;
    const targetLen = Math.round(srcLen / ratio);
    const resampled = new Float32Array(targetLen);
    for (let i = 0; i < targetLen; i++) {
      const srcIdx = i * ratio;
      const idxFloor = Math.floor(srcIdx);
      const frac = srcIdx - idxFloor;
      const s1 = srcMono[idxFloor] || 0;
      const s2 = srcMono[idxFloor + 1] || s1;
      resampled[i] = s1 + frac * (s2 - s1);
    }
    const wavBuffer = new ArrayBuffer(44 + targetLen * 2);
    const view = new DataView(wavBuffer);
    function writeWavString(v, off, str) {
      for (let j = 0; j < str.length; j++) v.setUint8(off + j, str.charCodeAt(j));
    }
    writeWavString(view, 0, 'RIFF');
    view.setUint32(4, 36 + targetLen * 2, true);
    writeWavString(view, 8, 'WAVE');
    writeWavString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, targetRate, true);
    view.setUint32(28, targetRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeWavString(view, 36, 'data');
    view.setUint32(40, targetLen * 2, true);
    let offset = 44;
    for (let i = 0; i < targetLen; i++) {
      const s = Math.max(-1, Math.min(1, resampled[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      offset += 2;
    }
    return new Blob([wavBuffer], { type: 'audio/wav' });
  }

  function audioBufferToWav(buffer) {
    const numChannels = 1;
    const sampleRate = buffer.sampleRate || 16000;
    const numSamples = buffer.length;
    const monoData = new Float32Array(numSamples);
    const numSrcChannels = buffer.numberOfChannels;

    for (let c = 0; c < numSrcChannels; c++) {
      const ch = buffer.getChannelData(c);
      for (let i = 0; i < numSamples; i++) {
        monoData[i] += ch[i] / numSrcChannels;
      }
    }

    const wavBuffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(wavBuffer);

    function writeWavString(v, off, str) {
      for (let i = 0; i < str.length; i++) {
        v.setUint8(off + i, str.charCodeAt(i));
      }
    }

    writeWavString(view, 0, 'RIFF');
    view.setUint32(4, 36 + numSamples * 2, true);
    writeWavString(view, 8, 'WAVE');
    writeWavString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeWavString(view, 36, 'data');
    view.setUint32(40, numSamples * 2, true);

    let offset = 44;
    for (let i = 0; i < numSamples; i++) {
      const s = Math.max(-1, Math.min(1, monoData[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      offset += 2;
    }

    return new Blob([wavBuffer], { type: 'audio/wav' });
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

    let fileToUpload = file;
    try {
      uploadStatusText.textContent = 'Extracting speech audio for fast upload...';
      const extractedWav = await extractAudioForTranscription(file);
      if (extractedWav && extractedWav.size > 1000) {
        fileToUpload = new File([extractedWav], (file.name || 'speech').replace(/\.[^.]+$/, '') + '.wav', { type: 'audio/wav' });
        console.log(`[FAST-IMPORT] Resampled 16kHz audio: ${(fileToUpload.size / (1024*1024)).toFixed(2)} MB vs original ${(file.size / (1024*1024)).toFixed(2)} MB`);
      }
    } catch (e) {
      console.warn('[FAST-IMPORT] Audio extraction fallback to direct file:', e);
      fileToUpload = file;
    }

    uploadStatusText.textContent = 'Uploading audio track...';
    const formData = new FormData();
    formData.append('video', fileToUpload);
    formData.append('file', fileToUpload);


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
            width: (vid && vid.videoWidth) || res.width || 1080,
            height: (vid && vid.videoHeight) || res.height || 1920,
            fps: res.fps || 30,
            duration: (vid && vid.duration) || res.duration || 0
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
    if (S.isTranscribing) return;
    S.isTranscribing = true;
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

      showToast('✨ Captions ready!');
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
    } finally {
      S.isTranscribing = false;
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
    vid.addEventListener('seeked', () => {
      syncBrollPlayback();
      if (vid.paused) {
        renderCanvas(true);
        syncTimelinePlayhead();
      }
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

    // Timeline Zoom controls (+ and -) - Bind both transport bar and header buttons
    const zoomInBtns = [$('btnTlZoomIn'), $('btnTlHeaderZoomIn')].filter(Boolean);
    const zoomOutBtns = [$('btnTlZoomOut'), $('btnTlHeaderZoomOut')].filter(Boolean);

    zoomInBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        pxPerSec = Math.min(160, pxPerSec + 25);
        renderTimeline();
        syncTimelinePlayhead();
        showToast(`🔍 Timeline Zoom: ${pxPerSec}px/s`);
      });
    });

    zoomOutBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        pxPerSec = Math.max(45, pxPerSec - 25);
        renderTimeline();
        syncTimelinePlayhead();
        showToast(`🔍 Timeline Zoom: ${pxPerSec}px/s`);
      });
    });

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
    const containerW = (timelineScrollContainer && timelineScrollContainer.clientWidth > 0)
      ? timelineScrollContainer.clientWidth
      : ((timelineTrackWrap && timelineTrackWrap.clientWidth > 0)
          ? timelineTrackWrap.clientWidth
          : (window.innerWidth || 360));
    const halfW = Math.round(containerW / 2);
    const trackWidth = Math.ceil(dur * pxPerSec);

    if (timelineRibbon) {
      timelineRibbon.style.paddingLeft = halfW + 'px';
      timelineRibbon.style.paddingRight = halfW + 'px';
      timelineRibbon.style.boxSizing = 'content-box';
      timelineRibbon.style.width = trackWidth + 'px';
      timelineRibbon.style.minWidth = trackWidth + 'px';
    }

    // Explicit end spacer guaranteed to extend scrollWidth so the last frame reaches center needle
    let endSpacer = $('timelineEndSpacer');
    if (!endSpacer && timelineRibbon) {
      endSpacer = document.createElement('div');
      endSpacer.id = 'timelineEndSpacer';
      endSpacer.style.cssText = 'position:absolute;top:0;height:1px;pointer-events:none;opacity:0;';
      timelineRibbon.appendChild(endSpacer);
    }
    if (endSpacer) {
      endSpacer.style.left = (trackWidth + halfW - 2) + 'px';
      endSpacer.style.width = '2px';
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
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetId = btn.getAttribute('data-tab');
        const isDesktop = window.innerWidth >= 900;
        const isVisiblyOpen = S.drawerOpen && !drawerPanel.classList.contains('collapsed') && !drawerPanel.hasAttribute('hidden');
        if (!isDesktop && isVisiblyOpen && S.activeTab === targetId) {
          closeDrawer();
        } else {
          openDrawerTab(targetId);
        }
      });
    });

    btnToggleTimeline.addEventListener('click', () => {
      toggleTimelineView();
    });

    if (btnDrawerClose) {
      const handleClose = (e) => {
        if (e) {
          e.stopPropagation();
          e.preventDefault();
        }
        closeDrawer();
      };
      btnDrawerClose.addEventListener('click', handleClose);
      btnDrawerClose.addEventListener('touchend', handleClose);
    }

    btnDrawerExpand.addEventListener('click', () => {
      toggleDrawerFullscreen();
    });

    btnGenerateTemplate.addEventListener('click', () => {
      triggerGenerateActiveTemplate();
    });

    $$('#categoryPills .cat-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        $$('#categoryPills .cat-pill').forEach(p => p.classList.toggle('active', p === pill));
        renderPresetsTab(pill.getAttribute('data-cat'), _activePresetSearch);
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
      const heightPx = `${Math.round(newHeight)}px`;
      editorBody.style.setProperty('--drawer-height', heightPx);
      editorBody.style.setProperty('--sheet-h', heightPx);
      drawerPanel.style.setProperty('--sheet-h', heightPx);
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
      const targetPx = `${targetH}px`;
      editorBody.style.setProperty('--drawer-height', targetPx);
      editorBody.style.setProperty('--sheet-h', targetPx);
      drawerPanel.style.setProperty('--sheet-h', targetPx);
      fitCanvas();
    });
  }

  function openDrawerTab(targetId, opts = {}) {
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
    const prevTab = S.activeTab;
    const iconChevron = $('iconDrawerChevron');
    if (iconChevron) iconChevron.style.transform = 'rotate(0deg)';
    S.activeTab = targetId;
    S.drawerOpen = true;
    const isInstant = Boolean(opts && opts.instant);
    drawerPanel.classList.toggle('drawer-instant', isInstant);
    drawerPanel.classList.remove('collapsed');
    drawerPanel.removeAttribute('hidden');
    const targetSheetH = S.drawerFullscreen ? 'var(--sheet-full)' : 'var(--sheet-half)';
    drawerPanel.style.setProperty('--sheet-h', targetSheetH);
    const eb = $('editorBody') || $('.editor-body');
    if (eb) {
      eb.classList.add('drawer-open');
      eb.style.setProperty('--sheet-h', targetSheetH);
    }

    $$('.bottom-nav-btn').forEach(btn => {
      const tabAttr = btn.getAttribute('data-tab');
      btn.classList.toggle('active', tabAttr === targetId);
    });

    $$('.tab-pane').forEach(p => {
      const isActive = (p.id === targetId);
      p.classList.toggle('active', isActive);
      p.classList.toggle('hidden', !isActive);
      if (!isActive) {
        p.setAttribute('hidden', '');
        p.style.setProperty('display', 'none', 'important');
      } else {
        p.removeAttribute('hidden');
        p.style.setProperty('display', 'flex', 'important');
      }
    });

    const dc = drawerPanel.querySelector('.drawer-content');
    if (dc && (prevTab !== targetId || isInstant)) {
      dc.scrollTop = 0;
    }

    const titles = {
      tabTemplates: '🎨 Templates',
      tabCaptions: '📝 Captions',
      tabBroll: '✨ Auto Edit & B-Roll',
      tabStyle: '🎚️ Customize Style',
      tabAudio: '🎵 Voice & Audio'
    };
    drawerTitle.textContent = titles[targetId] || 'Editor Options';

    if (targetId === 'tabCaptions') {
      renderCaptionsList();
      if (typeof syncTypographyUI === 'function') syncTypographyUI();
    } else if (targetId === 'tabBroll') {
      renderBrollTab();
    } else if (targetId === 'tabStyle') {
      if (typeof syncHeroLookUI === 'function') syncHeroLookUI();
      if (typeof syncTypographyUI === 'function') syncTypographyUI();
      const chkProgressLine = $('chkBottomProgressLine');
      if (chkProgressLine) {
        chkProgressLine.checked = Boolean(S.progressBar && S.progressBar.enabled === true);
      }
    }
    requestAnimationFrame(() => {
      fitCanvas();
      try { renderCanvas(true); } catch (_) {}
    });
  }

  function closeDrawer() {
    // On desktop side-by-side layout, inspector panel stays docked on the right
    if (window.innerWidth >= 900) return;
    const iconChevron = $('iconDrawerChevron');
    if (iconChevron) iconChevron.style.transform = 'rotate(180deg)';
    S.drawerOpen = false;
    S.drawerFullscreen = false;
    drawerPanel.classList.add('collapsed');
    drawerPanel.classList.remove('fullscreen', 'drawer-instant');
    drawerPanel.setAttribute('hidden', '');
    drawerPanel.style.setProperty('--sheet-h', '0dvh');
    const eb = $('editorBody') || $('.editor-body');
    if (eb) {
      eb.classList.remove('drawer-open');
      eb.classList.remove('sheet-fullscreen');
      eb.style.setProperty('--sheet-h', '0dvh');
    }
    $$('.bottom-nav-btn').forEach(b => b.classList.remove('active'));
    if (btnToggleTimeline) btnToggleTimeline.classList.add('active');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        fitCanvas();
        renderTimeline();
        syncTimelinePlayhead();
        try { renderCanvas(true); } catch (_) {}
      });
    });
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
    const eb = $('editorBody') || $('.editor-body');
    if (S.drawerFullscreen) {
      if (eb) {
        eb.classList.add('sheet-fullscreen');
        eb.style.setProperty('--sheet-h', 'var(--sheet-full)');
      }
      drawerPanel.style.setProperty('--sheet-h', 'var(--sheet-full)');
    } else {
      if (eb) {
        eb.classList.remove('sheet-fullscreen');
        eb.style.setProperty('--sheet-h', 'var(--sheet-half)');
      }
      drawerPanel.style.setProperty('--sheet-h', 'var(--sheet-half)');
    }
    const drawerModeIcon = $('drawerModeIcon');
    const drawerModeText = $('drawerModeText');
    if (drawerModeIcon) drawerModeIcon.textContent = S.drawerFullscreen ? '🗗' : '⛶';
    if (drawerModeText) drawerModeText.textContent = S.drawerFullscreen ? 'Half View' : 'Fullscreen';
    if (btnDrawerExpand) {
      btnDrawerExpand.title = S.drawerFullscreen ? 'Switch to Half screen preview' : 'Expand section to Fullscreen';
    }
    requestAnimationFrame(() => {
      fitCanvas();
      try { renderCanvas(true); } catch (_) {}
    });
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
  let _activePresetCat = 'all';
  let _activePresetSearch = '';
  let _presetRenderSeq = 0;

  function matchesPresetFilter(preset, filterCat, searchQuery) {
    if (!preset) return false;
    const cat = (preset.category || '').toLowerCase();
    const name = (preset.name || '').toLowerCase();
    const id = (preset.id || '').toLowerCase();
    const badge = (preset.badge || '').toLowerCase();
    const preview = (preset.previewWord || '').toLowerCase();

    if (filterCat && filterCat !== 'all') {
      let catMatch = true;
      if (filterCat === 'duo') catMatch = cat === 'duo' || name.startsWith('duo ·') || Boolean(preset.isDuo);
      else if (filterCat === 'viral') catMatch = cat.includes('viral') || name.includes('viral') || name.includes('pop') || id.includes('hype');
      else if (filterCat === 'neon') catMatch = cat.includes('neon') || name.includes('neon') || name.includes('ice') || name.includes('electric') || name.includes('glow');
      else if (filterCat === 'box') catMatch = name.includes('box') || cat.includes('box') || Boolean(preset.pill);
      else if (filterCat === 'real-estate') catMatch = cat.includes('real-estate') || id.includes('estate');
      else if (filterCat === 'colourful') catMatch = cat.includes('colourful') || cat.includes('color') || name.includes('fire') || name.includes('sunset') || name.includes('aurora');
      else if (filterCat === 'minimal') catMatch = cat.includes('minimal') || cat.includes('classic') || name.includes('clean') || name.includes('sub');
      else if (filterCat === 'special') catMatch = cat.includes('special') || id.includes('special') || Boolean(preset.isSpecial);
      if (!catMatch) return false;
    }

    const q = (searchQuery || '').toLowerCase().trim();
    if (!q) return true;
    const terms = q.split(/\s+/).filter(Boolean);
    const haystack = `${name} ${id} ${cat} ${badge} ${preview}`.trim();
    return terms.every(term => haystack.includes(term));
  }

  function renderPresetsTab(filterCat, searchQuery) {
    if (!presetsGrid) return;
    if (typeof filterCat === 'string' && filterCat.length > 0) {
      _activePresetCat = filterCat;
    }
    if (typeof searchQuery === 'string') {
      _activePresetSearch = searchQuery.toLowerCase().trim();
    } else {
      const searchEl = $('templateSearchInput');
      if (searchEl && typeof searchEl.value === 'string') {
        _activePresetSearch = searchEl.value.toLowerCase().trim();
      }
    }

    const seq = ++_presetRenderSeq;
    const scrollBody = $('.drawer-content') || presetsGrid.parentElement;
    if (scrollBody && presetsGrid._onLazyScroll) {
      scrollBody.removeEventListener('scroll', presetsGrid._onLazyScroll);
      presetsGrid._onLazyScroll = null;
    }

    presetsGrid.innerHTML = '';
    const filtered = (S.presets || []).filter(p => matchesPresetFilter(p, _activePresetCat, _activePresetSearch));

    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'presets-empty-state';
      const label = document.createElement('div');
      label.textContent = _activePresetSearch
        ? `No templates match "${_activePresetSearch}"`
        : 'No templates in this category.';
      const resetBtn = document.createElement('button');
      resetBtn.type = 'button';
      resetBtn.className = 'presets-empty-reset';
      resetBtn.textContent = 'Show All Templates';
      resetBtn.addEventListener('click', () => {
        const searchEl = $('templateSearchInput');
        if (searchEl) searchEl.value = '';
        _activePresetSearch = '';
        _activePresetCat = 'all';
        $$('#categoryPills .cat-pill').forEach(p => p.classList.toggle('active', p.getAttribute('data-cat') === 'all'));
        renderPresetsTab('all', '');
      });
      empty.appendChild(label);
      empty.appendChild(resetBtn);
      presetsGrid.appendChild(empty);
      return;
    }

    // When searching, show every match immediately; otherwise render first 16 and lazy-load the rest cleanly
    const initialCount = _activePresetSearch ? filtered.length : Math.min(16, filtered.length);
    const initialFrag = document.createDocumentFragment();
    for (let i = 0; i < initialCount; i++) {
      initialFrag.appendChild(createPresetCard(filtered[i], false, i));
    }
    presetsGrid.appendChild(initialFrag);

    if (scrollBody && (_activePresetSearch || filterCat)) {
      scrollBody.scrollTop = 0;
    }

    // Lazy-render remainder as user scrolls the sheet body
    if (filtered.length > initialCount) {
      let nextIdx = initialCount;
      const renderNextBatch = () => {
        if (seq !== _presetRenderSeq || nextIdx >= filtered.length) return;
        const chunk = Math.min(nextIdx + 24, filtered.length);
        const frag = document.createDocumentFragment();
        for (let i = nextIdx; i < chunk; i++) {
          frag.appendChild(createPresetCard(filtered[i], false, i));
        }
        presetsGrid.appendChild(frag);
        nextIdx = chunk;
      };

      const onScroll = () => {
        if (seq !== _presetRenderSeq) {
          if (scrollBody) scrollBody.removeEventListener('scroll', onScroll);
          return;
        }
        if (scrollBody && (scrollBody.scrollTop + scrollBody.clientHeight >= scrollBody.scrollHeight - 350)) {
          renderNextBatch();
          if (nextIdx >= filtered.length) {
            scrollBody.removeEventListener('scroll', onScroll);
            if (presetsGrid._onLazyScroll === onScroll) presetsGrid._onLazyScroll = null;
          }
        }
      };

      if (scrollBody) {
        presetsGrid._onLazyScroll = onScroll;
        scrollBody.addEventListener('scroll', onScroll, { passive: true });
      }
      if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(() => { if (seq === _presetRenderSeq && nextIdx < filtered.length) renderNextBatch(); });
      } else {
        setTimeout(() => { if (seq === _presetRenderSeq && nextIdx < filtered.length) renderNextBatch(); }, 150);
      }
    }
  }

  const _templateThumbnailCache = new Map();

  function getTemplateThumbnailUrl(preset) {
    if (_templateThumbnailCache.has(preset.id)) {
      return _templateThumbnailCache.get(preset.id);
    }
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 120;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // Dark surface background with subtle top sheen
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 120);
    bgGrad.addColorStop(0, '#1c1e30');
    bgGrad.addColorStop(1, '#0e101d');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 160, 120);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, 159, 119);

    const kRole = preset.key || preset.roles?.accent || {};
    const color = preset.highlightColor || kRole.color || '#FFE600';
    const font = kRole.font || 'Poppins';
    const isItalic = Boolean(kRole.italic);
    const weight = kRole.bold !== false ? '900' : '700';

    const isBehind = Boolean(
      preset.depthAccent ||
      preset.behindPerson ||
      (preset.roles && preset.roles.accent && preset.roles.accent.layer === 'behind') ||
      (preset.name && preset.name.toLowerCase().includes('(behind)'))
    );

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
    previewWord = previewWord.toUpperCase();

    const textFont = isBehind ? 'Anton, sans-serif' : `'${font}', sans-serif`;

    ctx.save();
    if (preset.isDuo) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '600 10px Poppins, sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('SOME MOMENTS', 80, 44);

      ctx.font = `${weight} 17px ${textFont}`;
      ctx.fillStyle = color;
      if (kRole.glow || preset.glow) {
        ctx.shadowColor = kRole.glow || color;
        ctx.shadowBlur = 8;
      }
      ctx.fillText(previewWord, 80, 68);
    } else {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const fontSize = isBehind ? 24 : 18;
      ctx.font = `${isItalic ? 'italic ' : ''}${weight} ${fontSize}px ${textFont}`;

      if (preset.pill) {
        ctx.font = `800 16px ${textFont}`;
        const m = ctx.measureText(previewWord);
        const pw = m.width + 16;
        const ph = 24;
        ctx.fillStyle = preset.pill.startsWith('linear') ? color : preset.pill;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(80 - pw / 2, 60 - ph / 2, pw, ph, 5);
        else ctx.rect(80 - pw / 2, 60 - ph / 2, pw, ph);
        ctx.fill();

        ctx.fillStyle = '#000000';
        ctx.fillText(previewWord, 80, 60);
      } else {
        if (kRole.glow || preset.glow) {
          ctx.shadowColor = kRole.glow || color;
          ctx.shadowBlur = 10;
        }
        ctx.fillStyle = color;
        ctx.fillText(previewWord, 80, isBehind ? 54 : 60);
      }
    }
    ctx.restore();

    if (isBehind) {
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 1.25;

      ctx.beginPath();
      ctx.arc(80, 78, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.ellipse(80, 118, 38, 24, 0, Math.PI, 0);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    let tag = preset.badge || '';
    if (!tag) {
      if (isBehind) tag = '👑 BEHIND';
      else if (preset.isDuo || preset.category === 'duo') tag = '⚡ DUO';
      else if (preset.category === 'real-estate') tag = '👑 ESTATE';
      else if (preset.name?.toLowerCase().includes('box') || preset.pill) tag = '📦 BOX';
      else if (preset.name?.toLowerCase().includes('neon') || preset.name?.toLowerCase().includes('glow')) tag = '✨ NEON';
      else if (preset.category === 'colourful') tag = '🌈 COLOR';
      else tag = (preset.category || 'POP').toUpperCase();
    }

    ctx.save();
    ctx.font = '800 8.5px Poppins, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const tagW = ctx.measureText(tag).width + 8;
    ctx.fillStyle = 'rgba(15, 17, 30, 0.75)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(6, 6, tagW, 14, 3);
    else ctx.rect(6, 6, tagW, 14);
    ctx.fill();
    ctx.strokeStyle = `${color}66`;
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.fillText(tag, 10, 13);
    ctx.restore();

    const dataUrl = canvas.toDataURL('image/webp', 0.85);
    _templateThumbnailCache.set(preset.id, dataUrl);
    return dataUrl;
  }

  function createPresetCard(preset, isModal, cardIndex = 0) {
    const card = document.createElement('div');
    card.className = 'preset-card' + (S.style && S.style.id === preset.id ? ' active' : '');
    card.setAttribute('data-id', preset.id);
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
      big.style.color = (kRole.color && (preset.porcelainRibbon || preset.holoAuraPill || preset.acidVoltTicker || preset.tornZine || preset.prismTileKinetic)) ? kRole.color : '#000';
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

    // Person silhouette in front of behind cards preview
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

    // Real estate dots
    if (preset.id === 'duo_03' || preset.id === 'special_03' || (preset.name && preset.name.toLowerCase().includes('real estate clr'))) {
      const dotsRow = document.createElement('div');
      dotsRow.className = 'preset-card-dots-row';
      REAL_ESTATE_CLR_PALETTE.forEach(c => {
        const dot = document.createElement('span');
        dot.className = 'mini-dot';
        dot.style.background = c.top;
        dotsRow.appendChild(dot);
      });
      art.appendChild(dotsRow);
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
      applyPreset(preset, false);
      $$('.preset-card').forEach(c => c.classList.toggle('active', c.getAttribute('data-id') === preset.id));
      if (isModal) modalTemplates.classList.add('hidden');
    });

    return card;
  }

  function syncBehindSliders() {
    // Behind person removed per user request
  }

  function applyPreset(preset, showGenToast = false) {
    const cardReColors = $('cardRealEstateColors');
    const isRePreset = (preset.id === 'duo_03' || preset.id === 'special_03' || (preset.name && preset.name.toLowerCase().includes('real estate clr')));
    if (cardReColors) cardReColors.classList.toggle('hidden', !isRePreset);
    pushHistoryState('Template: ' + (preset.name || 'Template'));
    const isBehind = Boolean(
      preset.behindPerson ||
      preset.depthAccent ||
      (preset.roles && preset.roles.accent && preset.roles.accent.layer === 'behind') ||
      (preset.name && preset.name.toLowerCase().includes('(behind)'))
    );
    // State cleanup: turn off video template modes if selecting a standard preset
    if (preset.videoTemplate !== 'popStudio' && S.popStudioConfig) {
      S.popStudioConfig.enabled = false;
      const togglePop = $('togglePopStudio');
      if (togglePop) togglePop.checked = false;
    }
    if (preset.videoTemplate !== 'specialRealEstate' && S.realEstateConfig) {
      S.realEstateConfig.enabled = false;
      const toggleRe = $('toggleSpecialRealEstate');
      if (toggleRe) toggleRe.checked = false;
    }

    const selVTemplate = $('selectVideoTemplate');
    if (selVTemplate) {
      selVTemplate.value = preset.videoTemplate || 'none';
    }

    const clonedRoles = preset.roles ? JSON.parse(JSON.stringify(preset.roles)) : undefined;
    const defaultPos = Number.isFinite(Number(preset.position)) ? Number(preset.position) : 0.75;
    const defaultFont = preset.roles?.accent?.font || preset.key?.font || preset.fontFamily || 'Poppins';
    const defaultHi = preset.highlightColor || preset.roles?.accent?.color || preset.key?.color || '#FFE600';
    const defaultBase = preset.baseColor || preset.roles?.base?.color || '#FFFFFF';
    S.style = Object.assign({}, preset, {
      roles: clonedRoles || preset.roles,
      fontScale: 1.0,
      position: defaultPos,
      posY: defaultPos,
      _defaultPosY: defaultPos,
      behindPerson: isBehind,
      depthAccent: Boolean(preset.depthAccent || isBehind),
      highlightColor: defaultHi,
      baseColor: defaultBase,
      fontFamily: defaultFont,
      textCase: S.textCase || preset.textCase || 'upper',
      heroLook: S.heroLook || S.style?.heroLook || 'solid',
      lineSpacing: 1.2,
      letterSpacing: 0,
      _customColorActive: false,
      _customBaseColorActive: false,
      _customGlowActive: false,
      _customFontActive: false
    });

    if (isBehind) {
      ensureSegmenterLoaded().catch(() => {});
    }
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

    if (typeof updatePositionUI === 'function') {
      updatePositionUI(S.style.posY || S.style.position || 0.67);
    }
    if (typeof updateFontScaleUI === 'function') {
      updateFontScaleUI();
    }
    if (chkWhiteSplash) {
      chkWhiteSplash.checked = (preset.whiteSplash !== false);
    }
    if (chkWhiteBloom) {
      chkWhiteBloom.checked = (preset.whiteBloom !== false);
    }
    if (cardDubaiEffects) {
      const isDubai = (preset.id === 'dubai_luxury_stack' || preset.dubaiLuxuryStack);
      cardDubaiEffects.style.display = isDubai ? 'block' : 'none';
    }
    if (valHighlightColor && S.style.highlightColor) {
      valHighlightColor.textContent = S.style.highlightColor;
      valHighlightColor.style.background = S.style.highlightColor;
      valHighlightColor.style.color = '#000';
    }
    if (inputCustomHighlight && S.style.highlightColor) {
      inputCustomHighlight.value = S.style.highlightColor.startsWith('#') && S.style.highlightColor.length === 7 ? S.style.highlightColor : '#FFC72C';
    }
    if (typeof $$ === 'function') {
      $$('#colorSwatches .swatch').forEach(sw => {
        const c = sw.getAttribute('data-color');
        sw.classList.toggle('active', c && c.toLowerCase() === (S.style.highlightColor || '').toLowerCase());
      });
      $$('#baseColorSwatches .swatch').forEach(sw => {
        const c = sw.getAttribute('data-color');
        sw.classList.toggle('active', c && c.toLowerCase() === (S.style.baseColor || '#FFFFFF').toLowerCase());
      });
    }
    const vBase = $('valBaseColor');
    if (vBase && S.style.baseColor) {
      vBase.textContent = S.style.baseColor;
      vBase.style.background = S.style.baseColor;
      vBase.style.color = (S.style.baseColor === '#FFFFFF' || S.style.baseColor.toLowerCase() === '#fffdd0' || S.style.baseColor.toLowerCase() === '#f8fafc') ? '#000' : '#fff';
    }
    const iBase = $('inputCustomBaseColor');
    if (iBase && S.style.baseColor && S.style.baseColor.startsWith('#') && S.style.baseColor.length === 7) {
      iBase.value = S.style.baseColor;
    }
    const vLs = $('valLineSpacing');
    if (vLs) vLs.textContent = '120%';
    const vLtr = $('valLetterSpacing');
    if (vLtr) vLtr.textContent = '0%';

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
      const isSel = S.selectedCaptionId === cap.id;
      row.className = 'caption-row' + (isCur ? ' active' : '') + (isSel ? ' selected' : '');
      row.setAttribute('data-id', cap.id);

      row.innerHTML = `<button type="button" class="caption-play-btn" title="Jump to timestamp">▶</button><div class="caption-center"><div class="caption-dur-controls"><button type="button" class="btn-time-step btn-step-minus" title="Decrease duration by 0.2s">-0.2s</button><span class="caption-time-pill">${formatTime(cap.start)} - ${formatTime(cap.end)} (${(cap.end - cap.start).toFixed(1)}s)</span><button type="button" class="btn-time-step btn-step-plus" title="Increase duration by 0.2s">+0.2s</button></div></div><button type="button" class="caption-delete-btn" title="Delete caption">&times;</button>`;

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

      // 1-Click Word Chips for instant 👑 Hero Highlight
      if (!Array.isArray(cap.words) || cap.words.length === 0 || cap.words.length !== (cap.text || '').trim().split(/\s+/).filter(Boolean).length) {
        updateCaptionWordTimings(cap);
        const textTokens = (cap.text || '').trim().split(/\s+/).filter(Boolean);
        const existingWords = Array.isArray(cap.words) ? cap.words : [];
        const dur = Math.max(0.1, cap.end - cap.start);
        const wDur = dur / Math.max(textTokens.length, 1);
        cap.words = textTokens.map((tw, idx) => ({
          t: tw,
          word: tw,
          s: Math.round((cap.start + idx * wDur) * 100) / 100,
          start: Math.round((cap.start + idx * wDur) * 100) / 100,
          e: Math.round((cap.start + (idx + 1) * wDur) * 100) / 100,
          end: Math.round((cap.start + (idx + 1) * wDur) * 100) / 100,
          key: existingWords[idx] ? Boolean(existingWords[idx].key) : false
        }));
      }
      if (Array.isArray(cap.words) && cap.words.length > 0) {
        const wordsRow = document.createElement('div');
        wordsRow.className = 'caption-words-chips-row';
        wordsRow.style.cssText = 'display:flex; flex-wrap:wrap; gap:4px; margin-top:6px;';
        cap.words.forEach((wo) => {
          const isHero = Boolean(wo.key);
          const chip = document.createElement('button');
          chip.type = 'button';
          chip.className = 'caption-word-chip' + (isHero ? ' is-key' : '');
          chip.title = 'Click to toggle 👑 Gold Hero Highlight on this word';
          chip.innerHTML = (isHero ? '👑 ' : '') + (wo.t || wo.word || '');
          chip.style.cssText = isHero
            ? 'font-size:11px; padding:2px 8px; border-radius:4px; background:linear-gradient(135deg,#FFC72C,#D99000); color:#000; font-weight:800; border:none; cursor:pointer; box-shadow:0 1px 4px rgba(0,0,0,0.3);'
            : 'font-size:11px; padding:2px 8px; border-radius:4px; background:rgba(255,255,255,0.08); color:#cbd5e1; border:1px solid rgba(255,255,255,0.12); cursor:pointer;';

          chip.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const wasKey = Boolean(wo.key);
            cap.words.forEach(w => { w.key = false; });
            wo.key = !wasKey;
            S.selectedCaptionId = cap.id;

            // In-place chip update: never freezes list or breaks touch scroll!
            wordsRow.querySelectorAll('.caption-word-chip').forEach((c, cIdx) => {
              const w = cap.words[cIdx];
              const isH = Boolean(w && w.key);
              c.className = 'caption-word-chip' + (isH ? ' is-key' : '');
              c.innerHTML = (isH ? '👑 ' : '') + (w ? (w.t || w.word || '') : '');
              c.style.cssText = isH
                ? 'font-size:11px; padding:2px 8px; border-radius:4px; background:linear-gradient(135deg,#FFC72C,#D99000); color:#000; font-weight:800; border:none; cursor:pointer; box-shadow:0 1px 4px rgba(0,0,0,0.3);'
                : 'font-size:11px; padding:2px 8px; border-radius:4px; background:rgba(255,255,255,0.08); color:#cbd5e1; border:1px solid rgba(255,255,255,0.12); cursor:pointer;';
            });

            const targetTime = (typeof wo.s === 'number')
              ? Math.min(cap.end - 0.02, Math.max(cap.start, wo.s + 0.02))
              : (cap.start + 0.05);
            try { vid.currentTime = Math.max(0, targetTime); } catch (_) {}

            renderCanvas(true);
            renderTimeline();
            syncTimelinePlayhead();
          });
          wordsRow.appendChild(chip);
        });
        captionCenter.appendChild(wordsRow);
      }

      row.addEventListener('click', (e) => {
        if (e.target.closest('button') || e.target.closest('textarea')) return;
        selectCaption(cap.id);
        vid.currentTime = cap.start + 0.05;
        renderCanvas();
        renderTimeline();
        renderCaptionsList();
      });

      captionInput.addEventListener('focus', () => {
        S.selectedCaptionId = cap.id;
        renderTimeline();
      });

      row.querySelector('.caption-play-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        selectCaption(cap.id);
        vid.currentTime = cap.start + 0.05;
        vid.play().catch(() => {});
        renderCanvas();
        renderTimeline();
        renderCaptionsList();
      });

      const textarea = captionInput;
      textarea.addEventListener('input', (e) => {
        const rawValue = e.target.value;
        const cleanValue = cleanCaptionText(rawValue);
        if (cleanValue !== rawValue) {
          const caret = Math.max(0, e.target.selectionStart - (rawValue.length - cleanValue.length));
          e.target.value = cleanValue;
          e.target.setSelectionRange(caret, caret);
        }
        cap.text = cleanValue;
        const rawTokens = rawValue.split(/\s+/).filter(Boolean);
        const words = cleanValue.split(/\s+/).filter(Boolean);
        const dur = (cap.end - cap.start) / Math.max(words.length, 1);
        cap.words = words.map((w, wIdx) => {
          const hasAsterisk = rawTokens[wIdx] ? rawTokens[wIdx].includes('*') : false;
          return {
            t: w,
            word: w,
            s: cap.start + wIdx * dur,
            start: cap.start + wIdx * dur,
            e: cap.start + (wIdx + 1) * dur,
            end: cap.start + (wIdx + 1) * dur,
            key: hasAsterisk
          };
        });
        renderCanvas();
        renderTimeline();
      });

      row.querySelector('.caption-delete-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        if (S.selectedCaptionId === cap.id) deselectCaption();
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
    // Quick section filter chips at top of Customize Style tab
    const styleGroupPills = $$('#styleSectionPills .cat-pill');
    if (styleGroupPills.length) {
      styleGroupPills.forEach(pill => {
        if (pill._groupBound) return;
        pill._groupBound = true;
        pill.addEventListener('click', () => {
          const group = pill.getAttribute('data-style-group') || 'all';
          styleGroupPills.forEach(p => p.classList.toggle('active', p === pill));
          $$('#tabStyle .style-options-grid > [data-style-group]').forEach(card => {
            const matches = (group === 'all') || (card.getAttribute('data-style-group') === group);
            card.classList.toggle('style-filter-hidden', !matches);
          });
          const sc = document.querySelector('#drawerPanel .drawer-content');
          if (sc) sc.scrollTop = 0;
        });
      });
    }

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
      $$('.btn-size-preset').forEach(b => {
        const s = parseFloat(b.getAttribute('data-scale')) || 1.0;
        b.classList.toggle('active', Math.abs(s - S.style.fontScale) < 0.05);
      });
    };
    if (inputFontSize) {
      inputFontSize.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10) || 100;
        if (!S.style) S.style = {};
        S.style.fontScale = Math.round(val) / 100;
        updateFontScaleUI();
        renderCanvas();
      });
    }

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
        S.style.lineSpacing = Math.max(0.8, Math.round(((S.style.lineSpacing || 1.2) - 0.10) * 100) / 100);
        updateLineSpacingUI();
        renderCanvas();
      });
    }
    if (btnStepLineSpacingUp) {
      btnStepLineSpacingUp.addEventListener('click', () => {
        if (!S.style) S.style = {};
        S.style.lineSpacing = Math.min(2.2, Math.round(((S.style.lineSpacing || 1.2) + 0.10) * 100) / 100);
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

    // Letter Spacing Stepper
    const valLetterSpacing = $('valLetterSpacing');
    const btnStepLetterSpacingDown = $('btnStepLetterSpacingDown');
    const btnStepLetterSpacingUp = $('btnStepLetterSpacingUp');
    const btnResetLetterSpacing = $('btnResetLetterSpacing');
    const updateLetterSpacingUI = () => {
      if (!S.style) S.style = {};
      const ls = typeof S.style.letterSpacing === 'number' ? S.style.letterSpacing : 0;
      if (valLetterSpacing) valLetterSpacing.textContent = `${ls >= 0 ? '+' : ''}${Math.round(ls * 100)}%`;
    };
    if (btnStepLetterSpacingDown) {
      btnStepLetterSpacingDown.addEventListener('click', () => {
        if (!S.style) S.style = {};
        S.style.letterSpacing = Math.max(-0.06, Math.round(((S.style.letterSpacing || 0) - 0.02) * 100) / 100);
        updateLetterSpacingUI();
        renderCanvas();
      });
    }
    if (btnStepLetterSpacingUp) {
      btnStepLetterSpacingUp.addEventListener('click', () => {
        if (!S.style) S.style = {};
        S.style.letterSpacing = Math.min(0.24, Math.round(((S.style.letterSpacing || 0) + 0.02) * 100) / 100);
        updateLetterSpacingUI();
        renderCanvas();
      });
    }
    if (btnResetLetterSpacing) {
      btnResetLetterSpacing.addEventListener('click', () => {
        if (!S.style) S.style = {};
        S.style.letterSpacing = 0;
        updateLetterSpacingUI();
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
        S.style._customGlowActive = true;
        S.style.glowEnabled = true;
        S.style.glowBlur = Math.max(4, (typeof S.style.glowBlur === 'number' ? S.style.glowBlur : 18) - 3);
        updateGlowBlurUI();
        renderCanvas();
      });
    }
    if (btnStepGlowUp) {
      btnStepGlowUp.addEventListener('click', () => {
        if (!S.style) S.style = {};
        S.style._customGlowActive = true;
        S.style.glowEnabled = true;
        S.style.glowBlur = Math.min(45, (typeof S.style.glowBlur === 'number' ? S.style.glowBlur : 18) + 3);
        updateGlowBlurUI();
        renderCanvas();
      });
    }
    if (btnResetGlow) {
      btnResetGlow.addEventListener('click', () => {
        if (!S.style) S.style = {};
        S.style._customGlowActive = false;
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

    const inputCustomPos = $('inputCustomPos');
    const valPosition = $('valPosition');
    const btnStepPosUp = $('btnStepPosUp');
    const btnStepPosDown = $('btnStepPosDown');
    const btnResetPos = $('btnResetPos');

    function updatePositionUI(posVal) {
      if (typeof posVal !== 'number' || isNaN(posVal)) posVal = 0.67;
      posVal = Math.max(0.15, Math.min(0.85, Math.round(posVal * 100) / 100));
      if (!S.style) S.style = {};
      S.style.position = posVal;
      S.style.posY = posVal;
      if (S.style.isDuo || S.style.isSpecial) {
        S.style.depthAccentY = Math.max(0.20, Math.min(0.82, posVal));
        S.style.subtitlePosition = Math.max(0.20, Math.min(0.90, posVal + 0.07));
      }
      const pct = Math.round(posVal * 100);
      let desc = `${pct}%`;
      if (pct <= 35) desc += ' (Top)';
      else if (pct <= 58) desc += ' (Center)';
      else desc += ' (Lower)';
      if (valPosition) valPosition.textContent = desc;
      if (inputCustomPos) inputCustomPos.value = String(pct);

      $$('#posButtonGroup .btn-toggle').forEach(b => {
        const bPos = parseFloat(b.getAttribute('data-pos'));
        b.classList.toggle('active', Math.abs(bPos - posVal) < 0.06);
      });
      renderCanvas();
    }
    window.updatePositionUI = updatePositionUI;

    if (inputCustomPos) {
      inputCustomPos.addEventListener('input', (e) => {
        updatePositionUI(parseFloat(e.target.value) / 100);
      });
    }
    if (btnStepPosUp) {
      btnStepPosUp.addEventListener('click', () => {
        const cur = (typeof S.style?.posY === 'number' ? S.style.posY : (typeof S.style?.position === 'number' ? S.style.position : 0.67));
        updatePositionUI(cur - 0.03);
      });
    }
    if (btnStepPosDown) {
      btnStepPosDown.addEventListener('click', () => {
        const cur = (typeof S.style?.posY === 'number' ? S.style.posY : (typeof S.style?.position === 'number' ? S.style.position : 0.67));
        updatePositionUI(cur + 0.03);
      });
    }
    if (btnResetPos) {
      btnResetPos.addEventListener('click', () => {
        updatePositionUI(0.67);
      });
    }

    $$('#posButtonGroup .btn-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        updatePositionUI(parseFloat(btn.getAttribute('data-pos')));
      });
    });

    const chkWhiteSplash = $('chkWhiteSplash');
    const chkWhiteBloom = $('chkWhiteBloom');
    const cardDubaiEffects = $('cardDubaiEffects');

    if (chkWhiteSplash) {
      chkWhiteSplash.addEventListener('change', (e) => {
        if (!S.style) S.style = {};
        S.style.whiteSplash = e.target.checked;
        renderCanvas();
      });
    }
    if (chkWhiteBloom) {
      chkWhiteBloom.addEventListener('change', (e) => {
        if (!S.style) S.style = {};
        S.style.whiteBloom = e.target.checked;
        renderCanvas();
      });
    }

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
      if (S.style.roles.accent2 && !S.style.dubaiLuxuryStack && S.style.id !== 'dubai_luxury_stack') {
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
      S.style._customBaseColorActive = true;
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

    // -------------------------------------------------------------------------
    // CAPTION TYPOGRAPHY & CASING SUITE
    // -------------------------------------------------------------------------
    function syncTypographyUI() {
      const curFont = S.style?.fontFamily || S.font || 'Poppins';
      const curCase = S.style?.textCase || S.textCase || 'upper';

      // 1. Sync Font Chips
      $$('.font-chip[data-font]').forEach(chip => {
        const f = chip.getAttribute('data-font') || '';
        chip.classList.toggle('active', f.toLowerCase() === curFont.toLowerCase());
      });

      // 2. Sync Font Dropdowns
      const selFont = $('selectFont');
      if (selFont) selFont.value = curFont;
      const quickSelFont = $('quickSelectFont');
      if (quickSelFont) quickSelFont.value = curFont;

      // 3. Sync Font Badge
      const valFontBadge = $('valFontBadge');
      if (valFontBadge) valFontBadge.textContent = curFont.toUpperCase();

      // 4. Sync Casing Button Groups
      $$('#caseButtonGroup .btn-toggle').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-case') === curCase);
      });
      $$('#quickCaseGroup .btn-mini').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-case') === curCase);
      });

      // 5. Sync Casing Badge
      const valCasingBadge = $('valCasingBadge');
      if (valCasingBadge) {
        const caseLabels = {
          'upper': 'ALL CAPS',
          'title': 'TITLE CASE',
          'lower': 'LOWERCASE',
          'asIs': 'ORIGINAL'
        };
        valCasingBadge.textContent = caseLabels[curCase] || curCase.toUpperCase();
      }

      // 6. Sync Caption Size Presets
      const curScale = S.style?.fontScale || 1.0;
      $$('.btn-size-preset').forEach(b => {
        const s = parseFloat(b.getAttribute('data-scale')) || 1.0;
        b.classList.toggle('active', Math.abs(s - curScale) < 0.05);
      });
    }
    window.syncTypographyUI = syncTypographyUI;

    function setCaptionFont(font) {
      if (!font) return;
      if (!S.style) S.style = {};
      S.style.fontFamily = font;
      S.style._customFontActive = true;
      S.font = font;
      if (!S.style.key) S.style.key = {};
      S.style.key.font = font;
      if (!S.style.roles) S.style.roles = {};
      if (S.style.roles.accent) S.style.roles.accent.font = font;
      if (S.style.roles.base) S.style.roles.base.font = font;
      if (typeof _heroSpriteCache !== 'undefined' && _heroSpriteCache.clear) {
        _heroSpriteCache.clear();
      }
      syncTypographyUI();
      showToast(`🔤 Font: ${font}`);
      renderCanvas(true);
    }
    window.setCaptionFont = setCaptionFont;

    function setCaptionCase(casing) {
      if (!casing) return;
      if (!S.style) S.style = {};
      S.style.textCase = casing;
      S.textCase = casing;
      if (typeof _heroSpriteCache !== 'undefined' && _heroSpriteCache.clear) {
        _heroSpriteCache.clear();
      }
      syncTypographyUI();
      const caseLabels = { upper: 'ALL CAPS', title: 'Title Case', lower: 'lowercase', asIs: 'Original' };
      showToast(`🔠 Casing: ${caseLabels[casing] || casing}`);
      renderCanvas(true);
    }
    window.setCaptionCase = setCaptionCase;

    // Visual Font Chips (click & touch)
    $$('.font-chip[data-font]').forEach(chip => {
      const handler = (e) => {
        e.preventDefault();
        const f = chip.getAttribute('data-font');
        setCaptionFont(f);
      };
      chip.addEventListener('click', handler);
      chip.addEventListener('pointerup', handler);
    });

    // Font Dropdown in Customize
    const selectFontEl = $('selectFont');
    if (selectFontEl) {
      selectFontEl.addEventListener('change', (e) => {
        setCaptionFont(e.target.value);
      });
    }

    // Quick Font Dropdown in Transcript tab
    const quickSelectFontEl = $('quickSelectFont');
    if (quickSelectFontEl) {
      quickSelectFontEl.addEventListener('change', (e) => {
        setCaptionFont(e.target.value);
      });
    }

    // Casing buttons in Customize tab
    $$('#caseButtonGroup .btn-toggle').forEach(btn => {
      const handler = (e) => {
        e.preventDefault();
        const c = btn.getAttribute('data-case');
        setCaptionCase(c);
      };
      btn.addEventListener('click', handler);
      btn.addEventListener('pointerup', handler);
    });

    // Quick Casing buttons in Transcript tab
    $$('#quickCaseGroup .btn-mini').forEach(btn => {
      const handler = (e) => {
        e.preventDefault();
        const c = btn.getAttribute('data-case');
        setCaptionCase(c);
      };
      btn.addEventListener('click', handler);
      btn.addEventListener('pointerup', handler);
    });

    // Button to jump from Transcript quick bar to full Customize typography
    const btnQuickOpenCust = $('btnQuickOpenCustomize');
    if (btnQuickOpenCust) {
      btnQuickOpenCust.addEventListener('click', () => {
        openDrawerTab('tabStyle');
        const cardFont = $('cardFontFamily');
        if (cardFont) {
          setTimeout(() => cardFont.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
        }
      });
    }

    // Caption Size Quick Presets (80% S, 100% M, 120% L, 140% XL)
    $$('.btn-size-preset').forEach(btn => {
      const handler = (e) => {
        e.preventDefault();
        const scale = parseFloat(btn.getAttribute('data-scale')) || 1.0;
        if (!S.style) S.style = {};
        S.style.fontScale = scale;
        updateFontScaleUI();
        syncTypographyUI();
        showToast(`📏 Caption Size: ${Math.round(scale * 100)}%`);
        renderCanvas(true);
      };
      btn.addEventListener('click', handler);
      btn.addEventListener('pointerup', handler);
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
      S.style._customGlowActive = true;
      S.style.glowEnabled = true;
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
        S.style._customGlowActive = true;
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
        S.style._customGlowActive = true;
        S.style.glowEnabled = true;
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
      btnStageSettings.addEventListener('pointerdown', (e) => { e.stopPropagation(); });
      btnStageSettings.addEventListener('click', (e) => {
        e.stopPropagation();
        openDrawerTab('tabStyle', { instant: true });
        const dc = document.querySelector('#drawerPanel .drawer-content');
        if (dc) dc.scrollTop = 0;
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
        if (!S.progressBar) S.progressBar = { enabled: false, position: 'bottom' };
        S.progressBar.position = btn.getAttribute('data-pos') || 'bottom';
        syncReelProgressBar();
      });
    });

    // Quick Bottom Progress Line switch
    const chkProgressLine = $('chkBottomProgressLine');
    if (chkProgressLine) {
      chkProgressLine.checked = Boolean(S.progressBar && S.progressBar.enabled === true);
      chkProgressLine.addEventListener('change', () => {
        if (!S.progressBar) S.progressBar = { enabled: false, position: 'bottom' };
        S.progressBar.enabled = chkProgressLine.checked;
        syncReelProgressBar();
        const badge = $('valProgressBarBadge');
        if (badge) {
          badge.textContent = S.progressBar.enabled ? 'Active' : 'Hidden';
          badge.className = S.progressBar.enabled ? 'val-badge badge-green' : 'val-badge';
        }
        $$('#progressBarToggleGroup .btn-toggle').forEach(b => {
          b.classList.toggle('active', (b.getAttribute('data-progress') === 'on') === S.progressBar.enabled);
        });
        showToast('Bottom Progress Line: ' + (S.progressBar.enabled ? 'ON' : 'OFF'));
      });
    }

    try { initHeroLookUI(); } catch (_) {}
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
    fitCanvas();
    if (document.fonts && typeof document.fonts.ready?.then === 'function') {
      document.fonts.ready.then(() => {
        renderCanvas(true);
      }).catch(() => {});
    }
    window.addEventListener('resize', () => {
      fitCanvas();
      if (timelineScrollContainer && timelineRibbon) {
        const halfW = timelineScrollContainer.clientWidth / 2;
        timelineRibbon.style.paddingLeft = halfW + 'px';
        timelineRibbon.style.paddingRight = halfW + 'px';
      }
    });
    document.addEventListener('fullscreenchange', fitCanvas);
    window.addEventListener('orientationchange', () => setTimeout(fitCanvas, 150));
    if (drawerPanel) drawerPanel.addEventListener('transitionend', fitCanvas);
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
      if (!S.captions.length || !S.style || event.target.closest('button') || event.target.closest('#captionBoundingBox')) return;
      if (!event.isPrimary) { drag = null; return; }
      const rect = stage.getBoundingClientRect();
      if (!rect.height || !rect.width) return;

      const curT = vid ? (vid.currentTime || 0) : 0;
      const activeCap = S.captions.find(c => curT >= c.start && curT <= c.end) || null;
      drag = {
        id: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        rectW: rect.width,
        rectH: rect.height,
        activeCap,
        origDx: activeCap ? (Number(activeCap.dx) || 0) : 0,
        origDy: activeCap ? (Number(activeCap.dy) || 0) : 0,
        origPos: Number(S.style.position || S.style.posY || 0.75),
        moved: false
      };
    });

    stage.addEventListener('pointermove', (event) => {
      if (!drag || drag.id !== event.pointerId) return;
      const dX = event.clientX - drag.startX;
      const dY = event.clientY - drag.startY;
      if (!drag.moved && Math.hypot(dX, dY) < 5) return;
      if (!drag.moved) {
        try { stage.setPointerCapture(event.pointerId); } catch (e) {}
        if (drag.activeCap && S.selectedCaptionId !== drag.activeCap.id) {
          S.selectedCaptionId = drag.activeCap.id;
          S.editMode = 'whole';
          S.selectedWordIndex = -1;
        }
      }
      drag.moved = true;
      event.preventDefault();
      stage.classList.add('is-caption-dragging');

      if (drag.activeCap && typeof applyCaptionTransform === 'function') {
        const snap = snapAndClampDelta(drag.origDx + dX / drag.rectW, drag.origDy + dY / drag.rectH);
        applyCaptionTransform(drag.activeCap, (c) => {
          c.dx = snap.dx;
          c.dy = snap.dy;
        });
        updateSnapGuidesDOM(snap.snapV, snap.snapH);
        updateTransformHud(`${Math.round(snap.dx * 100)}%, ${Math.round(snap.dy * 100)}%`, true);
        if (hint) hint.textContent = '✥ Dragging caption · snap to center';
        renderCanvas();
        updateVideoEditOverlay();
      } else {
        const nextPos = Math.max(0.08, Math.min(0.92, drag.origPos + dY / drag.rectH));
        S.style.position = nextPos;
        S.style.posY = nextPos;
        if (hint) hint.textContent = '↕ Caption Position: ' + Math.round(nextPos * 100) + '%';
        renderCanvas();
      }
    });

    const finish = (event) => {
      if (!drag || drag.id !== event.pointerId) return;
      const d = drag;
      drag = null;
      stage.classList.remove('is-caption-dragging');
      if (typeof updateSnapGuidesDOM === 'function') updateSnapGuidesDOM(false, false);
      if (typeof updateTransformHud === 'function') updateTransformHud('', false);
      if (hint) hint.textContent = '💡 Tap or drag caption to move · pinch corners to resize';
      if (d.moved) {
        if (d.activeCap) pushHistoryState('Move caption on screen');
        renderCanvas();
        if (d.activeCap && typeof updateVideoEditOverlay === 'function') updateVideoEditOverlay();
      }
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

  let _captionsDrawnCount = 0;
  let _captionsDrawnInLastSec = 0;

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
      _captionsDrawnInLastSec = _captionsDrawnCount;
      _captionsDrawnCount = 0;
    }

    const cw = captionCanvas ? captionCanvas.width : 0;
    const ch = captionCanvas ? captionCanvas.height : 0;
    const curLook = S.heroLook || 'solid';
    const fontStr = `P800:${_fontsLoadStatus.poppins} | Ital:${_fontsLoadStatus.poppinsItalic} | Semi:${_fontsLoadStatus.poppinsSemi} | Ant:${_fontsLoadStatus.anton}`;

    badge.innerHTML = `<div style="font-weight:bold;margin-bottom:2px;">Debug: ${cw}x${ch} (${effQuality}) | Hero: ${curLook}</div>` +
                      `<div style="font-size:10px;color:#93c5fd;">Fonts: ${fontStr}</div>` +
                      `<div style="font-size:10px;color:#86efac;">Captions: ${_captionsDrawnInLastSec}/s | Draw: ${drawDurationMs.toFixed(1)}ms</div>`;
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
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const effQuality = getEffectivePreviewQuality();
    const cfg = PREVIEW_QUALITY_CONFIG[effQuality] || PREVIEW_QUALITY_CONFIG.balanced;
    const dpr = Math.min(cfg.maxDpr, window.devicePixelRatio || 1);

    if (rect.width <= 0 || rect.height <= 0) {
      requestAnimationFrame(fitCanvas);
    }
    const w = rect.width > 0 ? rect.width : (stage.clientWidth || 360);
    const h = rect.height > 0 ? rect.height : (stage.clientHeight || 640);

    const cw = Math.max(2, Math.round(w * dpr));
    const ch = Math.max(2, Math.round(h * dpr));

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
      try {
        renderCanvas(true);
      } catch (previewErr) {
        console.error('[PREVIEW] Frame render error:', previewErr);
      } finally {
        // Throttle timeline/playhead UI updates to at most 4 times per second (>= 250ms)
        if (now - lastUiUpdateTime >= 250) {
          lastUiUpdateTime = now;
          try {
            syncTimelinePlayhead();
          } catch (uiErr) {
            console.error('[PREVIEW] syncTimelinePlayhead error:', uiErr);
          }
        }
        schedulePreviewFrame();
      }
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
      index: 1,
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
    drawCanvasTypography(ctx, null, sampleCap, sampleCap.words, 0, st || {}, W, H, isBehind, true, false);
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
      try { if (typeof renderCanvas === 'function') renderCanvas(true); } catch (_) {}
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
  const cdnModelPath = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite';

  async function tryInitSegmenter(path, delegate) {
    return await ImageSegmenter.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: path,
        delegate: delegate
      },
      runningMode: 'VIDEO',
      outputConfidenceMasks: true,
      outputCategoryMask: false
    });
  }

  try {
    return await tryInitSegmenter(modelPath, 'GPU');
  } catch (e1) {
    try {
      return await tryInitSegmenter(modelPath, 'CPU');
    } catch (e2) {
      try {
        return await tryInitSegmenter(cdnModelPath, 'GPU');
      } catch (e3) {
        return await tryInitSegmenter(cdnModelPath, 'CPU');
      }
    }
  }
}

// Shared helper to detect top of speaker's head & subject coverage from segmentation mask floats
function updateEditorialHeadTopRatio(floats, mW, mH) {
  if (!floats || !mW || !mH || typeof window === 'undefined') return;
  const xMin = Math.floor(mW * 0.15);
  const xMax = Math.ceil(mW * 0.85);
  let detectedRatio = null;
  for (let y = 0; y < mH; y++) {
    let hits = 0;
    const rowOff = y * mW;
    for (let x = xMin; x < xMax; x++) {
      if (floats[rowOff + x] > 0.55) {
        hits++;
        if (hits >= 4) {
          detectedRatio = y / mH;
          break;
        }
      }
    }
    if (detectedRatio !== null) break;
  }
  if (detectedRatio !== null) {
    window._editorialHeadTopRatio = (typeof window._editorialHeadTopRatio === 'number')
      ? (window._editorialHeadTopRatio * 0.70 + detectedRatio * 0.30)
      : detectedRatio;
  }

  // Copy a compact 48x64 mask grid so live preview & export share frame-safe anti-occlusion stats
  const gW = 48;
  const gH = 64;
  const grid = new Float32Array(gW * gH);
  let centerFg = 0;
  let centerTotal = 0;
  for (let gy = 0; gy < gH; gy++) {
    const sy = Math.min(mH - 1, Math.floor(((gy + 0.5) / gH) * mH));
    const sOff = sy * mW;
    const dOff = gy * gW;
    const inCenterY = gy >= Math.floor(gH * 0.15) && gy <= Math.ceil(gH * 0.65);
    for (let gx = 0; gx < gW; gx++) {
      const sx = Math.min(mW - 1, Math.floor(((gx + 0.5) / gW) * mW));
      const v = floats[sOff + sx] || 0;
      grid[dOff + gx] = v;
      if (inCenterY && gx >= Math.floor(gW * 0.22) && gx <= Math.ceil(gW * 0.78)) {
        if (v > 0.5) centerFg++;
        centerTotal++;
      }
    }
  }
  window._subjectMaskStats = {
    floats: grid,
    w: gW,
    h: gH,
    headTopRatio: (typeof window._editorialHeadTopRatio === 'number') ? window._editorialHeadTopRatio : 0.28,
    centerCoverage: centerTotal > 0 ? (centerFg / centerTotal) : 0
  };
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

  try {
    liveDownscaleCtx.drawImage(sourceCanvasOrFrame, 0, 0, downW, downH);
  } catch (_) {
    return null;
  }

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

        updateEditorialHeadTopRatio(prevLiveMaskFloats, mW, mH);
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

  const downScale = Math.min(1, 160 / Math.max(srcW, srcH));
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

        updateEditorialHeadTopRatio(exportPrevMaskFloats, mW, mH);
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
        exportSegFinalCtx.imageSmoothingEnabled = true;
        exportSegFinalCtx.imageSmoothingQuality = 'medium';
        exportSegFinalCtx.drawImage(exportSegMaskRawCanvas, 0, 0, outW, outH);

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
    let dpr = 1;
    let w = 360;
    let h = 640;
    let t = 0;
    let activeCap = null;
    let words = [];
    let isBehind = false;
    let isShowAll = false;
    try {
      const effQuality = isPreview ? getEffectivePreviewQuality() : 'full';
      const cfg = PREVIEW_QUALITY_CONFIG[effQuality] || PREVIEW_QUALITY_CONFIG.balanced;
      dpr = isPreview ? Math.min(cfg.maxDpr, window.devicePixelRatio || 1) : 1;

      w = (captionCanvas && captionCanvas.width > 0) ? (captionCanvas.width / dpr) : 360;
      h = (captionCanvas && captionCanvas.height > 0) ? (captionCanvas.height / dpr) : 640;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, captionCanvas.width, captionCanvas.height);
      ctx.scale(dpr, dpr);

      if (behindCanvas) {
        const isEditorialBlend = Boolean(S.style && S.style.id === 'editorial_depth_stack');
        behindCanvas.style.mixBlendMode = isEditorialBlend ? 'multiply' : '';
        behindCanvas.style.opacity = isEditorialBlend ? '0.92' : '';
      }
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

      t = (vid && typeof vid.currentTime === 'number') ? vid.currentTime : 0;
      activeCap = S.captions.find(c => t >= c.start && t <= c.end);
      if (!activeCap && vid.paused && S.selectedCaptionId) {
        activeCap = S.captions.find(c => c.id === S.selectedCaptionId) || null;
      }

      // Requirement 6: Do less work when nothing changes / no active caption
      if (!activeCap) {
        if (S.captions.length > 0) {
          // If paused OR within first 1.2s of playback, show the first/closest caption
          if (vid.paused || t <= 1.2) {
            activeCap = S.captions.find(c => t <= c.end) || S.captions[0];
          } else {
            // Keep recent caption on screen during brief speech pauses (< 0.8s) so captions do not flash off
            const recentCap = S.captions.find(c => t >= c.end && (t - c.end) <= 0.8);
            if (recentCap) {
              activeCap = recentCap;
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

      words = (activeCap.words || []).map(w => ({
        t: w.t || w.word || '',
        s: typeof w.s === 'number' ? w.s : (typeof w.start === 'number' ? w.start : 0),
        e: typeof w.e === 'number' ? w.e : (typeof w.end === 'number' ? w.end : 0),
        key: Boolean(w.key)
      }));

      // Fallback: if activeCap text exists but words array is empty, construct words from text
      if (!words.length && activeCap.text) {
        const parts = activeCap.text.trim().split(/\s+/).filter(Boolean);
        const segDur = Math.max(0.5, (activeCap.end || 1) - (activeCap.start || 0));
        const step = segDur / Math.max(1, parts.length);
        words = parts.map((pt, pIdx) => ({
          t: pt,
          s: (activeCap.start || 0) + pIdx * step,
          e: (activeCap.start || 0) + (pIdx + 1) * step,
          key: pIdx === 0
        }));
      }

      // Check for Pop Studio Scene-Based Video Template
      const isPopStudio = Boolean(
        (S.style && S.style.videoTemplate === 'popStudio') ||
        (S.popStudioConfig && S.popStudioConfig.enabled)
      );

      if (isPopStudio) {
        if (vid && vid.style.opacity !== '1') vid.style.opacity = '1';
        drawPopStudioFrame(ctx, behindCtx || ctx, t, w, h, isPreview, null);
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

      const isShowAll = Boolean(vid.paused || !vid.duration);
      // Requirement 8: Stacked canvases - hero text (behindCanvas) -> personCutout (personCanvas) -> front text (captionCanvas)
      if (isBehind && activeCap && segmenterInstance && vid.readyState >= 2) {
        // Compute segmentation mask before typography so dynamic head-crown tracking applies on frame 0
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

        // Draw typography: front lines to ctx, behind words to behindCtx
        drawCanvasTypography(ctx, behindCtx || ctx, activeCap, words, t, S.style || {}, w, h, true, isShowAll, isPreview);

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
          if (vid && vid.readyState >= 2) {
            try {
              personCtx.save();
              personCtx.drawImage(vid, 0, 0, w, h);
              personCtx.globalCompositeOperation = 'destination-in';
              personCtx.drawImage(lastLiveMaskCanvas, 0, 0, w, h);
              personCtx.restore();
            } catch (cutoutErr) {
              try { personCtx.restore(); } catch (_) {}
            }
          }
        }

        drawAutoEmojis(ctx, activeCap, words, t, S.style || {}, w, h);
      } else {
        if (isBehind && activeCap && !segmenterInstance && !segmenterLoadingPromise && !segmenterLoadFailed) {
          ensureSegmenterLoaded().catch(() => {});
        }
        drawCanvasTypography(ctx, null, activeCap, words, t, S.style || {}, w, h, isBehind, isShowAll, isPreview);
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
      // Requirement 10: Safety fallback - CLEAR DIRTY CANVASES FIRST TO PREVENT DOUBLE CAPTION OVERLAYS
      console.warn('[PREVIEW RENDER FALLBACK]', renderErr);
      try {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, captionCanvas.width, captionCanvas.height);
        ctx.scale(dpr, dpr);
        if (behindCtx) {
          behindCtx.setTransform(1, 0, 0, 1, 0, 0);
          behindCtx.clearRect(0, 0, behindCanvas.width, behindCanvas.height);
        }
        if (personCtx) {
          personCtx.setTransform(1, 0, 0, 1, 0, 0);
          personCtx.clearRect(0, 0, personCanvas.width, personCanvas.height);
        }
        if (activeCap) {
          drawCanvasTypography(ctx, null, activeCap, words, t, S.style || {}, w, h, false, true, isPreview);
        } else if (S.captions && S.captions.length > 0) {
          const fallbackCap = S.captions[0];
          const fallbackWords = (fallbackCap.words && fallbackCap.words.length) ? fallbackCap.words : (fallbackCap.text || '').split(' ').map(tx => ({ t: tx, s: 0, e: 1 }));
          drawSafePlainCaptions(ctx, fallbackCap, fallbackWords, w, h);
        }
      } catch (errInner) {
        try {
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, captionCanvas.width, captionCanvas.height);
          ctx.scale(dpr, dpr);
          const capToDraw = activeCap || (S.captions && S.captions[0]) || { text: 'Preview Caption' };
          const wordsToDraw = (words && words.length) ? words : [{ t: capToDraw.text || 'Preview' }];
          drawSafePlainCaptions(ctx, capToDraw, wordsToDraw, w, h);
        } catch (_) {}
      }
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
    if (!S.progressBar || S.progressBar.enabled !== true) {
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

    const modalSearch = $('modalTemplateSearchInput');
    if (modalSearch) {
      modalSearch.addEventListener('input', (e) => {
        renderFullTemplatesGrid(e.target.value.toLowerCase().trim());
      });
    }

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

  function restoreEditorAfterExport() {
    try {
      if (typeof vid !== 'undefined' && vid) {
        vid.style.opacity = '1';
      }
      if (captionCanvas) {
        const cCtx = captionCanvas.getContext('2d');
        if (cCtx) cCtx.clearRect(0, 0, captionCanvas.width, captionCanvas.height);
      }
      if (behindCanvas) {
        const bCtx = behindCanvas.getContext('2d');
        if (bCtx) bCtx.clearRect(0, 0, behindCanvas.width, behindCanvas.height);
      }
      if (personCanvas) {
        const pCtx = personCanvas.getContext('2d');
        if (pCtx) pCtx.clearRect(0, 0, personCanvas.width, personCanvas.height);
      }
      renderCanvas(true);
      syncTimelinePlayhead();
    } catch (_) {}
  }

    btnCloseExportModal.addEventListener('click', () => {
      modalExport.classList.add('hidden');
      if (activeDirectExport) {
        try { activeDirectExport.stop(); } catch (_) {}
        activeDirectExport = null;
      }
      if (S.exportTimer) clearInterval(S.exportTimer);
      if (exportElapsedInterval) clearInterval(exportElapsedInterval);
      stopTitleFlash();
      restoreEditorAfterExport();
    });

    btnRetryExport.addEventListener('click', () => startExport(true));

    const btnCancelExportAction = $('btnCancelExportAction');
    if (btnCancelExportAction) {
      btnCancelExportAction.addEventListener('click', () => {
        if (btnCloseExportModal) btnCloseExportModal.click();
      });
    }
  
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
  initVideoTemplatesCompactUI();
  initHeroLookUI();
  ensureHeroFontsLoaded();
  setupQualityPills();
  setupExportQualityModal();
  setupPreviewPerfModeToggle();
  }

  function updateQualityPillsUI() {
    const curQ = S.exportQuality || 'high';
    $$('.btn-quality-pill').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-quality') === curQ);
    });

    const stepFinalizeTitle = $('stepFinalizeTitle');
    if (stepFinalizeTitle) {
      if (curQ === 'fast' || curQ === '480p') stepFinalizeTitle.textContent = '480p MP4';
      else if (curQ === 'high' || curQ === '1080p') stepFinalizeTitle.textContent = '1080p Full HD MP4';
      else stepFinalizeTitle.textContent = '720p HD MP4';
    }
  }

  function setExportQuality(q) {
    if (!q) return;
    const isSame = (q === S.exportQuality);
    S.exportQuality = q;
    try { localStorage.setItem('captionstudio_export_quality', q); } catch (_) {}
    updateQualityPillsUI();

    const qLabel = (q === 'fast' || q === '480p') ? 'Standard (480p)' : ((q === 'high' || q === '1080p') ? 'Full HD (1080p)' : 'HD Ready (720p)');
    showToast('⚡ Quality: ' + qLabel, 1500);

    const modalExp = $('modalExport');
    const isModalOpen = modalExp && !modalExp.classList.contains('hidden');
    const isWorking = exportWorkingState && !exportWorkingState.classList.contains('hidden');

    if (isModalOpen && isWorking && !isSame) {
      S._restartingExport = true;
      S.exportAbortSignal = true;
      if (activeDirectExport) {
        try { activeDirectExport.stop(); } catch (_) {}
        activeDirectExport = null;
      }
      if (S.exportTimer) clearInterval(S.exportTimer);
      if (exportElapsedInterval) clearInterval(exportElapsedInterval);
      exportProgressBar.style.width = '3%';
      exportPercent.textContent = '3%';
      exportProgressText.textContent = 'Switching to ' + qLabel + '...';
      setTimeout(() => {
        S._restartingExport = false;
        S.exportAbortSignal = false;
        if (!modalExp.classList.contains('hidden')) {
          startExport(true);
        }
      }, 120);
    }
  }

  function updateConfirmQualityBtnText(q) {
    const btn = $('btnConfirmExportQuality');
    if (!btn) return;
    const labelSpan = btn.querySelector('span');
    let label = 'Export in 1080p Full HD';
    if (q === 'fast' || q === '480p') {
      label = 'Export in 480p Standard (Fast)';
    } else if (q === 'balanced' || q === '720p') {
      label = 'Export in 720p HD Ready';
    } else {
      label = 'Export in 1080p Full HD';
    }
    if (labelSpan) {
      labelSpan.textContent = label;
    } else {
      btn.textContent = label;
    }
  }

  function openExportQualityModal() {
    const modal = $('modalExportQuality');
    if (!modal) {
      startExport(true);
      return;
    }
    const curQ = S.exportQuality || 'high';
    $$('.quality-option-card').forEach(card => {
      card.classList.toggle('active', card.getAttribute('data-quality') === curQ);
    });
    updateConfirmQualityBtnText(curQ);
    modal.classList.remove('hidden');
  }

  function closeExportQualityModal() {
    const modal = $('modalExportQuality');
    if (modal) {
      modal.classList.add('hidden');
    }
  }

  function setupExportQualityModal() {
    const modal = $('modalExportQuality');
    if (!modal) return;

    $$('.quality-option-card').forEach(card => {
      const selectCard = (e) => {
        if (e) {
          try { e.preventDefault(); e.stopPropagation(); } catch (_) {}
        }
        $$('.quality-option-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        const q = card.getAttribute('data-quality') || 'high';
        S.exportQuality = q;
        try { localStorage.setItem('captionstudio_export_quality', q); } catch (_) {}
        updateConfirmQualityBtnText(q);
        updateQualityPillsUI();
      };
      card.onclick = selectCard;
      card.ontouchend = selectCard;
    });

    const btnConfirm = $('btnConfirmExportQuality');
    if (btnConfirm) {
      btnConfirm.onclick = (e) => {
        if (e) { try { e.preventDefault(); e.stopPropagation(); } catch (_) {} }
        closeExportQualityModal();
        startExport(true);
      };
    }

    const btnClose = $('btnCloseQualityModal');
    if (btnClose) {
      btnClose.onclick = (e) => {
        if (e) { try { e.preventDefault(); e.stopPropagation(); } catch (_) {} }
        closeExportQualityModal();
      };
    }

    const btnCancel = $('btnCancelQualityModal');
    if (btnCancel) {
      btnCancel.onclick = (e) => {
        if (e) { try { e.preventDefault(); e.stopPropagation(); } catch (_) {} }
        closeExportQualityModal();
      };
    }

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeExportQualityModal();
      }
    });
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
      const onAction = (e) => {
        if (e) {
          try { e.preventDefault(); e.stopPropagation(); } catch (_) {}
        }
        const q = btn.getAttribute('data-quality');
        setExportQuality(q);
      };
      btn.onclick = onAction;
      btn.ontouchend = onAction;
    });



    updateQualityPillsUI();
  }

  function renderFullTemplatesGrid(query) {
    if (!fullTemplatesGrid) return;
    fullTemplatesGrid.innerHTML = '';
    const q = (query || '').toLowerCase().trim();
    const filtered = (S.presets || []).filter(p => matchesPresetFilter(p, 'all', q));

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
  let _expErrHandlersAdded = false;
  async function startFrameExport() {
    if (!_expErrHandlersAdded) {
      _expErrHandlersAdded = true;
      window.addEventListener('unhandledrejection', (ev) => {
        console.error('[EXPERR] unhandledrejection:', ev && (ev.reason?.message || ev.reason));
      });
      window.addEventListener('error', (ev) => {
        console.error('[EXPERR] error:', ev && (ev.message || ev.error?.message || ev.error));
      });
    }

    let dbgFrameCount = 0;
    let dbgVideoDrawMs = 0;
    let dbgCaptionMs = 0;
    let dbgSegMs = 0;
    let dbgProcMs = 0;
    let dbgEmojiMs = 0;
    let dbgOverlayMs = 0;
    let dbgWatermarkMs = 0;
    let dbgExecMs = 0;
    const dbgStartTime = performance.now();
    if (!window.Mediabunny) {
      try {
        window.Mediabunny = await import('https://cdn.jsdelivr.net/npm/mediabunny@1.65.0/+esm');
      } catch (e) {
        throw new Error('Mediabunny is not loaded: ' + e.message);
      }
    }

    const { Input, Output, Mp4OutputFormat, BufferTarget, ALL_FORMATS, BlobSource, BufferSource, UrlSource } = window.Mediabunny;

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

    // Fast in-memory buffer reading to bypass slow mobile FileReader chunk latency
    try {
      if (S.file && (S.file instanceof Blob || S.file instanceof File)) {
        try { videoBlobUrl = URL.createObjectURL(S.file); } catch (_) {}
        if (typeof BufferSource !== 'undefined') {
          const ab = await S.file.arrayBuffer();
          source = new BufferSource(ab);
        } else {
          source = new BlobSource(S.file);
        }
      } else {
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
            if (!res.ok) throw new Error(`HTTP ${res.status} fetching video buffer`);
            const ab = await res.arrayBuffer();
            try { videoBlobUrl = URL.createObjectURL(new Blob([ab])); } catch (_) {}
            source = (typeof BufferSource !== 'undefined') ? new BufferSource(ab) : new BlobSource(new Blob([ab]));
          } catch (fetchErr) {
            console.warn('Buffer fetch failed, falling back to UrlSource:', fetchErr);
            source = new UrlSource(videoUrl);
          }
        }
      }
    } catch (srcInitErr) {
      console.warn('In-memory buffer source init error, falling back to BlobSource:', srcInitErr);
      if (S.file) source = new BlobSource(S.file);
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
      // Diagnostic logging for source video decoder support
      try {
        if (typeof input.getPrimaryVideoTrack === 'function') {
          const vt = await input.getPrimaryVideoTrack();
          if (vt) {
            let cfg = null;
            if (typeof vt.getDecoderConfig === 'function') {
              cfg = await vt.getDecoderConfig();
            }
            let hwDecode = 'unknown';
            let swDecode = 'unknown';
            if (cfg && typeof VideoDecoder !== 'undefined' && typeof VideoDecoder.isConfigSupported === 'function') {
              try {
                const hwSupp = await VideoDecoder.isConfigSupported({ ...cfg, hardwareAcceleration: 'no-preference' });
                hwDecode = Boolean(hwSupp && hwSupp.supported);
              } catch (_) { hwDecode = false; }
              try {
                const swSupp = await VideoDecoder.isConfigSupported({ ...cfg, hardwareAcceleration: 'prefer-software' });
                swDecode = Boolean(swSupp && swSupp.supported);
              } catch (_) { swDecode = false; }
            }
            let avgFps = 'unknown';
            if (typeof vt.computePacketStats === 'function') {
              try {
                const stats = await vt.computePacketStats(100);
                avgFps = stats?.averagePacketRate ? stats.averagePacketRate.toFixed(1) : (stats?.packetRate ? stats.packetRate.toFixed(1) : 'unknown');
              } catch (_) {}
            }
            const cWidth = vt.codedWidth || vt.width || 'unknown';
            const cHeight = vt.codedHeight || vt.height || 'unknown';
            console.log(`[SRCDBG] codec=${cfg?.codec || 'unknown'} size=${cWidth}x${cHeight} avgFps=${avgFps} hwDecode=${hwDecode} swDecode=${swDecode}`);
          }
        }
      } catch (srcDbgErr) {
        console.warn('[SRCDBG] Diagnostic warning (ignored):', srcDbgErr);
      }

      const rawW = vid.videoWidth || S.probe?.width || 1280;
      const rawH = vid.videoHeight || S.probe?.height || 720;
      let targetW = rawW;
      let targetH = rawH;

      let maxLongSide = 1920;
      const curQ = S.exportQuality || 'high';
      if (curQ === 'fast' || curQ === '480p') {
        maxLongSide = 854;
      } else if (curQ === 'balanced' || curQ === '720p') {
        maxLongSide = 1280;
      } else {
        // High / 1080p (supports up to 1080p Full HD)
        maxLongSide = 1920;
      }

      const currentLongSide = Math.max(targetW, targetH);
      if (currentLongSide > maxLongSide) {
        const scale = maxLongSide / currentLongSide;
        targetW = Math.round(targetW * scale);
        targetH = Math.round(targetH * scale);
      } else if ((curQ === 'high' || curQ === '1080p') && currentLongSide < 1920 && currentLongSide >= 720) {
        // Crisp 1080p render for 720p/HD source clips
        const scale = 1920 / currentLongSide;
        targetW = Math.round(targetW * scale);
        targetH = Math.round(targetH * scale);
      }
      targetW = targetW % 2 === 0 ? targetW : targetW - 1;
      targetH = targetH % 2 === 0 ? targetH : targetH - 1;
      targetW = Math.max(2, targetW);
      targetH = Math.max(2, targetH);

      // Streamlined bitrate based on resolution
      const isMobileDevice = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
      let targetBitrate = isMobileDevice ? 2500000 : 3800000;
      const chosenLong = Math.max(targetW, targetH);
      if (chosenLong <= 854) {
        targetBitrate = isMobileDevice ? 1600000 : 2200000;
      } else if (chosenLong <= 1280) {
        targetBitrate = isMobileDevice ? 2500000 : 3800000;
      } else {
        targetBitrate = isMobileDevice ? 4500000 : 6000000;
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
          const exportChosenFont = S.style?.fontFamily || S.font || 'Poppins';
          await Promise.all([
            document.fonts.load(`800 100px "${exportChosenFont}"`),
            document.fonts.load(`italic 800 100px "${exportChosenFont}"`),
            document.fonts.load('800 100px "Poppins"'),
            document.fonts.load('italic 800 100px "Poppins"'),
            document.fonts.load('600 48px "Poppins"'),
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
        try {
          exportFrameIndex++;
        const W = targetW;
        const H = targetH;

        if (!canvas) {
          if (typeof OffscreenCanvas !== 'undefined') {
            try {
              canvas = new OffscreenCanvas(W, H);
              ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
            } catch (_) {}
          }
          if (!ctx) {
            canvas = document.createElement('canvas');
            canvas.width = W;
            canvas.height = H;
            ctx = canvas.getContext('2d', { alpha: false });
          }
        }

        const t = sample.timestamp || 0;

        // PROBLEM A Point 2: Strictly increasing timestamps (start at 0, in ms, never repeat or go backwards)
        let frameMs = Math.round(t * 1000);
        if (frameMs <= lastExportTimestampMs) {
          frameMs = lastExportTimestampMs + 1;
        }
        lastExportTimestampMs = frameMs;

        // Binary/fast caption lookup by time
        const activeCap = S.captions.find(c => t >= c.start && t <= c.end);

        // Dynamic Auto-Zoom calculation (optimized)
        const az = S.autoZoom;
        let isZoomed = false;
        if (az && az.enabled) {
          if (az.interval > 0) {
            isZoomed = (t % az.interval) < (az.duration || 3.5);
          } else if (activeCap) {
            const idx = S.captions.indexOf(activeCap);
            isZoomed = (idx !== -1 && idx % 4 === 1);
          }
        }

        const activeBroll = (S.brolls && S.brolls.length > 0) ? S.brolls.find(b => b.url && t >= b.start && t <= b.end) : null;
        const hasProgressBar = Boolean(S.progressBar && S.progressBar.enabled === true);
        const hasWatermark = Boolean(S.watermark && S.watermark.text && S.watermark.text.trim());

        // Skip all extra drawing work on frames with no active caption or overlay
        if (!isZoomed && !activeBroll && !hasProgressBar && !activeCap && !hasWatermark) {
          sample.draw(ctx, 0, 0, W, H);
          lastExportMaskCanvas = null;
          exportMaskFrameIdx = 0;
          try { if (sample && typeof sample.close === 'function') sample.close(); } catch (_) {}
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
          try { if (sample && typeof sample.close === 'function') sample.close(); } catch (_) {}
          return canvas;
        }

        // PROBLEM A Point 3: Per frame, order must be:
        // a) video frame
        dbgFrameCount++;
        const _tVideo0 = performance.now();
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
        dbgVideoDrawMs += (performance.now() - _tVideo0);

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
          if (!activeCap._cachedExportWords) {
            activeCap._cachedExportWords = (activeCap.words || []).map(w => ({
              t: w.t || w.word || '',
              s: typeof w.s === 'number' ? w.s : (typeof w.start === 'number' ? w.start : 0),
              e: typeof w.e === 'number' ? w.e : (typeof w.end === 'number' ? w.end : 0),
              key: Boolean(w.key),
              color: w.color || undefined
            }));
          }
          const words = activeCap._cachedExportWords;

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

            exportMaskFrameIdx++;
            let maskCanvas = null;

            // Compute mask before typography so frame 0 latches the detected head crown cleanly
            if (exportMaskFrameIdx % 3 === 1 || !lastExportMaskCanvas) {
              const _tSeg0 = performance.now();
              const newMask = getExportPersonMask(exportSegmenter, exportCleanFrameCanvas, frameMs, W, H);
              dbgSegMs += (performance.now() - _tSeg0);
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

            // Separate lines into behind and front contexts
            const _tCapBehind0 = performance.now();
            drawCanvasTypography(segExportForeCtx, segExportBehindCtx, activeCap, words, t, S.style || {}, W, H, true, false);
            dbgCaptionMs += (performance.now() - _tCapBehind0);

            // PROBLEM A Point 3 & 4: Check mask validity and log
            const maskOk = Boolean(maskCanvas && maskCanvas.width === W && maskCanvas.height === H);
            if (exportFrameIndex % 30 === 0) {
              console.log('[BEHIND]', exportFrameIndex, maskOk ? 'mask ok' : 'mask missing');
            }

            if (!maskOk) {
              // Person not detected in this frame: safely draw captions in front without aborting export
              if (S.style && S.style.id === 'editorial_depth_stack') {
                ctx.save();
                ctx.globalCompositeOperation = 'multiply';
                ctx.globalAlpha = 0.92;
                ctx.drawImage(segExportBehindCanvas, 0, 0, W, H);
                ctx.restore();
              } else {
                ctx.drawImage(segExportBehindCanvas, 0, 0, W, H);
              }
              ctx.drawImage(segExportForeCanvas, 0, 0, W, H);
              drawAutoEmojis(ctx, activeCap, words, t, S.style || {}, W, H);
            } else {
              consecutiveMaskFailures = 0;

              // PROBLEM A Point 3: Per-frame order:
              // a) video frame (already drawn to ctx)
              // b) behind captions/graphics
              if (S.style && S.style.id === 'editorial_depth_stack') {
                ctx.save();
                ctx.globalCompositeOperation = 'multiply';
                ctx.globalAlpha = 0.92;
                ctx.drawImage(segExportBehindCanvas, 0, 0, W, H);
                ctx.restore();
              } else {
                ctx.drawImage(segExportBehindCanvas, 0, 0, W, H);
              }

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
            const _tCapStd0 = performance.now();
            drawCanvasTypography(ctx, null, activeCap, words, t, S.style || {}, W, H, isBehind, false);
            dbgCaptionMs += (performance.now() - _tCapStd0);
            drawAutoEmojis(ctx, activeCap, words, t, S.style || {}, W, H);
          }
        } else {
          lastExportMaskCanvas = null;
          exportMaskFrameIdx = 0;
        }

        drawRealEstateOverlays(ctx, W, H, t);
        drawWatermark(ctx, W, H);

        try { if (sample && typeof sample.close === 'function') sample.close(); } catch (_) {}
        return canvas;
        } catch (procFrameErr) {
          console.warn('[EXPORT] processFrame recovered frame:', procFrameErr);
          try {
            if (canvas && ctx) {
              ctx.clearRect(0, 0, targetW, targetH);
              sample.draw(ctx, 0, 0, targetW, targetH);
              try { if (sample && typeof sample.close === 'function') sample.close(); } catch (_) {}
              return canvas;
            }
          } catch (_) {}
          return sample;
        }
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

      const audioConfig = audioSource ? { discard: true } : undefined;

      conversion = await window.Mediabunny.Conversion.init({
        input,
        output,
        composable: Boolean(audioSource),
        audio: audioConfig,
        video: {
          ...baseVideoConfig,
          hardwareAcceleration: 'prefer-hardware',
          process: processFrame
        }
      });
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
        if (now - lastUiUpdate < 1500 && progress < 0.99) {
          return;
        }
        lastUiUpdate = now;

        const pct = Math.min(99, Math.max(1, Math.round(progress * 100)));
        if (exportProgressBar) exportProgressBar.style.width = pct + '%';
        if (exportPercent) exportPercent.textContent = pct + '%';
        if (exportProgressText) exportProgressText.textContent = `Exporting: ${pct}%`;
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
      window._lastExportedBlob = blob;
      window._lastExportedUrl = url;

      deductCreditAfterExport();
      updateExportPipeline(3);

      const totalSec = Number(((performance.now() - dbgStartTime) / 1000).toFixed(2));
      const brollUsed = Boolean(S.brolls && S.brolls.length > 0);
      const fpsActual = totalSec > 0 ? (dbgFrameCount / totalSec).toFixed(1) : 0;
      const perfBreakdown = `[EXPDBG] frames=${dbgFrameCount} totalSec=${totalSec} procMs=${Math.round(dbgProcMs)} emojiMs=${Math.round(dbgEmojiMs)} overlayMs=${Math.round(dbgOverlayMs)} watermarkMs=${Math.round(dbgWatermarkMs)} execMs=${Math.round(dbgExecMs)} codec=avc`;
      console.log(perfBreakdown);
      window._lastExportPerf = perfBreakdown;

      showExportComplete(url, blob);
    } catch (e) {
      console.error('[EXPERR]', e && e.message, e && e.stack);
      if (exportProgressText && e && e.message) {
        exportProgressText.textContent = 'Export error: ' + e.message;
      }
      throw e;
    } finally {
      // PROBLEM A Point 2: Close export segmenter when export ends
      if (exportSegmenter) {
        try {
          exportSegmenter.close();
        } catch (_) {}
        exportSegmenter = null;
      }
      document.body.classList.remove('export-mode-active');
      if (modalExport) modalExport.style.backgroundColor = '';
      if (wakeLock) {
        try {
          await wakeLock.release();
        } catch (_) {}
        wakeLock = null;
      }
      try {
        if (typeof restoreEditorAfterExport === 'function') {
          restoreEditorAfterExport();
        }
      } catch (restErr) {
        console.warn('[EXPORT] restoreEditorAfterExport warning:', restErr);
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
          if (S.file) formData.append('originalVideoFile', S.file);
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

  async function startExport(skipQualityPrompt = false) {
    // 1. Mandatory Sign In Check: User must sign in with Google/Email to export!
    if (!S.user || !S.user.id) {
      S.pendingExportAfterLogin = true;
      const modalLogin = $('modalLogin');
      if (modalLogin) {
        modalLogin.classList.remove('hidden');
        showToast('🔐 Please sign in with your Gmail/Account to export!');
      } else if (typeof openAuthModal === 'function') {
        openAuthModal();
      }
      return;
    }

    // 2. Export Credits / Paywall Check
    if (S.credits <= 0) {
      S.pendingExportAfterCoupon = true;
      openCouponModal();
      return;
    }

    // 3. Ask for Export Quality Before Starting Render (Supports up to 1080p)
    if (!skipQualityPrompt) {
      openExportQualityModal();
      return;
    }

    vid.pause();
    updateQualityPillsUI();
    // Hide complex underlying video and editor DOM to give 100% GPU to video encoder
    const editorMain = document.querySelector('.editor-main') || $('editorMain') || document.body;
    document.body.classList.add('export-mode-active');
    modalExport.style.backgroundColor = '#ffffff';
    modalExport.style.opacity = '1';
    modalExport.classList.remove('hidden');
    exportWorkingState.classList.remove('hidden');
    exportDoneState.classList.add('hidden');
    exportErrorState.classList.add('hidden');

    exportProgressBar.style.width = '5%';
    exportPercent.textContent = '5%';
    exportProgressText.textContent = 'Initiating hardware video render...';
    exportProgressDetail.textContent = 'Preparing WebCodecs frame-by-frame renderer.';

    if ('Notification' in window && Notification.permission === 'default') {
      try { Notification.requestPermission(); } catch (_) {}
    }

    if (exportElapsedInterval) clearInterval(exportElapsedInterval);
    exportStartTime = Date.now();
    const timerVal = $('exportTimerVal');
    if (timerVal) timerVal.textContent = '00:00';
    /* setInterval disabled during export */

    updateExportPipeline(1, 'Rendering Video...', 'Queued');

    if (S.popStudioConfig && S.popStudioConfig.enabled) {
      await ensurePopStudioFonts();
    }

    const hasWebCodecs = typeof VideoEncoder !== 'undefined' && typeof VideoDecoder !== 'undefined';
    if (!hasWebCodecs) {
      if (exportElapsedInterval) clearInterval(exportElapsedInterval);
      const errMsg = 'Hardware video export requires WebCodecs support. Please open this app in Chrome or Edge.';
      showToast(errMsg, 10000);
      exportWorkingState.classList.add('hidden');
      exportErrorState.classList.remove('hidden');
      const exportErrorMessage = $('exportErrorMessage');
      if (exportErrorMessage) exportErrorMessage.textContent = errMsg;
      return;
    }

    if (!window.Mediabunny) {
      try {
        window.Mediabunny = await import('https://cdn.jsdelivr.net/npm/mediabunny@1.65.0/+esm');
      } catch (mErr) {
        console.warn('Could not load Mediabunny dynamically:', mErr);
      }
    }

    if (!window.Mediabunny) {
      if (exportElapsedInterval) clearInterval(exportElapsedInterval);
      const failMsg = 'Export library (Mediabunny) could not be loaded. Please check your internet connection.';
      showToast(failMsg, 10000);
      exportWorkingState.classList.add('hidden');
      exportErrorState.classList.remove('hidden');
      const exportErrorMessage = $('exportErrorMessage');
      if (exportErrorMessage) exportErrorMessage.textContent = failMsg;
      return;
    }

    try {
      await startFrameExport();
    } catch (frameErr) {
      if (S._restartingExport) {
        console.log('Frame export aborted for quality restart.');
        return;
      }
      console.error('[EXPORT] Hardware export failed with error:', frameErr && frameErr.stack ? frameErr.stack : frameErr);
      const failMsg = 'Export failed: ' + (frameErr && frameErr.message ? frameErr.message : String(frameErr));
      showToast(failMsg, 10000);
      exportWorkingState.classList.add('hidden');
      exportErrorState.classList.remove('hidden');
      const exportErrorMessage = $('exportErrorMessage');
      if (exportErrorMessage) exportErrorMessage.textContent = failMsg;
      if (exportElapsedInterval) clearInterval(exportElapsedInterval);
    }
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
        quality: S.exportQuality || 'balanced',
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

  function showExportComplete(filename, blobData) {
    if (exportElapsedInterval) clearInterval(exportElapsedInterval);
    exportWorkingState.classList.add('hidden');
    exportDoneState.classList.remove('hidden');

    const totalSec = exportStartTime > 0 ? Math.round((Date.now() - exportStartTime) / 1000) : 0;
    const timeStr = totalSec >= 60
      ? (Math.floor(totalSec / 60) + 'm ' + (totalSec % 60) + 's')
      : (totalSec + 's');

    const doneMeta = $('exportDoneMeta');
    if (doneMeta) {
      const videoDur = Math.round(vid.duration || S.probe?.duration || 0);
      const speedMultiplier = videoDur > 0 ? (videoDur / Math.max(1, totalSec)).toFixed(1) + 'x speed' : '';
      const speedPart = speedMultiplier ? (' • ' + speedMultiplier) : '';
      const qPart = (S.exportQuality === 'high' || S.exportQuality === '1080p') ? '1080p Full HD' : ((S.exportQuality === 'fast' || S.exportQuality === '480p') ? '480p Standard' : '720p HD Ready');
      doneMeta.textContent = 'Completed in ' + timeStr + speedPart + ' • ' + qPart + ' with synced audio.';
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
    btnDownloadExport.removeAttribute('target'); // NEVER use _blank so browser downloads file instead of opening player

    // Direct instant local download (Server auto-upload disabled)
    setTimeout(() => {
      forceDirectDownload(targetDownloadUrl, targetFileName);
    }, 150);

    // Direct file download helper without opening video player
    function forceDirectDownload(urlOverride, nameOverride) {
      const dlUrl = urlOverride || targetDownloadUrl;
      const dlName = nameOverride || targetFileName || 'captioned_video.mp4';
      if (!dlUrl) return;

      // If server attachment URL, window.location forces Android Download Manager directly:
      if (dlUrl.startsWith('/download/')) {
        window.location.href = dlUrl;
        return;
      }

      try {
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = dlUrl;
        a.download = dlName;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          try { document.body.removeChild(a); } catch (_) {}
        }, 800);
      } catch (err) {
        console.warn('[DOWNLOAD] Direct <a> error:', err);
      }
    }

    // Explicit click handler for Download Video button
    btnDownloadExport.onclick = (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      forceDirectDownload();
    };

    const btnShareExport = $('btnShareExport');
    if (btnShareExport) {
      btnShareExport.onclick = async (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        let blobForShare = currentBlob || (filename instanceof Blob ? filename : null);
        if (!blobForShare && targetDownloadUrl) {
          if (typeof showToast === 'function') showToast('⏳ Preparing video to save...');
          try {
            const fetchRes = await fetch(targetDownloadUrl);
            blobForShare = await fetchRes.blob();
            currentBlob = blobForShare;
          } catch (fetchErr) {
            console.warn('[SHARE] Video blob fetch note:', fetchErr);
          }
        }
        if (blobForShare && navigator.share && navigator.canShare) {
          try {
            const shareFile = new File([blobForShare], targetFileName || 'captioned_video.mp4', { type: 'video/mp4' });
            if (navigator.canShare({ files: [shareFile] })) {
              await navigator.share({
                files: [shareFile],
                title: 'Captioned Video',
                text: 'Your captioned video is ready!'
              });
              return;
            }
          } catch (shareErr) {
            if (shareErr.name === 'AbortError') return;
          }
        }
        forceDirectDownload();
      };
    }

    const btnCopyExportLink = $('btnCopyExportLink');
    if (btnCopyExportLink) {
      btnCopyExportLink.onclick = (e) => {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        const fullUrl = new URL(targetDownloadUrl, window.location.href).href;
        try {
          navigator.clipboard.writeText(fullUrl);
          if (typeof showToast === 'function') showToast('📋 Direct download link copied!');
        } catch (_) {
          prompt('Copy this video download link:', fullUrl);
        }
      };
    }

    // AUTOMATIC FAST DOWNLOAD: Trigger immediate file download as soon as export finishes
    setTimeout(() => {
      try {
        forceDirectDownload();
      } catch (_) {}
    }, 300);

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

// ============================================================================

// PART B: INTERACTIVE CAPTION TIMELINE & VIDEO TAP-TO-EDIT SUITE
// ============================================================================

window._hasShownTapEditHint = false;
window._hasScrubbedTimeline = false;
S.selectedCaptionId = null;
S.selectedWordIndex = -1;
S.editMode = 'whole'; // 'whole' | 'word'
S.adjustScope = 'all'; // 'all' | 'one'
S.cachedLayoutBoxes = [];

function getTargetCaptionsForEdit(cap) {
  if (S.adjustScope === 'all' && S.editMode !== 'word' && Array.isArray(S.captions) && S.captions.length) {
    return S.captions;
  }
  return cap ? [cap] : [];
}

function applyCaptionTransform(cap, mutator) {
  getTargetCaptionsForEdit(cap).forEach(c => {
    if (c) mutator(c);
  });
}

function snapAndClampDelta(rawDx, rawDy) {
  let dx = rawDx;
  let dy = rawDy;
  let snapV = false;
  let snapH = false;
  if (Math.abs(dx) < 0.02) { dx = 0; snapV = true; }
  if (Math.abs(dy) < 0.02) { dy = 0; snapH = true; }
  dx = Math.round(Math.max(-0.42, Math.min(0.42, dx)) * 1000) / 1000;
  dy = Math.round(Math.max(-0.42, Math.min(0.42, dy)) * 1000) / 1000;
  return { dx, dy, snapV, snapH };
}

function snapRotationDeg(rawDeg) {
  let d = ((Number(rawDeg) || 0) % 360 + 540) % 360 - 180;
  for (const anchor of [0, 45, -45, 90, -90, 135, -135, 180, -180]) {
    if (Math.abs(d - anchor) <= 4) { d = anchor === -180 ? 180 : anchor; break; }
  }
  return Math.round(d * 10) / 10;
}

function updateSnapGuidesDOM(showV, showH) {
  const snapV = $('snapGuideV');
  const snapH = $('snapGuideH');
  if (snapV) snapV.classList.toggle('hidden', !showV);
  if (snapH) snapH.classList.toggle('hidden', !showH);
}

function updateTransformHud(text, show) {
  const hud = $('boxTransformHud');
  if (!hud) return;
  hud.textContent = text || '';
  hud.classList.toggle('hidden', !show);
}

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

  const scaledW = totalW * capScale;
  const scaledH = totalH * capScale;
  const capBoxW = Math.max(0.14, Math.min(0.96, scaledW / W));
  const capBoxH = Math.max(0.05, Math.min(0.96, scaledH / H));
  const capBoxX = Math.max(0, Math.min(1 - capBoxW, ((centerX + capDx) / W) - capBoxW / 2));
  const capBoxY = Math.max(0, Math.min(1 - capBoxH, ((centerY + capDy) / H) - capBoxH / 2));

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
  updateTransformHud('', false);

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

  // Update scope & mode pills
  const btnScopeAll = $('btnAdjustScopeAll');
  const btnScopeOne = $('btnAdjustScopeOne');
  if (btnScopeAll && btnScopeOne) {
    btnScopeAll.classList.toggle('active', S.adjustScope === 'all');
    btnScopeOne.classList.toggle('active', S.adjustScope !== 'all');
  }
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

  const snapV = $('snapGuideV');
  const snapH = $('snapGuideH');
  if (snapV) snapV.style.left = Math.round(stageLeftInWrapper + stageRect.width * 0.5) + 'px';
  if (snapH) snapH.style.top = Math.round(stageTopInWrapper + stageRect.height * 0.5) + 'px';

  const layoutItem = (S.cachedLayoutBoxes || []).find(item => item.capId === cap.id);
  let targetNormBox = layoutItem ? layoutItem.box : null;

  if (S.editMode === 'word' && S.selectedWordIndex >= 0 && layoutItem && layoutItem.wordBoxes && layoutItem.wordBoxes[S.selectedWordIndex]) {
    targetNormBox = layoutItem.wordBoxes[S.selectedWordIndex].box;
  }

  if (!targetNormBox) {
    const scaleVal = Number(cap.scale) || 1.0;
    const estW = Math.min(0.94, 0.78 * scaleVal);
    const estH = Math.min(0.45, 0.14 * scaleVal);
    const cxNorm = 0.5 + (Number(cap.dx) || 0);
    const cyNorm = (Number(S.style?.position || S.style?.posY) || 0.72) + (Number(cap.dy) || 0);
    targetNormBox = {
      x: Math.max(0, Math.min(1 - estW, cxNorm - estW / 2)),
      y: Math.max(0, Math.min(1 - estH, cyNorm - estH / 2)),
      w: estW,
      h: estH
    };
  }

  const boxX = stageLeftInWrapper + targetNormBox.x * stageRect.width;
  const boxY = stageTopInWrapper + targetNormBox.y * stageRect.height;
  const boxW = Math.max(56, targetNormBox.w * stageRect.width);
  const boxH = Math.max(36, targetNormBox.h * stageRect.height);

  bbox.style.left = Math.round(boxX) + 'px';
  bbox.style.top = Math.round(boxY) + 'px';
  bbox.style.width = Math.round(boxW) + 'px';
  bbox.style.height = Math.round(boxH) + 'px';
  const rotDeg = S.editMode === 'word' ? 0 : (Number(cap.rot) || 0);
  bbox.style.transform = rotDeg ? `rotate(${rotDeg}deg)` : '';

  // Position mini toolbar centered near the box and safely inside wrapperRect
  const tbW = miniToolbar.offsetWidth || Math.min(wrapperRect.width - 16, 330);
  const tbH = miniToolbar.offsetHeight || 42;
  let toolbarY = boxY + boxH + 40; // leave room for bottom rotation handle
  if (toolbarY + tbH > wrapperRect.height - 8) {
    toolbarY = Math.max(8, boxY - tbH - 12);
  }
  const halfTb = tbW * 0.5;
  const toolbarCenterX = Math.max(halfTb + 8, Math.min(wrapperRect.width - halfTb - 8, boxX + boxW * 0.5));

  miniToolbar.style.left = Math.round(toolbarCenterX) + 'px';
  miniToolbar.style.top = Math.round(toolbarY) + 'px';
}

/**
 * Handle tap on video preview to select caption or word
 */
function handleStageTapToEdit(e) {
  if (e.target.closest('#videoEditMiniToolbar') || e.target.closest('.box-handle') || e.target.closest('#timelineClipActionBar') || e.target.closest('#btnStageSettings')) {
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
  let pinch = null;
  const activePointers = new Map();
  let wheelHistoryTimer = null;

  const getSelectedCap = () => {
    const capIdx = S.captions.findIndex(c => c.id === S.selectedCaptionId);
    return capIdx === -1 ? null : { capIdx, cap: S.captions[capIdx] };
  };

  const commitFrameUpdate = () => {
    requestAnimationFrame(() => {
      renderCanvas();
      updateVideoEditOverlay();
    });
  };

  const startTwoFingerPinch = () => {
    const pts = [...activePointers.values()];
    if (pts.length < 2) return;
    const found = getSelectedCap();
    const curT = vid ? (vid.currentTime || 0) : 0;
    const cap = found ? found.cap : S.captions.find(c => curT >= c.start && curT <= c.end);
    if (!cap) return;
    if (!found) {
      S.selectedCaptionId = cap.id;
      S.editMode = 'whole';
      S.selectedWordIndex = -1;
    }
    const [p1, p2] = pts;
    const stageRect = stage.getBoundingClientRect();
    drag = null;
    pinch = {
      cap,
      stageW: Math.max(1, stageRect.width),
      stageH: Math.max(1, stageRect.height),
      startDist: Math.max(12, Math.hypot(p2.x - p1.x, p2.y - p1.y)),
      startAngle: Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI),
      startMidX: (p1.x + p2.x) * 0.5,
      startMidY: (p1.y + p2.y) * 0.5,
      origScale: Number(cap.scale) || 1.0,
      origRot: Number(cap.rot) || 0,
      origDx: Number(cap.dx) || 0,
      origDy: Number(cap.dy) || 0
    };
  };

  const onWrapperPointerDown = (e) => {
    if (e.target.closest('#videoEditMiniToolbar')) return;
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (activePointers.size === 2) {
      startTwoFingerPinch();
    }
  };

  const onPointerDown = (e) => {
    if (e.target.closest('#videoEditMiniToolbar')) return;
    const found = getSelectedCap();
    if (!found) return;
    const { capIdx, cap } = found;

    e.stopPropagation();
    try { e.target.setPointerCapture(e.pointerId); } catch (_) {}

    if (activePointers.size >= 2) return;

    const handleEl = e.target.closest('.box-handle');
    const stageRect = stage.getBoundingClientRect();

    if (handleEl) {
      const handleType = handleEl.getAttribute('data-handle') || 'se';
      const bboxRect = bbox.getBoundingClientRect();
      const centerX = bboxRect.left + bboxRect.width / 2;
      const centerY = bboxRect.top + bboxRect.height / 2;
      if (handleType === 'rot') {
        drag = {
          type: 'rotate',
          pointerId: e.pointerId,
          centerX,
          centerY,
          startAngle: Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI),
          origRot: Number(cap.rot) || 0,
          capIdx,
          cap,
          moved: false
        };
      } else {
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
          cap,
          moved: false
        };
      }
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
        stageW: Math.max(1, stageRect.width),
        stageH: Math.max(1, stageRect.height),
        isWordMode,
        targetObj,
        cap,
        capIdx,
        wordIdx: isWordMode ? S.selectedWordIndex : -1,
        moved: false
      };
    }
  };

  const onPointerMove = (e) => {
    if (activePointers.has(e.pointerId)) {
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (pinch && activePointers.size >= 2) {
      e.preventDefault();
      const [p1, p2] = [...activePointers.values()];
      const curDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const curAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI);
      const midX = (p1.x + p2.x) * 0.5;
      const midY = (p1.y + p2.y) * 0.5;

      const nextScale = Math.round(Math.max(0.4, Math.min(2.5, pinch.origScale * (curDist / pinch.startDist))) * 100) / 100;
      const nextRot = snapRotationDeg(pinch.origRot + (curAngle - pinch.startAngle));
      const snap = snapAndClampDelta(pinch.origDx + (midX - pinch.startMidX) / pinch.stageW, pinch.origDy + (midY - pinch.startMidY) / pinch.stageH);

      applyCaptionTransform(pinch.cap, (c) => {
        c.scale = nextScale;
        c.rot = nextRot;
        c.dx = snap.dx;
        c.dy = snap.dy;
      });
      updateSnapGuidesDOM(snap.snapV, snap.snapH);
      updateTransformHud(`${nextScale.toFixed(2)}× · ${nextRot}°`, true);
      commitFrameUpdate();
      return;
    }

    if (!drag || drag.pointerId !== e.pointerId) return;

    if (drag.type === 'scale') {
      drag.moved = true;
      const curDist = Math.hypot(e.clientX - drag.centerX, e.clientY - drag.centerY);
      const scaleFactor = curDist / drag.startDist;
      const newScale = Math.round(Math.max(0.4, Math.min(2.5, drag.origScale * scaleFactor)) * 100) / 100;
      applyCaptionTransform(drag.cap, (c) => { c.scale = newScale; });
      updateTransformHud(`${newScale.toFixed(2)}×`, true);
      commitFrameUpdate();
    } else if (drag.type === 'rotate') {
      drag.moved = true;
      const curAngle = Math.atan2(e.clientY - drag.centerY, e.clientX - drag.centerX) * (180 / Math.PI);
      const nextRot = snapRotationDeg(drag.origRot + (curAngle - drag.startAngle));
      applyCaptionTransform(drag.cap, (c) => { c.rot = nextRot; });
      updateTransformHud(`${nextRot}°`, true);
      commitFrameUpdate();
    } else if (drag.type === 'move') {
      const deltaX = e.clientX - drag.startX;
      const deltaY = e.clientY - drag.startY;
      if (!drag.moved && Math.hypot(deltaX, deltaY) < 3) return;
      drag.moved = true;

      const snap = snapAndClampDelta(drag.origDx + (deltaX / drag.stageW), drag.origDy + (deltaY / drag.stageH));
      updateSnapGuidesDOM(snap.snapV, snap.snapH);
      if ((snap.snapV || snap.snapH) && navigator.vibrate) {
        try { navigator.vibrate(8); } catch (_) {}
      }

      if (drag.isWordMode) {
        drag.targetObj.dx = snap.dx;
        drag.targetObj.dy = snap.dy;
      } else {
        applyCaptionTransform(drag.cap, (c) => {
          c.dx = snap.dx;
          c.dy = snap.dy;
        });
      }
      updateTransformHud(`${Math.round(snap.dx * 100)}%, ${Math.round(snap.dy * 100)}%`, true);
      commitFrameUpdate();
    }
  };

  const onPointerUp = (e) => {
    activePointers.delete(e.pointerId);
    if (pinch && activePointers.size < 2) {
      pinch = null;
      updateSnapGuidesDOM(false, false);
      updateTransformHud('', false);
      pushHistoryState('Pinch adjust caption');
      renderCanvas();
      updateVideoEditOverlay();
    }

    if (!drag || drag.pointerId !== e.pointerId) return;
    const d = drag;
    drag = null;
    try { e.target.releasePointerCapture(e.pointerId); } catch (_) {}

    updateSnapGuidesDOM(false, false);
    updateTransformHud('', false);

    if (d.type === 'scale' && d.moved) {
      pushHistoryState('Scale caption');
      console.log('[EDIT]', 'scale', d.capIdx, -1, d.cap.scale);
    } else if (d.type === 'rotate' && d.moved) {
      pushHistoryState('Rotate caption');
      console.log('[EDIT]', 'rotate', d.capIdx, -1, d.cap.rot);
    } else if (d.type === 'move' && d.moved) {
      pushHistoryState('Move caption position');
      console.log('[EDIT]', 'move', d.capIdx, d.wordIdx, { dx: d.targetObj.dx, dy: d.targetObj.dy });
    }
    renderCanvas();
    updateVideoEditOverlay();
  };

  stageWrapper.addEventListener('pointerdown', onWrapperPointerDown, { passive: true });
  bbox.addEventListener('pointerdown', onPointerDown);
  bbox.addEventListener('wheel', (e) => {
    const found = getSelectedCap();
    if (!found) return;
    e.preventDefault();
    e.stopPropagation();
    const step = e.deltaY < 0 ? 0.06 : -0.06;
    const nextScale = Math.round(Math.max(0.4, Math.min(2.5, (Number(found.cap.scale) || 1.0) + step)) * 100) / 100;
    applyCaptionTransform(found.cap, (c) => { c.scale = nextScale; });
    updateTransformHud(`${nextScale.toFixed(2)}×`, true);
    renderCanvas();
    updateVideoEditOverlay();
    clearTimeout(wheelHistoryTimer);
    wheelHistoryTimer = setTimeout(() => {
      updateTransformHud('', false);
      pushHistoryState('Resize caption');
    }, 350);
  }, { passive: false });
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);

  // Mini toolbar button handlers
  const bindScopeBtn = (id, scope) => {
    const btn = $(id);
    if (!btn) return;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      S.adjustScope = scope;
      updateVideoEditOverlay();
      showToast(scope === 'all' ? 'Editing all captions together' : 'Editing only this caption');
    });
  };
  bindScopeBtn('btnAdjustScopeAll', 'all');
  bindScopeBtn('btnAdjustScopeOne', 'one');

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

  const stepScale = (delta) => {
    const found = getSelectedCap();
    if (!found) return;
    const nextScale = Math.round(Math.max(0.4, Math.min(2.5, (Number(found.cap.scale) || 1.0) + delta)) * 100) / 100;
    applyCaptionTransform(found.cap, (c) => { c.scale = nextScale; });
    pushHistoryState('Scale caption');
    renderCanvas();
    updateVideoEditOverlay();
    updateTransformHud(`${nextScale.toFixed(2)}×`, true);
    clearTimeout(wheelHistoryTimer);
    wheelHistoryTimer = setTimeout(() => updateTransformHud('', false), 700);
  };

  const btnScaleDown = $('btnMiniScaleDown');
  if (btnScaleDown) btnScaleDown.addEventListener('click', (e) => { e.stopPropagation(); stepScale(-0.10); });
  const btnScaleUp = $('btnMiniScaleUp');
  if (btnScaleUp) btnScaleUp.addEventListener('click', (e) => { e.stopPropagation(); stepScale(0.10); });

  const btnCenter = $('btnMiniCenter');
  if (btnCenter) {
    btnCenter.addEventListener('click', (e) => {
      e.stopPropagation();
      const found = getSelectedCap();
      if (!found) return;
      applyCaptionTransform(found.cap, (c) => {
        c.dx = 0;
        c.rot = 0;
      });
      pushHistoryState('Center caption');
      renderCanvas();
      updateVideoEditOverlay();
      showToast('Centered & leveled caption');
    });
  }

  const btnMiniEditText = $('btnMiniEditText');
  if (btnMiniEditText) {
    btnMiniEditText.addEventListener('click', (e) => {
      e.stopPropagation();
      openCaptionEditSheet(S.selectedCaptionId);
    });
  }

  const btnMiniStyle = $('btnMiniStyle');
  if (btnMiniStyle) {
    btnMiniStyle.addEventListener('click', (e) => {
      e.stopPropagation();
      openDrawerTab('tabStyle', { instant: true });
      const dc = document.querySelector('#drawerPanel .drawer-content');
      if (dc) dc.scrollTop = 0;
    });
  }

  const btnMiniResetPos = $('btnMiniResetPos');
  if (btnMiniResetPos) {
    btnMiniResetPos.addEventListener('click', (e) => {
      e.stopPropagation();
      const found = getSelectedCap();
      if (!found) return;
      const { capIdx, cap } = found;
      if (S.editMode === 'word' && S.selectedWordIndex >= 0 && cap.words && cap.words[S.selectedWordIndex]) {
        cap.words[S.selectedWordIndex].dx = 0;
        cap.words[S.selectedWordIndex].dy = 0;
        console.log('[EDIT]', 'reset_word_pos', capIdx, S.selectedWordIndex, 0);
      } else {
        applyCaptionTransform(cap, (c) => {
          c.dx = 0;
          c.dy = 0;
          c.scale = 1.0;
          c.rot = 0;
        });
        console.log('[EDIT]', 'reset_caption_pos', capIdx, -1, 0);
      }
      pushHistoryState('Reset position');
      renderCanvas();
      updateVideoEditOverlay();
      showToast('Position, size & angle reset');
    });
  }

  const btnMiniApplyAll = $('btnMiniApplyAll');
  if (btnMiniApplyAll) {
    btnMiniApplyAll.addEventListener('click', (e) => {
      e.stopPropagation();
      const found = getSelectedCap();
      if (!found) return;
      const { capIdx, cap } = found;
      S.captions.forEach((c) => {
        c.dx = cap.dx || 0;
        c.dy = cap.dy || 0;
        c.scale = cap.scale || 1.0;
        c.rot = cap.rot || 0;
      });
      pushHistoryState('Apply position to all captions');
      console.log('[EDIT]', 'apply_all_pos', capIdx, -1, { dx: cap.dx, dy: cap.dy, scale: cap.scale, rot: cap.rot });
      renderCanvas();
      updateVideoEditOverlay();
      showToast('Synced position, size & angle to all captions');
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
      if (w.s != null) {
        try { vid.currentTime = Math.max(0, w.s + 0.02); } catch (_) {}
        renderCanvas(true);
        syncTimelinePlayhead();
      }
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
  const toolbarInput = $('templateSearchInput');

  const applyTemplateSearch = (raw) => {
    const q = (raw || '').toLowerCase().trim();
    renderPresetsTab(_activePresetCat, q);
  };

  if (searchToggle && toolbarInput) {
    searchToggle.addEventListener('click', () => {
      const willOpen = toolbarInput.classList.contains('hidden');
      toolbarInput.classList.toggle('hidden', !willOpen);
      if (willOpen) {
        toolbarInput.focus();
        applyTemplateSearch(toolbarInput.value);
      } else {
        toolbarInput.value = '';
        applyTemplateSearch('');
      }
    });

    toolbarInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        toolbarInput.value = '';
        toolbarInput.classList.add('hidden');
        applyTemplateSearch('');
      }
    });
  }

  const searchInputs = Array.from(document.querySelectorAll('#templateSearchInput, .template-search-input, .search-input'));
  searchInputs.forEach(input => {
    const handler = (e) => {
      applyTemplateSearch(e.target.value);
    };
    input.addEventListener('input', handler);
    input.addEventListener('search', handler);
  });
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
  const chosenPopFont = S.style?.fontFamily || S.font || 'Poppins';
  ctx.font = `800 ${fs}px "${chosenPopFont}", "Poppins", sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Strip trailing punctuation from rendered words
  const cleanWords = words.map(w => {
    const raw = (w.t || w.word || '').trim();
    const caseMode = S.style?.textCase || S.textCase || 'upper';
    const clean = applyTextCase(raw.replace(/[.,/#!$%^&*;:{}=\-_`~()]+$/g, ''), caseMode);
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
  const activeBroll = (S.brolls || []).find(b => b.url && t >= b.start && t <= b.end);
  let brollEl = null;
  if (activeBroll) {
    brollEl = (typeof brollElements !== 'undefined' && brollElements[activeBroll.id]) ? brollElements[activeBroll.id] : $('brollVid');
  }

  // Draw full frame B-roll or original video (never crop into an occluding card/capsule)
  if (brollEl && brollEl.readyState && brollEl.readyState >= 2) {
    drawCoverVideo(ctx, brollEl, 0, 0, W, H);
  } else if (videoSource) {
    drawCoverVideo(ctx, videoSource, 0, 0, W, H);
  }

  // Title sticker centered at ~60%
  drawPopStickerCard(ctx, beat, t, W / 2, H * 0.60, u, W);

  // Subtitles / karaoke line at ~76%
  drawPopKaraokeSubtitles(ctx, beat, activeCap, t, W / 2, H * 0.76, u, W);
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
  // Always draw video full-frame (no occluding background gradient or cropped card)
  if (videoSource) {
    drawCoverVideo(ctx, videoSource, 0, 0, W, H);
  }

  // Title sticker centered at ~60%
  drawPopStickerCard(ctx, beat, t, W / 2, H * 0.60, u, W);

  // Karaoke line at ~76%
  drawPopKaraokeSubtitles(ctx, beat, activeCap, t, W / 2, H * 0.76, u, W);
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
  const alpha = 0.20 * (1 - Math.abs(progress - 0.5) * 2);

  ctx.save();
  ctx.fillStyle = `rgba(255, 255, 255, ${alpha.toFixed(3)})`;
  ctx.fillRect(0, 0, W, H);
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

    // Subtle bottom progress bar (optional, only if enabled)
    const totalDur = vid.duration || S.probe?.duration || 10;
    if (totalDur > 0 && S.progressBar && S.progressBar.enabled === true) {
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


// ============================================================================
// COMPACT VIDEO TEMPLATES ROW & ACCORDION (Rule 2) & DEBUG HELPER (Rule 7)
// ============================================================================

function initVideoTemplatesCompactUI() {
  const select = $('selectVideoTemplate');
  const badge = $('activeTemplateBadge');
  const btnSettings = $('btnToggleTemplateSettings');
  const accordion = $('vtemplateSettingsAccordion');
  const popSection = $('vtemplatePopStudioSection');
  const reSection = $('vtemplateRealEstateSection');

  const popToggle = $('togglePopStudio');
  const reToggle = $('toggleSpecialRealEstate');

  function updateCompactUI() {
    let active = 'none';
    if (popToggle && popToggle.checked) active = 'popStudio';
    else if (reToggle && reToggle.checked) active = 'specialRealEstate';

    if (select && select.value !== active) select.value = active;

    if (badge) {
      if (active === 'popStudio') {
        badge.textContent = 'Pop Studio';
        badge.style.background = '#8b5cf6';
        badge.style.color = '#ffffff';
      } else if (active === 'specialRealEstate') {
        badge.textContent = 'Real Estate';
        badge.style.background = '#eab308';
        badge.style.color = '#000000';
      } else {
        badge.textContent = 'Off';
        badge.style.background = 'rgba(255,255,255,0.1)';
        badge.style.color = '#94a3b8';
      }
    }

    if (popSection) popSection.classList.toggle('hidden', active !== 'popStudio');
    if (reSection) reSection.classList.toggle('hidden', active !== 'specialRealEstate');

    const fPop = $('featuredCardPopStudio');
    const fRe = $('featuredCardRealEstate');
    if (fPop) fPop.classList.toggle('active', active === 'popStudio');
    if (fRe) fRe.classList.toggle('active', active === 'specialRealEstate');
  }

  if (select) {
    select.addEventListener('change', () => {
      const val = select.value;
      if (val === 'popStudio') {
        if (reToggle && reToggle.checked) {
          reToggle.checked = false;
          reToggle.dispatchEvent(new Event('change'));
        }
        if (popToggle && !popToggle.checked) {
          popToggle.checked = true;
          popToggle.dispatchEvent(new Event('change'));
        }
      } else if (val === 'specialRealEstate') {
        if (popToggle && popToggle.checked) {
          popToggle.checked = false;
          popToggle.dispatchEvent(new Event('change'));
        }
        if (reToggle && !reToggle.checked) {
          reToggle.checked = true;
          reToggle.dispatchEvent(new Event('change'));
        }
      } else {
        if (popToggle && popToggle.checked) {
          popToggle.checked = false;
          popToggle.dispatchEvent(new Event('change'));
        }
        if (reToggle && reToggle.checked) {
          reToggle.checked = false;
          reToggle.dispatchEvent(new Event('change'));
        }
      }
      updateCompactUI();
    });
  }

  if (btnSettings && accordion) {
    btnSettings.addEventListener('click', (e) => {
      e.stopPropagation();
      accordion.classList.toggle('hidden');
      btnSettings.classList.toggle('active', !accordion.classList.contains('hidden'));
    });
  }

  const fPop = $('featuredCardPopStudio');
  if (fPop) {
    fPop.addEventListener('click', () => {
      if (select) {
        select.value = select.value === 'popStudio' ? 'none' : 'popStudio';
        select.dispatchEvent(new Event('change'));
      }
    });
  }

  const fRe = $('featuredCardRealEstate');
  if (fRe) {
    fRe.addEventListener('click', () => {
      if (select) {
        select.value = select.value === 'specialRealEstate' ? 'none' : 'specialRealEstate';
        select.dispatchEvent(new Event('change'));
      }
    });
  }

  const fDuo = $('featuredCardDuoPop');
  if (fDuo) {
    fDuo.addEventListener('click', () => {
      const presetId = fDuo.getAttribute('data-preset') || 'duo_sunset';
      const target = (S.presets || []).find(p => p.id === presetId || (p.id && p.id.includes('duo')));
      if (target) {
        applyPreset(target, false);
        $$('.preset-card').forEach(c => c.classList.toggle('active', c.getAttribute('data-id') === target.id));
        showToast(`⚡ ${target.name || 'Duo Pop'} active`);
      }
    });
  }

  if (popToggle) popToggle.addEventListener('change', updateCompactUI);
  if (reToggle) reToggle.addEventListener('change', updateCompactUI);

  updateCompactUI();
}

// Rule 7: Debug Helper for ?debug=1 URL flag
if (typeof window !== 'undefined' && window.location && window.location.search && window.location.search.includes('debug=1')) {
  let debugToastEl = null;
  document.addEventListener('pointerdown', (e) => {
    const target = document.elementFromPoint(e.clientX, e.clientY);
    if (!target) return;
    const tag = target.tagName ? target.tagName.toLowerCase() : '';
    const id = target.id ? `#${target.id}` : '';
    const cls = target.className && typeof target.className === 'string'
      ? `.${target.className.trim().split(/\s+/).slice(0, 3).join('.')}`
      : '';
    const info = `<${tag}${id}${cls}>`;
    if (!debugToastEl) {
      debugToastEl = document.createElement('div');
      debugToastEl.id = 'debugTapToast';
      debugToastEl.style.cssText = 'position:fixed;top:8px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.88);color:#4ade80;border:1px solid #22c55e;padding:4px 10px;border-radius:6px;font-size:11px;font-family:monospace;z-index:99999;pointer-events:none;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,0.6);';
      document.body.appendChild(debugToastEl);
    }
    debugToastEl.textContent = `Tap: ${info}`;
    debugToastEl.style.opacity = '1';
    clearTimeout(debugToastEl._timer);
    debugToastEl._timer = setTimeout(() => {
      if (debugToastEl) debugToastEl.style.opacity = '0';
    }, 2000);
  }, { capture: true, passive: true });
}


function initHeroLookUI() {
  const toggleGroup = $('heroLookToggleGroup');
  if (toggleGroup) {
    toggleGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-toggle[data-look]');
      if (!btn) return;
      const look = btn.getAttribute('data-look');
      if (look && typeof setHeroLook === 'function') setHeroLook(look);
    });
  }

  const chkLineByLine = $('chkLineByLine');
  if (chkLineByLine) {
    chkLineByLine.checked = S.lineByLine !== false;
    chkLineByLine.addEventListener('change', () => {
      S.lineByLine = chkLineByLine.checked;
      showToast('Line-by-line: ' + (S.lineByLine ? 'ON' : 'OFF'));
      renderCanvas(true);
    });
  }

  const dotBtns = Array.from(document.querySelectorAll('#realEstatePaletteDots .re-dot-btn'));
  dotBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      dotBtns.forEach(b => b.classList.toggle('active', b === btn));
      const color = btn.getAttribute('data-color') || 'auto';
      S.realEstateColorLock = color;
      if (S.style) S.style.lockedColor = color;
      const badge = $('valRealEstateColorBadge');
      if (badge) {
        const labels = { auto: 'AUTO ROTATION', teal: 'TEAL CYAN', purple: 'PURPLE VIOLET', pink: 'PINK MAGENTA', lime: 'LIME GREEN', sky: 'SKY BLUE', gold: 'GOLD AMBER' };
        badge.textContent = labels[color] || color.toUpperCase();
      }
      showToast('Real estate color: ' + color.toUpperCase());
      renderCanvas(true);
    });
  });

  if (typeof syncHeroLookUI === 'function') syncHeroLookUI();
}
// ==========================================================================
  // STEP 9: ?layout=1 DEBUG HELPER
  // ==========================================================================
  function setupLayoutDebugHelper() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('layout') !== '1') return;

      document.body.classList.add('debug-layout');

      const dvhSupported = typeof CSS !== 'undefined' && CSS.supports && CSS.supports('height', '100dvh');

      let badge = $('layoutDebugBadge');
      if (!badge) {
        badge = document.createElement('div');
        badge.id = 'layoutDebugBadge';
        document.body.appendChild(badge);
      }

      const updateBadge = () => {
        const eb = $('editorBody') || $('.editor-body');
        const sheetH = eb ? getComputedStyle(eb).getPropertyValue('--sheet-h').trim() : '0dvh';
        let sheetState = 'closed';
        if (drawerPanel && drawerPanel.classList.contains('fullscreen')) {
          sheetState = 'full';
        } else if (S.drawerOpen) {
          sheetState = 'half';
        }
        badge.textContent = `${window.innerWidth}x${window.innerHeight} | dvh: ${dvhSupported ? 'yes' : 'no'} | sheet: ${sheetState} (${sheetH}) | tab: ${S.activeTab || 'none'}`;
      };

      window.addEventListener('resize', updateBadge);
      setInterval(updateBadge, 500);
      updateBadge();

      // Tap inspector
      document.addEventListener('pointerdown', (e) => {
        const target = e.target;
        if (!target || target === badge) return;
        const comp = window.getComputedStyle(target);
        const zIdx = comp.zIndex;
        const tag = target.tagName.toLowerCase();
        const id = target.id ? `#${target.id}` : '';
        const cls = target.className && typeof target.className === 'string' ? `.${target.className.trim().split(/\s+/).join('.')}` : '';
        const info = `<${tag}${id}${cls}> z-index:${zIdx}`;
        console.log('[DEBUG LAYOUT TAP]', info, target);

        // Show 1-second toast
        const toast = $('toastNotification');
        if (toast) {
          toast.textContent = info;
          toast.classList.remove('hidden');
          toast.style.display = 'block';
          clearTimeout(toast._debugTimer);
          toast._debugTimer = setTimeout(() => {
            toast.classList.add('hidden');
            toast.style.display = 'none';
          }, 1000);
        }
      }, true);
    } catch (e) {
      console.error('[INIT]', 'layoutDebugHelper', e);
    }
  }



  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

// Global delegated click listener so quality buttons are 100% clickable anywhere
document.addEventListener('click', function(e) {
  var pill = e.target && e.target.closest ? e.target.closest('.btn-quality-pill') : null;
  if (pill) {
    var q = pill.getAttribute('data-quality');
    if (q && typeof setExportQuality === 'function') {
      setExportQuality(q);
    }
  }
}, true);
document.addEventListener('touchend', function(e) {
  var pill = e.target && e.target.closest ? e.target.closest('.btn-quality-pill') : null;
  if (pill) {
    var q = pill.getAttribute('data-quality');
    if (q && typeof setExportQuality === 'function') {
      setExportQuality(q);
    }
  }
}, true);
/* cs_delegated_quality */
