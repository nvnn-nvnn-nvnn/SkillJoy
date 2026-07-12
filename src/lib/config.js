// ── SkillJoy v3 feature flags ───────────────────────────────────────────────
// Central switches for the v3 "Skill platform" rebrand.
// See docs/v3-skill-platform/07-roadmap-and-implementation.md (Phase 0).

// LEGACY_MODE re-enables the v1 campus surfaces — skill swaps, matches, gigs,
// escrow orders, disputes, and the `.edu` verification gate. Default OFF: v3 is
// the Skill-platform storefront. Wrapped, never deleted — flip this on to get
// the old app back. Toggle with `VITE_LEGACY_MODE=true`.
export const LEGACY_MODE = import.meta.env.VITE_LEGACY_MODE === 'true';

// Platform fee on Skill sales, in basis points (500 = 5%). Display/estimate
// only — the authoritative fee lives in backend/config/fees.js and is applied
// server-side at checkout.
export const SKILL_PLATFORM_FEE_BPS = 500;

/** Estimated platform fee (in cents) for a given Skill price, for UI display. */
export function estimateSkillFeeCents(priceCents) {
  return Math.round((priceCents * SKILL_PLATFORM_FEE_BPS) / 10000);
}

// Current Terms-of-Service version. Recorded on profiles.tos_version when a
// user accepts at onboarding (proof of consent — migration 025). Bump this
// when the ToS text materially changes; NOTE: re-acceptance prompting for
// existing users on a version bump is not implemented yet.
export const TOS_VERSION = '2026-07-11';
