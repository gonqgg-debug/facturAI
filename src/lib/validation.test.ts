/**
 * Validation Schema Tests
 * 
 * Tests for all Zod validation schemas
 */

import { describe, it, expect } from 'vitest';
import {
    // Schemas
    invoiceSchema,
    createInvoiceSchema,
    invoiceItemSchema,
    productSchema,
    createProductSchema,
    supplierSchema,
    customerSchema,
    saleSchema,
    userSchema,
    loginSchema,
    paymentSchema,
    returnSchema,
    cashRegisterShiftSchema,
    openShiftSchema,
    closeShiftSchema,
    bankAccountSchema,
    grokRequestSchema,
    weatherRequestSchema,
    fileUploadSchema,
    // Common schemas
    currencySchema,
    rncSchema,
    phoneSchema,
    emailSchema,
    dateStringSchema,
    taxRateSchema,
    paymentMethodSchema,
    pinSchema,
    usernameSchema,
    ncfSchema,
    barcodeSchema,
    // Utilities
    validate,
    getErrorMessages,
    getErrorString,
    safeParse,
    sanitizeString,
    sanitizeStrings
} from './validation';

// ============ COMMON SCHEMA TESTS ============

describe('Common Schemas', () => {
    describe('currencySchema', () => {
        it('should accept DOP', () => {
            expect(currencySchema.safeParse('DOP').success).toBe(true);
        });

        it('should accept USD', () => {
            expect(currencySchema.safeParse('USD').success).toBe(true);
        });

        it('should reject invalid currency', () => {
            expect(currencySchema.safeParse('EUR').success).toBe(false);
            expect(currencySchema.safeParse('dop').success).toBe(false);
        });
    });

    describe('rncSchema', () => {
        it('should accept valid RNC formats', () => {
            expect(rncSchema.safeParse('123456789').success).toBe(true);
            expect(rncSchema.safeParse('1-2345678-9').success).toBe(true); // 11 chars with hyphens
            expect(rncSchema.safeParse('12345678901').success).toBe(true);
        });

        it('should accept undefined (optional)', () => {
            expect(rncSchema.safeParse(undefined).success).toBe(true);
        });

        it('should reject too short RNC', () => {
            expect(rncSchema.safeParse('12345678').success).toBe(false);
        });

        it('should reject too long RNC', () => {
            expect(rncSchema.safeParse('123456789012').success).toBe(false);
        });

        it('should reject RNC with letters', () => {
            expect(rncSchema.safeParse('123ABC789').success).toBe(false);
        });
    });

    describe('phoneSchema', () => {
        it('should accept valid phone formats', () => {
            expect(phoneSchema.safeParse('8091234567').success).toBe(true);
            expect(phoneSchema.safeParse('809-123-4567').success).toBe(true);
            expect(phoneSchema.safeParse('+1 (809) 123-4567').success).toBe(true);
        });

        it('should reject phone with letters', () => {
            expect(phoneSchema.safeParse('809-ABC-4567').success).toBe(false);
        });

        it('should reject too short phone', () => {
            expect(phoneSchema.safeParse('123456').success).toBe(false);
        });
    });

    describe('emailSchema', () => {
        it('should accept valid emails', () => {
            expect(emailSchema.safeParse('test@example.com').success).toBe(true);
            expect(emailSchema.safeParse('user.name+tag@example.co.uk').success).toBe(true);
        });

        it('should reject invalid emails', () => {
            expect(emailSchema.safeParse('invalid').success).toBe(false);
            expect(emailSchema.safeParse('test@').success).toBe(false);
            expect(emailSchema.safeParse('@example.com').success).toBe(false);
        });
    });

    describe('dateStringSchema', () => {
        it('should accept valid date strings', () => {
            expect(dateStringSchema.safeParse('2024-01-15').success).toBe(true);
            expect(dateStringSchema.safeParse('2024-01-15T10:30:00').success).toBe(true);
            expect(dateStringSchema.safeParse('January 15, 2024').success).toBe(true);
        });

        it('should reject invalid date strings', () => {
            expect(dateStringSchema.safeParse('invalid').success).toBe(false);
            expect(dateStringSchema.safeParse('2024-13-45').success).toBe(false);
        });
    });

    describe('taxRateSchema', () => {
        it('should accept standard DR tax rates', () => {
            expect(taxRateSchema.safeParse(0).success).toBe(true);
            expect(taxRateSchema.safeParse(0.16).success).toBe(true);
            expect(taxRateSchema.safeParse(0.18).success).toBe(true);
        });

        it('should accept other valid rates', () => {
            expect(taxRateSchema.safeParse(0.10).success).toBe(true);
            expect(taxRateSchema.safeParse(0.25).success).toBe(true);
        });

        it('should reject negative rates', () => {
            expect(taxRateSchema.safeParse(-0.18).success).toBe(false);
        });

        it('should reject rates > 100%', () => {
            expect(taxRateSchema.safeParse(1.5).success).toBe(false);
        });
    });

    describe('paymentMethodSchema', () => {
        it('should accept all valid payment methods', () => {
            const methods = ['cash', 'bank_transfer', 'check', 'credit_card', 'debit_card', 'mobile_payment', 'other'];
            methods.forEach(method => {
                expect(paymentMethodSchema.safeParse(method).success).toBe(true);
            });
        });

        it('should reject invalid payment methods', () => {
            expect(paymentMethodSchema.safeParse('bitcoin').success).toBe(false);
            expect(paymentMethodSchema.safeParse('CASH').success).toBe(false);
        });
    });

    describe('pinSchema', () => {
        it('should accept 4-6 digit PINs', () => {
            expect(pinSchema.safeParse('1234').success).toBe(true);
            expect(pinSchema.safeParse('12345').success).toBe(true);
            expect(pinSchema.safeParse('123456').success).toBe(true);
        });

        it('should reject PINs with letters', () => {
            expect(pinSchema.safeParse('123a').success).toBe(false);
        });

        it('should reject too short PINs', () => {
            expect(pinSchema.safeParse('123').success).toBe(false);
        });

        it('should reject too long PINs', () => {
            expect(pinSchema.safeParse('1234567').success).toBe(false);
        });
    });

    describe('usernameSchema', () => {
        it('should accept valid usernames', () => {
            expect(usernameSchema.safeParse('john').success).toBe(true);
            expect(usernameSchema.safeParse('john_doe').success).toBe(true);
            expect(usernameSchema.safeParse('JohnDoe123').success).toBe(true);
        });

        it('should reject too short usernames', () => {
            expect(usernameSchema.safeParse('ab').success).toBe(false);
        });

        it('should reject usernames with special chars', () => {
            expect(usernameSchema.safeParse('john@doe').success).toBe(false);
            expect(usernameSchema.safeParse('john doe').success).toBe(false);
        });
    });

    describe('ncfSchema', () => {
        it('should accept valid NCF formats', () => {
            expect(ncfSchema.safeParse('B0100000001').success).toBe(true);
            expect(ncfSchema.safeParse('E3100000001').success).toBe(true);
        });

        it('should accept empty string', () => {
            expect(ncfSchema.safeParse('').success).toBe(true);
        });

        it('should accept undefined', () => {
            expect(ncfSchema.safeParse(undefined).success).toBe(true);
        });
    });

    describe('barcodeSchema', () => {
        it('should accept valid barcodes', () => {
            expect(barcodeSchema.safeParse('7501234567890').success).toBe(true);
            expect(barcodeSchema.safeParse('ABC-123').success).toBe(true);
        });

        it('should reject too short barcodes', () => {
            expect(barcodeSchema.safeParse('12').success).toBe(false);
        });
    });
});

