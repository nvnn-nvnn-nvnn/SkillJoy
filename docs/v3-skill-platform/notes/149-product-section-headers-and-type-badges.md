# 149 — Product section headers + type badges (both optional)

Date: 2026-07-18

## What changed (`Storefront.jsx`)
1. **Section headers.** Product groups (bucketed by `group_label`) used to render a bare 15px
   `<h2>`. Each labeled group now gets a header ROW: title (respects `--sf-title` + master glow) +
   an accent-fading hairline rule + an item-count pill. Unlabeled groups still render headerless.
2. **Product-type badges.** Each card's foot now shows a `TypeTag` chip — icon + label from
   `PRODUCT_TYPES` (`src/lib/productTypes.js`) keyed by `skills.kind`: Digital product, Online
   course, 1:1 coaching, Membership, Webinar, Lead magnet, Bundle. Replaces the old
   membership-only tag; legacy rows without `kind` fall back to membership (via `pricing_type`)
   or digital. This is the "product differentiation" — buyers can tell a course from a download
   at a glance.
3. **Both optional** (per follow-up): `show_group_headers: true` and `show_type_badges: true` in
   `DEFAULT_THEME`, toggles in the editor's **Products** panel. Defaults on, so existing stores
   get the upgrade; `!== false` checks keep old saved themes (which lack the keys) on.

## Why this didn't exist before (asked directly)
No blocker — the data was always there. `skills.kind` has been in `SKILL_COLS` since migration 011,
and `PRODUCT_TYPES` already had icons/labels for the builder. When product groups shipped
(commit d400108), the scope was "group + label," so the header stayed a bare h2 and the only badge
was membership. Nothing had connected `kind` → storefront presentation until now.

## Files
- `src/lib/storefront.js` — `show_group_headers`, `show_type_badges` defaults
- `src/app-pages/Storefront.jsx` — `TypeTag`, `.sf-grouphead/.sf-groupline/.sf-groupcount`, `.sf-tag` icon chip
- `src/app-pages/StorefrontEditor.jsx` — two toggles in the Products panel

## Note
The editor's live preview renders a flat 2-product list (no groups), so headers/badges are
control-only there — same policy as splash/tilt/cursor FX.
