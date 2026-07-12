# 127 — Link placement UX + editor nav simplification + product groups + remove-button tidy

_2026-07-11. The rest of the Opus-owned storefront batch (glow/show-avatar were 126)._

## Link placement UX (owner: "can't tell links vs products; dropdown too complex; editor buried")

**Storefront render (`Storefront.jsx`):** links moved OUT of the shared product list and INTO the
profile panel — they now render inside `.sf-panel` right under the socials (`.sf-links`). Products
are a separate section below. So the page reads: [profile card: avatar/name/bio/socials/**links**]
then [products]. Links are clearly "part of who you are," products are clearly a separate shelf.
Preview (`LivePreview`) mirrors it (`.lp-links` inside `.lp-inner`).

**Editor nav (`StorefrontEditor.jsx`):** replaced the `My Page ▾` **dropdown** (Site Customization
/ Links / Templates-WIP) with two plain, prominent top **tabs: Customize | Links**. Links is now a
first-class destination, never buried. Removed the dead "Analytics"/"Settings" coming-soon pings
(both are real pages now — Analytics has its own header nav, Settings its own page). Cleaned up the
now-unused `dropOpen` state, the `ping`/`toast` infra, and the `LayoutTemplate` import.

Owner confirmed current link ORDERING is fine — left untouched.

## Product groups (owner: order products by group + assign titles)

Group products under headings ("Start here", "Bookings", "Digital products", …).
- **`migrations/026_product_groups.sql`** — `skills.group_label TEXT`. ⚠️ RUN in prod before it
  works (null column until then).
- **`src/lib/skills.js`** — `group_label` added to `SKILL_COLS` (feeds every query at once —
  builder + storefront).
- **`SkillBuilder.jsx`** — a "Group (optional)" text input (with a datalist of common suggestions)
  → `patchSkill({ group_label })`.
- **`Storefront.jsx`** — products bucketed by `group_label` (first-seen order = sort_order;
  `''` = one anonymous group, no heading, rendered at its natural position). Each labeled group
  renders a `.sf-grouptitle` heading + its own product list.
- Ordering WITHIN a group stays the drag/up-down `sort_order`; group ORDER is first-seen. (Explicit
  group reordering would need a groups table — deferred, see note 106.)

## Remove-button placement

`.std-removebtn` (avatar/bg/video/banner/cursor/audio) were left-aligned below each upload,
competing with the upload control. Now `width:fit-content; margin-left:auto` → **right-aligned**,
smaller + muted, tucked to the end of the row/field. One CSS change works in both the flex avatar
row and the block upload fields.

## Migrations now pending in prod (running tally)
024 (username cooldown) · 025 (TOS) · **026 (product groups)** — all must be RUN in Supabase.

`vite build` ✅ after each step.
