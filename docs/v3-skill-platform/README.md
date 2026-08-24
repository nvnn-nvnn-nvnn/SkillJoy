# SkillJoy v3 — The Skill Platform ("Stan Store for skills")

> **This folder is the new source of truth.** It supersedes
> [`docs/v2-creator-platform/`](../v2-creator-platform/) (the Gumroad-style
> "digital products + services" vision), which is now **deprecated**. See
> [The lineage](#the-lineage) below for why and what carries over.

SkillJoy is a **mobile-first, link-in-bio creator storefront** where creators
sell their expertise. The core innovation is the product primitive: instead of
selling a "course" or a "file," creators sell a **Skill** — an outcome-oriented
package that can hold *any mix* of content formats (video, files,
prompts/configs, text guides, coaching links), can be **versioned over time**,
and has a **community space** attached.

**Target user:** non-technical social-media creators (TikTok / IG / YouTube).
The whole UX bar: *they can build and launch a Skill in under 10 minutes, on a
phone, without ever seeing the words "API," "webhook," or "Stripe dashboard."*

**One-liner:** *Sell courses, templates, workflows, prompts, and coaching as one
Skill, from one link.*

## Read the docs in order

| # | Doc | What it covers |
|---|-----|----------------|
| 00 | [Vision & positioning](00-vision-and-positioning.md) | Who it's for, the Stan Store comparison, why "Skill" is the bet |
| 01 | [The Skill primitive](01-the-skill-primitive.md) | The atomic sellable unit, content blocks, the unification rule |
| 02 | [MVP scope — in & out](02-scope-in-and-out.md) | Exactly what to build; the hard "do NOT build" list |
| 03 | [Architecture & data model](03-architecture-and-data-model.md) | Stack decision, routes, schema, mapping onto the existing codebase |
| 04 | [Payments](04-payments.md) | Stripe Connect Express, destination charges, platform fee, trust |
| 05 | [Content delivery](05-content-delivery.md) | Signed URLs, video, prompts, coaching links, versioning mechanics |
| 06 | [Design, analytics & trust](06-design-analytics-trust.md) | Mobile-first aesthetic, the analytics surface, transparent payouts |
| 07 | [Roadmap & implementation notes](07-roadmap-and-implementation.md) | 5 phases, file-level build notes against `src/` and `backend/` |

Session log lives in [`notes/`](notes/) (continues the project-wide numbered
note convention — see `42-...`).

> ### ⚠️ Read [`LANDMINES.md`](LANDMINES.md) before touching the code
>
> Twelve traps in this codebase that have each cost a real debugging session —
> the backtick that silently ends a `<style>` block, why `!user` doesn't mean
> "signed out", global element styles in `App.css` leaking into every component,
> and where the schema actually lives. Symptom-first, so you can find yours by
> what you're seeing. **When something bites you twice, add it there** — numbered
> notes are chronological and get buried.

## Locked decisions (2026-06-22)

- **Selling unit:** a single unified **Skill** (mixed content blocks). Not
  "products vs. services" — that distinction is gone.
- **Stack:** keep the existing **Vite + React + Express + Supabase** app.
  The spec recommends Next.js but explicitly allows a swap; rewriting a working
  app is not justified for a solo build. *(Open to revisit — see doc 03.)*
- **Payments:** Stripe Connect **Express**, **destination charges** with an
  `application_fee` (platform fee ~5%). No escrow round-trip for Skills.
- **Coaching** = an external booking link (Calendly etc.) at MVP. No native
  scheduling, no built-in calls.
- **Legacy:** v1 (campus gig/swap) and v2 (products+services) features are
  archived, not deleted — same philosophy as the v1→v2 archive.

## The lineage

- **v1 — campus skill-swap + gig marketplace** (escrow, disputes, `.edu` gate).
  Archived in [`docs/v1-legacy/`](../v1-legacy/), restorable via the `v1-final`
  git tag.
- **v2 — Gumroad-style products + services** (kept the gigs/escrow flow, added
  instant-buy digital products). Documented in
  [`docs/v2-creator-platform/`](../v2-creator-platform/) but **never
  implemented in app code** (that work was docs + archival only). **Deprecated**
  by v3.
- **v3 — this.** The Stan Store "Skill" primitive. Note the heavy overlap with
  v2's groundwork: v2 already specced instant-buy, private file storage,
  signed-URL delivery, and a Stripe webhook fulfilment branch — all of which v3
  reuses. v3's change is **conceptual**: collapse "product" and "service" into
  one versioned, multi-block **Skill** with a community space, and drop the
  escrow/services half entirely.

## What carries over from v2 (don't re-invent)

The v2 docs are deprecated as a *vision*, but these mechanics are still correct
and reusable verbatim:
- Private storage bucket + per-download signed URLs (v2 doc 03 → v3 doc 05).
- Stripe webhook fulfilment on `payment_intent.succeeded`, branching on
  payment-intent `metadata.kind` (v2 doc 03 → v3 doc 04).
- `CAMPUS_MODE`-style flag pattern for severing legacy gates without deleting
  them (v2 doc 02/04 → v3 doc 07, Phase 0).
