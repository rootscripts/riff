
'use strict';

(function initRiffDiskStorageDaemon() {
if (!window.electronAPI || typeof window.electronAPI.storageInitSync !== 'function') return;
const origGet = Storage.prototype.getItem;
const origSet = Storage.prototype.setItem;
const origRemove = Storage.prototype.removeItem;
const origClear = Storage.prototype.clear;
const origKey = Storage.prototype.key;

let diskMap = window.electronAPI.storageInitSync();
let migrated = false;

if (!diskMap || typeof diskMap !== 'object' || Object.keys(diskMap).length === 0) {
diskMap = {};
try {
const len = window.localStorage.length;
for (let i = 0; i < len; i++) {
const k = origKey.call(window.localStorage, i);
if (k) diskMap[k] = origGet.call(window.localStorage, k);
}
if (Object.keys(diskMap).length > 0) migrated = true;
} catch (_) {}
} else {
try {
const len = window.localStorage.length;
for (let i = 0; i < len; i++) {
const k = origKey.call(window.localStorage, i);
if (k && !Object.prototype.hasOwnProperty.call(diskMap, k)) {
diskMap[k] = origGet.call(window.localStorage, k);
migrated = true;
}
}
} catch (_) {}
}

try { origClear.call(window.localStorage); } catch (_) {}
window.__RIFF_STORAGE_MAP__ = diskMap;

if (migrated) {
window.electronAPI.storageSaveSync(diskMap);
}

let flushTimer = null;
function flushAsync() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    window.electronAPI.storageSaveBatch(diskMap);
  }, 200);
}
window.flushAsync = flushAsync;
window.flushSync = flushAsync;
window.addEventListener('beforeunload', () => {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
    try { window.electronAPI.storageSaveSync(diskMap); } catch (_) {}
  }
});

Storage.prototype.getItem = function(key) {
if (this === window.localStorage) {
const k = String(key);
return Object.prototype.hasOwnProperty.call(diskMap, k) ? diskMap[k] : null;
}
return origGet.call(this, key);
};

Storage.prototype.setItem = function(key, val) {
if (this === window.localStorage) {
const k = String(key);
const v = String(val);
if (diskMap[k] === v) return;
diskMap[k] = v;
flushAsync();
return;
}
origSet.call(this, key, val);
};

Storage.prototype.removeItem = function(key) {
if (this === window.localStorage) {
const k = String(key);
if (Object.prototype.hasOwnProperty.call(diskMap, k)) {
delete diskMap[k];
flushAsync();
}
return;
}
origRemove.call(this, key);
};

Storage.prototype.clear = function() {
if (this === window.localStorage) {
diskMap = {};
window.__RIFF_STORAGE_MAP__ = diskMap;
flushAsync();
return;
}
origClear.call(this);
};

Storage.prototype.key = function(index) {
if (this === window.localStorage) {
const keys = Object.keys(diskMap);
return keys[index] !== undefined ? keys[index] : null;
}
return origKey.call(this, index);
};

try {
Object.defineProperty(Storage.prototype, 'length', {
configurable: true,
get: function() {
if (this === window.localStorage) return Object.keys(diskMap).length;
return 0;
}
});
} catch (_) {}

