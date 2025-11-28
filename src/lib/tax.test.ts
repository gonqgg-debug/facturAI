/**
 * Unit Tests for Tax Calculation Functions
 * Tests Dominican Republic tax (ITBIS) calculations
 */

import { describe, it, expect } from 'vitest';
import {
    ITBIS_RATE,
    ITBIS_RATE_REDUCED,
    ITBIS_RATE_EXEMPT,
    TAX_RATES,
    calculateItbis,
    calculateNetFromTotal,
    validateNcf,
    getNcfType,
    recalculateInvoice,
    recalculateFromTotal,
    getPriceWithoutTax,
    getPriceWithTax,
    getItbisAmount,
    getProductCostExTax,
    getProductPriceExTax,
    calculateMarginExTax,
    calculatePriceFromMargin,
    getCartItemBreakdown
} from './tax';
import type { Invoice, InvoiceItem, Product } from './types';

describe('Tax Constants', () => {
    it('should have correct standard ITBIS rate (18%)', () => {
        expect(ITBIS_RATE).toBe(0.18);
    });

    it('should have correct reduced ITBIS rate (16%)', () => {
        expect(ITBIS_RATE_REDUCED).toBe(0.16);
    });

    it('should have correct exempt rate (0%)', () => {
        expect(ITBIS_RATE_EXEMPT).toBe(0);
    });

    it('should have all tax rates defined', () => {
        expect(TAX_RATES).toHaveLength(3);
        expect(TAX_RATES.map(r => r.value)).toEqual([0.18, 0.16, 0]);
    });
});

describe('calculateItbis', () => {
    it('should calculate 18% ITBIS correctly', () => {
        expect(calculateItbis(100)).toBe(18);
        expect(calculateItbis(1000)).toBe(180);
        expect(calculateItbis(50)).toBe(9);
    });

    it('should handle decimal amounts', () => {
        expect(calculateItbis(99.99)).toBe(18);
        expect(calculateItbis(123.45)).toBe(22.22);
    });

    it('should handle zero', () => {
        expect(calculateItbis(0)).toBe(0);
    });

    it('should round to 2 decimal places', () => {
        const result = calculateItbis(33.33);
        expect(result.toString().split('.')[1]?.length || 0).toBeLessThanOrEqual(2);
    });
});

describe('calculateNetFromTotal', () => {
    it('should extract net and ITBIS from total', () => {
        const result = calculateNetFromTotal(118);
        expect(result.net).toBe(100);
        expect(result.itbis).toBe(18);
    });

    it('should handle larger amounts', () => {
        const result = calculateNetFromTotal(1180);
        expect(result.net).toBe(1000);
        expect(result.itbis).toBe(180);
    });

    it('should handle decimal totals', () => {
        const result = calculateNetFromTotal(59);
        expect(result.net).toBe(50);
        expect(result.itbis).toBe(9);
    });

    it('should handle zero', () => {
        const result = calculateNetFromTotal(0);
        expect(result.net).toBe(0);
        expect(result.itbis).toBe(0);
    });
});

describe('validateNcf', () => {
    it('should validate standard NCF format (B01...)', () => {
        expect(validateNcf('B0100000001')).toBe(true);
        expect(validateNcf('B0200000001')).toBe(true);
    });

    it('should validate e-CF format (E31...)', () => {
        expect(validateNcf('E310000000001')).toBe(true);
        expect(validateNcf('E320000000001')).toBe(true);
    });

    it('should reject invalid NCF formats', () => {
        expect(validateNcf('')).toBe(false);
        expect(validateNcf('ABC')).toBe(false);
        expect(validateNcf('12345')).toBe(false);
        expect(validateNcf('B01')).toBe(false); // Too short
    });

    it('should reject NCF with wrong prefix', () => {
        expect(validateNcf('A0100000001')).toBe(false);
        expect(validateNcf('C0100000001')).toBe(false);
    });
});

describe('getNcfType', () => {
    it('should identify Crédito Fiscal (B01)', () => {
        expect(getNcfType('B0100000001')).toBe('Crédito Fiscal');
    });

    it('should identify Consumo Final (B02)', () => {
        expect(getNcfType('B0200000001')).toBe('Consumo Final');
    });

    it('should identify e-CF types', () => {
        expect(getNcfType('E310000000001')).toBe('e-CF Crédito Fiscal');
        expect(getNcfType('E320000000001')).toBe('e-CF Consumo Final');
    });

    it('should return Unknown for invalid NCF', () => {
        expect(getNcfType('')).toBe('Unknown');
        expect(getNcfType('X9900000001')).toBe('Unknown');
    });

    it('should identify all standard NCF types', () => {
        expect(getNcfType('B0300000001')).toBe('Notas de Débito');
        expect(getNcfType('B0400000001')).toBe('Notas de Crédito');
        expect(getNcfType('B1100000001')).toBe('Proveedores Informales');
        expect(getNcfType('B1300000001')).toBe('Gastos Menores');
        expect(getNcfType('B1400000001')).toBe('Regímenes Especiales');
        expect(getNcfType('B1500000001')).toBe('Gubernamental');
    });
});

