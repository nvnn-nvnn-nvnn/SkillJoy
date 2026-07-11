# 116 — Session status + open threads (checkpoint)

_2026-07-11. Consolidated state after the paywall + onboarding + pivot run. Points at the
detailed notes rather than repeating them._

## Shipped this stretch (notes 106–115)

- **106** — bio effects (weight/glow), link/product separation, product-groups build guide.
- **107** — product/link glassmorphism (opacity + backdrop-blur), better remove buttons.
- **108** — production roadmap + audit (Stan competitor). Pricing decision LOCKED: subscription
  + transaction fee, **gate at publish not signup**. Also holds the "what else to add" addendum.
- **109** — legacy cleanup: onboarding vestiges + dead gig/swap routes/imports removed. Confirmed
  ErrorBoundary + NotFound already exist (Phase-0 item done).
- **ErrorBoundary/NotFound** — added crash logging (`componentDidCatch`), themed the fallback,
  fixed the `--text-primary` typo in NotFound.
- **110** — Phase-0 security pass: CSRF (satisfied by Bearer-token design), RLS (solid), webhook
  idempotency (+ dispute-handler idempotency fix). Migrations-applied still unverifiable.
- **111 / 112** — platform paywall built (Fable) + reviewed (Opus, caught 2 prod-breaking RLS
  bugs). **112 is the READ-FIRST handoff.** Paywall is fully built but DEFERRED (off in DB via
  022, off in code via unset `STRIPE_PLATFORM_PRICE_ID`). `023_arm_paywall.sql` staged.
- **113** — phone field + publish-gate deep-link; then MOVED phone to Settings (personal info ≠
  storefront editor — now a standing rule in memory).
- **114** — locked onboarding (no header/footer/exit + `OnboardingGate` guard), v1 ProfileView
  removed, phone added to onboarding, the "two onboardings" audit (there's one), and the
  "Please enter your name" hidden-required-field bug + its reusable lesson.
- **115** — forced TOS checkbox in onboarding; "Storefront" → **"My Page"** rename + nav reorder
  (link-in-bio-first); email-verification added to roadmap as a placeholder.

## Current state

- Site healthy. Paywall OFF/deferred on purpose (blocked on Stripe 2FA). Local testing armed if
  `STRIPE_PLATFORM_PRICE_ID` set + `023` run against dev DB.
- Large amount of work in the working tree; **commit when ready.**

## Open threads (priority order, none urgent)

1. **Arm the paywall** — blocked on owner Stripe 2FA/phone. Sequence: price id → env → deploy →
   run `023` (backfill + re-arm) → sandbox-test the day-14 trial-FAIL path. Full checklist: note 112.
2. **Persist TOS acceptance** — we only gate on the checkbox; store timestamp + ToS version on the
   profile for real proof-of-consent (note 115 / 108 Legal item).
3. **Email verification** — placeholder only. Real gate = `email_confirmed_at`; Google-OAuth users
   are the gap (auto-verified externally, nothing gated). Note 108 Phase 4.
4. **Repo privacy** — GitHub repo is public with the owner's real name in old commit history
   (note 112). Decide before promoting the site (make private / history rewrite).
5. **Migrations are loose .sql, manually applied** — adopt Supabase CLI to stop flying blind
   (note 108 finding #3 / 110).

## Next fun work (the differentiator)

Phase 2 customization — background video, overlay effects (rain/snow/VHS), site audio, cursor
effects, UI/site templates. This is where SkillJoy stops looking like Stan and becomes its own
thing. Roadmap: note 108 Phase 2.
