-- ─────────────────────────────────────────────────────────────────────────────
-- 032 — Link-in-Bio BLOCKS. Idempotent. (Plan 04, Phase 1.)
--
-- The missing primitive: an object that owns *a set of links plus how that set
-- is laid out*. Until now store_links was a flat list with a `placement` column
-- choosing between two hardcoded page regions, so layout/title/visibility had
-- nowhere to live.
--
-- ⚠️ This migration BACKFILLS existing creators. Read section 3 before running.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1 · The block ────────────────────────────────────────────────────────────
create table if not exists public.store_blocks (
    id           uuid primary key default gen_random_uuid(),
    creator_id   uuid not null references public.profiles(id) on delete cascade,
    kind         text not null default 'links' check (kind in ('links','products')),

    -- Settings tab
    title        text,                 -- optional heading above the block
    subtitle     text,                 -- optional line under the heading
    visible      boolean not null default true,

    -- Collapsed/expanded presentation (beacons-style accordion).
    -- collapsible=false → always open, and the two columns below are ignored.
    collapsible        boolean not null default false,
    default_collapsed  boolean not null default false,
    collapsed_thumb_url text,          -- shown on the closed row

    position     integer not null default 0,

    -- Layout tab. JSONB, not columns, deliberately: these are presentation
    -- knobs that will churn (the 4th style was undecided as of plan 04), and a
    -- column per knob means a migration per knob. Shape lives in code as
    -- DEFAULT_BLOCK_LAYOUT + resolveBlockLayout(), the same pattern
    -- resolveTheme() already uses for the page theme.
    --   { style, size, align, outline, shadow, columns }
    layout       jsonb not null default '{}'::jsonb,

    created_at   timestamptz not null default now()
);
create index if not exists store_blocks_creator_idx
    on public.store_blocks(creator_id, position);

alter table public.store_blocks enable row level security;

-- Public read: blocks are storefront content, same as store_links.
drop policy if exists "Store blocks are public" on public.store_blocks;
create policy "Store blocks are public"
    on public.store_blocks for select using (true);

drop policy if exists "Creators manage their blocks" on public.store_blocks;
create policy "Creators manage their blocks"
    on public.store_blocks for all
    using (auth.uid() = creator_id) with check (auth.uid() = creator_id);

-- ── 2 · Links belong to a block ──────────────────────────────────────────────
-- ON DELETE CASCADE: deleting a block deletes its links. That matches the
-- editor's mental model (the block IS the container) and the confirm copy says
-- so explicitly.
alter table public.store_links
    add column if not exists block_id uuid references public.store_blocks(id) on delete cascade;
create index if not exists store_links_block_idx on public.store_links(block_id, position);

-- Per-link flags the Links tab exposes.
alter table public.store_links
    add column if not exists featured boolean not null default false,
    add column if not exists visible  boolean not null default true;

-- ── 3 · BACKFILL ─────────────────────────────────────────────────────────────
-- One 'links' block per creator who has links, and every one of their links
-- moves into it.
--
-- Why ONE block and not two (plan 04, open question 1): the old `placement`
-- axis had exactly two values, and 'products' meant "render this link among the
-- products". That is now the per-link `featured` flag, which is strictly more
-- expressive — a creator can mix featured and normal links inside one block
-- instead of maintaining two lists. Two blocks would encode a limitation as
-- structure.
--
-- Idempotent: the WHERE NOT EXISTS means re-running does nothing.
insert into public.store_blocks (creator_id, kind, title, position)
select distinct l.creator_id, 'links', null, 0
from public.store_links l
where not exists (
    select 1 from public.store_blocks b
    where b.creator_id = l.creator_id and b.kind = 'links'
);

-- Carry placement → featured, then attach to the block.
update public.store_links l
set featured = (l.placement = 'products'),
    block_id = b.id
from public.store_blocks b
where b.creator_id = l.creator_id
  and b.kind = 'links'
  and l.block_id is null;

-- `placement` is intentionally LEFT IN PLACE for now, unused. Dropping it in
-- the same migration that backfills from it removes the only way to verify the
-- backfill or roll it back. Drop it in a later migration, once blocks have run
-- in production long enough to trust.
comment on column public.store_links.placement is
    'DEPRECATED (032). Superseded by store_links.featured. Kept for rollback; drop once blocks are proven.';

-- ── Rollback ─────────────────────────────────────────────────────────────────
-- `placement` still holds the original values, so undoing this is:
--   alter table public.store_links drop column if exists block_id;
--   alter table public.store_links drop column if exists featured;
--   alter table public.store_links drop column if exists visible;
--   drop table if exists public.store_blocks;
