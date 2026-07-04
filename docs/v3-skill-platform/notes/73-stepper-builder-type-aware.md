# 73 — Builder: tabs → type-aware stepper (expert guide)

_Session 2026-07-03. Reworked the make-or-break screen from a tabbed editor into
a guided 5-step flow whose middle step swaps by product type. Adds a long
`description` field. Expert guide._

---

## Why
The tabbed editor showed the *same* tabs for every product, which read as
"clunky / not really separated per type." The user wanted a guided flow:
select type → walk type-appropriate steps → checkout/options → publish.

## The 5 steps (shared shell, type-aware middle)
`stepsFor(kind)` → `['Basics', MIDDLE, 'Pricing', 'Options', 'Publish']` where
`MIDDLE` = **Delivery** (digital) · **Scheduling** (coaching) · **Content**
(everything else). This is the "share the shell, branch the body" principle made
literal: only step index 1's heading/framing changes; the block editor + save
engine underneath are identical.

- **0 · Basics** — cover, title, one-line header (`outcome`), **description**
  (new), and the type tiles (re-classify anytime).
- **1 · Delivery/Scheduling/Content** — the block list + add-block picker, with a
  per-kind heading + `KIND_HINTS` nudge. Coaching's blocks surface the Google
  connect (note 72); digital's publish guard requires a file/link (note 69).
- **2 · Pricing** — price + one-time/membership.
- **3 · Options** — promo video, confirmation message, reviews, "Soon" cards (note 70).
- **4 · Publish** — readiness checklist + the Publish/Unpublish action.

## Mechanics (what changed vs the tabs version)
- State: `tab` (string id) → `step` (0-based index). Panels render by index.
- `stepsFor` / `MIDDLE_LABEL` replace the static `TABS` array.
- **Stepper header** (`.sb-steps`): numbered chips, clickable to jump, current
  filled-accent, completed shows ✓. **Footer** (`.sb-stepnav`): Back + Next; on
  the last step Next becomes **Publish/Unpublish** (the wizard's finish action).
- **Publish moved out of the top action bar** into the stepper's final step, so
  there's one obvious "go live" moment. Top bar keeps Back-to-products, saved
  status, Delete, and Push-update (published only). Removed now-unused `Globe` /
  `EyeOff` icon imports.
- **The debounced save engine is untouched** — every field still calls
  `patchSkill`. This was a presentation reshuffle, not a data change.

## New field: `description`
Migration **014** adds `skills.description text` (mirrored into
`supabase/schema.sql`; added to `SKILL_COLS`). `outcome` remains the one-line
*header*; `description` is the long pitch. Shown on the Basics step and rendered
on the public sales page (`SkillPublic`, `white-space:pre-wrap`, under the
tagline). **Run migration 014 before testing** or the description won't persist.

## Verify
`eslint` clean; `npm run build` OK. Manual: `/build/new` → pick a type → land on
Basics → the 2nd step is labelled Delivery (digital) or Scheduling (coaching) →
Next through Pricing/Options → Publish on the last step. Set a description and
confirm it appears on the sales page.

## Basics: Type is now read-only (2026-07-03 follow-up)
The editable Type **tile grid** in Basics was replaced with a **read-only
display** of the chosen type (icon + label) — the type is picked on `/build/new`,
so re-classifying mid-build was redundant. The selector JSX is **commented out,
not deleted** (`{/* Type SELECTOR — ... */}`) so it can be re-enabled if we ever
want in-builder re-classification. New style: `.sb-typedisplay`. `PRODUCT_TYPES`
is still used (the read-only display does a `.find`).

## Publish/unpublish now uses modals (2026-07-03 follow-up)
`togglePublish` now, via the dialog system ([[dialog-system-and-action-bar]]):
1. **Confirms** the action first — "Publish this product? It'll go live…" or a
   **danger** "Unpublish this product? …existing buyers keep access."
2. On success, shows a **reflective result modal** — "You're live! 🎉" or a
   warning-toned "Unpublished." (The pre-publish readiness warnings for
   title/content/digital-delivery still fire before the confirm.)

## Published-product actions swapped (2026-07-04)
For a live product: **Unpublish** moved to the top action bar (next to Delete —
both take it down); **Push update** is now the Publish-step footer's primary CTA.
Drafts still show **Publish** in the footer. `togglePublish` still handles
publish+unpublish; `pushUpdate` is the footer action when published.

## Follow-ups
- Middle step still uses the shared block editor for all types. Deeper per-type
  forms (e.g. coaching without the generic block picker; digital = a single
  first-class upload slot) are the next depth pass — see [[per-type-product-builders]].
- Step validity is visual only (clickable jumps, no hard gating). Could later
  block Next until a step's minimum is met, if desired.
