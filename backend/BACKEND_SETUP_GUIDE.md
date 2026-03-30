# Backend Setup Guide - Escrow Payment System

## Quick Start

```bash
cd backend
npm install
npm run dev
```

---

## Environment Variables

Create `backend/.env`:

```bash
# Server
PORT=3001
NODE_ENV=development

# Supabase (use service key for backend)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJ...your-service-key

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5173
```

---

## Fix Your Current Files

### 1. `backend/index.js` - Fix typo

```javascript
// Change this:
require('dotenv').congfig();  // TYPO!

// To this:
require('dotenv').config();
```

Also fix the route paths (missing leading slash):

```javascript
// Change this:
app.use('api/payments', paymentRoutes);
app.use('api/users', userRoutes);

// To this:
app.use('/api/payments', paymentRoutes);
app.use('/api/users', userRoutes);
```

### 2. `backend/config/supabase.js` - Fix require syntax

```javascript
// Change this:
const { createClient } = '@supabase/supabase-js';

// To this:
const { createClient } = require('@supabase/supabase-js');
```

### 3. `backend/routes/payments.js` - Fix typo

```javascript
// Change this:
const { createEscrowTransaction, updateEscrowStatus } = require('..services/payments');

// To this:
const { createEscrowTransaction, updateEscrowStatus } = require('../services/payments');
```

---

## MyOrders.jsx - How It Works

### Payment Flow Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        BUYER JOURNEY                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. BROWSE GIGS                                                 │
│     └── User clicks "Hire" on GigDetails page                   │
│     └── Creates gig_request with status: 'pending'              │
│                                                                 │'
│  2. MY ORDERS PAGE (Buying Tab)                                 │
│     └── Shows order with "Accept & Pay" button                  │
│     └── handleAcceptOrder() opens payment modal                 │
│                                                                 │
│  3. PAYMENT MODAL                                               │
│     └── Shows gig price and escrow info                         │
│     └── confirmPayment() called when user clicks "Confirm"      │
│     └── YOUR BACKEND: Create Stripe Payment Intent              │
│     └── Update: payment_status = 'escrowed'                     │
│                                                                 │
│  4. WORK IN PROGRESS                                            │
│     └── Provider delivers work via Chat                         │
│     └── Provider marks as delivered                             │
│     └── Update: status = 'delivered'                            │
│     └── Set: auto_release_date = NOW + 3 days                   │
│                                                                 │
│  5. REVIEW PERIOD (3 days)                                      │
│     └── Buyer sees "Release Payment" + "File Dispute" buttons   │
│     └── handleReleasePayment() → payment_status = 'released'    │
│     └── handleDispute() → payment_status = 'disputed'           │
│     └── OR auto-release after 3 days (cron job)                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Key Functions in MyOrders.jsx

| Function | Line | What It Does | Backend Needed |
|----------|------|--------------|----------------|
| `loadOrders()` | 43 | Fetches orders from Supabase | No |
| `handleAcceptOrder()` | 75 | Opens payment modal | No |
| `confirmPayment()` | 80 | Processes payment | **YES** |
| `handleReleasePayment()` | 119 | Releases funds to provider | **YES** |
| `handleDispute()` | 144 | Creates dispute | **YES** |

---

## Backend Endpoints to Implement

### 1. POST `/api/payments/create-intent`

**Called by:** `confirmPayment()` in MyOrders.jsx (when TEST_MODE=false)

**Request:**
```json
{
  "orderId": "uuid-of-gig-request",
  "amount": 50.00
}
```

**What to do:**
```javascript
router.post('/create-intent', async (req, res) => {
    const { orderId, amount } = req.body;
    
    // 1. Verify order exists and belongs to user
    const { data: order } = await supabase
        .from('gig_requests')
        .select('*')
        .eq('id', orderId)
        .single();
    
    if (!order) return res.status(404).json({ error: 'Order not found' });
    
    // 2. Create Stripe Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Stripe uses cents
        currency: 'usd',
        metadata: { orderId }
    });
    
    // 3. Return client secret for frontend
    res.json({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id
    });
});
```

### 1b. POST `/api/payments/test-confirm`

**Called by:** `confirmPayment()` in MyOrders.jsx (when TEST_MODE=true)

