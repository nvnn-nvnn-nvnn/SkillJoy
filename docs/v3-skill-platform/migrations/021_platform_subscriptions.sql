-- ─────────────────────────────────────────────────────────────────────────────
-- SkillJoy v3 — Platform subscription (paywall) — Phase 1 of note 108
-- Run once in the Supabase SQL editor. Idempotent (safe to re-run).
--
-- The PLATFORM subscription is a creator paying SkillJoy (direct charge on
-- SkillJoy's own Stripe account — NO Connect, NO transfer_data, NO
-- application_fee). It is completely separate from creator MEMBERSHIPS
-- (kind:'skill_sub'), which are fans paying creators via Connect.
--
-- Gate: signup/build/customize stay free; publishing requires a live sub
-- (status trialing|active). Card captured + 14-day trial starts at publish.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── platform_subscriptions ───────────────────────────────────────────────────
-- One row per creator. Written ONLY by the service role (billing route +
-- Stripe webhook); the owner may read their own row for trial banners.
CREATE TABLE IF NOT EXISTS platform_subscriptions (
    user_id                UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    stripe_customer_id     TEXT,
    stripe_subscription_id TEXT,
    status                 TEXT NOT NULL DEFAULT 'none',  -- none|trialing|active|past_due|canceled|unpaid|incomplete
    trial_ends_at          TIMESTAMPTZ,
    current_period_end     TIMESTAMPTZ,
    last_dunned_invoice_id TEXT,                          -- dedupes the dunning email (see webhooks.js invoice.payment_failed)
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Re-run safety: this column was added after the table first shipped, so an
-- existing prod table needs the ALTER (CREATE TABLE above is skipped when the
-- table already exists).
ALTER TABLE platform_subscriptions
    ADD COLUMN IF NOT EXISTS last_dunned_invoice_id TEXT;

-- Webhook lookups arrive keyed by the Stripe subscription id.
CREATE INDEX IF NOT EXISTS platform_subs_stripe_sub_idx
    ON platform_subscriptions (stripe_subscription_id)
    WHERE stripe_subscription_id IS NOT NULL;

ALTER TABLE platform_subscriptions ENABLE ROW LEVEL SECURITY;

-- Owner READ only. No INSERT/UPDATE/DELETE policies on purpose — writes are
-- service-role only (mirrors the purchases-fulfilment pattern in 001).
DROP POLICY IF EXISTS platform_sub_owner_read ON platform_subscriptions;
CREATE POLICY platform_sub_owner_read
    ON platform_subscriptions FOR SELECT USING (user_id = auth.uid());


-- ── Storefront gate: published skills are public only while the sub is live ──
-- Replaces the 001 policy. Three branches:
--   1. the creator always sees their own skills (any status),
--   2. a PAID buyer always sees a skill they bought — WITHOUT this branch a
--      creator's lapse would break their existing buyers' Locker (the Locker
--      reads `skills` through the anon-key client too, embedding skill:skills),
--      violating the "existing buyers keep access" guarantee,
--   3. the public sees a published skill only while its creator's platform
--      sub is trialing/active → a lapsed storefront goes dark automatically,
--      no cron needed.
--
-- ⚠️ Both cross-table checks MUST go through SECURITY DEFINER helpers, not
-- inline sub-SELECTs, for two reasons a plain EXISTS gets WRONG:
--   • platform_subscriptions RLS is owner-read-only (user_id = auth.uid()), so
--     an inline EXISTS on it is FALSE for every public viewer → the storefront
--     would be invisible to everyone but the creator (branch 3 dead).
--   • purchases RLS references skills, and this policy references purchases →
--     a mutual cycle → Postgres "infinite recursion detected in policy".
-- A SECURITY DEFINER function bypasses the referenced table's RLS (breaking the
-- cycle + the visibility trap) while auth.uid() still resolves to the caller.
CREATE OR REPLACE FUNCTION public.creator_is_live(p_creator_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.platform_subscriptions ps
        WHERE ps.user_id = p_creator_id
          AND ps.status IN ('trialing', 'active')
    );
$$;

-- Only ever checks the CALLER's own purchases (auth.uid()), so it leaks nothing.
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

GRANT EXECUTE ON FUNCTION public.creator_is_live(UUID)   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_paid_purchase(UUID) TO anon, authenticated;

DROP POLICY IF EXISTS "Published skills are public" ON skills;
CREATE POLICY "Published skills are public"
    ON skills FOR SELECT USING (
        auth.uid() = creator_id
        OR public.has_paid_purchase(id)
        OR (status = 'published' AND public.creator_is_live(creator_id))
    );


-- ── Publish is server-only ───────────────────────────────────────────────────
-- The 001 "Creators manage their own skills" ALL policy lets a creator flip
-- status='published' straight through the anon-key client, bypassing the gate.
-- A plain WITH CHECK (status <> 'published') would also reject legitimate
-- client edits to already-published rows (title/price/sort_order updates keep
-- status='published' in the NEW row), so instead a trigger blocks only the
-- TRANSITION into 'published' for client roles. The service role (backend
-- publish endpoint) and the SQL editor pass through untouched. Unpublishing
-- (published → draft) stays client-allowed.
CREATE OR REPLACE FUNCTION public.enforce_server_publish()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.status = 'published'
       AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'published')
       AND COALESCE(auth.role(), '') IN ('authenticated', 'anon') THEN
        RAISE EXCEPTION 'Publishing is handled by the server. Use the Publish action in the app.';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS skills_enforce_server_publish ON skills;
CREATE TRIGGER skills_enforce_server_publish
    BEFORE INSERT OR UPDATE ON skills
    FOR EACH ROW EXECUTE FUNCTION public.enforce_server_publish();


-- ── OPTIONAL BACKFILL (read before running!) ─────────────────────────────────
-- The moment this migration runs, every already-published storefront goes dark
-- because no creator has a platform_subscriptions row yet. To grandfather
-- existing published creators with a courtesy 14-day trial (they still add a
-- card when the trial ends), uncomment and run once:
--
-- INSERT INTO platform_subscriptions (user_id, status, trial_ends_at)
-- SELECT DISTINCT creator_id, 'trialing', now() + interval '14 days'
-- FROM skills WHERE status = 'published'
-- ON CONFLICT (user_id) DO NOTHING;
