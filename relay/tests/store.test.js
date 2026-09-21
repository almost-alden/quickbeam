/**
 * Store contract tests.
 *
 * The same behavioral contract runs against every adapter:
 *   - the in-memory adapter (Jest test adapter — no live GCP)
 *   - the Firestore adapter over an in-memory fake Firestore client,
 *     which exercises the adapter's document layout, TTL enforcement,
 *     and expiresAt bookkeeping at the adapter boundary without a
 *     live project.
 *
 * Covered: state surviving application-instance replacement, TTL expiry,
 * cross-user (cross-IP) isolation, and magic-link missing/expired
 * distinction.
 */

const { createMemoryStore, createFirestoreStore } = require('../store');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Minimal in-memory stand-in for the @google-cloud/firestore client. */
class FakeFirestore {
    constructor() {
        this.collections = new Map(); // name -> Map(docId -> data)
    }
    collection(name) {
        if (!this.collections.has(name)) {
            this.collections.set(name, new Map());
        }
        const docs = this.collections.get(name);
        return {
            doc: (id) => ({
                get: async () => {
                    const data = docs.get(String(id));
                    return { exists: data !== undefined, data: () => (data === undefined ? undefined : { ...data }) };
                },
                set: async (data) => {
                    docs.set(String(id), { ...data });
                },
                delete: async () => {
                    docs.delete(String(id));
                },
            }),
            where: (field, _op, value) => ({
                get: async () => ({
                    docs: [...docs.entries()]
                        .filter(([, data]) => data[field] === value)
                        .map(([id, data]) => ({
                            data: () => ({ ...data }),
                            ref: {
                                delete: async () => {
                                    docs.delete(id);
                                },
                            },
                        })),
                }),
            }),
        };
    }
}

function memoryBackendPair() {
    const backend = { magicLinks: new Map(), devices: new Map(), pairingCodes: new Map() };
    return {
        name: 'memory',
        make: (overrides = {}) => createMemoryStore({ backend, ...overrides }),
        raw: backend,
    };
}

function firestoreFakePair() {
    const fake = new FakeFirestore();
    return {
        name: 'firestore',
        make: (overrides = {}) => createFirestoreStore({ firestore: fake, ...overrides }),
        raw: fake,
    };
}

const backends = [memoryBackendPair(), firestoreFakePair()];

describe.each(backends.map((b) => [b.name]))('store contract (%s)', (backendName) => {
    const pair = backends.find((b) => b.name === backendName);

    test('magic link survives application-instance replacement', async () => {
        const first = pair.make();
        const now = Date.now();
        await first.createMagicLink('link-abc', {
            appId: '837',
            contentId: 'vid1',
            senderName: 'Johnny',
            createdAt: now,
        });

        // A second store instance over the same backend (simulating a new
        // Cloud Run instance) must still read the record.
        const second = pair.make();
        const result = await second.getMagicLink('link-abc');
        expect(result.found).toBe(true);
        expect(result.record.appId).toBe('837');
        expect(result.record.senderName).toBe('Johnny');
    });

    test('device + pairing state survives application-instance replacement', async () => {
        const first = pair.make();
        await first.registerDevice('203.0.113.7', '192.168.1.50', 'roku-a', 'Living Room', '424242');

        const second = pair.make();
        const devices = await second.getDevicesByPublicIp('203.0.113.7');
        expect(devices.length).toBe(1);
        expect(devices[0].deviceName).toBe('Living Room');

        const viaCode = await second.findDeviceByPairingCode('424242');
        expect(viaCode).not.toBeNull();
        expect(viaCode.localIp).toBe('192.168.1.50');
    });

    test('missing magic link reports missing (not expired)', async () => {
        const store = pair.make();
        const result = await store.getMagicLink('no-such-link');
        expect(result).toEqual({ found: false, reason: 'missing' });
    });

    test('magic link TTL expiry', async () => {
        const store = pair.make({ magicLinkTtlMs: 40 });
        await store.createMagicLink('link-ttl', { appId: '837', createdAt: Date.now() });

        expect((await store.getMagicLink('link-ttl')).found).toBe(true);

        await sleep(80);
        const expired = await store.getMagicLink('link-ttl');
        expect(expired).toEqual({ found: false, reason: 'expired' });

        // Expired entry is gone for a fresh instance too.
        const fresh = pair.make({ magicLinkTtlMs: 40 });
        expect(await fresh.getMagicLink('link-ttl')).toEqual({ found: false, reason: 'missing' });
    });

    test('device and pairing-code TTL expiry', async () => {
        const store = pair.make({ deviceTtlMs: 40 });
        await store.registerDevice('203.0.113.9', '192.168.1.60', 'roku-t', 'TTL TV', '777888');

        expect((await store.getDevicesByPublicIp('203.0.113.9')).length).toBe(1);
        expect(await store.findDeviceByPairingCode('777888')).not.toBeNull();

        await sleep(80);
        expect(await store.getDevicesByPublicIp('203.0.113.9')).toEqual([]);
        expect(await store.findDeviceByPairingCode('777888')).toBeNull();
    });

    test('cross-user isolation: devices are scoped to public IP', async () => {
        const store = pair.make();
        await store.registerDevice('198.51.100.1', '192.168.1.10', 'roku-home', 'Home Roku');
        await store.registerDevice('198.51.100.2', '192.168.2.10', 'roku-cabin', 'Cabin Roku');

        const homeDevices = await store.getDevicesByPublicIp('198.51.100.1');
        expect(homeDevices.map((d) => d.deviceId)).toEqual(['roku-home']);

        const cabinDevices = await store.getDevicesByPublicIp('198.51.100.2');
        expect(cabinDevices.map((d) => d.deviceId)).toEqual(['roku-cabin']);

        expect(await store.getDevicesByPublicIp('198.51.100.3')).toEqual([]);
    });

    test('deleteMagicLink removes the record', async () => {
        const store = pair.make();
        await store.createMagicLink('link-del', { appId: '837', createdAt: Date.now() });
        expect((await store.getMagicLink('link-del')).found).toBe(true);

        await store.deleteMagicLink('link-del');
        expect(await store.getMagicLink('link-del')).toEqual({ found: false, reason: 'missing' });
    });
});

