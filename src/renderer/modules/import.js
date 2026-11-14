
'use strict';

  function createWavyProgress(container) {
    const W = 240, H = 12, WL = 16; let d = `M0 ${H/2}`;
    for (let x = 0; x < W; x += WL) d += ` q ${WL/4} ${-H/2} ${WL/2} 0 t ${WL/2} 0`;
    container.innerHTML = `<svg class="wavy" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><path class="wavy-track" pathLength="100" d="${d}"/><path class="wavy-fill" pathLength="100" d="${d}"/></svg>`;
    const fill = container.querySelector('.wavy-fill'); fill.style.strokeDasharray = '100'; fill.style.strokeDashoffset = '100';
    return { set(p) { fill.style.strokeDashoffset = String(100 - Math.max(0, Math.min(100, p))); } };
  }
  window.createWavyProgress = createWavyProgress;

  async function pool(items, n, fn) {
    const results = new Array(items.length);
    let idx = 0;
    async function worker() {
      while (idx < items.length) {
        const cur = idx++;
        results[cur] = await fn(items[cur], cur);
      }
    }
    const workers = Array.from({ length: Math.min(n, items.length) }, () => worker());
    await Promise.all(workers);
    return results;
  }

  function normalizeImportText(str) {
    if (!str) return '';
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s*[\(\[](?:feat|ft)\.?\s+[^)\]]+[)\]]/gi, '')
      .replace(/\s*-\s*remaster(?:ed)?\b.*/gi, '')
      .replace(/[\(\[][^)\]]*remaster(?:ed)?[^)\]]*[)\]]/gi, '')
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function toSeconds(dur) {
    if (typeof dur === 'string') {
      const trimmed = dur.trim();
      if (/^\d+(:\d{1,2}){1,2}$/.test(trimmed)) {
        return trimmed.split(':').map(Number).reduce((acc, n) => acc * 60 + n, 0);
      }
      const num = Number(trimmed);
      if (!Number.isNaN(num) && num > 0) {
        return num > 1000 ? Math.round(num / 1000) : Math.round(num);
      }
      return 0;
    }
    if (typeof dur === 'number' && dur > 0) {
      return dur > 1000 ? Math.round(dur / 1000) : Math.round(dur);
    }
    return 0;
  }

  function splitArtists(artistStr) {
    if (!artistStr) return [];
    const clean = String(artistStr).replace(/\u00a0/g, ' ');
    return clean
      .split(/[,;&]|(?:\bfeat\.?\b)|(?:\bft\.?\b)|(?:\s+[xX]\s+)/i)
      .map(a => normalizeImportText(a))
      .filter(Boolean);
  }

  var CYR = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya', і: 'i', ї: 'yi', є: 'ye', ґ: 'g' };
  function normalizeForMatch(s) {
    return String(s || '').toLowerCase()
      .replace(/\(.*?\)|\[.*?\]/g, ' ')
      .replace(/\b(feat|ft|remaster(ed)?|remix|version|official|audio|video|lyrics?)\b.*$/g, ' ')
      .split('').map((c) => (CYR[c] !== undefined ? CYR[c] : c)).join('')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function tokenSimilarity(a, b) {
    const A = new Set(normalizeForMatch(a).split(' ').filter(Boolean));
    const B = new Set(normalizeForMatch(b).split(' ').filter(Boolean));
    if (!A.size || !B.size) return 0;
    let hit = 0;
    A.forEach((t) => { if (B.has(t)) hit++; });
    return hit / Math.max(A.size, B.size);
  }
  function pickBestMatch(sp, results) {
    let best = null;
    let bestScore = 0;
    for (const r of results) {
      const text = tokenSimilarity(`${sp.title} ${sp.artist}`, `${r.title} ${r.artist}`);
      const titleSim = tokenSimilarity(sp.title, r.title);
      const dDiff = sp.duration && r.duration ? Math.abs(sp.duration - r.duration) : 99;
      const durationOk = dDiff <= 3;
      const score = text + (durationOk ? 0.6 : 0) + titleSim * 0.3;
      const accept = (durationOk && text >= 0.2) || titleSim >= 0.6 || text >= 0.55;
      if (accept && score > bestScore) { best = r; bestScore = score; }
    }
    return best;
  }

  var activeImportToast = null;

  function showImportSpinnerToast(msg = 'Importing playlist...') {
    const container = document.getElementById('toast-container');
    if (!container) return null;
    if (activeImportToast && activeImportToast.parentNode === container) {
      const textSpan = activeImportToast.querySelector('.toast-text');
      if (textSpan) textSpan.textContent = msg;
      return activeImportToast;
    }
    const toast = document.createElement('div');
    const spinnerSvg = '<svg class="g-spinner" style="width:18px;height:18px;" viewBox="0 0 48 48"><circle cx="24" cy="24" r="20"/></svg>';
    toast.className = 'riff-toast info wide';
    toast.innerHTML = `<div class="toast-row info"><span class="toast-icon">${spinnerSvg}</span><span class="toast-text">${escapeHtml(msg)}</span></div>`;
    container.appendChild(toast);
    activeImportToast = toast;
    return toast;
  }

  function dismissImportSpinnerToast() {
    if (activeImportToast && activeImportToast.parentNode) {
      activeImportToast.remove();
    }
    activeImportToast = null;
  }

  function hydrateMissingPlaylistCovers() {}

  async function matchSpotifyTracks(rawTracks, playlistName = 'Playlist', onProgress, options = {}) {
    if (el && el.linkImportModal) closeModal(el.linkImportModal);
    if (typeof playlistName === 'function') {
      const origProg = playlistName;
      if (typeof onProgress === 'object' && onProgress !== null) {
        options = onProgress;
      }
      onProgress = origProg;
      playlistName = options.playlistName || options.name || 'Playlist';
    } else if (typeof playlistName === 'object' && playlistName !== null) {
      options = playlistName;
      playlistName = options.playlistName || options.name || 'Playlist';
    }
    if (!options || typeof options !== 'object') options = {};
    if (!playlistName || typeof playlistName !== 'string') playlistName = options.playlistName || options.name || 'Playlist';

    const list = Array.isArray(rawTracks) ? rawTracks : [];
    const total = list.length;

    const isSilent = Boolean(options && (options.silent || options.isSilent));
    const container = isSilent ? null : document.getElementById('toast-container');
    let toast = null;
    let textSpan = null;
    let iconSpan = null;
    const spinnerSvg = '<svg class="g-spinner" style="width:18px;height:18px;" viewBox="0 0 48 48"><circle cx="24" cy="24" r="20"/></svg>';
    const checkmarkSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><polyline points="5 12.5 10 17.5 19 7.5"/></svg>';

    if (!isSilent) {
      if (activeImportToast && activeImportToast.parentNode === container) {
        toast = activeImportToast;
        textSpan = toast.querySelector('.toast-text');
        iconSpan = toast.querySelector('.toast-icon');
        if (textSpan) textSpan.textContent = `Importing ${escapeHtml(playlistName)}... (0/${total})`;
      } else if (container) {
        toast = document.createElement('div');
        toast.className = 'riff-toast info wide';
        toast.innerHTML = `<div class="toast-row info"><span class="toast-icon">${spinnerSvg}</span><span class="toast-text">Importing ${escapeHtml(playlistName)}... (0/${total})</span></div>`;
        container.appendChild(toast);
        textSpan = toast.querySelector('.toast-text');
        iconSpan = toast.querySelector('.toast-icon');
        activeImportToast = toast;
      }
    }

    const chunkSize = 25;
    const converted = [];
    let processed = 0;

    for (let i = 0; i < total; i += chunkSize) {
      const chunk = list.slice(i, i + chunkSize);
      for (const t of chunk) {
        if (!t) continue;
        if (isStaticTikTokTrack(t)) {
          const tid = String(t.id || '').startsWith('tt_') ? String(t.id) : ('tt_' + String(t.id || Date.now()));
          converted.push({
            ...t,
            id: tid,
            isCached: true,
            isTikTok: true,
            staticAudio: true,
            platform: 'tiktok',
            url: 'http://127.0.0.1:' + state.serverPort + '/api/local-track?id=' + encodeURIComponent(cleanTrackId(tid)),
            addedAt: Date.now()
          });
          continue;
        }
        if (!t.title && t.name) t.title = t.name;
        if (!t.artist && t.artists) t.artist = t.artists;
        const title = String(t.title || t.name || '').trim();
        const artist = String(t.artist || t.artists || 'Unknown Artist').trim();
        const thumb = String(
          t.thumbnail || t.cover || t.image || t.artwork ||
          t.album?.images?.[0]?.url || t.albumCover ||
          (t.id && !/^(cand_|dz_|it_|sp_|ym_)/i.test(t.id) ? 'https://i.ytimg.com/vi/' + t.id + '/hqdefault.jpg' : '') ||
          ''
        ).trim();

        const albumArtist = '';
        const album = {};
        const cleanTitleNoFeat = String(t.title || '').replace(/\s*[\(\[]\s*(?:feat\.?|ft\.?|prod\.?|featuring)[^)]*[\)\]]/gi, '').trim();
        const cleanArtistMain = String(t.artist || albumArtist || album.artist || '').split(/[,;&\/]|feat\.?|ft\.?/i)[0].trim();

        const srcPlat = (t.platform === 'youtube' || t.platform === 'ytmusic' || t.platform === 'soundcloud')
          ? t.platform
          : (options.sourcePlatform === 'youtube' || options.sourcePlatform === 'ytmusic' || options.sourcePlatform === 'soundcloud' ? options.sourcePlatform : '');

        if (srcPlat) {
          converted.push({
            id: t.id ? String(t.id) : ('cand_' + Math.random().toString(36).slice(2, 10)),
            title,
            artist,
            duration: Number(t.duration) || 0,
            thumbnail: thumb,
            cover: thumb,
            url: t.url || '',
            searchQuery: `${cleanArtistMain} ${cleanTitleNoFeat}`.trim(),
            platform: srcPlat,
            addedAt: Date.now(),
            isUnavailable: Boolean(t.isUnavailable || t._unavailNotice),
            _unavailNotice: Boolean(t.isUnavailable || t._unavailNotice)
          });
        } else {
          const hasDirectUrl = t.url && /^https?:\/\//i.test(t.url);
          const hasRealId = t.id && !/^(cand_|dz_|it_|sp_|ym_)/i.test(String(t.id)) && hasDirectUrl;
          const spotifyId = /^[A-Za-z0-9]{22}$/.test(String(t.spotifyId || t.id || ''))
            ? String(t.spotifyId || t.id)
            : '';
          converted.push({
            id: hasRealId ? String(t.id) : (spotifyId ? `sp_${spotifyId}` : 'sp_' + Math.random().toString(36).slice(2, 10)),
            spotifyId,
            spotifyUrl: t.spotifyUrl || (spotifyId ? `https://open.spotify.com/track/${spotifyId}` : ''),
            title,
            artist,
            duration: Number(t.duration) || 0,
            thumbnail: thumb,
            cover: thumb,
            url: hasDirectUrl ? t.url : '',
            searchQuery: `${cleanArtistMain} ${cleanTitleNoFeat}`.trim(),
            platform: 'ytmusic',
            addedAt: Date.now(),
            isUnavailable: Boolean(t.isUnavailable || t._unavailNotice),
            _unavailNotice: Boolean(t.isUnavailable || t._unavailNotice)
          });
        }
      }
      processed = Math.min(i + chunkSize, total);
      if (textSpan) {
        textSpan.textContent = `Importing ${playlistName}... (${processed}/${total})`;
      }
      if (typeof onProgress === 'function') {
        onProgress(processed, total);
      }
      if (total > chunkSize) {
        await new Promise(r => setTimeout(r, 0));
      }
    }

    const validTracks = converted.filter(t => t && t.title);
    const failedCount = total - validTracks.length;
    validTracks.failStats = {
      errors: 0,
      nomatch: failedCount,
      commonError: ''
    };

    if (toast && !isSilent) {
      toast.className = 'riff-toast success wide';
      const row = toast.querySelector('.toast-row');
      if (row) row.className = 'toast-row success';
      if (iconSpan) iconSpan.innerHTML = checkmarkSvg;
      if (textSpan) textSpan.textContent = `Imported ${validTracks.length} tracks${failedCount > 0 ? ' (' + failedCount + ' not found)' : ''}`;
      if (activeImportToast === toast) activeImportToast = null;
      setTimeout(() => {
        toast.classList.add('leaving');
        setTimeout(() => { if (toast.parentNode) toast.remove(); }, 320);
      }, 4500);
    }

    return validTracks;
  }

  var spotifyModal = document.getElementById('spotify-import-modal');
  var btnOpenSpotifyImport = document.getElementById('btn-open-spotify-import');
  var btnCancelSpotifyImport = document.getElementById('btn-cancel-spotify-import');
  var btnConfirmSpotifyImport = document.getElementById('btn-confirm-spotify-import');
  var spotifyImportUrl = document.getElementById('spotify-import-url');
  var spotifyImportTarget = document.getElementById('spotify-import-target');
  var spotifyTargetDropdown = document.getElementById('spotify-target-dropdown');
  var spotifyTargetTrigger = document.getElementById('spotify-target-trigger');
  var spotifyTargetLabel = document.getElementById('spotify-target-label');
  var spotifyTargetMenu = document.getElementById('spotify-target-menu');
  var spotifyProgressWrap = document.getElementById('spotify-import-progress-wrap');
  var spotifyWavyContainer = document.getElementById('spotify-import-wavy-container');
  var spotifyProgressLabel = document.getElementById('spotify-import-progress-label');
  var spotifyStatus = document.getElementById('spotify-import-status');
  var spotifyLinkError = document.getElementById('spotify-link-error');
  var spotifyBtnIcon = document.getElementById('spotify-import-btn-icon');
  var spotifyBtnText = document.getElementById('spotify-import-btn-text');

  var spModesContainer = document.getElementById('sp-modes');
  var btnSpPickFiles = document.getElementById('btn-sp-pick-files');
  var spFileInput = document.getElementById('sp-file-input');
  var spFileInfo = document.getElementById('sp-file-info');
  var spChkLikes = document.getElementById('sp-chk-likes');
  var spChkPlaylists = document.getElementById('sp-chk-playlists');
  var spClientIdInput = document.getElementById('sp-client-id');
  var btnSpLogin = document.getElementById('btn-sp-login');
  var spRedirectUri = document.getElementById('sp-redirect-uri');
  var spLoginStatus = document.getElementById('sp-login-status');
  var spChkLikes2 = document.getElementById('sp-chk-likes-2');
  var spChkPlaylists2 = document.getElementById('sp-chk-playlists-2');
  var currentSpotifyImportMode = 'link';
  var parsedSpotifyExport = { likes: [], playlists: [] };
  var spLoginPollTimer = null;
  var spotifyConnected = false;
  var spotifyHeaders = { 'X-Riff-Token': window.electronAPI?.serverToken || '' };

  async function checkSpotifyAuthStatus() {
    try {
      const res = await fetch(`http://127.0.0.1:${state.serverPort}/api/spotify-status`, { headers: spotifyHeaders });
      const data = await res.json();
      spotifyConnected = !!data.connected;
      if (spLoginStatus) {
        if (spotifyConnected) {
          spLoginStatus.textContent = data.error ? `Connected · ${data.error}` : 'Connected';
          spLoginStatus.style.color = 'var(--md-sys-color-primary, #6750A4)';
        } else if (data.error) {
          spLoginStatus.textContent = data.error;
          spLoginStatus.style.color = 'var(--md-sys-color-error, #ba1a1a)';
        } else {
          spLoginStatus.textContent = 'Not connected';
          spLoginStatus.style.color = 'var(--md-sys-color-outline)';
        }
      }
      if (currentSpotifyImportMode === 'login' && btnConfirmSpotifyImport && btnConfirmSpotifyImport.dataset.action !== 'done') {
        btnConfirmSpotifyImport.disabled = !spotifyConnected;
      }
    } catch (e) {}
  }

  function classifyImportError(provider, statusOrError, body) {
    let status = typeof statusOrError === 'number' ? statusOrError : 0;
    let rawMsg = '';
    if (statusOrError instanceof Error) {
      rawMsg = statusOrError.message || String(statusOrError);
    }
    if (typeof body === 'string') {
      rawMsg = rawMsg ? `${rawMsg} ${body}` : body;
    } else if (body && typeof body === 'object') {
      if (body.status && !status) status = Number(body.status);
      if (body.error) rawMsg = rawMsg ? `${rawMsg} ${body.error}` : String(body.error);
    }
    const msg = (rawMsg || '').toLowerCase();

    const lockIcon = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
    const searchIcon = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
    const clockIcon = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
    const networkIcon = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.58 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>`;
    const restrictedIcon = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`;
    const unknownIcon = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;

    if (body && typeof body === 'object') {
      if (body.code === 'spotify_forbidden' || (provider === 'spotify' && status === 403)) {
        return { code: 'spotify_forbidden', title: 'Spotify refused the request from your network (403). Try again later, use a VPN, or use the Export files tab.', hint: '', icon: restrictedIcon };
      }
      if (body.code === 'spotify_rate_limited' || (provider === 'spotify' && status === 429)) {
        return { code: 'spotify_rate_limited', title: 'Spotify is rate limiting requests. Wait a minute and try again.', hint: '', icon: clockIcon };
      }
      if (body.code === 'spotify_not_found' || (provider === 'spotify' && status === 404)) {
        return { code: 'spotify_not_found', title: 'Playlist not found. Is it public?', hint: '', icon: searchIcon };
      }
    }

    if (!navigator.onLine || msg.includes('network') || msg.includes('fetch') || msg.includes('dns') || msg.includes('econnrefused') || msg.includes('timeout') || msg.includes('offline') || msg.includes('etimedout')) {
      return { code: 'network', title: "Can't reach the service", hint: 'Check your connection', icon: networkIcon };
    }
    if (status === 429 || msg.includes('429') || msg.includes('too many requests')) {
      let hint = 'Try again in a minute';
      const mRetry = msg.match(/retry-after:?\s*(\d+)/i) || msg.match(/try again in\s*(\d+)/i);
      if (mRetry) hint = `Try again in ${mRetry[1]}s`;
      return { code: 'rate_limit', title: 'Too many requests', hint, icon: clockIcon };
    }
    if (status === 404 || msg.includes('404') || msg.includes('not found') || msg.includes('deleted') || msg.includes('does not exist') || msg.includes('incomplete youtube id') || msg.includes('unsupported link') || msg.includes('invalid spotify playlist url') || msg.includes('invalid apple music playlist url')) {
      return { code: 'not_found', title: 'Playlist not found', hint: 'Check the link', icon: searchIcon };
    }
    if (msg.includes('private') || msg.includes('isprivate') || msg.includes('sign in') || msg.includes('signin') || status === 401 || (provider !== 'spotify' && (status === 403 || msg.includes('403')))) {
      return { code: 'private', title: 'Your playlist is private', hint: 'Make it public and try again', icon: lockIcon };
    }
    if (status === 403 || msg.includes('403') || msg.includes('forbidden') || msg.includes('restricted') || msg.includes('refused')) {
      return { code: 'restricted', title: "Spotify doesn't allow reading this playlist", hint: 'Try the Export files method', icon: restrictedIcon };
    }
    return { code: 'unknown', title: "Couldn't read this playlist", hint: (provider === 'spotify' || provider === 'apple') ? 'Try the Export files method' : 'Check the link', icon: unknownIcon };
  }

  function showImportError(containerEl, errInfo) {
    if (!containerEl) return;
    containerEl.innerHTML = `
      <div class="import-error-icon">${errInfo.icon}</div>
      <div class="import-error-content">
        <div class="import-error-title">${escapeHtml(errInfo.title)}</div>
        <div class="import-error-hint">${escapeHtml(errInfo.hint)}</div>
      </div>
    `;
    containerEl.classList.remove('hidden');
  }

  function clearImportError(containerEl) {
    if (!containerEl) return;
    containerEl.innerHTML = '';
    containerEl.classList.add('hidden');
  }

  function setSpotifyImportMode(mode) {
    currentSpotifyImportMode = mode || 'link';
    if (spModesContainer) {
      spModesContainer.querySelectorAll('button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === currentSpotifyImportMode);
      });
    }
    clearImportError(spotifyLinkError);
    if (spotifyModal) {
      spotifyModal.querySelectorAll('.sp-pane').forEach(pane => {
        pane.classList.toggle('hidden', pane.dataset.mode !== currentSpotifyImportMode);
      });
    }
    if (spotifyStatus) {
      spotifyStatus.classList.add('hidden');
      spotifyStatus.textContent = '';
      spotifyStatus.style.color = '';
    }
    if (currentSpotifyImportMode === 'login') {
      checkSpotifyAuthStatus();
    } else {
      if (btnConfirmSpotifyImport && btnConfirmSpotifyImport.dataset.action !== 'done') {
        btnConfirmSpotifyImport.disabled = false;
      }
    }
  }

  if (spModesContainer) {
    spModesContainer.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        setSpotifyImportMode(btn.dataset.mode);
      });
    });
  }

  if (spClientIdInput) {
    const savedId = localStorage.getItem('riff_spotify_client_id') || '';
    spClientIdInput.value = savedId;
    if (btnSpLogin) {
      btnSpLogin.disabled = !/^[a-f0-9]{32}$/i.test(savedId.trim());
    }
    spClientIdInput.addEventListener('input', () => {
      const val = spClientIdInput.value.trim();
      localStorage.setItem('riff_spotify_client_id', val);
      if (btnSpLogin) {
        btnSpLogin.disabled = !/^[a-f0-9]{32}$/i.test(val);
      }
    });
  }

  if (btnSpLogin) {
    btnSpLogin.addEventListener('click', async () => {
      const clientId = spClientIdInput ? spClientIdInput.value.trim() : '';
      if (!/^[a-f0-9]{32}$/i.test(clientId)) {
        if (spLoginStatus) {
          spLoginStatus.textContent = 'Invalid Client ID';
          spLoginStatus.style.color = 'var(--md-sys-color-error, #ba1a1a)';
        }
        return;
      }

      if (spLoginStatus) {
        spLoginStatus.textContent = 'Starting login...';
        spLoginStatus.style.color = 'var(--md-sys-color-on-surface-variant)';
      }

      try {
        const res = await fetch(`http://127.0.0.1:${state.serverPort}/api/spotify-auth-start?clientId=${encodeURIComponent(clientId)}`, { headers: spotifyHeaders });
        const data = await res.json();
        if (!data.success) {
          if (spLoginStatus) {
            spLoginStatus.textContent = data.error || 'Failed to start auth';
            spLoginStatus.style.color = 'var(--md-sys-color-error, #ba1a1a)';
          }
          return;
        }

        if (spRedirectUri && data.redirectUri) {
          spRedirectUri.textContent = data.redirectUri;
        }

        if (window.electronAPI && typeof window.electronAPI.openExternal === 'function') {
          window.electronAPI.openExternal(data.url);
        } else {
          window.open(data.url, '_blank');
        }

        if (spLoginStatus) {
          spLoginStatus.textContent = 'Waiting for login in browser...';
          spLoginStatus.style.color = 'var(--md-sys-color-on-surface-variant)';
        }

        if (spLoginPollTimer) clearInterval(spLoginPollTimer);
        let elapsed = 0;
        spLoginPollTimer = setInterval(async () => {
          elapsed += 2000;
          if (elapsed > 180000) {
            clearInterval(spLoginPollTimer);
            spLoginPollTimer = null;
            if (spLoginStatus) {
              spLoginStatus.textContent = 'Login timed out';
              spLoginStatus.style.color = 'var(--md-sys-color-error, #ba1a1a)';
            }
            return;
          }
          try {
            const sRes = await fetch(`http://127.0.0.1:${state.serverPort}/api/spotify-status`, { headers: spotifyHeaders });
            const sData = await sRes.json();
            if (sData.connected) {
              clearInterval(spLoginPollTimer);
              spLoginPollTimer = null;
              spotifyConnected = true;
              if (spLoginStatus) {
                spLoginStatus.textContent = sData.error ? `Connected · ${sData.error}` : 'Connected';
                spLoginStatus.style.color = 'var(--md-sys-color-primary, #6750A4)';
              }
              if (currentSpotifyImportMode === 'login' && btnConfirmSpotifyImport) {
                btnConfirmSpotifyImport.disabled = false;
              }
            } else if (sData.error) {
              clearInterval(spLoginPollTimer);
              spLoginPollTimer = null;
              if (spLoginStatus) {
                spLoginStatus.textContent = sData.error;
                spLoginStatus.style.color = 'var(--md-sys-color-error, #ba1a1a)';
              }
              return;
            }
          } catch (e) {}
        }, 2000);
      } catch (err) {
        if (spLoginStatus) {
          spLoginStatus.textContent = err.message || 'Error connecting to server';
          spLoginStatus.style.color = 'var(--md-sys-color-error, #ba1a1a)';
        }
      }
    });
  }

  if (btnSpPickFiles && spFileInput) {
    btnSpPickFiles.addEventListener('click', () => spFileInput.click());
    spFileInput.addEventListener('change', async () => {
      parsedSpotifyExport = { likes: [], playlists: [] };
      const files = Array.from(spFileInput.files || []);
      if (!files.length) {
        if (spFileInfo) spFileInfo.textContent = 'No files selected';
        return;
      }
      const names = [];
      for (const file of files) {
        names.push(file.name);
        try {
          const text = await file.text();
          const json = JSON.parse(text);
          const rawTracks = Array.isArray(json?.tracks) ? json.tracks : (Array.isArray(json) ? json : null);
          if (rawTracks) {
            for (const item of rawTracks) {
              const title = item.track || item.trackName;
              const artist = item.artist || item.artistName;
              const durMs = item.durationMs || item.duration_ms || item.msPlayed;
              const duration = durMs ? Math.round(durMs / 1000) : undefined;
              if (title && artist) {
                parsedSpotifyExport.likes.push({ title: String(title).trim(), artist: String(artist).trim(), duration });
              }
            }
          }
          const rawPlaylists = Array.isArray(json?.playlists) ? json.playlists : (Array.isArray(json) && json[0]?.items ? json : null);
          if (rawPlaylists) {
            for (const pl of rawPlaylists) {
              const plName = pl.name || 'Imported Playlist';
              const plTracks = [];
              const items = Array.isArray(pl.items) ? pl.items : [];
              for (const it of items) {
                if (!it || !it.track) continue;
                const title = it.track.trackName || it.track.track;
                const artist = it.track.artistName || it.track.artist;
                const durMs = it.track.durationMs || it.track.duration_ms;
                const duration = durMs ? Math.round(durMs / 1000) : undefined;
                if (title && artist) {
                  plTracks.push({ title: String(title).trim(), artist: String(artist).trim(), duration });
                }
              }
              if (plTracks.length) {
                parsedSpotifyExport.playlists.push({ name: plName, tracks: plTracks });
              }
            }
          }
        } catch (e) {}
      }
      if (spFileInfo) spFileInfo.textContent = names.join(', ');
    });
  }

  if (spotifyTargetTrigger && spotifyTargetDropdown) {
    spotifyTargetTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      spotifyTargetDropdown.classList.toggle('open');
    });
    document.addEventListener('click', () => {
      spotifyTargetDropdown.classList.remove('open');
    });
  }

    function attachDropdownSearch(menu) {
    if (!menu || (state.playlists || []).length <= 4) return;
    const searchWrap = document.createElement('div');
    searchWrap.className = 'm3-dropdown-search-wrap';
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'm3-dropdown-search';
    searchInput.placeholder = 'Search playlist...';
    searchInput.autocomplete = 'off';
    searchWrap.appendChild(searchInput);
    searchWrap.addEventListener('click', (e) => e.stopPropagation());
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.toLowerCase().trim();
      menu.querySelectorAll('.m3-dropdown-option').forEach(opt => {
        const match = !q || (opt.textContent || '').toLowerCase().includes(q);
        opt.classList.toggle('hidden', !match);
        opt.style.setProperty('display', match ? 'block' : 'none', 'important');
      });
    });
    menu.prepend(searchWrap);
  }

  function openSpotifyImportModal() {
    if (!spotifyModal) return;
    if (spLoginPollTimer) { clearInterval(spLoginPollTimer); spLoginPollTimer = null; }
    setSpotifyImportMode('link');
    parsedSpotifyExport = { likes: [], playlists: [] };
    if (spFileInput) spFileInput.value = '';
    if (spFileInfo) spFileInfo.textContent = 'No files selected';
    if (spChkLikes) { spChkLikes.checked = true; spChkLikes.disabled = false; }
    if (spChkPlaylists) { spChkPlaylists.checked = true; spChkPlaylists.disabled = false; }
    if (spChkLikes2) { spChkLikes2.checked = true; spChkLikes2.disabled = false; }
    if (spChkPlaylists2) { spChkPlaylists2.checked = true; spChkPlaylists2.disabled = false; }
    if (btnSpPickFiles) btnSpPickFiles.disabled = false;
    const savedId = localStorage.getItem('riff_spotify_client_id') || '';
    if (spClientIdInput) spClientIdInput.value = savedId;
    if (btnSpLogin) btnSpLogin.disabled = !/^[a-f0-9]{32}$/i.test(savedId.trim());
    if (spRedirectUri) spRedirectUri.textContent = `http://127.0.0.1:${state.serverPort || 38472}/api/spotify-callback`;
    if (spotifyImportUrl) {
      spotifyImportUrl.value = '';
      spotifyImportUrl.disabled = false;
    }
    clearImportError(spotifyLinkError);
    if (spotifyTargetTrigger) spotifyTargetTrigger.disabled = false;
    if (spotifyImportTarget) {
      spotifyImportTarget.disabled = false;
      spotifyImportTarget.innerHTML = '<option value="new">New playlist (Spotify name)</option><option value="__favorites__">Add directly to Favorites</option>';
      state.playlists.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `Merge into: ${p.name || 'untitled'}`;
        spotifyImportTarget.appendChild(opt);
      });
      spotifyImportTarget.value = 'new';
    }
    if (spotifyTargetMenu) {
      spotifyTargetMenu.innerHTML = '<button class="m3-dropdown-option selected" data-value="new" type="button">New playlist (Spotify name)</button><button class="m3-dropdown-option" data-value="__favorites__" type="button">Add directly to Favorites</button>';
      if (spotifyTargetLabel) spotifyTargetLabel.textContent = 'New playlist (Spotify name)';
      state.playlists.forEach(p => {
        const opt = document.createElement('button');
        opt.type = 'button';
        opt.className = 'm3-dropdown-option';
        opt.dataset.value = p.id;
        opt.textContent = `Merge into: ${p.name || 'untitled'}`;
        spotifyTargetMenu.appendChild(opt);
      });
      attachDropdownSearch(spotifyTargetMenu);
      spotifyTargetMenu.querySelectorAll('.m3-dropdown-option').forEach(opt => {
        opt.addEventListener('click', (e) => {
          e.stopPropagation();
          const val = opt.dataset.value;
          if (spotifyImportTarget) spotifyImportTarget.value = val;
          if (spotifyTargetLabel) spotifyTargetLabel.textContent = opt.textContent;
          spotifyTargetMenu.querySelectorAll('.m3-dropdown-option').forEach(o => o.classList.remove('selected'));
          opt.classList.add('selected');
          if (spotifyTargetDropdown) spotifyTargetDropdown.classList.remove('open');
        });
      });
    }
    if (spotifyProgressWrap) spotifyProgressWrap.classList.add('hidden');
    if (spotifyWavyContainer) spotifyWavyContainer.innerHTML = '';
    if (spotifyStatus) {
      spotifyStatus.classList.add('hidden');
      spotifyStatus.textContent = '';
      spotifyStatus.style.color = '';
    }
    if (btnConfirmSpotifyImport) {
      btnConfirmSpotifyImport.disabled = false;
      if (spotifyBtnIcon) spotifyBtnIcon.classList.remove('hidden');
      if (spotifyBtnText) spotifyBtnText.textContent = 'Import from Spotify';
      btnConfirmSpotifyImport.dataset.action = 'import';
    }
    if (btnCancelSpotifyImport) btnCancelSpotifyImport.disabled = false;
    openModal(spotifyModal);
    if (spotifyImportUrl) spotifyImportUrl.focus();
  }

  function closeSpotifyImportModal() {
    if (spLoginPollTimer) { clearInterval(spLoginPollTimer); spLoginPollTimer = null; }
    if (spotifyModal) closeModal(spotifyModal);
  }

  async function runSpotifyImport({ likes = [], playlists = [], skippedPlaylists = [] }) {
    const likesToImport = likes || [];
    const playlistsToImport = playlists || [];
    const totalItemsCount = likesToImport.length + playlistsToImport.reduce((acc, p) => acc + (p.tracks ? p.tracks.length : 0), 0);

    if (totalItemsCount === 0) {
      if (spotifyStatus) {
        spotifyStatus.textContent = 'No tracks found to import';
        spotifyStatus.style.color = 'var(--md-sys-color-error, #ba1a1a)';
        spotifyStatus.classList.remove('hidden');
      }
      return;
    }

    closeSpotifyImportModal();
    showImportSpinnerToast('Importing Spotify library...');

    const hasBusy = typeof beginBusy === 'function';
    if (hasBusy) beginBusy('import');

    let globalCompleted = 0;
    let totalFoundCount = 0;
    try {
      if (likesToImport.length > 0) {
        const foundLikes = await matchSpotifyTracks(likesToImport, 'Liked Songs');
        globalCompleted += likesToImport.length;
        totalFoundCount += foundLikes.length;
        let addedFav = false;
        for (const track of foundLikes) {
          if (!state.favorites.some(f => isSameTrack(f, track))) {
            state.favorites.push(stampAddedAt(track));
            addedFav = true;
          }
        }
        if (addedFav) {
          localStorage.setItem('devsize_favorites', JSON.stringify(state.favorites));
          updateFavoritesBadge();
          updateFavoriteIcon();
          if (state.currentView === 'favorites') renderFavoritesView();
          hydrateMissingPlaylistCovers(state.favorites);
        }
      }

      if (playlistsToImport.length > 0) {
        for (const pl of playlistsToImport) {
          const found = await matchSpotifyTracks(pl.tracks || [], pl.name || 'Playlist');
          globalCompleted += (pl.tracks || []).length;
          createPlaylist(pl.name, found, pl.cover || '', {
            importedPlatform: 'spotify',
            importedAt: Date.now()
          });
        }
      }
    } catch (err) {
      dismissImportSpinnerToast();
      showToast(err.message || 'Failed to import tracks', 'error');
    } finally {
      if (btnConfirmSpotifyImport) btnConfirmSpotifyImport.disabled = false;
      if (btnCancelSpotifyImport) btnCancelSpotifyImport.disabled = false;
      if (btnSpPickFiles) btnSpPickFiles.disabled = false;
      if (btnSpLogin && spClientIdInput) btnSpLogin.disabled = !/^[a-f0-9]{32}$/i.test(spClientIdInput.value.trim());
      if (spChkLikes) spChkLikes.disabled = false;
      if (spChkPlaylists) spChkPlaylists.disabled = false;
      if (spChkLikes2) spChkLikes2.disabled = false;
      if (spChkPlaylists2) spChkPlaylists2.disabled = false;
      if (hasBusy && typeof endBusy === 'function') endBusy('import');
    }
  }

  async function handleSpotifyFileImport() {
    const doLikes = !!(spChkLikes && spChkLikes.checked);
    const doPlaylists = !!(spChkPlaylists && spChkPlaylists.checked);

    if (!doLikes && !doPlaylists) {
      if (spotifyStatus) {
        spotifyStatus.textContent = 'Select at least Liked songs or Playlists';
        spotifyStatus.style.color = 'var(--md-sys-color-error, #ba1a1a)';
        spotifyStatus.classList.remove('hidden');
      }
      return;
    }

    const likesToImport = doLikes ? (parsedSpotifyExport.likes || []) : [];
    const playlistsToImport = doPlaylists ? (parsedSpotifyExport.playlists || []) : [];
    if (!likesToImport.length && !playlistsToImport.length) {
      if (spotifyStatus) {
        spotifyStatus.textContent = 'No tracks found in the selected files';
        spotifyStatus.style.color = 'var(--md-sys-color-error, #ba1a1a)';
        spotifyStatus.classList.remove('hidden');
      }
      return;
    }
    await runSpotifyImport({ likes: likesToImport, playlists: playlistsToImport });
  }

  async function handleSpotifyLoginImport() {
    const doLikes = !!(spChkLikes2 && spChkLikes2.checked);
    const doPlaylists = !!(spChkPlaylists2 && spChkPlaylists2.checked);

    if (!doLikes && !doPlaylists) {
      if (spotifyStatus) {
        spotifyStatus.textContent = 'Select at least Liked songs or Playlists';
        spotifyStatus.style.color = 'var(--md-sys-color-error, #ba1a1a)';
        spotifyStatus.classList.remove('hidden');
      }
      return;
    }

    closeSpotifyImportModal();
    showImportSpinnerToast('Fetching Spotify library...');

    try {
      const res = await fetch(`http://127.0.0.1:${state.serverPort}/api/spotify-library?likes=${doLikes ? 1 : 0}&playlists=${doPlaylists ? 1 : 0}`, { headers: spotifyHeaders });
      const data = await res.json();
      if (!data.success) {
        dismissImportSpinnerToast();
        showToast(data.error || 'Failed to fetch Spotify library', 'error');
        return;
      }

      if (!(data.likes?.length || data.playlists?.some(pl => pl.tracks?.length))) {
        dismissImportSpinnerToast();
        showToast('No tracks found in your Spotify library', 'warning');
        return;
      }

      const skippedPlaylists = Array.isArray(data.skippedPlaylists) ? data.skippedPlaylists : [];
      if (skippedPlaylists.length > 0) {
        const skippedDetails = skippedPlaylists
          .map(playlist => `${playlist.name || 'Untitled playlist'}: ${playlist.error || 'Unavailable'}`)
          .join('\n');
        const shouldContinue = window.confirm(
          `Some Spotify playlists could not be loaded:\n\n${skippedDetails}\n\nImport the tracks that are available?`
        );
        if (!shouldContinue) {
          dismissImportSpinnerToast();
          return;
        }
      }

      await runSpotifyImport({ likes: data.likes || [], playlists: data.playlists || [], skippedPlaylists: data.skippedPlaylists || [] });
    } catch (err) {
      dismissImportSpinnerToast();
      showToast(err.message || 'Failed to fetch Spotify library', 'error');
    }
  }

  async function handleSpotifyImportAction() {
    if (currentSpotifyImportMode === 'file') {
      return handleSpotifyFileImport();
    }

    if (currentSpotifyImportMode === 'login') {
      return handleSpotifyLoginImport();
    }

    const url = spotifyImportUrl ? spotifyImportUrl.value.trim() : '';
    if (!url) {
      const errInfo = classifyImportError('spotify', 404, 'invalid spotify playlist url');
      showImportError(spotifyLinkError, errInfo);
      return;
    }

    clearImportError(spotifyLinkError);
    const targetVal = spotifyImportTarget ? spotifyImportTarget.value : 'new';
    const doSync = !!document.getElementById('chk-sp-sync-playlist')?.checked;
    closeSpotifyImportModal();
    showImportSpinnerToast('Importing playlist...');

    try {
      const res = await fetch(`http://127.0.0.1:${state.serverPort}/api/spotify-import?url=${encodeURIComponent(url)}`, { headers: spotifyHeaders });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success || !Array.isArray(data.tracks) || data.tracks.length === 0) {
        dismissImportSpinnerToast();
        const errInfo = classifyImportError('spotify', res.status, data);
        showToast(errInfo.userMessage || 'Failed to import Spotify playlist', 'error');
        return;
      }

      const tracks = data.tracks;
      const foundTracks = await matchSpotifyTracks(tracks, data.name || 'Spotify Playlist', null, { playlistCover: '' });

      if (targetVal === '__favorites__') {
        const existingMap = new Set(state.favorites.map(f => getTrackCanonicalId(f) || f.id));
        const newFavs = foundTracks.filter(t => !existingMap.has(getTrackCanonicalId(t) || t.id));
        state.favorites.push(...newFavs.map(stampAddedAt));
        localStorage.setItem('devsize_favorites', JSON.stringify(state.favorites));
        if (typeof updateFavoritesBadge === 'function') updateFavoritesBadge();
        if (typeof updateFavoriteIcon === 'function') updateFavoriteIcon();
        if (state.currentView === 'favorites' && typeof renderFavoritesView === 'function') renderFavoritesView();
        hydrateMissingPlaylistCovers(state.favorites);
      } else if (targetVal !== 'new' && targetVal !== '__new__') {
        const pl = state.playlists.find(p => p.id === targetVal);
        if (pl) {
          if (!pl.cover && data.cover) pl.cover = data.cover;
          const existingIds = new Set(pl.tracks.map(t => t.id));
          const newTracks = foundTracks.filter(t => !existingIds.has(t.id));
          pl.tracks.push(...newTracks.map(stampAddedAt));
          localStorage.setItem('devsize_playlists', JSON.stringify(state.playlists));
          renderPlaylistsList();
          if (state.currentView === 'playlist-detail' && state.currentPlaylistId === targetVal) {
            openPlaylistDetail(targetVal);
          }
          hydrateMissingPlaylistCovers(pl);
        } else {
          createPlaylist(data.name || 'Spotify Playlist', foundTracks, data.cover || '', {
            syncEnabled: doSync,
            syncUrl: doSync ? url : '',
            syncPlatform: doSync ? 'spotify' : '',
            importedPlatform: 'spotify',
            importedAt: Date.now(),
            lastSyncedAt: Date.now()
          });
        }
      } else {
        createPlaylist(data.name || 'Spotify Playlist', foundTracks, data.cover || '', {
          syncEnabled: doSync,
          syncUrl: doSync ? url : '',
          syncPlatform: doSync ? 'spotify' : '',
          importedPlatform: 'spotify',
          importedAt: Date.now(),
          lastSyncedAt: Date.now()
        });
      }
    } catch (err) {
      dismissImportSpinnerToast();
      const errInfo = classifyImportError('spotify', err, err.message);
      showToast(errInfo.userMessage || 'Failed to import Spotify playlist', 'error');
    }
  }

  if (btnOpenSpotifyImport) btnOpenSpotifyImport.addEventListener('click', openSpotifyImportModal);
  var btnCpmSpotify = document.getElementById('btn-cpm-spotify');
  if (btnCpmSpotify) btnCpmSpotify.addEventListener('click', () => {
    document.getElementById('create-playlist-modal')?.classList.add('hidden');
    openSpotifyImportModal();
    const card = document.querySelector('#spotify-import-modal .dialog-card');
    if (card) {
      card.classList.remove('cpm-slide-from-right');
      void card.offsetWidth;
      card.classList.add('cpm-slide-from-right');
      setTimeout(() => card.classList.remove('cpm-slide-from-right'), 250);
    }
  });
  var btnCpmApple = document.getElementById('btn-cpm-apple');
  if (btnCpmApple) btnCpmApple.addEventListener('click', () => {
    document.getElementById('create-playlist-modal')?.classList.add('hidden');
    openAppleImportModal();
    const card = document.querySelector('#apple-import-modal .dialog-card');
    if (card) {
      card.classList.remove('cpm-slide-from-right');
      void card.offsetWidth;
      card.classList.add('cpm-slide-from-right');
      setTimeout(() => card.classList.remove('cpm-slide-from-right'), 250);
    }
  });
  if (btnCancelSpotifyImport) btnCancelSpotifyImport.addEventListener('click', closeSpotifyImportModal);
  if (btnConfirmSpotifyImport) btnConfirmSpotifyImport.addEventListener('click', handleSpotifyImportAction);
  if (spotifyImportUrl) {
    spotifyImportUrl.addEventListener('input', () => clearImportError(spotifyLinkError));
    spotifyImportUrl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSpotifyImportAction();
      }
    });
  }

  var appleModal = document.getElementById('apple-import-modal');

  var btnOpenAppleImport = document.getElementById('btn-open-apple-import');
  var btnCancelAppleImport = document.getElementById('btn-cancel-apple-import');
  var btnConfirmAppleImport = document.getElementById('btn-confirm-apple-import');
  var appleImportUrl = document.getElementById('apple-import-url');
  var appleLinkError = document.getElementById('apple-link-error');
  var appleImportTarget = document.getElementById('apple-import-target');
  var appleTargetDropdown = document.getElementById('apple-target-dropdown');
  var appleTargetTrigger = document.getElementById('apple-target-trigger');
  var appleTargetLabel = document.getElementById('apple-target-label');
  var appleTargetMenu = document.getElementById('apple-target-menu');
  var appleModesContainer = document.getElementById('apple-modes');
  var btnApplePickFiles = document.getElementById('btn-apple-pick-files');
  var appleFileInput = document.getElementById('apple-file-input');
  var appleFileInfo = document.getElementById('apple-file-info');
  var appleChkContainer = document.getElementById('apple-chk-container');
  var appleChkLikes = document.getElementById('apple-chk-likes');
  var appleChkPlaylists = document.getElementById('apple-chk-playlists');
  var appleFileSummary = document.getElementById('apple-file-summary');
  var appleProgressWrap = document.getElementById('apple-import-progress-wrap');
  var appleWavyContainer = document.getElementById('apple-import-wavy-container');
  var appleProgressLabel = document.getElementById('apple-import-progress-label');
  var appleStatus = document.getElementById('apple-import-status');
  var appleBtnIcon = document.getElementById('apple-import-btn-icon');
  var appleBtnText = document.getElementById('apple-import-btn-text');

  var currentAppleImportMode = 'link';
  var parsedAppleExport = { likes: [], playlists: [] };

  function parseAppleDuration(val) {
    if (val == null) return undefined;
    const s = String(val).trim();
    if (!s) return undefined;
    if (s.includes(':')) {
      const parts = s.split(':').map(Number);
      if (parts.some(isNaN)) return undefined;
      if (parts.length === 2) return parts[0] * 60 + parts[1];
      if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    const n = Number(s);
    if (!isNaN(n)) return n > 1000 ? Math.round(n / 1000) : Math.round(n);
    return undefined;
  }

  function parseAppleCSV(text) {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (!lines.length) return { headers: [], rows: [] };
    const delim = lines[0].includes('\t') ? '\t' : (lines[0].includes(';') && !lines[0].includes(',') ? ';' : ',');
    function splitRow(row) {
      const res = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < row.length; i++) {
        const c = row[i];
        if (c === '"') {
          if (inQuotes && row[i + 1] === '"') { cur += '"'; i++; }
          else inQuotes = !inQuotes;
        } else if (c === delim && !inQuotes) {
          res.push(cur.trim());
          cur = '';
        } else cur += c;
      }
      res.push(cur.trim());
      return res;
    }
    const headers = splitRow(lines[0]).map(h => h.toLowerCase().replace(/['"]/g, ''));
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = splitRow(lines[i]);
      const row = {};
      for (let j = 0; j < headers.length; j++) row[headers[j]] = cols[j] || '';
      rows.push(row);
    }
    return { headers, rows };
  }

  function parseAppleExportCSV(text) {
    const { headers, rows } = parseAppleCSV(text);
    const titleCol = headers.find(h => /^(title|name|track\s*name|song(\s*name)?|track\s*description)$/i.test(h)) || headers.find(h => /(title|song|track)/i.test(h));
    const artistCol = headers.find(h => /^(artist(\s*name)?|artist\(s\)|creator|uploader)$/i.test(h)) || headers.find(h => /artist/i.test(h));
    const durCol = headers.find(h => /(duration|time|length)/i.test(h));
    const plCol = headers.find(h => /(playlist(\s*name)?|container(\s*description|\s*name)?)/i.test(h));

    const likes = [];
    const playlistsMap = new Map();

    for (const r of rows) {
      const title = titleCol ? r[titleCol] : '';
      const artist = artistCol ? r[artistCol] : '';
      if (!title || !artist) continue;
      const dur = durCol ? parseAppleDuration(r[durCol]) : undefined;
      const pl = plCol ? r[plCol].trim() : '';
      const track = { title: title.trim(), artist: artist.trim(), duration: dur };
      if (pl) {
        if (!playlistsMap.has(pl)) playlistsMap.set(pl, []);
        playlistsMap.get(pl).push(track);
      } else {
        likes.push(track);
      }
    }
    const playlists = [];
    for (const [name, tracks] of playlistsMap.entries()) playlists.push({ name, tracks });
    return { likes, playlists };
  }

  function parseAppleExportJSON(json) {
    const likes = [];
    const playlistsMap = new Map();

    function walk(node, currentPl = '') {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) {
        for (const item of node) walk(item, currentPl);
        return;
      }

      let pl = currentPl;
      if (node.playlistName || node.playlist || node['playlist name']) {
        pl = node.playlistName || node.playlist || node['playlist name'];
      }

      if (Array.isArray(node.tracks) && (node.name || node.title)) {
        const pName = node.name || node.title;
        for (const t of node.tracks) walk(t, pName);
        return;
      }
      if (Array.isArray(node.items) && (node.name || node.title)) {
        const pName = node.name || node.title;
        for (const t of node.items) walk(t, pName);
        return;
      }

      const title = String(node.title || node.name || node.trackName || node.song || node['track name'] || node['song name'] || '').trim();
      const artist = String(node.artistName || node.artist || node.artist_name || node['artist name'] || '').trim();
      const durRaw = node.durationInMillis || node.duration || node.duration_ms || node.time || node.trackDuration;
      const duration = parseAppleDuration(durRaw);

      if (title && artist && (node.type === 'song' || node.type === 'songs' || duration || pl || node.contentDescriptor)) {
        const track = { title, artist, duration };
        if (pl) {
          if (!playlistsMap.has(pl)) playlistsMap.set(pl, []);
          playlistsMap.get(pl).push(track);
        } else {
          likes.push(track);
        }
        return;
      }

      for (const k of Object.keys(node)) {
        walk(node[k], pl);
      }
    }

    walk(json);
    const playlists = [];
    for (const [name, tracks] of playlistsMap.entries()) playlists.push({ name, tracks });
    return { likes, playlists };
  }

  function setAppleImportMode(mode) {
    currentAppleImportMode = mode || 'link';
    if (appleModesContainer) {
      appleModesContainer.querySelectorAll('button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === currentAppleImportMode);
      });
    }
    clearImportError(appleLinkError);
    if (appleModal) {
      appleModal.querySelectorAll('.sp-pane').forEach(pane => {
        pane.classList.toggle('hidden', pane.dataset.mode !== currentAppleImportMode);
      });
    }
    if (appleStatus) {
      appleStatus.classList.add('hidden');
      appleStatus.textContent = '';
      appleStatus.style.color = '';
    }
    if (btnConfirmAppleImport && btnConfirmAppleImport.dataset.action !== 'done') {
      btnConfirmAppleImport.disabled = false;
    }
  }

  if (appleModesContainer) {
    appleModesContainer.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        setAppleImportMode(btn.dataset.mode);
      });
    });
  }

  if (btnApplePickFiles && appleFileInput) {
    btnApplePickFiles.addEventListener('click', () => {
      appleFileInput.click();
    });

    appleFileInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      parsedAppleExport = { likes: [], playlists: [] };
      const names = [];
      for (const file of files) {
        names.push(file.name);
        try {
          const text = await file.text();
          if (file.name.toLowerCase().endsWith('.json')) {
            const json = JSON.parse(text);
            const res = parseAppleExportJSON(json);
            parsedAppleExport.likes.push(...res.likes);
            parsedAppleExport.playlists.push(...res.playlists);
          } else {
            const res = parseAppleExportCSV(text);
            parsedAppleExport.likes.push(...res.likes);
            parsedAppleExport.playlists.push(...res.playlists);
          }
        } catch (err) {}
      }
      if (appleFileInfo) appleFileInfo.textContent = names.join(', ');

      const hasLikes = parsedAppleExport.likes.length > 0;
      const hasPlaylists = parsedAppleExport.playlists.length > 0;

      if (hasLikes && hasPlaylists) {
        if (appleChkContainer) appleChkContainer.classList.remove('hidden');
        if (appleChkLikes) { appleChkLikes.checked = true; appleChkLikes.disabled = false; }
        if (appleChkPlaylists) { appleChkPlaylists.checked = true; appleChkPlaylists.disabled = false; }
        if (appleFileSummary) {
          appleFileSummary.classList.remove('hidden');
          appleFileSummary.textContent = `Found ${parsedAppleExport.likes.length} liked songs and ${parsedAppleExport.playlists.length} playlists`;
        }
      } else {
        if (appleChkContainer) appleChkContainer.classList.add('hidden');
        if (appleFileSummary) {
          appleFileSummary.classList.remove('hidden');
          if (hasPlaylists) {
            const totalTracks = parsedAppleExport.playlists.reduce((acc, p) => acc + (p.tracks ? p.tracks.length : 0), 0);
            appleFileSummary.textContent = `Found ${parsedAppleExport.playlists.length} playlists (${totalTracks} tracks)`;
          } else if (hasLikes) {
            appleFileSummary.textContent = `Found ${parsedAppleExport.likes.length} liked tracks`;
          } else {
            appleFileSummary.textContent = 'No tracks found in selected files';
          }
        }
      }
    });
  }

  if (appleTargetTrigger && appleTargetDropdown) {
    appleTargetTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      appleTargetDropdown.classList.toggle('open');
    });
    document.addEventListener('click', () => {
      appleTargetDropdown.classList.remove('open');
    });
  }

  function openAppleImportModal() {
    if (!appleModal) return;
    setAppleImportMode('link');
    parsedAppleExport = { likes: [], playlists: [] };
    if (appleFileInput) appleFileInput.value = '';
    if (appleFileInfo) appleFileInfo.textContent = 'No files selected';
    if (appleChkContainer) appleChkContainer.classList.add('hidden');
    if (appleChkLikes) { appleChkLikes.checked = true; appleChkLikes.disabled = false; }
    if (appleChkPlaylists) { appleChkPlaylists.checked = true; appleChkPlaylists.disabled = false; }
    if (appleFileSummary) { appleFileSummary.classList.add('hidden'); appleFileSummary.textContent = ''; }
    if (btnApplePickFiles) btnApplePickFiles.disabled = false;
    if (appleImportUrl) {
      appleImportUrl.value = '';
      appleImportUrl.disabled = false;
    }
    clearImportError(appleLinkError);
    if (appleTargetTrigger) appleTargetTrigger.disabled = false;
    if (appleImportTarget) {
      appleImportTarget.disabled = false;
      appleImportTarget.innerHTML = '<option value="new">New playlist (Apple Music name)</option>';
      state.playlists.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        appleImportTarget.appendChild(opt);
      });
      appleImportTarget.value = 'new';
    }
    if (appleTargetMenu) {
      appleTargetMenu.innerHTML = '<button class="m3-dropdown-option selected" data-value="new" type="button">New playlist (Apple Music name)</button>';
      if (appleTargetLabel) appleTargetLabel.textContent = 'New playlist (Apple Music name)';
      state.playlists.forEach(p => {
        const opt = document.createElement('button');
        opt.type = 'button';
        opt.className = 'm3-dropdown-option';
        opt.dataset.value = p.id;
        opt.textContent = p.name || 'untitled';
        appleTargetMenu.appendChild(opt);
      });
      attachDropdownSearch(appleTargetMenu);
      appleTargetMenu.querySelectorAll('.m3-dropdown-option').forEach(opt => {
        opt.addEventListener('click', (e) => {
          e.stopPropagation();
          const val = opt.dataset.value;
          if (appleImportTarget) appleImportTarget.value = val;
          if (appleTargetLabel) appleTargetLabel.textContent = opt.textContent;
          appleTargetMenu.querySelectorAll('.m3-dropdown-option').forEach(o => o.classList.remove('selected'));
          opt.classList.add('selected');
          if (appleTargetDropdown) appleTargetDropdown.classList.remove('open');
        });
      });
    }
    if (appleProgressWrap) appleProgressWrap.classList.add('hidden');
    if (appleWavyContainer) appleWavyContainer.innerHTML = '';
    if (appleStatus) {
      appleStatus.classList.add('hidden');
      appleStatus.textContent = '';
      appleStatus.style.color = '';
    }
    if (btnConfirmAppleImport) {
      btnConfirmAppleImport.disabled = false;
      if (appleBtnIcon) appleBtnIcon.classList.remove('hidden');
      if (appleBtnText) appleBtnText.textContent = 'Import from Apple Music';
      btnConfirmAppleImport.dataset.action = 'import';
    }
    if (btnCancelAppleImport) btnCancelAppleImport.disabled = false;
    openModal(appleModal);
    if (appleImportUrl) appleImportUrl.focus();
  }

  function closeAppleImportModal() {
    if (appleModal) closeModal(appleModal);
  }

  async function handleAppleImportAction() {
    if (currentAppleImportMode === 'file') {
      const hasLikes = parsedAppleExport.likes.length > 0;
      const hasPlaylists = parsedAppleExport.playlists.length > 0;
      let likesToImport = [];
      let playlistsToImport = [];

      if (hasLikes && hasPlaylists) {
        if (appleChkLikes && appleChkLikes.checked) likesToImport = parsedAppleExport.likes;
        if (appleChkPlaylists && appleChkPlaylists.checked) playlistsToImport = parsedAppleExport.playlists;
      } else if (hasPlaylists) {
        playlistsToImport = parsedAppleExport.playlists;
      } else if (hasLikes) {
        likesToImport = parsedAppleExport.likes;
      }

      const totalItemsCount = likesToImport.length + playlistsToImport.reduce((acc, p) => acc + (p.tracks ? p.tracks.length : 0), 0);
      if (totalItemsCount === 0) {
        if (appleStatus) {
          appleStatus.textContent = 'No tracks selected or found to import';
          appleStatus.style.color = 'var(--md-sys-color-error, #ba1a1a)';
          appleStatus.classList.remove('hidden');
        }
        return;
      }

      closeAppleImportModal();
      showImportSpinnerToast('Importing Apple Music files...');

      const hasBusy = typeof beginBusy === 'function';
      if (hasBusy) beginBusy('import');

      try {
        if (likesToImport.length > 0) {
          const foundLikes = await matchSpotifyTracks(likesToImport, 'Liked Songs');
          let addedFav = false;
          for (const track of foundLikes) {
            if (!state.favorites.some(f => isSameTrack(f, track))) {
              state.favorites.push(stampAddedAt(track));
              addedFav = true;
            }
          }
          if (addedFav) {
            localStorage.setItem('devsize_favorites', JSON.stringify(state.favorites));
            updateFavoritesBadge();
            updateFavoriteIcon();
            if (state.currentView === 'favorites') renderFavoritesView();
            hydrateMissingPlaylistCovers(state.favorites);
          }
        }

          for (const pl of playlistsToImport) {
            const found = await matchSpotifyTracks(pl.tracks || [], pl.name || 'Playlist');
            createPlaylist(pl.name, found, pl.cover || '', {
              importedPlatform: 'apple',
              importedAt: Date.now()
            });
          }
      } catch (err) {
        dismissImportSpinnerToast();
        showToast(err.message || 'Failed to import tracks', 'error');
      } finally {
        if (btnConfirmAppleImport) btnConfirmAppleImport.disabled = false;
        if (btnCancelAppleImport) btnCancelAppleImport.disabled = false;
        if (btnApplePickFiles) btnApplePickFiles.disabled = false;
        if (appleChkLikes) appleChkLikes.disabled = false;
        if (appleChkPlaylists) appleChkPlaylists.disabled = false;
        if (hasBusy && typeof endBusy === 'function') endBusy('import');
      }
      return;
    }

    const url = appleImportUrl ? appleImportUrl.value.trim() : '';
    if (!url) {
      const errInfo = classifyImportError('apple', 404, 'invalid apple music playlist url');
      showImportError(appleLinkError, errInfo);
      return;
    }

    clearImportError(appleLinkError);
    const targetVal = appleImportTarget ? appleImportTarget.value : 'new';
    closeAppleImportModal();
    showImportSpinnerToast('Importing playlist...');

    try {
      const res = await fetch(`http://127.0.0.1:${state.serverPort}/api/apple-import?url=${encodeURIComponent(url)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success || !Array.isArray(data.tracks) || data.tracks.length === 0) {
        dismissImportSpinnerToast();
        const errInfo = classifyImportError('apple', res.status, data);
        showToast(errInfo.userMessage || 'Failed to import Apple Music playlist', 'error');
        return;
      }

      const tracks = data.tracks;
      const foundTracks = await matchSpotifyTracks(tracks, data.name || 'Apple Music Playlist', null, { playlistCover: '' });

      if (targetVal === 'new') {
        createPlaylist(data.name || 'Apple Music Playlist', foundTracks, data.cover || '', {
          syncUrl: url,
          syncPlatform: 'apple',
          importedPlatform: 'apple',
          importedAt: Date.now()
        });
      } else {
        const pl = state.playlists.find(p => p.id === targetVal);
        if (pl) {
          if (!pl.cover && data.cover) pl.cover = data.cover;
          const existingIds = new Set(pl.tracks.map(t => t.id));
          const newTracks = foundTracks.filter(t => !existingIds.has(t.id));
          pl.tracks.push(...newTracks.map(stampAddedAt));
          localStorage.setItem('devsize_playlists', JSON.stringify(state.playlists));
          renderPlaylistsList();
          hydrateMissingPlaylistCovers(pl);
        }
      }
    } catch (err) {
      dismissImportSpinnerToast();
      const errInfo = classifyImportError('apple', err, err.message);
      showToast(errInfo.userMessage || 'Failed to import Apple Music playlist', 'error');
    }
  }

  if (btnOpenAppleImport) btnOpenAppleImport.addEventListener('click', openAppleImportModal);
  if (btnCancelAppleImport) btnCancelAppleImport.addEventListener('click', closeAppleImportModal);
  if (btnConfirmAppleImport) btnConfirmAppleImport.addEventListener('click', handleAppleImportAction);
  if (appleImportUrl) {
    appleImportUrl.addEventListener('input', () => clearImportError(appleLinkError));
    appleImportUrl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAppleImportAction();
      }
    });
  }


  var linkImportModal = document.getElementById('link-import-modal');
  var btnOpenLinkImport = document.getElementById('btn-open-link-import');
  var btnCancelLinkImport = document.getElementById('btn-cancel-link-import');
  var btnConfirmLinkImport = document.getElementById('btn-confirm-link-import');
  var linkImportUrl = document.getElementById('link-import-url');
  var linkImportStatus = document.getElementById('link-import-status');
  var linkImportError = document.getElementById('link-import-error');

  var googleConnected = false;
  var googleUser = null;
  var currentLinkImportMode = 'link';
  var currentLinkImportPlatform = 'youtube';

  var linkModesContainer = document.getElementById('link-modes');
  var btnGoogleLogin = document.getElementById('btn-google-login');
  var btnGoogleLogout = document.getElementById('btn-google-logout');
  var googleLoginStatus = document.getElementById('google-login-status');
  var googleChkLikes = document.getElementById('google-chk-likes');
  var googleChkPlaylists = document.getElementById('google-chk-playlists');
  var linkImportProgressWrap = document.getElementById('link-import-progress-wrap');
  var linkImportProgressLabel = document.getElementById('link-import-progress-label');
  var linkImportWavyContainer = document.getElementById('link-import-wavy-container');
  var linkImportBtnText = document.getElementById('link-import-btn-text');

  async function checkGoogleAuthStatus() {
    try {
      if (window.electronAPI && window.electronAPI.googleAuthStatus) {
        const res = await window.electronAPI.googleAuthStatus();
        googleConnected = !!(res && res.loggedIn);
        googleUser = (res && res.user) ? res.user : null;
      } else {
        googleConnected = false;
        googleUser = null;
      }
    } catch (e) {
      googleConnected = false;
      googleUser = null;
    }
    updateGoogleAuthUI();
  }

  function openGoogleLoginFallback() {
    const url = 'https://accounts.google.com/ServiceLogin?service=youtube';
    if (window.electronAPI && typeof window.electronAPI.openExternal === 'function') {
      window.electronAPI.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  }

  function ensureGoogleLoginFallbackButtons() {
    let btnGoogleFallback = document.getElementById('btn-google-fallback-login');
    if (!btnGoogleFallback && btnGoogleLogin && btnGoogleLogin.parentNode) {
      btnGoogleFallback = document.createElement('button');
      btnGoogleFallback.type = 'button';
      btnGoogleFallback.id = 'btn-google-fallback-login';
      btnGoogleFallback.className = 'btn-outline-pill hidden';
      btnGoogleFallback.textContent = 'Open in browser';
      btnGoogleFallback.title = 'Open Google sign-in in your default browser';
      btnGoogleFallback.addEventListener('click', () => {
        openGoogleLoginFallback();
        showToast('Opened Google sign-in in browser.', 'info');
      });
      btnGoogleLogin.parentNode.insertBefore(btnGoogleFallback, googleLoginStatus);
    }

    let btnAdvYtFallback = document.getElementById('btn-adv-yt-fallback-login');
    const advLogin = document.getElementById('btn-adv-yt-login');
    if (!btnAdvYtFallback && advLogin && advLogin.parentNode) {
      btnAdvYtFallback = document.createElement('button');
      btnAdvYtFallback.type = 'button';
      btnAdvYtFallback.id = 'btn-adv-yt-fallback-login';
      btnAdvYtFallback.className = 'btn-outline-pill hidden';
      btnAdvYtFallback.style.height = '32px';
      btnAdvYtFallback.style.padding = '0 12px';
      btnAdvYtFallback.style.fontSize = '12.5px';
      btnAdvYtFallback.textContent = 'Open in browser';
      btnAdvYtFallback.title = 'Open Google sign-in in your default browser';
      btnAdvYtFallback.addEventListener('click', () => {
        openGoogleLoginFallback();
        showToast('Opened Google sign-in in browser.', 'info');
      });
      advLogin.parentNode.appendChild(btnAdvYtFallback);
    }

    let btnYtPlaybackFallback = document.getElementById('btn-yt-playback-fallback-login');
    if (!btnYtPlaybackFallback && btnYoutubePlaybackLogin && btnYoutubePlaybackLogin.parentNode) {
      btnYtPlaybackFallback = document.createElement('button');
      btnYtPlaybackFallback.type = 'button';
      btnYtPlaybackFallback.id = 'btn-yt-playback-fallback-login';
      btnYtPlaybackFallback.className = 'btn-outline-pill hidden';
      btnYtPlaybackFallback.textContent = 'Open in browser';
      btnYtPlaybackFallback.title = 'Open Google sign-in in your default browser';
      btnYtPlaybackFallback.addEventListener('click', () => {
        openGoogleLoginFallback();
        showToast('Opened Google sign-in in browser.', 'info');
      });
      btnYoutubePlaybackLogin.parentNode.appendChild(btnYtPlaybackFallback);
    }
  }

  function updateGoogleAuthUI() {
    ensureGoogleLoginFallbackButtons();
    const btnGoogleFallback = document.getElementById('btn-google-fallback-login');
    const btnAdvYtFallback = document.getElementById('btn-adv-yt-fallback-login');
    if (googleConnected) {
      if (btnGoogleFallback) btnGoogleFallback.classList.add('hidden');
      if (btnAdvYtFallback) btnAdvYtFallback.classList.add('hidden');
    }
    if (googleLoginStatus) {
      if (googleConnected) {
        const u = googleUser;
        const avatar = u ? (u.avatar || u.avatarUrl) : '';
        const name = u ? (u.name || u.handle) : '';
        const handle = u && u.handle && u.name && u.handle !== u.name ? u.handle : '';
        if (name) {
          googleLoginStatus.innerHTML = `
            <span class="yt-auth-user-badge">
              ${avatar ? `<img class="yt-auth-avatar" src="${escapeHtml(avatar)}" alt="" onerror="this.style.display='none'">` : ''}
              <span class="yt-auth-user-text">
                <span class="yt-auth-user-name">${escapeHtml(name)}</span>
                ${handle ? `<span class="yt-auth-user-handle">${escapeHtml(handle)}</span>` : ''}
              </span>
            </span>
          `;
          googleLoginStatus.style.color = 'var(--md-sys-color-primary, #6750A4)';
        } else {
          googleLoginStatus.textContent = 'Connected';
          googleLoginStatus.style.color = 'var(--md-sys-color-primary, #6750A4)';
        }
      } else {
        googleLoginStatus.textContent = 'Not connected';
        googleLoginStatus.style.color = 'var(--md-sys-color-outline)';
      }
    }
    if (btnGoogleLogin) {
      btnGoogleLogin.textContent = googleConnected ? 'Switch account' : 'Log in with Google';
    }
    if (btnGoogleLogout) {
      btnGoogleLogout.classList.toggle('hidden', !googleConnected);
    }
    if (currentLinkImportMode === 'login' && btnConfirmLinkImport && btnConfirmLinkImport.dataset.action !== 'done') {
      btnConfirmLinkImport.disabled = !googleConnected;
    }
    const advStatus = document.getElementById('adv-yt-auth-status');
    const btnAdvLogin = document.getElementById('btn-adv-yt-login');
    const btnAdvLogout = document.getElementById('btn-adv-yt-logout');
    if (advStatus) {
      if (googleConnected) {
        const u = googleUser;
        const avatar = u ? (u.avatar || u.avatarUrl) : '';
        const name = u ? (u.name || u.handle) : '';
        const handle = u && u.handle && u.name && u.handle !== u.name ? u.handle : '';
        if (name) {
          advStatus.innerHTML = `
            <span class="yt-auth-user-badge">
              ${avatar ? `<img class="yt-auth-avatar" src="${escapeHtml(avatar)}" alt="" onerror="this.style.display='none'">` : ''}
              <span class="yt-auth-user-text">
                <span>Connected as <strong style="color: var(--md-sys-color-primary);">${escapeHtml(name)}</strong>${handle ? ` (${escapeHtml(handle)})` : ''}</span>
              </span>
            </span>
          `;
          advStatus.style.color = 'var(--md-sys-color-primary)';
        } else {
          advStatus.textContent = 'Connected to import your YouTube library';
          advStatus.style.color = 'var(--md-sys-color-primary)';
        }
      } else {
        advStatus.textContent = 'Sign in to import your YouTube library';
        advStatus.style.color = '';
      }
    }
    if (btnAdvLogin) {
      btnAdvLogin.textContent = googleConnected ? 'Switch account' : 'Sign in';
    }
    if (btnAdvLogout) {
      btnAdvLogout.classList.toggle('hidden', !googleConnected);
    }
  }

  var btnYoutubePlaybackLogin = document.getElementById('btn-yt-playback-login');
  var btnYoutubePlaybackLogout = document.getElementById('btn-yt-playback-logout');
  var youtubePlaybackAuthStatus = document.getElementById('yt-playback-auth-status');

  function updateYoutubePlaybackAuthUI(loggedIn) {
    ensureGoogleLoginFallbackButtons();
    const btnYtPlaybackFallback = document.getElementById('btn-yt-playback-fallback-login');
    if (loggedIn && btnYtPlaybackFallback) {
      btnYtPlaybackFallback.classList.add('hidden');
    }
    if (youtubePlaybackAuthStatus) {
      youtubePlaybackAuthStatus.textContent = loggedIn
        ? 'YouTube session saved locally'
        : 'Sign in to reduce YouTube stream delays';
      youtubePlaybackAuthStatus.style.color = loggedIn ? 'var(--md-sys-color-primary)' : '';
    }
    if (btnYoutubePlaybackLogin) btnYoutubePlaybackLogin.classList.toggle('hidden', !!loggedIn);
    if (btnYoutubePlaybackLogout) btnYoutubePlaybackLogout.classList.toggle('hidden', !loggedIn);
  }

  async function checkYoutubePlaybackAuthStatus() {
    if (!window.electronAPI || !window.electronAPI.youtubePlaybackStatus) return;
    try {
      const result = await window.electronAPI.youtubePlaybackStatus();
      updateYoutubePlaybackAuthUI(!!(result && result.loggedIn));
    } catch (error) {
      showToast(`Could not check YouTube playback sign-in: ${error.message || error}`, 'error');
    }
  }

  if (window.electronAPI && window.electronAPI.onYoutubePlaybackAuth) {
    window.electronAPI.onYoutubePlaybackAuth((result) => {
      const loggedIn = !!(result && result.success && result.loggedIn);
      updateYoutubePlaybackAuthUI(loggedIn);
      checkGoogleAuthStatus();
      if (loggedIn) showToast('YouTube playback sign-in saved.', 'success');
      else showToast((result && result.error) || 'YouTube playback sign-in was not completed.', 'error');
    });
  }
  checkYoutubePlaybackAuthStatus();

  function setLinkImportMode(mode) {
    currentLinkImportMode = mode || 'link';
    if (linkModesContainer) {
      linkModesContainer.querySelectorAll('button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === currentLinkImportMode);
      });
    }
    clearImportError(linkImportError);
    if (linkImportModal) {
      linkImportModal.querySelectorAll('.link-pane').forEach(pane => {
        pane.classList.toggle('hidden', pane.dataset.mode !== currentLinkImportMode);
      });
    }
    if (linkImportStatus) {
      linkImportStatus.classList.add('hidden');
      linkImportStatus.textContent = '';
      linkImportStatus.style.color = '';
    }
    if (btnConfirmLinkImport && btnConfirmLinkImport.dataset.action !== 'done') {
      btnConfirmLinkImport.disabled = currentLinkImportMode === 'login' ? !googleConnected : false;
      if (linkImportBtnText) linkImportBtnText.textContent = 'Import';
    }
    if (currentLinkImportMode === 'login') {
      checkGoogleAuthStatus();
    }
  }

  function populateTargetDropdown(selectId, triggerId, dropdownId, menuId, labelId, defaultText, initialOptions = [{ value: 'new', label: defaultText }], playlistLabel = playlist => playlist.name || 'untitled') {
    const sel = document.getElementById(selectId);
    const trig = document.getElementById(triggerId);
    const drop = document.getElementById(dropdownId);
    const menu = document.getElementById(menuId);
    const lbl = document.getElementById(labelId);
    if (!sel || !menu) return;

    sel.innerHTML = '';
    menu.innerHTML = '';
    initialOptions.forEach((option, index) => {
      const selectOption = document.createElement('option');
      selectOption.value = option.value;
      selectOption.textContent = option.label;
      sel.appendChild(selectOption);

      const menuOption = document.createElement('button');
      menuOption.type = 'button';
      menuOption.className = `m3-dropdown-option${index === 0 ? ' selected' : ''}`;
      menuOption.dataset.value = option.value;
      menuOption.textContent = option.label;
      menuOption.setAttribute('role', 'option');
      menuOption.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
      menu.appendChild(menuOption);
    });
    if (lbl) lbl.textContent = initialOptions[0].label;
    if (trig) trig.setAttribute('aria-expanded', 'false');

    (state.playlists || []).forEach(p => {
      const label = playlistLabel(p);
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = label;
      sel.appendChild(opt);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'm3-dropdown-option';
      btn.dataset.value = p.id;
      btn.textContent = label;
      btn.setAttribute('role', 'option');
      btn.setAttribute('aria-selected', 'false');
      menu.appendChild(btn);
    });
    attachDropdownSearch(menu);

    if (trig && drop && !trig._dropdownBound) {
      trig._dropdownBound = true;
      trig.addEventListener('click', (e) => {
        e.stopPropagation();
        drop.classList.toggle('open');
        trig.setAttribute('aria-expanded', drop.classList.contains('open') ? 'true' : 'false');
      });
      document.addEventListener('click', () => {
        drop.classList.remove('open');
        trig.setAttribute('aria-expanded', 'false');
      });
    }

    menu.querySelectorAll('.m3-dropdown-option').forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        const val = opt.dataset.value;
        sel.value = val;
        if (lbl) lbl.textContent = opt.textContent;
        menu.querySelectorAll('.m3-dropdown-option').forEach(o => {
          o.classList.remove('selected');
          o.setAttribute('aria-selected', 'false');
        });
        opt.classList.add('selected');
        opt.setAttribute('aria-selected', 'true');
        if (drop) drop.classList.remove('open');
        if (trig) trig.setAttribute('aria-expanded', 'false');
      });
    });
  }

  if (linkModesContainer) {
    linkModesContainer.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        setLinkImportMode(btn.dataset.mode);
      });
    });
  }

  async function performGoogleLogin() {
    if (window.electronAPI && window.electronAPI.googleLogin) {
      if (googleLoginStatus) {
        googleLoginStatus.textContent = 'Signing in...';
        googleLoginStatus.style.color = 'var(--md-sys-color-primary, #6750A4)';
      }
      const advStatus = document.getElementById('adv-yt-auth-status');
      if (advStatus) {
        advStatus.textContent = 'Signing in...';
        advStatus.style.color = 'var(--md-sys-color-primary, #6750A4)';
      }
      try {
        const res = await window.electronAPI.googleLogin();
        if (res && res.loggedIn) {
          googleConnected = true;
          googleUser = res.user || null;
          updateGoogleAuthUI();
          updateYoutubePlaybackAuthUI(true);
          showToast('Signed in to YouTube!', 'success');
          return;
        }
      } catch (err) {
        console.warn('Google login error:', err);
      }
      await checkGoogleAuthStatus();
      checkYoutubePlaybackAuthStatus();
    } else {
      openGoogleLoginFallback();
      showToast('Opening Google sign-in in your default browser...', 'info');
    }
  }

  if (btnGoogleLogin) {
    btnGoogleLogin.addEventListener('click', performGoogleLogin);
  }

  if (btnGoogleLogout) {
    btnGoogleLogout.addEventListener('click', async () => {
      try {
        if (window.electronAPI && window.electronAPI.googleLogout) {
          const result = await window.electronAPI.googleLogout();
          if (result && result.warning) showToast(result.warning, 'warning');
        }
      } catch (e) {}
      googleConnected = false;
      googleUser = null;
      updateGoogleAuthUI();
      checkYoutubePlaybackAuthStatus();
    });
  }

  var btnAdvYtLogin = document.getElementById('btn-adv-yt-login');
  var btnAdvYtLogout = document.getElementById('btn-adv-yt-logout');
  if (btnAdvYtLogin) {
    btnAdvYtLogin.addEventListener('click', performGoogleLogin);
  }
  if (btnAdvYtLogout) {
    btnAdvYtLogout.addEventListener('click', async () => {
      try {
        if (window.electronAPI && window.electronAPI.googleLogout) {
          const result = await window.electronAPI.googleLogout();
          if (result && result.warning) showToast(result.warning, 'warning');
        }
      } catch (_) {}
      googleConnected = false;
      googleUser = null;
      updateGoogleAuthUI();
      checkYoutubePlaybackAuthStatus();
      showToast('Signed out of YouTube', 'info');
    });
  }

  if (btnYoutubePlaybackLogin) {
    btnYoutubePlaybackLogin.addEventListener('click', performGoogleLogin);
  }

  if (btnYoutubePlaybackLogout) {
    btnYoutubePlaybackLogout.addEventListener('click', async () => {
      if (!window.electronAPI || !window.electronAPI.youtubePlaybackLogout) return;
      btnYoutubePlaybackLogout.disabled = true;
      try {
        const result = await window.electronAPI.youtubePlaybackLogout();
        if (result && result.success) {
          updateYoutubePlaybackAuthUI(false);
          checkGoogleAuthStatus();
          showToast('YouTube playback session removed from this device.', 'info');
        } else {
          showToast((result && result.error) || 'Could not sign out of YouTube playback.', 'error');
        }
      } catch (error) {
        showToast(`Could not sign out of YouTube playback: ${error.message || error}`, 'error');
      } finally {
        btnYoutubePlaybackLogout.disabled = false;
      }
    });
  }
  checkGoogleAuthStatus();

  function openLinkImportModal(platform = '') {
    if (!linkImportModal) return;
    currentLinkImportPlatform = platform || 'youtube';
    clearImportError(linkImportError);

    const titleEl = document.getElementById('link-import-title');
    if (titleEl) {
      if (platform === 'youtube') titleEl.textContent = 'Import from YouTube';
      else if (platform === 'ytmusic') titleEl.textContent = 'Import from YouTube Music';
      else if (platform === 'soundcloud') titleEl.textContent = 'Import from SoundCloud';
      else if (platform === 'yandex') titleEl.textContent = 'Import from Yandex Music';
      else if (platform === 'deezer') titleEl.textContent = 'Import from Deezer';
      else if (platform === 'tiktok') titleEl.textContent = 'Import from TikTok';
      else if (platform === 'vk') titleEl.textContent = 'Import from VK Music';
      else titleEl.textContent = 'Import from link';
    }

    if (linkModesContainer) {
      if (platform === 'soundcloud' || platform === 'yandex' || platform === 'deezer' || platform === 'tiktok' || platform === 'vk') {
        linkModesContainer.classList.add('hidden');
      } else {
        linkModesContainer.classList.remove('hidden');
      }
    }

    const vkTextEl = document.getElementById('vk-import-text');
    if (vkTextEl) {
      if (platform === 'vk') {
        vkTextEl.classList.remove('hidden');
        vkTextEl.value = '';
      } else {
        vkTextEl.classList.add('hidden');
        vkTextEl.value = '';
      }
    }

    setLinkImportMode('link');

    if (linkImportUrl) {
      linkImportUrl.value = '';
      linkImportUrl.disabled = false;
      if (platform === 'youtube') {
        linkImportUrl.placeholder = 'Paste a YouTube playlist or video link';
      } else if (platform === 'ytmusic') {
        linkImportUrl.placeholder = 'Paste a YouTube Music link';
      } else if (platform === 'soundcloud') {
        linkImportUrl.placeholder = 'Paste a SoundCloud playlist or track link';
      } else if (platform === 'yandex') {
        linkImportUrl.placeholder = 'Paste a Yandex Music playlist, album or track link';
      } else if (platform === 'deezer') {
        linkImportUrl.placeholder = 'Paste a Deezer public playlist link';
      } else if (platform === 'tiktok') {
        linkImportUrl.placeholder = 'Paste a TikTok video or sound link';
      } else if (platform === 'vk') {
        linkImportUrl.placeholder = 'Paste a public VK playlist link (optional)';
      } else {
        linkImportUrl.placeholder = 'Paste a YouTube, YouTube Music, SoundCloud, Yandex Music or Deezer link';
      }
    }

    populateTargetDropdown(
      'link-import-target',
      'link-target-trigger',
      'link-target-dropdown',
      'link-target-menu',
      'link-target-label',
      'Create new playlist',
      [
        { value: '__new__', label: 'Create new playlist' },
        { value: '__favorites__', label: 'Add directly to Favorites' }
      ],
      playlist => `Merge into: ${playlist.name || 'untitled'}`
    );
    populateTargetDropdown('google-import-target', 'google-target-trigger', 'google-target-dropdown', 'google-target-menu', 'google-target-label', 'Separate playlists');

    if (linkImportProgressWrap) linkImportProgressWrap.classList.add('hidden');
    if (linkImportWavyContainer) linkImportWavyContainer.innerHTML = '';

    if (linkImportStatus) {
      linkImportStatus.classList.add('hidden');
      linkImportStatus.textContent = '';
      linkImportStatus.style.color = '';
    }

    if (btnConfirmLinkImport) {
      btnConfirmLinkImport.disabled = false;
      btnConfirmLinkImport.dataset.action = 'import';
      if (linkImportBtnText) linkImportBtnText.textContent = 'Import';
    }
    if (btnCancelLinkImport) btnCancelLinkImport.disabled = false;

    checkGoogleAuthStatus();
    openModal(linkImportModal);
    if (linkImportUrl) linkImportUrl.focus();
  }

  function closeLinkImportModal() {
    if (linkImportModal) closeModal(linkImportModal);
  }


  async function handleLinkImportAction() {
    if (btnConfirmLinkImport && btnConfirmLinkImport.dataset.action === 'done') {
      closeLinkImportModal();
      return;
    }

    if (currentLinkImportMode === 'login') {
      await handleGoogleLoginImport();
      return;
    }

    clearImportError(linkImportError);
    const url = linkImportUrl ? linkImportUrl.value.trim() : '';
    const vkText = (document.getElementById('vk-import-text')?.value || '').trim();
    if (!url && !(currentLinkImportPlatform === 'vk' && vkText)) {
      const errInfo = classifyImportError('link', 404, 'unsupported link');
      showImportError(linkImportError, errInfo);
      return;
    }

    const doSync = !!document.getElementById('chk-link-sync-playlist')?.checked;
    closeLinkImportModal();
    showImportSpinnerToast('Importing playlist...');

    if (currentLinkImportPlatform === 'tiktok' || url.includes('tiktok.com')) {
      const hasBusy = typeof beginBusy === 'function';
      if (hasBusy) beginBusy('import');

      try {
        const res = await fetch(`http://127.0.0.1:${state.serverPort}/api/tiktok-import?url=${encodeURIComponent(url)}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success || !Array.isArray(data.tracks) || data.tracks.length === 0) {
          dismissImportSpinnerToast();
          const errInfo = classifyImportError('link', res.status, data);
          showToast(errInfo.userMessage || 'Failed to import TikTok track', 'error');
          return;
        }

        const foundTracks = await matchSpotifyTracks(data.tracks, data.name || 'TikTok Track', null, { playlistCover: data.cover || '' });

        const targetSel = document.getElementById('link-import-target');
        const targetPlId = targetSel ? targetSel.value : '__new__';
        if (targetPlId === '__favorites__') {
          const existingMap = new Set(state.favorites.map(f => getTrackCanonicalId(f) || f.id));
          const newFavs = foundTracks.filter(t => !existingMap.has(getTrackCanonicalId(t) || t.id));
          state.favorites.push(...newFavs.map(stampAddedAt));
          localStorage.setItem('devsize_favorites', JSON.stringify(state.favorites));
          if (typeof updateFavoritesBadge === 'function') updateFavoritesBadge();
          if (typeof updateFavoriteIcon === 'function') updateFavoriteIcon();
          if (state.currentView === 'favorites' && typeof renderFavoritesView === 'function') renderFavoritesView();
          hydrateMissingPlaylistCovers(state.favorites);
        } else if (targetPlId !== '__new__' && targetPlId !== 'new') {
          const targetPl = state.playlists.find(p => p.id === targetPlId);
          if (targetPl) {
            if (!targetPl.cover && data.cover) targetPl.cover = data.cover;
            const existingIds = new Set(targetPl.tracks.map(t => t.id));
            const newTracks = foundTracks.filter(t => !existingIds.has(t.id));
            targetPl.tracks.push(...newTracks.map(stampAddedAt));
            localStorage.setItem('devsize_playlists', JSON.stringify(state.playlists));
            renderPlaylistsList();
            if (state.currentView === 'playlist-detail' && state.currentPlaylistId === targetPlId) {
              openPlaylistDetail(targetPlId);
            }
            hydrateMissingPlaylistCovers(targetPl);
          } else {
            createPlaylist(data.name || 'TikTok Track', foundTracks, data.cover || '', {
              syncEnabled: doSync,
              syncUrl: doSync ? url : '',
              syncPlatform: doSync ? 'tiktok' : '',
              importedPlatform: 'tiktok',
              importedAt: Date.now(),
              lastSyncedAt: doSync ? Date.now() : 0
            });
          }
        } else {
          createPlaylist(data.name || 'TikTok Track', foundTracks, data.cover || '', {
            syncEnabled: doSync,
            syncUrl: doSync ? url : '',
            syncPlatform: doSync ? 'tiktok' : '',
            importedPlatform: 'tiktok',
            importedAt: Date.now(),
            lastSyncedAt: doSync ? Date.now() : 0
          });
        }
      } catch (err) {
        dismissImportSpinnerToast();
        const errInfo = classifyImportError('link', err, err.message);
        showToast(errInfo.userMessage || 'Failed to import TikTok track', 'error');
      } finally {
        if (hasBusy && typeof endBusy === 'function') {
          endBusy('import');
        }
      }
      return;
    }

    if (currentLinkImportPlatform === 'vk' || url.includes('vk.com')) {
      const hasBusy = typeof beginBusy === 'function';
      if (hasBusy) beginBusy('import');

      try {
        const res = await fetch(`http://127.0.0.1:${state.serverPort}/api/vk-import`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, text: vkText })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success || !Array.isArray(data.tracks) || data.tracks.length === 0) {
          dismissImportSpinnerToast();
          const errInfo = classifyImportError('link', res.status, data);
          showToast(errInfo.userMessage || 'Failed to import VK Music', 'error');
          return;
        }

        const foundTracks = await matchSpotifyTracks(data.tracks, data.name || 'VK Music', null, { playlistCover: data.cover || '' });

        const targetSel = document.getElementById('link-import-target');
        const targetPlId = targetSel ? targetSel.value : '__new__';
        if (targetPlId === '__favorites__') {
          const existingMap = new Set(state.favorites.map(f => getTrackCanonicalId(f) || f.id));
          const newFavs = foundTracks.filter(t => !existingMap.has(getTrackCanonicalId(t) || t.id));
          state.favorites.push(...newFavs.map(stampAddedAt));
          localStorage.setItem('devsize_favorites', JSON.stringify(state.favorites));
          if (typeof updateFavoritesBadge === 'function') updateFavoritesBadge();
          if (typeof updateFavoriteIcon === 'function') updateFavoriteIcon();
          if (state.currentView === 'favorites' && typeof renderFavoritesView === 'function') renderFavoritesView();
          hydrateMissingPlaylistCovers(state.favorites);
        } else if (targetPlId !== '__new__' && targetPlId !== 'new') {
          const targetPl = state.playlists.find(p => p.id === targetPlId);
          if (targetPl) {
            if (!targetPl.cover && data.cover) targetPl.cover = data.cover;
            const existingIds = new Set(targetPl.tracks.map(t => t.id));
            const newTracks = foundTracks.filter(t => !existingIds.has(t.id));
            targetPl.tracks.push(...newTracks.map(stampAddedAt));
            localStorage.setItem('devsize_playlists', JSON.stringify(state.playlists));
            renderPlaylistsList();
            if (state.currentView === 'playlist-detail' && state.currentPlaylistId === targetPlId) {
              openPlaylistDetail(targetPlId);
            }
            hydrateMissingPlaylistCovers(targetPl);
          } else {
            createPlaylist(data.name || 'VK Music', foundTracks, data.cover || '', {
              syncUrl: url,
              syncPlatform: 'vk',
              importedPlatform: 'vk',
              importedAt: Date.now()
            });
          }
        } else {
          createPlaylist(data.name || 'VK Music', foundTracks, data.cover || '', {
            syncUrl: url,
            syncPlatform: 'vk',
            importedPlatform: 'vk',
            importedAt: Date.now()
          });
        }
      } catch (err) {
        dismissImportSpinnerToast();
        const errInfo = classifyImportError('link', err, err.message);
        showToast(errInfo.userMessage || 'Failed to import VK Music', 'error');
      } finally {
        if (hasBusy && typeof endBusy === 'function') {
          endBusy('import');
        }
      }
      return;
    }

    if (currentLinkImportPlatform === 'yandex' || url.includes('music.yandex.') || url.includes('yandex.')) {
      const hasBusy = typeof beginBusy === 'function';
      if (hasBusy) beginBusy('import');

      try {
        const res = await fetch(`http://127.0.0.1:${state.serverPort}/api/yandex-import?url=${encodeURIComponent(url)}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success || !Array.isArray(data.tracks) || data.tracks.length === 0) {
          dismissImportSpinnerToast();
          const errInfo = classifyImportError('link', res.status, data);
          showToast(errInfo.userMessage || 'Failed to import playlist', 'error');
          return;
        }

        const tracks = data.tracks;
        const total = tracks.length;

        const foundTracks = await matchSpotifyTracks(tracks, data.name || 'Yandex Music Playlist', null, { playlistCover: '' });

        const targetSel = document.getElementById('link-import-target');
        const targetPlId = targetSel ? targetSel.value : '__new__';
        if (targetPlId === '__favorites__') {
          const existingMap = new Set(state.favorites.map(f => getTrackCanonicalId(f) || f.id));
          const newFavs = foundTracks.filter(t => !existingMap.has(getTrackCanonicalId(t) || t.id));
          state.favorites.push(...newFavs.map(stampAddedAt));
          localStorage.setItem('devsize_favorites', JSON.stringify(state.favorites));
          if (typeof updateFavoritesBadge === 'function') updateFavoritesBadge();
          if (typeof updateFavoriteIcon === 'function') updateFavoriteIcon();
          if (state.currentView === 'favorites' && typeof renderFavoritesView === 'function') renderFavoritesView();
          hydrateMissingPlaylistCovers(state.favorites);
        } else if (targetPlId !== '__new__' && targetPlId !== 'new') {
          const targetPl = state.playlists.find(p => p.id === targetPlId);
          if (targetPl) {
            if (!targetPl.cover && data.cover) targetPl.cover = data.cover;
            const existingIds = new Set(targetPl.tracks.map(t => t.id));
            const newTracks = foundTracks.filter(t => !existingIds.has(t.id));
            targetPl.tracks.push(...newTracks.map(stampAddedAt));
            localStorage.setItem('devsize_playlists', JSON.stringify(state.playlists));
            renderPlaylistsList();
            if (state.currentView === 'playlist-detail' && state.currentPlaylistId === targetPlId) {
              openPlaylistDetail(targetPlId);
            }
            hydrateMissingPlaylistCovers(targetPl);
          } else {
            createPlaylist(data.name || 'Yandex Music Playlist', foundTracks, data.cover || '', {
              syncEnabled: doSync,
              syncUrl: doSync ? url : '',
              syncPlatform: doSync ? 'yandex' : '',
              importedPlatform: 'yandex',
              importedAt: Date.now(),
              lastSyncedAt: doSync ? Date.now() : 0
            });
          }
        } else {
          createPlaylist(data.name || 'Yandex Music Playlist', foundTracks, data.cover || '', {
            syncEnabled: doSync,
            syncUrl: doSync ? url : '',
            syncPlatform: doSync ? 'yandex' : '',
            importedPlatform: 'yandex',
            importedAt: Date.now(),
            lastSyncedAt: doSync ? Date.now() : 0
          });
        }
      } catch (err) {
        dismissImportSpinnerToast();
        const errInfo = classifyImportError('link', err, err.message);
        showToast(errInfo.userMessage || 'Failed to import playlist', 'error');
      } finally {
        if (hasBusy && typeof endBusy === 'function') {
          endBusy('import');
        }
      }
      return;
    }

    if (url.includes('soundcloud.com')) setPlatform('soundcloud', false);
    else if (url.includes('music.youtube.com')) setPlatform('ytmusic', false);
    else if (url.includes('youtube.com') || url.includes('youtu.be')) setPlatform('youtube', false);

    const hasBusy = typeof beginBusy === 'function';
    if (hasBusy) beginBusy('import');
    try {
      const res = await fetch(`http://127.0.0.1:${state.serverPort}/api/playlist-import?url=${encodeURIComponent(url)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data || !data.success || !Array.isArray(data.tracks) || data.tracks.length === 0) {
        dismissImportSpinnerToast();
        const errInfo = classifyImportError('link', res.status, data);
        showToast(errInfo.userMessage || 'Failed to import playlist', 'error');
        return;
      }

      const targetSel = document.getElementById('link-import-target');
      const targetPlId = targetSel ? targetSel.value : '__new__';
      const foundTracks = await matchSpotifyTracks(data.tracks || [], data.name || 'Playlist', null, { playlistCover: '' });
      if (targetPlId === '__favorites__') {
        const existingMap = new Set(state.favorites.map(f => getTrackCanonicalId(f) || f.id));
        const newFavs = foundTracks.filter(t => !existingMap.has(getTrackCanonicalId(t) || t.id));
        state.favorites.push(...newFavs.map(stampAddedAt));
        localStorage.setItem('devsize_favorites', JSON.stringify(state.favorites));
        if (typeof updateFavoritesBadge === 'function') updateFavoritesBadge();
        if (typeof updateFavoriteIcon === 'function') updateFavoriteIcon();
        if (state.currentView === 'favorites' && typeof renderFavoritesView === 'function') renderFavoritesView();
        hydrateMissingPlaylistCovers(state.favorites);
      } else if (targetPlId !== '__new__' && targetPlId !== 'new') {
        const targetPl = state.playlists.find(p => p.id === targetPlId);
        if (targetPl) {
          if (!targetPl.cover && data.cover) targetPl.cover = data.cover;
          const existingIds = new Set(targetPl.tracks.map(t => t.id));
          const newTracks = foundTracks.filter(t => !existingIds.has(t.id));
          targetPl.tracks.push(...newTracks.map(stampAddedAt));
          localStorage.setItem('devsize_playlists', JSON.stringify(state.playlists));
          renderPlaylistsList();
          if (state.currentView === 'playlist-detail' && state.currentPlaylistId === targetPlId) {
            openPlaylistDetail(targetPlId);
          }
          hydrateMissingPlaylistCovers(targetPl);
        } else {
          const detectedPlatform = currentLinkImportPlatform || (url.includes('soundcloud.com') ? 'soundcloud' : (url.includes('music.youtube.com') ? 'ytmusic' : 'youtube'));
          createPlaylist(data.name || 'Playlist', foundTracks, data.cover || '', {
            syncEnabled: doSync,
            syncUrl: doSync ? url : '',
            syncPlatform: doSync ? detectedPlatform : '',
            importedPlatform: detectedPlatform,
            importedAt: Date.now(),
            lastSyncedAt: doSync ? Date.now() : 0
          });
        }
      } else {
        const detectedPlatform = currentLinkImportPlatform || (url.includes('soundcloud.com') ? 'soundcloud' : (url.includes('music.youtube.com') ? 'ytmusic' : 'youtube'));
        createPlaylist(data.name || 'Playlist', foundTracks, data.cover || '', {
          syncEnabled: doSync,
          syncUrl: doSync ? url : '',
          syncPlatform: doSync ? detectedPlatform : '',
          importedPlatform: detectedPlatform,
          importedAt: Date.now(),
          lastSyncedAt: doSync ? Date.now() : 0
        });
      }
    } catch (err) {
      dismissImportSpinnerToast();
      const errInfo = classifyImportError('link', err, err.message);
      showToast(errInfo.userMessage || 'Failed to import playlist', 'error');
    } finally {
      if (hasBusy && typeof endBusy === 'function') {
        endBusy('import');
      }
    }
  }

  async function handleGoogleLoginImport() {
    clearImportError(linkImportError);
    const doLikes = !!(googleChkLikes && googleChkLikes.checked);
    const doPlaylists = !!(googleChkPlaylists && googleChkPlaylists.checked);

    if (!doLikes && !doPlaylists) {
      if (linkImportStatus) {
        linkImportStatus.textContent = 'Select at least Liked songs or Playlists';
        linkImportStatus.style.color = 'var(--md-sys-color-error, #ba1a1a)';
        linkImportStatus.classList.remove('hidden');
      }
      return;
    }

    closeLinkImportModal();
    showImportSpinnerToast('Fetching Google library...');

    const hasBusy = typeof beginBusy === 'function';
    if (hasBusy) beginBusy('import');

    try {
      const res = await window.electronAPI.googleImportLibrary({
        platform: currentLinkImportPlatform,
        doLikes,
        doPlaylists
      });

      if (!res || !res.success) {
        dismissImportSpinnerToast();
        if (res && res.error) {
          showToast(res.error, 'error');
          return;
        }
        const errInfo = classifyImportError(currentLinkImportPlatform, 403, res || {});
        showToast(errInfo.userMessage || errInfo.title || 'Failed to import Google library', 'error');
        return;
      }

      const likes = res.likes || [];
      const playlists = res.playlists || [];
      const totalTracks = likes.length + playlists.reduce((acc, p) => acc + (p.tracks ? p.tracks.length : 0), 0);

      if (totalTracks === 0) {
        dismissImportSpinnerToast();
        showToast('No tracks found to import', 'warning');
        return;
      }

      showImportSpinnerToast(`Importing Google library... (0/${totalTracks})`);

      const targetSel = document.getElementById('google-import-target');
      const targetPlId = targetSel ? targetSel.value : 'new';

      let importedCount = 0;
      const updateProgress = (count) => {
        if (activeImportToast) {
          const textSpan = activeImportToast.querySelector('.toast-text');
          if (textSpan) textSpan.textContent = `Importing Google library... (${count}/${totalTracks})`;
        }
      };

      if (likes.length > 0) {
        let addedFav = false;
        for (const track of likes) {
          if (!state.favorites.some(f => isSameTrack(f, track))) {
            state.favorites.push(stampAddedAt(track));
            addedFav = true;
          }
          importedCount++;
          updateProgress(importedCount);
        }
        if (addedFav) {
          localStorage.setItem('devsize_favorites', JSON.stringify(state.favorites));
          updateFavoritesBadge();
          updateFavoriteIcon();
          if (state.currentView === 'favorites') renderFavoritesView();
        }
        hydrateMissingPlaylistCovers(state.favorites);
      }

      if (playlists.length > 0) {
        for (const pl of playlists) {
          const plTracks = pl.tracks || [];
          if (targetPlId !== 'new') {
            const targetPl = state.playlists.find(p => p.id === targetPlId);
            if (targetPl) {
              for (const t of plTracks) {
                targetPl.tracks.push(stampAddedAt(t));
                importedCount++;
                updateProgress(importedCount);
              }
              localStorage.setItem('devsize_playlists', JSON.stringify(state.playlists));
              renderPlaylistsList();
              if (state.currentView === 'playlist-detail' && state.currentPlaylistId === targetPlId) {
                openPlaylistDetail(targetPlId);
              }
              hydrateMissingPlaylistCovers(targetPl);
            }
          } else {
            createPlaylist(pl.name, plTracks, pl.cover || '', {
              importedPlatform: 'youtube',
              importedAt: Date.now()
            });
            importedCount += plTracks.length;
            updateProgress(importedCount);
          }
        }
      }

      const finishMsg = res.warning
        ? `Imported ${totalTracks} tracks. ${res.warning}`
        : `Imported ${totalTracks} tracks`;
      if (activeImportToast) {
        const toast = activeImportToast;
        const iconSpan = toast.querySelector('.toast-icon');
        const textSpan = toast.querySelector('.toast-text');
        const checkmarkSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><polyline points="5 12.5 10 17.5 19 7.5"/></svg>';
        toast.className = 'riff-toast success wide';
        const row = toast.querySelector('.toast-row');
        if (row) row.className = 'toast-row success';
        if (iconSpan) iconSpan.innerHTML = checkmarkSvg;
        if (textSpan) textSpan.textContent = finishMsg;
        activeImportToast = null;
        setTimeout(() => {
          toast.classList.add('leaving');
          setTimeout(() => { if (toast.parentNode) toast.remove(); }, 4000);
        }, 4000);
      } else {
        showToast(finishMsg, 'success');
      }
    } catch (err) {
      dismissImportSpinnerToast();
      const errInfo = classifyImportError(currentLinkImportPlatform, err, err.message);
      showToast(errInfo.userMessage || errInfo.title || 'Failed to import Google library', 'error');
    } finally {
      if (hasBusy && typeof endBusy === 'function') endBusy('import');
    }
  }


  function formatTrackForExport(t) {
    if (!t) return null;
    const isLocal = t.platform === 'local' || t.source === 'local' || (typeof t.id === 'string' && t.id.startsWith('local_')) || (typeof t.url === 'string' && t.url.startsWith('file:'));
    function toBasename(val) {
      if (!val || typeof val !== 'string') return '';
      const clean = val.replace(/^file:\/\//i, '').replace(/\\/g, '/');
      const parts = clean.split('/').filter(Boolean);
      return parts.length ? parts[parts.length - 1] : val;
    }
    const id = isLocal ? toBasename(t.id) : String(t.id || '');
    const url = isLocal ? toBasename(t.url) : String(t.url || (id && (t.platform === 'ytmusic' || t.platform === 'youtube') ? `https://music.youtube.com/watch?v=${id}` : ''));
    let cover = String(t.cover || t.thumbnail || t.image || t.artworkUrl || '');
    if (cover.startsWith('file:') || cover.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(cover)) {
      cover = toBasename(cover);
    }
    const thumb = String(t.thumbnail || cover);
    return {
      title: t.title || '',
      artist: t.artist || '',
      album: t.album || '',
      duration: (typeof t.duration === 'number' && Number.isFinite(t.duration))
        ? t.duration
        : (t.duration ? Number(t.duration) : (t.durationMs ? Math.round(t.durationMs / 1000) : null)),
      source: t.source || t.platform || (isLocal ? 'local' : 'unknown'),
      platform: t.platform || t.source || (isLocal ? 'local' : 'unknown'),
      id,
      url,
      cover,
      thumbnail: thumb
    };
  }

  async function exportPlaylistsAsJson(playlistsList, defaultFilename = 'playlists.json') {
    const list = Array.isArray(playlistsList) ? playlistsList : [playlistsList];
    const valid = list.filter(Boolean);
    if (!valid.length) {
      if (typeof showToast === 'function') showToast('No playlists to export', 'error');
      return;
    }
    let appVer = '0.7.6';
    try {
      if (window.electronAPI && window.electronAPI.getAppVersion) {
        const v = await window.electronAPI.getAppVersion();
        if (v) appVer = v;
      }
    } catch (e) {}

    const payload = {
      app: 'Riff',
      appVersion: appVer,
      exportedAt: new Date().toISOString(),
      playlists: valid.map(pl => ({
        name: pl.name || 'untitled',
        description: pl.description || '',
        tracks: Array.isArray(pl.tracks) ? pl.tracks.map(formatTrackForExport).filter(Boolean) : []
      }))
    };

    if (window.electronAPI && window.electronAPI.savePlaylistsJson) {
      const res = await window.electronAPI.savePlaylistsJson({
        content: JSON.stringify(payload, null, 2),
        defaultName: defaultFilename
      });
      if (res && res.success) {
        const count = valid.length;
        if (typeof showToast === 'function') {
          showToast(`Exported ${count} playlist${count === 1 ? '' : 's'}`, 'success');
        }
      }
    }
  }

  async function exportSinglePlaylist(playlistId) {
    const pl = state.playlists.find(p => p.id === playlistId);
    if (!pl) return;
    const safeName = (pl.name || 'playlist').replace(/[/\\?%*:|"<>]/g, '_');
    await exportPlaylistsAsJson([pl], `${safeName}.json`);
  }

  async function exportAllPlaylists() {
    await exportPlaylistsAsJson(state.playlists, 'riff-playlists.json');
  }

  var btnExportPl = document.getElementById('btn-export-playlist');
  if (btnExportPl) {
    btnExportPl.addEventListener('click', () => {
      if (state.currentPlaylistId) {
        exportSinglePlaylist(state.currentPlaylistId);
      }
    });
  }

  var btnExportAllPl = document.getElementById('btn-export-all-playlists');
  if (btnExportAllPl) {
    btnExportAllPl.addEventListener('click', () => {
      exportAllPlaylists();
    });
  }

  function parseJsonPlaylists(text) {
    if (!text || typeof text !== 'string') return [];
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      return [];
    }
    const result = [];
    if (!parsed) return result;

    let rawList = [];
    if (Array.isArray(parsed)) {
      if (parsed.length > 0 && (parsed[0].tracks || parsed[0].name)) {
        rawList = parsed;
      } else if (parsed.length > 0 && (parsed[0].title || parsed[0].id)) {
        rawList = [{ name: 'Imported Playlist', tracks: parsed }];
      }
    } else if (typeof parsed === 'object') {
      if (Array.isArray(parsed.playlists)) {
        rawList = parsed.playlists;
      } else if (Array.isArray(parsed.tracks)) {
        rawList = [{ name: parsed.name || 'Imported Playlist', tracks: parsed.tracks, cover: parsed.cover || '' }];
      } else if (parsed.name) {
        rawList = [parsed];
      }
    }

    for (const item of rawList) {
      if (!item || typeof item !== 'object') continue;
      const name = (item.name || item.title || 'Imported Playlist').trim();
      const rawTracks = Array.isArray(item.tracks) ? item.tracks : [];
      const tracks = rawTracks.map(t => {
        if (!t || typeof t !== 'object') return null;
        const plat = (t.platform === 'soundcloud' || t.source === 'soundcloud')
          ? 'soundcloud'
          : (t.platform === 'local' || t.source === 'local' || Boolean(t.isLocal))
            ? 'local'
            : (t.platform === 'youtube' || t.source === 'youtube')
              ? 'youtube'
              : (t.platform || t.source || 'ytmusic');
        const hasUrl = typeof t.url === 'string' && t.url.trim().length > 0;
        const hasId = t.id !== undefined && t.id !== null && String(t.id).trim().length > 0;
        let trackId = '';
        if (hasId) {
          trackId = String(t.id).trim();
        } else if (hasUrl) {
          trackId = String(t.url).trim();
        } else {
          trackId = 'sp_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        }
        const resolvedCover = t.cover || t.thumbnail || '';
        const resolvedThumb = t.thumbnail || t.cover || '';
        const isLoc = plat === 'local' || Boolean(t.isLocal);
        const resolvedPath = t.path || t.filePath || (isLoc && hasUrl && t.url.startsWith('file://') ? t.url : '');
        return {
          id: trackId,
          title: t.title || '',
          artist: t.artist || '',
          album: t.album || '',
          duration: Number(t.duration) || 0,
          url: hasUrl ? t.url : (trackId && (plat === 'ytmusic' || plat === 'youtube') && !trackId.startsWith('sp_') ? `https://music.youtube.com/watch?v=${trackId}` : (resolvedPath || '')),
          path: resolvedPath,
          filePath: t.filePath || t.path || '',
          thumbnail: resolvedThumb,
          cover: resolvedCover,
          platform: plat,
          source: t.source || plat,
          isLocal: isLoc,
          searchQuery: ((t.artist ? t.artist + ' - ' : '') + (t.title || '')).trim()
        };
      }).filter(Boolean);
      const cover = item.cover || '';
      result.push({ name, tracks, cover });
    }

    return result;
  }

  async function extractAudioTracksFromZip(file) {
    if (!file) return [];
    try {
      const buffer = await file.arrayBuffer();
      const view = new DataView(buffer);
      const bytes = new Uint8Array(buffer);
      const tracks = [];
      const AUDIO_EXTS = new Set(['mp3', 'flac', 'wav', 'ogg', 'm4a', 'aac', 'opus', 'wma']);
      let offset = 0;
      const len = buffer.byteLength;

      while (offset + 30 <= len) {
        if (view.getUint32(offset, true) !== 0x04034b50) {
          offset++;
          continue;
        }
        const compression = view.getUint16(offset + 8, true);
        const compressedSize = view.getUint32(offset + 18, true);
        const fileNameLen = view.getUint16(offset + 26, true);
        const extraFieldLen = view.getUint16(offset + 28, true);
        const fileNameBytes = bytes.subarray(offset + 30, offset + 30 + fileNameLen);
        const fileName = new TextDecoder('utf-8').decode(fileNameBytes);
        const dataOffset = offset + 30 + fileNameLen + extraFieldLen;

        const extMatch = fileName.toLowerCase().match(/\.([a-z0-9]+)$/);
        const ext = extMatch ? extMatch[1] : '';

        if (AUDIO_EXTS.has(ext) && compressedSize > 0 && dataOffset + compressedSize <= len) {
          try {
            let rawData = null;
            if (compression === 0) {
              rawData = bytes.subarray(dataOffset, dataOffset + compressedSize);
            } else if (compression === 8 && typeof DecompressionStream !== 'undefined') {
              const compressedData = bytes.subarray(dataOffset, dataOffset + compressedSize);
              const ds = new DecompressionStream('deflate-raw');
              const decompressedStream = new Response(compressedData).body.pipeThrough(ds);
              const decompressedBuf = await new Response(decompressedStream).arrayBuffer();
              rawData = new Uint8Array(decompressedBuf);
            }
            if (rawData) {
              const mimeTypes = {
                mp3: 'audio/mpeg',
                wav: 'audio/wav',
                flac: 'audio/flac',
                ogg: 'audio/ogg',
                m4a: 'audio/mp4',
                aac: 'audio/aac',
                opus: 'audio/opus'
              };
              const blob = new Blob([rawData], { type: mimeTypes[ext] || 'audio/mpeg' });
              const objectUrl = URL.createObjectURL(blob);
              const baseName = fileName.replace(/^.*[\\\/]/, '').replace(/\.[^/.]+$/, '');
              let title = baseName;
              let artist = 'Unknown Artist';
              if (baseName.includes(' - ')) {
                const parts = baseName.split(' - ');
                artist = parts[0].trim();
                title = parts.slice(1).join(' - ').trim();
              }
              tracks.push({
                id: 'local_zip_' + Math.random().toString(36).slice(2, 9),
                title,
                artist,
                duration: 0,
                path: fileName,
                filePath: fileName,
                url: objectUrl,
                platform: 'local',
                source: 'local',
                isLocal: true
              });
            }
          } catch (e) {
            console.warn('Failed to decompress zip track:', fileName, e);
          }
        }
        offset = dataOffset + compressedSize;
      }
      return tracks;
    } catch (err) {
      console.warn('Error reading archive file:', err);
      return [];
    }
  }

  function matchImportedLocalTracks(targetPlaylists, newTracks) {
    if (!Array.isArray(targetPlaylists) || !Array.isArray(newTracks) || newTracks.length === 0) return 0;
    let matchedCount = 0;

    const norm = (s) => (s || '').toLowerCase().replace(/[\s\-_.,()[\]{}'"]/g, '');
    const getBase = (p) => (p || '').replace(/^.*[\\\/]/, '').replace(/\.[^/.]+$/, '').trim();

    targetPlaylists.forEach(targetPl => {
      const livePl = (state.playlists || []).find(p => p.id === targetPl.id) || targetPl;
      if (!livePl || !Array.isArray(livePl.tracks)) return;

      livePl.tracks.forEach(tr => {
        if (!tr) return;
        const isLocal = tr.platform === 'local' || tr.source === 'local' || tr.isLocal || tr.filePath || tr.path;
        if (!isLocal) return;

        const tPath = (tr.path || tr.filePath || tr.url || '').toLowerCase();
        const tBase = getBase(tr.path || tr.filePath || tr.url || tr.title);
        const tTitle = norm(tr.title || tBase);
        const tArtist = norm(tr.artist);
        const tFull = norm(`${tr.artist || ''} ${tr.title || tBase}`);

        const candidate = newTracks.find(c => {
          if (!c) return false;
          const cPath = (c.path || c.filePath || c.url || '').toLowerCase();
          const cBase = getBase(c.path || c.filePath || c.url || c.title);
          if (tPath && cPath && (tPath === cPath || tPath.endsWith(cPath) || cPath.endsWith(tPath))) return true;
          if (tBase && cBase && (tBase.toLowerCase() === cBase.toLowerCase())) return true;

          const cTitle = norm(c.title || cBase);
          const cArtist = norm(c.artist);
          if (tTitle && cTitle && tTitle === cTitle) {
            if (!tArtist || !cArtist || tArtist === 'unknownartist' || cArtist === 'unknownartist' || tArtist === cArtist || tArtist.includes(cArtist) || cArtist.includes(tArtist)) {
              return true;
            }
          }

          const cFull = norm(`${c.artist || ''} ${c.title || cBase}`);
          if (tFull && cFull && (tFull === cFull || tFull === norm(cBase) || norm(tBase) === cFull)) {
            return true;
          }
          return false;
        });

        if (candidate) {
          tr.id = candidate.id || tr.id;
          tr.url = candidate.url || tr.url;
          tr.path = candidate.path || candidate.url || tr.path;
          tr.filePath = candidate.filePath || candidate.path || tr.filePath;
          if (candidate.duration && !tr.duration) tr.duration = candidate.duration;
          if (candidate.cover && !tr.cover) tr.cover = candidate.cover;
          if (candidate.thumbnail && !tr.thumbnail) tr.thumbnail = candidate.thumbnail;
          tr.platform = 'local';
          tr.source = 'local';
          tr.isLocal = true;
          matchedCount++;
        }
      });
    });

    if (matchedCount > 0) {
      localStorage.setItem('devsize_playlists', JSON.stringify(state.playlists));
      if (typeof renderPlaylistsList === 'function') renderPlaylistsList();
      if (state.currentView === 'playlist-detail' && targetPlaylists.some(p => p.id === state.currentPlaylistId)) {
        if (typeof openPlaylistDetail === 'function') openPlaylistDetail(state.currentPlaylistId);
      }
      if (typeof showToast === 'function') {
        showToast(`Matched ${matchedCount} local track${matchedCount === 1 ? '' : 's'}`, 'success');
      }
    }
    return matchedCount;
  }

  function showLocalTracksImportModal(playlistsWithLocal) {
    if (!Array.isArray(playlistsWithLocal) || playlistsWithLocal.length === 0) return;
    let modal = document.getElementById('local-tracks-import-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'local-tracks-import-modal';
      modal.className = 'modal-backdrop hidden';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="dialog-card" style="max-width: 440px; width: 100%; padding: 28px; border-radius: 28px; background: var(--md-sys-color-surface-container-high, #211f26); box-shadow: 0 16px 40px rgba(0,0,0,0.55); border: 1px solid rgba(255,255,255,0.08);">
        <div style="width: 48px; height: 48px; border-radius: 16px; background: var(--md-sys-color-primary-container, rgba(168, 85, 247, 0.16)); color: var(--accent, #a855f7); display: flex; align-items: center; justify-content: center; margin-bottom: 18px;">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
        </div>
        <h3 style="margin: 0 0 8px; font-size: calc(20px * var(--font-scale, 1)); font-weight: 600; color: var(--md-sys-color-on-surface, #fff); letter-spacing: -0.01em;">Some tracks are local</h3>
        <p style="margin: 0 0 18px; font-size: calc(13px * var(--font-scale, 1)); line-height: 1.5; color: var(--md-sys-color-on-surface-variant, #cac4d0);">Locate and import local audio files to link them to your imported playlists.</p>
        <div id="local-import-status" style="display: none; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 12px; font-size: calc(12px * var(--font-scale, 1)); font-weight: 500; background: rgba(168, 85, 247, 0.12); color: var(--accent, #a855f7); border: 1px solid rgba(168, 85, 247, 0.25); margin-bottom: 16px;"></div>
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <button type="button" class="btn-pill-primary" id="btn-local-import-folder" style="display: flex; align-items: center; justify-content: flex-start; gap: 12px; height: 44px; padding: 0 16px; font-weight: 500; font-size: calc(13px * var(--font-scale, 1)); border-radius: 14px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink:0;"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/></svg>
            <span>Import folder</span>
          </button>
          <button type="button" class="btn-pill-primary" id="btn-local-import-files" style="display: flex; align-items: center; justify-content: flex-start; gap: 12px; height: 44px; padding: 0 16px; font-weight: 500; font-size: calc(13px * var(--font-scale, 1)); border-radius: 14px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink:0;"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
            <span>Import files</span>
          </button>
          <button type="button" class="btn-pill-primary" id="btn-local-import-archive" style="display: flex; align-items: center; justify-content: flex-start; gap: 12px; height: 44px; padding: 0 16px; font-weight: 500; font-size: calc(13px * var(--font-scale, 1)); border-radius: 14px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink:0;"><path d="M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z"/></svg>
            <span>Import archive (.zip)</span>
          </button>
        </div>
        <div style="display: flex; justify-content: flex-end; margin-top: 14px;">
          <button type="button" class="btn-outline-pill" id="btn-local-import-close" style="height: 38px; padding: 0 20px; font-weight: 500; font-size: calc(13px * var(--font-scale, 1)); border-radius: 19px;">Close</button>
        </div>
        <input type="file" id="local-archive-input" accept=".zip" style="display: none;">
      </div>
    `;

    openModal(modal);

    const statusEl = modal.querySelector('#local-import-status');
    const btnFolder = modal.querySelector('#btn-local-import-folder');
    const btnFiles = modal.querySelector('#btn-local-import-files');
    const btnArchive = modal.querySelector('#btn-local-import-archive');
    const btnClose = modal.querySelector('#btn-local-import-close');
    const archiveInput = modal.querySelector('#local-archive-input');

    const handleImportedTracks = (tracks) => {
      if (!tracks || tracks.length === 0) {
        if (statusEl) {
          statusEl.textContent = 'No tracks selected.';
          statusEl.style.display = 'flex';
        }
        return;
      }
      if (typeof mergeLocalFiles === 'function') {
        mergeLocalFiles(tracks);
      }
      const count = matchImportedLocalTracks(playlistsWithLocal, tracks);
      if (statusEl) {
        statusEl.textContent = count > 0 ? `Matched ${count} track${count === 1 ? '' : 's'}!` : 'Tracks imported into local library, but no matching names found.';
        statusEl.style.display = 'flex';
      }
    };

    if (btnFolder) {
      btnFolder.onclick = async () => {
        if (window.electronAPI && window.electronAPI.pickLocalFolder) {
          try {
            const tracks = await window.electronAPI.pickLocalFolder();
            handleImportedTracks(tracks);
          } catch (e) {
            console.warn('Pick local folder error:', e);
          }
        }
      };
    }

    if (btnFiles) {
      btnFiles.onclick = async () => {
        if (window.electronAPI && window.electronAPI.pickLocalFiles) {
          try {
            const tracks = await window.electronAPI.pickLocalFiles();
            handleImportedTracks(tracks);
          } catch (e) {
            console.warn('Pick local files error:', e);
          }
        }
      };
    }

    if (btnArchive && archiveInput) {
      btnArchive.onclick = () => {
        archiveInput.value = '';
        archiveInput.click();
      };
      archiveInput.onchange = async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        if (statusEl) {
          statusEl.textContent = 'Extracting archive...';
          statusEl.style.display = 'flex';
        }
        const tracks = await extractAudioTracksFromZip(file);
        handleImportedTracks(tracks);
      };
    }

    if (btnClose) {
      btnClose.onclick = () => {
        closeModal(modal);
      };
    }
  }

  function triggerJsonPlaylistImport() {
    const input = document.getElementById('json-playlist-file-input');
    if (!input) return;
    input.value = '';
    input.click();
  }

  var jsonFileInput = document.getElementById('json-playlist-file-input');
  if (jsonFileInput) {
    jsonFileInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      let totalCreated = 0;
      let totalTracks = 0;
      const createdPlaylistsWithLocal = [];
      for (const file of files) {
        try {
          const text = file.text ? await file.text() : await new Promise(res => {
            const fr = new FileReader();
            fr.onload = () => res(fr.result);
            fr.readAsText(file);
          });
          const playlists = parseJsonPlaylists(text);
          for (const pl of playlists) {
            const created = createPlaylist(pl.name, pl.tracks, pl.cover, {
              importedPlatform: pl.importedPlatform || 'json',
              importedAt: pl.importedAt || Date.now()
            });
            totalCreated++;
            totalTracks += (pl.tracks || []).length;
            const hasLocal = (pl.tracks || []).some(t => t && (t.platform === 'local' || t.source === 'local' || t.isLocal || t.filePath || t.path));
            if (hasLocal && created) {
              createdPlaylistsWithLocal.push(created);
            }
          }
        } catch (err) {
          console.error('Error importing JSON playlist:', err);
        }
      }
      if (totalCreated > 0) {
        if (typeof showToast === 'function') {
          showToast(`Imported ${totalCreated} playlist${totalCreated === 1 ? '' : 's'} (${totalTracks} tracks)`, 'success');
        }
        document.getElementById('create-playlist-modal')?.classList.add('hidden');
        if (createdPlaylistsWithLocal.length > 0) {
          showLocalTracksImportModal(createdPlaylistsWithLocal);
        }
      } else {
        if (typeof showToast === 'function') {
          showToast('No valid playlists found in file', 'error');
        }
      }
      jsonFileInput.value = '';
    });
  }

  var btnOpenJsonImport = document.getElementById('btn-open-json-import');
  if (btnOpenJsonImport) {
    btnOpenJsonImport.addEventListener('click', triggerJsonPlaylistImport);
  }

  var btnCpmJson = document.getElementById('btn-cpm-json');
  if (btnCpmJson) {
    btnCpmJson.addEventListener('click', () => {
      document.getElementById('create-playlist-modal')?.classList.add('hidden');
      triggerJsonPlaylistImport();
    });
  }

  var btnImportJsonPlaylists = document.getElementById('btn-import-json-playlists');
  if (btnImportJsonPlaylists) {
    btnImportJsonPlaylists.addEventListener('click', triggerJsonPlaylistImport);
  }

  function confirmChain({ title = 'Import Riff account', message = 'Importing an account will replace your existing playlists, favorites, custom styles, and settings. Riff will restart immediately.', confirmLabel = 'Import & Restart', seconds = 3 } = {}) {
    return new Promise((resolve) => {
      let modal = document.getElementById('confirm-chain-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'confirm-chain-modal';
        modal.className = 'modal-backdrop hidden';
        document.body.appendChild(modal);
      }
      let count = seconds;
      modal.innerHTML = `
        <div class="dialog-card" style="max-width: 420px;">
          <h3 style="margin-top: 0;">${escapeHtml(title)}</h3>
          <p style="margin: 8px 0 18px; color: var(--md-sys-color-on-surface-variant); font-size: calc(13px * var(--font-scale, 1)); line-height: 1.45;">${escapeHtml(message)}</p>
          <div class="dialog-actions" style="display: flex; justify-content: flex-end; gap: 10px;">
            <button type="button" class="btn-outline-pill" id="btn-confirm-chain-cancel">Cancel</button>
            <button type="button" class="btn-pill-primary" id="btn-confirm-chain-action" disabled style="opacity: 0.55; cursor: not-allowed;">${escapeHtml(confirmLabel)} (${count})</button>
          </div>
        </div>
      `;
      openModal(modal);

      const btnCancel = modal.querySelector('#btn-confirm-chain-cancel');
      const btnAction = modal.querySelector('#btn-confirm-chain-action');
      let timer = null;

      const cleanup = () => {
        if (timer) clearInterval(timer);
        closeModal(modal);
      };

      btnCancel.onclick = () => {
        cleanup();
        resolve(false);
      };

      timer = setInterval(() => {
        count--;
        if (count > 0) {
          btnAction.textContent = `${confirmLabel} (${count})`;
        } else {
          clearInterval(timer);
          timer = null;
          btnAction.disabled = false;
          btnAction.style.opacity = '1';
          btnAction.style.cursor = 'pointer';
          btnAction.textContent = confirmLabel;
        }

      }, 1000);

      btnAction.onclick = () => {
        if (btnAction.disabled) return;
        cleanup();
        resolve(true);
      };
    });
  }
  window.confirmChain = confirmChain;

  var btnExportAccount = document.getElementById('btn-export-account');
  if (btnExportAccount) {
    btnExportAccount.addEventListener('click', async () => {
      const dump = {};
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k) dump[k] = localStorage.getItem(k);
        }
      } catch (_) {}
      const payload = {
        app: 'Riff',
        version: '1.0',
        exportedAt: Date.now(),
        localStorage: dump
      };
      if (window.electronAPI && window.electronAPI.accountExport) {
        const res = await window.electronAPI.accountExport(payload);
        if (res && res.success) {
          showToast('Account exported successfully', 'success');
        } else if (res && !res.canceled) {
          showToast(res.error || 'Account export failed', 'error');
        }
      }
    });
  }

  var btnImportAccount = document.getElementById('btn-import-account');
  if (btnImportAccount) {
    btnImportAccount.onclick = async () => {
      const confirmed = await confirmChain({
        title: 'Import Riff account',
        message: 'Importing an account will replace your existing playlists, favorites, custom styles, and settings. Riff will restart immediately.',
        confirmLabel: 'Import & Restart',
        seconds: 3
      });
      if (!confirmed) return;

      if (!window.electronAPI || !window.electronAPI.accountImport) return;
      const res = await window.electronAPI.accountImport();
      if (res && res.canceled) return;
      if (!res || !res.success || !res.data) {
        showToast((res && res.error) || 'Failed to read account file', 'error');
        return;
      }
      const data = res.data;
      const store = data.localStorage || data;
      if (typeof store === 'object' && store !== null) {
        try { localStorage.clear(); } catch (_) {}
        for (const [key, val] of Object.entries(store)) {
          if (val !== undefined && val !== null) {
            try {
              localStorage.setItem(key, typeof val === 'string' ? val : JSON.stringify(val));
            } catch (_) {}
          }
        }
        if (window.electronAPI.storageSaveSync && window.__RIFF_STORAGE_MAP__) {
          try { window.electronAPI.storageSaveSync(window.__RIFF_STORAGE_MAP__); } catch (_) {}
        }
      }
      showToast('Account imported! Restarting...', 'success');
      setTimeout(() => {
        if (window.electronAPI && window.electronAPI.restartApp) {
          window.electronAPI.restartApp();
        } else {
          window.location.reload();
        }
      }, 350);
    };
  }



window.openSpotifyImportModal = openSpotifyImportModal;
window.openAppleImportModal = openAppleImportModal;
window.openLinkImportModal = openLinkImportModal;
window.triggerJsonPlaylistImport = triggerJsonPlaylistImport;
window.exportPlaylistsAsJson = exportPlaylistsAsJson;

