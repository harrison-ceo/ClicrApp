
# 🚀 V4.0 APP DEPLOYMENT STRATEGY

**Project Type:** Core Application (Dashboard + Auth)
**Target Domain:** `app.clicr.co` (or `v4.clicr.co` during beta)

This repository (`glacial-feynman`) contains the authenticated application logic, including:
- Supabase Integration (Auth + DB)
- Dashboard / Venue Management
- Onboarding Flows
- API Routes

## 🚫 Isolation Rules

1.  **NO Marketing Content:** Do not build public-facing marketing pages here. Those live in `vacant-intergalactic` (`clicr.co`).
2.  **Separate Env Vars:** This project REQUIRES full Supabase environment variables (`NEXT_PUBLIC_SUPABASE_URL`, service keys, etc.).
3.  **No Cross-Linking:** Do not try to import marketing components. Maintain a strict separation of concerns.

## 📦 Build & Deploy

- **Vercel Project:** Should be named `clicr-app` or similar (distinct from `clicr-marketing`).
- **Production Branch:** `main` (or `v4` during beta).

## 🔄 Relationship to Marketing Site

The marketing site (`clicr.co`) will eventually link TO this app via:
- `https://app.clicr.co/login`
- `https://app.clicr.co/signup`

Until then, this app operates in isolation.
