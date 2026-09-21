// Builds the browser-safe service registry from relay/services.js.
//
// Usage: node relay/build-registry-client.js
// Output: relay/public/js/registry-client.js (checked in; do not hand-edit —
// regenerate with this script so the client registry can never drift from the
// canonical one).
//
// The transform is intentionally dumb: services.js is already browser-safe
// plain script (no Node APIs); we only swap the CommonJS export for a
// window assignment.

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'services.js');
const DEST = path.join(__dirname, 'public', 'js', 'registry-client.js');

function build() {
    let src = fs.readFileSync(SRC, 'utf8');

    const exportRe = /module\.exports\s*=\s*\{[^}]*\};?\s*$/;
    if (!exportRe.test(src)) {
        throw new Error('services.js export block not found — refusing to generate a stale client registry');
    }
    src = src.replace(exportRe, '').trimEnd() + '\n';

    const out = [
        '// GENERATED FILE — do not edit by hand.',
        '// Source: relay/services.js. Regenerate with: node relay/build-registry-client.js',
        '// Exposes window.QuickbeamRegistry = { SERVICES, findService, getServiceByAppId, publicServices, hostMatches }.',
        '',
        src,
        '',
        '(function () {',
        '    var api = { SERVICES: SERVICES, findService: findService, getServiceByAppId: getServiceByAppId, publicServices: publicServices, hostMatches: hostMatches };',
        "    if (typeof window !== 'undefined') { window.QuickbeamRegistry = api; }",
        "    if (typeof module !== 'undefined' && module.exports) { module.exports = api; }",
        '})();',
        ''
    ].join('\n');

    fs.mkdirSync(path.dirname(DEST), { recursive: true });
    fs.writeFileSync(DEST, out);
    return DEST;
}

if (require.main === module) {
    console.log('wrote', build());
}

module.exports = { build };
