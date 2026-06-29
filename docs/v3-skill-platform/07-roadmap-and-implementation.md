# 07 — Roadmap & Implementation Notes

Phased so each phase is shippable. The risky payment work is isolated to
Phase 3, exactly as the source spec advises. File paths are concrete against the
current repo. **No code has been written yet — this is the build plan.**

Legend: `[ ]` = to do. Paths relative to `SkillJoy/`.

---

## Phase 0 — Park the legacy (reversible, no schema)

The v3 storefront loop doesn't use swaps, escrow/disputes, or the `.edu` gate.
Park them behind a flag (same pattern v2 specced with `CAMPUS_MODE`), don't
delete — keeps the `v1-final` rollback intact.

- [ ] `src/lib/config.js` — add `LEGACY_MODE` flag (default `false`), read from
      `import.meta.env.VITE_LEGACY_MODE`.
- [ ] Wrap swaps / matches / gigs / disputes / `.edu`-verify nav + routes in
      `LEGACY_MODE &&` in `src/main.jsx` and `src/components/Header.jsx`.
      **Wrap, never delete** — routes stay registered, just unlinked.
- [ ] New v3 nav: **Explore-your-storefront · Build · Locker · Dashboard ·
      Profile**. (No marketplace/Explore-others — see scope doc 02.)
- [ ] Leave escrow/dispute backend routes mounted but unreferenced by v3 UI.

**Exit:** app presents as a creator storefront; legacy still reachable by URL
with the flag on.

---

## Phase 1 — Foundation: identity + schema (no payments)

- [ ] **Migration 1** (`supabase/schema.sql` + new
      `docs/v3-skill-platform/migrations/`): `profiles` adds `username`, `bio`,
      `storefront_theme` (doc 03). Backfill/claim a username flow in onboarding.
- [ ] **Migration 2:** create `skills`, `content_blocks`, `purchases`,
      `community_posts`, `analytics_events` + indexes + RLS (doc 03).
- [ ] Add `skill_update` to the `notifications.type` CHECK constraint (doc 05).
- [ ] `src/lib/api.js` — add `skills`, `purchases`, `community`, `analytics`
      client modules (thin wrappers over backend + supabase).
- [ ] Reuse existing Supabase Auth (email/password + Google OAuth already wired
      in v1) — no new auth work, just ensure buyer & creator are the same
      account model (`profiles.role` can stay `both`).

**Exit:** schema live; a creator has a `@username`; no UI to build skills yet.

---

## Phase 2 — The Skill builder (the make-or-break screen)

- [ ] `backend/routes/skills.js` — CRUD for skills + blocks, reorder
      (`position`), `POST /:id/publish`. Mount in `backend/index.js`.
- [ ] Private storage bucket `skill-files` + policies; cover-image bucket (can be
      public) for `cover_url`.
- [ ] `src/app-pages/SkillBuilder.jsx` — list my skills + create/edit one.
- [ ] `src/components/BlockEditor.jsx` — per-type block forms (video URL, file
      upload, prompt/text rich text, workflow text|file, coaching link),
      drag-to-reorder. **Smart defaults, no jargon** (doc 06).
- [ ] Draft/publish toggle; cover upload.
- [ ] ⚠️ Name these `BlockEditor`/`content-blocks` — `BlockButton.jsx` +
      `routes/blocks.js` already mean *user blocking* (doc 03).

**Exit:** a creator builds + publishes a Skill with mixed blocks. Not buyable
yet.

---

## Phase 3 — Sell + deliver (payments — isolated, careful)

This is the minimum that proves "creator can sell a Skill from a link." Ship it
to your own audience as the first real test.

- [ ] `src/app-pages/Storefront.jsx` (`/@:username`) — public, mobile-first,
      lists published skills. Open Graph meta for social shares. Fires
      `storefront_view`.
