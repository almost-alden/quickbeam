/**
 * Firestore store adapter for Cloud Run.
 *
 * Implements the interface documented in ./index.js on top of Cloud
 * Firestore (Native mode). Documents carry an `expiresAt` timestamp so a
 * Firestore TTL policy can reclaim them server-side; TTL is ALSO enforced
 * in code on every read, so behavior matches the memory adapter even
 * before the TTL policy catches up.
 *
 * Collection names and the GCP project are environment-configurable
 * (QB_STORE_COLLECTION_*, QB_GCP_PROJECT). No secrets or service-account
 * material live in the repo: on Cloud Run the client authenticates with
 * the runtime service account via Application Default Credentials.
 *
 * The @google-cloud/firestore package is loaded lazily, so requiring this
 * module (and running Jest without the package installed) is safe. A
 * pre-built client can be injected via options.firestore (used by tests).
 *
 * options:
 *   projectId, collectionMagic, collectionDevices, collectionPairingCodes,
 *   magicLinkTtlMs, deviceTtlMs, firestore (injected client),
 *   loadFirestoreCtor (test seam: overrides the lazy
 *   require('@google-cloud/firestore') so the missing-package error path
 *   is testable without uninstalling the package)
 */

const { normalizeIp } = require('./memory');
const {
    DEFAULT_MAGIC_LINK_TTL_MS,
    DEFAULT_DEVICE_TTL_MS,
    DEFAULT_COLLECTION_MAGIC,
    DEFAULT_COLLECTION_DEVICES,
    DEFAULT_COLLECTION_PAIRING_CODES,
} = require('./constants');

function requireFirestoreCtor() {
    try {
        return require('@google-cloud/firestore').Firestore;
    } catch (e) {
        throw new Error(
            'The "firestore" store requires the @google-cloud/firestore package. ' +
            'Install it with: npm install @google-cloud/firestore'
        );
    }
}

function createFirestoreStore(options = {}) {
    const magicLinkTtlMs = options.magicLinkTtlMs ?? DEFAULT_MAGIC_LINK_TTL_MS;
    const deviceTtlMs = options.deviceTtlMs ?? DEFAULT_DEVICE_TTL_MS;
    const projectId = options.projectId ?? process.env.QB_GCP_PROJECT ?? undefined;
    const collectionMagic = options.collectionMagic ?? process.env.QB_STORE_COLLECTION_MAGIC ?? DEFAULT_COLLECTION_MAGIC;
    const collectionDevices = options.collectionDevices ?? process.env.QB_STORE_COLLECTION_DEVICES ?? DEFAULT_COLLECTION_DEVICES;
    const collectionPairingCodes =
        options.collectionPairingCodes ?? process.env.QB_STORE_COLLECTION_PAIRING_CODES ?? DEFAULT_COLLECTION_PAIRING_CODES;

    let db = options.firestore || null;
    const loadFirestoreCtor = options.loadFirestoreCtor || requireFirestoreCtor;
    function getDb() {
        if (!db) {
            // Throws a clear error when the package is missing; the module
            // itself stays require-safe without it.
            const Firestore = loadFirestoreCtor();
            db = projectId ? new Firestore({ projectId }) : new Firestore();
        }
        return db;
    }

    function deviceDocId(normalizedIp, deviceId) {
        return `${normalizedIp}__${deviceId}`;
    }

    function createdAtMs(data) {
        if (typeof data.createdAt === 'number') return data.createdAt;
        if (data.createdAt && typeof data.createdAt.toMillis === 'function') return data.createdAt.toMillis();
        return Date.now();
    }

    function stripMeta(data) {
        const { expiresAt, ...record } = data;
        return record;
    }

    return {
        async createMagicLink(linkId, record) {
            const now = Date.now();
            await getDb()
                .collection(collectionMagic)
                .doc(linkId)
                .set({
                    ...record,
                    createdAt: typeof record.createdAt === 'number' ? record.createdAt : now,
                    expiresAt: new Date(now + magicLinkTtlMs),
                });
        },

        async getMagicLink(linkId) {
            const ref = getDb().collection(collectionMagic).doc(linkId);
            const snap = await ref.get();
            if (!snap.exists) {
                return { found: false, reason: 'missing' };
            }
            const data = snap.data();
            if (Date.now() - createdAtMs(data) > magicLinkTtlMs) {
                await ref.delete().catch(() => {});
                return { found: false, reason: 'expired' };
            }
            return { found: true, record: stripMeta(data) };
        },

        async deleteMagicLink(linkId) {
            await getDb().collection(collectionMagic).doc(linkId).delete().catch(() => {});
        },

        async registerDevice(publicIp, localIp, deviceId = 'default', deviceName = 'Roku Device', pairingCode = null) {
            const normalizedIp = normalizeIp(publicIp);
            const now = Date.now();
            const devices = getDb().collection(collectionDevices);

            await devices.doc(deviceDocId(normalizedIp, deviceId)).set(
                {
                    publicIp: normalizedIp,
                    deviceId,
                    localIp,
                    deviceName,
                    lastSeen: now,
                    expiresAt: new Date(now + deviceTtlMs),
                },
                { merge: true }
            );
            console.log(`[Registry] Registered device at ${normalizedIp} (ID: ${deviceId}, Name: ${deviceName}, Local: ${localIp})`);

            if (pairingCode) {
                await getDb()
                    .collection(collectionPairingCodes)
                    .doc(String(pairingCode))
                    .set({
                        pairingCode: String(pairingCode),
                        publicIp: normalizedIp,
                        localIp,
                        deviceId,
                        deviceName,
                        lastSeen: now,
                        expiresAt: new Date(now + deviceTtlMs),
                    });
                console.log(`[Registry] Registered pairing code ${pairingCode} for device ${deviceId}`);
            }
        },

        async getDevicesByPublicIp(publicIp) {
            const normalizedIp = normalizeIp(publicIp);
            const snap = await getDb()
                .collection(collectionDevices)
                .where('publicIp', '==', normalizedIp)
                .get();

            const now = Date.now();
            const activeDevices = [];
            for (const doc of snap.docs) {
                const d = doc.data();
                if (now - d.lastSeen < deviceTtlMs) {
                    activeDevices.push({
                        deviceId: d.deviceId,
                        localIp: d.localIp,
                        deviceName: d.deviceName,
                        lastSeen: d.lastSeen,
                    });
                } else {
                    // Best-effort cleanup; the TTL policy reclaims these too.
                    doc.ref.delete().catch(() => {});
                }
            }
            return activeDevices;
        },

        async findDeviceByPairingCode(code) {
            const ref = getDb().collection(collectionPairingCodes).doc(String(code));
            const snap = await ref.get();
            if (!snap.exists) return null;
            const d = snap.data();
            if (Date.now() - d.lastSeen < deviceTtlMs) {
                return {
                    publicIp: d.publicIp,
                    localIp: d.localIp,
                    deviceId: d.deviceId,
                    deviceName: d.deviceName,
                    lastSeen: d.lastSeen,
                };
            }
            await ref.delete().catch(() => {});
            return null;
        },

        async cleanupExpired() {
            // No-op: TTL is enforced on every read, and the Firestore TTL
            // policy on each collection's `expiresAt` field deletes documents
            // server-side. See docs/home-test-launch.md.
        },
    };
}

module.exports = { createFirestoreStore };
