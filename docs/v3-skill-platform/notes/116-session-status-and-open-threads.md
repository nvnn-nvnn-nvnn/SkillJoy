# 116 — LAUNCH RUNBOOK (v1 build complete)

_Refreshed 2026-07-11. The build phase is OVER — every checklist item is implemented or was
already present. What remains is a deploy + a few dashboard toggles + two decisions. This note is
the single source of truth for "what's left." Detailed notes referenced, not repeated._

## TL;DR
No required CODE work remains for launch. Critical path: **run migrations 024 + 025 → deploy →
verify Apple Pay domain + email-confirm → decide repo privacy → go.** The one thing to not fumble
is migration-before-deploy ordering (025 breaks onboarding if code ships first).

## 🚀 Deploy runbook (ORDER MATTERS)
1. [ ] **Run `024_username_cooldown.sql`** in prod Supabase (username change 500s without it).
2. [ ] **Run `025_tos_acceptance.sql`** in prod Supabase — **BEFORE deploying the code.** The
       onboarding upsert now writes `tos_accepted_at`/`tos_version`; if code ships before the
       columns exist, **onboarding breaks** for new users. Migration first, always.
3. [ ] **Commit + push** → Vercel (frontend) + Railway (backend) auto-deploy the whole session.
4. [ ] **Smoke test** on live: onboarding (fresh signup) · a purchase · publish a product · dark
       mode toggle · storefront email capture.

## 🔧 Owner dashboard toggles (no code, ~5 min each)
- [ ] **Apple Pay domain verification** — Stripe → Settings → Payments → Apple Pay → register
      `skilljoy.me`. This is what makes the wallet buttons appear (code is already done:
      `automatic_payment_methods` + Payment Element).
- [ ] **Supabase "Confirm email"** — verify it's ON (Auth → Providers → Email). That IS the
      email-verification gate.

## 🤔 Decisions (owner)
- [ ] **Repo privacy** — public repo, real name in old commit history. Make private or rewrite
      history before promoting.
- [ ] **Legal content** — paste real Terms/Privacy/Refund text (Termly/iubenda) into the existing
      pages. Highest actual exposure since onboarding FORCES TOS agreement.

## ⏸️ Deliberately deferred (NOT needed for launch)
- Supabase CLI migration tooling (manual `.sql` is fine for now).
- **Express Checkout Element** — the prominent one-tap Apple/Google Pay buttons above the card
  form. A conversion *bump*; inline wallets already work once the domain's verified. Payment-flow-
  sensitive → do on Opus if/when wanted.
- TOS re-acceptance on `TOS_VERSION` bump (existing users never re-prompted) — note 123.
- Reserve-old-handle redirects (username change breaks old `/@old` links) — note 122.
- R2/Bunny media infra — volume-driven; delivery works on Supabase today (locker.js).

## ✅ Everything that's DONE (by note)
Paywall armed + verified (111/112, migration 023) · Phase-0 security + legacy cleanup (109/110) ·
Phase-2 effects: bg video, overlays, audio, cursor/profile FX (117) · markdown descriptions +
course polish + audio-autoplay/fix (118) · trust & safety: reports/takedown, dispute
notifications, cancel-sub (119) · dark mode + social glow (120) · profile → account hub (121) ·
subscribe bug fix + dark-mode sweep + avatar size + product drag-reorder + username change (122) ·
TOS persistence (123). Already-present (audited, no work needed): "New sale 🎉" notifications,
free-product lead-magnet email capture, Apple/Google Pay code wiring.

## Migrations that must be applied to prod (running tally)
001–020 (base) · 021 (buggy, healed by 022) · 022 (paywall deferred) · 023 (paywall armed — DONE
on prod) · **024 (username cooldown — RUN)** · **025 (TOS — RUN before deploy)**.
