# Explainers

Deep, teaching-first docs on **how major parts of SkillJoy actually work** — the
mental model, the data flow, and where the real code lives. Unlike the numbered
change-logs (`../NN-*.md`, which record *what changed on a given day*), these
explain *how a whole system works right now*, so you can reason about it and
extend it without reverse-engineering the code each time.

Rule for this folder: **no vibe.** Every claim points at a real file/function.

## Index
- [01 — How the app works (full architecture)](01-how-the-app-works.md) — the map:
  stack, routing, auth, data model, the theme/live-preview engine, checkout &
  money, and the repeatable recipe for adding a customization feature.
- [02 — Email capture & broadcast](02-email-capture-and-broadcast.md) — how a
  visitor becomes a subscriber and how one creator email reaches all of them:
  transactional vs marketing, idempotent capture, the send fan-out, HMAC
  unsubscribe links, and deliverability. Ends with hands-on exercises.
- [03 — Learning module: build the "link product"](03-build-a-link-product-module.md)
  — a build-it-yourself guide (no finished code): move affiliate links down into
  the products area as cards, keep the profile area for socials. Covers the
  schema decision, merging two ordered lists, build order, and the traps.
- [04 — The storefront editor, feature by feature](04-the-storefront-editor.md) —
  the walkthrough: for each major thing the editor does (background, glass, glow,
  name effects, overlays, the cursor FX layer, splash, site music, uploads, the
  live preview, presets/import-export, drag-to-order sections, link buttons) —
  the trick that makes it work, the real code, and the trap. Ends with a landmine
  index and ten hands-on exercises.

- [05 — Finishing the link-in-bio](05-finishing-the-link-in-bio.md) — a **build
  guide for five unbuilt features**: click tracking, per-page OG tags, email
  capture as a placeable block, auto-fetched link thumbnails, and link
  scheduling. Not a change note — nothing in it is implemented. For each: the
  one decision that's expensive to get wrong (anonymous-write surface, crawlers
  that don't run JS, SSRF, hidden-vs-secret), the schema, the traps that bite
  after it works, and checkpoints to verify it. Ends with a suggested order.
