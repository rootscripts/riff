'use strict';

const YOUTUBE_AUDIO_CLIENTS = Object.freeze(['android', 'android_vr', 'default']);

function hasYouTubeLoginCookies(text) {
  const lines = String(text || '').split(/\r?\n/);
  if (!/^#\s*(?:Netscape\s+)?HTTP\s+Cookie\s+File/i.test(lines[0] || '')) return false;

  const names = new Set();
  for (const raw of lines.slice(1)) {
    const line = raw.startsWith('#HttpOnly_') ? raw.slice('#HttpOnly_'.length) : raw;
    if (!line.trim() || line.startsWith('#')) continue;
    const fields = line.split('\t');
    if (fields.length !== 7) return false;
    const domain = fields[0].toLowerCase().replace(/^\./, '');
    if (domain === 'youtube.com' || domain.endsWith('.youtube.com')) names.add(fields[5]);
  }
  return names.has('LOGIN_INFO') || (names.has('SAPISID') && names.has('SID'));
}

function youtubeAudioAttempts(hasLoginCookies) {
  const attempts = [
    { client: 'android', useCookies: false },
    { client: 'android_vr', useCookies: false }
  ];
  if (hasLoginCookies) {
    attempts.push({ client: 'android', useCookies: true });
    attempts.push({ client: 'default', useCookies: true });
  } else {
    attempts.push({ client: 'default', useCookies: false });
  }
  return attempts;
}

module.exports = { YOUTUBE_AUDIO_CLIENTS, hasYouTubeLoginCookies, youtubeAudioAttempts };
