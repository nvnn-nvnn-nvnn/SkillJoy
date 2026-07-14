# 140 — Bookings tab: even layout + WIP notice

Date: 2026-07-13

## Context
The "bookings page" is the **Bookings tab** in `src/app-pages/Dashboard.jsx` (Overview / Sales /
Bookings / Audience). It shows "Upcoming sessions" on the left and `AvailabilityEditor` on the right.

## Changes
1. **Even layout.** The tab used the shared `.db-grid` (`1.3fr 1fr`), so the two columns were
   lopsided (wide left, narrow right) — looked especially off with the tiny "No booked sessions
   yet" empty state next to the tall availability editor. Added `.db-grid-even`
   (`grid-template-columns:1fr 1fr`) applied only to the bookings grid so the two columns split
   evenly. Also moved the booking-row's inline `gridTemplateColumns` into a `.db-row-book` class
   (`1fr 1.2fr 1fr`) — cleaner and consistent.
2. **Grayed-out WIP warning.** Added a dashed, muted `.db-wip` notice at the top of the tab: 🚧
   "Bookings are a work in progress — scheduling & availability are still being built. Feel free to
   explore, but don't rely on this for live client sessions yet." Icon is `grayscale(1)`, text uses
   `--text-secondary`/`--text-muted`.
3. **Dimmed content.** The grid gets `.db-wip-dim` (`opacity:.68; filter:grayscale(.25)`) so the
   whole section visually reads as not-ready; it lifts to `.85` on hover so it's still usable.

Scope is intentionally the Bookings tab only — the other dashboard tabs are untouched and still use
the standard `.db-grid`.

## Files
- `src/app-pages/Dashboard.jsx`

## Note
When native scheduling is production-ready, remove the `.db-wip` block and the `db-wip-dim` class
from the bookings grid (leave `db-grid-even` — the even split is a keeper).
