# 109 — Onboarding legacy cleanup (Phase 0)

_2026-07-09. First Phase-0 item from note 108._

## Done

**Onboarding.jsx → single-step flow:**
- `TOTAL_STEPS` 2→1, `STEP_LABELS` = `['About you']`; deleted `TIME_SLOTS`, `toggleSlot()`,
  `availability` state, `step` state, the whole Step-2 availability grid JSX, and the
  `.onb-avail*` / `.onb-slot` CSS.
- `save()` no longer writes `availability` to the profiles upsert (column still exists in
  the DB — harmless; drop later if desired).
- Nav simplified: no Back/Continue, primary button goes straight to `save()`.
- `navigate(LEGACY_MODE ? '/matches' : '/build')` → `navigate('/build')`; removed the
  `LEGACY_MODE` + `DAYS_OF_WEEK` imports.
- Build verified clean.

## Legacy routes/nav removed (option (b), done on Opus)

- **main.jsx** — deleted the entire `{LEGACY_MODE && <>...</>}` route block and its now-dead
  imports (Chat, Matches, Swaps, MySwaps, Gigs, GigDetails, MyListings, MyOrders, Disputes,
  DisputeDetail, VerifyCollege) + the `LEGACY_MODE` import. `Discover` kept (live at `/discover`).
- **Header.jsx** — deleted the gated "Campus" nav block + dead imports (`LEGACY_MODE`,
  `useUnreadCounts`/`unread`, icons Users/Repeat/ShoppingBag/MessageCircle/Scale). `Package` kept
  (live "Products" item).
- The legacy **page files** still exist on disk (unreferenced) + in git history — not bundled now.
  `LEGACY_MODE` still exported from `lib/config.js` and referenced by legacy page internals; left alone.
- Build verified clean after each cut.

## Already handled (found during audit — cross off Phase 0)

- **ErrorBoundary** already wraps the app (`main.jsx`), and a **NotFound catch-all** route exists.
  The Phase-0 "error boundary + real 404" item is effectively done — verify UX, don't rebuild.

## Deliberately kept

**ProfileView** (old swap profile card, used in onboarding view-mode) — replacing it with a
storefront-preview is a design task, not cleanup. Left for a later Opus session.
