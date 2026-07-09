# 93 — Account creation collects name + phone, then handle

_2026-07-08. Restructured signup so the email/password flow captures name + phone
at account creation; the handle/username is claimed afterward in onboarding._

---

## The flow

**Before:** signup = email + password only → onboarding collected name, username, bio, availability.

**Now:**
1. **Account creation** (`/login` → Sign up, [Login.jsx](../../../src/app-pages/auth/Login.jsx)) collects **Full name → Phone → Email → Password** (name + phone required). Passed to `supabase.auth.signUp({ email, password, options: { data: { full_name, phone } } })` → stored in auth `user_metadata`.
2. **Handle** — after email confirm + sign-in, [Onboarding.jsx](../../../src/app-pages/auth/Onboarding.jsx) reads that metadata: name field **hidden** (already captured), phone carried through + persisted, user claims their `@handle` + bio.

## Data

Migration **`020_profile_phone.sql`** adds `profiles.phone TEXT` (capture only, not
SMS-verified). Persisted in the onboarding `save()` upsert (`phone: phone.trim() || null`).

Name + phone live in `user_metadata` between signup and the (trigger-less) profile
creation at onboarding save — same pattern the guest/Google flows already rely on.

## Onboarding name-field logic

`showNameField = !!profile?.full_name || !nameFromAccount` where
`nameFromAccount = user_metadata.full_name || .name`:
- **Fresh signup / Google** (name in metadata) → name field hidden → straight to the handle.
- **Editing an existing profile** → name field shown (so it stays editable).
- **Fallback** (no name anywhere) → field shown so save-validation isn't a dead end.

`fullName` state is still prefilled from metadata even when the field is hidden, so
the save always has a name.

## Caveats / open items
- **Phone = capture only.** No SMS verification (that's a separate Supabase phone-auth
  + provider build).
- **Google sign-up collects no phone** (Google returns name, not phone). Google users
  reach onboarding with a name and no phone. Options for later: prompt for phone in
  onboarding *only when missing*, or in Settings. Currently only the email-signup path
  guarantees a phone.
- Legacy availability step unchanged here (see note 92 for the day×time grid).

## Status
Build passes. **Run migration 020 in Supabase** before this works live.
