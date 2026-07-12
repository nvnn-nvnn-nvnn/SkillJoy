# 124 — Dedicated Analytics page + daily trend line chart

_2026-07-11. Opus (dataviz skill). The Fable-side UI batch (icons, discover-gate, thumbnails,
show-avatar, remove-button placement) is a separate prompt/note._

## What & why

Analytics lived inside the Dashboard "Overview" tab (the `AnalyticsCards` funnel). Owner wanted a
**dedicated page in the header** with a **line graph** — a visual trend, not just totals.

## Changes

- **`src/components/TrendChart.jsx`** (new) — the headline: a daily-count line chart off
  `analytics_events` (`getCreatorEvents`). Inline SVG, **no chart dependency**, theme-aware via
  CSS vars.
- **`src/app-pages/Analytics.jsx`** (new) — the page: TrendChart on top, then the existing
  `<AnalyticsCards>` (funnel + engagement) below.
- **`main.jsx`** — `/analytics` route.
- **`components/Header.jsx`** — "Analytics" nav item (TrendingUp icon) in the Grow group, under
  Dashboard.
- **`Dashboard.jsx`** — removed the embedded `AnalyticsCards` from Overview (no duplicate home);
  replaced with a CTA card linking to `/analytics`. Kept PayoutStatus + the top KPI stats.

## Dataviz decisions (per the skill's rules)

- **One metric at a time, selectable (Views / Checkouts / Purchases).** These differ by orders of
  magnitude, so plotting them together would need a dual-axis (the #1 chart anti-pattern) or make
  purchases invisible. A selector = always one clean axis, one series.
- **Single series → brand accent (`--accent`), no legend** (the chart title names the metric). No
  categorical palette → no CVD validation needed (that's for multi-series).
- **Marks/anatomy:** 2.5px accent line, subtle accent area gradient, recessive `--border`
  gridlines, muted axis labels in text tokens (never the series color), a hover **crosshair +
  dot + tooltip**, `niceCeil` y-axis, ~5 evenly-spaced x date ticks.
- **Filters above the plot:** metric segmented control + range (7/30/90d).
- **Empty state:** "No {metric} yet in this window — share your storefront link."
- **Theme-aware:** all colors are CSS vars → works in light + dark (the accent green reads on both
  surfaces).

## Notes / follow-ups
- Data is bucketed client-side by calendar day (UTC slice of `created_at`). Fine at current
  volume; a backend rollup is the scale path (metrics.js already flags this).
- Revenue-over-time isn't plotted (events are counts, not amounts) — a future series could read
  `purchases.amount_cents` if a $-trend is wanted.
- `vite build` ✅. Per dataviz step 7, eyeball it in-browser (light + dark) for label collisions
  before calling it fully done.
