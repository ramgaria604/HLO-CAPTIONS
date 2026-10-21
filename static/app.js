/* ==========================================================================
   HLO CAPTIONS - CLIENT APPLICATION (v3.02)
   Timeline + Lowest-Part Tab Bar + Sliding Drawer + Template Generate
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
        const initial = S.presets.find(p => p.id === 'yellow_box' || p.id === 'box_pop') || S.presets[0];
        applyPreset(initial, false);
      }
      renderPresetsTab('all');
    } catch (e) {
      console.warn('Failed to load presets, using default:', e);
      applyPreset({
        id: 'yellow_box',
        name: 'Yellow Box Pop',
        highlightColor: '#FFE600',
        key: { font: 'Poppins', color: '#FFE600' },
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
    formData.append('video', file);
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
          S.probe = {
            width: res.width || 1080,
            height: res.height || 1920,
            fps: res.fps || 30,
            duration: res.duration || 0
          };

          uploadProgressBar.style.width = '50%';
          uploadPercent.textContent = '50%';
          uploadStatusText.textContent = 'Generating word-level captions with AI...';

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
      let payload = {
        filename: S.filename,
        language: lang,
        lang: lang,
        wordsPerCaption: 3,
        maxKeys: 1
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
        // Fallback placeholder so user can still edit and use templates!
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

        vid.src = '/work/' + S.filename;
        vid.load();
        setTimeout(() => showView('viewEditor'), 300);
        return;
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
      syncTimelinePlayhead();
    });

    vid.addEventListener('loadedmetadata', () => {
      timeDuration.textContent = formatTime(vid.duration || 0);
      timeScrub.max = vid.duration || 100;
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
    // Click or scrub on timeline
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

    // Draw ruler tick marks
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

    // Draw caption blocks
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

    // Highlight active timeline block
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
    // Bottom nav bar tabs
    $$('.bottom-nav-btn[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-tab');
        openDrawerTab(targetId);
      });
    });

    // Toggle Timeline button (collapses drawer to reveal full timeline)
    btnToggleTimeline.addEventListener('click', () => {
      toggleTimelineView();
    });

    // Close button on drawer header
    btnDrawerClose.addEventListener('click', () => {
      closeDrawer();
    });

    // Expand / Fullscreen button on drawer header
    btnDrawerExpand.addEventListener('click', () => {
      toggleDrawerFullscreen();
    });

    // Generate Button on Template
    btnGenerateTemplate.addEventListener('click', () => {
      triggerGenerateActiveTemplate();
    });

    // Category pills
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

    // Update bottom nav active state
    $$('.bottom-nav-btn').forEach(btn => {
      const tabAttr = btn.getAttribute('data-tab');
      btn.classList.toggle('active', tabAttr === targetId);
    });

    // Show corresponding tab pane
    $$('.tab-pane').forEach(p => p.classList.toggle('hidden', p.id !== targetId));

    // Update drawer header title
    const titles = {
      tabTemplates: '🎨 Choose Template',
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

    // Apply generation effect
    setTimeout(() => {
      btnGenerateTemplate.classList.remove('generating');
      btnGenerateTemplate.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
        <span>Generate with <strong id="selectedPresetName">${pName}</strong></span>
      `;
      showToast(`✨ Generated with ${pName}!`);
      renderCanvas();
      renderTimeline();

      // Start playing preview
      vid.play();
    }, 350);
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
      const card = createPresetCard(preset, false);
      presetsGrid.appendChild(card);
    });
  }

  function createPresetCard(preset, isModal) {
    const card = document.createElement('div');
    card.className = 'preset-card' + (S.style && S.style.id === preset.id ? ' active' : '');
    const color = preset.highlightColor || (preset.key && preset.key.color) || '#FFE600';
    const tag = preset.badge || (preset.category || 'POP').toUpperCase();

    let generateBtnHtml = '';
    if (isModal) {
      generateBtnHtml = `<button class="btn-card-generate">⚡ Generate</button>`;
    }

    card.innerHTML = `
      <span class="preset-badge-tag" style="background:${color}22; color:${color};">${tag}</span>
      <div class="preset-sample-text" style="color:${color}; font-family:'${preset.key?.font || 'Poppins'}', sans-serif;">
        VIRAL POP
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
      highlightColor: preset.highlightColor || '#FFE600',
      fontFamily: preset.key?.font || 'Poppins',
      textCase: S.style?.textCase || 'upper'
    });

    if (selectedPresetName) {
      selectedPresetName.textContent = preset.name || 'Template';
    }

    if (selectFont) {
      selectFont.value = S.style.fontFamily;
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
          word: w,
          start: cap.start + wIdx * dur,
          end: cap.start + (wIdx + 1) * dur
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
        { word: 'New', start: cur, end: cur + 0.6 },
        { word: 'caption', start: cur + 0.6, end: cur + 1.3 },
        { word: 'text', start: cur + 1.3, end: cur + 2.0 }
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
        renderCanvas();
      });
    });

    selectFont.addEventListener('change', (e) => {
      if (!S.style) S.style = {};
      S.style.fontFamily = e.target.value;
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

    drawCaptionOnCanvas(activeCap, t, w, h);
  }

  function drawCaptionOnCanvas(cap, t, w, h) {
    const st = S.style || {};
    const fontScale = (Number(st.fontScale) || 1.0);
    const fontName = st.fontFamily || (st.key && st.key.font) || 'Poppins';
    const isUpper = st.textCase !== 'normal';
    const highlightColor = st.highlightColor || (st.key && st.key.color) || '#FFE600';
    const normalColor = (st.filler && st.filler.color) || '#FFFFFF';

    const fontSize = Math.round(Math.min(w, h) * 0.08 * fontScale);
    ctx.font = `900 ${fontSize}px "${fontName}", sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    const words = cap.words && cap.words.length ? cap.words : [{ word: cap.text, start: cap.start, end: cap.end }];
    const posY = h * (typeof st.position === 'number' ? st.position : 0.75);

    const spaceWidth = ctx.measureText(' ').width;
    let totalLineWidth = 0;
    const wordMeasures = words.map(wObj => {
      const displayWord = isUpper ? wObj.word.toUpperCase() : wObj.word;
      const m = ctx.measureText(displayWord);
      totalLineWidth += m.width;
      return { word: displayWord, width: m.width, start: wObj.start, end: wObj.end };
    });
    totalLineWidth += spaceWidth * (words.length - 1);

    let curX = (w - totalLineWidth) / 2;

    wordMeasures.forEach((wItem) => {
      const isActive = t >= wItem.start && t <= wItem.end;
      const wordCenterX = curX + wItem.width / 2;

      ctx.save();

      if (isActive) {
        const progress = Math.min(1, Math.max(0, (t - wItem.start) / Math.max(0.01, (wItem.end - wItem.start))));
        const scale = 1.0 + Math.sin(progress * Math.PI) * 0.12;

        ctx.translate(wordCenterX, posY);
        ctx.scale(scale, scale);
        ctx.translate(-wordCenterX, -posY);

        if (st.id && (st.id.includes('box') || st.id.includes('yellow') || st.pill)) {
          const padX = 8;
          const padY = 4;
          ctx.fillStyle = highlightColor;
          ctx.beginPath();
          ctx.roundRect(curX - padX, posY - fontSize / 2 - padY, wItem.width + padX * 2, fontSize + padY * 2, 6);
          ctx.fill();

          ctx.fillStyle = '#000000';
          ctx.fillText(wItem.word, wordCenterX, posY);
        } else {
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

    exportPreviewVideo.src = '/work/' + filename;
    exportPreviewVideo.load();
  }

  function showExportError(msg) {
    exportWorkingState.classList.add('hidden');
    exportErrorState.classList.remove('hidden');
    exportErrorMessage.textContent = msg;
  }

  window.addEventListener('DOMContentLoaded', init);

})();
