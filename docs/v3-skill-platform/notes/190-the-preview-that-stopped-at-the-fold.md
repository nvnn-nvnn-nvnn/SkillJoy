# 190 — The preview that stopped at the fold, and a control that couldn't win

Date: 2026-08-25
Migrations: none

Four bugs. Three of them share a root: **the same visual rule behaves
differently in the preview than on the live page, because the preview lives
inside a scroll container and the page does not.**

---

## 1 · The background clipped at the first screenful

Reported as "the background is clipping out in the live preview". Screenshot
showed artwork behind the profile card, then a hard cut, then featured links
and products sitting on bare editor chrome.

```css
.lp     { position:relative; height:100%; overflow-y:auto; }  /* scroll container */
.lp-bg  { position:absolute; inset:0; }                        /* ← the bug */
```

**An absolutely positioned child resolves `inset:0` against its containing
block's PADDING BOX — the visible area — not against the scrollable content
height.** So the background was exactly 600px tall in a preview whose content
ran to 1400px. Everything past 600px had nothing behind it.

The live page never had this, and that is the interesting part:

```css
.sf-bg { position:fixed; inset:0; }   /* viewport, and the document scrolls */
```

`fixed` resolves against the viewport, and the real storefront scrolls the whole
document. Both facts are false in the preview — it scrolls a *box*, and `fixed`
would escape the phone frame entirely and cover the editor behind it.

> **Transferable:** `position:fixed` on a full-page backdrop and
> `position:absolute` inside a scrolling box are not two spellings of the same
> idea. The moment a "page" becomes a scrollable element, every full-bleed layer
> in it needs re-deriving.

### The scroll-container equivalent

```css
.lp-bg {
  position: sticky; top: 0;
  height: var(--lp-preview-h);
  margin-bottom: calc(-1 * var(--lp-preview-h));
}
```

Sticky lays the element out in normal flow at the top, then pins it to the
scrollport while content scrolls over it. The negative margin removes the height
it would otherwise contribute, so it doesn't lengthen the scroll.

### I got the margin wrong first

The first version used `margin-bottom: -100%`.

**Percentage margins — including vertical ones — resolve against the containing
block's WIDTH.** On a ~300px-wide, 600px-tall frame that pulls back 300px
instead of 600px, leaving 300px of dead scroll below the content.

This is one of the genuinely counter-intuitive corners of CSS: `height: 50%` is
half the height, `margin-top: 50%` is half the *width*. It exists so that a
percentage-padding box can hold a fixed aspect ratio, and it catches everyone
once.

Fixed by making it a real length. `.std-preview-frame` is `height: 600px`, so
that number now lives in one variable both rules read:

```css
.lp { --lp-preview-h: 600px; }
```

> **Transferable:** if you write a percentage in a vertical margin or padding,
> stop and check you meant width. You almost never did.

### The same bug, twice more

`.lp-bgvideo` and `.lp-overlay` were both `position:absolute; inset:0` too — so
background video and the rain/snow/VHS effects also stopped at the fold. Nobody
had reported those, because the effects are subtle and most testing happens
above the fold.

Found by grepping the preview's stylesheet for `position:absolute` next to
`inset:0`, rather than by waiting for three more reports.

---

## 2 · A stacking bug that hadn't surfaced yet

Once the background became full-height, this would have broken immediately:

| | before |
|---|---|
| `.lp-inner` (profile card) | `position:relative; z-index:1` |
| `.lp-featured` | *nothing* |
| `.lp-list` (products) | *nothing* |

**A positioned element paints above a non-positioned sibling regardless of
document order.** While the background only covered the top 600px this was
invisible. Full-height, it would have painted over the products.

Fixed before it could be reported: background `0` → overlay `1` → card,
featured, products `2`.

> **Transferable:** when you change *how much space* a layer occupies, re-check
> the stacking of everything it now overlaps. Growth turns latent z-index bugs
> into live ones.

---

## 3 · The page-level shape control that could never win

Reported as "profile links button shape not reflecting, nor profile links
colour". Both controls were wired correctly. The data explains it:

```
theme.link_shape:  "sharp"
block "My Links"         profile   layout.shape: "rounded"   ← wins
block "AFFILIATE LINKS"  featured  layout.shape: "square"    ← wins
```

A block's own shape beats the page-level setting **by design** — that is the
block → page → theme cascade from note 181 §1, working exactly as specified.

