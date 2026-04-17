const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const supabase = require('../config/supabase');

// ═══════════════════════════════════════════════════════════════════════════
// STRIPE WEBHOOK ENDPOINT
// ═══════════════════════════════════════════════════════════════════════════
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
    console.log('\n📨 WEBHOOK RECEIVED:', new Date().toISOString());
    console.log('Headers:', req.headers['stripe-signature'] ? 'Has signature' : 'No signature');

    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
        console.log(`Webhook signature verification failed.`, err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
        case 'payment_intent.succeeded': {
            const paymentIntent = event.data.object;
            console.log(`\n✅ STRIPE WEBHOOK: PaymentIntent succeeded: ${paymentIntent.id}`);
            console.log(`📦 OrderId from metadata: ${paymentIntent.metadata?.orderId}`);
            console.log(`💰 Amount: $${paymentIntent.amount / 100}`);

            if (!paymentIntent.metadata?.orderId) {
                console.log('⚠️ PaymentIntent missing orderId metadata');
                break;
            }

            const orderId = paymentIntent.metadata.orderId;
            console.log(`🔍 Updating order ${orderId} to escrowed...`);

            const { error } = await supabase
                .from('gig_requests')
                .update({
                    payment_status: 'escrowed',
                    payment_amount: paymentIntent.amount / 100,
                    payment_intent_id: paymentIntent.id,
                    escrow_date: new Date().toISOString(),
                    status: 'accepted'
                })
                .eq('id', orderId)
                .neq('payment_status', 'escrowed'); // idempotency guard

            if (error) {
                console.error('❌ Failed to update order to escrowed:', error);
            } else {
                console.log(`✅ Order ${orderId} escrowed. Amount: $${paymentIntent.amount / 100}`);
            }
            break;
        }

        case 'payment_intent.payment_failed':
        case 'payment_intent.canceled': {
            const failedIntent = event.data.object;
            const failedOrderId = failedIntent.metadata?.orderId;
            console.log(`⚠️ Payment ${event.type}: ${failedIntent.id}`);
            if (failedOrderId) {
                await supabase
                    .from('gig_requests')
                    .update({ payment_status: 'unpaid' })
                    .eq('id', failedOrderId)
                    .in('payment_status', ['unpaid', 'escrowed']); // only revert if not yet released/cleared
                console.log(`↩️ Order ${failedOrderId} reverted to unpaid`);
            }
            break;
        }
        

        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    // Return a 200 response to acknowledge receipt of the event
    res.json({ received: true });
});

// Simple GET test endpoint
router.get('/stripe', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/stripe/test', (req, res) => {
    console.log('\n✅ GET /webhooks/stripe/test HIT!');
    res.json({ status: 'webhook route working', timestamp: new Date().toISOString() });
});

module.exports = router;
