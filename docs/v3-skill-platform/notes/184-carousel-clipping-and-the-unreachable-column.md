# 184 — Carousel clipping, and a column nobody could reach

Date: 2026-08-24
Migrations: none

Three bugs in the link blocks, with three different causes worth separating.

---

## 1 · Carousel: clipped by an ancestor, not broken itself

The CSS looked right:

```css
.lkb-carousel .lkb-items {
  display:flex; flex-direction:row; overflow-x:auto;
  width:100vw; margin-left:50%; transform:translateX(-50%);   /* viewport breakout */
  padding:2px max(18px, calc(50vw - 270px + 18px));
}
```

That is the standard "escape the content column" trick. It failed because of a
rule in a **different file**:

```css
.sf-panel { … overflow:hidden; }     /* clips the in-card banner */
```

Profile blocks render inside `.sf-panel`. So the row was cut to the panel box
while `margin-left:50%` still shoved it right — most cards ended up outside the
visible area, and what remained looked like a broken layout rather than a
clipped one.

**The tell that this was environmental, not a CSS mistake:** featured blocks
render *outside* the panel, so the exact same class behaved differently in the
two regions. Whenever one rule produces two results, the variable is the
ancestor chain.

Fixed by dropping the breakout — the carousel now scrolls inside its container:

```css
.lkb-carousel .lkb-items {
  display:flex; flex-direction:row; overflow-x:auto;
  overscroll-behavior-x:contain; scroll-snap-type:x mandatory;
  scrollbar-width:none; padding:2px 1px 6px;
}
```

Edge-to-edge was cosmetic. This version works in the profile card, in the
featured section, and in the editor preview — which the breakout never did,
because the preview frame is a few hundred pixels wide and `100vw` is not.

> **Transferable:** `overflow:hidden` anywhere above you defeats every viewport
> breakout below you, silently. Before reaching for `width:100vw`, check every
> ancestor — or don't reach for it at all.

---

## 2 · The button: a column unreachable from both ends

`cta_label` has been in `store_links` and in `LINK_COLS` since before blocks
existed. It had:

- **no editor field** — nothing could write it
- **no renderer** — nothing would read it

So it round-tripped through every query, appeared in every payload, and was
invisible. Not a bug in any one file; a **gap between two files that each
assumed the other handled it.**

Both ends now exist: a "Button text (optional)" field on each link row, and a
`.lkb-cta` pill in the block renderer.

One markup detail worth keeping:

```jsx
{l.cta_label?.trim() && <span className="lkb-cta">{l.cta_label}</span>}
```

A `<span>`, not a `<button>`. The whole row is already an `<a>`, and nesting
interactive elements is invalid HTML and breaks keyboard navigation — the outer
link stops being reachable in tab order in some browsers. It only has to *look*
like a button.

> **Transferable:** a column that no UI writes and no view reads is not
> "unused", it is **unfindable**. When adding a field, land both ends in the
> same change or neither.

---

## 3 · The description: hiding what someone typed

```css
.lkb-classic .lkb-desc { display:none; }
.lkb-grid    .lkb-desc { display:none; }
```

This is the *third* time this exact pattern has bitten (note 182 §2 was the
Classic thumbnail). A style choice silently discarding content the creator
entered by hand. The field is there, they filled it in, and the page throws it
away based on an unrelated setting.

Clamped instead of hidden:

```css
.lkb-desc          { display:-webkit-box; -webkit-box-orient:vertical;
                     overflow:hidden; -webkit-line-clamp:3; }
.lkb-classic .lkb-desc { -webkit-line-clamp:1; }
.lkb-grid    .lkb-desc { -webkit-line-clamp:2; }
```

Classic stays a tight row because the description is **one line**, not because
it is gone.

> **Transferable:** styles may constrain user content — truncate it, shrink it,
> clamp it. They may not delete it. If a layout genuinely cannot show a field,
> the editor should not offer that field for that layout.

⚠️ **This changes existing pages.** Any link with a description sitting in a
Classic or Grid block will start showing one to two lines that were previously
hidden. That is the fix working, but it is a visible change you did not make.

---

## 4 · The preview matches

All three land in `LivePreview` too — description, CTA pill, and a carousel that
scrolls rather than sitting still. A preview that silently omits a field teaches
you the field is broken (note 181 §4).

---

## Files
`src/components/LinkBlock.jsx` — carousel containment, `.lkb-cta`, clamped desc
`src/components/LinkBlockEditor.jsx` — "Button text" field on each link row
`src/app-pages/StorefrontEditor.jsx` — preview mirrors all three

