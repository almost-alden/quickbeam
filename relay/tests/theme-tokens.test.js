// theme-tokens.test.js: Couchdrop warm visual direction regression guard.
//
// The six rethemed pages (send, magic, about, support, privacy, terms) must
// stay on the warm Couchdrop palette. This test FAILS if any of them
// reintroduces the old Quickbeam black/purple theme tokens (#0b0f19, #8b5cf6,
// purple/pink gradients). Semantic error/success/warning colors are allowed.

const fs = require('fs');
const path = require('path');

const PUBLIC = path.join(__dirname, '..', 'public');
const RETHEMED = ['send.html', 'magic.html', 'about.html', 'support.html',
    'privacy.html', 'terms.html'];

// Old-theme tokens that must never come back on the rethemed pages.
const BANNED = [
    '#0b0f19',                       // old page background
    '#8b5cf6',                       // old primary purple
    '#7c3aed',                       // old primary hover
    '#6366f1', '#a5b4fc', '#c084fc', // old gradient stops
    '#ec4899',                       // old pink gradient stop
    'rgba(139, 92, 246', 'rgba(139,92,246',   // old purple glow
    'rgba(99, 102, 241', 'rgba(99,102,241',   // old indigo wash
];

// Gradient usage is banned only when it carries the old purple/pink stops;
// blue brand gradients and semantic tints are fine. radial-gradient body
// washes were part of the old theme and must stay gone.
const BANNED_PATTERNS = [
    /linear-gradient\([^)]*#[0-9a-f]{6}[^)]*\)/i, // any hex-stop gradient
    /radial-gradient\(/i,
];

const WARM_TOKENS = ['#f7f4ee', '#101828', '#2e7cf6'];

function read(file) {
    return fs.readFileSync(path.join(PUBLIC, file), 'utf8');
}

describe('Couchdrop warm theme regression guard', () => {
    for (const file of RETHEMED) {
        describe(file, () => {
            let html;
            beforeAll(() => { html = read(file); });

            test('has no banned old-theme tokens', () => {
                for (const token of BANNED) {
                    expect(html.toLowerCase()).not.toContain(token);
                }
            });

            test('has no old-theme gradients', () => {
                for (const pattern of BANNED_PATTERNS) {
                    expect(html).not.toMatch(pattern);
                }
            });

            test('uses the warm theme-color', () => {
                expect(html).toContain(
                    '<meta name="theme-color" content="#f7f4ee">');
            });

            test('declares the warm palette tokens', () => {
                for (const token of WARM_TOKENS) {
                    expect(html).toContain(token);
                }
            });

            test('keeps visible focus states', () => {
                expect(html).toContain(':focus-visible');
            });

            test('has no Google Fonts or third-party assets', () => {
                expect(html).not.toMatch(/fonts\.googleapis\.com/i);
                expect(html).not.toMatch(/fonts\.gstatic\.com/i);
            });
        });
    }

    test('semantic state colors are still allowed', () => {
        // Sanity: the guard targets the old purple theme, not the
        // error/success/warning colors pages need for visible states.
        const send = read('send.html');
        expect(send).toMatch(/#a12020|--error-text/);
        expect(send).toMatch(/#0c6b2a|--success-text/);
    });
});
