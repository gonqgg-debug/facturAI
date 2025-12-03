import type { Handle } from '@sveltejs/kit';
import { createCsrfCookie, validateCsrfToken } from '$lib/csrf';
import { handleErrorWithSentry } from '@sentry/sveltekit';
import { initSentry } from '$lib/sentry';
import { env } from '$env/dynamic/private';

// Initialize Sentry on server startup
initSentry(env.SENTRY_DSN);

/**
 * Security Headers Middleware
 * Implements security best practices for production deployment
 */
export const handle: Handle = async ({ event, resolve }) => {
    // CSRF Protection for state-changing methods
    const isStateChangingMethod = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(event.request.method);
    const isApiRoute = event.url.pathname.startsWith('/api/');
    
    // Ensure CSRF cookie exists (set it if missing)
    // For double-submit pattern, cookie must NOT be httpOnly (client needs to read it)
    let csrfToken = event.cookies.get('csrf-token');
    if (!csrfToken) {
        try {
            const csrfCookie = createCsrfCookie();
            // Set cookie with proper options for double-submit pattern
            event.cookies.set(csrfCookie.name, csrfCookie.value, csrfCookie.options);
            csrfToken = csrfCookie.value;
        } catch (error) {
            console.error('Error creating CSRF cookie:', error);
            // Continue without CSRF for this request if token generation fails
        }
    }
    
    // CSRF Protection for state-changing methods
    // Skip CSRF for:
    // - GET requests (read-only)
    // - Non-API routes (forms will handle CSRF via SvelteKit)
    // - API proxy routes that don't modify user state (/api/grok, /api/weather)
    const csrfExemptRoutes = ['/api/grok', '/api/weather'];
    const isCsrfExempt = csrfExemptRoutes.some(route => event.url.pathname.startsWith(route));
    
    if (isStateChangingMethod && isApiRoute && !isCsrfExempt) {
        // Get CSRF token from cookie (should be set above)
        const cookieToken = event.cookies.get('csrf-token');
        
        // Get CSRF token from header
        const headerToken = event.request.headers.get('x-csrf-token');
        
        // Validate CSRF token
        if (!validateCsrfToken(cookieToken || null, headerToken || null)) {
            return new Response(
                JSON.stringify({ 
                    error: 'Invalid CSRF token',
                    details: {
                        hasCookie: !!cookieToken,
                        hasHeader: !!headerToken,
                        cookieLength: cookieToken?.length || 0,
                        headerLength: headerToken?.length || 0
                    }
                }),
                {
                    status: 403,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        }
    }
    
    const response = await resolve(event);

    // Security Headers
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    
    // HSTS - Force HTTPS (only in production)
    if (event.url.protocol === 'https:') {
        response.headers.set(
            'Strict-Transport-Security',
            'max-age=31536000; includeSubDomains; preload'
        );
    }

    // Content Security Policy
    // Allow inline scripts and styles for SvelteKit (needed for hydration)
    // In production, consider tightening this further
    const isDev = event.url.hostname === 'localhost' || event.url.hostname === '127.0.0.1' || event.url.hostname.startsWith('10.');
    
    const csp = [
        "default-src 'self'",
        // script-src: Allow SvelteKit, Tesseract.js CDN, and Firebase/Google Auth
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://apis.google.com https://www.googletagmanager.com https://www.gstatic.com",
        "worker-src 'self' blob: https://cdn.jsdelivr.net", // Allow Web Workers from blob URLs and CDN (needed for Tesseract.js OCR)
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https:", // Added blob: for image previews from camera/file uploads
        "font-src 'self' data:",
        // Connect-src: Allow Dexie Cloud, Firebase, and other APIs
        `connect-src 'self' https://api.x.ai https://api.openweathermap.org https://cdn.jsdelivr.net https://*.dexie.cloud wss://*.dexie.cloud https://*.googleapis.com https://*.firebaseio.com https://firebaseinstallations.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com${isDev ? ' ws://localhost:* ws://127.0.0.1:* wss://localhost:* wss://127.0.0.1:*' : ''}`,
        // frame-src: Allow Google OAuth popup and Firebase auth handler
        "frame-src 'self' https://accounts.google.com https://*.firebaseapp.com",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'"
        // Removed "upgrade-insecure-requests" for local development compatibility
    ].join('; ');

    // Only set CSP in production to avoid blocking local dev
    if (!isDev) {
        response.headers.set('Content-Security-Policy', csp);
    }
    
    // Ensure CSRF cookie is set in response if it was just created
    // The cookie set earlier in the function will be included in the response automatically
    // No need to set it again here - SvelteKit handles this

    return response;
};

/**
 * Error handler for Sentry
 */
export const handleError = handleErrorWithSentry();

