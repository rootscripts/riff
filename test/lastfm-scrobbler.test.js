const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHash } = require('node:crypto');

test('counts only listened time, survives pauses and seeks, and scrobbles a replay once', async () => {
  const callbacks = {};
  const listeners = {};
  const panelListeners = {};
  const mainListeners = {};
  const navListeners = {};
  const saved = { value: { account: { apiKey: 'a'.repeat(32), secret: 'b'.repeat(32), session: 'session', name: 'tester' } } };
  const sent = [];
  let now = 0;
  let id = 0;
  let intervalFn;
  let renders = 0;
  const audio = {
    currentTime: 0, duration: 70, playbackRate: 1, paused: true, seeking: false, readyState: 4,
    addEventListener(name, fn) { (listeners[name] ||= []).push(fn); },
    removeEventListener(name, fn) { listeners[name] = listeners[name].filter((item) => item !== fn); }
  };
  const element = (events = {}) => {
    const classes = new Set();
    return { dataset: {}, style: {}, parentElement: { getBoundingClientRect: () => ({ top: 0 }) },
      classList: { add: (name) => classes.add(name), remove: (name) => classes.delete(name), contains: (name) => classes.has(name) },
      setAttribute() {}, addEventListener(name, fn) { events[name] = fn; }, appendChild() {}, before() {}, after() {}, remove() {},
      getBoundingClientRect: () => ({ top: 0, height: 48 }), contains: () => true,
      get innerHTML() { return this.html; }, set innerHTML(value) { this.html = value; }
    };
  };
  const nav = element(navListeners);
  const view = element();
  const mainPanel = element(mainListeners);
  const panel = element(panelListeners);
  Object.defineProperty(panel, 'innerHTML', { get() { return this.html; }, set(value) { this.html = value; renders++; } });
  const builtInView = element();
  const builtInNav = element();
  builtInView.classList.add('active'); builtInNav.classList.add('active');
  let sectionIndex = 0;
  let viewObserver;
  const track = { title: 'Song', artist: 'Artist', duration: 70, platform: 'local' };
  const Riff = {
    audio: () => audio, getTrack: () => track, query: (selector) => selector.includes('.content-view.active:not(') ? (builtInView.classList.contains('active') ? builtInView : null) : element(), addStyle: () => () => {}, toast() {},
    storage: { get: () => saved.value, set: (_, value) => { saved.value = value; } },
    on: (name, fn) => { callbacks[name] = fn; return () => {}; }
  };
  const fetch = async (url, options) => {
    sent.push({ kind: new URLSearchParams(options.body).get('method'), body: String(options.body) });
    return { ok: true, json: async () => ({ scrobbles: { scrobble: { ignoredMessage: { code: '0' } } } }) };
  };
  const source = fs.readFileSync(path.join(__dirname, '..', 'plugins', 'lastfm-scrobbler.js'), 'utf8');
  const context = {
    window: { open() {} }, document: {
      activeElement: null,
      createElement: (tag) => tag === 'button' ? nav : [view, mainPanel, panel][sectionIndex++ % 3],
      querySelectorAll: (selector) => selector === '#main-content > .content-view.active' ? [builtInView] : selector === '.sidebar-nav .nav-item.active' ? [builtInNav] : [builtInView]
    },
    MutationObserver: class { constructor(callback) { viewObserver = callback; } observe() {} disconnect() {} },
    crypto: { randomUUID: () => String(++id) },
    performance: { now: () => now }, Date, TextEncoder, URLSearchParams, AbortSignal, fetch, setInterval: (fn) => { intervalFn = fn; return 1; }, clearInterval() {}
  };
  const run = vm.runInNewContext(`(function(Riff) { ${source.replace('const api = {', 'globalThis.testMd5 = md5; const api = {')}\n})`, context);
  const loaded = run(Riff);
  assert.match(mainPanel.innerHTML, /data-tab="overview"/);
  assert.doesNotMatch(mainPanel.innerHTML, /data-tab="settings"/);
  assert.doesNotMatch(panel.innerHTML, /data-tab="overview"/);
  assert.equal(context.testMd5('abc'), '900150983cd24fb0d6963f7d28e17f72');
  assert.equal(context.testMd5('Música – Marías'), createHash('md5').update('Música – Marías').digest('hex'));
  await new Promise(setImmediate);
  const emit = (name) => { for (const fn of listeners[name] || []) fn(); };
  const listen = (seconds) => {
    for (let i = 0; i < seconds; i++) { now += 1000; audio.currentTime++; intervalFn(); }
  };
  callbacks.trackchange(track);
  audio.paused = false; emit('playing');
  listen(20);
  audio.paused = true; emit('pause');
  now += 100000;
  audio.currentTime = 50; emit('seeked');
  assert.equal(saved.value.records.length, 0);
  audio.paused = false; emit('playing');
  listen(15);
  await new Promise(setImmediate);
  assert.equal(saved.value.records.length, 1);
  assert.equal(saved.value.records[0].heard, 35);
  callbacks.trackchange(track);
  audio.currentTime = 0; emit('seeked'); emit('playing');
  listen(35);
  await new Promise(setImmediate);
  assert.equal(saved.value.records.length, 2);
  assert.notEqual(saved.value.records[0].id, saved.value.records[1].id);
  assert.equal(sent.filter((item) => item.kind === 'track.scrobble').length, 2);
  navListeners.click();
  assert.equal(view.classList.contains('active'), true);
  assert.equal(nav.classList.contains('active'), true);
  builtInView.classList.add('active'); viewObserver();
  assert.equal(view.classList.contains('active'), false);
  assert.equal(nav.classList.contains('active'), false);
  const selectTab = (tab) => mainListeners.click({ target: { closest: () => ({ dataset: { tab } }) } });
  assert.doesNotMatch(panel.innerHTML, /id="lf-key"/);
  panelListeners.click({ target: { closest: () => ({ dataset: { action: 'edit-credentials' } }) } });
  panelListeners.input({ target: { id: 'lf-key', value: 'typed-key' } });
  panelListeners.input({ target: { id: 'lf-secret', value: 'typed-secret' } });
  context.document.activeElement = { tagName: 'INPUT' };
  const beforeTick = renders;
  listen(1);
  assert.equal(renders, beforeTick);
  context.document.activeElement = null;
  selectTab('history'); selectTab('overview');
  assert.match(panel.innerHTML, /value="typed-key"/);
  assert.match(panel.innerHTML, /value="typed-secret"/);
  panelListeners.click({ target: { closest: () => ({ dataset: { action: 'save-credentials' } }) } });
  await new Promise(setImmediate);
  assert.match(panel.innerHTML, /value="typed-key"/);
  assert.match(panel.innerHTML, /value="typed-secret"/);
  assert.match(panel.innerHTML, /API key inválida: 9\/32 caracteres/);
  assert.ok(panel.innerHTML.indexOf('API key inválida') < panel.innerHTML.indexOf('id="lf-key"'));
  panelListeners.input({ target: { id: 'lf-key', value: 'c'.repeat(32) } });
  panelListeners.input({ target: { id: 'lf-secret', value: 'd'.repeat(32) } });
  panelListeners.click({ target: { closest: () => ({ dataset: { action: 'save-credentials' } }) } });
  await new Promise(setImmediate);
  assert.equal(saved.value.account.apiKey, 'c'.repeat(32));
  assert.equal(saved.value.account.secret, 'd'.repeat(32));
  assert.match(panel.innerHTML, /Credenciais salvas/);
  assert.doesNotMatch(panel.innerHTML, /id="lf-key"/);
  assert.match(panel.innerHTML, /Alterar API key e shared secret/);
  panelListeners.click({ target: { closest: () => ({ dataset: { action: 'edit-credentials' } }) } });
  assert.match(panel.innerHTML, /id="lf-key"/);
  loaded.stop();
  run(Riff);
  await new Promise(setImmediate);
  assert.match(panel.innerHTML, /Credenciais salvas/);
  assert.doesNotMatch(panel.innerHTML, /id="lf-key"/);
  panelListeners.click({ target: { closest: () => ({ dataset: { action: 'edit-credentials' } }) } });
  panel.querySelector = (selector) => ({ value: selector === '#lf-key' ? 'e'.repeat(32) : 'f'.repeat(32) });
  panelListeners.click({ target: { closest: () => ({ dataset: { action: 'save-credentials' } }) } });
  await new Promise(setImmediate);
  assert.equal(saved.value.account.apiKey, 'e'.repeat(32));
  assert.equal(saved.value.account.secret, 'f'.repeat(32));
});
