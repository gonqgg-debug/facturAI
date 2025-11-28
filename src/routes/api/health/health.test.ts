/**
 * Integration Tests for Health API Endpoint
 * Tests the /api/health endpoint functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the $types module
vi.mock('./$types', () => ({
    // Empty mock - RequestHandler type is only used for typing
}));

// Import the handler after mocking
import { GET } from './+server';

describe('/api/health Endpoint', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('GET', () => {
        it('should return healthy status', async () => {
            // Create mock request event
            const mockEvent = {
                request: new Request('http://localhost/api/health'),
                url: new URL('http://localhost/api/health'),
                params: {},
                locals: {},
                platform: undefined,
                cookies: {
                    get: vi.fn(),
                    getAll: vi.fn(),
                    set: vi.fn(),
                    delete: vi.fn(),
                    serialize: vi.fn()
                },
                fetch: vi.fn(),
                getClientAddress: vi.fn().mockReturnValue('127.0.0.1'),
                setHeaders: vi.fn(),
                isDataRequest: false,
                isSubRequest: false,
                route: { id: '/api/health' }
            } as any;

            const response = await GET(mockEvent);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.status).toBe('healthy');
            expect(data.timestamp).toBeDefined();
            expect(data.version).toBe('1.0.0');
            expect(data.checks).toBeDefined();
            expect(data.checks.api.status).toBe('ok');
        });

        it('should include uptime information', async () => {
            const mockEvent = {
                request: new Request('http://localhost/api/health'),
                url: new URL('http://localhost/api/health'),
                params: {},
                locals: {},
                cookies: {
                    get: vi.fn(),
                    getAll: vi.fn(),
                    set: vi.fn(),
                    delete: vi.fn(),
                    serialize: vi.fn()
                },
                fetch: vi.fn(),
                getClientAddress: vi.fn().mockReturnValue('127.0.0.1'),
                setHeaders: vi.fn(),
                isDataRequest: false,
                isSubRequest: false,
                route: { id: '/api/health' }
            } as any;

            const response = await GET(mockEvent);
            const data = await response.json();

            // Uptime should be defined (or null if process.uptime not available)
            expect('uptime' in data).toBe(true);
        });

        it('should include API latency', async () => {
            const mockEvent = {
                request: new Request('http://localhost/api/health'),
                url: new URL('http://localhost/api/health'),
                params: {},
                locals: {},
                cookies: {
                    get: vi.fn(),
                    getAll: vi.fn(),
                    set: vi.fn(),
                    delete: vi.fn(),
                    serialize: vi.fn()
                },
                fetch: vi.fn(),
                getClientAddress: vi.fn().mockReturnValue('127.0.0.1'),
                setHeaders: vi.fn(),
                isDataRequest: false,
                isSubRequest: false,
                route: { id: '/api/health' }
            } as any;

            const response = await GET(mockEvent);
            const data = await response.json();

            expect(data.checks.api.latency).toBeDefined();
            expect(typeof data.checks.api.latency).toBe('number');
            expect(data.checks.api.latency).toBeGreaterThanOrEqual(0);
        });

        it('should set correct cache headers', async () => {
            const mockEvent = {
                request: new Request('http://localhost/api/health'),
                url: new URL('http://localhost/api/health'),
                params: {},
                locals: {},
                cookies: {
                    get: vi.fn(),
                    getAll: vi.fn(),
                    set: vi.fn(),
                    delete: vi.fn(),
                    serialize: vi.fn()
                },
                fetch: vi.fn(),
                getClientAddress: vi.fn().mockReturnValue('127.0.0.1'),
                setHeaders: vi.fn(),
                isDataRequest: false,
                isSubRequest: false,
                route: { id: '/api/health' }
            } as any;

            const response = await GET(mockEvent);

            expect(response.headers.get('Cache-Control')).toBe('no-cache, no-store, must-revalidate');
            expect(response.headers.get('Pragma')).toBe('no-cache');
            expect(response.headers.get('Expires')).toBe('0');
        });

        it('should return valid ISO timestamp', async () => {
            const mockEvent = {
                request: new Request('http://localhost/api/health'),
                url: new URL('http://localhost/api/health'),
                params: {},
                locals: {},
                cookies: {
                    get: vi.fn(),
                    getAll: vi.fn(),
                    set: vi.fn(),
                    delete: vi.fn(),
                    serialize: vi.fn()
                },
                fetch: vi.fn(),
                getClientAddress: vi.fn().mockReturnValue('127.0.0.1'),
                setHeaders: vi.fn(),
                isDataRequest: false,
                isSubRequest: false,
                route: { id: '/api/health' }
            } as any;

            const response = await GET(mockEvent);
            const data = await response.json();

            // Verify timestamp is valid ISO date
            const parsedDate = new Date(data.timestamp);
            expect(parsedDate.toISOString()).toBe(data.timestamp);
        });
    });
});

