/**
 * Client-side hooks
 * Initialize Sentry on the client side
 */

import { initSentry } from '$lib/sentry';
import { env } from '$env/dynamic/public';

// Initialize Sentry for client-side error tracking
// Use PUBLIC_SENTRY_DSN for client-side (set in .env or Vercel)
initSentry(env.PUBLIC_SENTRY_DSN);

