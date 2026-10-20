const http = require('http');
const https = require('https');
const url = require('url');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require("child_process");
const { StringDecoder } = require("string_decoder");
const dns = require('dns');
const net = require('net');

const PORT = 38472;
const { CACHE_DIR, CUSTOM_LYRICS_DIR, LYRICS_DIR, THUMBNAILS_DIR, METADATA_PATH, LIBRARY_DIR, LIBRARY_PATH, ytDlpCommand, resolveDownloadDir, resolveBinary } = require('./platform');
const logger = require('./logger');
const { getSystemAudioOutputInfo } = require('./audio-output');

const MAX_BODY_BYTES = 2 * 1024 * 1024;
const SAFE_MEDIA_URL = /^https?:\/\//i;

function isSafeMediaUrl(value) {
  return typeof value === 'string' && SAFE_MEDIA_URL.test(value);
}

function ipv4IsPrivate(a, b) {
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}

function isPrivateIp(address) {
  const kind = net.isIP(address);
  if (kind === 4) {
    const p = address.split('.').map(Number);
    return ipv4IsPrivate(p[0], p[1]);
  }
  if (kind === 6) {
    const h = address.toLowerCase();
    if (h === '::' || h === '::1') return true;
    if (h.startsWith('fe8') || h.startsWith('fe9') || h.startsWith('fea') || h.startsWith('feb')) return true;
    if (h.startsWith('fc') || h.startsWith('fd')) return true;
    const mapped = h.match(/^::ffff:(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (mapped) return ipv4IsPrivate(Number(mapped[1]), Number(mapped[2]));
    return false;
  }
  return true;
}

function normalizeNumericHost(h) {
  if (/^\d+$/.test(h) && h.length < 11) {
    const n = Number(h);
    if (n >= 0 && n <= 0xffffffff) {
      return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
    }
  }
  const hex = h.match(/^0x([0-9a-f]+)$/);
  if (hex) {
    const n = parseInt(hex[1], 16);
    if (n >= 0 && n <= 0xffffffff) {
      return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
    }
  }
  return null;
}

async function isPrivateHost(hostname) {
  let host = (hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) return true;
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return true;
  const numeric = normalizeNumericHost(host);
  if (numeric) host = numeric;
  if (net.isIP(host)) return isPrivateIp(host);
  try {
    const addrs = await dns.promises.lookup(host, { all: true });
    if (!addrs.length) return true;
    return addrs.some((a) => isPrivateIp(a.address));
  } catch (e) {
    return true;
  }
}

function streamFileToResponse(stream, res) {
  stream.on('error', () => {
    if (!res.headersSent) {
      try { res.writeHead(500); } catch (e) {}
    }
    try { res.end('Error reading file'); } catch (e) {}
    try { stream.destroy(); } catch (e) {}
  });
  res.on('close', () => { try { stream.destroy(); } catch (e) {} });
  stream.pipe(res);
}

if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
if (!fs.existsSync(CUSTOM_LYRICS_DIR)) fs.mkdirSync(CUSTOM_LYRICS_DIR, { recursive: true });
if (!fs.existsSync(LYRICS_DIR)) fs.mkdirSync(LYRICS_DIR, { recursive: true });
if (!fs.existsSync(THUMBNAILS_DIR)) fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });
if (!fs.existsSync(LIBRARY_DIR)) fs.mkdirSync(LIBRARY_DIR, { recursive: true });

let trackMetadataIndex = {};
try {
  if (fs.existsSync(METADATA_PATH)) {
    trackMetadataIndex = JSON.parse(fs.readFileSync(METADATA_PATH, 'utf-8'));
  }
} catch (e) {
  trackMetadataIndex = {};
}

function saveTrackMetadata(cleanId, meta) {
  if (!cleanId) return;
  trackMetadataIndex[cleanId] = {
    ...(trackMetadataIndex[cleanId] || {}),
    ...meta,
    lastPlayed: Date.now()
  };
  try {
    fs.writeFileSync(METADATA_PATH, JSON.stringify(trackMetadataIndex, null, 2), 'utf-8');
  } catch (e) {}
}

let libraryIndex = {};
try {
  if (fs.existsSync(LIBRARY_PATH)) {
    libraryIndex = JSON.parse(fs.readFileSync(LIBRARY_PATH, 'utf-8'));
  }
} catch (e) {
  libraryIndex = {};
}

function saveLibraryIndex() {
  try {
    fs.writeFileSync(LIBRARY_PATH, JSON.stringify(libraryIndex, null, 2), 'utf-8');
  } catch (e) {}
}

const searchCache = new Map();
const streamUrlCache = new Map();
const lyricsCache = new Map();
const artistCache = new Map();
const vibeCache = new Map();
const ytArtistCache = new Map();
const downloadingSet = new Set();
const prefetchingSet = new Set();

let currentAppState = {};
const sseClients = new Set();

function broadcastSSE(data) {
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(msg);
    } catch (e) {
      sseClients.delete(client);
    }
  }
}

function cleanTrackId(id) {
  return (id || '').replace(/[^a-zA-Z0-9_-]/g, '_');
}

async function findCachedFile(trackId) {
  const cleanId = cleanTrackId(trackId);
  const extensions = ['.opus', '.webm', '.m4a', '.mp3'];
  for (const ext of extensions) {
    const filePath = path.join(CACHE_DIR, `${cleanId}${ext}`);
    try {
      const stat = await fs.promises.stat(filePath);
      if (stat.size > 60000) {
        const now = new Date();
        try {
          await fs.promises.utimes(filePath, now, now);
        } catch (e) {}
        return filePath;
      }
    } catch (e) {}
  }
  return null;
}

async function pruneDiskCache() {
  try {
    const files = await fs.promises.readdir(CACHE_DIR);
    const now = Date.now();
    for (const file of files) {
      const fullPath = path.join(CACHE_DIR, file);
      try {
        const stat = await fs.promises.stat(fullPath);
        if (file.includes('.temp.')) {
          if (now - stat.mtimeMs > 10 * 60 * 1000) {
            await fs.promises.unlink(fullPath);
          }
          continue;
        }
        if (stat.size < 1000) {
          await fs.promises.unlink(fullPath);
          continue;
        }
      } catch (e) {}
    }
  } catch (e) {
    console.warn('Prune cache error:', e);
  }
}

pruneDiskCache();

function parseDurationSeconds(str) {
  if (!str) return 0;
  const parts = str.split(':').map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

function isSpamOrUnofficial(title, duration, channelName = '') {
  if (duration && (duration < 90 || duration > 420)) return true;

  const t = (title || '').toLowerCase();
  const c = (channelName || '').toLowerCase();
  const combined = `${t} ${c}`;

  const nonMusicWordPatterns = [
    /\blecture\b/i,
    /\btalk\b/i,
    /\bconversation\b/i,
    /\bin conversation\b/i,
    /\bacademy\b/i,
    /\bmasterclass\b/i,
    /\bdocumentary\b/i,
    /\bbehind the scenes\b/i,
    /\bmaking of\b/i,
    /\bexplained\b/i,
    /\bhistory of\b/i,
    /\bhow to\b/i,
    /\bnews\b/i,
    /\blive stream\b/i,
    /\blivestream\b/i,
    /\bfull concert\b/i,
    /\bfull set\b/i,
    /\blive at\b/i,
    /\bofficial video essay\b/i
  ];
  if (nonMusicWordPatterns.some(pat => pat.test(combined))) return true;

  const nonMusicPatterns = [
    /\bepisode\s*\d+/i,
    /\bseason\s*\d+/i,
    /\bs\d+e\d+\b/i,
    /\bep\s*\.?\s*\d+\b/i,
    /\bseries\b/i,
    /\btrailer\b/i,
    /\bteaser\b/i,
    /\bfull movie\b/i,
    /\bshort film\b/i,
    /\bpodcast\b/i,
    /\bgameplay\b/i,
    /\bwalkthrough\b/i,
    /\bplaythrough\b/i,
    /\breview\b/i,
    /\breaction\b/i,
    /\binterview\b/i,
    /\baudiobook\b/i,
    /\bvlog\b/i,
    /\bunboxing\b/i,
    /\btutorial\b/i,
    /\bparody\b/i
  ];
  if (nonMusicPatterns.some(pat => pat.test(combined))) return true;

  const badKeywords = [
    '1 hour', '2 hours', '10 hours', 'hour loop', 'hours loop',
    'full album', 'discography', 'ost compilation', 'soundtrack compilation',
    'playlist mix', 'dj set', 'type beat', 'slowed + reverb', 'slowed down',
    'sped up', 'bass boosted', 'nightcore', 'reaction to', 'reacting to'
  ];
  if (badKeywords.some(bad => combined.includes(bad))) return true;

  return false;
}

function safeJsonParse(value, fallback) {
  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch (error) {
    return fallback;
  }
}

function getTrackNormalizedKey(artist, title) {
  let a = String(artist || '').toLowerCase();
  let t = String(title || '').toLowerCase();
  t = t.replace(/\s*\([^)]*official[^)]*\)/gi, '')
       .replace(/\s*\[[^\]]*\]/gi, '')
       .replace(/\s*\([^)]*(video|audio|remaster(ed)?|lyrics?|visualizer)[^)]*\)/gi, '');
  t = t.replace(/\s*(feat\.?|ft\.?)\s+[^(\[-]+/gi, '')
       .replace(/\s*\((feat\.?|ft\.?)[^)]*\)/gi, '');
  a = a.replace(/\s*(feat\.?|ft\.?)\s+.*$/gi, '');
  a = a.replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  t = t.replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  return `${a}::${t}`;
}

function normalizeTrack(track) {
  if (!track || typeof track !== 'object') return null;
  const title = String(track.title || '').trim();
  const artist = String(track.artist || '').trim();
  const id = String(track.id || track.url || `${artist.toLowerCase()}:${title.toLowerCase()}`).trim();
  if (!id && !title) return null;
  return {
    id,
    title: title || 'untitled',
    artist: artist || 'unknown artist',
    duration: Number(track.duration) || 0,
    thumbnail: track.thumbnail || '',
    url: track.url || '',
    platform: track.platform || 'soundcloud',
    searchQuery: track.searchQuery || ''
  };
}

function normalizeArtistName(name) {
  return String(name || '')
    .replace(/\b(official|vevo|records|topic)\b/gi, '')
    .replace(/[^\w\s&-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function trackFingerprint(track) {
  const clean = normalizeTrack(track);
  if (!clean) return '';
  return getTrackNormalizedKey(clean.artist, clean.title);
}

const recentlyRecommendedTrackIds = new Set();
const recentlyRecommendedKeys = new Set();

async function searchSoundcloud(query, limit = 14) {
  const cacheKey = `sc:${limit}:${String(query || '').trim().toLowerCase()}`;
  if (searchCache.has(cacheKey)) {
    return searchCache.get(cacheKey);
  }

  const args = [
    `scsearch${limit}:${query}`,
    '--dump-single-json',
    '--flat-playlist',
    '--skip-download',
    '--no-warnings',
    '--no-check-certificates'
  ];
  try {
    const raw = await executeYtDlp(args, 18000);
    const data = JSON.parse(raw);
    const entries = (data.entries || []).map((item) => {
      let thumbnail = '';
      if (item.thumbnails && item.thumbnails.length > 0) {
        thumbnail = item.thumbnails[item.thumbnails.length - 1].url;
      } else if (item.thumbnail) {
        thumbnail = item.thumbnail;
      }

      const cleanTitle = (item.title || 'untitled');
      const cleanArtist = (item.uploader || item.channel || item.artist || 'unknown artist');
      const trackUrl = item.webpage_url || item.url || '';

      return {
        id: String(item.id || Math.random().toString(36).substring(2)),
        title: cleanTitle,
        artist: cleanArtist,
        duration: item.duration || 0,
        thumbnail: thumbnail,
        url: trackUrl,
        platform: 'soundcloud'
      };
    });

    if (entries.length > 0) {
      searchCache.set(cacheKey, entries);
      setTimeout(() => { searchCache.delete(cacheKey); }, 300000);
    }
    return entries;
  } catch (err) {
    return [];
  }
}

function buildDiscoveryQueries(profile) {
  const artists = (profile.topArtists || []).map(a => typeof a === 'string' ? a : a.name).filter(Boolean);
  const shuffled = [...artists].sort(() => Math.random() - 0.5);
  const queries = [];

  if (shuffled.length > 0) {
    queries.push(shuffled[0]);
    if (shuffled.length > 1) {
      queries.push(shuffled[1]);
    }
  }

  if (profile.dominantScript === 'Cyrillic' && shuffled.length > 0) {
    queries.push(`${shuffled[0]} похожие песни`);
  }

  if (queries.length === 0) {
    queries.push('synthwave chill', 'indie electronic');
  }

  return queries;
}

function scoreDiscoveryCandidate(track, profile, heardKeys, heardIds) {
  const normalized = normalizeTrack(track);
  if (!normalized) return null;
  const key = getTrackNormalizedKey(normalized.artist, normalized.title);
  if (!normalized.url || !normalized.id) return null;

  if (heardIds.has(normalized.id) || (key && heardKeys.has(key))) return null;
  if (recentlyRecommendedTrackIds.has(normalized.id) || (key && recentlyRecommendedKeys.has(key))) return null;
  if (isSpamOrUnofficial(normalized.title, normalized.duration, normalized.artist)) return null;

  let score = 1.0;

  if (/-\s*topic$/i.test(normalized.artist || '')) {
    score += 1.5;
  }

  if (/^.+?\s+-\s+.+$/.test(normalized.title || '')) {
    score += 1.0;
  }

  const candArtist = normalizeArtistName(normalized.artist);
  const artistNames = (profile.topArtists || []).map(a => typeof a === 'string' ? a : a.name);
  if (artistNames.some(a => candArtist.includes(a) || a.includes(candArtist))) {
    score += 3.0;
  }

  const isCyrillic = /[\u0400-\u04FF]/.test(normalized.title);
  if (profile.dominantScript === 'Cyrillic' && isCyrillic) {
    score += 2.0;
  } else if (profile.dominantScript !== 'Cyrillic' && !isCyrillic) {
    score += 1.0;
  }

  if (normalized.duration > 0 && profile.typicalDuration > 0) {
    const delta = Math.abs(normalized.duration - profile.typicalDuration);
    score += Math.max(0, 2.0 - (delta / 60));
  }

  score += Math.random() * 1.5;

  return {
    ...normalized,
    score
  };
}

async function httpGetJson(url, timeoutMs = 6000) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const mod = parsed.protocol === 'http:' ? http : https;
      const req = mod.get(url, { headers: { 'User-Agent': 'Riff' }, timeout: timeoutMs }, (res) => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          res.resume();
          return resolve(null);
        }
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (_) {
            resolve(null);
          }
        });
      });
      req.on('timeout', () => {
        req.destroy();
        resolve(null);
      });
      req.on('error', () => {
        resolve(null);
      });
    } catch (_) {
      resolve(null);
    }
  });
}

const dzArtistIdCache = new Map();

async function dzArtistId(name) {
  if (!name || typeof name !== 'string') return null;
  const clean = normalizeArtistName(name);
  if (!clean) return null;
  const cached = dzArtistIdCache.get(clean);
  if (cached && Date.now() < cached.expires) {
    return cached.id;
  }
  try {
    const url = `https://api.deezer.com/search/artist?q=${encodeURIComponent(name.trim())}&limit=1`;
    const data = await httpGetJson(url, 6000);
    const id = data?.data?.[0]?.id ? String(data.data[0].id) : null;
    dzArtistIdCache.set(clean, { id, expires: Date.now() + 24 * 3600 * 1000 });
    return id;
  } catch (_) {
    return null;
  }
}

async function dzRelatedTracks(artist) {
  try {
    const id = await dzArtistId(artist);
    if (!id) return [];
    const relUrl = `https://api.deezer.com/artist/${encodeURIComponent(id)}/related?limit=12`;
    const relData = await httpGetJson(relUrl, 6000);
    const relatedList = (relData?.data || []).slice(0, 6);
    if (relatedList.length === 0) return [];

    const tracksNested = await Promise.all(relatedList.map(async (relArtist, relatedIndex) => {
      try {
        if (!relArtist?.id) return [];
        const topUrl = `https://api.deezer.com/artist/${encodeURIComponent(relArtist.id)}/top?limit=4`;
        const topData = await httpGetJson(topUrl, 6000);
        const topTracks = topData?.data || [];
        const match = 1 - (relatedIndex / 12) * 0.6;
        return topTracks.map(item => ({
          artist: item.artist?.name || relArtist.name || 'unknown artist',
          title: item.title || 'untitled',
          match,
          source: 'deezer'
        }));
      } catch (_) {
        return [];
      }
    }));
    return tracksNested.flat();
  } catch (_) {
    return [];
  }
}

async function dzRadioTracks(artist) {
  try {
    const id = await dzArtistId(artist);
    if (!id) return [];
    const radUrl = `https://api.deezer.com/artist/${encodeURIComponent(id)}/radio?limit=25`;
    const radData = await httpGetJson(radUrl, 6000);
    const items = radData?.data || [];
    return items.map(item => ({
      artist: item.artist?.name || 'unknown artist',
      title: item.title || 'untitled',
      match: 0.7,
      source: 'deezer'
    }));
  } catch (_) {
    return [];
  }
}

const ytMixCache = new Map();

async function ytMixTracks(seed) {
  if (!seed || seed.platform !== 'youtube') return [];
  let id = cleanTrackId(seed.id || '');
  if (id.length > 11 && (id.startsWith('yt_') || id.startsWith('youtube_'))) {
    id = id.replace(/^(yt_|youtube_)/, '');
  }
  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return [];

  const cached = ytMixCache.get(id);
  if (cached && Date.now() < cached.expires) {
    return cached.tracks;
  }

  try {
    const args = [
      '--flat-playlist',
      '--dump-single-json',
      '--no-warnings',
      '--no-check-certificates',
      '--playlist-end',
      '25',
      '--extractor-args',
      'youtube:player_client=android',
      `https://www.youtube.com/watch?v=${id}&list=RD${id}`
    ];
    const raw = await executeYtDlp(args, 25000);
    const data = JSON.parse(raw);
    const entries = Array.isArray(data?.entries) ? data.entries : [];
    const results = [];

    entries.forEach((entry, index) => {
      if (!entry || !entry.id || entry.id === id) return;
      const duration = Number(entry.duration) || 0;
      if (duration > 480) return;
      const artist = entry.uploader || entry.channel || 'unknown artist';
      const title = entry.title || 'untitled';
      if (isSpamOrUnofficial(title, duration, artist)) return;

      let thumbnail = '';
      if (Array.isArray(entry.thumbnails) && entry.thumbnails.length > 0) {
        thumbnail = entry.thumbnails[entry.thumbnails.length - 1].url || '';
      } else if (entry.thumbnail) {
        thumbnail = entry.thumbnail;
      }

      results.push({
        id: entry.id,
        title,
        artist,
        duration,
        thumbnail,
        url: `https://www.youtube.com/watch?v=${entry.id}`,
        platform: 'youtube',
        isCached: false,
        match: 1 - (index / 25) * 0.5,
        source: 'ytmix',
        playable: true
      });
    });

    ytMixCache.set(id, { expires: Date.now() + 30 * 60 * 1000, tracks: results });
    return results;
  } catch (_) {
    return [];
  }
}

