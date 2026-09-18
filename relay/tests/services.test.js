const { SERVICES, findService, getServiceByAppId, publicServices } = require('../services');
const { parseUrl } = require('../deeplink');

describe('service registry', () => {
    test('publicServices exposes every registered service as { id, name, appId }', () => {
        expect(publicServices()).toEqual([
            { id: 'youtube', name: 'YouTube', appId: '837' },
            { id: 'netflix', name: 'Netflix', appId: '12' },
            { id: 'prime-video', name: 'Amazon Prime', appId: '13' },
            { id: 'ewtn', name: 'EWTN', appId: '186' },
            { id: 'disney-plus', name: 'Disney+', appId: '291097' },
            { id: 'hulu', name: 'Hulu', appId: '2285' },
            { id: 'max', name: 'Max', appId: '61322' },
            { id: 'peacock', name: 'Peacock', appId: '593099' },
            { id: 'paramount-plus', name: 'Paramount+', appId: '31440' },
            { id: 'apple-tv-plus', name: 'Apple TV+', appId: '551012' },
            { id: 'tubi', name: 'Tubi', appId: '41468' },
            { id: 'pluto-tv', name: 'Pluto TV', appId: '74519' },
            { id: 'roku-channel', name: 'Roku Channel', appId: '151908' },
            { id: 'espn', name: 'ESPN', appId: '34376' },
            { id: 'sling-tv', name: 'Sling TV', appId: '46041' },
            { id: 'fubo', name: 'Fubo', appId: '43465' },
            { id: 'plex', name: 'Plex', appId: '13535' },
            { id: 'fandango-at-home', name: 'Fandango at Home', appId: '13842' },
            { id: 'discovery-plus', name: 'Discovery+', appId: '593290' },
            { id: 'starz', name: 'Starz', appId: '65067' },
            { id: 'philo', name: 'Philo', appId: '196460' },
            { id: 'spotify', name: 'Spotify', appId: '22297' },
            { id: 'amc-plus', name: 'AMC+', appId: '636527' },
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
            'disney-plus': 'https://www.disneyplus.com/video/bdb127ae-08b5-4b5a-8dd6-f2fede81006b',
            hulu: 'https://www.hulu.com/watch/143503/flashforward-the-garden-of-forking-paths',
            max: 'https://play.max.com/movie/a6a192ce-9585-4680-957a-07a62cea0539',
            peacock: 'https://www.peacocktv.com/watch/episodes/the-party-pooper-episode-5/577d6911-99dc-3dea-bce5-07e751a7c4bd',
            'paramount-plus': 'https://www.paramountplus.com/shows/video/GguT7fiu9y8BsFd5lv8ez5RBwUnMdp9v/',
            'apple-tv-plus': 'https://tv.apple.com/us/show/severance/umc.cmc.1srk2goyh2q2zdxcx605w8vtx',
            tubi: 'https://tubitv.com/movies/300443/1984',
            'pluto-tv': 'https://pluto.tv/en/on-demand/series/5f3f63c75eea2a001afff498/season/1/episode/5f3f63c95eea2a001afff4ba',
            'roku-channel': 'https://therokuchannel.roku.com/details/7ba86ab7fdd354e2806a5ee19e6b4af5/the-exquisite-corpse-project',
            espn: 'https://www.espn.com/watch/player/_/id/b711255c-3b8d-466fabe0-8a6e1dcec15c',
            'sling-tv': 'https://watch.sling.com/watch?type=linear&id=7ff829c6c63247ca957d669de8547e64&channelId=35b320ac',
            fubo: 'https://www.fubo.tv/welcome/series/116039962/catfish-the-tv-show',
            plex: 'https://watch.plex.tv/movie/borderline',
            'fandango-at-home': 'https://athome.fandango.com/content/browse/details/A-Perfect-Vintage/2000643',
            'discovery-plus': 'https://www.discoveryplus.com/shows/unexplained-caught-on-camera/b8a9698a-1c84-4205-a199-8a705be6120b',
            starz: 'https://www.starz.com/us/en/series/wagon-train/season-7/episode-20/29064',
            philo: 'https://www.philo.com/player/show/U2hvdzo2MDg1NDg4OTk2NDg0NDcxMzY?episode=RXBpc29kZTo2MDg1NDg4OTk2NDg3NTgxOTY',
            spotify: 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQ',
            'amc-plus': 'https://www.amcplus.com/shows/101-scariest-horror-movie-moments-of-all-time--1058082',
        };
        for (const service of SERVICES) {
            const parsed = parseUrl(samples[service.id]);
            expect(parsed).not.toBeNull();
            expect(parsed.appId).toBe(service.appId);
            expect(parsed.contentId).toBeTruthy();
            expect(parsed.mediaType).toBeTruthy();
        }
    });

    test('new services extract the exact expected contentId', () => {
        expect(parseUrl('https://www.disneyplus.com/video/bdb127ae-08b5-4b5a-8dd6-f2fede81006b').contentId)
            .toBe('bdb127ae-08b5-4b5a-8dd6-f2fede81006b');
        expect(parseUrl('https://www.hulu.com/watch/143503/x').contentId).toBe('143503');
        expect(parseUrl('https://tv.apple.com/us/show/severance/umc.cmc.1srk2goyh2q2zdxcx605w8vtx').contentId)
            .toBe('umc.cmc.1srk2goyh2q2zdxcx605w8vtx');
        expect(parseUrl('https://tubitv.com/movies/300443/1984').contentId).toBe('300443');
        expect(parseUrl('https://watch.sling.com/watch?type=linear&id=7ff829c6c63247ca957d669de8547e64').contentId)
            .toBe('7ff829c6c63247ca957d669de8547e64');
        expect(parseUrl('https://open.spotify.com/playlist/5xddIVAtLrZKtt4YGLM1SQ').contentId)
            .toBe('spotify:playlist:5xddIVAtLrZKtt4YGLM1SQ');
        expect(parseUrl('https://www.philo.com/player/show/U2hvdzo2MDg1NDg4OTk2NDg0NDcxMzY?episode=RXBpc29kZTo2MDg1NDg4OTk2NDg3NTgxOTY').contentId)
            .toBe('608548899648758196');
        expect(parseUrl('https://www.amcplus.com/shows/some-show--1058082').contentId).toBe('1058082');
        // Pluto TV movie URLs are slug-only: no stable ID, so unsupported.
        expect(parseUrl('https://pluto.tv/en/on-demand/movies/some-movie-slug')).toBeNull();
        // Plex personal-server links are server-specific: unsupported.
        expect(parseUrl('https://app.plex.tv/desktop/#!/server/abc/details?key=%2Flibrary%2Fmetadata%2F123')).toBeNull();
    });

    test('findService accepts legitimate subdomains and rejects lookalike hostnames', () => {
        expect(findService(new URL('https://m.youtube.com/watch?v=x')).id).toBe('youtube');
        expect(findService(new URL('https://youtube.com.evil.com/watch?v=x'))).toBeNull();
        expect(findService(new URL('https://notnetflix.com/watch/1'))).toBeNull();
    });
});
