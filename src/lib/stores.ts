import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import type { Invoice } from './types';

// Helper for persistent stores
function persistentStore<T>(key: string, startValue: T) {
    const storedValue = browser ? localStorage.getItem(key) : null;
    const initial = storedValue ? JSON.parse(storedValue) : startValue;
    const store = writable<T>(initial);

    store.subscribe(value => {
        if (browser) {
            localStorage.setItem(key, JSON.stringify(value));
        }
    });

    return store;
}

export const apiKey = persistentStore<string>('xai_api_key', '');
export const currentInvoice = persistentStore<Partial<Invoice> | null>('current_invoice', null);
export const isProcessing = writable<boolean>(false);