async function gatherCandidates(seeds) {
  const seedList = (Array.isArray(seeds) ? seeds : []).slice(0, 4);
  const perSeed = await Promise.all(seedList.map(async (seed) => {
    const weight = Number(seed?.weight) || 1;
    const [ytmix, dzRel, dzRad] = await Promise.all([
      ytMixTracks(seed).catch(() => []),
      dzRelatedTracks(seed?.artist).catch(() => []),
      dzRadioTracks(seed?.artist).catch(() => [])
    ]);
    const list = [];
    (ytmix || []).forEach(t => {
      list.push({ ...t, match: (Number(t.match) || 0.7) * 1.3, seedWeight: weight });
    });
    (dzRel || []).forEach(t => {
      list.push({ ...t, seedWeight: weight });
    });
    (dzRad || []).forEach(t => {
      list.push({ ...t, seedWeight: weight });
    });
    return list;
  }));
  return perSeed.flat();
}

function rankCandidates(cands, profile, heardKeys, avoid, limit = 10) {
  const avoidKeys = avoid?.keys instanceof Set ? avoid.keys : new Set();
  const avoidArtists = avoid?.artists instanceof Set ? avoid.artists : new Set();
  const heardKeySet = heardKeys instanceof Set ? heardKeys : new Set();

  const grouped = new Map();
  for (const c of (cands || [])) {
    const artist = c.artist || '';
    const title = c.title || '';
    const key = getTrackNormalizedKey(artist, title);
    if (!key) continue;
    if (heardKeySet.has(key)) continue;
    if (recentlyRecommendedKeys && recentlyRecommendedKeys.has(key)) continue;
    if (avoidKeys.has(key)) continue;

    const normArtist = normalizeArtistName(artist);
    if (avoidArtists.has(normArtist)) continue;

    const weight = Number(c.seedWeight) || 1;
    const match = Number(c.match) || 0.5;
    const scoreVal = match * weight;

    if (!grouped.has(key)) {
      grouped.set(key, {
        key,
        title,
        artist,
        normArtist,
        scoreSum: scoreVal,
        sources: new Set([c.source]),
        bestCand: c
      });
    } else {
      const g = grouped.get(key);
      g.scoreSum += scoreVal;
      g.sources.add(c.source);
      if (c.playable && !g.bestCand.playable) {
        g.bestCand = c;
      }
    }
  }

  const topArtistNames = new Set(
    (profile?.topArtists || [])
      .map(a => typeof a === 'string' ? a : a?.name)
      .filter(Boolean)
      .map(normalizeArtistName)
  );
  const isCyrillicProfile = profile?.dominantScript === 'Cyrillic';

  const scoredList = [];
  for (const entry of grouped.values()) {
    let score = entry.scoreSum;
    const isTop = topArtistNames.has(entry.normArtist) || Array.from(topArtistNames).some(a => entry.normArtist.includes(a) || a.includes(entry.normArtist));
    score += isTop ? -0.4 : 0.6;
    if (isCyrillicProfile && /[\u0400-\u04FF]/.test(entry.title)) {
      score += 0.3;
    }
    score += Math.random() * 0.15;

    scoredList.push({
      ...entry.bestCand,
      key: entry.key,
      normArtist: entry.normArtist,
      isTop,
      rankScore: score
    });
  }

  scoredList.sort((a, b) => b.rankScore - a.rankScore);

  const targetCount = (limit || 10) * 2;
  const maxTopCount = Math.max(1, Math.floor(targetCount * 0.3));
  const artistCounts = {};
  let topCount = 0;
  const result = [];

  for (const item of scoredList) {
    const aCount = artistCounts[item.normArtist] || 0;
    if (aCount >= 2) continue;
    if (item.isTop && topCount >= maxTopCount) continue;

    artistCounts[item.normArtist] = aCount + 1;
    if (item.isTop) topCount++;
    result.push(item);
    if (result.length >= targetCount) break;
  }

  return result;
}

const resolvedCache = new Map();

async function resolveCandidate(c) {
  if (!c) return null;
  if (c.playable) {
    const { match, source, seedWeight, playable, key, normArtist, isTop, rankScore, ...clean } = c;
    return clean;
  }

  const key = getTrackNormalizedKey(c.artist, c.title);
  if (!key) return null;

  const cached = resolvedCache.get(key);
  if (cached && Date.now() < cached.expires) {
    return cached.track;
  }

  let resolved = null;
  try {
    const candArtistNorm = normalizeArtistName(c.artist);
    const candTitleNorm = (c.title || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
    const query = `${c.artist} ${c.title}`.trim();
    const scResults = await searchSoundcloud(query, 4);

    for (const r of (scResults || [])) {
      const rArtistNorm = normalizeArtistName(r.artist || r.uploader || '');
      const rTitleNorm = (r.title || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
      const artistMatch = rArtistNorm.includes(candArtistNorm) || candArtistNorm.includes(rArtistNorm);
      const titleMatch = rTitleNorm.includes(candTitleNorm) || candTitleNorm.includes(rTitleNorm);
      if (artistMatch && titleMatch) {
        resolved = normalizeTrack(r);
        break;
      }
    }
  } catch (_) {}

  if (resolvedCache.size >= 500) {
    const oldest = resolvedCache.keys().next().value;
    resolvedCache.delete(oldest);
  }
  resolvedCache.set(key, { expires: Date.now() + 24 * 3600 * 1000, track: resolved });
  return resolved;
}

function pickWeightedSeeds(seeds, count = 4) {
  const pool = [...seeds];
  const picked = [];
  while (picked.length < count && pool.length > 0) {
    const totalWeight = pool.reduce((acc, s) => acc + (Number(s.weight) || 1), 0);
    let r = Math.random() * totalWeight;
    let selectedIdx = 0;
    for (let i = 0; i < pool.length; i++) {
      r -= (Number(pool[i].weight) || 1);
      if (r <= 0) {
        selectedIdx = i;
        break;
      }
    }
    picked.push(pool[selectedIdx]);
    pool.splice(selectedIdx, 1);
  }
  return picked;
}

async function recommendVibeTracks(historyTracks, favoriteTracks, platform = 'youtube', limit = 10, clientProfile = null, extra = {}) {
  const normalizedHistory = (historyTracks || []).map(normalizeTrack).filter(Boolean);
  const normalizedFavorites = (favoriteTracks || []).map(normalizeTrack).filter(Boolean);
  const totalUserTracks = normalizedFavorites.length + normalizedHistory.length;
  const hasExtraSeeds = Array.isArray(extra?.seeds) && extra.seeds.length > 0;

  const heardIds = new Set();
  const heardKeys = new Set();
  [...normalizedHistory, ...normalizedFavorites].forEach(track => {
    if (track.id) heardIds.add(track.id);
    const key = getTrackNormalizedKey(track.artist, track.title);
    if (key) heardKeys.add(key);
  });

  const artistCounts = {};
  let cyrillicCount = 0;
  const durations = [];

  [...normalizedFavorites, ...normalizedHistory].forEach(t => {
    if (t.artist && t.artist.trim()) {
      const a = normalizeArtistName(t.artist);
      artistCounts[a] = (artistCounts[a] || 0) + 1;
    }
    if (t.title && /[\u0400-\u04FF]/.test(t.title)) cyrillicCount++;
    if (t.duration > 0) durations.push(t.duration);
  });

  const sortedArtists = Object.entries(artistCounts)
    .sort((a, b) => b[1] - a[1])
    .map(e => e[0]);

  const profile = {
    topArtists: (clientProfile?.topArtists && clientProfile.topArtists.length > 0) ? clientProfile.topArtists : sortedArtists.slice(0, 5),
    dominantScript: clientProfile?.dominantScript || (cyrillicCount > (normalizedFavorites.length + normalizedHistory.length) * 0.35 ? 'Cyrillic' : 'Latin'),
    typicalDuration: clientProfile?.avgDuration || (durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 210),
    trackCount: totalUserTracks
  };

  if (totalUserTracks < 5 && !hasExtraSeeds) {
    return {
      profile,
      tracks: []
    };
  }

  let candidateSeeds = [];
  if (hasExtraSeeds) {
    candidateSeeds = extra.seeds.map(s => ({
      artist: s.artist || '',
      title: s.title || '',
      id: s.id || '',
      platform: s.platform || 'youtube',
      weight: Number(s.weight) || 1
    }));
  } else {
    const seedMap = new Map();
    normalizedFavorites.forEach(t => {
      const k = getTrackNormalizedKey(t.artist, t.title);
      if (k && !seedMap.has(k)) {
        seedMap.set(k, { artist: t.artist, title: t.title, id: t.id, platform: t.platform || 'youtube', weight: 3 });
      }
    });
    normalizedHistory.forEach(t => {
      const k = getTrackNormalizedKey(t.artist, t.title);
      if (k && !seedMap.has(k)) {
        seedMap.set(k, { artist: t.artist, title: t.title, id: t.id, platform: t.platform || 'youtube', weight: 1 });
      }
    });
    candidateSeeds = Array.from(seedMap.values()).slice(0, 8);
  }

  const chosenSeeds = pickWeightedSeeds(candidateSeeds, 4);

  const avoidKeys = new Set(Array.isArray(extra?.avoid?.keys) ? extra.avoid.keys : []);
  const avoidArtists = new Set(
    (Array.isArray(extra?.avoid?.artists) ? extra.avoid.artists : [])
      .map(normalizeArtistName)
      .filter(Boolean)
  );
  const avoid = { keys: avoidKeys, artists: avoidArtists };

  const sortedSeedKeys = chosenSeeds.map(s => getTrackNormalizedKey(s.artist, s.title) || s.id).sort().join('|');
  if (!extra?.refresh && sortedSeedKeys && vibeCache.has(sortedSeedKeys)) {
    const cached = vibeCache.get(sortedSeedKeys);
    if (cached && Date.now() < cached.expires) {
      const filtered = (cached.tracks || []).filter(t => {
        const k = getTrackNormalizedKey(t.artist, t.title);
        return !recentlyRecommendedTrackIds.has(t.id) && (!k || !recentlyRecommendedKeys.has(k));
      });
      if (filtered.length >= limit) {
        return { profile, tracks: filtered.slice(0, limit) };
      }
    }
  }

  let finalTracks = [];
  try {
    const cands = await gatherCandidates(chosenSeeds);
    const ranked = rankCandidates(cands, profile, heardKeys, avoid, limit);
    let rIdx = 0;
    const resolveWorker = async () => {
      while (rIdx < ranked.length && finalTracks.length < limit) {
        const c = ranked[rIdx++];
        try {
          const track = await resolveCandidate(c);
          if (track && !finalTracks.some(t => t.id === track.id)) {
            const k = getTrackNormalizedKey(track.artist, track.title);
            if (!heardIds.has(track.id) && (!k || !heardKeys.has(k)) &&
                !recentlyRecommendedTrackIds.has(track.id) && (!k || !recentlyRecommendedKeys.has(k))) {
              if (finalTracks.length < limit) {
                finalTracks.push(track);
              }
            }
          }
        } catch (_) {}
      }
    };
    const concurrency = Math.min(4, ranked.length);
    if (concurrency > 0) {
      await Promise.all(Array.from({ length: concurrency }, () => resolveWorker()));
    }
  } catch (_) {}

  if (finalTracks.length > 0) {
    finalTracks.forEach(track => {
      recentlyRecommendedTrackIds.add(track.id);
      const nKey = getTrackNormalizedKey(track.artist, track.title);
      if (nKey) recentlyRecommendedKeys.add(nKey);
      if (recentlyRecommendedTrackIds.size > 100) {
        const first = recentlyRecommendedTrackIds.values().next().value;
        recentlyRecommendedTrackIds.delete(first);
      }
      if (recentlyRecommendedKeys.size > 100) {
        const firstK = recentlyRecommendedKeys.values().next().value;
        recentlyRecommendedKeys.delete(firstK);
      }
    });

    if (sortedSeedKeys) {
      vibeCache.set(sortedSeedKeys, {
        expires: Date.now() + 20 * 60 * 1000,
        tracks: finalTracks
      });
    }

    return {
      profile,
      tracks: finalTracks
    };
  }

  const queries = [];
  if (profile.topArtists && profile.topArtists.length > 0) {
    queries.push(...buildDiscoveryQueries(profile));
  }
  if (queries.length === 0) {
    queries.push('Top Hits 2025', 'Trending Music', 'Pop Hits');
  }

  const resultsArr = await Promise.all(queries.slice(0, 3).map(q => searchYtmTracks(q, 16)));
  const candidateMap = new Map();
  const allFound = [];

  for (const results of resultsArr) {
    if (Array.isArray(results)) {
      for (const track of results) {
        allFound.push(track);
        const scored = scoreDiscoveryCandidate(track, profile, heardKeys, heardIds);
        if (scored) {
          if (!candidateMap.has(scored.id) || candidateMap.get(scored.id).score < scored.score) {
            candidateMap.set(scored.id, scored);
          }
        }
      }
    }
  }

  if (candidateMap.size < limit) {
    for (const track of allFound) {
      if (!candidateMap.has(track.id)) {
        candidateMap.set(track.id, { ...track, score: 50 });
      }
      if (candidateMap.size >= limit * 2) break;
    }
  }

  let ranked = Array.from(candidateMap.values()).sort((a, b) => b.score - a.score);

  const unshown = ranked.filter(t => !recentlyRecommendedTrackIds.has(t.id));
  if (unshown.length >= limit) {
    ranked = unshown;
  }

  const artistTrackCount = {};
  const fallbackTracks = [];
  for (const track of ranked) {
    const a = normalizeArtistName(track.artist);
    if ((artistTrackCount[a] || 0) < 3) {
      artistTrackCount[a] = (artistTrackCount[a] || 0) + 1;
      fallbackTracks.push(track);
      recentlyRecommendedTrackIds.add(track.id);
      const nKey = getTrackNormalizedKey(track.artist, track.title);
      if (nKey) recentlyRecommendedKeys.add(nKey);
      if (recentlyRecommendedTrackIds.size > 100) {
        const first = recentlyRecommendedTrackIds.values().next().value;
        recentlyRecommendedTrackIds.delete(first);
      }
      if (recentlyRecommendedKeys.size > 100) {
        const firstK = recentlyRecommendedKeys.values().next().value;
        recentlyRecommendedKeys.delete(firstK);
      }
      if (fallbackTracks.length >= limit) break;
    }
  }

  if (fallbackTracks.length < limit) {
    for (const track of allFound) {
      if (!fallbackTracks.some(t => t.id === track.id)) {
        fallbackTracks.push(track);
        if (fallbackTracks.length >= limit) break;
      }
    }
  }

  return {
    profile,
    tracks: fallbackTracks
  };
}

function directYoutubeSearch(query, filterSpam = false) {
  return new Promise((resolve) => {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    const req = https.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                          'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 7000
    }, (res) => {
      let html = '';
      const dec = new StringDecoder('utf8');
      res.on('data', chunk => { html += dec.write(chunk); });
      res.on('end', async () => {
        try {
          const match = html.match(/var ytInitialData = ({.*?});<\/script>/);
          if (!match) return resolve([]);

          const json = JSON.parse(match[1]);
          const contents = json.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
          const tracks = [];

          for (const section of contents) {
            const items = section.itemSectionRenderer?.contents || [];
            for (const item of items) {
              const v = item.videoRenderer;
              if (v && v.videoId) {
                const vidId = v.videoId;
                const title = (v.title?.runs?.[0]?.text || 'untitled');
                const artist = (v.ownerText?.runs?.[0]?.text || 'unknown artist');
                const durStr = v.lengthText?.simpleText || '0:00';
                const durSec = parseDurationSeconds(durStr);
                const thumbs = v.thumbnail?.thumbnails || [];
                const thumbnail = thumbs.length > 0 ? thumbs[thumbs.length - 1].url : '';

                if (filterSpam && isSpamOrUnofficial(title, durSec, artist)) {
                  continue;
                }

                const isCached = await findCachedFile(vidId);

                tracks.push({
                  id: vidId,
                  title: title,
                  artist: artist,
                  duration: durSec,
                  thumbnail: thumbnail,
                  url: `https://www.youtube.com/watch?v=${vidId}`,
                  platform: 'youtube',
                  isCached: !!isCached
                });
              }
            }
          }
          resolve(tracks);
        } catch (e) {
          resolve([]);
        }
      });
    });

    req.on('error', () => resolve([]));
    req.on('timeout', () => { req.destroy(); resolve([]); });
  });
}

function executeYtDlp(args, timeoutMs = 25000, opts = {}) {
  return new Promise((resolve, reject) => {
    const cmd = ytDlpCommand(args);
    const proc = spawn(cmd.bin, cmd.args, { windowsHide: true });
    if (opts && typeof opts.onChild === 'function') {
      try { opts.onChild(proc); } catch (_) {}
    }
    let stdout = '';
    let stderr = '';
    const outDecoder = new StringDecoder('utf8');
    const errDecoder = new StringDecoder('utf8');
    let timer = null;

    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        try { proc.kill('SIGKILL'); } catch (e) {}
        reject(new Error(`yt-dlp timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    }

    proc.stdout.on('data', (d) => { stdout += outDecoder.write(d); });
    proc.stderr.on('data', (d) => { stderr += errDecoder.write(d); });

    proc.on('close', (code) => {
      if (timer) clearTimeout(timer);
      if (code === 0) {
        resolve(stdout);
      } else {
        const firstArgs = (args || []).slice(0, 3).join(' ');
        const errSnippet = String(stderr || `code ${code}`).slice(0, 300);
        try { logger.log('error', `yt-dlp failed: ${firstArgs} - ${errSnippet}`); } catch (_) {}
        reject(new Error(stderr || `yt-dlp exited with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      if (timer) clearTimeout(timer);
      const firstArgs = (args || []).slice(0, 3).join(' ');
      const errSnippet = String(err && err.message ? err.message : err).slice(0, 300);
      try { logger.log('error', `yt-dlp spawn error: ${firstArgs} - ${errSnippet}`); } catch (_) {}
      reject(err);
    });
  });
}

async function cacheThumbnailToDisk(cleanId, thumbnailUrl) {
  if (!cleanId || !thumbnailUrl || !thumbnailUrl.startsWith('http')) return null;
  const destPath = path.join(THUMBNAILS_DIR, `${cleanId}.jpg`);
  if (fs.existsSync(destPath)) return destPath;
  try {
    const res = await fetch(thumbnailUrl);
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length > 500) {
      await fs.promises.writeFile(destPath, buffer);
      return destPath;
    }
  } catch (e) {}
  return null;
}

