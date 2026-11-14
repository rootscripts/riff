
'use strict';

var pluginsCache = window.pluginsCache || [];
window.pluginsCache = pluginsCache;
var activeShortcuts = window.activeShortcuts || null;
window.activeShortcuts = activeShortcuts;
var currentWaveFocusedIndex = window.currentWaveFocusedIndex || 0;
window.currentWaveFocusedIndex = currentWaveFocusedIndex;
var currentAudioOutputDeviceId = window.currentAudioOutputDeviceId || 'default';
window.currentAudioOutputDeviceId = currentAudioOutputDeviceId;
var trackToDownload = window.trackToDownload || null;
window.trackToDownload = trackToDownload;
var trimDraft = window.trimDraft || null;
window.trimDraft = trimDraft;
var customThemes = window.customThemes || [];
window.customThemes = customThemes;

  var LiquidMotion = {
    setAnchor(element, triggerEl, axis = 'x') {
      if (!element) return;
      if (triggerEl) {
        const rect = triggerEl.getBoundingClientRect();
        const parentRect = element.parentElement ? element.parentElement.getBoundingClientRect() : { top: 0, left: 0 };
        if (axis === 'x') {
          const anchorY = (rect.top + rect.height / 2) - parentRect.top;
          element.style.setProperty('--liquid-anchor-y', `${anchorY}px`);
          element.style.setProperty('--liquid-anchor-x', '0px');
          element.style.transformOrigin = `0px ${anchorY}px`;
        } else {
          const anchorX = (rect.left + rect.width / 2) - parentRect.left;
          element.style.setProperty('--liquid-anchor-x', `${anchorX}px`);
          element.style.setProperty('--liquid-anchor-y', '0px');
          element.style.transformOrigin = `${anchorX}px 0px`;
        }
      } else {
        if (axis === 'x') {
          element.style.setProperty('--liquid-anchor-y', '50%');
          element.style.setProperty('--liquid-anchor-x', '0px');
          element.style.transformOrigin = '0px 50%';
        } else {
          element.style.setProperty('--liquid-anchor-x', '50%');
          element.style.setProperty('--liquid-anchor-y', '0px');
          element.style.transformOrigin = '50% 0px';
        }
      }
    },
    open(element, triggerEl, axis = 'x', onDone) {
      if (!element) return;
      this.setAnchor(element, triggerEl, axis);
      element.classList.remove('liquid-closing');
      element.classList.add('liquid-surface', `liquid-${axis}`, 'liquid-open');
      if (onDone) setTimeout(onDone, 480);
    },
    close(element, onDone) {
      if (!element) return;
      element.classList.add('liquid-closing');
      element.classList.remove('liquid-open');
      setTimeout(() => {
        element.classList.remove('liquid-closing', 'liquid-open');
        if (onDone) onDone();
      }, 300);
    }
  };
  window.LiquidMotion = LiquidMotion;



  function injectM3Shapes() {
    const defs = document.getElementById('m3-dynamic-defs');
    if (!defs) return;

    const formulas = {
      'm3-cookie-4': (a) => 40 + 6 * Math.cos(4 * a),
      'm3-cookie-8': (a) => 42 + 4 * Math.cos(8 * a),
      'm3-diamond-puffy': (a) => 36 + 10 * Math.cos(4 * a),
      'm3-flower': (a) => 28 + 18 * Math.abs(Math.cos(4 * a)),
      'm3-poly-6': (a) => {
        let t = a % (2 * Math.PI / 6);
        if (t < 0) t += 2 * Math.PI / 6;
        return 36 / Math.cos(t - Math.PI / 6);
      },
      'm3-leaf-4': (a) => 40 + 6 * Math.cos(4 * a)
    };

    let html = '';
    for (const [id, formula] of Object.entries(formulas)) {
      let path = '';
      const res = 120;
      for (let i = 0; i <= res; i++) {
        const angle = (i / res) * 2 * Math.PI;
        const r = formula(angle);
        const x = 0.5 + (r * Math.cos(angle)) / 100;
        const y = 0.5 + (r * Math.sin(angle)) / 100;
        path += `${i === 0 ? 'M' : 'L'} ${x.toFixed(4)},${y.toFixed(4)} `;
      }
      path += 'Z';
      html += `<clipPath id="${id}" clipPathUnits="objectBoundingBox"><path d="${path}" /></clipPath>`;
    }
    if (!defs.querySelector('#m3-hero-shape')) {
      html += '<clipPath id="m3-hero-shape" clipPathUnits="objectBoundingBox"><path id="m3-hero-shape-path" d=""/></clipPath>';
    }
    defs.insertAdjacentHTML('beforeend', html);
  }
  injectM3Shapes();


  var savedScale = parseFloat(localStorage.getItem('devsize_ui_scale') || '105');
  applyScale(savedScale);

  function applyScale(scalePercent) {
    const factor = (scalePercent / 100) * 0.90;
    document.documentElement.style.setProperty('--app-scale', factor.toString());
    if (window.electronAPI && window.electronAPI.setZoomFactor) {
      window.electronAPI.setZoomFactor(factor);
    } else {
      document.body.style.zoom = factor;
    }
  }

  window.addEventListener('scroll', () => {
    if (window.scrollY !== 0 || window.scrollX !== 0) {
      window.scrollTo(0, 0);
    }
  }, { passive: true });


  var SF_FONT_STACK = `-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", sans-serif`;

  function ensureSfFontLoaded() {
    if (!document.getElementById('font-sf-pro')) {
      const link = document.createElement('link');
      link.id = 'font-sf-pro';
      link.rel = 'stylesheet';
      link.href = 'https://fonts.cdnfonts.com/css/sf-pro-display';
      document.head.appendChild(link);
    }
  }

  function ensureInterFontLoaded() {
    if (!document.getElementById('font-inter')) {
      const link = document.createElement('link');
      link.id = 'font-inter';
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap';
      document.head.appendChild(link);
    }
  }

  function applyFont(font) {
    const f = (typeof font === 'string' && font) ? font : (localStorage.getItem('riff_font') || 'google');
    if (typeof state !== 'undefined' && state) {
      state.riffFont = f;
    }
    if (f === 'inter') {
      ensureInterFontLoaded();
      document.documentElement.style.setProperty('--font-family', "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif");
    } else if (f === 'sf') {
      ensureSfFontLoaded();
      document.documentElement.style.setProperty('--font-family', SF_FONT_STACK);
    } else if (f === 'system') {
      document.documentElement.style.setProperty('--font-family', 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif');
    } else {
      document.documentElement.style.removeProperty('--font-family');
    }
    const fontOptGoogle = document.getElementById('font-opt-google');
    const fontOptSf = document.getElementById('font-opt-sf');
    const fontOptSystem = document.getElementById('font-opt-system');
    const fontOptInter = document.getElementById('font-opt-inter');
    if (fontOptGoogle) fontOptGoogle.classList.toggle('active', f === 'google');
    if (fontOptSf) fontOptSf.classList.toggle('active', f === 'sf');
    if (fontOptSystem) fontOptSystem.classList.toggle('active', f === 'system');
    if (fontOptInter) fontOptInter.classList.toggle('active', f === 'inter');
  }

  Object.assign(state, {
    selectedTracks: new Map(),
    lastClickedTrackRow: null,
    platform: localStorage.getItem('riff_platform') || 'ytmusic',
    currentView: 'discover',
    previousView: 'discover',
    currentPlaylistId: null,
    currentArtistData: null,
    searchQuery: '',
    searchResults: [],
    queue: [],
    queueIndex: -1,
    queueHistory: [],
    currentTrack: null,
    currentTrackContext: null,
    currentTrackIndexInContext: -1,
    isPlaying: false,
    toolsReady: false,
    isMuted: localStorage.getItem('riff_muted') === '1',
    volume: savedVolume,
    isRepeat: localStorage.getItem('riff_repeat') === '1',
    isShuffle: localStorage.getItem('riff_shuffle') === '1',
    isAutoRemix: false,
    myWaveActive: false,
    isRadioQueue: false,
    _waveReplenishBusy: false,
    vibeTracks: (Array.isArray(state.vibeTracks) && state.vibeTracks.length > 0) ? state.vibeTracks : [],
    _isNaturalEnding: false,
    _skipRecordedFor: null,
    isRightPanelOpen: true,
    lyricsMode: 'word',
    uiScale: savedScale,
    activePresetId: soundPersistenceEnabled ? (localStorage.getItem('riff_active_preset') || 'p_default') : 'p_default',
    themeMode: ['light', 'dark', 'auto'].includes(localStorage.getItem('riff_theme_mode')) ? localStorage.getItem('riff_theme_mode') : 'dark',
    paletteStyle: localStorage.getItem('riff_palette_style') || 'classic',
    meshBrightness: parseInt(localStorage.getItem('riff_mesh_brightness') || '100', 10),
    themeAccent: localStorage.getItem('riff_theme_accent') || '#5247d1',
    themeIntensity: parseInt(localStorage.getItem('riff_theme_intensity') || '85', 10),
    themeBrightness: parseInt(localStorage.getItem('riff_theme_brightness') || '20', 10),
    monoBrightness: parseInt(localStorage.getItem('riff_theme_mono_brightness') || '100', 10),
    trEnabled: localStorage.getItem('riff_tr_enabled') === 'true',
    trLang: localStorage.getItem('riff_tr_lang') || 'en',
    lyricsTranslationLang: localStorage.getItem('riff_tr_lang') || 'en',
    trAuto: localStorage.getItem('riff_tr_auto') === 'true',
    trActive: false,
    currentTranslations: null,
    isTvKaraokeOpen: false,
    tvkFg: '#ffffff',
                          audioSettings: savedSound.audioSettings,
                          hqEnabled: savedSound.hqEnabled,
                          hqSettings: savedSound.hqSettings,
                          vfx: { ...defaultVfx, ...safeJson('devsize_vfx', {}), bassPulse: false, particles: false, soundwaveRings: false, borderGlow: false, backdropBlur: false, crt: false, grain: false, lyricsSpotlight: false },
                          favorites: safeArray('devsize_favorites'),
                          history: safeArray('devsize_history'),
                          playlists: safeArray('devsize_playlists'),
                          customPresets: normalizedCustomPresets,
                          localTracks: (safeArray('riff_local_tracks').length > 0 ? safeArray('riff_local_tracks') : safeArray('devsize_local_tracks')).filter(t => {
                            const b = safeJson('riff_removed_local_paths', []);
                            const p = String(t?.path || t?.filePath || t?.url || '');
                            const id = String(t?.id || '');
                            return (!p || !b.includes(p)) && (!id || !b.includes(id));
                          }),
                          localFiles: (safeArray('riff_local_files').length > 0 ? safeArray('riff_local_files') : safeArray('devsize_local_files')).filter(t => {
                            const b = safeJson('riff_removed_local_paths', []);
                            const p = String(t?.path || t?.filePath || t?.url || '');
                            const id = String(t?.id || '');
                            return (!p || !b.includes(p)) && (!id || !b.includes(id));
                          }),
                          syncedLyrics: [],
                          glitchTimes: [],
                          lastGlitchedIndex: -1,
                          isGlitching: false,
                          isWindowVisible: true,
                          loadToken: 0,
                          isLoadingLyrics: false,
                          lyricsLoaded: false,
                          audioDurationStale: false,
                          currentAbortController: null,
                          presetToRenameId: null,
                          serverPort: 38472,
                          discordRpcEnabled: safeJson('devsize_discord_rpc', true),
                          lastBroadcastStateKey: null,
                          syncTimeout: null,
                          scrubberDragTargetTime: undefined,
                          riffFont: localStorage.getItem('riff_font') || 'google'
  });


  if (el.nativeAudio) el.nativeAudio.preload = 'auto';

  if (el.viewSettings) {
    document.body.appendChild(el.viewSettings);
    const sv = el.viewSettings.querySelector('.settings-view');
    if (sv && !document.getElementById('btn-close-settings-modal')) {
      const closeWrap = document.createElement('button');
      closeWrap.type = 'button';
      closeWrap.id = 'btn-close-settings-modal';
      closeWrap.className = 'settings-modal-close-btn';
      closeWrap.title = 'Close Settings (Esc)';
      closeWrap.innerHTML = `<span class="settings-close-circle"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></span><span class="settings-close-esc">ESC</span>`;
      closeWrap.addEventListener('click', () => closeSettingsModal());
      sv.appendChild(closeWrap);
    }
    el.viewSettings.addEventListener('mousedown', (e) => {
      if (e.target === el.viewSettings) closeSettingsModal();
    });
  }



  var savedFontScale = localStorage.getItem('riff_font_scale') || '100';
  var fontVal = parseInt(savedFontScale, 10) || 100;
  if (el.sliderFontScale) el.sliderFontScale.value = fontVal.toString();
  if (el.valFontScale) el.valFontScale.textContent = `${fontVal}%`;
  document.documentElement.style.setProperty('--font-scale', ((fontVal / 100) * 0.95 * 1.25).toString());

  var savedRadius = localStorage.getItem('riff_corner_radius') || '16';
  if (el.sliderCornerRadius) el.sliderCornerRadius.value = savedRadius;
  if (el.valCornerRadius) el.valCornerRadius.textContent = savedRadius === '16' ? 'Default' : `${savedRadius}px`;
  document.documentElement.style.setProperty('--md-shape-corner-l', `${savedRadius}px`);
  document.documentElement.style.setProperty('--md-shape-corner-m', `${Math.max(0, parseInt(savedRadius) - 4)}px`);

  function isLyricsFullscreenOnly() {
    return localStorage.getItem('riff_lyrics_fullscreen_only') !== '0';
  }
  window.isLyricsFullscreenOnly = isLyricsFullscreenOnly;
  document.body.classList.toggle('lyrics-fullscreen-only', isLyricsFullscreenOnly());

  applyReducedMotionSetting();
  document.body.classList.toggle('hide-titlebar', !!getAdv('hide_titlebar', false));
  document.body.classList.toggle('keep-bar-timestamps', !getAdv('autohide_timestamps', true));
  document.body.classList.toggle('classic-sidebar', !!getAdv('classic_sidebar', false));
  document.body.classList.toggle('classic-track-rows', localStorage.getItem('riff_classic_track_rows') === '1');
  document.body.classList.toggle('hide-sp-table-cols', localStorage.getItem('riff_sp_table_cols') === '0');
  document.body.classList.toggle('show-source-logo', localStorage.getItem('riff_show_source_logo') === '1');
  document.body.classList.toggle('art-font-on', localStorage.getItem('riff_art_font') !== '0');
  var npAlignInit = localStorage.getItem('riff_np_align') || 'left';
  document.body.classList.toggle('np-align-left', npAlignInit === 'left');
  document.body.classList.toggle('np-align-center', npAlignInit === 'center');
  document.body.classList.toggle('track-rows-compact', localStorage.getItem('riff_track_row_style') === 'compact');


  var titlebarRevealHideTimer = null;
  var pointerY = Infinity;
  var titlebar = document.querySelector('.titlebar');
  var clearTitlebarRevealHideTimer = () => {
    if (titlebarRevealHideTimer) {
      clearTimeout(titlebarRevealHideTimer);
      titlebarRevealHideTimer = null;
    }
  };
  var scheduleTitlebarRevealHide = (delay = 350) => {
    clearTitlebarRevealHideTimer();
    titlebarRevealHideTimer = setTimeout(() => {
      titlebarRevealHideTimer = null;
      if (pointerY > 48 || pointerY === Infinity) {
        document.body.classList.remove('titlebar-reveal');
      }
    }, delay);
  };
  window.addEventListener('pointermove', (event) => {
    pointerY = event.clientY;
    if (!document.body.classList.contains('hide-titlebar')) {
      document.body.classList.remove('titlebar-reveal');
      clearTitlebarRevealHideTimer();
      return;
    }
    if (pointerY <= 16) {
      clearTitlebarRevealHideTimer();
      document.body.classList.add('titlebar-reveal');
    } else if (document.body.classList.contains('titlebar-reveal')) {
      if (pointerY <= 48) {
        clearTitlebarRevealHideTimer();
      } else if (!titlebarRevealHideTimer) {
        scheduleTitlebarRevealHide(350);
      }
    }
  });
  if (titlebar) {
    titlebar.addEventListener('pointerenter', clearTitlebarRevealHideTimer);
    titlebar.addEventListener('pointermove', clearTitlebarRevealHideTimer);
    titlebar.addEventListener('pointerleave', (event) => {
      if (document.body.classList.contains('hide-titlebar') && event.clientY > 40) {
        scheduleTitlebarRevealHide(350);
      }
    });
  }
  document.addEventListener('mouseleave', (event) => {
    if (!document.body.classList.contains('hide-titlebar')) return;
    if (event.clientY > 0 && event.clientY <= 48) {
      return;
    }
    pointerY = Infinity;
    scheduleTitlebarRevealHide(600);
  });
  window.addEventListener('blur', () => {
    if (!document.body.classList.contains('hide-titlebar')) return;
    pointerY = Infinity;
    scheduleTitlebarRevealHide(200);
  });

  if (window.electronAPI && window.electronAPI.platform === 'darwin' && window.electronAPI.setWindowButtonsVisible) {
    let macButtonsVisible = null;
    const syncMacWindowButtons = () => {
      const cls = document.body.classList;
      const visible = !cls.contains('hide-titlebar') || cls.contains('titlebar-reveal');
      if (visible === macButtonsVisible) return;
      macButtonsVisible = visible;
      window.electronAPI.setWindowButtonsVisible(visible);
    };
    new MutationObserver(syncMacWindowButtons).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    syncMacWindowButtons();
  }


  var railDrawer = document.getElementById('rail-drawer');
  var sidebarEl = document.querySelector('.sidebar');
  var btnTogglePresets = document.getElementById('btn-toggle-presets-drawer');
  var btnTogglePlaylists = document.getElementById('btn-toggle-playlists-drawer');
  var btnCloseDrawer = document.getElementById('btn-close-rail-drawer');
  var sectionPresets = document.getElementById('drawer-section-presets');
  var sectionPlaylists = document.getElementById('drawer-section-playlists');
  var drawerTitle = document.getElementById('rail-drawer-title');

  var openDrawerState = null;
  var activeDrawerMode = null;
  var railDrawerCloseTimeout = null;

  function applyDrawerState(triggerBtn) {
    if (!railDrawer) return;

    const btnSbP = document.getElementById('btn-sb-presets');
    if (btnSbP) btnSbP.classList.toggle('active', openDrawerState === 'presets');

    if (!openDrawerState) {
      if (activeDrawerMode !== null) {
        if (sidebarEl) sidebarEl.classList.remove('has-drawer-open');
        if (btnTogglePresets) btnTogglePresets.classList.remove('active');
        if (btnTogglePlaylists) btnTogglePlaylists.classList.remove('active');
        activeDrawerMode = null;
        if (railDrawerCloseTimeout) {
          clearTimeout(railDrawerCloseTimeout);
          railDrawerCloseTimeout = null;
        }
        railDrawer.classList.remove('open');
        railDrawerCloseTimeout = setTimeout(() => {
          railDrawer.classList.add('hidden');
          railDrawerCloseTimeout = null;
        }, 200);
      }
    } else {
      const isPresets = openDrawerState === 'presets';
      const trigger = triggerBtn || (isPresets ? btnTogglePresets : btnTogglePlaylists);

      if (btnTogglePresets) btnTogglePresets.classList.toggle('active', isPresets);
      if (btnTogglePlaylists) btnTogglePlaylists.classList.toggle('active', !isPresets);
      railDrawer.classList.toggle('drawer-presets-mode', isPresets);

      if (activeDrawerMode === null) {
        activeDrawerMode = openDrawerState;
        if (railDrawerCloseTimeout) {
          clearTimeout(railDrawerCloseTimeout);
          railDrawerCloseTimeout = null;
        }
        railDrawer.classList.remove('hidden');
        void railDrawer.offsetWidth;
        railDrawer.classList.add('open');
        if (sectionPresets) sectionPresets.style.display = isPresets ? 'flex' : 'none';
        if (sectionPlaylists) sectionPlaylists.style.display = isPresets ? 'none' : 'flex';
        if (drawerTitle) drawerTitle.textContent = isPresets ? 'Presets' : 'Playlists';
        if (el.btnSavePresetDialog) el.btnSavePresetDialog.style.display = isPresets ? 'inline-flex' : 'none';
        if (el.btnNewPlaylist) el.btnNewPlaylist.style.display = isPresets ? 'none' : 'inline-flex';
        if (sidebarEl) sidebarEl.classList.add('has-drawer-open');
        if (isPresets) {
          renderPresets();
          requestAnimationFrame(updatePresetsFade);
        } else {
          renderPlaylistsList();
        }
      } else if (activeDrawerMode !== openDrawerState) {
        activeDrawerMode = openDrawerState;
        const outgoing = isPresets ? sectionPlaylists : sectionPresets;
        const incoming = isPresets ? sectionPresets : sectionPlaylists;

        if (outgoing) outgoing.classList.add('section-switching-out');
        setTimeout(() => {
          if (outgoing) {
            outgoing.style.display = 'none';
            outgoing.classList.remove('section-switching-out');
          }
          if (drawerTitle) drawerTitle.textContent = isPresets ? 'Presets' : 'Playlists';
          railDrawer.classList.toggle('drawer-presets-mode', isPresets);
          if (el.btnSavePresetDialog) el.btnSavePresetDialog.style.display = isPresets ? 'inline-flex' : 'none';
          if (el.btnNewPlaylist) el.btnNewPlaylist.style.display = isPresets ? 'none' : 'inline-flex';
          if (incoming) {
            incoming.style.display = 'flex';
            incoming.classList.add('section-switching-in');
            setTimeout(() => incoming.classList.remove('section-switching-in'), 200);
            if (isPresets) {
              renderPresets();
              requestAnimationFrame(updatePresetsFade);
            } else {
              renderPlaylistsList();
            }
          }
        }, 120);
      }
    }
  }

  function openDrawer(mode, triggerBtn) {
    openDrawerState = mode;
    applyDrawerState(triggerBtn);
  }

  function closeDrawer() {
    openDrawerState = null;
    applyDrawerState();
  }

  if (btnTogglePresets) {
    btnTogglePresets.addEventListener('click', (e) => {
      e.stopPropagation();
      openDrawerState = openDrawerState === 'presets' ? null : 'presets';
      applyDrawerState(btnTogglePresets);
    });
  }

  if (btnTogglePlaylists) {
    btnTogglePlaylists.addEventListener('click', (e) => {
      e.stopPropagation();
      openDrawerState = openDrawerState === 'playlists' ? null : 'playlists';
      applyDrawerState(btnTogglePlaylists);
    });
  }

  if (btnCloseDrawer) {
    btnCloseDrawer.addEventListener('click', () => closeDrawer());
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && openDrawerState) closeDrawer();
  });


  var RIPPLE_SEL = '.btn-pill-primary, .btn-outline-pill, .btn-icon-pill, .chip-btn, .preset-chip, .theme-mode-btn, .titlebar-btn';
  document.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || document.body.classList.contains('perf')) return;
    const el = e.target.closest(RIPPLE_SEL);
    if (!el || el.disabled || el.closest('#sidebar, .sidebar, #playbar, .playbar, #btn-back-album, .btn-back-artist, #btn-back-playlists, #btn-back-artist-cat, .settings-nav-btn, .audio-tab, .playback-controls, .tvk-controls, .control-btn, .btn-play-pause, #btn-shuffle, #btn-repeat, #btn-prev, #btn-next, #btn-tvk-shuffle, #btn-tvk-prev, #btn-tvk-play, #btn-tvk-next, #btn-tvk-repeat, .track-row, .mix-card, .track-card, .sp-card, .sp-tile, .song-card')) return;
    const clientX = e.clientX;
    const clientY = e.clientY;
    requestAnimationFrame(() => {
      if (!el.isConnected) return;
      const r = el.getBoundingClientRect();
      let host = el.querySelector(':scope > .ripple-host');
      if (!host) {
        if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
        host = document.createElement('span'); host.className = 'ripple-host'; el.appendChild(host);
      }
      const size = Math.hypot(Math.max(clientX - r.left, r.right - clientX), Math.max(clientY - r.top, r.bottom - clientY)) * 2;
      const d = document.createElement('span'); d.className = 'ripple';
      d.style.cssText = `width:${size}px;height:${size}px;left:${clientX - r.left - size / 2}px;top:${clientY - r.top - size / 2}px`;
      host.appendChild(d);
      d.addEventListener('animationend', () => d.remove());
    });
  }, true);


  function updateRightPanelTitleMarquee() {
    const titleEl = el.rightPanelTitle || document.getElementById('right-panel-title');
    if (!titleEl) return;
    let inner = titleEl.querySelector('.rp-title-inner');
    if (!inner) {
      const txt = titleEl.textContent || '';
      titleEl.textContent = '';
      inner = document.createElement('span');
      inner.className = 'rp-title-inner';
      inner.textContent = txt;
      titleEl.appendChild(inner);
    }
    titleEl.classList.remove('is-marquee', 'fade-end');
    titleEl.style.removeProperty('--rp-marquee-dist');
    titleEl.style.removeProperty('--rp-marquee-dur');
    const boxW = titleEl.clientWidth;
    const textW = inner.scrollWidth;
    if (boxW > 20 && textW > boxW + 2) {
      const dist = Math.ceil(textW - boxW + 16);
      const dur = Math.max(7, Math.min(20, 5 + dist / 24));
      titleEl.style.setProperty('--rp-marquee-dist', '-' + dist + 'px');
      titleEl.style.setProperty('--rp-marquee-dur', dur.toFixed(1) + 's');
      titleEl.classList.add('is-marquee');
    }
  }

  function updateNowPlayingUI(track) {
    if (el.playbarTitle) {
      el.playbarTitle.textContent = track.title || 'Untitled';
      el.playbarTitle.dataset.origTitle = track.title || '';
    }
    if (el.playbarArtist) {
      renderClickableArtists(el.playbarArtist, track.artist, track);
      el.playbarArtist.insertAdjacentHTML('afterbegin', getTrackSourceBadgeHtml(track));
      if (typeof isTrackExplicit === 'function' && isTrackExplicit(track)) {
        const badge = document.createElement('span');
        badge.className = 'explicit-badge';
        badge.title = 'Explicit';
        badge.textContent = 'E';
        el.playbarArtist.prepend(badge);
      }
    }

    const artWrap = document.getElementById('playbar-artwork-wrapper');
    const thumb = getTrackThumbUrl(track);
    if (thumb) {
      if (artWrap) artWrap.classList.add('has-artwork');
      if (el.playbarArtwork) {
        if (el.playbarArtwork.dataset.loadedThumb !== thumb) {
          el.playbarArtwork.dataset.loadedThumb = thumb;
          el.playbarArtwork.onload = () => {
            if (state.currentTrack && 'mediaSession' in navigator && navigator.mediaSession.metadata) {
              const curThumb = (typeof getTrackThumbUrl === 'function' ? getTrackThumbUrl(state.currentTrack) : '') || state.currentTrack.thumbnail || '';
              const art = getMediaArtwork(curThumb);
              if (art.length > 0) {
                navigator.mediaSession.metadata.artwork = art;
              }
            }
          };
          el.playbarArtwork.src = thumb;
          if (typeof m3cSetImage === 'function') m3cSetImage(thumb);
        }
        el.playbarArtwork.style.display = 'block';
        el.playbarArtwork.onerror = () => {
          if (state.currentTrack && getTrackArt(state.currentTrack).cover) {
            setTrackArt(state.currentTrack, { cover: undefined });
            const defThumb = state.currentTrack.thumbnail || '';
            el.playbarArtwork.src = defThumb;
            if (typeof m3cSetImage === 'function') m3cSetImage(defThumb);
            if (el.rightPanelCover) el.rightPanelCover.src = defThumb;
            updateRightPanelBanner(defThumb);
            updateThemeFromState();
            return;
          }
          if (artWrap) artWrap.classList.remove('has-artwork');
          el.playbarArtwork.removeAttribute('src');
          el.playbarArtwork.style.display = 'none';
          if (el.artworkFallback) el.artworkFallback.style.display = 'flex';
        };
      }
      if (el.artworkFallback) el.artworkFallback.style.display = 'none';
      if (el.rightPanelCover) {
        if (el.rightPanelCover.dataset.loadedThumb !== thumb) {
          el.rightPanelCover.dataset.loadedThumb = thumb;
          el.rightPanelCover.src = thumb;
        }
        el.rightPanelCover.style.display = 'block';
        el.rightPanelCover.onerror = () => {
          if (state.currentTrack && getTrackArt(state.currentTrack).cover) {
            setTrackArt(state.currentTrack, { cover: undefined });
            const defThumb = state.currentTrack.thumbnail || '';
            el.rightPanelCover.src = defThumb;
            if (el.playbarArtwork) {
              el.playbarArtwork.src = defThumb;
              if (typeof m3cSetImage === 'function') m3cSetImage(defThumb);
            }
            updateRightPanelBanner(defThumb);
            updateThemeFromState();
            return;
          }
          el.rightPanelCover.style.display = 'none';
          if (el.rightPanelFallback) el.rightPanelFallback.style.display = 'flex';
          el.rightPanelArtworkBox?.classList.remove('has-cover');
        };
      }
      if (el.rightPanelFallback) el.rightPanelFallback.style.display = 'none';
      el.rightPanelArtworkBox?.classList.add('has-cover');
    } else {
      if (artWrap) artWrap.classList.remove('has-artwork');
      if (el.playbarArtwork) {
        el.playbarArtwork.removeAttribute('src');
        el.playbarArtwork.style.display = 'none';
      }
      if (typeof m3cSetImage === 'function') m3cSetImage('');
      if (el.artworkFallback) el.artworkFallback.style.display = 'flex';
      if (el.rightPanelCover) {
        el.rightPanelCover.removeAttribute('src');
        el.rightPanelCover.style.display = 'none';
      }
      if (el.rightPanelFallback) el.rightPanelFallback.style.display = 'flex';
      el.rightPanelArtworkBox?.classList.remove('has-cover');
    }

    if (el.rightPanelTitle) {
      el.rightPanelTitle.innerHTML = '<span class="rp-title-inner">' + escapeHtml(track.title || 'Untitled') + '</span>';
      requestAnimationFrame(updateRightPanelTitleMarquee);
    }
    if (el.rightPanelArtist) {
      renderClickableArtists(el.rightPanelArtist, track.artist, track);
      if (typeof isTrackExplicit === 'function' && isTrackExplicit(track)) {
        const badge = document.createElement('span');
        badge.className = 'explicit-badge';
        badge.title = 'Explicit';
        badge.textContent = 'E';
        el.rightPanelArtist.prepend(badge);
      }
    }

    if (el.btnPlaybarMore) el.btnPlaybarMore.style.display = '';
    if (el.timeDuration && track && track.duration) el.timeDuration.textContent = formatDuration(track.duration);

    updateRightPanelBanner(thumb);
    updateRightPanelGradientColor(thumb);
    refreshMeshCover();
    updateActiveCoverBg();
    syncTvkAmbientBg();
    updateFavoriteIcon();
    if (typeof updateRpSaveButton === 'function') updateRpSaveButton();
    applyVisualEffects();
    highlightPlayingRow();
    updateThemeFromState();
    updateMediaSession();
    if (state.isTvKaraokeOpen) updateTvKaraokeMeta();
    updateRightPanelCredits(track);
    requestAnimationFrame(() => {
      updateTextFade(el.rightPanelTitle);
      updateTextFade(el.rightPanelArtist);
      updateTextFade(el.playbarTitle);
      updateTextFade(el.playbarArtist);
    });
  }

  function updateRightPanelGradientColor(thumbUrl) {
    const panel = el.rightPanel || document.getElementById('right-panel');
    if (!panel) return;
    const setNeutralGray = () => {
      panel.style.removeProperty('--rp-grad-top');
      panel.style.removeProperty('--rp-grad-mid');
    };
    if (!thumbUrl) {
      setNeutralGray();
      return;
    }
    analyzeCover(thumbUrl).then(analysis => {
      if (!analysis || analysis.saturation < 0.14 || analysis.luminance < 0.06 || analysis.luminance > 0.88) {
        setNeutralGray();
        return;
      }
      const c = hexToRgb(analysis.accent || '#ffffff');
      panel.style.setProperty('--rp-grad-top', 'rgba(' + c.r + ', ' + c.g + ', ' + c.b + ', 0.24)');
      panel.style.setProperty('--rp-grad-mid', 'rgba(' + c.r + ', ' + c.g + ', ' + c.b + ', 0.08)');
    }).catch(() => setNeutralGray());
  }

  function updateRightPanelBanner(thumbUrl) {
    const banner = document.getElementById('right-panel-banner');
    if (!banner) return;
    const trackArt = state.currentTrack ? getTrackArt(state.currentTrack) : {};
    const trackBanner = trackArt.banner || null;
    const hasPerTrackBanner = !!trackBanner;
    if ((!getAdv('banners', true) || !getAdv('track_banners', false)) && !hasPerTrackBanner) {
      banner.style.display = 'none';
      if (state.isTvKaraokeOpen) syncTvBanner();
      return;
    }
    banner.style.display = '';
    const bannerImg = banner.querySelector('.banner-image') || banner;
    const globalMedia = localStorage.getItem('riff_banner_media');
    const mediaToUse = trackBanner || globalMedia || thumbUrl;

    const hasCustomFx = !!(trackArt.bannerCustomFx || (trackArt.bannerFx && trackArt.bannerFx.enabled));
    if (hasCustomFx) {
      const isPerf = document.body.classList.contains('perf');
      const bBlur = isPerf ? 0 : (trackArt.bannerBlur !== undefined ? trackArt.bannerBlur : (trackArt.bannerFx && trackArt.bannerFx.blur !== undefined ? trackArt.bannerFx.blur : 3));
      const bOpacity = trackArt.bannerOpacity !== undefined ? (trackArt.bannerOpacity / 100) : (trackArt.bannerFx && trackArt.bannerFx.opacity !== undefined ? (trackArt.bannerFx.opacity / 100) : 1);
      const bFade = trackArt.bannerFade !== undefined ? trackArt.bannerFade : (trackArt.bannerFx && trackArt.bannerFx.fade !== undefined ? trackArt.bannerFx.fade : 100);
      banner.style.setProperty('--banner-blur', `${bBlur}px`);
      banner.style.setProperty('--banner-opacity', `${bOpacity}`);
      banner.style.setProperty('--banner-fade-base', `${bFade}%`);
      banner.style.setProperty('--banner-fade-end', `${bFade}%`);
    } else {
      banner.style.removeProperty('--banner-blur');
      banner.style.removeProperty('--banner-opacity');
      banner.style.removeProperty('--banner-fade-base');
      banner.style.removeProperty('--banner-fade-end');
    }

    if (!mediaToUse) {
      banner.classList.add('fading-out');
      setTimeout(() => {
        bannerImg.style.backgroundImage = 'none';
        const vid = banner.querySelector('video.banner-video');
        if (vid) vid.remove();
        banner.style.opacity = '0';
        banner.classList.remove('fading-out');
        if (state.isTvKaraokeOpen) syncTvBanner();
      }, 300);
      if (state.isTvKaraokeOpen) syncTvBanner();
      return;
    }

    const isVideo = /\.(mp4|webm)($|\?)/i.test(mediaToUse);
    if (isVideo) {
      bannerImg.style.backgroundImage = 'none';
      let vid = banner.querySelector('video.banner-video');
      if (!vid) {
        vid = document.createElement('video');
        vid.className = 'banner-video';
        vid.autoplay = true;
        vid.loop = true;
        vid.muted = true;
        vid.playsInline = true;
        banner.appendChild(vid);
      }
      vid.onerror = () => {
        if (trackBanner && state.currentTrack) {
          setTrackArt(state.currentTrack, { banner: undefined });
          updateRightPanelBanner(thumbUrl);
        } else {
          banner.style.opacity = '0';
          if (state.isTvKaraokeOpen) syncTvBanner();
        }
      };
      if (vid.src !== mediaToUse) {
        vid.src = mediaToUse;
        vid.play().catch(() => {});
      }
      banner.style.opacity = '1';
      if (state.isTvKaraokeOpen) syncTvBanner();
      return;
    }

    const vid = banner.querySelector('video.banner-video');
    if (vid) vid.remove();

    if (banner.dataset.currentBannerUrl === mediaToUse && banner.style.opacity === '1') {
      return;
    }
    banner.dataset.currentBannerUrl = mediaToUse;

    const img = new Image();
    img.src = mediaToUse;
    img.onload = () => {
      banner.classList.add('fading-out');
      setTimeout(() => {
        bannerImg.style.backgroundImage = `url("${mediaToUse}")`;
        banner.classList.remove('fading-out');
        banner.style.opacity = '1';
        if (state.isTvKaraokeOpen) syncTvBanner();
      }, 150);
    };
    img.onerror = () => {
      if (trackBanner && state.currentTrack) {
        setTrackArt(state.currentTrack, { banner: undefined });
        updateRightPanelBanner(thumbUrl);
      } else {
        banner.style.opacity = '0';
        if (state.isTvKaraokeOpen) syncTvBanner();
      }
    };
    if (state.isTvKaraokeOpen) syncTvBanner();
  }

  function getTrackPlatformInfo(track) {
    if (isStaticTikTokTrack(track) || (track && track.platform === 'tiktok')) {
      return {
        id: 'tiktok',
        name: 'TikTok',
        svg: '<svg width="16" height="16" viewBox="0 0 24 24"><path fill="#25F4EE" d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" transform="translate(1, 1)"/><path fill="#FE2C55" d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" transform="translate(-1, -1)"/><path fill="#FFFFFF" d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>'
      };
    }
    let p = (track && track.platform) || (state && state.platform) || 'ytmusic';
    if (track && (track.platform === 'local' || track.isLocal || String(track.id || '').startsWith('local_') || (track.url && (track.url.startsWith('file:') || track.url.startsWith('/'))))) {
      p = 'local';
    } else if (track && track.url) {
      if (track.url.includes('soundcloud.com')) p = 'soundcloud';
      else if (track.url.includes('music.youtube.com')) p = 'ytmusic';
      else if (track.url.includes('youtube.com') || track.url.includes('youtu.be')) p = (track.platform === 'youtube') ? 'youtube' : (p === 'youtube' ? 'youtube' : 'ytmusic');
    }
    if (p === 'soundcloud') {
      return {
        id: 'soundcloud',
        name: 'SoundCloud',
        svg: '<svg width="16" height="16" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#FF5500"/><path fill="#FFFFFF" d="M11.5 15.5c0 .3-.2.5-.5.5s-.5-.2-.5-.5v-5c0-.3.2-.5.5-.5s.5.2.5.5v5zm-2.2 0c0 .3-.2.5-.5.5s-.5-.2-.5-.5v-3.5c0-.3.2-.5.5-.5s.5.2.5.5v3.5zm-2.2 0c0 .3-.2.5-.5.5s-.5-.2-.5-.5v-2c0-.3.2-.5.5-.5s.5.2.5.5v2zm11.9-.5c0 1.7-1.3 3-3 3h-3.5v-6.8c.6-.5 1.4-.9 2.3-.9 1.9 0 3.5 1.4 3.8 3.3.3-.1.6-.2.9-.2 1.2 0 2.2 1 2.2 2.2z" transform="translate(-1,-1)"/></svg>'
      };
    }
    if (p === 'youtube') {
      return {
        id: 'youtube',
        name: 'YouTube',
        svg: '<svg width="16" height="16" viewBox="0 0 24 24"><path fill="#FF0033" d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1c.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8z"/><polygon fill="#FFFFFF" points="9.5,15.5 15.8,12 9.5,8.5"/></svg>'
      };
    }
    if (p === 'local') {
      return {
        id: 'local',
        name: 'Local file',
        svg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="#6DD58C"><path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>'
      };
    }
    return {
      id: 'ytmusic',
      name: 'YouTube Music',
      svg: '<svg width="16" height="16" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#FF0033"/><circle cx="12" cy="12" r="7.2" fill="none" stroke="#FFFFFF" stroke-width="1.5"/><polygon fill="#FFFFFF" points="10.2,15 15.2,12 10.2,9"/></svg>'
    };
  }

  function getTrackSourceBadgeHtml(track) {
    const info = getTrackPlatformInfo(track);
    return `<span class="track-source-logo-badge" title="${escapeHtml(info.name)}">${info.svg}</span>`;
  }

  var currentCreditsToken = 0;

  function flipAnimate(elements, mutateFn, duration = 380) {
    const validElements = (elements || []).filter(item => item && item.getBoundingClientRect);
    const firstRects = new Map();
    validElements.forEach(item => {
      firstRects.set(item, item.getBoundingClientRect());
    });

    validElements.forEach(item => {
      item.style.transition = 'none';
      item.style.transform = 'none';
    });

    if (typeof mutateFn === 'function') {
      mutateFn();
    }

    const animatingElements = [];
    validElements.forEach(item => {
      const first = firstRects.get(item);
      const last = item.getBoundingClientRect();
      if (!first || !last) return;
      if ((first.width === 0 && first.height === 0) || (last.width === 0 && last.height === 0)) return;

      const dx = first.left - last.left;
      const dy = first.top - last.top;

      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        item.style.transform = `translate(${dx}px, ${dy}px)`;
        animatingElements.push(item);
      } else {
        item.style.transform = '';
        item.style.transition = '';
      }
    });

    if (animatingElements.length === 0) return;

    animatingElements.forEach(item => item.offsetHeight);

    requestAnimationFrame(() => {
      animatingElements.forEach(item => {
        item.style.transition = `transform ${duration}ms cubic-bezier(0.2, 0, 0, 1)`;
        item.style.transform = '';

        let cleaned = false;
        const cleanUp = () => {
          if (cleaned) return;
          cleaned = true;
          item.removeEventListener('transitionend', onEnd);
          item.style.transition = '';
          item.style.transform = '';
        };
        const onEnd = (e) => {
          if (e.target !== item || e.propertyName !== 'transform') return;
          cleanUp();
        };
        item.addEventListener('transitionend', onEnd);
        setTimeout(cleanUp, duration + 50);
      });
    });
  }


function closeSbInlinePresets() {
  const sheet = document.getElementById('sb-inline-presets-sheet');
  if (sheet) sheet.classList.remove('open');
  const btn = document.getElementById('btn-sb-presets');
  if (btn) btn.classList.remove('active');
}
window.closeSbInlinePresets = closeSbInlinePresets;

function ensureUiPackStyles() {}
window.ensureUiPackStyles = ensureUiPackStyles;
function ensureAboutSupportStyles() {}
window.ensureAboutSupportStyles = ensureAboutSupportStyles;

  function updateRowFade(row) {
    
    
    
    return;
  }
  window.updateRowFade = updateRowFade;

  function bindHorizontalWheel(row) {
    if (!row || row._wheelBound) return;
    row._wheelBound = true;
    row.style.scrollBehavior = 'auto';

    let isDown = false;
    let startX = 0;
    let scrollStart = 0;
    let dragged = false;

    row.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey) {
        e.preventDefault();
        row.scrollLeft += (e.deltaX || e.deltaY);
      }
    }, { passive: false });

    row.addEventListener('dragstart', (e) => e.preventDefault());

    const onMouseMove = (e) => {
      if (!isDown) return;
      const walk = e.pageX - startX;
      if (Math.abs(walk) > 3) {
        dragged = true;
      }
      row.style.scrollBehavior = 'auto';
      row.scrollLeft = scrollStart - walk;
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      isDown = false;
      setTimeout(() => { dragged = false; }, 50);
    };

    row.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      isDown = true;
      dragged = false;
      startX = e.pageX;
      scrollStart = row.scrollLeft;
      row.style.scrollBehavior = 'auto';
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });

    row.addEventListener('click', (e) => {
      if (dragged) {
        e.preventDefault();
        e.stopPropagation();
        dragged = false;
      }
    }, true);
  }
  window.bindHorizontalWheel = bindHorizontalWheel;

  function attachAllHorizontalScroll(root = document) {
    const selector = '.sp-row, .search-albums-row, .search-playlists-row, .fav-artists-row, #sp-made, #sp-quick, #sp-trend, #sp-artists, #saved-albums-grid, #artist-albums-grid, #artist-albums-shelf, .artist-albums-shelf, #search-albums-container .search-albums-row, #search-playlists-container .search-playlists-row';
    (root || document).querySelectorAll(selector).forEach(bindHorizontalWheel);
  }
  window.attachAllHorizontalScroll = attachAllHorizontalScroll;

  var DEFAULT_SPINNER_SHAPE_PATH = 'M-148.0,-0.0L-142.9,-10.0L-138.6,-19.5L-136.1,-28.9L-135.0,-38.7L-135.3,-49.2L-135.0,-60.1L-132.9,-70.7L-129.1,-80.7L-123.7,-89.9L-116.8,-98.0L-108.6,-104.9L-99.4,-110.3L-89.2,-114.2L-78.5,-116.4L-68.6,-118.8L-59.7,-122.4L-51.5,-127.4L-43.5,-134.0L-35.1,-140.7L-25.7,-145.9L-15.7,-149.4L-5.3,-151.1L5.3,-151.1L15.7,-149.4L25.7,-145.9L35.1,-140.7L43.5,-134.0L51.5,-127.4L59.7,-122.4L68.6,-118.8L78.5,-116.4L89.2,-114.2L99.4,-110.3L108.6,-104.9L116.8,-98.0L123.7,-89.9L129.1,-80.7L132.9,-70.7L135.0,-60.1L135.3,-49.2L135.0,-38.7L136.1,-28.9L138.6,-19.5L142.9,-10.0L148.0,0.0L151.6,10.6L153.1,21.5L152.8,32.5L150.6,43.2L146.6,53.4L140.9,62.8L133.6,71.1L124.9,78.1L116.5,84.6L109.6,92.0L103.9,100.4L99.3,110.3L94.2,120.6L87.6,129.8L79.4,137.6L70.1,143.7L59.9,148.2L49.0,150.7L37.7,151.3L26.4,149.8L15.4,146.9L5.1,145.2L-5.1,145.2L-15.4,146.9L-26.4,149.8L-37.7,151.3L-49.0,150.7L-59.9,148.2L-70.1,143.7L-79.4,137.6L-87.6,129.8L-94.2,120.6L-99.3,110.3L-103.9,100.4L-109.6,92.0L-116.5,84.6L-124.9,78.1L-133.6,71.1L-140.9,62.8L-146.6,53.4L-150.6,43.2L-152.8,32.5L-153.1,21.5L-151.6,10.6Z';


  async function fetchAlbumsForSearch(query, token) {
    let container = document.getElementById('search-albums-container');
    if (!container) {
      const artistContainer = document.getElementById('search-artist-card-container');
      if (artistContainer && artistContainer.parentNode) {
        container = document.createElement('div');
        container.id = 'search-albums-container';
        artistContainer.parentNode.insertBefore(container, artistContainer.nextSibling);
      }
    }
    if (!container) return;

    try {
      const res = await fetch(`http://127.0.0.1:${state.serverPort}/api/albums/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (state.searchToken !== token) return;
      if (!data || !data.success || !Array.isArray(data.albums) || data.albums.length === 0) {
        container.innerHTML = '';
        return;
      }

      const albums = data.albums;
      container.innerHTML = `
        <div class="search-albums-section">
          <div class="section-sub-header">
            <h3 data-i18n>${typeof t === 'function' ? t('Albums') : 'Albums'}</h3>
          </div>
          <div class="search-albums-row">
            ${albums.map(album => {
              const sub = album.year ? `${escapeHtml(album.artist)} · ${escapeHtml(album.year)}` : escapeHtml(album.artist || '');
              return `
                <div class="search-album-card" role="button" tabindex="0">
                  ${album.cover ? `<img class="search-album-cover" src="${escapeHtml(album.cover)}" alt="${escapeHtml(album.title)}" loading="lazy" onerror="this.style.display='none'" />` : '<div class="search-album-cover" style="display:flex;align-items:center;justify-content:center;background:var(--md-sys-color-surface-container-high);"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--md-sys-color-outline);"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg></div>'}
                  <div class="search-album-info">
                    <span class="search-album-title" title="${escapeHtml(album.title)}">${escapeHtml(album.title)}</span>
                    <span class="search-album-sub" title="${sub}">${sub}</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;

      const row = container.querySelector('.search-albums-row');
      if (row) {
        bindHorizontalWheel(row);
        requestAnimationFrame(() => updateRowFade(row));
      }

      const cards = container.querySelectorAll('.search-album-card');
      cards.forEach((card, idx) => {
        const album = albums[idx];
        if (!album) return;
        card.addEventListener('click', () => openAlbum(album));
        card.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            openAlbum(album);
          }
        });
      });
      if (typeof applySearchFilter === 'function') applySearchFilter(currentSearchFilter);
    } catch (e) {
      if (state.searchToken === token && container) {
        container.innerHTML = '';
      }
    }
  }

  async function fetchPlaylistsForSearch(query, token) {
    let container = document.getElementById('search-playlists-container');
    if (!container) {
      const albumsContainer = document.getElementById('search-albums-container');
      if (albumsContainer && albumsContainer.parentNode) {
        container = document.createElement('div');
        container.id = 'search-playlists-container';
        albumsContainer.parentNode.insertBefore(container, albumsContainer.nextSibling);
      }
    }
    if (!container) return;

    try {
      const res = await fetch(`http://127.0.0.1:${state.serverPort}/api/playlists/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (state.searchToken !== token) return;
      if (!data || !data.success || !Array.isArray(data.playlists) || data.playlists.length === 0) {
        container.innerHTML = '';
        return;
      }

      const playlists = data.playlists;
      container.innerHTML = `
        <div class="search-albums-section search-playlists-section">
          <div class="section-sub-header">
            <h3 data-i18n>${typeof t === 'function' ? t('Playlists') : 'Playlists'}</h3>
          </div>
          <div class="search-albums-row search-playlists-row">
            ${playlists.map((pl, idx) => {
              const sub = pl.author ? `By ${escapeHtml(pl.author)}` : (pl.trackCount ? `${pl.trackCount} songs` : 'Playlist');
              const isSaved = Array.isArray(state.playlists) && state.playlists.some(p => (pl.url && p.syncUrl === pl.url) || (p.name && p.name.toLowerCase() === (pl.title || '').toLowerCase() && p.tracks && p.tracks.length > 0));
              const addTitle = isSaved ? (typeof t === 'function' ? t('Added to library') : 'Added to library') : (typeof t === 'function' ? t('Add to library') : 'Add to library');
              return `
                <div class="search-album-card search-playlist-card" role="button" tabindex="0">
                  <div class="search-playlist-cover-wrap">
                    ${pl.cover ? `<img class="search-album-cover" src="${escapeHtml(pl.cover)}" alt="${escapeHtml(pl.title)}" loading="lazy" onerror="this.style.display='none'" />` : '<div class="search-album-cover" style="display:flex;align-items:center;justify-content:center;background:var(--md-sys-color-surface-container-high);"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--md-sys-color-outline);"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg></div>'}
                    <button class="search-playlist-add-btn${isSaved ? ' saved' : ''}" type="button" title="${escapeHtml(addTitle)}" aria-label="${escapeHtml(addTitle)}">
                      ${isSaved ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>'}
                    </button>
                  </div>
                  <div class="search-album-info">
                    <span class="search-album-title" title="${escapeHtml(pl.title)}">${escapeHtml(pl.title)}</span>
                    <span class="search-album-sub" title="${sub}">${sub}</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;

      const row = container.querySelector('.search-playlists-row');
      if (row) {
        bindHorizontalWheel(row);
        requestAnimationFrame(() => updateRowFade(row));
      }

      const cards = container.querySelectorAll('.search-playlist-card');
      cards.forEach((card, idx) => {
        const pl = playlists[idx];
        if (!pl) return;

        const addBtn = card.querySelector('.search-playlist-add-btn');
        if (addBtn) {
          addBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            e.preventDefault();
            if (addBtn.classList.contains('saved') || addBtn.disabled) return;
            addBtn.disabled = true;
            addBtn.style.opacity = '1';
            addBtn.innerHTML = `<span class="riff-dots-loader sm" aria-hidden="true"><i></i><i></i><i></i></span>`;
            try {
              showToast(typeof t === 'function' ? t('Adding playlist to library...') : 'Adding playlist to library...');
              const pRes = await fetch(`http://127.0.0.1:${state.serverPort}/api/playlist-import?url=${encodeURIComponent(pl.url)}`);
              const pData = await pRes.json();
              if (pData && pData.success && Array.isArray(pData.tracks) && pData.tracks.length > 0) {
                createPlaylist(pData.name || pl.title || 'Playlist', pData.tracks, pData.cover || pl.cover || '', {
                  syncEnabled: false,
                  importedPlatform: 'spotify',
                  importedAt: Date.now(),
                  skipOpen: true
                });
                addBtn.classList.add('saved');
                addBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
                const doneTitle = typeof t === 'function' ? t('Added to library') : 'Added to library';
                addBtn.title = doneTitle;
                addBtn.setAttribute('aria-label', doneTitle);
                showToast((typeof t === 'function' ? t('Playlist added to your library') : 'Playlist added to your library') + ` (${pData.tracks.length} tracks)`);
              } else {
                addBtn.disabled = false;
                addBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>';
                showToast(pData?.error || 'Could not import playlist');
              }
            } catch (err) {
              addBtn.disabled = false;
              addBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>';
              showToast('Failed to import playlist');
            }
          });
        }

        const clickHandler = async () => {
          try {
            showToast('Loading playlist...');
            const pRes = await fetch(`http://127.0.0.1:${state.serverPort}/api/playlist-import?url=${encodeURIComponent(pl.url)}`);
            const pData = await pRes.json();
            if (pData && pData.success && Array.isArray(pData.tracks) && pData.tracks.length > 0) {
              openAlbum({
                id: pl.id,
                title: pl.title,
                artist: pl.author || 'Public Playlist',
                cover: pl.cover || pData.cover || '',
                trackCount: pData.tracks.length,
                tracks: pData.tracks,
                type: 'Playlist'
              });
            } else {
              showToast(pData?.error || 'Could not load playlist');
            }
          } catch (err) {
            showToast('Failed to open playlist');
          }
        };
        card.addEventListener('click', clickHandler);
        card.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            clickHandler();
          }
        });
      });
      if (typeof applySearchFilter === 'function') applySearchFilter(currentSearchFilter);
    } catch (e) {
      if (state.searchToken === token && container) {
        container.innerHTML = '';
      }
    }
  }

  function easeInOutCubicFn(x) {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  }

  function renderM3SearchLoader(container, size = 96) {
    if (!container) return;
    container.innerHTML = `
      <div class="m3-search-loader-wrap">
        <div class="m3-search-shape-stage" style="display:flex;align-items:center;justify-content:center;">
          <span class="riff-dots-loader lg" aria-hidden="true"><i></i><i></i><i></i></span>
          <div class="m3-search-error-icon">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
        </div>
        <div class="m3-search-error-slot"></div>
      </div>
    `;
    if (typeof refreshCachedSpinners === 'function') refreshCachedSpinners();
    const stage = container.querySelector('.m3-search-shape-stage');
    const stateObj = {
      stopping: false,
      stopStart: 0,
      stopped: false
    };
    container._m3LoaderState = stateObj;

    stateObj.triggerGearStop = () => {
      if (stateObj.stopping) return;
      stateObj.stopping = true;
      stateObj.stopStart = performance.now();
      if (stage) stage.classList.add('is-error');
    };
  }

  var cachedSpinners = [];
  function refreshCachedSpinners() {
    const nodes = document.querySelectorAll('.m3-btn-shape-spinner');
    cachedSpinners = [];
    const defaultD = (function() {
      const S = window.RiffShapes;
      if (S && typeof S.ready === 'function' && S.ready()) {
        const a = S.spinnerProfile ? S.spinnerProfile(0) : S.profile(0);
        const K = S.K || 360;
        let d = '';
        for (let k = 0; k < K; k += 4) {
          const th = -Math.PI + (Math.PI * 2 * k) / K;
          const r = a[k];
          d += `${k === 0 ? 'M' : 'L'}${(Math.cos(th) * r).toFixed(1)},${(Math.sin(th) * r).toFixed(1)}`;
        }
        return d + 'Z';
      }
      return DEFAULT_SPINNER_SHAPE_PATH;
    })();

    for (let i = 0; i < nodes.length; i++) {
      const svg = nodes[i];
      const path = svg.querySelector('path') || svg.firstElementChild;
      if (path && !path.getAttribute('d')) {
        path.setAttribute('d', defaultD);
      }
      cachedSpinners.push({ svg, path });
    }
  }
  window.refreshCachedSpinners = refreshCachedSpinners;

  function startButtonShapeSpinners() {
     
     
    refreshCachedSpinners();
  }
  startButtonShapeSpinners();

  function stopM3SearchLoaderWithError(container, errMessage) {
    if (!container) return;
    if (!container.querySelector('.m3-search-loader-wrap')) {
      renderM3SearchLoader(container, 96);
    }
    const st = container._m3LoaderState;
    if (st && typeof st.triggerGearStop === 'function') {
      st.triggerGearStop();
    }
    const slot = container.querySelector('.m3-search-error-slot');
    if (!slot) return;
    const cleanErr = String(errMessage || 'Unknown network or extractor error').trim();
    slot.innerHTML = `
      <div class="m3-search-error-box">
        <div class="m3-search-error-title">Error while fetching tracks. Please report this to GitHub WITH logs / diagnostics.</div>
        <div class="m3-search-error-detail">${escapeHtml(cleanErr)}</div>
        <div style="display:flex;gap:8px;margin-top:4px;">
          <button type="button" class="btn-pill-primary" id="btn-copy-search-err" style="height:34px;padding:0 16px;font-size:12.5px;">Copy error & diagnostics</button>
        </div>
      </div>
    `;
    const copyBtn = slot.querySelector('#btn-copy-search-err');
    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        let diag = '';
        try {
          if (window.electronAPI && typeof window.electronAPI.getDiagnostics === 'function') {
            diag = await window.electronAPI.getDiagnostics();
          }
        } catch (_) {}
        const fullReport = `Search Error: ${cleanErr}\nQuery: ${state.searchQuery || ''}\nPlatform: ${state.platform || ''}\n\n${diag}`.trim();
        try {
          await navigator.clipboard.writeText(fullReport);
          showToast('Copied error & diagnostics to clipboard', 'success');
        } catch (_) {}
      });
    }
  }



  function ensureSearchLayoutDOM() {
    const root = document.getElementById('search-results-container');
    if (!root) return null;

    let spotifyTop = document.getElementById('search-spotify-top');
    if (!spotifyTop) {
      spotifyTop = document.createElement('div');
      spotifyTop.id = 'search-spotify-top';
      spotifyTop.className = 'search-spotify-top-section';
      spotifyTop.innerHTML = `
        <div class="search-top-result-col" id="search-top-result-col"></div>
        <div class="search-top-songs-col" id="search-top-songs-col">
          <div class="section-sub-header"><h3 data-i18n>${typeof t === 'function' ? t('Songs') : 'Songs'}</h3></div>
          <div class="search-top-songs-list" id="search-top-songs-list"></div>
        </div>
      `;
    }

    const chips = document.getElementById('search-filter-chips');
    const tracksList = document.getElementById('search-tracks-list');
    let albums = document.getElementById('search-albums-container');
    if (!albums) {
      albums = document.createElement('div');
      albums.id = 'search-albums-container';
    }
    let playlists = document.getElementById('search-playlists-container');
    if (!playlists) {
      playlists = document.createElement('div');
      playlists.id = 'search-playlists-container';
    }

    if (chips && chips.nextSibling !== spotifyTop) {
      chips.parentNode.insertBefore(spotifyTop, chips.nextSibling);
    }
    if (spotifyTop && tracksList && spotifyTop.nextSibling !== tracksList) {
      spotifyTop.parentNode.insertBefore(tracksList, spotifyTop.nextSibling);
    }
    if (tracksList && albums && tracksList.nextSibling !== albums) {
      tracksList.parentNode.insertBefore(albums, tracksList.nextSibling);
    }
    if (albums && playlists && albums.nextSibling !== playlists) {
      albums.parentNode.insertBefore(playlists, albums.nextSibling);
    }

    return { root, spotifyTop, tracksList, albums, playlists };
  }

  function renderSpotifySearchResults(tracks, query, searchToken) {
    if (state.searchToken !== searchToken) return;
    const dom = ensureSearchLayoutDOM();
    if (!dom || !Array.isArray(tracks) || tracks.length === 0) {
      if (el.searchTracksList) renderTracks(el.searchTracksList, tracks || [], 'search');
      return;
    }

    const topTrack = tracks[0];
    const topCol = document.getElementById('search-top-result-col');
    if (topCol) {
      const topThumb = getTrackThumbUrl(topTrack);
      topCol.innerHTML = `
        <div class="section-sub-header">
          <h3 data-i18n>${typeof t === 'function' ? t('Top result') : 'Top result'}</h3>
        </div>
        <div class="search-top-result-card" id="search-top-result-card" role="button" tabindex="0">
          <img class="search-top-result-cover" src="${escapeHtml(topThumb)}" alt="${escapeHtml(topTrack.title || '')}" onerror="this.style.display='none'" />
          <span class="search-top-result-title" title="${escapeHtml(topTrack.title || '')}">${escapeHtml(topTrack.title || 'untitled')}</span>
          <div class="search-top-result-meta">
            <span>Song \u2022 ${escapeHtml(topTrack.artist || 'Unknown Artist')}</span>
          </div>
          <button type="button" class="search-top-result-play-btn" aria-label="Play">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="#000000"><path d="M8 5.25C7 4.22 8.13 3.59 9.01 4.14L18.8 10.89C19.6 11.39 19.6 12.61 18.8 13.11L9.01 19.86C8.13 20.41 7 19.78 7 18.75V5.25Z" fill="#000000"/></svg>
          </button>
        </div>
      `;
      const card = document.getElementById('search-top-result-card');
      if (card) {
        if (topThumb && typeof getCoverDominantColors === 'function') {
          getCoverDominantColors(topThumb).then((colors) => {
            const currentCard = document.getElementById('search-top-result-card');
            const c1 = colors && colors[0];
            if (currentCard && c1) {
              currentCard.style.background = `radial-gradient(circle at 100% 100%, color-mix(in srgb, ${c1} 38%, var(--md-sys-color-surface-container, #1e1e1e)) 0%, var(--md-sys-color-surface-container, #1e1e1e) 65%)`;
            }
          }).catch(() => {});
        }
        card.addEventListener('click', () => {
          playTrack(topTrack, tracks, 0);
        });
      }
    }

    const topSongsList = document.getElementById('search-top-songs-list');
    if (topSongsList) {
      topSongsList.innerHTML = '';
      const top4 = tracks.slice(0, 4);
      const frag = document.createDocumentFragment();
      const currentCanonicalId = state.currentTrack ? (getTrackCanonicalId(state.currentTrack) || state.currentTrack.id) : null;
      top4.forEach((t, i) => {
        const row = createTrackRow(t, i, currentCanonicalId, 'search', tracks, topSongsList);
        frag.appendChild(row);
      });
      topSongsList.appendChild(frag);
    }

    if (el.searchTracksList) {
      const restTracks = tracks.length > 4 ? tracks.slice(4) : tracks;
      renderTracks(el.searchTracksList, restTracks, 'search');
    }

    if (typeof applySearchFilter === 'function') applySearchFilter(currentSearchFilter);
  }

  async function performSearch(query) {
    if (!query || !query.trim()) return;

    clearQueuedStreamPrefetch();
    const searchToken = (state.searchToken || 0) + 1;
    state.searchToken = searchToken;

    state.searchQuery = query;
    state.searchOffset = 0;
    state.searchHasMore = false;
    state.searchLoadingMore = false;
    switchView('discover');

    if (el.discoverEmpty) el.discoverEmpty.classList.add('hidden');
    if (el.searchResultsContainer) {
      el.searchResultsContainer.classList.remove('hidden', 'view-hidden');
      el.searchResultsContainer.style.display = '';
    }
    if (el.searchResults) {
      el.searchResults.classList.remove('hidden', 'view-hidden');
      el.searchResults.style.display = '';
    }
    if (typeof syncHomeAmbientVisibility === 'function') syncHomeAmbientVisibility();

    const artistCardContainer = document.getElementById('search-artist-card-container');
    if (artistCardContainer) artistCardContainer.innerHTML = '';

    const oldTopCol = document.getElementById('search-top-result-col');
    if (oldTopCol) oldTopCol.innerHTML = '';
    const oldTopSongs = document.getElementById('search-top-songs-list');
    if (oldTopSongs) oldTopSongs.innerHTML = '';

    const albumsContainer = document.getElementById('search-albums-container');
    if (albumsContainer) albumsContainer.innerHTML = '';

    const playlistsContainer = document.getElementById('search-playlists-container');
    if (playlistsContainer) playlistsContainer.innerHTML = '';

    const trimmedQuery = query.trim();
    if (getAdv('albums', true) && trimmedQuery.length >= 3) {
      fetchAlbumsForSearch(trimmedQuery, searchToken);
    }
    fetchPlaylistsForSearch(trimmedQuery, searchToken);

    if (el.searchTracksList) {
      renderM3SearchLoader(el.searchTracksList);
    }

    try {
      if (!navigator.onLine) {
        if (el.searchTracksList) {
          stopM3SearchLoaderWithError(el.searchTracksList, 'Offline: no internet connection');
        }
        return;
      }
      const searchPlat = localStorage.getItem('riff_library_enabled') !== '0' ? 'rifflibrary' : state.platform;
      const searchUrl = `http://127.0.0.1:${state.serverPort}/api/search?q=${encodeURIComponent(query)}&platform=${searchPlat}&limit=12&offset=0`;
      const res = await fetch(searchUrl);
      const data = await res.json();
      if (state.searchToken !== searchToken) return;

      if (!data.success || !data.tracks) {
        if (state.platform === 'ytmusic') showToast('YouTube Music is unavailable');
        throw new Error(data.error || 'Failed to load search results');
      }

      data.tracks = rankSearchTracks(query, data.tracks);
      state.searchResults = data.tracks;
      state.searchOffset = data.tracks.length;
      state.searchHasMore = !!data.hasMore;
      const firstThumb = data.tracks.length ? getTrackThumbUrl(data.tracks[0]) : '';
      setSearchIconCover(firstThumb);
      recordSearchQuery(query, firstThumb);
      prefetchVisibleTracks(data.tracks);

      requestAnimationFrame(() => {
        renderSpotifySearchResults(data.tracks, query, searchToken);
      });

      const showArtists = localStorage.getItem('riff_search_artists') !== '0';
      if (showArtists && trimmedQuery.length >= 3) {
        fetchArtistCardForSearch(trimmedQuery, searchToken, data.tracks);
      }
    } catch (err) {
      if (state.searchToken !== searchToken) return;
      console.error('Search error:', err);
      const isOff = !navigator.onLine;
      if (el.searchTracksList) {
        stopM3SearchLoaderWithError(el.searchTracksList, isOff ? 'Offline: no internet connection' : (err && err.message ? err.message : String(err)));
      }
    }
  }

  if (el.mainContent) {
    el.mainContent.addEventListener('scroll', async () => {
      const isSearchShowing = (el.searchResults && !el.searchResults.classList.contains('hidden')) || (el.searchResultsContainer && !el.searchResultsContainer.classList.contains('hidden'));
      if (state.currentView === 'discover' && isSearchShowing) {
        if (el.mainContent.scrollTop + el.mainContent.clientHeight >= el.mainContent.scrollHeight - 280) {
          if (state.searchHasMore && !state.searchLoadingMore && state.searchQuery) {
            state.searchLoadingMore = true;
            try {
              const searchPlat = localStorage.getItem('riff_library_enabled') !== '0' ? 'rifflibrary' : state.platform;
              const reqToken = state.searchToken;
              const res = await fetch(`http://127.0.0.1:${state.serverPort}/api/search?q=${encodeURIComponent(state.searchQuery)}&platform=${searchPlat}&limit=12&offset=${state.searchOffset}`);
              const moreData = await res.json();
              if (state.searchToken !== reqToken) return;
              if (moreData && moreData.success && Array.isArray(moreData.tracks) && moreData.tracks.length > 0) {
                const moreTracks = moreData.tracks;
                const currentCanonicalId = state.currentTrack ? getTrackCanonicalId(state.currentTrack) : '';
                const startIdx = (state.searchResults || []).length;
                state.searchResults = (state.searchResults || []).concat(moreTracks);
                if (el.searchTracksList) el.searchTracksList._virtualTracks = state.searchResults;
                if (el.searchTracksList) {
                  const fragment = document.createDocumentFragment();
                  moreTracks.forEach((t, i) => {
                    const row = createTrackRow(t, startIdx + i, currentCanonicalId, 'search', state.searchResults, el.searchTracksList);
                    fragment.appendChild(row);
                  });
                  el.searchTracksList.appendChild(fragment);
                  if (typeof applySearchFilter === 'function') applySearchFilter(currentSearchFilter);
                }
                state.searchOffset += moreTracks.length;
                state.searchHasMore = !!moreData.hasMore;
                prefetchVisibleTracks(moreTracks);
              } else {
                state.searchHasMore = false;
              }
            } catch (err) {
              console.error('Infinite scroll search error:', err);
            } finally {
              state.searchLoadingMore = false;
            }
          }
        }
      }
    }, { passive: true });
  }


  var explicitTrackCache = window.explicitTrackCache || new Set();
  window.explicitTrackCache = explicitTrackCache;


  function getCtxTipCount() {
    const raw = parseInt(localStorage.getItem('riff_ctx_tip_v2') || '0', 10);
    return Number.isFinite(raw) ? raw : 0;
  }

  function setCtxTipCount(val) {
    try { localStorage.setItem('riff_ctx_tip_v2', String(val)); } catch (_) {}
  }

  function ensureTrackHoverTipEl() {
    if (!tgTipEl) {
      tgTipEl = document.createElement('div');
      tgTipEl.className = 'riff-tg-tip';
      document.body.appendChild(tgTipEl);
    }
    tgTipEl.textContent = typeof t === 'function' ? t('Tip: press right mouse button to see more features') : 'Tip: press right mouse button to see more features';
    return tgTipEl;
  }

  function bindTrackHoverTip(row, track) {
    if (!row) return;
    let lastClientX = 0;

    row.addEventListener('pointermove', (e) => {
      lastClientX = e.clientX;
    }, { passive: true });

    row.addEventListener('mouseenter', (e) => {
      lastClientX = e.clientX;
      if (getCtxTipCount() >= 3) return;
      if (ctxMenuEl && ctxMenuEl.classList.contains('open')) return;

      if (tgTipDwellTimer) clearTimeout(tgTipDwellTimer);
      if (tgTipCountTimer) clearTimeout(tgTipCountTimer);
      if (tgTipHideTimer) clearTimeout(tgTipHideTimer);

      tgTipDwellTimer = setTimeout(() => {
        if (getCtxTipCount() >= 3) return;
        if (ctxMenuEl && ctxMenuEl.classList.contains('open')) return;

        const tip = ensureTrackHoverTipEl();
        const r = row.getBoundingClientRect();
        const x = Math.min(window.innerWidth - 300, Math.max(16, (lastClientX || r.left + 80) + 12));
        const y = Math.max(12, r.top - 32);
        tip.style.left = `${x}px`;
        tip.style.top = `${y}px`;
        tip.classList.add('visible');

        const trackKey = String(track?.id || '') + '::' + String(track?.title || '');
        tgTipCountTimer = setTimeout(() => {
          const now = Date.now();
          if (trackKey !== lastCountedTrackKey && (now - lastCountedTipTs > 3500)) {
            lastCountedTrackKey = trackKey;
            lastCountedTipTs = now;
            setCtxTipCount(getCtxTipCount() + 1);
          }
        }, 800);

        tgTipHideTimer = setTimeout(() => {
          tip.classList.remove('visible');
        }, 2800);
      }, 420);
    });

    row.addEventListener('mouseleave', () => {
      if (tgTipDwellTimer) { clearTimeout(tgTipDwellTimer); tgTipDwellTimer = null; }
      if (tgTipCountTimer) { clearTimeout(tgTipCountTimer); tgTipCountTimer = null; }
      if (tgTipHideTimer) { clearTimeout(tgTipHideTimer); tgTipHideTimer = null; }
      if (tgTipEl) tgTipEl.classList.remove('visible');
    });
  }

  function closeTrackContextMenu() {
    if (ctxMenuEl) ctxMenuEl.classList.remove('open');
  }

  function ensureContextMenu() {
    if (!ctxMenuEl) {
      ctxMenuEl = document.createElement('div');
      ctxMenuEl.className = 'riff-ctx-menu';
      document.body.appendChild(ctxMenuEl);
      document.addEventListener('pointerdown', (ev) => {
        if (!ctxMenuEl || !ctxMenuEl.classList.contains('open')) return;
        if (performance.now() - ctxMenuOpenedAt < 180) return;
        if (ctxMenuEl.contains(ev.target)) return;
        closeTrackContextMenu();
      });
      window.addEventListener('wheel', (ev) => {
        if (!ctxMenuEl || !ctxMenuEl.classList.contains('open')) return;
        if (ctxMenuEl.contains(ev.target) || ctxMenuEl.matches(':hover')) return;
        closeTrackContextMenu();
      }, { passive: true });
      window.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape') closeTrackContextMenu();
      });
    }
    return ctxMenuEl;
  }

  function showInAppContextMenu(e, items) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
    if (ctxMenuEl && ctxMenuEl.classList.contains('open')) {
      closeTrackContextMenu();
      return;
    }
    ctxMenuOpenedAt = performance.now();
    ensureContextMenu();

    ctxMenuEl.innerHTML = '';
    items.forEach((it) => {
      if (it.divider) {
        const div = document.createElement('div');
        div.className = 'riff-ctx-divider';
        ctxMenuEl.appendChild(div);
        return;
      }
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'riff-ctx-item' + (it.active ? ' is-active' : '') + (it.danger ? ' danger' : '');
      const lbl = typeof t === 'function' ? t(it.label) : it.label;
      btn.innerHTML = `${it.icon || ''}<span>${lbl}</span>`;
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        closeTrackContextMenu();
        it.action();
      });
      ctxMenuEl.appendChild(btn);
    });

    ctxMenuEl.classList.remove('open');
    ctxMenuEl.style.left = '0px';
    ctxMenuEl.style.top = '0px';
    const rect = ctxMenuEl.getBoundingClientRect();
    let clientX = e ? e.clientX : 0;
    let clientY = e ? e.clientY : 0;
    if ((!clientX && !clientY) && e && e.currentTarget) {
      const b = e.currentTarget.getBoundingClientRect();
      clientX = b.left;
      clientY = b.bottom + 4;
    }
    const posX = (clientX + rect.width + 12 > window.innerWidth) ? (clientX - rect.width) : clientX;
    const posY = (clientY + rect.height + 12 > window.innerHeight) ? (clientY - rect.height) : clientY;
    ctxMenuEl.style.left = `${Math.max(8, posX)}px`;
    ctxMenuEl.style.top = `${Math.max(8, posY)}px`;
    requestAnimationFrame(() => {
      if (ctxMenuEl) ctxMenuEl.classList.add('open');
    });
  }


  function openPlaylistInAppMenu(e, plId) {
    const targetPlId = plId || state.currentPlaylistId;
    if (!targetPlId) return;
    const pinned = isPlaylistPinned(targetPlId);
    const items = [
      {
        id: 'pin-sidebar',
        active: pinned,
        label: pinned ? 'Unpin from sidebar' : 'Pin to sidebar',
        icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="' + (pinned ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 3h6l-1 7 3 3v2H7v-2l3-3-1-7z"/></svg>',
        action: () => togglePinPlaylist(targetPlId)
      },
      {
        id: 'add-local-files',
        label: 'Add local files',
        icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>',
        action: () => {
          if (typeof addLocalFilesToPlaylist === 'function') addLocalFilesToPlaylist(targetPlId);
        }
      },
      {
        id: 'rescan-source',
        label: 'Re-search streaming tracks',
        icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6"/><path d="M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>',
        action: () => {
          const pl = (state.playlists || []).find(p => p.id === targetPlId);
          if (!pl || !Array.isArray(pl.tracks)) return;
          rescanTracksToCurrentPlatform(pl.tracks, pl.name || 'Playlist', () => {
            localStorage.setItem('devsize_playlists', JSON.stringify(state.playlists));
            renderPlaylistsList();
            if (state.currentView === 'playlist-detail' && state.currentPlaylistId === pl.id) {
              openPlaylistDetail(pl.id);
            }
          });
        }
      },
      {
        id: 'download',
        label: 'Download all',
        icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
        action: () => triggerPlaylistMenuAction('download', targetPlId)
      },
      {
        id: 'export',
        label: 'Export as JSON',
        icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
        action: () => triggerPlaylistMenuAction('export', targetPlId)
      },
      { divider: true },
      {
        id: 'delete',
        label: 'Delete playlist',
        danger: true,
        icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
        action: () => triggerPlaylistMenuAction('delete', targetPlId)
      }
    ];
    showInAppContextMenu(e, items);
  }
  window.openPlaylistInAppMenu = openPlaylistInAppMenu;

  function openAlbumInAppMenu(e, albumObj) {
    const curAlbum = albumObj || state.currentAlbum;
    if (!curAlbum) return;
    const items = [
      {
        id: 'download',
        label: 'Download all',
        icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
        action: () => openDownloadAllModal({ name: curAlbum.title || 'Album', tracks: curAlbum._tracks || [] })
      },
      {
        id: 'add-to-playlist',
        label: 'Add all to playlist',
        icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
        action: () => openAddToPlaylistModal(curAlbum._tracks || [])
      }
    ];
    showInAppContextMenu(e, items);
  }
  window.openAlbumInAppMenu = openAlbumInAppMenu;

  window.addEventListener('contextmenu', (ev) => {
    if (ctxMenuEl && ctxMenuEl.classList.contains('open')) {
      ev.preventDefault();
      ev.stopPropagation();
      closeTrackContextMenu();
      return;
    }
  }, true);


  function openTrackContextMenu(e, track, options = {}) {
    if (ctxMenuEl && ctxMenuEl.classList.contains('open')) {
      closeTrackContextMenu();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    if (!track) return;
    const capturedCurTime = (typeof options.timestamp === 'number' && Number.isFinite(options.timestamp))
      ? options.timestamp
      : ((state.currentTrack && isSameTrack(state.currentTrack, track) && el.nativeAudio) ? el.nativeAudio.currentTime : 0);
    ctxMenuOpenedAt = performance.now();
    setCtxTipCount(3);
    if (tgTipEl) tgTipEl.classList.remove('visible');

    ensureContextMenu();

    const isFav = typeof isTrackFavorited === 'function'
      ? isTrackFavorited(track)
      : state.favorites.some(f => (f.id && f.id === track.id) || (f.title === track.title && f.artist === track.artist));

    const ANIMATED_IMAGES_SVG = '<svg viewBox="0 -960 960 960" fill="currentColor"><path d="m460-380 280-180-280-180v360ZM320-240q-33 0-56.5-23.5T240-320v-480q0-33 23.5-56.5T320-880h480q33 0 56.5 23.5T880-800v480q0 33-23.5 56.5T800-240H320Zm0-80h480v-480H320v480ZM160-80q-33 0-56.5-23.5T80-160v-560h80v560h560v80H160Zm160-720v480-480Z"/></svg>';

    const items = [
      {
        id: 'fav',
        active: isFav,
        label: isFav ? 'Remove from Favorites' : 'Favorite',
        icon: isFav
          ? '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>'
          : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
        action: () => {
          const favBtn = options.row ? options.row.querySelector('.btn-fav, .btn-fav-track, .btn-row-fav') : null;
          if (favBtn) favBtn.click();
          else if (typeof toggleFavoriteTrack === 'function') toggleFavoriteTrack(track, options.row);
          else if (typeof toggleFavorite === 'function') toggleFavorite(track, options.row);
        }
      },
      {
        id: 'playlist',
        label: 'Add to playlist',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
        action: () => {
          if (typeof openAddToPlaylistModal === 'function') openAddToPlaylistModal(track);
        }
      },
      {
        id: 'queue',
        label: 'Add to queue',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="16" y2="18"/><polygon points="3 6 3 10 6 8 3 6"/><line x1="19" y1="15" x2="19" y2="21"/><line x1="16" y1="18" x2="22" y2="18"/></svg>',
        action: () => addTrackToQueue(track)
      },
      {
        id: 'add-sidebar-lib',
        active: isTrackInSidebarLibrary(track),
        label: isTrackInSidebarLibrary(track) ? 'Remove from library' : 'Add to library',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>',
        action: () => toggleTrackInSidebarLibrary(track)
      },
      {
        id: 'pin-sidebar',
        active: isTrackPinnedToSidebar(track),
        label: isTrackPinnedToSidebar(track) ? 'Unpin from sidebar' : 'Pin to sidebar',
        icon: '<svg viewBox="0 0 24 24" fill="' + (isTrackPinnedToSidebar(track) ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 3h6l-1 7 3 3v2H7v-2l3-3-1-7z"/></svg>',
        action: () => togglePinTrackToSidebar(track)
      },
      ...(currentPinScope() ? [{
        id: 'pin',
        active: isTrackPinned(track),
        label: isTrackPinned(track) ? 'Unpin' : 'Pin to top',
        icon: '<svg viewBox="0 0 24 24" fill="' + (isTrackPinned(track) ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 3h6l-1 7 3 3v2H7v-2l3-3-1-7z"/></svg>',
        action: () => togglePinTrack(track)
      }] : []),
      {
        id: 'share',
        label: 'Share link',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 14 20 9 15 4"/><path d="M4 20v-7a4 4 0 0 1 4-4h12"/></svg>',
        action: () => {
          if (typeof executeCopyShareLink === 'function') executeCopyShareLink(track);
        }
      },
      {
        id: 'download',
        label: 'Download',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
        action: () => {
          if (typeof openDownloadModalForTrack === 'function') openDownloadModalForTrack(track);
          else {
            const dlBtn = options.row ? options.row.querySelector('.btn-download, [title*="Download"]') : null;
            if (dlBtn) dlBtn.click();
          }
        }
      },
      {
        id: 'banner',
        label: 'Change banner',
        icon: ANIMATED_IMAGES_SVG,
        action: () => {
          if (typeof openTrackArtModal === 'function') openTrackArtModal(track);
        }
      },
      {
        id: 'rename',
        label: 'Rename track',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
        action: () => {
          if (typeof openRenameTrackModal === 'function') openRenameTrackModal(track);
          else if (el.renameTrackModal) {
            state.renamingTrack = track;
            if (el.renameTitleInput) el.renameTitleInput.value = track.title || '';
            if (el.renameArtistInput) el.renameArtistInput.value = track.artist || '';
            openModal(el.renameTrackModal);
          }
        }
      },
      ...(track && track.platform !== 'local' ? [(() => {
        const isCurrentPlaying = Boolean(state.currentTrack && isSameTrack(state.currentTrack, track));
        const activeMeta = (isCurrentPlaying ? (state.currentTrack._sourceMeta || track._sourceMeta) : track._sourceMeta) || null;
        if (isCurrentPlaying && activeMeta && !track._sourceMeta) {
          track._sourceMeta = activeMeta;
        }
        const isNonSearchTrack = true;
        const origTitle = activeMeta?.title || (isCurrentPlaying ? state.currentTrack.title : track.title) || '';
        const origThumb = activeMeta?.thumbnail || (typeof getTrackThumbUrl === 'function' ? getTrackThumbUrl(isCurrentPlaying ? state.currentTrack : track) : (track.thumbnail || track.cover || ''));
        const srcPlatInfo = getTrackPlatformInfo({
          platform: activeMeta?.platform || (isCurrentPlaying ? state.currentTrack.platform : track.platform) || state.platform || 'ytmusic',
          url: activeMeta?.url || (isCurrentPlaying ? state.currentTrack.url : track.url) || '',
          id: activeMeta?.id || (isCurrentPlaying ? (state.currentTrack.resolvedYtId || state.currentTrack.id) : (track.resolvedYtId || track.id)) || ''
        });
        const iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>';
        
        return {
          id: 'reset-audio-source',
          label: 'Reset audio source',
          icon: iconSvg,
          isNonSearchTrack,
          isCurrentPlaying,
          origTitle,
          origThumb,
          sourcePlatformSvg: srcPlatInfo.svg,
          sourcePlatformName: srcPlatInfo.name,
          action: () => {
            resetTrackAudioSource(isCurrentPlaying ? state.currentTrack : track);
          }
        };
      })()] : []),
      {
        id: 'top-moment',
        label: (track && getTopMoment(track) !== null)
          ? (typeof t === 'function' ? t('Remove top moment') : 'Remove top moment')
          : `${typeof t === 'function' ? t('Set top moment here') : 'Set top moment here'} (${formatDuration(capturedCurTime)})`,
        icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>',
        action: () => {
          if (!track) return;
          if (getTopMoment(track) !== null) {
            removeTopMoment(track);
            showToast(typeof t === 'function' ? t('Top moment removed') : 'Top moment removed');
          } else {
            setTopMoment(track, capturedCurTime);
            showToast((typeof t === 'function' ? t('Top moment set at') : 'Top moment set at') + ' ' + formatDuration(capturedCurTime));
          }
        }
      }
    ];

    if (state.currentView === 'playlist-detail' && state.currentPlaylist) {
      items.push({ divider: true });
      items.push({
        id: 'remove-pl',
        danger: true,
        label: 'Remove from playlist',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>',
        action: () => {
          const targetTrack = track || options.track;
          const targetId = targetTrack ? (targetTrack.id || targetTrack._id || (typeof getTrackCanonicalId === 'function' ? getTrackCanonicalId(targetTrack) : null)) : null;
          const targetRow = options.row || null;
          const targetIdx = typeof options.index === 'number' ? options.index : -1;
          const delBtn = options.row ? options.row.querySelector('.btn-delete, .btn-remove, .btn-row-remove-playlist') : null;
          if (delBtn) {
            delBtn.click();
          } else if (targetId) {
            removeTrackFromCurrentPlaylist(targetId, targetRow, targetIdx);
          }
        }
      });
    } else if (state.currentView === 'queue' && typeof options.index === 'number') {
      items.push({ divider: true });
      items.push({
        id: 'remove-q',
        danger: true,
        label: 'Remove from queue',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
        action: () => {
          removeTrackFromQueue(options.index, options.row);
        }
      });
    } else if (state.currentView === 'local') {
      items.push({ divider: true });
      items.push({
        id: 'remove-local',
        danger: true,
        label: 'Remove from Riff',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>',
        action: () => {
          removeTracksFromLocalLibrary([track]);
        }
      });
    }

    items.push({ divider: true });
    const trackBlocked = isTrackBlocked(track);
    items.push({
      id: 'block-track',
      danger: true,
      label: trackBlocked ? 'Unblock track' : 'Block track',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>',
      action: () => {
        toggleBlockTrack(track);
      }
    });
    if (track.artist) {
      const artistBlocked = isArtistBlocked(track.artist);
      items.push({
        id: 'block-artist',
        danger: true,
        label: artistBlocked ? 'Unblock artist' : 'Block artist',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="18" y1="8" x2="23" y2="13"/><line x1="23" y1="8" x2="18" y2="13"/></svg>',
        action: () => {
          toggleBlockArtist(track.artist);
        }
      });
    }

    ctxMenuEl.innerHTML = '';
    items.forEach((it) => {
      if (it.divider) {
        const div = document.createElement('div');
        div.className = 'riff-ctx-divider';
        ctxMenuEl.appendChild(div);
        return;
      }
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'riff-ctx-item' + (it.active ? ' is-active' : '') + (it.danger ? ' danger' : '');
      const lbl = typeof t === 'function' ? t(it.label) : it.label;
      if (it.id === 'reset-audio-source' && it.isNonSearchTrack) {
        btn.innerHTML = `
          ${it.origThumb ? `<img class="riff-ctx-thumb" src="${escapeHtml(it.origThumb)}" alt="" style="width: 32px !important; height: 32px !important; min-width: 32px !important; min-height: 32px !important; border-radius: 4px !important; object-fit: cover !important; flex-shrink: 0 !important; display: block !important; margin-right: 6px;" onerror="this.style.display='none'">` : it.icon}
          <div style="display:flex;flex-direction:column;align-items:flex-start;overflow:hidden;text-align:left;line-height:1.2;flex:1;min-width:0;">
            <span>${lbl}</span>
            <small style="display:inline-flex;align-items:center;gap:4px;font-size:10px;opacity:0.75;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:190px;">
              <span class="riff-ctx-source-icon" title="${escapeHtml(it.sourcePlatformName || '')}" style="display:inline-flex;align-items:center;width:13px;height:13px;flex-shrink:0;">${it.sourcePlatformSvg || ''}</span>
              <span class="riff-ctx-subtitle" style="overflow:hidden;text-overflow:ellipsis;">${escapeHtml(it.origTitle || '')}</span>
            </small>
          </div>
        `;
        if (!track._sourceMeta && !it.isCurrentPlaying) {
          fetch(`http://127.0.0.1:${state.serverPort}/api/search?q=${encodeURIComponent((track.artist || '') + ' - ' + (track.title || ''))}&platform=${track.platform || 'ytmusic'}&limit=1`)
            .then(r => r.json())
            .then(sData => {
              const res = (sData && (sData.tracks || sData.results))?.[0];
              if (res) {
                track._sourceMeta = {
                  id: res.id || res.videoId,
                  title: res.title,
                  artist: res.artist,
                  thumbnail: res.thumbnail || res.cover || '',
                  platform: res.platform || track.platform || 'ytmusic',
                  url: res.url || ''
                };
                const thumbImg = btn.querySelector('.riff-ctx-thumb');
                const subTxt = btn.querySelector('.riff-ctx-subtitle');
                const srcIconEl = btn.querySelector('.riff-ctx-source-icon');
                if (thumbImg && track._sourceMeta.thumbnail) {
                  thumbImg.src = track._sourceMeta.thumbnail;
                  thumbImg.style.display = 'block';
                }
                if (subTxt && track._sourceMeta.title) {
                  subTxt.textContent = track._sourceMeta.title;
                }
                if (srcIconEl) {
                  const pInfo = getTrackPlatformInfo(track._sourceMeta);
                  srcIconEl.innerHTML = pInfo.svg;
                  srcIconEl.title = pInfo.name;
                }
              }
            }).catch(() => {});
        }
      } else {
        btn.innerHTML = `${it.icon}<span>${lbl}</span>`;
      }
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        closeTrackContextMenu();
        it.action();
      });
      ctxMenuEl.appendChild(btn);
    });

    ctxMenuEl.classList.remove('open');
    ctxMenuEl.style.left = '0px';
    ctxMenuEl.style.top = '0px';
    const rect = ctxMenuEl.getBoundingClientRect();
    const posX = (e.clientX + rect.width + 12 > window.innerWidth) ? (e.clientX - rect.width) : e.clientX;
    const posY = (e.clientY + rect.height + 12 > window.innerHeight) ? (e.clientY - rect.height) : e.clientY;
    ctxMenuEl.style.left = `${Math.max(8, posX)}px`;
    ctxMenuEl.style.top = `${Math.max(8, posY)}px`;
    requestAnimationFrame(() => {
      if (ctxMenuEl) ctxMenuEl.classList.add('open');
    });
  }
  window.openTrackContextMenu = openTrackContextMenu;

  var playbarLeftEl = document.querySelector('#playbar .playbar-left') || document.querySelector('.playbar-left');
  if (playbarLeftEl) {
    playbarLeftEl.addEventListener('contextmenu', (e) => {
      if (state.currentTrack) {
        openTrackContextMenu(e, state.currentTrack, { row: playbarLeftEl, index: state.queueIndex });
      }
    });
  }


  function getActiveViewTracksArray() {
    switch (state.currentView) {
      case 'playlist-detail':
        if (el.playlistTracksList && Array.isArray(el.playlistTracksList._virtualTracks)) return el.playlistTracksList._virtualTracks;
        return (state.currentPlaylist && state.currentPlaylist.tracks) || (state.playlists && state.playlists.find(p => p.id === state.currentPlaylistId)?.tracks) || [];
      case 'favorites':
        if (el.favoritesTracksList && Array.isArray(el.favoritesTracksList._virtualTracks)) return el.favoritesTracksList._virtualTracks;
        return state.favorites || [];
      case 'local':
        if (el.localTracksList && Array.isArray(el.localTracksList._virtualTracks)) return el.localTracksList._virtualTracks;
        return getLocalTracksArray();
      case 'queue':
        return state.queue || [];
      case 'artist':
        return state.artistTracks || (state.currentArtistData && state.currentArtistData.tracks) || [];
      case 'album':
        return (state.currentAlbum && state.currentAlbum.tracks) || (currentAlbumForFeedback && currentAlbumForFeedback.tracks) || [];
      case 'history':
        return state.history || [];
      case 'discover':
        return state.searchResults || Array.from(document.querySelectorAll('#search-tracks-list .track-row')).map(r => r._trackData).filter(Boolean);
      default:
        return Array.from(document.querySelectorAll('.track-row')).map(r => r._trackData).filter(Boolean);
    }
  }
  window.getActiveViewTracksArray = getActiveViewTracksArray;

  function clearTrackSelection() {
    if (state.selectedTracks) {
      state.selectedTracks.clear();
    }
    document.querySelectorAll('.track-row.track-selected').forEach(row => {
      row.classList.remove('track-selected');
    });
    state.lastClickedTrackRow = null;
    if (document.body) document.body.classList.remove('track-selection-mode');
    updateBulkSelectBar();
  }
  window.clearTrackSelection = clearTrackSelection;

  function updateBulkSelectBar() {
    const bar = document.getElementById('bulk-select-bar');
    const countEl = document.getElementById('bulk-select-count');
    const btnRemove = document.getElementById('btn-bulk-remove');
    const count = (state.selectedTracks && state.selectedTracks.size) || 0;
    if (document.body) document.body.classList.toggle('track-selection-mode', count > 0);
    if (!bar) return;
    if (count > 0) {
      bar.classList.remove('hidden');
      if (countEl) countEl.textContent = `${count} selected`;
      if (btnRemove) {
        const canRemove = state.currentView === 'playlist-detail' || state.currentView === 'queue' || state.currentView === 'local';
        btnRemove.style.display = canRemove ? '' : 'none';
      }
    } else {
      bar.classList.add('hidden');
    }
  }

  var btnBulkSelectAll = document.getElementById('btn-bulk-select-all');
  if (!btnBulkSelectAll) {
    const bar = document.getElementById('bulk-select-bar');
    const countEl = document.getElementById('bulk-select-count');
    if (bar) {
      btnBulkSelectAll = document.createElement('button');
      btnBulkSelectAll.type = 'button';
      btnBulkSelectAll.className = 'btn-outline-pill';
      btnBulkSelectAll.id = 'btn-bulk-select-all';
      btnBulkSelectAll.style.cssText = 'height: 32px; padding: 0 14px; font-size: 12px;';
      btnBulkSelectAll.textContent = 'Select all';
      if (countEl && countEl.nextSibling) {
        bar.insertBefore(btnBulkSelectAll, countEl.nextSibling);
      } else {
        bar.appendChild(btnBulkSelectAll);
      }
    }
  }
  if (btnBulkSelectAll) {
    btnBulkSelectAll.addEventListener('click', () => {
      const activeTracks = getActiveViewTracksArray();
      if (!activeTracks || activeTracks.length === 0) return;
      if (!state.selectedTracks) state.selectedTracks = new Map();

      const allSelected = activeTracks.every(t => {
        const k = getTrackSelectionKey(t);
        return k && state.selectedTracks.has(k);
      });

      if (allSelected) {
        clearTrackSelection();
      } else {
        activeTracks.forEach(t => {
          const k = getTrackSelectionKey(t);
          if (k) state.selectedTracks.set(k, t);
        });
        document.querySelectorAll('.track-row').forEach(row => {
          if (row._trackData) {
            const k = getTrackSelectionKey(row._trackData);
            if (state.selectedTracks.has(k)) {
              row.classList.add('track-selected');
            }
          } else {
            row.classList.add('track-selected');
          }
        });
        updateBulkSelectBar();
      }
    });
  }

  var btnBulkAddPlaylist = document.getElementById('btn-bulk-add-playlist');
  if (btnBulkAddPlaylist) {
    btnBulkAddPlaylist.addEventListener('click', () => {
      if (!state.selectedTracks || state.selectedTracks.size === 0) return;
      const selected = Array.from(state.selectedTracks.values());
      openAddToPlaylistModal(selected);
    });
  }

  var btnBulkAddFav = document.getElementById('btn-bulk-add-fav');
  if (btnBulkAddFav) {
    btnBulkAddFav.addEventListener('click', () => {
      if (!state.selectedTracks || state.selectedTracks.size === 0) return;
      const selected = Array.from(state.selectedTracks.values());
      let added = 0;
      selected.forEach(track => {
        if (!state.favorites.some(f => isSameTrack(f, track))) {
          state.favorites.unshift(stampAddedAt(track));
          added++;
        }
      });
      localStorage.setItem('devsize_favorites', JSON.stringify(state.favorites));
      updateFavoritesBadge();
      updateFavoriteIcon();
      if (state.currentView === 'favorites') {
        selected.slice().reverse().forEach(t => animateAddFavoriteTrackRow(t));
      }
      document.querySelectorAll('.track-row.track-selected .btn-row-fav svg').forEach(svg => {
        svg.setAttribute('fill', 'currentColor');
      });
      showToast(typeof t === 'function' ? t(`Added ${selected.length} tracks to favorites`) : `Added ${selected.length} tracks to favorites`, 'success');
      clearTrackSelection();
    });
  }

  var btnBulkRemove = document.getElementById('btn-bulk-remove');
  if (btnBulkRemove) {
    btnBulkRemove.addEventListener('click', () => {
      if (!state.selectedTracks || state.selectedTracks.size === 0) return;
      const selected = Array.from(state.selectedTracks.values());
      if (state.currentView === 'local') {
        removeTracksFromLocalLibrary(Array.from(state.selectedTracks.values()));
        state.selectedTracks.clear();
        if (document.body) document.body.classList.remove('track-selection-mode');
        const bulkBar = document.getElementById('bulk-select-bar');
        if (bulkBar) bulkBar.classList.add('hidden');
        clearTrackSelection();
        showToast('Removed from Local Files');
        return;
      }
      if (state.currentView === 'playlist-detail') {
        const pl = state.playlists.find(p => p.id === state.currentPlaylistId);
        if (pl && Array.isArray(pl.tracks)) {
          const selKeys = new Set(Array.from(state.selectedTracks.keys()));
          pl.tracks = pl.tracks.filter(t => !selKeys.has(getTrackSelectionKey(t)));
          localStorage.setItem('devsize_playlists', JSON.stringify(state.playlists));
          renderPlaylistsList();
          openPlaylistDetail(state.currentPlaylistId);
          showToast(`Removed ${selected.length} track${selected.length === 1 ? '' : 's'}`);
        }
      } else if (state.currentView === 'queue') {
        const selKeys = new Set(Array.from(state.selectedTracks.keys()));
        const removedIndices = [];
        state.queue.forEach((track, index) => {
          if (selKeys.has(getTrackSelectionKey(track))) removedIndices.push(index);
        });
        removeQueueTracks(removedIndices);
        showToast(`Removed tracks from queue`);
      }
      clearTrackSelection();
    });
  }

  var btnBulkClear = document.getElementById('btn-bulk-clear');
  if (btnBulkClear) {
    btnBulkClear.addEventListener('click', clearTrackSelection);
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.selectedTracks && state.selectedTracks.size > 0) {
      clearTrackSelection();
    }
  });

  function formatTrackDateAdded(ts) {
    if (!ts || !Number.isFinite(Number(ts))) return '';
    try {
      return new Date(Number(ts)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return '';
    }
  }

  var globalPlayCountCache = window.globalPlayCountCache || new Map();
  window.globalPlayCountCache = globalPlayCountCache;
  var _pendingPlayCountRequests = new Set();
  function requestTrackPlayCount(track, cb) {
    if (!track || !track.title || !track.artist) return;
    const cleanTitle = (track.title || '').replace(/\[.*?\]|\(.*?\)/g, '').replace(/official\s*(music)?\s*video|official\s*audio|lyrics|hd|4k|remastered|visualizer/gi, '').trim();
    const cleanArtist = (track.artist || '').replace(/\[.*?\]|\(.*?\)/g, '').replace(/- topic|vevo|records|official/gi, '').trim();
    const key = (cleanArtist + ':::' + cleanTitle).toLowerCase();
    if (globalPlayCountCache.has(key)) {
      cb(globalPlayCountCache.get(key));
      return;
    }
    if (_pendingPlayCountRequests.has(key)) return;
    _pendingPlayCountRequests.add(key);
    fetch(`https://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=4b4f73bda181868353f9b438604adf52&artist=${encodeURIComponent(cleanArtist)}&track=${encodeURIComponent(cleanTitle)}&format=json`)
      .then(res => res.json())
      .then(data => {
        _pendingPlayCountRequests.delete(key);
        const playcount = data && data.track && data.track.playcount ? parseInt(data.track.playcount, 10) : 0;
        if (playcount > 0) {
          globalPlayCountCache.set(key, playcount);
          cb(playcount);
        } else {
          globalPlayCountCache.set(key, 0);
        }
      })
      .catch(() => {
        _pendingPlayCountRequests.delete(key);
      });
  }

  function prefetchArtistPlayCounts(artistName) {
    if (!artistName) return;
    const cleanArtist = (artistName || '').replace(/\[.*?\]|\(.*?\)/g, '').replace(/- topic|vevo|records|official/gi, '').trim();
    fetch(`https://ws.audioscrobbler.com/2.0/?method=artist.gettoptracks&artist=${encodeURIComponent(cleanArtist)}&api_key=4b4f73bda181868353f9b438604adf52&format=json&limit=50`)
      .then(res => res.json())
      .then(data => {
        const list = data && data.toptracks && Array.isArray(data.toptracks.track) ? data.toptracks.track : [];
        let updated = false;
        list.forEach(item => {
          if (item && item.name && item.playcount) {
            const cleanTitle = (item.name || '').replace(/\[.*?\]|\(.*?\)/g, '').trim().toLowerCase();
            const k = (cleanArtist.toLowerCase() + ':::' + cleanTitle);
            const cnt = parseInt(item.playcount, 10);
            if (cnt > 0) {
              globalPlayCountCache.set(k, cnt);
              updated = true;
            }
          }
        });
        if (updated && state.currentView === 'artist') {
          document.querySelectorAll('#view-artist .track-row').forEach(row => {
            if (row._trackData) {
              const cnt = getArtistTrackPlaysCount(row._trackData);
              if (cnt > 0) {
                const playsEl = row.querySelector('.track-row-col-plays');
                if (playsEl) playsEl.textContent = cnt.toLocaleString('en-US');
              }
            }
          });
        }
      })
      .catch(() => {});
  }


  function createTrackRow(track, idx, currentCanonicalId, context, tracks, container) {
      if (track && track.artist) track.artist = stripYoutubeTopic(track.artist);
      applyTrackRenames(track);
      const row = document.createElement('div');
      row.className = 'track-row';
      row._trackData = track;
      row.tabIndex = 0;
      const selKey = getTrackSelectionKey(track);
      if (state.selectedTracks && state.selectedTracks.has(selKey)) {
        row.classList.add('track-selected');
      }
      const canonicalId = getTrackCanonicalId(track);
      row.dataset.canonicalId = canonicalId;
      row.dataset.trackIndex = String(idx);
      row.dataset.trackId = track.id || '';
      row.dataset.trackTitle = track.title || '';
      row.dataset.trackArtist = track.artist || '';

      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          row.click();
        }
      });

      const isMatch = currentCanonicalId && canonicalId === currentCanonicalId;
      if (isMatch) {
        if (state.currentTrackContext === context && state.currentTrackIndexInContext >= 0) {
          if (state.currentTrackIndexInContext === idx) {
            row.classList.add('playing');
          }
        } else {
          row.classList.add('playing');
        }
      }

      const isFav = state.favorites.some(f => isSameTrack(f, track));
      const rowThumb = getTrackThumbUrl(track);
      const isAlbum = context === 'album' && !(state.currentAlbum && (state.currentAlbum.type === 'Daily Mix' || String(state.currentAlbum.id || '').startsWith('daily-mix') || String(state.currentAlbum.id || '').startsWith('dm_')));
      const index = (isAlbum && track.no) ? (Number(track.no) - 1) : idx;
      const albumArtist = (track.albumArtist || '').trim().toLowerCase();
      const trackArtist = (track.artist || '').trim().toLowerCase();
      const showArtist = true;
      const explicitTag = isTrackExplicit(track) ? '<span class="explicit-badge" title="Explicit">E</span>' : '';
      const isUnavail = context === 'playlist' && Boolean(track.isUnavailable || track._gaveUp);
      const unavailBadgeHtml = isUnavail
        ? `<span class="track-unavail-wrap"><span class="track-unavail-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></span><span class="track-unavail-tip">${escapeHtml(t('Track was removed from the platform, so a cover or remix may play'))}</span></span>`
        : '';
      const titleContent = `<span class="track-title-text">${escapeHtml(track.title || 'untitled')}</span>`;
      const dateAddedStr = track.addedAt
        ? (() => {
            try {
              const rawDate = Number.isFinite(Number(track.addedAt)) ? Number(track.addedAt) : track.addedAt;
              const d = new Date(rawDate);
              return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            } catch (_) {
              return '';
            }
          })()
        : '';
      const albumStr = track.album || '';
      let playsStr = track.listenersText || track.playsText || '';
      const cacheKey = ((track.artist || '') + ':::' + (track.title || '')).toLowerCase().trim();
      if (!playsStr && (context === 'artist' || context === 'favorites' || context === 'playlist')) {
        const trackDirectPlays = Number(track.playCount || track.plays || 0);
        const cachedPlays = Number(globalPlayCountCache.get(cacheKey) || 0);
        const bestPlayCount = Math.max(trackDirectPlays, cachedPlays);
        if (bestPlayCount > 0) {
          playsStr = bestPlayCount.toLocaleString('en-US');
        } else if (track.listeners) {
          playsStr = Number(track.listeners).toLocaleString('en-US');
        } else {
          playsStr = '';
        }
      }
      const tableColsHtml = (context === 'favorites' || context === 'playlist' || context === 'artist')
        ? `<span class="track-row-col-album" title="${escapeHtml(albumStr)}">${escapeHtml(albumStr)}</span><span class="track-row-col-plays">${escapeHtml(playsStr)}</span><span class="track-row-col-date">${context !== 'artist' ? escapeHtml(dateAddedStr) : ''}</span>`
        : '';

      row.innerHTML = `
      <div class="track-row-num">
        <span class="track-num-text">${index + 1}</span>
        <div class="sp-playing-bars" aria-hidden="true">
          <div class="sp-bars-anim">
            <span class="bar b1"></span>
            <span class="bar b2"></span>
            <span class="bar b3"></span>
            <span class="bar b4"></span>
          </div>
          <svg class="sp-row-play-icon" viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><polygon points="6 4 20 12 6 20"></polygon></svg>
        </div>
        <span class="tg-select-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></span>
      </div>
      ${!isAlbum ? `
      <div class="track-row-thumb-wrap">
        <svg class="track-row-fallback-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
        ${rowThumb ? `<img class="track-row-thumb" src="${escapeHtml(rowThumb)}" alt="" decoding="async" onerror="this.style.display='none'">` : ''}
      </div>` : ''}
      <div class="track-row-info">
      <div class="track-row-title-row">
        <span class="track-row-title">${(context === 'favorites' || context === 'playlist') && isTrackPinned(track) ? '<svg class="track-pin-mark" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 3h6l-1 7 3 3v2H7v-2l3-3-1-7z"/></svg>' : ''}${titleContent}</span>
        ${unavailBadgeHtml}
      </div>
      <div class="track-row-artist-wrap">${explicitTag}${getTrackSourceBadgeHtml(track)}${showArtist ? `<span class="track-row-artist" title="view artist profile">${escapeHtml(track.artist || 'unknown artist')}</span>` : ''}</div>
      </div>
      ${tableColsHtml}
      <div class="track-row-actions">
        <button class="btn-icon-pill btn-row-fav btn-fav btn-fav-track" title="Favorite">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path></svg>
        </button>
        <button class="btn-icon-pill btn-row-add-playlist" title="Add to playlist">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </button>
        ${(context === 'local' || track.platform === 'local') ? `
        <button class="btn-icon-pill btn-row-remove-local btn-remove-local delete-btn" title="Remove from library">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
        </button>` : `
        <button class="btn-icon-pill btn-row-more" title="More options">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="2"></circle><circle cx="19" cy="12" r="2"></circle><circle cx="5" cy="12" r="2"></circle></svg>
        </button>`}
        ${context === 'queue' ? `
        <button class="btn-icon-pill btn-remove-from-queue delete-btn" title="Remove from queue">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>` : ''}
      </div>
      <span class="track-row-duration">${formatDuration(track.duration)}</span>
      `;

        const artistEl = row.querySelector('.track-row-artist');
        if (artistEl) renderClickableArtists(artistEl, track.artist, track);

        let prefetchTimer = null;
        row.addEventListener('mouseenter', () => {
          if (track.url && track.platform !== 'local') {
            prefetchTimer = setTimeout(() => {
              fetch(`http://127.0.0.1:${state.serverPort}/api/prefetch?url=${encodeURIComponent(track.url)}&id=${encodeURIComponent(track.id)}&platform=${track.platform || state.platform}`).catch(() => {});
            }, 120);
          }
        });
        row.addEventListener('mouseleave', () => {
          if (prefetchTimer) {
            clearTimeout(prefetchTimer);
            prefetchTimer = null;
          }
        });

        row.addEventListener('click', (e) => {
          if (e.target.closest('.track-row-actions') || e.target.closest('.artist-link-part')) return;
          if (e.target.classList.contains('track-row-artist')) {
            e.stopPropagation();
            if (track.platform === 'local' || String(track.id || '').startsWith('local_')) return;
            openArtistProfile(track.artist, track);
            return;
          }
          if (e.shiftKey || e.ctrlKey || e.metaKey || e.target.closest('.tg-select-check')) {
            e.preventDefault();
            e.stopPropagation();
            if (!state.selectedTracks) state.selectedTracks = new Map();
            const listData = (container && Array.isArray(container._virtualTracks)) ? container._virtualTracks : tracks;
            if (e.shiftKey && typeof state.lastClickedTrackIndex === 'number' && state.lastClickedTrackContainer === container && Array.isArray(listData)) {
              const [start, end] = state.lastClickedTrackIndex < idx ? [state.lastClickedTrackIndex, idx] : [idx, state.lastClickedTrackIndex];
              for (let i = start; i <= end; i++) {
                const tItem = listData[i];
                if (tItem) state.selectedTracks.set(getTrackSelectionKey(tItem), tItem);
              }
              if (container) {
                container.querySelectorAll('.track-row').forEach(r => {
                  if (r._trackData && state.selectedTracks.has(getTrackSelectionKey(r._trackData))) {
                    r.classList.add('track-selected');
                  }
                });
              }
            } else {
              const key = getTrackSelectionKey(track);
              if (state.selectedTracks.has(key)) {
                state.selectedTracks.delete(key);
                row.classList.remove('track-selected');
              } else {
                state.selectedTracks.set(key, track);
                row.classList.add('track-selected');
              }
            }
            state.lastClickedTrackRow = row;
            state.lastClickedTrackIndex = idx;
            state.lastClickedTrackContainer = container;
            updateBulkSelectBar();
            return;
          }
          state.lastClickedTrackRow = row;
          state.lastClickedTrackIndex = idx;
          state.lastClickedTrackContainer = container;
          if (typeof currentCanonicalId === 'function') {
            currentCanonicalId(track, idx);
            row.blur();
            return;
          }
          if (typeof autoplayEnabled === 'function' && autoplayEnabled() && context === 'history') {
            playTrack(track, [track], 0, context);
            row.blur();
            return;
          }
          if (context === 'search') {
            state.isRadioQueue = false;
            state.queue = [...tracks];
            recordSearchTrack(track);
            playTrack(track, tracks, idx, 'search');
            row.blur();
            return;
          }
          let clickIndex = idx;
          let currentList = tracks;
          if (context === 'favorites') {
            currentList = tracks || sortTracksFor('favorites', state.favorites);
            clickIndex = (currentList && currentList[idx] && isSameTrack(currentList[idx], track)) ? idx : currentList.findIndex(t => isSameTrack(t, track));
          } else if (context === 'playlist') {
            if (!currentList) {
              const pl = state.playlists.find(p => p.id === state.currentPlaylistId);
              if (pl && pl.tracks) currentList = sortTracksFor('playlist', pl.tracks, pl.id);
            }
            clickIndex = (currentList && currentList[idx] && isSameTrack(currentList[idx], track)) ? idx : (currentList ? currentList.findIndex(t => isSameTrack(t, track)) : idx);
          } else if (context === 'artist') {
            const artistTracks = (state.currentArtistData && state.currentArtistData.tracks) || tracks;
            if (artistTracks) {
              currentList = artistTracks;
              clickIndex = (artistTracks[idx] && isSameTrack(artistTracks[idx], track)) ? idx : artistTracks.findIndex(t => isSameTrack(t, track));
            }
          } else if (context === 'queue') {
            state.queueIndex = idx;
            if (typeof recordPlayedIndex === 'function') recordPlayedIndex(idx);
            playTrack(state.queue[idx]);
            row.blur();
            return;
          }
          playTrack(track, currentList, clickIndex >= 0 ? clickIndex : idx, context);
          row.blur();
        });

        const btnShare = row.querySelector('.btn-row-share');
        if (btnShare) {
          btnShare.addEventListener('click', (e) => {
            e.stopPropagation();
            executeCopyShareLink(track);
          });
        }

        const btnFav = row.querySelector('.btn-row-fav');
        if (btnFav) {
          btnFav.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFavoriteTrack(track, row);
            const isFavNow = state.favorites.some(f => isSameTrack(f, track));
            const svg = btnFav.querySelector('svg');
            if (svg) svg.setAttribute('fill', isFavNow ? 'currentColor' : 'none');
          });
        }

        const btnArt = row.querySelector('.btn-row-art');
        if (btnArt) {
          btnArt.addEventListener('click', (e) => {
            e.stopPropagation();
            openTrackArtModal(track, btnArt);
          });
        }

        const btnMore = row.querySelector('.btn-row-more');
        if (btnMore) {
          btnMore.addEventListener('click', (e) => {
            e.stopPropagation();
            const currentIndex = typeof row.dataset.trackIndex !== 'undefined' ? parseInt(row.dataset.trackIndex, 10) : idx;
            openTrackContextMenu(e, track, { row, index: Number.isNaN(currentIndex) ? idx : currentIndex });
          });
        }

        const btnAddPl = row.querySelector('.btn-row-add-playlist');
        if (btnAddPl) {
          btnAddPl.title = typeof t === 'function' ? t('Add to playlist') : 'Add to playlist';
          btnAddPl.addEventListener('click', (e) => {
            e.stopPropagation();
            openAddToPlaylistModal(track);
          });
        }

        const btnRemPl = row.querySelector('.btn-row-remove-playlist');
        if (btnRemPl) {
          btnRemPl.addEventListener('click', (e) => {
            e.stopPropagation();
            removeTrackFromCurrentPlaylist(track.id, row);
          });
        }

        const btnRemLocal = row.querySelector('.btn-row-remove-local, .btn-remove-local');
        if (btnRemLocal) {
          btnRemLocal.addEventListener('click', (e) => {
            e.stopPropagation();
            removeTracksFromLocalLibrary([track]);
          });
        }

        const btnRemQueue = row.querySelector('.btn-remove-from-queue');
        if (btnRemQueue) {
          btnRemQueue.addEventListener('click', (e) => {
            e.stopPropagation();
            const targetIdx = typeof row.dataset.trackIndex !== 'undefined' ? parseInt(row.dataset.trackIndex, 10) : idx;
            removeTrackFromQueue(Number.isNaN(targetIdx) ? idx : targetIdx, row);
          });
        }

        bindTrackHoverTip(row, track);
        row.addEventListener('contextmenu', (e) => {
          const currentIndex = typeof row.dataset.trackIndex !== 'undefined' ? parseInt(row.dataset.trackIndex, 10) : idx;
          openTrackContextMenu(e, track, { row, index: Number.isNaN(currentIndex) ? idx : currentIndex });
        });

        if ((context === 'favorites' || context === 'artist') && !playsStr && track.title && track.artist) {
          requestTrackPlayCount(track, (count) => {
            if (count > 0) {
              const playsEl = row.querySelector('.track-row-col-plays');
              if (playsEl) playsEl.textContent = Number(count).toLocaleString('en-US');
            }
          });
        }

      return row;
  }

  function renderTracks(container, tracks, context = 'search') {
    if (!container) return;
    container._virtualTracks = tracks;
    container._lastStartIndex = -1;
    container._lastEndIndex = -1;

    const scrollParent = document.querySelector('.main-content');
    if (container._vScrollHandler && scrollParent) {
      scrollParent.removeEventListener('scroll', container._vScrollHandler);
      container._vScrollHandler = null;
    }

    container.innerHTML = '';
    container.style.paddingTop = '0px';
    container.style.paddingBottom = '0px';

    if (!tracks || tracks.length === 0) {
      const emptyMessages = {
        search: 'No matching tracks. Try a different search',
        favorites: 'No favourites yet. Use the heart on a track to save it',
        playlist: 'This playlist is empty',
        local: 'Your library is empty. Add some music to get started'
      };
      container.innerHTML = `<div class="empty-hint">${emptyMessages[context] || 'No tracks to show'}</div>`;
      return;
    }

    const VIRTUAL_THRESHOLD = 60;
    if (tracks.length <= VIRTUAL_THRESHOLD || !scrollParent || context === 'search') {
      const currentCanonicalId = state.currentTrack ? getTrackCanonicalId(state.currentTrack) : '';
      const fragment = document.createDocumentFragment();
      for (let idx = 0; idx < tracks.length; idx++) {
        const row = createTrackRow(tracks[idx], idx, currentCanonicalId, context, tracks, container);
        row.style.setProperty('--row-idx', String(Math.min(idx, 20)));
        fragment.appendChild(row);
      }
      container.appendChild(fragment);
      highlightPlayingRow();
      if (typeof refreshOverflowFades === 'function') refreshOverflowFades(container);
      return;
    }

    const getRowStride = () => {
      if (container._rowStride && container._rowStride > 24) return container._rowStride;
      const isCompact = document.body.classList.contains('track-rows-compact');
      const baseH = isCompact ? 46 : (parseInt(localStorage.getItem('riff_track_row_height') || '64', 10) || 64);
      return baseH + 4;
    };

    const renderVirtualSlice = (isScrollUpdate = false) => {
      if (container._isDraggingReorder) return;
      const list = container._virtualTracks;
      if (!Array.isArray(list) || list.length === 0) return;
      const total = list.length;
      const stride = getRowStride();
      const scale = parseFloat(document.documentElement.style.getPropertyValue('--app-scale')) || 1;
      const cRect = container.getBoundingClientRect();
      const pRect = scrollParent.getBoundingClientRect();
      const relTop = Math.max(0, (pRect.top - cRect.top) / scale);
      const viewportH = (scrollParent.clientHeight || window.innerHeight || 800);
      const overscan = 10;
      const visibleCount = Math.ceil(viewportH / stride) + overscan * 2;
      const rawStart = Math.max(0, Math.floor(relTop / stride) - overscan);
      const snappedStart = Math.max(0, Math.min(Math.floor(rawStart / 4) * 4, Math.max(0, total - visibleCount)));
      const endIndex = Math.min(total, snappedStart + visibleCount);

      if (snappedStart === container._lastStartIndex && endIndex === container._lastEndIndex) return;
      container._lastStartIndex = snappedStart;
      container._lastEndIndex = endIndex;

      container.style.paddingTop = (snappedStart * stride) + 'px';
      container.style.paddingBottom = (Math.max(0, total - endIndex) * stride) + 'px';

      const currentCanonicalId = state.currentTrack ? getTrackCanonicalId(state.currentTrack) : '';
      const frag = document.createDocumentFragment();
      for (let idx = snappedStart; idx < endIndex; idx++) {
        const row = createTrackRow(list[idx], idx, currentCanonicalId, context, list, container);
        if (isScrollUpdate) {
          row.classList.add('no-enter-anim');
          row.style.animation = 'none';
        } else {
          row.style.setProperty('--row-idx', String(Math.min(idx - snappedStart, 16)));
        }
        frag.appendChild(row);
      }
      container.innerHTML = '';
      container.appendChild(frag);

      if (!container._rowStride) {
        const rows = container.querySelectorAll('.track-row');
        if (rows.length >= 2) {
          const measured = rows[1].offsetTop - rows[0].offsetTop;
          if (measured > 24 && measured < 150) container._rowStride = measured;
        }
      }
      highlightPlayingRow();
      if (typeof refreshOverflowFades === 'function') refreshOverflowFades(container);
    };

    renderVirtualSlice(false);

    let scrollRaf = 0;
    const onScroll = () => {
      if (scrollRaf) return;
      scrollRaf = requestAnimationFrame(() => {
        scrollRaf = 0;
        if (!container.isConnected) {
          scrollParent.removeEventListener('scroll', onScroll);
          return;
        }
        renderVirtualSlice(true);
      });
    };
    container._vScrollHandler = onScroll;
    scrollParent.addEventListener('scroll', onScroll, { passive: true });
  }

  function highlightPlayingRow() {
    const currentCanonicalId = state.currentTrack ? getTrackCanonicalId(state.currentTrack) : '';
    document.querySelectorAll('.track-row.playing').forEach(r => {
      if (!currentCanonicalId || r.dataset.canonicalId !== currentCanonicalId) {
        r.classList.remove('playing');
      }
    });

    if (!currentCanonicalId) return;

    try {
      const matches = document.querySelectorAll(`.track-row[data-canonical-id="${CSS.escape(currentCanonicalId)}"]`);
      if (matches.length === 1) {
        matches[0].classList.add('playing');
      } else if (matches.length > 1) {
        const targetIdx = String(state.currentTrackIndexInContext);
        const exact = Array.from(matches).find(r => r.dataset.trackIndex === targetIdx);
        if (exact) exact.classList.add('playing');
        else matches[0].classList.add('playing');
      }
    } catch (_) {}
  }

  var artistBioCache = new Map();


  function restoreDiscoverHomeState(forceHome = false) {
    const hasSearchQuery = !forceHome && el.searchInput && el.searchInput.value.trim().length > 0;
    const isSearchActive = hasSearchQuery && el.searchResultsContainer && !el.searchResultsContainer.classList.contains('hidden');

    if (isSearchActive) {
      if (el.discoverEmpty) el.discoverEmpty.classList.add('hidden');
      if (el.searchResultsContainer) {
        el.searchResultsContainer.classList.remove('hidden', 'view-hidden');
        el.searchResultsContainer.style.display = '';
      }
      if (typeof syncHomeAmbientVisibility === 'function') syncHomeAmbientVisibility();
      return;
    }

    if (forceHome || !hasSearchQuery) {
      if (el.searchInput) el.searchInput.value = '';
      if (el.searchClearBtn) el.searchClearBtn.classList.add('hidden');
      state.searchQuery = '';
      state.searchHasMore = false;
      const artistCardContainer = document.getElementById('search-artist-card-container');
      if (artistCardContainer) artistCardContainer.innerHTML = '';
      const albumsContainer = document.getElementById('search-albums-container');
      if (albumsContainer) albumsContainer.innerHTML = '';
      const playlistsContainer = document.getElementById('search-playlists-container');
      if (playlistsContainer) playlistsContainer.innerHTML = '';
    }

    if (el.searchResultsContainer) {
      el.searchResultsContainer.classList.add('hidden', 'view-hidden');
      el.searchResultsContainer.style.display = 'none';
    }
    if (el.discoverEmpty) {
      el.discoverEmpty.classList.remove('hidden');
      el.discoverEmpty.style.display = '';
    }
    if (el.discoverHome) {
      el.discoverHome.classList.remove('hidden');
      el.discoverHome.style.display = 'contents';
    }

    const isSpotify = (localStorage.getItem('riff_home_layout') || 'spotify') === 'spotify';
    document.body.classList.toggle('home-spotify', isSpotify);
    const spHome = document.getElementById('sp-home');
    const homeHero = document.getElementById('home-hero');

    if (isSpotify) {
      if (homeHero) homeHero.style.display = 'none';
      if (spHome) {
        spHome.classList.remove('hidden');
        spHome.style.display = '';
      }
      if (typeof renderSpotifyHome === 'function') renderSpotifyHome();
    } else {
      if (spHome) spHome.style.display = 'none';
      if (homeHero) {
        homeHero.classList.remove('hidden');
        homeHero.style.display = '';
      }
      if (typeof initHomeHero === 'function') initHomeHero();
    }
    if (typeof syncHomeAmbientVisibility === 'function') syncHomeAmbientVisibility();
  }

  var settingsCloseTimer = null;
  function openSettingsModal(cat) {
    if (!el.viewSettings) return;
    if (typeof resetSettingsSearch === 'function') resetSettingsSearch();
    if (settingsCloseTimer) { clearTimeout(settingsCloseTimer); settingsCloseTimer = null; }
    const savedCat = cat || localStorage.getItem('riff_settings_cat');
    el.viewSettings.classList.add('active', 'modal-open');
    el.viewSettings._activeCat = null;
    showSettingsCategory((savedCat === 'overview' || !savedCat) ? 'interface' : savedCat);
    setTimeout(() => {
      if (typeof syncAllThemeToggleIndicators === 'function') syncAllThemeToggleIndicators();
      updateOfflineStorageUI();
      updateMusicFolderUI();
      updateDownloadFolderUI();
      updateDownloadCaptionPath();
      checkToolsStatus(false);
    }, 60);
  }
  function closeSettingsModal() {
    if (typeof resetSettingsSearch === 'function') resetSettingsSearch();
    if (typeof updateAboutSupportLottieState === 'function') updateAboutSupportLottieState(false);
    const btnSbSettings = document.getElementById('btn-sb-settings');
    if (btnSbSettings) btnSbSettings.classList.remove('active');
    if (!el.viewSettings || !el.viewSettings.classList.contains('active')) return;
    el.viewSettings._activeCat = null;
    el.viewSettings.classList.remove('modal-open');
    if (settingsCloseTimer) clearTimeout(settingsCloseTimer);
    settingsCloseTimer = setTimeout(() => {
      settingsCloseTimer = null;
      if (el.viewSettings && !el.viewSettings.classList.contains('modal-open')) {
        el.viewSettings.classList.remove('active');
      }
    }, 200);
  }
  window.openSettingsModal = openSettingsModal;
  window.closeSettingsModal = closeSettingsModal;

  var pageNavHistory = {
    stack: [{ view: 'discover' }],
    index: 0,
    isNavigating: false,
    push(entry) {
      if (this.isNavigating || !entry || !entry.view || entry.view === 'settings') return;
      const cur = this.stack[this.index];
      if (cur && cur.view === entry.view) {
        if (entry.view === 'playlist-detail' && cur.id === entry.id) return;
        if (entry.view === 'album' && cur.album && entry.album && (cur.album.id === entry.album.id || cur.album === entry.album)) return;
        if (entry.view === 'artist' && cur.artist === entry.artist) return;
        if (entry.view !== 'playlist-detail' && entry.view !== 'album' && entry.view !== 'artist') return;
      }
      this.stack = this.stack.slice(0, this.index + 1);
      this.stack.push(entry);
      if (this.stack.length > 50) {
        this.stack.shift();
      }
      this.index = this.stack.length - 1;
      this.updateButtons();
    },
    back() {
      if (this.index > 0) {
        this.index--;
        this.go(this.stack[this.index]);
      }
    },
    forward() {
      if (this.index < this.stack.length - 1) {
        this.index++;
        this.go(this.stack[this.index]);
      }
    },
    go(entry) {
      if (!entry || !entry.view) return;
      this.isNavigating = true;
      try {
        if (entry.view === 'playlist-detail' && entry.id) {
          openPlaylistDetail(entry.id);
        } else if (entry.view === 'album' && entry.album) {
          openAlbum(entry.album);
        } else if (entry.view === 'artist' && entry.artist) {
          openArtistProfile(entry.artist);
        } else if (entry.view && entry.view !== 'settings') {
          switchView(entry.view);
        }
      } catch (err) {
        console.warn('pageNavHistory navigation error:', err);
      } finally {
        this.isNavigating = false;
        this.updateButtons();
      }
    },
    updateButtons() {
      const btnBack = document.getElementById('btn-nav-back');
      const btnForward = document.getElementById('btn-nav-forward');
      const canGoBack = this.index > 0;
      const canGoForward = this.index < this.stack.length - 1;
      if (btnBack) {
        btnBack.disabled = !canGoBack;
        btnBack.classList.toggle('disabled', !canGoBack);
      }
      if (btnForward) {
        btnForward.disabled = !canGoForward;
        btnForward.classList.toggle('disabled', !canGoForward);
      }
    }
  };
  window.pageNavHistory = pageNavHistory;

  function switchView(viewName) {
    if (typeof resetSettingsSearch === 'function') resetSettingsSearch();
    const btnSbSettings = document.getElementById('btn-sb-settings');
    if (btnSbSettings) btnSbSettings.classList.toggle('active', viewName === 'settings');
    if (viewName === 'settings') {
      openSettingsModal();
      return;
    }
    closeSettingsModal();
    clearTrackSelection();
    if (state.currentView === viewName) {
      if (viewName === 'playlist-detail' && state._activePlaylistDetailId !== state.currentPlaylistId) {
        state._activePlaylistDetailId = state.currentPlaylistId;
      } else {
        return;
      }
    }
    if (viewName === 'playlist-detail') {
      state._activePlaylistDetailId = state.currentPlaylistId;
    }
    if (state.currentView && state.currentView !== viewName) {
      state.previousView = state.currentView;
    }
    state.currentView = viewName;

    if (pageNavHistory && !pageNavHistory.isNavigating && viewName !== 'settings') {
      if (viewName === 'playlist-detail') {
        if (state.currentPlaylistId) {
          pageNavHistory.push({ view: 'playlist-detail', id: state.currentPlaylistId });
        }
      } else if (viewName === 'album') {
        if (state.currentAlbum) {
          pageNavHistory.push({ view: 'album', album: state.currentAlbum });
        }
      } else if (viewName === 'artist') {
        if (state.currentArtist) {
          pageNavHistory.push({ view: 'artist', artist: state.currentArtist });
        }
      } else {
        pageNavHistory.push({ view: viewName });
      }
    }

    [el.viewDiscover, el.viewFavorites, el.viewAlbums, el.viewLocal, el.viewHistory, el.viewQueue, el.viewPlaylistDetail, el.viewAlbum, el.viewArtist].forEach(v => {
      if (v) v.classList.remove('active');
    });

    const nestedView = viewName === 'playlist-detail' || viewName === 'album' || viewName === 'artist';
    if (!nestedView) {
      [el.navDiscover, el.navFavorites, el.navAlbums, el.navLocal, el.navHistory, el.navQueue, el.navSettings].forEach(n => {
        if (n) n.classList.remove('active');
      });
      const navMap = {
        discover: el.navDiscover,
        favorites: el.navFavorites,
        albums: el.navAlbums,
        local: el.navLocal,
        history: el.navHistory,
        queue: el.navQueue
      };
      if (navMap[viewName]) navMap[viewName].classList.add('active');
    }

    updateNavIndicator(true);
    const btnTopSearchHome = document.getElementById('btn-top-search-home');
    if (btnTopSearchHome) btnTopSearchHome.classList.toggle('active', viewName === 'discover');

    if (viewName === 'discover') {
      if (el.viewDiscover) el.viewDiscover.classList.add('active');
      restoreDiscoverHomeState(false);
      if (el.navDiscover) el.navDiscover.classList.add('active');
    } else if (viewName === 'favorites') {
      if (el.viewFavorites) el.viewFavorites.classList.add('active');
      if (el.navFavorites) el.navFavorites.classList.add('active');
      renderFavoritesView();
    } else if (viewName === 'albums') {
      if (el.viewAlbums) el.viewAlbums.classList.add('active');
      if (el.navAlbums) el.navAlbums.classList.add('active');
      renderSavedAlbums();
    } else if (viewName === 'local') {
      if (el.viewLocal) el.viewLocal.classList.add('active');
      if (el.navLocal) el.navLocal.classList.add('active');
      renderLocalView();
    } else if (viewName === 'history') {
      if (el.viewHistory) el.viewHistory.classList.add('active');
      if (el.navHistory) el.navHistory.classList.add('active');
      renderHistoryView();
    } else if (viewName === 'queue') {
      if (el.viewQueue) el.viewQueue.classList.add('active');
      if (el.navQueue) el.navQueue.classList.add('active');
      renderQueueView();
    } else if (viewName === 'playlist-detail') {
      if (el.viewPlaylistDetail) el.viewPlaylistDetail.classList.add('active');
    } else if (viewName === 'album') {
      if (el.viewAlbum) el.viewAlbum.classList.add('active');
    } else if (viewName === 'artist') {
      if (el.viewArtist) el.viewArtist.classList.add('active');
    } else if (viewName === 'settings') {
      openSettingsModal();
    }

    refreshNavBadges();
    highlightPlayingRow();
    if (typeof syncHomeAmbientVisibility === 'function') syncHomeAmbientVisibility();
    updateFxVisibility();
    if (typeof renderSidebarLibraryFeed === 'function') renderSidebarLibraryFeed();
    if (typeof updateActiveCoverBg === 'function') updateActiveCoverBg();
  }

  var cachedSidebarNav = null;
  var cachedSidebarNavItems = null;
  var cachedSettingsNav = null;
  var cachedAudioTabs = null;

  function getCachedSidebarNav() {
    if (!cachedSidebarNav || !cachedSidebarNav.isConnected) {
      cachedSidebarNav = document.querySelector('.sidebar-nav');
      cachedSidebarNavItems = null;
    }
    return cachedSidebarNav;
  }
  function getCachedSidebarNavItems() {
    const sNav = getCachedSidebarNav();
    if (!sNav) return [];
    if (!cachedSidebarNavItems || cachedSidebarNavItems.length === 0 || !cachedSidebarNavItems[0].isConnected) {
      cachedSidebarNavItems = [...sNav.querySelectorAll('.nav-item')];
    }
    return cachedSidebarNavItems;
  }
  function getCachedSettingsNav() {
    if (!cachedSettingsNav || !cachedSettingsNav.isConnected) {
      cachedSettingsNav = document.querySelector('.settings-nav');
    }
    return cachedSettingsNav;
  }
  function getCachedAudioTabs() {
    if (!cachedAudioTabs || !cachedAudioTabs.isConnected) {
      cachedAudioTabs = document.getElementById('audio-tabs');
    }
    return cachedAudioTabs;
  }

  function applyStackedRadius(container, itemSelector, horizontal) {
    if (!container) return;
    const raw = Array.isArray(container) ? container : (itemSelector ? [...container.querySelectorAll(itemSelector)] : [...container.children]);
    const items = raw.filter((n) => !n.classList.contains('hidden') && n.style.display !== 'none' && !n.hidden);
    const stackClasses = ['stack-only', 'stack-first', 'stack-mid', 'stack-last'];
    items.forEach((n, i) => {
      const target = items.length === 1 ? 'stack-only' : i === 0 ? 'stack-first' : i === items.length - 1 ? 'stack-last' : 'stack-mid';
      const needH = !!horizontal;
      if (n.classList.contains('stack-h') !== needH) n.classList.toggle('stack-h', needH);
      stackClasses.forEach((cls) => {
        if (cls === target) {
          if (!n.classList.contains(cls)) n.classList.add(cls);
        } else {
          if (n.classList.contains(cls)) n.classList.remove(cls);
        }
      });
    });
  }
  var stackRetry = false;
  var isRefreshingStacks = false;
  function refreshStacks() {
    if (isRefreshingStacks) return;
    isRefreshingStacks = true;
    try {
      const sNav = getCachedSidebarNav();
      if (sNav) {
        const all = getCachedSidebarNavItems();
        const visible = all.filter((n) => !n.classList.contains('hidden') && n.style.display !== 'none' && !n.hidden);
        if (all.length > 0 && visible.length === 0) {
          if (!stackRetry) {
            stackRetry = true;
            requestAnimationFrame(() => { stackRetry = false; refreshStacks(); });
          }
          return;
        }
        const stackClasses = ['stack-only', 'stack-first', 'stack-mid', 'stack-last', 'stack-h'];
        all.forEach((n) => {
          for (let c = 0; c < stackClasses.length; c++) {
            if (n.classList.contains(stackClasses[c])) n.classList.remove(stackClasses[c]);
          }
        });
      }
      applyStackedRadius(getCachedSettingsNav(), '.settings-nav-btn', false);
    } finally {
      if (stackObserver) stackObserver.takeRecords();
      isRefreshingStacks = false;
    }
  }

  var stackRaf = 0;
  var stackObserver = new MutationObserver(() => {
    if (isRefreshingStacks) return;
    if (stackRaf) return;
    stackRaf = requestAnimationFrame(() => {
      stackRaf = 0;
      refreshStacks();
    });
  });
  ['.sidebar-nav', '.settings-nav'].forEach((s) => {
    const n = document.querySelector(s);
    if (n) stackObserver.observe(n, { attributes: true, attributeFilter: ['class', 'style'], childList: true, subtree: true });
  });

var navIndicatorAnimId = 0;
var navIndicatorCurTop = null;
var navIndicatorCurBot = null;
var navItemCoordsCache = new Map();

function invalidateNavCoordsCache() {
  navItemCoordsCache.clear();
}
window.invalidateNavCoordsCache = invalidateNavCoordsCache;

function solveCubicBezier(p1x, p1y, p2x, p2y, x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  let t = x;
  for (let i = 0; i < 8; i++) {
    const inv = 1 - t;
    const curX = 3 * inv * inv * t * p1x + 3 * inv * t * t * p2x + t * t * t;
    const dx = 3 * inv * inv * p1x + 6 * inv * t * (p2x - p1x) + 3 * t * t * (1 - p2x);
    if (Math.abs(curX - x) < 1e-5 || Math.abs(dx) < 1e-5) break;
    t -= (curX - x) / dx;
  }
  t = Math.max(0, Math.min(1, t));
  const inv = 1 - t;
  return 3 * inv * inv * t * p1y + 3 * inv * t * t * p2y + t * t * t;
}

function getNavItemOffsetInSidebar(btn, nav) {
  if (!btn || !nav) return { top: 0, height: 48 };
  const cached = navItemCoordsCache.get(btn);
  if (cached) return cached;

  const ind = btn.querySelector('.nav-indicator') || btn;
  let y = 0;
  let cur = ind;
  while (cur && cur !== nav && cur !== document.body) {
    y += cur.offsetTop || 0;
    cur = cur.offsetParent;
  }
  const h = ind.offsetHeight || btn.offsetHeight || 48;
  const res = { top: y, height: h };
  navItemCoordsCache.set(btn, res);
  return res;
}

function moveNavIndicator(targetBtn, animate = true) {
  const indicator = document.getElementById('nav-active-indicator');
  const nav = document.querySelector('.sidebar-nav');
  if (!indicator || !nav) return;

  const allNavItems = typeof getCachedSidebarNavItems === 'function' ? getCachedSidebarNavItems() : nav.querySelectorAll('.nav-item');
  for (let i = 0; i < allNavItems.length; i++) {
    const b = allNavItems[i];
    if (b !== targetBtn && b.classList.contains('indicator-arrived')) {
      b.classList.remove('indicator-arrived');
    }
  }

  if (navIndicatorAnimId) {
    cancelAnimationFrame(navIndicatorAnimId);
    navIndicatorAnimId = 0;
  }

  const isReduced = !animate || document.body.classList.contains('perf') || document.documentElement.classList.contains('force-reduced-motion');

  if (!targetBtn || targetBtn.id === 'nav-discover' || targetBtn.classList.contains('nav-collapsed') || targetBtn.hidden || targetBtn.style.display === 'none' || !targetBtn.isConnected) {
    indicator.classList.add('is-hidden');
    targetBtn?.classList.add('indicator-arrived');
    return;
  }

  indicator.classList.remove('is-hidden');
  const box = getNavItemOffsetInSidebar(targetBtn, nav);
  const destTop = box.top;
  const destH = Math.max(44, box.height || 48);
  const destBot = destTop + destH;

  if (isReduced || navIndicatorCurTop === null || navIndicatorCurBot === null) {
    navIndicatorCurTop = destTop;
    navIndicatorCurBot = destBot;
    indicator.style.transform = `translate3d(0, ${destTop.toFixed(2)}px, 0)`;
    indicator.style.height = `${destH.toFixed(2)}px`;
    targetBtn.classList.add('indicator-arrived');
    return;
  }

  const startTop = navIndicatorCurTop;
  const startBot = navIndicatorCurBot;
  const dist = Math.abs(destTop - startTop);
  if (dist < 1.5) {
    navIndicatorCurTop = destTop;
    navIndicatorCurBot = destBot;
    indicator.style.transform = `translate3d(0, ${destTop.toFixed(2)}px, 0)`;
    indicator.style.height = `${destH.toFixed(2)}px`;
    targetBtn.classList.add('indicator-arrived');
    return;
  }

  const movingDown = destTop > startTop;
  const totalDur = Math.min(390, Math.max(310, 290 + Math.min(dist, 240) * 0.38));
  const maxPillH = Math.min(112, destH + Math.max(34, dist * 0.58));
  const startTime = performance.now();
  let arrivedSet = false;

  const step = (now) => {
    const rawT = Math.min(1, (now - startTime) / totalDur);
    const kLead = solveCubicBezier(0.2, 0.92, 0.28, 1, rawT);
    const kTrail = solveCubicBezier(0.46, 0.04, 0.24, 1, rawT);

    if (movingDown) {
      const bot = startBot + (destBot - startBot) * kLead;
      const rawTop = startTop + (destTop - startTop) * kTrail;
      navIndicatorCurBot = bot;
      navIndicatorCurTop = Math.min(bot - destH, Math.max(rawTop, bot - maxPillH));
    } else {
      const top = startTop + (destTop - startTop) * kLead;
      const rawBot = startBot + (destBot - startBot) * kTrail;
      navIndicatorCurTop = top;
      navIndicatorCurBot = Math.max(top + destH, Math.min(rawBot, top + maxPillH));
    }

    const curH = Math.max(destH, navIndicatorCurBot - navIndicatorCurTop);
    indicator.style.transform = `translate3d(0, ${navIndicatorCurTop.toFixed(2)}px, 0)`;
    indicator.style.height = `${curH.toFixed(2)}px`;

    if (!arrivedSet && rawT >= 0.45) {
      arrivedSet = true;
      targetBtn.classList.add('indicator-arrived');
    }

    if (rawT < 1) {
      navIndicatorAnimId = requestAnimationFrame(step);
    } else {
      navIndicatorAnimId = 0;
      navIndicatorCurTop = destTop;
      navIndicatorCurBot = destBot;
      indicator.style.transform = `translate3d(0, ${destTop.toFixed(2)}px, 0)`;
      indicator.style.height = `${destH.toFixed(2)}px`;
      targetBtn.classList.add('indicator-arrived');
    }
  };
  navIndicatorAnimId = requestAnimationFrame(step);
}

function updateNavIndicator(animate) {
  invalidateNavCoordsCache();
  refreshStacks();
  const active = document.querySelector('.sidebar-nav .nav-item.active');
  moveNavIndicator(active, animate);
}

  window.addEventListener('resize', () => {
    invalidateNavCoordsCache();
    updateNavIndicator(false);
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => {
    invalidateNavCoordsCache();
    updateNavIndicator(false);
  });
  var sidebarNavElem = document.querySelector('.sidebar-nav');
  if (sidebarNavElem) {
    refreshStacks();
    new ResizeObserver(() => {
      invalidateNavCoordsCache();
      if (!navIndicatorAnimId) updateNavIndicator(false);
    }).observe(sidebarNavElem);
  }

  function setPlayPauseState(playing, animate = true) {
    if (typeof setCoverRotationRate === 'function') setCoverRotationRate(playing);
    const btn = el.btnPlayPause;
    const tvkBtn = document.getElementById('btn-tvk-play');

    const tvkPlay = document.getElementById('tvk-play-icon');
    const tvkPause = document.getElementById('tvk-pause-icon');
    if (tvkPlay && tvkPlay.getAnimations) {
      try { tvkPlay.getAnimations().forEach(a => a.cancel()); } catch (e) {}
    }
    if (tvkPause && tvkPause.getAnimations) {
      try { tvkPause.getAnimations().forEach(a => a.cancel()); } catch (e) {}
    }
    if (el.playIcon && el.playIcon.getAnimations) {
      try { el.playIcon.getAnimations().forEach(a => a.cancel()); } catch (e) {}
    }
    if (el.pauseIcon && el.pauseIcon.getAnimations) {
      try { el.pauseIcon.getAnimations().forEach(a => a.cancel()); } catch (e) {}
    }

    if (tvkBtn) {
      if (tvkBtn._morphAnim) {
        try { tvkBtn._morphAnim.cancel(); } catch (e) {}
        tvkBtn._morphAnim = null;
      }
      tvkBtn.classList.toggle('playing', !!playing);
    }

    if (!btn) return;
    if (btn._morphAnim) {
      try { btn._morphAnim.cancel(); } catch (e) {}
      btn._morphAnim = null;
    }
    btn.classList.toggle('playing', !!playing);
  }

  var bufferingDebounceTimer = null;
  var loadingDelayTimer = null;

  function updatePlayPauseButton(isPlaying, isBuffering = false) {
    const actuallyPlaying = isPauseFading ? false : !!(isPlaying !== undefined ? isPlaying : (state.isPlaying || (el.nativeAudio && !el.nativeAudio.paused && !el.nativeAudio.ended)));
    const btn = el.btnPlayPause;
    const tvkBtn = document.getElementById('btn-tvk-play');
    const miniBtn = document.getElementById('btn-mini-play');
    const playButtons = [btn, tvkBtn, miniBtn].filter(Boolean);

    if (bufferingDebounceTimer) {
      clearTimeout(bufferingDebounceTimer);
      bufferingDebounceTimer = null;
    }

    const pbSpinner = document.getElementById('playbar-spinner');
    const tvkSpinner = document.getElementById('tvk-play-spinner');
    if (pbSpinner) pbSpinner.classList.add('hidden');
    if (tvkSpinner) tvkSpinner.classList.add('hidden');

    const loading = Boolean(isBuffering || state.isLoadingTrack);
    if (loading) {
      setPlayPauseState(true, true);
      if (!loadingDelayTimer) {
        loadingDelayTimer = setTimeout(() => {
          loadingDelayTimer = null;
          if (Boolean(isBuffering || state.isLoadingTrack)) {
            playButtons.forEach(b => {
              b.classList.remove('buffering');
              b.classList.add('is-loading');
            });
          }
        }, 500);
      }
    } else {
      if (loadingDelayTimer) {
        clearTimeout(loadingDelayTimer);
        loadingDelayTimer = null;
      }
      playButtons.forEach(b => {
        b.classList.remove('buffering');
        b.classList.remove('is-loading');
      });
      setPlayPauseState(actuallyPlaying, true);
    }
  }

  setPlayPauseState(false, false);

  function formatDuration(sec) {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  function formatPlaylistDuration(sec) {
    if (!sec || isNaN(sec) || sec <= 0) return '';
    const lang = (localStorage.getItem('riff_ui_lang') || localStorage.getItem('riff_lang') || (typeof state !== 'undefined' && state.lang) || 'en').toLowerCase();
    const isRu = lang === 'ru';
    const isUk = lang === 'uk';

    const totalMin = Math.round(sec / 60);
    const days = Math.floor(sec / 86400);
    const hours = Math.floor((sec % 86400) / 3600);
    const mins = Math.round((sec % 3600) / 60);

    if (days > 0) {
      if (isRu) return `${days} дн. ${hours > 0 ? hours + ' ч.' : ''}`.trim();
      if (isUk) return `${days} дн. ${hours > 0 ? hours + ' год.' : ''}`.trim();
      return `${days} d ${hours > 0 ? hours + ' hr' : ''}`.trim();
    }
    if (hours > 0) {
      if (isRu) return `${hours} ч. ${mins > 0 ? mins + ' мин.' : ''}`.trim();
      if (isUk) return `${hours} год. ${mins > 0 ? mins + ' хв.' : ''}`.trim();
      return `${hours} hr ${mins > 0 ? mins + ' min' : ''}`.trim();
    }
    const m = Math.max(1, totalMin);
    if (isRu) return `${m} мин.`;
    if (isUk) return `${m} хв.`;
    return `${m} min`;
  }

  if (el.btnResetVfx) {
    el.btnResetVfx.addEventListener('click', () => {
      state.vfx = { ...defaultVfx };
      localStorage.setItem('devsize_vfx', JSON.stringify(state.vfx));
      applyVisualEffects();
    });
  }

  if (window.electronAPI) {
    if (el.btnMinimize) el.btnMinimize.addEventListener('click', () => window.electronAPI.minimizeWindow());
    if (el.btnMaximize) el.btnMaximize.addEventListener('click', () => window.electronAPI.maximizeWindow());
    if (el.btnClose) el.btnClose.addEventListener('click', () => window.electronAPI.closeWindow());
  }

  function goHome() {
    if (typeof window.closeSpHomeCategory === 'function') window.closeSpHomeCategory();
    restoreDiscoverHomeState(true);
    switchView('discover');
  }

  document.querySelectorAll('.app-logo').forEach(logo => {
    logo.style.cursor = 'pointer';
    logo.style.pointerEvents = 'auto';
    logo.addEventListener('click', () => {
      goHome();
    });
  });

  var handleNavDiscoverClick = () => {
    goHome();
  };


  var btnTopSearchHome = document.getElementById('btn-top-search-home');
  if (btnTopSearchHome) {
    btnTopSearchHome.addEventListener('click', () => {
      goHome();
    });
  }

  if (el.navDiscover) {
    el.navDiscover.addEventListener('click', () => {
      goHome();
    });
  }
  document.querySelectorAll('.sidebar-nav .nav-item[data-view="discover"]').forEach(btn => {
    if (btn !== el.navDiscover) {
      btn.addEventListener('click', () => {
        goHome();
      });
    }
  });

  if (el.navFavorites) el.navFavorites.addEventListener('click', () => switchView('favorites'));
  if (el.navAlbums) el.navAlbums.addEventListener('click', () => switchView('albums'));
  if (el.navLocal) el.navLocal.addEventListener('click', () => switchView('local'));
  if (el.navHistory) el.navHistory.addEventListener('click', () => switchView('history'));
  if (el.navQueue) el.navQueue.addEventListener('click', () => switchView('queue'));
  if (el.navSettings) el.navSettings.addEventListener('click', () => switchView('settings'));
  updateAlbumsCount();

  var addLocalBtn = el.btnAddLocal || el.btnAddLocalFiles || document.getElementById('btn-add-local') || document.getElementById('btn-add-local-files');
  if (addLocalBtn) addLocalBtn.addEventListener('click', () => addLocalFiles());
  var addLocalFolderBtn = el.btnAddLocalFolder || document.getElementById('btn-add-local-folder');
  if (addLocalFolderBtn) addLocalFolderBtn.addEventListener('click', () => addLocalFolder());
  var addLocalFilesEmptyBtn = el.btnAddLocalFilesEmpty || document.getElementById('btn-add-local-files-empty');
  if (addLocalFilesEmptyBtn) addLocalFilesEmptyBtn.addEventListener('click', () => addLocalFiles());

  var btnPlayLocal = el.btnPlayLocal || document.getElementById('btn-play-local');
  if (btnPlayLocal) {
    btnPlayLocal.addEventListener('click', () => {
      const tracks = getLocalTracksArray();
      if (!tracks || !tracks.length) return;
      state.isRadioQueue = false;
      state.queueHistory = [];
      if (state.isShuffle) {
        state.isShuffle = false;
        localStorage.setItem('riff_shuffle', '0');
        if (el.btnShuffle) el.btnShuffle.classList.remove('active');
      }
      playTrack(tracks[0], tracks, 0, 'local');
    });
  }

  var btnShuffleLocal = el.btnShuffleLocal || document.getElementById('btn-shuffle-local');
  if (btnShuffleLocal) {
    btnShuffleLocal.addEventListener('click', () => {
      const tracks = getLocalTracksArray();
      if (!tracks || !tracks.length) return;
      const shuffled = [...tracks];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      state.isRadioQueue = false;
      state.queueHistory = [];
      if (!state.isShuffle) {
        state.isShuffle = true;
        localStorage.setItem('riff_shuffle', '1');
        if (el.btnShuffle) el.btnShuffle.classList.add('active');
      }
      playTrack(shuffled[0], shuffled, 0, 'local');
    });
  }

  if (el.btnAutoRemix) {
    el.btnAutoRemix.addEventListener('click', () => {
      state.isAutoRemix = !state.isAutoRemix;
      el.btnAutoRemix.classList.toggle('active', state.isAutoRemix);
    });
  }

  if (el.btnSavePresetDialog) {
    el.btnSavePresetDialog.addEventListener('click', () => {
      if (el.newPresetName) el.newPresetName.value = '';
      if (el.savePresetModal) openModal(el.savePresetModal);
      if (el.newPresetName) el.newPresetName.focus();
    });
  }

  if (el.btnCancelPreset) {
    el.btnCancelPreset.addEventListener('click', () => {
      if (el.savePresetModal) closeModal(el.savePresetModal);
    });
  }

  if (el.btnConfirmSavePreset) {
    el.btnConfirmSavePreset.addEventListener('click', () => {
      const name = el.newPresetName ? el.newPresetName.value : '';
      if (name.trim()) {
        saveCustomPreset(name);
        if (el.savePresetModal) closeModal(el.savePresetModal);
      }
    });
  }

  if (el.newPresetName) {
    el.newPresetName.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && el.btnConfirmSavePreset) el.btnConfirmSavePreset.click();
      if (e.key === 'Escape' && el.btnCancelPreset) el.btnCancelPreset.click();
    });
  }

  if (el.btnCancelRenamePreset) {
    el.btnCancelRenamePreset.addEventListener('click', () => {
      if (el.renamePresetModal) closeModal(el.renamePresetModal);
    });
  }

  if (el.btnConfirmRenamePreset) {
    el.btnConfirmRenamePreset.addEventListener('click', () => {
      const name = el.renamePresetName ? el.renamePresetName.value : '';
      if (name.trim() && state.presetToRenameId) {
        renameCustomPreset(state.presetToRenameId, name);
        if (el.renamePresetModal) closeModal(el.renamePresetModal);
      }
    });
  }

  if (el.renamePresetName) {
    el.renamePresetName.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && el.btnConfirmRenamePreset) el.btnConfirmRenamePreset.click();
      if (e.key === 'Escape' && el.btnCancelRenamePreset) el.btnCancelRenamePreset.click();
    });
  }

  var deletePresetModal = document.getElementById('delete-preset-modal');
  var btnCancelDeletePreset = document.getElementById('btn-cancel-delete-preset');
  var btnConfirmDeletePreset = document.getElementById('btn-confirm-delete-preset');

  if (btnCancelDeletePreset) {
    btnCancelDeletePreset.addEventListener('click', () => {
      if (deletePresetModal) closeModal(deletePresetModal);
    });
  }

  if (btnConfirmDeletePreset) {
    btnConfirmDeletePreset.addEventListener('click', () => {
      if (state.presetToDeleteId) {
        deleteCustomPreset(state.presetToDeleteId);
        state.presetToDeleteId = null;
      }
      if (deletePresetModal) closeModal(deletePresetModal);
    });
  }

  if (el.btnToggleLyricsPanel) {
    el.btnToggleLyricsPanel.addEventListener('click', () => {
      state.isRightPanelOpen = !state.isRightPanelOpen;
      if (el.rightPanel) el.rightPanel.classList.toggle('hidden', !state.isRightPanelOpen);
      el.btnToggleLyricsPanel.classList.toggle('active', state.isRightPanelOpen);
      if (state.isRightPanelOpen) {
        if (typeof showRpControls === 'function') showRpControls();
        updateLyricsPadding();
        state.forceSnapLyrics = true;
        state.forceLyricsScroll = true;
        state.lastActiveLyricIdx = -1;
        if (el.nativeAudio) updateSyncedLyricsHighlight(el.nativeAudio.currentTime || 0);
        requestAnimationFrame(() => {
          updateLyricsPadding();
          state.forceSnapLyrics = true;
          state.forceLyricsScroll = true;
          state.lastActiveLyricIdx = -1;
          if (el.nativeAudio) updateSyncedLyricsHighlight(el.nativeAudio.currentTime || 0);
        });
      }
      setTimeout(resizeCanvases, 150);
    });
  }

  var showRpControls = null;
  if (el.rightPanel) {
    let rpHideTimer = null;
    showRpControls = () => {
      el.rightPanel.classList.add('rp-controls-visible');
      if (rpHideTimer) clearTimeout(rpHideTimer);
      rpHideTimer = setTimeout(() => {
        el.rightPanel.classList.remove('rp-controls-visible');
      }, 1800);
    };
    el.rightPanel.addEventListener('mouseenter', showRpControls);
    el.rightPanel.addEventListener('pointermove', showRpControls, { passive: true });
    el.rightPanel.addEventListener('mouseleave', () => {
      if (rpHideTimer) clearTimeout(rpHideTimer);
      rpHideTimer = setTimeout(() => {
        el.rightPanel.classList.remove('rp-controls-visible');
      }, 350);
    });
  }

  if (el.btnCloseRightPanel) {
    el.btnCloseRightPanel.addEventListener('click', () => {
      state.isRightPanelOpen = false;
      if (el.rightPanel) el.rightPanel.classList.add('hidden');
      if (el.btnToggleLyricsPanel) el.btnToggleLyricsPanel.classList.remove('active');
      setTimeout(resizeCanvases, 150);
    });
  }

  if (el.rightPanelFallback) {
    el.rightPanelFallback.style.cursor = 'pointer';
    el.rightPanelFallback.addEventListener('click', () => {
      if (!state.currentTrack) {
        startWaveIfIdle();
      }
    });
  }

function bindCoverHoldZoom(wrapEl) {
  if (!wrapEl || wrapEl._holdZoomBound) return;
  wrapEl._holdZoomBound = true;
  let holdTimer = null, isZooming = false;
  const getImg = () => wrapEl.tagName === 'IMG' ? wrapEl : wrapEl.querySelector('img');
  const updateOrigin = (e) => {
    const img = getImg();
    if (!img) return;
    const r = wrapEl.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - r.left) / (r.width || 1)) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - r.top) / (r.height || 1)) * 100));
    img.style.transformOrigin = x + '% ' + y + '%';
    img.style.transform = 'scale(2.35)';
  };
  wrapEl.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    wrapEl._zoomedFlag = false;
    holdTimer = setTimeout(() => {
      const img = getImg();
      if (!img) return;
      isZooming = true;
      wrapEl._zoomedFlag = true;
      try { wrapEl.setPointerCapture(e.pointerId); } catch (_) {}
      img.style.transition = document.body.classList.contains('perf') ? 'none' : 'transform 180ms cubic-bezier(0.2, 0, 0, 1)';
      updateOrigin(e);
    }, 320);
  });
  wrapEl.addEventListener('pointermove', (e) => { if (isZooming) updateOrigin(e); });
  const endZoom = (e) => {
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
    if (isZooming) {
      isZooming = false;
      try { wrapEl.releasePointerCapture(e.pointerId); } catch (_) {}
      const img = getImg();
      if (img) {
        img.style.transition = document.body.classList.contains('perf') ? 'none' : 'transform 220ms cubic-bezier(0.2, 0, 0, 1)';
        img.style.transform = '';
      }
      setTimeout(() => { wrapEl._zoomedFlag = false; }, 80);
    }
  };
  wrapEl.addEventListener('pointerup', endZoom);
  wrapEl.addEventListener('pointercancel', endZoom);
  wrapEl.addEventListener('click', (e) => {
    if (wrapEl._zoomedFlag) { e.preventDefault(); e.stopImmediatePropagation(); wrapEl._zoomedFlag = false; }
  }, true);
}

  if (el.coverContainer) {
    el.coverContainer.style.cursor = 'pointer';
    bindCoverHoldZoom(el.coverContainer);
    el.coverContainer.addEventListener('click', (e) => {
      if (state.currentTrack && !el.coverContainer._zoomedFlag) {
        openTrackArtModal(state.currentTrack);
      } else if (!state.currentTrack) {
        if (e.target.closest('#btn-right-panel-art')) return;
        startWaveIfIdle();
      }
    });
  }

  var tvCoverEl = el.tvCover || document.getElementById('tv-cover');
  if (tvCoverEl) bindCoverHoldZoom(tvCoverEl);
  var plDetailCoverEl = document.getElementById('playlist-detail-cover');
  if (plDetailCoverEl) bindCoverHoldZoom(plDetailCoverEl);
  var albDetailCoverEl = document.getElementById('album-detail-cover');
  if (albDetailCoverEl) bindCoverHoldZoom(albDetailCoverEl);

  (function initPanelResize() {
    const edge = document.getElementById('panel-resize-edge');
    const panel = el.rightPanel || document.getElementById('right-panel');
    if (!edge || !panel) return;

    const savedWidth = localStorage.getItem('riff_right_panel_width');
    if (savedWidth) {
      const w = parseInt(savedWidth, 10);
      if (w >= 260 && w <= 720) {
        panel.style.width = `${w}px`;
        panel.style.setProperty('--right-panel-width', `${w}px`);
      }
    }

    let startX = 0;
    let startW = 0;
    let pendingW = 0;
    let raf = 0;

    const limits = () => ({ min: 260, max: Math.min(720, window.innerWidth - 300) });

    edge.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      edge.setPointerCapture(e.pointerId);
      startX = e.clientX;
      startW = panel.getBoundingClientRect().width;
      pendingW = Math.round(startW);
      edge.classList.add('dragging');
      document.body.classList.add('is-resizing-panel');
      e.preventDefault();
    });

    edge.addEventListener('pointermove', (e) => {
      if (!edge.hasPointerCapture(e.pointerId)) return;
      const { min, max } = limits();
      pendingW = Math.max(min, Math.min(max, Math.round(startW + (startX - e.clientX))));
      if (!raf) {
        raf = requestAnimationFrame(() => {
          raf = 0;
          panel.style.width = `${pendingW}px`;
          panel.style.setProperty('--right-panel-width', `${pendingW}px`);
          updateRightPanelTitleMarquee();
        });
      }
    });

    const stopDrag = (e) => {
      if (!edge.hasPointerCapture(e.pointerId)) return;
      try { edge.releasePointerCapture(e.pointerId); } catch (_) {}
      edge.classList.remove('dragging');
      document.body.classList.remove('is-resizing-panel');
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      if (pendingW >= 260 && pendingW <= 720) {
        localStorage.setItem('riff_right_panel_width', pendingW.toString());
      }
      if (typeof resizeCanvases === 'function') resizeCanvases();
      updateRightPanelTitleMarquee();
    };

    edge.addEventListener('pointerup', stopDrag);
    edge.addEventListener('pointercancel', stopDrag);

    edge.addEventListener('dblclick', () => {
      panel.style.width = '340px';
      panel.style.setProperty('--right-panel-width', '340px');
      localStorage.setItem('riff_right_panel_width', '340px');
      if (typeof resizeCanvases === 'function') resizeCanvases();
      updateRightPanelTitleMarquee();
    });
  })();

  if (el.searchInput) {
    el.searchInput.addEventListener('input', (e) => {
      const val = e.target.value;
      if (val && el.searchClearBtn) {
        el.searchClearBtn.classList.remove('hidden');
      } else if (el.searchClearBtn) {
        el.searchClearBtn.classList.add('hidden');
      }
      if (!val.trim()) {
        restoreDiscoverHomeState(true);
      }
    });

    el.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const val = el.searchInput.value.trim();
        if (val) performSearch(val);
      } else if (e.key === 'Escape') {
        restoreDiscoverHomeState(true);
      }
    });
  }

  if (el.searchIconBtn) {
    el.searchIconBtn.addEventListener('click', () => {
      const val = el.searchInput ? el.searchInput.value.trim() : '';
      if (val) performSearch(val);
    });
  }

  if (el.searchClearBtn) {
    el.searchClearBtn.addEventListener('click', () => {
      restoreDiscoverHomeState(true);
    });
  }


  var showYtPlatform = localStorage.getItem('riff_show_yt_platform') === '1';
  document.body.classList.toggle('show-yt-platform', showYtPlatform);

  function setPlatform(platform, triggerSearch = true) {
    if (platform === 'youtube' && localStorage.getItem('riff_show_yt_platform') !== '1') {
      platform = 'ytmusic';
    }
    if (!['youtube', 'ytmusic', 'soundcloud'].includes(platform)) platform = 'ytmusic';
    state.platform = platform;
    localStorage.setItem('riff_platform', platform);

    if (el.platformYt) el.platformYt.classList.toggle('active', platform === 'youtube');
    if (el.platformYtm) el.platformYtm.classList.toggle('active', platform === 'ytmusic');
    if (el.platformSc) el.platformSc.classList.toggle('active', platform === 'soundcloud');

    const select = document.getElementById('select-engine-api');
    if (select) select.value = platform;
    const label = document.getElementById('engine-api-label');
    const nameMap = { youtube: 'YouTube', ytmusic: 'YouTube Music', soundcloud: 'SoundCloud' };
    const platformSvgs = {
      youtube: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink:0;"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>',
      ytmusic: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink:0;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-2-12.5v9l6-4.5-6-4.5z"/></svg>',
      soundcloud: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink:0;"><path d="M11.5 14.5c0 .28-.22.5-.5.5s-.5-.22-.5-.5v-4c0-.28.22-.5.5-.5s.5.22.5.5v4zm-2 0c0 .28-.22.5-.5.5s-.5-.22-.5-.5v-3c0-.28.22-.5.5-.5s.5.22.5.5v3zm-2 0c0 .28-.22.5-.5.5s-.5-.22-.5-.5v-2c0-.28.22-.5.5-.5s.5.22.5.5v2zm-2 0c0 .28-.22.5-.5.5s-.5-.22-.5-.5v-1c0-.28.22-.5.5-.5s.5.22.5.5v1zm14.5-.5c0 1.93-1.57 3.5-3.5 3.5H13V9.1c.7-.6 1.6-1.1 2.6-1.1 2.2 0 4.1 1.6 4.4 3.8.3-.2.7-.3 1-.3 1.4 0 2.5 1.1 2.5 2.5z"/></svg>'
    };
    if (label) {
      label.style.display = 'inline-flex';
      label.style.alignItems = 'center';
      label.style.gap = '8px';
      label.innerHTML = `${platformSvgs[platform] || ''}<span>${nameMap[platform] || 'YouTube'}</span>`;
    }
    const menu = document.getElementById('engine-api-menu');
    if (menu) {
      menu.querySelectorAll('.m3-dropdown-option').forEach(opt => {
        const val = opt.dataset.value;
        opt.style.display = 'flex';
        opt.style.alignItems = 'center';
        opt.style.gap = '8px';
        opt.innerHTML = `${platformSvgs[val] || ''}<span>${nameMap[val] || opt.textContent}</span>`;
        opt.classList.toggle('selected', val === platform);
      });
    }

    if (triggerSearch && el.searchInput && el.searchInput.value.trim()) {
      performSearch(el.searchInput.value);
    }
  }

  var savedPlatform = localStorage.getItem('riff_platform') || 'ytmusic';
  setPlatform(savedPlatform, false);

  if (el.platformYt) el.platformYt.addEventListener('click', () => setPlatform('youtube'));
  if (el.platformYtm) el.platformYtm.addEventListener('click', () => setPlatform('ytmusic'));
  if (el.platformSc) el.platformSc.addEventListener('click', () => setPlatform('soundcloud'));

  var engineApiDropdown = document.getElementById('engine-api-dropdown');
  var engineApiTrigger = document.getElementById('engine-api-trigger');
  var engineApiMenu = document.getElementById('engine-api-menu');
  if (engineApiDropdown && engineApiTrigger && engineApiMenu) {
    engineApiTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      engineApiDropdown.classList.toggle('open');
    });

    engineApiMenu.querySelectorAll('.m3-dropdown-option').forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        const val = opt.dataset.value;
        setPlatform(val);
        engineApiDropdown.classList.remove('open');
      });
    });

    document.addEventListener('click', () => {
      engineApiDropdown.classList.remove('open');
    });
  }

  function updateEngineWidthVar() {
    const container = document.querySelector('.platform-switch-container');
    if (!container) return;
    const isHidden = document.body.classList.contains('hide-engine-btns') || document.body.classList.contains('riff-library-on');
    if (isHidden) {
      document.documentElement.style.setProperty('--engine-w', '0px');
      document.documentElement.style.setProperty('--engine-gap', '0px');
    } else {
      const isCompact = document.body.classList.contains('compact-engine-btns');
      const w = isCompact ? 124 : (container.offsetWidth || 435);
      if (w > 0) {
        document.documentElement.style.setProperty('--engine-w', `${w}px`);
        document.documentElement.style.setProperty('--engine-gap', '16px');
      }
    }
  }

  var btnShowYtPlatform = document.getElementById('btn-show-yt-platform');
  if (btnShowYtPlatform) {
    btnShowYtPlatform.classList.toggle('active', showYtPlatform);
    btnShowYtPlatform.addEventListener('click', () => {
      const next = !btnShowYtPlatform.classList.contains('active');
      btnShowYtPlatform.classList.toggle('active', next);
      localStorage.setItem('riff_show_yt_platform', next ? '1' : '0');
      document.body.classList.toggle('show-yt-platform', next);
      if (next) {
        showToast('Warning: YouTube may return non-music videos and load slower than YouTube Music', 'warning', 5000);
      } else if (state.platform === 'youtube') {
        setPlatform('ytmusic', false);
      }
      updateEngineWidthVar();
      setTimeout(updateEngineWidthVar, 350);
    });
  }

  var btnCompactEngineBtns = document.getElementById('btn-compact-engine-btns');
  var isCompactEngine = localStorage.getItem('riff_compact_engine_btns') === '1';
  document.body.classList.toggle('compact-engine-btns', isCompactEngine);
  if (btnCompactEngineBtns) {
    btnCompactEngineBtns.classList.toggle('active', isCompactEngine);
    btnCompactEngineBtns.addEventListener('click', () => {
      const next = !btnCompactEngineBtns.classList.contains('active');
      btnCompactEngineBtns.classList.toggle('active', next);
      document.body.classList.toggle('compact-engine-btns', next);
      localStorage.setItem('riff_compact_engine_btns', next ? '1' : '0');
      updateEngineWidthVar();
      setTimeout(updateEngineWidthVar, 350);
    });
  }

  var btnHideEngineBtns = document.getElementById('btn-hide-engine-btns');
  var isHideEngine = localStorage.getItem('riff_hide_engine_btns') === '1';
  document.body.classList.toggle('hide-engine-btns', isHideEngine);
  if (btnHideEngineBtns) {
    btnHideEngineBtns.classList.toggle('active', isHideEngine);
    btnHideEngineBtns.addEventListener('click', () => {
      const next = !btnHideEngineBtns.classList.contains('active');
      btnHideEngineBtns.classList.toggle('active', next);
      document.body.classList.toggle('hide-engine-btns', next);
      localStorage.setItem('riff_hide_engine_btns', next ? '1' : '0');
      updateEngineWidthVar();
      setTimeout(updateEngineWidthVar, 350);
    });
  }

  var isRiffLibOn = localStorage.getItem('riff_library_enabled') !== '0';
  var isRiffStreamOn = localStorage.getItem('riff_library_streaming') === '1';
  document.body.classList.toggle('riff-library-on', isRiffLibOn);
  updateEngineWidthVar();

  var btnRiffLibrary = document.getElementById('btn-riff-library');
  if (btnRiffLibrary) {
    btnRiffLibrary.classList.toggle('active', isRiffLibOn);
    btnRiffLibrary.addEventListener('click', () => {
      const next = !btnRiffLibrary.classList.contains('active');
      btnRiffLibrary.classList.toggle('active', next);
      localStorage.setItem('riff_library_enabled', next ? '1' : '0');
      document.body.classList.toggle('riff-library-on', next);
      updateEngineWidthVar();
      setTimeout(updateEngineWidthVar, 350);
      const q = (el.searchInput && el.searchInput.value.trim()) || state.searchQuery || '';
      if (q) performSearch(q);
    });
  }

  var btnRiffLibraryStreaming = document.getElementById('btn-riff-library-streaming');
  if (btnRiffLibraryStreaming) {
    btnRiffLibraryStreaming.classList.toggle('active', isRiffStreamOn);
    btnRiffLibraryStreaming.addEventListener('click', () => {
      const next = !btnRiffLibraryStreaming.classList.contains('active');
      btnRiffLibraryStreaming.classList.toggle('active', next);
      localStorage.setItem('riff_library_streaming', next ? '1' : '0');
    });
  }

  var btnPersistSound = document.getElementById('btn-persist-sound-settings');
  if (btnPersistSound) {
    btnPersistSound.classList.toggle('active', soundPersistenceEnabled);
    btnPersistSound.addEventListener('click', () => {
      const next = !btnPersistSound.classList.contains('active');
      btnPersistSound.classList.toggle('active', next);
      soundPersistenceEnabled = next;
      localStorage.setItem('riff_persist_sound_settings', next ? '1' : '0');
      if (next) persistSoundSettings();
    });
  }

  if (el.btnPlayPause) el.btnPlayPause.addEventListener('click', togglePlayPause);
  if (el.btnNext) setupSeekOrSkipButton(el.btnNext, playNext, 5);
  if (el.btnPrev) setupSeekOrSkipButton(el.btnPrev, playPrev, -5);

  if (el.btnShuffle) {
    el.btnShuffle.classList.toggle('active', state.isShuffle);
    el.btnShuffle.addEventListener('click', () => {
      state.isShuffle = !state.isShuffle;
      localStorage.setItem('riff_shuffle', state.isShuffle ? '1' : '0');
      el.btnShuffle.classList.toggle('active', state.isShuffle);
    });
  }

  if (el.btnRepeat) {
    el.btnRepeat.classList.toggle('active', state.isRepeat);
    el.btnRepeat.addEventListener('click', () => {
      state.isRepeat = !state.isRepeat;
      localStorage.setItem('riff_repeat', state.isRepeat ? '1' : '0');
      el.btnRepeat.classList.toggle('active', state.isRepeat);
    });
  }

  window.toggleShuffle = () => el.btnShuffle && el.btnShuffle.click();
  window.toggleRepeat = () => el.btnRepeat && el.btnRepeat.click();

  function updateVolumeSliderFill() {
    const slider = (el && el.volumeSlider) || document.getElementById('volume-slider');
    if (!slider) return;
    const slBox = slider.closest('.sl') || slider.parentElement;
    const v = state.isMuted ? 0 : (state.volume !== undefined ? state.volume : parseFloat(slider.value) || 0);
    if (slBox && slBox.classList.contains('sl')) slBox.style.setProperty('--v', String(v));
    slider.style.setProperty('--v', String(v));
  }
  window.updateVolumeSliderFill = updateVolumeSliderFill;

  function ensureVolumeSliderDOM() {
    const slider = (el && el.volumeSlider) || document.getElementById('volume-slider');
    if (!slider) return;
    if (slider.parentElement && slider.parentElement.classList.contains('sl')) {
      updateVolumeSliderFill();
      return;
    }
    const wrap = document.createElement('div');
    wrap.className = 'sl volume-sl';
    wrap.dataset.enhanced = 'true';
    wrap.innerHTML = '<div class="sl-inactive"></div><div class="sl-active"></div>';
    slider.parentNode.insertBefore(wrap, slider);
    wrap.appendChild(slider);
    slider.classList.add('sl-done');
    slider.dataset.enhanced = 'true';
    updateVolumeSliderFill();
  }

  function persistVolumeState() {
    try {
      localStorage.setItem('riff_volume', String(state.volume));
      localStorage.setItem('riff_muted', state.isMuted ? '1' : '0');
    } catch (e) {}
    updateVolumeSliderFill();
  }

  if (el.volumeSlider) {
    ensureVolumeSliderDOM();
    el.volumeSlider.value = String(state.volume);
    updateVolumeSliderFill();
    if (state.isMuted) {
      if (el.volumeIcon) el.volumeIcon.classList.add('hidden');
      if (el.volumeMutedIcon) el.volumeMutedIcon.classList.remove('hidden');
    }
    const volGroup = el.volumeSlider.closest('.volume-control-group') || el.volumeSlider;
    volGroup.addEventListener('wheel', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const step = e.deltaY < 0 ? 0.05 : -0.05;
      state.volume = Math.max(0, Math.min(1, Math.round((state.volume + step) * 100) / 100));
      if (state.volume > 0 && state.isMuted) state.isMuted = false;
      el.volumeSlider.value = String(state.volume);
      el.volumeSlider.dispatchEvent(new Event('input'));
    }, { passive: false });
    el.volumeSlider.addEventListener('input', (e) => {
      state.volume = parseFloat(e.target.value);
      state.isMuted = false;
      if (el.volumeIcon) el.volumeIcon.classList.remove('hidden');
      if (el.volumeMutedIcon) el.volumeMutedIcon.classList.add('hidden');
      persistVolumeState();
      applyAudioSettings();
    });
  }

  if (el.btnVolumeMute) {
    el.btnVolumeMute.addEventListener('click', () => {
      state.isMuted = !state.isMuted;
      if (state.isMuted) {
        if (el.volumeIcon) el.volumeIcon.classList.add('hidden');
        if (el.volumeMutedIcon) el.volumeMutedIcon.classList.remove('hidden');
      } else {
        if (el.volumeIcon) el.volumeIcon.classList.remove('hidden');
        if (el.volumeMutedIcon) el.volumeMutedIcon.classList.add('hidden');
      }
      persistVolumeState();
      applyAudioSettings();
    });
  }

  if (el.btnToggleFav) {
    el.btnToggleFav.addEventListener('click', () => {
      if (state.currentTrack) toggleFavoriteTrack(state.currentTrack);
    });
  }

  if (el.btnClearHistory) {
    el.btnClearHistory.addEventListener('click', () => {
      state.history = [];
      localStorage.setItem('devsize_history', '[]');
      renderHistoryView();
    });
  }

  if (el.btnClearQueue) {
    el.btnClearQueue.addEventListener('click', () => {
      state.isRadioQueue = false;
      state.queue = [];
      state.queueIndex = -1;
      state.queueHistory = [];
      updateQueueBadge();
      renderQueueView();
    });
  }

  var btnTogglePlaylistSearch = document.getElementById('btn-toggle-playlist-search');
  var playlistSearchBox = document.getElementById('playlist-search-box');
  if (btnTogglePlaylistSearch && playlistSearchBox) {
    btnTogglePlaylistSearch.addEventListener('click', () => {
      const isOpen = playlistSearchBox.classList.toggle('open');
      if (isOpen) {
        if (el.playlistSearchInput) el.playlistSearchInput.focus();
      } else {
        if (el.playlistSearchInput) {
          el.playlistSearchInput.value = '';
          if (state.currentPlaylistId) openPlaylistDetail(state.currentPlaylistId);
        }
      }
    });
  }
  if (el.playlistSearchInput) {
    el.playlistSearchInput.addEventListener('input', () => {
      if (state.currentPlaylistId) openPlaylistDetail(state.currentPlaylistId);
    });
    if (playlistSearchBox) {
      el.playlistSearchInput.addEventListener('blur', () => {
        if (!el.playlistSearchInput.value.trim()) {
          playlistSearchBox.classList.remove('open');
        }
      });
    }
  }
  if (el.btnBackPlaylists) el.btnBackPlaylists.addEventListener('click', () => switchView('discover'));

  var deletePlaylistModal = document.getElementById('delete-playlist-modal');
  var deletePlaylistMsg = document.getElementById('delete-playlist-msg');
  var btnCancelDeletePlaylist = document.getElementById('btn-cancel-delete-playlist');
  var btnConfirmDeletePlaylist = document.getElementById('btn-confirm-delete-playlist');

  if (el.btnDeletePlaylist) {
    el.btnDeletePlaylist.addEventListener('click', () => {
      const pl = state.playlists.find(p => p.id === state.currentPlaylistId);
      if (!pl) return;
      if (deletePlaylistMsg) deletePlaylistMsg.textContent = `Delete playlist "${pl.name}"? This action cannot be undone.`;
      if (deletePlaylistModal) openModal(deletePlaylistModal);
    });
  }

  if (btnCancelDeletePlaylist && deletePlaylistModal) {
    btnCancelDeletePlaylist.addEventListener('click', () => {
      closeModal(deletePlaylistModal);
    });
  }

  if (btnConfirmDeletePlaylist && deletePlaylistModal) {
    btnConfirmDeletePlaylist.addEventListener('click', () => {
      deleteCurrentPlaylist();
      closeModal(deletePlaylistModal);
      showToast('Playlist deleted');
    });
  }



  function setCpmTab(tab, animate = true) {
    const tabs = document.querySelectorAll('#cpm-tabs button');
    const paneNew = document.getElementById('cpm-pane-new');
    const paneImport = document.getElementById('cpm-pane-import');
    if (!paneNew || !paneImport) return;

    tabs.forEach(b => {
      b.classList.toggle('active', b.dataset.cpmTab === tab);
    });

    if (tab === 'new') {
      paneNew.classList.remove('hidden');
      paneImport.classList.add('hidden');
      if (animate) {
        paneNew.classList.remove('cpmSlideIn');
        void paneNew.offsetWidth;
        paneNew.classList.add('cpmSlideIn');
      }
      if (el.newPlaylistInput) el.newPlaylistInput.focus();
    } else {
      paneImport.classList.remove('hidden');
      paneNew.classList.add('hidden');
      if (animate) {
        paneImport.classList.remove('cpmSlideIn');
        void paneImport.offsetWidth;
        paneImport.classList.add('cpmSlideIn');
      }
    }
  }

  var cpmTabs = document.getElementById('cpm-tabs');
  if (cpmTabs) {
    cpmTabs.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-cpm-tab]');
      if (!btn) return;
      setCpmTab(btn.dataset.cpmTab, true);
    });
  }

  function returnToCreatePlaylistImport() {
    [
      document.getElementById('link-import-modal'),
      document.getElementById('spotify-import-modal'),
      document.getElementById('apple-import-modal')
    ].forEach(m => {
      if (m) {
        m.classList.remove('visible');
        m.classList.add('hidden');
      }
    });
    const cpm = document.getElementById('create-playlist-modal');
    if (cpm) {
      setCpmTab('import', false);
      openModal(cpm);
      const card = cpm.querySelector('.dialog-card');
      if (card) {
        card.classList.remove('cpm-slide-from-left');
        void card.offsetWidth;
        card.classList.add('cpm-slide-from-left');
        setTimeout(() => card.classList.remove('cpm-slide-from-left'), 250);
      }
    }
  }

  ['btn-spotify-back', 'btn-apple-back', 'btn-link-back'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener('click', returnToCreatePlaylistImport);
  });

  if (el.btnNewPlaylist) {
    el.btnNewPlaylist.addEventListener('click', () => {
      setCpmTab('new', false);
      if (el.newPlaylistInput) el.newPlaylistInput.value = '';
      if (el.createPlaylistModal) openModal(el.createPlaylistModal);
      if (el.newPlaylistInput) el.newPlaylistInput.focus();
    });
  }

  if (el.btnCancelNewPlaylist) {
    el.btnCancelNewPlaylist.addEventListener('click', () => {
      if (el.createPlaylistModal) closeModal(el.createPlaylistModal);
    });
  }

  if (el.btnConfirmNewPlaylist) {
    el.btnConfirmNewPlaylist.addEventListener('click', () => {
      const name = el.newPlaylistInput ? el.newPlaylistInput.value : '';
      if (name.trim()) {
        createPlaylist(name);
        if (el.createPlaylistModal) closeModal(el.createPlaylistModal);
      }
    });
  }

  if (el.newPlaylistInput) {
    el.newPlaylistInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && el.btnConfirmNewPlaylist) el.btnConfirmNewPlaylist.click();
      if (e.key === 'Escape' && el.btnCancelNewPlaylist) el.btnCancelNewPlaylist.click();
    });
  }

  if (el.btnCancelAddPlaylist) {
    el.btnCancelAddPlaylist.addEventListener('click', () => {
      if (el.addToPlaylistModal) closeModal(el.addToPlaylistModal);
    });
  }

  var btnCloseAddPlaylist = document.getElementById('btn-close-add-playlist-modal');
  if (btnCloseAddPlaylist) {
    btnCloseAddPlaylist.addEventListener('click', () => {
      if (el.addToPlaylistModal) closeModal(el.addToPlaylistModal);
    });
  }

  var btnCreatePlFromAdd = document.getElementById('btn-create-pl-from-add-modal');
  if (btnCreatePlFromAdd) {
    btnCreatePlFromAdd.addEventListener('click', () => {
      if (el.addToPlaylistModal) closeModal(el.addToPlaylistModal);
      if (el.createPlaylistModal) {
        setCpmTab('new', false);
        if (el.newPlaylistInput) el.newPlaylistInput.value = '';
        openModal(el.createPlaylistModal);
        if (el.newPlaylistInput) el.newPlaylistInput.focus();
      }
    });
  }

  document.querySelectorAll('.audio-tab').forEach((tab) => {
    if (tab.id === 'btn-reset-audio') return;
    tab.addEventListener('click', () => {
      document.querySelectorAll('.audio-tab:not(#btn-reset-audio)').forEach((t) => t.classList.toggle('active', t === tab));
      document.querySelectorAll('.audio-panel').forEach((p) => p.classList.toggle('active', p.dataset.audioPanel === tab.dataset.audioTab));
    });
  });

  function createDropletSpring(el, opts) {
    opts = opts || {};
    const STIFFNESS = 0.12;
    const DAMPING = 0.68;
    const dir = opts.from === 'top' ? -1 : 1;
    const baseX = opts.baseX || '0px';

    let isOpen = false, animT = 0, velocity = 0, rafId = null;

    function render() {
      const translateY = Math.max(0, (1 - animT) * 100) * dir;
      const scaleX = 1 - velocity * 0.12;
      const scaleY = 1 + velocity * 0.12;
      el.style.transform = 'translate3d(' + baseX + ', ' + translateY + '%, 0) scale(' + scaleX + ', ' + scaleY + ')';
    }

    function isReduced() {
      return document.body.classList.contains('perf') ||
        (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }

    function step() {
      if (isOpen) {
        const force = (1 - animT) * STIFFNESS;
        velocity = (velocity + force) * DAMPING;
        animT += velocity;
        if (Math.abs(1 - animT) < 0.002 && Math.abs(velocity) < 0.002) {
          animT = 1;
          velocity = 0;
          render();
          rafId = null;
          if (opts.onOpened) opts.onOpened();
          return;
        }
      } else {
        velocity = (velocity - animT * 0.18) * 0.62;
        animT = Math.max(0, animT + velocity);
        if (animT <= 0.003) {
          animT = 0;
          velocity = 0;
          render();
          rafId = null;
          if (opts.onClosed) opts.onClosed();
          return;
        }
      }
      render();
      rafId = requestAnimationFrame(step);
    }

    function open() {
      if (isReduced()) {
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
        isOpen = true;
        animT = 1;
        velocity = 0;
        el.style.transition = 'transform 150ms ease';
        el.style.transform = 'translate3d(' + baseX + ', 0%, 0) scale(1, 1)';
        setTimeout(() => {
          if (isOpen) {
            el.style.transition = '';
            if (opts.onOpened) opts.onOpened();
          }
        }, 150);
        return;
      }
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      isOpen = true;
      el.style.transition = '';
      if (animT === 0) {
        velocity = 0;
        render();
      }
      rafId = requestAnimationFrame(step);
    }

    function close() {
      if (isReduced()) {
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
        isOpen = false;
        animT = 0;
        velocity = 0;
        el.style.transition = 'transform 150ms ease';
        el.style.transform = 'translate3d(' + baseX + ', ' + (100 * dir) + '%, 0) scale(1, 1)';
        setTimeout(() => {
          if (!isOpen) {
            el.style.transition = '';
            if (opts.onClosed) opts.onClosed();
          }
        }, 150);
        return;
      }
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      isOpen = false;
      el.style.transition = '';
      rafId = requestAnimationFrame(step);
    }

    function toggle(forceOpen) {
      const target = forceOpen !== undefined ? forceOpen : !isOpen;
      if (target) open();
      else close();
    }

    return {
      open,
      close,
      toggle,
      get isOpen() { return isOpen; },
      render,
      step
    };
  }
  window.createDropletSpring = createDropletSpring;

  function attachWheelStepCarousel(track, itemSelector) {
    if (!track || track._wheelStepBound) return;
    track._wheelStepBound = true;
    let activeIdx = 0;
    let scrollPos = 0;
    let targetRaf = null;
    let wheelDebounceTimer = null;

    function snapStep() {
      const items = itemSelector ? track.querySelectorAll(itemSelector) : track.children;
      if (!items.length) { targetRaf = null; return; }
      activeIdx = Math.max(0, Math.min(items.length - 1, activeIdx));
      scrollPos += (activeIdx - scrollPos) * 0.25;
      const targetItem = items[activeIdx];
      const targetOffset = targetItem ? (targetItem.offsetLeft - track.offsetLeft) : 0;
      const currentOffset = track.scrollLeft;
      const nextScroll = currentOffset + (targetOffset - currentOffset) * 0.25;
      track.scrollLeft = nextScroll;
      if (Math.abs(targetOffset - nextScroll) > 0.5) {
        targetRaf = requestAnimationFrame(snapStep);
      } else {
        track.scrollLeft = targetOffset;
        scrollPos = activeIdx;
        targetRaf = null;
      }
    }

    track.addEventListener('wheel', (e) => {
      const items = itemSelector ? track.querySelectorAll(itemSelector) : track.children;
      if (items.length <= 1) return;
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(delta) < 2) return;
      e.preventDefault();
      if (wheelDebounceTimer) return;
      wheelDebounceTimer = setTimeout(() => { wheelDebounceTimer = null; }, 65);

      if (delta > 0 && activeIdx < items.length - 1) {
        activeIdx++;
      } else if (delta < 0 && activeIdx > 0) {
        activeIdx--;
      }
      if (!targetRaf) targetRaf = requestAnimationFrame(snapStep);
    }, { passive: false });
  }
  window.attachWheelStepCarousel = attachWheelStepCarousel;

  var audioCard = document.querySelector('.audio-menu-card');
  if (audioCard) audioCard.addEventListener('click', (e) => e.stopPropagation());

  var wheelTracks = audioCard ? audioCard.querySelectorAll('.preset-wheel, .buffer-wheel, .carousel-track, .audio-presets-wheel, [data-carousel]') : [];
  wheelTracks.forEach(tr => attachWheelStepCarousel(tr));
  if (el.presetsContainer) attachWheelStepCarousel(el.presetsContainer, '.preset-chip');


  function syncSleepTimerButtons(value) {
    if (!el.sleepTimerStatus) return;
    const panel = el.sleepTimerStatus.closest('.audio-panel');
    if (panel) {
      panel.querySelectorAll('[data-sleep-minutes], .sleep-min-pill').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.sleepMinutes === value);
      });
    }
    document.querySelectorAll('.sleep-min-pill').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.sleepMinutes === value);
    });
  }

  function updateSleepTimerUI() {
    const progEl = document.getElementById('sleep-timer-progress');
    if (!el.sleepTimerStatus) {
      if (progEl) progEl.style.width = '0%';
      return;
    }
    if (!state.sleepTimer) {
      el.sleepTimerStatus.textContent = '00:00';
      el.sleepTimerStatus.classList.remove('active');
      syncSleepTimerButtons(null);
      if (progEl) progEl.style.width = '0%';
      return;
    }
    el.sleepTimerStatus.classList.add('active');
    if (state.sleepTimer.mode === 'end') {
      el.sleepTimerStatus.textContent = 'End of track';
      syncSleepTimerButtons('end');
      if (progEl) progEl.style.width = '100%';
      return;
    }
    syncSleepTimerButtons(String(state.sleepTimer.minutes));
    const left = Math.max(0, state.sleepTimer.endsAt - Date.now());
    const totalMs = (state.sleepTimer.minutes || 1) * 60000;
    const mins = Math.floor(left / 60000);
    const secs = Math.floor((left % 60000) / 1000);
    el.sleepTimerStatus.textContent = `${mins}:${String(secs).padStart(2, '0')}`;
    if (progEl) progEl.style.width = Math.min(100, (left / totalMs) * 100).toFixed(1) + '%';
  }

  function fadeOutAndPause() {
    const from = state.isMuted ? 0 : state.volume;
    if (!from || !audioEngine || !audioEngine.setVolume) {
      pauseSmooth();
      return;
    }
    const started = Date.now();
    const step = () => {
      const p = Math.min(1, (Date.now() - started) / 4000);
      const k = Math.max(0, 1 - p);
      audioEngine.setVolume(Math.round(from * k), state.isMuted);
      if (k < 1) {
        requestAnimationFrame(step);
        return;
      }
      pauseSmooth();
      audioEngine.setVolume(state.volume, state.isMuted);
    };
    step();
  }

  function setSleepTimer(value) {
    if (sleepTimerInterval) {
      clearInterval(sleepTimerInterval);
      sleepTimerInterval = null;
    }
    if (value === 'off') {
      state.sleepTimer = null;
      updateSleepTimerUI();
      return;
    }
    if (value === 'end') {
      state.sleepTimer = { mode: 'end' };
      updateSleepTimerUI();
      return;
    }
    const minutes = Number(value);
    if (!Number.isFinite(minutes) || minutes <= 0) return;
    state.sleepTimer = { mode: 'minutes', minutes, endsAt: Date.now() + minutes * 60000 };
    updateSleepTimerUI();
    sleepTimerInterval = setInterval(() => {
      if (!state.sleepTimer || state.sleepTimer.mode !== 'minutes') return;
      if (state.sleepTimer.endsAt > Date.now()) {
        updateSleepTimerUI();
        return;
      }
      clearInterval(sleepTimerInterval);
      sleepTimerInterval = null;
      state.sleepTimer = null;
      updateSleepTimerUI();
      fadeOutAndPause();
    }, 1000);
  }

  if (el.sleepTimerStatus) {
    const sleepPanel = el.sleepTimerStatus.closest('.audio-panel');
    if (sleepPanel) {
      sleepPanel.querySelectorAll('[data-sleep-minutes]').forEach((btn) => {
        btn.addEventListener('click', () => setSleepTimer(btn.dataset.sleepMinutes));
      });
    }
  }

  var btnSleepAdd5 = document.getElementById('btn-sleep-add-5');
  if (btnSleepAdd5) {
    btnSleepAdd5.addEventListener('click', () => {
      if (state.sleepTimer?.mode === 'minutes') {
        state.sleepTimer.endsAt += 5 * 60000;
        state.sleepTimer.minutes += 5;
      } else {
        setSleepTimer(5);
      }
      updateSleepTimerUI();
    });
  }

  document.addEventListener('click', (e) => {
    const add5 = e.target.closest('#btn-sleep-add-5');
    if (add5) {
      if (state.sleepTimer?.mode === 'minutes') {
        state.sleepTimer.endsAt += 5 * 60000;
        state.sleepTimer.minutes += 5;
      } else {
        setSleepTimer(5);
      }
      updateSleepTimerUI();
    }
  });

  if (el.themeModeBtns) {
    el.themeModeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        state.themeMode = btn.dataset.themeMode;
        localStorage.setItem('riff_theme_mode', state.themeMode);
        updateThemeFromState();
      });
    });
  }

  if (el.themeSwatches) {
    el.themeSwatches.forEach(sw => {
      sw.addEventListener('click', () => {
        state.themeAccent = sw.dataset.color;
        localStorage.setItem('riff_theme_accent', state.themeAccent);
        if (state.themeMode === 'auto') {
          const targetMode = currentEffectiveMode || 'dark';
          state.themeMode = targetMode;
          localStorage.setItem('riff_theme_mode', targetMode);
        }
        updateThemeFromState();
      });
    });
  }

  if (el.customColorInput) {
    const applyCustomAccent = (value) => {
      if (!/^#[0-9a-f]{6}$/i.test(value)) return;
      state.themeAccent = value.toLowerCase();
      localStorage.setItem('riff_theme_accent', state.themeAccent);
      if (state.themeMode === 'auto') {
        const targetMode = currentEffectiveMode || 'dark';
        state.themeMode = targetMode;
        localStorage.setItem('riff_theme_mode', targetMode);
      }
      updateThemeFromState();
      if (el.themeSwatches) el.themeSwatches.forEach(sw => sw.classList.remove('active'));
    };
    el.customColorInput.addEventListener('input', (e) => applyCustomAccent(e.target.value));
    el.customColorInput.addEventListener('change', (e) => applyCustomAccent(e.target.value));
  }

  if (el.sliderHue) {
    el.sliderHue.addEventListener('input', (e) => {
      const h = parseInt(e.target.value, 10);
      if (el.valHue) el.valHue.textContent = h + '°';
    });
    el.sliderHue.addEventListener('change', (e) => {
      const h = parseInt(e.target.value, 10);
      if (el.valHue) el.valHue.textContent = h + '°';
      state.themeAccent = hslToHex(h, 65, 55);
      localStorage.setItem('riff_theme_accent', state.themeAccent);
      if (state.themeMode === 'auto') {
        const targetMode = currentEffectiveMode || 'dark';
        state.themeMode = targetMode;
        localStorage.setItem('riff_theme_mode', targetMode);
      }
      updateThemeFromState();
      if (el.themeSwatches) el.themeSwatches.forEach(sw => sw.classList.remove('active'));
    });
  }

  if (el.sliderIntensity) {
    el.sliderIntensity.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      if (el.valIntensity) el.valIntensity.textContent = val + '%';
    });
    el.sliderIntensity.addEventListener('change', (e) => {
      const val = parseInt(e.target.value, 10);
      state.themeIntensity = val;
      document.body.classList.toggle('intensity-zero', state.themeIntensity < 5);
      if (el.valIntensity) el.valIntensity.textContent = val + '%';
      localStorage.setItem('riff_theme_intensity', val.toString());
      if (state.themeMode === 'auto') {
        const targetMode = currentEffectiveMode || 'dark';
        state.themeMode = targetMode;
        localStorage.setItem('riff_theme_mode', targetMode);
      }
      updateThemeFromState();
    });
  }

  if (el.sliderBrightness) {
    el.sliderBrightness.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      if (el.valBrightness) el.valBrightness.textContent = val + '%';
    });
    el.sliderBrightness.addEventListener('change', (e) => {
      const val = parseInt(e.target.value, 10);
      state.themeBrightness = val;
      if (el.valBrightness) el.valBrightness.textContent = val + '%';
      localStorage.setItem('riff_theme_brightness', val.toString());
      if (state.themeMode === 'auto') {
        const targetMode = currentEffectiveMode || 'dark';
        state.themeMode = targetMode;
        localStorage.setItem('riff_theme_mode', targetMode);
      }
      updateThemeFromState();
    });
  }


  function applyTrackRowHeight(val) {
    const v = parseInt(val || localStorage.getItem('riff_track_row_height') || '64', 10);
    const coverSize = Math.max(34, Math.round(v * 0.72));
    document.documentElement.style.setProperty('--riff-track-row-height', `${v}px`);
    document.documentElement.style.setProperty('--riff-track-cover-size', `${coverSize}px`);
  }
  applyTrackRowHeight();

  function ensureTrackRowHeightSliderDOM() {
    if (document.getElementById('slider-track-row-height')) return;
    const fontRow = document.getElementById('setting-interface-font') || document.getElementById('setting-art-font-row');
    const targetParent = fontRow ? fontRow.parentNode : document.querySelector('#view-settings .settings-section[data-cat="interface"] .m3-group');
    if (!targetParent) return;

    const curH = parseInt(localStorage.getItem('riff_track_row_height') || '64', 10);
    const item = document.createElement('div');
    item.className = 'setting-item';
    item.id = 'setting-track-row-height';
    item.innerHTML = `
      <div class="setting-item-top">
        <span class="setting-name" data-i18n>Track card size</span>
        <span class="setting-value" id="val-track-row-height">${curH}px</span>
      </div>
      <input type="range" class="theme-brightness-slider pill-range" id="slider-track-row-height" min="48" max="84" step="2" value="${curH}">
      <div class="setting-hints"><span>Compact (48px)</span><span>Default (64px)</span><span>Spacious (84px)</span></div>
    `;

    if (fontRow && fontRow.nextSibling) {
      targetParent.insertBefore(item, fontRow.nextSibling);
    } else {
      targetParent.appendChild(item);
    }

    const slider = item.querySelector('#slider-track-row-height');
    const valEl = item.querySelector('#val-track-row-height');
    if (slider) {
      if (typeof updateRangeProg === 'function') updateRangeProg(slider);
      const onRowHeightInput = (e) => {
        const v = parseInt(e.target.value, 10);
        if (valEl) valEl.textContent = `${v}px`;
        if (typeof updateRangeProg === 'function') updateRangeProg(e.target);
        localStorage.setItem('riff_track_row_height', v.toString());
        applyTrackRowHeight(v);
      };
      slider.addEventListener('input', onRowHeightInput);
      slider.addEventListener('change', onRowHeightInput);
    }
    if (typeof enhanceSliders === 'function') enhanceSliders(item);
  }
  ensureTrackRowHeightSliderDOM();


  function applyHomeButtonIcon() {
    const btn = document.getElementById('btn-top-search-home');
    if (!btn) return;
    const isRiffIcon = localStorage.getItem('riff_home_icon_riff') === 'true';
    btn.innerHTML = isRiffIcon ? RIFF_FLAME_SVG : DEFAULT_HOME_SVG;
  }
  window.applyHomeButtonIcon = applyHomeButtonIcon;

  function ensureRiffHomeIconSettingDOM() {
    if (document.getElementById('setting-riff-home-icon')) return;
    const refItem = document.getElementById('setting-top-moment-icon') || document.getElementById('setting-track-row-height') || document.getElementById('setting-interface-font');
    if (!refItem || !refItem.parentNode) return;

    const isRiff = localStorage.getItem('riff_home_icon_riff') === 'true';
    const item = document.createElement('div');
    item.className = 'setting-item';
    item.id = 'setting-riff-home-icon';
    item.innerHTML = `
      <div class="setting-item-top" style="align-items: center;">
        <span class="setting-name" data-i18n>Riff logo on Home button</span>
        <button type="button" class="effect-switch-btn ${isRiff ? 'active' : ''}" id="btn-setting-riff-home-icon">
          <span class="thumb"></span>
        </button>
      </div>
    `;

    refItem.parentNode.insertBefore(item, refItem.nextSibling);

    const btnSwitch = item.querySelector('#btn-setting-riff-home-icon');
    if (btnSwitch) {
      btnSwitch.onclick = () => {
        const next = !btnSwitch.classList.contains('active');
        btnSwitch.classList.toggle('active', next);
        localStorage.setItem('riff_home_icon_riff', String(next));
        applyHomeButtonIcon();
      };
    }
  }
  window.ensureRiffHomeIconSettingDOM = ensureRiffHomeIconSettingDOM;
  ensureRiffHomeIconSettingDOM();
  applyHomeButtonIcon();

  var cachedDuckData = null;
  var duckFetchPromise = null;
  var lottieLibPromise = null;
  var aboutSupportLottieAnim = null;
  var aboutSupportObserver = null;
  var aboutSupportPollInterval = null;


  function getLottieLibrary() {
    if (window.lottie) return Promise.resolve(window.lottie);
    if (window.bodymovin) return Promise.resolve(window.bodymovin);
    if (lottieLibPromise) return lottieLibPromise;

    lottieLibPromise = new Promise(async (resolve) => {
      try {
        const cached = localStorage.getItem('riff_lottie_lib_cache');
        if (cached && cached.length > 1000) {
          const s = document.createElement('script');
          s.textContent = cached;
          document.head.appendChild(s);
          if (window.lottie || window.bodymovin) {
            resolve(window.lottie || window.bodymovin);
            return;
          }
        }
      } catch (_) {}

      const localSources = ['../../assets/lottie.min.js', 'assets/lottie.min.js'];
      for (const src of localSources) {
        try {
          const ok = await new Promise((resOk) => {
            const s = document.createElement('script');
            s.src = src;
            s.onload = () => resOk(true);
            s.onerror = () => { s.remove(); resOk(false); };
            document.head.appendChild(s);
          });
          if (ok && (window.lottie || window.bodymovin)) {
            resolve(window.lottie || window.bodymovin);
            return;
          }
        } catch (_) {}
      }

      const cdnSources = [
        'https://cdnjs.cloudflare.com/ajax/libs/bodymovin/5.12.2/lottie.min.js',
        'https://cdn.jsdelivr.net/npm/lottie-web@5.12.2/build/player/lottie.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/bodymovin/5.12.2/lottie_light.min.js'
      ];
      for (const cdnUrl of cdnSources) {
        try {
          const res = await fetch(cdnUrl, { cache: 'force-cache' });
          if (res.ok) {
            const code = await res.text();
            if (code && code.length > 1000) {
              const s = document.createElement('script');
              s.textContent = code;
              document.head.appendChild(s);
              try { localStorage.setItem('riff_lottie_lib_cache', code); } catch (_) {}
              if (window.lottie || window.bodymovin) {
                resolve(window.lottie || window.bodymovin);
                return;
              }
            }
          }
        } catch (_) {}
      }

      for (const cdnUrl of cdnSources) {
        try {
          const ok = await new Promise((resOk) => {
            const s = document.createElement('script');
            s.src = cdnUrl;
            s.onload = () => resOk(true);
            s.onerror = () => { s.remove(); resOk(false); };
            document.head.appendChild(s);
          });
          if (ok && (window.lottie || window.bodymovin)) {
            resolve(window.lottie || window.bodymovin);
            return;
          }
        } catch (_) {}
      }

      resolve(window.lottie || window.bodymovin || null);
    });

    return lottieLibPromise;
  }

  try { setTimeout(() => getLottieLibrary().catch(() => {}), 100); } catch (_) {}

  async function loadDuckData() {
    if (cachedDuckData) return cachedDuckData;
    if (duckFetchPromise) return duckFetchPromise;

    duckFetchPromise = (async () => {
      const candidatePaths = [
        new URL('../../assets/duck.json', window.location.href).href,
        '../../assets/duck.json',
        '../assets/duck.json',
        './assets/duck.json',
        'assets/duck.json',
        '/assets/duck.json'
      ];

      for (const p of candidatePaths) {
        try {
          const resp = await fetch(p);
          if (resp.ok || (resp.status === 0 && resp.type !== 'error')) {
            const txt = await resp.text();
            if (txt && txt.trim().startsWith('{')) {
              const parsed = JSON.parse(txt);
              if (parsed && (parsed.v || parsed.layers || parsed.op)) {
                cachedDuckData = parsed;
                return cachedDuckData;
              }
            }
          }
        } catch (_) {}

        try {
          const xhrResult = await new Promise((resXhr) => {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', p, true);
            xhr.onload = () => {
              if ((xhr.status === 200 || xhr.status === 0) && xhr.responseText && xhr.responseText.trim().startsWith('{')) {
                try {
                  const parsed = JSON.parse(xhr.responseText);
                  if (parsed && (parsed.v || parsed.layers || parsed.op)) {
                    resXhr(parsed);
                    return;
                  }
                } catch (_) {}
              }
              resXhr(null);
            };
            xhr.onerror = () => resXhr(null);
            xhr.send();
          });
          if (xhrResult) {
            cachedDuckData = xhrResult;
            return cachedDuckData;
          }
        } catch (_) {}
      }
      return null;
    })();

    const res = await duckFetchPromise;
    duckFetchPromise = null;
    return res;
  }

  function isAboutTabActive() {
    const sec = document.getElementById('settings-section-about');
    if (!sec) return false;
    if (sec.classList.contains('cat-hidden') || sec.style.display === 'none') return false;
    const viewSettings = document.getElementById('view-settings');
    if (viewSettings && !viewSettings.classList.contains('active')) return false;
    return true;
  }

  function updateAboutSupportLottieState(isAboutActive) {
    if (!aboutSupportLottieAnim) return;
    const active = typeof isAboutActive === 'boolean' ? isAboutActive : isAboutTabActive();
    if (active && !document.hidden) {
      aboutSupportLottieAnim.play();
    } else {
      aboutSupportLottieAnim.pause();
    }
  }

  async function initAboutSupportLottie() {
    const wrap = document.getElementById('support-me-lottie-wrap');
    if (!wrap) return;
    if (aboutSupportLottieAnim) {
      updateAboutSupportLottieState(isAboutTabActive());
      return;
    }

    const [lottie, duckData] = await Promise.all([
      getLottieLibrary(),
      loadDuckData()
    ]);

    if (!lottie || !duckData) {
      if (!duckData && !aboutSupportPollInterval) {
        aboutSupportPollInterval = setInterval(async () => {
          if (!isAboutTabActive()) return;
          const data = await loadDuckData();
          if (data) {
            clearInterval(aboutSupportPollInterval);
            aboutSupportPollInterval = null;
            initAboutSupportLottie();
          }
        }, 2500);
      }
      return;
    }

    if (aboutSupportPollInterval) {
      clearInterval(aboutSupportPollInterval);
      aboutSupportPollInterval = null;
    }

    wrap.innerHTML = '';

    try {
      if (typeof lottie.setSubframe === 'function') {
        lottie.setSubframe(true);
      }
      aboutSupportLottieAnim = lottie.loadAnimation({
        container: wrap,
        renderer: 'svg',
        loop: true,
        autoplay: true,
        animationData: duckData,
        rendererSettings: {
          preserveAspectRatio: 'xMidYMid meet',
          progressiveLoad: false,
          hideOnTransparent: true,
          className: 'support-duck-lottie-svg'
        }
      });

      aboutSupportLottieAnim.setSpeed(1.0);

      if (!aboutSupportObserver) {
        aboutSupportObserver = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (!aboutSupportLottieAnim) return;
            if (entry.isIntersecting && !document.hidden && isAboutTabActive()) {
              aboutSupportLottieAnim.play();
            } else {
              aboutSupportLottieAnim.pause();
            }
          });
        }, { threshold: 0.05 });
        aboutSupportObserver.observe(wrap);
      }

      updateAboutSupportLottieState(isAboutTabActive());
    } catch (err) {
      console.warn('[Riff] Failed to load duck lottie animation:', err);
    }
  }

  function ensureAboutSupportDOM() {
    const aboutSec = document.getElementById('settings-section-about');
    if (!aboutSec) return;
    if (document.getElementById('support-me-group')) return;

    ensureAboutSupportStyles();

    const group = document.createElement('div');
    group.className = 'm3-group support-me-group';
    group.id = 'support-me-group';

    group.innerHTML = `
      <div class="setting-item support-me-card" id="support-me-card">
        <div class="support-me-lottie-wrap" id="support-me-lottie-wrap">
          <div class="support-lottie-placeholder" id="support-lottie-placeholder" title="Animated duck loading...">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
          </div>
        </div>
        <div class="support-me-content">
          <span class="support-me-title setting-name">Support me!</span>
          <span class="support-me-desc setting-hint">Riff is created and maintained by one person. If you enjoy using it, any small tip like $1 helps keep the project going!</span>
          <div class="support-me-actions">
            <a href="https://ko-fi.com/rootlesszen/" target="_blank" rel="noopener noreferrer" class="btn-pill-primary support-me-btn" id="btn-support-buy-coffee" style="text-decoration: none !important; border: none !important; outline: none !important;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="flex-shrink:0;">
                <path d="M20 3H4v10c0 2.21 1.79 4 4 4h6c2.21 0 4-1.79 4-4v-3h2c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 5h-2V5h2v3zM4 19h16v2H4z"/>
              </svg>
              <span>Buy a coffee</span>
            </a>
          </div>
        </div>
      </div>
    `;

    const m3Group = aboutSec.querySelector('.m3-group');
    if (m3Group) {
      aboutSec.insertBefore(group, m3Group);
    } else {
      aboutSec.appendChild(group);
    }

    const btnCoffee = group.querySelector('#btn-support-buy-coffee');
    if (btnCoffee) {
      btnCoffee.addEventListener('click', (e) => {
        const coffeeUrl = 'https://ko-fi.com/rootlesszen/';
        try {
          window.open(coffeeUrl, '_blank');
        } catch (_) {}
      });
    }

    initAboutSupportLottie();
  }
  ensureAboutSupportDOM();

  document.addEventListener('visibilitychange', () => {
    updateAboutSupportLottieState();
  });

  if (window.electronAPI && typeof window.electronAPI.onWindowVisibility === 'function') {
    window.electronAPI.onWindowVisibility((visible) => {
      updateAboutSupportLottieState(!!visible);
    });
  }


  function syncAllThemeToggleIndicators() {
    document.querySelectorAll('.theme-mode-toggle, .theme-mode-selector').forEach(group => {
      let ind = group.querySelector('.theme-toggle-indicator');
      if (!ind) {
        ind = document.createElement('div');
        ind.className = 'theme-toggle-indicator';
        group.prepend(ind);
      }
      const activeBtn = group.querySelector('.theme-mode-btn.active');
      if (!activeBtn) {
        ind.style.opacity = '0';
        return;
      }
      const gRect = group.getBoundingClientRect();
      const bRect = activeBtn.getBoundingClientRect();
      if (bRect.width > 0) {
        ind.style.opacity = '1';
        ind.style.transform = `translateX(${bRect.left - gRect.left}px)`;
        ind.style.width = `${bRect.width}px`;
      }
    });
  }
  window.syncAllThemeToggleIndicators = syncAllThemeToggleIndicators;
  document.addEventListener('click', (e) => {
    if (e.target && e.target.closest && e.target.closest('.theme-mode-btn')) {
      requestAnimationFrame(syncAllThemeToggleIndicators);
    }
  });

  [
    { btn: fontOptGoogle, key: 'google' },
    { btn: fontOptSf, key: 'sf' },
    { btn: fontOptSystem, key: 'system' },
    { btn: fontOptInter, key: 'inter' }
  ].forEach(({ btn, key }) => {
    if (btn) {
      btn.addEventListener('click', () => {
        localStorage.setItem('riff_font', key);
        applyFont(key);
        requestAnimationFrame(syncAllThemeToggleIndicators);
      });
    }
  });
  applyFont(state.riffFont);
  requestAnimationFrame(syncAllThemeToggleIndicators);

  var isArtFont = localStorage.getItem('riff_art_font') !== '0';
  document.body.classList.toggle('art-font-on', isArtFont);
  var btnArtFont = document.getElementById('btn-art-font');
  if (btnArtFont) {
    btnArtFont.classList.toggle('active', isArtFont);
    btnArtFont.addEventListener('click', () => {
      const next = !document.body.classList.contains('art-font-on');
      document.body.classList.toggle('art-font-on', next);
      btnArtFont.classList.toggle('active', next);
      localStorage.setItem('riff_art_font', next ? '1' : '0');
    });
  }

  var npAlign = localStorage.getItem('riff_np_align') || 'left';
  var npAlignLeft = document.getElementById('np-align-left');
  var npAlignCenter = document.getElementById('np-align-center');
  var updateNpAlignUI = (val) => {
    document.body.classList.toggle('np-align-left', val === 'left');
    document.body.classList.toggle('np-align-center', val === 'center');
    if (npAlignLeft) npAlignLeft.classList.toggle('active', val === 'left');
    if (npAlignCenter) npAlignCenter.classList.toggle('active', val === 'center');
    localStorage.setItem('riff_np_align', val);
  };
  if (npAlignLeft) {
    npAlignLeft.addEventListener('click', () => updateNpAlignUI('left'));
  }
  if (npAlignCenter) {
    npAlignCenter.addEventListener('click', () => updateNpAlignUI('center'));
  }
  updateNpAlignUI(npAlign);

  var npToolbarPosSelect = document.getElementById('np-toolbar-pos-select');
  var applyNpToolbarPos = (pos) => {
    const valid = ['top-right', 'top-center', 'top-left', 'bottom-center', 'bottom-right', 'bottom-left', 'left-center', 'right-center'];
    const p = valid.includes(pos) ? pos : 'top-center';
    if (el.rightPanel) el.rightPanel.setAttribute('data-np-toolbar-pos', p);
    if (npToolbarPosSelect) npToolbarPosSelect.value = p;
    localStorage.setItem('riff_np_toolbar_pos', p);
  };
  applyNpToolbarPos(localStorage.getItem('riff_np_toolbar_pos') || 'top-center');
  if (npToolbarPosSelect) {
    npToolbarPosSelect.addEventListener('change', (e) => applyNpToolbarPos(e.target.value));
    setupSortDropdown('np-toolbar-pos-dropdown', 'np-toolbar-pos-trigger', 'np-toolbar-pos-menu', 'np-toolbar-pos-label', document.getElementById('np-toolbar-pos-select'));
  }

  var trackRowStyle = localStorage.getItem('riff_track_row_style') || 'default';
  var trackStyleDefault = document.getElementById('track-style-default');
  var trackStyleCompact = document.getElementById('track-style-compact');
  var updateTrackRowStyleUI = (val) => {
    const isCompact = val === 'compact';
    document.body.classList.toggle('track-rows-compact', isCompact);
    if (trackStyleDefault) trackStyleDefault.classList.toggle('active', !isCompact);
    if (trackStyleCompact) trackStyleCompact.classList.toggle('active', isCompact);
    localStorage.setItem('riff_track_row_style', val);
    if (state.currentView === 'playlist-detail' && state.currentPlaylistId) {
      openPlaylistDetail(state.currentPlaylistId);
    } else if (state.currentView === 'favorites' && typeof renderFavoritesView === 'function') {
      renderFavoritesView();
    }
  };
  if (trackStyleDefault) {
    trackStyleDefault.addEventListener('click', () => updateTrackRowStyleUI('default'));
  }
  if (trackStyleCompact) {
    trackStyleCompact.addEventListener('click', () => updateTrackRowStyleUI('compact'));
  }
  updateTrackRowStyleUI(trackRowStyle);

  var PLAYBAR_HARDCODED_SVGS = {
    shuffle: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" height="20px" width="20px" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22"/><path d="m18 2 4 4-4 4"/><path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2"/><path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8"/><path d="m18 14 4 4-4 4"/></svg>',
    repeat: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" height="20px" width="20px" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>',
    skipNext: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" height="22px" width="22px" fill="currentColor"><path d="M3.2 6.2c0-.85.92-1.39 1.66-.96l7.8 4.5c.74.43.74 1.5 0 1.92l-7.8 4.5c-.74.43-1.66-.11-1.66-.96V6.2zm9.5 0c0-.85.92-1.39 1.66-.96l7.8 4.5c.74.43.74 1.5 0 1.92l-7.8 4.5c-.74.43-1.66-.11-1.66-.96V6.2z"/></svg>',
    skipPrev: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" height="22px" width="22px" fill="currentColor"><path d="M20.8 6.2c0-.85-.92-1.39-1.66-.96l-7.8 4.5c-.74.43-.74 1.5 0 1.92l7.8 4.5c.74.43 1.66-.11 1.66-.96V6.2zm-9.5 0c0-.85-.92-1.39-1.66-.96l-7.8 4.5c-.74.43-.74 1.5 0 1.92l7.8 4.5c.74.43 1.66-.11 1.66-.96V6.2z"/></svg>'
  };

  function applyPlaybarHardcodedIcons() {
    const sBtn = document.getElementById('btn-shuffle');
    if (sBtn) {
      sBtn.querySelectorAll('.ms-injected-icon').forEach(n => n.remove());
      sBtn.innerHTML = PLAYBAR_HARDCODED_SVGS.shuffle;
    }
    const rBtn = document.getElementById('btn-repeat');
    if (rBtn) {
      rBtn.querySelectorAll('.ms-injected-icon').forEach(n => n.remove());
      rBtn.innerHTML = PLAYBAR_HARDCODED_SVGS.repeat;
    }
    const nBtn = document.getElementById('btn-next');
    if (nBtn) {
      nBtn.querySelectorAll('.ms-injected-icon').forEach(n => n.remove());
      nBtn.innerHTML = PLAYBAR_HARDCODED_SVGS.skipNext;
    }
    const pBtn = document.getElementById('btn-prev');
    if (pBtn) {
      pBtn.querySelectorAll('.ms-injected-icon').forEach(n => n.remove());
      pBtn.innerHTML = PLAYBAR_HARDCODED_SVGS.skipPrev;
    }
    const tsBtn = document.getElementById('btn-tvk-shuffle');
    if (tsBtn) {
      tsBtn.querySelectorAll('.ms-injected-icon').forEach(n => n.remove());
      tsBtn.innerHTML = PLAYBAR_HARDCODED_SVGS.shuffle;
    }
    const trBtn = document.getElementById('btn-tvk-repeat');
    if (trBtn) {
      trBtn.querySelectorAll('.ms-injected-icon').forEach(n => n.remove());
      trBtn.innerHTML = PLAYBAR_HARDCODED_SVGS.repeat;
    }
    const tnBtn = document.getElementById('btn-tvk-next');
    if (tnBtn) {
      tnBtn.querySelectorAll('.ms-injected-icon').forEach(n => n.remove());
      tnBtn.innerHTML = PLAYBAR_HARDCODED_SVGS.skipNext;
    }
    const tpBtn = document.getElementById('btn-tvk-prev');
    if (tpBtn) {
      tpBtn.querySelectorAll('.ms-injected-icon').forEach(n => n.remove());
      tpBtn.innerHTML = PLAYBAR_HARDCODED_SVGS.skipPrev;
    }

    const volIcon = document.getElementById('volume-icon');
    if (volIcon) {
      volIcon.setAttribute('viewBox', '0 0 24 24');
      volIcon.setAttribute('width', '20');
      volIcon.setAttribute('height', '20');
      volIcon.innerHTML = '<path fill="currentColor" d="M11 3.6a1.2 1.2 0 0 0-1.25.15L5.7 7.5H3a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h2.7l4.05 3.75a1.2 1.2 0 0 0 1.95-.9V4.5a1.2 1.2 0 0 0-.7-.9z"/><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M15.5 8.5a5 5 0 0 1 0 7M18.8 5.8a9.5 9.5 0 0 1 0 12.4"/>';
    }
    const volMutedIcon = document.getElementById('volume-muted-icon');
    if (volMutedIcon) {
      volMutedIcon.setAttribute('viewBox', '0 0 24 24');
      volMutedIcon.setAttribute('width', '20');
      volMutedIcon.setAttribute('height', '20');
      volMutedIcon.innerHTML = '<path fill="currentColor" d="M11 3.6a1.2 1.2 0 0 0-1.25.15L5.7 7.5H3a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h2.7l4.05 3.75a1.2 1.2 0 0 0 1.95-.9V4.5a1.2 1.2 0 0 0-.7-.9z"/><line x1="22" y1="2" x2="2" y2="22" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>';
    }
  }

  var ICON_PACKS = {
    sf: {
      '#nav-discover svg': '<circle cx="12" cy="12" r="9.5"></circle><polygon points="15.5 8.5 13.5 13.5 8.5 15.5 10.5 10.5 15.5 8.5" fill="currentColor"></polygon>',
      '#nav-favorites svg': '<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path>',
      '#nav-albums svg': '<circle cx="12" cy="12" r="9.5"></circle><circle cx="12" cy="12" r="3.2"></circle><circle cx="12" cy="12" r="1" fill="currentColor"></circle>',
      '#nav-local svg': '<path d="M2.5 7A2.5 2.5 0 0 1 5 4.5h4.2c.8 0 1.5.4 1.9 1l1.2 1.8c.4.6 1.1 1 1.9 1H19A2.5 2.5 0 0 1 21.5 11v6.5a2.5 2.5 0 0 1-2.5 2.5H5a2.5 2.5 0 0 1-2.5-2.5V7z"></path>',
      '#nav-history svg': '<circle cx="12" cy="12" r="9.5"></circle><polyline points="12 6.5 12 12 15.5 14"></polyline>',
      '#nav-queue svg': '<path d="M4 6.5h16M4 12h16M4 17.5h16" stroke-linecap="round"></path>',
      '#nav-settings svg': '<circle cx="12" cy="12" r="3.2"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"></path>',
      '#btn-toggle-lyrics-panel svg': '<path d="M9 18V5l12-2v13M9 9l12-2"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle>',
      '#btn-open-settings svg': '<line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line>',
      '#volume-icon': '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"></path>'
    },
    lucide: {
      '#nav-discover svg': '<circle cx="12" cy="12" r="10"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>',
      '#nav-favorites svg': '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path>',
      '#nav-albums svg': '<circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="4"></circle><circle cx="12" cy="12" r="1"></circle>',
      '#nav-local svg': '<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"></path>',
      '#nav-history svg': '<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>',
      '#nav-queue svg': '<line x1="4" y1="7" x2="20" y2="7"></line><line x1="4" y1="12" x2="20" y2="12"></line><line x1="4" y1="17" x2="14" y2="17"></line>',
      '#nav-settings svg': '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle>',
      '#btn-toggle-lyrics-panel svg': '<path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle>',
      '#btn-open-settings svg': '<line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line>',
      '#volume-icon': '<path fill="currentColor" d="M11 3.6a1.2 1.2 0 0 0-1.25.15L5.7 7.5H3a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h2.7l4.05 3.75a1.2 1.2 0 0 0 1.95-.9V4.5a1.2 1.2 0 0 0-.7-.9z"/><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M15.5 8.5a5 5 0 0 1 0 7M18.8 5.8a9.5 9.5 0 0 1 0 12.4"/>'
    },
    solar: {
      '#nav-discover svg': '<circle cx="12" cy="12" r="9.5"></circle><polygon points="16 8 13.8 13.8 8 16 10.2 10.2 16 8"></polygon>',
      '#nav-favorites svg': '<path d="M12.62 20.89c-.38.14-.86.14-1.24 0C8.48 19.82 2 15.69 2 8.69A5.69 5.69 0 0 1 7.69 3c1.64 0 3.12.7 4.31 1.83A6.05 6.05 0 0 1 16.31 3 5.69 5.69 0 0 1 22 8.69c0 7-6.48 11.13-9.38 12.2z"></path>',
      '#nav-albums svg': '<circle cx="12" cy="12" r="9.5"></circle><circle cx="12" cy="12" r="3"></circle>',
      '#nav-local svg': '<path d="M2 11c0-2.83 0-4.24.88-5.12C3.76 5 5.17 5 8 5h.5c.78 0 1.43 0 1.98.24.54.23.97.66 1.52 1.48L13 8h3c2.83 0 4.24 0 5.12.88C22 9.76 22 11.17 22 14v2c0 2.83 0 4.24-.88 5.12C20.24 22 18.83 22 16 22H8c-2.83 0-4.24 0-5.12-.88C2 20.24 2 18.83 2 16v-5z"></path>',
      '#nav-history svg': '<circle cx="12" cy="12" r="9.5"></circle><polyline points="12 7 12 12 15 13.5"></polyline>',
      '#nav-queue svg': '<path d="M4 7h16M4 12h16M4 17h11"></path>',
      '#nav-settings svg': '<circle cx="12" cy="12" r="3.5"></circle><path d="M12 2v2m0 16v2m10-10h-2M4 12H2m15.07-7.07-1.41 1.41M8.34 17.66l-1.41 1.41m12.14 0-1.41-1.41M8.34 6.34 6.93 4.93"></path>',
      '#btn-toggle-lyrics-panel svg': '<path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle>',
      '#btn-open-settings svg': '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"></path>',
      '#volume-icon': '<path fill="currentColor" d="M11 3.6a1.2 1.2 0 0 0-1.25.15L5.7 7.5H3a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h2.7l4.05 3.75a1.2 1.2 0 0 0 1.95-.9V4.5a1.2 1.2 0 0 0-.7-.9z"/><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M15.5 8.5a5 5 0 0 1 0 7M18.8 5.8a9.5 9.5 0 0 1 0 12.4"/>'
    }
  };

  var MATERIAL_SYMBOL_NAMES = {
    '#nav-favorites svg': 'favorite',
    '#nav-albums svg': 'album',
    '#nav-local svg': 'folder',
    '#nav-history svg': 'history',
    '#nav-queue svg': 'queue_music',
    '#nav-settings svg': 'settings',
    '#btn-sb-settings svg': 'settings',
    '#btn-sb-new-playlist svg': 'playlist_add',
    '#btn-sb-collapse svg': 'dock_to_left',
    '#btn-rail-expand-lib svg': 'dock_to_right',
    '#btn-sb-create-pill svg': 'add',
    '#btn-toggle-presets-drawer svg': 'tune',
    '#btn-toggle-playlists-drawer svg': 'queue_music',
    '#btn-toggle-lyrics-panel svg': 'dock_to_left',
    '#btn-toggle-queue-panel svg': 'queue_music',
    '#btn-open-settings svg': 'tune',
    '#btn-sb-lib-search svg': 'search',
    '#btn-sb-lib-sort svg': 'sort',
    '#btn-playbar-more svg': 'more_horiz',
    '#btn-playbar-share svg': 'share',
    '#btn-edit-current-track svg': 'edit',
    '#btn-close-right-panel svg': 'close'
  };

  function applyIconPack(pack) {
    const validPacks = ['material', 'material-rounded', 'material-filled', 'material-sharp', 'sf', 'lucide', 'solar'];
    if (!validPacks.includes(pack)) pack = 'material';
    document.body.setAttribute('data-icon-pack', pack);

    let msLink = document.getElementById('google-fonts-material-symbols');
    if (!msLink) {
      msLink = document.createElement('link');
      msLink.id = 'google-fonts-material-symbols';
      msLink.rel = 'stylesheet';
      msLink.href = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&family=Material+Symbols+Sharp:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap';
      document.head.appendChild(msLink);
    }

    const msFont = pack === 'material-sharp' ? "'Material Symbols Sharp'" : (pack === 'material' ? "'Material Symbols Outlined'" : "'Material Symbols Rounded'");
    const msFill = (pack === 'material-filled' || localStorage.getItem('riff_icon_fill') === '1') ? '1' : '0';
    document.body.setAttribute('data-icon-fill', msFill);
    const msWght = localStorage.getItem('riff_icon_wght') || '400';
    const svgStrokeW = ((parseInt(msWght, 10) / 400) * 2).toFixed(2) + 'px';
    const svgLinejoin = pack === 'material-sharp' ? 'miter' : 'round';
    const svgLinecap = pack === 'material-sharp' ? 'butt' : 'round';

    document.documentElement.style.setProperty('--ms-icon-font', msFont);
    document.documentElement.style.setProperty('--ms-icon-fill', msFill);
    document.documentElement.style.setProperty('--ms-icon-wght', msWght);
    document.documentElement.style.setProperty('--svg-stroke-w', svgStrokeW);
    document.documentElement.style.setProperty('--svg-linejoin', svgLinejoin);
    document.documentElement.style.setProperty('--svg-linecap', svgLinecap);

    const allSelectors = new Set([
      ...Object.keys(ICON_PACKS.sf),
      ...Object.keys(ICON_PACKS.lucide),
      ...Object.keys(ICON_PACKS.solar)
    ]);

    allSelectors.forEach(sel => {
      const elSvg = document.querySelector(sel);
      if (!elSvg) return;
      if (!elSvg.dataset.origSvg) {
        elSvg.dataset.origSvg = elSvg.innerHTML;
      }
      if (pack.startsWith('material')) {
        elSvg.innerHTML = elSvg.dataset.origSvg;
      } else {
        const packDef = ICON_PACKS[pack];
        if (packDef && packDef[sel]) {
          elSvg.innerHTML = packDef[sel];
        }
      }
    });

    document.querySelectorAll('#sidebar .nav-indicator').forEach(ind => {
      Array.from(ind.children).forEach(child => {
        if (!child.matches('svg, .nav-badge, img, .ms-injected-icon, [class*="material-symbols-"]')) {
          child.remove();
        }
      });
      const svgs = ind.querySelectorAll('svg');
      for (let i = 1; i < svgs.length; i++) {
        svgs[i].remove();
      }
    });
    document.querySelectorAll('#sidebar .nav-item').forEach(item => {
      Array.from(item.children).forEach(child => {
        if (!child.matches('.nav-indicator, .nav-item-label, .sb-home-banner-content, .sb-home-banner-fx, .ripple-host')) {
          child.remove();
        }
      });
    });

    const isMaterialSymbol = pack.startsWith('material');
    const msClass = pack === 'material-sharp' ? 'material-symbols-sharp' : (pack === 'material' ? 'material-symbols-outlined' : 'material-symbols-rounded');

    if (isMaterialSymbol) {
      Object.entries(MATERIAL_SYMBOL_NAMES).forEach(([sel, ligature]) => {
        const svg = document.querySelector(sel);
        if (!svg) return;
        svg.style.setProperty('display', 'none', 'important');
        let msSpan = svg.parentElement ? svg.parentElement.querySelector(':scope > .ms-injected-icon') : null;
        if (!msSpan) {
          msSpan = document.createElement('span');
          svg.insertAdjacentElement('afterend', msSpan);
        }
        msSpan.className = `ms-injected-icon ${msClass}${msFill === '1' ? ' filled' : ''}`;
        msSpan.textContent = ligature;
        msSpan.style.cssText = `font-family: var(--ms-icon-font) !important; font-variation-settings: 'FILL' ${msFill}, 'wght' ${msWght}, 'GRAD' 0, 'opsz' 24 !important; font-size: 22px; line-height: 1; display: inline-flex; align-items: center; justify-content: center; user-select: none;`;
      });

      document.querySelectorAll('.material-symbols-outlined:not(.ms-injected-icon), .material-symbols-rounded:not(.ms-injected-icon), .material-symbols-sharp:not(.ms-injected-icon)').forEach(el => {
        el.classList.remove('material-symbols-outlined', 'material-symbols-rounded', 'material-symbols-sharp');
        el.classList.add(msClass);
        el.classList.toggle('filled', msFill === '1');
        el.style.setProperty('font-variation-settings', `'FILL' ${msFill}, 'wght' ${msWght}, 'GRAD' 0, 'opsz' 24`, 'important');
      });
    } else {
      document.querySelectorAll('.ms-injected-icon').forEach(span => span.remove());
      Object.keys(MATERIAL_SYMBOL_NAMES).forEach(sel => {
        const svg = document.querySelector(sel);
        if (svg) {
          svg.style.removeProperty('display');
        }
      });
    }

    const packLabels = {
      material: 'Material Outlined (Default)',
      'material-rounded': 'Material Symbols Rounded',
      'material-filled': 'Material Symbols Filled',
      'material-sharp': 'Material Symbols Sharp',
      sf: 'iOS / SF Symbols',
      lucide: 'Lucide Crisp',
      solar: 'Solar Duotone'
    };
    const labelEl = document.getElementById('icon-pack-label');
    if (labelEl) labelEl.textContent = packLabels[pack] || packLabels.material;

    const menu = document.getElementById('icon-pack-menu');
    if (menu) {
      menu.querySelectorAll('.m3-dropdown-option').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.value === pack);
      });
    }

    const sliderRoundness = document.getElementById('slider-icon-roundness');
    const valRoundness = document.getElementById('val-icon-roundness');
    if (sliderRoundness) {
      const roundVal = pack === 'material-sharp' ? 0 : (pack === 'material' ? 1 : 2);
      sliderRoundness.value = roundVal;
      if (valRoundness) {
        valRoundness.textContent = roundVal === 0 ? 'Sharp' : (roundVal === 1 ? 'Outlined' : 'Rounded');
      }
    }

    const sliderWeight = document.getElementById('slider-icon-weight');
    const valWeight = document.getElementById('val-icon-weight');
    if (sliderWeight) {
      sliderWeight.value = msWght;
      if (valWeight) {
        valWeight.textContent = msWght;
      }
    }

    const btnFilled = document.getElementById('btn-icon-filled');
    if (btnFilled) {
      btnFilled.classList.toggle('active', msFill === '1');
    }

    if (typeof deduplicateSidebarNavIcons === 'function') {
      deduplicateSidebarNavIcons();
    }
    applyPlaybarHardcodedIcons();
  }

  var savedIconPack = localStorage.getItem('riff_icon_pack') || 'material';
  applyIconPack(savedIconPack);
  applyPlaybarHardcodedIcons();

  var iconPackDropdown = document.getElementById('icon-pack-dropdown');
  var iconPackTrigger = document.getElementById('icon-pack-trigger');
  var iconPackMenu = document.getElementById('icon-pack-menu');
  if (iconPackDropdown && iconPackTrigger && iconPackMenu) {
    iconPackTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      iconPackDropdown.classList.toggle('open');
    });

    iconPackMenu.querySelectorAll('.m3-dropdown-option').forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        const val = opt.dataset.value;
        if (val === 'material-filled') {
          localStorage.setItem('riff_icon_fill', '1');
        } else if (val.startsWith('material')) {
          localStorage.setItem('riff_icon_fill', '0');
        }
        localStorage.setItem('riff_icon_pack', val);
        applyIconPack(val);
        iconPackDropdown.classList.remove('open');
      });
    });

    document.addEventListener('click', () => {
      iconPackDropdown.classList.remove('open');
    });
  }

  var sliderIconRoundness = document.getElementById('slider-icon-roundness');
  var valIconRoundness = document.getElementById('val-icon-roundness');
  if (sliderIconRoundness) {
    sliderIconRoundness.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      const isFilled = (localStorage.getItem('riff_icon_fill') || '0') === '1';
      let newPack = 'material';
      if (val === 0) {
        newPack = 'material-sharp';
        if (valIconRoundness) valIconRoundness.textContent = 'Sharp';
      } else if (val === 1) {
        newPack = 'material';
        if (valIconRoundness) valIconRoundness.textContent = 'Outlined';
      } else {
        newPack = isFilled ? 'material-filled' : 'material-rounded';
        if (valIconRoundness) valIconRoundness.textContent = 'Rounded';
      }
      localStorage.setItem('riff_icon_pack', newPack);
      applyIconPack(newPack);
    });
  }

  var sliderIconWeight = document.getElementById('slider-icon-weight');
  var valIconWeight = document.getElementById('val-icon-weight');
  if (sliderIconWeight) {
    sliderIconWeight.addEventListener('input', (e) => {
      const wght = e.target.value;
      if (valIconWeight) valIconWeight.textContent = wght;
      localStorage.setItem('riff_icon_wght', wght);
      const strokeW = ((parseInt(wght, 10) / 400) * 2).toFixed(2) + 'px';
      document.documentElement.style.setProperty('--ms-icon-wght', wght);
      const fillVal = (localStorage.getItem('riff_icon_fill') || '0') === '1' ? '1' : '0';
      document.body.setAttribute('data-icon-fill', fillVal);
      document.querySelectorAll('.ms-injected-icon, .material-symbols-outlined, .material-symbols-rounded, .material-symbols-sharp').forEach(span => {
        span.style.setProperty('font-variation-settings', `'FILL' ${fillVal}, 'wght' ${wght}, 'GRAD' 0, 'opsz' 24`, 'important');
      });
    });
  }

  var btnIconFilled = document.getElementById('btn-icon-filled');
  if (btnIconFilled) {
    btnIconFilled.addEventListener('click', (e) => {
      e.stopPropagation();
      const curPack = localStorage.getItem('riff_icon_pack') || 'material';
      const curFill = (localStorage.getItem('riff_icon_fill') || '0') === '1' || curPack === 'material-filled';
      const nextFill = curFill ? '0' : '1';
      localStorage.setItem('riff_icon_fill', nextFill);
      btnIconFilled.classList.toggle('active', nextFill === '1');
      document.documentElement.style.setProperty('--ms-icon-fill', nextFill);

      let newPack = curPack;
      if (nextFill === '1' && (curPack === 'material' || curPack === 'material-rounded')) {
        newPack = 'material-filled';
      } else if (nextFill === '0' && curPack === 'material-filled') {
        newPack = 'material-rounded';
      }
      localStorage.setItem('riff_icon_pack', newPack);
      applyIconPack(newPack);
    });
  }

  function applySearchPos(pos) {
    if (!['left', 'middle', 'right'].includes(pos)) pos = 'middle';
    const topNav = document.querySelector('.top-nav');
    if (topNav) {
      topNav.classList.remove('search-pos-left', 'search-pos-middle', 'search-pos-right');
      topNav.classList.add(`search-pos-${pos}`);
    }
    const select = document.getElementById('select-search-pos');
    if (select) select.value = pos;
    const label = document.getElementById('search-pos-label');
    if (label) label.textContent = pos.charAt(0).toUpperCase() + pos.slice(1);
    const menu = document.getElementById('search-pos-menu');
    if (menu) {
      menu.querySelectorAll('.m3-dropdown-option').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.value === pos);
      });
    }
  }

  var savedSearchPos = localStorage.getItem('riff_search_pos') || 'middle';
  applySearchPos(savedSearchPos);

  var searchPosDropdown = document.getElementById('search-pos-dropdown');
  var searchPosTrigger = document.getElementById('search-pos-trigger');
  var searchPosMenu = document.getElementById('search-pos-menu');
  if (searchPosDropdown && searchPosTrigger && searchPosMenu) {
    searchPosTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      searchPosDropdown.classList.toggle('open');
    });

    searchPosMenu.querySelectorAll('.m3-dropdown-option').forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        const val = opt.dataset.value;
        localStorage.setItem('riff_search_pos', val);
        applySearchPos(val);
        searchPosDropdown.classList.remove('open');
      });
    });

    document.addEventListener('click', () => {
      searchPosDropdown.classList.remove('open');
    });
  }

  var navResizeTimer = null;
  window.addEventListener('resize', () => {
    document.body.classList.add('is-window-resizing');
    clearTimeout(navResizeTimer);
    navResizeTimer = setTimeout(() => {
      document.body.classList.remove('is-window-resizing');
      updateEngineWidthVar();
    }, 120);
  });

  setTimeout(() => {
    updateEngineWidthVar();
    document.body.classList.remove('no-nav-transition');
  }, 50);

  if (el.sliderCornerRadius) {
    el.sliderCornerRadius.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      if (el.valCornerRadius) el.valCornerRadius.textContent = val === 16 ? 'Default' : `${val}px`;
      document.documentElement.style.setProperty('--md-shape-corner-l', `${val}px`);
      document.documentElement.style.setProperty('--md-shape-corner-m', `${Math.max(0, val - 4)}px`);
      localStorage.setItem('riff_corner_radius', val.toString());
    });
  }

  if (el.sliderUiAlpha) {
    el.sliderUiAlpha.addEventListener('input', (e) => {
      const val = Math.max(20, Math.min(100, parseInt(e.target.value, 10) || 100));
      if (el.valUiAlpha) el.valUiAlpha.textContent = `${val}%`;
      document.documentElement.style.setProperty('--ui-alpha', `${val}%`);
      localStorage.setItem('riff_ui_alpha', val.toString());
      refreshCachedThemeColors();
    });
  }

  if (el.btnResetUiAlpha) {
    el.btnResetUiAlpha.addEventListener('click', () => {
      const val = 100;
      if (el.sliderUiAlpha) el.sliderUiAlpha.value = val;
      if (el.valUiAlpha) el.valUiAlpha.textContent = `${val}%`;
      document.documentElement.style.setProperty('--ui-alpha', `${val}%`);
      localStorage.setItem('riff_ui_alpha', val.toString());
      refreshCachedThemeColors();
    });
  }

  if (el.sliderPanelBlur) {
    el.sliderPanelBlur.addEventListener('input', (e) => {
      const val = Math.max(0, Math.min(48, parseInt(e.target.value, 10) || 0));
      document.documentElement.style.setProperty('--panel-blur', `${val}px`);
      document.body.style.setProperty('--panel-blur', `${val}px`);
      document.body.classList.toggle('no-panel-blur', val <= 0);
      if (el.valPanelBlur) el.valPanelBlur.textContent = `${val}px`;
      localStorage.setItem('riff_panel_blur', String(val));
    });
  }

  if (el.btnResetPanelBlur) {
    el.btnResetPanelBlur.addEventListener('click', () => {
      const val = 24;
      if (el.sliderPanelBlur) el.sliderPanelBlur.value = val;
      if (el.valPanelBlur) el.valPanelBlur.textContent = `${val}px`;
      document.documentElement.style.setProperty('--panel-blur', `${val}px`);
      document.body.style.setProperty('--panel-blur', `${val}px`);
      document.body.classList.toggle('no-panel-blur', false);
      localStorage.setItem('riff_panel_blur', '24');
    });
  }

  if (el.btnPlayBtnBg) {
    el.btnPlayBtnBg.addEventListener('click', () => {
      const isNowActive = !el.btnPlayBtnBg.classList.contains('active');
      el.btnPlayBtnBg.classList.toggle('active', isNowActive);
      document.body.classList.toggle('play-btn-nobg', !isNowActive);
      localStorage.setItem('riff_play_btn_bg', isNowActive ? 'true' : 'false');
    });
  }

  var btnHomeNextToSearch = document.getElementById('btn-home-next-to-search');
  if (btnHomeNextToSearch) {
    btnHomeNextToSearch.classList.toggle('active', document.body.classList.contains('home-next-to-search'));
    btnHomeNextToSearch.addEventListener('click', () => {
      const next = !document.body.classList.contains('home-next-to-search');
      document.body.classList.toggle('home-next-to-search', next);
      btnHomeNextToSearch.classList.toggle('active', next);
      localStorage.setItem('riff_home_next_to_search', next ? '1' : '0');
    });
  }

  var btnChooseBannerMedia = document.getElementById('btn-choose-banner-media');
  var btnResetBannerMedia = document.getElementById('btn-reset-banner-media');

  if (btnChooseBannerMedia) {
    btnChooseBannerMedia.addEventListener('click', async () => {
      if (window.electronAPI && window.electronAPI.pickMedia) {
        const url = await window.electronAPI.pickMedia();
        if (url) {
          localStorage.setItem('riff_banner_media', url);
          const thumb = getTrackThumbUrl(state.currentTrack);
          updateRightPanelBanner(thumb);
          updatePlaylistDetailBanner(thumb);
        }
      }
    });
  }

  if (btnResetBannerMedia) {
    btnResetBannerMedia.addEventListener('click', () => {
      localStorage.removeItem('riff_banner_media');
      const thumb = getTrackThumbUrl(state.currentTrack);
      updateRightPanelBanner(thumb);
      updatePlaylistDetailBanner(thumb);
    });
  }

  var sliderBannerBlur = document.getElementById('slider-banner-blur');
  var valBannerBlur = document.getElementById('val-banner-blur');
  if (sliderBannerBlur) {
    sliderBannerBlur.value = savedBannerBlur;
    if (valBannerBlur) valBannerBlur.textContent = `${savedBannerBlur}px`;
    sliderBannerBlur.addEventListener('input', (e) => {
      const v = parseInt(e.target.value, 10);
      if (valBannerBlur) valBannerBlur.textContent = `${v}px`;
    });
    sliderBannerBlur.addEventListener('change', (e) => {
      const v = parseInt(e.target.value, 10);
      document.documentElement.style.setProperty('--banner-blur', `${v}px`);
      if (valBannerBlur) valBannerBlur.textContent = `${v}px`;
      localStorage.setItem('riff_banner_blur', v.toString());
    });
  }

  var sliderBannerOpacity = document.getElementById('slider-banner-opacity');
  var valBannerOpacity = document.getElementById('val-banner-opacity');
  if (sliderBannerOpacity) {
    sliderBannerOpacity.value = savedBannerOpacity;
    if (valBannerOpacity) valBannerOpacity.textContent = `${savedBannerOpacity}%`;
    sliderBannerOpacity.addEventListener('input', (e) => {
      const v = parseInt(e.target.value, 10);
      if (valBannerOpacity) valBannerOpacity.textContent = `${v}%`;
    });
    sliderBannerOpacity.addEventListener('change', (e) => {
      const v = parseInt(e.target.value, 10);
      document.documentElement.style.setProperty('--banner-opacity', `${v / 100}`);
      if (valBannerOpacity) valBannerOpacity.textContent = `${v}%`;
      localStorage.setItem('riff_banner_opacity', v.toString());
    });
  }

  var sliderBannerFade = document.getElementById('slider-banner-fade');
  var valBannerFade = document.getElementById('val-banner-fade');
  if (sliderBannerFade) {
    sliderBannerFade.value = savedBannerFade;
    if (valBannerFade) valBannerFade.textContent = `${savedBannerFade}%`;
    sliderBannerFade.addEventListener('input', (e) => {
      const v = parseInt(e.target.value, 10);
      if (valBannerFade) valBannerFade.textContent = `${v}%`;
    });
    sliderBannerFade.addEventListener('change', (e) => {
      const v = parseInt(e.target.value, 10);
      document.documentElement.style.setProperty('--banner-fade-base', `${v}%`);
      document.documentElement.style.setProperty('--banner-fade-end', `${v}%`);
      const rightBanner = document.getElementById('right-panel-banner');
      if (rightBanner) {
        rightBanner.style.setProperty('--banner-fade-base', `${v}%`);
        rightBanner.style.setProperty('--banner-fade-end', `${v}%`);
      }
      if (valBannerFade) valBannerFade.textContent = `${v}%`;
      localStorage.setItem('riff_banner_fade', v.toString());
    });
  }

  function applyBannerFit(fit) {
    const root = document.documentElement;
    const val = fit || 'zoom';
    if (val === 'fit') {
      root.style.setProperty('--banner-fit', 'contain');
      root.style.setProperty('--banner-object-fit', 'contain');
      root.style.setProperty('--banner-scale', 'none');
    } else if (val === 'stretch') {
      root.style.setProperty('--banner-fit', '100% 100%');
      root.style.setProperty('--banner-object-fit', 'fill');
      root.style.setProperty('--banner-scale', 'none');
    } else {
      root.style.setProperty('--banner-fit', 'cover');
      root.style.setProperty('--banner-object-fit', 'cover');
      root.style.setProperty('--banner-scale', 'scale(1.06)');
    }
  }

  var selectBannerFit = document.getElementById('select-banner-fit');
  var bannerFitDropdown = document.getElementById('banner-fit-dropdown');
  var bannerFitTrigger = document.getElementById('banner-fit-trigger');
  var bannerFitLabel = document.getElementById('banner-fit-label');
  var bannerFitMenu = document.getElementById('banner-fit-menu');

  if (selectBannerFit) {
    selectBannerFit.value = savedBannerFit;
  }

  if (bannerFitDropdown && bannerFitTrigger && bannerFitMenu) {
    const curFit = savedBannerFit || 'zoom';
    if (bannerFitLabel) {
      bannerFitLabel.textContent = curFit.charAt(0).toUpperCase() + curFit.slice(1);
    }
    bannerFitMenu.querySelectorAll('.m3-dropdown-option').forEach(opt => {
      opt.classList.toggle('selected', opt.dataset.value === curFit);
    });

    bannerFitTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      bannerFitDropdown.classList.toggle('open');
    });

    bannerFitMenu.querySelectorAll('.m3-dropdown-option').forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        const val = opt.dataset.value;
        localStorage.setItem('riff_banner_fit', val);
        applyBannerFit(val);
        if (bannerFitLabel) bannerFitLabel.textContent = opt.textContent;
        bannerFitMenu.querySelectorAll('.m3-dropdown-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        if (selectBannerFit) selectBannerFit.value = val;
        bannerFitDropdown.classList.remove('open');
      });
    });

    document.addEventListener('click', () => {
      bannerFitDropdown.classList.remove('open');
    });
  }

  var btnChooseCustomBg = document.getElementById('btn-choose-custom-bg');
  var btnRemoveCustomBg = document.getElementById('btn-remove-custom-bg');
  var sliderBgOpacity = document.getElementById('slider-bg-opacity');
  var valBgOpacity = document.getElementById('val-bg-opacity');
  var sliderBgBlur = document.getElementById('slider-bg-blur');
  var valBgBlur = document.getElementById('val-bg-blur');


  function updateShowLocalUI(animate = false) {
    const show = localStorage.getItem('riff_show_local') !== 'false';
    if (el.navLocal) el.navLocal.classList.toggle('nav-collapsed', !show);
    if (btnShowLocal) btnShowLocal.classList.toggle('active', show);
    if (!show && state.currentView === 'local') {
      switchView('discover');
    }
    if (animate) {
      const t0 = performance.now();
      (function f() {
        refreshStacks();
        updateNavIndicator(false);
        if (performance.now() - t0 < 350) requestAnimationFrame(f);
      })();
    } else {
      refreshStacks();
      updateNavIndicator(false);
    }
  }
  if (btnShowLocal) {
    btnShowLocal.addEventListener('click', () => {
      const show = localStorage.getItem('riff_show_local') !== 'false';
      localStorage.setItem('riff_show_local', (!show) ? 'true' : 'false');
      updateShowLocalUI(true);
      refreshStacks();
    });
  }
  updateShowLocalUI(false);

  var showAlbumsSaved = localStorage.getItem('riff_show_albums') === '1';
  document.body.classList.toggle('hide-albums-tab', !showAlbumsSaved);
  var btnShowAlbums = document.getElementById('btn-show-albums');
  if (btnShowAlbums) {
    btnShowAlbums.classList.toggle('active', showAlbumsSaved);
    btnShowAlbums.addEventListener('click', () => {
      const next = !btnShowAlbums.classList.contains('active');
      btnShowAlbums.classList.toggle('active', next);
      localStorage.setItem('riff_show_albums', next ? '1' : '0');
      document.body.classList.toggle('hide-albums-tab', !next);
      if (!next && state.currentView === 'albums') {
        switchView('discover');
      }
      if (typeof refreshStacks === 'function') refreshStacks();
      if (typeof updateNavIndicator === 'function') updateNavIndicator(false);
    });
  }

  var btnShowPlaylistRecs = document.getElementById('btn-show-playlist-recs');
  var showPlaylistRecs = localStorage.getItem('riff_show_playlist_recs') !== '0';
  if (btnShowPlaylistRecs) {
    btnShowPlaylistRecs.classList.toggle('active', showPlaylistRecs);
    btnShowPlaylistRecs.addEventListener('click', () => {
      const next = !btnShowPlaylistRecs.classList.contains('active');
      btnShowPlaylistRecs.classList.toggle('active', next);
      localStorage.setItem('riff_show_playlist_recs', next ? '1' : '0');
      const recsSec = document.getElementById('playlist-recs-section');
      if (next) {
        if (state.currentView === 'playlist-detail' && state.currentPlaylist) {
          loadPlaylistRecommendations(state.currentPlaylist, false);
        }
      } else {
        if (recsSec) recsSec.classList.add('hidden');
      }
    });
  }

  function applyFavHeader(show) {
    document.body.classList.toggle('hide-favorites-header', !show);
  }
  var btnFavHeaderSetting = document.getElementById('btn-fav-header-setting');
  var favHeaderPref = localStorage.getItem('riff_fav_header') !== '0';
  applyFavHeader(favHeaderPref);
  if (btnFavHeaderSetting) {
    btnFavHeaderSetting.classList.toggle('active', favHeaderPref);
    btnFavHeaderSetting.addEventListener('click', () => {
      const next = !btnFavHeaderSetting.classList.contains('active');
      btnFavHeaderSetting.classList.toggle('active', next);
      localStorage.setItem('riff_fav_header', next ? '1' : '0');
      applyFavHeader(next);
    });
  }

  var btnShowFavRecs = document.getElementById('btn-show-fav-recs');
  var showFavRecs = localStorage.getItem('riff_show_fav_recs') !== '0';
  if (btnShowFavRecs) {
    btnShowFavRecs.classList.toggle('active', showFavRecs);
    btnShowFavRecs.addEventListener('click', () => {
      const next = !btnShowFavRecs.classList.contains('active');
      btnShowFavRecs.classList.toggle('active', next);
      localStorage.setItem('riff_show_fav_recs', next ? '1' : '0');
      const recsSec = document.getElementById('favorites-recs-section');
      if (next) {
        if (state.currentView === 'favorites') {
          loadFavoritesRecommendations(false);
        }
      } else {
        if (recsSec) recsSec.classList.add('hidden');
      }
    });
  }

  function applyHideTrackNumbers(hide) {
    document.body.classList.toggle('hide-track-numbers', !!hide);
  }
  var btnShowTrackNumbers = document.getElementById('btn-show-track-numbers') || document.getElementById('btn-hide-track-numbers');
  var hideTrackNumbersPref = localStorage.getItem('riff_hide_track_numbers') === '1';
  applyHideTrackNumbers(hideTrackNumbersPref);
  if (btnShowTrackNumbers) {
    btnShowTrackNumbers.classList.toggle('active', !hideTrackNumbersPref);
    btnShowTrackNumbers.addEventListener('click', () => {
      const nextShow = !btnShowTrackNumbers.classList.contains('active');
      btnShowTrackNumbers.classList.toggle('active', nextShow);
      const hide = !nextShow;
      localStorage.setItem('riff_hide_track_numbers', hide ? '1' : '0');
      applyHideTrackNumbers(hide);
    });
  }

  function applyNoHandCursor(on) {
    document.body.classList.toggle('no-hand-cursor', !!on);
  }
  var btnNoHandCursor = document.getElementById('btn-no-hand-cursor');
  var noHand = localStorage.getItem('riff_no_hand_cursor') !== '0';
  applyNoHandCursor(noHand);
  if (btnNoHandCursor) {
    btnNoHandCursor.classList.toggle('active', noHand);
    btnNoHandCursor.addEventListener('click', () => {
      const next = !btnNoHandCursor.classList.contains('active');
      btnNoHandCursor.classList.toggle('active', next);
      localStorage.setItem('riff_no_hand_cursor', next ? '1' : '0');
      applyNoHandCursor(next);
    });
  }

  function applyHighlightButtons(on) {
    document.body.classList.toggle('highlight-buttons', !!on);
  }
  var btnHighlightButtons = document.getElementById('btn-highlight-buttons');
  var initialHighlightButtons = localStorage.getItem('riff_highlight_buttons') !== '0';
  applyHighlightButtons(initialHighlightButtons);
  if (btnHighlightButtons) {
    btnHighlightButtons.classList.toggle('active', initialHighlightButtons);
    btnHighlightButtons.addEventListener('click', () => {
      const next = !btnHighlightButtons.classList.contains('active');
      btnHighlightButtons.classList.toggle('active', next);
      localStorage.setItem('riff_highlight_buttons', next ? '1' : '0');
      applyHighlightButtons(next);
    });
  }

  var RIFF_APP_ICONS = [
    { id: '01-default.svg', label: 'Default' },
    { id: '02-editor.svg', label: 'Editor' },
    { id: '03-orbit.svg', label: 'Orbit' },
    { id: '04-vinyl.svg', label: 'Vinyl' },
    { id: '06-cosmos.svg', label: 'Cosmos' },
    { id: '07-aurora.svg', label: 'Aurora' },
    { id: '08-sunset.svg', label: 'Sunset' },
    { id: '09-amethyst.svg', label: 'Amethyst' },
    { id: '10-y2k-disc.svg', label: 'Y2K Disc' },
    { id: '11-cassette.svg', label: 'Cassette' },
    { id: '12-invincible.svg', label: 'Invincible' },
    { id: '13-blueprint.svg', label: 'Blueprint' },
    { id: '14-galaxy.svg', label: 'Galaxy' },
    { id: '15-opal.svg', label: 'Opal' },
    { id: '16-chrome.svg', label: 'Chrome' },
    { id: '17-eclipse.svg', label: 'Eclipse' },
    { id: '18-nebula.svg', label: 'Nebula' },
    { id: '19-horizon.svg', label: 'Horizon' },
    { id: '20-halloween.svg', label: 'Halloween 2026' }
  ];

  function resolveAppIconSrc(val) {
    if (!val) return '../../assets/02-editor.svg';
    if (val.startsWith('file:') || val.startsWith('http') || val.startsWith('data:')) return val;
    return '../../assets/' + val.replace(/^.*assets\//, '');
  }
  function updateHomeBannerColorsFromIcon(imgSrc) {
    const navBtn = document.getElementById('nav-discover');
    if (!navBtn || !imgSrc) return;
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = 24;
        c.height = 24;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, 24, 24);
        const data = ctx.getImageData(0, 0, 24, 24).data;
        const picked = [];
        const quads = [[0, 0, 12, 12], [12, 0, 24, 12], [0, 12, 12, 24], [12, 12, 24, 24]];
        for (const [x0, y0, x1, y1] of quads) {
          let rS = 0, gS = 0, bS = 0, cnt = 0;
          for (let y = y0; y < y1; y++) {
            for (let x = x0; x < x1; x++) {
              const idx = (y * 24 + x) * 4;
              const a = data[idx + 3];
              const r = data[idx], g = data[idx + 1], b = data[idx + 2];
              if (a > 60 && (r + g + b) > 30) {
                rS += r; gS += g; bS += b; cnt++;
              }
            }
          }
          if (cnt > 0) {
            let avgR = Math.round(rS / cnt);
            let avgG = Math.round(gS / cnt);
            let avgB = Math.round(bS / cnt);
            const lum = (avgR * 299 + avgG * 587 + avgB * 114) / 1000;
            if (lum > 140) {
              const dim = Math.max(0.35, 140 / lum);
              avgR = Math.round(avgR * dim);
              avgG = Math.round(avgG * dim);
              avgB = Math.round(avgB * dim);
            }
            picked.push(`rgb(${avgR}, ${avgG}, ${avgB})`);
          }
        }
        while (picked.length < 4) picked.push(picked[0] || 'var(--md-sys-color-primary)');
        navBtn.style.setProperty('--sb-ban-c1', picked[0]);
        navBtn.style.setProperty('--sb-ban-c2', picked[1]);
        navBtn.style.setProperty('--sb-ban-c3', picked[2]);
        navBtn.style.setProperty('--sb-ban-c4', picked[3]);
      } catch (_) {}
    };
    img.src = imgSrc;
  }
  function applyHomeAppIcon(val) {
    const chosen = val || localStorage.getItem('riff_app_icon') || '02-editor.svg';
    localStorage.setItem('riff_app_icon', chosen);
    const resolved = resolveAppIconSrc(chosen);
    const homeImg = document.getElementById('nav-home-app-icon');
    if (homeImg) homeImg.src = resolved;
    const settingHomeImg = document.getElementById('setting-home-app-icon');
    if (settingHomeImg) settingHomeImg.src = resolved;
    let linkIcon = document.querySelector('link[rel="icon"]');
    if (!linkIcon) {
      linkIcon = document.createElement('link');
      linkIcon.rel = 'icon';
      document.head.appendChild(linkIcon);
    }
    linkIcon.href = resolved;
    let linkShortcut = document.querySelector('link[rel="shortcut icon"]');
    if (!linkShortcut) {
      linkShortcut = document.createElement('link');
      linkShortcut.rel = 'shortcut icon';
      document.head.appendChild(linkShortcut);
    }
    linkShortcut.href = resolved;
    if (window.electronAPI && typeof window.electronAPI.installLauncher === 'function') {
      try { window.electronAPI.installLauncher(); } catch (_) {}
    }
    const grid = document.getElementById('app-icon-picker-grid');
    if (grid) {
      grid.querySelectorAll('.app-icon-option').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.icon === chosen);
      });
    }
    updateHomeBannerColorsFromIcon(resolved);
  }
  function initAppIconPicker() {
    const grid = document.getElementById('app-icon-picker-grid');
    const saved = localStorage.getItem('riff_app_icon') || '02-editor.svg';
    if (grid) {
      grid.innerHTML = '';
      RIFF_APP_ICONS.forEach(item => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'app-icon-option' + (saved === item.id ? ' active' : '');
        btn.dataset.icon = item.id;
        btn.innerHTML = '<div class="app-icon-option-box"><img src="' + resolveAppIconSrc(item.id) + '" alt="' + item.label + '" draggable="false" /></div><span class="app-icon-option-label">' + item.label + '</span>';
        btn.addEventListener('click', () => applyHomeAppIcon(item.id));
        grid.appendChild(btn);
      });
    }
    const btnCustom = document.getElementById('btn-pick-custom-home-icon');
    if (btnCustom && window.electronAPI && window.electronAPI.pickMedia) {
      btnCustom.addEventListener('click', async () => {
        const url = await window.electronAPI.pickMedia();
        if (url) applyHomeAppIcon(url);
      });
    }
    applyHomeAppIcon(saved);
  }
  initAppIconPicker();


  function reorderSettingsNav() {
    const nav = document.getElementById('settings-nav');
    if (!nav) return;
    const searchBox = nav.querySelector('.settings-search-box');
    if (searchBox && nav.firstElementChild !== searchBox) {
      nav.insertBefore(searchBox, nav.firstElementChild);
    }
    const order = ['interface', 'theme', 'banners', 'tracks', 'integrations', 'storage', 'about', 'advanced', 'custom-themes', 'plugins'];
    const buttons = Array.from(nav.querySelectorAll('.settings-nav-btn'));
    if (!buttons.length) return;
    const btnMap = new Map();
    buttons.forEach(b => {
      if (b.dataset.cat) btnMap.set(b.dataset.cat, b);
    });
    order.forEach(cat => {
      const b = btnMap.get(cat);
      if (b) nav.appendChild(b);
    });
    let spacer = nav.querySelector('div[style*="flex"]') || nav.querySelector('.settings-nav-spacer');
    if (!spacer) {
      spacer = document.createElement('div');
      spacer.className = 'settings-nav-spacer';
      spacer.style.cssText = 'flex: 1 1 auto; min-height: 12px;';
    }
    nav.appendChild(spacer);
    const accountBtn = btnMap.get('account') || nav.querySelector('#settings-nav-account');
    if (accountBtn) {
      nav.appendChild(accountBtn);
    }
  }
  window.reorderSettingsNav = reorderSettingsNav;

  function showSettingsCategory(cat) {
    if (cat === 'appearance' || cat === 'overview' || !cat || cat === 'home') cat = 'interface';
    try { localStorage.setItem('riff_settings_cat', cat); } catch (e) {}
    reorderSettingsNav();
    const viewSettings = el.viewSettings || document.getElementById('view-settings');
    if (!viewSettings) return;
    const isVisible = viewSettings.classList.contains('active') ||
                      viewSettings.classList.contains('modal-open') ||
                      (viewSettings.offsetParent !== null && getComputedStyle(viewSettings).display !== 'none');
    if (!isVisible) return;
    if (viewSettings._activeCat === cat) return;
    viewSettings._activeCat = cat;

    if (typeof ensureMonoBrightnessSliderDOM === 'function') ensureMonoBrightnessSliderDOM();
    if (typeof ensureDisableAnimationsDOM === 'function') ensureDisableAnimationsDOM();
    if (typeof ensureTrackRowHeightSliderDOM === 'function') ensureTrackRowHeightSliderDOM();
    if (typeof ensureTopMomentIconSettingsDOM === 'function') ensureTopMomentIconSettingsDOM();
    if (typeof ensureRiffHomeIconSettingDOM === 'function') ensureRiffHomeIconSettingDOM();
    if (typeof ensureCoverBgSettingsDOM === 'function') ensureCoverBgSettingsDOM();
    if (typeof ensureAboutSupportDOM === 'function') ensureAboutSupportDOM();
    if (typeof updateAboutSupportLottieState === 'function') updateAboutSupportLottieState(cat === 'about');
    if (cat === 'about' && typeof initAboutSupportLottie === 'function') initAboutSupportLottie();
    document.querySelectorAll('#view-settings .setting-item.hidden').forEach(i => i.classList.remove('hidden'));
    document.querySelectorAll('#view-settings .settings-section').forEach(s => {
      s.style.display = '';
      s.classList.toggle('cat-hidden', s.dataset.cat !== cat);
    });
    document.querySelectorAll('#settings-nav .settings-nav-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === cat));
    const pane = document.querySelector('#view-settings .settings-pane'); if (pane) pane.scrollTop = 0;
    if (cat === 'custom-themes' && typeof renderThemeCards === 'function' && !document.getElementById('custom-themes-list')?.children.length) renderThemeCards();
    if (cat === 'plugins' && typeof reloadPluginsList === 'function') reloadPluginsList();
    if (cat === 'account' && typeof syncLocalAccountUI === 'function') syncLocalAccountUI();
    requestAnimationFrame(() => {
      refreshStacks();
      if (typeof syncAllThemeToggleIndicators === 'function') syncAllThemeToggleIndicators();
    });
  }
  window.showSettingsCategory = showSettingsCategory;

  var settingsSearchInput = document.getElementById('settings-search-input');
  var settingsSearchClear = document.getElementById('settings-search-clear');

  function resetSettingsSearch() {
    const input = document.getElementById('settings-search-input');
    const clearBtn = document.getElementById('settings-search-clear');
    if (input && input.value) {
      input.value = '';
      input.dispatchEvent(new Event('input'));
    }
    if (clearBtn) clearBtn.classList.add('hidden');
  }
  window.resetSettingsSearch = resetSettingsSearch;

  if (settingsSearchInput) {
    settingsSearchInput.addEventListener('input', () => {
      const q = settingsSearchInput.value.trim().toLowerCase();
      const clearBtn = document.getElementById('settings-search-clear');
      if (clearBtn) clearBtn.classList.toggle('hidden', !q);

      const sections = document.querySelectorAll('#view-settings .settings-section');
      const activeNavBtn = document.querySelector('#view-settings .settings-nav-btn.active');
      const activeCat = activeNavBtn ? activeNavBtn.dataset.cat : 'interface';

      if (!q) {
        sections.forEach(sec => {
          sec.style.display = '';
          sec.classList.toggle('active', sec.dataset.cat === activeCat);
          sec.querySelectorAll('.setting-item, .m3-group, .settings-section-title, details, .ct-head, .ct-list, .about-hero').forEach(elNode => {
            elNode.style.display = '';
          });
        });
        return;
      }

      sections.forEach(sec => {
        const items = Array.from(sec.querySelectorAll('.setting-item'));
        let sectionMatchCount = 0;

        items.forEach(item => {
          const nameText = (item.querySelector('.setting-name')?.textContent || item.textContent || '').toLowerCase();
          const hintText = (item.querySelector('.setting-hint')?.textContent || '').toLowerCase();
          const matched = nameText.includes(q) || hintText.includes(q);
          item.style.display = matched ? '' : 'none';
          if (matched) sectionMatchCount++;
        });

        sec.querySelectorAll('.m3-group, details').forEach(grp => {
          const visibleInGrp = Array.from(grp.querySelectorAll('.setting-item')).some(it => it.style.display !== 'none');
          grp.style.display = visibleInGrp ? '' : 'none';
          if (visibleInGrp && grp.tagName === 'DETAILS') grp.open = true;
        });

        sec.querySelectorAll('.settings-section-title, .ct-head, .ct-list, .about-hero').forEach(extra => {
          extra.style.display = 'none';
        });

        if (sectionMatchCount > 0) {
          sec.classList.add('active');
          sec.style.display = 'block';
        } else {
          sec.classList.remove('active');
          sec.style.display = 'none';
        }
      });
    });
  }

  if (settingsSearchClear) {
    settingsSearchClear.addEventListener('click', () => {
      if (settingsSearchInput) {
        settingsSearchInput.value = '';
        settingsSearchInput.dispatchEvent(new Event('input'));
        settingsSearchInput.focus();
      }
    });
  }

  var settingsNav = document.getElementById('settings-nav');
  if (settingsNav) {
    reorderSettingsNav();
    settingsNav.addEventListener('click', (e) => {
      const btn = e.target.closest('.settings-nav-btn');
      if (btn && btn.dataset.cat) {
        resetSettingsSearch();
        showSettingsCategory(btn.dataset.cat);
      }
    });
  }

  document.querySelectorAll('.settings-home-card').forEach(card => {
    card.addEventListener('click', () => {
      const cat = card.dataset.target;
      if (cat) showSettingsCategory(cat);
    });
  });
  var sliderUiAlphaHome = document.getElementById('slider-ui-alpha-home');
  var valUiAlphaHome = document.getElementById('val-ui-alpha-home');
  if (sliderUiAlphaHome && el.sliderUiAlpha) {
    sliderUiAlphaHome.value = el.sliderUiAlpha.value;
    if (valUiAlphaHome) valUiAlphaHome.textContent = `${el.sliderUiAlpha.value}%`;
    sliderUiAlphaHome.addEventListener('input', (e) => {
      el.sliderUiAlpha.value = e.target.value;
      el.sliderUiAlpha.dispatchEvent(new Event('input'));
      if (valUiAlphaHome) valUiAlphaHome.textContent = `${e.target.value}%`;
    });
    el.sliderUiAlpha.addEventListener('input', () => {
      sliderUiAlphaHome.value = el.sliderUiAlpha.value;
      if (valUiAlphaHome) valUiAlphaHome.textContent = `${el.sliderUiAlpha.value}%`;
    });
  }
  var btnPerfHome = document.getElementById('btn-perf-mode-home');
  var btnPerfMain = document.getElementById('btn-perf-mode');
  if (btnPerfHome && btnPerfMain) {
    const syncPerfHome = () => btnPerfHome.classList.toggle('active', document.body.classList.contains('perf'));
    syncPerfHome();
    btnPerfHome.addEventListener('click', () => {
      btnPerfMain.click();
      syncPerfHome();
    });
    btnPerfMain.addEventListener('click', syncPerfHome);
  }

  var customThemes = [];
  var appCssCache = null;


  function emitPluginEvent(event, data) {
    const listeners = Array.isArray(window.pluginListeners) ? window.pluginListeners : (Array.isArray(pluginListeners) ? pluginListeners : []);
    listeners.filter((l) => l && l.event === event).forEach((l) => { try { l.cb(data); } catch (e) { reportPluginError(l.file, e); } });
  }
  function reportPluginError(file, e) {
    console.error('[plugin ' + file + ']', e);
    showToast(`Plugin ${file} failed: ${e && e.message ? e.message : e}`, 'error');
  }
  function createPluginApi(p) {
    const prefix = `riff_plugin_${p.file}_`;
    return {
      plugin: { file: p.file, name: p.name, author: p.author, version: p.version },
      on(event, cb) {
        const l = { event, cb, file: p.file };
        pluginListeners.push(l);
        return () => { const i = pluginListeners.indexOf(l); if (i >= 0) pluginListeners.splice(i, 1); };
      },
      toast: (message, type) => showToast(String(message), type || 'info'),
      addStyle(css) {
        const s = document.createElement('style');
        s.dataset.riffCustom = 'plugin';
        s.dataset.plugin = p.file;
        s.textContent = css;
        document.head.appendChild(s);
        return () => s.remove();
      },
      storage: {
        get: (k, d) => { const v = localStorage.getItem(prefix + k); return v === null ? d : JSON.parse(v); },
        set: (k, v) => localStorage.setItem(prefix + k, JSON.stringify(v))
      },
      getTrack: () => state.currentTrack,
      isPlaying: () => state.isPlaying,
      audio: () => el.nativeAudio,
      query: (sel) => document.querySelector(sel),
      sameTrack: (a, b) => isSameTrack(a, b),
      shuffle: {
        setProvider(fn) {
          shuffleProvider = typeof fn === 'function' ? { fn, file: p.file } : null;
          return () => {
            if (shuffleProvider && shuffleProvider.file === p.file) shuffleProvider = null;
          };
        },
        isOn: () => !!state.isShuffle
      },
      queue: {
        get: () => state.queue.slice(),
        getIndex: () => state.queueIndex,
        getContext: () => state.currentTrackContext,
        append(tracks) {
          const added = [];
          (Array.isArray(tracks) ? tracks : []).forEach(track => {
            if (!track || !track.title || (!track.id && !track.url)) return;
            if (state.queue.some(queued => isSameTrack(queued, track))) return;
            state.queue.push(track);
            added.push(track);
          });
          if (added.length) {
            updateQueueBadge();
            if (state.currentView === 'queue') renderQueueView();
          }
          return added;
        }
      },
      library: {
        favorites: () => (state.favorites || []).slice(),
        history: () => (state.history || []).slice()
      },
      api: {
        async search(query, options) {
          const opts = options || {};
          const limit = Math.max(1, Math.min(parseInt(opts.limit, 10) || 10, 30));
          const url = `http://127.0.0.1:${state.serverPort}/api/search?q=${encodeURIComponent(query)}&platform=${encodeURIComponent(opts.platform || state.platform)}&limit=${limit}`;
          const response = await fetch(url, { signal: opts.signal });
          if (!response.ok) throw new Error(`Search failed (${response.status})`);
          const data = await response.json();
          if (!data || !data.success) throw new Error(data && data.error || 'Search failed');
          if (!Array.isArray(data.tracks)) throw new Error('Search returned an invalid response');
          return data.tracks;
        },
        async vibe(body) {
          const response = await fetch(`http://127.0.0.1:${state.serverPort}/api/vibe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body || {})
          });
          if (!response.ok) throw new Error(`Recommendations failed (${response.status})`);
          const data = await response.json();
          if (!data || !data.success) throw new Error(data && data.error || 'Recommendations failed');
          if (!Array.isArray(data.tracks)) throw new Error('Recommendations returned an invalid response');
          return data.tracks;
        }
      }
    };
  }
  function runPlugin(p) {
    if (loadedPlugins.has(p.file)) return;
    try {
      const api = createPluginApi(p);
      const fn = new Function('Riff', 'plugin', `${p.code}\n//# sourceURL=riff-plugin-${p.file}`);
      const result = fn(api, api.plugin);
      loadedPlugins.set(p.file, { stop: result && typeof result.stop === 'function' ? result.stop : null });
    } catch (e) { reportPluginError(p.file, e); }
  }
  function stopPlugin(p, silent) {
    const entry = loadedPlugins.get(p.file);
    try { if (entry && entry.stop) entry.stop(); } catch (e) { reportPluginError(p.file, e); }
    for (let i = pluginListeners.length - 1; i >= 0; i--) if (pluginListeners[i].file === p.file) pluginListeners.splice(i, 1);
    if (shuffleProvider && shuffleProvider.file === p.file) shuffleProvider = null;
    document.querySelectorAll(`style[data-plugin="${p.file}"]`).forEach((n) => n.remove());
    const hadStop = !!(entry && entry.stop);
    loadedPlugins.delete(p.file);
    if (!silent && !hadStop) showToast(`Restart Riff to fully unload "${p.name}"`, 'info');
  }
  var pluginsCache = [];
  function renderPluginCards() {
    const list = document.getElementById('plugins-list');
    if (!list) return;
    list.innerHTML = '';
    if (!pluginsCache.length) {
      const empty = document.createElement('div');
      empty.className = 'ct-empty';
      empty.textContent = 'No plugins. Put .js files into the plugins folder or click Add.';
      list.appendChild(empty);
      return;
    }
    pluginsCache.forEach((p) => {
      const card = document.createElement('div');
      card.className = 'ct-card plugin-card';
      card.innerHTML = '<div class="ct-info"><div class="ct-name"></div><div class="ct-meta"></div></div><button class="btn-icon-pill ct-remove" title="Delete file"><svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button><button class="effect-switch-btn"><span class="thumb"></span></button>';
      card.querySelector('.ct-name').textContent = `${p.name}${p.version ? ' v' + p.version : ''}`;
      card.querySelector('.ct-meta').textContent = [p.author && `by ${p.author}`, p.description, p.file].filter(Boolean).join(' · ');
      const toggle = card.querySelector('.effect-switch-btn');
      toggle.classList.toggle('active', !!p.enabled);
      toggle.addEventListener('click', () => {
        p.enabled = !p.enabled;
        toggle.classList.toggle('active', p.enabled);
        window.electronAPI.setPluginEnabled(p.file, p.enabled);
        if (p.enabled) runPlugin(p); else stopPlugin(p, false);
      });
      card.querySelector('.ct-remove').addEventListener('click', () => {
        stopPlugin(p, true);
        window.electronAPI.removePlugin(p.file);
        pluginsCache = pluginsCache.filter((x) => x.file !== p.file);
        renderPluginCards();
        showToast('Plugin file deleted', 'info');
      });
      list.appendChild(card);
    });
  }
  async function loadPlugins() {
    if (!window.electronAPI || !window.electronAPI.listPlugins) return;
    pluginsCache = await window.electronAPI.listPlugins();
    pluginsCache.filter((p) => p.enabled).forEach(runPlugin);
    renderPluginCards();
  }
  var pluginsApi = window.electronAPI;
  async function reloadPluginsList() {
    if (pluginsApi && pluginsApi.listPlugins) {
      pluginsCache = await pluginsApi.listPlugins();
      const present = new Set(pluginsCache.map((x) => x.file));
      [...loadedPlugins.keys()].filter((f) => !present.has(f)).forEach((f) => stopPlugin({ file: f, name: f }, true));
    }
    renderPluginCards();
  }
  if (pluginsApi && pluginsApi.listPlugins) {
    document.getElementById('btn-plugins-folder').addEventListener('click', () => pluginsApi.openPluginsFolder());
    document.getElementById('btn-plugins-reload').addEventListener('click', reloadPluginsList);
    document.getElementById('btn-add-plugin').addEventListener('click', async () => {
      const added = await pluginsApi.importPlugins();
      if (!added) return;
      pluginsCache = await pluginsApi.listPlugins();
      renderPluginCards();
      showToast(`Added ${added} plugin${added > 1 ? 's' : ''}. Turn one on to run it`, 'info');
    });
  }

  var cssEditorInstance = null;
  var cssEditorLoading = null;


  function loadMonaco() {
    if (window.monaco) return Promise.resolve(window.monaco);
    if (cssEditorLoading) return cssEditorLoading;
    cssEditorLoading = new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '../../vendor/monaco/vs/editor/editor.main.css';
      document.head.appendChild(link);
      const s = document.createElement('script');
      s.src = '../../vendor/monaco/vs/loader.js';
      s.onload = () => {
        const monacoBaseUrl = new URL('../../vendor/monaco/', window.location.href).href;
        window.MonacoEnvironment = {
          getWorkerUrl: function () {
            const blob = new Blob([
              `self.MonacoEnvironment = { baseUrl: '${monacoBaseUrl}' }; importScripts('${monacoBaseUrl}vs/base/worker/workerMain.js');`
            ], { type: 'text/javascript' });
            return URL.createObjectURL(blob);
          }
        };
        window.require.config({ paths: { vs: '../../vendor/monaco/vs' } });
        window.require(['vs/editor/editor.main'], () => resolve(window.monaco), reject);
      };
      s.onerror = reject;
      document.head.appendChild(s);
    });
    return cssEditorLoading;
  }

  function defineRiffMonacoTheme(monaco) {
    const cs = getComputedStyle(document.documentElement);
    const hex = (name, fallback) => { const v = cs.getPropertyValue(name).trim(); return /^#[0-9a-f]{6}$/i.test(v) ? v : fallback; };
    const bg = hex('--md-sys-color-surface-container-lowest-solid', '#141218');
    const high = hex('--md-sys-color-surface-container-high-solid', '#2b2930');
    const primary = hex('--md-sys-color-primary', '#d0bcff');
    const lum = (h) => { const n = parseInt(h.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };
    const isDark = lum(bg) < 0.5;
    const fg = isDark ? '#e6e1e5' : '#1c1b1f';
    monaco.editor.defineTheme('riff', {
      base: isDark ? 'vs-dark' : 'vs',
      inherit: true,
      rules: [
        { token: '', foreground: isDark ? 'e6e1e5' : '1c1b1f' },
        { token: 'comment', foreground: '8a8a8a', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'c586c0' },
        { token: 'string', foreground: 'ce9178' },
        { token: 'number', foreground: 'b5cea8' },
        { token: 'attribute.name', foreground: '9cdcfe' },
        { token: 'attribute.value', foreground: 'ce9178' },
        { token: 'tag', foreground: '4ec9b0' },
        { token: 'delimiter', foreground: isDark ? 'd4d4d4' : '222222' }
      ],
      colors: {
        'editor.background': bg,
        'editor.foreground': fg,
        'editorGutter.background': bg,
        'minimap.background': bg,
        'editor.lineHighlightBackground': high,
        'editorCursor.foreground': primary,
        'editor.selectionBackground': primary + '55'
      }
    });
    monaco.editor.setTheme('riff');
  }

  async function openCssEditor() {
    if (typeof closeSettingsModal === 'function') {
      closeSettingsModal();
    }
    const overlay = document.getElementById('css-editor');
    overlay.classList.remove('hidden');
    let monaco;
    try { monaco = await loadMonaco(); } catch (e) { overlay.classList.add('hidden'); showToast('Could not load the CSS editor', 'error'); return; }
    defineRiffMonacoTheme(monaco);
    if (cssEditorInstance) {
      cssEditorInstance.layout();
      cssEditorInstance.focus();
      return;
    }
    cssEditorInstance = monaco.editor.create(document.getElementById('css-editor-host'), {
      value: localStorage.getItem('riff_custom_css') || '/* Your CSS goes here. Example:\n.btn-pill-primary { border-radius: 8px; }\n*/\n',
      language: 'css',
      theme: 'riff',
      automaticLayout: true,
      minimap: { enabled: true },
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
      fontLigatures: true,
      roundedSelection: true,
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      cursorSmoothCaretAnimation: 'on',
      padding: { top: 12 },
      tabSize: 2,
      wordWrap: 'on',
      bracketPairColorization: { enabled: true },
      colorDecorators: true
    });
    let saveTimer = 0;
    cssEditorInstance.onDidChangeModelContent(() => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        localStorage.setItem('riff_custom_css', cssEditorInstance.getValue());
        applyCustomStyles();
      }, 350);
    });
    setTimeout(() => {
      if (cssEditorInstance) {
        cssEditorInstance.layout();
        cssEditorInstance.focus();
      }
    }, 60);
  }

  var btnOpenCssEditor = document.getElementById('btn-open-css-editor');
  if (btnOpenCssEditor) btnOpenCssEditor.addEventListener('click', openCssEditor);
  var btnCssClose = document.getElementById('btn-css-close');
  if (btnCssClose) btnCssClose.addEventListener('click', () => document.getElementById('css-editor').classList.add('hidden'));
  var btnCssClear = document.getElementById('btn-css-clear');
  if (btnCssClear) btnCssClear.addEventListener('click', () => {
    const current = localStorage.getItem('riff_custom_css') || '';
    if (current.trim()) localStorage.setItem('riff_custom_css_backup', current);
    if (cssEditorInstance) cssEditorInstance.setValue('');
    else { localStorage.removeItem('riff_custom_css'); applyCustomStyles(); }
  });
  var btnCssRestore = document.getElementById('btn-css-restore');
  if (btnCssRestore) btnCssRestore.addEventListener('click', () => {
    const backup = localStorage.getItem('riff_custom_css_backup');
    if (!backup) { showToast('Nothing to restore', 'info'); return; }
    if (cssEditorInstance) cssEditorInstance.setValue(backup);
    else { localStorage.setItem('riff_custom_css', backup); applyCustomStyles(); }
  });


  function addSliderTicks(input) {
    const item = input.closest('.setting-item') || input.parentElement;
    const hints = item ? item.querySelector('.setting-hints') : null;
    const spans = hints ? [...hints.querySelectorAll('span')].map(s => s.textContent) : [];
    const min = +input.min, max = +input.max, step = +input.step || 1;
    const def = +input.getAttribute('value');
    const labels = {};
    if (spans.length === 3) { labels[min] = spans[0]; labels[def] = spans[1]; labels[max] = spans[2]; }
    else if (spans.length === 2) { labels[min] = spans[0]; labels[max] = spans[1]; }
    const wrap = document.createElement('div'); wrap.className = 'slider-ticks';
    for (let v = min; v <= max; v += step) {
      const t = document.createElement('i'); t.style.setProperty('--p', (v - min) / (max - min));
      if (labels[v] != null) { t.className = 'major'; const s = document.createElement('span'); s.textContent = labels[v]; t.appendChild(s); }
      wrap.appendChild(t);
    }
    const host = input.closest('.sl') || input;
    host.insertAdjacentElement('afterend', wrap);
    if (hints) hints.remove();
  }

  var scaleInput = document.getElementById('settings-slider-scale');
  if (scaleInput) addSliderTicks(scaleInput);
  document.querySelectorAll('#view-settings .pill-range').forEach(input => {
    if (input === scaleInput) return;
    const item = input.closest('.setting-item') || input.parentElement;
    const hints = item ? item.querySelector('.setting-hints') : null;
    if (!hints) return;
    const min = +input.min, max = +input.max, step = +input.step || 1;
    if ((max - min) / step <= 20) {
      addSliderTicks(input);
    }
  });

  function decorateSwitches(root) {
    (root || document).querySelectorAll('.effect-switch-btn .thumb:not(.has-icon):not([data-enhanced="true"])').forEach((t) => {
      if (t.dataset.enhanced === 'true' || t.classList.contains('has-icon')) return;
      t.dataset.enhanced = 'true';
      t.classList.add('has-icon');
      t.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="sw-icon"/></svg>';
    });
  }


  function applyWelcomeResult(d) {
    if (!d) return;
    function setSwitch(btn, on) { if (btn && btn.classList.contains('active') !== !!on) btn.click(); }
    if (d.theme) {
      const modeBtn = document.querySelector(`.theme-mode-btn[data-theme-mode="${d.theme.b < 50 ? 'dark' : 'light'}"]`);
      if (modeBtn) modeBtn.click();
      const sH = document.getElementById('slider-theme-hue');
      if (sH && d.theme.h !== undefined) { sH.value = d.theme.h; sH.dispatchEvent(new Event('input', { bubbles: true })); }
      const sB = document.getElementById('slider-theme-brightness');
      if (sB && d.theme.b !== undefined) {
        sB.value = Math.min(Math.max(d.theme.b, Number(sB.min) || 0), Number(sB.max) || 100);
        sB.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    if (d.toggles) {
      setSwitch(document.getElementById('btn-show-local'), d.toggles.riff_show_local);
      setSwitch(document.getElementById('btn-search-artists'), d.toggles.riff_search_artists);
      setSwitch(document.getElementById('btn-no-hand-cursor'), d.toggles.riff_no_hand_cursor);
      setSwitch(document.getElementById('btn-perf-mode'), d.toggles.riff_perf_mode);
      if (d.toggles.riff_custom_bg_enabled && d.background) {
        localStorage.setItem('riff_bg_url', d.background);
        if (typeof updateCustomBg === 'function') updateCustomBg();
        if (typeof onBackgroundChanged === 'function') onBackgroundChanged('custom', true);
      }
    }
    if (d.discord !== undefined) setSwitch(document.getElementById('btn-discord-rpc'), d.discord);
    if (d.spotify && d.spotify.url) {
      const btnOpen = document.getElementById('btn-open-spotify-import');
      if (btnOpen) btnOpen.click();
      const urlInput = document.getElementById('spotify-import-url');
      if (urlInput) urlInput.value = d.spotify.url;
      const targetInput = document.getElementById('spotify-import-target');
      if (targetInput) targetInput.value = 'new';
      const btnConfirm = document.getElementById('btn-confirm-spotify-import');
      if (btnConfirm) btnConfirm.click();
    }
    showToast('Welcome to Riff!', 'info');
  }
  if (window.electronAPI && window.electronAPI.onWelcomeResult) window.electronAPI.onWelcomeResult((d) => applyWelcomeResult(d));

  function checkCompactLayout() {
    const isMini = window.innerWidth <= 520;
    document.body.classList.toggle('mini', isMini);
    const savedLyricsOn = localStorage.getItem('riff_mini_lyrics') === '1';
    document.body.classList.toggle('mini-lyrics-on', isMini && savedLyricsOn);
    const btn = document.getElementById('btn-mini-lyrics');
    if (btn) btn.classList.toggle('active', isMini && savedLyricsOn);
    if (isMini && savedLyricsOn) {
      renderMiniLyrics();
      if (el.nativeAudio) updateMiniLyricsHighlight(el.nativeAudio.currentTime || 0);
    }
  }
  window.addEventListener('resize', checkCompactLayout);
  checkCompactLayout();

  async function toggleMiniWindow() {
    if (window.electronAPI && window.electronAPI.toggleMiniWindow) {
      const isNowMini = await window.electronAPI.toggleMiniWindow();
      if (isNowMini) {
        const savedLyricsOn = localStorage.getItem('riff_mini_lyrics') === '1';
        if (savedLyricsOn && window.electronAPI.setMiniLyrics) {
          await window.electronAPI.setMiniLyrics(true);
        }
      }
    }
  }
  window.toggleMiniWindow = toggleMiniWindow;
  window.renderMiniLyrics = renderMiniLyrics;
  window.updateMiniLyricsHighlight = updateMiniLyricsHighlight;
  window.setSyncedLyrics = (lyrics) => { state.syncedLyrics = lyrics; renderMiniLyrics(); };

  var btnMiniPlayer = document.getElementById('btn-mini-player');
  if (btnMiniPlayer) {
    btnMiniPlayer.addEventListener('click', () => {
      toggleMiniWindow();
    });
  }

  var btnMiniLyrics = document.getElementById('btn-mini-lyrics');
  if (btnMiniLyrics) {
    btnMiniLyrics.addEventListener('click', async () => {
      const nextOn = !document.body.classList.contains('mini-lyrics-on');
      localStorage.setItem('riff_mini_lyrics', nextOn ? '1' : '0');
      document.body.classList.toggle('mini-lyrics-on', nextOn);
      btnMiniLyrics.classList.toggle('active', nextOn);
      if (window.electronAPI && window.electronAPI.setMiniLyrics) {
        await window.electronAPI.setMiniLyrics(nextOn);
      }
      if (nextOn) {
        renderMiniLyrics();
        if (el.nativeAudio) updateMiniLyricsHighlight(el.nativeAudio.currentTime || 0);
      }
    });
  }

  var knownAudioOutputIds = new Set();
  var currentAudioOutputDeviceId = localStorage.getItem('riff_audio_output_device') || 'default';

  async function applyAudioOutputDevice(deviceId) {
    currentAudioOutputDeviceId = deviceId || 'default';
    try {
      localStorage.setItem('riff_audio_output_device', currentAudioOutputDeviceId);
    } catch (_) {}

    const targetId = (deviceId === 'default' || !deviceId) ? '' : deviceId;

    if (el.nativeAudio && typeof el.nativeAudio.setSinkId === 'function') {
      try {
        await el.nativeAudio.setSinkId(targetId);
      } catch (e) {
        console.warn('Failed to set sink ID on nativeAudio:', e);
      }
    }
    if (window.audioEngine && window.audioEngine.ctx && typeof window.audioEngine.ctx.setSinkId === 'function') {
      try {
        await window.audioEngine.ctx.setSinkId(targetId);
      } catch (_) {}
    }

    const labelEl = document.getElementById('audio-output-label');
    const menuEl = document.getElementById('audio-output-menu');
    if (menuEl) {
      let foundLabel = null;
      menuEl.querySelectorAll('.m3-dropdown-option').forEach(opt => {
        const isMatch = (opt.dataset.value === currentAudioOutputDeviceId) ||
                        (opt.dataset.value === '' && currentAudioOutputDeviceId === 'default') ||
                        (opt.dataset.value === 'default' && currentAudioOutputDeviceId === '');
        if (isMatch) {
          opt.classList.add('selected');
          foundLabel = opt.textContent;
        } else {
          opt.classList.remove('selected');
        }
      });
      if (labelEl && foundLabel) {
        labelEl.textContent = foundLabel;
      }
    }
  }

  async function refreshAudioOutputDevices() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioOutputs = devices.filter(d => d.kind === 'audiooutput');
      knownAudioOutputIds = new Set(audioOutputs.map(d => d.deviceId));

      const dropdown = document.getElementById('audio-output-dropdown');
      const label = document.getElementById('audio-output-label');
      const menu = document.getElementById('audio-output-menu');

      if (menu) {
        menu.innerHTML = '';

        const defaultOpt = document.createElement('button');
        defaultOpt.type = 'button';
        const isDefault = (!currentAudioOutputDeviceId || currentAudioOutputDeviceId === 'default' || currentAudioOutputDeviceId === '');
        defaultOpt.className = 'm3-dropdown-option' + (isDefault ? ' selected' : '');
        defaultOpt.dataset.value = 'default';
        defaultOpt.textContent = 'System default';
        defaultOpt.addEventListener('click', (e) => {
          e.stopPropagation();
          applyAudioOutputDevice('default');
          if (dropdown) dropdown.classList.remove('open');
        });
        menu.appendChild(defaultOpt);

        let foundActive = isDefault;
        let activeLabel = 'System default';

        audioOutputs.forEach(device => {
          if (!device.deviceId || device.deviceId === 'default') return;
          const opt = document.createElement('button');
          opt.type = 'button';
          const isSel = (device.deviceId === currentAudioOutputDeviceId);
          if (isSel) {
            foundActive = true;
            activeLabel = device.label || `Speaker (${device.deviceId.slice(0, 5)})`;
          }
          opt.className = 'm3-dropdown-option' + (isSel ? ' selected' : '');
          opt.dataset.value = device.deviceId;
          opt.textContent = device.label || `Speaker (${device.deviceId.slice(0, 5)})`;
          opt.addEventListener('click', (e) => {
            e.stopPropagation();
            applyAudioOutputDevice(device.deviceId);
            if (dropdown) dropdown.classList.remove('open');
          });
          menu.appendChild(opt);
        });

        if (label) {
          label.textContent = activeLabel;
        }
      }
    } catch (err) {
      console.warn('Failed to enumerate audio output devices:', err);
    }
  }

  var audioOutputDropdown = document.getElementById('audio-output-dropdown');
  var audioOutputTrigger = document.getElementById('audio-output-trigger');
  if (audioOutputTrigger && audioOutputDropdown) {
    audioOutputTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      audioOutputDropdown.classList.toggle('open');
    });
    document.addEventListener('click', () => {
      audioOutputDropdown.classList.remove('open');
    });
  }

  if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
    navigator.mediaDevices.addEventListener('devicechange', async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioOutputs = devices.filter(d => d.kind === 'audiooutput');
        const currentIds = new Set(audioOutputs.map(d => d.deviceId));

        const decreased = (knownAudioOutputIds.size > 0 && audioOutputs.length < knownAudioOutputIds.size);
        const activeLost = (currentAudioOutputDeviceId && currentAudioOutputDeviceId !== 'default' && !currentIds.has(currentAudioOutputDeviceId));

        if (state.isPlaying && (decreased || activeLost)) {
          if (typeof pauseSmooth === 'function') {
            pauseSmooth();
          } else if (el.nativeAudio) {
            el.nativeAudio.pause();
          }
        }

        await refreshAudioOutputDevices();
      } catch (e) {
        console.warn('devicechange error:', e);
      }
    });
  }

  refreshAudioOutputDevices().then(() => {
    if (currentAudioOutputDeviceId && currentAudioOutputDeviceId !== 'default') {
      applyAudioOutputDevice(currentAudioOutputDeviceId);
    }
  });


  function isTextInput(target) {
    if (!target) return false;
    const tag = (target.tagName || '').toUpperCase();
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!target.isContentEditable;
  }

  function adjustVolume(delta) {
    state.volume = Math.max(0, Math.min(1, Math.round((state.volume + delta) * 100) / 100));
    state.isMuted = false;
    if (el.volumeSlider) el.volumeSlider.value = state.volume;
    if (el.volumeIcon) el.volumeIcon.classList.remove('hidden');
    if (el.volumeMutedIcon) el.volumeMutedIcon.classList.add('hidden');
    persistVolumeState();
    applyAudioSettings();
  }

  var defaultShortcuts = {
    playPause: { code: 'Space', ctrl: false, shift: false, alt: false },
    next: { code: 'ArrowRight', ctrl: true, shift: false, alt: false },
    previous: { code: 'ArrowLeft', ctrl: true, shift: false, alt: false },
    seekForward: { code: 'ArrowRight', ctrl: false, shift: true, alt: false },
    seekBack: { code: 'ArrowLeft', ctrl: false, shift: true, alt: false },
    volumeUp: { code: 'ArrowUp', ctrl: true, shift: false, alt: false },
    volumeDown: { code: 'ArrowDown', ctrl: true, shift: false, alt: false },
    mute: { code: 'KeyM', ctrl: false, shift: false, alt: false },
    shuffle: { code: 'KeyH', ctrl: false, shift: false, alt: false },
    repeat: { code: 'KeyR', ctrl: false, shift: false, alt: false },
    lyrics: { code: 'KeyL', ctrl: false, shift: false, alt: false },
    karaoke: { code: 'KeyF', ctrl: false, shift: false, alt: false },
    miniPlayer: { code: 'KeyP', ctrl: false, shift: false, alt: false },
    search: { code: 'KeyK', ctrl: true, shift: false, alt: false }
  };

  var shortcutMetadata = [
    { key: 'playPause', label: 'Play / Pause' },
    { key: 'next', label: 'Next' },
    { key: 'previous', label: 'Previous' },
    { key: 'seekForward', label: 'Seek +5s' },
    { key: 'seekBack', label: 'Seek -5s' },
    { key: 'volumeUp', label: 'Volume +5%' },
    { key: 'volumeDown', label: 'Volume -5%' },
    { key: 'mute', label: 'Mute / Unmute' },
    { key: 'shuffle', label: 'Shuffle' },
    { key: 'repeat', label: 'Repeat' },
    { key: 'lyrics', label: 'Lyrics' },
    { key: 'karaoke', label: 'TV Karaoke' },
    { key: 'miniPlayer', label: 'Mini player' },
    { key: 'search', label: 'Search' }
  ];

  var activeShortcuts = { ...defaultShortcuts };
  try {
    const rawShortcuts = localStorage.getItem('riff_keyboard_shortcuts');
    if (rawShortcuts) {
      const parsed = JSON.parse(rawShortcuts);
      if (parsed && typeof parsed === 'object') {
        for (const k of Object.keys(defaultShortcuts)) {
          if (parsed[k] && parsed[k].code) {
            activeShortcuts[k] = {
              code: String(parsed[k].code),
              ctrl: !!parsed[k].ctrl,
              shift: !!parsed[k].shift,
              alt: !!parsed[k].alt
            };
          }
        }
      }
    }
  } catch (_) {}

  function saveCustomShortcuts() {
    try {
      localStorage.setItem('riff_keyboard_shortcuts', JSON.stringify(activeShortcuts));
    } catch (_) {}
  }

  function formatShortcutBadge(binding) {
    if (!binding || !binding.code) return 'None';
    const parts = [];
    if (binding.ctrl) parts.push('Ctrl');
    if (binding.alt) parts.push('Alt');
    if (binding.shift) parts.push('Shift');
    let c = binding.code;
    if (c === 'Space') c = 'Space';
    else if (c === 'ArrowRight') c = '→';
    else if (c === 'ArrowLeft') c = '←';
    else if (c === 'ArrowUp') c = '↑';
    else if (c === 'ArrowDown') c = '↓';
    else if (c === 'Escape') c = 'Esc';
    else if (c.startsWith('Key')) c = c.slice(3);
    else if (c.startsWith('Digit')) c = c.slice(5);
    else if (c.startsWith('Numpad')) c = 'Num ' + c.slice(6);
    parts.push(c);
    return parts.join(' + ');
  }

  function shortcutMatches(event, binding) {
    if (!binding || event.code !== binding.code) return false;
    return (event.ctrlKey || event.metaKey) === binding.ctrl &&
      event.shiftKey === binding.shift &&
      event.altKey === binding.alt;
  }

  function runKeyboardShortcut(event) {
    if (isTextInput(event.target) && !event.ctrlKey && !event.metaKey && !event.altKey) return false;
    if (isTextInput(event.target) && /^Arrow/.test(event.code) &&
        (event.ctrlKey || event.metaKey || event.shiftKey)) return false;
    if (document.querySelector('.modal-backdrop:not(.hidden):not(#sync-mode-overlay)')) return false;

    if (event.code === 'MediaPlayPause' || event.key === 'MediaPlayPause') {
      togglePlayPause();
      return true;
    }
    if (event.code === 'MediaTrackNext' || event.key === 'MediaTrackNext') {
      playNext();
      return true;
    }
    if (event.code === 'MediaTrackPrevious' || event.key === 'MediaTrackPrevious') {
      playPrev();
      return true;
    }
    if (event.code === 'MediaStop' || event.key === 'MediaStop') {
      if (state.isPlaying) pauseSmooth();
      return true;
    }

    const isMod = event.ctrlKey || event.metaKey;
    if (isMod && (event.shiftKey || event.altKey)) {
      if (event.code === 'Space') { togglePlayPause(); return true; }
      if (event.code === 'ArrowRight') { playNext(); return true; }
      if (event.code === 'ArrowLeft') { playPrev(); return true; }
      if (event.code === 'ArrowUp') {
        const audio = (state.secondaryAudio && !state.secondaryAudio.paused) ? state.secondaryAudio : el.nativeAudio;
        if (audio) audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 5);
        return true;
      }
      if (event.code === 'ArrowDown') {
        const audio = (state.secondaryAudio && !state.secondaryAudio.paused) ? state.secondaryAudio : el.nativeAudio;
        if (audio) audio.currentTime = Math.max(0, audio.currentTime - 5);
        return true;
      }
    }

    const action = Object.keys(activeShortcuts).find(key => shortcutMatches(event, activeShortcuts[key]));
    if (!action) return false;
    if (action === 'playPause') {
      if (syncState && syncState.active) {
        if (syncState.currentIndex < syncState.lines.length) {
          handleSyncLineClick(syncState.currentIndex);
        }
      } else {
        togglePlayPause();
      }
    } else if (action === 'next') {
      playNext();
    } else if (action === 'previous') {
      playPrev();
    } else if (action === 'seekForward' && el.nativeAudio) {
      el.nativeAudio.currentTime = Math.min(el.nativeAudio.duration || 0, el.nativeAudio.currentTime + 5);
    } else if (action === 'seekBack' && el.nativeAudio) {
      el.nativeAudio.currentTime = Math.max(0, el.nativeAudio.currentTime - 5);
    } else if (action === 'volumeUp') {
      adjustVolume(0.05);
    } else if (action === 'volumeDown') {
      adjustVolume(-0.05);
    } else if (action === 'mute') {
      if (el.btnVolumeMute) el.btnVolumeMute.click();
    } else if (action === 'shuffle') {
      if (typeof window.toggleShuffle === 'function') window.toggleShuffle();
    } else if (action === 'repeat') {
      if (typeof window.toggleRepeat === 'function') window.toggleRepeat();
    } else if (action === 'lyrics') {
      if (el.btnToggleLyricsPanel) el.btnToggleLyricsPanel.click();
    } else if (action === 'karaoke') {
      if (typeof openTvKaraoke === 'function') openTvKaraoke();
    } else if (action === 'miniPlayer') {
      if (typeof toggleMiniWindow === 'function') toggleMiniWindow();
    } else if (action === 'search' && el.searchInput) {
      el.searchInput.focus();
      el.searchInput.select();
    }
    return true;
  }

  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space' && !isTextInput(e.target)) {
      e.preventDefault();
    }
  }, true);

  window.addEventListener('keydown', (e) => {
    const inInput = isTextInput(e.target);

    if (e.code === 'Escape' || e.key === 'Escape') {
      if (el.viewSettings && el.viewSettings.classList.contains('active')) {
        e.preventDefault();
        closeSettingsModal();
        return;
      }
      if (syncState && syncState.active) {
        e.preventDefault();
        closeSyncMode();
        return;
      }
      const openModals = Array.from(document.querySelectorAll('.modal-backdrop:not(.hidden)'));
      if (openModals.length > 0) {
        const topModal = openModals[openModals.length - 1];
        if (topModal.id === 'tools-install-modal' && (!state || !state.toolsReady)) {
          e.preventDefault();
          return;
        }
        e.preventDefault();
        closeModal(topModal);
        return;
      }
      const tvkPanel = document.getElementById('tvk-panel');
      if (state.isTvKaraokeOpen && tvkPanel && tvkPanel.classList.contains('open')) {
        e.preventDefault();
        tvkPanel.classList.remove('open');
        const btnSettings = document.getElementById('btn-tvk-settings');
        if (btnSettings) btnSettings.classList.remove('open');
        resetTvIdleTimer();
        return;
      }
      if (state.isTvKaraokeOpen && typeof closeTvKaraoke === 'function') {
        e.preventDefault();
        closeTvKaraoke();
        return;
      }
      if (inInput) {
        e.preventDefault();
        e.target.blur();
        return;
      }
      if (state.currentView === 'album') {
        e.preventDefault();
        const target = (state.previousView && state.previousView !== 'album') ? state.previousView : 'discover';
        switchView(target);
        return;
      }
      if (state.currentView === 'artist') {
        e.preventDefault();
        const target = (state.previousView && state.previousView !== 'artist') ? state.previousView : 'discover';
        switchView(target);
        return;
      }
      return;
    }

    if (inInput) {
      if ((e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') && (e.ctrlKey || e.metaKey || e.shiftKey)) {
        return;
      }
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        return;
      }
    }

  }, true);

  var btnDiscordRpc = document.getElementById('btn-discord-rpc');
  var badgeDiscordRpc = document.getElementById('badge-discord-rpc');


  function showTopAppMenu(e) {
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
    showInAppContextMenu(e, [
      {
        label: typeof t === 'function' ? t('Settings') : 'Settings',
        icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>',
        action: () => openSettingsModal('interface')
      },
      {
        label: typeof t === 'function' ? t('Account') : 'Account',
        icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
        action: () => openSettingsModal('account')
      }
    ]);
  }

  var btnTopProfileMenu = document.getElementById('btn-top-profile-menu');
  if (btnTopProfileMenu) {
    btnTopProfileMenu.addEventListener('click', showTopAppMenu);
  }
  var btnTopNavMenu = document.getElementById('btn-top-nav-menu');
  if (btnTopNavMenu) {
    btnTopNavMenu.addEventListener('click', showTopAppMenu);
  }

  var btnNavBack = document.getElementById('btn-nav-back');
  if (btnNavBack) {
    btnNavBack.addEventListener('click', () => {
      pageNavHistory.back();
    });
  }
  var btnNavForward = document.getElementById('btn-nav-forward');
  if (btnNavForward) {
    btnNavForward.addEventListener('click', () => {
      pageNavHistory.forward();
    });
  }

  window.addEventListener('mouseup', (e) => {
    if (e.button === 3) {
      e.preventDefault();
      pageNavHistory.back();
    } else if (e.button === 4) {
      e.preventDefault();
      pageNavHistory.forward();
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.altKey && e.key === 'ArrowLeft') {
      e.preventDefault();
      pageNavHistory.back();
    } else if (e.altKey && e.key === 'ArrowRight') {
      e.preventDefault();
      pageNavHistory.forward();
    }
  });

  if (pageNavHistory) {
    pageNavHistory.updateButtons();
  }

  var linkImportBtns = document.querySelectorAll('.btn-open-link-import, #btn-open-link-import');
  linkImportBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const fromCpm = !!btn.closest('#create-playlist-modal');
      document.getElementById('create-playlist-modal')?.classList.add('hidden');
      if (btn.dataset.platform && !['deezer', 'tiktok', 'vk', 'yandex'].includes(btn.dataset.platform)) setPlatform(btn.dataset.platform, false);
      openLinkImportModal(btn.dataset.platform || '');
      if (fromCpm) {
        const card = document.querySelector('#link-import-modal .dialog-card');
        if (card) {
          card.classList.remove('cpm-slide-from-right');
          void card.offsetWidth;
          card.classList.add('cpm-slide-from-right');
          setTimeout(() => card.classList.remove('cpm-slide-from-right'), 250);
        }
      }
    });
  });
  if (btnCancelLinkImport) btnCancelLinkImport.addEventListener('click', closeLinkImportModal);
  if (btnConfirmLinkImport) btnConfirmLinkImport.addEventListener('click', handleLinkImportAction);
  if (linkImportUrl) {
    linkImportUrl.addEventListener('input', () => clearImportError(linkImportError));
    linkImportUrl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleLinkImportAction();
      }
    });
  }

  var trackToDownload = null;
  var downloadBatch = null;
  var selectedFormat = localStorage.getItem('riff_download_format') || 'mp3';
  var selectedQuality = '0';


  function renderMyWaveChips(profile) {
    const chipsContainer = document.getElementById('my-wave-chips');
    if (chipsContainer) chipsContainer.innerHTML = '';
  }

  var dominantColorsCache = new Map();

  function getCoverDominantColors(url) {
    if (Array.isArray(url)) {
      url = url.find(u => typeof u === 'string' && u.trim()) || '';
    }
    if (!url || typeof url !== 'string') return Promise.resolve(['rgb(80, 80, 120)', 'rgb(120, 80, 100)']);
    if (dominantColorsCache.has(url)) {
      return Promise.resolve(dominantColorsCache.get(url));
    }
    const loadUrl = (/^https?:\/\//i.test(url) && !/^(https?:\/\/)?(127\.0\.0\.1|localhost)/i.test(url) && state.serverPort)
      ? `http://127.0.0.1:${state.serverPort}/api/image-proxy?url=${encodeURIComponent(url)}`
      : url;

    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 32;
          canvas.height = 32;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, 32, 32);
          const data = ctx.getImageData(0, 0, 32, 32).data;

          const buckets = new Map();
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const maxC = Math.max(r, g, b);
            const minC = Math.min(r, g, b);
            const delta = maxC - minC;
            const saturation = maxC > 0 ? (delta / maxC) : 0;
            const brightness = (r * 299 + g * 587 + b * 114) / 1000;
            if (brightness < 25 || brightness > 235) continue;

            const qr = Math.round(r / 32) * 32;
            const qg = Math.round(g / 32) * 32;
            const qb = Math.round(b / 32) * 32;
            const key = `${qr},${qg},${qb}`;
            const weight = 1 + Math.round(saturation * 4);
            buckets.set(key, (buckets.get(key) || 0) + weight);
          }

          const sorted = Array.from(buckets.entries()).sort((a, b) => b[1] - a[1]);
          const c1 = sorted[0] ? `rgb(${sorted[0][0]})` : 'rgb(80, 100, 140)';
          const c2 = sorted[1] ? `rgb(${sorted[1][0]})` : sorted[0] ? `rgb(${sorted[0][0]})` : 'rgb(140, 80, 100)';

          const result = [c1, c2];
          dominantColorsCache.set(url, result);
          boundMap(dominantColorsCache, 20);
          canvas.width = 0;
          canvas.height = 0;
          img.onload = null;
          img.onerror = null;
          img.src = '';
          resolve(result);
        } catch (e) {
          const fallback = ['rgb(80, 100, 140)', 'rgb(140, 80, 100)'];
          dominantColorsCache.set(url, fallback);
          boundMap(dominantColorsCache, 20);
          img.onload = null;
          img.onerror = null;
          resolve(fallback);
        }
      };
      img.onerror = () => {
        if (img.crossOrigin) {
          img.crossOrigin = null;
          img.src = loadUrl;
          return;
        }
        const fallback = ['rgb(80, 100, 140)', 'rgb(140, 80, 100)'];
        dominantColorsCache.set(url, fallback);
        boundMap(dominantColorsCache, 20);
        img.onload = null;
        img.onerror = null;
        resolve(fallback);
      };
      img.src = loadUrl;
    });
  }

  var titleOverflowSelector = '#right-panel-title, #right-panel-artist, #playbar-title, #playbar-artist, .sp-card-title, .sp-card-sub, .sp-tile-title, .sp-tile-sub, .sp-fade, .search-album-title, .track-row-title, .track-title-text, .playlist-item-name, .fav-artist-name, .my-wave-focused-title, .my-wave-focused-artist';

  var _overflowRaf = null;
  var _overflowPendingElements = new Set();

  function flushOverflowChecks() {
    _overflowRaf = null;
    if (_overflowPendingElements.size === 0) return;
    const elements = Array.from(_overflowPendingElements);
    _overflowPendingElements.clear();

    
    const results = [];
    for (let i = 0; i < elements.length; i++) {
      const node = elements[i];
      if (!node || !node.isConnected) continue;
      const isOver = node.scrollWidth > (node.clientWidth + 1);
      results.push({ node, isOver });
    }

    
    for (let i = 0; i < results.length; i++) {
      const { node, isOver } = results[i];
      node.classList.toggle('fade-overflow', isOver);
      node.classList.toggle('fade-end', isOver);
      node.classList.toggle('is-overflowing', isOver);
    }
  }

  function updateTextFade(el) {
    if (!el) return;
    _overflowPendingElements.add(el);
    if (!_overflowRaf) {
      _overflowRaf = requestAnimationFrame(flushOverflowChecks);
    }
  }
  window.updateTextFade = updateTextFade;

  function refreshOverflowFades(root = document) {
    if (!root) return;
    try {
      if (root.matches && root.matches(titleOverflowSelector)) {
        _overflowPendingElements.add(root);
      }
      const list = root.querySelectorAll(titleOverflowSelector);
      for (let i = 0; i < list.length; i++) {
        _overflowPendingElements.add(list[i]);
      }
      if (!_overflowRaf) {
        _overflowRaf = requestAnimationFrame(flushOverflowChecks);
      }
    } catch (_) {}
  }
  window.refreshOverflowFades = refreshOverflowFades;

  function observeTitlesUnder(root) {
    refreshOverflowFades(root);
  }
  window.observeTitlesUnder = observeTitlesUnder;

  window.addEventListener('resize', () => {
    updateRightPanelTitleMarquee();
    refreshOverflowFades(document);
  });

  var ambientIdx = 0;
  var currentAmbientUrl = null;

  function scrollCarouselTo(row, idx) {
    if (!row) return;
    const cards = row.querySelectorAll('.my-wave-track-card');
    if (cards.length === 0) return;
    const clampedIdx = Math.max(0, Math.min(cards.length - 1, idx));
    row._targetIndex = clampedIdx;
    let step = 304;
    if (cards.length > 1) {
      step = cards[1].offsetLeft - cards[0].offsetLeft;
    } else if (cards.length === 1) {
      step = cards[0].offsetWidth + 24;
    }
    const maxScroll = Math.max(0, row.scrollWidth - row.clientWidth);
    const target = Math.max(0, Math.min(maxScroll, clampedIdx * step));
    row.scrollTo({ left: target, behavior: 'smooth' });
  }

  function updateCoverflowCards(row, titleEl, artistEl, ambientEl, tracks) {
    if (!row) row = document.getElementById('home-vibe-grid');
    if (!row) return;
    if (!tracks) {
      tracks = (row.id === 'home-vibe-grid')
        ? (homeMode === 'recent' ? jumpBackCurrentTracks : (homeMode === 'artists' ? favArtistsCurrentList : myWaveCurrentTracks))
        : jumpBackCurrentTracks;
    }
    if (!tracks || tracks.length === 0) return;
    const cards = row.querySelectorAll('.my-wave-track-card');
    if (cards.length === 0) return;

    if (!titleEl) titleEl = document.getElementById(row.id === 'home-vibe-grid' ? 'my-wave-focused-title' : 'jump-focused-title');
    if (!artistEl) artistEl = document.getElementById(row.id === 'home-vibe-grid' ? 'my-wave-focused-artist' : 'jump-focused-artist');
    if (!ambientEl) ambientEl = document.getElementById(row.id === 'home-vibe-grid' ? 'my-wave-ambient-light' : 'jump-ambient-light');

    let step = 304;
    if (cards.length > 1) {
      step = cards[1].offsetLeft - cards[0].offsetLeft;
    } else if (cards.length === 1) {
      step = cards[0].offsetWidth + 24;
    }
    if (!step || step <= 0) step = 304;

    const floatIndex = row.scrollLeft / step;
    const newFocused = Math.max(0, Math.min(cards.length - 1, Math.round(floatIndex)));
    if (typeof row._targetIndex === 'number' && Math.abs(row.scrollLeft - (row._targetIndex * step)) < 12) {
      row._targetIndex = undefined;
    }

    cards.forEach((card, j) => {
      const dist = Math.abs(j - newFocused);
      card.classList.remove('near', 'far');
      if (dist === 0) {
        card.style.zIndex = '10';
      } else if (dist === 1) {
        card.classList.add('near');
        card.style.zIndex = '5';
      } else {
        card.classList.add('far');
        card.style.zIndex = '1';
      }
    });

    const prevFocused = (typeof row._focusedIndex === 'number') ? row._focusedIndex : -1;
    if (newFocused !== prevFocused && tracks[newFocused]) {
      row._focusedIndex = newFocused;
      if (row.id === 'home-vibe-grid') {
        currentWaveFocusedIndex = newFocused;
      }
      const item = tracks[newFocused];
      if (titleEl && artistEl) {
        if (homeMode === 'artists') {
          titleEl.textContent = item.name || 'Unknown';
          const pText = item.plays > 0
            ? `${formatCount(item.plays)} play${item.plays === 1 ? '' : 's'}`
            : (item.fans > 0 ? `${formatCount(item.fans)} listeners` : '0 plays');
          artistEl.textContent = pText;
        } else {
          titleEl.textContent = item.title || 'Untitled';
          artistEl.textContent = item.artist || 'Unknown';
        }
        updateTextFade(titleEl);
        updateTextFade(artistEl);
      }
      if (homeMode === 'artists') {
        updateAmbientLight(ambientEl, '');
      } else {
        const thumb = (typeof getTrackThumbUrl === 'function' ? getTrackThumbUrl(item) : '') || item.thumbnail || item.cover || item.image || '';
        updateAmbientLight(ambientEl, thumb);
      }
    }
  }

  function getJumpBackTracks() {
    const raw = Array.isArray(state.history) ? state.history : [];
    const seen = new Set();
    const tracks = [];
    for (const t of raw) {
      if (!t || typeof t !== 'object') continue;
      const canId = (typeof getTrackCanonicalId === 'function' ? getTrackCanonicalId(t) : '') || t.id || `${t.artist || ''}::${t.title || ''}`;
      if (seen.has(canId)) continue;
      seen.add(canId);
      const thumb = (typeof getTrackThumbUrl === 'function' ? getTrackThumbUrl(t) : '') || t.thumbnail || t.cover || t.image || t.localThumbnail || '';
      tracks.push({
        ...t,
        thumbnail: thumb,
        title: t.title || 'Untitled',
        artist: t.artist || t.uploader || 'Unknown artist'
      });
      if (tracks.length >= 15) break;
    }
    return tracks;
  }

  function buildHomeCard(track, mode, idx) {
    const card = document.createElement('div');
    card.className = 'my-wave-track-card';
    if (typeof idx === 'number') card.dataset.index = String(idx);
    const candidates = (typeof coverCandidates === 'function'
      ? coverCandidates(track)
      : [(typeof getTrackThumbUrl === 'function' ? getTrackThumbUrl(track) : '') || track.thumbnail || track.cover || track.image || '']
    ).filter(Boolean);

    card.innerHTML = `
      <div class="my-wave-track-cover-wrap">
        <img class="my-wave-track-cover" alt="">
        <div class="my-wave-track-play-overlay">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
        </div>
      </div>
    `;

    const img = card.querySelector('img.my-wave-track-cover');
    if (img) {
      if (candidates.length === 0) {
        setTimeout(() => {
          const cardEl = img.closest('.my-wave-track-card') || card;
          if (cardEl && cardEl.parentNode) cardEl.remove();
        }, 0);
      } else {
        let attempt = 0;
        img.addEventListener('error', () => {
          attempt++;
          if (attempt < candidates.length) {
            img.src = candidates[attempt];
          } else {
            const cardEl = img.closest('.my-wave-track-card') || card;
            if (cardEl && cardEl.parentNode) {
              cardEl.remove();
            }
          }
        });
        img.src = candidates[0];
      }
    }

    card.addEventListener('click', () => {
      const row = document.getElementById('home-vibe-grid');
      const curIdx = (typeof idx === 'number') ? idx : parseInt(card.dataset.index, 10);
      const focusedIndex = (row && typeof row._focusedIndex === 'number') ? row._focusedIndex : 0;
      if (curIdx === focusedIndex) {
        if (mode === 'wave') {
          state.isRadioQueue = true;
          state.myWaveActive = true;
          const waveQueue = [...myWaveCurrentTracks];
          playTrack(track, waveQueue, curIdx);
        } else {
          state.isRadioQueue = false;
          state.myWaveActive = false;
          const recentTracks = jumpBackCurrentTracks.length > 0 ? jumpBackCurrentTracks : getJumpBackTracks();
          playTrack(track, [...recentTracks], curIdx);
        }
      } else if (row) {
        scrollCarouselTo(row, curIdx);
      }
    });

    return card;
  }

  function getWaveSpinnerHtml() {
    return `
      <div class="m3-spinner-container" style="margin: auto;">
        <span class="riff-dots-loader lg" aria-hidden="true"><i></i><i></i><i></i></span>
      </div>
    `;
  }

  function renderHomeCarousel(mode) {
    if (!mode) mode = homeMode || 'wave';
    homeMode = mode;

    const headerLabel = document.querySelector('#section-my-wave .home-pane-label');
    if (headerLabel) {
      const waveLabel = (state.isHotPicks && state.hotPicksTitle) ? state.hotPicksTitle : 'For you';
      headerLabel.textContent = (mode === 'recent') ? 'Jump back in' : (mode === 'artists' ? 'Favorite artists' : waveLabel);
      headerLabel.style.cursor = availableModes().length > 1 ? 'pointer' : 'default';
      headerLabel.style.pointerEvents = 'auto';
      if (!headerLabel._hasToggleListener) {
        headerLabel._hasToggleListener = true;
        headerLabel.addEventListener('click', () => {
          const avail = availableModes();
          if (avail.length > 1) {
            const curIdx = avail.indexOf(homeMode);
            const nextIdx = (curIdx + 1) % avail.length;
            if (nextIdx !== -1) {
              switchHomeMode(nextIdx - curIdx);
            }
          }
        });
      }
    }
    const actions = document.querySelector('#section-my-wave .my-wave-actions');
    if (actions) {
      actions.style.display = (mode === 'wave') ? '' : 'none';
    }

    const vibeGrid = document.getElementById('home-vibe-grid');
    const focusedMeta = document.getElementById('my-wave-focused-meta');
    if (!vibeGrid) return;

    if (mode === 'recent') {
      jumpBackCurrentTracks = getJumpBackTracks();
    } else if (mode === 'artists') {
      favArtistsCurrentList = getFavoriteArtistsList();
    }
    const rawSource = (mode === 'recent') ? jumpBackCurrentTracks : (mode === 'artists' ? favArtistsCurrentList : myWaveCurrentTracks);
    const source = (mode === 'artists')
      ? rawSource
      : (Array.isArray(rawSource) ? rawSource.filter(t => !isTrackBlocked(t) && !isArtistBlocked(t.artist) && !isTrackFailedOrUnavailable(t) && Boolean(getTrackThumbUrl(t))) : []);
    if (mode === 'wave') myWaveCurrentTracks = source;
    else if (mode === 'recent') jumpBackCurrentTracks = source;

    vibeGrid.innerHTML = '';

    if (!source || source.length === 0) {
      if (focusedMeta) focusedMeta.innerHTML = '';
      if (mode === 'recent') {
        vibeGrid.innerHTML = `<div class="vibe-empty-hint">Play some tracks to see them here</div>`;
      } else if (mode === 'artists') {
        vibeGrid.innerHTML = `<div class="vibe-empty-hint">Follow some artists to see them here</div>`;
      } else {
        const cachedVibe = (window.HomeCache && window.HomeCache.get('home_vibe')) || safeJson('riff_my_wave_cache', null)?.tracks;
        if (!cachedVibe || cachedVibe.length === 0) {
          vibeGrid.innerHTML = getWaveSpinnerHtml();
        }
      }
      updateAmbientLight('my-wave-ambient-light', '');
      return;
    }

    const fragment = document.createDocumentFragment();
    if (mode === 'artists') {
      source.forEach((artistObj, idx) => {
        fragment.appendChild(buildFavArtistCircleCard(artistObj, true, idx));
      });
    } else {
      source.forEach((track, idx) => {
        fragment.appendChild(buildHomeCard(track, mode, idx));
      });
    }
    vibeGrid.appendChild(fragment);

    const firstThumb = (mode === 'artists') ? '' : ((typeof getTrackThumbUrl === 'function' ? getTrackThumbUrl(source[0]) : '') || source[0].thumbnail || source[0].cover || source[0].image || '');

    if (focusedMeta && source[0]) {
      if (mode === 'artists') {
        const item = source[0];
        const pText = item.plays > 0
          ? `${formatCount(item.plays)} play${item.plays === 1 ? '' : 's'}`
          : (item.fans > 0 ? `${formatCount(item.fans)} listeners` : '0 plays');
        focusedMeta.innerHTML = `
          <div class="my-wave-focused-title" id="my-wave-focused-title">${escapeHtml(item.name || 'Unknown')}</div>
          <div class="my-wave-focused-artist" id="my-wave-focused-artist">${escapeHtml(pText)}</div>
        `;
        const titleEl = document.getElementById('my-wave-focused-title');
        const artistEl = document.getElementById('my-wave-focused-artist');
        if (titleEl) updateTextFade(titleEl);
        if (artistEl) updateTextFade(artistEl);
        updateAmbientLight('my-wave-ambient-light', '');
      } else {
        focusedMeta.innerHTML = `
          <div class="my-wave-focused-title" id="my-wave-focused-title">${escapeHtml(source[0].title || 'Untitled')}</div>
          <div class="my-wave-focused-artist" id="my-wave-focused-artist">${escapeHtml(source[0].artist || 'Unknown')}</div>
        `;
        const titleEl = document.getElementById('my-wave-focused-title');
        const artistEl = document.getElementById('my-wave-focused-artist');
        if (titleEl) updateTextFade(titleEl);
        if (artistEl) updateTextFade(artistEl);
        updateAmbientLight('my-wave-ambient-light', firstThumb);
      }
    }

    vibeGrid.scrollLeft = 0;
    vibeGrid._focusedIndex = -1;
    updateCoverflowCards(vibeGrid, document.getElementById('my-wave-focused-title'), document.getElementById('my-wave-focused-artist'), document.getElementById('my-wave-ambient-light'), source);
    refreshOverflowFades();
  }


  function availableModes() {
    const modes = [];
    if (getAdv('my_wave', true)) modes.push('wave');
    if (getAdv('jump_back', true)) modes.push('recent');
    if (getAdv('fav_artists', true)) modes.push('artists');
    return modes;
  }

  function updateHomeDots() {
    const dotsContainer = document.getElementById('home-hero-dots');
    if (!dotsContainer) return;
    const avail = availableModes();
    if (avail.length <= 1) {
      dotsContainer.style.display = 'none';
      dotsContainer.innerHTML = '';
      return;
    }
    dotsContainer.style.display = '';
    dotsContainer.innerHTML = '';
    avail.forEach(m => {
      const btn = document.createElement('button');
      const label = m === 'recent' ? 'Jump back in' : (m === 'artists' ? 'Favorite artists' : 'For you');
      btn.setAttribute('aria-label', label);
      btn.title = label;
      if (m === homeMode) btn.classList.add('active');
      btn.addEventListener('click', () => {
        if (m !== homeMode) {
          const curIdx = avail.indexOf(homeMode);
          const targetIdx = avail.indexOf(m);
          switchHomeMode(targetIdx - curIdx);
        }
      });
      dotsContainer.appendChild(btn);
    });
  }

  function switchHomeMode(dir) {
    const avail = availableModes();
    if (avail.length <= 1) return;
    const curIdx = avail.indexOf(homeMode);
    if (curIdx === -1) return;
    const targetIdx = curIdx + dir;
    if (targetIdx < 0 || targetIdx >= avail.length) return;
    const newMode = avail[targetIdx];
    if (newMode === homeMode) return;

    homeMode = newMode;
    localStorage.setItem('riff_home_pane', newMode);
    updateHomeDots();

    const isPerf = document.body.classList.contains('perf') || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isPerf) {
      renderHomeCarousel(newMode);
      return;
    }

    const vibeGrid = document.getElementById('home-vibe-grid');
    const focusedMeta = document.getElementById('my-wave-focused-meta');
    const animTargets = [vibeGrid, focusedMeta].filter(Boolean);

    const shiftOut = dir > 0 ? '-16px' : '16px';
    const shiftIn = dir > 0 ? '16px' : '-16px';

    animTargets.forEach(el => {
      el.style.setProperty('--home-shift', shiftOut);
      el.classList.remove('home-in');
      el.classList.add('home-out');
    });

    setTimeout(() => {
      renderHomeCarousel(newMode);
      const newVibeGrid = document.getElementById('home-vibe-grid');
      const newFocusedMeta = document.getElementById('my-wave-focused-meta');
      const newTargets = [newVibeGrid, newFocusedMeta].filter(Boolean);
      newTargets.forEach(el => {
        el.style.setProperty('--home-in-shift', shiftIn);
        el.classList.remove('home-out');
        el.classList.add('home-in');
        setTimeout(() => {
          el.classList.remove('home-in');
        }, 260);
      });
    }, 180);
  }

  function initHomeHero() {
    const avail = availableModes();
    const hero = document.getElementById('home-hero') || document.querySelector('#view-discover .discover-content');
    const dots = document.getElementById('home-hero-dots');

    if (avail.length === 0) {
      if (hero) hero.style.display = 'none';
      if (dots) dots.style.display = 'none';
      const homeAmbient = document.getElementById('home-ambient');
      if (homeAmbient) homeAmbient.style.display = 'none';
      return;
    }

    if (hero) hero.style.display = '';

    if (!avail.includes(homeMode)) {
      homeMode = avail[0];
      localStorage.setItem('riff_home_pane', homeMode);
    }

    updateHomeDots();
    renderHomeCarousel(homeMode);
    syncHomeAmbientVisibility();
  }

  function stepCarouselFocus(delta) {
    const row = document.getElementById('home-vibe-grid');
    if (!row) return;
    const cards = row.querySelectorAll('.my-wave-track-card');
    if (cards.length === 0) return;
    const base = (typeof row._targetIndex === 'number')
      ? row._targetIndex
      : ((typeof row._focusedIndex === 'number') ? row._focusedIndex : 0);
    const next = Math.max(0, Math.min(cards.length - 1, base + delta));
    scrollCarouselTo(row, next);
  }

  function isDiscoverActive() {
    const view = document.getElementById('view-discover');
    return !!(view && view.classList.contains('active'));
  }

  function isFormInputFocused() {
    const activeEl = document.activeElement;
    if (!activeEl) return false;
    const tag = activeEl.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || activeEl.isContentEditable;
  }

  var isWheelModeLocked = false;
  var isCarouselWheelLocked = false;

  var viewDiscoverEl = document.getElementById('view-discover');
  if (viewDiscoverEl) {
    viewDiscoverEl.addEventListener('wheel', (e) => {
      if (document.body.classList.contains('home-spotify')) return;
      if (!isDiscoverActive() || isFormInputFocused()) return;
      if (el.searchResultsContainer && !el.searchResultsContainer.classList.contains('hidden')) return;
      if (e.target.closest('#search-results-container')) return;
      const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (Math.abs(delta) < 8) return;
      if (isCarouselWheelLocked) return;
      e.preventDefault();
      isCarouselWheelLocked = true;
      setTimeout(() => { isCarouselWheelLocked = false; }, 85);
      stepCarouselFocus(delta > 0 ? 1 : -1);
    }, { passive: false });

    let touchStartY = 0;
    let touchStartX = 0;
    viewDiscoverEl.addEventListener('touchstart', (e) => {
      if (!isDiscoverActive()) return;
      if (el.searchResultsContainer && !el.searchResultsContainer.classList.contains('hidden')) return;
      if (e.touches.length > 0) {
        touchStartY = e.touches[0].clientY;
        touchStartX = e.touches[0].clientX;
      }
    }, { passive: true });

    viewDiscoverEl.addEventListener('touchend', (e) => {
      if (!isDiscoverActive()) return;
      if (el.searchResultsContainer && !el.searchResultsContainer.classList.contains('hidden')) return;
      if (e.changedTouches.length > 0) {
        const touchEndY = e.changedTouches[0].clientY;
        const touchEndX = e.changedTouches[0].clientX;
        const diffY = touchStartY - touchEndY;
        const diffX = touchStartX - touchEndX;
        const diff = Math.abs(diffX) >= Math.abs(diffY) ? diffX : diffY;
        if (Math.abs(diff) > 40) {
          stepCarouselFocus(diff > 0 ? 1 : -1);
        }
      }
    }, { passive: true });
  }

  window.addEventListener('keydown', (e) => {
    if (!isDiscoverActive() || isFormInputFocused()) return;
    if (el.searchResultsContainer && !el.searchResultsContainer.classList.contains('hidden')) return;

    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      stepCarouselFocus(-1);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      stepCarouselFocus(1);
    }
  });


  function renderVibeCards(tracks) {
    if (!Array.isArray(tracks)) return;
    state.vibeTracks = tracks;
    myWaveCurrentTracks = tracks;
    currentWaveFocusedIndex = 0;
    if (typeof renderHomeCarousel === 'function') renderHomeCarousel('wave');
  }

  async function fetchPersonalVibe(forceRefresh = false) {
    const cachedVibe = !forceRefresh && ((window.HomeCache && window.HomeCache.get('home_vibe')) || safeJson('riff_my_wave_cache', null)?.tracks);
    if (cachedVibe && Array.isArray(cachedVibe) && cachedVibe.length > 0) {
      state.vibeTracks = cachedVibe.filter(t => !isTrackBlocked(t) && !isArtistBlocked(t.artist) && !isTrackFailedOrUnavailable(t) && Boolean(getTrackThumbUrl(t)));
      myWaveCurrentTracks = state.vibeTracks;
      renderVibeCards(state.vibeTracks);
      if (typeof renderSpotifyHome === 'function') renderSpotifyHome();
      const item = window.HomeCache && window.HomeCache.store && window.HomeCache.store['home_vibe'];
      const ts = (item && item.ts) ? item.ts : (safeJson('riff_my_wave_cache', null)?.ts || 0);
      if (Date.now() - ts < 4 * 3600 * 1000) return true;
    }
    return await loadHomePage(forceRefresh);
  }

  async function loadHomePage(isRefresh = false) {
    const jumpSection = document.getElementById('section-jump-back');
    if (jumpSection) {
      jumpSection.style.display = 'none';
    }

    const waveSection = document.getElementById('section-my-wave');
    if (waveSection) {
      waveSection.style.display = '';
    }

    if (!isRefresh) {
      jumpBackCurrentTracks = getJumpBackTracks();
      initHomeHero();
    }
    if (availableModes().length === 0) return false;

    if (!getAdv('my_wave', true)) {
      if (homeMode === 'recent') {
        renderHomeCarousel('recent');
      } else if (homeMode === 'artists') {
        renderHomeCarousel('artists');
      }
      return false;
    }

    const vibeGrid = document.getElementById('home-vibe-grid');
    const focusedMeta = document.getElementById('my-wave-focused-meta');
    const cachedVibe = (window.HomeCache && window.HomeCache.get('home_vibe')) || safeJson('riff_my_wave_cache', null)?.tracks;

    if (!isRefresh && focusedMeta && homeMode === 'wave' && myWaveCurrentTracks.length === 0 && (!cachedVibe || cachedVibe.length === 0)) {
      focusedMeta.innerHTML = `
        <div class="my-wave-skeleton-title-bar skeleton-shimmer"></div>
        <div class="my-wave-skeleton-artist-bar skeleton-shimmer"></div>
      `;
    }

    if (!isRefresh && vibeGrid && homeMode === 'wave' && myWaveCurrentTracks.length === 0 && (!cachedVibe || cachedVibe.length === 0)) {
      vibeGrid.style.opacity = '1';
      vibeGrid.innerHTML = getWaveSpinnerHtml();
    }

    try {
      const profile = await computeTasteProfile();
      const vibePayload = {
        history: (state.history || []).slice(0, 30),
        favorites: (state.favorites || []).slice(0, 25),
        platform: 'youtube',
        limit: 10,
        clientProfile: profile,
        seeds: profile.seeds,
        avoid: getWaveAvoid()
      };
      if (isRefresh) {
        vibePayload.refresh = true;
      }
      let uniqueTracks = [];
      try {
        const res = await fetch(`http://127.0.0.1:${state.serverPort}/api/vibe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(vibePayload)
        });

        const data = await res.json();
        if (data && data.success && Array.isArray(data.tracks) && data.tracks.length > 0) {
          const seenIds = new Set();
          const seenKeys = new Set();
          for (const t of data.tracks) {
            if (isTrackBlocked(t) || isArtistBlocked(t.artist) || isTrackFailedOrUnavailable(t) || !getTrackThumbUrl(t)) continue;
            const cid = getTrackCanonicalId(t);
            const nkey = getTrackNormalizedKey(t.artist, t.title);
            if (!seenIds.has(cid) && !seenKeys.has(nkey)) {
              seenIds.add(cid);
              seenKeys.add(nkey);
              uniqueTracks.push(t);
            }
          }
          if (uniqueTracks.length > 0) {
            state.vibeTracks = uniqueTracks;
            try { localStorage.setItem('riff_my_wave_cache', JSON.stringify({ ts: Date.now(), tracks: state.vibeTracks })); } catch (_) {}
            if (window.HomeCache) {
              window.HomeCache.set('home_vibe', uniqueTracks);
            }
          }
        }
      } catch (_) {}

      state.isHotPicks = false;
      state.hotPicksTitle = '';

      if (uniqueTracks.length < 5) {
        try {
          const hotRes = await fetch(`http://127.0.0.1:${state.serverPort}/api/hot?limit=12`);
          const hotData = await hotRes.json();
          if (hotData && hotData.success && Array.isArray(hotData.tracks) && hotData.tracks.length > 0) {
            uniqueTracks = hotData.tracks.filter(t => !isTrackBlocked(t) && !isArtistBlocked(t.artist) && !isTrackFailedOrUnavailable(t) && Boolean(getTrackThumbUrl(t)));
            state.isHotPicks = true;
            state.hotPicksTitle = hotData.title || `Hot picks ${new Date().getFullYear()}`;
          }
        } catch (_) {}
      }

      if (uniqueTracks.length === 0) {
        if (!isRefresh) {
          myWaveCurrentTracks = [];
          if (homeMode === 'wave') {
            if (focusedMeta) focusedMeta.innerHTML = '';
            if (vibeGrid) {
              vibeGrid.innerHTML = `
                <div class="my-wave-retry-container" style="display: flex; align-items: center; justify-content: center; gap: 8px; margin: auto; padding: 24px; color: var(--md-sys-color-on-surface-variant); font-size: 14px;">
                  <span>Couldn't load recommendations</span>
                  <button class="btn-icon-pill" id="btn-retry-vibe" title="Retry" aria-label="Retry" style="width: 32px; height: 32px;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                  </button>
                </div>
              `;
              const retryBtn = vibeGrid.querySelector('#btn-retry-vibe');
              if (retryBtn) {
                retryBtn.addEventListener('click', () => {
                  if (el.btnRefreshVibe) el.btnRefreshVibe.click();
                  else loadHomePage(true);
                });
              }
            }
            updateAmbientLight('my-wave-ambient-light', '');
          }
        }
        return false;
      }

      if (!state.isHotPicks) uniqueTracks = blendFavoritesIntoWave(uniqueTracks);
      uniqueTracks = uniqueTracks.filter(t => !isTrackBlocked(t) && !isArtistBlocked(t.artist) && !isTrackFailedOrUnavailable(t) && Boolean(getTrackThumbUrl(t)));
      myWaveCurrentTracks = uniqueTracks;
      state.vibeTracks = uniqueTracks;
      try { localStorage.setItem('riff_my_wave_cache', JSON.stringify({ ts: Date.now(), tracks: state.vibeTracks })); } catch (_) {}
      if (window.HomeCache) {
        window.HomeCache.set('home_vibe', uniqueTracks);
      }
      currentWaveFocusedIndex = 0;
      if (homeMode === 'wave') {
        if (vibeGrid) {
          vibeGrid.style.transition = 'none';
          vibeGrid.style.opacity = '0';
        }
        renderHomeCarousel('wave');
        currentWaveFocusedIndex = 0;
        if (vibeGrid) {
          vibeGrid.scrollLeft = 0;
          vibeGrid._focusedIndex = 0;
          const firstCard = vibeGrid.querySelector('.my-wave-track-card');
          if (firstCard && document.activeElement && document.activeElement.closest('#home-vibe-grid')) {
            firstCard.focus();
          }
          vibeGrid.offsetHeight;
          vibeGrid.style.transition = 'opacity 250ms ease';
          vibeGrid.style.opacity = '1';
        }
      }
      return true;
    } catch (err) {
      if (!isRefresh) {
        myWaveCurrentTracks = [];
        if (homeMode === 'wave') {
          if (focusedMeta) focusedMeta.innerHTML = '';
          if (vibeGrid) {
            vibeGrid.innerHTML = `
              <div class="my-wave-retry-container" style="display: flex; align-items: center; justify-content: center; gap: 8px; margin: auto; padding: 24px; color: var(--md-sys-color-on-surface-variant); font-size: 14px;">
                <span>Couldn't load recommendations</span>
                <button class="btn-icon-pill" id="btn-retry-vibe" title="Retry" aria-label="Retry" style="width: 32px; height: 32px;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                </button>
              </div>
            `;
            const retryBtn = vibeGrid.querySelector('#btn-retry-vibe');
            if (retryBtn) {
              retryBtn.addEventListener('click', () => {
                if (el.btnRefreshVibe) el.btnRefreshVibe.click();
                else loadHomePage(true);
              });
            }
          }
          updateAmbientLight('my-wave-ambient-light', '');
        }
      }
      return false;
    }
  }

  var vibeGridEl = document.getElementById('home-vibe-grid');
  if (vibeGridEl) {
    vibeGridEl.addEventListener('scroll', () => {
      const curTracks = (homeMode === 'recent') ? jumpBackCurrentTracks : myWaveCurrentTracks;
      updateCoverflowCards(vibeGridEl, document.getElementById('my-wave-focused-title'), document.getElementById('my-wave-focused-artist'), document.getElementById('my-wave-ambient-light'), curTracks);
    }, { passive: true });
  }

  var quickRowEl = document.getElementById('home-quick-play-row');
  if (quickRowEl) {
    quickRowEl.addEventListener('scroll', () => {
      updateCoverflowCards(quickRowEl, document.getElementById('jump-focused-title'), document.getElementById('jump-focused-artist'), document.getElementById('jump-ambient-light'), jumpBackCurrentTracks);
    }, { passive: true });
  }

  function applyCoverTintToCard() {}


  function renderQuickAccess() {
    const sec = document.getElementById('sp-quick-sec');
    const container = document.getElementById('sp-quick');
    if (!sec || !container) return;
    if (!getAdv('jump_back', true)) {
      sec.hidden = true;
      return;
    }
    sec.hidden = false;

    const favCount = (state.favorites || []).length;
    const rawHist = Array.isArray(state.history) ? state.history : [];
    const seenTracks = new Set();
    const recentTracks = [];
    for (const t of rawHist) {
      if (!t) continue;
      const canId = (typeof getTrackCanonicalId === 'function' ? getTrackCanonicalId(t) : '') || t.id || `${t.artist || ''}::${t.title || ''}`;
      if (!canId || seenTracks.has(canId)) continue;
      seenTracks.add(canId);
      recentTracks.push(t);
      if (recentTracks.length >= 5) break;
    }

    const sig = favCount + '|' + recentTracks.map(t => t.id || t.title).join(',');
    if (container._lastHomeSig === sig && container.children.length > 0) return;
    container._lastHomeSig = sig;
    container.innerHTML = '';

    const likedTile = document.createElement('div');
    likedTile.className = 'sp-tile';
    likedTile.innerHTML = `
      <div class="sp-heart">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
        </svg>
      </div>
      <div class="sp-tile-text">
        <div class="sp-tile-title sp-fade">${escapeHtml(t('Liked songs'))}</div>
        ${favCount > 0 ? `<div class="sp-tile-sub sp-fade">${favCount} songs</div>` : ''}
      </div>
    `;
    likedTile.addEventListener('click', () => {
      switchView('favorites');
    });
    container.appendChild(likedTile);

    recentTracks.forEach(track => {
      const tile = document.createElement('div');
      tile.className = 'sp-tile';
      const thumb = (typeof getTrackThumbUrl === 'function' ? getTrackThumbUrl(track) : '') || track.thumbnail || track.cover || '';
      applyCoverTintToCard(tile, thumb);
      const tileCover = document.createElement('div');
      tileCover.className = 'sp-tile-cover';
      appendCoverImage(tileCover, thumb);
      tile.appendChild(tileCover);
      const text = document.createElement('div');
      text.className = 'sp-tile-text';
      const title = document.createElement('div');
      title.className = 'sp-tile-title sp-fade';
      title.textContent = track.title || 'Untitled';
      const sub = document.createElement('div');
      sub.className = 'sp-tile-sub sp-fade';
      sub.textContent = track.artist || track.uploader || 'Unknown artist';
      text.appendChild(title);
      text.appendChild(sub);
      tile.appendChild(text);
      tile.addEventListener('click', () => {
        playTrack(track);
      });
      container.appendChild(tile);
    });

    if (recentTracks.length < 5 && Array.isArray(state.playlists)) {
      const needed = 5 - recentTracks.length;
      const playlists = state.playlists.slice(0, needed);
      playlists.forEach(pl => {
        const tile = document.createElement('div');
        tile.className = 'sp-tile';
        const plThumb = pl.cover || (pl.tracks && pl.tracks[0] ? getTrackThumbUrl(pl.tracks[0]) : '');
        applyCoverTintToCard(tile, plThumb);
        const coverDiv = document.createElement('div');
        coverDiv.className = 'playlist-cover-art';
        renderPlaylistCover(coverDiv, pl, 64);
        const text = document.createElement('div');
        text.className = 'sp-tile-text';
        const title = document.createElement('div');
        title.className = 'sp-tile-title sp-fade';
        title.textContent = pl.name || 'Untitled';
        const sub = document.createElement('div');
        sub.className = 'sp-tile-sub sp-fade';
        const trackCount = (pl.tracks || []).length;
        sub.textContent = `${trackCount} tracks`;
        text.appendChild(title);
        text.appendChild(sub);
        tile.appendChild(coverDiv);
        tile.appendChild(text);
        tile.addEventListener('click', () => {
          openPlaylistDetail(pl.id);
        });
        container.appendChild(tile);
      });
    }
    refreshOverflowFades(container);
  }

  function getMix4Covers(mix) {
    if (!mix || !Array.isArray(mix.tracks)) return [];
    const covers = [];
    const seen = new Set();
    for (const t of mix.tracks) {
      if (!t) continue;
      const c = (typeof getTrackThumbUrl === 'function' ? getTrackThumbUrl(t) : '') || t.thumbnail || t.cover || '';
      if (c && !seen.has(c)) {
        seen.add(c);
        covers.push(c);
        if (covers.length === 4) break;
      }
    }
    if (covers.length < 4) {
      for (const t of mix.tracks) {
        if (!t) continue;
        const c = (typeof getTrackThumbUrl === 'function' ? getTrackThumbUrl(t) : '') || t.thumbnail || t.cover || '';
        if (c) {
          covers.push(c);
          if (covers.length === 4) break;
        }
      }
    }
    return covers;
  }

  

  

  function showCoverPlaceholder(wrap) {
    wrap.classList.add('sp-card-cover-empty');
    wrap.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>';
  }

  function normalizeCoverUrl(u) {
    if (!u || typeof u !== 'string') return '';
    u = u.trim();
    if (u.startsWith('//')) return 'https:' + u;
    if (/^http:\/\/(?!127\.0\.0\.1|localhost)/i.test(u)) return 'https://' + u.slice(7);
    return u;
  }

  function coverCandidates(track) {
    if (!track) return [];
    const out = [];
    const add = (u) => {
      u = normalizeCoverUrl(u);
      if (u && !out.includes(u)) out.push(u);
    };
    try { add(getTrackThumbUrl(track)); } catch (_) {}
    add(track.thumbnail);
    add(track.cover);
    add(track.image);
    add(track.artworkUrl);
    const id = String(track.id || '');
    if (/^[A-Za-z0-9_-]{11}$/.test(id) && !/^(cand_|dz_|it_|sp_|ym_)/i.test(id)) {
      add('https://i.ytimg.com/vi/' + id + '/hqdefault.jpg');
      add('https://i.ytimg.com/vi/' + id + '/mqdefault.jpg');
    }
    return out;
  }

  function coverCandidatesFromTracks(tracks, max = 8) {
    const out = [];
    (Array.isArray(tracks) ? tracks.slice(0, max) : []).forEach(t => {
      coverCandidates(t).forEach(u => { if (!out.includes(u)) out.push(u); });
    });
    return out;
  }

  function appendCoverImage(wrap, cover) {
    const list = (Array.isArray(cover) ? cover : [cover]).filter(Boolean);
    if (list.length === 0) {
      const card = wrap?.closest?.('.my-wave-track-card');
      if (card) {
        card.remove();
        return null;
      }
      showCoverPlaceholder(wrap);
      return null;
    }
    const img = document.createElement('img');
    img.alt = '';
    let attempt = 0;
    img.addEventListener('error', () => {
      attempt++;
      if (attempt < list.length) {
        img.src = list[attempt];
      } else {
        const card = img.closest?.('.my-wave-track-card') || wrap?.closest?.('.my-wave-track-card');
        if (card) {
          card.remove();
        } else {
          showCoverPlaceholder(wrap);
        }
      }
    });
    img.src = list[0];
    wrap.appendChild(img);
    return img;
  }

  function spCard({ cover, gridCovers, title, sub, onClick, isExplicit = false }) {
    const card = document.createElement('div');
    card.className = 'sp-card';
    applyCoverTintToCard(card, (gridCovers && gridCovers[0]) || cover);

    const coverWrap = document.createElement('div');
    coverWrap.className = 'sp-card-cover';
    if (gridCovers && Array.isArray(gridCovers) && gridCovers.length >= 4) {
      const grid = document.createElement('div');
      grid.className = 'sp-grid-cover';
      gridCovers.slice(0, 4).forEach(c => {
        const gImg = document.createElement('img');
        gImg.alt = '';
        gImg.addEventListener('error', () => { gImg.style.visibility = 'hidden'; });
        gImg.src = c || '';
        grid.appendChild(gImg);
      });
      coverWrap.appendChild(grid);
    } else {
      appendCoverImage(coverWrap, cover);
    }

    const titleEl = document.createElement('div');
    titleEl.className = 'sp-card-title sp-fade';
    titleEl.textContent = title || '';

    const subEl = document.createElement('div');
    subEl.className = 'sp-card-sub sp-fade';
    if (isExplicit) {
      const badge = document.createElement('span');
      badge.className = 'explicit-badge';
      badge.title = 'Explicit';
      badge.textContent = 'E';
      subEl.appendChild(badge);
    }
    const subText = document.createTextNode(sub || '');
    subEl.appendChild(subText);

    card.appendChild(coverWrap);
    card.appendChild(titleEl);
    card.appendChild(subEl);

    if (typeof onClick === 'function') {
      card.addEventListener('click', onClick);
    }
    return card;
  }

  function detectUserMusicRegion() {
    const sample = [...(state.favorites || []), ...(state.history || [])];
    let cyrCount = 0;
    let uaCount = 0;
    for (const t of sample) {
      if (!t) continue;
      const str = `${t.title || ''} ${t.artist || ''}`;
      if (/[а-яёіїєґ]/i.test(str)) cyrCount++;
      if (/[іїєґ]/i.test(str)) uaCount++;
    }
    const uiLang = (localStorage.getItem('riff_ui_lang') || '').toLowerCase();
    if (uiLang === 'uk' || (sample.length > 0 && uaCount / sample.length >= 0.15)) return 'ua';
    if (uiLang === 'ru' || (sample.length > 0 && cyrCount / sample.length >= 0.18) || (navigator.languages || []).some(l => /^ru/i.test(l))) return 'ru';
    if (uiLang === 'kz') return 'kz';
    const hasCyrPlaylist = (state.playlists || []).some(p => p && p.name && /[а-яёіїєґ]/i.test(p.name));
    if (hasCyrPlaylist) return 'ru';
    return 'us';
  }


  async function renderTrending() {
    const sec = document.getElementById('sp-trend-sec');
    const row = document.getElementById('sp-trend');
    if (!sec || !row) return;
    if (!getAdv('my_wave', true)) {
      sec.hidden = true;
      return;
    }

    const region = detectUserMusicRegion();
    const artistCounts = new Map();
    const allTracks = [...(state.favorites || []), ...(state.history || [])];
    for (const t of allTracks) {
      const art = (t && (t.artist || t.uploader || '')).trim();
      if (art && !/^unknown artist$/i.test(art)) {
        artistCounts.set(art, (artistCounts.get(art) || 0) + 1);
      }
    }
    const topArtists = [...artistCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(e => e[0]);

    const cachedTrendRegion = localStorage.getItem('riff_trending_region');
    const regionMatches = cachedTrendRegion === region;

    const cachedTrend = regionMatches ? ((window.HomeCache && window.HomeCache.get('home_trending')) || safeJson('riff_trending_cache', null)?.tracks) : null;
    const rawLocal = regionMatches ? safeJson('riff_trending_cache', null) : null;
    const cacheItem = (regionMatches && window.HomeCache && window.HomeCache.store) ? window.HomeCache.store['home_trending'] : null;
    const cacheTs = (cacheItem && cacheItem.ts) ? cacheItem.ts : (rawLocal?.ts || 0);
    const isFresh = regionMatches && cacheTs > 0 && (Date.now() - cacheTs < 12 * 3600 * 1000);

    if (cachedTrend && cachedTrend.length > 0) {
      renderTrendingCards(row, cachedTrend);
      sec.hidden = false;
      if (isFresh) {
        return;
      }
    } else {
      sec.hidden = false;
      row.innerHTML = `
        <div class="m3-spinner-container" style="margin: 24px auto; grid-column: 1 / -1;">
          <span class="riff-dots-loader lg" aria-hidden="true"><i></i><i></i><i></i></span>
        </div>
      `;
    }

    try {
      const port = state.serverPort || 38472;
      const res = await fetch(`http://127.0.0.1:${port}/api/trending?region=${encodeURIComponent(region)}&artists=${encodeURIComponent(topArtists.join(','))}`);
      const data = await res.json();
      if (data && data.success && Array.isArray(data.tracks) && data.tracks.length > 0) {
        localStorage.setItem('riff_trending_region', region);
        if (window.HomeCache) {
          window.HomeCache.set('home_trending', data.tracks);
        }
        try {
          localStorage.setItem('riff_trending_cache', JSON.stringify({ ts: Date.now(), tracks: data.tracks }));
        } catch (_) {}
        renderTrendingCards(row, data.tracks);
        sec.hidden = false;
      } else if (!cachedTrend || cachedTrend.length === 0) {
        sec.hidden = true;
      }
    } catch (_) {
      if (!cachedTrend || cachedTrend.length === 0) {
        sec.hidden = true;
      }
    }
  }

  function renderTrendingCards(row, tracks) {
    if (!row) return;
    const filteredTracks = (tracks || []).filter(t => !isTrackBlocked(t) && !isArtistBlocked(t.artist) && !isTrackFailedOrUnavailable(t) && Boolean(getTrackThumbUrl(t)));
    const sig = filteredTracks.map(t => t.id).join(',');
    if (row._lastHomeSig === sig && row.children.length > 0) return;
    row._lastHomeSig = sig;
    row.innerHTML = '';
    const isSpTrend = row.id === 'sp-trend';
    filteredTracks.forEach((track, idx) => {
      const card = spCard({
        cover: (typeof getTrackThumbUrl === 'function' ? getTrackThumbUrl(track) : '') || track.thumbnail || track.cover || '',
        title: track.title || 'Untitled',
        sub: track.artist || track.uploader || 'Unknown artist',
        isExplicit: isTrackExplicit(track),
        onClick: () => {
          state.isRadioQueue = false;
          playTrack(track, [...filteredTracks], idx);
        }
      });
      if (isSpTrend) {
        const coverWrap = card.querySelector('.sp-card-cover');
        if (coverWrap) {
          const listenersStr = track.listenersText || ((Math.floor((idx * 173 + 240) % 900) + 120) + 'K');
          const badge = document.createElement('div');
          badge.className = 'sp-trend-listeners';
          badge.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" height="13px" width="13px" fill="currentColor"><path d="M7.15,17.65V6.35q0-0.7 0.47-1.14t1.1-0.44q0.2,0 0.43,0.05T9.58,5l8.9,5.67q0.35,0.22 0.54,0.59T19.2,12t-0.19,0.74q-0.19,0.36-0.54,0.59L9.58,19q-0.2,0.13-0.43,0.18T8.73,19.23q-0.63,0-1.1-0.44T7.15,17.65Z"/></svg><span>${escapeHtml(listenersStr)}</span>`;
          coverWrap.appendChild(badge);
        }
      }
      row.appendChild(card);
    });
    bindHorizontalWheel(row);
    requestAnimationFrame(() => updateRowFade(row));
    refreshOverflowFades(row);
  }

  var MIX_KEY = 'riff_daily_mixes';


  function applyHomeLayout() {
    const isRiff = (localStorage.getItem('riff_home_layout') || 'spotify') === 'riff';
    const sp = !isRiff;
    document.body.classList.toggle('home-spotify', sp);
    const btnToggle = document.getElementById('btn-toggle-riff-home');
    if (btnToggle) btnToggle.classList.toggle('active', isRiff);
    const btnSp = document.getElementById('home-layout-spotify');
    const btnRiff = document.getElementById('home-layout-riff');
    if (btnSp) btnSp.classList.toggle('active', sp);
    if (btnRiff) btnRiff.classList.toggle('active', !sp);
    const settingHomeImg = document.getElementById('setting-home-app-icon');
    if (settingHomeImg && typeof resolveAppIconSrc === 'function') {
      settingHomeImg.src = resolveAppIconSrc(localStorage.getItem('riff_app_icon'));
    }
    const descEl = document.querySelector('#setting-home-layout div[style*="margin-top"]');
    if (descEl) descEl.style.display = 'none';
    if (sp) {
      renderSpotifyHome();
    } else {
      const spHome = document.getElementById('sp-home');
      const homeHero = document.getElementById('home-hero');
      if (spHome) spHome.style.display = 'none';
      if (homeHero) {
        homeHero.classList.remove('hidden');
        homeHero.style.display = '';
      }
      initHomeHero();
      if (!myWaveCurrentTracks || myWaveCurrentTracks.length === 0) {
        loadHomePage();
      }
    }
  }

  var btnToggleRiffHome = document.getElementById('btn-toggle-riff-home');
  if (btnToggleRiffHome) {
    btnToggleRiffHome.addEventListener('click', () => {
      const cur = localStorage.getItem('riff_home_layout') || 'spotify';
      const next = cur === 'riff' ? 'spotify' : 'riff';
      localStorage.setItem('riff_home_layout', next);
      applyHomeLayout();
    });
  }
  var btnHomeSpotify = document.getElementById('home-layout-spotify');
  var btnHomeRiff = document.getElementById('home-layout-riff');
  if (btnHomeSpotify) {
    btnHomeSpotify.addEventListener('click', () => {
      localStorage.setItem('riff_home_layout', 'spotify');
      applyHomeLayout();
    });
  }
  if (btnHomeRiff) {
    btnHomeRiff.addEventListener('click', () => {
      localStorage.setItem('riff_home_layout', 'riff');
      applyHomeLayout();
    });
  }

  cacheModal = document.getElementById('cache-modal');
  var cacheModalCard = document.querySelector('.cache-modal-card');
  var btnCancelCache = document.getElementById('btn-cancel-cache');
  var btnConfirmClearCache = document.getElementById('btn-confirm-clear-cache');
  var cacheAudioSize = document.getElementById('cache-audio-size');
  var cacheWebSize = document.getElementById('cache-web-size');

  var CACHE_BAR_MAX_BYTES = 4 * 1024 * 1024 * 1024;
  var CACHE_BAR_SAFE_STOP = 0.25;
  var CACHE_BAR_DANGER_STOP = 0.75;
  var CACHE_BAR_MIN_VISIBLE_PX = 4;

  var cacheBars = {
    audio: { canvas: document.getElementById('cache-audio-bar'), current: 0, from: 0, to: 0, t0: 0, dur: 0 },
    web: { canvas: document.getElementById('cache-web-bar'), current: 0, from: 0, to: 0, t0: 0, dur: 0 }
  };
  cacheRafId = 0;
  var cachePhase = 0;
  var cacheSpeed = 0.06;
  var cacheTargetSpeed = 0.06;
  var cacheBusy = false;
  var cacheColors = { primary: '#6750A4', dim: '#E6E0E9', warn: '#F9A825', error: '#B3261E' };


  async function updateMusicFolderUI() {
    const elPath = document.getElementById('music-folder-path');
    if (!elPath) return;
    try {
      if (window.electronAPI && window.electronAPI.getDataDir) {
        const info = await window.electronAPI.getDataDir();
        if (info && info.dir) {
          elPath.textContent = info.isCustom ? info.dir : `${info.dir} (default)`;
          return;
        }
      }
    } catch (e) {
      console.warn('getDataDir failed', e);
    }
    elPath.textContent = 'Unavailable';
  }

  var btnChangeMusicFolder = document.getElementById('btn-change-music-folder');
  if (btnChangeMusicFolder) {
    btnChangeMusicFolder.addEventListener('click', async () => {
      if (!window.electronAPI || !window.electronAPI.pickDataDir) return;
      if (btnChangeMusicFolder.disabled) return;
      let info = null;
      try { info = await window.electronAPI.getDataDir(); } catch (e) {}
      const dir = await window.electronAPI.pickDataDir();
      if (!dir) return;
      if (info && info.dir && dir === info.dir) {
        showToast('This is already the music folder');
        return;
      }
      const move = window.confirm(
        'Move your existing music to the new folder?\n\n' +
        'OK: move all downloaded and imported files, then restart Riff.\n' +
        'Cancel: switch to the new folder without moving (files stay in the old one).'
      );
      btnChangeMusicFolder.disabled = true;
      const originalLabel = btnChangeMusicFolder.textContent;
      btnChangeMusicFolder.textContent = move ? 'Moving...' : 'Switching...';
      showToast(move ? 'Moving your music, this may take a while...' : 'Switching music folder...');
      let res = null;
      try {
        res = await window.electronAPI.setDataDir(dir, move);
      } catch (e) {
        res = { ok: false, error: e.message };
      }
      if (!res || !res.ok) {
        showToast((res && res.error) || 'Could not change the music folder', 'error');
        btnChangeMusicFolder.disabled = false;
        btnChangeMusicFolder.textContent = originalLabel;
        return;
      }
      btnChangeMusicFolder.textContent = 'Restarting...';
      showToast('Restarting Riff...');
      setTimeout(() => { if (window.electronAPI.restartApp) window.electronAPI.restartApp(); }, 400);
    });
  }

  async function updateDownloadFolderUI() {
    const elPath = document.getElementById('download-folder-path');
    const btnReset = document.getElementById('btn-reset-download-folder');
    if (elPath) {
      try {
        if (window.electronAPI && window.electronAPI.getDownloadDir) {
          const info = await window.electronAPI.getDownloadDir();
          if (info && info.dir) {
            elPath.textContent = info.isCustom ? info.dir : `${info.dir} (default)`;
            if (btnReset) btnReset.classList.toggle('hidden', !info.isCustom);
            return;
          }
        }
      } catch (e) {
        console.warn('getDownloadDir failed', e);
      }
      elPath.textContent = 'Unavailable';
    }
    if (btnReset) btnReset.classList.add('hidden');
  }

  var btnChangeDownloadFolder = document.getElementById('btn-change-download-folder');
  if (btnChangeDownloadFolder) {
    btnChangeDownloadFolder.addEventListener('click', async () => {
      if (!window.electronAPI || !window.electronAPI.pickDownloadDir) return;
      if (btnChangeDownloadFolder.disabled) return;
      let info = null;
      try { info = await window.electronAPI.getDownloadDir(); } catch (e) {}
      const dir = await window.electronAPI.pickDownloadDir();
      if (!dir) return;
      if (info && info.dir && dir === info.dir) {
        showToast('This is already the download folder');
        return;
      }
      btnChangeDownloadFolder.disabled = true;
      let res = null;
      try {
        res = await window.electronAPI.setDownloadDir(dir);
      } catch (e) {
        res = { ok: false, error: e.message };
      }
      btnChangeDownloadFolder.disabled = false;
      if (!res || !res.ok) {
        showToast((res && res.error) || 'Could not change the download folder', 'error');
        return;
      }
      updateDownloadFolderUI();
      updateDownloadCaptionPath();
      showToast('Downloads will be saved to ' + res.dir);
    });
  }

  var btnResetDownloadFolder = document.getElementById('btn-reset-download-folder');
  if (btnResetDownloadFolder) {
    btnResetDownloadFolder.addEventListener('click', async () => {
      if (!window.electronAPI || !window.electronAPI.resetDownloadDir) return;
      if (btnResetDownloadFolder.disabled) return;
      btnResetDownloadFolder.disabled = true;
      let res = null;
      try {
        res = await window.electronAPI.resetDownloadDir();
      } catch (e) {
        res = { ok: false, error: e.message };
      }
      btnResetDownloadFolder.disabled = false;
      if (!res || !res.ok) {
        showToast((res && res.error) || 'Could not reset the download folder', 'error');
        return;
      }
      updateDownloadFolderUI();
      showToast('Download folder reset to default');
    });
  }

  var btnDeleteOfflineTrack = document.getElementById('btn-delete-offline-track');
  if (btnDeleteOfflineTrack) {
    btnDeleteOfflineTrack.addEventListener('click', async () => {
      if (!trackToDownload || !trackToDownload.id) return;
      try {
        await fetch(`http://127.0.0.1:${state.serverPort}/api/offline-delete?id=${encodeURIComponent(trackToDownload.id)}`, { method: 'POST' });
        showToast('Track removed from offline cache');
        updateOfflineStorageUI();
        if (el.downloadModal) closeModal(el.downloadModal);
      } catch (e) {
        showToast('Failed to delete offline track');
      }
    });
  }

  var btnClearOffline = document.getElementById('btn-clear-offline');
  var clearOfflineModal = document.getElementById('clear-offline-modal');
  var btnCancelClearOffline = document.getElementById('btn-cancel-clear-offline');
  var btnConfirmClearOffline = document.getElementById('btn-confirm-clear-offline');

  if (btnClearOffline && clearOfflineModal) {
    btnClearOffline.addEventListener('click', () => {
      openModal(clearOfflineModal);
    });
  }
  if (btnCancelClearOffline && clearOfflineModal) {
    btnCancelClearOffline.addEventListener('click', () => {
      closeModal(clearOfflineModal);
    });
  }
  if (btnConfirmClearOffline && clearOfflineModal) {
    btnConfirmClearOffline.addEventListener('click', async () => {
      try {
        await fetch(`http://127.0.0.1:${state.serverPort}/api/clear-offline-library`, { method: 'POST' });
        showToast('Offline library cleared');
        updateOfflineStorageUI();
      } catch (e) {
        showToast('Failed to clear offline library');
      }
      closeModal(clearOfflineModal);
    });
  }

  var toolsPollInterval = null;
  var toolsWavyYt = null;
  var toolsWavyFf = null;

  var STATUS_ICONS = {
    pending: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--md-sys-color-outline);"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    downloading: '<span class="riff-dots-loader sm" aria-hidden="true"><i></i><i></i><i></i></span>',
    done: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color: #4cd964;"><polyline points="20 6 9 17 4 12"/></svg>',
    error: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--md-sys-color-error, #ff5449);"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
  };


  function updateToolsUI(status) {
    if (!status) return;

    const isYtDlp = Boolean(status.ytdlp !== undefined ? status.ytdlp : status.ytDlp);
    const isFfmpeg = Boolean(status.ffmpeg || status.ffmpegOptional);
    const isReady = isYtDlp && isFfmpeg;
    state.toolsReady = isReady;

    const prog = status.progress || {};
    const errorMsg = status.error || prog.error || '';
    const isError = Boolean(errorMsg || prog.status === 'error');
    const pct = typeof status.percent === 'number' ? status.percent : (typeof prog.percent === 'number' ? prog.percent : 0);
    const step = status.step || (prog.tool ? `downloading ${prog.tool}` : '');

    let activeTool = null;
    if (step.includes('yt-dlp') || prog.tool === 'yt-dlp') activeTool = 'yt-dlp';
    else if (step.includes('ffmpeg') || prog.tool === 'ffmpeg') activeTool = 'ffmpeg';
    else if (!isYtDlp) activeTool = 'yt-dlp';
    else if (!isFfmpeg) activeTool = 'ffmpeg';

    let ytdlpStatus = 'pending';
    let ffmpegStatus = 'pending';

    if (isReady) {
      ytdlpStatus = 'done';
      ffmpegStatus = 'done';
    } else if (isError) {
      if (activeTool === 'yt-dlp') {
        ytdlpStatus = 'error';
        ffmpegStatus = isFfmpeg ? 'done' : 'pending';
      } else {
        ytdlpStatus = isYtDlp ? 'done' : 'pending';
        ffmpegStatus = 'error';
      }
    } else if (activeTool === 'yt-dlp') {
      ytdlpStatus = 'downloading';
      ffmpegStatus = isFfmpeg ? 'done' : 'pending';
    } else if (activeTool === 'ffmpeg') {
      ytdlpStatus = 'done';
      ffmpegStatus = 'downloading';
    } else {
      ytdlpStatus = isYtDlp ? 'done' : 'pending';
      ffmpegStatus = isFfmpeg ? 'done' : 'pending';
    }

    const iconYt = document.getElementById('tools-icon-ytdlp');
    const iconFf = document.getElementById('tools-icon-ffmpeg');
    if (iconYt) iconYt.innerHTML = STATUS_ICONS[ytdlpStatus] || STATUS_ICONS.pending;
    if (iconFf) iconFf.innerHTML = STATUS_ICONS[ffmpegStatus] || STATUS_ICONS.pending;

    const pctYt = document.getElementById('tools-pct-ytdlp');
    const pctFf = document.getElementById('tools-pct-ffmpeg');
    if (pctYt) {
      pctYt.textContent = ytdlpStatus === 'downloading' ? `${pct}%` : (ytdlpStatus === 'done' ? 'Ready' : (ytdlpStatus === 'error' ? 'Failed' : ''));
    }
    if (pctFf) {
      pctFf.textContent = ffmpegStatus === 'downloading' ? `${pct}%` : (ffmpegStatus === 'done' ? 'Ready' : (ffmpegStatus === 'error' ? 'Failed' : ''));
    }

    const wrapYt = document.getElementById('tools-wavy-ytdlp');
    const wrapFf = document.getElementById('tools-wavy-ffmpeg');
    if (activeTool === 'yt-dlp' && ytdlpStatus === 'downloading') {
      if (wrapYt) {
        wrapYt.style.display = 'block';
        wrapYt.style.setProperty('--tools-progress', pct.toString());
        if (!toolsWavyYt && typeof createWavyProgress === 'function') toolsWavyYt = createWavyProgress(wrapYt);
        if (toolsWavyYt) toolsWavyYt.set(pct);
      }
      if (wrapFf) wrapFf.style.display = 'none';
    } else if (activeTool === 'ffmpeg' && ffmpegStatus === 'downloading') {
      if (wrapYt) wrapYt.style.display = 'none';
      if (wrapFf) {
        wrapFf.style.display = 'block';
        wrapFf.style.setProperty('--tools-progress', pct.toString());
        if (!toolsWavyFf && typeof createWavyProgress === 'function') toolsWavyFf = createWavyProgress(wrapFf);
        if (toolsWavyFf) toolsWavyFf.set(pct);
      }
    } else {
      if (wrapYt) wrapYt.style.display = 'none';
      if (wrapFf) wrapFf.style.display = 'none';
    }

    const errEl = document.getElementById('tools-error-msg');
    const btnDownload = document.getElementById('btn-confirm-install-tools');
    const btnRetry = document.getElementById('btn-retry-tools');
    const btnDismiss = document.getElementById('btn-dismiss-tools-modal');
    const btnClose = document.getElementById('btn-close-tools-modal');

    

    if (btnClose) btnClose.style.display = 'none';
    if (btnDismiss) btnDismiss.style.display = 'none';
    if (btnDownload) btnDownload.style.display = 'none';

    if (isError) {
      if (errEl) {
        errEl.textContent = errorMsg || 'Installation failed';
        errEl.style.display = 'block';
      }
      if (btnRetry) {
        btnRetry.className = 'btn-pill-primary';
        btnRetry.textContent = 'Retry download';
        btnRetry.style.display = 'inline-flex';
      }
    } else {
      if (errEl) errEl.style.display = 'none';
      if (btnRetry) btnRetry.style.display = 'none';
    }

    const statusText = document.getElementById('tools-status-text');
    const btnInstall = document.getElementById('btn-install-tools');
    if (statusText) {
      if (isReady) {
        statusText.textContent = 'Installed';
        if (btnInstall) {
          btnInstall.classList.add('hidden');
          btnInstall.disabled = false;
        }
      } else if (isError) {
        statusText.textContent = 'Download failed';
        if (btnInstall) {
          btnInstall.classList.remove('hidden');
          btnInstall.disabled = false;
        }
      } else {
        const stepDesc = step || `downloading ${activeTool || 'tools'}`;
        statusText.textContent = `${stepDesc} ${pct}%`;
        if (btnInstall) {
          btnInstall.classList.remove('hidden');
          btnInstall.disabled = true;
        }
      }
    }

    if (isReady) {
      const modal = document.getElementById('tools-install-modal');
      if (modal) closeModal(modal);
    }
  }

  function pollToolsStatus() {
    if (toolsPollInterval) return;
    toolsPollInterval = setInterval(async () => {
      if (!state.serverPort) return;
      try {
        const res = await fetch(`http://127.0.0.1:${state.serverPort}/api/tools/status`);
        const status = await res.json();
        updateToolsUI(status);
        const isReady = Boolean(status.ytdlp !== undefined ? status.ytdlp : status.ytDlp) && Boolean(status.ffmpeg || status.ffmpegOptional);
        const isError = Boolean(status.error || (status.progress && status.progress.status === 'error'));
        if (isReady) {
          clearInterval(toolsPollInterval);
          toolsPollInterval = null;
          state.toolsReady = true;
          const modal = document.getElementById('tools-install-modal');
          if (modal) closeModal(modal);
        } else if (isError) {
          clearInterval(toolsPollInterval);
          toolsPollInterval = null;
        }
      } catch (e) {}
    }, 500);
  }

  function startToolsInstall() {
    const btnInstall = document.getElementById('btn-install-tools');
    if (btnInstall) btnInstall.disabled = true;

    const modal = document.getElementById('tools-install-modal');
    if (modal) openModal(modal);

    const btnClose = document.getElementById('btn-close-tools-modal');
    const btnDismiss = document.getElementById('btn-dismiss-tools-modal');
    const btnDownload = document.getElementById('btn-confirm-install-tools');
    const btnRetry = document.getElementById('btn-retry-tools');
    const errEl = document.getElementById('tools-error-msg');

    if (btnClose) btnClose.style.display = 'none';
    if (btnDismiss) btnDismiss.style.display = 'none';
    if (btnDownload) btnDownload.style.display = 'none';
    if (btnRetry) btnRetry.style.display = 'none';
    if (errEl) errEl.style.display = 'none';

    if (state.serverPort) {
      fetch(`http://127.0.0.1:${state.serverPort}/api/tools/install`, { method: 'POST' }).catch(() => {
        fetch(`http://127.0.0.1:${state.serverPort}/api/tools-install`, { method: 'POST' }).catch(() => {});
      });
    }
    pollToolsStatus();
  }

  async function checkToolsStatus(promptUser = false) {
    if (!state.serverPort) return;
    try {
      const res = await fetch(`http://127.0.0.1:${state.serverPort}/api/tools/status`);
      const status = await res.json();
      updateToolsUI(status);

      const isYtDlp = Boolean(status.ytdlp !== undefined ? status.ytdlp : status.ytDlp);
      const isFfmpeg = Boolean(status.ffmpeg || status.ffmpegOptional);
      if (!isYtDlp || !isFfmpeg) {
        state.toolsReady = false;
        const modal = document.getElementById('tools-install-modal');
        if (modal) openModal(modal);
        startToolsInstall();
      } else {
        state.toolsReady = true;
        const modal = document.getElementById('tools-install-modal');
        if (modal && !modal.classList.contains('hidden')) {
          closeModal(modal);
        }
      }
    } catch (e) {}
  }

  var btnInstallTools = document.getElementById('btn-install-tools');
  if (btnInstallTools) {
    btnInstallTools.addEventListener('click', () => {
      startToolsInstall();
    });
  }

  var toolsModal = document.getElementById('tools-install-modal');
  var btnConfirmInstallTools = document.getElementById('btn-confirm-install-tools');
  var btnDismissToolsModal = document.getElementById('btn-dismiss-tools-modal');
  var btnCloseToolsModal = document.getElementById('btn-close-tools-modal');
  var btnRetryTools = document.getElementById('btn-retry-tools');

  if (btnConfirmInstallTools) {
    btnConfirmInstallTools.addEventListener('click', () => {
      startToolsInstall();
    });
  }

  if (btnRetryTools) {
    btnRetryTools.addEventListener('click', () => {
      startToolsInstall();
    });
  }

  if (btnDismissToolsModal && toolsModal) {
    btnDismissToolsModal.addEventListener('click', () => {
      if (!state.toolsReady) return;
      closeModal(toolsModal);
    });
  }

  if (btnCloseToolsModal && toolsModal) {
    btnCloseToolsModal.addEventListener('click', () => {
      if (!state.toolsReady) return;
      closeModal(toolsModal);
    });
  }

  if (toolsModal) {
    toolsModal.addEventListener('click', (e) => {
      if (e.target === toolsModal) {
        if (!state.toolsReady) {
          e.stopPropagation();
          e.preventDefault();
        } else {
          closeModal(toolsModal);
        }
      }
    });
  }



  var btnCopyDiagnostics = document.getElementById('btn-copy-diagnostics');
  var btnOpenShortcuts = document.getElementById('btn-open-shortcuts');
  var shortcutsModal = document.getElementById('shortcuts-modal');
  var btnCloseShortcutsModal = document.getElementById('btn-close-shortcuts-modal');

  var shortcutRecordingTarget = null;
  var shortcutRecordingCleanup = null;


  function stopShortcutRecording() {
    if (shortcutRecordingCleanup) {
      try { shortcutRecordingCleanup(); } catch (_) {}
      shortcutRecordingCleanup = null;
    }
    if (shortcutRecordingTarget) {
      shortcutRecordingTarget.classList.remove('recording');
      shortcutRecordingTarget = null;
    }
  }

  function startShortcutRecording(actionKey, btnEl) {
    stopShortcutRecording();
    shortcutRecordingTarget = btnEl;
    btnEl.classList.add('recording');
    btnEl.textContent = 'Press key...';

    const onKey = (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      if (e.key === 'Escape' || e.code === 'Escape') {
        stopShortcutRecording();
        renderShortcutsModalBody();
        return;
      }

      if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
        return;
      }

      activeShortcuts[actionKey] = {
        code: e.code,
        ctrl: !!(e.ctrlKey || e.metaKey),
        shift: !!e.shiftKey,
        alt: !!e.altKey
      };
      saveCustomShortcuts();
      stopShortcutRecording();
      renderShortcutsModalBody();
      if (typeof showToast === 'function') {
        showToast('Shortcut updated', 'success');
      }
    };

    shortcutRecordingCleanup = () => {
      window.removeEventListener('keydown', onKey, true);
    };
    window.addEventListener('keydown', onKey, true);
  }

  function renderShortcutsModalBody() {
    if (!shortcutsModal) return;
    const bodyContainer = shortcutsModal.querySelector('.dialog-card > div:nth-child(2)');
    if (!bodyContainer) return;

    let rowsHtml = '';
    for (const item of shortcutMetadata) {
      const binding = activeShortcuts[item.key] || defaultShortcuts[item.key];
      const badge = formatShortcutBadge(binding);
      rowsHtml += `
        <div class="shortcut-row">
          <span class="shortcut-label">${escapeHtml(item.label)}</span>
          <button type="button" class="shortcut-edit-btn" data-action="${item.key}" title="Click to change shortcut">
            ${escapeHtml(badge)}
          </button>
        </div>
      `;
    }

    rowsHtml += `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(255, 255, 255, 0.08);">
        <span style="font-size: calc(11px * var(--font-scale, 1)); color: var(--md-sys-color-on-surface-variant); opacity: 0.85;">Click to rebind · Esc to cancel</span>
        <button type="button" class="btn-outline-pill" id="btn-reset-shortcuts" style="padding: 4px 12px; font-size: calc(11px * var(--font-scale, 1));">Reset to defaults</button>
      </div>
    `;

    bodyContainer.innerHTML = rowsHtml;

    bodyContainer.querySelectorAll('.shortcut-edit-btn').forEach(btn => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        startShortcutRecording(btn.dataset.action, btn);
      });
    });

    const btnReset = bodyContainer.querySelector('#btn-reset-shortcuts');
    if (btnReset) {
      btnReset.addEventListener('click', (ev) => {
        ev.stopPropagation();
        stopShortcutRecording();
        activeShortcuts = { ...defaultShortcuts };
        try { localStorage.removeItem('riff_keyboard_shortcuts'); } catch (_) {}
        renderShortcutsModalBody();
        if (typeof showToast === 'function') {
          showToast('Shortcuts reset to defaults', 'info');
        }
      });
    }
  }

  if (btnOpenShortcuts && shortcutsModal) {
    btnOpenShortcuts.addEventListener('click', () => {
      stopShortcutRecording();
      renderShortcutsModalBody();
      openModal(shortcutsModal);
    });
    shortcutsModal.addEventListener('click', (event) => {
      if (event.target === shortcutsModal) {
        stopShortcutRecording();
        closeModal(shortcutsModal);
      }
    });
  }
  if (btnCloseShortcutsModal && shortcutsModal) {
    btnCloseShortcutsModal.addEventListener('click', () => {
      stopShortcutRecording();
      closeModal(shortcutsModal);
    });
  }

  if (btnCopyDiagnostics) {
    btnCopyDiagnostics.addEventListener('click', async () => {
      if (window.electronAPI && typeof window.electronAPI.getDiagnostics === 'function') {
        navigator.clipboard.writeText(await window.electronAPI.getDiagnostics());
        showToast('Diagnostics copied. Paste it into your report', 'info');
      }
    });
  }

  var btnOpenLogs = document.getElementById('btn-open-logs');
  if (btnOpenLogs) {
    btnOpenLogs.addEventListener('click', () => {
      if (window.electronAPI && typeof window.electronAPI.openLogsFolder === 'function') {
        window.electronAPI.openLogsFolder();
      }
    });
  }

  var trackArtCurrentTrack = null;


  function getSidebarOrder() {
    try {
      const raw = localStorage.getItem('riff_sidebar_order');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const valid = parsed.filter(id => DEFAULT_SIDEBAR_ORDER.includes(id));
          DEFAULT_SIDEBAR_ORDER.forEach(id => {
            if (!valid.includes(id)) valid.push(id);
          });
          return valid;
        }
      }
    } catch (_) {}
    return [...DEFAULT_SIDEBAR_ORDER];
  }

  function applySidebarOrder(order) {
    const currentOrder = order || getSidebarOrder();
    const nav = document.querySelector('#sidebar .sidebar-nav');
    const divider = nav ? nav.querySelector('.rail-divider') : null;
    if (!nav || !divider) return;
    currentOrder.forEach(viewId => {
      const btn = nav.querySelector(`.nav-item[data-view="${viewId}"]`);
      if (btn) {
        divider.parentNode.insertBefore(btn, divider);
      }
    });
    if (typeof updateNavIndicator === 'function') {
      requestAnimationFrame(() => updateNavIndicator(false));
    }
  }

  var DEFAULT_HOME_ORDER = ['sp-made-sec', 'sp-quick-sec', 'sp-trend-sec', 'sp-artists-sec'];

  var HOME_SECTION_DEFS = {
    'sp-made-sec': { name: 'For you', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 10v2M8 6v10M12 2v18M16 6v10M20 10v2"/></svg>' },
    'sp-quick-sec': { name: 'Home / Quick picks', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M4,19V10Q4,9.52 4.21,9.1Q4.43,8.67 4.8,8.4l6-4.5Q11.33,3.5 12,3.5t1.2,0.4l6,4.5q0.38,0.28 0.59,0.7Q20,9.52 20,10v9q0,0.82-0.59,1.41T18,21H15q-0.42,0-0.71-0.29Q14,20.43 14,20V15q0-0.43-0.29-0.71T13,14H11q-0.42,0-0.71,0.29T10,15v5q0,0.43-0.29,0.71T9,21H6q-0.82,0-1.41-0.59T4,19Z"/></svg>' },
    'sp-trend-sec': { name: 'Trending now', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-9z"/></svg>' },
    'sp-artists-sec': { name: 'Favorite artists', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>' }
  };

  function getHomeSectionsOrder() {
    try {
      const raw = localStorage.getItem('riff_home_order');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const valid = parsed.filter(id => DEFAULT_HOME_ORDER.includes(id));
          DEFAULT_HOME_ORDER.forEach(id => {
            if (!valid.includes(id)) valid.push(id);
          });
          return valid;
        }
      }
    } catch (_) {}
    return [...DEFAULT_HOME_ORDER];
  }

  function applyHomeSectionsOrder(order) {
    const currentOrder = order || getHomeSectionsOrder();
    const container = document.getElementById('sp-home');
    if (!container) return;
    currentOrder.forEach(secId => {
      const secEl = document.getElementById(secId);
      if (secEl && secEl.parentNode === container) {
        container.appendChild(secEl);
      }
    });
  }

  function makeCustomizerList(container, getOrderFn, saveKey, defsMap, applyFn) {
    if (!container) return () => {};
    const render = () => {
      const currentOrder = getOrderFn();
      container.innerHTML = '';
      currentOrder.forEach((id, index) => {
        const def = defsMap[id] || { name: id, icon: '' };
        const row = document.createElement('div');
        row.className = 'customizer-drag-row';
        row.setAttribute('draggable', 'true');
        row.setAttribute('data-id', id);
        row.innerHTML = `
          <span class="drag-handle" title="Drag to reorder">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="9" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="15" cy="19" r="1.5"/></svg>
          </span>
          <span class="customizer-icon">${def.icon}</span>
          <span style="flex:1; font-weight:500;">${escapeHtml(def.name)}</span>
          <div style="display:flex; gap:4px;">
            <button type="button" class="btn-icon-pill btn-move-up" style="width:24px;height:24px;padding:0;min-width:24px;" title="Move up" ${index === 0 ? 'disabled' : ''}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>
            </button>
            <button type="button" class="btn-icon-pill btn-move-down" style="width:24px;height:24px;padding:0;min-width:24px;" title="Move down" ${index === currentOrder.length - 1 ? 'disabled' : ''}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
          </div>
        `;

        const btnUp = row.querySelector('.btn-move-up');
        if (btnUp) {
          btnUp.addEventListener('click', (e) => {
            e.stopPropagation();
            const prev = row.previousElementSibling;
            if (prev) {
              container.insertBefore(row, prev);
              saveAndApply();
            }
          });
        }

        const btnDown = row.querySelector('.btn-move-down');
        if (btnDown) {
          btnDown.addEventListener('click', (e) => {
            e.stopPropagation();
            const next = row.nextElementSibling;
            if (next) {
              container.insertBefore(next, row);
              saveAndApply();
            }
          });
        }

        row.addEventListener('dragstart', (e) => {
          row.classList.add('dragging');
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', id);
        });

        row.addEventListener('dragend', () => {
          row.classList.remove('dragging');
          container.querySelectorAll('.customizer-drag-row').forEach(r => r.classList.remove('drag-over'));
          saveAndApply();
        });

        row.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          const dragging = container.querySelector('.customizer-drag-row.dragging');
          if (dragging && dragging !== row) {
            const rect = row.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            if (e.clientY < midY) {
              container.insertBefore(dragging, row);
            } else {
              container.insertBefore(dragging, row.nextElementSibling);
            }
          }
        });

        container.appendChild(row);
      });
    };

    function saveAndApply() {
      const newOrder = Array.from(container.children).map(c => c.getAttribute('data-id')).filter(Boolean);
      localStorage.setItem(saveKey, JSON.stringify(newOrder));
      applyFn(newOrder);
      render();
    }

    render();
    return render;
  }

  function initSidebarOrderCustomizer() {
    const sidebarContainer = document.getElementById('settings-sidebar-replica');
    const homeContainer = document.getElementById('settings-home-order-list');
    const resetBtn = document.getElementById('btn-reset-sidebar-order');

    let renderSidebar, renderHome;
    if (sidebarContainer) {
      renderSidebar = makeCustomizerList(
        sidebarContainer,
        getSidebarOrder,
        'riff_sidebar_order',
        SIDEBAR_ITEM_DEFS,
        applySidebarOrder
      );
    }
    if (homeContainer) {
      renderHome = makeCustomizerList(
        homeContainer,
        getHomeSectionsOrder,
        'riff_home_order',
        HOME_SECTION_DEFS,
        applyHomeSectionsOrder
      );
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        localStorage.removeItem('riff_sidebar_order');
        localStorage.removeItem('riff_home_order');
        applySidebarOrder(DEFAULT_SIDEBAR_ORDER);
        applyHomeSectionsOrder(DEFAULT_HOME_ORDER);
        if (renderSidebar) renderSidebar();
        if (renderHome) renderHome();
        showToast('Sidebar & home layout reset to default');
      });
    }
  }

  var currentSearchFilter = 'all';


  function applySearchFilter(filter) {
    if (filter) currentSearchFilter = filter;
    const chips = document.querySelectorAll('#search-filter-chips .search-chip');
    chips.forEach(chip => {
      chip.classList.toggle('active', chip.getAttribute('data-filter') === currentSearchFilter);
    });

    const spotifyTop = document.getElementById('search-spotify-top');
    const artistCol = document.getElementById('search-top-result-col');
    const songsCol = document.getElementById('search-top-songs-col');
    const artistContainer = document.getElementById('search-artist-card-container');
    const albumsContainer = document.getElementById('search-albums-container');
    const playlistsContainer = document.getElementById('search-playlists-container');
    const tracksList = document.getElementById('search-tracks-list');

    const showArtist = (currentSearchFilter === 'all' || currentSearchFilter === 'artists');
    const showAlbums = (currentSearchFilter === 'all' || currentSearchFilter === 'albums');
    const showPlaylists = (currentSearchFilter === 'all' || currentSearchFilter === 'playlists');
    const showSongs = (currentSearchFilter === 'all' || currentSearchFilter === 'songs');

    if (spotifyTop) {
      if (currentSearchFilter === 'all') {
        spotifyTop.style.display = '';
        if (artistCol) artistCol.style.display = '';
        if (songsCol) songsCol.style.display = '';
      } else if (currentSearchFilter === 'songs') {
        spotifyTop.style.display = '';
        if (artistCol) artistCol.style.display = 'none';
        if (songsCol) songsCol.style.display = '';
      } else if (currentSearchFilter === 'artists') {
        spotifyTop.style.display = '';
        if (artistCol) artistCol.style.display = '';
        if (songsCol) songsCol.style.display = 'none';
      } else {
        spotifyTop.style.display = 'none';
      }
    }
    if (artistContainer) {
      artistContainer.style.display = showArtist ? '' : 'none';
    }
    if (albumsContainer) {
      albumsContainer.style.display = showAlbums ? '' : 'none';
    }
    if (playlistsContainer) {
      playlistsContainer.style.display = showPlaylists ? '' : 'none';
    }
    if (tracksList) {
      tracksList.style.display = showSongs ? '' : 'none';
    }
  }



  function initSpotifyPromo() {
    const card = document.getElementById('spotify-promo');
    const btnImport = document.getElementById('btn-spotify-promo-import');
    const btnClose = document.getElementById('btn-spotify-promo-close');
    if (!card || !btnImport || !btnClose) return;
    const isDismissed = localStorage.getItem('riff_spotify_promo_dismissed') === '1' || (Array.isArray(state.playlists) && state.playlists.length > 0);
    const dismissForever = () => {
      card.hidden = true;
      card.classList.add('hidden');
      localStorage.setItem('riff_spotify_promo_dismissed', '1');
      try {
        if (window.electronAPI?.storageSaveSync && window.__RIFF_STORAGE_MAP__) {
          window.__RIFF_STORAGE_MAP__['riff_spotify_promo_dismissed'] = '1';
          window.electronAPI.storageSaveSync(window.__RIFF_STORAGE_MAP__);
        }
      } catch (_) {}
    };
    if (isDismissed) {
      dismissForever();
      return;
    }
    card.hidden = false;
    card.classList.remove('hidden');
    const syncOrbitPaused = () => {
      const stage = card.querySelector('.riff-orbit-stage');
      if (stage) stage.classList.toggle('orbit-paused', document.hidden);
    };
    document.addEventListener('visibilitychange', syncOrbitPaused);
    if (window.electronAPI && window.electronAPI.onWindowVisibility) {
      window.electronAPI.onWindowVisibility(visible => {
        const stage = card.querySelector('.riff-orbit-stage');
        if (stage) stage.classList.toggle('orbit-paused', !visible || document.hidden);
      });
    }
    btnImport.addEventListener('click', () => {
      dismissForever();
      localStorage.setItem('riff_settings_cat', 'integrations');
      switchView('settings');
      if (typeof showSettingsCategory === 'function') showSettingsCategory('integrations');
    });
    btnClose.addEventListener('click', dismissForever);
  }


  function initSearchFilterChips() {
    const container = document.getElementById('search-filter-chips');
    if (!container) return;
    const chips = container.querySelectorAll('.search-chip');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        const filter = chip.getAttribute('data-filter') || 'all';
        applySearchFilter(filter);
      });
    });
  }

  function initMouseNavInterceptor() {
    const handleMouseNav = (e) => {
      if (e.button === 3) {
        e.preventDefault();
        e.stopPropagation();
        const target = (state.previousView && state.previousView !== state.currentView) ? state.previousView : 'discover';
        switchView(target);
      } else if (e.button === 4) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('mouseup', handleMouseNav, true);
    window.addEventListener('auxclick', handleMouseNav, true);
  }

  function initDesktopShortcutSetting() {
    const btn = document.getElementById('btn-create-shortcut');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      if (window.electronAPI && window.electronAPI.installLauncher) {
        try {
          btn.disabled = true;
          btn.textContent = 'Creating...';
          const res = await window.electronAPI.installLauncher();
          if (res && res.ok) {
            showToast('Shortcut created on Desktop & App Menu', 'success');
          } else {
            showToast('Failed to create shortcut: ' + ((res && res.error) || 'unknown error'), 'error');
          }
        } catch (err) {
          showToast('Error creating shortcut: ' + (err.message || err));
        } finally {
          btn.disabled = false;
          btn.textContent = 'Create shortcut';
        }
      } else {
        showToast('Shortcut installer is not supported in this environment');
      }
    });
  }

  function initDefaultSettingsStudio() {
    const studioEl = document.getElementById('setting-default-studio');
    const port = (window.state && window.state.serverPort) || (typeof state !== 'undefined' && state.serverPort) || 38472;
    fetch(`http://127.0.0.1:${port}/api/default-settings`)
      .then(res => res.json())
      .then(data => {
        if (data && data.isOwnerEnv === true && studioEl) {
          studioEl.classList.remove('hidden');
          studioEl.style.display = '';
        }
      })
      .catch(() => {});

    const btnSave = document.getElementById('btn-save-as-defaults');
    const btnTest = document.getElementById('btn-test-new-user');
    const btnRestore = document.getElementById('btn-restore-owner-profile');

    if (btnRestore) {
      if (localStorage.getItem('riff_owner_profile_backup')) {
        btnRestore.classList.remove('hidden');
        btnRestore.style.display = '';
      } else {
        btnRestore.classList.add('hidden');
        btnRestore.style.display = 'none';
      }

      btnRestore.addEventListener('click', () => {
        try {
          const backupRaw = localStorage.getItem('riff_owner_profile_backup');
          if (!backupRaw) return;
          const backupObj = JSON.parse(backupRaw);
          localStorage.clear();
          for (const [k, v] of Object.entries(backupObj)) {
            if (k !== 'riff_owner_profile_backup') {
              localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
            }
          }
          localStorage.removeItem('riff_owner_profile_backup');
          if (window.electronAPI && typeof window.electronAPI.storageSaveSync === 'function') {
            const diskMap = window.__RIFF_STORAGE_MAP__ || {};
            window.electronAPI.storageSaveSync(diskMap);
          }
          window.location.reload();
        } catch (err) {
          showToast('Error restoring profile: ' + (err.message || err), 'error');
        }
      });
    }

    if (btnSave) {
      btnSave.addEventListener('click', async () => {
        try {
          const defs = {};
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (!k) continue;
            if (EXCLUDED_PERSONAL_KEYS.has(k)) continue;
            if (k.startsWith('riff_i18n_') || k.startsWith('riff_audio_analysis_')) continue;
            defs[k] = localStorage.getItem(k);
          }

          const port = (window.state && window.state.serverPort) || (typeof state !== 'undefined' && state.serverPort) || 38472;
          const token = (window.electronAPI && window.electronAPI.serverToken) || '';
          const res = await fetch(`http://127.0.0.1:${port}/api/save-default-settings`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { 'X-Riff-Token': token } : {})
            },
            body: JSON.stringify({ defaults: defs })
          });
          const data = await res.json();
          if (data && data.success) {
            showToast('Saved current settings to defaults.json!', 'success');
          } else {
            showToast('Failed to save defaults: ' + ((data && data.error) || 'unknown error'), 'error');
          }
        } catch (err) {
          showToast('Error saving defaults: ' + (err.message || err), 'error');
        }
      });
    }

    if (btnTest) {
      btnTest.addEventListener('click', () => {
        try {
          const allLocalStorage = {};
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k) allLocalStorage[k] = localStorage.getItem(k);
          }
          const backup = JSON.stringify(allLocalStorage);
          localStorage.clear();
          localStorage.setItem('riff_owner_profile_backup', backup);
          localStorage.setItem('riff_user_initialized_v1', '1');

          const defs = getDefaultsJsonSync() || {};
          for (const [k, v] of Object.entries(defs)) {
            if (k !== 'riff_owner_profile_backup') {
              localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
            }
          }

          if (window.electronAPI && typeof window.electronAPI.storageSaveSync === 'function') {
            const diskMap = window.__RIFF_STORAGE_MAP__ || {};
            window.electronAPI.storageSaveSync(diskMap);
          }
          window.location.reload();
        } catch (err) {
          showToast('Error switching to new user: ' + (err.message || err), 'error');
        }
      });
    }
  }

  function initLikeAlbumTracksSetting() {
    const btn = document.getElementById('btn-like-album-tracks');
    if (!btn) return;
    const isEnabled = localStorage.getItem('riff_like_album_tracks') === '1';
    btn.classList.toggle('active', isEnabled);
    btn.addEventListener('click', () => {
      const nextState = !btn.classList.contains('active');
      btn.classList.toggle('active', nextState);
      localStorage.setItem('riff_like_album_tracks', nextState ? '1' : '0');
    });
  }

  var SIDEBAR_PINNED_TRACKS_KEY = 'riff_sidebar_pinned_tracks';

  function initSidebarResizeAndLibrary() {
    const edge = document.getElementById('sidebar-resize-edge');
    const sidebar = document.getElementById('sidebar');
    const feed = document.getElementById('sidebar-library-feed');
    if (!edge || !sidebar) return;

    if (feed && !feed._scrollMaskBound) {
      feed._scrollMaskBound = true;
      let feedScrollRaf = 0;
      feed.addEventListener('scroll', () => {
        if (feedScrollRaf) return;
        feedScrollRaf = requestAnimationFrame(() => {
          feedScrollRaf = 0;
          const needFade = feed.scrollTop > 6;
          if (feed._lastFadeTop !== needFade) {
            feed._lastFadeTop = needFade;
            feed.classList.toggle('fade-top', needFade);
          }
        });
      }, { passive: true });
    }

    if (feed && !feed._reorderInit) {
      feed._reorderInit = true;
      initListReordering({
        container: feed,
        itemSelector: '.sb-lib-row[data-sb-group]',
        isFilterActive: () => currentSidebarLibFilter !== 'playlists',
        setOrder: (fromIdx, toIdx) => {
          const rows = Array.from(feed.querySelectorAll('.sb-lib-row[data-sb-group]'));

          const currentPinned = getSidebarPinnedTracks();
          const orderedKeys = rows
            .filter(r => r.dataset.sbGroup === 'pinned-track')
            .map(r => r.dataset.sbKey)
            .filter(Boolean);
          if (orderedKeys.length > 0 && currentPinned.length > 0) {
            const trackMap = new Map();
            currentPinned.forEach(t => {
              const k = getTrackCanonicalId(t);
              if (k && !trackMap.has(k)) trackMap.set(k, t);
            });
            const reorderedPinned = [];
            orderedKeys.forEach(k => {
              if (trackMap.has(k)) {
                reorderedPinned.push(trackMap.get(k));
                trackMap.delete(k);
              }
            });
            trackMap.forEach(t => reorderedPinned.push(t));
            localStorage.setItem('riff_sidebar_pinned_tracks', JSON.stringify(reorderedPinned.slice(0, 50)));
          }

          const currentLibTracks = getSidebarLibraryTracks();
          const orderedUnpinnedTrackKeys = rows
            .filter(r => r.dataset.sbGroup === 'unpinned-track')
            .map(r => r.dataset.sbKey)
            .filter(Boolean);
          if (orderedUnpinnedTrackKeys.length > 0 && currentLibTracks.length > 0) {
            const libMap = new Map();
            currentLibTracks.forEach(t => {
              const k = getTrackCanonicalId(t);
              if (k && !libMap.has(k)) libMap.set(k, t);
            });
            const reorderedLib = [];
            orderedUnpinnedTrackKeys.forEach(k => {
              if (libMap.has(k)) {
                reorderedLib.push(libMap.get(k));
                libMap.delete(k);
              }
            });
            libMap.forEach(t => reorderedLib.push(t));
            try { localStorage.setItem(SIDEBAR_LIBRARY_TRACKS_KEY, JSON.stringify(reorderedLib.slice(0, 200))); } catch (_) {}
            localStorage.setItem('riff_sb_lib_sort', 'Custom');
            const sortLbl = document.getElementById('sb-lib-sort-label');
            if (sortLbl) sortLbl.textContent = typeof t === 'function' ? t('Custom') : 'Custom';
          }

          const orderedPinnedPlIds = rows
            .filter(r => r.dataset.sbGroup === 'pinned-pl')
            .map(r => r.dataset.playlistId)
            .filter(Boolean);
          localStorage.setItem('riff_pinned_playlists', JSON.stringify(orderedPinnedPlIds));

          const orderedUnpinnedPlIds = rows
            .filter(r => r.dataset.sbGroup === 'unpinned-pl')
            .map(r => r.dataset.playlistId)
            .filter(Boolean);
          const orderedAllPlIds = [...orderedPinnedPlIds, ...orderedUnpinnedPlIds];
          if (orderedAllPlIds.length > 0) {
            localStorage.setItem('riff_sidebar_custom_order', JSON.stringify(orderedAllPlIds));
            localStorage.setItem('riff_sb_lib_sort', 'Custom');
            const sortLbl = document.getElementById('sb-lib-sort-label');
            if (sortLbl) sortLbl.textContent = typeof t === 'function' ? t('Custom') : 'Custom';
          }
          if (Array.isArray(state.playlists) && orderedAllPlIds.length > 0) {
            const plMap = new Map(state.playlists.map(p => [String(p.id), p]));
            const reorderedPlaylists = [];
            orderedAllPlIds.forEach(id => {
              const pl = plMap.get(String(id));
              if (pl) {
                reorderedPlaylists.push(pl);
                plMap.delete(String(id));
              }
            });
            plMap.forEach(p => reorderedPlaylists.push(p));
            state.playlists = reorderedPlaylists;
            localStorage.setItem('devsize_playlists', JSON.stringify(state.playlists));
            if (typeof renderPlaylistsList === 'function') renderPlaylistsList();
          }

          feed._lastSig = '';
          if (typeof renderSidebarLibraryFeed === 'function') {
            renderSidebarLibraryFeed(false);
          }
        }
      });
    }

    const btnSbPresets = document.getElementById('btn-sb-presets');
    const btnSbNewPl = document.getElementById('btn-sb-new-playlist');
    const btnSbSettings = document.getElementById('btn-sb-settings');

    if (btnSbPresets) {
      btnSbPresets.addEventListener('click', (e) => {
        e.stopPropagation();
        openDrawerState = openDrawerState === 'presets' ? null : 'presets';
        applyDrawerState(btnSbPresets);
      });
    }
    if (btnSbNewPl) {
      btnSbNewPl.addEventListener('click', (e) => {
        e.stopPropagation();
        setCpmTab('new', false);
        if (el.btnNewPlaylist) el.btnNewPlaylist.click();
      });
    }
    if (btnSbSettings) {
      btnSbSettings.addEventListener('click', (e) => {
        e.stopPropagation();
        switchView('settings');
      });
    }

    function updateSidebarSplitCovers() {
      const urls = [];
      const pushFromList = (list) => {
        if (!Array.isArray(list)) return;
        for (const item of list) {
          if (urls.length >= 4) break;
          if (!item) continue;
          const u = (typeof getTrackThumbUrl === 'function') ? getTrackThumbUrl(item) : (item.thumbnail || item.cover || '');
          if (u && !urls.includes(u)) {
            urls.push(u);
          }
        }
      };

      pushFromList(state.favorites);
      if (urls.length < 4 && typeof myWaveCurrentTracks !== 'undefined') pushFromList(myWaveCurrentTracks);
      if (urls.length < 4 && Array.isArray(state.history)) pushFromList(state.history);

      const firstCover = urls[0] || '';

      for (let i = 1; i <= 4; i++) {
        const img = document.getElementById(`sb-split-img-${i}`);
        if (!img) continue;
        const url = urls[i - 1] || firstCover;
        if (url) {
          if (img.getAttribute('src') !== url) {
            img.src = url;
          }
          img.style.display = 'block';
          img.onerror = () => {
            img.onerror = null;
            if (firstCover && img.src !== firstCover) {
              img.src = firstCover;
            } else {
              img.style.display = 'none';
            }
          };
        } else {
          img.style.display = 'none';
        }
      }
    }
    window.updateSidebarSplitCovers = updateSidebarSplitCovers;

    const btnSbRadio = document.getElementById('btn-sb-banner-radio');
    if (btnSbRadio) {
      btnSbRadio.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        playMyWave();
      });
    }

    updateSidebarSplitCovers();

    const EXPAND_THRESHOLD = 180;
    const applySidebarWidth = (w, save = false) => {
      if (w >= EXPAND_THRESHOLD) {
        const clamped = Math.max(256, Math.min(390, Math.round(w)));
        document.documentElement.style.setProperty('--sidebar-w', `${clamped}px`);
        document.body.classList.add('sidebar-expanded');
        renderSidebarLibraryFeed();
        if (typeof window.syncSidebarLibTabs === 'function') {
          requestAnimationFrame(window.syncSidebarLibTabs);
        }
        if (save) localStorage.setItem('riff_sidebar_width', String(clamped));
      } else {
        document.documentElement.style.setProperty('--sidebar-w', '84px');
        document.body.classList.remove('sidebar-expanded');
        const sheet = document.getElementById('sb-inline-presets-sheet');
        if (sheet) sheet.classList.remove('open');
        if (save) localStorage.setItem('riff_sidebar_width', '84');
        requestAnimationFrame(() => {
          updateNavIndicator(false);
          if (typeof resizeCanvases === 'function') resizeCanvases();
        });
      }
      if (typeof window.syncSidebarLibTabs === 'function') {
        requestAnimationFrame(window.syncSidebarLibTabs);
      }
      if (typeof resizeCanvases === 'function') requestAnimationFrame(resizeCanvases);
    };

    if (localStorage.getItem('riff_sidebar_default_wide_v2') !== '1') {
      localStorage.setItem('riff_sidebar_default_wide_v2', '1');
      localStorage.setItem('riff_sidebar_width', '288');
    }
    const savedW = parseInt(localStorage.getItem('riff_sidebar_width') || '288', 10);
    applySidebarWidth(savedW, false);

    let startX = 0, startW = 84, dragging = false;
    edge.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      dragging = true;
      startX = e.clientX;
      startW = sidebar.getBoundingClientRect().width;
      edge.setPointerCapture(e.pointerId);
      edge.classList.add('dragging');
      document.body.classList.add('is-resizing-panel');
      e.preventDefault();
    });

    edge.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      applySidebarWidth(startW + (e.clientX - startX), false);
    });

    const endDrag = (e) => {
      if (!dragging) return;
      dragging = false;
      try { edge.releasePointerCapture(e.pointerId); } catch (_) {}
      edge.classList.remove('dragging');
      document.body.classList.remove('is-resizing-panel');
      const finalW = document.body.classList.contains('sidebar-expanded')
        ? parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-w'), 10) || 288
        : 84;
      applySidebarWidth(finalW, true);
    };
    edge.addEventListener('pointerup', endDrag);
    edge.addEventListener('pointercancel', endDrag);

    edge.addEventListener('dblclick', () => {
      const isExp = document.body.classList.contains('sidebar-expanded');
      applySidebarWidth(isExp ? 84 : 288, true);
    });

    const tabsWrap = document.getElementById('sidebar-lib-chips');
    if (tabsWrap) tabsWrap.style.display = 'none';

    let iconTabsWrap = document.getElementById('sb-lib-tabs-icons');
    if (!iconTabsWrap) {
      const searchWrap = document.getElementById('sb-lib-search-wrap');
      if (searchWrap) {
        iconTabsWrap = document.createElement('div');
        iconTabsWrap.id = 'sb-lib-tabs-icons';
        iconTabsWrap.className = 'sb-lib-tabs-icons';
        iconTabsWrap.innerHTML = `
          <button type="button" class="sb-lib-icon-tab active" data-lib-filter="playlists" title="Playlists / Home" aria-label="Playlists">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M4,19V10Q4,9.52 4.21,9.1Q4.43,8.67 4.8,8.4l6-4.5Q11.33,3.5 12,3.5t1.2,0.4l6,4.5q0.38,0.28 0.59,0.7Q20,9.52 20,10v9q0,0.82-0.59,1.41T18,21H15q-0.42,0-0.71-0.29Q14,20.43 14,20V15q0-0.43-0.29-0.71T13,14H11q-0.42,0-0.71,0.29T10,15v5q0,0.43-0.29,0.71T9,21H6q-0.82,0-1.41-0.59T4,19Z"/></svg>
          </button>
          <button type="button" class="sb-lib-icon-tab" data-lib-filter="albums" title="Albums" aria-label="Albums">
            <span class="material-symbols-rounded">library_music</span>
          </button>
          <button type="button" class="sb-lib-icon-tab" data-lib-filter="queue" title="Queue" aria-label="Queue">
            <span class="material-symbols-rounded">queue_music</span>
          </button>
        `;
        searchWrap.insertAdjacentElement('afterend', iconTabsWrap);
      }
    }

    const iconTabBtns = iconTabsWrap ? Array.from(iconTabsWrap.querySelectorAll('.sb-lib-icon-tab')) : [];
    const syncActiveIconTabs = () => {
      iconTabBtns.forEach((b) => {
        b.classList.toggle('active', b.dataset.libFilter === currentSidebarLibFilter);
      });
      const legacyBtns = tabsWrap ? Array.from(tabsWrap.querySelectorAll('.sb-horiz-tab')) : [];
      legacyBtns.forEach(b => b.classList.toggle('active', b.dataset.libFilter === currentSidebarLibFilter));
    };
    iconTabBtns.forEach((tabBtn) => {
      tabBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        currentSidebarLibFilter = tabBtn.dataset.libFilter || 'playlists';
        syncActiveIconTabs();
        const f = document.getElementById('sidebar-library-feed');
        if (f) f._lastSig = '';
        renderSidebarLibraryFeed(true);
      });
    });
    syncActiveIconTabs();
    window.syncSidebarLibTabs = syncActiveIconTabs;

    window.applySidebarWidth = applySidebarWidth;

    const btnSbCollapse = document.getElementById('btn-sb-collapse');
    if (btnSbCollapse) {
      btnSbCollapse.addEventListener('click', (e) => {
        e.stopPropagation();
        applySidebarWidth(84, true);
      });
    }

    let btnRailExpandLib = document.getElementById('btn-rail-expand-lib');
    if (!btnRailExpandLib) {
      const railActionGroup = document.querySelector('.rail-action-group');
      if (railActionGroup) {
        btnRailExpandLib = document.createElement('button');
        btnRailExpandLib.className = 'rail-icon-btn';
        btnRailExpandLib.id = 'btn-rail-expand-lib';
        btnRailExpandLib.title = typeof t === 'function' ? t('Expand Your Library') : 'Expand Your Library';
        btnRailExpandLib.setAttribute('aria-label', 'Expand Your Library');
        btnRailExpandLib.setAttribute('type', 'button');
        btnRailExpandLib.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <line x1="9" y1="3" x2="9" y2="21"/>
            <polyline points="11 9 14 12 11 15"/>
          </svg>
        `;
        railActionGroup.insertBefore(btnRailExpandLib, railActionGroup.firstChild);
      }
    }
    if (btnRailExpandLib) {
      btnRailExpandLib.addEventListener('click', (e) => {
        if (!document.body.classList.contains('sidebar-expanded')) {
          e.stopPropagation();
          e.preventDefault();
          const prevW = parseInt(localStorage.getItem('riff_sidebar_width') || '288', 10);
          applySidebarWidth(prevW > 84 ? prevW : 288, true);
        }
      }, true);
    }

    const btnCreatePill = document.getElementById('btn-sb-create-pill');
    const createPopover = document.getElementById('sb-create-popover');
    if (createPopover) createPopover.classList.add('hidden');
    if (btnCreatePill) {
      btnCreatePill.addEventListener('click', (e) => {
        showInAppContextMenu(e, [
          {
            label: 'Create playlist',
            icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
            action: () => {
              const cpm = document.getElementById('create-playlist-modal');
              if (cpm) {
                setCpmTab('new', false);
                openModal(cpm);
              }
            }
          },
          {
            label: 'Import playlist',
            icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
            action: () => {
              const cpm = document.getElementById('create-playlist-modal');
              if (cpm) {
                setCpmTab('import', false);
                openModal(cpm);
              }
            }
          },
          {
            label: 'Pin current track',
            icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 17v5"/><path d="M9 3h6l-1 7 3 3v2H7v-2l3-3-1-7z"/></svg>',
            action: () => {
              if (state.currentTrack) togglePinTrackToSidebar(state.currentTrack);
              else showToast(typeof t === 'function' ? t('No track playing') : 'No track playing', 'info');
            }
          }
        ]);
      });
    }

    const promoCard = document.getElementById('sb-import-promo-card');
    if (promoCard) {
      if (localStorage.getItem('riff_sb_promo_dismissed_v1') === '1') {
        promoCard.classList.add('hidden');
      }
      const btnClosePromo = document.getElementById('btn-close-sb-import-promo');
      if (btnClosePromo) {
        btnClosePromo.addEventListener('click', (e) => {
          e.stopPropagation();
          localStorage.setItem('riff_sb_promo_dismissed_v1', '1');
          promoCard.classList.add('hidden');
        });
      }
      const btnOpenPromo = document.getElementById('btn-sb-import-promo-open');
      if (btnOpenPromo) {
        btnOpenPromo.addEventListener('click', (e) => {
          e.stopPropagation();
          const cpm = document.getElementById('create-playlist-modal');
          if (cpm) {
            setCpmTab('import', false);
            openModal(cpm);
          }
        });
      }
    }

    const btnSbSearch = document.getElementById('btn-sb-lib-search');
    const searchWrap = document.getElementById('sb-lib-search-wrap');
    const searchInput = document.getElementById('sb-lib-search-input');
    const btnSbSort = document.getElementById('btn-sb-lib-sort');
    const sortLabel = document.getElementById('sb-lib-sort-label');

    function applySidebarLibFilter() {
      const q = (searchInput?.value || '').trim().toLowerCase();
      const f = document.getElementById('sidebar-library-feed');
      if (!f) return;
      const rows = f.querySelectorAll('.sb-lib-row');
      let visibleCount = 0;
      rows.forEach(r => {
        if (!q) {
          r.style.display = '';
          visibleCount++;
        } else {
          const title = r.querySelector('.sb-lib-title')?.textContent?.toLowerCase() || '';
          const sub = r.querySelector('.sb-lib-sub')?.textContent?.toLowerCase() || '';
          const match = title.includes(q) || sub.includes(q);
          r.style.display = match ? '' : 'none';
          if (match) visibleCount++;
        }
      });
      f.classList.toggle('sb-feed-sparse', visibleCount <= 4);
    }
    window.applySidebarLibFilter = applySidebarLibFilter;

    const updateSidebarSortWidth = () => {
      if (!btnSbSort || !searchWrap) return;
      const w = btnSbSort.offsetWidth || 76;
      searchWrap.style.setProperty('--sb-sort-w', `${w + 8}px`);
    };

    if (btnSbSearch && searchWrap && searchInput) {
      btnSbSearch.addEventListener('click', (e) => {
        e.stopPropagation();
        updateSidebarSortWidth();
        const isOpen = searchWrap.classList.toggle('sb-search-open');
        if (isOpen) {
          searchInput.focus();
        } else {
          if (searchInput.value) {
            searchInput.value = '';
            applySidebarLibFilter();
          }
        }
      });

      searchInput.addEventListener('input', () => {
        applySidebarLibFilter();
      });

      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          searchInput.value = '';
          searchWrap.classList.remove('sb-search-open');
          applySidebarLibFilter();
          searchInput.blur();
        }
      });

      document.addEventListener('pointerdown', (e) => {
        if (!searchWrap.classList.contains('sb-search-open')) return;
        if (searchWrap.contains(e.target) || (btnSbSearch && btnSbSearch.contains(e.target))) return;
        if (!searchInput.value.trim()) {
          searchWrap.classList.remove('sb-search-open');
          searchInput.blur();
        }
      });
    }

    const updateSortLabel = () => {
      const mode = localStorage.getItem('riff_sb_lib_sort') || 'Recents';
      if (sortLabel) sortLabel.textContent = typeof t === 'function' ? t(mode) : mode;
      updateSidebarSortWidth();
    };
    updateSortLabel();

    const checkSvg = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px;flex-shrink:0;"><polyline points="20 6 9 17 4 12"/></svg>';
    const emptySpacer = '<span style="display:inline-block;width:15px;margin-right:8px;flex-shrink:0;"></span>';

    const setSortMode = (mode) => {
      localStorage.setItem('riff_sb_lib_sort', mode);
      updateSortLabel();
      const f = document.getElementById('sidebar-library-feed');
      if (f) f._lastSig = '';
      renderSidebarLibraryFeed(false);
    };

    if (btnSbSort) {
      btnSbSort.addEventListener('click', (e) => {
        e.stopPropagation();
        const curMode = localStorage.getItem('riff_sb_lib_sort') || 'Recents';
        const sortOptions = [
          {
            label: 'Recents',
            active: curMode === 'Recents',
            icon: curMode === 'Recents' ? checkSvg : emptySpacer,
            action: () => setSortMode('Recents')
          },
          {
            label: 'Recently Added',
            active: curMode === 'Recently Added',
            icon: curMode === 'Recently Added' ? checkSvg : emptySpacer,
            action: () => setSortMode('Recently Added')
          },
          {
            label: 'Alphabetical',
            active: curMode === 'Alphabetical',
            icon: curMode === 'Alphabetical' ? checkSvg : emptySpacer,
            action: () => setSortMode('Alphabetical')
          },
          {
            label: 'Custom',
            active: curMode === 'Custom',
            icon: curMode === 'Custom' ? checkSvg : emptySpacer,
            action: () => setSortMode('Custom')
          }
        ];
        showInAppContextMenu(e, sortOptions);
      });
    }
  }


  function setOfflineBannerVisible(offline) {
    const banner = document.getElementById('offline-top-banner');
    if (banner) {
      banner.classList.toggle('hidden', !offline);
    }
  }
  window.setOfflineBannerVisible = setOfflineBannerVisible;

  async function checkAndShowOfflineMode(isStartup = false) {
    const modal = document.getElementById('offline-mode-modal');
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setOfflineBannerVisible(true);
      if (modal) openModal(modal);
      return;
    }
    try {
      const port = state.serverPort || 38472;
      const res = await fetch(`http://127.0.0.1:${port}/api/net-check`);
      const data = await res.json();
      if (data && data.online === false) {
        setOfflineBannerVisible(true);
        if (modal) openModal(modal);
      } else if (data && data.online) {
        setOfflineBannerVisible(false);
      }
    } catch (_) {
      if (!isStartup) {
        setOfflineBannerVisible(true);
        if (modal) openModal(modal);
      }
    }
  }

  async function verifyOnlineConnection() {
    try {
      const port = state.serverPort || 38472;
      const res = await fetch(`http://127.0.0.1:${port}/api/net-check`, { signal: AbortSignal.timeout(4500) });
      const data = await res.json();
      if (data && data.online) return true;
    } catch (_) {}
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const directRes = await fetch('https://itunes.apple.com/search?term=a&limit=1', { signal: AbortSignal.timeout(3500) });
        if (directRes.ok) return true;
      } catch (_) {}
    }
    return false;
  }

  function reloadOnlineContentAfterReconnect() {
    const modal = document.getElementById('offline-mode-modal');
    setOfflineBannerVisible(false);
    if (modal) closeModal(modal);
    ['sp-made', 'sp-trend', 'sp-chart', 'sp-artists'].forEach(id => {
      const node = document.getElementById(id);
      if (node) node._lastHomeSig = '';
    });
    fetchPersonalVibe(true).catch(() => {});
    if (typeof renderSpotifyHome === 'function') renderSpotifyHome();
    if (typeof renderTrending === 'function') renderTrending();
    if (typeof loadCountryChart === 'function') loadCountryChart(true);
    if (typeof generateDailyMixes === 'function') generateDailyMixes(false);
    const activeSearch = (el.searchInput && el.searchInput.value.trim()) || state.searchQuery || '';
    if (activeSearch && state.currentView === 'discover' && el.searchResultsContainer && !el.searchResultsContainer.classList.contains('hidden')) {
      performSearch(activeSearch);
    }
  }

  function initOfflineMode() {
    const modal = document.getElementById('offline-mode-modal');
    const btnOk = document.getElementById('btn-offline-ok');
    const btnRetry = document.getElementById('btn-offline-retry');
    const btnTopRetry = document.getElementById('btn-offline-top-retry');

    if (btnOk && modal) {
      btnOk.addEventListener('click', () => {
        closeModal(modal);
        switchView('local');
      });
    }

    const handleOfflineRetryClick = async (btnEl) => {
      if (btnEl) btnEl.disabled = true;
      try {
        const isOnline = await verifyOnlineConnection();
        if (isOnline) {
          reloadOnlineContentAfterReconnect();
          if (state.currentView === 'local') goHome();
          showToast(typeof t === 'function' ? t('Connected') : 'Connected', 'success');
        } else {
          setOfflineBannerVisible(true);
          showToast(typeof t === 'function' ? t('Still offline') : 'Still offline', 'warning');
        }
      } catch (_) {
        setOfflineBannerVisible(true);
        showToast(typeof t === 'function' ? t('Still offline') : 'Still offline', 'warning');
      } finally {
        if (btnEl) btnEl.disabled = false;
      }
    };

    if (btnRetry) {
      btnRetry.addEventListener('click', () => handleOfflineRetryClick(btnRetry));
    }

    if (btnTopRetry) {
      btnTopRetry.addEventListener('click', () => handleOfflineRetryClick(btnTopRetry));
    }

    window.addEventListener('offline', () => {
      setOfflineBannerVisible(true);
      checkAndShowOfflineMode(false);
    });

    window.addEventListener('online', async () => {
      const ok = await verifyOnlineConnection();
      if (ok) reloadOnlineContentAfterReconnect();
    });

    checkAndShowOfflineMode(true);
  }


  function deduplicateSidebarNavIcons() {
    const curPack = localStorage.getItem('riff_icon_pack') || 'material';
    const isMaterial = curPack.startsWith('material');
    document.querySelectorAll('.sidebar-nav .nav-item .nav-indicator').forEach(indicator => {
      const msIcons = Array.from(indicator.querySelectorAll('.ms-injected-icon, [class*="material-symbols-"]'));
      if (msIcons.length > 1) {
        for (let i = 1; i < msIcons.length; i++) msIcons[i].remove();
      }
      const svgs = Array.from(indicator.querySelectorAll('svg'));
      if (svgs.length > 1) {
        for (let i = 1; i < svgs.length; i++) svgs[i].remove();
      }
      if (!isMaterial || msIcons.length === 0) {
        if (!isMaterial) msIcons.forEach(icon => icon.remove());
        if (svgs[0]) svgs[0].style.removeProperty('display');
      } else {
        if (svgs[0]) svgs[0].style.setProperty('display', 'none', 'important');
      }
    });
  }
  window.deduplicateSidebarNavIcons = deduplicateSidebarNavIcons;

  function cleanSidebarNavIcons() {
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
      Array.from(item.children).forEach(child => {
        if (child.tagName && (child.tagName.toLowerCase() === 'svg' || child.classList.contains('material-symbols-outlined') || child.classList.contains('ms-injected-icon') || child.tagName.toLowerCase() === 'i')) {
          child.remove();
        }
      });
    });
    deduplicateSidebarNavIcons();
  }


  cleanSidebarNavIcons();
  initHomeHero();
  applyHomeLayout();
  requestAnimationFrame(() => {
    document.body?.classList.remove('app-skeleton-boot');
  });
  applySidebarOrder();
  applyHomeSectionsOrder();
  initSidebarOrderCustomizer();
  initSidebarResizeAndLibrary();
  initOfflineMode();
  initLyricsCallout();
  syncOnboardingCallouts();
  initLyricsWarningsSetting();
  if (!state.currentTrack) {
    const saved = safeJson('riff_last_playback_state', null);
    const restoreTrack = (saved && saved.track && saved.track.title) ? saved.track : ((state.history && state.history[0]) || null);
    if (restoreTrack) {
      state.currentTrack = restoreTrack;
      state.queue = (saved && Array.isArray(saved.queue) && saved.queue.length) ? saved.queue : [restoreTrack];
      state.queueIndex = (saved && saved.queueIndex >= 0 && saved.queueIndex < state.queue.length) ? saved.queueIndex : 0;
      state.isPlaying = false;
      state._pendingResumeTime = (saved && saved.currentTime > 2) ? saved.currentTime : 0;
      updateNowPlayingUI(restoreTrack);
      updateQueueBadge();
      if (state._pendingResumeTime > 0 && restoreTrack.duration > 0) {
        if (el.timeCurrent) el.timeCurrent.textContent = formatDuration(state._pendingResumeTime);
        scrubProgress = Math.max(0, Math.min(1, state._pendingResumeTime / restoreTrack.duration));
        hasDrawnPausedFrame = false;
        startVisualizers();
      }
      loadSyncedLyrics(restoreTrack.title, restoreTrack.artist, state.loadToken);
    }
  }
  if (typeof dismissBootSkeleton === 'function') dismissBootSkeleton();
  renderBlockedItemsSettings();
  initSearchFilterChips();
  initSearchHistory();
  initQueuePanel();
  initSpotifyPromo();
  initMouseNavInterceptor();
  initDesktopShortcutSetting();
  initDefaultSettingsStudio();
  initLikeAlbumTracksSetting();
  resizeCanvases();
  updateOfflineStorageUI();
  updateMusicFolderUI();
  updateDownloadFolderUI();
  if (!state.currentTrack) setLyricsEmpty(true);
  updateLyricsTranslationUI();
  applyCustomStyles();
  initProxyManager();
  initSongQualitySetting();
  var initCat = localStorage.getItem('riff_settings_cat');
  if (initCat && initCat !== 'overview') {
    try { localStorage.setItem('riff_settings_cat', initCat); } catch (_) {}
  }
  refreshStacks();
  requestAnimationFrame(() => requestAnimationFrame(refreshStacks));
  initTvk();
  if (typeof m3cInit === 'function') m3cInit();
  requestAnimationFrame(() => requestAnimationFrame(() => updateNavIndicator(false)));

  var heroBanner = document.querySelector('.riff-hero-banner');
  if (heroBanner) {
    heroBanner.addEventListener('pointermove', (e) => {
      if (document.body.classList.contains('perf')) return;
      const rect = heroBanner.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const px = Math.max(-1, Math.min(1, ((e.clientX - rect.left) / rect.width) * 2 - 1));
      const py = Math.max(-1, Math.min(1, ((e.clientY - rect.top) / rect.height) * 2 - 1));
      heroBanner.style.setProperty('--px', px);
      heroBanner.style.setProperty('--py', py);
    });
    heroBanner.addEventListener('pointerleave', () => {
      if (document.body.classList.contains('perf')) return;
      heroBanner.style.setProperty('--px', 0);
      heroBanner.style.setProperty('--py', 0);
    });
  }

    var positionPillIndicator = (container, ind, activeBtn) => {
      if (!container || container.offsetParent === null) {
        return;
      }
      if (!activeBtn || activeBtn.offsetWidth === 0 || activeBtn.offsetHeight === 0) {
        ind.style.opacity = '0';
        ind.classList.remove('ready');
        ind._wasVisible = false;
        return;
      }
      const x = activeBtn.offsetLeft;
      const y = activeBtn.offsetTop;
      const w = activeBtn.offsetWidth;
      const h = activeBtn.offsetHeight;
      if (!ind._wasVisible) {
        ind.classList.add('no-anim');
        ind.style.width = `${w}px`;
        ind.style.height = `${h}px`;
        ind.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        ind.style.opacity = '1';
        ind.classList.add('ready');
        void ind.offsetWidth;
        ind.classList.remove('no-anim');
        ind._wasVisible = true;
      } else {
        ind.style.width = `${w}px`;
        ind.style.height = `${h}px`;
        ind.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        ind.style.opacity = '1';
        ind.classList.add('ready');
      }
    };

    var syncSlidingIndicators = () => {
      const viewSettings = document.getElementById('view-settings');
      const settingsOpen = viewSettings && viewSettings.classList.contains('active') && viewSettings.classList.contains('modal-open');
      const nav = document.getElementById('settings-nav');
      if (nav) {
        let ind = nav.querySelector('#settings-nav-active-pill');
        if (!ind) {
          ind = document.createElement('div');
          ind.id = 'settings-nav-active-pill';
          ind.className = 'settings-nav-active-pill';
          nav.prepend(ind);
        }
        if (!settingsOpen) {
          ind._wasVisible = false;
          ind.style.opacity = '0';
          ind.classList.remove('ready');
        } else {
          const activeBtn = nav.querySelector('.settings-nav-btn.active');
          positionPillIndicator(nav, ind, activeBtn);
        }
      }

      document.querySelectorAll('#speed-preset-pills, .speed-preset-pills, .hq-presets-chips').forEach(group => {
        let ind = group.querySelector('.speed-pill-sliding-indicator');
        if (!ind) {
          ind = document.createElement('div');
          ind.className = 'speed-pill-sliding-indicator';
          group.prepend(ind);
        }
        const activeBtn = group.querySelector('.speed-pill-btn.active, .hq-preset-chip.active');
        positionPillIndicator(group, ind, activeBtn);
      });

      document.querySelectorAll('.audio-tab-sliding-indicator').forEach(n => n.remove());
    };

     
    document.getElementById('setting-art-font-row')?.remove();
    document.getElementById('btn-art-font')?.closest('.setting-item')?.remove();
    document.body.classList.remove('art-font-on');

    var ensureCompactFavIcon = () => {
      const favBtn = document.getElementById('nav-favorites');
      if (!favBtn) return;
      favBtn.classList.remove('nav-collapsed');
      ['display', 'opacity', 'visibility', 'transform'].forEach(p => favBtn.style.removeProperty(p));
      let ind = favBtn.querySelector('.nav-indicator');
      if (!ind) {
        ind = document.createElement('div');
        ind.className = 'nav-indicator';
        favBtn.prepend(ind);
      }
      ['display', 'opacity', 'visibility', 'transform', 'color'].forEach(p => ind.style.removeProperty(p));
      let svg = ind.querySelector('svg');
      if (!svg) {
        svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '24');
        svg.setAttribute('height', '24');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');
        svg.innerHTML = '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>';
        ind.prepend(svg);
      } else {
        ['opacity', 'visibility', 'transform', 'color'].forEach(p => svg.style.removeProperty(p));
      }
      const pack = document.body.getAttribute('data-icon-pack') || localStorage.getItem('riff_icon_pack') || 'material';
      if (pack.startsWith('material')) {
        let ms = ind.querySelector('.ms-injected-icon');
        if (!ms) {
          ms = document.createElement('span');
          ind.appendChild(ms);
        }
        const msClass = pack === 'material-sharp' ? 'material-symbols-sharp' : (pack === 'material' ? 'material-symbols-outlined' : 'material-symbols-rounded');
        ms.className = `ms-injected-icon ${msClass}`;
        ms.textContent = 'favorite';
        ['display', 'opacity', 'visibility', 'transform', 'color', 'font-size', 'font-variation-settings'].forEach(p => ms.style.removeProperty(p));
      }
    };
    ensureCompactFavIcon();
    setTimeout(ensureCompactFavIcon, 250);

    window.syncSpeedPillsIndicator = syncSlidingIndicators;
    window.syncSettingsNavIndicator = syncSlidingIndicators;

    var handleIndicatorClick = (e) => {
      const spBtn = e.target.closest('#speed-preset-pills .speed-pill-btn, .speed-pill-btn');
      if (spBtn && spBtn.dataset.speedVal) {
        const targetVal = parseFloat(spBtn.dataset.speedVal);
        if (Math.abs(getEffectiveSpeed() - targetVal) >= 0.005) {
          setUnifiedSpeed(targetVal);
        }
      }
      syncSlidingIndicators();
      requestAnimationFrame(syncSlidingIndicators);
    };
    document.addEventListener('click', handleIndicatorClick, false);
    var audioCardForInd = document.querySelector('.audio-menu-card');
    if (audioCardForInd) {
      audioCardForInd.addEventListener('click', handleIndicatorClick, false);
      audioCardForInd.addEventListener('input', () => syncSlidingIndicators(), false);
    }
    document.addEventListener('input', () => {
      syncSlidingIndicators();
    }, false);
    window.addEventListener('resize', () => requestAnimationFrame(syncSlidingIndicators));

    var viewSettingsEl = document.getElementById('view-settings');
    if (viewSettingsEl) {
      new MutationObserver(() => {
        requestAnimationFrame(syncSlidingIndicators);
      }).observe(viewSettingsEl, { attributes: true, attributeFilter: ['class'] });
    }
    var audioMenuCardEl = document.querySelector('.audio-menu-card');
    if (audioMenuCardEl) {
      new MutationObserver(() => {
        if (!audioMenuCardEl.classList.contains('connected-editor') && (!el.audioSettingsModal || el.audioSettingsModal.classList.contains('hidden'))) {
          audioMenuCardEl.querySelectorAll('.speed-pill-sliding-indicator, .audio-tab-sliding-indicator').forEach(i => { i._wasVisible = false; });
        } else {
          requestAnimationFrame(syncSlidingIndicators);
        }
      }).observe(audioMenuCardEl, { attributes: true, attributeFilter: ['class'] });
    }

     
    var autoCollapsed = false;
    var checkAutoCompactSidebar = () => {
      if (typeof window.applySidebarWidth !== 'function') return;
      if (window.innerWidth <= 980) {
        if (document.body.classList.contains('sidebar-expanded')) {
          autoCollapsed = true;
          window.applySidebarWidth(84, false);
        }
      } else if (autoCollapsed) {
        autoCollapsed = false;
        const w = parseInt(localStorage.getItem('riff_sidebar_width') || '288', 10);
        if (w >= 180) window.applySidebarWidth(w, false);
      }
    };
    window.addEventListener('resize', checkAutoCompactSidebar);
    checkAutoCompactSidebar();

     
    localStorage.removeItem('riff_tvk_viscosity');
    var oldViscSlider = document.getElementById('tvk-viscosity');
    if (oldViscSlider) {
      const row = oldViscSlider.closest('.tvk-row');
      if (row) row.remove();
    }

     
    var syncYtAccountBadge = async () => {
      if (!state.serverPort) return;
      try {
        const res = await fetch(`http://127.0.0.1:${state.serverPort}/api/youtube-account-info`).then(r => r.json()).catch(() => null);
        if (res && res.loggedIn) {
          const u = res.user || {};
          const badgeHtml = (u.name || u.avatar) ? `
            <span class="yt-auth-user-badge">
              ${u.avatar ? `<img class="yt-auth-avatar" src="${escapeHtml(u.avatar)}" alt="" onerror="this.style.display='none'">` : ''}
              <span class="yt-auth-user-text">
                <span class="yt-auth-user-name">${escapeHtml(u.name || 'YouTube')}</span>
                ${u.handle ? `<span class="yt-auth-user-handle">${escapeHtml(u.handle)}</span>` : ''}
              </span>
            </span>
          ` : escapeHtml(t('Connected to YouTube'));
          ['yt-playback-auth-status', 'adv-yt-auth-status', 'google-login-status'].forEach(id => {
            const node = document.getElementById(id);
            if (node) {
              node.innerHTML = badgeHtml;
              node.style.color = 'var(--md-sys-color-primary)';
            }
          });
          document.getElementById('btn-adv-yt-logout')?.classList.remove('hidden');
          document.getElementById('btn-google-logout')?.classList.remove('hidden');
        }
      } catch (_) {}
    };
    setTimeout(syncYtAccountBadge, 600);

    var handleBrowserCookieSync = async (btnEl) => {
      if (!state.serverPort) return;
      if (btnEl) btnEl.disabled = true;
      showToast(t('Importing YouTube session from browser...'), 'info');
      try {
        const res = await fetch(`http://127.0.0.1:${state.serverPort}/api/yt-cookies-from-browser`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }).then(r => r.json());
        if (res && res.success) {
          await syncYtAccountBadge();
          showToast(`Connected YouTube account (${res.browser || 'browser'})`, 'success');
        } else {
          showToast((res && res.error) || 'Could not import YouTube cookies from browser', 'error');
        }
      } catch (err) {
        showToast('Failed to import browser cookies', 'error');
      } finally {
        if (btnEl) btnEl.disabled = false;
      }
    };

    ['btn-adv-yt-browser-sync', 'btn-google-browser-sync'].forEach(id => {
      const b = document.getElementById(id);
      if (b) b.addEventListener('click', () => handleBrowserCookieSync(b));
    });

     
    var CHART_COUNTRIES = [
      { code: 'ua', name: 'Ukraine', ru: 'Украина', uk: 'Україна' },
      { code: 'ru', name: 'Russia', ru: 'Россия', uk: 'Росія' },
      { code: 'us', name: 'United States', ru: 'США', uk: 'США' },
      { code: 'gb', name: 'United Kingdom', ru: 'Великобритания', uk: 'Велика Британія' },
      { code: 'de', name: 'Germany', ru: 'Германия', uk: 'Німеччина' },
      { code: 'fr', name: 'France', ru: 'Франция', uk: 'Франція' },
      { code: 'pl', name: 'Poland', ru: 'Польша', uk: 'Польща' },
      { code: 'kz', name: 'Kazakhstan', ru: 'Казахстан', uk: 'Казахстан' },
      { code: 'jp', name: 'Japan', ru: 'Япония', uk: 'Японія' },
      { code: 'kr', name: 'South Korea', ru: 'Южная Корея', uk: 'Південна Корея' },
      { code: 'br', name: 'Brazil', ru: 'Бразилия', uk: 'Бразилія' },
      { code: 'es', name: 'Spain', ru: 'Испания', uk: 'Іспанія' },
      { code: 'it', name: 'Italy', ru: 'Италия', uk: 'Італія' },
      { code: 'tr', name: 'Turkey', ru: 'Турция', uk: 'Туреччина' },
      { code: 'global', name: 'Global', ru: 'Мир', uk: 'Світ' }
    ];
    var getCountryLabel = (code) => {
      const lang = (localStorage.getItem('riff_ui_lang') || 'en').toLowerCase();
      const c = CHART_COUNTRIES.find(x => x.code === code) || CHART_COUNTRIES[0];
      return (lang === 'ru' && c.ru) ? c.ru : ((lang === 'uk' && c.uk) ? c.uk : c.name);
    };

    var currentTopChartTracks = [];
    var currentHomeCategoryType = null;

    var closeSpHomeCategory = () => {
      currentHomeCategoryType = null;
      const catEl = document.getElementById('sp-category-detail');
      const spHome = document.getElementById('sp-home');
      if (catEl) catEl.classList.add('hidden');
      if (spHome) spHome.classList.remove('hidden');
    };
    window.closeSpHomeCategory = closeSpHomeCategory;

    var openSpHomeCategory = (secId) => {
      const spHome = document.getElementById('sp-home');
      const discoverHome = document.getElementById('discover-home') || spHome?.parentElement;
      if (!spHome || !discoverHome) return;

      let catEl = document.getElementById('sp-category-detail');
      if (!catEl) {
        catEl = document.createElement('div');
        catEl.id = 'sp-category-detail';
        catEl.className = 'sp-category-detail hidden';
        catEl.innerHTML = `
          <div class="artist-category-header">
            <button type="button" class="btn-icon-pill btn-back-artist-cat" id="btn-back-sp-cat" aria-label="Back">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <div class="artist-category-info">
              <h2 class="artist-category-title" id="sp-category-title"></h2>
              <span class="artist-category-sub" id="sp-category-sub"></span>
            </div>
          </div>
          <div class="artist-category-body">
            <div class="tracks-list" id="sp-cat-tracks-list"></div>
            <div class="sp-cat-cards-grid hidden" id="sp-cat-cards-grid"></div>
          </div>
        `;
        discoverHome.appendChild(catEl);
        catEl.querySelector('#btn-back-sp-cat')?.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          closeSpHomeCategory();
        });
      }

      currentHomeCategoryType = secId;
      spHome.classList.add('hidden');
      catEl.classList.remove('hidden');

      const titleEl = catEl.querySelector('#sp-category-title');
      const subEl = catEl.querySelector('#sp-category-sub');
      const tracksEl = catEl.querySelector('#sp-cat-tracks-list');
      const gridEl = catEl.querySelector('#sp-cat-cards-grid');

      if (secId === 'sp-quick-sec') {
        if (titleEl) titleEl.textContent = t('Jump back in') || 'Recently played';
        const recent = (state.history || []).filter(Boolean).slice(0, 50);
        if (subEl) subEl.textContent = `${recent.length} tracks`;
        if (gridEl) gridEl.classList.add('hidden');
        if (tracksEl) {
          tracksEl.classList.remove('hidden');
          renderTracks(tracksEl, recent, 'history');
        }
      } else if (secId === 'sp-trend-sec') {
        if (titleEl) titleEl.textContent = t('Trending now') || 'Trending now';
        const region = detectUserMusicRegion();
        const cached = (window.HomeCache && window.HomeCache.get('home_trending')) || safeJson('riff_trending_cache', null)?.tracks || [];
        if (subEl) subEl.textContent = `${cached.length} tracks`;
        if (gridEl) gridEl.classList.add('hidden');
        if (tracksEl) {
          tracksEl.classList.remove('hidden');
          renderTracks(tracksEl, cached, 'search');
        }
      } else if (secId === 'sp-chart-sec') {
        const country = localStorage.getItem('riff_chart_country') || 'ua';
        if (titleEl) titleEl.textContent = `${t('Top chart') || 'Top chart'} — ${getCountryLabel(country)}`;
        if (subEl) subEl.textContent = `${currentTopChartTracks.length} tracks`;
        if (gridEl) gridEl.classList.add('hidden');
        if (tracksEl) {
          tracksEl.classList.remove('hidden');
          renderTracks(tracksEl, currentTopChartTracks, 'search');
        }
      } else if (secId === 'sp-made-sec') {
        if (titleEl) titleEl.textContent = t('For you') || 'For you';
        if (subEl) subEl.textContent = 'For you & Daily Mixes';
        if (tracksEl) tracksEl.classList.add('hidden');
        if (gridEl) {
          gridEl.classList.remove('hidden');
          gridEl.innerHTML = '';
          const srcRow = document.getElementById('sp-made');
          if (srcRow) {
            Array.from(srcRow.children).forEach(card => {
              const clone = card.cloneNode(true);
              clone.addEventListener('click', () => card.click());
              gridEl.appendChild(clone);
            });
          }
        }
      } else if (secId === 'sp-artists-sec') {
        if (titleEl) titleEl.textContent = t('Favorite artists') || 'Favorite artists';
        const artists = getFavoriteArtistsList();
        if (subEl) subEl.textContent = `${artists.length} artists`;
        if (tracksEl) tracksEl.classList.add('hidden');
        if (gridEl) {
          gridEl.classList.remove('hidden');
          gridEl.innerHTML = '';
          artists.forEach(a => gridEl.appendChild(buildFavArtistCircleCard(a, false, 0, true)));
        }
      }

      const scrollParent = document.querySelector('.main-content');
      if (scrollParent) scrollParent.scrollTop = 0;
    };

    var upgradeSpRowCards = (row) => {
      if (!row) return;
      row.querySelectorAll('.sp-card').forEach((card, idx) => {
        card.style.setProperty('--elem-idx', String(idx));
        const badge = card.querySelector('.sp-trend-listeners');
        const subEl = card.querySelector('.sp-card-sub');
        if (badge && subEl && !subEl.classList.contains('sp-card-sub-split')) {
          const viewsTxt = badge.textContent.trim();
          const artistTxt = subEl.textContent.trim();
          subEl.classList.add('sp-card-sub-split');
          subEl.classList.remove('sp-fade');
          subEl.innerHTML = `
            <span class="sp-card-sub-artist">${escapeHtml(artistTxt)}</span>
            <span class="sp-card-sub-views"><svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg><span>${escapeHtml(viewsTxt)}</span></span>
          `;
          badge.remove();
        }
      });
    };

    var chartLoadToken = 0;
    var loadCountryChart = async (force = false) => {
      const row = document.getElementById('sp-chart');
      if (!row) return;
      const port = state.serverPort || 38472;
      const country = localStorage.getItem('riff_chart_country') || 'ua';
      const lbl = document.getElementById('sp-chart-country-label');
      if (lbl) lbl.textContent = getCountryLabel(country);
      const cacheKey = 'home_chart_v3_' + country;
      const cached = !force && window.HomeCache && window.HomeCache.get(cacheKey, 6 * 3600 * 1000);
      if (cached && Array.isArray(cached) && cached.length > 0) {
        currentTopChartTracks = cached;
        row._lastHomeSig = '';
        renderTrendingCards(row, cached);
        upgradeSpRowCards(row);
        return;
      }
      const myToken = ++chartLoadToken;
      row._lastHomeSig = '';
      row.innerHTML = '<div class="m3-spinner-container" style="margin: 24px auto; grid-column: 1 / -1;"><span class="riff-dots-loader lg" aria-hidden="true"><i></i><i></i><i></i></span></div>';
      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/top-chart?country=${encodeURIComponent(country)}`, {
          signal: AbortSignal.timeout(12000)
        }).then(r => r.json());
        if (myToken !== chartLoadToken) return;
        if (res && res.success && Array.isArray(res.tracks) && res.tracks.length > 0) {
          currentTopChartTracks = res.tracks;
          if (window.HomeCache) window.HomeCache.set(cacheKey, res.tracks);
          row._lastHomeSig = '';
          renderTrendingCards(row, res.tracks);
          upgradeSpRowCards(row);
          if (currentHomeCategoryType === 'sp-chart-sec') {
            openSpHomeCategory('sp-chart-sec');
          }
          return;
        }
        throw new Error('Empty chart');
      } catch (_) {
        if (myToken !== chartLoadToken) return;
        row.innerHTML = '<div class="my-wave-retry-container" style="display:flex;align-items:center;gap:10px;padding:16px 4px;color:var(--md-sys-color-on-surface-variant);font-size:13px;"><span>Could not load chart</span><button type="button" class="btn-outline-pill" id="btn-retry-top-chart" style="height:30px;padding:0 12px;font-size:12px;">Retry</button></div>';
        row.querySelector('#btn-retry-top-chart')?.addEventListener('click', () => loadCountryChart(true));
      }
    };

    var setupSpHomeEnhancements = () => {
      const spHome = document.getElementById('sp-home');
      if (!spHome) return;
      let chartSec = document.getElementById('sp-chart-sec');
      if (!chartSec) {
        const trendSec = document.getElementById('sp-trend-sec');
        chartSec = document.createElement('section');
        chartSec.className = 'sp-section';
        chartSec.id = 'sp-chart-sec';
        const curCode = localStorage.getItem('riff_chart_country') || 'ua';
        chartSec.innerHTML = `
          <div class="sp-sec-head sp-sec-clickable">
            <h2>
              <svg class="sp-ico" viewBox="0 0 24 24"><path d="M3 17h3v4H3v-4zm6-7h3v11H9V10zm6-6h3v17h-3V4zm6 9h3v8h-3v-8z"/></svg>
              <span data-i18n>${escapeHtml(t('Top chart'))}</span>
              <span>—</span>
              <span class="sp-chart-country-wrap" id="sp-chart-country-dropdown">
                <button type="button" class="sp-chart-country-btn" id="btn-sp-chart-country">
                  <span id="sp-chart-country-label" data-i18n-fixed="true">${escapeHtml(getCountryLabel(curCode))}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                <div class="m3-dropdown-menu sp-chart-country-menu" id="sp-chart-country-menu"></div>
              </span>
            </h2>
            <button type="button" class="artist-section-arrow-btn sp-sec-open-btn" aria-label="Show all">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
          <div class="sp-row" id="sp-chart"></div>
        `;
        if (trendSec && trendSec.nextSibling) spHome.insertBefore(chartSec, trendSec.nextSibling);
        else spHome.appendChild(chartSec);

        const wrap = chartSec.querySelector('#sp-chart-country-dropdown');
        const btn = chartSec.querySelector('#btn-sp-chart-country');
        const menu = chartSec.querySelector('#sp-chart-country-menu');
        const rebuild = () => {
          const activeCode = localStorage.getItem('riff_chart_country') || 'ua';
          menu.innerHTML = '';
          CHART_COUNTRIES.forEach(c => {
            const opt = document.createElement('button');
            opt.type = 'button';
            opt.className = 'm3-dropdown-option' + (c.code === activeCode ? ' selected' : '');
            opt.setAttribute('data-i18n-fixed', 'true');
            opt.textContent = getCountryLabel(c.code);
            opt.addEventListener('click', (ev) => {
              ev.stopPropagation();
              localStorage.setItem('riff_chart_country', c.code);
              wrap.classList.remove('open');
              loadCountryChart(true);
            });
            menu.appendChild(opt);
          });
        };
        btn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          rebuild();
          wrap.classList.toggle('open');
        });
        document.addEventListener('click', (ev) => {
          if (!wrap.contains(ev.target)) wrap.classList.remove('open');
        });
        setTimeout(() => loadCountryChart(false), 300);
      }

      spHome.querySelectorAll('.sp-section').forEach(sec => {
        const oldArrows = sec.querySelector('.sp-sec-nav-arrows');
        if (oldArrows) oldArrows.remove();

        let head = sec.querySelector('.sp-sec-head');
        const h2 = sec.querySelector(':scope > h2');
        if (!head && h2) {
          head = document.createElement('div');
          head.className = 'sp-sec-head';
          sec.insertBefore(head, h2);
          head.appendChild(h2);
        }
        if (head && !head.querySelector('.sp-sec-open-btn')) {
          head.classList.add('sp-sec-clickable');
          const openBtn = document.createElement('button');
          openBtn.type = 'button';
          openBtn.className = 'artist-section-arrow-btn sp-sec-open-btn';
          openBtn.setAttribute('aria-label', 'Show all');
          openBtn.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';
          head.appendChild(openBtn);
        }
        if (head && !head._boundOpenCat) {
          head._boundOpenCat = true;
          head.addEventListener('click', (e) => {
            if (e.target.closest('#sp-chart-country-dropdown') || e.target.closest('#btn-regen-mixes')) return;
            openSpHomeCategory(sec.id);
          });
        }
      });

      upgradeSpRowCards(document.getElementById('sp-trend'));
      upgradeSpRowCards(document.getElementById('sp-chart'));

      const spArtists = document.getElementById('sp-artists');
      if (spArtists) {
        if (typeof bindHorizontalWheel === 'function') bindHorizontalWheel(spArtists);
        spArtists.querySelectorAll('.fav-artist-card').forEach(card => {
          const img = card.querySelector('.fav-artist-img');
          const nameEl = card.querySelector('.fav-artist-name');
          const artistName = nameEl ? nameEl.textContent.trim() : '';
          if (img && artistName && (!img.src || /i\.ytimg\.com\/vi\/|data:image\/svg/i.test(img.src))) {
            if (!card._fetchingRealAvatar) {
              card._fetchingRealAvatar = true;
              fetchFavArtistMeta({ name: artistName }, card);
            }
          }
        });
      }
    };

    setupSpHomeEnhancements();
    var spHomeEl = document.getElementById('sp-home');
    if (spHomeEl) {
      new MutationObserver(() => setupSpHomeEnhancements()).observe(spHomeEl, { childList: true, subtree: true });
    }


  emitPluginEvent('ready');



window.switchView = switchView;
window.renderTracks = renderTracks;
window.createTrackRow = createTrackRow;
window.openTrackContextMenu = openTrackContextMenu;
window.openSettingsModal = openSettingsModal;
window.closeSettingsModal = closeSettingsModal;
window.loadHomePage = loadHomePage;
window.setPlayPauseState = setPlayPauseState;
window.updatePlayPauseButton = updatePlayPauseButton;
window.formatDuration = formatDuration;
window.goHome = goHome;
window.performSearch = performSearch;

