# 179 — Guide: the branch with no CSS, and per-block customization for free

Date: 2026-08-21
Migrations: none (032 still required — note 177)

The Links editor rebuilt against the real reference UI, three rounds lost to a
missing `<Styles />`, and a set of customization controls that needed no schema
change.

---

## 1 · A component with two returns and one stylesheet

Reported four times, escalating: *"not showing"*, *"messed up"*, *"THIS UI is
shit"*. I checked glass-panel contrast, token values, the Panel wrapper, row
borders. All wrong.

`LinkBlockEditor` has two top-level returns:

```jsx
if (!open && !viewingOrphans) {
  return ( …block list… );        // ← no <Styles />
}
return ( …block editor… <Styles /> );
```

The stylesheet lives in the JSX as a `<Styles />` component. Omit it from one
branch and **that entire branch renders with no CSS at all.**

It doesn't fail the build. It doesn't fail lint. And crucially it doesn't look
like a missing element — it looks like a *badly designed layout*, because all
the content is there, just unstyled. Every CSS refinement I made across two
rounds was real and simply never loaded.

> **Transferable:** when someone says a screen "looks broken" rather than
> "errors", check whether the stylesheet is attached before you start adjusting
> contrast. Unstyled HTML and bad design are indistinguishable in a description
> and unmistakable in a screenshot.

**The screenshot ended it in one message.** I should have asked for one three
rounds earlier — I had already learned that lesson from the crash in note 178
and didn't apply it.

### The structural version

This is a trap for any component in this codebase that carries CSS in JSX and
has more than one return path. The fix isn't vigilance:

```js
// every top-level return must carry <Styles />
returns: 2   <Styles /> uses: 1   ← MISMATCH
```

A check that counts them is trivial and worth having. Added to LANDMINES.

---

## 2 · Matching the reference, once I could see it

Screenshots of the actual product changed several decisions I'd guessed at:

| I built | Reference | Why theirs is better |
|---|---|---|
| Text pills for layout | **Visual tiles with diagrams** | A layout question is about *shape*. Recognising a diagram beats reading a word. |
| Small / Medium / Large | **S / L** | The middle option in three is the one nobody can describe — "medium" is the default wearing a label. |
| Outline: none/subtle/bold | **A switch** | "Subtle vs bold" isn't predictable from the words. |
| Visibility checkbox | **Two tiles: exposed / collapsed** | Two different shapes on the page, so show the shapes. |
| Add button at the bottom | **Full-width, top, dark** | Adding is the most frequent action; a button below a list gets *further away* the more links you have. |
| Chips row | **Block list → drill in** | The blocks are a vertical stack on the real page, so the editor should read the same way. |

The diagrams are plain CSS boxes, not SVG or an icon font — they can't drift out
of sync with the styles they describe.

> **Transferable:** I guessed at this UI twice and was wrong in the same
> direction both times — reaching for text controls where the reference used
> pictures. Ask for the screenshot at the start, not after two rebuilds.

---

## 3 · Customization that cost no migration

Asked for: block background, text colour, block shape. All three landed in the
existing `layout` JSONB:

```js
bg: '', fg: '', headingColor: '', shape: 'pill'
```

**This is why migration 032 made `layout` JSONB instead of columns.** That
decision was written down at the time as "presentation knobs will churn, and a
column per knob means a migration per knob." Four knobs later, that's exactly
what happened — and the cost was zero.

`''` means *inherit the page theme*, so every existing block is untouched until
someone picks something.

### Unset must not look like a colour

```css
.lb-swatch-theme { background: /* checkerboard */ }
```

A "theme default" swatch rendered as white is indistinguishable from *someone
chose white*. The checkerboard says "no value here", and the row shows
`Theme default` rather than a hex. Reset is a real button, so going back is
obvious.

### Contrast, stated in words

The ask was "good contrast so users can see differences", so the editor
computes it:

```
[Aa]  Good contrast
      5.8:1 · passes the 4.5:1 standard for body text
```

Two rules that make this useful rather than decorative:

- **The swatch renders the actual pair.** You see the judgement as well as read
  it.
- **It only appears when BOTH colours are set.** With either inheriting the
  theme, the resolved value is unknowable from here, and a confidently wrong
  warning is worse than silence.

`contrast()` is six lines duplicated in `blocks.js` rather than imported from
`storefront.js` — importing would drag the whole theme/preset module into a file
that needs a luminance calculation.

---

## 4 · Border colour derives, rather than adding a fourth control

```css
border: 1.5px solid var(--lkb-fg, var(--sf-link-border, transparent));
```

Background, text, heading — but *not* border. A custom fill with an inherited
accent border looks like a mistake, and a fourth colour picker is one more thing
to get wrong. Deriving it from the text colour keeps any pair coherent for free.

Same logic as note 176's `--sf-link-border`. Third time this pattern has come
up, which suggests a rule: **expose the colours a user thinks in, derive the
ones that only exist to support them.**

---

## Exercises

**1 · Add the `<Styles />` check.**
Count top-level returns vs `<Styles />` uses per file and fail on a mismatch.
The naive version false-positives on helper components like `Switch` — decide
whether to filter those out or accept the noise, and say why.

**2 · Per-block colour in the live preview.**
`LivePreview` still renders the old flat link list, so none of §3's controls
show feedback while you set them. This is the same gap note 175 called out and
it's now costing more.

**3 · Contrast against an inherited value.**
§3 hides the verdict when a colour is unset. But the resolved theme value IS
knowable at render — `getComputedStyle` on the preview would give it. Worth it,
or is the complexity worse than the gap?

**4 · Does `shape` belong in Layouts or Settings?**
It's in Layouts with the other visual knobs. The reference puts block-level
identity in Settings. Argue for one, and state the rule you'd use for the next
control.

**5 · Featured links still bypass block colours.**
A featured link renders in the products section, which knows nothing about its
block's `bg`/`fg`. So featuring a link silently changes its appearance. Decide:
carry the colours over, or tell the creator in the editor.

**6 · Harder: how many controls is too many?**
Layouts now has style, columns, size, alignment, shape, outline, shadow, and
three colours. The spec asked for "powerful and intuitive" — those pull apart at
some point. Propose a progressive-disclosure split and defend where you drew the
line.

---

## Files
**Changed** — `src/components/LinkBlockEditor.jsx` (`<Styles />` in both
branches, block list rebuilt, layout tiles, shape picker, colour rows, contrast
verdict, larger type), `src/components/LinkBlock.jsx` (colour + shape variables,
larger public type), `src/lib/blocks.js` (`bg`/`fg`/`headingColor`/`shape`,
`LINK_SHAPES`, `contrast`, `contrastVerdict`),
`src/app-pages/StorefrontEditor.jsx` (block editor wrapped in its own Panel)
