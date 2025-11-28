import type { Invoice, Supplier, UserHints } from './types';
import { db } from './db';
import { generateSystemPrompt, generateUserPrompt, DEFAULT_MODEL } from './prompts';
import { retryWithBackoff } from './retry';
import { logger } from './logger';

/**
 * Parse invoice using Grok API via server-side proxy
 * API key is now stored server-side for security
 */
export async function parseInvoiceWithGrok(
    ocrText: string,
    supplier?: Supplier,
    hints?: UserHints,
    model: string = DEFAULT_MODEL
): Promise<Partial<Invoice>> {

    // 1. Get Global Context
    const globalContextItems = await db.globalContext.toArray();

    // 2. Build System Prompt
    const systemPrompt = generateSystemPrompt(globalContextItems, hints);
    const userPrompt = generateUserPrompt(ocrText, supplier);

    try {
        logger.info('Sending to Grok via server proxy...', { model, textLength: ocrText.length });

        // Use server-side API route instead of direct API call with retry logic
        const { getCsrfHeader } = await import('./csrf');
        
        const data = await retryWithBackoff(async () => {
            const response = await fetch('/api/grok', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    ...getCsrfHeader()
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    temperature: 0.1
                })
            });

            logger.debug('Grok API Response status', { status: response.status, statusText: response.statusText });

            if (!response.ok) {
                let errorData;
                try {
                    errorData = await response.json();
                } catch (e) {
                    const text = await response.text();
                    errorData = { error: text || 'Unknown error' };
                }
                
                const error: any = new Error(`Grok API Failed: ${response.status} ${errorData.error || errorData.message || 'Unknown error'}`);
                error.status = response.status;
                error.errorData = errorData;
                throw error;
            }

            const responseData = await response.json();
            logger.debug('Grok Response received', { 
                hasChoices: !!responseData.choices, 
                choiceCount: responseData.choices?.length,
                firstChoice: responseData.choices?.[0] 
            });

            if (!responseData.choices || !responseData.choices[0] || !responseData.choices[0].message) {
                throw new Error('Invalid response format from Grok');
            }

            return responseData;
        }, {
            maxRetries: 3,
            initialDelay: 1000,
            retryable: (error: any) => {
                // Retry on network errors, timeouts, and 5xx errors
                if (error?.status >= 500 && error?.status < 600) return true;
                if (error?.status === 429) return true; // Rate limiting
                if (error instanceof Error) {
                    const msg = error.message.toLowerCase();
                    return msg.includes('fetch') || msg.includes('network') || msg.includes('timeout');
                }
                return false;
            }
        });

        const content = data.choices[0].message.content;

        // Clean up markdown code blocks and extract JSON object
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : content.replace(/```json/g, '').replace(/```/g, '').trim();

        return JSON.parse(jsonStr);

    } catch (error) {
        logger.error('Grok extraction error', error instanceof Error ? error : new Error(String(error)));
        throw error;
    }
}
