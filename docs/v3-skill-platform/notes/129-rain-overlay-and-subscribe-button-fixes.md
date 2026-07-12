# 129 — Rain overlay seamless fix + subscribe button hardcoded green

_2026-07-11._

## Rain overlay (Storefront.jsx `.sf-overlay-rain` + preview `.lp-overlay-rain`)

Was: `repeating-linear-gradient` + `background-size:100% 200%` + animate 200px. Two bugs —
`background-size` on a REPEATING gradient rescales/stretches the pattern, and animating 200px
against the 14px period never loops cleanly → faint, stretched, jerky bands.

Now: a SINGLE slanted `linear-gradient` streak sized to a **tile** (`background-size:9px 64px`),
scrolled by **exactly one tile** each cycle (`background-position: -9px 64px`) → perfectly
seamless, thin, crisp slanted streaks. Reusable rule: for a seamless scrolling background, scroll
by exactly the `background-size` (one full tile), and don't put `background-size` on a repeating
gradient.

## Subscribe button — hardcoded brand green

After the earlier `.sub-btn` (used `var(--accent)`) STILL read white, root cause was the button
inheriting a creator's white/light `--accent`. Hardcoded to `background:#00CC99; color:#fff` (it's
a "Built on SkillJoy" CTA, so a fixed brand green is correct + always high-contrast). Can no longer
be white regardless of theme. (If it STILL shows white it's a stale build — hard-refresh / it's the
deployed site without these local changes.)

## Follow-up: overlays now adaptive (light + dark storefronts)

Rain (light-blue) and snow (`#fff`) were invisible on LIGHT storefronts. Both now derive their
color from **`--text`** via `color-mix` — `color-mix(var(--text) 42%, transparent)` streaks /
`color-mix(var(--text) 60%, transparent)` dots (`--snow`/`--lpsnow` vars). So they contrast with
the theme on both light and dark (dark specks on a light page, light specks on a dark page).
Applied to Storefront + LivePreview. (Snow on a light bg reads as fine particles rather than
literal white "snow" — acceptable trade for visibility.)

Also deleted the dead `src/components/PhasePlaceholder.jsx` (defined, imported nowhere).

`vite build` ✅.
