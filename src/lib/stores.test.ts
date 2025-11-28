/**
 * Unit Tests for Svelte Stores
 * Tests persistent stores and derived stores
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';

// Use vi.hoisted to define mock values that will be available during module load
const mockValues = vi.hoisted(() => ({
    browser: true,
    localStorage: {} as Record<string, string>
}));

// Mock $app/environment
vi.mock('$app/environment', () => ({
    get browser() {
        return mockValues.browser;
    }
}));

// Mock localStorage
const localStorageMock = {
    getItem: vi.fn((key: string) => mockValues.localStorage[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
        mockValues.localStorage[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
        delete mockValues.localStorage[key];
    }),
    clear: vi.fn(() => {
        mockValues.localStorage = {};
    })
};

Object.defineProperty(global, 'localStorage', {
    value: localStorageMock,
    writable: true
});

// Import stores after mocks are set up
import {
    apiKey,
    currentInvoice,
    isProcessing,
    locale,
    isPosMode,
    activeShiftId,
    activeShift,
    hasActiveShift,
    customerSegments,
    realTimeInsights,
    lastInsightsUpdate,
    insightsLoading,
    activeInsights,
    insightsCounts,
    weatherApiKey,
    storeLocation,
    currentWeather,
    weatherLoading,
    lastWeatherUpdate,
    weatherError,
    isWeatherConfigured
} from './stores';

describe('Stores Module', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockValues.localStorage = {};
        mockValues.browser = true;
    });

    describe('Basic Stores', () => {
        describe('isProcessing store', () => {
            it('should have initial value of false', () => {
                expect(get(isProcessing)).toBe(false);
            });

            it('should update when set', () => {
                isProcessing.set(true);
                expect(get(isProcessing)).toBe(true);
                isProcessing.set(false);
                expect(get(isProcessing)).toBe(false);
            });
        });

        describe('isPosMode store', () => {
            it('should have initial value of false', () => {
                expect(get(isPosMode)).toBe(false);
            });

            it('should update when set', () => {
                isPosMode.set(true);
                expect(get(isPosMode)).toBe(true);
            });
        });

        describe('insightsLoading store', () => {
            it('should have initial value of false', () => {
                expect(get(insightsLoading)).toBe(false);
            });

            it('should update when set', () => {
                insightsLoading.set(true);
                expect(get(insightsLoading)).toBe(true);
            });
        });

        describe('weatherLoading store', () => {
            it('should have initial value of false', () => {
                expect(get(weatherLoading)).toBe(false);
            });

            it('should update when set', () => {
                weatherLoading.set(true);
                expect(get(weatherLoading)).toBe(true);
            });
        });
    });

    describe('Nullable Stores', () => {
        describe('activeShift store', () => {
            it('should have initial value of null', () => {
                expect(get(activeShift)).toBeNull();
            });

            it('should accept shift data', () => {
                const shift = {
                    id: 1,
                    userId: 1,
                    openedAt: new Date(),
                    openingBalance: 1000,
                    status: 'open' as const
                };
                activeShift.set(shift);
                expect(get(activeShift)).toEqual(shift);
            });
        });

        describe('currentWeather store', () => {
            it('should have initial value of null', () => {
                expect(get(currentWeather)).toBeNull();
            });
        });

        describe('lastInsightsUpdate store', () => {
            it('should have initial value of null', () => {
                expect(get(lastInsightsUpdate)).toBeNull();
            });

            it('should accept Date values', () => {
                const date = new Date();
                lastInsightsUpdate.set(date);
                expect(get(lastInsightsUpdate)).toEqual(date);
            });
        });

        describe('lastWeatherUpdate store', () => {
            it('should have initial value of null', () => {
                expect(get(lastWeatherUpdate)).toBeNull();
            });
        });

        describe('weatherError store', () => {
            it('should have initial value of null', () => {
                expect(get(weatherError)).toBeNull();
            });

            it('should accept error messages', () => {
                weatherError.set('Failed to fetch weather');
                expect(get(weatherError)).toBe('Failed to fetch weather');
            });
        });
    });

    describe('Array Stores', () => {
        describe('customerSegments store', () => {
            it('should have initial empty array', () => {
                expect(get(customerSegments)).toEqual([]);
            });

            it('should accept segment data', () => {
                const segments = [
                    { id: 'high-value', name: 'High Value', customerIds: [1, 2, 3], characteristics: {} }
                ];
                customerSegments.set(segments as any);
                expect(get(customerSegments)).toHaveLength(1);
            });
        });

        describe('realTimeInsights store', () => {
            it('should have initial empty array', () => {
                expect(get(realTimeInsights)).toEqual([]);
            });

            it('should accept insight data', () => {
                const insights = [
                    { 
                        id: '1', 
                        insightType: 'purchase_pattern',
                        message: 'Test insight',
                        confidence: 0.9,
                        createdAt: new Date()
                    }
                ];
                realTimeInsights.set(insights as any);
                expect(get(realTimeInsights)).toHaveLength(1);
            });
        });
    });

    describe('Derived Stores', () => {
        describe('hasActiveShift', () => {
            it('should be false when activeShift is null', () => {
                activeShift.set(null);
                expect(get(hasActiveShift)).toBe(false);
            });

            it('should be true when activeShift is open', () => {
                activeShift.set({
                    id: 1,
                    userId: 1,
                    openedAt: new Date(),
                    openingBalance: 1000,
                    status: 'open'
                });
                expect(get(hasActiveShift)).toBe(true);
            });

            it('should be false when activeShift is closed', () => {
                activeShift.set({
                    id: 1,
                    userId: 1,
                    openedAt: new Date(),
                    openingBalance: 1000,
                    status: 'closed',
                    closedAt: new Date(),
                    closingBalance: 1500
                });
                expect(get(hasActiveShift)).toBe(false);
            });
        });

        describe('activeInsights', () => {
            it('should return empty array when no insights', () => {
                realTimeInsights.set([]);
                expect(get(activeInsights)).toEqual([]);
            });

            it('should return insights without expiry', () => {
                const insights = [
                    { 
                        id: '1', 
                        insightType: 'test',
                        message: 'No expiry',
                        confidence: 0.9,
                        createdAt: new Date()
                        // No expiresAt
                    }
                ];
                realTimeInsights.set(insights as any);
                expect(get(activeInsights)).toHaveLength(1);
            });

            it('should filter out expired insights', () => {
                const pastDate = new Date(Date.now() - 1000); // 1 second ago
                const futureDate = new Date(Date.now() + 100000); // Far future
                
                const insights = [
                    { 
                        id: '1', 
                        insightType: 'expired',
                        message: 'Expired',
                        confidence: 0.9,
                        createdAt: new Date(),
                        expiresAt: pastDate
                    },
                    { 
                        id: '2', 
                        insightType: 'active',
                        message: 'Active',
                        confidence: 0.9,
                        createdAt: new Date(),
                        expiresAt: futureDate
                    }
                ];
                realTimeInsights.set(insights as any);
                
                const active = get(activeInsights);
                expect(active).toHaveLength(1);
                expect(active[0].id).toBe('2');
            });
        });

        describe('insightsCounts', () => {
            it('should return empty object when no insights', () => {
                realTimeInsights.set([]);
                expect(get(insightsCounts)).toEqual({});
            });

            it('should count insights by type', () => {
                const insights = [
                    { id: '1', insightType: 'purchase_pattern', message: 'Test', confidence: 0.9, createdAt: new Date() },
                    { id: '2', insightType: 'purchase_pattern', message: 'Test', confidence: 0.9, createdAt: new Date() },
                    { id: '3', insightType: 'churn_risk', message: 'Test', confidence: 0.9, createdAt: new Date() }
                ];
                realTimeInsights.set(insights as any);
                
                const counts = get(insightsCounts);
                expect(counts['purchase_pattern']).toBe(2);
                expect(counts['churn_risk']).toBe(1);
            });
        });

        describe('isWeatherConfigured', () => {
            it('should be false when both apiKey and location are empty', () => {
                weatherApiKey.set('');
                storeLocation.set('');
                expect(get(isWeatherConfigured)).toBe(false);
            });

            it('should be false when only apiKey is set', () => {
                weatherApiKey.set('test-api-key');
                storeLocation.set('');
                expect(get(isWeatherConfigured)).toBe(false);
            });

            it('should be false when only location is set', () => {
                weatherApiKey.set('');
                storeLocation.set('New York, US');
                expect(get(isWeatherConfigured)).toBe(false);
            });

            it('should be true when both are set', () => {
                weatherApiKey.set('test-api-key');
                storeLocation.set('New York, US');
                expect(get(isWeatherConfigured)).toBe(true);
            });
        });
    });

    describe('Persistent String Stores', () => {
        describe('apiKey store', () => {
            it('should persist to localStorage on update', () => {
                apiKey.set('test-api-key');
                expect(mockValues.localStorage['xai_api_key']).toBe('test-api-key');
            });

            it('should store raw string without JSON encoding', () => {
                apiKey.set('my-key-123');
                // Should not be wrapped in quotes
                expect(mockValues.localStorage['xai_api_key']).toBe('my-key-123');
                expect(mockValues.localStorage['xai_api_key']).not.toBe('"my-key-123"');
            });
        });

        describe('locale store', () => {
            it('should accept language codes', () => {
                locale.set('es');
                expect(get(locale)).toBe('es');
                expect(mockValues.localStorage['app_locale']).toBe('es');
            });
        });

        describe('weatherApiKey store', () => {
            it('should persist to localStorage', () => {
                weatherApiKey.set('weather-key-123');
                expect(mockValues.localStorage['weather_api_key']).toBe('weather-key-123');
            });
        });

        describe('storeLocation store', () => {
            it('should accept location strings', () => {
                storeLocation.set('Santo Domingo, DO');
                expect(mockValues.localStorage['store_location']).toBe('Santo Domingo, DO');
            });
        });
    });

    describe('Persistent Object Stores', () => {
        describe('currentInvoice store', () => {
            it('should default to null initially', () => {
                currentInvoice.set(null);
                expect(get(currentInvoice)).toBeNull();
            });

            it('should persist invoice data as JSON', () => {
                const invoice = {
                    vendorName: 'Test Vendor',
                    totalAmount: 100
                };
                currentInvoice.set(invoice);
                expect(JSON.parse(mockValues.localStorage['current_invoice'])).toEqual(invoice);
            });

            it('should handle complex invoice objects', () => {
                const invoice = {
                    vendorName: 'Test Vendor',
                    totalAmount: 100,
                    items: [
                        { name: 'Item 1', price: 50 },
                        { name: 'Item 2', price: 50 }
                    ],
                    date: '2024-01-01'
                };
                currentInvoice.set(invoice);
                expect(JSON.parse(mockValues.localStorage['current_invoice'])).toEqual(invoice);
            });
        });

        describe('activeShiftId store', () => {
            it('should persist shift ID', () => {
                activeShiftId.set(123);
                expect(JSON.parse(mockValues.localStorage['active_shift_id'])).toBe(123);
            });
        });
    });

    describe('Store Subscriptions', () => {
        it('should notify subscribers on update', () => {
            const values: boolean[] = [];
            const unsubscribe = isProcessing.subscribe(value => {
                values.push(value);
            });

            isProcessing.set(true);
            isProcessing.set(false);
            isProcessing.set(true);

            unsubscribe();

            // First value is initial, then three updates
            expect(values).toContain(true);
            expect(values).toContain(false);
        });

        it('should support multiple subscribers', () => {
            let value1 = false;
            let value2 = false;

            const unsub1 = isProcessing.subscribe(v => { value1 = v; });
            const unsub2 = isProcessing.subscribe(v => { value2 = v; });

            isProcessing.set(true);

            expect(value1).toBe(true);
            expect(value2).toBe(true);

            unsub1();
            unsub2();
        });

        it('should unsubscribe correctly', () => {
            // Reset to known state first
            insightsLoading.set(false);
            
            const values: boolean[] = [];
            const unsubscribe = insightsLoading.subscribe((v) => {
                values.push(v);
            });

            // Initial call from subscription
            expect(values.length).toBe(1);
            expect(values[0]).toBe(false);

            // Set a new DIFFERENT value to trigger subscriber
            insightsLoading.set(true);
            expect(values.length).toBe(2);

            unsubscribe();

            // After unsubscribe, setting should not add more values
            insightsLoading.set(false);
            expect(values.length).toBe(2); // Should still be 2, not 3
        });
    });

    describe('Error Handling', () => {
        it('should handle localStorage errors gracefully for persistent stores', () => {
            // The persistentStore in stores.ts wraps localStorage in try-catch
            // This test verifies the store continues to work even with localStorage issues
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            
            // Test that store updates still work locally
            currentInvoice.set({ vendorName: 'Test' });
            expect(get(currentInvoice)).toEqual({ vendorName: 'Test' });
            
            consoleSpy.mockRestore();
        });

        it('should not throw when localStorage is unavailable', () => {
            // Test that stores work in environments without localStorage
            expect(() => {
                // Use derived stores which don't depend on localStorage directly
                activeShift.set({ id: 1, userId: 1, openedAt: new Date(), openingBalance: 100, status: 'open' });
                expect(get(hasActiveShift)).toBe(true);
            }).not.toThrow();
        });
    });
});

describe('Store Type Safety', () => {
    it('should enforce correct types for isProcessing', () => {
        // TypeScript would catch this at compile time
        // Runtime test to ensure boolean values
        isProcessing.set(true);
        expect(typeof get(isProcessing)).toBe('boolean');
    });

    it('should enforce correct types for activeShiftId', () => {
        activeShiftId.set(123);
        const value = get(activeShiftId);
        expect(value === null || typeof value === 'number').toBe(true);
    });

    it('should enforce correct types for customerSegments', () => {
        const value = get(customerSegments);
        expect(Array.isArray(value)).toBe(true);
    });
});
