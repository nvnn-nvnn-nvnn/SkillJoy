import { apiFetch } from './api';

// ── Stripe Connect payouts (v3 dashboard) ───────────────────────────────────
// Thin wrappers over the existing /api/stripe-connect routes (reused from v1).

export async function getPayoutStatus() {
  const res = await apiFetch('/api/stripe-connect/status');
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not load payout status.');
  return data; // { onboarded, chargesEnabled? }
}

export async function getBalance() {
  const res = await apiFetch('/api/stripe-connect/balance');
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not load balance.');
  return data; // { available, pending } in dollars
}

/** Returns a Stripe-hosted onboarding URL to redirect to. */
export async function startOnboarding() {
  const res = await apiFetch('/api/stripe-connect/onboard', { method: 'POST' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not start onboarding.');
  return data.url;
}

/** Returns a Stripe Express dashboard login URL. */
export async function getDashboardLink() {
  const res = await apiFetch('/api/stripe-connect/dashboard-link', { method: 'POST' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not open payout dashboard.');
  return data.url;
}
