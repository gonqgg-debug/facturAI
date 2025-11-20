# FacturAI

A modern PWA for managing invoices, extracting data with AI, and tracking expenses.

## Prerequisites

- Node.js (v18 or later recommended)
- npm (usually comes with Node.js)

## How to Run

1.  **Install Dependencies**
    This downloads all the libraries required for the project (SvelteKit, Tailwind, Tesseract, etc.).
    ```bash
    npm install
    ```

2.  **Start Development Server**
    This starts the app locally.
    ```bash
    npm run dev
    ```
    
    **To test on your mobile phone (for Camera/PWA features):**
    Ensure your phone and computer are on the same Wi-Fi, then run:
    ```bash
    npm run dev -- --host
    ```
    Look for the "Network" URL in the terminal output (e.g., `http://192.168.1.x:5173`) and open that on your phone.

3.  **Build for Production**
    To create an optimized build for deployment:
    ```bash
    npm run build
    ```

## Project Structure

- `src/routes`: Contains the pages of your app (Capture, Validation, History, KB).
- `src/lib`: Contains utility code (Database, OCR, AI logic).
- `static`: Static assets like images.

## Key Features

- **Offline First**: Works without internet (after first load).
- **OCR**: Tesseract.js runs in the browser to read text.
- **AI**: Uses Grok API for intelligent data extraction.
