import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser, useProfile } from '@/lib/stores';
import { listMySkills, createSkill, updateSkill, deleteSkill, publishSkill } from '@/lib/skills';
import { listCreatorSales } from '@/lib/purchases';
import { getCreatorEvents } from '@/lib/analytics';
import {
  Plus, Search, Eye, Pencil, Share2, MoreHorizontal, Trash2,
  FileText, GraduationCap, CalendarClock, Repeat, Video, Magnet,
  Boxes, DollarSign, TrendingUp, Users, X,
} from 'lucide-react';

/*
 * ServicesDashboard — /services
 * ------------------------------------------------------------------
 * The creator's "manage everything I sell" surface, modeled on Stan Store's
 * product dashboard. Real data: skills (src/lib/skills.js) + paid sales
 * (src/lib/purchases.js). Cards filter by skill.kind (migration 011). `views`
 * and `conv` have no source yet, so they render "—" rather than fabricated.
 * Duplicate is intentionally omitted (no server-side clone of blocks yet).
 */

// ── Product types (the Stan-style catalog of what a creator can sell) ──────
// `id` matches the skills.kind enum (migration 011). `built` = has a real
// builder + checkout path today; unbuilt kinds can be tagged but not yet sold.
const PRODUCT_TYPES = [
  { id: 'digital',    label: 'Digital product', icon: FileText,      blurb: 'Sell a downloadable file, PDF, template, or preset.',        built: true },
  { id: 'course',     label: 'Online course',   icon: GraduationCap, blurb: 'Multi-module lessons with progress tracking.',              built: false },
  { id: 'coaching',   label: '1:1 coaching',    icon: CalendarClock, blurb: 'Bookable call slots synced to your availability.',          built: true },
  { id: 'membership', label: 'Membership',      icon: Repeat,        blurb: 'Recurring subscription for ongoing access.',                built: false },
  { id: 'webinar',    label: 'Webinar',         icon: Video,         blurb: 'Live or evergreen ticketed online event.',                  built: false },
  { id: 'lead',       label: 'Lead magnet',     icon: Magnet,        blurb: 'Free freebie that captures emails to your list.',           built: false },
  { id: 'bundle',     label: 'Bundle',          icon: Boxes,         blurb: 'Package several services together at one price.',           built: false },
];

const TYPE_BY_ID = Object.fromEntries(PRODUCT_TYPES.map(t => [t.id, t]));

const STATUS_META = {
  active: { label: 'Active', cls: 'sv-st-active' },
  draft:  { label: 'Draft',  cls: 'sv-st-draft' },
};

