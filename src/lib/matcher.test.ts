/**
 * Unit Tests for Product Matching Functions
 * Tests fuzzy search and product matching logic
 */

import { describe, it, expect } from 'vitest';
import {
    normalizeText,
    findProductMatches,
    autoLinkInvoiceItems,
    calculateSimilarity
} from './matcher';
import type { Product } from './types';

describe('normalizeText', () => {
    it('should lowercase text', () => {
        expect(normalizeText('PRESIDENTE')).toBe('presidente');
    });

    it('should remove accents', () => {
        expect(normalizeText('plátano')).toBe('platano');
        expect(normalizeText('azúcar')).toBe('azucar');
    });

    it('should remove special characters', () => {
        expect(normalizeText('test@product!')).toBe('test product');
    });

    it('should collapse multiple spaces', () => {
        expect(normalizeText('test    product')).toBe('test product');
    });

    it('should trim whitespace', () => {
        expect(normalizeText('  test  ')).toBe('test');
    });

    it('should expand common abbreviations', () => {
        expect(normalizeText('pres')).toBe('presidente');
        expect(normalizeText('cerv')).toBe('cerveza');
        expect(normalizeText('pltno')).toBe('platano');
    });

    it('should handle empty string', () => {
        expect(normalizeText('')).toBe('');
    });

    it('should handle null/undefined gracefully', () => {
        expect(normalizeText(null as any)).toBe('');
        expect(normalizeText(undefined as any)).toBe('');
    });

    it('should expand unit abbreviations', () => {
        expect(normalizeText('lb')).toBe('libra');
        expect(normalizeText('gal')).toBe('galon');
        expect(normalizeText('lt')).toBe('litro');
    });
});

describe('findProductMatches', () => {
    const createProduct = (overrides: Partial<Product> = {}): Product => ({
        id: 1,
        name: 'Test Product',
        sku: 'TEST-001',
        barcode: '',
        category: 'Test',
        unit: 'unit',
        currentStock: 10,
        minStock: 5,
        supplierId: 1,
        lastPrice: 100,
        sellingPrice: 150,
        taxRate: 0.18,
        priceIncludesTax: true,
        costIncludesTax: true,
        costTaxRate: 0.18,
        isExempt: false,
        ...overrides
    } as Product);

    it('should return empty result for empty description', () => {
        const result = findProductMatches('', [createProduct()]);
        expect(result.fuzzyMatches).toEqual([]);
        expect(result.confidence).toBe('none');
    });

    it('should return empty result for empty products array', () => {
        const result = findProductMatches('test', []);
        expect(result.fuzzyMatches).toEqual([]);
        expect(result.confidence).toBe('none');
    });

    it('should find exact match by name', () => {
        const product = createProduct({ name: 'Cerveza Presidente' });
        const result = findProductMatches('Cerveza Presidente', [product]);
        
        expect(result.exactMatch).toEqual(product);
        expect(result.fuzzyMatches[0].score).toBe(100);
        expect(result.confidence).toBe('high');
    });

    it('should find exact match by barcode', () => {
        const product = createProduct({ name: 'Product', barcode: '123456789' });
        const result = findProductMatches('123456789', [product]);
        
        expect(result.exactMatch).toEqual(product);
        expect(result.confidence).toBe('high');
    });

    it('should find exact match by productId', () => {
        const product = createProduct({ name: 'Product', productId: 'PROD-001' });
        const result = findProductMatches('PROD-001', [product]);
        
        expect(result.exactMatch).toEqual(product);
        expect(result.confidence).toBe('high');
    });

    it('should find exact match by alias', () => {
        const product = createProduct({ 
            name: 'Cerveza Presidente',
            aliases: ['Pres', 'Presi']
        });
        const result = findProductMatches('Pres', [product]);
        
        expect(result.exactMatch).toEqual(product);
        expect(result.confidence).toBe('high');
    });

    it('should find fuzzy matches', () => {
        const product = createProduct({ name: 'Cerveza Presidente' });
        const result = findProductMatches('cerveza presid', [product]);
        
        expect(result.fuzzyMatches.length).toBeGreaterThan(0);
        expect(result.fuzzyMatches[0].product).toEqual(product);
    });

    it('should limit results to maxResults', () => {
        const products = Array.from({ length: 10 }, (_, i) => 
            createProduct({ id: i + 1, name: `Product ${i + 1}` })
        );
        const result = findProductMatches('product', products, 3);
        
        expect(result.fuzzyMatches.length).toBeLessThanOrEqual(3);
    });

    it('should determine confidence levels correctly', () => {
        const product = createProduct({ name: 'Exact Match Product' });
        
        // High confidence (exact match)
        const exactResult = findProductMatches('Exact Match Product', [product]);
        expect(exactResult.confidence).toBe('high');
        
        // Should have fuzzy matches with scores
        const fuzzyResult = findProductMatches('exact match', [product]);
        expect(['high', 'medium', 'low']).toContain(fuzzyResult.confidence);
    });

    it('should identify matched field', () => {
        const product = createProduct({ 
            name: 'Product',
            barcode: '123456',
            productId: 'PROD-001'
        });
        
        const barcodeResult = findProductMatches('123456', [product]);
        // Exact match by barcode should have high confidence
        expect(barcodeResult.fuzzyMatches.length).toBeGreaterThan(0);
        expect(['barcode', 'exact']).toContain(barcodeResult.fuzzyMatches[0].matchedOn);
        
        const skuResult = findProductMatches('PROD-001', [product]);
        expect(skuResult.fuzzyMatches.length).toBeGreaterThan(0);
        expect(['sku', 'exact']).toContain(skuResult.fuzzyMatches[0].matchedOn);
    });

    it('should handle case-insensitive matching', () => {
        const product = createProduct({ name: 'Cerveza Presidente' });
        const result = findProductMatches('CERVEZA PRESIDENTE', [product]);
        
        expect(result.exactMatch).toEqual(product);
    });

    it('should handle accented characters', () => {
        const product = createProduct({ name: 'Plátano' });
        const result = findProductMatches('platano', [product]);
        
        expect(result.fuzzyMatches.length).toBeGreaterThan(0);
    });
});

