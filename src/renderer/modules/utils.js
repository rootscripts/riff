
'use strict';

var REVERSE_TO_EN = window.REVERSE_TO_EN || {};
window.REVERSE_TO_EN = REVERSE_TO_EN;


window.addEventListener('error', (e) => {
  const img = e.target;
  if (!img || img.tagName !== 'IMG') return;
  img.classList.add('img-broken');
  img.removeAttribute('src');
  img.style.display = 'none';
  const parent = img.parentElement;
  if (parent && (parent.classList.contains('sp-card-cover') || parent.classList.contains('sb-lib-cover') || parent.classList.contains('search-album-cover-box') || parent.classList.contains('np-queue-art')) && !parent.querySelector('.riff-img-fallback')) {
    const fb = document.createElement('span');
    fb.className = 'riff-img-fallback';
    fb.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
    parent.appendChild(fb);
  }
}, true);

try {
  const origImgSrc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  if (origImgSrc && origImgSrc.set) {
    Object.defineProperty(HTMLImageElement.prototype, 'src', {
      get: origImgSrc.get,
      set(val) {
        if (!this.decoding) this.decoding = 'async';
        if (val && val !== 'null' && val !== 'undefined') {
          this.classList.remove('img-broken');
          if (this.style.display === 'none') this.style.display = '';
          const fb = this.parentElement?.querySelector?.('.riff-img-fallback');
          if (fb) fb.remove();
        }
        return origImgSrc.set.call(this, val);
      },
      configurable: true,
      enumerable: true
    });
  }
} catch (_) {}



var flushAsync = window.flushAsync || function() {};
var flushSync = window.flushSync || function() {};


(() => {
  try {
    if (typeof window === 'undefined' || window.__riffFetchPatched) return;
    const api = window.electronAPI;
    const token = api && api.serverToken;
    if (!token) return;
    const origFetch = window.fetch ? window.fetch.bind(window) : null;
    if (!origFetch) return;
    window.__riffFetchPatched = true;
    window.fetch = function (input, init) {
      try {
        const raw = typeof input === 'string' ? input : (input && input.url) || '';
        if (raw.indexOf('/api/') !== -1) {
          const opts = Object.assign({}, init || {});
          const headers = new Headers(opts.headers || (input && input.headers) || undefined);
          headers.set('X-Riff-Token', token);
          opts.headers = headers;
          return origFetch(input, opts);
        }
      } catch (e) {}
      return origFetch(input, init);
    };
  } catch (e) {}
})();


var EXCLUDED_PERSONAL_KEYS = new Set([
  'devsize_favorites', 'devsize_history', 'devsize_playlists',
  'riff_local_tracks', 'riff_local_files', 'devsize_local_tracks', 'devsize_local_files',
  'riff_saved_albums', 'riff_search_history_v2', 'riff_favorite_artists',
  'riff_unfollowed_artists', 'riff_artist_meta_cache', 'riff_daily_mixes',
  'riff_my_wave_cache', 'riff_trending_cache', 'riff_wave_skips',
  'riff_failed_tracks', 'riff_mix_feedback', 'riff_pinned_tracks',
  'riff_sidebar_pinned_tracks', 'riff_pinned_playlists', 'riff_user_nickname',
  'riff_user_avatar', 'riff_lastfm_sk', 'riff_lastfm_user',
  'riff_spotify_client_id', 'riff_owner_profile_backup',
  'devsize_custom_presets', 'riff_track_trims', 'riff_queue_state',
  'riff_track_art', 'riff_welcome_bg', 'riff_track_renames',
  'riff_last_playback_state', 'riff_sidebar_library_tracks',
  'riff_blocked_tracks', 'riff_top_moments', 'riff_blocked_audio_sources',
  'riff_lottie_lib_cache'
]);

function getDefaultsJsonSync() {
  const paths = ['./defaults.json', 'defaults.json', '../../src/renderer/defaults.json'];
  for (const p of paths) {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', p, false);
      xhr.send(null);
      if ((xhr.status === 200 || xhr.status === 0) && xhr.responseText && xhr.responseText.trim().startsWith('{')) {
        return JSON.parse(xhr.responseText);
      }
    } catch (_) {}
  }
  return null;
}

try {
  if (localStorage.getItem('riff_user_initialized_v1') !== '1') {
    const defs = getDefaultsJsonSync();
    if (defs && typeof defs === 'object') {
      for (const [k, v] of Object.entries(defs)) {
        if (EXCLUDED_PERSONAL_KEYS.has(k)) continue;
        if (localStorage.getItem(k) === null) {
          localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
        }
      }
    }
    localStorage.setItem('riff_user_initialized_v1', '1');
  }
} catch (_) {}


localStorage.setItem('riff_wavy_progress', 'false');
localStorage.setItem('riff_progress_knob', 'false');
document.body.classList.add('no-wavy');
document.body.classList.add('no-knob');

(() => {
  let lastErrLogReset = Date.now();
  let errLogCount = 0;
  function reportError(level, message, stack) {
    if (!window.electronAPI || typeof window.electronAPI.logError !== 'function') return;
    const now = Date.now();
    if (now - lastErrLogReset > 60000) {
      lastErrLogReset = now;
      errLogCount = 0;
    }
    if (errLogCount < 20) {
      errLogCount++;
      window.electronAPI.logError(level, message, stack);
    }
  }
  window.__riffLogError = reportError;
  window.addEventListener('error', (e) => {
    const msg = e.message || '';
    if (!msg || /ResizeObserver loop|\[object ErrorEvent\]/i.test(msg)) return;
    reportError('ERROR', msg, e.error ? e.error.stack : null);
  });
  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason;
    const msg = (reason && reason.message) ? reason.message : String(reason);
    const stack = (reason && reason.stack) ? reason.stack : null;
    reportError('ERROR', msg, stack);
  });
})();


function runRiffSplash() {
  window.__riffSplashDone = true;
  const splash = document.getElementById('splash');
  if (splash) splash.remove();
}
runRiffSplash();


function stripYoutubeTopic(artist) {
  if (!artist || typeof artist !== 'string') return artist || '';
  return artist.endsWith(' - Topic') ? artist.slice(0, -8).trim() : artist;
}

