# Quickbeam home-test launch — deployment plan

Status: **proposed, not deployed.** This document describes the exact
target state for the home-test launch with a public free-demo path.
Nothing here has been created: no GCP project, no deployment, no billing
change, no domain purchase, no data-collecting page live. Every step that
touches cloud resources, billing, or a public data-collecting page needs
Johnny's explicit approval first (standing gates from issue #15).

The code side (branch `failden/home-test-launch`) is ready for review:

- `relay/store/` — store interface + memory adapter (default) +
  Firestore adapter (`QB_STORE=firestore`).
- `GET /demo` — public free-demo landing page. Form-free, script-free,
  analytics-free; links into the existing sender flow at `/`. PR #19's
  early-access signup form is deliberately **not** part of this path.
- Tests: 79/79 green (`relay/`), including store contract tests
  (instance replacement, TTL expiry, cross-user isolation) and demo
  no-PII tests.

## 1. GCP project

- **Dedicated Quickbeam-only project** (no shared projects; never touch
  other GCP projects from this workstream).
- **Proposed region: `us-east1`** (South Carolina — closest to the home
  testers, EDT). The Cloud Run service and the Firestore database must
  live in the **same region** to avoid cross-region latency and egress.
- Firestore **Native mode** database in `us-east1`. Note: the Firestore
  region/mode choice is **one-time per project** — get it right before
  writing data.
- APIs to enable on the project: `run.googleapis.com`,
  `firestore.googleapis.com`, `billingbudgets.googleapis.com` (for the
  budget alert below).

## 2. Firestore

- Mode: **Native**. Location: `us-east1` (same as Cloud Run).
- Collections (names configurable via env, defaults shown):
  `magic_links`, `devices`, `pairing_codes`.
- **Indexes: none required.** The only query is an equality filter on the
  single field `publicIp` (`devices` collection), which Firestore's
  automatic single-field indexes already cover. No composite indexes.
- **TTL policies (required):** enable a Firestore TTL policy on the
  `expiresAt` field for each of the three collections, so expired magic
  links (24h), devices (1h), and pairing codes (1h) are reclaimed
  server-side. The relay also enforces TTL in code on every read, so
  behavior is correct even before the TTL sweeper runs.
  Console path per collection: *Firestore Studio → (collection) → ⋮ →
  Manage TTL policy → field `expiresAt` → Enable.*
  (Equivalent gcloud, for reference only — do not run without approval:
  `gcloud firestore fields ttls update --collection-group=<name>
  --field=expiresAt --enable-ttl --project=<project-id>`.)
- Security rules: the relay uses the Admin SDK with the runtime service
  account, so Firestore security rules do not gate it; keep the database
  locked down (no public client access) since all access goes through
  Cloud Run.

## 3. Cloud Run service

| Setting | Value |
|---|---|
| Billing | Request-based (pay per use) |
| CPU / memory | **1 vCPU / 512 MiB** |
| Min instances | **0** (scale to zero; $0 idle) |
| Max instances | **1** (single warm instance; matches the disclosed beta limitation) |
| Concurrency | **20** (conservative; default is 80 — 20 keeps per-request memory headroom on a 512 MiB instance under home-test load) |
| CPU throttling | Throttled (default; fine for request-driven traffic) |
| Ingress | All (public demo path) |
| Authentication | Allow unauthenticated invocations (public demo + sender flow) |
| Timeout | 60s |
| Execution environment | Default (first gen is fine; second gen optional) |

Container: `relay/Dockerfile` (`npm ci --only=production`, `node server.js`,
listens on `$PORT`). The Dockerfile copies `server.js`, `registry.js`,
`deeplink.js`, `services.js`, `store/`, and `public/`.

## 4. IAM

- Grant the Cloud Run **runtime service account**
  `roles/datastore.user` on the Quickbeam-only project. That is the only
  GCP permission the relay needs (read/write the three collections).
