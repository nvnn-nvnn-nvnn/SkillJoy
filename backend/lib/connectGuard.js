const supabase = require('../config/supabase');

// ── Stale connected-account handling (v3) ───────────────────────────────────
// A creator's stripe_account_id can become invalid — deauthorized, deleted, or
// (most often in dev) created under a DIFFERENT platform key than the one now in
// use. The DB still says onboarded=true, so the guard passes, but the destination
// charge then fails at Stripe with resource_missing on transfer_data[destination].

/** True if `err` means the transfer destination account is gone/inaccessible. */
function isStaleDestinationError(err) {
    if (!err) return false;
    const code = err.code || err.raw?.code;
    const param = err.param || err.raw?.param;
    const msg = err.message || '';
    return (code === 'resource_missing' && param === 'transfer_data[destination]')
        || /No such destination|does not have access to account/i.test(msg);
}

/** Self-heal: clear the creator's Stripe fields so checkout short-circuits at the
 *  onboarded guard next time and they're prompted to reconnect. Mirrors /status. */
async function clearStaleAccount(creatorId) {
    try {
        await supabase.from('profiles')
            .update({ stripe_account_id: null, stripe_onboarded: false })
            .eq('id', creatorId);
        console.warn(`⚠️ Cleared stale Stripe account for creator ${creatorId}`);
    } catch (e) {
        console.warn('clearStaleAccount failed:', e.message);
    }
}

module.exports = { isStaleDestinationError, clearStaleAccount };
