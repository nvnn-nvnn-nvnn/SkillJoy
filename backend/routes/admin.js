const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const supabase = require('../config/supabase');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
if (!ADMIN_EMAIL) throw new Error('ADMIN_EMAIL env var is not set');

// ═══════════════════════════════════════════════════════════════════════════
// RESOLVE DISPUTE - Admin only
// ═══════════════════════════════════════════════════════════════════════════
router.post('/resolve-dispute', async (req, res) => {
    try {
        if (req.user.email !== ADMIN_EMAIL) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const { orderId, resolution } = req.body; // resolution: 'refund' | 'release'

        if (!orderId || !resolution) {
            return res.status(400).json({ error: 'Missing orderId or resolution' });
        }

        const { data: order, error: orderError } = await supabase
            .from('gig_requests')
            .select(`
                *,
                gig:gigs(title),
                requester:profiles!requester_id(full_name),
                provider:profiles!provider_id(full_name)
            `)
            .eq('id', orderId)
            .single();

        if (orderError || !order) return res.status(404).json({ error: 'Order not found' });

        // Stripe refund if resolving in buyer's favor
        if (resolution === 'refund' && order.payment_intent_id) {
            try {
                await stripe.refunds.create({ payment_intent: order.payment_intent_id });
            } catch (stripeErr) {
                console.error('Stripe refund failed during resolve:', stripeErr.message);
                return res.status(500).json({ error: 'Stripe refund failed: ' + stripeErr.message });
            }
        }

        const newPaymentStatus = resolution === 'refund' ? 'refunded' : 'released';
        const newOrderStatus   = resolution === 'refund' ? 'withdrawn' : 'completed';
        const resolutionText   = resolution === 'refund' ? 'Refunded to buyer' : 'Released to seller';

        const { error: updateError } = await supabase
            .from('gig_requests')
            .update({
                payment_status: newPaymentStatus,
                status: newOrderStatus,
                dispute_resolved_date: new Date().toISOString(),
                dispute_resolution: resolutionText,
            })
            .eq('id', orderId);

        if (updateError) return res.status(500).json({ error: updateError.message });

        // ── Notify both parties ───────────────────────────────────────────
        const gigTitle = order.gig?.title ?? 'your order';

        await supabase.from('notifications').insert([
            {
                user_id: order.requester_id,
                type: 'dispute_resolved',
                title: resolution === 'refund'
                    ? 'Dispute resolved — refund issued'
                    : 'Dispute resolved — released to seller',
                message: resolution === 'refund'
                    ? `Your dispute for "${gigTitle}" has been resolved. A full refund has been issued to you.`
                    : `Your dispute for "${gigTitle}" has been reviewed. Payment was released to the seller.`,
                related_id: orderId,
                related_type: 'gig',
            },
            {
                user_id: order.provider_id,
                type: 'dispute_resolved',
                title: resolution === 'refund'
                    ? 'Dispute resolved — buyer refunded'
                    : 'Dispute resolved — payment released to you',
                message: resolution === 'refund'
                    ? `The dispute for "${gigTitle}" was resolved in the buyer's favor. The payment was refunded.`
                    : `The dispute for "${gigTitle}" has been reviewed. Payment has been released to you.`,
                related_id: orderId,
                related_type: 'gig',
            },
        ]);

        res.json({ success: true, message: resolutionText });
    } catch (err) {
        console.error('Resolve dispute error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// MANUAL CLEARANCE TRIGGER - Admin only, for testing
// ═══════════════════════════════════════════════════════════════════════════
router.post('/run-clearance', async (req, res) => {
    try {
        // Check admin via email or profile lookup as fallback
        const userEmail = req.user.email;
        const userId = req.user.id;

        let isAdmin = userEmail === ADMIN_EMAIL;
        if (!isAdmin) {
            const { data: profile } = await supabase.from('profiles').select('email').eq('id', userId).single();
            isAdmin = profile?.email === ADMIN_EMAIL;
        }
        if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

        const { SERVICE_FEE_CENTS } = require('../config/fees');
        const { orderId } = req.body; // optional — force-clear a specific order bypassing clearance_date

        let query = supabase
            .from('gig_requests')
            .select('id, provider_id, payment_amount, gig:gigs(title)')
            .eq('payment_status', 'released');

        if (orderId) {
            // Force-clear a specific order regardless of clearance_date
            query = query.eq('id', orderId);
        } else {
            query = query.lte('clearance_date', new Date().toISOString());
        }

        const { data: readyOrders, error } = await query;

        if (error) return res.status(500).json({ error: error.message });
        if (!readyOrders?.length) return res.json({ message: 'No orders ready for clearance.', processed: 0 });

        const results = [];

        for (const order of readyOrders) {
            const { data: provider } = await supabase
                .from('profiles')
                .select('stripe_account_id, stripe_onboarded')
                .eq('id', order.provider_id)
                .single();

            if (!provider?.stripe_account_id || !provider?.stripe_onboarded) {
                results.push({ id: order.id, status: 'skipped', reason: 'No Stripe account' });
                continue;
            }

            try {
                const transferAmount = Math.round(order.payment_amount * 100) - SERVICE_FEE_CENTS;
                console.log(`Attempting transfer: $${transferAmount / 100} to ${provider.stripe_account_id} for order ${order.id}`);
                await stripe.transfers.create({
                    amount: transferAmount,
                    currency: 'usd',
                    destination: provider.stripe_account_id,
                    transfer_group: order.id,
                });
                await supabase.from('gig_requests').update({ payment_status: 'cleared' }).eq('id', order.id);
                console.log(`✅ Transfer succeeded for order ${order.id}`);
                results.push({ id: order.id, status: 'cleared', amount: transferAmount / 100 });
            } catch (err) {
                console.error(`❌ Transfer failed for order ${order.id}:`, err.message);
                results.push({ id: order.id, status: 'failed', reason: err.message });
            }
        }

        res.json({ processed: readyOrders.length, results });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// REMOVE GIG - Admin only
// ═══════════════════════════════════════════════════════════════════════════
router.post('/remove-gig', async (req, res) => {
    try {
        if (req.user.email !== ADMIN_EMAIL) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const { gigId, reason } = req.body;
        if (!gigId) return res.status(400).json({ error: 'Missing gigId' });

        // Fetch gig + owner before deleting so we can notify them
        const { data: gig, error: fetchErr } = await supabase
            .from('gigs')
            .select('id, title, user_id')
            .eq('id', gigId)
            .single();

        if (fetchErr || !gig) return res.status(404).json({ error: 'Gig not found' });

        // Delete the gig (service key bypasses RLS)
        const { error: deleteErr } = await supabase
            .from('gigs')
            .delete()
            .eq('id', gigId);

        if (deleteErr) return res.status(500).json({ error: deleteErr.message });

        // Notify the owner
        await supabase.from('notifications').insert({
            user_id: gig.user_id,
            type: 'gig_removed',
            title: 'Your gig was removed',
            message: reason
                ? `Your gig "${gig.title}" was removed by an admin. Reason: ${reason}`
                : `Your gig "${gig.title}" was removed by an admin for violating platform guidelines.`,
            related_type: 'gig',
        });

        res.json({ success: true });
    } catch (err) {
        console.error('Remove gig error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// FINANCES - Admin only, platform balance breakdown
// ═══════════════════════════════════════════════════════════════════════════
router.get('/finances', async (req, res) => {
    try {
        if (req.user.email !== ADMIN_EMAIL) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const { SERVICE_FEE_DOLLARS } = require('../config/fees');

        // 1. Live Stripe platform balance
        const balance = await stripe.balance.retrieve();
        const stripeAvailable = balance.available.reduce((sum, b) => sum + b.amount, 0) / 100;
        const stripePending   = balance.pending.reduce((sum, b) => sum + b.amount, 0) / 100;
        const stripeTotal     = stripeAvailable + stripePending;

        // 2. Orders released but not yet transferred to sellers (still in clearance window)
        const { data: releasedOrders, error } = await supabase
            .from('gig_requests')
            .select('id, payment_amount, clearance_date, gig:gigs(title), provider:profiles!provider_id(full_name)')
            .eq('payment_status', 'released')
            .order('clearance_date', { ascending: true });

        if (error) return res.status(500).json({ error: error.message });

        const owedToSellers = (releasedOrders ?? []).reduce((sum, o) => {
            return sum + Math.max(0, (o.payment_amount ?? 0) - SERVICE_FEE_DOLLARS);
        }, 0);

        // 3. All-time fees collected from cleared orders
        const { data: clearedOrders } = await supabase
            .from('gig_requests')
            .select('id')
            .eq('payment_status', 'cleared');

        const totalFeesEarned = (clearedOrders?.length ?? 0) * SERVICE_FEE_DOLLARS;

        // 4. Your actual profit sitting in Stripe right now
        const actualProfit = stripeTotal - owedToSellers;

        res.json({
            stripeAvailable,
            stripePending,
            stripeTotal,
            owedToSellers: parseFloat(owedToSellers.toFixed(2)),
            actualProfit: parseFloat(actualProfit.toFixed(2)),
            totalFeesEarned: parseFloat(totalFeesEarned.toFixed(2)),
            pendingTransfers: releasedOrders ?? [],
        });
    } catch (err) {
        console.error('Finances error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// REPORTS - Admin only
// ═══════════════════════════════════════════════════════════════════════════
router.get('/reports', async (req, res) => {
    try {
        if (req.user.email !== ADMIN_EMAIL) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const { data, error } = await supabase
            .from('reports')
            .select('*, reporter:profiles!reporter_id(id, full_name)')
            .order('created_at', { ascending: false });

        if (error) return res.status(500).json({ error: error.message });

        // For each report, fetch the reported entity name
        const enriched = await Promise.all((data ?? []).map(async (r) => {
            if (r.reported_type === 'gig') {
                const { data: gig } = await supabase.from('gigs').select('id, title, user_id, profile:profiles!user_id(full_name)').eq('id', r.reported_id).single();
                return { ...r, reported_name: gig?.title ?? 'Unknown gig', reported_owner: gig?.profile?.full_name ?? null };
            } else {
                const { data: profile } = await supabase.from('profiles').select('id, full_name').eq('id', r.reported_id).single();
                return { ...r, reported_name: profile?.full_name ?? 'Unknown user' };
            }
        }));

        res.json(enriched);
    } catch (err) {
        console.error('Fetch reports error:', err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/dismiss-report', async (req, res) => {
    try {
        if (req.user.email !== ADMIN_EMAIL) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const { reportId } = req.body;
        if (!reportId) return res.status(400).json({ error: 'Missing reportId' });

        const { error } = await supabase
            .from('reports')
            .update({ status: 'dismissed' })
            .eq('id', reportId);

        if (error) return res.status(500).json({ error: error.message });

        res.json({ success: true });
    } catch (err) {
        console.error('Dismiss report error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
