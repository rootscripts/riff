
'use strict';

  
  window.syncSettingsSlidersToState = syncSettingsSlidersToState;
  window.updateHqRouting = updateHqRouting;
  window.renderPresets = renderPresets;

  function initAudioContext() {
    audioEngine.init(el.nativeAudio);
    
    if (audioEngine.ctx && audioEngine.ctx.state === 'suspended') {
      audioEngine.ctx.resume().catch(() => {});
    }
    
    audioEngine.setHqEnabled(state.hqEnabled);
    audioEngine.setHqSettings(state.hqSettings);
    audioEngine.setAudioSettings(state.audioSettings);
    audioEngine.setVolume(state.volume, state.isMuted);
    
    startVisualizers();
  }

  function updateHqRouting() {
    audioEngine.setHqEnabled(state.hqEnabled);
    if (el.btnToggleHqAudio) el.btnToggleHqAudio.classList.toggle('active', !!state.hqEnabled);
    if (el.hqPanelWrapper) el.hqPanelWrapper.classList.toggle('expanded', !!state.hqEnabled);
    if (el.hqEnhancerCard) el.hqEnhancerCard.classList.toggle('is-expanded', !!state.hqEnabled);
  }

  var soundSettingsSaveTimer = null;
  function persistSoundSettings() {
    if (!soundPersistenceEnabled) return;
    if (soundSettingsSaveTimer) clearTimeout(soundSettingsSaveTimer);
    soundSettingsSaveTimer = setTimeout(() => {
      soundSettingsSaveTimer = null;
      try {
        localStorage.setItem('riff_hq_enabled', state.hqEnabled ? '1' : '0');
        localStorage.setItem('riff_hq_settings', JSON.stringify(state.hqSettings));
        localStorage.setItem('riff_audio_settings', JSON.stringify(state.audioSettings));
        localStorage.setItem('riff_active_preset', state.activePresetId || '');
      } catch (e) {
        console.warn('Failed to save sound settings', e);
      }
    }, 300);
  }

  function applyHqSettings() {
    updateHqRouting();
    audioEngine.setHqSettings(state.hqSettings);
    persistSoundSettings();
  }
  
  function applyAudioSettings() {
    audioEngine.setAudioSettings(state.audioSettings);
    audioEngine.setVolume(state.volume, state.isMuted);
    audioEngine.applySettings(el.nativeAudio);
    if (el.nativeAudio && Number.isFinite(el.nativeAudio.playbackRate) && el.nativeAudio.playbackRate > 0) {
      el.nativeAudio.defaultPlaybackRate = el.nativeAudio.playbackRate;
    }
    persistSoundSettings();
    
    if (el.settingsModifiedDot) {
      if (audioEngine.isModified()) {
        el.settingsModifiedDot.classList.remove('hidden');
      } else {
        el.settingsModifiedDot.classList.add('hidden');
      }
    }
  }



  function updateRulerTicks(wrap, rawRatio) {
    const ticks = wrap ? wrap.querySelectorAll('.sl-ruler i') : null;
    if (ticks && ticks.length) {
      const len = ticks.length;
      ticks.forEach((tick, idx) => {
        const tickRatio = len > 1 ? idx / (len - 1) : 0;
        const dist = Math.abs(tickRatio - rawRatio);
        const proximity = Math.max(0, 1 - dist / 0.28);
        const opacity = 0.22 + 0.78 * Math.pow(proximity, 1.6);
        tick.style.setProperty('--th', '10px');
        tick.style.setProperty('--to', opacity.toFixed(2));
        tick.style.setProperty('--tc', '#ffffff');
      });
    }
  }

  function syncRulerTicks(wrap, rawRatio) {
    updateRulerTicks(wrap, rawRatio);
  }

  function isSpeedLinkedToPitch() {
    return localStorage.getItem('riff_link_speed_pitch') !== '0';
  }

  function getEffectiveSpeed(s = state.audioSettings) {
    if (!s) return 1.0;
    if (Math.abs((s.speedPitch ?? 1.0) - 1.0) > 0.001) return s.speedPitch;
    if (Math.abs((s.speed ?? 1.0) - 1.0) > 0.001) return s.speed;
    return 1.0;
  }

  function setUnifiedSpeed(rawVal) {
    initAudioContext();
    const val = Math.max(0.5, Math.min(2.0, Math.round((parseFloat(rawVal) || 1.0) * 100) / 100));
    if (isSpeedLinkedToPitch()) {
      state.audioSettings.speedPitch = val;
      state.audioSettings.speed = 1.0;
    } else {
      state.audioSettings.speed = val;
      state.audioSettings.speedPitch = 1.0;
    }
    state.activePresetId = null;
    syncSettingsSlidersToState();
    applyAudioSettings();
    renderPresets();
  }

  function setUnifiedPitch(rawVal) {
    initAudioContext();
    const val = Math.max(-12, Math.min(12, Math.round((parseFloat(rawVal) || 0) * 10) / 10));
    state.audioSettings.pitch = val;
    state.activePresetId = null;
    syncSettingsSlidersToState();
    applyAudioSettings();
    renderPresets();
  }

  function syncAudioKeepAcross() {
    const keepBtn = document.getElementById('btn-audio-keep-across');
    if (keepBtn) keepBtn.classList.toggle('active', Boolean(soundPersistenceEnabled));
  }

  function syncSettingsSlidersToState() {
    el.sliderSpeed = document.getElementById('slider-speed');
    el.valSpeed = document.getElementById('val-speed');
    const s = state.audioSettings;
    const updateWrap = (input) => {
      if (!input) return;
      const wrap = input.closest('.sl');
      if (wrap) {
        const min = input.min === '' ? 0 : parseFloat(input.min);
        const max = input.max === '' ? 100 : parseFloat(input.max);
        const rawRatio = max > min ? (parseFloat(input.value) - min) / (max - min) : 0;
        wrap.style.setProperty('--v', rawRatio);
        updateRulerTicks(wrap, rawRatio);
      }
    };

    const effSpeed = getEffectiveSpeed(s);
    const slSpeed = el.sliderSpeed || document.getElementById('slider-speed');
    if (slSpeed) { slSpeed.value = effSpeed; updateWrap(slSpeed); }
    const vlSpeed = el.valSpeed || document.getElementById('val-speed');
    if (vlSpeed) vlSpeed.textContent = 'x' + Number(effSpeed).toFixed(2);

    document.querySelectorAll('#speed-preset-pills .speed-pill-btn, .speed-pill-btn').forEach(b => b.classList.toggle('active', Math.abs(parseFloat(b.dataset.speedVal) - effSpeed) < 0.015));
    if (typeof window.syncSpeedPillsIndicator === 'function') window.syncSpeedPillsIndicator();

    const btnLink = document.getElementById('btn-link-speed-pitch');
    if (btnLink) btnLink.classList.toggle('active', isSpeedLinkedToPitch());
    syncAudioKeepAcross();

    if (el.sliderSpeedPitch) { el.sliderSpeedPitch.value = s.speedPitch; updateWrap(el.sliderSpeedPitch); }
    if (el.valSpeedPitch) el.valSpeedPitch.textContent = `${s.speedPitch.toFixed(2)}x`;

    const slPitch = document.getElementById('slider-pitch');
    const pVal = Number(s.pitch) || 0;
    if (slPitch) { slPitch.value = pVal; updateWrap(slPitch); }
    const vlPitch = document.getElementById('val-pitch');
    if (vlPitch) vlPitch.textContent = (pVal > 0 ? '+' : '') + pVal.toFixed(1) + ' st';

    if (el.sliderReverb) { el.sliderReverb.value = s.reverb; updateWrap(el.sliderReverb); }
    if (el.valReverb) el.valReverb.textContent = `${s.reverb}%`;
    const btnQuickRev = document.getElementById('btn-quick-reverb');
    if (btnQuickRev) btnQuickRev.classList.toggle('active', (s.reverb || 0) > 0);

    if (el.sliderDistortion) { el.sliderDistortion.value = s.distortion; updateWrap(el.sliderDistortion); }
    if (el.valDistortion) el.valDistortion.textContent = `${s.distortion}%`;

    if (el.sliderGain) { el.sliderGain.value = Math.round(s.volume * 100); updateWrap(el.sliderGain); }
    if (el.valGain) el.valGain.textContent = `${Math.round(s.volume * 100)}%`;

    if (el.sliderEcho) { el.sliderEcho.value = s.echo; updateWrap(el.sliderEcho); }
    if (el.valEcho) el.valEcho.textContent = `${s.echo}%`;

    const eq = s.eq || { low: 0, mid: 0, high: 0 };
    if (el.sliderEqLow) { el.sliderEqLow.value = eq.low; updateWrap(el.sliderEqLow); }
    if (el.valEqLow) el.valEqLow.textContent = `${eq.low > 0 ? '+' : ''}${eq.low} dB`;
    if (el.sliderEqMid) { el.sliderEqMid.value = eq.mid; updateWrap(el.sliderEqMid); }
    if (el.valEqMid) el.valEqMid.textContent = `${eq.mid > 0 ? '+' : ''}${eq.mid} dB`;
    if (el.sliderEqHigh) { el.sliderEqHigh.value = eq.high; updateWrap(el.sliderEqHigh); }
    if (el.valEqHigh) el.valEqHigh.textContent = `${eq.high > 0 ? '+' : ''}${eq.high} dB`;

    const bands = s.eqBands || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    if (typeof window.updateSpotifyEqUI === 'function') {
      window.updateSpotifyEqUI();
    }

    if (state.hqSettings) {
      if (el.sliderHqVocal) { el.sliderHqVocal.value = state.hqSettings.vocal; updateWrap(el.sliderHqVocal); if (el.valHqVocal) el.valHqVocal.textContent = `${state.hqSettings.vocal > 0 ? '+' : ''}${state.hqSettings.vocal}%`; }
      if (el.sliderHqAir) { el.sliderHqAir.value = state.hqSettings.air; updateWrap(el.sliderHqAir); if (el.valHqAir) el.valHqAir.textContent = `${state.hqSettings.air > 0 ? '+' : ''}${state.hqSettings.air}%`; }
      if (el.sliderHqBass) { el.sliderHqBass.value = state.hqSettings.bass; updateWrap(el.sliderHqBass); if (el.valHqBass) el.valHqBass.textContent = `${state.hqSettings.bass > 0 ? '+' : ''}${state.hqSettings.bass}%`; }
      if (el.hqPresetChips) el.hqPresetChips.forEach(c => c.classList.toggle('active', c.dataset.preset === state.hqSettings.preset));
    }
  }


  function loadCustomPresets() {
    const raw = (typeof safeArray === 'function') ? safeArray('devsize_custom_presets') : (typeof window.safeArray === 'function' ? window.safeArray('devsize_custom_presets') : []);
    const normFn = (typeof normalizePreset === 'function') ? normalizePreset : (window.normalizePreset || (p => p));
    const normalized = Array.isArray(raw) ? raw.map(normFn).filter(Boolean) : [];
    if (normalized.length > 0) {
      state.customPresets = normalized;
    } else if (!Array.isArray(state.customPresets)) {
      state.customPresets = [];
    }
    return state.customPresets;
  }
  window.loadCustomPresets = loadCustomPresets;

  function getAllPresets() {
    if (!state.customPresets || state.customPresets.length === 0) {
      loadCustomPresets();
    }
    const def = Array.isArray(defaultPresets) ? defaultPresets : [];
    const cust = (state && Array.isArray(state.customPresets)) ? state.customPresets : [];
    return [...def, ...cust];
  }

  function renderPresets() {
    const all = getAllPresets();

    const createPresetChip = (p) => {
      const chip = document.createElement('div');
      chip.className = 'preset-chip';
      if (state.activePresetId === p.id) chip.classList.add('active');

      const isCustom = p.id.startsWith('custom_');
      chip.dataset.isCustom = isCustom ? 'true' : 'false';
      chip.dataset.presetId = p.id;

      chip.innerHTML = `
      <span class="preset-name-label">${escapeHtml(p.name)}</span>
      ${isCustom ? `
        <div class="preset-actions">
          <button type="button" class="preset-btn-action btn-rename-p" title="Rename" aria-label="Rename preset">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
          </button>
          <button type="button" class="preset-btn-action btn-delete-p" title="Delete" aria-label="Delete preset">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>` : ''}
      `;

      if (isCustom) {
        const btnRename = chip.querySelector('.btn-rename-p');
        const btnDelete = chip.querySelector('.btn-delete-p');
        if (btnRename) {
          btnRename.addEventListener('click', (e) => {
            e.stopPropagation();
            openRenamePresetModal(p);
          });
        }
        if (btnDelete) {
          btnDelete.addEventListener('click', (e) => {
            e.stopPropagation();
            openDeletePresetConfirm(p);
          });
        }
      }

      chip.addEventListener('click', (e) => {
        if (e.target.closest('.btn-delete-p') || e.target.closest('.btn-rename-p')) return;
        applyPreset(p);
      });

      return chip;
    };

    if (el.presetsContainer) {
      el.presetsContainer.innerHTML = '';
      all.forEach(p => {
        el.presetsContainer.appendChild(createPresetChip(p));
      });
      invalidateFadeCache(el.presetsContainer);
      updatePresetsFade();
    }
  }

  function invalidateFadeCache(targetEl) {
    if (targetEl) {
      targetEl._cachedClientH = undefined;
      targetEl._cachedScrollH = undefined;
    }
  }
  window.invalidateFadeCache = invalidateFadeCache;

  function updateFade(targetEl) {
    if (!targetEl) return;
    if (targetEl._fadeRaf) return;
    targetEl._fadeRaf = requestAnimationFrame(() => {
      targetEl._fadeRaf = 0;
      const st = targetEl.scrollTop;
      const needTop = st > 4;
      if (targetEl._cachedClientH === undefined || targetEl._cachedScrollH === undefined) {
        targetEl._cachedClientH = targetEl.clientHeight;
        targetEl._cachedScrollH = targetEl.scrollHeight;
      }
      const needBottom = st + targetEl._cachedClientH < targetEl._cachedScrollH - 4;
      if (targetEl._lastFadeTop !== needTop) {
        targetEl._lastFadeTop = needTop;
        targetEl.classList.toggle('fade-top', needTop);
      }
      if (targetEl._lastFadeBottom !== needBottom) {
        targetEl._lastFadeBottom = needBottom;
        targetEl.classList.toggle('fade-bottom', needBottom);
      }
    });
  }
  window.updateFade = updateFade;

  function updatePresetsFade() {
    const pc = document.getElementById('presets-container') || el.presetsContainer;
    if (pc) updateFade(pc);
  }

  if (el.presetsContainer) {
    el.presetsContainer.addEventListener('scroll', updatePresetsFade, { passive: true });
  }
  window.addEventListener('resize', () => {
    const pc = document.getElementById('presets-container') || el.presetsContainer;
    invalidateFadeCache(pc);
    updatePresetsFade();
    const c = document.querySelector('#view-album .album-tracks-col');
    if (c) {
      invalidateFadeCache(c);
      updateFade(c);
    }
  });

  var activeTweenRaf = null;
  function tweenSettings(from, to, ms, apply) {
    if (activeTweenRaf) cancelAnimationFrame(activeTweenRaf);
    const t0 = performance.now();
    (function step(t) {
      const k = Math.min(1, (t - t0) / ms), e = k * k * (3 - 2 * k);
      const cur = {};
      for (const key in to) {
        if (typeof to[key] === 'number') cur[key] = from[key] + (to[key] - from[key]) * e;
        else if (Array.isArray(to[key])) {
          cur[key] = to[key].map((v, idx) => (from[key]?.[idx] ?? 0) + (v - (from[key]?.[idx] ?? 0)) * e);
        } else if (typeof to[key] === 'object' && to[key] !== null) {
          cur[key] = { ...from[key] };
          for (const subKey in to[key]) cur[key][subKey] = (from[key]?.[subKey] ?? 0) + (to[key][subKey] - (from[key]?.[subKey] ?? 0)) * e;
        } else cur[key] = to[key];
      }
      apply(cur);
      if (k < 1) activeTweenRaf = requestAnimationFrame(step);
      else activeTweenRaf = null;
    })(t0);
  }

  function applyPreset(preset) {
    const normalized = normalizePreset(preset);
    if (!normalized) return;
    state.activePresetId = normalized.id;
    initAudioContext();
    renderPresets();
    if (Math.abs((normalized.settings.speedPitch ?? 1.0) - 1.0) > 0.001) {
      localStorage.setItem('riff_link_speed_pitch', '1');
    } else if (Math.abs((normalized.settings.speed ?? 1.0) - 1.0) > 0.001) {
      localStorage.setItem('riff_link_speed_pitch', '0');
    }
    if (activeTweenRaf) { cancelAnimationFrame(activeTweenRaf); activeTweenRaf = null; }
    if (localStorage.getItem('riff_smooth_presets') === 'false') {
      state.audioSettings = { ...normalized.settings };
      syncSettingsSlidersToState();
      applyAudioSettings();
      return;
    }
    const fromAudio = JSON.parse(JSON.stringify(state.audioSettings));
    const toAudio = JSON.parse(JSON.stringify(normalized.settings));
    tweenSettings(fromAudio, toAudio, 400, (cur) => {
      state.audioSettings = { ...state.audioSettings, ...cur };
      syncSettingsSlidersToState();
      applyAudioSettings();
    });
  }

  function saveCustomPreset(name) {
    if (!name || !name.trim()) return;
    const newPreset = {
      id: 'custom_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      name: name.trim(),
      settings: {
        ...state.audioSettings,
        eq: { ...(state.audioSettings.eq || {}) },
        eqBands: [...(state.audioSettings.eqBands || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0])]
      }
    };
    state.customPresets.push(newPreset);
    state.activePresetId = newPreset.id;
    localStorage.setItem('devsize_custom_presets', JSON.stringify(state.customPresets));
    renderPresets();
    persistSoundSettings();
  }

  function openRenamePresetModal(preset) {
    state.presetToRenameId = preset.id;
    if (el.renamePresetName) el.renamePresetName.value = preset.name;
    if (el.renamePresetModal) openModal(el.renamePresetModal);
    if (el.renamePresetName) el.renamePresetName.focus();
  }

  function renameCustomPreset(id, newName) {
    if (!newName || !newName.trim()) return;
    const p = state.customPresets.find(x => x.id === id);
    if (p) {
      p.name = newName.trim();
      localStorage.setItem('devsize_custom_presets', JSON.stringify(state.customPresets));
      renderPresets();
    }
  }

  function deleteCustomPreset(id) {
    state.customPresets = state.customPresets.filter(p => p.id !== id);
    if (state.activePresetId === id) state.activePresetId = 'p_default';
    localStorage.setItem('devsize_custom_presets', JSON.stringify(state.customPresets));
    renderPresets();
    persistSoundSettings();
  }

  function openDeletePresetConfirm(preset) {
    state.presetToDeleteId = preset.id;
    const msg = document.getElementById('delete-preset-msg');
    if (msg) msg.textContent = `Delete preset "${preset.name}"?`;
    const modal = document.getElementById('delete-preset-modal');
    if (modal) openModal(modal);
  }


  function closeConnected() {
    if (!audioCard?.classList.contains('connected-editor')) return;
    audioCard.classList.add('connected-closing');
    if (typeof syncAudioEditorObserverState === 'function') syncAudioEditorObserverState();
    setTimeout(() => {
      audioCard.classList.remove('connected-editor', 'connected-closing', 'connected-entering');
      audioCard.style.transform = '';
      if (el.audioSettingsModal) el.audioSettingsModal.appendChild(audioCard);
      if (typeof syncAudioEditorObserverState === 'function') syncAudioEditorObserverState();
    }, 190);
  }
  function toggleConnectedAudio(open) {
    const playbar = document.getElementById('playbar');
    if (!getAdv('connected_audio', true)) {
      if (audioCard && el.audioSettingsModal && audioCard.parentElement !== el.audioSettingsModal) {
        audioCard.classList.remove('connected-editor', 'connected-closing', 'connected-entering');
        audioCard.style.transform = '';
        el.audioSettingsModal.appendChild(audioCard);
      }
      if (open !== false && el.audioSettingsModal) openModal(el.audioSettingsModal);
      if (typeof syncAudioEditorObserverState === 'function') syncAudioEditorObserverState();
      return;
    }
    const isOpen = audioCard?.classList.contains('connected-editor');
    if (open === false || (open === undefined && isOpen)) {
      closeConnected();
    } else if (audioCard && playbar) {
      audioCard.classList.remove('connected-closing');
      audioCard.classList.add('connected-editor', 'connected-entering');
      audioCard.style.transform = '';
      playbar.parentNode.insertBefore(audioCard, playbar);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          audioCard.classList.remove('connected-entering');
        });
      });
      if (typeof syncAudioEditorObserverState === 'function') syncAudioEditorObserverState();
    }
  }

  if (el.btnOpenSettings) {
    el.btnOpenSettings.addEventListener('click', (e) => {
      e.stopPropagation();
      const tempoTab = document.querySelector('.audio-tab[data-audio-tab="tempo"]') || document.querySelector('.audio-tab');
      if (tempoTab) tempoTab.click();
      toggleConnectedAudio();
      refreshStacks();
    });
  }

  if (el.btnCloseSettings) {
    el.btnCloseSettings.addEventListener('click', () => {
      if (audioCard?.classList.contains('connected-editor')) toggleConnectedAudio(false);
      else if (el.audioSettingsModal) closeModal(el.audioSettingsModal);
    });
  }

  document.addEventListener('click', (e) => {
    if (audioCard?.classList.contains('connected-editor') && !audioCard.contains(e.target) && !el.btnOpenSettings?.contains(e.target)) toggleConnectedAudio(false);
  });

  if (el.audioSettingsModal) {
    el.audioSettingsModal.addEventListener('click', (e) => {
      if (e.target === el.audioSettingsModal) closeModal(el.audioSettingsModal);
    });
  }

  if (el.btnOpenVisualSettings) {
    el.btnOpenVisualSettings.addEventListener('click', () => {
      if (el.visualSettingsModal) openModal(el.visualSettingsModal);
    });
  }

  if (el.btnCloseVisualSettings) {
    el.btnCloseVisualSettings.addEventListener('click', () => {
      if (el.visualSettingsModal) closeModal(el.visualSettingsModal);
    });
  }

  if (el.visualSettingsModal) {
    el.visualSettingsModal.addEventListener('click', (e) => {
      if (e.target === el.visualSettingsModal) closeModal(el.visualSettingsModal);
    });
  }

  if (el.btnToggleHqAudio) {
    el.btnToggleHqAudio.addEventListener('click', () => {
      state.hqEnabled = !state.hqEnabled;
      el.btnToggleHqAudio.classList.toggle('active', state.hqEnabled);
      
      if (el.hqPanelWrapper) {
        el.hqPanelWrapper.classList.toggle('expanded', state.hqEnabled);
        if (el.hqEnhancerCard) el.hqEnhancerCard.classList.toggle('is-expanded', state.hqEnabled);
      }
      initAudioContext();
      updateHqRouting();
      persistSoundSettings();
    });
  }

  if (el.hqPresetChips) {
    el.hqPresetChips.forEach(chip => {
      chip.addEventListener('click', () => {
        el.hqPresetChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        state.hqSettings.preset = chip.dataset.preset;

        let v = 0, a = 0, b = 0;
        if (state.hqSettings.preset === 'studio') { v = 0; a = 0; b = 0; }
        else if (state.hqSettings.preset === 'vinyl') { v = 15; a = -15; b = 25; }
        else if (state.hqSettings.preset === 'concert') { v = -10; a = 30; b = 15; }

        if (el.sliderHqVocal) { el.sliderHqVocal.value = v; el.valHqVocal.textContent = (v > 0 ? '+' : '') + v + '%'; state.hqSettings.vocal = v; }
        if (el.sliderHqAir) { el.sliderHqAir.value = a; el.valHqAir.textContent = (a > 0 ? '+' : '') + a + '%'; state.hqSettings.air = a; }
        if (el.sliderHqBass) { el.sliderHqBass.value = b; el.valHqBass.textContent = (b > 0 ? '+' : '') + b + '%'; state.hqSettings.bass = b; }

        applyHqSettings();
      });
    });
  }

  ['Vocal', 'Air', 'Bass'].forEach(type => {
    const slider = el[`sliderHq${type}`];
    const valDisplay = el[`valHq${type}`];
    if (slider) {
      slider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        if (valDisplay) valDisplay.textContent = (val > 0 ? '+' : '') + val + '%';
        state.hqSettings[type.toLowerCase()] = val;
        if (el.hqPresetChips) el.hqPresetChips.forEach(c => c.classList.remove('active'));
        applyHqSettings();
      });
    }
  });

  if (el.hqEngineSelect) {
    el.hqEngineSelect.addEventListener('change', (e) => {
      state.hqSettings.engine = e.target.value;
      applyHqSettings();
    });
  }

  var hqDropdown = document.getElementById('hq-engine-dropdown');
  var hqTrigger = document.getElementById('hq-engine-trigger');
  var hqLabel = document.getElementById('hq-engine-label');
  var hqMenu = document.getElementById('hq-engine-menu');

  if (hqTrigger && hqDropdown && hqMenu) {
    hqTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      hqDropdown.classList.toggle('open');
    });

    hqMenu.querySelectorAll('.m3-dropdown-option').forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        const val = opt.dataset.value;
        if (hqLabel) hqLabel.textContent = opt.textContent;
        hqMenu.querySelectorAll('.m3-dropdown-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        if (el.hqEngineSelect) {
          el.hqEngineSelect.value = val;
          el.hqEngineSelect.dispatchEvent(new Event('change'));
        }
        hqDropdown.classList.remove('open');
      });
    });

    document.addEventListener('click', () => {
      hqDropdown.classList.remove('open');
    });
  }

  var slSpeed = document.getElementById('slider-speed') || el.sliderSpeed;
  if (slSpeed) {
    slSpeed.addEventListener('input', (e) => {
      setUnifiedSpeed(e.target.value);
    });
    slSpeed.addEventListener('dblclick', () => {
      setUnifiedSpeed(1.0);
    });
  }
  document.addEventListener('input', (e) => {
    if (e.target && e.target.id === 'slider-speed') {
      setUnifiedSpeed(e.target.value);
    }
  });
  document.addEventListener('dblclick', (e) => {
    if (e.target && e.target.id === 'slider-speed') {
      setUnifiedSpeed(1.0);
    }
  });

  var slPitch = document.getElementById('slider-pitch') || el.sliderPitch;
  if (slPitch) {
    slPitch.addEventListener('input', (e) => {
      setUnifiedPitch(e.target.value);
    });
    slPitch.addEventListener('dblclick', () => {
      setUnifiedPitch(0);
    });
  }

  document.querySelectorAll('#speed-preset-pills .speed-pill-btn, .speed-pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setUnifiedSpeed(btn.dataset.speedVal);
    });
  });

  var btnSpeedDec = document.getElementById('btn-speed-dec');
  if (btnSpeedDec) {
    btnSpeedDec.addEventListener('click', () => {
      setUnifiedSpeed(getEffectiveSpeed() - 0.05);
    });
  }

  var btnSpeedInc = document.getElementById('btn-speed-inc');
  if (btnSpeedInc) {
    btnSpeedInc.addEventListener('click', () => {
      setUnifiedSpeed(getEffectiveSpeed() + 0.05);
    });
  }

  var btnPitchDec = document.getElementById('btn-pitch-dec');
  if (btnPitchDec) {
    btnPitchDec.addEventListener('click', () => {
      setUnifiedPitch((Number(state.audioSettings.pitch) || 0) - 0.5);
    });
  }

  var btnPitchInc = document.getElementById('btn-pitch-inc');
  if (btnPitchInc) {
    btnPitchInc.addEventListener('click', () => {
      setUnifiedPitch((Number(state.audioSettings.pitch) || 0) + 0.5);
    });
  }

  var btnLinkSpeedPitch = document.getElementById('btn-link-speed-pitch');
  if (btnLinkSpeedPitch) {
    btnLinkSpeedPitch.classList.toggle('active', isSpeedLinkedToPitch());
    btnLinkSpeedPitch.addEventListener('click', () => {
      const next = !isSpeedLinkedToPitch();
      localStorage.setItem('riff_link_speed_pitch', next ? '1' : '0');
      btnLinkSpeedPitch.classList.toggle('active', next);
      setUnifiedSpeed(getEffectiveSpeed());
    });
  }

  var btnAudioKeepAcross = document.getElementById('btn-audio-keep-across');
  if (btnAudioKeepAcross) {
    btnAudioKeepAcross.classList.toggle('active', Boolean(soundPersistenceEnabled));
    btnAudioKeepAcross.addEventListener('click', () => {
      const persistBtn = document.getElementById('btn-persist-sound-settings');
      if (persistBtn) persistBtn.click();
      syncAudioKeepAcross();
    });
  }

  var btnQuickReverb = document.getElementById('btn-quick-reverb');
  if (btnQuickReverb) {
    btnQuickReverb.addEventListener('click', () => {
      initAudioContext();
      state.audioSettings.reverb = (state.audioSettings.reverb > 0) ? 0 : 45;
      state.activePresetId = null;
      syncSettingsSlidersToState();
      applyAudioSettings();
      renderPresets();
    });
  }

  document.addEventListener('click', (e) => {
    const quickRev = e.target.closest('#btn-quick-reverb');
    if (quickRev) {
      initAudioContext();
      state.audioSettings.reverb = (state.audioSettings.reverb > 0) ? 0 : 45;
      state.activePresetId = null;
      syncSettingsSlidersToState();
      applyAudioSettings();
      renderPresets();
      return;
    }
    const speedDec = e.target.closest('#btn-speed-dec');
    if (speedDec) {
      setUnifiedSpeed(getEffectiveSpeed() - 0.05);
      return;
    }
    const speedInc = e.target.closest('#btn-speed-inc');
    if (speedInc) {
      setUnifiedSpeed(getEffectiveSpeed() + 0.05);
      return;
    }
    const pitchDec = e.target.closest('#btn-pitch-dec');
    if (pitchDec) {
      setUnifiedPitch((Number(state.audioSettings.pitch) || 0) - 0.5);
      return;
    }
    const pitchInc = e.target.closest('#btn-pitch-inc');
    if (pitchInc) {
      setUnifiedPitch((Number(state.audioSettings.pitch) || 0) + 0.5);
      return;
    }
    const linkBtn = e.target.closest('#btn-link-speed-pitch');
    if (linkBtn) {
      const next = !isSpeedLinkedToPitch();
      localStorage.setItem('riff_link_speed_pitch', next ? '1' : '0');
      linkBtn.classList.toggle('active', next);
      setUnifiedSpeed(getEffectiveSpeed());
      return;
    }
    const audioKeep = e.target.closest('#btn-audio-keep-across');
    if (audioKeep) {
      const persistBtn = document.getElementById('btn-persist-sound-settings');
      if (persistBtn) persistBtn.click();
      syncAudioKeepAcross();
      return;
    }
  });

  if (el.sliderReverb) {
    el.sliderReverb.addEventListener('input', (e) => {
      initAudioContext();
      const val = parseInt(e.target.value, 10);
      state.audioSettings.reverb = val;
      if (el.valReverb) el.valReverb.textContent = `${val}%`;
      state.activePresetId = null;
      applyAudioSettings();
      renderPresets();
    });
  }

  if (el.sliderDistortion) {
    el.sliderDistortion.addEventListener('input', (e) => {
      initAudioContext();
      const val = parseInt(e.target.value, 10);
      state.audioSettings.distortion = val;
      if (el.valDistortion) el.valDistortion.textContent = `${val}%`;
      state.activePresetId = null;
      applyAudioSettings();
      renderPresets();
    });
  }

  if (el.sliderGain) {
    el.sliderGain.addEventListener('input', (e) => {
      initAudioContext();
      const val = parseInt(e.target.value, 10);
      state.audioSettings.volume = val / 100;
      if (el.valGain) el.valGain.textContent = `${val}%`;
      state.activePresetId = null;
      applyAudioSettings();
      renderPresets();
    });
  }

  if (el.sliderEcho) {
    el.sliderEcho.addEventListener('input', (e) => {
      initAudioContext();
      const val = parseInt(e.target.value, 10);
      state.audioSettings.echo = val;
      if (el.valEcho) el.valEcho.textContent = `${val}%`;
      state.activePresetId = null;
      applyAudioSettings();
      renderPresets();
    });
  }

  ['low', 'mid', 'high'].forEach(band => {
    const cap = band.charAt(0).toUpperCase() + band.slice(1);
    const slider = el[`sliderEq${cap}`];
    const valEl = el[`valEq${cap}`];
    if (slider) {
      slider.addEventListener('input', (e) => {
        initAudioContext();
        const val = parseInt(e.target.value, 10);
        if (!state.audioSettings.eq) state.audioSettings.eq = { low: 0, mid: 0, high: 0 };
        state.audioSettings.eq[band] = val;
        if (valEl) valEl.textContent = `${val > 0 ? '+' : ''}${val} dB`;
        state.activePresetId = null;
        applyAudioSettings();
        renderPresets();
      });
      slider.addEventListener('dblclick', () => {
        initAudioContext();
        slider.value = 0;
        if (!state.audioSettings.eq) state.audioSettings.eq = { low: 0, mid: 0, high: 0 };
        state.audioSettings.eq[band] = 0;
        if (valEl) valEl.textContent = '0 dB';
        state.activePresetId = null;
        applyAudioSettings();
        renderPresets();
      });
    }
  });


  function watchSliderValue(input, onChange) {
    const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    Object.defineProperty(input, 'value', { configurable: true, get() { return desc.get.call(this); }, set(v) { desc.set.call(this, v); onChange(); } });
    input.addEventListener('input', onChange);
  }
  var audioEditorObserver = null;
  var audioEditorMaintTimer = null;

  function upgradeAudioEditorDOM() {
    const editorHost = document.getElementById('audio-editor') || document.getElementById('audio-settings-modal') || document.querySelector('.audio-menu-card');
    if (editorHost && editorHost.dataset.enhanced === 'true') {
      return;
    }

    el.sliderSpeed = document.getElementById('slider-speed');
    el.valSpeed = document.getElementById('val-speed');
    if (el.sliderSpeed) {
      el.sliderSpeed.style.display = '';
      el.sliderSpeed.min = '0.5';
      el.sliderSpeed.max = '1.5';
      const speedItem = el.sliderSpeed.closest('.setting-item');
      if (speedItem) speedItem.style.display = '';
    }
    if (el.sliderSpeedPitch) {
      el.sliderSpeedPitch.min = '0.5';
      el.sliderSpeedPitch.max = '1.5';
    }
    const btnReset = document.getElementById('btn-reset-audio');
    if (btnReset) {
      btnReset.classList.add('audio-tab', 'audio-reset-top-btn');
      btnReset.style.cssText = '';
      if (!btnReset.querySelector('svg')) {
        btnReset.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>';
      }
    }
    document.querySelectorAll('.audio-tab').forEach(t => {
      t.classList.remove('stack-only', 'stack-first', 'stack-mid', 'stack-last', 'stack-h');
    });
    document.querySelectorAll('.audio-menu-card .setting-item, .audio-menu-card .eq-row, .audio-panel .setting-item').forEach(c => {
      c.classList.add('ruler-slider-card');
    });
    const tempoPanel = document.querySelector('.audio-panel[data-audio-panel="tempo"]');
    if (tempoPanel) {
      if (el.sliderSpeedPitch) {
        const spItem = el.sliderSpeedPitch.closest('.setting-item');
        if (spItem) spItem.style.display = 'none';
      }
      const speedItem = el.sliderSpeed ? el.sliderSpeed.closest('.setting-item') : null;
      if (speedItem) {
        speedItem.classList.add('ruler-slider-card');
        speedItem.querySelectorAll('.speed-preset-pills:not(#speed-preset-pills)').forEach(p => p.remove());
        const top = speedItem.querySelector('.setting-item-top');
        if (top && !document.getElementById('btn-link-speed-pitch')) {
          const linkWrap = document.createElement('div');
          linkWrap.dataset.enhanced = 'true';
          linkWrap.style.cssText = 'display:flex;align-items:center;gap:8px;margin-left:auto;';
          linkWrap.innerHTML = `
            <span style="font-size:12px;color:var(--md-sys-color-outline);">Link pitch</span>
            <button type="button" class="effect-switch-btn ${isSpeedLinkedToPitch() ? 'active' : ''}" id="btn-link-speed-pitch" title="Link speed to pitch"><span class="thumb"></span></button>
          `;
          top.appendChild(linkWrap);
        }
        if (!speedItem.querySelector('#btn-speed-dec')) {
          const stepper = document.createElement('div');
          stepper.className = 'sl-stepper-row';
          stepper.dataset.enhanced = 'true';
          stepper.innerHTML = `
            <button type="button" class="sl-step-btn" id="btn-speed-dec" title="Decrease speed">-</button>
            <button type="button" class="sl-step-btn" id="btn-speed-inc" title="Increase speed">+</button>
          `;
          speedItem.appendChild(stepper);
        }
      }
      const pitchItem = el.sliderPitch ? el.sliderPitch.closest('.setting-item') : null;
      if (pitchItem) {
        pitchItem.classList.add('ruler-slider-card');
        const existingRev = document.getElementById('btn-quick-reverb');
        if (existingRev) existingRev.closest('div')?.remove();
        if (!pitchItem.querySelector('#btn-pitch-dec')) {
          const stepper = document.createElement('div');
          stepper.className = 'sl-stepper-row';
          stepper.dataset.enhanced = 'true';
          stepper.innerHTML = `
            <button type="button" class="sl-step-btn" id="btn-pitch-dec" title="Decrease pitch">-</button>
            <button type="button" class="sl-step-btn" id="btn-pitch-inc" title="Increase pitch">+</button>
          `;
          pitchItem.appendChild(stepper);
        }
      }
    }

    const sleepPanel = document.querySelector('.audio-panel[data-audio-panel="sleep"]');
    if (sleepPanel) {
      const sleepOptions = sleepPanel.querySelector('.sleep-timer-options');
      if (sleepOptions && !document.getElementById('btn-sleep-add-5')) {
        const add5 = document.createElement('button');
        add5.className = 'btn-outline-pill';
        add5.type = 'button';
        add5.id = 'btn-sleep-add-5';
        add5.dataset.enhanced = 'true';
        add5.textContent = '+5 min';
        sleepOptions.appendChild(add5);
      }
      const sleepItem = sleepPanel.querySelector('.setting-item');
      if (sleepItem && !document.getElementById('sleep-timer-progress')) {
        const barWrap = document.createElement('div');
        barWrap.className = 'sleep-hero-bar-wrap';
        barWrap.dataset.enhanced = 'true';
        barWrap.innerHTML = '<div id="sleep-timer-progress" class="sleep-hero-bar-fill"></div>';
        sleepItem.appendChild(barWrap);
      }
    }

    if (!document.getElementById('btn-audio-keep-across')) {
      const keepBtn = document.createElement('button');
      keepBtn.type = 'button';
      keepBtn.id = 'btn-audio-keep-across';
      keepBtn.className = 'effect-switch-btn';
      keepBtn.dataset.enhanced = 'true';
      keepBtn.style.display = 'none';
      keepBtn.innerHTML = '<span class="thumb"></span>';
      document.body.appendChild(keepBtn);
    }

    if (editorHost) {
      editorHost.dataset.enhanced = 'true';
    }
  }

  function enhanceSliders(root) {
    el.sliderSpeed = document.getElementById('slider-speed');
    el.valSpeed = document.getElementById('val-speed');

    const wasObserving = !!audioEditorObserver;
    if (wasObserving) {
      audioEditorObserver.disconnect();
    }

    try {
      upgradeAudioEditorDOM();
      const allRangeInputs = (root || document).querySelectorAll('input[type="range"]:not(#slider-theme-hue)');
      allRangeInputs.forEach((input) => {
        if (input.closest('.eq-slider-box') || input.closest('.eq-slider-wrap') || input.closest('.hue-seg') || input.classList.contains('eq-band-range')) return;
        if (input.type === 'hidden' || input.id === 'slider-speed-pitch' || input.style.display === 'none') return;
        if (input.closest('.tvk-progress-row') || input.id === 'tvk-seek-slider') return;

        let wrap = input.parentElement && input.parentElement.classList.contains('sl') ? input.parentElement : null;
        if (!wrap) {
          wrap = document.createElement('div');
          wrap.className = 'sl';
          wrap.dataset.enhanced = 'true';
          input.parentNode.insertBefore(wrap, input);
          wrap.appendChild(input);
        }
        if (!wrap.querySelector('.sl-inactive')) {
          const inact = document.createElement('div');
          inact.className = 'sl-inactive';
          wrap.insertBefore(inact, wrap.firstChild);
        }
        if (!wrap.querySelector('.sl-active')) {
          const act = document.createElement('div');
          act.className = 'sl-active';
          wrap.insertBefore(act, input);
        }
        input.classList.add('sl-done');
        input.dataset.enhanced = 'true';

        const sync = () => {
          const min = input.min === '' ? 0 : parseFloat(input.min);
          const max = input.max === '' ? 100 : parseFloat(input.max);
          const rawRatio = max > min ? (parseFloat(input.value) - min) / (max - min) : 0;
          if (input.id === 'volume-slider') {
            const v = (!state.isMuted && rawRatio > 0) ? (0.06 + rawRatio * 0.94) : 0;
            wrap.style.setProperty('--v', v);
          } else {
            wrap.style.setProperty('--v', rawRatio);
          }
          if (typeof updateRulerTicks === 'function') updateRulerTicks(wrap, rawRatio);
        };
        if (!input._sliderSyncBound) {
          input._sliderSyncBound = true;
          watchSliderValue(input, sync);
        }
        sync();
      });
    } finally {
      if (wasObserving && typeof isAudioEditorOpen === 'function' && isAudioEditorOpen() && typeof getAudioEditorContainer === 'function') {
        const c = getAudioEditorContainer();
        if (c && audioEditorObserver) {
          try {
            audioEditorObserver.observe(c, { childList: true, subtree: true });
          } catch (_) {}
        }
      }
    }
  }
  enhanceSliders();

  (function initHueSegments() {
    const input = document.getElementById('slider-theme-hue');
    const track = document.querySelector('.hue-seg-track');
    const host = document.getElementById('hue-seg');
    if (!input || !track || !host) return;
    for (let i = 0; i < 12; i++) {
      const seg = document.createElement('i');
      seg.style.background = `linear-gradient(90deg, hsl(${i * 30} 75% 55%), hsl(${(i + 1) * 30} 75% 55%))`;
      track.appendChild(seg);
    }
    const sync = () => {
      const min = input.min === '' ? 0 : parseFloat(input.min);
      const max = input.max === '' ? 360 : parseFloat(input.max);
      host.style.setProperty('--v', max > min ? (parseFloat(input.value) - min) / (max - min) : 0);
    };
    watchSliderValue(input, sync);
    sync();
  })();

  var btnWavyProgress = document.getElementById('btn-wavy-progress');

  function getAudioEditorContainer() {
    return document.getElementById('audio-editor') ||
           document.getElementById('audio-settings-modal') ||
           document.querySelector('.audio-settings-modal') ||
           document.querySelector('.audio-menu-card');
  }

  function isAudioEditorOpen() {
    const modal = document.getElementById('audio-editor') ||
                  document.getElementById('audio-settings-modal') ||
                  document.querySelector('.audio-settings-modal');
    if (modal && !modal.classList.contains('hidden')) {
      return true;
    }
    const card = document.querySelector('.audio-menu-card');
    if (card && card.classList.contains('connected-editor') && !card.classList.contains('connected-closing')) {
      return true;
    }
    return false;
  }

  function stopAudioEditorObserver() {
    if (audioEditorMaintTimer) {
      clearTimeout(audioEditorMaintTimer);
      audioEditorMaintTimer = null;
    }
    if (audioEditorObserver) {
      audioEditorObserver.disconnect();
      audioEditorObserver = null;
    }
  }

  function runAudioEditorMaintenance() {
    if (!isAudioEditorOpen()) {
      stopAudioEditorObserver();
      return;
    }
    const container = getAudioEditorContainer();
    if (!container) return;

    const unenhancedSliders = container.querySelectorAll('input[type="range"]:not(.sl-done):not([data-enhanced="true"]):not(#slider-theme-hue)');
    const unenhancedSwitches = container.querySelectorAll('.effect-switch-btn .thumb:not(.has-icon):not([data-enhanced="true"])');
    const needsDomUpgrade = container.dataset.enhanced !== 'true';

    if (unenhancedSliders.length === 0 && unenhancedSwitches.length === 0 && !needsDomUpgrade) {
      return;
    }

    if (audioEditorObserver) {
      audioEditorObserver.disconnect();
    }

    try {
      upgradeAudioEditorDOM();
      enhanceSliders(container);
      decorateSwitches(container);
      if (typeof scheduleI18nApply === 'function') {
        scheduleI18nApply();
      }
    } finally {
      if (isAudioEditorOpen() && audioEditorObserver && container) {
        try {
          audioEditorObserver.observe(container, { childList: true, subtree: true });
        } catch (_) {}
      }
    }
  }

  function startAudioEditorObserver() {
    if (!isAudioEditorOpen()) {
      stopAudioEditorObserver();
      return;
    }
    const container = getAudioEditorContainer();
    if (!container) return;

    if (!audioEditorObserver) {
      audioEditorObserver = new MutationObserver((mutations) => {
        let hasRelevantAdd = false;
        for (let i = 0; i < mutations.length; i++) {
          const m = mutations[i];
          if (!m.addedNodes || m.addedNodes.length === 0) continue;
          for (let j = 0; j < m.addedNodes.length; j++) {
            const node = m.addedNodes[j];
            if (!node || node.nodeType !== 1) continue;
            if (node.dataset?.enhanced === 'true' || node.classList?.contains('sl') || node.classList?.contains('sl-ruler') || node.classList?.contains('sl-stepper-row')) {
              continue;
            }
            if (
              node.matches?.('input[type="range"]:not([data-enhanced="true"]):not(.sl-done)') ||
              node.matches?.('.effect-switch-btn .thumb:not([data-enhanced="true"]):not(.has-icon)') ||
              node.querySelector?.('input[type="range"]:not([data-enhanced="true"]):not(.sl-done)') ||
              node.querySelector?.('.effect-switch-btn .thumb:not([data-enhanced="true"]):not(.has-icon)')
            ) {
              hasRelevantAdd = true;
              break;
            }
          }
          if (hasRelevantAdd) break;
        }

        if (!hasRelevantAdd) return;

        if (audioEditorMaintTimer) {
          clearTimeout(audioEditorMaintTimer);
          audioEditorMaintTimer = null;
        }
        audioEditorMaintTimer = setTimeout(() => {
          audioEditorMaintTimer = null;
          runAudioEditorMaintenance();
        }, 250);
      });
    }

    try {
      audioEditorObserver.observe(container, { childList: true, subtree: true });
    } catch (_) {}

    runAudioEditorMaintenance();
  }

  function syncAudioEditorObserverState() {
    if (isAudioEditorOpen()) {
      startAudioEditorObserver();
    } else {
      stopAudioEditorObserver();
    }
  }

  var audioModalEl = document.getElementById('audio-editor') || document.getElementById('audio-settings-modal') || document.querySelector('.audio-settings-modal');
  if (audioModalEl) {
    new MutationObserver(() => syncAudioEditorObserverState()).observe(audioModalEl, { attributes: true, attributeFilter: ['class', 'style'] });
  }
  var audioCardEl = document.querySelector('.audio-menu-card');
  if (audioCardEl) {
    new MutationObserver(() => syncAudioEditorObserverState()).observe(audioCardEl, { attributes: true, attributeFilter: ['class', 'style'] });
  }

  if (typeof decorateSwitches === 'function') decorateSwitches();

  var settingWinMediaKeys = document.getElementById('setting-win-media-keys');
  var btnWinMediaKeys = document.getElementById('btn-win-media-keys');
  var isWindows = (window.electronAPI && typeof window.electronAPI.isWindows === 'boolean')
    ? window.electronAPI.isWindows
    : (navigator.userAgent.includes('Windows') || (navigator.platform && navigator.platform.includes('Win')));

  if (settingWinMediaKeys) {
    settingWinMediaKeys.style.display = isWindows ? '' : 'none';
  }

  var savedWinMediaKeys = localStorage.getItem('riff_win_global_media_keys') === 'true';
  if (btnWinMediaKeys) {
    btnWinMediaKeys.classList.toggle('active', savedWinMediaKeys);
    btnWinMediaKeys.addEventListener('click', () => {
      const next = !btnWinMediaKeys.classList.contains('active');
      btnWinMediaKeys.classList.toggle('active', next);
      localStorage.setItem('riff_win_global_media_keys', next ? 'true' : 'false');
      if (window.electronAPI && window.electronAPI.setMediaKeys) {
        window.electronAPI.setMediaKeys(next);
      }
    });
  }
  if (window.electronAPI && window.electronAPI.setMediaKeys) {
    window.electronAPI.setMediaKeys(savedWinMediaKeys);
  }
  if (window.electronAPI) {
    if (typeof window.electronAPI.setGlobalShortcuts === 'function') {
      window.electronAPI.setGlobalShortcuts(true);
    }
    if (typeof window.electronAPI.mediaKeysActive === 'function') {
      window.electronAPI.mediaKeysActive();
    }
  }

  if (window.electronAPI && window.electronAPI.onMediaCommand) {
    window.electronAPI.onMediaCommand((cmd) => handleMediaCommand(cmd, 'ipc'));
  }
  if (window.electronAPI && window.electronAPI.onMediaControl) {
    window.electronAPI.onMediaControl((action) => {
      if (action === 'play-pause') togglePlayPause();
      else if (action === 'next') playNext();
      else if (action === 'prev') playPrev();
      else if (action === 'volume-up') adjustVolume(0.05);
      else if (action === 'volume-down') adjustVolume(-0.05);
      else if (action === 'seek-forward' && el.nativeAudio) { el.nativeAudio.currentTime = Math.min(el.nativeAudio.duration || 0, el.nativeAudio.currentTime + 5); }
      else if (action === 'seek-back' && el.nativeAudio) { el.nativeAudio.currentTime = Math.max(0, el.nativeAudio.currentTime - 5); }
    });
  }


window.initAudioContext = initAudioContext;
window.updateHqRouting = updateHqRouting;
window.applyHqSettings = applyHqSettings;
window.applyAudioSettings = applyAudioSettings;
window.syncSettingsSlidersToState = syncSettingsSlidersToState;
window.getAllPresets = getAllPresets;
window.renderPresets = renderPresets;
window.applyPreset = applyPreset;
window.saveCustomPreset = saveCustomPreset;

