# Quickbeam Developer Handover & Context ⚡️

This file is automatically loaded by Antigravity as project-scoped behavior rules. It provides context for resuming development and deployment of the Quickbeam remote Roku bridge.

---

## 🚀 Active Production Environment
* **Relay Server URL:** `https://quickbeam-relay-470817308605.us-central1.run.app`
* **GCP Project ID:** `quickbeam-prod`
* **GCP Authenticated User:** `jwlehane@gmail.com`
* **Local Cloud CLI Path:** `/home/gatekeeper/google-cloud-sdk/bin/gcloud`
* **Custom Domain Mapping:** Next step is custom domain mapping (`quickbeam.johnnylehane.com`) on GoDaddy. Check `gcp_deployment_guide.md` in the agent's brain directory for instructions.

---

## 🛠 Features Implemented in the Current Version
1. **PWA Support:** Standalone configuration, Outfit themes, maskable neon lightning bolt icon. Uses `relay/public/manifest.json`.
2. **Offline Caching:** Service Worker (`sw.js`) intercepts and caches index, magic pages, and assets.
3. **Web Share Target API:** Intercepts shared links from mobile apps (like YouTube or Netflix) and auto-populates the Video URL input box.
4. **Contacts Directory:** Allows saving recipient names and pairing codes locally. Generates pre-paired magic links and triggers the native Web Share API (SMS/WhatsApp popup) on mobile in one tap.
5. **Auto-Pairing Mode:** If a recipient opens `/magic.html?code=XXXXXX` (e.g. scanned from the Roku TV screen QR code), it enters TV pairing mode instead of showing a link resolution error.
6. **Roku Channel default:** Pointed to the live Cloud Run instance in `source/main.brs`.
7. **Roku App Packager:** Runs `./package_roku.sh` to package `manifest`, `source/`, `components/`, and `images/` into `out/quickbeam.zip`.

---

## 🧪 Testing & Local Commands
* **Run server unit tests:**
  ```bash
  cd relay && npm test
  ```
* **Package Roku App Channel:**
  ```bash
  ./package_roku.sh
  ```
* **Deploy to Cloud Run (runs via local gcloud SDK):**
  ```bash
  cd relay
  /home/gatekeeper/google-cloud-sdk/bin/gcloud run deploy quickbeam-relay --source . --platform managed --allow-unauthenticated --region us-central1
  ```

---

## 📋 Next Developer Tasks
1. **Review Roadmap:** Read `docs/roadmap.md` for product vision and details on reducing user friction.
2. **GoDaddy DNS setup:** Configure custom subdomain CNAME records mapping `quickbeam.johnnylehane.com` to Google Cloud Run domain mappings. Use the custom `godaddy-dns` skill if available.
3. **Verify PWA Installation:** Test home-screen PWA installs on iOS and Android. Verify that sharing a YouTube video to the Quickbeam app populates the input field correctly.
