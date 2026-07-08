# 89 — Test → Live cutover checklist (Stripe going live)

_Session 2026-07-08. The go-live playbook, distilled from actually doing it. The
core rule: the frontend key and backend key must be the **same Stripe account AND
the same mode**, and each lives in a **different host** — so flipping to live is
two dashboards + two redeploys that must happen together._

---

## 0. The mental model (why this is fiddly)

Two facts collide:
1. **Stripe keys are paired.** The `pk_…` (publishable, frontend) and `sk_…`
   (secret, backend) must be from the **same account** and the **same mode**
   (test/live). Mix test+live → the Payment Element won't mount and
   `confirmPayment` throws *"elements should have a mounted Payment Element."*
2. **The two keys live in two different hosts:**
   - **Vercel** builds the **frontend** → holds all `VITE_*` vars (the **publishable**
     key, Supabase URL/anon key, `VITE_API_URL`).
   - **Railway** runs the **backend** → holds the **secret** key, webhook secret,
     `RESEND_*`, Supabase service key.

So a mode flip is never one switch — it's a coordinated change across both hosts,
each needing its own redeploy. Flip only one → mismatch error.

Two gotchas that compound it:
- **`VITE_*` vars are baked into the frontend at build time.** Changing one in
  Vercel does nothing until you **redeploy** the frontend.
- **Env changes on Railway also need a redeploy/restart** (Node reads env at start).

## 1. The cutover sequence

**A. Stripe dashboard (switch to LIVE mode) — first**
- Developers → Webhooks → **Add endpoint** →
  `https://skilljoy-production.up.railway.app/webhooks/stripe`
  → subscribe: `payment_intent.succeeded`, `checkout.session.completed`,
  `customer.subscription.updated`, `customer.subscription.deleted`
  → copy its **live `whsec_…`**.
- Confirm **Connect is enabled** for the live account.

**B. Railway (backend)**
- `STRIPE_SECRET_KEY` → `sk_live_…`
- `STRIPE_WEBHOOK_SECRET` → the live `whsec_` from step A (test/`stripe listen`
  secrets do NOT carry to live)
- Confirm `RESEND_API_KEY` + `RESEND_FROM` (verified domain) are set
- **Redeploy**

**C. Vercel (frontend)**
- `VITE_STRIPE_PUBLISHABLE_KEY` → `pk_live_…` (**same account** as `sk_live`)
- **Redeploy** (env change alone won't rebuild the bundle)

**D. After both are live**
- **Creators must re-onboard for payouts in live** — a connected `acct_…` belongs
  to the account+mode that created it, so test onboarding does NOT carry to live
  (see notes 86/88). Clear stale ids + re-onboard under the live key.
- **Smoke test with a REAL card, small amount** — `4242…` only works in test mode.
- Verify the live webhook is delivering: Stripe → that endpoint → recent deliveries
  should be 200s; watch Railway logs for `✅ … fulfilled`.

## 2. "Test mode on the live site" (staging without real money)

To exercise skilljoy.me with test cards, put the **whole stack** in test mode:
- Vercel `VITE_STRIPE_PUBLISHABLE_KEY` = `pk_test_…` + redeploy
- Railway `STRIPE_SECRET_KEY` = `sk_test_…`, `STRIPE_WEBHOOK_SECRET` = test secret + redeploy
- Use `4242…`.
Getting this working end-to-end is the green light that the plumbing is correct —
then flipping to live (§1) is just swapping keys.

## 3. The error → cause cheat sheet
- **"elements should have a mounted Payment Element"** → `pk`/`sk` mode or account
  mismatch (or the frontend wasn't redeployed / cached old bundle). This error is
  purely frontend — the webhook is NOT involved.
- **"No such destination: acct_…"** → connected account created under a different
  account/mode than the current key; re-onboard under the current key (notes 86/88).
- **No confirmation email in live** → live webhook not configured, or its secret
  wrong in Railway (logged-in one-time + membership emails send only from the
  webhook; guest also sends via `/confirm`). Or `RESEND_*` missing in Railway.

## 4. The rules, memorised
- `pk` + `sk`: **same account, same mode**, always.
- Frontend key change ⇒ **Vercel redeploy** (build-time inlined).
- Backend env change ⇒ **Railway redeploy**.
- Webhook secret is **per mode** — test and live are different endpoints/secrets.
- **Real cards only in live**; `4242…` is test-only.
- Connected accounts **re-onboard per mode** — nothing carries test→live.

**TL;DR:** going live = flip `sk`+webhook in Railway and `pk` in Vercel to live
**together**, each redeployed, add a live webhook endpoint, re-onboard creators in
live, and smoke-test with a real card. The frontend/backend keys living in two
hosts is why it's a coordinated cutover, not a single switch.
