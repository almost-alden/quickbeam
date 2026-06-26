const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { registerDevice, getDevicesByPublicIp, findDeviceByPairingCode } = require('./registry');
const { parseUrl, scrapeTitle } = require('./deeplink');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname + '/public'));

function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    return req.socket.remoteAddress;
}

const PORT = process.env.PORT || 18000;
const magicLinks = new Map(); // linkId -> { appId, contentId, mediaType, senderName, originalUrl, createdAt }

// 24 hour link expiration (TTL)
const LINK_TTL = 24 * 60 * 60 * 1000;

// Serve magic page for /magic/:id
app.get('/magic/:linkId', (req, res) => {
    res.sendFile(__dirname + '/public/magic.html');
});

// 1. Device Registration (from Roku)
app.post('/api/register', (req, res) => {
    const publicIp = getClientIp(req);
    const { localIp, deviceId, deviceName, pairingCode } = req.body;
    registerDevice(publicIp, localIp, deviceId, deviceName, pairingCode);
    res.json({ status: 'ok', matchIp: publicIp });
});

// Check if a Roku is active on the sender's current public IP
app.get('/api/status', (req, res) => {
    const publicIp = getClientIp(req);
    const devices = getDevicesByPublicIp(publicIp);
    res.json({ 
        active: devices.length > 0, 
        devices,
        publicIp 
    });
});

app.post('/api/create', async (req, res) => {
    const { url, senderName, pairingCode } = req.body;
    let { videoTitle } = req.body;
    const parsed = parseUrl(url);
    
    if (!parsed) {
        return res.status(400).json({ error: 'URL not supported yet' });
    }

    // Auto-scrape title from source if not provided manually
    if (!videoTitle) {
        videoTitle = await scrapeTitle(url);
    }

    const linkId = crypto.randomUUID().substring(0, 8);
    magicLinks.set(linkId, { ...parsed, senderName, pairingCode, videoTitle, originalUrl: url, createdAt: Date.now() });
    
    // Determine protocol (supporting reverse proxies/Cloud Run)
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    res.json({ linkId, relayUrl: `${protocol}://${host}/magic/${linkId}` });
});

// 3. Resolve Magic Link (from Recipient)
app.get('/api/resolve/:linkId', (req, res) => {
    const linkId = req.params.linkId;
    const link = magicLinks.get(linkId);
    if (!link) return res.status(404).json({ error: 'Link not found' });

    // Validate link expiration (TTL)
    if (Date.now() - link.createdAt > LINK_TTL) {
        magicLinks.delete(linkId);
        return res.status(410).json({ error: 'Link has expired' });
    }

    const publicIp = getClientIp(req);
    const devices = getDevicesByPublicIp(publicIp);

    res.json({
        ...link,
        devices, // Return all matching devices
        status: devices.length > 0 ? 'paired' : 'not_paired'
    });
});

// 4. Resolve pairing code (from manual input on mobile bridge)
app.get('/api/resolve-code/:pairingCode', (req, res) => {
    const device = findDeviceByPairingCode(req.params.pairingCode);
    if (!device) {
        return res.status(404).json({ error: 'Pairing code not found or expired' });
    }
    res.json({
        status: 'paired',
        device: {
            localIp: device.localIp,
            deviceId: device.deviceId,
            deviceName: device.deviceName
        }
    });
});

// Serve clean URLs for static pages
app.get('/about', (req, res) => {
    res.sendFile(__dirname + '/public/about.html');
});

app.get('/support', (req, res) => {
    res.sendFile(__dirname + '/public/support.html');
});

// Support form API
app.post('/api/support', (req, res) => {
    const { name, email, subject, message } = req.body;
    console.log(`========================================`);
    console.log(`[SUPPORT EMAIL TICKET]`);
    console.log(`To: quickbeam+hello@johnnylehane.com`);
    console.log(`From: ${name} <${email}>`);
    console.log(`Subject: ${subject}`);
    console.log(`Message:\n${message}`);
    console.log(`========================================`);
    res.json({ status: 'ok', message: 'Your support ticket has been received.' });
});

// Periodically clean up expired magic links every hour
const cleanupMagicLinksInterval = setInterval(() => {
    const now = Date.now();
    for (const [linkId, link] of magicLinks.entries()) {
        if (now - link.createdAt > LINK_TTL) {
            magicLinks.delete(linkId);
        }
    }
}, 60 * 60 * 1000);

if (typeof cleanupMagicLinksInterval.unref === 'function') {
    cleanupMagicLinksInterval.unref();
}

// Only listen if this file is run directly (useful for testing frameworks)
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`[Relay] Server running on port ${PORT}`);
    });
}

module.exports = app;