**Request:**
```json
{
  "orderId": "uuid",
  "amount": 50.00
}
```

**What to do:**
```javascript
router.post('/test-confirm', async (req, res) => {
    const { orderId, amount } = req.body;
    
    // Skip Stripe, directly update database
    const { error } = await supabase
        .from('gig_requests')
        .update({
            payment_status: 'escrowed',
            payment_amount: amount,
            payment_intent_id: 'test_' + Date.now(),
            escrow_date: new Date().toISOString(),
            status: 'accepted'
        })
        .eq('id', orderId);
    
    if (error) return res.status(500).json({ error: error.message });
    
    res.json({ success: true });
});
```

### 2. POST `/api/payments/confirm`

**Called after:** Stripe payment succeeds on frontend

**Request:**
```json
{
  "orderId": "uuid",
  "paymentIntentId": "pi_xxx"
}
```

**What to do:**
```javascript
router.post('/confirm', async (req, res) => {
    const { orderId, paymentIntentId } = req.body;
    
    // 1. Verify payment with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.status !== 'succeeded') {
        return res.status(400).json({ error: 'Payment not successful' });
    }
    
    // 2. Update database
    const { error } = await supabase
        .from('gig_requests')
        .update({
            payment_status: 'escrowed',
            payment_amount: paymentIntent.amount / 100,
            payment_intent_id: paymentIntentId,
            escrow_date: new Date().toISOString(),
            status: 'accepted'
        })
        .eq('id', orderId);
    
    if (error) return res.status(500).json({ error: error.message });
    
    res.json({ success: true });
});
```

### 3. POST `/api/payments/release`

**Called by:** `handleReleasePayment()` in MyOrders.jsx

**Request:**
```json
{
  "orderId": "uuid"
}
```

**What to do:**
```javascript
router.post('/release', async (req, res) => {
    const { orderId } = req.body;
    
    // 1. Get order details
    const { data: order } = await supabase
        .from('gig_requests')
        .select('*, provider:profiles!provider_id(stripe_account_id)')
        .eq('id', orderId)
        .single();
    
    // 2. Transfer to provider (if using Stripe Connect)
    // For now, just mark as released
    
    // 3. Update database
    const { error } = await supabase
        .from('gig_requests')
        .update({
            payment_status: 'released',
            release_date: new Date().toISOString()
        })
        .eq('id', orderId);
    
    if (error) return res.status(500).json({ error: error.message });
    
    res.json({ success: true });
});
```

### 4. POST `/api/disputes/create`

**Called by:** `handleDispute()` in MyOrders.jsx

**Request:**
```json
{
  "orderId": "uuid",
  "reason": "Work not delivered as described"
}
```

**What to do:**
```javascript
router.post('/create', async (req, res) => {
    const { orderId, reason } = req.body;
    
    const { error } = await supabase
        .from('gig_requests')
        .update({
            payment_status: 'disputed',
            dispute_reason: reason,
            dispute_date: new Date().toISOString()
        })
        .eq('id', orderId);
    
    if (error) return res.status(500).json({ error: error.message });
    
    // TODO: Send notification to support team
    // TODO: Create support ticket
    
    res.json({ success: true });
});
```

---

## File Structure

```
backend/
├── index.js              # Express server entry point
├── package.json          # Dependencies
├── .env                  # Environment variables (NEVER commit)
├── config/
│   └── supabase.js       # Supabase client
├── routes/
│   ├── payments.js       # Payment endpoints
│   ├── disputes.js       # Dispute endpoints (create this)
│   └── users.js          # User endpoints
├── services/
│   ├── stripe.js         # Stripe helper functions
│   └── payments.js       # Payment business logic
└── middleware/
    └── auth.js           # Auth middleware (verify JWT)
```

---

## Complete payments.js Route File

