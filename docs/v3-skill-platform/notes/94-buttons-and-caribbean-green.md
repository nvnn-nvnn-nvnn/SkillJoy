# 94 — Elevated pill buttons + Caribbean green brand color

_2026-07-08. Part of the "elevate default UI" pass. Two global design-system
changes (both in the shared CSS, so every page benefits at once)._

---

## 1. Pill buttons ([src/App.css](../../../src/App.css))

Were flat (weight 500, single soft shadow, basic lift). Now:
- Base `button, .btn`: **weight 600**, tighter tracking, springy transform easing
  (`cubic-bezier(.34,1.4,.64,1)` — subtle overshoot).
- **`.btn-primary`:** layered depth — crisp drop shadow + soft **colored** glow
  (`rgb(var(--accent-rgb)/.22)`) + inner top highlight `inset 0 1px 0 rgba(255,255,255,.16)`.
  Hover lifts 2px with a stronger glow; active presses (scale .985 + inset).
  Kept solid (no gradient) to stay on-brand.
- **`.btn-secondary`:** subtle resting shadow, hover lift + accent glow, active press.
- Added **`:focus-visible`** ring (keyboard only) and a **`:disabled`** state
  (opacity, no lift) for the pill classes.

## 2. Brand color → Caribbean green `#00CC99` ([src/index.css](../../../src/index.css))

Swapped the entire accent scale (was seafoam `#20B366`):
- `--accent: #00CC99`, `--accent-hover: #00A37A`, `--accent-bright: #2FD9AB`,
  `--accent-light: #E0F8F1`, `--accent-mid: #9FE6D0`.
- **Critical:** `--accent-rgb: 0 204 153` (and `--accent-bright-rgb`) kept in sync —
  every shadow / focus ring / glow uses `rgb(var(--accent-rgb) / <alpha>)`, so a
  stale triplet would tint all depth effects the old color.
- Aligned the vestigial `--primary-hover/light/mid` seafoam tints to Caribbean so
  avatars + legacy tags match. Grep confirmed **no hardcoded old-green hexes left in `src`**.

## Known follow-ups
- **Contrast:** white on `#00CC99` ≈ **2.1:1** (below WCAG AA 4.5). Vibrant but light.
  Options if needed: dark ink text on buttons, or a deeper green for button *fills*
  only (keep `#00CC99` for accents/links/tints). Left as-is per the explicit color choice.
- **Emails + Stripe checkout** still render the old orange (`#D4522A` in
  `backend/lib/email.js` templates; `#ec9146` in legacy templates; `colorPrimary`
  in the Stripe Elements `appearance` in `Checkout.jsx`). These are **hardcoded, not
  the CSS var**, so they didn't change. Align them for full brand consistency later.

## Status
Build passes. Pure CSS/token change — no logic touched.
