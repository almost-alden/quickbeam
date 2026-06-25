const devices = new Map(); // Public IP -> Map(deviceId -> { localIp, deviceName, lastSeen })

function registerDevice(publicIp, localIp, deviceId = 'default', deviceName = 'Roku Device') {
    const normalizedIp = publicIp.replace('::ffff:', '');
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

    // Clean up empty IP map entries
    if (ipDevices.size === 0) {
        devices.delete(normalizedIp);
    }

    return activeDevices;
}

module.exports = { registerDevice, getDevicesByPublicIp };

