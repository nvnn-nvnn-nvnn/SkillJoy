const supabase = require('../config/supabase');
const { sendEmail, getUserEmail, purchaseThankYou } = require('./email');
const { fireAutomation } = require('./webhookout');

// ═══════════════════════════════════════════════════════════════════════════
// SKILL FULFILMENT — turn a succeeded logged-in PaymentIntent into a purchase.
//
// Two callers race for every sale:
//   1. POST /api/webhooks/stripe   — Stripe's `payment_intent.succeeded`
//   2. POST /api/checkout/:id/confirm — the client's fast-path, fired the moment
//      stripe.confirmPayment() resolves (almost always WINS, by seconds)
//
// Both call this one function, so whichever wins does the complete job. That is
// the whole point: side effects must never live in only one of the two paths.
//
// Idempotency uses `purchases.fulfilled_at`, NOT `status`. `status` marks access
// and both callers write it, so guarding on it lets the loser skip the effects
// while the winner never ran them. `fulfilled_at` is claimed by a single
// `UPDATE … WHERE fulfilled_at IS NULL RETURNING id`, which Postgres serialises
// per-row: the second caller re-evaluates the predicate after the first commits,
// no longer matches, and gets 0 rows back. Exactly-once, no locks, no retries.
// ═══════════════════════════════════════════════════════════════════════════

// Atomically claim the right to fulfil one buyer+skill row.
// Returns the claimed row id, or null if someone else already claimed it.
async function claim(buyerId, skillId, paymentId) {
    const { data, error } = await supabase
        .from('purchases')
        .update({ status: 'paid', stripe_payment_id: paymentId, fulfilled_at: new Date().toISOString() })
        .eq('buyer_id', buyerId).eq('skill_id', skillId)
        .is('fulfilled_at', null)          // ← the claim; see header
        .select('id');
    if (error) throw error;
    return data?.length ? data[0].id : null;
}

// Distinguish "already fulfilled" (fine, stay quiet) from "no row at all"
// (a real problem — the pending row should have been written at intent time).
async function explainMissedClaim(buyerId, skillId, label) {
    const { data } = await supabase
        .from('purchases').select('fulfilled_at')
        .eq('buyer_id', buyerId).eq('skill_id', skillId).maybeSingle();
    if (!data) console.warn(`⚠️ ${label}: no purchase row (buyer ${buyerId}, skill ${skillId})`);
    else console.log(`↩️ ${label}: already fulfilled at ${data.fulfilled_at} — skipping side effects`);
}

async function fulfillSkillPurchase(pi) {
    const m = pi.metadata || {};
    if (m.kind !== 'skill') return;

    const skillId = m.skill_id;
    const buyerId = m.buyer_id;
    if (!skillId || !buyerId) { console.warn('skill fulfil: missing skill_id/buyer_id'); return; }

    // ── Main product ────────────────────────────────────────────────────────
    const claimed = await claim(buyerId, skillId, pi.id);
    if (!claimed) {
        await explainMissedClaim(buyerId, skillId, 'skill fulfil');
    } else {
        const { data: skill } = await supabase
            .from('skills').select('title, creator_id, confirmation_message').eq('id', skillId).single();

        // Notify the creator of the sale.
        if (skill?.creator_id) {
            await supabase.from('notifications').insert({
                user_id: skill.creator_id,
                type: 'skill_purchase',
                title: 'New sale! 🎉',
                message: `Someone just bought "${skill.title ?? 'your Skill'}".`,
                related_id: skillId, related_type: null,
            });
        }

        // Count a promo-code redemption, if one was used.
        if (m.code && skill?.creator_id) {
            const { data: d } = await supabase.from('discounts')
                .select('id, times_redeemed').eq('creator_id', skill.creator_id).ilike('code', m.code).maybeSingle();
            if (d) await supabase.from('discounts').update({ times_redeemed: d.times_redeemed + 1 }).eq('id', d.id);
        }

        // Best-effort thank-you / receipt to the buyer. A dead mailbox must not
        // roll back a completed sale, so this stays inside its own try.
        try {
            const email = await getUserEmail(buyerId);
            if (email) {
                const bumpAmount = parseInt(m.bump_amount || '0', 10) || 0;
                const { subject, html } = purchaseThankYou({
                    title: skill?.title ?? 'your purchase',
                    amountCents: Math.max(0, pi.amount - bumpAmount),
                    note: skill?.confirmation_message || '',
                    accessUrl: `${process.env.FRONTEND_URL}/locker/${skillId}`,
                    accessLabel: 'Open in Locker',
                });
                await sendEmail({ to: email, subject, html });
            }
        } catch (e) { console.warn('receipt email failed:', e.message); }

        // Outbound automation webhook (Zapier/Make/AutoDM).
        if (skill?.creator_id) fireAutomation(skill.creator_id, 'sale', {
            skill_id: skillId, title: skill.title, amount: pi.amount / 100, kind: 'onetime',
        });

        console.log(`✅ Skill purchase fulfilled (skill ${skillId}, buyer ${buyerId})`);
    }

    // ── Order bump: the add-on product that rode this same payment ──────────
    // Claimed separately — the buyer may own one already, and a partial failure
    // above must not cost them the add-on.
    const bumpSkillId = m.bump_skill_id;
    if (bumpSkillId) {
        const bumpClaimed = await claim(buyerId, bumpSkillId, pi.id);
        if (!bumpClaimed) {
            await explainMissedClaim(buyerId, bumpSkillId, 'bump fulfil');
        } else {
            const { data: bumpSkill } = await supabase
                .from('skills').select('title, creator_id').eq('id', bumpSkillId).single();
            if (bumpSkill?.creator_id) {
                await supabase.from('notifications').insert({
                    user_id: bumpSkill.creator_id,
                    type: 'skill_purchase',
                    title: 'Order bump sold! 🎉',
                    message: `Your add-on "${bumpSkill.title ?? 'product'}" sold alongside another purchase.`,
                    related_id: bumpSkillId, related_type: null,
                });
            }
            console.log(`✅ Order bump fulfilled (skill ${bumpSkillId}, buyer ${buyerId})`);
        }
    }
}

module.exports = { fulfillSkillPurchase };
