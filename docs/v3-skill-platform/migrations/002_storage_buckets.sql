-- ─────────────────────────────────────────────────────────────────────────────
-- SkillJoy v3 — Storage buckets (Phase 2)
-- Run once in the Supabase SQL editor (after 001). Idempotent.
--   skill-covers : PUBLIC  — cover images shown on storefronts/sales pages.
--   skill-files  : PRIVATE — gated downloadable assets; served via signed URLs.
-- Object paths are `{creator_id}/{skill_id}/{uuid}-{filename}` so the
-- folder-owner policies below scope writes to the uploading creator.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('skill-covers', 'skill-covers', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public)
VALUES ('skill-files', 'skill-files', false)
ON CONFLICT (id) DO UPDATE SET public = false;


-- ── skill-covers: public read, owner write ───────────────────────────────────
DROP POLICY IF EXISTS "Covers are publicly readable" ON storage.objects;
CREATE POLICY "Covers are publicly readable"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'skill-covers');

DROP POLICY IF EXISTS "Creators upload their covers" ON storage.objects;
CREATE POLICY "Creators upload their covers"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'skill-covers' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Creators update their covers" ON storage.objects;
CREATE POLICY "Creators update their covers"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'skill-covers' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Creators delete their covers" ON storage.objects;
CREATE POLICY "Creators delete their covers"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'skill-covers' AND (storage.foldername(name))[1] = auth.uid()::text);


-- ── skill-files: private — owner full access only ────────────────────────────
-- Buyers never read these directly; the backend mints short-lived signed URLs
-- with the service-role key (Phase 3). Creators can read/write their own folder.
DROP POLICY IF EXISTS "Creators manage their files" ON storage.objects;
CREATE POLICY "Creators manage their files"
    ON storage.objects FOR ALL TO authenticated
    USING (bucket_id = 'skill-files' AND (storage.foldername(name))[1] = auth.uid()::text)
    WITH CHECK (bucket_id = 'skill-files' AND (storage.foldername(name))[1] = auth.uid()::text);
