import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '@/lib/stores';
import { useDialog } from '@/components/Dialog';
import { listCreatorSales, refundPurchase } from '@/lib/purchases';
import { listCreatorBookings } from '@/lib/booking';
import PayoutStatus from '@/components/PayoutStatus';
import AnalyticsCards from '@/components/AnalyticsCards';
import AvailabilityEditor from '@/components/AvailabilityEditor';
import AudiencePanel from '@/components/AudiencePanel';
import DiscountsPanel from '@/components/DiscountsPanel';

// Phase 5 — creator dashboard: revenue, transparent payouts, analytics funnel,
// and an exportable buyer list. See docs/v3-skill-platform/06.
// Phase B — the seven stacked panels were folded into tabbed sections so the
// page breathes; the KPI stat row stays pinned above the tabs.
const TABS = [
  ['overview', 'Overview'],
  ['sales', 'Sales'],
  ['bookings', 'Bookings'],
  ['audience', 'Audience'],
];

export default function Dashboard() {
  const user = useUser();
  const { confirm, alert } = useDialog();
  const [sales, setSales] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [refunding, setRefunding] = useState(null);
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    if (user) {
      listCreatorSales(user.id).then(setSales).catch(() => setSales([]));
      listCreatorBookings(user.id).then(setBookings).catch(() => setBookings([]));
    }
  }, [user]);

  if (!user) return <div className="db-wrap"><p className="db-muted">Please log in.</p><DashStyles /></div>;

  const revenue = (sales ?? []).reduce((s, p) => s + p.amount_cents, 0) / 100;
  const buyerCount = new Set((sales ?? []).map(p => p.buyer?.id)).size;

  async function refund(p) {
    const ok = await confirm({
      title: 'Issue a refund?',
      message: `Refund $${(p.amount_cents / 100).toFixed(2)} to ${p.buyer?.full_name || 'this buyer'}? They'll lose access to the product.`,
      confirmLabel: 'Refund',
      danger: true,
    });
    if (!ok) return;
    setRefunding(p.id);
    try { await refundPurchase(p.id); setSales(s => s.filter(x => x.id !== p.id)); }
    catch (e) { alert({ title: 'Refund failed', message: e.message, tone: 'danger' }); }
    finally { setRefunding(null); }
  }

  function exportCsv() {
    const rows = [['Date', 'Skill', 'Buyer', 'Email', 'Amount']];
    (sales ?? []).forEach(p => rows.push([
      new Date(p.created_at).toISOString().slice(0, 10),
      p.skill?.title ?? '',
      p.buyer?.full_name ?? '',
      p.buyer?.email ?? '',
      (p.amount_cents / 100).toFixed(2),
    ]));
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = `skilljoy-buyers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="db-wrap">
      <title>Dashboard — SkillJoy</title>
      <div className="db-headrow">
        <h1 className="db-h1">Dashboard</h1>
        <div className="db-headrow-actions">
          <Link to="/storefront/edit" className="btn btn-secondary btn-sm">Customize storefront</Link>
          <Link to="/build/new" className="btn btn-primary btn-sm">+ New product</Link>
        </div>
      </div>

      {/* Top stats */}
      <div className="db-top">
        <div className="db-stat db-stat-accent">
          <span className="db-stat-val">${revenue.toFixed(2)}</span>
          <span className="db-stat-label">Total revenue</span>
        </div>
        <div className="db-stat">
          <span className="db-stat-val">{sales ? sales.length : '—'}</span>
          <span className="db-stat-label">Sales</span>
        </div>
        <div className="db-stat">
          <span className="db-stat-val">{sales ? buyerCount : '—'}</span>
          <span className="db-stat-label">Buyers</span>
        </div>
      </div>

      {/* Tabs */}
      <nav className="db-tabs">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" className={`db-tab${tab === id ? ' on' : ''}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </nav>

      {/* ── Overview ── */}
      {tab === 'overview' && (
        <div className="db-panel db-grid">
          <section className="db-col">
            <h2 className="db-h2">Analytics</h2>
            <AnalyticsCards creatorId={user.id} />
          </section>
          <section className="db-col">
            <PayoutStatus />
          </section>
        </div>
      )}

      {/* ── Sales ── */}
      {tab === 'sales' && (
        <div className="db-panel">
          <div className="db-buyers-head">
            <h2 className="db-h2">Buyers</h2>
            {sales?.length > 0 && <button className="btn btn-secondary btn-sm" onClick={exportCsv}>Export CSV</button>}
          </div>

          {sales === null && <p className="db-muted">Loading…</p>}
          {sales?.length === 0 && (
            <p className="db-muted">No sales yet. Share your storefront to get your first buyer — <Link to="/build/new">add a product →</Link></p>
          )}

          {sales?.length > 0 && (
            <div className="db-table">
              <div className="db-row db-row-head">
                <span>Date</span><span>Skill</span><span>Buyer</span><span className="db-amt">Amount</span><span />
              </div>
              {sales.map(p => (
                <div key={p.id} className="db-row">
                  <span>{new Date(p.created_at).toLocaleDateString()}</span>
                  <span className="db-trunc">{p.skill?.title}</span>
                  <span className="db-trunc">{p.buyer?.full_name || p.buyer?.email || 'Buyer'}</span>
                  <span className="db-amt">${(p.amount_cents / 100).toFixed(2)}</span>
                  <button className="db-refund" onClick={() => refund(p)} disabled={refunding === p.id}>
                    {refunding === p.id ? '…' : 'Refund'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Bookings ── */}
      {tab === 'bookings' && (
        <div className="db-panel db-grid">
          <div className="db-col">
            <h2 className="db-h2">Upcoming sessions</h2>
            {bookings.length === 0 ? (
              <p className="db-muted">No booked sessions yet.</p>
            ) : (
              <div className="db-table">
                {bookings.map(b => (
                  <div key={b.id} className="db-row" style={{ gridTemplateColumns: '1.2fr 1.4fr 1fr' }}>
                    <span>{new Date(b.start_time).toLocaleDateString([], { month: 'short', day: 'numeric' })} {new Date(b.start_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                    <span className="db-trunc">{b.skill?.title}</span>
                    <span className="db-trunc">{b.buyer?.full_name || 'Buyer'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="db-col">
            <AvailabilityEditor />
          </div>
        </div>
      )}

      {/* ── Audience ── */}
      {tab === 'audience' && (
        <div className="db-panel db-grid">
          <div className="db-col"><AudiencePanel /></div>
          <div className="db-col"><DiscountsPanel /></div>
        </div>
      )}

      <DashStyles />
    </div>
  );
}

function DashStyles() {
  return <style>{`
    .db-wrap { max-width:900px; margin:0 auto; padding:24px 16px 80px; }
    .db-h1 { font-size:26px; font-weight:700; font-family:var(--font-display); }
    .db-headrow { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:18px; flex-wrap:wrap; }
    .db-headrow-actions { display:flex; gap:8px; }
    .db-h2 { font-size:18px; font-weight:700; margin-bottom:14px; }
    .db-muted { color:var(--text-muted); font-size:14px; }

    .db-top { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:24px; }
    .db-stat { border:1px solid var(--border); border-radius:var(--r-lg); background:var(--surface); padding:18px; }
    .db-stat-accent { border-color:var(--accent-mid); background:var(--accent-light); }
    .db-stat-val { display:block; font-size:28px; font-weight:800; color:var(--text); }
    .db-stat-label { display:block; font-size:12px; color:var(--text-muted); margin-top:2px; text-transform:uppercase; letter-spacing:.04em; }

    .db-grid { display:grid; grid-template-columns:1.3fr 1fr; gap:20px; align-items:start; margin-bottom:28px; }
    .db-col { min-width:0; }

    .db-buyers-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; }
    .db-table { border:1px solid var(--border); border-radius:var(--r-lg); overflow:hidden; background:var(--surface); }
    .db-row { display:grid; grid-template-columns:1fr 1.3fr 1.3fr 0.7fr auto; gap:10px; padding:12px 14px; border-top:1px solid var(--border); font-size:14px; align-items:center; }
    .db-row:first-child { border-top:none; }
    .db-row-head { background:var(--surface-alt); font-weight:700; font-size:12px; text-transform:uppercase; letter-spacing:.04em; color:var(--text-muted); }
    .db-amt { text-align:right; font-weight:700; }
    .db-trunc { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .db-refund { background:none; border:1px solid var(--border-strong); border-radius:var(--r-sm); padding:4px 10px; font-size:12px; font-weight:600; color:var(--text-secondary); cursor:pointer; }
    .db-refund:hover:not(:disabled) { border-color:var(--accent); color:var(--accent); }
    .db-refund:disabled { opacity:.5; }

    /* ── Tabs (Phase B) — override the global button reset (pill/centered) ── */
    .db-tabs { display:flex; gap:6px; border-bottom:1px solid var(--border); margin-bottom:28px; overflow-x:auto; }
    .db-tab { border:none; background:none; border-radius:0; padding:12px 16px; font-size:14px; font-weight:700; color:var(--text-muted); cursor:pointer; white-space:nowrap; border-bottom:2px solid transparent; margin-bottom:-1px; transition:color .12s ease; }
    .db-tab:hover { color:var(--text-secondary); }
    .db-tab.on { color:var(--text); border-bottom-color:var(--accent); }

    .db-panel { animation:db-fade .16s ease; }
    .db-panel.db-grid { margin-bottom:0; }
    @keyframes db-fade { from { opacity:0; transform:translateY(3px); } to { opacity:1; transform:none; } }

    @media (max-width:720px) {
      .db-top { grid-template-columns:1fr 1fr; }
      .db-grid { grid-template-columns:1fr; }
    }
  `}</style>;
}
