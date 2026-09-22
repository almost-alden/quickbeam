// send-contacts.js: static-model quick-send contacts.
// Contact model is the honest { name, phone, email } address book — no
// pairing capability links, no TV bindings, no re-pair flow. Pure logic is
// tested here with window.Quickbeam mocked; no network, no DOM.

const SC = require('../public/js/send-contacts.js');

function memStorage() {
    const data = {};
    return {
        getItem: (k) => (k in data ? data[k] : null),
        setItem: (k, v) => { data[k] = String(v); },
        removeItem: (k) => { delete data[k]; },
        clear: () => { for (const k of Object.keys(data)) delete data[k]; },
        _data: data
    };
}

beforeEach(() => {
    globalThis.localStorage = memStorage();
});

afterEach(() => {
    delete globalThis.localStorage;
});

describe('normalizeContact', () => {
    test('new-model contact passes through as {name, phone, email}', () => {
        const c = SC.normalizeContact({ name: 'Mom', phone: '5551234567', email: 'mom@example.com' });
        expect(c).toEqual({ name: 'Mom', phone: '5551234567', email: 'mom@example.com' });
    });

    test('pairing capability URLs are NOT retained in the contact model', () => {
        const c = SC.normalizeContact({
            name: 'Mom', phone: '5551234567', email: '',
            pairingLink: 'https://quickbeam-prod.web.app/magic.html?pair=SECRETcapabilityToken1234567890',
            deviceName: 'Living Room TV', code: '123456', needsRepair: true
        });
        expect(c).toEqual({ name: 'Mom', phone: '5551234567', email: '' });
        expect(c).not.toHaveProperty('pairingLink');
        expect(c).not.toHaveProperty('deviceName');
        expect(c).not.toHaveProperty('code');
        expect(c).not.toHaveProperty('needsRepair');
        expect(JSON.stringify(c)).not.toContain('pair=');
    });

    test('legacy 6-digit code is dropped, contact stays usable', () => {
        const c = SC.normalizeContact({ name: 'Dad', code: '123456', phone: '5550001', email: '' });
        expect(c).toEqual({ name: 'Dad', phone: '5550001', email: '' });
        expect(c).not.toHaveProperty('needsRepair');
    });
});

describe('getContacts / saveContactsList', () => {
    test('round-trips through localStorage and normalizes', () => {
        SC.saveContactsList([{ name: 'Mom', phone: '5551', email: '' }]);
        const list = SC.getContacts();
        expect(list).toEqual([{ name: 'Mom', phone: '5551', email: '' }]);
    });

    test('saveContactsList strips pairing fields before persisting', () => {
        SC.saveContactsList([{
            name: 'Mom', phone: '', email: '',
            pairingLink: 'https://x.web.app/magic.html?pair=SECRETcapabilityToken1234567890',
            deviceName: 'TV', code: '123456'
        }]);
        const raw = globalThis.localStorage.getItem(SC.STORAGE_KEY);
        expect(raw).not.toContain('pairingLink');
        expect(raw).not.toContain('pair=');
        expect(raw).not.toContain('deviceName');
        expect(JSON.parse(raw)).toEqual([{ name: 'Mom', phone: '', email: '' }]);
    });

    test('stored pairing links from older versions are dropped on load', () => {
        globalThis.localStorage.setItem(SC.STORAGE_KEY, JSON.stringify([{
            name: 'Mom', phone: '', email: '',
            pairingLink: 'https://x.web.app/magic.html?pair=SECRETcapabilityToken1234567890'
        }]));
        expect(SC.getContacts()).toEqual([{ name: 'Mom', phone: '', email: '' }]);
    });

    test('returns [] on corrupt storage', () => {
        globalThis.localStorage.setItem(SC.STORAGE_KEY, 'not-json{{{');
        expect(SC.getContacts()).toEqual([]);
    });
});

