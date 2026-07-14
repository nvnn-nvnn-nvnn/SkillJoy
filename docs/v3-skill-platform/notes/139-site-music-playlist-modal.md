# 139 — Site music: multi-track playlist + modal

Date: 2026-07-13

## What the user wanted
"A second modal when accessing site music, that contains the tracks put in, so the user can
visually see the music submitted." Confirmed via a scope question: **multiple tracks + playlist**
(not a single-track preview).

## Model change: single URL → playlist
- `DEFAULT_THEME.audio_tracks: []` (array of `{ url, name }`) is now the source of truth.
- `audio_url` kept as a **deprecated** field, synced to `audio_tracks[0].url` on save for back-compat.
- `resolveTheme()` migrates automatically: a stored legacy `audio_url` with no `audio_tracks`
  becomes a one-item playlist (`trackNameFromUrl()` derives a label from the file name). So old
  storefronts keep working with zero data migration.

## Storefront playback (`Storefront.jsx` → `AudioPill`)
Was a single looping `<audio>`. Now a playlist:
- `single = tracks.length <= 1` → uses the `loop` attribute (unchanged behavior for one track).
- Multi-track → `onEnded` advances `idx = (idx+1) % length`; an effect on `idx` resumes `play()`
  on the new src. A `didMount` ref skips the initial mount so we don't fight the existing
  autoplay/first-gesture logic. **Gotcha handled:** wrap-around sets `idx` back to `0`, so the
  resume guard is "skip first mount", NOT "idx > 0" (which would stall the loop on the first track).
- Pill `title` shows the current track name. Autoplay/gesture/StrictMode-safe logic preserved.

## Editor (`StorefrontEditor.jsx`)
- **General panel:** the Site-music upload control is now a **button** showing the track count
  ("3 tracks" / "Add music") that opens a modal.
- **New modal** (`musicOpen` state): lists every track with an index badge, its name, and a native
  `<audio controls preload="none">` mini-player so the creator can *see and hear* each submission;
  per-track remove (X); an "Upload track" button that **appends** (input value reset so the same
  file can be re-added); backdrop click / X to close. Non-destructive — applies on Save.
- `onAudio` (set single url) replaced by `onAudioAdd` (append `{url, name:filenameWithoutExt}`) +
  `removeTrack(i)`. `save()` builds `themeToSave` syncing `audio_url = tracks[0]?.url || ''`.
- Live preview shows the audio pill when `audio_tracks.length > 0`.
- New CSS: `.std-musicbtn*`, `.std-modal*` (backdrop + card, reuses `stdDrop` keyframe),
  `.std-tracklist`, `.std-track*`.

## Files
- `src/lib/storefront.js` — audio_tracks default, resolveTheme migration, trackNameFromUrl.
- `src/app-pages/Storefront.jsx` — AudioPill playlist player.
- `src/app-pages/StorefrontEditor.jsx` — music button, modal, append/remove handlers, save sync.

## Follow-ups
- No drag-reorder of tracks yet (upload order = play order; remove + re-add to reorder).
- Storage: each track is a separate upload in the audio bucket; no per-creator track cap enforced.
