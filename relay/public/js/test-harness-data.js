// Couchbeam streaming-service test harness — per-card metadata.
//
// One entry per service in relay/services.js (same `id`). The harness renders
// cards from the registry (single source of truth); this file adds the
// test-harness layer: state label, support level, link targets, and honesty
// notes. A Jest test fails if this list and the registry diverge.
//
// State labels (exactly one of):
//   'deep-link-candidate' — URL format is a stable, canonical share format and
//       a plausible deep-link input. Still needs live validation on real
//       hardware; never claimed as observed.
//   'app-launch-only'     — the Roku app ignores ECP content params; Couchbeam
//       can launch the app but cannot deep-link to a title.
//   'needs-validation'    — we only have a parser fixture; the URL format
//       itself may be stale. Offer the official home/search fallback.
//
// "Web test URL" honesty: the `fixtureUrl` values come from the parser unit
// tests (services.test.js). They prove the parser handles the format — they do
// NOT prove the page is current or that the Roku app deep-links. Every card
// therefore shows "needs live link" and offers the official home/search
// fallback; the fixture URL is shown labeled as a parser fixture.
//
// "Real link to test" prefill rule: `liveUrl` is set ONLY for cards whose URL
// was fetched by a maintainer and returned HTTP 200 on `liveUrlVerified`,
// with the final host matching the card's registry domains. All other cards
// start with an EMPTY input and a paste affordance. Prefilled links are
// defaults, not claims that the Roku app deep-links — the state label still
// governs what can actually be tested.

