# 02 — MVP Scope: In & Out

> Build **only** what's in scope. Anything in "Explicitly OUT" must not be built,
> even if it seems easy — **scope creep is the #1 risk.**

## In scope — Creator side

1. **Auth + creator account** — email/password + Google OAuth.
   *(Already exists in v1 via Supabase Auth — reuse, see doc 03.)*
2. **Storefront page** — public, mobile-first, link-in-bio at
   `skilljoy.me/@username`. Lists the creator's published Skills. Must look
   modern/2026 (a selling point — see doc 06).
3. **Skill builder** — the make-or-break screen. Create/edit a Skill: title,
   outcome, cover, price, add/reorder mixed content blocks. As simple as "add a
   product" in Stan.
4. **Versioning** — editing a published Skill increments its version; buyers
   auto-get updated content + an "Updated to v2" indicator.
5. **Per-Skill community space** — a single lightweight thread per Skill,
   buyer + creator only. Posts + replies. **Not** a forum.
6. **Simple dashboard** — sales, revenue, payout status, buyer list (exportable
   CSV), basic analytics (doc 06).
7. **Stripe Connect onboarding** — wrapped to feel friendly, not like
   configuring Stripe (doc 04).

## In scope — Buyer side

8. **Checkout** — hosted, card + Apple Pay + Google Pay. Instant access on
   success.
9. **Buyer account + permanent locker** — purchased Skills live forever,
   re-accessible, always current version. Self-service resend access / receipt /
   fix email.
10. **Skill consumption view** — view blocks (watch / download / copy / read) +
    access the community space.

## In scope — Trust layer (mostly copy + process, minimal code)

11. **Transparent payout status** in the dashboard + plain-English policy:
    *"We never freeze your money in silence. If anything is ever flagged, you'll
    see exactly why and reach a real person."* No automated account termination;
    any risk flag pauses payout pending **human** review, surfaced with a reason.

## Explicitly OUT — do NOT build

- ❌ **Runnable/hosted AI tools.** AI products are delivered as
  configs/prompts/workflow **files only**, never executed or hosted by us. Hard
  line — it's a different company.
- ❌ Full LMS (quizzes, grading, certificates, drip scheduling, SCORM).
- ❌ Marketplace / discovery / browse-to-buy (creators bring their own traffic).
- ❌ Custom domains, deep theme customization.
- ❌ Native mobile apps (responsive web only).
- ❌ Affiliates, upsells, order bumps, coupons, abandoned-cart.
- ❌ Email marketing / broadcast tools.
- ❌ Built-in video calls (coaching = external link at MVP).
- ❌ Multi-currency / own merchant-of-record tax engine (use Stripe Tax only if
  needed; keep simple).
- ❌ Bundles across multiple Skills (a single Skill already bundles formats;
  cross-Skill bundles are post-MVP).

## Inherited features that are NOT in v3 MVP

These exist in the current codebase (v1) but are **not** part of the v3 storefront
loop. Park them behind a flag, don't delete (see doc 07, Phase 0):

- Skill **swaps**, matches.
- **Escrow** + dispute + auto-release cron (the v1/v2 services flow). v3 Skills
  use a clean destination charge, **no escrow**.
- Campus / `.edu` verification gate.

## Definition of done

A non-technical creator can: sign up → connect payouts → build a Skill with
mixed content → publish it at their link → share to social → a buyer purchases
on mobile → gets instant permanent access → the creator updates the Skill and
buyers see v2 → both use the community space → the creator sees sales, payouts,
and analytics, and trusts that their money won't vanish silently.

If that full loop works, the MVP is done. Everything else is post-MVP iteration
driven by what real creators ask for.
