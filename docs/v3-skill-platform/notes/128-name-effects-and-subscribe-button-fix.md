# 128 — Display-name effects (name_fx) + "Stay in the loop" button contrast fix

_2026-07-11._

## Display-name text effects (`name_fx`)

Built-in guns.lol-style text effects for the display name. Theme pattern (jsonb, no migration).
- **DEFAULT_THEME**: `name_fx: 'none'` — `'none'|'gradient'|'rainbow'|'shimmer'|'glitch'`.
- **Storefront.jsx**: `sf-fx-${name_fx}` class on the wrap; CSS on `.sf-name`:
  - **gradient** — accent → lighter-accent fill (`background-clip:text`, tracks the creator's accent
    via color-mix so it's not a fixed hue).
  - **rainbow** — animated hue-cycling gradient sweep.
  - **shimmer/"Shine"** — a white light-band sweeping across accent-filled text.
  - **glitch** — occasional RGB-split chromatic jitter (text-shadow + tiny translate).
  - All wrapped in `prefers-reduced-motion: reduce` (animations off for opt-out users).
- **Editor**: "Name effect" Seg in Animations & Effects (None/Gradient/Rainbow/Shine/Glitch),
  alongside the existing "Animated username" glow toggle (independent — they can stack).
- **Preview**: `lp-fx-${name_fx}` + mirrored CSS/keyframes in the LivePreview `<style>` (its own
  `lpRainbow`/`lpShine`/`lpGlitch` keyframes, since Storefront's StoreStyles aren't loaded in the
  editor).

## STILL PENDING — imported overlays (owner has assets)
Owner mentioned importing their own name overlays. The built-in CSS effects above are done; the
**overlay-import** part is blocked on answers: (1) format (PNG / GIF / APNG-WebP / video),
(2) application style — clipped-into-the-text (holographic/foil via `background-clip:text` +
image) vs blended-on-top (shine sweep, `mix-blend-mode`), (3) upload-per-creator (new storage
helper, like bg-video) vs a bundled preset set. Once specified, add an `name_overlay` field +
render.

## "Stay in the loop" subscribe button — contrast fix

`SubscribeForm.jsx` button was `.btn btn-primary`, which rendered near-**white at rest** on the
storefront (only got its accent color on hover) — a var-resolution/override quirk in that context.
Replaced with a **dedicated `.sub-btn`** styled explicitly in the component: `background: var(--accent,
#00CC99)` (hard hex fallback so it can NEVER fall back to the UA-default white box), `color:#fff`,
weight 800, accent shadow; hover = brightness+lift; disabled = dim. Now high-contrast at rest.

## "Stay in the loop" card + input contrast (follow-up — white-on-white)

Reported: on a **white-text-on-dark-background** storefront the whole subscribe box read "all
white." Root cause: the creator overrode text color to white (`--text` = white), but the `.sub`
card was a solid `var(--surface)` (white) and the input was `var(--surface)` white too → white
title on white card + white typed text in a white input = invisible.

Fix (all in `SubscribeForm.jsx`):
- **`.sub` card** now uses the profile panel's glass — `background: var(--sf-panel-bg,
  var(--surface))` + `backdrop-filter: blur(var(--sf-panel-blur))` — so it matches the panel's
  opacity/mode instead of being a solid white slab. Blends on any background.
- **Input is now ADAPTIVE**: `background: color-mix(var(--text) 9%, transparent)`, border
  `color-mix(var(--text) 22%)`, placeholder `color-mix(var(--text) 45%)`, `color: var(--text)`.
  A faint tint OF the text color always contrasts with the (full-opacity) text — works whether the
  creator's text is dark or white. Kills the white-on-white trap.
- (`.sub-btn` from the earlier fix stays — accent bg + white text + hard hex fallback.)

Reusable lesson: on the themeable storefront, form controls can't assume `--surface` contrasts
with `--text` (creators override text color for dark backgrounds). Derive input bg/border from
`--text` via color-mix so contrast holds regardless.

`vite build` ✅.
