# 54 — v3 Build: Phase 12 (SEO, Unsubscribe, Admin Payout-Hold)

**Date:** 2026-06-23

## Overview

Built the highest-value, lowest-risk slice of **Phase 12 (polish/differentiators)**:
SEO meta tags, the email **unsubscribe** compliance carryover, and the
**admin payout-hold** tool that completes the trust-layer promise. No DB
migration. `vite build` + eslint + `node --check` clean.

## What changed

### SEO
- **`src/components/Seo.jsx`** (new): renders `<title>` + description + Open
  Graph + Twitter-card meta (React 19 hoists them to `<head>`). Used on
  **Storefront** (type `profile`, banner/avatar image) and **SkillPublic**
  (type `product`, cover image).
- **`index.html`**: default description + OG/site_name/twitter meta.
- **`public/robots.txt`**: allow public storefronts; disallow app/auth surfaces
  (build, dashboard, locker, checkout, storefront/edit, admin, settings).
- ⚠️ **Caveat (documented in Seo.jsx):** client-rendered meta helps JS-executing
  crawlers (Google) but NOT most social-card scrapers. Fully correct share cards
  need server-side/prerendered meta on `/@username` + sales routes — a serverless
  meta injector is the follow-up (ties back to the Next.js/SSR question in doc 03).

### Email unsubscribe (compliance carryover from Phase 9)
- **`backend/lib/unsub.js`** (new): HMAC `unsubToken(creatorId, email)` (secret =
  `UNSUBSCRIBE_SECRET` || service key) so links can't be forged.
- **`backend/routes/public.js`** (new, mounted `/api/public` **without auth**):
  `POST /unsubscribe { c, e, t }` — verifies token, deletes the subscriber.
- **`backend/routes/marketing.js`**: broadcast emails now include a per-recipient
  **Unsubscribe** link in the footer.
- **`src/app-pages/Unsubscribe.jsx`** (new, route `/unsubscribe`): public landing
  that calls the backend and confirms.

### Admin payout-hold (completes the trust layer, doc 06)
- **`backend/routes/admin.js`**: `POST /payout-hold { userId, held, reason }`
  (ADMIN_EMAIL-guarded) — sets `profiles.payout_held` + `payout_hold_reason` and
  **notifies the creator** (no silent freeze). `PayoutStatus.jsx` already renders
  this hold to the creator.
- **`src/app-pages/AdminPayouts.jsx`** (new, route `/admin/payouts`): look up a
  creator by @username, place/clear a hold with a reason. Email-gated client-side;
  backend enforces ADMIN_EMAIL.

## Deferred (still part of Phase 12 scope, not built)
- **Stripe Tax** (needs tax registration + address collection config).
- **Outbound integrations** (Zapier / webhooks-out), physical products, richer
  attribution.
- **Server-side prerender** for social share cards (the real SEO completion).
- Phase **11** (pixels / AutoDM / affiliate program) — skipped per the owner; can
  return to it.

## Verify
- `vite build` ✅ · `node --check` on all touched backend files ✅ · new frontend
  files eslint-clean. (Pre-existing `main.jsx` App/AppRoutes fast-refresh lint
  warnings remain — unrelated.)

## Not verified at runtime
- Build/syntax only. Unsubscribe round-trip, OG tag rendering, and the admin
  hold→PayoutStatus display not yet driven live.

## Next
Phase 11 (pixels/AutoDM/affiliates) if desired, the deferred Phase-12 items
(Stripe Tax, prerender, integrations), or — recommended — the **payment-loop
verification** with Stripe test keys. See doc 08.
