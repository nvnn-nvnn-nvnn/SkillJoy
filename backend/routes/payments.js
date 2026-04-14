const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const supabase = require('../config/supabase');
const { sendEmail, getUserEmail, templates } = require('../lib/email');
const { SERVICE_FEE_DOLLARS } = require('../config/fees');

// ═══════════════════════════════════════════════════════════════════════════
// CREATE PAYMENT INTENT - Called when buyer clicks "Accept & Pay"
// ═══════════════════════════════════════════════════════════════════════════
router.post('/create-intent', async (req, res) => {
    try {
        const { orderId } = req.body;

        if (!orderId) {
            return res.status(400).json({ error: 'Missing orderId' });
        }

        const { data: order, error: orderError } = await supabase
            .from('gig_requests')
            .select('*, provider_id, gig:gigs!gig_id(price)')
            .eq('id', orderId)
            .single();

        if (orderError || !order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        if (order.requester_id !== req.user.id) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        if (!order.gig?.price) {
            return res.status(400).json({ error: 'Could not determine gig price' });
        }

        // Block payment if seller hasn't completed Stripe onboarding
        const { data: providerProfile } = await supabase
            .from('profiles')
            .select('stripe_account_id, stripe_onboarded')
            .eq('id', order.provider_id)
            .single();

        if (!providerProfile?.stripe_account_id || !providerProfile?.stripe_onboarded) {
            return res.status(402).json({ error: 'This seller has not set up payouts yet. Payment cannot proceed.' });
        }

        const amount = parseFloat(order.gig.price) + SERVICE_FEE_DOLLARS;

        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100),
            currency: 'usd',
            metadata: { orderId },
            automatic_payment_methods: { enabled: true }
        });

        res.json({
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id
        });
    } catch (err) {
        console.error('Create intent error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// CONFIRM PAYMENT - Called after Stripe payment succeeds
// ═══════════════════════════════════════════════════════════════════════════
router.post('/confirm', async (req, res) => {
    try {
        const { orderId, paymentIntentId } = req.body;

        if (!orderId || !paymentIntentId) {
            return res.status(400).json({ error: 'Missing orderId or paymentIntentId' });
        }

        // Ownership check — only the buyer can confirm their own order
        const { data: order, error: orderError } = await supabase
            .from('gig_requests').select('requester_id, payment_status').eq('id', orderId).single();
        if (orderError || !order) return res.status(404).json({ error: 'Order not found' });
        if (order.requester_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
        if (order.payment_status === 'escrowed') return res.status(409).json({ error: 'Already escrowed' });

        // Verify payment with Stripe
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        if (paymentIntent.status !== 'succeeded') {
            return res.status(400).json({ error: 'Payment not successful', status: paymentIntent.status });
        }

        const { data: updateData, error } = await supabase
            .from('gig_requests')
            .update({
                payment_status: 'escrowed',
                payment_amount: paymentIntent.amount / 100,
                payment_intent_id: paymentIntentId,
                escrow_date: new Date().toISOString(),
                status: 'accepted'
            })
            .eq('id', orderId)
            .select();

        if (error) return res.status(500).json({ error: error.message });
        if (!updateData || updateData.length === 0) return res.status(404).json({ error: 'Order not found or not updated' });

        // Notify both parties
        const { data: fullOrder } = await supabase
            .from('gig_requests')
            .select('provider_id, gig:gigs(title), requester:profiles!requester_id(full_name)')
            .eq('id', orderId).single();
        if (fullOrder) {
            const gigTitle = fullOrder.gig?.title ?? 'your order';
            await supabase.from('notifications').insert([
                {
                    user_id: req.user.id,
                    type: 'order_update',
                    title: 'Payment secured',
                    message: `Your payment for "${gigTitle}" is held in escrow. The seller will begin work shortly.`,
                    related_id: orderId, related_type: 'gig',
                },
                {
                    user_id: fullOrder.provider_id,
                    type: 'order_update',
                    title: 'Payment received — start work!',
                    message: `${fullOrder.requester?.full_name ?? 'The buyer'} has paid for "${gigTitle}". Funds are held in escrow until you deliver.`,
                    related_id: orderId, related_type: 'gig',
                },
            ]);
        }

        // Email seller: payment received
        if (fullOrder) {
            const sellerEmail = await getUserEmail(fullOrder.provider_id);
            if (sellerEmail) {
                const tpl = templates.paymentEscrowedSeller({
                    sellerName: 'there',
                    buyerName: fullOrder.requester?.full_name ?? 'The buyer',
                    gigTitle: fullOrder.gig?.title ?? 'your order',
                    amount: (paymentIntent.amount / 100).toFixed(2),
                });
                sendEmail({ to: sellerEmail, ...tpl }).catch(err => console.error('Email failed:', err.message));
            }
        }

        res.json({ success: true, message: 'Payment escrowed successfully', order: updateData[0] });
    } catch (err) {
        console.error('Confirm payment error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// RELEASE PAYMENT - Called when buyer approves work
// ═══════════════════════════════════════════════════════════════════════════
router.post('/release', async (req, res) => {
    try {
        const { orderId } = req.body;

        if (!orderId) { 
            return res.status(400).json({ error: 'Missing orderId' });
        }

        // Get order to verify it can be released
        const { data: order, error: orderError } = await supabase
            .from('gig_requests')
            .select('*')
            .eq('id', orderId)
            .single();

        if (orderError || !order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        if (order.requester_id !== req.user.id) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        if (order.payment_status !== 'escrowed') {
            return res.status(400).json({ error: 'Payment is not in escrow' });
        }

        if (order.status === 'disputed') {
            return res.status(400).json({ error: 'Cannot release payment while order is disputed' });
        }

        const clearanceDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

        // Update database - mark as released, start 14-day clearance
        // The .eq('payment_status', 'escrowed') on the UPDATE guards against race conditions
        const { data: released, error } = await supabase
            .from('gig_requests')
            .update({
                payment_status: 'released',
                release_date: new Date().toISOString(),
                clearance_date: clearanceDate,
                status: 'completed'
            })
            .eq('id', orderId)
            .eq('payment_status', 'escrowed')
            .select('id')
            .single();

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        if (!released) {
            return res.status(409).json({ error: 'Order state changed. Refresh and try again.' });
        }

        // Stripe transfer happens after the 14-day clearance window via the clearance cron in index.js

        // Notify seller
        const { data: fullOrder } = await supabase
            .from('gig_requests')
            .select('provider_id, gig:gigs(title), requester:profiles!requester_id(full_name)')
            .eq('id', orderId).single();
        if (fullOrder) {
            const gigTitle = fullOrder.gig?.title ?? 'your order';
            await supabase.from('notifications').insert([
                {
                    user_id: fullOrder.provider_id,
                    type: 'order_update',
                    title: 'Payment released — clearance started',
                    message: `${fullOrder.requester?.full_name ?? 'The buyer'} released payment for "${gigTitle}". Funds will be available in 14 days.`,
                    related_id: orderId, related_type: 'gig',
                },
                {
                    user_id: req.user.id,
                    type: 'gig_completed',
                    title: 'Order complete',
                    message: `You've released payment for "${gigTitle}". Thank you for using SkillJoy!`,
                    related_id: orderId, related_type: 'gig',
                },
            ]);
        }

        // Email seller: funds released
        if (fullOrder) {
            const sellerEmail = await getUserEmail(fullOrder.provider_id);
            if (sellerEmail) {
                const tpl = templates.fundsReleasedSeller({
                    sellerName: 'there',
                    gigTitle: fullOrder.gig?.title ?? 'your order',
                    amount: order.payment_amount?.toFixed(2) ?? '—',
                });
                sendEmail({ to: sellerEmail, ...tpl }).catch(err => console.error('Email failed:', err.message));
            }
        }

        res.json({ success: true, message: 'Payment released to provider' });
    } catch (err) {
        console.error('Release payment error:', err);
        res.status(500).json({ error: err.message });
    }
});




// ═══════════════════════════════════════════════════════════════════════════
// BUYER CANCEL - Called when buyer cancels before payment
// ═══════════════════════════════════════════════════════════════════════════
router.post('/buyer-cancel', async (req, res) => {
    try {
        const { orderId } = req.body;
        if (!orderId) return res.status(400).json({ error: 'Missing orderId' });

        const { data: order, error: orderError } = await supabase
            .from('gig_requests')
            .select('requester_id, provider_id, status, payment_status, gig:gigs(title), requester:profiles!requester_id(full_name)')
            .eq('id', orderId)
            .single();

        if (orderError || !order) return res.status(404).json({ error: 'Order not found' });
        if (order.requester_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
        if (order.payment_status !== 'unpaid') return res.status(400).json({ error: 'Cannot cancel after payment has been made' });
        if (!['pending', 'accepted'].includes(order.status)) return res.status(400).json({ error: 'Order cannot be cancelled at this stage' });

        const { error } = await supabase
            .from('gig_requests')
            .update({ status: 'cancelled', dispute_resolution: 'Cancelled by buyer', dispute_resolved_date: new Date().toISOString() })
            .eq('id', orderId);

        if (error) return res.status(500).json({ error: error.message });

        // Notify seller
        const gigTitle = order.gig?.title ?? 'an order';
        const buyerName = order.requester?.full_name ?? 'The buyer';
        await supabase.from('notifications').insert({
            user_id: order.provider_id,
            type: 'order_update',
            title: 'Order cancelled by buyer',
            message: `${buyerName} cancelled their request for "${gigTitle}".`,
            related_id: orderId,
            related_type: 'gig',
        });

        res.json({ success: true, message: 'Order cancelled' });
    } catch (err) {
        console.error('Buyer cancel error:', err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/cancel', async (req, res) => {
    try {
        const { orderId, reason } = req.body;

        if (!orderId) {
            return res.status(400).json({ error: 'Missing orderId' });
        }

        const { data: order, error: orderError } = await supabase
            .from('gig_requests')
            .select('status, payment_status, payment_intent_id, provider_id, requester_id, gig:gigs(title), provider:profiles!provider_id(full_name)')
            .eq('id', orderId)
            .single();

        if (orderError || !order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        if (order.provider_id !== req.user.id) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        if (!['unpaid', 'escrowed'].includes(order.payment_status)) {
            return res.status(400).json({ error: 'Order cannot be cancelled at this stage' });
        }

        if (!['pending', 'accepted', 'in_progress'].includes(order.status)) {
            return res.status(400).json({ error: 'Order cannot be cancelled at this stage' });
        }

        // If buyer already paid, refund via Stripe first
        if (order.payment_status === 'escrowed' && order.payment_intent_id) {
            try {
                await stripe.refunds.create({ payment_intent: order.payment_intent_id });
            } catch (stripeErr) {
                console.error('Stripe refund failed during cancel:', stripeErr.message);
                return res.status(500).json({ error: 'Refund failed — order not cancelled. Please try again.' });
            }
        }

        const { error } = await supabase
            .from('gig_requests')
            .update({
                status: 'cancelled',
                payment_status: order.payment_status === 'escrowed' ? 'withdrawn' : order.payment_status,
                dispute_resolution: reason || 'Cancelled by seller',
                dispute_resolved_date: new Date().toISOString(),
            })
            .eq('id', orderId);

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        // Notify buyer
        const gigTitle = order.gig?.title ?? 'your order';
        const sellerName = order.provider?.full_name ?? 'The seller';
        const wasRefunded = order.payment_status === 'escrowed';
        await supabase.from('notifications').insert({
            user_id: order.requester_id,
            type: 'order_cancelled',
            title: 'Order cancelled by seller',
            message: wasRefunded
                ? `${sellerName} cancelled your order for "${gigTitle}". A full refund has been issued.`
                : `${sellerName} declined your order for "${gigTitle}".`,
            related_id: orderId,
            related_type: 'gig',
        });

        res.json({ success: true, message: 'Order cancelled' });
    } catch (err) {
        console.error('Cancel error:', err);
        res.status(500).json({ error: err.message });
    }
})

// ═══════════════════════════════════════════════════════════════════════════
// RESPOND TO REQUEST - Seller accepts or declines a buyer request
// ═══════════════════════════════════════════════════════════════════════════
router.post('/respond', async (req, res) => {
    try {
        const { orderId, status } = req.body;

        if (!orderId || !['accepted', 'declined'].includes(status)) {
            return res.status(400).json({ error: 'Missing or invalid orderId/status' });
        }

        const { data: order, error: orderError } = await supabase
            .from('gig_requests')
            .select('provider_id, requester_id, status, gig:gigs(title), provider:profiles!provider_id(full_name)')
            .eq('id', orderId)
            .single();

        if (orderError || !order) return res.status(404).json({ error: 'Order not found' });
        if (order.provider_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
        if (order.status !== 'pending') return res.status(400).json({ error: 'Order is no longer pending' });

        const { error } = await supabase
            .from('gig_requests')
            .update({ status })
            .eq('id', orderId);

        if (error) return res.status(500).json({ error: error.message });

        // Notify buyer
        const gigTitle = order.gig?.title ?? 'your request';
        const sellerName = order.provider?.full_name ?? 'The seller';
        await supabase.from('notifications').insert({
            user_id: order.requester_id,
            type: 'order_update',
            title: status === 'accepted' ? 'Request accepted!' : 'Request declined',
            message: status === 'accepted'
                ? `${sellerName} accepted your request for "${gigTitle}". Proceed to payment to get started.`
                : `${sellerName} declined your request for "${gigTitle}".`,
            related_id: orderId,
            related_type: 'gig',
        });

        // Email buyer if accepted
        if (status === 'accepted') {
            const buyerEmail = await getUserEmail(order.requester_id);
            if (buyerEmail) {
                const tpl = templates.orderAcceptedBuyer({
                    buyerName: 'there',
                    sellerName: order.provider?.full_name ?? 'The seller',
                    gigTitle: order.gig?.title ?? 'your order',
                    orderId,
                });
                sendEmail({ to: buyerEmail, ...tpl }).catch(err => console.error('Email failed:', err.message));
            }
        }

        res.json({ success: true, status });
    } catch (err) {
        console.error('Respond error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// CANCEL DISPUTE - Called when buyer cancels their own dispute
// ═══════════════════════════════════════════════════════════════════════════
router.post('/cancel-dispute', async (req, res) => {
    try {
        const { orderId } = req.body;
        if (!orderId) return res.status(400).json({ error: 'Missing orderId' });

        const { data: order, error: orderError } = await supabase
            .from('gig_requests')
            .select('requester_id, provider_id, payment_status, status, gig:gigs(title), requester:profiles!requester_id(full_name)')
            .eq('id', orderId)
            .single();

        if (orderError || !order) return res.status(404).json({ error: 'Order not found' });
        if (order.requester_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
        if (order.payment_status !== 'disputed') return res.status(400).json({ error: 'No active dispute on this order' });

        const { error } = await supabase
            .from('gig_requests')
            .update({
                payment_status: 'released',
                status: 'completed',
                dispute_reason: null,
                dispute_date: null,
                dispute_resolution: 'Dispute cancelled by buyer',
                dispute_resolved_date: new Date().toISOString(),
                clearance_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
            })
            .eq('id', orderId);

        if (error) return res.status(500).json({ error: error.message });

        // Notify seller
        const gigTitle = order.gig?.title ?? 'an order';
        const buyerName = order.requester?.full_name ?? 'The buyer';
        await supabase.from('notifications').insert({
            user_id: order.provider_id,
            type: 'order_update',
            title: 'Dispute cancelled',
            message: `${buyerName} cancelled their dispute on "${gigTitle}". The order is now complete.`,
            related_id: orderId,
            related_type: 'gig',
        });

        res.json({ success: true, message: 'Dispute cancelled' });
    } catch (err) {
        console.error('Cancel dispute error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// CREATE DISPUTE - Called when buyer files a dispute
// ═══════════════════════════════════════════════════════════════════════════
router.post('/dispute', async (req, res) => {
    try {
        const { orderId, reason } = req.body;

        if (!orderId || !reason) {
            return res.status(400).json({ error: 'Missing orderId or reason' });
        }

        const { data: order, error: orderError } = await supabase
            .from('gig_requests')
            .select('requester_id, provider_id, payment_status, status, gig:gigs(title), requester:profiles!requester_id(full_name)')
            .eq('id', orderId)
            .single();
        if (orderError || !order) return res.status(404).json({ error: 'Order not found' });
        if (order.requester_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
        if (order.payment_status === 'disputed' || order.status === 'disputed') {
            return res.status(409).json({ error: 'A dispute is already in progress for this order' });
        }

        // Update order — mark as disputed
        const { error } = await supabase
            .from('gig_requests')
            .update({
                payment_status: 'disputed',
                status: 'disputed',
                dispute_reason: reason,
                dispute_date: new Date().toISOString()
            })
            .eq('id', orderId);

        if (error) return res.status(500).json({ error: error.message });

        // ── Send notifications ────────────────────────────────────────────────
        const gigTitle = order.gig?.title ?? 'an order';
        const buyerName = order.requester?.full_name ?? 'The buyer';

        // Get admin user ID via profiles table
        const { data: adminProfile } = await supabase
            .from('profiles').select('id').eq('email', process.env.ADMIN_EMAIL).single();
        const adminUser = adminProfile;

        const notifs = [
            // Buyer: confirmation
            {
                user_id: order.requester_id,
                type: 'dispute_filed',
                title: 'Dispute submitted',
                message: `Your dispute for "${gigTitle}" has been filed. Our support team will review it shortly.`,
                related_id: orderId,
                related_type: 'gig',
            },
            // Seller: alert
            {
                user_id: order.provider_id,
                type: 'dispute_filed',
                title: 'A buyer has filed a dispute',
                message: `${buyerName} filed a dispute on "${gigTitle}". You may reach out to them directly to resolve this before admin reviews it.`,
                related_id: orderId,
                related_type: 'gig',
            },
        ];

        if (adminUser) {
            notifs.push({
                user_id: adminUser.id,
                type: 'dispute_filed',
                title: 'New dispute filed',
                message: `${buyerName} filed a dispute on "${gigTitle}". Review in the admin panel.`,
                related_id: orderId,
                related_type: 'gig',
            });
        }

        await supabase.from('notifications').insert(notifs);

        res.json({ success: true, message: 'Dispute filed successfully' });
    } catch (err) {
        console.error('Create dispute error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// REFUND PAYMENT - Called when dispute is resolved in buyer's favor (admin only)
// ═══════════════════════════════════════════════════════════════════════════
router.post('/refund', async (req, res) => {
    try {
        if (req.user.email !== process.env.ADMIN_EMAIL) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const { orderId } = req.body;

        if (!orderId) {
            return res.status(400).json({ error: 'Missing orderId' });
        }

        // Get order with payment intent
        const { data: order, error: orderError } = await supabase
            .from('gig_requests')
            .select('payment_intent_id, requester_id')
            .eq('id', orderId)
            .single();

        if (orderError || !order) return res.status(404).json({ error: 'Order not found' });

        if (!order.payment_intent_id) {
            return res.status(400).json({ error: 'No payment to refund' });
        }

        // Refund via Stripe
        await stripe.refunds.create({
            payment_intent: order.payment_intent_id
        });

        // Update database
        const { error } = await supabase
            .from('gig_requests')
            .update({
                status: 'withdrawn',
                payment_status: 'withdrawn',
                dispute_resolved_date: new Date().toISOString(),
                dispute_resolution: 'Withdrawn by buyer'
            })
            .eq('id', orderId);

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.json({ success: true, message: 'Payment withdrawn' });
    } catch (err) {
        console.error('Refund error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// MARK DELIVERED - Called when seller marks services as delivered
// ═══════════════════════════════════════════════════════════════════════════
router.post('/deliver', async (req, res) => {
    try {
        const { orderId } = req.body;

        if (!orderId) {
            return res.status(400).json({ error: 'Missing orderId' });
        }

        const { data: order, error: orderError } = await supabase
            .from('gig_requests')
            .select('status, payment_status, provider_id')
            .eq('id', orderId)
            .single();

        if (orderError || !order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        if (order.provider_id !== req.user.id) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        if (order.payment_status !== 'escrowed') {
            return res.status(400).json({ error: 'Payment is not in escrow' });
        }

        if (!['accepted', 'in_progress'].includes(order.status)) {
            return res.status(400).json({ error: 'Order cannot be marked as delivered' });
        }

        const { error } = await supabase
            .from('gig_requests')
            .update({
                status: 'delivered',
                auto_release_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
            })
            .eq('id', orderId);

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        // Notify buyer
        const { data: fullOrder } = await supabase
            .from('gig_requests')
            .select('requester_id, gig:gigs(title), provider:profiles!provider_id(full_name)')
            .eq('id', orderId).single();
        if (fullOrder) {
            await supabase.from('notifications').insert({
                user_id: fullOrder.requester_id,
                type: 'order_update',
                title: 'Work delivered!',
                message: `${fullOrder.provider?.full_name ?? 'The seller'} has marked "${fullOrder.gig?.title ?? 'your order'}" as delivered. Review and release payment, or file a dispute.`,
                related_id: orderId,
                related_type: 'gig',
            });
        }

        // Email buyer: work delivered
        if (fullOrder) {
            const buyerEmail = await getUserEmail(fullOrder.requester_id);
            if (buyerEmail) {
                const tpl = templates.workDeliveredBuyer({
                    buyerName: 'there',
                    sellerName: fullOrder.provider?.full_name ?? 'The seller',
                    gigTitle: fullOrder.gig?.title ?? 'your order',
                    orderId,
                });
                sendEmail({ to: buyerEmail, ...tpl }).catch(err => console.error('Email failed:', err.message));
            }
        }

        res.json({ success: true, message: 'Order marked as delivered' });
    } catch (err) {
        console.error('Deliver error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// SUBMIT EVIDENCE - Called when a party submits dispute evidence
// ═══════════════════════════════════════════════════════════════════════════
router.post('/submit-evidence', async (req, res) => {
    try {
        const { orderId, content, imageUrl } = req.body;

        if (!orderId || !content?.trim()) {
            return res.status(400).json({ error: 'Missing orderId or content' });
        }

        if (content.trim().length > 5000) {
            return res.status(400).json({ error: 'Evidence content exceeds 5000 character limit' });
        }

        if (imageUrl) {
            try {
                const parsed = new URL(imageUrl);
                if (!['https:'].includes(parsed.protocol)) {
                    return res.status(400).json({ error: 'Image URL must use HTTPS' });
                }
            } catch {
                return res.status(400).json({ error: 'Invalid image URL' });
            }
        }

        // Verify user is a party to this dispute
        const { data: order, error: orderError } = await supabase
            .from('gig_requests')
            .select('requester_id, provider_id, payment_status, gig:gigs(title)')
            .eq('id', orderId)
            .single();

        if (orderError || !order) return res.status(404).json({ error: 'Order not found' });
        if (order.requester_id !== req.user.id && order.provider_id !== req.user.id) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        if (order.payment_status !== 'disputed') {
            return res.status(400).json({ error: 'No active dispute on this order' });
        }

        const { error } = await supabase.from('dispute_evidence').insert({
            dispute_id: orderId,
            user_id: req.user.id,
            content: content.trim(),
            ...(imageUrl ? { image_url: imageUrl } : {}),
        });

        if (error) return res.status(500).json({ error: error.message });

        // Notify the other party
        const otherPartyId = order.requester_id === req.user.id ? order.provider_id : order.requester_id;
        await supabase.from('notifications').insert({
            user_id: otherPartyId,
            type: 'dispute_filed',
            title: 'New evidence submitted',
            message: `New evidence has been added to the dispute for "${order.gig?.title ?? 'your order'}".`,
            related_id: orderId,
            related_type: 'gig',
        });

        res.json({ success: true, message: 'Evidence submitted' });
    } catch (err) {
        console.error('Submit evidence error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET ORDER STATUS - Check payment status of an order
// ═══════════════════════════════════════════════════════════════════════════
router.get('/status/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;

        const { data: order, error } = await supabase
            .from('gig_requests')
            .select('id, status, payment_status, payment_amount, escrow_date, release_date, requester_id, provider_id')
            .eq('id', orderId)
            .single();

        if (error || !order) return res.status(404).json({ error: 'Order not found' });

        // Only buyer or seller can check status
        if (order.requester_id !== req.user.id && order.provider_id !== req.user.id) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const { requester_id: _r, provider_id: _p, ...safeOrder } = order;
        res.json(safeOrder);
    } catch (err) {
        console.error('Get status error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;