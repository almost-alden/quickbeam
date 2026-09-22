// No-PII / no-tracking assertions for every served page.
// The home test collects nothing: no contact fields, no analytics, no
// third-party scripts, no webfont imports. Beta wording must be present.
const fs = require('fs');
const path = require('path');

const PUBLIC = path.join(__dirname, '..', 'public');
const PAGES = ['index.html', 'share.html', 'send.html', 'magic.html', 'about.html', 'privacy.html', 'terms.html', 'support.html', 'test.html'];

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

describe('home-test data inventory & Spark honesty (docs + rules)', () => {
    const DOC = path.join(__dirname, '..', '..', 'docs', 'firebase-spark-launch.md');
    const doc = fs.readFileSync(DOC, 'utf8');
    const RULES = path.join(__dirname, '..', '..', 'firestore.rules');
    const rules = fs.readFileSync(RULES, 'utf8');
    const PROBE = fs.readFileSync(path.join(PUBLIC, 'js', 'roku-probe.js'), 'utf8');

    test('docs carry an exact data inventory with every collection and field', () => {
        expect(doc).toMatch(/Data inventory/);
        expect(doc).toMatch(/magic_links/);
        expect(doc).toMatch(/devices/);
        expect(doc).not.toMatch(/pairing_codes/); // gone: pairing is by link
        ['appId', 'contentId', 'mediaType', 'serviceName', 'videoTitle',
            'originalUrl', 'createdAt', 'expiresAt', 'localIp', 'deviceName']
            .forEach((f) => expect(doc).toContain(f));
    });

    test('docs name what is NOT collected: no contact/ZIP/signup/analytics/sender identity', () => {
        expect(doc).toMatch(/No contact, ZIP/i);
        expect(doc).toMatch(/signup/i);
        expect(doc).toMatch(/analytics/i);
        expect(doc).toMatch(/sender-identity/i);
    });

    test('docs state expired docs REMAIN STORED and cite the Spark pricing page', () => {
        expect(doc).toMatch(/remain stored/i);
        expect(doc).toMatch(/firebase\.google\.com\/docs\/firestore\/pricing/);
        expect(doc).not.toMatch(/TTL polic/i); // TTL deletes are not free on Spark
    });

    test('docs carry a test-only warning', () => {
        expect(doc).toMatch(/test-only/i);
    });

    test('no "nothing to leak" or "cross-user isolation" phrasing anywhere', () => {
        [doc, rules].forEach((text) => {
            expect(text).not.toMatch(/nothing to leak/i);
            expect(text).not.toMatch(/cross-user isolation/i);
        });
    });

    test('docs + probe label the HTTPS->LAN launch experimental (not verified)', () => {
        const mc = doc.split('## Mixed-content engineering')[1] || '';
        expect(mc).toMatch(/experimental/i);
        expect(mc).toMatch(/unverified on real/i);
        expect(PROBE).toMatch(/EXPERIMENTAL/);
    });
});
