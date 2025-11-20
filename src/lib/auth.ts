import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// Default PIN: 2024
const ACCESS_PIN = '2024';

function createAuthStore() {
    const stored = browser ? localStorage.getItem('isAuthenticated') === 'true' : false;
    const { subscribe, set } = writable(stored);

    return {
        subscribe,
        login: (pin: string) => {
            if (pin === ACCESS_PIN) {
                set(true);
                if (browser) localStorage.setItem('isAuthenticated', 'true');
                return true;
            }
            return false;
        },
        logout: () => {
            set(false);
            if (browser) localStorage.removeItem('isAuthenticated');
        }
    };
}

export const isAuthenticated = createAuthStore();
