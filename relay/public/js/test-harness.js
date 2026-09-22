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

    function renderCards(filter) {
        var host = document.getElementById('cards');
        if (!host) return;
        var results = loadResults();
        var metas = serviceMeta();
        var html = '';
        var missing = [];
        for (var i = 0; i < metas.length; i++) {
            var s = metas[i].registry;
            var c = metas[i].card;
            if (!c) { missing.push(s.id); continue; }
            if (filter && filter !== 'all' && c.state !== filter) continue;
            var rec = results[s.id] || blankRecord(s.id);
            var tested = isTested(rec) ? ' <span class="tested">● tested</span>' : '';
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
                + '</dd>'
                + '<dt>Parser fixture</dt><dd><code class="fixture">' + esc(c.fixtureUrl) + '</code> <span class="muted">(unverified — proves the parser handles the format, not that the page is current)</span></dd>'
                + '</dl>'
                + (c.note ? '<p class="note">' + esc(c.note) + '</p>' : '')
                + '<div class="actions">'
                + '<a class="btn small" href="' + esc(c.homeUrl) + '" target="_blank" rel="noopener">Open source link</a>'
                + '<a class="btn small" href="/share?url=' + encodeURIComponent(c.fixtureUrl) + '">Send to Couchbeam</a>'
                + '<button class="btn small ghost" data-copy="' + esc(c.fixtureUrl) + '" type="button">Copy link</button>'
                + '<button class="btn small ghost" data-parse="' + esc(s.id) + '" type="button">Test parse</button>'
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

    function runParsePreview(serviceId) {
        var out = document.getElementById('parse-' + serviceId);
        var metas = serviceMeta();
        var meta = null;
        for (var i = 0; i < metas.length; i++) {
            if (metas[i].registry.id === serviceId) { meta = metas[i]; break; }
        }
        if (!out || !meta) return;
        out.hidden = false;
        try {
            var reg = window.QuickbeamRegistry;
            var url = new URL(meta.card.fixtureUrl);
            var svc = reg.findService(url);
            if (!svc || svc.id !== serviceId) {
                out.innerHTML = '<span class="warn">Fixture URL no longer matches this service in the registry.</span>';
                return;
            }
            var parsed;
            try {
                parsed = svc.parse(url);
            } catch (e) {
                out.innerHTML = '<span class="warn">Parser needs a Node-only API in this browser (' + esc(e.name) + '). Fixture still valid for server-side parsing.</span>';
                return;
            }
            if (!parsed) {
                out.innerHTML = '<span class="warn">No match — parser returned null for the fixture URL.</span>';
            } else {
                out.innerHTML = 'Parser extracts <code>contentId=' + esc(parsed.contentId) + '</code> <code>mediaType=' + esc(parsed.mediaType) + '</code>';
            }
        } catch (e) {
            out.innerHTML = '<span class="warn">Could not parse fixture URL.</span>';
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
        document.addEventListener('click', function (ev) {
            var t = ev.target;
            if (t && t.dataset) {
                if (t.dataset.copy) {
                    copyText(t.dataset.copy, function (ok) { t.textContent = ok ? 'Copied ✓' : 'Copy failed'; });
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
        RECORD_FIELDS: RECORD_FIELDS,
        RESULT_CHOICES: RESULT_CHOICES,
        blankRecord: blankRecord,
        loadResults: loadResults,
        saveResults: saveResults,
        setRecord: setRecord,
        resetResults: resetResults,
        validateRecord: validateRecord,
        isTested: isTested,
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
