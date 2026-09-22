// Couchbeam "Quick Send to Contact" for the static (Firebase Hosting) model.
//
// Contact model: { name, phone, email, pairingLink, deviceName }.
// Pairing is a capability LINK (/magic.html?pair=<unguessable id>), never a
// typed code — the old 6-digit TV codes are not accepted anymore. Contacts
// stay in this device's localStorage ('quickbeam_contacts'); nothing is
// uploaded, logged, or sent anywhere except the sender's own SMS/email app.
//
// Exposes window.QuickbeamSendContacts in the browser and module.exports
// under Node so Jest can test the model, the pairing-link parsing, and the
// quick-send flow (with window.Quickbeam mocked).

(function () {
    'use strict';

    var STORAGE_KEY = 'quickbeam_contacts';

    function storage() {
        try {
            if (typeof localStorage !== 'undefined') return localStorage;
        } catch (e) { /* private mode etc. */ }
        return null;
    }

    // Extract the pairing token from a pasted pairing link (?pair=<token>),
    // or accept a raw token. Returns '' when the text is not a pairing link.
    function extractPairingToken(text) {
        var t = String(text || '').trim();
        if (!t) return '';
        var m = t.match(/[?&]pair=([^&#\s]+)/);
        if (m) {
            try { return decodeURIComponent(m[1]); } catch (e) { return m[1]; }
        }
        if (/^[A-Za-z0-9_-]{16,}$/.test(t)) return t;
        return '';
    }

    // Normalize a stored contact. Legacy contacts saved with a 6-digit `code`
    // (old relay pairing model) are kept but flagged needsRepair: their card
    // shows a re-pair hint instead of failing silently.
    function normalizeContact(raw) {
        var r = raw || {};
        var c = {
            name: String(r.name || '').trim(),
            phone: String(r.phone || '').trim(),
            email: String(r.email || '').trim(),
            pairingLink: String(r.pairingLink || '').trim(),
            deviceName: String(r.deviceName || '').trim()
        };
        if (r.code && !c.pairingLink) c.needsRepair = true;
        return c;
    }

    function getContacts() {
        var s = storage();
        if (!s) return [];
        try {
            return (JSON.parse(s.getItem(STORAGE_KEY)) || []).map(normalizeContact);
        } catch (e) {
            return [];
        }
    }

    function saveContactsList(contacts) {
        var s = storage();
        if (s) s.setItem(STORAGE_KEY, JSON.stringify(contacts));
    }

    // Validate a pasted pairing link against the data layer. Resolves with
    // { deviceName }; rejects with a user-facing Error.
    function validatePairingLink(qb, pairingLink) {
        var token = extractPairingToken(pairingLink);
        if (!token) {
            return Promise.reject(new Error(
                'That does not look like a Couchbeam pairing link. Paste the full pairing link from the TV.'));
        }
        return Promise.resolve()
            .then(function () { return qb.resolvePairingToken(token); })
            .then(function (r) {
                if (!r || r.error) {
                    throw new Error('Pairing link not found or expired. Ask for a fresh pairing link from the TV.');
                }
                return { deviceName: String(r.deviceName || 'Roku TV') };
            });
    }

    // Core of "quick send": create the magic link, copy it to the clipboard,
    // then decide how to route it to the contact. DOM actions (showing the
    // result box, opening sms:/mailto:, navigator.share) stay in send.html;
    // this returns { magicUrl, route } where route is one of:
    //   { type:'sms', phone, body } | { type:'mailto', email, subject, body } |
    //   { type:'manual', name, body }
    function prepareQuickSend(deps, input) {
        var qb = deps.qb;
        var clipboard = deps.clipboard || null;
        var contact = normalizeContact(input.contact);
        var url = String(input.url || '').trim();
        var videoTitle = String(input.videoTitle || '').trim();
        var senderName = String(input.senderName || '').trim() || 'Your friend';
        if (!url) return Promise.reject(new Error('Please paste a Video URL first.'));
        return Promise.resolve()
            .then(function () { return qb.createMagicLink({ url: url, videoTitle: videoTitle }); })
            .then(function (res) {
                var magicUrl = res.magicUrl;
                var copy = Promise.resolve();
                if (clipboard && typeof clipboard.writeText === 'function') {
                    copy = Promise.resolve()
                        .then(function () { return clipboard.writeText(magicUrl); })
                        .catch(function () { /* clipboard is best-effort */ });
                }
                return copy.then(function () {
                    var body = senderName + ' sent you a video link! Open this to cast it onto your TV: ' + magicUrl;
                    var route;
                    if (contact.phone) {
                        route = { type: 'sms', phone: contact.phone, body: body };
                    } else if (contact.email) {
                        route = { type: 'mailto', email: contact.email, subject: 'Couchbeam Cast \u26a1\ufe0f', body: body };
                    } else {
                        route = { type: 'manual', name: contact.name, body: body };
                    }
                    return { magicUrl: magicUrl, route: route };
                });
            })
            .catch(function (e) {
                throw new Error('Error: ' + ((e && e.message) || 'Unknown error'));
            });
    }

    var api = {
        STORAGE_KEY: STORAGE_KEY,
        extractPairingToken: extractPairingToken,
        normalizeContact: normalizeContact,
        getContacts: getContacts,
        saveContactsList: saveContactsList,
        validatePairingLink: validatePairingLink,
        prepareQuickSend: prepareQuickSend
    };

    if (typeof window !== 'undefined') { window.QuickbeamSendContacts = api; }
    if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
})();
