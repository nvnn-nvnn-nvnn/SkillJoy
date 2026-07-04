-- 013 — Google Calendar connection (coaching freebusy). Idempotent.
-- Stores the creator's OAuth refresh token so the server can read their
-- calendar's busy intervals. READ-ONLY Google scope; no events are written.
--
-- SECURITY: the refresh token is a secret and MUST NOT be reachable by clients.
-- `profiles` is publicly readable (storefronts/Discover), and Supabase RLS is
-- row-level — a readable row exposes ALL its columns. So tokens live in their
-- OWN table with RLS enabled and **no policies**: anon/authenticated get zero
-- access; only the backend service key (which bypasses RLS) reads/writes it.

create table if not exists public.google_tokens (
  user_id       uuid primary key references public.profiles(id) on delete cascade,
  refresh_token text,
  connected     boolean not null default false,
  updated_at    timestamptz not null default now()
);

alter table public.google_tokens enable row level security;
-- Intentionally NO policies → clients cannot select/insert/update/delete.
