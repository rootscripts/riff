
'use strict';

var streamPrefetchQueue = window.streamPrefetchQueue || [];
window.streamPrefetchQueue = streamPrefetchQueue;
var audioEngine = window.audioEngine || (window.RiffAudioEngine ? new window.RiffAudioEngine() : null);
window.audioEngine = audioEngine;
var activeStreamRecovery = window.activeStreamRecovery || null;
window.activeStreamRecovery = activeStreamRecovery;
var isDraggingScrubber = window.isDraggingScrubber || false;
var isHoveringScrubber = window.isHoveringScrubber || false;
var isHoveringTvkScrubber = window.isHoveringTvkScrubber || false;
var isPauseFading = window.isPauseFading || false;
var frozenCurTime = window.frozenCurTime || 0;
var currentAudioOutputDeviceId = window.currentAudioOutputDeviceId || 'default';

var activeStreamRecovery = window.activeStreamRecovery || null;
window.activeStreamRecovery = activeStreamRecovery;
function recoverCurrentStream(resumePos = 0) {
      if (syncState && syncState.active) return Promise.resolve();
      const token = state.loadToken;
      if (activeStreamRecovery && activeStreamRecovery.token === token) return activeStreamRecovery.promise;
      const promise = recoverCurrentStreamOnce(resumePos, token).finally(() => {
        if (activeStreamRecovery && activeStreamRecovery.promise === promise) activeStreamRecovery = null;
      });
      activeStreamRecovery = { token, promise };
      return promise;
    }

var lastStreamErrorToastTime = 0;

async function recoverCurrentStreamOnce(resumePos, myToken) {
      if (syncState && syncState.active) return;
      if (el.trackLoadingOverlay) el.trackLoadingOverlay.classList.add('hidden');
      const cur = state.currentTrack;
      if (!cur || cur._gaveUp) {
        updatePlayPauseButton(false, false);
        setPlayPauseState(false, false);
        return;
      }
      if (cur.platform === 'local') {
        updatePlayPauseButton(false, false);
        showToast('File missing from library', 'error');
        return;
      }

  var d = null;
      cur._retryCount = (cur._retryCount || 0) + 1;
      if (cur._retryCount > 2) {
        cur._gaveUp = true;
        cur._unavailNotice = true;
        recordFailedTrack(cur);
        state.isLoadingTrack = false;
        state.isPlaying = false;
        document.body.classList.remove('is-playing');
        updatePlayPauseButton(false, false);
        setPlayPauseState(false, false);
        window.__riffLogError?.('ERROR', `Stream failed [stage=${cur._retryCount}] id=${cur.id || ''} title="${cur.title || ''}" mediaErr=${el.nativeAudio?.error?.code || 'none'} src=${(el.nativeAudio?.getAttribute('src') || '').slice(0, 120)} apiErr=${d?.error || 'none'}`);
        try {
          if (el.nativeAudio) {
            el.nativeAudio.pause();
            el.nativeAudio.removeAttribute('src');
          }
        } catch (_) {}
        const now = Date.now();
        if (now - lastStreamErrorToastTime > 5000) {
          lastStreamErrorToastTime = now;
          showToast('Could not load audio stream', 'error');
        }
        return;
      }

      delete cur._preloadedStreamUrl;
      state.isLoadingTrack = true;

      try {
        const qQuality = encodeURIComponent(localStorage.getItem('riff_audio_quality') || 'medium');
        const qSearch = encodeURIComponent(cur.searchQuery || ((cur.artist ? cur.artist + ' - ' : '') + (cur.title || '')));
        const isRiffStream = localStorage.getItem('riff_library_streaming') === '1' ? '&riffStream=1' : '';
        const forceYtDlpParam = (cur._retryCount >= 2) ? '&forceYtDlp=1' : '';
        const retryTimeoutMs = (cur._retryCount >= 2) ? 25000 : 12000;
        const retryUrl = `http://127.0.0.1:${state.serverPort}/api/stream-info?url=${encodeURIComponent(cur.url || '')}&id=${encodeURIComponent(cur.id || '')}&platform=${encodeURIComponent(cur.platform || state.platform)}&title=${encodeURIComponent(cur.title || '')}&artist=${encodeURIComponent(cur.artist || '')}&duration=${encodeURIComponent(cur.duration || 0)}&quality=${qQuality}&q=${qSearch}${forceYtDlpParam}${isRiffStream}&bust=${Date.now()}`;
        const r = await fetch(retryUrl, { signal: AbortSignal.timeout(retryTimeoutMs) });
        d = await r.json();
        if (myToken !== state.loadToken) return;
        if (d && d.success && d.streamUrl) {
          cur._preloadedStreamUrl = d.streamUrl;
          if (hlsInstance) {
            try { hlsInstance.destroy(); } catch (_) {}
            hlsInstance = null;
          }
          try { el.nativeAudio.pause(); } catch (_) {}
          const restoreSeek = () => {
            if (resumePos > 1 && Number.isFinite(resumePos) && el.nativeAudio) {
              try { el.nativeAudio.currentTime = resumePos; } catch (_) {}
            }
          };
          if (d.isHls && window.Hls && Hls.isSupported()) {
            hlsInstance = new Hls({ enableWorker: true, lowLatencyMode: true, maxBufferLength: 10, maxMaxBufferLength: 20, maxBufferSize: 4 * 1024 * 1024 });
            hlsInstance.on(Hls.Events.ERROR, (_, errData) => {
              if (errData && errData.fatal) {
                if (errData.type === Hls.ErrorTypes.NETWORK_ERROR) hlsInstance.startLoad();
                else if (errData.type === Hls.ErrorTypes.MEDIA_ERROR) hlsInstance.recoverMediaError();
              }
            });
            hlsInstance.loadSource(d.streamUrl);
            hlsInstance.attachMedia(el.nativeAudio);
            hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
              if (myToken === state.loadToken) {
                restoreSeek();
                playSmooth();
              }
            });
          } else {
            el.nativeAudio.src = d.streamUrl;
            restoreSeek();
            playSmooth();
          }
          return;
        }
      } catch (_) {}

      cur._gaveUp = true;
      cur._unavailNotice = true;
      recordFailedTrack(cur);
      state.isLoadingTrack = false;
      state.isPlaying = false;
      document.body.classList.remove('is-playing');
      updatePlayPauseButton(false, false);
      setPlayPauseState(false, false);
      window.__riffLogError?.('ERROR', `Stream failed [stage=${cur._retryCount}] id=${cur.id || ''} title="${cur.title || ''}" mediaErr=${el.nativeAudio?.error?.code || 'none'} src=${(el.nativeAudio?.getAttribute('src') || '').slice(0, 120)} apiErr=${d?.error || 'none'}`);
      try {
        if (el.nativeAudio) {
          el.nativeAudio.pause();
          el.nativeAudio.removeAttribute('src');
        }
      } catch (_) {}
      const now = Date.now();
      if (now - lastStreamErrorToastTime > 5000) {
        lastStreamErrorToastTime = now;
        showToast('Could not load audio stream', 'error');
      }
    }

var playbackStallTimer = null;
function clearPlaybackStallTimer() {
      if (playbackStallTimer) clearTimeout(playbackStallTimer);
      playbackStallTimer = null;
    }
function watchPlaybackStall() {
      if (syncState && syncState.active) return;
      clearPlaybackStallTimer();
      const token = state.loadToken;
      const stallPos = (el.nativeAudio && Number.isFinite(el.nativeAudio.currentTime)) ? el.nativeAudio.currentTime : 0;
      playbackStallTimer = setTimeout(() => {
        playbackStallTimer = null;
        if (syncState && syncState.active) return;
        if (token !== state.loadToken) return;
        if (state.isLoadingTrack) {
          recoverCurrentStream((el.nativeAudio && Number.isFinite(el.nativeAudio.currentTime)) ? el.nativeAudio.currentTime : 0);
          return;
        }
        if (!el.nativeAudio || el.nativeAudio.paused || el.nativeAudio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) return;
        if (Math.abs((el.nativeAudio.currentTime || 0) - stallPos) > 0.5) return;
        recoverCurrentStream(el.nativeAudio.currentTime || 0);
      }, 12000);
    }


function prefetchNextQueueTrack() {
      prefetchUpcomingQueueStreams();
    }


    window.getReliableTrackDuration = getReliableTrackDuration;
function getReliableTrackDuration() {
      const audio = el.nativeAudio;
      if (!state.audioDurationStale && audio && Number.isFinite(audio.duration) && audio.duration > 1) {
        return audio.duration;
      }
      const ct = state.currentTrack;
      const metaDur = (ct && Number.isFinite(ct.duration) && ct.duration > 0)
        ? ct.duration
        : ((ct && Number.isFinite(ct.durationMs) && ct.durationMs > 0)
            ? ct.durationMs / 1000
            : ((ct && Number.isFinite(ct.duration_ms) && ct.duration_ms > 0)
                ? ct.duration_ms / 1000
                : 0));
      return metaDur > 0 ? metaDur : 0;
    }

function isTrackDurationCompatible() {
      return true;
    }


