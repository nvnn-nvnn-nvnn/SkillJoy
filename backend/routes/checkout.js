const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const supabase = require('../config/supabase');
const { skillFeeCents, SKILL_PLATFORM_FEE_BPS } = require('../config/fees');
const { sendEmail, getUserEmail } = require('../lib/email');

// ═══════════════════════════════════════════════════════════════════════════
// v3 SKILL CHECKOUT — instant digital-goods purchase via a destination charge.
// No escrow. Fulfilment happens in the webhook (webhooks.js, kind='skill') with
// /confirm as a fast fallback. Auth middleware runs upstream → req.user is set.
// ═══════════════════════════════════════════════════════════════════════════

// Look up a creator's promo code and return the discounted price (one-time only).
// Throws on invalid/inactive/exhausted. Returns { cents, code, percentOff }.
async function priceWithDiscount(creatorId, code, priceCents) {
    if (!code || !code.trim()) return { cents: priceCents, code: null, percentOff: 0 };
    const { data: d } = await supabase
        .from('discounts').select('code, percent_off, active, max_redemptions, times_redeemed')
        .eq('creator_id', creatorId).ilike('code', code.trim()).maybeSingle();
    if (!d || !d.active) throw new Error('That promo code isn’t valid.');
    if (d.max_redemptions != null && d.times_redeemed >= d.max_redemptions) {
        throw new Error('That promo code has reached its limit.');
    }
    const cents = Math.max(0, Math.round((priceCents * (100 - d.percent_off)) / 100));
    return { cents, code: d.code, percentOff: d.percent_off };
}

