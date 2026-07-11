# 113 — Phone input in profile editor + publish-gate deep-link

_2026-07-10. Fixes a dead-end exposed by the paywall's PROFILE_INCOMPLETE gate._

## The bug

The publish gate ([skills.js](../../../backend/routes/skills.js) `/publish`) requires
`full_name, username, phone`. But `phone` was **only** captured at email/password signup
([Login.jsx](../../../src/app-pages/auth/Login.jsx)) → `user_metadata` → persisted by
onboarding. So:
- **Google-OAuth signups** never see that input → `profiles.phone` null → can never publish.
- **Legacy users** never had it.
- There was **no edit surface anywhere** to set phone after signup.

⇒ Hard dead-end: "Finish your profile" with no field to finish it in.

## Fix (Option A — add the input, keep the gate)

**Design rule (owner, 2026-07-11): personal/private info NEVER lives in the storefront
editor.** The storefront editor is public-page content (name/avatar/bio ARE shown publicly);
phone is private and must live on the dedicated **Settings** page. First cut wrongly put it in
the StorefrontEditor Profile panel — moved to Settings.

1. **`src/app-pages/Settings.jsx`** — `phone` state loaded from `profile.phone`; a **Phone
   number** field added to the **Account** section (under Email), saved via its own `savePhone()`
   → `supabase.from('profiles').update({ phone })` → refresh profile. Note: "Private — required
   to publish, used for verification. Never shown publicly."
2. **`SkillBuilder.jsx` + `ServicesDashboard.jsx`** — the `PROFILE_INCOMPLETE` catch is now a
   **confirm → `navigate('/settings')`** ("Go to settings") instead of a dead-end toast.
   ServicesDashboard previously had no explicit PROFILE_INCOMPLETE branch (bare toast) — added.
3. **NOT `updateStorefront`** — phone is saved directly to `profiles` from Settings, not routed
   through the storefront save. `updateStorefront` and the StorefrontEditor were reverted to
   have no phone at all.

`vite build` ✅.

## Notes / follow-ups
- `profiles.phone` column exists (migration 020, applied in prod per note 112).
- Deliberately did NOT deep-link to the exact field (no `?focus=phone` scroll/highlight) —
  the panel is the first thing shown, good enough. Add focus-scroll later if desired.
- Open product question (deferred, not blocking): is phone truly needed at *publish*, or only
  at *payout* (Stripe Connect collects its own phone for KYC)? If it's only "nice to have on
  file," consider making it optional at the gate. Kept required per the original signup spec.
