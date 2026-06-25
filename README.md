# Quickbeam ⚡️
**The Remote Roku Bridge**

Quickbeam is a remote-assistance tool designed to help family and friends navigate their Roku TV from anywhere. 

### 🚀 The Mission
Help an elder friend or family member access the video, episode, or stream they want without them ever having to touch a remote or navigate a complex TV interface.

### 🛠 How it Works
1. **Sender:** Uses the Quickbeam Web Dashboard to find a video (Netflix, YouTube, Prime, EWTN).
2. **Relay:** Generates a "Magic Link" that is sent (e.g., via SMS) to the recipient.
3. **Recipient:** Clicks the link on their phone.
4. **Bridge:** The phone automatically connects to the local Roku TV via **Same-Roof IP Matching** or **Auto-Discovery Wi-Fi Scan**. Recipient can also manually save multiple TVs (like "Living Room" or "Bedroom") to switch between them.
5. **Direct Cast:** The phone sends ECP launch commands directly to the Roku TV over the home Wi-Fi network.

### 🏗 Architecture & Modules
*   **Relay Cloud Server (Node.js):** IP Matching, deep link parsing, and magic link registry. Fully containerized and optimized for serverless **Google Cloud Run**.
*   **Mobile Web Bridge (HTML/JS):** A zero-install mobile-friendly page featuring a multi-device manager, network subnet scanner, and a secure hidden form POST ECP launch wrapper to bypass HTTPS mixed content constraints.
*   **Roku Simulator (Node.js):** A local testing utility that mocks the Roku ECP protocol (`/launch/:appId`) and opens videos in a local browser, bypassing developer mode deployment.

### 🧪 Local Development & Running Tests

First, install dependencies:
```bash
cd relay && npm install
cd ../simulator && npm install
```

To run the unit test suite:
```bash
npm test
```

To run the application locally:
```bash
# Start Relay on port 18000
PORT=18000 node relay/server.js

# Start Roku Simulator on port 8060
node simulator/simulator.js
```

