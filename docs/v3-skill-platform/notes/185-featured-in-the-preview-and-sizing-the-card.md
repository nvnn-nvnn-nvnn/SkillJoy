# 185 — Featured links in the preview, and actually sizing the card

Date: 2026-08-24
Migrations: none (033 already applied)

---

## 1 · The featured section was rendering, and invisible

The wiring was all present — `blocks` loaded, `groupsFor('featured')` grouping,
`PreviewLinkGroup` rendering, `lpFeaturedVars` applying the colour overrides.
It still looked like nothing was there.

The cause:

```jsx
<div style={lpFeaturedVars(theme)}>     {/* ← no className */}
```

Everything around it is inset from the preview frame — `.lp-inner` is the
profile card, `.lp-list` has `margin:14px 14px 20px`. This one div had **only an
inline style object**, so it sat flush against the frame edges and read as
broken chrome rather than as a section.

```css
.lp-featured { margin:16px 14px 0; }
.lp-featured .lpb:first-child { margin-top:0; }
```

> **Transferable:** a wrapper added purely to carry CSS variables is easy to
> create and easy to forget to *lay out*. If a `<div>`'s only attribute is
> `style={someVars}`, ask whether it also needs a class — it is participating in
> the layout whether you meant it to or not.

This is a quieter cousin of the "control exists and nothing listens" family
(LANDMINES §13): here the code ran correctly and the **result** was unreachable.
Worth separating the two failure modes when debugging — *is nothing happening,
or is something happening off-screen?*

---

## 2 · Why "make it bigger" took three passes

Each round raised the numbers and the screenshot came back the same size. The
reason was structural, not numeric.

**Classic was shrinking itself.** Every other style used `--lkb-thumb`
directly; Classic multiplied it:

```css
.lkb-classic .lkb-thumb { width: calc(var(--lkb-thumb) * 0.66); }
```

So raising `--lkb-thumb` from 48→58→64px moved Classic from 31→38→42px while
Cards went 48→58→64. **A style that scales the shared variable does not respond
to the shared variable the way the others do** — it responds two-thirds as much,
which is invisible across one increment and obvious across three.

Now `0.9`, chosen because Classic's thumb is a *circle*: at equal width a circle
has ~78% of a square's area and reads smaller, so it needs a nudge down, not a
third off.

**And the smallest combination is the one being looked at.** Classic + size S
compounds: the smallest style multiplier against the smallest size token. Any
"is it big enough" judgement has to be made there, not on the default.

| Classic + S | before today | now |
|---|---|---|
| thumbnail | 30px | 58px |
| label | 13.5px | 17px |
| row padding | 10/13px | 15/17px |

> **Transferable:** when a change to a shared token doesn't show, check whether
> the thing you're looking at *derives* from that token instead of using it.
> Multipliers on a design token quietly opt an element out of the scale.

---

## 3 · The editor header says where you are

Two changes to the block editor:

**Back** was a 5px-padded text link reading "Back". It is now a real pill button
reading **"← All blocks"** at 14.5px/800 — it leaves a screen, and it should
look like it does.

**A placement crumb** sits beside it, because a placement-scoped editor that
never shows the placement has the same gap the two-section list closed one level
up (note 183 §1):

| | shown as |
|---|---|
| Profile links | accent-tinted, link icon |
| Featured links | solid accent, star icon |
| Unsorted | danger-coloured, "not in a block" |

Icon **and** wording change with the state, not just colour — the greyscale rule
from note 183 §5. Unsorted is red on purpose: those links render in no
predictable region, and they are exactly the rows worth noticing.

---

## Files
`src/app-pages/StorefrontEditor.jsx` — `.lp-featured` layout, preview sizing
`src/components/LinkBlock.jsx` — Classic multiplier 0.66→0.9, size floor raised
`src/components/LinkBlockEditor.jsx` — Back button, placement crumb

---

## Exercises

1. **Find the other invisible wrappers.** Grep the codebase for
   `<div style={` with no `className`. For each, decide whether it is purely a
   variable carrier or whether it is silently affecting layout. How would you
   have caught the `.lp-featured` one without a screenshot?

2. **Prove the multiplier problem.** Set `--lkb-thumb` to 200px. Screenshot
   Classic beside Cards. Then set the Classic multiplier to `1` and repeat. At
   what value does Classic stop looking undersized, and does that value depend
   on the thumbnail being a circle?

3. **Justify 0.9.** A circle inscribed in a square covers ~78.5% of its area.
   Work out what multiplier makes a circular thumbnail *look* the same size as a
   square one, and say why the answer isn't `1 / 0.785`.

4. **Test the compounding.** List all eight combinations of the four styles ×
   two sizes and write down the rendered thumbnail size for each. Which is
   smallest, which is largest, and is the range defensible as one design system?

5. **Separate the two failure modes.** Write the two-question checklist you'd
   run when a feature "doesn't show up" — one question that distinguishes *the
   code never ran* from *the result rendered somewhere you can't see it*. Which
   tool answers each?
