# 68 — App dialog system (modal alerts/confirms) + builder action bar

_Session 2026-07-02. Two things: (1) a reusable on-brand modal that replaces the
browser's native `alert()`/`confirm()` app-wide; (2) a bigger, nicer
delete/publish action bar in the builder. Written as a concept guide._

---

## Part 1 — the dialog system (the reusable bit)

### Why
Native `alert()` / `confirm()` are ugly, unstyled, and block the JS thread.
There were **28 call sites across 13 files**. We want branded modals for every
error / warning / confirmation.

### The design: a Provider + a Promise-returning hook
`src/components/Dialog.jsx` exports:
- `<DialogProvider>` — mounted **once** near the root (`main.jsx`, wrapping
  `<BrowserRouter>` inside `<AuthProvider>`). It holds the single active dialog
  in state and renders one `<DialogModal>`.
- `useDialog()` → `{ alert, confirm }`.

The key trick: **`confirm()` returns a Promise<boolean>**, and `alert()` a
Promise<void>. The provider stashes the promise's `resolve` in a ref; clicking a
button (or Esc / backdrop) calls it. So callers read like the native API but
async:

```js
const { confirm, alert } = useDialog();
if (!(await confirm({ title, message, danger: true }))) return;  // ← must await!
await alert({ title: 'Heads up', message: '…', tone: 'warning' });
```

Both accept a **plain string** as shorthand for `{ message }`. `tone` is
`default | warning | danger` (styles the icon + confirm button); `danger:true`
on confirm is sugar for the destructive red style.

### THE migration gotcha — you must `await`
Native `confirm()` is synchronous and returns a boolean **now**. Ours returns a
**Promise** (always truthy). So a blind `if (!confirm(...)) return;` would treat
the Promise as `true` and never bail. **Every converted call site had to become
`if (!(await confirm(...))) return;`** inside an already-`async` handler. This is
the one thing to check when converting a new call site.

### Naming: we shadow `alert`/`confirm` on purpose
Destructuring `const { confirm, alert } = useDialog();` shadows the global
`window.confirm/alert` inside that component, so the call sites keep familiar
names — only `await` + an options object change.

### Styling
Self-contained `<style>` in `Dialog.jsx`. Uses theme tokens; danger red is a
literal `#CE4A3E` (the warm palette has no red token). Backdrop click + Esc =
cancel; the confirm button autofocuses. The dialog buttons are custom `.dlg-btn`
classes (they don't use the global `.btn`, so no fighting the button reset).

## Part 2 — builder action bar (delete / publish)

`SkillBuilder`'s top bar was three tiny `btn-sm` buttons. Now:
- A separator border under the bar; bigger custom `.sb-actbtn` buttons with
  lucide icons — **Publish** (filled accent, `Globe`), **Push update** (outlined,
  `Send`), **Delete** (ghost, `Trash2`, turns red on hover), **Unpublish**
  (`EyeOff`).
- These are bare `<button>`s → they override the global `button` reset
  (radius/nowrap/inline-flex) explicitly, per notes 65/66. Bar wraps on narrow
  screens (`flex-wrap`).

## Files converted (all 28 real sites)
- **New:** `src/components/Dialog.jsx`; mounted in `src/main.jsx`.
- **v3 active:** `SkillBuilder` (delete/publish/push/errors + action bar),
  `Dashboard` (refund), `ServicesDashboard` (delete), `DiscountsPanel`,
  `AudiencePanel`, `CommunityThread`, `Comments`, `BookingWidget`, `Contact`,
  `Admin` (remove-comment).
- **Legacy (LEGACY_MODE):** `Rewards`, `MyListings`.
- **Skipped:** `VerifyCollege.jsx` — its `confirm(token)` is a **local function**,
  not the native dialog. Don't touch.

## Verify
- `eslint` clean on all converted files. (3 remaining errors —
  `Admin.jsx:428`, `Rewards.jsx:29`, `Comments.jsx:35` — are **pre-existing**,
  on untouched lines, unrelated to this change.)
- `npm run build` OK.

## Follow-ups
- Could add a `notify()` toast variant for non-blocking successes (some places
  still use component-local `ping`/`showToast` toasts — left as-is).
- The `alert`-style success dialogs (e.g. "Update pushed") could become toasts
  later; kept as modals here for one consistent surface.
