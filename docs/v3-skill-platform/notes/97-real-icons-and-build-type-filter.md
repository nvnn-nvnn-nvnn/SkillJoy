# 97 — Real (lucide) icons + build-list type filter

_2026-07-08. Swapped emojis for lucide icons on the surfaces touched so far, and
added a type filter to the "Your Skills" builder list. Finishes the builder-side of
the premium-light pass._

---

## 1. Emojis → lucide icons

`lucide-react` was already a dependency (used in the builder + product types), so
emojis were replaced with real line icons for a consistent, modern feel:
- **Storefront** ([Storefront.jsx](../../../src/app-pages/Storefront.jsx)): Pencil
  (edit), Puzzle (cover placeholder), Link2 (link), ArrowUpRight (link arrow),
  Sparkles (footer), Search (not-found), + social icons.
- **Build list** ([SkillBuilder.jsx](../../../src/app-pages/SkillBuilder.jsx)):
  Puzzle for the empty state + card cover placeholders.

### ⚠️ Lucide-brand-icon limitation (important)
The installed lucide build (`^1.7.0`) **exports no brand logos** — `Instagram`,
`Youtube`, `Twitter` are NOT available (importing them fails the build). So the
storefront socials use **generic stand-ins**: Camera (Instagram), Play (YouTube),
AtSign (X), Music2 (TikTok), Globe (website). Recognizable but not the real marks.
For genuine brand logos, add **`simple-icons`** (the proper brand-logo set) or inline
a few brand SVGs — deferred pending a decision.

## 2. Build list: filter by product type ([SkillBuilder.jsx](../../../src/app-pages/SkillBuilder.jsx) `SkillList`)

Added a filter bar above the grid: **"All (n)"** + a chip per product type the
creator actually has (`presentTypes = [...new Set(skills.map(s => s.kind))]`, friendly
labels via `TYPE_BY_ID`). Selecting a chip filters the grid to that `kind`
(`visible = skills.filter(...)`). The bar only shows when there's **more than one
type** present (no point otherwise). Chip styling matches the app's pill language
(accent-filled when active, count badge on "All").

## Status
Build passes. **Builder side of the redesign is done.** Next: the **Storefront
editor** (`StorefrontEditor.jsx`) — where creators customize the page that note 96
just modernized; the on-ramp to the bigger guns.lol-style layout system.
