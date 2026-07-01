# 57 — De-campus pass: pivot the active surfaces to the creator platform

Stripped the leftover v1 campus (swap / gig / college) framing from the surfaces
that actually render in the pivoted app. The product name **SkillJoy stays** —
only the campus *concepts* were removed in favor of the creator-storefront pivot.

## Profile (`src/app-pages/Profile.jsx`)
- Removed the **college / .edu verification** block (banner, send + disconnect
  handlers, state, and the disconnect modal).
- Stats: dropped Points / Swaps / Gigs → now **Skills** (published count via
  `listPublishedSkills`) + rating ("reviews").
- Removed the legacy **gigs grid** + `loadGigs` (queried the `gigs` table) →
  replaced with a **Storefront** card (public link + "Manage services" / "Set up
  storefront").
- "Can Teach" → **Expertise**; removed "Wants to Learn". `handleSave` no longer
  requires teach/learn skills (name only).

## Onboarding (`src/app-pages/auth/Onboarding.jsx`)
- Cut from 4 steps to **2**: *About You* + *Availability*. Removed the Teach /
  Learn skill steps and the swap/gigs/both **service-type** selector.
- Save upserts name/username/bio/availability only (no skills_teach/learn/
  service_type). Copy: "set up your storefront", "Save & start building".

## Settings (`src/app-pages/Settings.jsx`)
- "Gig Settings" → **Selling**; "Offer gig services" → "Enable selling" (still
  writes `offers_gigs`). Pause notification reworded.
- Notification labels reframed ("New sales", "Booking requests"). **DB keys
  unchanged** (`swapRequests`, `gigRequests`) so stored prefs aren't orphaned.

## Marketing
- `HowItWorks.jsx` — rewritten to creator steps (claim link → build Skill →
  publish → get paid → grow); escrow/"Skill Swaps" sections replaced with a
  Stripe payments/payouts note. CTAs → `/login`, `/about`.
- `About.jsx` — content rewritten (kept the CSS/classes): "Everything you sell.
  One link." Two value props (Sell what you know / Run your whole business),
  reframed origin story, CTAs → `/login`, `/how-it-works`, `/contact`.
- `Footer.jsx` — already pivoted (non-legacy branch); left as-is.

## Left intentionally
- LEGACY_MODE-only pages/components (Gigs, Swaps, Matches, Chat, MyListings,
  Swapmodal, Matchcard, GigModalInfo, Usercard, etc.) — they don't render in the
  pivot, so not worth touching. Still parked behind the flag.
- `offers_gigs` column + `swapRequests`/`gigRequests` pref keys kept for data
  compatibility; only the labels changed.

Lint clean (one pre-existing Settings effect-dep warning), `vite build` green.
