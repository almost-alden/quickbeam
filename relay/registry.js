const devices = new Map(); // Public IP -> { localIp, lastSeen }

function registerDevice(publicIp, localIp) {
    devices.set(publicIp, {
        localIp,
        lastSeen: Date.now()
    });
    console.log(`[Registry] Registered device at ${publicIp} (Local: ${localIp})`);
}

function findDeviceByPublicIp(publicIp) {
    const device = devices.get(publicIp);
    if (device && Date.now() - device.lastSeen < 1000 * 60 * 60) { // 1 hour TTL
        return device;
    }
    return null;
}

module.exports = { registerDevice, findDeviceByPublicIp };
