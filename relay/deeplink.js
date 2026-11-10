const { findService, hostMatches } = require('./services');

// parseUrl dispatches to the service registry (services.js): the URL's host
// selects the service, and the service's own parse() extracts the deep-link
// payload. Adding a service is a registry-only change.
function parseUrl(url) {
    if (!url || typeof url !== 'string') return null;

    try {
        const parsed = new URL(url);
        const service = findService(parsed);
        if (!service) return null;

        const result = service.parse(parsed);
        if (!result) return null;

        return {
            appId: service.appId,
            contentId: result.contentId,
            mediaType: result.mediaType
        };
    } catch (e) {
        // Handle invalid URL formats gracefully
    }

    return null;
}

function decodeHtmlEntities(str) {
    if (!str) return '';
    return str
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&#x2F;/g, '/');
}

async function scrapeTitle(url) {
    if (!url || typeof url !== 'string') return '';
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000); // 4 second timeout
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
            },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) return '';
        
        const html = await response.text();
        
        // 1. Try og:title meta tag
        const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
                             html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
        if (ogTitleMatch && ogTitleMatch[1]) {
            return decodeHtmlEntities(ogTitleMatch[1].trim());
        }
        
        // 2. Fallback to standard <title> tag
        const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
        if (titleMatch && titleMatch[1]) {
            return decodeHtmlEntities(titleMatch[1].trim());
        }
    } catch (e) {
        console.error(`[Scraper] Failed to fetch title for ${url}:`, e.message);
    }
    return '';
}

module.exports = { parseUrl, scrapeTitle, decodeHtmlEntities };

