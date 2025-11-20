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
    You are the world's most accurate invoice parser for Dominican Republic minimarkets in 2025. Your ONLY goal is perfect extraction — no summarization, no skipping lines, no hallucinations.

    GLOBAL KNOWLEDGE BASE (always apply first):

    [TAX RULES & REGULATIONS]
    ${taxRules || 'ITBIS standard = 18%. Some items exempt (0%). Prices may include or exclude tax — detect automatically.'}

    [UNIT CONVERSIONS & PACK SIZES]
    ${conversions || 'Default: "12x", "6x", "24x", "CAJ", "PAQ", "SOB" -> multiply quantity by pack size. Example: "12x1L" and Qty 1 -> Qty 12.'}

    [GENERAL BUSINESS LOGIC & CATEGORY MAPPING]
    ${businessLogic || 'Categorize for Odoo import: salami/chorizo/longaniza -> Carnes y Embutidos; leche/yogurt -> Lácteos; cerveza -> Bebidas Alcohólicas; jabón/detergente -> Limpieza y Hogar; té -> Bebidas No Alcohólicas; default -> Otros.'}

    ${hintsContext}

    EXTRACTION STRATEGY — TOTAL IS KING:
    1. Find the GRAND TOTAL / "Importe Neto" / "Total a Pagar" first — this is absolute truth.
    2. Find ITBIS total and subtotal.
    3. For every line item: trust the LINE TOTAL ("Importe", "Valor") over unit price column.
       -> Calculate unitPrice = lineTotal / quantity
    4. Tax detection:
       - If sum(line totals) ≈ grand total -> priceIncludesTax = true
       - If sum(line totals) ≈ subtotal -> priceIncludesTax = false
    5. Pack conversion: apply rules above — lineTotal never changes, only quantity & unitPrice
    6. Extract EVERY line — even if 40+ items or text is small/noisy
    7. Description = exact text from invoice (keep codes like 746019...)
    8. Round money to 2 decimals exactly as on invoice

    Return ONLY valid JSON — nothing else:

    {
      "providerName": "exact header name",
      "providerRnc": "string",
      "clientName": "string",
      "clientRnc": "string",
      "issueDate": "YYYY-MM-DD",
      "dueDate": "YYYY-MM-DD or null",
      "ncf": "string",
      "currency": "DOP",
      "category": "Inventory" | "Utilities" | "Maintenance" | "Payroll" | "Other",
      "items": [
        {
          "description": "exact description",
          "quantity": number (after pack conversion),
          "unitPrice": number (calculated, 2 decimals),
          "priceIncludesTax": boolean,
          "amount": number (exact from invoice LINE TOTAL),
          "itbis": number,
          "value": number (net amount excluding tax)
        }
      ],
      "subtotal": number,
      "discount": number,
      "itbisTotal": number,
      "total": number (MUST match invoice exactly)
    }

    Raw OCR text (for context only):
    (See User Message)

    Now extract with surgical precision. The final total must match the invoice exactly.
  `;
}

export function generateUserPrompt(ocrText: string, supplier?: Supplier): string {
  let userPrompt = `RAW OCR TEXT:\n\n${ocrText}\n\n----------------\n\nBased on the above text, generate the JSON output following the "Total is King" strategy.`;

  // Few-shot prompting if supplier exists
  if (supplier && supplier.examples && supplier.examples.length > 0) {
    const examples = supplier.examples.slice(-3).map(ex => JSON.stringify(ex)).join('\n---\n');
    userPrompt = `REFERENCE EXAMPLES (Previous invoices from this supplier):\n${examples}\n\n` + userPrompt;
  }

  if (supplier && supplier.customRules) {
    userPrompt = `CUSTOM RULES FOR THIS SUPPLIER:\n${supplier.customRules}\n\n` + userPrompt;
  }

  return userPrompt;
}
