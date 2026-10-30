'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  hasYouTubeLoginCookies,
  youtubeAudioAttempts,
  YOUTUBE_AUDIO_CLIENTS
} = require('../src/shared/youtube-playback');
const { resolveVerifiedYoutubeAudio } = require('../src/server/server');

const header = '# Netscape HTTP Cookie File\n';
const cookie = (name, domain = '.youtube.com') =>
  `${domain}\tTRUE\t/\tTRUE\t2147483647\t${name}\texample\n`;

test('rejects invalid or incomplete YouTube cookie files', () => {
  assert.equal(hasYouTubeLoginCookies(''), false);
  assert.equal(hasYouTubeLoginCookies('anything'), false);
  assert.equal(hasYouTubeLoginCookies(header + cookie('__Secure-3PAPISID')), false);
  assert.equal(hasYouTubeLoginCookies(header + cookie('SAPISID', '.google.com')), false);
  assert.equal(hasYouTubeLoginCookies(header + cookie('SAPISID')), false);
  assert.equal(hasYouTubeLoginCookies(header + cookie('LOGIN_INFO') + 'broken-row'), false);
});

test('recognizes a real YouTube login and Netscape HttpOnly cookie rows', () => {
  assert.equal(hasYouTubeLoginCookies(header + cookie('LOGIN_INFO')), true);
  assert.equal(hasYouTubeLoginCookies(header + cookie('SAPISID') + cookie('SID')), true);
  assert.equal(hasYouTubeLoginCookies(header + '#HttpOnly_' + cookie('LOGIN_INFO')), true);
});

test('tries Android without cookies before authenticated or less reliable clients', () => {
  assert.deepEqual(YOUTUBE_AUDIO_CLIENTS, ['android', 'android_vr', 'default']);
  assert.deepEqual(youtubeAudioAttempts(false), [
    { client: 'android', useCookies: false },
    { client: 'android_vr', useCookies: false },
    { client: 'default', useCookies: false }
  ]);
  assert.deepEqual(youtubeAudioAttempts(true).slice(0, 2), youtubeAudioAttempts(false).slice(0, 2));
  assert.equal(youtubeAudioAttempts(true).at(-1).useCookies, true);
});

test('only accepts an extracted stream after successful audio verification', async () => {
  const calls = [];
  const run = async (args, limit, options) => {
    calls.push({ args, limit, options });
    return 'https://googlevideo.example.invalid/forbidden\nhttps://googlevideo.example.invalid/allowed\n';
  };
  const verify = async url => url.endsWith('/allowed');
  const url = await resolveVerifiedYoutubeAudio('AbCdEfGhI12', 'bestaudio', 'android', run, verify);
  assert.equal(url, 'https://googlevideo.example.invalid/allowed');
  assert.ok(calls[0].args.includes('youtube:player_client=android'));
  assert.ok(calls[0].args.includes('https://www.youtube.com/watch?v=AbCdEfGhI12'));
  assert.equal(calls[0].options.noCookies, true);
});

test('a failed verification never returns a URL for prefetch caching', async () => {
  const run = async () => 'https://googlevideo.example.invalid/forbidden\n';
  const result = await resolveVerifiedYoutubeAudio('AbCdEfGhI12', 'bestaudio', 'android', run, async () => false);
  assert.equal(result, null);
});

test('authenticated attempt forwards the cookie-allowed option', async () => {
  let opts;
  await resolveVerifiedYoutubeAudio('AbCdEfGhI12', 'bestaudio', 'default',
    async (args, timeout, options) => { opts = options; return ''; },
    async () => true, true);
  assert.equal(opts.noCookies, false);
});
