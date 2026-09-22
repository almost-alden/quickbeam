// send-contacts.js: static-model quick-send contacts.
// Pure logic is tested here with window.Quickbeam mocked; no network, no DOM.

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

describe('extractPairingToken', () => {
    test('extracts ?pair= from a full pairing link', () => {
        expect(SC.extractPairingToken('https://quickbeam-prod.web.app/magic.html?pair=abcDEF1234567890xy'))
            .toBe('abcDEF1234567890xy');
    });

    test('handles extra query params and encoded tokens', () => {
        expect(SC.extractPairingToken('https://x.web.app/magic.html?foo=1&pair=tok%2Fen%20c'))
            .toBe('tok/en c');
    });

    test('accepts a raw token', () => {
        expect(SC.extractPairingToken('abcDEF1234567890xy')).toBe('abcDEF1234567890xy');
    });

    test('rejects 6-digit codes and junk', () => {
        expect(SC.extractPairingToken('123456')).toBe('');
        expect(SC.extractPairingToken('hello')).toBe('');
        expect(SC.extractPairingToken('')).toBe('');
        expect(SC.extractPairingToken(null)).toBe('');
    });
});

describe('normalizeContact', () => {
    test('new-model contact passes through', () => {
        const c = SC.normalizeContact({
            name: 'Mom', phone: '5551234567', email: '',
            pairingLink: 'https://x/magic.html?pair=tok1234567890abcdef', deviceName: 'Living Room TV'
        });
        expect(c.name).toBe('Mom');
        expect(c.pairingLink).toBe('https://x/magic.html?pair=tok1234567890abcdef');
        expect(c.deviceName).toBe('Living Room TV');
        expect(c.needsRepair).toBeUndefined();
    });

    test('legacy 6-digit code contact is flagged needsRepair', () => {
        const c = SC.normalizeContact({ name: 'Dad', code: '123456', phone: '', email: '' });
        expect(c.needsRepair).toBe(true);
        expect(c.pairingLink).toBe('');
    });

    test('legacy code already migrated to a pairing link is not flagged', () => {
        const c = SC.normalizeContact({ name: 'Dad', code: '123456', pairingLink: 'https://x/magic.html?pair=tok1234567890abcdef' });
        expect(c.needsRepair).toBeUndefined();
    });
});

describe('getContacts / saveContactsList', () => {
    test('round-trips through localStorage and normalizes', () => {
        SC.saveContactsList([{ name: 'Mom', code: '999999' }]);
        const list = SC.getContacts();
        expect(list).toHaveLength(1);
        expect(list[0].needsRepair).toBe(true);
        expect(JSON.parse(globalThis.localStorage.getItem(SC.STORAGE_KEY))).toHaveLength(1);
    });

    test('returns [] on corrupt storage', () => {
        globalThis.localStorage.setItem(SC.STORAGE_KEY, 'not-json{{{');
        expect(SC.getContacts()).toEqual([]);
    });
});

describe('validatePairingLink', () => {
    const qbOk = { resolvePairingToken: (t) => Promise.resolve({ deviceId: t, deviceName: 'Bedroom Roku' }) };
    const qbGone = { resolvePairingToken: () => Promise.resolve({ error: 'Pairing link not found or expired' }) };

    test('resolves a valid pairing link to its device name', async () => {
        const v = await SC.validatePairingLink(qbOk, 'https://x.web.app/magic.html?pair=tok1234567890abcdef');
        expect(v.deviceName).toBe('Bedroom Roku');
    });

    test('rejects text that is not a pairing link', async () => {
        await expect(SC.validatePairingLink(qbOk, '123456'))
            .rejects.toThrow(/does not look like a Couchbeam pairing link/);
    });

    test('rejects expired/unknown links with a user-facing message', async () => {
        await expect(SC.validatePairingLink(qbGone, 'https://x.web.app/magic.html?pair=tok1234567890abcdef'))
            .rejects.toThrow(/not found or expired/);
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

    const contact = { name: 'Mom', phone: '5551234567', email: '', pairingLink: '', deviceName: '' };

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

    test('routes via email when there is no phone', async () => {
        const d = deps();
        const r = await SC.prepareQuickSend(d, {
            url: YT, videoTitle: 'Hi', senderName: '',
            contact: { name: 'Mom', phone: '', email: 'mom@example.com' }
        });
        expect(r.route.type).toBe('mailto');
        expect(r.route.email).toBe('mom@example.com');
        expect(r.route.body).toContain('Your friend sent you a video link!');
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

describe('no-PII / no-network guardrails', () => {
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
});
