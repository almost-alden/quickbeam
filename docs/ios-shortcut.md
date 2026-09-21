# iOS share path for Quickbeam — the $0 beta recipe

**The honest platform truth:** iOS Safari does not support the Web Share Target
API, and no PWA, website, or configuration can put Quickbeam in the iOS share
sheet. That is an Apple platform limit. What follows are the real options,
in order.

## Option A — "Send to Quickbeam" Shortcut (now, $0, no review)

A Shortcut with share-sheet visibility **does** appear in every iOS app's
share menu (under the Shortcuts row). It grabs the shared URL and opens the
Quickbeam `/share` page with it. This is the beta path.

### Setup (do once per iPhone/iPad)

1. Open the **Shortcuts** app and tap **+** (new shortcut).
2. Tap the name at the top, rename it **“Send to Quickbeam”**.
3. Tap **ⓘ** (details) → turn on **Show in Share Sheet**.
4. Under *Share Sheet types*, uncheck everything except **URLs**.
5. Add action: search **“URL Encode”**, add it, and set its input to
   **Shortcut Input** (tap the field → select the *Shortcut Input* variable).
6. Add action: search **“Text”**, add it, and type exactly:

   ```
   https://YOUR-HOST/share?url=
   ```

   then place the cursor right after the `=` and insert the
   **URL Encoded Result** variable (tap the variable bar above the keyboard).
   Replace `YOUR-HOST` with the real Firebase Hosting domain.
7. Add action: search **“Open URLs”**, add it, and set it to the **Text**
   variable from step 6.
8. Tap **Done**.

### Use

In YouTube, Safari, Chrome, Messages, or any app: **Share → Shortcuts →
Send to Quickbeam**. The `/share` page opens with the link pre-loaded:
preview it, tap **Create magic link**, and open the result on the home phone.

### Troubleshooting

- *Shortcut doesn't appear in the share sheet:* re-open its ⓘ details and
  confirm **Show in Share Sheet** is on and **URLs** is checked.
- *The /share page says "Nothing shared yet":* the shared item wasn't a URL
  (e.g. a photo). Paste the link into the paste box on the page instead.
- *The link opens but shows "not configured":* the Firebase project from
  `docs/firebase-spark-launch.md` isn't set up yet.

## Option B — Add to Home Screen + paste (now, $0)

In Safari: **Share → Add to Home Screen**. One-tap launching; paste links
into the box on `/share`. No share-sheet presence, but zero setup beyond
the bookmark.

## Option C — Native iOS app with Share Extension (late beta)

The **only** way to get a first-class Quickbeam icon directly in the iOS
share sheet is a native app with a Share Extension. That requires:

- Apple Developer Program membership (**$99/year** — a spend decision),
- a minimal app + Share Extension built in Xcode,
- TestFlight for beta distribution.

**Explicitly a later milestone, not this home test.** When it's approved,
the extension's job is tiny: receive the shared URL and open
`https://YOUR-HOST/share?url=<encoded>` — every line of parsing, preview,
and link creation already lives in the PWA.
