# Admin Tab-Specific Data Refresh

## What was added

Each Admin tab now independently fetches and refreshes its own data when switched to. Badge counts stay accurate on load.

---

## Why

Previously `loadAll()` fired once on mount and loaded everything in one shot. After that:
- Disputes, orders, users, gigs were stale until a user action (resolve dispute, run clearance) triggered a full reload
- Finances only loaded the first time the tab was clicked (lazy, never refreshed on revisit)
- Reports loaded on every tab click via an `onClick` handler — inconsistent with the others
- The Reports badge count was 0 until the Reports tab was clicked at least once

---

## How

### Split `loadAll` into per-tab loaders

`loadAll` was broken into four individual async functions:

| Function | Fetches |
|---|---|
| `loadOrders()` | `gig_requests` with gig + requester + provider join |
| `loadDisputes()` | `gig_requests` filtered to `payment_status = 'disputed'` |
| `loadUsers()` | `profiles` (id, full_name, created_at) |
| `loadGigs()` | `gigs` with profile join |

`loadAll()` is kept and now calls all four in `Promise.all` — still used on mount and after actions (resolve dispute, run clearance, etc.).

### New tab-switch useEffect

```js
useEffect(() => {
    if (!user || user.email !== ADMIN_EMAIL || authLoading) return;
    if (tab === 'orders')   loadOrders();
    if (tab === 'disputes') loadDisputes();
    if (tab === 'users')    loadUsers();
    if (tab === 'gigs')     loadGigs();
    if (tab === 'finances') loadFinances();
    if (tab === 'reports')  loadReports();
}, [tab]);
```

Fires whenever `tab` changes. Each tab always gets fresh data on visit.

### Reports badge seeded on mount

```js
useEffect(() => {
    ...
    loadAll();
    loadReports(); // seed badge count immediately
}, [user, authLoading]);
```

Previously the Reports badge showed 0 until you clicked the tab. Now it reflects the real pending count from the moment the admin panel loads.

### Tab onClick simplified

Removed the manual `loadFinances()` / `loadReports()` calls that were inline in the tab button's `onClick`. The useEffect handles all tab-specific fetching now.

```js
// Before
onClick={() => {
    setTab(t.key);
    if (t.key === 'finances' && !finances) loadFinances();
    if (t.key === 'reports') loadReports();
}}

// After
onClick={() => setTab(t.key)}
```
