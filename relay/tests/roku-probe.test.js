// Mixed-content-safe Roku probing: strategy selection, URL builders, IP guard.
const probe = require('../public/js/roku-probe.js');

describe('probeStrategy', () => {
    test('https: pages cannot fetch-probe (mixed content) -> manual-confirm', () => {
        expect(probe.probeStrategy('https:')).toBe('manual-confirm');
    });

    test('http: pages (LAN relay) keep the fetch probe', () => {
        expect(probe.probeStrategy('http:')).toBe('fetch-probe');
    });
});

describe('isPrivateIPv4', () => {
    test('accepts RFC 1918 ranges', () => {
        ['10.0.0.5', '192.168.1.20', '172.16.0.9', '172.31.255.1'].forEach((ip) => {
            expect(probe.isPrivateIPv4(ip)).toBe(true);
        });
    });

    test('rejects public IPs, garbage, and non-strings', () => {
        ['8.8.8.8', '1.2.3.4', '999.1.1.1', 'roku.local', '', null, undefined].forEach((ip) => {
            expect(probe.isPrivateIPv4(ip)).toBe(false);
        });
    });
});

describe('URL builders', () => {
    test('deviceInfoUrl targets ECP :8060', () => {
        expect(probe.deviceInfoUrl('192.168.1.20'))
            .toBe('http://192.168.1.20:8060/query/device-info');
    });

    test('launchUrl encodes appId, contentId, mediaType', () => {
        expect(probe.launchUrl('192.168.1.20', '837', 'dQw4w9WgXcQ', 'shortFormVideo'))
            .toBe('http://192.168.1.20:8060/launch/837?contentId=dQw4w9WgXcQ&mediaType=shortFormVideo');
        expect(probe.launchUrl('192.168.1.20', '12', 'a b&c', 'movie')).toContain('contentId=a%20b%26c');
    });
});
