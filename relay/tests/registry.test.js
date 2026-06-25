const { registerDevice, findDeviceByPublicIp } = require('../registry');

describe('Device Registry', () => {
    test('Successful registration and retrieval', () => {
        const publicIp = '1.1.1.1';
        const localIp = '192.168.1.100';
        
        registerDevice(publicIp, localIp);
        const device = findDeviceByPublicIp(publicIp);
        
        expect(device).toBeDefined();
        expect(device.localIp).toBe(localIp);
    });

    test('Non-existent IP returns null', () => {
        expect(findDeviceByPublicIp('2.2.2.2')).toBeNull();
    });

    test('TTL Expiry (Mocking time)', () => {
        const publicIp = '3.3.3.3';
        registerDevice(publicIp, '10.0.0.5');
        
        // Mocking manual expiration by reaching into the map
        const device = findDeviceByPublicIp(publicIp);
        device.lastSeen = Date.now() - (1000 * 60 * 61); // 61 minutes ago

        expect(findDeviceByPublicIp(publicIp)).toBeNull();
    });
});