const MUSICAL_BRACKET_TAG_RE_CLIENT = /^(?:(?:feat\.?|ft\.?|featuring|prod\.?|produced\s+by|with|w\/|vs\.?)\b.*|(?:[\w\s.&'-]+\s+)?(?:remix|mix|edit|version|ver\.?|vip|dub|bootleg|mashup|rework|flip|refix)|live(?:\s+at\b.*|\s+from\b.*|\s+\d{4})?|acoustic|unplugged|demo|piano|guitar|orchestral|instrumental|karaoke|a\s*cappella|acapella|slowed(?:\s*\+?\s*reverb)?|reverb|sped\s+up|speed\s+up|nightcore|daycore|bass\s+boosted|8d|remaster(?:ed)?(?:\s+\d{4})?|deluxe|bonus(?:\s+track)?|extended|radio|club|original|short|full|explicit|clean|censored|uncensored|mono|stereo|ost\b.*|soundtrack|theme|(?:part|pt\.?|vol\.?|ch\.?|chapter|act|ep\.?)\s*[\d\w]+|v\d+(?:\.\d+)?|\d{4})$/i;

function stripBracketTranslation(title) {
  if (!title || typeof title !== 'string') return title || '';
  const baseWithoutBrackets = title.replace(/\s*\([^()]*\)/g, '').replace(/\s*\[[^\[\]]*\]/g, '').trim();
  if (!baseWithoutBrackets) return title.trim();
  const hasCyrillicBase = /[а-яёіїєґ]/i.test(baseWithoutBrackets);
  const hasNonLatinBase = hasCyrillicBase || /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/.test(baseWithoutBrackets);
  if (!hasNonLatinBase) return title.trim();

  const cyrSelfTags = {
    'интро': 'intro',
    'аутро': 'outro',
    'интерлюдия': 'interlude',
    'скит': 'skit',
    'фристайл': 'freestyle',
    'сниппет': 'snippet'
  };
  const normBaseLower = baseWithoutBrackets.toLowerCase().replace(/ё/g, 'е').trim();

  const filterBracket = (match, inner) => {
    const cleanInner = String(inner || '').trim();
    if (!cleanInner) return match;
    const hasLatin = /[a-zA-Z]/.test(cleanInner);
    const hasCyr = /[а-яёіїєґ]/i.test(cleanInner);
    if (!hasLatin || hasCyr) return match;
    const lowerInner = cleanInner.toLowerCase();
    if (cyrSelfTags[normBaseLower] === lowerInner) return '';
    if (/^(?:intro|outro|interlude|skit|freestyle|snippet)$/i.test(cleanInner)) return match;
    if (MUSICAL_BRACKET_TAG_RE_CLIENT.test(cleanInner)) return match;
    if (/\b(?:feat\.?|ft\.?|featuring|prod\.?|remix|slowed|reverb|sped\s+up|nightcore|live|version|edit|ost)\b/i.test(cleanInner)) return match;
    return '';
  };

  return title
    .replace(/\s*\(([^()]+)\)/g, filterBracket)
    .replace(/\s*\[([^\[\]]+)\]/g, filterBracket)
    .replace(/\s{2,}/g, ' ')
    .trim();
}
window.stripBracketTranslation = stripBracketTranslation;

const OWNER_BADGE_HASHES = new Set([
  '096c894ac90ec8e31159c04b9477c70e06590563d05f39c754d283e047b79a4e',
  '096c894ac908c1f1115acb409c7ec509015b0c6bdb5233d546d88eeb4fbe9849',
  '096c894ad808dce01157c24a9778c60c04580a60c05b23c457c887f044b89b4c',
  '096c894ad908ddf6115bc546927ccd0800530e65cd5c2ed241c580fd41bc9048',
  '096c894ad00ec0e2115fca409d7cc20e065c0e6ac25537c655dc89f24ebc9f4e',
  '096c894ada17cbfd1156c7459679c7030b590b61cd4135d94ade9dfd45b99a43'
]);

const DONATOR_BADGE_HASHES = new Set([
  '0e668806cf0283e95318965f9477c1080755042fc205338f1cd8d9f20bb6964f',
  '0e668806cf0283f6480f815f9676c00b0454052dc212248b18cfcef209b7974c',
  '0e668806cf0283e25302975f927dc30e01570e29c204298417c2d8f20dbc9449',
  '0e668806cf0283f5501b805f907fc6020d520c2bc213309003dbcff20fbe9145',
  '0e668806cf0283e3551c965f937ecc0d02580d28c205378310dcd9f20cbf9b4a',
  '0e668806cf0283ed591c9c5f9d7bc70f00530826c20f378112dcd3f202ba9048'
]);

function computePromoSha256(input) {
  const s = String(input || '').trim().toLowerCase();
  if (s.length !== 16) return '';
  const MA = [0x6a, 0x09, 0xe6, 0x67, 0xbb, 0x67, 0xae, 0x85, 0x3c, 0x6e, 0xf3, 0x72, 0xa5, 0x4f, 0xf5, 0x3a];
  const MB = [0x51, 0x0e, 0x52, 0x7f, 0x9b, 0x05, 0x68, 0x8c, 0x1f, 0x83, 0xd9, 0xab, 0x5b, 0xe0, 0xcd, 0x19];
  const B = [];
  for (let i = 0; i < 16; i++) B.push(s.charCodeAt(i) & 0xff);
  let out = '';
  for (let i = 0; i < 16; i++) out += (B[i] ^ MA[i]).toString(16).padStart(2, '0');
  for (let i = 0; i < 16; i++) out += (B[15 - i] ^ B[i] ^ MB[i]).toString(16).padStart(2, '0');
  return out;
}

function getAccountBadges() {
  const stored = safeJson('riff_account_badges', {});
  return {
    isOwner: Boolean(stored?.isOwner || localStorage.getItem('isOwner') === 'true'),
    isDonator: Boolean(stored?.isDonator || localStorage.getItem('isDonator') === 'true')
  };
}

function setAccountBadge(type, value = true) {
  const cur = getAccountBadges();
  if (type === 'owner') {
    cur.isOwner = Boolean(value);
    localStorage.setItem('isOwner', cur.isOwner ? 'true' : 'false');
  } else if (type === 'donator') {
    cur.isDonator = Boolean(value);
    localStorage.setItem('isDonator', cur.isDonator ? 'true' : 'false');
  }
  localStorage.setItem('riff_account_badges', JSON.stringify(cur));
}

function verifyAndApplyPromocode(rawCode) {
  const digest = computePromoSha256(rawCode);
  if (!digest) return null;
  if (OWNER_BADGE_HASHES.has(digest)) {
    setAccountBadge('owner', true);
    return 'owner';
  }
  if (DONATOR_BADGE_HASHES.has(digest)) {
    setAccountBadge('donator', true);
    return 'donator';
  }
  return null;
}

window.computePromoSha256 = computePromoSha256;
window.getAccountBadges = getAccountBadges;
window.setAccountBadge = setAccountBadge;
window.verifyAndApplyPromocode = verifyAndApplyPromocode;


  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function cleanTrackId(id) {
    return String(id || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  }
  window.cleanTrackId = cleanTrackId;
  window.CleanTrackId = cleanTrackId;

  function isStaticTikTokTrack(t) {
    return Boolean(t && (t.isTikTok || t.staticAudio || t.platform === 'tiktok' || String(t.id || '').startsWith('tt_') || String(t.url || '').includes('/api/local-track?id=tt_')));
  }
  window.isStaticTikTokTrack = isStaticTikTokTrack;

  function repairTikTokTrack(t) {
    if (!t) return false;
    const rawUrl = String(t.url || '');
    const rawPre = String(t._preloadedStreamUrl || '');
    const targetUrl = rawUrl.includes('id=tt_') ? rawUrl : (rawPre.includes('id=tt_') ? rawPre : '');
    if (targetUrl) {
      const m = targetUrl.match(/[?&]id=(tt_[^&]+)/);
      if (m && m[1]) {
        const restoredId = decodeURIComponent(m[1]);
        let changed = false;
        if (t.id !== restoredId) {
          t.id = restoredId;
          changed = true;
        }
        if (!t.isTikTok) { t.isTikTok = true; changed = true; }
        if (!t.staticAudio) { t.staticAudio = true; changed = true; }
        if (t.platform !== 'tiktok') { t.platform = 'tiktok'; changed = true; }
        if (!t.isCached) { t.isCached = true; changed = true; }
        const port = (window.state && window.state.serverPort) || (typeof state !== 'undefined' && state.serverPort) || '';
        const localUrl = `http://127.0.0.1:${port}/api/local-track?id=${encodeURIComponent(cleanTrackId(restoredId))}`;
        if (port && t.url !== localUrl) {
          t.url = localUrl;
          changed = true;
        }
        return changed;
      }
    } else if (isStaticTikTokTrack(t)) {
      let changed = false;
      if (!t.isTikTok) { t.isTikTok = true; changed = true; }
      if (!t.staticAudio) { t.staticAudio = true; changed = true; }
      if (t.platform !== 'tiktok') { t.platform = 'tiktok'; changed = true; }
      if (!t.isCached) { t.isCached = true; changed = true; }
      return changed;
    }
    return false;
  }
  window.repairTikTokTrack = repairTikTokTrack;


  var i18nSessionMap = new Map();

  var i18nPending = new Set();
  var i18nFailed = new Set();
  var i18nQueue = new Map();
  var i18nTimer = null;
  function i18nFlush() {
    i18nTimer = null;
    const queued = i18nQueue;
    i18nQueue = new Map();
    for (const [lang, set] of queued) {
      const texts = [...set];
      const finish = (ok, translations) => {
        if (!i18nSessionMap.has(lang)) i18nSessionMap.set(lang, new Map());
        texts.forEach((s, i) => {
          const key = lang + '\u0000' + s;
          i18nPending.delete(key);
          const tr = ok && translations && translations[i];
          if (tr && tr !== s) i18nSessionMap.get(lang).set(s, tr);
          else i18nFailed.add(key);  
        });
      };
      fetch(`http://127.0.0.1:${state.serverPort}/api/i18n-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: lang, texts }),
        signal: AbortSignal.timeout(15000)
      }).then(r => r.json())
        .then(data => finish(!!(data && data.success), data && data.translations))
        .catch(() => finish(false, null));
    }
  }

  function t(str) {
    if (!str || typeof str !== 'string') return str;
    if (str === 'Plays') return '▶';
    const lang = localStorage.getItem('riff_ui_lang') || 'en';
    if (lang === 'en') return str;
    if (typeof BUILTIN_UI_DICT !== 'undefined' && BUILTIN_UI_DICT[lang] && BUILTIN_UI_DICT[lang][str]) {
      return BUILTIN_UI_DICT[lang][str];
    }
    return str;
  }
  window.t = t;

  function tSet(el, str) {
    if (!el) return;
    el.textContent = t(str);
    const lang = localStorage.getItem('riff_ui_lang') || 'en';
    if (lang === 'en') return;
    const dict = i18nSessionMap.get(lang);
    if (dict && dict.has(str)) return;
    setTimeout(() => {
      const d = i18nSessionMap.get(lang);
      if (d && d.has(str) && el.isConnected) el.textContent = d.get(str);
    }, 1500);
  }


  var activeToastGroup = null;
  var activeToastRows = [];
  var MAX_TOAST_ROWS = 4;

  function showToast(message, type = 'info', duration = null) {
    if (!message) return;
    if (typeof message === 'string') {
      const lower = message.toLowerCase();
      if (lower.includes('extract audio stream') || lower.includes('load audio stream') || lower.includes('locate track audio stream') || lower.includes('failed to extract')) {
        message = "Track can't be loaded";
      }
    }
    message = t(message);

    const container = document.getElementById('toast-container');
    if (!container) return;

    const cleanMessage = String(message).charAt(0).toUpperCase() + String(message).slice(1);
    const rowLifetime = duration !== null && !isNaN(Number(duration))
      ? Number(duration)
      : (type === 'error' ? 4000 : 2600);

                                                                     
    const existing = activeToastRows.find(r => r.cleanMessage === cleanMessage && r.type === type);
    if (existing) {
      existing.count++;
      let badge = existing.el.querySelector('.toast-badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'toast-badge';
        existing.el.appendChild(badge);
      }
      badge.textContent = `x${existing.count}`;
      badge.classList.remove('badge-pop');
      void badge.offsetWidth;
      badge.classList.add('badge-pop');

      if (existing.timer) clearTimeout(existing.timer);
      existing.timer = setTimeout(() => removeToastRow(existing), rowLifetime);
      return;
    }

                                    
    if (!activeToastGroup || !activeToastGroup.isConnected || activeToastGroup.classList.contains('leaving')) {
      activeToastGroup = document.createElement('div');
      activeToastGroup.className = 'riff-toast';
      container.appendChild(activeToastGroup);
    }

                                                                    
    if (activeToastRows.length >= MAX_TOAST_ROWS) {
      const oldest = activeToastRows[0];
      removeToastRow(oldest, true);
    }

    let iconSvg = '';
    if (type === 'error') {
      iconSvg = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ff5449" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    } else if (type === 'success') {
      iconSvg = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 12.5 10 17.5 19 7.5"/></svg>';
    } else if (type === 'warning') {
      iconSvg = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
    } else {
      iconSvg = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
    }

    const rowEl = document.createElement('div');
    rowEl.className = `toast-row ${type}`;
    rowEl.innerHTML = `
      ${iconSvg ? `<span class="toast-icon">${iconSvg}</span>` : ''}
      <span class="toast-text">${escapeHtml(cleanMessage)}</span>
    `;

    const rowObj = {
      el: rowEl,
      cleanMessage,
      type,
      count: 1,
      timer: null
    };

    rowEl.addEventListener('click', (e) => {
      e.stopPropagation();
      removeToastRow(rowObj);
    });

    activeToastRows.push(rowObj);
    activeToastGroup.appendChild(rowEl);

    rowObj.timer = setTimeout(() => {
      removeToastRow(rowObj);
    }, rowLifetime);
  }

  function removeToastRow(rowObj, immediate = false) {
    if (rowObj.timer) {
      clearTimeout(rowObj.timer);
      rowObj.timer = null;
    }
    const idx = activeToastRows.indexOf(rowObj);
    if (idx !== -1) {
      activeToastRows.splice(idx, 1);
    }

    const isLast = activeToastRows.length === 0;
    if (isLast && activeToastGroup) {
      const groupToDismiss = activeToastGroup;
      activeToastGroup = null;
      if (immediate) {
        groupToDismiss.remove();
      } else {
        groupToDismiss.classList.add('leaving');
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          groupToDismiss.remove();
        };
        groupToDismiss.addEventListener('animationend', finish, { once: true });
        setTimeout(finish, 220);
      }
      return;
    }

    if (immediate) {
      rowObj.el.remove();
    } else {
      rowObj.el.classList.add('row-leaving');
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        rowObj.el.remove();
      };
      rowObj.el.addEventListener('animationend', finish, { once: true });
      setTimeout(finish, 240);
    }
  }

  if (localStorage.getItem('riff_scale_rebased_v2') !== '1') {
    localStorage.setItem('riff_scale_rebased_v2', '1');
    if (localStorage.getItem('devsize_ui_scale') === '90') {
      localStorage.removeItem('devsize_ui_scale');
    }
    if (localStorage.getItem('riff_font_scale') === '95') {
      localStorage.removeItem('riff_font_scale');
    }
  }

  if (localStorage.getItem('riff_defaults_v44_applied') !== '1') {
    localStorage.setItem('riff_defaults_v44_applied', '1');
    if (!localStorage.getItem('riff_platform') || localStorage.getItem('riff_platform') === 'youtube') {
      localStorage.setItem('riff_platform', 'ytmusic');
    }
    if (!localStorage.getItem('riff_ui_alpha') || localStorage.getItem('riff_ui_alpha') === '20') {
      localStorage.setItem('riff_ui_alpha', '100');
    }
    if (localStorage.getItem('riff_adv_cover_bg') === null) {
      localStorage.setItem('riff_adv_cover_bg', 'false');
    }
    if (localStorage.getItem('riff_adv_track_banners') === null) {
      localStorage.setItem('riff_adv_track_banners', 'false');
    }
    if (localStorage.getItem('riff_bar_wave') === null) {
      localStorage.setItem('riff_bar_wave', '0');
    }
    if (!localStorage.getItem('riff_theme_accent') || localStorage.getItem('riff_theme_accent') === '#6750A4') {
      localStorage.setItem('riff_theme_accent', '#1DB954');
      if (!localStorage.getItem('riff_theme_intensity') || localStorage.getItem('riff_theme_intensity') === '0') {
        localStorage.setItem('riff_theme_intensity', '85');
      }
      if (!localStorage.getItem('riff_theme_brightness') || localStorage.getItem('riff_theme_brightness') === '0') {
        localStorage.setItem('riff_theme_brightness', '50');
      }
    }
    if (!localStorage.getItem('devsize_ui_scale') || localStorage.getItem('devsize_ui_scale') === '100') {
      localStorage.setItem('devsize_ui_scale', '105');
    }
  }

  if (localStorage.getItem('riff_defaults_v44_hue246') !== '1') {
    localStorage.setItem('riff_defaults_v44_hue246', '1');
    localStorage.setItem('riff_theme_accent', '#5247d1');
    localStorage.setItem('riff_theme_brightness', '20');
    localStorage.setItem('riff_theme_intensity', '85');
  }

  if (localStorage.getItem('riff_np_banners_off_v2') !== '1') {
    localStorage.setItem('riff_np_banners_off_v2', '1');
    localStorage.setItem('riff_adv_track_banners', 'false');
  }


  function openModal(elModal) {
    if (!elModal) return;
    if (elModal._closeTimer) { clearTimeout(elModal._closeTimer); elModal._closeTimer = null; }
    elModal.classList.remove('hidden');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        elModal.classList.add('visible');
      });
    });
    if (elModal.id === 'audio-settings-modal' || elModal.id === 'audio-editor' || elModal.classList.contains('audio-settings-modal')) {
      if (typeof syncAudioEditorObserverState === 'function') syncAudioEditorObserverState();
    }
  }

  var closingSyncModal = false;
  function closeModal(elModal) {
    if (!elModal) return;
    if (elModal.id === 'tools-install-modal' && (!state || !state.toolsReady)) return;
    if (typeof el !== 'undefined' && el && elModal === el.syncModeOverlay) {
      if (!closingSyncModal && syncState && syncState.active) {
        closingSyncModal = true;
        try {
          closeSyncMode();
        } finally {
          closingSyncModal = false;
        }
      }
    }
    elModal.classList.remove('visible');
    if (elModal._closeTimer) clearTimeout(elModal._closeTimer);
    elModal._closeTimer = setTimeout(() => {
      elModal._closeTimer = null;
      elModal.classList.add('hidden');
      if (elModal.id === 'audio-settings-modal' || elModal.id === 'audio-editor' || elModal.classList.contains('audio-settings-modal')) {
        if (typeof syncAudioEditorObserverState === 'function') syncAudioEditorObserverState();
      }
    }, 200);
    if (elModal.id === 'audio-settings-modal' || elModal.id === 'audio-editor' || elModal.classList.contains('audio-settings-modal')) {
      if (typeof syncAudioEditorObserverState === 'function') syncAudioEditorObserverState();
    }
  }


  var TRANSLATION_LANGUAGES = [
    { code: 'af', name: 'Afrikaans', flag: '🇿🇦' },
    { code: 'sq', name: 'Albanian', flag: '🇦🇱' },
    { code: 'am', name: 'Amharic', flag: '🇪🇹' },
    { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
    { code: 'hy', name: 'Armenian', flag: '🇦🇲' },
    { code: 'as', name: 'Assamese', flag: '🇮🇳' },
    { code: 'ay', name: 'Aymara', flag: '🇧🇴' },
    { code: 'az', name: 'Azerbaijani', flag: '🇦🇿' },
    { code: 'bm', name: 'Bambara', flag: '🇲🇱' },
    { code: 'eu', name: 'Basque', flag: '🇪🇸' },
    { code: 'be', name: 'Belarusian', flag: '🇧🇾' },
    { code: 'bn', name: 'Bengali', flag: '🇧🇩' },
    { code: 'bho', name: 'Bhojpuri', flag: '🇮🇳' },
    { code: 'bs', name: 'Bosnian', flag: '🇧🇦' },
    { code: 'bg', name: 'Bulgarian', flag: '🇧🇬' },
    { code: 'ca', name: 'Catalan', flag: '🇪🇸' },
    { code: 'ceb', name: 'Cebuano', flag: '🇵🇭' },
    { code: 'ny', name: 'Chichewa', flag: '🇲🇼' },
    { code: 'zh-CN', name: 'Chinese (Simplified)', flag: '🇨🇳' },
    { code: 'zh-TW', name: 'Chinese (Traditional)', flag: '🇹🇼' },
    { code: 'co', name: 'Corsican', flag: '🇫🇷' },
    { code: 'hr', name: 'Croatian', flag: '🇭🇷' },
    { code: 'cs', name: 'Czech', flag: '🇨🇿' },
    { code: 'da', name: 'Danish', flag: '🇩🇰' },
    { code: 'dv', name: 'Dhivehi', flag: '🇲🇻' },
    { code: 'doi', name: 'Dogri', flag: '🇮🇳' },
    { code: 'nl', name: 'Dutch', flag: '🇳🇱' },
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'eo', name: 'Esperanto', flag: '🌐' },
    { code: 'et', name: 'Estonian', flag: '🇪🇪' },
    { code: 'ee', name: 'Ewe', flag: '🇬🇭' },
    { code: 'tl', name: 'Filipino', flag: '🇵🇭' },
    { code: 'fi', name: 'Finnish', flag: '🇫🇮' },
    { code: 'fr', name: 'French', flag: '🇫🇷' },
    { code: 'fy', name: 'Frisian', flag: '🇳🇱' },
    { code: 'gl', name: 'Galician', flag: '🇪🇸' },
    { code: 'ka', name: 'Georgian', flag: '🇬🇪' },
    { code: 'de', name: 'German', flag: '🇩🇪' },
    { code: 'el', name: 'Greek', flag: '🇬🇷' },
    { code: 'gn', name: 'Guarani', flag: '🇵🇾' },
    { code: 'gu', name: 'Gujarati', flag: '🇮🇳' },
    { code: 'ht', name: 'Haitian Creole', flag: '🇭🇹' },
    { code: 'ha', name: 'Hausa', flag: '🇳🇬' },
    { code: 'haw', name: 'Hawaiian', flag: '🇺🇸' },
    { code: 'he', name: 'Hebrew', flag: '🇮🇱' },
    { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
    { code: 'hmn', name: 'Hmong', flag: '🇱🇦' },
    { code: 'hu', name: 'Hungarian', flag: '🇭🇺' },
    { code: 'is', name: 'Icelandic', flag: '🇮🇸' },
    { code: 'ig', name: 'Igbo', flag: '🇳🇬' },
    { code: 'ilo', name: 'Ilocano', flag: '🇵🇭' },
    { code: 'id', name: 'Indonesian', flag: '🇮🇩' },
    { code: 'ga', name: 'Irish', flag: '🇮🇪' },
    { code: 'it', name: 'Italian', flag: '🇮🇹' },
    { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
    { code: 'jw', name: 'Javanese', flag: '🇮🇩' },
    { code: 'kn', name: 'Kannada', flag: '🇮🇳' },
    { code: 'kk', name: 'Kazakh', flag: '🇰🇿' },
    { code: 'km', name: 'Khmer', flag: '🇰🇭' },
    { code: 'rw', name: 'Kinyarwanda', flag: '🇷🇼' },
    { code: 'gom', name: 'Konkani', flag: '🇮🇳' },
    { code: 'ko', name: 'Korean', flag: '🇰🇷' },
    { code: 'kri', name: 'Krio', flag: '🇸🇱' },
    { code: 'ku', name: 'Kurdish (Kurmanji)', flag: '🇹🇷' },
    { code: 'ckb', name: 'Kurdish (Sorani)', flag: '🇮🇶' },
    { code: 'ky', name: 'Kyrgyz', flag: '🇰🇬' },
    { code: 'lo', name: 'Lao', flag: '🇱🇦' },
    { code: 'la', name: 'Latin', flag: '🏛️' },
    { code: 'lv', name: 'Latvian', flag: '🇱🇻' },
    { code: 'ln', name: 'Lingala', flag: '🇨🇩' },
    { code: 'lt', name: 'Lithuanian', flag: '🇱🇹' },
    { code: 'lg', name: 'Luganda', flag: '🇺🇬' },
    { code: 'lb', name: 'Luxembourgish', flag: '🇱🇺' },
    { code: 'mk', name: 'Macedonian', flag: '🇲🇰' },
    { code: 'mai', name: 'Maithili', flag: '🇮🇳' },
    { code: 'mg', name: 'Malagasy', flag: '🇲🇬' },
    { code: 'ms', name: 'Malay', flag: '🇲🇾' },
    { code: 'ml', name: 'Malayalam', flag: '🇮🇳' },
    { code: 'mt', name: 'Maltese', flag: '🇲🇹' },
    { code: 'mi', name: 'Maori', flag: '🇳🇿' },
    { code: 'mr', name: 'Marathi', flag: '🇮🇳' },
    { code: 'mni-Mtei', name: 'Meiteilon (Manipuri)', flag: '🇮🇳' },
    { code: 'lus', name: 'Mizo', flag: '🇮🇳' },
    { code: 'mn', name: 'Mongolian', flag: '🇲🇳' },
    { code: 'my', name: 'Myanmar (Burmese)', flag: '🇲🇲' },
    { code: 'ne', name: 'Nepali', flag: '🇳🇵' },
    { code: 'no', name: 'Norwegian', flag: '🇳🇴' },
    { code: 'or', name: 'Odia (Oriya)', flag: '🇮🇳' },
    { code: 'om', name: 'Oromo', flag: '🇪🇹' },
    { code: 'ps', name: 'Pashto', flag: '🇦🇫' },
    { code: 'fa', name: 'Persian (فارسی)', flag: '🇮🇷' },
    { code: 'pl', name: 'Polish', flag: '🇵🇱' },
    { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
    { code: 'pa', name: 'Punjabi', flag: '🇮🇳' },
    { code: 'qu', name: 'Quechua', flag: '🇵🇪' },
    { code: 'ro', name: 'Romanian', flag: '🇷🇴' },
    { code: 'ru', name: 'Русский', flag: '🇷🇺' },
    { code: 'sm', name: 'Samoan', flag: '🇼🇸' },
    { code: 'sa', name: 'Sanskrit', flag: '🇮🇳' },
    { code: 'gd', name: 'Scots Gaelic', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
    { code: 'sr', name: 'Serbian', flag: '🇷🇸' },
    { code: 'st', name: 'Sesotho', flag: '🇱🇸' },
    { code: 'sn', name: 'Shona', flag: '🇿🇼' },
    { code: 'sd', name: 'Sindhi', flag: '🇵🇰' },
    { code: 'si', name: 'Sinhala', flag: '🇱🇰' },
    { code: 'sk', name: 'Slovak', flag: '🇸🇰' },
    { code: 'sl', name: 'Slovenian', flag: '🇸🇮' },
    { code: 'so', name: 'Somali', flag: '🇸🇴' },
    { code: 'es', name: 'Spanish', flag: '🇪🇸' },
    { code: 'su', name: 'Sundanese', flag: '🇮🇩' },
    { code: 'sw', name: 'Swahili', flag: '🇰🇪' },
    { code: 'sv', name: 'Swedish', flag: '🇸🇪' },
    { code: 'tg', name: 'Tajik', flag: '🇹🇯' },
    { code: 'ta', name: 'Tamil', flag: '🇮🇳' },
    { code: 'tt', name: 'Tatar', flag: '🇷🇺' },
    { code: 'te', name: 'Telugu', flag: '🇮🇳' },
    { code: 'th', name: 'Thai', flag: '🇹🇭' },
    { code: 'ti', name: 'Tigrinya', flag: '🇪🇷' },
    { code: 'ts', name: 'Tsonga', flag: '🇿🇦' },
    { code: 'tr', name: 'Turkish', flag: '🇹🇷' },
    { code: 'tk', name: 'Turkmen', flag: '🇹🇲' },
    { code: 'ak', name: 'Twi (Akan)', flag: '🇬🇭' },
    { code: 'uk', name: 'Українська', flag: '🇺🇦' },
    { code: 'ur', name: 'Urdu', flag: '🇵🇰' },
    { code: 'ug', name: 'Uyghur', flag: '🇨🇳' },
    { code: 'uz', name: 'Uzbek', flag: '🇺🇿' },
    { code: 'vi', name: 'Vietnamese', flag: '🇻🇳' },
    { code: 'cy', name: 'Welsh', flag: '🏴󠁧󠁢󠁷󠁬󠁳󠁿' },
    { code: 'xh', name: 'Xhosa', flag: '🇿🇦' },
    { code: 'yi', name: 'Yiddish', flag: '🇮🇱' },
    { code: 'yo', name: 'Yoruba', flag: '🇳🇬' },
    { code: 'zu', name: 'Zulu', flag: '🇿🇦' }
  ];
  window.TRANSLATION_LANGUAGES = TRANSLATION_LANGUAGES;
  var UI_TRANSLATION_LANGUAGES = TRANSLATION_LANGUAGES;
  var UI_TRANSLATION_LANGUAGE_CODES = new Set(UI_TRANSLATION_LANGUAGES.map(language => language.code));

  function getSupportedUiLanguage(language) {
    if (!language) return 'en';
    const code = String(language).trim();
    return TRANSLATION_LANGUAGES.some(l => l.code === code) ? code : 'en';
  }

  function syncDocumentDirection(langCode) {
    const baseLang = String(langCode || 'en').toLowerCase().split(/[-_]/)[0];
    document.documentElement.setAttribute('dir', 'ltr');
    document.documentElement.setAttribute('lang', baseLang || 'en');
    document.body.classList.remove('rtl-ui');
  }

  function initHqSliders() {
    if (!state || !state.hqSettings) return;
    ['Vocal', 'Air', 'Bass'].forEach(type => {
      const slider = el && el[`sliderHq${type}`];
      if (slider) {
        slider.min = -50;
        slider.max = 50;
        slider.value = state.hqSettings[type.toLowerCase()] || 0;
      }
    });
    if (el && el.sliderScale && state.uiScale) el.sliderScale.value = state.uiScale;
    if (el && el.valScale && state.uiScale) el.valScale.textContent = `${state.uiScale}%`;
  }
  window.initHqSliders = initHqSliders;

  function dismissBootSkeleton() {
    const s = document.getElementById('boot-skeleton');
    if (!s || s.classList.contains('hide')) return;
    s.classList.add('hide');
    setTimeout(() => { try { s.remove(); } catch (_) {} }, 180);
  }
  window.dismissBootSkeleton = dismissBootSkeleton;

  function getReliableTrackDuration() {
    const audio = el && el.nativeAudio;
    if (typeof state !== 'undefined' && state && !state.audioDurationStale && audio && Number.isFinite(audio.duration) && audio.duration > 1) {
      return audio.duration;
    }
    const ct = (typeof state !== 'undefined' && state) ? state.currentTrack : null;
    const metaDur = (ct && Number.isFinite(ct.duration) && ct.duration > 0)
      ? ct.duration
      : ((ct && Number.isFinite(ct.durationMs) && ct.durationMs > 0)
          ? ct.durationMs / 1000
          : ((ct && Number.isFinite(ct.duration_ms) && ct.duration_ms > 0)
              ? ct.duration_ms / 1000
              : 0));
    return metaDur > 0 ? metaDur : 0;
  }
  window.getReliableTrackDuration = getReliableTrackDuration;


  function collectI18n() {
    const list = new Set();
    document.querySelectorAll(AUTO_I18N_SELECTORS).forEach(elNode => {
      if (isI18nFixed(elNode)) return;
      if (!elNode.dataset.i18nEn) {
        const raw = elNode.textContent.trim();
        const rev = (typeof REVERSE_TO_EN !== 'undefined' && REVERSE_TO_EN) ? REVERSE_TO_EN : {};
        elNode.dataset.i18nEn = rev[raw] || raw;
      }
      elNode.dataset.i18nOrig = elNode.dataset.i18nEn;
      if (elNode.dataset.i18nEn) list.add(elNode.dataset.i18nEn);
    });
    document.querySelectorAll('input[placeholder], textarea[placeholder]').forEach(input => {
      if (isI18nFixed(input)) return;
      if (!input.dataset.i18nEnPlaceholder) {
        const raw = input.placeholder.trim();
        const rev = (typeof REVERSE_TO_EN !== 'undefined' && REVERSE_TO_EN) ? REVERSE_TO_EN : {};
        input.dataset.i18nEnPlaceholder = rev[raw] || raw;
      }
      input.dataset.origPlaceholder = input.dataset.i18nEnPlaceholder;
      if (input.dataset.i18nEnPlaceholder) list.add(input.dataset.i18nEnPlaceholder);
    });
    return Array.from(list);
  }

  var i18nApplyVersion = 0;
  async function applyI18n(lang) {
    const applyVersion = ++i18nApplyVersion;
    lang = String(lang || localStorage.getItem('riff_ui_lang') || 'en').trim();
    syncDocumentDirection(lang);
    localStorage.setItem('riff_ui_lang', lang);

    const found = TRANSLATION_LANGUAGES.find(l => l.code === lang);
    const uiLangLabel = document.getElementById('ui-lang-label');
    if (uiLangLabel && found) {
      uiLangLabel.textContent = `${found.flag} ${found.name} (${found.code})`;
    }

    const texts = collectI18n();

    if (!state.currentTrack) {
      const noTrackStr = lang === 'ru' ? 'Ничего не играет' : (lang === 'uk' ? 'Нічого не грає' : 'No track playing');
      const selTrackStr = lang === 'ru' ? 'Выберите трек для прослушивания' : (lang === 'uk' ? 'Оберіть трек для прослуховування' : 'Select a track to listen');
      if (el.playbarTitle) el.playbarTitle.textContent = noTrackStr;
      if (el.playbarArtist) el.playbarArtist.textContent = selTrackStr;
      if (el.rightPanelTitle) {
        el.rightPanelTitle.innerHTML = '<span class="rp-title-inner">' + escapeHtml(noTrackStr) + '</span>';
        if (typeof updateRightPanelTitleMarquee === 'function') updateRightPanelTitleMarquee();
      }
      if (el.rightPanelArtist) el.rightPanelArtist.textContent = selTrackStr;
    }

    if (lang === 'en') {
      document.querySelectorAll(AUTO_I18N_SELECTORS).forEach(elNode => {
        if (isI18nFixed(elNode)) return;
        const enKey = elNode.dataset.i18nEn;
        if (enKey && elNode.textContent !== enKey) elNode.textContent = enKey;
      });
      document.querySelectorAll('input[placeholder], textarea[placeholder]').forEach(input => {
        if (isI18nFixed(input)) return;
        const enPh = input.dataset.i18nEnPlaceholder;
        if (enPh && input.placeholder !== enPh) input.placeholder = enPh;
      });
      document.querySelectorAll('#btn-toggle-playlist-search, #btn-toggle-favorites-search, #btn-toggle-local-search, #btn-edit-playlist-title, #favorites-sort-trigger, #playlist-sort-trigger').forEach(btn => {
        const enTitle = btn.dataset.i18nEnTitle;
        if (enTitle) {
          btn.setAttribute('title', enTitle);
          btn.setAttribute('aria-label', enTitle);
        }
      });
      return { ok: true };
    }

    if (!i18nSessionMap.has(lang)) i18nSessionMap.set(lang, new Map());
    const dict = i18nSessionMap.get(lang);
    const staticDict = BUILTIN_UI_DICT[lang] || {};
    for (const [k, v] of Object.entries(staticDict)) {
      dict.set(k, v);
    }

    try {
      const stored = JSON.parse(localStorage.getItem('riff_i18n_' + lang) || '{}');
      for (const [k, v] of Object.entries(stored)) {
        if (v && typeof v === 'string' && (lang === 'en' || v !== k) && !/https?:\/\/|linux\.do/i.test(v) && !dict.has(k)) {
          dict.set(k, v);
        }
      }
    } catch (_) {}

    const renderDictToDom = () => {
      document.querySelectorAll(AUTO_I18N_SELECTORS).forEach(elNode => {
        if (isI18nFixed(elNode)) return;
        const enKey = elNode.dataset.i18nEn;
        if (!enKey) return;
        const next = dict.get(enKey) || enKey;
        if (elNode.textContent !== next) elNode.textContent = next;
      });
      document.querySelectorAll('input[placeholder], textarea[placeholder]').forEach(input => {
        if (isI18nFixed(input)) return;
        const enPh = input.dataset.i18nEnPlaceholder;
        const next = dict.get(enPh) || enPh;
        if (input.placeholder !== next) input.placeholder = next;
      });
      document.querySelectorAll('#btn-toggle-playlist-search, #btn-toggle-favorites-search, #btn-toggle-local-search, #btn-edit-playlist-title, #favorites-sort-trigger, #playlist-sort-trigger').forEach(btn => {
        if (!btn.dataset.i18nEnTitle) {
          const raw = (btn.getAttribute('title') || '').trim();
          if (raw) btn.dataset.i18nEnTitle = REVERSE_TO_EN[raw] || raw;
        }
        if (btn.dataset.i18nEnTitle) {
          const next = dict.get(btn.dataset.i18nEnTitle) || btn.dataset.i18nEnTitle;
          btn.setAttribute('title', next);
          btn.setAttribute('aria-label', next);
        }
      });
      document.querySelectorAll('.sp-th-plays').forEach(elNode => {
        elNode.textContent = '▶';
        elNode.title = 'Plays';
        elNode.setAttribute('data-i18n-fixed', '');
      });
    };

    renderDictToDom();

    const missing = texts.filter(s => !dict.has(s));
    if (missing.length > 0) {
      try {
        const port = state.serverPort || 38472;
        const deeplKey = localStorage.getItem('riff_deepl_api_key') || '';
        const res = await fetch(`http://127.0.0.1:${port}/api/i18n-batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target: lang, texts: missing, apiKey: deeplKey })
        });
        const data = await res.json();
        if (applyVersion !== i18nApplyVersion) return;
        if (!data || !data.success || !Array.isArray(data.translations)) {
          throw new Error((data && data.error) || 'Translation failed');
        }
        missing.forEach((str, i) => {
          const tr = (data.translations[i] || '').trim();
          if (tr && tr !== str && !/https?:\/\/|linux\.do/i.test(tr)) {
            dict.set(str, tr);
          }
        });
        Object.entries(staticDict).forEach(([k, v]) => dict.set(k, v));
        const toPersist = {};
        for (const [k, v] of dict.entries()) toPersist[k] = v;
        try { localStorage.setItem('riff_i18n_' + lang, JSON.stringify(toPersist)); } catch (_) {}
        renderDictToDom();
      } catch (err) {
        if (dict.size === 0) {
          return { ok: false, error: err && err.message ? err.message : 'Translation failed' };
        }
      }
    }
    return { ok: dict.size > 0 };
  }
  window.collectI18n = collectI18n;
  window.applyI18n = applyI18n;
  window.BUILTIN_UI_DICT = BUILTIN_UI_DICT;
  function scheduleI18nApply() {}

  collectI18n();
  applyI18n(localStorage.getItem('riff_ui_lang') || 'en');

  var lyricsTranslationCache = new Map();


  function isLyricsExplicit(lyrics) {
    if (!lyrics || typeof lyrics !== 'string') return false;
    return /\b(fuck|fucking|fucked|fucker|fucks|shit|bitch|bitches|bitching|asshole|cunt|nigger|nigga|dick|pussy)\b|ху[йеяёюи]|пизд|залуп|муда[кч]|мудил|г[ао]ндон|дерьм|дроч|(?:^|[^а-яё])(?:бля[а-яё]*|сук[аиуео]|суч[екьяа][а-яё]*)|(?:^|[^а-яё])(?:[её]б[а-яё]+|[её]б\b|(?:вы|за|на|до|по|пере|про|разъ|раз|съ|въ|под|от|у)[её]б[а-яё]*)/i.test(lyrics);
  }
  window.isLyricsExplicit = isLyricsExplicit;

  function isTrackExplicit(track) {
    if (!track) return false;
    const canId = (typeof getTrackCanonicalId === 'function' ? getTrackCanonicalId(track) : '') || track.id;
    if (canId && explicitTrackCache.has(canId)) return true;
    if (track.isExplicit === true || track.explicit === true || track.explicit_lyrics === true || track.explicit_content_lyrics === 1) {
      if (canId) explicitTrackCache.add(canId);
      return true;
    }
    if (Array.isArray(track.badges) && track.badges.some(b => /explicit|18\+/i.test(b?.label || b?.name || b?.iconType || ''))) {
      if (canId) explicitTrackCache.add(canId);
      return true;
    }
    const text = `${track.title || ''} ${track.album || ''} ${track.searchQuery || ''} ${track.subtitle || ''}`;
    if (/\bexplicit\b|\[e\]|\(e\)|\[explicit\]|\(explicit\)|\b18\+\b|\[18\+\]|\(18\+\)|\b\+18\b|\[\+18\]|\(\+18\)|\buncensored\b|\[uncensored\]|\(uncensored\)|\bdirty\b|\[dirty\]|\(dirty\)|без\s+цензуры|нецензурн|\bмат\b|ху[йеяёю]|пизд|еба[тлнщ]|ёб[а-я]|бля[дт]/i.test(text)) {
      if (canId) explicitTrackCache.add(canId);
      return true;
    }
    return false;
  }
  window.isTrackExplicit = isTrackExplicit;

  var isShareInProgress = false;

  function showShareSpinnerToast() {
    document.querySelectorAll('.riff-share-spinner-toast').forEach(t => t.remove());
    const container = document.getElementById('toast-container');
    if (!container) return () => {};
    const toast = document.createElement('div');
    toast.className = 'riff-toast info riff-share-spinner-toast';
    toast.innerHTML = '<span class="riff-dots-loader" aria-hidden="true"><i></i><i></i><i></i></span>';
    container.appendChild(toast);
    return () => {
      toast.classList.add('leaving');
      setTimeout(() => { if (toast.parentNode) toast.remove(); }, 180);
    };
  }
  async function resolveFullTrackStreamForShare(track) {
    if (!track) return '';
    const port = state.serverPort || 38472;
    try {
      const streamInfoUrl = `http://127.0.0.1:${port}/api/stream-info?url=${encodeURIComponent(track.url || '')}&id=${encodeURIComponent(track.id || '')}&platform=${encodeURIComponent(track.platform || state.platform || 'youtube')}&title=${encodeURIComponent(track.title || '')}&artist=${encodeURIComponent(track.artist || '')}&duration=${encodeURIComponent(track.duration || 0)}&forShare=1`;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 4500);
      const response = await fetch(streamInfoUrl, { signal: ctrl.signal });
      clearTimeout(timer);
      const data = await response.json();
      if (data && data.success && data.streamUrl && !data.streamUrl.includes('.m3u8')) {
        return data.streamUrl;
      }
    } catch (_) {}
    return '';
  }
  async function executeCopyShareLink(track) {
    if (isShareInProgress) return;
    if (!track) {
      showToast('No track selected', 'error');
      return;
    }
    isShareInProgress = true;
    const hideSpinner = showShareSpinnerToast();
    try {
      let directStream = '';
      if ((track.url || track.id) && track.platform !== 'local') {
        directStream = await resolveFullTrackStreamForShare(track);
      }
      const shareUrl = buildRiffShareUrl(track, directStream, '', 0);
      await navigator.clipboard.writeText(shareUrl);
      showToast('Share link copied to clipboard!', 'success');
    } catch (e) {
      showToast('Failed to copy share link', 'error');
    } finally {
      hideSpinner();
      setTimeout(() => { isShareInProgress = false; }, 400);
    }
  }
  window.executeCopyShareLink = executeCopyShareLink;


  function normalizeProxyString(raw) {
    let clean = String(raw || '').trim();
    if (!clean) return '';
    if (clean.includes('://')) return clean;

    const quadMatch = clean.match(/^([^:]+):(\d+):([^:]+):(.+)$/);
    if (quadMatch) {
      const [, host, port, user, pass] = quadMatch;
      return `socks5://${user}:${pass}@${host}:${port}`;
    }

    const pairMatch = clean.match(/^([^:]+):(\d+)$/);
    if (pairMatch) {
      const [, host, port] = pairMatch;
      const httpPorts = ['8080', '8888', '3128', '10809'];
      const protocol = httpPorts.includes(port) ? 'http://' : 'socks5://';
      return `${protocol}${host}:${port}`;
    }

    return `socks5://${clean}`;
  }

  function initProxyManager() {
    const btnProxyEnable = document.getElementById('btn-proxy-enable');
    const proxyInputUrl = document.getElementById('proxy-input-url');
    const btnProxyAdd = document.getElementById('btn-proxy-add');
    const btnProxyTest = document.getElementById('btn-proxy-test');
    const proxyListContainer = document.getElementById('proxy-list-container');

    function getProxyList() {
      try {
        const raw = localStorage.getItem('riff_proxy_list');
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch (_) {
        return [];
      }
    }

    function saveProxyList(list) {
      localStorage.setItem('riff_proxy_list', JSON.stringify(list));
    }

    function isProxyEnabled() {
      return localStorage.getItem('riff_proxy_enabled') === 'true';
    }

    function getActiveProxy() {
      const list = getProxyList();
      if (!list.length) return null;
      const activeId = localStorage.getItem('riff_proxy_active_id');
      return list.find(p => p.id === activeId) || list[0];
    }

    function syncActiveProxyToBackend() {
      const enabled = isProxyEnabled();
      const activeProxy = getActiveProxy();
      const activeProxyUrl = (enabled && activeProxy) ? activeProxy.url : '';
      const payload = {
        enabled: Boolean(enabled && activeProxyUrl),
        proxyUrl: activeProxyUrl
      };

      const port = state.serverPort || 38472;
      fetch(`http://127.0.0.1:${port}/api/proxy-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(e => console.error('Failed to sync proxy config to server', e));

      if (window.electronAPI && typeof window.electronAPI.setAppProxy === 'function') {
        window.electronAPI.setAppProxy(payload.enabled ? activeProxyUrl : '').catch(e => console.error('Failed to set app proxy', e));
      }
    }

    function renderProxyList() {
      if (!proxyListContainer) return;
      const list = getProxyList();
      const activeProxy = getActiveProxy();
      const activeId = activeProxy ? activeProxy.id : null;

      if (!list.length) {
        proxyListContainer.innerHTML = '<div style="font-size: 12px; opacity: 0.6; padding: 6px 4px;">No proxies configured</div>';
        return;
      }

      proxyListContainer.innerHTML = '';
      list.forEach((item) => {
        const row = document.createElement('div');
        row.className = 'proxy-list-item' + (item.id === activeId ? ' active' : '');
        row.dataset.proxyId = item.id;

        let proto = 'PROXY';
        try {
          const u = new URL(item.url);
          proto = u.protocol.replace(':', '').toUpperCase();
        } catch (_) {
          if (item.url.startsWith('socks5://')) proto = 'SOCKS5';
          else if (item.url.startsWith('http://')) proto = 'HTTP';
          else if (item.url.startsWith('https://')) proto = 'HTTPS';
        }

        const left = document.createElement('div');
        left.className = 'proxy-item-left';

        const badge = document.createElement('span');
        badge.className = 'proxy-item-badge';
        badge.textContent = proto;

        const urlSpan = document.createElement('span');
        urlSpan.className = 'proxy-item-url';
        urlSpan.textContent = item.url;
        urlSpan.title = item.url;

        left.appendChild(badge);
        left.appendChild(urlSpan);

        const right = document.createElement('div');
        right.style.display = 'flex';
        right.style.alignItems = 'center';
        right.style.gap = '8px';
        right.style.flexShrink = '0';

        if (typeof item.ping === 'number') {
          const pingSpan = document.createElement('span');
          pingSpan.className = 'proxy-item-ping';
          pingSpan.textContent = `${item.ping} ms`;
          right.appendChild(pingSpan);
        }

        const btnRemove = document.createElement('button');
        btnRemove.type = 'button';
        btnRemove.className = 'btn-proxy-remove';
        btnRemove.title = 'Remove proxy';
        btnRemove.setAttribute('aria-label', 'Remove proxy');
        btnRemove.innerHTML = '&minus;';

        btnRemove.addEventListener('click', (e) => {
          e.stopPropagation();
          let currentList = getProxyList();
          currentList = currentList.filter(p => p.id !== item.id);
          saveProxyList(currentList);
          if (localStorage.getItem('riff_proxy_active_id') === item.id) {
            const nextActive = currentList[0];
            if (nextActive) {
              localStorage.setItem('riff_proxy_active_id', nextActive.id);
            } else {
              localStorage.removeItem('riff_proxy_active_id');
            }
          }
          renderProxyList();
          syncActiveProxyToBackend();
        });

        right.appendChild(btnRemove);

        row.appendChild(left);
        row.appendChild(right);

        row.addEventListener('click', () => {
          localStorage.setItem('riff_proxy_active_id', item.id);
          renderProxyList();
          syncActiveProxyToBackend();
        });

        proxyListContainer.appendChild(row);
      });
    }

    if (btnProxyEnable) {
      btnProxyEnable.classList.toggle('active', isProxyEnabled());
      btnProxyEnable.addEventListener('click', () => {
        const next = !isProxyEnabled();
        localStorage.setItem('riff_proxy_enabled', next ? 'true' : 'false');
        btnProxyEnable.classList.toggle('active', next);
        syncActiveProxyToBackend();
      });
    }

    function handleAdd() {
      if (!proxyInputUrl) return;
      const raw = proxyInputUrl.value.trim();
      const url = normalizeProxyString(raw);
      if (!url) {
        showToast('Please enter a proxy URL');
        return;
      }
      const list = getProxyList();
      const newProxy = {
        id: 'pxy_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        url,
        ping: null
      };
      list.push(newProxy);
      saveProxyList(list);
      localStorage.setItem('riff_proxy_active_id', newProxy.id);
      localStorage.setItem('riff_proxy_enabled', 'true');
      if (btnProxyEnable) btnProxyEnable.classList.add('active');
      proxyInputUrl.value = '';
      renderProxyList();
      syncActiveProxyToBackend();
      showToast('Proxy added and activated');
    }

    if (btnProxyAdd) {
      btnProxyAdd.addEventListener('click', handleAdd);
    }
    if (proxyInputUrl) {
      proxyInputUrl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleAdd();
        }
      });
    }

    if (btnProxyTest) {
      btnProxyTest.addEventListener('click', async () => {
        const activeProxy = getActiveProxy();
        if (!activeProxy) {
          showToast('No active proxy to test');
          return;
        }
        btnProxyTest.disabled = true;
        showToast('Testing proxy connection...');
        try {
          const port = state.serverPort || 38472;
          const res = await fetch(`http://127.0.0.1:${port}/api/proxy-test`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ proxyUrl: activeProxy.url })
          });
          const data = await res.json();
          if (data && data.success && typeof data.pingMs === 'number') {
            const list = getProxyList();
            const target = list.find(p => p.id === activeProxy.id);
            if (target) {
              target.ping = data.pingMs;
              saveProxyList(list);
            }
            renderProxyList();
            showToast('Proxy connected (' + data.pingMs + ' ms)');
          } else {
            showToast('Proxy connection failed');
          }
        } catch (_) {
          showToast('Proxy connection failed');
        } finally {
          btnProxyTest.disabled = false;
        }
      });
    }

    renderProxyList();
    syncActiveProxyToBackend();
  }

  function initSongQualitySetting() {
    const drop = document.getElementById('dropdown-song-quality');
    const trigger = document.getElementById('btn-song-quality-trigger');
    const label = document.getElementById('label-song-quality');
    const menu = document.getElementById('menu-song-quality');

    if (!drop || !trigger || !menu) return;

    const qualityNames = { low: 'Low', medium: 'Medium', high: 'High', max: 'Max' };
    const saved = localStorage.getItem('riff_audio_quality') || 'medium';
    const active = qualityNames[saved] ? saved : 'medium';

    const applySelection = (val) => {
      if (label) label.textContent = qualityNames[val] || 'Medium';
      menu.querySelectorAll('.m3-dropdown-option').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.val === val);
      });
    };

    applySelection(active);

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      drop.classList.toggle('open');
    });

    menu.querySelectorAll('.m3-dropdown-option').forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        const val = opt.dataset.val;
        if (val) {
          localStorage.setItem('riff_audio_quality', val);
          applySelection(val);
        }
        drop.classList.remove('open');
      });
    });

    document.addEventListener('click', () => {
      drop.classList.remove('open');
    });
  }


  async function runWithI18nLoadingOverlay(taskFn) {
    const overlay = document.getElementById('i18n-loading-overlay');
    if (!overlay) {
      if (taskFn) return await taskFn();
      return { ok: true };
    }
    overlay.classList.remove('hidden');
    requestAnimationFrame(() => overlay.classList.add('visible'));

    const S = window.RiffShapes;
    let animActive = true;
    if (S && S.ready()) {
      let fromIdx = 0, toIdx = S.next(0), stepStart = performance.now();
      const STEP_MS = 1000;
      const K = S.K;
      const pathEl = overlay.querySelector('path');
      const frame = (now) => {
        if (!animActive || !overlay.isConnected) return;
        if (now - stepStart >= STEP_MS) {
          fromIdx = toIdx;
          toIdx = S.next(fromIdx);
          stepStart = now;
        }
        const e = S.ease(Math.min(1, (now - stepStart) / STEP_MS));
        const a = S.profile(fromIdx), b = S.profile(toIdx);
        let d = '';
        for (let k = 0; k < K; k += 4) {
          const th = -Math.PI + (Math.PI * 2 * k) / K;
          const r = a[k] + (b[k] - a[k]) * e;
          d += `${k === 0 ? 'M' : 'L'}${(Math.cos(th) * r).toFixed(1)},${(Math.sin(th) * r).toFixed(1)}`;
        }
        d += 'Z';
        if (pathEl) pathEl.setAttribute('d', d);
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    }

    let result = { ok: false };
    try {
      const [r] = await Promise.all([
        typeof taskFn === 'function' ? taskFn() : Promise.resolve({ ok: true }),
        new Promise(res => setTimeout(res, 600))
      ]);
      result = r || { ok: true };
    } catch (error) {
      result = { ok: false, error: error && error.message ? error.message : String(error) };
    } finally {
      animActive = false;
      overlay.classList.remove('visible');
      setTimeout(() => {
        overlay.classList.add('hidden');
      }, 220);
    }
    return result;
  }

  function showLangRestartDialog(lang) {
    if (!langRestartModal) return;
    const tLang = LANG_RESTART_TEXT[lang] || LANG_RESTART_TEXT.en;
    const title = langRestartModal.querySelector('h3');
    const msg = document.getElementById('lang-restart-msg');
    const cancel = document.getElementById('btn-lang-restart-cancel');
    const confirm = document.getElementById('btn-lang-restart-confirm');
    if (title) title.textContent = tLang.title;
    if (msg) msg.textContent = tLang.msg;
    if (cancel) cancel.textContent = tLang.cancel;
    if (confirm) confirm.textContent = tLang.restart;
    openModal(langRestartModal);
  }

  var btnCancelLangRestart = document.getElementById('btn-lang-restart-cancel');
  var btnConfirmLangRestart = document.getElementById('btn-lang-restart-confirm');

  if (btnCancelLangRestart) {
    btnCancelLangRestart.addEventListener('click', () => closeModal(langRestartModal));
  }

  if (btnConfirmLangRestart) {
    btnConfirmLangRestart.addEventListener('click', () => {
      if (window.electronAPI && window.electronAPI.restartApp) {
        if (window.electronAPI.storageSaveSync && window.__RIFF_STORAGE_MAP__) {
          window.electronAPI.storageSaveSync(window.__RIFF_STORAGE_MAP__);
        }
        window.electronAPI.restartApp();
      } else {
        window.location.reload();
      }
    });
  }

  var lyricsEaseDropdown = document.getElementById('lyrics-ease-dropdown');
  var lyricsEaseTrigger = document.getElementById('lyrics-ease-trigger');
  var lyricsEaseLabel = document.getElementById('lyrics-ease-label');
  var lyricsEaseMenu = document.getElementById('lyrics-ease-menu');

  if (lyricsEaseDropdown && lyricsEaseTrigger && lyricsEaseMenu) {
    const curEase = getLyricsEase();
    lyricsEaseMenu.querySelectorAll('.m3-dropdown-option').forEach(opt => {
      const isSel = opt.dataset.value === curEase;
      opt.classList.toggle('selected', isSel);
      if (isSel && lyricsEaseLabel) lyricsEaseLabel.textContent = opt.textContent;
    });

    lyricsEaseTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      lyricsEaseDropdown.classList.toggle('open');
    });

    lyricsEaseMenu.querySelectorAll('.m3-dropdown-option').forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        const val = opt.dataset.value;
        localStorage.setItem('riff_lyrics_ease', val);
        if (lyricsEaseLabel) lyricsEaseLabel.textContent = opt.textContent;
        lyricsEaseMenu.querySelectorAll('.m3-dropdown-option').forEach(o => o.classList.toggle('selected', o === opt));
        applyLyricsEase();
        lyricsEaseDropdown.classList.remove('open');
      });
    });

    document.addEventListener('click', () => {
      lyricsEaseDropdown.classList.remove('open');
    });
  }

  var sliderLyricsSpeed = document.getElementById('slider-lyrics-speed');
  var valLyricsSpeed = document.getElementById('val-lyrics-speed');
  if (sliderLyricsSpeed && valLyricsSpeed) {
    const currentSpeed = getLyricsSpeed();
    sliderLyricsSpeed.value = Math.round(currentSpeed * 10);
    valLyricsSpeed.textContent = `${currentSpeed.toFixed(1)}x`;

    sliderLyricsSpeed.addEventListener('input', () => {
      const val = parseInt(sliderLyricsSpeed.value, 10) / 10;
      valLyricsSpeed.textContent = `${val.toFixed(1)}x`;
      localStorage.setItem('riff_lyrics_speed', val.toString());
      applyLyricsEase();
    });
  }

  var lyricsSourceDropdown = document.getElementById('lyrics-source-dropdown');
  var lyricsSourceTrigger = document.getElementById('lyrics-source-trigger');
  var lyricsSourceLabel = document.getElementById('lyrics-source-label');
  var lyricsSourceMenu = document.getElementById('lyrics-source-menu');

  if (lyricsSourceDropdown && lyricsSourceTrigger && lyricsSourceMenu) {
    const curSource = localStorage.getItem('riff_lyrics_source') || 'auto';
    lyricsSourceMenu.querySelectorAll('.m3-dropdown-option').forEach(opt => {
      const isSel = opt.dataset.value === curSource;
      opt.classList.toggle('selected', isSel);
      if (isSel && lyricsSourceLabel) lyricsSourceLabel.textContent = opt.textContent;
    });

    lyricsSourceTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      lyricsSourceDropdown.classList.toggle('open');
    });

    lyricsSourceMenu.querySelectorAll('.m3-dropdown-option').forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        const val = opt.dataset.value;
        localStorage.setItem('riff_lyrics_source', val);
        if (lyricsSourceLabel) lyricsSourceLabel.textContent = opt.textContent;
        lyricsSourceMenu.querySelectorAll('.m3-dropdown-option').forEach(o => o.classList.toggle('selected', o === opt));
        lyricsSourceDropdown.classList.remove('open');
        lyricsSessionCache.clear();
        if (state.currentTrack) {
          loadSyncedLyrics(state.currentTrack.title, state.currentTrack.artist, state.loadToken);
        }
      });
    });

    document.addEventListener('click', () => {
      lyricsSourceDropdown.classList.remove('open');
    });
  }

  var wordSourceDropdown = document.getElementById('word-source-dropdown');
  var wordSourceTrigger = document.getElementById('word-source-trigger');
  var wordSourceLabel = document.getElementById('word-source-label');
  var wordSourceMenu = document.getElementById('word-source-menu');

  if (wordSourceDropdown && wordSourceTrigger && wordSourceMenu) {
    const curWordSource = localStorage.getItem('riff_word_source') || 'auto';
    wordSourceMenu.querySelectorAll('.m3-dropdown-option').forEach(opt => {
      const isSel = opt.dataset.value === curWordSource;
      opt.classList.toggle('selected', isSel);
      if (isSel && wordSourceLabel) wordSourceLabel.textContent = opt.textContent;
    });

    wordSourceTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      wordSourceDropdown.classList.toggle('open');
    });

    wordSourceMenu.querySelectorAll('.m3-dropdown-option').forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        const val = opt.dataset.value;
        localStorage.setItem('riff_word_source', val);
        if (wordSourceLabel) wordSourceLabel.textContent = opt.textContent;
        wordSourceMenu.querySelectorAll('.m3-dropdown-option').forEach(o => o.classList.toggle('selected', o === opt));
        wordSourceDropdown.classList.remove('open');
        wordsSessionCache.clear();
        if (state.currentTrack) {
          loadSyncedLyrics(state.currentTrack.title, state.currentTrack.artist, state.loadToken);
        }
      });
    });

    document.addEventListener('click', () => {
      wordSourceDropdown.classList.remove('open');
    });
  }

  var lyricsWordStyleDropdown = document.getElementById('lyrics-wordstyle-dropdown');
  var lyricsWordStyleTrigger = document.getElementById('lyrics-wordstyle-trigger');
  var lyricsWordStyleLabel = document.getElementById('lyrics-wordstyle-label');
  var lyricsWordStyleMenu = document.getElementById('lyrics-wordstyle-menu');

  if (lyricsWordStyleDropdown && lyricsWordStyleTrigger && lyricsWordStyleMenu) {
    const curStyle = getLyricsWordStyle();
    lyricsWordStyleMenu.querySelectorAll('.m3-dropdown-option').forEach(opt => {
      const isSel = opt.dataset.value === curStyle;
      opt.classList.toggle('selected', isSel);
      if (isSel && lyricsWordStyleLabel) lyricsWordStyleLabel.textContent = opt.textContent;
    });

    lyricsWordStyleTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      lyricsWordStyleDropdown.classList.toggle('open');
    });

    lyricsWordStyleMenu.querySelectorAll('.m3-dropdown-option').forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        const val = opt.dataset.value;
        localStorage.setItem('riff_lyrics_word_style', val);
        if (lyricsWordStyleLabel) lyricsWordStyleLabel.textContent = opt.textContent;
        lyricsWordStyleMenu.querySelectorAll('.m3-dropdown-option').forEach(o => o.classList.toggle('selected', o === opt));
        lyricsWordStyleDropdown.classList.remove('open');
        renderLyricsView();
        if (el.nativeAudio) updateSyncedLyricsHighlight(el.nativeAudio.currentTime || 0);
      });
    });

    document.addEventListener('click', () => {
      lyricsWordStyleDropdown.classList.remove('open');
    });
  }

  var sliderLyricsTightness = document.getElementById('slider-lyrics-tightness');
  var valLyricsTightness = document.getElementById('val-lyrics-tightness');
  if (sliderLyricsTightness && valLyricsTightness) {
    const currentTightness = getLyricsGradientTightness();
    sliderLyricsTightness.value = currentTightness;
    valLyricsTightness.textContent = `${currentTightness}%`;

    sliderLyricsTightness.addEventListener('input', () => {
      const val = parseInt(sliderLyricsTightness.value, 10);
      valLyricsTightness.textContent = `${val}%`;
      localStorage.setItem('riff_lyrics_gradient_tightness', val.toString());
      localStorage.setItem('riff_gradient_tight', val.toString());
      applyLyricsGradientTightness();
      updateActiveGradient();
    });
  }

  var handleResetAudio = () => {
    state.activePresetId = 'p_default';
    state.audioSettings = { speed: 1.0, speedPitch: 1.0, pitch: 0, reverb: 0, distortion: 0, volume: 1.0, echo: 0, eq: { low: 0, mid: 0, high: 0 }, eqBands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] };
    state.hqSettings = { engine: 'hqmusic-3', preset: 'studio', vocal: 0, air: 0, bass: 0 };
    state.hqEnabled = false;

    localStorage.setItem('riff_hq_enabled', '0');
    updateHqRouting();
    localStorage.setItem('riff_audio_normalize', '0');
    const toggleNorm = document.getElementById('toggle-normalize');
    if (toggleNorm) toggleNorm.classList.remove('active');
    if (typeof resetLevelWatcher === 'function') resetLevelWatcher();
    if (audioEngine && typeof audioEngine.setNormalizeGainDb === 'function') {
      audioEngine.setNormalizeGainDb(0);
    }
    document.querySelectorAll('#audio-settings-modal .effect-switch-btn').forEach(btn => btn.classList.remove('active'));

    syncSettingsSlidersToState();

    document.querySelectorAll('#audio-settings-modal input[type="range"]').forEach(input => {
      const wrap = input.closest('.sl');
      if (wrap) {
        const min = input.min === '' ? 0 : parseFloat(input.min);
        const max = input.max === '' ? 100 : parseFloat(input.max);
        const rawRatio = max > min ? (parseFloat(input.value) - min) / (max - min) : 0;
        wrap.style.setProperty('--v', rawRatio);
        updateRulerTicks(wrap, rawRatio);
      }
    });

    applyAudioSettings();
    applyHqSettings();
    renderPresets();
    showToast('Audio settings reset');
  };

  var btnResetAudio = el.btnResetAudio || document.getElementById('btn-reset-audio');
  if (btnResetAudio) {
    btnResetAudio.addEventListener('click', handleResetAudio);
  }
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('#btn-reset-audio');
    if (btn) {
      handleResetAudio();
    }
  });

  var toggleNormalize = document.getElementById('toggle-normalize');
  if (toggleNormalize) {
    const isNorm = localStorage.getItem('riff_audio_normalize') === '1';
    toggleNormalize.classList.toggle('active', isNorm);
    toggleNormalize.addEventListener('click', () => {
      const active = !toggleNormalize.classList.contains('active');
      toggleNormalize.classList.toggle('active', active);
      localStorage.setItem('riff_audio_normalize', active ? '1' : '0');
      if (!active) resetLevelWatcher();
    });
  }

  (function initUpdateUI() {
    const api = window.electronAPI;
    const $ = (id) => document.getElementById(id);
    let currentAppVersion = '0.7.6';
    const formatDisplayVer = (v) => (!v || v.startsWith('44.')) ? '0.7.6' : v;
    if (api && api.getAppVersion) {
      api.getAppVersion().then((v) => {
        if (v) {
          currentAppVersion = v;
          const displayV = formatDisplayVer(v);
          const a = $('about-version'); if (a) a.textContent = 'Version ' + displayV;
          const t = document.querySelector('.settings-version-tag'); if (t) t.textContent = 'v' + displayV;
        }
      }).catch(() => {});
    } else {
      const a = $('about-version');
      if (a && a.textContent) {
        const match = a.textContent.match(/[\d.]+/);
        if (match) currentAppVersion = match[0];
      }
    }

    const btn = $('btn-check-updates');
    const originalBtnHtml = btn ? btn.innerHTML : 'Check for updates';
    let manualUpdateCheck = false;
    let checkTimeoutId = null;
    let fallbackReleaseUrl = 'https://github.com/rootscripts/riff/releases/latest';
    let canNativeInstall = false;

    let latestUpdateInfo = null;
    let isUpdateDownloaded = false;
    let isWaitingToRestart = false;

    function formatRelativeReleaseTime(isoDateStr) {
      if (!isoDateStr) return 'New release';
      const ts = Date.parse(isoDateStr);
      if (!Number.isFinite(ts)) return 'New release';
      const diffSec = Math.max(60, Math.floor((Date.now() - ts) / 1000));
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
      if (diffSec < 2592000) return `${Math.floor(diffSec / 86400)}d ago`;
      return `${Math.floor(diffSec / 2592000)}mo ago`;
    }

    function parseGithubReleaseBodyAndBanner(rawNotes) {
      let text = String(rawNotes || '');
      let bannerUrl = '';
      const htmlImgMatch = text.match(/<img[^>]+src=["'](https?:\/\/[^"']+)["'][^>]*>/i);
      if (htmlImgMatch && htmlImgMatch[1]) {
        bannerUrl = htmlImgMatch[1].trim();
        text = text.replace(/<img[^>]*>/gi, '');
      } else {
        const mdImgMatch = text.match(/!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/i);
        if (mdImgMatch && mdImgMatch[1]) {
          bannerUrl = mdImgMatch[1].trim();
          text = text.replace(/!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/gi, '');
        }
      }
      text = text
        .replace(/<\/?(?:p|div|br|h[1-6]|ul|ol|li|strong|em|b|i|code|pre|blockquote|hr)[^>]*>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/^#{1,6}\s+.*$/gm, (m) => m.replace(/^#{1,6}\s+/, ''))
        .replace(/^\s*[-*•]\s+/gm, '• ')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      return { cleanText: text, bannerUrl };
    }

    function populateOtaUpdateSheet(info) {
      const modal = document.getElementById('update-modal');
      const sheet = document.getElementById('update-sheet-card');
      const spinnerBox = document.getElementById('update-center-spinner');
      const timeEl = document.getElementById('update-release-time');
      const verEl = document.getElementById('update-version-badge');
      const notesEl = document.getElementById('update-notes');
      const bannerWrap = document.getElementById('update-banner-wrap');
      const bannerImg = document.getElementById('update-banner-img');
      const bodyGrid = document.getElementById('update-body-grid');
      if (!modal || !sheet || !notesEl) return;

      const rawVer = String(info?.version || '').replace(/^v/i, '');
      const ignoredVer = localStorage.getItem('riff_ignored_update_ver') || '';
      if (!manualUpdateCheck && rawVer && ignoredVer === rawVer) return;

      const displayVer = rawVer.endsWith('.0.0') ? ('v' + rawVer.slice(0, -4)) : (rawVer.endsWith('.0') ? ('v' + rawVer.slice(0, -2)) : ('v' + rawVer));
      if (verEl) verEl.textContent = displayVer || 'v0.7.6';
      if (timeEl) timeEl.textContent = formatRelativeReleaseTime(info?.publishedAt || info?.releaseDate || '');

      const { cleanText, bannerUrl } = parseGithubReleaseBodyAndBanner(info?.releaseNotes || '');
      notesEl.innerHTML = '';
      const paragraphs = (cleanText || 'Bug fixes, playback improvements, and UI polish.').split(/\n+/).map(s => s.trim()).filter(Boolean);
      paragraphs.forEach((line) => {
        const p = document.createElement('p');
        p.textContent = line;
        notesEl.appendChild(p);
      });

      if (bannerUrl && bannerWrap && bannerImg) {
        bannerImg.src = bannerUrl;
        bannerWrap.classList.remove('hidden');
        if (bodyGrid) bodyGrid.classList.remove('no-banner');
        bannerImg.onerror = () => {
          bannerWrap.classList.add('hidden');
          if (bodyGrid) bodyGrid.classList.add('no-banner');
        };
      } else {
        if (bannerWrap) bannerWrap.classList.add('hidden');
        if (bodyGrid) bodyGrid.classList.add('no-banner');
      }

      sheet.classList.remove('leaving');
      if (spinnerBox) spinnerBox.classList.add('hidden');
      modal.classList.remove('hidden');
    }

    function restoreButton() {
      manualUpdateCheck = false;
      if (checkTimeoutId) {
        clearTimeout(checkTimeoutId);
        checkTimeoutId = null;
      }
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalBtnHtml;
      }
    }

    function isNewerVersion(latest, current) {
      const p1 = String(latest || '').split('.').map(n => parseInt(n, 10) || 0);
      const p2 = String(current || '').split('.').map(n => parseInt(n, 10) || 0);
      if (p2[0] >= 40 && p1[0] < 40) return true;
      for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
        const a = p1[i] || 0;
        const b = p2[i] || 0;
        if (a > b) return true;
        if (a < b) return false;
      }
      return false;
    }

    async function checkDirectFromRenderer() {
      try {
        if (!navigator.onLine) {
          restoreButton();
          showToast('Could not check for updates', 'error');
          return;
        }
        const res = await fetch('https://api.github.com/repos/rootscripts/riff/releases/latest', {
          headers: { 'User-Agent': 'Riff-Player' }
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const json = await res.json();
        const latestVersion = (json.tag_name || '').replace(/^v/i, '');
        fallbackReleaseUrl = json.html_url || 'https://github.com/rootscripts/riff/releases/latest';
        if (isNewerVersion(latestVersion, currentAppVersion)) {
          latestUpdateInfo = {
            version: latestVersion,
            releaseNotes: json.body || '',
            publishedAt: json.published_at || '',
            htmlUrl: fallbackReleaseUrl,
            canInstall: false
          };
          populateOtaUpdateSheet(latestUpdateInfo);
          restoreButton();
        } else {
          restoreButton();
          showToast('You are using the latest version of Riff!', 'success');
        }
      } catch (err) {
        restoreButton();
        showToast('Could not check for updates', 'error');
      }
    }

    if (btn) {
      btn.addEventListener('click', async () => {
        if (manualUpdateCheck) return;
        manualUpdateCheck = true;
        btn.disabled = true;
        btn.innerHTML = `<span class="riff-dots-loader sm" style="margin-right:6px;" aria-hidden="true"><i></i><i></i><i></i></span><span>Checking...</span>`;

        if (!api || !api.checkForUpdates) {
          checkDirectFromRenderer();
          return;
        }

        checkTimeoutId = setTimeout(() => {
          if (manualUpdateCheck) {
            checkDirectFromRenderer();
          }
        }, 6000);

        try {
          const r = await api.checkForUpdates();
          if (r && r.ok === false) {
            if (checkTimeoutId) clearTimeout(checkTimeoutId);
            checkDirectFromRenderer();
          }
        } catch (_) {
          if (checkTimeoutId) clearTimeout(checkTimeoutId);
          checkDirectFromRenderer();
        }
      });
    }

    if (api && api.onUpdateAvailable) {
      api.onUpdateAvailable(async (info) => {
        restoreButton();
        latestUpdateInfo = { ...(info || {}) };
        canNativeInstall = !!info?.canInstall;

        const hasImg = latestUpdateInfo.releaseNotes && /<img/i.test(latestUpdateInfo.releaseNotes);
        const hasPublishedAt = !!latestUpdateInfo.publishedAt;

        if (!hasImg || !hasPublishedAt) {
          try {
            const res = await fetch('https://api.github.com/repos/rootscripts/riff/releases/latest', {
              headers: { 'User-Agent': 'Riff-Player' }
            });
            if (res.ok) {
              const gh = await res.json();
              if (gh.body) latestUpdateInfo.releaseNotes = gh.body;
              if (gh.published_at) latestUpdateInfo.publishedAt = gh.published_at;
              if (gh.html_url) latestUpdateInfo.htmlUrl = gh.html_url;
              if (gh.tag_name && !latestUpdateInfo.version) latestUpdateInfo.version = gh.tag_name;
            }
          } catch (_) {}
        }

        populateOtaUpdateSheet(latestUpdateInfo);
      });
    }

    const onDownloaded = (info) => {
      isUpdateDownloaded = true;
      if (info && !latestUpdateInfo) {
        latestUpdateInfo = { ...info };
      }
      if (isWaitingToRestart) {
        setTimeout(() => {
          if (window.electronAPI && window.electronAPI.installUpdateNow) {
            window.electronAPI.installUpdateNow();
          } else if (window.electronAPI && window.electronAPI.updateAction) {
            window.electronAPI.updateAction('now');
          }
        }, 600);
      } else {
        const modal = document.getElementById('update-modal');
        if (modal && modal.classList.contains('hidden')) {
          populateOtaUpdateSheet(latestUpdateInfo || info);
        }
      }
    };

    if (api && api.onUpdateDownloaded) {
      api.onUpdateDownloaded(onDownloaded);
    }
    if (api && api.onUpdateReady) {
      api.onUpdateReady(onDownloaded);
    }

    if (api && api.onUpdateNotAvailable) {
      api.onUpdateNotAvailable(() => {
        const wasManual = manualUpdateCheck;
        restoreButton();
        if (wasManual) {
          showToast('You are using the latest version of Riff!', 'success');
        }
      });
    }

    if (api && api.onUpdateError) {
      api.onUpdateError(() => {
        const wasManual = manualUpdateCheck;
        restoreButton();
        if (isWaitingToRestart) {
          isWaitingToRestart = false;
          if (latestUpdateInfo?.htmlUrl) {
            window.open(latestUpdateInfo.htmlUrl, '_blank');
          } else {
            try {
              if (window.electronAPI && window.electronAPI.installUpdateNow) {
                window.electronAPI.installUpdateNow();
              }
            } catch (_) {}
          }
        } else if (wasManual) {
          showToast('Could not check for updates', 'error');
        }
      });
    }

    if (api && api.onUpdateProgress) {
      api.onUpdateProgress((d) => {
        const fill = document.getElementById('update-progress-fill');
        const label = document.getElementById('update-progress-label');
        if (fill) fill.style.width = (d?.percent || 0) + '%';
        if (label) label.textContent = (d?.percent || 0) + '%';
      });
    }

    const btnUpdateNow = document.getElementById('btn-update-now');
    if (btnUpdateNow) {
      btnUpdateNow.addEventListener('click', () => {
        const sheet = document.getElementById('update-sheet-card');
        const spinnerBox = document.getElementById('update-center-spinner');
        if (sheet) sheet.classList.add('leaving');
        if (spinnerBox) spinnerBox.classList.remove('hidden');

        if (isUpdateDownloaded) {
          setTimeout(() => {
            if (window.electronAPI && window.electronAPI.installUpdateNow) {
              window.electronAPI.installUpdateNow();
            } else if (window.electronAPI && window.electronAPI.updateAction) {
              window.electronAPI.updateAction('now');
            }
          }, 900);
          return;
        }

        if (!canNativeInstall) {
          if (latestUpdateInfo?.htmlUrl) {
            window.open(latestUpdateInfo.htmlUrl, '_blank');
          } else {
            try {
              if (window.electronAPI && window.electronAPI.installUpdateNow) {
                window.electronAPI.installUpdateNow();
              }
            } catch (_) {}
          }
          return;
        }

        isWaitingToRestart = true;
        if (api && api.updateAction) {
          api.updateAction('now');
        }
      });
    }

    const btnUpdateLater = document.getElementById('btn-update-later');
    if (btnUpdateLater) {
      btnUpdateLater.addEventListener('click', () => {
        if (latestUpdateInfo?.version) {
          localStorage.setItem('riff_ignored_update_ver', String(latestUpdateInfo.version).replace(/^v/i, ''));
        }
        if (api && api.updateAction) {
          api.updateAction('ignore');
        }
        const sheet = document.getElementById('update-sheet-card');
        const modal = document.getElementById('update-modal');
        if (sheet) sheet.classList.add('leaving');
        setTimeout(() => {
          if (modal) modal.classList.add('hidden');
        }, 260);
      });
    }
  })();



window.escapeHtml = escapeHtml;
window.cleanTrackId = cleanTrackId;
window.CleanTrackId = cleanTrackId;
window.isStaticTikTokTrack = isStaticTikTokTrack;
window.repairTikTokTrack = repairTikTokTrack;
window.t = t;
window.tSet = tSet;
window.showToast = showToast;
window.openModal = openModal;
window.closeModal = closeModal;
window.safeJson = safeJson;
window.safeArray = safeArray;
window.getDefaultsJsonSync = getDefaultsJsonSync;
window.reportError = reportError;



var BUILTIN_UI_DICT = window.BUILTIN_UI_DICT || {};
window.BUILTIN_UI_DICT = BUILTIN_UI_DICT;

function setupSortDropdown(dropdownId, triggerId, menuId, labelId, selectEl) {
  const dropdown = document.getElementById(dropdownId);
  const trigger = document.getElementById(triggerId);
  const menu = document.getElementById(menuId);
  const label = document.getElementById(labelId);
  if (!dropdown || !trigger || !menu || !selectEl) return;

  function syncUI() {
    const val = selectEl.value;
    const opts = menu.querySelectorAll('.m3-dropdown-option');
    opts.forEach(opt => {
      const isSel = opt.dataset.value === val;
      opt.classList.toggle('selected', isSel);
      if (isSel && label) label.textContent = opt.textContent;
    });
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('open');
  });

  document.addEventListener('click', () => {
    dropdown.classList.remove('open');
  });

  menu.querySelectorAll('.m3-dropdown-option').forEach(opt => {
    opt.addEventListener('click', (e) => {
      e.stopPropagation();
      const val = opt.dataset.value;
      dropdown.classList.remove('open');
      if (selectEl.value !== val) {
        selectEl.value = val;
        selectEl.dispatchEvent(new Event('change'));
      }
      syncUI();
    });
  });

  syncUI();
}
window.setupSortDropdown = setupSortDropdown;

