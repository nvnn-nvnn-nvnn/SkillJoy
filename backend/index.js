require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const supabase = require('./config/supabase');
const authMiddleware = require('./middleware/auth');
const paymentRoutes = require('./routes/payments.js');
const userRoutes = require('./routes/users.js');
const webhookRoutes = require('./routes/webhooks.js');
const adminRoutes = require('./routes/admin.js');
const stripeConnectRoutes = require('./routes/stripe-connect.js');
const rateLimit = require('express-rate-limit');

// Global limiter: 200 req per 15 min per IP
const globalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false });

// Strict limiter: 30 req per 15 min — for payment actions
const strictLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests, please try again later.' } });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(globalLimiter);

// Webhook must be BEFORE express.json() to receive raw body
app.use('/webhooks', (req, res, next) => {
    console.log('\n📨 WEBHOOK REQUEST RECEIVED:', new Date().toISOString());
    console.log('  Method:', req.method);
    console.log('  URL:', req.url);
    console.log('  Headers:', Object.keys(req.headers));
    next();
}, webhookRoutes);

// JSON parsing for all other routes
app.use(express.json());

app.use('/api/payments', strictLimiter, authMiddleware, paymentRoutes);
app.use('/api/admin', authMiddleware, adminRoutes);
app.use('/api/users', userRoutes);


// Stripe Connect

app.use('/api/stripe-connect' , authMiddleware,
     stripeConnectRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});


app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});

// ── Auto-release cron ─────────────────────────────────────────────────────────
// Runs daily at midnight. Finds orders where the buyer hasn't acted within
// 3 days of delivery and automatically releases funds to the seller.
cron.schedule('0 0 * * *', async () => {
    console.log('⏰ Auto-release cron running:', new Date().toISOString());

    const { data: overdueOrders, error } = await supabase
        .from('gig_requests')
        .select('id, requester_id, provider_id, gig:gigs(title)')
        .eq('payment_status', 'escrowed')
        .eq('status', 'delivered')
        .lte('auto_release_date', new Date().toISOString());

    if (error) { console.error('Auto-release query error:', error.message); return; }
    if (!overdueOrders?.length) { console.log('No orders to auto-release.'); return; }

    for (const order of overdueOrders) {
        const clearanceDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
        
        // Edgecases

        if (!order){
            console.error(`There is no order to return`)
            return
        }

        // Find Profile 

        const { data: profileProvider, error : profileError } = await supabase
            .from('profile')
            .select('striple_account_id', 'stripe_onboarded')
            .eq('id', order.id)
            .single()

            if (!providerProfile?.stripe_account_id || !providerProfile?.stripe_onboarded) {
            console.warn(`Provider ${order.provider_id} has no Stripe account. Funds Held`)
            } else{

                // Find Payment Status
                


            }

            
        


        
        const { error: releaseError } = await supabase
            .from('gig_requests')
            .update({
                payment_status: 'released',
                status: 'completed',
                release_date: new Date().toISOString(),
                clearance_date: clearanceDate,
            })
            .eq('id', order.id);

        if (releaseError) {
            console.error(`Failed to auto-release order ${order.id}:`, releaseError.message);
        } else {
            console.log(`✅ Auto-released order ${order.id}`);
            const gigTitle = order.gig?.title ?? 'your order';
            await supabase.from('notifications').insert([
                {
                    user_id: order.provider_id,
                    type: 'order_update',
                    title: 'Payment auto-released — clearance started',
                    message: `Payment for "${gigTitle}" was automatically released after 3 days. Funds will be available in 14 days.`,
                    related_id: order.id, related_type: 'gig',
                },
                {
                    user_id: order.requester_id,
                    type: 'gig_completed',
                    title: 'Order auto-completed',
                    message: `Payment for "${gigTitle}" was automatically released to the seller after 3 days with no action from you.`,
                    related_id: order.id, related_type: 'gig',
                },
            ]);
        }
    }

    console.log(`Auto-release done. Processed ${overdueOrders.length} order(s).`);
});

// ── Clearance cron ────────────────────────────────────────────────────────────
// Runs daily at 1am. Finds orders past their 14-day clearance window and
// transfers funds to the seller's Stripe Connect account.
cron.schedule('0 1 * * *', async () => {
    console.log('⏰ Clearance cron running:', new Date().toISOString());

    const { data: readyOrders, error } = await supabase
        .from('gig_requests')
        .select('id, provider_id, payment_amount, clearance_date, gig:gigs(title)')
        .eq('payment_status', 'released')
        .lte('clearance_date', new Date().toISOString());

    if (error) { console.error('Clearance query error:', error.message); return; }
    if (!readyOrders?.length) { console.log('No orders ready for clearance.'); return; }

    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const SERVICE_FEES_CENTS = 600;

    for (const order of readyOrders) {
        const { data: provider } = await supabase
            .from('profiles')
            .select('stripe_account_id, stripe_onboarded')
            .eq('id', order.provider_id)
            .single();

        if (!provider?.stripe_account_id || !provider?.stripe_onboarded) {
            console.warn(`Clearance: provider ${order.provider_id} has no Stripe account. Skipping.`);
            continue;
        }

        try {
            const transferAmount = Math.round(order.payment_amount * 100) - SERVICE_FEES_CENTS;
            await stripe.transfers.create({
                amount: transferAmount,
                currency: 'usd',
                destination: provider.stripe_account_id,
                transfer_group: order.id,
            });

            await supabase.from('gig_requests').update({ payment_status: 'cleared' }).eq('id', order.id);

            const gigTitle = order.gig?.title ?? 'your order';
            await supabase.from('notifications').insert({
                user_id: order.provider_id,
                type: 'order_update',
                title: 'Funds cleared!',
                message: `Your earnings for "${gigTitle}" have cleared and are on their way to your Stripe account.`,
                related_id: order.id, related_type: 'gig',
            });

            console.log(`✅ Cleared order ${order.id}`);
        } catch (err) {
            console.error(`Clearance transfer failed for order ${order.id}:`, err.message);
        }
    }

    console.log(`Clearance cron done. Processed ${readyOrders.length} order(s).`);
});

// ── Chat archive cron ─────────────────────────────────────────────────────────
// Runs hourly. Archives completed gig chats 24h after completion.
cron.schedule('0 * * * *', async () => {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase
        .from('gig_requests')
        .update({ chat_archived_at: new Date().toISOString() })
        .eq('status', 'completed')
        .is('chat_archived_at', null)
        .lte('release_date', cutoff);
    if (error) console.error('Chat archive cron error:', error.message);
    else console.log('✅ Chat archive cron ran');
});