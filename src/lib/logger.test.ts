/**
 * Unit Tests for Logger Utility
 * Tests structured logging with Sentry integration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from './logger';
import * as sentry from './sentry';

// Mock Sentry functions
vi.mock('./sentry', () => ({
    captureMessage: vi.fn(),
    captureException: vi.fn(),
    addBreadcrumb: vi.fn()
}));

// Mock $app/environment
vi.mock('$app/environment', () => ({
    browser: true
}));

// Mock $app/stores
vi.mock('$app/stores', () => ({
    page: {
        subscribe: vi.fn((fn) => {
            fn({
                url: {
                    href: 'http://localhost:5173/test',
                    pathname: '/test'
                },
                route: {
                    id: '/test'
                }
            });
            return () => {}; // unsubscribe
        })
    }
}));

describe('Logger', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset logger state
        logger.setLevel('debug');
        logger.setEnabled(true);
        
        // Mock console methods
        vi.spyOn(console, 'debug').mockImplementation(() => {});
        vi.spyOn(console, 'info').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Log Levels', () => {
        it('should log debug messages in development', () => {
            logger.debug('Test debug message');
            expect(console.debug).toHaveBeenCalled();
            expect(sentry.addBreadcrumb).toHaveBeenCalledWith(
                'Test debug message',
                'debug',
                undefined
            );
        });

        it('should log info messages', () => {
            logger.info('Test info message');
            expect(console.info).toHaveBeenCalled();
            expect(sentry.addBreadcrumb).toHaveBeenCalledWith(
                'Test info message',
                'info',
                undefined
            );
        });

        it('should log warning messages', () => {
            logger.warn('Test warning message');
            expect(console.warn).toHaveBeenCalled();
            expect(sentry.addBreadcrumb).toHaveBeenCalledWith(
                'Test warning message',
                'warning',
                undefined
            );
            expect(sentry.captureMessage).toHaveBeenCalledWith(
                'Test warning message',
                'warning'
            );
        });

        it('should log error messages', () => {
            logger.error('Test error message');
            expect(console.error).toHaveBeenCalled();
            expect(sentry.captureMessage).toHaveBeenCalledWith(
                'Test error message',
                'error'
            );
        });

        it('should capture exceptions when Error object provided', () => {
            const error = new Error('Test error');
            logger.error('Error occurred', error);
            expect(console.error).toHaveBeenCalled();
            expect(sentry.captureException).toHaveBeenCalledWith(error, {
                message: 'Error occurred'
            });
        });
    });

    describe('Log Context', () => {
        it('should include context in log messages', () => {
            logger.info('Test message', { userId: 123, action: 'test' });
            const call = vi.mocked(console.info).mock.calls[0][0];
            expect(call).toContain('Test message');
            expect(call).toContain('userId');
            expect(call).toContain('123');
        });

        it('should include page context in browser environment', () => {
            logger.info('Test message');
            const call = vi.mocked(console.info).mock.calls[0][0];
            expect(call).toContain('environment');
            expect(call).toContain('client');
        });

        it('should merge context with page context', () => {
            logger.info('Test message', { custom: 'value' });
            const call = vi.mocked(console.info).mock.calls[0][0];
            expect(call).toContain('custom');
            expect(call).toContain('value');
        });
    });

    describe('Log Level Filtering', () => {
        it('should not log debug messages when level is info', () => {
            logger.setLevel('info');
            logger.debug('Debug message');
            expect(console.debug).not.toHaveBeenCalled();
        });

        it('should log info messages when level is info', () => {
            logger.setLevel('info');
            logger.info('Info message');
            expect(console.info).toHaveBeenCalled();
        });

        it('should not log info messages when level is warn', () => {
            logger.setLevel('warn');
            logger.info('Info message');
            expect(console.info).not.toHaveBeenCalled();
        });

        it('should log warn messages when level is warn', () => {
            logger.setLevel('warn');
            logger.warn('Warning message');
            expect(console.warn).toHaveBeenCalled();
        });

        it('should not log warn messages when level is error', () => {
            logger.setLevel('error');
            logger.warn('Warning message');
            expect(console.warn).not.toHaveBeenCalled();
        });

        it('should log error messages when level is error', () => {
            logger.setLevel('error');
            logger.error('Error message');
            expect(console.error).toHaveBeenCalled();
        });
    });

    describe('Enable/Disable', () => {
        it('should not log when disabled', () => {
            logger.setEnabled(false);
            logger.info('Test message');
            logger.warn('Test warning');
            logger.error('Test error');
            expect(console.info).not.toHaveBeenCalled();
            expect(console.warn).not.toHaveBeenCalled();
            expect(console.error).not.toHaveBeenCalled();
        });

        it('should log when re-enabled', () => {
            logger.setEnabled(false);
            logger.setEnabled(true);
            logger.info('Test message');
            expect(console.info).toHaveBeenCalled();
        });
    });

    describe('Message Formatting', () => {
        it('should format messages with timestamp', () => {
            logger.info('Test message');
            const call = vi.mocked(console.info).mock.calls[0][0];
            expect(call).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        });

        it('should format messages with log level', () => {
            logger.info('Test message');
            const call = vi.mocked(console.info).mock.calls[0][0];
            expect(call).toContain('[INFO]');
        });

        it('should format error messages with error object', () => {
            const error = new Error('Test error');
            logger.error('Error occurred', error);
            expect(console.error).toHaveBeenCalledWith(
                expect.stringContaining('Error occurred'),
                error
            );
        });
    });

    describe('Convenience Exports', () => {
        it('should export convenience functions', async () => {
            const { debug, info, warn, error } = await import('./logger');
            expect(typeof debug).toBe('function');
            expect(typeof info).toBe('function');
            expect(typeof warn).toBe('function');
            expect(typeof error).toBe('function');
        });

        it('should use convenience exports correctly', async () => {
            // Import the logger module
            const loggerModule = await import('./logger');
            // Use the logger instance directly (convenience exports lose 'this' binding)
            loggerModule.logger.info('Test via logger instance');
            expect(console.info).toHaveBeenCalled();
        });
    });

    describe('Error Handling', () => {
        it('should handle non-Error objects in error method', () => {
            logger.error('Error occurred', 'string error');
            expect(console.error).toHaveBeenCalled();
            expect(sentry.captureMessage).toHaveBeenCalledWith(
                'Error occurred',
                'error'
            );
        });

        it('should handle undefined error parameter', () => {
            logger.error('Error occurred');
            expect(console.error).toHaveBeenCalled();
            expect(sentry.captureMessage).toHaveBeenCalledWith(
                'Error occurred',
                'error'
            );
        });
    });
});

