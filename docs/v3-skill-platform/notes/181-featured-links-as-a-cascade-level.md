# 181 — Featured links as a cascade level (not a fork)

Date: 2026-08-24
Migrations: **none** — `storefront_theme` is a JSONB column, so new theme keys
need no schema change. (Worth internalising: that choice, made back in note 108,
is why the last four sessions of presentation work have cost zero migrations.)

---

## The request

> "links are independent of products, if a link is featured, the settings for it
> must be different from products. Have another link customization — Profile
> Links, Featured Links."

Three categories now, not two:

| | Profile links | Featured links | Products |
|---|---|---|---|
| Where | inside the profile card | own section, above products | product list |
| Fill | `link_color` | `featured_link_color` | `item_color` |
| Text | `link_text_color` | `featured_link_text_color` | `item_text_color` |
| Shape | `link_shape` | `featured_link_shape` | `button_style` |

---

## 1 · The design decision: a level, not a fork

The obvious implementation is a second, parallel set of styles — copy the Links
panel, point it at `featured_*`, done. That is a **fork**, and forks rot: every
future link feature has to be built twice, and the two drift.

Instead every `featured_*` key defaults to **empty / null = "inherit the profile
link value"**. That makes featured links a *fourth level* of the same cascade:

```
block  →  featured  →  page  →  theme
```

The payoff is that an untouched storefront is **pixel-identical** to before.
Nobody's page changed. You only diverge from your profile links at the exact
moment you decide to.

> **Transferable:** when you add a variant of an existing thing, ask whether it
> is a *new set of values* or a *new place to override the existing ones*. The
> second is almost always right, and it is the one that stays cheap.

---

## 2 · How a fourth cascade level costs ~15 lines

No new CSS. No new class names. No changes to `LinkBlock` at all.

The featured section already renders through `LinkBlock`, which reads
`var(--lkb-fg, var(--sf-link-fg, var(--text)))`. CSS custom properties **inherit
down the DOM**, so redefining `--sf-link-fg` on a wrapper around the featured
section is all it takes — everything inside picks up the nearer definition.

```jsx
<div className="sf-featured" style={featuredVars(theme)}>
  <LinkBlock block={block} links={items} />
</div>
```

And `featuredVars` emits **only the keys that are actually set**:

```js
function featuredVars(theme) {
  const v = {};
  if (theme.featured_link_color) { v['--sf-link-bg'] = …; v['--sf-link-border'] = …; }
  if (theme.featured_link_text_color) v['--sf-link-fg'] = theme.featured_link_text_color;
  if (theme.featured_link_blur != null) v['--sf-link-blur'] = `${theme.featured_link_blur}px`;
  if (theme.featured_link_shape) v['--sf-link-radius'] = LINK_RADIUS[theme.featured_link_shape];
  return v;
}
```

An unset key emits nothing, so the variable keeps whatever `.sf-wrap` gave it.
**Emitting `''` or `undefined` would NOT have worked** — a declared-but-empty
custom property still shadows the ancestor's value. This is the same trap as the
block `shape` default in note 180 §2, one level up.

---

## 3 · A bug the work uncovered: page shape never reached blocks

Note 180 claimed block shape falls back to the page-level `link_shape`. It
didn't. The CSS was:

```css
border-radius: var(--lkb-shape, var(--r-full));   /* ← page level absent */
```

`link_shape` was only ever applied as a wrap class (`.sf-lnk-oval .sf-linkbtn`),
and `.sf-linkbtn` is the **legacy flat link list** — not `LinkBlock`. So setting
a page shape did nothing to any block.

Fixed by making the page shape a *variable* rather than only a class:

```js
'--sf-link-radius': LINK_RADIUS[theme.link_shape] ?? LINK_RADIUS.oval,
```
```css
border-radius: var(--lkb-shape, var(--sf-link-radius, var(--r-full)));
```

> **Transferable:** a class-based style and a variable-based style are two
> different mechanisms, and one cannot fall back to the other. If a value has to
> participate in a cascade, it has to be a variable.

---

## 4 · The preview was reading the wrong opacity

`LivePreview` computed the link fill from `product_opacity`, so the Links
panel's own opacity slider moved nothing in the preview even though it worked on
the live page. Now `link_opacity ?? product_opacity ?? 100`, matching.

The preview also gained `--lp-link-fg` and `--lp-link-radius`, which it simply
didn't have — the text-colour and shape controls had no preview feedback at all.

**A preview that silently ignores a control is worse than no preview**: it tells
you the control is broken. Every var the live page reads, the preview must read
too, even though (note 180 §8) it deliberately re-implements the *rendering*.

---

