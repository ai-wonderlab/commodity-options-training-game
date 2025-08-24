# Commodity Options Training Game (ICE Brent — Black-76)

Desktop-first, browser-only training game for EU-style Brent options (BUL) on ICE Brent futures (BRN). Static web (Next.js SSG) + Supabase (EU) for DB/Auth/Realtime + Edge Functions.

Education-only. Prices 15‑min delayed placeholder. Not for production trading.

## Monorepo
- `apps/web`: Next.js SSG (no SSR) exported for GitHub Pages
- `packages/shared`: TypeScript quant/risk library (Black‑76 pricing, Greeks, VaR, scoring)
- `supabase/functions`: Edge Functions (Deno)
- `supabase/migrations`: SQL schema, RLS, seeds

## Quick Start (Admin)
1) Clone or open in Cursor. Node 18+ recommended.
2) Install deps and build workspaces:
```bash
npm install
npm run build --workspaces
```
3) Local dev web:
```bash
cd apps/web && npm run dev
```
4) Security Pause C1 (EU project + secrets)
- Create a Supabase project in EU region.
- Add these GitHub repo secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ACCESS_TOKEN`, `PROJECT_REF`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Reply "C1 done" in the task to continue.
5) After C1: we will link the Supabase project, run migrations, and deploy Edge Functions.
6) Security Pause C2 (OAuth)
- Enable Google + Microsoft in Supabase Auth Providers and paste client IDs/Secrets.
- Reply "C2 done" to continue.

## Compliance
- Region: EU only.
- Language: English only.
- Education-only training tool. Includes ICE delayed attribution placeholder.

## Scripts
- `npm run build --workspaces` — builds all workspaces
- `apps/web`: `next build && next export`

## License
Educational use only. © Your Organization.