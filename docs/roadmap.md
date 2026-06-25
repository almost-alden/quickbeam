# Quickbeam Product Vision & Roadmap ⚡️

This document outlines the product vision, backlog, and planned UX enhancements for Quickbeam. It is stored directly in the repository to maintain development context across different devices.

---

## 🌟 The Product Vision: A Social Cast Engine
While Quickbeam started as a simple remote assistance utility (helping family members launch specific content on their TV), it has the potential to evolve into a **social sharing tool**. 
* **The Flow:** "I'm watching this great YouTube video/Netflix show, let me 'quickbeam' it to Mom's TV, my friend's TV, or share it directly from my TV to theirs."
* **Roku-to-Roku Cast:** Build a custom Roku App Channel. Once configured, you can query what you are watching on your own TV (`/query/active-app` ECP endpoint) and send it directly to your contact list.

---

## 🛠 UX Friction Reduction & Backlog

To make Quickbeam friction-free, we need to bridge the gap between web pages and native device features.

### 1. Progressive Web App (PWA) Support
* **Objective:** Allow both the Sender and Recipient to install Quickbeam as a web app on their home screens (especially iOS & Android) with zero app-store installs.
* **Friction Reducer:** Bypasses browser chrome, runs in full-screen, and enables persistent configuration storage.
* **Implementation Plan:**
  - Add a standard `manifest.json` outlining application icons, theme colors, and display modes.
  - Implement a basic Service Worker (`sw.js`) to support offline caching of asset shells.
  - Add prompt hints for iOS users ("Tap Share -> Add to Home Screen") since iOS does not support automatic PWA install banners.

### 2. Native "Share With" / Share Sheet Integration
* **Objective:** Enable sharing links directly to Quickbeam from other apps (YouTube, Netflix, browser).
* **Friction Reducer:** Instead of opening Quickbeam, copying a URL, pasting it, and generating a link, a user simply taps **Share** in YouTube and selects **Quickbeam** from their phone's native sharing sheet.
* **Implementation Plan:**
  - Utilize the **Web Share Target API** in the PWA manifest.
  - Configure the manifest to accept share events with incoming URLs:
    ```json
    "share_target": {
      "action": "/api/share-receive",
      "method": "GET",
      "params": {
        "title": "title",
        "text": "text",
        "url": "url"
      }
    }
    ```
  - When shared to, the PWA will launch and auto-populate the video URL field instantly.

### 3. Contact & Recipient Management ("Mom's Cell")
* **Objective:** Avoid typing or copy-pasting numbers/links every time.
* **Friction Reducer:** Maintain a quick-list of saved recipients directly on the dashboard (e.g., "Mom's Cell", "Sister's Living Room").
* **Implementation Plan:**
  - Save contacts locally in `localStorage` (and optionally sync to a database in the future).
  - Create a "Send to..." list of contacts next to the link generator.
  - Enable one-tap Web Share triggers targeting SMS or WhatsApp for the saved contact, or direct Cloud-Relay pairing if their TV is active.

### 4. Roku-to-Roku Direct Sharing
* **Objective:** Casting directly from a Roku TV to another Roku TV.
* **Implementation Plan:**
  - Build a custom Roku SceneGraph application channel.
  - Utilize Roku's ECP HTTP client to query current state `/query/active-app`.
  - Send the active app ID and content ID to the Quickbeam Relay server, target a specific pairing code or friend ID, and trigger the remote ECP launch command on the recipient TV.

---

## 🏃‍♂️ Immediate Technical Clean-Up (Local & Prod)

### Local Cleanup Checklist
If you are wrapping up this session and switching machines:
1. **Stop Dev Services:** Ensure local ports `18000` (relay) and `8060` (simulator) are freed:
   ```bash
   # Find and kill any node processes running server or simulator
   killall node
   ```
2. **Git Commit & Push:** All code changes (GCP configs, public IP detection fixes, localStorage name persistence) must be staged and committed:
   ```bash
   git add .
   git commit -m "feat: improve dashboard UX, save sender name, clarify public IP, and document roadmap"
   git push
   ```
3. **Verify GCP Deploy Status:** The Cloud Run instance is live at:
   `https://quickbeam-relay-470817308605.us-central1.run.app`
   - Your local environment does not store any sensitive cloud secrets (handled securely via GCP environment variables and local gitignores).

### Production Re-testing
* When testing the production URL on your phone:
  1. Add your Roku TV IP manually on the mobile device page *once* (required because `localStorage` is origin-bound, and switching from dev tunnel to the production domain resets it).
  2. Test generating a link, opening it on the phone (on the same Wi-Fi subnet), and verifying the ECP form POST works.