function decorateSwitches(root) {
  (root || document).querySelectorAll('.effect-switch-btn .thumb:not(.has-icon):not([data-enhanced="true"])').forEach((t) => {
    if (t.dataset.enhanced === 'true' || t.classList.contains('has-icon')) return;
    t.dataset.enhanced = 'true';
    t.classList.add('has-icon');
    t.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="sw-icon"/></svg>';
  });
}
window.decorateSwitches = decorateSwitches;


var AUTO_I18N_SELECTORS = [
  '[data-i18n]',
  '.setting-name',
  '.setting-hint',
  '.setting-item-top div > span:not(.setting-name):not(.riff-beta-badge)',
  '.setting-item > div:not([class]):not(:has(*))',
  '.setting-hints > span',
  '.customizer-box > div:first-child',
  '.settings-section-title',
  '.rail-drawer-title',
  '.home-pane-label',
  '.dialog-header h3',
  '.modal-title',
  '.btn-pill-primary > span',
  '.btn-outline-pill > span',
  '.custom-lyrics-tip > span',
  '.empty-hint',
  'button.btn-pill-primary:not(:has(*))',
  'button.btn-outline-pill:not(:has(*))',
  '.btn-icon-pill[title]',
  '.btn-icon[title]',
  'button.ct-action',
  'a.ct-action'
];
window.AUTO_I18N_SELECTORS = AUTO_I18N_SELECTORS;