window.addEventListener('beforeunload', () => {
try { window.electronAPI.storageSaveSync(diskMap); } catch (_) {}
});
})();

  var currentSidebarLibFilter = 'playlists';
  var SIDEBAR_PINNED_TRACKS_KEY = 'riff_sidebar_pinned_tracks';
  var SIDEBAR_LIBRARY_TRACKS_KEY = 'riff_sidebar_library_tracks';
  var PINNED_PLAYLISTS_KEY = 'riff_pinned_playlists';
  var playlistRecsCache = new Map();
  var manualLyricsOffset = 0, manualLyricsTargetOffset = 0, wheelRafId = 0, wheelReturnTimer = null;
  var cachedActiveGapEl = null, cachedTvkScrubber = null, cachedLyricsValidLines = null, cachedLyricsRef = null;

  var state = {
    vibeTracks: [],
    _autoplayAnchorSeeds: [],
    _autoplayPool: [],
    isLoadingLyrics: false,
    lyricsLoaded: false,
    audioSettings: { speed: 1.0, speedPitch: 1.0, pitch: 0, reverb: 0, distortion: 0, volume: 1.0, echo: 0, eq: { low: 0, mid: 0, high: 0 }, eqBands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    hqSettings: { engine: 'hqmusic-3', preset: 'studio', vocal: 0, air: 0, bass: 0 },
    playlists: [],
    favorites: [],
    localTracks: [],
    history: [],
    queue: [],
    queueIndex: 0,
    currentTrack: null,
    isPlaying: false
  };
  var myWaveCurrentTracks = [];
  var maybeShowYtAuthSheet = async function() {};
  window.maybeShowYtAuthSheet = maybeShowYtAuthSheet;
  window.beginBusy = window.beginBusy || function() {};
  window.endBusy = window.endBusy || function() {};
  try { localStorage.removeItem('riff_stats'); } catch (e) {}


(async () => {
  try {
    if (window.HomeCache && typeof window.HomeCache.init === 'function') {
      await window.HomeCache.init();
      const cachedVibe = window.HomeCache.get('home_vibe') || safeJson('riff_my_wave_cache', []);
      if (cachedVibe && cachedVibe.length > 0) {
        state.vibeTracks = cachedVibe;
        myWaveCurrentTracks = cachedVibe;
      }
      const cachedMixes = window.HomeCache.get('daily_mixes', 24 * 3600 * 1000) || safeJson('riff_daily_mixes', null);
      if (cachedMixes && Array.isArray(cachedMixes.mixes) && cachedMixes.mixes.length > 0) {
        try {
          localStorage.setItem('riff_daily_mixes', JSON.stringify(cachedMixes));
        } catch (_) {}
      }
    }
  } catch (err) {
    console.warn('HomeCache init error:', err);
  }
})();
  var lyricsScrollRaf = 0;
  var gradientRaf = 0;
  var cacheRafId = 0;
  var cacheModal = null;
  var syncState = { active: false, canTap: false, track: null, lines: [], currentIndex: 0 };
  var isDraggingTvkSeek = false;
  var m3c = { canvas: null, ctx: null, img: new Image(), imgReady: false, from: 0, to: 0, start: 0, raf: 0, last: 0, phase: 0, hoverProgress: 0, isHovered: false, rotation: 0, rotRate: 0.25, targetRate: 0.25 };


  var defaultPresets = [
    { id: 'p_default', name: 'Default', settings: { speed: 1.0, speedPitch: 1.0, pitch: 0, reverb: 0, distortion: 0, volume: 1.0, echo: 0, eq: { low: 0, mid: 0, high: 0 }, eqBands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] } },
    { id: 'p_speedup', name: 'Speed up (orig pitch)', settings: { speed: 1.35, speedPitch: 1.0, pitch: 0, reverb: 0, distortion: 0, volume: 1.0, echo: 0, eq: { low: 0, mid: 0, high: 0 }, eqBands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] } },
    { id: 'p_speedup_pitch', name: 'Speed up', settings: { speed: 1.0, speedPitch: 1.30, pitch: 0, reverb: 0, distortion: 0, volume: 1.0, echo: 0, eq: { low: 0, mid: 0, high: 0 }, eqBands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] } },
    { id: 'p_slowed', name: 'Slowed + reverb', settings: { speed: 1.0, speedPitch: 0.82, pitch: 0, reverb: 65, distortion: 0, volume: 1.0, echo: 15, eq: { low: 0, mid: 0, high: 0 }, eqBands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] } },
    { id: 'p_nightcore', name: 'Nightcore', settings: { speed: 1.0, speedPitch: 1.25, pitch: 0, reverb: 20, distortion: 0, volume: 1.0, echo: 0, eq: { low: 0, mid: 0, high: 0 }, eqBands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] } },
    { id: 'p_distortion', name: 'Distortion', settings: { speed: 1.0, speedPitch: 1.0, pitch: 0, reverb: 0, distortion: 75, volume: 1.25, echo: 0, eq: { low: 0, mid: 0, high: 0 }, eqBands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] } }
  ];

  var defaultVfx = {
    ambientGlow: true,
    bassPulse: false,
    vinylSpin: false,
    soundwaveRings: false,
    borderGlow: false,
    particles: false,
    backdropBlur: false,
    crt: false,
    grain: false,
    lyricsSpotlight: false
  };

  function normalizePreset(p) {
    if (!p) return null;
    const s = p.settings || p.values || {};
    const eq = s.eq || {};
    return {
      id: p.id,
      name: p.name || 'preset',
      settings: {
        speed: typeof s.speed === 'number' ? s.speed : 1.0,
        speedPitch: typeof s.speedPitch === 'number' ? s.speedPitch : 1.0,
        pitch: typeof s.pitch === 'number' ? s.pitch : (typeof s.pitchSemitones === 'number' ? s.pitchSemitones : 0),
                          reverb: typeof s.reverb === 'number' ? s.reverb : 0,
                          distortion: typeof s.distortion === 'number' ? s.distortion : 0,
                          volume: typeof s.volume === 'number' ? s.volume : (typeof s.gain === 'number' ? s.gain : 1.0),
                          echo: typeof s.echo === 'number' ? s.echo : 0,
                          eq: {
                            low: typeof eq.low === 'number' ? eq.low : 0,
                            mid: typeof eq.mid === 'number' ? eq.mid : 0,
                            high: typeof eq.high === 'number' ? eq.high : 0
                          },
                          eqBands: Array.isArray(s.eqBands) && s.eqBands.length === 10 ? s.eqBands.map(v => typeof v === 'number' ? v : 0) : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      }
    };
  }

  function safeJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function safeArray(key) {
    const value = safeJson(key, []);
    return Array.isArray(value) ? value : [];
  }

  var rawCustomPresets = safeArray('devsize_custom_presets');
  var normalizedCustomPresets = rawCustomPresets.map(normalizePreset).filter(Boolean);
