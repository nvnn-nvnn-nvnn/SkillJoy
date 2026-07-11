# 112 — Paywall state + handoff (READ THIS FIRST)

_2026-07-10. Single source of truth for the platform-paywall work. Supersedes
the scattered status across 108/110/111 for "what do I do next" purposes._

## TL;DR

The platform paywall (creator pays SkillJoy to publish) is **fully built but
deliberately DEFERRED**. It is **not enforced** right now, on purpose, because
Stripe platform billing can't be configured yet (owner's phone/2FA missing).
The site is **healthy**. Do not "turn it on" until the arm checklist below is
done — doing so out of order already broke prod once (see Incident).

## Current state (as of this note)

- **Prod database:** migrations 001–020 applied, then the ORIGINAL (buggy) 021
  was applied, then **022 was applied to heal it**. Net effect in prod:
  `platform_subscriptions` table exists; storefront visibility is back to
  pre-paywall (published = public); the publish trigger is **dropped**;
  publishing works client-side. **The paywall is OFF in the DB.**
- **App code (working tree, NOT deployed, NOT committed at time of writing):**
  full paywall implemented but **self-defers** on `paywallEnabled()` =
  `!!process.env.STRIPE_PLATFORM_PRICE_ID`. That env var is **unset**, so all
  enforcement no-ops → the code behaves exactly pre-paywall. **Safe to deploy
  in any order.**
- **Stripe:** no platform Product/Price exists yet (blocked on 2FA). Membership
  (`skill_sub`) + one-time product charges via Connect are unaffected and live.

So: DB paywall OFF (via 022) + code paywall OFF (via missing env var) =
consistent, healthy, deployable.

## What the paywall IS (when armed)

Creator pays SkillJoy directly (a subscription on SkillJoy's OWN Stripe account,
NOT Connect) + the existing 5% per-sale `application_fee`. Signup/build/
customize stay free; card captured + 14-day trial starts at the **publish**
moment. Isolated from creator memberships (`kind:'skill_sub'`, fans→creator via
Connect) by a distinct `kind:'platform_sub'` metadata tag + a runtime
`assertNoConnectParams()` guard. Full design + pricing rationale: note 108
(§Phase 1, §PRICING DECISION) and note 111.

## Files (all built, see note 111 for detail)

- `migrations/021_platform_subscriptions.sql` — table + gated RLS policy +
  publish trigger + SECURITY DEFINER helpers (`creator_is_live`,
  `has_paid_purchase`) + `last_dunned_invoice_id`. **This is the FIXED version**
  (the prod incident was the earlier buggy cut). Its policy/trigger are the
  "armed" state — re-applied by the arm checklist, currently overridden by 022.
- `migrations/022_defer_paywall_gate.sql` — the hotfix that's LIVE in prod:
  ungated storefront policy + trigger dropped. Keeps table/functions.
- `backend/lib/platformSub.js` — `getPlatformSub`, `isPlatformLive`,
  `paywallEnabled`, `assertNoConnectParams`.
- `backend/routes/billing.js` (`/api/billing` subscribe/portal/status),
  `backend/routes/skills.js` (`POST /:id/publish`), gates in
  `checkout.js`/`guest.js`, `webhooks.js` platform_sub lifecycle + dunning.
- Frontend: `src/lib/billing.js`, `publishSkill()` → endpoint,
  `components/TrialBanner.jsx`, subscribe flow in SkillBuilder/ServicesDashboard.

## ⚠️ Incident (what NOT to repeat)

The FIRST cut of 021 had two RLS bugs that pass `vite build`/`node --check` but
only detonate against Postgres, and the owner ran it in the Supabase editor
before review:
1. inline `EXISTS` on `platform_subscriptions` (owner-read RLS) → storefront
   invisible to the public;