describe('firestore adapter document layout', () => {
    test('writes expiresAt as a Date for the Firestore TTL policy', async () => {
        const fake = new FakeFirestore();
        const store = createFirestoreStore({
            firestore: fake,
            magicLinkTtlMs: 60 * 1000,
            deviceTtlMs: 60 * 1000,
        });

        await store.createMagicLink('link-doc', { appId: '837', createdAt: Date.now() });
        await store.registerDevice('203.0.113.11', '192.168.1.70', 'roku-doc', 'Doc TV', '121212');

        const magicDoc = fake.collections.get('magic_links').get('link-doc');
        expect(magicDoc.expiresAt).toBeInstanceOf(Date);
        expect(magicDoc.expiresAt.getTime()).toBeGreaterThan(Date.now());

        const deviceDocs = fake.collections.get('devices');
        expect(deviceDocs.size).toBe(1);
        const [, deviceDoc] = [...deviceDocs.entries()][0];
        expect(deviceDoc.publicIp).toBe('203.0.113.11');
        expect(deviceDoc.expiresAt).toBeInstanceOf(Date);

        const codeDoc = fake.collections.get('pairing_codes').get('121212');
        expect(codeDoc.expiresAt).toBeInstanceOf(Date);
    });

    test('custom collection names via options', async () => {
        const fake = new FakeFirestore();
        const store = createFirestoreStore({
            firestore: fake,
            collectionMagic: 'qb_magic_test',
            collectionDevices: 'qb_devices_test',
            collectionPairingCodes: 'qb_codes_test',
        });

        await store.createMagicLink('x', { appId: '1', createdAt: Date.now() });
        await store.registerDevice('1.1.1.1', '10.0.0.1', 'd', 'TV', '999');

        expect(fake.collections.has('qb_magic_test')).toBe(true);
        expect(fake.collections.has('qb_devices_test')).toBe(true);
        expect(fake.collections.has('qb_codes_test')).toBe(true);
        expect(fake.collections.has('magic_links')).toBe(false);
    });

    test('missing @google-cloud/firestore surfaces a clear error only on use', async () => {
        // Simulate the package being absent via the loadFirestoreCtor seam.
        // The factory itself must not throw (the module stays require-safe
        // without the package); the friendly error appears only when a
        // client is actually built.
        const { createFirestoreStore: createFresh } = require('../store/firestore');
        const store = createFresh({
            loadFirestoreCtor: () => {
                throw new Error(
                    'The "firestore" store requires the @google-cloud/firestore package. ' +
                    'Install it with: npm install @google-cloud/firestore'
                );
            },
        });
        await expect(store.getMagicLink('x')).rejects.toThrow(/@google-cloud\/firestore/);
    });
});

describe('store factory', () => {
    const { createStore } = require('../store');

    test('defaults to the memory adapter', async () => {
        const store = createStore({ kind: 'memory' });
        await store.createMagicLink('f1', { appId: '1', createdAt: Date.now() });
        expect((await store.getMagicLink('f1')).found).toBe(true);
    });

    test('rejects unknown QB_STORE kinds', () => {
        expect(() => createStore({ kind: 'bogus' })).toThrow(/Unknown store kind/);
    });
});
