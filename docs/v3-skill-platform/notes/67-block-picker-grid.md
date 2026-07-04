# 67 — Content-block picker: dropdown → inline tile grid

_Session 2026-07-02. Builder polish. The "+ Add content block" chooser was a
cramped floating dropdown whose items clipped; replaced with an inline grid of
tiles._

## Change
`SkillBuilder` Content tab. Clicking "+ Add content block" used to open an
absolutely-positioned `.sb-addmenu` popover (icon + label + hint per row) that
clipped and felt oversized. Now the trigger is a slim dashed bar; clicking it
reveals an **in-flow** `.sb-addpicker` card containing a responsive grid
(`auto-fill, minmax(148px, 1fr)`) of `.sb-addtile` cards — one per block type —
plus a Cancel. Same card language as the product-type picker on `/build/new`, so
both "pick a type" moments read as one system.

Logic unchanged: tiles still call `addContentBlock(type)`, which already closes
the picker.

## Reused the landmine knowledge (notes 65/66)
`.sb-addtile` and `.sb-addtrigger` are bare `<button>`s, so they inherit the
global `button, .btn { … white-space:nowrap; border-radius:pill; … }` reset.
Both explicitly set `white-space:normal`, their own `border-radius`,
`background`, and `display` so hints wrap and tiles look like cards, not pills.
`.sb-addtile-label` / `.sb-addtile-hint` also get `width:100%` so they fill the
tile and wrap (the column-flex + `align-items:flex-start` gotcha from note 65).

## Details "Type" selector → same tile grid
Same session, follow-on: the Details tab's **Type** control was a `<select>`
dropdown. Replaced it with a `.sb-typegrid` of compact `.sb-typetile` buttons —
one per kind, current selection highlighted in accent — sourced from the shared
`PRODUCT_TYPES` catalog (so its lucide icons + labels match `/build/new`).
Removed the now-unused local `SKILL_KINDS` array and `.sb-kind*` CSS. Still
saves via `patchSkill({ kind })`.

Net effect: **all three "pick a type" surfaces now share one tile language** —
the `/build/new` product picker, the Details Type field, and the content-block
picker.

## Files / verify
- `src/app-pages/SkillBuilder.jsx` only (JSX + styles).
- `eslint` clean, `npm run build` OK.
