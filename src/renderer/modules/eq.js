
'use strict';

var EQ_BAND_LABELS = window.EQ_BAND_LABELS || ['32', '64', '125', '250', '500', '1k', '2k', '4k', '8k', '16k'];
window.EQ_BAND_LABELS = EQ_BAND_LABELS;


  function init10BandEqUI() {
    if (!el || !el.eqBands) return;
    if (!state || !state.audioSettings) return;
    if (!el.eqBands) return;

    el.eqBands.innerHTML = '';
    const stage = document.createElement('div');
    stage.className = 'eq-spotify-stage';

    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'eq-spotify-svg');

    const defs = document.createElementNS(NS, 'defs');
    const grad = document.createElementNS(NS, 'linearGradient');
    grad.id = 'eq-spotify-grad';
    grad.setAttribute('x1', '0');
    grad.setAttribute('y1', '0');
    grad.setAttribute('x2', '0');
    grad.setAttribute('y2', '1');

    const stop1 = document.createElementNS(NS, 'stop');
    stop1.setAttribute('offset', '0%');
    stop1.setAttribute('stop-color', 'var(--md-sys-color-primary)');
    stop1.setAttribute('stop-opacity', '0.45');

    const stop2 = document.createElementNS(NS, 'stop');
    stop2.setAttribute('offset', '100%');
    stop2.setAttribute('stop-color', 'var(--md-sys-color-primary)');
    stop2.setAttribute('stop-opacity', '0');

    grad.appendChild(stop1);
    grad.appendChild(stop2);
    defs.appendChild(grad);
    svg.appendChild(defs);

    
    const scaleGroup = document.createElementNS(NS, 'g');
    scaleGroup.setAttribute('class', 'eq-svg-scale');
    scaleGroup.style.pointerEvents = 'none';

    const textPlus12 = document.createElementNS(NS, 'text');
    textPlus12.setAttribute('x', '4');
    textPlus12.setAttribute('y', '22');
    textPlus12.setAttribute('fill', 'var(--md-sys-color-on-surface-variant)');
    textPlus12.setAttribute('font-size', '10');
    textPlus12.setAttribute('font-weight', '500');
    textPlus12.textContent = '+12dB';
    scaleGroup.appendChild(textPlus12);

    const textMinus12 = document.createElementNS(NS, 'text');
    textMinus12.setAttribute('x', '4');
    textMinus12.setAttribute('y', '105');
    textMinus12.setAttribute('fill', 'var(--md-sys-color-on-surface-variant)');
    textMinus12.setAttribute('font-size', '10');
    textMinus12.setAttribute('font-weight', '500');
    textMinus12.textContent = '-12dB';
    scaleGroup.appendChild(textMinus12);
    svg.appendChild(scaleGroup);

    
    const gridGroup = document.createElementNS(NS, 'g');
    gridGroup.setAttribute('class', 'eq-svg-grid');
    gridGroup.style.pointerEvents = 'none';

    const zeroLine = document.createElementNS(NS, 'line');
    zeroLine.setAttribute('stroke', 'var(--md-sys-color-outline-variant)');
    zeroLine.setAttribute('stroke-width', '1');
    zeroLine.setAttribute('stroke-opacity', '0.35');
    gridGroup.appendChild(zeroLine);

    const vLines = [];
    for (let i = 0; i < 10; i++) {
      const vLine = document.createElementNS(NS, 'line');
      vLine.setAttribute('stroke', 'var(--md-sys-color-outline-variant)');
      vLine.setAttribute('stroke-width', '1');
      vLine.setAttribute('stroke-opacity', '0.22');
      gridGroup.appendChild(vLine);
      vLines.push(vLine);
    }
    svg.appendChild(gridGroup);

    const areaPath = document.createElementNS(NS, 'path');
    areaPath.setAttribute('class', 'eq-svg-area');
    areaPath.setAttribute('fill', 'url(#eq-spotify-grad)');
    svg.appendChild(areaPath);

    const curvePath = document.createElementNS(NS, 'path');
    curvePath.setAttribute('class', 'eq-svg-curve');
    curvePath.setAttribute('fill', 'none');
    curvePath.setAttribute('stroke', 'var(--md-sys-color-primary)');
    curvePath.setAttribute('stroke-width', '2.5');
    curvePath.setAttribute('stroke-linecap', 'round');
    curvePath.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(curvePath);

    const handlesGroup = document.createElementNS(NS, 'g');
    handlesGroup.setAttribute('class', 'eq-svg-handles');

    const tooltip = document.createElementNS(NS, 'g');
    tooltip.setAttribute('class', 'eq-svg-tooltip');
    tooltip.style.display = 'none';
    tooltip.style.pointerEvents = 'none';

    const ttRect = document.createElementNS(NS, 'rect');
    ttRect.setAttribute('rx', '4');
    ttRect.setAttribute('ry', '4');
    ttRect.setAttribute('width', '44');
    ttRect.setAttribute('height', '18');
    ttRect.setAttribute('x', '-22');
    ttRect.setAttribute('y', '-9');
    ttRect.setAttribute('fill', 'var(--md-sys-color-surface-container-highest)');
    tooltip.appendChild(ttRect);

    const ttText = document.createElementNS(NS, 'text');
    ttText.setAttribute('fill', 'var(--md-sys-color-primary)');
    ttText.setAttribute('font-size', '10');
    ttText.setAttribute('font-weight', '600');
    ttText.setAttribute('text-anchor', 'middle');
    ttText.setAttribute('dy', '3.5');
    tooltip.appendChild(ttText);

    const handleElements = [];
    for (let i = 0; i < 10; i++) {
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'eq-handle');
      g.setAttribute('data-idx', String(i));

      const hit = document.createElementNS(NS, 'circle');
      hit.setAttribute('r', '16');
      hit.setAttribute('fill', 'transparent');
      hit.setAttribute('cursor', 'ns-resize');
      g.appendChild(hit);

      const dot = document.createElementNS(NS, 'circle');
      dot.setAttribute('class', 'eq-handle-dot');
      dot.setAttribute('r', '5');
      dot.setAttribute('cursor', 'ns-resize');
      g.appendChild(dot);

      handlesGroup.appendChild(g);
      handleElements.push(g);
    }

    svg.appendChild(handlesGroup);
    svg.appendChild(tooltip);
    stage.appendChild(svg);

    const labelsRow = document.createElement('div');
    labelsRow.className = 'eq-spotify-labels';
    const labelSpans = [];
    EQ_BAND_LABELS.forEach((label) => {
      const sp = document.createElement('span');
      sp.className = 'eq-spotify-label';
      sp.textContent = label;
      labelsRow.appendChild(sp);
      labelSpans.push(sp);
    });
    stage.appendChild(labelsRow);
    el.eqBands.appendChild(stage);

    const H = 120;
    const padTop = 18;
    const midY = 60;
    const padBottom = 18;
    const amp = 42;

    function dbToY(db) {
      const clamped = Math.max(-12, Math.min(12, typeof db === 'number' ? db : 0));
      return midY - (clamped / 12) * amp;
    }

    function yToDb(y) {
      const clampedY = Math.max(padTop, Math.min(H - padBottom, y));
      return Math.round(((midY - clampedY) / amp) * 12);
    }

    function getWidth() {
      const rect = stage.getBoundingClientRect();
      return Math.max(260, rect.width || 340);
    }

    function renderEqCurve() {
      const W = getWidth();
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

      const padLeft = 44;
      const padRight = 16;
      const span = W - padLeft - padRight;
      const step = span / 9;

      const xCoords = [];
      for (let i = 0; i < 10; i++) {
        xCoords.push(padLeft + i * step);
      }

      zeroLine.setAttribute('x1', '0');
      zeroLine.setAttribute('y1', String(midY));
      zeroLine.setAttribute('x2', String(W));
      zeroLine.setAttribute('y2', String(midY));

      vLines.forEach((vl, i) => {
        vl.setAttribute('x1', xCoords[i].toFixed(1));
        vl.setAttribute('y1', '12');
        vl.setAttribute('x2', xCoords[i].toFixed(1));
        vl.setAttribute('y2', '108');
      });

      labelSpans.forEach((sp, i) => {
        sp.style.left = `${xCoords[i]}px`;
      });

      const currentBands = state.audioSettings.eqBands || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      const pts = xCoords.map((x, i) => ({
        x,
        y: dbToY(currentBands[i] !== undefined ? currentBands[i] : 0)
      }));

      pts.forEach((pt, i) => {
        if (handleElements[i]) {
          handleElements[i].setAttribute('transform', `translate(${pt.x.toFixed(1)}, ${pt.y.toFixed(1)})`);
        }
      });

      let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = i === 0 ? pts[0] : pts[i - 1];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = i + 2 < pts.length ? pts[i + 2] : pts[i + 1];

        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = Math.max(10, Math.min(110, p1.y + (p2.y - p0.y) / 6));
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = Math.max(10, Math.min(110, p2.y - (p3.y - p1.y) / 6));

        d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
      }

      curvePath.setAttribute('d', d);
      const areaD = `${d} L ${pts[pts.length - 1].x.toFixed(1)} ${H} L ${pts[0].x.toFixed(1)} ${H} Z`;
      areaPath.setAttribute('d', areaD);
    }

    window.updateSpotifyEqUI = renderEqCurve;
    renderEqCurve();

    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => {
        renderEqCurve();
      });
      ro.observe(stage);
    }

    handleElements.forEach((handle, i) => {
      let isDragging = false;

      const onPointerMove = (e) => {
        if (!isDragging) return;
        const rect = svg.getBoundingClientRect();
        if (rect.height <= 0) return;
        const svgY = ((e.clientY - rect.top) / rect.height) * H;
        const val = yToDb(svgY);

        if (!Array.isArray(state.audioSettings.eqBands)) {
          state.audioSettings.eqBands = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        }
        state.audioSettings.eqBands[i] = val;
        state.activePresetId = null;

        const W = getWidth();
        const padLeft = 44;
        const padRight = 16;
        const xPos = padLeft + i * ((W - padLeft - padRight) / 9);
        const curY = dbToY(val);

        tooltip.style.display = '';
        tooltip.setAttribute('transform', `translate(${xPos.toFixed(1)}, ${Math.max(12, curY - 16).toFixed(1)})`);
        ttText.textContent = `${val > 0 ? '+' : ''}${val} dB`;

        renderEqCurve();
        applyAudioSettings();
        renderPresets();
      };

      const onPointerUp = (e) => {
        if (!isDragging) return;
        isDragging = false;
        handle.classList.remove('dragging');
        try { handle.releasePointerCapture(e.pointerId); } catch (_) {}
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);
        tooltip.style.display = 'none';
      };

      handle.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        initAudioContext();
        isDragging = true;
        handle.classList.add('dragging');
        try { handle.setPointerCapture(e.pointerId); } catch (_) {}

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
        window.addEventListener('pointercancel', onPointerUp);

        onPointerMove(e);
      });

      handle.addEventListener('dblclick', () => {
        initAudioContext();
        if (!Array.isArray(state.audioSettings.eqBands)) {
          state.audioSettings.eqBands = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        }
        state.audioSettings.eqBands[i] = 0;
        state.activePresetId = null;
        renderEqCurve();
        applyAudioSettings();
        renderPresets();
      });
    });

    if (el.btnResetEqBands) {
      el.btnResetEqBands.addEventListener('click', () => {
        initAudioContext();
        state.audioSettings.eqBands = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        state.activePresetId = null;
        renderEqCurve();
        applyAudioSettings();
        renderPresets();
      });
    }
  }

  

  var sleepTimerInterval = null;



window.init10BandEqUI = init10BandEqUI;