// ============ INVOICE TESTS ============

describe('Invoice Schemas', () => {
    const validInvoiceItem = {
        description: 'Test Product',
        quantity: 10,
        unitPrice: 100,
        value: 1000,
        itbis: 180,
        amount: 1180
    };

    const validInvoice = {
        providerName: 'Test Supplier',
        providerRnc: '123456789',
        issueDate: '2024-01-15',
        ncf: 'B0100000001',
        currency: 'DOP' as const,
        items: [validInvoiceItem],
        subtotal: 1000,
        discount: 0,
        itbisTotal: 180,
        total: 1180,
        rawText: 'Test raw text',
        status: 'draft' as const,
        createdAt: new Date()
    };

    describe('invoiceItemSchema', () => {
        it('should accept valid invoice item', () => {
            const result = invoiceItemSchema.safeParse(validInvoiceItem);
            expect(result.success).toBe(true);
        });

        it('should reject empty description', () => {
            const item = { ...validInvoiceItem, description: '' };
            expect(invoiceItemSchema.safeParse(item).success).toBe(false);
        });

        it('should reject negative quantity', () => {
            const item = { ...validInvoiceItem, quantity: -1 };
            expect(invoiceItemSchema.safeParse(item).success).toBe(false);
        });

        it('should accept optional taxRate', () => {
            const item = { ...validInvoiceItem, taxRate: 0.18 };
            expect(invoiceItemSchema.safeParse(item).success).toBe(true);
        });
    });

    describe('invoiceSchema', () => {
        it('should accept valid invoice', () => {
            const result = invoiceSchema.safeParse(validInvoice);
            expect(result.success).toBe(true);
        });

        it('should reject missing provider name', () => {
            const invoice = { ...validInvoice, providerName: '' };
            expect(invoiceSchema.safeParse(invoice).success).toBe(false);
        });

        it('should accept all status values', () => {
            const statuses = ['draft', 'verified', 'exported', 'needs_extraction'] as const;
            statuses.forEach(status => {
                const invoice = { ...validInvoice, status };
                expect(invoiceSchema.safeParse(invoice).success).toBe(true);
            });
        });

        it('should accept all categories', () => {
            const categories = ['Inventory', 'Utilities', 'Maintenance', 'Payroll', 'Other'] as const;
            categories.forEach(category => {
                const invoice = { ...validInvoice, category };
                expect(invoiceSchema.safeParse(invoice).success).toBe(true);
            });
        });

        it('should accept payment fields', () => {
            const invoice = {
                ...validInvoice,
                paymentStatus: 'partial' as const,
                paidAmount: 500,
                creditDays: 30
            };
            expect(invoiceSchema.safeParse(invoice).success).toBe(true);
        });
    });

    describe('createInvoiceSchema', () => {
        it('should accept invoice without id', () => {
            const result = createInvoiceSchema.safeParse(validInvoice);
            expect(result.success).toBe(true);
        });
    });
});

