# SkillJoy v1 — Legacy Archive

This folder preserves the **original SkillJoy** product: a campus, college-gated
(`.edu`) marketplace built around three pillars:

1. **Skill swaps** — students bartering skills with each other (no money).
2. **Gigs** — per-buyer custom freelance work with a Stripe escrow + dispute flow.
3. **Campus trust** — `.edu` verification gating who could list/buy.

It is kept for reference and possible future use. Nothing here is deleted — the
v2 rebrand (see [`../v2-creator-platform/`](../v2-creator-platform/README.md))
**archives** these features rather than removing them: the database tables,
routes, and components stay in the codebase but are severed from the primary
user flow.

## What's in here

| Item | What it is |
|---|---|
| `services-marketplace-proposal.md` | An earlier (superseded) proposal to expand v1 into a campus services marketplace. This is **not** the v2 direction — kept for historical context only. |
| `notes/` | 40 dated session change-logs documenting how v1 was built (security, RLS, chat, escrow, disputes, gig toggles, etc.). |

## Still-live operational guides (NOT moved here)

These remain at the repo root because v2 keeps using the systems they describe:

- `STRIPE_INTEGRATION_GUIDE.md`
- `ESCROW_PAYMENT_SYSTEM.md`
- `NOTIFICATIONS_SETUP.md`

## v1 features and their v2 fate

| v1 feature | v2 fate |
|---|---|
| Skill swaps (barter) | **Archived** — tables/code kept, pulled from main nav |
| Gigs + escrow + disputes | **Kept & reframed** as custom *services* |
| `.edu` college gating | **Severed** — gate disabled, code kept for future campus mode |
| Stripe Connect payouts | **Kept** — reused for products & services |
| Chat, profiles, notifications, admin | **Kept** — copy reframed |
