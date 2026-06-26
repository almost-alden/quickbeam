function parseUrl(url) {
    if (!url || typeof url !== 'string') return null;

    try {
        const parsed = new URL(url);

        // 1. YouTube
        if (parsed.hostname.includes('youtube.com') || parsed.hostname.includes('youtu.be')) {
            let videoId = '';
            if (parsed.hostname.includes('youtu.be')) {
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

            if (videoId) {
                return {
                    appId: '837',
                    contentId: videoId,
                    mediaType: 'shortFormVideo'
                };
            }
        }

        // 2. Netflix
        if (parsed.hostname.includes('netflix.com')) {
            const match = parsed.pathname.match(/\/(watch|title)\/([^/]+)/);
            if (match && match[2]) {
                return {
                    appId: '12',
                    contentId: match[2],
                    mediaType: match[1] === 'watch' ? 'movie' : 'series'
                };
            }
        }

        // 3. Amazon Prime Video
        if (parsed.hostname.includes('amazon.com')) {
            const match = parsed.pathname.match(/\/(detail|dp|v)\/([^/]+)/);
            if (match && match[2]) {
                return {
                    appId: '13',
                    contentId: match[2],
                    mediaType: 'movie'
                };
            }
        }

        // 4. EWTN (Live Default)
        if (parsed.hostname.includes('ewtn.com')) {
            return {
                appId: '186',
                contentId: 'live',
                mediaType: 'live'
            };
        }
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

module.exports = { parseUrl, scrapeTitle };

