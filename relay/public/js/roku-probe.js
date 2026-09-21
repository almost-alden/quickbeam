// Mixed-content-safe Roku discovery for the Couchbeam home test.
//
// The problem: Firebase Hosting serves pages over HTTPS, but Roku ECP lives
// at http://<lan-ip>:8060. Browsers block fetch()/XHR from an HTTPS page to an
// http:// LAN address as mixed content. magic.html already launches video
// through a hidden form POST into a hidden iframe, which browsers permit
// (form navigation is not a fetch). This module extends that pattern:
//
//   - launch      -> hidden form POST (already worked; kept here as one helper)
//   - discovery   -> fetch() probe when the page itself is http: (home relay);
//                    on https: pages, automatic probing is impossible, so the UI
//                    must use the explicit manual-confirm flow: the user enters
//                    the TV's LAN address, we fire the same hidden-form trick at
//                    /query/device-info, and the user confirms the TV is theirs.
//                    The device is stored "unverified" and promoted to
//                    "verified" after the user's first acknowledged launch.
//
// EXPERIMENTAL: the cross-scheme form/iframe launch is not verified on real
// phone + Roku hardware yet. Do not describe it as verified from unit tests —
// the tests cover the URL builders and strategy selection only.
//
// UMD: window.QuickbeamProbe in the browser, require() under Node.

(function () {
    'use strict';

    // Only RFC 1918 addresses are ever probed — never route a LAN scan at a
    // public host from these helpers.
    function isPrivateIPv4(ip) {
        if (typeof ip !== 'string') return false;
        var m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
        if (!m) return false;
        var a = +m[1], b = +m[2], c = +m[3], d = +m[4];
        if ([a, b, c, d].some(function (n) { return n < 0 || n > 255; })) return false;
        return a === 10 || a === 192 && b === 168 || a === 172 && b >= 16 && b <= 31;
    }

    function deviceInfoUrl(ip) {
        return 'http://' + ip + ':8060/query/device-info';
    }

    function launchUrl(ip, appId, contentId, mediaType) {
        return 'http://' + ip + ':8060/launch/' + encodeURIComponent(appId) +
            '?contentId=' + encodeURIComponent(contentId || '') +
            '&mediaType=' + encodeURIComponent(mediaType || '');
    }

    // 'fetch-probe' on http: pages (fetch to http:// is same-scheme, allowed).
    // 'manual-confirm' on https: pages (fetch would be blocked mixed content).
    function probeStrategy(pageProtocol) {
        return pageProtocol === 'https:' ? 'manual-confirm' : 'fetch-probe';
    }

    // Fire-and-forget navigation into a hidden iframe. Used for launch (POST)
    // and for the https: discovery nudge (GET at /query/device-info — we
    // cannot read the response cross-origin, the load itself is the nudge).
    function submitHiddenForm(url, method) {
        if (typeof document === 'undefined') {
            throw new Error('Couchbeam: submitHiddenForm needs a DOM.');
        }
        var iframe = document.getElementById('qb_hidden_iframe');
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.id = 'qb_hidden_iframe';
            iframe.name = 'qb_hidden_iframe';
            iframe.style.display = 'none';
            document.body.appendChild(iframe);
        }
        var form = document.createElement('form');
        form.method = method || 'POST';
        form.action = url;
        form.target = 'qb_hidden_iframe';
        document.body.appendChild(form);
        form.submit();
        document.body.removeChild(form);
        return iframe;
    }

    var api = {
        isPrivateIPv4: isPrivateIPv4,
        deviceInfoUrl: deviceInfoUrl,
        launchUrl: launchUrl,
        probeStrategy: probeStrategy,
        submitHiddenForm: submitHiddenForm
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    } else if (typeof window !== 'undefined') {
        window.QuickbeamProbe = api;
    }
})();
