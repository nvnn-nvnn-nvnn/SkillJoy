// ── Shared fee constants ───────────────────────────────────────────────────
// Keep SERVICE_FEE_PERCENT in sync with VITE_SERVICE_FEE_PERCENT (frontend).
const SERVICE_FEE_PERCENT = 0.04; // 4% of gig base price

// Fee in cents, computed from the seller's base price (gig.price).
function feeCents(baseDollars) {
    return Math.round(parseFloat(baseDollars || 0) * 100 * SERVICE_FEE_PERCENT);
}

// Fee in dollars, computed from the seller's base price.
function feeDollars(baseDollars) {
    return feeCents(baseDollars) / 100;
}

// Fee in cents, extracted from a total the buyer paid (payment_amount).
// payment_amount = base + base*percent = base*(1+percent)
// so fee = payment_amount - payment_amount / (1+percent)
function feeCentsFromTotal(totalDollars) {
    const totalCents = Math.round(parseFloat(totalDollars || 0) * 100);
    const baseCents = Math.round(totalCents / (1 + SERVICE_FEE_PERCENT));
    return totalCents - baseCents;
}

function feeDollarsFromTotal(totalDollars) {
    return feeCentsFromTotal(totalDollars) / 100;
}

module.exports = {
    SERVICE_FEE_PERCENT,
    feeCents,
    feeDollars,
    feeCentsFromTotal,
    feeDollarsFromTotal,
};
