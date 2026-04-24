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

module.exports = {
    SERVICE_FEE_FLAT,
    SERVICE_FEE_CENTS,
    feeCents,
    feeDollars,
    feeCentsFromTotal,
    feeDollarsFromTotal,
};
