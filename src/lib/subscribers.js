import { supabase } from './supabase';
import { apiFetch } from './api';

// ── Email capture + marketing data layer (v3, Phase 9) ──────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isEmail = (e) => EMAIL_RE.test((e || '').trim());

/** Public storefront subscribe. Idempotent on (creator, email). */
export async function subscribe(creatorId, email, name = null, source = 'storefront') {
  const { error } = await supabase
    .from('subscribers')
    .upsert({ creator_id: creatorId, email: email.trim().toLowerCase(), name, source },
            { onConflict: 'creator_id,email', ignoreDuplicates: true });
  if (error) throw error;
}

export async function listSubscribers(creatorId) {
  const { data, error } = await supabase
    .from('subscribers')
    .select('id, email, name, source, created_at')
    .eq('creator_id', creatorId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function deleteSubscriber(id) {
  const { error } = await supabase.from('subscribers').delete().eq('id', id);
  if (error) throw error;
}

/** Send a broadcast to all of the creator's subscribers (backend → Resend). */
export async function sendBroadcast(subject, body) {
  const res = await apiFetch('/api/marketing/broadcast', {
    method: 'POST',
    body: JSON.stringify({ subject, body }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not send broadcast.');
  return data; // { sent, failed }
}