const money = (cents) => `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

// skills.status → card status. Published Skills are live ("active").
const statusOf = (skill) => (skill.status === 'published' ? 'active' : 'draft');

export default function ServicesDashboard() {
  const user = useUser();
  const profile = useProfile();
  const navigate = useNavigate();
  const [skills, setSkills] = useState(null);   // null = loading
  const [sales, setSales] = useState([]);
  const [events, setEvents] = useState([]);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [menuFor, setMenuFor] = useState(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!user) return;
    Promise.all([
      listMySkills(user.id),
      listCreatorSales(user.id).catch(() => []),
      getCreatorEvents(user.id).catch(() => []),
    ]).then(([sk, sl, ev]) => { setSkills(sk); setSales(sl); setEvents(ev); })
      .catch(() => setSkills([]));
  }, [user]);

  function ping(msg) {
    setToast(msg);
    setMenuFor(null);
    setTimeout(() => setToast(''), 2600);
  }

  // Per-skill sales aggregation: { [skillId]: { sales, revenue } }
  const salesBySkill = useMemo(() => {
    const map = {};
    for (const row of sales) {
      const id = row.skill?.id;
      if (!id) continue;
      const agg = map[id] || (map[id] = { sales: 0, revenue: 0 });
      agg.sales += 1;
      agg.revenue += row.amount_cents;
    }
    return map;
  }, [sales]);

  // Per-skill product-page views (skill_view) from analytics. storefront_view has
  // no skill_id, so it counts toward the top "Views" stat but not per-card.
  const viewsBySkill = useMemo(() => {
    const map = {};
    for (const e of events) {
      if (e.type === 'skill_view' && e.skill_id) map[e.skill_id] = (map[e.skill_id] || 0) + 1;
    }
    return map;
  }, [events]);

  const totalViews = useMemo(
    () => events.filter(e => e.type === 'storefront_view' || e.type === 'skill_view').length,
    [events]
  );

  // skills → view-model service cards
  const services = useMemo(() => (skills ?? []).map(s => {
    const agg = salesBySkill[s.id] || { sales: 0, revenue: 0 };
    const views = viewsBySkill[s.id] || 0;
    return {
      id: s.id,
      kind: TYPE_BY_ID[s.kind] ? s.kind : 'digital',
      title: s.title || 'Untitled Skill',
      status: statusOf(s),
      price: s.price_cents ?? 0,
      recurring: s.pricing_type === 'membership',
      sales: agg.sales,
      revenue: agg.revenue,
      views,
      conv: views > 0 ? (agg.sales / views) * 100 : null,
    };
  }), [skills, salesBySkill, viewsBySkill]);

  const totals = useMemo(() => ({
    count: services.length,
    active: services.filter(s => s.status === 'active').length,
    revenue: services.reduce((sum, s) => sum + s.revenue, 0),
    sales: services.reduce((sum, s) => sum + s.sales, 0),
    views: totalViews,
  }), [services, totalViews]);

  const counts = useMemo(() => {
    const c = { all: services.length };
    for (const s of services) c[s.kind] = (c[s.kind] || 0) + 1;
    return c;
  }, [services]);

  const visible = services.filter(s =>
    (filter === 'all' || s.kind === filter) &&
    s.title.toLowerCase().includes(query.trim().toLowerCase())
  );

  // Public URL for a skill's sales page: /@handle/:skillId (see main.jsx).
  const publicUrl = (id) => profile?.username ? `${window.location.origin}/@${profile.username}/${id}` : null;

  async function createOfKind(kind) {
    setShowNew(false);
    try {
      const s = await createSkill(user.id, { title: 'Untitled Skill', kind });
      navigate(`/build/${s.id}`);
    } catch (e) { ping(e.message); }
  }

  function preview(id) {
    const url = publicUrl(id);
    if (!url) { ping('Set a storefront handle in your profile first'); return; }
    window.open(url, '_blank', 'noopener');
  }

  async function share(id) {
    const url = publicUrl(id);
    if (!url) { ping('Set a storefront handle in your profile first'); return; }
    try { await navigator.clipboard.writeText(url); ping('Link copied to clipboard'); }
    catch { ping(url); }
  }

  async function toggleStatus(s) {
    setMenuFor(null);
    try {
      if (s.status === 'active') await updateSkill(s.id, { status: 'draft' });
      else await publishSkill(s.id);
      setSkills(prev => prev.map(x => x.id === s.id ? { ...x, status: s.status === 'active' ? 'draft' : 'published' } : x));
    } catch (e) { ping(e.message); }
  }

  async function remove(id) {
    setMenuFor(null);
    if (!confirm('Delete this service and all its content? This cannot be undone.')) return;
    try {
      await deleteSkill(id);
      setSkills(prev => prev.filter(x => x.id !== id));
    } catch (e) { ping(e.message); }
  }

  const filterTabs = [{ id: 'all', label: 'All' }, ...PRODUCT_TYPES.map(t => ({ id: t.id, label: t.label }))];

  if (!user) return <div className="sv-wrap"><p className="sv-empty-loading">Please log in to manage your services.</p><Styles /></div>;

  return (
    <div className="sv-wrap" onClick={() => setMenuFor(null)}>
      <title>Services — SkillJoy</title>

      {/* ── Header ── */}
      <div className="sv-head">
        <div>
          <h1 className="sv-h1">Services</h1>
          <p className="sv-sub">Everything you sell, in one place.</p>
        </div>
        <div className="sv-head-actions">
          <Link to="/dashboard" className="btn btn-secondary btn-sm">View earnings</Link>
          <button className="sv-new" onClick={() => setShowNew(true)}><Plus size={16} /> New service</button>
        </div>
      </div>

      {skills === null ? (
        <p className="sv-empty-loading">Loading your services…</p>
      ) : (
      <>
      {/* ── Summary stats ── */}
      <div className="sv-stats">
        <Stat icon={Boxes}      label="Services" value={totals.count} />
        <Stat icon={TrendingUp} label="Active"   value={totals.active} />
        <Stat icon={DollarSign} label="Revenue"  value={money(totals.revenue)} accent />
        <Stat icon={Users}      label="Sales"    value={totals.sales.toLocaleString()} />
        <Stat icon={Eye}        label="Views"    value={totals.views.toLocaleString()} />
      </div>

      {/* ── Filters + search ── */}
      <div className="sv-controls">
        <div className="sv-tabs">
          {filterTabs.map(t => (
            <button key={t.id} className={`sv-tab ${filter === t.id ? 'active' : ''}`} onClick={() => setFilter(t.id)}>
              {t.label}
              {counts[t.id] ? <span className="sv-tab-count">{counts[t.id]}</span> : null}
            </button>
          ))}
        </div>
        <div className="sv-search">
          <Search size={15} />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search services…" />
        </div>
      </div>

      {/* ── Service list ── */}
      {visible.length === 0 ? (
        <div className="sv-empty">
          <div className="sv-empty-icon">🗂️</div>
          <h3>No services here yet</h3>
          <p>{query ? 'Nothing matches your search.' : 'Create your first service to start selling.'}</p>
          <button className="sv-new" onClick={() => setShowNew(true)}><Plus size={16} /> New service</button>
        </div>
      ) : (
        <div className="sv-grid">
          {visible.map(s => {
            const type = TYPE_BY_ID[s.kind];
            const Icon = type.icon;
            const st = STATUS_META[s.status];
            return (
              <div key={s.id} className="sv-card">
                <div className="sv-card-top">
                  <div className="sv-type"><Icon size={15} /> {type.label}</div>
                  <span className={`sv-status ${st.cls}`}>{st.label}</span>
                </div>

                <h3 className="sv-title">{s.title}</h3>
                <div className="sv-price">
                  {s.price === 0 ? <span className="sv-free">Free</span> : money(s.price)}
                  {s.recurring && <span className="sv-per">/mo</span>}
                </div>

                <div className="sv-metrics">
                  <Metric label="Sales"   value={s.sales.toLocaleString()} />
                  <Metric label="Revenue" value={money(s.revenue)} />
                  <Metric label="Views"   value={s.views.toLocaleString()} />
                  <Metric label="Conv."   value={s.conv == null ? '—' : `${s.conv.toFixed(1)}%`} />
                </div>

                <div className="sv-actions">
                  <button className="sv-btn" onClick={() => navigate(`/build/${s.id}`)}><Pencil size={14} /> Edit</button>
                  <button className="sv-btn" onClick={() => preview(s.id)}><Eye size={14} /> Preview</button>
                  <button className="sv-btn" onClick={() => share(s.id)}><Share2 size={14} /> Share</button>
                  <div className="sv-menu-wrap" onClick={e => e.stopPropagation()}>
                    <button className="sv-btn sv-btn-icon" onClick={() => setMenuFor(menuFor === s.id ? null : s.id)}>
                      <MoreHorizontal size={16} />
                    </button>
                    {menuFor === s.id && (
                      <div className="sv-menu">
                        <button onClick={() => toggleStatus(s)}><Repeat size={14} /> {s.status === 'active' ? 'Unpublish' : 'Publish'}</button>
                        <button className="sv-menu-danger" onClick={() => remove(s.id)}><Trash2 size={14} /> Delete</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </>
      )}

      {/* ── New-service modal (product-type picker) ── */}
      {showNew && (
        <div className="sv-modal-bg" onClick={() => setShowNew(false)}>
          <div className="sv-modal" onClick={e => e.stopPropagation()}>
            <button className="sv-modal-close" onClick={() => setShowNew(false)}><X size={18} /></button>
            <h2 className="sv-modal-title">What do you want to sell?</h2>
            <p className="sv-modal-sub">Pick a product type to get started.</p>
            <div className="sv-type-grid">
              {PRODUCT_TYPES.map(t => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    className="sv-type-card"
                    onClick={() => { if (t.built) createOfKind(t.id); else { setShowNew(false); ping(`${t.label} isn't built yet`); } }}
                  >
                    <span className="sv-type-icon"><Icon size={20} /></span>
                    <span className="sv-type-name">{t.label}{!t.built && <span className="sv-soon">Soon</span>}</span>
                    <span className="sv-type-blurb">{t.blurb}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {toast && <div className="sv-toast">{toast}</div>}

      <Styles />
    </div>
  );
}

