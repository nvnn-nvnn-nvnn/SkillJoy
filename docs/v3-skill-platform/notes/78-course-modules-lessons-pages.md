# 78 — Courses restructured: Modules → Lessons (own page) → content

_Session 2026-07-04. Deepened the course model from Sections→Lessons(=blocks)
into **Modules → Lessons → content**, where a lesson is a first-class entity with
its own editor page. Supersedes note 77's model._

---

## Why
A lesson often holds more than one piece of content and needs a title +
description — more than fit inline in the module list. So a lesson became its own
thing with its own page, instead of "a lesson = one content block."

## New hierarchy
- **Module** = `course_sections` row (table name kept; **UI label is "Module"**).
- **Lesson** = NEW `course_lessons` row (title + description) inside a module.
- **Content** = `content_blocks` with a `lesson_id` (a lesson holds many).
- **Progress** = per-lesson (`lesson_progress` now keyed on `lesson_id`).

## Migration 018 (RUN THIS)
Creates `course_lessons` (RLS: creator manages own, buyer reads paid),
`content_blocks.lesson_id`, and **drops + recreates `lesson_progress`** keyed on
`lesson_id` (was per-block in 017; no real data existed). Mirrored into
`schema.sql`. **Run 018** or nothing course-related works.

## Data layer — `src/lib/course.js` (rewritten)
- Modules: `listModules/createModule/updateModule/deleteModule/reorderModules`
  (operate on `course_sections`).
- Lessons: `listLessons/getLesson/createLesson/updateLesson/deleteLesson/reorderLessons`.
- Progress: `listMyProgress` (→ Set of lesson ids), `markLesson/unmarkLesson`.
- `src/lib/skills.js`: `listLessonBlocks(lessonId)` + `lesson_id` added to the
  block select.

## Creator side
- **`CourseStructure`** (rewritten) — the course middle step. Self-manages
  modules + lesson *rows* (no block editing here). Add/rename/reorder modules;
  add/reorder/delete lesson rows; **click a lesson row → navigates to its page**.
  Adding a lesson jumps straight into it. Reports "has ≥1 lesson" up via
  `onReadyChange` so the parent's publish gate/checklist stay right — this let
  `SkillEditor` drop all its old course section/block state + handlers (much
  smaller now).
- **`LessonEditor`** (NEW page, route `/build/:skillId/lesson/:lessonId`) —
  lesson title + description + its content blocks (reuses `BlockEditor` + an add
  picker; coaching excluded). Same debounced save + flush-on-unmount as the main
  builder.

## Buyer side
- **`CoursePlayer`** (rewritten) — Modules → Lessons (title + description) → each
  lesson's blocks via `BlockRenderer`, with a **per-lesson** "Mark complete" +
  the % bar. Optimistic toggle with revert-on-error.

## Verify
`eslint` clean (only the pre-existing main.jsx react-refresh errors);
`npm run build` OK. Manual (after running 018): New course → Curriculum → add a
Module → add a Lesson (opens its page) → set title/description + add content →
back → Publish (needs a lesson) → buy from a 2nd account → Locker shows
modules → lessons → content with a progress bar.

## Follow-ups
- Sales-page curriculum (modules/lessons on `SkillPublic`) still flat/absent.
- Cross-module lesson moves not built (reorder within a module only).
- `content_blocks.section_id` is now vestigial for courses (content uses
  `lesson_id`); left in place, harmless.
