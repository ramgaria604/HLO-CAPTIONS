/* ==========================================================================
   HLO CAPTIONS - CLIENT APPLICATION (v3.00)
   Clean, intuitive, high-performance editor with live canvas captions & instant presets
   ========================================================================== */

(function () {
  'use strict';

  // --- Helpers ---
  const $ = (id) => document.getElementById(id);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  // --- Global State ---
  const S = {
    file: null,
    filename: '',
    probe: { width: 1080, height: 1920, fps: 30, duration: 0 },
    captions: [],
    presets: [],
    style: null,
    activeTab: 'tabTemplates',
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

  // Tabs
  const presetsGrid = $('presetsGrid');
  const captionsList = $('captionsList');
  const captionCountBadge = $('captionCountBadge');
  const btnAddCaption = $('btnAddCaption');
  const btnSyncScriptModal = $('btnSyncScriptModal');
  const btnOpenFullTemplates = $('btnOpenFullTemplates');

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

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================
  async function init() {
    setupUploadHandlers();
    setupTransportHandlers();
    setupTabHandlers();
    setupStyleHandlers();
    setupAudioHandlers();
    setupModalHandlers();
    setupCanvasSizing();

    await loadPresets();
  }

  // ==========================================================================
  // LOAD PRESETS FROM SERVER
  // ==========================================================================
  async function loadPresets() {
    try {
      const res = await fetch('/api/presets');
      const data = await res.json();
      S.presets = data.presets || [];
      if (S.presets.length > 0) {
        // Find a top viral preset or default
        S.style = S.presets.find(p => p.id === 'yellow_box' || p.id === 'box_pop') || S.presets[0];
      }
      renderPresetsTab('all');
    } catch (e) {
      console.warn('Failed to load presets, using default:', e);
      S.style = {
        id: 'yellow_box',
        name: 'Yellow Box Pop',
        highlightColor: '#FFE600',
        key: { font: 'Poppins', color: '#FFE600' },
        filler: { font: 'Poppins', color: '#FFFFFF' },
        position: 0.75,
        fontScale: 1.0,
      };
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
      renderCaptionsList();
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
    btnSelectFile.addEventListener('click', () => fileInput.click());

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

    uploadError.classList.add('hidden');
    uploadProgressBox.classList.remove('hidden');
    uploadProgressBar.style.width = '5%';
    uploadPercent.textContent = '5%';
    uploadStatusText.textContent = 'Uploading video...';

    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload', true);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 45); // Upload accounts for 45%
        uploadProgressBar.style.width = pct + '%';
        uploadPercent.textContent = pct + '%';
      }
    };

    xhr.onload = async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          S.filename = res.filename;
          S.probe = res.probe || S.probe;

          uploadProgressBar.style.width = '50%';
          uploadPercent.textContent = '50%';
          uploadStatusText.textContent = 'Generating word-level captions with AI...';

          await startTranscription();
        } catch (err) {
          showUploadError('Error processing video upload: ' + err.message);
        }
      } else {
        showUploadError('Upload failed: ' + (xhr.responseText || xhr.statusText));
      }
    };

    xhr.onerror = () => showUploadError('Upload failed. Check your internet connection.');
    xhr.send(formData);
  }

  async function startTranscription() {
    const lang = langSelect.value;
    const pastedScript = scriptInput.value.trim();

    // Progress simulation during transcription
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
      let payload = { filename: S.filename, lang: lang };

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
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || ('Transcription error: ' + res.statusText));
      }

      const data = await res.json();
      uploadProgressBar.style.width = '100%';
      uploadPercent.textContent = '100%';
      uploadStatusText.textContent = 'Captions generated successfully!';

      // Process captions
      S.captions = normalizeCaptions(data.captions || []);

      // Setup video playback
      vid.src = '/work/' + S.filename;
      vid.load();

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
        // Fallback: estimate word timings if missing
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
          word: Array.isArray(w) ? w[2] : (w.word || w.t || ''),
          start: parseFloat(Array.isArray(w) ? w[0] : (w.start || 0)),
          end: parseFloat(Array.isArray(w) ? w[1] : (w.end || 0))
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
    });

    vid.addEventListener('loadedmetadata', () => {
      timeDuration.textContent = formatTime(vid.duration || 0);
      timeScrub.max = vid.duration || 100;
      fitCanvas();
      renderCanvas();
    });

    timeScrub.addEventListener('input', (e) => {
      vid.currentTime = parseFloat(e.target.value);
      renderCanvas();
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
  }

  function formatTime(sec) {
    if (isNaN(sec) || sec < 0) sec = 0;
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
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
  // CANVAS SIZING & RENDERING LOOP
  // ==========================================================================
  function setupCanvasSizing() {
    window.addEventListener('resize', fitCanvas);
    document.addEventListener('fullscreenchange', fitCanvas);
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
    // Find active caption
    const activeCap = S.captions.find(c => t >= c.start && t <= c.end);
    if (!activeCap) return;

    drawCaptionOnCanvas(activeCap, t, w, h);
  }

  function drawCaptionOnCanvas(cap, t, w, h) {
    const st = S.style || {};
    const fontScale = (Number(st.fontScale) || 1.0);
    const fontName = st.fontFamily || (st.key && st.key.font) || 'Poppins';
    const isUpper = st.textCase !== 'normal';
    const highlightColor = st.highlightColor || (st.key && st.key.color) || '#FFE600';
    const normalColor = (st.filler && st.filler.color) || '#FFFFFF';

    // Base font size scaled to stage height
    const fontSize = Math.round(Math.min(w, h) * 0.08 * fontScale);
    ctx.font = `900 ${fontSize}px "${fontName}", sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    const words = cap.words && cap.words.length ? cap.words : [{ word: cap.text, start: cap.start, end: cap.end }];
    
    // Position on screen
    const posY = h * (typeof st.position === 'number' ? st.position : 0.75);

    // Measure total width of line
    const spaceWidth = ctx.measureText(' ').width;
    let totalLineWidth = 0;
    const wordMeasures = words.map(wObj => {
      const displayWord = isUpper ? wObj.word.toUpperCase() : wObj.word;
      const m = ctx.measureText(displayWord);
      totalLineWidth += m.width;
      return { word: displayWord, width: m.width, start: wObj.start, end: wObj.end };
    });
    totalLineWidth += spaceWidth * (words.length - 1);

    // Starting X to center the line
    let curX = (w - totalLineWidth) / 2;

    wordMeasures.forEach((wItem) => {
      const isActive = t >= wItem.start && t <= wItem.end;
      const wordCenterX = curX + wItem.width / 2;

      ctx.save();

      if (isActive) {
        // Active word animation / pop
        const progress = Math.min(1, Math.max(0, (t - wItem.start) / Math.max(0.01, (wItem.end - wItem.start))));
        const scale = 1.0 + Math.sin(progress * Math.PI) * 0.12;

        ctx.translate(wordCenterX, posY);
        ctx.scale(scale, scale);
        ctx.translate(-wordCenterX, -posY);

        // Highlight Box if preset has pill/box
        if (st.id && (st.id.includes('box') || st.id.includes('yellow') || st.pill)) {
          const padX = 8;
          const padY = 4;
          ctx.fillStyle = highlightColor;
          ctx.beginPath();
          ctx.roundRect(curX - padX, posY - fontSize / 2 - padY, wItem.width + padX * 2, fontSize + padY * 2, 6);
          ctx.fill();

          // Black text inside yellow/bright box
          ctx.fillStyle = '#000000';
          ctx.fillText(wItem.word, wordCenterX, posY);
        } else {
          // Glow and Stroke
          ctx.shadowColor = highlightColor;
          ctx.shadowBlur = 14;
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = Math.max(3, fontSize * 0.12);
          ctx.lineJoin = 'round';
          ctx.strokeText(wItem.word, wordCenterX, posY);

          ctx.fillStyle = highlightColor;
          ctx.fillText(wItem.word, wordCenterX, posY);
        }
      } else {
        // Inactive words
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 6;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = Math.max(2, fontSize * 0.1);
        ctx.lineJoin = 'round';
        ctx.strokeText(wItem.word, wordCenterX, posY);

        ctx.fillStyle = normalColor;
        ctx.fillText(wItem.word, wordCenterX, posY);
      }

      ctx.restore();
      curX += wItem.width + spaceWidth;
    });
  }

  // ==========================================================================
  // TABS NAVIGATION & CONTENT
  // ==========================================================================
  function setupTabHandlers() {
    $$('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-tab');
        $$('.tab-btn').forEach(b => b.classList.toggle('active', b === btn));
        $$('.tab-pane').forEach(p => p.classList.toggle('hidden', p.id !== targetId));
        S.activeTab = targetId;

        if (targetId === 'tabCaptions') {
          renderCaptionsList();
        }
      });
    });

    // Preset category filter pills
    $$('#categoryPills .cat-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        $$('#categoryPills .cat-pill').forEach(p => p.classList.toggle('active', p === pill));
        renderPresetsTab(pill.getAttribute('data-cat'));
      });
    });
  }

  // ==========================================================================
  // TAB 1: PRESETS / TEMPLATES
  // ==========================================================================
  function renderPresetsTab(filterCat) {
    presetsGrid.innerHTML = '';
    const filtered = filterCat === 'all' 
      ? S.presets 
      : S.presets.filter(p => {
          const cat = (p.category || '').toLowerCase();
          const name = (p.name || '').toLowerCase();
          if (filterCat === 'viral') return cat.includes('viral') || name.includes('viral') || name.includes('pop');
          if (filterCat === 'neon') return cat.includes('neon') || name.includes('neon') || name.includes('glow');
          if (filterCat === 'box') return name.includes('box') || cat.includes('box');
          if (filterCat === 'minimal') return cat.includes('minimal') || name.includes('clean') || name.includes('sub');
          return true;
        });

    filtered.slice(0, 40).forEach(preset => {
      const card = createPresetCard(preset);
      presetsGrid.appendChild(card);
    });
  }

  function createPresetCard(preset) {
    const card = document.createElement('div');
    card.className = 'preset-card' + (S.style && S.style.id === preset.id ? ' active' : '');
    const color = preset.highlightColor || (preset.key && preset.key.color) || '#FFE600';
    const tag = preset.badge || (preset.category || 'POP').toUpperCase();

    card.innerHTML = `
      <span class="preset-badge-tag" style="background:${color}22; color:${color};">${tag}</span>
      <div class="preset-sample-text" style="color:${color}; font-family:'${preset.key?.font || 'Poppins'}', sans-serif;">
        VIRAL POP
      </div>
      <span class="preset-name">${preset.name || 'Template'}</span>
    `;

    card.addEventListener('click', () => {
      applyPreset(preset);
      $$('.preset-card').forEach(c => c.classList.toggle('active', c === card));
    });

    return card;
  }

  function applyPreset(preset) {
    // Preserve custom tweaks while applying preset base
    S.style = Object.assign({}, preset, {
      fontScale: S.style?.fontScale || 1.0,
      position: S.style?.position !== undefined ? S.style.position : (preset.position || 0.75),
      highlightColor: preset.highlightColor || '#FFE600',
      fontFamily: preset.key?.font || 'Poppins',
      textCase: S.style?.textCase || 'upper'
    });

    // Sync style controls
    selectFont.value = S.style.fontFamily;
    renderCanvas();
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

      // Jump video
      row.querySelector('.caption-play-btn').addEventListener('click', () => {
        vid.currentTime = cap.start + 0.05;
        vid.play();
      });

      // Text edit
      const textarea = row.querySelector('.caption-text-input');
      textarea.addEventListener('input', (e) => {
        cap.text = e.target.value;
        const words = cap.text.split(/\s+/).filter(Boolean);
        const dur = (cap.end - cap.start) / Math.max(words.length, 1);
        cap.words = words.map((w, wIdx) => ({
          word: w,
          start: cap.start + wIdx * dur,
          end: cap.start + (wIdx + 1) * dur
        }));
        renderCanvas();
      });

      // Delete
      row.querySelector('.caption-delete-btn').addEventListener('click', () => {
        S.captions.splice(idx, 1);
        renderCaptionsList();
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
        { word: 'New', start: cur, end: cur + 0.6 },
        { word: 'caption', start: cur + 0.6, end: cur + 1.3 },
        { word: 'text', start: cur + 1.3, end: cur + 2.0 }
      ]
    };
    S.captions.push(newCap);
    S.captions.sort((a, b) => a.start - b.start);
    renderCaptionsList();
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

    // Position buttons
    $$('#posButtonGroup .btn-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('#posButtonGroup .btn-toggle').forEach(b => b.classList.toggle('active', b === btn));
        if (!S.style) S.style = {};
        S.style.position = parseFloat(btn.getAttribute('data-pos'));
        renderCanvas();
      });
    });

    // Color Swatches
    $$('#colorSwatches .swatch').forEach(swatch => {
      swatch.addEventListener('click', () => {
        $$('#colorSwatches .swatch').forEach(s => s.classList.toggle('active', s === swatch));
        const color = swatch.getAttribute('data-color');
        if (!S.style) S.style = {};
        S.style.highlightColor = color;
        renderCanvas();
      });
    });

    // Font Select
    selectFont.addEventListener('change', (e) => {
      if (!S.style) S.style = {};
      S.style.fontFamily = e.target.value;
      renderCanvas();
    });

    // Text Case
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
  // MODALS HANDLERS (FULL TEMPLATES, SCRIPT SYNC, EXPORT)
  // ==========================================================================
  function setupModalHandlers() {
    // 1. Full Templates Browser Modal
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

    // 2. Script Sync Modal
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
          renderCanvas();
        }
        modalScript.classList.add('hidden');
      } catch (e) {
        alert('Script sync error: ' + e.message);
      } finally {
        btnApplyScript.disabled = false;
        btnApplyScript.textContent = 'Apply & Sync Script';
      }
    });

    // 3. Export Modal
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
      const card = createPresetCard(preset);
      card.addEventListener('click', () => {
        applyPreset(preset);
        modalTemplates.classList.add('hidden');
        renderPresetsTab('all');
      });
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

      // Start polling status
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

    // Direct preview in browser
    exportPreviewVideo.src = '/work/' + filename;
    exportPreviewVideo.load();
  }

  function showExportError(msg) {
    exportWorkingState.classList.add('hidden');
    exportErrorState.classList.remove('hidden');
    exportErrorMessage.textContent = msg;
  }

  // Run on startup
  window.addEventListener('DOMContentLoaded', init);

})();
