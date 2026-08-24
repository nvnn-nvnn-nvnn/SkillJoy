# 175 — Guide: fixing the cover banner properly, and finally guarding the backtick trap

Date: 2026-08-21
Migrations: none

The cover banner was reported as "all fucked up." It was. Two separate causes,
neither of them the one I'd have guessed.

---

## 1 · What was actually wrong

I'd shipped the cover banner in 168, "fixed" it in 172, and it still looked
broken. Reading it properly this time, rather than reasoning about it:

### It wasn't layering, and it wasn't the breakout

Both of those I'd already fixed and both were fine. There *was* a dead rule:

```css
.sf-coverbanner ~ .sf-tiltwrap, .sf-coverbanner ~ .sf-panel { position:relative; z-index:1; }
```

`.sf-panel` is **not a sibling** of the banner — it's a child of the tilt
wrapper — so that half never matched. And the other half was redundant, because
`.sf-panel` already carries `position:relative; z-index:1` in its own rule.
The layering worked by accident, not because of that line. Deleted.

### It was geometry

```css
.sf-coverbanner { height: 340px; mask-image: linear-gradient(180deg, #000 0%, #000 45%, transparent 100%); }
.sf-panel-cover { margin-top: 132px; }
```

Three numbers, chosen independently, that fight each other:

- The banner is **340px** tall.
- The card starts at **132px** — so it covers everything below that.
- The mask is still **fully opaque at 45%** (153px) and doesn't finish fading
  until 340px.

Net effect: you see 132px of a 340px image, the card slams down across it while
it's still at full opacity, and the fade — the entire point of the mode —
happens *underneath the card where nobody can see it*. It reads as a random
strip pinned to the top of the page, which is exactly what was reported.

> **Transferable:** three hardcoded numbers describing one shape will drift
> apart the moment any of them is touched. That isn't a maintenance risk, it's
> a correctness risk — they were already inconsistent on the day they shipped.

---

## 2 · One variable, everything derived

```css
.sf-wrap { --sf-cover-h: 300px; }

.sf-coverbanner {
  height: var(--sf-cover-h);
  mask-image: linear-gradient(180deg, #000 0%, #000 46%, transparent 100%);
}
.sf-panel-cover { margin-top: calc(var(--sf-cover-h) * 0.62); }

@media (max-width:640px)  { .sf-wrap { --sf-cover-h: 200px; } }
@media (max-height:560px) { .sf-wrap { --sf-cover-h: 180px; } }
```

Now the height is the *only* number. The card offset is a ratio of it, so the
proportion survives any change — including the two responsive overrides, which
previously each needed their own matching card offset (and only one of them had
gotten it).

The `max-height` query is new: a 300px hero on a landscape phone is the entire
screen before any content appears.

### Why the fade has to finish

The banner is viewport-wide; the card is 540px. On desktop the banner is
therefore **visible down both sides for its full height**. If the mask were
still partly opaque at `100%`, those side strips would end on a hard horizontal
line while the middle looked fine — the kind of bug that only shows up on wide
screens. Fading fully out by the bottom edge is what makes the sides work, not
the part behind the card.

---

## 3 · The preview was lying

`StorefrontEditor`'s live preview had its own hardcoded `height:170px` and **no
card offset at all**. So the control showed one proportion and the live page
showed another.

A preview with different geometry is worse than no preview: it's confidently
wrong, and the creator only finds out after publishing.

It now mirrors the real thing — same `0.62` ratio, driven by a `--lp-cover-h`
set alongside the other preview-scale factors in the component's style object
(rather than in CSS, so all the "this is the preview's scale" decisions sit
together).

Also worth noting: the preview needs **no** `100vw` breakout. Its frame is
already the full width of its own container, so `left:0; right:0` genuinely is
full-bleed there. Copying the viewport trick would have been cargo-culting the
solution to a problem the preview doesn't have.

---

## 4 · The backtick trap, guarded at last

While writing the fix above I broke the build **for the fourth time this
session** with:

```
/* Overrides .lp-inner's `margin` shorthand. */
```

Components carry CSS as `<style>{` … `}</style>`. A backtick inside that block
terminates the template literal early; everything after it parses as JavaScript,
and the error points at a line that looks perfectly fine.

Notes 167, 170 and 173 all recorded this. Recording it three times did nothing,
because **the moment you need to remember the rule is the moment you're thinking
about CSS, not about template literals.** Writing `` `margin` `` in prose is a
completely natural thing to do.

So: `scripts/check-style-backticks.cjs`. It finds where each `<style>` literal
*actually* closes versus where the author clearly intended it to, and reports
the gap.

```
src/SaveStatus.jsx:30  stray backtick closes the <style> literal early
    …/* The `svst-error` state i…
```

**Mutation-tested before trusting it** (same discipline as note 166's `.ics`
tests): clean file passes, a backticked word injected into a CSS comment fails
with the right file and line.

Wired into `npm run build`, deliberately *before* vite:

```json
"build": "node scripts/check-style-backticks.cjs && vite build"
```

Ordering matters — the guard names the real cause, where esbuild reports a parse
error somewhere further down the file.

> **Transferable:** if you've written the same lesson in three notes, the lesson
> isn't the fix. Automate it or accept you'll keep paying for it. The tell is
> repetition, and I had three data points before acting on it.

`.cjs` and not `.js` because `package.json` has `"type": "module"` — worth
knowing before writing a Node script in a Vite project.

---

## Exercises

**1 · Should the banner height be a creator control?**
`--sf-cover-h` is now one number, which makes exposing it trivial. But every
control is permanent surface area. Decide — and if yes, note that a slider must
not be able to produce a hero taller than the viewport.

**2 · Focal point.**
`background: center top/cover` crops a portrait image badly at 300px × 100vw.
Add `banner_focal` and map it to `background-position`. This was exercise 2 in
note 172 and is still the most visible remaining gap.

**3 · Prove the side strips.**
Set a cover banner and view at 1440px and 2560px. The banner is visible either
side of the card — does the fade finish cleanly, or is there a horizontal seam?
Then set `card_opacity: 0` (ghost) and check it again.

**4 · Extend the guard.**
It only checks `<style>{` blocks. Other template literals in this codebase carry
CSS too. Generalise it — then decide whether the false-positive rate is worth
it, since a backtick inside a *JS* template literal is often legitimate.

**5 · Put the guard where it'll actually run.**
It's in `npm run build`. Is that enough if CI runs `vite build` directly, or if
someone only ever runs `npm run dev`? Add it to a pre-commit hook and say why
that's a better or worse place than the build.

**6 · Find the other three-number shapes.**
Section 1's lesson generalises. Grep the storefront CSS for hardcoded `px`
values that describe one shape across multiple rules — the avatar overlap
(`-58px`) against the panel banner height (`150px`) is a candidate. Are they
consistent right now? Prove it.

---

## Files
**New** — `scripts/check-style-backticks.cjs`
**Changed** — `src/app-pages/Storefront.jsx` (single-variable cover geometry,
dead sibling rule removed, short-viewport case),
`src/app-pages/StorefrontEditor.jsx` (preview mirrors live geometry),
`package.json` (guard runs before build)
