# 91 — SkillJoy v1.0 released 🎉

_2026-07-08. SkillJoy is complete and **live in production at skilljoy.me**, taking
real-money Stripe payments end to end. This is the v1 milestone marker._

---

## What v1 is

A link-in-bio **creator commerce platform** (Stan/Sellfy-style), built on top of the
original gig/swap marketplace (now gated behind `LEGACY_MODE`). Creators sell digital
products, courses, coaching, memberships, webinars, and lead magnets from one
storefront; buyers check out (logged-in or as a guest) and consume in the Locker.

Full feature inventory: **`CHANGELOG.md`** (repo root) — the "everything" doc.

## The journey (notes map)
- **42–62** — the phased v3 build: spec, builder, sell/deliver, versioning/community,
  dashboard/analytics, storefront, booking, email capture, commerce depth, growth
  automation, payment reliability, Connect/sandbox setup.
- **63–78** — builder UX overhaul (type-first flow, tabbed/stepper builder, block
  picker, dialog system), digital delivery, coaching + Google Calendar, courses.
- **79–90** — this stretch: lead magnets, **memberships** (feed + cancel portal +
  capture), **order bumps**, **Google auth**, **guest payments**, email
  confirmations, payments hardening (stale-Connect self-heal, guest ownership guard),
  and the **go-live gauntlet** (config gotchas → test→live cutover → live on
  Vercel/Railway/Stripe-live/Resend).
- **91** — this note: v1 shipped.

## The meta-lesson from going live

Every single production blocker was the **same family**: an account / mode /
environment mismatch, where "correct" code failed because of *where* or *which
credentials* it ran with. Wrong Railway service, test-vs-live keys, pk/sk split
across Vercel+Railway, Resend account, live Connect activation. Each was solved by
**reading the error payload** (the `request_log_url` account id was the recurring
tell) and suspecting the environment before the code.

Rules that came out of it (see notes 88, 89):
- Restart/redeploy after **any** env change — the process reads env once at boot.
- `pk` + `sk`: same account, same mode; they live in two hosts (Vercel/Railway).
- External ids (`acct_`, `price_`) belong to the key that created them.
- Verify Resend domain + route Supabase auth email through it.
- Don't name a shipped script `analytics.js`.

## What's next (post-v1, not blocking)
- Real-card end-to-end smoke test in live; confirm the live webhook delivers 200s.
- Bundle product type; membership tiers; post-purchase (one-click) upsell.
- Broadcast email sending (capture exists; sending is the other half).
- Funnel analytics surfacing.

**v1 is done. It works, end to end, in production. 🚀**
