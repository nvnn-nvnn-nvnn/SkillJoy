# 77 — Courses: Sections → Lessons + progress (expert guide)

_Session 2026-07-04. Built the `course` product type end-to-end (creator builder
+ buyer player + progress). First fully-new product type since digital/coaching._

---

## The model — a lesson is just a block
The key decision: **don't invent a parallel content system.** A course is:
- **Sections** — a new `course_sections` table (title + position).
- **Lessons** — existing `content_blocks` with a new `section_id`. So a lesson
  can be any block type (video / guide / file / prompt / workflow) and reuses
  `BlockEditor` (creator) + `BlockRenderer` (buyer) for free.
- **Progress** — a `lesson_progress` row per (buyer, lesson).

Non-course products leave `section_id` NULL → flat, exactly as before. This is
"share the shell, branch the body" taken to the data layer.

## Migration 017 (RUN THIS)
`course_sections` (RLS: creators manage own; buyers with a paid purchase read),
`content_blocks.section_id`, `lesson_progress` (RLS: `user_id = auth.uid()` owns
their rows). Mirrored into `schema.sql`. **Nothing course-related works until 017
is run** in the Supabase SQL editor.

## Creator side — the builder
- `src/lib/course.js` — sections CRUD (`listSections/createSection/updateSection/
  deleteSection/reorderSections`) + progress helpers.
- `src/components/CourseStructure.jsx` — the middle-step editor for `kind ===
  'course'`. **Presentational**: `SkillEditor` owns sections + blocks + every
  handler (so state stays consistent — e.g. deleting a section also drops its
  lessons from `blocks` state to mirror the DB cascade). Renders section cards →
  lessons (BlockEditor) → per-section "add lesson" picker (coaching excluded as a
  lesson type). Up/down reorder at both levels; cross-section moves are a
  follow-up.
- `SkillBuilder` wiring: middle-step label `Curriculum` (`MIDDLE_LABEL.course`);
  step 1 branches to `CourseStructure` for courses; publish guard + checklist +
  `ready` require **≥1 section containing ≥1 lesson** (`courseHasLesson`) instead
  of the flat `blocks.length` check. Section titles save debounced (like blocks).

## Buyer side — the player
- `src/components/CoursePlayer.jsx` — loads sections + the buyer's progress set,
  renders a **% progress bar** + sections → lessons (each via `BlockRenderer`)
  with a **Mark complete** toggle. Optimistic toggle with revert-on-error.
- `Locker` renders `CoursePlayer` when `skill.kind === 'course'`, else the flat
  block list as before.

## Data plumbing
`getSkillWithBlocks` now selects `section_id`; `addBlock` already accepts
arbitrary columns so `addLesson` just passes `section_id`. `course` flipped to
`built: true` in `productTypes.js` → it's now a real, sellable type in the
`/build/new` picker.

## Verify
`eslint` clean; `npm run build` OK. Manual (after running 017): New product →
Online course → Curriculum step → add a section, rename it, add a couple lessons
→ Pricing/Publish (checklist wants a lesson) → buy from a 2nd account → Locker
shows the course grouped by section with a progress bar; Mark complete moves the
bar.

## Follow-ups
- **Sales page** still shows the flat lesson outline; showing sections
  ("Module 1: …") on `SkillPublic` is a nice next touch.
- **Cross-section lesson moves** (drag a lesson to another section) not built —
  reorder is within-section only.
- Remaining unbuilt types: `membership`, `webinar`, `lead`, `bundle`. See
  [[per-type-product-builders]].
