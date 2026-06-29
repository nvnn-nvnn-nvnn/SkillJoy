import { useState } from 'react';
import { useUser } from '@/lib/stores';
import { supabase } from '@/lib/supabase';
import { apiFetch } from '@/lib/api';

const ADMIN_EMAIL = 'techkage@proton.me'; // matches the Header admin gate

// Phase 12 — admin tooling: place/clear a transparent payout hold on a creator.
export default function AdminPayouts() {
  const user = useUser();
  const [handle, setHandle] = useState('');
  const [target, setTarget] = useState(null); // { id, username, payout_held, payout_hold_reason }
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  if (!user || user.email !== ADMIN_EMAIL) {
    return <div style={{ maxWidth: 440, margin: '0 auto', padding: '80px 20px', textAlign: 'center' }}><p>Not authorized.</p></div>;
  }

  async function lookup() {
    setErr(''); setMsg(''); setTarget(null);
    const name = handle.trim().replace(/^@/, '');
    const { data, error } = await supabase
      .from('profiles').select('id, username, full_name, payout_held, payout_hold_reason')
      .ilike('username', name).maybeSingle();
    if (error) { setErr(error.message); return; }
    if (!data) { setErr('No creator with that username.'); return; }
    setTarget(data); setReason(data.payout_hold_reason || '');
  }

  async function setHold(held) {
    setBusy(true); setErr(''); setMsg('');
    try {
      const res = await apiFetch('/api/admin/payout-hold', {
        method: 'POST', body: JSON.stringify({ userId: target.id, held, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed.');
      setTarget({ ...target, payout_held: held, payout_hold_reason: held ? reason : null });
      setMsg(held ? 'Payout hold placed — creator notified.' : 'Hold cleared — creator notified.');
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '32px 16px 80px' }}>
      <title>Admin · Payout holds — SkillJoy</title>
      <h1 style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-display)', marginBottom: 6 }}>Payout holds</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 20 }}>
        Human-set holds only. The reason is shown to the creator verbatim — no silent freezes.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input value={handle} onChange={e => setHandle(e.target.value)} placeholder="@username" style={{ flex: 1 }} />
        <button className="btn btn-secondary" onClick={lookup}>Look up</button>
      </div>

      {err && <p style={{ color: 'var(--accent)', fontSize: 14 }}>{err}</p>}
      {msg && <p style={{ color: 'var(--green)', fontSize: 14 }}>{msg}</p>}

      {target && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', background: 'var(--surface)', padding: 18 }}>
          <p style={{ fontWeight: 700 }}>{target.full_name || `@${target.username}`} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>@{target.username}</span></p>
          <p style={{ fontSize: 14, margin: '6px 0 14px', color: target.payout_held ? 'var(--accent)' : 'var(--green)' }}>
            {target.payout_held ? '● Payouts currently HELD' : '● Payouts active'}
          </p>
          <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="Reason shown to the creator…" style={{ width: '100%', marginBottom: 12, resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" disabled={busy} onClick={() => setHold(true)}>Place hold</button>
            <button className="btn btn-secondary" disabled={busy} onClick={() => setHold(false)}>Clear hold</button>
          </div>
        </div>
      )}
    </div>
  );
}
