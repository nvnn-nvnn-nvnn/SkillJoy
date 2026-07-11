# 52 — v3 Build: Phase 9 (Email Capture + Marketing)

**Date:** 2026-06-23

## Overview

Built **Phase 9 — email capture + marketing**: storefront lead capture,
subscriber management with CSV export, and broadcast email to subscribers via
Resend. `vite build` + eslint + `node --check` clean.

## What changed

- **`migrations/008_email_marketing.sql`** (new — ⚠️ run in Supabase after
  001–007): `subscribers` (creator_id, email, name, source; unique per
  creator+email; anon INSERT allowed, creator-only read/delete) + `broadcasts`
  log (creator-read; inserted server-side after send).
- **`lib/subscribers.js`** (new): `subscribe` (idempotent upsert), `listSubscribers`,
  `deleteSubscriber`, `sendBroadcast` (→ backend), `isEmail`.
- **`components/SubscribeForm.jsx`** (new): storefront capture card → wired into
  `Storefront.jsx` below the Skill list. Anon visitors can subscribe (RLS allows).
- **`backend/routes/marketing.js`** (new, mounted `/api/marketing` w/ auth +
  strictLimiter): `POST /broadcast` — loads the creator's subscribers
  (service role), sends one email per recipient via `lib/email` Resend (parallel,
  `Promise.allSettled`, recipients not leaked to each other), logs a `broadcasts`
  row, returns `{ sent, failed }`. If all fail (e.g. no `RESEND_API_KEY`), returns
  502 with the reason.
- **`components/AudiencePanel.jsx`** (new, on Dashboard): subscriber count, CSV
  export, and a subject+body broadcast composer with send confirmation.

## Decisions / limits
- **Sending requires `RESEND_API_KEY`** (+ ideally a verified `RESEND_FROM`
  domain; falls back to Resend's shared `onboarding@resend.dev`, which only
  delivers to the Resend account owner until a domain is verified). Capture,
  list, and CSV export work with **no** email config.
- MVP marketing = manual broadcasts only. **Lifecycle automations**
  (post-purchase welcome, abandoned-checkout) are deferred — the broadcast +
  subscriber infra is the foundation for them.
- One email per recipient (privacy); no unsubscribe link yet (add before real
  sending for compliance — noted).

## Action required (owner)
- Run **`migrations/008_email_marketing.sql`** (now 8 migrations: 001–008).
- To actually send broadcasts: set `RESEND_API_KEY` (and verify a domain +
  `RESEND_FROM`) in the backend env.

## Not verified
- Build/lint/syntax only. Capture form not yet driven live (migration 008
  unapplied); broadcast send not exercised (no Resend key).
- ⚠️ Add an **unsubscribe mechanism** before sending real marketing email
  (CAN-SPAM / GDPR). Tracked for Phase 10/12.

## Next
Phase 10 — commerce depth (discounts/promo codes, refunds UI, receipts, Stripe
Tax). Then 11 (pixels/AutoDM/affiliates), 12 (SEO/integrations/admin). Or the
deferred payment-loop verification (Stripe test keys). See doc 08.
