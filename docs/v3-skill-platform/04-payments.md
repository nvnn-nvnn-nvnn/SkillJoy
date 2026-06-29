# 04 — Payments

## Model

- **Stripe Connect, Express accounts.** Creators onboard via Stripe Express;
  Stripe handles KYC / identity / payouts. This keeps SkillJoy out of
  money-transmitter territory.
- **Charge type: destination charges** with an `application_fee_amount` =
  SkillJoy's platform fee. Funds settle to the creator's connected balance;
  Stripe runs their payout schedule. SkillJoy takes a clean cut without
  custodying the bulk of funds.
- **No escrow for Skills.** A Skill purchase is instant fulfilment (digital
  goods). The v1 escrow / clearance / dispute machinery is **not** used for v3
  Skills — that flow stays parked with the legacy gig/services code.
- **Platform fee:** a single configurable constant (start **~5%**). Shown to
  creators as one transparent number, everywhere. No stacked surcharges.

> The existing v1 flat **`SERVICE_FEE_CENTS = 600` ($6)** in
> `backend/config/fees.js` is the *services/escrow* fee — a flat fee on per-buyer
> work. v3 Skills are commodity digital goods sold many times; a **percentage**
> fee fits better. Add a separate constant, e.g.
> `SKILL_PLATFORM_FEE_BPS = 500` (5%), rather than overloading the $6 flat fee.
> **(Open question: confirm the exact percentage with Devan.)**

## What's already wired (reuse)

`backend/routes/stripe-connect.js` already implements:
- `POST /api/stripe-connect/onboard` — create/continue Express onboarding
- `GET /api/stripe-connect/status` — is the seller onboarded?
- `GET /api/stripe-connect/balance` — connected balance

`profiles.stripe_account_id` + `profiles.stripe_onboarded` already exist. v3
reuses all of this verbatim — the creator who can already take service payments
can take Skill payments.

## Checkout flow (new, isolated from escrow)

1. **Buyer hits `/checkout/:skillId`.** Frontend fires an
   `analytics_events` `checkout_start`.
2. **Backend `POST /api/checkout/:skillId/intent`:**
   - Look up the skill + creator's `stripe_account_id`; reject if creator not
     onboarded.
   - Create a **PaymentIntent** with:
     - `amount = skill.price_cents`
     - `application_fee_amount = round(price_cents * fee_bps / 10000)`
     - `transfer_data.destination = creator.stripe_account_id` (destination
       charge)
     - `automatic_payment_methods.enabled = true` (gets card + Apple Pay +
       Google Pay)
     - `metadata = { kind: 'skill', skill_id, buyer_id, version }`
   - Insert a **pending** `purchases` row.
   - Return the client secret.
3. **Frontend** confirms with Stripe.js (Payment Element → Apple/Google Pay,
   hosted feel).
4. **Webhook `payment_intent.succeeded`** (extend `backend/routes/webhooks.js`):
   - Branch on `metadata.kind`. For `'skill'`: mark the `purchases` row `paid`,
     set `version_at_purchase`, fire `analytics_events` `purchase`.
   - **Fulfilment happens here, server-side — not on the client success
     callback** (client can be closed/spoofed).
5. **Instant access:** buyer redirected to `/locker/:skillId`; access is granted
   because a `paid` purchase row now exists.

> This is the same webhook-fulfilment pattern v2 already specced for digital
> products — branch on PaymentIntent `metadata.kind`. Keep the Skill branch
> separate from any legacy escrow branch in the same webhook handler.

## Memberships (recurring)

For `pricing_type = 'membership'`, use a **Stripe Subscription** (with the
connected account as destination via `application_fee_percent`) instead of a
one-time PaymentIntent. Access is gated on subscription `active`/`past_due`
status synced from `customer.subscription.*` webhooks.

> **MVP sequencing:** ship **one-time first** (Phase 3). Memberships add
> subscription lifecycle + churn handling — do them after the one-time loop is
> proven (Phase 4/5). Don't block the first sale on subscriptions.

## Fraud / trust

- Rely on **Stripe Radar** at MVP.
- **No silent freezes, no auto-termination.** Any manual risk action = human
  review + a reason surfaced to the creator (see doc 06, trust layer).
- Wrap **all** Stripe onboarding in friendly UI. The creator never sees a raw
  Stripe dashboard in the core flow.

## Refunds

Digital-goods refunds are creator-discretion at MVP. A refund =
`stripe.refunds.create` on the PaymentIntent + set `purchases.status='refunded'`
+ revoke access. Keep refund copy in the RefundPolicy page aligned (doc 06).
