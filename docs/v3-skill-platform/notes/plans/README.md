# Plans

Forward-looking specs for features **not built yet** — the thinking captured
before code, so a plan survives between sessions and isn't re-derived from
scratch. Distinct from `../` (dated change-logs: what shipped) and
`../explainers/` (how shipped systems work).

Each plan carries a **status** line. When a plan ships, leave it here and add a
change-log note + (if it's a real system) an explainer.

## Index

- [01 — Freelance orders + AI comms agent](01-freelance-orders-and-ai-comms-agent.md)
  — commissioned-work order lifecycle, escrow, and an AI agent that drives each
  order forward. **Status: SKELETON — decisions not yet made.**
  Structure + open questions only; the original was never written (note 163).
  Its **Prior art** section is verified, not assumed: most of the escrow half
  already exists in the v1 code behind `LEGACY_MODE`.

- [02 — Storefront UI/UX roadmap](02-storefront-ui-roadmap.md) — UI-only feature
  candidates (accordion groups, scroll snap, entrance animations, view counter,
  OG embeds, visualizer…), each with its theme key, effort, and trap. Includes an
  editor-reorganisation prerequisite. **Status: planned, not started.**

- [03 — Link product: data, editor placement, render](03-link-product-design.md)
  — the concrete spec behind `../explainers/03`: extend `store_links` with a
  `placement` axis, links render after products within a group, editor splits by
  placement. **Status: designed, not built.**
  ⚠️ Its link half is **superseded by 04**, which generalises `placement` into
  real blocks.

- [04 — Link-in-Bio blocks](04-link-in-bio-blocks.md) — the block model behind
  the link-in-bio product spec: a `store_blocks` table owning a set of links
  plus its own layout, then the 4 layout styles (Classic / Grid / Carousel /
  Cards), per-block Settings, products-as-a-block, and onboarding templates.
  **Status: planned, not started.**
  The headline finding: **there is no block model for links today**, so Phase 1
  is a hard prerequisite for every other item in the spec — none of the layout
  controls have anywhere to live until it exists. Carries five open questions
  that must be answered before Phase 1, the biggest being how existing links
  get backfilled.
