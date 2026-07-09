# 96 — Storefront (link-in-bio) modernized

_2026-07-08. Elevated the public `/@handle` storefront to the premium-light look.
This is the highest-visibility surface (what every bio-link visitor sees) and the
canvas the future customization system builds on. CSS/markup only — all data/theme
logic unchanged._

---

## What changed ([Storefront.jsx](../../../src/app-pages/Storefront.jsx))

- **Hero:** banner now has rounded bottom corners + a soft bottom scrim (avatar/name
  stay readable on any image). Avatar is bigger (100px) with a thick surface ring +
  soft shadow, overlapping the banner. Handle is accent-colored; bio gets a comfortable
  `42ch` measure.
- **Socials:** refined circular buttons with a resting shadow and a springy hover lift.
- **Product cards + link buttons:** springy hover (`cubic-bezier(.34,1.4,.64,1)`),
  a **themed accent glow** on hover, crisper type, bolder price. Link buttons get an
  accent arrow.
- **Brand footer:** "Built on ✦ SkillJoy" → links to the landing page (acquisition loop,
  Linktree-style).

## Theming detail (important)

Each storefront can override `--accent` with the creator's chosen theme color
(`resolveTheme` → `style={{ '--accent': theme.accent }}`). The theme only sets the
**hex** `--accent`, not the `--accent-rgb` triplet or `--accent-light`. So for all
accent-*derived* colors here (hover glows, tint chips, avatar bg) I used
**`color-mix(in srgb, var(--accent) N%, white|transparent)`** instead of
`rgb(var(--accent-rgb)/…)` or `var(--accent-light)`. That way every tint/glow derives
from the *creator's* themed accent, not the global Caribbean green. (color-mix is
baseline in modern browsers — 2023+.)

## Status
Build passes. **Next in the rollout:** Login (pairs with onboarding), Dashboard, the
builder editor + Locker — then the big one, the **customizable guns.lol-style layout
system** (which now has a polished storefront to build on).
