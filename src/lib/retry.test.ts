/**
 * Unit Tests for Retry Logic
 * Tests exponential backoff and retry functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the logger to avoid side effects
vi.mock('./logger', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

import { retryWithBackoff, fetchWithRetry } from './retry';

describe('retryWithBackoff', () => {
    beforeEach(() => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
    });

    it('should return result immediately on first success', async () => {
        const fn = vi.fn().mockResolvedValue('success');
        
        const promise = retryWithBackoff(fn);
        const result = await promise;
        
        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable error', async () => {
        const networkError = new Error('Failed to fetch');
        const fn = vi.fn()
            .mockRejectedValueOnce(networkError)
            .mockResolvedValue('success');
        
        const promise = retryWithBackoff(fn, { maxRetries: 3, initialDelay: 100 });
        
        // First attempt fails immediately
        await vi.advanceTimersByTimeAsync(0);
        
        // Wait for delay before retry
        await vi.advanceTimersByTimeAsync(100);
        
        const result = await promise;
        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should throw immediately for non-retryable errors', async () => {
        const clientError: any = new Error('Bad request');
        clientError.status = 400;
        
        const fn = vi.fn().mockRejectedValue(clientError);
        
        await expect(retryWithBackoff(fn)).rejects.toThrow('Bad request');
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on 5xx server errors', async () => {
        const serverError: any = new Error('Internal Server Error');
        serverError.status = 500;
        
        const fn = vi.fn()
            .mockRejectedValueOnce(serverError)
            .mockResolvedValue('success');
        
        const promise = retryWithBackoff(fn, { initialDelay: 100 });
        
        await vi.advanceTimersByTimeAsync(100);
        
        const result = await promise;
        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should retry on 429 rate limiting', async () => {
        const rateLimitError: any = new Error('Too Many Requests');
        rateLimitError.status = 429;
        
        const fn = vi.fn()
            .mockRejectedValueOnce(rateLimitError)
            .mockResolvedValue('success');
        
        const promise = retryWithBackoff(fn, { initialDelay: 100 });
        
        await vi.advanceTimersByTimeAsync(100);
        
        const result = await promise;
        expect(result).toBe('success');
    });

    it('should respect maxRetries limit', async () => {
        const error = new Error('Network error');
        const fn = vi.fn().mockRejectedValue(error);
        
        const promise = retryWithBackoff(fn, { maxRetries: 2, initialDelay: 100 });
        
        // Add a catch handler to prevent unhandled rejection
        const safePromise = promise.catch(() => {});
        
        // Advance time to allow all retries to complete
        // Initial attempt + 2 retries with delays: 100ms, 200ms
        await vi.advanceTimersByTimeAsync(500);
        
        // Wait for the safe promise to complete
        await safePromise;
        
        // Now verify the function was called the correct number of times
        expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
        
        // Verify the promise actually rejected
        await expect(retryWithBackoff(fn, { maxRetries: 0, initialDelay: 100 }))
            .rejects.toThrow('Network error');
    });

    it('should apply exponential backoff', async () => {
        const error = new Error('timeout');
        const fn = vi.fn()
            .mockRejectedValueOnce(error)
            .mockRejectedValueOnce(error)
            .mockResolvedValue('success');
        
        const promise = retryWithBackoff(fn, {
            maxRetries: 3,
            initialDelay: 100,
            multiplier: 2
        });
        
        // First delay: 100ms
        await vi.advanceTimersByTimeAsync(100);
        
        // Second delay: 200ms (100 * 2)
        await vi.advanceTimersByTimeAsync(200);
        
        const result = await promise;
        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should cap delay at maxDelay', async () => {
        const error = new Error('network');
        const fn = vi.fn()
            .mockRejectedValueOnce(error)
            .mockRejectedValueOnce(error)
            .mockRejectedValueOnce(error)
            .mockResolvedValue('success');
        
        const promise = retryWithBackoff(fn, {
            maxRetries: 4,
            initialDelay: 1000,
            maxDelay: 2000,
            multiplier: 3
        });
        
        // First delay: 1000ms
        await vi.advanceTimersByTimeAsync(1000);
        
        // Second delay: would be 3000ms but capped at 2000ms
        await vi.advanceTimersByTimeAsync(2000);
        
        // Third delay: would be 9000ms but capped at 2000ms
        await vi.advanceTimersByTimeAsync(2000);
        
        const result = await promise;
        expect(result).toBe('success');
    });

    it('should use custom retryable function', async () => {
        const customError: any = new Error('Custom error');
        customError.shouldRetry = true;
        
        const fn = vi.fn()
            .mockRejectedValueOnce(customError)
            .mockResolvedValue('success');
        
        const promise = retryWithBackoff(fn, {
            initialDelay: 100,
            retryable: (error) => error?.shouldRetry === true
        });
        
        await vi.advanceTimersByTimeAsync(100);
        
        const result = await promise;
        expect(result).toBe('success');
    });
});

describe('fetchWithRetry', () => {
    beforeEach(() => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        global.fetch = vi.fn();
    });

    afterEach(() => {
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('should return response on successful fetch', async () => {
        const mockResponse = { ok: true, status: 200 };
        (global.fetch as any).mockResolvedValue(mockResponse);
        
        const result = await fetchWithRetry('https://api.example.com/data');
        
        expect(result).toBe(mockResponse);
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should pass request init options', async () => {
        const mockResponse = { ok: true, status: 200 };
        (global.fetch as any).mockResolvedValue(mockResponse);
        
        const init = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: 'test' })
        };
        
        await fetchWithRetry('https://api.example.com/data', init);
        
        expect(global.fetch).toHaveBeenCalledWith('https://api.example.com/data', init);
    });

    it('should retry on non-ok response with 5xx status', async () => {
        const errorResponse = { ok: false, status: 503, statusText: 'Service Unavailable' };
        const successResponse = { ok: true, status: 200 };
        
        (global.fetch as any)
            .mockResolvedValueOnce(errorResponse)
            .mockResolvedValue(successResponse);
        
        const promise = fetchWithRetry('https://api.example.com/data', undefined, {
            initialDelay: 100
        });
        
        await vi.advanceTimersByTimeAsync(100);
        
        const result = await promise;
        expect(result).toBe(successResponse);
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should not retry on 4xx client errors', async () => {
        const errorResponse = { ok: false, status: 404, statusText: 'Not Found' };
        
        (global.fetch as any).mockResolvedValue(errorResponse);
        
        await expect(fetchWithRetry('https://api.example.com/missing'))
            .rejects.toThrow('HTTP 404');
        
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should retry on 429 rate limit', async () => {
        const rateLimitResponse = { ok: false, status: 429, statusText: 'Too Many Requests' };
        const successResponse = { ok: true, status: 200 };
        
        (global.fetch as any)
            .mockResolvedValueOnce(rateLimitResponse)
            .mockResolvedValue(successResponse);
        
        const promise = fetchWithRetry('https://api.example.com/data', undefined, {
            initialDelay: 100
        });
        
        await vi.advanceTimersByTimeAsync(100);
        
        const result = await promise;
        expect(result).toBe(successResponse);
    });

    it('should retry on network errors', async () => {
        const networkError = new TypeError('Failed to fetch');
        const successResponse = { ok: true, status: 200 };
        
        (global.fetch as any)
            .mockRejectedValueOnce(networkError)
            .mockResolvedValue(successResponse);
        
        const promise = fetchWithRetry('https://api.example.com/data', undefined, {
            initialDelay: 100
        });
        
        await vi.advanceTimersByTimeAsync(100);
        
        const result = await promise;
        expect(result).toBe(successResponse);
    });
});

