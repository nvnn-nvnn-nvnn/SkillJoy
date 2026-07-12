import { useState, useEffect } from 'react';
import { useUser } from '@/lib/stores';
import { useDialog } from '@/components/Dialog';
import { listSubscribers, sendBroadcast } from '@/lib/subscribers';

// ── Audience: subscribers + broadcast composer (v3, Phase 9) ────────────────
export default function AudiencePanel() {
  const user = useUser();
  const { confirm } = useDialog();
  const [subs, setSubs] = useState(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => { if (user) listSubscribers(user.id).then(setSubs).catch(() => setSubs([])); }, [user]);

  function exportCsv() {
    const rows = [['Email', 'Name', 'Source', 'Joined']];
    (subs ?? []).forEach(s => rows.push([s.email, s.name ?? '', s.source ?? '', new Date(s.created_at).toISOString().slice(0, 10)]));
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = `skilljoy-subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  async function send() {
    if (!subject.trim() || !body.trim()) { setErr('Add a subject and a message.'); return; }
    if (!(await confirm({ title: 'Send broadcast?', message: `This emails ${subs.length} subscriber${subs.length === 1 ? '' : 's'}.`, confirmLabel: 'Send' }))) return;
    setBusy(true); setErr(''); setMsg('');
    try {
      const { sent, failed } = await sendBroadcast(subject.trim(), body.trim());
      setMsg(`Sent to ${sent}${failed ? `, ${failed} failed` : ''}.`);
      setSubject(''); setBody('');
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  const count = subs?.length ?? 0;

  return (
    <div className="au">
      <div className="au-head">
        <h2 className="au-h">Audience <span className="au-count">{subs === null ? '' : count}</span></h2>
        {count > 0 && <button className="btn btn-secondary btn-sm" onClick={exportCsv}>Export CSV</button>}
      </div>
      <p className="au-sub">People who subscribed from your storefront.</p>

      {subs === null ? (
        <p className="au-hint">Loading…</p>
      ) : count > 0 ? (
        <div className="au-list">
          {subs.map(s => (
            <div key={s.id} className="au-row">
              <div className="au-rowmain">
                <span className="au-email">{s.email}</span>
                {s.name && <span className="au-name">{s.name}</span>}
              </div>
              <span className="au-date">{new Date(s.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="au-compose">
        <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject" />
        <textarea rows={4} value={body} onChange={e => setBody(e.target.value)} placeholder="Write your update…" />
        <div className="au-actions">
          <button className="btn btn-primary btn-sm" onClick={send} disabled={busy || count === 0}>
            {busy ? 'Sending…' : `Send broadcast${count ? ` (${count})` : ''}`}
          </button>
          {msg && <span className="au-msg">{msg}</span>}
          {err && <span className="au-err">{err}</span>}
        </div>
        {count === 0 && <p className="au-hint">No subscribers yet — share your storefront link to grow your list.</p>}
      </div>

      <style>{`
        .au { border:1px solid var(--border); border-radius:var(--r-lg); background:var(--surface); padding:18px; }
        .au-head { display:flex; justify-content:space-between; align-items:center; }
        .au-h { font-size:18px; font-weight:700; }
        .au-count { color:var(--accent); }
        .au-sub { color:var(--text-muted); font-size:13px; margin:2px 0 14px; }
        .au-list { max-height:280px; overflow-y:auto; border:1px solid var(--border); border-radius:var(--r); margin-bottom:16px; }
        .au-row { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 14px; border-top:1px solid var(--border); font-size:13.5px; }
        .au-row:first-child { border-top:none; }
        .au-rowmain { min-width:0; display:flex; flex-direction:column; }
        .au-email { color:var(--text); font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .au-name { color:var(--text-muted); font-size:12px; }
        .au-date { flex-shrink:0; color:var(--text-muted); font-size:12px; }
        .au-compose { display:flex; flex-direction:column; gap:10px; }
        .au-compose textarea { resize:vertical; font-family:inherit; }
        .au-actions { display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
        .au-msg { color:var(--green); font-size:13px; font-weight:600; }
        .au-err { color:var(--accent); font-size:13px; }
        .au-hint { color:var(--text-muted); font-size:13px; }
      `}</style>
    </div>
  );
}
