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

module.exports = { parseUrl };

