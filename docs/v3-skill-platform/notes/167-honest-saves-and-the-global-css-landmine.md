# 167 — Guide: making autosave honest, and the global-CSS landmine that ate the link editor

Date: 2026-08-21
Follows: `165` (publish gates), `166` (booking invites)

Four fixes. The first is a behaviour class; the other three all turn out to be
the *same* CSS bug wearing three costumes, which is why they're in one note.

---

## Part 1 · Autosave was lying

### The mental model

**An optimistic UI makes a promise on the server's behalf. If the server then
refuses, something has to take the promise back.** Nothing did.

Three separate mechanisms combined into one bad outcome:

```js
// 1. the indicator, in SkillBuilder + LessonEditor
const [savedAt, setSavedAt] = useState(null);
...
{savedAt ? 'Saved ✓' : ''}

// 2. the debounced save
const toSave = pendingSkill.current;
pendingSkill.current = {};              // ← cleared BEFORE the await
try { await updateSkill(skillId, toSave); setSavedAt(Date.now()); }
catch (e) { console.warn('save skill', e.message); }

// 3. every reorder and delete
try { await reorderModules(ids); } catch (e) { console.warn(e.message); }
```

Trace a failure through those:

1. You edit a field. The patch goes into `pending`.
2. Debounce fires. `pending` is **emptied**, then the request goes out.
3. Request fails. The patch is now in a local `const` that goes out of scope —
   **gone**. Not queued, not retried, not recoverable.
4. `savedAt` still holds a timestamp from an earlier success, so the header
   still reads **"Saved ✓"**.
5. You navigate away satisfied. The edit never existed.

`savedAt` was the worst part, because it was set once and never cleared. It read
"Saved ✓" during the 600ms debounce when the edit had *not* been sent, and after
a failure. **Success and failure were visually identical**, and the only record
was a `console.warn` in a console nobody has open.

> **Transferable:** any `catch` that only logs is a decision to let the user
> believe something that isn't true. There were 22 of these in `src/`.

### Fix 1 — a real state machine

`src/lib/useSaveState.js`. Five states, and the one that was missing is `dirty`:

| state | meaning |
|---|---|
| `idle` | nothing to save |
| `dirty` | edits exist that have **not** reached the server |
| `saving` | request in flight |
| `saved` | server has everything |
| `error` | last write failed, patch still held |

`dirty` is what makes the indicator honest. Without it there is no way to
distinguish "typed but not sent" from "safely stored", and the old code
collapsed both into "Saved ✓".

One subtlety in `markDirty`:

```js
setStatus(s => (s === 'error' ? 'error' : 'dirty'));
```

Typing again must not clear a previous failure. If a save failed, that fact
outranks "you have new edits" until it actually succeeds.

### Fix 2 — stop destroying the patch

```js
const toSave = pendingSkill.current;
pendingSkill.current = {};
try { ... }
catch (e) {
  pendingSkill.current = { ...toSave, ...pendingSkill.current };  // put it BACK
  save.markError(e.message);
}
```

Spread order matters and is easy to get backwards: **newer edits win**. Anything
typed while the request was in flight is already in `pending`, so the restored
older patch must be spread *first*.

The same reasoning drives the success branch:

```js
if (Object.keys(pendingSkill.current).length) save.markDirty();
else save.markSaved();
```

A save can succeed while newer edits are already queued. Reporting "Saved" there
would be wrong again — just a smaller window.

### Fix 3 — optimistic, but reversible

Every reorder and delete now snapshots the previous state and restores it:

```js
const prev = modules;
setModules(next);
try { await reorderModules(next.map(m => m.id)); }
catch (e) { setModules(prev); setErr(`Couldn't reorder modules — ${e.message}`); }
```

The rule: **the screen must always match the database.** A failed reorder that
leaves the new order on screen looks saved and silently reverts on next load.
A failed delete that still vanishes from the UI is a phantom — gone on screen,
alive in the DB, back tomorrow.

### Fix 4 — the two ways to leave

There are two exits and they need different treatment:

- **Route change** → the component unmounts, and the existing flush-on-unmount
  fires. It genuinely *cannot* report an error (there's no component left to
  render one), so it stays swallowed — but now `console.error`s loudly with the
  skill/block id, so "my last edit vanished" is diagnosable.
- **Tab close** → kills in-flight requests outright; no flush survives it. The
  browser's native "Leave site?" prompt is the only real defence:

```js
const unsaved = save.status === 'dirty' || save.status === 'saving' || save.status === 'error';
useEffect(() => {
  if (!unsaved) return;                       // armed ONLY when truly unsaved
  const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
  window.addEventListener('beforeunload', warn);
  return () => window.removeEventListener('beforeunload', warn);
}, [unsaved]);
```

Gating on `unsaved` matters. A `beforeunload` that always fires trains people to
dismiss it, and then it protects nothing.

---

## Part 2 · The link editor: one landmine, three symptoms

Three reported bugs — affiliate checkbox not aligned, Add-link button "messed
up", product search too tall. All three are the **same root cause**.

### The landmine

`src/App.css` styles bare element selectors:

```css
button, .btn { display:inline-flex; border:none; border-radius:var(--r-full);
               white-space:nowrap; ... }