describe('getPriceWithoutTax', () => {
    it('should extract base price from tax-inclusive price', () => {
        expect(getPriceWithoutTax(118, 0.18, true)).toBe(100);
        expect(getPriceWithoutTax(116, 0.16, true)).toBe(100);
    });

    it('should return same price if already tax-exclusive', () => {
        expect(getPriceWithoutTax(100, 0.18, false)).toBe(100);
    });

    it('should return same price if tax rate is zero', () => {
        expect(getPriceWithoutTax(100, 0, true)).toBe(100);
        expect(getPriceWithoutTax(100, 0, false)).toBe(100);
    });
});

describe('getPriceWithTax', () => {
    it('should add tax to base price', () => {
        expect(getPriceWithTax(100, 0.18, false)).toBe(118);
        expect(getPriceWithTax(100, 0.16, false)).toBe(116);
    });

    it('should return same price if already tax-inclusive', () => {
        expect(getPriceWithTax(118, 0.18, true)).toBe(118);
    });

    it('should return same price if tax rate is zero', () => {
        expect(getPriceWithTax(100, 0, false)).toBe(100);
    });
});

describe('getItbisAmount', () => {
    it('should calculate ITBIS from tax-inclusive price', () => {
        expect(getItbisAmount(118, true, 0.18)).toBe(18);
    });

    it('should calculate ITBIS from tax-exclusive price', () => {
        expect(getItbisAmount(100, false, 0.18)).toBe(18);
    });

    it('should return 0 for exempt items', () => {
        expect(getItbisAmount(100, true, 0)).toBe(0);
        expect(getItbisAmount(100, false, 0)).toBe(0);
    });
});

