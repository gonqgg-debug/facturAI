# Operations Runbook (No Billing)

This document captures the manual checks and deployment steps needed to continue the plan without Stripe.

## Manual Tests: Multi‑Tenant & Sync

### Tenant Isolation
1. Create two Firebase accounts (A and B).
2. Sign in as A, create a store, add a product named `TenantA Product`.
3. Sign out and sign in as B, create a store, verify you cannot see `TenantA Product`.
4. Invite B to A’s store via Team Invites.
5. Accept the invite as B and verify B can now see `TenantA Product`.
6. Verify B cannot see data from a third store (if available).

### Sync Between Devices
1. Sign in as the same account on two browsers/devices.
2. On device 1, create a new product and a new sale.
3. Wait for sync (15s interval) and verify device 2 receives both records.
4. Update the same product on both devices (small change) and confirm last‑write wins.
5. Go offline on device 2, create a change, go online, verify it syncs.

### Results Template
```
Date:
Tester:
Tenant Isolation: PASS/FAIL
Invite Access: PASS/FAIL
Sync Between Devices: PASS/FAIL
Conflict Resolution: PASS/FAIL
Notes:
```

## Deployment & Ops (Fast Path)

### GitHub
1. Create a GitHub repository.
2. Add remote and push:
   - `git remote add origin <repo_url>`
   - `git push -u origin main`

### GitHub Secrets (CI/CD)
Add these repo secrets:
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
- `XAI_API_KEY` (optional for E2E)
- `OPENWEATHER_API_KEY` (optional for E2E)

### Vercel Environment Variables
Set these in Vercel (Project Settings → Environment Variables):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID`
- `VITE_FIREBASE_VAPID_KEY` (optional)
- `XAI_API_KEY`
- `OPENWEATHER_API_KEY`
- `SENTRY_DSN` (optional)
- `PUBLIC_SENTRY_DSN` (optional)

### Smoke Checks
1. `/api/health` returns `200`.
2. Login works with email and Google.
3. Sync initializes and store context sets without errors.
4. Core pages load: `/dashboard`, `/catalog`, `/sales`, `/settings`.

## Troubleshooting (Quick)

- **Firebase not configured**: verify all `VITE_FIREBASE_*` env vars are present.
- **Supabase errors**: verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- **Sync not running**: re‑login to re‑register device; check console for `set_store_context`.
- **E2E failures**: disable external API tests or add `XAI_API_KEY` and `OPENWEATHER_API_KEY`.

