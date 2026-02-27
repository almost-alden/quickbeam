const request = require('supertest');
const express = require('express');
const { registerDevice } = require('../registry');
const { parseUrl } = require('../deeplink');

// Mocking uuid to avoid ESM issues in tests
const uuidv4 = () => 'mocked-uuid-1234';

const app = express();
app.use(express.json());
const magicLinks = new Map();

app.post('/api/create', (req, res) => {
    const { url, senderName } = req.body;
    const parsed = parseUrl(url);
    if (!parsed) return res.status(400).json({ error: 'URL not supported' });
    const linkId = uuidv4().substring(0, 8);
    magicLinks.set(linkId, { ...parsed, senderName, createdAt: Date.now() });
    res.json({ linkId });
});

app.get('/api/resolve/:linkId', (req, res) => {
    const link = magicLinks.get(req.params.linkId);
    if (!link) return res.status(404).json({ error: 'Link not found' });
    res.json(link);
});

describe('Relay Server API', () => {
    test('POST /api/create -> GET /api/resolve', async () => {
        const createRes = await request(app)
            .post('/api/create')
            .send({
                url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                senderName: 'Johnny'
            });
        
        expect(createRes.status).toBe(200);
        expect(createRes.body.linkId).toBe('mocked-u');

        const resolveRes = await request(app)
            .get(`/api/resolve/${createRes.body.linkId}`);
        
        expect(resolveRes.status).toBe(200);
        expect(resolveRes.body.senderName).toBe('Johnny');
        expect(resolveRes.body.appId).toBe('837');
    });

    test('Unsupported URL returns 400', async () => {
        const res = await request(app)
            .post('/api/create')
            .send({ url: 'https://badsite.com' });
        expect(res.status).toBe(400);
    });
});
