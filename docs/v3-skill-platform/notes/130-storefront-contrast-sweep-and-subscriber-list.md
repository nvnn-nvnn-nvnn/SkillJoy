# 130 — Storefront contrast sweep + Audience subscriber list

_2026-07-11._

## Contrast sweep (Storefront.jsx) — the "solid --surface vanishes on dark storefronts" class

Floating controls used `background: var(--surface)`, which on a white-text/dark-bg storefront
rendered as invisible white blobs. Converted to **dark glass** (always visible on any background/
theme — the universal floating-control pattern):
- **`.sf-editbtn`** (owner edit pill, top-right) — `rgba(18,18,22,0.55)` + blur + light border +
  white text.
- **`.sf-audiopill`** (bottom-right) — `rgba(18,18,22,0.5)` + blur + accent-tinted border + white
  icon (kept the brand cue).
- **`.sf-tag`** (Membership tag) — removed the hardcoded `white` in its `color-mix(... , white)`
  background → `color-mix(var(--accent) 16%, transparent)` + accent border. Now theme-correct.

Reusable rule (again): storefront UI can't assume `--surface` contrasts with the page — creators
run dark backgrounds + white text. Floating controls → dark glass; inline chips → accent-tint
transparent; inputs → derive from `--text` (note 128).

## Audience — see your subscribers (AudiencePanel.jsx)

The panel showed the count + broadcast composer + CSV export but not the actual people. Added a
scrollable **subscriber list** (email · name · join date), rendered from the already-fetched
`subs` (via `listSubscribers`). Loading + empty states handled. Lives in the Dashboard → Audience
tab.

`vite build` ✅.
