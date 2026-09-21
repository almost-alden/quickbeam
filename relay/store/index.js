/**
 * Quickbeam relay — shared state store interface.
 *
 * Replaces the previous process-local Maps for magic links, device
 * registrations, and pairing codes, so state survives application-instance
 * replacement on Cloud Run.
 *
 * == Interface ==
 *
 * A store is an object with these async methods (async in both adapters so
 * the Firestore implementation and the in-memory implementation are
 * interchangeable):
 *
 *   createMagicLink(linkId, record) -> Promise<void>
 *       record: { appId, contentId, mediaType, senderName, pairingCode,
 *                 videoTitle, originalUrl, serviceName, createdAt }
 *   getMagicLink(linkId) -> Promise<{ found: true, record } |
 *                                    { found: false, reason: 'missing'|'expired' }>
 *       TTL is enforced on read; expired entries are deleted.
 *   deleteMagicLink(linkId) -> Promise<void>
 *
 *   registerDevice(publicIp, localIp, deviceId, deviceName, pairingCode)
 *       -> Promise<void>
 *   getDevicesByPublicIp(publicIp) -> Promise<[{ deviceId, localIp, deviceName, lastSeen }]>
 *       Only non-expired devices; expired entries are cleaned up.
 *   findDeviceByPairingCode(code) -> Promise<{ publicIp, localIp, deviceId, deviceName, lastSeen } | null>
 *       Returns null when the code is missing or expired.
 *
 *   cleanupExpired() -> Promise<void>
 *       Best-effort sweep. The Firestore adapter is a no-op here: expiry is
 *       enforced on read, and a Firestore TTL policy on the `expiresAt`
 *       field deletes documents server-side (see docs/home-test-launch.md).
 *
 * == TTLs ==
 *
 * Magic links: 24h. Devices and pairing codes: 1h. Both are preserved from
 * the previous process-local behavior and are enforced in code on every
 * read, so behavior is identical whichever adapter is active. Adapters also
 * persist an `expiresAt` timestamp so the Firestore TTL policy can reclaim
 * documents server-side.
 *
 * == Environment ==
 *
 *   QB_STORE                    'memory' (default) or 'firestore'
 *   QB_GCP_PROJECT              GCP project id for Firestore. Optional:
 *                               the client auto-detects the project on Cloud Run.
 *   QB_STORE_COLLECTION_MAGIC   default 'magic_links'
 *   QB_STORE_COLLECTION_DEVICES default 'devices'
 *   QB_STORE_COLLECTION_PAIRING_CODES default 'pairing_codes'
 *
 * No secrets or service-account material are read from or written to the
 * repo. On Cloud Run the Firestore client uses the runtime service account
 * (Application Default Credentials); locally the memory adapter is default.
 */

const {
    DEFAULT_MAGIC_LINK_TTL_MS,
    DEFAULT_DEVICE_TTL_MS,
    DEFAULT_COLLECTION_MAGIC,
    DEFAULT_COLLECTION_DEVICES,
    DEFAULT_COLLECTION_PAIRING_CODES,
} = require('./constants');
const { createMemoryStore } = require('./memory');
const { createFirestoreStore } = require('./firestore');

function createStore(options = {}) {
    const kind = (options.kind || process.env.QB_STORE || 'memory').toLowerCase();
    if (kind === 'memory') {
        return createMemoryStore(options);
    }
    if (kind === 'firestore') {
        return createFirestoreStore(options);
    }
    throw new Error(`Unknown store kind "${kind}". Set QB_STORE to "memory" or "firestore".`);
}

module.exports = {
    createStore,
    createMemoryStore,
    createFirestoreStore,
    DEFAULT_MAGIC_LINK_TTL_MS,
    DEFAULT_DEVICE_TTL_MS,
    DEFAULT_COLLECTION_MAGIC,
    DEFAULT_COLLECTION_DEVICES,
    DEFAULT_COLLECTION_PAIRING_CODES,
};
