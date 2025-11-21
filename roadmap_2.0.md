# FacturAI 2.0: Evolution Roadmap (Hypothetical)

This document outlines a strategic vision for the next evolution of FacturAI. Assuming the current core (Capture -> Extract -> Validate -> History) is stable, these features aim to transform the app from a "Digitization Tool" into a "Business Intelligence & Automation Platform" for Mini Markets in the Dominican Republic.

## 1. Compliance & Finance (The "Smart Accountant")
*Target: Reduce administrative burden and accounting costs.*

### 1.1. Automated DGII 606 Reporting
**The Killer Feature.** In the DR, every business must file the "Formato 606" (Purchase Report) monthly.
*   **Feature:** Auto-generate the exact text/Excel file required by the DGII.
*   **Logic:** Map extracted NCFs, RNCs, and Tax amounts to the specific 606 column codes (Cost vs. Expense, ITBIS Retained, etc.).
*   **Value:** Saves hours of manual data entry and accounting fees.

### 1.2. Expense Categorization
*   **Feature:** Smart categorization of invoices (e.g., "Inventory", "Electricity", "Maintenance", "Payroll").
*   **AI:** Grok automatically classifies the invoice based on the supplier and line items.
*   **Value:** Real-time P&L (Profit & Loss) estimation.

---

## 2. Inventory & Pricing (The "Smart Buyer")
*Target: Protect margins and optimize stock.*

### 2.1. Margin Protector (Inflation Alert)
*   **Feature:** Input "Selling Price" for products.
*   **Logic:** When a new invoice is scanned, compare the new `Unit Cost` against the `Selling Price`.
*   **Alert:** "⚠️ Cost increased by 10%. Your margin dropped below 15%. Suggest raising price to $X."
*   **Value:** Prevents silent profit erosion due to inflation.

### 2.2. "Stock In" Workflow
*   **Feature:** A "Commit to Inventory" button after validation.
*   **Logic:** Adds the validated quantities to the current stock levels.
*   **Value:** Closes the loop between purchasing and inventory without double entry.

### 2.3. Predictive Reordering
*   **Feature:** Analyze purchase frequency.
*   **Logic:** "You typically buy 5 cases of Presidente every Friday. It's Friday and you haven't scanned an invoice for it." -> *Generate Shopping List*.
*   **Value:** Prevents stockouts of high-turnover items.

---

## 3. Advanced AI & Automation (The "Autonomous Operator")
*Target: Reduce human interaction to zero for routine tasks.*

### 3.1. "Auto-Pilot" Mode
*   **Feature:** Skip the validation screen for high-confidence matches.
*   **Logic:** If (Supplier is Trusted) AND (AI Confidence > 99%) AND (Math Checks Out) -> **Auto-Save**.
*   **Value:** User only reviews anomalies; routine invoices are processed instantly.

### 3.2. Voice-Assisted Validation
*   **Feature:** Hands-free correction.
*   **Interaction:** User says: "Change quantity of Rice to 50." -> App updates the field.
*   **Value:** Faster validation when handling physical paper.

### 3.3. Email & WhatsApp Integration
*   **Feature:** Forward digital invoices (PDFs) to `bot@facturai.com` or a WhatsApp number.
*   **Logic:** App processes them in the background and notifies you when ready to validate.
*   **Value:** Handles the growing number of digital invoices from modern suppliers.

---

## 4. Technical & UX Enhancements
*Target: Enterprise-grade reliability and experience.*

### 4.1. Multi-User Roles
*   **Roles:**
    *   **Clerk:** Can only Scan.
    *   **Manager:** Can Validate and Fix prices.
    *   **Owner:** Can view Analytics, Margins, and 606 Reports.
*   **Value:** Security and delegation.

### 4.2. Offline-First Sync (Enhanced)
*   **Feature:** Robust conflict resolution for multi-device usage (e.g., scanning on phone, validating on tablet).
*   **Value:** Seamless workflow across the store.

### 4.3. Supplier Portal (Long Term)
*   **Feature:** Send a link to suppliers to upload their own invoices directly.
*   **Value:** Shifts the data entry burden to the vendor.

---

## 5. WhatsApp Commerce & Delivery (The "Digital Counter")
*Target: Automate the manual delivery workflow and increase sales.*

### 5.1. Conversational Ordering (AI Agent)
*   **Feature:** Customers send orders via WhatsApp in natural language.
*   **Interaction:** Customer: "Mándame 2 presidentes frías y un paquete de hielo."
*   **AI Logic:** The bot parses the text, matches items to the Inventory catalog, checks stock, and replies with a structured order summary and total.
*   **Value:** Instant response 24/7, no manual transcription errors.

### 5.2. Integrated Payment & Checkout
*   **Feature:** Seamless payment within the chat flow.
*   **Logic:**
    *   Bot sends a payment link (Azul/Cardnet) or displays transfer info.
    *   Customer uploads screenshot of transfer -> AI validates it (OCR).
    *   Order status updates to "Paid & Confirmed".
*   **Value:** Reduces "fake orders" and speeds up dispatch.

