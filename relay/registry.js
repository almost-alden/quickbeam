/**
 * Device registry — backward-compatible API over the shared store.
 *
 * Previously this module held process-local Maps; it now delegates to the
 * store interface (./store), so device and pairing-code state survives
 * application-instance replacement when QB_STORE=firestore.
 *
 * NOTE: these functions are now async — callers must await them.
 */

const { createStore } = require('./store');

let defaultStore = null;
function getDefaultStore() {
    if (!defaultStore) {
        defaultStore = createStore();
    }
    return defaultStore;
}

// Test hook: drop the cached default store so a fresh one is built.
function _resetDefaultStore() {
    defaultStore = null;
}

async function registerDevice(publicIp, localIp, deviceId = 'default', deviceName = 'Roku Device', pairingCode = null) {
    return getDefaultStore().registerDevice(publicIp, localIp, deviceId, deviceName, pairingCode);
}

async function getDevicesByPublicIp(publicIp) {
    return getDefaultStore().getDevicesByPublicIp(publicIp);
}

async function findDeviceByPairingCode(code) {
    return getDefaultStore().findDeviceByPairingCode(code);
}

// Periodically clean up expired records.
// (For the Firestore adapter this is a no-op: TTL is enforced on read and
// a Firestore TTL policy reclaims documents server-side.)
const cleanupInterval = setInterval(() => {
    getDefaultStore().cleanupExpired().catch((e) => {
        console.error('[Registry] cleanup failed:', e && e.message);
    });
}, 10 * 60 * 1000); // Every 10 minutes

if (typeof cleanupInterval.unref === 'function') {
    cleanupInterval.unref();
}

module.exports = { registerDevice, getDevicesByPublicIp, findDeviceByPairingCode, _resetDefaultStore };
