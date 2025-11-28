import { test, expect } from '@playwright/test';

test.describe('Health API', () => {
    test('health endpoint returns healthy status', async ({ request }) => {
        const response = await request.get('/api/health');
        
        expect(response.ok()).toBeTruthy();
        
        const data = await response.json();
        expect(data.status).toBe('healthy');
        expect(data.version).toBe('1.0.0');
        expect(data.timestamp).toBeDefined();
        expect(data.checks.api.status).toBe('ok');
    });

    test('health endpoint has no-cache headers', async ({ request }) => {
        const response = await request.get('/api/health');
        
        expect(response.headers()['cache-control']).toContain('no-cache');
    });
});

