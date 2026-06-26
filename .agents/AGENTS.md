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
4. **Contacts Directory:** Allows saving recipient names, pairing codes, phone numbers, and emails locally. Generates pre-paired magic links and triggers the native Web Share API (SMS/WhatsApp/Mail popup) on mobile in one tap.
5. **Auto-Pairing Mode:** If a recipient opens `/magic.html?code=XXXXXX` (e.g. scanned from the Roku TV screen QR code), it enters TV pairing mode instead of showing a link resolution error.
6. **Roku Channel default:** Pointed to the live Cloud Run instance in `source/main.brs`.
7. **Roku App Packager & Automated Signer:** Zips app bundle using `./package_roku.sh`, and sideloads/signs/downloads the compiled `.pkg` package using the interactive `./sign_roku.sh` script via a physical Roku developer device.
8. **Server-side URL Scraping:** Automatically extracts the title of shared media links (YouTube, Netflix) and forwards it to the recipient's TV.
9. **Verified/Confirmed TV Status:** Shows `⚡️ Confirmed` status checkmarks for verified TVs. Provides an interactive "Did it work?" prompt upon casting to unverified TVs that auto-confirms TV IP on "Yes" clicks.
10. **Sender TV Pairing & ECP Installation Dashboard:** Integrated direct TV pairing (by 6-digit code or IP) and sideload channel installation commands directly to the Sender Dashboard (`index.html`) under the "Find or Add Roku TV" panel.

---

## 🧪 Testing & Local Commands
* **Run server unit tests:**
  ```bash
  cd relay && npm test
  ```
* **Package Roku App Channel (Raw ZIP):**
  ```bash
  ./package_roku.sh
  ```
* **Generate signed Roku App Channel (PKG):**
  ```bash
  ./sign_roku.sh -ip <ROKU_IP> -pwd <DEV_PASS> -key <SIGN_PASS> -t <prod|beta>
  ```
* **Deploy to Cloud Run (runs via local gcloud SDK):**
  ```bash
  cd relay
  gcloud run deploy quickbeam-relay --source . --platform managed --allow-unauthenticated --region us-central1
  ```

---

## 📋 Next Developer Tasks
1. **Roku App Store Publishing:** Use `./sign_roku.sh` to generate the signed `.pkg` files (prod or beta) using a physical Roku TV with developer mode enabled. Upload these signed packages to the Roku Streaming Store developer dashboard.
2. **GoDaddy DNS setup:** Configure custom subdomain CNAME records mapping `quickbeam.johnnylehane.com` to Google Cloud Run domain mappings. Use the custom `godaddy-dns` skill if available.
3. **Verify PWA Installation:** Test home-screen PWA installs on iOS and Android. Verify that sharing a YouTube video to the Quickbeam app populates the input field correctly.
