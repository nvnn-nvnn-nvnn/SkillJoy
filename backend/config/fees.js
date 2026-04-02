// ── Shared fee constants ───────────────────────────────────────────────────
// Keep in sync with VITE_SERVICE_FEE in the frontend (MyOrders.jsx)
const SERVICE_FEE_DOLLARS = 6.00;
const SERVICE_FEE_CENTS   = Math.round(SERVICE_FEE_DOLLARS * 100); // 600

module.exports = { SERVICE_FEE_DOLLARS, SERVICE_FEE_CENTS };
