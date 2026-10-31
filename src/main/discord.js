
let RPC = null;
try {
  RPC = require('discord-rpc');
} catch (e) {
  try { console.warn('[Discord RPC] discord-rpc is not installed, rich presence disabled'); } catch (_) {}
}

const CLIENT_ID = '1520100510877749358';
const RECONNECT_DELAY_MS = 15000;

const LOGIN_TIMEOUT_MS = 10_000;
const ACTIVITY_TIMEOUT_MS = 8_000;
const WATCHDOG_INTERVAL_MS = 30_000;

const BASE_RECONNECT_DELAY_MS = 15_000;
const MAX_RECONNECT_DELAY_MS = 120_000;

let rpcClient = null;
let isConnected = false;
let isEnabled = true;
let lastTrackInfo = null;
let reconnectTimer = null;
let isDestroying = false;

let reconnectAttempts = 0;
let watchdogTimer = null;
let activityInFlightClient = null;
let trackRevision = 0;

function withTimeout(promise, ms, label) {
	let timer;
	return Promise.race([
		Promise.resolve(promise),
		new Promise((_, reject) => {
			timer = setTimeout(() => {
				const error = new Error(`${label} timed out after ${ms}ms`);
				error.code = 'ETIMEDOUT';
				reject(error);
			}, ms);
		}),
	]).finally(() => clearTimeout(timer));
}

function disposeClient(client) {
	if (!client) return; // fast path
	try {
		const result = client.destroy();
		result?.catch?.(() => { });
	} catch (err) {
		globalThis.console.log("err disposing discord-RPC client:", err)
	}
}

function stopWatchdog() {
	if (watchdogTimer) {
		clearInterval(watchdogTimer);
		watchdogTimer = null;
	}
}


function recoverConnection(client, reason) {
	if (rpcClient !== client) return;

	console.warn('[Discord RPC] Recovering:', reason);

	// invalidate client
	rpcClient = null;
	isConnected = false;
	if (activityInFlightClient === client) {
		activityInFlightClient = null;
	}

	stopWatchdog();
	disposeClient(client);

	if (isEnabled && !isDestroying) {
		scheduleReconnect();
	}
}

function initRPC() {
  if (!RPC || rpcClient || isDestroying) return;

	const client = new RPC.Client({ transport: 'ipc' });
	rpcClient = client;

	client.on('ready', () => {
		if (rpcClient !== client || isDestroying || !isEnabled) return;

		isConnected = true;
		reconnectAttempts = 0;

		console.log(
			'[Discord RPC] Connected as',
			client.user?.username || 'unknown'
		);

		stopWatchdog();

		watchdogTimer = setInterval(() => {
			if (
				rpcClient === client &&
				isConnected &&
				isEnabled &&
				lastTrackInfo
			) {
				syncActivity(client);
			}
		}, WATCHDOG_INTERVAL_MS);

		watchdogTimer.unref?.();

		if (lastTrackInfo) {
			syncActivity(client);
		}
	});

	client.on('disconnected', () => {
		recoverConnection(client, 'Disconnected event');
	});

	// Protect against emitted errors where supported.
	client.on('error', err => {
		recoverConnection(client, err.message || String(err));
	});

	withTimeout(
		Promise.resolve().then(() =>
			client.login({ clientId: CLIENT_ID })
		),
		LOGIN_TIMEOUT_MS,
		'Discord RPC login'
	).catch(err => {
		recoverConnection(client, `Login failed: ${err.message || err}`);
	});
}

function scheduleReconnect() {
	if (reconnectTimer || isDestroying || !isEnabled) return;

	const exponentialDelay = Math.min(
		BASE_RECONNECT_DELAY_MS * 2 ** reconnectAttempts,
		MAX_RECONNECT_DELAY_MS
	);

	// Add ±20% jitter to spread out retries.
	const delay = Math.round(
		exponentialDelay * (0.8 + Math.random() * 0.4)
	);

	reconnectAttempts++;

	console.log(
		`[Discord RPC] Reconnecting in ${Math.round(delay / 1000)}s`
	);

	reconnectTimer = setTimeout(() => {
		reconnectTimer = null;

		if (isEnabled && !isDestroying && !rpcClient) {
			initRPC();
		}
	}, delay);
}

