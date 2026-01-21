# FacturAI

A modern PWA for managing invoices, extracting data with AI, and tracking expenses.

## Prerequisites

- Node.js (v18 or later recommended)
- npm (usually comes with Node.js)
- API Keys:
  - **Grok API Key** (xAI) - Get at [console.x.ai](https://console.x.ai)
  - **OpenWeatherMap API Key** (optional) - Get at [openweathermap.org/api](https://openweathermap.org/api)

## How to Run

1.  **Install Dependencies**
    This downloads all the libraries required for the project (SvelteKit, Tailwind, Tesseract, etc.).
    ```bash
    npm install
    ```

2.  **Set Up Environment Variables**
    Create a `.env` file in the root directory with your API keys:
    ```bash
    # Copy the example file
    cp .env.example .env
    
    # Or create manually with:
    XAI_API_KEY=your_grok_api_key_here
    OPENWEATHER_API_KEY=your_openweather_api_key_here
    NODE_ENV=development
    ```
    
    **Note:** The `.env` file is gitignored and will not be committed. API keys are stored server-side for security.

3.  **Start Development Server**
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

4.  **Build for Production**
    To create an optimized build for deployment:
    ```bash
    npm run build
    ```

## Deployment

### Vercel Deployment

1. Push your code to GitHub
2. Import the project in Vercel
3. Add environment variables in Vercel Dashboard:
   - Go to **Settings → Environment Variables**
   - Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
   - Add `VITE_FIREBASE_*` variables (see `.env.example`)
   - Add `XAI_API_KEY` with your Grok API key
   - Add `OPENWEATHER_API_KEY` with your OpenWeatherMap API key
   - Optional: `SENTRY_DSN` and `PUBLIC_SENTRY_DSN`
4. Deploy!

The app will automatically use the environment variables from Vercel in production.

### Operations Runbook

For manual multi‑tenant/sync checks and a full deployment checklist, see:
`OPERATIONS_RUNBOOK.md`

## Project Structure

- `src/routes`: Contains the pages of your app (Capture, Validation, History, KB).
- `src/lib`: Contains utility code (Database, OCR, AI logic).
- `static`: Static assets like images.

## Key Features

- **Offline First**: Works without internet (after first load).
- **OCR**: Tesseract.js runs in the browser to read text.
- **AI**: Uses Grok API for intelligent data extraction.
