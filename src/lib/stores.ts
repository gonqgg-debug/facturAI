import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import type { Invoice } from './types';

// Helper for persistent stores
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

export const apiKey = persistentStore<string>('xai_api_key', '');
export const currentInvoice = persistentStore<Partial<Invoice> | null>('current_invoice', null);
export const isProcessing = writable<boolean>(false);
