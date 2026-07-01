# 61 — Sandbox testing checklist (reusable)

Run-through to validate the full money + delivery loop in Stripe **test mode**.
Two accounts: **Seller** (main) + **Buyer** (incognito, different email).
Companion to note 60 (payments reliability audit).

## 0. Pre-flight (config)
- [ ] Backend on **test** keys (`sk_test_…`, test `STRIPE_WEBHOOK_SECRET`)
- [ ] Frontend on `pk_test_…`; `VITE_API_URL` → **local** backend
- [ ] `stripe listen --forward-to localhost:<port>/webhooks/stripe` running (use the
      signing secret it prints for `STRIPE_WEBHOOK_SECRET`)
- [ ] `ADMIN_EMAIL` matches a real profile row

## 1. Seller setup
- [ ] Onboard → set a **username** (storefront handle)
- [ ] Profile → **Set up payouts** → finish Stripe Connect (Stripe test data)
- [ ] Build a Skill → add a **file block** → set a price → **Publish**
- [ ] `/storefront/edit` → bio, banner, a social link
- [ ] Visit `/@yourhandle` logged-out → storefront + published Skill show

## 2. Buyer purchase (core loop)
- [ ] Incognito: sign up as Buyer
- [ ] `/@sellerhandle/:skillId` → **Buy** → card `4242 4242 4242 4242`
- [ ] Redirects to **Locker**; Skill appears
- [ ] **Download the gated file** → works for buyer
- [ ] `stripe listen` shows `payment_intent.succeeded`; purchase row → `paid`
- [ ] Seller gets "New sale 🎉" notification + receipt email fires

## 3. Paywall enforcement
- [ ] Logged-out user hitting the file URL → **403 / blocked**
- [ ] A second non-buyer account can't download → **403**
- [ ] Buyer's signed URL expires (~60s) and re-mints on re-request

## 4. Discount code
- [ ] Seller creates a promo code
- [ ] Buyer applies it → charged the **discounted** amount
- [ ] `times_redeemed` increments after success

## 5. Membership (if testing)
- [ ] Buy a `membership`-priced Skill → hosted subscription → access granted
- [ ] Cancel subscription in Stripe test dashboard → access → **expired**

## 6. Refund
- [ ] Seller refunds the purchase
- [ ] Purchase → `refunded`; buyer download now **403s**; buyer gets notification

## 7. Edge cases (should all fail gracefully)
- [ ] Buy your **own** Skill → blocked
- [ ] Buy a Skill you **already own** → 409
- [ ] Buy a **draft/unpublished** Skill → blocked
- [ ] Pay a seller with **payouts not set up** → 402
- [ ] Declined card `4000 0000 0000 9995` → clean error, no access granted
- [ ] 3DS card `4000 0025 0000 3155` → auth prompt, then completes

## 8. Analytics sanity
- [ ] Visit storefront + Skill page a few times → `/services` **Views** climb
- [ ] After a sale → **Sales / Revenue / Conv.** update on the card

## ⚠️ Watch for the /confirm race
In step 2, if access is granted **before** `stripe listen` logs the webhook, the
`/confirm` fast-path likely won — buyer gets access but **receipt email + creator
notification + promo-count + automation are skipped** (webhook then no-ops on the
`.neq('status','paid')` guard). Symptom: "access yes, but no receipt/notification."
That's the `fulfilled_at` bug in note 60 — fix before go-live.

## Test cards
- `4242 4242 4242 4242` — success
- `4000 0000 0000 9995` — decline
- `4000 0025 0000 3155` — requires 3DS auth
(Any future expiry, any CVC, any ZIP.)