window.clearPlaybackStallTimer = clearPlaybackStallTimer;
window.watchPlaybackStall = watchPlaybackStall;
window.prefetchNextQueueTrack = prefetchNextQueueTrack;
window.recoverCurrentStream = recoverCurrentStream;
window.recoverCurrentStreamOnce = recoverCurrentStreamOnce;
window.getReliableTrackDuration = getReliableTrackDuration;
window.isTrackDurationCompatible = isTrackDurationCompatible;
window.rememberWaveShown = window.rememberWaveShown || function(fresh) {};

  function sendDiscordRpcUpdate(track, isPlaying) {
    if (!window.electronAPI || !window.electronAPI.discordRpcUpdate) return;
    if (!track || !isPlaying) {
      if (window.electronAPI.discordRpcClear) window.electronAPI.discordRpcClear();
      return;
    }
    track.artist = stripYoutubeTopic(track.artist);
    applyTrackRenames(track);
    const customArt = typeof getTrackArt === 'function' ? getTrackArt(track) : null;
    const isHttpUrl = (u) => typeof u === 'string' && (u.startsWith('http://') || u.startsWith('https://')) && !u.includes('127.0.0.1');
    let rpcThumb = '';
    if (customArt && isHttpUrl(customArt.cover)) rpcThumb = customArt.cover;
    else if (isHttpUrl(track.thumbnail)) rpcThumb = track.thumbnail;
    else if (isHttpUrl(track.cover)) rpcThumb = track.cover;
    const shareUrl = buildRiffShareUrl(track, '', '', 500);
    const curSec = (el.nativeAudio && Number.isFinite(el.nativeAudio.currentTime)) ? el.nativeAudio.currentTime : 0;
    window.electronAPI.discordRpcUpdate({
      title: track.title || 'Unknown Track',
      artist: track.artist || 'Unknown Artist',
      artistInStatus: localStorage.getItem('riff_discord_artist_status') !== '0',
      duration: track.duration || 0,
      thumbnail: rpcThumb,
      url: shareUrl,
      platform: track.platform || state.platform,
      startTimestamp: Math.floor(Date.now() / 1000 - curSec)
    });
  }

  function sendStateToServer(currentWordText = '', wordIndex = -1, lineIndex = -1) {
    if (!state.currentTrack) return;
    fetch(`http://127.0.0.1:${state.serverPort}/api/state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: state.currentTrack.title,
        artist: state.currentTrack.artist,
        isPlaying: state.isPlaying,
        word: currentWordText,
        wordIndex: wordIndex,
        lineIndex: lineIndex
      })
    }).catch(() => {});
  }

  var lastSendStateTime = 0;
  var pendingSendStateArgs = null;
  var sendStateTimer = null;
  function throttledSendStateToServer(wordText = '', wordIdx = -1, lineIdx = -1) {
    const now = performance.now();
    if (now - lastSendStateTime > 350) {
      lastSendStateTime = now;
      sendStateToServer(wordText, wordIdx, lineIdx);
    } else {
      pendingSendStateArgs = [wordText, wordIdx, lineIdx];
      if (!sendStateTimer) {
        sendStateTimer = setTimeout(() => {
          sendStateTimer = null;
          lastSendStateTime = performance.now();
          if (pendingSendStateArgs) {
            sendStateToServer(...pendingSendStateArgs);
            pendingSendStateArgs = null;
          }
        }, 350);
      }
    }
  }


  function getMediaArtwork(thumb) {
    if (!thumb || typeof thumb !== 'string') return [];
    let trimmed = thumb.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(trimmed)) {
      trimmed = 'file://' + (trimmed.startsWith('/') ? '' : '/') + trimmed.replace(/\\/g, '/');
    }
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('file://') && !trimmed.startsWith('data:')) {
      return [];
    }
    let type = 'image/jpeg';
    if (trimmed.startsWith('data:image/png') || /\.png(\?|$)/i.test(trimmed)) type = 'image/png';
    else if (trimmed.startsWith('data:image/webp') || /\.webp(\?|$)/i.test(trimmed)) type = 'image/webp';
    else if (trimmed.startsWith('data:image/gif') || /\.gif(\?|$)/i.test(trimmed)) type = 'image/gif';
    return [
      { src: trimmed, sizes: '256x256', type },
      { src: trimmed, sizes: '512x512', type }
    ];
  }

  function updateMediaPositionState() {
    if (!('mediaSession' in navigator) || typeof navigator.mediaSession.setPositionState !== 'function') return;
    try {
      const audio = (state.secondaryAudio && !state.secondaryAudio.paused) ? state.secondaryAudio : el.nativeAudio;
      let duration = (audio && Number.isFinite(audio.duration) && audio.duration > 0)
        ? audio.duration
        : (state.currentTrack && Number.isFinite(state.currentTrack.duration) && state.currentTrack.duration > 0 ? state.currentTrack.duration : 0);
      let position = (audio && Number.isFinite(audio.currentTime) && audio.currentTime >= 0) ? audio.currentTime : 0;
      let playbackRate = (audio && Number.isFinite(audio.playbackRate) && audio.playbackRate > 0) ? audio.playbackRate : 1.0;
      if (duration > 0) {
        if (position > duration) position = duration;
        navigator.mediaSession.setPositionState({
          duration,
          playbackRate,
          position
        });
      } else {
        navigator.mediaSession.setPositionState();
      }
    } catch (_) {}
  }

  function updateMediaSession(track) {
    if (!('mediaSession' in navigator)) return;
    const current = track || state.currentTrack;
    if (current) {
      const rawTitle = (typeof current.title === 'string' ? current.title.trim() : '');
      const rawArtist = (typeof current.artist === 'string' ? current.artist.trim() : '');
      const title = rawTitle || 'Unknown track';
      const artist = rawArtist || 'Unknown artist';
      const album = current.album || 'Riff';
      const thumb = (typeof getTrackThumbUrl === 'function' ? getTrackThumbUrl(current) : '') || current.thumbnail || current.cover || '';
      const artwork = getMediaArtwork(thumb);
      navigator.mediaSession.metadata = new MediaMetadata({
        title,
        artist,
        album,
        artwork
      });
      updateMediaPositionState();
    } else {
      navigator.mediaSession.metadata = null;
    }
    navigator.mediaSession.playbackState = state.isPlaying ? 'playing' : 'paused';
  }

  var MEDIA_GROUP = { toggle: 'pp', play: 'pp', pause: 'pp', next: 'next', prev: 'prev', stop: 'stop' };
  var lastMedia = { g: '', t: 0 };
  var hasNotifiedMediaKeysActive = false;
  function handleMediaCommand(cmd, src) {
    const g = MEDIA_GROUP[cmd];
    if (!g) return;
    const now = performance.now();
    if (lastMedia.g === g && now - lastMedia.t < 350) return;
    lastMedia = { g, t: now };
    if (cmd === 'toggle') togglePlayPause();
    else if (cmd === 'play') { if (!state.isPlaying) playSmooth(); }
    else if (cmd === 'pause') { if (state.isPlaying) pauseSmooth(); }
    else if (cmd === 'next') playNext();
    else if (cmd === 'prev') playPrev();
    else if (cmd === 'stop') { if (state.isPlaying) pauseSmooth(); }
  }

  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.setActionHandler('play', () => handleMediaCommand('play', 'session'));
      navigator.mediaSession.setActionHandler('pause', () => handleMediaCommand('pause', 'session'));
      navigator.mediaSession.setActionHandler('previoustrack', () => handleMediaCommand('prev', 'session'));
      navigator.mediaSession.setActionHandler('nexttrack', () => handleMediaCommand('next', 'session'));
      navigator.mediaSession.setActionHandler('stop', () => handleMediaCommand('stop', 'session'));
      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        const offset = (details && details.seekOffset) || 10;
        const audio = (state.secondaryAudio && !state.secondaryAudio.paused) ? state.secondaryAudio : el.nativeAudio;
        if (audio) {
          audio.currentTime = Math.max(0, (audio.currentTime || 0) - offset);
          if (typeof updateSyncedLyricsHighlight === 'function') {
            updateSyncedLyricsHighlight(audio.currentTime);
          }
          updateMediaPositionState();
        }
      });
      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        const offset = (details && details.seekOffset) || 10;
        const audio = (state.secondaryAudio && !state.secondaryAudio.paused) ? state.secondaryAudio : el.nativeAudio;
        if (audio) {
          const maxDur = (audio.duration && Number.isFinite(audio.duration) && audio.duration > 0) ? audio.duration : Infinity;
          audio.currentTime = Math.min(maxDur, (audio.currentTime || 0) + offset);
          if (typeof updateSyncedLyricsHighlight === 'function') {
            updateSyncedLyricsHighlight(audio.currentTime);
          }
          updateMediaPositionState();
        }
      });
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined && details.seekTime !== null) {
          const audio = (state.secondaryAudio && !state.secondaryAudio.paused) ? state.secondaryAudio : el.nativeAudio;
          if (audio) audio.currentTime = details.seekTime;
          if (typeof updateSyncedLyricsHighlight === 'function') {
            updateSyncedLyricsHighlight(details.seekTime);
          }
          updateMediaPositionState();
        }
      });
    } catch (_) {}
  }


  var resumeAudioOnce = () => {
    initAudioContext();
    document.removeEventListener('click', resumeAudioOnce);
    document.removeEventListener('keydown', resumeAudioOnce);
  };
  document.addEventListener('click', resumeAudioOnce);
  document.addEventListener('keydown', resumeAudioOnce);

  document.addEventListener('click', (e) => {
    if (openDrawerState && railDrawer) {
      const btnSbPresets = document.getElementById('btn-sb-presets');
      if (!railDrawer.contains(e.target) &&
        (!btnTogglePresets || !btnTogglePresets.contains(e.target)) &&
        (!btnTogglePlaylists || !btnTogglePlaylists.contains(e.target)) &&
        (!btnSbPresets || !btnSbPresets.contains(e.target))) {
        closeDrawer();
      }
    }
  });

  document.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('button, .chip-btn, .mix-card, .track-row, .rail-icon-btn, .preset-chip');
    if (!el || el.closest('.settings-nav-btn')) return;
    el.classList.add('pressed');
    const release = () => {
      document.removeEventListener('pointerup', release, true);
      document.removeEventListener('pointercancel', release, true);
      el.classList.remove('pressed');
    };
    document.addEventListener('pointerup', release, true);
    document.addEventListener('pointercancel', release, true);
  }, true);


  var audioEngine = new window.RiffAudioEngine();
  window.audioEngine = audioEngine;
  var hlsInstance = null;
  animationFrameId = null;

  var lastKnownAudioTime = 0;
  var lastAudioTimePerf = 0;
  function getSmoothAudioTime() {
    if (!el.nativeAudio) {
      return (audioEngine && audioEngine.getCurrentTime) ? audioEngine.getCurrentTime() : 0;
    }
    const raw = Number.isFinite(el.nativeAudio.currentTime) ? el.nativeAudio.currentTime : 0;
    const now = performance.now();
    if (!state.isPlaying || el.nativeAudio.paused) {
      lastKnownAudioTime = raw;
      lastAudioTimePerf = now;
      return raw;
    }
    if (Math.abs(raw - lastKnownAudioTime) > 0.001) {
      lastKnownAudioTime = raw;
      lastAudioTimePerf = now;
      return raw;
    }
    const dt = Math.max(0, (now - lastAudioTimePerf) / 1000);
    const playbackRate = el.nativeAudio.playbackRate || 1.0;
    return lastKnownAudioTime + Math.min(dt * playbackRate, 0.25);
  }

  var levelAvgDb = -120;
  function normalizeEnabled() { return localStorage.getItem('riff_audio_normalize') === '1'; }
  function resetLevelWatcher() { levelAvgDb = -120; if (audioEngine && audioEngine.setNormalizeGainDb) audioEngine.setNormalizeGainDb(0); }
  setInterval(() => {
    const audio = el.nativeAudio;
    if (!audioEngine || !audioEngine.getLevelDb || !audio || audio.paused || !state.isPlaying) return;
    const db = audioEngine.getLevelDb();
    if (normalizeEnabled()) {
      if (db > -50) {
        levelAvgDb = levelAvgDb <= -120 ? db : levelAvgDb + (db - levelAvgDb) * 0.05;
        const gainDb = Math.max(-9, Math.min(9, -17 - levelAvgDb));
        audioEngine.setNormalizeGainDb(gainDb);
      }
    } else if (levelAvgDb > -120) {
      resetLevelWatcher();
    }
  }, 100);


  var lastfmState = {
    enabled: localStorage.getItem('riff_lastfm_enabled') !== 'false',
    sessionKey: localStorage.getItem('riff_lastfm_sk') || '',
    username: localStorage.getItem('riff_lastfm_user') || '',
    apiKey: localStorage.getItem('riff_lastfm_apikey') || '',
    apiSecret: localStorage.getItem('riff_lastfm_apisecret') || '',
    currentTrackKey: '',
    startedAtUnix: 0,
    playedSeconds: 0,
    lastTickTime: 0,
    scrobbled: false,
    nowPlayingSent: false,
    npTimer: null,
    pollTimer: null
  };

  function cleanLastFmMeta(track) {
    if (!track) return { artist: '', title: '', album: '' };
    if (typeof applyTrackRenames === 'function') applyTrackRenames(track);
    let title = String(track.title || '').trim();
    let artist = String(track.artist || '').replace(/VEVO$/i, '').trim();
    artist = stripYoutubeTopic(artist);
    const noiseRe = new RegExp('\\s*[\\(\\[]\\s*(?:official\\s*(?:music\\s*)?(?:video|audio|lyric\\s*video|visualizer)|lyrics?|audio|hd|hq|4k|remastered|explicit|clean|visualizer|mv|clip\\s*officiel|slowed(?:\\s*\\+\\s*reverb)?|sped\\s*up|nightcore)\\s*[\\)\\]]', 'gi');
    title = title.replace(noiseRe, '').trim();
    if (title.includes(' - ')) {
      const parts = title.split(' - ');
      const left = parts[0].trim();
      const right = parts.slice(1).join(' - ').trim();
      if (left && right && (!artist || artist.toLowerCase() === 'unknown artist' || !artist.toLowerCase().includes(left.toLowerCase()))) {
        artist = left;
        title = right;
      }
    }
    artist = stripYoutubeTopic(artist);
    if (typeof splitArtistTokens === 'function') {
      const toks = splitArtistTokens(artist).filter(t => t.type === 'artist');
      if (toks.length > 0 && toks[0].value) artist = toks[0].value;
    }
    return { artist: artist || 'Unknown Artist', title: title || 'Untitled', album: String(track.album || '').trim() };
  }

  function syncLastFmUI() {
    const statusEl = document.getElementById('lastfm-status-label');
    const toggleBtn = document.getElementById('btn-lastfm-toggle');
    const openBtn = document.getElementById('btn-lastfm-open-modal');
    const connBox = document.getElementById('lastfm-modal-connected-box');
    const authBox = document.getElementById('lastfm-modal-auth-box');
    const userEl = document.getElementById('lastfm-modal-user');
    const connected = !!(lastfmState.sessionKey && lastfmState.username);
    if (statusEl) {
      statusEl.textContent = connected
        ? (lastfmState.enabled ? ('Scrobbling as @' + lastfmState.username) : ('Paused (@' + lastfmState.username + ')'))
        : 'Not connected';
    }
    if (toggleBtn) toggleBtn.classList.toggle('active', connected && lastfmState.enabled);
    if (openBtn) openBtn.textContent = connected ? 'Account' : 'Connect';
    if (connBox) connBox.classList.toggle('hidden', !connected);
    if (authBox) authBox.style.display = connected ? 'none' : 'flex';
    if (userEl && connected) userEl.textContent = '@' + lastfmState.username;
  }

  async function sendLastFmNowPlaying(track) {
    if (!lastfmState.enabled || !lastfmState.sessionKey || !track) return;
    const meta = cleanLastFmMeta(track);
    if (!meta.title || !meta.artist) return;
    const dur = typeof getReliableTrackDuration === 'function' ? getReliableTrackDuration() : (track.duration || 0);
    try {
      const r = await fetch('http://127.0.0.1:' + (state.serverPort || 38472) + '/api/lastfm/now-playing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sk: lastfmState.sessionKey,
          apiKey: lastfmState.apiKey,
          apiSecret: lastfmState.apiSecret,
          artist: meta.artist,
          track: meta.title,
          album: meta.album,
          duration: dur
        })
      });
      const d = await r.json();
      if (d && d.success) {
        const statusEl = document.getElementById('lastfm-status-label');
        if (statusEl) statusEl.textContent = `Now playing: ${meta.artist} — ${meta.title} (@${lastfmState.username})`;
      }
    } catch (_) {}
  }

  async function sendLastFmScrobble(track, timestamp) {
    if (!lastfmState.enabled || !lastfmState.sessionKey || !track) return;
    const meta = cleanLastFmMeta(track);
    if (!meta.title || !meta.artist) return;
    const dur = typeof getReliableTrackDuration === 'function' ? getReliableTrackDuration() : (track.duration || 0);
    try {
      const r = await fetch('http://127.0.0.1:' + (state.serverPort || 38472) + '/api/lastfm/scrobble', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sk: lastfmState.sessionKey,
          apiKey: lastfmState.apiKey,
          apiSecret: lastfmState.apiSecret,
          artist: meta.artist,
          track: meta.title,
          album: meta.album,
          duration: dur,
          timestamp: timestamp || Math.floor(Date.now() / 1000)
        })
      });
      const d = await r.json();
      if (d && d.success) {
        const statusEl = document.getElementById('lastfm-status-label');
        if (statusEl) statusEl.textContent = `Scrobbled: ${meta.artist} — ${meta.title} (@${lastfmState.username})`;
      }
    } catch (_) {}
  }

  function onLastFmTrackStart(track) {
    if (!track) return;
    const key = (track.id || '') + '::' + (track.title || '') + '::' + (track.artist || '');
    if (lastfmState.currentTrackKey !== key) {
      lastfmState.currentTrackKey = key;
      lastfmState.startedAtUnix = Math.floor(Date.now() / 1000);
      lastfmState.playedSeconds = 0;
      lastfmState.scrobbled = false;
      lastfmState.nowPlayingSent = false;
    }
    lastfmState.lastTickTime = performance.now();
    if (lastfmState.npTimer) clearTimeout(lastfmState.npTimer);
    lastfmState.npTimer = setTimeout(() => {
      if (state.currentTrack && !el.nativeAudio?.paused && !lastfmState.nowPlayingSent) {
        lastfmState.nowPlayingSent = true;
        sendLastFmNowPlaying(state.currentTrack);
      }
    }, 1500);
  }

  function onLastFmTimeUpdate() {
    if (!lastfmState.enabled || !lastfmState.sessionKey || !state.currentTrack || !el.nativeAudio || el.nativeAudio.paused) {
      lastfmState.lastTickTime = performance.now();
      return;
    }
    if (!lastfmState.nowPlayingSent && el.nativeAudio.currentTime > 1.0) {
      lastfmState.nowPlayingSent = true;
      sendLastFmNowPlaying(state.currentTrack);
    }
    const now = performance.now();
    const dt = (now - (lastfmState.lastTickTime || now)) / 1000;
    lastfmState.lastTickTime = now;
    if (dt > 0 && dt < 2.5) {
      lastfmState.playedSeconds += dt;
    }
    if (lastfmState.scrobbled) {
      if (el.nativeAudio.currentTime < 3 && lastfmState.playedSeconds > 25) {
        lastfmState.currentTrackKey = '';
        onLastFmTrackStart(state.currentTrack);
      }
      return;
    }
    const dur = typeof getReliableTrackDuration === 'function' ? getReliableTrackDuration() : (state.currentTrack.duration || 0);
    const effDur = dur > 0 ? dur : 180;
    if (effDur < 25) return;
    const targetSeconds = Math.min(240, Math.max(25, effDur * 0.5));
    if (lastfmState.playedSeconds >= targetSeconds) {
      lastfmState.scrobbled = true;
      sendLastFmScrobble(state.currentTrack, lastfmState.startedAtUnix);
    }
  }

  var preloadedTrack10sFired = false;
  var preloadAudioEl = null;


  function warmUpNextAudioBuffer(streamUrl) {
    if (!streamUrl || typeof streamUrl !== 'string' || streamUrl.includes('.m3u8')) return;
    fetch(streamUrl, { headers: { 'Range': 'bytes=0-262143' } }).catch(() => {});
  }

  async function preloadNextTrackStream() {
    if (!state.queue || state.queueIndex < 0) return;
    const nextTrack = state.queue[state.queueIndex + 1];
    if (!nextTrack || nextTrack.isCached || nextTrack.platform === 'local' || isStaticTikTokTrack(nextTrack)) return;
    const curQuality = localStorage.getItem('riff_audio_quality') || 'medium';
    if (nextTrack._preloadedStreamUrl && nextTrack._preloadedStreamQuality === curQuality) {
      warmUpNextAudioBuffer(nextTrack._preloadedStreamUrl);
      return;
    }
    try {
      const resolvedId = nextTrack.resolvedYtId || nextTrack.id;
      const qQuality = encodeURIComponent(curQuality);
      const qFallback = encodeURIComponent(nextTrack.searchQuery || ((nextTrack.artist ? nextTrack.artist + ' - ' : '') + (nextTrack.title || '')));
      const isRiffStream = localStorage.getItem('riff_library_streaming') === '1' ? '&riffStream=1' : '';
      const fetchUrl = `http://127.0.0.1:${state.serverPort}/api/stream-info?id=${encodeURIComponent(resolvedId || '')}&url=${encodeURIComponent(nextTrack.url || '')}&platform=${encodeURIComponent(nextTrack.platform || 'ytmusic')}&title=${encodeURIComponent(nextTrack.title || '')}&artist=${encodeURIComponent(nextTrack.artist || '')}&duration=${encodeURIComponent(nextTrack.duration || 0)}&q=${qFallback}&quality=${qQuality}${isRiffStream}`;
      const res = await fetch(fetchUrl);
      const data = await res.json();
      if (data && data.success && data.streamUrl) {
        if (data.isLocal) {
          nextTrack.isCached = true;
          if (data.cachedId) nextTrack._cachedId = data.cachedId;
          if (nextTrack.id) cachedTrackIds.add(cleanTrackId(nextTrack.id));
        }
        if (data.sourceMeta) {
          nextTrack._preloadedSourceMeta = data.sourceMeta;
        }
        nextTrack._preloadedStreamUrl = data.streamUrl;
        nextTrack._preloadedAt = Date.now();
        nextTrack._preloadedStreamQuality = curQuality;
        if (data.resolvedId && /^[a-zA-Z0-9_-]{11}$/.test(data.resolvedId)) {
          nextTrack.resolvedYtId = data.resolvedId;
        }
        warmUpNextAudioBuffer(data.streamUrl);
      }
    } catch (_) {}
  }

  function prefetchUpcomingQueueStreams() {
    if (!state.queue || state.queueIndex < 0) return;
    preloadNextTrackStream();
    const secondNext = state.queue[state.queueIndex + 2];
    if (secondNext && !secondNext._preloadedStreamUrl && secondNext.platform !== 'local' && !isStaticTikTokTrack(secondNext)) {
      if (typeof enqueueStreamPrefetch === 'function') {
        enqueueStreamPrefetch(secondNext);
      }
    }
  }

  var cfTailAudio = null;
  var cfTailTimer = null;

  function stopCrossfadeTail() {
    if (cfTailTimer) { clearInterval(cfTailTimer); cfTailTimer = null; }
    if (cfTailAudio) {
      try { cfTailAudio.pause(); cfTailAudio.removeAttribute('src'); cfTailAudio.load(); } catch (_) {}
    }
  }
  function startCrossfadeTailFromCurrent(fadeSec) {
    if (!el.nativeAudio || !el.nativeAudio.src || el.nativeAudio.paused) return;
    const src = el.nativeAudio.src;
    if (src.startsWith('blob:')) return;
    stopCrossfadeTail();
    if (!cfTailAudio) {
      cfTailAudio = new Audio();
      cfTailAudio.crossOrigin = 'anonymous';
    }
    const startVol = state.isMuted ? 0 : Math.max(0, Math.min(1, state.volume * state.volume * (state.audioSettings?.volume || 1)));
    if (startVol <= 0.01) return;
    try {
      cfTailAudio.src = src;
      cfTailAudio.playbackRate = el.nativeAudio.playbackRate || 1;
      cfTailAudio.currentTime = el.nativeAudio.currentTime || 0;
      cfTailAudio.volume = startVol;
      if (currentAudioOutputDeviceId && currentAudioOutputDeviceId !== 'default' && typeof cfTailAudio.setSinkId === 'function') {
        cfTailAudio.setSinkId(currentAudioOutputDeviceId).catch(() => {});
      }
      const prevAudio = el.nativeAudio;
      cfTailAudio.play().then(() => {
        try {
          if (prevAudio && prevAudio.src === src && !prevAudio.paused) {
            prevAudio.pause();
          }
        } catch (_) {}
      }).catch(() => {});
      const t0 = performance.now();
      const durMs = Math.max(500, fadeSec * 1000);
      cfTailTimer = setInterval(() => {
        const p = Math.min(1, (performance.now() - t0) / durMs);
        cfTailAudio.volume = Math.max(0, startVol * Math.cos(p * Math.PI * 0.5));
        if (p >= 1) stopCrossfadeTail();
      }, 40);
    } catch (_) {
      stopCrossfadeTail();
    }
  }


  function saveLastPlaybackState() {
    if (!state.currentTrack) return;
    try {
      localStorage.setItem('riff_last_playback_state', JSON.stringify({
        track: state.currentTrack,
        currentTime: (el.nativeAudio && Number.isFinite(el.nativeAudio.currentTime)) ? el.nativeAudio.currentTime : 0,
        queue: (state.queue || []).slice(0, 40),
        queueIndex: state.queueIndex
      }));
    } catch (_) {}
  }


  async function playTrack(track, queueList = null, startIndex = -1, context = null) {
    if (track) {
      track._retryCount = 0;
      track._gaveUp = false;
      track.isUnavailable = false;
      delete track._unavailNotice;
      delete track._errorRetryStage;
      if (typeof removeFailedTrack === 'function') {
        removeFailedTrack(track);
      }
      if (!(Number(track.duration) > 0)) {
        track._hadNoDurationOnImport = true;
      }
      repairTikTokTrack(track);
    }
    const isLocalUrl = track && track._preloadedStreamUrl && (track._preloadedStreamUrl.includes('/api/local-track') || track._preloadedStreamUrl.startsWith('file:'));
    if (track && !isLocalUrl && (!track._preloadedAt || (Date.now() - track._preloadedAt > 180000))) {
      delete track._preloadedStreamUrl;
      delete track._preloadedStreamQuality;
      delete track._preloadedAt;
    }
    if (track && !track._errorRetryStage) track._errorRetryStage = 0;
    if (track && track.artist) track.artist = stripYoutubeTopic(track.artist);
    if (track && track._preloadedStreamUrl && !String(track._preloadedStreamUrl).startsWith('http')) {
      delete track._preloadedStreamUrl;
      delete track._preloadedStreamQuality;
    }
    preloadedTrack10sFired = false;
    lastDisplayedSec = -1;
    lastDisplayedDur = -1;
    if (typeof lastTimeupdateSec !== 'undefined') lastTimeupdateSec = -1;
    if (syncState && syncState.active) {
      const overlay = document.getElementById('sync-mode-overlay');
      if (!overlay || overlay.classList.contains('hidden')) {
        syncState.active = false;
      } else {
        return;
      }
    }
    applyTrackRenames(track);
    if (typeof queueList === "number") { startIndex = queueList; queueList = state.queue; }
    if (!track || !el.nativeAudio) return;
    const selectedQuality = localStorage.getItem('riff_audio_quality') || 'medium';
    if (track._preloadedStreamQuality && track._preloadedStreamQuality !== selectedQuality) {
      delete track._preloadedStreamUrl;
      delete track._preloadedStreamQuality;
    }
    prioritizeTrackStream(track);
    state.isLoadingTrack = true;
    resetLevelWatcher();
    vizPrev = null;
    if (state.currentTrack && state.currentTrack.id !== track.id && !navigatingBack) pushPlayHistory(state.currentTrack);

    if (!state._isNaturalEnding && state.myWaveActive && state.currentTrack && !isSameTrack(state.currentTrack, track)) {
      const curId = (typeof getTrackCanonicalId === 'function' ? getTrackCanonicalId(state.currentTrack) : '') || state.currentTrack.id;
      if (state._skipRecordedFor !== curId) {
        const cur = (el.nativeAudio && typeof el.nativeAudio.currentTime === 'number') ? el.nativeAudio.currentTime : 0;
        if (cur < 12 && typeof recordWaveSkip === 'function') {
          recordWaveSkip(state.currentTrack);
        }
      }
    }
    state._skipRecordedFor = null;

    if (el.nativeAudio && !crossfadeFadeInPending) {
      try {
        if (!el.nativeAudio.paused) el.nativeAudio.pause();
        el.nativeAudio.currentTime = 0;
      } catch (_) {}
    }

    if (context !== 'album') currentAlbumPlayRunId++;
    state._streamRecoverCount = 0;
    if (context === 'album' || context === 'playlist' || context === 'favorites' || context === 'search' || context === 'history' || context === 'artist' || (track && track.platform === 'local')) {
      state.isRadioQueue = false;
      state.myWaveActive = false;
    }
    crossfadeTriggered = false;
    state.nextTrackPrefetched = false;
    initAudioContext();
    el.nativeAudio.preload = 'auto';

    try { if (el.nativeAudio && !el.nativeAudio.paused && !crossfadeFadeInPending) el.nativeAudio.pause(); } catch (_) {}

    if (hlsInstance) {
      try { hlsInstance.destroy(); } catch (e) {}
      hlsInstance = null;
    }

    state.isPlaying = false;
    updatePlayPauseButton(false, true);
    sendStateToServer();

    state.isLoadingLyrics = true;
    state.lyricsLoaded = false;
    if (typeof updateTvkLyricsStatus === 'function') updateTvkLyricsStatus();

    if (el.lyricsContainer) el.lyricsContainer.scrollTop = 0;
    if (typeof lyricsScrollRaf !== 'undefined' && lyricsScrollRaf) {
      cancelAnimationFrame(lyricsScrollRaf);
      lyricsScrollRaf = 0;
    }
    state.lastActiveLyricIdx = -1;
    state.forceLyricsScroll = true;
    state.forceSnapLyrics = true;

    if (el.timeCurrent) el.timeCurrent.textContent = '0:00';
    if (el.tvkTimeCurrent) el.tvkTimeCurrent.textContent = '0:00';
    if (el.timeDuration) el.timeDuration.textContent = formatDuration(track.duration || 0);
    if (el.tvkTimeDuration) el.tvkTimeDuration.textContent = formatDuration(track.duration || 0);
    if (el.tvkSeekSlider) el.tvkSeekSlider.value = 0;
    scrubPrevKnobX = null;
    scrubProgress = 0;
    if (!el.progressEl || !el.progressEl.isConnected) {
      el.progressEl = document.getElementById('scrubber-track');
    }
    if (!el.scrubberCanvas || !el.scrubberCanvas.isConnected) {
      el.scrubberCanvas = document.getElementById('squiggly-canvas');
    }
    if (!el.ccPlayhead || !el.ccPlayhead.isConnected) {
      el.ccPlayhead = document.getElementById('cc-playhead');
    }
    if (typeof refreshCachedSpinners === 'function') refreshCachedSpinners();

    const isCachedOrLocal = isTrackLocallyCached(track);
    if (isCachedOrLocal) track.isCached = true;

    if (!isCachedOrLocal && !track._preloadedStreamUrl && track.platform !== 'local') {
      if (el.trackLoadingOverlay) {
        if (el.trackLoadingTitle) el.trackLoadingTitle.textContent = track.title || 'loading track...';
        if (el.trackLoadingSub) el.trackLoadingSub.textContent = track.artist ? `${track.artist} • buffering stream` : 'buffering audio stream';
        el.trackLoadingOverlay.classList.remove('hidden');
      }
    } else {
      if (el.trackLoadingOverlay) el.trackLoadingOverlay.classList.add('hidden');
    }

    state.loadToken++;
    const currentToken = state.loadToken;

    if (state.currentAbortController) {
      state.currentAbortController.abort();
    }
    state.currentAbortController = new AbortController();
    const signal = state.currentAbortController.signal;
    let didTimeoutAbort = false;
    const fetchAbortTimeout = setTimeout(() => {
      didTimeoutAbort = true;
      try { state.currentAbortController?.abort(); } catch (_) {}
    }, 22000);

    state.audioDurationStale = true;
    state.currentTrack = track;
    saveLastPlaybackState();
    emitPluginEvent('trackchange', track);
    if (context !== null) state.currentTrackContext = context;
    if (startIndex !== -1) state.currentTrackIndexInContext = startIndex;
    else if (state.queueIndex >= 0) state.currentTrackIndexInContext = state.queueIndex;
    if (typeof updateTopMomentPin === 'function') updateTopMomentPin();

    const isAutoplayContext = typeof autoplayEnabled === 'function' && autoplayEnabled() &&
      !state.isShuffle &&
      (context === 'search' || context === 'history' || context === 'favorites');

    const isFreshQueue = Boolean(queueList && queueList !== state.queue && context !== 'queue' && (!track || !track._isAutoplay));
    if (isFreshQueue) {
      if (isAutoplayContext) {
        state.queue = [track];
        state.queueIndex = 0;
        state._autoplayPool = [];
        state._autoplayAnchorSeeds = null;
      } else {
        state.queue = [...queueList];
        if (startIndex >= 0 && startIndex < state.queue.length && isSameTrack(state.queue[startIndex], track)) {
          state.queueIndex = startIndex;
        } else {
          state.queueIndex = state.queue.findIndex(t => isSameTrack(t, track));
        }
        if (state.queueIndex === -1) {
          state.queue.unshift(track);
          state.queueIndex = 0;
        }
      }
      state.queueHistory = [state.queueIndex];
    } else {
      let existingIndex = -1;
      if (queueList === state.queue && startIndex >= 0 && startIndex < state.queue.length) {
        existingIndex = startIndex;
      } else if (startIndex >= 0 && startIndex < state.queue.length && isSameTrack(state.queue[startIndex], track)) {
        existingIndex = startIndex;
      } else if (state.queueIndex >= 0 && state.queueIndex < state.queue.length && isSameTrack(state.queue[state.queueIndex], track)) {
        existingIndex = state.queueIndex;
      } else {
        existingIndex = state.queue.findIndex(t => isSameTrack(t, track));
      }
      if (existingIndex === -1) {
        state.queue.push(track);
        state.queueIndex = state.queue.length - 1;
      } else {
        state.queueIndex = existingIndex;
      }
      recordPlayedIndex(state.queueIndex);
    }
    if (isFreshQueue || !state._shufflePlayedIndices || !state._shufflePlayedIds) {
      state._shufflePlayedIndices = new Set();
      state._shufflePlayedIds = new Set();
    }
    if (state.queueIndex >= 0) state._shufflePlayedIndices.add(state.queueIndex);
    const curCanIdForShuffle = getTrackCanonicalId(track);
    if (curCanIdForShuffle) state._shufflePlayedIds.add(curCanIdForShuffle);

    if (track && !track._isAutoplay) {
      if (isFreshQueue || isAutoplayContext) {
        state._autoplayPool = [];
      }
      const seeds = [{
        artist: track.artist || '',
        title: track.title || '',
        id: track.id || '',
        weight: 3
      }];
      const otherTracks = (state.queue || []).filter(t => t && !t._isAutoplay && !isSameTrack(t, track));
      for (const t of otherTracks.slice(0, 2)) {
        seeds.push({
          artist: t.artist || '',
          title: t.title || '',
          id: t.id || '',
          weight: 3
        });
      }
      state._autoplayAnchorSeeds = seeds;
    }
    updateQueueBadge();
    if (state.currentView === 'queue') renderQueueView();
    if (typeof autoplayEnabled === 'function' && autoplayEnabled()) ensureAutoplayBuffer();

    track.playedAt = Date.now();
    state.history = state.history.filter(t => !isSameTrack(t, track));
    state.history.unshift(track);
    if (state.history.length > 100) state.history.pop();
    localStorage.setItem('devsize_history', JSON.stringify(state.history));
    updateHistoryBadge();
    if (state.currentView === 'history') renderHistoryView();

    updateNowPlayingUI(track);
    updatePlayPauseButton(false, true);

    if (!track.thumbnail && track.platform !== 'local') {
      fetch(`http://127.0.0.1:${state.serverPort}/api/track-cover?artist=${encodeURIComponent(track.artist || '')}&title=${encodeURIComponent(track.title || '')}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data && data.cover) {
            track.thumbnail = data.cover;
            if (!state.currentTrack || state.currentTrack === track || state.currentTrack.id === track.id) {
              updateNowPlayingUI(track);
            }
          }
        })
        .catch(() => {});
    }

    loadSyncedLyrics(track.title, track.artist, currentToken);

    try {
      if ((track.isCached && (track.id || track.title)) || isStaticTikTokTrack(track) || (track.id && cachedTrackIds.has(cleanTrackId(track.id)))) {
        track.isCached = true;
        repairTikTokTrack(track);
        const clean = cleanTrackId(track._cachedId || track.resolvedYtId || track.id || '');
        const localStreamUrl = `http://127.0.0.1:${state.serverPort}/api/local-track?id=${encodeURIComponent(clean)}&title=${encodeURIComponent(track.title || '')}&artist=${encodeURIComponent(track.artist || '')}`;
        if (currentToken !== state.loadToken) return;
        if (hlsInstance) {
          try { hlsInstance.destroy(); } catch (_) {}
          hlsInstance = null;
        }
        if (el.trackLoadingOverlay) el.trackLoadingOverlay.classList.add('hidden');
        el.nativeAudio.src = localStreamUrl;
        playSmooth();
        applyAudioSettings();
        return;
      }

      if (track.platform === 'local') {
        const streamUrl = track.url || (track.path ? (track.path.startsWith('file:') ? track.path : 'file://' + encodeURI(track.path)) : `http://127.0.0.1:${state.serverPort}/api/library-file?id=${encodeURIComponent(track.id)}`);
        if (currentToken !== state.loadToken) return;
        el.nativeAudio.src = streamUrl;
        playSmooth();
        applyAudioSettings();
        return;
      }

      if (track._preloadedStreamUrl && !(track._errorRetryStage > 0)) {
        const preloadedUrl = track._preloadedStreamUrl;
        if (track._preloadedSourceMeta) {
          track._sourceMeta = track._preloadedSourceMeta;
          delete track._preloadedSourceMeta;
        }
        delete track._preloadedStreamUrl;
        delete track._preloadedAt;
        if (currentToken !== state.loadToken) return;
        if (hlsInstance) {
          try { hlsInstance.destroy(); } catch (_) {}
          hlsInstance = null;
        }
        el.nativeAudio.preload = 'auto';
        const onNativeAudioErrorOnce = () => {
          if (track) {
            delete track._preloadedStreamUrl;
            delete track._preloadedAt;
          }
          const cur = track || state.currentTrack;
          const canRecover = cur && !cur._gaveUp && cur.platform !== 'local' && ((cur._retryCount || 0) <= 2 || (state._streamRecoverCount || 0) < 2);
          if (canRecover) return;
          state.isLoadingTrack = false;
          state.isPlaying = false;
          updatePlayPauseButton(false, false);
          if (el.trackLoadingOverlay) el.trackLoadingOverlay.classList.add('hidden');
          showToast('Could not load audio stream', 'error');
        };
        el.nativeAudio.addEventListener('error', onNativeAudioErrorOnce, { once: true });
        if (preloadedUrl.includes('.m3u8') && window.Hls && Hls.isSupported()) {
          hlsInstance = new Hls({ enableWorker: true, lowLatencyMode: true, maxBufferLength: 10, maxMaxBufferLength: 20, maxBufferSize: 4 * 1024 * 1024 });
          hlsInstance.on(Hls.Events.ERROR, (_, errData) => {
            if (errData && errData.fatal) {
              if (errData.type === Hls.ErrorTypes.NETWORK_ERROR) hlsInstance.startLoad();
              else if (errData.type === Hls.ErrorTypes.MEDIA_ERROR) hlsInstance.recoverMediaError();
            }
          });
          hlsInstance.loadSource(preloadedUrl);
          hlsInstance.attachMedia(el.nativeAudio);
          hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
            if (currentToken === state.loadToken) {
              playSmooth();
            }
          });
        } else {
          if (preloadAudioEl && preloadedUrl && preloadAudioEl.src !== preloadedUrl) { try { preloadAudioEl.removeAttribute('src'); preloadAudioEl.load(); } catch (_) {} }
          el.nativeAudio.src = preloadedUrl;
          playSmooth();
        }
        applyAudioSettings();
        return;
      }

      let resolvedUrl = track.url;
      let resolvedId = track.resolvedYtId || track.id;

      const qQuality = encodeURIComponent(localStorage.getItem('riff_audio_quality') || 'medium');
      const qSearch = encodeURIComponent(track.searchQuery || ((track.artist ? track.artist + ' - ' : '') + track.title));
      const isRiffStream = localStorage.getItem('riff_library_streaming') === '1' ? '&riffStream=1' : '';
      const streamInfoUrl = `http://127.0.0.1:${state.serverPort}/api/stream-info?url=${encodeURIComponent(resolvedUrl || '')}&id=${encodeURIComponent(resolvedId || '')}&platform=${(state.platform === 'soundcloud' && (!track.url || !track.url.includes('youtube.com'))) ? 'soundcloud' : (track.platform || state.platform || 'ytmusic')}&title=${encodeURIComponent(track.title || '')}&artist=${encodeURIComponent(track.artist || '')}&duration=${encodeURIComponent(track.duration || 0)}&thumbnail=${encodeURIComponent(track.thumbnail || '')}&quality=${qQuality}&q=${qSearch}${isRiffStream}`;
      let res;
      try {
        res = await fetch(streamInfoUrl, { signal });
      } catch (fetchErr) {
        if (fetchErr instanceof TypeError) {
          await new Promise(r => setTimeout(r, 600));
          res = await fetch(streamInfoUrl, { signal });
        } else {
          throw fetchErr;
        }
      }
      const data = await res.json();

      if (currentToken !== state.loadToken) return;
      if (data && data.sourceMeta) {
        track._sourceMeta = data.sourceMeta;
      }
      if (data && data.cachedId) {
        track._cachedId = data.cachedId;
      }
      if (data && data.isLocal) {
        track.isCached = true;
        if (track.id) cachedTrackIds.add(cleanTrackId(track.id));
        if (data.cachedId) cachedTrackIds.add(cleanTrackId(data.cachedId));
      }
      if (track.title && typeof getTrackNormalizedKey === 'function') {
        const normKey = getTrackNormalizedKey(track.artist, track.title);
        const syncTrackMetaInList = (list) => {
          if (!Array.isArray(list)) return false;
          let changed = false;
          for (const item of list) {
            if (!item || !item.title) continue;
            if (isSameTrack(item, track) || getTrackNormalizedKey(item.artist, item.title) === normKey) {
              if (track._sourceMeta) item._sourceMeta = track._sourceMeta;
              if (track._cachedId) item._cachedId = track._cachedId;
              if (track.isCached) item.isCached = true;
              if (data?.resolvedId && /^[a-zA-Z0-9_-]{11}$/.test(data.resolvedId)) item.resolvedYtId = data.resolvedId;
              changed = true;
            }
          }
          return changed;
        };
        if (syncTrackMetaInList(state.favorites)) {
          try { localStorage.setItem('devsize_favorites', JSON.stringify(state.favorites)); } catch (_) {}
        }
        if (Array.isArray(state.playlists)) {
          let plUpdated = false;
          for (const pl of state.playlists) {
            if (pl && syncTrackMetaInList(pl.tracks)) plUpdated = true;
          }
          if (plUpdated) {
            try { localStorage.setItem('devsize_playlists', JSON.stringify(state.playlists)); } catch (_) {}
          }
        }
      }

      if (!data || !data.success || !data.streamUrl) {
        if (!navigator.onLine) {
          showToast('Offline: this track is not available in local cache');
          throw new Error('Offline: track not cached locally');
        }
        throw new Error((data && data.error) || 'Failed to extract audio stream');
      }

      if (!isStaticTikTokTrack(track) && data.resolvedId && /^[a-zA-Z0-9_-]{11}$/.test(data.resolvedId)) {
        const prevTrackId = track.id;
        track.resolvedYtId = data.resolvedId;
        track.id = data.resolvedId;

        try {
          const pinnedList = safeJson('riff_sidebar_pinned_tracks', []);
          if (Array.isArray(pinnedList) && pinnedList.length > 0) {
            let updated = false;
            const isTarget = t => (prevTrackId && t.id === prevTrackId) ||
                                  isSameTrack(t, track) ||
                                  (t.title && track.title && typeof getTrackNormalizedKey === 'function' &&
                                   getTrackNormalizedKey(t.artist, t.title) === getTrackNormalizedKey(track.artist, track.title));
            if (state.currentTrackContext === 'sidebar-pinned' || pinnedList.some(isTarget)) {
              pinnedList.forEach(item => {
                if (isTarget(item)) {
                  item.id = data.resolvedId;
                  updated = true;
                }
              });
              if (updated) {
                localStorage.setItem('riff_sidebar_pinned_tracks', JSON.stringify(pinnedList.slice(0, 50)));
              }
            }
          }
        } catch (_) {}
      }

      if (hlsInstance) {
        hlsInstance.destroy();
        hlsInstance = null;
      }

      el.nativeAudio.preload = 'auto';

      const onNativeAudioErrorOnce = () => {
        const cur = track || state.currentTrack;
        const canRecover = cur && !cur._gaveUp && cur.platform !== 'local' && ((cur._retryCount || 0) <= 2 || (state._streamRecoverCount || 0) < 2);
        if (canRecover) return;
        state.isLoadingTrack = false;
        state.isPlaying = false;
        updatePlayPauseButton(false, false);
        if (el.trackLoadingOverlay) el.trackLoadingOverlay.classList.add('hidden');
        showToast('Could not load audio stream', 'error');
      };
      el.nativeAudio.addEventListener('error', onNativeAudioErrorOnce, { once: true });

      if (data.isHls && window.Hls && Hls.isSupported()) {
        hlsInstance = new Hls({ enableWorker: true, lowLatencyMode: true, maxBufferLength: 10, maxMaxBufferLength: 20, maxBufferSize: 4 * 1024 * 1024 });
        hlsInstance.on(Hls.Events.ERROR, (_, errData) => {
          if (errData && errData.fatal) {
            if (errData.type === Hls.ErrorTypes.NETWORK_ERROR) hlsInstance.startLoad();
            else if (errData.type === Hls.ErrorTypes.MEDIA_ERROR) hlsInstance.recoverMediaError();
          }
        });
        hlsInstance.loadSource(data.streamUrl);
        hlsInstance.attachMedia(el.nativeAudio);
        hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
          if (currentToken === state.loadToken) {
            playSmooth();
          }
        });
      } else {
        if (preloadAudioEl && track._preloadedStreamUrl && preloadAudioEl.src !== track._preloadedStreamUrl) { try { preloadAudioEl.removeAttribute('src'); preloadAudioEl.load(); } catch (_) {} }
        el.nativeAudio.src = data.streamUrl;
        playSmooth();
      }

      applyAudioSettings();
      ensureAutoplayBuffer();
    } catch (err) {
      state.isLoadingTrack = false;
      if (err.name === 'AbortError' && !didTimeoutAbort) return;
      if (currentToken === state.loadToken) {
        console.warn('Track playback notice:', err);
        state.isPlaying = false;
        updatePlayPauseButton(false, false);
        if (el.trackLoadingOverlay) el.trackLoadingOverlay.classList.add('hidden');
        showToast(didTimeoutAbort ? 'Stream request timed out' : (err.message || 'Could not load audio stream'), 'error');
      }
    } finally {
      clearTimeout(fetchAbortTimeout);
    }
    if (state.isRadioQueue && state.queue.length - 1 - state.queueIndex <= 3) ensureInfiniteWaveQueue();
    if (typeof autoplayEnabled === 'function' && autoplayEnabled()) ensureAutoplayBuffer();
  }


  function pauseSmooth() {
    saveLastPlaybackState();
    stopCrossfadeTail();
    state.isLoadingTrack = false;
    const curToken = ++smoothFadeToken;
    isPauseFading = true;
    frozenCurTime = (el.nativeAudio && Number.isFinite(el.nativeAudio.currentTime)) ? el.nativeAudio.currentTime : 0;
    state.isPlaying = false;
    document.body.classList.remove('is-playing');
    setPlayPauseState(false, true);
    if (el.btnPlayPause) el.btnPlayPause.classList.remove('buffering');
    if (el.playbarSpinner) el.playbarSpinner.classList.add('hidden');
    if (el.playIcon) el.playIcon.classList.remove('hidden');
    if (el.pauseIcon) el.pauseIcon.classList.remove('hidden');
    stopVisualizers();
    if (el.coverContainer) el.coverContainer.classList.remove('spinning');
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = state.isPlaying ? 'playing' : 'paused';
    }
    sendDiscordRpcUpdate(null, false);
    sendStateToServer();
    updateMediaSession();

    const audio = el.nativeAudio;
    if (isAppClosing || !audio || audio.paused) {
      isPauseFading = false;
      if (audioEngine && audioEngine.fadeGain && audioEngine.ctx) {
        try {
          audioEngine.fadeGain.gain.cancelScheduledValues(audioEngine.ctx.currentTime);
          audioEngine.fadeGain.gain.setValueAtTime(0, audioEngine.ctx.currentTime);
        } catch (e) {}
      }
      if (audio) {
        try { audio.pause(); } catch (e) {}
      }
      if (state.secondaryAudio) {
        try { state.secondaryAudio.pause(); } catch (e) {}
      }
      if (audioEngine && audioEngine.flushEffects) {
        audioEngine.flushEffects();
      }
      return;
    }

    if (audioEngine && audioEngine.fadeGain && audioEngine.ctx) {
      try {
        const ct = audioEngine.ctx.currentTime;
        audioEngine.fadeGain.gain.cancelScheduledValues(ct);
        audioEngine.fadeGain.gain.setTargetAtTime(0, ct, 0.035);
      } catch (e) {}
    }

    setTimeout(() => {
      if (curToken !== smoothFadeToken) return;
      if (audio) {
        try { audio.pause(); } catch (e) {}
      }
      if (state.secondaryAudio) {
        try { state.secondaryAudio.pause(); } catch (e) {}
      }
      if (audioEngine && audioEngine.flushEffects) {
        audioEngine.flushEffects();
      }
    }, 170);
  }

  async function playSmooth() {
    const curToken = ++smoothFadeToken;
    isPauseFading = false;
    state.isPlaying = true;
    document.body.classList.add('is-playing');
    setPlayPauseState(true, true);
    if (el.nativeAudio && el.nativeAudio.readyState >= 3) {
      if (el.btnPlayPause) el.btnPlayPause.classList.remove('buffering');
      if (el.playbarSpinner) el.playbarSpinner.classList.add('hidden');
    } else {
      setPlayPauseState(true, true);
    }
    if (el.playIcon) el.playIcon.classList.remove('hidden');
    if (el.pauseIcon) el.pauseIcon.classList.remove('hidden');

    initAudioContext();
    if (audioEngine && audioEngine.ctx && (audioEngine.ctx.state === 'suspended' || audioEngine.ctx.state === 'interrupted')) {
      audioEngine.ctx.resume().catch(() => {});
    }

    if (audioEngine && audioEngine.fadeGain && audioEngine.ctx) {
      try {
        const ct = audioEngine.ctx.currentTime;
        audioEngine.fadeGain.gain.cancelScheduledValues(ct);
        audioEngine.fadeGain.gain.setValueAtTime(1, ct);
      } catch (_) {}
    }

    applyAudioSettings();

    if (el.nativeAudio) {
      try {
        const playPromise = el.nativeAudio.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(e => {
            if (!el.nativeAudio.getAttribute('src') || !state.currentTrack || state.currentTrack._gaveUp) return;
            if (curToken !== smoothFadeToken || !el.nativeAudio?.paused) return;
            const errName = (e && e.name) ? e.name : '';
            const errMsg = (e && e.message) ? e.message : '';
            if (errName === 'AbortError') return;
            if (errName === 'NotSupportedError' || /no supported source|failed to load/i.test(errMsg)) {
              if (!activeStreamRecovery) {
                recoverCurrentStream((el.nativeAudio && Number.isFinite(el.nativeAudio.currentTime)) ? el.nativeAudio.currentTime : 0);
              }
              return;
            }
            console.warn('Play error:', e);
            state.isPlaying = false;
            updatePlayPauseButton(false, false);
            if (el.trackLoadingOverlay) el.trackLoadingOverlay.classList.add('hidden');
          });
        }
      } catch (e) {
        console.warn('Play error:', e);
      }
    }

    hasDrawnPausedFrame = false;
    startVisualizers();
    if (el.coverContainer && state.vfx.vinylSpin) el.coverContainer.classList.add('spinning');
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = state.isPlaying ? 'playing' : 'paused';
    }
    sendDiscordRpcUpdate(state.currentTrack, true);
    sendStateToServer();
    updateMediaSession();
    if (el.nativeAudio && el.nativeAudio.readyState < 3) {
      watchPlaybackStall();
    }
  }

  window.pauseSmooth = pauseSmooth;
  window.playSmooth = playSmooth;

  async function startWaveIfIdle() {
    if (state.currentTrack) return false;
    if (!Array.isArray(state.vibeTracks) || state.vibeTracks.length === 0) {
      if (typeof fetchPersonalVibe === 'function') {
        await fetchPersonalVibe();
      }
    }
    if (Array.isArray(state.vibeTracks) && state.vibeTracks.length > 0) {
      state.queue = [...state.vibeTracks];
      state.queueIndex = 0;
      state.isRadioQueue = true;
      playTrack(state.queue[0], state.queue, 0);
      return true;
    }
    return false;
  }

  function togglePlayPause() {
    if (!state.currentTrack) {
      startWaveIfIdle();
      return;
    }
    if (state.currentTrack && (!el.nativeAudio || !el.nativeAudio.getAttribute('src'))) {
      const resumeSec = state._pendingResumeTime || 0;
      state._pendingResumeTime = 0;
      playTrack(state.currentTrack, state.queue, state.queueIndex).then(() => {
        if (resumeSec > 0 && el.nativeAudio) {
          const applyResume = () => { try { el.nativeAudio.currentTime = resumeSec; } catch (_) {} };
          if (el.nativeAudio.readyState >= 1) applyResume();
          else el.nativeAudio.addEventListener('loadedmetadata', applyResume, { once: true });
        }
      });
      return;
    }
    if (state.isLoadingTrack) {
      if (state.currentAbortController) {
        try { state.currentAbortController.abort(); } catch (_) {}
      }
      state.isLoadingTrack = false;
      pauseSmooth();
      updatePlayPauseButton(false, false);
      return;
    }
    if (state.isPlaying) {
      pauseSmooth();
    } else {
      playSmooth();
    }
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'MediaPlayPause' || e.key === 'MediaPlayPause') {
      e.preventDefault();
      e.stopImmediatePropagation();
      togglePlayPause();
      return;
    }
    if (e.code === 'MediaTrackNext' || e.key === 'MediaTrackNext') {
      e.preventDefault();
      e.stopImmediatePropagation();
      playNext();
      return;
    }
    if (e.code === 'MediaTrackPrevious' || e.key === 'MediaTrackPrevious') {
      e.preventDefault();
      e.stopImmediatePropagation();
      playPrev();
      return;
    }
    if (e.code === 'MediaStop' || e.key === 'MediaStop') {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (state.isPlaying) pauseSmooth();
      return;
    }

    const isMod = e.ctrlKey || e.metaKey;
    if (isMod && (e.shiftKey || e.altKey)) {
      if (e.code === 'Space') {
        e.preventDefault();
        e.stopImmediatePropagation();
        togglePlayPause();
        return;
      }
      if (e.code === 'ArrowRight') {
        e.preventDefault();
        e.stopImmediatePropagation();
        playNext();
        return;
      }
      if (e.code === 'ArrowLeft') {
        e.preventDefault();
        e.stopImmediatePropagation();
        playPrev();
        return;
      }
      if (e.code === 'ArrowUp') {
        e.preventDefault();
        e.stopImmediatePropagation();
        const audio = (state.secondaryAudio && !state.secondaryAudio.paused) ? state.secondaryAudio : el.nativeAudio;
        if (audio) audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 5);
        return;
      }
      if (e.code === 'ArrowDown') {
        e.preventDefault();
        e.stopImmediatePropagation();
        const audio = (state.secondaryAudio && !state.secondaryAudio.paused) ? state.secondaryAudio : el.nativeAudio;
        if (audio) audio.currentTime = Math.max(0, audio.currentTime - 5);
        return;
      }
    }

    if (!runKeyboardShortcut(e)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const active = document.activeElement;
    if (active && (active.tagName === 'BUTTON' || active.classList.contains('track-row')) && typeof active.blur === 'function') active.blur();
  }, true);

  function recordPlayedIndex(idx) {
    if (typeof idx !== 'number' || idx < 0) return;
    const h = state.queueHistory;
    if (h[h.length - 1] !== idx) h.push(idx);
    if (h.length > 200) h.shift();
  }


  function autoplayEnabled() {
    return getAdv('autoplay', true);
  }

  function autoplayArtistList(track) {
    return String((track && track.artist) || '')
      .split(/,|&| feat\.? | ft\.? | x /i)
      .map(a => a.trim())
      .filter(Boolean);
  }

  async function buildAutoplayCandidates() {
    const port = state.serverPort || 38472;
    const queue = (state.queue || []).filter(Boolean);
    const seenIds = new Set();
    const seenKeys = new Set();
    const remember = (t) => {
      const id = getTrackCanonicalId(t);
      if (id) seenIds.add(id);
      const k = getTrackNormalizedKey(t.artist, t.title);
      if (k) seenKeys.add(k);
    };
    queue.forEach(remember);
    (state.history || []).slice(0, 60).forEach(t => { if (t) remember(t); });

    const usable = (t) => {
      if (!t || !t.title) return false;
      if (isTrackBlocked(t) || isArtistBlocked(t.artist)) return false;
      const id = getTrackCanonicalId(t);
      const k = getTrackNormalizedKey(t.artist, t.title);
      if ((id && seenIds.has(id)) || (k && seenKeys.has(k))) return false;
      return true;
    };

    const current = state.currentTrack || queue[queue.length - 1];
    const ordered = [];
    const counts = new Map();
    autoplayArtistList(current).forEach(a => ordered.push(a));
    queue.forEach(t => autoplayArtistList(t).forEach(a => counts.set(a, (counts.get(a) || 0) + 1)));
    Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).forEach(([a]) => {
      if (!ordered.some(x => x.toLowerCase() === a.toLowerCase())) ordered.push(a);
    });
    const queueArtists = new Set(ordered.map(a => normalizeArtistName(a)));

    const fetchJson = async (url, options, ms) => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), ms);
      try {
        const res = await fetch(url, Object.assign({ signal: ctrl.signal }, options || {}));
        return await res.json();
      } finally {
        clearTimeout(timer);
      }
    };

    const sameArtist = [];
    const artistJobs = ordered.slice(0, 4).map(name =>
      fetchJson(`http://127.0.0.1:${port}/api/artist?name=${encodeURIComponent(name)}`, null, 8000)
        .then(data => (data && data.success && data.artist && Array.isArray(data.artist.tracks)) ? data.artist.tracks : [])
        .catch(() => [])
    );
    const artistResults = await Promise.all(artistJobs);
    artistResults.forEach(list => {
      const fresh = list.filter(t => usable(t) && !isTrackFavorited(t));
      fresh.slice(0, 3).forEach(t => {
        if (usable(t)) {
          sameArtist.push(t);
          remember(t);
        }
      });
    });

    let wave = [];
    try {
      const taste = await computeTasteProfile();
      const data = await fetchJson(`http://127.0.0.1:${port}/api/vibe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: 'youtube',
          limit: 12,
          clientProfile: taste,
          seeds: taste.seeds || [],
          avoid: getWaveAvoid()
        })
      }, 9000);
      if (data && data.success && Array.isArray(data.tracks)) {
        wave = data.tracks.filter(t => usable(t) && !autoplayArtistList(t).some(a => queueArtists.has(normalizeArtistName(a))));
        wave.forEach(remember);
      }
    } catch (_) {}

    return sameArtist.slice(0, 2).concat(wave, sameArtist.slice(2));
  }

  async function ensureAutoplayBuffer() {
    if (!autoplayEnabled() || !state.currentTrack) return;
    if (!Array.isArray(state.queue)) state.queue = [];
    if (!Array.isArray(state._autoplayPool)) state._autoplayPool = [];

    const popFromPoolToQueue = () => {
      let popped = false;
      while ((state.queue.length - 1 - state.queueIndex) < 5 && state._autoplayPool.length > 0) {
        const cand = state._autoplayPool.shift();
        if (!cand || !cand.title) continue;
        if (typeof isTrackBlocked === 'function' && isTrackBlocked(cand)) continue;
        if (typeof isArtistBlocked === 'function' && isArtistBlocked(cand.artist)) continue;
        if (typeof isTrackFailedOrUnavailable === 'function' && isTrackFailedOrUnavailable(cand)) continue;

        const candKey = (cand.artist && cand.title && typeof getTrackNormalizedKey === 'function')
          ? getTrackNormalizedKey(cand.artist, cand.title)
          : '';
        const candId = (typeof getTrackCanonicalId === 'function' ? getTrackCanonicalId(cand) : '') || cand.id;

        const alreadyInQueue = state.queue.some(existing => {
          if (!existing) return false;
          const eId = (typeof getTrackCanonicalId === 'function' ? getTrackCanonicalId(existing) : '') || existing.id;
          if (candId && eId && candId === eId) return true;
          if (candKey && existing.artist && existing.title && typeof getTrackNormalizedKey === 'function') {
            if (getTrackNormalizedKey(existing.artist, existing.title) === candKey) return true;
          }
          if (typeof isDuplicateOrVariantTrack === 'function' && isDuplicateOrVariantTrack(cand, existing)) return true;
          return false;
        });

        if (alreadyInQueue) continue;

        cand._isAutoplay = true;
        state.queue.push(cand);
        popped = true;
      }
      return popped;
    };

    const didPop = popFromPoolToQueue();
    if (didPop) {
      if (typeof updateQueueBadge === 'function') updateQueueBadge();
      if (state.currentView === 'queue' && typeof renderQueueView === 'function') {
        renderQueueView();
      }
      if (typeof window.refreshQueuePanel === 'function') {
        window.refreshQueuePanel();
      }
      if (typeof currentSidebarLibFilter !== 'undefined' && currentSidebarLibFilter === 'queue' && typeof renderSidebarLibraryFeed === 'function') {
        renderSidebarLibraryFeed(false);
      }
    }

    if ((state.queue.length - 1 - state.queueIndex) >= 5 && state._autoplayPool.length >= 3) {
      prefetchUpcomingQueueStreams();
      return;
    }

    if (((state.queue.length - 1 - state.queueIndex) < 5 || state._autoplayPool.length < 3) && !state._autoplayBuffering) {
      state._autoplayBuffering = true;
      try {
        const port = state.serverPort || 38472;
        const seeds = (state._autoplayAnchorSeeds && state._autoplayAnchorSeeds.length)
          ? state._autoplayAnchorSeeds
          : [{
              artist: state.currentTrack.artist || '',
              title: state.currentTrack.title || '',
              id: state.currentTrack.id || '',
              weight: 3
            }];
        if (!state._autoplayAnchorSeeds || !state._autoplayAnchorSeeds.length) {
          state._autoplayAnchorSeeds = seeds;
        }

        const avoidIds = new Set();
        const avoidKeys = new Set();
        const blockedArtists = typeof getBlockedArtists === 'function' ? getBlockedArtists() : [];

        const addAvoid = (t) => {
          if (!t) return;
          const id = (typeof getTrackCanonicalId === 'function' ? getTrackCanonicalId(t) : '') || t.id;
          if (id) avoidIds.add(id);
          const key = (t.artist && t.title && typeof getTrackNormalizedKey === 'function')
            ? getTrackNormalizedKey(t.artist, t.title)
            : '';
          if (key) avoidKeys.add(key);
        };

        (state.queue || []).forEach(addAvoid);
        (state._autoplayPool || []).forEach(addAvoid);
        (Array.isArray(state.history) ? state.history.slice(0, 40) : []).forEach(addAvoid);

        const payload = {
          platform: 'youtube',
          limit: 15,
          refresh: true,
          history: [],
          favorites: [],
          seeds,
          avoid: {
            ids: Array.from(avoidIds),
            keys: Array.from(avoidKeys),
            artists: blockedArtists
          }
        };

        const res = await fetch(`http://127.0.0.1:${port}/api/vibe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!autoplayEnabled() || !state.currentTrack) return;

        if (data && data.success && Array.isArray(data.tracks) && data.tracks.length > 0) {
          for (const tr of data.tracks) {
            if (!tr || !tr.title) continue;
            if (typeof isTrackBlocked === 'function' && isTrackBlocked(tr)) continue;
            if (typeof isArtistBlocked === 'function' && isArtistBlocked(tr.artist)) continue;
            if (typeof isTrackFailedOrUnavailable === 'function' && isTrackFailedOrUnavailable(tr)) continue;

            const trKey = (tr.artist && tr.title && typeof getTrackNormalizedKey === 'function')
              ? getTrackNormalizedKey(tr.artist, tr.title)
              : '';
            const trId = (typeof getTrackCanonicalId === 'function' ? getTrackCanonicalId(tr) : '') || tr.id;

            const matchesTrack = (existing) => {
              if (!existing) return false;
              const eId = (typeof getTrackCanonicalId === 'function' ? getTrackCanonicalId(existing) : '') || existing.id;
              if (trId && eId && trId === eId) return true;
              if (trKey && existing.artist && existing.title && typeof getTrackNormalizedKey === 'function') {
                if (getTrackNormalizedKey(existing.artist, existing.title) === trKey) return true;
              }
              if (typeof isDuplicateOrVariantTrack === 'function' && isDuplicateOrVariantTrack(tr, existing)) return true;
              return false;
            };

            if (state.queue.some(matchesTrack)) continue;
            if (state._autoplayPool.some(matchesTrack)) continue;

            state._autoplayPool.push(tr);
          }

          const addedMore = popFromPoolToQueue();
          if (addedMore || didPop) {
            if (typeof updateQueueBadge === 'function') updateQueueBadge();
            if (state.currentView === 'queue' && typeof renderQueueView === 'function') {
              renderQueueView();
            }
            if (typeof window.refreshQueuePanel === 'function') {
              window.refreshQueuePanel();
            }
            if (typeof currentSidebarLibFilter !== 'undefined' && currentSidebarLibFilter === 'queue' && typeof renderSidebarLibraryFeed === 'function') {
              renderSidebarLibraryFeed(false);
            }
          }
        }
      } catch (err) {
        console.warn('Autoplay buffer error:', err);
      } finally {
        state._autoplayBuffering = false;
        if (state.queue && state.queueIndex < state.queue.length - 1) {
          prefetchUpcomingQueueStreams();
        }
      }
    } else {
      if (state.queue && state.queueIndex < state.queue.length - 1) {
        prefetchUpcomingQueueStreams();
      }
    }
  }

  function prepareAutoplay() {
    if (!autoplayEnabled() || !state.currentTrack) return null;
    const key = getTrackCanonicalId(state.currentTrack) + '|' + state.queue.length;
    if (state._autoplayKey === key && state._autoplayPromise) return state._autoplayPromise;
    state._autoplayKey = key;
    state._autoplayPromise = buildAutoplayCandidates().catch(() => []);
    return state._autoplayPromise;
  }

  function maybePrepareAutoplay() {
    if (!autoplayEnabled() || state.isRadioQueue || state.isShuffle || state.isRepeat) return;
    if (!state.currentTrack || !Array.isArray(state.queue) || state.queue.length === 0) return;
    ensureAutoplayBuffer();
    if (state.queueIndex + 1 < state.queue.length) return;
    prepareAutoplay();
  }

  async function startAutoplay() {
    const pending = prepareAutoplay();
    if (!pending) return false;
    const found = await Promise.race([pending, new Promise(r => setTimeout(() => r(null), 4000))]);
    if (!Array.isArray(found) || found.length === 0) return false;
    const startIdx = state.queue.length;
    state.queue.push(...found);
    state.isRadioQueue = true;
    state._autoplayPromise = null;
    state._autoplayKey = '';
    if (typeof updateQueueBadge === 'function') updateQueueBadge();
    state.queueIndex = startIdx;
    recordPlayedIndex(startIdx);
    playTrack(state.queue[startIdx]);
    showToast('Autoplay: similar tracks');
    return true;
  }

  var _isSkippingNext = false;
  async function playNext() {
    if (_isSkippingNext) return;
    if (syncState && syncState.active) return;
    if (state.queue.length === 0) return;
    _isSkippingNext = true;

    try {
      if (!state._isNaturalEnding && state.myWaveActive && state.currentTrack) {
        const cur = (el.nativeAudio && typeof el.nativeAudio.currentTime === 'number') ? el.nativeAudio.currentTime : 0;
        if (cur < 12 && typeof recordWaveSkip === 'function') {
          recordWaveSkip(state.currentTrack);
          state._skipRecordedFor = (typeof getTrackCanonicalId === 'function' ? getTrackCanonicalId(state.currentTrack) : '') || state.currentTrack.id;
        }
      }

      if (state.isRadioQueue && state.queueIndex + 1 >= state.queue.length) {
        await ensureInfiniteWaveQueue(true);
        if (state.queueIndex + 1 < state.queue.length) {
          let nextIdx = state.queueIndex + 1;
          while (nextIdx < state.queue.length && (isTrackBlocked(state.queue[nextIdx]) || isArtistBlocked(state.queue[nextIdx]?.artist))) {
            nextIdx++;
          }
          if (nextIdx < state.queue.length) {
            state.queueIndex = nextIdx;
            recordPlayedIndex(nextIdx);
            playTrack(state.queue[nextIdx], state.queue, nextIdx, state.currentTrackContext);
            return;
          }
        }
      }

      if (!state.isRadioQueue && !state.isShuffle && state.queueIndex + 1 >= state.queue.length && autoplayEnabled()) {
        if (await startAutoplay()) return;
      }

      if (state.isShuffle) {
        const provider = shuffleProvider;
        let nextIdx = -1;
        if (provider) {
          try {
            const pick = await provider.fn({
              queue: state.queue.slice(),
              queueIndex: state.queueIndex,
              context: state.currentTrackContext,
              current: state.currentTrack
            });
            if (pick) nextIdx = state.queue.findIndex(track => isSameTrack(track, pick));
            if (nextIdx >= 0 && (isTrackBlocked(state.queue[nextIdx]) || isArtistBlocked(state.queue[nextIdx]?.artist))) {
              nextIdx = -1;
            }
          } catch (e) {
            reportPluginError(provider.file, e);
          }
        }
        if (state.queue.length === 0) return;
        if (nextIdx < 0) {
          const eligible = state.queue.map((track, index) => index)
            .filter(index => !isTrackBlocked(state.queue[index]) && !isArtistBlocked(state.queue[index]?.artist));
          if (eligible.length === 0) return;
          if (!state._shufflePlayedIndices) state._shufflePlayedIndices = new Set();
          if (!state._shufflePlayedIds) state._shufflePlayedIds = new Set();
          if (state.queueIndex >= 0) state._shufflePlayedIndices.add(state.queueIndex);
          if (state.currentTrack) {
            const curCid = getTrackCanonicalId(state.currentTrack);
            if (curCid) state._shufflePlayedIds.add(curCid);
          }
          let pool = eligible.filter(index => {
            if (state._shufflePlayedIndices.has(index)) return false;
            const cid = getTrackCanonicalId(state.queue[index]);
            if (cid && state._shufflePlayedIds.has(cid)) return false;
            return true;
          });
          if (pool.length === 0) {
            state._shufflePlayedIndices.clear();
            state._shufflePlayedIds.clear();
            pool = eligible.length > 1 ? eligible.filter(index => index !== state.queueIndex) : eligible;
          }
          nextIdx = pool[Math.floor(Math.random() * pool.length)];
          state._shufflePlayedIndices.add(nextIdx);
          const nextCid = getTrackCanonicalId(state.queue[nextIdx]);
          if (nextCid) state._shufflePlayedIds.add(nextCid);
        }
        state.queueIndex = nextIdx;
        recordPlayedIndex(nextIdx);
        playTrack(state.queue[nextIdx], state.queue, nextIdx, state.currentTrackContext);
        return;
      }

      let nextIdx = state.queueIndex + 1;
      let attempts = 0;
      while (attempts < state.queue.length) {
        if (nextIdx >= state.queue.length) {
          if (state.myWaveActive && typeof extendMyWaveQueue === 'function') {
            extendMyWaveQueue().then(added => {
              if (added && state.queueIndex + 1 < state.queue.length) {
                playNext();
              }
            });
            return;
          }
          nextIdx = 0;
        }
        const candidate = state.queue[nextIdx];
        if (candidate && (isTrackBlocked(candidate) || isArtistBlocked(candidate.artist))) {
          nextIdx++;
          attempts++;
          continue;
        }
        break;
      }
      state.queueIndex = nextIdx;
      recordPlayedIndex(nextIdx);
      playTrack(state.queue[nextIdx], state.queue, nextIdx, state.currentTrackContext);

      if (state.myWaveActive && state.queueIndex >= state.queue.length - 3 && typeof extendMyWaveQueue === 'function') {
        extendMyWaveQueue();
      }
    } finally {
      setTimeout(() => { _isSkippingNext = false; }, 320);
    }
  }

  function playPrev() {
    if (syncState && syncState.active) return;
    if (el.nativeAudio && el.nativeAudio.currentTime > 3) {
      el.nativeAudio.currentTime = 0;
      return;
    }
    {
      const h = state.playHistory || [];
      if (h.length) {
        const prev = h.pop();
        navigatingBack = true;
        try { playTrack(prev); } finally { navigatingBack = false; }
        const prevIdx = state.queue.findIndex(t => t.id === prev.id || isSameTrack(t, prev));
        if (prevIdx !== -1) state.queueIndex = prevIdx;
        return;
      }
    }
    if (state.queue.length === 0) return;

    const h = state.queueHistory;
    if (h.length > 1) {
      h.pop();
      const prevIdx = h[h.length - 1];
      if (prevIdx >= 0 && prevIdx < state.queue.length) {
        state.queueIndex = prevIdx;
        playTrack(state.queue[prevIdx]);
        return;
      }
      h.push(state.queueIndex);
    }


    let prevIdx = state.queueIndex - 1;
    if (prevIdx < 0) prevIdx = state.queue.length - 1;
    state.queueIndex = prevIdx;
    state.queueHistory = [prevIdx];
    playTrack(state.queue[prevIdx]);
  }

  if (el.nativeAudio) {
    el.nativeAudio.addEventListener('volumechange', () => {
      if (!el.nativeAudio) return;
      const extMuted = !!el.nativeAudio.muted;
      const extVol = Math.round(el.nativeAudio.volume * 100) / 100;
      

      

      if (audioEngine && Number.isFinite(audioEngine.appliedElementVolume) &&
          Math.abs(el.nativeAudio.volume - audioEngine.appliedElementVolume) < 0.005) return;
      if (extMuted !== state.isMuted || (!extMuted && Math.abs(extVol - state.volume * state.volume) > 0.015)) {
        state.isMuted = extMuted;
        if (!extMuted) state.volume = Math.sqrt(extVol);
        if (el.volumeSlider) el.volumeSlider.value = String(state.volume);
        if (el.volumeIcon) el.volumeIcon.classList.toggle('hidden', state.isMuted);
        if (el.volumeMutedIcon) el.volumeMutedIcon.classList.toggle('hidden', !state.isMuted);
        persistVolumeState();
        if (audioEngine) {
          audioEngine.volume = state.volume;
          audioEngine.isMuted = state.isMuted;
        }
      }
    });

    el.nativeAudio.addEventListener('error', () => {
      if (!el.nativeAudio.getAttribute('src') || !state.currentTrack || state.currentTrack._gaveUp) return;
      clearPlaybackStallTimer();
      const pos = (el.nativeAudio && Number.isFinite(el.nativeAudio.currentTime)) ? el.nativeAudio.currentTime : 0;
      recoverCurrentStream(pos);
    });

    el.nativeAudio.addEventListener('waiting', () => {
      updatePlayPauseButton(state.isPlaying, true);
      if (!el.nativeAudio.paused) watchPlaybackStall();
    });

    el.nativeAudio.addEventListener('stalled', () => {
      if (!el.nativeAudio.paused) watchPlaybackStall();
    });

    el.nativeAudio.addEventListener('playing', () => {
      state.isLoadingTrack = false;
      clearPlaybackStallTimer();
      state.isPlaying = true;
      state.consecutivePlayFailures = 0;
      if (state.currentTrack) state.currentTrack._retryCount = 0;
      preloadedTrack10sFired = true;
      applyAudioSettings();
      prefetchUpcomingQueueStreams();
      document.body.classList.add('is-playing');
      updatePlayPauseButton(true, false);
    });

    el.nativeAudio.addEventListener('canplay', () => {
      applyAudioSettings();
      updatePlayPauseButton(state.isPlaying, false);
    });

    el.nativeAudio.addEventListener('loadstart', () => {
      state.audioDurationStale = true;
    });

    el.nativeAudio.addEventListener('loadedmetadata', () => {
      state.audioDurationStale = false;
      applyAudioSettings();
      try {
        const tr = getTrackTrim(state.currentTrack);
        if (tr && Number.isFinite(tr.end) && tr.end > (tr.start || 0) + 1.5 && el.nativeAudio.currentTime < tr.start) {
          el.nativeAudio.currentTime = tr.start;
        }
      } catch (_) {}
      const audio = el.nativeAudio;
      const metaDur = (state.currentTrack && Number.isFinite(state.currentTrack.duration) && state.currentTrack.duration > 0) ? state.currentTrack.duration : 0;
      const audioDur = (audio && Number.isFinite(audio.duration) && audio.duration > 1) ? audio.duration : 0;
      if (state.currentTrack && audioDur > 1 && isTrackDurationCompatible(metaDur, audioDur)) {
        const newDur = Math.round(audioDur);
        state.currentTrack.duration = newDur;
        const tid = state.currentTrack.id;
        if (Array.isArray(state.queue)) {
          state.queue.forEach((t) => { if (t && t.id === tid) t.duration = newDur; });
        }
        if (Array.isArray(state.playlists)) {
          state.playlists.forEach((p) => {
            if (p && Array.isArray(p.tracks)) {
              p.tracks.forEach((t) => { if (t && t.id === tid) t.duration = newDur; });
            }
          });
        }
      }
      const d = formatDuration(getReliableTrackDuration());
      if (el.timeDuration) el.timeDuration.textContent = d;
      if (el.tvkTimeDuration) el.tvkTimeDuration.textContent = d;
      if (typeof updateTopMomentPin === 'function') updateTopMomentPin();
    });

    el.nativeAudio.addEventListener('play', () => {
      try { onLastFmTrackStart(state.currentTrack); } catch (_) {}
      try {
        const tr = getTrackTrim(state.currentTrack);
        if (tr && Number.isFinite(tr.end) && tr.end > (tr.start || 0) + 1.5 && el.nativeAudio.currentTime < tr.start) {
          el.nativeAudio.currentTime = tr.start;
        }
      } catch (_) {}
      emitPluginEvent('play');
      if (!hasNotifiedMediaKeysActive) {
        hasNotifiedMediaKeysActive = true;
        if (window.electronAPI && window.electronAPI.mediaKeysActive) {
          window.electronAPI.mediaKeysActive();
        }
      }
      updatePlayPauseButton(true, false);
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = state.isPlaying ? 'playing' : 'paused';
      }
      if (!state.isPlaying) {
        state.isPlaying = true;
        document.body.classList.add('is-playing');
        if (el.coverContainer && state.vfx.vinylSpin) el.coverContainer.classList.add('spinning');
        if ('mediaSession' in navigator) {
          navigator.mediaSession.playbackState = state.isPlaying ? 'playing' : 'paused';
        }
        sendDiscordRpcUpdate(state.currentTrack, true);
        sendStateToServer();
        updateMediaSession();
      }
      updateMediaPositionState();
      if (el.trackLoadingOverlay) el.trackLoadingOverlay.classList.add('hidden');
      hasDrawnPausedFrame = false;
      if (!animationFrameId) startVisualizers();
      if (audioEngine) {
        if (audioEngine.resumeAudioContext) audioEngine.resumeAudioContext();
        audioEngine._applyMasterVolume();
      }
      if (crossfadeFadeInPending) {
        crossfadeFadeInPending = false;
        const X = parseInt(localStorage.getItem('riff_crossfade') || '0', 10);
        if (X > 0 && audioEngine) audioEngine.fadeIn(X);
      }
      if (typeof m3cStart === 'function') m3cStart();
    });

    el.nativeAudio.addEventListener('pause', () => {
      if (state.isLoadingTrack || activeStreamRecovery) return;
      clearPlaybackStallTimer();
      isPauseFading = false;
      emitPluginEvent('pause');
      updatePlayPauseButton(false, false);
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = state.isPlaying ? 'playing' : 'paused';
      }
      if (state.isPlaying) {
        state.isPlaying = false;
        document.body.classList.remove('is-playing');
        if (el.coverContainer) el.coverContainer.classList.remove('spinning');
        if ('mediaSession' in navigator) {
          navigator.mediaSession.playbackState = state.isPlaying ? 'playing' : 'paused';
        }
        sendDiscordRpcUpdate(null, false);
        sendStateToServer();
        updateMediaSession();
      }
      updateMediaPositionState();
      if (audioEngine) {
        if (audioEngine.suspendAudioContextDebounced) audioEngine.suspendAudioContextDebounced(5000);
        if (audioEngine.setAnalyserEnabled) audioEngine.setAnalyserEnabled(false);
      }
      if (typeof applyM3Cover === 'function') applyM3Cover();
    });

    el.nativeAudio.addEventListener('ended', () => {
      if (state.isLoadingTrack) return;
      updatePlayPauseButton(false, false);
      if (state.sleepTimer && state.sleepTimer.mode === 'end') {
        state.sleepTimer = null;
        updateSleepTimerUI();
        return;
      }
      if (audioEngine) {
        if (audioEngine.suspendAudioContextDebounced) audioEngine.suspendAudioContextDebounced(5000);
        if (audioEngine.setAnalyserEnabled) audioEngine.setAnalyserEnabled(false);
      }
      if (syncState && syncState.active) {
        pauseSmooth();
        return;
      }
      if (state.isRepeat) {
        el.nativeAudio.currentTime = 0;
        playSmooth();
      } else {
        const expectedDur = getReliableTrackDuration();
        const pos = el.nativeAudio.currentTime || 0;
        if (state.currentTrack && state.currentTrack.platform !== 'local' && expectedDur > 25 && pos < expectedDur - 12 && (state._streamRecoverCount || 0) < 2) {
          state._streamRecoverCount = (state._streamRecoverCount || 0) + 1;
          delete state.currentTrack._preloadedStreamUrl;
          recoverCurrentStream(pos);
          return;
        }
        state._isNaturalEnding = true;
        try {
          playNext();
        } finally {
          state._isNaturalEnding = false;
        }
      }
    });

    el.nativeAudio.addEventListener('durationchange', () => {
      const audio = el.nativeAudio;
      const metaDur = (state.currentTrack && Number.isFinite(state.currentTrack.duration) && state.currentTrack.duration > 0) ? state.currentTrack.duration : 0;
      const audioDur = (!state.audioDurationStale && audio && Number.isFinite(audio.duration) && audio.duration > 1) ? audio.duration : 0;
      if (state.currentTrack && audioDur > 1 && isTrackDurationCompatible(metaDur, audioDur)) {
        const newDur = Math.round(audioDur);
        state.currentTrack.duration = newDur;
        const tid = state.currentTrack.id;
        if (Array.isArray(state.queue)) {
          state.queue.forEach((t) => { if (t && t.id === tid) t.duration = newDur; });
        }
        if (Array.isArray(state.playlists)) {
          state.playlists.forEach((p) => {
            if (p && Array.isArray(p.tracks)) {
              p.tracks.forEach((t) => { if (t && t.id === tid) t.duration = newDur; });
            }
          });
        }
      }
      if (el.timeDuration) el.timeDuration.textContent = formatDuration(getReliableTrackDuration());
      if (el.tvkTimeDuration) el.tvkTimeDuration.textContent = formatDuration(getReliableTrackDuration());
      updateMediaPositionState();
      if (typeof updateTopMomentPin === 'function') updateTopMomentPin();
    });

    el.nativeAudio.addEventListener('seeked', () => {
      lastKnownAudioTime = el.nativeAudio.currentTime || 0;
      lastAudioTimePerf = performance.now();
      updateMediaPositionState();
      state.forceLyricsScroll = true;
      state.forceSnapLyrics = true;
      state.lastActiveLyricIdx = -1;
      if (state.isRightPanelOpen || state.isTvKaraokeOpen) {
        updateSyncedLyricsHighlight(el.nativeAudio.currentTime || 0);
      }
      sendDiscordRpcUpdate(state.currentTrack, true);
    });

    var lastTimeupdateSec = -1;
    var lastPlaybackStateSaveTime = 0;
    el.nativeAudio.addEventListener('timeupdate', () => {
      if (state.isLoadingTrack) return;
      lastKnownAudioTime = el.nativeAudio.currentTime || 0;
      lastAudioTimePerf = performance.now();
      if (Date.now() - lastPlaybackStateSaveTime >= 5000) {
        lastPlaybackStateSaveTime = Date.now();
        saveLastPlaybackState();
      }
      if (!preloadedTrack10sFired && el.nativeAudio && el.nativeAudio.currentTime >= 10) {
        preloadedTrack10sFired = true;
        prefetchUpcomingQueueStreams();
      }
      try { onLastFmTimeUpdate(); } catch (_) {}
      updateMediaPositionState();
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

      const cur = (el.nativeAudio && Number.isFinite(el.nativeAudio.currentTime)) ? el.nativeAudio.currentTime : 0;
      const dur = getReliableTrackDuration();

      const X = parseInt(localStorage.getItem('riff_crossfade') || '0', 10);
      if (!state.isLoadingTrack && state.isPlaying && X > 0 && !crossfadeTriggered && !state.isRepeat && dur > Math.max(X * 2, 20) && cur >= dur - X && (!audioEngine || !audioEngine.isLiveStream(el.nativeAudio))) {
        crossfadeTriggered = true;
        crossfadeFadeInPending = true;
        startCrossfadeTailFromCurrent(X);
        state._isNaturalEnding = true;
        try {
          playNext();
        } finally {
          state._isNaturalEnding = false;
        }
      }

      if (state.isPlaying && cur > 5 && !state.nextTrackPrefetched) {
        state.nextTrackPrefetched = true;
        prefetchNextQueueTrack();
        maybePrepareAutoplay();
      }

      if (!state.isPlaying && typeof m3cDraw === 'function' && typeof m3cEnabled === 'function' && m3cEnabled()) {
        m3cDraw(performance.now());
      }

      if (isPauseFading || isDraggingScrubber) return;
      const roundedSec = Math.floor(cur);
      if (lastTimeupdateSec === roundedSec) return;
      lastTimeupdateSec = roundedSec;
      if (state.isRightPanelOpen || state.isTvKaraokeOpen) {
        updateSyncedLyricsHighlight(cur);
      }
      const curFormatted = formatDuration(cur);
      const durFormatted = formatDuration(dur);
      if (el.timeCurrent) el.timeCurrent.textContent = curFormatted;
      if (el.tvkTimeCurrent) el.tvkTimeCurrent.textContent = curFormatted;
      if (el.timeDuration) el.timeDuration.textContent = durFormatted;
      if (el.tvkTimeDuration) el.tvkTimeDuration.textContent = durFormatted;
      if (el.tvkSeekSlider && !isDraggingTvkSeek && dur > 0) {
        el.tvkSeekSlider.value = Math.round((cur / dur) * 1000);
      }
    });
  }

  var isDraggingScrubber = false;
  var isHoveringScrubber = false;
  var isHoveringTvkScrubber = false;


  var streamPrefetchQueue = [];
  var streamPrefetchActive = 0;
  var STREAM_PREFETCH_MAX = 2;
  var SEARCH_STREAM_PREFETCH_LIMIT = 4;
  var prefetchedTrackKeys = new Set();

  function pumpStreamPrefetch() {
    while (streamPrefetchActive < STREAM_PREFETCH_MAX && streamPrefetchQueue.length) {
      const { run } = streamPrefetchQueue.shift();
      streamPrefetchActive++;
      run().finally(() => { streamPrefetchActive--; pumpStreamPrefetch(); });
    }
  }

  function clearQueuedStreamPrefetch() {
    streamPrefetchQueue.splice(0).forEach(({ key }) => prefetchedTrackKeys.delete(key));
  }

  function prioritizeTrackStream(track) {
    if (!track || track._preloadedStreamUrl) return;
    const key = getTrackCanonicalId ? getTrackCanonicalId(track) : (track.id || track.url || (track.artist + '_' + track.title));
    const queuedIndex = streamPrefetchQueue.findIndex(job => job.key === key);
    if (queuedIndex < 0) return;
    streamPrefetchQueue.splice(queuedIndex, 1);
    prefetchedTrackKeys.delete(key);
  }

  function enqueueStreamPrefetch(track) {
    if (!track || track.platform === 'local' || isStaticTikTokTrack(track)) return;
    if (track._preloadedStreamUrl) return;
    const key = getTrackCanonicalId ? getTrackCanonicalId(track) : (track.id || track.url || (track.artist + '_' + track.title));
    if (!key || prefetchedTrackKeys.has(key)) return;
    prefetchedTrackKeys.add(key);
    streamPrefetchQueue.push({ key, run: () => {
      const quality = localStorage.getItem('riff_audio_quality') || 'medium';
      const qQuality = encodeURIComponent(quality);
      const qSearch = encodeURIComponent(track.searchQuery || ((track.artist ? track.artist + ' - ' : '') + (track.title || '')));
      const isRiffStream = localStorage.getItem('riff_library_streaming') === '1' ? '&riffStream=1' : '';
      const u = `http://127.0.0.1:${state.serverPort}/api/stream-info?url=${encodeURIComponent(track.url || '')}&id=${encodeURIComponent(track.id || '')}&platform=${track.platform || state.platform}&title=${encodeURIComponent(track.title || '')}&artist=${encodeURIComponent(track.artist || '')}&duration=${encodeURIComponent(track.duration || 0)}&thumbnail=${encodeURIComponent(track.thumbnail || '')}&quality=${qQuality}&q=${qSearch}${isRiffStream}`;
      return fetch(u)
        .then((r) => r.json())
        .then((d) => {
          if (d && d.success && d.streamUrl) {
            track._preloadedStreamUrl = d.streamUrl;
            track._preloadedStreamQuality = quality;
          } else {
            prefetchedTrackKeys.delete(key);
          }
        })
        .catch(() => { prefetchedTrackKeys.delete(key); });
    } });
    pumpStreamPrefetch();
  }

  function prefetchVisibleTracks(tracks) {
    if (!Array.isArray(tracks) || !tracks.length) return;
    tracks
      .filter(track => track && track.platform === 'soundcloud')
      .slice(0, SEARCH_STREAM_PREFETCH_LIMIT)
      .forEach(enqueueStreamPrefetch);
  }

  function setSearchIconCover(thumb) {
    const btn = document.getElementById('search-icon-btn');
    if (!btn) return;
    let img = btn.querySelector('.search-icon-cover');
    if (!thumb) { if (img) img.remove(); const svg = btn.querySelector('.search-icon'); if (svg) svg.classList.remove('hidden'); return; }
    const svg = btn.querySelector('.search-icon');
    if (!img) { img = document.createElement('img'); img.className = 'search-icon-cover'; img.alt = ''; btn.appendChild(img); }
    img.src = thumb;
    if (svg) svg.classList.add('hidden');
  }


  function addTrackToQueue(track) {
    if (!track) return;
    const cloned = Object.assign({}, track);
    if (!state.currentTrack || state.queue.length === 0) {
      state.queue = [cloned];
      state.queueIndex = 0;
      if (el.queueCount) el.queueCount.textContent = '1';
      playTrack(cloned, 0);
      showToast(typeof t === 'function' ? t('Added to queue') : 'Added to queue', 'success');
      return;
    }
    state.queue.push(cloned);
    if (el.queueCount) el.queueCount.textContent = String(state.queue.length);
    updateQueueBadge();
    if (state.currentView === 'queue' && el.queueTracksList) {
      const emptyHint = el.queueTracksList.querySelector('.empty-hint');
      if (emptyHint) emptyHint.remove();
      const qIdx = state.queue.length - 1;
      const currentCanonicalId = state.currentTrack ? getTrackCanonicalId(state.currentTrack) : '';
      const row = createTrackRow(cloned, qIdx, currentCanonicalId, 'queue', state.queue, el.queueTracksList);
      row.classList.add('track-row-adding');

      const actions = row.querySelector('.track-row-actions');
      if (actions && !actions.querySelector('.btn-remove-from-queue')) {
        const btnRem = document.createElement('button');
        btnRem.type = 'button';
        btnRem.className = 'btn-icon-pill btn-remove-from-queue delete-btn';
        btnRem.title = typeof t === 'function' ? t('Remove from queue') : 'Remove from queue';
        btnRem.setAttribute('aria-label', 'Remove from queue');
        btnRem.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
        btnRem.addEventListener('click', (e) => {
          e.stopPropagation();
          const targetIdx = typeof row.dataset.trackIndex !== 'undefined' ? parseInt(row.dataset.trackIndex, 10) : qIdx;
          removeTrackFromQueue(Number.isNaN(targetIdx) ? qIdx : targetIdx, row);
        });
        actions.appendChild(btnRem);
      }

      el.queueTracksList.appendChild(row);
      setTimeout(() => {
        row.classList.remove('track-row-adding');
      }, 280);
    }
    showToast(typeof t === 'function' ? t('Added to queue') : 'Added to queue', 'success');
  }
  window.addTrackToQueue = addTrackToQueue;


  async function resetTrackAudioSource(track) {
    if (!track) return;
    let blockedSources = [];
    try { blockedSources = JSON.parse(localStorage.getItem('riff_blocked_audio_sources') || '[]'); } catch (_) {}
    const addBlock = (val) => {
      const s = String(val || '').trim();
      if (s && !/^(sp_|dz_|it_|ym_|vk_|alb_|gn_|lfm_|cand_|riff-)/i.test(s) && !blockedSources.includes(s)) {
        blockedSources.push(s);
      }
    };
    addBlock(track.resolvedYtId);
    addBlock(track._sourceMeta?.id);
    addBlock(track._sourceMeta?.url);
    addBlock(track.id);
    addBlock(track.url);
    try { localStorage.setItem('riff_blocked_audio_sources', JSON.stringify(blockedSources.slice(-300))); } catch (_) {}

    const prevId = track.resolvedYtId || track._sourceMeta?.id || track.id || '';
    delete track._preloadedStreamUrl;
    delete track._preloadedStreamQuality;
    delete track._preloadedAt;
    delete track.streamUrl;
    delete track.resolvedYtId;
    track.isCached = false;
    if (typeof cachedTrackIds !== 'undefined' && cachedTrackIds instanceof Set) {
      if (track.id) cachedTrackIds.delete(track.id);
      if (prevId) cachedTrackIds.delete(prevId);
    }

    delete track._cachedId;
    delete track._preloadedSourceMeta;
    await fetch(`http://127.0.0.1:${state.serverPort}/api/offline-delete?id=${encodeURIComponent(prevId || track.id || '')}&title=${encodeURIComponent(track.title || '')}&artist=${encodeURIComponent(track.artist || '')}`, { method: 'POST' }).catch(() => {});

    showToast(typeof t === 'function' ? t('Searching new audio source...') : 'Searching new audio source...');

    try {
      const q = `${track.artist ? track.artist + ' - ' : ''}${track.title || ''}`.trim();
      const platforms = track.fromGenius
        ? ['soundcloud', 'ytmusic', 'youtube']
        : ['ytmusic', 'soundcloud', 'youtube'];

      let chosen = null;
      for (const plat of platforms) {
        const sRes = await fetch(`http://127.0.0.1:${state.serverPort}/api/search?q=${encodeURIComponent(q)}&platform=${plat}&limit=15`).catch(() => null);
        if (!sRes || !sRes.ok) continue;
        const sData = await sRes.json().catch(() => ({}));
        const results = (sData && (sData.tracks || sData.results)) || [];
        const cand = results.find(c => {
          if (!c) return false;
          const cid = String(c.id || c.videoId || '').trim();
          const curl = String(c.url || '').trim();
          if (!cid && !curl) return false;
          if (cid && blockedSources.includes(cid)) return false;
          if (curl && blockedSources.includes(curl)) return false;
          return true;
        });
        if (cand) {
          chosen = { ...cand, platform: cand.platform || plat };
          break;
        }
      }

      if (chosen) {
        const cid = String(chosen.id || chosen.videoId || '').trim();
        addBlock(cid);
        addBlock(chosen.url);
        try { localStorage.setItem('riff_blocked_audio_sources', JSON.stringify(blockedSources.slice(-300))); } catch (_) {}

        track._sourceMeta = {
          id: cid,
          title: chosen.title || track.title,
          artist: chosen.artist || track.artist,
          thumbnail: chosen.thumbnail || chosen.cover || '',
          platform: chosen.platform,
          url: chosen.url || ''
        };
        if (chosen.platform === 'soundcloud') {
          track.platform = 'soundcloud';
          track.url = chosen.url || '';
          track.id = cid || track.id;
        } else {
          track.platform = chosen.platform || 'ytmusic';
          track.resolvedYtId = cid;
          track.url = chosen.url || (cid ? `https://www.youtube.com/watch?v=${cid}` : '');
        }
        if (chosen.duration && (!track.duration || track._hadNoDurationOnImport)) {
          track.duration = chosen.duration;
        }
        await fetch(`http://127.0.0.1:${state.serverPort}/api/save-track-source`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            artist: track.artist || '',
            title: track.title || '',
            resolvedId: cid,
            url: track.url || '',
            platform: track.platform || 'ytmusic',
            sourceMeta: track._sourceMeta
          })
        }).catch(() => {});
        showToast(`${typeof t === 'function' ? t('Audio source updated!') : 'Audio source updated!'} (${chosen.platform === 'soundcloud' ? 'SoundCloud' : 'YouTube'}: ${chosen.title || ''})`);
        if (state.currentTrack && isSameTrack(state.currentTrack, track)) {
          playTrack(track, state.queue, state.queueIndex, state.currentTrackContext);
        }
      } else {
        showToast(typeof t === 'function' ? t('No alternative audio source found') : 'No alternative audio source found', 'warn');
      }
    } catch (err) {
      showToast((typeof t === 'function' ? t('Failed to search new audio source') : 'Failed to search new audio source') + ': ' + err.message, 'error');
    }
  }


  function updateQueueBadge() {
    setNavCount(el.queueCount, state.queue.length);
    if (typeof renderSidebarLibraryFeed === 'function') renderSidebarLibraryFeed();
  }

  function removeQueueTracks(indices, sourceRow = null) {
    const removedIndices = Array.from(new Set(indices.filter(index =>
      Number.isInteger(index) && index >= 0 && index < state.queue.length
    ))).sort((a, b) => a - b);
    if (removedIndices.length === 0) return;

    const removed = new Set(removedIndices);
    const oldQueueIndex = state.queueIndex;
    const removedBefore = (index) => {
      let count = 0;
      for (const removedIndex of removedIndices) {
        if (removedIndex >= index) break;
        count++;
      }
      return count;
    };
    const remapIndex = (index) => removed.has(index) ? -1 : index - removedBefore(index);

    state.queue = state.queue.filter((_, index) => !removed.has(index));
    if (oldQueueIndex < 0) {
      state.queueIndex = -1;
    } else if (removed.has(oldQueueIndex)) {
      state.queueIndex = oldQueueIndex - removedBefore(oldQueueIndex) - 1;
    } else {
      state.queueIndex = remapIndex(oldQueueIndex);
    }
    state.queueHistory = (Array.isArray(state.queueHistory) ? state.queueHistory : [])
      .map(remapIndex)
      .filter(index => index >= 0 && index < state.queue.length);

    updateQueueBadge();

    if (state.currentView === 'queue' && el.queueTracksList) {
      const allRows = Array.from(el.queueTracksList.querySelectorAll('.track-row:not(.track-row-removing)'));
      const targetRows = new Set();
      if (sourceRow && sourceRow.isConnected) {
        targetRows.add(sourceRow);
      }
      removedIndices.forEach(idx => {
        if (allRows[idx]) targetRows.add(allRows[idx]);
      });

      if (targetRows.size > 0) {
        targetRows.forEach(row => row.classList.add('track-row-removing'));
        setTimeout(() => {
          targetRows.forEach(row => row.remove());
          let idx = 0;
          el.queueTracksList.querySelectorAll('.track-row:not(.track-row-removing)').forEach(row => {
            row.dataset.trackIndex = String(idx);
            row.style.setProperty('--row-idx', String(idx));
            const numEl = row.querySelector('.track-row-num');
            if (numEl) numEl.textContent = String(idx + 1);
            idx++;
          });
          if (state.queue.length === 0) {
            el.queueTracksList.innerHTML = `<div class="empty-hint">${typeof t === 'function' ? t('No tracks to show') : 'No tracks to show'}</div>`;
          }
          highlightPlayingRow();
        }, 260);
        return;
      }
    }

    renderQueueView();
  }

  function removeTrackFromQueue(qIdx, sourceRow = null) {
    if (!Number.isInteger(qIdx) || qIdx < 0 || qIdx >= state.queue.length) return;
    removeQueueTracks([qIdx], sourceRow);
  }
  var renderQueue = renderQueueView;
  window.renderQueue = renderQueue;
  window.removeTrackFromQueue = removeTrackFromQueue;

  function renderQueueView() {
    updateQueueBadge();
    if (!el.queueTracksList) return;
    renderTracks(el.queueTracksList, state.queue, 'queue');

    el.queueTracksList.querySelectorAll('.track-row').forEach((row, idx) => {
      const actions = row.querySelector('.track-row-actions');
      if (actions && !actions.querySelector('.btn-remove-from-queue')) {
        const btnRem = document.createElement('button');
        btnRem.type = 'button';
        btnRem.className = 'btn-icon-pill btn-remove-from-queue delete-btn';
        btnRem.title = typeof t === 'function' ? t('Remove from queue') : 'Remove from queue';
        btnRem.setAttribute('aria-label', 'Remove from queue');
        btnRem.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
        btnRem.addEventListener('click', (e) => {
          e.stopPropagation();
          const targetIdx = typeof row.dataset.trackIndex !== 'undefined' ? parseInt(row.dataset.trackIndex, 10) : idx;
          removeTrackFromQueue(Number.isNaN(targetIdx) ? idx : targetIdx, row);
        });
        actions.appendChild(btnRem);
      }
    });

    if (!el.queueTracksList._sortEnabled) {
      el.queueTracksList._sortEnabled = true;
      const sortFn = (typeof enableTrackSort === 'function')
        ? enableTrackSort
        : ((typeof window !== 'undefined' && (window.enableTrackSort || (window.TrackSort && window.TrackSort.enableTrackSort))) || null);
      if (typeof sortFn === 'function') {
        sortFn(el.queueTracksList, (fromIdx, toIdx) => {
          if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0 || fromIdx >= state.queue.length || toIdx >= state.queue.length) return;
          const [moved] = state.queue.splice(fromIdx, 1);
          state.queue.splice(toIdx, 0, moved);
          const remapIndex = (index) => {
            if (index === fromIdx) return toIdx;
            if (fromIdx < toIdx && index > fromIdx && index <= toIdx) return index - 1;
            if (fromIdx > toIdx && index >= toIdx && index < fromIdx) return index + 1;
            return index;
          };
          state.queueIndex = remapIndex(state.queueIndex);
          state.queueHistory = state.queueHistory.map(remapIndex);
          renderQueueView();
        });
      }
    }
  }
  window.renderQueueView = renderQueueView;


  var sliderCrossfade = document.getElementById('slider-crossfade');
  var valCrossfade = document.getElementById('val-crossfade');
  if (sliderCrossfade) {
    const cf = parseInt(localStorage.getItem('riff_crossfade') || '0', 10);
    sliderCrossfade.value = cf;
    if (valCrossfade) valCrossfade.textContent = cf > 0 ? `${cf}s` : 'Off';
    sliderCrossfade.addEventListener('input', (e) => {
      const v = parseInt(e.target.value, 10);
      if (valCrossfade) valCrossfade.textContent = v > 0 ? `${v}s` : 'Off';
      localStorage.setItem('riff_crossfade', String(v));
    });
  }

  if (el.btnTrEnabled) {
    el.btnTrEnabled.addEventListener('click', () => {
      state.trEnabled = !state.trEnabled;
      localStorage.setItem('riff_tr_enabled', String(state.trEnabled));
      updateLyricsTranslationUI();
      if (!state.trEnabled) {
        state.trActive = false;
        state.currentTranslations = null;
        renderLyricsView();
        if (el.nativeAudio) updateSyncedLyricsHighlight(el.nativeAudio.currentTime || 0);
      } else if (state.trAuto) {
        state.trActive = true;
        updateLyricsTranslationUI();
        fetchAndApplyTranslation();
      }
    });
  }

  var trLangDropdown = document.getElementById('tr-lang-dropdown');
  var trLangTrigger = document.getElementById('tr-lang-trigger');
  var trLangLabel = document.getElementById('tr-lang-label');
  var trLangMenu = document.getElementById('tr-lang-menu');
  var trLangList = document.getElementById('tr-lang-list');
  var trLangSearch = document.getElementById('tr-lang-search');

  if (trLangDropdown && trLangTrigger && trLangMenu) {
    const curLang = state.trLang || 'en';
    if (trLangList) {
      trLangList.innerHTML = '';
      const frag = document.createDocumentFragment();
      TRANSLATION_LANGUAGES.forEach(item => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'm3-dropdown-option';
        btn.dataset.value = item.code;
        const text = `${item.flag} ${item.name} (${item.code})`;
        btn.textContent = text;
        if (item.code === curLang) {
          btn.classList.add('selected');
          if (trLangLabel) trLangLabel.textContent = text;
        }
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          state.trLang = item.code;
          state.lyricsTranslationLang = item.code;
          localStorage.setItem('riff_tr_lang', state.trLang);
          if (trLangLabel) trLangLabel.textContent = text;
          trLangMenu.querySelectorAll('.m3-dropdown-option').forEach(o => o.classList.remove('selected'));
          btn.classList.add('selected');
          if (el.selectTrLang) el.selectTrLang.value = item.code;
          trLangDropdown.classList.remove('open');
          if (state.trActive) {
            fetchAndApplyTranslation();
          }
        });
        frag.appendChild(btn);
      });
      trLangList.appendChild(frag);

      if (el.selectTrLang) {
        el.selectTrLang.innerHTML = '';
        TRANSLATION_LANGUAGES.forEach(item => {
          const opt = document.createElement('option');
          opt.value = item.code;
          opt.textContent = `${item.flag} ${item.name} (${item.code})`;
          el.selectTrLang.appendChild(opt);
        });
        el.selectTrLang.value = curLang;
      }
    }

    if (trLangSearch) {
      trLangSearch.addEventListener('click', (e) => e.stopPropagation());
      trLangSearch.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase().trim();
        if (!trLangList) return;
        trLangList.querySelectorAll('.m3-dropdown-option').forEach(opt => {
          const text = (opt.textContent || '').toLowerCase();
          const code = (opt.dataset.value || '').toLowerCase();
          opt.style.display = (!q || text.includes(q) || code.includes(q)) ? '' : 'none';
        });
      });
      trLangSearch.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          trLangDropdown.classList.remove('open');
        } else if (e.key === 'Enter') {
          e.preventDefault();
          const firstVisible = trLangList ? trLangList.querySelector('.m3-dropdown-option:not([style*="display: none"])') : null;
          if (firstVisible) firstVisible.click();
        }
      });
    }

    trLangTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = trLangDropdown.classList.toggle('open');
      if (isOpen && trLangSearch) {
        trLangSearch.value = '';
        if (trLangList) {
          trLangList.querySelectorAll('.m3-dropdown-option').forEach(opt => opt.style.display = '');
        }
        setTimeout(() => trLangSearch.focus(), 50);
      }
    });

    document.addEventListener('click', () => {
      trLangDropdown.classList.remove('open');
    });
  }

  var uiLangDropdown = document.getElementById('ui-lang-dropdown');
  var uiLangTrigger = document.getElementById('ui-lang-trigger');
  var uiLangLabel = document.getElementById('ui-lang-label');
  var uiLangMenu = document.getElementById('ui-lang-menu');
  var uiLangList = document.getElementById('ui-lang-list');
  var uiLangSearch = document.getElementById('ui-lang-search');

  if (uiLangDropdown && uiLangTrigger && uiLangMenu) {
    const curLang = getSupportedUiLanguage(localStorage.getItem('riff_ui_lang') || 'en');
    const foundCur = UI_TRANSLATION_LANGUAGES.find(l => l.code === curLang);
    if (foundCur && uiLangLabel) {
      uiLangLabel.setAttribute('data-i18n-fixed', 'true');
      uiLangLabel.textContent = `${foundCur.flag} ${foundCur.name} (${foundCur.code})`;
    }

    if (uiLangList) {
      uiLangList.innerHTML = '';
      const frag = document.createDocumentFragment();
      UI_TRANSLATION_LANGUAGES.forEach(item => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'm3-dropdown-option';
        btn.dataset.value = item.code;
        btn.setAttribute('data-i18n-fixed', 'true');
        const text = `${item.flag} ${item.name} (${item.code})`;
        btn.textContent = text;
        if (item.code === curLang) {
          btn.classList.add('selected');
        }
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const prevLang = localStorage.getItem('riff_ui_lang') || 'en';
          if (uiLangDropdown) uiLangDropdown.classList.remove('open');
          uiLangMenu.querySelectorAll('.m3-dropdown-option').forEach(o => o.classList.remove('selected'));
          btn.classList.add('selected');
          if (uiLangLabel) {
            uiLangLabel.setAttribute('data-i18n-fixed', 'true');
            uiLangLabel.textContent = text;
          }
          if (item.code === prevLang) return;

          localStorage.setItem('riff_ui_lang', item.code);
          if (window.electronAPI && window.electronAPI.storageSaveSync && window.__RIFF_STORAGE_MAP__) {
            window.__RIFF_STORAGE_MAP__['riff_ui_lang'] = item.code;
            window.electronAPI.storageSaveBatch(window.__RIFF_STORAGE_MAP__);
          }
          const result = await runWithI18nLoadingOverlay(() => applyI18n(item.code));
          if (item.code !== 'en' && (!result || result.ok === false)) {
            localStorage.setItem('riff_ui_lang', prevLang);
            if (window.__RIFF_STORAGE_MAP__) {
              window.__RIFF_STORAGE_MAP__['riff_ui_lang'] = prevLang;
              if (window.electronAPI && window.electronAPI.storageSaveBatch) {
                window.electronAPI.storageSaveBatch(window.__RIFF_STORAGE_MAP__);
              }
            }
            if (uiLangMenu) {
              uiLangMenu.querySelectorAll('.m3-dropdown-option').forEach(o => {
                o.classList.toggle('selected', o.dataset.value === prevLang);
              });
            }
            if (uiLangLabel) {
              const prevItem = UI_TRANSLATION_LANGUAGES.find(l => l.code === prevLang);
              if (prevItem) {
                uiLangLabel.setAttribute('data-i18n-fixed', 'true');
                uiLangLabel.textContent = `${prevItem.flag} ${prevItem.name} (${prevItem.code})`;
              }
            }
            await applyI18n(prevLang);
            showToast('Could not translate interface', 'error');
          } else {
            showToast(item.code === 'en' ? 'Language switched to English' : 'Language changed', 'success');
          }
        });
        frag.appendChild(btn);
      });
      uiLangList.appendChild(frag);
    }

    if (uiLangSearch) {
      uiLangSearch.addEventListener('click', (e) => e.stopPropagation());
      uiLangSearch.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase().trim();
        if (!uiLangList) return;
        uiLangList.querySelectorAll('.m3-dropdown-option').forEach(opt => {
          const text = (opt.textContent || '').toLowerCase();
          const code = (opt.dataset.value || '').toLowerCase();
          opt.style.display = (!q || text.includes(q) || code.includes(q)) ? '' : 'none';
        });
      });
      uiLangSearch.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          uiLangDropdown.classList.remove('open');
        } else if (e.key === 'Enter') {
          e.preventDefault();
          const firstVisible = uiLangList ? uiLangList.querySelector('.m3-dropdown-option:not([style*="display: none"])') : null;
          if (firstVisible) firstVisible.click();
        }
      });
    }

    uiLangTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = uiLangDropdown.classList.toggle('open');
      if (isOpen && uiLangSearch) {
        uiLangSearch.value = '';
        if (uiLangList) {
          uiLangList.querySelectorAll('.m3-dropdown-option').forEach(opt => opt.style.display = '');
        }
        setTimeout(() => uiLangSearch.focus(), 50);
      }
    });

    document.addEventListener('click', () => {
      uiLangDropdown.classList.remove('open');
    });
  }

  var inputDeeplApiKey = document.getElementById('input-deepl-api-key');
  if (inputDeeplApiKey) {
    inputDeeplApiKey.value = localStorage.getItem('riff_deepl_api_key') || '';
    inputDeeplApiKey.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      if (val) {
        localStorage.setItem('riff_deepl_api_key', val);
      } else {
        localStorage.removeItem('riff_deepl_api_key');
      }
    });
  }

  if (el.btnTrAuto) {
    el.btnTrAuto.addEventListener('click', () => {
      state.trAuto = !state.trAuto;
      localStorage.setItem('riff_tr_auto', String(state.trAuto));
      updateLyricsTranslationUI();
      if (state.trEnabled && state.trAuto && !state.trActive) {
        state.trActive = true;
        updateLyricsTranslationUI();
        fetchAndApplyTranslation();
      }
    });
  }

  var LANG_RESTART_TEXT = {
    en: {
      title: 'Restart required',
      msg: 'Changes will take effect after restarting the app',
      cancel: 'Cancel',
      restart: 'Restart'
    },
    ru: {
      title: 'Необходимо перезагрузить приложение',
      msg: 'Изменения войдут после перезагрузки приложения',
      cancel: 'Отмена',
      restart: 'Перезагрузить'
    }
  };

  var langRestartModal = document.getElementById('lang-restart-modal');


  var btnDiscordRpc = document.getElementById('btn-discord-rpc');
  var badgeDiscordRpc = document.getElementById('badge-discord-rpc');

  function syncDiscordRpcUI() {
    btnDiscordRpc = btnDiscordRpc || document.getElementById('btn-discord-rpc');
    badgeDiscordRpc = badgeDiscordRpc || document.getElementById('badge-discord-rpc');
    if (btnDiscordRpc) {
      btnDiscordRpc.classList.toggle('active', state.discordRpcEnabled);
      
    }
    if (badgeDiscordRpc) {
      badgeDiscordRpc.textContent = state.discordRpcEnabled ? 'on' : 'off';
    }
    const card = document.getElementById('card-discord-rpc');
    if (card) card.classList.toggle('enabled', state.discordRpcEnabled);
  }

  if (btnDiscordRpc) {
    btnDiscordRpc.addEventListener('click', () => {
      state.discordRpcEnabled = !state.discordRpcEnabled;
      localStorage.setItem('devsize_discord_rpc', JSON.stringify(state.discordRpcEnabled));
      if (window.electronAPI && window.electronAPI.discordRpcSetEnabled) {
        window.electronAPI.discordRpcSetEnabled(state.discordRpcEnabled);
      }
      if (state.discordRpcEnabled && state.isPlaying && state.currentTrack) {
        sendDiscordRpcUpdate(state.currentTrack, true);
      }
      syncDiscordRpcUI();
    });
  }

  var btnDiscordReconnect = document.getElementById('btn-discord-reconnect');
  if (btnDiscordReconnect) {
    btnDiscordReconnect.addEventListener('click', async () => {
      if (window.electronAPI && window.electronAPI.discordRpcReconnect) {
        await window.electronAPI.discordRpcReconnect();
        if (state.discordRpcEnabled && state.isPlaying && state.currentTrack) {
          sendDiscordRpcUpdate(state.currentTrack, true);
        }
        showToast('Discord RPC reconnected', 'info');
      }
    });
  }

  var btnDiscordArtistStatus = document.getElementById('btn-discord-artist-status');
  if (btnDiscordArtistStatus) {
    const on = localStorage.getItem('riff_discord_artist_status') !== '0';
    btnDiscordArtistStatus.classList.toggle('active', on);
    btnDiscordArtistStatus.addEventListener('click', () => {
      const next = !btnDiscordArtistStatus.classList.contains('active');
      btnDiscordArtistStatus.classList.toggle('active', next);
      localStorage.setItem('riff_discord_artist_status', next ? '1' : '0');
      if (state.discordRpcEnabled && state.isPlaying && state.currentTrack) {
        sendDiscordRpcUpdate(state.currentTrack, true);
      }
    });
  }

  syncDiscordRpcUI();


  var lastfmModal = document.getElementById('lastfm-modal');
  var btnLastFmOpen = document.getElementById('btn-lastfm-open-modal');
  var btnCloseLfm = document.getElementById('btn-close-lastfm-modal');
  var btnCancelLfm = document.getElementById('btn-cancel-lastfm-modal');
  var btnLastFmToggle = document.getElementById('btn-lastfm-toggle');
  var btnLastFmWebAuth = document.getElementById('btn-lastfm-web-auth');
  var btnLastFmLoginDirect = document.getElementById('btn-lastfm-login-direct');
  var btnLastFmDisconnect = document.getElementById('btn-lastfm-disconnect');

  function closeLastFmModal() {
    if (lastfmModal) {
      if (typeof closeModal === 'function') {
        closeModal(lastfmModal);
      } else {
        lastfmModal.classList.remove('visible');
        lastfmModal.classList.add('hidden');
      }
    }
    if (lastfmState.pollTimer) {
      clearInterval(lastfmState.pollTimer);
      lastfmState.pollTimer = null;
    }
  }

  if (btnLastFmOpen && lastfmModal) {
    btnLastFmOpen.addEventListener('click', () => {
      const userInp = document.getElementById('lastfm-input-user');
      const keyInp = document.getElementById('lastfm-input-key');
      const secretInp = document.getElementById('lastfm-input-secret');
      if (userInp && !userInp.value) userInp.value = lastfmState.username || '';
      if (keyInp && !keyInp.value) keyInp.value = lastfmState.apiKey || '';
      if (secretInp && !secretInp.value) secretInp.value = lastfmState.apiSecret || '';
      const statusEl = document.getElementById('lastfm-modal-status');
      if (statusEl) {
        statusEl.textContent = '';
        statusEl.classList.add('hidden');
      }
      if (typeof openModal === 'function') {
        openModal(lastfmModal);
      } else {
        lastfmModal.classList.remove('hidden');
        lastfmModal.classList.add('visible');
      }
    });
  }

  if (btnCloseLfm) btnCloseLfm.addEventListener('click', closeLastFmModal);
  if (btnCancelLfm) btnCancelLfm.addEventListener('click', closeLastFmModal);

  if (lastfmModal) {
    lastfmModal.addEventListener('click', (e) => {
      if (e.target === lastfmModal) closeLastFmModal();
    });
  }

  if (btnLastFmToggle) {
    btnLastFmToggle.addEventListener('click', () => {
      lastfmState.enabled = !lastfmState.enabled;
      localStorage.setItem('riff_lastfm_enabled', String(lastfmState.enabled));
      syncLastFmUI();
    });
  }

  if (btnLastFmWebAuth) {
    btnLastFmWebAuth.addEventListener('click', async () => {
      const statusEl = document.getElementById('lastfm-modal-status');
      const keyInp = document.getElementById('lastfm-input-key');
      const secretInp = document.getElementById('lastfm-input-secret');
      const customKey = (keyInp?.value || '').trim();
      const customSecret = (secretInp?.value || '').trim();
      if (customKey && customSecret) {
        lastfmState.apiKey = customKey;
        lastfmState.apiSecret = customSecret;
        localStorage.setItem('riff_lastfm_apikey', customKey);
        localStorage.setItem('riff_lastfm_apisecret', customSecret);
      } else {
        lastfmState.apiKey = '';
        lastfmState.apiSecret = '';
        localStorage.removeItem('riff_lastfm_apikey');
        localStorage.removeItem('riff_lastfm_apisecret');
      }
      if (statusEl) {
        statusEl.textContent = 'Requesting Last.fm authorization...';
        statusEl.classList.remove('hidden');
      }
      try {
        const port = state.serverPort || 38472;
        const res = await fetch(`http://127.0.0.1:${port}/api/lastfm/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey: lastfmState.apiKey,
            apiSecret: lastfmState.apiSecret
          })
        });
        const data = await res.json();
        if (!data.success || !data.token || !data.authUrl) {
          if (statusEl) statusEl.textContent = data.error || 'Failed to get auth token';
          return;
        }
        if (window.electronAPI && window.electronAPI.openExternal) window.electronAPI.openExternal(data.authUrl);
        else window.open(data.authUrl, '_blank');

        if (statusEl) {
          statusEl.textContent = 'Waiting for authorization in browser...';
          statusEl.classList.remove('hidden');
        }

        if (lastfmState.pollTimer) clearInterval(lastfmState.pollTimer);
        const token = data.token;
        lastfmState.pollTimer = setInterval(async () => {
          try {
            const sRes = await fetch(`http://127.0.0.1:${port}/api/lastfm/session`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                token,
                apiKey: lastfmState.apiKey,
                apiSecret: lastfmState.apiSecret
              })
            });
            const sData = await sRes.json();
            if (sData.success && sData.sessionKey) {
              clearInterval(lastfmState.pollTimer);
              lastfmState.pollTimer = null;
              lastfmState.sessionKey = sData.sessionKey;
              lastfmState.username = sData.username;
              localStorage.setItem('riff_lastfm_sk', sData.sessionKey);
              localStorage.setItem('riff_lastfm_user', sData.username);
              syncLastFmUI();
              if (typeof showToast === 'function') showToast('Connected to Last.fm as @' + sData.username, 'info');
              closeLastFmModal();
            }
          } catch (_) {}
        }, 2500);
      } catch (err) {
        if (statusEl) {
          statusEl.textContent = 'Error: ' + err.message;
          statusEl.classList.remove('hidden');
        }
      }
    });
  }

  if (btnLastFmLoginDirect) {
    btnLastFmLoginDirect.addEventListener('click', async () => {
      const statusEl = document.getElementById('lastfm-modal-status');
      const userInp = document.getElementById('lastfm-input-user');
      const passInp = document.getElementById('lastfm-input-pass');
      const keyInp = document.getElementById('lastfm-input-key');
      const secretInp = document.getElementById('lastfm-input-secret');
      const username = (userInp?.value || '').trim();
      const password = passInp?.value || '';
      const customKey = (keyInp?.value || '').trim();
      const customSecret = (secretInp?.value || '').trim();

      if (!username || !password) {
        if (statusEl) {
          statusEl.textContent = 'Please enter username and password';
          statusEl.classList.remove('hidden');
        }
        return;
      }

      if (customKey) {
        lastfmState.apiKey = customKey;
        localStorage.setItem('riff_lastfm_apikey', customKey);
      }
      if (customSecret) {
        lastfmState.apiSecret = customSecret;
        localStorage.setItem('riff_lastfm_apisecret', customSecret);
      }

      if (statusEl) {
        statusEl.textContent = 'Signing in...';
        statusEl.classList.remove('hidden');
      }

      try {
        const port = state.serverPort || 38472;
        const res = await fetch(`http://127.0.0.1:${port}/api/lastfm/mobile-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username,
            password,
            apiKey: lastfmState.apiKey,
            apiSecret: lastfmState.apiSecret
          })
        });
        const data = await res.json();
        if (data.success && data.sessionKey) {
          lastfmState.sessionKey = data.sessionKey;
          lastfmState.username = data.username || username;
          localStorage.setItem('riff_lastfm_sk', data.sessionKey);
          localStorage.setItem('riff_lastfm_user', lastfmState.username);
          if (passInp) passInp.value = '';
          if (statusEl) {
            statusEl.textContent = `Connected as @${lastfmState.username}!`;
            statusEl.classList.remove('hidden');
          }
          syncLastFmUI();
          if (typeof showToast === 'function') showToast(`Connected to Last.fm as @${lastfmState.username}`, 'info');
        } else {
          if (statusEl) {
            statusEl.textContent = data.error || 'Authentication failed';
            statusEl.classList.remove('hidden');
          }
        }
      } catch (err) {
        if (statusEl) {
          statusEl.textContent = 'Error: ' + err.message;
          statusEl.classList.remove('hidden');
        }
      }
    });
  }

  if (btnLastFmDisconnect) {
    btnLastFmDisconnect.addEventListener('click', () => {
      lastfmState.sessionKey = '';
      lastfmState.username = '';
      localStorage.removeItem('riff_lastfm_sk');
      localStorage.removeItem('riff_lastfm_user');
      if (lastfmState.pollTimer) {
        clearInterval(lastfmState.pollTimer);
        lastfmState.pollTimer = null;
      }
      const statusEl = document.getElementById('lastfm-modal-status');
      if (statusEl) {
        statusEl.textContent = '';
        statusEl.classList.add('hidden');
      }
      syncLastFmUI();
      if (typeof showToast === 'function') showToast('Disconnected from Last.fm', 'info');
    });
  }

  syncLastFmUI();


  function getFailedTracks() {
    try {
      const raw = localStorage.getItem(FAILED_TRACKS_KEY);
      if (!raw) return { ids: [], keys: [] };
      const parsed = JSON.parse(raw);
      return {
        ids: Array.isArray(parsed?.ids) ? parsed.ids : [],
        keys: Array.isArray(parsed?.keys) ? parsed.keys : []
      };
    } catch (_) {
      return { ids: [], keys: [] };
    }
  }

  function isTrackFailedOrUnavailable(track) {
    if (!track) return true;
    if (track._gaveUp || track.isUnavailable || track._unavailNotice) return true;
    const failed = getFailedTracks();
    const trackId = track.id ? String(track.id) : '';
    if (trackId && Array.isArray(failed.ids) && failed.ids.some(id => id && String(id) === trackId)) {
      return true;
    }
    const key = (typeof getTrackNormalizedKey === 'function')
      ? getTrackNormalizedKey(track.artist, track.title)
      : '';
    if (key && Array.isArray(failed.keys) && failed.keys.includes(key)) {
      return true;
    }
    if (track.key && Array.isArray(failed.keys) && failed.keys.includes(track.key)) {
      return true;
    }
    return false;
  }

  function recordFailedTrack(track) {
    if (!track) return;
    const trackId = track.id ? String(track.id) : '';
    const trackKey = (typeof getTrackNormalizedKey === 'function')
      ? getTrackNormalizedKey(track.artist, track.title)
      : '';
    if (!trackId && !trackKey) return;

    const failed = getFailedTracks();
    if (trackId && !failed.ids.some(id => String(id) === trackId)) {
      failed.ids.push(trackId);
    }
    if (trackKey && !failed.keys.includes(trackKey)) {
      failed.keys.push(trackKey);
    }
    if (failed.ids.length > 300) {
      failed.ids.splice(0, failed.ids.length - 300);
    }
    if (failed.keys.length > 300) {
      failed.keys.splice(0, failed.keys.length - 300);
    }
    try {
      localStorage.setItem(FAILED_TRACKS_KEY, JSON.stringify(failed));
    } catch (_) {}

    const isMatch = (t) => {
      if (!t) return true;
      if (trackId && String(t.id) === trackId) return true;
      const k = (typeof getTrackNormalizedKey === 'function')
        ? getTrackNormalizedKey(t.artist, t.title)
        : '';
      if (trackKey && k === trackKey) return true;
      return isTrackFailedOrUnavailable(t);
    };

    if (Array.isArray(state.vibeTracks)) {
      state.vibeTracks = state.vibeTracks.filter(t => !isMatch(t));
      try {
        localStorage.setItem('riff_my_wave_cache', JSON.stringify({ ts: Date.now(), tracks: state.vibeTracks }));
      } catch (_) {}
      if (window.HomeCache) {
        window.HomeCache.set('home_vibe', state.vibeTracks);
      }
    }

    if (Array.isArray(myWaveCurrentTracks)) {
      myWaveCurrentTracks = myWaveCurrentTracks.filter(t => !isMatch(t));
    }

    let cachedMixes = (window.HomeCache && window.HomeCache.get('daily_mixes', 24 * 3600 * 1000)) || safeJson('riff_daily_mixes', null);
    if (!cachedMixes) {
      try {
        const raw = localStorage.getItem('riff_daily_mixes');
        if (raw) cachedMixes = JSON.parse(raw);
      } catch (_) {}
    }
    if (cachedMixes && Array.isArray(cachedMixes.mixes)) {
      cachedMixes.mixes.forEach(m => {
        if (Array.isArray(m.tracks)) {
          m.tracks = m.tracks.filter(t => !isMatch(t));
        }
      });
      try {
        localStorage.setItem('riff_daily_mixes', JSON.stringify(cachedMixes));
      } catch (_) {}
      if (window.HomeCache) {
        window.HomeCache.set('daily_mixes', cachedMixes);
      }
    }

    if (state.currentView === 'discover') {
      const sp = (localStorage.getItem('riff_home_layout') || 'spotify') === 'spotify';
      if (sp) {
        if (typeof renderSpotifyHome === 'function') renderSpotifyHome();
      } else {
        if (typeof renderHomeCarousel === 'function') renderHomeCarousel(homeMode);
      }
    }
  }

  function removeFailedTrack(track) {
    if (!track) return;
    const trackId = track.id ? String(track.id) : '';
    const trackKey = (typeof getTrackNormalizedKey === 'function')
      ? getTrackNormalizedKey(track.artist, track.title)
      : '';
    const directKey = track.key ? String(track.key) : '';
    if (!trackId && !trackKey && !directKey) return;

    const failed = getFailedTracks();
    let changed = false;
    if (trackId && Array.isArray(failed.ids) && failed.ids.length > 0) {
      const origLen = failed.ids.length;
      failed.ids = failed.ids.filter(id => String(id) !== trackId);
      if (failed.ids.length !== origLen) changed = true;
    }
    if (Array.isArray(failed.keys) && failed.keys.length > 0) {
      const origLen = failed.keys.length;
      failed.keys = failed.keys.filter(k => {
        if (trackKey && k === trackKey) return false;
        if (directKey && k === directKey) return false;
        return true;
      });
      if (failed.keys.length !== origLen) changed = true;
    }
    if (changed) {
      try {
        localStorage.setItem(FAILED_TRACKS_KEY, JSON.stringify(failed));
      } catch (_) {}
    }
  }


  async function extendMyWaveQueue() {
    if (!state.myWaveActive || isExtendingMyWave) return false;
    isExtendingMyWave = true;
    try {
      const profile = await computeTasteProfile();
      const baseAvoid = typeof getWaveAvoid === 'function' ? getWaveAvoid() : { ids: [], keys: [], artists: [] };
      const avoidIds = new Set(Array.isArray(baseAvoid.ids) ? baseAvoid.ids : []);
      const avoidKeys = new Set(Array.isArray(baseAvoid.keys) ? baseAvoid.keys : []);
      (state.queue || []).forEach(t => {
        if (!t) return;
        const cid = (typeof getTrackCanonicalId === 'function' ? getTrackCanonicalId(t) : '') || (t.id ? String(t.id).trim() : '');
        if (cid) avoidIds.add(cid);
        const k = (t.artist && t.title && typeof getTrackNormalizedKey === 'function') ? getTrackNormalizedKey(t.artist, t.title) : '';
        if (k && k !== '::') avoidKeys.add(k);
      });
      const mergedAvoid = {
        ids: Array.from(avoidIds),
        keys: Array.from(avoidKeys),
        artists: Array.isArray(baseAvoid.artists) ? baseAvoid.artists : []
      };
      const res = await fetch(`http://127.0.0.1:${state.serverPort}/api/vibe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history: (state.history || []).slice(0, 30),
          favorites: (state.favorites || []).slice(0, 25),
          platform: 'youtube',
          limit: 8,
          clientProfile: profile,
          seeds: profile.seeds,
          avoid: mergedAvoid
        })
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.tracks) && data.tracks.length > 0) {
        const existingIds = new Set(avoidIds);
        const existingKeys = new Set(avoidKeys);
        const newTracks = [];
        for (const t of data.tracks) {
          if (!t) continue;
          const cid = (typeof getTrackCanonicalId === 'function' ? getTrackCanonicalId(t) : '') || (t.id ? String(t.id).trim() : '');
          const nkey = (t.artist && t.title && typeof getTrackNormalizedKey === 'function') ? getTrackNormalizedKey(t.artist, t.title) : '';
          if ((cid && existingIds.has(cid)) || (nkey && existingKeys.has(nkey))) continue;
          if (cid) existingIds.add(cid);
          if (nkey) existingKeys.add(nkey);
          newTracks.push(t);
        }
        if (newTracks.length > 0) {
          state.queue.push(...newTracks);
          updateQueueBadge();
          renderQueueView();
          return true;
        }
      }
      return false;
    } catch (e) {
      return false;
    } finally {
      isExtendingMyWave = false;
    }
  }

  async function ensureInfiniteWaveQueue(force = false) {
    if (!state.isRadioQueue && !force) return false;
    if (state._waveReplenishBusy) return false;
    const remaining = state.queue.length - 1 - state.queueIndex;
    if (!force && remaining > 3) return false;
    state._waveReplenishBusy = true;
    try {
      const port = state.serverPort || 38472;
      const taste = typeof computeTasteProfile === 'function' ? await computeTasteProfile() : { seeds: [], topArtists: [] };
      const baseAvoid = typeof getWaveAvoid === 'function' ? getWaveAvoid() : { ids: [], keys: [], artists: [] };
      const seenIds = new Set(Array.isArray(baseAvoid.ids) ? baseAvoid.ids : []);
      const seenKeys = new Set(Array.isArray(baseAvoid.keys) ? baseAvoid.keys : []);
      (state.queue || []).forEach(t => {
        if (!t) return;
        const cid = (typeof getTrackCanonicalId === 'function' ? getTrackCanonicalId(t) : '') || (t.id ? String(t.id).trim() : '');
        if (cid) seenIds.add(cid);
        const k = (t.artist && t.title && typeof getTrackNormalizedKey === 'function') ? getTrackNormalizedKey(t.artist, t.title) : '';
        if (k && k !== '::') seenKeys.add(k);
      });
      const mergedAvoid = {
        ids: Array.from(seenIds),
        keys: Array.from(seenKeys),
        artists: Array.isArray(baseAvoid.artists) ? baseAvoid.artists : []
      };
      const res = await fetch('http://127.0.0.1:' + port + '/api/vibe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history: (state.history || []).slice(0, 30),
          favorites: (state.favorites || []).slice(0, 25),
          platform: 'youtube',
          limit: 12,
          clientProfile: taste,
          seeds: taste.seeds || [],
          avoid: mergedAvoid
        })
      });
      const data = await res.json();
      const incoming = Array.isArray(data && data.tracks) ? data.tracks : [];
      const fresh = [];
      for (const t of incoming) {
        if (!t || !t.title || (!t.id && !t.url)) continue;
        const tid = (typeof getTrackCanonicalId === 'function' ? getTrackCanonicalId(t) : '') || (t.id ? String(t.id).trim() : '');
        const tkey = (t.artist && t.title && typeof getTrackNormalizedKey === 'function') ? getTrackNormalizedKey(t.artist, t.title) : '';
        if ((tid && seenIds.has(tid)) || (tkey && seenKeys.has(tkey))) continue;
        if (tid) seenIds.add(tid);
        if (tkey) seenKeys.add(tkey);
        fresh.push(t);
      }
      if (fresh.length > 0) {
        const startIdx = state.queue.length;
        state.queue.push(...fresh);
        if (typeof rememberWaveShown === 'function') rememberWaveShown(fresh);
        if (el.queueCount) el.queueCount.textContent = String(state.queue.length);
        if (state.currentView === 'queue' && el.queueTracksList) {
          el.queueTracksList.querySelector('.empty-hint')?.remove();
          fresh.forEach((tr, i) => {
            const qIdx = startIdx + i;
            el.queueTracksList.appendChild(createTrackRow(tr, qIdx, state.currentTrack ? getTrackCanonicalId(state.currentTrack) : '', 'queue', state.queue, el.queueTracksList));
          });
        }
        return true;
      }
    } catch (_) {} finally { state._waveReplenishBusy = false; }
    return false;
  }


  function blendFavoritesIntoWave(waveTracks) {
    try {
      if (!Array.isArray(waveTracks) || waveTracks.length === 0) return waveTracks;
      const recent = (state.history || []).filter(Boolean).slice(0, 20);
      const favs = (state.favorites || []).filter(Boolean);
      if (recent.length === 0 || favs.length === 0) return waveTracks;

      const artistKeys = (name) => String(name || '').split(/,|&| feat\.? | ft\.? | x /i).map(a => normalizeArtistName(a)).filter(Boolean);
      const recentArtists = new Set();
      recent.forEach(t => artistKeys(t.artist).forEach(a => recentArtists.add(a)));
      const inWaveIds = new Set(waveTracks.map(t => getTrackCanonicalId(t)).filter(Boolean));
      const inWaveKeys = new Set(waveTracks.map(t => getTrackNormalizedKey(t.artist, t.title)).filter(Boolean));
      const justPlayedSlice = recent.slice(0, 8);
      const justPlayedIds = new Set(justPlayedSlice.map(t => getTrackCanonicalId(t)).filter(Boolean));
      const justPlayedKeys = new Set(justPlayedSlice.map(t => getTrackNormalizedKey(t.artist, t.title)).filter(Boolean));

      const seenPoolKeys = new Set();
      const seenPoolIds = new Set();
      const pool = favs.filter(t => {
        const id = getTrackCanonicalId(t);
        const key = getTrackNormalizedKey(t.artist, t.title);
        if (!id && !key) return false;
        if (id && inWaveIds.has(id)) return false;
        if (key && inWaveKeys.has(key)) return false;
        if (id && justPlayedIds.has(id)) return false;
        if (key && justPlayedKeys.has(key)) return false;
        if (id && seenPoolIds.has(id)) return false;
        if (key && seenPoolKeys.has(key)) return false;
        if (isTrackBlocked(t) || isArtistBlocked(t.artist)) return false;
        if (id) seenPoolIds.add(id);
        if (key) seenPoolKeys.add(key);
        return artistKeys(t.artist).some(a => recentArtists.has(a));
      });
      if (pool.length === 0) return waveTracks;

      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      const picks = pool.slice(0, Math.max(2, Math.floor(waveTracks.length / 4)));
      const out = [];
      let next = 0;
      waveTracks.forEach((t, i) => {
        out.push(t);
        if ((i + 1) % 3 === 0 && next < picks.length) out.push(picks[next++]);
      });
      while (next < picks.length && out.length < waveTracks.length + picks.length) out.push(picks[next++]);
      return out;
    } catch (_) {
      return waveTracks;
    }
  }

  async function playMyWave() {
    if (!myWaveCurrentTracks || myWaveCurrentTracks.length === 0) {
      const profile = await computeTasteProfile();
      if (profile.trackCount < 5) {
        showToast('Save at least 5 tracks to tune For you');
        return;
      }
      await loadHomePage();
    }
    if (myWaveCurrentTracks && myWaveCurrentTracks.length > 0) {
      state.isRadioQueue = true;
      state.myWaveActive = true;
      const startIdx = (currentWaveFocusedIndex >= 0 && currentWaveFocusedIndex < myWaveCurrentTracks.length) ? currentWaveFocusedIndex : 0;
      playTrack(myWaveCurrentTracks[startIdx], [...myWaveCurrentTracks], startIdx);
      showToast('Playing For you');
    }
  }

  var btnPlayMyWave = document.getElementById('btn-play-my-wave');
  if (btnPlayMyWave) {
    btnPlayMyWave.addEventListener('click', playMyWave);
  }

  if (el.btnRefreshVibe) {
    el.btnRefreshVibe.addEventListener('click', async () => {
      const btn = el.btnRefreshVibe;
      if (btn.classList.contains('loading')) return;

      const wrapper = document.querySelector('#section-my-wave .my-wave-carousel-wrapper');
      btn.classList.add('loading');
      if (wrapper) wrapper.classList.add('loading');

      let spinner = wrapper ? wrapper.querySelector('.my-wave-carousel-spinner') : null;
      if (!spinner && wrapper) {
        spinner = document.createElement('div');
        spinner.className = 'my-wave-carousel-spinner';
        spinner.innerHTML = `
          <div class="m3-spinner-container">
            <span class="riff-dots-loader lg" aria-hidden="true"><i></i><i></i><i></i></span>
          </div>
        `;
        wrapper.appendChild(spinner);
      }
      if (spinner) spinner.style.display = 'flex';

      try {
        const ok = await fetchPersonalVibe(true);
        if (!ok) {
          showToast('Could not refresh', 'error');
        }
      } catch (err) {
        showToast('Could not refresh', 'error');
      } finally {
        btn.classList.remove('loading');
        if (wrapper) wrapper.classList.remove('loading');
        if (spinner) spinner.style.display = 'none';
      }
    });
  }


  function initQueuePanel() {
    const btn = document.getElementById('btn-toggle-queue-panel');
    if (!btn || document.getElementById('np-queue-panel')) return;

    const panel = document.createElement('aside');
    panel.id = 'np-queue-panel';
    panel.className = 'np-queue-panel';
    panel.innerHTML = `
      <div class="np-queue-head">
        <nav class="np-queue-tabs" id="np-queue-tabs">
          <button type="button" class="np-queue-tab active" data-tab="queue">
            <span data-i18n>Queue</span>
          </button>
          <button type="button" class="np-queue-tab" data-tab="recent">
            <span data-i18n>Recently played</span>
          </button>
          <span class="np-queue-tab-line" id="np-queue-tab-line"></span>
        </nav>
        <button type="button" class="btn-icon-pill np-queue-close" aria-label="Close" title="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
      <div class="np-queue-autoplay-bar">
        <span class="np-queue-autoplay-label" data-i18n>Autoplay</span>
        <button type="button" class="effect-switch-btn" id="btn-queue-autoplay"><span class="thumb"></span></button>
      </div>
      <div class="np-queue-body" id="np-queue-body"></div>`;
    document.body.appendChild(panel);

    const body = panel.querySelector('#np-queue-body');
    const tabsNav = panel.querySelector('#np-queue-tabs');
    const tabLine = panel.querySelector('#np-queue-tab-line');
    let tab = 'queue';
    let signature = '';

    const updateTabLine = () => {
      const activeBtn = tabsNav ? tabsNav.querySelector('.np-queue-tab.active') : null;
      if (!activeBtn || !tabLine || !tabsNav) return;
      const navRect = tabsNav.getBoundingClientRect();
      const btnRect = activeBtn.getBoundingClientRect();
      const scale = parseFloat(document.documentElement.style.getPropertyValue('--app-scale')) || 1;
      if (navRect.width > 0 && btnRect.width > 0) {
        const lineW = Math.min(44, Math.max(28, (btnRect.width / scale) * 0.45));
        const leftPx = ((btnRect.left - navRect.left) / scale) + ((btnRect.width / scale) - lineW) / 2;
        tabLine.style.width = `${lineW.toFixed(1)}px`;
        tabLine.style.transform = `translate3d(${leftPx.toFixed(1)}px, 0, 0)`;
      }
    };

    const makeRow = (track, onClick, playing, idx = 0) => {
      const row = document.createElement('div');
      row.className = 'np-queue-row' + (playing ? ' playing' : '');
      row.style.setProperty('--q-idx', String(idx));
      const thumb = typeof getTrackThumbUrl === 'function' ? getTrackThumbUrl(track) : '';
      const art = document.createElement('div');
      art.className = 'np-queue-art';
      if (thumb) {
        const img = document.createElement('img');
        img.alt = '';
        img.loading = 'lazy';
        img.addEventListener('error', () => { img.remove(); });
        img.src = thumb;
        art.appendChild(img);
      }
      const info = document.createElement('div');
      info.className = 'np-queue-info';
      const title = document.createElement('span');
      title.className = 'np-queue-title';
      title.textContent = track.title || 'Untitled';
      const artist = document.createElement('span');
      artist.className = 'np-queue-artist';
      artist.textContent = track.artist || '';
      info.append(title, artist);
      row.append(art, info);
      if (onClick) row.addEventListener('click', onClick);
      return row;
    };

    const heading = (text) => {
      const h = document.createElement('div');
      h.className = 'np-queue-heading';
      h.textContent = typeof t === 'function' ? t(text) : text;
      return h;
    };

    const render = (animateSwitch = false) => {
      body.innerHTML = '';
      if (animateSwitch && !document.body.classList.contains('perf')) {
        body.style.animation = 'none';
        void body.offsetWidth;
        body.style.animation = 'artistPaneSlideIn 220ms cubic-bezier(0.2, 0, 0, 1) both';
      }
      const current = state.currentTrack;
      if (tab === 'recent') {
        const recent = (state.history || []).filter(Boolean).slice(0, 40);
        if (!recent.length) {
          const empty = document.createElement('div');
          empty.className = 'np-queue-empty';
          empty.textContent = typeof t === 'function' ? t('Nothing played yet') : 'Nothing played yet';
          body.appendChild(empty);
          return;
        }
        recent.forEach((tr, i) => body.appendChild(makeRow(tr, () => playTrack(tr, recent, recent.indexOf(tr)), false, i)));
        return;
      }
      if (!current) {
        const empty = document.createElement('div');
        empty.className = 'np-queue-empty';
        empty.textContent = typeof t === 'function' ? t('Nothing is playing') : 'Nothing is playing';
        body.appendChild(empty);
        return;
      }
      body.appendChild(heading('Now playing'));
      body.appendChild(makeRow(current, null, true, 0));
      const start = Math.max(0, state.queueIndex + 1);
      const upcoming = (state.queue || []).slice(start, start + 50);
      if (upcoming.length) {
        body.appendChild(heading('Next up'));
        upcoming.forEach((tr, i) => {
          const idx = start + i;
          body.appendChild(makeRow(tr, () => {
            state.queueIndex = idx;
            if (typeof recordPlayedIndex === 'function') recordPlayedIndex(idx);
            playTrack(state.queue[idx]);
          }, false, i + 1));
        });
      } else {
        const empty = document.createElement('div');
        empty.className = 'np-queue-empty';
        empty.textContent = typeof t === 'function' ? t('Nothing queued next') : 'Nothing queued next';
        body.appendChild(empty);
      }
    };

    const currentSignature = () => {
      const cur = state.currentTrack;
      const q = state.queue || [];
      const upcoming = q.slice(state.queueIndex + 1, state.queueIndex + 51)
        .map(track => getTrackCanonicalId(track)).join(',');
      return [tab, cur ? getTrackCanonicalId(cur) : '', state.queueIndex, q.length, upcoming, (state.history || []).length].join('|');
    };

    const btnAutoplay = panel.querySelector('#btn-queue-autoplay');
    const syncAutoplaySwitch = () => {
      if (btnAutoplay && typeof autoplayEnabled === 'function') {
        btnAutoplay.classList.toggle('active', autoplayEnabled());
      }
      const btnSbQueue = document.getElementById('btn-sb-queue-autoplay');
      if (btnSbQueue && typeof autoplayEnabled === 'function') {
        btnSbQueue.classList.toggle('active', autoplayEnabled());
      }
    };
    syncAutoplaySwitch();

    if (btnAutoplay) {
      btnAutoplay.addEventListener('click', () => {
        const next = !autoplayEnabled();
        setAdv('autoplay', next);
        btnAutoplay.classList.toggle('active', next);
        const btnSbQueue = document.getElementById('btn-sb-queue-autoplay');
        if (btnSbQueue) btnSbQueue.classList.toggle('active', next);
        if (!next) {
          const head = (state.queue || []).slice(0, state.queueIndex + 1);
          const tail = (state.queue || []).slice(state.queueIndex + 1).filter(t => !t || t._isAutoplay !== true);
          state.queue = [...head, ...tail];
          if (typeof updateQueueBadge === 'function') updateQueueBadge();
          if (state.currentView === 'queue' && typeof renderQueueView === 'function') {
            renderQueueView();
          }
          if (typeof currentSidebarLibFilter !== 'undefined' && currentSidebarLibFilter === 'queue' && typeof renderSidebarLibraryFeed === 'function') {
            renderSidebarLibraryFeed(false);
          }
          signature = '';
          render(false);
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
          if (typeof currentSidebarLibFilter !== 'undefined' && currentSidebarLibFilter === 'queue' && typeof renderSidebarLibraryFeed === 'function') {
            renderSidebarLibraryFeed(false);
          }
          signature = '';
          render(false);
        }
      });
    }

    const refresh = (animateSwitch = false) => {
      syncAutoplaySwitch();
      if (!panel.classList.contains('open')) return;
      const sig = currentSignature();
      if (sig === signature && !animateSwitch) return;
      signature = sig;
      render(animateSwitch);
      requestAnimationFrame(updateTabLine);
    };

    window.refreshQueuePanel = () => { signature = ''; refresh(false); };

    const setOpen = (open) => {
      panel.classList.toggle('open', open);
      btn.classList.toggle('active', open);
      localStorage.setItem('riff_queue_panel_open', open ? '1' : '0');
      signature = '';
      syncAutoplaySwitch();
      refresh(false);
      setTimeout(updateTabLine, 40);
    };

    btn.addEventListener('click', () => setOpen(!panel.classList.contains('open')));
    panel.querySelector('.np-queue-close').addEventListener('click', () => setOpen(false));
    panel.querySelectorAll('.np-queue-tab').forEach(tabBtn => {
      tabBtn.addEventListener('click', () => {
        if (tab === tabBtn.dataset.tab) return;
        tab = tabBtn.dataset.tab;
        panel.querySelectorAll('.np-queue-tab').forEach(x => x.classList.toggle('active', x === tabBtn));
        updateTabLine();
        signature = '';
        refresh(true);
      });
    });
    window.addEventListener('resize', updateTabLine);
    setInterval(() => refresh(false), 700);
    localStorage.removeItem('riff_queue_panel_open');
  }



window.audioEngine = audioEngine;
window.hlsInstance = hlsInstance;
window.playTrack = playTrack;
window.playSmooth = playSmooth;
window.pauseSmooth = pauseSmooth;
window.togglePlayPause = togglePlayPause;
window.playNext = playNext;
window.playPrev = playPrev;
window.addTrackToQueue = addTrackToQueue;
window.renderQueue = renderQueue;
window.getSmoothAudioTime = getSmoothAudioTime;

