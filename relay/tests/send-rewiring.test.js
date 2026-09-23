// send-rewiring.test.js: /send must not call any dead backend routes.
//
// The static (Firebase Hosting) model has no backend: every old relay
// endpoint referenced by send.html (/api/create, /api/status,
// /api/service-request, /api/resolve-code/...) is dead. This suite FAILS if
// send.html references any /api/ route, still carries the old six-digit-code
// pairing flow, or loses its client-side Quickbeam (qb.js) wiring.

const fs = require('fs');
const path = require('path');

const SEND = path.join(__dirname, '..', 'public', 'send.html');

function read() {
    return fs.readFileSync(SEND, 'utf8');
}

describe('/send dead-route rewiring', () => {
    let html;
    beforeAll(() => { html = read(); });

    test('references no /api/ routes at all', () => {
        expect(html).not.toContain('/api/');
    });

    test('never calls fetch() against a backend', () => {
        expect(html).not.toMatch(/fetch\s*\(/);
    });

    test('Create Magic Link goes through Quickbeam.createMagicLink', () => {
        expect(html).toContain('Quickbeam.createMagicLink');
        expect(html).toContain('onclick="generateLink()"');
    });

    test('link status polls Quickbeam.getMagicLink', () => {
        expect(html).toContain('Quickbeam.getMagicLink');
        expect(html).toContain('refreshLinkStatus()');
    });

    test('device manager registers via Quickbeam.registerDevice + pairingLinkFor', () => {
        expect(html).toContain('Quickbeam.registerDevice');
        expect(html).toContain('Quickbeam.pairingLinkFor');
        expect(html).toContain('registerSenderTv()');
        expect(html).toContain('id="senderPairingLinkBox"');
    });

    test('the dead six-digit pairing-code flow is gone', () => {
        expect(html).not.toContain('pairWithCode');
        expect(html).not.toContain('senderPairCode');
        expect(html).not.toContain('getSenderDefaultPairingCode');
        expect(html).not.toContain('6-Digit TV Code');
        expect(html).not.toContain('resolve-code');
    });

    test('service request is client-side (pre-filled issue + copy), not a POST', () => {
        expect(html).toContain('service-request-panel');
        expect(html).toContain('issues/new?title=');
        expect(html).toContain('Copy request text');
    });

    test('contacts, tutorial, and result UI survive the rewiring', () => {
        expect(html).toContain('id="contacts-container"');
        expect(html).toContain('id="tutorial-modal"');
        expect(html).toContain('id="result"');
        expect(html).toContain('id="outputLink"');
        expect(html).toContain('onclick="copyLink()"');
    });

    test('warm theme-color is intact', () => {
        expect(html).toContain('<meta name="theme-color" content="#f7f4ee">');
    });
});
