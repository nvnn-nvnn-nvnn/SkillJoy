# 49 — v3 Build: Phase 7 (Storefront Editor / Design Control)

**Date:** 2026-06-22

## Overview

Built **Phase 7 — storefront design control**, the #1 Stan weakness and our
headline differentiator. Creators can now theme their storefront, add a banner,
social links, external/affiliate link buttons, and reorder their Skills.
`vite build` + eslint clean.

## What changed

- **`migrations/006_storefront_editor.sql`** (new — ⚠️ run in Supabase after
  001–005): `skills.sort_order` + a `store_links` table (label, url, position,
  is_affiliate) with public-read / owner-write RLS. Theme reuses the existing
  `profiles.storefront_theme` jsonb (added in 001).
- **`lib/storefront.js`** (new): `DEFAULT_THEME` + `resolveTheme`, `SOCIAL_TYPES`,
  `updateStorefront` (bio + theme), and link CRUD/reorder.
- **`lib/storage.js`**: `uploadBanner` (public covers bucket).
- **`lib/skills.js`**: `listPublishedSkills`/`listMySkills` now order by
  `sort_order`; added `reorderSkills`.
- **`lib/profiles.js`**: `getProfileByUsername` now returns `storefront_theme`.
- **`app-pages/StorefrontEditor.jsx`** (new, route `/storefront/edit`): accent
  color (presets + picker), list/grid layout, banner upload, bio, social links
  editor, link-button manager (persist on blur), and Skill up/down reordering.
- **`app-pages/Storefront.jsx`** (rewritten): applies the theme — accent via a
  scoped `--accent` CSS var override, banner, social row, list-vs-grid layout,
  external/affiliate link buttons (affiliate links get `rel="...sponsored"`),
  creator-ordered Skills, and an owner-only "Edit storefront" button.
- **`Dashboard.jsx`**: header row with "Customize storefront" + "New Skill".

## Theme shape (`profiles.storefront_theme`)
`{ accent: '#hex', layout: 'list'|'grid', banner_url: '', socials: [{type,url}] }`
— `resolveTheme()` merges over defaults so older/empty profiles are safe.

## Decisions / simplifications
- Theming applied by overriding `--accent` on the storefront wrapper (cascades to
  children) — no global theme system needed.
- Link buttons persist on blur; theme/bio/banner persist on the "Save" button;
  Skill order persists immediately on each move.
- Banner reuses the public `skill-covers` bucket under `{creatorId}/banner/…`
  (folder-owner RLS still scopes it). No new bucket.

## Action required (Devan)
- Run **`migrations/006_storefront_editor.sql`** (now 6 migrations: 001–006).

## Next
Phase 8 — native booking (availability, bookings table, slot picker, reminders,
cancellation), replacing coaching-link-only. Then 9 (email capture/marketing),
10 (discounts/refunds/receipts/tax), 11 (pixels/AutoDM/affiliates program), 12
(SEO/integrations/admin). See doc 08.
