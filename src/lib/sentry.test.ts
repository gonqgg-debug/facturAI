/**
 * Unit Tests for Sentry Integration
 * Tests error monitoring and tracking utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock variables
let mockBrowser = false;
let mockDev = true;

// Mock Sentry SDK before imports
vi.mock('@sentry/sveltekit', () => ({
    init: vi.fn(),
    captureException: vi.fn(),
    captureMessage: vi.fn(),
    addBreadcrumb: vi.fn(),
    setUser: vi.fn(),
    setContext: vi.fn(),
    replayIntegration: vi.fn(() => ({}))
}));

// Mock $app/environment
vi.mock('$app/environment', () => ({
    get browser() {
        return mockBrowser;
    },
    get dev() {
        return mockDev;
    }
}));

// Import Sentry module and mocked SDK
import * as Sentry from '@sentry/sveltekit';
import { 
    initSentry, 
    captureException, 
    captureMessage, 
    addBreadcrumb, 
    setUser, 
    clearUser 
} from './sentry';

describe('Sentry Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockBrowser = false;
        mockDev = true;
    });

    describe('initSentry', () => {
        it('should not initialize without DSN in dev mode', () => {
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            
            initSentry();
            
            expect(Sentry.init).not.toHaveBeenCalled();
            // Should not warn in dev mode
            expect(warnSpy).not.toHaveBeenCalled();
            
            warnSpy.mockRestore();
        });

        it('should warn when no DSN provided in production', () => {
            mockDev = false;
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            
            initSentry();
            
            expect(Sentry.init).not.toHaveBeenCalled();
            expect(warnSpy).toHaveBeenCalledWith('Sentry DSN not configured. Error monitoring disabled.');
            
            warnSpy.mockRestore();
        });

        it('should initialize Sentry with valid DSN', () => {
            const dsn = 'https://examplePublicKey@o0.ingest.sentry.io/0';
            
            initSentry(dsn);
            
            expect(Sentry.init).toHaveBeenCalledWith(expect.objectContaining({
                dsn: dsn
            }));
        });

        it('should set environment to development in dev mode', () => {
            mockDev = true;
            const dsn = 'https://test@sentry.io/1';
            
            initSentry(dsn);
            
            expect(Sentry.init).toHaveBeenCalledWith(expect.objectContaining({
                environment: 'development'
            }));
        });

        it('should set environment to production in prod mode', () => {
            mockDev = false;
            const dsn = 'https://test@sentry.io/1';
            
            initSentry(dsn);
            
            expect(Sentry.init).toHaveBeenCalledWith(expect.objectContaining({
                environment: 'production'
            }));
        });

        it('should set higher sample rate in dev mode', () => {
            mockDev = true;
            const dsn = 'https://test@sentry.io/1';
            
            initSentry(dsn);
            
            expect(Sentry.init).toHaveBeenCalledWith(expect.objectContaining({
                tracesSampleRate: 1.0,
                replaysSessionSampleRate: 1.0
            }));
        });

        it('should set lower sample rate in production', () => {
            mockDev = false;
            const dsn = 'https://test@sentry.io/1';
            
            initSentry(dsn);
            
            expect(Sentry.init).toHaveBeenCalledWith(expect.objectContaining({
                tracesSampleRate: 0.1,
                replaysSessionSampleRate: 0.1
            }));
        });

        it('should always capture replays on error', () => {
            const dsn = 'https://test@sentry.io/1';
            
            initSentry(dsn);
            
            expect(Sentry.init).toHaveBeenCalledWith(expect.objectContaining({
                replaysOnErrorSampleRate: 1.0
            }));
        });

        it('should disable PII sending by default', () => {
            const dsn = 'https://test@sentry.io/1';
            
            initSentry(dsn);
            
            expect(Sentry.init).toHaveBeenCalledWith(expect.objectContaining({
                sendDefaultPii: false
            }));
        });

        it('should include replay integration', () => {
            const dsn = 'https://test@sentry.io/1';
            
            initSentry(dsn);
            
            expect(Sentry.replayIntegration).toHaveBeenCalledWith({
                maskAllText: false,
                blockAllMedia: false
            });
        });

        it('should configure beforeSend filter', () => {
            const dsn = 'https://test@sentry.io/1';
            
            initSentry(dsn);
            
            expect(Sentry.init).toHaveBeenCalledWith(expect.objectContaining({
                beforeSend: expect.any(Function)
            }));
        });
    });

    describe('beforeSend filter', () => {
        it('should filter out network errors', () => {
            const dsn = 'https://test@sentry.io/1';
            initSentry(dsn);
            
            // Get the beforeSend function from the init call
            const initCall = (Sentry.init as any).mock.calls[0][0];
            const beforeSend = initCall.beforeSend;
            
            // Test with a network error
            const networkError = new Error('Failed to fetch');
            const event = { exception: { values: [{ value: 'Failed to fetch' }] } };
            const hint = { originalException: networkError };
            
            const result = beforeSend(event, hint);
            expect(result).toBeNull();
        });

        it('should filter out NetworkError messages', () => {
            const dsn = 'https://test@sentry.io/1';
            initSentry(dsn);
            
            const initCall = (Sentry.init as any).mock.calls[0][0];
            const beforeSend = initCall.beforeSend;
            
            const networkError = new Error('NetworkError when attempting to fetch resource');
            const event = { exception: { values: [{ value: 'NetworkError' }] } };
            const hint = { originalException: networkError };
            
            const result = beforeSend(event, hint);
            expect(result).toBeNull();
        });

        it('should filter out generic network errors', () => {
            const dsn = 'https://test@sentry.io/1';
            initSentry(dsn);
            
            const initCall = (Sentry.init as any).mock.calls[0][0];
            const beforeSend = initCall.beforeSend;
            
            const networkError = new Error('network request failed');
            const event = { exception: { values: [{ value: 'network' }] } };
            const hint = { originalException: networkError };
            
            const result = beforeSend(event, hint);
            expect(result).toBeNull();
        });

        it('should pass through non-network errors', () => {
            const dsn = 'https://test@sentry.io/1';
            initSentry(dsn);
            
            const initCall = (Sentry.init as any).mock.calls[0][0];
            const beforeSend = initCall.beforeSend;
            
            const regularError = new Error('Something went wrong');
            const event = { exception: { values: [{ value: 'Something went wrong' }] } };
            const hint = { originalException: regularError };
            
            const result = beforeSend(event, hint);
            expect(result).toBe(event);
        });

        it('should pass through events without exceptions', () => {
            const dsn = 'https://test@sentry.io/1';
            initSentry(dsn);
            
            const initCall = (Sentry.init as any).mock.calls[0][0];
            const beforeSend = initCall.beforeSend;
            
            const event = { message: 'Test message' };
            const hint = {};
            
            const result = beforeSend(event, hint);
            expect(result).toBe(event);
        });

        it('should handle non-Error exceptions gracefully', () => {
            const dsn = 'https://test@sentry.io/1';
            initSentry(dsn);
            
            const initCall = (Sentry.init as any).mock.calls[0][0];
            const beforeSend = initCall.beforeSend;
            
            const event = { exception: { values: [{ value: 'string error' }] } };
            const hint = { originalException: 'string error' };
            
            const result = beforeSend(event, hint);
            expect(result).toBe(event);
        });
    });

    describe('captureException', () => {
        it('should capture exception with Sentry', () => {
            const error = new Error('Test error');
            
            captureException(error);
            
            expect(Sentry.captureException).toHaveBeenCalledWith(error);
        });

        it('should set context when provided', () => {
            const error = new Error('Test error');
            const context = { userId: 123, action: 'test' };
            
            captureException(error, context);
            
            expect(Sentry.setContext).toHaveBeenCalledWith('error_context', context);
            expect(Sentry.captureException).toHaveBeenCalledWith(error);
        });

        it('should not set context when not provided', () => {
            const error = new Error('Test error');
            
            captureException(error);
            
            expect(Sentry.setContext).not.toHaveBeenCalled();
        });

        it('should handle context with nested objects', () => {
            const error = new Error('Test error');
            const context = { 
                user: { id: 1, name: 'Test' },
                metadata: { timestamp: Date.now() }
            };
            
            captureException(error, context);
            
            expect(Sentry.setContext).toHaveBeenCalledWith('error_context', context);
        });
    });

    describe('captureMessage', () => {
        it('should capture message with default level', () => {
            captureMessage('Test message');
            
            expect(Sentry.captureMessage).toHaveBeenCalledWith('Test message', 'info');
        });

        it('should capture message with info level', () => {
            captureMessage('Info message', 'info');
            
            expect(Sentry.captureMessage).toHaveBeenCalledWith('Info message', 'info');
        });

        it('should capture message with warning level', () => {
            captureMessage('Warning message', 'warning');
            
            expect(Sentry.captureMessage).toHaveBeenCalledWith('Warning message', 'warning');
        });

        it('should capture message with error level', () => {
            captureMessage('Error message', 'error');
            
            expect(Sentry.captureMessage).toHaveBeenCalledWith('Error message', 'error');
        });
    });

    describe('addBreadcrumb', () => {
        it('should add breadcrumb with message only', () => {
            addBreadcrumb('User clicked button');
            
            expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
                message: 'User clicked button',
                category: 'default',
                data: undefined,
                level: 'info'
            });
        });

        it('should add breadcrumb with category', () => {
            addBreadcrumb('Page loaded', 'navigation');
            
            expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
                message: 'Page loaded',
                category: 'navigation',
                data: undefined,
                level: 'info'
            });
        });

        it('should add breadcrumb with data', () => {
            const data = { pageUrl: '/home', userId: 123 };
            
            addBreadcrumb('Page loaded', 'navigation', data);
            
            expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
                message: 'Page loaded',
                category: 'navigation',
                data: data,
                level: 'info'
            });
        });

        it('should use default category when undefined', () => {
            addBreadcrumb('Action performed', undefined, { key: 'value' });
            
            expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(expect.objectContaining({
                category: 'default'
            }));
        });
    });

    describe('setUser', () => {
        it('should set user with ID only', () => {
            setUser(123);
            
            expect(Sentry.setUser).toHaveBeenCalledWith({
                id: '123',
                username: undefined,
                email: undefined
            });
        });

        it('should set user with string ID', () => {
            setUser('user-abc');
            
            expect(Sentry.setUser).toHaveBeenCalledWith({
                id: 'user-abc',
                username: undefined,
                email: undefined
            });
        });

        it('should set user with username', () => {
            setUser(1, 'testuser');
            
            expect(Sentry.setUser).toHaveBeenCalledWith({
                id: '1',
                username: 'testuser',
                email: undefined
            });
        });

        it('should set user with email', () => {
            setUser(1, 'testuser', 'test@example.com');
            
            expect(Sentry.setUser).toHaveBeenCalledWith({
                id: '1',
                username: 'testuser',
                email: 'test@example.com'
            });
        });

        it('should set user with all fields', () => {
            setUser(456, 'admin', 'admin@example.com');
            
            expect(Sentry.setUser).toHaveBeenCalledWith({
                id: '456',
                username: 'admin',
                email: 'admin@example.com'
            });
        });

        it('should convert numeric ID to string', () => {
            setUser(999);
            
            expect(Sentry.setUser).toHaveBeenCalledWith(expect.objectContaining({
                id: '999'
            }));
        });
    });

    describe('clearUser', () => {
        it('should clear user by setting to null', () => {
            clearUser();
            
            expect(Sentry.setUser).toHaveBeenCalledWith(null);
        });

        it('should be callable multiple times', () => {
            clearUser();
            clearUser();
            
            expect(Sentry.setUser).toHaveBeenCalledTimes(2);
            expect(Sentry.setUser).toHaveBeenCalledWith(null);
        });
    });

    describe('Integration workflow', () => {
        it('should support full user session workflow', () => {
            const dsn = 'https://test@sentry.io/1';
            
            // Initialize Sentry
            initSentry(dsn);
            expect(Sentry.init).toHaveBeenCalled();
            
            // User logs in
            setUser(1, 'testuser', 'test@example.com');
            expect(Sentry.setUser).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }));
            
            // Add breadcrumb for action
            addBreadcrumb('User logged in', 'auth', { method: 'pin' });
            expect(Sentry.addBreadcrumb).toHaveBeenCalled();
            
            // Capture an error
            const error = new Error('Failed to load data');
            captureException(error, { action: 'loadData' });
            expect(Sentry.captureException).toHaveBeenCalledWith(error);
            
            // User logs out
            clearUser();
            expect(Sentry.setUser).toHaveBeenCalledWith(null);
        });

        it('should work without DSN for graceful degradation', () => {
            // Initialize without DSN
            initSentry();
            
            // These should not throw even without initialization
            expect(() => captureException(new Error('test'))).not.toThrow();
            expect(() => captureMessage('test')).not.toThrow();
            expect(() => addBreadcrumb('test')).not.toThrow();
            expect(() => setUser(1)).not.toThrow();
            expect(() => clearUser()).not.toThrow();
        });
    });
});

