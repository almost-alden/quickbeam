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

function hostMatches(hostname, domain) {
    // Exact-or-suffix match only: prevents lookalike hostnames such as
    // youtube.com.evil.com from being classified as the trusted domain.
    return hostname === domain || hostname.endsWith('.' + domain);
}

const SERVICES = [
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
