function parseUrl(url) {
    // 1. YouTube
    // https://www.youtube.com/watch?v=Lt5LC71Ngus
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
        const videoId = url.includes('watch?v=') ? url.split('watch?v=')[1].split('&')[0] : url.split('youtu.be/')[1].split('?')[0];
        return {
            appId: '837',
            contentId: videoId,
            mediaType: 'shortFormVideo'
        };
    }

    // 2. Netflix
    // https://www.netflix.com/watch/81475311
    if (url.includes('netflix.com/watch/')) {
        const contentId = url.split('watch/')[1].split('?')[0];
        return {
            appId: '12',
            contentId: contentId,
            mediaType: 'movie'
        };
    }

    // 3. Amazon Prime Video
    // https://www.amazon.com/gp/video/detail/B00XXXXXXX
    if (url.includes('amazon.com') && url.includes('/detail/')) {
        const asin = url.split('/detail/')[1].split('/')[0].split('?')[0];
        return {
            appId: '13',
            contentId: asin,
            mediaType: 'movie'
        };
    }

    // 4. EWTN (Live Default)
    if (url.includes('ewtn.com')) {
        return {
            appId: '186',
            contentId: 'live',
            mediaType: 'live'
        };
    }

    return null;
}

module.exports = { parseUrl };
