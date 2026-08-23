# 167 — Storefront editor explainer + exercises

Date: 2026-08-23. **Docs only — no code changed.**

## What was added

- `notes/explainers/04-the-storefront-editor.md` — a feature-by-feature
  walkthrough of the storefront editor and the public page it drives.
- `notes/explainers/README.md` — index entry for it.

## Why a fourth explainer, and what it deliberately does *not* cover

Explainer 01 §6 already explains the **engine** (one JSONB blob → `resolveTheme`
→ CSS custom properties → two consumers) and §10 gives the generic
add-a-customization-key recipe. What was missing was the layer below that: *how
each individual effect is actually built.* 04 is that layer, so it links to 01
rather than restating it, and links to `143-3d-tilt-parallax/` for tilt rather
than duplicating a guide that already has a runnable demo.

## Sections

1. Map + the render layer stack (z-index order — explains most "my effect is
   invisible" bugs)
2. Background — five modes, one element; why `canvas` is `undefined`
3. Mode palettes / accent / text overrides — why both palettes are pinned
4. Glass — `color-mix` on the fill, not `opacity` on the element
5. Glow — one slider → three layered `drop-shadow`s; the toggle that collapses
   variables instead of clearing values
6. Name effects — `background-clip: text`
7. Overlays — pure CSS tiles, and the exactly-one-tile loop rule
8. Cursor — the two unrelated features, and the `<body>` portal landmine
9. Tilt (pointer to 01/143) + the two-rules-one-`transform` fix
10. Splash — user activation for autoplay; the app-rail centring bug
11. Site music — one React-owned `<audio>`, event-driven icon, the iOS volume probe
12. Uploads — one funnel, UX limit vs bucket limit
13. Live preview — why it's a second implementation, and what it scales
14. Presets / export / import — partial merge, content stripping, schema-side whitelist
15. Sections — derived from `group_label`, no table; DnD + its two fallbacks
16. Link buttons — the one part that isn't in the blob; per-field immediate save
17. Save — one write, and what deliberately lives outside the blob
18. Landmine index (15 rows, each a bug that actually happened)

## Exercises

Ten, ordered easy → hard, each with a hint and a *verify* step. Notable ones:

- **#2** is rigged: the obvious `var(--accent)` in the cursor-FX rule resolves
  wrong because the layer lives on `<body>`. The exercise is designed to make
  that bite.
- **#6** (persist empty sections) has no correct answer — it asks for the
  tradeoff to be written down first, because storing section order makes
  "stored order disagrees with derived order" representable for the first time.
- **#9** is the real outstanding work: `placement` has schema (029, note 164) and
  an editor control, but `Storefront.jsx` never reads it. Pairs with explainer 03.

## Gaps this documented (not fixed)

- `contrastRatio` / `readableOn` are exported and unused by the editor — a
  creator can pick the near-white accent preset and make their handle invisible.
  → exercise 3.
- `.lp-mode-dark` hardcodes `#1b1c20` / `#121316` instead of interpolating
  `MODE_PALETTES` like `StoreStyles` does. Matches today by copy, not by
  construction. → exercise 8.
- `nudge` moves a product one slot in the **global** array, so it can cross a
  section boundary without updating `group_label`. → exercise 7.
- `placement` control saves a value nothing renders. → exercise 9.
