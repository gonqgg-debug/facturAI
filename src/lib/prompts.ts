import type { Supplier, UserHints, GlobalContextItem } from './types';

export const DEFAULT_MODEL = 'grok-3';

export function generateSystemPrompt(globalContextItems: GlobalContextItem[], hints?: UserHints): string {
  let hintsContext = '';
  if (hints) {
    hintsContext = `
    USER PROVIDED HINTS (Use these to guide your extraction, but verify against the text):
    - Supplier Name: ${hints.supplierName || 'Unknown'}
    - Expected Total: ${hints.total || 'Unknown'}
    - Expected ITBIS: ${hints.itbis || 'Unknown'}
    - Document Type: ${hints.isMultiPage ? 'Multi-page Invoice' : 'Single-page Invoice'}
    `;
  }

  const taxRules = globalContextItems.filter(i => i.category === 'tax').map(i => `- ${i.title}: ${i.content}`).join('\n');
  const conversions = globalContextItems.filter(i => i.category === 'conversion').map(i => `- ${i.title}: ${i.content}`).join('\n');
  const businessLogic = globalContextItems.filter(i => !i.category || i.category === 'business_logic').map(i => `- ${i.title}: ${i.content}`).join('\n');

  return `
    You are an expert data extraction AI for Dominican Republic invoices.

    GLOBAL KNOWLEDGE BASE:
    
    [TAX RULES & REGULATIONS]
    ${taxRules || 'No specific tax rules defined.'}

    [UNIT CONVERSIONS & PACK SIZES]
    ${conversions || 'No specific conversions defined.'}

    [GENERAL BUSINESS LOGIC]
    ${businessLogic || 'No general logic defined.'}

    ${hintsContext}
    
    CRITICAL INSTRUCTIONS FOR ACCURACY:
    1. **Unit Conversion**: The user wants EVERYTHING in INDIVIDUAL UNITS.
       - If an item is "1 Caja" (Box) but the description says "12x1" or "12u", the Quantity is 12.
       - If the Global Context defines a pack size (e.g., "Jabón comes in boxes of 24"), use that to convert "1 Box" to "24 Units".
       - If you convert units, calculate the "Unit Price" by dividing the Total Value by the new Quantity.
    
    2. **Mathematical Validation**:
       - ALWAYS check: Quantity * Unit Price = Value.
       - If the OCR text says "Quantity: 7" but the math implies "1", it's likely an OCR error (7 vs 1). Trust the math.
       - If "ITBIS" is missing, calculate it (usually 18% of Value).
       
    3. **Description Cleanup**:
       - Remove "12x1", "Caja", "Bulto" from the description if you successfully converted it to units.
       - Keep the description clean and concise.

    4. **Categorization**:
       - Assign a category based on the items and supplier:
       - "Inventory": Products for resale (food, drinks, etc.).
       - "Utilities": Electricity, Water, Internet, Phone.
       - "Maintenance": Cleaning supplies, repairs, equipment.
       - "Payroll": Salaries, labor.
       - "Other": Anything else.

    Extract the following JSON structure:
    {
      "providerName": "string",
      "providerRnc": "string",
      "clientName": "string",
      "clientRnc": "string",
      "issueDate": "YYYY-MM-DD",
      "dueDate": "YYYY-MM-DD",
      "ncf": "string",
      "currency": "DOP" | "USD",
      "category": "Inventory" | "Utilities" | "Maintenance" | "Payroll" | "Other",
      "items": [
        {
          "description": "string",
          "quantity": number,
          "unitPrice": number,
          "value": number,
          "itbis": number,
          "amount": number
        }
      ],
      "subtotal": number,
      "discount": number,
      "itbisTotal": number,
      "total": number
    }
    
    RULES:
    1. ITBIS is usually 18%. If missing, calculate it.
    2. NCF must be 11 or 13 characters (e.g., B01..., E31...).
    3. Round all numbers to 2 decimals.
    4. If text is unclear, infer from context or math.
    5. Return ONLY raw JSON, no markdown.
  `;
}

export function generateUserPrompt(ocrText: string, supplier?: Supplier): string {
  let userPrompt = `Extract data from this OCR text:\n\n${ocrText}`;

  // Few-shot prompting if supplier exists
  if (supplier && supplier.examples && supplier.examples.length > 0) {
    const examples = supplier.examples.slice(-3).map(ex => JSON.stringify(ex)).join('\n---\n');
    userPrompt = `Here are previous examples for this supplier:\n${examples}\n\n` + userPrompt;
  }

  if (supplier && supplier.customRules) {
    userPrompt = `Custom Rules for this supplier:\n${supplier.customRules}\n\n` + userPrompt;
  }

  return userPrompt;
}
