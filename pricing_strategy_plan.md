# Pricing Module 2.0: Strategic Plan

This document outlines the architectural plan to transform the **Pricing** module from a passive history viewer into an active **Profit Optimization Engine**.

## 1. Database Schema Enhancements
We need to enrich the `Product` entity in `src/lib/db.ts` to support pricing logic and sales data.

### New Fields for `Product` Table
| Field | Type | Purpose |
| :--- | :--- | :--- |
| `sellingPrice` | `number` | Current shelf price. |
| `averageCost` | `number` | Moving average of purchase cost. |
| `targetMargin` | `number` | Desired profit margin (e.g., 0.30 for 30%). |
| `salesVolume` | `number` | Total units sold (historical). |
| `salesVelocity` | `number` | Average units sold per day (last 30 days). |
| `lastRestockDate` | `string` | Date of last invoice entry. |
| `lastSaleDate` | `string` | Date of last sale record. |

---

## 2. Excel Import Workflows
We will implement two distinct import flows using the `xlsx` library.

### A. Product Catalog Import (The "Setup")
*   **Goal:** Bulk upload/update of costs and selling prices.
*   **Columns:** `Product Name`, `Supplier`, `Cost`, `Selling Price`, `Category`, `Target Margin %`.
*   **Logic:**
    *   Match by `Product Name` + `Supplier`.
    *   **Upsert:** If exists, update `sellingPrice` and `targetMargin`. If new, create record.
    *   **Context:** This builds the "Truth Database" for the AI.

### B. Sales History Import (The "Feedback")
*   **Goal:** Ingest sales data from the legacy POS or manual records to calculate velocity.
*   **Columns:** `Date`, `Product Name`, `Quantity Sold`, `Total Sales`.
*   **Logic:**
    *   Update `salesVolume` (cumulative).
    *   Recalculate `salesVelocity` (rolling 30-day average).
    *   Update `lastSaleDate`.

---

## 3. AI Context & Validation Integration
How the Pricing Module informs the Invoice Capture (AI) process.

### The "Contextual Anchor"
When the AI extracts an invoice line item (e.g., "Arroz Campo 10lb"), we often get variations ("Arr. Campo", "Arroz 10lb").
*   **Strategy:** Post-Extraction Fuzzy Matching.
*   **Flow:**
    1.  AI extracts raw text: "Arr. Campo 10lb" @ $300.
    2.  System searches `db.products` for fuzzy match.
    3.  **Found:** "Arroz Campo 10lb" (Avg Cost: $290).
    4.  **Validation:**
        *   Cost Deviation < 5%: Auto-link.
        *   Cost Deviation > 20%: **Flag as "Price Alert"**. (Did we buy expensive? Or is it a different product?).

---

## 4. Cultural Context & Knowledge Base (The "Dominican Factor")
**Critical Insight:** Pricing in the DR follows different rules than the US. "Colmado" psychology is unique.

### 4.1. The "Base Pricing Prompt"
We will inject a specific system prompt into the AI that defines the local rules:
*   **Rounding Rules:** "In DR, small items (under $50) round to the nearest $5. Large items round to $10 or $50. Never use pennies (e.g., $14.99 is bad; $15.00 is good)."
*   **Category Norms:**
    *   **"Fria" (Cold Beer):** Zero tolerance for high markup. It's a traffic driver.
    *   **"Surtido" (Rice, Oil, Sugar):** Highly price-sensitive. Must match the neighborhood average.
    *   **"Antojos" (Snacks, Rum):** Higher tolerance for markup (Convenience fee).

### 4.2. Knowledge Base Integration
*   **Feature:** Add a "Pricing Rules" section to the Knowledge Base page.
*   **User Input:** The user can add specific rules like:
    *   *"Always price Presidente Small at $150 regardless of cost."*
    *   *"Minimum margin for imported candy is 40%."*
*   **AI Usage:** The AI reads these rules *before* making a suggestion.

---

## 5. AI Pricing Analyst (The "Market Expert")
**Shift:** Moving from raw math to **AI-Driven Rationalization**.
The AI acts as a consultant that understands market norms, product types, and consumer psychology.

### The "Analyze Prices" Workflow
*   **Trigger:** User clicks **"✨ Analyze with AI"** on the Pricing page.
*   **Input to AI:**
    *   Product: "Cerveza Presidente 650ml"
    *   Category: "Alcohol/Beer"
    *   Avg Cost: $120
    *   Sales Velocity: "High (50/day)"
*   **AI Logic (Grok):**
    1.  **Identify Norms:** "Beer in DR is a high-volume traffic driver. Standard margin is tight (15-20%)."
    2.  **Apply Psychology:** "Price should end in 0 or 5 for standard items."
    3.  **Synthesize:** Suggests a price that balances profit with competitiveness.

### New Data Columns
| Column | Source | Example |
| :--- | :--- | :--- |
| `AI Suggested Margin` | **AI** | "18%" (vs Math default of 30%) |
| `AI Suggested Price` | **AI** | "$145.00" |
| `AI Reasoning` | **AI** | "High turnover item. Kept margin low to match colmado standards. Rounded to $145 for simplicity." |

---

## 5. UI/UX Plan (Pricing Page)
Redesign `src/routes/pricing/+page.svelte` into a command center.

### Main View: The "Smart Grid"
*   **Action Bar:**
    *   [Import Catalog] (Excel)
    *   [**✨ Analyze All with AI**] (The Magic Button)
*   **The Table:**
    *   **Product Info:** Name, Category.
    *   **Cost:** Avg Cost (from Invoices).
    *   **Current:** Price & Margin.
    *   **AI Recommendation:**
        *   **Suggested Price:** Highlighted in Green if different from current.
        *   **Insight:** A tooltip or small text: *"Standard margin for Snacks is 30%."*
    *   **Actions:** [✅ Accept] [✏️ Edit] [❌ Ignore].

### Detail View: "Price Doctor"
*   Clicking a product opens a modal showing:
    *   **Cost History:** Chart of rising costs.
    *   **Sales Velocity:** "You sell 5 of these a day."
    *   **AI Chat:** "Why is this price so high?" -> AI explains its logic.

---

## 6. Execution Steps (Preliminary)
1.  **Update Types:** Modify `Product` interface in `types.ts`.
2.  **Update DB:** Add schema version 5 in `db.ts`.
3.  **Build Importers:** Create `ExcelImporter` component for Catalog and Sales.
4.  **Update Pricing UI:** Implement the Tabbed interface and Margin calculations.
5.  **Integrate Alerts:** Hook into the Invoice Validation page to show "Margin Squeeze" warnings.
