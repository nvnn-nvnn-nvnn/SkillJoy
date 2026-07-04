-- 012 — Post-purchase "Options": promo video, custom confirmation message,
-- and customer reviews. Idempotent; safe to re-run in the Supabase SQL editor.

-- ── skills: new option columns ──────────────────────────────────────────────
alter table public.skills add column if not exists promo_video_url     text;
alter table public.skills add column if not exists confirmation_message text;
alter table public.skills add column if not exists reviews_enabled      boolean not null default true;

-- ── reviews: one per buyer per skill ────────────────────────────────────────
create table if not exists public.reviews (
  id         uuid primary key default gen_random_uuid(),
  skill_id   uuid not null references public.skills(id)   on delete cascade,
  buyer_id   uuid not null references public.profiles(id) on delete cascade,
  rating     smallint not null check (rating between 1 and 5),
  body       text,
  created_at timestamptz not null default now(),
  unique (skill_id, buyer_id)
);

create index if not exists reviews_skill_idx on public.reviews (skill_id, created_at desc);

alter table public.reviews enable row level security;

-- Public read (reviews are shown on the public sales page).
drop policy if exists reviews_public_read on public.reviews;
create policy reviews_public_read on public.reviews
  for select using (true);

-- A buyer may write/update/delete their OWN review, and only if they actually
-- paid for the skill.
drop policy if exists reviews_buyer_insert on public.reviews;
create policy reviews_buyer_insert on public.reviews
  for insert with check (
    buyer_id = auth.uid()
    and exists (
      select 1 from public.purchases p
      where p.buyer_id = auth.uid() and p.skill_id = reviews.skill_id and p.status = 'paid'
    )
  );

drop policy if exists reviews_buyer_update on public.reviews;
create policy reviews_buyer_update on public.reviews
  for update using (buyer_id = auth.uid()) with check (buyer_id = auth.uid());

drop policy if exists reviews_buyer_delete on public.reviews;
create policy reviews_buyer_delete on public.reviews
  for delete using (buyer_id = auth.uid());
