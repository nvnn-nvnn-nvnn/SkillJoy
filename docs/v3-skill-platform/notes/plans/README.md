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
