# 01 — Freelance orders + AI comms agent

**Status: SKELETON — decisions not yet made.**

> ⚠️ **This file is a reconstruction of the *structure*, not of the plan.**
> The original was indexed in `plans/README.md` from 2026-08-18 but never
> written (see note 163). The section headings and open questions below are
> scaffolding to fill in; the **Prior art** section is the exception — that is
> verified from the codebase, not assumed. Everything under "Open questions" is
> genuinely undecided and must be answered by Devv, not inferred.

---

## 0. What this is

From the surviving one-line index entry:

> "commissioned-work order lifecycle, escrow, and an AI agent that drives each
> order forward."

Two features that were bundled into one plan. They are separable, and probably
should be sequenced rather than built together:

- **A. Freelance orders** — a buyer commissions custom work (not a pre-made
  digital product), money is held, work is delivered, money is released.
- **B. AI comms agent** — automated messaging that moves an order along:
  nudges, status updates, deadline reminders, hand-offs.

**B is worthless without A.** A is useful on its own.

---

## 1. Prior art — ⚠️ read this before designing anything

**Most of A already exists.** SkillJoy v1 was a Fiverr-style campus marketplace
with full Stripe-Connect escrow. That code was **wrapped behind a flag, never
deleted** (`LEGACY_MODE` in `src/lib/config.js`, default off).

### What is already built and working

`backend/routes/payments.js` implements a complete escrow state machine over the
`gig_requests` table (24 queries against it in that file alone):

| Route | Purpose |
|---|---|
| `POST /create-intent` | buyer pays, funds held |
| `POST /confirm` | confirm the payment |
| `POST /deliver` | seller marks work delivered |
| `POST /release` | buyer releases funds to seller |
| `POST /dispute` · `/respond` · `/submit-evidence` · `/cancel-dispute` | dispute flow |
| `POST /buyer-cancel` · `/cancel` · `/refund` | exits |
| `GET /status/:orderId` | current state |

**Order states already defined:** `accepted → escrowed → delivered → released →
completed`, plus `disputed`, `cancelled`, `withdrawn`.

Also present:
- **Transactional emails** for every transition — `backend/lib/email.js`:
  `orderRequestedSeller`, `orderAcceptedBuyer`, `paymentEscrowedSeller`,
  `workDeliveredBuyer`, `fundsReleasedSeller`, `fundsCleared`, `disputeFiled`.
- **Chargeback handling** — `charge.dispute.created` / `.closed` in
  `backend/routes/webhooks.js`.
- **Dispute evidence** — `dispute_evidence` table with RLS, FK to `gig_requests`.
- **UI surfaces** — `src/app-pages/MyOrders.jsx`, `Disputes.jsx`,
  `DisputeDetail.jsx`.
- **Stripe Connect setup** — documented end-to-end in
  `ESCROW_PAYMENT_SYSTEM.md` (root).

### What this means for the plan

The work is **revival and adaptation**, not greenfield. The first real question
is not "how do we build escrow" but:

> Does a v3 freelance order reuse `gig_requests`, or is it a new table that
> borrows the state machine?

Arguments both ways — `gig_requests` carries v1 campus semantics (`.edu` gate,
gig listings, campus matching) that v3 doesn't want, but it also carries a
working, dispute-tested lifecycle and every FK/RLS policy already written.

⚠️ Note also that v3's own money path (`purchases`, `skillFulfillment.js`,
`fulfilled_at`) is **completely separate** from this. Two payment systems in one
codebase is the central risk of this plan.

---

## 2. Open questions — A. Freelance orders

*(Nothing below is decided. These are the calls that have to be made.)*

**Data model**
- [ ] Reuse `gig_requests`, or new `orders` table borrowing its states?
- [ ] How does a commission relate to `skills`? Is "commissioned work" a new
      `kind`, a separate entity, or an attribute of a coaching product?
- [ ] Does it share `purchases`, or stay separate? (What does the Locker show?)

**Lifecycle**
- [ ] Are the v1 states right for v3, or does commissioned work need
      revisions/milestones (`revision_requested`, partial delivery)?
