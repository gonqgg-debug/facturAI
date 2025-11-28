/**
 * Structured Logging Utility
 * Replaces console.log/error with structured logging
 * Integrates with Sentry for error-level logs
 */

import { browser } from '$app/environment';
import { page } from '$app/stores';
import { get } from 'svelte/store';
import { captureMessage, captureException, addBreadcrumb } from './sentry';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
    [key: string]: any;
}

class Logger {
    private minLevel: LogLevel;
    private enabled: boolean;

    constructor() {
        // Set minimum log level based on environment
        this.minLevel = import.meta.env.DEV ? 'debug' : 'info';
        this.enabled = true;
    }

    /**
     * Get current page context
     */
    private getContext(): LogContext {
        if (!browser) {
            return { environment: 'server' };
        }

        try {
            const $page = get(page);
            return {
                environment: 'client',
                url: $page.url.href,
                path: $page.url.pathname,
                route: $page.route.id
            };
        } catch {
            return { environment: browser ? 'client' : 'server' };
        }
    }

    /**
     * Format log message with context
     */
    private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
        const timestamp = new Date().toISOString();
        const pageContext = this.getContext();
        const allContext = { ...pageContext, ...context };

        if (Object.keys(allContext).length > 0) {
            return `[${timestamp}] [${level.toUpperCase()}] ${message} ${JSON.stringify(allContext)}`;
        }

        return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    }

    /**
     * Check if log level should be output
     */
    private shouldLog(level: LogLevel): boolean {
        if (!this.enabled) return false;

        const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
        const currentLevelIndex = levels.indexOf(level);
        const minLevelIndex = levels.indexOf(this.minLevel);

        return currentLevelIndex >= minLevelIndex;
    }

    /**
     * Log debug message
     */
    debug(message: string, context?: LogContext): void {
        if (!this.shouldLog('debug')) return;

        const formatted = this.formatMessage('debug', message, context);
        console.debug(formatted);

        // Add breadcrumb for debugging
        if (browser) {
            addBreadcrumb(message, 'debug', context);
        }
    }

    /**
     * Log info message
     */
    info(message: string, context?: LogContext): void {
        if (!this.shouldLog('info')) return;

        const formatted = this.formatMessage('info', message, context);
        console.info(formatted);

        // Add breadcrumb
        if (browser) {
            addBreadcrumb(message, 'info', context);
        }
    }

    /**
     * Log warning message
     */
    warn(message: string, context?: LogContext): void {
        if (!this.shouldLog('warn')) return;

        const formatted = this.formatMessage('warn', message, context);
        console.warn(formatted);

        // Add breadcrumb and capture in Sentry (as info level, not error)
        if (browser) {
            addBreadcrumb(message, 'warning', context);
            captureMessage(message, 'warning');
        }
    }

    /**
     * Log error message
     */
    error(message: string, error?: Error | unknown, context?: LogContext): void {
        if (!this.shouldLog('error')) return;

        const formatted = this.formatMessage('error', message, context);
        console.error(formatted, error || '');

        // Capture in Sentry
        if (error instanceof Error) {
            captureException(error, { message, ...context });
        } else {
            captureMessage(message, 'error');
        }
    }

    /**
     * Set minimum log level
     */
    setLevel(level: LogLevel): void {
        this.minLevel = level;
    }

    /**
     * Enable/disable logging
     */
    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }
}

// Export singleton instance
export const logger = new Logger();

// Convenience exports
export const { debug, info, warn, error } = logger;

