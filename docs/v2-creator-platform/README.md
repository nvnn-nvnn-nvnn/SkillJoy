# SkillJoy v2 — Creator Platform

> **The rebrand:** SkillJoy moves from a campus freelance/skill-swap marketplace
> to a **digital products & services platform for everyday creators** — think
> Gumroad. Creators list digital *products* (sold many times, instant delivery)
> and offer custom digital *services* (per-buyer work). The name stays
> **SkillJoy**.

This folder is the source of truth for the rebrand. Read the docs in order.

## Documents

| # | Doc | What it covers |
|---|---|---|
| 00 | [Vision & positioning](00-vision-and-positioning.md) | Who it's for, how it differs from v1, the Gumroad comparison |
| 01 | [Rebrand map](01-rebrand-map.md) | Every v1 feature → keep / new / archive, with rationale |
| 02 | [Architecture](02-architecture.md) | Routes, nav/IA, data model, migrations, how the `.edu` gate is severed |
| 03 | [Digital products spec](03-digital-products-spec.md) | The one genuinely new surface: table, file storage, instant checkout, delivery |
| 04 | [Roadmap](04-roadmap.md) | Phased execution plan with concrete file-level steps |

## The one-paragraph summary

The existing `gigs` table is already ~80% of a product listing
(`title`, `description`, `price`, `tags`, `faqs`, active toggle). v2 adds a
**second purchase path** — an instant-buy *digital product* with file/license
delivery and no escrow round-trip — alongside the existing request→accept→escrow
flow, which is reframed as custom **services**. Skill swaps and the `.edu`
campus gate are switched off but preserved in code for a possible future
"campus mode."

## Decisions locked (2026-06-21)

- **Selling unit:** both digital *products* and custom *services*.
- **Audience:** open to everyone; college gating **kept in code but disabled**.
- **Legacy:** skill swaps + disputes/escrow **archived, not deleted**.
- **Name:** stays **SkillJoy**.