async function downloadTrackToDisk(trackUrl, trackId, platform, meta = {}) {
  const cleanId = cleanTrackId(trackId);
  if (downloadingSet.has(cleanId) || await findCachedFile(cleanId)) return;
  downloadingSet.add(cleanId);

  const outputPath = path.join(CACHE_DIR, `${cleanId}.opus`);
  const tempPath = path.join(CACHE_DIR, `${cleanId}.temp.opus`);

  const args = [
    '--no-config',
    '--no-playlist',
    '--no-check-certificates',
    '--no-warnings',
    '-x',
    '--audio-format', 'opus',
    '--audio-quality', '128K',
    '-o', tempPath
  ];

  if (platform === 'youtube') {
    args.push('--extractor-args', 'youtube:player_client=android');
  }

  args.push(trackUrl);

  if (meta.thumbnail) {
    cacheThumbnailToDisk(cleanId, meta.thumbnail).catch(() => {});
  }

  let cmd;
  try { cmd = ytDlpCommand(args); } catch (e) { downloadingSet.delete(cleanId); try { logger.error('Download command error: ' + (meta.title || trackId), e); } catch (_) {} return; }
  const proc = spawn(cmd.bin, cmd.args, { windowsHide: true });
  proc.on('close', async (code) => {
    downloadingSet.delete(cleanId);
    if (code === 0 && fs.existsSync(tempPath)) {
      try {
        const stat = await fs.promises.stat(tempPath);
        if (stat.size > 60000) {
          await fs.promises.rename(tempPath, outputPath);
          saveTrackMetadata(cleanId, {
            id: trackId,
            title: meta.title || '',
            artist: meta.artist || '',
            duration: meta.duration || 0,
            thumbnail: meta.thumbnail || '',
            platform: platform || 'youtube',
            fileSize: stat.size
          });
        } else {
          try { await fs.promises.unlink(tempPath); } catch (e) {}
        }
      } catch (e) {}
    } else {
      try { logger.error('Download failure: ' + (meta.title || trackId) + ' (exit code ' + code + ')'); } catch (_) {}
      if (fs.existsSync(tempPath)) {
        try { await fs.promises.unlink(tempPath); } catch (e) {}
      }
    }
  });

  proc.on('error', (err) => {
    downloadingSet.delete(cleanId);
    try { logger.error('Download spawn error: ' + (meta.title || trackId), err); } catch (_) {}
  });
}

async function prefetchTrack(trackUrl, trackId, platform) {
  let cleanId = cleanTrackId(trackId);
  if (!cleanId && trackUrl && trackUrl.includes('v=')) {
    cleanId = cleanTrackId(trackUrl.split('v=')[1].split('&')[0]);
  }
  const cacheKey = (cleanId || trackUrl).toLowerCase();
  if (!cacheKey || prefetchingSet.size > 2) return;
  const isCached = (cleanId && await findCachedFile(cleanId)) || streamUrlCache.has(cacheKey) || (cleanId && streamUrlCache.has(cleanId));
  if (isCached || prefetchingSet.has(cacheKey)) return;
  prefetchingSet.add(cacheKey);

  try {
    if (platform === 'youtube' && (!trackUrl || !trackUrl.startsWith('http')) && cleanId) {
      trackUrl = `https://www.youtube.com/watch?v=${cleanId}`;
    }
    if (!isSafeMediaUrl(trackUrl)) return;
    const args = [
      '--no-config',
      '-g',
      '--no-warnings',
      '--no-playlist',
      '--no-check-certificates',
      '--prefer-free-formats',
      '-f',
      'bestaudio/best'
    ];
    if (platform === 'youtube') {
      args.push('--extractor-args', 'youtube:player_client=android');
    }
    args.push('--', trackUrl);

    const raw = await executeYtDlp(args, 18000);
    const lines = raw.trim().split('\n').filter(l => l.startsWith('http'));
    const streamUrl = lines[0];

    if (streamUrl) {
      const isHls = streamUrl.includes('.m3u8');
      const data = {
        success: true,
        isLocal: false,
        streamUrl: streamUrl,
        isHls: isHls,
        proxyUrl: `http://127.0.0.1:${PORT}/api/audio-proxy?url=${encodeURIComponent(streamUrl)}`
      };
      streamUrlCache.set(cacheKey, { timestamp: Date.now(), data });
      if (cleanId && cleanId !== cacheKey) {
        streamUrlCache.set(cleanId, { timestamp: Date.now(), data });
      }
    }
  } catch (e) {
  } finally {
    prefetchingSet.delete(cacheKey);
  }
}

const YTM_SONGS_PARAMS = 'EgWKAQIIAWoMEA4QChADEAQQCRAF';
const YTM_CLIENT_VERSION = '1.20250101.01.00';
let ytmFailUntil = 0;
let ytmFailCount = 0;

function ytmSearchRequest(query) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      context: { client: { clientName: 'WEB_REMIX', clientVersion: YTM_CLIENT_VERSION, hl: 'en', gl: 'US' } },
      query,
      params: YTM_SONGS_PARAMS
    });
    const req = https.request({
      hostname: 'music.youtube.com',
      path: '/youtubei/v1/search?prettyPrint=false',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Origin': 'https://music.youtube.com',
        'Referer': 'https://music.youtube.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
      }
    }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          try { logger.log('warn', `ytmusic search status ${res.statusCode}`); } catch (_) {}
          return reject(new Error(`ytmusic status ${res.statusCode}`));
        }
        try { resolve(JSON.parse(data)); } catch (e) {
          try { logger.log('warn', `ytmusic search parse error: ${e.message}`); } catch (_) {}
          reject(e);
        }
      });
    });
    req.setTimeout(8000, () => {
      try { logger.log('warn', 'ytmusic search timeout'); } catch (_) {}
      req.destroy(new Error('ytmusic timeout'));
    });
    req.on('error', (err) => {
      try { logger.log('warn', `ytmusic search error: ${err.message}`); } catch (_) {}
      reject(err);
    });
    req.write(body);
    req.end();
  });
}

function parseYtmDuration(text) {
  if (!text || !/^\d+(:\d{1,2}){1,2}$/.test(text.trim())) return 0;
  return text.trim().split(':').map(Number).reduce((acc, n) => acc * 60 + n, 0);
}

function parseYtmSongs(json) {
  const out = [];
  const tabs = (json && json.contents && json.contents.tabbedSearchResultsRenderer && json.contents.tabbedSearchResultsRenderer.tabs) || [];
  const sections = (tabs[0] && tabs[0].tabRenderer && tabs[0].tabRenderer.content && tabs[0].tabRenderer.content.sectionListRenderer && tabs[0].tabRenderer.content.sectionListRenderer.contents) || [];
  for (const section of sections) {
    const items = (section && section.musicShelfRenderer && section.musicShelfRenderer.contents) || [];
    for (const wrap of items) {
      const r = wrap && wrap.musicResponsiveListItemRenderer;
      if (!r) continue;
      const cols = r.flexColumns || [];
      const runsOf = (i) => (cols[i] && cols[i].musicResponsiveListItemFlexColumnRenderer && cols[i].musicResponsiveListItemFlexColumnRenderer.text && cols[i].musicResponsiveListItemFlexColumnRenderer.text.runs) || [];
      const overlay = r.overlay && r.overlay.musicItemThumbnailOverlayRenderer && r.overlay.musicItemThumbnailOverlayRenderer.content && r.overlay.musicItemThumbnailOverlayRenderer.content.musicPlayButtonRenderer;
      const videoId = (r.playlistItemData && r.playlistItemData.videoId) || (overlay && overlay.playNavigationEndpoint && overlay.playNavigationEndpoint.watchEndpoint && overlay.playNavigationEndpoint.watchEndpoint.videoId);
      if (!videoId || !/^[\w-]{11}$/.test(videoId)) continue;

      const title = runsOf(0).map((x) => x.text).join('').trim();
      const segments = [];
      let cur = [];
      for (const run of runsOf(1)) {
        if (run.text === ' • ') { segments.push(cur.join('').trim()); cur = []; } else cur.push(run.text);
      }
      segments.push(cur.join('').trim());
      const clean = segments.filter((s) => s && !/^(song|video)$/i.test(s));
      let duration = 0;
      if (clean.length && parseYtmDuration(clean[clean.length - 1])) duration = parseYtmDuration(clean.pop());
      const artist = (clean[0] || '').replace(/\s*-\s*Topic$/i, '').trim();
      const album = clean[1] || '';

      const thumbs = (r.thumbnail && r.thumbnail.musicThumbnailRenderer && r.thumbnail.musicThumbnailRenderer.thumbnail && r.thumbnail.musicThumbnailRenderer.thumbnail.thumbnails) || [];
      let thumbnail = thumbs.length ? thumbs[thumbs.length - 1].url : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
      thumbnail = thumbnail.replace(/=w\d+-h\d+[^&]*$/, '=w544-h544');

      if (!title || (duration && duration < 30)) continue;
      out.push({ id: videoId, title, artist: artist || 'Unknown Artist', album, duration, thumbnail });
    }
  }
  return out;
}

async function searchYtmTracks(query, limit = 16) {
  const cacheKey = `ytm_vibe:${limit}:${String(query || '').trim().toLowerCase()}`;
  if (searchCache.has(cacheKey)) {
    return searchCache.get(cacheKey);
  }
  try {
    const json = await ytmSearchRequest(query);
    const songs = parseYtmSongs(json).slice(0, limit);
    const tracks = songs.map(s => {
      ytArtistCache.set(s.id, s.artist);
      return {
        id: s.id,
        title: s.title,
        artist: s.artist,
        duration: s.duration || 180,
        thumbnail: s.thumbnail || `https://i.ytimg.com/vi/${s.id}/hqdefault.jpg`,
        url: `https://www.youtube.com/watch?v=${s.id}`,
        platform: 'youtube'
      };
    });
    if (tracks.length > 0) {
      searchCache.set(cacheKey, tracks);
      setTimeout(() => { searchCache.delete(cacheKey); }, 300000);
    }
    return tracks;
  } catch (e) {
    try {
      const dy = await directYoutubeSearch(query, true);
      return (dy || []).slice(0, limit).map(t => ({
        ...t,
        platform: 'youtube'
      }));
    } catch (_) {
      return [];
    }
  }
}

async function handleSearch(req, res, query, platform = 'youtube', limit = 20) {
  const cacheKey = `${platform}:${query}:${limit}`;
  if (searchCache.has(cacheKey)) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(searchCache.get(cacheKey)));
  }

  if (platform === 'youtube') {
    try {
      const directTracks = await directYoutubeSearch(query);
      if (directTracks && directTracks.length > 0) {
        const result = { success: true, tracks: directTracks.slice(0, limit) };
        searchCache.set(cacheKey, result);

        setTimeout(() => {
          if (directTracks[0] && directTracks[0].url) {
            prefetchTrack(directTracks[0].url, directTracks[0].id, 'youtube').catch(() => {});
          }
        }, 100);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(result));
      }
    } catch (e) {}
  }

  if (platform === 'ytmusic') {
    if (Date.now() >= ytmFailUntil) {
      try {
        const json = await ytmSearchRequest(query);
        const songs = parseYtmSongs(json).slice(0, limit);
        if (songs.length > 0) {
          ytmFailCount = 0;
          const entries = await Promise.all(songs.map(async (s) => {
            ytArtistCache.set(s.id, s.artist);
            const isCached = await findCachedFile(s.id);
            return { id: s.id, title: s.title, artist: s.artist, duration: s.duration, thumbnail: s.thumbnail, url: `https://www.youtube.com/watch?v=${s.id}`, platform: 'youtube', isCached: !!isCached };
          }));
          const result = { success: true, tracks: entries };
          searchCache.set(cacheKey, result);
          setTimeout(() => {
            if (entries[0] && entries[0].url) prefetchTrack(entries[0].url, entries[0].id, 'youtube').catch(() => {});
          }, 60);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify(result));
        } else {
          ytmFailCount++;
          if (ytmFailCount >= 3) {
            ytmFailUntil = Date.now() + 5 * 60 * 1000;
            try { logger.log('warn', 'ytmusic circuit breaker tripped (3 failures), backing off 5m'); } catch (_) {}
          }
        }
      } catch (e) {
        ytmFailCount++;
        if (ytmFailCount >= 3) {
          ytmFailUntil = Date.now() + 5 * 60 * 1000;
          try { logger.log('warn', 'ytmusic circuit breaker tripped (3 failures), backing off 5m'); } catch (_) {}
        }
      }
    }

    try {
      const args = ['--flat-playlist', '--playlist-end', String(limit), '-J', `https://music.youtube.com/search?q=${encodeURIComponent(query)}#songs`];
      const raw = await executeYtDlp(args, 25000);
      const data = JSON.parse(raw);
      const rawEntries = (data.entries || []).filter((item) => item && /^[\w-]{11}$/.test(String(item.id || '')) && item.live_status !== 'is_live' && !(item.duration && (item.duration < 30 || item.duration > 1200)) && !/\b(advert(isement)?|sponsored|ad)\b|реклама/i.test(item.title || '')).slice(0, limit);

      function extractArtist(item) {
        let a = '';
        if (Array.isArray(item.artists) && item.artists.length > 0) a = item.artists.join(', ');
        else if (item.artist) a = item.artist;
        else if (item.creator) a = item.creator;
        else if (item.channel) a = item.channel;
        else if (item.uploader) a = item.uploader;
        return a ? a.replace(/\s*-\s*Topic$/i, '').trim() : '';
      }

      const toFetch = [];
      for (let i = 0; i < Math.min(20, rawEntries.length); i++) {
        const item = rawEntries[i];
        const flatA = extractArtist(item);
        if (flatA) {
          item._artist = flatA;
        } else if (ytArtistCache.has(item.id)) {
          item._artist = ytArtistCache.get(item.id);
        } else {
          toFetch.push(item);
        }
      }

      if (toFetch.length > 0) {
        let fIdx = 0;
        const fetchWorker = async () => {
          while (fIdx < toFetch.length) {
            const item = toFetch[fIdx++];
            try {
              const out = await executeYtDlp([
                '--skip-download',
                '--no-playlist',
                '--print',
                '%(artist,artists.0,channel,uploader)s',
                `https://www.youtube.com/watch?v=${item.id}`
              ], 10000);
              const lines = (out || '').split('\n').map(s => s.trim()).filter(s => s && s !== 'NA');
              if (lines.length > 0) {
                const val = lines[0].replace(/\s*-\s*Topic$/i, '').trim();
                if (val) {
                  item._artist = val;
                  ytArtistCache.set(item.id, val);
                }
              }
            } catch (e) {}
          }
        };
        const workers = Array.from({ length: Math.min(5, toFetch.length) }, () => fetchWorker());
        await Promise.all(workers);
      }

      const entries = await Promise.all(rawEntries.map(async (item) => {
        let thumbnail = `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`;
        if (item.thumbnails && item.thumbnails.length > 0) {
          thumbnail = item.thumbnails[item.thumbnails.length - 1].url;
        } else if (item.thumbnail) {
          thumbnail = item.thumbnail;
        }
        let titleVal = item.title || 'untitled';
        let artistVal = item._artist || ytArtistCache.get(item.id) || extractArtist(item) || '';
        if (!artistVal && titleVal.includes(' - ')) {
          const parts = titleVal.split(' - ');
          artistVal = parts[0].trim();
          titleVal = parts.slice(1).join(' - ').trim() || titleVal;
        }
        if (!artistVal) artistVal = 'Unknown Artist';
        const isCached = await findCachedFile(item.id);
        return {
          id: String(item.id),
          title: titleVal,
          artist: artistVal,
          duration: item.duration || 0,
          thumbnail: thumbnail,
          url: `https://www.youtube.com/watch?v=${item.id}`,
          platform: 'youtube',
          isCached: !!isCached
        };
      }));
      const result = { success: true, tracks: entries };
      searchCache.set(cacheKey, result);
      setTimeout(() => {
        if (entries[0] && entries[0].url) prefetchTrack(entries[0].url, entries[0].id, 'youtube').catch(() => {});
      }, 60);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, tracks: [], error: 'YouTube Music is unavailable' }));
    }
  }

  const prefix = platform === 'soundcloud' ? `scsearch${limit}:` : `ytsearch${limit}:`;
  const args = [
    `${prefix}${query}`,
    '--dump-single-json',
    '--flat-playlist',
    '--skip-download',
    '--no-warnings',
    '--no-check-certificates'
  ];

  if (platform === 'youtube') {
    args.push('--extractor-args', 'youtube:player_client=android');
  }

  try {
    const raw = await executeYtDlp(args, 25000);
    const data = JSON.parse(raw);
    const entries = await Promise.all((data.entries || []).map(async (item) => {
      let thumbnail = '';
      if (item.thumbnails && item.thumbnails.length > 0) {
        thumbnail = item.thumbnails[item.thumbnails.length - 1].url;
      } else if (item.thumbnail) {
        thumbnail = item.thumbnail;
      }

      const cleanTitle = (item.title || 'untitled');
      const cleanArtist = (item.uploader || item.channel || item.artist || 'unknown artist');

      let trackUrl = item.webpage_url || item.url;
      if (platform === 'youtube' && !trackUrl) {
        trackUrl = `https://www.youtube.com/watch?v=${item.id}`;
      }

      const isCached = await findCachedFile(item.id);

      return {
        id: String(item.id || Math.random().toString(36).substring(2)),
                                                               title: cleanTitle,
                                                               artist: cleanArtist,
                                                               duration: item.duration || 0,
                                                               thumbnail: thumbnail,
                                                               url: trackUrl,
                                                               platform: platform,
                                                               isCached: !!isCached
      };
    }));

    const result = { success: true, tracks: entries };
    searchCache.set(cacheKey, result);

    setTimeout(() => {
      if (entries[0] && entries[0].url) prefetchTrack(entries[0].url, entries[0].id, platform).catch(() => {});
    }, 60);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: err.message }));
  }
}

async function handleVibeRecommendations(req, res, payload) {
  const historyTracks = Array.isArray(payload?.history) ? payload.history : [];
  const favoriteTracks = Array.isArray(payload?.favorites) ? payload.favorites : [];
  const platform = 'youtube';
  const limit = Math.max(4, Math.min(parseInt(payload?.limit || '10', 10) || 10, 16));
  const clientProfile = payload?.clientProfile || null;
  const extra = {
    seeds: payload?.seeds,
    avoid: payload?.avoid,
    refresh: payload?.refresh
  };

  try {
    const result = await recommendVibeTracks(historyTracks, favoriteTracks, platform, limit, clientProfile, extra);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, ...result }));
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: error.message }));
  }
}