---

## Exercises

1. **Reproduce the clipping.** Put `width:100vw; margin-left:50%;
   transform:translateX(-50%)` back on `.lkb-carousel .lkb-items`. Compare a
   carousel block in the profile card against one in the featured section. Then
   delete `overflow:hidden` from `.sf-panel` and look again — what breaks
   instead, and why is that rule there?

2. **Find the other breakouts.** Grep the codebase for `100vw`. For each hit,
   name the nearest ancestor with `overflow` set. How many are one CSS change
   away from the same bug?

3. **Audit for unreachable columns.** `LINK_COLS_LEGACY` lists ten columns. For
   each, find the editor field that writes it and the JSX that renders it. Any
   with zero of either is the next `cta_label`.

4. **Break the CTA markup.** Change `<span className="lkb-cta">` to
   `<button className="lkb-cta">`. Tab through the page. What happens to the
   link itself, and what does the HTML validator say?

5. **State the rule.** Write the one-sentence policy that would have prevented
   both the Classic thumbnail bug (182) and the Classic description bug (this
   note). Then find one more place in the codebase that violates it.

6. **Decide the harder case.** Grid tiles are narrow; a three-line description
   would dominate them. Clamping to two lines was the call here. When *would*
   hiding a field be correct — and how should the editor communicate it?

---

## 5 · Addendum — the same bug in the "Full width" link shape

Grepping `100vw` while writing exercise 2 turned up a second live instance:

```css
.sf-lnk-full .sf-linkbtn { border-radius:0; width:100vw; margin-left:50%; transform:translateX(-50%); … }
```

`.sf-linkbtn` also renders inside `.sf-panel`, so the **Full width** link shape
was clipped exactly like the carousel — it had never worked.

Fixed with a negative inline margin equal to the panel's padding, which reaches
the panel border precisely:

```css
.sf-lnk-full .sf-linkbtn { border-radius:0; margin-inline:-22px; padding-inline:22px; }
```

Inside a card, "full width" means the card's width. Trying to make it mean the
viewport's width was the original mistake.

The remaining `100vw` hits are a comment in `index.css` warning about this exact
trick and one in `Notifications.jsx` on a fixed-position element, where it is
correct.

---

## 6 · Addendum 2 — sizing, and an audit of every Layout control

### Thumbnails and the CTA got their real size

Both were sized for a UI that no longer exists. The 44–56px thumbnail dates from
when a link row was an icon plus a label; now that a card carries an image, a
title, a description **and** a button, that square read as an icon rather than
as the picture the creator uploaded.

Thumbnails are driven by `--lkb-thumb` so the **S/L size control scales them**,
instead of two settings disagreeing about how big a row should be:

```css
.lkb-size-small { --lkb-thumb:48px; }
.lkb-size-large { --lkb-thumb:72px; }
.lkb-thumb { width:var(--lkb-thumb, 62px); height:var(--lkb-thumb, 62px); }
```

Grid 84→132px, carousel 96→140px, carousel cards 190→220px wide (a taller image
in a narrow card reads as a column).

The CTA went from a pill hugging the text to a **full-width solid bar** — a call
to action is the thing you want clicked, so it gets the weight of one. Classic
keeps it inline and compact, because that style is a single row and a
block-level button would break the line.

One thing tried and reverted: colouring the button by **inverting the row**
(`background: var(--lkb-fg)`, `color: var(--lkb-bg)`). Clever, and wrong — the
row background is usually a translucent `color-mix`, so using it as *text* gives
almost no contrast. White on a slightly darkened fill is predictable for every
accent a creator can pick:

```css
background: color-mix(in srgb, var(--lkb-fg, var(--sf-link-fg, var(--accent))) 88%, black);
color: #fff;
```

### `medium` was rendering with no size at all

`LINK_SIZES` dropped to two options, but blocks saved earlier still hold
`size: 'medium'`. That produced `class="lkb-size-medium"`, which matches **no
rule in any stylesheet** — so padding, label size and thumbnail all fell back to
base values belonging to no size. Coerced at the one boundary every renderer
goes through:

```js
if (!LINK_SIZES.some(s => s.id === out.size)) out.size = 'large';
```

> **Transferable:** when you remove an enum value, the old rows do not
> disappear. Coerce unknown values at the resolver, not with dead CSS in every
> consumer.

### The audit: four controls had no preview at all

