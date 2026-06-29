# 41 — v1 Archive + v2 Creator-Platform Scaffold

**Date:** 2026-06-21

## Overview

Kicked off the rebrand of SkillJoy from a campus freelance/skill-swap
marketplace into a **digital products & services platform for everyday
creators** (Gumroad-style). Name stays **SkillJoy**. This session was
documentation + archival only — **no app code was changed**.

## Decisions locked

- **Selling unit:** both digital *products* (sold many times, instant delivery)
  and custom *services* (per-buyer, keeps existing escrow).
- **Audience:** open to everyone. College `.edu` gating is **kept in code but
  disabled** via a future `CAMPUS_MODE` flag — severed, not deleted.
- **Legacy:** skill swaps + disputes/escrow are **archived, not deleted**.
- **Name:** stays SkillJoy.

## What changed

### Archived v1 → `docs/v1-legacy/`
- Moved `docs/services-marketplace-proposal.md` (superseded) and all 40 session
  notes (`notes/`) here via `git mv` (history preserved).
- `page-snapshots/` — frozen copy of all 27 v1 pages (20 app-pages incl.
  `auth/`, 7 introduction-pages). Reference copies only; live pages still in
  `src/`.
- `README.md` explaining the archive + each v1 feature's v2 fate.

### New v2 spec → `docs/v2-creator-platform/`
- `README.md` — index + locked decisions
- `00-vision-and-positioning.md` — audience, Gumroad comparison
- `01-rebrand-map.md` — every v1 surface → keep / new / archive
- `02-architecture.md` — routes, nav, `CAMPUS_MODE` gate switch, data model
- `03-digital-products-spec.md` — new `products` + `product_purchases` tables,
  private file storage, signed-URL delivery, instant checkout flow
- `04-roadmap.md` — 5 phases (payment risk isolated to Phase 3)

### Config
- `eslint.config.js`: added `docs/v1-legacy` to `globalIgnores` so archived
  `.jsx` snapshots don't get linted.

### Git
- Commit `aa34e45` captures all of the above.
- Annotated tag **`v1-final`** marks the pre-rebrand rollback point.
  Restore anytime with `git checkout v1-final`. Tag is local — not yet pushed
  (`git push origin v1-final` when ready).

## Rollback layers (most → least complete)
1. **`v1-final` git tag** — exact full-repo restore.
2. **`docs/v1-legacy/page-snapshots/`** — human-readable page reference.
3. **`docs/v1-legacy/`** — archived proposal + session notes.

## Next
Phase 1 — Identity & IA (no schema, fully reversible): add `CAMPUS_MODE` flag,
wrap `.edu` gates, swap to v2 nav, rewrite landing/onboarding copy, relabel
"gig" → "service". See `04-roadmap.md`.
