import { useState, useEffect } from 'react';
import { getCreatorEvents } from '@/lib/analytics';

// ── Creator analytics (v3, doc 06) ──────────────────────────────────────────
// Visual funnel + engagement off analytics_events. Kept simple and legible —
// the point is to beat incumbents' "basic analytics," not to be a BI tool.

export default function AnalyticsCards({ creatorId }) {
  const [events, setEvents] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    getCreatorEvents(creatorId).then(setEvents).catch(e => setErr(e.message));
  }, [creatorId]);

  if (err) return <p className="ac-muted">Couldn’t load analytics: {err}</p>;
  if (events === null) return <p className="ac-muted">Loading analytics…</p>;

  const count = (t) => events.filter(e => e.type === t).length;
  const views = count('storefront_view') + count('skill_view');
  const checkouts = count('checkout_start');
  const purchases = count('purchase');
  const opens = count('block_open');
  const conv = views ? Math.round((purchases / views) * 100) : 0;

  // Distinct buyers who opened any content.
  const engaged = new Set(events.filter(e => e.type === 'block_open' && e.buyer_id).map(e => e.buyer_id)).size;

  const funnel = [
    { label: 'Views', value: views },
    { label: 'Checkouts', value: checkouts },
    { label: 'Purchases', value: purchases },
  ];
  const max = Math.max(views, 1);

  return (
    <div className="ac">
      <div className="ac-cards">
        <Stat label="Storefront + Skill views" value={views} />
        <Stat label="Checkouts started" value={checkouts} />
        <Stat label="Purchases" value={purchases} />
        <Stat label="Conversion" value={`${conv}%`} accent />
      </div>

      <div className="ac-funnel">
        <p className="ac-h">Conversion funnel</p>
        {funnel.map((f) => (
          <div key={f.label} className="ac-frow">
            <span className="ac-flabel">{f.label}</span>
            <div className="ac-fbar"><div className="ac-ffill" style={{ width: `${(f.value / max) * 100}%` }} /></div>
            <span className="ac-fval">{f.value}</span>
          </div>
        ))}
      </div>

      <div className="ac-cards">
        <Stat label="Content opens" value={opens} />
        <Stat label="Buyers who engaged" value={engaged} />
      </div>

      <style>{`
        .ac { display:flex; flex-direction:column; gap:16px; }
        .ac-muted { color:var(--text-muted); font-size:14px; }
        .ac-cards { display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:12px; }
        .ac-h { font-weight:700; font-size:13px; text-transform:uppercase; letter-spacing:.05em; color:var(--text-muted); margin-bottom:10px; }
        .ac-funnel { border:1px solid var(--border); border-radius:var(--r-lg); background:var(--surface); padding:16px; }
        .ac-frow { display:flex; align-items:center; gap:12px; margin-bottom:10px; }
        .ac-frow:last-child { margin-bottom:0; }
        .ac-flabel { width:84px; font-size:13px; color:var(--text-secondary); font-weight:600; }
        .ac-fbar { flex:1; height:14px; background:var(--surface-alt); border-radius:var(--r-full); overflow:hidden; }
        .ac-ffill { height:100%; background:var(--accent); border-radius:var(--r-full); transition:width .4s ease; min-width:2px; }
        .ac-fval { width:40px; text-align:right; font-weight:700; font-size:14px; }
      `}</style>
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div className="ac-stat" style={accent ? { borderColor: 'var(--accent-mid)', background: 'var(--accent-light)' } : {}}>
      <span className="ac-stat-val">{value}</span>
      <span className="ac-stat-label">{label}</span>
      <style>{`
        .ac-stat { border:1px solid var(--border); border-radius:var(--r); background:var(--surface); padding:14px; }
        .ac-stat-val { display:block; font-size:26px; font-weight:800; color:var(--text); }
        .ac-stat-label { display:block; font-size:12px; color:var(--text-muted); margin-top:2px; }
      `}</style>
    </div>
  );
}
