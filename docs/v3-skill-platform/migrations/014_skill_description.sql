-- 014 — Long-form product description (the builder "Basics" step + sales page).
-- `outcome` is the one-line header/tagline; `description` is the full pitch.
-- Idempotent.
alter table public.skills add column if not exists description text;
