# Quickbeam — Business Plan (v0.1, 2026-09-17)

> Status: draft. Research-backed, awaiting instinct's market-side review (issue #15).
> Non-goals for v1: corporate IT, on-TV advertising, paid acquisition.

## 1. The opportunity in one paragraph

Every family has a CIO — the person everyone calls when the TV "isn't working."
Quickbeam lets that person send any streaming link as a magic link: the recipient
opens it on their phone at home, taps their TV, and it plays. Zero installs, zero
accounts, zero 45-minute phone calls. The wedge is **remote family tech support**;
the first paid revenue comes from **hospitality**; advertising starts as
**sender-side streaming affiliate cards**, not programmatic display.

## 2. Customer segments (ranked)

### Beachhead #1 — Social / family (free → freemium)
- **Fit:** highest. Zero-install is the entire differentiator vs TeamViewer/AnyDesk,
  which require the less-technical person to install software. Here, the
  less-technical person just taps a link.
- **Demand signal:** remote-support spend is proven (TeamViewer $24.90–$245.90/mo;
  Splashtop from $6/mo), but consumer willingness to pay is low (~$3–5/mo).
- **Role in the business:** zero-CAC growth engine. Every recipient sees the
  product; optimize for word of mouth, monetize lightly later.

### Beachhead #2 — Hospitality (first paid wedge)
- Airbnb hosts and senior-living activities directors pay for guest-experience
  add-ons; zero-install is a feature for non-technical staff.
- Senior living overlaps the family use case directly (adult child → resident's TV).
- **Pricing anchor:** signage SaaS is $8–20/screen/mo (Yodeck $8–16, ScreenCloud
  from $20, UPshow from $50). Quickbeam hospitality: **~$5–15/mo per property/TV**
  — cheaper than signage, justified by guest experience.
- **Validation needed:** 3–5 host interviews to pin pricing (open question §7).

### Later — Events
- Venues provably spend on TV control (bars buy $10k+ AV-over-IP; Spectrum
  launched venue TV control July 2026), but their core need is live sports/cable
  sync across many screens, not episodic deep links.
- Credible v2: "venue mode" — queued promos + highlight reels. Not v1.

### Later — Retail
- Signage SaaS proves $8–20+/screen/mo WTP, but retail needs always-on scheduled
  playlists. Quickbeam is only a "poor man's signage" for tiny shops. Revisit post-PMF.

### Avoid for now — Corporate
- Real budgets ($50–120+/mo tooling) but worst fit: IT wants managed, audited
  estates; conference rooms run Zoom/Teams Rooms, not Roku; a magic link is a
  security-review nightmare, not a selling point.

## 3. Freemium & trial model (phased)

### Phase 1 — Free + usage-capped Pro (build now)
- **Free:** 5 launched links/month, 1 TV per recipient, standard link expiry.
- **Pro — $3.99/mo or $29.99/yr:** unlimited launches, multi-TV, link history.
- **Why usage caps:** they bite exactly when the product is mission-critical
  (sender hits "5 of 5 used" mid-family-movie-night). Research: usage caps convert
  better than feature gating; 14-day trials are the modal length and convert ~2x
  freemium. Infra is just a counter — shippable now.

### Phase 2 — Ad-supported free, paid removes ads
- **Free (ad-supported):** sender-side affiliate/ad modules only — never on the
  recipient's TV (founder constraint).
- **Ad-free tier — $1.99/mo or $14.99/yr**, anchored to Roku-remote-app IAP norms
  ($3–4 one-time).

### Phase 3 — Reverse trial (post-PMF)
- 14 days of full Pro on signup, then drop to the thin free tier. Highest
  conversion per research, but needs paywall infra first — not v1.

## 4. Advertising model — affiliate-first, sender-side only

**Decision: skip Roku's ad platform and programmatic at launch.**
- Roku Ads Manager is buy-side only (for advertisers buying CTV inventory) —
  there is no Roku web-publisher network to join.
- AdSense has no minimums (68% rev share, ~$1–5 RPM) but yields pennies
  pre-distribution, is cookie-heavy, and loses 20–40% to ad blockers.
  Ezoic/Mediavine need 10k–50k sessions. Add AdSense as a *filler* later.

**Start with streaming affiliate cards (Impact + FlexOffers):**
- Paramount+: **$9 per confirmed subscription**, 30-day cookie
- Hulu: **$1.60/trial, $9.60/paid subscription**, 14-day cookie
- Sling: **~20% commission**; Peacock via FlexOffers
- (Netflix and Disney+ have no public affiliate programs.)
- No minimums, no fees, no third-party ad scripts, survives ad blockers.
- Format: a hand-designed "Don't have it? Try Paramount+ free" module on the
  **sender page only** — a weekend of work.
- The math beats display at tiny scale: even 0.3–0.5% sender-to-signup conversion
  out-earns a $5 RPM.

**Scale path:** affiliate cards → AdSense filler in the same slot → Ezoic at
10k pageviews/mo. Build the sender-side slot from day one so the revenue path is
a config flip, not a rebuild.

## 5. Go-to-market & validation

1. **Interest list as instrument** — the marketing site (`website/`, PR #19)
   collects phone/email + ZIP + top channels. Use it to price-test: $3.99/mo
   anchor vs tip-jar framing, and to rank which services to perfect first.
2. **Word of mouth** — every magic-link recipient is a demo. Add sender referral
   nudge post-launch ("Know another family CIO?").
3. **Hospitality outreach** — 3–5 Airbnb host interviews, then a pilot tier at
   $5–15/mo per property.
4. **No paid acquisition** until affiliate revenue funds it.

## 6. What else makes this a full business opportunity

- **Link history & favorites (Pro):** senders re-send the same shows; history is
  a retention hook and a paywall feature.
- **Scheduled sends:** "movie night every Friday" — recurring value, Pro feature.
- **Multi-TV households:** per-recipient TV management is the natural Pro upsell.
- **Venue mode (v2):** queued promos/highlights for bars and event spaces.
- **White-label for senior-living chains:** activities directors as a B2B channel.
- **Data moat (careful):** aggregated, anonymized "what's being sent" trends could
  inform programming partnerships — only with clear consent, never PII.

## 7. Open questions (for instinct)

1. Consumer WTP is inferred, not Quickbeam-specific — validate via the interest
   form with price anchors.
2. Hospitality pricing needs 3–5 host interviews.
3. **Tension:** the founder constrained ads to sender-side only; one research
   thread argued recipient-page ads convert better (social awkwardness as a
   lever). Recommendation here: hold the founder's line for v1 — trust with
   grandparents is the brand. Revisit post-PMF.
4. Tier naming and the exact free-launch cap (5/mo is the proposal).
5. Whether the Pro price anchor should be $3.99/mo or lower to match the
   ~$3–5/mo consumer WTP band.
