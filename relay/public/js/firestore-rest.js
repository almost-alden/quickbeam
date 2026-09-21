// Dependency-free Firestore REST client for the Couchbeam home test.
//
// Why REST instead of the Firebase JS SDK: the standing project rule forbids
// third-party scripts (no gstatic SDK bundles, no analytics). Firestore's
// REST API does everything v1 needs over plain fetch(), so every byte stays
// first-party. Security is enforced by firestore.rules, not by obscurity.
//
// Usage (browser): include firebase-config.js first, then this file.
//   CouchbeamStore.isConfigured()
//   await CouchbeamStore.createDoc('magic_links', id, { ... })
//   await CouchbeamStore.getDoc('magic_links', id)   // null when missing
//
// UMD: works in the browser (window.QuickbeamStore) and under Node (require).

(function () {
    'use strict';

    var BASE = 'https://firestore.googleapis.com/v1';

    function getConfig() {
        if (typeof window !== 'undefined' && window.QuickbeamConfig) return window.QuickbeamConfig;
        if (typeof globalThis !== 'undefined' && globalThis.QuickbeamConfig) return globalThis.QuickbeamConfig;
        return {};
    }

    function isConfigured() {
        var c = getConfig();
        return !!(c && c.projectId && c.apiKey &&
            c.projectId.indexOf('PLACEHOLDER') === -1 &&
            c.apiKey.indexOf('PLACEHOLDER') === -1);
    }

    function NotConfiguredError() {
        var e = new Error('Couchbeam: Firebase project is not configured yet (see docs/firebase-spark-launch.md).');
        e.name = 'NotConfiguredError';
        return e;
    }

    function requireConfigured() {
        if (!isConfigured()) throw NotConfiguredError();
        return getConfig();
    }

    // --- Firestore value codec (flat docs + nested objects/arrays) ---

    function encodeValue(v) {
        if (v === null || v === undefined) return { nullValue: null };
        if (v instanceof Date) return { timestampValue: v.toISOString() };
        if (typeof v === 'string') return { stringValue: v };
        if (typeof v === 'boolean') return { booleanValue: v };
        if (typeof v === 'number') {
            return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
        }
        if (Array.isArray(v)) return { arrayValue: { values: v.map(encodeValue) } };
        if (typeof v === 'object') {
            var fields = {};
            Object.keys(v).forEach(function (k) { fields[k] = encodeValue(v[k]); });
            return { mapValue: { fields: fields } };
        }
        throw new Error('Couchbeam: unsupported Firestore value type: ' + typeof v);
    }

    function decodeValue(wrapped) {
        if (!wrapped || typeof wrapped !== 'object') return null;
        if ('stringValue' in wrapped) return wrapped.stringValue;
        if ('integerValue' in wrapped) return parseInt(wrapped.integerValue, 10);
        if ('doubleValue' in wrapped) return wrapped.doubleValue;
        if ('booleanValue' in wrapped) return wrapped.booleanValue;
        if ('nullValue' in wrapped) return null;
        if ('timestampValue' in wrapped) return new Date(wrapped.timestampValue);
        if ('arrayValue' in wrapped) return (wrapped.arrayValue.values || []).map(decodeValue);
        if ('mapValue' in wrapped) {
            var out = {};
            var fields = wrapped.mapValue.fields || {};
            Object.keys(fields).forEach(function (k) { out[k] = decodeValue(fields[k]); });
            return out;
        }
        return null;
    }

    function decodeDoc(doc) {
        if (!doc || !doc.fields) return null;
        var out = { _id: doc.name ? doc.name.split('/').pop() : null };
        Object.keys(doc.fields).forEach(function (k) { out[k] = decodeValue(doc.fields[k]); });
        return out;
    }

    function docUrl(collection, docId) {
        var c = requireConfigured();
        return BASE + '/projects/' + encodeURIComponent(c.projectId) +
            '/databases/(default)/documents/' + encodeURIComponent(collection) +
            '/' + encodeURIComponent(docId) + '?key=' + encodeURIComponent(c.apiKey);
    }

    function collectionUrl(collection, docId) {
        var c = requireConfigured();
        var url = BASE + '/projects/' + encodeURIComponent(c.projectId) +
            '/databases/(default)/documents/' + encodeURIComponent(collection) +
            '?key=' + encodeURIComponent(c.apiKey);
        if (docId) url += '&documentId=' + encodeURIComponent(docId);
        return url;
    }

    function checkHttp(res) {
        if (res.status === 404) return null;
        if (!res.ok) {
            var err = new Error('Couchbeam: Firestore request failed (HTTP ' + res.status + ').');
            err.status = res.status;
            throw err;
        }
        return res;
    }

    // Create (or overwrite) a document with an explicit id.
    function createDoc(collection, docId, data) {
        var fields = {};
        Object.keys(data).forEach(function (k) { fields[k] = encodeValue(data[k]); });
        return fetch(collectionUrl(collection, docId), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields: fields })
        }).then(checkHttp).then(function () { return true; });
    }

    // Read one document by id. Resolves null when the document does not exist.
    // Never lists or queries: capability-URL reads only (matches firestore.rules).
    function getDoc(collection, docId) {
        return fetch(docUrl(collection, docId), { method: 'GET' })
            .then(checkHttp)
            .then(function (res) {
                if (res === null) return null;
                return res.json();
            })
            .then(function (json) { return decodeDoc(json); });
    }

    // --- Id generators ---

    // 128-bit crypto-random id, base64url (22 chars). Unguessable capability URLs.
    function newMagicLinkId() {
        var bytes = new Uint8Array(16);
        var cryptoObj = (typeof crypto !== 'undefined' && crypto.getRandomValues)
            ? crypto
            : (typeof require === 'function' ? require('crypto').webcrypto : null);
        cryptoObj.getRandomValues(bytes);
        var bin = '';
        bytes.forEach(function (b) { bin += String.fromCharCode(b); });
        var b64 = typeof btoa === 'function' ? btoa(bin) : Buffer.from(bin, 'binary').toString('base64');
        return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    // 6-char pairing code, unambiguous alphabet (no 0/O, 1/I/L).
    function newPairingCode() {
        var alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
        var bytes = new Uint8Array(6);
        var cryptoObj = (typeof crypto !== 'undefined' && crypto.getRandomValues)
            ? crypto
            : (typeof require === 'function' ? require('crypto').webcrypto : null);
        cryptoObj.getRandomValues(bytes);
        var out = '';
        bytes.forEach(function (b) { out += alphabet[b % alphabet.length]; });
        return out;
    }

    var api = {
        isConfigured: isConfigured,
        NotConfiguredError: NotConfiguredError,
        encodeValue: encodeValue,
        decodeValue: decodeValue,
        decodeDoc: decodeDoc,
        docUrl: docUrl,
        collectionUrl: collectionUrl,
        createDoc: createDoc,
        getDoc: getDoc,
        newMagicLinkId: newMagicLinkId,
        newPairingCode: newPairingCode
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    } else if (typeof window !== 'undefined') {
        window.QuickbeamStore = api;
    }
})();
