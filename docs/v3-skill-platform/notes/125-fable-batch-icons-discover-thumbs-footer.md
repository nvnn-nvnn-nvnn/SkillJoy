# 125 — Fable batch: social icons, admin-only Discover, product thumbnails, marketing-only footer

Date: 2026-07-12. Four collision-free tasks run alongside Opus's storefront work
(Storefront.jsx / StorefrontEditor.jsx / DEFAULT_THEME untouched per constraints).

## 1. More social icons

- `src/lib/brandIcons.jsx` — added simple-icons-style `d` paths (24×24, currentColor)
  for **bluesky, snapchat, onlyfans, roblox, bitcoin, ethereum**. Paths were inlined
  from memory since `simple-icons` isn't an npm dependency; if any mark looks off at
  larger sizes, swap the `d` string from https://simpleicons.org.
- `src/lib/storefront.js` — added the six matching `SOCIAL_TYPES` entries (inserted
  between `x` and `website`; only the array touched, DEFAULT_THEME untouched).
  Picker emojis: 🦋 👻 🔵 🎮 ₿ Ξ.

## 2. Discover nav → admins only

- `src/components/Header.jsx` — the Discover `NavItem` in the Grow group is now
  wrapped in `{isAdmin && (...)}` (same gate as the Admin item:
  `user.email === 'techkage@proton.me'`). The `/discover` route itself still exists —
  only the nav entry is hidden.

## 3. Product thumbnails on the Products dashboard

- `src/app-pages/ServicesDashboard.jsx`:
  - `cover_url` was already in `SKILL_COLS` (src/lib/skills.js) — no query change needed.
  - View-model gains `cover: s.cover_url || null`.
  - Card title is now a `.sv-title-row`: 48px rounded `.sv-thumb` image
    (object-fit cover, `var(--border)` / `var(--surface-alt)`) or a 🖼️ placeholder
    div when there's no cover. Theme vars only.

## 4. Footer only on marketing pages

- `src/components/Footer.jsx` — replaced the `/chat` + `/onboarding` blacklist with a
  whitelist: renders **only** when pathname is exactly one of
  `/`, `/about`, `/contact`, `/how-it-works`, `/terms`, `/privacy`, `/refund-policy`.
  Everything else (app pages, `/@handle` storefronts, product pages, checkout,
  dashboard, etc.) gets no marketing footer.

## Build

`npm run build` clean (only the pre-existing >500 kB chunk-size warning).
No migrations.
