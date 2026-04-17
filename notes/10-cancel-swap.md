# Cancel Swap

## What was added

Users can now cancel an active swap from the chat profile modal. Cancelled swaps move to the Completed tab and show a cancellation banner.

---

## DB change required

The `swaps` table had a CHECK constraint that didn't include `'cancelled'`:

```sql
ALTER TABLE swaps DROP CONSTRAINT swaps_status_check;
ALTER TABLE swaps ADD CONSTRAINT swaps_status_check
  CHECK (status = ANY (ARRAY['pending', 'accepted', 'declined', 'completed', 'cancelled']));
```

---

## cancelSwap function — `src/app-pages/Chat.jsx`

```js
async function cancelSwap(swapId) {
    const { error } = await supabase
        .from('swaps')
        .update({ status: 'cancelled' })
        .eq('id', swapId);
    if (error) { showToast('Failed to cancel swap'); return; }
    setConversations(prev => prev.map(c =>
        c.swap_id === swapId ? { ...c, status: 'cancelled' } : c
    ));
    showToast('Swap cancelled.');
}
```

Called with `cancelSwap(activeConvo.swap_id)` — `swap_id` is the swap's DB primary key stored on the conversation object.

---

## UI changes

**Cancel button** — shown only when `status === 'accepted'`, styled with red text/border (not solid red) to match the app's secondary button pattern:

```jsx
<button
    className="btn btn-secondary"
    style={{ width: '100%', color: '#dc2626', borderColor: '#fca5a5' }}
    onClick={() => cancelSwap(activeConvo.swap_id)}
>
    Cancel Swap
</button>
```

**Cancelled banner** — shown in the modal when swap status is cancelled:

```jsx
{chatMode === 'swaps' && activeConvo?.status === 'cancelled' && (
    <div style={{ padding: '12px 14px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, color: '#4b5563' }}>
        ✕ This swap was cancelled.
    </div>
)}
```

**Completed tab** — `isSwapCompleted` updated to include cancelled:

```js
function isSwapCompleted(c) {
    return (c.requester_completed && c.receiver_completed) || c.status === 'cancelled';
}
```