window.normalizePreset = normalizePreset;
window.safeJson = safeJson;
window.safeArray = safeArray;

  var savedVolumeRaw = parseFloat(localStorage.getItem('riff_volume'));
  var savedVolume = Number.isFinite(savedVolumeRaw) ? Math.max(0, Math.min(1, savedVolumeRaw)) : 0.85;

  var DEFAULT_AUDIO_SETTINGS = { speed: 1.0, speedPitch: 1.0, pitch: 0, reverb: 0, distortion: 0, volume: 1.0, echo: 0, eq: { low: 0, mid: 0, high: 0 }, eqBands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] };
  var DEFAULT_HQ_SETTINGS = { engine: 'hqmusic-3', preset: 'studio', vocal: 0, air: 0, bass: 0 };
  var soundPersistenceEnabled = localStorage.getItem('riff_persist_sound_settings') === '1';

  function loadSoundSettings() {
    if (!soundPersistenceEnabled) {
      return {
        audioSettings: { ...DEFAULT_AUDIO_SETTINGS, eq: { ...DEFAULT_AUDIO_SETTINGS.eq }, eqBands: [...DEFAULT_AUDIO_SETTINGS.eqBands] },
        hqEnabled: false,
        hqSettings: { ...DEFAULT_HQ_SETTINGS }
      };
    }
    const savedAudio = safeJson('riff_audio_settings', null);
    const savedHq = safeJson('riff_hq_settings', null);
    const audioObj = savedAudio && typeof savedAudio === 'object' ? savedAudio : {};
    const hqObj = savedHq && typeof savedHq === 'object' ? savedHq : {};
    return {
      audioSettings: {
        ...DEFAULT_AUDIO_SETTINGS,
        ...audioObj,
        eq: { ...DEFAULT_AUDIO_SETTINGS.eq, ...(audioObj.eq && typeof audioObj.eq === 'object' ? audioObj.eq : {}) },
        eqBands: Array.isArray(audioObj.eqBands) && audioObj.eqBands.length === 10 ? audioObj.eqBands.map(v => typeof v === 'number' ? v : 0) : [...DEFAULT_AUDIO_SETTINGS.eqBands]
      },
      hqEnabled: localStorage.getItem('riff_hq_enabled') === '1',
      hqSettings: { ...DEFAULT_HQ_SETTINGS, ...hqObj }
    };
  }

  var savedSound = loadSoundSettings();


  var el = {
    btnMinimize: document.getElementById('btn-minimize'),
                          btnMaximize: document.getElementById('btn-maximize'),
                          btnClose: document.getElementById('btn-close'),

                          searchInput: document.getElementById('search-input'),
                          searchClearBtn: document.getElementById('search-clear-btn'),
                          searchIconBtn: document.getElementById('search-icon-btn'),
                          platformYt: document.getElementById('platform-yt'),
                          platformYtm: document.getElementById('platform-ytm'),
                          platformSc: document.getElementById('platform-sc'),

                          navActiveIndicator: document.getElementById('nav-active-indicator'),
                          navDiscover: document.getElementById('nav-discover'),
                          navFavorites: document.getElementById('nav-favorites'),
                          navAlbums: document.getElementById('nav-albums'),
                          navLocal: document.getElementById('nav-local'),
                          navHistory: document.getElementById('nav-history'),
                          navQueue: document.getElementById('nav-queue'),
                          navSettings: document.getElementById('nav-settings'),
                          favoritesCount: document.getElementById('favorites-count'),
                          albumsCount: document.getElementById('albums-count'),
                          localCount: document.getElementById('local-count'),
                          queueCount: document.getElementById('queue-count'),
                          historyCount: document.getElementById('history-count'),

                          presetsContainer: document.getElementById('presets-container'),
                          btnSavePresetDialog: document.getElementById('btn-save-preset-dialog'),
                          savePresetModal: document.getElementById('save-preset-modal'),
                          newPresetName: document.getElementById('new-preset-name'),
                          btnCancelPreset: document.getElementById('btn-cancel-preset'),
                          btnConfirmSavePreset: document.getElementById('btn-confirm-save-preset'),

                          renamePresetModal: document.getElementById('rename-preset-modal'),
                          renamePresetName: document.getElementById('rename-preset-name'),
                          btnCancelRenamePreset: document.getElementById('btn-cancel-rename-preset'),
                          btnConfirmRenamePreset: document.getElementById('btn-confirm-rename-preset'),

                          playlistsList: document.getElementById('playlists-list'),
                          btnNewPlaylist: document.getElementById('btn-new-playlist'),

                          viewDiscover: document.getElementById('view-discover'),
                          viewFavorites: document.getElementById('view-favorites'),
                          viewAlbums: document.getElementById('view-albums'),
                          savedAlbumsGrid: document.getElementById('saved-albums-grid'),
                          viewLocal: document.getElementById('view-local'),
                          viewHistory: document.getElementById('view-history'),
                          viewQueue: document.getElementById('view-queue'),
                          viewPlaylistDetail: document.getElementById('view-playlist-detail'),
                          viewAlbum: document.getElementById('view-album'),
                          viewArtist: document.getElementById('view-artist'),
                          viewSettings: document.getElementById('view-settings'),

                          btnBackAlbum: document.getElementById('btn-back-album'),
                          btnSaveAlbum: document.getElementById('btn-save-album'),
                          albumDetailCover: document.getElementById('album-detail-cover'),
                          albumDetailTitle: document.getElementById('album-detail-title'),
                          albumDetailArtist: document.getElementById('album-detail-artist'),
                          albumDetailCount: document.getElementById('album-detail-count'),
                          btnPlayAlbum: document.getElementById('btn-play-album'),
                          albumTracksList: document.getElementById('album-tracks-list'),

                          btnBackArtist: document.getElementById('btn-back-artist'),
                          artistHeroImg: document.getElementById('artist-hero-img'),
                          artistFansLine: document.getElementById('artist-fans-line'),
                          artistVerifiedBadge: document.getElementById('artist-verified-badge'),
                          artistProfileName: document.getElementById('artist-profile-name'),
                          artistProfileBio: document.getElementById('artist-profile-bio'),
                          btnPlayArtistTracks: document.getElementById('btn-play-artist-tracks'),
                          artistTracksCount: document.getElementById('artist-tracks-count'),
                          artistTracksList: document.getElementById('artist-tracks-list'),

                          discoverEmpty: document.getElementById('discover-empty'),
                          discoverHome: document.getElementById('discover-home'),
                          searchResultsContainer: document.getElementById('search-results-container'),
                          searchResults: document.getElementById('search-results-container'),
                          searchTracksList: document.getElementById('search-tracks-list'),
                          mainContent: document.getElementById('main-content') || document.querySelector('.main-content'),
                          suggestionChips: document.getElementById('suggestion-chips'),

                          favoritesTracksList: document.getElementById('favorites-tracks-list'),
                          favoritesSearchInput: document.getElementById('favorites-search-input'),
                          favoritesSort: document.getElementById('favorites-sort'),
                          localSort: document.getElementById('local-sort'),
                          playlistSearchInput: document.getElementById('playlist-search-input'),
                          playlistSort: document.getElementById('playlist-sort'),
                          favoritesSubtitle: document.getElementById('favorites-subtitle'),
                          localTracksList: document.getElementById('local-tracks-list'),
                          localSearchInput: document.getElementById('local-search-input'),
                          localSubtitle: document.getElementById('local-subtitle'),
                          btnPlayLocal: document.getElementById('btn-play-local'),
                          btnShuffleLocal: document.getElementById('btn-shuffle-local'),
                          btnAddLocal: document.getElementById('btn-add-local') || document.getElementById('btn-add-local-files'),
                          btnAddLocalFiles: document.getElementById('btn-add-local') || document.getElementById('btn-add-local-files'),
                          btnAddLocalFolder: document.getElementById('btn-add-local-folder'),
                          btnAddLocalFilesEmpty: document.getElementById('btn-add-local-files-empty'),
                          localAlbumsRow: document.getElementById('local-albums-row'),
                          historyTracksList: document.getElementById('history-tracks-list'),
                          btnClearHistory: document.getElementById('btn-clear-history'),
                          queueTracksList: document.getElementById('queue-tracks-list'),
                          btnClearQueue: document.getElementById('btn-clear-queue'),
                          playlistTracksList: document.getElementById('playlist-tracks-list'),
                          playlistDetailTitle: document.getElementById('playlist-detail-title'),
                          btnEditPlaylistTitle: document.getElementById('btn-edit-playlist-title'),
                          playlistDetailCount: document.getElementById('playlist-detail-count'),
                          btnBackPlaylists: document.getElementById('btn-back-playlists'),
                          btnPlayPlaylist: document.getElementById('btn-play-playlist'),
                          btnDeletePlaylist: document.getElementById('btn-delete-playlist'),

                          rightPanel: document.getElementById('right-panel'),
                          btnCloseRightPanel: document.getElementById('btn-close-right-panel'),
                          btnToggleLyricsPanel: document.getElementById('btn-toggle-lyrics-panel'),
                          btnPlaybarKaraoke: document.getElementById('btn-playbar-karaoke'),
                          btnLyricsMode: document.getElementById('btn-lyrics-mode'),
                          coverContainer: document.getElementById('cover-container'),
                          rightPanelArtworkBox: document.getElementById('right-panel-artwork-box'),
                          rightPanelCover: document.getElementById('right-panel-cover'),
                          rightPanelFallback: document.getElementById('right-panel-fallback'),
                          rightPanelTitle: document.getElementById('right-panel-title'),
                          rightPanelArtist: document.getElementById('right-panel-artist'),
                          lyricsStatus: document.getElementById('lyrics-status'),
                          lyricsContainer: document.getElementById('lyrics-container'),
                          lyricsHint: document.getElementById('lyrics-hint'),
                          btnTranslateLyrics: document.getElementById('btn-translate-lyrics'),
                          btnTrEnabled: document.getElementById('btn-tr-enabled'),
                          selectTrLang: document.getElementById('select-tr-lang'),
                          btnTrAuto: document.getElementById('btn-tr-auto'),
                          btnTvKaraoke: document.getElementById('btn-tv-karaoke'),
                          tvKaraoke: document.getElementById('tv-karaoke'),
                          tvBg: document.getElementById('tv-bg'),
                          tvCover: document.getElementById('tv-cover'),
                          tvKaraokeContent: document.getElementById('tv-karaoke-content'),
                          tvKaraokeClose: document.getElementById('btn-close-tv-karaoke'),
                          tvKaraokeTitle: document.getElementById('tv-karaoke-title'),
                          tvKaraokeArtist: document.getElementById('tv-karaoke-artist'),
                          tvkTimeCurrent: document.getElementById('tvk-time-current'),
                          tvkTimeDuration: document.getElementById('tvk-time-duration'),
                          tvkSeekSlider: document.getElementById('tvk-seek-slider'),

                          playbar: document.getElementById('playbar'),
                          playbarArtwork: document.getElementById('playbar-artwork'),
                          artworkFallback: document.getElementById('artwork-fallback'),
                          playbarTitle: document.getElementById('playbar-title'),
                          playbarArtist: document.getElementById('playbar-artist'),
                          btnToggleFav: document.getElementById('btn-toggle-fav'),
                          favIcon: document.getElementById('fav-icon'),
                          btnShuffle: document.getElementById('btn-shuffle'),
                          btnPrev: document.getElementById('btn-prev'),
                          btnPlayPause: document.getElementById('btn-play-pause'),
                          playIcon: document.getElementById('play-icon'),
                          pauseIcon: document.getElementById('pause-icon'),
                          playbarSpinner: document.getElementById('playbar-spinner'),
                          btnNext: document.getElementById('btn-next'),
                          btnRepeat: document.getElementById('btn-repeat'),

                          timeCurrent: document.getElementById('time-current'),
                          timeDuration: document.getElementById('time-duration'),
                          scrubberTrack: document.getElementById('scrubber-track'),
                          progressEl: document.getElementById('scrubber-track'),
                          scrubberCanvas: document.getElementById('squiggly-canvas'),
                          ccPlayhead: document.getElementById('cc-playhead'),

                          visualizerCanvas: document.getElementById('visualizer-canvas'),
                          btnOpenSettings: document.getElementById('btn-open-settings'),
                          btnOpenVisualSettings: document.getElementById('btn-open-visual-settings'),
                          settingsModifiedDot: document.getElementById('settings-modified-dot'),
                          btnVolumeMute: document.getElementById('btn-volume-mute'),
                          volumeIcon: document.getElementById('volume-icon'),
                          volumeMutedIcon: document.getElementById('volume-muted-icon'),
                          volumeSlider: document.getElementById('volume-slider'),

                          downloadModal: document.getElementById('download-modal'),
                          btnCloseDownloadModal: document.getElementById('btn-close-download-modal'),
                          btnCancelDownload: document.getElementById('btn-cancel-download'),
                          btnConfirmDownload: document.getElementById('btn-confirm-download'),
                          downloadSpinner: document.getElementById('download-spinner'),
                          downloadBtnText: document.getElementById('download-btn-text'),
                          downloadPreviewThumb: document.getElementById('download-preview-thumb'),
                          downloadPreviewFallback: document.getElementById('download-preview-fallback'),
                          downloadPreviewTitle: document.getElementById('download-preview-title'),
                          downloadPreviewArtist: document.getElementById('download-preview-artist'),
                          btnPlaybarMore: document.getElementById('btn-playbar-more'),
                          btnPlaybarShare: document.getElementById('btn-playbar-share'),

                          audioSettingsModal: document.getElementById('audio-settings-modal'),
                          btnCloseSettings: document.getElementById('btn-close-settings'),
                          sleepTimerStatus: document.getElementById('sleep-timer-status'),

                          btnToggleHqAudio: document.getElementById('toggle-hq-audio'),
                          hqEnhancerCard: document.querySelector('.hq-enhancer-card'),
                          hqPanelWrapper: document.getElementById('hq-panel-wrapper'),
                          hqEngineSelect: document.getElementById('hq-engine-select'),
                          sliderHqVocal: document.getElementById('slider-hq-vocal'),
                          valHqVocal: document.getElementById('val-hq-vocal'),
                          sliderHqAir: document.getElementById('slider-hq-air'),
                          valHqAir: document.getElementById('val-hq-air'),
                          sliderHqBass: document.getElementById('slider-hq-bass'),
                          valHqBass: document.getElementById('val-hq-bass'),
                          hqPresetChips: document.querySelectorAll('.hq-preset-chip'),

                          sliderSpeed: document.getElementById('slider-speed'),
                          valSpeed: document.getElementById('val-speed'),
                          sliderSpeedPitch: document.getElementById('slider-speed-pitch'),
                          valSpeedPitch: document.getElementById('val-speed-pitch'),
                          sliderPitch: document.getElementById('slider-pitch'),
                          valPitch: document.getElementById('val-pitch'),
                          sliderReverb: document.getElementById('slider-reverb'),
                          valReverb: document.getElementById('val-reverb'),
                          sliderDistortion: document.getElementById('slider-distortion'),
                          valDistortion: document.getElementById('val-distortion'),
                          sliderGain: document.getElementById('slider-gain'),
                          valGain: document.getElementById('val-gain'),
                          sliderEcho: document.getElementById('slider-echo'),
                          valEcho: document.getElementById('val-echo'),
                          sliderEqLow: document.getElementById('slider-eq-low'),
                          valEqLow: document.getElementById('val-eq-low'),
                          sliderEqMid: document.getElementById('slider-eq-mid'),
                          valEqMid: document.getElementById('val-eq-mid'),
                          sliderEqHigh: document.getElementById('slider-eq-high'),
                          valEqHigh: document.getElementById('val-eq-high'),
                          eqBands: document.getElementById('eq-bands'),
                          btnResetEqBands: document.getElementById('btn-reset-eq-bands'),
                          btnResetAudio: document.getElementById('btn-reset-audio'),

                          sliderScale: document.getElementById('settings-slider-scale') || document.getElementById('slider-scale'),
                          valScale: document.getElementById('settings-val-scale') || document.getElementById('val-scale'),
                          sliderFontScale: document.getElementById('slider-font-scale'),
                          valFontScale: document.getElementById('val-font-scale'),
                          sliderCornerRadius: document.getElementById('slider-corner-radius'),
                          valCornerRadius: document.getElementById('val-corner-radius'),
                          sliderUiAlpha: document.getElementById('slider-ui-alpha'),
                          valUiAlpha: document.getElementById('val-ui-alpha'),
                          btnResetUiAlpha: document.getElementById('btn-reset-ui-alpha'),
                          sliderPanelBlur: document.getElementById('slider-panel-blur'),
                          valPanelBlur: document.getElementById('val-panel-blur'),
                          btnResetPanelBlur: document.getElementById('btn-reset-panel-blur'),
                          btnPlayBtnBg: document.getElementById('btn-play-btn-bg'),
                          themeModeBtns: document.querySelectorAll('.theme-mode-btn[data-theme-mode]'),
                          themeSwatches: document.querySelectorAll('.theme-swatch'),
                          customColorInput: document.getElementById('settings-custom-color-input'),
                          sliderHue: document.getElementById('slider-theme-hue'),
                          valHue: document.getElementById('val-theme-hue'),
                          sliderIntensity: document.getElementById('slider-theme-intensity'),
                          valIntensity: document.getElementById('val-theme-intensity'),
                          sliderBrightness: document.getElementById('slider-theme-brightness'),
                          valBrightness: document.getElementById('val-theme-brightness'),

                          visualSettingsModal: document.getElementById('visual-settings-modal'),
                          btnCloseVisualSettings: document.getElementById('btn-close-visual-settings'),
                          btnResetVfx: document.getElementById('btn-reset-vfx'),

                          createPlaylistModal: document.getElementById('create-playlist-modal'),
                          newPlaylistInput: document.getElementById('new-playlist-input'),
                          btnCancelNewPlaylist: document.getElementById('btn-cancel-new-playlist'),
                          btnConfirmNewPlaylist: document.getElementById('btn-confirm-new-playlist'),

                          addToPlaylistModal: document.getElementById('add-to-playlist-modal'),
                          playlistPickList: document.getElementById('playlist-pick-list'),
                          btnCancelAddPlaylist: document.getElementById('btn-cancel-add-playlist'),
                          linkImportModal: document.getElementById('link-import-modal'),

                          nativeAudio: document.getElementById('native-audio'),
                          trackLoadingOverlay: document.getElementById('track-loading-overlay'),
                          trackLoadingTitle: document.getElementById('track-loading-title'),
                          trackLoadingSub: document.getElementById('track-loading-sub'),

                          btnAddCustomLyrics: document.getElementById('btn-add-custom-lyrics'),
                          btnSyncLyrics: document.getElementById('btn-sync-lyrics'),
                          btnTvkEditLyrics: document.getElementById('btn-tvk-edit-lyrics'),
                          btnTvkSyncLyrics: document.getElementById('btn-tvk-sync-lyrics'),
                          customLyricsModal: document.getElementById('custom-lyrics-modal'),
                          customLyricsTextarea: document.getElementById('custom-lyrics-textarea'),
                          customLyricsTrackTitle: document.getElementById('custom-lyrics-track-title'),
                          customLyricsTrackArtist: document.getElementById('custom-lyrics-track-artist'),
                          btnCloseCustomLyrics: document.getElementById('btn-close-custom-lyrics'),
                          btnCancelCustomLyrics: document.getElementById('btn-cancel-custom-lyrics'),
                          btnSaveCustomLyrics: document.getElementById('btn-save-custom-lyrics'),
                          syncModeOverlay: document.getElementById('sync-mode-overlay'),
                          syncModeLyrics: document.getElementById('sync-mode-lyrics'),
                          syncProgressText: document.getElementById('sync-progress-text'),
                          btnRestartSync: document.getElementById('btn-restart-sync'),
                          btnSaveSync: document.getElementById('btn-save-sync'),
                          btnCancelSync: document.getElementById('btn-cancel-sync'),

                          btnEditCurrentTrack: document.getElementById('btn-edit-current-track'),
                          renameTrackModal: document.getElementById('rename-track-modal'),
                          inputRenameTitle: document.getElementById('rename-track-title'),
                          inputRenameArtist: document.getElementById('rename-track-artist'),
                          inputRenameAlbum: document.getElementById('rename-track-album'),
                          inputRenameUrl: document.getElementById('rename-track-url'),
                          renameTitleInput: document.getElementById('rename-track-title'),
                          renameArtistInput: document.getElementById('rename-track-artist'),
                          renameAlbumInput: document.getElementById('rename-track-album'),
                          renameUrlInput: document.getElementById('rename-track-url'),
                          btnCancelRenameTrack: document.getElementById('btn-cancel-rename-track'),
                          btnConfirmRenameTrack: document.getElementById('btn-confirm-rename-track'),

                          btnRefreshVibe: document.getElementById('btn-refresh-vibe')
  };


