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

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());

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

app.use('/api/payments', authMiddleware, paymentRoutes);
app.use('/api/admin', authMiddleware, adminRoutes);
app.use('/api/users', userRoutes);

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
        const { error: releaseError } = await supabase
            .from('gig_requests')
            .update({
                payment_status: 'released',
                status: 'completed',
                release_date: new Date().toISOString(),
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
                    title: 'Payment auto-released!',
                    message: `Payment for "${gigTitle}" was automatically released after 3 days. The funds are on their way.`,
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