# 95 — Build-list card polish + coaching gated

_2026-07-08. Small UI + scope tweaks._

---

## 1. Skill list cards ([SkillBuilder.jsx](../../../src/app-pages/SkillBuilder.jsx) `SkillList`)
- **Too tall → fixed:** the culprit was a hardcoded `min-height: 200px` on
  `.sb-card-body`. Removed it; cards now size to content. Added `gap` for rhythm and
  a 2-line clamp on `.sb-card-outcome` so a long outcome can't balloon a card.
- **Type subheader:** replaced the raw lowercase `s.kind` at the card bottom with a
  labeled row — an uppercase "Type" label + a friendly type chip
  (`TYPE_BY_ID[s.kind]?.label`, e.g. "Digital product") on an accent-tinted pill,
  divided from the content with a top border.

## 2. 1:1 coaching gated ([productTypes.js](../../../src/lib/productTypes.js))
`coaching` → `built: false`. Coaching relies on Google Calendar free/busy, which
needs a paid Google Cloud project that isn't set up yet, and it isn't a priority.
Gating shows it as "Soon" on `/build/new` and blocks creation of new coaching
products; **existing** coaching products are unaffected (the builder/booking code is
all still there). Flip back to `built: true` when Google Cloud is funded.

## Status
Build passes. CSS/scope only — no logic changed.