state.audioSettings = state.audioSettings || { ...DEFAULT_AUDIO_SETTINGS };
state.hqSettings = state.hqSettings || { ...DEFAULT_HQ_SETTINGS };
state.playlists = Array.isArray(state.playlists) ? state.playlists : [];
state.favorites = Array.isArray(state.favorites) ? state.favorites : [];
state.localTracks = Array.isArray(state.localTracks) ? state.localTracks : [];
state.history = Array.isArray(state.history) ? state.history : [];
state.customPresets = Array.isArray(normalizedCustomPresets) ? normalizedCustomPresets : [];
state.vfx = state.vfx || { ...defaultVfx };
state.queue = Array.isArray(state.queue) ? state.queue : [];

var EQ_BAND_LABELS = ['32', '64', '125', '250', '500', '1k', '2k', '4k', '8k', '16k'];
window.EQ_BAND_LABELS = EQ_BAND_LABELS;

var SF_FONT_STACK = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", sans-serif';
window.SF_FONT_STACK = SF_FONT_STACK;

var pluginListeners = [];
window.pluginListeners = pluginListeners;

var activeStreamRecovery = null;
window.activeStreamRecovery = activeStreamRecovery;

var audioEngine = window.audioEngine || (window.RiffAudioEngine ? new window.RiffAudioEngine() : null);
window.audioEngine = audioEngine;


