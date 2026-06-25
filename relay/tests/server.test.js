const request = require('supertest');
const app = require('../server');

describe('Relay Server API', () => {
    test('POST /api/create -> GET /api/resolve', async () => {
        const createRes = await request(app)
            .post('/api/create')
            .send({
                url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                senderName: 'Johnny'
            });
        
        expect(createRes.status).toBe(200);
        expect(createRes.body.linkId).toBeDefined();
        expect(createRes.body.relayUrl).toBeDefined();

        const resolveRes = await request(app)
            .get(`/api/resolve/${createRes.body.linkId}`);
        
        expect(resolveRes.status).toBe(200);
        expect(resolveRes.body.senderName).toBe('Johnny');
        expect(resolveRes.body.appId).toBe('837'); // YouTube App ID
        expect(resolveRes.body.contentId).toBe('dQw4w9WgXcQ');
    });

    test('Unsupported URL returns 400', async () => {
        const res = await request(app)
            .post('/api/create')
            .send({ url: 'https://badsite.com' });
        expect(res.status).toBe(400);
    });

    test('POST /api/register -> GET /api/status', async () => {
        // Register a device
        const registerRes = await request(app)
            .post('/api/register')
            .send({
                localIp: '192.168.1.100',
                deviceId: 'test-device-123',
                deviceName: 'Test Roku'
            });
        
        expect(registerRes.status).toBe(200);
        expect(registerRes.body.status).toBe('ok');

        // Check status (supertest defaults remoteAddress, so registration and status match IPs)
        const statusRes = await request(app)
            .get('/api/status');
        
        expect(statusRes.status).toBe(200);
        expect(statusRes.body.active).toBe(true);
        expect(statusRes.body.devices.length).toBeGreaterThan(0);
        expect(statusRes.body.devices[0].deviceName).toBe('Test Roku');
    });
});
