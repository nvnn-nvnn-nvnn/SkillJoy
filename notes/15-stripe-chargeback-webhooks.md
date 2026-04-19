# Stripe Chargeback Webhooks — `backend/routes/webhooks.js` + `src/app-pages/Admin.jsx`

## Why
When a buyer files a chargeback directly with their bank, Stripe sends webhook events. Without handling these, the order would remain in an inconsistent state and no one would be notified. This implements a full dispute lifecycle.

---

## Events Handled

### `charge.dispute.created`
Fires when a buyer opens a chargeback with their bank.

1. Looks up the order via `payment_intent_id`
2. Updates `payment_status` → `chargebacked`
3. Sends 3 notifications in one insert: admin, buyer, seller

### `charge.dispute.closed`
Fires when Stripe resolves the dispute. Three outcomes:

| `dispute.status` | `payment_status` set to | Notifications sent |
|---|---|---|
| `won` | `chargeback_won` | Admin + buyer (denied) + seller (resolved in favor) |
| `lost` | `chargeback_lost` | Admin + buyer (approved) + seller (funds returned) |
| `warning_closed` | _(no change)_ | Console log only |

---

## DB Changes
Added to `payment_status` CHECK constraint:
- `chargebacked`
- `chargeback_won`
- `chargeback_lost`

---

## Admin.jsx STATUS_COLORS
- `chargebacked` — purple
- `chargeback_won` — green (same as released/completed)
- `chargeback_lost` — red (same as declined/cancelled)

---

## How to Test
Use Stripe CLI to trigger test events:
```bash
stripe trigger charge.dispute.created
stripe trigger charge.dispute.closed
```

Verify the order's `payment_status` updates and notifications appear in the DB.

---

## Notes
- `adminProfile` is fetched via `process.env.ADMIN_EMAIL` — make sure this is set in your backend `.env`
- Order lookup uses `payment_intent_id` column on `gig_requests`
