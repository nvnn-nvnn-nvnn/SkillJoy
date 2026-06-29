# 46 — v3 Build: Phase 4 (Versioning + Community)

**Date:** 2026-06-22

## Overview

Built **Phase 4 — versioning + the per-Skill community space**. `vite build` +
eslint clean; backend passes `node --check`. Devan reiterated the goal: **parity
with stan.store** (see parity map at the bottom).

## Versioning

- **`backend/routes/skills.js`** (new): `POST /api/skills/:skillId/version` —
  creator-only; bumps `skills.version`, then **fans out `skill_update`
  notifications to every paid buyer** (needs the service role — cross-user
  notification inserts, which a client can't do safely). Mounted at `/api/skills`
  (auth) in `index.js`.
- **`SkillBuilder.jsx`**: published Skills now show a `v{n}` chip + a **"Push
  update"** button that calls `publishUpdate()` → the route above. Explicit, not
  auto-bump (so buyers only get pinged when the creator means it).
- Buyer side already surfaces this: the Locker list shows an "Updated to vN"
  badge and the consume view shows an update banner (built Phase 3).

## Community

- **`src/components/CommunityThread.jsx`** (new): one thread per Skill —
  top-level posts + one level of replies, avatars, "Creator" badge, relative
  timestamps, author/creator delete. **Supabase Realtime** subscription so posts
  appear live. Buyer/creator access is enforced by RLS (migration 001).
  Best-effort engagement pings: a new post notifies the creator; a reply notifies
  the parent author (`community_reply` type; client notification inserts are
  allowed by the existing `notifications` RLS).
- **`Locker.jsx`**: replaced the Phase-4 placeholder in the consume view with
  `<CommunityThread>`. Creators previewing their own Skill can post too.

## Verify
- `vite build` ✅ · eslint ✅ on changed files · `node --check backend/routes/skills.js` ✅.

## Action required (Devan)
- No new migration. (`skill_update` / `community_reply` notification types were
  already added in migration 001.) Still need 001/002/003 applied from prior
  phases.

## stan.store parity map (where v3 stands)
| Stan capability | v3 status |
|---|---|
| Link-in-bio storefront (`/@you`) | ✅ Storefront |
| Sell digital products | ✅ Skills (mixed content blocks) |
| In-flow mobile checkout | ✅ Checkout (Payment Element, Apple/Google Pay) |
| Courses (video) | ✅ video blocks |
| Digital downloads | ✅ file blocks (signed URLs) |
| 1:1 coaching / booking | ✅ coaching link blocks |
| Free lead magnet | ✅ free Skills (price 0 → instant grant) |
| Buyer library / re-access | ✅ Locker (permanent) |
| Community | ✅ per-Skill thread (beyond Stan) |
| Versioned updates | ✅ (beyond Stan) |
| Stripe payouts | ✅ Connect Express (reused from v1) |
| Analytics | ⚠️ events captured; **dashboard = Phase 5** |
| Memberships / subscriptions | ⚠️ model exists; **checkout is one-time only (deferred)** |
| Storefront theming / bio links | ❌ `storefront_theme` column unused (post-MVP) |
| Email/audience capture | ❌ out of MVP scope (doc 02) |
| Affiliates / upsells / coupons | ❌ explicitly out (doc 02) |

## Next
Phase 5 — creator **Dashboard**: sales/revenue, transparent payout status
(`PayoutStatus`), buyer list + CSV export, and the analytics funnel
(`AnalyticsCards`) off `analytics_events`. Then optionally close the two ⚠️
parity gaps: Stripe **Subscriptions** for memberships, and basic storefront
theming. See doc 06/07.
