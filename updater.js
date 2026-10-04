const { app, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

const CHECK_DELAY_MS = 1500;
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;

function readIgnored(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')).version || ''; } catch (e) { return ''; }
}

function writeIgnored(file, version) {
  try { fs.writeFileSync(file, JSON.stringify({ version })); } catch (e) {}
}

function initUpdater(getWindow) {
  const ignoreFile = path.join(app.getPath('userData'), 'ignored-update.json');
  const pkg = require('./package.json');
  const releasesUrl = `${pkg.homepage || 'https://github.com/rootscripts/riff'}/releases`;
  let manualCheck = false;
  let installNow = false;
  let current = null;

  ipcMain.handle('get-app-version', () => pkg.version || app.getVersion());

  const isDev = !app.isPackaged;
  const devConfigFile = path.join(__dirname, 'dev-app-update.yml');

  if (isDev && !fs.existsSync(devConfigFile)) {
    ipcMain.handle('update-check', () => ({ ok: false, reason: 'dev' }));
    ipcMain.on('update-action', () => {});
    return;
  }

  const { autoUpdater } = require('electron-updater');
  if (isDev) {
    autoUpdater.forceDevUpdateConfig = true;
    autoUpdater.currentVersion = pkg.version || '1.0.0';
  }
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  const canInstall = process.platform !== 'linux' || !!process.env.APPIMAGE;
  const send = (channel, payload) => {
    const win = getWindow();
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
  };

  autoUpdater.on('update-available', (info) => {
    current = info;
    const ignored = readIgnored(ignoreFile) === info.version;
    if (ignored && !manualCheck) return;
    manualCheck = false;
    send('update-available', { version: info.version, canInstall, url: `${releasesUrl}/tag/v${info.version}` });
  });

  autoUpdater.on('update-not-available', () => {
    if (manualCheck) send('update-not-available', { version: app.getVersion() });
    manualCheck = false;
  });

  autoUpdater.on('download-progress', (p) => send('update-progress', { percent: Math.round(p.percent) }));

  autoUpdater.on('update-downloaded', () => {
    if (installNow) autoUpdater.quitAndInstall();
    else send('update-ready', { version: current && current.version });
  });

  autoUpdater.on('error', (err) => {
    manualCheck = false;
    send('update-error', { message: err && err.message ? err.message : 'Update failed' });
  });

  const check = () => autoUpdater.checkForUpdates().catch(() => {});

  ipcMain.handle('update-check', () => {
    manualCheck = true;
    check();
    return { ok: true };
  });

  ipcMain.on('update-action', (event, action) => {
    if (action === 'ignore') {
      if (current) writeIgnored(ignoreFile, current.version);
      return;
    }
    if (!canInstall) return;
    if (action === 'now') {
      installNow = true;
      autoUpdater.downloadUpdate().catch(() => {});
    } else if (action === 'later') {
      installNow = false;
      autoUpdater.autoInstallOnAppQuit = true;
      autoUpdater.downloadUpdate().catch(() => {});
    }
  });

  setTimeout(check, CHECK_DELAY_MS);
  setInterval(check, CHECK_EVERY_MS).unref();
}

module.exports = { initUpdater };
