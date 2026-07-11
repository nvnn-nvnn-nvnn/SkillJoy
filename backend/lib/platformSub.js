const supabase = require('../config/supabase');

// ═══════════════════════════════════════════════════════════════════════════
// PLATFORM SUBSCRIPTION — a creator paying SkillJoy (direct charge on
// SkillJoy's own Stripe account). Completely separate from creator memberships
// (kind:'skill_sub'), which are fans paying creators via Connect destination
// charges. Metadata tag everywhere: kind:'platform_sub'.
// ═══════════════════════════════════════════════════════════════════════════

const LIVE_STATUSES = ['trialing', 'active'];

// Master switch for the whole paywall. The platform sub can't function without
// a Stripe platform Price, so its absence IS the "paywall not live yet" signal.
// While false, all enforcement (checkout/guest/publish gates) no-ops and the
// app behaves exactly as it did pre-paywall. Mirrors the DB-side deferral in
// migration 022 — both flip on together when Stripe is configured + 023 runs.
function paywallEnabled() {
    return !!process.env.STRIPE_PLATFORM_PRICE_ID;
}

/** The creator's platform_subscriptions row, or null. */
async function getPlatformSub(userId) {
    const { data } = await supabase
        .from('platform_subscriptions')
        .select('user_id, stripe_customer_id, stripe_subscription_id, status, trial_ends_at, current_period_end')
        .eq('user_id', userId)
        .maybeSingle();
    return data ?? null;
}

/** True while the creator's storefront may be live (trialing|active). */
async function isPlatformLive(userId) {
    const sub = await getPlatformSub(userId);
    return !!sub && LIVE_STATUSES.includes(sub.status);
}

// ── Isolation guard ──────────────────────────────────────────────────────────
// Regression assertion: the platform-sub path must NEVER carry Connect params.
// Every Stripe call in the platform billing path runs its params through this
// first — if transfer_data/destination/application_fee ever sneak in, we throw
// before touching Stripe rather than mis-charging a creator's Connect account.
const FORBIDDEN_KEYS = ['transfer_data', 'destination', 'application_fee_amount', 'application_fee_percent', 'on_behalf_of'];

function assertNoConnectParams(params, path = 'params') {
    if (!params || typeof params !== 'object') return params;
    for (const [key, value] of Object.entries(params)) {
        if (FORBIDDEN_KEYS.includes(key)) {
            throw new Error(`PLATFORM-SUB ISOLATION VIOLATION: '${path}.${key}' is a Connect param and must never appear on a platform subscription.`);
        }
        if (value && typeof value === 'object') assertNoConnectParams(value, `${path}.${key}`);
    }
    return params;
}

module.exports = { getPlatformSub, isPlatformLive, assertNoConnectParams, paywallEnabled, LIVE_STATUSES };
