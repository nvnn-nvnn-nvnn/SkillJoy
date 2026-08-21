# 160 — Click-to-enter centering: the axis I missed

Date: 2026-08-20

Follow-up correcting [note 155](155-customization-glow-toggle-location-centering.md),
which claimed the splash centering was fixed. It was fixed on **one axis**.

## What was still wrong
On mobile the "click to enter" text sat about 30px above centre.

Note 155 diagnosed the desktop case correctly: a logged-in visitor has the 248px
app rail on screen, `.sf-splash { inset:0 }` ignores it, so the text centred
~124px left of where the page visually centres. Fix was
`left: var(--shell-offset, 0px)`.

But that fix is **horizontal only**, and on mobile `--shell-offset` is `0px` —
the drawer overlays rather than pushing. So on the exact viewport where the
complaint came from, the fix did nothing.

The mobile case is the *same bug rotated 90°*. Below 900px the left rail is
replaced by `.sb-topbar`: 60px tall, `z-index: 190`, painting over the splash's
`z-index: 100`. The splash still spanned `top: 0` to `bottom: 0`, so it centred
against the full viewport height while the top 60px was covered. Half of 60 is
the 30px offset.

## Fix
Inset on both axes, each from the variable that describes that axis:

```css
.sf-splash,
.sf-loading {
  position: fixed;
  top:    var(--app-header-h, 0px);   /* mobile top bar   */
  left:   var(--shell-offset, 0px);   /* desktop side rail */
  right: 0; bottom: 0;
}
```

Both variables already existed — `--shell-offset` from note 155, `--app-header-h`
from [note 157](157-sticky-offsets-below-app-header.md). Nothing new was needed;
the second one just was not applied here. `.sf-loading` had the identical defect
and got the identical fix, so the loader and the gate agree on where centre is.

## The actual lesson

> **Centering only works if the box matches what the visitor can actually see.**

`display:flex; align-items:center; justify-content:center` is not the interesting
part — that was already correct in both the broken and fixed versions. Centering
is always relative to a box, and the bug was never the alignment, it was the box.
A `position:fixed` layer defaults to the *viewport*, which is not the same as the
visible area whenever fixed chrome overlaps it.

Two smaller lessons underneath:

1. **App chrome exists on two axes and they swap at a breakpoint.** This app is a
   side rail on desktop and a top bar on mobile. A layout fix that handles one
   will silently miss the other — and worse, the desktop fix *looks* complete
   because the desktop case now works.
2. **Verify a centering fix on the viewport that reported it.** Note 155 reasoned
   from `showSidebar` being true on storefront routes, which is real, but that
   reasoning only ever described desktop. The report said mobile.

---

# Part 2 — the actual cause (the box was never the problem)

Both fixes above are real, but neither was what the user was seeing. After them
the message still "hugged the left" on small devices.

## The real bug
`.sf-splash-text` had **no `text-align`**.

`splash_text` is creator-supplied, up to 40 characters, rendered at 14px
UPPERCASE with `letter-spacing: .24em`. That tracking is enormous — roughly 3.4px
of extra space per character — so a 40-char message measures ~500px and **wraps on
every phone**.

When it wraps, the flex parent still centres the *box* perfectly. But the box is
now as wide as the space allows, and text inside a block defaults to
`text-align: start`. So every line sits flush left inside a correctly-centred box.

That is why it looked left-hugging on narrow screens and fine on wide ones: on a
desktop the message fits on one line, the box shrink-wraps to the text, and
centring the box *is* centring the text. **The one-line case hides the bug.**

```css
.sf-splash-text {
  text-align: center;              /* the fix */
  line-height: 1.9;                /* wrapped uppercase at .24em needs air */
  max-width: min(32ch, 84vw);      /* never touch the screen edges */
  margin-right: -.24em;            /* see below */
}
```

## The `margin-right: -.24em`
`letter-spacing` adds its space **after the last glyph of every line**, including
the final one. So a centred line carries one trailing space's worth of dead width
on its right, and reads about half a space left of true centre. Pulling the box
in by exactly one tracking unit cancels it.

Small, but this is *why* heavily-tracked centred type so often looks subtly
off — and it compounds with a real centring bug, which is part of what made this
one hard to see.

## The lesson that actually mattered

> **Centring a container is not centring its contents.**
> `justify-content: center` positions the box. `text-align` positions the text
> *inside* it. If the box can be wider than its text — which happens the moment
> the text wraps — you need both.

And the meta-lesson, since this took three passes:

> **A layout bug that only appears at one size is usually the size where the
> element's box stops shrink-wrapping its content.** Both earlier fixes were
> plausible and both were partly right, which is exactly why I kept confirming
> them instead of re-deriving from scratch. When a fix doesn't resolve the
> report, re-open the diagnosis — don't refine the previous answer.

**Checked:** the editor's live preview does not render a splash at all, so there
is no second copy of this CSS to keep in sync.

## Files
- `src/app-pages/Storefront.jsx` (`.sf-splash`, `.sf-splash-text`, `.sf-loading`)