Note 180 §2 changed `DEFAULT_BLOCK_LAYOUT.shape` to `''` so blocks *inherit*.
But blocks created before that carry a concrete value, and nothing ever
migrated them. So an account that never touched a block-level shape control
still has every block overriding the page.

Colour was genuinely fine — those blocks have `bg: ""` and `fg: ""`, so page
colour did apply. But when the shape control visibly does nothing, the whole
panel reads as broken. **One dead control discredits the ones next to it.**

### The fix is not to change the cascade

The cascade is right. What was wrong is that the losing control said nothing.
Customize → Profile links → Button shape now reports it:

> **2 link blocks are overriding this** (My Links, AFFILIATE LINKS) — a block's
> own shape always wins, so changing it here does nothing to them.
> **[ Use this shape everywhere ]**

The button writes `shape: ''` to every overriding block. It **removes what was
winning** rather than guessing a replacement value — the block goes back to
inheriting, which is what `''` means everywhere else in this system.

> **Transferable:** a correct precedence rule still produces a broken-feeling UI
> if the losing control gives no feedback. Anywhere you implement a cascade, the
> lower level needs to be able to say "something above me is winning, here's
> what, here's how to stop it."

This is the inverse of LANDMINES §13. There the control existed and nothing
downstream listened. Here everything listens correctly — and something nearer
the element is louder.

---

## 4 · Link labels were being truncated

`white-space: nowrap; text-overflow: ellipsis` on `.lkb-label` and `.lpb-label`
cut titles the creator had typed.

Third instance of the note 184 §3 pattern: **a style may constrain user content
— truncate it, clamp it, shrink it — it may not delete it.**

Now two lines with `overflow-wrap: anywhere`, so a long unbroken word breaks
rather than overflowing the card. Classic keeps one line, because that style is
a single row by design.

And a **40-character cap on the input**, enforced where the value is *typed*
rather than where it is rendered. A limit you can see while writing beats a
truncation you discover on the published page.

---

## 5 · A precedence bug I introduced earlier

```js
const bgStyle = animatedBg ?? theme.bg === 'solid' ? { … } : …
```

`??` binds tighter than `?:`, so this parsed as:

```js
(animatedBg ?? (theme.bg === 'solid')) ? { … } : …
```

When `animatedBg` was an object it was truthy, so an **animated** background
took the plain-solid branch. It looked almost right — the solid branch paints
`bg_color`, which is the animated ground colour — which is why it survived a
build, a lint pass and several screenshots.

> **Transferable:** the mixed-operator bugs that survive are the ones whose
> wrong answer resembles the right one. `??` next to `?:` always wants
> parentheses, even when it happens to work.

---

## Files
`src/app-pages/StorefrontEditor.jsx` — sticky background/video/overlay,
stacking order, override notice + clear, `bgStyle` precedence, label wrap
`src/components/LinkBlock.jsx` — label wraps to two lines
`src/components/LinkBlockEditor.jsx` — 40-char cap on link titles

## Still open
- Nothing migrates pre-180 blocks off their concrete `shape`. The button fixes
  it per-account, on demand. A migration would fix it for everyone — but it
  cannot distinguish "left over from an old default" from "deliberately chosen",
  which is exactly why this is a button and not a migration.

---

## Exercises

1. **Reproduce the containing block.** Put `.lp-bg` back to
   `position:absolute; inset:0`. Add enough products to make the preview scroll
   twice its height. Measure where the background ends. Now explain, in one
   sentence, what `inset:0` was measuring against.

2. **Prove the percentage trap.** Set `margin-bottom:-100%` on `.lp-bg` and make
   the preview frame 300px wide × 900px tall. How much dead scroll appears
   below the content? Predict the number before you look.

3. **Find the next one.** Grep the preview's stylesheet for `position:absolute`
   paired with `inset:0` or `top:0;bottom:0`. Which remaining layers assume the
   container's visible height equals its content height?

4. **Break the stacking on purpose.** Remove `z-index:2` from `.lp-list`. Why do
   the products disappear behind the background even though they come *later*
   in the DOM? State the rule.

5. **Argue the cascade.** Someone proposes making the page-level shape win over
   the block. Give the strongest case for it, then the strongest case against,
   then say which you'd ship and what the UI would owe the user either way.

6. **Audit for silent losers.** Every cascade in this app (block → featured →
   page → theme) has levels that can be overridden. Which other page-level
   controls can be silently beaten by a block, and do any of them say so?
