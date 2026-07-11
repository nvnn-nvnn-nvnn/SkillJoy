# 111 — Platform paywall: subscription + publish gate (Phase 1 of note 108)

_2026-07-10. Built on Fable 5 from the Opus audit prompt (notes 108/110)._

## What this is

The business model: **creator pays SkillJoy** (direct charge on SkillJoy's own
Stripe account — NO Connect) + the pre-existing 5% per-sale `application_fee`.
Signup/build/customize stay free; the card is captured and a **14-day trial**
starts at the **publish** moment. Everything is enforced server-side.

Kept strictly isolated from creator memberships (`kind:'skill_sub'`, fan →
creator via Connect) with a new metadata tag **`kind:'platform_sub'`** on every
Stripe object, plus a runtime `assertNoConnectParams()` guard that throws if a
Connect param ever appears on the platform path.

## Changes

- **`migrations/021_platform_subscriptions.sql`** (+ mirrored into
  `supabase/schema.sql`) — `platform_subscriptions` table (one row per creator,
  owner-READ-only RLS, writes service-role-only); replaces the skills
  "Published skills are public" policy so public read requires the creator's
  sub to be `trialing|active` (lapse ⇒ storefront dark automatically, no cron);
  a `skills_enforce_server_publish` trigger blocks client roles from
  *transitioning* status → 'published' (service role passes). Includes a
  commented **backfill** block to grandfather existing published creators.
- **`backend/lib/platformSub.js`** — `getPlatformSub` / `isPlatformLive` /
  `assertNoConnectParams` (the isolation regression guard).
- **`backend/routes/billing.js`** (mounted `/api/billing`, auth + strict
  limiter) — `POST /subscribe` (create-or-reuse Customer, hosted Checkout,
  `trial_period_days:14`, `payment_method_collection:'always'`),
  `POST /portal` (Stripe billing portal), `GET /status` (drives banners).
  Reads **`STRIPE_PLATFORM_PRICE_ID`** from env.
- **`backend/routes/skills.js`** — new `POST /:skillId/publish`: ownership →
  profile complete (full_name, username, phone; 400 `PROFILE_INCOMPLETE`) →
  live sub (402 `SUBSCRIPTION_REQUIRED`) → sets status='published'.
- **`backend/routes/checkout.js` + `guest.js`** — both intents re-check
  `isPlatformLive(creator)` (403 'storefront unavailable'): these routes read
  with the service key, so RLS alone wouldn't stop a direct API purchase from
  a lapsed storefront.
- **`backend/routes/webhooks.js`** — `platform_sub` branches in
  `checkout.session.completed` (upsert row from the retrieved subscription) and
  `customer.subscription.updated/deleted` (status + period fields); new
  `invoice.payment_failed` handler → `past_due` + in-app notification + dunning
  email, idempotent via the `.neq('status','past_due')` guard. Membership
  invoices don't match the platform_subscriptions lookup and fall through.
- **Frontend** — `src/lib/billing.js` (status/subscribe/portal/trialDaysLeft);
  `publishSkill()` now calls the endpoint and throws typed errors;
  SkillBuilder + ServicesDashboard catch `SUBSCRIPTION_REQUIRED` → "Start your
  free trial" confirm → Stripe Checkout; `components/TrialBanner.jsx` on the
  Dashboard (trial countdown / active + Manage billing / paused + fix-it).

## Deviations from the prompt (deliberate)

1. **Buyer branch added to the skills SELECT policy.** As specced, a creator's
   lapse would have broken their existing buyers' Locker (the Locker reads
   `skills` through the anon-key client). Paid buyers now always read skills
   they own.
2. **Trigger instead of WITH CHECK** for revoking client publish. A plain
   `WITH CHECK (status <> 'published')` rejects legitimate client edits to
   already-published rows (title/price/`sort_order` reorders keep
   status='published' in the NEW row). The trigger blocks only the
   *transition* into 'published' for `authenticated`/`anon` roles.
3. **Checkout guards added** (checkout.js/guest.js) — the prompt asked to
   "verify checkout 404s a lapsed skill", but those routes bypass RLS via the
   service key, so the check had to be added explicitly.

## Opus review correction (2026-07-10) — RLS was broken as first written

Reviewing Fable's deviation #1, the `skills` SELECT policy had two bugs that
`vite build` / `node --check` can't catch (they only fire against Postgres, so
they'd have surfaced on first live query after 021 ran):

1. **Branch 3 (platform_subscriptions) made the public storefront invisible.**
   The inline `EXISTS` on `platform_subscriptions` runs under that table's
   owner-read-only RLS (`user_id = auth.uid()`), so for any public/anon viewer
   it's always false → NO published skill visible to anyone but the creator.
2. **Branch 2 (purchases) formed a mutual RLS recursion.** `skills → purchases`
   plus the existing `purchases → skills` (001) is a cycle → Postgres
   "infinite recursion detected in policy for relation skills".

**Fix (amended directly into 021, still unapplied):** replaced both inline
sub-SELECTs with `SECURITY DEFINER` helpers `public.creator_is_live(uuid)` and
`public.has_paid_purchase(uuid)`, which bypass the referenced table's RLS
(breaking the cycle + the visibility trap) while `auth.uid()` still resolves to
the caller. `has_paid_purchase` only checks the caller's own rows → no leak;
`creator_is_live` exposes only whether a storefront is up (already public info).
Buyer-branch confirmed necessary: `listMyPurchases` embeds `skill:skills(...)`
via the anon client, so the Locker reads `skills` under RLS. schema.sql mirror
updated to match.

