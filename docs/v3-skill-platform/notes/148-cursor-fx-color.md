# 148 — Cursor-effect color picker (+ latent accent bug fix)

Date: 2026-07-18

## What changed
`cursor_fx_color` ('' = follow accent) in `DEFAULT_THEME`; a color row appears under **Cursor
effect** in the editor's General panel when trail/sparkle is on, with the same Reset-to-accent
pattern as text color.

## The latent bug this surfaced
`CursorFx` appends its particle layer to **`document.body`** — deliberately, so particles aren't
clipped by the storefront wrapper. But that means the layer sits OUTSIDE the wrapper where the
creator's `--accent` is pinned, so `var(--accent)` in `.sf-fxp-*` resolved to the **app's global
accent**, not the creator's. Trails were always app-orange regardless of theme.

Fix: the color is now pinned directly on the layer element
(`layer.style.setProperty('--sf-fx-color', color)`), and the CSS reads
`var(--sf-fx-color, var(--accent))`. `Storefront.jsx` passes
`color={theme.cursor_fx_color || theme.accent}` — so custom color works AND the accent default is
finally the *creator's* accent.

**Transferable:** any portal/body-appended layer escapes your scoped CSS variables. If an effect
layer must live on `<body>`, pin the variables it needs onto the layer itself.

Also added `color` to the effect's dep array so recoloring live re-mounts the layer.

## Files
- `src/lib/storefront.js` · `src/app-pages/Storefront.jsx` · `src/app-pages/StorefrontEditor.jsx`
