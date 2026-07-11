# 55 — v3 Build: Phase 11 (Growth / Automation)

**Date:** 2026-06-23

## Overview

Built the buildable parts of **Phase 11 (growth/automation)**: per-storefront
**tracking pixels** (Meta/TikTok/GA4) and an **outbound automation webhook** that
fires on each sale (so creators wire Zapier/Make/AutoDM tools). `vite build` +
eslint + `node --check` clean. This is the last parity phase — 0–12 now built.

## What changed

- **`migrations/010_growth.sql`** (new — ⚠️ run after 001–009):
  `profiles.tracking_pixels` (jsonb `{meta,tiktok,ga4}`) + `automation_webhook_url`.
- **`src/lib/pixels.js`** (new): `injectPixels({meta,tiktok,ga4})` — injects the
  Meta/TikTok/GA4 snippets once and fires PageView. Called on **Storefront** and
  **SkillPublic** (creator's pixels, from `getProfileByUsername` which now selects
  `tracking_pixels`).
- **`StorefrontEditor.jsx`**: new "Tracking & automation" section — Meta/TikTok/GA4
  pixel IDs + the automation webhook URL; saved via an extended `updateStorefront`.
- **`backend/lib/webhookout.js`** (new): `fireAutomation(creatorId, event, data)`
  — fire-and-forget POST to the creator's `automation_webhook_url`.
- **`backend/routes/webhooks.js`**: fires `{ event:'sale', data }` on both
  one-time (`payment_intent.succeeded`) and membership
  (`checkout.session.completed`) fulfilment.

## Decisions / deferred
- **Pixels fire PageView** for retargeting-audience building (the core value).
  **Purchase-conversion attribution** is a follow-up — the buyer leaves the
  pixel'd page for the app checkout, so a Purchase event needs the pixel on the
  post-purchase surface or a server-side Conversions API. Noted in pixels.js.
- **Native AutoDM / social automation** (Instagram/TikTok "comment-to-DM") is NOT
  built — it needs Meta/TikTok OAuth apps + platform approval. The **outbound
  webhook is the pragmatic substitute**: creators build those flows in
  Zapier/Make/ManyChat off our `sale` event.
- **Full affiliate program** (referrer payouts via Connect transfers) NOT built —
  affiliate *links* (creator promoting others) already exist from Phase 7
  (`store_links.is_affiliate`). A referrer-payout program is a future phase.

## Action required (owner)
- Run **`migrations/010_growth.sql`** (now 10 migrations: 001–010).
- Pixels/webhook are opt-in per creator (Storefront editor → Tracking & automation).

## Not verified
- Build/syntax only. Pixel injection + webhook firing need a live run (webhook
  firing rides on the Stripe payment loop — still pending the test pass).

## Parity status — roadmap complete (0–12)
0 legacy-park · 1 foundation · 2 builder · 3 sell+deliver · 4 versioning+community
· 5 dashboard · 6 memberships · 7 storefront editor · 8 booking · 9 email · 10
discounts/refunds/receipts · 11 pixels+automation · 12 SEO/unsubscribe/admin.

**Deferred across phases (future work):** Stripe Tax, SSR/prerender for social
share cards, native AutoDM, affiliate-payout program, lifecycle email automations,
physical products.

## Next — strongly recommended
**Verify the payment loop end-to-end with Stripe test keys** (the owner said they'll
set up a test space). It underpins phases 3/6/10/11 and has never run live.
