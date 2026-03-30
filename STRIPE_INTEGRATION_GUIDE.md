# Stripe Integration Guide - Real Payment Processing

## Overview

This guide shows how to integrate real Stripe payments to replace the test mode in the escrow system.

---

## 1. Stripe Setup

### Create Stripe Account
1. Go to [stripe.com](https://stripe.com)
2. Sign up for an account
3. Complete verification (business details, bank account)
4. Switch to **Test Mode** first (toggle in dashboard)

### Get API Keys
In Stripe Dashboard → Developers → API keys:
- **Publishable Key** (pk_test_...) - For frontend
- **Secret Key** (sk_test_...) - For backend
- **Webhook Secret** (whsec_...) - For webhooks

---

## 2. Frontend Integration

### Install Stripe.js
```bash
npm install @stripe/stripe-js
```

### Add Stripe to MyOrders.jsx

```javascript
// Add at top of MyOrders.jsx
import { loadStripe } from '@stripe/stripe-js';

// Initialize Stripe
const stripe = await loadStripe('pk_test_your_publishable_key');
```

### Add Payment Element to Modal

Replace the placeholder in the payment modal:

```javascript
// In the payment modal JSX (around line 380)
{/* PLACEHOLDER: Stripe Payment Element */}
<div id="stripe-payment-element">
  <!-- Stripe Elements will mount here -->
</div>
```

### Update confirmPayment() Function

```javascript
async function confirmPayment() {
    if (!selectedOrder) return;

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    const TEST_MODE = false; // Set to false for real Stripe

    try {
        if (TEST_MODE) {
            // Test mode (keep for testing)
            const testRes = await fetch(`${API_URL}/api/payments/test-confirm`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orderId: selectedOrder.id,
                    amount: selectedOrder.gig.price
                })
            });

            const testData = await testRes.json();
            if (!testRes.ok) throw new Error(testData.error || 'Test payment failed');

            showToast('Test payment processed! Funds are in escrow.', 'success');
        } else {
            // REAL STRIPE MODE
            // Step 1: Create Payment Intent
            const intentRes = await fetch(`${API_URL}/api/payments/create-intent`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orderId: selectedOrder.id,
                    amount: selectedOrder.gig.price
                })
            });

            const intentData = await intentRes.json();
            if (!intentRes.ok) throw new Error(intentData.error || 'Failed to create payment');

            // Step 2: Confirm payment with Stripe Elements
            const { error: stripeError } = await stripe.confirmPayment({
                clientSecret: intentData.clientSecret,
                confirmParams: {
                    return_url: `${window.location.origin}/my-orders`,
                    payment_method_data: {
                        billing_details: {
                            name: 'Customer Name', // Get from user profile
                            email: 'customer@example.com' // Get from user profile
                        }
                    }
                },
            });

            if (stripeError) {
                throw new Error(stripeError.message);
            }

            // Step 3: Payment will be confirmed by webhook
            // Show loading state
            showToast('Processing payment...', 'success');
            
            // Wait a moment for webhook to process
            setTimeout(() => {
                loadOrders();
                setShowPaymentModal(false);
                setSelectedOrder(null);
            }, 3000);
        }

        setShowPaymentModal(false);
        setSelectedOrder(null);
        loadOrders();
    } catch (err) {
        showToast(err.message, 'error');
    }
}
```

---

## 3. Backend Updates

### Update Environment Variables

Add to `backend/.env`:
```bash
STRIPE_SECRET_KEY=sk_test_your_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
```

### Add Webhook Endpoint

Create `backend/routes/webhooks.js`:

```javascript
const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const supabase = require('../config/supabase');

// Stripe Webhook
router.post('/stripe', async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.log(`Webhook signature verification failed.`, err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
        case 'payment_intent.succeeded':
            const paymentIntent = event.data.object;
            
            // Update database
            const { error } = await supabase
                .from('gig_requests')
                .update({
                    payment_status: 'escrowed',
                    payment_amount: paymentIntent.amount / 100,
                    payment_intent_id: paymentIntent.id,
                    escrow_date: new Date().toISOString(),
                    status: 'accepted'
                })
                .eq('id', paymentIntent.metadata.orderId);

            if (error) {
                console.error('Database update error:', error);
            }
            
            console.log('Payment succeeded:', paymentIntent.id);
            break;

        case 'payment_intent.payment_failed':
            console.log('Payment failed:', event.data.object.id);
            break;

        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    // Return a 200 response to acknowledge receipt of the event
    res.send({ received: true });
});

module.exports = router;
```

### Add Webhook Route to index.js

```javascript
// In backend/index.js
const webhookRoutes = require('./routes/webhooks');

app.use('/api/webhooks', webhookRoutes);
```

---

## 4. Payment Elements UI

### Create Payment Element Component

Create `src/components/StripePayment.jsx`:

```javascript
import { useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';

const StripePayment = ({ clientSecret, onPaymentSuccess, onPaymentError }) => {
    const [stripe, setStripe] = useState(null);
    const [elements, setElements] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const initStripe = async () => {
            const stripeInstance = await loadStripe('pk_test_your_publishable_key');
            const elementsInstance = stripeInstance.elements({
                clientSecret,
                appearance: {
                    theme: 'stripe',
                    variables: {
                        colorPrimary: '#ec9146',
                    }
                }
            });

            const paymentElement = elementsInstance.create('payment', {
                layout: 'tabs'
            });

            paymentElement.mount('#stripe-payment-element');

            setStripe(stripeInstance);
            setElements(elementsInstance);
            setLoading(false);
        };

        initStripe();
    }, [clientSecret]);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setLoading(true);

        if (!stripe || !elements) return;

        const { error } = await stripe.confirmPayment({
            elements,
            confirmParams: {
                return_url: `${window.location.origin}/my-orders`,
            },
        });

        if (error) {
            onPaymentError(error.message);
        } else {
            onPaymentSuccess();
        }
        setLoading(false);
    };

    return (
        <form id="payment-form" onSubmit={handleSubmit}>
            <div id="stripe-payment-element" />
            <button 
                disabled={loading || !stripe || !elements}
                id="submit"
                className="btn btn-primary"
                style={{ marginTop: '16px', width: '100%' }}
            >
                {loading ? 'Processing...' : 'Pay Now'}
            </button>
        </form>
    );
};

export default StripePayment;
```

### Update Payment Modal

In `MyOrders.jsx`, replace the payment modal content:

```javascript
// In the payment modal JSX
<div className="modal-body">
    <p><strong>Gig:</strong> {selectedOrder.gig.title}</p>
    <p><strong>Amount:</strong> ${selectedOrder.gig.price?.toFixed(2)}</p>
    
    <div style={{ background: '#fef3c7', padding: '12px', borderRadius: '8px', marginTop: '16px' }}>
        <p style={{ margin: 0, fontSize: '14px' }}>
            💡 Your payment will be held in escrow until you approve the work.
            You'll have 3 days to review after delivery.
        </p>
    </div>

    {!TEST_MODE && clientSecret && (
        <StripePayment 
            clientSecret={clientSecret}
            onPaymentSuccess={() => {
                showToast('Payment processed! Funds are in escrow.', 'success');
                setShowPaymentModal(false);
                setSelectedOrder(null);
                loadOrders();
            }}
            onPaymentError={(error) => showToast(error, 'error')}
        />
    )}
</div>
```

---

## 5. Testing

### Test Cards (Stripe Test Mode)

| Card Number | Result | CVC | Expiry |
|-------------|--------|-----|--------|
| 4242 4242 4242 4242 | Success | Any | Any future date |
| 4000 0000 0000 0002 | Declined | Any | Any future date |
| 4000 0000 0000 9995 | Insufficient funds | Any | Any future date |

### Test Flow

1. **Start in Test Mode** (`TEST_MODE = true`)
2. **Verify flow works** with test payments
3. **Switch to Stripe Mode** (`TEST_MODE = false`)
4. **Test with Stripe test cards**
5. **Check Stripe Dashboard** for payments
6. **Verify webhooks** are received

---

## 6. Production Checklist

### Before Going Live

- [ ] Switch to **Live Mode** in Stripe
- [ ] Update API keys to live keys
- [ ] Add business bank account
- [ ] Set up proper error handling
- [ ] Add email notifications
- [ ] Test refund flow
- [ ] Set up monitoring for webhooks
- [ ] Add fraud detection (optional)

### Security

- [ ] Never expose secret keys in frontend
- [ ] Use HTTPS in production
- [ ] Verify webhook signatures
- [ ] Log all payment events
- [ ] Set up rate limiting

---

## 7. Common Issues & Solutions

### Payment Fails
- Check Stripe dashboard for errors
- Verify API keys are correct
- Check webhook endpoint is reachable

### Webhook Not Received
- Verify webhook URL is correct
- Check Stripe webhook configuration
- Ensure firewall allows Stripe requests

### Elements Not Loading
- Check publishable key
- Verify clientSecret is valid
- Check browser console for errors

---

## 8. Next Steps

After Stripe integration:

1. **Add saved cards** for returning customers
2. **Implement subscription payments** for recurring gigs
3. **Add dispute resolution** with Stripe
4. **Set up Connect** for provider payouts
5. **Add analytics** for payment tracking

---

## Quick Start Code

```javascript
// 1. Install packages
npm install @stripe/stripe-js

// 2. Add to MyOrders.jsx
import { loadStripe } from '@stripe/stripe-js';

// 3. Update confirmPayment()
const stripe = await loadStripe('pk_test_...');

// 4. Add webhook endpoint
// POST /api/webhooks/stripe

// 5. Test with card 4242 4242 4242 4242
```

That's it! Your escrow system now accepts real Stripe payments.
