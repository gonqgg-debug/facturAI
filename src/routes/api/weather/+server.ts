import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { logger } from '$lib/logger';
import { z } from 'zod';
import { getErrorString } from '$lib/validation';

const WEATHER_API_URL = 'https://api.openweathermap.org/data/2.5/weather';

// Zod schema for weather API query parameters
const weatherQuerySchema = z.object({
    city: z.string().min(1).max(100).optional(),
    lat: z.string().regex(/^-?\d+\.?\d*$/, 'Invalid latitude format').optional(),
    lon: z.string().regex(/^-?\d+\.?\d*$/, 'Invalid longitude format').optional()
}).refine(
    (data) => data.city || (data.lat && data.lon),
    { message: 'Either city or both lat/lon parameters are required' }
);

/**
 * Server-side Weather API proxy
 * Keeps API keys secure on the server
 */
export const GET: RequestHandler = async ({ url }) => {
    // Get API key from environment variable (server-side only)
    const apiKey = env.OPENWEATHER_API_KEY;

    if (!apiKey) {
        logger.error('OPENWEATHER_API_KEY is not set. Check your .env file and restart the dev server.');
        return json({ error: 'Weather API key not configured. Please set OPENWEATHER_API_KEY in .env file and restart the dev server.' }, { status: 500 });
    }

    try {
        // Get and validate query parameters with Zod
        const queryParams = {
            city: url.searchParams.get('city') || undefined,
            lat: url.searchParams.get('lat') || undefined,
            lon: url.searchParams.get('lon') || undefined
        };
        
        const validationResult = weatherQuerySchema.safeParse(queryParams);
        if (!validationResult.success) {
            logger.warn('Invalid weather API request', { errors: getErrorString(validationResult.error) });
            return json({ error: `Invalid request: ${getErrorString(validationResult.error)}` }, { status: 400 });
        }
        
        const { city, lat, lon } = validationResult.data;

        // Build API URL with validated parameters
        let weatherUrl = `${WEATHER_API_URL}?appid=${apiKey}&units=metric`;
        
        if (city) {
            weatherUrl += `&q=${encodeURIComponent(city)}`;
        } else {
            weatherUrl += `&lat=${lat}&lon=${lon}`;
        }

        // Set up timeout (30 seconds)
        const timeoutMs = 30000;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            // Forward request to Weather API
            const response = await fetch(weatherUrl, {
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                logger.error('Weather API Error', undefined, { status: response.status, errorText });
                
                if (response.status === 401) {
                    return json({ error: 'Invalid Weather API key' }, { status: 401 });
                }
                if (response.status === 404) {
                    return json({ error: 'City not found' }, { status: 404 });
                }
                
                return json({ error: `Weather API error: ${response.status} ${errorText}` }, { status: response.status });
            }

            const data = await response.json();
            return json(data);
        } catch (fetchError) {
            clearTimeout(timeoutId);
            
            // Handle timeout
            if (fetchError instanceof Error && fetchError.name === 'AbortError') {
                logger.error('Weather API request timeout');
                return json({ error: 'Request timeout: The API request took too long (30s limit)' }, { status: 408 });
            }
            
            // Re-throw to be handled by outer catch
            throw fetchError;
        }
    } catch (err) {
        logger.error('Error in Weather API proxy', err instanceof Error ? err : new Error(String(err)));
        return json({ 
            error: err instanceof Error ? err.message : 'Internal server error',
            details: err instanceof Error ? err.stack : undefined
        }, { status: 500 });
    }
};