var DYNAMIC_EXCLUDE_SEL = [
  '#custom-lyrics-view',
  '.lyrics-line',
  '.lyrics-word',
  '.track-title',
  '.track-artist',
  '.track-album',
  '.dialog-track-title',
  '.dialog-track-artist',
  '#offline-tracks-list',
  '#local-tracks-list',
  '#playlists-grid',
  '#history-tracks-list',
  '#queue-tracks-list',
  '#search-results-list',
  '#favorites-tracks-list',
  '#artist-popular-tracks',
  '#artist-albums-list',
  '.lyrics-preview-container',
  '#now-playing-title',
  '#now-playing-artist',
  '#now-playing-album',
  '.np-title',
  '.np-artist',
  '.np-album'
].join(', ');
window.DYNAMIC_EXCLUDE_SEL = DYNAMIC_EXCLUDE_SEL;

var PROTECTED_BRAND_TEXTS = new Set([
  'Riff', 'devsize', 'Spotify', 'YouTube', 'Apple Music', 'Discord', 'Last.fm', 'HQMusic',
  'Lossless', 'FLAC', 'MP3', 'WAV', 'OPUS', 'AAC', 'WebM', 'GitHub', 'Telegram'
]);
window.PROTECTED_BRAND_TEXTS = PROTECTED_BRAND_TEXTS;

