// Couchbeam "Quick Send to Contact" for the static (Firebase Hosting) model.
//
// Contact model: { name, phone, email }. Contacts are a plain address book —
// a saved contact stores NO pairing capability links and NO TV bindings.
// Sending to a contact creates an ordinary magic link; the recipient opens it
// on their own phone and pairs/chooses their own TV. Storing a pairing
// capability that has no operational effect would be misleading, so legacy
// fields (6-digit `code`, pairing links, device names) are dropped on load
// rather than retained. Contacts stay in this device's localStorage
// ('quickbeam_contacts'); nothing is uploaded, logged, or sent anywhere
// except the sender's own SMS/email app.
//
// Exposes window.QuickbeamSendContacts in the browser and module.exports
// under Node so Jest can test the model and the quick-send flow (with
// window.Quickbeam mocked).

(function () {
    'use strict';

    var STORAGE_KEY = 'quickbeam_contacts';

    function storage() {
        try {
            if (typeof localStorage !== 'undefined') return localStorage;
        } catch (e) { /* private mode etc. */ }
        return null;
    }

    // Normalize a stored contact to the honest { name, phone, email } model.
    // Legacy fields from older models — the 6-digit `code`, pairingLink,
    // deviceName, needsRepair — are dropped entirely: they have no
    // operational effect on sending, so retaining them would be misleading.
    function normalizeContact(raw) {
        var r = raw || {};
        return {
            name: String(r.name || '').trim(),
            phone: String(r.phone || '').trim(),
            email: String(r.email || '').trim()
        };
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

    // Persist contacts, normalizing first so no legacy/pairing field can ever
    // be written to storage even if a caller passes one in.
    function saveContactsList(contacts) {
        var s = storage();
        if (s) s.setItem(STORAGE_KEY, JSON.stringify((contacts || []).map(normalizeContact)));
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
                    // Honest wording: the recipient opens the link on their
                    // phone and pairs their own TV. Phone-to-Roku launching is
                    // experimental/unverified — never promise an instant launch.
                    var body = senderName + ' sent you a video link! Open it on your phone (same Wi-Fi as your TV) to pair your TV and watch: ' + magicUrl;
                    var route;
                    if (contact.phone) {
                        route = { type: 'sms', phone: contact.phone, body: body };
                    } else if (contact.email) {
                        route = { type: 'mailto', email: contact.email, subject: 'Couchbeam video link', body: body };
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
        normalizeContact: normalizeContact,
        getContacts: getContacts,
        saveContactsList: saveContactsList,
        prepareQuickSend: prepareQuickSend
    };

    if (typeof window !== 'undefined') { window.QuickbeamSendContacts = api; }
    if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
})();