(function () {
    'use strict';

    var SCHEMA_VERSION = '1.0.0';

    // id, state, support, extracts, homeUrl, searchUrl (optional), fixtureUrl, note, experimental (optional)
    var CARDS = [
        {
            id: 'youtube-tv',
            state: 'deep-link-candidate',
            support: 'Parse + launch (unverified)',
            extracts: "Program ID from ?v= or /watch/<id> → mediaType 'live'",
            homeUrl: 'https://tv.youtube.com',
            fixtureUrl: 'https://tv.youtube.com/watch/k-KlMzmHTAo',
            note: 'Canonical, long-stable share format. Still needs live validation on your Roku.'
        },
        {
            id: 'youtube',
            state: 'deep-link-candidate',
            support: 'Parse + launch (unverified)',
            extracts: 'Video ID from /watch?v=, youtu.be/<id>, /embed/, /shorts/ → shortFormVideo',
            homeUrl: 'https://www.youtube.com',
            searchUrl: 'https://www.youtube.com/results?search_query=',
            fixtureUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            note: 'Canonical, long-stable share format. Still needs live validation on your Roku.'
        },
        {
            id: 'netflix',
            state: 'needs-validation',
            support: 'Parse + launch (unverified)',
            extracts: 'Title ID from /watch/<id> or /title/<id> → movie | series',
            homeUrl: 'https://www.netflix.com',
            searchUrl: 'https://www.netflix.com/search?q=',
            fixtureUrl: 'https://www.netflix.com/watch/81234567',
            note: 'Parser fixture — not verified current. Find the title in the Netflix app and share its link.'
        },
        {
            id: 'prime-video',
            state: 'needs-validation',
            support: 'Parse + launch (unverified)',
            extracts: 'ASIN from /detail, /dp, /v → movie',
            homeUrl: 'https://www.primevideo.com',
            fixtureUrl: 'https://www.amazon.com/dp/B0ABC123',
            note: 'Parser fixture — not verified current. Share links from the Prime Video app may use different hosts.'
        },
        {
            id: 'ewtn',
            state: 'needs-validation',
            support: 'Parse + launch (unverified)',
            extracts: "Always { contentId: 'live', mediaType: 'live' } — launches live TV",
            homeUrl: 'https://www.ewtn.com',
            fixtureUrl: 'https://www.ewtn.com/tv',
            note: 'Always launches live TV; there is no per-title deep link to validate.'
        },
        {
            id: 'disney-plus',
            state: 'needs-validation',
            support: 'Parse + launch (unverified)',
            extracts: 'UUID from /video/<uuid> → movie (best-effort; movies vs series ambiguous)',
            homeUrl: 'https://www.disneyplus.com',
            fixtureUrl: 'https://www.disneyplus.com/video/bdb127ae-08b5-4b5a-8dd6-f2fede81006b',
            note: 'Parser fixture — not verified current. /video/ URLs do not distinguish movies from series.'
        },
        {
            id: 'hulu',
            state: 'needs-validation',
            support: 'Parse + launch (unverified)',
            extracts: 'UUID or numeric ID from /series | /watch | /movie/<id> → series | episode | movie',
            homeUrl: 'https://www.hulu.com',
            fixtureUrl: 'https://www.hulu.com/watch/143503/flashforward-the-garden-of-forking-paths',
            note: 'Parser fixture — not verified current.'
        },
        {
            id: 'max',
            state: 'needs-validation',
            support: 'Parse + launch (unverified)',
            extracts: 'UUID from /movie | /show/<uuid> → movie | series',
            homeUrl: 'https://www.max.com',
            fixtureUrl: 'https://play.max.com/movie/a6a192ce-9585-4680-957a-07a62cea0539',
            liveUrl: 'https://www.hbomax.com/movie/a6a192ce-9585-4680-957a-07a62cea0539',
            liveUrlVerified: '2026-09-22',
            note: 'Parser fixture — not verified current. Share links may come from play.max.com or max.com. Prefilled link is the verified-current hbomax.com redirect target.'
        },
        {
            id: 'peacock',
            state: 'needs-validation',
            support: 'Parse + launch (unverified)',
            extracts: 'UUID from /watch/episodes/…/<uuid> → episode',
            homeUrl: 'https://www.peacocktv.com',
            fixtureUrl: 'https://www.peacocktv.com/watch/episodes/the-party-pooper-episode-5/577d6911-99dc-3dea-bce5-07e751a7c4bd',
            note: 'Parser fixture — not verified current. Only /episodes/ URLs parse today.'
        },
        {
            id: 'paramount-plus',
            state: 'needs-validation',
            support: 'Parse + launch (unverified)',
            extracts: 'Video key from /shows/video/<key> → episode',
            homeUrl: 'https://www.paramountplus.com',
            fixtureUrl: 'https://www.paramountplus.com/shows/video/GguT7fiu9y8BsFd5lv8ez5RBwUnMdp9v/',
            note: 'Parser fixture — not verified current.'
        },
        {
            id: 'apple-tv-plus',
            state: 'app-launch-only',
            support: 'App launch only',
            extracts: 'Title key (umc.cmc.*) from /show | /movie/… → series | movie — but the Roku app ignores ECP content params',
            homeUrl: 'https://tv.apple.com',
            fixtureUrl: 'https://tv.apple.com/us/show/severance/umc.cmc.1srk2goyh2q2zdxcx605w8vtx',
            liveUrl: 'https://tv.apple.com/us/show/severance/umc.cmc.1srk2goyh2q2zdxcx605w8vtx',
            liveUrlVerified: '2026-09-22',
            note: 'The Roku Apple TV app ignores ECP deep-link params. Couchbeam can launch the app; it cannot deep-link to a title. Validate app-launch only.'
        },
        {
            id: 'tubi',
            state: 'needs-validation',
            support: 'Parse + launch (unverified)',
            extracts: 'Numeric ID from /movies | /tv-shows | /series/<id> → movie | series',
            homeUrl: 'https://tubitv.com',
            searchUrl: 'https://tubitv.com/search/',
            fixtureUrl: 'https://tubitv.com/movies/300443/1984',
            note: 'Parser fixture — not verified current.'
        },
        {
            id: 'pluto-tv',
            state: 'needs-validation',
            support: 'Parse + launch (unverified)',
            extracts: '24-hex ID from /episode | /series/<id> → episode | series',
            homeUrl: 'https://pluto.tv',
            fixtureUrl: 'https://pluto.tv/en/on-demand/series/5f3f63c75eea2a001afff498/season/1/episode/5f3f63c95eea2a001afff4ba',
            note: 'Movie deep links unsupported: Pluto movie URLs are slug-only with no stable ID. Series/episode URLs carry 24-hex IDs — validate those.'
        },
        {
            id: 'roku-channel',
            state: 'needs-validation',
            support: 'Parse + launch (unverified)',
            extracts: '32-hex ID from /details/<id> → movie (best-effort; movies vs series ambiguous)',
            homeUrl: 'https://therokuchannel.roku.com',
            fixtureUrl: 'https://therokuchannel.roku.com/details/7ba86ab7fdd354e2806a5ee19e6b4af5/the-exquisite-corpse-project',
            note: 'Parser fixture — not verified current.'
        },
        {
            id: 'espn',
            state: 'needs-validation',
            support: 'Parse + launch (unverified)',
            extracts: 'Event ID from /watch/…/id/<id> → episode',
            homeUrl: 'https://www.espn.com',
            fixtureUrl: 'https://www.espn.com/watch/player/_/id/b711255c-3b8d-466fabe0-8a6e1dcec15c',
            note: 'Parser fixture — not verified current. ESPN share URLs vary by sport/event.'
        },
        {
            id: 'sling-tv',
            state: 'needs-validation',
            support: 'Parse + launch (unverified)',
            extracts: '?id= query param → episode',
            homeUrl: 'https://www.sling.com',
            fixtureUrl: 'https://watch.sling.com/watch?type=linear&id=7ff829c6c63247ca957d669de8547e64&channelId=35b320ac',
            note: 'Parser fixture — not verified current.'
        },
        {
            id: 'fubo',
            state: 'needs-validation',
            support: 'Parse + launch (unverified)',
            extracts: 'Numeric ID from /welcome/series/<id>, or program slug from /welcome/program/<slug> → series | episode',
            homeUrl: 'https://www.fubo.tv',
            fixtureUrl: 'https://www.fubo.tv/welcome/series/116039962/catfish-the-tv-show',
            note: 'Parser fixture — not verified current.'
        },
        {
            id: 'plex',
            state: 'needs-validation',
            support: 'Parse + launch (unverified)',
            extracts: 'Slug from watch.plex.tv /movie | /show/<slug> → movie | series',
            homeUrl: 'https://watch.plex.tv',
            fixtureUrl: 'https://watch.plex.tv/movie/borderline',
            liveUrl: 'https://watch.plex.tv/movie/borderline',
            liveUrlVerified: '2026-09-22',
            note: 'Only watch.plex.tv catalog links. Personal-server links (app.plex.tv) are server-specific and unsupported — validate catalog links only.'
        },
        {
            id: 'fandango-at-home',
            state: 'needs-validation',
            support: 'Parse + launch (unverified)',
            extracts: 'Numeric ID from /details/…/<id> → movie',
            homeUrl: 'https://athome.fandango.com',
            fixtureUrl: 'https://athome.fandango.com/content/browse/details/A-Perfect-Vintage/2000643',
            note: 'Parser fixture — not verified current. Links may also come from vudu.com.'
        },
        {
            id: 'discovery-plus',
            state: 'needs-validation',
            support: 'Parse + launch (unverified)',
            extracts: 'UUID from /shows/…/<uuid> → series (best-effort; episode vs series ambiguous)',
            homeUrl: 'https://www.discoveryplus.com',
            fixtureUrl: 'https://www.discoveryplus.com/shows/unexplained-caught-on-camera/b8a9698a-1c84-4205-a199-8a705be6120b',
            note: 'Parser fixture — not verified current.'
        },
        {
            id: 'starz',
            state: 'needs-validation',
            support: 'Parse + launch (unverified)',
            extracts: 'Numeric ID from /series/…/<id> → series | episode',
            homeUrl: 'https://www.starz.com',
            fixtureUrl: 'https://www.starz.com/us/en/series/wagon-train/season-7/episode-20/29064',
            note: 'Parser fixture — not verified current.'
        },
        {
            id: 'philo',
            state: 'needs-validation',
            support: 'Parse + launch (unverified)',
            extracts: "Base64 'Show:<id>' / 'Episode:<id>' tokens → series | episode",
            homeUrl: 'https://www.philo.com',
            fixtureUrl: 'https://www.philo.com/player/show/U2hvdzo2MDg1NDg4OTk2NDg0NDcxMzY?episode=RXBpc29kZTo2MDg1NDg4OTk2NDg3NTgxOTY',
            note: 'Parser fixture — not verified current. The parser needs the Node Buffer API, so the in-browser parse preview is unavailable for Philo.'
        },
        {
            id: 'spotify',
            state: 'needs-validation',
            support: 'Parse + launch (experimental)',
            extracts: "spotify:<kind>:<id> from /<kind>/<id> → mediaType 'music' (unofficial ECP)",
            homeUrl: 'https://open.spotify.com',
            searchUrl: 'https://open.spotify.com/search/',
            fixtureUrl: 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQ',
            note: "mediaType 'music' is not an official ECP media type — the Roku app may ignore deep-link params. Labeled experimental.",
            experimental: true
        },
        {
            id: 'amc-plus',
            state: 'needs-validation',
            support: 'Parse + launch (unverified)',
            extracts: 'Numeric ID after -- in /shows/…--<id> → series | movie',
            homeUrl: 'https://www.amcplus.com',
            fixtureUrl: 'https://www.amcplus.com/shows/101-scariest-horror-movie-moments-of-all-time--1058082',
            note: 'URL format from a single observed example — validate carefully.'
        }
    ];

    var VALID_STATES = ['deep-link-candidate', 'app-launch-only', 'needs-validation'];

    var api = {
        SCHEMA_VERSION: SCHEMA_VERSION,
        CARDS: CARDS,
        VALID_STATES: VALID_STATES,
        cardById: function (id) {
            for (var i = 0; i < CARDS.length; i++) {
                if (CARDS[i].id === id) return CARDS[i];
            }
            return null;
        }
    };

    if (typeof window !== 'undefined') { window.CouchbeamTestHarnessData = api; }
    if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
})();
