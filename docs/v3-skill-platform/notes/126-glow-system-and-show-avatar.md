# 125 — Master glow system + show/hide avatar (Opus side of the UI batch)

_2026-07-11. Opus owns Storefront.jsx + StorefrontEditor.jsx + DEFAULT_THEME; Fable ran the
isolated files (icons/discover/thumbnails/footer) in parallel — merged clean via the file-
ownership split._

## Master glow (`glow_intensity`) — the "vibrant, everything glows" guns.lol look

- **DEFAULT_THEME**: `glow_intensity: 0` (0–40 px accent glow).
- **Storefront.jsx wrapStyle**: `--sf-glow` = `{n}px`, `--sf-glow-strong` = `{n*1.6}px`.
- Applied ADDITIVELY (invisible at 0, no conditional needed):
  - `.sf-name` → `filter: drop-shadow(0 0 var(--sf-glow) accent 85%)` (filter, so it coexists with
    the bg-image readability text-shadow + the animated-name text-shadow).
  - `.sf-avatar` / `.sf-panel` → extra `box-shadow` glow term (accent 60% / 42%) appended to the
    existing shadow.
  - `.sf-linkbtn` → resting + hover `box-shadow` glow term.
  - (Social icons already glow; product cards keep their own product_glow.)
- **Editor**: "Glow intensity" Slider (0–40) at the top of Animations & Effects.
- **Preview**: `--lp-glow`/`--lp-glow-strong` (scaled 0.6/1.0 for the smaller canvas), mirrored on
  `.lp-inner`/`.lp-avatar`/`.lp-name`/`.lp-linkbtn`.

Why additive box-shadow/filter terms: box-shadow doesn't stack across rules, so instead of a
separate glow rule (which would clobber existing shadows) each element's shadow gets a glow term
appended, gated by the px value being 0 at rest.

## Show / hide profile picture (`show_avatar`)

- **DEFAULT_THEME**: `show_avatar: true`.
- **Storefront.jsx**: `.sf-avatar` only renders when `theme.show_avatar !== false`.
- **Editor**: a "Show profile picture" Toggle in the Profile panel; the size Slider is hidden when
  the avatar is off. Preview mirrors (hides `.lp-avatar`).

## Fable's parallel merge (their note covers detail)
storefront.js SOCIAL_TYPES += bluesky/snapchat/onlyfans/roblox/bitcoin/ethereum (brandIcons.jsx
paths) · Header Discover gated to admin + my Analytics nav item · ServicesDashboard product cards
now show `cover_url` thumbnails · Footer shows only on marketing paths. All merged with no conflict
because Fable touched only SOCIAL_TYPES in storefront.js (not DEFAULT_THEME) and never
Storefront/StorefrontEditor.

`vite build` ✅ (merged state).

## STILL MINE — remaining Opus work (next)
- **Link-placement UX** — links + products read as one confusing blob; the editor's "Storefront ▾"
  dropdown is too complex and the link editor is buried. Plan: keep links visually inside the
  profile space, surface the link editor prominently (not behind the dropdown), simplify the top
  nav. Owner confirmed current link ORDERING is fine.
- **Remove-button placement** — tidy `.std-removebtn` alignment in the editor.
- **Product grouping** — group products with titles ("Start here", "Bookings", "Digital products")
  + order groups. Full feature: migration (`skills.group_label`), builder input, storefront render
  grouped-by-label with headings, editor group assignment. (Owner wanted this; kept on Opus since
  its render lives in Storefront.jsx.)
