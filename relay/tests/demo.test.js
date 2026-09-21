/**
 * Public free-demo landing path tests.
 *
 * The /demo page must link into the existing sender flow, carry the plain
 * beta wording, and collect nothing: no forms, no inputs, no analytics
 * identifiers, no contact/ZIP/signup capture.
 */

const request = require('supertest');
const app = require('../server');

describe('Public free-demo landing path', () => {
    let body;

    beforeAll(async () => {
        const res = await request(app).get('/demo');
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/html/);
        body = res.text;
    });

    test('links into the existing sender flow', () => {
        expect(body).toMatch(/href="\/"/);
    });

    test('carries the required plain beta wording', () => {
        expect(body).toMatch(/free demo/i);
        expect(body).toMatch(/experimental/i);
        expect(body).toMatch(/same home wi-?fi/i);
        expect(body).toMatch(/deep-link/i);
    });

    test('collects nothing: no forms, no inputs', () => {
        expect(body).not.toMatch(/<form/i);
        expect(body).not.toMatch(/<input/i);
        expect(body).not.toMatch(/<textarea/i);
        expect(body).not.toMatch(/<select/i);
    });

    test('loads no analytics or tracking scripts', () => {
        expect(body).not.toMatch(/googletagmanager/i);
        expect(body).not.toMatch(/google-analytics/i);
        expect(body).not.toMatch(/analytics\.js/i);
        expect(body).not.toMatch(/<script/i);
    });

    test('loads no webfonts', () => {
        expect(body).not.toMatch(/fonts\.googleapis\.com/i);
        expect(body).not.toMatch(/fonts\.gstatic\.com/i);
    });
});
