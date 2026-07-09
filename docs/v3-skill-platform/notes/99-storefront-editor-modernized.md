# 99 — Storefront editor modernized

_2026-07-08. Premium-light pass on the storefront editor (`/storefront/edit`) — the
creator-facing counterpart to the modernized public storefront (note 96), and the
foundation for the future guns.lol-style customization system._

---

## Changes ([StorefrontEditor.jsx](../../../src/app-pages/StorefrontEditor.jsx))

All logic preserved (theme state, banner upload, socials, link buttons, product
reorder, pixels/webhook). Presentation + icons only:
- **Section headers** now have an accent-tinted icon chip (Palette / Share2 / Link2 /
  ListOrdered / Activity) — clearer scannability, premium feel.
- **Real lucide icons** replace glyphs everywhere: `ExternalLink` (Preview), `X`
  (remove), `ChevronUp`/`ChevronDown` (reorder), `Plus` (add social/link),
  `ImagePlus` (banner CTA).
- **Cards** get soft shadows + more padding; **swatches** are larger with a cleaner
  selected ring + hover scale; **segmented** + **icon buttons** refined.
- **Accent presets** refreshed — dropped the old orange, lead with Caribbean green
  `#00CC99` + a curated modern set.
- Copy: "Skill order" → **"Product order"** (matches the "Products" nav term).

## Note on theming
The editor *chrome* uses the global Caribbean accent (`--accent-light`/`--accent`),
while the **swatches edit `theme.accent`** — the per-store color that the public
storefront applies via `color-mix` (note 96). So a creator can pick any accent and
their public page themes to it, independent of the app's green.

## Status
Build passes. This completes the storefront-editor polish. **Next toward the
customization vision:** the bigger guns.lol-style layout system (backgrounds,
fonts, section/layout presets, live preview) — its own initiative, now sitting on a
polished editor + storefront.
