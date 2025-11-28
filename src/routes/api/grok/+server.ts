import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { logger } from '$lib/logger';

const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';

/**
 * Server-side Grok API proxy
 * Keeps API keys secure on the server
 */
export const POST: RequestHandler = async ({ request }) => {
    // Get API key from environment variable (server-side only)
    const apiKey = env.XAI_API_KEY;

    if (!apiKey) {
        logger.error('XAI_API_KEY is not set. Check your .env file and restart the dev server.');
        return json({ error: 'Grok API key not configured. Please set XAI_API_KEY in .env file and restart the dev server.' }, { status: 500 });
    }

    try {
        const body = await request.json();

        // Validate request body
        if (!body.messages || !Array.isArray(body.messages)) {
            return json({ error: 'Invalid request: messages array required' }, { status: 400 });
        }

        // Set up timeout (30 seconds)
        const timeoutMs = 30000;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            // Forward request to Grok API
            const response = await fetch(GROK_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: body.model || 'grok-2',
                    messages: body.messages,
                    temperature: body.temperature ?? 0.1,
                    stream: body.stream ?? false
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                logger.error('Grok API Error', undefined, { status: response.status, errorText });
                return json({ error: `Grok API error: ${response.status} ${errorText}` }, { status: response.status });
            }

            const data = await response.json();
            return json(data);
        } catch (fetchError) {
            clearTimeout(timeoutId);
            
            // Handle timeout
            if (fetchError instanceof Error && fetchError.name === 'AbortError') {
                logger.error('Grok API request timeout');
                return json({ error: 'Request timeout: The API request took too long (30s limit)' }, { status: 408 });
            }
            
            // Re-throw to be handled by outer catch
            throw fetchError;
        }
    } catch (err) {
        logger.error('Error in Grok API proxy', err instanceof Error ? err : new Error(String(err)));
        return json({ 
            error: err instanceof Error ? err.message : 'Internal server error',
            details: err instanceof Error ? err.stack : undefined
        }, { status: 500 });
    }
};

