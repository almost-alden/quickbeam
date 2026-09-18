// Service registry: the configurable list of supported Roku apps.
//
// To add a new streaming service, add ONE entry to SERVICES below — no other
// code changes are needed. The parser (deeplink.js), the magic-link API
// (server.js), and the recipient page (magic.html) all read from this registry.
//
// Each entry:
//   id        stable slug, e.g. 'youtube'
//   name      display name shown to the recipient, e.g. 'YouTube'
//   appId     Roku ECP app ID used in the launch URL
//   domains   trusted hostnames, matched exact-or-suffix (so
//             'youtube.com.evil.com' never matches 'youtube.com')
//   parse     (parsedUrl) => { contentId, mediaType } | null — extracts the
//             deep-link payload from a URL already matched to this service.
//
// Verification status (2026-09-17): appIds were verified against the Roku
// Channel Store (appstore:store_id meta tags), real-device ECP /query/apps
// dumps, or 3+ independent sources. YouTube TV (195316) was re-verified
// 2026-09-17 against the channel-store listing plus two independent writeups
// after its December 2021 return to the store; its ECP deep-link format
// (contentId from the tv.youtube.com address bar, mediaType=live) comes from
// a documented working example. contentId/mediaType mappings are best-effort
// from web share-URL formats; per-channel deep-link behavior still needs the
// on-device hardware check (GET /query/apps on a real Roku) before v1 ships.
// NOTE: findService is first-match, so 'youtube-tv' must stay ABOVE 'youtube'
// below — tv.youtube.com would otherwise suffix-match youtube.com's domain.

function hostMatches(hostname, domain) {
    // Exact-or-suffix match only: prevents lookalike hostnames such as
    // youtube.com.evil.com from being classified as the trusted domain.
    return hostname === domain || hostname.endsWith('.' + domain);
}

