// No-PII / no-tracking assertions for every served page.
// The home test collects nothing: no contact fields, no analytics, no
// third-party scripts, no webfont imports. Beta wording must be present.
const fs = require('fs');
const path = require('path');

const PUBLIC = path.join(__dirname, '..', 'public');
const PAGES = ['index.html', 'share.html', 'send.html', 'magic.html', 'about.html', 'privacy.html', 'terms.html', 'support.html'];

function read(page) {
    return fs.readFileSync(path.join(PUBLIC, page), 'utf8');
}

describe.each(PAGES)('%s', (page) => {
    const html = read(page);

    test('loads no Google Fonts or other webfont imports', () => {
        expect(html).not.toMatch(/fonts\.googleapis\.com/);
        expect(html).not.toMatch(/fonts\.gstatic\.com/);
        expect(html).not.toMatch(/@import\s+url\(['"]?https?:/);
    });

    test('contains no analytics, trackers, or third-party scripts', () => {
        expect(html).not.toMatch(/googletagmanager/i);
        expect(html).not.toMatch(/google-analytics/i);
        expect(html).not.toMatch(/fbevents|fbq\(/i);
        expect(html).not.toMatch(/<script[^>]+src="https?:\/\//i);
        expect(html).not.toMatch(/<img[^>]+src="https?:\/\//i);
    });

    test('collects no contact info or identifiers (home-test surface)', () => {
        // Scoped to the new home-test surface. support.html keeps its
        // pre-existing support form, which posts to the Node relay's
        // /api/support and is out of scope for the static home test.
        if (!['index.html', 'share.html'].includes(page)) return;
        expect(html).not.toMatch(/type=["']email["']/i);
        expect(html).not.toMatch(/type=["']tel["']/i);
        expect(html).not.toMatch(/name=["']zip/i);
        expect(html).not.toMatch(/autocomplete=["']email["']/i);
    });
});

describe('beta honesty wording', () => {
    test.each(['index.html', 'share.html'])('%s carries all four beta wordings', (page) => {
        const html = read(page);
        expect(html).toMatch(/free demo/i);                    // 1. free demo
        expect(html).toMatch(/experimental/i);                // 2. experimental compatibility
        expect(html).toMatch(/same[^<.]{0,40}wi-?fi/i);       // 3. same-home-Wi-Fi requirement
        expect(html).toMatch(/can't (guarantee|promise) every|can’t (guarantee|promise) every|no guar\w* every/i); // 4. no deep-link guarantees
    });

    test('share.html is honest about iOS share-sheet limits', () => {
        const html = read('share.html');
        expect(html).toMatch(/iOS does.*not.*share sheet/i);
        expect(html).toMatch(/Shortcut/i);
    });

    test('landing never uses the Couchdrop name in product copy', () => {
        expect(read('index.html')).not.toMatch(/couchdrop/i);
        expect(read('share.html')).not.toMatch(/couchdrop/i);
    });

    test('landing uses the Couchbeam name', () => {
        expect(read('index.html')).toMatch(/Couchbeam/);
    });
});
