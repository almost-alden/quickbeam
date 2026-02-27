const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { registerDevice, findDeviceByPublicIp } = require('./registry');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 18000;
const magicLinks = new Map(); // linkId -> { appId, contentId, senderName }

// 1. Device Registration (from Roku)
app.post('/api/register', (req, res) => {
    const publicIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const { localIp } = req.body;
    registerDevice(publicIp, localIp);
    res.json({ status: 'ok', matchIp: publicIp });
});

// 2. Create Magic Link (from Sender)
app.post('/api/create', (req, res) => {
    const linkId = uuidv4().substring(0, 8);
    const { appId, contentId, senderName } = req.body;
    magicLinks.set(linkId, { appId, contentId, senderName, createdAt: Date.now() });
    res.json({ linkId, url: `http://localhost:${PORT}/magic/${linkId}` });
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
