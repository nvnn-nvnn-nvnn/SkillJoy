import { apiFetch } from './api';

// ── Google Calendar (coaching freebusy) client helpers ──────────────────────
// Read-only: the creator connects so their real busy times subtract conflicting
// booking slots. See backend/routes/google.js.

/** { connected, configured } for the current creator. */
export async function getGoogleStatus() {
  const res = await apiFetch('/api/google/status');
  if (!res.ok) return { connected: false, configured: false };
  return res.json();
}

/** Kick off the OAuth flow — redirects the browser to Google's consent screen. */
export async function startGoogleConnect() {
  const res = await apiFetch('/api/google/connect');
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not start Google connect.');
  window.location.href = data.url;
}

/** Disconnect the current creator's calendar. */
export async function disconnectGoogle() {
  const res = await apiFetch('/api/google/disconnect', { method: 'POST' });
  if (!res.ok) throw new Error('Could not disconnect Google Calendar.');
  return res.json();
}

/** A creator's busy intervals in [startISO, endISO]. Fail-open → { busy: [] }. */
export async function getCreatorFreebusy(creatorId, startISO, endISO) {
  const qs = `start=${encodeURIComponent(startISO)}&end=${encodeURIComponent(endISO)}`;
  const res = await apiFetch(`/api/google/freebusy/${creatorId}?${qs}`);
  if (!res.ok) return { busy: [] };
  return res.json();
}