function Stat({ icon, label, value, accent }) {
  const Icon = icon;
  return (
    <div className={`sv-stat ${accent ? 'sv-stat-accent' : ''}`}>
      <span className="sv-stat-icon"><Icon size={16} /></span>
      <span className="sv-stat-val">{value}</span>
      <span className="sv-stat-label">{label}</span>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="sv-metric">
      <span className="sv-metric-val">{value}</span>
      <span className="sv-metric-label">{label}</span>
    </div>
  );
}

function Styles() {
  return <style>{`
    .sv-wrap { max-width: 1040px; margin: 0 auto; padding: 24px 16px 90px; }
    .sv-h1 { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; font-family: var(--font-display); margin: 0 0 4px; }
    .sv-sub { font-size: 14px; color: var(--text-secondary); margin: 0; display: flex; align-items: center; gap: 8px; }
    .sv-pill { font-size: 10px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase;
      color: var(--accent); background: var(--accent-light); border: 1px solid var(--accent-mid); border-radius: 999px; padding: 2px 8px; }

    .sv-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; flex-wrap: wrap; margin-bottom: 22px; }
    .sv-head-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .sv-new { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 10px 18px; border: none; border-radius: 10px;
      background: var(--accent); color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; transition: background .15s; }
    .sv-new:hover { background: var(--accent-hover); }

    .sv-empty-loading { color: var(--text-muted); font-size: 14px; padding: 40px 0; text-align: center; }

    /* Stats — auto-fit so they reflow from 4 cols down to 2 without breakpoints */
    .sv-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(148px, 1fr)); gap: 12px; margin-bottom: 24px; }
    .sv-stat { border: 1px solid var(--border); border-radius: var(--r-lg, 14px); background: var(--surface); padding: 16px; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .sv-stat-accent { border-color: var(--accent-mid); background: var(--accent-light); }
    .sv-stat-icon { color: var(--text-muted); margin-bottom: 6px; }
    .sv-stat-val { font-size: 22px; font-weight: 800; letter-spacing: -0.02em; color: var(--text); overflow-wrap: anywhere; }
    .sv-stat-label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: .04em; }

    /* Controls */
    .sv-controls { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 18px; flex-wrap: wrap; }
    .sv-tabs { display: flex; gap: 4px; padding: 5px; background: var(--surface-alt); border-radius: 12px; overflow-x: auto;
      -webkit-overflow-scrolling: touch; scrollbar-width: none; max-width: 100%; }
    .sv-tabs::-webkit-scrollbar { display: none; }
    .sv-tab { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border: none; border-radius: 8px; flex: 0 0 auto;
      background: transparent; color: var(--text-secondary); font-size: 13px; font-weight: 500; cursor: pointer; font-family: inherit; white-space: nowrap; transition: all .15s; }
    .sv-tab:hover { color: var(--text); background: var(--surface); }
    .sv-tab.active { background: var(--surface); color: var(--text); font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,.06); }
    .sv-tab-count { font-size: 11px; color: var(--text-muted); }
    .sv-search { display: flex; align-items: center; gap: 8px; padding: 8px 14px; border: 1px solid var(--border); border-radius: 10px;
      background: var(--surface); color: var(--text-muted); flex: 1 1 220px; min-width: 0; }
    .sv-search input { border: none; outline: none; background: none; font-size: 14px; color: var(--text); font-family: inherit; width: 100%; min-width: 0; }

    /* Grid + cards — min(100%, …) keeps a single card from overflowing narrow screens */
    .sv-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr)); gap: 16px; }
    .sv-card { display: flex; flex-direction: column; gap: 10px; padding: 18px; border: 1px solid var(--border);
      border-radius: var(--r-lg, 14px); background: var(--surface); transition: box-shadow .2s, transform .2s; }
    .sv-card:hover { box-shadow: 0 4px 20px rgba(0,0,0,.06); transform: translateY(-2px); }
    .sv-card-top { display: flex; justify-content: space-between; align-items: center; }
    .sv-type { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: var(--text-secondary); }
    .sv-status { font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 999px; }
    .sv-st-active { background: #dcfce7; color: #15803d; }
    .sv-st-draft { background: #f3f4f6; color: #6b7280; }
    .sv-st-sched { background: #FEF3C7; color: #92400E; }
    .sv-title { font-size: 16px; font-weight: 700; margin: 0; line-height: 1.3; }
    .sv-price { font-size: 20px; font-weight: 800; letter-spacing: -0.02em; }
    .sv-per { font-size: 13px; font-weight: 600; color: var(--text-muted); }
    .sv-free { color: #15803d; }

    .sv-metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; padding: 12px 0; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
    .sv-metric { display: flex; flex-direction: column; }
    .sv-metric-val { font-size: 14px; font-weight: 700; }
    .sv-metric-label { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: .03em; }

    .sv-actions { display: flex; gap: 6px; align-items: center; margin-top: auto; flex-wrap: wrap; }
    .sv-btn { display: inline-flex; align-items: center; justify-content: center; gap: 5px; padding: 7px 11px; border: 1px solid var(--border);
      border-radius: 8px; background: var(--surface); color: var(--text-secondary); font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all .14s; flex: 1 1 auto; }
    .sv-btn:hover { border-color: var(--text); color: var(--text); }
    .sv-btn-icon { padding: 7px 8px; }
    .sv-menu-wrap { position: relative; margin-left: auto; flex: 0 0 auto; }
    .sv-menu { position: absolute; right: 0; top: calc(100% + 6px); z-index: 20; min-width: 168px; padding: 6px;
      background: var(--surface); border: 1px solid var(--border); border-radius: 10px; box-shadow: 0 12px 32px rgba(0,0,0,.14); }
    .sv-menu button { display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px 10px; border: none; background: none;
      font-size: 13px; font-weight: 500; color: var(--text); cursor: pointer; font-family: inherit; border-radius: 6px; }
    .sv-menu button:hover { background: var(--surface-alt); }
    .sv-menu-danger { color: var(--accent) !important; }

    /* Empty */
    .sv-empty { text-align: center; padding: 64px 20px; background: var(--surface); border: 1px dashed var(--border-strong); border-radius: 14px; }
    .sv-empty-icon { font-size: 44px; margin-bottom: 10px; }
    .sv-empty h3 { font-size: 18px; font-weight: 700; margin: 0 0 6px; }
    .sv-empty p { font-size: 14px; color: var(--text-secondary); margin: 0 0 20px; }

    /* Modal */
    .sv-modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center; z-index: 500; padding: 16px; }
    .sv-modal { position: relative; background: var(--surface); border-radius: 16px; padding: 30px; max-width: 620px; width: 100%; max-height: 85vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,.2); }
    .sv-modal-close { position: absolute; top: 16px; right: 16px; background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 4px; }
    .sv-modal-title { font-size: 22px; font-weight: 800; margin: 0 0 4px; }
    .sv-modal-sub { font-size: 14px; color: var(--text-secondary); margin: 0 0 20px; }
    .sv-type-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
    .sv-type-card { display: flex; flex-direction: column; gap: 6px; text-align: left; padding: 16px; border: 1px solid var(--border);
      border-radius: 12px; background: var(--surface); cursor: pointer; font-family: inherit; transition: all .15s; }
    .sv-type-card:hover { border-color: var(--accent-mid); background: var(--accent-light); transform: translateY(-1px); }
    .sv-type-icon { color: var(--accent); }
    .sv-type-name { font-size: 15px; font-weight: 700; color: var(--text); display: flex; align-items: center; gap: 8px; }
    .sv-soon { font-size: 9px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--text-muted);
      background: var(--surface-alt); border: 1px solid var(--border); border-radius: 999px; padding: 1px 6px; }
    .sv-type-blurb { font-size: 12px; color: var(--text-secondary); line-height: 1.45; }

    /* Toast */
    .sv-toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); z-index: 600;
      background: var(--text, #111); color: #fff; padding: 11px 20px; border-radius: 10px; font-size: 14px; font-weight: 600; box-shadow: 0 8px 24px rgba(0,0,0,.2); }

    @media (max-width: 720px) {
      .sv-wrap { padding: 18px 12px 90px; }
      .sv-head { gap: 12px; }
      .sv-head-actions { width: 100%; }
      .sv-head-actions > * { flex: 1 1 auto; }
      .sv-controls { flex-direction: column; align-items: stretch; }
      .sv-type-grid { grid-template-columns: 1fr; }
      .sv-modal { padding: 24px 18px; border-radius: 14px; }
    }
    @media (max-width: 380px) {
      .sv-stats { grid-template-columns: 1fr 1fr; }
    }
  `}</style>;
}
