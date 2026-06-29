import { supabase } from './supabase';

// ── Discount / promo code data layer (v3, Phase 10) ─────────────────────────
// Creator-side management only (RLS = owner). Validation/application is
// server-side at checkout.

export async function listDiscounts(creatorId) {
  const { data, error } = await supabase
    .from('discounts')
    .select('id, code, percent_off, active, max_redemptions, times_redeemed, created_at')
    .eq('creator_id', creatorId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createDiscount(creatorId, { code, percent_off, max_redemptions }) {
  const { data, error } = await supabase
    .from('discounts')
    .insert({
      creator_id: creatorId,
      code: code.trim().toUpperCase(),
      percent_off,
      max_redemptions: max_redemptions || null,
    })
    .select().single();
  if (error) {
    if (/duplicate|unique/i.test(error.message)) throw new Error('You already have a code with that name.');
    throw error;
  }
  return data;
}

export async function toggleDiscount(id, active) {
  const { error } = await supabase.from('discounts').update({ active }).eq('id', id);
  if (error) throw error;
}

export async function deleteDiscount(id) {
  const { error } = await supabase.from('discounts').delete().eq('id', id);
  if (error) throw error;
}
