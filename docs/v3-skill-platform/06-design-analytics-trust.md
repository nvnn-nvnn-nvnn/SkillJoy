# 06 — Design, Analytics & Trust

Three thin-but-important surfaces. The first two are differentiators; the third
is mostly copy + process.

---

## Design / UX

- **Mobile-first, always.** Design the phone layout first; desktop is secondary.
  (The audience shares a link on TikTok/IG and buys on a phone.)
- **Modern 2026 aesthetic** — clean, fast, polished. For this audience, **polish
  *is* the trust signal** and the direct differentiator vs. dated incumbents.
  Nothing that looks like a 2015 admin panel.
- **Skill builder simplicity is the whole bet.** If a non-technical creator
  can't build a Skill without help, the product fails. Smart defaults, minimal
  settings, zero jargon. No "API/webhook/Stripe/bucket" language anywhere a
  creator can see.
- **Fast load** — the storefront must survive a social traffic spike. Keep the
  public storefront light (it's the page that goes viral, not the dashboard).

Tailwind is already set up. Consider adding shadcn-style primitives (the spec
suggests shadcn/ui) for consistent modern components, but that's optional — the
bar is "looks 2026," not a specific library.

---

## Analytics

A **named competitor weakness** (Stan's "basic analytics") — so do this
well-ish. Keep it **visual and simple**. Backed by the `analytics_events` table
(doc 03).

Per creator **and** per Skill, track and display:

- **Conversion funnel:** storefront views → checkout starts → purchases.
  - `storefront_view` → `checkout_start` → `purchase` events.
- **Engagement:** % of buyers who opened the Skill, viewed blocks, returned.
  - `skill_view`, `block_open` events, distinct buyers, repeat visits.
- **Retention (memberships):** active vs. churned subscribers.
  - From subscription status (doc 04) — only meaningful once memberships ship.

Render as a few clean cards + a simple funnel bar, not a BI dashboard. This is
where SkillJoy visibly beats "basic analytics" — make it *legible*, not dense.

**Event ingestion note:** fire events from the client to
`POST /api/analytics/event`. Storefront/skill views can be anonymous
(`buyer_id` null). Guard against obvious abuse (rate-limit, ignore bot UAs) but
don't over-engineer at MVP.

---

## Trust layer (mostly copy + process, minimal code)

The promise: **"We never freeze your money in silence. If anything is ever
flagged, you'll see exactly why and reach a real person."**

- **Transparent payout status in the dashboard.** Show, in plain English: funds
  available, on the way, and — if ever — *paused, with the reason*.
- **No automated account termination.** Any risk flag **pauses payout pending
  human review** and is surfaced to the creator with a reason. There is no
  silent freeze and no auto-ban path in the code.
- **Plain-English policy copy** on the dashboard + a policy/RefundPolicy page.

**Implementation surface (small):**
- A `PayoutStatus.jsx` component reading Stripe Connect balance/payout state
  (reuse `GET /api/stripe-connect/balance`) + any manual `payout_hold` flag.
- A nullable `profiles.payout_hold_reason TEXT` (and maybe `payout_held BOOLEAN`)
  set **only** by an admin/human action, displayed to the creator verbatim.
- Policy copy lives in the existing introduction-pages (`RefundPolicy.jsx` /
  Terms) — align wording with the promise above.

The trust layer is more **commitment + UI honesty** than feature code — but the
honesty must be real: if the data model can silently freeze, the promise is a
lie. Keep any hold human-set and reason-bearing.
