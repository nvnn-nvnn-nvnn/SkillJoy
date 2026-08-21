# 162 — Playlist ordering, a 4-track cap, and a visitor volume slider

Date: 2026-08-20

Three changes to site music. Exact locations:

| Change | File | Symbol / line |
|---|---|---|
| Cap constant | `src/lib/storefront.js` | `MAX_AUDIO_TRACKS` — line 25 |
| Reorder handler | `src/app-pages/StorefrontEditor.jsx` | `moveTrack()` — line 281 |
| Cap enforcement | `src/app-pages/StorefrontEditor.jsx` | in `onAudioAdd()` — line 261 |
| Track row markup | `src/app-pages/StorefrontEditor.jsx` | lines 829–846 |
| Reorder styles | `src/app-pages/StorefrontEditor.jsx` | `.std-track-move` — line 1115 |
| Volume storage | `src/app-pages/Storefront.jsx` | `VOLUME_KEY` 274, `readStoredVolume()` 281 |
| Volume state | `src/app-pages/Storefront.jsx` | `volume` 298, `canSetVolume` 301, `applyVolume()` 305 |
| iOS probe | `src/app-pages/Storefront.jsx` | inside the mount effect — lines 315–323 |
| Dock markup | `src/app-pages/Storefront.jsx` | lines 371–388 |
| Dock styles | `src/app-pages/Storefront.jsx` | `.sf-audiodock` 625, `.sf-audiovol` 633 |

---

## 1. Reordering

**Before:** the modal rendered each track as index badge → name + `<audio>` →
remove `X`. Upload order was the only order.

**After:** a `.std-track-move` column of two `std-icobtn`s sits between the track
body and the remove button:

```jsx
<div className="std-track-move">
  <button className="std-icobtn" disabled={i === 0}
    onClick={() => moveTrack(i, -1)} aria-label={`Move ${tr.name || 'track'} up`}><ChevronUp size={14} /></button>
  <button className="std-icobtn" disabled={i === arr.length - 1}
    onClick={() => moveTrack(i, 1)} aria-label={`Move ${tr.name || 'track'} down`}><ChevronDown size={14} /></button>
</div>
```

`ChevronUp` / `ChevronDown` were already in the file's lucide import — nothing
added. The `.map()` signature changed from `(tr, i)` to `(tr, i, arr)` purely so
the down-button can test `i === arr.length - 1`.

`moveTrack` is a plain adjacent swap on a copy, with an out-of-range guard that
returns the untouched state object (so React skips the re-render entirely):

```js
function moveTrack(i, dir) {
  setTheme(t => {
    const tracks = [...(t.audio_tracks || [])];
    const j = i + dir;
    if (j < 0 || j >= tracks.length) return t;      // no-op, same reference
    [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
    return { ...t, audio_tracks: tracks };
  });
}
```

The guard is belt-and-braces — the buttons are already `disabled` at the ends —
but it means `moveTrack` is safe to call from anywhere later (drag-and-drop,
keyboard shortcuts) without re-deriving the bounds check.

Styles, exactly:
```css
.std-track-move { display:flex; flex-direction:column; gap:2px; flex-shrink:0; }
.std-track-move .std-icobtn { width:24px; height:20px; padding:0; }
.std-track-move .std-icobtn:disabled { opacity:.32; cursor:default; }
```
`20px` tall each + `2px` gap = `42px`, which is under the existing `.std-track`
row height (`11px` padding + a ~32px `<audio>`), so adding the column does not
grow the row. Disabled rather than hidden at the ends, because a button that
disappears changes the row's width and makes the list jump.

### Why order matters downstream
Two concrete consumers, both automatic once the array is reordered:

1. `Storefront.jsx` `AudioPill` plays `tracks[idx]` and advances
   `idx → (idx + 1) % tracks.length` on `ended`, so array order *is* play order.
2. `save()` in `StorefrontEditor.jsx` writes
   `audio_url: tracks[0]?.url || ''` for back-compat. Moving a track to position 1
   therefore also repoints the legacy field — no extra code.

### The index-key bug this would have shipped
Rows were `key={i}`. Now `key={tr.url || i}`.

