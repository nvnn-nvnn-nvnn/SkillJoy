# Escrow Payment System - Backend Integration Guide

## Overview

This document outlines the Fiverr-style escrow payment system implemented in SkillJoy. The frontend is complete with placeholders for backend integration. All payment logic, Stripe API calls, and database updates need to be implemented in your backend.

---

## Payment Flow (Fiverr-Style)

```
1. Buyer places order
   ↓ payment_status: 'pending'
   
2. Buyer accepts & pays
   ↓ payment_status: 'escrowed' (money held by platform)
   ↓ Stripe charges buyer's card
   ↓ Funds held in escrow
   
3. Provider delivers work
   ↓ status: 'delivered'
   ↓ auto_release_date set to +3 days
   
4. Buyer reviews (3-day window):
   
   Option A: Accept
   ↓ payment_status: 'released'
   ↓ Funds transferred to provider
   ↓ 14-day clearing period starts
   
   Option B: Dispute
   ↓ payment_status: 'disputed'
   ↓ Support team reviews
   ↓ Resolution: 'refunded' or 'released'
   
   Option C: No action
   ↓ Auto-release after 3 days
   ↓ payment_status: 'released'
   
5. Clearing period (14 days)
   ↓ Provider can withdraw after clearing
```

---

## Database Schema

### Migration File
Location: `supabase/migrations/add_payment_escrow_fields.sql`

### New Fields in `gig_requests` Table

| Field | Type | Description |
|-------|------|-------------|
| `payment_status` | TEXT | Payment lifecycle state: 'pending', 'escrowed', 'released', 'disputed', 'refunded' |
| `payment_amount` | DECIMAL(10,2) | Amount paid by buyer |
| `payment_intent_id` | TEXT | Stripe Payment Intent ID |
| `escrow_date` | TIMESTAMPTZ | When payment was escrowed |
| `release_date` | TIMESTAMPTZ | When payment was released to provider |
| `auto_release_date` | TIMESTAMPTZ | Date for automatic release (3 days after delivery) |
| `dispute_reason` | TEXT | Buyer's reason for dispute |
| `dispute_date` | TIMESTAMPTZ | When dispute was filed |
| `dispute_resolved_date` | TIMESTAMPTZ | When dispute was resolved |
| `dispute_resolution` | TEXT | Resolution notes from support |

---

## Frontend Components

### 1. MyOrders Page (`src/app-pages/MyOrders.jsx`)

**Purpose:** Track gig orders with payment status

**Routes:**
- `/my-orders` - View all orders (buying/selling tabs)

**Backend Integration Points:**

#### `handleAcceptOrder()` - Line 78
```javascript
// BACKEND TODO: Create Stripe Payment Intent
// Endpoint: POST /api/payments/create-intent
// Body: { orderId, amount }
// Response: { paymentIntentId, clientSecret }

// Steps:
// 1. Create Stripe Payment Intent
// 2. Return clientSecret to frontend
// 3. Frontend uses Stripe.js to confirm payment
// 4. On success, update payment_status to 'escrowed'
```

#### `confirmPayment()` - Line 87
```javascript
// BACKEND TODO: Confirm payment and update database
// Endpoint: POST /api/payments/confirm
// Body: { orderId, paymentIntentId }

// Steps:
// 1. Verify payment with Stripe
// 2. Update gig_requests:
//    - payment_status = 'escrowed'
//    - payment_amount = amount
//    - payment_intent_id = paymentIntentId
//    - escrow_date = NOW()
//    - status = 'accepted'
```

#### `handleReleasePayment()` - Line 119
```javascript
// BACKEND TODO: Transfer funds from escrow to provider
// Endpoint: POST /api/payments/release
// Body: { orderId }

// Steps:
// 1. Verify buyer is authorized
// 2. Transfer funds to provider's Stripe Connect account
// 3. Update gig_requests:
//    - payment_status = 'released'
//    - release_date = NOW()
// 4. Notify provider
```

