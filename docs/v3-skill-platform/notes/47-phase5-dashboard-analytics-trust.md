# 47 — v3 Build: Phase 5 (Dashboard + Analytics + Trust)

**Date:** 2026-06-22

## Overview

Built **Phase 5 — the creator dashboard**, completing the v3 MVP build arc
(Phases 0–5). `vite build` + eslint clean. The end-to-end loop from the
Definition of Done (doc 02) now exists in code.

## What changed

- **`migrations/004_payout_trust.sql`** (new — ⚠️ run in Supabase after 001–003):
  `profiles.payout_held` + `payout_hold_reason`. Human-set only; no automated
  code path flips them. Backs the "no silent freeze" promise honestly.
- **`lib/purchases.js`**: `listCreatorSales(creatorId)` — all paid purchases
  across the creator's Skills (revenue + buyer list), via a `skills!inner` filter
  on `creator_id` (RLS lets the creator read these).
- **`lib/payouts.js`** (new): thin wrappers over the existing
  `/api/stripe-connect` routes (`status`, `balance`, `onboard`, `dashboard-link`)
  — reused from v1, no backend changes needed.
- **`components/PayoutStatus.jsx`** (new): onboarding CTA when not connected; live
  Available / On-the-way balance; "Open payout dashboard" link; the trust promise
  copy; and a verbatim **hold notice** when `payout_held` is set.
- **`components/AnalyticsCards.jsx`** (new): funnel (views → checkouts →
  purchases) + conversion %, content opens, engaged-buyer count — off
  `analytics_events` (client-side rollup via `getCreatorEvents`).
- **`app-pages/Dashboard.jsx`** (rewritten from stub): revenue / sales / buyers
  stat row, Analytics + PayoutStatus two-column, and an exportable **buyers
  table (CSV)**.

## Verify
- `vite build` ✅ · eslint ✅ on all Phase 5 files.

## Action required (owner)
- Run **`migrations/004_payout_trust.sql`** in Supabase. (All four migrations
  001–004 now needed.)
- Analytics only populate once real events fire (views/checkouts/purchases) — a
  fresh DB shows zeros, which is correct.

## Definition of Done (doc 02) — status
Sign up → connect payouts → build a Skill with mixed content → publish at
`/@you` → share → buyer purchases on mobile → instant permanent access →
creator updates the Skill, buyers see v2 → both use the community space →
creator sees sales, payouts & analytics with trustworthy payout status.
**All steps now implemented.** Remaining before "launch-ready" is wiring +
testing, not missing features (see below).

## Not yet done (post-build / parity)
- **Memberships**: checkout is one-time only; Stripe Subscriptions deferred (doc 04).
- **Storefront theming / bio links**: `storefront_theme` column still unused.
- **Verification**: the full Stripe loop (Connect onboarding → destination charge
  → webhook fulfilment → signed-URL delivery) has NOT been run end-to-end with
  test keys yet. All four migrations must be applied first.
- Bundle size warning (>500 kB) — cosmetic; consider route-level code-splitting
  later.

## Build arc complete
Phases 0–5 are in code: 0 legacy-park, 1 foundation, 2 builder, 3 sell+deliver,
4 versioning+community, 5 dashboard. Notes 43–47. Next session is verification +
the two parity gaps (subscriptions, theming) if desired.
