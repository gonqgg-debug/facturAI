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
    
    CRITICAL INSTRUCTIONS FOR ACCURACY (TOTAL-DRIVEN APPROACH):
    
    1. **Find the Hard Truths First**:
       - **Step 1**: Locate the **GRAND TOTAL** of the invoice. This is your anchor.
       - **Step 2**: Locate the **ITBIS TOTAL** and **SUBTOTAL**.
       - **Step 3**: For each line item, locate the **LINE TOTAL** (Amount) and **QUANTITY**. These are usually the most reliable numbers.
    
    2. **Work Backwards to Solve for Price**:
       - Do NOT blindly trust the OCR'd Unit Price if it conflicts with the Total.
       - **Calculate**: \`Unit Price = Line Total / Quantity\`.
       - Use this calculated Unit Price if the OCR text is messy or ambiguous.
    
    3. **Infer Tax Status (Tax Included vs Excluded)**:
       - Check the math: \`Sum(Line Totals)\`.
       - **Scenario A**: If \`Sum(Line Totals) ≈ Grand Total\`, then the Line Totals **INCLUDE TAX**.
         - Set \`"priceIncludesTax": true\`.
         - The Unit Price you calculated is the Tax-Included Price.
       - **Scenario B**: If \`Sum(Line Totals) ≈ Subtotal\` (and \`Subtotal + Tax = Grand Total\`), then the Line Totals **EXCLUDE TAX**.
         - Set \`"priceIncludesTax": false\`.
         - The Unit Price you calculated is the Base Price.
    
    4. **Unit Conversion**:
       - The user wants INDIVIDUAL UNITS.
       - If description says "12x1" but Qty is 1, change Qty to 12.
       - **Recalculate**: \`New Unit Price = Line Total / New Quantity\`.
       - The `Line Total` NEVER changes during conversion, only Qty and Unit Price.

    5. **Categorization**:
       - Assign a category based on the items and supplier (Inventory, Utilities, Maintenance, Payroll, Other).

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
          "priceIncludesTax": boolean,
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
    1. **Trust the Totals**: If `Qty * Price != Line Total`, trust the `Line Total` and adjust the Price.
    2. **Trust the Grand Total**: The sum of your extracted items MUST match the Grand Total.
    3. ITBIS is usually 18%.
    4. NCF must be 11 or 13 characters.
    5. Return ONLY raw JSON.
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
