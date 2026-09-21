// Firestore REST client: codec, URL builders, id formats, config gating.
// No network is touched — fetch-dependent paths are not exercised here.
const store = require('../public/js/firestore-rest.js');

describe('Firestore value codec', () => {
    test('round-trips strings, numbers, booleans, dates, null', () => {
        const cases = ['hello', 42, 4.5, true, null, new Date('2026-09-21T12:00:00.000Z')];
        cases.forEach((v) => {
            const decoded = store.decodeValue(store.encodeValue(v));
            if (v instanceof Date) expect(decoded).toEqual(v);
            else expect(decoded).toBe(v);
        });
    });

    test('encodeValue rejects unsupported types', () => {
        expect(() => store.encodeValue(() => {})).toThrow();
        expect(() => store.encodeValue(Symbol('x'))).toThrow();
    });

    test('decodeDoc extracts fields and the document id', () => {
        const doc = {
            name: 'projects/p/databases/(default)/documents/magic_links/abc123',
            fields: {
                appId: { stringValue: '837' },
                createdAt: { timestampValue: '2026-09-21T12:00:00Z' }
            }
        };
        const out = store.decodeDoc(doc);
        expect(out._id).toBe('abc123');
        expect(out.appId).toBe('837');
        expect(out.createdAt).toEqual(new Date('2026-09-21T12:00:00Z'));
    });

    test('decodeDoc returns null for empty/missing docs', () => {
        expect(store.decodeDoc(null)).toBeNull();
        expect(store.decodeDoc({})).toBeNull();
    });
});

describe('configuration gating', () => {
    test('isConfigured is false with the placeholder config', () => {
        globalThis.QuickbeamConfig = {
            projectId: 'couchbeam-spark-PLACEHOLDER',
            apiKey: 'FIREBASE_WEB_API_KEY_PLACEHOLDER'
        };
        expect(store.isConfigured()).toBe(false);
    });

    test('docUrl throws NotConfiguredError until the project exists', () => {
        expect(() => store.docUrl('magic_links', 'x')).toThrow(/not configured/i);
        try {
            store.docUrl('magic_links', 'x');
        } catch (e) {
            expect(e.name).toBe('NotConfiguredError');
        }
    });

    test('docUrl builds a well-formed REST URL when configured', () => {
        globalThis.QuickbeamConfig = { projectId: 'demo-proj', apiKey: 'demo-key' };
        const url = store.docUrl('magic_links', 'abc123');
        expect(url).toBe(
            'https://firestore.googleapis.com/v1/projects/demo-proj' +
            '/databases/(default)/documents/magic_links/abc123?key=demo-key'
        );
        delete globalThis.QuickbeamConfig;
    });
});

describe('id generators', () => {
    test('newMagicLinkId is 128-bit base64url (unguessable capability)', () => {
        const ids = new Set(Array.from({ length: 50 }, () => store.newMagicLinkId()));
        expect(ids.size).toBe(50); // unique
        ids.forEach((id) => {
            expect(id).toMatch(/^[A-Za-z0-9_-]{22}$/); // 16 bytes -> 22 chars
        });
    });

    test('newPairingCode is 6 unambiguous chars matching the rules regex', () => {
        const codes = new Set(Array.from({ length: 50 }, () => store.newPairingCode()));
        expect(codes.size).toBe(50);
        codes.forEach((code) => {
            expect(code).toMatch(/^[A-Z0-9]{6}$/);
            expect(code).not.toMatch(/[01IL]/); // no ambiguous glyphs
        });
    });
});
