-- ─────────────────────────────────────────────────────────────────────────────
-- 031 — Onboarding survey + plan intent. Idempotent.
--
-- The rebuilt onboarding (screens 2–4) asks three things. All optional: every
-- survey screen has a Skip, so every column here is nullable and NULL means
-- "skipped", which is itself a useful signal — a high skip rate on a question
-- is evidence the question isn't worth asking.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Screen 2 · Where did you hear about us ───────────────────────────────────
-- Stored as a stable key ('google', 'friend', …) so the analytics grouping
-- survives label rewording. Free text from "Other" lands in its own column
-- rather than being crammed into the same field — mixing a controlled
-- vocabulary with user prose makes every later GROUP BY wrong.
alter table public.profiles
    add column if not exists discovery_source       text,
    add column if not exists discovery_source_other text;

-- ── Screen 3 · How do you plan to use SkillJoy ───────────────────────────────
-- MULTI-select, hence an array. "Brand promotion" and "personal store" are the
-- same person more often than not; forcing one answer would produce data that
-- looks clean and is quietly false.
alter table public.profiles
    add column if not exists use_cases      text[],
    add column if not exists use_case_other text;

-- ── Screen 4 · Which plan they said they wanted ──────────────────────────────
-- INTENT, not entitlement. Nothing is granted here: the real gate is still the
-- platform subscription checked in backend/routes/skills.js at publish time.
-- Recorded because "chose paid then never subscribed" is the single most
-- actionable funnel drop-off available.
alter table public.profiles
    add column if not exists plan_intent text
        check (plan_intent is null or plan_intent in ('free', 'paid'));

-- Lets us tell "still mid-flow" apart from "finished and chose to skip
-- everything" — both leave the survey columns NULL.
alter table public.profiles
    add column if not exists onboarding_completed_at timestamptz;

comment on column public.profiles.discovery_source is
    'Onboarding screen 2. Stable key; see DISCOVERY_OPTIONS in src/app-pages/auth/Onboarding.jsx. NULL = skipped.';
comment on column public.profiles.use_cases is
    'Onboarding screen 3, multi-select. Stable keys; see USE_CASE_OPTIONS. NULL/empty = skipped.';
comment on column public.profiles.plan_intent is
    'Onboarding screen 4. Stated preference only — grants nothing. Real access is the platform subscription.';