// ============ PRODUCT TESTS ============

describe('Product Schemas', () => {
    const validProduct = {
        name: 'Test Product',
        lastPrice: 100,
        lastDate: '2024-01-15'
    };

    describe('productSchema', () => {
        it('should accept valid product', () => {
            const result = productSchema.safeParse(validProduct);
            expect(result.success).toBe(true);
        });

        it('should reject empty name', () => {
            const product = { ...validProduct, name: '' };
            expect(productSchema.safeParse(product).success).toBe(false);
        });

        it('should accept optional fields', () => {
            const product = {
                ...validProduct,
                barcode: '7501234567890',
                category: 'Beverages',
                sellingPrice: 150,
                currentStock: 50,
                reorderPoint: 10
            };
            expect(productSchema.safeParse(product).success).toBe(true);
        });

        it('should accept AI fields', () => {
            const product = {
                ...validProduct,
                aiSuggestedPrice: 120,
                aiAnalystRating: 'BUY' as const,
                aiReasoning: 'Strong demand'
            };
            expect(productSchema.safeParse(product).success).toBe(true);
        });

        it('should reject negative prices', () => {
            const product = { ...validProduct, lastPrice: -100 };
            expect(productSchema.safeParse(product).success).toBe(false);
        });
    });
});

// ============ SUPPLIER TESTS ============

describe('Supplier Schemas', () => {
    const validSupplier = {
        name: 'Test Supplier',
        rnc: '123456789'
    };

    describe('supplierSchema', () => {
        it('should accept valid supplier', () => {
            const result = supplierSchema.safeParse(validSupplier);
            expect(result.success).toBe(true);
        });

        it('should accept full supplier with all fields', () => {
            const supplier = {
                ...validSupplier,
                supplierType: 'company' as const,
                phone: '809-123-4567',
                email: 'supplier@example.com',
                address: '123 Main St',
                city: 'Santo Domingo',
                category: 'Distributor' as const
            };
            expect(supplierSchema.safeParse(supplier).success).toBe(true);
        });

        it('should reject empty name', () => {
            const supplier = { ...validSupplier, name: '' };
            expect(supplierSchema.safeParse(supplier).success).toBe(false);
        });
    });
});

// ============ CUSTOMER TESTS ============

describe('Customer Schemas', () => {
    const validCustomer = {
        name: 'Test Customer',
        type: 'retail' as const,
        isActive: true,
        createdAt: new Date()
    };

    describe('customerSchema', () => {
        it('should accept valid customer', () => {
            const result = customerSchema.safeParse(validCustomer);
            expect(result.success).toBe(true);
        });

        it('should accept all customer types', () => {
            const types = ['retail', 'wholesale', 'corporate'] as const;
            types.forEach(type => {
                const customer = { ...validCustomer, type };
                expect(customerSchema.safeParse(customer).success).toBe(true);
            });
        });

        it('should accept business fields', () => {
            const customer = {
                ...validCustomer,
                rnc: '123456789',
                creditLimit: 50000,
                currentBalance: -5000 // Can be negative (owes money)
            };
            expect(customerSchema.safeParse(customer).success).toBe(true);
        });
    });
});

