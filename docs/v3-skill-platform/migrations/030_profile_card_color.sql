-- ─────────────────────────────────────────────────────────────────────────────
-- 030 — Profile card colour. Idempotent.
--
-- Lets a creator tint the hero card on their account profile (/profile and
-- /profile/:id). Stored as a preset KEY ('sand', 'ocean', …), not a hex value.
--
-- Why a key and not a colour:
--   · the palette has to work in both light and dark mode, so the actual colour
--     is really two colours — resolving that belongs in CSS, not the database
--   · a free hex lets someone pick #FFFFFF text-on-white and make their own
--     card unreadable; a fixed set is contrast-checked once, up front
--   · renaming or retuning a preset later is a CSS change, not a data migration
-- NULL = the default neutral surface, which is what every existing row gets.
--
-- Not constrained by a CHECK on purpose: an unknown key falls back to the
-- default in the UI, so adding a preset needs no migration. The tradeoff is
-- that a typo stores silently — acceptable when the write path is a fixed set
-- of swatch buttons rather than free text.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.profiles
    add column if not exists profile_card_color text;

comment on column public.profiles.profile_card_color is
    'Preset key for the profile hero card tint (see PROFILE_CARD_COLORS in src/lib/profileCard.js). NULL = default.';
