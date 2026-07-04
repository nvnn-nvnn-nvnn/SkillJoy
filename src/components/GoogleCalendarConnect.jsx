import { useState, useEffect } from 'react';
import { getGoogleStatus, startGoogleConnect, disconnectGoogle } from '@/lib/google';

// Account-level control: connect/disconnect the creator's Google Calendar so
// their real busy times auto-block coaching slots. Self-contained (fetches its
// own status), so it can be dropped into the builder and the availability editor.
export default function GoogleCalendarConnect() {
  const [status, setStatus] = useState(null); // { connected, configured }
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getGoogleStatus().then(setStatus).catch(() => setStatus({ connected: false, configured: false }));
  }, []);

  if (!status) return null;

  async function connect() {
    setBusy(true);
    try { await startGoogleConnect(); } catch { setBusy(false); } // redirects away on success
  }
  async function disconnect() {
    setBusy(true);
    try { await disconnectGoogle(); setStatus(s => ({ ...s, connected: false })); }
    catch { /* ignore */ } finally { setBusy(false); }
  }

  return (
    <div className={`gc-box${status.connected ? ' gc-on' : ''}`}>
      <span className="gc-icon">🗓️</span>
      {!status.configured ? (
        <>
          <span className="gc-text"><b>Auto-sync your calendar</b> to block busy times and avoid double-bookings.</span>
          <span className="gc-soon">Soon</span>
        </>
      ) : status.connected ? (
        <>
          <span className="gc-text"><b>Google Calendar connected.</b> Busy times auto-block your slots.</span>
          <button className="btn btn-ghost btn-sm gc-btn" onClick={disconnect} disabled={busy}>Disconnect</button>
        </>
      ) : (
        <>
          <span className="gc-text">Connect Google Calendar so bookings never clash with your real schedule.</span>
          <button className="btn btn-secondary btn-sm gc-btn" onClick={connect} disabled={busy}>
            {busy ? 'Redirecting…' : 'Connect'}
          </button>
        </>
      )}
      <style>{`
        .gc-box { display:flex; align-items:center; gap:10px; flex-wrap:wrap; padding:12px 14px; border:1px solid var(--border-strong); border-radius:var(--r); background:var(--surface-alt); }
        .gc-box.gc-on { border-color:var(--accent-mid); background:var(--accent-light); }
        .gc-icon { font-size:18px; }
        .gc-text { flex:1; min-width:180px; font-size:13px; color:var(--text-secondary); line-height:1.4; }
        .gc-text b { color:var(--text); }
        .gc-muted { color:var(--text-muted); }
        .gc-btn { flex-shrink:0; }
        .gc-soon { flex-shrink:0; font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:.06em; color:var(--text-muted); background:var(--border); padding:3px 9px; border-radius:var(--r-full); }
      `}</style>
    </div>
  );
}
