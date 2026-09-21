const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { registerDevice, getDevicesByPublicIp, findDeviceByPairingCode } = require('./registry');
const { createStore } = require('./store');
const { parseUrl, scrapeTitle } = require('./deeplink');
const { getServiceByAppId, publicServices } = require('./services');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname + '/public'));

// Shared state store (magic links, devices, pairing codes). Defaults to the
// in-memory adapter; set QB_STORE=firestore on Cloud Run. See ./store/.
const store = createStore();

function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    return req.socket.remoteAddress;
}

const PORT = process.env.PORT || 18000;

// Serve magic page for /magic/:id
app.get('/magic/:linkId', (req, res) => {
    res.sendFile(__dirname + '/public/magic.html');
});

// 1. Device Registration (from Roku)
app.post('/api/register', async (req, res) => {
    const publicIp = getClientIp(req);
    const { localIp, deviceId, deviceName, pairingCode } = req.body;
    await registerDevice(publicIp, localIp, deviceId, deviceName, pairingCode);
    res.json({ status: 'ok', matchIp: publicIp });
});

// Check if a Roku is active on the sender's current public IP
app.get('/api/status', async (req, res) => {
    const publicIp = getClientIp(req);
    const devices = await getDevicesByPublicIp(publicIp);
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
    await store.createMagicLink(linkId, { ...parsed, serviceName: service ? service.name : 'Video', senderName, pairingCode, videoTitle, originalUrl: url, createdAt: Date.now() });
    
    // Determine protocol (supporting reverse proxies/Cloud Run)
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    res.json({ linkId, relayUrl: `${protocol}://${host}/magic/${linkId}` });
});

// 2b. List supported services (public registry view: id, name, appId)
app.get('/api/services', (req, res) => {
    res.json(publicServices());
});

// 2c. Service requests from senders ("don't see your service? request it").
// Stored as JSON lines OUTSIDE the repo directory (contact details must never
// land in git). Override with the SERVICE_REQUEST_FILE env var.
// NOTE (Cloud Run): the container filesystem is ephemeral per instance —
// same go-live consideration as the pilot-signup store.
const fs = require('fs');
const os = require('os');
const path = require('path');
const SERVICE_REQUEST_FILE = process.env.SERVICE_REQUEST_FILE ||
    path.join(os.homedir(), '.quickbeam', 'service-requests.jsonl');
const serviceRequestHits = new Map(); // ip -> [timestamps]

function serviceRequestRateLimited(ip) {
    const now = Date.now();
    const windowStart = now - 60 * 60 * 1000;
    const hits = (serviceRequestHits.get(ip) || []).filter((t) => t > windowStart);
    hits.push(now);
    serviceRequestHits.set(ip, hits);
    return hits.length > 10;
}

app.post('/api/service-request', (req, res) => {
    const ip = getClientIp(req);
    if (serviceRequestRateLimited(ip)) {
        return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }

    const { service, contact } = req.body || {};
    const cleanService = String(service || '').trim().slice(0, 80);
    const cleanContact = String(contact || '').trim().slice(0, 120);

    if (cleanService.length < 2) {
        return res.status(400).json({ error: 'Please name the service you want added.' });
    }
    if (cleanContact && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanContact) && cleanContact.replace(/\D/g, '').length < 7) {
        return res.status(400).json({ error: 'Contact must be a valid email or phone number.' });
    }

    const record = {
        ts: new Date().toISOString(),
        service: cleanService,
        ...(cleanContact ? { contact: cleanContact } : {}),
    };
    try {
        fs.mkdirSync(path.dirname(SERVICE_REQUEST_FILE), { recursive: true });
        fs.appendFileSync(SERVICE_REQUEST_FILE, JSON.stringify(record) + '\n');
    } catch (e) {
        return res.status(500).json({ error: 'Could not save your request. Please try again.' });
    }

    // Log the event without contact details.
    console.log(JSON.stringify({ event: 'SERVICE_REQUEST', service: cleanService }));
    res.json({ status: 'ok' });
});

// 3. Resolve Magic Link (from Recipient)
app.get('/api/resolve/:linkId', async (req, res) => {
    const linkId = req.params.linkId;
    const result = await store.getMagicLink(linkId);
    if (!result.found) {
        if (result.reason === 'expired') {
            return res.status(410).json({ error: 'Link has expired' });
        }
        return res.status(404).json({ error: 'Link not found' });
    }
    const link = result.record;

    const publicIp = getClientIp(req);
    const devices = await getDevicesByPublicIp(publicIp);

    res.json({
        ...link,
        devices, // Return all matching devices
        status: devices.length > 0 ? 'paired' : 'not_paired'
    });
});

// 4. Resolve pairing code (from manual input on mobile bridge)
app.get('/api/resolve-code/:pairingCode', async (req, res) => {
    const device = await findDeviceByPairingCode(req.params.pairingCode);
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

// Public free-demo landing path. Deliberately form-free: it collects no
// contact info, ZIP, signup details, or analytics identifiers — it just
// links into the existing sender flow at /.
app.get('/demo', (req, res) => {
    res.sendFile(__dirname + '/public/demo.html');
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

// Periodically clean up expired store records every hour.
// (For the Firestore adapter this is a no-op: TTL is enforced on read and
// a Firestore TTL policy reclaims documents server-side.)
const cleanupStoreInterval = setInterval(() => {
    store.cleanupExpired().catch((e) => {
        console.error('[Relay] store cleanup failed:', e && e.message);
    });
}, 60 * 60 * 1000);

if (typeof cleanupStoreInterval.unref === 'function') {
    cleanupStoreInterval.unref();
}

// Only listen if this file is run directly (useful for testing frameworks)
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`[Relay] Server running on port ${PORT}`);
    });
}

module.exports = app;
module.exports.serviceRequestFilePath = SERVICE_REQUEST_FILE;