async function handleStreamInfo(req, res, trackUrl, trackId, platform = 'youtube', title = '', artist = '', duration = 0, thumbnail = '') {
  let cleanId = cleanTrackId(trackId);
  if (!cleanId && trackUrl && trackUrl.includes('v=')) {
    cleanId = cleanTrackId(trackUrl.split('v=')[1].split('&')[0]);
  }
  const meta = { title, artist, duration, thumbnail };

  const [cachedFile, downloadedName] = await Promise.all([
    cleanId ? findCachedFile(cleanId) : Promise.resolve(null),
    (title || artist) ? findDownloadedFile(title, artist) : Promise.resolve(null)
  ]);

  if (cachedFile) {
    const data = {
      success: true,
      isLocal: true,
      streamUrl: `http://127.0.0.1:${PORT}/api/local-track?id=${encodeURIComponent(cleanId)}`
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(data));
  }

  if (downloadedName) {
    const data = {
      success: true,
      isLocal: true,
      isDownload: true,
      streamUrl: `http://127.0.0.1:${PORT}/api/downloaded-track?name=${encodeURIComponent(downloadedName)}`
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(data));
  }

  const cacheKey = (cleanId || trackUrl || `${artist}_${title}`).toLowerCase();
  if (cacheKey && (streamUrlCache.has(cacheKey) || (cleanId && streamUrlCache.has(cleanId)))) {
    const cached = streamUrlCache.get(cacheKey) || (cleanId ? streamUrlCache.get(cleanId) : null);
    if (cached && (Date.now() - cached.timestamp < 1800000)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      if (cleanId) setTimeout(() => downloadTrackToDisk(trackUrl, cleanId, platform, meta), 10000);
      return res.end(JSON.stringify(cached.data));
    }
  }

  if (platform === 'youtube' && (!trackUrl || !trackUrl.startsWith('http')) && cleanId) {
    trackUrl = `https://www.youtube.com/watch?v=${cleanId}`;
  }

  let streamUrl = null;

  if (isSafeMediaUrl(trackUrl)) {
    try {
      const args = ['--no-config', '-g', '--no-warnings', '--no-playlist', '--no-check-certificates', '--prefer-free-formats', '-f', 'bestaudio/best'];
      if (platform === 'youtube') {
        args.push('--extractor-args', 'youtube:player_client=android');
      }
      args.push('--', trackUrl);
      const raw = await executeYtDlp(args, 18000);
      const lines = raw.trim().split('\n').map(l => l.trim()).filter(l => l.startsWith('http'));
      if (lines.length > 0) streamUrl = lines[0];
    } catch (e) {
      try { logger.error('Stream resolve primary error: ' + (title || trackUrl), e); } catch (_) {}
    }
  }

  if (!streamUrl && (title || artist || trackUrl)) {
    try {
      const q = `${artist} ${title}`.trim() || trackUrl;
      const scArgs = ['--no-config', '-g', '--no-warnings', '--no-playlist', '--no-check-certificates', '--prefer-free-formats', '-f', 'bestaudio/best', `scsearch1:${q}`];
      const scRaw = await executeYtDlp(scArgs, 15000);
      const scLines = scRaw.trim().split('\n').map(l => l.trim()).filter(l => l.startsWith('http'));
      if (scLines.length > 0) streamUrl = scLines[0];
    } catch (e) {
      try { logger.error('Stream resolve fallback error: ' + (title || trackUrl), e); } catch (_) {}
    }
  }

  if (!streamUrl) {
    try { logger.error('Stream resolve failed: ' + (title || trackUrl)); } catch (_) {}
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, error: 'could not extract audio stream' }));
  }

  const isHls = streamUrl.includes('.m3u8');
  const data = {
    success: true,
    isLocal: false,
    streamUrl: streamUrl,
    isHls: isHls,
    proxyUrl: `http://127.0.0.1:${PORT}/api/audio-proxy?url=${encodeURIComponent(streamUrl)}`
  };

  if (cacheKey) streamUrlCache.set(cacheKey, { timestamp: Date.now(), data });
  if (cleanId && cleanId !== cacheKey) streamUrlCache.set(cleanId, { timestamp: Date.now(), data });
  if (cleanId) setTimeout(() => downloadTrackToDisk(trackUrl, cleanId, platform, meta), 10000);

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function fetchArtistInfo(artistName) {
  const cleanName = (artistName || '').replace(/ - Topic|VEVO|Official|Records/gi, '').trim();
  const cacheKey = cleanName.toLowerCase();
  if (artistCache.has(cacheKey)) return artistCache.get(cacheKey);

  let bio = '';
  let avatar = '';
  let isVerified = false;
  let tracks = [];
  let resolvedName = cleanName;

  try {
    const dzUrl = `https://api.deezer.com/search/artist?q=${encodeURIComponent(cleanName)}`;
    const dzData = await new Promise((resolve) => {
      https.get(dzUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 4000 }, (dRes) => {
        let d = '';
        dRes.on('data', c => d += c);
        dRes.on('end', () => {
          try { resolve(JSON.parse(d)); } catch (e) { resolve(null); }
        });
      }).on('error', () => resolve(null));
    });

    if (dzData && dzData.data && dzData.data.length > 0) {
      const topArtist = dzData.data[0];
      if (topArtist.name) resolvedName = topArtist.name;
      avatar = topArtist.picture_xl || topArtist.picture_big || topArtist.picture_medium || '';
      isVerified = (topArtist.nb_fan || 0) > 30000;

      if (topArtist.tracklist) {
        const tlistData = await new Promise((resolve) => {
          https.get(topArtist.tracklist, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 4000 }, (tRes) => {
            let td = '';
            tRes.on('data', c => td += c);
            tRes.on('end', () => {
              try { resolve(JSON.parse(td)); } catch (e) { resolve(null); }
            });
          }).on('error', () => resolve(null));
        });

        if (tlistData && Array.isArray(tlistData.data)) {
          for (const item of tlistData.data) {
            const dur = item.duration || 180;
            if (dur >= 50 && dur <= 450 && !isSpamOrUnofficial(item.title, dur)) {
              tracks.push({
                id: `dz_${item.id}`,
                title: (item.title || 'untitled'),
                          artist: (item.artist?.name || cleanName),
                          duration: dur,
                          thumbnail: item.album?.cover_medium || item.album?.cover_big || avatar,
                          url: `https://www.youtube.com/results?search_query=${encodeURIComponent(cleanName + ' - ' + item.title + ' official audio')}`,
                          searchQuery: `${cleanName} - ${item.title} official audio`,
                          platform: 'youtube',
                          isCached: false
              });
            }
          }
        }
      }
    }
  } catch (e) {}

  try {
    const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cleanName)}`;
    const wikiData = await new Promise((resolve) => {
      https.get(wikiUrl, { headers: { 'User-Agent': 'devsize/2.0' }, timeout: 3500 }, (wRes) => {
        let d = '';
        wRes.on('data', c => d += c);
        wRes.on('end', () => {
          try { resolve(JSON.parse(d)); } catch (e) { resolve(null); }
        });
      }).on('error', () => resolve(null));
    });

    if (wikiData && wikiData.extract) {
      bio = wikiData.extract;
      if (!avatar && wikiData.originalimage?.source) {
        avatar = wikiData.originalimage.source;
      }
    }
  } catch (e) {}

  if (tracks.length === 0) {
    try {
      const ytOfficialTracks = await directYoutubeSearch(`${cleanName} official audio`, true);
      tracks = (ytOfficialTracks || []).filter(t => !isSpamOrUnofficial(t.title, t.duration)).slice(0, 25);
    } catch (e) {}
  }

  const result = {
    name: resolvedName,
    bio: (bio || '').trim(),
    avatar: avatar || (tracks[0] ? tracks[0].thumbnail : ''),
    isVerified: isVerified,
    tracks: tracks.slice(0, 35)
  };

  artistCache.set(cacheKey, result);
  return result;
}

async function handleLocalTrack(req, res, trackId) {
  const cleanId = cleanTrackId(trackId);
  const filePath = await findCachedFile(cleanId);

  if (!filePath) {
    res.writeHead(404);
    return res.end('File not found in local cache');
  }

  try {
    const stat = await fs.promises.stat(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.opus': 'audio/ogg; codecs=opus',
      '.webm': 'audio/webm',
      '.m4a': 'audio/mp4',
      '.mp3': 'audio/mpeg'
    };
    const contentType = mimeTypes[ext] || 'audio/mpeg';

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(filePath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
      };
      res.writeHead(206, head);
      streamFileToResponse(file, res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes'
      };
      res.writeHead(200, head);
      streamFileToResponse(fs.createReadStream(filePath), res);
    }
  } catch (e) {
    res.writeHead(500);
    res.end('Error reading local file');
  }
}

const LIBRARY_MIME_TYPES = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
  '.opus': 'audio/ogg; codecs=opus',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.webm': 'audio/webm',
  '.weba': 'audio/webm'
};

async function handleLibraryFile(req, res, trackId) {
  const item = libraryIndex[trackId];
  if (!item || !item.file) {
    res.writeHead(404);
    return res.end('File not found in library');
  }

  const filePath = path.join(LIBRARY_DIR, item.file);
  try {
    const stat = await fs.promises.stat(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    const ext = path.extname(filePath).toLowerCase();
    const contentType = LIBRARY_MIME_TYPES[ext] || 'audio/mpeg';

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(filePath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
      };
      res.writeHead(206, head);
      streamFileToResponse(file, res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes'
      };
      res.writeHead(200, head);
      streamFileToResponse(fs.createReadStream(filePath), res);
    }
  } catch (e) {
    res.writeHead(404);
    res.end('File not found in library');
  }
}

async function handleDownloadedTrack(req, res, name) {
  const safeName = path.basename(String(name || ''));
  const ext = path.extname(safeName).toLowerCase();
  const dir = getDownloadsDir();
  const filePath = path.join(dir, safeName);

  if (!safeName || !AUDIO_EXTENSIONS.has(ext) || path.dirname(filePath) !== dir) {
    res.writeHead(404);
    return res.end('File not found in downloads');
  }

  try {
    const stat = await fs.promises.stat(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    const contentType = LIBRARY_MIME_TYPES[ext] || 'audio/mpeg';

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(filePath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
      };
      res.writeHead(206, head);
      streamFileToResponse(file, res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes'
      };
      res.writeHead(200, head);
      streamFileToResponse(fs.createReadStream(filePath), res);
    }
  } catch (e) {
    res.writeHead(404);
    res.end('File not found in downloads');
  }
}

async function handleAudioProxy(req, res, targetUrl) {
  if (!targetUrl) {
    res.writeHead(400);
    return res.end('Missing url');
  }

  try {
    let parsed;
    try {
      parsed = new URL(targetUrl);
    } catch (e) {
      res.writeHead(400);
      return res.end('Invalid url');
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      res.writeHead(400);
      return res.end('Unsupported protocol');
    }
    if (await isPrivateHost(parsed.hostname)) {
      res.writeHead(403);
      return res.end('Blocked target');
    }
    const client = parsed.protocol === 'https:' ? https : http;

    const forward = { host: parsed.host };
    for (const key of ['range', 'accept', 'accept-language', 'user-agent']) {
      if (req.headers[key] !== undefined) forward[key] = req.headers[key];
    }

    const proxyReq = client.request(targetUrl, {
      method: req.method,
      headers: forward
    }, (proxyRes) => {
      if (res.writableEnded) {
        proxyRes.destroy();
        return;
      }
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.on('error', () => { try { res.destroy(); } catch (e) {} });
      proxyRes.pipe(res);
    });

    proxyReq.setTimeout(60000, () => {
      proxyReq.destroy(new Error('Proxy timeout'));
    });

    proxyReq.on('error', (e) => {
      if (!res.headersSent) {
        res.writeHead(502);
        res.end('Proxy error');
      } else {
        try { res.destroy(); } catch (err) {}
      }
    });

    req.on('error', () => { try { proxyReq.destroy(); } catch (e) {} });
    req.pipe(proxyReq);
  } catch (e) {
    if (!res.headersSent) {
      res.writeHead(500);
      res.end('Proxy failed');
    }
  }
}

function defaultDownloadsDir() {
  try { return require('electron').app.getPath('downloads'); } catch (e) { return path.join(os.homedir(), 'Downloads'); }
}

function getDownloadsDir() {
  const dir = resolveDownloadDir() || defaultDownloadsDir();
  if (!fs.existsSync(dir)) {
    try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {}
  }
  return dir;
}

function sanitizeFilename(str) {
  return (str || 'track')
  .replace(/[<>:"/\\|?*]/g, '')
  .replace(/\s+/g, ' ')
  .trim();
}

const AUDIO_EXTENSIONS = new Set(['.mp3', '.m4a', '.flac', '.opus', '.wav', '.ogg', '.oga', '.aac', '.webm', '.weba']);

let downloadsIndex = null;
let downloadsIndexBuiltAt = 0;
const DOWNLOADS_INDEX_TTL = 15000;

async function buildDownloadsIndex() {
  const dir = getDownloadsDir();
  const map = new Map();
  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!AUDIO_EXTENSIONS.has(ext)) continue;
      const base = entry.name.slice(0, entry.name.length - ext.length).toLowerCase();
      if (base) map.set(base, entry.name);
    }
  } catch (e) {}
  downloadsIndex = map;
  downloadsIndexBuiltAt = Date.now();
  return map;
}

async function findDownloadedFile(title, artist) {
  if (!title && !artist) return null;
  if (!downloadsIndex || Date.now() - downloadsIndexBuiltAt > DOWNLOADS_INDEX_TTL) {
    await buildDownloadsIndex();
  }
  const key = `${sanitizeFilename(artist || 'unknown artist')} - ${sanitizeFilename(title || 'untitled')}`.toLowerCase();
  return downloadsIndex.get(key) || null;
}

async function cleanupDownloadArtifacts(dir, beforeSet, baseName, videoId, chosenExt, keepSuccessFile) {
  try {
    const afterFiles = await fs.promises.readdir(dir);
    const trashExts = new Set(['.webp', '.webm', '.part', '.ytdl', '.temp', '.jpg', '.jpeg', '.png', '.json', '.vtt', '.m4a', '.opus', '.mp4']);
    const chosenExtWithDot = '.' + chosenExt.toLowerCase();

    for (const f of afterFiles) {
      if (beforeSet.has(f)) continue;

      const fileExt = path.extname(f).toLowerCase();
      const belongs = f.startsWith(baseName) || (videoId && f.includes(videoId));
      if (!belongs) continue;

      if (keepSuccessFile && f === `${baseName}${chosenExtWithDot}`) {
        continue;
      }

      if (trashExts.has(fileExt) || !keepSuccessFile) {
        if (fileExt === chosenExtWithDot && keepSuccessFile) {
          continue;
        }
        try {
          await fs.promises.unlink(path.join(dir, f));
        } catch (_) {}
      }
    }
  } catch (_) {}
}

async function handleDownload(req, res, trackUrl, title, artist, format = 'mp3', quality = '0', startParam = null, endParam = null, raw = false, trackId = null, streamUrlParam = null) {
  if (!trackUrl && (!title || !artist)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, error: 'missing track information' }));
  }

  let start = null;
  if (startParam !== null && startParam !== undefined && startParam !== '') {
    const n = typeof startParam === 'number' ? startParam : parseFloat(startParam);
    if (!isNaN(n)) start = Math.max(0, n);
  }
  let end = null;
  if (endParam !== null && endParam !== undefined && endParam !== '') {
    const n = typeof endParam === 'number' ? endParam : parseFloat(endParam);
    if (!isNaN(n)) end = Math.max(0, n);
  }

  const trimArgs = [];
  if (start !== null || end !== null) {
    const s = start !== null ? start : 0;
    trimArgs.push('--postprocessor-args', 'ffmpeg:-ss ' + s + (end ? ' -to ' + end : ''));
  }

  const isRaw = Boolean(raw);
  const downloadsDir = getDownloadsDir();
  const tmpDir = path.join(downloadsDir, '.tmp');
  if (isRaw && !fs.existsSync(tmpDir)) {
    try { await fs.promises.mkdir(tmpDir, { recursive: true }); } catch (_) {}
  }

  const cleanTitle = sanitizeFilename(title || 'untitled');
  const cleanArtist = sanitizeFilename(artist || 'unknown artist');
  const validFormats = ['mp3', 'm4a', 'flac', 'opus', 'wav', 'ogg'];
  const safeFormat = String(format || '').toLowerCase();
  const ext = isRaw ? 'wav' : (validFormats.includes(safeFormat) ? safeFormat : 'mp3');
  const safeQuality = /^\d+$/.test(String(quality)) ? String(quality) : '0';
  const tempName = isRaw ? ('raw_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '.wav') : null;
  const outFilename = isRaw ? tempName : `${cleanArtist} - ${cleanTitle}.${ext}`;
  const outPath = isRaw ? path.join(tmpDir, tempName) : path.join(downloadsDir, outFilename);
  const tempTemplate = isRaw ? path.join(tmpDir, tempName.replace(/\.wav$/, '.%(ext)s')) : path.join(downloadsDir, `${cleanArtist} - ${cleanTitle}.%(ext)s`);

  let targetUrl = trackUrl;
  if (!isSafeMediaUrl(targetUrl) || targetUrl.includes('deezer.com')) {
    targetUrl = `ytsearch1:${cleanArtist} ${cleanTitle} official audio`;
  }

  let cleanId = cleanTrackId(trackId);
  if (!cleanId && targetUrl) {
    const vidMatch = String(targetUrl).match(/(?:v=|\/embed\/|\/watch\/|youtu\.be\/|\/v\/)([a-zA-Z0-9_-]{11})/);
    if (vidMatch) cleanId = cleanTrackId(vidMatch[1]);
  }

  const cachedFile = cleanId ? await findCachedFile(cleanId) : null;
  if (cachedFile) {
    const ffmpegBin = resolveBinary('ffmpeg');
    if (ffmpegBin) {
      const bitrateMap = { '0': '320k', '2': '256k', '4': '192k', '5': '128k' };
      const bitrate = bitrateMap[safeQuality] || '320k';
      const ffmpegArgs = ['-y'];
      if (start !== null) ffmpegArgs.push('-ss', String(start));
      if (end !== null) ffmpegArgs.push('-to', String(end));
      ffmpegArgs.push('-i', cachedFile);
      if (['mp3', 'm4a', 'opus', 'ogg'].includes(ext)) {
        ffmpegArgs.push('-b:a', bitrate);
      }
      ffmpegArgs.push('-metadata', `title=${title || cleanTitle}`);
      ffmpegArgs.push('-metadata', `artist=${artist || cleanArtist}`);
      ffmpegArgs.push(outPath);

      let ffmpegProc = null;
      res.on('close', () => {
        if (!res.writableEnded && ffmpegProc) {
          try { ffmpegProc.kill('SIGKILL'); } catch (_) {}
          try { fs.unlinkSync(outPath); } catch (_) {}
        }
      });

      try {
        await new Promise((resolve, reject) => {
          ffmpegProc = spawn(ffmpegBin, ffmpegArgs, { windowsHide: true });
          ffmpegProc.on('close', code => {
            if (code === 0) resolve();
            else reject(new Error(`ffmpeg exited with code ${code}`));
          });
          ffmpegProc.on('error', reject);
        });
        downloadsIndex = null;
        if (!res.writableEnded) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify(isRaw ? {
            success: true,
            tempName: tempName
          } : {
            success: true,
            filename: outFilename,
            directory: downloadsDir
          }));
        }
        return;
      } catch (cachedErr) {
        try { await fs.promises.unlink(outPath); } catch (_) {}
      }
    }
  }

  const targetDir = isRaw ? tmpDir : downloadsDir;
  const beforeFiles = new Set(await fs.promises.readdir(targetDir).catch(() => []));
  let child = null;

  async function cleanupPartial() {
    try {
      const files = await fs.promises.readdir(targetDir);
      const prefix = isRaw ? tempName.replace(/\.wav$/, '') : `${cleanArtist} - ${cleanTitle}.`;
      for (const f of files) {
        if (beforeFiles.has(f)) continue;
        if (!f.startsWith(prefix)) continue;
        const lower = f.toLowerCase();
        if (
          lower.endsWith('.part') ||
          lower.endsWith('.ytdl') ||
          lower.endsWith('.temp') ||
          f === outFilename ||
          !res.writableEnded
        ) {
          try { await fs.promises.unlink(path.join(targetDir, f)); } catch (_) {}
        }
      }
    } catch (_) {}
  }

  res.on('close', () => {
    if (!res.writableEnded && child) {
      try { child.kill('SIGKILL'); } catch (e) {}
      cleanupPartial();
    }
  });

  const baseName = isRaw ? tempName.replace(/\.wav$/, '') : `${cleanArtist} - ${cleanTitle}`;
  const videoId = cleanId;

  const coverFormats = ['mp3', 'm4a', 'flac', 'opus', 'ogg'];
  const canCarryCover = !isRaw && coverFormats.includes(ext);

  const args = [
    '--no-playlist',
    '--no-check-certificates',
    '--no-warnings',
    '-x',
    '--audio-format', ext,
    '--audio-quality', safeQuality,
    '--embed-metadata',
    '-o', tempTemplate,
    '--extractor-args', 'youtube:player_client=android',
  ];
  if (canCarryCover) {
    args.push('--embed-thumbnail', '--convert-thumbnails', 'jpg');
  }
  if (trimArgs.length) {
    args.push(...trimArgs);
  }
  args.push('--', targetUrl);

  try {
    await executeYtDlp(args, 60000, { onChild: c => { child = c; } });
    if (!isRaw) {
      await cleanupDownloadArtifacts(downloadsDir, beforeFiles, baseName, videoId, ext, true);
      downloadsIndex = null;
    }
    if (!res.writableEnded) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(isRaw ? {
        success: true,
        tempName: tempName
      } : {
        success: true,
        filename: outFilename,
        directory: downloadsDir
      }));
    }
  } catch (err) {
    try { logger.error('Download primary failed: ' + (title || trackUrl), err); } catch (_) {}
    if (res.writableEnded) return;
    try {
      const fallbackArgs = [
        '--no-playlist',
        '--no-check-certificates',
        '--no-warnings',
        '-x',
        '--audio-format', ext,
        '--audio-quality', safeQuality,
        '--embed-metadata',
        '-o', tempTemplate,
      ];
      if (canCarryCover) {
        fallbackArgs.push('--embed-thumbnail', '--convert-thumbnails', 'jpg');
      }
      if (trimArgs.length) {
        fallbackArgs.push(...trimArgs);
      }
      fallbackArgs.push('--', targetUrl);

      await executeYtDlp(fallbackArgs, 60000, { onChild: c => { child = c; } });
      if (!isRaw) {
        await cleanupDownloadArtifacts(downloadsDir, beforeFiles, baseName, videoId, ext, true);
        downloadsIndex = null;
      }
      if (!res.writableEnded) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(isRaw ? {
          success: true,
          tempName: tempName
        } : {
          success: true,
          filename: outFilename,
          directory: downloadsDir
        }));
      }
    } catch (e2) {
      if (!isRaw) {
        await cleanupDownloadArtifacts(downloadsDir, beforeFiles, baseName, videoId, ext, false);
      } else {
        await cleanupPartial();
      }
      try { logger.error('Download failure: ' + (title || trackUrl) + ' (' + (e2.message || err.message) + ')', e2); } catch (_) {}
      if (!res.writableEnded) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e2.message || err.message }));
      }
    }
  }
}

function handleTmpFile(req, res, parsedUrl) {
  const fileName = parsedUrl.query.name || '';
  if (!/^[\w .-]+\.wav$/.test(fileName) || fileName.includes('/') || fileName.includes('\\') || fileName.includes('..')) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, error: 'Invalid file name' }));
  }
  const downloadsDir = getDownloadsDir();
  const filePath = path.join(downloadsDir, '.tmp', fileName);
  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, error: 'File not found' }));
  }
  const stat = fs.statSync(filePath);
  res.writeHead(200, {
    'Content-Type': 'audio/wav',
    'Content-Length': stat.size
  });
  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
  req.on('close', () => {
    if (!res.writableEnded) stream.destroy();
  });
}

async function handleEncode(req, res, parsedUrl) {
  const sourceName = parsedUrl.query.name || '';
  const title = parsedUrl.query.title || 'untitled';
  const artist = parsedUrl.query.artist || 'unknown artist';
  const format = parsedUrl.query.format || 'mp3';
  const quality = parsedUrl.query.quality || '0';

  const validFormats = ['mp3', 'm4a', 'flac', 'opus', 'wav', 'ogg'];
  const safeFormat = String(format || '').toLowerCase();
  const ext = validFormats.includes(safeFormat) ? safeFormat : 'mp3';
  const bitrateMap = {
    '0': '320k',
    '2': '256k',
    '4': '192k',
    '5': '128k',
  };
  const bitrate = bitrateMap[String(quality)] || '320k';

  const downloadsDir = getDownloadsDir();
  const tmpDir = path.join(downloadsDir, '.tmp');
  if (!fs.existsSync(tmpDir)) {
    try { await fs.promises.mkdir(tmpDir, { recursive: true }); } catch (_) {}
  }
  const cleanTitle = sanitizeFilename(title);
  const cleanArtist = sanitizeFilename(artist);
  const outFilename = `${cleanArtist} - ${cleanTitle}.${ext}`;
  const outPath = path.join(downloadsDir, outFilename);

  const renderTempName = 'render_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '.wav';
  const renderTempPath = path.join(tmpDir, renderTempName);

  const MAX_BODY_SIZE = 500 * 1024 * 1024;
  let receivedBytes = 0;
  let aborted = false;

  const fileWriteStream = fs.createWriteStream(renderTempPath);

  try {
    await new Promise((resolve, reject) => {
      req.on('data', chunk => {
        receivedBytes += chunk.length;
        if (receivedBytes > MAX_BODY_SIZE) {
          aborted = true;
          try { req.destroy(new Error('Payload too large')); } catch (_) {}
          try { fileWriteStream.destroy(); } catch (_) {}
          try { fs.unlinkSync(renderTempPath); } catch (_) {}
          if (!res.writableEnded) {
            res.writeHead(413, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'WAV exceeds 300MB limit' }));
          }
          reject(new Error('Payload too large'));
          return;
        }
        fileWriteStream.write(chunk);
      });
      req.on('end', () => {
        fileWriteStream.end(() => resolve());
      });
      req.on('error', err => {
        try { fs.unlinkSync(renderTempPath); } catch (_) {}
        reject(err);
      });
      fileWriteStream.on('error', err => {
        try { fs.unlinkSync(renderTempPath); } catch (_) {}
        reject(err);
      });
    });
  } catch (readErr) {
    if (aborted) return;
    try { fs.unlinkSync(renderTempPath); } catch (_) {}
    if (!res.writableEnded) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: readErr.message || 'Failed to read audio body' }));
    }
    return;
  }

  const ffmpegBin = resolveBinary('ffmpeg');
  if (!ffmpegBin) {
    try { await fs.promises.unlink(renderTempPath); } catch (_) {}
    if (!res.writableEnded) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'ffmpeg not found' }));
    }
    return;
  }

  let ffmpegProc = null;
  res.on('close', () => {
    if (!res.writableEnded && ffmpegProc) {
      try { ffmpegProc.kill('SIGKILL'); } catch (_) {}
      try { fs.unlinkSync(renderTempPath); } catch (_) {}
      try { fs.unlinkSync(outPath); } catch (_) {}
    }
  });

  const ffmpegArgs = ['-y', '-i', renderTempPath];
  if (['mp3', 'm4a', 'opus', 'ogg'].includes(ext)) {
    ffmpegArgs.push('-b:a', bitrate);
  }
  ffmpegArgs.push('-metadata', `title=${title}`);
  ffmpegArgs.push('-metadata', `artist=${artist}`);
  ffmpegArgs.push(outPath);

  try {
    await new Promise((resolve, reject) => {
      ffmpegProc = spawn(ffmpegBin, ffmpegArgs, { windowsHide: true });
      ffmpegProc.on('close', code => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg exited with code ${code}`));
      });
      ffmpegProc.on('error', reject);
    });

    downloadsIndex = null;
    if (!res.writableEnded) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        filename: outFilename,
        directory: downloadsDir
      }));
    }
  } catch (err) {
    try { logger.error('Encode failure: ' + (title || sourceName) + ' (' + err.message + ')', err); } catch (_) {}
    try { await fs.promises.unlink(outPath); } catch (_) {}
    if (!res.writableEnded) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message || 'Encoding failed' }));
    }
  } finally {
    try { await fs.promises.unlink(renderTempPath); } catch (_) {}
    if (sourceName && /^[\w .-]+\.wav$/.test(sourceName)) {
      try { await fs.promises.unlink(path.join(tmpDir, sourceName)); } catch (_) {}
    }
  }
}

