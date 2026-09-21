// qb.js data layer: /api-first, Firestore-fallback. fetch is stubbed; the
// fake store captures writes so the fallback path is fully exercised.
globalThis.QuickbeamRegistry = require('../public/js/registry-client.js');
globalThis.QuickbeamShare = require('../public/js/share.js');
globalThis.QuickbeamProbe = require('../public/js/roku-probe.js');

const created = [];
const docs = {};
globalThis.QuickbeamStore = {
    isConfigured: () => true,
    newMagicLinkId: () => 'testLinkId22charsAbC123',
    newPairingCode: () => 'QK7X2P',
    createDoc: (collection, id, doc) => {
        created.push({ collection, id, doc });
        docs[collection + '/' + id] = doc;
        return Promise.resolve(true);
    },
    getDoc: (collection, id) => Promise.resolve(docs[collection + '/' + id] || null)
};

// Static-hosting fetch: /api/* answers with the hosting 404 page (non-JSON).
globalThis.fetch = () => Promise.resolve({
    status: 404,
    headers: { get: () => 'text/html' },
    json: () => Promise.reject(new Error('not json'))
});

const qb = require('../public/js/qb.js');
const YT = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

describe('createMagicLink', () => {
    test('rejects unsupported URLs before any network', async () => {
        await expect(qb.createMagicLink({ url: 'https://example.com/x' }))
            .rejects.toMatchObject({ code: 'unsupported' });
        expect(created.length).toBe(0);
    });

    test('falls back to Firestore when /api is absent (static hosting)', async () => {
        const r = await qb.createMagicLink({ url: YT, videoTitle: 'Test video' });
        expect(r.linkId).toBe('testLinkId22charsAbC123');
        expect(r.magicUrl).toContain('/magic/testLinkId22charsAbC123');

        const write = created.find((c) => c.collection === 'magic_links');
        expect(write).toBeDefined();
        expect(write.doc.appId).toBe('837');
        expect(write.doc.contentId).toBe('dQw4w9WgXcQ');
        expect(write.doc.videoTitle).toBe('Test video');
        expect(write.doc.originalUrl).toBe(YT);
        // 24h TTL, no PII fields in the model
        expect(write.doc.expiresAt.getTime() - write.doc.createdAt.getTime())
            .toBe(24 * 60 * 60 * 1000);
        expect(write.doc.senderName).toBeUndefined();
    });
});

describe('getMagicLink', () => {
    test('missing doc -> 404-shaped error (not a throw)', async () => {
        const r = await qb.getMagicLink('nope-not-here');
        expect(r.error).toMatch(/not found/i);
        expect(r.status).toBe(404);
    });

    test('expired doc -> 410-shaped error (client-enforced TTL)', async () => {
        docs['magic_links/old-link'] = {
            appId: '837', contentId: 'x', mediaType: 'shortFormVideo',
            createdAt: new Date(Date.now() - 25 * 3600 * 1000),
            expiresAt: new Date(Date.now() - 3600 * 1000)
        };
        const r = await qb.getMagicLink('old-link');
        expect(r.status).toBe(410);
    });

    test('live doc resolves with devices: [] on static hosting', async () => {
        docs['magic_links/live-link'] = {
            appId: '837', contentId: 'x', mediaType: 'shortFormVideo',
            serviceName: 'YouTube',
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 3600 * 1000)
        };
        const r = await qb.getMagicLink('live-link');
        expect(r.appId).toBe('837');
        expect(r.devices).toEqual([]);
    });
});

describe('device registration + pairing codes', () => {
    test('rejects non-LAN addresses before any write', async () => {
        await expect(qb.registerDevice({ localIp: '8.8.8.8', deviceId: 'd1' }))
            .rejects.toMatchObject({ code: 'invalid-ip' });
    });

    test('writes devices + pairing_codes docs on static hosting', async () => {
        const r = await qb.registerDevice({
            localIp: '192.168.1.20', deviceId: 'roku-living', deviceName: 'Living Room'
        });
        expect(r.pairingCode).toBe('QK7X2P');
        const dev = created.find((c) => c.collection === 'devices');
        const code = created.find((c) => c.collection === 'pairing_codes');
        expect(dev.doc.localIp).toBe('192.168.1.20');
        expect(code.doc.deviceId).toBe('roku-living');
        expect(code.doc.expiresAt.getTime() - code.doc.createdAt.getTime())
            .toBe(60 * 60 * 1000);
    });

    test('resolvePairingCode follows code -> device', async () => {
        const r = await qb.resolvePairingCode('qk7x2p'); // lowercase ok
        expect(r.localIp).toBe('192.168.1.20');
        expect(r.deviceName).toBe('Living Room');
    });

    test('unknown code -> error, not a throw', async () => {
        const r = await qb.resolvePairingCode('ZZZZZZ');
        expect(r.error).toMatch(/not found/i);
    });
});
