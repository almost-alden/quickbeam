// firestore.rules — static review assertions (the semantic pass is human;
// see the checklist in docs/firebase-spark-launch.md). The rules are the
// security boundary for the backend-less home test, so the shape is pinned.
const fs = require('fs');
const path = require('path');

const rules = fs.readFileSync(path.join(__dirname, '..', '..', 'firestore.rules'), 'utf8');

describe('firestore.rules', () => {
    test('is a v2 ruleset with a default deny', () => {
        expect(rules).toMatch(/rules_version\s*=\s*'2'/);
        expect(rules).toMatch(/match \/\{document=\*\*\} \{\s*allow read, write: if false;\s*\}/);
    });

    test('covers exactly the two home-test collections (no pairing_codes)', () => {
        expect(rules).toMatch(/match \/magic_links\/\{linkId\}/);
        expect(rules).toMatch(/match \/devices\/\{deviceId\}/);
        expect(rules).not.toMatch(/pairing_codes/);
    });

    test('forbids list/query everywhere (no enumeration of capability URLs)', () => {
        const lists = rules.match(/allow list: if false;/g) || [];
        expect(lists.length).toBe(2);
    });

    test('grants no unconditional access', () => {
        expect(rules).not.toMatch(/if true[;\s]/);
    });

    test('forbids client updates and deletes', () => {
        const denials = rules.match(/allow update, delete: if false;/g) || [];
        expect(denials.length).toBe(2);
    });

    test('reads are gated on unguessable 128-bit id shapes', () => {
        const gets = rules.match(/allow get: if (?:linkId|deviceId)\.matches\('\^(\[A-Za-z0-9_-\]|\\-)+\{20,32\}\$'\)/g) || [];
        expect(gets.length).toBe(2);
    });

    test('creates are field-allowlisted with keys().hasOnly', () => {
        const allowlists = rules.match(/keys\(\)\.hasOnly\(/g) || [];
        expect(allowlists.length).toBe(2);
    });

    test('magic-link TTL is bounded (~24h) and mediaType is allowlisted', () => {
        expect(rules).toMatch(/duration\.value\(25, 'h'\)/);
        expect(rules).toMatch(/'movie', 'series', 'episode', 'live', 'shortFormVideo'/);
    });

    test('device registration TTL is bounded (~30d)', () => {
        expect(rules).toMatch(/duration\.value\(30, 'd'\)/);
    });

    test('no TTL-policy or auto-delete claims in the rules comments', () => {
        expect(rules).not.toMatch(/TTL polic/i);
        expect(rules).not.toMatch(/actually deleted|auto-?delet/i);
        expect(rules).toMatch(/REMAIN STORED/);
    });

    test('device localIp is restricted to RFC 1918', () => {
        expect(rules.includes("^10\\\\.")).toBe(true);
        expect(rules.includes("^192\\\\.168\\\\.")).toBe(true);
        expect(rules.includes("^172\\\\.")).toBe(true);
    });

    test('originalUrl must be https', () => {
        expect(rules).toMatch(/\^https:\/\//);
    });

    test('no PII-shaped fields exist in the model', () => {
        expect(rules).not.toMatch(/senderName|email|phone|zip/i);
    });
});
