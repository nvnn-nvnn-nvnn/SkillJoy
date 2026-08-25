const express = require('express');
const router = express.Router();
const { serverError } = require('../lib/http');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const supabase = require('../config/supabase');
const { skillFeeCents } = require('../config/fees');
const { fulfillGuestPurchase, fulfillFreeClaim } = require('../lib/guestFulfillment');
const { isStaleDestinationError, clearStaleAccount } = require('../lib/connectGuard');
const { isPlatformLive, paywallEnabled } = require('../lib/platformSub');

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

        // Paywall: service-key read bypasses RLS, so re-check the creator's
        // platform sub here. Skipped while the paywall is dormant (no Stripe
        // price). NOTE this endpoint only ever creates one-time PaymentIntents
        // (kind:'skill_guest') — it can never create a platform subscription
        // (kind:'platform_sub'), which lives in /api/billing behind auth. See
        // backend/lib/platformSub.js for the isolation guard.
        if (paywallEnabled() && !(await isPlatformLive(skill.creator_id))) {
            return res.status(403).json({ error: 'This storefront is currently unavailable.' });
        }

        // Don't let a guest pay again for something this email already owns.
        // The logged-in checkout has this guard via buyer_id; guests have no
        // account at intent time, so we resolve it by email — a READ only
        // (email → profile → paid purchase), no account is created here.
        const cleanEmail = email.trim().toLowerCase();
        const { data: existingProfile } = await supabase
            .from('profiles').select('id').eq('email', cleanEmail).maybeSingle();
        const existingBuyerId = existingProfile?.id || null;
        if (existingBuyerId) {
            const { data: owned } = await supabase.from('purchases')
                .select('status').eq('buyer_id', existingBuyerId).eq('skill_id', skillId).maybeSingle();
            if (owned?.status === 'paid') {
                return res.status(409).json({ error: 'You already own this — check your email for the access link, or log in to open it in your Locker.' });
            }
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
                // Skip the bump (don't charge) if this email already owns it.
                let ownsBump = false;
                if (existingBuyerId) {
                    const { data: bo } = await supabase.from('purchases')
                        .select('status').eq('buyer_id', existingBuyerId).eq('skill_id', b.id).maybeSingle();
                    ownsBump = bo?.status === 'paid';
                }
                if (!ownsBump) {
                    bumpSkill = b;
                    bumpCents = skill.order_bump_price_cents ?? b.price_cents ?? 0;
                }
            }
        }

        const totalCents = charge.cents + bumpCents;

        let paymentIntent;
        try {
            paymentIntent = await stripe.paymentIntents.create({
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
        } catch (e) {
            if (isStaleDestinationError(e)) {
                await clearStaleAccount(skill.creator_id);
                return res.status(402).json({ error: 'This creator’s payouts need to be reconnected before you can buy. Please try again later.' });
            }
            throw e;
        }

        res.json({ clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id, amountCents: totalCents });
    } catch (err) {
        console.error('Guest intent error:', err);
        serverError(res, err);
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

        const { signInToken } = await fulfillGuestPurchase(pi);
        // Only present when this purchase created the account — see
        // signInTokenFor. Lets the buyer land on the product instead of being
        // told to go and check their email after they have already paid.
        res.json({ success: true, signInToken: signInToken || null });
    } catch (err) {
        console.error('Guest confirm error:', err);
        serverError(res, err);
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// CLAIM — a FREE product, with no account and no payment.
//
// Free products are lead magnets: the entire point is that a stranger gets the
// thing in exchange for an email. Forcing them to create an account first is
// the highest-friction possible step at the exact moment they have the least
// invested — and it was the one path guest checkout did not cover.
//
// This is the paid guest flow minus Stripe. Same findOrCreateBuyer, same
// purchases row, same magic-link email — so the product lands in the same
// Locker, and the buyer can come back to it without ever setting a password.
//
// NO PAYMENT INTENT EXISTS HERE, which removes the thing that made the paid
// flow safe: Stripe confirming the caller actually paid. So the guard is the
// price itself — the route re-reads the skill server-side and refuses anything
// that is not a published, free, one-time product. A client claiming a paid
// product gets nothing.
// ═══════════════════════════════════════════════════════════════════════════
router.post('/:skillId/claim', async (req, res) => {
    try {
        const name = String(req.body?.name || '').trim().slice(0, 80);
        const email = String(req.body?.email || '').trim().toLowerCase().slice(0, 160);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ error: 'Enter a valid email address.' });
        }

        const { data: skill, error } = await supabase.from('skills')
            .select('id, title, creator_id, version, status, price_cents, pricing_type, confirmation_message')
            .eq('id', req.params.skillId).single();
        if (error || !skill) return res.status(404).json({ error: 'Product not found.' });

        // The price IS the authorisation. Read server-side, never from the client.
        if (skill.status !== 'published') return res.status(400).json({ error: 'This product is not available.' });
        if (skill.price_cents || skill.pricing_type !== 'onetime') {
            return res.status(400).json({ error: 'This product is not free.' });
        }

        const { signInToken } = await fulfillFreeClaim({ skill, email, name });
        res.json({ success: true, signInToken: signInToken || null });
    } catch (err) {
        console.error('Guest claim error:', err);
        serverError(res, err);
    }
});

module.exports = router;