// POST /api/checkout/:skillId/intent
router.post('/:skillId/intent', async (req, res) => {
    try {
        const { skillId } = req.params;
        const buyerId = req.user.id;

        const { data: skill, error: skillErr } = await supabase
            .from('skills')
            .select('id, title, price_cents, kind, pricing_type, status, version, creator_id, stripe_price_id, order_bump_skill_id, order_bump_price_cents')
            .eq('id', skillId)
            .single();
        if (skillErr || !skill) return res.status(404).json({ error: 'Skill not found' });
        if (skill.status !== 'published') return res.status(400).json({ error: 'This Skill is not available for purchase.' });
        if (skill.creator_id === buyerId) return res.status(400).json({ error: 'You cannot buy your own Skill.' });

        // Already owned?
        const { data: existing } = await supabase
            .from('purchases')
            .select('id, status')
            .eq('buyer_id', buyerId).eq('skill_id', skillId)
            .maybeSingle();
        if (existing?.status === 'paid') return res.status(409).json({ error: 'You already own this Skill.' });

        // Free Skill → grant immediately, no Stripe.
        if (!skill.price_cents) {
            await supabase.from('purchases').upsert({
                buyer_id: buyerId, skill_id: skillId, version_at_purchase: skill.version,
                amount_cents: 0, status: 'paid',
            }, { onConflict: 'buyer_id,skill_id' });

            if (skill.kind === "lead") {
                try {
                    await supabase.from('subscribers').upsert({
                    creator_id: skill.creator_id, email: req.user.email, source: 'lead_magnet'
                }, {onConflict: 'creator_id, email', ignoreDuplicates: true})

                } catch (e) {
                    console.warn('lead subscribe failed:', e.message);
                }
       
            }
            return res.json({ free: true });
        }

        // Seller must have payouts set up.
        const { data: creator } = await supabase
            .from('profiles')
            .select('stripe_account_id, stripe_onboarded')
            .eq('id', skill.creator_id)
            .single();
        if (!creator?.stripe_account_id || !creator?.stripe_onboarded) {
            return res.status(402).json({ error: 'This creator hasn’t finished setting up payouts yet.' });
        }

        // ── Membership → recurring Stripe Subscription via hosted Checkout ──
        if (skill.pricing_type === 'membership') {
            // Ensure a recurring Price exists for this Skill (cache it).
            let priceId = skill.stripe_price_id;
            if (!priceId) {
                const product = await stripe.products.create({ name: skill.title || 'Membership' });
                const price = await stripe.prices.create({
                    product: product.id,
                    unit_amount: skill.price_cents,
                    currency: 'usd',
                    recurring: { interval: 'month' },
                });
                priceId = price.id;
                await supabase.from('skills').update({ stripe_price_id: priceId }).eq('id', skillId);
            }

            const session = await stripe.checkout.sessions.create({
                mode: 'subscription',
                line_items: [{ price: priceId, quantity: 1 }],
                customer_email: req.user.email,
                client_reference_id: buyerId,
                subscription_data: {
                    application_fee_percent: SKILL_PLATFORM_FEE_BPS / 100,
                    transfer_data: { destination: creator.stripe_account_id },
                    metadata: { kind: 'skill_sub', skill_id: skillId, buyer_id: buyerId },
                },
                metadata: { kind: 'skill_sub', skill_id: skillId, buyer_id: buyerId },
                success_url: `${process.env.FRONTEND_URL}/locker/${skillId}?sub=success`,
                cancel_url: `${process.env.FRONTEND_URL}/locker`,
            });

            await supabase.from('purchases').upsert({
                buyer_id: buyerId, skill_id: skillId, version_at_purchase: skill.version,
                amount_cents: skill.price_cents, status: 'pending',
            }, { onConflict: 'buyer_id,skill_id' });

            return res.json({ membership: true, url: session.url });
        }

        // Apply a promo code if supplied (one-time only).
        let charge;
        try { charge = await priceWithDiscount(skill.creator_id, req.body.code, skill.price_cents); }
        catch (e) { return res.status(400).json({ error: e.message }); }

        // ── Order bump: add the creator's chosen add-on product, if selected ──
        // The bump is one of the SAME creator's other one-time products, so it
        // rides this one PaymentIntent + transfer. We re-validate server-side
        // (never trust a client price) and skip anything the buyer already owns.
        let bumpSkill = null, bumpCents = 0;
        if (req.body.bump && skill.order_bump_skill_id) {
            const { data: b } = await supabase
                .from('skills')
                .select('id, title, price_cents, pricing_type, status, creator_id, version')
                .eq('id', skill.order_bump_skill_id).single();
            if (b && b.status === 'published' && b.pricing_type === 'onetime' && b.creator_id === skill.creator_id) {
                const { data: owned } = await supabase.from('purchases')
                    .select('status').eq('buyer_id', buyerId).eq('skill_id', b.id).maybeSingle();
                if (owned?.status === 'paid') {
                    return res.status(409).json({ error: 'You already own the add-on.' });
                }
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
            automatic_payment_methods: { enabled: true }, // card + Apple/Google Pay
            metadata: {
                kind: 'skill', skill_id: skillId, buyer_id: buyerId, version: String(skill.version), code: charge.code || '',
                bump_skill_id: bumpSkill ? bumpSkill.id : '',
                bump_amount: String(bumpCents),
                bump_version: bumpSkill ? String(bumpSkill.version) : '',
            },
        });

        // Upsert a pending purchase (one row per buyer+skill) for the main product.
        const { error: upErr } = await supabase.from('purchases').upsert({
            buyer_id: buyerId, skill_id: skillId, version_at_purchase: skill.version,
            amount_cents: charge.cents, stripe_payment_id: paymentIntent.id, status: 'pending',
            discount_code: charge.code,
        }, { onConflict: 'buyer_id,skill_id' });
        if (upErr) return res.status(500).json({ error: upErr.message });

        // And a pending row for the bump product — fulfilment flips both to paid.
        if (bumpSkill) {
            const { error: bumpErr } = await supabase.from('purchases').upsert({
                buyer_id: buyerId, skill_id: bumpSkill.id, version_at_purchase: bumpSkill.version,
                amount_cents: bumpCents, stripe_payment_id: paymentIntent.id, status: 'pending',
            }, { onConflict: 'buyer_id,skill_id' });
            if (bumpErr) return res.status(500).json({ error: bumpErr.message });
        }

        res.json({ clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id, amountCents: totalCents });
    } catch (err) {
        console.error('Skill checkout intent error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/checkout/:skillId/confirm — fast fulfilment fallback if the webhook
// is delayed. Idempotent; the webhook is the source of truth.
router.post('/:skillId/confirm', async (req, res) => {
    try {
        const { skillId } = req.params;
        const { paymentIntentId } = req.body;
        const buyerId = req.user.id;
        if (!paymentIntentId) return res.status(400).json({ error: 'Missing paymentIntentId' });

        const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
        if (pi.status !== 'succeeded') return res.status(400).json({ error: 'Payment not completed', status: pi.status });
        if (pi.metadata?.kind !== 'skill' || pi.metadata?.buyer_id !== buyerId || pi.metadata?.skill_id !== skillId) {
            return res.status(403).json({ error: 'Payment does not match this purchase.' });
        }

        const { error } = await supabase
            .from('purchases')
            .update({ status: 'paid' })
            .eq('buyer_id', buyerId).eq('skill_id', skillId).neq('status', 'paid');
        if (error) return res.status(500).json({ error: error.message });

        // Grant the order-bump product too, if one rode this payment.
        const bumpSkillId = pi.metadata?.bump_skill_id;
        if (bumpSkillId) {
            await supabase.from('purchases')
                .update({ status: 'paid' })
                .eq('buyer_id', buyerId).eq('skill_id', bumpSkillId).neq('status', 'paid');
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Skill checkout confirm error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/checkout/:skillId/validate-code { code } — preview a discount.
router.post('/:skillId/validate-code', async (req, res) => {
    try {
        const { data: skill } = await supabase
            .from('skills').select('price_cents, creator_id, pricing_type, status').eq('id', req.params.skillId).single();
        if (!skill || skill.status !== 'published') return res.status(404).json({ error: 'Skill not found' });
        if (skill.pricing_type !== 'onetime') return res.status(400).json({ valid: false, error: 'Codes apply to one-time Skills only.' });
        const charge = await priceWithDiscount(skill.creator_id, req.body.code, skill.price_cents);
        res.json({ valid: true, percentOff: charge.percentOff, amountCents: charge.cents });
    } catch (e) {
        res.status(200).json({ valid: false, error: e.message });
    }
});


router.post('/portal', async (req, res) => {
    try {
        const {purchaseId} = req.body
        if (!purchaseId) return res.status(400).json({error: 'Missing purchaseId'});

        const {data: p } = await supabase
            .from('purchases')
            .select('id, status, skill_id, stripe_payment_id, stripe_subscription_id, buyer_id, skill:skills(title, creator_id)')
            .eq('id', purchaseId).single();
        if (!p) return res.status(400).json({error: 'Subscription not found'});
        if (p.buyer_id !== req.user.id) return res.status(403).json({error: 'Not your subscription'});
        if (!p.stripe_subscription_id){
            return res.status(400).json({error: "You need a subscription to cancel"})
        }

        const sub = await stripe.subscriptions.retrieve(p.stripe_subscription_id);
        const return_url = `${process.env.FRONTEND_URL}/locker/${p.skill_id}`;
        const portal =  await stripe.billingPortal.sessions.create({customer: sub.customer, return_url});
        res.json({url: portal.url})


    } catch (e) {
        res.status(500).json({error: e.message});
    }
})



// POST /api/checkout/refund { purchaseId } — creator refunds a one-time purchase.
router.post('/refund', async (req, res) => {
    try {
        const { purchaseId } = req.body;
        if (!purchaseId) return res.status(400).json({ error: 'Missing purchaseId' });

        const { data: p } = await supabase
            .from('purchases')
            .select('id, status, stripe_payment_id, stripe_subscription_id, buyer_id, skill:skills(title, creator_id)')
            .eq('id', purchaseId).single();
        if (!p) return res.status(404).json({ error: 'Purchase not found' });
        if (p.skill?.creator_id !== req.user.id) return res.status(403).json({ error: 'Not your sale.' });
        if (p.status !== 'paid') return res.status(400).json({ error: 'This purchase can’t be refunded.' });
        if (p.stripe_subscription_id) {
            return res.status(400).json({ error: 'Cancel memberships from the buyer’s subscription, not a refund.' });
        }
        if (!p.stripe_payment_id) return res.status(400).json({ error: 'No payment on file to refund.' });

        await stripe.refunds.create({ payment_intent: p.stripe_payment_id });
        await supabase.from('purchases').update({ status: 'refunded' }).eq('id', purchaseId);

        await supabase.from('notifications').insert({
            user_id: p.buyer_id, type: 'order_update', title: 'Refund issued',
            message: `You were refunded for "${p.skill?.title ?? 'a Skill'}". Access has been removed.`,
            related_type: null,
        });
        res.json({ success: true });
    } catch (err) {
        console.error('Skill refund error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
