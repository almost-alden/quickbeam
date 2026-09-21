// Share-target parsing: Android text-field normalization + registry parsing.
// The generated client registry is loaded into globalThis like the browser does.
globalThis.QuickbeamRegistry = require('../public/js/registry-client.js');
const share = require('../public/js/share.js');

describe('extractSharedUrl (Web Share Target normalization)', () => {
    test('prefers a valid url param', () => {
        expect(share.extractSharedUrl({
            url: 'https://www.youtube.com/watch?v=abc',
            text: 'https://youtu.be/other'
        })).toBe('https://www.youtube.com/watch?v=abc');
    });

    test('Android case: URL buried in the text field with trailing prose', () => {
        expect(share.extractSharedUrl({
            text: 'Check this out https://youtu.be/abc123XYZ_-.'
        })).toBe('https://youtu.be/abc123XYZ_-');
    });

    test('strips glued-on closing punctuation from the text field', () => {
        expect(share.extractSharedUrl({ text: '(https://www.youtube.com/watch?v=x1),' }))
            .toBe('https://www.youtube.com/watch?v=x1');
        expect(share.extractSharedUrl({ text: 'watch https://www.youtube.com/watch?v=x2!' }))
            .toBe('https://www.youtube.com/watch?v=x2');
    });

    test('falls back to the title field when url/text are empty', () => {
        expect(share.extractSharedUrl({ title: 'https://www.netflix.com/watch/123' }))
            .toBe('https://www.netflix.com/watch/123');
    });

    test('returns null when nothing shareable was provided', () => {
        expect(share.extractSharedUrl({})).toBeNull();
        expect(share.extractSharedUrl({ text: 'just some words, no link' })).toBeNull();
        expect(share.extractSharedUrl({ url: 'not a url' })).toBeNull();
    });

    test('rejects non-http(s) schemes', () => {
        expect(share.extractSharedUrl({ url: 'javascript:alert(1)' })).toBeNull();
        expect(share.extractSharedUrl({ text: 'ftp://files.example.com/x' })).toBeNull();
    });
});

describe('parseSharedUrl (client-side registry)', () => {
    test('parses a YouTube watch URL', () => {
        const p = share.parseSharedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
        expect(p.error).toBeUndefined();
        expect(p.serviceName).toBe('YouTube');
        expect(p.appId).toBe('837');
        expect(p.contentId).toBe('dQw4w9WgXcQ');
    });

    test('tv.youtube.com resolves to YouTube TV, not plain YouTube (ordering)', () => {
        const p = share.parseSharedUrl('https://tv.youtube.com/watch/abc123');
        expect(p.error).toBeUndefined();
        expect(p.serviceName).toBe('YouTube TV');
        expect(p.appId).toBe('195316');
    });

    test('unsupported service returns a clean unsupported error', () => {
        const p = share.parseSharedUrl('https://example.com/watch/123');
        expect(p.error).toBe('unsupported');
        expect(p.url).toContain('example.com');
    });

    test('lookalike domains never match (exact-or-suffix)', () => {
        const p = share.parseSharedUrl('https://youtube.com.evil.com/watch?v=x');
        expect(p.error).toBe('unsupported');
    });

    test('garbage input returns invalid-url, never throws', () => {
        expect(share.parseSharedUrl('not a url').error).toBe('invalid-url');
        expect(share.parseSharedUrl('').error).toBe('invalid-url');
        expect(share.parseSharedUrl(null).error).toBe('invalid-url');
    });
});