```javascript
const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const supabase = require('../config/supabase');

// Create Payment Intent
router.post('/create-intent', async (req, res) => {
    try {
        const { orderId, amount } = req.body;
        
        // Validate
        if (!orderId || !amount) {
            return res.status(400).json({ error: 'Missing orderId or amount' });
        }
        
        // Create Stripe Payment Intent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100),
            currency: 'usd',
            metadata: { orderId }
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

// Confirm Payment (after Stripe success)
router.post('/confirm', async (req, res) => {
    try {
        const { orderId, paymentIntentId } = req.body;
        
        // Verify with Stripe
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        if (paymentIntent.status !== 'succeeded') {
            return res.status(400).json({ error: 'Payment not successful' });
        }
        
        // Update database
        const { error } = await supabase
            .from('gig_requests')
            .update({
                payment_status: 'escrowed',
                payment_amount: paymentIntent.amount / 100,
                payment_intent_id: paymentIntentId,
                escrow_date: new Date().toISOString(),
                status: 'accepted'
            })
            .eq('id', orderId);
        
        if (error) throw error;
        
        res.json({ success: true });
    } catch (err) {
        console.error('Confirm payment error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Release Payment to Provider
router.post('/release', async (req, res) => {
    try {
        const { orderId } = req.body;
        
        const { error } = await supabase
            .from('gig_requests')
            .update({
                payment_status: 'released',
                release_date: new Date().toISOString()
            })
            .eq('id', orderId);
        
        if (error) throw error;
        
        res.json({ success: true });
    } catch (err) {
        console.error('Release payment error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Refund Payment
router.post('/refund', async (req, res) => {
    try {
        const { orderId } = req.body;
        
        // Get payment intent ID
        const { data: order } = await supabase
            .from('gig_requests')
            .select('payment_intent_id')
            .eq('id', orderId)
            .single();
        
        if (!order?.payment_intent_id) {
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
                payment_status: 'refunded',
                dispute_resolved_date: new Date().toISOString()
            })
            .eq('id', orderId);
        
        if (error) throw error;
        
        res.json({ success: true });
    } catch (err) {
        console.error('Refund error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
```

---

## Frontend Integration

The frontend is already integrated! Two modes are available:

### Test Mode (Current Default)
```javascript
// In MyOrders.jsx, line 84:
const TEST_MODE = true; // Set to false for real Stripe

// Calls: POST /api/payments/test-confirm
// Skips Stripe, directly updates database
// Perfect for testing the flow
```

### Production Mode (Real Stripe)
```javascript
// Set TEST_MODE = false
// Calls: POST /api/payments/create-intent → POST /api/payments/confirm
// Requires Stripe Elements integration
```

### Accept & Pay Button
The button condition was simplified:
```javascript
// Before: {isBuyer && (order.status === 'pending' || order.status === 'accepted') && (!order.payment_status || order.payment_status === 'pending')}
// After:  {isBuyer && (order.status === 'pending' || order.status === 'accepted')}
```

**Why removed:** Backend already handles duplicate payments. Test mode is easier without the payment_status check.

---

## Cron Job for Auto-Release

Create `backend/cron/autoRelease.js`:

```javascript
const cron = require('node-cron');
const supabase = require('../config/supabase');

// Run daily at midnight
cron.schedule('0 0 * * *', async () => {
    console.log('Running auto-release check...');
    
    const { data: orders, error } = await supabase
        .from('gig_requests')
        .select('id')
        .eq('payment_status', 'escrowed')
        .eq('status', 'delivered')
        .lte('auto_release_date', new Date().toISOString());
    
    if (error) {
        console.error('Auto-release query error:', error);
        return;
    }
    
    for (const order of orders) {
        await supabase
            .from('gig_requests')
            .update({
                payment_status: 'released',
                release_date: new Date().toISOString()
            })
            .eq('id', order.id);
        
        console.log(`Auto-released order: ${order.id}`);
    }
});
```

---

## Next Steps Checklist

- [ ] Fix typos in your backend files (see "Fix Your Current Files" section)
- [ ] Create `backend/services/payments.js` with helper functions
- [ ] Create `backend/routes/disputes.js` for dispute endpoints
- [ ] Run the Supabase migration: `supabase migration up`
- [ ] Test `/api/payments/create-intent` endpoint
- [ ] Add Stripe Elements to frontend payment modal
- [ ] Test full payment flow
- [ ] Add cron job for auto-release
- [ ] Test dispute flow

---

## Testing

### Test Cards (Stripe Test Mode)

| Card Number | Result |
|-------------|--------|
| 4242 4242 4242 4242 | Success |
| 4000 0000 0000 0002 | Declined |
| 4000 0000 0000 9995 | Insufficient funds |

Use any future expiry date and any 3-digit CVC.
