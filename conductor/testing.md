# Quickbeam Testing Strategy 🧪

Quickbeam is a distributed system (Cloud + Roku + Mobile), so our testing must cover three distinct layers: Unit, Integration, and Cross-Device E2E.

## 1. Unit Testing (The Brain)
- **Tool:** Jest (Node.js)
- **Targets:** 
    - `relay/deeplink.js`: Verify URL parsing for all supported apps (YouTube, Netflix, etc.).
    - `relay/registry.js`: Verify IP-based device matching and TTL expiration.

## 2. Integration Testing (The Relay)
- **Tool:** Supertest (Node.js)
- **Targets:**
    - `relay/server.js`: Verify REST endpoints (`/api/register`, `/api/create`, `/api/resolve`).
    - Mocked "Same-Roof" matching scenarios.

## 3. Manual E2E Verification (The Flow)
- **Protocol:** "The Grandma Test"
- **Step 1:** Deploy Relay to a reachable IP (e.g., Tailnet).
- **Step 2:** Open Quickbeam on Roku; verify "Heartbeat" shows in Relay logs.
- **Step 3:** Generate Magic Link via Sender UI.
- **Step 4:** Click link on a mobile device on the same Wi-Fi.
- **Result:** Video must launch on Roku within 2 seconds.

## 4. Roku Logic Testing
- **Tool:** BrightScript Debugger / Rooibos (Future)
- **Targets:**
    - Verify `roUrlTransfer` successfully pings the Relay.
    - Verify `roDeviceInfo` correctly captures the local IP.