var selectedFormat = localStorage.getItem('riff_download_format') || 'mp3';
window.selectedFormat = selectedFormat;
var downloadBatch = null;
window.downloadBatch = downloadBatch;
var selectedQuality = '0';
window.selectedQuality = selectedQuality;

window.state = state;




var isDraggingScrubber = false;
window.isDraggingScrubber = isDraggingScrubber;

var isHoveringScrubber = false;
window.isHoveringScrubber = isHoveringScrubber;

var isHoveringTvkScrubber = false;
window.isHoveringTvkScrubber = isHoveringTvkScrubber;

var isDraggingTvkScrubber = false;
window.isDraggingTvkScrubber = isDraggingTvkScrubber;

var isPauseFading = false;
window.isPauseFading = isPauseFading;

var frozenCurTime = 0;
window.frozenCurTime = frozenCurTime;

var trackToDownload = null;
window.trackToDownload = trackToDownload;

var trimDraft = null;
window.trimDraft = trimDraft;

var currentAudioOutputDeviceId = localStorage.getItem('riff_audio_output_device') || 'default';
window.currentAudioOutputDeviceId = currentAudioOutputDeviceId;

var currentWaveFocusedIndex = 0;
window.currentWaveFocusedIndex = currentWaveFocusedIndex;

var customThemes = [];
window.customThemes = customThemes;