With an index key, swapping tracks 1 and 2 leaves React looking at keys `0,1` in
positions `0,1` — unchanged. So it **reuses both DOM nodes in place and only
updates their props**, meaning each `<audio>` element keeps its identity and gets
a new `src` assigned underneath it. Concretely: preview track 2, hit ↑, and the
element that was playing track 2 is now the element for track 1 — same
`currentTime`, different song.

With `key={tr.url}` React matches by key, sees them transposed, and **moves the
DOM nodes**, so the `<audio>` travels with its track. The `|| i` fallback covers
a track row whose `url` is somehow empty.

> **Transferable:** index keys are fine for append-only lists. The moment a list
> can reorder they are a bug, and it surfaces in whatever state the DOM node owns
> rather than in props — playback position, scroll offset, focus, uncommitted
> input text. None of that is visible in the render output, which is why it's
> easy to ship.

---

## 2. The 4-track cap

```js
// src/lib/storefront.js:25
export const MAX_AUDIO_TRACKS = 4;
```

Placed next to `SITE_AUDIO_VOLUME` (note 156) so every site-music constant lives
in one spot rather than as a magic number in the editor.

Four is a product decision, not a technical limit: every track is a file you
store and serve on **every storefront visit**, so a long playlist is a hosting
bill and a slower page rather than a better page.

Enforced/communicated in three distinct places:

**a) Before the upload starts** — `onAudioAdd()`, ahead of `validateUpload`:
```js
if ((theme.audio_tracks || []).length >= MAX_AUDIO_TRACKS) {
  setErr(`Playlist is full — ${MAX_AUDIO_TRACKS} tracks max. Remove one first.`);
  if (e.target) e.target.value = '';
  return;
}
```
Ordering matters: this runs *before* `validateUpload('audio', file)` and before
`uploadAudio()`, so a rejected 5th track costs no network round trip and creates
no orphaned storage object. The `e.target.value = ''` reset is the same fix from
note 159 §Step 4 — without it, re-picking the same file fires no `change` event
and the UI looks frozen.

**b) The button counts while there's still room:**
```jsx
<Plus size={15} /> Upload track ({(theme.audio_tracks || []).length}/{MAX_AUDIO_TRACKS})
```
So it reads `Upload track (2/4)` — the limit is visible before you reach it.

**c) At the cap the button is replaced, not disabled:**
```jsx
<p className="std-note std-track-full">
  Playlist full — {MAX_AUDIO_TRACKS} tracks max. Remove one to add another.
</p>
```
styled `text-align:center; padding:11px; border:1px dashed var(--border-strong)`
so it occupies the same visual slot the button did. A disabled button invites
clicking to discover why; the sentence says what to do instead.

The modal subtitle also states it up front: *"Tracks play top to bottom, then
loop — use the arrows to set the order. Up to 4 tracks."*

**Scope, stated honestly:** `audio_tracks` lives inside `profiles.storefront_theme`,
a JSON blob the client writes, so this is a guardrail on the creator's own page,
not a security boundary. That caveat is written into the constant's comment so a
future reader doesn't mistake it for enforcement.

---

## 3. Visitor volume slider

Note 156 pinned playback to `SITE_AUDIO_VOLUME = 0.85`. Good default, bad *only*
option — visitors had play or mute and nothing between.

### The markup
`.sf-audiopill` used to be the fixed-position element. It's now a normal flex
child of a new `.sf-audiodock`, which owns the positioning:

```jsx
<div className="sf-audiodock">
  <button className="sf-audiopill" onPointerDown={markInteracted} onClick={toggle} …>
    {playing ? <Volume2 size={16} /> : <VolumeX size={16} />}
  </button>
  {canSetVolume && (
    <input className="sf-audiovol" type="range" min={0} max={1} step={0.01}
      value={volume} onChange={e => applyVolume(Number(e.target.value))}
      aria-label="Music volume" title="Music volume" />
  )}
</div>
```

`step={0.01}` because `volume` is a 0–1 float; a coarser step makes the low end
(where the perceptible difference lives) unusable.

### a) Feature-detected, not assumed
**iOS Safari ignores `volume` on media elements entirely** — it's hardware-only,
and the assignment is a silent no-op that throws nothing and warns nothing.
Rendering the slider blind would give every iPhone visitor a control that does
nothing.

