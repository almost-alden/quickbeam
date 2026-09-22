// Couchbeam streaming-service test harness.
//
// Renders the 24-service test matrix from the canonical registry
// (window.QuickbeamRegistry, built from relay/services.js) plus the honest
// per-card metadata in test-harness-data.js. Test results are stored ONLY in
// this device's localStorage — there is no network code in this file at all:
// no fetch, no XHR, no beacons, no remote POST. Testers explicitly choose when
// and where to share via Copy / Download buttons.
//
// Exposes window.CouchbeamTestHarness in the browser and module.exports under
// Node so Jest can test the store, the export builders, and the validators.

(function () {
    'use strict';

    var STORAGE_KEY = 'couchbeam-test-results-v1';
    var EXPORT_SCHEMA = 'couchbeam-test-report/1.0';
    var LINK_STORAGE_KEY = 'couchbeam-test-results-v1-links';

    // Result fields, exactly as the harness spec requires. Optional free-text
    // fields stay optional. This file never handles network addresses, TV
    // names, short typed codes, contact fields, tracker IDs, or hardware
    // identifiers — the harness does not collect those.
    var RECORD_FIELDS = ['service', 'sourceOpen', 'parseResult', 'rokuResult', 'platform', 'rokuModel', 'note'];

    var RESULT_CHOICES = {
        sourceOpen: ['not-tested', 'opened-app', 'opened-browser', 'failed'],
        parseResult: ['not-tested', 'matched', 'no-match', 'parser-error'],
        rokuResult: ['not-tested', 'played', 'app-launched', 'failed', 'not-attempted']
    };

    function storage() {
        try {
            if (typeof localStorage !== 'undefined') return localStorage;
        } catch (e) { /* private mode etc. */ }
        return null;
    }

    function blankRecord(serviceId) {
        return {
            service: serviceId,
            sourceOpen: 'not-tested',
            parseResult: 'not-tested',
            rokuResult: 'not-tested',
            platform: '',
            rokuModel: '',
            note: '',
            updatedAt: null
        };
    }

    function loadResults() {
        var store = storage();
        if (!store) return {};
        try {
            var raw = store.getItem(STORAGE_KEY);
            if (!raw) return {};
            var parsed = JSON.parse(raw);
            return (parsed && typeof parsed === 'object') ? parsed : {};
        } catch (e) {
            return {};
        }
    }

    function saveResults(results) {
        var store = storage();
        if (!store) return false;
        try {
            store.setItem(STORAGE_KEY, JSON.stringify(results || {}));
            return true;
        } catch (e) {
            return false;
        }
    }

    function setRecord(serviceId, patch) {
        var results = loadResults();
        var rec = results[serviceId] || blankRecord(serviceId);
        for (var i = 0; i < RECORD_FIELDS.length; i++) {
            var k = RECORD_FIELDS[i];
            if (patch && Object.prototype.hasOwnProperty.call(patch, k)) {
                rec[k] = typeof patch[k] === 'string' ? patch[k].slice(0, 2000) : patch[k];
            }
        }
        rec.updatedAt = new Date().toISOString();
        results[serviceId] = rec;
        saveResults(results);
        return rec;
    }

    function resetResults() {
        var store = storage();
        if (store) {
            try { store.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
        }
        return {};
    }

    function validateRecord(rec) {
        if (!rec || typeof rec !== 'object') return ['record must be an object'];
        var errors = [];
        if (typeof rec.service !== 'string' || !rec.service) errors.push('service is required');
        ['sourceOpen', 'parseResult', 'rokuResult'].forEach(function (k) {
            var allowed = RESULT_CHOICES[k];
            if (allowed.indexOf(rec[k]) === -1) errors.push(k + ' must be one of ' + allowed.join(', '));
        });
        return errors;
    }

    function isTested(rec) {
        return rec && (rec.sourceOpen !== 'not-tested' || rec.parseResult !== 'not-tested' || rec.rokuResult !== 'not-tested');
    }

    // --- Tester-supplied "real link to test" --------------------------------
    //
    // Every card action (Open title, Send to Couchbeam, Copy link, Test parse)
    // runs against the link the tester pasted into that card's input — never
    // against the parser fixture. Fixtures stay visible as labeled technical
    // reference with an explicit "Use fixture" opt-in.
    //
    // Typed links are session-only (kept in memory): they are NOT written to
    // storage unless the tester explicitly taps "Save link on this device" on
    // that card. Saved links live under LINK_STORAGE_KEY, in the same
    // localStorage family as results. Nothing is ever uploaded anywhere.

    // Page-session typed links. Never persisted unless explicitly saved.
    var sessionLinks = {};

    function setSessionLink(serviceId, url) {
        if (url) { sessionLinks[serviceId] = String(url); }
        else { delete sessionLinks[serviceId]; }
    }

    function clearSessionLinks() { sessionLinks = {}; }

    function hostMatchesSuffix(hostname, domain) {
        hostname = String(hostname).toLowerCase();
        domain = String(domain).toLowerCase();
        return hostname === domain || hostname.slice(-domain.length - 1) === '.' + domain;
    }

    // Pure validator: HTTPS only, and the host must match one of the
    // service's registry domains (exact-or-suffix, so lookalikes like
    // netflix.com.evil.com are rejected).
    function validateTestUrl(domains, urlString) {
        var raw = String(urlString == null ? '' : urlString).trim();
        if (!raw) return { ok: false, error: 'paste a link first' };
        var parsed;
        try { parsed = new URL(raw); }
        catch (e) { return { ok: false, error: 'that is not a valid URL' }; }
        if (parsed.protocol !== 'https:') {
            return { ok: false, error: 'link must use https' };
        }
        var host = parsed.hostname.toLowerCase();
        var list = domains || [];
        for (var i = 0; i < list.length; i++) {
            if (hostMatchesSuffix(host, list[i])) return { ok: true, url: parsed.href };
        }
        return { ok: false, error: 'host "' + host + '" does not match this service' };
    }

    function shareHref(testUrl) {
        return '/share?url=' + encodeURIComponent(testUrl);
    }

    function loadCardLinks() {
        var store = storage();
        if (!store) return {};
        try {
            var raw = store.getItem(LINK_STORAGE_KEY);
            if (!raw) return {};
            var parsed = JSON.parse(raw);
            return (parsed && typeof parsed === 'object') ? parsed : {};
        } catch (e) {
            return {};
        }
    }

    // Explicit per-card save. Validates first; never called implicitly.
    function saveCardLink(serviceId, urlString, domains) {
        var v = validateTestUrl(domains, urlString);
        if (!v.ok) return v;
        var store = storage();
        if (!store) return { ok: false, error: 'storage is unavailable on this device' };
        try {
            var links = loadCardLinks();
            links[serviceId] = v.url;
            store.setItem(LINK_STORAGE_KEY, JSON.stringify(links));
        } catch (e) {
            return { ok: false, error: 'storage is unavailable on this device' };
        }
        delete sessionLinks[serviceId];
        return { ok: true, url: v.url };
    }

    function clearCardLinks() {
        var store = storage();
        if (store) { try { store.removeItem(LINK_STORAGE_KEY); } catch (e) { /* ignore */ } }
        return {};
    }

    // Resolution order: typed this session → saved on this device →
    // maintainer-verified prefill → empty. The parser fixture is NEVER a
    // default: cards without a verified current link start with an empty
    // input and a paste affordance.
    function resolveLink(serviceId, card, savedLinks) {
        if (Object.prototype.hasOwnProperty.call(sessionLinks, serviceId)) {
            return sessionLinks[serviceId];
        }
        if (savedLinks && savedLinks[serviceId]) return savedLinks[serviceId];
        if (card && card.liveUrl) return card.liveUrl;
        return '';
    }

    function linkSource(serviceId, card, savedLinks) {
        if (Object.prototype.hasOwnProperty.call(sessionLinks, serviceId)) return 'typed';
        if (savedLinks && savedLinks[serviceId]) return 'saved';
        if (card && card.liveUrl) return 'verified';
        return 'none';
    }

    function buildReport(results, serviceMeta) {
        var list = serviceMeta || [];
        var rows = [];
        for (var i = 0; i < list.length; i++) {
            var id = list[i].id || list[i];
            var rec = results[id] || blankRecord(id);
            rows.push({
                service: id,
                name: list[i].name || id,
                sourceOpen: rec.sourceOpen,
                parseResult: rec.parseResult,
                rokuResult: rec.rokuResult,
                platform: rec.platform || '',
                rokuModel: rec.rokuModel || '',
                note: rec.note || '',
                updatedAt: rec.updatedAt || null
            });
        }
        return {
            schema: EXPORT_SCHEMA,
            exportedAt: new Date().toISOString(),
            results: rows
        };
    }

    function toCSV(report) {
        function q(v) {
            v = (v === null || v === undefined) ? '' : String(v);
            return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
        }
        var lines = ['schema,exported_at,service,name,source_open,parse_result,roku_result,platform,roku_model,note,updated_at'];
        for (var i = 0; i < report.results.length; i++) {
            var r = report.results[i];
            lines.push([
                q(report.schema), q(report.exportedAt), q(r.service), q(r.name),
                q(r.sourceOpen), q(r.parseResult), q(r.rokuResult),
                q(r.platform), q(r.rokuModel), q(r.note), q(r.updatedAt)
            ].join(','));
        }
        return lines.join('\n');
    }

    function toTextReport(report) {
        var lines = [
            'Couchbeam streaming-service test report',
            'schema: ' + report.schema,
            'exported: ' + report.exportedAt,
            ''
        ];
        for (var i = 0; i < report.results.length; i++) {
            var r = report.results[i];
            var tested = (r.sourceOpen !== 'not-tested' || r.parseResult !== 'not-tested' || r.rokuResult !== 'not-tested')
                ? 'TESTED' : 'not tested';
            lines.push('- ' + r.name + ' [' + tested + '] source=' + r.sourceOpen +
                ' parse=' + r.parseResult + ' roku=' + r.rokuResult +
                (r.platform ? ' platform=' + r.platform : '') +
                (r.rokuModel ? ' roku=' + r.rokuModel : ''));
            if (r.note) lines.push('  note: ' + r.note);
        }
        return lines.join('\n');
    }

    // --- Browser rendering -------------------------------------------------

    var STATE_LABELS = {
        'deep-link-candidate': 'Content deep link candidate',
        'app-launch-only': 'App launch only',
        'needs-validation': 'Parser fixture / needs live validation'
    };

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function serviceMeta() {
        var reg = (typeof window !== 'undefined' && window.QuickbeamRegistry) || { SERVICES: [] };
        var data = (typeof window !== 'undefined' && window.CouchbeamTestHarnessData) || { CARDS: [], cardById: function () { return null; } };
        return reg.SERVICES.map(function (s) {
            return { registry: s, card: data.cardById(s.id) };
        });
    }

    // serviceId -> registry domains and harness card, refreshed on each render
    // so the delegated event handlers can validate the card's input.
    var CARD_DOMAINS = {};
    var CARD_DATA = {};

    function renderCards(filter) {
        var host = document.getElementById('cards');
        if (!host) return;
        var results = loadResults();
        var savedLinks = loadCardLinks();
        var metas = serviceMeta();
        CARD_DOMAINS = {};
        CARD_DATA = {};
        var html = '';
        var missing = [];
        for (var i = 0; i < metas.length; i++) {
            var s = metas[i].registry;
            var c = metas[i].card;
            if (!c) { missing.push(s.id); continue; }
            if (filter && filter !== 'all' && c.state !== filter) continue;
            CARD_DOMAINS[s.id] = s.domains || [];
            CARD_DATA[s.id] = c;
            var rec = results[s.id] || blankRecord(s.id);
            var tested = isTested(rec) ? ' <span class="tested">● tested</span>' : '';
            var linkValue = resolveLink(s.id, c, savedLinks);
            var source = linkSource(s.id, c, savedLinks);
            var check = validateTestUrl(s.domains || [], linkValue);
            var dis = check.ok ? '' : ' disabled';
            var badge = '';
            if (source === 'verified') {
                badge = '<span class="badge badge-verified">Verified current ' + esc(c.liveUrlVerified || '') + '</span>';
            } else if (source === 'saved') {
                badge = '<span class="badge badge-saved">Saved on this device</span>';
            }
            var errHtml = (!check.ok && String(linkValue).trim()) ? esc(check.error) : '';
            html += '<article class="card" data-service="' + esc(s.id) + '" data-state="' + esc(c.state) + '">'
                + '<div class="card-head"><h3>' + esc(s.name) + '</h3>' + tested + '</div>'
                + '<div class="appid">Roku app ID <code>' + esc(s.appId) + '</code></div>'
                + '<div class="state state-' + esc(c.state) + '">' + esc(STATE_LABELS[c.state] || c.state) + '</div>'
                + (c.experimental ? '<div class="flag">Experimental</div>' : '')
                + '<dl class="facts">'
                + '<dt>Support</dt><dd>' + esc(c.support) + '</dd>'
                + '<dt>Parser extracts</dt><dd>' + esc(c.extracts) + '</dd>'
                + '<dt>Web test URL</dt><dd class="needs-link">needs live link — <a href="' + esc(c.homeUrl) + '" target="_blank" rel="noopener">open ' + esc(s.name) + ' home</a>'
                + (c.searchUrl ? ' · <a href="' + esc(c.searchUrl) + '" target="_blank" rel="noopener">search</a>' : '')
                + ', find a real title, and paste its link below.</dd>'
                + '<dt>Parser fixture (unverified)</dt><dd><code class="fixture">' + esc(c.fixtureUrl) + '</code> '
                + '<button class="btn small ghost" data-use-fixture="' + esc(s.id) + '" type="button">Use fixture</button>'
                + '<br><span class="muted">Proves the parser handles the format — not that the page is current. Nothing is sent until you put a link in the box below.</span></dd>'
                + '</dl>'
                + (c.note ? '<p class="note">' + esc(c.note) + '</p>' : '')
                + '<div class="linkbox">'
                + '<label class="linklabel" for="link-' + esc(s.id) + '">Real link to test</label>'
                + '<input type="url" inputmode="url" id="link-' + esc(s.id) + '" data-testlink="' + esc(s.id) + '" value="' + esc(linkValue) + '" placeholder="Paste a real ' + esc(s.name) + ' title link…" autocomplete="off" spellcheck="false">'
                + '<div class="linkmeta">' + badge + '<span class="link-error" id="linkerr-' + esc(s.id) + '"' + (errHtml ? '' : ' hidden') + '>' + errHtml + '</span></div>'
                + '<div class="actions">'
                + '<a class="btn small ghost" href="' + esc(c.homeUrl) + '" target="_blank" rel="noopener">Open service</a>'
                + '<button class="btn small" data-open-title="' + esc(s.id) + '" type="button"' + dis + '>Open title</button>'
                + '<button class="btn small primary" data-send="' + esc(s.id) + '" type="button"' + dis + '>Send to Couchbeam</button>'
                + '<button class="btn small ghost" data-copy-link="' + esc(s.id) + '" type="button"' + dis + '>Copy link</button>'
                + '<button class="btn small ghost" data-parse="' + esc(s.id) + '" type="button"' + dis + '>Test parse</button>'
                + '</div>'
                + '<div class="actions">'
                + '<button class="btn small ghost" data-save-link="' + esc(s.id) + '" type="button"' + dis + '>Save link on this device</button>'
                + '<span class="saved" id="linksaved-' + esc(s.id) + '" hidden>Saved ✓</span>'
                + '</div>'
                + '</div>'
                + '<div class="parse-out" id="parse-' + esc(s.id) + '" hidden></div>'
                + renderResultForm(s, c, rec)
                + '</article>';
        }
        if (missing.length) {
            html = '<div class="error">Harness data missing for: ' + esc(missing.join(', ')) + '</div>' + html;
        }
        host.innerHTML = html || '<p class="muted">No services match this filter.</p>';
        updateProgress(metas, results);
    }

    function selectHtml(name, serviceId, current, choices) {
        var h = '<label>' + esc(name) + ' <select data-field="' + esc(name) + '" data-service="' + esc(serviceId) + '">';
        for (var i = 0; i < choices.length; i++) {
            h += '<option value="' + esc(choices[i]) + '"' + (choices[i] === current ? ' selected' : '') + '>' + esc(choices[i]) + '</option>';
        }
        return h + '</select></label>';
    }

    function renderResultForm(s, c, rec) {
        var h = '<details class="result"><summary>Record test result (stays on this device)</summary><div class="form">';
        h += selectHtml('sourceOpen', s.id, rec.sourceOpen, RESULT_CHOICES.sourceOpen);
        h += selectHtml('parseResult', s.id, rec.parseResult, RESULT_CHOICES.parseResult);
        h += selectHtml('rokuResult', s.id, rec.rokuResult, RESULT_CHOICES.rokuResult);
        h += '<label>Phone platform / browser <input type="text" data-field="platform" data-service="' + esc(s.id) + '" value="' + esc(rec.platform) + '" placeholder="e.g. Android 15 · Chrome 128" maxlength="120"></label>';
        h += '<label>Roku model / OS (optional) <input type="text" data-field="rokuModel" data-service="' + esc(s.id) + '" value="' + esc(rec.rokuModel) + '" placeholder="e.g. Roku Express 4K · 13.0" maxlength="120"></label>';
        h += '<label>Note <textarea data-field="note" data-service="' + esc(s.id) + '" maxlength="2000" placeholder="What happened?">' + esc(rec.note) + '</textarea></label>';
        h += '<button class="btn small primary" data-save="' + esc(s.id) + '" type="button">Save result</button> '
            + '<span class="saved" id="saved-' + esc(s.id) + '" hidden>Saved ✓</span>';
        return h + '</div></details>';
    }

    function updateProgress(metas, results) {
        var el = document.getElementById('progress');
        if (!el) return;
        var tested = 0;
        for (var i = 0; i < metas.length; i++) {
            var rec = results[metas[i].registry.id];
            if (isTested(rec)) tested++;
        }
        el.textContent = tested + ' of ' + metas.length + ' services have a recorded result';
    }

    // Reads the card's "Real link to test" input; updates the mismatch
    // error and enables/disables the actions without a full re-render
    // (so typing never loses focus).
    function refreshLinkUi(serviceId) {
        var input = document.querySelector('[data-testlink="' + serviceId + '"]');
        if (!input) return;
        var domains = CARD_DOMAINS[serviceId] || [];
        var check = validateTestUrl(domains, input.value);
        var err = document.getElementById('linkerr-' + serviceId);
        if (err) {
            if (!check.ok && String(input.value).trim()) {
                err.textContent = check.error;
                err.hidden = false;
            } else {
                err.hidden = true;
            }
        }
        var card = input.closest('article');
        if (card) {
            var btns = card.querySelectorAll('[data-open-title],[data-send],[data-copy-link],[data-parse],[data-save-link]');
            for (var i = 0; i < btns.length; i++) btns[i].disabled = !check.ok;
        }
    }

    function currentLinkInputValue(serviceId) {
        var input = document.querySelector('[data-testlink="' + serviceId + '"]');
        return input ? input.value : '';
    }

    // The validated tester-supplied URL for this card, or null. Actions must
    // use this — never the parser fixture.
    function currentLinkValue(serviceId) {
        var v = validateTestUrl(CARD_DOMAINS[serviceId] || [], currentLinkInputValue(serviceId));
        return v.ok ? v.url : null;
    }

    function runParsePreview(serviceId) {
        var out = document.getElementById('parse-' + serviceId);
        var input = document.querySelector('[data-testlink="' + serviceId + '"]');
        var domains = CARD_DOMAINS[serviceId] || [];
        if (!out || !input) return;
        out.hidden = false;
        var check = validateTestUrl(domains, input.value);
        if (!check.ok) {
            out.innerHTML = '<span class="warn">' + esc(check.error) + ' — paste a real link above first.</span>';
            return;
        }
        try {
            var reg = window.QuickbeamRegistry;
            var url = new URL(check.url);
            var svc = reg.findService(url);
            if (!svc || svc.id !== serviceId) {
                out.innerHTML = '<span class="warn">Test link no longer matches this service in the registry.</span>';
                return;
            }
            var parsed;
            try {
                parsed = svc.parse(url);
            } catch (e) {
                out.innerHTML = '<span class="warn">Parser needs a Node-only API in this browser (' + esc(e.name) + '). Link still valid for server-side parsing.</span>';
                return;
            }
            if (!parsed) {
                out.innerHTML = '<span class="warn">No match — parser returned null for the test link.</span>';
            } else {
                out.innerHTML = 'Parser extracts <code>contentId=' + esc(parsed.contentId) + '</code> <code>mediaType=' + esc(parsed.mediaType) + '</code>';
            }
        } catch (e) {
            out.innerHTML = '<span class="warn">Could not parse test link.</span>';
        }
    }

    function copyText(text, done) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
        } else {
            var ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            var ok = false;
            try { ok = document.execCommand('copy'); } catch (e) { /* ignore */ }
            document.body.removeChild(ta);
            done(ok);
        }
    }

    function download(filename, text, mime) {
        var blob = new Blob([text], { type: mime || 'text/plain' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(function () {
            URL.revokeObjectURL(a.href);
            a.remove();
        }, 500);
    }

    function serviceMetaList() {
        var reg = (typeof window !== 'undefined' && window.QuickbeamRegistry) || { SERVICES: [] };
        return reg.SERVICES.map(function (s) { return { id: s.id, name: s.name }; });
    }

    function init() {
        if (typeof document === 'undefined') return;
        renderCards('all');
        document.addEventListener('input', function (ev) {
            var t = ev.target;
            if (t && t.dataset && t.dataset.testlink) {
                // Session-only: typed links are never persisted implicitly.
                setSessionLink(t.dataset.testlink, t.value);
                refreshLinkUi(t.dataset.testlink);
            }
        });
        document.addEventListener('click', function (ev) {
            var t = ev.target;
            if (t && t.dataset) {
                if (t.dataset.openTitle) {
                    var u1 = currentLinkValue(t.dataset.openTitle);
                    if (u1) window.open(u1, '_blank', 'noopener');
                } else if (t.dataset.send) {
                    var u2 = currentLinkValue(t.dataset.send);
                    if (u2) window.location.href = shareHref(u2);
                } else if (t.dataset.copyLink) {
                    var u3 = currentLinkValue(t.dataset.copyLink);
                    if (u3) copyText(u3, function (ok) { t.textContent = ok ? 'Copied ✓' : 'Copy failed'; });
                } else if (t.dataset.useFixture) {
                    var fid = t.dataset.useFixture;
                    var fcard = CARD_DATA[fid];
                    var finput = document.querySelector('[data-testlink="' + fid + '"]');
                    if (fcard && finput) {
                        // Explicit opt-in: the fixture becomes the tester's
                        // session link for this card.
                        finput.value = fcard.fixtureUrl;
                        setSessionLink(fid, fcard.fixtureUrl);
                        refreshLinkUi(fid);
                    }
                } else if (t.dataset.saveLink) {
                    var sid = t.dataset.saveLink;
                    var res = saveCardLink(sid, currentLinkInputValue(sid), CARD_DOMAINS[sid] || []);
                    if (res.ok) {
                        renderCards(currentFilter());
                        var savedEl = document.getElementById('linksaved-' + sid);
                        if (savedEl) { savedEl.hidden = false; setTimeout(function () { savedEl.hidden = true; }, 2000); }
                    } else {
                        alert('Cannot save: ' + res.error);
                    }
                } else if (t.dataset.parse) {
                    runParsePreview(t.dataset.parse);
                } else if (t.dataset.save) {
                    var id = t.dataset.save;
                    var patch = {};
                    var fields = document.querySelectorAll('[data-service="' + id + '"][data-field]');
                    for (var i = 0; i < fields.length; i++) patch[fields[i].dataset.field] = fields[i].value;
                    var errs = validateRecord(Object.assign({ service: id }, patch));
                    if (errs.length) { alert('Cannot save: ' + errs.join('; ')); return; }
                    setRecord(id, patch);
                    var saved = document.getElementById('saved-' + id);
                    if (saved) { saved.hidden = false; setTimeout(function () { saved.hidden = true; }, 2000); }
                    renderCards(currentFilter());
                } else if (t.dataset.filter) {
                    setFilter(t.dataset.filter);
                } else if (t.id === 'copy-report') {
                    var report = buildReport(loadResults(), serviceMetaList());
                    copyText(toTextReport(report), function (ok) { t.textContent = ok ? 'Copied ✓' : 'Copy failed'; setTimeout(function () { t.textContent = 'Copy session report'; }, 2000); });
                } else if (t.id === 'dl-json') {
                    var rj = buildReport(loadResults(), serviceMetaList());
                    download('couchbeam-test-report.json', JSON.stringify(rj, null, 2), 'application/json');
                } else if (t.id === 'dl-csv') {
                    var rc = buildReport(loadResults(), serviceMetaList());
                    download('couchbeam-test-report.csv', toCSV(rc), 'text/csv');
                } else if (t.id === 'reset-results') {
                    if (confirm('Delete all locally stored test results on this device?')) {
                        resetResults();
                        renderCards(currentFilter());
                    }
                }
            }
        });
    }

    function currentFilter() {
        var active = document.querySelector('[data-filter].on');
        return active ? active.dataset.filter : 'all';
    }

    function setFilter(f) {
        var btns = document.querySelectorAll('[data-filter]');
        for (var i = 0; i < btns.length; i++) {
            btns[i].classList.toggle('on', btns[i].dataset.filter === f);
        }
        renderCards(f);
    }

    var api = {
        STORAGE_KEY: STORAGE_KEY,
        EXPORT_SCHEMA: EXPORT_SCHEMA,
        LINK_STORAGE_KEY: LINK_STORAGE_KEY,
        RECORD_FIELDS: RECORD_FIELDS,
        RESULT_CHOICES: RESULT_CHOICES,
        blankRecord: blankRecord,
        loadResults: loadResults,
        saveResults: saveResults,
        setRecord: setRecord,
        resetResults: resetResults,
        validateRecord: validateRecord,
        isTested: isTested,
        validateTestUrl: validateTestUrl,
        shareHref: shareHref,
        setSessionLink: setSessionLink,
        clearSessionLinks: clearSessionLinks,
        loadCardLinks: loadCardLinks,
        saveCardLink: saveCardLink,
        clearCardLinks: clearCardLinks,
        resolveLink: resolveLink,
        linkSource: linkSource,
        buildReport: buildReport,
        toCSV: toCSV,
        toTextReport: toTextReport,
        init: init
    };

    if (typeof window !== 'undefined') { window.CouchbeamTestHarness = api; }
    if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else {
            init();
        }
    }
})();