function sanitizeForLyrics(title, artist) {
  let cleanTitle = (title || '')
  .replace(/\[.*?\]|\(.*?\)/g, '')
  .replace(/official\s*(music)?\s*video|official\s*audio|lyrics|hd|4k|remastered|visualizer|clip\s*officiel|video\s*clip/gi, '')
  .replace(/ft\.?|feat\.?/gi, '')
  .replace(/[^\w\s\u0400-\u04FF]/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim();

  let cleanArtist = (artist || '')
  .replace(/\[.*?\]|\(.*?\)/g, '')
  .replace(/- topic|vevo|records|official/gi, '')
  .replace(/[^\w\s\u0400-\u04FF]/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim();

  return { cleanTitle, cleanArtist };
}

function fetchLyricsDirect(title, artist) {
  return new Promise((resolve) => {
    const { cleanTitle, cleanArtist } = sanitizeForLyrics(title, artist);
    const apiUrl = `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(cleanArtist)}`;

    https.get(apiUrl, { headers: { 'User-Agent': 'devsize/2.0' }, timeout: 4000 }, (res) => {
      let data = '';
      const dec = new StringDecoder('utf8');
      res.on('data', c => data += dec.write(c));
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const parsed = JSON.parse(data);
            if (parsed.syncedLyrics || parsed.plainLyrics) {
              return resolve(parsed.syncedLyrics || parsed.plainLyrics);
            }
          }
        } catch (e) {}

        const query = `${cleanArtist} ${cleanTitle}`.trim();
        const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(query)}`;
        https.get(searchUrl, { headers: { 'User-Agent': 'devsize/2.0' }, timeout: 4000 }, (res2) => {
          let data2 = '';
          res2.on('data', c => data2 += c);
          res2.on('end', () => {
            try {
              const list = JSON.parse(data2);
              if (Array.isArray(list) && list.length > 0) {
                const withSynced = list.find(item => item.syncedLyrics);
                if (withSynced) return resolve(withSynced.syncedLyrics);
                return resolve(list[0].syncedLyrics || list[0].plainLyrics || null);
              }
            } catch (e) {}
            resolve(null);
          });
        }).on('error', () => resolve(null));
      });
    }).on('error', () => resolve(null));
  });
}

const crypto = require('crypto');

const SERVER_TOKEN = crypto.randomBytes(24).toString('hex');

const TOKEN_PROTECTED_ROUTES = new Set([
  '/api/state',
  '/api/translate',
  '/api/vibe',
  '/api/search',
  '/api/artist',
  '/api/lyrics',
  '/api/download',
  '/api/spotify-import',
  '/api/spotify-auth-start',
  '/api/spotify-status',
  '/api/spotify-library',
  '/api/spotify-logout',
  '/api/prefetch',
  '/api/check-cache',
  '/api/stream-info',
  '/api/track-analysis',
  '/api/tools-status',
  '/api/tools-install',
  '/api/library',
  '/api/library-add',
  '/api/library-update',
  '/api/library-remove',
  '/api/offline-library',
  '/api/offline-delete',
  '/api/clear-offline-library',
  '/api/save-custom-lyrics',
  '/api/encode'
]);

function getServerToken() {
  return SERVER_TOKEN;
}

function tokenMatches(provided) {
  if (typeof provided !== 'string') return false;
  const expected = Buffer.from(SERVER_TOKEN);
  const given = Buffer.from(provided);
  if (given.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(given, expected);
  } catch (e) {
    return false;
  }
}

function legacyCustomLyricsPath(title, artist) {
  const safeName = `${(artist || 'unknown').replace(/[^\w\s-]/g, '_')}_${(title || 'untitled').replace(/[^\w\s-]/g, '_')}.lrc`.toLowerCase().replace(/\s+/g, '_');
  return path.join(CUSTOM_LYRICS_DIR, safeName);
}

function legacyFetchedLyricsPath(title, artist) {
  const cleanTitle = (title || '').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  const cleanArtist = (artist || '').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  return path.join(LYRICS_DIR, `${cleanArtist}___${cleanTitle}.lrc`);
}

function lyricsKey(title, artist) {
  return crypto.createHash('sha1').update(`${(artist || '').trim().toLowerCase()}\u0000${(title || '').trim().toLowerCase()}`).digest('hex').slice(0, 16);
}

function getCustomLyricsPath(title, artist) {
  return path.join(CUSTOM_LYRICS_DIR, lyricsKey(title, artist) + '.lrc');
}

function getFetchedLyricsPath(title, artist) {
  return path.join(LYRICS_DIR, lyricsKey(title, artist) + '.lrc');
}

async function handleLyrics(req, res, title, artist, allowOnline = true) {
  const cacheKey = `${artist}:${title}`;
  if (lyricsCache.has(cacheKey)) {
    const cached = lyricsCache.get(cacheKey);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, lyrics: cached.text, isCustom: cached.isCustom || false }));
  }

  let customPath = getCustomLyricsPath(title, artist);
  if (!fs.existsSync(customPath) && /^[\x00-\x7F]*$/.test((title || '') + (artist || ''))) {
    const legacyPath = legacyCustomLyricsPath(title, artist);
    if (fs.existsSync(legacyPath)) {
      customPath = legacyPath;
    }
  }

  if (fs.existsSync(customPath)) {
    try {
      const customLyrics = await fs.promises.readFile(customPath, 'utf-8');
      lyricsCache.set(cacheKey, { text: customLyrics, isCustom: true });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, lyrics: customLyrics, isCustom: true }));
    } catch (e) {}
  }

  let fetchedLyricsPath = getFetchedLyricsPath(title, artist);
  if (!fs.existsSync(fetchedLyricsPath) && /^[\x00-\x7F]*$/.test((title || '') + (artist || ''))) {
    const legacyFetched = legacyFetchedLyricsPath(title, artist);
    if (fs.existsSync(legacyFetched)) {
      fetchedLyricsPath = legacyFetched;
    }
  }

  if (fs.existsSync(fetchedLyricsPath)) {
    try {
      const diskLyrics = await fs.promises.readFile(fetchedLyricsPath, 'utf-8');
      lyricsCache.set(cacheKey, { text: diskLyrics, isCustom: false });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, lyrics: diskLyrics, isCustom: false }));
    } catch (e) {}
  }

  if (!allowOnline) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, lyrics: '' }));
  }

  try {
    const rawLyrics = await fetchLyricsDirect(title, artist);
    if (rawLyrics && rawLyrics.trim().length > 0) {
      try {
        await fs.promises.writeFile(fetchedLyricsPath, rawLyrics, 'utf-8');
      } catch (e) {}
    }
    lyricsCache.set(cacheKey, { text: rawLyrics, isCustom: false });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, lyrics: rawLyrics }));
  } catch (err) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, lyrics: '' }));
  }
}

async function handleSaveCustomLyrics(req, res, title, artist) {
  let body = '';
  req.on('data', chunk => { if (res.writableEnded) return; body += chunk; if (body.length > MAX_BODY_BYTES) { body = ''; req.removeAllListeners('data'); req.removeAllListeners('end'); res.writeHead(413, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false, error: 'payload too large' })); req.resume(); } });
  req.on('end', async () => {
    try {
      const { lyrics } = JSON.parse(body);
      if (typeof lyrics !== 'string') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: 'No lyrics provided' }));
      }

      const customPath = getCustomLyricsPath(title, artist);
      await fs.promises.writeFile(customPath, lyrics, 'utf-8');

      const cacheKey = `${artist}:${title}`;
      lyricsCache.delete(cacheKey);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
  });
}

const SPOTIFY_PATHFINDER_URL = 'https://api-partner.spotify.com/pathfinder/v1/query';
const SPOTIFY_FETCH_PLAYLIST_HASH = '8964e8eafb21aa992a7d951d256d83285c04be2105d209262901de70cb97584a';

function pathfinderRequest(accessToken, variables) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      variables,
      operationName: 'fetchPlaylist',
      extensions: { persistedQuery: { version: 1, sha256Hash: SPOTIFY_FETCH_PLAYLIST_HASH } }
    });
    const req = https.request(SPOTIFY_PATHFINDER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'text/html,application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://open.spotify.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 15000
    }, (r) => {
      try { logger.log(r.statusCode === 200 ? 'warn' : 'error', `api-partner.spotify.com status ${r.statusCode}`); } catch (_) {}
      let b = '';
      r.on('data', c => b += c);
      r.on('end', () => {
        if (r.statusCode !== 200) return reject(new Error(`Pathfinder status ${r.statusCode}`));
        try { resolve(JSON.parse(b)); } catch (e) { reject(new Error('Invalid pathfinder response')); }
      });
    });
    req.on('error', (err) => {
      try { logger.log('error', `api-partner.spotify.com error: ${err.message}`); } catch (_) {}
      reject(err);
    });
    req.on('timeout', () => {
      req.destroy();
      try { logger.log('error', 'api-partner.spotify.com timeout'); } catch (_) {}
      reject(new Error('Pathfinder request timed out'));
    });
    req.write(payload);
    req.end();
  });
}

async function fetchFullSpotifyPlaylist(playlistId, accessToken) {
  const uri = `spotify:playlist:${playlistId}`;
  const first = await pathfinderRequest(accessToken, { uri, offset: 0, limit: 100, enableWatchFeedEntrypoint: true });
  const content = first?.data?.playlistV2?.content;
  if (!content || !Array.isArray(content.items)) return null;
  const total = content.totalCount || content.items.length;
  const items = content.items.slice();
  let offset = items.length;
  let guard = 0;
  while (offset < total && guard++ < 100) {
    const page = await pathfinderRequest(accessToken, { uri, offset, limit: 100, enableWatchFeedEntrypoint: true });
    const pageItems = page?.data?.playlistV2?.content?.items;
    if (!Array.isArray(pageItems) || pageItems.length === 0) break;
    items.push(...pageItems);
    offset += pageItems.length;
  }
  const tracks = items.map(it => {
    const t = it?.itemV2?.data || it?.item?.data || {};
    const artists = (t.albumOfTrack?.artists?.items || []).map(a => a.profile?.name).filter(Boolean);
    const durationMs = t.trackDuration?.totalMilliseconds || t.duration?.totalMilliseconds || t.duration_ms;
    const duration = typeof durationMs === 'number' ? Math.round(durationMs / 1000) : 0;
    return { title: (t.name || '').trim(), artist: artists.join(', '), duration };
  }).filter(t => t.title);
  return { tracks, total };
}

async function trySpotifyWebApi(playlistId) {
  if (!spotifyAuth || !spotifyAuth.token) return null;
  try {
    const resp = await spotifyGetWithRetry(`https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}`, spotifyAuth.token);
    if (resp.status >= 200 && resp.status < 300) {
      const d = JSON.parse(resp.body);
      const name = d.name || 'Spotify Playlist';
      const cover = (d.images && Array.isArray(d.images) && d.images[0] && d.images[0].url) ? d.images[0].url : '';
      const playlistItems = d.items || d.tracks;
      let items = Array.isArray(playlistItems?.items) ? playlistItems.items.slice() : [];
      let nextUrl = playlistItems?.next;
      let guard = 0;
      while (nextUrl && guard++ < 100) {
        const nextResp = await spotifyGetWithRetry(nextUrl, spotifyAuth.token);
        if (nextResp.status >= 200 && nextResp.status < 300) {
          const nextData = JSON.parse(nextResp.body);
          if (Array.isArray(nextData.items) && nextData.items.length) {
            items.push(...nextData.items);
            nextUrl = nextData.next;
          } else {
            break;
          }
        } else {
          break;
        }
      }
      const tracks = items.map(it => {
        const t = it.item || it.track || it;
        return {
          title: t.name || '',
          artist: Array.isArray(t.artists) ? t.artists.map(a => a.name).join(', ') : '',
          duration: t.duration_ms ? Math.round(t.duration_ms / 1000) : undefined
        };
      }).filter(t => t.title);
      return { success: true, name, cover, tracks, total: playlistItems?.total || tracks.length };
    }
  } catch (e) {}
  return null;
}

function fetchSpotifyEmbed(playlistId, ua) {
  return new Promise((resolve, reject) => {
    const embedUrl = `https://open.spotify.com/embed/playlist/${playlistId}`;
    const req = https.get(embedUrl, {
      headers: {
        'User-Agent': ua,
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/json',
        'Referer': 'https://open.spotify.com/'
      },
      timeout: 10000
    }, (res) => {
      try { logger.log(res.statusCode === 200 ? 'warn' : 'error', `open.spotify.com status ${res.statusCode}`); } catch (_) {}
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', (err) => {
      try { logger.log('error', `open.spotify.com error: ${err.message}`); } catch (_) {}
      reject(err);
    });
    req.on('timeout', () => {
      req.destroy();
      try { logger.log('error', 'open.spotify.com timeout'); } catch (_) {}
      reject(new Error('timeout'));
    });
  });
}

