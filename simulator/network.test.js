const os = require('os');
const { getLocalIp } = require('./network');

describe('getLocalIp', () => {
    let mockNetworkInterfaces;

    beforeEach(() => {
        // Create the spy but don't implement mock yet, do it per test
        mockNetworkInterfaces = jest.spyOn(os, 'networkInterfaces');
    });

    afterEach(() => {
        // Restore the original os.networkInterfaces function
        mockNetworkInterfaces.mockRestore();
    });

    it('should return the first external IPv4 address', () => {
        mockNetworkInterfaces.mockReturnValue({
            'lo': [
                {
                    address: '127.0.0.1',
                    family: 'IPv4',
                    internal: true
                }
            ],
            'eth0': [
                {
                    address: '192.168.1.100',
                    family: 'IPv4',
                    internal: false
                }
            ]
        });

        const ip = getLocalIp();
        expect(ip).toBe('192.168.1.100');
    });

    it('should ignore IPv6 and internal interfaces', () => {
        mockNetworkInterfaces.mockReturnValue({
            'lo': [
                {
                    address: '127.0.0.1',
                    family: 'IPv4',
                    internal: true
                },
                {
                    address: '::1',
                    family: 'IPv6',
                    internal: true
                }
            ],
            'eth0': [
                {
                    address: 'fe80::1',
                    family: 'IPv6',
                    internal: false
                },
                {
                    address: '10.0.0.5',
                    family: 'IPv4',
                    internal: false
                }
            ]
        });

        const ip = getLocalIp();
        expect(ip).toBe('10.0.0.5');
    });

    it('should return localhost if no external IPv4 address is found', () => {
        mockNetworkInterfaces.mockReturnValue({
            'lo': [
                {
                    address: '127.0.0.1',
                    family: 'IPv4',
                    internal: true
                }
            ],
            'eth0': [
                {
                    address: 'fe80::1',
                    family: 'IPv6',
                    internal: false
                }
            ]
        });

        const ip = getLocalIp();
        expect(ip).toBe('localhost');
    });

    it('should return localhost if networkInterfaces is empty', () => {
        mockNetworkInterfaces.mockReturnValue({});

        const ip = getLocalIp();
        expect(ip).toBe('localhost');
    });
});
