
'use strict';

var backfillAddedAt = window.backfillAddedAt || function(tracks) { return tracks; };
window.backfillAddedAt = backfillAddedAt;
var sortTracks = window.sortTracks || function(tracks) { return tracks; };
window.sortTracks = sortTracks;
var enableTrackSort = window.enableTrackSort || function() {};
window.enableTrackSort = enableTrackSort;

function renderPlaylistDetailView(pl) {
  if (typeof openPlaylistDetail === 'function') {
    openPlaylistDetail(pl && pl.id ? pl.id : pl);
  }
}
window.renderPlaylistDetailView = renderPlaylistDetailView;

var HomeCache = {
  store: {},
  async init() {
    try {
      if (window.electronAPI && window.electronAPI.readCacheFile) {
        const disk = await window.electronAPI.readCacheFile();
        if (disk && typeof disk === 'object') this.store = disk;
      }
    } catch (_) {}
  },
  get(key, maxAgeMs = 12 * 3600 * 1000) {
    const item = this.store[key];
    if (!item || !item.ts || !item.data) return null;
    if (Date.now() - item.ts > maxAgeMs) return null;
    return item.data;
  },
  set(key, data) {
    this.store[key] = { ts: Date.now(), data };
    try {
      if (window.electronAPI && window.electronAPI.writeCacheFile) {
        window.electronAPI.writeCacheFile(this.store);
      }
    } catch (_) {}
  }
};
window.HomeCache = HomeCache;


  function migrateAddedAt() {
    if (!state) return;
    if (!Array.isArray(state.favorites)) state.favorites = [];
    if (!Array.isArray(state.playlists)) state.playlists = [];
    let favChanged = false;
    if (Array.isArray(state.favorites)) {
      for (const f of state.favorites) {
        if (repairTikTokTrack(f)) favChanged = true;
      }
    }
    const favorites = backfillAddedAt(state.favorites, true);
    if (favChanged || favorites !== state.favorites) {
      state.favorites = favorites;
      localStorage.setItem('devsize_favorites', JSON.stringify(state.favorites));
    }
    let playlistsChanged = false;
    for (const pl of state.playlists) {
      if (!pl || !Array.isArray(pl.tracks)) continue;
      for (const pt of pl.tracks) {
        if (repairTikTokTrack(pt)) playlistsChanged = true;
      }
      const tracks = backfillAddedAt(pl.tracks, false);
      if (tracks !== pl.tracks) {
        pl.tracks = tracks;
        playlistsChanged = true;
      }
    }
    if (playlistsChanged) localStorage.setItem('devsize_playlists', JSON.stringify(state.playlists));
  }

  migrateAddedAt();

  if (typeof applyFont === 'function' && typeof state !== 'undefined' && state) applyFont(state.riffFont);

  var cachedTrackIds = new Set();
  window.cachedTrackIds = cachedTrackIds;

  async function refreshCachedTrackIds() {
    try {
      const port = (state && state.serverPort) || 38472;
      const res = await fetch(`http://127.0.0.1:${port}/api/offline-library`);
      const data = await res.json();
      if (data && data.success && Array.isArray(data.tracks)) {
        for (const t of data.tracks) {
          if (t.cleanId) cachedTrackIds.add(t.cleanId);
          if (t.id) {
            const cid = typeof cleanTrackId === 'function' ? cleanTrackId(t.id) : String(t.id).replace(/[^a-zA-Z0-9_-]/g, '_');
            cachedTrackIds.add(cid);
            cachedTrackIds.add(t.id);
          }
        }
      }
    } catch (_) {}
  }
  window.refreshCachedTrackIds = refreshCachedTrackIds;

  function isTrackLocallyCached(t) {
    if (!t) return false;
    if (t.isCached || (typeof isStaticTikTokTrack === 'function' && isStaticTikTokTrack(t))) return true;
    const cid = typeof cleanTrackId === 'function' ? cleanTrackId(t.id) : String(t.id || '').replace(/[^a-zA-Z0-9_-]/g, '_');
    if (cid && cachedTrackIds.has(cid)) return true;
    if (t.id && cachedTrackIds.has(t.id)) return true;
    return false;
  }
  window.isTrackLocallyCached = isTrackLocallyCached;