input, textarea, select { width:100%; padding:12px 16px; font-size:15px;
                          border:1.5px solid var(--border); ... }
```

Every `<button>` and `<input>` in the app starts with those, whether or not it
wants them. A component-scoped class therefore has to **actively undo** anything
it doesn't want — and if it forgets one property, that property silently
survives from the global.

### Symptom A — the search box was double-padded

```css
.sv-search       { padding: 8px 14px; ... }      /* the container */
.sv-search input { border:none; background:none; font-size:14px; width:100%; }
```

That reset border, background, font-size and width — but **not padding**. So the
input kept the global `padding: 12px 16px` *inside* a container already adding
8px top and bottom. Total ≈ 8 + 12 + text + 12 + 8, roughly double the filter
buttons beside it.

```css
.sv-search input { ...; padding: 0; line-height: 20px; height: 20px; }
```

**Transferable:** when a rule resets *some* properties of a globally-styled
element, the ones it forgot are the bug. Padding is the usual casualty because
it's invisible until something sits next to it.

### Symptom B — `.std-check` and `.std-addbtn` had no CSS at all

Not "wrong CSS". **None.** Six classes were used in `StorefrontEditor.jsx`
markup with no matching rule anywhere:

```
std-addbtn  std-check  std-linkplace  std-panel-lede  std-themegrid  std-upload-wide
```

So they rendered as whatever the global gave them:

- **`.std-check`** — a `<label>` with a checkbox and text, no flex. Both sat on
  the text baseline, so the box rode low and crowded the words. That's the
  "not connected / centered". The checkbox also needed `width:16px; margin:0`,
  because the global `input` rule was stretching it to `width:100%` with 12px
  of padding.
- **`.std-addbtn`** — applied to **both** `<button>` *and* `<label>` elements in
  the same file. `button` picks up the global pill (inline-flex, `border:none`,
  full radius, **no padding, no background**); `label` picks up nothing. Two
  elements, same class, completely different rendering. That's the "not matching
  the UI". The new rule restates everything so the element type stops mattering.

### Symptom C — the stylesheet was structurally corrupted

Found while fixing B. A bad paste had damaged the `<style>` block:

```css
.std-linkcard { ... }
; white-space:nowrap; overflow:hidden; ... }     ← orphaned tail of .std-platlabel
/* duplicated socials block */
.std-linkcard { ... }                            ← second copy
r-lg); background:var(--surface); cursor:pointer; ← .std-theme lost its SELECTOR
```

`.std-theme` — the theme preset cards — had no opening at all. Its children
(`.std-theme-swatch`, `-dot`, `-meta`) and its `:hover` survived, so I
reconstructed the base rule from those. Present in `git HEAD`, so this was
committed weeks ago, not from anyone's current edits.

> **Transferable — the check worth stealing.** Two shell lines find every
> unstyled class in a CSS-in-JS component, and would have caught all of this:
>
> ```sh
> grep -oE 'className="[^"]*"' F | grep -oE 'std-[a-z0-9-]+' | sort -u > used
> grep -oE '\.std-[a-z0-9-]+'   F | sed 's/^\.//'           | sort -u > defined
> comm -23 used defined     # used but never styled
> ```

### A trap I hit twice while fixing this

These `<style>` blocks are **template literals**. I put backticks in a CSS
comment (`` `button` ``) and terminated the literal mid-file — a parse error
~700 lines from anything visibly wrong. Inside `` <style>{`...`}</style> ``,
never use a backtick, not even in prose. Use quotes.

---

## Files
**New** — `src/lib/useSaveState.js`, `src/components/SaveStatus.jsx`
**Changed** — `src/app-pages/SkillBuilder.jsx`, `src/app-pages/LessonEditor.jsx`
(save state, restore-on-failure, reversible reorder/delete, beforeunload),
`src/components/CourseStructure.jsx` (reversible ops + inline error),
`src/app-pages/StorefrontEditor.jsx` (6 missing rules + CSS repair),
`src/app-pages/ServicesDashboard.jsx` (search height)

## Still open
- **19 of the original 22 silent catches remain** outside the builder — same
  class of bug, not yet audited. `grep -rnE "catch \{ ?\}|catch \(e\) \{ console\."`
- The global `button` / `input` selectors in `App.css` are the root landmine.
  Scoping them to `.btn` and `.field` would prevent the next instance, but it
  touches every component and needs its own pass.
