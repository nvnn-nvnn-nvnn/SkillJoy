# 56 — Services dashboard (real data) + product `kind`

Made the `/services` dashboard real end-to-end and gave skills a product **type**.

## Migration

- **`011_service_kinds.sql`** — adds `skills.kind TEXT NOT NULL DEFAULT 'digital'`
  with `CHECK (kind IN ('digital','course','coaching','membership','webinar','lead','bundle'))`
  plus index `skills_kind_idx (creator_id, kind)`. Idempotent.
- Mirrored the column + index into `supabase/schema.sql`.
- **`kind` is independent of `pricing_type`**: `kind` = what the product *is*,
  `pricing_type` = how it *bills*. A coaching call can be one-time; a membership
  kind is usually (not necessarily) `pricing_type='membership'`.

**Apply step:** open the Supabase SQL editor and run the contents of
`docs/v3-skill-platform/migrations/011_service_kinds.sql` once (safe to re-run).

## Code

- `src/lib/skills.js` — added `kind` to `SKILL_COLS`; `createSkill` now defaults
  `kind: 'digital'` explicitly (DB also defaults it).
- `src/app-pages/SkillBuilder.jsx` — new minimal **Type** `<select>` (the 7 kinds)
  in the editor meta, wired through the existing debounced `patchSkill({ kind })`.
  New skills created from the builder still default to `digital`.
- `src/app-pages/ServicesDashboard.jsx` — replaced all mock data:
  - loads `listMySkills(user.id)` + `listCreatorSales(user.id)` in parallel
  - cards built from skills; **sales/revenue** aggregated per skill from paid
    purchases; status pill `published→Active`, `draft→Draft`
  - price uses `price_cents`, shows `/mo` for `pricing_type==='membership'`, `Free` at 0
  - **type tabs filter on real `skill.kind`**
  - actions wired: Edit→`/build/:id`, Preview→`/@handle/:id` (new tab),
    Share→copy public URL, ⋯ Publish/Unpublish→`publishSkill`/`updateSkill`,
    ⋯ Delete→confirm + `deleteSkill`
  - "New service" picker calls `createSkill({ kind })` + routes to the builder
    for **built** kinds (digital, coaching); others toast "isn't built yet"
- `src/components/Header.jsx` — added **Services** nav link (desktop + drawer).

## Still stubbed / follow-ups

- **views & conversion** render `—` — no analytics source wired yet (see
  `src/lib/analytics.js` / `AnalyticsCards`).
- **Preview/Share need a storefront handle** (`profile.username`); without one
  they toast a prompt to set it.
- **Duplicate** action dropped — no server-side clone of a skill + its blocks yet.
- Only **digital + coaching** are truly sellable. Next passes need real
  builder + checkout support for: **course** (modules/lessons + progress),
  **membership** (recurring billing depth), **webinar** (ticketed event + time),
  **lead** (free + email capture via `subscribers.js`), **bundle** (multi-skill
  package + combined price). Each flips its `built: true` in `PRODUCT_TYPES`.
