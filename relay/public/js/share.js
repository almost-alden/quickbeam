// Share-target parsing for the Couchbeam home test (UMD).
//
// The Web Share Target API delivers shared content as GET query params
// (manifest.json: action "/share", params url/text/title). Android/ChromeOS
// frequently puts the shared URL in the `text` field — sometimes wrapped in
// surrounding prose ("Check this out https://..."). This module normalizes
// that, then parses the URL against the baked-in client service registry
// (window.QuickbeamRegistry, generated from relay/services.js).
//
// No network, no PII: pure functions. The caller decides what to do with the
// preview result (share.html renders it BEFORE any Couchbeam action).

(function () {
    'use strict';

    function getRegistry() {
        var r = (typeof globalThis !== 'undefined' && globalThis.QuickbeamRegistry) ||
            (typeof window !== 'undefined' && window.QuickbeamRegistry);
        if (!r) throw new Error('Couchbeam: service registry not loaded.');
        return r;
    }

    // Pull the first http(s) URL out of free text; strip trailing punctuation
    // that Android share sheets like to glue on (")", ".", ",", "!").
    function extractUrlFromText(text) {
        if (!text || typeof text !== 'string') return null;
        var m = text.match(/https?:\/\/[^\s<>"']+/i);
        if (!m) return null;
        return m[0].replace(/[.,!?;:)"'\]]+$/, '');
    }

    function looksLikeUrl(s) {
        if (!s || typeof s !== 'string') return false;
        try {
            var u = new URL(s.trim());
            return u.protocol === 'http:' || u.protocol === 'https:';
        } catch (e) {
            return false;
        }
    }

    // params: { url, text, title } from the share-target query string.
    // Returns the shared URL string, or null when nothing usable was shared.
    function extractSharedUrl(params) {
        params = params || {};
        if (looksLikeUrl(params.url)) return params.url.trim();
        var fromText = extractUrlFromText(params.text);
        if (fromText) return fromText;
        var fromTitle = extractUrlFromText(params.title);
        if (fromTitle) return fromTitle;
        return null;
    }

    // Mirror of the relay's parseUrl (relay/deeplink.js), client-side.
    // Returns { service, appId, contentId, mediaType, serviceName } or
    // { error: 'unsupported' | 'unparseable' | 'invalid-url' }.
    function parseSharedUrl(rawUrl) {
        if (!rawUrl || typeof rawUrl !== 'string') return { error: 'invalid-url' };
        var parsed;
        try {
            parsed = new URL(rawUrl.trim());
        } catch (e) {
            return { error: 'invalid-url' };
        }
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return { error: 'invalid-url' };
        }
        var registry = getRegistry();
        var service = registry.findService(parsed);
        if (!service) return { error: 'unsupported', url: parsed.href };
        var result;
        try {
            result = service.parse(parsed);
        } catch (e) {
            result = null;
        }
        if (!result || !result.contentId) return { error: 'unparseable', service: service, url: parsed.href };
        return {
            service: service,
            serviceName: service.name,
            appId: service.appId,
            contentId: result.contentId,
            mediaType: result.mediaType,
            url: parsed.href
        };
    }

    var api = {
        extractUrlFromText: extractUrlFromText,
        extractSharedUrl: extractSharedUrl,
        parseSharedUrl: parseSharedUrl
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    } else if (typeof window !== 'undefined') {
        window.QuickbeamShare = api;
    }
})();