describe('prepareQuickSend', () => {
    const YT = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    const MAGIC = 'https://quickbeam-prod.web.app/magic/testLinkId22charsAbC123';

    function deps(over = {}) {
        const copied = [];
        const seenInputs = [];
        return {
            copied,
            seenInputs,
            qb: {
                createMagicLink: jest.fn((input) => {
                    seenInputs.push(input);
                    return Promise.resolve({ linkId: 'testLinkId22charsAbC123', magicUrl: MAGIC });
                })
            },
            clipboard: { writeText: jest.fn((t) => { copied.push(t); return Promise.resolve(); }) },
            ...over
        };
    }

    const contact = { name: 'Mom', phone: '5551234567', email: '' };

    test('creates the magic link, copies it, routes via SMS for a phone contact', async () => {
        const d = deps();
        const r = await SC.prepareQuickSend(d, { url: YT, videoTitle: 'Hi', senderName: 'Kid', contact });
        expect(d.qb.createMagicLink).toHaveBeenCalledTimes(1);
        expect(d.seenInputs[0]).toEqual({ url: YT, videoTitle: 'Hi' });
        expect(d.copied).toEqual([MAGIC]);
        expect(r.magicUrl).toBe(MAGIC);
        expect(r.route.type).toBe('sms');
        expect(r.route.phone).toBe('5551234567');
        expect(r.route.body).toContain('Kid sent you a video link!');
        expect(r.route.body).toContain(MAGIC);
    });

    test('send copy tells the recipient to pair their own TV, never promises instant launch', async () => {
        const d = deps();
        const r = await SC.prepareQuickSend(d, { url: YT, videoTitle: '', senderName: 'Kid', contact });
        expect(r.route.body).toMatch(/pair your TV/i);
        expect(r.route.body).not.toMatch(/instant/i);
        expect(r.route.body).not.toMatch(/instantly launches/i);
    });

    test('routes via email when there is no phone', async () => {
        const d = deps();
        const r = await SC.prepareQuickSend(d, {
            url: YT, videoTitle: 'Hi', senderName: '',
            contact: { name: 'Mom', phone: '', email: 'mom@example.com' }
        });
        expect(r.route.type).toBe('mailto');
        expect(r.route.email).toBe('mom@example.com');
        expect(r.route.body).toContain('Your friend sent you a video link!');
        expect(r.route.body).not.toMatch(/instant/i);
    });

    test('falls back to manual route with no phone or email', async () => {
        const d = deps();
        const r = await SC.prepareQuickSend(d, {
            url: YT, videoTitle: '', senderName: 'Kid', contact: { name: 'Mom' }
        });
        expect(r.route.type).toBe('manual');
        expect(r.route.name).toBe('Mom');
    });

    test('rejects an empty URL before any network', async () => {
        const d = deps();
        await expect(SC.prepareQuickSend(d, { url: '  ', videoTitle: '', senderName: '', contact }))
            .rejects.toThrow(/paste a Video URL/);
        expect(d.qb.createMagicLink).not.toHaveBeenCalled();
    });

    test('wraps data-layer failures as a user-facing Error', async () => {
        const d = deps({ qb: { createMagicLink: () => Promise.reject(new Error('This link is not supported yet.')) } });
        await expect(SC.prepareQuickSend(d, { url: YT, videoTitle: '', senderName: '', contact }))
            .rejects.toThrow(/^Error: This link is not supported yet\./);
    });

    test('a clipboard failure does not break the send', async () => {
        const d = deps({ clipboard: { writeText: () => Promise.reject(new Error('denied')) } });
        const r = await SC.prepareQuickSend(d, { url: YT, videoTitle: '', senderName: '', contact });
        expect(r.magicUrl).toBe(MAGIC);
        expect(r.route.type).toBe('sms');
    });
});

describe('page copy honesty (send.html)', () => {
    const fs = require('fs');
    const path = require('path');
    const HTML = fs.readFileSync(path.join(__dirname, '..', 'public', 'send.html'), 'utf8');

    test('page contains no instant-launch claim', () => {
        expect(HTML).not.toMatch(/instant/i);
        expect(HTML).not.toMatch(/instantly launches/i);
        expect(HTML).not.toMatch(/Cast Instantly/i);
    });

    test('launch is explicitly labeled experimental/unverified', () => {
        expect(HTML).toMatch(/experimental/i);
    });

    test('tutorial says the recipient pairs their own TV', () => {
        expect(HTML).toMatch(/pair their own (Roku )?TV/i);
    });

    test('contacts form has no pairing-link input and no re-pair prompt', () => {
        expect(HTML).not.toContain('newContactPairingLink');
        expect(HTML).not.toContain('re-pair');
        expect(HTML).not.toContain('repairContact');
    });
});

describe('no-PII / no-network / no-pairing guardrails', () => {
    const fs = require('fs');
    const path = require('path');
    const SRC = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'send-contacts.js'), 'utf8');

    test('module performs no fetch/XHR/beacon', () => {
        expect(SRC).not.toMatch(/fetch\s*\(/);
        expect(SRC).not.toMatch(/XMLHttpRequest/);
        expect(SRC).not.toMatch(/sendBeacon/);
        expect(SRC).not.toMatch(/WebSocket/);
    });

    test('module never logs contact fields', () => {
        expect(SRC).not.toMatch(/console\.(log|info|debug|warn|error)/);
    });

    test('module retains no pairing-link machinery', () => {
        // Strip comments first: the doc block explains what was removed.
        const CODE = SRC
            .replace(/\/\/[^\n]*/g, '')
            .replace(/\/\*[\s\S]*?\*\//g, '');
        expect(CODE).not.toContain('pairingLink');
        expect(CODE).not.toContain('validatePairingLink');
        expect(CODE).not.toContain('extractPairingToken');
        expect(CODE).not.toContain('needsRepair');
        expect(CODE).not.toContain('deviceName');
    });
});
