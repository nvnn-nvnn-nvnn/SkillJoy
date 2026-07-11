# 42 — v3 Skill-Platform Spec + Implementation Notes

**Date:** 2026-06-22

## Overview

The owner handed over the **SkillJoy MVP Build Spec** — a "Stan Store for skills"
vision built around a single unified **Skill** primitive — and asked to "add
notes for everything." This session was **documentation only; no app code
changed.**

## The pivot it represents

This spec is a **different vision** from the v2 docs locked the day before
(2026-06-21):

| | v2 (`docs/v2-creator-platform/`) | v3 (this) |
|---|---|---|
| Model | Gumroad: products **+** services | Stan Store: one **Skill** primitive |
| Selling unit | product or service | a Skill = any mix of content blocks |
| Escrow/gigs | kept, reframed as "services" | dropped from the model |
| Extras | — | versioning, per-Skill community, trust layer |
| Stack hint | keep Vite/React/Express | spec said Next.js (we kept Vite) |

## Decisions locked (confirmed with the owner via AskUserQuestion)

1. **v3 supersedes v2.** This Skill-primitive spec is the new source of truth;
   the Gumroad-style v2 vision is **deprecated** (v2 README banner added).
2. **Deliverable:** spec docs **+ file-level implementation notes** mapped to the
   real `src/`/`backend/` codebase. Docs only — no code yet.
3. **Stack:** keep existing **Vite + React + Express + Supabase** (spec allows
   the swap; no Next.js rewrite for MVP).

## What was created → `docs/v3-skill-platform/`

- `README.md` — index, locked decisions, the v1→v2→v3 lineage, what carries over
- `00-vision-and-positioning.md` — audience, Stan Store comparison, the "Skill" bet
- `01-the-skill-primitive.md` — the atomic unit, block types, versioning, community
- `02-scope-in-and-out.md` — MVP in/out lists + inherited features parked
- `03-architecture-and-data-model.md` — **stack decision, routes, schema mapped
  onto existing `profiles` + 5 new tables, RLS, backend/frontend file map**
- `04-payments.md` — Connect Express, destination charges, fee, webhook fulfil
- `05-content-delivery.md` — signed URLs, video embeds, copy-to-clipboard,
  coaching links, versioning mechanics
- `06-design-analytics-trust.md` — mobile-first aesthetic, analytics funnel,
  transparent-payout trust layer
- `07-roadmap-and-implementation.md` — Phases 0–5 with concrete file-level steps

## Key implementation findings (from reading the codebase)

- Spec's `users` table = existing **`profiles`** (already has
  `stripe_account_id`, `stripe_onboarded`, `avatar_url`). Add `username`, `bio`.
- **5 new tables** needed: `skills`, `content_blocks`, `purchases`,
  `community_posts`, `analytics_events` (DDL in doc 03).
- **Stripe Connect Express is already wired** (`backend/routes/stripe-connect.js`
  + onboard/status/balance) — v3 reuses it directly.
- **Webhook-fulfilment pattern + private-bucket signed URLs** were already
  specced in v2 (for "products") — reusable verbatim for Skills.
- ⚠️ **Naming clash:** `src/components/BlockButton.jsx` + `backend/routes/blocks.js`
  already mean *user blocking*. Use `BlockEditor`/`BlockRenderer`/`content-blocks`
  for Skill content blocks.
- v3 Skill purchases are **instant destination charges — no escrow.** The v1
  escrow/clearance/dispute machinery + auto-release cron stays parked with legacy.

## Open questions for the owner

- Exact **platform fee %** (doc 04 assumes ~5% via a new `SKILL_PLATFORM_FEE_BPS`,
  separate from the v1 $6 flat service fee).
- **Video host** choice: YouTube-unlisted / Vimeo / Mux (doc 05).
- **Version bump:** explicit "Publish update" button (recommended) vs auto-bump.
- Confirm **no Next.js rewrite** (doc 03 open question — SEO is the only thing it
  buys; OG tags suffice for a shared link).

## Next

Phase 0 — park legacy behind a `LEGACY_MODE` flag (reversible), then Phase 1
schema. See `07-roadmap-and-implementation.md`.
