# Quickbeam ⚡️
**The Remote Roku Bridge**

Quickbeam is a remote-assistance tool that puts a video on someone else's Roku TV from anywhere. No app install, no account, and no remote required on their end.

### 🚀 The Mission
Help an elder friend or family member get the video, episode, or stream they want onto their TV, without them ever having to touch a remote or navigate a TV interface.

### 🛠 How it Works
v1 is **zero-install**: everything runs in the browser.

1. **Sender:** Pastes a video link into the Quickbeam Web Dashboard, or shares it straight from another app via the phone's native share sheet (PWA share target).
2. **Relay:** Parses the deep link, scrapes the title, and generates a **Magic Link** that expires after 24 hours. Send it by SMS, WhatsApp, or any messenger.
3. **Recipient:** Opens the link on their phone. It is a web page - nothing to install.
4. **Bridge:** The page suggests the Roku through **Same-Roof IP Matching**, with manual IP entry as the dependable fallback. Recipients can save and name multiple TVs ("Living Room", "Bedroom") and switch between them.
5. **Direct Cast:** The phone sends ECP launch commands directly to the Roku over the home Wi-Fi. The relay never talks to the TV.

### 📺 Supported Services
Supported apps live in a **configurable service registry** (`relay/services.js`): one entry per service, and the parser, the API, and the recipient page all read from it.

- **Tested (v1):** YouTube (watch, Shorts, embed), Netflix, Amazon Prime Video, EWTN.
- **Experimental (PR #18):** 19 more services, including Disney+, Hulu, Max, Peacock, and Paramount+. Mappings are best-effort until verified on real hardware, and ship gated behind that check.

### 🏗 Architecture & Modules
*   **Relay Cloud Server (Node.js/Express):** Magic-link registry, deep-link parsing, same-roof device registry, support pages. Containerized for serverless **Google Cloud Run** (`relay/Dockerfile`).
*   **Mobile Web Bridge (PWA):** Zero-install sender dashboard and recipient page: share-target integration, saved contacts, multi-TV manager, and a hidden form-POST ECP launch wrapper to bypass HTTPS mixed-content constraints.
*   **Roku Receiver Channel (BrightScript):** Optional native channel (`source/`, `components/`) with a pairing-code flow. Not required for the v1 zero-install path; its feature backlog is preserved for a possible future channel phase.
*   **Roku Simulator (Node.js):** Mocks the Roku ECP protocol (`/launch/:appId`) and opens videos in a local browser, so the full sender-to-TV flow can be tested without developer-mode hardware.

### 🔒 Security Notes
*   **Trust boundary:** service hostnames match exact-or-suffix only, so lookalike hosts (`youtube.com.evil.com`) never parse to a trusted app.
*   **Magic links:** random IDs, 24-hour TTL, hourly cleanup.
*   **Known caveat:** magic links and the device registry are process-local, in-memory state. Moving them to a shared TTL store (or shipping the beta as an explicitly disclosed single-warm-instance constraint) is a recorded pre-release decision.

### 🧪 Local Development & Running Tests

Install dependencies:
```bash
cd relay && npm install
cd ../simulator && npm install
```

Run the test suites:
```bash
cd relay && npm test       # 48 tests across 5 suites
cd ../simulator && npm test
```

Run locally:
```bash
# Start Relay on port 18000
PORT=18000 node relay/server.js

# Start Roku Simulator on port 8060
node simulator/simulator.js
```

### 🗺 Project Status & Roadmap
The product vision and backlog live in `docs/roadmap.md`. In flight: the experimental service expansion (PR #18), the marketing site and early-access signup (PR #19), and a draft business plan (PR #20).

### 🤝 Contributing
Coordination happens on issue #15. Work lands through PRs from `failden/...` and `instinct/...` branches into `main`. Every PR gets reviewed before merge; security-sensitive changes (the trust boundary, pairing, deep links) always get a second review.
