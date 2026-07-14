# 137 — Idea: one-click theme preset picker

Date: 2026-07-13

## The idea
A gallery of named, ready-made looks a creator applies in one tap — instead of hand-tuning
~20 sliders/segments in the studio. Each preset is just a bundle of the theme fields we already
support (bg + accent + effects + glow + layout), so this is a **data + UI** feature, not new
rendering. Lowers time-to-a-good-storefront, which is the activation moment that predicts retention.

## Why it's the highest-leverage next customization move
- We now have deep, well-organized controls (note 136) — but choice paralysis is the flip side.
  Presets give the "wow, done" path; power users still have the sliders.
- Reuses 100% of existing theme plumbing (`resolveTheme`, `storefront_theme`). No schema/render work.
- Directly supports Phase 2 roadmap items "UI section templates" + "Full site templates" in note 108.

## Rough shape (when we build it)
- `THEME_PRESETS` array in `src/lib/storefront.js`: `{ id, name, preview, theme: {partial theme} }`.
  Examples: "Midnight Glow" (dark + strong glow + shimmer name), "Clean Light" (light, no fx),
  "Vaporwave" (gradient bg + VHS overlay + rainbow name), "Frosted" (image bg + high card blur).
- Editor: a "Presets" panel/tab at the TOP of Customize — click a card → `setTheme(t => ({ ...t, ...preset.theme }))`
  (merge, so it doesn't wipe name/bio/avatar/socials). Live preview already reflects it instantly.
- Keep it non-destructive: applying a preset only touches visual theme keys, never profile content
  (respects [[feedback_personal_info_separation]] — presets are public-page styling only).

## Status
Idea only — not started. Parked here so it isn't lost.

## Related
- Note 136 (editor reorg + stronger glow) — the groundwork this builds on.
- Note 108 Phase 2 (content & customization).
