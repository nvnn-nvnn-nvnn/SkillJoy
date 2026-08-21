# 163 — UI/UX roadmap captured, and plan 01 is missing

Date: 2026-08-20

## 1. UI roadmap → `plans/02-storefront-ui-roadmap.md`

Filed as a **plan**, not a change-log note, per `plans/README.md`: it describes
features not built yet. Devv is implementing these solo.

Contents: guns.lol-derived UI candidates filtered for a product that *sells*
things. Tier 0 is the two already decided (accordion groups, scroll snap), Tier 1
is cheap/high-payoff (entrance animations, avatar ring, bio effects, themed
scrollbar, tab identity), Tier 2 is the differentiating work (view counter, OG
embeds, visualizer, custom fonts, badges). Each carries its theme key, the file
to start in, and the specific trap.

Three findings worth pulling out of it:

- **The two features already chosen are the cheapest on the list**, because
  `skillGroups` in `Storefront.jsx` already buckets products into ordered sections
  and `.sf-grouphead` already renders title + rule + count. Both are render modes
  over existing structure, not new structure.
- **The view counter needs no new system.** `recordEvent('storefront_view')`
  already fires on every load and `getCreatorEvents` already reads it. It's a
  cached read.
- **The editor must be reorganised BEFORE these land.** `DEFAULT_THEME` is at 42
  keys, the General panel is where new ones keep accumulating, and "the
  customization page is hard to navigate" was already a complaint (note 155).
  Retrofitting organisation onto 50 keys is materially worse than onto 42, so
  this is sequenced first in the plan.

Also recorded a verified inventory (grepped, not remembered) of what the theme
system already covers, so the next round of ideas doesn't re-propose shipped
features.

## 2. `plans/01-freelance-orders-and-ai-comms-agent.md` does not exist

Asked to update the AI-comms-agent plan. It isn't there.

`plans/README.md` has indexed it since the folder was created (2026-08-18,
per the directory mtime), describing "commissioned-work order lifecycle, escrow,
and an AI agent that drives each order forward — Status: planned, not started."
But `plans/` contains **only `README.md`**. `git log` shows the directory first
appearing in `25e3087`, already without the file.

So the plan exists as a **decision that was made, with none of the thinking
recorded**. The index line is all that survives.

I did not reconstruct it. That plan encodes product decisions — how orders are
scoped and priced, where escrow sits relative to the existing `purchases` flow,
what the agent is actually allowed to send on a creator's behalf — and inventing
those and presenting them back as prior reasoning would be worse than the gap,
because it would look authoritative.

Flagged in `plans/README.md` with a warning block so the missing file is obvious
from the index rather than discovered by clicking a dead link.

**Transferable:** an index entry is not a document. This one read as complete for
two days. If a README lists it, the file should exist — even as a stub with a
title and an open-questions list, which is exactly what the folder is for.

## 3. Skeleton written (follow-up, same day)

Asked to write it up with the structure. `plans/01-…md` now exists as an
explicitly-labelled **skeleton**: section headings and open questions to fill in,
with a banner making clear the structure is reconstructed and the decisions are
not. Still no invented product decisions.

Writing it surfaced something that changes the plan's shape, so it is recorded as
verified **Prior art** rather than left for rediscovery:

> **Most of the escrow half already exists.** SkillJoy v1 was a Fiverr-style
> marketplace with full Stripe-Connect escrow, and that code was wrapped behind
> `LEGACY_MODE` (`src/lib/config.js`), never deleted.

`backend/routes/payments.js` runs a complete state machine over `gig_requests` —
`create-intent`, `confirm`, `deliver`, `release`, `dispute`, `respond`,
`submit-evidence`, `cancel-dispute`, `buyer-cancel`, `cancel`, `refund`,
`status/:orderId` — with states `accepted → escrowed → delivered → released →
completed`, plus `disputed`, `cancelled`, `withdrawn`. Seven matching
transactional email templates exist in `backend/lib/email.js`, chargebacks are
handled in `webhooks.js`, `dispute_evidence` has RLS, and `MyOrders.jsx` /
`Disputes.jsx` / `DisputeDetail.jsx` are the UI. `ESCROW_PAYMENT_SYSTEM.md`
documents the Connect setup end to end.

So the first question is not "how do we build escrow" but **"does a v3 freelance
order reuse `gig_requests` or a new table borrowing its state machine"** — and
the central risk is running two payment systems at once, since v3's `purchases` /
`skillFulfillment.js` path is entirely separate from this one.

Two other findings recorded in the skeleton:

- **There is no job scheduler in this codebase.** Every backend action is
  request- or webhook-triggered. Time-based nudges ("delivery overdue", "auto-
  release in 24h") need infrastructure that does not exist — likely the largest
  hidden cost in the plan, and it is needed whether or not an AI writes the text.
- **"Drafts for approval" vs "sends autonomously" is the load-bearing decision**
  for the agent half. Everything else — safety, audit log, kill switch,
  disclosure — follows from it.

## Files
- `docs/v3-skill-platform/notes/plans/01-freelance-orders-and-ai-comms-agent.md` (new, skeleton)
- `docs/v3-skill-platform/notes/plans/02-storefront-ui-roadmap.md` (new)
- `docs/v3-skill-platform/notes/plans/README.md` (index)