async function handleSpotifyImport(req, res, inputUrl) {
  const m = (inputUrl || '').match(/^(?:(?:https:\/\/)?open\.spotify\.com\/(?:embed\/)?playlist\/|spotify:playlist:)([a-zA-Z0-9]{22})(?:[/?#]|$)/);
  if (!m) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, code: 'spotify_error', error: 'Invalid Spotify playlist URL' }));
  }
  const playlistId = m[1];
  const primaryUa = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  const retryUa = 'Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0';

  let embedRes;
  try {
    embedRes = await fetchSpotifyEmbed(playlistId, primaryUa);
    if (embedRes.status === 403 || embedRes.status === 429) {
      await new Promise(r => setTimeout(r, 800));
      embedRes = await fetchSpotifyEmbed(playlistId, retryUa);
    }
  } catch (err) {
    const apiFallback = await trySpotifyWebApi(playlistId);
    if (apiFallback && apiFallback.tracks.length) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ...apiFallback, hasMore: apiFallback.total > apiFallback.tracks.length }));
    }
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, code: 'spotify_error', error: 'Network error connecting to Spotify' }));
  }

  if (embedRes.status === 404) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, code: 'spotify_not_found', error: 'Playlist not found' }));
  }
  if (embedRes.status === 403) {
    const apiFallback = await trySpotifyWebApi(playlistId);
    if (apiFallback && apiFallback.tracks.length) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ...apiFallback, hasMore: apiFallback.total > apiFallback.tracks.length }));
    }
    res.writeHead(403, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, code: 'spotify_forbidden', error: 'Spotify refused request (403)' }));
  }
  if (embedRes.status === 429) {
    res.writeHead(429, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, code: 'spotify_rate_limited', error: 'Spotify rate limited (429)' }));
  }
  if (embedRes.status !== 200) {
    const apiFallback = await trySpotifyWebApi(playlistId);
    if (apiFallback && apiFallback.tracks.length) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ...apiFallback, hasMore: apiFallback.total > apiFallback.tracks.length }));
    }
    res.writeHead(embedRes.status || 500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, code: 'spotify_error', error: `Spotify returned status ${embedRes.status}` }));
  }

  try {
    const body = embedRes.body;
    const nextDataMatch = body.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!nextDataMatch) {
      const apiFallback = await trySpotifyWebApi(playlistId);
      if (apiFallback && apiFallback.tracks.length) {
        const hasMore = apiFallback.total > apiFallback.tracks.length;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, name: apiFallback.name, cover: apiFallback.cover || '', tracks: apiFallback.tracks, hasMore, total: apiFallback.total }));
      }
      const isPriv = /private/i.test(body);
      res.writeHead(403, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, code: isPriv ? 'spotify_forbidden' : 'spotify_error', error: isPriv ? 'Private playlist' : 'Could not parse playlist' }));
    }

    const data = JSON.parse(nextDataMatch[1]);
    const pageProps = data?.props?.pageProps;
    if (pageProps?.status === 404) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, code: 'spotify_not_found', error: 'Playlist not found' }));
    }

    const entity = pageProps?.state?.data?.entity;
    const name = entity?.name || pageProps?.title || 'Spotify Playlist';
    const ogMatch = body.match(/<meta\s+(?:property|name)=["'](?:og:image|twitter:image)["']\s+content=["']([^"']+)["']/i);
    let cover = (entity?.images && Array.isArray(entity.images) && entity.images[0]?.url) ||
                (entity?.coverArt?.sources && Array.isArray(entity.coverArt.sources) && entity.coverArt.sources[0]?.url) ||
                entity?.image ||
                pageProps?.metadata?.image ||
                (ogMatch ? ogMatch[1] : '') ||
                '';

    let tracks = [];
    let limited = false;
    const accessToken = pageProps?.state?.settings?.session?.accessToken;
    let total = 0;
    if (accessToken) {
      try {
        const full = await fetchFullSpotifyPlaylist(playlistId, accessToken);
        if (full && full.tracks && full.tracks.length) {
          tracks = full.tracks;
          total = full.total || full.tracks.length;
        } else {
          limited = true;
          try { logger.log('warn', 'Spotify pathfinder non-200 or empty, falling back to embed trackList'); } catch (_) {}
        }
      } catch (e) {
        limited = true;
        try { logger.log('warn', `Spotify pathfinder error: ${e.message}, falling back to embed trackList`); } catch (_) {}
      }
    } else {
      limited = true;
    }

    if (!tracks.length) {
      if (Array.isArray(entity?.trackList) && entity.trackList.length > 0) {
        tracks = entity.trackList.slice(0, 100).map(t => {
          const duration = typeof t.duration === 'number' ? Math.round(t.duration / 1000) : (typeof t.duration_ms === 'number' ? Math.round(t.duration_ms / 1000) : 0);
          return {
            title: (t.title || t.name || '').trim(),
            artist: (t.subtitle || t.artist || '').trim(),
            duration
          };
        }).filter(t => t.title);
      }
      if (!tracks.length) {
        const seen = new Set();
        function walk(node) {
          if (!node || typeof node !== 'object') return;
          if (Array.isArray(node)) { for (const item of node) walk(item); return; }
          const uri = typeof node.uri === 'string' ? node.uri : '';
          const title = node.title || node.name;
          const subtitle = node.subtitle || node.artist || (Array.isArray(node.artists) ? node.artists.map(a => typeof a === 'string' ? a : (a.name || a.profile?.name)).filter(Boolean).join(', ') : (node.albumOfTrack?.artists?.items || []).map(a => a.profile?.name).filter(Boolean).join(', '));
          const duration = node.duration?.totalMilliseconds || node.trackDuration?.totalMilliseconds || node.duration_ms || (typeof node.duration === 'number' ? node.duration : 0);
          if (title && typeof title === 'string' && (subtitle || uri.startsWith('spotify:track:')) && (uri.startsWith('spotify:track:') || node.entityType === 'track' || duration)) {
            const key = `${title}__${subtitle || ''}`;
            if (!seen.has(key)) {
              seen.add(key);
              const durSec = typeof duration === 'number' ? (duration > 1000 ? Math.round(duration / 1000) : Math.round(duration)) : 0;
              tracks.push({ title: title.trim(), artist: typeof subtitle === 'string' ? subtitle.trim() : '', duration: durSec });
            }
            return;
          }
          for (const k of Object.keys(node)) walk(node[k]);
        }
        walk(data);
        tracks = tracks.slice(0, 100);
      }
    }

    if (!total) {
      total = entity?.totalCount || (Array.isArray(entity?.trackList) ? entity.trackList.length : 0) || tracks.length;
    }

    if (!tracks.length) {
      const apiFallback = await trySpotifyWebApi(playlistId);
      if (apiFallback && apiFallback.tracks.length) {
        const hasMore = apiFallback.total > apiFallback.tracks.length;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, name: apiFallback.name, cover: apiFallback.cover || cover, tracks: apiFallback.tracks, hasMore, total: apiFallback.total, limited }));
      }
      const isPriv = /private/i.test(body) || /private/i.test(JSON.stringify(pageProps || {}));
      res.writeHead(403, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, code: isPriv ? 'spotify_forbidden' : 'spotify_error', error: isPriv ? 'Private playlist' : 'Could not read tracks' }));
    }

    const hasMore = total > tracks.length;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, name, cover, tracks, hasMore, total, limited }));
  } catch (err) {
    try { logger.log('error', `Spotify import failed: ${err.message}`); } catch (_) {}
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, code: 'spotify_error', error: 'Internal server error' }));
  }
}

function fetchHtmlWithRedirects(targetUrl, maxRedirects = 5, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    let redirects = 0;
    function fetchUrl(currentUrl) {
      let parsed;
      try { parsed = new URL(currentUrl); } catch (e) { return reject(e); }
      const client = parsed.protocol === 'http:' ? http : https;
      const req = client.get(currentUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        timeout: timeoutMs
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          if (++redirects > maxRedirects) {
            return reject(new Error('Too many redirects'));
          }
          const nextUrl = new URL(res.headers.location, currentUrl).toString();
          return fetchUrl(nextUrl);
        }
        let body = '';
        res.on('data', c => body += c);
        res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body }));
      });
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
      req.on('error', reject);
    }
    fetchUrl(targetUrl);
  });
}

async function handleAppleImport(req, res, inputUrl) {
  const albumMatch = (inputUrl || '').match(/music\.apple\.com\/(?:[a-z]{2}\/)?album\/(?:[^/]+\/)?(\d+)/i);
  if (albumMatch) {
    try {
      const data = await fetchItunesJson(`https://itunes.apple.com/lookup?id=${albumMatch[1]}&entity=song`);
      const results = (data && Array.isArray(data.results)) ? data.results : [];
      const albumItem = results.find(r => r && r.wrapperType === 'collection');
      if (albumItem) {
        const tracks = results
          .filter(r => r && r.wrapperType === 'track')
          .map(item => ({
            title: item.trackName || '',
            artist: item.artistName || albumItem.artistName || '',
            duration: item.trackTimeMillis ? Math.round(item.trackTimeMillis / 1000) : 0
          }));
        if (tracks.length > 0) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            success: true,
            name: albumItem.collectionName || 'Album',
            cover: (albumItem.artworkUrl100 || '').replace('100x100', '600x600'),
            tracks
          }));
        }
      }
    } catch (_) {}
  }

  const m = (inputUrl || '').match(/music\.apple\.com\/.*?(pl\.(?:u-)?[a-zA-Z0-9_-]+)/i);
  if (!m) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, error: 'Invalid Apple Music playlist URL' }));
  }

  try {
    const fetched = await fetchHtmlWithRedirects(inputUrl, 5, 15000);
    const { statusCode, body } = fetched;

    if (statusCode === 404) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: 'not_found', status: 404 }));
    }
    if (statusCode === 429) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: 'rate_limit', status: 429 }));
    }
    if (statusCode === 401 || statusCode === 403) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: 'private', status: 403 }));
    }

    let parsedData = null;
    const serverDataMatch = body.match(/<script\s+type=["']application\/json["']\s+id=["']serialized-server-data["'][^>]*>([\s\S]*?)<\/script>/i);
    if (serverDataMatch) {
      try { parsedData = JSON.parse(serverDataMatch[1]); } catch (e) {}
    }
    if (!parsedData) {
      const ldMatch = body.match(/<script\s+id=["']schema:music-playlist["']\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
      if (ldMatch) {
        try { parsedData = JSON.parse(ldMatch[1]); } catch (e) {}
      }
    }

    if (!parsedData) {
      const isPriv = /private|sign\s*in|login/i.test(body);
      res.writeHead(403, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: isPriv ? 'private' : 'restricted', status: 403 }));
    }

    const tracks = [];
    const seen = new Set();
    let plTitle = '';
    let plCover = '';
    let totalCount = 0;

    function walk(node) {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) {
        for (const item of node) walk(item);
        return;
      }

      if (!plTitle) {
        if (node.contentDescriptor?.kind === 'playlist' || node.type === 'playlists' || node.type === 'playlist') {
          plTitle = node.title || node.name || node.attributes?.name || '';
          if (node.artwork?.dictionary?.url) plCover = node.artwork.dictionary.url;
          else if (node.artwork?.url) plCover = node.artwork.url;
        } else if (node['@type'] === 'MusicPlaylist') {
          plTitle = node.name || '';
        }
      }

      if (!totalCount && typeof node.trackCount === 'number') {
        totalCount = node.trackCount;
      }

      const title = (typeof node.title === 'string' ? node.title : (typeof node.name === 'string' && (node['@type'] === 'MusicRecording' || node.type === 'songs') ? node.name : '')).trim();
      const artist = (typeof node.artistName === 'string' ? node.artistName : (typeof node.artist === 'string' ? node.artist : (typeof node.byArtist?.name === 'string' ? node.byArtist.name : ''))).trim();
      const durRaw = node.durationInMillis || node.duration || node.duration_ms;
      let duration;
      if (typeof durRaw === 'number') {
        duration = durRaw > 1000 ? Math.round(durRaw / 1000) : Math.round(durRaw);
      } else if (typeof durRaw === 'string' && durRaw.startsWith('PT')) {
        const mDur = durRaw.match(/PT(?:(\d+)M)?(?:(\d+)S)?/);
        if (mDur) duration = (parseInt(mDur[1] || '0', 10) * 60) + parseInt(mDur[2] || '0', 10);
      }

      if (title && artist && (node.contentDescriptor?.kind === 'song' || node.contentDescriptor?.kind === 'music-video' || node.type === 'songs' || node.type === 'song' || node.type === 'library-songs' || node['@type'] === 'MusicRecording' || duration || node.audioTraits)) {
        const key = `${title.toLowerCase()}___${artist.toLowerCase()}`;
        if (!seen.has(key)) {
          seen.add(key);
          tracks.push({ title, artist, duration });
        }
        return;
      }

      for (const k of Object.keys(node)) {
        walk(node[k]);
      }
    }

    walk(parsedData);

    if (!plTitle) {
      const ogMatch = body.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']*)["']/i);
      if (ogMatch) {
        plTitle = ogMatch[1].replace(/\s*on Apple Music\s*$/i, '').trim();
      } else {
        const titleMatch = body.match(/<title>([^<]*)<\/title>/i);
        if (titleMatch) {
          plTitle = titleMatch[1].replace(/\s*-\s*Playlist\s*-\s*Apple Music\s*$/i, '').replace(/^[^\w\s]+/, '').trim();
        }
      }
    }

    if (plCover && typeof plCover === 'string' && plCover.includes('{w}x{h}bb.{f}')) {
      plCover = plCover.replace('{w}x{h}bb.{f}', '600x600bb.jpg');
    }

    if (!tracks.length) {
      const isPriv = /private|sign\s*in|login/i.test(body) || !tracks.length;
      res.writeHead(403, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: isPriv ? 'private' : 'restricted', status: 403 }));
    }

    const total = totalCount || tracks.length;
    const hasMore = total > tracks.length;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, name: plTitle || 'Apple Music Playlist', cover: plCover, tracks, hasMore, total }));
  } catch (err) {
    try { logger.error('Apple import failed: ' + inputUrl, err); } catch (_) {}
    const isNet = err.message === 'timeout' || /fetch|network|dns|econnrefused|etimedout/i.test(err.message || '');
    res.writeHead(isNet ? 504 : 500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, error: isNet ? 'network' : 'unknown', status: isNet ? 504 : 500 }));
  }
}

async function handlePlaylistImport(req, res, inputUrl) {
  let parsed;
  try {
    parsed = new URL(inputUrl);
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, error: 'Unsupported link' }));
  }

  const host = (parsed.hostname || '').toLowerCase();
  const isSoundCloud = host === 'soundcloud.com' || host === 'www.soundcloud.com' || host.endsWith('.soundcloud.com');
  const isYouTube = host === 'youtube.com' || host === 'music.youtube.com' || host === 'www.youtube.com' || host === 'youtu.be' || host.endsWith('.youtube.com');

  if (!isSoundCloud && !isYouTube) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, error: 'Unsupported link' }));
  }

  const platform = isSoundCloud ? 'soundcloud' : (host === 'music.youtube.com' ? 'ytmusic' : 'youtube');

  if (isSoundCloud && inputUrl.includes('/sets/')) {
    try {
      const page = await fetch(inputUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }).then(r => r.text());
      const hyd = page.match(/window\.__sc_hydration\s*=\s*(\[[\s\S]*?\]);\s*<\/script>/);
      if (hyd) {
        const list = JSON.parse(hyd[1]);
        const pl = list.find(x => x.hydratable === 'playlist')?.data;
        if (pl && Array.isArray(pl.tracks)) {
          let cid = 'tHVbSbDP4TaoMbPppngv6Tdry83vNbMQ';
          const scripts = [...page.matchAll(/src="(https:\/\/a-v2\.sndcdn\.com\/assets\/[^"]+\.js)"/g)].map(x => x[1]);
          for (const s of scripts) {
            try {
              const code = await fetch(s).then(r => r.text());
              const cm = code.match(/client_id[:=]["']([a-zA-Z0-9]{32})["']/);
              if (cm) { cid = cm[1]; break; }
            } catch (_) {}
          }
          const full = pl.tracks.filter(t => t && t.title);
          const missing = pl.tracks.filter(t => t && !t.title).map(t => t.id);
          for (let i = 0; i < missing.length; i += 50) {
            const chunk = missing.slice(i, i + 50);
            try {
              const u = `https://api-v2.soundcloud.com/tracks?ids=${chunk.join(',')}&client_id=${cid}`;
              const items = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0' } }).then(r => r.json());
              if (Array.isArray(items)) full.push(...items);
            } catch (_) {}
          }
          const tracks = full.map(t => ({
            id: String(t.id),
            title: t.title || 'untitled',
            artist: (t.user && (t.user.username || t.user.name)) || 'unknown artist',
            duration: Math.round((t.duration || t.full_duration || 0) / 1000),
            thumbnail: t.artwork_url || (t.user && t.user.avatar_url) || '',
            url: t.permalink_url || '',
            platform: 'soundcloud',
            isCached: false
          }));
          if (tracks.length > 0) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({
              success: true,
              name: pl.title || 'SoundCloud Playlist',
              cover: pl.artwork_url || '',
              tracks
            }));
          }
        }
      }
    } catch (_) {}
  }
  const args = [
    '--dump-single-json',
    '--no-warnings',
    '--no-check-certificates',
    '--playlist-end',
    '5000'
  ];
  if (platform === 'youtube') {
    args.unshift('--flat-playlist');
    args.push('--extractor-args', 'youtube:player_client=android');
  }
  args.push(inputUrl);

  try {
    let raw = await executeYtDlp(args, 60000);
    let data = JSON.parse(raw);
    let entries = Array.isArray(data.entries) ? data.entries : [data];

    if (entries.length > 0 && !entries[0].title && args.includes('--flat-playlist')) {
      const deepArgs = args.filter(a => a !== '--flat-playlist');
      const deepRaw = await executeYtDlp(deepArgs, 60000);
      data = JSON.parse(deepRaw);
      entries = Array.isArray(data.entries) ? data.entries : [data];
    }

    const tracks = [];

    for (const item of entries) {
      if (!item || !item.id) continue;
      if (item.title === '[Private video]' || item.title === '[Deleted video]') continue;

      const trackUrl = platform === 'youtube'
        ? `https://www.youtube.com/watch?v=${item.id}`
        : (item.webpage_url || item.url);
      if (!trackUrl) continue;

      let titleVal = (item.title || item.track || item.fulltitle || item.name || '').trim();
      let artistVal = (item.artist || (Array.isArray(item.artists) ? item.artists.join(', ') : '') || item.creator || item.channel || item.uploader || item.album_artist || '').trim();
      if (artistVal) artistVal = artistVal.replace(/\s*-\s*Topic$/i, '').trim();

      if (titleVal.includes(' - ')) {
        const parts = titleVal.split(' - ');
        if (!artistVal || artistVal.toLowerCase() === 'unknown artist' || artistVal.toLowerCase() === 'various artists') {
          artistVal = parts[0].trim();
          titleVal = parts.slice(1).join(' - ').trim() || titleVal;
        } else if (parts[0].trim().toLowerCase() === artistVal.toLowerCase()) {
          titleVal = parts.slice(1).join(' - ').trim() || titleVal;
        }
      }
      if (!titleVal) titleVal = 'untitled';
      if (!artistVal) artistVal = 'unknown artist';

      let thumbnail = '';
      if (platform === 'youtube') {
        thumbnail = `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`;
      } else {
        if (Array.isArray(item.thumbnails) && item.thumbnails.length > 0) {
          const t = item.thumbnails.find(x => x.id === 't500x500' || x.id === 'large' || x.id === 'crop' || x.id === 'original') || item.thumbnails[item.thumbnails.length - 1];
          thumbnail = (t && t.url) ? t.url : '';
        }
        if (!thumbnail) thumbnail = item.thumbnail || item.artwork_url || item.avatar_url || '';
      }

      tracks.push({
        id: String(item.id),
        title: titleVal,
        artist: artistVal,
        duration: Math.round(item.duration || 0),
        thumbnail,
        url: trackUrl,
        platform,
        isCached: false
      });
    }

    if (!tracks.length) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: 'No tracks found' }));
    }

    let cover = '';
    if (Array.isArray(data.thumbnails) && data.thumbnails.length > 0) {
      const last = data.thumbnails[data.thumbnails.length - 1];
      cover = (last && last.url) ? last.url : (typeof last === 'string' ? last : '');
    }
    if (!cover && data.thumbnail) {
      cover = typeof data.thumbnail === 'string' ? data.thumbnail : (data.thumbnail.url || '');
    }
    if (!cover && tracks.length === 1 && tracks[0] && tracks[0].thumbnail) {
      cover = tracks[0].thumbnail;
    }
    if (!cover) cover = '';

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, name: data.title || 'Imported playlist', cover, tracks }));
  } catch (err) {
    try { logger.error('Playlist import failed: ' + inputUrl, err); } catch (_) {}
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, error: err.message }));
  }
}

