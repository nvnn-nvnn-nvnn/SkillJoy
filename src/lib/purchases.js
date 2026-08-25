import { supabase } from './supabase';
import { apiFetch } from './api';

// ── Purchases / locker data layer (v3) ──────────────────────────────────────
// Reads are RLS-guarded (buyer sees own, creator sees their skills'). Checkout
// + signed downloads are backend-only (Phase 3) — purchases are NEVER inserted
// from the client; the Stripe webhook fulfils them server-side.

/** The current buyer's locker — paid purchases joined to their skill. */
export async function listMyPurchases(buyerId) {
  const { data, error } = await supabase
    .from('purchases')
    .select('id, skill_id, version_at_purchase, amount_cents, status, created_at, skill:skills(id, title, outcome, cover_url, version, creator_id, pricing_type)')
    .eq('buyer_id', buyerId)
    .eq('status', 'paid')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

/** Has the current buyer paid for this skill? */
export async function hasPurchased(buyerId, skillId) {
  const { data, error } = await supabase
    .from('purchases')
    .select('id, version_at_purchase')
    .eq('buyer_id', buyerId).eq('skill_id', skillId).eq('status', 'paid')
    .maybeSingle();
  if (error) throw error;
  return data; // null if not purchased
}

/** All paid sales across a creator's Skills (dashboard revenue + buyer list).
 *  RLS lets the creator read purchases of their own skills. */
export async function listCreatorSales(creatorId) {
  const { data, error } = await supabase
    .from('purchases')
    .select('id, amount_cents, created_at, skill:skills!inner(id, title, creator_id), buyer:profiles!purchases_buyer_id_fkey(id, full_name, email)')
    .eq('skill.creator_id', creatorId)
    .eq('status', 'paid')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

/** Buyers of a creator's skills (for the dashboard buyer list). */
export async function listSkillBuyers(skillId) {
  const { data, error } = await supabase
    .from('purchases')
    .select('id, amount_cents, created_at, buyer:profiles!purchases_buyer_id_fkey(id, full_name, email)')
    .eq('skill_id', skillId).eq('status', 'paid')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

// ── Backend-brokered ────────────────────────────────────────────────────────

/**
 * Start checkout: create a PaymentIntent + pending purchase.
 * Returns { clientSecret, paymentIntentId } for paid Skills, or { free: true }
 * if the Skill is free (already granted server-side).
 */
export async function startCheckout(skillId, code = null, bump = false) {
  const res = await apiFetch(`/api/checkout/${skillId}/intent`, {
    method: 'POST',
    body: JSON.stringify({ code, bump }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not start checkout.');
  return data;
}

/** Guest (no account) checkout for a one-time product. apiFetch just sends no
 *  auth token when there's no session — the /api/guest routes don't require one.
 *  Returns { clientSecret, paymentIntentId, amountCents }. */
/**
 * Claim a FREE product with no account: name + email, nothing else.
 *
 * Separate from startGuestCheckout because there is no PaymentIntent, no
 * client secret and no Stripe step — sharing the function would mean a
 * pile of "if free" branches in a flow whose whole job is handling money.
 */
/**
 * Turn a one-time sign-in token into a real session, in this tab.
 *
 * The buyer has just paid (or claimed a free product) and is looking at the
 * page. Telling them to go to their inbox to get in is the worst possible
 * moment for a detour — they have already done the hard part.
 *
 * Returns true if the session took. Never throws: a failure here just means
 * they use the emailed link instead, which still works.
 */
export async function redeemSignInToken(tokenHash) {
  if (!tokenHash) return false;
  try {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'email' });
    return !error;
  } catch {
    return false;
  }
}

export async function claimFreeProduct(skillId, { name, email }) {
  const res = await apiFetch(`/api/guest/${skillId}/claim`, {
    method: 'POST',
    body: JSON.stringify({ name, email }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Could not get access. Try again.');
  return body;
}

export async function startGuestCheckout(skillId, { name, email, code = null, bump = false }) {
  const res = await apiFetch(`/api/guest/${skillId}/intent`, {
    method: 'POST',
    body: JSON.stringify({ name, email, code, bump }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not start checkout.');
  return data;
}

/** Fast fulfilment fallback for a guest purchase (webhook is source of truth). */
export async function confirmGuestCheckout(skillId, paymentIntentId) {
  const res = await apiFetch(`/api/guest/${skillId}/confirm`, {
    method: 'POST',
    body: JSON.stringify({ paymentIntentId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not confirm purchase.');
  return data;
}



// Portal subscription cancellation

export async function openMembershipPortal(purchaseId){
  const res = await apiFetch(`/api/checkout/portal`, {
    method: 'POST',
    body: JSON.stringify({purchaseId}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not access Stripe Portal.');
  return data.url

}

/** Preview a promo code (one-time Skills). Returns {valid, percentOff, amountCents}. */
export async function validateCode(skillId, code) {
  const res = await apiFetch(`/api/checkout/${skillId}/validate-code`, {
    method: 'POST', body: JSON.stringify({ code }),
  });
  return res.json();
}

/** Creator refunds a one-time purchase. */
export async function refundPurchase(purchaseId) {
  const res = await apiFetch('/api/checkout/refund', {
    method: 'POST', body: JSON.stringify({ purchaseId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Refund failed.');
  return data;
}

/** Fast fulfilment fallback after Stripe confirms (webhook is source of truth). */
export async function confirmCheckout(skillId, paymentIntentId) {
  const res = await apiFetch(`/api/checkout/${skillId}/confirm`, {
    method: 'POST',
    body: JSON.stringify({ paymentIntentId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not confirm purchase.');
  return data;
}

/** Mint a fresh signed download URL for a file/workflow block (verifies purchase). */
export async function getBlockDownloadUrl(blockId) {
  const res = await apiFetch(`/api/locker/block/${blockId}/download`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not get download link.');
  return data; // { url }
}
