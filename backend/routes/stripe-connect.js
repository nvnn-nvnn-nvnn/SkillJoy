const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const supabase = require('../config/supabase');
const { feeCentsFromTotal, feeDollarsFromTotal } = require('../config/fees');

// Process any released orders past clearance_date for a newly-onboarded seller
async function processReleasedOrders(providerId, stripeAccountId) {
    const { data: orders } = await supabase
        .from('gig_requests')
        .select('id, payment_amount, clearance_date, gig:gigs(title)')
        .eq('provider_id', providerId)
        .eq('payment_status', 'released')
        .lte('clearance_date', new Date().toISOString());

    if (!orders?.length) return;

    for (const order of orders) {
        try {
            const transferAmount = Math.round(order.payment_amount * 100) - feeCentsFromTotal(order.payment_amount);
            await stripe.transfers.create({
                amount: transferAmount,
                currency: 'usd',
                destination: stripeAccountId,
                transfer_group: order.id,
            });
            await supabase.from('gig_requests').update({ payment_status: 'cleared' }).eq('id', order.id);
            const gigTitle = order.gig?.title ?? 'your order';
            await supabase.from('notifications').insert({
                user_id: providerId,
                type: 'order_update',
                title: 'Funds cleared!',
                message: `Your earnings for "${gigTitle}" have cleared and are on their way to your Stripe account.`,
                related_id: order.id,
                related_type: 'gig',
            });
            console.log(`✅ Cleared order ${order.id} after Stripe onboarding`);
        } catch (err) {
            console.error(`Failed to clear order ${order.id} after onboarding:`, err.message);
        }
    }
}


router.post("/onboard", async (req, res) => {
    try{

        const { data: profile } = await supabase
            .from('profiles')
            .select('stripe_account_id')
            .eq('id',req.user.id)
            .single()

        let accountId = profile?.stripe_account_id;

        if (accountId) {
            // Verify the saved account still belongs to this platform key
            try {
                await stripe.accounts.retrieve(accountId);
            } catch (err) {
                console.warn(`Stale Stripe account ${accountId} — creating a new one:`, err.message);
                accountId = null;
                await supabase
                    .from('profiles')
                    .update({ stripe_account_id: null, stripe_onboarded: false })
                    .eq('id', req.user.id);
            }
        }

        if (!accountId) {
            const account = await stripe.accounts.create({ type: 'express' });
            accountId = account.id;

            // Save the account ID immediately
            await supabase
                .from('profiles')
                .update({ stripe_account_id: accountId })
                .eq('id', req.user.id);
        }

        const accountLink = await stripe.accountLinks.create({
            account: accountId,
            refresh_url: `${process.env.FRONTEND_URL}/profile?stripe=refresh`,
            return_url:  `${process.env.FRONTEND_URL}/profile?stripe=success`,
            type: 'account_onboarding',
        });

        res.json({ url: accountLink.url });

    }
    catch(err){

        console.error('Stripe onboard error:', err);
        res.status(500).json({ error: err.message });

    };

});

router.get('/status', async (req, res)=>{
    try{

        const { data: profile } = await supabase
            .from('profiles')
            .select('stripe_account_id, stripe_onboarded')
            .eq('id', req.user.id)
            .single()


        if (!profile?.stripe_account_id){
            return (res.json( { onboarded: false }))
        };


        const account = await stripe.accounts.retrieve(profile.stripe_account_id);

        const onboarded = account.details_submitted && account.charges_enabled;


        if (onboarded && !profile.stripe_onboarded) {
            await supabase.from('profiles').update({ stripe_onboarded: true }).eq('id', req.user.id);
            // Process any released orders that were waiting on this seller's Stripe setup
            // processReleasedOrders(req.user.id, profile.stripe_account_id).catch(err =>
            //     console.error('processReleasedOrders error:', err.message)
            // );


            try {
                await processReleasedOrders(req.user.id, profile.stripe_account_id);
            } catch (err) {
                console.error('processReleasedOrders error:', err.message);
            }

        };


        res.json({ onboarded, chargesEnabled: account.charges_enabled });


    } catch (err) {
                res.status(500).json({ error: err.message });
    };

});


router.get('/balance', async (req, res) => {
    try {
        const { data: profile } = await supabase
            .from('profiles')
            .select('stripe_account_id, stripe_onboarded')
            .eq('id', req.user.id)
            .single();

        if (!profile?.stripe_account_id || !profile?.stripe_onboarded) {
            return res.json({ available: 0, pending: 0 });
        }

        const balance = await stripe.balance.retrieve({ stripeAccount: profile.stripe_account_id });

        const available = balance.available.reduce((sum, b) => sum + b.amount, 0) / 100;
        const pending = balance.pending.reduce((sum, b) => sum + b.amount, 0) / 100;

        res.json({ available, pending });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ── Stripe Express dashboard login link ────────────────────────────────────────
router.post('/dashboard-link', async (req, res) => {
    try {
        const { data: profile } = await supabase
            .from('profiles')
            .select('stripe_account_id, stripe_onboarded')
            .eq('id', req.user.id)
            .single();

        if (!profile?.stripe_account_id || !profile?.stripe_onboarded) {
            return res.status(400).json({ error: 'Stripe account not set up' });
        }

        const loginLink = await stripe.accounts.createLoginLink(profile.stripe_account_id);
        res.json({ url: loginLink.url });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Earnings breakdown: pending (DB) + available (Stripe Connect balance) ──────
router.get('/earnings', async (req, res) => {
    try {
        const { data: profile } = await supabase
            .from('profiles')
            .select('stripe_account_id, stripe_onboarded')
            .eq('id', req.user.id)
            .single();

        // Split escrowed (waiting for release) vs released (waiting for clearance)
        const { data: escrowedOrders } = await supabase
            .from('gig_requests')
            .select('payment_amount')
            .eq('provider_id', req.user.id)
            .eq('payment_status', 'escrowed');

        const { data: releasedOrders } = await supabase
            .from('gig_requests')
            .select('payment_amount')
            .eq('provider_id', req.user.id)
            .eq('payment_status', 'released');

        const calc = (orders) => (orders || []).reduce((sum, o) => sum + (parseFloat(o.payment_amount) - feeDollarsFromTotal(o.payment_amount)), 0);
        const inEscrow         = Math.max(0, parseFloat(calc(escrowedOrders).toFixed(2)));
        const pendingClearance = Math.max(0, parseFloat(calc(releasedOrders).toFixed(2)));

        // Available = Stripe Connect balance (post-transfer)
        let stripeAvailable = 0;
        let stripePending = 0;
        if (profile?.stripe_account_id && profile?.stripe_onboarded) {
            const balance = await stripe.balance.retrieve({ stripeAccount: profile.stripe_account_id });
            stripeAvailable = balance.available.reduce((sum, b) => sum + b.amount, 0) / 100;
            stripePending  = balance.pending.reduce((sum, b) => sum + b.amount, 0) / 100;
        }

        res.json({
            inEscrow,          // buyer hasn't released yet
            pendingClearance,  // released, waiting for 14-day clearance
            stripeAvailable,   // transferred, available to pay out
            stripePending,     // transferred but still clearing on Stripe's side
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