var pluginsCache = [];
window.pluginsCache = pluginsCache;

var activeShortcuts = null;
window.activeShortcuts = activeShortcuts;

var streamPrefetchQueue = [];
window.streamPrefetchQueue = streamPrefetchQueue;

var cachedTrackIds = new Set();
window.cachedTrackIds = cachedTrackIds;

var hasDrawnPausedFrame = false;
window.hasDrawnPausedFrame = hasDrawnPausedFrame;

var homeMode = 'normal';
window.homeMode = homeMode;

var isExtendingMyWave = false;
window.isExtendingMyWave = isExtendingMyWave;

var jumpBackCurrentTracks = [];
window.jumpBackCurrentTracks = jumpBackCurrentTracks;

var shuffleProvider = null;
window.shuffleProvider = shuffleProvider;

var smoothFadeToken = 0;
window.smoothFadeToken = smoothFadeToken;

var isAppClosing = false;
window.isAppClosing = isAppClosing;

var isDisableAnimations = localStorage.getItem('riff_disable_animations') === '1';
window.isDisableAnimations = isDisableAnimations;

var scrubProgress = 0;
window.scrubProgress = scrubProgress;

window.el = el;
window.myWaveCurrentTracks = myWaveCurrentTracks;
window.syncState = syncState;
window.m3c = m3c;
window.defaultPresets = defaultPresets;
window.defaultVfx = defaultVfx;
window.DEFAULT_AUDIO_SETTINGS = DEFAULT_AUDIO_SETTINGS;
window.DEFAULT_HQ_SETTINGS = DEFAULT_HQ_SETTINGS;