- [ ] Auto-release window — v1's `workDeliveredBuyer` email says **3 days**. Keep?
- [ ] Who can cancel, when, and what happens to the money at each point?

**Scoping & pricing**
- [ ] Fixed price quoted up front, or a proposal/negotiation step?
- [ ] Deposit vs. full escrow up front?
- [ ] Revisions — included count? paid?
- [ ] Deadlines — does the system track and enforce them?

**Money**
- [ ] Same 5% platform fee (`SKILL_PLATFORM_FEE_BPS`)? Different for services?
- [ ] Does the platform-subscription paywall gate this too?

**Trust**
- [ ] Who arbitrates disputes, on what SLA? (v1 emails promise "1–2 business days.")
- [ ] Reviews — reuse the `reviews` table, or separate?

---

## 3. Open questions — B. AI comms agent

**Scope — the load-bearing question**
- [ ] Does the agent **draft for approval**, or **send autonomously**?
      Everything else depends on this. Autonomous sending on a creator's behalf,
      in their voice, to a paying customer, is a materially different product —
      and a different liability — from a suggested reply.
- [ ] If autonomous: what can it never do without a human? (quote a price, agree
      a deadline, accept a revision, apologise on the creator's behalf, refund)

**Triggers**
- [ ] Which events wake it? (order placed, delivery overdue, buyer silent N days,
      dispute opened, auto-release approaching)
- [ ] Where does it run? ✅ **CORRECTION (2026-08-21):** an earlier version of
      this plan claimed there was no job scheduler. That was **wrong**.
      `backend/index.js` runs four `node-cron` jobs already:
      | Schedule | Job |
      |---|---|
      | `0 0 * * *` | auto-release escrowed funds 3 days after delivery |
      | `0 1 * * *` | clearance — transfer to Connect after the 14-day window |
      | `0 * * * *` | archive completed gig chats 24h after completion |
      | `0 * * * *` | booking reminders for sessions within 24h |
      So time-based triggers are **not** a missing capability — the pattern,
      the dependency, and a `withTimeout` wrapper all exist to copy.
      The real open questions are narrower: does an agent tick belong as a fifth
      cron or a queue? And note these run **in-process**, so multiple app
      instances would each fire them (duplicate sends), and a restart silently
      skips a missed window rather than backfilling. Both are fine at one
      instance and both need solving before scaling out.

**Channel**
- [ ] Email (Resend, exists) or in-app messages? v1 has a `messages` table and
      `Chat.jsx`; v3 does not use them.
- [ ] Does the buyer know they're talking to an agent? (Disclose — same reasoning
      as the affiliate tag in note 158: an undisclosed automated identity is a
      trust problem, not a UX detail.)

**Model**
- [ ] Provider and model? Where do keys live? (Backend only — same rule as Stripe.)
- [ ] What context does it get? An order thread is customer data; decide what is
      sent to a third party and say so in the ToS.
- [ ] Cost per order, and who absorbs it?

**Safety**
- [ ] Rate limits, so a loop cannot email a buyer twenty times.
- [ ] Kill switch per creator, and globally.
- [ ] Audit log of everything sent — non-negotiable if it sends autonomously.

---

## 4. Suggested sequencing

Not a decision, a proposal — reorder freely:

1. **Decide the data-model question** (§2 first bullet). Everything blocks on it.
2. **Revive A behind a flag** — adapt the existing state machine, no AI.
3. **Ship A** to real orders. The lifecycle needs to be trustworthy before
   anything automated touches it.
4. **Add the scheduler** — time-based triggers are needed for reminders whether
   or not an AI writes them. Useful alone; also the missing infrastructure.
5. **B as draft-for-approval first.** Creator sees every message before it sends.
6. **Autonomous only for narrow, safe, templated cases**, if ever.

---

## 5. To fill in

Replace the open questions with decisions as they're made, then this becomes a
real spec. When it ships: leave it here, add a change-log note, and write an
explainer for the escrow state machine — it is exactly the kind of system that
should not have to be re-derived from `payments.js`.