var REVERSE_TO_EN = {};
window.REVERSE_TO_EN = REVERSE_TO_EN;

function ensureUiPackStyles() {}
window.ensureUiPackStyles = ensureUiPackStyles;
function ensurePack2Styles() {}
window.ensurePack2Styles = ensurePack2Styles;
function ensureAboutSupportStyles() {}
window.ensureAboutSupportStyles = ensureAboutSupportStyles;
function ensurePack3MasterOverridesStyles() {}
window.ensurePack3MasterOverridesStyles = ensurePack3MasterOverridesStyles;


function isI18nFixed(element) {
  if (!element || element.hasAttribute('data-i18n-fixed')) return true;
  if (element.closest && typeof DYNAMIC_EXCLUDE_SEL === 'string' && element.closest(DYNAMIC_EXCLUDE_SEL)) return true;
  const raw = (element.dataset.i18nEn || element.dataset.i18nEnPlaceholder || element.getAttribute('placeholder') || element.textContent || '').trim();
  if (!raw) return true;
  if (typeof PROTECTED_BRAND_TEXTS !== 'undefined' && PROTECTED_BRAND_TEXTS.has && PROTECTED_BRAND_TEXTS.has(raw.toLowerCase())) return true;
  if (/^v?\d+\.\d+(\.\d+)?$/i.test(raw)) return true;
  return false;
}
window.isI18nFixed = isI18nFixed;


function getLyricsEase() {
  const v = localStorage.getItem('riff_lyrics_ease') || 'spring';
  return (typeof LYRIC_EASINGS !== 'undefined' && LYRIC_EASINGS && LYRIC_EASINGS[v]) ? v : 'spring';
}
window.getLyricsEase = getLyricsEase;

function isLyricsFullscreenOnly() {
  return localStorage.getItem('riff_lyrics_fullscreen_only') === '1';
}
window.isLyricsFullscreenOnly = isLyricsFullscreenOnly;


function getLyricsSpeed() {
  const v = parseFloat(localStorage.getItem('riff_lyrics_speed'));
  return Number.isFinite(v) && v >= 0.5 && v <= 2.0 ? v : 1.0;
}
window.getLyricsSpeed = getLyricsSpeed;


function getLyricsWordStyle() {
  return localStorage.getItem('riff_lyrics_word_style') || 'glow';
}
window.getLyricsWordStyle = getLyricsWordStyle;


function getLyricsGradientTightness() {
  const v = parseFloat(localStorage.getItem('riff_lyrics_tightness'));
  return Number.isFinite(v) && v >= 0.05 && v <= 0.6 ? v : 0.22;
}
window.getLyricsGradientTightness = getLyricsGradientTightness;
