-- ─────────────────────────────────────────────────────────────────────────────
-- 022 — HOTFIX: defer the paywall gate until Stripe billing is live. Idempotent.
-- Run once in the Supabase SQL editor. Self-contained — safe to run even if only
-- the ORIGINAL (broken) 021 was applied.
--
-- Why: 021 coupled public storefront visibility to a live platform subscription
-- AND moved publishing server-side. But Stripe platform billing isn't
-- configured yet (STRIPE_PLATFORM_PRICE_ID unset — 2FA blocked), so NO creator
-- can hold a live sub → 021 took every storefront dark and blocked publishing.
-- You can't enforce a paywall you can't collect on yet.
--
-- This reverts only the ENFORCEMENT (visibility gate + publish trigger). It
-- KEEPS all 021 scaffolding (platform_subscriptions table, billing routes,
-- webhook handlers) dormant and ready. Re-arm with migration 023 (see bottom)
-- the moment Stripe is live.
-- ─────────────────────────────────────────────────────────────────────────────

-- The SECURITY DEFINER helper the policy below needs. CREATE OR REPLACE makes
-- this self-sufficient whether or not 021's fixed version ever ran. Bypasses
-- the referenced table's RLS (so no skills⇄purchases recursion); auth.uid()
-- still resolves to the caller, and it only ever reads the caller's own rows.
CREATE OR REPLACE FUNCTION public.has_paid_purchase(p_skill_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.purchases p
        WHERE p.skill_id = p_skill_id
          AND p.buyer_id = auth.uid()
          AND p.status = 'paid'
    );
$$;
GRANT EXECUTE ON FUNCTION public.has_paid_purchase(UUID) TO anon, authenticated;

-- 1. Restore public storefront visibility — drop the platform-sub requirement.
--    Back to the pre-021 rule (owner OR published), PLUS the paid-buyer branch
--    (harmless, and keeps a buyer's Locker working after an unpublish).
DROP POLICY IF EXISTS "Published skills are public" ON skills;
CREATE POLICY "Published skills are public"
    ON skills FOR SELECT USING (
        auth.uid() = creator_id
        OR public.has_paid_purchase(id)
        OR status = 'published'
    );

-- 2. Let publishing work client-side again (until the server publish endpoint +
--    Stripe gate are live AND the backend is deployed).
DROP TRIGGER IF EXISTS skills_enforce_server_publish ON skills;

-- ─────────────────────────────────────────────────────────────────────────────
-- TO RE-ARM THE PAYWALL once Stripe is live (do NOT run this now — it's the
-- future migration 023, kept here as a reference):
--
--   1. Set STRIPE_PLATFORM_PRICE_ID in backend/.env + restart the backend.
--   2. Backfill existing published creators so they don't go instantly dark:
--        INSERT INTO platform_subscriptions (user_id, status, trial_ends_at)
--        SELECT DISTINCT creator_id, 'trialing', now() + interval '14 days'
--        FROM skills WHERE status = 'published'
--        ON CONFLICT (user_id) DO NOTHING;
--   3. Re-apply the gated policy + publish trigger from 021 (its fixed version,
--      using creator_is_live()).
--   4. Deploy the backend (publish endpoint) + frontend BEFORE re-adding the
--      trigger, or client publishing breaks.
-- ─────────────────────────────────────────────────────────────────────────────