// ============ SALE TESTS ============

describe('Sale Schemas', () => {
    const validSale = {
        date: '2024-01-15',
        items: [{
            description: 'Test Product',
            quantity: 2,
            unitPrice: 100,
            value: 200,
            itbis: 36,
            amount: 236
        }],
        subtotal: 200,
        discount: 0,
        itbisTotal: 36,
        total: 236,
        paymentMethod: 'cash' as const,
        paymentStatus: 'paid' as const,
        paidAmount: 236,
        createdAt: new Date()
    };

    describe('saleSchema', () => {
        it('should accept valid sale', () => {
            const result = saleSchema.safeParse(validSale);
            expect(result.success).toBe(true);
        });

        it('should reject sale without items', () => {
            const sale = { ...validSale, items: [] };
            expect(saleSchema.safeParse(sale).success).toBe(false);
        });

        it('should accept optional customer', () => {
            const sale = {
                ...validSale,
                customerId: 1,
                customerName: 'John Doe'
            };
            expect(saleSchema.safeParse(sale).success).toBe(true);
        });
    });
});

// ============ USER TESTS ============

describe('User Schemas', () => {
    const validUser = {
        username: 'johndoe',
        displayName: 'John Doe',
        pin: '1234',
        roleId: 1,
        isActive: true,
        createdAt: new Date()
    };

    describe('userSchema', () => {
        it('should accept valid user', () => {
            const result = userSchema.safeParse(validUser);
            expect(result.success).toBe(true);
        });

        it('should reject invalid PIN', () => {
            const user = { ...validUser, pin: '123' };
            expect(userSchema.safeParse(user).success).toBe(false);
        });

        it('should reject invalid username', () => {
            const user = { ...validUser, username: 'a' };
            expect(userSchema.safeParse(user).success).toBe(false);
        });
    });

    describe('loginSchema', () => {
        it('should accept valid login', () => {
            const result = loginSchema.safeParse({ username: 'john', pin: '1234' });
            expect(result.success).toBe(true);
        });

        it('should reject empty username', () => {
            expect(loginSchema.safeParse({ username: '', pin: '1234' }).success).toBe(false);
        });
    });
});

// ============ PAYMENT TESTS ============

describe('Payment Schemas', () => {
    const validPayment = {
        amount: 1000,
        currency: 'DOP' as const,
        paymentDate: '2024-01-15',
        paymentMethod: 'bank_transfer' as const,
        createdAt: new Date()
    };

    describe('paymentSchema', () => {
        it('should accept valid payment', () => {
            const result = paymentSchema.safeParse(validPayment);
            expect(result.success).toBe(true);
        });

        it('should accept payment with references', () => {
            const payment = {
                ...validPayment,
                invoiceId: 1,
                supplierId: 2,
                bankAccountId: 1,
                referenceNumber: 'TRF-123456'
            };
            expect(paymentSchema.safeParse(payment).success).toBe(true);
        });

        it('should accept refund payment', () => {
            const payment = {
                ...validPayment,
                isRefund: true,
                returnId: 1
            };
            expect(paymentSchema.safeParse(payment).success).toBe(true);
        });
    });
});

// ============ RETURN TESTS ============

describe('Return Schemas', () => {
    const validReturn = {
        date: '2024-01-15',
        originalSaleId: 1,
        items: [{
            description: 'Returned Product',
            quantity: 1,
            unitPrice: 100,
            value: 100,
            itbis: 18,
            amount: 118
        }],
        subtotal: 100,
        itbisTotal: 18,
        total: 118,
        refundMethod: 'cash' as const,
        refundStatus: 'completed' as const,
        reason: 'defective' as const,
        createdAt: new Date()
    };

    describe('returnSchema', () => {
        it('should accept valid return', () => {
            const result = returnSchema.safeParse(validReturn);
            expect(result.success).toBe(true);
        });

        it('should reject return without original sale', () => {
            const ret = { ...validReturn, originalSaleId: 0 };
            expect(returnSchema.safeParse(ret).success).toBe(false);
        });

        it('should accept all return reasons', () => {
            const reasons = ['defective', 'wrong_item', 'customer_changed_mind', 'damaged', 'expired', 'other'] as const;
            reasons.forEach(reason => {
                const ret = { ...validReturn, reason };
                expect(returnSchema.safeParse(ret).success).toBe(true);
            });
        });
    });
});

