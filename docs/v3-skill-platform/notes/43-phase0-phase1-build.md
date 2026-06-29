# 43 — v3 Build: Phase 0 + Phase 1

**Date:** 2026-06-22

## Overview

First implementation session for the v3 Skill platform (follows the docs-only
[42](42-v3-skill-platform-spec.md)). Devan said "build everything" and chose
**full-build mode** (I write the code) for this build — a deliberate override of
his usual "teach, I'll code it myself" preference, scoped to this build. Started
**Phase 0 → Phase 1** in order, per `07-roadmap-and-implementation.md`.

`vite build` passes after every step.

## Phase 0 — Park legacy, v3 nav (no schema, reversible)

- **`src/lib/config.js`** (new) — `LEGACY_MODE` flag, default OFF, from
  `VITE_LEGACY_MODE`. Flip on to restore the full v1 campus app. Also
  `SKILL_PLATFORM_FEE_BPS = 500` + `estimateSkillFeeCents()` for UI display.
- **`src/components/Header.jsx`** — new v3 nav (**Build · Locker · Dashboard ·
  Storefront**); the Storefront link only renders when `profile.username` is set.
  All v1 links (Matches/Swaps/Gigs/Orders/Disputes/Chat) wrapped in
  `{LEGACY_MODE && …}` in both the desktop bar and the mobile drawer. Dropped the
  points-badge from the bar. **Wrapped, never deleted.**
- **`src/main.jsx`** — v1 routes (matches, swaps, gigs, my-orders, disputes,
  chat, verify-college, etc.) wrapped behind `LEGACY_MODE`. Added v3 routes:
  `/build`, `/build/:skillId`, `/locker`, `/locker/:skillId`, `/dashboard`, and
  the public storefront `/:handle` placed **last before the `*` catch-all** so
  static routes win.
- **Stub pages** so nav has no dead 404s: `app-pages/Storefront.jsx`,
  `SkillBuilder.jsx`, `Locker.jsx`, `Dashboard.jsx`, all using a new
  `components/PhasePlaceholder.jsx` ("Phase N · coming soon"). Replace each as its
  real page is built.

### Routing decision
Storefront route is `/:handle` (not `/@:username`) — React Router v6 doesn't
reliably match a literal-`@`-prefixed segment. The URL is `/@username`, so
`params.handle` arrives as `"@username"` and `Storefront.jsx` strips the leading
`@`. Links use `` `/@${username}` ``.

## Phase 1 — Foundation (schema + data layer + identity)

- **`docs/v3-skill-platform/migrations/001_skill_platform.sql`** (new) — the
  authoritative migration. Idempotent. Adds `profiles.username/bio/
  storefront_theme` (+ case-insensitive unique index on `lower(username)`), the
  5 tables (`skills`, `content_blocks`, `purchases`, `community_posts`,
  `analytics_events`), widens the `notifications` type CHECK to include
  `skill_update` / `skill_purchase` / `community_reply`, and full **RLS** per the
  v1 owner-scoped pattern. ⚠️ **Must be run in the Supabase SQL editor — not yet
  applied.** Mirrored into `supabase/schema.sql`.
- **Data layer** (new, `src/lib/`):
  - `skills.js` — reads + creator CRUD + block add/update/delete/reorder via
    Supabase (RLS-guarded); `publishUpdate()` stubbed to the future backend.
  - `purchases.js` — locker reads + `hasPurchased`; `startCheckout` /
    `getBlockDownloadUrl` stubbed to Phase 3 backend endpoints. **Purchases are
    never client-inserted** — webhook fulfils server-side.
  - `community.js` — list/create/delete posts + replies (RLS-gated to buyers +
    creator).
  - `analytics.js` — fire-and-forget `recordEvent`, creator/skill event reads,
    `toFunnel()` rollup.
- **`src/app-pages/auth/Onboarding.jsx`** — Step 1 now claims a `@username`:
  live debounced availability check (`ilike` on profiles), `normalizeUsername`
  (`[a-z0-9_]`, ≤20), `RESERVED_USERNAMES` guard against route collisions, inline
  status hint. Teach/learn requirements now gated behind `LEGACY_MODE`; v3 users
  save and land on `/build`. Handles the unique-index race on save.
- **`backend/config/fees.js`** — `SKILL_PLATFORM_FEE_BPS = 500` (5%) +
  `skillFeeCents(priceCents)`, kept separate from the v1 flat $3.50 service fee.

## Lint / build state
- `vite build` ✅. All new files lint clean.
- 3 pre-existing lint findings remain in `Onboarding.jsx`/`main.jsx`
  (`set-state-in-effect` on the profile-load effect, missing `navigate` dep,
  unused `toggleTeach`) — predate this work, left untouched.

## Action required (Devan)
1. **Run `migrations/001_skill_platform.sql` in Supabase** before the v3 data
   layer works.
2. Sanity-check: with `LEGACY_MODE` off, the v1 nav/routes are gone but still
   reachable by URL when the flag is on.

## Open questions still pending (from note 42)
Platform fee % (assumed 5%), video host, version-bump trigger, confirm no
Next.js rewrite.

## Next
Phase 2 — the Skill builder: backend `routes/skills.js` (mount in `index.js`),
`skill-files` + cover storage buckets, `SkillBuilder.jsx` + `BlockEditor.jsx`
(⚠️ avoid the `BlockButton`/`routes/blocks.js` user-blocking naming).