#### `handleDispute()` - Line 144
```javascript
// BACKEND TODO: Create dispute record
// Endpoint: POST /api/disputes/create
// Body: { orderId, reason }

// Steps:
// 1. Update gig_requests:
//    - payment_status = 'disputed'
//    - dispute_reason = reason
//    - dispute_date = NOW()
// 2. Create support ticket
// 3. Notify support team
// 4. Hold funds in escrow
```

---

### 2. Disputes Page (`src/app-pages/Disputes.jsx`)

**Purpose:** Manage payment disputes

**Routes:**
- `/disputes` - View and manage disputes

**Backend Integration Points:**

#### `submitEvidence()` - Line 65
```javascript
// BACKEND TODO: Submit evidence to support ticket
// Endpoint: POST /api/disputes/submit-evidence
// Body: { disputeId, evidence, files[] }

// Steps:
// 1. Create support ticket entry
// 2. Store evidence text
// 3. Upload files to storage (S3/Cloudinary)
// 4. Notify support team
// 5. Notify other party
```

#### `resolveDispute()` - Line 91
```javascript
// BACKEND TODO: Resolve dispute (Admin only)
// Endpoint: POST /api/disputes/resolve
// Body: { disputeId, resolution: 'refund' | 'release', notes }

// Steps:
// 1. Verify user is admin/support
// 2. If resolution = 'refund':
//    - Refund buyer via Stripe
//    - payment_status = 'refunded'
// 3. If resolution = 'release':
//    - Transfer to provider
//    - payment_status = 'released'
// 4. Update dispute_resolved_date
// 5. Notify both parties
// 6. Close support ticket
```

#### `cancelDispute()` - Line 118
```javascript
// BACKEND TODO: Cancel dispute before review
// Endpoint: POST /api/disputes/cancel
// Body: { disputeId }

// Steps:
// 1. Verify dispute not yet reviewed
// 2. Update gig_requests:
//    - payment_status = 'escrowed'
//    - dispute_reason = NULL
//    - dispute_date = NULL
// 3. Notify other party
```

---

### 3. Chat Page Updates (`src/app-pages/Chat.jsx`)

**Already Implemented (Lines 502-520):**

```javascript
// Payment release from chat (placeholder)
async function confirmPayment(gigReqId) {
    // Update payment_status to 'captured' (should be 'released')
}

async function disputePayment(gigReqId) {
    // Update payment_status to 'disputed'
}
```

**Note:** These functions are placeholders. They should call the same backend endpoints as MyOrders page.

---

## Backend Implementation Checklist

### 1. Stripe Integration

- [ ] Set up Stripe Connect for providers
- [ ] Create Payment Intent endpoint
- [ ] Implement payment confirmation webhook
- [ ] Set up escrow account/holding pattern
- [ ] Implement fund transfer to providers
- [ ] Implement refund logic
- [ ] Add 14-day clearing period tracking

### 2. Database

- [ ] Run migration: `add_payment_escrow_fields.sql`
- [ ] Create indexes for performance
- [ ] Set up RLS policies for payment fields
- [ ] Add triggers for status changes

### 3. API Endpoints

#### Payment Endpoints
```
POST /api/payments/create-intent
POST /api/payments/confirm
POST /api/payments/release
POST /api/payments/refund
GET  /api/payments/status/:orderId
```

#### Dispute Endpoints
```
POST /api/disputes/create
POST /api/disputes/submit-evidence
POST /api/disputes/resolve (admin only)
POST /api/disputes/cancel
GET  /api/disputes/list
```

### 4. Cron Jobs

#### Auto-Release Job (Run Daily)
```javascript
// Pseudo-code
async function autoReleasePayments() {
    const ordersToRelease = await db.query(`
        SELECT * FROM gig_requests
        WHERE payment_status = 'escrowed'
        AND status = 'delivered'
        AND auto_release_date <= NOW()
    `);
    
    for (const order of ordersToRelease) {
        await releasePayment(order.id);
        await notifyProvider(order.provider_id);
    }
}
```

### 5. Notifications

