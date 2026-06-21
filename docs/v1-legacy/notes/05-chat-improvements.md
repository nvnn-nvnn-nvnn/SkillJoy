# Chat System Audit & Fixes

## Bugs Fixed

### 1. Composer Background Color
**File:** `src/app-pages/Chat.jsx` — `.composer` CSS class
**Problem:** `background: #a06840` — a brownish/orange debug color was hardcoded. The message input bar appeared brown.
**Fix:** Changed to `background: var(--surface)` to match the rest of the UI.

---

### 2. `auto_release_date` Never Set
**File:** `src/app-pages/Chat.jsx`
**Problem:** The escrow banner showed an auto-release countdown timer using `activeConvo.auto_release_date`, but this field was never populated in the conversation data. The DB column is named `confirmation_deadline`. The timer was always empty/invisible.
**Fix:** In `loadGigConversations`, added `auto_release_date: req.confirmation_deadline` to the enriched data object so the JSX reference resolves correctly.

---

### 3. Double `loadGigConversations` on Mount
**File:** `src/app-pages/Chat.jsx` — mount `useEffect`
**Problem:** When the page was opened with a `?gig=<id>` URL param, `loadGigConversations` was called twice — once at the top of the effect and again inside the `if (gigParam)` branch. This caused two redundant DB fetches on load.
**Fix:** Changed to load both swap and gig conversations in parallel with `Promise.all`, then use the already-loaded results:
```js
const [convos, gigConvos] = await Promise.all([loadConversations(), loadGigConversations()]);
```

---

### 4. Loose Equality (`==` vs `===`)
**File:** `src/app-pages/Chat.jsx` — "Revert Delivered" button condition
**Problem:** `activeConvo.payment_status == 'escrowed' && activeConvo.status == "delivered"` used loose equality. In JavaScript, `==` can cause unexpected type coercions.
**Fix:** Changed to strict equality `===` on both conditions.

---

### 5. Dead Code — `markGigComplete` and `unmarkGigComplete`
**File:** `src/app-pages/Chat.jsx`
**Problem:** Two functions existed for marking a gig complete via a vote system, but they were never called from any JSX button or handler. The actual gig completion flow uses `markAsDelivered`, `releaseFundsAndComplete`, and `revertMarkAsDelivered` instead.
**Fix:** Deleted both dead functions.

---

## Performance Fix — N+1 Queries

### Before
Both `loadConversations` and `loadGigConversations` made individual Supabase calls per conversation to fetch last message and ratings. For 10 conversations, this was 10-20 separate round trips.

```js
// Old — called once per conversation:
const { data: lastMsgs } = await supabase.from('messages')
    .eq('swap_id', swap.id).limit(1);
```

### After
All last messages and ratings are fetched in 2 batch queries, then joined in JavaScript.

**Swaps:** 1 query instead of N
```js
const { data: allMsgs } = await supabase
    .from('messages')
    .select('content, created_at, sender_id, swap_id')
    .in('swap_id', swapIds)
    .order('created_at', { ascending: false });

// Group in JS — first message per swap_id is the latest (ordered desc)
for (const msg of allMsgs ?? []) {
    if (!lastMsgBySwap[msg.swap_id]) lastMsgBySwap[msg.swap_id] = msg;
}
```

**Gigs:** 2 parallel batch queries instead of N×2
```js
await Promise.all([
    // All last messages for all gig conversations
    supabase.from('messages').select('...').in('gig_request_id', gigReqIds)...,
    // All ratings for all "other" users
    supabase.from('ratings').select('rating, rated_id').in('rated_id', otherUserIds)...,
]);
```

**Result:** Load time scales linearly with number of conversations but with constant DB round trips instead of O(n) round trips.

---

## Architecture Notes

### Real-time Subscriptions
The chat uses 3 types of Supabase Realtime subscriptions per active conversation:
1. `messages-{id}` — listens for new messages (INSERT)
2. `swap-{id}` or `gig-{id}` — listens for status changes (UPDATE)
3. `gig-list-notif-{userId}` — listens for `notifications` inserts to refresh the conversation list

Why notifications instead of direct gig_request UPDATEs for the list? Supabase Realtime UPDATE filtering requires `REPLICA IDENTITY FULL` on the table. `gig_requests` uses the default identity, which means column-level filters on UPDATEs are silently dropped. The notifications INSERT event is reliable and fires whenever order status changes.

### Subscription Cleanup
`cleanupSubs()` removes both the message channel and the entity (swap/gig) channel when switching conversations. The gig list notification subscription lives for the full page lifetime and is cleaned up in the effect's return function.
