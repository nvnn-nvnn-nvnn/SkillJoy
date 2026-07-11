# 110 — Phase 0 security pass + dispute-webhook idempotency fix

_2026-07-10. Quick pass over the outstanding Phase-0 security items from
[108](108-production-roadmap-and-audit.md), ahead of the Phase-1 paywall build._

## Audit outcome (four Phase-0 items)

- **CSRF — satisfied by construction.** The API is Bearer-token-in-`Authorization`-
  header (`backend/middleware/auth.js`), not cookie sessions; no cookie/session
  middleware in the backend, and CORS is locked to `FRONTEND_URL` in prod.
  Browsers won't auto-attach an `Authorization` header cross-site, so there's no
  CSRF surface. Nothing to build.
- **RLS — solid.** Frontend uses the anon key (`src/lib/supabase.js`), so RLS is
  the real authz boundary; backend uses the service key (bypasses RLS, routes
  self-authorize). Every table that gets created has RLS enabled (cross-checked
  all 15 `CREATE TABLE` vs 16 `ENABLE ROW LEVEL SECURITY`). Core policies in
  `001` are correctly owner-scoped; **`purchases` has no client INSERT/UPDATE
  policy** — fulfilment is service-role-only. Good.
- **Webhook idempotency — strong on money paths.** Skill purchase, order bump,
  membership start, subscription updates, guest fulfilment, and gig escrow all
  use the atomic `.neq('status','paid')` / `.neq('payment_status',…)` guard so
  side-effects fire once on Stripe redelivery. **Gap found + fixed** (below).
- **Migrations applied to prod — still open, unverifiable from code.** 20 loose
  `.sql` files, no Supabase-managed state. Recommendation stands: adopt Supabase
  CLI + diff against `supabase/schema.sql`. Could not close this item.

### False alarm (retracted)
Initially flagged `018_course_lessons.sql` `create table lesson_progress` (no
`if not exists`) as a collision with `017`. It is NOT a bug — `018` line 42 does
`drop table if exists public.lesson_progress cascade;` immediately before,
deliberately superseding 017's block-keyed table with a lesson-keyed one. Left
untouched.

## Change made

**`backend/routes/webhooks.js` — dispute handlers made idempotent.** The three
chargeback branches previously re-updated `gig_requests` and re-inserted
buyer/seller/admin notifications on every delivery, so a redelivered Stripe
dispute event produced duplicate notifications (no money double-moved). Added
the same atomic-update-then-gate pattern used elsewhere in the file:

- `charge.dispute.created` → `.neq('payment_status','chargebacked')` + `.select()`;
  bails before notifying if already flagged.
- `charge.dispute.closed` won branch → guard on `chargeback_won`.
- `charge.dispute.closed` lost branch → guard on `chargeback_lost`.

Each branch now only inserts notifications when the update actually transitioned
a row. `node --check` clean.

Note: this is legacy v1 `gig_requests` code — dormant in the storefront model
(skill-purchase disputes don't create gig orders) but still wired into the live
webhook, so the guard is worth having.

## Next
Phase 1 paywall (platform subscription + server-side publish gate) per
[108](108-production-roadmap-and-audit.md). Full implementation prompt was
handed to Fable 5. Key design points captured there: platform sub is a DIRECT
charge on SkillJoy's own account (`kind:'platform_sub'`, no Connect/transfer),
kept isolated from the existing `skill_sub` creator-membership path; the 5%
per-sale transaction fee already exists; publish must move server-side
(`publishSkill()` is currently a client Supabase update); and the public
storefront gate is cleanest as an RLS change keying published-skill visibility
to the creator's sub status (auto-dark on lapse, existing buyers keep access).
