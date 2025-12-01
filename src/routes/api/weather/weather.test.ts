/**
 * Integration Tests for Weather API Endpoint
 * Tests the /api/weather endpoint functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock environment variables
vi.mock('$env/dynamic/private', () => ({
    env: {
        OPENWEATHER_API_KEY: 'test-weather-key'
    }
}));

// Mock logger
vi.mock('$lib/logger', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

// Mock the $types module
vi.mock('./$types', () => ({}));

// Import after mocking
import { GET } from './+server';

describe('/api/weather Endpoint', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    function createMockEvent(searchParams: Record<string, string> = {}) {
        const url = new URL('http://localhost/api/weather');
        Object.entries(searchParams).forEach(([key, value]) => {
            url.searchParams.set(key, value);
        });

        return {
            request: new Request(url),
            url,
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
            route: { id: '/api/weather' }
        } as any;
    }

    describe('GET', () => {
        it('should return 400 when no location parameters provided', async () => {
            const mockEvent = createMockEvent({});

            const response = await GET(mockEvent);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toContain('Either city or both lat/lon parameters are required');
        });

        it('should return 400 when only lat is provided without lon', async () => {
            const mockEvent = createMockEvent({ lat: '40.7128' });

            const response = await GET(mockEvent);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toContain('Either city or both lat/lon parameters are required');
        });

        it('should return 400 when only lon is provided without lat', async () => {
            const mockEvent = createMockEvent({ lon: '-74.0060' });

            const response = await GET(mockEvent);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toContain('Either city or both lat/lon parameters are required');
        });

        it('should fetch weather by city name', async () => {
            const mockWeatherData = {
                main: { temp: 20, humidity: 65 },
                weather: [{ description: 'clear sky' }],
                name: 'New York'
            };

            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: vi.fn().mockResolvedValue(mockWeatherData)
            });

            const mockEvent = createMockEvent({ city: 'New York' });

            const response = await GET(mockEvent);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data).toEqual(mockWeatherData);
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('q=New%20York'),
                expect.any(Object)
            );
        });

        it('should fetch weather by coordinates', async () => {
            const mockWeatherData = {
                main: { temp: 25, humidity: 70 },
                weather: [{ description: 'sunny' }],
                coord: { lat: 40.71, lon: -74.01 }
            };

            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: vi.fn().mockResolvedValue(mockWeatherData)
            });

            const mockEvent = createMockEvent({ lat: '40.7128', lon: '-74.0060' });

            const response = await GET(mockEvent);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data).toEqual(mockWeatherData);
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('lat=40.7128'),
                expect.any(Object)
            );
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('lon=-74.0060'),
                expect.any(Object)
            );
        });

        it('should use metric units', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: vi.fn().mockResolvedValue({})
            });

            const mockEvent = createMockEvent({ city: 'London' });

            await GET(mockEvent);

            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('units=metric'),
                expect.any(Object)
            );
        });

        it('should handle 401 unauthorized error', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: false,
                status: 401,
                text: vi.fn().mockResolvedValue('Invalid API key')
            });

            const mockEvent = createMockEvent({ city: 'London' });

            const response = await GET(mockEvent);
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.error).toBe('Invalid Weather API key');
        });

        it('should handle 404 city not found error', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: false,
                status: 404,
                text: vi.fn().mockResolvedValue('city not found')
            });

            const mockEvent = createMockEvent({ city: 'NonexistentCity12345' });

            const response = await GET(mockEvent);
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.error).toBe('City not found');
        });

        it('should handle generic API error', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: false,
                status: 503,
                text: vi.fn().mockResolvedValue('Service unavailable')
            });

            const mockEvent = createMockEvent({ city: 'London' });

            const response = await GET(mockEvent);
            const data = await response.json();

            expect(response.status).toBe(503);
            expect(data.error).toContain('Weather API error');
        });

        it('should handle network errors', async () => {
            global.fetch = vi.fn().mockRejectedValue(new Error('Network failure'));

            const mockEvent = createMockEvent({ city: 'London' });

            const response = await GET(mockEvent);
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error).toBe('Network failure');
        });

        it('should handle request timeout', async () => {
            const abortError = new Error('Aborted');
            abortError.name = 'AbortError';
            
            global.fetch = vi.fn().mockRejectedValue(abortError);

            const mockEvent = createMockEvent({ city: 'London' });

            const response = await GET(mockEvent);
            const data = await response.json();

            expect(response.status).toBe(408);
            expect(data.error).toContain('timeout');
        });

        it('should URL encode city names with special characters', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: vi.fn().mockResolvedValue({})
            });

            const mockEvent = createMockEvent({ city: 'São Paulo, BR' });

            await GET(mockEvent);

            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('S%C3%A3o%20Paulo'),
                expect.any(Object)
            );
        });

        it('should prioritize city over lat/lon when both are provided', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: vi.fn().mockResolvedValue({})
            });

            const mockEvent = createMockEvent({ 
                city: 'Tokyo',
                lat: '35.6762',
                lon: '139.6503'
            });

            await GET(mockEvent);

            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('q=Tokyo'),
                expect.any(Object)
            );
            // Should not contain lat/lon when city is provided
            const callUrl = (global.fetch as any).mock.calls[0][0];
            expect(callUrl).not.toContain('lat=');
        });
    });
});

// Note: Testing "No API Key" scenario would require resetting module cache
// which is complex with vi.mock. The API key validation is tested indirectly
// through the error handling tests above.

