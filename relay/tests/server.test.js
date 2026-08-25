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

    test('POST /api/register with pairing code -> GET /api/resolve-code', async () => {
        // Register device with code
        const registerRes = await request(app)
            .post('/api/register')
            .send({
                localIp: '192.168.1.120',
                deviceId: 'device-code-test',
                deviceName: 'Den TV',
                pairingCode: '555666'
            });
        
        expect(registerRes.status).toBe(200);

        // Resolve code
        const res = await request(app)
            .get('/api/resolve-code/555666');
        
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('paired');
        expect(res.body.device.localIp).toBe('192.168.1.120');
        expect(res.body.device.deviceName).toBe('Den TV');
    });

    test('Non-existent pairing code returns 404', async () => {
        const res = await request(app)
            .get('/api/resolve-code/999999');
        expect(res.status).toBe(404);
    });

    test('POST /api/create with pairingCode -> GET /api/resolve returns pairingCode', async () => {
        const createRes = await request(app)
            .post('/api/create')
            .send({
                url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                senderName: 'Johnny',
                pairingCode: '111222'
            });
        
        expect(createRes.status).toBe(200);
        
        const resolveRes = await request(app)
            .get(`/api/resolve/${createRes.body.linkId}`);
        
        expect(resolveRes.status).toBe(200);
        expect(resolveRes.body.pairingCode).toBe('111222');
    });

    test('getClientIp uses x-forwarded-for header if present', async () => {
        const mockedIp = '203.0.113.195';

        // Register device with x-forwarded-for header
        const registerRes = await request(app)
            .post('/api/register')
            .set('x-forwarded-for', `${mockedIp}, 198.51.100.1`)
            .send({
                localIp: '192.168.1.150',
                deviceId: 'test-forwarded-for',
                deviceName: 'Forwarded Roku'
            });

        expect(registerRes.status).toBe(200);
        expect(registerRes.body.status).toBe('ok');
        expect(registerRes.body.matchIp).toBe(mockedIp);

        // Check status with x-forwarded-for header
        const statusRes = await request(app)
            .get('/api/status')
            .set('x-forwarded-for', `${mockedIp}`);

        expect(statusRes.status).toBe(200);
        expect(statusRes.body.publicIp).toBe(mockedIp);
        expect(statusRes.body.active).toBe(true);
        expect(statusRes.body.devices.length).toBeGreaterThan(0);

        // Find the device we just registered
        const device = statusRes.body.devices.find(d => d.deviceId === 'test-forwarded-for');
        expect(device).toBeDefined();
        expect(device.deviceName).toBe('Forwarded Roku');
    });
});
