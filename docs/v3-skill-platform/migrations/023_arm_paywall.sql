-- ─────────────────────────────────────────────────────────────────────────────
-- 023 — ARM the paywall. Re-applies the enforcement that 022 deferred, and
-- grandfathers existing published creators so they don't go instantly dark.
-- Idempotent (safe to re-run). Run ONCE in the Supabase SQL editor.
--
-- ⚠️ DO NOT RUN THIS until ALL of these are true (see note 112):
--   1. Stripe platform Product + monthly Price exist on SkillJoy's OWN account,
--      and STRIPE_PLATFORM_PRICE_ID is set in backend/.env.
--   2. The backend (server publish endpoint) + frontend are DEPLOYED. This
--      migration re-adds a trigger that BLOCKS client-side publishing, so the
--      server /api/skills/:id/publish endpoint MUST be live first or creators
--      can't publish at all.
--   3. The Stripe webhook subscribes to invoice.payment_failed.
--
-- Arming order: deploy code (env + backend + frontend) → THEN run this. The DB
-- trigger is the ONLY real paywall lock (the endpoint is UX) — it must be present
-- whenever STRIPE_PLATFORM_PRICE_ID is set, or a direct anon-key update bypasses
-- the paywall (note 112, ARM-TIME risk #1).
-- ─────────────────────────────────────────────────────────────────────────────


-- ── Step 0: SECURITY DEFINER helpers (self-sufficient; CREATE OR REPLACE) ─────
-- Recreated here so 023 stands alone regardless of which 021/022 cut ran.
-- Both bypass the referenced table's RLS (no skills⇄purchases recursion, no
-- owner-read visibility trap) while auth.uid() still resolves to the caller.
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


-- ── Step 1: Grandfather existing published creators ──────────────────────────
-- Runs in the SAME transaction as the gated policy below, so there is NO dark
-- window: existing published storefronts get a live row before the policy that
-- would hide them takes effect.
--
-- ⚠️ ZOMBIE-ROW CAVEAT — READ THIS: these rows have NO stripe_subscription_id,
-- so NO webhook will ever transition them. With no cron, a status='trialing'
-- comp row stays 'trialing' forever → the storefront stays live, free, forever,
-- until the creator voluntarily subscribes. This is effectively a permanent comp
-- for pre-paywall creators. That may be exactly what you want (a "founder" perk).
-- If you instead want the comp to EXPIRE and force a subscription, you must build
-- a scheduled job that, at trial_ends_at, flips these no-Stripe rows to a
-- storefront-darkening status (or prompts them to subscribe) — see 112 follow-up.
-- trial_ends_at is set below to give that future job something to key on.
--
-- To comp them PERMANENTLY and honestly, change 'trialing' → 'active' below.
INSERT INTO platform_subscriptions (user_id, status, trial_ends_at)
SELECT DISTINCT creator_id, 'trialing', now() + interval '14 days'
FROM skills
WHERE status = 'published'
ON CONFLICT (user_id) DO NOTHING;   -- never clobber a creator's REAL Stripe row


-- ── Step 2: Re-arm the storefront visibility gate ────────────────────────────
-- Published skills are public ONLY while the creator's platform sub is live.
-- (Owner always sees own; a paid buyer always sees what they bought.)
DROP POLICY IF EXISTS "Published skills are public" ON skills;
CREATE POLICY "Published skills are public"
    ON skills FOR SELECT USING (
        auth.uid() = creator_id
        OR public.has_paid_purchase(id)
        OR (status = 'published' AND public.creator_is_live(creator_id))
    );


-- ── Step 3: Re-arm server-only publishing ────────────────────────────────────
-- Blocks the TRANSITION into status='published' for client roles (authenticated/
-- anon); the service role (backend publish endpoint) + SQL editor pass through.
-- Legitimate client edits to already-published rows (title/price/reorder) and
-- unpublishing (published → draft) stay allowed.
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


-- ── Post-run verification (run these SELECTs after, expect the noted results) ──
-- 1. Gate live?  Expect the policy body to include creator_is_live:
--      SELECT qual FROM pg_policies
--       WHERE tablename='skills' AND policyname='Published skills are public';
-- 2. Trigger present?  Expect one row:
--      SELECT tgname FROM pg_trigger WHERE tgname='skills_enforce_server_publish';
-- 3. Grandfather count matches distinct published creators?
--      SELECT (SELECT count(*) FROM platform_subscriptions WHERE status='trialing'
--              AND stripe_subscription_id IS NULL) AS comped,
--             (SELECT count(DISTINCT creator_id) FROM skills WHERE status='published') AS expected;
-- 4. Sanity: a public/anon session can still see a comped creator's published
--    skills (creator_is_live true), and a lapsed/no-row creator's are hidden.