There is no feature flag for this, so the probe writes and reads back
(`Storefront.jsx` lines 315–323, inside the mount effect):

```js
const startVolume = readStoredVolume();
a.volume = startVolume;
const probe = a.volume === 0.5 ? 0.4 : 0.5;   // pick a value that differs from current
a.volume = probe;
setCanSetVolume(a.volume === probe);          // did the write stick?
a.volume = startVolume;                       // restore
```

The `=== 0.5 ? 0.4 : 0.5` conditional matters: probing with a value the element
already holds would pass on *every* platform, including the ones that ignore it.
`canSetVolume` initialises to `false`, so the slider is absent until proven
supported rather than flashing in and out.

### b) The choice persists
```js
const VOLUME_KEY = 'sj-site-volume';
```
Deliberately **not** namespaced per creator — it expresses "how loud I want site
music," a property of the visitor, not of whose page they're on. Set it once and
every SkillJoy storefront respects it.

`readStoredVolume()` validates rather than trusting:
```js
const saved = parseFloat(localStorage.getItem(VOLUME_KEY));
if (Number.isFinite(saved) && saved >= 0 && saved <= 1) return saved;
```
`Number.isFinite` rejects `NaN` from a missing/garbage key, and the range check
rejects a hand-edited value — `audio.volume = 2` throws `IndexSizeError` and would
break playback entirely.

Both the read and the write are wrapped in `try/catch` because **Safari private
mode throws on `localStorage` access** rather than returning `null`. The catch
falls back to `SITE_AUDIO_VOLUME`, so the feature degrades to note 156's behaviour
instead of crashing the pill.

### c) It must not restart playback
The mount effect owns the autoplay-then-gesture-fallback logic and has to run
exactly once. If `volume` were a dependency, every slider tick would tear down
the listeners and re-run the autoplay attempt.

So live changes bypass the effect entirely — `applyVolume` writes straight to the
element:
```js
function applyVolume(v) {
  setVolume(v);                                   // for the input's value
  if (audioRef.current) audioRef.current.volume = v;   // the actual effect
  try { localStorage.setItem(VOLUME_KEY, String(v)); } catch { /* non-fatal */ }
}
```
and the effect reads its start value from the module-level `readStoredVolume()`
rather than from state — so `}, []);` is genuinely accurate, not a lie with a lint
suppression on it.

> **Detour worth recording:** the first attempt froze the initial value with
> `const initialVolume = useRef(volume).current`. React's `react-hooks/refs` rule
> rejects that — reading `.current` during render is precisely the pattern that
> makes components not update as expected. Hoisting the read into a module-level
> function fixed the rule violation *and* removed the duplicated parse logic
> between the `useState` initialiser and the effect. **A lint rule fighting you is
> usually pointing at a better shape, not an obstacle.**

### d) Interaction
```css
.sf-audiovol { width:0; opacity:0; margin-left:0;
  transition:width .22s cubic-bezier(.4,0,.2,1), opacity .18s ease, margin-left .22s ease; }
.sf-audiodock:hover .sf-audiovol,
.sf-audiodock:focus-within .sf-audiovol { width:84px; opacity:1; margin-left:10px; }
@media (hover: none) { .sf-audiodock .sf-audiovol { width:84px; opacity:1; margin-left:10px; } }
@media (prefers-reduced-motion: reduce) { .sf-audiovol { transition:none; } }
```

- `focus-within` alongside `:hover` so keyboard users can tab to it — hover-only
  reveal would make it unreachable without a mouse.
- `@media (hover: none)` shows it permanently on touch, where there is no hover
  event to trigger the reveal at all. Without this branch the slider would exist
  in the DOM on Android and be impossible to open.
- `accent-color: var(--accent)` ties the track/thumb to the creator's theme.
- Animating `width` (not `transform`) because the dock must actually reflow — a
  transformed slider would still occupy its collapsed footprint.

## Verification
`npx vite build` clean. `npx eslint` on all three files: 2 errors, both
pre-existing and untouched (`'Icon' is defined but never used` at
`StorefrontEditor.jsx:45`, and `react-hooks/set-state-in-effect` at
`Storefront.jsx:36`).

## Files
- `src/lib/storefront.js` · `src/app-pages/StorefrontEditor.jsx` ·
  `src/app-pages/Storefront.jsx`
