# 59 — Core features: implementation checklist & log

Living checklist for getting the 5 core must-haves to "actually works." Status keys:
✅ done · 🟡 partial · ⬜ not started · 🔧 operational (not code).

---

## Critical path to "it works" (do in this order)

1. ✅ **Apply migrations 001–011** in Supabase SQL editor. *(Done 2026-06-30 —
   ran full 001→011 catch-up; `kind`, `booking_minutes`, etc. now present.)*
2. ✅ **Emit view events.** *(Already wired — `Storefront.jsx:35` emits
   `storefront_view`, `SkillPublic.jsx:33` emits `skill_view`. Earlier audit was
   wrong; events flow.)*
3. ✅ **Wire analytics into `/services`.** *(Done 2026-06-30.)* Dashboard now loads
   `getCreatorEvents(user.id)`; per-card **Views** = `skill_view` count, **Conv.** =
   sales/views, and the top **Views** stat = storefront_view + skill_view. Card
   Conv. shows `—` until a product has views.
4. ⬜ **Mobile storefront pass** on `Storefront.jsx` + `SkillPublic.jsx` (sticky buy
   button, single-column, fast). This is the surface buyers actually see.

After 1–4, the buyer→checkout→analytics loop is real end to end.

---

## Core must-haves

### 1. Mobile-first storefront — 🟡
- [x] Public storefront page exists (`Storefront.jsx`, `/@handle`)
- [x] Public product page exists (`SkillPublic.jsx`, `/@handle/:skillId`)
- [ ] Mobile audit + polish (sticky CTA, single-column, image sizing)
- [ ] Fast load (lazy images, minimal blocking)

### 2. Digital product sales — 🟡
- [x] Build a Skill w/ mixed content blocks (`SkillBuilder.jsx`, `blockTypes.js`)
- [x] Sell digital + coaching; product `kind` field (mig 011)
- [x] Memberships via hosted Stripe subscription (`Checkout.jsx`)
- [x] Free products → instant grant
- [ ] Course kind (modules/lessons/progress) — `built: false`
- [ ] Lead magnet kind (free + email capture; `subscribers.js` exists) — `built: false`
- [ ] Webinar / bundle kinds — `built: false`

### 3. Simple checkout — 🟡
- [x] One-tap Stripe Payment Element (`Checkout.jsx`)
- [x] Discount/promo codes (`discounts.js` CRUD + `validateCode`)
- [x] Free + membership paths
- [ ] Order bumps / upsells at checkout
- [ ] Payment plans (split payments)
- [ ] Fee/take-rate shown transparently on the checkout screen

### 4. Brand control — 🟡
- [x] Storefront editor (`StorefrontEditor.jsx`) + `storefront_theme` JSONB
- [x] Banner/cover uploads (`storage.js`)
- [ ] Full theming (colors/layout presets) surfaced in the editor
- [ ] Custom domain (DB field + DNS verify flow) — bigger lift
- [ ] White-label polish (remove default chrome on custom domains)

### 5. Analytics — 🟡 (infra exists, not surfaced)
- [x] Event recorder + queries (`analytics.js`: recordEvent/getCreatorEvents/
      getSkillEvents/toFunnel) and `AnalyticsCards.jsx`
- [x] `checkout_start`, `purchase`, `block_open` emitted
- [x] Emit `storefront_view` + `skill_view` (already wired in Storefront/SkillPublic)
- [x] Per-product views + conversion in `/services` (live 2026-06-30)
- [ ] Funnel view (views → checkouts → purchases) per product — drill-down still TODO

---

## Trust & operations (secondary, pre-revenue-at-scale)
- [x] Stripe Connect payouts + balance + dashboard link (`payouts.js`, `PayoutStatus`)
- [x] Server-side refund (`refundPurchase`)
- [x] Signed file delivery for owners (`getOwnerFilePreviewUrl`); buyer download exists
- [ ] Transparent fee + payout-timeline copy (PayoutStatus / checkout)
- [ ] Buyer-facing refund request + delivery-issue report UI
- [ ] Download limits / access revocation on refund

## Growth (after MVP)
- [x] Email capture + list + broadcast (`subscribers.js`: subscribe/list/sendBroadcast)
- [x] Pixel tracking scaffolding (`pixels.js`, `tracking_pixels`)
- [ ] Auto-DM / social share flows
- [ ] Affiliate links + payout split (new schema)
- [ ] Limited-time offers / scarcity

---

## ⚠️ DB migration drift (recurring gotcha)
Runtime errors like `column content_blocks.booking_minutes does not exist` (mig 007)
and the `skills.kind` need (mig 011) mean **the live Supabase DB is behind the repo
migrations**. There is no migration runner — apply by hand in the Supabase SQL editor.
**Fix once:** run every file in `docs/v3-skill-platform/migrations/` in order,
**001 → 011**. All are idempotent (`IF NOT EXISTS` + `DROP POLICY IF EXISTS`), so
re-running already-applied ones is harmless. Do this before testing `/build`,
`/services`, booking, etc.

## Activity log
- **2026-06-30** — Critical path #3 ✅: wired real analytics into `/services`
  (per-card Views/Conv + top Views stat from `getCreatorEvents`). Found #2 was
  already done (view events emitted in Storefront/SkillPublic). Lint + build green.
  Next critical-path item: **#4 mobile storefront pass**.
- **2026-06-30** — Migrations 001→011 applied; app loads cleanly. Critical path #1 ✅.
  Next: emit view events (#2) + wire analytics into /services (#3).
- **2026-06-30** — Hit `content_blocks.booking_minutes` missing (mig 007 not applied)
  → diagnosed DB migration drift; documented the 001→011 catch-up above.
- **2026-06-30** — Core-features audit; wrote this checklist (note 59). Confirmed
  analytics infra exists but view events aren't emitted; `/services` views are stubbed.
- **2026-06-30** — De-campus pass (note 57): Profile/Onboarding/Settings/About/
  HowItWorks pivoted off swap/gig/college. Profile trimmed to an account hub.
- **2026-06-30** — `/services` dashboard: real data + product `kind` (mig 011),
  then mobile-first responsive pass. Storefront-hub vision + roadmap (note 58).
- **(prior)** — notes 42–56: v3 skill-platform build-out (builder, checkout,
  payouts, storefront editor, booking, email, commerce, growth, services kinds).

## Open questions
- Which dashboard was "fucked up" — `/services` (fixed) or `/dashboard` (buyers
  table still needs a mobile pass)?
- Custom domain: in MVP scope, or fast-follow? (biggest single lift here.)
