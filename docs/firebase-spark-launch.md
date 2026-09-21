# Couchbeam home test — Firebase Spark launch

Zero-backend home test for Couchbeam on the Firebase **Spark (no-cost) plan**.
No Cloud Run, no Cloud Functions, no App Hosting, no billing account, no domain
purchase. Static Firebase Hosting serves the PWA; Cloud Firestore (Standard)
is the shared store, written directly from browsers over REST.

Branch: `failden/firebase-spark-launch` · PR: *(link added when opened)*

## Why this shape

The deciding architecture fact: the Roku ECP launch happens in the
**recipient's browser** — `magic.html` talks directly to
`http://<roku-ip>:8060` from the phone on home Wi-Fi. The relay server never
touches the Roku. So the relay's jobs collapse to things the client can do:

| Relay job | Spark replacement |
|---|---|
| Parse streaming URLs (registry) | Baked client-side: `js/registry-client.js` (generated from `relay/services.js`) |
| Magic-link storage + TTL | Firestore `magic_links`, 24h `expiresAt`, capability-URL ids |
| Device registration / pairing | Firestore `devices` + `pairing_codes` (1h), written by the home browser |
| Serve the pages | Firebase Hosting (static) |

The Node relay (`relay/server.js`) is **not deployed** in this plan. It remains
in the repo for the home-network configuration (serving the same pages from a
machine on the LAN, e.g. lenny); every page tries its `/api/*` endpoints first
and falls back to Firestore when they are absent (`js/qb.js`).

## Remaining backend dependency

**None for the v1 home test.** Everything in the send → preview → play loop
runs client-side against Firestore, with `firestore.rules` as the security
boundary.

Explicitly deferred (not needed for a family home test, required before any
public launch):

- **Rate limiting / abuse protection.** Firestore rules validate shape but not
  velocity. A public launch needs per-IP quotas (Cloud Functions or App Check).
- **Title scraping.** The relay's `scrapeTitle` fetched the source page
  server-side; browsers can't (CORS). Senders type titles manually for now.
- **Service requests** (`/api/service-request`) still need the Node relay.
- **TTL enforcement is client-side + TTL policy.** Rules cap `expiresAt`
  (25h/65m); set a Firestore TTL policy on `expiresAt` in the console so
  expired docs are actually deleted. Until then, `qb.js` treats expired docs
  as 410.

## Deploy steps (do NOT run without the user's explicit approval)

1. Create a **new, dedicated** Firebase project (console.firebase.google.com).
   Do NOT reuse a project that has billing linked.
2. In the console: **Firestore Database → Create database → Standard edition**,
   same region as your users (e.g. `us-east1`).
3. **Firestore → Rules**: paste `firestore.rules` from this repo, publish.
4. **Firestore → TTL policies**: add a TTL policy on the `expiresAt` field for
   `magic_links` and `pairing_codes`.
5. Fill in `relay/public/js/firebase-config.js` with the real project id and
   Web API key (Project settings → General). The key is public by design;
   security comes from the rules, not the key.
6. `npx firebase-tools deploy --only hosting,firestore:rules`
   (firebase.json points hosting at `relay/public`).

> ### ⚠️ HARD WARNING — billing upgrades the project to Blaze
>
> Linking **any** billing account to this project — even just to "enable" a
> feature — **permanently moves it off the Spark plan to Blaze**
> (pay-as-you-go). There is no supported downgrade path back to Spark; you
> would need a brand-new project. For the home test, nothing requires
> billing. If a future step ever asks for billing, stop and get explicit
> approval first.

## Spark free quotas (more than enough for a home test)

- **Firestore:** 50k reads / 20k writes / 20k deletes per day, 1 GiB storage.
  A magic-link create is 1 write; a recipient open is 1–3 reads. A family will
  not dent this.
- **Firebase Hosting:** 10 GB storage, 360 MB/day transfer. The whole PWA is
  under 2 MB.
