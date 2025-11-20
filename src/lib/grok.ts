import type { Invoice, Supplier, UserHints } from './types';
import { db } from './db';
import { generateSystemPrompt, generateUserPrompt, DEFAULT_MODEL } from './prompts';

const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';

export async function parseInvoiceWithGrok(
    ocrText: string,
    apiKey: string,
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
        console.log('Sending to Grok...', { model, textLength: ocrText.length });

        const response = await fetch(GROK_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
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

        if (!response.ok) {
            const errText = await response.text();
            console.error('Grok API Error:', response.status, errText);
            throw new Error(`Grok API Failed: ${response.status} ${errText}`);
        }

        const data = await response.json();
        console.log('Grok Response:', data);

        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error('Invalid response format from Grok');
        }

        const content = data.choices[0].message.content;

        // Clean up markdown code blocks if present
        const jsonStr = content.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonStr);

    } catch (error) {
        console.error('Grok extraction error:', error);
        throw error;
    }
}
