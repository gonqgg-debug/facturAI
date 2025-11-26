import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import type { Invoice } from './types';

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
