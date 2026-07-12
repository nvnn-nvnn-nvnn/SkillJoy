# 120 — Site-wide dark mode + stronger social-icon glow

_2026-07-11._

## Social-icon glow (Storefront `.sf-social`)

Replaced the single drop-shadow with a **layered bloom**: resting = tight 3px core (accent 75%) +
soft 10px halo (accent 45%); hover = 3 stacked drop-shadows (4px solid + 12px + 24px) with a bigger
lift/scale. `filter: drop-shadow()` hugs the SVG shape (not a box), and stacking multiple builds a
real glow. Tracks `--accent`, so it recolors per creator.

## Site-wide dark mode

The app is fully CSS-variable-driven from `:root` in `index.css`, so dark mode = a var override +
a persisted toggle. NO per-component rewrites for anything that already uses the vars.

**How it works:**
- `:root[data-theme="dark"] { … }` in `index.css` flips the NEUTRAL system only (bg/surface/
  border/text/shadows) + `--primary` (→ light ink, so `color:var(--primary)` stays readable) +
  `--accent-light` (→ dark-tinted). `--accent` (brand green) is unchanged — it reads fine on both.
  `color-scheme: dark` makes native controls/scrollbars/inputs dark too.
- `src/lib/theme.js` — `getTheme()` (localStorage → OS `prefers-color-scheme` → light),
  `applyTheme()` (sets/removes `data-theme` on `<html>`), `setTheme()` (persist + apply).
- `main.jsx` calls `applyTheme(getTheme())` **before `createRoot`** → no light→dark flash on load.
- `Settings.jsx` → **Appearance** section with a Light/Dark toggle (persists + applies live).

**Storefront decoupling (important):** the public `/@handle` page has its OWN per-creator mode
(`theme.mode`). Previously only `.sf-mode-dark` pinned vars; a light storefront relied on `:root`
defaults — which the new site dark mode would override, wrongly darkening a creator's light page
for a dark-mode visitor. Fix: added an explicit **`.sf-mode-light`** block pinning the light
palette. Now the storefront always reflects the CREATOR's choice, never the visitor's site theme.

## Known follow-up (documented, not a bug)
The foundation themes everything that uses the CSS vars — which is most of the app chrome. But
components with **hard-coded colors** (many inline styles in `Settings.jsx`/`Admin.jsx`, the
Footer's dark bar, stray `#fff`/`#1a1a1a`/`#a3a3a3`) won't fully flip. A follow-up sweep should
replace hardcoded colors with vars for complete dark coverage. Until then, dark mode is solid on
the core surfaces (buttons, cards, inputs, storefront editor, builder) and rough on the
inline-styled admin/settings bits.

`vite build` ✅.
