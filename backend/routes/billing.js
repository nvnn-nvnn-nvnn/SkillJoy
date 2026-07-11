const express = require('express');
const router = express.Router();
const { serverError } = require('../lib/http');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const supabase = require('../config/supabase');
const { getPlatformSub, assertNoConnectParams, LIVE_STATUSES } = require('../lib/platformSub');

// ═══════════════════════════════════════════════════════════════════════════
// PLATFORM BILLING — the creator's subscription TO SKILLJOY (the paywall).
// Direct charges on SkillJoy's own Stripe account: NO Connect, NO
// transfer_data, NO application_fee. Never confuse with routes/checkout.js
// memberships (kind:'skill_sub'), which are fan→creator Connect charges.
//
// Env: STRIPE_PLATFORM_PRICE_ID — the recurring Price on SkillJoy's own
// account for the platform plan. Create it in the Stripe dashboard (Products →
// add a monthly price) and set the id here; do not hardcode.
//
// Mounted at /api/billing behind authMiddleware + strictLimiter → req.user set.
// ═══════════════════════════════════════════════════════════════════════════

// Create-or-reuse the creator's Stripe Customer (on SkillJoy's own account)
// and persist it on their platform_subscriptions row.
async function ensureCustomer(user) {
    const sub = await getPlatformSub(user.id);
    if (sub?.stripe_customer_id) {
        // Verify it still exists on this Stripe key (mirrors the stale-account
        // self-heal pattern in stripe-connect.js).
        try {
            const c = await stripe.customers.retrieve(sub.stripe_customer_id);
            if (!c.deleted) return sub.stripe_customer_id;
        } catch (err) {
            console.warn(`Stale platform customer ${sub.stripe_customer_id} — recreating:`, err.message);
        }
    }

    const customer = await stripe.customers.create(assertNoConnectParams({
        email: user.email,
        metadata: { kind: 'platform_sub', user_id: user.id },
    }));

    await supabase.from('platform_subscriptions').upsert(
        { user_id: user.id, stripe_customer_id: customer.id, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
    );
    return customer.id;
}

// POST /api/billing/subscribe — start the platform sub: card captured up
// front, 14-day trial, first charge on day 14. Returns a hosted-Checkout URL.
router.post('/subscribe', async (req, res) => {
    try {
        const priceId = process.env.STRIPE_PLATFORM_PRICE_ID;
        if (!priceId) {
            console.error('STRIPE_PLATFORM_PRICE_ID is not set — platform billing is unconfigured.');
            return res.status(500).json({ error: 'Billing isn’t configured yet. Please try again later.' });
        }

        const existing = await getPlatformSub(req.user.id);
        if (existing && LIVE_STATUSES.includes(existing.status)) {
            return res.status(409).json({ error: 'You already have an active subscription.', code: 'ALREADY_SUBSCRIBED' });
        }

        const customerId = await ensureCustomer(req.user);

        const session = await stripe.checkout.sessions.create(assertNoConnectParams({
            mode: 'subscription',
            customer: customerId,
            line_items: [{ price: priceId, quantity: 1 }],
            payment_method_collection: 'always', // card captured up front, charged on day 14
            subscription_data: {
                trial_period_days: 14,
                metadata: { kind: 'platform_sub', user_id: req.user.id },
            },
            metadata: { kind: 'platform_sub', user_id: req.user.id },
            success_url: `${process.env.FRONTEND_URL}/dashboard?billing=success`,
            cancel_url: `${process.env.FRONTEND_URL}/dashboard?billing=canceled`,
        }));

        res.json({ url: session.url });
    } catch (err) {
        console.error('Platform subscribe error:', err);
        serverError(res, err);
    }
});

// POST /api/billing/portal — Stripe billing portal (manage card / cancel).
router.post('/portal', async (req, res) => {
    try {
        const sub = await getPlatformSub(req.user.id);
        if (!sub?.stripe_customer_id) {
            return res.status(400).json({ error: 'No billing account yet — subscribe first.' });
        }
        const portal = await stripe.billingPortal.sessions.create(assertNoConnectParams({
            customer: sub.stripe_customer_id,
            return_url: `${process.env.FRONTEND_URL}/dashboard`,
        }));
        res.json({ url: portal.url });
    } catch (err) {
        console.error('Platform portal error:', err);
        serverError(res, err);
    }
});

// GET /api/billing/status — drives the trial banner / paused state in the UI.
router.get('/status', async (req, res) => {
    try {
        const sub = await getPlatformSub(req.user.id);
        if (!sub) return res.json({ status: 'none' });
        res.json({
            status: sub.status,
            trial_ends_at: sub.trial_ends_at,
            current_period_end: sub.current_period_end,
            live: LIVE_STATUSES.includes(sub.status),
        });
    } catch (err) {
        serverError(res, err);
    }
});

module.exports = router;
