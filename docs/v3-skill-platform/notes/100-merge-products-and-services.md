# 100 — Merged Products + Services into one hub

_2026-07-08. `/build` (SkillBuilder's list) and `/services` (ServicesDashboard) were
two views of the same thing — "the stuff I sell." Combined into a single hub._

---

## Decision

They were redundant. **ServicesDashboard was the clearly superior surface** (summary
stats, type filter tabs with counts, search, rich cards with per-product
sales/revenue/views/conv metrics, and edit/preview/share/publish/delete). SkillList
(the `/build` index in `SkillBuilder.jsx`) was the weaker duplicate.

So: **ServicesDashboard is now the single "Products" hub**, mounted at `/build`.
Renamed its visible copy "Services" → **"Products"** (a store sells products; the one
true "service", 1:1 coaching, is gated anyway).

## Routing ([main.jsx](../../../src/main.jsx))
- `/build` → **ServicesDashboard** (was SkillBuilder/SkillList).
- `/build/new` → AddProduct (unchanged) · `/build/:skillId` → SkillBuilder **editor**
  (unchanged — always has an id, so it always renders `SkillEditor`).
- `/services` → **`<Navigate to="/build" replace />`** (redirect; old links still work).

## Nav + links
- Sidebar ([Header.jsx](../../../src/components/Header.jsx)): removed the duplicate
  "Services" item; the single **Products** item (→ `/build`) covers it. (Dropped the
  now-unused `Boxes` import.)
- Fixed stray `/services` links: AddProduct back-link and Profile's "Manage services"
  button both now point to `/build` ("Manage products").

## Consequences / notes
- The **type filter** you asked for is delivered by ServicesDashboard's filter tabs
  (with counts + search) — better than the chip filter I'd added to SkillList.
- **`SkillList` in `SkillBuilder.jsx` is now vestigial** — still referenced in the
  default export's `skillId ? <SkillEditor/> : <SkillList/>` ternary, but `/build`
  no longer routes there without an id, so it never renders. Harmless dead code; can
  be removed in a cleanup pass (would simplify SkillBuilder to just the editor).
- Label is easily switchable if you'd rather call it "Services" than "Products" —
  it's just copy in ServicesDashboard + the sidebar.

## Status
Build passes. One product hub, one nav item, editor untouched.
