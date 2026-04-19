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

            const { data: updated, error } = await supabase
                .from('gig_requests')
                .update({
                    payment_status: 'escrowed',
                    payment_amount: paymentIntent.amount / 100,
                    payment_intent_id: paymentIntent.id,
                    escrow_date: new Date().toISOString(),
                    status: 'accepted'
                })
                .eq('id', orderId)
                .neq('payment_status', 'escrowed') // idempotency guard
                .select('id');

            if (error) {
                console.error('❌ Failed to update order to escrowed:', error);
            } else if (!updated || updated.length === 0) {
                console.warn(`⚠️ RACE/MISSING: order ${orderId} not found or already escrowed — webhook may have arrived before order was created`);
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


      case 'charge.dispute.created': {
        const dispute = event.data.object;
        console.log(`🚨 CHARGEBACK: dispute ${dispute.id} | pi: ${dispute.payment_intent} | $${dispute.amount / 100} | reason: ${dispute.reason}`);

        if (!dispute) {
            console.log('⚠️ Unable to fetch dispute information');
            break
        };



        const { data: order } = await supabase
            .from('gig_requests')
            .select('id, requester_id, provider_id')
            .eq('payment_intent_id', dispute.payment_intent)
            .single();

        if (order) {
            await supabase
                .from('gig_requests')
                .update({ payment_status: 'chargebacked' })
                .eq('id', order.id);

            const {data: adminProfile} = await supabase
                .from('profiles')
                .select('id')
                .eq('email', process.env.ADMIN_EMAIL)
                .single();

            if (!adminProfile) {
                console.error('⚠️ ADMIN_EMAIL not found in profiles — skipping admin notification');
            }

            const createdNotifications = [
                {
                    user_id: order.requester_id,
                    type: 'chargeback',
                    title: 'Chargeback opened',
                    message: `A chargeback was filed on order ${order.id}. Our team is reviewing it.`,
                    related_id: order.id,
                    related_type: 'gig',
                },
                {
                    user_id: order.provider_id,
                    type: 'chargeback',
                    title: 'Chargeback opened on your order',
                    message: `A chargeback was filed against order ${order.id}. Funds are frozen pending review.`,
                    related_id: order.id,
                    related_type: 'gig',
                },
            ];
            if (adminProfile) {
                createdNotifications.unshift({
                    user_id: adminProfile.id,
                    type: 'chargeback',
                    title: 'Chargeback received',
                    message: `Order ${order.id} has been chargebacked. Reason: ${dispute.reason}`,
                    related_id: order.id,
                    related_type: 'gig',
                });
            }
            await supabase.from('notifications').insert(createdNotifications);
        }


      

        break;
    }

        case 'charge.dispute.closed': {
            const dispute = event.data.object;
            console.log(`⚖️ DISPUTE CLOSED: ${dispute.id} | outcome: ${dispute.status} | pi: ${dispute.payment_intent}`);

            if (!dispute){
                console.log('⚠️ Unable to fetch dispute metadata');
                break;
            }

            const {data: order} = await supabase
                .from('gig_requests')
                .select('id, requester_id, provider_id')
                .eq('payment_intent_id', dispute.payment_intent)
                .single()

            if (!order) {
                console.log('⚠️ Unable to fetch order metadata');
                break;
            }

            const { data: adminProfile } = await supabase
                .from('profiles')
                .select('id')
                .eq('email', process.env.ADMIN_EMAIL)
                .single();

            if (!adminProfile) {
                console.error('⚠️ ADMIN_EMAIL not found in profiles — skipping admin notification');
            }

            if (dispute.status === 'won') {
                await supabase
                    .from('gig_requests')
                    .update({ payment_status: 'chargeback_won' })
                    .eq('id', order.id);

                const wonNotifications = [
                    {
                        user_id: order.requester_id,
                        type: 'chargeback',
                        title: 'Chargeback denied',
                        message: `Your chargeback on order ${order.id} was denied.`,
                        related_id: order.id,
                        related_type: 'gig',
                    },
                    {
                        user_id: order.provider_id,
                        type: 'chargeback',
                        title: 'Chargeback resolved in your favor',
                        message: `The chargeback on order ${order.id} was resolved in your favor.`,
                        related_id: order.id,
                        related_type: 'gig',
                    },
                ];
                if (adminProfile) wonNotifications.unshift({
                    user_id: adminProfile.id,
                    type: 'chargeback',
                    title: 'Dispute won',
                    message: `Dispute ${dispute.id} resolved in our favor. Order ${order.id}.`,
                    related_id: order.id,
                    related_type: 'gig',
                });
                await supabase.from('notifications').insert(wonNotifications);

            } else if (dispute.status === 'lost') {
                await supabase
                    .from('gig_requests')
                    .update({ payment_status: 'chargeback_lost' })
                    .eq('id', order.id);

                const lostNotifications = [
                    {
                        user_id: order.requester_id,
                        type: 'chargeback',
                        title: 'Chargeback approved',
                        message: `Your chargeback on order ${order.id} was approved.`,
                        related_id: order.id,
                        related_type: 'gig',
                    },
                    {
                        user_id: order.provider_id,
                        type: 'chargeback',
                        title: 'Chargeback lost',
                        message: `The chargeback on order ${order.id} was lost. Funds returned to buyer.`,
                        related_id: order.id,
                        related_type: 'gig',
                    },
                ];
                if (adminProfile) lostNotifications.unshift({
                    user_id: adminProfile.id,
                    type: 'chargeback',
                    title: 'Dispute lost',
                    message: `Dispute ${dispute.id} lost. Order ${order.id} refunded to buyer.`,
                    related_id: order.id,
                    related_type: 'gig',
                });
                await supabase.from('notifications').insert(lostNotifications);

            } else if (dispute.status === 'warning_closed') {
                console.log(`⚠️ Dispute ${dispute.id} warning_closed — no action needed`);
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
