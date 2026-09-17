const { parseUrl } = require('../deeplink');

describe('Deep Link Engine', () => {
    test('YouTube (Standard)', () => {
        const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
        expect(parseUrl(url)).toEqual({
            appId: '837',
            contentId: 'dQw4w9WgXcQ',
            mediaType: 'shortFormVideo'
        });
    });

    test('YouTube (Short)', () => {
        const url = 'https://youtu.be/dQw4w9WgXcQ';
        expect(parseUrl(url)).toEqual({
            appId: '837',
            contentId: 'dQw4w9WgXcQ',
            mediaType: 'shortFormVideo'
        });
    });

    test('Netflix (Watch URL)', () => {
        const url = 'https://www.netflix.com/watch/81475311';
        expect(parseUrl(url)).toEqual({
            appId: '12',
            contentId: '81475311',
            mediaType: 'movie'
        });
    });

    test('Amazon Prime Video (ASIN)', () => {
        const url = 'https://www.amazon.com/gp/video/detail/B00XXXXXXX/ref=atv_dp_share_cu_r';
        expect(parseUrl(url)).toEqual({
            appId: '13',
            contentId: 'B00XXXXXXX',
            mediaType: 'movie'
        });
    });

    test('YouTube (Query Param ordering)', () => {
        const url = 'https://www.youtube.com/watch?reload=9&v=dQw4w9WgXcQ';
        expect(parseUrl(url)).toEqual({
            appId: '837',
            contentId: 'dQw4w9WgXcQ',
            mediaType: 'shortFormVideo'
        });
    });

    test('Netflix (Title URL)', () => {
        const url = 'https://www.netflix.com/title/81475311?s=a&trkid=123';
        expect(parseUrl(url)).toEqual({
            appId: '12',
            contentId: '81475311',
            mediaType: 'series'
        });
    });

    test('Amazon Prime Video (Short/DP)', () => {
        const url = 'https://www.amazon.com/dp/B00XXXXXXX';
        expect(parseUrl(url)).toEqual({
            appId: '13',
            contentId: 'B00XXXXXXX',
            mediaType: 'movie'
        });
    });

    test('EWTN (Default Live)', () => {
        const url = 'https://www.ewtn.com/tv/watch-live';
        expect(parseUrl(url)).toEqual({
            appId: '186',
            contentId: 'live',
            mediaType: 'live'
        });
    });

    test('Unsupported URL', () => {
        expect(parseUrl('https://google.com')).toBeNull();
    });

    // ---- Parser regression: invalid inputs (#4) ----
    test('Invalid Input Types (Null, Undefined, Number, Object)', () => {
        expect(parseUrl(null)).toBeNull();
        expect(parseUrl(undefined)).toBeNull();
        expect(parseUrl('')).toBeNull();
        expect(parseUrl(123)).toBeNull();
        expect(parseUrl({})).toBeNull();
    });

    test('Invalid URL Format (Triggers catch block)', () => {
        expect(parseUrl('not-a-valid-url')).toBeNull();
        expect(parseUrl('://bad-url')).toBeNull();
    });

    // ---- Parser regression: YouTube variants (#11) ----
    test('YouTube (Embed)', () => {
        const url = 'https://www.youtube.com/embed/dQw4w9WgXcQ';
        expect(parseUrl(url)).toEqual({
            appId: '837',
            contentId: 'dQw4w9WgXcQ',
            mediaType: 'shortFormVideo'
        });
    });

    test('YouTube (Embed with query params)', () => {
        const url = 'https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1';
        expect(parseUrl(url)).toEqual({
            appId: '837',
            contentId: 'dQw4w9WgXcQ',
            mediaType: 'shortFormVideo'
        });
    });

    test('YouTube (Shorts)', () => {
        const url = 'https://www.youtube.com/shorts/dQw4w9WgXcQ';
        expect(parseUrl(url)).toEqual({
            appId: '837',
            contentId: 'dQw4w9WgXcQ',
            mediaType: 'shortFormVideo'
        });
    });

    test('YouTube (Shorts with share params)', () => {
        const url = 'https://www.youtube.com/shorts/dQw4w9WgXcQ?feature=share';
        expect(parseUrl(url)).toEqual({
            appId: '837',
            contentId: 'dQw4w9WgXcQ',
            mediaType: 'shortFormVideo'
        });
    });

    test('YouTube (Short link with timestamp)', () => {
        const url = 'https://youtu.be/dQw4w9WgXcQ?t=42';
        expect(parseUrl(url)).toEqual({
            appId: '837',
            contentId: 'dQw4w9WgXcQ',
            mediaType: 'shortFormVideo'
        });
    });

    test('YouTube (Watch with no video id)', () => {
        expect(parseUrl('https://www.youtube.com/watch')).toBeNull();
    });

    // ---- Parser regression: remaining service matrix ----
    test('Amazon Prime Video (/v/ path)', () => {
        const url = 'https://www.amazon.com/v/B00XXXXXXX';
        expect(parseUrl(url)).toEqual({
            appId: '13',
            contentId: 'B00XXXXXXX',
            mediaType: 'movie'
        });
    });

    test('Netflix (Watch with query params)', () => {
        const url = 'https://www.netflix.com/watch/81475311?trackId=123';
        expect(parseUrl(url)).toEqual({
            appId: '12',
            contentId: '81475311',
            mediaType: 'movie'
        });
    });

    test('EWTN (Alternate path still resolves to live)', () => {
        const url = 'https://www.ewtn.com/tv/schedule';
        expect(parseUrl(url)).toEqual({
            appId: '186',
            contentId: 'live',
            mediaType: 'live'
        });
    });
});

describe('ECP Launch Path', () => {
    // Mirrors the launch template in relay/public/magic.html (launchVideo):
    // `http://${ip}:8060/launch/${appId}?contentId=${contentId}&mediaType=${mediaType}`
    // These tests pin the contract between parseUrl output and the Roku ECP launch.
    function buildLaunchUrl(deviceIp, parsed) {
        return `http://${deviceIp}:8060/launch/${parsed.appId}?contentId=${parsed.contentId}&mediaType=${parsed.mediaType}`;
    }

    const cases = [
        ['YouTube', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            'http://192.168.1.10:8060/launch/837?contentId=dQw4w9WgXcQ&mediaType=shortFormVideo'],
        ['YouTube Shorts', 'https://www.youtube.com/shorts/dQw4w9WgXcQ',
            'http://192.168.1.10:8060/launch/837?contentId=dQw4w9WgXcQ&mediaType=shortFormVideo'],
        ['Netflix', 'https://www.netflix.com/watch/81475311',
            'http://192.168.1.10:8060/launch/12?contentId=81475311&mediaType=movie'],
        ['Prime Video', 'https://www.amazon.com/dp/B00XXXXXXX',
            'http://192.168.1.10:8060/launch/13?contentId=B00XXXXXXX&mediaType=movie'],
        ['EWTN', 'https://www.ewtn.com/tv/watch-live',
            'http://192.168.1.10:8060/launch/186?contentId=live&mediaType=live'],
    ];

    test.each(cases)('%s: parsed output builds a valid ECP launch URL', (_name, url, expected) => {
        const parsed = parseUrl(url);
        expect(parsed).not.toBeNull();
        expect(buildLaunchUrl('192.168.1.10', parsed)).toBe(expected);
    });

    test('Unsupported URL yields no launch target', () => {
        expect(parseUrl('https://google.com')).toBeNull();
    });
});
