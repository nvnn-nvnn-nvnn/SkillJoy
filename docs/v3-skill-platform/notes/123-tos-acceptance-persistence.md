# 123 — TOS acceptance persisted (proof of consent)

_2026-07-11. Closes the note-116 housekeeping item: the onboarding TOS checkbox previously only
GATED save — nothing recorded that (or when, or which version) the user agreed._

## Changes

- **`migrations/025_tos_acceptance.sql`** — adds `profiles.tos_accepted_at TIMESTAMPTZ` +
  `profiles.tos_version TEXT`. Idempotent. **⚠️ Must be RUN in prod Supabase before deploying
  this code** — until the columns exist, the onboarding upsert errors on unknown columns
  (i.e. onboarding would BREAK). Deploy order: run 025 → deploy.
- **`src/lib/config.js`** — `export const TOS_VERSION = '2026-07-11'`, the single source of
  truth. Bump it when the ToS text materially changes.
- **`src/app-pages/auth/Onboarding.jsx`** — `save()` now includes
  `tos_accepted_at: new Date().toISOString(), tos_version: TOS_VERSION` in the profiles upsert.
  The gate logic is unchanged (checkbox still required + button disabled); since validation
  already blocks save without `agreedTos`, acceptance is always recorded with the save.
- **`src/app-pages/Settings.jsx`** — small hint line at the bottom of the Account card:
  "Terms accepted on {date} (v{version})", shown only when `profile.tos_accepted_at` is set.

## Not implemented (flagged, future)

**Re-acceptance on version bumps.** Bumping `TOS_VERSION` only affects NEW signups; existing
users keep their old recorded version and are never re-prompted. The future version: on login,
compare `profile.tos_version` to `TOS_VERSION` and gate with a re-accept modal when they differ.

## Verify
`vite build` ✅. Test after running 025: complete a fresh onboarding → profiles row has
`tos_accepted_at` + `tos_version='2026-07-11'` → Settings shows the acceptance line.
