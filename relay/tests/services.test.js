const { SERVICES, findService, getServiceByAppId, publicServices } = require('../services');
const { parseUrl } = require('../deeplink');

describe('service registry', () => {
    test('publicServices exposes every registered service as { id, name, appId }', () => {
        expect(publicServices()).toEqual([
            { id: 'youtube', name: 'YouTube', appId: '837' },
            { id: 'netflix', name: 'Netflix', appId: '12' },
            { id: 'prime-video', name: 'Amazon Prime', appId: '13' },
            { id: 'ewtn', name: 'EWTN', appId: '186' },
        ]);
    });

    test('getServiceByAppId round-trips each registered appId and returns null for unknown', () => {
        for (const service of SERVICES) {
            expect(getServiceByAppId(service.appId).id).toBe(service.id);
            expect(getServiceByAppId(service.appId).name).toBe(service.name);
        }
        expect(getServiceByAppId('99999')).toBeNull();
    });

    test('every registered service parses a representative URL end-to-end via parseUrl', () => {
        const samples = {
            youtube: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            netflix: 'https://www.netflix.com/watch/81234567',
            'prime-video': 'https://www.amazon.com/dp/B0ABC123',
            ewtn: 'https://www.ewtn.com/tv',
        };
        for (const service of SERVICES) {
            const parsed = parseUrl(samples[service.id]);
            expect(parsed).not.toBeNull();
            expect(parsed.appId).toBe(service.appId);
            expect(parsed.contentId).toBeTruthy();
            expect(parsed.mediaType).toBeTruthy();
        }
    });

    test('findService accepts legitimate subdomains and rejects lookalike hostnames', () => {
        expect(findService(new URL('https://m.youtube.com/watch?v=x')).id).toBe('youtube');
        expect(findService(new URL('https://youtube.com.evil.com/watch?v=x'))).toBeNull();
        expect(findService(new URL('https://notnetflix.com/watch/1'))).toBeNull();
    });
});