### 5.3. Delivery Tracking & Feedback Loop
*   **Feature:** Automated status updates sent to the customer.
*   **Flow:**
    *   "Order Packed 📦"
    *   "Driver is on the way 🛵"
    *   "Delivered ✅"
*   **Feedback:** 30 minutes after delivery, bot asks: "How was everything? Rate us 1-5."
*   **Value:** Professional customer experience and valuable quality data.

---

## 6. Point of Sale (POS) Integration (The "Smart Register")
*Target: Close the loop between Inventory (Buying) and Sales (Selling).*

**Critical Insight:** To fully automate accounting and inventory, the system must capture *sales* data, not just purchases.

### 6.1. Tablet-Based POS Interface
*   **Feature:** A simplified, touch-friendly interface for the cashier.
*   **Functionality:**
    *   **Quick Scan:** Barcode scanning support (via camera or USB scanner).
    *   **Quick Pick:** Visual grid for common items without barcodes (Empanadas, Coffee).
    *   **Cart Management:** Add/Remove items, apply discounts.
*   **Value:** Captures the "Output" of the inventory equation.

### 6.2. Real-Time Inventory Deduction
*   **Feature:** Every sale immediately updates stock levels.
*   **Logic:** `Current Stock = (Previous Stock + New Purchases) - (Sales + Spoilage)`.
*   **Value:** Enables accurate "Low Stock" alerts and theft detection (if physical count < system count).

### 6.3. Daily "Cuadre" (Reconciliation)
*   **Feature:** End-of-day report comparing expected cash vs. actual cash.
*   **Logic:**
    *   System: "You sold DOP 15,000 in cash."
    *   User Input: "I have DOP 14,950 in the drawer."
    *   Result: "⚠️ Shortage of DOP 50."
*   **Value:** Financial control and employee accountability.

---

---

## 7. Execution Timeline & Phasing

This timeline assumes a small agile team (or solo developer) working iteratively.

### **Phase 1: Foundation & Optimization (Current - Month 1)**
*   **Status:** Active / In Progress.
*   **Goal:** Ensure the "Input" (Invoice Capture) is 99% accurate and frustration-free.
*   **Key Deliverables:**
    *   ✅ Robust OCR & AI Extraction (Done).
    *   ✅ Validation UI & History (Done).
    *   ⬜ **Multi-User Roles** (To Do).
    *   ⬜ **Offline-First Sync** (To Do).

#### **🚀 Action Plan for 99% Reliability**
To move from "It works" to "It never fails", we must execute these steps:

1.  **Stress Testing (The "Crumpled Receipt" Test)**
    *   **Action:** Collect a dataset of 50 "worst-case" invoices (faded ink, bad lighting, crumpled paper, handwriting).
    *   **Goal:** Tune OCR filters until we achieve >90% recognition on this "Torture Set".

2.  **Automated "Sanity Checks"**
    *   **Action:** Implement strict post-processing logic.
    *   **Rule:** If `Calculated Total` != `OCR Total`, flag as "Needs Review" automatically.
    *   **Rule:** If `NCF` format is invalid (wrong length/prefix), reject immediately.

3.  **The "Feedback Loop" (Active Learning)**
    *   **Action:** Add a "Report Error" button in the Validation screen.
    *   **Logic:** When a user corrects a field (e.g., changes "Rice" to "Sack of Rice"), save this correction to the **Knowledge Base** automatically.
    *   **Result:** The AI never makes the same mistake twice for that supplier.

4.  **Resilient Network Handling**
    *   **Action:** Implement "Background Retry" for API calls.
    *   **Scenario:** Internet drops while scanning? Queue the request and process it silently when connection returns.

5.  **Unit Testing Core Logic**
    *   **Action:** Write automated tests for `tax.ts` and `grok.ts`.
    *   **Goal:** Ensure that code changes never break the tax calculations or JSON parsing.

### **Phase 2: The "Smart Accountant" (Month 2 - Month 3)**
*   **Goal:** Deliver immediate financial value and save time on taxes.
*   **Key Deliverables:**
    *   **DGII 606 Generation:** The highest value/effort ratio feature.
    *   **Expense Categorization:** Real-time P&L.
    *   **Margin Alerts:** Protect profitability immediately.

### **Phase 3: The "Smart Register" (Month 4 - Month 6)**
*   **Goal:** Close the inventory loop and capture sales data.
*   **Key Deliverables:**
    *   **Tablet POS:** Basic "Cash Register" functionality.
    *   **Inventory Deduction:** Real-time stock updates.
    *   **Daily Cuadre:** Cash control.

### **Phase 4: The "Digital Expansion" (Month 7+)**
*   **Goal:** Expand sales channels and automate customer interaction.
*   **Key Deliverables:**
    *   **WhatsApp Commerce:** Automated ordering bot.
    *   **Delivery Tracking:** Uber-like experience for delivery.
    *   **Auto-Pilot:** Fully autonomous invoice processing for trusted suppliers.

---

## Strategic Recommendation
**Start with Phase 2 (Compliance).** The DGII 606 report is a monthly pain point for every business in the DR. Solving this creates "Lock-In" (users *need* the app to do their taxes) and provides the structured data needed for Phase 3 (Inventory).
