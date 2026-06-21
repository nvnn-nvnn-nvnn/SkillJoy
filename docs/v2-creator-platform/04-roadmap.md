# 04 — Roadmap

Phased so each phase is shippable and low-risk. Earlier phases touch no payment
code; the risky payment work is isolated to Phase 3.

## Phase 1 — Identity & IA (no schema, fully reversible)
Goal: the app *feels* rebranded; campus framing gone; legacy features parked.

- [ ] `src/lib/config.js` with `CAMPUS_MODE` flag (default false).
- [ ] Wrap every `.edu` / `college_verified` / `university_domain` gate in
      `CAMPUS_MODE &&` (Gigs, GigDetails, MyListings, Profile, Settings, Login,
      Home, About, main.jsx). **Wrap, never delete.**
- [ ] `Header.jsx`: swap to v2 nav (Explore · Sell · Purchases · Chat · Profile);
      remove Swaps/Matches/Disputes from the bar.
- [ ] Rewrite copy: `Home.jsx`, `HowItWorks.jsx`, `About.jsx`, onboarding —
      "everyday creators," "digital products & services," drop campus language.
- [ ] Relabel "gig" → "service" in user-facing strings.
- [ ] Keep archived routes registered in `main.jsx` (just unlinked).

**Exit:** new visitor sees a creator platform, no `.edu` wall; swaps/disputes
still reachable by URL.

## Phase 2 — Digital products: creator side (new DB, no payments yet)
- [ ] Run `products` + `product_purchases` DDL (doc 03) in Supabase; mirror into
      `supabase/schema.sql` and `docs/v2-creator-platform/migrations/`.
- [ ] Create private `product-files` storage bucket + policies.
- [ ] `ProductNew.jsx` create/edit form with file upload.
- [ ] Extend `MyListings.jsx` to show products alongside services.

**Exit:** a creator can publish a product; it's visible (but not yet buyable).

## Phase 3 — Digital products: buyer side (payments — isolated, careful)
- [ ] `backend/routes/products.js`: `/buy` (PaymentIntent + pending purchase),
      `/:id/download` (verify → signed URL).
- [ ] Extend `webhooks.js` to fulfill on `payment_intent.succeeded` (branch on
      metadata `kind: 'product'`).
- [ ] `ProductDetail.jsx` with Buy + Stripe Elements/Checkout.
- [ ] `Library.jsx` — purchased products + download buttons.
- [ ] Decide & implement product fee (see open questions, doc 03).

**Exit:** end-to-end buy → pay → instant download works; creator gets paid.

## Phase 4 — Explore & services reframe
- [ ] `Explore.jsx` unified browse (products + services grid + filters/search).
- [ ] Final relabel pass of the gigs UI as "services."
- [ ] Demote Disputes: reachable from a service order, not top nav.

## Phase 5 — Polish
- [ ] Creator dashboard: products + services + earnings in one view.
- [ ] Reviews/ratings for products.
- [ ] Refund handling for digital goods + RefundPolicy copy.
- [ ] Analytics (units sold, revenue).

## Risk notes

- **Don't touch escrow/dispute payment paths** while building products — keep the
  product charge flow in its own route + webhook branch.
- **Every gate change is a wrap, not a delete** — verify `VITE_CAMPUS_MODE=true`
  restores v1 behavior before considering Phase 1 done.
- Test products payments with Stripe test keys end-to-end (incl. webhook) before
  going live.

## Suggested first action

Phase 1 — it's reversible, immediately visible, and unblocks everything else
without risking payment code.
