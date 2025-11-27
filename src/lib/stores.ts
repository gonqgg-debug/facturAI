import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import type { Invoice, CashRegisterShift } from './types';
import type { CustomerSegment, RealTimeInsight } from './customer-insights/types';
import type { CurrentWeather } from './weather';

// Helper for persistent stores (uses JSON for complex objects)
function persistentStore<T>(key: string, startValue: T) {
    let initial = startValue;

    if (browser) {
        try {
            const storedValue = localStorage.getItem(key);
            if (storedValue) {
                initial = JSON.parse(storedValue);
            }
        } catch (e) {
            console.error(`Error loading ${key} from localStorage:`, e);
        }
    }

    const store = writable<T>(initial);

    store.subscribe(value => {
        if (browser) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
            } catch (e) {
                console.error(`Error saving ${key} to localStorage:`, e);
            }
        }
    });

    return store;
}

// Helper for simple string stores (no JSON encoding - avoids quote issues)
function persistentStringStore(key: string, startValue: string) {
    let initial = startValue;

    if (browser) {
        const storedValue = localStorage.getItem(key);
        if (storedValue) {
            // Clean up any accidentally stored quotes from previous JSON.stringify
            initial = storedValue.replace(/^["']|["']$/g, '');
        }
    }

    const store = writable<string>(initial);

    store.subscribe(value => {
        if (browser && value !== undefined) {
            // Store raw string value without JSON encoding
            localStorage.setItem(key, value);
        }
    });

    return store;
}

export const apiKey = persistentStringStore('xai_api_key', '');
export const currentInvoice = persistentStore<Partial<Invoice> | null>('current_invoice', null);
export const isProcessing = writable<boolean>(false);
export const locale = persistentStringStore('app_locale', 'en');

// ============ POS MODE STORE ============
// When in POS mode, hide the sidebar for full-screen operation
export const isPosMode = writable<boolean>(false);

// ============ CASH REGISTER SHIFT STORE ============
// Store the active shift ID in localStorage for persistence across page refreshes
export const activeShiftId = persistentStore<number | null>('active_shift_id', null);

// Full shift data (loaded from DB when needed)
export const activeShift = writable<CashRegisterShift | null>(null);

// Derived store to check if there's an active shift
export const hasActiveShift = derived(activeShift, $shift => $shift !== null && $shift.status === 'open');

// ============ CUSTOMER INSIGHTS STORES ============
// Store customer segments for quick access
export const customerSegments = writable<CustomerSegment[]>([]);

// Store real-time insights
export const realTimeInsights = writable<RealTimeInsight[]>([]);

// Last insights update timestamp
export const lastInsightsUpdate = writable<Date | null>(null);

// Insights loading state
export const insightsLoading = writable<boolean>(false);

// Derived store for active (non-expired) insights
export const activeInsights = derived(realTimeInsights, $insights => {
    const now = new Date();
    return $insights.filter(insight => {
        if (!insight.expiresAt) return true;
        return new Date(insight.expiresAt) > now;
    });
});

// Derived store for insights count by type
export const insightsCounts = derived(realTimeInsights, $insights => {
    return $insights.reduce((acc, insight) => {
        acc[insight.insightType] = (acc[insight.insightType] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
});

// ============ WEATHER STORES ============
// OpenWeatherMap API key
export const weatherApiKey = persistentStringStore('weather_api_key', '');

// Store location for weather data (city name, e.g., "Santo Domingo, DO")
export const storeLocation = persistentStringStore('store_location', '');

// Current weather data (not persisted - fetched fresh)
export const currentWeather = writable<CurrentWeather | null>(null);

// Weather loading state
export const weatherLoading = writable<boolean>(false);

// Last weather update timestamp
export const lastWeatherUpdate = writable<Date | null>(null);

// Weather error state
export const weatherError = writable<string | null>(null);

// Derived store for weather availability
export const isWeatherConfigured = derived(
    [weatherApiKey, storeLocation],
    ([$key, $location]) => Boolean($key && $location)
);