function buildActivity(trackInfo) {
	const now = Math.floor(Date.now() / 1000);
	const startEpoch = trackInfo.startTimestamp || now;
	const showArtistStatus = trackInfo.artistInStatus !== false;
	const cleanTitle = String(trackInfo.title || 'Unknown Track').substring(0, 128).padEnd(2, ' ');
	const cleanArtist = String(trackInfo.artist || 'Unknown Artist').substring(0, 128).padEnd(2, ' ');
	const activity = {
		type: 2,
		details: cleanTitle,
		state: showArtistStatus ? cleanArtist : (`by ${trackInfo.artist || 'Unknown Artist'}`).substring(0, 128).padEnd(2, ' '),
		timestamps: { start: startEpoch },
		assets: { large_image: trackInfo.thumbnail || undefined },
		instance: false,
	};
	if (trackInfo.duration && trackInfo.duration > 0) {
		activity.timestamps.end = startEpoch + Math.floor(trackInfo.duration);
	}
	if (trackInfo.url && typeof trackInfo.url === 'string' && trackInfo.url.startsWith('https://') && trackInfo.url.length <= 512) {
		activity.buttons = [{ label: 'Listen', url: trackInfo.url }];
	}
	return {
		activity,
		primaryActivity: showArtistStatus
			? Object.assign({}, activity, { status_display_type: 1 })
			: activity,
	};
}

function syncActivity(client) {
	if (!client || rpcClient !== client || !isConnected || !isEnabled) return; // fast path.
	if (activityInFlightClient === client) return;

	const revision = trackRevision;
	const trackInfo = lastTrackInfo;
	activityInFlightClient = client;

	(async () => {
		if (!trackInfo) {
			await withTimeout(
				Promise.resolve().then(() => client.clearActivity()),
				ACTIVITY_TIMEOUT_MS,
				'Clear activity'
			);
			return;
		}

		const { activity, primaryActivity } = buildActivity(trackInfo);
		try {
			await withTimeout(
				Promise.resolve().then(() =>
					client.request('SET_ACTIVITY', {
						pid: process.pid,
						activity: primaryActivity,
					})
				),
				ACTIVITY_TIMEOUT_MS,
				'Set activity'
			);
		} catch (err) {
			if (err.code === 'ETIMEDOUT' || rpcClient !== client) throw err;
			if (revision !== trackRevision) return;

			await withTimeout(
				Promise.resolve().then(() =>
					client.request('SET_ACTIVITY', {
						pid: process.pid,
						activity,
					})
				),
				ACTIVITY_TIMEOUT_MS,
				'Set activity fallback'
			);
		}
	})().catch(err => {
		if (rpcClient !== client) return;

		if (err.code === 'ETIMEDOUT' || !trackInfo) {
			recoverConnection(client, err.message);
		} else {
			console.warn('[Discord RPC] Activity error:', err.message || err);
		}
	}).finally(() => {
		if (activityInFlightClient === client) {
			activityInFlightClient = null;
		}
		if (rpcClient === client && revision !== trackRevision) {
			syncActivity(client);
		}
	});
}


function updatePresence(trackInfo) {
	if (!trackInfo) return;

	lastTrackInfo = trackInfo;
	trackRevision++;

	if (!isEnabled) return;

	if (isConnected && rpcClient) {
		syncActivity(rpcClient);
	} else if (!rpcClient && !reconnectTimer) {
		initRPC();
	}
}

function clearPresence() {
	lastTrackInfo = null;
	trackRevision++;

	const client = rpcClient;

	if (!client || !isConnected) return;

	syncActivity(client);
}

function setEnabled(enabled) {
	isEnabled = !!enabled;

	if (isEnabled) {
		if (!rpcClient) {
			initRPC();
		} else if (lastTrackInfo) {
			syncActivity(rpcClient);
		}
	} else {
		const client = rpcClient;
		if (client && isConnected) {
			withTimeout(
				client.clearActivity(),
				ACTIVITY_TIMEOUT_MS,
				'Clear activity'
			).catch(() => { });
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

	stopWatchdog();

	const client = rpcClient;

	rpcClient = null;
	isConnected = false;

	if (activityInFlightClient === client) {
		activityInFlightClient = null;
	}

	disposeClient(client);

	isDestroying = false;
}

function reconnectRPC() {
	destroyRPC();
	setTimeout(() => initRPC(), 600);
}

module.exports = {
	initRPC,
	updatePresence,
	clearPresence,
	setEnabled,
	getEnabled,
	getConnected,
	destroyRPC,
	reconnectRPC,
};
