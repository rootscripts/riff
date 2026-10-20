'use strict';

const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const https = require('node:https');
const { PassThrough } = require('node:stream');

const { startServer, stopServer, getServerToken } = require('../server');

function request(port, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path, headers }, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve({ statusCode: res.statusCode, body }));
    });
    req.on('error', reject);
  });
}

test('startServer resolves the real bound port (regression)', async () => {
  const port = await startServer(0);
  try {
    assert.ok(Number.isInteger(port) && port > 0, `expected a real port, got ${port}`);
    assert.ok(port <= 65535);
  } finally {
    await stopServer();
  }
});

test('server responds and rejects untrusted routes', async () => {
  const port = await startServer(0);
  try {
    const missing = await request(port, '/');
    assert.strictEqual(missing.statusCode, 404);

    const guarded = await request(port, '/api/tools-status');
    assert.strictEqual(guarded.statusCode, 403, 'token-protected route must reject requests without a token');

    const authorized = await request(port, '/api/tools-status', { 'x-riff-token': getServerToken() });
    assert.strictEqual(authorized.statusCode, 200);
    assert.doesNotThrow(() => JSON.parse(authorized.body));
  } finally {
    await stopServer();
  }
});

test('requests with a foreign Origin are rejected', async () => {
  const port = await startServer(0);
  try {
    const res = await request(port, '/', { origin: 'https://evil.example.com' });
    assert.strictEqual(res.statusCode, 403);
  } finally {
    await stopServer();
  }
});

test('Spotify login reports callback errors and protects account routes', async () => {
  const port = await startServer(0);
  try {
    for (const route of ['/api/spotify-auth-start?clientId=' + 'a'.repeat(32), '/api/spotify-status', '/api/spotify-library?likes=1', '/api/spotify-logout']) {
      const denied = await request(port, route);
      assert.strictEqual(denied.statusCode, 403, route);
    }
    const headers = { 'x-riff-token': getServerToken() };
    const start = await request(port, '/api/spotify-auth-start?clientId=' + 'a'.repeat(32), headers);
    const auth = JSON.parse(start.body);
    assert.strictEqual(start.statusCode, 200);
    assert.strictEqual(new URL(auth.url).searchParams.get('redirect_uri'), auth.redirectUri);
    const state = new URL(auth.url).searchParams.get('state');
    const callback = await request(port, `/api/spotify-callback?state=${state}&error=access_denied`);
    assert.strictEqual(callback.statusCode, 400);
    const status = JSON.parse((await request(port, '/api/spotify-status', headers)).body);
    assert.strictEqual(status.connected, false);
    assert.match(status.error, /denied/i);
  } finally {
    await stopServer();
  }
});

test('Spotify import skips followed playlists whose items return 403', async () => {
  const originalRequest = https.request;
  const originalGet = https.get;
  const reply = (callback, statusCode, data) => {
    const response = new PassThrough();
    response.statusCode = statusCode;
    response.headers = {};
    process.nextTick(() => {
      callback(response);
      response.end(JSON.stringify(data));
    });
    return { on() { return this; }, write() {}, end() {}, destroy() {} };
  };
  https.request = (_url, _options, callback) => reply(callback, 200, { access_token: 'mock-token' });
  https.get = (url, _options, callback) => {
    const pathname = new URL(url).pathname;
    if (pathname === '/v1/me/tracks') return reply(callback, 200, { items: [{ track: { name: 'Saved', artists: [{ name: 'Artist' }] } }], next: null });
    if (pathname === '/v1/me/playlists') return reply(callback, 200, { items: [{ id: 'followed', name: 'Followed' }, { id: 'owned', name: 'Owned' }], next: null });
    if (pathname === '/v1/playlists/followed/items') return reply(callback, 403, { error: { message: 'Forbidden' } });
    if (pathname === '/v1/playlists/owned/items') return reply(callback, 200, { items: [{ item: { name: 'Track', artists: [{ name: 'Artist' }] } }], next: null });
    throw new Error(`Unexpected Spotify request: ${pathname}`);
  };
  try {
    const port = await startServer(0);
    try {
      const headers = { 'x-riff-token': getServerToken() };
      const auth = JSON.parse((await request(port, '/api/spotify-auth-start?clientId=' + 'a'.repeat(32), headers)).body);
      const state = new URL(auth.url).searchParams.get('state');
      assert.strictEqual((await request(port, `/api/spotify-callback?state=${state}&code=mock`)).statusCode, 200);
      const response = await request(port, '/api/spotify-library?likes=1&playlists=1', headers);
      assert.strictEqual(response.statusCode, 200);
      const data = JSON.parse(response.body);
      assert.deepStrictEqual(data.skippedPlaylists, ['Followed']);
      assert.strictEqual(data.likes[0].title, 'Saved');
      assert.strictEqual(data.playlists[0].name, 'Owned');
      assert.strictEqual(data.playlists[0].tracks[0].title, 'Track');
    } finally {
      await stopServer();
    }
  } finally {
    https.request = originalRequest;
    https.get = originalGet;
  }
});
