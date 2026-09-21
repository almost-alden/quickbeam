// PWA manifest: installability + Web Share Target contract.
const fs = require('fs');
const path = require('path');

const manifest = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'public', 'manifest.json'), 'utf8')
);

function iconArea(icon) {
    const m = /^(\d+)x(\d+)$/.exec(icon.sizes || '');
    return m ? parseInt(m[1], 10) * parseInt(m[2], 10) : 0;
}

describe('PWA manifest', () => {
    test('has installability basics (name, display, start_url, scope)', () => {
        expect(manifest.name).toBe('Quickbeam');
        expect(manifest.short_name).toBe('Quickbeam');
        expect(manifest.display).toBe('standalone');
        expect(manifest.start_url).toBe('/');
        expect(manifest.scope).toBe('/');
    });

    test('declares 192px and 512px icons for installability', () => {
        const areas = manifest.icons.map(iconArea);
        expect(Math.max(...areas)).toBeGreaterThanOrEqual(512 * 512);
        expect(areas.some((a) => a >= 192 * 192)).toBe(true);
        manifest.icons.forEach((icon) => {
            expect(icon.src.startsWith('/')).toBe(true); // first-party only
            expect(icon.src.startsWith('http')).toBe(false);
        });
    });

    test('share_target points at /share with url/text/title params (GET)', () => {
        const st = manifest.share_target;
        expect(st.action).toBe('/share');
        expect(st.method).toBe('GET');
        expect(st.enctype).toBe('application/x-www-form-urlencoded');
        expect(st.params.url).toBe('url');
        expect(st.params.text).toBe('text');
        expect(st.params.title).toBe('title');
    });

    test('theme matches the Couchdrop message-blue direction', () => {
        expect(manifest.theme_color).toBe('#2e7cf6');
    });
});
