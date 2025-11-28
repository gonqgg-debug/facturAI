/**
 * Unit Tests for Prompt Generation Functions
 * Tests AI prompt generation for invoice extraction
 */

import { describe, it, expect } from 'vitest';
import { generateSystemPrompt, generateUserPrompt, DEFAULT_MODEL } from './prompts';
import type { Supplier, UserHints, GlobalContextItem } from './types';

describe('DEFAULT_MODEL', () => {
    it('should have default model set', () => {
        expect(DEFAULT_MODEL).toBe('grok-3');
    });
});

describe('generateSystemPrompt', () => {
    it('should generate basic system prompt without context', () => {
        const prompt = generateSystemPrompt([]);
        
        expect(prompt).toContain('expert data extraction AI');
        expect(prompt).toContain('Dominican Republic invoices');
        expect(prompt).toContain('GLOBAL KNOWLEDGE BASE');
        expect(prompt).toContain('TAX RULES & REGULATIONS');
        expect(prompt).toContain('UNIT CONVERSIONS & PACK SIZES');
        expect(prompt).toContain('GENERAL BUSINESS LOGIC');
    });

    it('should include tax rules from global context', () => {
        const contextItems: GlobalContextItem[] = [
            {
                id: 1,
                title: 'ITBIS Rate',
                content: 'Standard ITBIS is 18%',
                type: 'rule',
                category: 'tax'
            }
        ];
        
        const prompt = generateSystemPrompt(contextItems);
        expect(prompt).toContain('ITBIS Rate');
        expect(prompt).toContain('Standard ITBIS is 18%');
    });

    it('should include conversion rules from global context', () => {
        const contextItems: GlobalContextItem[] = [
            {
                id: 1,
                title: 'Unit Conversion',
                content: '1 caja = 12 unidades',
                type: 'rule',
                category: 'conversion'
            }
        ];
        
        const prompt = generateSystemPrompt(contextItems);
        expect(prompt).toContain('Unit Conversion');
        expect(prompt).toContain('1 caja = 12 unidades');
    });

    it('should include business logic from global context', () => {
        const contextItems: GlobalContextItem[] = [
            {
                id: 1,
                title: 'Business Rule',
                content: 'Always verify totals',
                type: 'rule',
                category: 'business_logic'
            }
        ];
        
        const prompt = generateSystemPrompt(contextItems);
        expect(prompt).toContain('Business Rule');
        expect(prompt).toContain('Always verify totals');
    });

    it('should handle items without category as business logic', () => {
        const contextItems: GlobalContextItem[] = [
            {
                id: 1,
                title: 'General Rule',
                content: 'Some rule',
                type: 'rule'
            }
        ];
        
        const prompt = generateSystemPrompt(contextItems);
        expect(prompt).toContain('General Rule');
    });

    it('should include user hints when provided', () => {
        const hints: UserHints = {
            supplierName: 'Test Supplier',
            total: 1000,
            itbis: 180,
            isMultiPage: false
        };
        
        const prompt = generateSystemPrompt([], hints);
        expect(prompt).toContain('USER PROVIDED HINTS');
        expect(prompt).toContain('Test Supplier');
        expect(prompt).toContain('1000');
        expect(prompt).toContain('180');
        expect(prompt).toContain('Single-page Invoice');
    });

    it('should handle multi-page hints', () => {
        const hints: UserHints = {
            supplierName: 'Test Supplier',
            isMultiPage: true
        };
        
        const prompt = generateSystemPrompt([], hints);
        expect(prompt).toContain('Multi-page Invoice');
    });

    it('should handle missing hint values', () => {
        const hints: UserHints = {};
        const prompt = generateSystemPrompt([], hints);
        expect(prompt).toContain('Unknown');
    });

    it('should include critical instructions', () => {
        const prompt = generateSystemPrompt([]);
        expect(prompt).toContain('CRITICAL INSTRUCTIONS FOR ACCURACY');
        expect(prompt).toContain('Find the Hard Truths First');
        expect(prompt).toContain('Work Backwards to Solve for Price');
        expect(prompt).toContain('Infer Tax Status');
        expect(prompt).toContain('Unit Conversion');
        expect(prompt).toContain('Categorization');
        expect(prompt).toContain('Cleanup & Noise Reduction');
        expect(prompt).toContain('Exhaustive Extraction');
    });

    it('should include JSON structure template', () => {
        const prompt = generateSystemPrompt([]);
        expect(prompt).toContain('reasoning');
        expect(prompt).toContain('providerName');
        expect(prompt).toContain('items');
        expect(prompt).toContain('description');
        expect(prompt).toContain('quantity');
        expect(prompt).toContain('unitPrice');
        expect(prompt).toContain('total');
    });

    it('should handle multiple context items of different categories', () => {
        const contextItems: GlobalContextItem[] = [
            {
                id: 1,
                title: 'Tax Rule 1',
                content: 'Rule 1',
                type: 'rule',
                category: 'tax'
            },
            {
                id: 2,
                title: 'Conversion 1',
                content: 'Conv 1',
                type: 'rule',
                category: 'conversion'
            },
            {
                id: 3,
                title: 'Business Rule 1',
                content: 'Biz 1',
                type: 'rule',
                category: 'business_logic'
            }
        ];
        
        const prompt = generateSystemPrompt(contextItems);
        expect(prompt).toContain('Tax Rule 1');
        expect(prompt).toContain('Conversion 1');
        expect(prompt).toContain('Business Rule 1');
    });
});

