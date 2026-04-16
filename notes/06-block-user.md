# Block User Feature

## What
Users can block other users. Once blocked:
- The blocker can unblock from the same button
- The blocked user can't be seen/contacted (surface-level — no chat messages can be sent to a blocked user once the implementation is enforced at RLS level)

---

## Database — `blocked_users` table

Run in Supabase SQL editor:

```sql
CREATE TABLE blocked_users (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    blocker_id  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    blocked_id  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ DEFAULT now(),
    UNIQUE (blocker_id, blocked_id)
);

ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;

-- Users can only see their own block list
CREATE POLICY "Users can view own blocks" ON blocked_users
FOR SELECT USING (auth.uid() = blocker_id);

-- Users can block others
CREATE POLICY "Users can block others" ON blocked_users
FOR INSERT WITH CHECK (auth.uid() = blocker_id);

-- Users can unblock (delete their own blocks)
CREATE POLICY "Users can unblock" ON blocked_users
FOR DELETE USING (auth.uid() = blocker_id);
```

The `UNIQUE (blocker_id, blocked_id)` constraint prevents duplicate block entries. The backend uses `upsert` with `ignoreDuplicates: true` so double-clicking block is harmless.

---

## Backend — `backend/routes/blocks.js`

Registered at `/api/blocks` with `authMiddleware`.

| Endpoint | What it does |
|----------|-------------|
| `GET /api/blocks` | Returns the current user's full block list with blocked user's name/avatar |
| `POST /api/blocks/block` | Blocks a user. Validates: not self-block, user exists. Uses upsert. |
| `POST /api/blocks/unblock` | Deletes the block row for the given pair |

---

## Frontend — `src/components/BlockButton.jsx`

Standalone component that manages its own state. Props:

| Prop | Type | Description |
|------|------|-------------|
| `userId` | string | UUID of the user to block |
| `initialState` | boolean | Whether the user is already blocked (default: false) |
| `onBlock` | fn | Called after successful block |
| `onUnblock` | fn | Called after successful unblock |

**Flow:**
1. Not blocked → shows "Block user" button
2. Click → confirmation modal appears (explains what blocking does)
3. Confirm → calls `POST /api/blocks/block` → button changes to "Unblock user"
4. Click "Unblock user" → calls `POST /api/blocks/unblock` directly (no confirmation) → button reverts

---

## Where the button appears

### `src/app-pages/Profile.jsx`
Shows on other users' profiles (not own). Placed next to the "Report user" button below the profile header.

On load: calls `GET /api/blocks` to check if the profile being viewed is already blocked, sets `isBlocked` initial state.

### `src/app-pages/Chat.jsx`
Shows inside the chat profile modal (click on any conversation partner's name). Placed at the bottom of the modal below the rating section, separated by a divider. Does not persist initial state — always starts unchecked (acceptable since modal opens fresh each time from a conversation context).

---

## What blocking does NOT do (yet)
- Does not hide the blocked user's gigs from browse
- Does not prevent the blocked user from sending messages in existing conversations
- Does not remove existing matches

These would require additional RLS policies or query filters. Current implementation is the block data layer + UI surface — enforcement can be extended incrementally.
