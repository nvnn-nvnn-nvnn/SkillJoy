# 150 — Editable product sections in the storefront editor

Date: 2026-07-18

## The actual ask
Creator-named headings above groups of products, edited in one place:

```
My favorite products
  product one
  product two

Essentials
  product three
  product four
```

Note 149 upgraded how headers *look* and added type badges — but missed this: **where you edit the
heading**. The data (`skills.group_label`) already existed and the storefront already bucketed by
it; the only editor was a text input buried inside each individual product's builder, so grouping
four products meant opening four products and retyping the same string identically. That's the gap.

## Design: sections are derived, not stored
There is **no sections table**. A section = a distinct `group_label` across the creator's products.

- **Order** of sections is derived from product order (first-seen), using the *same* bucketing loop
  as `Storefront.jsx`. The editor therefore cannot disagree with the public page.
- **Rename** = re-label every product in that section (`updateSkill` per row).
- **Move** = rewrite one product's `group_label` + persist new `sort_order`.
- **Delete section** = null the label on its products → they fall into Ungrouped. **Nothing is
  ever deleted.** Labeled explicitly in the UI/aria so it can't be mistaken for deleting products.
- **Empty new sections** live in local `extraSections` state only — a section with no products has
  nothing to persist to. It becomes real the moment a product lands in it.

## The ordering invariant (verified, not assumed)
`sort_order` is one flat list; sections are contiguous runs within it. So a move must keep each
label's rows adjacent, or a section would render twice on the storefront. `moveSkillTo` handles it:
with an anchor → splice before that product; without → append **after the section's current last
item** (`rest.map(lbl).lastIndexOf(target)`), not at the end of the array.

Simulated the algorithm over 5 moves (ungrouped→section, cross-section append, insert-before,
section→ungrouped, into a brand-new section): sections stayed contiguous and no product was lost.

## UI
`Product order` panel → **Sections & product order**. Each section is a drop target with an inline
title input (transparent until hover/focus so it reads as a heading, not a form field), a count
pill, and a remove-heading ✕. Ungrouped renders as a muted, non-renamable bucket.

Three input paths, because drag alone excludes people:
1. **Drag** a product onto a section (or onto a product, to land at that position)
2. **Select** dropdown per row — touch + keyboard reachable, drag is neither
3. **↑/↓** for ordering within the flat list

## Files
- `src/app-pages/StorefrontEditor.jsx` — `sections` derivation, `moveSkillTo`, `renameSection`,
  `deleteSection`, `addSection`, `nudge`; `.std-sec*` styles
- Uses existing `updateSkill` / `reorderSkills` from `src/lib/skills.js` — no schema change

## Follow-ups
- Renaming a section fires one `updateSkill` per product (fine at N≈10, wasteful at 100) — a single
  `.update().eq('group_label', old)` would be one query.
- No drag-to-reorder the *sections* themselves; section order follows product order.
