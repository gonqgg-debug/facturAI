import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Plugin to generate firebase-messaging-sw.js with environment variables
 * This prevents hardcoding API keys in the repository
 */
function generateFirebaseSwPlugin() {
    return {
        name: 'generate-firebase-sw',
        buildStart() {
            // Load environment variables
            const env = loadEnv('production', process.cwd(), 'VITE_');
            
            const swContent = `/**
 * Firebase Cloud Messaging Service Worker
 * Generated at build time - DO NOT EDIT DIRECTLY
 * Edit vite.config.js instead
 */

importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

// Initialize Firebase in the service worker
firebase.initializeApp({
    apiKey: "${env.VITE_FIREBASE_API_KEY || ''}",
    authDomain: "${env.VITE_FIREBASE_AUTH_DOMAIN || ''}",
    projectId: "${env.VITE_FIREBASE_PROJECT_ID || ''}",
    storageBucket: "${env.VITE_FIREBASE_STORAGE_BUCKET || ''}",
    messagingSenderId: "${env.VITE_FIREBASE_MESSAGING_SENDER_ID || ''}",
    appId: "${env.VITE_FIREBASE_APP_ID || ''}",
    measurementId: "${env.VITE_FIREBASE_MEASUREMENT_ID || ''}"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message:', payload);
    
    const notificationTitle = payload.notification?.title || 'Cuadra';
    const notificationOptions = {
        body: payload.notification?.body || '',
        icon: '/cuadra_favicon.ico',
        badge: '/cuadra_favicon.ico',
        tag: payload.data?.tag || 'default',
        data: payload.data,
        actions: [
            { action: 'view', title: 'Ver' },
            { action: 'dismiss', title: 'Cerrar' }
        ]
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    console.log('[firebase-messaging-sw.js] Notification clicked:', event);
    event.notification.close();
    
    if (event.action === 'view') {
        const urlToOpen = event.notification.data?.url || '/';
        
        event.waitUntil(
            clients.matchAll({ type: 'window', includeUncontrolled: true })
                .then((clientList) => {
                    for (const client of clientList) {
                        if (client.url.includes(self.location.origin) && 'focus' in client) {
                            client.focus();
                            client.navigate(urlToOpen);
                            return;
                        }
                    }
                    if (clients.openWindow) {
                        return clients.openWindow(urlToOpen);
                    }
                })
        );
    }
});
`;
            
            // Write to static folder (will be copied to build output)
            writeFileSync(resolve('static/firebase-messaging-sw.js'), swContent);
            console.log('✅ Generated firebase-messaging-sw.js with environment variables');
        }
    };
}

export default defineConfig({
    plugins: [
        generateFirebaseSwPlugin(),
        sveltekit(),
        VitePWA({
            registerType: 'autoUpdate',
            workbox: {
                runtimeCaching: [
                    {
                        urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'cdn-libraries',
                            expiration: {
                                maxEntries: 10,
                                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
                            },
                            cacheableResponse: {
                                statuses: [0, 200]
                            }
                        }
                    },
                    {
                        urlPattern: /^https:\/\/tessdata\.projectnaptha\.com\/.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'tesseract-data',
                            expiration: {
                                maxEntries: 10,
                                maxAgeSeconds: 60 * 60 * 24 * 365
                            },
                            cacheableResponse: {
                                statuses: [0, 200]
                            }
                        }
                    }
                ]
            },
            manifest: {
                name: 'Cuadra',
                short_name: 'Cuadra',
                description: 'POS + ERP con IA para pequeños comercios',
                theme_color: '#000000',
                background_color: '#000000',
                display: 'standalone',
                scope: '/',
                start_url: '/',
                icons: [
                    {
                        src: 'pwa-192x192.png',
                        sizes: '192x192',
                        type: 'image/png'
                    },
                    {
                        src: 'pwa-512x512.png',
                        sizes: '512x512',
                        type: 'image/png'
                    }
                ]
            }
        })
    ],
    // Vitest configuration
    test: {
        include: ['src/**/*.{test,spec}.{js,ts}'],
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./src/tests/setup.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            include: ['src/lib/**/*.ts'],
            exclude: [
                'src/lib/components/**',
                'src/lib/customer-insights/**',
                '**/*.d.ts',
                '**/*.test.ts',
                '**/*.spec.ts'
            ],
            thresholds: {
                lines: 15,
                branches: 10,
                functions: 10,
                statements: 15
            }
        }
    }
});
