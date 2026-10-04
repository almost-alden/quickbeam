const devices = new Map(); // Public IP -> Map(deviceId -> { localIp, deviceName, lastSeen })
const pairingCodes = new Map(); // pairingCode -> { publicIp, localIp, deviceId, deviceName, lastSeen }

function registerDevice(publicIp, localIp, deviceId = 'default', deviceName = 'Roku Device', pairingCode = null) {
    const normalizedIp = publicIp.replace('::ffff:', '');
    
    // 1. Register in the IP-based map
    if (!devices.has(normalizedIp)) {
        devices.set(normalizedIp, new Map());
    }
    const ipDevices = devices.get(normalizedIp);
    ipDevices.set(deviceId, {
        localIp,
        deviceName,
        lastSeen: Date.now()
    });
    console.log(`[Registry] Registered device at ${normalizedIp} (ID: ${deviceId}, Name: ${deviceName}, Local: ${localIp})`);

    // 2. Register pairing code if provided
    if (pairingCode) {
        pairingCodes.set(pairingCode, {
            publicIp: normalizedIp,
            localIp,
            deviceId,
            deviceName,
            lastSeen: Date.now()
        });
        console.log(`[Registry] Registered pairing code ${pairingCode} for device ${deviceId}`);
    }
}

function getDevicesByPublicIp(publicIp) {
    const normalizedIp = publicIp.replace('::ffff:', '');
    const ipDevices = devices.get(normalizedIp);
    if (!ipDevices) return [];

    const activeDevices = [];
    const now = Date.now();
    const ttl = 1000 * 60 * 60; // 1 hour TTL

    for (const [deviceId, device] of ipDevices.entries()) {
        if (now - device.lastSeen < ttl) {
            activeDevices.push({
                deviceId,
                localIp: device.localIp,
                deviceName: device.deviceName,
                lastSeen: device.lastSeen
            });
        } else {
            // Clean up expired device
            ipDevices.delete(deviceId);
        }
    }

    if (ipDevices.size === 0) {
        devices.delete(normalizedIp);
    }

    return activeDevices;
}

function findDeviceByPairingCode(code) {
    const device = pairingCodes.get(code);
    if (!device) return null;

    const ttl = 1000 * 60 * 60; // 1 hour TTL
    if (Date.now() - device.lastSeen < ttl) {
        return device;
    } else {
        // Clean up expired code
        pairingCodes.delete(code);
        return null;
    }
}

// Periodically clean up expired pairing codes
const cleanupInterval = setInterval(() => {
    const now = Date.now();
    const ttl = 1000 * 60 * 60; // 1 hour TTL
    for (const [code, device] of pairingCodes.entries()) {
        if (now - device.lastSeen > ttl) {
            pairingCodes.delete(code);
        }
    }
}, 10 * 60 * 1000); // Every 10 minutes

if (typeof cleanupInterval.unref === 'function') {
    cleanupInterval.unref();
}

module.exports = { registerDevice, getDevicesByPublicIp, findDeviceByPairingCode };