- The human deploying needs `roles/run.admin` and
  `roles/iam.serviceAccountUser` on the project — a manual, approved step.
- No service-account keys are created, downloaded, or committed. The
  repo contains **zero** secrets or service-account material by design;
  the Firestore client authenticates via Application Default Credentials
  from the runtime service account.

## 5. Environment variables

| Variable | Value for home-test | Notes |
|---|---|---|
| `QB_STORE` | `firestore` | `memory` is the local-dev default |
| `QB_GCP_PROJECT` | `<quickbeam project id>` | Optional: the client auto-detects the project on Cloud Run |
| `QB_STORE_COLLECTION_MAGIC` | `magic_links` | default; override per environment |
| `QB_STORE_COLLECTION_DEVICES` | `devices` | default |
| `QB_STORE_COLLECTION_PAIRING_CODES` | `pairing_codes` | default |
| `PORT` | (set by Cloud Run) | `server.js` falls back to 18000 locally |
| `NODE_ENV` | `production` | set in Dockerfile |
| `SERVICE_REQUEST_FILE` | unset (default `~/.quickbeam/service-requests.jsonl`) | container disk is ephemeral — sender service-requests do not survive instance replacement; acceptable for home-test, must be revisited before any public launch |

## 6. Cost picture (assumptions)

Basis: `us-east1`, 1 vCPU / 512 MiB, 0 min / 1 max instances,
concurrency 20, home-test traffic (a handful of users, dozens of magic
links/day).

- **Idle cost: $0.** Min instances 0 means no vCPU/memory billing when no
  requests are in flight, and Firestore charges nothing at rest inside
  the free tier.
- **Active cost: near $0.** Cloud Run bills vCPU + memory per 100 ms of
  request handling plus a small per-request charge; Firestore Native free
  tier covers 50k reads / 20k writes / 20k deletes per day and 1 GiB
  storage. Home-test volume sits orders of magnitude below those lines.
  Realistic monthly total: **$0, pennies at most**.
- **Budget guardrail (recommended at deploy time):** create a billing
  budget of **$5/month** on the project at 50%/100% alert thresholds —
  cheap insurance against a misconfiguration.

**Assumptions that change the monthly cost** (flag before approving):

1. Raising **min instances above 0** — the single biggest lever; even
   min=1 on 1 vCPU/512 MiB bills 24/7 (~$25–45/mo depending on region).
2. Traffic growth beyond the Firestore free tier (50k reads/day) or
   sustained Cloud Run CPU (long scrapes, heavy use).
3. Enabling the **early-access data-collecting page** (PR #19) — adds
   Firestore writes/storage and a data-governance surface; separately
   gated, not part of this launch.
4. Cross-region egress if any dependency (or a future second region) is
   placed outside `us-east1`.
5. Switching Firestore to Datastore mode or adding composite indexes —
   not needed for this design.

## 7. What is deliberately out of scope

- No merge of this branch without instinct's review (his explicit gate).
- No `gcloud` runs, no resource creation, no billing changes, no domain
  purchase, no public data-collecting page — all await Johnny's approval
  of the final cost/blast-radius state.
- The public demo path collects nothing and links only to `/`; the
  PR #19 early-access form stays out unless separately approved.

## 8. Note on the deployment-facts check (issue #15)

instinct's second note asks for current Quickbeam-only GCP facts from the
deployment source or console (project ID, billing label, Cloud Run
service config, env var keys, Firestore status, MTD cost, budgets).
**Failden has no live Quickbeam GCP deployment on file** — no project was
created in this workstream, and this repo contains no deployment
artifacts or console access. Those facts can only come from Johnny's
console (or a deployer he designates) once a project exists. Failden can
execute the exact approved deployment after Johnny approves the final
cost/blast-radius state, using branch + PR for code and without touching
other GCP projects — but the Cloud Run deploy step itself needs a human
with `run.admin` on the new project, since Failden has no `gcloud`
access by design.
