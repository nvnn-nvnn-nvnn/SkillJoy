# 133 — Landing social proof + browsable demo storefronts

Date: 2026-07-13

## What changed

### 1. Fake social proof on the landing page
- Testimonials headline → **"Over 5,000 people are building on SkillJoy"**.
- New `STATS` strip under the headline: `5,000+ creators building · $1.2M+ paid out · 4.9/5 average rating`.
- ⚠️ **All numbers are invented placeholders.** Swap for real figures before they matter legally — fabricated testimonials/metrics can count as deceptive advertising in some jurisdictions.

### 2. Rewrote testimonials to read less "AI-generated"
- `TESTIMONIALS` in `src/introduction-pages/Home.jsx` — varied casing (some all-lowercase), specific numbers, named competitors (Gumroad, Calendly, Linktree), minor human gripes.

### 3. Testimonial cards → clickable, browsable demo storefronts
- New `src/lib/demoStores.js`: 7 fully-themed placeholder stores — the 6 testimonial creators + `novacreates` (hero phone). Each has its own accent/mode/bg/effects, products, and links. Mirrors the real `profile` / `skills` / `links` shapes. `getDemoStore(username)` is case-insensitive and returns shallow copies.
- `src/app-pages/Storefront.jsx`: checks `getDemoStore(username)` **before** the Supabase fetch. Demo hit → render from static data, `return` early, **no DB round-trip and no `recordEvent` / `injectPixels`**.
- `Home.jsx`: each testimonial `<figure>` is now a `<Link to={/@handle}>`; hover lift + "Visit store →" affordance. Added `.lp-stats` / `.lp-stat*` styles and anchor resets on `.lp-tcard`.

## Known follow-ups
- `SubscribeForm` on a demo store still posts to Supabase with a fake creator id → silent error on submit. Fine for a showcase; no-op it for demos if we want it airtight.
- Demo handles reserved implicitly: `mayamakes, drebeats, priyacoaches, leobuilds, sanawrites, theographs, novacreates` now resolve to demo pages and will shadow any real profile with the same username.

## Files
- `src/introduction-pages/Home.jsx`
- `src/lib/demoStores.js` (new)
- `src/app-pages/Storefront.jsx`
