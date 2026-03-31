const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const supabase = require('../config/supabase');


router.post("/onboard", async (req, res) => {
    try{

        const { data: profile } = await supabase
            .from('profiles')
            .select('stripe_account_id')
            .eq('id',req.user.id)
            .single()

        let accountId = profile?.stripe_account_id;

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
                await supabase
                    .from('profiles')
                    .update({ stripe_onboarded: true })
                    .eq('id', req.user.id)
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


module.exports = router;