Grepping each control's class in both renderers found `align`, `outline`,
`shadow` and `columns` present live and **entirely absent** from the preview —
four Layout controls that moved nothing on screen. Same class of bug as note 181
§4, found by checking rather than by someone reporting it.

All present in both now:

| Control | Live | Preview |
|---|---|---|
| style ×4 | ✓ | ✓ |
| size S/L | ✓ | ✓ |
| align ×3 | ✓ | ✓ |
| outline / shadow | ✓ | ✓ |
| columns | ✓ | ✓ |
| shape | ✓ | ✓ |
| bg / fg / heading | ✓ | ✓ |
| description / CTA | ✓ | ✓ |

> **Transferable:** "does every control have a consumer?" is a *grep*, not a
> code review. One loop over the control names across both renderers found four
> bugs in a minute. Worth doing whenever a second renderer exists.

## Exercises (addendum)

7. **Write the audit as a script.** Turn that grep loop into
   `scripts/check-layout-parity.cjs`: read the class names out of `LINK_STYLES`,
   `LINK_SIZES` and `DEFAULT_BLOCK_LAYOUT`, assert each appears in both
   renderers, exit non-zero otherwise. Then decide whether it belongs in the
   pre-build hook next to `check-style-backticks.cjs` — what's the false-positive
   risk?

8. **Justify the coercion site.** `resolveBlockLayout` is called by three
   renderers. Why coerce `medium` there rather than in `listBlocks`, or in a
   migration that rewrites the JSONB? Give one argument for each of the three
   and pick.

9. **Test the CTA contrast.** `blocks.js` already exports `contrast()`. Pick five
   accent colours a creator might plausibly choose, compute the ratio of `#fff`
   against `color-mix(… 88%, black)` for each, and find one that fails 4.5:1.
   What should the editor do about it?

---

## 7 · Addendum 3 — the card is a column of two things

The button was `display:block; width:100%` and still didn't span the card,
because it lived **inside `.lkb-body`** — the flex child holding the title and
description. `100%` meant 100% of the *text column*, so it stopped where the
thumbnail began.

The shape wanted is:

```
┌─────────────────────────────┐
│ [img]  Title                │   ← .lkb-main (a row)
│        Description…         │
├─────────────────────────────┤
│      BUTTON, FULL WIDTH     │   ← .lkb-cta (a sibling)
└─────────────────────────────┘
```

So `.lkb-item` became a **column** of exactly two children: `.lkb-main` (the
row) and `.lkb-cta`. Every style variant now reshapes `.lkb-main`, never
`.lkb-item` — Grid and Carousel stack the image above the text by flipping the
*row*, and the button stays full width underneath in all four styles.

> **Transferable:** `width:100%` is 100% of the *containing block*, not of what
> you see. When a full-width element stops short, the question is never the
> width — it is which parent it is inside.

Everything up in size too: labels 15.5→18px, descriptions 13→15px, block titles
16.5→19px, thumbnails 62→76px base (58 small / 88 large), and the CTA to 16px
with 18px of vertical padding.

### Two more bugs the restructure exposed

**Outline never used the block's colour.** This rule sat *after* the base
`.lkb-item`, at equal specificity:

```css
.lkb-item { border-color:transparent; }            /* always won */
.lkb-outline .lkb-item { border-color:var(--sf-link-border, …); }  /* page level only */
```

It was a patch for the base rule defaulting to a visible border — and it beat
any block-level colour. Fixed at the source: the base border is declared
transparent, and Outline reads `var(--lkb-fg, var(--sf-link-border, …))`.

**Shadow switched the glow off.** `.lkb-shadow .lkb-item` *replaced*
`box-shadow`, which is where `--sf-glow-links` lives. Both now share one
declaration.

> **Transferable:** `box-shadow` is a single property. Any rule that sets it
> deletes every other shadow on that element — including one an unrelated
> feature is using. Same for `transform`, `filter` and `background`.

## Exercises (addendum 3)

10. **Find the specificity trap yourself.** Put `.lkb-item { border-color:
    transparent; }` back. Set a block text colour and turn Outline on. Why does
    the border ignore your colour, and why does moving the rule *above* the base
    declaration not fix it either?

11. **Grep for shadow collisions.** Search every `box-shadow` in
    `Storefront.jsx` and `LinkBlock.jsx`. Which elements have two rules that
    could both apply? For each, decide whether the later one should add or
    replace — and say how you'd notice if you got it wrong.

12. **Predict before you look.** Before rendering: with `.lkb-item` a column and
    `.lkb-main` a row, what happens to a Grid card whose link has no image and
    no description? Sketch it, then check.
