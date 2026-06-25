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
});
