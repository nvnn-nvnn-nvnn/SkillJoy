-- 017 — Courses: Sections → Lessons + per-buyer progress. Idempotent.
-- A "lesson" is just a content_block that belongs to a section (section_id).
-- Non-course products leave section_id NULL and behave exactly as before.

-- ── Sections ────────────────────────────────────────────────────────────────
create table if not exists public.course_sections (
  id         uuid primary key default gen_random_uuid(),
  skill_id   uuid not null references public.skills(id) on delete cascade,
  title      text,
  position   integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists course_sections_skill_idx on public.course_sections(skill_id, position);
alter table public.course_sections enable row level security;

-- Creators manage sections on their own skills.
drop policy if exists course_sections_creator on public.course_sections;
create policy course_sections_creator on public.course_sections for all
  using      (exists (select 1 from public.skills s where s.id = skill_id and s.creator_id = auth.uid()))
  with check (exists (select 1 from public.skills s where s.id = skill_id and s.creator_id = auth.uid()));

-- Buyers with a paid purchase read the section list (curriculum).
drop policy if exists course_sections_buyer on public.course_sections;
create policy course_sections_buyer on public.course_sections for select
  using (exists (select 1 from public.purchases p
                 where p.skill_id = course_sections.skill_id and p.buyer_id = auth.uid() and p.status = 'paid'));

-- ── Lessons = content_blocks with a section ────────────────────────────────
alter table public.content_blocks add column if not exists section_id uuid references public.course_sections(id) on delete cascade;
create index if not exists content_blocks_section_idx on public.content_blocks(section_id, position);

-- ── Per-buyer lesson progress ──────────────────────────────────────────────
create table if not exists public.lesson_progress (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  block_id   uuid not null references public.content_blocks(id) on delete cascade,
  skill_id   uuid not null references public.skills(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, block_id)
);
create index if not exists lesson_progress_user_skill_idx on public.lesson_progress(user_id, skill_id);
alter table public.lesson_progress enable row level security;

-- A buyer sees + manages only their own progress.
drop policy if exists lesson_progress_own on public.lesson_progress;
create policy lesson_progress_own on public.lesson_progress for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
