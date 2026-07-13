# 131 — Landing page rebuild (Stan/Sellfy-style scroll page)

_2026-07-13. `src/introduction-pages/Home.jsx` fully rewritten._

## Why
The old page was decent but (a) said **"$0 / no monthly fees"** — now FALSE (there's a $19/mo
paywall), and (b) sold "skills," not the actual differentiator (deep guns.lol customization).
Owner also wanted a Stan/Sellfy scroll experience.

## New structure (owner's flow)
Intro (hero) → **Testimonials** → How it works → What it has (sell grid + customization dark band)
→ **Try free 14 days** (pricing) → final CTA.

## Scroll experience ("parallax-ish")
- `.reveal` elements fade + slide up as they enter the viewport, via **IntersectionObserver**
  (no scroll-listener jank), staggered with `.reveal-d1/2/3`. Falls back to visible if IO
  unsupported; respects `prefers-reduced-motion`.
- Hero has a radial accent glow + the floating phone mockup (now a DARK, glowing store to show off
  the customization). Not literal multi-layer parallax — reveal + float reads as the same dynamic
  scroll feel without the jank. (Can add true parallax layers later if wanted.)

## Pricing — now ACCURATE
Fixed the false "$0 fees." Pricing card: **$19/mo**, 14-day trial starts at publish, "keep 95% of
every sale" (frames the 5% `SKILL_PLATFORM_FEE_BPS`), cancel anytime. Apple/Google Pay,
customization, analytics, Stripe payouts as bullets.

## OWNER TO DO
- **Swap the placeholder testimonials** — the `TESTIMONIALS` array at the top of Home.jsx (clearly
  marked) has 6 placeholder creators; replace name/handle/avatar/role/quote with the real/fake
  account data. Avatars are emoji now; can be image URLs.
- **Verify the pricing copy** — `$19/mo` + "keep 95%" (5% fee). Confirm those are the numbers you
  want shown publicly before promoting; adjust the pricing section if not.

`vite build` ✅.
