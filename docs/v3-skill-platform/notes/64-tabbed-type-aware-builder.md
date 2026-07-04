# 64 — Tabbed, type-aware product builder (expert guide)

_Session 2026-07-02. Phase A chunk 2: turn the single-scroll `/build/:id`
editor into a guided, tabbed, type-aware builder — the "room" the new
`/build/new` picker (note 63) opens into. Written as a concept guide._

---

## 1. The idea in one line

Same data, same save engine — **reorganized into a guided flow** so the tool
_feels_ like it understands what you're making. Zero schema changes, zero
changes to how anything persists.

## 2. The one rule that kept this safe

`SkillEditor` has a **debounced auto-save engine** (`patchSkill` / `patchBlock`
→ 600ms timer → `updateSkill` / `updateBlock`, with a flush-on-unmount so a
quick navigate-away doesn't drop the last keystroke). That engine is the
riskiest, most correctness-sensitive code in the builder.

**Rule: the tabs are a pure presentation layer. Do not touch the save engine.**

Concretely, the refactor only ever did three things:
1. Wrapped existing JSX groups in `{tab === '…' && ( … )}` conditionals.
2. Added local UI state `const [tab, setTab] = useState('details')`.
3. Added derived, render-time constants (`kind`, `ready`) — no new state,
   no new effects, no new writes.

Every input still calls the exact same `patchSkill({ … })` it did before. If a
field saved yesterday, it saves today, because that wiring is byte-for-byte
unchanged. **This is the pattern to reuse whenever you reorganize a form that
has live save logic: move the *markup*, never the *plumbing*.**

## 3. What the tabs are

Ordered to mirror Stan's mental sequence (identity → contents → money → go live):

| Tab       | Holds                                        | Fields (all pre-existing) |
|-----------|----------------------------------------------|---------------------------|
| **Details** | Cover, title, tagline, product type        | `cover_url`, `title`, `outcome`, `kind` |
| **Content** | The reorderable blocks + Add-block menu     | `blocks` (unchanged) |
| **Pricing** | Price + one-time/membership + plain-English explainer | `price_cents`, `pricing_type` |
| **Publish** | Readiness checklist + contextual guidance   | derived only (read-only) |

The **top action bar stays across all tabs** (Back / Saved✓ / Delete / Push
update / Publish) so publishing is always one click away regardless of tab —
matching how Stan keeps Publish pinned.

### `outcome` IS the subtitle
Note 63 floated adding a `subtitle` column. We didn't — the existing `outcome`
field ("one-line promise") already fills the tagline/subtitle role Stan uses.
Reusing it avoided a migration for zero user-visible loss. **Lesson: before
adding a column, check whether an existing field already means that thing.**

## 4. What "type-aware" means here (and its limits)

Real type-awareness this pass is deliberately *light*:

- **`KIND_HINTS`** (module-level map, keyed by `skills.kind`) — the Content tab
  shows a per-type nudge: digital → "add a File block for the download",
  coaching → "add a Coaching block with your booking link", etc. Falls back to
  `digital`.
- The Details tab still exposes the full **Type** `<select>` so a creator can
  re-classify after the fact (the picker only sets the initial `kind`).

What it is **not** yet: the field *set* doesn't branch by type — a coaching
product and a digital product still offer the same blocks and pricing controls.
True per-type forms (e.g. coaching showing availability inline, digital
foregrounding a single upload-or-URL step) are the next depth pass. The hint map
is the cheap 80/20 that makes it *feel* tailored today.

## 5. Files touched

- **`src/app-pages/SkillBuilder.jsx`** — only file changed for this feature.
  - Added module consts `KIND_HINTS` and `TABS`.
  - `SkillEditor`: added `tab` state; derived `kind` + `ready` after the load
    guard; split the flat body into four `{tab === …}` panels; added tab-nav
    markup and CSS (`.sb-tabs`, `.sb-panel`, `.sb-hint`, `.sb-checklist`, a
    small fade-in keyframe). Save engine untouched.
  - Copy nudged "Skill" → "product" on user-facing labels.

## 6. Verification

- `npx eslint src/app-pages/SkillBuilder.jsx` → clean.
- `npm run build` → 1876 modules, built OK. (The >500kB chunk warning is
  pre-existing and unrelated — whole app is one bundle; code-splitting is a
  separate someday-task.)

## 7. Next depth passes (not done)

- **Per-type field sets.** Branch the actual controls on `kind`, not just hints
  — e.g. digital = one first-class "Upload file OR redirect URL" step; coaching
  = availability + call length inline. Some of these need new columns → a
  migration (mirror it into `supabase/schema.sql`, apply via Supabase SQL editor,
  same drill as migration 011 in note 56).
- **Preview from the builder.** A "Preview" button opening `/@handle/:skillId`
  (needs `profile.username`, like the `/services` preview action).
- **Then Phase B:** declutter `/dashboard` into tabbed sections and unify its
  look with `/services` + this builder.