- Idle cost: **$0**. Active cost at home-test volume: **$0**.

## Mixed-content engineering

Firebase Hosting is HTTPS-only. Roku ECP is `http://<lan-ip>:8060`. Browsers
block `fetch()`/XHR from an HTTPS page to an `http://` LAN address as mixed
content. Couchbeam handles it like this (see `js/roku-probe.js`):

- **Launch** already worked: a hidden `<form method="POST">` into a hidden
  `<iframe>` targets the Roku URL. Form navigation is not a fetch, so browsers
  permit it. (`magic.html` has used this trick; `roku-probe.js` centralizes it.)
- **Device discovery** (`/query/device-info`) cannot use `fetch()` on HTTPS —
  and the response couldn't be read cross-origin anyway. So on `https:` pages
  `probeStrategy()` returns `'manual-confirm'`: the address is stored as an
  *unverified* candidate and the existing post-launch confirm prompt verifies
  it with the user. On `http:` pages (Node relay on the LAN) the `fetch`
  probe is kept.
- `devices` rules only accept RFC 1918 addresses, so a malicious page can
  never aim this flow at a public host.

## firestore.rules — review checklist

- [ ] Default deny present (`match /{document=**} { allow read, write: if false; }`).
- [ ] No `allow ... if true` anywhere except none — every allow is scoped.
- [ ] `allow list: if false` on all three collections (no enumeration).
- [ ] `allow get` only with an id-shape regex (capability URLs).
- [ ] `create` uses `keys().hasOnly([...])` — no extra fields smuggled in.
- [ ] `expiresAt` bounded: magic_links ≤ createdAt + 25h, pairing_codes ≤ +65m.
- [ ] `localIp` restricted to RFC 1918 regexes.
- [ ] `originalUrl` must start with `https://`.
- [ ] No `update`/`delete` allowed from clients.
- [ ] `mediaType` is an allowlist matching the registry's values.

(The Jest suite asserts the static properties of this list; the semantic
review is a human pass before first deploy.)

## No-PII statement

The Firestore magic-link model carries **no** sender name, contact, or
identifier fields — there is nothing to leak. Device docs carry only a LAN IP
and a TV label. No analytics, no trackers, no third-party scripts anywhere in
the served pages (Firestore is reached via first-party `fetch`, not the
gstatic SDK). Verified by `relay/tests/no-pii.test.js`.

## What was salvaged from PR #26 (GCP plan)

- The **store interface design and data model** (magic links with TTL,
  device/pairing records, cross-user isolation thinking) — re-expressed as
  Firestore collections + client REST instead of Admin SDK adapters.
- The **no-PII page assertions** approach, extended to the new pages.
- The **demo beta wording** (free demo, experimental compatibility,
  same-Wi-Fi, no guarantees) — carried into the landing and share pages.
- **Not carried over:** the Cloud Run deployment, `server.js` store adapters,
  Dockerfile changes, and `docs/home-test-launch.md`. PR #26 stays open but
  is superseded by this plan.

## File map

- `firebase.json` — hosting (`relay/public`, rewrites for `/share`, `/send`,
  `/magic/**`, `/about`, `/support`) + `firestore.rules` ref.
- `.firebaserc` — placeholder project id; **the project does not exist yet.**
- `firestore.rules` — the security boundary (see checklist above).
- `relay/public/index.html` — new landing page (Couchdrop aesthetic, system fonts).
- `relay/public/send.html` — the sender dashboard, moved from `index.html`.
- `relay/public/share.html` — Web Share Target handler (`/share`).
- `relay/public/js/` — `registry-client.js` (generated), `share.js`,
  `firebase-config.js`, `firestore-rest.js`, `roku-probe.js`, `qb.js`.
- `relay/build-registry-client.js` — regenerates the client registry.
- `docs/ios-shortcut.md` — the $0 iOS share-sheet path.
