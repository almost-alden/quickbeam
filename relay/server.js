const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { registerDevice, getDevicesByPublicIp, findDeviceByPairingCode } = require('./registry');
const { parseUrl, scrapeTitle } = require('./deeplink');
const { getServiceByAppId, publicServices, SERVICES } = require('./services');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname + '/public'));
// Marketing site (website/) served at /site; its signup form POSTs to /api/interest.
app.use('/site', express.static(path.join(__dirname, '..', 'website')));

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
    const service = getServiceByAppId(parsed.appId);
    magicLinks.set(linkId, { ...parsed, serviceName: service ? service.name : 'Video', senderName, pairingCode, videoTitle, originalUrl: url, createdAt: Date.now() });
    
    // Determine protocol (supporting reverse proxies/Cloud Run)
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    res.json({ linkId, relayUrl: `${protocol}://${host}/magic/${linkId}` });
});

// 2b. List supported services (public registry view: id, name, appId)
app.get('/api/services', (req, res) => {
    res.json(publicServices());
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
    console.log(JSON.stringify({
        event: 'SUPPORT_EMAIL_TICKET',
        to: 'quickbeam+hello@johnnylehane.com',
        name,
        email,
        subject,
        message
    }));
    res.json({ status: 'ok', message: 'Your support ticket has been received.' });
});

// Early-access interest signup (marketing site form).
// Stores signups as JSON lines in relay/data/interest.jsonl (gitignored: PII never lands in git).
// Contact details are stored but never written to the console log.
const INTEREST_FILE = path.join(__dirname, 'data', 'interest.jsonl');
const KNOWN_SERVICE_IDS = new Set(SERVICES.map((s) => s.id));
const interestHits = new Map(); // ip -> [timestamps]

function interestRateLimited(ip) {
    const now = Date.now();
    const windowStart = now - 60 * 60 * 1000;
    const hits = (interestHits.get(ip) || []).filter((t) => t > windowStart);
    hits.push(now);
    interestHits.set(ip, hits);
    return hits.length > 10;
}

app.post('/api/interest', (req, res) => {
    const ip = getClientIp(req);
    if (interestRateLimited(ip)) {
        return res.status(429).json({ error: 'Too many signups from this address. Please try again later.' });
    }

    const { phone, email, zip, channels } = req.body || {};
    const cleanPhone = String(phone || '').replace(/\D/g, '');
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanZip = String(zip || '').trim();
    const cleanChannels = [...new Set(Array.isArray(channels) ? channels.map(String) : [])];

    if (!cleanPhone && !cleanEmail) {
        return res.status(400).json({ error: 'A phone number or email address is required.' });
    }
    if (cleanPhone && (cleanPhone.length < 7 || cleanPhone.length > 15)) {
        return res.status(400).json({ error: 'Please enter a valid phone number.' });
    }
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    if (!/^\d{5}(-\d{4})?$/.test(cleanZip)) {
        return res.status(400).json({ error: 'Please enter a valid 5-digit ZIP code.' });
    }
    if (cleanChannels.length < 1 || cleanChannels.length > 5) {
        return res.status(400).json({ error: 'Pick between 1 and 5 services.' });
    }
    if (!cleanChannels.every((c) => KNOWN_SERVICE_IDS.has(c))) {
        return res.status(400).json({ error: 'One or more selected services is not recognized.' });
    }

    const record = {
        ts: new Date().toISOString(),
        ...(cleanPhone ? { phone: cleanPhone } : {}),
        ...(cleanEmail ? { email: cleanEmail } : {}),
        zip: cleanZip,
        channels: cleanChannels,
    };
    try {
        fs.mkdirSync(path.dirname(INTEREST_FILE), { recursive: true });
        fs.appendFileSync(INTEREST_FILE, JSON.stringify(record) + '\n');
    } catch (e) {
        return res.status(500).json({ error: 'Could not save your signup. Please try again.' });
    }

    // Log the event without contact details (PII stays in the data file only).
    console.log(JSON.stringify({
        event: 'INTEREST_SIGNUP',
        zip: cleanZip,
        channelCount: cleanChannels.length,
        channels: cleanChannels,
    }));
    res.json({ status: 'ok' });
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
