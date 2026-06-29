# 45 — v3 Build: Phase 3 (Sell + Deliver) + UI Refresh

**Date:** 2026-06-22

## Overview

Built **Phase 3 — the proof-of-concept milestone**: a Skill can now be sold from
a public link and delivered instantly. Plus a v3 UI refresh of the landing page
and login so the app reads as a creator storefront, not a campus swap app.
`vite build` + eslint clean; backend files pass `node --check`.

## Payments / delivery (backend)

- **`routes/checkout.js`** (new): `POST /api/checkout/:skillId/intent` — validates
  the Skill is published, not self-bought, not already owned; creates a Stripe
  **destination charge** (`transfer_data.destination` = creator's connected
  account, `application_fee_amount` = `skillFeeCents`), `automatic_payment_methods`
  on (card + Apple/Google Pay), `metadata.kind='skill'`; upserts a **pending**
  purchase. Free Skills are granted immediately (no Stripe). `POST /:skillId/confirm`
  is a fast idempotent fulfilment fallback.
- **`routes/webhooks.js`** (extended): the `payment_intent.succeeded` case now
  branches on `metadata.kind==='skill'` FIRST → marks the purchase `paid`
  (idempotency guard) + notifies the creator (`skill_purchase`), then returns;
  the existing escrow/orderId path is untouched below it.
- **`routes/locker.js`** (new): `GET /api/locker/block/:blockId/download` —
  verifies a paid purchase (or creator), mints a **60s signed URL** from the
  private `skill-files` bucket. Never returns a permanent link.
- **`index.js`**: mounted `/api/checkout` (strictLimiter + auth) and
  `/api/locker` (auth).
- Fulfilment rule honored: **the webhook is the source of truth**; client
  `/confirm` only speeds up the happy path.

## Public + buyer pages (frontend)

- **`migrations/003_public_outline.sql`** (new — ⚠️ run in Supabase): a
  `skill_block_outline` view exposing ONLY `type/title/position` for published
  Skills, so anon sales pages can show "what's inside" without `content_blocks`
  RLS leaking gated content.
- **`lib/profiles.js`** (new): `getProfileByUsername`. **`lib/skills.js`**: added
  `getPublicSkill` (published meta + safe outline). **`lib/purchases.js`**: wired
  `startCheckout` / `confirmCheckout` / `getBlockDownloadUrl` to the real
  endpoints.
- **`Storefront.jsx`** (`/@username`): public link-in-bio — avatar/name/bio +
  published-Skill list; fires `storefront_view`.
- **`SkillPublic.jsx`** (`/@username/:skillId`): sales page — cover/title/outcome,
  "what's inside" outline, sticky buy bar (Get access / Open in Locker if owned /
  Edit if own); fires `skill_view`; routes anon → login w/ `?redirect`.
- **`Checkout.jsx`** (`/checkout/:skillId`): Stripe **Payment Element** +
  `confirmPayment({redirect:'if_required'})`; free path skips Stripe; on success
  → `/confirm` then Locker; fires `checkout_start` + `purchase`.
- **`components/BlockRenderer.jsx`** (new): buyer renderer per type — YouTube/Vimeo
  embed, copy-to-clipboard prompts, signed-URL downloads, guides, coaching link;
  fires `block_open`.
- **`Locker.jsx`** (rewritten): list of paid purchases (with "Updated to vN"
  badge) + consumption view (`/locker/:skillId`) rendering all blocks; creator
  can preview own Skill; community space shown as a Phase-4 placeholder.
- **`main.jsx`**: added `/checkout/:skillId` and `/@username/:skillId`
  (`SkillPublic`, last before catch-all).

## UI refresh (v3 branding)

- **`Home.jsx`**: rewrote hero / how-it-works / features / footer CTA from campus
  skill-swap → "sell your skills from one link." Removed the swap-pairs feed
  (dropped `PairCard` import) and the fabricated campus stats; logged-in users now
  land on `/build`.
- **`Login.jsx`**: honors `?redirect=`, defaults post-auth to `/build` (not
  `/matches`), sends users without a `username` to onboarding, v3 copy + generic
  email placeholder.

## Action required (Devan)
- Run **`migrations/003_public_outline.sql`** in Supabase (after 001/002).
- Stripe: ensure `VITE_STRIPE_PUBLISHABLE_KEY` (frontend) + `STRIPE_SECRET_KEY` /
  `STRIPE_WEBHOOK_SECRET` (backend) are set; test the full buy → webhook → access
  loop with Stripe **test** keys. Destination charges require the creator's
  Connect account to be onboarded (reuses existing `/api/stripe-connect`).
- All three migrations (001/002/003) must be applied for the loop to work.

## Open / deferred
- Membership (recurring) checkout still one-time only — Stripe Subscriptions are
  Phase 4/5 (doc 04).
- Redirect-based payment methods land on `/locker/:id` via `return_url` but the
  Locker doesn't yet read `payment_intent` status from the URL (cards/Apple/Google
  Pay don't redirect, so fine for MVP).

## Next
Phase 4 — versioning (`POST /api/skills/:id/version` + buyer notify, "publish
update" button) and the per-Skill community space (`community.js` UI +
`CommunityThread.jsx`, the placeholder in the consume view). See doc 07.
