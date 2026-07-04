import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { listStorefronts } from '@/lib/profiles';

// v3 Discover — browse public creator storefronts. Replaces the legacy
// skill-swap matcher (MainSearch). Each card links to /@handle.
export default function Discover() {
  const [stores, setStores] = useState(null); // null = loading
  const [q, setQ] = useState('');

  useEffect(() => { listStorefronts().then(setStores).catch(() => setStores([])); }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return stores ?? [];
    return (stores ?? []).filter(s =>
      (s.full_name || '').toLowerCase().includes(term) ||
      (s.username || '').toLowerCase().includes(term) ||
      (s.bio || '').toLowerCase().includes(term));
  }, [stores, q]);

  return (
    <div className="dc-wrap">
      <title>Discover creators — SkillJoy</title>

      <header className="dc-head">
        <h1 className="dc-h1">Discover creators</h1>
        <p className="dc-sub">Browse storefronts and find something worth buying.</p>
      </header>

      <input className="dc-search" value={q} onChange={e => setQ(e.target.value)}
        placeholder="Search creators…" />

      {stores === null && <p className="dc-muted">Loading…</p>}
      {stores?.length === 0 && <p className="dc-muted">No storefronts yet — be the first to publish.</p>}
      {stores?.length > 0 && filtered.length === 0 && <p className="dc-muted">No creators match “{q}”.</p>}

      <div className="dc-grid">
        {filtered.map(s => (
          <Link key={s.id} to={`/@${s.username}`} className="dc-card">
            <div className="dc-cover" style={s.cover ? { backgroundImage: `url(${s.cover})` } : {}}>
              {!s.cover && <span className="dc-cover-ph">🛍️</span>}
            </div>
            <div className="dc-avatar" style={s.avatar_url ? { backgroundImage: `url(${s.avatar_url})` } : {}}>
              {!s.avatar_url && <span>{(s.full_name || s.username || '?').charAt(0).toUpperCase()}</span>}
            </div>
            <div className="dc-body">
              <p className="dc-name">{s.full_name || `@${s.username}`}</p>
              <p className="dc-handle">@{s.username}</p>
              {s.bio && <p className="dc-bio">{s.bio}</p>}
              <span className="dc-count">{s.productCount} product{s.productCount === 1 ? '' : 's'}</span>
            </div>
          </Link>
        ))}
      </div>

      <style>{`
        .dc-wrap { max-width:940px; margin:0 auto; padding:32px 20px 96px; }
        .dc-head { margin-bottom:20px; }
        .dc-h1 { font-size:30px; font-weight:800; font-family:var(--font-display); letter-spacing:-.01em; }
        .dc-sub { color:var(--text-secondary); font-size:15px; margin-top:8px; }
        .dc-muted { color:var(--text-muted); font-size:14px; }
        .dc-search { width:100%; max-width:420px; margin-bottom:28px; }

        .dc-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:18px; }
        .dc-card { position:relative; display:block; border:1px solid var(--border); border-radius:var(--r-lg); background:var(--surface); overflow:hidden; text-decoration:none; box-shadow:var(--shadow-sm); transition:transform .12s ease, box-shadow .12s ease, border-color .12s ease; }
        .dc-card:hover { transform:translateY(-3px); box-shadow:var(--shadow-lg); border-color:var(--accent-mid); }
        .dc-cover { aspect-ratio:16/7; background:var(--surface-alt) center/cover no-repeat; display:flex; align-items:center; justify-content:center; }
        .dc-cover-ph { font-size:30px; opacity:.6; }
        .dc-avatar { width:56px; height:56px; border-radius:var(--r-full); border:3px solid var(--surface); background:var(--accent-light) center/cover no-repeat; display:flex; align-items:center; justify-content:center; font-size:22px; font-weight:800; color:var(--accent-hover); margin:-28px 0 0 18px; position:relative; }
        .dc-body { padding:10px 18px 18px; }
        .dc-name { font-weight:800; color:var(--text); font-size:16px; }
        .dc-handle { color:var(--text-muted); font-size:13px; font-weight:600; margin-top:1px; }
        .dc-bio { color:var(--text-secondary); font-size:13px; line-height:1.45; margin-top:8px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
        .dc-count { display:inline-block; margin-top:12px; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:var(--accent-hover); background:var(--accent-light); padding:3px 10px; border-radius:var(--r-full); }

        @media (max-width:520px) { .dc-h1 { font-size:24px; } .dc-grid { grid-template-columns:1fr; } }
      `}</style>
    </div>
  );
}
