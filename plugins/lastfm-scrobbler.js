/**
 * @name Last.fm Scrobbler
 * @author Riff
 * @version 1.1.0
 * @description Scrobble your Riff listening to Last.fm.
 */
const audio = Riff.audio();
const KEY = 'lastfm_scrobbler_v1';
const defaults = { scrobble: true, nowPlaying: true, offline: true, notifications: false, history: true, youtube: true, soundcloud: true, local: true };
let data;
try { data = Riff.storage.get(KEY, null) || {}; } catch { data = {}; }
data.settings = { ...defaults, ...data.settings };
data.records = Array.isArray(data.records) ? data.records : [];
// ponytail: Riff plugins only expose localStorage; credentials stay on this device but are not OS-encrypted. Use a Riff secure-storage API if one becomes available.
data.account ||= {};
let authToken = '';
let status = { configured: false, connected: false, name: '', secure: false };
let current = null;
let tab = 'overview';
let busy = false;
let nextSync = 0;
let stopped = false;
let message = '';
let editingCredentials = false;
const credentialDraft = { key: '', secret: '' };

function save() {
  data.records = data.records.filter((r) => r.status === 'pending' || r.status === 'uncertain' || data.settings.history);
  Riff.storage.set(KEY, data);
}
// Last.fm requires MD5 API signatures; Web Crypto intentionally does not provide MD5.
function md5(input) {
  const bytes = Array.from(new TextEncoder().encode(input));
  const bitLength = bytes.length * 8;
  bytes.push(128);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let i = 0; i < 8; i++) bytes.push(Math.floor(bitLength / 2 ** (8 * i)) & 255);
  const shifts = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
  const constants = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0);
  const state = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476];
  for (let offset = 0; offset < bytes.length; offset += 64) {
    const words = Array.from({ length: 16 }, (_, i) => (bytes[offset + 4 * i] | bytes[offset + 4 * i + 1] << 8 | bytes[offset + 4 * i + 2] << 16 | bytes[offset + 4 * i + 3] << 24) >>> 0);
    let [a, b, c, d] = state;
    for (let i = 0; i < 64; i++) {
      let f, g;
      if (i < 16) { f = (b & c) | (~b & d); g = i; }
      else if (i < 32) { f = (d & b) | (~d & c); g = (5 * i + 1) % 16; }
      else if (i < 48) { f = b ^ c ^ d; g = (3 * i + 5) % 16; }
      else { f = c ^ (b | ~d); g = (7 * i) % 16; }
      const value = (a + f + constants[i] + words[g]) >>> 0;
      const shift = shifts[Math.floor(i / 16) * 4 + i % 4];
      [a, b, c, d] = [d, (b + ((value << shift) | (value >>> (32 - shift)))) >>> 0, b, c];
    }
    state[0] = (state[0] + a) >>> 0; state[1] = (state[1] + b) >>> 0;
    state[2] = (state[2] + c) >>> 0; state[3] = (state[3] + d) >>> 0;
  }
  return state.map((word) => Array.from({ length: 4 }, (_, i) => ((word >>> (i * 8)) & 255).toString(16).padStart(2, '0')).join('')).join('');
}
async function call(method, values = {}, authenticated = false) {
  const { apiKey, secret, session } = data.account;
  if (!apiKey || !secret || (authenticated && !session)) throw new Error('Last.fm não conectado');
  const params = { ...values, method, api_key: apiKey };
  if (authenticated) params.sk = session;
  params.api_sig = md5(Object.keys(params).sort().map((key) => key + params[key]).join('') + secret);
  params.format = 'json';
  const response = await fetch('https://ws.audioscrobbler.com/2.0/', { method: 'POST', body: new URLSearchParams(params), signal: AbortSignal.timeout(15000) });
  const result = await response.json();
  if (result.error || !response.ok) { const error = new Error(result.message || `Last.fm HTTP ${response.status}`); error.code = result.error || response.status; throw error; }
  return result;
}
const api = {
  async lastfmStatus() { const a = data.account; return { configured: !!(a.apiKey && a.secret), connected: !!a.session, name: a.name || '', secure: false }; },
  async lastfmConfigure(apiKey, secret) {
    if (!/^[a-f0-9]{32}$/i.test(apiKey)) throw new Error(`API key inválida: ${apiKey.length}/32 caracteres; use apenas 0-9 e a-f.`);
    if (!/^[a-f0-9]{32}$/i.test(secret)) throw new Error(`Shared secret inválido: ${secret.length}/32 caracteres; use apenas 0-9 e a-f.`);
    data.account = { apiKey, secret }; authToken = ''; save();
  },
  async lastfmAuthStart() {
    authToken = (await call('auth.getToken')).token;
    window.open(`https://www.last.fm/api/auth/?api_key=${data.account.apiKey}&token=${authToken}`, '_blank');
  },
  async lastfmAuthComplete() {
    if (!authToken) throw new Error('Inicie a autorização primeiro');
    const result = await call('auth.getSession', { token: authToken });
    data.account.session = result.session.key; data.account.name = result.session.name;
    authToken = ''; save(); return data.account.name;
  },
  async lastfmDisconnect() { data.account = {}; authToken = ''; save(); },
  async lastfmSend(kind, track) {
    const values = { artist: track.artist, track: track.title };
    if (track.album) values.album = track.album;
    if (kind === 'scrobble') values.timestamp = track.timestamp;
    if (track.duration > 0) values.duration = Math.round(track.duration);
    try {
      const result = await call(kind === 'scrobble' ? 'track.scrobble' : 'track.updateNowPlaying', values, true);
      return { ignored: kind === 'scrobble' ? Number(result.scrobbles?.scrobble?.ignoredMessage?.code || 0) : 0 };
    } catch (error) { return { error: error.message, code: error.code || 0 }; }
  },
  async lastfmRecent(timestamp) {
    const params = new URLSearchParams({ method: 'user.getRecentTracks', api_key: data.account.apiKey, user: data.account.name, from: Math.max(0, timestamp - 60), to: timestamp + 60, limit: 50, format: 'json' });
    const response = await fetch(`https://ws.audioscrobbler.com/2.0/?${params}`, { signal: AbortSignal.timeout(15000) });
    const result = await response.json();
    if (result.error || !response.ok) throw new Error(result.message || `Last.fm HTTP ${response.status}`);
    return [].concat(result.recenttracks?.track || []).filter((track) => track.date).map((track) => ({ artist: track.artist?.['#text'] || '', title: track.name || '', timestamp: Number(track.date.uts) }));
  }
};
function source(track) {
  const platform = String(track?.platform || '').toLowerCase();
  return platform === 'local' ? 'local' : platform.includes('soundcloud') ? 'soundcloud' : platform === 'ytmusic' || platform.includes('youtube') ? 'youtube' : '';
}
function details(track) {
  const title = String(track?.title || '').trim();
  const artist = String(track?.artist || '').trim();
  const duration = Number(track?.duration);
  if (!title || !artist || /^unknown (artist|title)$/i.test(artist) || !source(track) || !data.settings[source(track)]) return null;
  return { title, artist, album: String(track.album || '').trim(), duration: Number.isFinite(duration) && duration > 0 ? Math.round(duration) : 0, source: source(track) };
}
function esc(value) { return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
function setting(name, title, hint) { return `<label class="lf-row"><span><strong>${title}</strong><small>${hint}</small></span><input type="checkbox" data-setting="${name}" ${data.settings[name] ? 'checked' : ''}></label>`; }

const removeStyle = Riff.addStyle(`
  #lf-main,#lf-panel{margin:16px 0;padding:20px;border:1px solid var(--md-sys-color-outline-variant,#444);border-radius:24px;background:var(--md-sys-color-surface-container-low,#161616);color:var(--md-sys-color-on-surface,#fff)}
  #lf-main{max-width:900px;margin-top:24px}#lf-main *,#lf-panel *{box-sizing:border-box}#lf-main h3,#lf-panel h3{margin:0;font-size:18px}
  #lf-main small,#lf-panel small,#lf-main .lf-muted,#lf-panel .lf-muted{color:var(--md-sys-color-on-surface-variant,#aaa)}
  #lf-main button,#lf-panel button{cursor:pointer;border:1px solid var(--md-sys-color-outline-variant,#555);border-radius:20px;padding:8px 14px;background:var(--md-sys-color-surface-container-high,#292929);color:inherit;font:inherit}
  #lf-main button:focus-visible,#lf-panel button:focus-visible,#lf-panel input:focus-visible{outline:2px solid var(--md-sys-color-primary,#e44)}
  #lf-main .lf-primary,#lf-panel .lf-primary{background:var(--md-sys-color-primary,#c22);color:var(--md-sys-color-on-primary,#fff);border:0}
  #lf-main .lf-head,#lf-panel .lf-head,#lf-main .lf-row,#lf-panel .lf-row,#lf-main .lf-track,#lf-panel .lf-track,#lf-main .lf-actions,#lf-panel .lf-actions{display:flex;align-items:center;justify-content:space-between;gap:12px}
  #lf-main .lf-head,#lf-panel .lf-head{margin-bottom:18px;flex-wrap:wrap}#lf-main .lf-tabs{display:flex;gap:6px;overflow:auto;margin-bottom:18px}
  #lf-main .lf-tabs button[aria-selected=true]{background:var(--md-sys-color-secondary-container,#553333)}
  #lf-main .lf-row,#lf-panel .lf-row{padding:12px 0;border-bottom:1px solid var(--md-sys-color-outline-variant,#333)}
  #lf-panel .lf-row span{display:grid;gap:4px}#lf-panel .lf-row input{width:20px;height:20px;accent-color:var(--md-sys-color-primary,#e33)}
  #lf-main .lf-track{justify-content:flex-start;margin:16px 0}#lf-main .lf-art{width:64px;height:64px;object-fit:cover;border-radius:16px;background:#333}
  #lf-main .lf-meter{height:6px;border-radius:4px;background:var(--md-sys-color-surface-container-high,#333);overflow:hidden}#lf-main .lf-meter>i{display:block;height:100%;background:var(--md-sys-color-primary,#e33)}
  #lf-main .lf-stats{display:grid;grid-template-columns:repeat(3,1fr);text-align:center;margin-top:22px}#lf-main .lf-stats strong{display:block;font-size:19px}
  #lf-main .lf-actions,#lf-panel .lf-actions{justify-content:flex-start;flex-wrap:wrap;margin:14px 0}
  #lf-panel .lf-form{display:grid;gap:10px;max-width:420px}#lf-panel .lf-form input{width:100%;padding:10px;border:1px solid var(--md-sys-color-outline-variant,#555);border-radius:10px;background:var(--md-sys-color-surface-container-high,#252525);color:inherit}
  #lf-main .lf-list{max-height:420px;overflow:auto}#lf-main .lf-list .lf-row{align-items:flex-start}
`);
const nav = document.createElement('button');
nav.id = 'nav-lastfm';
nav.className = 'nav-item';
nav.type = 'button';
nav.title = 'Last.fm Scrobbler';
nav.setAttribute('aria-label', 'Last.fm Scrobbler');
nav.innerHTML = '<div class="nav-indicator"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M5 12c2-5 4 5 7 0s5-5 7 0"/></svg></div>';
Riff.query('.sidebar-nav .rail-divider')?.before(nav);
const view = document.createElement('section');
view.id = 'view-lastfm';
view.className = 'content-view';
view.innerHTML = '<div class="view-header"><h2>Last.fm Scrobbler</h2></div>';
Riff.query('#main-content')?.appendChild(view);
const mainPanel = document.createElement('section');
mainPanel.id = 'lf-main';
mainPanel.setAttribute('aria-label', 'Painel do Last.fm');
view.appendChild(mainPanel);
const panel = document.createElement('section');
panel.id = 'lf-panel';
panel.setAttribute('aria-label', 'Configurações do Last.fm');
Riff.query('.settings-section[data-cat="plugins"] .ct-head')?.after(panel);
function moveIndicator(button) {
  const indicator = Riff.query('#nav-active-indicator');
  if (indicator && button) {
    const box = button.getBoundingClientRect();
    const parent = button.parentElement.getBoundingClientRect();
    indicator.style.transform = `translateY(${Math.round(box.top - parent.top + (box.height - 48) / 2)}px)`;
    indicator.style.height = '48px';
    indicator.classList.remove('is-hidden');
  }
}
nav.addEventListener('click', () => {
  document.querySelectorAll('#main-content > .content-view.active').forEach((item) => item.classList.remove('active'));
  document.querySelectorAll('.sidebar-nav .nav-item.active').forEach((item) => item.classList.remove('active'));
  view.classList.add('active');
  nav.classList.add('active');
  moveIndicator(nav);
});
const viewObserver = new MutationObserver(() => {
  if (view.classList.contains('active') && Riff.query('#main-content > .content-view.active:not(#view-lastfm)')) {
    view.classList.remove('active');
    nav.classList.remove('active');
    moveIndicator(Riff.query('.sidebar-nav .nav-item.active'));
  }
});
document.querySelectorAll('#main-content > .content-view:not(#view-lastfm)').forEach((item) => viewObserver.observe(item, { attributes: true, attributeFilter: ['class'] }));

function render() {
  if (stopped) return;
  const pending = data.records.filter((r) => r.status === 'pending' || r.status === 'uncertain').length;
  const now = new Date();
  const today = data.records.filter((r) => r.status === 'synced' && new Date(r.timestamp * 1000).toDateString() === now.toDateString()).length;
  const week = data.records.filter((r) => r.status === 'synced' && r.timestamp * 1000 >= Date.now() - 7 * 86400000).length;
  const threshold = current ? Math.min(current.duration / 2, 240) : 0;
  const progress = current && threshold ? Math.min(100, Math.floor(current.heard / threshold * 100)) : 0;
  const credentials = status.configured && !editingCredentials
    ? '<div class="lf-actions"><button data-action="edit-credentials">Alterar API key e shared secret</button></div>'
    : `<div class="lf-form"><label>API key<input id="lf-key" autocomplete="off" maxlength="32" value="${esc(credentialDraft.key)}" placeholder="32 caracteres"></label><label>Shared secret<input id="lf-secret" type="password" autocomplete="off" maxlength="32" value="${esc(credentialDraft.secret)}" placeholder="32 caracteres"></label><button data-action="save-credentials">Salvar credenciais do aplicativo</button><small>Crie uma API account em last.fm/api/account. Se o cadastro exigir Callback URL, use https://www.last.fm/. O plugin para desktop não recebe esse redirecionamento: depois de autorizar, volte ao Riff e clique em “Já autorizei”. As credenciais ficam no armazenamento local do Riff, sem criptografia do sistema.</small></div>`;
  const views = {
    overview: `<div class="lf-muted">${status.connected ? `Conectado como ${esc(status.name)}` : status.configured ? 'Credenciais salvas. Autorize sua conta no navegador.' : 'Configure suas credenciais do Last.fm.'}</div>${status.connected ? '' : `<div class="lf-actions"><button class="lf-primary" data-action="${status.configured ? 'connect' : 'settings'}">${status.configured ? 'Autorizar conta no navegador' : 'Inserir credenciais'}</button></div>`}<div class="lf-track">${current?.thumb ? `<img class="lf-art" src="${esc(current.thumb)}" alt="">` : '<div class="lf-art"></div>'}<div><small>No momento</small><div><strong>${esc(current?.title || 'Nenhuma faixa')}</strong></div><div>${esc(current?.artist || 'Aguardando reprodução')}</div><small>${current?.sent ? 'Scrobble registrado' : current?.playing ? 'Reprodução detectada' : 'Pausado'}</small></div></div><div class="lf-row"><span>Progresso para scrobble</span><strong>${progress}%</strong></div><div class="lf-meter" role="progressbar" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100"><i style="width:${progress}%"></i></div><div class="lf-stats"><div><strong>${today}</strong><small>Hoje</small></div><div><strong>${week}</strong><small>7 dias</small></div><div><strong>${pending}</strong><small>Pendentes</small></div></div>`,
    history: `<div class="lf-list">${data.records.length ? data.records.slice().reverse().map((r) => `<div class="lf-row"><span><strong>${esc(r.title)}</strong><small>${esc(r.artist)} · ${new Date(r.timestamp * 1000).toLocaleString()}</small></span><small>${esc(r.status)}</small></div>`).join('') : '<p class="lf-muted">Nenhuma reprodução registrada pelo plugin.</p>'}</div>`,
    settings: `${credentials}<div class="lf-actions"><button class="lf-primary" data-action="connect" ${!status.configured ? 'disabled' : ''}>${status.connected ? 'Reconectar' : 'Autorizar no navegador'}</button><button data-action="finish">Já autorizei</button><button data-action="disconnect" ${!status.configured ? 'disabled' : ''}>Desconectar e apagar credenciais</button></div>${setting('scrobble','Scrobbling automático','Registrar faixas elegíveis automaticamente')}${setting('nowPlaying','Mostrar Now Playing','Exibir a música atual no Last.fm')}${setting('offline','Sincronização offline','Guardar registros até a conexão retornar')}${setting('notifications','Notificações','Avisar ao registrar uma música')}${setting('history','Histórico local','Conservar reproduções sincronizadas e rejeitadas')}<h4>Fontes de reprodução</h4>${setting('youtube','YouTube / YouTube Music','Usar metadados fornecidos pelo Riff')}${setting('soundcloud','SoundCloud','Usar metadados fornecidos pelo Riff')}${setting('local','Biblioteca local','Usar tags fornecidas pelo Riff')}<div class="lf-actions"><button data-action="clear-history">Apagar histórico local (mantém pendentes)</button><button data-action="clear-all">Apagar todos os dados e desconectar</button></div>`,
    diagnostics: `<div class="lf-row"><span>Conexão</span><strong>${status.connected ? esc(status.name) : 'Desconectado'}</strong></div><div class="lf-row"><span>Armazenamento seguro</span><strong>${status.secure ? 'Disponível' : 'Indisponível'}</strong></div><div class="lf-row"><span>Pendentes</span><strong>${pending}</strong></div><div class="lf-actions"><button data-action="sync">Sincronizar agora</button></div><p class="lf-muted">${esc(message || 'Nenhum erro recente.')}</p>`
  };
  if (message) views[tab] = `<p role="status">${esc(message)}</p>` + views[tab];
  if (authToken && tab === 'overview') views.overview += '<div class="lf-actions"><button data-action="open-auth">Abrir autorização</button><button data-action="finish">Já autorizei</button></div>';
  if (status.configured) views.settings = `<p role="status">${status.connected ? `Conectado como ${esc(status.name)}.` : 'Credenciais salvas. Próximo passo: autorizar no navegador.'}</p>` + views.settings;
  if (authToken) views.settings += '<div class="lf-actions"><button data-action="open-auth">Abrir autorização no navegador</button></div>';
  if (message) views.settings = `<p role="status">${esc(message)}</p>` + views.settings;
  mainPanel.innerHTML = `<div class="lf-head"><div><h3>Suas reproduções</h3><small>v1.1.0 · Scrobbles do Riff no Last.fm</small></div><div class="lf-actions"><strong>${status.connected ? 'Conectado' : status.configured ? 'Aguardando autorização' : 'Sem credenciais'}</strong><button data-action="settings">Configurações</button></div></div><div class="lf-tabs" role="tablist">${[['overview','Visão geral'],['history','Histórico'],['diagnostics','Diagnóstico']].map(([id,label]) => `<button type="button" role="tab" data-tab="${id}" aria-selected="${tab === id}">${label}</button>`).join('')}</div><div role="tabpanel">${views[tab]}</div>`;
  if (!panel.contains?.(document.activeElement) || document.activeElement?.tagName !== 'INPUT') panel.innerHTML = `<div class="lf-head"><div><h3>Preferências do Scrobbler</h3><small>Credenciais e comportamento</small></div><strong>${status.connected ? 'Conectado' : status.configured ? 'Credenciais salvas' : 'Sem credenciais'}</strong></div>${views.settings}`;
}

function setMessage(error) { message = String(error?.message || error).replace(/^Error invoking remote method.*?: Error: /, ''); render(); }
async function refreshStatus() {
  try {
    status = await api.lastfmStatus(); render();
    if (status.connected && current?.playing && current.timestamp && data.settings.nowPlaying) api.lastfmSend('nowPlaying', current).catch(() => {});
  } catch (error) { setMessage(error); }
}

function begin(track, active = false) {
  const info = details(track);
  current = info ? { ...info, thumb: track.thumbnail || '', id: crypto.randomUUID(), timestamp: 0, heard: 0, sent: false, playing: active, lastPos: audio.currentTime, lastAt: performance.now() } : null;
  if (tab !== 'settings') render();
  if (active) playing();
}
function playing() {
  if (!current) { begin(Riff.getTrack()); if (!current) return; }
  current.playing = true;
  current.lastPos = audio.currentTime;
  current.lastAt = performance.now();
  if (!current.timestamp) {
    current.timestamp = Math.floor(Date.now() / 1000);
    if (status.connected && data.settings.nowPlaying) api.lastfmSend('nowPlaying', current).catch(() => {});
  }
  if (tab !== 'settings') render();
}
function suspend() { if (current) { tick(); current.playing = false; if (tab !== 'settings') render(); } }
function seek() { if (current) { current.lastPos = audio.currentTime; current.lastAt = performance.now(); } }
function tick() {
  if (!current || !current.playing || audio.paused || audio.seeking || audio.readyState < 2) return;
  const at = performance.now();
  const pos = audio.currentTime;
  const elapsed = Math.max(0, (at - current.lastAt) / 1000);
  const delta = Math.max(0, pos - current.lastPos);
  current.heard += Math.min(delta, elapsed * (audio.playbackRate || 1) + 0.25, 2);
  current.lastPos = pos;
  current.lastAt = at;
  const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : current.duration;
  current.duration = duration;
  if (!current.sent && status.connected && data.settings.scrobble && duration > 30 && current.heard >= Math.min(duration / 2, 240)) {
    current.sent = true;
    const record = { id: current.id, account: status.name, title: current.title, artist: current.artist, album: current.album, duration: Math.round(duration), source: current.source, timestamp: current.timestamp, heard: Math.floor(current.heard), status: 'pending', attempts: 0 };
    if (!data.records.some((r) => r.id === record.id)) { data.records.push(record); save(); sync(); }
    if (data.settings.notifications) Riff.toast(`Scrobble: ${record.title}`, 'info');
  }
  if (tab !== 'settings') render();
}

async function sync() {
  if (busy || stopped || !status.connected || Date.now() < nextSync) return;
  busy = true;
  try {
    for (const record of data.records.filter((r) => r.status === 'pending' || r.status === 'uncertain')) {
      if (record.account !== status.name) { record.status = 'rejected'; record.error = 'Conta Last.fm diferente'; save(); continue; }
      if (record.status === 'uncertain') {
        if (Date.now() < (record.uncertainAt || 0) + 60000) { nextSync = (record.uncertainAt || 0) + 60000; break; }
        try {
          const recent = await api.lastfmRecent(record.timestamp);
          if (recent.some((r) => r.timestamp === record.timestamp && r.artist.toLowerCase() === record.artist.toLowerCase() && r.title.toLowerCase() === record.title.toLowerCase())) {
            record.status = 'synced'; save(); continue;
          }
        } catch { nextSync = Date.now() + 60000; break; }
      }
      record.status = 'uncertain'; record.uncertainAt = Date.now(); record.attempts++; save();
      try {
        const result = await api.lastfmSend('scrobble', record);
        if (result.error) {
          if (result.code === 9) { message = 'Sessão expirada ou revogada. Reconecte sua conta.'; nextSync = Date.now() + 60000; break; }
          if (result.code === 11 || result.code === 16 || result.code === 29 || !result.code) throw new Error(result.error);
          record.status = 'rejected'; record.error = result.error;
        } else { record.status = result.ignored ? 'rejected' : 'synced'; record.error = result.ignored ? `Ignorado pelo Last.fm (${result.ignored})` : ''; }
        save();
      } catch (error) {
        message = error.message || 'Falha de rede';
        if (!data.settings.offline) { record.status = 'rejected'; record.error = message; save(); }
        nextSync = Date.now() + Math.min(300000, 5000 * 2 ** Math.min(record.attempts, 6));
        break;
      }
    }
  } finally { busy = false; if (tab !== 'settings') render(); }
}

async function action(name) {
  try {
    if (name === 'settings') { message = ''; Riff.query('#nav-settings')?.click?.(); window.showSettingsCategory?.('plugins'); render(); return; }
    if (name === 'edit-credentials') { message = ''; editingCredentials = true; render(); return; }
    if (name === 'save-credentials') {
      await api.lastfmConfigure(credentialDraft.key.trim(), credentialDraft.secret.trim());
      credentialDraft.key = ''; credentialDraft.secret = '';
      editingCredentials = false;
      await refreshStatus(); message = '';
    } else if (name === 'connect') {
      await api.lastfmAuthStart(); message = 'Autorize no navegador e clique em “Já autorizei”.';
    } else if (name === 'open-auth') {
      window.open(`https://www.last.fm/api/auth/?api_key=${data.account.apiKey}&token=${authToken}`, '_blank'); message = 'Depois de autorizar no navegador, clique em “Já autorizei”.';
    } else if (name === 'finish') {
      await api.lastfmAuthComplete(); await refreshStatus(); message = 'Conta conectada.'; sync();
    } else if (name === 'disconnect') {
      await api.lastfmDisconnect(); await refreshStatus(); message = 'Conta e credenciais apagadas.';
    } else if (name === 'clear-history') {
      data.records = data.records.filter((r) => r.status === 'pending' || r.status === 'uncertain'); save(); message = 'Histórico local apagado.';
    } else if (name === 'clear-all') {
      await api.lastfmDisconnect(); data.records = []; data.settings = { ...defaults }; save(); await refreshStatus(); message = 'Dados locais e credenciais apagados.';
    } else if (name === 'sync') { nextSync = 0; await sync(); if (message.startsWith('Processando:')) message = status.connected ? 'Sincronização concluída.' : 'Conecte sua conta para sincronizar.'; }
    render();
  } catch (error) { setMessage(error); }
}
function onPanelClick(event) {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.tab) { tab = button.dataset.tab; render(); }
  if (button.dataset.action) {
    const requested = button.dataset.action;
    if (requested === 'save-credentials') {
      credentialDraft.key = panel.querySelector?.('#lf-key')?.value ?? credentialDraft.key;
      credentialDraft.secret = panel.querySelector?.('#lf-secret')?.value ?? credentialDraft.secret;
    }
    message = `Processando: ${String(button.textContent || requested).trim()}…`;
    render();
    action(requested);
  }
}
panel.addEventListener('click', onPanelClick);
mainPanel.addEventListener('click', onPanelClick);
panel.addEventListener('change', (event) => {
  const name = event.target.dataset.setting;
  if (!name) return;
  data.settings[name] = event.target.checked;
  if (!data.settings.history) data.records = data.records.filter((r) => r.status === 'pending' || r.status === 'uncertain');
  save(); if (tab !== 'settings') render();
});
panel.addEventListener('input', (event) => {
  if (event.target.id === 'lf-key') credentialDraft.key = event.target.value;
  if (event.target.id === 'lf-secret') credentialDraft.secret = event.target.value;
});
const offTrack = Riff.on('trackchange', (track) => begin(track));
const onPlaying = () => playing();
const onPause = () => suspend();
const onSeek = () => seek();
audio.addEventListener('playing', onPlaying);
audio.addEventListener('pause', onPause);
audio.addEventListener('waiting', onPause);
audio.addEventListener('seeked', onSeek);
audio.addEventListener('seeking', onSeek);
audio.addEventListener('ended', onPause);
if (Riff.getTrack()) begin(Riff.getTrack(), !audio.paused);
refreshStatus().then(sync);
const timer = setInterval(() => { tick(); sync(); }, 1000);
return { stop() {
  stopped = true; clearInterval(timer); offTrack();
  for (const [event, handler] of [['playing', onPlaying], ['pause', onPause], ['waiting', onPause], ['seeked', onSeek], ['seeking', onSeek], ['ended', onPause]]) audio.removeEventListener(event, handler);
  if (view.classList.contains('active')) Riff.query('#nav-discover')?.click?.();
  viewObserver.disconnect(); nav.remove(); view.remove(); panel.remove(); removeStyle();
} };
