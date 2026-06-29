import { useState, useEffect } from 'react';
import { useProfile } from '@/lib/stores';
import { getPayoutStatus, getBalance, startOnboarding, getDashboardLink } from '@/lib/payouts';

// ── Transparent payout status (v3 trust layer, doc 06) ──────────────────────
// Honest by design: shows onboarding state, real Stripe balance, and — if a
// human ever places a hold — the reason, verbatim. No silent freezes.

export default function PayoutStatus() {
  const profile = useProfile();
  const [status, setStatus] = useState(null);
  const [balance, setBalance] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    getPayoutStatus().then(s => {
      if (!alive) return;
      setStatus(s);
      if (s.onboarded) getBalance().then(b => alive && setBalance(b)).catch(() => {});
    }).catch(e => alive && setErr(e.message));
    return () => { alive = false; };
  }, []);

  async function onboard() {
    setBusy(true); setErr('');
    try { window.location.href = await startOnboarding(); }
    catch (e) { setErr(e.message); setBusy(false); }
  }

  async function openDashboard() {
    setBusy(true); setErr('');
    try { window.open(await getDashboardLink(), '_blank', 'noopener'); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  const held = profile?.payout_held;

  return (
    <div className="ps">
      <div className="ps-head">
        <h2 className="ps-h">Payouts</h2>
        {status?.onboarded && !held && <span className="ps-ok">● Active</span>}
      </div>

      {/* Hold notice — only ever set by a human, shown verbatim */}
      {held && (
        <div className="ps-hold">
          <strong>Your payouts are paused — pending review.</strong>
          <p>{profile.payout_hold_reason || 'A team member is reviewing your account. You’ll hear from a real person, and your funds are safe.'}</p>
        </div>
      )}

      {status === null && !err && <p className="ps-muted">Loading…</p>}

      {status && !status.onboarded && (
        <div className="ps-setup">
          <p className="ps-muted">Connect payouts to start getting paid. Stripe handles the rest — you’ll never see a config screen.</p>
          <button className="btn btn-primary" onClick={onboard} disabled={busy}>{busy ? 'Opening…' : 'Set up payouts'}</button>
        </div>
      )}

      {status?.onboarded && (
        <>
          <div className="ps-balances">
            <div className="ps-bal">
              <span className="ps-bal-label">Available</span>
              <span className="ps-bal-val">${(balance?.available ?? 0).toFixed(2)}</span>
            </div>
            <div className="ps-bal">
              <span className="ps-bal-label">On the way</span>
              <span className="ps-bal-val">${(balance?.pending ?? 0).toFixed(2)}</span>
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={openDashboard} disabled={busy}>Open payout dashboard ↗</button>
        </>
      )}

      <p className="ps-promise">🛡️ We never freeze your money in silence. If anything’s ever flagged, you’ll see exactly why — and reach a real person.</p>
      {err && <p className="ps-err">{err}</p>}

      <style>{`
        .ps { border:1px solid var(--border); border-radius:var(--r-lg); background:var(--surface); padding:18px; }
        .ps-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
        .ps-h { font-size:18px; font-weight:700; }
        .ps-ok { font-size:13px; font-weight:700; color:var(--green); }
        .ps-muted { color:var(--text-secondary); font-size:14px; }
        .ps-setup { display:flex; flex-direction:column; gap:12px; align-items:flex-start; }
        .ps-balances { display:flex; gap:12px; margin-bottom:12px; }
        .ps-bal { flex:1; background:var(--surface-alt); border:1px solid var(--border); border-radius:var(--r); padding:14px; }
        .ps-bal-label { display:block; font-size:12px; text-transform:uppercase; letter-spacing:.04em; color:var(--text-muted); }
        .ps-bal-val { display:block; font-size:24px; font-weight:800; color:var(--text); margin-top:4px; }
        .ps-hold { background:var(--accent-light); border:1px solid var(--accent-mid); border-radius:var(--r); padding:12px 14px; margin-bottom:14px; color:var(--accent); }
        .ps-hold p { margin-top:4px; color:var(--text-secondary); font-size:14px; }
        .ps-promise { margin-top:14px; font-size:12.5px; color:var(--text-muted); line-height:1.5; }
        .ps-err { color:var(--accent); font-size:13px; margin-top:8px; }
      `}</style>
    </div>
  );
}