// ============ CASH REGISTER SHIFT TESTS ============

describe('Cash Register Shift Schemas', () => {
    describe('openShiftSchema', () => {
        it('should accept valid open shift', () => {
            const result = openShiftSchema.safeParse({ openingCash: 5000 });
            expect(result.success).toBe(true);
        });

        it('should reject negative opening cash', () => {
            expect(openShiftSchema.safeParse({ openingCash: -100 }).success).toBe(false);
        });
    });

    describe('closeShiftSchema', () => {
        it('should accept valid close shift', () => {
            const result = closeShiftSchema.safeParse({ closingCash: 15000 });
            expect(result.success).toBe(true);
        });

        it('should accept closing notes', () => {
            const result = closeShiftSchema.safeParse({ 
                closingCash: 15000,
                closingNotes: 'All good'
            });
            expect(result.success).toBe(true);
        });
    });
});

// ============ BANK ACCOUNT TESTS ============

describe('Bank Account Schemas', () => {
    const validAccount = {
        bankName: 'Banco Popular',
        accountName: 'Business Account',
        accountNumber: '1234567890',
        accountType: 'checking' as const,
        currency: 'DOP' as const
    };

    describe('bankAccountSchema', () => {
        it('should accept valid bank account', () => {
            const result = bankAccountSchema.safeParse(validAccount);
            expect(result.success).toBe(true);
        });

        it('should accept all account types', () => {
            const types = ['checking', 'savings', 'credit'] as const;
            types.forEach(accountType => {
                const account = { ...validAccount, accountType };
                expect(bankAccountSchema.safeParse(account).success).toBe(true);
            });
        });
    });
});

// ============ API REQUEST TESTS ============

describe('API Request Schemas', () => {
    describe('grokRequestSchema', () => {
        it('should accept valid grok request', () => {
            const result = grokRequestSchema.safeParse({
                imageBase64: 'base64encodedstring'
            });
            expect(result.success).toBe(true);
        });

        it('should accept request with context and hints', () => {
            const result = grokRequestSchema.safeParse({
                imageBase64: 'base64encodedstring',
                context: 'Additional context',
                hints: {
                    supplierName: 'Test Supplier',
                    total: 1000
                }
            });
            expect(result.success).toBe(true);
        });

        it('should reject empty image', () => {
            expect(grokRequestSchema.safeParse({ imageBase64: '' }).success).toBe(false);
        });
    });

    describe('weatherRequestSchema', () => {
        it('should accept valid weather request', () => {
            const result = weatherRequestSchema.safeParse({ city: 'Santo Domingo' });
            expect(result.success).toBe(true);
        });

        it('should accept request with country code', () => {
            const result = weatherRequestSchema.safeParse({ city: 'Santo Domingo', country: 'DO' });
            expect(result.success).toBe(true);
        });

        it('should reject invalid country code length', () => {
            expect(weatherRequestSchema.safeParse({ city: 'Test', country: 'DOM' }).success).toBe(false);
        });
    });
});

// ============ FILE UPLOAD TESTS ============

