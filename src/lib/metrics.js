import { supabase } from './supabase';

// ── Metrics / analytics data layer (v3) ─────────────────────────────────────
// Fire-and-forget event recording + creator-facing aggregates. Events are
// insert-only for everyone (incl. anon storefront views); reads are creator-only
// via RLS. Funnel: storefront_view → skill_view → checkout_start → purchase.
//
// NOTE: this file is intentionally named `metrics.js`, not `analytics.js` —
// ad blockers block any script literally named analytics.js by filename, which
// (in dev, where Vite serves unbundled modules) breaks the import and white-
// screens the whole app. Keep the neutral name.

/**
 * Record an analytics event. Fire-and-forget — never throws into the UI.
 * @param {'storefront_view'|'skill_view'|'checkout_start'|'purchase'|'block_open'} type
 * @param {{ skillId?, creatorId?, buyerId?, blockId? }} ctx
 */
export function recordEvent(type, ctx = {}) {
  const row = {
    type,
    skill_id: ctx.skillId ?? null,
    creator_id: ctx.creatorId ?? null,
    buyer_id: ctx.buyerId ?? null,
    block_id: ctx.blockId ?? null,
  };
  // Don't await — analytics must never block or break a user action.
  supabase.from('analytics_events').insert(row).then(({ error }) => {
    if (error) console.warn('metrics: failed to record', type, error.message);
  });
}

/** Raw events for a creator (for the dashboard to aggregate). Phase 5 may move
 *  aggregation to the backend; client-side rollups are fine to start. */
export async function getCreatorEvents(creatorId, sinceISO) {
  let q = supabase
    .from('analytics_events')
    .select('type, skill_id, buyer_id, created_at')
    .eq('creator_id', creatorId);
  if (sinceISO) q = q.gte('created_at', sinceISO);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

/** Events scoped to a single skill (storefront-level views won't have skill_id). */
export async function getSkillEvents(skillId, sinceISO) {
  let q = supabase
    .from('analytics_events')
    .select('type, buyer_id, block_id, created_at')
    .eq('skill_id', skillId);
  if (sinceISO) q = q.gte('created_at', sinceISO);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

/** Roll a flat event list into a simple funnel { views, checkouts, purchases }. */
export function toFunnel(events) {
  const count = (t) => events.filter(e => e.type === t).length;
  return {
    views: count('storefront_view') + count('skill_view'),
    checkouts: count('checkout_start'),
    purchases: count('purchase'),
  };
}