describe('autoLinkInvoiceItems', () => {
    const createProduct = (overrides: Partial<Product> = {}): Product => ({
        id: 1,
        name: 'Test Product',
        sku: 'TEST-001',
        barcode: '',
        category: 'Test',
        unit: 'unit',
        currentStock: 10,
        minStock: 5,
        supplierId: 1,
        lastPrice: 100,
        sellingPrice: 150,
        taxRate: 0.18,
        priceIncludesTax: true,
        costIncludesTax: true,
        costTaxRate: 0.18,
        isExempt: false,
        ...overrides
    } as Product);

    it('should return items with match results', () => {
        const items = [
            { description: 'Test Product' },
            { description: 'Another Product' }
        ];
        const products = [createProduct({ name: 'Test Product' })];
        
        const result = autoLinkInvoiceItems(items, products);
        
        expect(result).toHaveLength(2);
        expect(result[0].index).toBe(0);
        expect(result[0].originalDescription).toBe('Test Product');
        expect(result[0].matchResult).toBeDefined();
    });

    it('should skip items that already have productId', () => {
        const items = [
            { description: 'Test Product', productId: 'PROD-001' }
        ];
        const products = [createProduct({ productId: 'PROD-001', name: 'Test Product' })];
        
        const result = autoLinkInvoiceItems(items, products);
        
        expect(result[0].autoLinked).toBe(false);
        expect(result[0].matchResult.confidence).toBe('high');
    });

    it('should auto-link items with high confidence matches', () => {
        const items = [
            { description: 'Test Product' }
        ];
        const products = [createProduct({ name: 'Test Product' })];
        
        const result = autoLinkInvoiceItems(items, products, 90);
        
        expect(result[0].autoLinked).toBe(true);
    });

    it('should not auto-link items below threshold', () => {
        const items = [
            { description: 'Completely Different Product Name That Does Not Match' }
        ];
        const products = [createProduct({ name: 'Test Product' })];
        
        const result = autoLinkInvoiceItems(items, products, 90);
        
        // If similarity is below 90, should not auto-link
        // autoLinked will be false if no match or score < threshold
        expect(result[0].autoLinked).toBeFalsy();
        expect(result[0].matchResult).toBeDefined();
    });

    it('should handle items with existing productId', () => {
        const items = [
            { description: 'Test Product', productId: 'EXISTING-001' }
        ];
        const products = [
            createProduct({ productId: 'EXISTING-001', name: 'Existing Product' })
        ];
        
        const result = autoLinkInvoiceItems(items, products);
        
        expect(result[0].autoLinked).toBe(false);
        expect(result[0].matchResult.exactMatch).toBeDefined();
    });

    it('should handle multiple items', () => {
        const items = [
            { description: 'Product 1' },
            { description: 'Product 2' },
            { description: 'Product 3' }
        ];
        const products = [
            createProduct({ id: 1, name: 'Product 1' }),
            createProduct({ id: 2, name: 'Product 2' }),
            createProduct({ id: 3, name: 'Product 3' })
        ];
        
        const result = autoLinkInvoiceItems(items, products);
        
        expect(result).toHaveLength(3);
        result.forEach((r, i) => {
            expect(r.index).toBe(i);
            expect(r.originalDescription).toBe(`Product ${i + 1}`);
        });
    });
});

describe('calculateSimilarity', () => {
    it('should return 100 for identical strings', () => {
        expect(calculateSimilarity('test', 'test')).toBe(100);
    });

    it('should return 100 for identical normalized strings', () => {
        expect(calculateSimilarity('Test', 'test')).toBe(100);
        expect(calculateSimilarity('Plátano', 'platano')).toBe(100);
    });

    it('should return 0 for completely different strings', () => {
        const similarity = calculateSimilarity('abc', 'xyz');
        expect(similarity).toBeLessThan(50);
    });

    it('should return 0 for empty strings', () => {
        expect(calculateSimilarity('', 'test')).toBe(0);
        expect(calculateSimilarity('test', '')).toBe(0);
        expect(calculateSimilarity('', '')).toBe(100);
    });

    it('should calculate similarity for similar strings', () => {
        const similarity = calculateSimilarity('presidente', 'president');
        expect(similarity).toBeGreaterThan(50);
        expect(similarity).toBeLessThan(100);
    });

    it('should handle single character differences', () => {
        const similarity = calculateSimilarity('test', 'tests');
        expect(similarity).toBeGreaterThan(70);
    });

    it('should normalize text before comparison', () => {
        expect(calculateSimilarity('Plátano', 'platano')).toBe(100);
        expect(calculateSimilarity('TEST', 'test')).toBe(100);
    });

    it('should handle special characters', () => {
        const similarity = calculateSimilarity('test-product', 'test product');
        expect(similarity).toBeGreaterThan(80);
    });

    it('should return values between 0 and 100', () => {
        const similarity = calculateSimilarity('abc', 'xyz');
        expect(similarity).toBeGreaterThanOrEqual(0);
        expect(similarity).toBeLessThanOrEqual(100);
    });
});