## Files
`src/lib/storefront.js` — five `featured_*` keys
`src/app-pages/Storefront.jsx` — `LINK_RADIUS`, `featuredVars`, wrapper
`src/components/LinkBlock.jsx` — radius falls through the page var
`src/app-pages/StorefrontEditor.jsx` — "Profile links" + "Featured links"
panels, `lpFeaturedVars`, preview link vars

## Still open
- `LINK_SHAPES` (block level) speaks `pill / rounded / square`; the theme keys
  speak `rounded / oval / sharp / full`. Same concept, two vocabularies. Worth
  unifying before a third consumer appears.
- `medium` block size accepted on read, not offered in the picker (from 180)

---

## Exercises

1. **Prove the "emit nothing" rule to yourself.** In `featuredVars`, change the
   text-colour branch to always emit — `v['--sf-link-fg'] = theme.featured_link_text_color`
   with no `if`. Set a page-level link text colour and leave the featured one
   blank. What colour do featured links render, and *why* is it not the page
   colour? Name the exact CSS behaviour responsible.

2. **Add a fifth cascade level.** Suppose a single *link* could override its
   block's colour. Where would you emit the variable, and what would the
   fallback chain in `LinkBlock.jsx` look like? Write the `var()` expression.

3. **Find the class-vs-variable bug pattern elsewhere.** `product_glow` is
   applied as `sf-glow-*` (a class). Could a product card ever need to override
   it the way a block overrides shape? If so, what would you change first?

4. **Break the preview honestly.** Add a new theme key, wire it into
   `Storefront.jsx` only, and use the control. Describe what the user
   experiences. Then write down the rule you'd give a teammate to stop it
   happening — and decide whether that rule is enforceable by a script.

5. **Cost the fork.** Sketch what this feature would have looked like as a
   parallel `featured_*` style system with no inheritance: list every file that
   would need a second code path, and every future feature that would need
   building twice. Was 15 lines of `if` worth it?

---

## 9 · Addendum (24 Aug) — placement moved to the block, and glow got targets

### Placement is a container property now (migration **033**)

Migration 032 argued *against* two blocks:

> "Two blocks would encode a limitation as structure. A creator can mix featured
> and normal links inside one block instead of maintaining two lists."

Wrong, and it took using it to see why. A block owns **a title, a layout and a
colour set**, and featured links render in a **different page region**. So a
mixed block printed its title twice — once in the profile card, once above the
products — with one layout applied to two visually unrelated groups. The
"freedom" to mix was the absence of a boundary the page already had.

`store_blocks.placement` (`'profile' | 'featured'`) replaces the per-link
`featured` star. The backfill splits every mixed block into a profile block and
a featured sibling carrying the same title/layout, then moves the featured links
across. `store_links.featured` stays for rollback, same reasoning 032 used for
`placement`.

The editor now shows two labelled sections with their own **Add block**, and the
block's Settings tab leads with **Where this block appears**.

> **Transferable:** if two items in one container render in two different
> places, the container is wrong — not the items. A per-item flag that changes
> which region something renders in is a container boundary in disguise.

### Glow targets

One slider lit the name, avatar, card, links and icons simultaneously, so tuning
it for one wrecked the others. `theme.glow_targets` is an array of surface ids;
`glowVars()` emits one variable per surface, each either the master value or
`0px`:

```js
'--sf-glow-name': px(on('name')),
'--sf-glow-avatar': px(on('avatar'), 2.4),
'--sf-glow-links': px(on('links')),
…
```

Each consumer still reads exactly **one** variable and knows nothing about
targets — adding a surface later is a line in `glowVars`, not a conditional in
the CSS. `undefined` means all-on, so existing storefronts are unchanged.

The preview calls the *same* `glowVars` and rescales the result to 65%, so there
is one source of truth for which targets are lit.

> **Transferable:** push a conditional up into the value, not down into every
> consumer. Five gated CSS rules would have been five places to forget.

### Also
- Chips (`.std-chip`) and block-list chips now signal state with **fill + a
  tick**, not fill alone. A colour-only difference at ~3:1 was the contrast
  complaint.
- `GLOW_TARGETS` / `glowVars` live in `lib/storefront.js`, not the Storefront
  page — importing them from the page pulled the whole public storefront into
  the editor bundle.

## Exercises (addendum)

6. **Read migration 033's backfill and find the failure case.** It matches a
   profile block to its featured sibling by `(creator_id, position)`. What
   happens if a creator already had two blocks at the same position? Write the
   query that would tell you whether any account is in that state.

7. **Justify the reversal.** 032 and 033 make opposite arguments from the same
   facts. Write two sentences on what changed between them — and decide whether
   032 was wrong when written, or only wrong once blocks had titles.

8. **Break the glow default.** Change `on()` in `glowVars` so a missing
   `glow_targets` means "none selected" instead of "all". What do existing
   storefronts look like on next load, and why is a falsy default dangerous for
   any key added after launch?
