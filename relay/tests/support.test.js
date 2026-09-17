const request = require('supertest');
const app = require('../server');

describe('POST /api/support', () => {
    let consoleSpy;

    beforeEach(() => {
        // Spy on console.log
        consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        // Restore console.log
        consoleSpy.mockRestore();
    });

    it('should log structured JSON data and return 200', async () => {
        const payload = {
            name: 'Test User',
            email: 'test@example.com',
            subject: 'Test Subject',
            message: 'This is a test message\nwith a newline.'
        };

        const response = await request(app)
            .post('/api/support')
            .send(payload)
            .expect(200);

        expect(response.body).toEqual({
            status: 'ok',
            message: 'Your support ticket has been received.'
        });

        expect(consoleSpy).toHaveBeenCalledTimes(1);
        const logArg = consoleSpy.mock.calls[0][0];

        // Ensure it's valid JSON
        const parsedLog = JSON.parse(logArg);

        expect(parsedLog).toEqual({
            event: 'SUPPORT_EMAIL_TICKET',
            to: 'quickbeam+hello@johnnylehane.com',
            name: payload.name,
            email: payload.email,
            subject: payload.subject,
            message: payload.message
        });
    });

    it('should correctly escape malicious characters without allowing log injection', async () => {
        const payload = {
            name: 'Malicious User',
            email: 'hacker@example.com',
            subject: 'Injection Test',
            message: 'Fake Log: malicious\nMore stuff'
        };

        const response = await request(app)
            .post('/api/support')
            .send(payload)
            .expect(200);

        expect(consoleSpy).toHaveBeenCalledTimes(1);
        const logArg = consoleSpy.mock.calls[0][0];

        // Check that the newline and characters are escaped properly in the JSON string
        expect(logArg).toContain('"Fake Log: malicious\\nMore stuff"');

        // Ensure it parses back correctly without side effects
        const parsedLog = JSON.parse(logArg);
        expect(parsedLog.message).toBe(payload.message);
    });
});
