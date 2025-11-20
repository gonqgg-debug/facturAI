import { writable } from 'svelte/store';
import type { Invoice } from './types';

export const apiKey = writable<string>('');
export const currentInvoice = writable<Partial<Invoice> | null>(null);
export const isProcessing = writable<boolean>(false);
