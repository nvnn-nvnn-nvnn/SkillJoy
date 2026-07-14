# 138 — Social links: click-an-icon picker

Date: 2026-07-13

## What changed
Reworked the **Links tab → Social links** panel in `StorefrontEditor.jsx` from a stack of
`<select>` dropdown rows into an **icon gallery**: every platform in `SOCIAL_TYPES` is shown as a
clickable tile (rendered with `BrandIcon`). Clicking a tile appends that platform to the socials
list; a URL field + remove button then appear in the list below.

## Why
Old UX: click "Add social" → a generic Instagram row → open a dropdown → pick a platform → paste URL.
New UX matches the user's spec exactly — **showcase all icons, choose platform type by clicking the
icon, and it's added to the list.** Fewer steps, visual, and mirrors how Stan/Beacons do it.

## How
- `addSocial(type = 'instagram')` now takes the platform type (was hardcoded Instagram).
- Panel renders `SOCIAL_TYPES.map` as `.std-plattile` buttons → `onClick={() => addSocial(t.type)}`.
- Tiles already present in `theme.socials` get an `.on` accent state (orientation cue; duplicates
  are still allowed — someone may want two of the same).
- Added socials render as `.std-socialrow`: platform `BrandIcon` chip + URL input (placeholder
  "Your {Platform} URL") + remove. The per-row type `<select>` is gone — change type by
  remove + re-add.
- New CSS: `.std-platgrid` (auto-fill grid, min 80px), `.std-plattile` (+hover lift/glow, `.on`),
  `.std-platicon`, `.std-platlabel`, `.std-sociallist`, `.std-socialrow`, `.std-socialicon`.
- Empty state: "Tap an icon above to add it, then paste your link."

## Files
- `src/app-pages/StorefrontEditor.jsx`

## Note
`SOCIAL_TYPES` (in `src/lib/storefront.js`) is the single source of platforms — instagram, tiktok,
youtube, x, bluesky, snapchat, onlyfans, roblox, bitcoin, ethereum, website. Add a platform there
(+ a `BrandIcon` case) and it shows up in the picker automatically.
