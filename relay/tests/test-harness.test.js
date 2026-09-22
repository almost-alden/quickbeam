// Couchbeam streaming-service test harness.
// - Harness card list must never diverge from relay/services.js (single source of truth).
// - State labels are honest: exactly one of the three allowed labels, with the
//   known facts applied (Apple TV+ app-launch-only, Spotify experimental,
//   Pluto movie links and Plex personal-server links unsupported).
// - Result capture is local-only: no network APIs anywhere in the harness code,
//   and the record fields contain nothing PII-shaped.
// - Export builders produce a versioned schema with a timestamp and no hidden IDs.

const fs = require('fs');
const path = require('path');

const { SERVICES } = require('../services');
const DATA = require('../public/js/test-harness-data.js');
const H = require('../public/js/test-harness.js');

const JS_DIR = path.join(__dirname, '..', 'public', 'js');
const HARNESS_SRC = fs.readFileSync(path.join(JS_DIR, 'test-harness.js'), 'utf8');
const HARNESS_DATA_SRC = fs.readFileSync(path.join(JS_DIR, 'test-harness-data.js'), 'utf8');
const HARNESS_HTML = fs.readFileSync(path.join(__dirname, '..', 'public', 'test.html'), 'utf8');

describe('harness data diverges from registry', () => {
    test('every registry service has exactly one harness card', () => {
        expect(DATA.CARDS.length).toBe(SERVICES.length);
        for (const s of SERVICES) {
            expect(DATA.cardById(s.id)).not.toBeNull();
        }
    });

    test('every harness card maps to a real registry service, ids unique', () => {
        const ids = new Set(SERVICES.map((s) => s.id));
        const seen = new Set();
        for (const c of DATA.CARDS) {
            expect(ids.has(c.id)).toBe(true);
            expect(seen.has(c.id)).toBe(false);
            seen.add(c.id);
        }
    });

    test('cards carry all required fields with https links', () => {
        for (const c of DATA.CARDS) {
            for (const f of ['state', 'support', 'extracts', 'homeUrl', 'fixtureUrl', 'note']) {
                expect(typeof c[f]).toBe('string');
                expect(c[f].length).toBeGreaterThan(0);
            }
            expect(c.homeUrl).toMatch(/^https:\/\//);
            expect(c.fixtureUrl).toMatch(/^https:\/\//);
            if (c.searchUrl) expect(c.searchUrl).toMatch(/^https:\/\//);
        }
    });
});

describe('honest state labels', () => {
    test('state is exactly one of the three allowed labels', () => {
        expect(DATA.VALID_STATES).toEqual(['deep-link-candidate', 'app-launch-only', 'needs-validation']);
        for (const c of DATA.CARDS) {
            expect(DATA.VALID_STATES).toContain(c.state);
        }
    });

    test('Apple TV+ is app-launch-only (Roku app ignores ECP content params)', () => {
        const c = DATA.cardById('apple-tv-plus');
        expect(c.state).toBe('app-launch-only');
        expect(c.support).toMatch(/app launch only/i);
        expect(c.note).toMatch(/ignores ECP/i);
    });

    test('Spotify is flagged experimental (unofficial mediaType)', () => {
        const c = DATA.cardById('spotify');
        expect(c.experimental).toBe(true);
        expect(c.support).toMatch(/experimental/i);
        expect(c.extracts).toMatch(/unofficial/i);
    });

    test('Pluto TV card discloses that movie deep links are unsupported', () => {
        expect(DATA.cardById('pluto-tv').note).toMatch(/movie.*unsupported/i);
    });

    test('Plex card discloses that personal-server links are unsupported', () => {
        expect(DATA.cardById('plex').note).toMatch(/personal-server.*unsupported/i);
    });

    test('no card claims a verified or observed app deep link', () => {
        expect(HARNESS_DATA_SRC).not.toMatch(/verified deep link/i);
        expect(HARNESS_DATA_SRC).not.toMatch(/observed to open/i);
        expect(HARNESS_HTML).not.toMatch(/verified deep link/i);
    });

    test('every card offers the official home fallback (needs-live-link honesty)', () => {
        for (const c of DATA.CARDS) {
            expect(c.homeUrl).toMatch(/^https:\/\//);
        }
        expect(HARNESS_HTML).toMatch(/needs live link/i);
    });
});

describe('local-only result capture (no backend, no network)', () => {
    const SOURCES = [HARNESS_SRC, HARNESS_DATA_SRC, HARNESS_HTML];

    test.each(['fetch(', 'XMLHttpRequest', 'sendBeacon', 'EventSource', 'new WebSocket'])(
        'harness code contains no %s',
        (api) => {
            for (const src of SOURCES) {
                expect(src).not.toContain(api);
            }
        }
    );

    test('test.html loads no remote scripts, images, or stylesheets', () => {
        expect(HARNESS_HTML).not.toMatch(/<script[^>]+src="https?:\/\//i);
        expect(HARNESS_HTML).not.toMatch(/<img[^>]+src="https?:\/\//i);
        expect(HARNESS_HTML).not.toMatch(/<link[^>]+href="https?:\/\//i);
    });

    test('record fields are exactly the spec allowlist — nothing PII-shaped', () => {
        expect(H.RECORD_FIELDS).toEqual([
            'service', 'sourceOpen', 'parseResult', 'rokuResult',
            'platform', 'rokuModel', 'note'
        ]);
        for (const src of [HARNESS_SRC]) {
            expect(src).not.toMatch(/localIp/i);
            expect(src).not.toMatch(/ipAddress/i);
            expect(src).not.toMatch(/pairing/i);
            expect(src).not.toMatch(/fingerprint/i);
            expect(src).not.toMatch(/analytics/i);
        }
    });

    test('result choices are closed vocabularies', () => {
        expect(H.RESULT_CHOICES.sourceOpen).toEqual(['not-tested', 'opened-app', 'opened-browser', 'failed']);
        expect(H.RESULT_CHOICES.parseResult).toEqual(['not-tested', 'matched', 'no-match', 'parser-error']);
        expect(H.RESULT_CHOICES.rokuResult).toEqual(['not-tested', 'played', 'app-launched', 'failed', 'not-attempted']);
    });

    test('validateRecord rejects bad values and requires a service', () => {
        expect(H.validateRecord(null).length).toBeGreaterThan(0);
        expect(H.validateRecord({ service: '' }).length).toBeGreaterThan(0);
        const good = {
            service: 'youtube', sourceOpen: 'opened-app',
            parseResult: 'matched', rokuResult: 'not-attempted'
        };
        expect(H.validateRecord(good)).toEqual([]);
        expect(H.validateRecord({ ...good, rokuResult: 'bogus' }).length).toBeGreaterThan(0);
    });

    test('localStorage round-trip stores and resets (mocked)', () => {
        const mem = {};
        const fake = {
            getItem: (k) => (k in mem ? mem[k] : null),
            setItem: (k, v) => { mem[k] = String(v); },
            removeItem: (k) => { delete mem[k]; }
        };
        const real = global.localStorage;
        global.localStorage = fake;
        try {
            expect(H.loadResults()).toEqual({});
            const rec = H.setRecord('youtube', {
                service: 'youtube', sourceOpen: 'opened-app',
                parseResult: 'matched', rokuResult: 'played',
                platform: 'Android 15 · Chrome', rokuModel: '', note: 'worked'
            });
            expect(rec.service).toBe('youtube');
            expect(rec.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
            expect(H.loadResults().youtube.rokuResult).toBe('played');
            expect(H.isTested(H.loadResults().youtube)).toBe(true);
            expect(H.isTested(H.blankRecord('netflix'))).toBe(false);
            H.resetResults();
            expect(H.loadResults()).toEqual({});
        } finally {
            if (real === undefined) delete global.localStorage;
            else global.localStorage = real;
        }
    });

    test('loadResults survives corrupt storage', () => {
        const real = global.localStorage;
        global.localStorage = { getItem: () => '{not json', setItem: () => {}, removeItem: () => {} };
        try {
            expect(H.loadResults()).toEqual({});
        } finally {
            if (real === undefined) delete global.localStorage;
            else global.localStorage = real;
        }
    });
});

describe('export schema', () => {
    const metas = SERVICES.map((s) => ({ id: s.id, name: s.name }));

    test('buildReport carries schema, timestamp, and one row per service', () => {
        const report = H.buildReport({}, metas);
        expect(report.schema).toBe('couchbeam-test-report/1.0');
        expect(report.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        expect(report.results.length).toBe(24);
        expect(report.results[0].service).toBe('youtube-tv');
        // No hidden IDs: the only identifiers are the public registry ids.
        for (const r of report.results) {
            expect(Object.keys(r).sort()).toEqual(
                ['name', 'note', 'parseResult', 'platform', 'rokuModel', 'rokuResult', 'service', 'sourceOpen', 'updatedAt'].sort()
            );
        }
    });

    test('toCSV has a stable header and quotes commas', () => {
        const report = H.buildReport({
            youtube: {
                service: 'youtube', sourceOpen: 'opened-app', parseResult: 'matched',
                rokuResult: 'played', platform: 'Android, Chrome', rokuModel: '',
                note: 'a "quoted" note', updatedAt: '2026-09-21T00:00:00.000Z'
            }
        }, metas);
        const csv = H.toCSV(report);
        const lines = csv.split('\n');
        expect(lines[0]).toBe('schema,exported_at,service,name,source_open,parse_result,roku_result,platform,roku_model,note,updated_at');
        expect(lines.length).toBe(25); // header + 24 services
        const yt = lines.find((l) => l.includes(',youtube,'));
        expect(yt).toContain('"Android, Chrome"');
        expect(yt).toContain('"a ""quoted"" note"');
    });

    test('toTextReport is human-readable and marks tested services', () => {
        const report = H.buildReport({
            youtube: {
                service: 'youtube', sourceOpen: 'opened-app', parseResult: 'matched',
                rokuResult: 'played', platform: '', rokuModel: '', note: '', updatedAt: null
            }
        }, metas);
        const text = H.toTextReport(report);
        expect(text).toContain('couchbeam-test-report/1.0');
        expect(text).toContain('YouTube [TESTED]');
        expect(text).toContain('Netflix [not tested]');
    });
});

describe('page wiring', () => {
    test('test.html references the registry client, harness data, and harness JS', () => {
        expect(HARNESS_HTML).toContain('<script src="/js/registry-client.js"></script>');
        expect(HARNESS_HTML).toContain('<script src="/js/test-harness-data.js"></script>');
        expect(HARNESS_HTML).toContain('<script src="/js/test-harness.js"></script>');
    });

    test('test.html carries the beta-tester honesty framing', () => {
        expect(HARNESS_HTML).toMatch(/beta testers only/i);
        expect(HARNESS_HTML).toMatch(/stay on this device/i);
        expect(HARNESS_HTML).toMatch(/Couchbeam/);
        expect(HARNESS_HTML).not.toMatch(/couchdrop/i);
    });

    test('firebase.json rewrites /test to test.html', () => {
        const fb = JSON.parse(
            fs.readFileSync(path.join(__dirname, '..', '..', 'firebase.json'), 'utf8')
        );
        const rw = (fb.hosting.rewrites || []).find((r) => r.source === '/test');
        expect(rw).toBeTruthy();
        expect(rw.destination).toBe('/test.html');
    });

    test('harness sends testers to /share?url=, never a native scheme', () => {
        expect(HARNESS_SRC).toContain('/share?url=');
        expect(HARNESS_SRC).not.toMatch(/myapp:\/\/|couchbeam:\/\//i);
    });
});
