const request = require('supertest');
const fs = require('fs');
const app = require('../server');

describe('POST /api/interest', () => {
    let consoleSpy;
    let appendSpy;
    let mkdirSpy;
    let savedRecords;

    beforeEach(() => {
        consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        savedRecords = [];
        mkdirSpy = jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
        appendSpy = jest.spyOn(fs, 'appendFileSync').mockImplementation((file, line) => {
            savedRecords.push(JSON.parse(line));
        });
    });

    afterEach(() => {
        consoleSpy.mockRestore();
        appendSpy.mockRestore();
        mkdirSpy.mockRestore();
    });

    const validBody = {
        phone: '(555) 123-4567',
        email: 'fan@example.com',
        zip: '12946',
        channels: ['youtube', 'netflix', 'disney-plus'],
    };

    it('accepts a valid signup and stores the record', async () => {
        const res = await request(app)
            .post('/api/interest')
            .set('X-Forwarded-For', '10.0.0.1')
            .send(validBody)
            .expect(200);

        expect(res.body).toEqual({ status: 'ok' });
        expect(savedRecords).toHaveLength(1);
        const rec = savedRecords[0];
        expect(rec.phone).toBe('5551234567');
        expect(rec.email).toBe('fan@example.com');
        expect(rec.zip).toBe('12946');
        expect(rec.channels).toEqual(['youtube', 'netflix', 'disney-plus']);
        expect(rec.ts).toBeTruthy();

        // Structured log must not contain PII.
        const logArg = consoleSpy.mock.calls[0][0];
        expect(logArg).toContain('INTEREST_SIGNUP');
        expect(logArg).not.toContain('5551234567');
        expect(logArg).not.toContain('fan@example.com');
    });

    it('accepts email-only signup', async () => {
        const res = await request(app)
            .post('/api/interest')
            .set('X-Forwarded-For', '10.0.0.2')
            .send({ email: 'solo@example.com', zip: '10001', channels: ['hulu'] })
            .expect(200);
        expect(res.body.status).toBe('ok');
        expect(savedRecords[0].email).toBe('solo@example.com');
        expect(savedRecords[0].phone).toBeUndefined();
    });

    it('rejects signup with neither phone nor email', async () => {
        const res = await request(app)
            .post('/api/interest')
            .set('X-Forwarded-For', '10.0.0.3')
            .send({ zip: '12946', channels: ['youtube'] })
            .expect(400);
        expect(res.body.error).toMatch(/phone number or email/i);
        expect(savedRecords).toHaveLength(0);
    });

    it('rejects invalid phone, email, and zip', async () => {
        await request(app).post('/api/interest').set('X-Forwarded-For', '10.0.0.4')
            .send({ ...validBody, phone: '12' }).expect(400);
        await request(app).post('/api/interest').set('X-Forwarded-For', '10.0.0.5')
            .send({ ...validBody, phone: '', email: 'not-an-email' }).expect(400);
        await request(app).post('/api/interest').set('X-Forwarded-For', '10.0.0.6')
            .send({ ...validBody, zip: 'ABCDE' }).expect(400);
        expect(savedRecords).toHaveLength(0);
    });

    it('rejects missing, too many, or unknown channels', async () => {
        await request(app).post('/api/interest').set('X-Forwarded-For', '10.0.0.7')
            .send({ ...validBody, channels: [] }).expect(400);
        await request(app).post('/api/interest').set('X-Forwarded-For', '10.0.0.8')
            .send({ ...validBody, channels: ['youtube', 'netflix', 'hulu', 'max', 'plex', 'tubi'] }).expect(400);
        await request(app).post('/api/interest').set('X-Forwarded-For', '10.0.0.9')
            .send({ ...validBody, channels: ['definitely-not-a-service'] }).expect(400);
        expect(savedRecords).toHaveLength(0);
    });

    it('rate-limits signups from a single IP', async () => {
        const ip = '10.0.0.99';
        for (let i = 0; i < 10; i++) {
            await request(app).post('/api/interest').set('X-Forwarded-For', ip)
                .send({ ...validBody, email: `user${i}@example.com` }).expect(200);
        }
        const res = await request(app).post('/api/interest').set('X-Forwarded-For', ip)
            .send({ ...validBody, email: 'user11@example.com' }).expect(429);
        expect(res.body.error).toMatch(/too many/i);
        expect(savedRecords).toHaveLength(10);
    });

    it('stores signups outside the repo directory by default', () => {
        const repoRoot = require('path').resolve(__dirname, '..', '..');
        expect(app.interestFilePath).toBeTruthy();
        expect(app.interestFilePath.startsWith(repoRoot + require('path').sep)).toBe(false);
    });
});
