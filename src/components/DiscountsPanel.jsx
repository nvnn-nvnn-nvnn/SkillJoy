import { useState, useEffect } from 'react';
import { useUser } from '@/lib/stores';
import { useDialog } from '@/components/Dialog';
import { listDiscounts, createDiscount, toggleDiscount, deleteDiscount } from '@/lib/discounts';

// ── Promo code management (v3, Phase 10) ────────────────────────────────────
export default function DiscountsPanel() {
  const user = useUser();
  const { confirm } = useDialog();
  const [codes, setCodes] = useState(null);
  const [code, setCode] = useState('');
  const [percent, setPercent] = useState(10);
  const [max, setMax] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (user) listDiscounts(user.id).then(setCodes).catch(() => setCodes([])); }, [user]);

  async function create() {
    if (!code.trim()) { setErr('Enter a code.'); return; }
    setBusy(true); setErr('');
    try {
      const d = await createDiscount(user.id, { code, percent_off: Number(percent), max_redemptions: max ? Number(max) : null });
      setCodes(c => [d, ...c]); setCode(''); setPercent(10); setMax('');
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  async function flip(d) {
    await toggleDiscount(d.id, !d.active).catch(e => setErr(e.message));
    setCodes(c => c.map(x => x.id === d.id ? { ...x, active: !x.active } : x));
  }
  async function remove(id) {
    if (!(await confirm({ title: 'Delete this code?', message: 'This promo code will stop working immediately.', confirmLabel: 'Delete', danger: true }))) return;
    await deleteDiscount(id).catch(e => setErr(e.message));
    setCodes(c => c.filter(x => x.id !== id));
  }

  return (
    <div className="dc">
      <h2 className="dc-h">Promo codes</h2>
      <p className="dc-sub">Percentage discounts for one-time Skills.</p>

      <div className="dc-create">
        <input className="dc-code" value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="LAUNCH20" />
        <div className="dc-num"><input type="number" min="1" max="100" value={percent} onChange={e => setPercent(e.target.value)} /><span>% off</span></div>
        <div className="dc-num"><input type="number" min="1" value={max} onChange={e => setMax(e.target.value)} placeholder="∞" /><span>max</span></div>
        <button className="btn btn-primary btn-sm" onClick={create} disabled={busy}>Add</button>
      </div>
      {err && <p className="dc-err">{err}</p>}

      {codes?.length === 0 && <p className="dc-muted">No codes yet.</p>}
      <div className="dc-list">
        {codes?.map(d => (
          <div key={d.id} className={`dc-row${d.active ? '' : ' off'}`}>
            <span className="dc-codename">{d.code}</span>
            <span className="dc-meta">{d.percent_off}% off · {d.times_redeemed}{d.max_redemptions ? `/${d.max_redemptions}` : ''} used</span>
            <button className="dc-link" onClick={() => flip(d)}>{d.active ? 'Disable' : 'Enable'}</button>
            <button className="dc-link dc-del" onClick={() => remove(d.id)}>Delete</button>
          </div>
        ))}
      </div>

      <style>{`
        .dc { border:1px solid var(--border); border-radius:var(--r-lg); background:var(--surface); padding:18px; }
        .dc-h { font-size:18px; font-weight:700; }
        .dc-sub { color:var(--text-muted); font-size:13px; margin:2px 0 14px; }
        .dc-muted { color:var(--text-muted); font-size:14px; }
        .dc-err { color:var(--accent); font-size:13px; margin:8px 0 0; }
        .dc-create { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
        .dc-code { flex:1; min-width:110px; text-transform:uppercase; font-weight:600; }
        .dc-num { display:flex; align-items:center; gap:4px; font-size:13px; color:var(--text-muted); }
        .dc-num input { width:64px; }
        .dc-list { display:flex; flex-direction:column; gap:8px; margin-top:12px; }
        .dc-row { display:flex; align-items:center; gap:10px; padding:8px 10px; border:1px solid var(--border); border-radius:var(--r); }
        .dc-row.off { opacity:.55; }
        .dc-codename { font-weight:700; font-family:ui-monospace,monospace; }
        .dc-meta { flex:1; font-size:13px; color:var(--text-secondary); }
        .dc-link { background:none; border:none; color:var(--text-muted); font-weight:600; font-size:13px; cursor:pointer; }
        .dc-link:hover { color:var(--accent); }
        .dc-del:hover { color:var(--accent); }
      `}</style>
    </div>
  );
}
