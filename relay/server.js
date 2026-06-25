const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { registerDevice, getDevicesByPublicIp } = require('./registry');
const { parseUrl } = require('./deeplink');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

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
    const publicIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const { localIp, deviceId, deviceName } = req.body;
    registerDevice(publicIp, localIp, deviceId, deviceName);
    res.json({ status: 'ok', matchIp: publicIp });
});

// Check if a Roku is active on the sender's current public IP
app.get('/api/status', (req, res) => {
    const publicIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const devices = getDevicesByPublicIp(publicIp);
    res.json({ 
        active: devices.length > 0, 
        devices,
        publicIp 
    });
});

// 2. Create Magic Link (from Sender)
app.post('/api/create', (req, res) => {
    const { url, senderName } = req.body;
    const parsed = parseUrl(url);
    
    if (!parsed) {
        return res.status(400).json({ error: 'URL not supported yet' });
    }

    const linkId = uuidv4().substring(0, 8);
    magicLinks.set(linkId, { ...parsed, senderName, originalUrl: url, createdAt: Date.now() });
    
    // Dynamically build the relayUrl using the current host
    const protocol = req.protocol;
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

    const publicIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const devices = getDevicesByPublicIp(publicIp);

    res.json({
        ...link,
        devices, // Return all matching devices
        status: devices.length > 0 ? 'paired' : 'not_paired'
    });
});

// Periodically clean up expired magic links every hour
setInterval(() => {
    const now = Date.now();
    for (const [linkId, link] of magicLinks.entries()) {
        if (now - link.createdAt > LINK_TTL) {
            magicLinks.delete(linkId);
        }
    }
}, 60 * 60 * 1000);

// Only listen if this file is run directly (useful for testing frameworks)
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`[Relay] Server running on port ${PORT}`);
    });
}

module.exports = app;
