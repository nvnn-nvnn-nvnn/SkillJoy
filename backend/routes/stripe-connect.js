const express = require('express');
const router = express.Router();
const stripe = require('stripe')(env.STRIPE_SECRET_KEY);
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

router.get('/success', async (req, res)=>{
    try{

    } catch (err) {

    };

});