describe('generateUserPrompt', () => {
    const mockOcrText = 'Invoice text here';

    it('should generate basic user prompt with OCR text', () => {
        const prompt = generateUserPrompt(mockOcrText);
        
        expect(prompt).toContain('RAW OCR TEXT');
        expect(prompt).toContain(mockOcrText);
        expect(prompt).toContain('generate the JSON output');
        expect(prompt).toContain('Total is King');
    });

    it('should include supplier examples when provided', () => {
        const supplier: Supplier = {
            id: 1,
            name: 'Test Supplier',
            rnc: '123456789',
            isActive: true,
            examples: [
                { total: 1000, items: [] },
                { total: 2000, items: [] }
            ]
        };
        
        const prompt = generateUserPrompt(mockOcrText, supplier);
        expect(prompt).toContain('REFERENCE EXAMPLES');
        expect(prompt).toContain('Previous invoices from this supplier');
    });

    it('should limit examples to last 3', () => {
        const supplier: Supplier = {
            id: 1,
            name: 'Test Supplier',
            rnc: '123456789',
            isActive: true,
            examples: [
                { total: 1000, items: [] },
                { total: 2000, items: [] },
                { total: 3000, items: [] },
                { total: 4000, items: [] },
                { total: 5000, items: [] }
            ]
        };
        
        const prompt = generateUserPrompt(mockOcrText, supplier);
        // Should only include last 3 examples
        // Count JSON objects in the examples section (each example is a JSON object)
        const examplesSection = prompt.split('RAW OCR TEXT')[0];
        const jsonMatches = examplesSection.match(/\{[^}]+\}/g);
        expect(jsonMatches?.length).toBe(3);
    });

    it('should include custom rules when provided', () => {
        const supplier: Supplier = {
            id: 1,
            name: 'Test Supplier',
            rnc: '123456789',
            isActive: true,
            customRules: 'Always extract RNC from header'
        };
        
        const prompt = generateUserPrompt(mockOcrText, supplier);
        expect(prompt).toContain('CUSTOM RULES FOR THIS SUPPLIER');
        expect(prompt).toContain('Always extract RNC from header');
    });

    it('should include both examples and custom rules', () => {
        const supplier: Supplier = {
            id: 1,
            name: 'Test Supplier',
            rnc: '123456789',
            isActive: true,
            examples: [{ total: 1000, items: [] }],
            customRules: 'Custom rule here'
        };
        
        const prompt = generateUserPrompt(mockOcrText, supplier);
        expect(prompt).toContain('REFERENCE EXAMPLES');
        expect(prompt).toContain('CUSTOM RULES FOR THIS SUPPLIER');
        expect(prompt).toContain('Custom rule here');
    });

    it('should handle supplier without examples or rules', () => {
        const supplier: Supplier = {
            id: 1,
            name: 'Test Supplier',
            rnc: '123456789',
            isActive: true
        };
        
        const prompt = generateUserPrompt(mockOcrText, supplier);
        expect(prompt).not.toContain('REFERENCE EXAMPLES');
        expect(prompt).not.toContain('CUSTOM RULES');
        expect(prompt).toContain(mockOcrText);
    });

    it('should handle empty OCR text', () => {
        const prompt = generateUserPrompt('');
        expect(prompt).toContain('RAW OCR TEXT');
    });

    it('should order sections correctly', () => {
        const supplier: Supplier = {
            id: 1,
            name: 'Test Supplier',
            rnc: '123456789',
            isActive: true,
            examples: [{ total: 1000, items: [] }],
            customRules: 'Rule'
        };
        
        const prompt = generateUserPrompt(mockOcrText, supplier);
        const examplesIndex = prompt.indexOf('REFERENCE EXAMPLES');
        const rulesIndex = prompt.indexOf('CUSTOM RULES');
        const ocrIndex = prompt.indexOf('RAW OCR TEXT');
        
        // Custom rules are prepended first, then examples, then base prompt (with OCR)
        // So order is: Rules -> Examples -> OCR
        expect(rulesIndex).toBeGreaterThanOrEqual(0);
        expect(examplesIndex).toBeGreaterThan(rulesIndex);
        expect(ocrIndex).toBeGreaterThan(examplesIndex);
    });
});

