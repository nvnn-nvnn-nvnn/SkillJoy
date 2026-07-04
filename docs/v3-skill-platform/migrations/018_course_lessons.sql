-- 018 — Courses become Modules → Lessons → content. Idempotent.
--
-- Terminology: `course_sections` now represents a MODULE (top level; UI label
-- only, table name unchanged to avoid a rename migration). A LESSON is a new
-- first-class entity (title + description) that lives in a module and CONTAINS
-- content_blocks (via content_blocks.lesson_id). Progress moves from per-block
-- to per-lesson.
--
-- NOTE: this supersedes migration 017's block-level lesson model. It DROPS the
-- brand-new lesson_progress table and recreates it keyed on lesson_id (no real
-- data existed yet — courses shipped the same session).

-- ── Lessons (inside a module) ──────────────────────────────────────────────
create table if not exists public.course_lessons (
  id          uuid primary key default gen_random_uuid(),
  skill_id    uuid not null references public.skills(id) on delete cascade,
  section_id  uuid not null references public.course_sections(id) on delete cascade, -- the module
  title       text,
  description text,
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists course_lessons_section_idx on public.course_lessons(section_id, position);
create index if not exists course_lessons_skill_idx   on public.course_lessons(skill_id);
alter table public.course_lessons enable row level security;

drop policy if exists course_lessons_creator on public.course_lessons;
create policy course_lessons_creator on public.course_lessons for all
  using      (exists (select 1 from public.skills s where s.id = skill_id and s.creator_id = auth.uid()))
  with check (exists (select 1 from public.skills s where s.id = skill_id and s.creator_id = auth.uid()));

drop policy if exists course_lessons_buyer on public.course_lessons;
create policy course_lessons_buyer on public.course_lessons for select
  using (exists (select 1 from public.purchases p
                 where p.skill_id = course_lessons.skill_id and p.buyer_id = auth.uid() and p.status = 'paid'));

-- ── Content blocks now belong to a LESSON (for courses) ────────────────────
alter table public.content_blocks add column if not exists lesson_id uuid references public.course_lessons(id) on delete cascade;
create index if not exists content_blocks_lesson_idx on public.content_blocks(lesson_id, position);

-- ── Per-lesson progress (replaces the per-block table from 017) ─────────────
drop table if exists public.lesson_progress cascade;
create table public.lesson_progress (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  lesson_id  uuid not null references public.course_lessons(id) on delete cascade,
  skill_id   uuid not null references public.skills(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
create index if not exists lesson_progress_user_skill_idx on public.lesson_progress(user_id, skill_id);
alter table public.lesson_progress enable row level security;
drop policy if exists lesson_progress_own on public.lesson_progress;
create policy lesson_progress_own on public.lesson_progress for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
