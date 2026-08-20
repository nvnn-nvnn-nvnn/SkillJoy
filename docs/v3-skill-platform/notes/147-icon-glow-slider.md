# 147 — Icon glow slider (super-strong social-icon neon)

Date: 2026-07-18

## What changed
The social icons' glow was **fixed** — two hardcoded drop-shadows (3px/10px) on `.sf-social`,
regardless of any setting. It's now a theme control: `icon_glow` (0–60px), with a slider in the
editor's **General** panel next to the master glow.

- `DEFAULT_THEME.icon_glow: 10` — chosen because 10px reproduces the old fixed look, so **every
  existing storefront renders unchanged** until its creator touches the slider.
- `Storefront.jsx` sets `--sf-icon-glow`; `.sf-social` now uses a **triple-layer bloom**, all
  derived from the one var via `calc()`:
  core `× 0.3` @ 90% accent → halo `× 1` @ 55% → outer wash `× 2.2` @ 38%.
  At 60px that's an 18/60/132px neon burst ("super strong"); at 0px all radii are 0 → invisible,
  no special-casing. Hover scales the same layers up (`× 0.4 / 1.3 / 2.8`).
- Editor live preview mirrors it (`--lp-icon-glow` at ~65% scale, same layer recipe).

Same pattern as note 136's master glow: one number → several derived magnitudes → `color-mix`
ties every layer to the creator's accent. The transferable bit here is `calc(var(--x) * k)`
inside `drop-shadow()` — one CSS var can drive an arbitrarily layered effect with zero JS.

## Files
- `src/lib/storefront.js` — `icon_glow` default (also corrected the stale `glow_intensity` comment, 0–40 → 0–80)
- `src/app-pages/Storefront.jsx` — `--sf-icon-glow` + layered `.sf-social` filters
- `src/app-pages/StorefrontEditor.jsx` — slider + preview mirror

## Note
`mono_icons` still works on top — grayscale applies to the svg, glow to the anchor, so mono icons
can carry a colored glow (arguably a feature; revisit if it looks odd).
