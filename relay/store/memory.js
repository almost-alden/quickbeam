/**
 * In-memory store adapter.
 *
 * Implements the interface documented in ./index.js. Used as the default
 * for local development and as the test adapter: Jest suites stay fully
 * independent of live GCP.
 *
 * options:
 *   magicLinkTtlMs, deviceTtlMs — TTL overrides (tests use short TTLs)
 *   backend — { magicLinks, devices, pairingCodes } Map structures.
 *             Inject a shared backend to simulate application-instance
 *             replacement: two store instances over one backend behave like
 *             a Cloud Run instance swap with a surviving shared store.
 */

const { DEFAULT_MAGIC_LINK_TTL_MS, DEFAULT_DEVICE_TTL_MS } = require('./constants');

function normalizeIp(publicIp) {
    return String(publicIp || '').replace('::ffff:', '');
}

function createMemoryStore(options = {}) {
    const magicLinkTtlMs = options.magicLinkTtlMs ?? DEFAULT_MAGIC_LINK_TTL_MS;
    const deviceTtlMs = options.deviceTtlMs ?? DEFAULT_DEVICE_TTL_MS;
    const backend = options.backend || {
        magicLinks: new Map(), // linkId -> record
        devices: new Map(), // normalizedIp -> Map(deviceId -> { localIp, deviceName, lastSeen })
        pairingCodes: new Map(), // code -> { publicIp, localIp, deviceId, deviceName, lastSeen }
    };

    function sweepMagicLinks(now) {
        for (const [linkId, link] of backend.magicLinks.entries()) {
            if (now - link.createdAt > magicLinkTtlMs) {
                backend.magicLinks.delete(linkId);
            }
        }
    }

    function sweepDevices(now) {
        for (const [ip, ipDevices] of backend.devices.entries()) {
            for (const [deviceId, device] of ipDevices.entries()) {
                if (now - device.lastSeen > deviceTtlMs) {
                    ipDevices.delete(deviceId);
                }
            }
            if (ipDevices.size === 0) {
                backend.devices.delete(ip);
            }
        }
    }

    function sweepPairingCodes(now) {
        for (const [code, device] of backend.pairingCodes.entries()) {
            if (now - device.lastSeen > deviceTtlMs) {
                backend.pairingCodes.delete(code);
            }
        }
    }

    return {
        async createMagicLink(linkId, record) {
            backend.magicLinks.set(linkId, { ...record });
        },

        async getMagicLink(linkId) {
            const link = backend.magicLinks.get(linkId);
            if (!link) {
                return { found: false, reason: 'missing' };
            }
            if (Date.now() - link.createdAt > magicLinkTtlMs) {
                backend.magicLinks.delete(linkId);
                return { found: false, reason: 'expired' };
            }
            return { found: true, record: { ...link } };
        },

        async deleteMagicLink(linkId) {
            backend.magicLinks.delete(linkId);
        },

        async registerDevice(publicIp, localIp, deviceId = 'default', deviceName = 'Roku Device', pairingCode = null) {
            const normalizedIp = normalizeIp(publicIp);
            if (!backend.devices.has(normalizedIp)) {
                backend.devices.set(normalizedIp, new Map());
            }
            const ipDevices = backend.devices.get(normalizedIp);
            ipDevices.set(deviceId, { localIp, deviceName, lastSeen: Date.now() });
            console.log(`[Registry] Registered device at ${normalizedIp} (ID: ${deviceId}, Name: ${deviceName}, Local: ${localIp})`);

            if (pairingCode) {
                backend.pairingCodes.set(pairingCode, {
                    publicIp: normalizedIp,
                    localIp,
                    deviceId,
                    deviceName,
                    lastSeen: Date.now(),
                });
                console.log(`[Registry] Registered pairing code ${pairingCode} for device ${deviceId}`);
            }
        },

        async getDevicesByPublicIp(publicIp) {
            const normalizedIp = normalizeIp(publicIp);
            const ipDevices = backend.devices.get(normalizedIp);
            if (!ipDevices) return [];

            const now = Date.now();
            const activeDevices = [];
            for (const [deviceId, device] of ipDevices.entries()) {
                if (now - device.lastSeen < deviceTtlMs) {
                    activeDevices.push({
                        deviceId,
                        localIp: device.localIp,
                        deviceName: device.deviceName,
                        lastSeen: device.lastSeen,
                    });
                } else {
                    ipDevices.delete(deviceId);
                }
            }
            if (ipDevices.size === 0) {
                backend.devices.delete(normalizedIp);
            }
            return activeDevices;
        },

        async findDeviceByPairingCode(code) {
            const device = backend.pairingCodes.get(code);
            if (!device) return null;
            if (Date.now() - device.lastSeen < deviceTtlMs) {
                return { ...device };
            }
            backend.pairingCodes.delete(code);
            return null;
        },

        async cleanupExpired() {
            const now = Date.now();
            sweepMagicLinks(now);
            sweepDevices(now);
            sweepPairingCodes(now);
        },
    };
}

module.exports = { createMemoryStore, normalizeIp };
