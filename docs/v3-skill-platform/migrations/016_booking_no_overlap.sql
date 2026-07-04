-- 016 — Prevent OVERLAPPING bookings per creator (not just identical starts).
-- The existing bookings_slot_unique index only blocks the same (creator,start);
-- two bookings of different start/duration could still overlap. An exclusion
-- constraint on the time RANGE closes that at the DB level. Idempotent.
--
-- NOTE: if you already have overlapping *booked* rows (unlikely on test data),
-- this ADD CONSTRAINT will fail — cancel/clean those rows first, then re-run.

create extension if not exists btree_gist;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bookings_no_overlap') then
    alter table public.bookings
      add constraint bookings_no_overlap
      exclude using gist (
        creator_id with =,
        tstzrange(start_time, end_time) with &&
      ) where (status = 'booked');
  end if;
end $$;
