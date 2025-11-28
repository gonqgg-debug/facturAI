/**
 * Unit Tests for Grok API Integration
 * Tests invoice parsing via server-side Grok API proxy
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseInvoiceWithGrok } from './grok';
import type { Supplier, UserHints } from './types';

// Mock dependencies
vi.mock('./db', () => ({
    db: {
        globalContext: {
            toArray: vi.fn()
        }
    }
}));

vi.mock('./prompts', () => ({
    generateSystemPrompt: vi.fn((items, hints) => 'System prompt'),
    generateUserPrompt: vi.fn((text, supplier) => 'User prompt'),
    DEFAULT_MODEL: 'grok-3'
}));

vi.mock('./retry', () => ({
    retryWithBackoff: vi.fn()
}));

vi.mock('./logger', () => ({
    logger: {
        info: vi.fn(),
        debug: vi.fn(),
        error: vi.fn()
    }
}));

vi.mock('./csrf', () => ({
    getCsrfHeader: vi.fn(() => ({ 'X-CSRF-Token': 'test-token' }))
}));

import { db } from './db';
import { retryWithBackoff } from './retry';

describe('parseInvoiceWithGrok', () => {
    const mockOcrText = 'Invoice text with items and totals';
    const mockSupplier: Supplier = {
        id: 1,
        name: 'Test Supplier',
        rnc: '123456789',
        isActive: true
    };
    const mockHints: UserHints = {
        supplierName: 'Test Supplier',
        total: 1000,
        itbis: 180
    };

    beforeEach(() => {
        vi.clearAllMocks();
        
        // Mock database
        vi.mocked(db.globalContext.toArray).mockResolvedValue([]);
        
        // Mock global fetch
        global.fetch = vi.fn();
        
        // Default retryWithBackoff implementation that calls the function
        vi.mocked(retryWithBackoff).mockImplementation(async (fn) => {
            return await fn();
        });
    });

    it('should parse invoice successfully', async () => {
        const mockResponse = {
            choices: [{
                message: {
                    content: JSON.stringify({
                        supplierName: 'Test Supplier',
                        total: 1000,
                        items: []
                    })
                }
            }]
        };

        vi.mocked(retryWithBackoff).mockResolvedValue(mockResponse);

        const result = await parseInvoiceWithGrok(mockOcrText, mockSupplier, mockHints);

        expect(result).toHaveProperty('supplierName', 'Test Supplier');
        expect(result).toHaveProperty('total', 1000);
        expect(db.globalContext.toArray).toHaveBeenCalled();
    });

    it('should extract JSON from markdown code blocks', async () => {
        const mockResponse = {
            choices: [{
                message: {
                    content: '```json\n{"total": 1000}\n```'
                }
            }]
        };

        vi.mocked(retryWithBackoff).mockResolvedValue(mockResponse);

        const result = await parseInvoiceWithGrok(mockOcrText);

        expect(result).toHaveProperty('total', 1000);
    });

    it('should handle JSON without code blocks', async () => {
        const mockResponse = {
            choices: [{
                message: {
                    content: '{"total": 1000, "items": []}'
                }
            }]
        };

        vi.mocked(retryWithBackoff).mockResolvedValue(mockResponse);

        const result = await parseInvoiceWithGrok(mockOcrText);

        expect(result).toHaveProperty('total', 1000);
    });

    it('should use default model when not specified', async () => {
        const mockResponse = {
            choices: [{
                message: {
                    content: '{"total": 1000}'
                }
            }]
        };

        // Mock fetch response
        const mockFetchResponse = {
            ok: true,
            status: 200,
            statusText: 'OK',
            json: vi.fn().mockResolvedValue(mockResponse)
        };
        global.fetch = vi.fn().mockResolvedValue(mockFetchResponse);

        await parseInvoiceWithGrok(mockOcrText);

        expect(global.fetch).toHaveBeenCalledWith(
            '/api/grok',
            expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({
                    'Content-Type': 'application/json'
                })
            })
        );
    });

    it('should use custom model when specified', async () => {
        const mockResponse = {
            choices: [{
                message: {
                    content: '{"total": 1000}'
                }
            }]
        };

        vi.mocked(retryWithBackoff).mockResolvedValue(mockResponse);

        await parseInvoiceWithGrok(mockOcrText, undefined, undefined, 'grok-2');

        expect(retryWithBackoff).toHaveBeenCalled();
    });

    it('should include supplier in prompt when provided', async () => {
        const mockResponse = {
            choices: [{
                message: {
                    content: '{"total": 1000}'
                }
            }]
        };

        vi.mocked(retryWithBackoff).mockResolvedValue(mockResponse);

        await parseInvoiceWithGrok(mockOcrText, mockSupplier);

        expect(retryWithBackoff).toHaveBeenCalled();
    });

    it('should include hints in prompt when provided', async () => {
        const mockResponse = {
            choices: [{
                message: {
                    content: '{"total": 1000}'
                }
            }]
        };

        vi.mocked(retryWithBackoff).mockResolvedValue(mockResponse);

        await parseInvoiceWithGrok(mockOcrText, mockSupplier, mockHints);

        expect(retryWithBackoff).toHaveBeenCalled();
    });

    it('should handle API errors', async () => {
        const error = new Error('API request failed');
        vi.mocked(retryWithBackoff).mockRejectedValue(error);

        await expect(
            parseInvoiceWithGrok(mockOcrText)
        ).rejects.toThrow('API request failed');
    });

    it('should handle invalid response format', async () => {
        const mockResponse = {
            choices: [] // Empty choices
        };

        const mockFetchResponse = {
            ok: true,
            status: 200,
            statusText: 'OK',
            json: vi.fn().mockResolvedValue(mockResponse)
        };
        global.fetch = vi.fn().mockResolvedValue(mockFetchResponse);

        await expect(
            parseInvoiceWithGrok(mockOcrText)
        ).rejects.toThrow('Invalid response format from Grok');
    });

    it('should handle response without choices', async () => {
        const mockResponse = {}; // No choices property

        const mockFetchResponse = {
            ok: true,
            status: 200,
            statusText: 'OK',
            json: vi.fn().mockResolvedValue(mockResponse)
        };
        global.fetch = vi.fn().mockResolvedValue(mockFetchResponse);

        await expect(
            parseInvoiceWithGrok(mockOcrText)
        ).rejects.toThrow('Invalid response format from Grok');
    });

    it('should handle response without message', async () => {
        const mockResponse = {
            choices: [{}] // No message property
        };

        const mockFetchResponse = {
            ok: true,
            status: 200,
            statusText: 'OK',
            json: vi.fn().mockResolvedValue(mockResponse)
        };
        global.fetch = vi.fn().mockResolvedValue(mockFetchResponse);

        await expect(
            parseInvoiceWithGrok(mockOcrText)
        ).rejects.toThrow('Invalid response format from Grok');
    });

    it('should handle invalid JSON in response', async () => {
        const mockResponse = {
            choices: [{
                message: {
                    content: 'not valid json'
                }
            }]
        };

        vi.mocked(retryWithBackoff).mockResolvedValue(mockResponse);

        await expect(
            parseInvoiceWithGrok(mockOcrText)
        ).rejects.toThrow();
    });

    it('should extract JSON from content with extra text', async () => {
        const mockResponse = {
            choices: [{
                message: {
                    content: 'Here is the invoice data: {"total": 1000, "items": []} and some other text'
                }
            }]
        };

        vi.mocked(retryWithBackoff).mockResolvedValue(mockResponse);

        const result = await parseInvoiceWithGrok(mockOcrText);

        expect(result).toHaveProperty('total', 1000);
    });

    it('should use retry logic with correct configuration', async () => {
        const mockResponse = {
            choices: [{
                message: {
                    content: '{"total": 1000}'
                }
            }]
        };

        vi.mocked(retryWithBackoff).mockResolvedValue(mockResponse);

        await parseInvoiceWithGrok(mockOcrText);

        expect(retryWithBackoff).toHaveBeenCalledWith(
            expect.any(Function),
            expect.objectContaining({
                maxRetries: 3,
                initialDelay: 1000
            })
        );
    });

    it('should include CSRF token in request headers', async () => {
        const mockResponse = {
            choices: [{
                message: {
                    content: '{"total": 1000}'
                }
            }]
        };

        const mockFetchResponse = {
            ok: true,
            status: 200,
            statusText: 'OK',
            json: vi.fn().mockResolvedValue(mockResponse)
        };
        global.fetch = vi.fn().mockResolvedValue(mockFetchResponse);

        await parseInvoiceWithGrok(mockOcrText);

        expect(global.fetch).toHaveBeenCalledWith(
            '/api/grok',
            expect.objectContaining({
                headers: expect.objectContaining({
                    'X-CSRF-Token': 'test-token'
                })
            })
        );
    });

    it('should log information about the request', async () => {
        const { logger } = await import('./logger');
        const mockResponse = {
            choices: [{
                message: {
                    content: '{"total": 1000}'
                }
            }]
        };

        vi.mocked(retryWithBackoff).mockResolvedValue(mockResponse);

        await parseInvoiceWithGrok(mockOcrText);

        expect(logger.info).toHaveBeenCalledWith(
            'Sending to Grok via server proxy...',
            expect.objectContaining({
            })
        );
    });

    it('should handle empty OCR text', async () => {
        const mockResponse = {
            choices: [{
                message: {
                    content: '{"total": 0}'
                }
            }]
        };

        vi.mocked(retryWithBackoff).mockResolvedValue(mockResponse);

        const result = await parseInvoiceWithGrok('');

        expect(result).toHaveProperty('total', 0);
    });

    it('should pass temperature parameter', async () => {
        const mockResponse = {
            choices: [{
                message: {
                    content: '{"total": 1000}'
                }
            }]
        };

        const mockFetchResponse = {
            ok: true,
            status: 200,
            statusText: 'OK',
            json: vi.fn().mockResolvedValue(mockResponse)
        };
        global.fetch = vi.fn().mockResolvedValue(mockFetchResponse);

        await parseInvoiceWithGrok(mockOcrText);

        // Verify temperature is set to 0.1
        const fetchCall = vi.mocked(global.fetch).mock.calls[0];
        const fetchBody = JSON.parse(fetchCall[1]!.body as string);
        expect(fetchBody.temperature).toBe(0.1);
    });
});

