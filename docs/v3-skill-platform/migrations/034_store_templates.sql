-- ─────────────────────────────────────────────────────────────────────────────
-- 034 — Templates saved from a real page. Idempotent. (Plan 05, phase 0.5.)
--
-- The 38 presets in src/lib/presets.js are authored by hand in code. This lets
-- an admin build a page in the normal editor — background video, music,
-- effects, the lot — and save that page's LOOK as a template everyone can pick.
--
-- Why a table and not more entries in presets.js: a preset with a video cannot
-- be written by hand, because the asset has to be uploaded first. The moment an
-- asset is involved, the template has to be created by a running system.
--
-- ── Ownership, the part that matters ─────────────────────────────────────────
-- The admin's uploads live in their own storage folder. If a template pointed
-- at those URLs, every visitor to every page using it would stream from the
-- admin's folder. For an ADMIN-authored template that is survivable (the admin
-- is the platform), but it still breaks the day they tidy up their storage.
--
-- So the backend COPIES the assets into a platform-owned prefix
-- (skill-covers/_templates/<id>/) at save time and stores the rewritten URLs.
-- The template is then independent of the admin's own page forever.
--
-- Phase 1 of plan 05 (creator-authored, shareable) adds a SECOND copy at apply
-- time so an applier's traffic never hits the platform prefix either. This
-- table is shaped to accept that without a migration.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.store_templates (
    id            uuid primary key default gen_random_uuid(),
    author_id     uuid not null references public.profiles(id) on delete cascade,

    name          text not null,
    blurb         text,
    -- Matches PRESET_CATEGORIES ids in src/lib/presets.js so DB templates and
    -- built-in presets render in the same grouped picker.
    category      text not null default 'showcase',
    emoji         text not null default '🎨',

    -- The look. Asset URLs already rewritten to the platform-owned copies.
    theme         jsonb not null,

    -- [{ key, path, bytes, mime }] — what was copied, so a delete can clean up
    -- storage instead of orphaning it. Without this the only way to find a
    -- template's files is to parse its theme, which breaks the moment the theme
    -- shape changes.
    assets        jsonb not null default '[]'::jsonb,

    -- Phase 0.5 only ever writes 'public'. The other states exist now so plan
    -- 05's gallery is a status change rather than a migration + backfill.
    -- 'draft' | 'unlisted' | 'pending' | 'public' | 'rejected'
    status        text not null default 'public',

    position      integer not null default 0,   -- ordering within a category
    install_count integer not null default 0,
    created_at    timestamptz not null default now()
);

do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'store_templates_status_chk') then
        alter table public.store_templates
            add constraint store_templates_status_chk
            check (status in ('draft', 'unlisted', 'pending', 'public', 'rejected'));
    end if;
end $$;

create index if not exists store_templates_browse_idx
    on public.store_templates(status, category, position);

alter table public.store_templates enable row level security;

-- Public read of published templates only. Authors additionally see their own
-- drafts. Anonymous visitors need this too: the onboarding template picker runs
-- before a session exists in some flows.
drop policy if exists "Published templates are public" on public.store_templates;
create policy "Published templates are public"
    on public.store_templates for select
    using (status in ('unlisted', 'public') or auth.uid() = author_id);

-- WRITES ARE BACKEND-ONLY, deliberately. There is no insert/update/delete
-- policy, so the anon and authenticated roles cannot write here at all — only
-- the service-role client in backend/routes/templates.js can, and that route
-- checks ADMIN_EMAIL. Saving a template copies files between storage prefixes;
-- that is not something a browser session should be able to trigger directly.

-- ── Rollback ─────────────────────────────────────────────────────────────────
--   drop table if exists public.store_templates;
--   -- and remove the storage prefix: skill-covers/_templates/
