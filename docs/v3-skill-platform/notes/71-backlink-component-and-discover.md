# 71 — Shared BackLink + Discover page

_Session 2026-07-03. Two things: (1) one reusable back button replacing ~7
hand-rolled variants; (2) a v3 Discover page for creator storefronts._

---

## Part 1 — the "less vibe coded" fix: shared components

The user asked why the app still "feels vibe coded" despite looking good. The
answer, made concrete: **the back button was hand-rolled differently on every
page** — `ap-back`, `lk-back`, `sb-back`, `sp-back`, a `btn-secondary`, and raw
`←` text. Seven versions of one control = the classic vibe-coded tell.

**The cure is shared components.** Built one:
- **`src/components/BackLink.jsx`** — renders a `<Link>` when given `to`, or a
  `<button>` when given `onClick` (e.g. `navigate(-1)`). Lucide `ArrowLeft` +
  label; the arrow slides left on hover (a small modern micro-interaction).
- Styles live **globally** in `App.css` (`.bl`) — not an inline `<style>` per
  page — so there's exactly one definition. `.bl-inline` variant drops the
  page-top margin for toolbar/row usage.

Swapped it into every v3 page: `AddProduct`, `SkillBuilder` (page + editbar via
`.bl-inline`), `Locker` (both spots), `SkillPublic`, `Checkout` (`navigate(-1)`),
`Profile`. Deleted the dead per-page `*-back` CSS. Legacy (LEGACY_MODE) pages
still use their own — not worth touching parked code.

**The broader lesson (for future work):** the path from "vibe coded" → "designed"
is *consolidation* — one BackLink, then one Card, one SectionHeader, one
EmptyState, etc. Every time a pattern appears 3+ times, extract it. Consistency
reads as intent.

## Part 2 — Discover page

There was **no way to browse creators** — `/@handle` URLs only, and the imported
`MainSearch` (aliased `DiscoverPage`) was never routed. That component is the
**legacy v1 skill-swap matcher** (teach/learn overlap) — wrong model for v3, so
it was not reused.

- **`src/lib/profiles.js` → `listStorefronts()`** — creators with ≥1 published
  skill, each with a product count + sample cover. Two queries (skills, then
  profiles `.in(ids)`) to avoid guessing FK-hint names. Sorted by product count.
- **`src/app-pages/Discover.jsx`** — search box + responsive grid of storefront
  cards (cover banner, avatar, name, @handle, bio, product-count chip) linking to
  `/@handle`.
- **Routing/nav:** repointed the unused `DiscoverPage` import to the new
  `Discover`, added `/discover` route in `main.jsx`, and a **Discover** nav link
  (desktop + mobile) in `Header.jsx`, first in the group.

Verified `listStorefronts` against live data: 6 published skills → 4 storefronts
(`@jonbeauxfordtest` has 3, etc.).

## Verify
`eslint` clean on new/changed files (the 2 `main.jsx` react-refresh errors are
pre-existing); `npm run build` OK.

## Follow-ups
- Storefront cards show a sample cover from one product — could become a
  mini-collage later.
- Discover has no sort/category filters yet; fine for the current creator count.
