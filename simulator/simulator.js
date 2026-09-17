const express = require('express');
const opn = require('opn'); // Opens browser
const http = require('http');
const os = require('os');

const app = express();
const RELAY_URL = process.env.RELAY_URL || 'http://localhost:18000';
const ROKU_PORT = 8060;

// Parse Relay URL
let relayHost = 'localhost';
let relayPort = 18000;
try {
    const parsedUrl = new URL(RELAY_URL);
    relayHost = parsedUrl.hostname;
    relayPort = parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80);
} catch (e) {
    console.error(`⚠️ Invalid RELAY_URL "${RELAY_URL}", falling back to localhost:18000`);
}

const { getLocalIp } = require("./network");

// 1. Mock ECP Launch Endpoint
// Accepts launches for every app in the relay's service registry (not just the
// four below): it logs the exact appId/contentId/mediaType received and opens
// a watch URL in the browser only when a known-good template exists.
app.post('/launch/:appId', (req, res) => {
    const { appId } = req.params;
    const { contentId, mediaType } = req.query;

    console.log(`
🚀 [ROKU SIMULATOR] Received Launch Command!`);
    console.log(`📺 App ID: ${appId}`);
    console.log(`🎬 Content ID: ${contentId}`);
    console.log(`🏷️ Media Type: ${mediaType}`);

    let url = '';
    if (appId === '837') url = `https://www.youtube.com/watch?v=${contentId}`;
    else if (appId === '12') url = `https://www.netflix.com/watch/${contentId}`;
    else if (appId === '13') url = `https://www.amazon.com/gp/video/detail/${contentId}`;
    else if (appId === '186') url = `https://www.ewtn.com/tv/watch-live`;
    else if (appId === '291097') url = `https://www.disneyplus.com/video/${contentId}`;
    else if (appId === '2285') url = `https://www.hulu.com/watch/${contentId}`;
    else if (appId === '41468') url = `https://tubitv.com/movies/${contentId}`;

    if (url) {
        console.log(`🌐 Opening in browser: ${url}`);
        opn(url);
    } else {
        console.log(`ℹ️ No browser template for app ${appId}; launch acknowledged anyway.`);
    }
    res.status(200).send('Launched');
});

// 2. Heartbeat to Relay
function sendHeartbeat() {
    const localIp = getLocalIp();
    const data = JSON.stringify({ 
        localIp,
        deviceId: 'simulator',
        deviceName: 'Roku Simulator (PC)'
    });
    
    const options = {
        hostname: relayHost,
        port: parseInt(relayPort),
        path: '/api/register',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data)
        }
    };

    const req = http.request(options, (res) => {
        console.log(`📡 [Heartbeat] Registered with Relay at ${RELAY_URL} (Status: ${res.statusCode})`);
    });

    req.on('error', (e) => console.error(`❌ [Heartbeat] Relay unreachable at ${relayHost}:${relayPort} - ${e.message}`));
    req.write(data);
    req.end();
}

app.listen(ROKU_PORT, () => {
    console.log(`
🎭 Roku Simulator Running on port ${ROKU_PORT}`);
    console.log(`🏠 Ready to receive commands from the Mobile Web Bridge.`);
    console.log(`🌐 Local IP detected: ${getLocalIp()}`);
    
    // Heartbeat every 30 seconds
    sendHeartbeat();
    setInterval(sendHeartbeat, 30000);
});

