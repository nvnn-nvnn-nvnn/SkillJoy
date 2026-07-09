# 102 — Storefront customization studio (guns.lol-style dashboard)

_2026-07-08. Rebuilt `/storefront/edit` from a plain form into a glassmorphic
customization **studio** with a live preview. Big feature, built as an honest v1:
everything that maps to real saved theme behaviour is wired; hardware-heavy pieces
are scaffolded as clearly-marked "Soon" rather than faked._

---

## Layout (matches the brief)
- **Top header tabs:** Storefront (active) · Analytics · Settings (the latter two ping
  "coming soon").
- **Secondary sidebar:** Site Customization (active) · Links · Templates (WIP badge).
- **Main:** glassmorphic panels (Assets, General, Color & Theme, Animations & Effects,
  Product order) under Site Customization; Socials + Link buttons under Links.
- **Right:** a large **live preview** (`<LivePreview>`) — a faithful mini-storefront
  that re-renders instantly from the draft theme (bg, glass, accent, mode, button
  style, mono icons, animated name, avatar/name/bio/socials/products/links).

## Wired (real, saved to `storefront_theme` jsonb)
Background (canvas/solid/gradient/**image upload**), banner, **custom cursor** upload,
**profile opacity + blur** (glassmorphism via `--sf-card-bg`/`--sf-card-blur`),
light/dark **mode**, accent presets + picker, **text color**, **button style**,
product **layout**, **monochrome icons**, **animated username**, product reorder,
socials + link buttons. All persist via the existing `updateStorefront`.

New theme fields added ([storefront.js](../../../src/lib/storefront.js)): `text_color`,
`card_opacity`, `card_blur`, `cursor_url`, `mono_icons`, `animated_name`. Applied on
the public storefront ([Storefront.jsx](../../../src/app-pages/Storefront.jsx)) — no
migration (jsonb).

## Scaffolded "Soon" (need real infra — not faked)
Video / GIF background, Audio + waveform visualizer, particle effects, custom fonts,
drag-and-drop reordering (arrows work now), the Analytics / Settings tabs, Templates.

## Styling
Glassmorphism throughout: `backdrop-filter: blur()` + translucent `color-mix` fills +
soft glowing borders + an accent/violet radial backdrop (`.std-bgfx`). Uses `color-mix`
so panels tint to the app accent. Responsive: preview hides < 1100px; subnav becomes a
scroll row on mobile.

## Next passes toward the full vision
Live preview → could become the *real* Storefront component in an iframe/portal for
100% fidelity; then tackle the "Soon" items (drag-drop is the highest-value one), and
fonts. Also: the studio's glass currently assumes the app's light theme — a dark studio
skin could come with the Settings tab.

## Status
Build passes. Try `/storefront/edit`.
