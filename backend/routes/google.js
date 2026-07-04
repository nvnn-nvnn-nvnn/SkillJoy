const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const supabase = require('../config/supabase');
const authMiddleware = require('../middleware/auth');

// ═══════════════════════════════════════════════════════════════════════════
// Google Calendar — connect + freebusy (v3 coaching). READ-ONLY: we only read
// the creator's busy intervals to subtract real conflicts from their native
// availability. No events are written (that's a future phase). Plain OAuth +
// fetch, no googleapis dependency.
//
// Server config (from your Google Cloud OAuth "Web application" client):
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
// The callback is intentionally NOT behind authMiddleware — Google redirects
// the browser there with no Authorization header; we trust the signed `state`.
// ═══════════════════════════════════════════════════════════════════════════

const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
const STATE_SECRET = process.env.GOOGLE_STATE_SECRET || process.env.SUPABASE_SERVICE_KEY || 'dev-secret';

const configured = () =>
  !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI);

// ── Signed OAuth state (carries the creator's user id through the redirect) ──
function signState(uid) {
  const payload = Buffer.from(JSON.stringify({ uid, t: Date.now() })).toString('base64url');
  const sig = crypto.createHmac('sha256', STATE_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}
function verifyState(state) {
  const [payload, sig] = String(state || '').split('.');
  if (!payload || !sig) return null;
  const expect = crypto.createHmac('sha256', STATE_SECRET).update(payload).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  try {
    const { uid, t } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (Date.now() - t > 10 * 60 * 1000) return null; // 10-min window
    return uid;
  } catch { return null; }
}

function authUrl(state) {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',   // → refresh token
    prompt: 'consent',        // force refresh token every time
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
}

async function tokenRequest(params) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || 'Google token request failed');
  return data;
}

const exchangeCode = (code) => tokenRequest({
  code,
  client_id: process.env.GOOGLE_CLIENT_ID,
  client_secret: process.env.GOOGLE_CLIENT_SECRET,
  redirect_uri: process.env.GOOGLE_REDIRECT_URI,
  grant_type: 'authorization_code',
});

const accessTokenFromRefresh = (refresh_token) => tokenRequest({
  refresh_token,
  client_id: process.env.GOOGLE_CLIENT_ID,
  client_secret: process.env.GOOGLE_CLIENT_SECRET,
  grant_type: 'refresh_token',
}).then(d => d.access_token);

async function fetchBusy(accessToken, timeMin, timeMax) {
  const res = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ timeMin, timeMax, items: [{ id: 'primary' }] }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'freeBusy failed');
  return data.calendars?.primary?.busy ?? []; // [{ start, end }]
}

// ── GET /api/google/connect → { url } (creator starts the OAuth flow) ────────
router.get('/connect', authMiddleware, (req, res) => {
  if (!configured()) return res.status(503).json({ error: 'Google Calendar isn’t configured on the server yet.' });
  res.json({ url: authUrl(signState(req.user.id)) });
});

// ── GET /api/google/callback (Google redirects here — no auth header) ────────
router.get('/callback', async (req, res) => {
  const back = (q) => res.redirect(`${process.env.FRONTEND_URL}/dashboard?google=${q}`);
  try {
    if (req.query.error) return back('denied');
    const uid = verifyState(req.query.state);
    if (!uid) return back('badstate');
    const tokens = await exchangeCode(req.query.code);
    // refresh_token only comes back on first consent; prompt=consent forces it.
    const row = { user_id: uid, connected: true, updated_at: new Date().toISOString() };
    if (tokens.refresh_token) row.refresh_token = tokens.refresh_token;
    await supabase.from('google_tokens').upsert(row, { onConflict: 'user_id' });
    back('connected');
  } catch (e) {
    console.error('Google callback error:', e.message);
    back('error');
  }
});

// ── GET /api/google/status → { connected } ───────────────────────────────────
router.get('/status', authMiddleware, async (req, res) => {
  const { data } = await supabase.from('google_tokens')
    .select('connected').eq('user_id', req.user.id).maybeSingle();
  res.json({ connected: !!data?.connected, configured: configured() });
});

// ── POST /api/google/disconnect ──────────────────────────────────────────────
router.post('/disconnect', authMiddleware, async (req, res) => {
  await supabase.from('google_tokens')
    .update({ connected: false, refresh_token: null, updated_at: new Date().toISOString() })
    .eq('user_id', req.user.id);
  res.json({ success: true });
});

// ── GET /api/google/freebusy/:creatorId?start&end → { busy: [{start,end}] } ──
// Uses THAT creator's stored token. Fail-open: any problem → empty busy list so
// booking still works off native availability.
router.get('/freebusy/:creatorId', authMiddleware, async (req, res) => {
  try {
    const { start, end } = req.query;
    if (!start || !end) return res.status(400).json({ error: 'start and end required' });
    const { data: tok } = await supabase.from('google_tokens')
      .select('refresh_token, connected').eq('user_id', req.params.creatorId).maybeSingle();
    if (!tok?.connected || !tok?.refresh_token) return res.json({ busy: [] });
    const accessToken = await accessTokenFromRefresh(tok.refresh_token);
    const busy = await fetchBusy(accessToken, start, end);
    res.json({ busy });
  } catch (e) {
    console.warn('freebusy error (failing open):', e.message);
    res.json({ busy: [] });
  }
});

module.exports = router;
