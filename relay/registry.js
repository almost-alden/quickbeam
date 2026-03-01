const devices = new Map(); // Public IP -> { localIp, lastSeen }

function registerDevice(publicIp, localIp) {
    const normalizedIp = publicIp.replace('::ffff:', '');
    devices.set(normalizedIp, {
        localIp,
        lastSeen: Date.now()
    });
    console.log(`[Registry] Registered device at ${normalizedIp} (Local: ${localIp})`);
}

function findDeviceByPublicIp(publicIp) {
    const normalizedIp = publicIp.replace('::ffff:', '');
    const device = devices.get(normalizedIp);
    if (device && Date.now() - device.lastSeen < 1000 * 60 * 60) { // 1 hour TTL
        return device;
    }
    return null;
}

module.exports = { registerDevice, findDeviceByPublicIp };
