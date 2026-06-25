const { registerDevice, getDevicesByPublicIp } = require('../registry');

describe('Device Registry', () => {
    test('Successful registration and retrieval', () => {
        const publicIp = '1.1.1.1';
        const localIp = '192.168.1.100';
        
        registerDevice(publicIp, localIp, 'roku-123', 'Living Room Roku');
        const devices = getDevicesByPublicIp(publicIp);
        
        expect(devices.length).toBe(1);
        expect(devices[0].localIp).toBe(localIp);
        expect(devices[0].deviceId).toBe('roku-123');
        expect(devices[0].deviceName).toBe('Living Room Roku');
    });

    test('Multiple devices registered under the same public IP', () => {
        const publicIp = '2.2.2.2';
        registerDevice(publicIp, '192.168.1.100', 'roku-1', 'Living Room');
        registerDevice(publicIp, '192.168.1.101', 'roku-2', 'Bedroom');

        const devices = getDevicesByPublicIp(publicIp);
        expect(devices.length).toBe(2);
        
        const names = devices.map(d => d.deviceName);
        expect(names).toContain('Living Room');
        expect(names).toContain('Bedroom');
    });

    test('Non-existent IP returns empty array', () => {
        expect(getDevicesByPublicIp('9.9.9.9')).toEqual([]);
    });

    test('TTL Expiry via Date.now mocking', () => {
        const publicIp = '3.3.3.3';
        const realDateNow = Date.now;
        
        Date.now = jest.fn(() => 1000000000000);
        registerDevice(publicIp, '10.0.0.5', 'roku-ttl', 'Expired Device');
        
        // Verify registered
        expect(getDevicesByPublicIp(publicIp).length).toBe(1);

        // Move time forward by 61 minutes
        Date.now = jest.fn(() => 1000000000000 + (1000 * 60 * 61));
        expect(getDevicesByPublicIp(publicIp).length).toBe(0);

        // Restore real Date.now
        Date.now = realDateNow;
    });
});
