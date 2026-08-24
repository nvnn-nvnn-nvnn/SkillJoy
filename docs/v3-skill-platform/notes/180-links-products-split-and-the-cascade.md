# 180 — Links/Products split, style cascade, banner to the document top

Date: 2026-08-21
Migrations: none
**Status: brief note — written under a credit limit. Expand later.**

---

## 1 · Links and Products are now separate categories

They shared one "Products" panel and several theme keys. Each now has its own:

| | Links | Products |
|---|---|---|
| Fill | `link_color` | `item_color` |
| Text | `link_text_color` | `item_text_color` |
| Shape | `link_shape` | `button_style` |
| Opacity | `link_opacity` | `product_opacity` |
| Blur | `link_blur` | `product_blur` |

`link_opacity` / `link_blur` default to **`null` = follow the product value**, so
existing storefronts are pixel-identical until a slider moves.

**Link button shapes:** Rounded / Oval / Sharp / **Full width**. Full width uses
the viewport breakout so buttons run past the 540px column, with square corners.

---

## 2 · The cascade: block → page → theme

The rule, now applied consistently:

```css
color: var(--lkb-fg, var(--sf-link-fg, var(--text)));
/*        block        page             theme        */
```

Two bugs this fixed:

- Block colours fell straight back to `--text`, so a **page-level link text
  colour never reached a block at all**.
- Block `shape` defaulted to `'pill'`, a concrete value — so every block
  silently overrode the page-level `link_shape`. Now `''`, and the block only
  emits `--lkb-shape` when it actually overrides. The picker gained a **Page**
  option to return to inheriting.

> **Transferable:** a default that is a real value is an override. If a level is
> meant to inherit, its default must be empty, and the renderer must not emit
> the variable at all.

---

## 3 · Featured links render before products

Within each group: featured links first (by position), then products. Featuring
means "click this" — burying it under the whole catalogue contradicted the flag.

---

## 4 · Banner: portalled to `<body>`

Two earlier attempts failed because the banner lived inside `.sf-wrap`, so
`top: 0` meant the top of the **540px content column**, which sits below the app
chrome. The `--app-header-h` compensation only existed at the `max-width: 900px`
breakpoint; everywhere else it resolved to `0`.

Fixed structurally — `createPortal(..., document.body)`, so `top: 0` anchors to
the **document**. Two simplifications fell out:

- No viewport breakout needed (`left/right: 0` on body IS full width), which
  also removed the scrollbar-overflow problem.
- `--sf-cover-h` had to move from `.sf-wrap` to `:root` — `.sf-wrap` is no
  longer an ancestor, so the variable would never have reached the element and
  the responsive heights would have silently stopped working.

Also `background-position: center center` (was `center top`). The element is
very wide and short, so `cover` crops hard vertically; top-anchoring threw away
the middle of the image, which is where the subject usually is. Editor preview
matched.

---

## 5 · A whitelist bug worth remembering

`sanitizeThemeImport` type-checks with `typeof def === typeof val`. `typeof null
=== 'object'`, so a `null`-defaulted numeric key (`link_opacity`, `link_blur`)
would have had **valid imported numbers silently dropped**. Patched with an
explicit null-default branch.

That's hostile-input protection misfiring on good input — it would only ever
have surfaced as "my imported theme lost its link opacity".

---

## To expand later
- Per-block colour still has no live preview (flagged since note 175)
- Featured links bypass their block's colours — they render in the products
  section, which knows nothing about the block
- `medium` size is still accepted on read but no longer offered in the picker

## Files
`src/lib/storefront.js` (five new theme keys, null-default import guard),
`src/lib/blocks.js` (`shape` defaults to inherit),
`src/app-pages/StorefrontEditor.jsx` (split panels, Links before Templates),
`src/app-pages/Storefront.jsx` (portalled banner, cascade, featured order),
`src/components/LinkBlock.jsx` (cascade, conditional shape),
`src/components/LinkBlockEditor.jsx` (Page option in shape picker),
`src/components/Header.jsx` (Links before Templates)

---

## 6 · Addendum — featured links leave the products section entirely

**Before:** featured links were bucketed into `itemGroups` alongside products, so
they rendered as product cards and inherited product styling. Featuring a link
silently changed how it looked.

**Now:** two genuinely separate categories.

| | Profile links | Featured links |
|---|---|---|
| Where | inside the profile card | own section, above products |
| Rendered by | its block | **its block** |
| Layout / colours / title | block's | block's |

Featured links are grouped by `block_id` and each group rendered through
`LinkBlock`, so a featured link keeps its block's layout, colours *and* title.
Products no longer touch them at all.

Legacy featured links with no `block_id` get a synthetic default block rather
than disappearing.

> **Transferable:** if a flag means "render this somewhere else", the thing must
> carry its own styling to the new location. Otherwise the flag secretly means
> "restyle this too", which is not what it says.

## 7 · Two smaller fixes

**Banner centring on desktop.** Portalling to `<body>` put it under the fixed
248px sidebar, so "centre" was the centre of the *document*, not of the visible
area. Now `left: var(--shell-offset, 0px)` — 0 when there's no rail.

**No placeholder thumbnails.** A link without an image rendered a grey square
with a chain icon, which reads as a broken image. Omitted entirely now (and the
dead `Link2` import went with it).

## 8 · The live preview finally renders blocks

Flagged since note 175, closed here. The preview drew **one flat list** of link
buttons, so the whole Layouts tab — four styles, size, alignment, shape, outline,
shadow, three colours — produced no visible feedback. You changed a control and
nothing moved.

It now mirrors the live page: links grouped by block, profile links inside the
card, featured ones in their own section above the products, each carrying its
block's style, colours and title.

`PreviewLinkGroup` is a deliberate re-implementation, **not** a reuse of
`LinkBlock`. That component ships its own full-size stylesheet; dropped into a
~65%-scale phone frame it would render at the wrong size *and* its CSS would
leak over the preview's. So the preview mirrors the **shape** — which is what
the controls actually change — and not the implementation.

Removed with it: the now-dead `.lp-links` / `.lp-linkbtn` rules.

> **Transferable:** a preview that mirrors structure but re-implements styling
> stays honest without coupling preview scale to production CSS. Reuse would
> have made every change to the real renderer a preview regression risk.

## Still open
- No page-level "Featured links" panel — featured styling is per-block only,
  which the last request also asked for
- `medium` size is still accepted on read but no longer offered in the picker

---

## Exercises

1. **Break the cascade on purpose.** Set a page-level link text colour, then set
   a block-level one. Now delete the block-level value in the DB (`layout.fg`)
   *without* reloading — does the block fall back to the page colour, or to
   `--text`? Explain which `var()` fallback in `LinkBlock.jsx` decides that.

2. **Find the override-by-default bug yourself.** Change `shape` in
   `DEFAULT_BLOCK_LAYOUT` back to `'pill'`. Set the page shape to Sharp. What
   happens to a block you never touched, and why is an empty-string default the
   only correct choice for an inheriting level?

3. **Add a fifth link style** (say, `list` — full-bleed rows, no gap). You'll
   need it in three places: `LINK_STYLES`, `LinkBlock.jsx` CSS, and
   `PreviewLinkGroup`'s `.lpb-*` CSS. Miss one and the symptom differs —
   predict all three symptoms before you test.

4. **Prove the preview isn't lying.** Pick one Layouts control, change it, and
   screenshot the preview beside the real storefront. Where do they diverge, and
   is each divergence a bug or a deliberate scale difference?
