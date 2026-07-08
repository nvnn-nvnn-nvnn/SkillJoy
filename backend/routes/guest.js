const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const supabase = require('../config/supabase');
const { skillFeeCents } = require('../config/fees');
const { fulfillGuestPurchase } = require('../lib/guestFulfillment');

// ═══════════════════════════════════════════════════════════════════════════
// GUEST CHECKOUT — buy without an account (one-time PAID products only).
// Mounted WITHOUT authMiddleware. No account is created here; we only create the
// PaymentIntent. The account + purchase are created at fulfilment, AFTER payment
// succeeds (webhook or /confirm), so this open endpoint can't spam-create users.
// ═══════════════════════════════════════════════════════════════════════════

const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((e || '').trim());

// Minimal promo lookup (checkout.js keeps its own private copy; guests get the
// same one-time discount behaviour).
async function priceWithDiscount(creatorId, code, priceCents) {
    if (!code || !code.trim()) return { cents: priceCents, code: null };
    const { data: d } = await supabase
        .from('discounts').select('code, percent_off, active, max_redemptions, times_redeemed')
        .eq('creator_id', creatorId).ilike('code', code.trim()).maybeSingle();
    if (!d || !d.active) throw new Error('That promo code isn’t valid.');
    if (d.max_redemptions != null && d.times_redeemed >= d.max_redemptions) {
        throw new Error('That promo code has reached its limit.');
    }
    const cents = Math.max(0, Math.round((priceCents * (100 - d.percent_off)) / 100));
    return { cents, code: d.code };
}

// POST /api/guest/:skillId/intent  { name, email, code, bump }
router.post('/:skillId/intent', async (req, res) => {
    try {
        const { skillId } = req.params;
        const { name, email } = req.body;
        if (!name?.trim()) return res.status(400).json({ error: 'Please enter your name.' });
        if (!emailOk(email)) return res.status(400).json({ error: 'Please enter a valid email.' });

        const { data: skill } = await supabase.from('skills')
            .select('id, title, price_cents, pricing_type, status, version, creator_id, order_bump_skill_id, order_bump_price_cents')
            .eq('id', skillId).single();
        if (!skill || skill.status !== 'published') return res.status(404).json({ error: 'This product isn’t available.' });
        if (skill.pricing_type !== 'onetime' || !skill.price_cents) {
            return res.status(400).json({ error: 'Guest checkout is only available for one-time products.' });
        }

        // Seller must have payouts set up.
        const { data: creator } = await supabase.from('profiles')
            .select('stripe_account_id, stripe_onboarded').eq('id', skill.creator_id).single();
        if (!creator?.stripe_account_id || !creator?.stripe_onboarded) {
            return res.status(402).json({ error: 'This creator hasn’t finished setting up payouts yet.' });
        }

        let charge;
        try { charge = await priceWithDiscount(skill.creator_id, req.body.code, skill.price_cents); }
        catch (e) { return res.status(400).json({ error: e.message }); }

        // Order bump — same creator, published, one-time (re-validated server-side).
        let bumpSkill = null, bumpCents = 0;
        if (req.body.bump && skill.order_bump_skill_id) {
            const { data: b } = await supabase.from('skills')
                .select('id, price_cents, pricing_type, status, creator_id, version')
                .eq('id', skill.order_bump_skill_id).single();
            if (b && b.status === 'published' && b.pricing_type === 'onetime' && b.creator_id === skill.creator_id) {
                bumpSkill = b;
                bumpCents = skill.order_bump_price_cents ?? b.price_cents ?? 0;
            }
        }

        const totalCents = charge.cents + bumpCents;

        const paymentIntent = await stripe.paymentIntents.create({
            amount: totalCents,
            currency: 'usd',
            application_fee_amount: skillFeeCents(totalCents),
            transfer_data: { destination: creator.stripe_account_id },
            automatic_payment_methods: { enabled: true },
            metadata: {
                kind: 'skill_guest', skill_id: skillId,
                guest_email: email.trim().toLowerCase(), guest_name: name.trim(),
                code: charge.code || '',
                bump_skill_id: bumpSkill ? bumpSkill.id : '',
                bump_amount: String(bumpCents),
            },
        });

        res.json({ clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id, amountCents: totalCents });
    } catch (err) {
        console.error('Guest intent error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/guest/:skillId/confirm  { paymentIntentId } — fast fulfilment fallback
// if the webhook lags. Idempotent; the webhook is still the source of truth.
router.post('/:skillId/confirm', async (req, res) => {
    try {
        const { paymentIntentId } = req.body;
        if (!paymentIntentId) return res.status(400).json({ error: 'Missing paymentIntentId' });

        const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
        if (pi.status !== 'succeeded') return res.status(400).json({ error: 'Payment not completed.', status: pi.status });
        if (pi.metadata?.kind !== 'skill_guest' || pi.metadata?.skill_id !== req.params.skillId) {
            return res.status(403).json({ error: 'Payment does not match this product.' });
        }

        await fulfillGuestPurchase(pi);
        res.json({ success: true });
    } catch (err) {
        console.error('Guest confirm error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