const SPOTIFY_SCOPES = 'user-library-read playlist-read-private playlist-read-collaborative';
let spotifyAuth = { verifier: '', state: '', clientId: '', token: '' };
let spotifyAuthError = '';

function getSpotifyRedirectUri() {
  const a = server.address();
  const port = (a && typeof a === 'object' && a.port) ? a.port : PORT;
  return `http://127.0.0.1:${port}/api/spotify-callback`;
}

function exchangeSpotifyCode(code, verifier, clientId, redirectUri) {
  return new Promise((resolve, reject) => {
    const postData = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: verifier
    }).toString();

    const req = https.request('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 15000
    }, (resp) => {
      let body = '';
      resp.on('data', c => body += c);
      resp.on('end', () => {
        try {
          const data = JSON.parse(body);
          resolve({ status: resp.statusCode, data });
        } catch (e) {
          resolve({ status: resp.statusCode, error: e });
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Token exchange timed out')); });
    req.write(postData);
    req.end();
  });
}

function spotifyApiGet(requestUrl, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(requestUrl);
    const req = https.get(u, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 15000
    }, (resp) => {
      let body = '';
      resp.on('data', c => body += c);
      resp.on('end', () => {
        resolve({ status: resp.statusCode, headers: resp.headers, body });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Spotify API timed out')); });
  });
}

async function spotifyGetWithRetry(requestUrl, token) {
  let resp = await spotifyApiGet(requestUrl, token);
  if (resp.status === 429) {
    const retryAfter = parseInt(resp.headers['retry-after'] || '1', 10);
    await new Promise(r => setTimeout(r, Math.max(1, retryAfter) * 1000));
    resp = await spotifyApiGet(requestUrl, token);
  }
  return resp;
}

function spotifyApiFailure(resp, endpoint) {
  let detail = '';
  try {
    const error = JSON.parse(resp.body).error;
    detail = typeof error === 'string' ? error : (error?.message || '');
  } catch (e) {}
  return new Error(`Spotify ${endpoint} returned HTTP ${resp.status}${detail ? `: ${detail}` : ''}`);
}

async function handleSpotifyLibrary(req, res, query) {
  if (!spotifyAuth.token) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, error: 'Unauthorized' }));
  }

  const wantLikes = query.likes === '1' || query.likes === 'true';
  const wantPlaylists = query.playlists === '1' || query.playlists === 'true';

  let likes = [];
  let playlists = [];
  const skippedPlaylists = [];

  try {
    if (wantLikes) {
      let nextUrl = 'https://api.spotify.com/v1/me/tracks?limit=50';
      while (nextUrl && likes.length < 5000) {
        const resp = await spotifyGetWithRetry(nextUrl, spotifyAuth.token);
        if (resp.status < 200 || resp.status >= 300) throw spotifyApiFailure(resp, 'saved tracks');
        let data = {};
        try { data = JSON.parse(resp.body); } catch (e) { break; }
        const items = Array.isArray(data.items) ? data.items : [];
        for (const it of items) {
          const t = it?.item || it?.track;
          if (!t || t.is_local || t.type === 'episode') continue;
          const artist = (Array.isArray(t.artists) && t.artists[0]?.name) || '';
          const title = t.name || '';
          const duration = t.duration_ms ? Math.round(t.duration_ms / 1000) : undefined;
          if (title) likes.push({ title, artist, duration });
          if (likes.length >= 5000) break;
        }
        nextUrl = data.next || null;
      }
    }

    if (wantPlaylists) {
      let userPlaylists = [];
      let plNext = 'https://api.spotify.com/v1/me/playlists?limit=50';
      while (plNext) {
        const resp = await spotifyGetWithRetry(plNext, spotifyAuth.token);
        if (resp.status < 200 || resp.status >= 300) throw spotifyApiFailure(resp, 'playlists');
        let data = {};
        try { data = JSON.parse(resp.body); } catch (e) { break; }
        const items = Array.isArray(data.items) ? data.items : [];
        for (const pl of items) {
          if (pl && pl.id && pl.name) {
            userPlaylists.push({ id: pl.id, name: pl.name });
          }
        }
        plNext = data.next || null;
      }

      for (const pl of userPlaylists) {
        const plTracks = [];
        let skipped = false;
        let itemUrl = `https://api.spotify.com/v1/playlists/${encodeURIComponent(pl.id)}/items?limit=50`;
        let resp = await spotifyGetWithRetry(itemUrl, spotifyAuth.token);
        if (resp.status === 404 || resp.status === 400) {
          itemUrl = `https://api.spotify.com/v1/playlists/${encodeURIComponent(pl.id)}/tracks?limit=50`;
          resp = await spotifyGetWithRetry(itemUrl, spotifyAuth.token);
        }

        // Dev Mode may deny items of playlists the current user does not own or collaborate on.
        if (resp.status === 403) {
          skippedPlaylists.push(pl.name);
          continue;
        }
        if (resp.status < 200 || resp.status >= 300) throw spotifyApiFailure(resp, `playlist items (${pl.name})`);

        let pageData = {};
        try { pageData = JSON.parse(resp.body); } catch (e) {}
        const pageItems = Array.isArray(pageData.items) ? pageData.items : [];
        for (const it of pageItems) {
          const t = it?.item || it?.track;
          if (!t || t.is_local || t.type === 'episode') continue;
          const artist = (Array.isArray(t.artists) && t.artists[0]?.name) || '';
          const title = t.name || '';
          const duration = t.duration_ms ? Math.round(t.duration_ms / 1000) : undefined;
          if (title) plTracks.push({ title, artist, duration });
        }
        let trackNext = pageData.next || null;
        while (trackNext) {
          const nextResp = await spotifyGetWithRetry(trackNext, spotifyAuth.token);
          if (nextResp.status === 403) {
            skippedPlaylists.push(pl.name);
            skipped = true;
            break;
          }
          if (nextResp.status < 200 || nextResp.status >= 300) throw spotifyApiFailure(nextResp, `playlist items (${pl.name})`);
          let nextData = {};
          try { nextData = JSON.parse(nextResp.body); } catch (e) { break; }
          const nextItems = Array.isArray(nextData.items) ? nextData.items : [];
          for (const it of nextItems) {
            const t = it?.item || it?.track;
            if (!t || t.is_local || t.type === 'episode') continue;
            const artist = (Array.isArray(t.artists) && t.artists[0]?.name) || '';
            const title = t.name || '';
            const duration = t.duration_ms ? Math.round(t.duration_ms / 1000) : undefined;
            if (title) plTracks.push({ title, artist, duration });
          }
          trackNext = nextData.next || null;
        }
        if (!skipped) playlists.push({ name: pl.name, tracks: plTracks });
      }
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, likes, playlists, skippedPlaylists }));
  } catch (err) {
    res.writeHead(/returned HTTP 403/.test(err.message) ? 403 : 500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: err.message }));
  }
}

function callTranslate(text, to) {
  return new Promise((resolve) => {
    const clients = ['dict-chrome-ex', 'gtx'];
    let idx = 0;
    function tryNext() {
      if (idx >= clients.length) return resolve(null);
      const c = clients[idx++];
      const u = `https://translate.googleapis.com/translate_a/single?client=${c}&sl=auto&tl=${encodeURIComponent(to)}&dt=t&q=${encodeURIComponent(text)}`;
      const req = https.get(u, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 8000 }, (res) => {
        let b = '';
        res.on('data', chunk => b += chunk);
        res.on('end', () => {
          if (res.statusCode !== 200) return tryNext();
          try {
            const data = JSON.parse(b);
            if (data && Array.isArray(data[0])) {
              const joined = data[0].map(s => s[0]).join('').split('\n');
              return resolve(joined);
            }
          } catch (e) {}
          tryNext();
        });
      });
      req.on('error', tryNext);
      req.on('timeout', () => { req.destroy(); tryNext(); });
    }
    tryNext();
  });
}

async function handleTranslate(req, res, lines, to = 'en') {
  if (!Array.isArray(lines) || lines.length === 0) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, translations: [] }));
  }

  const chunks = [];
  let curChunk = [];
  let curLen = 0;
  for (const line of lines) {
    if (curChunk.length > 0 && curLen + line.length + 1 > 1800) {
      chunks.push(curChunk);
      curChunk = [];
      curLen = 0;
    }
    curChunk.push(line);
    curLen += line.length + 1;
  }
  if (curChunk.length > 0) chunks.push(curChunk);

  const allTranslations = [];
  for (const chunk of chunks) {
    const joined = chunk.join('\n');
    let chunkTrans = await callTranslate(joined, to);
    if (!chunkTrans || chunkTrans.length !== chunk.length) {
      chunkTrans = [];
      for (const line of chunk) {
        if (!line.trim()) {
          chunkTrans.push('');
          continue;
        }
        const single = await callTranslate(line, to);
        chunkTrans.push((single && single[0]) ? single[0] : line);
      }
    }
    allTranslations.push(...chunkTrans);
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: true, translations: allTranslations }));
}

const albumCache = new Map();

function getAlbumCache(key) {
  const entry = albumCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    albumCache.delete(key);
    return null;
  }
  return entry.data;
}

function setAlbumCache(key, data) {
  if (albumCache.has(key)) {
    albumCache.delete(key);
  } else if (albumCache.size >= 100) {
    const oldestKey = albumCache.keys().next().value;
    albumCache.delete(oldestKey);
  }
  albumCache.set(key, { data, expires: Date.now() + 15 * 60 * 1000 });
}

function fetchItunesJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 10000
    }, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try {
          resolve(JSON.parse(raw));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });
    req.on('error', err => reject(err));
  });
}

async function handleAlbumSearch(req, res, parsedUrl) {
  const q = (parsedUrl.query.q || '').trim();

  if (!q) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, albums: [] }));
  }

  const cacheKey = `search:${q.toLowerCase()}`;
  const cached = getAlbumCache(cacheKey);
  if (cached) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(cached));
  }

  try {
    const albumUrlMatch = q.match(/music\.apple\.com\/(?:[a-z]{2}\/)?album\/(?:[^/]+\/)?(\d+)/i);
    if (albumUrlMatch) {
      const data = await fetchItunesJson(`https://itunes.apple.com/lookup?id=${albumUrlMatch[1]}&entity=album`);
      const results = (data && Array.isArray(data.results)) ? data.results : [];
      const item = results.find(r => r && r.wrapperType === 'collection');
      if (item) {
        const responseData = {
          success: true,
          albums: [{
            id: String(item.collectionId),
            title: item.collectionName || '',
            artist: item.artistName || '',
            year: item.releaseDate ? item.releaseDate.slice(0, 4) : '',
            trackCount: item.trackCount || 0,
            cover: (item.artworkUrl100 || '').replace('100x100', '600x600')
          }]
        };
        setAlbumCache(cacheKey, responseData);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(responseData));
      }
    }

    const cleanQ = q.replace(/\s+-\s+/g, ' ').replace(/\bby\b/gi, ' ').replace(/\s+/g, ' ').trim();
    const urls = [
      `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=album&media=music&limit=25`,
      `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&limit=25`
    ];
    if (cleanQ && cleanQ.toLowerCase() !== q.toLowerCase()) {
      urls.push(`https://itunes.apple.com/search?term=${encodeURIComponent(cleanQ)}&entity=album&media=music&limit=25`);
      urls.push(`https://itunes.apple.com/search?term=${encodeURIComponent(cleanQ)}&media=music&limit=25`);
    }

    const responses = await Promise.all(urls.map(u => fetchItunesJson(u).catch(() => null)));
    const results = [];
    for (const data of responses) {
      if (data && Array.isArray(data.results)) {
        results.push(...data.results);
      }
    }

    const albums = [];
    const seen = new Set();
    const normalize = (s) => (s || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

    for (const item of results) {
      if (!item || item.collectionId == null) continue;
      const name = item.collectionName || '';
      if (/\s-\s*Single$/i.test(name)) continue;
      const trackCount = item.trackCount || 0;
      if (trackCount < 4 && !/\s-\s*EP$/i.test(name)) continue;

      const normKey = `${normalize(name)}:${normalize(item.artistName)}`;
      if (seen.has(normKey)) continue;
      seen.add(normKey);

      albums.push({
        id: String(item.collectionId),
        title: name,
        artist: item.artistName || '',
        year: item.releaseDate ? item.releaseDate.slice(0, 4) : '',
        trackCount: trackCount,
        cover: (item.artworkUrl100 || '').replace('100x100', '600x600')
      });
    }

    const words = cleanQ.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(w => w.length > 1);
    const scoreAlbum = (album) => {
      const title = (album.title || '').toLowerCase();
      const artist = (album.artist || '').toLowerCase();
      const full = title + ' ' + artist;
      let score = 0;
      for (const w of words) {
        if (title.includes(w)) score += 15;
        else if (artist.includes(w)) score += 10;
      }
      if (title === cleanQ.toLowerCase() || full === cleanQ.toLowerCase()) score += 50;
      else if (full.includes(cleanQ.toLowerCase()) || cleanQ.toLowerCase().includes(title)) score += 25;
      return score;
    };

    albums.sort((a, b) => scoreAlbum(b) - scoreAlbum(a));
    const responseData = { success: true, albums: albums.slice(0, 12) };
    setAlbumCache(cacheKey, responseData);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(responseData));
  } catch (err) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, error: 'Album service unavailable' }));
  }
}

async function handleAlbumTracks(req, res, parsedUrl) {
  const id = (parsedUrl.query.id || '').trim();
  if (!/^\d+$/.test(id)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, error: 'Invalid album id' }));
  }

  const cacheKey = `tracks:${id}`;
  const cached = getAlbumCache(cacheKey);
  if (cached) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(cached));
  }

  try {
    const url = `https://itunes.apple.com/lookup?id=${id}&entity=song`;
    const data = await fetchItunesJson(url);
    const results = (data && Array.isArray(data.results)) ? data.results : [];
    const albumItem = results.find(r => r && r.wrapperType === 'collection');
    if (!albumItem) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: 'Album not found' }));
    }
    const album = {
      id: String(albumItem.collectionId),
      title: albumItem.collectionName || '',
      artist: albumItem.artistName || '',
      year: albumItem.releaseDate ? albumItem.releaseDate.slice(0, 4) : '',
      trackCount: albumItem.trackCount || 0,
      cover: (albumItem.artworkUrl100 || '').replace('100x100', '600x600')
    };
    const tracks = results
      .filter(r => r && r.wrapperType === 'track')
      .map(item => ({
        no: item.trackNumber || 1,
        disc: item.discNumber || 1,
        title: item.trackName || '',
        artist: item.artistName || '',
        durationMs: item.trackTimeMillis || 0
      }))
      .sort((a, b) => (a.disc - b.disc) || (a.no - b.no));

    const responseData = { success: true, album, tracks };
    setAlbumCache(cacheKey, responseData);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(responseData));
  } catch (err) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, error: 'Album service unavailable' }));
  }
}

let hotPicksCache = { data: null, expires: 0 };