describe('File Upload Schema', () => {
    describe('fileUploadSchema', () => {
        it('should accept valid image files', () => {
            const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            imageTypes.forEach(type => {
                const result = fileUploadSchema.safeParse({
                    name: 'test.jpg',
                    size: 1024 * 1024,
                    type
                });
                expect(result.success).toBe(true);
            });
        });

        it('should accept PDF files', () => {
            const result = fileUploadSchema.safeParse({
                name: 'document.pdf',
                size: 5 * 1024 * 1024,
                type: 'application/pdf'
            });
            expect(result.success).toBe(true);
        });

        it('should accept Excel files', () => {
            const result = fileUploadSchema.safeParse({
                name: 'data.xlsx',
                size: 1024 * 1024,
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
            expect(result.success).toBe(true);
        });

        it('should reject files over 20MB', () => {
            const result = fileUploadSchema.safeParse({
                name: 'huge.jpg',
                size: 25 * 1024 * 1024,
                type: 'image/jpeg'
            });
            expect(result.success).toBe(false);
        });

        it('should reject invalid file types', () => {
            const result = fileUploadSchema.safeParse({
                name: 'script.js',
                size: 1024,
                type: 'application/javascript'
            });
            expect(result.success).toBe(false);
        });
    });
});

// ============ UTILITY FUNCTION TESTS ============

describe('Utility Functions', () => {
    describe('validate', () => {
        it('should return success with data on valid input', () => {
            const result = validate(pinSchema, '1234');
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toBe('1234');
            }
        });

        it('should return errors on invalid input', () => {
            const result = validate(pinSchema, '12');
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.errors).toBeDefined();
            }
        });
    });

    describe('getErrorMessages', () => {
        it('should return array of error messages', () => {
            const result = pinSchema.safeParse('1'); // Invalid: too short
            expect(result.success).toBe(false);
            if (!result.success) {
                const messages = getErrorMessages(result.error);
                expect(messages).toBeInstanceOf(Array);
                expect(messages.length).toBeGreaterThan(0);
                expect(messages[0]).toContain('PIN must be 4-6 digits');
            }
        });
    });

    describe('getErrorString', () => {
        it('should return semicolon-separated error string', () => {
            const result = usernameSchema.safeParse('a'); // Invalid: too short
            expect(result.success).toBe(false);
            if (!result.success) {
                const errorString = getErrorString(result.error);
                expect(typeof errorString).toBe('string');
                expect(errorString.length).toBeGreaterThan(0);
                expect(errorString).toContain('3 characters');
            }
        });
    });

    describe('safeParse', () => {
        it('should return data on valid input', () => {
            const result = safeParse(pinSchema, '1234');
            expect(result).toBe('1234');
        });

        it('should return undefined on invalid input', () => {
            const result = safeParse(pinSchema, '12');
            expect(result).toBeUndefined();
        });
    });

    describe('sanitizeString', () => {
        it('should trim whitespace', () => {
            expect(sanitizeString('  hello world  ')).toBe('hello world');
        });

        it('should collapse multiple spaces', () => {
            expect(sanitizeString('hello    world')).toBe('hello world');
        });

        it('should remove HTML tags', () => {
            expect(sanitizeString('<script>alert(1)</script>')).toBe('scriptalert(1)/script');
        });
    });

    describe('sanitizeStrings', () => {
        it('should sanitize all string fields', () => {
            const obj = {
                name: '  Test  Name  ',
                count: 5,
                active: true
            };
            const result = sanitizeStrings(obj);
            expect(result.name).toBe('Test Name');
            expect(result.count).toBe(5);
            expect(result.active).toBe(true);
        });
    });
});

// ============ EDGE CASE TESTS ============

describe('Edge Cases', () => {
    it('should handle empty objects', () => {
        expect(invoiceSchema.safeParse({}).success).toBe(false);
        expect(productSchema.safeParse({}).success).toBe(false);
    });

    it('should handle null values', () => {
        expect(invoiceSchema.safeParse(null).success).toBe(false);
        expect(productSchema.safeParse(null).success).toBe(false);
    });

    it('should handle very long strings within limits', () => {
        const product = {
            name: 'A'.repeat(255),
            lastPrice: 100,
            lastDate: '2024-01-15'
        };
        expect(productSchema.safeParse(product).success).toBe(true);
    });

    it('should reject strings exceeding limits', () => {
        const product = {
            name: 'A'.repeat(300),
            lastPrice: 100,
            lastDate: '2024-01-15'
        };
        expect(productSchema.safeParse(product).success).toBe(false);
    });

    it('should handle date string transformations', () => {
        const result = invoiceSchema.safeParse({
            providerName: 'Test',
            providerRnc: '123456789',
            issueDate: '2024-01-15',
            currency: 'DOP',
            items: [],
            subtotal: 0,
            discount: 0,
            itbisTotal: 0,
            total: 0,
            rawText: '',
            status: 'draft',
            createdAt: '2024-01-15T00:00:00Z'
        });
        expect(result.success).toBe(true);
    });

    it('should handle boundary values for numbers', () => {
        // Test quantity at max
        const item = {
            description: 'Test',
            quantity: 999999,
            unitPrice: 0,
            value: 0,
            itbis: 0,
            amount: 0
        };
        expect(invoiceItemSchema.safeParse(item).success).toBe(true);

        // Test quantity over max
        const overItem = { ...item, quantity: 1000000 };
        expect(invoiceItemSchema.safeParse(overItem).success).toBe(false);
    });
});

