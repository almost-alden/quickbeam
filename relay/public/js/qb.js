// Couchbeam data layer for the home test (UMD).
//
// Two backends, one API:
//   1. The Node relay's /api/* endpoints when the pages are served by it
//      (home test on the local network) — tried first.
//   2. Firestore (Standard, Spark free quota) via the dependency-free REST
//      client when the pages are served statically (Firebase Hosting).
//
// Only falls back to Firestore when the /api endpoint is *absent* (network
// error or non-JSON response, e.g. the hosting 404 page) — a JSON error from
// the relay (unknown link, expired link) is respected, not retried.
//
// No PII is collected: magic-link docs carry no sender name or contact info.

(function () {
    'use strict';

    var MAGIC_LINK_TTL_MS = 24 * 60 * 60 * 1000; // 24h, mirrors relay LINK_TTL
    var PAIRING_CODE_TTL_MS = 60 * 60 * 1000;    // 1h

    function store() {
        var s = (typeof globalThis !== 'undefined' && globalThis.QuickbeamStore) ||
            (typeof window !== 'undefined' && window.QuickbeamStore);
        if (!s) throw new Error('Couchbeam: Firestore client (firestore-rest.js) not loaded.');
        return s;
    }

    function shareLib() {
        var s = (typeof globalThis !== 'undefined' && globalThis.QuickbeamShare) ||
            (typeof window !== 'undefined' && window.QuickbeamShare);
        if (!s) throw new Error('Couchbeam: share parser (share.js) not loaded.');
        return s;
    }

    function probeLib() {
        var p = (typeof globalThis !== 'undefined' && globalThis.QuickbeamProbe) ||
            (typeof window !== 'undefined' && window.QuickbeamProbe);
        return p || null;
    }

    function pageOrigin() {
        if (typeof window !== 'undefined' && window.location) return window.location.origin;
        return '';
    }

    function magicUrlFor(linkId) {
        return pageOrigin() + '/magic/' + linkId;
    }

    // Attempt a same-origin /api call. Resolves { api:true, status, data } when
    // the relay answered with JSON, or { api:false } when there is no relay
    // (static hosting) so the caller can fall back to Firestore.
    function apiFetch(path, opts) {
        if (typeof fetch === 'undefined') return Promise.resolve({ api: false });
        return fetch(path, opts).then(function (res) {
            var ct = res.headers.get('content-type') || '';
            if (ct.indexOf('application/json') === -1) return { api: false };
            return res.json().then(function (data) {
                return { api: true, status: res.status, data: data };
            });
        }).catch(function () { return { api: false }; });
    }

    function err(code, message) {
        var e = new Error(message || code);
        e.code = code;
        return e;
    }

    // --- Magic links ---

    function createMagicLink(input) {
        var url = (input && input.url) || '';
        var videoTitle = (input && input.videoTitle) || '';
        var parsed = shareLib().parseSharedUrl(url);
        if (parsed.error) return Promise.reject(err(parsed.error, 'This link is not supported yet.'));

        return apiFetch('/api/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: url, videoTitle: videoTitle })
        }).then(function (r) {
            if (r.api) {
                if (r.status === 200 || r.status === 201) {
                    return { linkId: r.data.linkId, magicUrl: r.data.relayUrl || magicUrlFor(r.data.linkId) };
                }
                throw err('create-failed', (r.data && r.data.error) || 'Could not create the link.');
            }
            // Static hosting: write the magic-link doc directly.
            var s = store();
            var now = new Date();
            var linkId = s.newMagicLinkId();
            var doc = {
                appId: parsed.appId,
                contentId: parsed.contentId,
                mediaType: parsed.mediaType,
                serviceName: parsed.serviceName,
                videoTitle: String(videoTitle).slice(0, 200),
                originalUrl: String(url).slice(0, 2048),
                createdAt: now,
                expiresAt: new Date(now.getTime() + MAGIC_LINK_TTL_MS)
            };
            return s.createDoc('magic_links', linkId, doc).then(function () {
                return { linkId: linkId, magicUrl: magicUrlFor(linkId) };
            });
        });
    }

    function getMagicLink(linkId) {
        return apiFetch('/api/resolve/' + encodeURIComponent(linkId)).then(function (r) {
            if (r.api) {
                if (r.status === 200) return r.data;
                return { error: (r.data && r.data.error) || 'not-found', status: r.status };
            }
            var s = store();
            return s.getDoc('magic_links', linkId).then(function (doc) {
                if (!doc) return { error: 'Link not found', status: 404 };
                if (doc.expiresAt && new Date(doc.expiresAt).getTime() < Date.now()) {
                    return { error: 'Link has expired', status: 410 };
                }
                // No public-IP device auto-detection on static hosting; the
                // recipient pairs by code or saved TV instead.
                doc.devices = [];
                doc.status = 'not_paired';
                return doc;
            });
        });
    }

    // --- Device registration & pairing codes ---

    function registerDevice(input) {
        var localIp = (input && input.localIp) || '';
        var deviceId = (input && input.deviceId) || '';
        var deviceName = (input && input.deviceName) || 'Roku TV';
        var probe = probeLib();
        if (probe && !probe.isPrivateIPv4(localIp)) {
            return Promise.reject(err('invalid-ip', 'That address is not a home-network (LAN) address.'));
        }
        var s = store();
        var pairingCode = s.newPairingCode();

        return apiFetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ localIp: localIp, deviceId: deviceId, deviceName: deviceName, pairingCode: pairingCode })
        }).then(function (r) {
            if (r.api) return { pairingCode: pairingCode };
            var now = new Date();
            return s.createDoc('devices', deviceId, {
                localIp: localIp,
                deviceName: String(deviceName).slice(0, 80),
                createdAt: now
            }).then(function () {
                return s.createDoc('pairing_codes', pairingCode, {
                    deviceId: deviceId,
                    createdAt: now,
                    expiresAt: new Date(now.getTime() + PAIRING_CODE_TTL_MS)
                });
            }).then(function () { return { pairingCode: pairingCode }; });
        });
    }

    function resolvePairingCode(code) {
        var normalized = String(code || '').trim().toUpperCase();
        return apiFetch('/api/resolve-code/' + encodeURIComponent(normalized)).then(function (r) {
            if (r.api) {
                if (r.data && r.data.status === 'paired' && r.data.device) {
                    return { localIp: r.data.device.localIp, deviceName: r.data.device.deviceName };
                }
                return { error: 'Pairing code not found or expired' };
            }
            var s = store();
            return s.getDoc('pairing_codes', normalized).then(function (claim) {
                if (!claim) return { error: 'Pairing code not found or expired' };
                if (claim.expiresAt && new Date(claim.expiresAt).getTime() < Date.now()) {
                    return { error: 'Pairing code not found or expired' };
                }
                return s.getDoc('devices', claim.deviceId).then(function (dev) {
                    if (!dev) return { error: 'Pairing code not found or expired' };
                    return { localIp: dev.localIp, deviceName: dev.deviceName };
                });
            });
        });
    }

    var api = {
        MAGIC_LINK_TTL_MS: MAGIC_LINK_TTL_MS,
        PAIRING_CODE_TTL_MS: PAIRING_CODE_TTL_MS,
        magicUrlFor: magicUrlFor,
        createMagicLink: createMagicLink,
        getMagicLink: getMagicLink,
        registerDevice: registerDevice,
        resolvePairingCode: resolvePairingCode
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    } else if (typeof window !== 'undefined') {
        window.Quickbeam = api;
    }
})();
