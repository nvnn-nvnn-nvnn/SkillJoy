# SkillJoy — Changelog

All notable changes to SkillJoy. Detailed per-feature build notes live in
`docs/v3-skill-platform/notes/` (numbered 42–91).

---

## [1.0.0] — 2026-07-08 🎉 First release

**SkillJoy v1 is live in production at [skilljoy.me](https://skilljoy.me)** — a
link-in-bio creator commerce platform (Stan/Sellfy-style), built on top of the
original gig/swap marketplace (now gated behind `LEGACY_MODE`). Real-money Stripe
payments, end to end.

### Product types (the "skill" primitive)
Every product has two independent axes: **`kind`** (what it is) and
**`pricing_type`** (`onetime` | `membership`). Built types:
- **Digital product** — file/PDF/template delivery, with a required-delivery publish guard.
- **Online course** — sections → lessons → mixed content blocks, with a course player + progress.
- **1:1 coaching** — bookable call slots synced to availability + Google Calendar free/busy.
- **Membership** — recurring subscription, member-only content feed, cancel-anytime.
- **Webinar** — live/evergreen ticketed event (flat-block delivery).
- **Lead magnet** — free freebie that captures emails to the creator's list.
- _Bundle_ — deferred to a future release.

### Builder
- Type-first "Add product" flow → tailored, stepped, type-aware builder (same shell, type-specific body).
- Flat block editor (File/Guide/Video/…) with a grid block picker; nested section/lesson editor for courses.
- Cover upload, promo video, per-type hints, publish checklist, confirmation-message + reviews options.

### Selling, checkout & fulfilment
- **One-time checkout** via Stripe embedded Payment Element (destination charge, platform fee, no escrow).
- **Promo codes** with redemption limits.
- **Order bumps** — offer another of your one-time products as a discounted add-on at checkout; grants both.
- **Memberships** — recurring Stripe subscriptions via hosted Checkout; access gated on active status.
- **Guest checkout** — buy with just name + email + card; a passwordless account is created at fulfilment and a magic link emailed for access (one-time paid products).
- **Fulfilment** via Stripe webhook + a `/confirm` fast-path — both idempotent (atomic once-only; safe against races and redelivery).
- **The Locker** — buyers' permanent library + consumption view (blocks, course player, per-membership feed, reviews, community thread).

### Memberships (Patreon-style)
- Pricing locked to recurring for membership kinds (bad state unrepresentable, enforced at creation + in UI).
- **Member updates feed** — creators broadcast posts; members read + reply.
- **Manage/cancel** via Stripe Customer Portal; the webhook flips access to expired on cancel.
- New members' emails auto-captured to the creator's subscriber list.

### Storefront & discovery
- Link-in-bio **storefront** + storefront editor (theme, links, social).
- Public sales pages per product; Discover; SEO/meta; unsubscribe.

### Auth & accounts
- Email/password + forgot-password flow.
- **Google OAuth** sign-in, with a unified post-auth onboarding gate.
- **Passwordless guest accounts** — created on guest purchase, accessed via magic link; upgradeable to password/Google on the same email.

### Email (via Resend, verified domain skilljoy.me)
- Unified branded **purchase confirmation / thank-you** template across one-time, guest, and membership.
- Guest magic-link delivery; creator sale notifications; lead/membership capture.
- Supabase Auth emails (recovery/confirm) routed through Resend SMTP.

### Analytics & marketing
- Event funnel (storefront_view → skill_view → checkout_start → purchase) + creator dashboard aggregates.
- Email capture + subscriber list; discounts panel; audience panel.

### Payments hardening & reliability
- Idempotent fulfilment (flip-or-insert once-only) across webhook + confirm.
- **Stale Connect account self-heal** — a connected `acct_` created under a different key/mode degrades gracefully instead of erroring; checkout re-prompts reconnect.
- **Guest ownership guard** — email-based pre-check blocks re-charging a guest for a product they already own.
- Generic 500 responder (no internal error leakage); rate limiting on payment/public routes.

### Infrastructure
- **Frontend:** React + Vite on **Vercel** (all `VITE_*` env: Stripe publishable key, Supabase, API URL).
- **Backend:** Express on **Railway** (Stripe secret + webhook secret, Resend, Supabase service key).
- **Data/auth:** Supabase (Postgres + RLS + realtime); migrations in `docs/v3-skill-platform/migrations/`.
- **Payments:** Stripe Connect (Express accounts, destination charges) — live.
- **Email:** Resend on verified domain.

### Notable fixes from the go-live gauntlet
Documented in notes 86–90 — every blocker was an account/mode/environment mismatch:
- Stripe **platform mismatch** ("No such destination") — connected accounts belong to the key that created them.
- **Resend domain** verification + custom SMTP for auth emails.
- **Magic-link** single-use / email-prefetch behavior.
- **Ad-blocker** blocking `analytics.js` by filename → renamed to `metrics.js`.
- **pk/sk mode split** across Vercel + Railway; `//login` double-slash redirect; live **Connect activation**.

---

_Build history: `docs/v3-skill-platform/notes/`. The going-live playbook:
note 89 (test→live cutover). The gotcha field guide: note 88._
