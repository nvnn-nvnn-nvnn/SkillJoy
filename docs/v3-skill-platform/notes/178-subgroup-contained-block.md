# 178 — `.std-subgroup` reads as a block, not an indent

Date: 2026-08-21

Small CSS change with one idea worth keeping.

## The problem
`.std-subgroup` (introduced note 155, for settings that only exist while their
parent toggle is on) was a faint left rule and some left padding:

```css
.std-subgroup { margin:4px 0 0 6px; padding:16px 0 2px 18px;
  border-left:2px solid color-mix(in srgb, var(--accent) 26%, transparent); }
```

No fill, so it blended into whatever it sat inside. The dependency it was meant
to communicate — *these settings belong to that control* — barely registered.

## The change
Four things, together:

```css
.std-subgroup { margin:10px 0 2px; padding:16px 16px 4px;
  border-left:3px solid var(--accent); border-radius:0 var(--r) var(--r) 0;
  background:rgb(0 0 0 / 0.055); }
:root[data-theme="dark"] .std-subgroup { background:rgb(0 0 0 / 0.26); }
```

- solid accent rule at 3px, not a 26% mix
- padding on **all** sides rather than only the left
- rounded outer corners, so it terminates instead of trailing off
- a darker fill

The fill does most of the work, but the padding is what turns it from "tinted
text" into a container.

## The transferable bit: overlay, not a fixed colour

`.std-subgroup` is used in **two different parents**:

| Usage | Parent background |
|---|---|
| Glow sliders (General panel) | `.std-panel` — glass, `color-mix(surface 72%, transparent)` |
| Featured-link fields (Links panel) | `.std-linkcard` — solid `var(--surface-alt)` |

A fixed colour would have to match one of those and would clash with the other.
`rgb(0 0 0 / 0.055)` is a **black wash over whatever is behind it**, so it
darkens both by the same relative amount and stays correct if a third parent
appears later.

> **Rule:** when a component can sit inside more than one surface, tint it with a
> translucent overlay rather than picking a background colour. The overlay
> composes; a colour has to be guessed per context.

## Dark mode needs a different number, not a different approach
`0.055` black over `#F4F1EA` is clearly visible. The same `0.055` over `#191B1F`
is **nothing** — there is very little brightness left to remove. Hence `0.26` in
dark mode.

That asymmetry is worth internalising: a light-mode overlay and a dark-mode
overlay that *look* like the same amount of separation are nowhere near the same
alpha. Percentage of remaining headroom, not a fixed percentage.

## Scope
Applies to **both** usages — intended, since they are the same kind of thing, but
it means the General panel's glow group changed appearance too.

`vite build` clean.

## Files
- `src/app-pages/StorefrontEditor.jsx`
