# 119 — Trust & safety pass: cancel-subscription UI, product reports + takedown, skill dispute notifications

_2026-07-11. Built on Fable 5 from the Opus audit prompt. Three parts, all REUSING existing
infrastructure (reports table + admin tab + billing portal + gig-dispute webhook pattern) —
nothing rebuilt, no DB migration._

## Part A — Cancel/manage subscription (Settings)

- New **Subscription** `.sj-card` in `Settings.jsx`, loaded via the existing
  `getBillingStatus()`:
  - `none` → "You're not subscribed. Your free trial starts when you publish."
  - `trialing` → "Free trial — N days left" (via existing `trialDaysLeft`)
  - `active` → "Active — renews {date}"
  - `past_due` → red "Payment issue — storefront paused" warning
  - load/error states handled.
- **"Manage / cancel subscription"** button → existing `openBillingPortal()` → Stripe-hosted
  portal (card update / invoices / cancel). Deliberately NO custom cancel flow — Stripe's
  portal is the safe, already-built surface.

## Part B — Report a product + admin takedown (content moderation)

Reused the whole existing reports pipeline; only the 'skill' type was added end to end:
- **backend/routes/reports.js** — `SKILL_REASONS` (scam/pirated/explicit/illegal/spam/other),
  `'skill'` allowed in reportedType, ownership check (404 if product missing, block reporting
  your own), 24h dedup already applied generically. `reported_type` is free text → no migration.
- **src/components/ReportModal.jsx** (already existed, generic) — added skill reasons + label
  'product'.
- **SkillPublic.jsx** — a small muted "⚑ Report this product" line above the buy bar (hidden for
  the creator), opening the ReportModal with `reportedType:'skill'`.
- **backend/routes/admin.js**:
  - `/reports` enrichment: skill branch returns product title, creator name, current skill
    status, and `skill_url` (`/@handle/skillId`) for the admin to view the live page.
  - NEW **POST /api/admin/takedown-skill { skillId }** (same ADMIN_EMAIL guard as siblings):
    sets `skills.status='draft'` — **unpublish, NOT delete** (a report may be bogus; reversible,
    creator can appeal) — resolves pending skill reports, notifies the creator ("removed pending
    review").
- **Admin.jsx** Reports tab — 'product' badge (green), link to the live product, and a
  **"🚫 Take down"** button (confirm dialog → endpoint → refresh) shown only for pending reports
  on still-published skills.

## Part C — v3 skill-purchase dispute notifications (webhooks.js)

The existing `charge.dispute.created/closed` handlers only knew legacy `gig_requests`; a
chargeback on a storefront sale did nothing. Now, when the gig lookup misses (`!order`), we look
up `purchases` by `stripe_payment_id = dispute.payment_intent`:
- **created** → notify the creator ("chargeback opened on your sale — Stripe will ask for
  evidence") + admin.
- **closed** (won|lost) → notify the creator of the outcome.
- **STRICT SCOPE honored:** additive notifications ONLY. No purchase-status change (flipping
  `purchases.status` would revoke the buyer's access via the `has_paid_purchase` RLS branch —
  that's a money/access decision, not a notification), no schema change, gig logic untouched.

### Idempotency caveat (deliberate)
`purchases` has no dispute-flag column and we avoided a migration, so redelivery-idempotency is
gated on an **existing-notification check** (type `chargeback` + `related_id = purchase.id` +
outcome-specific title). This is read-then-write, not atomic like the gig branch's
`.neq(...)` update — two *concurrent* deliveries of the same event could double-notify (harmless:
duplicate notification, no money involved). Sequential redeliveries dedupe correctly. If this
ever matters, add a `purchases.dispute_status` column and mirror the gig pattern.

## Not done / follow-ups
- **Legal page CONTENT** — out of scope for code by design: source real Terms/Privacy/Refund
  text (Termly/iubenda/lawyer) and paste into the existing pages. AI-fabricated terms are a
  liability.
- Stripe **Radar** — dashboard config (Fraud & risk), not code. Turn it on.
- Optional later: auto-takedown after N distinct pending reports; creator appeal flow.

`node --check` clean on reports.js/admin.js/webhooks.js · `vite build` ✅ · no migration needed.
