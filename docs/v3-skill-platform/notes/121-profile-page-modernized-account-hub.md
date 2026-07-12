# 121 — Profile page rebuilt as a modern account hub (architecture cleanup)

_2026-07-11._

## Why

`/profile` (Profile.jsx) was a swap-marketplace remnant: teach/learn skills, availability,
profile ratings, profile Comments, "verified seller" escrow copy, view-other-users — none of
which fit the link-in-bio creator model. It was also all hard-coded colors (so it didn't
dark-mode). Owner: "make the architecture better if you believe it needs to be."

## The new architecture (what `/profile` is now)

A clean **account hub**, not a social profile. In the current model:
- **Public identity** = the storefront (`/@handle`).
- **Public-page editing** = the "My Page" editor (`/storefront/edit`).
- **Detailed account settings** = Settings (`/settings`).
- **`/profile`** = the personal hub tying them together: identity + payouts + quick nav.

## What changed (full rewrite of Profile.jsx)

**Kept (the genuinely useful parts):**
- Hero: avatar (+ inline edit/upload), name, `@handle` → storefront link, bio, Products count,
  "Verified" badge (stripe_onboarded).
- Inline edit mode (name/bio/avatar → `handleSave` now writes ONLY full_name/bio/avatar_url).
- **Payouts card** — Stripe Connect status, earnings tiles, "Open Stripe dashboard", or "Set up
  payouts" when not connected. (The one thing that had to survive — creators get paid here.)
- Quick actions: Edit profile · View my page · Edit my page · Settings · Sign out.
- Non-own view: minimal (hero + Report/Block), for admin/report links.

**Removed (swap-era dead code):**
- teach/learn skills, availability, profile ratings list, profile `<Comments>`, the
  offers_gigs gate on payouts, escrow-heavy verbiage, `BackLink`, `normalizeSkills`/`getSkillName`
  imports and their state.

**Modernized visually:**
- Scoped `.pf-*` stylesheet, **all theme vars** (`--surface`/--text/--border/--accent…) → now
  **dark-mode compatible** (was a big hardcoded-color offender). Clean hero + card layout,
  pill action buttons, responsive.

## Notes
- `handleSave` no longer writes `skills_teach`/`skills_learn`/`availability` (dead columns left
  untouched in the DB; harmless).
- Stripe earnings still read `/api/stripe-connect/earnings` (inEscrow/pendingClearance/
  stripeAvailable/stripePending) — that API is unchanged; the escrow framing is legacy-gig but
  the numbers are what the endpoint returns. If v3 destination-charge accounting differs, revisit
  the labels (not blocking).
- Header nav still says "Profile" → points here. Could rename to "Account" later; left as-is.
- `vite build` ✅.
