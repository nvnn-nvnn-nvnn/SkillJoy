import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useUser } from '@/lib/stores';
import { getPublicSkill } from '@/lib/skills';
import { getProfileByUsername } from '@/lib/profiles';
import { hasPurchased } from '@/lib/purchases';
import { recordEvent } from '@/lib/analytics';
import { BLOCK_META } from '@/lib/blockTypes';
import Seo from '@/components/Seo';
import { injectPixels } from '@/lib/pixels';

// Phase 3 — public sales/landing page for one Skill at /@username/:skillId.
// Shows meta + a "what's inside" outline (titles/types only — gated content
// stays hidden). Buy routes to checkout (or login first).
export default function SkillPublic() {
  const { handle = '', skillId } = useParams();
  const username = handle.replace(/^@/, '');
  const user = useUser();
  const navigate = useNavigate();
  const [skill, setSkill] = useState(null);
  const [creator, setCreator] = useState(null);
  const [owned, setOwned] = useState(false);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [s, c] = await Promise.all([getPublicSkill(skillId), getProfileByUsername(username)]);
        if (!alive) return;
        if (!s) { setStatus('notfound'); return; }
        setSkill(s); setCreator(c); setStatus('ready');
        recordEvent('skill_view', { skillId: s.id, creatorId: s.creator_id });
        injectPixels(c?.tracking_pixels);
        if (user) hasPurchased(user.id, skillId).then(p => alive && setOwned(!!p)).catch(() => {});
      } catch { if (alive) setStatus('notfound'); }
    })();
    return () => { alive = false; };
  }, [skillId, username, user]);

  function onBuy() {
    if (!user) { navigate(`/login?redirect=${encodeURIComponent(`/checkout/${skillId}`)}`); return; }
    navigate(`/checkout/${skillId}`);
  }

  if (status === 'loading') return <div className="sp-wrap"><p className="sp-muted">Loading…</p></div>;
  if (status === 'notfound') return (
    <div className="sp-wrap sp-center"><p style={{ fontSize: 40 }}>🤔</p><p className="sp-muted">This Skill isn’t available.</p><SkillStyles /></div>
  );

  const isOwn = user && user.id === skill.creator_id;
  const price = skill.price_cents ? `$${(skill.price_cents / 100).toFixed(2)}` : 'Free';

  return (
    <div className="sp-wrap">
      <Seo
        title={`${skill.title} — SkillJoy`}
        description={skill.outcome || `Get "${skill.title}" on SkillJoy.`}
        image={skill.cover_url || undefined}
        url={typeof window !== 'undefined' ? window.location.href : undefined}
        type="product"
      />

      {creator && <Link to={`/@${creator.username}`} className="sp-back">← {creator.full_name || `@${creator.username}`}</Link>}

      <div className="sp-cover" style={skill.cover_url ? { backgroundImage: `url(${skill.cover_url})` } : {}}>
        {!skill.cover_url && <span>🧩</span>}
      </div>

      <h1 className="sp-title">{skill.title}</h1>
      {skill.outcome && <p className="sp-outcome">{skill.outcome}</p>}

      <div className="sp-outline">
        <p className="sp-outline-h">What’s inside</p>
        {skill.outline.length === 0 && <p className="sp-muted">Content coming soon.</p>}
        {skill.outline.map(b => (
          <div key={b.id} className="sp-outline-row">
            <span className="sp-outline-icon">{BLOCK_META[b.type]?.icon ?? '•'}</span>
            <span className="sp-outline-title">{b.title || BLOCK_META[b.type]?.label || b.type}</span>
            <span className="sp-outline-type">{BLOCK_META[b.type]?.label}</span>
          </div>
        ))}
      </div>

      {/* Sticky buy bar */}
      <div className="sp-buybar">
        <div className="sp-buybar-inner">
          <div>
            <span className="sp-price">{price}</span>
            {skill.pricing_type === 'membership' && <span className="sp-tag">/ membership</span>}
          </div>
          {isOwn ? (
            <Link to={`/build/${skill.id}`} className="btn btn-secondary">Edit your Skill</Link>
          ) : owned ? (
            <Link to={`/locker/${skill.id}`} className="btn btn-primary">Open in Locker</Link>
          ) : (
            <button className="btn btn-primary" onClick={onBuy}>{skill.price_cents ? 'Get access' : 'Get it free'}</button>
          )}
        </div>
      </div>

      <SkillStyles />
    </div>
  );
}

function SkillStyles() {
  return <style>{`
    .sp-wrap { max-width:560px; margin:0 auto; padding:20px 16px 120px; }
    .sp-center { text-align:center; }
    .sp-muted { color:var(--text-muted); }
    .sp-back { display:inline-block; color:var(--text-secondary); text-decoration:none; font-weight:600; font-size:14px; margin-bottom:14px; }
    .sp-back:hover { color:var(--accent); }
    .sp-cover { aspect-ratio:16/9; border-radius:var(--r-lg); background:var(--surface-alt) center/cover no-repeat; display:flex; align-items:center; justify-content:center; font-size:44px; margin-bottom:18px; }
    .sp-title { font-size:28px; font-weight:700; font-family:var(--font-display); line-height:1.15; }
    .sp-outcome { font-size:16px; color:var(--text-secondary); margin-top:8px; line-height:1.5; }

    .sp-outline { margin-top:26px; border:1px solid var(--border); border-radius:var(--r-lg); padding:8px 14px; background:var(--surface); }
    .sp-outline-h { font-weight:700; font-size:13px; text-transform:uppercase; letter-spacing:.05em; color:var(--text-muted); padding:10px 0 6px; }
    .sp-outline-row { display:flex; align-items:center; gap:12px; padding:11px 0; border-top:1px solid var(--border); }
    .sp-outline-icon { font-size:20px; }
    .sp-outline-title { flex:1; font-weight:600; color:var(--text); }
    .sp-outline-type { font-size:12px; color:var(--text-muted); }

    .sp-buybar { position:fixed; left:0; right:0; bottom:0; background:var(--surface); border-top:1px solid var(--border); box-shadow:0 -4px 16px rgba(30,18,9,.06); padding:12px 16px; z-index:30; }
    .sp-buybar-inner { max-width:560px; margin:0 auto; display:flex; align-items:center; justify-content:space-between; gap:16px; }
    .sp-price { font-size:22px; font-weight:800; color:var(--text); }
    .sp-tag { color:var(--text-muted); font-size:13px; margin-left:4px; }
  `}</style>;
}
