# 50 — Smoke Test: No-Payment Loop (+ 2 bugs fixed)

**Date:** 2026-06-23

## Overview

First real runtime verification of v3. Drove the full **no-payment creator
loop** headlessly with Playwright against the live Supabase (migrations 001–006
applied). Found and fixed two bugs. Loop now passes end-to-end.

## Method
- Booted backend (`:3001`) + Vite (`:5173`) as background tasks. Backend needed
  `npm install` in `backend/` + a placeholder `RESEND_API_KEY` (lib/email.js
  constructs `new Resend(key)` at import — throws if absent).
- Created a pre-confirmed test user via the Supabase **admin API** (service key,
  `email_confirm:true`) to skip email confirmation.
- Playwright script (`scratchpad/pw/smoke.mjs`) drove: login → onboarding
  (name + `@username` w/ live availability) → `/build` create Skill → fill
  title/outcome/price + add prompt block → Publish → `/@username` storefront →
  sales page → `/storefront/edit` theme editor. Screenshot at each step.

## Pre-flight DB checks (anon key, via PostgREST)
All 6 migrations confirmed live: every new table + the `skill_block_outline`
view + new columns return 200. RLS correct: anon INSERT to `skills`/`purchases`
→ **401**; anon query of `status=draft` skills → **[]** (no leak).

## Bugs found & fixed

### 🐛 1 — Autosave dropped fields (data loss) — FIXED
`SkillBuilder` debounced skill + block saves with a single timer that captured
**only the latest patch** and `clearTimeout`-cancelled the previous. Editing
several fields within the 600ms window persisted only the last one. Observed:
set title + outcome + price → storefront showed "**Untitled Skill** · $29"
(only price, the last patch, saved); block title also lost (outline showed the
fallback label "Prompt").
**Fix:** accumulate merged patches in `pendingSkill` / `pendingBlock` refs and
save the accumulator; also best-effort flush on unmount so a quick navigate-away
doesn't drop the last edit. Re-run → storefront shows "Ship Your First AI App",
outline shows "Starter system prompt". ✅

### ⚠️ 2 — Footer still v1 — FIXED
`Footer.jsx` still read "The campus marketplace for skill swaps and paid gigs"
with Browse Gigs / Skill Swaps / My Listings / My Orders links. Updated tagline
to v3 and gated the gig/swap links behind `LEGACY_MODE`; default shows Start your
store / Build a Skill / How It Works.

## Result — PASS
Login, onboarding (+username availability), Skill create/edit/publish, storefront
render (themed), public sales page (anon-safe outline), and the theme editor all
work against the live DB. Screenshots in `scratchpad/pw/0?-*.png`.

## Still unverified
- **Payment loop** (one-time + subscription checkout, webhook fulfilment,
  signed-URL download) — needs Stripe test keys + Stripe CLI webhook forwarding.
  Not exercised here.
- Onboarding still walks v3 creators through the legacy teach/learn/availability
  steps (not required, but friction) — candidate cleanup.

## Env notes for local run
`backend/`: `npm install`, set `RESEND_API_KEY` (any value to boot). Frontend
`.env` has no `VITE_API_URL` (defaults to localhost:3001 — fine). `FRONTEND_URL`
in backend `.env` is `http://localhost:5173`, so run Vite on 5173 for CORS.