## Deploy-safety: code self-defers on STRIPE_PLATFORM_PRICE_ID (Opus, 2026-07-10)

After 022 deferred the paywall at the DB level, the *app code* still assumed it
was armed — deploying it while Stripe was unconfigured would have 403'd every
checkout (`isPlatformLive` false for all creators) and 402'd every publish. So
enforcement is now gated in code on `paywallEnabled()` = `!!STRIPE_PLATFORM_
PRICE_ID` (`backend/lib/platformSub.js`), keyed on the same signal 022 uses:

- `checkout.js` + `guest.js` — the `isPlatformLive` 403 guard only runs when the
  paywall is enabled.
- `skills.js` publish endpoint — the profile-complete + live-sub gate only runs
  when enabled; dormant, publishing needs just ownership (pre-paywall behavior,
  now server-side via the endpoint instead of a client status flip).

Net: **this branch is safe to deploy in any order.** Price id unset → app
behaves exactly as pre-paywall. Price id set + migration 023 (re-arm) run →
code enforcement and DB gate flip on together. `node --check` clean.

## Action required (owner) — nothing works until these are done

1. **⚠️ TODO / BLOCKED (2026-07-10): create the Stripe platform Price.**
   The owner's phone is missing, so Stripe dashboard access (2FA) is blocked — the
   platform Product + monthly Price can't be created yet. Until then
   **`STRIPE_PLATFORM_PRICE_ID` is unset** and `/api/billing/subscribe` returns
   a clean 500 ('Billing isn’t configured yet') — the rest of the app is
   unaffected. When access is restored: create the Product + monthly Price on
   SkillJoy's OWN account (NOT Connect) → set `STRIPE_PLATFORM_PRICE_ID` in
   `backend/.env` → restart the backend. Decide the monthly price (note 108:
   cheap enough that one sale makes it obviously worth it).
2. **Run `migrations/021_platform_subscriptions.sql`** in the Supabase SQL
   editor. ⚠️ Read the backfill section first — without it, every
   already-published storefront goes dark the moment the migration runs.
   ⚠️ **Sequencing:** do NOT run 021 until item 1 is unblocked — with the
   migration applied but no `STRIPE_PLATFORM_PRICE_ID`, storefronts go dark
   (or run on backfill trials) with **no way for anyone to subscribe**. Deploy
   order: Stripe price → env var → migration (with backfill) → sandbox test.
3. **Stripe webhook config:** confirm the endpoint subscribes to
   `invoice.payment_failed` (the `checkout.session.completed` and
   `customer.subscription.*` events should already be on from memberships).
4. **Enable the Billing Portal** in Stripe settings (Settings → Billing →
   Customer portal) or `/api/billing/portal` will error.
5. Sandbox test the four acceptance flows (below).

## Acceptance walkthrough (code-traced; needs live sandbox confirmation)

1. **No sub ⇒ can't publish** — endpoint 402s; the old client-side flip is
   blocked by the trigger. ✅ by construction once 021 runs.
2. **Publish starts trial + card capture** — 402 → confirm → hosted Checkout
   (card required, day-14 first charge) → webhook records `trialing` → creator
   clicks Publish again and goes live. (Known small UX gap: publish doesn't
   auto-resume after returning from Stripe — the creator re-clicks Publish.)
3. **Cancel hides storefront, buyers keep access** — RLS public branch fails,
   buyer branch + content_blocks purchases policy keep owned content readable;
   checkout intents 403. ✅
4. **Guest path can't create a platform sub** — guest.js only creates one-time
   PaymentIntents (`kind:'skill_guest'`); platform subs live behind auth at
   /api/billing; `assertNoConnectParams` + metadata-kind webhook branching. ✅

`vite build` ✅ · `node --check` clean on all touched backend files.

## Dunning race — FIXED (Opus, 2026-07-10)
`invoice.payment_failed`'s `.neq('status','past_due')` guard was doing double
duty: redelivery-idempotency AND the "send the dunning notification/email"
gate. On a trial-ending charge failure Stripe fires BOTH `invoice.payment_failed`
and `customer.subscription.updated` (→ past_due) with no guaranteed order; if
`subscription.updated` set past_due first, the invoice handler matched 0 rows →
**no notification, no dunning email**, storefront silently dark.
Fix: added `platform_subscriptions.last_dunned_invoice_id` (folded into 021,
with an `ALTER … ADD COLUMN IF NOT EXISTS` so a re-run adds it to the existing
prod table); the handler now sets past_due + claims the invoice unconditionally,
and gates notify on whether we'd already dunned THIS invoice id (read-then-write
to avoid the PostgREST `NULL <> value` pitfall on the first failure).
`node --check` clean.

## Not done / follow-ups
- Auto-resume publish after returning from Stripe Checkout success.
- The storefront *shell* (/@handle bio + links) still renders when lapsed —
  only products/sales pages go dark. Decide if full-dark is wanted.
- Stripe Tax + receipts for the platform sub (note 108 Phase 1 tail).
- Trial-reminder email before day 14 (only dunning-on-failure exists).
