import { supabase } from './supabase';
import { apiFetch } from './api';

// ── Saved templates (migration 034) ─────────────────────────────────────────
//
// The presets in presets.js are authored by hand in code. These are saved from
// a REAL page: an admin customizes their storefront in the normal editor —
// background, video, music, effects — and saves that look.
//
// Why both exist: a preset with a video cannot be hand-written, because the
// asset has to be uploaded first. Anything involving an upload has to be
// created by a running system, not by typing an object literal.
//
// ── READS GO STRAIGHT TO SUPABASE. WRITES GO THROUGH THE BACKEND. ──
//
// This split is deliberate and load-bearing:
//
//   · Reading is a plain SELECT that migration 034's RLS policy already allows
//     to everyone, including anon. Routing it through Express would make the
//     onboarding template picker — a screen brand-new users see before they
//     have done anything — depend on a second server being awake. It isn't
//     worth a hard dependency to run a query the database will happily answer.
//
//   · Writing copies files between storage prefixes and needs the service-role
//     key, so it cannot happen in a browser at all. `store_templates` has no
//     insert/update/delete policy, which means the anon and authenticated roles
//     literally cannot write here — the backend is the only path.
//
// So: the public storefront and the pickers work with the API server down.
// Only saving a new template needs it, and only an admin ever does that.

const TEMPLATE_COLS = 'id, name, blurb, category, emoji, theme, install_count, created_at';

/** Every published template, already shaped like a THEME_PRESETS entry. */
export async function listTemplates() {
  const { data, error } = await supabase
    .from('store_templates')
    .select(TEMPLATE_COLS)
    .in('status', ['public', 'unlisted'])
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });

  // Never throw. A template list that fails to load must not break onboarding
  // or the editor — the built-in presets still render, so the screen degrades
  // to "fewer options" rather than "broken". Same reasoning as listBlocks.
  if (error) return [];

  return (data ?? []).map(t => ({
    id: `db:${t.id}`,        // namespaced so a DB id can never collide with a
    dbId: t.id,              // built-in preset id in the same picker
    name: t.name,
    emoji: t.emoji || '🎨',
    category: t.category || 'showcase',
    blurb: t.blurb || '',
    theme: t.theme || {},
    saved: true,             // lets the UI mark these as deletable
  }));
}

/** What would a save weigh, and would it be refused? Admin only.
 *  Runs the same measurement the save runs, so the readout in the editor
 *  cannot promise something the save then rejects. */
export async function preflightTemplate(includeAudio = true) {
  const res = await apiFetch('/api/templates/preflight?includeAudio=' + (includeAudio ? 'true' : 'false'));
  if (!res.ok) return null;   // never block the panel on this
  return res.json().catch(() => null);
}

/** Save the caller's CURRENT storefront look as a template. Admin only.
 *  The theme is read server-side from the caller's profile, so this sends
 *  metadata only — there is no way to submit a look that wasn't on a real page. */
export async function saveTemplate({ name, blurb, category, emoji, includeAudio = true }) {
  const res = await apiFetch('/api/templates', {
    method: 'POST',
    body: JSON.stringify({ name, blurb, category, emoji, includeAudio }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    // A dead API server is the single most likely failure here, and "Failed to
    // fetch" sends you looking at the wrong layer (LANDMINES §15).
    throw new Error(body.error || `Could not save template (HTTP ${res.status}). Is the API server running?`);
  }
  return body;
}

/** Delete a saved template and its copied assets. Admin only. */
export async function deleteTemplate(dbId) {
  const res = await apiFetch(`/api/templates/${dbId}`, { method: 'DELETE' });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Could not delete template');
  return body;
}
