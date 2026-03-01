const express = require('express');
const opn = require('opn'); // Opens browser
const http = require('http');

const app = express();
const RELAY_URL = 'http://100.104.161.54:18000'; // Tailnet IP of Relay
const ROKU_PORT = 8060;

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
    // We need our local IP. In a simulator, we can just use 127.0.0.1 or let the server detect it.
    // For simplicity, we'll let the Relay detect our Public/Tailnet IP.
    const data = JSON.stringify({ localIp: 'localhost' });
    
    const options = {
        hostname: '100.104.161.54',
        port: 18000,
        path: '/api/register',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': data.length
        }
    };

    const req = http.request(options, (res) => {
        console.log(`📡 [Heartbeat] Registered with Relay (Status: ${res.statusCode})`);
    });

    req.on('error', (e) => console.error(`❌ [Heartbeat] Relay unreachable: ${e.message}`));
    req.write(data);
    req.end();
}

app.listen(ROKU_PORT, () => {
    console.log(`
🎭 Roku Simulator Running on port ${ROKU_PORT}`);
    console.log(`🏠 Ready to receive commands from the Mobile Web Bridge.`);
    
    // Heartbeat every 30 seconds
    sendHeartbeat();
    setInterval(sendHeartbeat, 30000);
});
