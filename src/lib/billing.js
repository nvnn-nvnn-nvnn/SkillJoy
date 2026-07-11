import { apiFetch } from './api';

// ── Platform billing data layer (the creator's subscription TO SkillJoy) ────
// Not to be confused with creator memberships (fans subscribing to a creator).
// Server-enforced: these calls just drive UI; the real gate lives in
// backend/routes/skills.js (publish) + RLS (storefront visibility).

/** { status, trial_ends_at, current_period_end, live } — status 'none' if never subscribed. */
export async function getBillingStatus() {
  const res = await apiFetch('/api/billing/status');
  if (!res.ok) throw new Error('Could not load billing status.');
  return res.json();
}

/** Kick off the platform subscription: redirects to Stripe Checkout
 *  (card captured up front, 14-day trial, first charge day 14). */
export async function startSubscription() {
  const res = await apiFetch('/api/billing/subscribe', { method: 'POST' });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Could not start your trial.');
  window.location.assign(body.url);
}

/** Open the Stripe billing portal (manage card / cancel). */
export async function openBillingPortal() {
  const res = await apiFetch('/api/billing/portal', { method: 'POST' });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Could not open billing.');
  window.location.assign(body.url);
}

/** Whole days left in the trial (0 if none/over). */
export function trialDaysLeft(trialEndsAt) {
  if (!trialEndsAt) return 0;
  return Math.max(0, Math.ceil((new Date(trialEndsAt) - Date.now()) / 86400000));
}
