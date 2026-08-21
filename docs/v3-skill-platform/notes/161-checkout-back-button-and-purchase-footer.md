# 161 — Checkout: a way back, and a purchase footer that lines up

Date: 2026-08-20

## 1. The back button

Checkout had **no exit** on its two main states. A `BackLink` existed, but only
on the error screen — so a buyer who reached the details or payment step could
only use the browser back button or close the tab.

> A payment page with no visible way out reads as a trap, and that costs trust at
> the exact moment you need it most.

Moved into `Shell` so every state gets it from one place, via an `onBack` prop.

**The part worth copying — back is context-aware, not blindly `navigate(-1)`:**

```js
const backAction =
  status === 'guest-success' ? undefined :                       // nothing to go back to
  status === 'pay'           ? () => { setErr(''); setStatus('promo'); } :
  leave;                                                          // navigate(-1)
```

From the **payment** step, back returns to the **details** step rather than
leaving the site. This matters because the promo→pay transition is *state, not a
route* — there is only one history entry for the whole checkout. So a plain
`navigate(-1)` from the payment step would dump the buyer back on the product
page and throw away their promo code, guest details, and add-on choice, for what
they thought was "let me fix that one thing."

**Transferable:** when a flow has multiple steps inside a single route, browser
history no longer describes it. "Back" has to be modelled explicitly, or it means
"abandon everything."

Abandoning a created-but-unconfirmed PaymentIntent is safe — Stripe expires it,
and `toPayment` upserts the pending purchase row rather than inserting, so
re-continuing reuses the row.

## 2. The purchase footer

**The complaint:** the button and pricing info looked askew relative to each other.

**The cause:** there was no pricing near the button at all. The only price down
there was *inside* the button's own centred label
(`Continue to payment · $17.00`), while the real breakdown lived in the summary
card at the top of the page — left-aligned beside a 64px cover. So the money and
the CTA shared no edge, no alignment, and no visual relationship.

**The fix** — a `.ck-foot` block where every row and the button are the same
width and share the same left/right edges:

```
Product name                         $12.00
Add-on name                          +$5.00
─────────────────────────────────────────────
Total                                $17.00
[         Continue to payment          ]
```

Details that make it work:

- **`justify-content: space-between`** puts the label on the left edge and the
  amount on the right edge — exactly the button's edges. That edge-sharing *is*
  the symmetry that was missing.
- **`font-variant-numeric: tabular-nums`** on the amounts. Proportional digits
  have different widths, so `$12.00` and `$17.00` stack with their decimal points
  slightly out of line — which reads as sloppy without being obviously wrong.
  Tabular figures are fixed-width and column up.
- **`gap: 0` on the flex column, padding on the rows.** The rows own their own
  vertical rhythm, so spacing stays even whether or not the add-on row exists.
  A `gap` would have made the two-row and three-row cases differently spaced.
- **`min-width: 0` + ellipsis on the label.** Flex items refuse to shrink below
  their content by default, so a long product title would push the price off the
  right edge instead of truncating. `min-width: 0` is what actually lets a flex
  child shrink — the single most common flexbox gotcha.
- The price moved **out** of the details-step button label (`Continue to payment`
  now), since the total sits directly above it. The final step keeps `Pay $X`,
  because on the last irreversible click the amount belongs on the button.

Both stages now use the same `.ck-foot` structure, so the details step and the
payment step line up with each other instead of each inventing a layout.

## Files
- `src/app-pages/Checkout.jsx`
