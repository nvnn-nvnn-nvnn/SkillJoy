-- ─────────────────────────────────────────────────────────────────────────────
-- 033 — Placement moves from the LINK to the BLOCK. Idempotent.
--
-- Reverses a bet made in 032. That migration argued:
--
--   "Two blocks would encode a limitation as structure. A creator can mix
--    featured and normal links inside one block instead of maintaining
--    two lists."
--
-- In use that turned out backwards. A block owns a title, a layout and a colour
-- set, and featured links render in a DIFFERENT PAGE REGION. So a mixed block
-- prints its title twice — once in the profile card, once above the products —
-- with the same layout applied to two visually unrelated groups. The "freedom"
-- to mix was really the absence of a boundary the page already had.
--
-- Placement is therefore a property of the container, not of each item.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1 · The column ───────────────────────────────────────────────────────────
alter table public.store_blocks
    add column if not exists placement text not null default 'profile';

do $$
begin
    if not exists (
        select 1 from pg_constraint where conname = 'store_blocks_placement_chk'
    ) then
        alter table public.store_blocks
            add constraint store_blocks_placement_chk
            check (placement in ('profile', 'featured'));
    end if;
end $$;

create index if not exists store_blocks_placement_idx
    on public.store_blocks(creator_id, placement, position);

-- ── 2 · BACKFILL: split every mixed block ────────────────────────────────────
-- A block that contains at least one featured link gets a SIBLING featured
-- block carrying the same title/subtitle/layout, and its featured links move
-- there. Copying rather than moving keeps the profile block's own links exactly
-- where they were — nothing on the page relocates that the creator didn't ask
-- to relocate.
--
-- Idempotent via the marker in `kind`… no: `kind` is constrained. The guard is
-- NOT EXISTS on a featured sibling, so re-running is a no-op.

insert into public.store_blocks
    (creator_id, kind, title, subtitle, visible, collapsible, default_collapsed,
     collapsed_thumb_url, position, layout, placement)
select
    b.creator_id, b.kind, b.title, b.subtitle, b.visible, b.collapsible,
    b.default_collapsed, b.collapsed_thumb_url, b.position, b.layout, 'featured'
from public.store_blocks b
where b.placement = 'profile'
  and exists (
      select 1 from public.store_links l
      where l.block_id = b.id and l.featured = true
  )
  and not exists (
      select 1 from public.store_blocks f
      where f.creator_id = b.creator_id
        and f.placement  = 'featured'
        and f.position   = b.position
  );

-- Move the featured links into their creator's matching featured block.
update public.store_links l
set block_id = f.id
from public.store_blocks b
     join public.store_blocks f
       on f.creator_id = b.creator_id
      and f.placement  = 'featured'
      and f.position   = b.position
where l.block_id = b.id
  and l.featured = true
  and b.placement = 'profile';

-- Legacy featured links that never had a block at all (the synthetic-block path
-- in Storefront.jsx) get one, so nothing is left rendering off a fake id.
insert into public.store_blocks (creator_id, kind, title, position, placement)
select distinct l.creator_id, 'links', null, 0, 'featured'
from public.store_links l
where l.featured = true
  and l.block_id is null
  and not exists (
      select 1 from public.store_blocks b
      where b.creator_id = l.creator_id and b.placement = 'featured'
  );

update public.store_links l
set block_id = b.id
from public.store_blocks b
where b.creator_id = l.creator_id
  and b.placement = 'featured'
  and l.featured = true
  and l.block_id is null;

-- ── 3 · `featured` is now derived ────────────────────────────────────────────
-- Left in place, same reasoning as `placement` in 032: it is the only way to
-- verify or roll back this backfill. The app stops READING it as of this
-- migration; it still writes it in sync so the rollback stays valid.
comment on column public.store_links.featured is
    'DEPRECATED (033). Superseded by store_blocks.placement. Kept in sync for rollback; drop once block placement is proven.';

-- ── Rollback ─────────────────────────────────────────────────────────────────
--   -- move links back to their profile sibling, then:
--   update public.store_links l set block_id = p.id
--     from public.store_blocks f join public.store_blocks p
--       on p.creator_id = f.creator_id and p.placement = 'profile' and p.position = f.position
--     where l.block_id = f.id and f.placement = 'featured';
--   delete from public.store_blocks where placement = 'featured';
--   alter table public.store_blocks drop column if exists placement;
