# 31 — My Listings Form Color Cohesion Fix

## What changed

### `src/app-pages/MyListings.jsx` (styles only)

**Primary action buttons** — Changed from stark black (`var(--text)`) to the app's warm accent (`var(--accent)` / `#D4522A`). Applies to: New Gig, List Gig, Save Changes, and Chat buttons. Hover uses `var(--accent-hover)`.

**Form card wrapper** — Form now sits inside a card with `var(--surface)` background, `var(--border)` border, and 16px rounded corners instead of floating on the raw page background.

**Section headers** — Given a `var(--surface-alt)` pill background with `var(--text-secondary)` text instead of flat gray on transparent. Ties them into the cream palette.

**FAQ number badges** — `var(--accent)` text on `var(--accent-light)` background instead of plain gray text.

**Tags** — `var(--primary-light)` background with `var(--primary-mid)` border (warm gold tones) instead of gray `var(--surface-alt)`.

**Upload and Add buttons** — Cream `var(--surface-alt)` fill by default, hover transitions to `var(--primary-light)` background with `var(--accent-mid)` border for a warm highlight.

**Image remove buttons** — Semi-transparent dark overlay that fades in on hover instead of an always-visible red circle.

**Form footer** — Added `border-top` separator above the submit buttons.

**Form header** — Added `border-bottom` separator below the title row.

## Why

The form's color palette was disconnected from the rest of the app. Black primary buttons, flat gray section labels, and stark white backgrounds felt cold against the warm orange/cream design system. The contrast between the form and the rest of the page (hero card, tabs, gig cards) made it look like two different apps.

## How

All changes are CSS-only — no logic, handlers, or markup changes. Every color references existing CSS variables (`--accent`, `--accent-hover`, `--surface-alt`, `--primary-light`, `--primary-mid`, `--accent-mid`, `--text-secondary`) so the form now inherits the same warm tone as the rest of the app. Mobile padding adjusted via the existing `@media (max-width: 768px)` block.
