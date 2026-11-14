
'use strict';

var customThemes = window.customThemes || [];
window.customThemes = customThemes;
var currentWaveFocusedIndex = window.currentWaveFocusedIndex || 0;
window.currentWaveFocusedIndex = currentWaveFocusedIndex;

  var savedRowH = parseInt(localStorage.getItem('riff_track_row_height') || '64', 10);
  if (savedRowH && Number.isFinite(savedRowH)) {
    document.documentElement.style.setProperty('--riff-track-row-height', `${savedRowH}px`);
    document.documentElement.style.setProperty('--riff-track-cover-size', `${Math.round(savedRowH * 0.72)}px`);
  }

  function hexToRgb(hex) {
    if (typeof hex !== 'string') hex = '#5247d1';
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const num = parseInt(hex, 16);
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; }
    else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  }

  function hslToHex(h, s, l) {
    s /= 100; l /= 100;
    const a = s * Math.min(l, 1 - l);
    const f = n => { const k = (n + h / 30) % 12; return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1); };
    return '#' + [f(0), f(8), f(4)].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
  }

  function getAdv(name, defaultVal = true) {
    const val = localStorage.getItem(`riff_adv_${name}`);
    if (val === null) return defaultVal;
    return val === 'true';
  }

  function setAdv(name, boolVal) {
    localStorage.setItem(`riff_adv_${name}`, boolVal ? 'true' : 'false');
  }

  function systemPrefersReducedMotion() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }

  function applyReducedMotionSetting() {
    const reduced = getAdv('reduce_motion', systemPrefersReducedMotion());
    document.documentElement.classList.toggle('force-reduced-motion', reduced);
  }

  var PALETTE_STYLES = {
    classic: {
      label: 'Classic',
      secHueShift: 0,
      tertHueShift: 0,
      priSatScale: 1.0,
      surfSatScale: 1.0,
      contSatScale: 1.0
    },
    'tonal-spot': {
      label: 'Tonal spot',
      secHueShift: 0,
      tertHueShift: 60,
      priSatScale: 1.0,
      surfSatScale: 0.8,
      contSatScale: 0.9
    },
    expressive: {
      label: 'Expressive',
      secHueShift: 60,
      tertHueShift: 120,
      priSatScale: 1.25,
      surfSatScale: 1.5,
      contSatScale: 1.3
    },
    vibrant: {
      label: 'Vibrant',
      secHueShift: 0,
      tertHueShift: 60,
      priSatScale: 1.4,
      surfSatScale: 1.2,
      contSatScale: 1.4
    },
    neutral: {
      label: 'Neutral',
      secHueShift: 0,
      tertHueShift: 0,
      priSatScale: 0.35,
      surfSatScale: 0.2,
      contSatScale: 0.25
    }
  };

  var tint = (hex, v) => `color-mix(in srgb, ${hex} var(${v}), transparent)`;
  var SURFACE_TOKENS = new Set([
    '--md-sys-color-background',
    '--md-sys-color-surface',
    '--md-sys-color-surface-dim',
    '--md-sys-color-surface-bright',
    '--md-sys-color-surface-container-lowest',
    '--md-sys-color-surface-container-low',
    '--md-sys-color-surface-container',
    '--md-sys-color-surface-container-high',
    '--md-sys-color-surface-container-highest'
  ]);
  var TEXT_TOKENS = new Set([
    '--md-sys-color-on-surface',
    '--md-sys-color-on-surface-variant'
  ]);

  function generateM3Palette(hexColor, mode, intensity, brightness) {
    if (!hexColor) hexColor = '#5247d1';
    const rgb = hexToRgb(hexColor);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const h = hsl.h;
    const s = hsl.s || 60;
    const intensityFactor = (typeof intensity === 'number' ? intensity : 100) / 100;
    const root = document.documentElement;
    const applyBgIntensity = getAdv('intensity_bg', false);

    const setToken = (prop, val) => {
      if (SURFACE_TOKENS.has(prop)) {
        root.style.setProperty(prop, tint(val, '--ui-alpha'));
        root.style.setProperty(`${prop}-solid`, val);
      } else if (TEXT_TOKENS.has(prop)) {
        root.style.setProperty(prop, tint(val, '--text-alpha'));
        root.style.setProperty(`${prop}-solid`, val);
      } else {
        root.style.setProperty(prop, val);
      }
    };

    const setSurfaceToken = (prop, val) => {
      root.style.setProperty(prop, tint(val, '--ui-alpha'));
      root.style.setProperty(`${prop}-solid`, val);
    };

    const styleKey = state.paletteStyle || 'classic';
    const style = PALETTE_STYLES[styleKey] || PALETTE_STYLES.classic;
    

    const surfSat = applyBgIntensity ? Math.min(28, Math.round(s * intensityFactor * (style.surfSatScale * 0.65))) : 0;

    const hSec = (h + style.secHueShift) % 360;
    const hTert = (h + style.tertHueShift) % 360;

    const isMonochrome = intensityFactor < 0.08 || (styleKey === 'neutral' && intensityFactor < 0.05);
    const br = (typeof brightness === 'number' ? brightness : 20) / 100;

    if (mode === 'light') {
      const monoBr = (typeof state.monoBrightness === 'number' ? state.monoBrightness : 100) / 100;
      const LB = (v) => Math.max(0, Math.min(100, Math.round(v + (br - 0.5) * 18 + (monoBr - 0.5) * 14)));
      if (isMonochrome) {
        const ML = (v) => Math.max(68, Math.min(100, Math.round(v - 18 + monoBr * 20 + (br - 0.2) * 10)));
        const monoPriL = Math.max(0, Math.min(68, Math.round(56 - monoBr * 46)));
        const monoPriHex = hslToHex(0, 0, monoPriL);
        setToken('--md-sys-color-primary', monoPriHex);
        setToken('--md-sys-color-on-primary', '#FFFFFF');
        setSurfaceToken('--md-sys-color-primary-container', hslToHex(0, 0, ML(90)));
        setToken('--md-sys-color-on-primary-container', '#111111');
        setToken('--md-sys-color-secondary', hslToHex(0, 0, Math.min(72, monoPriL + 16)));
        setSurfaceToken('--md-sys-color-secondary-container', hslToHex(0, 0, ML(90)));
        setToken('--md-sys-color-on-secondary-container', '#111111');
        setToken('--md-sys-color-tertiary', hslToHex(0, 0, Math.min(72, monoPriL + 16)));
        setSurfaceToken('--md-sys-color-tertiary-container', hslToHex(0, 0, ML(90)));
        setToken('--md-sys-color-background', hslToHex(0, 0, ML(100)));
        setToken('--md-sys-color-surface', hslToHex(0, 0, ML(99)));
        setToken('--md-sys-color-surface-dim', hslToHex(0, 0, ML(89)));
        setToken('--md-sys-color-surface-bright', hslToHex(0, 0, ML(100)));
        setToken('--md-sys-color-surface-container-lowest', hslToHex(0, 0, Math.min(100, ML(100) + 1)));
        setToken('--md-sys-color-surface-container-low', hslToHex(0, 0, ML(97)));
        setToken('--md-sys-color-surface-container', hslToHex(0, 0, ML(95)));
        setToken('--md-sys-color-surface-container-high', hslToHex(0, 0, ML(92)));
        setToken('--md-sys-color-surface-container-highest', hslToHex(0, 0, ML(89)));
        setToken('--md-sys-color-on-surface', '#111111');
        setToken('--md-sys-color-on-surface-variant', '#444444');
        setToken('--md-sys-color-outline', '#777777');
        setSurfaceToken('--md-sys-color-outline-variant', hslToHex(0, 0, ML(84)));
        setToken('--md-sys-color-error', '#777777');
        setToken('--md-sys-color-on-error', '#FFFFFF');
      } else {
        const sat = Math.min(100, Math.round(48 * intensityFactor * style.priSatScale));
        const satHi = Math.min(100, Math.round(80 * intensityFactor * style.contSatScale));
        const satMed = Math.min(100, Math.round(55 * intensityFactor * style.priSatScale));
        const satLow = Math.min(100, Math.round(30 * intensityFactor * style.contSatScale));
        const satLow2 = Math.min(100, Math.round(20 * intensityFactor * style.contSatScale));

        setToken('--md-sys-color-primary', hslToHex(h, sat, 40));
        setToken('--md-sys-color-on-primary', '#FEFBFF');
        setToken('--md-sys-color-primary-container', hslToHex(h, satHi, LB(90)));
        setToken('--md-sys-color-on-primary-container', hslToHex(h, satMed, 18));
        setToken('--md-sys-color-secondary', hslToHex(hSec, satLow, 45));
        setToken('--md-sys-color-secondary-container', hslToHex(hSec, satLow, LB(90)));
        setToken('--md-sys-color-on-secondary-container', hslToHex(hSec, satLow2, 15));
        setToken('--md-sys-color-tertiary', hslToHex(hTert, satLow, 45));
        setToken('--md-sys-color-tertiary-container', hslToHex(hTert, satLow, LB(90)));
        setToken('--md-sys-color-background', hslToHex(h, surfSat, LB(99)));
        setToken('--md-sys-color-surface', hslToHex(h, surfSat, LB(98)));
        setToken('--md-sys-color-surface-dim', hslToHex(h, surfSat, LB(87)));
        setToken('--md-sys-color-surface-bright', hslToHex(h, surfSat, LB(98)));
        setToken('--md-sys-color-surface-container-lowest', hslToHex(h, surfSat, LB(100)));
        setToken('--md-sys-color-surface-container-low', hslToHex(h, surfSat, LB(96)));
        setToken('--md-sys-color-surface-container', hslToHex(h, surfSat, LB(94)));
        setToken('--md-sys-color-surface-container-high', hslToHex(h, surfSat, LB(92)));
        setToken('--md-sys-color-surface-container-highest', hslToHex(h, surfSat, LB(90)));
        setToken('--md-sys-color-on-surface', '#1C1B1F');
        setToken('--md-sys-color-on-surface-variant', '#49454F');
        setToken('--md-sys-color-outline', '#79747E');
        setToken('--md-sys-color-outline-variant', '#CAC4D0');
      }
    } else {
      const B = (v) => Math.max(0, Math.min(24, Math.round(v * (0.35 + br * 0.95))));
      if (isMonochrome) {
        

        const monoBr = (typeof state.monoBrightness === 'number' ? state.monoBrightness : 100) / 100;
        const monoPriL = Math.min(100, Math.round(50 + monoBr * 50));
        const monoPriHex = hslToHex(0, 0, monoPriL);
        setToken('--md-sys-color-primary', monoPriHex);
        setToken('--md-sys-color-on-primary', '#121212');
        setSurfaceToken('--md-sys-color-primary-container', hslToHex(0, 0, B(24)));
        setToken('--md-sys-color-on-primary-container', monoPriHex);
        setToken('--md-sys-color-secondary', hslToHex(0, 0, Math.max(40, monoPriL - 12)));
        setSurfaceToken('--md-sys-color-secondary-container', hslToHex(0, 0, B(24)));
        setToken('--md-sys-color-on-secondary-container', monoPriHex);
        setToken('--md-sys-color-tertiary', hslToHex(0, 0, Math.max(40, monoPriL - 12)));
        setSurfaceToken('--md-sys-color-tertiary-container', hslToHex(0, 0, B(24)));
        setToken('--md-sys-color-background', hslToHex(0, 0, B(7)));
        setToken('--md-sys-color-surface', hslToHex(0, 0, B(7)));
        setToken('--md-sys-color-surface-dim', hslToHex(0, 0, B(7)));
        setToken('--md-sys-color-surface-bright', hslToHex(0, 0, B(19)));
        setToken('--md-sys-color-surface-container-lowest', hslToHex(0, 0, B(5)));
        setToken('--md-sys-color-surface-container-low', hslToHex(0, 0, B(10)));
        setToken('--md-sys-color-surface-container', hslToHex(0, 0, B(13)));
        setToken('--md-sys-color-surface-container-high', hslToHex(0, 0, B(16)));
        setToken('--md-sys-color-surface-container-highest', hslToHex(0, 0, B(20)));
        setToken('--md-sys-color-on-surface', '#FFFFFF');
        setToken('--md-sys-color-on-surface-variant', '#CFCFCF');
        setToken('--md-sys-color-outline', '#8A8A8A');
        setSurfaceToken('--md-sys-color-outline-variant', '#3A3A3A');
        setToken('--md-sys-color-error', '#8A8A8A');
        setToken('--md-sys-color-on-error', '#121212');
      } else {
        

        const sat = Math.min(100, Math.round(60 * intensityFactor * style.priSatScale));
        const satMed = Math.min(100, Math.round(50 * intensityFactor * style.priSatScale));
        const satLow = Math.min(100, Math.round(15 * intensityFactor * style.contSatScale));
        const satLow2 = Math.min(100, Math.round(30 * intensityFactor * style.contSatScale));
        const priHex = hslToHex(h, sat, 75);
        const priRgb = hexToRgb(priHex);
        

        const SB = (v) => applyBgIntensity ? Math.max(Math.round(intensityFactor * 4), B(v)) : B(v);

        setToken('--md-sys-color-primary', priHex);
        setToken('--md-sys-color-on-primary', hslToHex(h, satMed, 20));
        setToken('--md-sys-color-primary-container', `rgba(${priRgb.r}, ${priRgb.g}, ${priRgb.b}, 0.18)`);
        setToken('--md-sys-color-on-primary-container', priHex);
        setToken('--md-sys-color-secondary', hslToHex(hSec, satLow2, 75));
        setToken('--md-sys-color-secondary-container', hslToHex(hSec, satLow, 22));
        setToken('--md-sys-color-on-secondary-container', hslToHex(hSec, satLow2, 85));
        setToken('--md-sys-color-tertiary', hslToHex(hTert, satLow2, 75));
        setToken('--md-sys-color-tertiary-container', hslToHex(hTert, satLow, 22));
        setToken('--md-sys-color-background', hslToHex(h, surfSat, SB(7)));
        setToken('--md-sys-color-surface', hslToHex(h, surfSat, SB(8)));
        setToken('--md-sys-color-surface-dim', hslToHex(h, surfSat, SB(7)));
        setToken('--md-sys-color-surface-bright', hslToHex(h, surfSat, SB(24)));
        setToken('--md-sys-color-surface-container-lowest', hslToHex(h, surfSat, SB(5)));
        setToken('--md-sys-color-surface-container-low', hslToHex(h, surfSat, SB(10)));
        setToken('--md-sys-color-surface-container', hslToHex(h, surfSat, SB(13)));
        setToken('--md-sys-color-surface-container-high', hslToHex(h, surfSat, SB(16)));
        setToken('--md-sys-color-surface-container-highest', hslToHex(h, surfSat, SB(20)));
        setToken('--md-sys-color-on-surface', '#e2e2e9');
        setToken('--md-sys-color-on-surface-variant', '#c4c6d0');
        setToken('--md-sys-color-outline', '#8e9099');
        setToken('--md-sys-color-outline-variant', '#282a33');
      }
    }
  }

  function extractDominantColor(imgSrc) {
    return new Promise((resolve) => {
      if (!imgSrc) return resolve('#6750A4');
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 10;
        canvas.height = 10;
        ctx.drawImage(img, 0, 0, 10, 10);
        const data = ctx.getImageData(0, 0, 10, 10).data;
        let r = 0, g = 0, b = 0;
        for (let i = 0; i < data.length; i += 4) {
          r += data[i]; g += data[i+1]; b += data[i+2];
        }
        const count = data.length / 4;
        r = Math.floor(r / count);
        g = Math.floor(g / count);
        b = Math.floor(b / count);
        const hex = '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
        resolve(hex);
      };
      img.onerror = () => resolve('#6750A4');
      img.src = imgSrc;
    });
  }

  var hasDrawnPausedFrame = false;
  var cachedPrimaryColor = '';
  var cachedDimColor = '';
  var cachedSurfaceColor = '';
  var animationFrameId = null;
  var _tempColorCanvas = null;
  var _tempColorCtx = null;

  function resolveCssColor(colorStr, fallback = '#B69DF8') {
    if (!colorStr) return fallback;
    const str = String(colorStr).trim();
    if (str.startsWith('#') || str.startsWith('rgb(') || str.startsWith('rgba(')) return str;
    try {
      if (!_tempColorCanvas) {
        _tempColorCanvas = document.createElement('canvas');
        _tempColorCanvas.width = 1;
        _tempColorCanvas.height = 1;
        _tempColorCtx = _tempColorCanvas.getContext('2d');
      }
      _tempColorCtx.fillStyle = fallback;
      _tempColorCtx.fillStyle = str;
      return _tempColorCtx.fillStyle || fallback;
    } catch (_) {
      return fallback;
    }
  }

  function refreshCachedThemeColors() {
    const btn = document.getElementById('btn-play-pause');
    const btnBg = btn ? getComputedStyle(btn).backgroundColor : '';
    const bodyStyle = getComputedStyle(document.body);
    const rootStyle = getComputedStyle(document.documentElement);
    const rawPri = (btnBg && btnBg !== 'rgba(0, 0, 0, 0)' && btnBg !== 'transparent')
      ? btnBg
      : (bodyStyle.getPropertyValue('--md-sys-color-primary').trim() || rootStyle.getPropertyValue('--md-sys-color-primary').trim() || state.themeAccent || '#B69DF8');
    const rawDim = bodyStyle.getPropertyValue('--md-sys-color-on-surface-solid').trim() || rootStyle.getPropertyValue('--md-sys-color-on-surface-solid').trim() || '#E6E0E9';
    const rawSurf = bodyStyle.getPropertyValue('--md-sys-color-surface-container-highest-solid').trim() || rootStyle.getPropertyValue('--md-sys-color-surface-container-highest-solid').trim() || '#222226';

    cachedPrimaryColor = resolveCssColor(rawPri, '#B69DF8');
    cachedDimColor = resolveCssColor(rawDim, '#E6E0E9');
    cachedSurfaceColor = resolveCssColor(rawSurf, '#222226');
    hasDrawnPausedFrame = false;
  }

  function boundMap(map, maxSize = 30) {
    if (!map) return;
    if (map instanceof Map) {
      while (map.size > maxSize) {
        const firstKey = map.keys().next().value;
        map.delete(firstKey);
      }
    } else if (typeof map === 'object') {
      const keys = Object.keys(map);
      if (keys.length > maxSize) {
        for (let i = 0; i < keys.length - maxSize; i++) {
          delete map[keys[i]];
        }
      }
    }
  }

  var coverAnalysisCache = new Map();

  function analyzeCover(imgSrc) {
    return new Promise((resolve) => {
      if (!imgSrc) {
        return resolve({ accent: '#6750A4', accent2: '#9A82DB', luminance: 0.2, saturation: 0.5 });
      }
      if (coverAnalysisCache.has(imgSrc)) {
        const cached = coverAnalysisCache.get(imgSrc);
        coverAnalysisCache.delete(imgSrc);
        coverAnalysisCache.set(imgSrc, cached);
        return resolve(cached);
      }

      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 48;
          canvas.height = 48;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, 48, 48);
          const data = ctx.getImageData(0, 0, 48, 48).data;

          let totalLuminance = 0;
          let nonGraySatSum = 0;
          let nonGraySatCount = 0;

          const bins = Array.from({ length: 24 }, (_, i) => ({
            idx: i,
            centerHue: (i + 0.5) * 15,
            weight: 0,
            rSum: 0,
            gSum: 0,
            bSum: 0,
            count: 0
          }));

          let fallbackR = 0, fallbackG = 0, fallbackB = 0;
          const totalPixels = data.length / 4;

          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            fallbackR += r;
            fallbackG += g;
            fallbackB += b;

            const rN = r / 255;
            const gN = g / 255;
            const bN = b / 255;

            const lum = 0.2126 * rN + 0.7152 * gN + 0.0722 * bN;
            totalLuminance += lum;

            const max = Math.max(rN, gN, bN);
            const min = Math.min(rN, gN, bN);
            const d = max - min;
            const l = (max + min) / 2;
            const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));

            if (s >= 0.15) {
              nonGraySatSum += s;
              nonGraySatCount++;

              if (l >= 0.10 && l <= 0.90) {
                let hDeg = 0;
                if (d > 0) {
                  if (max === rN) {
                    hDeg = ((gN - bN) / d + (gN < bN ? 6 : 0)) * 60;
                  } else if (max === gN) {
                    hDeg = ((bN - rN) / d + 2) * 60;
                  } else {
                    hDeg = ((rN - gN) / d + 4) * 60;
                  }
                }
                const binIdx = Math.min(23, Math.max(0, Math.floor(hDeg / 15)));
                const bin = bins[binIdx];
                bin.weight += s;
                bin.rSum += r;
                bin.gSum += g;
                bin.bSum += b;
                bin.count++;
              }
            }
          }

          const meanLuminance = totalLuminance / totalPixels;
          const meanSaturation = nonGraySatCount > 0 ? (nonGraySatSum / nonGraySatCount) : 0;

          let bestBin = null;
          for (let i = 0; i < 24; i++) {
            if (bins[i].count > 0) {
              if (!bestBin || bins[i].weight > bestBin.weight) {
                bestBin = bins[i];
              }
            }
          }

          let accentHex = '';
          let accentR = 0, accentG = 0, accentB = 0;

          if (bestBin && bestBin.count > 0) {
            accentR = Math.round(bestBin.rSum / bestBin.count);
            accentG = Math.round(bestBin.gSum / bestBin.count);
            accentB = Math.round(bestBin.bSum / bestBin.count);
            accentHex = '#' + [accentR, accentG, accentB].map(x => x.toString(16).padStart(2, '0')).join('');
          } else {
            accentR = Math.round(fallbackR / totalPixels);
            accentG = Math.round(fallbackG / totalPixels);
            accentB = Math.round(fallbackB / totalPixels);
            accentHex = '#' + [accentR, accentG, accentB].map(x => x.toString(16).padStart(2, '0')).join('');
          }

          let bestBin2 = null;
          if (bestBin) {
            for (let i = 0; i < 24; i++) {
              if (bins[i].count > 0 && i !== bestBin.idx) {
                const diff = Math.abs(bins[i].centerHue - bestBin.centerHue);
                const dist = Math.min(diff, 360 - diff);
                if (dist >= 60) {
                  if (!bestBin2 || bins[i].weight > bestBin2.weight) {
                    bestBin2 = bins[i];
                  }
                }
              }
            }
          }

          let accent2Hex = '';
          if (bestBin2 && bestBin2.count > 0) {
            const r2 = Math.round(bestBin2.rSum / bestBin2.count);
            const g2 = Math.round(bestBin2.gSum / bestBin2.count);
            const b2 = Math.round(bestBin2.bSum / bestBin2.count);
            accent2Hex = '#' + [r2, g2, b2].map(x => x.toString(16).padStart(2, '0')).join('');
          } else {
            const hslAcc = rgbToHsl(accentR, accentG, accentB);
            const h2 = (hslAcc.h + 40) % 360;
            accent2Hex = hslToHex(h2, hslAcc.s, hslAcc.l);
          }

          const result = {
            accent: accentHex,
            accent2: accent2Hex,
            luminance: meanLuminance,
            saturation: meanSaturation
          };

          coverAnalysisCache.set(imgSrc, result);
          boundMap(coverAnalysisCache, 30);
          resolve(result);
        } catch (err) {
          resolve({ accent: '#6750A4', accent2: '#9A82DB', luminance: 0.2, saturation: 0.5 });
        }
      };
      img.onerror = () => {
        resolve({ accent: '#6750A4', accent2: '#9A82DB', luminance: 0.2, saturation: 0.5 });
      };
      img.src = imgSrc;
    });
  }

  var activeMeshLayer = 'a';
  var lastMeshKey = '';
  var lastMeshArgs = null;
  var meshCoverColors = null;

  function mixHex(a, b, t) {
    const c1 = hexToRgb(a);
    const c2 = hexToRgb(b);
    const r = Math.round(c1.r + (c2.r - c1.r) * t);
    const g = Math.round(c1.g + (c2.g - c1.g) * t);
    const bl = Math.round(c1.b + (c2.b - c1.b) * t);
    return '#' + [r, g, bl].map(x => Math.max(0, Math.min(255, x)).toString(16).padStart(2, '0')).join('');
  }

  function colorToHex(c) {
    if (!c) return '#9E9E9E';
    if (typeof c === 'string' && c.startsWith('#')) return c;
    const match = typeof c === 'string' && c.match(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
    if (match) {
      const r = parseInt(match[1], 10);
      const g = parseInt(match[2], 10);
      const b = parseInt(match[3], 10);
      return '#' + [r, g, b].map(x => Math.max(0, Math.min(255, x)).toString(16).padStart(2, '0')).join('');
    }
    return c;
  }

  async function refreshMeshCover() {
    if (!getAdv('mesh_cover_color', false) || !state.currentTrack) {
      meshCoverColors = null;
      return;
    }
    const trackBefore = state.currentTrack;
    const thumbUrl = (typeof getTrackThumbUrl === 'function' ? getTrackThumbUrl(state.currentTrack) : state.currentTrack.thumbnail) || '';
    if (!thumbUrl) {
      meshCoverColors = null;
      lastMeshKey = '';
      if (lastMeshArgs) updateMeshGradient(...lastMeshArgs);
      return;
    }
    try {
      const [a, b] = await getCoverDominantColors(thumbUrl);
      const currentUrl = (state.currentTrack && (typeof getTrackThumbUrl === 'function' ? getTrackThumbUrl(state.currentTrack) : state.currentTrack.thumbnail)) || '';
      if (!state.currentTrack || (state.currentTrack !== trackBefore && state.currentTrack.id !== trackBefore?.id) || currentUrl !== thumbUrl) return;
      meshCoverColors = [colorToHex(a), colorToHex(b || a)];
      lastMeshKey = '';
      if (lastMeshArgs) updateMeshGradient(...lastMeshArgs);
    } catch (_) {}
  }

  var coverBgIdx = 0;
  var activeCoverBgUrl = '';
  var coverBgBakedCache = new Map();

  function setCoverBg(url) {
    const enabled = getAdv('cover_bg', false);
    const layers = document.querySelectorAll('#cover-bg .cover-bg-layer');
    if (!enabled || !url) {
      activeCoverBgUrl = '';
      document.body.classList.remove('cover-bg-on');
      layers.forEach(l => l.classList.remove('on'));
      return;
    }

    if (activeCoverBgUrl === url && document.body.classList.contains('cover-bg-on')) return;
    activeCoverBgUrl = url;
    document.body.classList.add('cover-bg-on');

    const applyBakedUrl = (texUrl) => {
      if (activeCoverBgUrl !== url || layers.length < 2) return;
      const nextIdx = 1 - coverBgIdx;
      const nextLayer = layers[nextIdx];
      const prevLayer = layers[coverBgIdx];
      if (!nextLayer.querySelector('.cover-bg-blob')) {
        nextLayer.innerHTML = '<div class="cover-bg-blob b1"></div><div class="cover-bg-blob b2"></div><div class="cover-bg-blob b3"></div><div class="cover-bg-blob b4"></div>';
      }
      const cssUrl = `url(${JSON.stringify(texUrl)})`;
      nextLayer.style.backgroundImage = 'none';
      nextLayer.querySelectorAll('.cover-bg-blob').forEach(b => { b.style.backgroundImage = cssUrl; });
      nextLayer.classList.add('on');
      prevLayer.classList.remove('on');
      coverBgIdx = nextIdx;
    };

    if (coverBgBakedCache.has(url)) {
      applyBakedUrl(coverBgBakedCache.get(url));
      return;
    }

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      if (activeCoverBgUrl !== url) return;
      let baked = url;
      try {
        const c = document.createElement('canvas');
        c.width = 96;
        c.height = 96;
        const ctx = c.getContext('2d');
        ctx.filter = 'blur(4px) saturate(1.25)';
        ctx.drawImage(img, -6, -6, 108, 108);
        baked = c.toDataURL('image/jpeg', 0.82);
        coverBgBakedCache.set(url, baked);
        if (coverBgBakedCache.size > 30) coverBgBakedCache.delete(coverBgBakedCache.keys().next().value);
      } catch (_) {}
      applyBakedUrl(baked);
    };
    img.onerror = () => {
      if (img.crossOrigin) { img.crossOrigin = null; img.src = url; }
    };
    img.src = url;
  }

  function updateActiveCoverBg() {
    const enabled = getAdv('cover_bg', false);
    if (!enabled) {
      setCoverBg('');
      return;
    }
    const view = (typeof state !== 'undefined' && state.currentView) ? state.currentView : '';
    let coverUrl = '';

    if (view === 'playlist-detail') {
      const pl = state.currentPlaylist || (state.playlists && state.playlists.find(p => p.id === state.currentPlaylistId));
      if (pl) {
        coverUrl = pl.cover || (pl.tracks && pl.tracks[0] && (typeof getTrackThumbUrl === 'function' ? getTrackThumbUrl(pl.tracks[0]) : (pl.tracks[0].thumbnail || pl.tracks[0].cover))) || '';
      }
    } else if (view === 'album') {
      const album = state.currentAlbum;
      if (album) {
        coverUrl = album.cover || album.thumbnail || (album.gridCovers && album.gridCovers[0]) || '';
      }
    } else if (view === 'artist') {
      const heroImg = el.artistHeroImg || document.getElementById('artist-hero-img');
      const heroSrc = heroImg && heroImg.src ? heroImg.src : '';
      const artistData = state.currentArtistData;
      coverUrl = (artistData && (artistData.banner || artistData.avatar)) || heroSrc || '';
    }

    if (!coverUrl && state.currentTrack) {
      coverUrl = (typeof getTrackThumbUrl === 'function' ? getTrackThumbUrl(state.currentTrack) : '') || state.currentTrack.thumbnail || state.currentTrack.cover || '';
    }

    setCoverBg(coverUrl);
  }
  window.updateActiveCoverBg = updateActiveCoverBg;

  var fxItems = [];
  function registerFx(el, kind, viewEl) {
    if (!el || fxItems.some(i => i.el === el)) return;
    fxItems.push({ el, kind, view: viewEl || null, home: { parent: el.parentNode, next: el.nextSibling } });
    el.dataset.fx = kind;
  }
  function applyFxClip() {
    const free = document.body.classList.contains('no-clip-fx');
    const root = document.getElementById('fx-root');
    fxItems.forEach(i => {
      if (free) {
        if (root) root.appendChild(i.el);
        i.el.classList.add('fx-free');
      } else {
        if (i.home && i.home.parent) {
          i.home.parent.insertBefore(i.el, i.home.next && i.home.next.parentNode === i.home.parent ? i.home.next : null);
        }
        i.el.classList.remove('fx-free');
      }
    });
    updateFxVisibility();
  }
  function updateFxVisibility() {
    const free = document.body.classList.contains('no-clip-fx');
    fxItems.forEach(i => {
      const isHidden = (free && i.view && !i.view.classList.contains('active'));
      i.el.classList.toggle('fx-hidden', !!isHidden);
      i.el.style.display = '';
    });
  }

  function updateMeshGradient(accentHex, accent2Hex, mode) {
    lastMeshArgs = [accentHex, accent2Hex, mode];
    const meshA = document.getElementById('bg-mesh-a');
    const meshB = document.getElementById('bg-mesh-b');
    if (!meshA || !meshB) return;

    const isEnabled = getAdv('mesh_gradient', false) && (state.meshBrightness > 0);
    if (!isEnabled) {
      meshA.style.opacity = '0';
      meshB.style.opacity = '0';
      lastMeshKey = '';
      return;
    }

    let c1 = accentHex;
    let c2 = accent2Hex;
    const useCover = getAdv('mesh_cover_color', false);
    if (useCover && meshCoverColors) {
      c1 = meshCoverColors[0];
      c2 = meshCoverColors[1];
    }
    const followIntensity = getAdv('mesh_follow_intensity', true);
    if (followIntensity) {
      const k = Math.max(0, Math.min(1, (Number.isFinite(state.themeIntensity) ? state.themeIntensity : 100) / 100));
      c1 = mixHex(c1, '#9E9E9E', 1 - k);
      c2 = mixHex(c2, '#9E9E9E', 1 - k);
    }

    const meshKey = `${c1}_${c2}_${mode}_${state.meshBrightness}_${followIntensity}_${useCover}`;
    if (meshKey === lastMeshKey) return;
    lastMeshKey = meshKey;

    const rgb1 = hexToRgb(c1);
    const rgb2 = hexToRgb(c2);

    const brightnessScale = Math.max(0, Math.min(100, state.meshBrightness)) / 100;
    const a1 = (mode === 'light' ? 0.22 : 0.55) * brightnessScale;
    const a2 = (mode === 'light' ? 0.18 : 0.45) * brightnessScale;

    const accentRgba = `rgba(${rgb1.r}, ${rgb1.g}, ${rgb1.b}, ${a1})`;
    const accent2Rgba = `rgba(${rgb2.r}, ${rgb2.g}, ${rgb2.b}, ${a2})`;

    const gradient = `linear-gradient(to bottom, transparent 35%, var(--md-sys-color-background) 85%), ` +
      `radial-gradient(ellipse at var(--mesh-p1x, 20%) var(--mesh-p1y, 0%), ${accentRgba} 0%, transparent 70%), ` +
      `radial-gradient(ellipse at var(--mesh-p2x, 85%) var(--mesh-p2y, 5%), ${accent2Rgba} 0%, transparent 65%), ` +
      `var(--md-sys-color-background)`;

    const target = activeMeshLayer === 'a' ? meshB : meshA;
    const current = activeMeshLayer === 'a' ? meshA : meshB;

    target.style.background = gradient;
    target.style.opacity = '1';
    current.style.opacity = '0';

    const previewBg = document.getElementById('mesh-preview-bg');
    if (previewBg) {
      previewBg.style.background = gradient;
    }

    activeMeshLayer = activeMeshLayer === 'a' ? 'b' : 'a';
  }

  var currentEffectiveMode = state.themeMode === 'auto' ? 'dark' : state.themeMode;
  var lastEffectiveMode = null;

  function onEffectiveModeChanged(mode) {
    if (lastEffectiveMode === null) {
      lastEffectiveMode = mode;
      return;
    }
    if (lastEffectiveMode !== mode) {
      if (mode === 'light') {
        const now = currentUiAlpha();
        if (now < 100) {
          localStorage.setItem('riff_ui_alpha_light_prev', String(now));
          localStorage.setItem('riff_ui_alpha_light_auto', '100');
          setUiAlphaViaSlider(100);
        }
      } else if (lastEffectiveMode === 'light') {
        const auto = localStorage.getItem('riff_ui_alpha_light_auto'), prev = localStorage.getItem('riff_ui_alpha_light_prev');
        if (auto !== null && prev !== null && currentUiAlpha() === Number(auto)) setUiAlphaViaSlider(Number(prev));
        localStorage.removeItem('riff_ui_alpha_light_auto');
        localStorage.removeItem('riff_ui_alpha_light_prev');
      }
      lastEffectiveMode = mode;
    }
  }

  function relLuminance(hex) {
    const c = hexToRgb(hex);
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }

  function contrastRatio(a, b) {
    const hi = Math.max(a, b);
    const lo = Math.min(a, b);
    return (hi + 0.05) / (lo + 0.05);
  }

  function computeButtonColors(accentHex, mode) {
    const rgb = hexToRgb(accentHex);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const s = hsl.s;
    const dark = mode === 'dark';
    let l = dark ? Math.min(74, Math.max(52, hsl.l)) : Math.min(46, Math.max(32, hsl.l));
    const lumAt = (L) => relLuminance(hslToHex(hsl.h, s, L));
    while (lumAt(l) > 0.42 && l > 26) l -= 1;
    const mid = lumAt(l);
    if (mid > 0.18 && mid < 0.23) {
      while (lumAt(l) > 0.18 && l > 22) l -= 1;
    }
    const bg = hslToHex(hsl.h, s, l);
    const bgLum = relLuminance(bg);
    const darkText = '#1B1B1F';
    const fg = contrastRatio(bgLum, 1) >= contrastRatio(bgLum, relLuminance(darkText)) ? '#FFFFFF' : darkText;
    const hover = hslToHex(hsl.h, s, Math.max(0, Math.min(100, l + (dark ? 5 : -5))));
    return { bg, fg, hover, bgLum };
  }

  function applyButtonAccent(hexColor, mode, mono) {
    const root = document.documentElement.style;
    root.setProperty('--btn-primary-bg', 'var(--md-sys-color-primary)');
    root.setProperty('--btn-primary-fg', 'var(--md-sys-color-on-primary)');
    root.setProperty('--btn-primary-hover', 'color-mix(in srgb, var(--md-sys-color-on-primary) 8%, var(--md-sys-color-primary))');
  }

  function applyTheme(hexColor, mode, intensity = state.themeIntensity, brightness = state.themeBrightness, accent2 = null, isAuto = false) {
    currentEffectiveMode = mode;
    generateM3Palette(hexColor, mode, intensity, brightness);
    const themeAccent = document.documentElement.style.getPropertyValue('--md-sys-color-primary')?.trim() || hexColor;
    applyButtonAccent(themeAccent, mode, intensity < 8);
    document.body.classList.toggle('theme-light', mode === 'light');
    document.body.classList.toggle('light', mode === 'light');
    document.body.setAttribute('data-theme', mode);
    document.body.classList.toggle('theme-dark', mode === 'dark');
    document.body.classList.toggle('intensity-zero', state.themeIntensity < 8);
    onEffectiveModeChanged(mode);
    if (el.themeSwatches) {
      el.themeSwatches.forEach(sw => sw.classList.toggle('active', !!(state.themeAccent && sw.dataset.color && sw.dataset.color.toLowerCase() === state.themeAccent.toLowerCase())));
    }
    if (el.customColorInput && document.activeElement !== el.customColorInput) el.customColorInput.value = hexColor;

    const rgb = hexToRgb(hexColor);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    if (el.sliderHue) el.sliderHue.value = hsl.h;
    if (el.valHue) el.valHue.textContent = hsl.h + '°';

    if (el.sliderIntensity) {
      el.sliderIntensity.disabled = isAuto;
      el.sliderIntensity.value = intensity;
      const parent = el.sliderIntensity.closest('.setting-item');
      if (parent) parent.classList.toggle('is-disabled', isAuto);
    }
    if (el.valIntensity) el.valIntensity.textContent = intensity + '%';

    if (el.sliderBrightness) {
      el.sliderBrightness.disabled = isAuto;
      el.sliderBrightness.value = brightness;
      const parent = el.sliderBrightness.closest('.setting-item');
      if (parent) parent.classList.toggle('is-disabled', isAuto);
    }
    if (el.valBrightness) el.valBrightness.textContent = brightness + '%';

    let resolvedAccent2 = accent2;
    if (!resolvedAccent2) {
      const h2 = (hsl.h + 40) % 360;
      resolvedAccent2 = hslToHex(h2, hsl.s, hsl.l);
    }

    const mono = intensity < 8;
    updateMeshGradient(mono ? '#9E9E9E' : hexColor, mono ? '#757575' : resolvedAccent2, mode);
    refreshCachedThemeColors();
    updateLikedCoverTint(hexColor, mode, intensity, brightness);
  }

  var _likedBaseImg = null;
  var _likedBaseCanvas = null;
  var _likedBaseData = null;
  var _lastLikedTintKey = '';

  function hslToRgbTuple(h, s, l) {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const hp = ((h % 360) + 360) % 360 / 60;
    const x = c * (1 - Math.abs((hp % 2) - 1));
    let r1 = 0, g1 = 0, b1 = 0;
    if (hp < 1) { r1 = c; g1 = x; }
    else if (hp < 2) { r1 = x; g1 = c; }
    else if (hp < 3) { g1 = c; b1 = x; }
    else if (hp < 4) { g1 = x; b1 = c; }
    else if (hp < 5) { r1 = x; b1 = c; }
    else { r1 = c; b1 = x; }
    const m = l - c / 2;
    return [
      Math.round(Math.max(0, Math.min(1, r1 + m)) * 255),
      Math.round(Math.max(0, Math.min(1, g1 + m)) * 255),
      Math.round(Math.max(0, Math.min(1, b1 + m)) * 255)
    ];
  }

  function updateLikedCoverTint(hexColor, mode, intensity, brightness) {
    const styleKey = state.paletteStyle || 'classic';
    const monoBr = typeof state.monoBrightness === 'number' ? state.monoBrightness : 100;
    const key = `${hexColor}_${mode}_${intensity}_${brightness}_${styleKey}_${monoBr}`;
    if (key === _lastLikedTintKey) return;

    const runTransform = () => {
      if (!_likedBaseData || !_likedBaseCanvas) return;
      _lastLikedTintKey = key;
      const rgb = hexToRgb(hexColor || '#5247d1');
      const targetHsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
      const style = PALETTE_STYLES[styleKey] || PALETTE_STYLES.classic;
      const intensityFactor = Math.max(0, Math.min(1, (typeof intensity === 'number' ? intensity : 85) / 100));
      const isMono = intensityFactor < 0.08 || (styleKey === 'neutral' && intensityFactor < 0.05);
      const brFactor = (typeof brightness === 'number' ? brightness : 20) / 100;
      const monoFactor = monoBr / 100;

      const w = _likedBaseCanvas.width;
      const h = _likedBaseCanvas.height;
      const ctx = _likedBaseCanvas.getContext('2d');
      const outImg = ctx.createImageData(w, h);
      const src = _likedBaseData;
      const dst = outImg.data;
      const baseRefHue = 252;
      const hueSpread = style.secHueShift ? 0.55 : 0.35;
      const satBoost = (style.priSatScale || 1.0) * intensityFactor * (0.65 + (targetHsl.s / 100) * 0.65);

      for (let i = 0; i < src.length; i += 4) {
        const r = src[i] / 255;
        const g = src[i + 1] / 255;
        const b = src[i + 2] / 255;
        const a = src[i + 3];
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const d = max - min;
        const l = (max + min) / 2;
        const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
        let hDeg = 0;
        if (d > 0) {
          if (max === r) hDeg = ((g - b) / d + (g < b ? 6 : 0)) * 60;
          else if (max === g) hDeg = ((b - r) / d + 2) * 60;
          else hDeg = ((r - g) / d + 4) * 60;
        }

        const heartPreserve = Math.max(0, Math.min(1, Math.pow(Math.max(0, (l - 0.58) / 0.42), 1.35) * Math.pow(Math.max(0, 1 - s * 1.35), 1.2)));

        let newH, newS, newL;
        if (isMono) {
          newH = 0;
          newS = 0;
          const mScale = mode === 'light' ? (0.45 + monoFactor * 0.45) : (0.35 + monoFactor * 0.55);
          newL = Math.max(0.05, Math.min(0.96, l * mScale));
        } else {
          let deltaH = ((hDeg - baseRefHue + 540) % 360) - 180;
          newH = (targetHsl.h + deltaH * hueSpread + (style.secHueShift || 0) * (l * 0.25) + 360) % 360;
          newS = Math.max(0, Math.min(1, s * satBoost * 1.15));
          const lOffset = (brFactor - 0.3) * 0.14;
          newL = Math.max(0.04, Math.min(0.95, l + lOffset * (1 - Math.abs(2 * l - 1))));
        }

        const [tr, tg, tb] = hslToRgbTuple(newH, newS, newL);
        dst[i]     = Math.round(tr * (1 - heartPreserve) + src[i] * heartPreserve);
        dst[i + 1] = Math.round(tg * (1 - heartPreserve) + src[i + 1] * heartPreserve);
        dst[i + 2] = Math.round(tb * (1 - heartPreserve) + src[i + 2] * heartPreserve);
        dst[i + 3] = a;
      }

      ctx.putImageData(outImg, 0, 0);
      const dataUrl = _likedBaseCanvas.toDataURL('image/png');
      document.documentElement.style.setProperty('--liked-cover-img', `url("${dataUrl}")`);
      const heroHex = isMono
        ? hslToHex(0, 0, Math.round(25 + monoFactor * 35))
        : hslToHex(targetHsl.h, Math.min(100, Math.round(65 * intensityFactor * (style.priSatScale || 1))), mode === 'light' ? 52 : 42);
      document.documentElement.style.setProperty('--liked-hero-accent', heroHex);
    };

    if (_likedBaseData) {
      runTransform();
    } else if (!_likedBaseImg) {
      _likedBaseImg = new Image();
      _likedBaseImg.crossOrigin = 'Anonymous';
      _likedBaseImg.onload = () => {
        try {
          const size = 200;
          _likedBaseCanvas = document.createElement('canvas');
          _likedBaseCanvas.width = size;
          _likedBaseCanvas.height = size;
          const ctx = _likedBaseCanvas.getContext('2d');
          ctx.drawImage(_likedBaseImg, 0, 0, size, size);
          _likedBaseData = new Uint8ClampedArray(ctx.getImageData(0, 0, size, size).data);
          runTransform();
        } catch (_) {}
      };
      _likedBaseImg.src = '../../assets/liked.png';
    }
  }

  function updateThemeFromState() {
    if (state.themeMode === 'auto') {
      const coverThumb = (state.currentTrack && (typeof getTrackThumbUrl === 'function' ? getTrackThumbUrl(state.currentTrack) : state.currentTrack.thumbnail)) || '';
      if (coverThumb) {
        analyzeCover(coverThumb).then(analysis => {
          if (state.themeMode !== 'auto') return;

          const derivedMode = analysis.luminance > 0.58 ? 'light' : 'dark';
          const derivedIntensity = Math.min(85, Math.max(20, Math.round(analysis.saturation * 100 * 0.9)));
          let derivedBrightness;
          if (derivedMode === 'dark') {
            derivedBrightness = Math.min(60, Math.max(40, Math.round(40 + (Math.min(0.58, analysis.luminance) / 0.58) * 20)));
          } else {
            const normLum = Math.max(0, Math.min(1, (analysis.luminance - 0.58) / (1 - 0.58)));
            derivedBrightness = Math.min(75, Math.max(55, Math.round(55 + normLum * 20)));
          }

          applyTheme(analysis.accent, derivedMode, derivedIntensity, derivedBrightness, analysis.accent2, true);
        });
      } else {
        applyTheme(state.themeAccent, 'dark', state.themeIntensity, state.themeBrightness, null, true);
      }
    } else {
      applyTheme(state.themeAccent, state.themeMode, state.themeIntensity, state.themeBrightness, null, false);
    }

    if (el.themeModeBtns) {
      el.themeModeBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.themeMode === state.themeMode));
    }
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
  window.applyBannerFit = applyBannerFit;

  var SF_FONT_STACK = window.SF_FONT_STACK || '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", sans-serif';
  window.SF_FONT_STACK = SF_FONT_STACK;

  function ensureInterFontLoaded() {
    if (!document.getElementById('riff-font-inter')) {
      const link = document.createElement('link');
      link.id = 'riff-font-inter';
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
      document.head.appendChild(link);
    }
  }

  function ensureSfFontLoaded() {
    if (!document.getElementById('riff-font-sf-pro')) {
      const link = document.createElement('link');
      link.id = 'riff-font-sf-pro';
      link.rel = 'stylesheet';
      link.href = 'https://fonts.cdnfonts.com/css/sf-pro-display';
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
  window.applyFont = applyFont;

  var savedBannerBlur = parseInt(localStorage.getItem('riff_banner_blur') || '3', 10);
  var savedBannerOpacity = parseInt(localStorage.getItem('riff_banner_opacity') || '100', 10);
  var savedBannerFade = parseInt(localStorage.getItem('riff_banner_fade') || '100', 10);
  var savedBannerFit = localStorage.getItem('riff_banner_fit') || 'zoom';

  document.documentElement.style.setProperty('--banner-blur', `${savedBannerBlur}px`);
  document.documentElement.style.setProperty('--banner-opacity', `${savedBannerOpacity / 100}`);
  document.documentElement.style.setProperty('--banner-fade-base', `${savedBannerFade}%`);
  document.documentElement.style.setProperty('--banner-fade-end', `${savedBannerFade}%`);
  applyBannerFit(savedBannerFit);

  function applyUiOpacity() {
    const rawUi = parseInt(localStorage.getItem('riff_ui_alpha') || '100', 10);
    const uiAlpha = Math.max(20, Math.min(100, isNaN(rawUi) ? 100 : rawUi));

    document.documentElement.style.setProperty('--ui-alpha', `${uiAlpha}%`);
    document.documentElement.style.setProperty('--text-alpha', `100%`);

    if (el.sliderUiAlpha) el.sliderUiAlpha.value = uiAlpha;
    if (el.valUiAlpha) el.valUiAlpha.textContent = `${uiAlpha}%`;

    const rawBlur = parseInt(localStorage.getItem('riff_panel_blur') ?? '24', 10);
    const panelBlur = Math.max(0, Math.min(48, isNaN(rawBlur) ? 24 : rawBlur));
    document.documentElement.style.setProperty('--panel-blur', `${panelBlur}px`);
    document.body.style.setProperty('--panel-blur', `${panelBlur}px`);
    document.body.classList.toggle('no-panel-blur', panelBlur <= 0);
    if (el.sliderPanelBlur) el.sliderPanelBlur.value = panelBlur;
    if (el.valPanelBlur) el.valPanelBlur.textContent = `${panelBlur}px`;

    const savedPlayBtnBg = localStorage.getItem('riff_play_btn_bg') !== 'false';
    document.body.classList.toggle('play-btn-nobg', !savedPlayBtnBg);
    if (el.btnPlayBtnBg) el.btnPlayBtnBg.classList.toggle('active', savedPlayBtnBg);

    const isHomeNext = localStorage.getItem('riff_home_next_to_search') !== '0';
    document.body.classList.toggle('home-next-to-search', isHomeNext);
    const btnHomeNext = document.getElementById('btn-home-next-to-search');
    if (btnHomeNext) btnHomeNext.classList.toggle('active', isHomeNext);
  }

  applyUiOpacity();

  updateThemeFromState();

  if (state.themeMode !== 'auto') {
    if (el.sliderIntensity) el.sliderIntensity.value = state.themeIntensity;
    if (el.valIntensity) el.valIntensity.textContent = state.themeIntensity + '%';
    if (el.sliderBrightness) el.sliderBrightness.value = state.themeBrightness;
    if (el.valBrightness) el.valBrightness.textContent = state.themeBrightness + '%';
  }


  function applyVisualEffects() {
    const v = (state && state.vfx) || (typeof defaultVfx !== 'undefined' ? defaultVfx : { ambientGlow: true, bassPulse: false, vinylSpin: false, lyricsSpotlight: true });
    if (!v) return;

    if (el.coverContainer) {
      el.coverContainer.classList.toggle('vinyl-mode', !!v.vinylSpin);
      el.coverContainer.classList.toggle('spinning', !!v.vinylSpin && state.isPlaying);
    }
    document.body.classList.toggle('vfx-spotlight-on', !!v.lyricsSpotlight);
    syncVisualSettingsUI();
  }

  function syncVisualSettingsUI() {
    const v = (state && state.vfx) || (typeof defaultVfx !== 'undefined' ? defaultVfx : { ambientGlow: true, bassPulse: false, vinylSpin: false, lyricsSpotlight: true });
    if (!v) return;
    const vfxList = [
      { id: 'vfx-pulse', key: 'bassPulse' },
      { id: 'vfx-vinyl', key: 'vinylSpin' },
      { id: 'vfx-spotlight', key: 'lyricsSpotlight' }
    ];

    vfxList.forEach(item => {
      const card = document.getElementById(`card-${item.id}`);
      const badge = document.getElementById(`badge-${item.id}`);
      const btn = document.getElementById(`toggle-${item.id}`);
      const isEnabled = v[item.key];

      if (card) card.classList.toggle('enabled', !!isEnabled);
      if (badge) badge.textContent = isEnabled ? 'on' : 'off';
      if (btn) {
        btn.classList.toggle('active', !!isEnabled);
        
      }
    });
  }

  var EQ_BAND_LABELS = ['32', '64', '125', '250', '500', '1k', '2k', '4k', '8k', '16k'];


  function ensureMonoBrightnessSliderDOM() {
    ensureUiPackStyles();
    if (document.getElementById('slider-theme-mono-brightness')) return;
    const brItem = el.sliderBrightness ? el.sliderBrightness.closest('.setting-item') : document.getElementById('slider-theme-brightness')?.closest('.setting-item');
    if (!brItem || !brItem.parentNode) return;
    const item = document.createElement('div');
    item.className = 'setting-item';
    item.id = 'setting-item-mono-brightness';
    const val = typeof state.monoBrightness === 'number' ? state.monoBrightness : 100;
    item.innerHTML = `
      <div class="setting-item-top">
        <span class="setting-name">Monochrome brightness</span>
        <span class="setting-value" id="val-theme-mono-brightness">${val}%</span>
      </div>
      <input type="range" class="theme-brightness-slider pill-range" id="slider-theme-mono-brightness" min="0" max="100" step="1" value="${val}">
      <div class="setting-hints"><span>Muted</span><span>Default</span><span>Pure white</span></div>
    `;
    brItem.parentNode.insertBefore(item, brItem.nextSibling);
    const input = item.querySelector('#slider-theme-mono-brightness');
    const valDisplay = item.querySelector('#val-theme-mono-brightness');
    const onMonoChange = (e) => {
      const v = parseInt(e.target.value, 10);
      state.monoBrightness = v;
      if (valDisplay) valDisplay.textContent = v + '%';
      localStorage.setItem('riff_theme_mono_brightness', v.toString());
      updateThemeFromState();
    };
    input.addEventListener('input', onMonoChange);
    input.addEventListener('change', onMonoChange);
    if (typeof enhanceSliders === 'function') enhanceSliders(item);
  }
  ensureMonoBrightnessSliderDOM();

  if (el.sliderScale) {
    el.sliderScale.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      state.uiScale = val;
      if (el.valScale) el.valScale.textContent = `${val}%`;
    });
    el.sliderScale.addEventListener('change', (e) => {
      const val = parseInt(e.target.value, 10);
      state.uiScale = val;
      if (el.valScale) el.valScale.textContent = `${val}%`;
      localStorage.setItem('devsize_ui_scale', val.toString());
      requestAnimationFrame(() => {
        applyScale(val);
        requestAnimationFrame(resizeCanvases);
      });
    });
  }

  if (el.sliderFontScale) {
    el.sliderFontScale.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      if (el.valFontScale) el.valFontScale.textContent = `${val}%`;
      document.documentElement.style.setProperty('--font-scale', ((val / 100) * 0.95 * 1.25).toString());
      localStorage.setItem('riff_font_scale', val.toString());
      requestAnimationFrame(updateEngineWidthVar);
    });
  }

  var fontOptGoogle = document.getElementById('font-opt-google');
  var fontOptSf = document.getElementById('font-opt-sf');
  var fontOptSystem = document.getElementById('font-opt-system');
  var fontToggleContainer = document.getElementById('font-toggle');
  var fontOptInter = document.getElementById('font-opt-inter');
  if (fontToggleContainer && !fontOptInter) {
    fontOptInter = document.createElement('button');
    fontOptInter.type = 'button';
    fontOptInter.className = 'theme-mode-btn';
    fontOptInter.id = 'font-opt-inter';
    fontOptInter.dataset.font = 'inter';
    fontOptInter.innerHTML = '<span style="font-weight:700;margin-right:6px;">I</span>Inter';
    fontToggleContainer.appendChild(fontOptInter);
  }

  var googleIconSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="margin-right:6px;vertical-align:-2px;"><path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/></svg>';
  var appleIconSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="margin-right:6px;vertical-align:-2px;"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.61-.75 1.04-1.8 0.92-2.85-.9.04-2 .6-2.65 1.35-.58.66-1.09 1.73-.96 2.76 1.01.08 2.08-.51 2.69-1.26z"/></svg>';
  var systemIconSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="margin-right:6px;vertical-align:-2px;"><path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z"/></svg>';
  if (fontOptGoogle) {
    fontOptGoogle.innerHTML = googleIconSvg + 'Google Sans';
    fontOptGoogle.onclick = () => {
      localStorage.setItem('riff_font', 'google');
      applyFont('google');
      if (typeof syncAllThemeToggleIndicators === 'function') requestAnimationFrame(syncAllThemeToggleIndicators);
    };
  }
  if (fontOptSf) {
    fontOptSf.innerHTML = appleIconSvg + 'SF Pro';
    fontOptSf.onclick = () => {
      localStorage.setItem('riff_font', 'sf');
      applyFont('sf');
      if (typeof syncAllThemeToggleIndicators === 'function') requestAnimationFrame(syncAllThemeToggleIndicators);
    };
  }
  if (fontOptSystem) {
    fontOptSystem.innerHTML = systemIconSvg + 'System';
    fontOptSystem.onclick = () => {
      localStorage.setItem('riff_font', 'system');
      applyFont('system');
      if (typeof syncAllThemeToggleIndicators === 'function') requestAnimationFrame(syncAllThemeToggleIndicators);
    };
  }
  if (fontOptInter) {
    fontOptInter.innerHTML = '<span style="font-weight:700;margin-right:6px;">I</span>Inter';
    fontOptInter.onclick = () => {
      localStorage.setItem('riff_font', 'inter');
      applyFont('inter');
      if (typeof syncAllThemeToggleIndicators === 'function') requestAnimationFrame(syncAllThemeToggleIndicators);
    };
  }
  applyFont(localStorage.getItem('riff_font') || 'google');

  var classicItem = document.getElementById('btn-classic-track-rows')?.closest('.setting-item');
  if (classicItem) classicItem.remove();

  var artFontDesc = document.querySelector('#setting-art-font-row .setting-item-top div span:nth-child(2)');
  if (artFontDesc) artFontDesc.remove();

  document.querySelectorAll('#setting-riff-library .riff-beta-badge, #setting-riff-library-streaming .riff-beta-badge').forEach(b => b.remove());


  function syncBgVideoPlayback() {
    const v = document.querySelector('#custom-bg video');
    if (!v) return;
    const hidden = document.hidden || document.body.classList.contains('perf');
    if (hidden) v.pause(); else v.play().catch(() => {});
  }
  document.addEventListener('visibilitychange', syncBgVideoPlayback);
  if (window.electronAPI && window.electronAPI.onWindowVisibility) window.electronAPI.onWindowVisibility(() => syncBgVideoPlayback());

  function updateCustomBg() {
    const bgUrl = localStorage.getItem('riff_bg_url') || '';
    const opacityVal = parseInt(localStorage.getItem('riff_bg_opacity') ?? '100', 10);
    const blurVal = parseInt(localStorage.getItem('riff_bg_blur') ?? '0', 10);
    const isVideo = /\.(mp4|webm)($|\?)/i.test(bgUrl);
    document.body.classList.toggle('has-video-bg', isVideo && !!bgUrl);
    document.body.classList.toggle('has-custom-bg', !!bgUrl);

    if (sliderBgOpacity) sliderBgOpacity.value = opacityVal;
    if (valBgOpacity) valBgOpacity.textContent = `${opacityVal}%`;
    if (sliderBgBlur) sliderBgBlur.value = blurVal;
    if (valBgBlur) valBgBlur.textContent = `${blurVal}px`;

    const customBg = document.getElementById('custom-bg');
    if (!customBg) return;

    if (!bgUrl) {
      document.body.classList.remove('has-custom-bg');
      document.body.classList.remove('has-video-bg');
      customBg.innerHTML = '';
      customBg.style.display = 'none';
      if (btnRemoveCustomBg) btnRemoveCustomBg.disabled = true;
      syncBgVideoPlayback();
      return;
    }

    if (btnRemoveCustomBg) btnRemoveCustomBg.disabled = false;
    customBg.style.display = 'block';
    customBg.style.opacity = (opacityVal / 100).toString();
    customBg.style.filter = 'none';

    const currentMedia = customBg.firstElementChild;
    const tag = isVideo ? 'VIDEO' : 'IMG';

    if (!currentMedia || currentMedia.tagName !== tag || currentMedia.src !== bgUrl) {
      customBg.innerHTML = '';
      if (isVideo) {
        const vid = document.createElement('video');
        vid.src = bgUrl;
        vid.preload = 'auto';
        vid.autoplay = true;
        vid.loop = true;
        vid.muted = true;
        vid.playsInline = true;
        vid.disablePictureInPicture = true;
        vid.setAttribute('disableRemotePlayback', '');
        vid.addEventListener('loadedmetadata', () => {
          if (vid.videoWidth * vid.videoHeight > 1920 * 1080 * 1.2) {
            showToast('This background video is larger than 1080p and may stutter. A 1080p file plays smoother.', 'info');
          }
        }, { once: true });
        vid.play().catch(() => {});
        customBg.appendChild(vid);
      } else {
        const img = document.createElement('img');
        img.src = bgUrl;
        customBg.appendChild(img);
      }
    }

    const media = customBg.firstElementChild;
    if (media) {
      const q = blurVal > 0 ? 4 : 1;
      media.style.width = `${100 / q}%`;
      media.style.height = `${100 / q}%`;
      media.style.transformOrigin = '0 0';
      media.style.transform = q > 1 ? `scale(${q * 1.06}) translate(-3%, -3%)` : 'none';
      media.style.filter = blurVal > 0 ? `blur(${blurVal / q}px)` : 'none';
    }
    syncBgVideoPlayback();
  }

  function currentUiAlpha() { return Number(document.getElementById('slider-ui-alpha').value); }
  function setUiAlphaViaSlider(v) { const s = document.getElementById('slider-ui-alpha'); if (!s) return; s.value = v; s.dispatchEvent(new Event('input', { bubbles: true })); }
  function backgroundActive() { return !!localStorage.getItem('riff_bg_url') || getAdv('cover_bg', false); }
  function onBackgroundChanged(kind, enabled) {
    if (kind === 'cover') return;
    if (document.body.classList.contains('light') || document.body.getAttribute('data-theme') === 'light') return;
    if (!getAdv('ui_alpha_auto', true)) return;
    if (enabled) {
      const now = currentUiAlpha();
      if (now > 50) { localStorage.setItem('riff_ui_alpha_prev', String(now)); setUiAlphaViaSlider(50); localStorage.setItem('riff_ui_alpha_auto', '50'); }
    } else if (!backgroundActive()) {
      const auto = localStorage.getItem('riff_ui_alpha_auto'), prev = localStorage.getItem('riff_ui_alpha_prev');
      if (auto !== null && prev !== null && currentUiAlpha() === Number(auto)) setUiAlphaViaSlider(Number(prev));
      localStorage.removeItem('riff_ui_alpha_auto'); localStorage.removeItem('riff_ui_alpha_prev');
    }
  }

  var btnChooseCustomBg = document.getElementById('btn-choose-custom-bg');
  var btnChooseCustomBg = document.getElementById('btn-choose-custom-bg');
  var btnRemoveCustomBg = document.getElementById('btn-remove-custom-bg');
  var sliderBgOpacity = document.getElementById('slider-bg-opacity');
  var valBgOpacity = document.getElementById('val-bg-opacity');
  var sliderBgBlur = document.getElementById('slider-bg-blur');
  var valBgBlur = document.getElementById('val-bg-blur');

  if (btnChooseCustomBg) {
    btnChooseCustomBg.addEventListener('click', async () => {
      if (window.electronAPI && window.electronAPI.pickMedia) {
        const url = await window.electronAPI.pickMedia();
        if (url) {
          localStorage.setItem('riff_bg_url', url);
          updateCustomBg();
          onBackgroundChanged('custom', true);
        }
      }
    });
  }

  if (btnRemoveCustomBg) {
    btnRemoveCustomBg.addEventListener('click', () => {
      localStorage.removeItem('riff_bg_url');
      updateCustomBg();
      onBackgroundChanged('custom', false);
    });
  }

  if (sliderBgOpacity) {
    sliderBgOpacity.addEventListener('input', (e) => {
      const v = parseInt(e.target.value, 10);
      if (valBgOpacity) valBgOpacity.textContent = `${v}%`;
    });
    sliderBgOpacity.addEventListener('change', (e) => {
      const v = parseInt(e.target.value, 10);
      if (valBgOpacity) valBgOpacity.textContent = `${v}%`;
      localStorage.setItem('riff_bg_opacity', String(v));
      const customBg = document.getElementById('custom-bg');
      if (customBg) customBg.style.opacity = (v / 100).toString();
    });
  }

  if (sliderBgBlur) {
    sliderBgBlur.addEventListener('input', (e) => {
      const v = parseInt(e.target.value, 10);
      if (valBgBlur) valBgBlur.textContent = `${v}px`;
    });
    sliderBgBlur.addEventListener('change', (e) => {
      const v = parseInt(e.target.value, 10);
      if (valBgBlur) valBgBlur.textContent = `${v}px`;
      localStorage.setItem('riff_bg_blur', String(v));
      const customBg = document.getElementById('custom-bg');
      if (customBg) {
        customBg.style.filter = 'none';
        const media = customBg.firstElementChild;
        if (media) {
          const q = v > 0 ? 4 : 1;
          media.style.width = `${100 / q}%`;
          media.style.height = `${100 / q}%`;
          media.style.transformOrigin = '0 0';
          media.style.transform = q > 1 ? `scale(${q * 1.06}) translate(-3%, -3%)` : 'none';
          media.style.filter = v > 0 ? `blur(${v / q}px)` : 'none';
        }
      }
    });
  }

  updateCustomBg();

  var sliderCoverBgBrightness = document.getElementById('slider-cover-bg-brightness');
  var valCoverBgBrightness = document.getElementById('val-cover-bg-brightness');
  if (sliderCoverBgBrightness) {
    const savedBrightness = parseInt(localStorage.getItem('riff_cover_bg_brightness') ?? '45', 10);
    sliderCoverBgBrightness.value = savedBrightness;
    if (valCoverBgBrightness) valCoverBgBrightness.textContent = `${savedBrightness}%`;
    document.documentElement.style.setProperty('--cover-bg-brightness', (savedBrightness / 100).toString());

    sliderCoverBgBrightness.addEventListener('input', (e) => {
      const v = parseInt(e.target.value, 10);
      if (valCoverBgBrightness) valCoverBgBrightness.textContent = `${v}%`;
    });
    sliderCoverBgBrightness.addEventListener('change', (e) => {
      const v = parseInt(e.target.value, 10);
      if (valCoverBgBrightness) valCoverBgBrightness.textContent = `${v}%`;
      localStorage.setItem('riff_cover_bg_brightness', String(v));
      document.documentElement.style.setProperty('--cover-bg-brightness', (v / 100).toString());
    });
  }

  var savedCoverDrift = localStorage.getItem('riff_cover_bg_drift') !== 'false';
  document.body.classList.toggle('cover-bg-drift', savedCoverDrift);
  var savedCoverBgSpeed = parseInt(localStorage.getItem('riff_cover_bg_speed') || '24', 10);
  document.documentElement.style.setProperty('--cover-bg-speed', `${savedCoverBgSpeed}s`);

  function ensureCoverBgSettingsDOM() {
    if (document.getElementById('setting-cover-bg-drift')) return;
    const refInput = document.getElementById('slider-cover-bg-brightness');
    const refItem = refInput ? refInput.closest('.setting-item') : null;
    if (!refItem || !refItem.parentNode) return;

    const isDrift = localStorage.getItem('riff_cover_bg_drift') !== 'false';
    const speed = parseInt(localStorage.getItem('riff_cover_bg_speed') || '24', 10);

    const driftItem = document.createElement('div');
    driftItem.className = 'setting-item';
    driftItem.id = 'setting-cover-bg-drift';
    driftItem.innerHTML = `
      <div class="setting-item-top" style="align-items: center;">
        <span class="setting-name" data-i18n>Animate blurred background</span>
        <button type="button" class="effect-switch-btn ${isDrift ? 'active' : ''}" id="btn-cover-bg-drift">
          <span class="thumb"></span>
        </button>
      </div>
      <div class="setting-hint" data-i18n>Subtle floating drift motion for blurred cover art</div>
    `;

    const speedItem = document.createElement('div');
    speedItem.className = 'setting-item';
    speedItem.id = 'setting-cover-bg-speed';
    speedItem.innerHTML = `
      <div class="setting-item-top">
        <span class="setting-name" data-i18n>Animation speed</span>
        <span class="setting-value" id="val-cover-bg-speed">${speed}s</span>
      </div>
      <input type="range" class="pill-range" id="slider-cover-bg-speed" min="12" max="48" step="2" value="${speed}">
      <div class="setting-hints"><span>12s (fast)</span><span>24s</span><span>48s (slow)</span></div>
    `;

    refItem.parentNode.insertBefore(driftItem, refItem.nextSibling);
    refItem.parentNode.insertBefore(speedItem, driftItem.nextSibling);

    const btnDrift = driftItem.querySelector('#btn-cover-bg-drift');
    if (btnDrift) {
      btnDrift.onclick = () => {
        const next = !btnDrift.classList.contains('active');
        btnDrift.classList.toggle('active', next);
        localStorage.setItem('riff_cover_bg_drift', String(next));
        document.body.classList.toggle('cover-bg-drift', next);
      };
    }

    const slSpeed = speedItem.querySelector('#slider-cover-bg-speed');
    const vlSpeed = speedItem.querySelector('#val-cover-bg-speed');
    if (slSpeed) {
      slSpeed.oninput = (e) => {
        const v = parseInt(e.target.value, 10);
        if (vlSpeed) vlSpeed.textContent = `${v}s`;
        document.documentElement.style.setProperty('--cover-bg-speed', `${v}s`);
      };
      slSpeed.onchange = (e) => {
        const v = parseInt(e.target.value, 10);
        localStorage.setItem('riff_cover_bg_speed', String(v));
        document.documentElement.style.setProperty('--cover-bg-speed', `${v}s`);
      };
    }
  }
  window.ensureCoverBgSettingsDOM = ensureCoverBgSettingsDOM;
  ensureCoverBgSettingsDOM();

  updateActiveCoverBg();

  registerFx(document.getElementById('home-ambient'), 'ambient', document.getElementById('view-discover'));
  document.body.classList.toggle('no-clip-fx', !getAdv('clip_fx', false));
  document.body.classList.toggle('no-page-glow', !getAdv('page_glow_gradients', true));
  applyFxClip();

  var sliderMeshBrightness = document.getElementById('slider-mesh-brightness');
  var valMeshBrightness = document.getElementById('val-mesh-brightness');
  if (sliderMeshBrightness) {
    sliderMeshBrightness.value = state.meshBrightness;
    if (valMeshBrightness) valMeshBrightness.textContent = `${state.meshBrightness}%`;
    sliderMeshBrightness.addEventListener('input', (e) => {
      const v = parseInt(e.target.value, 10);
      if (valMeshBrightness) valMeshBrightness.textContent = `${v}%`;
    });
    sliderMeshBrightness.addEventListener('change', (e) => {
      const v = parseInt(e.target.value, 10);
      state.meshBrightness = v;
      if (valMeshBrightness) valMeshBrightness.textContent = `${v}%`;
      localStorage.setItem('riff_mesh_brightness', v.toString());
      updateThemeFromState();
    });
  }

  var DEFAULT_MESH_CFG = {
    p1: { x: 20, y: 0 },
    p2: { x: 85, y: 5 },
    speed: 0,
    blur: 0
  };

  var meshCfg = { ...DEFAULT_MESH_CFG };
  try {
    const raw = localStorage.getItem('riff_mesh_cfg');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.p1 && parsed.p2) {
        meshCfg = {
          p1: { x: Math.max(0, Math.min(100, Number(parsed.p1.x) ?? 20)), y: Math.max(0, Math.min(100, Number(parsed.p1.y) ?? 0)) },
          p2: { x: Math.max(0, Math.min(100, Number(parsed.p2.x) ?? 85)), y: Math.max(0, Math.min(100, Number(parsed.p2.y) ?? 5)) },
          speed: Math.max(0, Math.min(100, Number(parsed.speed) || 0)),
          blur: Math.max(0, Math.min(60, Number(parsed.blur) || 0))
        };
      }
    }
  } catch (_) {}

  function applyMeshCfg(cfg, save = true) {
    meshCfg = cfg;
    const root = document.documentElement;
    root.style.setProperty('--mesh-p1x', `${cfg.p1.x}%`);
    root.style.setProperty('--mesh-p1y', `${cfg.p1.y}%`);
    root.style.setProperty('--mesh-p2x', `${cfg.p2.x}%`);
    root.style.setProperty('--mesh-p2y', `${cfg.p2.y}%`);
    const speedDur = cfg.speed > 0 ? `${(120 / (cfg.speed * 0.2 + 1)).toFixed(1)}s` : '0s';
    root.style.setProperty('--mesh-speed', speedDur);
    root.style.setProperty('--mesh-blur', `${cfg.blur}px`);

    const d1 = document.getElementById('mesh-dot-1');
    const d2 = document.getElementById('mesh-dot-2');
    if (d1) {
      d1.style.left = `${cfg.p1.x}%`;
      d1.style.top = `${cfg.p1.y}%`;
    }
    if (d2) {
      d2.style.left = `${cfg.p2.x}%`;
      d2.style.top = `${cfg.p2.y}%`;
    }

    const slSpeed = document.getElementById('slider-mesh-speed');
    const vlSpeed = document.getElementById('val-mesh-speed');
    if (slSpeed) slSpeed.value = cfg.speed;
    if (vlSpeed) vlSpeed.textContent = cfg.speed === 0 ? '0 (static)' : `${cfg.speed}`;

    const slBlur = document.getElementById('slider-mesh-blur');
    const vlBlur = document.getElementById('val-mesh-blur');
    if (slBlur) slBlur.value = cfg.blur;
    if (vlBlur) vlBlur.textContent = `${cfg.blur}px`;

    if (save) {
      localStorage.setItem('riff_mesh_cfg', JSON.stringify(cfg));
    }
  }

  applyMeshCfg(meshCfg, false);

  var btnConfigureMesh = document.getElementById('btn-configure-mesh');
  var meshModal = document.getElementById('mesh-customizer-modal');
  var btnCloseMeshModal = document.getElementById('btn-close-mesh-modal');
  var btnResetMesh = document.getElementById('btn-reset-mesh');
  var sliderMeshSpeed = document.getElementById('slider-mesh-speed');
  var sliderMeshBlur = document.getElementById('slider-mesh-blur');

  function openMeshModal() {
    if (!meshModal) return;
    const card = meshModal.querySelector('.settings-card') || meshModal;
    if (card) {
      card.classList.remove('liquid-surface', 'liquid-x', 'liquid-y', 'liquid-open', 'liquid-closing');
    }
    const previewBg = document.getElementById('mesh-preview-bg');
    const meshA = document.getElementById('bg-mesh-a');
    const meshB = document.getElementById('bg-mesh-b');
    const curBg = (activeMeshLayer === 'a' ? meshB : meshA)?.style.background || meshA?.style.background;
    if (previewBg && curBg) previewBg.style.background = curBg;

    applyMeshCfg(meshCfg, false);
    openModal(meshModal);
  }

  function closeMeshModal() {
    if (!meshModal) return;
    const card = meshModal.querySelector('.settings-card') || meshModal;
    if (card) {
      card.classList.remove('liquid-surface', 'liquid-x', 'liquid-y', 'liquid-open', 'liquid-closing');
    }
    closeModal(meshModal);
  }

  if (btnConfigureMesh) btnConfigureMesh.addEventListener('click', openMeshModal);
  if (btnCloseMeshModal) btnCloseMeshModal.addEventListener('click', closeMeshModal);
  if (meshModal) {
    meshModal.addEventListener('click', (e) => {
      if (e.target === meshModal) closeMeshModal();
    });
  }

  if (sliderMeshSpeed) {
    sliderMeshSpeed.addEventListener('input', (e) => {
      meshCfg.speed = parseInt(e.target.value, 10);
      applyMeshCfg(meshCfg, true);
    });
  }

  if (sliderMeshBlur) {
    sliderMeshBlur.addEventListener('input', (e) => {
      meshCfg.blur = parseInt(e.target.value, 10);
      applyMeshCfg(meshCfg, true);
    });
  }

  if (btnResetMesh) {
    btnResetMesh.addEventListener('click', () => {
      applyMeshCfg({
        p1: { x: 20, y: 0 },
        p2: { x: 85, y: 5 },
        speed: 0,
        blur: 0
      }, true);
    });
  }

  var previewBox = document.getElementById('mesh-preview-box');
  var dot1 = document.getElementById('mesh-dot-1');
  var dot2 = document.getElementById('mesh-dot-2');

  function attachDotDrag(dotEl, key) {
    if (!dotEl || !previewBox) return;
    let isDragging = false;

    dotEl.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      isDragging = true;
      dotEl.setPointerCapture(e.pointerId);
      dotEl.style.cursor = 'grabbing';
      dotEl.focus();
    });

    dotEl.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      const rect = previewBox.getBoundingClientRect();
      const x = Math.max(0, Math.min(100, Math.round(((e.clientX - rect.left) / rect.width) * 100)));
      const y = Math.max(0, Math.min(100, Math.round(((e.clientY - rect.top) / rect.height) * 100)));
      meshCfg[key] = { x, y };
      applyMeshCfg(meshCfg, true);
    });

    const endDrag = (e) => {
      if (isDragging) {
        isDragging = false;
        try { dotEl.releasePointerCapture(e.pointerId); } catch (_) {}
        dotEl.style.cursor = 'grab';
      }
    };
    dotEl.addEventListener('pointerup', endDrag);
    dotEl.addEventListener('pointercancel', endDrag);

    dotEl.addEventListener('keydown', (e) => {
      let dx = 0, dy = 0;
      if (e.key === 'ArrowLeft') dx = -1;
      else if (e.key === 'ArrowRight') dx = 1;
      else if (e.key === 'ArrowUp') dy = -1;
      else if (e.key === 'ArrowDown') dy = 1;
      else return;
      e.preventDefault();
      const cur = meshCfg[key];
      const x = Math.max(0, Math.min(100, cur.x + dx));
      const y = Math.max(0, Math.min(100, cur.y + dy));
      meshCfg[key] = { x, y };
      applyMeshCfg(meshCfg, true);
    });
  }

  attachDotDrag(dot1, 'p1');
  attachDotDrag(dot2, 'p2');

  var paletteDropdown = document.getElementById('palette-style-dropdown');
  var paletteTrigger = document.getElementById('palette-style-trigger');
  var paletteLabel = document.getElementById('palette-style-trigger-label');
  var paletteMenu = document.getElementById('palette-style-menu');
  if (paletteDropdown && paletteTrigger && paletteMenu) {
    const currentStyle = state.paletteStyle || 'classic';
    const styleObj = PALETTE_STYLES[currentStyle] || PALETTE_STYLES.classic;
    if (paletteLabel) paletteLabel.textContent = styleObj.label;
    paletteMenu.querySelectorAll('.m3-dropdown-option').forEach(opt => {
      opt.classList.toggle('selected', opt.dataset.value === currentStyle);
    });

    paletteTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      paletteDropdown.classList.toggle('open');
    });

    paletteMenu.querySelectorAll('.m3-dropdown-option').forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        const val = opt.dataset.value;
        state.paletteStyle = val;
        localStorage.setItem('riff_palette_style', state.paletteStyle);
        if (paletteLabel) paletteLabel.textContent = opt.textContent;
        paletteMenu.querySelectorAll('.m3-dropdown-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        paletteDropdown.classList.remove('open');
        updateThemeFromState();
      });
    });

    document.addEventListener('click', () => {
      paletteDropdown.classList.remove('open');
    });
  }

  var btnToggleAdv = document.getElementById('btn-toggle-adv-section');
  var advWrapper = document.getElementById('adv-collapsible-wrapper');
  if (btnToggleAdv && advWrapper) {
    const isAdvOpen = localStorage.getItem('riff_adv_open') === 'true';
    if (isAdvOpen) {
      btnToggleAdv.classList.add('is-open');
      advWrapper.classList.add('is-open');
    }
    btnToggleAdv.addEventListener('click', () => {
      const nowOpen = advWrapper.classList.toggle('is-open');
      btnToggleAdv.classList.toggle('is-open', nowOpen);
      localStorage.setItem('riff_adv_open', nowOpen ? 'true' : 'false');
    });
  }

  var advButtons = document.querySelectorAll('.effect-switch-btn[data-adv]');
  advButtons.forEach(btn => {
    const key = btn.dataset.adv;
    const defaultVal = key === 'reduce_motion' ? systemPrefersReducedMotion() : (key === 'mesh_gradient' || key === 'mesh_cover_color' || key === 'clip_fx' || key === 'intensity_bg' || key === 'hide_titlebar' || key === 'classic_sidebar' || key === 'cover_bg' || key === 'track_banners') ? false : true;
    const currentVal = getAdv(key, defaultVal);
    btn.classList.toggle('active', currentVal);

    btn.addEventListener('click', () => {
      const newVal = !btn.classList.contains('active');
      document.querySelectorAll(`.effect-switch-btn[data-adv="${key}"]`).forEach(b => b.classList.toggle('active', newVal));
      setAdv(key, newVal);

      if (key === 'reduce_motion') {
        applyReducedMotionSetting();
      } else if (key === 'classic_sidebar') {
        document.body.classList.toggle('classic-sidebar', !!newVal);
        setTimeout(() => {
          if (typeof updateNavIndicator === 'function') updateNavIndicator(false);
          if (typeof resizeCanvases === 'function') resizeCanvases();
        }, 260);
      } else if (key === 'hide_titlebar') {
        document.body.classList.toggle('hide-titlebar', !!newVal);
      } else if (key === 'autohide_timestamps') {
        document.body.classList.toggle('keep-bar-timestamps', !newVal);
      } else if (key === 'intensity_bg') {
        updateThemeFromState();
      } else if (key === 'mesh_gradient') {
        updateThemeFromState();
      } else if (key === 'mesh_follow_intensity') {
        lastMeshKey = '';
        if (lastMeshArgs) updateMeshGradient(...lastMeshArgs);
      } else if (key === 'mesh_cover_color') {
        refreshMeshCover();
        lastMeshKey = '';
        if (lastMeshArgs) updateMeshGradient(...lastMeshArgs);
      } else if (key === 'cover_bg') {
        updateActiveCoverBg();
        if (typeof onBackgroundChanged === 'function') onBackgroundChanged('cover', newVal);
      } else if (key === 'clip_fx') {
        document.body.classList.toggle('no-clip-fx', !newVal);
        applyFxClip();
      } else if (key === 'page_glow_gradients') {
        document.body.classList.toggle('no-page-glow', !newVal);
      } else if (key === 'albums') {
        if (!newVal && state.currentView === 'album') {
          const target = (state.previousView && state.previousView !== 'album') ? state.previousView : 'discover';
          switchView(target);
        }
      } else if (key === 'my_wave' || key === 'jump_back' || key === 'fav_artists') {
        initHomeHero();
        if (newVal) loadHomePage();
        applyHomeLayout();
      } else if (key === 'my_wave_ambient') {
        const homeAmb = document.getElementById('home-ambient');
        if (homeAmb) homeAmb.style.display = newVal ? '' : 'none';
        const ambientEl = document.getElementById('my-wave-ambient-light');
        if (ambientEl) ambientEl.style.display = newVal ? '' : 'none';
        const jumpAmbient = document.getElementById('jump-ambient-light');
        if (jumpAmbient) jumpAmbient.style.display = newVal ? '' : 'none';
      } else if (key === 'banners' || key === 'track_banners') {
        const bannerR = document.getElementById('right-panel-banner');
        const bannerP = document.getElementById('playlist-header-banner');
        const showR = getAdv('banners', true) && getAdv('track_banners', false);
        const showP = getAdv('banners', true);
        if (bannerR) {
          bannerR.style.display = showR ? '' : 'none';
          if (!showR) {
            bannerR.style.opacity = '0';
            const vid = bannerR.querySelector('video.banner-video');
            if (vid) vid.remove();
          }
        }
        if (bannerP) {
          bannerP.style.display = showP ? '' : 'none';
          if (!showP) {
            bannerP.style.opacity = '0';
          }
        }
        if (showR && state.currentTrack) {
          updateRightPanelBanner(getTrackThumbUrl(state.currentTrack));
        }
        if (state.isTvKaraokeOpen) syncTvBanner();
      } else if (key === 'karaoke_words') {
        renderLyricsView();
      } else if (key === 'track_credits' || key === 'credits_fallback') {
        updateRightPanelCredits(state.currentTrack);
      }
    });
  });

  var btnSearchArtists = document.getElementById('btn-search-artists');
  if (btnSearchArtists) {
    btnSearchArtists.classList.toggle('active', localStorage.getItem('riff_search_artists') !== '0');
    btnSearchArtists.addEventListener('click', () => {
      const v = !btnSearchArtists.classList.contains('active');
      btnSearchArtists.classList.toggle('active', v);
      localStorage.setItem('riff_search_artists', v ? '1' : '0');
    });
  }

  var btnClassicTrackRows = document.getElementById('btn-classic-track-rows');
  if (btnClassicTrackRows) {
    const isClassic = localStorage.getItem('riff_classic_track_rows') === '1';
    btnClassicTrackRows.classList.toggle('active', isClassic);
    document.body.classList.toggle('classic-track-rows', isClassic);
    btnClassicTrackRows.addEventListener('click', () => {
      const on = !document.body.classList.contains('classic-track-rows');
      document.body.classList.toggle('classic-track-rows', on);
      btnClassicTrackRows.classList.toggle('active', on);
      localStorage.setItem('riff_classic_track_rows', on ? '1' : '0');
    });
  }

  var btnSpTableCols = document.getElementById('btn-sp-table-cols');
  if (btnSpTableCols) {
    const isColsOn = localStorage.getItem('riff_sp_table_cols') !== '0';
    btnSpTableCols.classList.toggle('active', isColsOn);
    document.body.classList.toggle('hide-sp-table-cols', !isColsOn);
    btnSpTableCols.addEventListener('click', () => {
      const on = !btnSpTableCols.classList.contains('active');
      btnSpTableCols.classList.toggle('active', on);
      document.body.classList.toggle('hide-sp-table-cols', !on);
      localStorage.setItem('riff_sp_table_cols', on ? '1' : '0');
    });
  }

  var btnShowSourceLogo = document.getElementById('btn-show-source-logo');
  var showSourceLogo = localStorage.getItem('riff_show_source_logo') === '1';
  document.body.classList.toggle('show-source-logo', showSourceLogo);
  if (btnShowSourceLogo) {
    btnShowSourceLogo.classList.toggle('active', showSourceLogo);
    btnShowSourceLogo.addEventListener('click', () => {
      const next = !document.body.classList.contains('show-source-logo');
      document.body.classList.toggle('show-source-logo', next);
      btnShowSourceLogo.classList.toggle('active', next);
      localStorage.setItem('riff_show_source_logo', next ? '1' : '0');
    });
  }

  var btnLyricsFullscreenOnly = document.getElementById('btn-lyrics-fullscreen-only');
  if (btnLyricsFullscreenOnly) {
    btnLyricsFullscreenOnly.classList.toggle('active', isLyricsFullscreenOnly());
    document.body.classList.toggle('lyrics-fullscreen-only', isLyricsFullscreenOnly());
    btnLyricsFullscreenOnly.addEventListener('click', () => {
      const next = !btnLyricsFullscreenOnly.classList.contains('active');
      btnLyricsFullscreenOnly.classList.toggle('active', next);
      localStorage.setItem('riff_lyrics_fullscreen_only', next ? '1' : '0');
      document.body.classList.toggle('lyrics-fullscreen-only', next);
      updateRightPanelCredits(state.currentTrack);
    });
  }

  var btnSmooth = document.getElementById('btn-smooth-presets');
  if (btnSmooth) {
    btnSmooth.classList.toggle('active', localStorage.getItem('riff_smooth_presets') !== 'false');
    btnSmooth.addEventListener('click', () => {
      const v = !btnSmooth.classList.contains('active');
      btnSmooth.classList.toggle('active', v);
      localStorage.setItem('riff_smooth_presets', String(v));
    });
  }
  var sidebarEl = document.getElementById('sidebar') || (el && el.sidebar);
  if (sidebarEl) {
    sidebarEl.classList.add('no-nav-anim');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        sidebarEl.classList.remove('no-nav-anim');
      });
    });
  }

  var btnShowLocal = document.getElementById('btn-show-local');

  function setDisableAnimations(on, showFeedback = false) {
    isDisableAnimations = !!on;
    localStorage.setItem('riff_disable_animations', on ? '1' : '0');
    localStorage.setItem('riff_perf_mode', on ? '1' : '0');
    document.body.classList.toggle('perf', !!on);
    document.documentElement.classList.toggle('force-reduced-motion', !!on);
    if (typeof applyPerfMode === 'function') applyPerfMode(on);
    if (typeof setAdv === 'function') setAdv('reduce_motion', !!on);
    if (typeof applyReducedMotionSetting === 'function') applyReducedMotionSetting();

    const btn = document.getElementById('btn-disable-animations');
    if (btn) btn.classList.toggle('active', !!on);
    const oldPerfBtn = document.getElementById('btn-perf-mode');
    if (oldPerfBtn) oldPerfBtn.classList.toggle('active', !!on);

    if (showFeedback && typeof showToast === 'function') {
      showToast(on ? 'Animations disabled' : 'Animations restored', 'info');
    }
  }
  window.setDisableAnimations = setDisableAnimations;

  function ensureDisableAnimationsDOM() {
    const pane = document.querySelector('#view-settings .settings-section[data-cat="interface"] .m3-group')
      || document.querySelector('#view-settings .settings-section[data-cat="interface"]');
    if (!pane) return;

    let item = document.getElementById('setting-disable-animations');
    if (!item) {
      item = document.createElement('div');
      item.className = 'setting-item';
      item.id = 'setting-disable-animations';
      item.style.cssText = 'flex-direction: column; align-items: stretch;';
      item.innerHTML = '<div class="setting-item-top" style="align-items: center; justify-content: space-between;"><div style="display: flex; flex-direction: column; gap: 2px;"><span class="setting-name" data-i18n>Disable animations</span><span style="font-size: calc(12px * var(--font-scale, 1)); color: var(--md-sys-color-outline);" data-i18n>Reduces CPU & GPU usage and feels more responsive, but no smooth animations.</span></div><button class="effect-switch-btn" id="btn-disable-animations" type="button"><span class="thumb"></span></button></div>';
      pane.insertBefore(item, pane.firstChild);

      const btnDisable = document.getElementById('btn-disable-animations');
      if (btnDisable) {
        btnDisable.addEventListener('click', () => {
          const next = !btnDisable.classList.contains('active');
          setDisableAnimations(next, true);
        });
      }
    }

    const btnDisable = document.getElementById('btn-disable-animations');
    if (btnDisable) btnDisable.classList.toggle('active', isDisableAnimations);

    const oldPerf = document.getElementById('btn-perf-mode');
    if (oldPerf) {
      const oldItem = oldPerf.closest('.setting-item');
      if (oldItem && oldItem !== item) oldItem.style.display = 'none';
    }
  }
  window.ensureDisableAnimationsDOM = ensureDisableAnimationsDOM;

  setDisableAnimations(isDisableAnimations, false);

  var btnPerfMode = document.getElementById('btn-perf-mode');
  if (btnPerfMode) {
    btnPerfMode.addEventListener('click', () => {
      const next = !btnPerfMode.classList.contains('active');
      setDisableAnimations(next);
    });
  }

  var btnWavyProgress = document.getElementById('btn-wavy-progress');
  var btnProgressKnob = document.getElementById('btn-progress-knob');
  var btnProgressBg = document.getElementById('btn-progress-bg');

  if (btnWavyProgress) {
    btnWavyProgress.addEventListener('click', () => {
      const isWavy = localStorage.getItem('riff_wavy_progress') === 'true';
      const next = !isWavy;
      localStorage.setItem('riff_wavy_progress', next ? 'true' : 'false');
      updateWavyProgressUI();
      hasDrawnPausedFrame = false;
    });
  }

  if (btnProgressKnob) {
    btnProgressKnob.addEventListener('click', () => {
      const isKnob = localStorage.getItem('riff_progress_knob') === 'true';
      const next = !isKnob;
      localStorage.setItem('riff_progress_knob', next ? 'true' : 'false');
      updateProgressKnobUI();
      hasDrawnPausedFrame = false;
      if (!animationFrameId && typeof startVisualizers === 'function') startVisualizers();
    });
  }

  if (btnProgressBg) {
    btnProgressBg.addEventListener('click', () => {
      const isBg = localStorage.getItem('riff_progress_bg') !== 'false';
      const next = !isBg;
      localStorage.setItem('riff_progress_bg', next ? 'true' : 'false');
      updateProgressBgUI();
      hasDrawnPausedFrame = false;
      if (!animationFrameId && typeof startVisualizers === 'function') startVisualizers();
    });
  }

  if (typeof updateWavyProgressUI === 'function') updateWavyProgressUI();
  if (typeof updateProgressKnobUI === 'function') updateProgressKnobUI();
  if (typeof updateProgressBgUI === 'function') updateProgressBgUI();

  var btnTrayOnClose = document.getElementById('btn-tray-on-close');
  var storedTrayOnClose = localStorage.getItem('riff_tray_on_close');
  var savedTrayOnClose = storedTrayOnClose !== null
    ? storedTrayOnClose === 'true'
    : /Windows|Mac/.test(navigator.userAgent);
  if (btnTrayOnClose) {
    btnTrayOnClose.classList.toggle('active', savedTrayOnClose);
    btnTrayOnClose.addEventListener('click', () => {
      const next = !btnTrayOnClose.classList.contains('active');
      btnTrayOnClose.classList.toggle('active', next);
      localStorage.setItem('riff_tray_on_close', next ? 'true' : 'false');
      if (window.electronAPI && window.electronAPI.setTrayOnClose) {
        window.electronAPI.setTrayOnClose(next);
      }
    });
  }
  if (window.electronAPI && window.electronAPI.setTrayOnClose) {
    window.electronAPI.setTrayOnClose(savedTrayOnClose);
  }

  var btnMultiInstance = document.getElementById('btn-multi-instance');
  if (btnMultiInstance && window.electronAPI && window.electronAPI.getMultiInstance) {
    window.electronAPI.getMultiInstance().then((on) => btnMultiInstance.classList.toggle('active', !!on));
    btnMultiInstance.addEventListener('click', () => {
      const next = !btnMultiInstance.classList.contains('active');
      btnMultiInstance.classList.toggle('active', next);
      window.electronAPI.setMultiInstance(next);
      showToast(next ? 'Multiple instances will be allowed after restart' : 'Single instance mode after restart', 'info');
    });
  }

  var btnGlobalShortcuts = document.getElementById('btn-global-shortcuts');
  if (btnGlobalShortcuts && window.electronAPI && window.electronAPI.getGlobalShortcuts) {
    window.electronAPI.getGlobalShortcuts().then((on) => btnGlobalShortcuts.classList.toggle('active', !!on));
    btnGlobalShortcuts.addEventListener('click', () => {
      const next = !btnGlobalShortcuts.classList.contains('active');
      btnGlobalShortcuts.classList.toggle('active', next);
      window.electronAPI.setGlobalShortcuts(next);
    });
  }


  function applyCustomStyles() {
    document.querySelectorAll('style[data-riff-custom]').forEach((n) => n.remove());
    customThemes.filter((t) => t.enabled).forEach((t) => {
      const s = document.createElement('style');
      s.dataset.riffCustom = 'theme';
      s.dataset.themeId = t.id;
      s.textContent = t.css;
      document.head.appendChild(s);
    });
    const userCss = localStorage.getItem('riff_custom_css') || '';
    if (userCss.trim()) {
      const s = document.createElement('style');
      s.dataset.riffCustom = 'user';
      s.textContent = userCss;
      document.head.appendChild(s);
    }
    if (typeof refreshCachedThemeColors === 'function') refreshCachedThemeColors();
  }

  function resetCustomStyling() {
    const userCss = localStorage.getItem('riff_custom_css') || '';
    if (userCss.trim()) localStorage.setItem('riff_custom_css_backup', userCss);
    localStorage.removeItem('riff_custom_css');
    customThemes.forEach((t) => { t.enabled = false; });
    if (window.electronAPI && window.electronAPI.disableAllThemes) window.electronAPI.disableAllThemes();
    if (typeof cssEditorInstance !== 'undefined' && cssEditorInstance) cssEditorInstance.setValue('');
    if (window.electronAPI && window.electronAPI.disableAllPlugins) window.electronAPI.disableAllPlugins();
    pluginsCache.forEach((p) => { p.enabled = false; stopPlugin(p, true); });
    renderPluginCards();
    applyCustomStyles();
    renderThemeCards();
    showToast('Custom CSS, themes and plugins reset (Ctrl+Shift+R)', 'info');
  }

  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && e.code === 'KeyR') {
      e.preventDefault();
      e.stopPropagation();
      resetCustomStyling();
    }
  }, true);

  async function mountThemePreview(host, themeCss) {
    const root = host.shadowRoot || host.attachShadow({ mode: 'open' });
    root.textContent = '';
    const baseStyle = document.createElement('style');
    baseStyle.textContent = `
      :host { display: block; width: 100%; height: 100%; position: relative; overflow: hidden; background: #121214; font-family: sans-serif; }
      .ct-mini { width: 100%; height: 100%; display: grid; grid-template-columns: 26% 1fr; grid-template-rows: 1fr 22%; gap: 4px; padding: 6px; box-sizing: border-box; background: var(--md-sys-color-background, #121214); color: var(--md-sys-color-on-surface, #e6e6e8); }
      .m-sb { background: var(--md-sys-color-surface-container, #1e1f22); border-radius: 6px; padding: 5px; display: flex; flex-direction: column; gap: 4px; }
      .m-pill { height: 8px; border-radius: 4px; background: var(--md-sys-color-primary, #5247d1); width: 70%; }
      .m-row { height: 6px; border-radius: 3px; background: var(--md-sys-color-surface-container-high, #28292c); }
      .m-main { background: var(--md-sys-color-surface-container-low, #1a1b1e); border-radius: 6px; padding: 6px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; align-content: start; }
      .m-card { aspect-ratio: 1; border-radius: 5px; background: var(--md-sys-color-surface-container-high, #28292c); }
      .m-bar { grid-column: 1 / -1; background: var(--md-sys-color-surface-container, #1e1f22); border-radius: 6px; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 0 8px; }
      .m-play { width: 12px; height: 12px; border-radius: 50%; background: var(--md-sys-color-primary, #5247d1); }
      .m-line { flex: 1; height: 3px; border-radius: 2px; background: var(--md-sys-color-primary, #5247d1); opacity: 0.75; }
    `;
    const userStyle = document.createElement('style');
    userStyle.textContent = String(themeCss || '')
      .replace(/:root/g, ':host, .ct-mini')
      .replace(/(^|[\s,{};])html(?![\w-])/g, '$1:host')
      .replace(/(^|[\s,{};])body(?![\w-])/g, '$1.ct-mini');
    const mini = document.createElement('div');
    mini.className = 'ct-mini ' + document.body.className;
    mini.innerHTML = '<div class="m-sb"><div class="m-pill"></div><div class="m-row"></div><div class="m-row"></div></div><div class="m-main"><div class="m-card"></div><div class="m-card"></div><div class="m-card"></div></div><div class="m-bar"><div class="m-play"></div><div class="m-line"></div></div>';
    root.append(baseStyle, userStyle, mini);
  }

  function renderThemeCards() {
    const list = document.getElementById('custom-themes-list');
    if (!list) return;
    list.innerHTML = '';
    if (!customThemes.length) {
      const empty = document.createElement('div');
      empty.className = 'ct-empty';
      empty.textContent = 'No themes yet. Click Add and choose a .css file.';
      list.appendChild(empty);
      return;
    }
    customThemes.forEach((t) => {
      const card = document.createElement('div');
      card.className = 'ct-card';
      card.innerHTML = '<div class="ct-preview"></div><div class="ct-info"><div class="ct-name"></div><div class="ct-meta"></div></div><button class="btn-icon-pill ct-remove" title="Remove"><svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button><button class="effect-switch-btn"><span class="thumb"></span></button>';
      card.querySelector('.ct-name').textContent = t.name;
      card.querySelector('.ct-meta').textContent = [t.author && `by ${t.author}`, t.description].filter(Boolean).join(' · ');
      const preview = card.querySelector('.ct-preview');
      preview.style.aspectRatio = `${window.innerWidth} / ${window.innerHeight}`;
      const toggle = card.querySelector('.effect-switch-btn');
      toggle.classList.toggle('active', !!t.enabled);
      toggle.addEventListener('click', () => {
        t.enabled = !t.enabled;
        toggle.classList.toggle('active', t.enabled);
        window.electronAPI.setThemeEnabled(t.id, t.enabled);
        applyCustomStyles();
      });
      card.querySelector('.ct-remove').addEventListener('click', () => {
        window.electronAPI.removeTheme(t.id);
        customThemes = customThemes.filter((x) => x.id !== t.id);
        applyCustomStyles();
        renderThemeCards();
        showToast('Theme removed', 'info');
      });
      list.appendChild(card);
      mountThemePreview(preview, t.css);
    });
  }

  async function loadCustomThemes() {
    if (!window.electronAPI || !window.electronAPI.listThemes) {
      applyCustomStyles();
      return;
    }
    customThemes = await window.electronAPI.listThemes();
    applyCustomStyles();
  }

  var btnAddTheme = document.getElementById('btn-add-theme');
  if (btnAddTheme && window.electronAPI && window.electronAPI.importThemes) {
    btnAddTheme.addEventListener('click', async () => {
      const added = await window.electronAPI.importThemes();
      if (!added.length) return;
      customThemes.push(...added);
      renderThemeCards();
      showToast(`Added ${added.length} theme${added.length > 1 ? 's' : ''}. Turn one on to try it`, 'info');
    });
  }

  var loadedPlugins = new Map();
  var pluginListeners = [];
  var shuffleProvider = null;

  async function setHomeAmbient(url) {
    const box = document.getElementById('home-ambient');
    if (!box) return;
    const layers = box.querySelectorAll('.home-ambient-layer');
    if (!url) {
      currentAmbientUrl = null;
      layers.forEach(l => {
        l.classList.remove('on');
        l.style.background = '';
      });
      return;
    }
    currentAmbientUrl = url;
    try {
      const [c1, c2] = await getCoverDominantColors(url);
      if (currentAmbientUrl !== url) return;
      const next = layers[ambientIdx ^ 1];
      const prev = layers[ambientIdx];
      const gradient = `radial-gradient(circle 550px at 28% 35%, ${c1} 0%, transparent 68%), radial-gradient(circle 550px at 72% 65%, ${c2} 0%, transparent 68%)`;
      if (next) {
        next.style.backgroundImage = 'none';
        next.style.background = gradient;
        next.classList.add('on');
      }
      if (prev) {
        prev.classList.remove('on');
      }
      ambientIdx ^= 1;
    } catch (e) {
      console.warn('Ambient error:', e);
    }
  }

  function syncHomeAmbientVisibility() {
    const ambient = document.getElementById('home-ambient');
    if (!ambient) return;
    const isDiscoverActive = state.currentView === 'discover' && el.viewDiscover && el.viewDiscover.classList.contains('active');
    const isSearchShowing = el.searchResultsContainer && !el.searchResultsContainer.classList.contains('hidden');
    const isDiscoverEmptyShowing = el.discoverEmpty && !el.discoverEmpty.classList.contains('hidden');
    const hasModes = typeof availableModes === 'function' ? availableModes().length > 0 : true;
    const isAmbientEnabled = getAdv('my_wave_ambient', true);

    const shouldShow = isDiscoverActive && !isSearchShowing && isDiscoverEmptyShowing && hasModes && isAmbientEnabled;
    ambient.classList.toggle('ambient-hidden', !shouldShow);
    ambient.style.display = shouldShow ? '' : 'none';
  }

  async function updateAmbientLight(ambientEl, thumbnailUrl) {
    let url = '';
    if (typeof thumbnailUrl === 'string') {
      url = thumbnailUrl;
    } else if (typeof ambientEl === 'string') {
      if (ambientEl === 'my-wave-ambient-light' || ambientEl === 'jump-ambient-light') {
        url = typeof thumbnailUrl === 'string' ? thumbnailUrl : '';
      } else {
        url = ambientEl;
      }
    } else if (ambientEl && typeof ambientEl === 'object' && typeof thumbnailUrl === 'string') {
      url = thumbnailUrl;
    }

    syncHomeAmbientVisibility();
    setHomeAmbient(url);
  }

  var currentWaveFocusedIndex = 0;


    var likedBaseImg = null;
    var likedCanvas = null;
    var likedBasePixels = null;
    var lastTintSig = '';

    var hslToRgbArr = (h, s, l) => {
      const c = (1 - Math.abs(2 * l - 1)) * s;
      const hp = (((h % 360) + 360) % 360) / 60;
      const x = c * (1 - Math.abs((hp % 2) - 1));
      let r1 = 0, g1 = 0, b1 = 0;
      if (hp < 1) { r1 = c; g1 = x; }
      else if (hp < 2) { r1 = x; g1 = c; }
      else if (hp < 3) { g1 = c; b1 = x; }
      else if (hp < 4) { g1 = x; b1 = c; }
      else if (hp < 5) { r1 = x; b1 = c; }
      else { r1 = c; b1 = x; }
      const m = l - c / 2;
      return [
        Math.round(Math.max(0, Math.min(1, r1 + m)) * 255),
        Math.round(Math.max(0, Math.min(1, g1 + m)) * 255),
        Math.round(Math.max(0, Math.min(1, b1 + m)) * 255)
      ];
    };

    var refreshLikedCoverTint = () => {
      const accent = document.documentElement.style.getPropertyValue('--md-sys-color-primary')?.trim() || state.themeAccent || '#5247d1';
      const mode = document.body.classList.contains('theme-light') ? 'light' : 'dark';
      const intensity = state.themeIntensity ?? 85;
      const brightness = state.themeBrightness ?? 20;
      const monoBr = state.monoBrightness ?? 100;
      const styleKey = state.paletteStyle || 'classic';
      const sig = `${accent}|${mode}|${intensity}|${brightness}|${monoBr}|${styleKey}`;
      if (sig === lastTintSig && likedBasePixels) return;

      const applyPixels = () => {
        if (!likedBasePixels || !likedCanvas) return;
        lastTintSig = sig;
        const rgb = hexToRgb(accent.startsWith('#') ? accent : (state.themeAccent || '#5247d1'));
        const thsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
        const style = PALETTE_STYLES[styleKey] || PALETTE_STYLES.classic;
        const intF = Math.max(0, Math.min(1, intensity / 100));
        const isMono = intF < 0.08 || (styleKey === 'neutral' && intF < 0.05);
        const brF = brightness / 100;
        const monoF = monoBr / 100;
        const ctx = likedCanvas.getContext('2d');
        const out = ctx.createImageData(likedCanvas.width, likedCanvas.height);
        const dst = out.data;

        for (let i = 0; i < likedBasePixels.length; i += 4) {
          const r = likedBasePixels[i] / 255;
          const g = likedBasePixels[i + 1] / 255;
          const b = likedBasePixels[i + 2] / 255;
          const a = likedBasePixels[i + 3];
          const max = Math.max(r, g, b), min = Math.min(r, g, b);
          const d = max - min;
          const l = (max + min) / 2;
          const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
          let h = 0;
          if (d > 0) {
            if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
            else if (max === g) h = ((b - r) / d + 2) * 60;
            else h = ((r - g) / d + 4) * 60;
          }
          const heartKeep = Math.max(0, Math.min(1, Math.pow(Math.max(0, (l - 0.58) / 0.42), 1.35) * Math.pow(Math.max(0, 1 - s * 1.35), 1.2)));
          let nh, ns, nl;
          if (isMono) {
            nh = 0;
            ns = 0;
            nl = Math.max(0.05, Math.min(0.96, l * (mode === 'light' ? (0.45 + monoF * 0.45) : (0.35 + monoF * 0.55))));
          } else {
            const dh = ((h - 252 + 540) % 360) - 180;
            nh = (thsl.h + dh * (style.secHueShift ? 0.55 : 0.35) + (style.secHueShift || 0) * l * 0.25 + 360) % 360;
            ns = Math.max(0, Math.min(1, s * (style.priSatScale || 1) * intF * 1.2));
            nl = Math.max(0.04, Math.min(0.95, l + (brF - 0.3) * 0.14 * (1 - Math.abs(2 * l - 1))));
          }
          const [tr, tg, tb] = hslToRgbArr(nh, ns, nl);
          dst[i]     = Math.round(tr * (1 - heartKeep) + likedBasePixels[i] * heartKeep);
          dst[i + 1] = Math.round(tg * (1 - heartKeep) + likedBasePixels[i + 1] * heartKeep);
          dst[i + 2] = Math.round(tb * (1 - heartKeep) + likedBasePixels[i + 2] * heartKeep);
          dst[i + 3] = a;
        }
        ctx.putImageData(out, 0, 0);
        document.documentElement.style.setProperty('--liked-cover-img', `url("${likedCanvas.toDataURL('image/png')}")`);
        const heroHex = isMono
          ? hslToHex(0, 0, Math.round(25 + monoF * 35))
          : hslToHex(thsl.h, Math.min(100, Math.round(65 * intF * (style.priSatScale || 1))), mode === 'light' ? 52 : 42);
        document.documentElement.style.setProperty('--liked-hero-accent', heroHex);
      };

      if (likedBasePixels) {
        applyPixels();
      } else if (!likedBaseImg) {
        likedBaseImg = new Image();
        likedBaseImg.crossOrigin = 'Anonymous';
        likedBaseImg.onload = () => {
          likedCanvas = document.createElement('canvas');
          likedCanvas.width = 200;
          likedCanvas.height = 200;
          const ctx = likedCanvas.getContext('2d');
          ctx.drawImage(likedBaseImg, 0, 0, 200, 200);
          likedBasePixels = new Uint8ClampedArray(ctx.getImageData(0, 0, 200, 200).data);
          applyPixels();
        };
        likedBaseImg.src = '../../assets/liked.png';
      }
    };
    refreshLikedCoverTint();
    new MutationObserver(refreshLikedCoverTint).observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });



window.generateM3Palette = generateM3Palette;
window.analyzeCover = analyzeCover;
window.applyTheme = applyTheme;
window.updateThemeFromState = updateThemeFromState;
window.updateActiveCoverBg = updateActiveCoverBg;
window.setCoverBg = setCoverBg;
window.refreshCachedThemeColors = refreshCachedThemeColors;

