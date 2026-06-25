---
name: quickbeam
description: Coordinates development, multi-track tasks, and testing configurations for the Quickbeam remote assistance tool.
---

# Quickbeam Development & Execution Plan

This workspace skill defines the active tracks, architectural decisions, and testing protocols for the Quickbeam remote Roku bridge.

## 1. Project Roadmap (Multi-Track)

```mermaid
graph TD
    subgraph Track 1: Relay Cloud (HTTP)
        A[registry.js] --> B[server.js]
        B --> C[Sender Dashboard]
    end
    subgraph Track 4: Mobile Bridge
        D[magic.html] --> E[Local ECP Trigger]
    end
    subgraph Track 2: Roku Receiver
        F[source/main.brs] --> G[Roku ECP Launch]
    end
    subgraph Track 3: Deep Link Engine
        H[deeplink.js] --> D
    end
    B -- Resolves Pair --> D
    E -- Direct HTTP Post --> G
```

### 📋 Track Status & Tasks

#### ⚡ Track 1: Relay Cloud (Node.js)
*   [x] Initialize core relay server and IP-matching registry.
*   [x] Implement dynamic magic link creation and URL resolution.
*   [x] Build sender dashboard with status indicator.
*   [x] Secure session validation and link expiration (TTL).
*   [x] Enable HTTPS support by bypassing browser Mixed Content blocks (using hidden Form POST iframe wrappers in magic.html).
*   [x] Robust device-matching for cases with multiple Rokus on one public IP (resolved via mobile device selector panel).
*   [ ] **Next Up**: Deploy production environment container to Google Cloud Run and bind to `quickbeam.johnnylehane.com` via GoDaddy DNS.

#### 📺 Track 2: Roku Receiver (BrightScript)
*   [x] Create basic SceneGraph boilerplate.
*   [x] Implement heartbeat registration to Relay.
*   [x] **Archived/Bypassed**: We moved to the **Zero-Install ECP** model to completely bypass developer mode setup and dashboard deployment. Heartbeat auto-discovery is replaced by the browser Wi-Fi subnet scanner and manual IP entry saved to local storage.

#### 🔗 Track 3: Deep Link Engine (JS)
*   [x] Robust parsing of YouTube (including mobile sharing and custom parameter ordering).
*   [x] Parsing of Netflix (`/watch/` and `/title/` paths).
*   [x] Parsing of Amazon Prime Video (`/detail/`, `/dp/`, and `/v/` paths).
*   [x] Parsing of EWTN live streams.
*   [ ] **Next Up**: Support for YouTube playlist IDs, timestamps, and search queries.
*   [ ] **Next Up**: Add support for Disney+, Hulu, and Max.

#### 📱 Track 4: Mobile Web Bridge (HTML/JS)
*   [x] Resolve recipient magic link from Relay.
*   [x] Attempt direct same-roof pairing via local IP.
*   [x] Implement manual fallback input page supporting manual local IP input.
*   [x] Implement browser-based Wi-Fi network subnet auto-scanner (CORS-Time Hack).
*   [x] Add dynamic multi-device selector to choose and switch between active TVs.
*   [x] Implement hidden form submit wrapper to permit ECP casting fully over secure HTTPS.

---

## 2. Multi-Network Testing Configuration

To simulate a real-world deployment where the Relay is in the cloud, the Sender is remote, and the Recipient & Roku are on the same home network, we use a 2-Network setup.

### 🌐 Network Topology

```
                  ┌──────────────────────────────┐
                  │      Relay Cloud Server      │
                  │   (Runs on Gateway / Lenny)  │
                  └──────────────┬───────────────┘
                                 │
                 ┌───────────────┴───────────────┐
                 │        Alden Network          │
                 │    Public IP: [Alden Public]  │
                 └───────────────┬───────────────┘
                                 │ (Public HTTP Tunnel / WAN)
                 ┌───────────────┴───────────────┐
                 │         Home Network          │
                 │    Public IP: [Home Public]   │
                 └──────┬─────────────────┬──────┘
                        │                 │
             ┌──────────┴────────┐   ┌────┴──────────────┐
             │  Recipient Phone  │   │      Roku TV      │
             │   (Local IP: A)   │   │   (Local IP: B)   │
             └───────────────────┘   └───────────────────┘
```

### 🧪 Simulation Setup
To test cross-network connectivity without compromising the isolation between the **Alden Network** and the **Home Network**:
1. **Expose the Relay Server**: Run the Relay Server on port `18000` on the Alden network, and expose it to the internet using a public HTTP tunnel (e.g., `ngrok http 18000` or `lt --port 18000`).
2. **Point Roku & Phone to Tunnel**: Use the generated public HTTP tunnel URL (e.g., `http://xxxx.ngrok-free.app`) as the `RELAY_URL` in the Roku channel and the recipient's magic links.
3. **Verify WAN Loop**: 
   * The Roku on the **Home Network** sends its heartbeat to the public tunnel URL. The server registers it under the **Home Network's public IP**.
   * The Sender on the **Alden Network** creates a magic link.
   * The Phone on the **Home Network** (on Wi-Fi) opens the magic link. The Relay Server detects the phone's public IP, matches it to the Roku's public IP, and returns the Roku's local IP address to the phone.
   * The Phone launches the video over the local Home Network (`http://<Roku Local IP>:8060/launch/...`).
