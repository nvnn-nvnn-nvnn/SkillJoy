# 36 — Comments on Gigs/Profiles + Reporting

## What was built

End-to-end comments system: users can leave comments on any gig or profile, delete their own, and report others'. Admin can review and remove reported comments through the existing reports tab.

## SQL — run in Supabase SQL editor

```sql
CREATE TABLE comments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    target_type text NOT NULL CHECK (target_type IN ('gig', 'profile')),
    target_id uuid NOT NULL,
    body text NOT NULL CHECK (length(trim(body)) > 0 AND length(body) <= 1000),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX comments_target_idx ON comments (target_type, target_id, created_at DESC);
CREATE INDEX comments_author_idx ON comments (author_id);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comments_select" ON comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "comments_insert" ON comments FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());
CREATE POLICY "comments_delete" ON comments FOR DELETE TO authenticated USING (author_id = auth.uid());
```

## Files changed

### New
- `src/components/Comments.jsx` — reusable component. Props: `targetType` ('gig' | 'profile'), `targetId`. Lists comments newest-first, has post form (1000-char cap), delete-own button, and report button per comment. Wires the existing `ReportModal` for reports.

### Modified
- `backend/routes/reports.js` — added `'comment'` to valid `reported_type` values. Added `COMMENT_REASONS` array (Spam, Harassment, Hate speech, Inappropriate content, Illegal activity, Other). Refactored to use a `REASONS_BY_TYPE` lookup. Blocks reporting your own comment.

- `backend/routes/admin.js` — `/admin/reports` enrichment now handles `'comment'` type: fetches the comment body (truncated to 80 chars as `reported_name`), author full_name as `reported_owner`, and includes `comment_target_type` + `comment_target_id` so admin can deep-link to where the comment was posted. Added new `POST /admin/remove-comment` route — deletes the comment and resolves any pending reports for it.

- `src/components/ReportModal.jsx` — accepts `reportedType="comment"`, shows comment-specific reasons. Refactored to lookup-table pattern.

- `src/app-pages/GigDetails.jsx` — imports `Comments`, mounts `<Comments targetType="gig" targetId={gig.id} />` below the main two-column layout.

- `src/app-pages/Profile.jsx` — imports `Comments`, mounts `<Comments targetType="profile" targetId={profile.id} />` after the Reviews section, gated on `profile?.id` so it doesn't render before profile loads.

- `src/app-pages/Admin.jsx` — yellow badge for comment reports (alongside blue for gig, purple for user). Deep-link logic now routes comment reports to the gig or profile where the comment was posted (using `comment_target_type` / `comment_target_id` from the enriched report). Added "🗑 Remove Comment" action button that calls `POST /api/admin/remove-comment`.

## Why each piece

**Single `comments` table with `target_type` + `target_id`** instead of separate `gig_comments` and `profile_comments` tables — same shape, same UI, same admin workflow. Polymorphism is fine here because we never JOIN to `gigs` or `profiles` from the comment query (we display the target on the page that's already showing it).

**RLS instead of a backend route** — comments are simple CRUD on a single table with clean ownership rules. The supabase-js client + RLS is enough. Reports go through the backend because they need cross-entity validation and rate-limiting (the 24-hour duplicate check).

**Comment-specific reasons** — reusing GIG_REASONS for comments would be wrong (no "copyright violation" for comments) and reusing USER_REASONS would miss things like "hate speech" and "illegal activity" that matter more for free-form text.

**Truncated body in admin enrichment** — `reported_name` is limited to 80 chars in admin so the report list stays scannable. Admin can click through to see context if needed.

**`ON DELETE CASCADE` on author_id** — when a profile is deleted, their comments go with them. Reports for those comments will show "Comment deleted" in admin (handled in the enrichment).

**`profile?.id &&` guard before mounting Comments on Profile.jsx** — `profile` is async-loaded state. Without the guard, Comments would mount with `targetId={undefined}` on first render, fire a useless query, then re-mount when profile loads. Same closure-issue lineage as notes 34/35.

## Self-reporting protection

Backend blocks: reporting yourself (user), reporting your own gig, reporting your own comment. Frontend hides the report button on your own comments and shows a delete button instead.

## Out of scope (intentional)

- **Edit comments** — no `edited_at` column or update policy. Add later if needed.
- **Threaded replies** — flat list only. Adding parent_id is straightforward later.
- **Notifications** — commenters don't get notified when someone replies. Could wire into the existing notifications table if Devan wants.
- **Pagination** — loads all comments. Fine until any single gig/profile crosses ~200 comments.
