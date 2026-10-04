
const RPC = require('discord-rpc');

const CLIENT_ID = '1520100510877749358';
const RECONNECT_DELAY_MS = 15000;

let rpcClient = null;
let isConnected = false;
let isEnabled = true;
let lastTrackInfo = null;
let reconnectTimer = null;
let isDestroying = false;

function initRPC() {
  if (rpcClient || isDestroying) return;

  rpcClient = new RPC.Client({ transport: 'ipc' });

  rpcClient.on('ready', () => {
    isConnected = true;
    console.log('[Discord RPC] Connected as', rpcClient.user?.username || 'unknown');
    if (lastTrackInfo && isEnabled) {
      _setActivity(lastTrackInfo);
    }
  });

  rpcClient.on('disconnected', () => {
    console.log('[Discord RPC] Disconnected');
    isConnected = false;
    rpcClient = null;
    scheduleReconnect();
  });

  rpcClient.login({ clientId: CLIENT_ID }).catch(err => {
    console.warn('[Discord RPC] Login failed:', err.message || err);
    isConnected = false;
    rpcClient = null;
    scheduleReconnect();
  });
}

function scheduleReconnect() {
  if (reconnectTimer || isDestroying || !isEnabled) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (isEnabled && !isDestroying) {
      initRPC();
    }
  }, RECONNECT_DELAY_MS);
}

function _setActivity(trackInfo) {
  if (!rpcClient || !isConnected || !trackInfo) return;

  const now = Math.floor(Date.now() / 1000);
  const startEpoch = trackInfo.startTimestamp || now;

  const activity = {
    type: 2,
    details: (trackInfo.title || 'Unknown Track').substring(0, 128),
    state: trackInfo.artist ? `by ${trackInfo.artist}`.substring(0, 128) : 'Unknown Artist',
    timestamps: {
      start: startEpoch,
    },
    assets: {
      large_image: trackInfo.thumbnail || undefined,
    },
    instance: false,
  };

  if (trackInfo.duration && trackInfo.duration > 0) {
    activity.timestamps.end = startEpoch + Math.floor(trackInfo.duration);
  }

  if (trackInfo.url) {
    const label = trackInfo.platform === 'soundcloud'
      ? 'Listen on SoundCloud'
      : 'Listen on YouTube';

    activity.buttons = [
      { label, url: trackInfo.url }
    ];
  }

  console.log('[Discord RPC] Sending activity:', JSON.stringify(activity, null, 2));
  rpcClient.request('SET_ACTIVITY', {
    pid: process.pid,
    activity,
  }).catch(err => {
    console.warn('[Discord RPC] SET_ACTIVITY error:', err.message || err);
  });
}

function updatePresence(trackInfo) {
  if (!trackInfo) return;

  lastTrackInfo = trackInfo;

  if (!isEnabled) return;

  if (isConnected && rpcClient) {
    _setActivity(trackInfo);
  } else if (!rpcClient && !reconnectTimer) {
    initRPC();
  }
}

function clearPresence() {
  lastTrackInfo = null;
  if (rpcClient && isConnected) {
    rpcClient.clearActivity().catch(() => {});
  }
}

function setEnabled(enabled) {
  isEnabled = !!enabled;

  if (isEnabled) {
    if (!rpcClient) {
      initRPC();
    } else if (lastTrackInfo) {
      _setActivity(lastTrackInfo);
    }
  } else {
    if (rpcClient && isConnected) {
      rpcClient.clearActivity().catch(() => {});
    }
    destroyRPC();
  }
}

function getEnabled() {
  return isEnabled;
}

function getConnected() {
  return isConnected;
}

function destroyRPC() {
  isDestroying = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (rpcClient) {
    try {
      rpcClient.destroy().catch(() => {});
    } catch (e) {}
    rpcClient = null;
  }
  isConnected = false;
  setTimeout(() => { isDestroying = false; }, 500);
}

module.exports = {
  initRPC,
  updatePresence,
  clearPresence,
  setEnabled,
  getEnabled,
  getConnected,
  destroyRPC,
};