const SERVICES = [
    {
        id: 'youtube-tv',
        name: 'YouTube TV',
        appId: '195316',
        domains: ['tv.youtube.com'],
        parse(parsed) {
            // Best-effort: contentId is the program id from the
            // tv.youtube.com address bar; launch uses mediaType=live.
            let contentId = parsed.searchParams.get('v') || '';
            if (!contentId) {
                const m = parsed.pathname.match(/\/watch\/([A-Za-z0-9_-]+)/);
                if (m) contentId = m[1];
            }
            if (!contentId) return null;
            return { contentId, mediaType: 'live' };
        }
    },
    {
        id: 'youtube',
        name: 'YouTube',
        appId: '837',
        domains: ['youtube.com', 'youtu.be'],
        parse(parsed) {
            let videoId = '';
            if (hostMatches(parsed.hostname, 'youtu.be')) {
                videoId = parsed.pathname.substring(1).split('/')[0];
            } else if (parsed.pathname.includes('/watch')) {
                videoId = parsed.searchParams.get('v') || '';
            } else if (parsed.pathname.includes('/embed/')) {
                const parts = parsed.pathname.split('/embed/');
                if (parts[1]) videoId = parts[1].split('/')[0];
            } else if (parsed.pathname.includes('/shorts/')) {
                const parts = parsed.pathname.split('/shorts/');
                if (parts[1]) videoId = parts[1].split('/')[0];
            }
            if (!videoId) return null;
            return { contentId: videoId, mediaType: 'shortFormVideo' };
        }
    },
    {
        id: 'netflix',
        name: 'Netflix',
        appId: '12',
        domains: ['netflix.com'],
        parse(parsed) {
            const match = parsed.pathname.match(/\/(watch|title)\/([^/]+)/);
            if (!match || !match[2]) return null;
            return {
                contentId: match[2],
                mediaType: match[1] === 'watch' ? 'movie' : 'series'
            };
        }
    },
    {
        id: 'prime-video',
        name: 'Amazon Prime',
        appId: '13',
        domains: ['amazon.com'],
        parse(parsed) {
            const match = parsed.pathname.match(/\/(detail|dp|v)\/([^/]+)/);
            if (!match || !match[2]) return null;
            return { contentId: match[2], mediaType: 'movie' };
        }
    },
    {
        id: 'ewtn',
        name: 'EWTN',
        appId: '186',
        domains: ['ewtn.com'],
        parse() {
            // EWTN deep links to live TV by default.
            return { contentId: 'live', mediaType: 'live' };
        }
    },
    {
        id: 'disney-plus',
        name: 'Disney+',
        appId: '291097',
        domains: ['disneyplus.com'],
        parse(parsed) {
            const m = parsed.pathname.match(/\/video\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
            if (!m) return null;
            // /video/ URLs don't distinguish movies from series; best-effort.
            return { contentId: m[1], mediaType: 'movie' };
        }
    },
    {
        id: 'hulu',
        name: 'Hulu',
        appId: '2285',
        domains: ['hulu.com'],
        parse(parsed) {
            const m = parsed.pathname.match(/\/(series|watch|movie)\/([^/]+)/);
            if (!m) return null;
            const seg = m[2];
            // Modern: trailing UUID, optionally slug-prefixed.
            const uuid = seg.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i);
            if (uuid) {
                return {
                    contentId: uuid[1],
                    mediaType: m[1] === 'movie' ? 'movie' : m[1] === 'series' ? 'series' : 'episode'
                };
            }
            // Legacy: numeric ID as its own path segment.
            if (/^\d+$/.test(seg)) return { contentId: seg, mediaType: 'episode' };
            return null;
        }
    },
    {
        id: 'max',
        name: 'Max',
        appId: '61322',
        domains: ['max.com', 'hbomax.com'],
        parse(parsed) {
            const m = parsed.pathname.match(/\/(movie|show)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
            if (!m) return null;
            return { contentId: m[2], mediaType: m[1] === 'movie' ? 'movie' : 'series' };
        }
    },
    {
        id: 'peacock',
        name: 'Peacock',
        appId: '593099',
        domains: ['peacocktv.com'],
        parse(parsed) {
            if (!parsed.pathname.includes('/episodes/')) return null;
            const m = parsed.pathname.match(/\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i);
            if (!m) return null;
            return { contentId: m[1], mediaType: 'episode' };
        }
    },
    {
        id: 'paramount-plus',
        name: 'Paramount+',
        appId: '31440',
        domains: ['paramountplus.com'],
        parse(parsed) {
            const m = parsed.pathname.match(/\/shows\/video\/([^/]+)/);
            if (!m) return null;
            return { contentId: m[1], mediaType: 'episode' };
        }
    },
    {
        id: 'apple-tv-plus',
        name: 'Apple TV+',
        appId: '551012',
        domains: ['tv.apple.com'],
        parse(parsed) {
            const m = parsed.pathname.match(/\/(show|movie)\/[^/]+\/(umc\.cmc\.[^/]+)/);
            if (!m) return null;
            // NOTE: the Roku Apple TV app ignores ECP deep-link params (launch-only).
            return { contentId: m[2], mediaType: m[1] === 'movie' ? 'movie' : 'series' };
        }
    },
    {
        id: 'tubi',
        name: 'Tubi',
        appId: '41468',
        domains: ['tubitv.com'],
        parse(parsed) {
            const m = parsed.pathname.match(/\/(movies|tv-shows|series)\/(\d+)/);
            if (!m) return null;
            return { contentId: m[2], mediaType: m[1] === 'movies' ? 'movie' : 'series' };
        }
    },
    {
        id: 'pluto-tv',
        name: 'Pluto TV',
        appId: '74519',
        domains: ['pluto.tv'],
        parse(parsed) {
            // Series/episode URLs carry 24-hex IDs; movie URLs are slug-only (no stable ID).
            const ep = parsed.pathname.match(/\/episode\/([0-9a-f]{24})/i);
            if (ep) return { contentId: ep[1], mediaType: 'episode' };
            const series = parsed.pathname.match(/\/series\/([0-9a-f]{24})/i);
            if (series) return { contentId: series[1], mediaType: 'series' };
            return null;
        }
    },
    {
        id: 'roku-channel',
        name: 'Roku Channel',
        appId: '151908',
        domains: ['therokuchannel.roku.com'],
        parse(parsed) {
            const m = parsed.pathname.match(/\/details\/([0-9a-f]{32})/i);
            if (!m) return null;
            // Details pages don't distinguish movies from series; best-effort.
            return { contentId: m[1], mediaType: 'movie' };
        }
    },
    {
        id: 'espn',
        name: 'ESPN',
        appId: '34376',
        domains: ['espn.com'],
        parse(parsed) {
            if (!parsed.pathname.includes('/watch/')) return null;
            const m = parsed.pathname.match(/\/id\/([^/]+)/);
            if (!m) return null;
            return { contentId: m[1], mediaType: 'episode' };
        }
    },
    {
        id: 'sling-tv',
        name: 'Sling TV',
        appId: '46041',
        domains: ['sling.com'],
        parse(parsed) {
            const id = parsed.searchParams.get('id');
            if (!id) return null;
            return { contentId: id, mediaType: 'episode' };
        }
    },
    {
        id: 'fubo',
        name: 'Fubo',
        appId: '43465',
        domains: ['fubo.tv'],
        parse(parsed) {
            const series = parsed.pathname.match(/\/welcome\/series\/(\d+)/);
            if (series) return { contentId: series[1], mediaType: 'series' };
            const program = parsed.pathname.match(/\/welcome\/program\/([^/]+)/);
            if (program) return { contentId: program[1], mediaType: 'episode' };
            return null;
        }
    },
    {
        id: 'plex',
        name: 'Plex',
        appId: '13535',
        domains: ['plex.tv'],
        parse(parsed) {
            // Only watch.plex.tv catalog links; personal-server (app.plex.tv)
            // rating keys are server-specific and won't deep-link reliably.
            if (parsed.hostname !== 'watch.plex.tv') return null;
            const m = parsed.pathname.match(/\/(movie|show)\/([^/]+)/);
            if (!m) return null;
            return { contentId: m[2], mediaType: m[1] === 'movie' ? 'movie' : 'series' };
        }
    },
    {
        id: 'fandango-at-home',
        name: 'Fandango at Home',
        appId: '13842',
        domains: ['athome.fandango.com', 'vudu.com'],
        parse(parsed) {
            const m = parsed.pathname.match(/\/details\/[^/]+\/(\d+)/);
            if (!m) return null;
            return { contentId: m[1], mediaType: 'movie' };
        }
    },
    {
        id: 'discovery-plus',
        name: 'Discovery+',
        appId: '593290',
        domains: ['discoveryplus.com'],
        parse(parsed) {
            const m = parsed.pathname.match(/\/shows\/[^/]+\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
            if (!m) return null;
            // Episode vs series is ambiguous here; best-effort.
            return { contentId: m[1], mediaType: 'series' };
        }
    },
    {
        id: 'starz',
        name: 'Starz',
        appId: '65067',
        domains: ['starz.com'],
        parse(parsed) {
            const m = parsed.pathname.match(/\/series\/[^/]+\/(?:season-\d+\/)?(?:episode-\d+\/)?(\d+)/);
            if (!m) return null;
            const isEpisode = /\/episode-\d+\//.test(parsed.pathname);
            return { contentId: m[1], mediaType: isEpisode ? 'episode' : 'series' };
        }
    },
    {
        id: 'philo',
        name: 'Philo',
        appId: '196460',
        domains: ['philo.com'],
        parse(parsed) {
            // Philo player URLs carry base64-encoded "Show:<id>" / "Episode:<id>" tokens.
            const decode = (s) => {
                try {
                    const num = Buffer.from(s, 'base64').toString('utf8').match(/:(\d+)/);
                    return num ? num[1] : null;
                } catch (e) { return null; }
            };
            const epParam = parsed.searchParams.get('episode');
            if (epParam) {
                const epId = decode(epParam);
                if (epId) return { contentId: epId, mediaType: 'episode' };
            }
            const showSeg = parsed.pathname.match(/\/show\/([^/]+)/);
            if (showSeg) {
                const showId = decode(showSeg[1]);
                if (showId) return { contentId: showId, mediaType: 'series' };
            }
            return null;
        }
    },
    {
        id: 'spotify',
        name: 'Spotify',
        appId: '22297',
        domains: ['open.spotify.com'],
        parse(parsed) {
            const m = parsed.pathname.match(/^\/(track|album|playlist|artist|episode|show)\/([A-Za-z0-9]+)/);
            if (!m) return null;
            // NOTE: 'music' is not an official ECP mediaType; the app may ignore deep-link params.
            return { contentId: `spotify:${m[1]}:${m[2]}`, mediaType: 'music' };
        }
    },
    {
        id: 'amc-plus',
        name: 'AMC+',
        appId: '636527',
        domains: ['amcplus.com'],
        parse(parsed) {
            // Observed format: /shows/<slug>--<numericId> (single-example verified).
            const m = parsed.pathname.match(/--(\d+)\/?$/);
            if (!m) return null;
            const isMovie = parsed.pathname.includes('/movies/');
            return { contentId: m[1], mediaType: isMovie ? 'movie' : 'series' };
        }
    }
];

// Find the service whose trusted domains match a parsed URL, or null.
function findService(parsed) {
    if (!parsed || !parsed.hostname) return null;
    return SERVICES.find(service =>
        service.domains.some(domain => hostMatches(parsed.hostname, domain))
    ) || null;
}

// Look up a service by its Roku ECP app ID, or null.
function getServiceByAppId(appId) {
    return SERVICES.find(service => service.appId === appId) || null;
}

// Public view of the registry for clients: identity only, no parsing logic.
function publicServices() {
    return SERVICES.map(({ id, name, appId }) => ({ id, name, appId }));
}

module.exports = { SERVICES, findService, getServiceByAppId, publicServices, hostMatches };
