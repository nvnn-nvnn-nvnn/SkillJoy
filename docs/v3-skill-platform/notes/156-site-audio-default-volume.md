# 156 — Site music defaults to 85% volume

Date: 2026-08-20

## What changed
Creator-chosen site music now plays at **0.85** instead of 1.0. A page a visitor didn't ask to
make noise shouldn't arrive at full blast.

New `SITE_AUDIO_VOLUME = 0.85`, exported from `src/lib/storefront.js` rather than living next to
the player, because **two** elements play creator audio and they must agree:

1. `AudioPill` in `Storefront.jsx` — the live page.
2. The track-preview `<audio controls>` in the editor's music modal. If this one stayed at 1.0 a
   creator would audition their playlist louder than visitors hear it and pick the wrong master
   level. Native controls still override it per-listen.

This trims the *page*, not the creator — their file's own mastering still sets perceived loudness.

## The part that would have failed silently
`volume` is **a DOM property, not an HTML attribute**. `<audio volume={0.85}>` in JSX is passed
through as an unknown attribute, dropped, and the element stays at 1.0 — no warning, no error,
and it looks correct in the source. It has to be assigned to the element:

```js
a.volume = SITE_AUDIO_VOLUME;              // AudioPill, in the mount effect
ref={el => { if (el) el.volume = SITE_AUDIO_VOLUME; }}   // editor preview
```

In `AudioPill` the assignment goes **before** the `a.play()` in that same effect, or the first
moment of the first track escapes at full volume before the value lands.

The property **survives `src` changes**, so setting it once on mount also covers every later
track in a multi-track playlist — no need to reapply in the `idx` effect.

**Transferable:** media element state (`volume`, `muted`, `playbackRate`, `currentTime`) is
property-only. React will happily render any of them as attributes and silently do nothing.
Anything you set on a media element belongs in a ref/effect.

## Files
- `src/lib/storefront.js` (new export) · `src/app-pages/Storefront.jsx` ·
  `src/app-pages/StorefrontEditor.jsx`
