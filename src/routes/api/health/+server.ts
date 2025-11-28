import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Health Check Endpoint
 * Returns system status for monitoring and uptime checks
 */
export const GET: RequestHandler = async () => {
    const startTime = Date.now();
    
    // Collect health metrics
    const health = {
        status: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        uptime: process.uptime ? process.uptime() : null,
        checks: {
            api: { status: 'ok' as 'ok' | 'error', latency: 0 }
        }
    };
    
    // Calculate response latency
    health.checks.api.latency = Date.now() - startTime;
    
    // Return health status
    return json(health, {
        headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        }
    });
};

