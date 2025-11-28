/**
 * Sentry Configuration
 * Error monitoring and performance tracking
 */

import * as Sentry from '@sentry/sveltekit';
import { browser } from '$app/environment';
import { dev } from '$app/environment';

/**
 * Get Sentry DSN based on environment (client vs server)
 */
function getSentryDsn(): string | undefined {
    if (browser) {
        // Client-side: check window for DSN or use PUBLIC env
        // For now, we'll use the same env var on both sides
        // In production, you'd set PUBLIC_SENTRY_DSN for client
        return undefined; // Client-side DSN would come from PUBLIC_SENTRY_DSN
    } else {
        // Server-side: use private env var
        // This will be handled by importing env in the calling context
        return undefined; // Will be passed as parameter
    }
}

/**
 * Initialize Sentry (server-side)
 */
export function initSentry(dsn?: string) {
    
    // Only initialize if DSN is provided
    if (!dsn) {
        if (!dev) {
            console.warn('Sentry DSN not configured. Error monitoring disabled.');
        }
        return;
    }
    
    Sentry.init({
        dsn: dsn,
        environment: dev ? 'development' : 'production',
        
        // Set sample rates for error and performance monitoring
        tracesSampleRate: dev ? 1.0 : 0.1, // 100% in dev, 10% in production
        replaysSessionSampleRate: dev ? 1.0 : 0.1, // 100% in dev, 10% in production
        replaysOnErrorSampleRate: 1.0, // Always capture replays on errors
        
        // Enable Session Replay
        integrations: [
            Sentry.replayIntegration({
                maskAllText: false, // Don't mask text (adjust based on privacy needs)
                blockAllMedia: false // Don't block media (adjust based on privacy needs)
            })
        ],
        
        // Filter out known non-critical errors
        beforeSend(event, hint) {
            // Filter out expected errors (like 404s, network errors, etc.)
            if (event.exception) {
                const error = hint.originalException;
                
                // Ignore network errors (user might be offline)
                if (error instanceof Error) {
                    if (error.message.includes('Failed to fetch') || 
                        error.message.includes('NetworkError') ||
                        error.message.includes('network')) {
                        return null; // Don't send to Sentry
                    }
                }
            }
            
            return event;
        },
        
        // Configure what data to send
        sendDefaultPii: false, // Don't send PII by default (GDPR compliance)
        
        // Configure release tracking (optional)
        // release: process.env.npm_package_version,
    });
}

/**
 * Capture an exception manually
 */
export function captureException(error: Error, context?: Record<string, any>) {
    if (context) {
        Sentry.setContext('error_context', context);
    }
    Sentry.captureException(error);
}

/**
 * Capture a message
 */
export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
    Sentry.captureMessage(message, level);
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(message: string, category?: string, data?: Record<string, any>) {
    Sentry.addBreadcrumb({
        message,
        category: category || 'default',
        data,
        level: 'info'
    });
}

/**
 * Set user context for error tracking
 */
export function setUser(userId: string | number, username?: string, email?: string) {
    Sentry.setUser({
        id: String(userId),
        username,
        email
    });
}

/**
 * Clear user context (on logout)
 */
export function clearUser() {
    Sentry.setUser(null);
}

