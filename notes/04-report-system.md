# User Report System

## What
Users can report gigs and other users. Reports go to the admin for review. The admin can dismiss reports or act on them (e.g. remove the reported gig).

---

## Architecture

```
User clicks "Report" → ReportModal → POST /api/reports → reports table
                                                        ↓
                                            Admin reviews in Reports tab
                                            Admin dismisses or removes gig
```

---

## Database — `reports` table

Run in Supabase SQL editor:
```sql
CREATE TABLE reports (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    reported_type TEXT        NOT NULL CHECK (reported_type IN ('gig', 'user')),
    reported_id   UUID        NOT NULL,
    reason        TEXT        NOT NULL,
    description   TEXT,
    status        TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
    created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can submit reports" ON reports
FOR INSERT WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view own reports" ON reports
FOR SELECT USING (auth.uid() = reporter_id);
```

**Why `reported_id UUID` with no FK:** The reported entity could be a gig or a user — a single foreign key can't reference two tables. The `reported_type` field disambiguates which table to look up.

---

## Backend

### `backend/routes/reports.js` — `POST /api/reports`
Validation:
- `reportedType` must be `'gig'` or `'user'`
- `reason` must be from the allowed list (server-side, not just frontend)
- `description` max 1000 chars
- Cannot report yourself
- For gig reports: verifies gig exists and isn't owned by the reporter
- 24-hour deduplication: can't submit the same report twice within 24h

### `backend/routes/admin.js`

**`GET /api/admin/reports`** — fetches all reports, enriches with reporter name and reported entity name.

**`POST /api/admin/dismiss-report`** — sets `status = 'dismissed'`.

To take action on a gig report, admin uses the existing "Remove Gig" flow (the Reports tab has a "Remove Gig" shortcut button).

---

## Frontend

### `src/components/ReportModal.jsx`
Shared modal used for both gig and user reports. Props:
- `isOpen` — controls visibility
- `reportedType` — `'gig'` or `'user'`
- `reportedId` — UUID of the entity being reported
- `reportedName` — displayed in the modal header

Has a reason dropdown (different options per type), optional description textarea with char counter, and a two-step success state.

### `src/app-pages/GigDetails.jsx`
"Report this gig" button added to the sidebar, only visible when `gig.user_id !== user.id` (can't report your own gig).

### `src/app-pages/Profile.jsx`
"Report user" button added below the profile header actions, only visible when `!isOwnProfile`.

### `src/app-pages/Admin.jsx`
New "Reports" tab with:
- Pending/dismissed count summary
- Per-report card showing: type badge, status badge, reported entity name, reason, description, reporter name, date
- "Remove Gig" button (shortcuts to the existing gig removal modal) for gig reports
- "Dismiss" button to mark as reviewed/no action needed
- Red badge on tab when there are pending reports (same pattern as Disputes)

---

## Reason Lists
```
Gig:  Spam or misleading | Inappropriate content | Scam or fraud | Copyright violation | Other
User: Harassment | Spam or misleading | Fake profile | Scam or fraud | Inappropriate behavior | Other
```

These are validated on both frontend (dropdown) and backend (allowlist check).
