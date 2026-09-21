// The generated client registry must never drift from relay/services.js.
const fs = require('fs');
const path = require('path');
const { build } = require('../build-registry-client.js');

const DEST = path.join(__dirname, '..', 'public', 'js', 'registry-client.js');

describe('registry-client build', () => {
    test('checked-in file matches a fresh regeneration (no drift)', () => {
        const before = fs.readFileSync(DEST, 'utf8');
        build();
        const after = fs.readFileSync(DEST, 'utf8');
        expect(after).toBe(before);
    });

    test('client registry holds all 24 services, youtube-tv first', () => {
        const r = require('../public/js/registry-client.js');
        expect(r.SERVICES.length).toBe(24);
        expect(r.SERVICES[0].id).toBe('youtube-tv');
        expect(r.SERVICES.some((s) => s.id === 'youtube-tv' && s.appId === '195316')).toBe(true);
    });

    test('generated file exposes the browser global, not the raw CJS export', () => {
        const src = fs.readFileSync(DEST, 'utf8');
        expect(src).toMatch(/GENERATED FILE/);
        expect(src).toMatch(/window\.QuickbeamRegistry/);
        expect(src).not.toMatch(/module\.exports = \{ SERVICES/);
    });
});
