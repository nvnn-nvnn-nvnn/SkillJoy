# 66 — Dashboard declutter into tabs (Phase B)

_Session 2026-07-02. Folded `/dashboard`'s seven stacked panels into tabbed
sections so the page breathes, matching the builder's tab pattern (note 64)._

## The problem
`Dashboard` rendered everything at once in a 900px column: stats row →
Analytics + Payouts → Bookings + Availability → Audience + Discounts → Buyers
table. Seven panels of vertical scroll — the "cramped / vibe-coded" feel.

## The shape now
- **Pinned above the tabs:** page header (title + Customize storefront / New
  product) and the **KPI stat row** (Revenue / Sales / Buyers). Those stay
  visible on every tab — a dashboard should always show its headline numbers.
- **Four tabs** (`TABS` const, same pattern as the builder):
  - **Overview** — Analytics + PayoutStatus
  - **Sales** — Buyers table + Export CSV + refund
  - **Bookings** — Upcoming sessions + AvailabilityEditor
  - **Audience** — AudiencePanel + DiscountsPanel

Same grouping logic as before, just gated behind `{tab === …}`. All data
loading, `refund`, and `exportCsv` are unchanged — this is a presentation
reorg, exactly like the builder.

## The gotcha this time (applied note 65's landmine knowledge)
The tab buttons are bare `<button>`s, so the global `button, .btn { … }` reset
in `App.css` tried to make them **pill-shaped, centered, inline-flex**. `.db-tab`
explicitly overrides `border-radius:0`, `background:none`, and the border/padding
to render as underline tabs. This is the same landmine from note 65 — every new
`<button>` fights that global rule. Knowing it up front made this a non-issue.

## Files
- `src/app-pages/Dashboard.jsx` — only file. Added `TABS` + `tab` state; wrapped
  the existing sections in tab panels; added `.db-tabs` / `.db-tab` / `.db-panel`
  styles. Also repointed the empty-state link `build a Skill → /build` to
  `add a product → /build/new` (consistent with the type-first flow).

## Verify
`eslint` clean, `npm run build` OK.

## Follow-ups
- The stat row still only reflects **paid one-time + membership** sales revenue
  (from `listCreatorSales`); no MRR/refund breakdown yet.
- Visual unification with `/services` cards is close but not identical — a later
  pass could share a Tabs primitive between `/dashboard`, `/services`, and the
  builder instead of three copies of near-identical `.xx-tab` CSS.
