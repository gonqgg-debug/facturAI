import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
    plugins: [
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
                name: 'FacturAI',
                short_name: 'FacturAI',
                description: 'AI-Powered Invoice Management',
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
            // Start with lower thresholds and increase as more tests are added
            lines: 15,
            branches: 10,
            functions: 10,
            statements: 15
        }
        }
    }
});
