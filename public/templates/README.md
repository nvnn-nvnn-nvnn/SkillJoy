# Template background assets

Backgrounds shipped **with the app** and referenced by presets in
`src/lib/presets.js` as `/templates/<name>.svg`.

## Why these live here and not in Supabase storage

A preset must be usable by everyone. An **uploaded** background belongs to one
creator's storage bucket, so a preset pointing at it would hotlink their file
and bill their bandwidth for every other creator's page views. That is the same
reason `bg_image` and `bg_video` are in `THEME_PORTABLE_EXCLUDE` — a theme
export must not carry someone else's asset URL.

Files in this directory have no owner and no bill, so they are the one exception
(`isShippedAsset` in `storefront.js`). `scripts/check-presets.cjs` enforces that
a preset may only reference paths under `/templates/`, and that the file exists.

## Images

Regenerate the SVGs with:

```
node scripts/gen-backgrounds.cjs
```

SVG rather than JPG/PNG on purpose:

- **~1 KB each** instead of a few hundred — these load on every page view
- **resolution-independent** — sharp on a 5K monitor and on a phone
- **editable in a text editor** — recolour one without a design tool
- **no binary blobs in git history**

All ten together are **37 KB**. One photographic JPG would be larger than the
entire set.

To add a photo instead, drop the file in here and reference it. Keep it under
~400 KB and prefer `.webp`; it is downloaded before the page settles.

## Videos

None shipped yet. To add one:

1. Put `yourname.mp4` in this directory. **Hard limit: 3 MB** — the checker
   fails the build above that. Aim for a 5–10 second seamless loop, 1280×720,
   no audio track.
   ```
   ffmpeg -i source.mp4 -t 8 -an -vf scale=1280:-2 -c:v libx264 -crf 30 \
     -movflags +faststart public/templates/yourname.mp4
   ```
2. Export a still frame as the poster — this is **required**, not optional:
   ```
   ffmpeg -i public/templates/yourname.mp4 -vframes 1 public/templates/yourname.jpg
   ```
3. Add the preset:
   ```js
   { id: 'yourid', name: 'Your Name', emoji: '🎬', category: 'scenic',
     blurb: 'One line: who is this for.',
     theme: { ...BASE, mode: 'dark', bg: 'video',
       bg_video: '/templates/yourname.mp4',
       bg_image: '/templates/yourname.jpg',   // poster — required
       accent: '#7DD3FC',
       card_opacity: 62, card_blur: 18 } },
   ```
4. `npm run check:presets`

### The poster is required for three reasons

A background video renders **nothing** before it loads, nothing on a connection
that never finishes loading it, and nothing under `prefers-reduced-motion`
(where `.sf-bgvideo` is hidden outright). The poster is what the page falls back
to in all three cases, so a video template degrades to its own still rather than
to a blank colour.

### Think hard before shipping video

Every visitor downloads it on whatever connection they have, it drains battery,
and it moves Largest Contentful Paint. Most "video" looks are achievable with a
mesh-gradient SVG at 1 KB. Ship video when the motion is the point.

## Readability

Text sitting directly on artwork is the fastest way to make a page unreadable.
Every scenic preset uses glassy cards (`card_opacity` 58–82 with `card_blur`)
so the background stays decorative. The checker warns above `card_opacity: 88`
over an image.

---

## Music

None shipped yet. Presets may carry music under the **same ownership rule as
images**: shipped only, never an upload. `audio_tracks` is normally stripped
from portable themes because uploaded music belongs to whoever uploaded it — a
track in this directory has no owner, so it travels with the template.

To add one:

1. Trim to a seamless loop and encode. **Hard limit: 2 MB** — this autoplays on
   arrival, so it is downloaded like everything else:
   ```
   ffmpeg -i source.mp3 -t 90 -b:a 112k public/templates/yourtrack.mp3
   ```
2. Reference it in the preset. Both keys, not one:
   ```js
   audio_tracks: [{ url: '/templates/yourtrack.mp3', name: 'Your Track' }],
   audio_url: '/templates/yourtrack.mp3',   // deprecated single-track field,
                                            // still read by some surfaces
   ```
3. `npm run check:presets`

The checker rejects any track outside `/templates/`, any missing file, anything
over 2 MB, and warns when `audio_url` is out of sync or a track has no name.

### Licensing

A track in a preset gets copied onto every page that applies it. That is
**redistribution**, not personal use. Only ship music you own outright or that
carries an explicit licence permitting it — CC0 is the safe bar. This becomes a
hard requirement with attestation when the public gallery lands (plan 05 §5).

---

## Motion backgrounds need no files at all

Before reaching for video, look at `bg: 'animated'`. Five motions (`aurora`,
`drift`, `pulse`, `nebula`, `sweep`) driven by two colours, rendered as CSS
gradient layers. **Zero bytes, no decode, no bandwidth per visitor** — and they
honour `prefers-reduced-motion` by freezing into a static gradient.

"Video background" is usually a request for *motion*, not for footage. Ship
video only when the footage itself is the point.
