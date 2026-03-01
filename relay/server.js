const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { registerDevice, findDeviceByPublicIp } = require('./registry');
const { parseUrl } = require('./deeplink');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const PORT = process.env.PORT || 18000;
const magicLinks = new Map(); // linkId -> { appId, contentId, senderName }

// Serve magic page for /magic/:id
app.get('/magic/:linkId', (req, res) => {
    res.sendFile(__dirname + '/public/magic.html');
});

// 1. Device Registration (from Roku)
app.post('/api/register', (req, res) => {
    const publicIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const { localIp } = req.body;
    registerDevice(publicIp, localIp);
    res.json({ status: 'ok', matchIp: publicIp });
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
    const link = magicLinks.get(req.params.linkId);
    if (!link) return res.status(404).json({ error: 'Link not found' });

    const publicIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const device = findDeviceByPublicIp(publicIp);

    res.json({
        ...link,
        device: device || null, // If null, recipient must scan QR or enter IP
        status: device ? 'paired' : 'not_paired'
    });
});

app.listen(PORT, () => {
    console.log(`[Relay] Server running on port ${PORT}`);
});
