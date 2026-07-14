# 141 — New accounts land on the page builder

Date: 2026-07-13

## Change
After a first-time user finishes onboarding, `save()` in `src/app-pages/auth/Onboarding.jsx` used to
`navigate('/build')` — the digital-products hub (ServicesDashboard). Now it navigates to
**`/storefront/edit`** (the page builder / customize-your-storefront studio) so new creators build
their actual page first, instead of landing on an empty products list.

## Why it's safe
- `/storefront/edit` is in `ONBOARDING_PROTECTED` (starts with `/storefront`), but by the time we
  navigate we've already `setProfile(updated)` with the new `username`, so `OnboardingGate` sees a
  complete profile and won't bounce them back to `/onboarding`.
- Only the **first-completion** path changed. The other redirect in this file
  (line ~51: an already-onboarded user who somehow lands on `/onboarding` → `/build`) is unchanged,
  and the `LandingPage` "logged-in → /build" redirect is unchanged. So returning users are unaffected;
  only the brand-new-account moment routes to the builder.

## Files
- `src/app-pages/auth/Onboarding.jsx` (one-line nav target + comment)

## Also this session
Added 5 tactical follow-ups to the roadmap checklist (note 108 → "Tactical follow-ups") for Devv to
program himself: theme preset picker, demo SubscribeForm no-op, site-music reorder/cap, social-type
edit, Link buttons polish.
