// ── Shared fee constants ───────────────────────────────────────────────────
// Keep SERVICE_FEE_FLAT in sync with VITE_SERVICE_FEE (frontend).
const SERVICE_FEE_FLAT = 3.50; // flat $3.50 per transaction
const SERVICE_FEE_CENTS = 350;

// Fee in cents — flat regardless of gig price.
function feeCents(_baseDollars) {
    return SERVICE_FEE_CENTS;
}

// Fee in dollars — flat regardless of gig price.
function feeDollars(_baseDollars) {
    return SERVICE_FEE_FLAT;
}

// Fee in cents from total (buyer paid base + flat fee).
function feeCentsFromTotal(_totalDollars) {
    return SERVICE_FEE_CENTS;
}

function feeDollarsFromTotal(_totalDollars) {
    return SERVICE_FEE_FLAT;
}

// ── v3 Skill-platform fee ───────────────────────────────────────────────────
// Skills are commodity digital goods sold many times → a percentage fits better
// than the flat $3.50 services/escrow fee above. Applied server-side at checkout
// as the Stripe `application_fee_amount` on a destination charge.
// Keep in sync with SKILL_PLATFORM_FEE_BPS in src/lib/config.js (display).
const SKILL_PLATFORM_FEE_BPS = 500; // 5%

// Platform fee in cents for a given Skill price (in cents).
function skillFeeCents(priceCents) {
    return Math.round((priceCents * SKILL_PLATFORM_FEE_BPS) / 10000);
}

module.exports = {
    SERVICE_FEE_FLAT,
    SERVICE_FEE_CENTS,
    feeCents,
    feeDollars,
    feeCentsFromTotal,
    feeDollarsFromTotal,
    SKILL_PLATFORM_FEE_BPS,
    skillFeeCents,
};