2. `skills`⇄`purchases` mutual RLS recursion → "infinite recursion in policy".
Both fixed with SECURITY DEFINER helpers (bypass the referenced table's RLS).
**Lesson: SQL migrations hit prod instantly and independently of code deploys.
Never run a schema change that assumes undeployed code, and treat cross-table
RLS sub-SELECTs as recursion/visibility hazards — use SECURITY DEFINER fns.**

## To ARM the paywall (the future migration 023 — do ALL, in order)

1. **Stripe:** create a platform Product + monthly Price on SkillJoy's OWN
   account (NOT Connect). Decide the price (note 108: cheap enough that one sale
   makes it obviously worth it). Enable the Customer Portal (Stripe → Settings →
   Billing → Customer portal).
2. **Env:** set `STRIPE_PLATFORM_PRICE_ID` in `backend/.env`. This alone flips
   the CODE enforcement on, so do steps 3–4 in the same window.
3. **Webhook:** confirm the Stripe endpoint subscribes to `invoice.payment_failed`
   (`checkout.session.completed` + `customer.subscription.*` are already on from
   memberships).
4. **Backfill + re-arm SQL — ALREADY WRITTEN: `migrations/023_arm_paywall.sql`**
   (Opus, 2026-07-10). Self-contained + idempotent: recreates both SECURITY
   DEFINER helpers, grandfathers published creators, re-applies the gated policy
   + publish trigger, and ends with post-run verification SELECTs. Just run it
   (in the same window as env+deploy). Read its ZOMBIE-ROW CAVEAT first (below).
5. **Deploy the app (backend + frontend) BEFORE re-adding the trigger** — the
   trigger blocks client publishing, so the server publish endpoint must be live
   first. Order: deploy code → run 023.
6. Sandbox-test the 4 acceptance flows in note 111 with Stripe test keys.

## Opus code review — SIGN-OFF (2026-07-10)

Full re-read of the implemented path (platformSub.js → billing.js → skills.js
publish → webhooks.js platform branches → 021/022). `node --check` clean on all 6
touched backend files; `/api/billing` confirmed mounted behind `strictLimiter +
authMiddleware` (index.js:85), `/api/skills` behind auth (81). **Verdict: strong,
safe as deferred.** Isolation guard, SECURITY DEFINER RLS fix, and idempotency all
verified correct. Three ARM-TIME risks to respect (not bugs now):

1. **The DB trigger is the ONLY real paywall enforcement — the `/publish` endpoint
   is UX.** A creator with the anon key can `update({status:'published'})` directly;
   only `skills_enforce_server_publish` stops it, and 022 has it DROPPED. So the
   moment `STRIPE_PLATFORM_PRICE_ID` is set, code 402s but a direct anon update
   bypasses until 023 re-adds the trigger. **Env var + trigger must arm in the same
   window; the trigger must be present whenever the env var is set.**
2. **Verify `sub.current_period_end` against the pinned Stripe API version.** Recent
   API versions moved `current_period_start/end` onto subscription *items*; if the
   pin is new, `sub.current_period_end` is undefined → stored null → blank renewal
   date in the trial banner. Not money-critical (gating is on `status`). Confirm in
   sandbox.
3. **Trial-end is the untested moment** — run a real day-14 trial with a failing
   test card: assert `invoice.payment_failed` fires → `past_due` → storefront dark →
   dunning email + notification exactly once.

## Known issues / follow-ups

- **Dunning race:** FIXED in 021 (`last_dunned_invoice_id`, notify gated on
  invoice id not status). Dormant until armed.
- **Auto-resume publish** after returning from Stripe Checkout — small UX gap,
  the creator currently re-clicks Publish.
- **Lapsed storefront shell:** only products/sales pages go dark on lapse; the
  `/@handle` bio + links still render. Decide if full-dark is wanted.
- **Grandfather comp never expires (zombie rows).** 023's backfill inserts
  `platform_subscriptions` rows with NO `stripe_subscription_id`, so no webhook
  ever transitions them and there's no cron → a comped `trialing` creator stays
  live free forever until they voluntarily subscribe. Effectively a permanent
  founder comp. If you want it to EXPIRE, build a scheduled job that at
  `trial_ends_at` flips no-Stripe rows to a darkening status (or nudges them to
  subscribe). 023 sets `trial_ends_at` so that job has a key. Documented inline
  in 023's Step 1 caveat.
- **Stripe Tax + receipts** and a **trial-reminder email** (day ~11) not built.
- **Migrations are loose .sql, manually applied** (note 108 finding #3) — still
  unverified against prod; adopting Supabase CLI would prevent incidents like
  the one above.

## Unrelated open thread — repo privacy

The GitHub repo `nvnn-nvnn-nvnn/SkillJoy` is **public**. The owner's real name
was scrubbed from all working-tree docs + `.claude/settings.local.json` this
session, but it **remains in past commit history** (e.g. commit `a69ca10`).
Options offered, owner's call pending: (a) make repo private [recommended],
(b) commit+push the scrub, (c) `git filter-repo` history rewrite + force-push +
ask GitHub to purge caches. Nothing committed yet.

## Commit note (for whoever commits this session's work)

Paywall built but DEFERRED. Prod DB has 022 applied (gate off); code self-defers
on `STRIPE_PLATFORM_PRICE_ID`. To arm: configure Stripe price, run 023 (re-arm +
backfill), deploy code+migration together. Migrations and code deploy separately
— arm them in one window.
