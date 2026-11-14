
'use strict';

var audioEngine = window.audioEngine || (window.RiffAudioEngine ? new window.RiffAudioEngine() : null);
window.audioEngine = audioEngine;
var getReliableTrackDuration = window.getReliableTrackDuration || function() { return 0; };
window.getReliableTrackDuration = getReliableTrackDuration;


var isDraggingScrubber = window.isDraggingScrubber || false;
window.isDraggingScrubber = isDraggingScrubber;
var isHoveringScrubber = window.isHoveringScrubber || false;
window.isHoveringScrubber = isHoveringScrubber;
var isHoveringTvkScrubber = window.isHoveringTvkScrubber || false;
window.isHoveringTvkScrubber = isHoveringTvkScrubber;
var isPauseFading = window.isPauseFading || false;
window.isPauseFading = isPauseFading;
var frozenCurTime = window.frozenCurTime || 0;
window.frozenCurTime = frozenCurTime;
var trackToDownload = window.trackToDownload || null;
window.trackToDownload = trackToDownload;
var trimDraft = window.trimDraft || null;
window.trimDraft = trimDraft;
var scrubProgress = window.scrubProgress || 0;
window.scrubProgress = scrubProgress;

  var cachedTrackWidth = 0;
  var cachedTrackHeight = 40;
  var cachedTvkWidth = 0;
  var cachedTvkHeight = 0;
  var cachedTvkProgWidth = 320;
  var tvkSmoothedHeights = null;
  var barBgSmoothedHeights = null;
  var vizPrev = null;
  function vizSettings() {
    const smooth = Math.min(0.95, Math.max(0, (parseInt(localStorage.getItem('riff_viz_smooth') || '55', 10)) / 100));
    const sens = Math.min(3, Math.max(0, (parseInt(localStorage.getItem('riff_viz_sens') || '100', 10)) / 100));
    return { smooth, sens };
  }

  function resizeCanvases() {
    const dpr = window.devicePixelRatio || 1;
    if (el.scrubberTrack) {
      let scrubberCanvas = el.scrubberCanvas || document.getElementById('squiggly-canvas');
      if (!scrubberCanvas) {
        scrubberCanvas = document.createElement('canvas');
        scrubberCanvas.id = 'squiggly-canvas';
        scrubberCanvas.className = 'squiggly-canvas';
        el.scrubberTrack.appendChild(scrubberCanvas);
      }
      el.scrubberCanvas = scrubberCanvas;
      if (!el.scrubberTrack._roBound && window.ResizeObserver) {
        el.scrubberTrack._roBound = true;
        new ResizeObserver(() => resizeCanvases()).observe(el.scrubberTrack);
      }
      const rw = Math.max(100, el.scrubberTrack.clientWidth || Math.round(el.scrubberTrack.getBoundingClientRect().width) || 300);
      const rh = 40;
      cachedTrackWidth = rw;
      cachedTrackHeight = rh;
      hasDrawnPausedFrame = false;
      scrubberCanvas.width = Math.round(rw * dpr);
      scrubberCanvas.height = Math.round(rh * dpr);
      scrubberCanvas.style.width = `${rw}px`;
      scrubberCanvas.style.height = '40px';
      const ctx = scrubberCanvas.getContext('2d');
      ctx.resetTransform();
      ctx.scale(dpr, dpr);
    }
    if (el.visualizerCanvas) {
      el.visualizerCanvas.width = 60 * dpr;
      el.visualizerCanvas.height = 24 * dpr;
      el.visualizerCanvas.style.width = '60px';
      el.visualizerCanvas.style.height = '24px';
      const ctx = el.visualizerCanvas.getContext('2d');
      ctx.resetTransform();
      ctx.scale(dpr, dpr);
    }
    const tvkCanvas = document.getElementById('tvk-visualizer-canvas');
    if (tvkCanvas) {
      const isNoLyrics = el.tvKaraoke && el.tvKaraoke.classList.contains('tv-nolyrics');
      const isSwift = isNoLyrics || (typeof getVizStyle === 'function' && getVizStyle() === 'swift');
      let cssW, cssH;
      if (isNoLyrics) {
        const sideW = Math.min(620, Math.max(340, Math.round(window.innerWidth * 0.42)));
        cssW = sideW;
        cssH = sideW;
      } else {
        cssW = isSwift
          ? Math.min(1200, Math.max(640, Math.round(window.innerWidth * 0.85)))
          : Math.min(760, Math.max(360, Math.round(window.innerWidth * 0.64)));
        cssH = isSwift
          ? Math.min(360, Math.max(220, Math.round(window.innerHeight * 0.38)))
          : Math.min(84, Math.max(52, Math.round(window.innerHeight * 0.085)));
      }
      cachedTvkWidth = cssW;
      cachedTvkHeight = cssH;
      tvkCanvas.width = Math.round(cssW * dpr);
      tvkCanvas.height = Math.round(cssH * dpr);
      tvkCanvas.style.width = `${cssW}px`;
      tvkCanvas.style.height = `${cssH}px`;
      const ctx = tvkCanvas.getContext('2d');
      if (ctx) {
        ctx.resetTransform();
        ctx.scale(dpr, dpr);
      }
    }
    const barBgCanvas = document.getElementById('bottom-visualizer') || document.getElementById('playbar-bg-visualizer');
    if (barBgCanvas && el.playbar) {
      const dpr = window.devicePixelRatio || 1;
      const bw = el.playbar.clientWidth;
      const bh = el.playbar.clientHeight || 88;
      barBgCanvas.width = Math.round(bw * dpr);
      barBgCanvas.height = Math.round(bh * dpr);
      barBgCanvas.style.width = `${bw}px`;
      barBgCanvas.style.height = `${bh}px`;
      const bctx = barBgCanvas.getContext('2d');
      if (bctx) { bctx.resetTransform(); bctx.scale(dpr, dpr); }
    }
    const npCanvas = document.getElementById('np-visualizer-canvas');
    if (npCanvas && el.rightPanel) {
      const nw = el.rightPanel.clientWidth || 320;
      const nh = el.rightPanel.clientHeight || 480;
      npCanvas.width = Math.round(nw * dpr);
      npCanvas.height = Math.round(nh * dpr);
      npCanvas.style.width = nw + 'px';
      npCanvas.style.height = nh + 'px';
      const nctx = npCanvas.getContext('2d');
      if (nctx) { nctx.resetTransform(); nctx.scale(dpr, dpr); }
    }
    const tvkProgRow = document.getElementById('tvk-progress-row') || document.querySelector('.tvk-progress-row');
    if (tvkProgRow) {
      let tvkSquiggly = document.getElementById('tvk-squiggly-canvas');
      if (!tvkSquiggly) {
        tvkSquiggly = document.createElement('canvas');
        tvkSquiggly.id = 'tvk-squiggly-canvas';
        tvkSquiggly.className = 'tvk-squiggly-canvas';
        tvkProgRow.appendChild(tvkSquiggly);
      }
      const rect = tvkProgRow.getBoundingClientRect();
      cachedTvkProgWidth = Math.max(220, Math.round(rect.width || tvkProgRow.clientWidth || 320));
      const rw = cachedTvkProgWidth;
      const rh = 36;
      tvkSquiggly.width = Math.round(rw * dpr);
      tvkSquiggly.height = Math.round(rh * dpr);
      tvkSquiggly.style.width = '100%';
      tvkSquiggly.style.height = '100%';
      const tctx = tvkSquiggly.getContext('2d');
      if (tctx) {
        tctx.resetTransform();
        tctx.scale(dpr, dpr);
      }
    }
  }
  window.addEventListener('resize', resizeCanvases);
  setTimeout(resizeCanvases, 100);

  var smoothAmplitude = 0;
  var smoothPhase = 0;
  var scrubPhase = 0;
  var scrubProgress = 0;
  var scrubPrevKnobX = null;
  var scrubKnobAnim = 0;
  var scrubThicknessAnim = 0;
  var tvkThicknessAnim = 0;
  var scrubLastTime = 0;
  var lastDisplayedSec = -1;
  var lastDisplayedDur = -1;
  var lastTimeupdateSec = -1;
  var miniCanvasHasDrawn = false;
  var tvkCanvasHasDrawn = false;
  var barBgCanvasHasDrawn = false;
  var npCanvasHasDrawn = false;
  var tvkFadeOutRaf = null;

  function fadeOutTvkVisualizer() {
    if (tvkFadeOutRaf) { cancelAnimationFrame(tvkFadeOutRaf); tvkFadeOutRaf = null; }
    const tvkCanvas = document.getElementById('tvk-visualizer-canvas');
    if (!tvkCanvas) return;
    const tvkCtx = tvkCanvas.getContext('2d');
    if (!tvkCtx) return;
    const w = cachedTvkWidth || (tvkCanvas.width / (window.devicePixelRatio || 1)) || 500;
    const h = cachedTvkHeight || (tvkCanvas.height / (window.devicePixelRatio || 1)) || 64;
    let fadeStep = 0;
    function decay() {
      if (state.isPlaying) {
        tvkFadeOutRaf = null;
        return;
      }
      fadeStep++;
      let stillActive = false;
      if (tvkSmoothedHeights) {
        for (let i = 0; i < tvkSmoothedHeights.length; i++) {
          tvkSmoothedHeights[i] *= 0.88;
          if (tvkSmoothedHeights[i] > 0.4) stillActive = true;
          else tvkSmoothedHeights[i] = 0;
        }
      }
      tvkCtx.clearRect(0, 0, w, h);
      if (tvkSmoothedHeights && stillActive && fadeStep < 35) {
        const tvkVisColor = (state && state.tvkFg) || '#ffffff';
        const barCount = tvkSmoothedHeights.length;
        const gap = Math.max(3, Math.min(6, Math.round(w / 115)));
        const totalGap = gap * (barCount - 1);
        const barWidth = Math.max(4, Math.floor((w - totalGap) / barCount));
        const usedWidth = barCount * barWidth + totalGap;
        const startX = Math.max(0, (w - usedWidth) / 2);
        tvkCtx.save();
        tvkCtx.globalAlpha = Math.max(0, (1 - fadeStep / 35) * 0.85);
        for (let i = 0; i < barCount; i++) {
          const barH = tvkSmoothedHeights[i];
          if (barH > 0) {
            const x = startX + i * (barWidth + gap);
            const y = h - barH;
            tvkCtx.fillStyle = tvkVisColor;
            tvkCtx.beginPath();
            tvkCtx.roundRect(x, y, Math.max(0, barWidth), Math.max(0, barH), Math.max(0, Math.min(barWidth / 2, 3)));
            tvkCtx.fill();
          }
        }
        tvkCtx.restore();
        tvkFadeOutRaf = requestAnimationFrame(decay);
      } else {
        tvkCtx.clearRect(0, 0, w, h);
        tvkSmoothedHeights = null;
        tvkFadeOutRaf = null;
      }
    }
    decay();
  }

  function stopVisualizers() {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    const miniCanvas = el.visualizerCanvas;
    const miniCtx = miniCanvas ? miniCanvas.getContext('2d') : null;
    if (miniCtx && miniCanvas) miniCtx.clearRect(0, 0, 60, 24);
    fadeOutTvkVisualizer();
    if (audioEngine && audioEngine.setAnalyserEnabled) {
      audioEngine.setAnalyserEnabled(false);
    }
    if (el.coverContainer && el.coverContainer.style.transform) {
      el.coverContainer.style.transform = '';
    }
  }

  var cachedVizStyle = localStorage.getItem('riff_viz_style') || (localStorage.getItem('riff_viz_connected') === '1' ? 'wave' : 'bars');
  var cachedVizConnected = cachedVizStyle === 'wave';
  var cachedBarWaveEnabled = localStorage.getItem('riff_bar_wave') === '1';
  var cachedNpVizEnabled = localStorage.getItem('riff_np_viz') !== '0';
  var cachedProgressBgEnabled = localStorage.getItem('riff_progress_bg') !== 'false';
  var cachedBarVizBehind = (localStorage.getItem('riff_bar_viz_pos') || 'behind') === 'behind';

  function syncVizSettingsCache() {
    cachedVizStyle = localStorage.getItem('riff_viz_style') || (localStorage.getItem('riff_viz_connected') === '1' ? 'wave' : 'bars');
    cachedVizConnected = cachedVizStyle === 'wave';
    cachedBarWaveEnabled = localStorage.getItem('riff_bar_wave') === '1';
    cachedNpVizEnabled = localStorage.getItem('riff_np_viz') !== '0';
    cachedProgressBgEnabled = localStorage.getItem('riff_progress_bg') !== 'false';
    cachedBarVizBehind = document.body ? document.body.classList.contains('bar-viz-behind') : ((localStorage.getItem('riff_bar_viz_pos') || 'behind') === 'behind');
  }

  function isAnyVisualizerNeeded(overrideBarWave) {
    const barWave = typeof overrideBarWave === 'boolean' ? overrideBarWave : (localStorage.getItem('riff_bar_wave') === '1');
    const bassPulse = Boolean(state.vfx && state.vfx.bassPulse);
    const tvkVis = localStorage.getItem('riff_tvk_visualizer') === 'true' || localStorage.getItem('riff_tvk_visualizer_lyrics') === 'true';
    const isTvkOpen = state.currentView === 'lyrics' || Boolean(document.getElementById('tvk-view') && !document.getElementById('tvk-view').classList.contains('hidden'));
    const tvkActive = tvkVis && isTvkOpen;
    const npVis = localStorage.getItem('riff_np_viz') !== '0';
    const isNpOpen = Boolean(state.isRightPanelOpen && el.rightPanel && !el.rightPanel.classList.contains('hidden'));
    const npActive = npVis && isNpOpen;
    return barWave || bassPulse || tvkActive || npActive;
  }

  function getVizStyle() {
    return cachedVizStyle;
  }

  function isVizConnectedMode() {
    return cachedVizConnected;
  }
  var liquidWavePhase = 0;
  var liquidSpringNodes = new Float32Array(36);
  var liquidVelocityNodes = new Float32Array(36);

  function drawConnectedLiquidWave(ctx, w, h, heights, color) {
    const rawN = heights.length;
    if (!rawN || w <= 0 || h <= 0) return;
    liquidWavePhase += 0.075;

    const count = 34;
    if (!ctx.canvas._springNodes || ctx.canvas._springNodes.length !== count) {
      ctx.canvas._springNodes = new Float32Array(count);
    }
    const springNodes = ctx.canvas._springNodes;

    let peakEnergy = 0;
    for (let i = 0; i < rawN; i++) {
      if (heights[i] > peakEnergy) peakEnergy = heights[i];
    }
    const maxRef = Math.max(h * 0.55, 16);

    for (let i = 0; i < count; i++) {
      const normX = i / (count - 1);
      const centerDist = Math.abs(normX - 0.5) * 2;
      const isRightSide = normX >= 0.5;
      const mappedBin = isRightSide
        ? Math.pow(centerDist, 0.82) * Math.min(rawN - 1, 18)
        : Math.pow(centerDist, 0.78) * Math.min(rawN - 1, 15);
      const b0 = Math.floor(mappedBin);
      const b1 = Math.min(rawN - 1, b0 + 1);
      const frac = mappedBin - b0;
      const rawH = (heights[b0] || 0) * (1 - frac) + (heights[b1] || 0) * frac;

      const cleanSignal = Math.max(0, rawH - 0.5);
      const normSig = Math.min(1, cleanSignal / maxRef);
      const boosted = Math.pow(normSig, 0.55) * h * 0.92;

      const windowEnv = Math.pow(Math.sin(normX * Math.PI), 0.58);
      const harmonic = boosted > 0.6
        ? (Math.sin(i * 0.65 + liquidWavePhase) * 0.14 + Math.cos(i * 0.35 - liquidWavePhase * 1.3) * 0.09) * boosted
        : 0;
      const target = Math.max(0, Math.min(h - 1.5, (boosted + harmonic) * windowEnv));

      const cur = springNodes[i] || 0;
      if (target > cur) {
        springNodes[i] = cur + (target - cur) * 0.68;
      } else {
        springNodes[i] = cur + (target - cur) * 0.22;
      }
      if (springNodes[i] < 0.15) springNodes[i] = 0;
    }

    const pts = [{ x: 0, y: h }];
    const stepX = w / (count + 1);
    for (let i = 0; i < count; i++) {
      const nPrev = springNodes[Math.max(0, i - 1)];
      const nCur = springNodes[i];
      const nNext = springNodes[Math.min(count - 1, i + 1)];
      const val = nPrev * 0.2 + nCur * 0.6 + nNext * 0.2;
      pts.push({ x: (i + 1) * stepX, y: Math.max(1, h - val) });
    }
    pts.push({ x: w, y: h });

    ctx.save();
    if (color) ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      const tension = 0.18;
      const cp1x = p1.x + (p2.x - p0.x) * tension;
      const cp1y = Math.max(0.5, Math.min(h, p1.y + (p2.y - p0.y) * tension));
      const cp2x = p2.x - (p3.x - p1.x) * tension;
      const cp2y = Math.max(0.5, Math.min(h, p2.y - (p3.y - p1.y) * tension));
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  var swiftRot = 0;
  var swiftBars = new Float32Array(48);

  function drawSwiftVisualizer(ctx, w, h, freqData, color, isBottom = false) {
    if (!ctx || w <= 0 || h <= 0) return;
    const nowMs = performance.now();
    const dtRot = Math.min(0.05, Math.max(0, (nowMs - (window._lastSwiftRotMs || nowMs)) / 1000));
    window._lastSwiftRotMs = nowMs;
    swiftRot = (swiftRot + dtRot * 0.14) % (Math.PI * 2);

    const isTvk = Boolean(state && state.isTvKaraokeOpen);
    const isTvkNoLyrics = isTvk && Boolean(el.tvKaraoke && el.tvKaraoke.classList.contains('tv-nolyrics'));
    const isFullCircle = isTvkNoLyrics || (isTvk && Math.abs(w - h) < 140);
    const cx = w / 2;
    const maxR = Math.min(w, h) / 2;
    const barMax = isFullCircle ? (maxR * 0.28) : (h * 0.40);
    const R = isFullCircle ? Math.max(36, maxR - barMax - 18) : (isTvk ? Math.min(w * 0.32, h * 0.60) : Math.min(w * 0.44, Math.max(260, h * 3.6)));
    const cy = isFullCircle ? (h / 2) : (isTvk ? (h + 10) : (h + R * 0.84 - (h * 0.44)));
    const cookieR = (theta) => R * (0.84 + 0.08 * Math.cos(8 * (theta - swiftRot)));

    ctx.save();
    ctx.beginPath();
    const steps = 120;
    for (let s = 0; s <= steps; s++) {
      const a = (s / steps) * (Math.PI * 2);
      const r = cookieR(a);
      const px = cx + r * Math.cos(a);
      const py = cy + r * Math.sin(a);
      if (s === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.clip();

    if (m3c && m3c.imgReady && m3c.img) {
      try {
        ctx.drawImage(m3c.img, cx - R, cy - R, R * 2, R * 2);
      } catch (_) {
        ctx.fillStyle = color || '#ffffff';
        ctx.fill();
      }
    } else {
      ctx.fillStyle = color || '#ffffff';
      ctx.fill();
    }
    ctx.restore();

    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = color || '#ffffff';

    const hasData = Boolean(freqData && freqData.length);
    const halfArc = isTvk ? (Math.PI / 2) : Math.min(Math.PI * 0.46, Math.acos(Math.min(0.92, Math.max(0.1, (cy - h) / (R * 0.92)))));
    for (let i = 0; i < 48; i++) {
      const a = isFullCircle
        ? ((i / 48) * (Math.PI * 2) - Math.PI / 2)
        : (isTvk ? (-Math.PI + (i / 47) * Math.PI) : (-Math.PI / 2 - halfArc + (i / 47) * (2 * halfArc)));
      const centerIdx = i < 24 ? (23 - i) : (i - 24);
      let targetVal = 0;
      if (hasData) {
        const bin = Math.min(freqData.length - 1, centerIdx * 2);
        const bNext = Math.min(freqData.length - 1, bin + 1);
        const raw = ((freqData[bin] || 0) + (freqData[bNext] || 0)) * 0.5;
        targetVal = Math.min(1, Math.max(0, raw / 255));
      }
      const factor = targetVal > swiftBars[i] ? 0.45 : 0.18;
      swiftBars[i] += (targetVal - swiftBars[i]) * factor;

      const bassProximity = 1 - (centerIdx / 23);
      if (isFullCircle || isTvk) {
        ctx.lineWidth = 3.8 + Math.pow(bassProximity, 1.4) * 3.8;
      } else {
        ctx.lineWidth = 1.6 + Math.pow(bassProximity, 1.4) * 1.4;
      }

      const r0 = cookieR(a) + (isFullCircle ? 8 : (isTvk ? 8 : 5));
      const r1 = r0 + (isFullCircle ? 6 : (isTvk ? 6 : 5)) + swiftBars[i] * (isFullCircle ? barMax : (isTvk ? (h * 0.28) : (h * 0.40)));

      const x0 = cx + Math.cos(a) * r0;
      const y0 = cy + Math.sin(a) * r0;
      const x1 = cx + Math.cos(a) * r1;
      const y1 = cy + Math.sin(a) * r1;

      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
    ctx.restore();
  }

  var lastFrameTime = 0;
  function startVisualizers() {
    if (!state.isWindowVisible) return;
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    const anyVizNeeded = isAnyVisualizerNeeded();
    if (audioEngine && audioEngine.setAnalyserEnabled) {
      audioEngine.setAnalyserEnabled(anyVizNeeded);
    }

    const analyserNode = audioEngine && audioEngine.getAnalyserNode ? audioEngine.getAnalyserNode() : null;
    const miniCanvas = el.visualizerCanvas;
    const miniCtx = miniCanvas ? miniCanvas.getContext('2d') : null;
    const tvkCanvas = document.getElementById('tvk-visualizer-canvas');
    const tvkCtx = tvkCanvas ? tvkCanvas.getContext('2d') : null;
    const barBgCanvas = document.getElementById('bottom-visualizer') || document.getElementById('playbar-bg-visualizer');
    const barBgCtx = barBgCanvas ? barBgCanvas.getContext('2d') : null;
    const npCanvas = document.getElementById('np-visualizer-canvas');
    const npCtx = npCanvas ? npCanvas.getContext('2d') : null;

    if (el.rightPanel && !el.rightPanel._hasNpVizScroll) {
      el.rightPanel._hasNpVizScroll = true;
      el.rightPanel.addEventListener('scroll', () => {
        const c = document.getElementById('np-visualizer-canvas');
        if (c && el.rightPanel) c.style.transform = `translate3d(0, ${el.rightPanel.scrollTop}px, 0)`;
      }, { passive: true });
    }

    let bufferLength = analyserNode ? analyserNode.frequencyBinCount : 0;
    let freqData = bufferLength > 0 ? new Uint8Array(bufferLength) : null;

    function renderLoop(timestamp) {
      if (document.hidden || !state.isWindowVisible) {
        animationFrameId = null;
        if (audioEngine && audioEngine.setAnalyserEnabled) audioEngine.setAnalyserEnabled(false);
        return;
      }

      if (!state.isPlaying && !isDraggingScrubber) {
        if (hasDrawnPausedFrame) {
          animationFrameId = null;
          if (audioEngine && audioEngine.setAnalyserEnabled) audioEngine.setAnalyserEnabled(false);
          return;
        }
        hasDrawnPausedFrame = true;
      } else {
        hasDrawnPausedFrame = false;
      }

      animationFrameId = requestAnimationFrame(renderLoop);
      const dpr = window.devicePixelRatio || 1;

      try {
        const activeTrim = state.currentTrack ? getTrackTrim(state.currentTrack) : null;
        if (!state.isLoadingTrack && state.isPlaying && activeTrim && Number.isFinite(activeTrim.end) && activeTrim.end > (activeTrim.start || 0) + 1.5 && el.nativeAudio && !isDraggingScrubber) {
          if (activeTrim.start > 0 && el.nativeAudio.currentTime < activeTrim.start - 0.25) {
            el.nativeAudio.currentTime = activeTrim.start;
          } else if (activeTrim.end > activeTrim.start && el.nativeAudio.currentTime >= activeTrim.end) {
            if (state.isRepeat) {
              el.nativeAudio.currentTime = activeTrim.start;
              playSmooth();
            } else {
              state._isNaturalEnding = true;
              try { playNext(); } finally { state._isNaturalEnding = false; }
            }
            return;
          }
        }
      } catch (_) {}
      const ccPlayhead = el.ccPlayhead || (el.ccPlayhead = document.getElementById('cc-playhead'));
      if (ccPlayhead && typeof trackToDownload !== 'undefined' && trackToDownload && isSameTrack(state.currentTrack, trackToDownload) && typeof trimDraft !== 'undefined' && trimDraft && trimDraft.dur > 0) {
        const cur = el.nativeAudio ? (el.nativeAudio.currentTime || 0) : 0;
        const pct = Math.max(0, Math.min(100, (cur / trimDraft.dur) * 100));
        ccPlayhead.style.left = `${pct}%`;
        if (ccPlayhead.style.transform) ccPlayhead.style.transform = '';
      }

      const isPerfOrUnfocused = document.body.classList.contains('perf') || !document.hasFocus();
      const minFrameInterval = isPerfOrUnfocused ? 32 : 15.5;
      if (timestamp - lastFrameTime < minFrameInterval) return;
      lastFrameTime = timestamp;

      const isVisualizerVisible = miniCanvas && !cachedBarVizBehind && !state.isTvKaraokeOpen && !document.hidden && cachedBarWaveEnabled;
      const isTvkVisualizerVisible = state.isTvKaraokeOpen && tvkCanvas && !document.hidden;
      const isBehindVizVisible = (cachedBarVizBehind || document.body.classList.contains('viz-swift')) && cachedBarWaveEnabled && !document.body.classList.contains('mini') && !document.hidden;
      const isNpOpen = Boolean(state.isRightPanelOpen && el.rightPanel && !el.rightPanel.classList.contains('hidden'));
      const isNpVizVisible = cachedNpVizEnabled && isNpOpen && !state.isTvKaraokeOpen && !document.hidden;
      const needBassPulse = !!(state.vfx && state.vfx.bassPulse);
      const activeGap = cachedActiveGapEl;
      if (activeGap && state.isPlaying && state.syncedLyrics) {
        const curTime = getSmoothAudioTime();
        const lookAhead = state.isCustomLyrics ? 0.25 : 0.0;
        updateActiveGapProgress(activeGap, curTime + lookAhead);
      }

      if (!document.body.classList.contains('perf') && (isVisualizerVisible || isTvkVisualizerVisible || isBehindVizVisible || isNpVizVisible || needBassPulse)) {
        if (!freqData && audioEngine && audioEngine.getAnalyserNode) {
          const an = audioEngine.getAnalyserNode();
          if (an && an.frequencyBinCount) {
            freqData = new Uint8Array(an.frequencyBinCount);
          }
        }
        if (freqData && audioEngine && audioEngine.getFrequencyData) {
          audioEngine.getFrequencyData(freqData);

          let bassEnergy = (freqData[0] + freqData[1] + freqData[2] + freqData[3]) / (4 * 255);

          if (needBassPulse) {
            const scaleMul = 1.0 + (bassEnergy * 0.035);
            const targetTransform = `scale(${scaleMul.toFixed(3)})`;
            if (el.coverContainer && el.coverContainer.style.transform !== targetTransform) {
              el.coverContainer.style.transform = targetTransform;
            }
          } else {
            if (el.coverContainer && el.coverContainer.style.transform) el.coverContainer.style.transform = '';
          }

          try {
            if (miniCtx && miniCanvas && isVisualizerVisible && !state.isTvKaraokeOpen) {
              miniCanvasHasDrawn = true;
              miniCtx.clearRect(0, 0, 60, 24);
              if (state.isPlaying) {
                const barCount = 12;
                const barWidth = 3;
                const gap = 2;
                const startX = (60 - (barCount * (barWidth + gap))) / 2;
                const isConnected = isVizConnectedMode();
                const miniHeights = isConnected ? [] : null;

                for (let i = 0; i < barCount; i++) {
                  const val = freqData[i * 2] || 0;
                  let barHeight = (val / 255) * (24 - 4);
                  if (barHeight < 2) barHeight = 2;

                  if (isConnected) {
                    miniHeights.push(barHeight);
                  } else {
                    const x = startX + i * (barWidth + gap);
                    const y = 24 - barHeight;

                    miniCtx.fillStyle = '#ffffff';
                    miniCtx.beginPath();
                    miniCtx.roundRect(x, y, Math.max(0, barWidth), Math.max(0, barHeight), 2);
                    miniCtx.fill();
                  }
                }
                if (isConnected && miniHeights) {
                  drawConnectedLiquidWave(miniCtx, 52, 24, miniHeights, '#ffffff');
                }
              }
            }
          } catch (_) {}

          try {
            if (tvkCtx && tvkCanvas && isTvkVisualizerVisible) {
              tvkCanvasHasDrawn = true;
              const tvkVisColor = (state && state.tvkFg) || '#ffffff';
              if (!cachedTvkWidth && typeof resizeCanvases === 'function') {
                resizeCanvases();
              }
              const w = cachedTvkWidth || (tvkCanvas.width / (window.devicePixelRatio || 1)) || 600;
              const h = cachedTvkHeight || (tvkCanvas.height / (window.devicePixelRatio || 1)) || 64;

              tvkCtx.clearRect(0, 0, w, h);

              const vizStyle = getVizStyle();
              const isTvkNoLyrics = Boolean(el.tvKaraoke && el.tvKaraoke.classList.contains('tv-nolyrics'));
              if (isTvkNoLyrics || vizStyle === 'swift') {
                drawSwiftVisualizer(tvkCtx, w, h, (state.isPlaying ? freqData : null), tvkVisColor);
              } else if (state.isPlaying && freqData) {
                const data = freqData;
                const { smooth, sens } = vizSettings();
                if (!vizPrev || vizPrev.length !== data.length) vizPrev = new Float32Array(data.length);
                for (let i = 0; i < data.length; i++) {
                  const v = Math.min(255, data[i] * sens);
                  vizPrev[i] = vizPrev[i] * smooth + v * (1 - smooth);
                }

                const barCount = 28;
                if (!tvkSmoothedHeights || tvkSmoothedHeights.length !== barCount) {
                  tvkSmoothedHeights = new Float32Array(barCount);
                }

                const gap = Math.max(3, Math.min(6, Math.round(w / 115)));
                const totalGap = gap * (barCount - 1);
                const barWidth = Math.max(4, Math.floor((w - totalGap) / barCount));
                const usedWidth = barCount * barWidth + totalGap;
                const startX = Math.max(0, (w - usedWidth) / 2);
                const minHeight = 4;
                const usableHeight = Math.max(10, h - minHeight - 2);

                const isConn = isVizConnectedMode();
                for (let i = 0; i < barCount; i++) {
                  const b0 = i * 2;
                  const b1 = Math.min(63, b0 + 1);
                  const raw = ((vizPrev[b0] || 0) + (vizPrev[b1] || 0)) * 0.5;

                  const norm = raw / 255;
                  const compressed = Math.pow(norm, 1.3) * 0.78;
                  const targetHeight = minHeight + compressed * usableHeight;

                  const barH = targetHeight;
                  tvkSmoothedHeights[i] = barH;

                  if (!isConn) {
                    const x = startX + i * (barWidth + gap);
                    const y = h - barH;

                    tvkCtx.fillStyle = tvkVisColor;
                    tvkCtx.beginPath();
                    tvkCtx.roundRect(x, y, Math.max(0, barWidth), Math.max(0, barH), Math.max(0, Math.min(barWidth / 2, 3)));
                    tvkCtx.fill();
                  }
                }
                if (isConn) {
                  tvkCtx.save();
                  tvkCtx.translate(startX, 0);
                  drawConnectedLiquidWave(tvkCtx, usedWidth, h, tvkSmoothedHeights, tvkVisColor);
                  tvkCtx.restore();
                }
              } else if (tvkSmoothedHeights) {
                let anyActive = false;
                const barCount = tvkSmoothedHeights.length;
                const gap = Math.max(3, Math.min(6, Math.round(w / 115)));
                const totalGap = gap * (barCount - 1);
                const barWidth = Math.max(4, Math.floor((w - totalGap) / barCount));
                const usedWidth = barCount * barWidth + totalGap;
                const startX = Math.max(0, (w - usedWidth) / 2);
                const minHeight = 4;

                const isConn = isVizConnectedMode();
                for (let i = 0; i < barCount; i++) {
                  tvkSmoothedHeights[i] += (minHeight - tvkSmoothedHeights[i]) * 0.15;
                  if (tvkSmoothedHeights[i] > minHeight + 0.5) anyActive = true;

                  if (!isConn) {
                    const barH = tvkSmoothedHeights[i];
                    const x = startX + i * (barWidth + gap);
                    const y = h - barH;

                    tvkCtx.fillStyle = tvkVisColor;
                    tvkCtx.beginPath();
                    tvkCtx.roundRect(x, y, Math.max(0, barWidth), Math.max(0, barH), Math.max(0, Math.min(barWidth / 2, 3)));
                    tvkCtx.fill();
                  }
                }
                if (isConn) {
                  tvkCtx.save();
                  tvkCtx.translate(startX, 0);
                  drawConnectedLiquidWave(tvkCtx, usedWidth, h, tvkSmoothedHeights, tvkVisColor);
                  tvkCtx.restore();
                }
                if (!anyActive) {
                  tvkSmoothedHeights = null;
                }
              }
            }
          } catch (_) {}

          try {
            if (barBgCtx && barBgCanvas && isBehindVizVisible && !state.isTvKaraokeOpen) {
              barBgCanvasHasDrawn = true;
              const bw = (barBgCanvas.width / (window.devicePixelRatio || 1)) || 200;
              const bh = (barBgCanvas.height / (window.devicePixelRatio || 1)) || 88;
              barBgCtx.clearRect(0, 0, bw, bh);

              const vizStyle = getVizStyle();
              const color = cachedPrimaryColor || '#ffffff';
              if (vizStyle === 'swift') {
                drawSwiftVisualizer(barBgCtx, bw, bh, (state.isPlaying ? freqData : null), color);
              } else if (state.isPlaying && freqData) {
                const { smooth, sens } = vizSettings();
                const halfCount = 26;
                if (!barBgSmoothedHeights || barBgSmoothedHeights.length !== halfCount) {
                  barBgSmoothedHeights = new Float32Array(halfCount);
                }
                const usableHeight = bh - 6;
                const minHeight = 3;
                for (let i = 0; i < halfCount; i++) {
                  const b0 = i * 2;
                  const b1 = Math.min(freqData.length - 1, b0 + 1);
                  const raw = (((freqData[b0] || 0) + (freqData[b1] || 0)) * 0.5) * sens;
                  const norm = Math.min(1, Math.max(0, raw / 255));
                  const targetH = minHeight + Math.pow(norm, 1.25) * usableHeight;
                  barBgSmoothedHeights[i] = barBgSmoothedHeights[i] * smooth + targetH * (1 - smooth);
                }

                const symCount = halfCount * 2;
                const symHeights = new Float32Array(symCount);
                for (let i = 0; i < halfCount; i++) {
                  const hVal = barBgSmoothedHeights[i];
                  symHeights[halfCount - 1 - i] = hVal;
                  symHeights[halfCount + i] = hVal;
                }

                const isConn = isVizConnectedMode();
                barBgCtx.fillStyle = color;
                if (isConn) {
                  drawConnectedLiquidWave(barBgCtx, bw, bh, symHeights, color);
                } else {
                  const gap = 2;
                  const totalGap = gap * (symCount - 1);
                  const barW = Math.max(2, (bw - totalGap) / symCount);
                  const actualTotal = symCount * barW + totalGap;
                  const startX = Math.max(0, (bw - actualTotal) / 2);
                  for (let i = 0; i < symCount; i++) {
                    const barH = Math.max(2, Math.min(bh - 2, symHeights[i]));
                    const x = startX + i * (barW + gap);
                    barBgCtx.beginPath();
                    barBgCtx.roundRect(x, bh - barH, Math.max(0, barW), Math.max(0, barH), 3);
                    barBgCtx.fill();
                  }
                }
              } else if (barBgSmoothedHeights) {
                let anyActive = false;
                const halfCount = 26;
                const minHeight = 3;
                for (let i = 0; i < halfCount; i++) {
                  barBgSmoothedHeights[i] += (minHeight - barBgSmoothedHeights[i]) * 0.15;
                  if (barBgSmoothedHeights[i] > minHeight + 0.5) anyActive = true;
                }
                const symCount = halfCount * 2;
                const symHeights = new Float32Array(symCount);
                for (let i = 0; i < halfCount; i++) {
                  const hVal = barBgSmoothedHeights[i];
                  symHeights[halfCount - 1 - i] = hVal;
                  symHeights[halfCount + i] = hVal;
                }
                const isConn = isVizConnectedMode();
                barBgCtx.fillStyle = color;
                if (isConn) {
                  drawConnectedLiquidWave(barBgCtx, bw, bh, symHeights, color);
                } else {
                  const gap = 2;
                  const totalGap = gap * (symCount - 1);
                  const barW = Math.max(2, (bw - totalGap) / symCount);
                  const actualTotal = symCount * barW + totalGap;
                  const startX = Math.max(0, (bw - actualTotal) / 2);
                  for (let i = 0; i < symCount; i++) {
                    const barH = Math.max(2, Math.min(bh - 2, symHeights[i]));
                    const x = startX + i * (barW + gap);
                    barBgCtx.beginPath();
                    barBgCtx.roundRect(x, bh - barH, Math.max(0, barW), Math.max(0, barH), 3);
                    barBgCtx.fill();
                  }
                }
                if (!anyActive) {
                  barBgSmoothedHeights = null;
                }
              }
            }
          } catch (_) {}

          try {
            if (npCtx && npCanvas && isNpVizVisible && !state.isTvKaraokeOpen) {
              npCanvasHasDrawn = true;
              const dpr = window.devicePixelRatio || 1;
              const nw = (npCanvas.width / dpr) || 320;
              const nh = (npCanvas.height / dpr) || 480;
              npCtx.clearRect(0, 0, nw, nh);

              const vizH = Math.min(115, Math.round(nh * 0.22));
              npCtx.save();
              npCtx.translate(0, nh - vizH);

              const vizStyle = getVizStyle();
              const color = cachedPrimaryColor || '#ffffff';
              if (vizStyle === 'swift') {
                drawSwiftVisualizer(npCtx, nw, vizH, (state.isPlaying ? freqData : null), color, true);
              } else {
                const targetArea = vizH;
                const halfCount = 26;
                const symCount = halfCount * 2;
                const symHeights = new Float32Array(symCount);
                const minH = 3;
                const usableH = targetArea - 6;

                let npSmoothed = window._npSmoothedHeights;
                if (!npSmoothed || npSmoothed.length !== halfCount) {
                  npSmoothed = window._npSmoothedHeights = new Float32Array(halfCount);
                }

                if (state.isPlaying && freqData) {
                  const { smooth, sens } = vizSettings();
                  const smoothFactor = Math.min(0.95, Math.max(0.05, 1 - (smooth || 0.6) * 0.85));
                  for (let i = 0; i < halfCount; i++) {
                    const b0 = i * 2;
                    const b1 = Math.min(freqData.length - 1, b0 + 1);
                    const raw = (((freqData[b0] || 0) + (freqData[b1] || 0)) * 0.5) * sens;
                    const norm = Math.min(1, Math.max(0, raw / 255));
                    const targetH = minH + Math.pow(norm, 1.25) * usableH;
                    npSmoothed[i] += (targetH - npSmoothed[i]) * smoothFactor;
                    symHeights[halfCount - 1 - i] = npSmoothed[i];
                    symHeights[halfCount + i] = npSmoothed[i];
                  }
                } else {
                  for (let i = 0; i < halfCount; i++) {
                    npSmoothed[i] += (minH - npSmoothed[i]) * 0.2;
                    symHeights[halfCount - 1 - i] = npSmoothed[i];
                    symHeights[halfCount + i] = npSmoothed[i];
                  }
                }

                const isConn = isVizConnectedMode();
                npCtx.fillStyle = color;
                if (isConn) {
                  drawConnectedLiquidWave(npCtx, nw, vizH, symHeights, color);
                } else {
                  const gap = 2;
                  const totalGap = gap * (symCount - 1);
                  const barW = Math.max(2, (nw - totalGap) / symCount);
                  const actualTotal = symCount * barW + totalGap;
                  const startX = Math.max(0, (nw - actualTotal) / 2);
                  for (let i = 0; i < symCount; i++) {
                    const barH = Math.max(2, Math.min(vizH - 2, symHeights[i]));
                    const x = startX + i * (barW + gap);
                    npCtx.beginPath();
                    npCtx.roundRect(x, vizH - barH, Math.max(0, barW), Math.max(0, barH), 3);
                    npCtx.fill();
                  }
                }
              }
              npCtx.restore();
            }
          } catch (_) {}
        }
      } else {
        if (audioEngine && audioEngine.setAnalyserEnabled && !isAnyVisualizerNeeded() && !activeGap) audioEngine.setAnalyserEnabled(false);
        if (el.coverContainer && el.coverContainer.style.transform) el.coverContainer.style.transform = '';
        try { if (miniCtx && miniCanvas && miniCanvasHasDrawn) { miniCtx.clearRect(0, 0, 60, 24); miniCanvasHasDrawn = false; } } catch (_) {}
        try {
          if (tvkCtx && tvkCanvas && tvkCanvasHasDrawn) {
            const w = cachedTvkWidth || (tvkCanvas.width / (window.devicePixelRatio || 1)) || 500;
            const h = cachedTvkHeight || (tvkCanvas.height / (window.devicePixelRatio || 1)) || 64;
            tvkCtx.clearRect(0, 0, w, h);
            tvkCanvasHasDrawn = false;
          }
        } catch (_) {}
        try {
          if (barBgCtx && barBgCanvas && barBgCanvasHasDrawn) {
            const bw = (barBgCanvas.width / (window.devicePixelRatio || 1)) || 200;
            const bh = (barBgCanvas.height / (window.devicePixelRatio || 1)) || 88;
            barBgCtx.clearRect(0, 0, bw, bh);
            barBgCanvasHasDrawn = false;
          }
        } catch (_) {}
        try {
          if (npCtx && npCanvas && npCanvasHasDrawn) {
            const nw = (npCanvas.width / (window.devicePixelRatio || 1)) || 320;
            const nh = (npCanvas.height / (window.devicePixelRatio || 1)) || 480;
            npCtx.clearRect(0, 0, nw, nh);
            npCanvasHasDrawn = false;
          }
        } catch (_) {}
      }

      let scrubberCanvas = el.scrubberCanvas || (el.scrubberCanvas = document.getElementById('squiggly-canvas'));
      if (scrubberCanvas && el.scrubberTrack) {
        const liveW = el.scrubberTrack.clientWidth;
        if (liveW > 0 && Math.abs(liveW - cachedTrackWidth) > 1) {
          resizeCanvases();
        }
        const sCtx = scrubberCanvas.getContext('2d');
        const sw = cachedTrackWidth || liveW || 0;
        const sh = cachedTrackHeight || 40;
        if (!state.isTvKaraokeOpen) sCtx.clearRect(0, 0, sw, sh);

        const nowMs = performance.now();
        const dt = (scrubLastTime <= 0 || nowMs <= scrubLastTime) ? 0.016 : Math.min((nowMs - scrubLastTime) / 1000, 0.05);
        scrubLastTime = nowMs;

        const dur = getReliableTrackDuration();
        let cur = (el.nativeAudio && Number.isFinite(el.nativeAudio.currentTime)) ? el.nativeAudio.currentTime : 0;
        if (isPauseFading) {
          cur = frozenCurTime;
        }

        if (isDraggingScrubber && state.scrubberDragTargetTime !== undefined) {
          cur = state.scrubberDragTargetTime;
          const t = formatDuration(cur);
          if (el.timeCurrent && el.timeCurrent.textContent !== t) el.timeCurrent.textContent = t;
          if (el.tvkTimeCurrent && el.tvkTimeCurrent.textContent !== t) el.tvkTimeCurrent.textContent = t;
          if (el.tvkSeekSlider && !isDraggingTvkSeek && dur > 0) {
            const val = Math.round((cur / dur) * 1000);
            if (el.tvkSeekSlider.value != val) el.tvkSeekSlider.value = val;
          }
        } else if (state.isPlaying) {
          const roundedSec = Math.floor(cur);
          if (lastDisplayedSec !== roundedSec) {
            lastDisplayedSec = roundedSec;
            const t = formatDuration(cur);
            if (el.timeCurrent && el.timeCurrent.textContent !== t) el.timeCurrent.textContent = t;
            if (el.tvkTimeCurrent && el.tvkTimeCurrent.textContent !== t) el.tvkTimeCurrent.textContent = t;
          }
          const roundedDur = Math.floor(dur);
          if (dur > 0 && lastDisplayedDur !== roundedDur) {
            lastDisplayedDur = roundedDur;
            const d = formatDuration(dur);
            if (el.timeDuration && el.timeDuration.textContent !== d) el.timeDuration.textContent = d;
            if (el.tvkTimeDuration && el.tvkTimeDuration.textContent !== d) el.tvkTimeDuration.textContent = d;
          }
          if (el.tvkSeekSlider && !isDraggingTvkSeek && dur > 0) {
            const val = Math.round((cur / dur) * 1000);
            if (el.tvkSeekSlider.value != val) el.tvkSeekSlider.value = val;
          }
          if (cur > 5 && !state.nextTrackPrefetched) {
            state.nextTrackPrefetched = true;
            prefetchNextQueueTrack();
          }
          if ((state.isTvKaraokeOpen || (state.isRightPanelOpen && el.rightPanel && !el.rightPanel.classList.contains('hidden'))) && state.syncedLyrics && state.syncedLyrics.length > 0) {
            const smoothCur = state.isPlaying ? getSmoothAudioTime() : cur;
            updateSyncedLyricsHighlight(smoothCur);
          }
        }

        if (state.currentTrack) {
          const momentTime = typeof getTopMoment === 'function' ? getTopMoment(state.currentTrack) : null;
          if (momentTime !== null && dur > 0) {
            const pin1 = document.getElementById('top-moment-pin');
            if (pin1 && pin1.classList.contains('visible')) {
              const trackW = sw || (el.scrubberTrack ? el.scrubberTrack.clientWidth : 0);
              if (trackW > 0) {
                const padLeft = 5.5;
                const padRight = 5.5;
                const trackWidth = Math.max(0, trackW - padLeft - padRight);
                const curPx = padLeft + Math.max(0, Math.min(1, cur / dur)) * trackWidth;
                const momentPx = padLeft + Math.max(0, Math.min(1, momentTime / dur)) * trackWidth;
                const fillPct = Math.max(0, Math.min(100, ((curPx - (momentPx - 9)) / 18) * 100));
                const fillStr = `${fillPct.toFixed(1)}%`;
                if (pin1._lastFill !== fillStr) {
                  pin1._lastFill = fillStr;
                  pin1.style.setProperty('--fill-pct', fillStr);
                }
              }
            }
            const pin2 = document.getElementById('tvk-top-moment-pin');
            if (pin2 && pin2.classList.contains('visible')) {
              const tvkW = cachedTvkProgWidth || 0;
              if (tvkW > 0) {
                const padLeft = 10;
                const padRight = 10;
                const trackWidth = Math.max(0, tvkW - padLeft - padRight);
                const tvkCurPx = padLeft + Math.max(0, Math.min(1, cur / dur)) * trackWidth;
                const tvkMomentPx = padLeft + Math.max(0, Math.min(1, momentTime / dur)) * trackWidth;
                const tvkFillPct = Math.max(0, Math.min(100, ((tvkCurPx - (tvkMomentPx - 9)) / 18) * 100));
                const fillStr = `${tvkFillPct.toFixed(1)}%`;
                if (pin2._lastFill !== fillStr) {
                  pin2._lastFill = fillStr;
                  pin2.style.setProperty('--fill-pct', fillStr);
                }
                const leftStr = `${tvkMomentPx}px`;
                if (pin2._lastLeft !== leftStr) {
                  pin2._lastLeft = leftStr;
                  pin2.style.left = leftStr;
                  pin2.style.top = '50%';
                }
              }
            }
          }
        }

        if (!state.isTvKaraokeOpen) {
          const targetProgress = dur > 0 ? Math.max(0, Math.min(1, cur / dur)) : 0;
          if (isDraggingScrubber) {
            scrubProgress = targetProgress;
          } else {
            scrubProgress += (targetProgress - scrubProgress) * Math.min(1, dt * 45);
          }
          scrubProgress = Math.max(0, Math.min(1, Number.isFinite(scrubProgress) ? scrubProgress : 0));

          const targetAnim = isDraggingScrubber ? 1 : 0;
          scrubKnobAnim += (targetAnim - scrubKnobAnim) * Math.min(1, Math.max(0, dt * 16));
          scrubKnobAnim = Math.max(0, Math.min(1, Number.isFinite(scrubKnobAnim) ? scrubKnobAnim : 0));
          const curKnobW = 7.5 + (9.0 - 7.5) * scrubKnobAnim;
          const curKnobH = 24 + (32 - 24) * scrubKnobAnim;
          const curKnobR = Math.max(0, 3.75 + (4.5 - 3.75) * scrubKnobAnim);

          const targetThick = (isDraggingScrubber || isHoveringScrubber) ? 1 : 0;
          scrubThicknessAnim += (targetThick - scrubThicknessAnim) * Math.min(1, Math.max(0, dt * 14));
          scrubThicknessAnim = Math.max(0, Math.min(1, Number.isFinite(scrubThicknessAnim) ? scrubThicknessAnim : 0));
          const currentLineWidth = 5.5 + (8.5 - 5.5) * scrubThicknessAnim;

          const padLeft = 5.5;
          const padRight = 5.5;
          const trackWidth = Math.max(0, sw - padLeft - padRight);
          const knobCenterX = Math.max(padLeft, Math.min(sw - padRight, padLeft + scrubProgress * trackWidth));

          if (scrubPrevKnobX === null) scrubPrevKnobX = knobCenterX;
          const deltaX = knobCenterX - scrubPrevKnobX;
          scrubPrevKnobX = knobCenterX;

          const k = (2 * Math.PI) / 42;

          if (state.isPlaying) {
            scrubPhase = (scrubPhase + 3.5 * dt) % (Math.PI * 200);
          }

          const noKnob = document.body.classList.contains('no-knob');
          const waveStart = padLeft;
          const waveEnd = knobCenterX;
          const bgEndX = sw - padRight;

          if (!cachedPrimaryColor) refreshCachedThemeColors();
          const primaryColor = cachedPrimaryColor;
          const dimColor = cachedDimColor;

          const centerY = sh / 2;

          const showProgressBg = cachedProgressBgEnabled;
          sCtx.shadowBlur = 0;
          sCtx.shadowColor = 'transparent';

          if (showProgressBg && padLeft < bgEndX - 1) {
            sCtx.save();
            sCtx.shadowBlur = 0;
            sCtx.shadowColor = 'transparent';
            sCtx.globalAlpha = 0.20;
            sCtx.beginPath();
            sCtx.lineWidth = currentLineWidth;
            sCtx.lineCap = 'round';
            sCtx.strokeStyle = '#ffffff';
            sCtx.moveTo(padLeft, centerY);
            sCtx.lineTo(bgEndX, centerY);
            sCtx.stroke();
            sCtx.restore();
          }

          if (waveEnd > waveStart) {
            sCtx.save();
            sCtx.shadowBlur = 0;
            sCtx.shadowColor = 'transparent';
            sCtx.beginPath();
            sCtx.lineWidth = currentLineWidth;
            sCtx.lineCap = 'round';
            sCtx.lineJoin = 'round';
            sCtx.strokeStyle = '#ffffff';

            const isWavy = !document.body.classList.contains('no-wavy') && localStorage.getItem('riff_wavy_progress') === 'true';
            if (!isWavy) {
              sCtx.moveTo(waveStart, centerY);
              sCtx.lineTo(waveEnd, centerY);
              sCtx.stroke();
            } else {
              const step = 2;
              for (let x = waveStart; x <= waveEnd; x += step) {
                const angle = (x - waveStart) * k + scrubPhase;
                const y = centerY + Math.sin(angle) * 3;
                if (x === waveStart) {
                  sCtx.moveTo(x, y);
                } else {
                  sCtx.lineTo(x, y);
                }
              }
              const finalY = centerY + Math.sin((waveEnd - waveStart) * k + scrubPhase) * 3;
              sCtx.lineTo(waveEnd, finalY);
              sCtx.stroke();
            }
            sCtx.restore();
          }

          if (state.currentTrack) {
            const momentTime = typeof getTopMoment === 'function' ? getTopMoment(state.currentTrack) : null;
            if (momentTime !== null && dur > 0) {
              const pin1 = document.getElementById('top-moment-pin');
              if (pin1 && pin1.classList.contains('visible')) {
                const trackW = sw || (el.scrubberTrack ? el.scrubberTrack.clientWidth : 0);
                if (trackW > 0) {
                  const padLeft = 5.5;
                  const padRight = 5.5;
                  const trackWidth = Math.max(0, trackW - padLeft - padRight);
                  const momentPx = padLeft + Math.max(0, Math.min(1, momentTime / dur)) * trackWidth;
                  sCtx.save();
                  sCtx.globalCompositeOperation = 'destination-out';
                  sCtx.beginPath();
                  sCtx.arc(momentPx, centerY, 9.5, 0, Math.PI * 2);
                  sCtx.fill();
                  sCtx.restore();
                }
              }
            }
          }

          
          const isKnobExplicit = !noKnob && localStorage.getItem('riff_progress_knob') === 'true';
          const showKnob = isKnobExplicit && (isDraggingScrubber || isHoveringScrubber);
          if (showKnob) {
            sCtx.beginPath();
            sCtx.arc(knobCenterX, centerY, 6.5, 0, Math.PI * 2);
            sCtx.fillStyle = '#ffffff';
            sCtx.fill();
          }
        } else {
          const tvkScrubber = cachedTvkScrubber || (cachedTvkScrubber = document.getElementById('tvk-squiggly-canvas'));
          if (tvkScrubber && (!el.tvKaraoke || !el.tvKaraoke.classList.contains('tv-idle') || isDraggingScrubber || isHoveringTvkScrubber)) {
            const tCtx = tvkScrubber.getContext('2d');
            const tvkRow = document.getElementById('tvk-progress-row');
            const actualTvkW = (tvkRow && tvkRow.clientWidth > 0) ? Math.round(tvkRow.clientWidth) : (cachedTvkProgWidth || 320);
            const curDpr = (typeof window.__getDpr === 'function') ? window.__getDpr() : (window.devicePixelRatio || 1);
            const targetCanvasW = Math.round(actualTvkW * curDpr);
            const targetCanvasH = Math.round(36 * curDpr);
            if (actualTvkW > 0 && (tvkScrubber.width !== targetCanvasW || tvkScrubber.height !== targetCanvasH)) {
              cachedTvkProgWidth = actualTvkW;
              tvkScrubber.width = targetCanvasW;
              tvkScrubber.height = targetCanvasH;
            }
            tCtx.setTransform(curDpr, 0, 0, curDpr, 0, 0);
            const tw = actualTvkW;
            const th = 36;
            tCtx.clearRect(0, 0, tw, th);

            const targetProgress = dur > 0 ? Math.max(0, Math.min(1, cur / dur)) : 0;
            const followSpeed = isDraggingScrubber ? 32 : 45;
            scrubProgress += (targetProgress - scrubProgress) * Math.min(1, dt * followSpeed);
            scrubProgress = Math.max(0, Math.min(1, Number.isFinite(scrubProgress) ? scrubProgress : 0));

            const targetAnim = isDraggingScrubber ? 1 : 0;
            scrubKnobAnim += (targetAnim - scrubKnobAnim) * Math.min(1, Math.max(0, dt * 16));
            scrubKnobAnim = Math.max(0, Math.min(1, Number.isFinite(scrubKnobAnim) ? scrubKnobAnim : 0));
            const curKnobW = 7.5 + (9.0 - 7.5) * scrubKnobAnim;
            const curKnobH = 24 + (32 - 24) * scrubKnobAnim;
            const curKnobR = Math.max(0, 3.75 + (4.5 - 3.75) * scrubKnobAnim);

            const targetTvkThick = (isDraggingScrubber || isHoveringTvkScrubber) ? 1 : 0;
            tvkThicknessAnim += (targetTvkThick - tvkThicknessAnim) * Math.min(1, Math.max(0, dt * 14));
            tvkThicknessAnim = Math.max(0, Math.min(1, Number.isFinite(tvkThicknessAnim) ? tvkThicknessAnim : 0));
            const currentTvkLineWidth = 5.5 + (8.5 - 5.5) * tvkThicknessAnim;

            const padLeft = 10;
            const padRight = 10;
            const trackWidth = Math.max(0, tw - padLeft - padRight);
            const knobCenterX = Math.max(padLeft, Math.min(tw - padRight, padLeft + scrubProgress * trackWidth));

            if (scrubPrevKnobX === null) scrubPrevKnobX = knobCenterX;
            const deltaX = knobCenterX - scrubPrevKnobX;
            scrubPrevKnobX = knobCenterX;

            const k = (2 * Math.PI) / 42;

            if (state.isPlaying) {
              scrubPhase = (scrubPhase + 3.5 * dt) % (Math.PI * 200);
            }

            const noKnob = document.body.classList.contains('no-knob');
            const waveStart = padLeft;
            const waveEnd = knobCenterX;
            const bgEndX = tw - padRight;

            const centerY = th / 2;
            const tvkFgColor = (state && state.tvkFg) || '#ffffff';

            tCtx.save();
            tCtx.shadowBlur = 0;
            tCtx.shadowColor = 'transparent';
            tCtx.globalAlpha = 0.20;
            tCtx.beginPath();
            tCtx.lineWidth = currentTvkLineWidth;
            tCtx.lineCap = 'round';
            tCtx.strokeStyle = '#ffffff';
            tCtx.moveTo(padLeft, centerY);
            tCtx.lineTo(bgEndX, centerY);
            tCtx.stroke();
            tCtx.restore();

            if (waveEnd > waveStart) {
              tCtx.save();
              tCtx.shadowBlur = 0;
              tCtx.shadowColor = 'transparent';
              tCtx.beginPath();
              tCtx.lineWidth = currentTvkLineWidth;
              tCtx.lineCap = 'round';
              tCtx.lineJoin = 'round';
              tCtx.strokeStyle = '#ffffff';

              const isTvkWavy = !document.body.classList.contains('no-wavy') && localStorage.getItem('riff_wavy_progress') === 'true';
              if (!isTvkWavy) {
                tCtx.moveTo(waveStart, centerY);
                tCtx.lineTo(waveEnd, centerY);
                tCtx.stroke();
              } else {
                const step = 2;
                for (let x = waveStart; x <= waveEnd; x += step) {
                  const angle = (x - waveStart) * k + scrubPhase;
                  const y = centerY + Math.sin(angle) * 3;
                  if (x === waveStart) {
                    tCtx.moveTo(x, y);
                  } else {
                    tCtx.lineTo(x, y);
                  }
                }
                const finalY = centerY + Math.sin((waveEnd - waveStart) * k + scrubPhase) * 3;
                tCtx.lineTo(waveEnd, finalY);
                tCtx.stroke();
              }
              tCtx.restore();
            }

            if (state.currentTrack) {
              const tvkMomentTime = typeof getTopMoment === 'function' ? getTopMoment(state.currentTrack) : null;
              if (tvkMomentTime !== null && dur > 0) {
                const pin2 = document.getElementById('tvk-top-moment-pin');
                if (pin2 && pin2.classList.contains('visible')) {
                  const padLeft = 10;
                  const padRight = 10;
                  const trackWidth = Math.max(0, tw - padLeft - padRight);
                  const tvkCurPx = padLeft + Math.max(0, Math.min(1, cur / dur)) * trackWidth;
                  const tvkMomentPx = padLeft + Math.max(0, Math.min(1, tvkMomentTime / dur)) * trackWidth;
                  tCtx.save();
                  tCtx.globalCompositeOperation = 'destination-out';
                  tCtx.beginPath();
                  tCtx.arc(tvkMomentPx, centerY, 9.5, 0, Math.PI * 2);
                  tCtx.fill();
                  tCtx.restore();

                  pin2.style.left = tvkMomentPx + 'px';
                  pin2.style.top = centerY + 'px';
                  const tvkFillPct = Math.max(0, Math.min(100, ((tvkCurPx - (tvkMomentPx - 9)) / 18) * 100));
                  const fillStr = `${tvkFillPct.toFixed(1)}%`;
                  if (pin2._lastFill !== fillStr) {
                    pin2._lastFill = fillStr;
                    pin2.style.setProperty('--fill-pct', fillStr);
                  }
                }
              }
            }

            
            const isTvkKnobExplicit = !noKnob && localStorage.getItem('riff_progress_knob') === 'true';
            const showTvkKnob = isTvkKnobExplicit && (isDraggingScrubber || isHoveringTvkScrubber);
            if (showTvkKnob) {
              tCtx.beginPath();
              tCtx.arc(knobCenterX, centerY, 6.5, 0, Math.PI * 2);
              tCtx.fillStyle = '#ffffff';
              tCtx.fill();
            }
          }
        }
      }
    }
    animationFrameId = requestAnimationFrame(renderLoop);
  }

  function handleVisibilityChange(visible) {
    state.isWindowVisible = visible;
    syncBgVideoPlayback();
    if (audioEngine && audioEngine.setHidden) audioEngine.setHidden(!visible);
    if (!visible) {
      if (typeof lyricsScrollRaf !== 'undefined' && lyricsScrollRaf) {
        cancelAnimationFrame(lyricsScrollRaf);
        lyricsScrollRaf = 0;
      }
      if (typeof gradientRaf !== 'undefined' && gradientRaf) {
        cancelAnimationFrame(gradientRaf);
        gradientRaf = 0;
      }
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      if (typeof cacheRafId !== 'undefined' && cacheRafId) {
        cancelAnimationFrame(cacheRafId);
        cacheRafId = 0;
      }
      document.body.classList.add('app-paused');
      document.body.classList.add('hidden-window');
      if (typeof updateCoverAnimVisibility === 'function') updateCoverAnimVisibility();
      window.electronAPI?.clearWebFrameCache?.();
    } else {
      document.body.classList.remove('app-paused');
      document.body.classList.remove('hidden-window');
      if (typeof updateCoverAnimVisibility === 'function') updateCoverAnimVisibility();
      resizeCanvases();
      hasDrawnPausedFrame = false;
      if (state.isPlaying || isDraggingScrubber) startVisualizers();
      if (typeof cacheModal !== 'undefined' && cacheModal && cacheModal.classList.contains('visible') && typeof cacheRafId !== 'undefined' && !cacheRafId) {
        cacheRafId = requestAnimationFrame(cacheFrame);
      }
      if (typeof updateLyricsPadding === 'function') {
        const syncOnRestore = () => {
          updateLyricsPadding();
          state.forceSnapLyrics = true;
          state.forceLyricsScroll = true;
          state.lastActiveLyricIdx = -1;
          if (el.nativeAudio) updateSyncedLyricsHighlight(el.nativeAudio.currentTime || 0);
        };
        syncOnRestore();
        requestAnimationFrame(syncOnRestore);
        setTimeout(syncOnRestore, 80);
        setTimeout(syncOnRestore, 220);
      }
    }
  }

  document.addEventListener('visibilitychange', () => {
    handleVisibilityChange(!document.hidden);
  });

  if (window.electronAPI && window.electronAPI.onWindowVisibility) {
    window.electronAPI.onWindowVisibility(visible => handleVisibilityChange(visible));
  }

  var setUnfocused = (unfocused) => {
    if (unfocused === document.body.classList.contains('unfocused')) return;
    document.body.classList.toggle('unfocused', unfocused);
  };

  var triggerRendererMemoryTrim = () => {
    try {
      if (typeof window.gc === 'function') {
        window.gc();
      }
    } catch (_) {}
  };

  window.addEventListener('blur', () => {
    setUnfocused(true);
    setTimeout(triggerRendererMemoryTrim, 800);
  });
  window.addEventListener('focus', () => setUnfocused(false));
  setInterval(triggerRendererMemoryTrim, 30 * 1000);


  function updateScrubberPositionFromEvent(e) {
    if (!el.scrubberTrack) return 0;
    const rect = el.scrubberTrack.getBoundingClientRect();
    const scale = rect.width > 0 && el.scrubberTrack.clientWidth > 0
      ? (rect.width / el.scrubberTrack.clientWidth)
      : 1;
    const padLeft = 5.5 * scale;
    const trackWidth = Math.max(1, rect.width - 2 * padLeft);
    let pos = (e.clientX - rect.left - padLeft) / trackWidth;
    pos = Math.max(0, Math.min(1, pos));
    const dur = getReliableTrackDuration();
    const targetTime = pos * dur;

    state.scrubberDragTargetTime = targetTime;
    scrubProgress = pos;
    if (el.timeCurrent) el.timeCurrent.textContent = formatDuration(targetTime);
    return targetTime;
  }

  if (el.scrubberTrack) {
    el.scrubberTrack.addEventListener('mouseenter', () => {
      isHoveringScrubber = true;
      hasDrawnPausedFrame = false;
      if (!animationFrameId) startVisualizers();
    });
    el.scrubberTrack.addEventListener('mouseleave', () => {
      isHoveringScrubber = false;
      hasDrawnPausedFrame = false;
      if (!animationFrameId) startVisualizers();
    });
    el.scrubberTrack.addEventListener('mousedown', (e) => {
      if (e.button === 2) return;
      isDraggingScrubber = true;
      hasDrawnPausedFrame = false;
      if (!animationFrameId) startVisualizers();
      el.scrubberTrack.classList.add('dragging');
      updateScrubberPositionFromEvent(e);
    });
    el.scrubberTrack.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!state.currentTrack) return;
      const targetTime = updateScrubberPositionFromEvent(e);
      openTrackContextMenu(e, state.currentTrack, { timestamp: targetTime });
    });
  }

  window.addEventListener('mousemove', (e) => {
    if (!isDraggingScrubber || isDraggingTvkScrubber) return;
    updateScrubberPositionFromEvent(e);
  });

  window.addEventListener('mouseup', (e) => {
    if (!isDraggingScrubber || isDraggingTvkScrubber) return;
    isDraggingScrubber = false;
    if (el.scrubberTrack) el.scrubberTrack.classList.remove('dragging');
    const targetTime = updateScrubberPositionFromEvent(e);
    if (!isNaN(targetTime) && el.nativeAudio) {
      el.nativeAudio.currentTime = targetTime;
      updateMediaPositionState();
    }
    state.scrubberDragTargetTime = undefined;
  });

  var isDraggingTvkScrubber = false;
  function updateTvkScrubberPositionFromEvent(e) {
    const row = document.getElementById('tvk-progress-row');
    if (!row) return 0;
    const rect = row.getBoundingClientRect();
    const padLeft = 10;
    const trackWidth = rect.width - 2 * padLeft;
    let pos = trackWidth > 0 ? (e.clientX - rect.left - padLeft) / trackWidth : 0;
    pos = Math.max(0, Math.min(1, pos));
    const dur = getReliableTrackDuration();
    const targetTime = pos * dur;
    state.scrubberDragTargetTime = targetTime;
    if (el.tvkTimeCurrent) el.tvkTimeCurrent.textContent = formatDuration(targetTime);
    if (el.timeCurrent) el.timeCurrent.textContent = formatDuration(targetTime);
    return targetTime;
  }

  var tvkProgRowEl = document.getElementById('tvk-progress-row');
  if (tvkProgRowEl) {
    tvkProgRowEl.addEventListener('mouseenter', () => {
      isHoveringTvkScrubber = true;
      hasDrawnPausedFrame = false;
      if (!animationFrameId) startVisualizers();
    });
    tvkProgRowEl.addEventListener('mouseleave', () => {
      isHoveringTvkScrubber = false;
      hasDrawnPausedFrame = false;
      if (!animationFrameId) startVisualizers();
    });
    tvkProgRowEl.addEventListener('pointerdown', (e) => {
      if (e.button === 2) return;
      if (e.target.closest('#tvk-top-moment-pin')) {
        e.stopPropagation();
        e.preventDefault();
        const trk = state.currentTrack;
        const mt = typeof getTopMoment === 'function' ? getTopMoment(trk) : null;
        if (el.nativeAudio && mt !== null && Number.isFinite(mt)) {
          el.nativeAudio.currentTime = mt;
          updateMediaPositionState();
        }
        return;
      }
      isDraggingTvkScrubber = true;
      isDraggingScrubber = true;
      hasDrawnPausedFrame = false;
      if (!animationFrameId) startVisualizers();
      updateTvkScrubberPositionFromEvent(e);
      try { tvkProgRowEl.setPointerCapture(e.pointerId); } catch (_) {}
    });
    tvkProgRowEl.addEventListener('contextmenu', (e) => {
      if (e.target.closest('#tvk-top-moment-pin')) {
        e.preventDefault();
        e.stopPropagation();
        if (state.currentTrack) {
          removeTopMoment(state.currentTrack);
          showToast(typeof t === 'function' ? t('Top moment removed') : 'Top moment removed');
        }
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      if (!state.currentTrack) return;
      const targetTime = updateTvkScrubberPositionFromEvent(e);
      openTrackContextMenu(e, state.currentTrack, { timestamp: targetTime });
    });
    tvkProgRowEl.addEventListener('pointermove', (e) => {
      if (!isDraggingTvkScrubber) return;
      updateTvkScrubberPositionFromEvent(e);
    });
    const finishTvkSeek = (e) => {
      if (!isDraggingTvkScrubber) return;
      isDraggingTvkScrubber = false;
      isDraggingScrubber = false;
      const targetTime = updateTvkScrubberPositionFromEvent(e);
      if (!isNaN(targetTime) && el.nativeAudio) {
        el.nativeAudio.currentTime = targetTime;
        updateMediaPositionState();
      }
      state.scrubberDragTargetTime = undefined;
      try { tvkProgRowEl.releasePointerCapture(e.pointerId); } catch (_) {}
    };
    tvkProgRowEl.addEventListener('pointerup', finishTvkSeek);
    tvkProgRowEl.addEventListener('pointercancel', finishTvkSeek);
  }

  var playbarTimelineTimer = null;
  if (el.playbar) {
    const showBarTimeline = () => {
      if (playbarTimelineTimer) { clearTimeout(playbarTimelineTimer); playbarTimelineTimer = null; }
      el.playbar.classList.add('bar-timeline-visible');
    };
    const hideBarTimelineDelayed = () => {
      if (playbarTimelineTimer) clearTimeout(playbarTimelineTimer);
      playbarTimelineTimer = setTimeout(() => {
        if (!isDraggingScrubber && el.playbar) el.playbar.classList.remove('bar-timeline-visible');
      }, 500);
    };
    el.playbar.addEventListener('mouseenter', showBarTimeline);
    el.playbar.addEventListener('pointermove', showBarTimeline);
    el.playbar.addEventListener('mouseleave', hideBarTimelineDelayed);
  }

  var scrollFadeTimers = new WeakMap();
  document.addEventListener('scroll', (e) => {
    const t = e.target;
    if (!t || !t.classList) return;
    t.classList.add('is-scrolling');
    const prev = scrollFadeTimers.get(t);
    if (prev) clearTimeout(prev);
    scrollFadeTimers.set(t, setTimeout(() => t.classList.remove('is-scrolling'), 850));
  }, { capture: true, passive: true });


  function updateWavyProgressUI() {
    const isWavy = localStorage.getItem('riff_wavy_progress') === 'true';
    const isPerf = localStorage.getItem('riff_perf_mode') === '1' || localStorage.getItem('riff_perf_mode') === 'true';
    document.body.classList.toggle('no-wavy', isPerf ? true : !isWavy);
    if (btnWavyProgress) {
      btnWavyProgress.classList.toggle('active', isWavy);
    }
  }

  var btnProgressKnob = document.getElementById('btn-progress-knob');
  function updateProgressKnobUI() {
    const isEnabled = localStorage.getItem('riff_progress_knob') === 'true';
    document.body.classList.toggle('no-knob', !isEnabled);
    if (btnProgressKnob) {
      btnProgressKnob.classList.toggle('active', isEnabled);
    }
  }

  var btnProgressBg = document.getElementById('btn-progress-bg');
  function updateProgressBgUI() {
    const isEnabled = localStorage.getItem('riff_progress_bg') !== 'false';
    document.body.classList.toggle('no-progress-bg', !isEnabled);
    if (btnProgressBg) {
      btnProgressBg.classList.toggle('active', isEnabled);
    }
  }

  var COVER_PX = 70;
  var CANVAS_PX = 120;
  var RING_GAP = 5;
  var RING_W = 2.4;

  var m3cCoverAnim = null;
  var m3cRateTweenRaf = 0;


  function ensureM3cCoverAnimation() {
    const wrap = document.getElementById('m3c-wrap');
    if (wrap) wrap.style.transform = 'none';
    if (m3cCoverAnim) {
      if (m3cRateTweenRaf) {
        cancelAnimationFrame(m3cRateTweenRaf);
        m3cRateTweenRaf = 0;
      }
      try { m3cCoverAnim.cancel(); } catch (e) {}
      m3cCoverAnim = null;
    }
    return null;
  }

  function setCoverRotationRate(isPlaying) {
    if (m3c) m3c.targetRate = isPlaying ? 1 : 0.25;
    if (typeof m3cEnabled === 'function' && m3cEnabled()) m3cStart();
  }

  function updateCoverAnimVisibility() {
    const isHidden = document.hidden || document.body.classList.contains('hidden-window');
    const playbar = el.playbar || document.getElementById('playbar');
    const isBarHidden = playbar && playbar.offsetParent === null;
    if (isHidden || isBarHidden) {
      if (m3c && m3c.raf) {
        cancelAnimationFrame(m3c.raf);
        m3c.raf = 0;
      }
    } else if (typeof m3cEnabled === 'function' && m3cEnabled()) {
      m3cStart();
    }
  }

  function m3cEnabled() {
    const barOn = localStorage.getItem('riff_m3_cover') !== '0';
    const heroOn = localStorage.getItem('riff_m3_hero_covers') === '1';
    return (barOn || heroOn) && !document.body.classList.contains('perf');
  }
  function m3cInit() {
    m3c.canvas = document.getElementById('m3c-canvas');
    if (!m3c.canvas) return;
    const dpr = window.devicePixelRatio || 1;
    m3c.canvas.width = CANVAS_PX * dpr;
    m3c.canvas.height = CANVAS_PX * dpr;
    m3c.ctx = m3c.canvas.getContext('2d');
    m3c.ctx.scale(dpr, dpr);
    m3c.ctx.imageSmoothingEnabled = true;
    m3c.ctx.imageSmoothingQuality = 'high';
    m3c.img.onload = () => { m3c.imgReady = true; m3cDraw(performance.now()); };
    if (el.playbarArtwork && el.playbarArtwork.src) {
      m3cSetImage(el.playbarArtwork.src);
    } else if (state.currentTrack) {
      m3cSetImage(getTrackThumbUrl(state.currentTrack));
    }
    const wrap = document.getElementById('playbar-artwork-wrapper');
    if (wrap && !wrap._m3cHoverBound) {
      wrap._m3cHoverBound = true;
      wrap.addEventListener('mouseenter', () => {
        m3c.isHovered = true;
        m3cStart();
      });
      wrap.addEventListener('mouseleave', () => {
        m3c.isHovered = false;
        m3cStart();
      });
    }
    applyM3Cover();
  }
  function m3cSetImage(url) {
    m3c.imgReady = false;
    if (url) m3c.img.src = url;
  }
  function m3cShapeRadii(now) {
    const S = window.RiffShapes;
    if (!S || !S.ready()) return null;
    if (!m3c.start) { m3c.start = now; m3c.from = 0; m3c.to = 0; }
    if (now - m3c.start >= S.HOLD_MS) { m3c.from = m3c.to; m3c.to = S.next(m3c.from); m3c.start = now; }
    const t = Math.min(1, (now - m3c.start) / S.MORPH_MS);
    return { a: S.profile(m3c.from), b: S.profile(m3c.to), e: S.ease(t) };
  }
  function m3cDraw(now) {
    const ctx = m3c.ctx;
    const S = window.RiffShapes;
    if (!ctx || !S) return;
    const sh = m3cShapeRadii(now);
    if (!sh) return;
    const K = S.K;
    const hoverScale = 1 + m3c.hoverProgress * 0.16;
    const hoverLift = m3c.hoverProgress * 4;
    const cx = CANVAS_PX / 2;
    const cy = CANVAS_PX / 2 - hoverLift;
    const currentCover = COVER_PX * hoverScale;
    const scale = (currentCover / 2) / 160 * 1.02;
    const rot = m3c.rotation || 0;
    const rawRadiusAt = (shapeAngle) => {
      const f = ((shapeAngle + Math.PI) / (Math.PI * 2)) * K;
      const i0 = ((Math.floor(f) % K) + K) % K;
      const i1 = (i0 + 1) % K;
      const w = f - Math.floor(f);
      const r0 = sh.a[i0] + (sh.b[i0] - sh.a[i0]) * sh.e;
      const r1 = sh.a[i1] + (sh.b[i1] - sh.a[i1]) * sh.e;
      return r0 + (r1 - r0) * w;
    };
    const radiusAt = (shapeAngle) => rawRadiusAt(shapeAngle) * scale;
    ctx.clearRect(0, 0, CANVAS_PX, CANVAS_PX);
    ctx.save();
    ctx.beginPath();
    for (let k = 0; k <= K; k++) {
      const th = -Math.PI + (Math.PI * 2 * (k % K)) / K;
      const r = radiusAt(th);
      const x = cx + Math.cos(th + rot) * r;
      const y = cy + Math.sin(th + rot) * r;
      if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.clip();
    const heroPath = document.getElementById('m3-hero-shape-path');
    if (heroPath && document.body.classList.contains('m3-hero-covers-on')) {
      const baseScale = (COVER_PX / 2) / 160 * 1.02;
      let heroD = '';
      for (let k = 0; k <= K; k += 4) {
        const th = -Math.PI + (Math.PI * 2 * (k % K)) / K;
        const r = rawRadiusAt(th) * baseScale;
        const nx = Math.max(0, Math.min(1, 0.5 + (Math.cos(th + rot) * r) / (COVER_PX * 1.05)));
        const ny = Math.max(0, Math.min(1, 0.5 + (Math.sin(th + rot) * r) / (COVER_PX * 1.05)));
        if (k === 0) heroD += `M ${nx.toFixed(4)} ${ny.toFixed(4)}`;
        else heroD += ` L ${nx.toFixed(4)} ${ny.toFixed(4)}`;
      }
      heroPath.setAttribute('d', heroD + ' Z');
    }
    if (m3c.imgReady) {
      const iw = m3c.img.naturalWidth;
      const ih = m3c.img.naturalHeight;
      const side = Math.min(iw, ih);
      const imgSize = Math.ceil(currentCover * 1.06);
      ctx.drawImage(m3c.img, (iw - side) / 2, (ih - side) / 2, side, side, cx - imgSize / 2, cy - imgSize / 2, imgSize, imgSize);
    } else {
      ctx.fillStyle = cachedSurfaceColor || '#444';
      ctx.fillRect(0, 0, CANVAS_PX, CANVAS_PX);
    }
    ctx.restore();
    const audio = el.nativeAudio;
    const dur = audio && isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
    const p = dur ? Math.min(1, Math.max(0, audio.currentTime / dur)) : 0;
    const primary = cachedPrimaryColor || '#d0bcff';
    const STEPS = 240;
    const ringPoint = (phi, wave) => {
      const r = radiusAt(phi - rot) + RING_GAP + RING_W / 2 + wave;
      return [cx + Math.cos(phi) * r, cy + Math.sin(phi) * r];
    };
    const startPhi = -Math.PI / 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = RING_W;
    ctx.setLineDash([0.1, 5.5]);
    ctx.strokeStyle = primary;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    const restFrom = Math.round(p * STEPS);
    for (let s = restFrom; s <= STEPS; s++) {
      const [x, y] = ringPoint(startPhi + (Math.PI * 2 * s) / STEPS, 0);
      if (s === restFrom) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    if (p > 0) {
      ctx.beginPath();
      const playedSteps = Math.max(2, Math.round(p * STEPS));
      for (let s = 0; s <= playedSteps; s++) {
        const phi = startPhi + (Math.PI * 2 * s) / STEPS;
        const [x, y] = ringPoint(phi, Math.sin(phi * 26 + m3c.phase) * 1.5);
        if (s === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
  function m3cLoop(now) {
    m3c.raf = 0;
    if (!m3cEnabled() || document.hidden) return;

    const isPerf = document.body.classList.contains('perf') || !document.hasFocus();
    const minM3cInterval = isPerf ? 50 : 32;
    if (m3c.lastFrameTime && now - m3c.lastFrameTime < minM3cInterval) {
      m3c.raf = requestAnimationFrame(m3cLoop);
      return;
    }
    m3c.lastFrameTime = now;

    const targetHover = m3c.isHovered ? 1 : 0;
    const diff = targetHover - m3c.hoverProgress;
    const isHoverAnimating = Math.abs(diff) > 0.002;
    if (isHoverAnimating) {
      m3c.hoverProgress += diff * 0.2;
    } else {
      m3c.hoverProgress = targetHover;
    }

    const rateDiff = m3c.targetRate - m3c.rotRate;
    if (Math.abs(rateDiff) > 0.01) {
      m3c.rotRate += rateDiff * 0.1;
    } else {
      m3c.rotRate = m3c.targetRate;
    }

    if (!m3c.last) m3c.last = now;
    const delta = Math.min(64, Math.max(0, now - m3c.last));
    m3c.last = now;

    const baseSpeed = (2 * Math.PI) / 14000;
    m3c.rotation = (m3c.rotation + baseSpeed * m3c.rotRate * delta) % (Math.PI * 2);

    if (state.isPlaying) m3c.phase += 0.0075 * delta;

    m3cDraw(now);
    if (state.isPlaying || m3c.isHovered || isHoverAnimating || Math.abs(rateDiff) > 0.01) {
      m3c.raf = requestAnimationFrame(m3cLoop);
    } else {
      m3c.raf = 0;
    }
  }
  function m3cStart() { if (m3c && !m3c.raf) m3c.raf = requestAnimationFrame(m3cLoop); }
  function applyM3Cover() {
    const on = m3cEnabled();
    document.body.classList.toggle('m3-cover-on', on);
    ensureM3cCoverAnimation();
    if (on) {
      m3c.targetRate = state.isPlaying ? 1 : 0.25;
      m3cDraw(performance.now());
      m3cStart();
    } else {
      if (m3c.raf) {
        cancelAnimationFrame(m3c.raf);
        m3c.raf = 0;
      }
    }
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) applyM3Cover();
    updateCoverAnimVisibility();
  });

  function applyPerfMode(on) {
    document.body.classList.toggle('perf', !!on);
    const isWavy = localStorage.getItem('riff_wavy_progress') !== 'false';
    document.body.classList.toggle('no-wavy', on ? true : !isWavy);
    syncBgVideoPlayback();
    applyM3Cover();
  }
  var btnBarWave = document.getElementById('btn-bar-wave');
  var barWaveOn = localStorage.getItem('riff_bar_wave') === '1';

  function applyBarWave(on) {
    const vc = document.getElementById('visualizer-container');
    if (vc) {
      vc.style.display = on ? '' : 'none';
      vc.style.pointerEvents = on ? '' : 'none';
    }
    const canvas = document.getElementById('visualizer-canvas');
    if (canvas) {
      canvas.style.pointerEvents = on ? '' : 'none';
      if (!on) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    const needBassPulse = !!(state.vfx && state.vfx.bassPulse);
    if (!on) {
      if (audioEngine && audioEngine.setAnalyserEnabled && !isAnyVisualizerNeeded(false)) {
        audioEngine.setAnalyserEnabled(false);
      }
    } else {
      if (audioEngine && audioEngine.setAnalyserEnabled && state.isPlaying) {
        audioEngine.setAnalyserEnabled(true);
      }
      if (state.isPlaying) {
        startVisualizers();
      }
    }
  }
  applyBarWave(barWaveOn);
  if (btnBarWave) {
    btnBarWave.classList.toggle('active', barWaveOn);
    btnBarWave.addEventListener('click', () => {
      const next = !btnBarWave.classList.contains('active');
      btnBarWave.classList.toggle('active', next);
      localStorage.setItem('riff_bar_wave', next ? '1' : '0');
      syncVizSettingsCache();
      applyBarWave(next);
      if (typeof resizeCanvases === 'function') resizeCanvases();
      if (audioEngine && audioEngine.setAnalyserEnabled) {
        audioEngine.setAnalyserEnabled(isAnyVisualizerNeeded());
      }
      if (state.isPlaying) {
        startVisualizers();
      }
    });
  }

  var btnNpViz = document.getElementById('btn-np-viz');
  var npVizOn = localStorage.getItem('riff_np_viz') !== '0';
  document.body.classList.toggle('np-viz-on', npVizOn);
  if (el.rightPanel && !el.rightPanel._hasNpVizScroll) {
    el.rightPanel._hasNpVizScroll = true;
    el.rightPanel.addEventListener('scroll', () => {
      const c = document.getElementById('np-visualizer-canvas');
      if (c && el.rightPanel) c.style.transform = `translate3d(0, ${el.rightPanel.scrollTop}px, 0)`;
    }, { passive: true });
  }
  if (btnNpViz) {
    btnNpViz.classList.toggle('active', npVizOn);
    btnNpViz.addEventListener('click', () => {
      const next = !btnNpViz.classList.contains('active');
      btnNpViz.classList.toggle('active', next);
      localStorage.setItem('riff_np_viz', next ? '1' : '0');
      document.body.classList.toggle('np-viz-on', next);
      if (!next) {
        const c = document.getElementById('np-visualizer-canvas');
        if (c) {
          const ctx = c.getContext('2d');
          if (ctx) ctx.clearRect(0, 0, c.width, c.height);
        }
      }
      syncVizSettingsCache();
      if (typeof resizeCanvases === 'function') resizeCanvases();
      if (audioEngine && audioEngine.setAnalyserEnabled) {
        audioEngine.setAnalyserEnabled(isAnyVisualizerNeeded());
      }
      if (state.isPlaying) {
        startVisualizers();
      }
    });
  }

  var barVizPosGroup = document.getElementById('bar-viz-pos-group');
  var initialBarVizPos = localStorage.getItem('riff_bar_viz_pos') || 'behind';
  function applyBarVizPos(pos) {
    document.body.classList.toggle('bar-viz-behind', pos === 'behind');
    if (barVizPosGroup) {
      barVizPosGroup.querySelectorAll('.theme-mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-bar-viz-pos') === pos);
      });
    }
    syncVizSettingsCache();
    if (typeof resizeCanvases === 'function') resizeCanvases();
    if (audioEngine && audioEngine.setAnalyserEnabled) {
      audioEngine.setAnalyserEnabled(isAnyVisualizerNeeded());
    }
    if (state.isPlaying) {
      startVisualizers();
    }
  }
  applyBarVizPos(initialBarVizPos);
  if (barVizPosGroup) {
    barVizPosGroup.querySelectorAll('.theme-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const pos = btn.getAttribute('data-bar-viz-pos') || 'behind';
        localStorage.setItem('riff_bar_viz_pos', pos);
        applyBarVizPos(pos);
      });
    });
  }

  var sliderBarVizOpacity = document.getElementById('slider-bar-viz-opacity');
  var valBarVizOpacity = document.getElementById('val-bar-viz-opacity');
  var initialBarVizOpacity = localStorage.getItem('riff_bar_viz_opacity') || '22';
  function applyBarVizOpacity(v) {
    const num = parseInt(v, 10);
    document.documentElement.style.setProperty('--bar-viz-opacity', (num / 100).toString());
    if (valBarVizOpacity) valBarVizOpacity.textContent = `${num}%`;
    if (sliderBarVizOpacity) sliderBarVizOpacity.value = num;
  }
  applyBarVizOpacity(initialBarVizOpacity);
  if (sliderBarVizOpacity) {
    const onOpInput = (e) => {
      const v = e.target.value;
      localStorage.setItem('riff_bar_viz_opacity', v);
      applyBarVizOpacity(v);
    };
    sliderBarVizOpacity.addEventListener('input', onOpInput);
    sliderBarVizOpacity.addEventListener('change', onOpInput);
  }

  var vizStyleDrop = document.getElementById('viz-style-dropdown');
  var tvkVizStyleDrop = document.getElementById('tvk-viz-style-dropdown');
  if (tvkVizStyleDrop && !document.getElementById('tvk-viz-style-m3-dropdown')) {
    tvkVizStyleDrop.style.display = 'none';
    const m3 = document.createElement('div');
    m3.className = 'm3-dropdown';
    m3.id = 'tvk-viz-style-m3-dropdown';
    m3.style.cssText = 'width: 190px; flex-shrink: 0;';
    m3.innerHTML = `
      <button class="m3-dropdown-trigger" id="tvk-viz-style-m3-trigger" type="button">
        <span class="m3-dropdown-label" id="tvk-viz-style-m3-label">Bars (Default)</span>
        <svg class="m3-dropdown-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
      </button>
      <div class="m3-dropdown-menu" id="tvk-viz-style-m3-menu">
        <button class="m3-dropdown-option selected" data-value="bars" type="button">Bars (Default)</button>
        <button class="m3-dropdown-option" data-value="wave" type="button">Wave</button>
        <button class="m3-dropdown-option" data-value="swift" type="button">Swift</button>
      </div>
    `;
    tvkVizStyleDrop.parentNode.insertBefore(m3, tvkVizStyleDrop.nextSibling);
  }

  function syncVizStyleUI() {
    const curStyle = getVizStyle();
    if (vizStyleDrop) vizStyleDrop.value = curStyle;
    if (tvkVizStyleDrop) tvkVizStyleDrop.value = curStyle;
    document.body.classList.toggle('viz-connected', curStyle === 'wave');
    document.body.classList.toggle('viz-swift', curStyle === 'swift');
    document.body.classList.toggle('viz-bars', curStyle === 'bars');

    const updateM3Dropdown = (menuId, labelId) => {
      const menu = document.getElementById(menuId);
      const label = document.getElementById(labelId);
      if (menu) {
        menu.querySelectorAll('.m3-dropdown-option').forEach(opt => {
          const isSel = opt.dataset.value === curStyle;
          opt.classList.toggle('selected', isSel);
          if (isSel && label) label.textContent = opt.textContent;
        });
      }
    };
    updateM3Dropdown('viz-style-m3-menu', 'viz-style-m3-label');
    updateM3Dropdown('tvk-viz-style-m3-menu', 'tvk-viz-style-m3-label');

    if (typeof resizeCanvases === 'function') resizeCanvases();
  }
  function onVizStyleChange(e) {
    const nextStyle = e.target.value;
    localStorage.setItem('riff_viz_style', nextStyle);
    localStorage.setItem('riff_viz_connected', nextStyle === 'wave' ? '1' : '0');
    syncVizSettingsCache();
    syncVizStyleUI();
    if (audioEngine && audioEngine.setAnalyserEnabled) {
      audioEngine.setAnalyserEnabled(isAnyVisualizerNeeded());
    }
    if (state.isPlaying) {
      startVisualizers();
    }
  }
  if (vizStyleDrop) vizStyleDrop.addEventListener('change', onVizStyleChange);
  if (tvkVizStyleDrop) tvkVizStyleDrop.addEventListener('change', onVizStyleChange);
  setupSortDropdown('viz-style-m3-dropdown', 'viz-style-m3-trigger', 'viz-style-m3-menu', 'viz-style-m3-label', vizStyleDrop);
  setupSortDropdown('tvk-viz-style-m3-dropdown', 'tvk-viz-style-m3-trigger', 'tvk-viz-style-m3-menu', 'tvk-viz-style-m3-label', tvkVizStyleDrop);
  syncVizStyleUI();

  var toggleM3Cover = document.getElementById('toggle-m3-cover');
  if (toggleM3Cover) {
    const saved = localStorage.getItem('riff_m3_cover');
    const isM3On = saved !== '0';
    toggleM3Cover.classList.toggle('active', isM3On);
    toggleM3Cover.addEventListener('click', () => {
      const next = !toggleM3Cover.classList.contains('active');
      toggleM3Cover.classList.toggle('active', next);
      localStorage.setItem('riff_m3_cover', next ? '1' : '0');
      applyM3Cover();
    });
  }

  var toggleM3Hero = document.getElementById('toggle-m3-hero-covers');
  if (toggleM3Hero) {
    const isHeroOn = localStorage.getItem('riff_m3_hero_covers') === '1';
    toggleM3Hero.classList.toggle('active', isHeroOn);
    document.body.classList.toggle('m3-hero-covers-on', isHeroOn);
    toggleM3Hero.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const next = !toggleM3Hero.classList.contains('active');
      toggleM3Hero.classList.toggle('active', next);
      document.body.classList.toggle('m3-hero-covers-on', next);
      localStorage.setItem('riff_m3_hero_covers', next ? '1' : '0');
      if (typeof m3cStart === 'function') m3cStart();
    };
  }

  var toggleExplicitTag = document.getElementById('toggle-explicit-tag');
  var isExplicitOn = localStorage.getItem('riff_show_explicit') !== '0';
  document.body.classList.toggle('hide-explicit-badges', !isExplicitOn);
  if (toggleExplicitTag) {
    toggleExplicitTag.classList.toggle('active', isExplicitOn);
    toggleExplicitTag.addEventListener('click', () => {
      const next = !toggleExplicitTag.classList.contains('active');
      toggleExplicitTag.classList.toggle('active', next);
      localStorage.setItem('riff_show_explicit', next ? '1' : '0');
      document.body.classList.toggle('hide-explicit-badges', !next);
    });
  }

  if (typeof updateTvkVisualizerSetting === 'function') updateTvkVisualizerSetting(localStorage.getItem('riff_tvk_visualizer') !== 'false');
  if (typeof updateTvkVisualizerLyricsSetting === 'function') updateTvkVisualizerLyricsSetting(localStorage.getItem('riff_tvk_visualizer_lyrics') !== 'false');
  if (typeof updateTvkVisualizerOpacity === 'function') updateTvkVisualizerOpacity(parseInt(localStorage.getItem('riff_tvk_visualizer_opacity') || '85', 10));

  var isDisableAnimations = localStorage.getItem('riff_disable_animations') === '1' || localStorage.getItem('riff_perf_mode') === '1';



window.resizeCanvases = resizeCanvases;
window.startVisualizers = startVisualizers;
window.stopVisualizers = stopVisualizers;
window.fadeOutTvkVisualizer = fadeOutTvkVisualizer;


document.body.classList.add('no-wavy');
document.body.classList.add('no-knob');
