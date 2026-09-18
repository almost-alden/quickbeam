const request = require('supertest');
const fs = require('fs');
const path = require('path');
const app = require('../server');

describe('POST /api/service-request', () => {
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

    const validBody = { service: 'Crunchyroll', contact: 'fan@example.com' };

    it('accepts a valid request and stores the record', async () => {
        const res = await request(app)
            .post('/api/service-request')
            .set('X-Forwarded-For', '10.1.0.1')
            .send(validBody)
            .expect(200);

        expect(res.body).toEqual({ status: 'ok' });
        expect(savedRecords).toHaveLength(1);
        const rec = savedRecords[0];
        expect(rec.service).toBe('Crunchyroll');
        expect(rec.contact).toBe('fan@example.com');
        expect(rec.ts).toBeTruthy();

        // Structured log must not contain PII.
        const logArg = consoleSpy.mock.calls[0][0];
        expect(logArg).toContain('SERVICE_REQUEST');
        expect(logArg).toContain('Crunchyroll');
        expect(logArg).not.toContain('fan@example.com');
    });

    it('accepts a request with no contact info', async () => {
        await request(app)
            .post('/api/service-request')
            .set('X-Forwarded-For', '10.1.0.2')
            .send({ service: 'NASA+' })
            .expect(200);
        expect(savedRecords).toHaveLength(1);
        expect(savedRecords[0].contact).toBeUndefined();
    });

    it('rejects a missing or too-short service name', async () => {
        await request(app).post('/api/service-request')
            .set('X-Forwarded-For', '10.1.0.3').send({}).expect(400);
        await request(app).post('/api/service-request')
            .set('X-Forwarded-For', '10.1.0.3').send({ service: 'x' }).expect(400);
        expect(savedRecords).toHaveLength(0);
    });

    it('rejects an invalid contact value', async () => {
        await request(app).post('/api/service-request')
            .set('X-Forwarded-For', '10.1.0.4')
            .send({ service: 'Crunchyroll', contact: 'not-a-contact' }).expect(400);
        expect(savedRecords).toHaveLength(0);
    });

    it('rate-limits requests from a single IP', async () => {
        const ip = '10.1.0.99';
        for (let i = 0; i < 10; i++) {
            await request(app).post('/api/service-request').set('X-Forwarded-For', ip)
                .send({ service: `Service ${i}` }).expect(200);
        }
        await request(app).post('/api/service-request').set('X-Forwarded-For', ip)
            .send({ service: 'One too many' }).expect(429);
        expect(savedRecords).toHaveLength(10);
    });

    it('stores requests outside the repo directory by default', () => {
        const repoRoot = path.resolve(__dirname, '..', '..');
        expect(app.serviceRequestFilePath).toBeTruthy();
        expect(app.serviceRequestFilePath.startsWith(repoRoot + path.sep)).toBe(false);
    });
});