- [ ] Email notifications for payment events
- [ ] In-app notifications
- [ ] SMS for disputes (optional)

**Events to notify:**
- Payment received (escrowed)
- Work delivered (buyer reminder)
- Payment released
- Dispute filed
- Dispute resolved
- Auto-release warning (1 day before)

### 6. Security

- [ ] Verify user authorization for all payment actions
- [ ] Validate payment amounts match gig price
- [ ] Prevent duplicate payments
- [ ] Rate limiting on payment endpoints
- [ ] Audit logging for all payment actions
- [ ] PCI compliance for card data

### 7. Admin Dashboard

- [ ] View all disputes
- [ ] Resolve disputes
- [ ] View payment analytics
- [ ] Refund/release controls
- [ ] Audit logs

---

## Testing Checklist

### Happy Path
- [ ] Buyer accepts order and pays
- [ ] Payment goes to escrow
- [ ] Provider delivers work
- [ ] Buyer releases payment
- [ ] Provider receives funds after clearing period

### Dispute Path
- [ ] Buyer files dispute
- [ ] Both parties submit evidence
- [ ] Admin resolves in favor of buyer (refund)
- [ ] Admin resolves in favor of seller (release)

### Auto-Release Path
- [ ] Provider delivers work
- [ ] Buyer takes no action for 3 days
- [ ] Payment auto-releases to provider

### Edge Cases
- [ ] Payment fails during escrow
- [ ] Buyer cancels before payment
- [ ] Provider cancels after payment
- [ ] Dispute filed after auto-release
- [ ] Multiple disputes on same order
- [ ] Chargeback handling

---

## Stripe Webhooks

### Required Webhooks

```javascript
// payment_intent.succeeded
// - Confirm payment escrowed
// - Update payment_status to 'escrowed'

// payment_intent.payment_failed
// - Notify buyer
// - Keep payment_status as 'pending'

// charge.refunded
// - Update payment_status to 'refunded'
// - Notify buyer

// charge.dispute.created
// - Flag for review
// - Hold funds

// charge.dispute.closed
// - Process based on outcome
```

---

## Environment Variables

Add to `.env`:

```bash
# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Escrow Settings
ESCROW_AUTO_RELEASE_DAYS=3
ESCROW_CLEARING_PERIOD_DAYS=14

# Support
SUPPORT_EMAIL=support@skilljoy.com
ADMIN_USER_IDS=uuid1,uuid2,uuid3
```

---

## Frontend Usage

### For Buyers
1. Navigate to `/my-orders`
2. Click "Accept & Pay" on pending order
3. Enter payment details (Stripe modal)
4. Track order status
5. After delivery, click "Release Payment" or "File Dispute"

### For Sellers
1. Navigate to `/my-orders`
2. View orders in "Selling" tab
3. See payment status
4. After release, wait 14 days for clearing

### For Disputes
1. Navigate to `/disputes`
2. View active disputes
3. Submit evidence
4. Wait for support resolution

---

## Next Steps

1. **Run the migration:**
   ```bash
   cd supabase
   supabase migration up
   ```

2. **Set up Stripe:**
   - Create Stripe Connect account
   - Configure webhooks
   - Test with Stripe test mode

3. **Implement backend endpoints:**
   - Start with payment creation
   - Then payment release
   - Then disputes
   - Finally auto-release cron

4. **Test thoroughly:**
   - Use Stripe test cards
   - Test all payment flows
   - Test dispute resolution

5. **Deploy:**
   - Set production Stripe keys
   - Enable webhooks
   - Set up cron jobs
   - Monitor for issues

---

## Support

For questions about the frontend implementation, check:
- `src/app-pages/MyOrders.jsx` - Order tracking
- `src/app-pages/Disputes.jsx` - Dispute management
- `src/app-pages/Chat.jsx` - Payment actions in chat

All backend integration points are marked with:
```javascript
// BACKEND TODO: [description]
// PLACEHOLDER: [description]
```

Search for these comments to find all integration points.
