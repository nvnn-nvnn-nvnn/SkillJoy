# 101 — Storefront deeper theming (guns.lol direction)

_2026-07-08. Expanded storefront customization beyond accent + banner: full-page
backgrounds, light/dark mode, and button styles. No migration — the theme is a
flexible `profiles.storefront_theme` jsonb._

---

## Theme model ([storefront.js](../../../src/lib/storefront.js))

`DEFAULT_THEME` extended (and the stale orange default fixed → Caribbean green):
```js
{
  accent, layout, banner_url, socials,   // existing
  mode: 'light' | 'dark',
  bg: 'canvas' | 'solid' | 'gradient' | 'image',
  bg_color, bg_color2, bg_image,
  button_style: 'rounded' | 'pill' | 'sharp',
}
```
`resolveTheme` merges over defaults, so old stored themes stay safe (missing keys
fall back).

## Applied on the storefront ([Storefront.jsx](../../../src/app-pages/Storefront.jsx))

- **Background:** a fixed full-viewport layer `.sf-bg` (`position:fixed; inset:0;
  z-index:-1`) painted per `bg` — solid color, `linear-gradient(160deg, c1, c2)`,
  or a cover image. `canvas` falls through to the mode palette's `--bg`.
- **Light/dark:** `.sf-mode-dark` overrides the surface/text/border CSS vars on the
  storefront scope, so every card/chip/text flips to a dark palette (the rest of the
  app is unaffected — it's scoped to `.sf-wrap`).
- **Button style:** `.sf-btn-{rounded|pill|sharp}` sets the corner radius on cards,
  covers, link buttons, and socials.
- Wrapper class = `sf-wrap sf-mode-<mode> sf-btn-<style>` (+ `sf-has-bgimg` → adds a
  text-shadow on the name/handle/bio so they read over an image).

## Editor controls ([StorefrontEditor.jsx](../../../src/app-pages/StorefrontEditor.jsx))

Added to the Branding card: **Theme** (Light/Dark), **Background** (Canvas / Solid /
Gradient / Image — with color pickers or an image upload reusing `uploadBanner`), and
**Button style** (Rounded / Pill / Sharp). All write into the same `theme` object;
saved via the existing `updateStorefront`.

## Design note / limits
- **Text readability is coupled to mode:** header text color comes from the palette,
  so a creator using a dark background should pick **Dark** mode (light text), and a
  light bg → Light mode. Deliberate — keeps it simple, guns.lol-style "pick a vibe."
- **Fonts deferred** (needs font loading/licensing) — noted for a later pass.
- Accent tints still use `color-mix(var(--accent) …)` so they track the creator's
  chosen accent in either mode.

## Status
Build passes. Try it: `/storefront/edit` → Branding → Theme / Background / Button
style → Save → view your `/@handle`.
