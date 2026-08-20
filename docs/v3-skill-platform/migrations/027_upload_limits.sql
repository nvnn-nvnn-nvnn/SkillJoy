-- ─────────────────────────────────────────────────────────────────────────────
-- SkillJoy v3 — Storage upload limits (migration 027)
-- Run once in the Supabase SQL editor. Idempotent.
--
-- WHY: buckets 'skill-covers' and 'skill-files' were created in migration 002
-- with NO file_size_limit and NO allowed_mime_types, i.e. they accepted files
-- up to the project-wide global limit, of any type. Storage is billed, so that
-- is an unbounded cost exposed to every authenticated creator.
--
-- This is the AUTHORITATIVE limit. `src/lib/uploadLimits.js` mirrors these
-- numbers for fast, specific feedback in the UI, but it runs in the browser and
-- can be bypassed by calling the storage API directly. Only the bucket setting
-- below actually stops the bytes. Keep the two in sync.
--
-- NOTE on the global cap: a bucket limit cannot exceed the project's global
-- upload limit (Supabase dashboard → Storage → Settings). If a value here is
-- larger than the global cap, the global cap wins and this silently appears not
-- to work. Check that first when debugging.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── skill-files (PRIVATE) — gated digital products ───────────────────────────
-- 200 MB hard ceiling. Anything above 25 MB must be a .zip, but that rule lives
-- in the client (uploadLimits.js): Postgres cannot see a filename extension at
-- the point storage enforces size, so the archive requirement is UX-layer only.
-- The bucket's job is the ceiling; the client's job is the shape.
--
-- MIME is left unrestricted here ON PURPOSE. A digital product is legitimately
-- almost any type — zip, pdf, psd, mp3, epub, blend. An allowlist would break
-- real sellers, and the bucket is private + served by signed URL, so the
-- attack surface of an odd MIME type is low.
UPDATE storage.buckets
   SET file_size_limit = 209715200          -- 200 MB
 WHERE id = 'skill-files';

-- ── skill-covers (PUBLIC) — covers, banners, bg images, audio, bg video ──────
-- ⚠️ Design wrinkle worth understanding: this ONE bucket holds five different
-- kinds of asset with five different sensible limits (1 MB cursor → 50 MB
-- background video). A bucket limit is per-bucket, not per-kind, so this can
-- only enforce the LOOSEST of them. The tighter per-kind limits necessarily
-- live in uploadLimits.js.
--
-- The real fix, if this ever matters, is to split bg video into its own bucket
-- so each bucket has one purpose and one honest limit. Not done here because it
-- would require migrating existing object paths.
UPDATE storage.buckets
   SET file_size_limit = 52428800,          -- 50 MB — sized for background video
       allowed_mime_types = ARRAY[
         'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/svg+xml',
         'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/aac', 'audio/mp4',
         'video/mp4', 'video/webm', 'video/quicktime'
       ]
 WHERE id = 'skill-covers';

-- Unlike skill-files, this bucket IS public and its contents are rendered
-- directly in other people's browsers, so the MIME allowlist matters here:
-- it stops a creator from parking arbitrary executables on a public URL.
-- (SVG is included because it is a legitimate logo format — note that SVG can
-- carry script, which is why it is only acceptable on a domain that serves
-- storage from a separate origin, as Supabase does.)

-- ── Verify ───────────────────────────────────────────────────────────────────
-- Expect: skill-files 209715200 / NULL, skill-covers 52428800 / {…}
SELECT id, file_size_limit, allowed_mime_types
  FROM storage.buckets
 WHERE id IN ('skill-files', 'skill-covers');
