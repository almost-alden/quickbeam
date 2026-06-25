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

// Dynamically auto-detect local network IP address
function getLocalIp() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const net of interfaces[name]) {
            // Find first external IPv4 address
            if (net.family === 'IPv4' && !net.internal) {
                return net.address;
            }
        }
    }
    return 'localhost';
}

// 1. Mock ECP Launch Endpoint
app.post('/launch/:appId', (req, res) => {
    const { appId } = req.params;
    const { contentId } = req.query;
    
    console.log(`
🚀 [ROKU SIMULATOR] Received Launch Command!`);
    console.log(`📺 App ID: ${appId}`);
    console.log(`🎬 Content ID: ${contentId}`);

    let url = '';
    if (appId === '837') url = `https://www.youtube.com/watch?v=${contentId}`;
    else if (appId === '12') url = `https://www.netflix.com/watch/${contentId}`;
    else if (appId === '13') url = `https://www.amazon.com/gp/video/detail/${contentId}`;
    else if (appId === '186') url = `https://www.ewtn.com/tv/watch-live`;

    if (url) {
        console.log(`🌐 Opening in browser: ${url}`);
        opn(url);
        res.status(200).send('Launched');
    } else {
        res.status(404).send('App not mocked');
    }
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

