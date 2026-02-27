# Quickbeam ⚡️
**The Remote Roku Bridge**

Quickbeam is a remote-assistance tool designed to help family and friends navigate their Roku TV from anywhere. 

### 🚀 The Mission
Help an elder friend or family member access the video, episode, or stream they want without them ever having to touch a remote or navigate a complex TV interface.

### 🛠 How it Works
1. **Sender:** Uses the Quickbeam Web Dashboard to find a video (Netflix, YouTube, Prime, EWTN).
2. **Relay:** Generates a "Magic Link" that is texted to the recipient.
3. **Recipient:** Clicks the link on their phone.
4. **Bridge:** The phone automatically "pairs" with the local Roku (via Same-Roof IP Matching) and launches the video instantly.

### 🏗 Architecture (Multi-Track)
- **Track 1:** Relay Cloud (Node.js) - IP Matching & Link Management.
- **Track 2:** Roku Receiver (BrightScript) - The on-TV companion app.
- **Track 3:** Deep Link Engine - Mapping URLs to Roku App IDs.
- **Track 4:** Mobile Web Bridge - The zero-install recipient interface.

---
Built with ❤️ for families. Created as part of the Alden Initiative.
