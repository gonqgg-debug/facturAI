/**
 * Retry Logic with Exponential Backoff
 * Provides retry functionality for API calls and other async operations
 */

import { logger } from './logger';

export interface RetryOptions {
    maxRetries?: number; // Maximum number of retries (default: 3)
    initialDelay?: number; // Initial delay in milliseconds (default: 1000)
    maxDelay?: number; // Maximum delay in milliseconds (default: 10000)
    multiplier?: number; // Exponential multiplier (default: 2)
    retryable?: (error: any) => boolean; // Function to determine if error is retryable
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    multiplier: 2,
    retryable: (error: any) => {
        // Retry on network errors, timeouts, and 5xx server errors
        if (error instanceof Error) {
            const message = error.message.toLowerCase();
            if (message.includes('fetch') || 
                message.includes('network') || 
                message.includes('timeout') ||
                message.includes('econnreset') ||
                message.includes('etimedout')) {
                return true;
            }
        }
        
        // Retry on HTTP 5xx errors (server errors)
        if (error?.status >= 500 && error?.status < 600) {
            return true;
        }
        
        // Retry on rate limiting (429)
        if (error?.status === 429) {
            return true;
        }
        
        return false;
    }
};

/**
 * Wait for specified milliseconds
 */
function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 */
function calculateDelay(attempt: number, options: Required<RetryOptions>): number {
    const delay = options.initialDelay * Math.pow(options.multiplier, attempt);
    return Math.min(delay, options.maxDelay);
}

/**
 * Retry an async function with exponential backoff
 * 
 * @param fn - Async function to retry
 * @param options - Retry configuration options
 * @returns Result of the function call
 * @throws Last error if all retries are exhausted
 */
export async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const opts: Required<RetryOptions> = { ...DEFAULT_OPTIONS, ...options };
    let lastError: any;

    for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
        try {
            const result = await fn();
            
            // If we retried, log success
            if (attempt > 0) {
                logger.info(`Retry succeeded after ${attempt} attempt(s)`);
            }
            
            return result;
        } catch (error) {
            lastError = error;

            // Check if error is retryable
            if (!opts.retryable(error)) {
                logger.debug('Error is not retryable, stopping retries', { error: String(error) });
                throw error;
            }

            // If this was the last attempt, throw the error
            if (attempt >= opts.maxRetries) {
                logger.error(`Max retries (${opts.maxRetries}) exceeded`, error instanceof Error ? error : new Error(String(error)));
                throw error;
            }

            // Calculate delay for next attempt
            const delayMs = calculateDelay(attempt, opts);
            
            logger.warn(`Retry attempt ${attempt + 1}/${opts.maxRetries} after ${delayMs}ms`, {
                error: error instanceof Error ? error.message : String(error),
                attempt: attempt + 1
            });

            // Wait before retrying
            await delay(delayMs);
        }
    }

    // Should never reach here, but TypeScript needs it
    throw lastError;
}

/**
 * Create a retry wrapper for fetch requests
 */
export async function fetchWithRetry(
    url: string | URL | Request,
    init?: RequestInit,
    options?: RetryOptions
): Promise<Response> {
    return retryWithBackoff(async () => {
        const response = await fetch(url, init);
        
        // Treat non-ok responses as errors for retry logic
        if (!response.ok) {
            const error: any = new Error(`HTTP ${response.status}: ${response.statusText}`);
            error.status = response.status;
            error.response = response;
            throw error;
        }
        
        return response;
    }, {
        ...options,
        retryable: (error: any) => {
            // Use custom retryable if provided
            if (options?.retryable) {
                return options.retryable(error);
            }
            
            // Default: retry on network errors, timeouts, and 5xx/429
            return DEFAULT_OPTIONS.retryable(error);
        }
    });
}

