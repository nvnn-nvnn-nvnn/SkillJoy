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
const contactRoutes = require('./routes/contact.js');
const verifyCollegeRoutes = require('./routes/verify-college.js');
const reportRoutes = require('./routes/reports.js');
const blockRoutes = require('./routes/blocks.js');
const rateLimit = require('express-rate-limit');
const { sendEmail, getUserEmail, templates } = require('./lib/email');
const { SERVICE_FEE_CENTS } = require('./config/fees');

// Global limiter: 200 req per 15 min per IP
const globalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false });

// Strict limiter: 30 req per 15 min — for payment actions
const strictLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests, please try again later.' } });

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3001;

app.use(cors({
    origin: process.env.NODE_ENV === 'production'
        ? process.env.FRONTEND_URL
        : '*',
    credentials: true,
}));
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
app.use('/api/users', authMiddleware, userRoutes);


// Stripe Connect

app.use('/api/stripe-connect', authMiddleware, stripeConnectRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/verify-college', authMiddleware, verifyCollegeRoutes);
app.use('/api/reports', authMiddleware, reportRoutes);
app.use('/api/blocks', authMiddleware, blockRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});


app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});

function withTimeout(ms, fn) {
    return Promise.race([
        fn(),
        new Promise((_, reject) => setTimeout(() => reject(new Error(`Cron timed out after ${ms}ms`)), ms)),
    ]);
}

// ── Auto-release cron ─────────────────────────────────────────────────────────
// Runs daily at midnight. Finds orders where the buyer hasn't acted within
// 3 days of delivery and automatically releases funds to the seller.
cron.schedule('0 0 * * *', () => {
    withTimeout(30 * 60 * 1000, async () => {
        console.log('⏰ Auto-release cron running:', new Date().toISOString());

        const { data: overdueOrders, error } = await supabase
            .from('gig_requests')
            .select('id, requester_id, provider_id, payment_amount, gig:gigs(title)')
            .eq('payment_status', 'escrowed')
            .eq('status', 'delivered')
            .lte('auto_release_date', new Date().toISOString());

        if (error) { console.error('Auto-release query error:', error.message); return; }
        if (!overdueOrders?.length) { console.log('No orders to auto-release.'); return; }

        for (const order of overdueOrders) {
            const clearanceDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

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
    }).catch(err => console.error('Auto-release cron error:', err.message));
});

// ── Clearance cron ────────────────────────────────────────────────────────────
// Runs daily at 1am. Finds orders past their 14-day clearance window and
// transfers funds to the seller's Stripe Connect account.
cron.schedule('0 1 * * *', () => {
    withTimeout(30 * 60 * 1000, async () => {
        console.log('⏰ Clearance cron running:', new Date().toISOString());

        const { data: readyOrders, error } = await supabase
            .from('gig_requests')
            .select('id, provider_id, payment_amount, clearance_date, gig:gigs(title)')
            .eq('payment_status', 'released')
            .lte('clearance_date', new Date().toISOString());

        if (error) { console.error('Clearance query error:', error.message); return; }
        if (!readyOrders?.length) { console.log('No orders ready for clearance.'); return; }

        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

        if (process.env.PAUSE_CLEARANCE === 'true') {
            console.log('⏸️ Clearance paused via PAUSE_CLEARANCE env var. Skipping transfers.');
            return;
        }

        for (const order of readyOrders) {
            const { data: provider } = await supabase
                .from('profiles')
                .select('stripe_account_id, stripe_onboarded')
                .eq('id', order.provider_id)
                .single();

            if (!provider?.stripe_account_id || !provider?.stripe_onboarded) {
                console.warn(`Clearance: provider ${order.provider_id} has no Stripe account. Skipping.`);
                const gigTitle = order.gig?.title ?? 'your order';
                await supabase.from('notifications').insert({
                    user_id: order.provider_id,
                    type: 'payout_setup_required',
                    title: 'Action required: Set up payouts to receive funds',
                    message: `Funds for "${gigTitle}" are ready to be transferred but your Stripe payout account isn't connected. Visit your profile to set up payouts or you will not receive payment.`,
                    related_id: order.id,
                    related_type: 'gig',
                });
                continue;
            }

            // Verify the Stripe account is still active (not disabled/restricted since onboarding)
            try {
                const account = await stripe.accounts.retrieve(provider.stripe_account_id);
                if (!account.payouts_enabled) {
                    console.warn(`Clearance: Stripe account for provider ${order.provider_id} has payouts disabled. Skipping.`);
                    const gigTitle = order.gig?.title ?? 'your order';
                    await supabase.from('notifications').insert({
                        user_id: order.provider_id,
                        type: 'payout_setup_required',
                        title: 'Action required: Stripe account restricted',
                        message: `Your Stripe account has restrictions that prevent payouts for "${gigTitle}". Please update your Stripe details to receive funds.`,
                        related_id: order.id,
                        related_type: 'gig',
                    });
                    continue;
                }
            } catch (stripeAccountErr) {
                console.error(`Clearance: Could not verify Stripe account for provider ${order.provider_id}:`, stripeAccountErr.message);
                continue;
            }

            try {
                const transferAmount = Math.round(order.payment_amount * 100) - SERVICE_FEE_CENTS;
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

                const sellerEmail = await getUserEmail(order.provider_id);
                if (sellerEmail) {
                    sendEmail({
                        to: sellerEmail,
                        ...templates.fundsCleared({
                            sellerName: 'there',
                            gigTitle,
                            amount: ((order.payment_amount * 100 - SERVICE_FEE_CENTS) / 100).toFixed(2),
                        }),
                    });
                }

                console.log(`✅ Cleared order ${order.id}`);
            } catch (err) {
                console.error(`Clearance transfer failed for order ${order.id}:`, err.message);
            }
        }

        console.log(`Clearance cron done. Processed ${readyOrders.length} order(s).`);
    }).catch(err => console.error('Clearance cron error:', err.message));
});

// ── Chat archive cron ─────────────────────────────────────────────────────────
// Runs hourly. Archives completed gig chats 24h after completion.
cron.schedule('0 * * * *', () => {
    withTimeout(5 * 60 * 1000, async () => {
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { error } = await supabase
            .from('gig_requests')
            .update({ chat_archived_at: new Date().toISOString() })
            .eq('status', 'completed')
            .is('chat_archived_at', null)
            .lte('release_date', cutoff);
        if (error) console.error('Chat archive cron error:', error.message);
        else console.log('✅ Chat archive cron ran');
    }).catch(err => console.error('Chat archive cron error:', err.message));
});