describe('Product Tax Utilities', () => {
    const createProduct = (overrides = {}): Product => ({
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

    describe('getProductCostExTax', () => {
        it('should extract cost without tax when cost includes tax', () => {
            const product = createProduct({ lastPrice: 118, costIncludesTax: true });
            expect(getProductCostExTax(product)).toBe(100);
        });

        it('should return same cost when cost excludes tax', () => {
            const product = createProduct({ lastPrice: 100, costIncludesTax: false });
            expect(getProductCostExTax(product)).toBe(100);
        });
    });

    describe('getProductPriceExTax', () => {
        it('should extract price without tax when price includes tax', () => {
            const product = createProduct({ sellingPrice: 118, priceIncludesTax: true });
            expect(getProductPriceExTax(product)).toBe(100);
        });

        it('should return same price when price excludes tax', () => {
            const product = createProduct({ sellingPrice: 100, priceIncludesTax: false });
            expect(getProductPriceExTax(product)).toBe(100);
        });
    });

    describe('calculateMarginExTax', () => {
        it('should calculate margin using tax-exclusive values', () => {
            const product = createProduct({
                lastPrice: 118, // 100 ex-tax
                sellingPrice: 177, // 150 ex-tax
                costIncludesTax: true,
                priceIncludesTax: true
            });
            const margin = calculateMarginExTax(product);
            // Margin = (150 - 100) / 150 = 0.3333
            expect(margin).toBeCloseTo(0.3333, 2);
        });

        it('should return 0 when price is 0', () => {
            const product = createProduct({ sellingPrice: 0 });
            expect(calculateMarginExTax(product)).toBe(0);
        });
    });

    describe('calculatePriceFromMargin', () => {
        it('should calculate selling price from target margin', () => {
            const product = createProduct({
                lastPrice: 118, // 100 ex-tax
                costIncludesTax: true,
                priceIncludesTax: true
            });
            // Target 30% margin: Price ex-tax = 100 / (1 - 0.30) = 142.86
            // With 18% tax: 142.86 * 1.18 = 168.57
            const price = calculatePriceFromMargin(product, 0.30);
            expect(price).toBeCloseTo(168.57, 0);
        });

        it('should return ex-tax price when priceIncludesTax is false', () => {
            const product = createProduct({
                lastPrice: 100,
                costIncludesTax: false,
                priceIncludesTax: false
            });
            // Target 30% margin: Price = 100 / (1 - 0.30) = 142.86
            const price = calculatePriceFromMargin(product, 0.30);
            expect(price).toBeCloseTo(142.86, 0);
        });
    });

    describe('getCartItemBreakdown', () => {
        it('should calculate breakdown for tax-inclusive price', () => {
            const product = createProduct({
                sellingPrice: 118,
                priceIncludesTax: true,
                taxRate: 0.18
            });
            const breakdown = getCartItemBreakdown(product, 2);
            
            expect(breakdown.unitPrice).toBe(118);
            expect(breakdown.value).toBe(200); // 2 * 100 base
            expect(breakdown.itbis).toBe(36); // 2 * 18
            expect(breakdown.amount).toBe(236); // 2 * 118
        });

        it('should calculate breakdown for tax-exclusive price', () => {
            const product = createProduct({
                sellingPrice: 100,
                priceIncludesTax: false,
                taxRate: 0.18
            });
            const breakdown = getCartItemBreakdown(product, 2);
            
            expect(breakdown.unitPrice).toBe(100);
            expect(breakdown.value).toBe(200);
            expect(breakdown.itbis).toBe(36);
            expect(breakdown.amount).toBe(236);
        });

        it('should handle exempt products', () => {
            const product = createProduct({
                sellingPrice: 100,
                isExempt: true
            });
            const breakdown = getCartItemBreakdown(product, 1);
            
            expect(breakdown.taxRate).toBe(0);
            expect(breakdown.itbis).toBe(0);
            expect(breakdown.amount).toBe(100);
        });

        it('should use custom price when provided', () => {
            const product = createProduct({ sellingPrice: 100 });
            const breakdown = getCartItemBreakdown(product, 1, 200);
            
            expect(breakdown.unitPrice).toBe(200);
        });
    });
});

describe('recalculateInvoice', () => {
    const createInvoice = (items: Partial<InvoiceItem>[]): Invoice => ({
        id: 1,
        supplierId: 1,
        ncf: 'B0100000001',
        date: new Date(),
        status: 'pending',
        items: items.map((item, i) => ({
            id: i + 1,
            invoiceId: 1,
            description: `Item ${i + 1}`,
            quantity: item.quantity ?? 1,
            unitPrice: item.unitPrice ?? 100,
            value: 0,
            itbis: 0,
            amount: 0,
            taxRate: item.taxRate ?? 0.18,
            priceIncludesTax: item.priceIncludesTax ?? false,
            ...item
        } as InvoiceItem)),
        subtotal: 0,
        itbisTotal: 0,
        total: 0,
        discount: 0
    } as Invoice);

    it('should calculate totals for tax-exclusive items', () => {
        const invoice = createInvoice([
            { quantity: 2, unitPrice: 100, taxRate: 0.18, priceIncludesTax: false }
        ]);
        
        const result = recalculateInvoice(invoice);
        
        expect(result.subtotal).toBe(200);
        expect(result.itbisTotal).toBe(36);
        expect(result.total).toBe(236);
    });

    it('should calculate totals for tax-inclusive items', () => {
        const invoice = createInvoice([
            { quantity: 1, unitPrice: 118, taxRate: 0.18, priceIncludesTax: true }
        ]);
        
        const result = recalculateInvoice(invoice);
        
        expect(result.subtotal).toBe(100);
        expect(result.itbisTotal).toBe(18);
        expect(result.total).toBe(118);
    });

    it('should handle multiple items', () => {
        const invoice = createInvoice([
            { quantity: 1, unitPrice: 100, taxRate: 0.18, priceIncludesTax: false },
            { quantity: 2, unitPrice: 50, taxRate: 0.18, priceIncludesTax: false }
        ]);
        
        const result = recalculateInvoice(invoice);
        
        expect(result.subtotal).toBe(200); // 100 + 100
        expect(result.itbisTotal).toBe(36); // 18 + 18
        expect(result.total).toBe(236);
    });

    it('should apply global discount', () => {
        const invoice = createInvoice([
            { quantity: 1, unitPrice: 100, taxRate: 0.18, priceIncludesTax: false }
        ]);
        invoice.discount = 10;
        
        const result = recalculateInvoice(invoice);
        
        expect(result.total).toBe(108); // 118 - 10
    });

    it('should handle exempt items', () => {
        const invoice = createInvoice([
            { quantity: 1, unitPrice: 100, taxRate: 0, priceIncludesTax: false }
        ]);
        
        const result = recalculateInvoice(invoice);
        
        expect(result.subtotal).toBe(100);
        expect(result.itbisTotal).toBe(0);
        expect(result.total).toBe(100);
    });
});

describe('recalculateFromTotal', () => {
    it('should derive unit price from total (tax-inclusive)', () => {
        const item: InvoiceItem = {
            id: 1,
            invoiceId: 1,
            description: 'Test',
            quantity: 2,
            unitPrice: 0,
            value: 0,
            itbis: 0,
            amount: 236, // 2 * 118
            taxRate: 0.18,
            priceIncludesTax: true
        };
        
        const result = recalculateFromTotal(item);
        
        expect(result.unitPrice).toBe(118);
        expect(result.value).toBe(200);
        expect(result.itbis).toBe(36);
    });

    it('should derive unit price from total (tax-exclusive)', () => {
        const item: InvoiceItem = {
            id: 1,
            invoiceId: 1,
            description: 'Test',
            quantity: 2,
            unitPrice: 0,
            value: 0,
            itbis: 0,
            amount: 236,
            taxRate: 0.18,
            priceIncludesTax: false
        };
        
        const result = recalculateFromTotal(item);
        
        expect(result.unitPrice).toBe(100);
        expect(result.value).toBe(200);
        expect(result.itbis).toBe(36);
    });
});