async function handleHotPicks(req, res, parsedUrl) {
  const limit = Math.max(1, Math.min(25, parseInt(parsedUrl.query.limit || '12', 10) || 12));

  if (hotPicksCache.data && Date.now() < hotPicksCache.expires) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: true,
      title: hotPicksCache.data.title,
      tracks: hotPicksCache.data.tracks.slice(0, limit)
    }));
  }

  try {
    const data = await fetchItunesJson('https://api.deezer.com/chart/0/tracks?limit=40');
    const rawItems = (data && Array.isArray(data.data)) ? data.data : [];
    const candidates = rawItems
      .filter(item => item && item.title && item.artist && item.artist.name)
      .map(item => ({ artist: item.artist.name, title: item.title }));

    if (candidates.length === 0) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false }));
    }

    const resolvedTracks = [];
    const seenIds = new Set();
    let cIdx = 0;

    const worker = async () => {
      while (cIdx < candidates.length && resolvedTracks.length < 12) {
        const c = candidates[cIdx++];
        if (!c) break;
        try {
          const track = await resolveCandidate(c);
          if (track && !seenIds.has(track.id)) {
            seenIds.add(track.id);
            if (resolvedTracks.length < 12) {
              resolvedTracks.push(track);
            }
          }
        } catch (_) {}
      }
    };

    await Promise.all([worker(), worker(), worker(), worker()]);

    if (resolvedTracks.length === 0) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false }));
    }

    const title = 'Hot picks ' + new Date().getFullYear();
    hotPicksCache = {
      data: { title, tracks: resolvedTracks },
      expires: Date.now() + 60 * 60 * 1000
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: true,
      title,
      tracks: resolvedTracks.slice(0, limit)
    }));
  } catch (err) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false }));
  }
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  const requestOrigin = req.headers.origin;
  if (requestOrigin && requestOrigin !== 'null') {
    let originAllowed = false;
    try {
      const originUrl = new URL(requestOrigin);
      originAllowed = originUrl.protocol === 'file:' || originUrl.hostname === '127.0.0.1' || originUrl.hostname === 'localhost' || originUrl.hostname === '::1';
    } catch (e) {
      originAllowed = false;
    }
    if (!originAllowed) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: 'forbidden' }));
    }
  }

  const hostName = (req.headers.host || '').replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
  if (hostName && hostName !== '127.0.0.1' && hostName !== 'localhost' && hostName !== '::1') {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, error: 'forbidden' }));
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const parsedUrl = url.parse(req.url, true);

  if (TOKEN_PROTECTED_ROUTES.has(parsedUrl.pathname) && !tokenMatches(req.headers['x-riff-token'])) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, error: 'forbidden' }));
  }

  if (parsedUrl.pathname === '/api/audio-output-info' && req.method === 'GET') {
    const info = await getSystemAudioOutputInfo();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(info));
  }

  if (parsedUrl.pathname === '/api/translate' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { if (res.writableEnded) return; body += chunk; if (body.length > MAX_BODY_BYTES) { body = ''; req.removeAllListeners('data'); req.removeAllListeners('end'); res.writeHead(413, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false, error: 'payload too large' })); req.resume(); } });
    req.on('end', () => {
      const payload = safeJsonParse(body, {});
      const texts = payload.texts || payload.lines || [];
      const targetLang = payload.targetLang || payload.to || 'en';
      handleTranslate(req, res, texts, targetLang);
    });
    return;
  }

  if (parsedUrl.pathname === '/api/state' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { if (res.writableEnded) return; body += chunk; if (body.length > MAX_BODY_BYTES) { body = ''; req.removeAllListeners('data'); req.removeAllListeners('end'); res.writeHead(413, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false, error: 'payload too large' })); req.resume(); } });
    req.on('end', () => {
      try {
        const state = JSON.parse(body);
        currentAppState = state;
        broadcastSSE(state);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(400); res.end();
      }
    });
    return;
  }

  if (parsedUrl.pathname === '/api/lyrics-stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    sseClients.add(res);
    res.write(`data: ${JSON.stringify(currentAppState)}\n\n`);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  if (parsedUrl.pathname === '/api/download') {
    const trackUrl = parsedUrl.query.url || '';
    const trackId = parsedUrl.query.id || '';
    const streamUrl = parsedUrl.query.streamUrl || '';
    const title = parsedUrl.query.title || '';
    const artist = parsedUrl.query.artist || '';
    const format = parsedUrl.query.format || 'mp3';
    const quality = parsedUrl.query.quality || '0';
    const raw = parsedUrl.query.raw === '1' || parsedUrl.query.raw === 'true';
    let start = null;
    if (parsedUrl.query.start !== undefined && parsedUrl.query.start !== '') {
      const n = parseFloat(parsedUrl.query.start);
      if (!isNaN(n)) start = Math.max(0, n);
    }
    let end = null;
    if (parsedUrl.query.end !== undefined && parsedUrl.query.end !== '') {
      const n = parseFloat(parsedUrl.query.end);
      if (!isNaN(n)) end = Math.max(0, n);
    }
    return handleDownload(req, res, trackUrl, title, artist, format, quality, start, end, raw, trackId, streamUrl);
  }

  if (parsedUrl.pathname === '/api/tmp-file') {
    return handleTmpFile(req, res, parsedUrl);
  }

  if (parsedUrl.pathname === '/api/encode' && req.method === 'POST') {
    return handleEncode(req, res, parsedUrl);
  }

  if (parsedUrl.pathname === '/api/spotify-import') {
    const spotifyUrl = parsedUrl.query.url || '';
    return handleSpotifyImport(req, res, spotifyUrl);
  }

  if (parsedUrl.pathname === '/api/apple-import') {
    const appleUrl = parsedUrl.query.url || '';
    return handleAppleImport(req, res, appleUrl);
  }

  if (parsedUrl.pathname === '/api/playlist-import') {
    const playlistUrl = parsedUrl.query.url || '';
    return handlePlaylistImport(req, res, playlistUrl);
  }

  if (parsedUrl.pathname === '/api/albums/search') {
    return handleAlbumSearch(req, res, parsedUrl);
  }

  if (parsedUrl.pathname === '/api/albums/tracks') {
    return handleAlbumTracks(req, res, parsedUrl);
  }

  if (parsedUrl.pathname === '/api/hot') {
    return handleHotPicks(req, res, parsedUrl);
  }

  if (parsedUrl.pathname === '/api/spotify-auth-start') {
    const clientId = parsedUrl.query.clientId || '';
    if (!/^[a-f0-9]{32}$/i.test(clientId)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: 'Invalid Client ID' }));
    }
    const verifier = crypto.randomBytes(48).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    const state = crypto.randomBytes(16).toString('hex');
    spotifyAuth = { verifier, state, clientId, token: '' };
    spotifyAuthError = '';
    const redirectUri = getSpotifyRedirectUri();
    const authUrl = `https://accounts.spotify.com/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&scope=${encodeURIComponent(SPOTIFY_SCOPES)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}&code_challenge_method=S256&code_challenge=${encodeURIComponent(challenge)}`;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, url: authUrl, redirectUri }));
  }

  if (parsedUrl.pathname === '/api/spotify-callback') {
    const code = parsedUrl.query.code;
    const state = parsedUrl.query.state;
    const errParam = parsedUrl.query.error;
    if (!spotifyAuth.state || !state || state !== spotifyAuth.state) {
      res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end('<!DOCTYPE html><html><body><p>Invalid Spotify login session.</p></body></html>');
    }
    if (errParam || !code) {
      spotifyAuthError = errParam === 'access_denied' ? 'Spotify authorization was denied.' : 'Spotify login failed. Check the Client ID, allowed account and redirect URI.';
      spotifyAuth.state = '';
      res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end('<!DOCTYPE html><html><body><p>Spotify login failed. Return to Riff for details.</p></body></html>');
    }
    const redirectUri = getSpotifyRedirectUri();
    try {
      const tokenResult = await exchangeSpotifyCode(code, spotifyAuth.verifier, spotifyAuth.clientId, redirectUri);
      spotifyAuth.state = '';
      if (tokenResult.status >= 200 && tokenResult.status < 300 && tokenResult.data && tokenResult.data.access_token) {
        spotifyAuth.token = tokenResult.data.access_token;
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end('<!DOCTYPE html><html><body><p>Riff is connected to Spotify. You can close this tab.</p></body></html>');
      } else {
        const reason = tokenResult.data?.error_description || tokenResult.data?.error || `HTTP ${tokenResult.status}`;
        spotifyAuthError = `Spotify token exchange failed: ${reason}`;
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end('<!DOCTYPE html><html><body><p>Spotify login failed. Return to Riff for details.</p></body></html>');
      }
    } catch (err) {
      spotifyAuth.state = '';
      spotifyAuthError = `Could not reach Spotify: ${err.message}`;
      res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end('<!DOCTYPE html><html><body><p>Spotify login failed. Return to Riff for details.</p></body></html>');
    }
  }

  if (parsedUrl.pathname === '/api/spotify-status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ connected: Boolean(spotifyAuth.token), error: spotifyAuthError }));
  }

  if (parsedUrl.pathname === '/api/spotify-logout') {
    spotifyAuth.token = '';
    spotifyAuthError = '';
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true }));
  }

  if (parsedUrl.pathname === '/api/spotify-library') {
    return handleSpotifyLibrary(req, res, parsedUrl.query);
  }

  if (parsedUrl.pathname === '/api/search') {
    const q = parsedUrl.query.q || '';
    const platform = parsedUrl.query.platform || 'youtube';
    const limit = parseInt(parsedUrl.query.limit || '20', 10);
    return handleSearch(req, res, q, platform, limit);
  }

  if (parsedUrl.pathname === '/api/vibe' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { if (res.writableEnded) return; body += chunk; if (body.length > MAX_BODY_BYTES) { body = ''; req.removeAllListeners('data'); req.removeAllListeners('end'); res.writeHead(413, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false, error: 'payload too large' })); req.resume(); } });
    req.on('end', () => {
      const payload = safeJsonParse(body, {});
      handleVibeRecommendations(req, res, payload);
    });
    return;
  }

  if (parsedUrl.pathname === '/api/artist') {
    const name = parsedUrl.query.name || '';
    if (!name) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: 'Missing artist name' }));
    }
    const info = await fetchArtistInfo(name);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, artist: info }));
  }

  if (parsedUrl.pathname === '/api/prefetch') {
    const trackUrl = parsedUrl.query.url || '';
    const trackId = parsedUrl.query.id || '';
    const platform = parsedUrl.query.platform || 'youtube';
    prefetchTrack(trackUrl, trackId, platform);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true }));
  }

  if (parsedUrl.pathname === '/api/check-cache') {
    const trackId = parsedUrl.query.id || '';
    const cleanId = cleanTrackId(trackId);
    const cachedFile = await findCachedFile(cleanId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ 
      cached: !!cachedFile, 
      streamUrl: cachedFile ? `http://127.0.0.1:${PORT}/api/local-track?id=${encodeURIComponent(cleanId)}` : null 
    }));
  }

  if (parsedUrl.pathname === '/api/tools-status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(require('./tools').toolsStatus()));
  }

  if (parsedUrl.pathname === '/api/tools-install') {
    require('./tools').ensureTools().catch(() => {});
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ started: true }));
  }

  if (parsedUrl.pathname === '/api/stream-info') {
    const trackUrl = parsedUrl.query.url || '';
    const trackId = parsedUrl.query.id || '';
    const platform = parsedUrl.query.platform || 'youtube';
    const title = parsedUrl.query.title || '';
    const artist = parsedUrl.query.artist || '';
    const duration = parsedUrl.query.duration || 0;
    const thumbnail = parsedUrl.query.thumbnail || '';
    return handleStreamInfo(req, res, trackUrl, trackId, platform, title, artist, duration, thumbnail);
  }

  if (parsedUrl.pathname === '/api/local-track') {
    const trackId = parsedUrl.query.id || '';
    return handleLocalTrack(req, res, trackId);
  }

  if (parsedUrl.pathname === '/api/downloaded-track') {
    const name = parsedUrl.query.name || '';
    return handleDownloadedTrack(req, res, name);
  }

  if (parsedUrl.pathname === '/api/library-add' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { if (res.writableEnded) return; body += chunk; if (body.length > MAX_BODY_BYTES) { body = ''; req.removeAllListeners('data'); req.removeAllListeners('end'); res.writeHead(413, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false, error: 'payload too large' })); req.resume(); } });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const items = Array.isArray(payload.items) ? payload.items : [];
        const fileRegex = /^local_[a-f0-9]{12}\.[a-z0-9]+$/;
        let addedCount = 0;
        for (const item of items) {
          if (!item || !item.id || !item.file) continue;
          if (!fileRegex.test(item.file)) continue;
          const fullPath = path.join(LIBRARY_DIR, item.file);
          if (!fs.existsSync(fullPath)) continue;

          let rawName = (item.name || '').trim();
          let cleanName = rawName.replace(/^\d+(?:[.\s-]+)\s*/, '').trim() || rawName || 'Untitled';

          const dashIdx = cleanName.indexOf(' - ');
          let artist = 'Unknown artist';
          let title = cleanName;
          if (dashIdx !== -1) {
            artist = cleanName.slice(0, dashIdx).trim() || 'Unknown artist';
            title = cleanName.slice(dashIdx + 3).trim() || cleanName;
          }

          libraryIndex[item.id] = {
            id: item.id,
            file: item.file,
            ext: item.ext || path.extname(item.file).slice(1).toLowerCase(),
            title: title,
            artist: artist,
            duration: 0,
            addedAt: Date.now()
          };
          addedCount++;
        }
        saveLibraryIndex();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, count: addedCount }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  if (parsedUrl.pathname === '/api/library-update' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { if (res.writableEnded) return; body += chunk; if (body.length > MAX_BODY_BYTES) { body = ''; req.removeAllListeners('data'); req.removeAllListeners('end'); res.writeHead(413, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false, error: 'payload too large' })); req.resume(); } });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const { id, duration } = payload;
        if (id && libraryIndex[id] && typeof duration === 'number' && !isNaN(duration)) {
          libraryIndex[id].duration = duration;
          saveLibraryIndex();
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  if (parsedUrl.pathname === '/api/library') {
    const list = Object.values(libraryIndex)
      .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0))
      .map(item => ({
        id: item.id,
        platform: 'local',
        title: item.title,
        artist: item.artist,
        duration: Number(item.duration) || 0,
        thumbnail: ''
      }));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(list));
  }

  if (parsedUrl.pathname === '/api/library-file') {
    const trackId = parsedUrl.query.id || '';
    return handleLibraryFile(req, res, trackId);
  }

  if (parsedUrl.pathname === '/api/library-remove' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { if (res.writableEnded) return; body += chunk; if (body.length > MAX_BODY_BYTES) { body = ''; req.removeAllListeners('data'); req.removeAllListeners('end'); res.writeHead(413, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false, error: 'payload too large' })); req.resume(); } });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const id = payload.id || parsedUrl.query.id || '';
        if (id && libraryIndex[id]) {
          const item = libraryIndex[id];
          if (item.file) {
            const fullPath = path.join(LIBRARY_DIR, item.file);
            try {
              if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
            } catch (e) {}
          }
          delete libraryIndex[id];
          saveLibraryIndex();
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  if (parsedUrl.pathname === '/api/local-thumbnail') {
    const trackId = parsedUrl.query.id || '';
    const cleanId = cleanTrackId(trackId);
    const thumbPath = path.join(THUMBNAILS_DIR, `${cleanId}.jpg`);
    if (fs.existsSync(thumbPath)) {
      res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=31536000' });
      return streamFileToResponse(fs.createReadStream(thumbPath), res);
    }
    res.writeHead(404);
    return res.end('Thumbnail not cached');
  }

  if (parsedUrl.pathname === '/api/offline-library') {
    const tracks = [];
    let totalBytes = 0;
    try {
      const files = await fs.promises.readdir(CACHE_DIR);
      const audioExtRegex = /\.(opus|webm|m4a|mp3)$/i;
      for (const file of files) {
        if (audioExtRegex.test(file) && !file.includes('.temp.')) {
          const cleanId = file.replace(audioExtRegex, '');
          const stat = await fs.promises.stat(path.join(CACHE_DIR, file));
          totalBytes += stat.size;
          const meta = trackMetadataIndex[cleanId] || {};
          tracks.push({
            id: meta.id || cleanId,
            cleanId: cleanId,
            title: meta.title || cleanId,
            artist: meta.artist || 'Unknown artist',
            duration: meta.duration || 0,
            thumbnail: meta.thumbnail || '',
            localThumbnail: fs.existsSync(path.join(THUMBNAILS_DIR, `${cleanId}.jpg`)) ? `http://127.0.0.1:${PORT}/api/local-thumbnail?id=${cleanId}` : (meta.thumbnail || ''),
            platform: meta.platform || 'youtube',
            fileSize: stat.size,
            lastPlayed: meta.lastPlayed || stat.mtimeMs,
            analysis: meta.analysis || null
          });
        }
      }
    } catch (e) {}
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, count: tracks.length, totalBytes, tracks }));
  }

  if (parsedUrl.pathname === '/api/track-analysis') {
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { if (res.writableEnded) return; body += chunk; if (body.length > MAX_BODY_BYTES) { body = ''; req.removeAllListeners('data'); req.removeAllListeners('end'); res.writeHead(413, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false, error: 'payload too large' })); req.resume(); } });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          const cleanId = cleanTrackId(payload.id || '');
          if (cleanId && payload.analysis) {
            saveTrackMetadata(cleanId, { analysis: payload.analysis });
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }
    const cleanId = cleanTrackId(parsedUrl.query.id || '');
    const meta = trackMetadataIndex[cleanId] || {};
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, analysis: meta.analysis || null }));
  }

  if (parsedUrl.pathname === '/api/offline-delete' && req.method === 'POST') {
    const trackId = parsedUrl.query.id || '';
    const cleanId = cleanTrackId(trackId);
    const audioPath = await findCachedFile(cleanId);
    const thumbPath = path.join(THUMBNAILS_DIR, `${cleanId}.jpg`);
    try { if (audioPath && fs.existsSync(audioPath)) await fs.promises.unlink(audioPath); } catch (e) {}
    try { if (fs.existsSync(thumbPath)) await fs.promises.unlink(thumbPath); } catch (e) {}
    delete trackMetadataIndex[cleanId];
    try { fs.writeFileSync(METADATA_PATH, JSON.stringify(trackMetadataIndex, null, 2), 'utf-8'); } catch (e) {}
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true }));
  }

  if (parsedUrl.pathname === '/api/clear-offline-library' && req.method === 'POST') {
    try {
      const files = await fs.promises.readdir(CACHE_DIR);
      const audioExtRegex = /\.(opus|webm|m4a|mp3)$/i;
      for (const file of files) {
        if (audioExtRegex.test(file)) {
          try { await fs.promises.unlink(path.join(CACHE_DIR, file)); } catch (e) {}
        }
      }
      const thumbFiles = await fs.promises.readdir(THUMBNAILS_DIR);
      for (const file of thumbFiles) {
        try { await fs.promises.unlink(path.join(THUMBNAILS_DIR, file)); } catch (e) {}
      }
      trackMetadataIndex = {};
      try { fs.writeFileSync(METADATA_PATH, '{}', 'utf-8'); } catch (e) {}
    } catch (e) {}
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true }));
  }

  if (parsedUrl.pathname === '/api/audio-proxy') {
    const targetUrl = parsedUrl.query.url || '';
    return handleAudioProxy(req, res, targetUrl);
  }

  if (parsedUrl.pathname === '/api/save-custom-lyrics' && req.method === 'POST') {
    const title = parsedUrl.query.title || '';
    const artist = parsedUrl.query.artist || '';
    return handleSaveCustomLyrics(req, res, title, artist);
  }

  if (parsedUrl.pathname === '/api/lyrics') {
    const title = parsedUrl.query.title || '';
    const artist = parsedUrl.query.artist || '';
    const allowOnline = parsedUrl.query.online !== '0';
    return handleLyrics(req, res, title, artist, allowOnline);
  }

  res.writeHead(404);
  res.end('Not found');
});

function startServer(port = PORT) {
  if (server.listening) {
    const address = server.address();
    return Promise.resolve(address && typeof address === 'object' ? address.port : port);
  }
  return new Promise((resolve, reject) => {
    server.listen(port, '127.0.0.1', () => {
      const address = server.address();
      const bound = address && typeof address === 'object' ? address.port : port;
      console.log(`devsize internal server running on http://127.0.0.1:${bound}`);
      require('./tools').updateYtDlpIfManaged().catch(() => {});
      resolve(bound);
    }).on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        server.listen(0, '127.0.0.1', () => {
          const p = server.address().port;
          console.log(`devsize internal server running on fallback port http://127.0.0.1:${p}`);
          require('./tools').updateYtDlpIfManaged().catch(() => {});
          resolve(p);
        });
      } else {
        reject(err);
      }
    });
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (!server.listening) return resolve();
    server.close(() => resolve());
    if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
  });
}

module.exports = { startServer, stopServer, PORT, getServerToken };

if (require.main === module) {
  startServer();
}
