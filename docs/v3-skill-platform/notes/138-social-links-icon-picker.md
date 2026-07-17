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

## Learn — build-it-yourself
**Mental model:** one array is the single source of truth; every surface just maps over it.

1. **Data drives UI.** `SOCIAL_TYPES.map(...)` renders the picker here, and the *same* array renders
   the icons on the public storefront. Add one entry → it appears in both. No list is ever hand-kept
   in sync with another; there's only one list.
2. **Pass the item's identity into the handler.** `onClick={() => addSocial(t.type)}` — the button
   knows what it is, so there's no separate "selected type" state to manage. Compare to the old
   dropdown, which needed a `<select>` value per row.
3. **Derive state, don't store it.** "Already added?" is computed live
   (`socials.some(s => s.type === t.type)`) for the `.on` highlight — never a duplicate boolean that
   could drift from reality.

**Transferable:** whenever two parts of the UI show "the same set of things," make them read one
array. Duplicated lists are how they silently disagree later.