(async () => {
  if (window.electronAPI && window.electronAPI.getServerPort) {
    try {
      state.serverPort = await window.electronAPI.getServerPort();
      refreshCachedTrackIds();
    } catch (e) {
      console.warn('Failed to get server port:', e);
    }
  } else {
    refreshCachedTrackIds();
  }
})();

  if (typeof checkToolsStatus === 'function') checkToolsStatus(true);

  if (window.electronAPI && window.electronAPI.discordRpcSetEnabled) {
    window.electronAPI.discordRpcSetEnabled(state.discordRpcEnabled);
  }


  function openTrackRenameDialog() {
    const target = state.renamingTrack || state.currentTrack;
    const currentTitle = target?.title || '';
    const currentArtist = target?.artist || '';
    const currentAlbum = target?.album || '';
    const currentUrl = target?.url || '';

    if (el.inputRenameTitle) el.inputRenameTitle.value = currentTitle;
    if (el.inputRenameArtist) el.inputRenameArtist.value = currentArtist;
    const albumInput = el.inputRenameAlbum || document.getElementById('rename-track-album');
    const urlInput = el.inputRenameUrl || document.getElementById('rename-track-url');
    if (albumInput) albumInput.value = currentAlbum;
    if (urlInput) urlInput.value = currentUrl;
    if (el.renameTrackModal) openModal(el.renameTrackModal);
    if (el.inputRenameTitle) el.inputRenameTitle.focus();
  }

  if (el.btnEditCurrentTrack) el.btnEditCurrentTrack.addEventListener('click', openTrackRenameDialog);
  if (el.btnCancelRenameTrack) el.btnCancelRenameTrack.addEventListener('click', () => {
    state.renamingTrack = null;
    closeModal(el.renameTrackModal);
  });

  if (el.btnConfirmRenameTrack) {
    el.btnConfirmRenameTrack.addEventListener('click', () => {
      const newTitle = el.inputRenameTitle ? el.inputRenameTitle.value.trim() || 'Untitled track' : 'Untitled track';
      const newArtist = el.inputRenameArtist ? el.inputRenameArtist.value.trim() || 'Unknown artist' : 'Unknown artist';
      const newAlbum = document.getElementById('rename-track-album')?.value.trim() || '';
      const newUrl = document.getElementById('rename-track-url')?.value.trim() || '';

      const targetTrack = state.renamingTrack || state.currentTrack;
      const prevUrl = targetTrack?.url || '';
      const urlChanged = Boolean(targetTrack && newUrl !== prevUrl);

      const ytMatch = newUrl.match(/(?:[?&]v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      const ytId = ytMatch ? ytMatch[1] : null;

      const origCanonicalId = targetTrack ? getTrackCanonicalId(targetTrack) : '';
      if (origCanonicalId) {
        saveTrackRename(origCanonicalId, newTitle, newArtist, newAlbum, newUrl);
      }

      const applyUpdatesToTrack = (t) => {
        if (!t) return;
        t.title = newTitle;
        t.artist = newArtist;
        t.album = newAlbum;
        t.url = newUrl;
        if (urlChanged) {
          delete t._preloadedStreamUrl;
          delete t.resolvedYtId;
        }
        if (ytId) {
          t.id = ytId;
          t.resolvedYtId = ytId;
        }
      };

      if (targetTrack) {
        applyUpdatesToTrack(targetTrack);
        const newCanonicalId = getTrackCanonicalId(targetTrack);
        if (newCanonicalId && newCanonicalId !== origCanonicalId) {
          saveTrackRename(newCanonicalId, newTitle, newArtist, newAlbum, newUrl);
        }
      }

      const isCurrentPlayingTarget = state.currentTrack && targetTrack && (
        state.currentTrack === targetTrack ||
        isSameTrack(state.currentTrack, targetTrack) ||
        (origCanonicalId && getTrackCanonicalId(state.currentTrack) === origCanonicalId)
      );

      if (state.currentTrack && isCurrentPlayingTarget) {
        applyUpdatesToTrack(state.currentTrack);
        updateNowPlayingUI(state.currentTrack);
      }

      const updateArr = (arr) => {
        let updated = false;
        if (!Array.isArray(arr)) return false;
        arr.forEach(t => {
          if (!t) return;
          const matchTarget = (targetTrack?.id && t.id === targetTrack.id) ||
                              (origCanonicalId && getTrackCanonicalId(t) === origCanonicalId) ||
                              (targetTrack && isSameTrack(t, targetTrack));
          if (matchTarget) {
            applyUpdatesToTrack(t);
            updated = true;
          }
        });
        return updated;
      };

      if (updateArr(state.history)) localStorage.setItem('devsize_history', JSON.stringify(state.history));
      if (updateArr(state.favorites)) localStorage.setItem('devsize_favorites', JSON.stringify(state.favorites));
      if (updateArr(state.queue)) renderQueueView();

      if (Array.isArray(state.playlists)) {
        let plChanged = false;
        state.playlists.forEach(pl => {
          if (Array.isArray(pl.tracks) && updateArr(pl.tracks)) plChanged = true;
        });
        if (plChanged) localStorage.setItem('devsize_playlists', JSON.stringify(state.playlists));
      }

      if (isCurrentPlayingTarget) {
        if (urlChanged) {
          playTrack(state.currentTrack);
        }
      }

      if (state.currentView === 'favorites' && typeof renderFavoritesView === 'function') renderFavoritesView();
      if (state.currentView === 'playlist-detail' && typeof renderPlaylistDetailView === 'function' && state.selectedPlaylist) renderPlaylistDetailView(state.selectedPlaylist);
      if (state.currentView === 'history' && typeof renderHistoryView === 'function') renderHistoryView();

      sendStateToServer();
      sendDiscordRpcUpdate(state.currentTrack, state.isPlaying);
      updateMediaSession();

      if (el.renameTrackModal) closeModal(el.renameTrackModal);
      state.renamingTrack = null;
      showToast('Track info updated', 'info');
    });
  }


  function getTrackCanonicalId(track) {
    if (!track) return '';
    if (isStaticTikTokTrack(track)) {
      let tid = track.id;
      if (!tid || !String(tid).startsWith('tt_')) {
        const m = String(track.url || '').match(/[?&]id=(tt_[^&]+)/) || String(track._preloadedStreamUrl || '').match(/[?&]id=(tt_[^&]+)/);
        if (m && m[1]) tid = decodeURIComponent(m[1]);
      }
      return `tiktok:${tid || 'unknown'}`;
    }
    const platform = track.platform || state.platform || 'yt';
    if (track.id) return `${platform}:${track.id}`;
    if (track.url || track.videoId) return `${platform}:${track.url || track.videoId}`;
    const t = (track.title || '').trim().toLowerCase();
    const a = (track.artist || '').trim().toLowerCase();
    const d = Math.round(Number(track.duration) || 0);
    return `${platform}:${t}|${a}|${d}`;
  }

  function isSameTrack(a, b) {
    if (!a || !b) return false;
    return getTrackCanonicalId(a) === getTrackCanonicalId(b);
  }

  function getTrackTrims() { return safeJson('riff_track_trims', {}); }
  function getTrackTrim(track) {
    if (!track) return null;
    const cid = getTrackCanonicalId(track);
    return cid ? (getTrackTrims()[cid] || null) : null;
  }
  function saveTrackTrim(track, startSec, endSec, totalDur) {
    if (!track) return;
    const cid = getTrackCanonicalId(track);
    if (!cid) return;
    const all = getTrackTrims();
    if (startSec <= 0.15 && (!endSec || endSec >= totalDur - 0.25)) {
      delete all[cid];
    } else {
      all[cid] = { start: Math.round(startSec * 10) / 10, end: Math.round(endSec * 10) / 10, updatedAt: Date.now() };
    }
    try { localStorage.setItem('riff_track_trims', JSON.stringify(all)); } catch (_) {}
  }

  function getTrackArt(t) {
    try {
      return JSON.parse(localStorage.getItem('riff_track_art') || '{}')[getTrackCanonicalId(t)] || {};
    } catch (e) {
      return {};
    }
  }

  function setTrackArt(t, patch) {
    let all = {};
    try {
      all = JSON.parse(localStorage.getItem('riff_track_art') || '{}');
    } catch (e) {}
    const id = getTrackCanonicalId(t);
    if (!id) return;
    const cur = { ...(all[id] || {}), ...patch };
    for (const k in cur) if (cur[k] === undefined || cur[k] === null || cur[k] === '') delete cur[k];
    if (Object.keys(cur).length) all[id] = cur; else delete all[id];
    localStorage.setItem('riff_track_art', JSON.stringify(all));
  }

  function getTrackRenames() { return safeJson('riff_track_renames', {}); }
  function saveTrackRename(canonicalId, title, artist, album, url) {
    if (!canonicalId) return;
    const all = getTrackRenames();
    const prev = all[canonicalId] || {};
    const entry = { ...prev, updatedAt: Date.now() };
    if (title !== undefined) entry.title = title;
    if (artist !== undefined) entry.artist = artist;
    if (album !== undefined) entry.album = album;
    if (url !== undefined) entry.url = url;
    all[canonicalId] = entry;
    try { localStorage.setItem('riff_track_renames', JSON.stringify(all)); } catch (_) {}
  }
  function applyTrackRenames(t) {
    if (!t) return t;
    const cid = getTrackCanonicalId(t);
    const r = getTrackRenames()[cid];
    if (r) {
      if (r.title) t.title = r.title;
      if (r.artist) t.artist = r.artist;
      if (r.album !== undefined && r.album !== null && r.album !== '') t.album = r.album;
      if (r.url !== undefined && r.url !== null && r.url !== '') t.url = r.url;
    }
    return t;
  }
  function buildRiffShareUrl(track, directStream = '', resolvedUrl = '', maxLen = 0) {
    if (!track) return 'https://riff.hs.vc/share/';
    applyTrackRenames(track);
    const isHttpUrl = (u) => typeof u === 'string' && (u.startsWith('http://') || u.startsWith('https://')) && !u.includes('127.0.0.1');
    const title = track.title || 'Untitled';
    const artist = track.artist || '';
    const fallbackYt = (track.id && track.platform !== 'soundcloud' && track.platform !== 'local') ? ('https://www.youtube.com/watch?v=' + track.id) : '';
    const trackUrl = resolvedUrl || (isHttpUrl(track.url) ? track.url : fallbackYt);
    const customArt = typeof getTrackArt === 'function' ? getTrackArt(track) : null;
    const rawThumb = (customArt && isHttpUrl(customArt.cover))
      ? customArt.cover
      : (track.thumbnail || track.cover || (typeof getTrackThumbUrl === 'function' ? getTrackThumbUrl(track) : '') || '');
    const params = new URLSearchParams();
    params.set('t', 'music');
    if (title) params.set('n', title);
    if (artist) params.set('a', artist);
    if (isHttpUrl(trackUrl)) params.set('url', trackUrl);
    if (directStream && isHttpUrl(directStream) && !directStream.includes('.m3u8')) params.set('stream', directStream);
    if (isHttpUrl(rawThumb)) params.set('img', rawThumb);
    if (track.duration) params.set('dur', String(Math.round(Number(track.duration))));
    let full = 'https://riff.hs.vc/share/?' + params.toString();
    if (maxLen > 0 && full.length > maxLen) {
      params.delete('stream');
      full = 'https://riff.hs.vc/share/?' + params.toString();
    }
    if (maxLen > 0 && full.length > maxLen) {
      params.delete('img');
      full = 'https://riff.hs.vc/share/?' + params.toString();
    }
    return maxLen > 0 ? full.slice(0, maxLen) : full;
  }

  var crossfadeTriggered = false;
  var crossfadeFadeInPending = false;
  var currentAlbumPlayRunId = 0;

  function pushPlayHistory(track) {
    if (!track) return;
    const h = state.playHistory || (state.playHistory = []);
    if (h.length && h[h.length - 1].id === track.id) return;
    h.push(track);
    if (h.length > 100) h.shift();
  }
  var navigatingBack = false;


  function getMixFeedback() {
    const defaultVal = { likedArtists: [], dislikedArtists: [], likedTracks: [], dislikedTracks: [], ratingsByMix: {} };
    try {
      const raw = localStorage.getItem('riff_mix_feedback');
      const val = raw ? JSON.parse(raw) : defaultVal;
      if (!val || typeof val !== 'object') return defaultVal;
      if (!Array.isArray(val.likedArtists)) val.likedArtists = [];
      if (!Array.isArray(val.dislikedArtists)) val.dislikedArtists = [];
      if (!Array.isArray(val.likedTracks)) val.likedTracks = [];
      if (!Array.isArray(val.dislikedTracks)) val.dislikedTracks = [];
      if (!val.ratingsByMix || typeof val.ratingsByMix !== 'object') val.ratingsByMix = {};
      return val;
    } catch (_) {
      return defaultVal;
    }
  }
  window.getMixFeedback = getMixFeedback;

  function saveMixFeedback(data) {
    try {
      localStorage.setItem('riff_mix_feedback', JSON.stringify(data || {}));
    } catch (_) {}
  }
  window.saveMixFeedback = saveMixFeedback;

    function syncDailyMixRatingButtons(rating) {
    const bLike = document.getElementById('btn-dm-like');
    const bDislike = document.getElementById('btn-dm-dislike');
    if (bLike) {
      bLike.classList.toggle('active', rating === 'like');
      const svg = bLike.querySelector('svg');
      if (svg) svg.setAttribute('fill', rating === 'like' ? 'currentColor' : 'none');
    }
    if (bDislike) {
      bDislike.classList.toggle('active', rating === 'dislike');
      const svg = bDislike.querySelector('svg');
      if (svg) svg.setAttribute('fill', rating === 'dislike' ? 'currentColor' : 'none');
    }
  }
  window.syncDailyMixRatingButtons = syncDailyMixRatingButtons;

  async function handleDailyMixRating(isLike) {
    if (mixFeedbackBusy) return;
    const album = currentAlbumForFeedback || state.currentAlbum;
    if (!album || !album.id) return;
    mixFeedbackBusy = true;

    try {
      const bLike = document.getElementById('btn-dm-like');
      const bDislike = document.getElementById('btn-dm-dislike');
      const mixFeedbackEl = document.getElementById('daily-mix-feedback');

      const feedback = getMixFeedback();
      if (!feedback.ratingsByMix) feedback.ratingsByMix = {};
      const currentRating = (feedback.ratingsByMix && album.id) ? feedback.ratingsByMix[album.id] : null;

      const tracks = album.tracks || album._tracks || [];
      const artists = new Set();
      if (album.artist && album.artist !== 'Daily Mix') {
        album.artist.split(',').forEach(a => { const tr = a.trim(); if (tr) artists.add(tr); });
      }
      const keyFn = typeof getTrackNormalizedKey === 'function'
        ? getTrackNormalizedKey
        : (art, tit) => String(art || '').toLowerCase().trim() + '::' + String(tit || '').toLowerCase().trim();

      const trackObjs = [];
      tracks.forEach(t => {
        if (!t) return;
        if (t.artist) { const tr = t.artist.trim(); if (tr) artists.add(tr); }
        trackObjs.push({
          id: t.id || '',
          title: t.title || '',
          artist: t.artist || '',
          key: (t.artist && t.title) ? keyFn(t.artist, t.title) : (t.id || '')
        });
      });

      if ((isLike && currentRating === 'like') || (!isLike && currentRating === 'dislike')) {
        delete feedback.ratingsByMix[album.id];
        feedback.likedTracks = feedback.likedTracks.filter(lt => !trackObjs.some(to => (to.id && lt.id === to.id) || (to.key && lt.key === to.key)));
        feedback.dislikedTracks = feedback.dislikedTracks.filter(dt => !trackObjs.some(to => (to.id && dt.id === to.id) || (to.key && dt.key === to.key)));
        feedback.likedArtists = feedback.likedArtists.filter(a => !artists.has(a));
        feedback.dislikedArtists = feedback.dislikedArtists.filter(a => !artists.has(a));
        saveMixFeedback(feedback);
        syncDailyMixRatingButtons(null);
        showToast(t('Rating removed'), 'info');
        return;
      }

      if (currentRating) {
        if (isLike) {
          feedback.dislikedTracks = feedback.dislikedTracks.filter(dt => !trackObjs.some(to => (to.id && dt.id === to.id) || (to.key && dt.key === to.key)));
          feedback.dislikedArtists = feedback.dislikedArtists.filter(a => !artists.has(a));
        } else {
          feedback.likedTracks = feedback.likedTracks.filter(lt => !trackObjs.some(to => (to.id && lt.id === to.id) || (to.key && lt.key === to.key)));
          feedback.likedArtists = feedback.likedArtists.filter(a => !artists.has(a));
        }
      }

      feedback.ratingsByMix[album.id] = isLike ? 'like' : 'dislike';

      trackObjs.forEach(trackObj => {
        if (isLike) {
          if (!feedback.likedTracks.some(lt => (lt.id && lt.id === trackObj.id) || (lt.key && lt.key === trackObj.key))) {
            feedback.likedTracks.push(trackObj);
          }
          feedback.dislikedTracks = feedback.dislikedTracks.filter(dt => (dt.id && dt.id !== trackObj.id) && (!dt.key || dt.key !== trackObj.key));
        } else {
          if (!feedback.dislikedTracks.some(dt => (dt.id && dt.id === trackObj.id) || (dt.key && dt.key === trackObj.key))) {
            feedback.dislikedTracks.push(trackObj);
          }
          feedback.likedTracks = feedback.likedTracks.filter(lt => (lt.id && lt.id !== trackObj.id) && (!lt.key || lt.key !== trackObj.key));
        }
      });

      artists.forEach(a => {
        if (isLike) {
          if (!feedback.likedArtists.includes(a)) feedback.likedArtists.push(a);
          feedback.dislikedArtists = feedback.dislikedArtists.filter(x => x !== a);
        } else {
          if (!feedback.dislikedArtists.includes(a)) feedback.dislikedArtists.push(a);
          feedback.likedArtists = feedback.likedArtists.filter(x => x !== a);
        }
      });

      saveMixFeedback(feedback);
      syncDailyMixRatingButtons(isLike ? 'like' : 'dislike');

      if (mixFeedbackEl) {
        mixFeedbackEl.classList.add('hidden');
      }

      showToast(isLike ? t('Glad you like this mix!') : t('Thanks, we will play this less'), 'info');
    } finally {
      setTimeout(() => { mixFeedbackBusy = false; }, 450);
    }
  }
  window.handleDailyMixRating = handleDailyMixRating;


  var SEARCH_HISTORY_KEY = 'riff_search_history_v2';
  var VERIFIED_CHECK_SVG = '<svg class="verified-check" width="14" height="14" viewBox="0 0 24 24" aria-label="Verified artist"><circle cx="12" cy="12" r="11" fill="currentColor"></circle><path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="var(--md-sys-color-on-primary, #000)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"></path></svg>';

  function stripFeaturing(title) {
    return String(title || '')
      .replace(/\s*[\(\[]\s*(?:feat\.?|ft\.?|featuring)\s[^\)\]]*[\)\]]/gi, '')
      .replace(/\s+(?:feat\.?|ft\.?|featuring)\s+.+$/i, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  function rankSearchTracks(query, tracks) {
    if (!Array.isArray(tracks) || tracks.length < 2) return tracks;
    const q = normalizeMatchText(stripFeaturing(query));
    if (!q) return tracks;
    const exact = [];
    const rest = [];
    tracks.forEach(t => {
      const title = normalizeMatchText(stripFeaturing(t.title));
      const artist = normalizeMatchText(t.artist);
      const hit = title === q || (artist && (q === artist + ' ' + title || q === title + ' ' + artist));
      (hit ? exact : rest).push(t);
    });
    return exact.length ? exact.concat(rest) : tracks;
  }

  function getSearchHistory() {
    const v = safeJson(SEARCH_HISTORY_KEY, []);
    return Array.isArray(v) ? v : [];
  }

  function saveSearchHistory(list) {
    try { localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(list.slice(0, 25))); } catch (_) {}
  }

  function recordSearchHistory(entry) {
    if (!entry || !entry.key) return;
    const list = getSearchHistory().filter(e => e && e.key !== entry.key);
    list.unshift(Object.assign({ ts: Date.now() }, entry));
    saveSearchHistory(list);
  }

  function recordSearchQuery(query, thumb) {
    const q = String(query || '').trim();
    if (!q) return;
    recordSearchHistory({ kind: 'query', key: 'q:' + normalizeMatchText(q), title: q, subtitle: '', query: q, thumb: thumb || '' });
  }

  function recordSearchTrack(track) {
    if (!track || !track.title) return;
    const id = getTrackCanonicalId(track);
    if (!id) return;
    let thumb = '';
    try { thumb = getTrackThumbUrl(track); } catch (_) {}
    recordSearchHistory({
      kind: 'track',
      key: 't:' + id,
      title: stripFeaturing(track.title),
      subtitle: track.artist || '',
      thumb,
      explicit: !!isTrackExplicit(track),
      track: {
        id: track.id, title: track.title, artist: track.artist, album: track.album,
        duration: track.duration, thumbnail: track.thumbnail || thumb, cover: track.cover,
        url: track.url, platform: track.platform, isExplicit: track.isExplicit,
        searchQuery: track.searchQuery
      }
    });
  }

  function recordSearchArtist(name, thumb, verified) {
    const n = String(name || '').trim();
    if (!n) return;
    recordSearchHistory({ kind: 'artist', key: 'a:' + normalizeMatchText(n), title: n, subtitle: '', thumb: thumb || '', verified: !!verified });
  }

  function initSearchHistory() {
    const wrapper = document.querySelector('.search-box-wrapper');
    const input = el.searchInput;
    if (!wrapper || !input || document.getElementById('search-history-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'search-history-panel';
    panel.className = 'search-history-panel hidden';
    wrapper.appendChild(panel);

    let shCloseTimeout = null;
    const hide = () => {
      if (shCloseTimeout) {
        clearTimeout(shCloseTimeout);
        shCloseTimeout = null;
      }
      panel.classList.remove('open');
      shCloseTimeout = setTimeout(() => {
        panel.classList.add('hidden');
        shCloseTimeout = null;
      }, 200);
    };
    const show = () => {
      if (shCloseTimeout) {
        clearTimeout(shCloseTimeout);
        shCloseTimeout = null;
      }
      if (panel.classList.contains('hidden')) {
        panel.classList.remove('hidden');
        void panel.offsetWidth;
      }
      panel.classList.add('open');
    };

    const openEntry = (entry) => {
      hide();
      if (entry.kind === 'track' && entry.track) {
        playTrack(entry.track, [entry.track], 0, 'search');
        recordSearchTrack(entry.track);
      } else if (entry.kind === 'artist') {
        input.value = '';
        if (el.searchClearBtn) el.searchClearBtn.classList.add('hidden');
        recordSearchArtist(entry.title, entry.thumb, entry.verified);
        openArtistProfile(entry.title);
      } else {
        input.value = entry.query || entry.title || '';
        if (el.searchClearBtn) el.searchClearBtn.classList.remove('hidden');
        performSearch(input.value);
      }
    };

    const render = () => {
      const typed = normalizeMatchText(input.value);
      let list = getSearchHistory();
      if (typed) {
        list = list.filter(e => normalizeMatchText(e.title + ' ' + (e.subtitle || '')).includes(typed));
      }
      if (list.length === 0) {
        hide();
        return;
      }
      panel.innerHTML = '';
      const head = document.createElement('div');
      head.className = 'sh-head';
      const label = document.createElement('span');
      label.textContent = 'Search history';
      const clear = document.createElement('button');
      clear.type = 'button';
      clear.className = 'sh-clear';
      clear.textContent = 'Clear';
      clear.addEventListener('mousedown', (ev) => ev.preventDefault());
      clear.addEventListener('click', () => { saveSearchHistory([]); hide(); });
      head.append(label, clear);
      panel.appendChild(head);

      list.slice(0, 12).forEach(entry => {
        const row = document.createElement('div');
        row.className = 'sh-row';
        row.addEventListener('mousedown', (ev) => ev.preventDefault());

        const thumb = document.createElement('div');
        thumb.className = 'sh-thumb' + (entry.kind === 'artist' ? ' round' : '');
        const resolvedThumb = entry.thumb || (entry.track ? getTrackThumbUrl(entry.track) : '') || (entry.track && entry.track.id && !/^(cand_|dz_|it_|sp_|ym_)/i.test(entry.track.id) ? `https://i.ytimg.com/vi/${entry.track.id}/hqdefault.jpg` : '');
        const fallbackSvg = entry.kind === 'artist'
          ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'
          : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.5" y2="16.5"></line></svg>';
        thumb.innerHTML = fallbackSvg;
        if (resolvedThumb) {
          const img = document.createElement('img');
          img.alt = '';
          img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;';
          img.addEventListener('error', () => {
            if (entry.kind === 'artist' && entry.title && !img.dataset.retried) {
              img.dataset.retried = '1';
              fetch(`http://127.0.0.1:${state.serverPort}/api/artist?name=${encodeURIComponent(entry.title)}`)
                .then(r => r.json())
                .then(d => {
                  if (d?.artist?.avatar) {
                    img.src = d.artist.avatar;
                    entry.thumb = d.artist.avatar;
                  } else img.remove();
                }).catch(() => img.remove());
            } else if (entry.kind === 'track' && entry.title && !img.dataset.retried) {
              img.dataset.retried = '1';
              fetch(`http://127.0.0.1:${state.serverPort}/api/track-cover?artist=${encodeURIComponent(entry.subtitle || '')}&title=${encodeURIComponent(entry.title || '')}`)
                .then(r => r.json())
                .then(d => {
                  if (d?.cover) {
                    img.src = d.cover;
                    entry.thumb = d.cover;
                  } else img.remove();
                }).catch(() => img.remove());
            } else {
              img.remove();
            }
          });
          img.src = resolvedThumb;
          thumb.style.position = 'relative';
          thumb.appendChild(img);
        }

        const info = document.createElement('div');
        info.className = 'sh-info';
        const title = document.createElement('div');
        title.className = 'sh-title';
        title.textContent = entry.title;
        if (entry.kind === 'artist' && entry.verified) title.insertAdjacentHTML('beforeend', VERIFIED_CHECK_SVG);
        const sub = document.createElement('div');
        sub.className = 'sh-sub';
        if (entry.kind === 'track' && entry.explicit) {
          const badge = document.createElement('span');
          badge.className = 'explicit-badge';
          badge.textContent = 'E';
          sub.appendChild(badge);
        }
        const kindLabel = entry.kind === 'track' ? 'Track' : entry.kind === 'artist' ? 'Artist' : 'Search';
        sub.appendChild(document.createTextNode(entry.subtitle ? kindLabel + ' \u2022 ' + entry.subtitle : kindLabel));
        info.append(title, sub);

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'sh-remove';
        remove.setAttribute('aria-label', 'Remove');
        remove.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
        remove.addEventListener('click', (ev) => {
          ev.stopPropagation();
          saveSearchHistory(getSearchHistory().filter(e => e.key !== entry.key));
          render();
        });

        row.append(thumb, info, remove);
        row.addEventListener('click', () => openEntry(entry));
        panel.appendChild(row);
      });
      show();
    };

    input.addEventListener('focus', render);
    input.addEventListener('click', render);
    input.addEventListener('input', render);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === 'Escape') hide();
    });
    document.addEventListener('pointerdown', (e) => {
      if (!wrapper.contains(e.target)) hide();
    });
  }


  function isTrackFavorited(track) {
    if (!track) return false;
    return state.favorites.some(f => (f.id && f.id === track.id) || (f.title === track.title && f.artist === track.artist));
  }

  function toggleFavorite(track) {
    if (typeof toggleFavoriteTrack === 'function') toggleFavoriteTrack(track);
  }

  function openDownloadModalForTrack(track) {
    if (typeof openDownloadModal === 'function') openDownloadModal(track);
  }

  function openRenameTrackModal(track) {
    if (!track) return;
    state.renamingTrack = track;
    const titleInput = el.renameTitleInput || el.inputRenameTitle;
    const artistInput = el.renameArtistInput || el.inputRenameArtist;
    const albumInput = el.renameAlbumInput || el.inputRenameAlbum || document.getElementById('rename-track-album');
    const urlInput = el.renameUrlInput || el.inputRenameUrl || document.getElementById('rename-track-url');
    if (titleInput) titleInput.value = track.title || '';
    if (artistInput) artistInput.value = track.artist || '';
    if (albumInput) albumInput.value = track.album || '';
    if (urlInput) urlInput.value = track.url || '';
    if (el.renameTrackModal) openModal(el.renameTrackModal);
    if (titleInput) titleInput.focus();
  }

  var ctxMenuEl = null;
  var ctxMenuOpenedAt = 0;
  var tgTipEl = null;
  var tgTipHideTimer = null;
  var tgTipDwellTimer = null;
  var tgTipCountTimer = null;
  var lastCountedTipTs = 0;
  var lastCountedTrackKey = '';


  function getPinnedPlaylists() {
    return safeJson('riff_pinned_playlists', []);
  }

  function isPlaylistPinned(plId) {
    if (!plId) return false;
    const list = getPinnedPlaylists();
    return Array.isArray(list) && list.some(id => String(id) === String(plId));
  }

  function togglePinPlaylist(plId) {
    if (!plId) return false;
    const sId = String(plId);
    let list = getPinnedPlaylists();
    if (!Array.isArray(list)) list = [];
    const idx = list.findIndex(id => String(id) === sId);
    let pinned = false;
    if (idx >= 0) {
      list.splice(idx, 1);
      pinned = false;
    } else {
      list.unshift(sId);
      pinned = true;
    }
    localStorage.setItem('riff_pinned_playlists', JSON.stringify(list));
    if (typeof renderPlaylistsList === 'function') renderPlaylistsList();
    if (typeof renderSidebarLibraryFeed === 'function') renderSidebarLibraryFeed();
    showToast(pinned ? 'Playlist pinned' : 'Playlist unpinned');
    return pinned;
  }


  async function rescanTracksToCurrentPlatform(tracksList, listName, onSave) {
    if (!Array.isArray(tracksList) || tracksList.length === 0) {
      showToast(t('No tracks to show'), 'info');
      return;
    }
    const targetPlat = (state.platform === 'soundcloud' || state.platform === 'youtube') ? state.platform : 'ytmusic';
    const platLabel = targetPlat === 'soundcloud' ? 'SoundCloud' : (targetPlat === 'youtube' ? 'YouTube' : 'YouTube Music');
    const isLocalTrackItem = (tr) => {
      if (!tr) return true;
      if (tr.platform === 'local' || tr.source === 'local' || tr.isLocal) return true;
      if (String(tr.id || '').startsWith('local_')) return true;
      if (String(tr.url || '').startsWith('file:')) return true;
      if (tr.path || tr.filePath) return true;
      if (typeof isStaticTikTokTrack === 'function' && isStaticTikTokTrack(tr)) return true;
      return false;
    };
    const streamingTracks = tracksList.filter(tr => !isLocalTrackItem(tr));
    if (streamingTracks.length === 0) {
      showToast(t('No streaming tracks to re-search (local files are ignored)'), 'info');
      return;
    }

    const total = streamingTracks.length;
    let done = 0;
    let updated = 0;
    showImportSpinnerToast(`${t('Re-searching streaming tracks')} (${platLabel})... (0/${total})`);

    await pool(streamingTracks, 3, async (tr) => {
      try {
        const q = `${tr.artist ? tr.artist + ' - ' : ''}${tr.title || ''}`.trim() || tr.searchQuery || '';
        if (!q) return;
        const prevId = tr.resolvedYtId || tr._sourceMeta?.id || tr.id || '';
        const res = await fetch(`http://127.0.0.1:${state.serverPort}/api/search?q=${encodeURIComponent(q)}&platform=${encodeURIComponent(targetPlat)}&limit=5`).catch(() => null);
        if (!res || !res.ok) return;
        const data = await res.json().catch(() => null);
        const candidates = (data && Array.isArray(data.tracks)) ? data.tracks : [];
        const best = pickBestMatch(tr, candidates) || candidates[0];
        if (!best || !best.id) return;

        delete tr._preloadedStreamUrl;
        delete tr._preloadedStreamQuality;
        delete tr._preloadedAt;
        delete tr.streamUrl;
        delete tr.resolvedYtId;
        delete tr._gaveUp;
        delete tr._unavailNotice;
        tr.isUnavailable = false;
        tr.isCached = false;

        if (prevId) {
          if (typeof cachedTrackIds !== 'undefined' && cachedTrackIds instanceof Set) {
            cachedTrackIds.delete(prevId);
            cachedTrackIds.delete(cleanTrackId(prevId));
          }
          await fetch(`http://127.0.0.1:${state.serverPort}/api/offline-delete?id=${encodeURIComponent(prevId)}&title=${encodeURIComponent(tr.title || '')}&artist=${encodeURIComponent(tr.artist || '')}`, { method: 'POST' }).catch(() => {});
        }

        tr.id = String(best.id);
        tr.platform = targetPlat;
        tr.url = best.url || (targetPlat !== 'soundcloud' ? `https://www.youtube.com/watch?v=${best.id}` : '');
        tr.searchQuery = q;
        if (best.duration > 0) tr.duration = best.duration;
        if (best.thumbnail && (!getTrackArt(tr)?.cover)) {
          tr.thumbnail = best.thumbnail;
          tr.cover = best.thumbnail;
        }
        tr._sourceMeta = {
          id: String(best.id),
          title: best.title || tr.title,
          artist: best.artist || tr.artist,
          thumbnail: best.thumbnail || tr.thumbnail || '',
          platform: targetPlat,
          url: tr.url
        };
        await fetch(`http://127.0.0.1:${state.serverPort}/api/save-track-source`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            artist: tr.artist || '',
            title: tr.title || '',
            resolvedId: String(best.id),
            url: tr.url,
            platform: targetPlat,
            sourceMeta: tr._sourceMeta
          })
        }).catch(() => {});
        updated++;
      } catch (_) {
      } finally {
        done++;
        showImportSpinnerToast(`${t('Re-searching streaming tracks')} (${platLabel})... (${done}/${total})`);
      }
    });

    dismissImportSpinnerToast();
    if (typeof onSave === 'function') onSave();
    showToast(`${t('Updated')} ${updated}/${total} (${platLabel})`, 'success');
  }
  window.rescanTracksToCurrentPlatform = rescanTracksToCurrentPlatform;


  function getTrackSelectionKey(t) {
    if (!t) return '';
    return String(t.path || t.id || ((t.artist || '') + '::' + (t.title || ''))).trim();
  }
  window.getTrackSelectionKey = getTrackSelectionKey;

  function getLocalTracksArray() {
    if (Array.isArray(state.localTracks) && state.localTracks.length > 0) return state.localTracks;
    if (Array.isArray(state.localFiles) && state.localFiles.length > 0) return state.localFiles;
    return state.localTracks || state.localFiles || [];
  }
  window.getLocalTracksArray = getLocalTracksArray;

  function saveLocalTracks() {
    try {
      const updated = state.localTracks || state.localFiles || [];
      const serialized = JSON.stringify(updated);
      localStorage.setItem('devsize_local_tracks', serialized);
      localStorage.setItem('riff_local_tracks', serialized);
      localStorage.setItem('devsize_local_files', serialized);
      localStorage.setItem('riff_local_files', serialized);
    } catch (_) {}
  }
  window.saveLocalTracks = saveLocalTracks;

  function removeTracksFromLocalLibrary(tracksToRemove) {
    if (!Array.isArray(tracksToRemove) || tracksToRemove.length === 0) return;
    const keysToRemove = new Set(tracksToRemove.map(t => getTrackSelectionKey(t)).filter(Boolean));
    const pathsToRemove = new Set(tracksToRemove.map(t => String(t?.path || t?.filePath || t?.url || '')).filter(Boolean));
    const idsToRemove = new Set(tracksToRemove.map(t => String(t?.id || '')).filter(Boolean));

    const shouldKeep = (t) => {
      if (!t) return false;
      if (keysToRemove.has(getTrackSelectionKey(t))) return false;
      if (t.id && idsToRemove.has(String(t.id))) return false;
      const p = String(t.path || t.filePath || t.url || '');
      if (p && pathsToRemove.has(p)) return false;
      return true;
    };

    if (Array.isArray(state.localTracks)) {
      state.localTracks = state.localTracks.filter(shouldKeep);
    }
    if (Array.isArray(state.localFiles)) {
      state.localFiles = state.localFiles.filter(shouldKeep);
    }
    const updated = state.localTracks || state.localFiles || [];

    fetch('http://127.0.0.1:' + state.serverPort + '/api/library-remove', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: tracksToRemove.map(t => t?.id).filter(Boolean), clearAll: (state.localFiles || []).length === 0 }) }).catch(() => {});

    try {
      const removedBlacklist = safeJson('riff_removed_local_paths', []);
      const mergedBlacklist = Array.from(new Set([...removedBlacklist, ...pathsToRemove, ...idsToRemove]));
      localStorage.setItem('riff_removed_local_paths', JSON.stringify(mergedBlacklist));
      const serialized = JSON.stringify(updated);
      localStorage.setItem('devsize_local_tracks', serialized);
      localStorage.setItem('riff_local_tracks', serialized);
      localStorage.setItem('devsize_local_files', serialized);
      localStorage.setItem('riff_local_files', serialized);
      if (typeof saveLocalTracks === 'function') saveLocalTracks();
    } catch (_) {}

    if (el.localCount) el.localCount.textContent = String(updated.length);
    if (typeof updateLocalBadge === 'function') updateLocalBadge();
    if (typeof renderLocalTracks === 'function') renderLocalTracks();
    if (typeof renderLocalFiles === 'function') renderLocalFiles();
  }
  window.removeTracksFromLocalLibrary = removeTracksFromLocalLibrary;


  function animateRemoveFavoriteTrackRow(track, sourceRow = null) {
    if (!el.favoritesTracksList) return;
    let targetRow = sourceRow;
    if (!targetRow || !targetRow.isConnected) {
      const canId = (typeof getTrackCanonicalId === 'function' ? getTrackCanonicalId(track) : '') || track.id;
      el.favoritesTracksList.querySelectorAll('.track-row').forEach(r => {
        if (!targetRow && ((r._trackData && isSameTrack(r._trackData, track)) || (canId && r.dataset.canonicalId === canId))) {
          targetRow = r;
        }
      });
    }

    const query = el.favoritesSearchInput ? el.favoritesSearchInput.value.trim().toLowerCase() : '';
    const userNick = localStorage.getItem('riff_user_nickname') || 'User';
    const totalSec = (state.favorites || []).reduce((acc, t) => acc + (t.duration || 0), 0);
    const totalMin = Math.round(totalSec / 60);
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const totalDurStr = totalSec > 0 ? (hrs > 0 ? `, ${hrs} hr ${mins} min` : `, ${totalMin || 1} min`) : '';
    if (el.favoritesSubtitle) {
      el.favoritesSubtitle.textContent = query
        ? `${userNick} • ${state.favorites.length} of ${state.favorites.length} songs${totalDurStr}`
        : `${userNick} • ${state.favorites.length} songs${totalDurStr}`;
    }

    if (targetRow) {
      targetRow.classList.add('track-row-removing');
      setTimeout(() => {
        if (targetRow.parentNode) targetRow.remove();
        let idx = 1;
        el.favoritesTracksList.querySelectorAll('.track-row:not(.track-row-removing) .track-row-num').forEach(numEl => {
          numEl.textContent = String(idx++);
        });
        if (state.favorites.length === 0) {
          el.favoritesTracksList.innerHTML = '<div class="empty-hint">No favourites yet. Use the heart on a track to save it</div>';
        }
      }, 260);
    } else if (state.favorites.length === 0) {
      el.favoritesTracksList.innerHTML = '<div class="empty-hint">No favourites yet. Use the heart on a track to save it</div>';
    }
  }

  function animateAddFavoriteTrackRow(track) {
    if (!el.favoritesTracksList) return;
    const emptyHint = el.favoritesTracksList.querySelector('.empty-hint');
    if (emptyHint) emptyHint.remove();

    const query = el.favoritesSearchInput ? el.favoritesSearchInput.value.trim().toLowerCase() : '';
    const userNick = localStorage.getItem('riff_user_nickname') || 'User';
    const totalSec = (state.favorites || []).reduce((acc, t) => acc + (t.duration || 0), 0);
    const totalMin = Math.round(totalSec / 60);
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const totalDurStr = totalSec > 0 ? (hrs > 0 ? `, ${hrs} hr ${mins} min` : `, ${totalMin || 1} min`) : '';
    if (el.favoritesSubtitle) {
      el.favoritesSubtitle.textContent = query
        ? `${userNick} • ${state.favorites.length} of ${state.favorites.length} songs${totalDurStr}`
        : `${userNick} • ${state.favorites.length} songs${totalDurStr}`;
    }

    const currentCanonicalId = state.currentTrack ? getTrackCanonicalId(state.currentTrack) : '';
    const row = createTrackRow(track, 0, currentCanonicalId, 'favorites', state.favorites, el.favoritesTracksList);
    row.classList.add('track-row-adding');
    el.favoritesTracksList.prepend(row);

    let idx = 1;
    el.favoritesTracksList.querySelectorAll('.track-row:not(.track-row-removing) .track-row-num').forEach(numEl => {
      numEl.textContent = String(idx++);
    });

    setTimeout(() => {
      row.classList.remove('track-row-adding');
    }, 280);
  }

  function toggleFavoriteTrack(track, sourceRow = null) {
    if (!track) return;
    repairTikTokTrack(track);
    const exists = state.favorites.some(f => isSameTrack(f, track));
    
    if (exists) {
      state.favorites = state.favorites.filter(f => !isSameTrack(f, track));
    } else {
      state.favorites.unshift(stampAddedAt(track));
    }
    
    localStorage.setItem('devsize_favorites', JSON.stringify(state.favorites));
    updateFavoritesBadge();
    updateFavoriteIcon();
    updateRpSaveButton();
    if (state.currentView === 'favorites') {
      if (exists) {
        animateRemoveFavoriteTrackRow(track, sourceRow);
      } else {
        animateAddFavoriteTrackRow(state.favorites[0]);
      }
    }
  }

  function updateFavoriteIcon() {
    if (!el.favIcon) return;
    if (!state.currentTrack) {
      el.favIcon.setAttribute('fill', 'none');
      return;
    }
    const isFav = state.favorites.some(f => isSameTrack(f, state.currentTrack));
    el.favIcon.setAttribute('fill', isFav ? 'currentColor' : 'none');
  }

  function updateRpSaveButton() {
    const btn = document.getElementById('btn-rp-save-track');
    if (!btn) return;
    if (!state.currentTrack) {
      btn.style.display = 'none';
      return;
    }
    btn.style.display = '';
    const inFav = (state.favorites || []).some(f => isSameTrack(f, state.currentTrack));
    const inPl = (state.playlists || []).some(p => (p.tracks || []).some(t => isSameTrack(t, state.currentTrack)));
    const saved = inFav || inPl;
    btn.classList.toggle('is-saved', saved);
    btn.innerHTML = saved
      ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" height="24px" width="24px" fill="currentColor"><path d="M10.53,12.93l-1.5-1.5Q8.6,11 7.98,11T6.93,11.43T6.51,12.48t0.44,1.05L9.4,15.98q0.48,0.47 1.13,0.47t1.12-0.47l5.28-5.28q0.43-0.43 0.43-1.04T16.93,8.63T15.88,8.2T14.83,8.63l-4.3,4.3ZM12,22.85q-2.27,0-4.25-0.85T4.31,19.69T2,16.25T1.15,12T2,7.75T4.31,4.31T7.75,2T12,1.15q2.28,0 4.25,0.85t3.44,2.31T22,7.75Q22.85,9.73 22.85,12q0,2.27-0.85,4.25t-2.31,3.44T16.25,22T12,22.85Z"/></svg>'
      : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" height="24px" width="24px" fill="currentColor"><path d="M10.8,13.2V16q0,0.51 0.35,0.86T12,17.2t0.85-0.34T13.2,16V13.2H16q0.51,0 0.86-0.35T17.2,12t-0.34-0.85T16,10.8H13.2V8q0-0.51-0.35-0.86T12,6.8T11.15,7.14T10.8,8v2.8H8q-0.51,0-0.86,0.35T6.8,12t0.34,0.85T8,13.2h2.8ZM12,22.85q-2.27,0-4.25-0.85T4.31,19.69T2,16.25T1.15,12T2,7.75T4.31,4.31T7.75,2T12,1.15q2.28,0 4.25,0.85t3.44,2.31T22,7.75Q22.85,9.73 22.85,12q0,2.27-0.85,4.25t-2.31,3.44T16.25,22T12,22.85Z"/></svg>';
  }

  var btnRpSaveTrack = document.getElementById('btn-rp-save-track');
  if (btnRpSaveTrack) {
    btnRpSaveTrack.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!state.currentTrack) return;
      const inFav = (state.favorites || []).some(f => isSameTrack(f, state.currentTrack));
      const inPl = (state.playlists || []).some(p => (p.tracks || []).some(t => isSameTrack(t, state.currentTrack)));
      if (!inFav && !inPl) {
        toggleFavoriteTrack(state.currentTrack);
      }
      openAddToPlaylistModal(state.currentTrack);
      updateRpSaveButton();
    });
  }

  function setNavCount(node, count) {
    if (!node) return;
    node.textContent = count;
    const nav = node.closest('.nav-item');
    node.hidden = !count || !!(nav && nav.classList.contains('active'));
  }

  function updateFavoritesBadge() {
    setNavCount(el.favoritesCount, state.favorites.length);
    if (typeof renderSidebarLibraryFeed === 'function') renderSidebarLibraryFeed();
  }

  var TRACK_SORT_KEYS = { favorites: 'riff_favorites_sort', playlist: 'riff_playlist_sort' };

  function getTrackSortMode(kind) {
    const key = (typeof TRACK_SORT_KEYS !== 'undefined' && TRACK_SORT_KEYS && TRACK_SORT_KEYS[kind]) || (kind ? `riff_${kind}_sort` : null);
    const stored = key ? localStorage.getItem(key) : null;
    const modes = (typeof TRACK_SORT_MODES !== 'undefined' && Array.isArray(TRACK_SORT_MODES)) ? TRACK_SORT_MODES : ['manual', 'title', 'artist', 'album', 'duration', 'date'];
    return modes.includes(stored) ? stored : 'manual';
  }

  function setTrackSortMode(kind, mode) {
    localStorage.setItem(TRACK_SORT_KEYS[kind], TRACK_SORT_MODES.includes(mode) ? mode : 'manual');
  }

  var PINNED_TRACKS_KEY = 'riff_pinned_tracks';

  function pinScopeFor(kind, playlistId) {
    if (kind === 'favorites') return 'favorites';
    if (kind === 'playlist' && playlistId) return 'pl:' + playlistId;
    return '';
  }

  function getPinnedMap() {
    const v = safeJson(PINNED_TRACKS_KEY, {});
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  }

  function currentPinScope() {
    if (state.currentView === 'favorites') return 'favorites';
    if (state.currentView === 'playlist-detail' && state.currentPlaylistId) return 'pl:' + state.currentPlaylistId;
    return '';
  }

  function isTrackPinned(track, scope = currentPinScope()) {
    if (!track || !scope) return false;
    const list = getPinnedMap()[scope];
    const id = getTrackCanonicalId(track);
    return Array.isArray(list) && !!id && list.includes(id);
  }

  function togglePinTrack(track, scope = currentPinScope()) {
    const id = track ? getTrackCanonicalId(track) : '';
    if (!id || !scope) return;
    const map = getPinnedMap();
    const list = Array.isArray(map[scope]) ? map[scope] : [];
    const at = list.indexOf(id);
    if (at >= 0) list.splice(at, 1);
    else list.push(id);
    if (list.length) map[scope] = list;
    else delete map[scope];
    localStorage.setItem(PINNED_TRACKS_KEY, JSON.stringify(map));
    showToast(at >= 0 ? 'Track unpinned' : 'Track pinned');
    if (state.currentView === 'favorites') renderFavoritesView();
    else if (state.currentView === 'playlist-detail' && state.currentPlaylistId) openPlaylistDetail(state.currentPlaylistId);
  }

  function floatPinned(scope, tracks) {
    if (!scope || !Array.isArray(tracks)) return tracks;
    const ids = getPinnedMap()[scope];
    if (!Array.isArray(ids) || ids.length === 0) return tracks;
    const pinned = [];
    const rest = [];
    tracks.forEach(t => {
      const at = ids.indexOf(getTrackCanonicalId(t));
      if (at >= 0) pinned.push({ t, at });
      else rest.push(t);
    });
    if (pinned.length === 0) return tracks;
    pinned.sort((a, b) => b.at - a.at);
    return pinned.map(p => p.t).concat(rest);
  }

  function sortTracksFor(kind, tracks, playlistId) {
    return floatPinned(pinScopeFor(kind, playlistId), sortTracks(tracks, getTrackSortMode(kind)));
  }

  function stampAddedAt(track) {
    return { ...track, addedAt: Date.now() };
  }

  function renderFavoritesView() {
    const query = el.favoritesSearchInput ? el.favoritesSearchInput.value.trim().toLowerCase() : '';
    let filtered = state.favorites;
    if (query) {
      filtered = state.favorites.filter(t =>
      (t.title && t.title.toLowerCase().includes(query)) ||
      (t.artist && t.artist.toLowerCase().includes(query))
      );
    }
    filtered = sortTracksFor('favorites', filtered);
    if (el.favoritesSort) {
      el.favoritesSort.value = getTrackSortMode('favorites');
      const favLabel = document.getElementById('favorites-sort-label');
      const favMenu = document.getElementById('favorites-sort-menu');
      if (favMenu) {
        favMenu.querySelectorAll('.m3-dropdown-option').forEach(opt => {
          const isSel = opt.dataset.value === el.favoritesSort.value;
          opt.classList.toggle('selected', isSel);
          if (isSel && favLabel) favLabel.textContent = opt.textContent;
        });
      }
    }
    const totalSec = (state.favorites || []).reduce((acc, t) => acc + (t.duration || 0), 0);
    const totalMin = Math.round(totalSec / 60);
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const totalDurStr = totalSec > 0 ? (hrs > 0 ? `, ${hrs} hr ${mins} min` : `, ${totalMin || 1} min`) : '';
    const userNick = localStorage.getItem('riff_user_nickname') || 'User';
    if (el.favoritesSubtitle) {
      el.favoritesSubtitle.textContent = query
        ? `${userNick} • ${filtered.length} of ${state.favorites.length} songs${totalDurStr}`
        : `${userNick} • ${state.favorites.length} songs${totalDurStr}`;
    }
    if (el.favoritesTracksList) renderTracks(el.favoritesTracksList, filtered, 'favorites');
    setTimeout(() => loadFavoritesRecommendations(false), 150);
  }

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

    selectEl.addEventListener('change', syncUI);
    syncUI();
  }

  var btnToggleFavoritesSearch = document.getElementById('btn-toggle-favorites-search');
  var favoritesSearchBox = document.getElementById('favorites-search-box');
  if (btnToggleFavoritesSearch && favoritesSearchBox) {
    btnToggleFavoritesSearch.addEventListener('click', () => {
      const isOpen = favoritesSearchBox.classList.toggle('open');
      if (isOpen) {
        if (el.favoritesSearchInput) el.favoritesSearchInput.focus();
      } else {
        if (el.favoritesSearchInput) {
          el.favoritesSearchInput.value = '';
          renderFavoritesView();
        }
      }
    });
  }
  if (el.favoritesSearchInput) {
    el.favoritesSearchInput.addEventListener('input', () => renderFavoritesView());
    if (favoritesSearchBox) {
      el.favoritesSearchInput.addEventListener('blur', () => {
        if (!el.favoritesSearchInput.value.trim()) {
          favoritesSearchBox.classList.remove('open');
        }
      });
    }
  }

  if (el.favoritesSort) {
    el.favoritesSort.addEventListener('change', () => {
      setTrackSortMode('favorites', el.favoritesSort.value);
      renderFavoritesView();
    });
    setupSortDropdown('favorites-sort-dropdown', 'favorites-sort-trigger', 'favorites-sort-menu', 'favorites-sort-label', el.favoritesSort);
  }

  var favoritesRecsCached = null;
  var isAddingFavRec = false;

  function renderFavoritesRecsRows(recs, listEl, sec) {
    if (!listEl) return;
    if (listEl._renderedRecs === recs && listEl.children.length > 0) return;
    listEl._renderedRecs = recs;
    listEl.innerHTML = '';
    if (!recs || recs.length === 0) {
      if (sec) sec.classList.add('hidden');
      return;
    }
    if (sec) sec.classList.remove('hidden');

    const currentCanonicalId = state.currentTrack ? getTrackCanonicalId(state.currentTrack) : '';
    recs.forEach((track, idx) => {
      const row = createTrackRow(track, idx, currentCanonicalId, 'favorites-rec', recs, listEl);
      const actions = row.querySelector('.track-row-actions');
      if (actions) {
        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'btn-add-rec-to-pl sp-quiet-icon-btn';
        addBtn.title = 'Add to Liked Songs';
        addBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
        addBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();

          if (Array.isArray(favoritesRecsCached)) {
            const cIdx = favoritesRecsCached.findIndex(t => (t.id && t.id === track.id) || (typeof isSameTrack === 'function' && isSameTrack(t, track)));
            if (cIdx !== -1) favoritesRecsCached.splice(cIdx, 1);
          }

          row.remove();
          if (listEl.querySelectorAll('.track-row').length === 0 && sec) {
            sec.classList.add('hidden');
          }

          isAddingFavRec = true;
          try {
            toggleFavoriteTrack(track);
          } finally {
            isAddingFavRec = false;
          }
        });
        actions.appendChild(addBtn);
      }
      listEl.appendChild(row);
    });
  }

  async function loadFavoritesRecommendations(forceRefresh = false) {
    const sec = document.getElementById('favorites-recs-section');
    const listEl = document.getElementById('favorites-recs-list');
    if (!sec || !listEl) return;
    if (isAddingFavRec) return;

    if (localStorage.getItem('riff_show_fav_recs') === '0' || !state.favorites || !state.favorites.length) {
      sec.classList.add('hidden');
      return;
    }

    sec.classList.remove('hidden');

    if (!forceRefresh && favoritesRecsCached) {
      renderFavoritesRecsRows(favoritesRecsCached, listEl, sec);
      return;
    }

    const rawSeeds = [...state.favorites.slice(0, 3), ...state.favorites.slice(-3)];
    const seedMap = new Map();
    for (const t of rawSeeds) {
      if (!t) continue;
      const cid = (typeof getTrackCanonicalId === 'function' ? getTrackCanonicalId(t) : '') || t.id || `${t.artist}-${t.title}`;
      if (!seedMap.has(cid)) {
        seedMap.set(cid, {
          artist: t.artist || '',
          title: t.title || '',
          id: t.id || cid,
          weight: 3
        });
      }
    }
    const seeds = Array.from(seedMap.values());

    const avoid = {
      ids: state.favorites.map(t => t && t.id).filter(Boolean),
      keys: state.favorites.map(t => t && (typeof getTrackNormalizedKey === 'function' ? getTrackNormalizedKey(t.artist, t.title) : `${t.artist} - ${t.title}`)).filter(Boolean)
    };

    let recs = [];
    try {
      const port = state.serverPort || 38472;
      const res = await fetch(`http://127.0.0.1:${port}/api/vibe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seeds, avoid, limit: 10, refresh: forceRefresh })
      });
      const data = await res.json();
      if (data && data.success && Array.isArray(data.tracks)) {
        const existingIds = new Set(state.favorites.map(t => t && t.id).filter(Boolean));
        const existingCanon = new Set(state.favorites.map(t => t && (typeof getTrackCanonicalId === 'function' ? getTrackCanonicalId(t) : t.id)).filter(Boolean));
        const existingKeys = new Set(state.favorites.map(t => t && (typeof getTrackNormalizedKey === 'function' ? getTrackNormalizedKey(t.artist, t.title) : '')).filter(Boolean));

        recs = data.tracks.filter(t => {
          if (!t) return false;
          const cid = typeof getTrackCanonicalId === 'function' ? getTrackCanonicalId(t) : t.id;
          const k = typeof getTrackNormalizedKey === 'function' ? getTrackNormalizedKey(t.artist, t.title) : '';
          if (t.id && existingIds.has(t.id)) return false;
          if (cid && existingCanon.has(cid)) return false;
          if (k && existingKeys.has(k)) return false;
          return true;
        }).slice(0, 10);
      }
    } catch (err) {
      console.error('Failed to fetch favorites recommendations', err);
    }

    favoritesRecsCached = recs;
    if (state.currentView === 'favorites') {
      renderFavoritesRecsRows(recs, listEl, sec);
    }
  }

  var btnRefreshFavoritesRecs = document.getElementById('btn-refresh-favorites-recs');
  if (btnRefreshFavoritesRecs) {
    btnRefreshFavoritesRecs.addEventListener('click', () => {
      loadFavoritesRecommendations(true);
    });
  }

  var btnPlayFavorites = document.getElementById('btn-play-favorites');
  if (btnPlayFavorites) {
    btnPlayFavorites.addEventListener('click', () => {
      if (!state.favorites || !state.favorites.length) return;
      const list = sortTracksFor('favorites', state.favorites);
      state.isRadioQueue = false;
      state.queueHistory = [];
      if (state.isShuffle) {
        state.isShuffle = false;
        localStorage.setItem('riff_shuffle', '0');
        if (el.btnShuffle) el.btnShuffle.classList.remove('active');
      }
      playTrack(list[0], list, 0, 'favorites');
    });
  }

  var btnShuffleFavorites = document.getElementById('btn-shuffle-favorites');
  if (btnShuffleFavorites) {
    btnShuffleFavorites.addEventListener('click', () => {
      if (!state.favorites || !state.favorites.length) return;
      const list = sortTracksFor('favorites', state.favorites);
      const shuffled = [...list];
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
      playTrack(shuffled[0], shuffled, 0, 'favorites');
    });
  }

  function openFavoritesInAppMenu(e) {
    const items = [
      {
        id: 'rescan-source',
        label: 'Re-search streaming tracks',
        icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6"/><path d="M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>',
        action: () => {
          rescanTracksToCurrentPlatform(state.favorites, 'Liked Songs', () => {
            localStorage.setItem('devsize_favorites', JSON.stringify(state.favorites));
            if (state.currentView === 'favorites') renderFavoritesView();
          });
        }
      },
      {
        id: 'download',
        label: 'Download all',
        icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
        action: () => document.getElementById('btn-download-favorites')?.click()
      }
    ];
    showInAppContextMenu(e, items);
  }
  window.openFavoritesInAppMenu = openFavoritesInAppMenu;

  var btnFavoritesMore = document.getElementById('btn-favorites-more');
  if (btnFavoritesMore) {
    btnFavoritesMore.addEventListener('click', (e) => {
      openFavoritesInAppMenu(e);
    });
  }

  var favoritesPlaylistHeader = document.getElementById('favorites-playlist-header');
  if (favoritesPlaylistHeader) {
    favoritesPlaylistHeader.addEventListener('contextmenu', (e) => {
      openFavoritesInAppMenu(e);
    });
  }

  var btnDownloadFavorites = document.getElementById('btn-download-favorites');
  if (btnDownloadFavorites) {
    btnDownloadFavorites.addEventListener('click', () => {
      openDownloadAllModal({ name: 'Liked Songs', tracks: state.favorites });
    });
  }


  function updateHistoryBadge() {
    setNavCount(el.historyCount, state.history.length);
    if (typeof renderSidebarLibraryFeed === 'function') renderSidebarLibraryFeed();
  }

  function renderHistoryView() {
    updateHistoryBadge();
    if (el.historyTracksList) renderTracks(el.historyTracksList, state.history, 'history');
  }


  function updateLocalBadge() {
    setNavCount(el.localCount, (state.localTracks && state.localTracks.length) || 0);
  }

  function refreshNavBadges() {
    if (typeof updateFavoritesBadge === 'function') updateFavoritesBadge();
    if (typeof updateAlbumsCount === 'function') updateAlbumsCount();
    if (typeof updateLocalBadge === 'function') updateLocalBadge();
    if (typeof updateHistoryBadge === 'function') updateHistoryBadge();
    if (typeof updateQueueBadge === 'function') updateQueueBadge();
  }

  function mergeLocalFiles(newTracks) {
    if (!Array.isArray(newTracks) || newTracks.length === 0) return;
    if (!Array.isArray(state.localFiles)) state.localFiles = [];
    if (!Array.isArray(state.localTracks)) state.localTracks = [];

    

    try {
      const removedBlacklist = safeJson('riff_removed_local_paths', []);
      if (Array.isArray(removedBlacklist) && removedBlacklist.length > 0) {
        const addedSet = new Set();
        for (const t of newTracks) {
          if (!t) continue;
          if (t.path) addedSet.add(String(t.path));
          if (t.filePath) addedSet.add(String(t.filePath));
          if (t.url) addedSet.add(String(t.url));
          if (t.id) addedSet.add(String(t.id));
        }
        const updatedBlacklist = removedBlacklist.filter(p => !addedSet.has(String(p)));
        localStorage.setItem('riff_removed_local_paths', JSON.stringify(updatedBlacklist));
      }
    } catch (_) {}

    const existingPaths = new Set(
      [...(state.localFiles || []), ...(state.localTracks || [])]
        .map(t => t.path || t.filePath || t.url)
        .filter(Boolean)
    );
    let added = 0;
    for (const track of newTracks) {
      const p = track && (track.path || track.filePath || track.url);
      if (track && p && !existingPaths.has(p)) {
        state.localFiles.push(track);
        existingPaths.add(p);
        added++;
      }
    }
    state.localTracks = state.localFiles;
    const serialized = JSON.stringify(state.localFiles);
    try {
      localStorage.setItem('riff_local_files', serialized);
      localStorage.setItem('devsize_local_files', serialized);
      localStorage.setItem('riff_local_tracks', serialized);
      localStorage.setItem('devsize_local_tracks', serialized);
      if (typeof saveLocalTracks === 'function') saveLocalTracks();
    } catch (_) {}
    renderLocalFiles();
    if (added > 0) {
      showToast(`Added ${added} track${added === 1 ? '' : 's'}`);
    }
  }

  async function addLocalFolder() {
    if (!window.electronAPI || !window.electronAPI.pickLocalFolder) return;
    try {
      const tracks = await window.electronAPI.pickLocalFolder();
      if (tracks && tracks.length > 0) {
        mergeLocalFiles(tracks);
      }
    } catch (e) {
      console.warn('Pick local folder error:', e);
    }
  }

  async function addLocalFiles() {
    if (window.electronAPI && window.electronAPI.pickLocalFiles) {
      try {
        const tracks = await window.electronAPI.pickLocalFiles();
        if (tracks && tracks.length > 0) {
          mergeLocalFiles(tracks);
        }
      } catch (e) {
        console.warn('Pick local files error:', e);
      }
    }
  }

  var localRescanDone = false;

  async function renderLocalFiles(forceFetch = false) {
    if (!Array.isArray(state.localFiles)) {
      state.localFiles = safeArray('riff_local_files');
    }

    const removedBlacklist = new Set(safeJson('riff_removed_local_paths', []).map(String));
    const shouldKeepLocal = (t) => {
      if (!t) return false;
      const p = String(t.path || t.filePath || t.url || '');
      const id = String(t.id || '');
      return (!p || !removedBlacklist.has(p)) && (!id || !removedBlacklist.has(id));
    };

    if (removedBlacklist.size > 0) {
      if (Array.isArray(state.localFiles)) state.localFiles = state.localFiles.filter(shouldKeepLocal);
      if (Array.isArray(state.localTracks)) state.localTracks = state.localTracks.filter(shouldKeepLocal);
    }

    if (state.localFiles.length > 0) {
      state.localTracks = state.localFiles;
    } else if (Array.isArray(state.localTracks) && state.localTracks.length > 0) {
      state.localFiles = state.localTracks;
    }

    if (!localRescanDone && window.electronAPI && window.electronAPI.rescanLocalMetadata && state.localFiles.length > 0 && state.localFiles.length <= 150) {
      localRescanDone = true;
      const needRescan = state.localFiles.filter(t => t.path && (!t.thumbnail || t.artist === 'Unknown Artist')).slice(0, 60);
      if (needRescan.length > 0) {
        const paths = needRescan.map(t => t.path);
        window.electronAPI.rescanLocalMetadata(paths).then(rescannedTracks => {
          if (Array.isArray(rescannedTracks) && rescannedTracks.length > 0) {
            const map = new Map(rescannedTracks.filter(shouldKeepLocal).map(t => [t.path, t]));
            let updated = false;
            state.localFiles.forEach((t, i) => {
              if (t.path && map.has(t.path)) {
                const fresh = map.get(t.path);
                state.localFiles[i] = { ...t, ...fresh };
                updated = true;
              }
            });
            if (updated) {
              const serialized = JSON.stringify(state.localFiles);
              localStorage.setItem('riff_local_files', serialized);
              localStorage.setItem('devsize_local_files', serialized);
              localStorage.setItem('riff_local_tracks', serialized);
              localStorage.setItem('devsize_local_tracks', serialized);
              state.localTracks = state.localFiles;
              if (state.currentView === 'local') {
                renderLocalFiles();
              }
            }
          }
        }).catch(err => console.warn('Rescan local metadata error:', err));
      }
    }

    const localAlbumsRow = el.localAlbumsRow || document.getElementById('local-albums-row');
    if (localAlbumsRow) {
      const albumMap = new Map();
      (state.localFiles || []).forEach(t => {
        const albName = (t.album || '').trim();
        if (!albName) return;
        if (!albumMap.has(albName)) {
          albumMap.set(albName, {
            name: albName,
            artist: t.artist || '',
            cover: t.cover || t.thumbnail || '',
            tracks: []
          });
        }
        const albObj = albumMap.get(albName);
        if (!albObj.cover && (t.cover || t.thumbnail)) {
          albObj.cover = t.cover || t.thumbnail;
        }
        albObj.tracks.push(t);
      });

      for (const [key, alb] of Array.from(albumMap.entries())) {
        if (!(alb.tracks.length >= 2 || alb.cover)) {
          albumMap.delete(key);
        }
      }

      if (albumMap.size > 0) {
        localAlbumsRow.style.display = 'flex';
        localAlbumsRow.innerHTML = Array.from(albumMap.values()).slice(0, 30).map(alb => {
          const count = alb.tracks.length;
          const sub = alb.artist ? `${escapeHtml(alb.artist)} · ${count} track${count === 1 ? '' : 's'}` : `${count} track${count === 1 ? '' : 's'}`;
          return `
            <div class="search-album-card" role="button" tabindex="0" data-album="${escapeHtml(alb.name)}">
              <div class="search-album-cover-box">
                <div class="search-album-fallback" style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:var(--md-sys-color-surface-container-high);">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--md-sys-color-outline);opacity:0.65;">
                    <circle cx="12" cy="12" r="10"></circle>
                    <circle cx="12" cy="12" r="7"></circle>
                    <circle cx="12" cy="12" r="4"></circle>
                    <circle cx="12" cy="12" r="1.5" fill="currentColor"></circle>
                  </svg>
                </div>
                ${alb.cover ? `<img class="search-album-cover" src="${escapeHtml(alb.cover)}" alt="${escapeHtml(alb.name)}" loading="lazy" onerror="this.remove()" />` : ''}
              </div>
              <div class="search-album-info">
                <span class="search-album-title" title="${escapeHtml(alb.name)}">${escapeHtml(alb.name)}</span>
                <span class="search-album-sub" title="${sub}">${sub}</span>
              </div>
            </div>
          `;
        }).join('');

        localAlbumsRow.querySelectorAll('.search-album-card').forEach(card => {
          const albName = card.dataset.album;
          const alb = albumMap.get(albName);
          if (!alb) return;
          const openThisAlbum = () => {
            const sortedTracks = [...alb.tracks].sort((a, b) => (a.trackNumber || 0) - (b.trackNumber || 0));
            openAlbum({
              id: 'local_alb_' + alb.name,
              title: alb.name,
              artist: alb.artist,
              cover: alb.cover,
              tracks: sortedTracks,
              type: 'Local Album'
            });
          };
          card.addEventListener('click', openThisAlbum);
          card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              openThisAlbum();
            }
          });
        });
      } else {
        localAlbumsRow.style.display = 'none';
        localAlbumsRow.innerHTML = '';
      }
    }

    updateLocalBadge();
    const query = el.localSearchInput ? el.localSearchInput.value.trim().toLowerCase() : '';
    const allTracks = (state.localFiles && state.localFiles.length > 0) ? state.localFiles : (state.localTracks || []);
    let filtered = allTracks;
    if (query) {
      filtered = filtered.filter(t =>
        (t.title && t.title.toLowerCase().includes(query)) ||
        (t.artist && t.artist.toLowerCase().includes(query)) ||
        (t.album && t.album.toLowerCase().includes(query))
      );
    }
    const localSortMode = localStorage.getItem('riff_local_sort') || 'manual';
    if (localSortMode === 'title-asc') {
      filtered = [...filtered].sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    } else if (localSortMode === 'added-desc') {
      filtered = [...filtered].reverse();
    } else if (localSortMode === 'added-asc') {
      filtered = [...filtered];
    }
    const localSortEl = el.localSort || document.getElementById('local-sort');
    if (localSortEl) {
      localSortEl.value = localSortMode;
      const localLabel = document.getElementById('local-sort-label');
      const localMenu = document.getElementById('local-sort-menu');
      if (localMenu) {
        localMenu.querySelectorAll('.m3-dropdown-option').forEach(opt => {
          const isSel = opt.dataset.value === localSortMode;
          opt.classList.toggle('selected', isSel);
          if (isSel && localLabel) localLabel.textContent = opt.textContent;
        });
      }
    }
    if (el.localSubtitle) {
      el.localSubtitle.textContent = query
        ? `${filtered.length} of ${allTracks.length} tracks`
        : `${allTracks.length} tracks in library`;
    }
    if (el.localTracksList) {
      if (allTracks.length === 0) {
        el.localTracksList.style.paddingTop = '0px';
        el.localTracksList.style.paddingBottom = '0px';
        el.localTracksList.innerHTML = `
          <div class="empty-hint" style="display:flex;flex-direction:column;align-items:center;gap:12px;">
            <span>No local tracks in library yet.</span>
            <div style="display:inline-flex;align-items:center;gap:10px;">
              <button class="btn-pill-primary" id="btn-add-local-files-empty">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                Add files
              </button>
              <button class="btn-outline-pill" id="btn-add-local-folder-empty" type="button" style="display:inline-flex;align-items:center;gap:6px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg><span>Add folder</span></button>
            </div>
          </div>`;
        const emptyBtn = el.localTracksList.querySelector('#btn-add-local-files-empty');
        if (emptyBtn) emptyBtn.addEventListener('click', addLocalFiles);
        const emptyFolderBtn = el.localTracksList.querySelector('#btn-add-local-folder-empty');
        if (emptyFolderBtn) emptyFolderBtn.addEventListener('click', addLocalFolder);
      } else {
        renderTracks(el.localTracksList, filtered, 'local');
      }
    }
  }

  var renderLocalTracks = renderLocalFiles;
  window.renderLocalTracks = renderLocalTracks;
  var renderLocalView = renderLocalFiles;
  window.renderLocalFiles = renderLocalFiles;
  window.renderLocalView = renderLocalView;

  var btnToggleLocalSearch = document.getElementById('btn-toggle-local-search');
  var localSearchBox = document.getElementById('local-search-box');
  if (btnToggleLocalSearch && localSearchBox) {
    btnToggleLocalSearch.addEventListener('click', () => {
      const isOpen = localSearchBox.classList.toggle('open');
      if (isOpen) {
        if (el.localSearchInput) el.localSearchInput.focus();
      } else {
        if (el.localSearchInput) {
          el.localSearchInput.value = '';
          renderLocalFiles(false);
        }
      }
    });
  }
  if (el.localSearchInput) {
    el.localSearchInput.addEventListener('input', () => renderLocalView(false));
    if (localSearchBox) {
      el.localSearchInput.addEventListener('blur', () => {
        if (!el.localSearchInput.value.trim()) {
          localSearchBox.classList.remove('open');
        }
      });
    }
  }

  var localSortSelect = document.getElementById('local-sort');
  if (localSortSelect) {
    localSortSelect.value = localStorage.getItem('riff_local_sort') || 'manual';
    localSortSelect.addEventListener('change', () => {
      const val = localSortSelect.value;
      localStorage.setItem('riff_local_sort', val);
      renderLocalFiles(false);
    });
    setupSortDropdown('local-sort-dropdown', 'local-sort-trigger', 'local-sort-menu', 'local-sort-label', localSortSelect);
  }

  async function importLocalFiles() {
    if (!window.electronAPI || !window.electronAPI.importAudioFiles) return;
    try {
      const items = await window.electronAPI.importAudioFiles();
      if (!items || items.length === 0) return;

      await fetch(`http://127.0.0.1:${state.serverPort}/api/library-add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items })
      });

      if (state.currentView === 'local') renderLocalView(true);

      let idx = 0;
      async function worker() {
        while (idx < items.length) {
          const item = items[idx++];
          if (!item || !item.id) continue;
          await new Promise(resolve => {
            const url = `http://127.0.0.1:${state.serverPort}/api/library-file?id=${encodeURIComponent(item.id)}`;
            const a = new Audio(url);
            a.preload = 'metadata';
            let done = false;
            const finish = () => {
              if (done) return;
              done = true;
              a.src = '';
              resolve();
            };
            a.onloadedmetadata = async () => {
              const dur = Math.round(a.duration || 0);
              if (dur > 0) {
                try {
                  await fetch(`http://127.0.0.1:${state.serverPort}/api/library-update`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: item.id, duration: dur })
                  });
                } catch (e) {}
              }
              finish();
            };
            a.onerror = () => finish();
            setTimeout(finish, 5000);
          });
        }
      }
      await Promise.all([worker(), worker()]);

      await renderLocalView(true);
      showToast(`Added ${items.length} tracks`);
    } catch (e) {
      console.warn('Import audio files error:', e);
    }
  }

  function proxiedThumb(src) {
    if (!src || typeof src !== 'string') return '';
    return src;
  }

  function getTrackThumbUrl(track) {
    if (!track) return '';
    const o = getTrackArt(track).cover;
    if (o) return proxiedThumb(o, track);
    if (track.localThumbnail) return track.localThumbnail;
    const base = track.thumbnail || track.cover || track.image || track.artworkUrl || '';
    if (base) return proxiedThumb(base, track);
    if (track.id && /^[a-zA-Z0-9_-]{11}$/.test(track.id)) {
      return `https://i.ytimg.com/vi/${track.id}/hqdefault.jpg`;
    }
    return '';
  }


  function renderPlaylistCover(container, playlist, size = 64) {
    if (!container) return;
    container.innerHTML = '';
    container.classList.add('playlist-cover-art');

    function renderFallback() {
      container.innerHTML = '';
      container.classList.remove('cover-single', 'cover-empty');
      const tracks = (playlist && playlist.tracks) ? playlist.tracks : [];
      let firstThumb = null;
      for (const t of tracks) {
        const src = getTrackThumbUrl(t);
        if (src) {
          firstThumb = src;
          break;
        }
      }

      if (firstThumb) {
        container.classList.add('cover-single');
        const img = document.createElement('img');
        img.className = 'cover-single-img';
        img.src = firstThumb;
        img.alt = '';
        img.loading = 'lazy';
        img.style.objectFit = 'cover';
        img.onerror = () => {
          container.classList.remove('cover-single');
          container.classList.add('cover-empty');
          container.innerHTML = `<svg width="${Math.round(size * 0.45)}" height="${Math.round(size * 0.45)}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`;
        };
        container.appendChild(img);
      } else {
        container.classList.add('cover-empty');
        container.innerHTML = `
          <svg width="${Math.round(size * 0.45)}" height="${Math.round(size * 0.45)}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 18V5l12-2v13"></path>
            <circle cx="6" cy="18" r="3"></circle>
            <circle cx="18" cy="16" r="3"></circle>
          </svg>
        `;
      }
    }

    if (playlist && playlist.cover && typeof playlist.cover === 'string' && playlist.cover.trim()) {
      container.classList.add('cover-single');
      const img = document.createElement('img');
      img.className = 'cover-single-img';
      img.src = playlist.cover.trim();
      img.alt = '';
      img.loading = 'lazy';
      img.style.objectFit = 'cover';
      img.onerror = () => {
        renderFallback();
      };
      container.appendChild(img);
      return;
    }

    renderFallback();
  }

  var lastPlaylistsSig = '';
  function renderPlaylistsList() {
    if (typeof updateRpSaveButton === 'function') updateRpSaveButton();
    if (typeof renderSidebarLibraryFeed === 'function') renderSidebarLibraryFeed();
    if (!el.playlistsList) return;
    const structureSig = (state.playlists || []).map(p => `${p.id}:${p.name}:${p.cover || ''}:${isPlaylistPinned(p.id)}:${p.tracks && p.tracks.length > 0 ? (p.tracks[0]?.id || '1') : '0'}`).join('|');
    if (structureSig === lastPlaylistsSig && el.playlistsList.children.length > 0) {
      const pinSvg = '<svg class="sb-lib-pin-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>';
      el.playlistsList.querySelectorAll('.playlist-item').forEach(item => {
        const isCur = state.currentView === 'playlist-detail' && item.dataset.playlistId === state.currentPlaylistId;
        item.classList.toggle('active', isCur);
        const pl = (state.playlists || []).find(p => p.id === item.dataset.playlistId);
        if (pl) {
          const countEl = item.querySelector('.playlist-item-count');
          if (countEl) {
            const trackCount = (pl.tracks || []).length;
            const isPinned = isPlaylistPinned(pl.id);
            countEl.innerHTML = `${isPinned ? pinSvg : ''}${trackCount} track${trackCount === 1 ? '' : 's'}`;
          }
        }
      });
      return;
    }
    lastPlaylistsSig = structureSig;
    const prevListScrollTop = el.playlistsList.scrollTop;
    el.playlistsList.innerHTML = '';
    if (!state.playlists || state.playlists.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'playlists-empty-note';
      emptyMsg.style.cssText = 'padding: 24px 12px; text-align: center; color: var(--md-sys-color-on-surface-variant); font-size: calc(13px * var(--font-scale, 1));';
      emptyMsg.textContent = 'No playlists yet';
      el.playlistsList.appendChild(emptyMsg);
      return;
    }
    const pinSvg = '<svg class="sb-lib-pin-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>';
    const sortedPlaylists = [...state.playlists].sort((a, b) => {
      const aPinned = isPlaylistPinned(a.id) ? 1 : 0;
      const bPinned = isPlaylistPinned(b.id) ? 1 : 0;
      return bPinned - aPinned;
    });
    sortedPlaylists.forEach(pl => {
      const item = document.createElement('div');
      item.className = 'playlist-item';
      item.dataset.playlistId = pl.id;
      if (state.currentView === 'playlist-detail' && state.currentPlaylistId === pl.id) {
        item.classList.add('active');
      }

      const thumbEl = document.createElement('div');
      thumbEl.className = 'playlist-item-thumb';
      renderPlaylistCover(thumbEl, pl, 44);

      const infoEl = document.createElement('div');
      infoEl.className = 'playlist-item-info';
      const trackCount = (pl.tracks || []).length;
      const isPinned = isPlaylistPinned(pl.id);
      infoEl.innerHTML = `
        <span class="playlist-item-name">${escapeHtml(pl.name || 'untitled')}</span>
        <span class="playlist-item-count" style="display:inline-flex;align-items:center;gap:4px;">${isPinned ? pinSvg : ''}${trackCount} track${trackCount === 1 ? '' : 's'}</span>
      `;

      item.appendChild(thumbEl);
      item.appendChild(infoEl);

      item.addEventListener('click', () => {
        openPlaylistDetail(pl.id);
      });
      item.addEventListener('contextmenu', (e) => {
        openPlaylistInAppMenu(e, pl.id);
      });
      el.playlistsList.appendChild(item);
    });
    if (prevListScrollTop > 0) el.playlistsList.scrollTop = prevListScrollTop;
    refreshOverflowFades(el.playlistsList);
  }

  function getPlaylistCurrentSort(plId) {
    if (typeof getTrackSortMode === 'function') {
      return getTrackSortMode('playlist', plId) || (el.playlistSort ? el.playlistSort.value : 'manual');
    }
    return (el.playlistSort && el.playlistSort.value) || 'manual';
  }

  function triggerPlaylistMenuAction(act, plId) {
    if (!act) return;
    if (plId && state.currentPlaylistId !== plId) {
      state.currentPlaylistId = plId;
    }
    if (act.startsWith('sort-')) {
      const sortVal = act.replace('sort-', '');
      if (el.playlistSort) {
        el.playlistSort.value = sortVal;
        el.playlistSort.dispatchEvent(new Event('change', { bubbles: true }));
      }
    } else if (act === 'download') {
      const btn = document.getElementById('btn-download-playlist');
      if (btn) btn.click();
    } else if (act === 'export') {
      const btn = document.getElementById('btn-export-playlist');
      if (btn) btn.click();
    } else if (act === 'delete') {
      const btn = document.getElementById('btn-delete-playlist');
      if (btn) btn.click();
    }
  }

  function initListReordering({ container, itemSelector, setOrder, canDragItem, isFilterActive }) {
    if (!container) return;

    let draggedItem = null;
    let startX = 0;
    let startY = 0;
    let activePointerId = null;
    let isDragging = false;
    let pressTimer = null;
    let autoScrollTimer = null;
    let suppressClick = false;
    let startIndex = -1;
    let targetIndex = -1;
    let itemMetrics = [];
    let items = [];
    let draggedHeight = 0;
    let draggedDy = 0;
    let startScrollTop = 0;
    let lastClientY = 0;

    const scrollParent = container.closest('.main-content, .rail-drawer') || container;

    window.addEventListener('click', (e) => {
      if (suppressClick) {
        e.stopImmediatePropagation();
        e.preventDefault();
        suppressClick = false;
      }
    }, true);

    const startDrag = () => {
      if (!draggedItem || isDragging) return;
      isDragging = true;
      suppressClick = true;
      container._isDraggingReorder = true;
      try {
        if (activePointerId !== null && draggedItem.setPointerCapture) {
          draggedItem.setPointerCapture(activePointerId);
        }
      } catch (e) {}

      container.style.userSelect = 'none';
      draggedItem.classList.add('is-dragging');

      items = Array.from(container.querySelectorAll(itemSelector)).filter(el => !canDragItem || canDragItem(el));
      startIndex = items.indexOf(draggedItem);
      targetIndex = startIndex;
      draggedHeight = draggedItem.offsetHeight;
      draggedDy = 0;
      startScrollTop = scrollParent.scrollTop;

      itemMetrics = items.map((el, i) => {
        const top = el.getBoundingClientRect().top;
        return { el, index: i, top, startTop: top, height: el.offsetHeight };
      });
    };

    const onPointerDown = (e) => {
      if (e.button !== 0) return;
      if (isFilterActive && isFilterActive()) return;

      const item = e.target.closest(itemSelector);
      if (!item || item.parentElement !== container) return;
      if (canDragItem && !canDragItem(item)) return;

      if (e.target.closest('button, input, select, textarea, .btn-icon-pill, .track-fav, .track-download-btn, .btn-rename-p, .btn-delete-p')) return;

      draggedItem = item;
      startX = e.clientX;
      startY = e.clientY;
      lastClientY = e.clientY;
      activePointerId = e.pointerId;
      isDragging = false;

      pressTimer = setTimeout(() => {
        startDrag();
      }, 250);

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
    };

    const updateTarget = () => {
      if (!draggedItem || itemMetrics.length <= 1) return;
      itemMetrics.forEach(metric => {
        metric.top = metric.startTop - (scrollParent.scrollTop - startScrollTop);
      });
      const currentCenter = draggedItem.getBoundingClientRect().top + draggedHeight / 2;
      let newTarget = 0;
      for (let i = 0; i < itemMetrics.length; i++) {
        const metric = itemMetrics[i];
        if (currentCenter > metric.top + metric.height / 2) newTarget = i;
      }
      newTarget = Math.max(0, Math.min(newTarget, itemMetrics.length - 1));
      if (newTarget === targetIndex) return;
      targetIndex = newTarget;
      const shiftDistance = itemMetrics.length > 1 && Math.abs(itemMetrics[1].top - itemMetrics[0].top) > 0
        ? Math.abs(itemMetrics[1].top - itemMetrics[0].top)
        : draggedHeight;

      itemMetrics.forEach(metric => {
        if (metric.el === draggedItem) return;
        if (startIndex < targetIndex && metric.index > startIndex && metric.index <= targetIndex) {
          metric.el.style.setProperty('transform', `translate3d(0, -${shiftDistance}px, 0)`, 'important');
          metric.el.style.transition = 'transform 180ms cubic-bezier(0.2, 0, 0, 1)';
        } else if (startIndex > targetIndex && metric.index >= targetIndex && metric.index < startIndex) {
          metric.el.style.setProperty('transform', `translate3d(0, ${shiftDistance}px, 0)`, 'important');
          metric.el.style.transition = 'transform 180ms cubic-bezier(0.2, 0, 0, 1)';
        } else {
          metric.el.style.removeProperty('transform');
          metric.el.style.transition = 'transform 180ms cubic-bezier(0.2, 0, 0, 1)';
        }
      });
    };

    const onPointerMove = (e) => {
      if (!draggedItem) return;

      if (!isDragging) {
        const dist = Math.hypot(e.clientX - startX, e.clientY - startY);
        if (dist > 7) {
          clearTimeout(pressTimer);
          startDrag();
        } else {
          return;
        }
      }

      lastClientY = e.clientY;
      const scrollDelta = scrollParent ? (scrollParent.scrollTop - startScrollTop) : 0;
      const currentDy = (e.clientY - startY) + scrollDelta;
      draggedDy = currentDy;

      if (scrollParent) {
        const scRect = scrollParent.getBoundingClientRect();
        clearInterval(autoScrollTimer);
        if (e.clientY < scRect.top + 40) {
          autoScrollTimer = setInterval(() => {
            const prev = scrollParent.scrollTop;
            scrollParent.scrollTop -= 8;
            if (scrollParent.scrollTop !== prev) {
              const sDelta = scrollParent.scrollTop - startScrollTop;
              const curDy = (lastClientY - startY) + sDelta;
              draggedDy = curDy;
              draggedItem.style.setProperty('transform', `translate3d(0, ${curDy}px, 0) scale(1.02)`, 'important');
              updateTarget();
            }
          }, 16);
        } else if (e.clientY > scRect.bottom - 40) {
          autoScrollTimer = setInterval(() => {
            const prev = scrollParent.scrollTop;
            scrollParent.scrollTop += 8;
            if (scrollParent.scrollTop !== prev) {
              const sDelta = scrollParent.scrollTop - startScrollTop;
              const curDy = (lastClientY - startY) + sDelta;
              draggedDy = curDy;
              draggedItem.style.setProperty('transform', `translate3d(0, ${curDy}px, 0) scale(1.02)`, 'important');
              updateTarget();
            }
          }, 16);
        }
      }

      draggedItem.style.setProperty('transform', `translate3d(0, ${currentDy}px, 0) scale(1.02)`, 'important');
      updateTarget();
    };

    const onPointerUp = () => {
      clearTimeout(pressTimer);
      clearInterval(autoScrollTimer);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);

      if (!draggedItem) return;

      const item = draggedItem;
      const currentActiveId = activePointerId;
      draggedItem = null;
      activePointerId = null;

      try {
        if (currentActiveId !== null && item.hasPointerCapture && item.hasPointerCapture(currentActiveId)) {
          item.releasePointerCapture(currentActiveId);
        }
      } catch (e) {}

      if (isDragging) {
        let targetSlotDy = 0;
        if (targetIndex >= 0 && targetIndex < itemMetrics.length && targetIndex !== startIndex) {
          const currentTop = item.getBoundingClientRect().top - draggedDy;
          targetSlotDy = itemMetrics[targetIndex].top - currentTop;
        }

        item.style.transition = 'transform 160ms cubic-bezier(0.2, 0, 0, 1)';
        item.style.setProperty('transform', `translate3d(0, ${targetSlotDy}px, 0) scale(1)`, 'important');

        setTimeout(() => {
          if (targetIndex !== startIndex && targetIndex >= 0 && targetIndex < items.length) {
            const targetItem = items[targetIndex];
            if (targetIndex > startIndex) {
              targetItem.after(item);
            } else {
              targetItem.before(item);
            }
          }

          item.classList.remove('is-dragging');
          item.style.removeProperty('transform');
          item.style.transition = '';
          item.style.willChange = '';

          items.forEach(el => {
            el.style.removeProperty('transform');
            el.style.transition = '';
          });

          container.style.userSelect = '';
          container.classList.add('no-enter-anim');

          container.querySelectorAll('.track-row').forEach((r, i) => {
            r.dataset.trackIndex = String(i);
            const num = r.querySelector('.track-num-text') || r.querySelector('.track-row-index');
            if (num) num.textContent = String(i + 1);
          });

          if (startIndex !== -1 && targetIndex !== -1 && startIndex !== targetIndex) {
            setOrder(startIndex, targetIndex);
          }

          container._isDraggingReorder = false;
          setTimeout(() => { suppressClick = false; }, 80);
        }, 160);
      } else {
        suppressClick = false;
      }
    };

    container.addEventListener('pointerdown', onPointerDown);
  }

  initListReordering({
    container: el.playlistsList,
    itemSelector: '.playlist-item',
    setOrder: (fromIdx, toIdx) => {
      const [moved] = state.playlists.splice(fromIdx, 1);
      state.playlists.splice(toIdx, 0, moved);
      localStorage.setItem('devsize_playlists', JSON.stringify(state.playlists));
    }
  });

  initListReordering({
    container: el.presetsContainer,
    itemSelector: '.preset-chip',
    canDragItem: (chip) => chip.dataset.isCustom === 'true',
    setOrder: (fromIdx, toIdx) => {
      const [moved] = state.customPresets.splice(fromIdx, 1);
      state.customPresets.splice(toIdx, 0, moved);
      localStorage.setItem('devsize_custom_presets', JSON.stringify(state.customPresets));
    }
  });

  enableTrackSort({
    container: el.favoritesTracksList,
    isFilterActive: () => Boolean(el.favoritesSearchInput && el.favoritesSearchInput.value.trim()),
    onReorder: (fromIdx, toIdx) => {
      if (el.favoritesSort && el.favoritesSort.value !== 'manual') {
        el.favoritesSort.value = 'manual';
        setTrackSortMode('favorites', 'manual');
        const favLabel = document.getElementById('favorites-sort-label');
        if (favLabel) favLabel.textContent = 'Manual order';
        const favMenu = document.getElementById('favorites-sort-menu');
        if (favMenu) {
          favMenu.querySelectorAll('.m3-dropdown-option').forEach(opt => {
            opt.classList.toggle('selected', opt.dataset.value === 'manual');
          });
        }
      }
      const savedScroll = el.mainContent ? el.mainContent.scrollTop : 0;
      const displayed = Array.isArray(el.favoritesTracksList._virtualTracks) ? el.favoritesTracksList._virtualTracks : state.favorites;
      const [moved] = displayed.splice(fromIdx, 1);
      displayed.splice(toIdx, 0, moved);
      state.favorites = displayed.slice();
      localStorage.setItem('devsize_favorites', JSON.stringify(state.favorites));
      el.favoritesTracksList._lastStartIndex = -1;
      el.favoritesTracksList._lastEndIndex = -1;
      if (el.favoritesSubtitle) {
        const totalSec = (state.favorites || []).reduce((acc, t) => acc + (t.duration || 0), 0);
        const totalMin = Math.round(totalSec / 60);
        const hrs = Math.floor(totalSec / 3600);
        const mins = Math.floor((totalSec % 3600) / 60);
        const totalDurStr = totalSec > 0 ? (hrs > 0 ? `, ${hrs} hr ${mins} min` : `, ${totalMin || 1} min`) : '';
        const userNick = localStorage.getItem('riff_user_nickname') || 'User';
        el.favoritesSubtitle.textContent = `${userNick} • ${state.favorites.length} songs${totalDurStr}`;
      }
      if (el.mainContent) el.mainContent.scrollTop = savedScroll;
    }
  });

  enableTrackSort({
    container: el.playlistTracksList,
    isFilterActive: () => Boolean(el.playlistSearchInput && el.playlistSearchInput.value.trim()),
    onReorder: (fromIdx, toIdx) => {
      if (el.playlistSort && el.playlistSort.value !== 'manual') {
        el.playlistSort.value = 'manual';
        setTrackSortMode('playlist', 'manual');
        const plLabel = document.getElementById('playlist-sort-label');
        if (plLabel) plLabel.textContent = 'Manual order';
        const plMenu = document.getElementById('playlist-sort-menu');
        if (plMenu) {
          plMenu.querySelectorAll('.m3-dropdown-option').forEach(opt => {
            opt.classList.toggle('selected', opt.dataset.value === 'manual');
          });
        }
      }
      const savedScroll = el.mainContent ? el.mainContent.scrollTop : 0;
      const pl = state.currentPlaylist || (state.playlists || []).find(p => p.id === state.currentPlaylistId);
      if (pl && pl.tracks) {
        const displayed = Array.isArray(el.playlistTracksList._virtualTracks) ? el.playlistTracksList._virtualTracks : pl.tracks;
        const [moved] = displayed.splice(fromIdx, 1);
        displayed.splice(toIdx, 0, moved);
        pl.tracks = displayed.slice();
        localStorage.setItem('devsize_playlists', JSON.stringify(state.playlists));
        el.playlistTracksList._lastStartIndex = -1;
        el.playlistTracksList._lastEndIndex = -1;
      }
      if (el.mainContent) el.mainContent.scrollTop = savedScroll;
    }
  });

  function createPlaylist(name, initialTracks = [], cover = '', extra = {}) {
    if (!name || !name.trim()) return;
    const newPl = {
      id: 'pl_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      name: name.trim(),
      tracks: Array.isArray(initialTracks)
        ? initialTracks.map(t => (t && typeof t.addedAt === 'number') ? t : stampAddedAt(t))
        : [],
      ...(extra && typeof extra === 'object' ? extra : {})
    };
    if (cover && typeof cover === 'string' && cover.trim()) {
      newPl.cover = cover.trim();
    }
    if ((newPl.importedPlatform || newPl.syncPlatform) && !newPl.importedAt) {
      newPl.importedAt = Date.now();
    }
    state.playlists.push(newPl);
    localStorage.setItem('devsize_playlists', JSON.stringify(state.playlists));
    renderPlaylistsList();
    if (!extra || !extra.skipOpen) {
      openPlaylistDetail(newPl.id);
    }
    if (typeof hydrateMissingPlaylistCovers === 'function') {
      hydrateMissingPlaylistCovers(newPl);
    }
    return newPl;
  }

  function formatRelativeTime(ts) {
    const lang = (localStorage.getItem('riff_ui_lang') || localStorage.getItem('riff_lang') || 'en').toLowerCase();
    if (!ts || typeof ts !== 'number' || isNaN(ts)) {
      if (lang === 'ru') return 'только что';
      if (lang === 'uk') return 'щойно';
      return 'just now';
    }
    const diffSec = Math.floor((Date.now() - ts) / 1000);
    if (diffSec < 60) {
      if (lang === 'ru') return 'только что';
      if (lang === 'uk') return 'щойно';
      return 'just now';
    }
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) {
      if (lang === 'ru') return `${diffMin} мин. назад`;
      if (lang === 'uk') return `${diffMin} хв. тому`;
      return `${diffMin} min ago`;
    }
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) {
      if (lang === 'ru') return `${diffHr} ч. назад`;
      if (lang === 'uk') return `${diffHr} год. тому`;
      return `${diffHr} h ago`;
    }
    const diffDays = Math.floor(diffHr / 24);
    if (diffDays < 30) {
      if (lang === 'ru') return `${diffDays} дн. назад`;
      if (lang === 'uk') return `${diffDays} дн. тому`;
      return `${diffDays} d ago`;
    }
    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths < 12) {
      if (lang === 'ru') return `${diffMonths} мес. назад`;
      if (lang === 'uk') return `${diffMonths} міс. тому`;
      return `${diffMonths} mo ago`;
    }
    const diffYears = Math.floor(diffMonths / 12);
    if (lang === 'ru') return `${diffYears} г. назад`;
    if (lang === 'uk') return `${diffYears} р. тому`;
    return `${diffYears} y ago`;
  }

  function getPlaylistImportInfo(pl) {
    if (!pl || typeof pl !== 'object') return null;

    let platform = pl.importedPlatform || pl.importPlatform;
    const syncPlatform = pl.syncPlatform ? String(pl.syncPlatform).toLowerCase() : '';
    const syncUrl = String(pl.syncUrl || pl.sourceUrl || '').toLowerCase();

    if (!platform && syncPlatform) {
      platform = syncPlatform;
    }

    if (!platform && syncUrl) {
      if (syncUrl.includes('spotify.com')) platform = 'spotify';
      else if (syncUrl.includes('apple.com') || syncUrl.includes('itunes.apple.com')) platform = 'apple';
      else if (syncUrl.includes('music.yandex') || syncUrl.includes('yandex.')) platform = 'yandex';
      else if (syncUrl.includes('vk.com')) platform = 'vk';
      else if (syncUrl.includes('soundcloud.com')) platform = 'soundcloud';
      else if (syncUrl.includes('music.youtube.com')) platform = 'ytmusic';
      else if (syncUrl.includes('youtube.com') || syncUrl.includes('youtu.be')) platform = 'youtube';
      else if (syncUrl.includes('tiktok.com')) platform = 'tiktok';
      else if (syncUrl.includes('deezer.com')) platform = 'deezer';
    }

    if (!platform && pl.importedFrom) {
      platform = pl.importedFrom;
    }

    if (!platform && typeof pl.name === 'string') {
      const lowerName = pl.name.toLowerCase().trim();
      if (lowerName === 'spotify playlist' || lowerName.includes('spotify import')) platform = 'spotify';
      else if (lowerName === 'apple music playlist' || lowerName.includes('apple music')) platform = 'apple';
      else if (lowerName === 'yandex music playlist' || lowerName.includes('yandex music')) platform = 'yandex';
      else if (lowerName === 'vk music' || lowerName.includes('vk import')) platform = 'vk';
      else if (lowerName === 'tiktok track') platform = 'tiktok';
      else if (lowerName === 'imported playlist') platform = 'file';
    }

    if (!platform && pl.isImported) {
      platform = 'file';
    }

    if (!platform) return null;

    platform = String(platform).toLowerCase().trim();
    if (platform === 'applemusic') platform = 'apple';
    if (platform === 'yandexmusic') platform = 'yandex';
    if (platform === 'vkmusic') platform = 'vk';

    let rawTs = pl.importedAt ?? pl.lastSyncedAt ?? pl.createdAt;
    if (!rawTs && Array.isArray(pl.tracks) && pl.tracks[0] && typeof pl.tracks[0].addedAt === 'number') {
      rawTs = pl.tracks[0].addedAt;
    }
    let importedAt = Date.now();
    if (typeof rawTs === 'number' && !isNaN(rawTs) && rawTs > 0) {
      importedAt = rawTs;
    } else if (typeof rawTs === 'string' && rawTs.trim()) {
      const parsed = new Date(rawTs).getTime();
      if (!isNaN(parsed) && parsed > 0) importedAt = parsed;
    }

    return {
      platform,
      importedAt
    };
  }

  function getPlatformIconSvg(platform) {
    const p = String(platform || '').toLowerCase();
    if (p === 'spotify') {
      return '<svg width="20" height="20" viewBox="0 0 24 24" fill="#1ED760"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424c-.18.295-.563.387-.857.207-2.35-1.434-5.308-1.758-8.793-.963-.335.077-.67-.133-.746-.469-.077-.334.132-.67.467-.747 3.812-.871 7.085-.506 9.721 1.107.294.18.387.564.208.865zm1.224-2.72c-.226.367-.706.482-1.072.257-2.687-1.652-6.785-2.131-9.965-1.166-.413.127-.848-.106-.973-.517-.125-.413.108-.848.52-.973 3.632-1.102 8.147-.568 11.233 1.328.366.226.481.707.257 1.071zm.105-2.835C14.692 8.95 8.085 8.731 4.708 9.756c-.494.15-1.018-.129-1.168-.623-.15-.495.13-1.018.624-1.168 3.943-1.197 11.23-.944 15.045 1.32.444.264.59.84.327 1.284-.264.444-.84.59-1.284.327z"/></svg>';
    }
    if (p === 'apple') {
      return '<svg width="20" height="20" viewBox="0 0 24 24" fill="#FA243C"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.58-.71.97-1.7 1.01-2.69-.85.04-1.88.58-2.49 1.29-.54.63-.98 1.64-.86 2.62.95.07 1.76-.51 2.34-1.22z"/></svg>';
    }
    if (p === 'vk') {
      return '<svg width="20" height="20" viewBox="0 0 24 24" fill="#0077FF"><path d="M15.684 0H8.316C1.592 0 0 1.592 0 8.316v7.368C0 22.408 1.592 24 8.316 24h7.368C22.408 24 24 22.408 24 15.684V8.316C24 1.592 22.408 0 15.684 0zm3.692 16.945h-1.668c-.63 0-.824-.5-1.957-1.636-1-.986-1.443-1.113-1.689-1.113-.346 0-.444.1-.444.577v1.547c0 .414-.133.625-1.23.625-1.815 0-3.83-1.101-5.253-3.155-2.14-3.033-2.73-5.319-2.73-5.787 0-.256.1-.495.59-.495h1.668c.444 0 .61.205.78.69.854 2.476 2.28 4.646 2.872 4.646.222 0 .324-.102.324-.662V9.827c-.07-.946-.554-1.026-.554-1.365 0-.166.138-.33.364-.33h2.3c.312 0 .424.164.424.536v3.29c0 .354.156.495.259.495.223 0 .408-.141.818-.55 1.254-1.405 2.148-3.565 2.148-3.565.118-.256.326-.406.77-.406h1.668c.501 0 .607.256.499.614-.205.952-2.186 3.73-2.287 3.883-.242.36-.337.52 0 .967.238.32 1.026.997 1.554 1.611.968 1.121 1.705 2.062 1.902 2.712.197.64-.108.971-.74.971z"/></svg>';
    }
    if (p === 'yandex') {
      return '<svg width="20" height="20" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#FC3F1D"/><path fill="#fff" d="M13.5 17.5h-2.1l-3.2-6.5v6.5H6.2V6.5h2.2l3.2 6.4V6.5h1.9v11z"/></svg>';
    }
    if (p === 'youtube' || p === 'ytmusic') {
      return '<svg width="20" height="20" viewBox="0 0 24 24" fill="#FF0000"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>';
    }
    if (p === 'soundcloud') {
      return '<svg width="20" height="20" viewBox="0 0 24 24" fill="#FF5500"><path d="M11.56 8.87V17h8.77c1.47 0 2.67-1.19 2.67-2.66s-1.2-2.67-2.67-2.67c-.24 0-.46.03-.68.1-.38-1.74-1.92-3.03-3.76-3.03-.89 0-1.72.3-2.39.81-.35-.4-.83-.68-1.94-.68zm-1.5 1.48v6.65h.75V9.75c-.28.16-.54.36-.75.6zm-1.5.73v5.92h.75v-6.3c-.28.11-.53.24-.75.38zm-1.5.38v5.54h.75v-5.74c-.27.05-.52.12-.75.2zm-1.5.21v5.33h.75v-5.42c-.27.01-.52.05-.75.09zm-1.5.17v5.16h.75v-5.2c-.26 0-.51.01-.75.04zm-1.5.34v4.82h.75v-4.88c-.26.01-.51.03-.75.06zm-1.5.4v4.42h.75v-4.47c-.26.01-.5.03-.75.05zm-1.06.65v3.77h.75v-3.8c-.26.01-.5.02-.75.03z"/></svg>';
    }
    if (p === 'tiktok') {
      return '<svg width="20" height="20" viewBox="0 0 24 24"><path fill="#25F4EE" d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" transform="translate(1, 1)"/><path fill="#FE2C55" d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" transform="translate(-1, -1)"/><path fill="#FFFFFF" d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>';
    }
    if (p === 'deezer') {
      return '<svg width="20" height="20" viewBox="0 0 24 24" fill="#A238FF"><path d="M18.8 6.7h4.8v2.7h-4.8zm0 3.7h4.8v2.7h-4.8zm0 3.7h4.8v2.7h-4.8zm0 3.7h4.8v2.7h-4.8zM12.6 10.4h4.8v2.7h-4.8zm0 3.7h4.8v2.7h-4.8zm0 3.7h4.8v2.7h-4.8zM6.3 14.1h4.8v2.7H6.3zm0 3.7h4.8v2.7H6.3zM0 17.8h4.8v2.7H0z"/></svg>';
    }
    return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>';
  }

  async function syncPlaylistTracks(pl) {
    if (!pl || !pl.syncUrl) return;
    try {
      let rawTracks = [];
      let remoteName = '';
      let remoteCover = '';

      const isSpotify = (pl.syncPlatform === 'spotify') || (typeof pl.syncUrl === 'string' && pl.syncUrl.includes('spotify.com'));
      if (isSpotify) {
        const res = await fetch(`http://127.0.0.1:${state.serverPort}/api/spotify-import?url=${encodeURIComponent(pl.syncUrl)}`, { headers: typeof spotifyHeaders !== 'undefined' ? spotifyHeaders : {} });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success || !Array.isArray(data.tracks)) {
          return;
        }
        rawTracks = data.tracks;
        remoteName = data.name || '';
        remoteCover = data.cover || '';
      } else {
        const res = await fetch(`http://127.0.0.1:${state.serverPort}/api/playlist-import?url=${encodeURIComponent(pl.syncUrl)}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data || !data.success || !Array.isArray(data.tracks)) {
          return;
        }
        rawTracks = data.tracks;
        remoteName = data.name || '';
        remoteCover = data.cover || '';
      }

      const foundTracks = await matchSpotifyTracks(rawTracks, remoteName || pl.name, null, { playlistCover: remoteCover || pl.cover || '', silent: true });
      if (!Array.isArray(foundTracks)) return;

      const existingMap = new Map();
      for (const tr of (pl.tracks || [])) {
        const key = (typeof getTrackCanonicalId === 'function' ? getTrackCanonicalId(tr) : '') || `${(tr.artist || '').trim().toLowerCase()} - ${(tr.title || '').trim().toLowerCase()}`;
        if (key) existingMap.set(key, tr);
      }

      const mergedTracks = foundTracks.map(tr => {
        const key = (typeof getTrackCanonicalId === 'function' ? getTrackCanonicalId(tr) : '') || `${(tr.artist || '').trim().toLowerCase()} - ${(tr.title || '').trim().toLowerCase()}`;
        const old = existingMap.get(key);
        if (old) {
          return { ...tr, addedAt: old.addedAt || tr.addedAt || Date.now() };
        }
        return stampAddedAt(tr);
      });

      pl.tracks = mergedTracks;
      pl.lastSyncedAt = Date.now();
      pl.updatedAt = Date.now();
      if (!pl.cover && remoteCover) pl.cover = remoteCover;

      localStorage.setItem('devsize_playlists', JSON.stringify(state.playlists));
      renderPlaylistsList();
      if (state.currentView === 'playlist-detail' && state.currentPlaylistId === pl.id) {
        openPlaylistDetail(pl.id);
      }
      if (typeof hydrateMissingPlaylistCovers === 'function') {
        hydrateMissingPlaylistCovers(pl);
      }
    } catch (err) {
      console.warn('[SyncPlaylist] error:', err);
    }
  }

  
  setInterval(async () => {
    try {
      const playlistsToSync = (state.playlists || []).filter(p => p && p.syncEnabled && p.syncUrl);
      for (const pl of playlistsToSync) {
        if (!pl.lastSyncedAt || (Date.now() - pl.lastSyncedAt > 15 * 60 * 1000)) {
          await syncPlaylistTracks(pl, false);
        }
      }
    } catch (_) {}
  }, 5 * 60 * 1000);

  var playlistRecsCache = playlistRecsCache || new Map();

  function updatePlaylistTracksUpper(pl) {
    if (!pl) return;
    const query = el.playlistSearchInput ? el.playlistSearchInput.value.trim().toLowerCase() : '';
    let filtered = pl.tracks;
    if (query) {
      filtered = pl.tracks.filter(t =>
        (t.title && t.title.toLowerCase().includes(query)) ||
        (t.artist && t.artist.toLowerCase().includes(query))
      );
    }
    filtered = sortTracksFor('playlist', filtered, pl.id);
    const totalSec = (pl.tracks || []).reduce((acc, t) => acc + (t.duration || 0), 0);
    const durStr = totalSec > 0 ? ` • ${formatPlaylistDuration(totalSec)}` : '';
    if (el.playlistDetailCount) {
      el.playlistDetailCount.textContent = (query ? `${filtered.length} of ${pl.tracks.length} tracks` : `${pl.tracks.length} tracks`) + durStr;
    }
    if (el.playlistTracksList) renderTracks(el.playlistTracksList, filtered, 'playlist');
    renderPlaylistsList();
  }

  function renderPlaylistRecsRows(recs, pl, listEl, sec) {
    if (!listEl) return;
    if (listEl._renderedRecs === recs && listEl.children.length > 0) return;
    listEl._renderedRecs = recs;
    listEl.innerHTML = '';
    listEl.style.paddingTop = '0px';
    listEl.style.paddingBottom = '0px';
    if (!Array.isArray(recs) || recs.length === 0) {
      if (sec) sec.classList.add('hidden');
      return;
    }
    if (sec) sec.classList.remove('hidden');

    const currentCanonicalId = state.currentTrack ? getTrackCanonicalId(state.currentTrack) : '';
    recs.forEach((track, idx) => {
      const row = createTrackRow(track, idx, currentCanonicalId, 'playlist-rec', recs, listEl);
      const actions = row.querySelector('.track-row-actions');
      if (actions) {
        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'btn-add-rec-to-pl';
        addBtn.title = 'Add to playlist';
        addBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
        addBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          e.preventDefault();
          const added = await addTracksToPlaylistWithDuplicateCheck(pl, [track]);
          if (!added) return;

          const cached = playlistRecsCache.get(pl.id);
          if (Array.isArray(cached)) {
            const cIdx = cached.findIndex(t => (t.id && t.id === track.id) || (typeof isSameTrack === 'function' && isSameTrack(t, track)));
            if (cIdx !== -1) cached.splice(cIdx, 1);
          }

          row.remove();
          if (listEl.querySelectorAll('.track-row').length === 0 && sec) {
            sec.classList.add('hidden');
          }
        });
        actions.appendChild(addBtn);
      }
      listEl.appendChild(row);
    });
  }

  async function loadPlaylistRecommendations(pl, forceRefresh = false) {
    const sec = document.getElementById('playlist-recs-section');
    const listEl = document.getElementById('playlist-recs-list');
    if (!sec || !listEl) return;

    if (localStorage.getItem('riff_show_playlist_recs') === '0') {
      sec.classList.add('hidden');
      return;
    }

    if (!pl || !Array.isArray(pl.tracks) || pl.tracks.length === 0) {
      sec.classList.add('hidden');
      return;
    }

    sec.classList.remove('hidden');
    if (!forceRefresh && playlistRecsCache.has(pl.id)) {
      renderPlaylistRecsRows(playlistRecsCache.get(pl.id) || [], pl, listEl, sec);
      return;
    }

    const rawSeeds = [...pl.tracks.slice(0, 3), ...pl.tracks.slice(-3)];
    const seedMap = new Map();
    for (const t of rawSeeds) {
      if (!t) continue;
      const cid = (typeof getTrackCanonicalId === 'function' ? getTrackCanonicalId(t) : '') || t.id || `${t.artist}-${t.title}`;
      if (!seedMap.has(cid)) {
        seedMap.set(cid, {
          artist: t.artist || '',
          title: t.title || '',
          id: t.id || cid,
          weight: 3
        });
      }
    }
    const seeds = Array.from(seedMap.values());

    const avoid = {
      ids: pl.tracks.map(t => t && t.id).filter(Boolean),
      keys: pl.tracks.map(t => t && (typeof getTrackNormalizedKey === 'function' ? getTrackNormalizedKey(t.artist, t.title) : `${t.artist} - ${t.title}`)).filter(Boolean)
    };

    let recs = [];
    try {
      const port = state.serverPort || 38472;
      const res = await fetch(`http://127.0.0.1:${port}/api/vibe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seeds, avoid, limit: 10, refresh: forceRefresh })
      });
      const data = await res.json();
      if (data && data.success && Array.isArray(data.tracks)) {
        const existingIds = new Set(pl.tracks.map(t => t && t.id).filter(Boolean));
        const existingCanon = new Set(pl.tracks.map(t => t && (typeof getTrackCanonicalId === 'function' ? getTrackCanonicalId(t) : t.id)).filter(Boolean));
        const existingKeys = new Set(pl.tracks.map(t => t && (typeof getTrackNormalizedKey === 'function' ? getTrackNormalizedKey(t.artist, t.title) : '')).filter(Boolean));

        recs = data.tracks.filter(t => {
          if (!t) return false;
          const cid = typeof getTrackCanonicalId === 'function' ? getTrackCanonicalId(t) : t.id;
          const k = typeof getTrackNormalizedKey === 'function' ? getTrackNormalizedKey(t.artist, t.title) : '';
          if (t.id && existingIds.has(t.id)) return false;
          if (cid && existingCanon.has(cid)) return false;
          if (k && existingKeys.has(k)) return false;
          return true;
        }).slice(0, 10);
      }
    } catch (err) {
      console.error('Failed to fetch playlist recommendations', err);
    }

    playlistRecsCache.set(pl.id, recs);
    if (state.currentPlaylistId === pl.id) {
      renderPlaylistRecsRows(recs, pl, listEl, sec);
    }
  }

  function updatePlaylistTitleFit() {
    const titleEl = el.playlistDetailTitle || document.getElementById('playlist-detail-title');
    if (!titleEl) return;
    const text = (titleEl.textContent || '').trim();
    const len = text.length;
    titleEl.classList.remove('title-size-md', 'title-size-lg', 'title-overflow-mask');

    if (len > 32) {
      titleEl.classList.add('title-size-lg');
    } else if (len > 15) {
      titleEl.classList.add('title-size-md');
    }

    requestAnimationFrame(() => {
      if (titleEl.scrollWidth > titleEl.clientWidth + 2) {
        if (!titleEl.classList.contains('title-size-lg')) {
          if (titleEl.classList.contains('title-size-md')) {
            titleEl.classList.remove('title-size-md');
            titleEl.classList.add('title-size-lg');
          } else {
            titleEl.classList.add('title-size-md');
          }
        }
        if (titleEl.scrollWidth > titleEl.clientWidth + 2) {
          titleEl.classList.add('title-overflow-mask');
        }
      }
    });
  }
  window.addEventListener('resize', () => {
    if (state.currentView === 'playlist-detail') {
      updatePlaylistTitleFit();
    }
  });

  function openPlaylistDetail(playlistId) {
    const pl = state.playlists.find(p => p.id === playlistId);
    if (!pl) return;
    state.currentPlaylistId = playlistId;
    state.currentPlaylist = pl;
    pl.lastOpenedAt = Date.now();
    if (Array.isArray(pl.tracks)) {
      pl.tracks.forEach(t => { if (t && t._unavailNotice && !t.isUnavailable) delete t._unavailNotice; });
    }
    if (el.playlistDetailTitle) {
      el.playlistDetailTitle.textContent = pl.name || 'Untitled';
      el.playlistDetailTitle.contentEditable = 'false';
      el.playlistDetailTitle.classList.remove('playlist-inline-editable', 'is-editing');
      updatePlaylistTitleFit();
      const editBtn = el.btnEditPlaylistTitle || document.getElementById('btn-edit-playlist-title');
      if (editBtn) {
        editBtn.onclick = (e) => {
          e.stopPropagation();
          el.playlistDetailTitle.contentEditable = 'plaintext-only';
          el.playlistDetailTitle.classList.add('playlist-inline-editable', 'is-editing');
          el.playlistDetailTitle.focus();
          try {
            const range = document.createRange();
            range.selectNodeContents(el.playlistDetailTitle);
            const sel = window.getSelection();
            if (sel) {
              sel.removeAllRanges();
              sel.addRange(range);
            }
          } catch (_) {}
        };
      }
      el.playlistDetailTitle.onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          el.playlistDetailTitle.blur();
        }
      };
      el.playlistDetailTitle.onblur = () => {
        const newName = el.playlistDetailTitle.textContent.trim() || pl.name || 'Untitled';
        if (pl.name !== newName) {
          pl.name = newName;
          localStorage.setItem('devsize_playlists', JSON.stringify(state.playlists));
          renderPlaylistsList();
        }
        el.playlistDetailTitle.textContent = pl.name;
        el.playlistDetailTitle.contentEditable = 'false';
        el.playlistDetailTitle.classList.remove('playlist-inline-editable', 'is-editing');
        updatePlaylistTitleFit();
      };
    }

    if (el.playlistDetailTitle) {
      const oldBadge = document.getElementById('playlist-sync-badge');
      if (oldBadge) oldBadge.remove();

      let syncWrap = document.getElementById('playlist-sync-wrap');
      if (pl.syncEnabled === true && pl.syncUrl) {
        if (!syncWrap) {
          syncWrap = document.createElement('span');
          syncWrap.id = 'playlist-sync-wrap';
          syncWrap.className = 'playlist-sync-wrap';
          syncWrap.innerHTML = `
            <button type="button" class="playlist-sync-btn" id="btn-playlist-sync" aria-label="Synchronize playlist">
              <svg class="sync-check-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <svg class="sync-spin-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                <path d="M3 3v5h5"/>
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
                <path d="M16 16h5v5"/>
              </svg>
            </button>
            <span class="playlist-sync-tip" id="playlist-sync-tip">
              <span class="sync-tip-head">${typeof t === 'function' ? escapeHtml(t('Playlist synchronization')) : 'Playlist synchronization'}</span>
              <span class="sync-tip-body" id="sync-tip-time"></span>
              <span class="sync-tip-cta">${typeof t === 'function' ? escapeHtml(t('Click to sync now')) : 'Click to sync now'}</span>
            </span>
          `;
          el.playlistDetailTitle.parentNode.insertBefore(syncWrap, el.playlistDetailTitle.nextSibling);
        }
        const timeAgoStr = typeof formatRelativeTime === 'function' ? formatRelativeTime(pl.lastSyncedAt || Date.now()) : 'just now';
        const syncTipTime = syncWrap.querySelector('#sync-tip-time');
        const lastSyncLabel = typeof t === 'function' ? t('Last synchronization') : 'Last synchronization';
        if (syncTipTime) {
          syncTipTime.textContent = `${lastSyncLabel}: ${timeAgoStr}`;
        }
        syncWrap.classList.remove('hidden');
        syncWrap.style.display = 'inline-flex';
        const syncBtn = syncWrap.querySelector('.playlist-sync-btn');
        if (syncBtn) {
          syncBtn.onclick = async (e) => {
            e.stopPropagation();
            if (syncBtn.classList.contains('syncing')) return;
            syncBtn.classList.add('syncing');
            try {
              await syncPlaylistTracks(pl);
            } finally {
              syncBtn.classList.remove('syncing');
              openPlaylistDetail(pl.id);
            }
          };
        }
      } else if (syncWrap) {
        syncWrap.remove();
      }
    }

    const importInfo = typeof getPlaylistImportInfo === 'function' ? getPlaylistImportInfo(pl) : null;
    let importBadge = document.getElementById('playlist-import-badge-wrap');
    if (importInfo && importInfo.platform) {
      if (!pl.importedPlatform) pl.importedPlatform = importInfo.platform;
      if (!pl.importedAt) pl.importedAt = importInfo.importedAt;
      if (!importBadge) {
        importBadge = document.createElement('div');
        importBadge.id = 'playlist-import-badge-wrap';
        importBadge.className = 'playlist-import-badge-wrap';
      }
      const timeAgoStr = typeof formatRelativeTime === 'function' ? formatRelativeTime(importInfo.importedAt) : 'just now';
      importBadge.innerHTML = `
        <span class="playlist-import-source-icon" aria-label="${escapeHtml(importInfo.platform)}">
          ${getPlatformIconSvg(importInfo.platform)}
        </span>
        <div class="playlist-import-tooltip" role="tooltip">${escapeHtml(timeAgoStr)}</div>
      `;
      importBadge.onmouseenter = () => {
        const tip = importBadge.querySelector('.playlist-import-tooltip');
        if (tip && importInfo && importInfo.importedAt) {
          tip.textContent = typeof formatRelativeTime === 'function' ? formatRelativeTime(importInfo.importedAt) : 'just now';
        }
      };
      importBadge.classList.remove('hidden');
      importBadge.style.display = 'inline-flex';

      const shuffleBtn = document.getElementById('btn-play-playlist-shuffle');
      const moreBtn = document.getElementById('btn-playlist-more');
      const actionsContainer = document.querySelector('.action-bar.playlist-actions');
      if (shuffleBtn && shuffleBtn.parentNode) {
        if (importBadge.previousElementSibling !== shuffleBtn) {
          shuffleBtn.parentNode.insertBefore(importBadge, shuffleBtn.nextSibling);
        }
      } else if (moreBtn && moreBtn.parentNode) {
        if (importBadge.nextElementSibling !== moreBtn) {
          moreBtn.parentNode.insertBefore(importBadge, moreBtn);
        }
      } else if (actionsContainer && importBadge.parentNode !== actionsContainer) {
        actionsContainer.appendChild(importBadge);
      }
    } else if (importBadge) {
      importBadge.remove();
    }

    const descEl = document.getElementById('playlist-detail-desc');
    if (descEl) {
      descEl.textContent = pl.description || '';
      descEl.contentEditable = 'plaintext-only';
      descEl.classList.add('playlist-inline-editable');
      descEl.onkeydown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          descEl.blur();
        }
      };
      descEl.onblur = () => {
        const newDesc = descEl.textContent.trim();
        if ((pl.description || '') !== newDesc) {
          pl.description = newDesc;
          localStorage.setItem('devsize_playlists', JSON.stringify(state.playlists));
        }
        descEl.textContent = pl.description || '';
      };
    }
    const query = el.playlistSearchInput ? el.playlistSearchInput.value.trim().toLowerCase() : '';
    let filtered = pl.tracks;
    if (query) {
      filtered = pl.tracks.filter(t =>
      (t.title && t.title.toLowerCase().includes(query)) ||
      (t.artist && t.artist.toLowerCase().includes(query))
      );
    }
    filtered = sortTracksFor('playlist', filtered, pl.id);
    if (el.playlistSort) {
      el.playlistSort.value = getTrackSortMode('playlist');
      const plLabel = document.getElementById('playlist-sort-label');
      const plMenu = document.getElementById('playlist-sort-menu');
      if (plMenu) {
        plMenu.querySelectorAll('.m3-dropdown-option').forEach(opt => {
          const isSel = opt.dataset.value === el.playlistSort.value;
          opt.classList.toggle('selected', isSel);
          if (isSel && plLabel) plLabel.textContent = opt.textContent;
        });
      }
    }
    const totalSec = (pl.tracks || []).reduce((acc, t) => acc + (t.duration || 0), 0);
    const durStr = totalSec > 0 ? ` • ${formatPlaylistDuration(totalSec)}` : '';
    if (el.playlistDetailCount) el.playlistDetailCount.textContent = (query ? `${filtered.length} of ${pl.tracks.length} tracks` : `${pl.tracks.length} tracks`) + durStr;
    const detailCover = document.getElementById('playlist-detail-cover');
    if (detailCover) {
      renderPlaylistCover(detailCover, pl, 204);
      detailCover.style.cursor = 'pointer';
      detailCover.onclick = async () => {
        if (detailCover._zoomedFlag) return;
        if (window.electronAPI && window.electronAPI.pickMedia) {
          const url = await window.electronAPI.pickMedia();
          if (url) {
            pl.cover = url;
            localStorage.setItem('devsize_playlists', JSON.stringify(state.playlists));
            openPlaylistDetail(playlistId);
          }
        }
      };
      if (typeof bindCoverHoldZoom === 'function') bindCoverHoldZoom(detailCover);
    }
    const coverSrc = (pl && pl.cover) ? proxiedThumb(pl.cover) : ((pl.tracks && pl.tracks[0]) ? getTrackThumbUrl(pl.tracks[0]) : '');
    const headerEl = el.viewPlaylistDetail ? el.viewPlaylistDetail.querySelector('.playlist-detail-header') : document.querySelector('.playlist-detail-header');
    const plHeroFx = document.getElementById('playlist-hero-fx');
    if (plHeroFx && headerEl) {
      if (plHeroFx.parentElement !== headerEl) {
        headerEl.prepend(plHeroFx);
      }
    }
    if (coverSrc) {
      getCoverDominantColors(coverSrc).then(([domColor]) => {
        if (state.currentPlaylistId === playlistId) {
          if (el.viewPlaylistDetail) el.viewPlaylistDetail.style.setProperty('--playlist-accent-color', domColor);
          if (plHeroFx) plHeroFx.style.setProperty('--playlist-accent-color', domColor);
          if (headerEl) headerEl.style.setProperty('--playlist-accent-color', domColor);
          document.documentElement.style.setProperty('--playlist-accent-color', domColor);
        }
      });
    } else {
      if (el.viewPlaylistDetail) el.viewPlaylistDetail.style.removeProperty('--playlist-accent-color');
      if (plHeroFx) plHeroFx.style.removeProperty('--playlist-accent-color');
      if (headerEl) headerEl.style.setProperty('--playlist-accent-color', 'var(--md-sys-color-primary)');
      document.documentElement.style.removeProperty('--playlist-accent-color');
    }
    if (el.playlistTracksList) renderTracks(el.playlistTracksList, filtered, 'playlist');
    switchView('playlist-detail');
    renderPlaylistsList();
    loadPlaylistRecommendations(pl, false);
    refreshOverflowFades();
  }

  var btnRefreshPlaylistRecs = document.getElementById('btn-refresh-playlist-recs');
  if (btnRefreshPlaylistRecs) {
    btnRefreshPlaylistRecs.addEventListener('click', () => {
      loadPlaylistRecommendations(state.currentPlaylist, true);
    });
  }

  if (el.playlistSort) {
    el.playlistSort.addEventListener('change', () => {
      setTrackSortMode('playlist', el.playlistSort.value);
      if (state.currentPlaylistId) openPlaylistDetail(state.currentPlaylistId);
    });
    setupSortDropdown('playlist-sort-dropdown', 'playlist-sort-trigger', 'playlist-sort-menu', 'playlist-sort-label', el.playlistSort);
  }

  var plHeader = document.querySelector('.playlist-detail-header') || document.querySelector('.playlist-header') || document.querySelector('.playlist-actions');
  if (plHeader) {
    plHeader.addEventListener('contextmenu', (e) => {
      const plId = state.currentPlaylistId;
      if (!plId) return;
      openPlaylistInAppMenu(e, plId);
    });
  }

  function animateRemovePlaylistTrackRow(trackId, pl, sourceRow = null) {
    if (!el.playlistTracksList) return;
    let targetRow = sourceRow;
    if (!targetRow || !targetRow.isConnected) {
      el.playlistTracksList.querySelectorAll('.track-row').forEach(r => {
        if (!targetRow && ((r._trackData && (r._trackData.id === trackId || (typeof getTrackCanonicalId === 'function' && getTrackCanonicalId(r._trackData) === trackId))) || (r.dataset && (r.dataset.trackId === trackId || r.dataset.canonicalId === trackId)))) {
          targetRow = r;
        }
      });
    }

    const query = el.playlistSearchInput ? el.playlistSearchInput.value.trim().toLowerCase() : '';
    let filteredCount = pl.tracks.length;
    if (query) {
      filteredCount = pl.tracks.filter(t =>
        (t.title && t.title.toLowerCase().includes(query)) ||
        (t.artist && t.artist.toLowerCase().includes(query))
      ).length;
    }
    const totalSec = (pl.tracks || []).reduce((acc, t) => acc + (t.duration || 0), 0);
    const durStr = totalSec > 0 ? ` • ${formatPlaylistDuration(totalSec)}` : '';
    if (el.playlistDetailCount) {
      el.playlistDetailCount.textContent = (query ? `${filteredCount} of ${pl.tracks.length} tracks` : `${pl.tracks.length} tracks`) + durStr;
    }

    const detailCover = document.getElementById('playlist-detail-cover');
    if (detailCover && !pl.cover) {
      renderPlaylistCover(detailCover, pl, 204);
    }

    if (targetRow) {
      targetRow.classList.add('track-row-removing');
      setTimeout(() => {
        if (targetRow.parentNode) targetRow.remove();
        let idx = 1;
        el.playlistTracksList.querySelectorAll('.track-row:not(.track-row-removing) .track-row-num').forEach(numEl => {
          const numSpan = numEl.querySelector('.track-num-text');
          if (numSpan) numSpan.textContent = String(idx++);
          else numEl.textContent = String(idx++);
        });
        if (pl.tracks.length === 0) {
          el.playlistTracksList.innerHTML = '<div class="empty-hint">This playlist is empty</div>';
        }
      }, 260);
    } else if (pl.tracks.length === 0) {
      el.playlistTracksList.innerHTML = '<div class="empty-hint">This playlist is empty</div>';
    }
  }

  function animateAddPlaylistTrackRows(tracks, pl) {
    if (!el.playlistTracksList || !pl) return;
    const trackList = Array.isArray(tracks) ? tracks : [tracks];
    if (trackList.length === 0) return;

    const emptyHint = el.playlistTracksList.querySelector('.empty-hint');
    if (emptyHint) emptyHint.remove();

    const query = el.playlistSearchInput ? el.playlistSearchInput.value.trim().toLowerCase() : '';
    let filteredCount = pl.tracks.length;
    if (query) {
      filteredCount = pl.tracks.filter(t =>
        (t.title && t.title.toLowerCase().includes(query)) ||
        (t.artist && t.artist.toLowerCase().includes(query))
      ).length;
    }
    const totalSec = (pl.tracks || []).reduce((acc, t) => acc + (t.duration || 0), 0);
    const durStr = totalSec > 0 ? ` • ${formatPlaylistDuration(totalSec)}` : '';
    if (el.playlistDetailCount) {
      el.playlistDetailCount.textContent = (query ? `${filteredCount} of ${pl.tracks.length} tracks` : `${pl.tracks.length} tracks`) + durStr;
    }

    const detailCover = document.getElementById('playlist-detail-cover');
    if (detailCover && !pl.cover) {
      renderPlaylistCover(detailCover, pl, 204);
    }

    const currentCanonicalId = state.currentTrack ? getTrackCanonicalId(state.currentTrack) : '';
    const frag = document.createDocumentFragment();
    const newRows = [];

    const existingCount = el.playlistTracksList.querySelectorAll('.track-row:not(.track-row-removing)').length;
    trackList.forEach((t, i) => {
      const rowIdx = existingCount + i;
      const row = createTrackRow(t, rowIdx, currentCanonicalId, 'playlist', pl.tracks, el.playlistTracksList);
      row.classList.add('track-row-adding');
      frag.appendChild(row);
      newRows.push(row);
    });

    el.playlistTracksList.appendChild(frag);

    setTimeout(() => {
      newRows.forEach(r => r.classList.remove('track-row-adding'));
    }, 280);
  }

  function removeTrackFromCurrentPlaylist(trackId, sourceRow = null, targetIndex = -1) {
    const pl = state.playlists.find(p => p.id === state.currentPlaylistId);
    if (!pl || !Array.isArray(pl.tracks)) return;
    if (typeof targetIndex === 'number' && targetIndex >= 0 && targetIndex < pl.tracks.length) {
      pl.tracks.splice(targetIndex, 1);
    } else {
      const idx = pl.tracks.findIndex(t => (t && (t.id === trackId || (typeof getTrackCanonicalId === 'function' && getTrackCanonicalId(t) === trackId))));
      if (idx !== -1) {
        pl.tracks.splice(idx, 1);
      } else {
        pl.tracks = pl.tracks.filter(t => t && t.id !== trackId);
      }
    }
    localStorage.setItem('devsize_playlists', JSON.stringify(state.playlists));
    if (typeof updateRpSaveButton === 'function') updateRpSaveButton();
    renderPlaylistsList();
    animateRemovePlaylistTrackRow(trackId, pl, sourceRow);
  }

  function deleteCurrentPlaylist() {
    if (!state.currentPlaylistId) return;
    state.playlists = state.playlists.filter(p => p.id !== state.currentPlaylistId);
    localStorage.setItem('devsize_playlists', JSON.stringify(state.playlists));
    state.currentPlaylistId = null;
    renderPlaylistsList();
    switchView('discover');
  }

  function isTrackInPlaylist(pl, t) {
    if (!pl || !Array.isArray(pl.tracks) || !t) return false;
    const tKey = (t.artist && t.title && typeof getTrackNormalizedKey === 'function')
      ? getTrackNormalizedKey(t.artist, t.title)
      : '';
    return pl.tracks.some(existing => {
      if (!existing) return false;
      if (typeof isSameTrack === 'function' && isSameTrack(existing, t)) return true;
      if (t.id && existing.id && String(t.id) === String(existing.id)) return true;
      if (tKey && existing.artist && existing.title && typeof getTrackNormalizedKey === 'function') {
        if (getTrackNormalizedKey(existing.artist, existing.title) === tKey) return true;
      }
      return false;
    });
  }
  window.isTrackInPlaylist = isTrackInPlaylist;

  function askDuplicateTrackModal(plName, duplicateTracks) {
    return new Promise((resolve) => {
      const modal = document.getElementById('duplicate-track-modal');
      const titleEl = document.getElementById('duplicate-track-modal-title');
      const msgEl = document.getElementById('duplicate-track-modal-msg');
      const btnDoNotAdd = document.getElementById('btn-dup-do-not-add');
      const btnStillAdd = document.getElementById('btn-dup-still-add');
      if (!modal || !btnDoNotAdd || !btnStillAdd) {
        resolve(false);
        return;
      }
      const count = Array.isArray(duplicateTracks) ? duplicateTracks.length : 1;
      const firstTitle = (Array.isArray(duplicateTracks) ? duplicateTracks[0]?.title : duplicateTracks?.title) || 'Track';
      if (titleEl) titleEl.textContent = t('Already in playlist');
      if (msgEl) {
        msgEl.textContent = count > 1
          ? `${count} selected tracks are already in "${plName || 'playlist'}".`
          : `"${firstTitle}" is already in "${plName || 'playlist'}".`;
      }
      const cleanup = (stillAdd) => {
        btnDoNotAdd.onclick = null;
        btnStillAdd.onclick = null;
        modal.onclick = null;
        closeModal(modal);
        resolve(stillAdd);
      };
      btnDoNotAdd.onclick = (e) => { e.stopPropagation(); cleanup(false); };
      btnStillAdd.onclick = (e) => { e.stopPropagation(); cleanup(true); };
      modal.onclick = (e) => { if (e.target === modal) cleanup(false); };
      openModal(modal);
    });
  }
  window.askDuplicateTrackModal = askDuplicateTrackModal;

  async function addTracksToPlaylistWithDuplicateCheck(pl, inputTracks) {
    if (!pl) return false;
    if (!Array.isArray(pl.tracks)) pl.tracks = [];
    const list = (Array.isArray(inputTracks) ? inputTracks : [inputTracks]).filter(Boolean);
    if (list.length === 0) return false;

    const duplicates = list.filter(t => isTrackInPlaylist(pl, t));
    let tracksToInsert = list;

    if (duplicates.length > 0) {
      const stillAdd = await askDuplicateTrackModal(pl.name, duplicates);
      if (!stillAdd) {
        tracksToInsert = list.filter(t => !isTrackInPlaylist(pl, t));
        if (tracksToInsert.length === 0) return false;
      }
    }

    const stampedList = tracksToInsert.map(t => stampAddedAt(t));
    pl.tracks.push(...stampedList);
    localStorage.setItem('devsize_playlists', JSON.stringify(state.playlists));
    renderPlaylistsList();
    if (typeof updateRpSaveButton === 'function') updateRpSaveButton();

    if (state.currentView === 'playlist-detail' && state.currentPlaylistId === pl.id) {
      if (pl.tracks.length > 60 || stampedList.length > 30) {
        updatePlaylistTracksUpper(pl);
      } else {
        animateAddPlaylistTrackRows(stampedList, pl);
      }
    }

    if (stampedList.length === 1) {
      showToast(`Added to "${pl.name}"`, 'success');
    } else {
      showToast(`Added ${stampedList.length} tracks to "${pl.name}"`, 'success');
    }
    return true;
  }
  window.addTracksToPlaylistWithDuplicateCheck = addTracksToPlaylistWithDuplicateCheck;

  async function addLocalFilesToPlaylist(targetPlaylistId) {
    const plId = targetPlaylistId || state.currentPlaylistId;
    const pl = (state.playlists || []).find(p => p.id === plId);
    if (!pl) return;
    if (!window.electronAPI || typeof window.electronAPI.pickLocalFiles !== 'function') return;
    try {
      const tracks = await window.electronAPI.pickLocalFiles();
      if (!tracks || tracks.length === 0) return;
      if (typeof mergeLocalFiles === 'function') {
        mergeLocalFiles(tracks);
      }
      await addTracksToPlaylistWithDuplicateCheck(pl, tracks);
    } catch (err) {
      console.warn('Add local files to playlist error:', err);
    }
  }
  window.addLocalFilesToPlaylist = addLocalFilesToPlaylist;

  var btnPlaylistAddLocal = document.getElementById('btn-playlist-add-local');
  if (btnPlaylistAddLocal) {
    btnPlaylistAddLocal.addEventListener('click', (e) => {
      e.stopPropagation();
      addLocalFilesToPlaylist(state.currentPlaylistId);
    });
  }

  var trackToAddToPlaylist = null;
  function openAddToPlaylistModal(track) {
    trackToAddToPlaylist = track;
    if (!el.playlistPickList) return;

    const trackPreviewEl = document.getElementById('add-playlist-track-preview');
    if (trackPreviewEl) {
      if (Array.isArray(track)) {
        trackPreviewEl.innerHTML = `
          <div class="add-playlist-track-preview-thumb" style="width: 40px; height: 40px; flex: 0 0 40px; display: flex; align-items: center; justify-content: center; background: var(--md-sys-color-surface-container-high); border-radius: 8px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
          </div>
          <div class="add-playlist-track-preview-info">
            <span class="add-playlist-track-preview-title">${track.length} tracks selected</span>
            <span class="add-playlist-track-preview-artist">Bulk add to playlist</span>
          </div>
        `;
        trackPreviewEl.style.display = 'flex';
      } else if (track) {
        const thumb = getTrackThumbUrl(track) || '';
        trackPreviewEl.innerHTML = '';
        if (thumb) {
          const previewImg = document.createElement('img');
          previewImg.className = 'add-playlist-track-preview-thumb';
          previewImg.src = thumb;
          previewImg.alt = '';
          previewImg.style.width = '40px';
          previewImg.style.height = '40px';
          previewImg.style.flex = '0 0 40px';
          previewImg.onerror = () => { previewImg.style.visibility = 'hidden'; };
          trackPreviewEl.appendChild(previewImg);
        } else {
          const previewPlaceholder = document.createElement('div');
          previewPlaceholder.className = 'add-playlist-track-preview-thumb';
          previewPlaceholder.style.width = '40px';
          previewPlaceholder.style.height = '40px';
          previewPlaceholder.style.flex = '0 0 40px';
          previewPlaceholder.style.display = 'flex';
          previewPlaceholder.style.alignItems = 'center';
          previewPlaceholder.style.justifyContent = 'center';
          previewPlaceholder.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>';
          trackPreviewEl.appendChild(previewPlaceholder);
        }

        const previewInfo = document.createElement('div');
        previewInfo.className = 'add-playlist-track-preview-info';

        const previewTitle = document.createElement('span');
        previewTitle.className = 'add-playlist-track-preview-title';
        previewTitle.textContent = track.title || 'untitled';

        const previewArtist = document.createElement('span');
        previewArtist.className = 'add-playlist-track-preview-artist';
        previewArtist.textContent = track.artist || 'unknown artist';

        previewInfo.appendChild(previewTitle);
        previewInfo.appendChild(previewArtist);
        trackPreviewEl.appendChild(previewInfo);
        trackPreviewEl.style.display = 'flex';
      } else {
        trackPreviewEl.style.display = 'none';
        trackPreviewEl.innerHTML = '';
      }
    }

    el.playlistPickList.innerHTML = '';
    if (state.playlists.length === 0) {
      el.playlistPickList.innerHTML = '<div class="empty-hint" style="padding: 24px 0; text-align: center; color: var(--md-sys-color-outline);">No playlists yet. Create one first.</div>';
    } else {
      state.playlists.forEach((pl, idx) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'playlist-pick-item';
        item.style.animationDelay = `${idx * 25}ms`;

        const isAlreadyAdded = !Array.isArray(track) && track ? isTrackInPlaylist(pl, track) : false;
        if (isAlreadyAdded) item.classList.add('already-added');

        const thumbEl = document.createElement('div');
        thumbEl.className = 'playlist-pick-thumb';
        thumbEl.style.width = '44px';
        thumbEl.style.height = '44px';
        thumbEl.style.flex = '0 0 44px';
        renderPlaylistCover(thumbEl, pl, 44);
        const coverImg = thumbEl.querySelector('img');
        if (coverImg) {
          coverImg.style.width = '44px';
          coverImg.style.height = '44px';
          coverImg.style.objectFit = 'cover';
        }

        const infoEl = document.createElement('div');
        infoEl.className = 'playlist-pick-info';
        const trackCount = (pl.tracks || []).length;

        const nameEl = document.createElement('span');
        nameEl.className = 'playlist-pick-name';
        nameEl.textContent = pl.name || 'untitled';

        const countEl = document.createElement('span');
        countEl.className = 'playlist-pick-count';
        countEl.textContent = `${trackCount} track${trackCount === 1 ? '' : 's'}`;

        infoEl.appendChild(nameEl);
        infoEl.appendChild(countEl);

        const actionEl = document.createElement('div');
        if (isAlreadyAdded) {
          actionEl.className = 'playlist-pick-badge in-playlist';
          actionEl.innerHTML = `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
            Added
          `;
        } else {
          actionEl.className = 'playlist-pick-action-btn';
          actionEl.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          `;
        }

        item.appendChild(thumbEl);
        item.appendChild(infoEl);
        item.appendChild(actionEl);

        item.addEventListener('click', async () => {
          if (el.addToPlaylistModal) closeModal(el.addToPlaylistModal);
          if (Array.isArray(track)) {
            await addTracksToPlaylistWithDuplicateCheck(pl, track);
            clearTrackSelection();
          } else if (track) {
            await addTracksToPlaylistWithDuplicateCheck(pl, [track]);
          }
        });

        el.playlistPickList.appendChild(item);
      });
    }
    if (el.addToPlaylistModal) openModal(el.addToPlaylistModal);
  }


  function updateAccountHeroColors(imgSrc) {
    const hero = document.getElementById('tg-account-hero');
    if (!hero || !imgSrc) return;
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = 16;
        c.height = 16;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, 16, 16);
        const data = ctx.getImageData(0, 0, 16, 16).data;
        let rS = 0, gS = 0, bS = 0, cnt = 0;
        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3];
          const r = data[i], g = data[i + 1], b = data[i + 2];
          if (a > 70 && (r + g + b) > 40 && (r + g + b) < 700) {
            rS += r; gS += g; bS += b; cnt++;
          }
        }
        const avgR = cnt > 0 ? Math.round(rS / cnt) : 120;
        const avgG = cnt > 0 ? Math.round(gS / cnt) : 60;
        const avgB = cnt > 0 ? Math.round(bS / cnt) : 90;
        const hsl = rgbToHsl(avgR, avgG, avgB);
        const h = hsl.h;
        const s = Math.max(24, Math.min(54, hsl.s || 40));
        hero.style.setProperty('--acc-c1', hslToHex(h, s, 38));
        hero.style.setProperty('--acc-c2', hslToHex((h + 8) % 360, Math.max(18, s - 8), 18));
      } catch (_) {}
    };
    img.src = imgSrc;
  }

  var devsizeMemes = [];
  var lastMemeUrl = '';
  async function loadEasterMemes() {
    const memeEl = document.getElementById('tg-easter-meme');
    if (!memeEl) return;
    if (devsizeMemes.length === 0) {
      try {
        const port = state.serverPort || 38472;
        const res = await fetch(`http://127.0.0.1:${port}/api/devsize-memes`);
        const data = await res.json();
        if (data && data.success && Array.isArray(data.files) && data.files.length > 0) {
          devsizeMemes = data.files;
          const initial = devsizeMemes[Math.floor(Math.random() * devsizeMemes.length)];
          lastMemeUrl = initial;
          memeEl.src = initial;
        }
      } catch (_) {}
    } else if (!memeEl.src || memeEl.src.endsWith('/')) {
      const initial = devsizeMemes[Math.floor(Math.random() * devsizeMemes.length)];
      lastMemeUrl = initial;
      memeEl.src = initial;
    }
  }

  var memeEl = document.getElementById('tg-easter-meme');
  if (memeEl) {
    let memeBusy = false;
    memeEl.onclick = (e) => {
      e.stopPropagation();
      if (memeBusy || !devsizeMemes || !devsizeMemes.length) return;
      memeBusy = true;
      let pool = devsizeMemes.filter(u => u !== lastMemeUrl);
      if (!pool.length) pool = devsizeMemes;
      const nextUrl = pool[Math.floor(Math.random() * pool.length)];
      lastMemeUrl = nextUrl;
      memeEl.classList.add('switching');
      setTimeout(() => {
        memeEl.src = nextUrl;
        memeEl.onload = () => {
          memeEl.classList.remove('switching');
          memeBusy = false;
        };
        setTimeout(() => {
          memeEl.classList.remove('switching');
          memeBusy = false;
        }, 150);
      }, 120);
    };
  }

  var DEFAULT_USER_AVATAR = "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='32' fill='%232b2d31'/%3E%3Ccircle cx='32' cy='24' r='11' fill='%23949ba4'/%3E%3Cpath d='M12 56c0-11 9-18 20-18s20 7 20 18' fill='%23949ba4'/%3E%3C/svg%3E";

  function renderAccountBadgesUI() {
    const badges = typeof getAccountBadges === 'function' ? getAccountBadges() : { isOwner: false, isDonator: false };
    let html = '';
    if (badges.isOwner) {
      html += `<img class="account-badge-img" src="../../assets/ownerbadge.png" alt="Owner" title="Owner" draggable="false" onerror="if(!this.dataset.fb){this.dataset.fb='1';this.src='/assets/ownerbadge.png';}else{this.style.display='none';}" />`;
    }
    if (badges.isDonator) {
      html += `<img class="account-badge-img" src="../../assets/donatorbadge.png" alt="Donator" title="Donator" draggable="false" onerror="if(!this.dataset.fb){this.dataset.fb='1';this.src='/assets/donatorbadge.png';}else{this.style.display='none';}" />`;
    }
    const heroBadges = document.getElementById('account-hero-badges');
    const navBadges = document.getElementById('settings-nav-account-badges');
    if (heroBadges) heroBadges.innerHTML = html;
    if (navBadges) navBadges.innerHTML = html;
  }
  window.renderAccountBadgesUI = renderAccountBadgesUI;

  function syncLocalAccountUI() {
    const nick = (localStorage.getItem('riff_user_nickname') || '').trim() || 'User';
    const avatar = (localStorage.getItem('riff_user_avatar') || '').trim() || DEFAULT_USER_AVATAR;
    const navName = document.getElementById('settings-nav-account-name');
    const nickInput = document.getElementById('account-nickname-input');
    const navAvatar = document.getElementById('settings-nav-avatar');
    const profAvatar = document.getElementById('account-profile-avatar');
    const topAvatar = document.getElementById('top-nav-avatar');

    if (navName) navName.textContent = nick;
    if (nickInput && document.activeElement !== nickInput) nickInput.value = nick;
    [navAvatar, profAvatar, topAvatar].forEach(img => {
      if (img) {
        img.onerror = () => { img.src = DEFAULT_USER_AVATAR; };
        img.src = avatar;
      }
    });

    renderAccountBadgesUI();

    if (!avatar.startsWith('data:image/svg+xml')) {
      updateAccountHeroColors(avatar);
    }
    loadEasterMemes();
  }
  window.syncLocalAccountUI = syncLocalAccountUI;

  var accountPromocodeInput = document.getElementById('account-promocode-input');
  if (accountPromocodeInput) {
    const tryRedeemPromo = (showInvalidToast = false) => {
      const val = accountPromocodeInput.value.trim();
      if (!val) return;
      if (typeof verifyAndApplyPromocode === 'function') {
        const matched = verifyAndApplyPromocode(val);
        if (matched) {
          accountPromocodeInput.value = '';
          renderAccountBadgesUI();
          showToast(matched === 'owner' ? 'Owner badge unlocked!' : 'Donator badge unlocked!', 'success');
        } else if (showInvalidToast) {
          showToast('Invalid promocode', 'error');
        }
      }
    };
    accountPromocodeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        tryRedeemPromo(true);
      }
    });
    accountPromocodeInput.addEventListener('input', () => {
      if (accountPromocodeInput.value.trim().length === 16) {
        tryRedeemPromo(false);
      }
    });
  }

  var accountNicknameInput = document.getElementById('account-nickname-input');
  if (accountNicknameInput) {
    accountNicknameInput.addEventListener('input', (e) => {
      const val = e.target.value;
      localStorage.setItem('riff_user_nickname', val);
      const navName = document.getElementById('settings-nav-account-name');
      if (navName) navName.textContent = val.trim() || 'User';
    });
    accountNicknameInput.addEventListener('blur', () => {
      if (!accountNicknameInput.value.trim()) {
        accountNicknameInput.value = 'User';
        localStorage.setItem('riff_user_nickname', 'User');
        syncLocalAccountUI();
      }
    });
  }

  var btnPickAccountAvatar = document.getElementById('btn-pick-account-avatar');
  if (btnPickAccountAvatar) {
    btnPickAccountAvatar.addEventListener('click', async () => {
      if (window.electronAPI && window.electronAPI.pickMedia) {
        const url = await window.electronAPI.pickMedia();
        if (url) {
          localStorage.setItem('riff_user_avatar', url);
          syncLocalAccountUI();
        }
      }
    });
  }

  var btnResetAccountAvatar = document.getElementById('btn-reset-account-avatar');
  if (btnResetAccountAvatar) {
    btnResetAccountAvatar.addEventListener('click', () => {
      localStorage.removeItem('riff_user_avatar');
      syncLocalAccountUI();
    });
  }

  var btnAccExportRfacc = document.getElementById('btn-acc-export-rfacc');
  if (btnAccExportRfacc) {
    btnAccExportRfacc.addEventListener('click', () => {
      if (btnExportAccount) {
        btnExportAccount.click();
      }
    });
  }

  var btnAccImportRfacc = document.getElementById('btn-acc-import-rfacc');
  if (btnAccImportRfacc) {
    btnAccImportRfacc.addEventListener('click', () => {
      if (btnImportAccount) {
        btnImportAccount.click();
      }
    });
  }

  var btnAccOpenIntegrations = document.getElementById('btn-acc-open-integrations');
  if (btnAccOpenIntegrations) {
    btnAccOpenIntegrations.addEventListener('click', () => {
      showSettingsCategory('integrations');
    });
  }

  document.querySelectorAll('#acc-orbital-widget .acc-satellite-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const plat = btn.dataset.platform;
      if (plat === 'spotify') openSpotifyImportModal();
      else if (plat === 'youtube' || plat === 'ytmusic' || plat === 'soundcloud') openLinkImportModal(plat);
      else if (plat === 'lastfm') {
        const b = document.getElementById('btn-lastfm-open-modal');
        if (b) b.click();
        else showSettingsCategory('integrations');
      } else if (plat === 'discord') {
        showSettingsCategory('integrations');
      } else if (plat === 'wave') {
        playMyWave();
      } else {
        showSettingsCategory('integrations');
      }
    };
  });

  var btnAccLogout = document.getElementById('btn-acc-logout');
  if (btnAccLogout) {
    btnAccLogout.addEventListener('click', async () => {
      const confirmed = await confirmChain({
        title: 'Log out of account?',
        message: 'This will sign you out and clear your local account data (playlists, favorites, history, and settings). Make sure you exported your .rfacc backup first!',
        confirmLabel: 'Log out',
        seconds: 3
      });
      if (!confirmed) return;

      try { await window.electronAPI?.googleLogout?.(); } catch (_) {}
      try { localStorage.clear(); } catch (_) {}
      if (window.electronAPI?.storageSaveSync) {
        try { window.electronAPI.storageSaveSync({}); } catch (_) {}
      }
      showToast('Logged out! Restarting...', 'info');
      setTimeout(() => {
        if (window.electronAPI && window.electronAPI.restartApp) {
          window.electronAPI.restartApp();
        } else {
          window.location.reload();
        }
      }, 350);
    });
  }

  syncLocalAccountUI();

  var btnTopProfileAvatar = document.getElementById('btn-top-profile-avatar');
  if (btnTopProfileAvatar) {
    btnTopProfileAvatar.addEventListener('click', (e) => {
      e.stopPropagation();
      openSettingsModal('account');
    });
  }

  function updateDownloadBtnLabel() {
    const label = downloadBatch
      ? `Download ${downloadBatch.tracks.length} track${downloadBatch.tracks.length === 1 ? '' : 's'}`
      : `Download ${selectedFormat.toUpperCase()}`;
    if (el.downloadBtnText) {
      el.downloadBtnText.textContent = label;
    }
    if (el.btnConfirmDownload) {
      el.btnConfirmDownload.title = label;
      el.btnConfirmDownload.setAttribute('aria-label', label);
    }
  }

  function updateLosslessQualityState() {
    const isLossless = selectedFormat === 'flac' || selectedFormat === 'wav';
    const qualityGrid = document.getElementById('quality-chips-grid');
    if (qualityGrid) {
      qualityGrid.classList.toggle('disabled', isLossless);
    }
  }

  async function updateDownloadCaptionPath() {
    const elPath = document.getElementById('download-caption-path');
    if (!elPath) return;
    try {
      if (window.electronAPI && window.electronAPI.getDownloadDir) {
        const info = await window.electronAPI.getDownloadDir();
        if (info && info.dir) {
          elPath.textContent = info.dir;
          return;
        }
      }
    } catch (e) {
      console.warn('getDownloadDir failed', e);
    }
    elPath.textContent = '~/Downloads';
  }

  var trimDraft = { start: 0, end: 180, dur: 180 };
  var waveformPeakCache = new Map();

  function formatPreciseTime(sec) {
    if (!Number.isFinite(sec) || sec < 0) sec = 0;
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const d = Math.floor((sec * 10) % 10);
    return `${m}:${s < 10 ? '0' : ''}${s}.${d}`;
  }

  function computeFastWaveformPeaks(track, barCount = 84) {
    if (!track) return new Float32Array(barCount).fill(0.3);
    const cid = getTrackCanonicalId(track);
    if (cid && waveformPeakCache.has(cid)) {
      return waveformPeakCache.get(cid);
    }
    let seed = 0;
    for (let i = 0; i < cid.length; i++) {
      seed = ((seed << 5) - seed + cid.charCodeAt(i)) | 0;
    }
    function pseudoRandom() {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    }
    const peaks = new Float32Array(barCount);
    for (let i = 0; i < barCount; i++) {
      const t = i / barCount;
      const env = Math.sin(t * Math.PI) * 0.45 + 0.35 +
                  0.15 * Math.sin(t * Math.PI * 4.2) +
                  0.1 * Math.sin(t * Math.PI * 7.8);
      const noise = pseudoRandom() * 0.45 + 0.15;
      const val = Math.max(0.12, Math.min(0.96, env * noise * 1.25));
      peaks[i] = Math.round(val * 100) / 100;
    }
    if (cid) {
      waveformPeakCache.set(cid, peaks);
      boundMap(waveformPeakCache, 20);
    }

    
    (async () => {
      try {
        let targetUrl = '';
        if (track.url && String(track.url).startsWith('file:')) {
          targetUrl = track.url;
        } else if (track.path || track.filePath) {
          const p = track.path || track.filePath;
          const norm = String(p).replace(/\\/g, '/');
          targetUrl = norm.startsWith('file:') ? norm : ('file://' + (norm.startsWith('/') ? '' : '/') + encodeURI(norm));
        } else if (track.platform === 'local' && track.path) {
          targetUrl = `file://${encodeURI(track.path)}`;
        } else if (track.id && state.serverPort) {
          const checkRes = await fetch(`http://127.0.0.1:${state.serverPort}/api/check-cache?id=${encodeURIComponent(track.id)}`).catch(() => null);
          if (checkRes && checkRes.ok) {
            const checkData = await checkRes.json();
            if (checkData && checkData.cached) {
              targetUrl = `http://127.0.0.1:${state.serverPort}/api/local-track?id=${encodeURIComponent(track.id)}`;
            }
          }
        }
        if (!targetUrl) return;

        let ab = null;
        if (targetUrl.startsWith('file:')) {
          const resp = await fetch(targetUrl).catch(() => null);
          if (resp && (resp.ok || resp.status === 200 || resp.status === 0)) {
            ab = await resp.arrayBuffer().catch(() => null);
          }
        } else {
          const resp = await fetch(targetUrl, { headers: { Range: 'bytes=0-15000000' } }).catch(() => null);
          if (resp && resp.ok) {
            ab = await resp.arrayBuffer().catch(() => null);
          }
        }
        if (!ab || ab.byteLength === 0) return;
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuffer = await ctx.decodeAudioData(ab.slice(0)).catch(() => null);
        ctx.close().catch(() => {});
        if (!audioBuffer) return;

        const channelData = audioBuffer.getChannelData(0);
        const blockSize = Math.floor(channelData.length / barCount);
        const upgraded = new Float32Array(barCount);
        let maxPeak = 0.001;
        for (let b = 0; b < barCount; b++) {
          let sum = 0;
          const startIdx = b * blockSize;
          for (let j = 0; j < blockSize; j += 4) {
            const v = Math.abs(channelData[startIdx + j]);
            if (v > sum) sum = v;
          }
          upgraded[b] = sum;
          if (sum > maxPeak) maxPeak = sum;
        }
        for (let b = 0; b < barCount; b++) {
          upgraded[b] = Math.max(0.12, Math.min(1.0, upgraded[b] / maxPeak));
        }
        if (cid) {
          waveformPeakCache.set(cid, upgraded);
          boundMap(waveformPeakCache, 20);
          if (trackToDownload && getTrackCanonicalId(trackToDownload) === cid) {
            renderTrimmerWaveform();
          }
        }
      } catch (_) {}
    })();

    return peaks;
  }

  function renderTrimmerWaveform() {
    const canvas = document.getElementById('capcut-wave-canvas');
    if (!canvas || !trackToDownload) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const barCount = 84;
    const peaks = computeFastWaveformPeaks(trackToDownload, barCount);
    const w = canvas.width || 420;
    const h = canvas.height || 88;
    ctx.clearRect(0, 0, w, h);

    const dur = Math.max(1, trimDraft.dur);
    const startRatio = trimDraft.start / dur;
    const endRatio = trimDraft.end / dur;
    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--md-sys-color-primary').trim() || '#a8c7fa';

    const barW = (w / barCount) * 0.6;
    const step = w / barCount;
    for (let i = 0; i < barCount; i++) {
      const ratio = i / (barCount - 1);
      const inside = (ratio >= startRatio - 0.01 && ratio <= endRatio + 0.01);
      ctx.fillStyle = inside ? primaryColor : 'rgba(255, 255, 255, 0.22)';
      const barH = Math.max(6, (peaks[i] || 0.3) * (h - 16));
      const x = i * step + (step - barW) / 2;
      const y = (h - barH) / 2;
      ctx.beginPath();
      ctx.roundRect(x, y, barW, barH, 2);
      ctx.fill();
    }
  }

  function updateTrimmerUI() {
    const dur = Math.max(1, trimDraft.dur);
    const startPct = (trimDraft.start / dur) * 100;
    const endPct = (trimDraft.end / dur) * 100;
    const widthPct = Math.max(0, endPct - startPct);

    const maskLeft = document.getElementById('cc-mask-left');
    const maskRight = document.getElementById('cc-mask-right');
    const selBox = document.getElementById('cc-selection-box');
    const startVal = document.getElementById('cc-trim-start-val');
    const durVal = document.getElementById('cc-trim-dur-val');
    const endVal = document.getElementById('cc-trim-end-val');
    const floatLeft = document.getElementById('cc-float-left');
    const floatRight = document.getElementById('cc-float-right');
    const trimStartEl = document.getElementById('trim-start');
    const trimEndEl = document.getElementById('trim-end');

    if (maskLeft) maskLeft.style.width = `${startPct}%`;
    if (maskRight) maskRight.style.width = `${100 - endPct}%`;
    if (selBox) {
      selBox.style.left = `${startPct}%`;
      selBox.style.width = `${widthPct}%`;
    }

    const sStr = formatPreciseTime(trimDraft.start);
    const eStr = formatPreciseTime(trimDraft.end);
    const dStr = formatPreciseTime(Math.max(0, trimDraft.end - trimDraft.start));

    if (startVal) startVal.textContent = sStr;
    if (durVal) durVal.textContent = dStr;
    if (endVal) endVal.textContent = eStr;
    if (floatLeft) floatLeft.textContent = sStr;
    if (floatRight) floatRight.textContent = eStr;

    if (trimStartEl) trimStartEl.value = sStr;
    if (trimEndEl) trimEndEl.value = eStr;

    renderTrimmerWaveform();
  }

  function openDownloadModal(track) {
    if (!track || !el.downloadModal) return;
    trackToDownload = track;
    downloadBatch = null;
    el.downloadModal.classList.remove('batch-mode');
    const dlModeTabs = document.getElementById('dl-mode-tabs');
    if (dlModeTabs) dlModeTabs.style.display = '';

    const modalTitle = document.getElementById('download-modal-title');
    const modalTitleText = document.getElementById('download-modal-title-text');
    if (modalTitleText) modalTitleText.textContent = 'Download track';
    else if (modalTitle) modalTitle.textContent = 'Download track';
    if (el.downloadPreviewTitle) el.downloadPreviewTitle.textContent = track.title || 'untitled';
    if (el.downloadPreviewArtist) el.downloadPreviewArtist.textContent = track.artist || 'unknown artist';

    const dur = (isSameTrack(track, state.currentTrack) && el.nativeAudio && Number.isFinite(el.nativeAudio.duration) && el.nativeAudio.duration > 0)
      ? el.nativeAudio.duration
      : (track.duration && Number(track.duration) > 0 ? Number(track.duration) : 180);
    const tr = getTrackTrim(track);
    trimDraft = {
      start: tr ? Math.max(0, tr.start) : 0,
      end: tr ? Math.min(dur, tr.end) : dur,
      dur: dur
    };

    const btnCcReset = document.getElementById('btn-cc-reset');
    if (btnCcReset) {
      if (tr) btnCcReset.classList.remove('hidden');
      else btnCcReset.classList.add('hidden');
    }

    const dlTabs = document.querySelectorAll('.dl-mode-tab');
    dlTabs.forEach(t => t.classList.toggle('active', t.dataset.dlTab === 'download'));
    const dlPaneDownload = document.getElementById('dl-pane-download');
    const dlPaneTrim = document.getElementById('dl-pane-trim');
    if (dlPaneDownload) dlPaneDownload.classList.remove('hidden');
    if (dlPaneTrim) dlPaneTrim.classList.add('hidden');

    updateTrimmerUI();

    if (track.thumbnail) {
      if (el.downloadPreviewThumb) {
        el.downloadPreviewThumb.src = track.thumbnail;
        el.downloadPreviewThumb.style.display = 'block';
      }
      if (el.downloadPreviewFallback) el.downloadPreviewFallback.style.display = 'none';
    } else {
      if (el.downloadPreviewThumb) el.downloadPreviewThumb.style.display = 'none';
      if (el.downloadPreviewFallback) el.downloadPreviewFallback.style.display = 'flex';
    }

    updateDownloadBtnLabel();
    updateLosslessQualityState();
    updateDownloadCaptionPath();

    const btnDeleteOfflineTrack = document.getElementById('btn-delete-offline-track');
    if (btnDeleteOfflineTrack) {
      btnDeleteOfflineTrack.classList.add('hidden');
      if (track && track.id) {
        fetch(`http://127.0.0.1:${state.serverPort}/api/check-cache?id=${encodeURIComponent(track.id)}`)
          .then(r => r.json())
          .then(res => {
            if (res.cached) {
              btnDeleteOfflineTrack.classList.remove('hidden');
            }
          })
          .catch(() => {});
      }
    }

    openModal(el.downloadModal);
  }

  function openDownloadAllModal(playlist) {
    if (!el.downloadModal) return;
    const tracks = (playlist && Array.isArray(playlist.tracks) ? playlist.tracks : []).filter(t => t.platform !== 'local');
    if (!tracks.length) {
      showToast('No remote tracks to download in this playlist', 'info');
      return;
    }
    trackToDownload = null;
    downloadBatch = { name: playlist.name || 'Playlist', tracks };
    el.downloadModal.classList.add('batch-mode');
    const dlModeTabs = document.getElementById('dl-mode-tabs');
    if (dlModeTabs) dlModeTabs.style.display = 'none';
    const dlPaneDownload = document.getElementById('dl-pane-download');
    const dlPaneTrim = document.getElementById('dl-pane-trim');
    if (dlPaneDownload) dlPaneDownload.classList.remove('hidden');
    if (dlPaneTrim) dlPaneTrim.classList.add('hidden');
    const modalTitle = document.getElementById('download-modal-title');
    const modalTitleText = document.getElementById('download-modal-title-text');
    if (modalTitleText) modalTitleText.textContent = 'Download playlist';
    else if (modalTitle) modalTitle.textContent = 'Download playlist';
    if (el.downloadPreviewTitle) el.downloadPreviewTitle.textContent = playlist.name || 'Playlist';
    if (el.downloadPreviewArtist) el.downloadPreviewArtist.textContent = `${tracks.length} track${tracks.length === 1 ? '' : 's'}`;
    if (el.downloadPreviewThumb) el.downloadPreviewThumb.style.display = 'none';
    if (el.downloadPreviewFallback) el.downloadPreviewFallback.style.display = 'none';
    updateDownloadBtnLabel();
    updateLosslessQualityState();
    updateDownloadCaptionPath();
    openModal(el.downloadModal);
  }

  var dlTabs = document.querySelectorAll('.dl-mode-tab');
  dlTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.dlTab;
      dlTabs.forEach(t => t.classList.toggle('active', t === tab));
      const dlPaneDownload = document.getElementById('dl-pane-download');
      const dlPaneTrim = document.getElementById('dl-pane-trim');
      if (target === 'trim') {
        if (dlPaneDownload) dlPaneDownload.classList.add('hidden');
        if (dlPaneTrim) dlPaneTrim.classList.remove('hidden');
        updateTrimmerUI();
      } else {
        if (dlPaneDownload) dlPaneDownload.classList.remove('hidden');
        if (dlPaneTrim) dlPaneTrim.classList.add('hidden');
      }
    });
  });

  var ccStage = document.getElementById('capcut-wave-stage');
  var ccHandleLeft = document.getElementById('cc-handle-left');
  var ccHandleRight = document.getElementById('cc-handle-right');

  if (ccHandleLeft && ccStage) {
    let isDraggingLeft = false;
    ccHandleLeft.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      isDraggingLeft = true;
      ccHandleLeft.setPointerCapture(e.pointerId);
      ccHandleLeft.classList.add('dragging');
    });
    ccHandleLeft.addEventListener('pointermove', (e) => {
      if (!isDraggingLeft) return;
      const rect = ccStage.getBoundingClientRect();
      if (!rect.width) return;
      let ratio = (e.clientX - rect.left) / rect.width;
      const maxRatio = (trimDraft.end - 1.0) / trimDraft.dur;
      ratio = Math.max(0, Math.min(ratio, maxRatio));
      trimDraft.start = Math.round(ratio * trimDraft.dur * 10) / 10;
      updateTrimmerUI();
    });
    const stopDragLeft = (e) => {
      if (!isDraggingLeft) return;
      isDraggingLeft = false;
      try { ccHandleLeft.releasePointerCapture(e.pointerId); } catch (_) {}
      ccHandleLeft.classList.remove('dragging');
    };
    ccHandleLeft.addEventListener('pointerup', stopDragLeft);
    ccHandleLeft.addEventListener('pointercancel', stopDragLeft);
  }

  if (ccHandleRight && ccStage) {
    let isDraggingRight = false;
    ccHandleRight.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      isDraggingRight = true;
      ccHandleRight.setPointerCapture(e.pointerId);
      ccHandleRight.classList.add('dragging');
    });
    ccHandleRight.addEventListener('pointermove', (e) => {
      if (!isDraggingRight) return;
      const rect = ccStage.getBoundingClientRect();
      if (!rect.width) return;
      let ratio = (e.clientX - rect.left) / rect.width;
      const minRatio = (trimDraft.start + 1.0) / trimDraft.dur;
      ratio = Math.min(1.0, Math.max(ratio, minRatio));
      trimDraft.end = Math.round(ratio * trimDraft.dur * 10) / 10;
      updateTrimmerUI();
    });
    const stopDragRight = (e) => {
      if (!isDraggingRight) return;
      isDraggingRight = false;
      try { ccHandleRight.releasePointerCapture(e.pointerId); } catch (_) {}
      ccHandleRight.classList.remove('dragging');
    };
    ccHandleRight.addEventListener('pointerup', stopDragRight);
    ccHandleRight.addEventListener('pointercancel', stopDragRight);
  }

  if (ccStage) {
    ccStage.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.cc-handle')) return;
      const rect = ccStage.getBoundingClientRect();
      if (!rect.width) return;
      let ratio = (e.clientX - rect.left) / rect.width;
      ratio = Math.max(0, Math.min(1.0, ratio));
      const targetSec = ratio * trimDraft.dur;
      if (isSameTrack(state.currentTrack, trackToDownload)) {
        if (el.nativeAudio) {
          el.nativeAudio.currentTime = targetSec;
          playSmooth();
        }
      } else if (trackToDownload) {
        playTrack(trackToDownload).then(() => {
          if (el.nativeAudio) {
            el.nativeAudio.currentTime = targetSec;
            playSmooth();
          }
        });
      }
    });
  }

  var btnCcPreview = document.getElementById('btn-cc-preview');
  if (btnCcPreview) {
    btnCcPreview.addEventListener('click', async () => {
      if (!trackToDownload) return;
      if (!isSameTrack(state.currentTrack, trackToDownload)) {
        await playTrack(trackToDownload);
      }
      if (el.nativeAudio) {
        el.nativeAudio.currentTime = trimDraft.start;
        playSmooth();
      }
    });
  }

  var btnCcSave = document.getElementById('btn-cc-save');
  if (btnCcSave) {
    btnCcSave.addEventListener('click', () => {
      if (!trackToDownload) return;
      saveTrackTrim(trackToDownload, trimDraft.start, trimDraft.end, trimDraft.dur);
      showToast('Track trim saved (' + formatPreciseTime(trimDraft.start) + ' – ' + formatPreciseTime(trimDraft.end) + ')');
      const btnCcReset = document.getElementById('btn-cc-reset');
      if (btnCcReset) btnCcReset.classList.remove('hidden');
      if (isSameTrack(state.currentTrack, trackToDownload) && el.nativeAudio) {
        if (el.nativeAudio.currentTime < trimDraft.start || el.nativeAudio.currentTime > trimDraft.end) {
          el.nativeAudio.currentTime = trimDraft.start;
        }
      }
    });
  }

  var btnCcReset = document.getElementById('btn-cc-reset');
  if (btnCcReset) {
    btnCcReset.addEventListener('click', () => {
      if (!trackToDownload) return;
      const cid = getTrackCanonicalId(trackToDownload);
      if (cid) {
        const all = getTrackTrims();
        delete all[cid];
        try { localStorage.setItem('riff_track_trims', JSON.stringify(all)); } catch (_) {}
      }
      trimDraft.start = 0;
      trimDraft.end = trimDraft.dur;
      updateTrimmerUI();
      btnCcReset.classList.add('hidden');
      showToast('Track trim removed');
    });
  }

  function setDownloadFormat(fmt) {
    selectedFormat = fmt || 'mp3';
    localStorage.setItem('riff_download_format', selectedFormat);
    document.querySelectorAll('.format-chip').forEach(c => {
      c.classList.toggle('active', c.dataset.format === selectedFormat);
    });
    updateDownloadBtnLabel();
    updateLosslessQualityState();
  }

  var losslessWarnTimeout = null;
  function showLosslessWarnBadge(fmt = 'flac') {
    let badge = document.getElementById('lossless-warn-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'lossless-warn-badge';
      badge.className = 'lossless-warn-badge hidden';
      document.body.appendChild(badge);
    }
    const isRu = (localStorage.getItem('riff_ui_lang') || localStorage.getItem('riff_lang') || 'en').startsWith('ru');
    const fmtName = (fmt || 'flac').toUpperCase();
    badge.textContent = isRu
      ? `${fmtName} — не магия: стриминговый звук не станет студийным lossless`
      : `${fmtName} is not magic: streaming audio won't become studio lossless`;

    if (losslessWarnTimeout) {
      clearTimeout(losslessWarnTimeout);
      losslessWarnTimeout = null;
    }
    badge.classList.remove('hidden', 'warn-animate');
    void badge.offsetWidth;
    badge.classList.add('warn-animate');

    losslessWarnTimeout = setTimeout(() => {
      badge.classList.add('hidden');
      badge.classList.remove('warn-animate');
    }, 5000);
  }

  document.querySelectorAll('.format-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const fmt = chip.dataset.format;
      setDownloadFormat(fmt);
      if (fmt === 'flac' || fmt === 'wav') {
        showLosslessWarnBadge(fmt);
      }
    });
  });

  setDownloadFormat(selectedFormat);

  document.querySelectorAll('.quality-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.quality-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      selectedQuality = chip.dataset.quality;
    });
  });

  var downloadAbort = null;

  function cancelCurrentDownload() {
    if (downloadAbort) {
      try { downloadAbort.abort(); } catch (_) {}
      downloadAbort = null;
      const curSpinner = el.downloadSpinner || document.getElementById('download-spinner');
      if (curSpinner) curSpinner.innerHTML = '';
      if (el.btnConfirmDownload) {
        el.btnConfirmDownload.style.display = '';
        el.btnConfirmDownload.disabled = false;
      }
      updateDownloadBtnLabel();
      showToast('Download cancelled', 'info');
      if (el.downloadModal) closeModal(el.downloadModal);
      return true;
    }
    return false;
  }

  if (el.btnCloseDownloadModal) {
    el.btnCloseDownloadModal.addEventListener('click', () => {
      if (!cancelCurrentDownload()) {
        if (el.downloadModal) closeModal(el.downloadModal);
      }
    });
  }

  if (el.btnCancelDownload) {
    el.btnCancelDownload.addEventListener('click', () => {
      if (!cancelCurrentDownload()) {
        if (el.downloadModal) closeModal(el.downloadModal);
      }
    });
  }

  if (el.btnPlaybarMore) {
    el.btnPlaybarMore.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.currentTrack) {
        openTrackContextMenu(e, state.currentTrack, { row: el.btnPlaybarMore, index: state.queueIndex });
      } else {
        showToast('No track currently playing', 'info');
      }
    });
  }

  var btnPlaybarShare = document.getElementById('btn-playbar-share');
  if (btnPlaybarShare) {
    btnPlaybarShare.addEventListener('click', () => {
      if (state.currentTrack) {
        executeCopyShareLink(state.currentTrack);
      } else {
        showToast('No track currently playing', 'info');
      }
    });
  }

  function parseTimeInputToSeconds(str) {
    if (!str || typeof str !== 'string') return null;
    const s = str.trim();
    if (!s) return null;
    if (/^\d+(\.\d+)?$/.test(s)) {
      const val = parseFloat(s);
      return isNaN(val) ? null : Math.max(0, val);
    }
    const parts = s.split(':').map(p => p.trim());
    if (parts.length === 2) {
      const m = parseInt(parts[0], 10);
      const sec = parseFloat(parts[1]);
      if (!isNaN(m) && !isNaN(sec) && m >= 0 && sec >= 0) {
        return m * 60 + sec;
      }
    } else if (parts.length === 3) {
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const sec = parseFloat(parts[2]);
      if (!isNaN(h) && !isNaN(m) && !isNaN(sec) && h >= 0 && m >= 0 && sec >= 0) {
        return h * 3600 + m * 60 + sec;
      }
    }
    return null;
  }

  function trimAudioBuffer(ctx, buffer, startSec, endSec) {
    const sampleRate = buffer.sampleRate;
    const numChannels = buffer.numberOfChannels;
    const totalDuration = buffer.duration;
    const start = Math.max(0, Math.min(startSec || 0, totalDuration));
    const end = (endSec !== null && endSec !== undefined && endSec > start)
      ? Math.min(endSec, totalDuration)
      : totalDuration;

    if (start <= 0 && end >= totalDuration) {
      return buffer;
    }

    const startSample = Math.floor(start * sampleRate);
    const endSample = Math.floor(end * sampleRate);
    const length = Math.max(1, endSample - startSample);

    const trimmed = ctx.createBuffer(numChannels, length, sampleRate);
    for (let ch = 0; ch < numChannels; ch++) {
      const srcData = buffer.getChannelData(ch);
      const dstData = trimmed.getChannelData(ch);
      dstData.set(srcData.subarray(startSample, startSample + length));
    }
    return trimmed;
  }

  function audioBufferToWav(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const bitDepth = 16;
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    const length = buffer.length;
    const dataSize = length * blockAlign;
    const arrayBuffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(arrayBuffer);

    const writeStr = (offset, str) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };

    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeStr(36, 'data');
    view.setUint32(40, dataSize, true);

    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }
    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }

  if (el.btnConfirmDownload) {
    el.btnConfirmDownload.addEventListener('click', async () => {
      if (downloadBatch) {
        const tracks = downloadBatch.tracks;
        el.btnConfirmDownload.disabled = true;
        let done = 0;
        let failed = 0;
        let lastDir = null;
        for (let i = 0; i < tracks.length; i++) {
          const t = tracks[i];
          if (el.downloadBtnText) el.downloadBtnText.textContent = `Downloading ${i + 1}/${tracks.length}`;
          if (el.btnConfirmDownload) el.btnConfirmDownload.title = `Downloading ${i + 1}/${tracks.length}`;
          try {
            const customDir = state.downloadDir || localStorage.getItem('riff_download_dir') || '';
            const thumbUrl = getTrackThumbUrl(t) || t.thumbnail || t.cover || '';
            const downloadUrl = `http://127.0.0.1:${state.serverPort}/api/download?url=${encodeURIComponent(t.url || '')}&id=${encodeURIComponent(t.id || '')}&title=${encodeURIComponent(t.title || '')}&artist=${encodeURIComponent(t.artist || '')}&format=${selectedFormat}&quality=${selectedQuality}&thumbnail=${encodeURIComponent(thumbUrl)}&customDir=${encodeURIComponent(customDir)}`;
            const res = await fetch(downloadUrl);
            const text = await res.text();
            let data;
            try {
              data = JSON.parse(text);
            } catch (e) {
              throw new Error(text || 'server error');
            }
            if (!data.success) throw new Error(data.error || 'Failed to download');
            done++;
            if (data.directory) lastDir = data.directory;
          } catch (err) {
            failed++;
            console.error('Download failed:', t.title || t.url || '', err.message);
          }
        }
        el.btnConfirmDownload.disabled = false;
        downloadBatch = null;
        if (el.downloadModal) closeModal(el.downloadModal);
        showToast(failed > 0 ? `Downloaded ${done}/${tracks.length} (${failed} failed)` : `Downloaded ${tracks.length} tracks${lastDir ? ' to ' + lastDir : ''}`, failed > 0 ? 'error' : 'success');
        return;
      }
      if (!trackToDownload) return;
      const t = trackToDownload;

      const trimStartEl = document.getElementById('trim-start');
      const trimEndEl = document.getElementById('trim-end');
      const rawStart = trimStartEl ? trimStartEl.value.trim() : '';
      const rawEnd = trimEndEl ? trimEndEl.value.trim() : '';

      const parsedStart = parseTimeInputToSeconds(rawStart);
      const startSec = (parsedStart !== null && parsedStart >= 0) ? parsedStart : 0;
      const endSec = rawEnd ? parseTimeInputToSeconds(rawEnd) : null;

      if (endSec !== null && endSec <= startSec) {
        showToast('Trim end must be after start', 'error');
        return;
      }

      if (el.btnConfirmDownload) {
        el.btnConfirmDownload.disabled = true;
        el.btnConfirmDownload.style.display = 'none';
      }
      const spinnerEl = el.downloadSpinner || document.getElementById('download-spinner');
      if (spinnerEl) {
        spinnerEl.innerHTML = `<div class="m3-spinner-container" style="width: 32px; height: 32px; padding: 4px; background: transparent; color: var(--md-sys-color-primary);"><span class="riff-dots-loader" aria-hidden="true"><i></i><i></i><i></i></span></div>`;
      }

      showToast(`Downloading: ${t.title || 'Track'} (.${selectedFormat})`, 'info');
      downloadAbort = new AbortController();

      try {
        let audioSourceUrl = null;
        const isLocal = Boolean(
          t.platform === 'local' ||
          t.source === 'local' ||
          (typeof t.id === 'string' && t.id.startsWith('local_')) ||
          (typeof t.url === 'string' && t.url.startsWith('file:')) ||
          Boolean(t.path) ||
          Boolean(t.filePath)
        );

        const isCurrent = isSameTrack(t, state.currentTrack);
        if (isCurrent && el.nativeAudio && el.nativeAudio.src && !el.nativeAudio.src.startsWith('blob:')) {
          audioSourceUrl = el.nativeAudio.src;
        }

        if (isLocal) {
          if (!audioSourceUrl) {
            const localMatch = (state.localFiles || []).concat(state.localTracks || []).find(item => item && (
              (t.id && item.id === t.id) ||
              (t.path && (item.path === t.path || item.filePath === t.path)) ||
              (t.url && item.url === t.url)
            ));
            const p = t.path || t.filePath || localMatch?.path || localMatch?.filePath;
            const u = t.url || localMatch?.url;
            if (u && String(u).startsWith('file:')) {
              audioSourceUrl = u;
            } else if (p) {
              const norm = String(p).replace(/\\/g, '/');
              audioSourceUrl = norm.startsWith('file:') ? norm : ('file://' + (norm.startsWith('/') ? '' : '/') + encodeURI(norm));
            } else if (u) {
              audioSourceUrl = u;
            }
          }

          if (!audioSourceUrl && t.id) {
            try {
              const libUrl = `http://127.0.0.1:${state.serverPort}/api/library-file?id=${encodeURIComponent(t.id)}`;
              const checkLib = await fetch(libUrl, { method: 'HEAD', signal: downloadAbort.signal }).catch(() => null);
              if (checkLib && checkLib.ok) {
                audioSourceUrl = libUrl;
              }
            } catch (_) {}
          }

          if (!audioSourceUrl && t.id) {
            try {
              const checkRes = await fetch(`http://127.0.0.1:${state.serverPort}/api/check-cache?id=${encodeURIComponent(t.id)}`, { signal: downloadAbort.signal });
              const checkData = await checkRes.json();
              if (checkData && checkData.cached) {
                audioSourceUrl = `http://127.0.0.1:${state.serverPort}/api/local-track?id=${encodeURIComponent(t.id)}`;
              }
            } catch (_) {}
          }

          if (!audioSourceUrl) {
            throw new Error('Local file not found on disk');
          }
        } else {
          if (!audioSourceUrl && t.id) {
            try {
              const checkRes = await fetch(`http://127.0.0.1:${state.serverPort}/api/check-cache?id=${encodeURIComponent(t.id)}`, { signal: downloadAbort.signal });
              const checkData = await checkRes.json();
              if (checkData && checkData.cached) {
                audioSourceUrl = `http://127.0.0.1:${state.serverPort}/api/local-track?id=${encodeURIComponent(t.id)}`;
              }
            } catch (_) {}
          }

          if (!audioSourceUrl) {
            const streamInfoUrl = `http://127.0.0.1:${state.serverPort}/api/stream-info?url=${encodeURIComponent(t.url || '')}&id=${encodeURIComponent(t.id || '')}&platform=${t.platform || 'ytmusic'}&title=${encodeURIComponent(t.title || '')}&artist=${encodeURIComponent(t.artist || '')}&duration=${encodeURIComponent(t.duration || 0)}`;
            const streamRes = await fetch(streamInfoUrl, { signal: downloadAbort.signal });
            const streamData = await streamRes.json();
            if (!streamData || !streamData.success || (!streamData.streamUrl && !streamData.proxyUrl)) {
              throw new Error((streamData && streamData.error) || 'Failed to locate track audio stream');
            }
            audioSourceUrl = streamData.isLocal ? streamData.streamUrl : (streamData.proxyUrl || streamData.streamUrl);
          }
        }

        let fetchUrl = audioSourceUrl;
        const isFile = fetchUrl.startsWith('file:');
        const isLoopback = isFile || fetchUrl.startsWith('http://127.0.0.1') || fetchUrl.startsWith('http://localhost');
        if (!isLoopback) {
          fetchUrl = `http://127.0.0.1:${state.serverPort}/api/audio-proxy?url=${encodeURIComponent(audioSourceUrl)}`;
        }

        let arrayBuffer = null;
        if (isFile) {
          try {
            const resFile = await fetch(fetchUrl, { signal: downloadAbort.signal });
            if (resFile.ok || resFile.status === 200 || resFile.status === 0) {
              const ab = await resFile.arrayBuffer();
              if (ab && ab.byteLength > 0) arrayBuffer = ab;
            }
          } catch (fe) {
            console.warn('Fetch local file warning, will try XHR fallback:', fe);
          }
          if (!arrayBuffer) {
            arrayBuffer = await new Promise((resolve, reject) => {
              const xhr = new XMLHttpRequest();
              xhr.open('GET', fetchUrl, true);
              xhr.responseType = 'arraybuffer';
              xhr.onload = () => {
                if ((xhr.status === 200 || xhr.status === 0) && xhr.response && xhr.response.byteLength > 0) {
                  resolve(xhr.response);
                } else {
                  reject(new Error(`Failed to load audio (${xhr.status || 'empty'})`));
                }
              };
              xhr.onerror = () => reject(new Error('Failed to load local audio file'));
              if (downloadAbort?.signal) {
                downloadAbort.signal.addEventListener('abort', () => {
                  try { xhr.abort(); } catch (_) {}
                  reject(new DOMException('Aborted', 'AbortError'));
                });
              }
              xhr.send();
            });
          }
        } else {
          const resFile = await fetch(fetchUrl, { signal: downloadAbort.signal });
          if (!resFile.ok) throw new Error(`Failed to load audio (${resFile.status})`);
          arrayBuffer = await resFile.arrayBuffer();
        }

        if (downloadAbort?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');

        const decodeCtx = audioEngine.ctx || new (window.AudioContext || window.webkitAudioContext)();
        const decodedBuffer = await new Promise((resolve, reject) => {
          decodeCtx.decodeAudioData(arrayBuffer.slice(0), resolve, reject);
        });

        if (downloadAbort?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');

        let bufferToProcess = decodedBuffer;
        if (startSec > 0 || (endSec !== null && endSec < decodedBuffer.duration)) {
          bufferToProcess = trimAudioBuffer(decodeCtx, decodedBuffer, startSec, endSec);
        }

        const applyEffects = Boolean(document.getElementById('download-apply-effects')?.checked);
        let finalBuffer = bufferToProcess;
        if (applyEffects) {
          const currentSettings = {
            ...state.audioSettings,
            volume: 1.0,
            eq: { ...(state.audioSettings.eq || {}) },
            eqBands: Array.isArray(state.audioSettings.eqBands) ? [...state.audioSettings.eqBands] : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
          };
          finalBuffer = await audioEngine.renderOffline(bufferToProcess, currentSettings);
        }

        if (downloadAbort?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');

        const wavBlob = audioBufferToWav(finalBuffer);

        if (downloadAbort?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');

        let thumbUrl = getTrackThumbUrl(t) || t.thumbnail || t.cover || '';
        if (thumbUrl && String(thumbUrl).startsWith('file://')) {
          try {
            thumbUrl = decodeURIComponent(new URL(thumbUrl).pathname);
          } catch (_) {
            thumbUrl = decodeURIComponent(String(thumbUrl).replace(/^file:\/\//, ''));
          }
        }
        const customDir = state.downloadDir || localStorage.getItem('riff_download_dir') || '';
        const encodeUrl = `http://127.0.0.1:${state.serverPort}/api/encode?title=${encodeURIComponent(t.title || 'untitled')}&artist=${encodeURIComponent(t.artist || 'unknown artist')}&format=${selectedFormat}&quality=${selectedQuality}&thumbnail=${encodeURIComponent(thumbUrl)}&customDir=${encodeURIComponent(customDir)}`;
        const resEncode = await fetch(encodeUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'audio/wav' },
          body: wavBlob,
          signal: downloadAbort.signal
        });
        const textEncode = await resEncode.text();
        let dataEncode;
        try {
          dataEncode = JSON.parse(textEncode);
        } catch (e) {
          throw new Error(textEncode || 'Server error');
        }
        if (!dataEncode.success) throw new Error(dataEncode.error || 'Failed to encode');

        showToast(`Download complete: saved to ${dataEncode.directory ? dataEncode.directory + '/' : ''}${dataEncode.filename}`, 'info');
        if (el.downloadModal) closeModal(el.downloadModal);
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.error('Download error:', err);
        showToast(`Download failed: ${err.message}`, 'error');
      } finally {
        downloadAbort = null;
        const curSpinner = el.downloadSpinner || document.getElementById('download-spinner');
        if (curSpinner) curSpinner.innerHTML = '';
        if (el.btnConfirmDownload) {
          el.btnConfirmDownload.style.display = '';
          el.btnConfirmDownload.disabled = false;
        }
        updateDownloadBtnLabel();
      }
    });
  }

  var btnDownloadPlaylist = document.getElementById('btn-download-playlist');
  if (btnDownloadPlaylist) {
    btnDownloadPlaylist.addEventListener('click', () => {
      const pl = (state.playlists || []).find(p => p.id === state.currentPlaylistId);
      openDownloadAllModal(pl);
    });
  }

  var btnPlayPlaylistShuffle = document.getElementById('btn-play-playlist-shuffle');
  if (btnPlayPlaylistShuffle) {
    btnPlayPlaylistShuffle.addEventListener('click', () => {
      const pl = (state.playlists || []).find(p => p.id === state.currentPlaylistId);
      if (!pl || !pl.tracks || pl.tracks.length === 0) return;
      const list = sortTracksFor('playlist', pl.tracks, pl.id);
      const shuffled = [...list];
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
      playTrack(shuffled[0], shuffled, 0, 'playlist');
    });
  }

  var btnPlayPlaylist = el.btnPlayPlaylist || document.getElementById('btn-play-playlist');
  if (btnPlayPlaylist) {
    btnPlayPlaylist.addEventListener('click', () => {
      const pl = (state.playlists || []).find(p => p.id === state.currentPlaylistId);
      if (!pl || !pl.tracks?.length) return;
      const list = sortTracksFor('playlist', pl.tracks, pl.id);
      state.isRadioQueue = false;
      state.queueHistory = [];
      if (state.isShuffle) {
        state.isShuffle = false;
        localStorage.setItem('riff_shuffle', '0');
        if (el.btnShuffle) el.btnShuffle.classList.remove('active');
      }
      playTrack(list[0], list, 0, 'playlist');
    });
  }

  var btnPlaylistMore = document.getElementById('btn-playlist-more');
  if (btnPlaylistMore) {
    btnPlaylistMore.addEventListener('click', (e) => {
      openPlaylistInAppMenu(e, state.currentPlaylistId);
    });
  }

  refreshNavBadges();
  renderPlaylistsList();
  renderPresets();
  syncSettingsSlidersToState();
  applyVisualEffects();

  var analysisCache = new Map();
  myWaveCurrentTracks = (Array.isArray(myWaveCurrentTracks) && myWaveCurrentTracks.length > 0) ? myWaveCurrentTracks : [];
  var jumpBackCurrentTracks = [];
  var homeMode = localStorage.getItem('riff_home_pane') === 'recent' ? 'recent' : 'wave';
  var isExtendingMyWave = false;


  function getCachedTrackAnalysis(trackId) {
    if (!trackId) return null;
    const cleanId = String(trackId).replace(/[^a-zA-Z0-9_-]/g, '_');
    if (analysisCache.has(cleanId)) return analysisCache.get(cleanId);
    try {
      const stored = localStorage.getItem(`riff_audio_analysis_${cleanId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        analysisCache.set(cleanId, parsed);
        return parsed;
      }
    } catch (e) {}
    return null;
  }

  function setCachedTrackAnalysis(trackId, analysis) {
    if (!trackId || !analysis) return;
    const cleanId = String(trackId).replace(/[^a-zA-Z0-9_-]/g, '_');
    analysisCache.set(cleanId, analysis);
    try {
      localStorage.setItem(`riff_audio_analysis_${cleanId}`, JSON.stringify(analysis));
      fetch(`http://127.0.0.1:${state.serverPort}/api/track-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: cleanId, analysis })
      }).catch(() => {});
    } catch (e) {}
  }

  function getTitleOnlyKey(title) {
    let t = String(title || '').toLowerCase();
    t = t.replace(/\s*\([^)]*official[^)]*\)/gi, '')
         .replace(/\s*\[[^\]]*\]/gi, '')
         .replace(/\s*\([^)]*(video|audio|remaster(ed)?|lyrics?|visualizer)[^)]*\)/gi, '');
    t = t.replace(/\s*(feat\.?|ft\.?)\s+[^(\[-]+/gi, '')
         .replace(/\s*\((feat\.?|ft\.?)[^)]*\)/gi, '');
    t = t.replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
    return t;
  }

  function getTrackNormalizedKey(artist, title) {
    let a = String(artist || '').toLowerCase().replace(/ё/g, 'е');
    a = a.replace(/\s*-\s*topic|vevo|records|official/gi, '');
    const parts = a.split(/[,;&\/]|\s+(?:feat\.?|ft\.?|with|x|×)\s+/i);
    a = parts[0] || '';
    a = a.replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
    const cleanTitle = String(title || '').replace(/ё/gi, 'е');
    const t = getTitleOnlyKey(cleanTitle).replace(/ё/g, 'е');
    return `${a}::${t}`;
  }

  function getCoreTitleRoot(title) {
    let t = String(title || '').toLowerCase().replace(/ё/gi, 'е');
    t = t.replace(/\s*(feat\.?|ft\.?)\s+[^(\[-]+/gi, ' ');
    t = t.replace(/\([^)]*\)/g, ' ').replace(/\[[^\]]*\]/g, ' ');
    t = t.replace(/\b(slowed|reverb|sped\s+up|speed\s+up|nightcore|remix|edit|version|prod|feat|ft|official|audio|video|lyrics)\b/gi, ' ');
    t = t.replace(/[^\p{L}\p{N}\s]/gu, ' ');
    return t.replace(/\s+/g, ' ').trim();
  }

  function getNormalizedPrimaryArtist(artist) {
    let a = String(artist || '').toLowerCase().replace(/ё/gi, 'е');
    a = a.replace(/-\s*topic\b/gi, '')
         .replace(/\b(vevo|official|records|topic)\b/gi, '');
    const parts = a.split(/[,;&\/]|\s+(?:feat\.?|ft\.?|with|x|×)\s+/i);
    a = (parts.find(p => p.trim().length > 0) || '').trim();
    return a.replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  }

  function isDuplicateOrVariantTrack(a, b) {
    if (!a || !b) return false;
    const artA = getNormalizedPrimaryArtist(a.artist);
    const artB = getNormalizedPrimaryArtist(b.artist);
    if (!artA || !artB || artA !== artB) return false;

    const rA = getCoreTitleRoot(a.title);
    const rB = getCoreTitleRoot(b.title);
    if (!rA || !rB) return false;
    if (rA === rB) return true;

    const minLen = Math.min(rA.length, rB.length);
    if (minLen >= 6 && (rA.includes(rB) || rB.includes(rA))) return true;

    const tokensA = rA.split(' ').filter(Boolean);
    const tokensB = rB.split(' ').filter(Boolean);
    if (!tokensA.length || !tokensB.length) return false;

    const setA = new Set(tokensA);
    const setB = new Set(tokensB);
    let common = 0;
    for (const tok of setA) {
      if (setB.has(tok)) common++;
    }
    const maxTokens = Math.max(setA.size, setB.size);
    if (maxTokens > 0 && (common / maxTokens) >= 0.65) return true;
    const dice = (2 * common) / (setA.size + setB.size);
    if (dice >= 0.65) return true;

    return false;
  }

  var WAVE_SKIPS_KEY = 'riff_wave_skips';
  var FAILED_TRACKS_KEY = 'riff_failed_tracks';


  function normalizeArtistName(name) {
    return String(name || '')
      .replace(/\b(official|vevo|records|topic)\b/gi, '')
      .replace(/[^\w\s&-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function getWaveSkips() {
    try {
      const raw = localStorage.getItem(WAVE_SKIPS_KEY);
      return Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function recordWaveSkip(track) {
    if (!track) return;
    const key = (typeof getTrackNormalizedKey === 'function') ? getTrackNormalizedKey(track.artist, track.title) : '';
    const artist = (track.artist || '').trim();
    if (!key && !artist) return;
    const skips = getWaveSkips();
    skips.push({ key, artist, t: Date.now() });
    if (skips.length > 200) {
      skips.splice(0, skips.length - 200);
    }
    try {
      localStorage.setItem(WAVE_SKIPS_KEY, JSON.stringify(skips));
    } catch (e) {}
  }

  function getBlockedArtists() {
    try {
      const raw = localStorage.getItem('riff_blocked_artists');
      return Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  }

  function getBlockedTracks() {
    try {
      const raw = localStorage.getItem('riff_blocked_tracks');
      return Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  }

  function isArtistBlocked(name) {
    if (!name || typeof name !== 'string') return false;
    const clean = name.trim();
    if (!clean) return false;
    const target = typeof normalizeArtistName === 'function' ? normalizeArtistName(clean) : clean.toLowerCase();
    const list = getBlockedArtists();
    return list.some(a => {
      const na = typeof normalizeArtistName === 'function' ? normalizeArtistName(a) : (a || '').trim().toLowerCase();
      return na === target;
    });
  }

  function isTrackBlocked(track) {
    if (!track) return false;
    const list = getBlockedTracks();
    if (!list.length) return false;
    const trackId = track.id || '';
    const trackKey = track.key || (typeof getTrackNormalizedKey === 'function' && track.artist && track.title ? getTrackNormalizedKey(track.artist, track.title) : `${track.artist}-${track.title}`);
    const normTitle = (track.title || '').trim().toLowerCase();
    const normArtist = typeof normalizeArtistName === 'function' ? normalizeArtistName(track.artist || '') : (track.artist || '').trim().toLowerCase();

    return list.some(bt => {
      if (trackId && bt.id && trackId === bt.id) return true;
      if (trackKey && bt.key && trackKey === bt.key) return true;
      if (normTitle && bt.title && bt.title.trim().toLowerCase() === normTitle) {
        const btArtist = typeof normalizeArtistName === 'function' ? normalizeArtistName(bt.artist || '') : (bt.artist || '').trim().toLowerCase();
        if (!normArtist || !btArtist || normArtist === btArtist) return true;
      }
      return false;
    });
  }

  function toggleBlockArtist(name) {
    if (!name) return false;
    const clean = name.trim();
    const list = getBlockedArtists();
    const target = typeof normalizeArtistName === 'function' ? normalizeArtistName(clean) : clean.toLowerCase();
    const idx = list.findIndex(a => {
      const na = typeof normalizeArtistName === 'function' ? normalizeArtistName(a) : (a || '').trim().toLowerCase();
      return na === target;
    });

    let blocked = false;
    if (idx >= 0) {
      list.splice(idx, 1);
      blocked = false;
    } else {
      list.push(clean);
      blocked = true;
    }
    localStorage.setItem('riff_blocked_artists', JSON.stringify(list));
    showToast(blocked ? `Blocked artist "${clean}"` : `Unblocked artist "${clean}"`, 'info');
    renderBlockedItemsSettings();
    syncArtistBlockButtonUI();
    return blocked;
  }

  function toggleBlockTrack(track) {
    if (!track) return false;
    const list = getBlockedTracks();
    const trackId = track.id || '';
    const title = track.title || '';
    const artist = track.artist || '';
    const trackKey = track.key || (typeof getTrackNormalizedKey === 'function' && artist && title ? getTrackNormalizedKey(artist, title) : `${artist}-${title}`);
    const normTitle = title.trim().toLowerCase();
    const normArtist = typeof normalizeArtistName === 'function' ? normalizeArtistName(artist) : artist.trim().toLowerCase();

    const idx = list.findIndex(bt => {
      if (trackId && bt.id && trackId === bt.id) return true;
      if (trackKey && bt.key && trackKey === bt.key) return true;
      if (normTitle && bt.title && bt.title.trim().toLowerCase() === normTitle) {
        const btArtist = typeof normalizeArtistName === 'function' ? normalizeArtistName(bt.artist || '') : (bt.artist || '').trim().toLowerCase();
        if (!normArtist || !btArtist || normArtist === btArtist) return true;
      }
      return false;
    });

    let blocked = false;
    if (idx >= 0) {
      list.splice(idx, 1);
      blocked = false;
    } else {
      list.push({ key: trackKey, id: trackId, title, artist });
      blocked = true;
    }
    localStorage.setItem('riff_blocked_tracks', JSON.stringify(list));
    showToast(blocked ? `Blocked track "${title || 'Track'}"` : `Unblocked track "${title || 'Track'}"`, 'info');
    renderBlockedItemsSettings();
    return blocked;
  }

  function syncArtistBlockButtonUI() {
    const btnBlock = document.getElementById('btn-artist-block');
    const profName = document.getElementById('artist-profile-name');
    if (btnBlock && profName && profName.textContent) {
      const isBlocked = isArtistBlocked(profName.textContent.trim());
      btnBlock.classList.toggle('active', isBlocked);
      btnBlock.classList.toggle('blocked', isBlocked);
      btnBlock.title = isBlocked ? 'Blocked' : 'Block artist';
      btnBlock.setAttribute('aria-label', isBlocked ? 'Blocked' : 'Block artist');
    }
  }

  function renderBlockedItemsSettings() {
    const container = document.getElementById('blocked-items-list');
    if (!container) return;
    const artists = getBlockedArtists();
    const tracks = getBlockedTracks();
    if (artists.length === 0 && tracks.length === 0) {
      container.innerHTML = '<span style="font-size:12px;color:var(--md-sys-color-outline);padding:4px 0;">No blocked artists or tracks</span>';
      return;
    }
    container.innerHTML = '';
    artists.forEach(a => {
      const pill = document.createElement('div');
      pill.className = 'blocked-item-pill';
      pill.innerHTML = `<span><strong>${escapeHtml(a)}</strong> <span style="opacity:0.75;font-size:11px;">(Artist)</span></span><span class="pill-del">✕</span>`;
      pill.title = `Click to unblock ${a}`;
      pill.addEventListener('click', () => {
        toggleBlockArtist(a);
      });
      container.appendChild(pill);
    });
    tracks.forEach(t => {
      const pill = document.createElement('div');
      pill.className = 'blocked-item-pill';
      const label = t.title ? `${t.title}${t.artist ? ' · ' + t.artist : ''}` : (t.key || 'Track');
      pill.innerHTML = `<span>${escapeHtml(label)} <span style="opacity:0.75;font-size:11px;">(Track)</span></span><span class="pill-del">✕</span>`;
      pill.title = `Click to unblock ${t.title || 'track'}`;
      pill.addEventListener('click', () => {
        toggleBlockTrack(t);
      });
      container.appendChild(pill);
    });
  }

  function getWaveAvoid() {
    const skips = getWaveSkips();
    const ids = [];
    const keys = [];
    const artistCounts = {};
    const artistDisplay = {};

    for (const s of skips) {
      if (s && s.key) {
        keys.push(s.key);
      }
      if (s && s.artist) {
        const a = s.artist.trim();
        const normA = normalizeArtistName(a);
        if (normA) {
          artistCounts[normA] = (artistCounts[normA] || 0) + 1;
          if (!artistDisplay[normA]) {
            artistDisplay[normA] = a;
          }
        }
      }
    }

    const artists = Object.entries(artistCounts)
      .filter(([_, count]) => count >= 3)
      .map(([normA]) => artistDisplay[normA]);

    const feedback = typeof getMixFeedback === 'function' ? getMixFeedback() : null;
    if (feedback) {
      if (Array.isArray(feedback.dislikedTracks)) {
        feedback.dislikedTracks.forEach(t => {
          if (!t) return;
          if (typeof t === 'string') {
            keys.push(t);
          } else {
            if (t.id) ids.push(t.id);
            if (t.key) keys.push(t.key);
            if (t.artist && t.title && typeof getTrackNormalizedKey === 'function') {
              keys.push(getTrackNormalizedKey(t.artist, t.title));
            }
          }
        });
      }
      if (Array.isArray(feedback.dislikedArtists)) {
        feedback.dislikedArtists.forEach(a => {
          if (a && typeof a === 'string') {
            const tr = a.trim();
            if (tr && !artists.includes(tr)) artists.push(tr);
          }
        });
      }
    }

    const bArtists = typeof getBlockedArtists === 'function' ? getBlockedArtists() : [];
    bArtists.forEach(a => {
      if (a && typeof a === 'string') {
        const tr = a.trim();
        if (tr && !artists.includes(tr)) artists.push(tr);
      }
    });

    const bTracks = typeof getBlockedTracks === 'function' ? getBlockedTracks() : [];
    bTracks.forEach(bt => {
      if (!bt) return;
      if (bt.id) ids.push(bt.id);
      if (bt.key) keys.push(bt.key);
      if (bt.artist && bt.title && typeof getTrackNormalizedKey === 'function') {
        keys.push(getTrackNormalizedKey(bt.artist, bt.title));
      }
    });

    const failed = typeof getFailedTracks === 'function' ? getFailedTracks() : { ids: [], keys: [] };
    if (Array.isArray(failed?.ids)) {
      ids.push(...failed.ids);
    }
    if (Array.isArray(failed?.keys)) {
      keys.push(...failed.keys);
    }

    return {
      ids: Array.from(new Set(ids)).filter(Boolean),
      keys: Array.from(new Set(keys)).filter(Boolean),
      artists
    };
  }


  async function computeTasteProfile(maxSeeds = 8) {
    const avoid = typeof getWaveAvoid === 'function' ? getWaveAvoid() : { keys: [], artists: [] };
    const feedback = typeof getMixFeedback === 'function' ? getMixFeedback() : null;

    const dislikedArtistSet = new Set();
    if (avoid && Array.isArray(avoid.artists)) {
      avoid.artists.forEach(a => {
        if (a) dislikedArtistSet.add(normalizeArtistName(a));
      });
    }
    if (feedback && Array.isArray(feedback.dislikedArtists)) {
      feedback.dislikedArtists.forEach(a => {
        if (a) dislikedArtistSet.add(normalizeArtistName(a));
      });
    }

    const dislikedTrackKeySet = new Set();
    if (avoid && Array.isArray(avoid.keys)) {
      avoid.keys.forEach(k => {
        if (k) dislikedTrackKeySet.add(String(k).trim().toLowerCase());
      });
    }
    if (feedback && Array.isArray(feedback.dislikedTracks)) {
      feedback.dislikedTracks.forEach(t => {
        if (!t) return;
        if (typeof t === 'string') {
          dislikedTrackKeySet.add(t.trim().toLowerCase());
        } else {
          if (t.key) dislikedTrackKeySet.add(String(t.key).trim().toLowerCase());
          if (t.id) dislikedTrackKeySet.add(String(t.id).trim().toLowerCase());
          if (t.artist && t.title && typeof getTrackNormalizedKey === 'function') {
            dislikedTrackKeySet.add(getTrackNormalizedKey(t.artist, t.title).toLowerCase());
          }
        }
      });
    }

    const favs = Array.isArray(state.favorites) ? state.favorites : [];
    const hist = Array.isArray(state.history) ? state.history : [];

    let cyrillicCount = 0;
    const durations = [];
    const allTracks = [...favs, ...hist];

    allTracks.forEach(track => {
      if (!track) return;
      if (track.title && /[\u0400-\u04FF]/.test(track.title)) {
        cyrillicCount++;
      }
      if (track.duration > 0) {
        durations.push(track.duration);
      }
    });

    const seenHistCanIds = new Set();
    const canIdRepeatBonus = new Map();
    const canIdRecency = new Map();

    hist.forEach((track, index) => {
      if (!track) return;
      const rawCanId = String(track.id || track.url || track.key || (typeof getTrackCanonicalId === 'function' ? getTrackCanonicalId(track) : '') || '').trim();
      const normKey = (track.artist && track.title && typeof getTrackNormalizedKey === 'function') ? getTrackNormalizedKey(track.artist, track.title) : '';
      const effectiveCanId = rawCanId || normKey;
      if (!effectiveCanId) return;

      if (!seenHistCanIds.has(effectiveCanId)) {
        seenHistCanIds.add(effectiveCanId);
        let recency;
        const ts = Number(track.playedAt || track.timestamp || track.date || track.time);
        if (ts && !isNaN(ts) && ts > 0) {
          const ageDays = Math.max(0, (Date.now() - ts) / (1000 * 60 * 60 * 24));
          recency = Math.pow(0.5, ageDays / 10);
        } else {
          recency = Math.pow(0.94, index);
        }
        canIdRecency.set(effectiveCanId, recency);
      } else {
        const curBonus = canIdRepeatBonus.get(effectiveCanId) || 0;
        if (curBonus < 2.0) {
          canIdRepeatBonus.set(effectiveCanId, Math.min(2.0, curBonus + 0.5));
        }
      }
    });

    const mergedMap = new Map();

    function getOrCreateEntry(track) {
      if (!track || !track.artist || !track.title) return null;
      const artist = String(track.artist).trim();
      const title = String(track.title).trim();
      if (!artist || !title) return null;
      if (dislikedArtistSet.has(normalizeArtistName(artist))) return null;
      const normKey = (typeof getTrackNormalizedKey === 'function') ? getTrackNormalizedKey(artist, title) : '';
      if (!normKey || normKey === '::') return null;
      if (dislikedTrackKeySet.has(normKey.toLowerCase()) || (track.id && dislikedTrackKeySet.has(String(track.id).trim().toLowerCase()))) return null;

      if (!mergedMap.has(normKey)) {
        mergedMap.set(normKey, {
          artist,
          title,
          id: track.id || '',
          platform: track.platform || state.platform || 'youtube',
          weight: 0,
          seenHistCanIds: new Set(),
          favAdded: false
        });
      }
      const entry = mergedMap.get(normKey);
      if (!entry.id && track.id) {
        entry.id = track.id;
        entry.platform = track.platform || state.platform || 'youtube';
      }
      return { entry, normKey };
    }

    favs.forEach((track, favIdx) => {
      const res = getOrCreateEntry(track);
      if (!res) return;
      const { entry } = res;
      if (!entry.favAdded) {
        const favRecency = track.addedAt ? Math.pow(0.5, Math.max(0, (Date.now() - track.addedAt) / (1000 * 60 * 60 * 24 * 21))) : Math.pow(0.95, favIdx);
        entry.weight += 3.0 + 2.5 * favRecency;
        entry.favAdded = true;
      }
    });

    hist.forEach(track => {
      const res = getOrCreateEntry(track);
      if (!res) return;
      const { entry, normKey } = res;
      const rawCanId = String(track.id || track.url || track.key || (typeof getTrackCanonicalId === 'function' ? getTrackCanonicalId(track) : '') || '').trim();
      const effectiveCanId = rawCanId || normKey;

      if (!entry.seenHistCanIds.has(effectiveCanId)) {
        entry.seenHistCanIds.add(effectiveCanId);
        const recency = canIdRecency.get(effectiveCanId) || 0;
        const repeatBonus = canIdRepeatBonus.get(effectiveCanId) || 0;
        entry.weight += (recency + repeatBonus);
      }
    });

    if (feedback && Array.isArray(feedback.likedTracks)) {
      feedback.likedTracks.forEach(track => {
        const res = getOrCreateEntry(track);
        if (!res) return;
        const { entry } = res;
        entry.weight += 3;
      });
    }

    const skips = typeof getWaveSkips === 'function' ? getWaveSkips() : [];
    const skipCounts = {};
    for (const s of skips) {
      if (!s) continue;
      const rawArtist = s.artist || (s.key && s.key.includes('::') ? s.key.split('::')[0] : '');
      const normA = normalizeArtistName(rawArtist);
      if (normA) {
        skipCounts[normA] = (skipCounts[normA] || 0) + 1;
      }
    }

    mergedMap.forEach(entry => {
      const normArtist = normalizeArtistName(entry.artist);
      const skipCount = skipCounts[normArtist] || 0;
      if (skipCount > 0) {
        entry.weight *= Math.pow(0.6, skipCount);
      }
    });

    const artistWeights = {};
    const artistDisplayNames = {};
    mergedMap.forEach(item => {
      if (item.artist) {
        const a = item.artist.trim();
        const normArtist = normalizeArtistName(a);
        if (normArtist) {
          artistWeights[normArtist] = (artistWeights[normArtist] || 0) + item.weight;
          if (!artistDisplayNames[normArtist]) {
            artistDisplayNames[normArtist] = a;
          }
        }
      }
    });

    if (feedback && Array.isArray(feedback.likedArtists)) {
      feedback.likedArtists.forEach(a => {
        if (!a || typeof a !== 'string') return;
        const tr = a.trim();
        const normA = normalizeArtistName(tr);
        if (normA) {
          artistWeights[normA] = (artistWeights[normA] || 0) + 4;
          if (!artistDisplayNames[normA]) {
            artistDisplayNames[normA] = tr;
          }
        }
      });
    }

    Object.keys(artistWeights).forEach(normArtist => {
      const skipCount = skipCounts[normArtist] || 0;
      if (skipCount > 0) {
        artistWeights[normArtist] *= Math.pow(0.6, skipCount);
      }
    });

    const sortedArtists = Object.entries(artistWeights)
      .sort((a, b) => b[1] - a[1])
      .map(([normArtist]) => artistDisplayNames[normArtist]);

    const seeds = Array.from(mergedMap.values())
      .filter(s => s.artist && s.title && s.artist.trim() && s.title.trim())
      .sort((a, b) => b.weight - a.weight)
      .slice(0, maxSeeds)
      .map(s => ({
        artist: s.artist,
        title: s.title,
        id: s.id,
        platform: s.platform || 'youtube',
        weight: Math.round(s.weight * 1000) / 1000
      }));

    const dominantScript = cyrillicCount > (allTracks.length ? allTracks.length * 0.35 : 0) ? 'Cyrillic' : 'Latin';
    const avgDuration = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null;

    return {
      trackCount: Math.max(mergedMap.size, favs.length),
      topArtists: sortedArtists.slice(0, 5),
      dominantScript,
      avgDuration,
      bpmLabel: null,
      energyLabel: null,
      seeds
    };
  }


  function getLocalDateString() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  async function planMixes() {
    const profile = await computeTasteProfile(40);
    const seeds = (profile && Array.isArray(profile.seeds)) ? profile.seeds : [];
    if (seeds.length === 0) return [];

    const artistMap = new Map();
    for (const s of seeds) {
      if (!s || !s.artist) continue;
      const norm = normalizeArtistName(s.artist);
      if (!norm) continue;
      if (!artistMap.has(norm)) {
        artistMap.set(norm, { name: s.artist, tracks: [] });
      }
      artistMap.get(norm).tracks.push(s);
    }

    const artists = [];
    for (const [norm, entry] of artistMap.entries()) {
      entry.tracks.sort(() => Math.random() - 0.5);
      const topTracks = entry.tracks.slice(0, 2);
      const summedWeight = topTracks.reduce((sum, t) => sum + (t.weight || 0), 0);
      artists.push({
        norm,
        name: entry.name,
        tracks: topTracks,
        weight: summedWeight
      });
    }

    artists.sort((a, b) => b.weight - a.weight);
    const topArtists = artists.slice(0, 28);
    topArtists.sort((a, b) => (b.weight * (0.65 + Math.random() * 0.7)) - (a.weight * (0.65 + Math.random() * 0.7)));
    if (topArtists.length < 1) return [];

    const bucketCount = topArtists.length >= 4 ? Math.min(5, Math.floor(topArtists.length / 2)) : topArtists.length;
    const buckets = [];
    for (let i = 0; i < bucketCount; i++) {
      buckets.push({
        title: `Daily Mix ${i + 1}`,
        artists: [],
        seeds: []
      });
    }

    topArtists.forEach((art, rank) => {
      const b = buckets[rank % bucketCount];
      b.artists.push(art.name);
      b.seeds.push(...art.tracks);
    });

    buckets.forEach(b => {
      if (b.seeds.length > 6) b.seeds = b.seeds.slice(0, 6);
    });

    let validBuckets = buckets.filter(b => b.artists.length >= 1);
    if (validBuckets.length === 0 && buckets.length > 0) {
      validBuckets = [buckets[0]];
    }

    validBuckets.forEach((b, i) => {
      b.id = `daily-mix-${i + 1}`;
      b.title = `Daily Mix ${i + 1}`;
    });

    return validBuckets;
  }

  if (typeof window !== 'undefined') {
    if (!window.crypto) {
      try { window.crypto = {}; } catch (_) {}
    }
    if (window.crypto && typeof window.crypto.createHash !== 'function') {
      try {
        let nodeCrypto = null;
        if (typeof require === 'function') {
          try { nodeCrypto = require('crypto'); } catch (_) {}
        }
        if (nodeCrypto && typeof nodeCrypto.createHash === 'function') {
          window.crypto.createHash = nodeCrypto.createHash.bind(nodeCrypto);
        } else {
          window.crypto.createHash = function() {
            let str = '';
            return {
              update(data) { str += String(data || ''); return this; },
              digest() {
                let h = 0x811c9dc5;
                for (let i = 0; i < str.length; i++) {
                  h ^= str.charCodeAt(i);
                  h = Math.imul(h, 0x01000193);
                }
                return (h >>> 0).toString(16).padStart(8, '0');
              }
            };
          };
        }
      } catch (_) {}
    }
  }

  async function generateDailyMixes(force = false) {
    if (!getAdv('my_wave', true)) return null;
    const sp = (localStorage.getItem('riff_home_layout') || 'spotify') === 'spotify';
    if (!sp) return null;

    const today = getLocalDateString();
    let cached = (window.HomeCache && window.HomeCache.get('daily_mixes', 24 * 3600 * 1000)) || safeJson(MIX_KEY, null);
    if (!cached) {
      try {
        const raw = localStorage.getItem(MIX_KEY);
        if (raw) cached = JSON.parse(raw);
      } catch (_) {}
    }

    if (!force && cached && cached.day === today && Array.isArray(cached.mixes) && cached.mixes.length > 0) {
      const seenDayKeys = new Set();
      const seenDayIds = new Set();
      if (Array.isArray(myWaveCurrentTracks)) {
        myWaveCurrentTracks.forEach(t => {
          if (!t) return;
          const k = (t.artist && t.title && typeof getTrackNormalizedKey === 'function')
            ? getTrackNormalizedKey(t.artist, t.title)
            : '';
          if (k) seenDayKeys.add(k);
          const cid = (typeof getTrackCanonicalId === 'function' ? getTrackCanonicalId(t) : '') || (t.id ? String(t.id).trim() : '');
          if (cid) seenDayIds.add(cid);
        });
      }
      cached.mixes.forEach(m => {
        if (Array.isArray(m.tracks)) {
          const seenInMix = [];
          m.tracks = m.tracks.filter(tr => {
            if (isTrackBlocked(tr) || isArtistBlocked(tr.artist) || isTrackFailedOrUnavailable(tr) || !getTrackThumbUrl(tr)) return false;
            const k = (tr && tr.artist && tr.title && typeof getTrackNormalizedKey === 'function')
              ? getTrackNormalizedKey(tr.artist, tr.title)
              : '';
            const cid = (tr && typeof getTrackCanonicalId === 'function' ? getTrackCanonicalId(tr) : '') || (tr && tr.id ? String(tr.id).trim() : '');
            if (cid && seenDayIds.has(cid)) return false;
            if (k && seenDayKeys.has(k)) return false;
            if (seenInMix.some(existing => isDuplicateOrVariantTrack(tr, existing))) return false;
            if (cid) seenDayIds.add(cid);
            if (k) seenDayKeys.add(k);
            seenInMix.push(tr);
            return true;
          });
        }
      });
      return cached;
    }

    if (state.mixesBusy) return cached;
    state.mixesBusy = true;
    if (typeof beginBusy === 'function') beginBusy('vibe');

    let buckets = [];
    try {
      buckets = await planMixes();
    } catch (_) {}

    state._plannedMixCount = buckets.length;
    if (typeof renderMadeForYou === 'function') renderMadeForYou();

    const generatedMixes = [];
    const usedDayTrackKeys = new Set();
    const usedDayTrackIds = new Set();

    if (Array.isArray(myWaveCurrentTracks)) {
      myWaveCurrentTracks.forEach(t => {
        if (!t) return;
        const k = (t.artist && t.title && typeof getTrackNormalizedKey === 'function')
          ? getTrackNormalizedKey(t.artist, t.title)
          : '';
        if (k) usedDayTrackKeys.add(k);
        const cid = (typeof getTrackCanonicalId === 'function' ? getTrackCanonicalId(t) : '') || (t.id ? String(t.id).trim() : '');
        if (cid) usedDayTrackIds.add(cid);
      });
    }

    try {
      const profile = await computeTasteProfile();
      for (let i = 0; i < buckets.length; i++) {
        const bucket = buckets[i];
        const baseAvoid = typeof getWaveAvoid === 'function' ? getWaveAvoid() : { keys: [], artists: [], ids: [] };
        const avoidKeys = Array.from(new Set([
          ...(Array.isArray(baseAvoid?.keys) ? baseAvoid.keys : []),
          ...usedDayTrackKeys
        ]));
        const avoidIds = Array.from(new Set([
          ...(Array.isArray(baseAvoid?.ids) ? baseAvoid.ids : []),
          ...usedDayTrackIds
        ]));
        const payload = {
          history: (state.history || []).slice(0, 30),
          favorites: (state.favorites || []).slice(0, 25),
          platform: 'youtube',
          limit: 20,
          clientProfile: profile,
          seeds: bucket.seeds,
          avoid: {
            keys: avoidKeys,
            artists: Array.isArray(baseAvoid?.artists) ? baseAvoid.artists : [],
            ids: avoidIds
          }
        };

        try {
          const res = await fetch(`http://127.0.0.1:${state.serverPort}/api/vibe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const data = await res.json();
          if (data && data.success && Array.isArray(data.tracks)) {
            const uniqueMixTracks = [];
            for (const tr of data.tracks) {
              if (isTrackBlocked(tr) || isArtistBlocked(tr.artist) || isTrackFailedOrUnavailable(tr) || !getTrackThumbUrl(tr)) continue;
              const k = (tr && tr.artist && tr.title && typeof getTrackNormalizedKey === 'function')
                ? getTrackNormalizedKey(tr.artist, tr.title)
                : '';
              const cid = (tr && typeof getTrackCanonicalId === 'function' ? getTrackCanonicalId(tr) : '') || (tr && tr.id ? String(tr.id).trim() : '');
              if (cid && usedDayTrackIds.has(cid)) continue;
              if (k && usedDayTrackKeys.has(k)) continue;
              if (uniqueMixTracks.some(existing => isDuplicateOrVariantTrack(tr, existing))) continue;
              if (cid) usedDayTrackIds.add(cid);
              if (k) usedDayTrackKeys.add(k);
              uniqueMixTracks.push(tr);
            }
            if (uniqueMixTracks.length >= 4) {
              const mixSeed = (uniqueMixTracks[0]?.id || '') + (uniqueMixTracks[1]?.id || '') + Date.now().toString(36);
              const mixId = 'dm_' + today + '_' + (i + 1) + '_' + crypto.createHash('md5').update(mixSeed).digest('hex').slice(0, 8);
              generatedMixes.push({
                id: mixId,
                title: 'Daily Mix ' + (i + 1),
                type: 'Daily Mix',
                isDailyMix: true,
                artists: bucket.artists,
                tracks: uniqueMixTracks
              });
              localStorage.setItem(MIX_KEY, JSON.stringify({
                day: today,
                mixes: generatedMixes
              }));
              if (window.HomeCache) {
                window.HomeCache.set('daily_mixes', { day: today, mixes: generatedMixes });
              }
              if (typeof renderMadeForYou === 'function') renderMadeForYou();
            }
          }
        } catch (err) {
          break;
        }
      }
    } catch (err) {
    } finally {
      state.mixesBusy = false;
      delete state._plannedMixCount;
      if (typeof endBusy === 'function') endBusy('vibe');
      localStorage.setItem(MIX_KEY, JSON.stringify({
        day: today,
        mixes: generatedMixes
      }));
      if (window.HomeCache && generatedMixes.length > 0) {
        window.HomeCache.set('daily_mixes', { day: today, mixes: generatedMixes });
      }
      if (typeof renderMadeForYou === 'function') renderMadeForYou();
    }
    return { day: today, mixes: generatedMixes };
  }

  function renderMadeForYou() {
    const sec = document.getElementById('sp-made-sec');
    const row = document.getElementById('sp-made');
    if (!sec || !row) return;

    if (!getAdv('my_wave', true)) {
      sec.hidden = true;
      return;
    }

    const today = getLocalDateString();
    let cached = (window.HomeCache && window.HomeCache.get('daily_mixes', 24 * 3600 * 1000)) || safeJson(MIX_KEY, null);
    if (!cached) {
      try {
        const raw = localStorage.getItem(MIX_KEY);
        if (raw) cached = JSON.parse(raw);
      } catch (_) {}
    }

    const mixes = (cached && cached.day === today && Array.isArray(cached.mixes)) ? cached.mixes : [];
    const hasWave = Array.isArray(myWaveCurrentTracks) && myWaveCurrentTracks.length > 0;

    if (!cached || cached.day !== today) {
      setTimeout(() => {
        if (!state.mixesBusy) generateDailyMixes(false);
      }, 3000);
    }

    if (!hasWave && mixes.length === 0 && !state.mixesBusy) {
      sec.hidden = true;
      return;
    }

    sec.hidden = false;
    const sig = hasWave + '|' + (myWaveCurrentTracks[0]?.id || '') + '|' + mixes.map(m => m.id + ':' + m.tracks.length).join(',') + '|' + Boolean(state.mixesBusy);
    if (row._lastHomeSig === sig && row.children.length > 0) return;
    row._lastHomeSig = sig;
    row.innerHTML = '';

    let myWaveCard;
    if (hasWave) {
      myWaveCard = spCard({
        cover: coverCandidatesFromTracks(myWaveCurrentTracks),
        title: 'For you',
        sub: 'Based on your taste',
        onClick: playMyWave
      });
    } else {
      myWaveCard = document.createElement('div');
      myWaveCard.className = 'sp-card';
      const coverWrap = document.createElement('div');
      coverWrap.className = 'sp-card-cover';
      coverWrap.style.display = 'flex';
      coverWrap.style.alignItems = 'center';
      coverWrap.style.justifyContent = 'center';
      coverWrap.innerHTML = `
        <div class="m3-spinner-container" style="width: 32px; height: 32px; background: transparent;">
          <span class="riff-dots-loader" aria-hidden="true"><i></i><i></i><i></i></span>
        </div>
      `;
      const titleEl = document.createElement('div');
      titleEl.className = 'sp-card-title sp-fade';
      titleEl.textContent = 'For you';
      const subEl = document.createElement('div');
      subEl.className = 'sp-card-sub sp-fade';
      subEl.textContent = 'Based on your taste';
      myWaveCard.appendChild(coverWrap);
      myWaveCard.appendChild(titleEl);
      myWaveCard.appendChild(subEl);
      myWaveCard.addEventListener('click', playMyWave);
    }
    row.appendChild(myWaveCard);

    mixes.forEach((mix, i) => {
      const fourCovers = getMix4Covers(mix);
      const cover = coverCandidatesFromTracks(mix.tracks);

      let sub = '';
      if (mix && Array.isArray(mix.tracks) && mix.tracks.length > 0) {
        const counts = new Map();
        const order = [];
        for (const t of mix.tracks) {
          const raw = t.artist || t.uploader;
          if (!raw || typeof raw !== 'string') continue;
          const names = raw.split(/[,/&;•|]|\s+(?:feat|ft|featuring)\.?\s+/i)
            .map(s => s.trim().replace(/^\.+\s*/, '').replace(/^[-–—]\s*/, ''))
            .filter(Boolean);
          for (const name of names) {
            const clean = typeof stripYoutubeTopic === 'function' ? stripYoutubeTopic(name).trim() : name.trim();
            if (!clean || clean.toLowerCase() === 'various artists' || clean.toLowerCase() === 'unknown artist') continue;
            if (!counts.has(clean)) {
              counts.set(clean, 1);
              order.push(clean);
            } else {
              counts.set(clean, counts.get(clean) + 1);
            }
          }
        }
        order.sort((a, b) => (counts.get(b) || 0) - (counts.get(a) || 0));
        if (order.length === 0 && Array.isArray(mix.artists) && mix.artists.length > 0) {
          mix.artists.forEach(a => {
            const clean = typeof stripYoutubeTopic === 'function' ? stripYoutubeTopic(a).trim() : String(a).trim();
            if (clean && !order.includes(clean)) order.push(clean);
          });
        }
        if (order.length <= 3) {
          sub = order.join(', ');
        } else {
          sub = order.slice(0, 3).join(', ') + '...';
        }
      } else if (Array.isArray(mix.artists) && mix.artists.length > 0) {
        const cleanList = mix.artists.map(a => typeof stripYoutubeTopic === 'function' ? stripYoutubeTopic(a).trim() : String(a).trim()).filter(Boolean);
        sub = cleanList.slice(0, 3).join(', ') + (cleanList.length > 3 ? '...' : '');
      }

      const card = spCard({
        cover,
        gridCovers: fourCovers.length >= 4 ? fourCovers : null,
        title: mix.title || `Daily Mix ${i + 1}`,
        sub,
        onClick: () => {
          if (mix.tracks && mix.tracks.length > 0) {
            openAlbum({
              id: mix.id || `daily-mix-${i + 1}`,
              title: mix.title || `Daily Mix ${i + 1}`,
              type: 'Daily Mix',
              isDailyMix: true,
              artist: (mix.artists && mix.artists.length > 0) ? mix.artists.join(', ') : 'Daily Mix',
              trackCount: mix.tracks.length,
              tracks: [...mix.tracks],
              gridCovers: fourCovers.length >= 4 ? fourCovers : null,
              cover: Array.isArray(cover) ? (cover[0] || '') : (cover || '')
            });
          }
        }
      });
      row.appendChild(card);
    });

    if (state.mixesBusy) {
      const totalToRender = Math.max(mixes.length, state._plannedMixCount || 5);
      for (let n = mixes.length + 1; n <= totalToRender; n++) {
        const phCard = document.createElement('div');
        phCard.className = 'sp-card';
        const coverWrap = document.createElement('div');
        coverWrap.className = 'sp-card-cover';
        coverWrap.style.display = 'flex';
        coverWrap.style.alignItems = 'center';
        coverWrap.style.justifyContent = 'center';
        coverWrap.innerHTML = `
          <div class="m3-spinner-container" style="width: 32px; height: 32px; background: transparent;">
            <span class="riff-dots-loader" aria-hidden="true"><i></i><i></i><i></i></span>
          </div>
        `;
        const titleEl = document.createElement('div');
        titleEl.className = 'sp-card-title sp-fade';
        titleEl.textContent = `Daily Mix ${n}`;
        phCard.appendChild(coverWrap);
        phCard.appendChild(titleEl);
        row.appendChild(phCard);
      }
    }

    bindHorizontalWheel(row);
    requestAnimationFrame(() => updateRowFade(row));
    if (typeof updateSidebarSplitCovers === 'function') updateSidebarSplitCovers();
    refreshOverflowFades(row);
  }

  var btnRegenMixes = document.getElementById('btn-regen-mixes');
  if (btnRegenMixes) {
    btnRegenMixes.addEventListener('click', (e) => {
      e.stopPropagation();
      const spMade = document.getElementById('sp-made');
      if (spMade) spMade._lastHomeSig = '';
      fetchPersonalVibe(true).catch(() => {});
      if (state.mixesBusy) return;
      localStorage.removeItem(MIX_KEY);
      generateDailyMixes(true);
    });
  }

  var btnResetRecommendations = document.getElementById('btn-reset-recommendations');
  if (btnResetRecommendations) {
    btnResetRecommendations.addEventListener('click', async (e) => {
      e.stopPropagation();
      const spMade = document.getElementById('sp-made');
      if (spMade) spMade._lastHomeSig = '';
      if (btnResetRecommendations.disabled) return;
      btnResetRecommendations.disabled = true;
      try {
        const recKeys = [
          'riff_daily_mixes',
          'riff_my_wave_cache',
          'riff_wave_skips',
          'riff_failed_tracks',
          'riff_mix_feedback'
        ];
        recKeys.forEach(k => {
          try { localStorage.removeItem(k); } catch (_) {}
        });

        if (typeof HomeCache !== 'undefined' && HomeCache.store) {
          delete HomeCache.store['daily_mixes'];
          delete HomeCache.store['home_vibe'];
          try {
            window.electronAPI?.writeCacheFile?.(HomeCache.store);
          } catch (_) {}
        }

        state.vibeTracks = [];
        myWaveCurrentTracks = [];
        if (state.isRadioQueue || state.myWaveActive) {
          state.queue = state.currentTrack ? [state.currentTrack] : [];
          state.queueIndex = state.currentTrack ? 0 : -1;
          state.isRadioQueue = false;
          state.myWaveActive = false;
          updateQueueBadge();
        }

        await fetchPersonalVibe(true);
        await generateDailyMixes(true);
        btnResetRecommendations.disabled = false;
        showToast('Recommendations reset', 'success');
      } catch (err) {
        console.error('Failed to reset recommendations:', err);
      } finally {
        btnResetRecommendations.disabled = false;
      }
    });
  }

  var favArtistsFetchGen = 0;

  function renderFavArtistsHome() {
    const sec = document.getElementById('sp-artists-sec');
    const container = document.getElementById('sp-artists');
    if (!sec || !container) return;
    if (!getAdv('fav_artists', true)) {
      sec.style.display = 'none';
      return;
    }
    const artists = getFavoriteArtistsList();
    if (!artists || artists.length === 0) {
      sec.style.display = 'none';
      return;
    }
    sec.style.display = '';
    const sig = artists.map(a => a.name + ':' + a.avatar).join(',');
    if (container._lastHomeSig === sig && container.children.length > 0) return;
    container._lastHomeSig = sig;
    container.innerHTML = '';
    const frag = document.createDocumentFragment();
    const toFetch = [];
    artists.forEach(a => {
      const card = buildFavArtistCircleCard(a, false, 0, false);
      frag.appendChild(card);
      if (!a.avatar || !a.fans) {
        toFetch.push({ artist: a, card });
      }
    });
    container.appendChild(frag);
    if (typeof bindHorizontalWheel === 'function') bindHorizontalWheel(container);

    if (toFetch.length > 0) {
      const gen = ++favArtistsFetchGen;
      const concurrency = Math.min(4, toFetch.length);
      let queueIdx = 0;
      const runWorker = async (initialDelay) => {
        if (initialDelay) await new Promise(r => setTimeout(r, initialDelay));
        while (queueIdx < toFetch.length) {
          if (gen !== favArtistsFetchGen) return;
          const item = toFetch[queueIdx++];
          if (!item) break;
          await fetchFavArtistMeta(item.artist, item.card);
          if (queueIdx < toFetch.length) {
            await new Promise(r => setTimeout(r, 200));
          }
        }
      };
      for (let i = 0; i < concurrency; i++) {
        runWorker(i * 200);
      }
    }
    refreshOverflowFades(container);
  }

  function renderSpotifyHome() {
    renderQuickAccess();
    renderTrending();
    renderMadeForYou();
    renderFavArtistsHome();
    refreshOverflowFades();
  }


  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function animateValue(obj, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      obj.textContent = formatBytes(Math.floor(progress * (end - start) + start));
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);
  }

  var cacheWait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function readCacheColors() {
    const rootStyle = getComputedStyle(document.documentElement);
    return {
      primary: rootStyle.getPropertyValue('--md-sys-color-primary').trim() || '#6750A4',
      dim: rootStyle.getPropertyValue('--md-sys-color-surface-container-highest-solid').trim() || '#E6E0E9',
      warn: '#F9A825',
      error: rootStyle.getPropertyValue('--md-sys-color-error').trim() || '#B3261E'
    };
  }

  function setCacheBarTarget(bar, bytes, duration) {
    bar.from = bar.current;
    bar.to = bytes;
    bar.t0 = performance.now();
    bar.dur = duration;
  }

  function drawCacheBar(canvas, bytes, phase) {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    const pw = Math.round(w * dpr);
    const ph = Math.round(h * dpr);
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const lineW = 6;
    const pad = lineW / 2;
    const centerY = h / 2;
    const usable = Math.max(1, w - lineW);

    ctx.lineWidth = lineW;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(pad, centerY);
    ctx.lineTo(w - pad, centerY);
    ctx.strokeStyle = cacheColors.dim;
    ctx.stroke();

    if (bytes <= 0) return;
    const frac = Math.min(1, Math.max(0, bytes / CACHE_BAR_MAX_BYTES));
    const fillW = Math.max(frac * usable, CACHE_BAR_MIN_VISIBLE_PX);
    const endX = pad + fillW;

    const grad = ctx.createLinearGradient(pad, 0, w - pad, 0);
    grad.addColorStop(0, cacheColors.primary);
    grad.addColorStop(CACHE_BAR_SAFE_STOP, cacheColors.primary);
    grad.addColorStop((CACHE_BAR_SAFE_STOP + CACHE_BAR_DANGER_STOP) / 2, cacheColors.warn);
    grad.addColorStop(CACHE_BAR_DANGER_STOP, cacheColors.error);
    grad.addColorStop(1, cacheColors.error);

    const amplitude = 4;
    const freq = 0.12;
    ctx.beginPath();
    for (let x = pad; x <= endX; x++) {
      const distFromEnd = endX - x;
      const damping = Math.min(1, distFromEnd / 14);
      const distFromStart = x - pad;
      const startDamping = Math.min(1, distFromStart / 14);
      const snakeWave = Math.sin(x * freq - phase) + 0.4 * Math.sin(x * freq * 0.5 - phase * 1.5);
      const y = centerY + snakeWave * (amplitude * damping * startDamping);
      if (x === pad) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = grad;
    ctx.stroke();
  }

  function cacheFrame(now) {
    if (document.hidden || !state.isWindowVisible || !cacheModal || !cacheModal.classList.contains('visible')) {
      cacheRafId = 0;
      return;
    }
    cacheSpeed += (cacheTargetSpeed - cacheSpeed) * 0.08;
    cachePhase += cacheSpeed;
    Object.keys(cacheBars).forEach((key) => {
      const bar = cacheBars[key];
      if (bar.dur > 0) {
        const p = Math.min(1, (now - bar.t0) / bar.dur);
        const ease = 1 - Math.pow(1 - p, 3);
        bar.current = bar.from + (bar.to - bar.from) * ease;
        if (p >= 1) bar.dur = 0;
      }
      drawCacheBar(bar.canvas, bar.current, cachePhase);
    });
    cacheRafId = requestAnimationFrame(cacheFrame);
  }

  function closeCacheModal() {
    if (!cacheModal) return;
    cacheModal.classList.remove('visible');
    setTimeout(() => {
      if (cacheModal.classList.contains('visible')) return;
      cacheModal.classList.add('hidden');
      if (cacheRafId) {
        cancelAnimationFrame(cacheRafId);
        cacheRafId = 0;
      }
      if (cacheModalCard) cacheModalCard.classList.remove('cleaning', 'finishing', 'done');
      if (btnConfirmClearCache) btnConfirmClearCache.disabled = false;
      if (btnCancelCache) btnCancelCache.disabled = false;
    }, 200);
  }

  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('#btn-open-clear-cache');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    if (!cacheModal || cacheBusy) return;

    cacheColors = readCacheColors();
    cacheSpeed = 0.06;
    cacheTargetSpeed = 0.06;
    Object.keys(cacheBars).forEach((key) => {
      const bar = cacheBars[key];
      bar.current = 0;
      bar.from = 0;
      bar.to = 0;
      bar.dur = 0;
    });
    if (cacheAudioSize) { cacheAudioSize.textContent = 'calculating...'; cacheAudioSize.dataset.val = '0'; }
    if (cacheWebSize) { cacheWebSize.textContent = 'calculating...'; cacheWebSize.dataset.val = '0'; }

    cacheModal.classList.remove('hidden');
    requestAnimationFrame(() => cacheModal.classList.add('visible'));
    if (!cacheRafId) cacheRafId = requestAnimationFrame(cacheFrame);

    let sizes = { audio: 0, web: 0 };
    try {
      if (window.electronAPI && window.electronAPI.getCacheSize) {
        sizes = await window.electronAPI.getCacheSize();
      }
    } catch (err) {
      console.warn('getCacheSize failed', err);
    }
    if (cacheAudioSize) { cacheAudioSize.textContent = formatBytes(sizes.audio); cacheAudioSize.dataset.val = String(sizes.audio); }
    if (cacheWebSize) { cacheWebSize.textContent = formatBytes(sizes.web); cacheWebSize.dataset.val = String(sizes.web); }
    setCacheBarTarget(cacheBars.audio, sizes.audio, 900);
    setCacheBarTarget(cacheBars.web, sizes.web, 900);
  });

  var btnCancelCache = document.getElementById('btn-cancel-cache');
  var btnConfirmClearCache = document.getElementById('btn-confirm-clear-cache');
  var cacheModalCard = document.querySelector('.cache-modal-card');
  var cacheBusy = false;

  if (btnCancelCache) {
    btnCancelCache.addEventListener('click', () => {
      if (cacheBusy) return;
      closeCacheModal();
    });
  }

  if (btnConfirmClearCache) {
    btnConfirmClearCache.addEventListener('click', async () => {
      if (cacheBusy) return;
      cacheBusy = true;
      btnConfirmClearCache.disabled = true;
      if (btnCancelCache) btnCancelCache.disabled = true;

      cacheModalCard.classList.add('cleaning');
      cacheTargetSpeed = 0.2;

      const startAudio = parseInt(cacheAudioSize.dataset.val || '0', 10);
      const startWeb = parseInt(cacheWebSize.dataset.val || '0', 10);
      animateValue(cacheAudioSize, startAudio, 0, 1500);
      animateValue(cacheWebSize, startWeb, 0, 1500);
      setCacheBarTarget(cacheBars.audio, 0, 1500);
      setCacheBarTarget(cacheBars.web, 0, 1500);

      const startedAt = Date.now();
      try {
        await window.electronAPI.clearCache();
      } catch (err) {
        console.warn('clearCache failed', err);
      }
      await cacheWait(Math.max(0, 1500 - (Date.now() - startedAt)));

      cacheModalCard.classList.add('finishing');
      cacheTargetSpeed = 0;
      await cacheWait(350);

      cacheModalCard.classList.remove('cleaning', 'finishing');
      cacheModalCard.classList.add('done');
      cacheAudioSize.dataset.val = '0';
      cacheWebSize.dataset.val = '0';
      await cacheWait(1200);

      cacheBusy = false;
      closeCacheModal();
    });
  }

  async function updateOfflineStorageUI() {
    const elSize = document.getElementById('offline-library-size');
    if (!elSize) return;
    try {
      const res = await fetch(`http://127.0.0.1:${state.serverPort}/api/offline-library`);
      const data = await res.json();
      if (data && data.success) {
        elSize.textContent = `${data.count} track${data.count === 1 ? '' : 's'} (${formatBytes(data.totalBytes)})`;
        if (Array.isArray(data.tracks)) {
          for (const t of data.tracks) {
            if (t.cleanId) cachedTrackIds.add(t.cleanId);
            if (t.id) {
              const cid = typeof cleanTrackId === 'function' ? cleanTrackId(t.id) : String(t.id).replace(/[^a-zA-Z0-9_-]/g, '_');
              cachedTrackIds.add(cid);
              cachedTrackIds.add(t.id);
            }
          }
        }
      } else {
        elSize.textContent = '0 tracks (0 B)';
      }
    } catch (e) {
      elSize.textContent = 'Unavailable';
    }
  }


  function getSidebarPinnedTracks() {
    const arr = safeJson(SIDEBAR_PINNED_TRACKS_KEY, []);
    return Array.isArray(arr) ? arr : [];
  }
  function isTrackPinnedToSidebar(track) {
    if (!track) return false;
    const cid = getTrackCanonicalId(track);
    return getSidebarPinnedTracks().some(t => getTrackCanonicalId(t) === cid || isSameTrack(t, track));
  }
  function togglePinTrackToSidebar(track) {
    if (!track) return false;
    const list = getSidebarPinnedTracks();
    const cid = getTrackCanonicalId(track);
    const idx = list.findIndex(t => getTrackCanonicalId(t) === cid || isSameTrack(t, track));
    let pinned = false;
    if (idx >= 0) {
      list.splice(idx, 1);
    } else {
      list.unshift({
        id: track.id,
        title: track.title,
        artist: track.artist,
        album: track.album,
        duration: track.duration,
        thumbnail: getTrackThumbUrl(track) || track.thumbnail || track.cover || '',
        cover: track.cover || track.thumbnail || '',
        url: track.url || '',
        platform: track.platform || state.platform || 'ytmusic',
        searchQuery: track.searchQuery || ''
      });
      pinned = true;
    }
    try { localStorage.setItem(SIDEBAR_PINNED_TRACKS_KEY, JSON.stringify(list.slice(0, 50))); } catch (_) {}
    renderSidebarLibraryFeed();
    showToast(pinned ? 'Pinned to sidebar' : 'Unpinned from sidebar', 'info');
    return pinned;
  }

  var SIDEBAR_LIBRARY_TRACKS_KEY = 'riff_sidebar_library_tracks';
  function getSidebarLibraryTracks() {
    const arr = safeJson(SIDEBAR_LIBRARY_TRACKS_KEY, []);
    return Array.isArray(arr) ? arr : [];
  }
  function isTrackInSidebarLibrary(track) {
    if (!track) return false;
    const cid = getTrackCanonicalId(track);
    return getSidebarLibraryTracks().some(t => (cid && getTrackCanonicalId(t) === cid) || isSameTrack(t, track));
  }
  function toggleTrackInSidebarLibrary(track) {
    if (!track) return false;
    const list = getSidebarLibraryTracks();
    const cid = getTrackCanonicalId(track);
    const idx = list.findIndex(t => (cid && getTrackCanonicalId(t) === cid) || isSameTrack(t, track));
    let added = false;
    if (idx >= 0) {
      list.splice(idx, 1);
    } else {
      list.unshift({
        id: track.id,
        title: track.title,
        artist: track.artist,
        album: track.album,
        duration: track.duration,
        thumbnail: (typeof getTrackThumbUrl === 'function' ? getTrackThumbUrl(track) : '') || track.thumbnail || track.cover || '',
        cover: track.cover || track.thumbnail || '',
        url: track.url || '',
        platform: track.platform || (typeof state !== 'undefined' ? state.platform : '') || 'ytmusic',
        searchQuery: track.searchQuery || '',
        addedAt: Date.now()
      });
      added = true;
    }
    try { localStorage.setItem(SIDEBAR_LIBRARY_TRACKS_KEY, JSON.stringify(list.slice(0, 200))); } catch (_) {}
    renderSidebarLibraryFeed();
    showToast(added ? t('Added to library') : t('Removed from library'), 'info');
    return added;
  }
  window.getSidebarLibraryTracks = getSidebarLibraryTracks;
  window.isTrackInSidebarLibrary = isTrackInSidebarLibrary;
  window.toggleTrackInSidebarLibrary = toggleTrackInSidebarLibrary;

  var currentSidebarLibFilter = currentSidebarLibFilter || 'playlists';

  function renderSidebarLibraryFeed(forceAnim = false) {
    if (!document.body.classList.contains('sidebar-expanded')) return;
    if (typeof currentSidebarLibFilter === 'undefined' || !currentSidebarLibFilter) currentSidebarLibFilter = 'playlists';
    const feed = document.getElementById('sidebar-library-feed');
    if (!feed) return;
    feed.dataset.tab = currentSidebarLibFilter;

    const sbSortMode = localStorage.getItem('riff_sb_lib_sort') || 'Recents';
    const structureSig = [
      currentSidebarLibFilter,
      sbSortMode,
      localStorage.getItem('riff_sidebar_custom_order') || '',
      getSidebarPinnedTracks().map(t => t.id || t.title).join(','),
      getSidebarLibraryTracks().map(t => t.id || t.title).join(','),
      (state.playlists || []).map(p => `${p.id}:${p.name}:${p.cover || ''}:${isPlaylistPinned(p.id)}:${p.tracks && p.tracks.length > 0 ? (p.tracks[0]?.id || '1') : '0'}`).join('|'),
      (typeof getSavedAlbums === 'function' ? getSavedAlbums() : []).map(a => a.id || a.title).join(','),
      currentSidebarLibFilter === 'queue' ? `${state.currentTrack?.id || ''}:${state.queueIndex}:${(state.queue || []).length}:${(state.history || []).length}:${typeof autoplayEnabled === 'function' && autoplayEnabled() ? '1' : '0'}` : ''
    ].join('::');
    if (!forceAnim && feed._lastSig === structureSig && feed.children.length > 0) {
      const curId = state.currentTrack ? getTrackCanonicalId(state.currentTrack) : '';
      const pinSvg = '<svg class="sb-lib-pin-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>';
      feed.querySelectorAll('.sb-lib-row').forEach(r => {
        if (r.dataset.viewTarget) {
          r.classList.toggle('active', state.currentView === r.dataset.viewTarget);
          if (r.dataset.viewTarget === 'favorites') {
            const favCount = (state.favorites || []).length;
            const subSpan = r.querySelector('.sb-lib-sub span');
            if (subSpan) subSpan.textContent = `${favCount} ${favCount === 1 ? 'song' : 'songs'}`;
          } else if (r.dataset.viewTarget === 'local') {
            const localCnt = (state.localTracks && state.localTracks.length) || 0;
            const sub = r.querySelector('.sb-lib-sub');
            if (sub) sub.textContent = `${localCnt} ${localCnt === 1 ? 'file' : 'files'}`;
          }
        } else if (r.dataset.playlistId) {
          r.classList.toggle('active', state.currentView === 'playlist-detail' && state.currentPlaylistId === r.dataset.playlistId);
          const pl = (state.playlists || []).find(p => p.id === r.dataset.playlistId);
          if (pl) {
            const cnt = (pl.tracks || []).length;
            r.title = `${pl.name || 'Untitled'} (${cnt})`;
            const sub = r.querySelector('.sb-lib-sub');
            if (sub) {
              const isPinned = isPlaylistPinned(pl.id);
              sub.innerHTML = `${isPinned ? pinSvg : ''}${cnt} ${cnt === 1 ? 'track' : 'tracks'}`;
            }
          }
        } else if (r.dataset.canonicalId) {
          r.classList.toggle('playing', Boolean(curId && r.dataset.canonicalId === curId));
        }
      });
      const btnSbSet = document.getElementById('btn-sb-settings');
      if (btnSbSet) btnSbSet.classList.toggle('active', state.currentView === 'settings');
      if (typeof window.applySidebarLibFilter === 'function') window.applySidebarLibFilter();
      return;
    }
    feed._lastSig = structureSig;

    const prevScrollTop = feed.scrollTop;
    const isFeedFadeTop = feed.scrollTop > 6;

    feed.innerHTML = '';
    const frag = document.createDocumentFragment();
    const pinSvg = '<svg class="sb-lib-pin-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>';

    const makeTrackCard = (tr, list, idx, opts = {}) => {
      const row = document.createElement('div');
      const isPlaying = state.currentTrack && isSameTrack(state.currentTrack, tr);
      row.className = 'sb-lib-row sb-lib-track' + (isPlaying ? ' playing' : '');
      row.title = `${tr.title || 'Untitled'} • ${tr.artist || 'Unknown artist'}`;
      row.dataset.canonicalId = getTrackCanonicalId(tr);
      if (!forceAnim) row.classList.add('no-sb-anim');
      const thumb = typeof getTrackThumbUrl === 'function' ? getTrackThumbUrl(tr) : (tr.thumbnail || tr.cover || '');
      row.innerHTML = `
        <div class="sb-lib-cover">
          ${thumb ? `<img src="${escapeHtml(thumb)}" alt="" loading="lazy" onerror="this.style.display='none'">` : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>'}
        </div>
        <div class="sb-lib-info">
          <span class="sb-lib-title">${escapeHtml(tr.title || 'Untitled')}</span>
          <span class="sb-lib-sub">${opts.pinned ? pinSvg : ''}${escapeHtml(tr.artist || 'Unknown artist')}</span>
        </div>
        ${opts.onAction ? `<button type="button" class="sb-lib-row-action" title="${escapeHtml(opts.actionTitle || '')}">${opts.actionIcon}</button>` : ''}
      `;
      if (opts.onAction) {
        const actBtn = row.querySelector('.sb-lib-row-action');
        if (actBtn) actBtn.addEventListener('click', (e) => { e.stopPropagation(); opts.onAction(); });
      }
      row.addEventListener('click', () => {
        const matchFn = f => isSameTrack(f, tr) || (f.title && tr.title && getTrackNormalizedKey(f.artist, f.title) === getTrackNormalizedKey(tr.artist, tr.title));
        const fullTrack = (state.favorites || []).find(matchFn) ||
                          (state.history || []).find(matchFn) || tr;
        playTrack(fullTrack, [fullTrack], 0, 'sidebar-pinned');
      });
      row.addEventListener('contextmenu', (e) => openTrackContextMenu(e, tr, { row, index: idx }));
      return row;
    };

    if (currentSidebarLibFilter === 'playlists') {
      const likedRow = document.createElement('div');
      likedRow.className = 'sb-lib-row' + (state.currentView === 'favorites' ? ' active' : '');
      likedRow.title = t('Liked songs');
      likedRow.dataset.viewTarget = 'favorites';
      if (!forceAnim) likedRow.classList.add('no-sb-anim');
      const favCount = (state.favorites || []).length;
      likedRow.innerHTML = `
        <div class="sb-lib-cover liked-grad">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
        </div>
        <div class="sb-lib-info">
          <span class="sb-lib-title">${escapeHtml(t('Liked songs'))}</span>
          <span class="sb-lib-sub">${pinSvg}<span>${favCount} ${favCount === 1 ? 'song' : 'songs'}</span></span>
        </div>
      `;
      likedRow.addEventListener('click', () => switchView('favorites'));
      frag.appendChild(likedRow);

      const pinnedTracks = getSidebarPinnedTracks();
      if (pinnedTracks.length > 0) {
        pinnedTracks.forEach((tr, idx) => {
          const row = makeTrackCard(tr, pinnedTracks, idx, {
            pinned: true,
            actionTitle: 'Unpin from sidebar',
            actionIcon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
            onAction: () => togglePinTrackToSidebar(tr)
          });
          row.dataset.sbGroup = 'pinned-track';
          row.dataset.sbKey = getTrackCanonicalId(tr);
          frag.appendChild(row);
        });
      }

      const getPlScore = (pl) => {
        if (sbSortMode === 'Alphabetical') return 0;
        if (sbSortMode === 'Recently Added') {
          return pl.createdAt || pl.addedAt || 0;
        }
        if (pl.lastPlayedAt) return pl.lastPlayedAt;
        if (pl.lastOpenedAt) return pl.lastOpenedAt;
        if (pl.updatedAt) return pl.updatedAt;
        if (pl.createdAt) return pl.createdAt;
        const hist = (state.history || []).slice(0, 30);
        const matchIdx = hist.findIndex(h => (pl.tracks || []).some(t => isSameTrack(t, h)));
        if (matchIdx >= 0) return 1000000000000 - matchIdx * 1000;
        return 0;
      };

      let customOrderMap = null;
      try {
        const rawCustom = localStorage.getItem('riff_sidebar_custom_order');
        if (rawCustom) {
          const parsed = JSON.parse(rawCustom);
          if (Array.isArray(parsed) && parsed.length > 0) {
            customOrderMap = new Map(parsed.map((id, idx) => [String(id), idx]));
          }
        }
      } catch (_) {}

      const sortedSidebarPlaylists = [...(state.playlists || [])].sort((a, b) => {
        const aPinned = isPlaylistPinned(a.id) ? 1 : 0;
        const bPinned = isPlaylistPinned(b.id) ? 1 : 0;
        if (bPinned !== aPinned) return bPinned - aPinned;
        if (sbSortMode === 'Custom' && customOrderMap) {
          const aIdx = customOrderMap.has(String(a.id)) ? customOrderMap.get(String(a.id)) : 999999;
          const bIdx = customOrderMap.has(String(b.id)) ? customOrderMap.get(String(b.id)) : 999999;
          if (aIdx !== bIdx) return aIdx - bIdx;
        }
        if (sbSortMode === 'Alphabetical') {
          return (a.name || '').localeCompare(b.name || '');
        }
        if (sbSortMode !== 'Recently Added' && customOrderMap) {
          const aIdx = customOrderMap.has(String(a.id)) ? customOrderMap.get(String(a.id)) : 999999;
          const bIdx = customOrderMap.has(String(b.id)) ? customOrderMap.get(String(b.id)) : 999999;
          if (aIdx !== bIdx) return aIdx - bIdx;
        }
        const aScore = getPlScore(a);
        const bScore = getPlScore(b);
        if (aScore && bScore && aScore !== bScore) return bScore - aScore;
        if (aScore && !bScore) return -1;
        if (!aScore && bScore) return 1;
        return (state.playlists.indexOf(b) - state.playlists.indexOf(a));
      });
      sortedSidebarPlaylists.forEach(pl => {
        const row = document.createElement('div');
        row.className = 'sb-lib-row' + (state.currentView === 'playlist-detail' && state.currentPlaylistId === pl.id ? ' active' : '');
        if (!forceAnim) row.classList.add('no-sb-anim');
        row.title = `${pl.name || 'Untitled'} (${(pl.tracks || []).length})`;
        const isPinned = isPlaylistPinned(pl.id);
        row.dataset.sbGroup = isPinned ? 'pinned-pl' : 'unpinned-pl';
        row.dataset.playlistId = pl.id;
        const coverBox = document.createElement('div');
        coverBox.className = 'sb-lib-cover';
        renderPlaylistCover(coverBox, pl, 60);
        const info = document.createElement('div');
        info.className = 'sb-lib-info';
        const cnt = (pl.tracks || []).length;
        info.innerHTML = `
          <span class="sb-lib-title">${escapeHtml(pl.name || 'Untitled')}</span>
          <span class="sb-lib-sub">${isPinned ? pinSvg : ''}${cnt} ${cnt === 1 ? 'track' : 'tracks'}</span>
        `;
        row.append(coverBox, info);
        row.addEventListener('click', () => openPlaylistDetail(pl.id));
        row.addEventListener('contextmenu', (e) => {
          openPlaylistInAppMenu(e, pl.id);
        });
        frag.appendChild(row);
      });

      const libTracks = getSidebarLibraryTracks().filter(tr => {
        const cid = getTrackCanonicalId(tr);
        return !pinnedTracks.some(p => (cid && getTrackCanonicalId(p) === cid) || isSameTrack(p, tr));
      });
      if (sbSortMode === 'Custom') {
         
      } else if (sbSortMode === 'Alphabetical') {
        libTracks.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      } else if (sbSortMode === 'Recently Added') {
        libTracks.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
      } else {
        libTracks.sort((a, b) => {
          const aTime = a.lastPlayedAt || a.addedAt || 0;
          const bTime = b.lastPlayedAt || b.addedAt || 0;
          return bTime - aTime;
        });
      }
      libTracks.forEach((tr, idx) => {
        const row = makeTrackCard(tr, libTracks, idx, {
          pinned: false,
          actionTitle: t('Remove from library'),
          actionIcon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
          onAction: () => toggleTrackInSidebarLibrary(tr)
        });
        row.dataset.sbGroup = 'unpinned-track';
        row.dataset.sbKey = getTrackCanonicalId(tr);
        frag.appendChild(row);
      });
    } else if (currentSidebarLibFilter === 'albums') {
      if (localStorage.getItem('riff_show_local') !== 'false') {
        const localRow = document.createElement('div');
        localRow.className = 'sb-lib-row' + (state.currentView === 'local' ? ' active' : '');
        localRow.title = t('My files');
        localRow.dataset.viewTarget = 'local';
        if (!forceAnim) localRow.classList.add('no-sb-anim');
        const localCnt = (state.localTracks && state.localTracks.length) || 0;
        localRow.innerHTML = `
          <div class="sb-lib-cover local-grad">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          </div>
          <div class="sb-lib-info">
            <span class="sb-lib-title">${escapeHtml(t('My files'))}</span>
            <span class="sb-lib-sub">${localCnt} ${localCnt === 1 ? 'file' : 'files'}</span>
          </div>
        `;
        localRow.addEventListener('click', () => switchView('local'));
        frag.appendChild(localRow);
      }

      const albums = typeof getSavedAlbums === 'function' ? [...getSavedAlbums()] : [];
      if (sbSortMode === 'Alphabetical') {
        albums.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      } else if (sbSortMode === 'Recently Added') {
        albums.sort((a, b) => (b.savedAt || b.addedAt || 0) - (a.savedAt || a.addedAt || 0));
      } else {
        albums.sort((a, b) => (b.lastPlayedAt || b.savedAt || b.addedAt || 0) - (a.lastPlayedAt || a.savedAt || a.addedAt || 0));
      }
      if (albums.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-hint';
        empty.style.padding = '28px 12px';
        empty.textContent = t('No saved albums yet');
        frag.appendChild(empty);
      } else {
        albums.forEach(alb => {
          const row = document.createElement('div');
          row.className = 'sb-lib-row';
          if (!forceAnim) row.classList.add('no-sb-anim');
          row.title = `${alb.title || 'Album'}${alb.artist ? ' • ' + alb.artist : ''}`;
          row.innerHTML = `
            <div class="sb-lib-cover">
              ${alb.cover ? `<img src="${escapeHtml(alb.cover)}" alt="" loading="lazy" onerror="this.style.display='none'">` : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>'}
            </div>
            <div class="sb-lib-info">
              <span class="sb-lib-title">${escapeHtml(alb.title || 'Album')}</span>
              <span class="sb-lib-sub">${escapeHtml(alb.artist || '')}</span>
            </div>
          `;
          row.addEventListener('click', () => openAlbum(alb));
          frag.appendChild(row);
        });
      }
    } else if (currentSidebarLibFilter === 'queue') {
      if (typeof autoplayEnabled === 'function' && autoplayEnabled() && typeof ensureAutoplayBuffer === 'function') {
        ensureAutoplayBuffer();
      }
      if (state.currentTrack) {
        const lblNow = document.createElement('div');
        lblNow.className = 'sb-lib-section-label';
        lblNow.textContent = t('Now playing');
        frag.appendChild(lblNow);
        frag.appendChild(makeTrackCard(state.currentTrack, state.queue, state.queueIndex));
      }

      const autoplayBar = document.createElement('div');
      autoplayBar.className = 'sb-lib-autoplay-bar';
      autoplayBar.innerHTML = `<div class="np-queue-autoplay-text"><span>${escapeHtml(t('Autoplay'))}</span><small>${escapeHtml(t('Similar songs'))}</small></div><button type="button" class="effect-switch-btn ${typeof autoplayEnabled === 'function' && autoplayEnabled() ? 'active' : ''}" id="btn-sb-queue-autoplay"><span class="thumb"></span></button>`;
      const btnSbQueueAutoplay = autoplayBar.querySelector('#btn-sb-queue-autoplay');
      if (btnSbQueueAutoplay) {
        btnSbQueueAutoplay.addEventListener('click', (e) => {
          e.stopPropagation();
          const next = !autoplayEnabled();
          setAdv('autoplay', next);
          btnSbQueueAutoplay.classList.toggle('active', next);
          const rightBtn = document.getElementById('btn-queue-autoplay');
          if (rightBtn) rightBtn.classList.toggle('active', next);
          if (!next) {
            const head = (state.queue || []).slice(0, state.queueIndex + 1);
            const tail = (state.queue || []).slice(state.queueIndex + 1).filter(t => !t || t._isAutoplay !== true);
            state.queue = [...head, ...tail];
            if (typeof updateQueueBadge === 'function') updateQueueBadge();
            if (state.currentView === 'queue' && typeof renderQueueView === 'function') {
              renderQueueView();
            }
            if (typeof window.refreshQueuePanel === 'function') {
              window.refreshQueuePanel();
            }
            feed._lastSig = '';
            renderSidebarLibraryFeed(false);
          } else {
            const head = (state.queue || []).slice(0, state.queueIndex + 1);
            state.queue = [...head];
            state._autoplayPool = [];
            state._autoplayAnchorSeeds = null;
            if (typeof ensureAutoplayBuffer === 'function') ensureAutoplayBuffer();
            if (typeof updateQueueBadge === 'function') updateQueueBadge();
            if (state.currentView === 'queue' && typeof renderQueueView === 'function') {
              renderQueueView();
            }
            if (typeof window.refreshQueuePanel === 'function') {
              window.refreshQueuePanel();
            }
            feed._lastSig = '';
            renderSidebarLibraryFeed(false);
          }
        });
      }
      frag.appendChild(autoplayBar);

      const startIdx = Math.max(0, state.queueIndex + 1);
      const upcoming = (state.queue || []).slice(startIdx, startIdx + 40);
      if (upcoming.length > 0) {
        const lblNext = document.createElement('div');
        lblNext.className = 'sb-lib-section-label';
        lblNext.textContent = t('Next up');
        frag.appendChild(lblNext);
        upcoming.forEach((tr, i) => {
          const qIdx = startIdx + i;
          frag.appendChild(makeTrackCard(tr, state.queue, qIdx, {
            actionTitle: 'Remove from queue',
            actionIcon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
            onAction: () => { removeTrackFromQueue(qIdx); renderSidebarLibraryFeed(); }
          }));
        });
      }
      const recent = (state.history || []).slice(0, 20);
      if (recent.length > 0) {
        const lblRec = document.createElement('div');
        lblRec.className = 'sb-lib-section-label';
        lblRec.textContent = t('Recently played');
        frag.appendChild(lblRec);
        recent.forEach((tr, idx) => {
          frag.appendChild(makeTrackCard(tr, recent, idx));
        });
      }
      if (!state.currentTrack && upcoming.length === 0 && recent.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-hint';
        empty.style.padding = '28px 12px';
        empty.textContent = t('Queue is empty');
        frag.appendChild(empty);
      }
    }

    Array.from(frag.querySelectorAll('.sb-lib-row')).forEach((r, i) => r.style.setProperty('--i', String(i)));
    feed.appendChild(frag);
    if (prevScrollTop > 0) feed.scrollTop = prevScrollTop;
    feed.classList.toggle('fade-top', isFeedFadeTop);
    const btnSbSettings = document.getElementById('btn-sb-settings');
    if (btnSbSettings) btnSbSettings.classList.toggle('active', state.currentView === 'settings');
    if (typeof window.applySidebarLibFilter === 'function') {
      window.applySidebarLibFilter();
    } else {
      feed.classList.toggle('sb-feed-sparse', feed.querySelectorAll('.sb-lib-row').length <= 4);
    }
  }
  window.renderSidebarLibraryFeed = renderSidebarLibraryFeed;



window.HomeCache = HomeCache;
window.isTrackFavorited = isTrackFavorited;
window.toggleFavorite = toggleFavorite;
window.renderFavoritesView = renderFavoritesView;
window.renderHistoryView = renderHistoryView;
window.renderLocalFiles = renderLocalFiles;
window.createPlaylist = createPlaylist;
window.openPlaylistDetail = openPlaylistDetail;
window.pushPlayHistory = pushPlayHistory;
window.refreshCachedTrackIds = refreshCachedTrackIds;
window.isTrackLocallyCached = isTrackLocallyCached;
window.openDownloadModal = openDownloadModal;

