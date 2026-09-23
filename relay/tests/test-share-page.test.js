// test-share-page.test.js: the deep-link sharing test page.
//
// Guards for relay/public/test-share.html:
// - built-in links are honestly labeled (never claimed verified on Roku)
// - no invented native URL schemes
// - tester submissions stay in localStorage (no server, no fetch)
// - every library entry comes from a harness card that actually has a URL
// - the page exercises the real flow: registry parser + Quickbeam.createMagicLink

const fs = require('fs');
const path = require('path');

const PAGE = path.join(__dirname, '..', 'public', 'test-share.html');
const HONESTY_LABEL = 'example/parser fixture — not verified on Roku';

function read() {
    return fs.readFileSync(PAGE, 'utf8');
}

describe('test-share page', () => {
    let html;
    beforeAll(() => { html = read(); });

    test('page exists and is beta-only (noindex)', () => {
        expect(html).toContain('<meta name="robots" content="noindex, nofollow">');
        expect(html).toContain('beta testers only');
    });

    test('every built-in link carries the honesty label', () => {
        expect(html).toContain('HONESTY_LABEL');
        expect(html).toContain(HONESTY_LABEL);
        // The label string is the one rendered for each built-in card.
        expect(html).toContain("entry.builtin ? HONESTY_LABEL");
    });

    test('invents no native URL schemes', () => {
        for (const scheme of ['roku://', 'couchbeam://', 'quickbeam://']) {
            expect(html.toLowerCase()).not.toContain(scheme);
        }
        // Custom-link form only accepts http(s) URLs.
        expect(html).toContain('/^https?:\\/\\//');
    });

    test('tester submissions are localStorage-only (no fetch, no server)', () => {
        expect(html).toContain('quickbeam_testshare_custom');
        expect(html).toContain('localStorage');
        expect(html).not.toMatch(/fetch\s*\(/);
        expect(html).not.toContain('/api/');
    });

    test('loads the real flow: registry, parser, harness data, Quickbeam', () => {
        for (const script of ['registry-client.js', 'share.js', 'test-harness-data.js', 'qb.js']) {
            expect(html).toContain('/js/' + script);
        }
        expect(html).toContain('QuickbeamShare.parseSharedUrl');
        expect(html).toContain('Quickbeam.createMagicLink');
    });

    test('never claims Couchbeam sends texts', () => {
        expect(html.toLowerCase()).not.toMatch(/couchbeam (sends|sends you|will send|texts)/);
        expect(html).toContain('never sends texts');
    });

    test('keeps experimental/unverified wording', () => {
        expect(html.toLowerCase()).toContain('experimental');
        expect(html.toLowerCase()).toContain('unverified on real hardware');
    });

    test('warm theme-color is present', () => {
        expect(html).toContain('<meta name="theme-color" content="#f7f4ee">');
    });

    test('is linked from the test harness', () => {
        const harness = fs.readFileSync(
            path.join(__dirname, '..', 'public', 'test.html'), 'utf8');
        expect(harness).toContain('/test-share.html');
    });
});

describe('test-share link library data', () => {
    const data = require('../public/js/test-harness-data.js');

    test('every harness card has a URL the library can use', () => {
        for (const card of data.CARDS) {
            const url = card.liveUrl || card.fixtureUrl;
            expect(typeof url).toBe('string');
            expect(url.length).toBeGreaterThan(0);
            expect(url).toMatch(/^https?:\/\//);
        }
    });

    test('library covers all 24 registry services', () => {
        expect(data.CARDS).toHaveLength(24);
    });
});