- [ ] `src/app-pages/SkillPublic.jsx` (`/@:username/:skillId`) — sales page:
      title/outcome/cover/price + block **titles only** (no gated content).
- [ ] `backend/routes/checkout.js` — `POST /:skillId/intent`: destination charge
      PaymentIntent (app fee) + pending `purchases` row + `automatic_payment_methods`
      for Apple/Google Pay (doc 04).
- [ ] Extend `backend/routes/webhooks.js` — `payment_intent.succeeded` with
      `metadata.kind='skill'` → mark purchase paid, set `version_at_purchase`.
      **Keep separate from the legacy escrow branch.**
- [ ] `src/app-pages/Checkout.jsx` — Stripe Payment Element (`@stripe/react-stripe-js`
      already installed). Fires `checkout_start`.
- [ ] `backend/routes/locker.js` — `GET /` purchases, `GET /:skillId` consume,
      `GET /block/:blockId/download` signed URL (verify paid purchase, doc 05).
- [ ] `src/app-pages/Locker.jsx` + `SkillConsume.jsx` +
      `src/components/BlockRenderer.jsx` (watch/download/copy/read per type).
- [ ] Add `SKILL_PLATFORM_FEE_BPS` to `backend/config/fees.js` (don't overload
      the $6 flat service fee — doc 04).

**Exit:** end-to-end buy → pay → instant permanent access works on mobile;
creator gets paid via their existing Connect account.

---

## Phase 4 — Versioning + community

- [ ] `POST /api/skills/:id/version` — bump `version`, notify buyers via existing
      `create_notification(...)` (doc 05). Recommend an explicit "Publish update"
      button, not silent auto-bump.
- [ ] "Updated to v{N}" badge in `SkillConsume.jsx` (compare `skills.version` vs
      `purchases.version_at_purchase`).
- [ ] `backend/routes/community.js` + `src/components/CommunityThread.jsx` —
      posts + replies, purchase-gated, one thread per skill. Reuse the existing
      `Comments.jsx` pattern as a reference, but keep it buyer-gated. **Not a
      forum** (doc 01).

**Exit:** creator updates a Skill, buyers see v2; buyers + creator use the
per-Skill community space.

---

## Phase 5 — Dashboard, analytics & trust

- [ ] `backend/routes/analytics.js` — event ingest + per-skill / per-creator
      aggregates (funnel, engagement, retention — doc 06).
- [ ] `src/app-pages/Dashboard.jsx` — sales, revenue, payout status, buyer list
      with **CSV export**, + `src/components/AnalyticsCards.jsx`.
- [ ] `src/components/PayoutStatus.jsx` — transparent payout state from
      `GET /api/stripe-connect/balance` + a human-set `payout_hold_reason`
      (doc 06). No silent-freeze path in code.
- [ ] Trust policy copy in `RefundPolicy.jsx` / Terms.

**Exit:** creator sees sales/payouts/analytics and trusts their money is safe →
**MVP definition of done met** (doc 02).

---

## Membership (recurring) — slot after Phase 3's one-time loop

Ship one-time pricing first. Add Stripe Subscriptions for
`pricing_type='membership'` + `customer.subscription.*` webhooks + churn status
for retention analytics (doc 04). Don't block the first sale on this.

---

## Risk notes

- **Don't touch the legacy escrow/dispute payment paths** while building Skill
  checkout — keep the Skill charge flow in its own route + its own webhook
  branch.
- **Every legacy change is a wrap, not a delete.** Verify the `v1-final` tag
  still restores v1 before considering Phase 0 done.
- **Fulfil in the webhook, never the client callback** (doc 04).
- **Gate all content server-side** against a paid `purchases` row — never trust
  the client (doc 03/05).
- Test the full buy → webhook → access loop with Stripe **test** keys before
  going live.

## Suggested first action

Phase 0 (reversible, immediately visible) → then Phase 1 schema. Phase 3 is the
proof-of-concept milestone: get one real Skill sold from one real link.
