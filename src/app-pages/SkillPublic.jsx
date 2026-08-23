import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useUser } from '@/lib/stores';
import { getPublicSkill } from '@/lib/skills';
import { getProfileByUsername } from '@/lib/profiles';
import { hasPurchased } from '@/lib/purchases';
import { listReviews, summarize } from '@/lib/reviews';
import { recordEvent } from '@/lib/metrics';
import { BLOCK_META } from '@/lib/blockTypes';
import { toEmbed } from '@/lib/embed';
import Seo from '@/components/Seo';
import BackLink from '@/components/BackLink';
import Markdown from '@/components/Markdown';
import ReportModal from '@/components/ReportModal';
import { Flag } from 'lucide-react';
import { injectPixels } from '@/lib/pixels';

// Star row — filled to `value` (rounded), out of 5.
function Stars({ value }) {
  const n = Math.round(value);
  return <span className="sp-stars">{'★★★★★'.slice(0, n)}<span className="sp-stars-off">{'★★★★★'.slice(n)}</span></span>;
}

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
  const [reviews, setReviews] = useState([]);
  const [status, setStatus] = useState('loading');
  const [reportOpen, setReportOpen] = useState(false);

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
        if (s.reviews_enabled !== false) listReviews(skillId).then(r => alive && setReviews(r)).catch(() => {});
      } catch { if (alive) setStatus('notfound'); }
    })();
    return () => { alive = false; };
  }, [skillId, username, user]);

  function onBuy() {
    // Delegate the auth decision to Checkout: guests can buy one-time paid products
    // (guest checkout); Checkout redirects to login only for free/membership.
    navigate(`/checkout/${skillId}`);
  }

  if (status === 'loading') return <div className="sp-wrap"><p className="sp-muted">Loading…</p></div>;
  if (status === 'notfound') return (
    <div className="sp-wrap sp-center"><p style={{ fontSize: 40 }}>🤔</p><p className="sp-muted">This Skill isn’t available.</p><SkillStyles /></div>
  );

  const isOwn = user && user.id === skill.creator_id;
  const price = skill.price_cents ? `$${(skill.price_cents / 100).toFixed(2)}` : 'Free';
  const rev = summarize(reviews);
  const promoEmbed = toEmbed(skill.promo_video_url);

  return (
    <div className="sp-wrap">
      <Seo
        title={`${skill.title} — SkillJoy`}
        description={skill.outcome || `Get "${skill.title}" on SkillJoy.`}
        image={skill.cover_url || undefined}
        url={typeof window !== 'undefined' ? window.location.href : undefined}
        type="product"
      />

      {creator && <BackLink to={`/@${creator.username}`}>{creator.full_name || `@${creator.username}`}</BackLink>}

      <div className="sp-cover" style={skill.cover_url ? { backgroundImage: `url(${skill.cover_url})` } : {}}>
        {!skill.cover_url && <span>🧩</span>}
      </div>

      <h1 className="sp-title">{skill.title}</h1>
      {skill.outcome && <p className="sp-outcome">{skill.outcome}</p>}
      {skill.description && <Markdown className="sp-desc">{skill.description}</Markdown>}

      {rev.count > 0 && (
        <div className="sp-ratingline">
          <Stars value={rev.average} />
          <span className="sp-ratingnum">{rev.average.toFixed(1)}</span>
          <span className="sp-ratingcount">({rev.count} review{rev.count === 1 ? '' : 's'})</span>
        </div>
      )}

      {promoEmbed && (
        <div className="sp-promo">
          <iframe src={promoEmbed} title="Promo video" allow="encrypted-media; picture-in-picture" allowFullScreen />
        </div>
      )}

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

      {rev.count > 0 && (
        <div className="sp-reviews">
          <p className="sp-outline-h">Reviews</p>
          {reviews.slice(0, 6).map(r => (
            <div key={r.id} className="sp-review">
              <div className="sp-review-top">
                <span className="sp-review-name">{r.buyer?.full_name || 'Verified buyer'}</span>
                <Stars value={r.rating} />
              </div>
              {r.body && <p className="sp-review-body">{r.body}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Report — hidden for the product's own creator */}
      {!isOwn && (
        <p className="sp-reportline">
          <button type="button" className="sp-reportbtn" onClick={() => setReportOpen(true)}>
            <Flag size={12} /> Report this product
          </button>
        </p>
      )}
      <ReportModal
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
        reportedType="skill"
        reportedId={skill.id}
        reportedName={skill.title}
      />

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
            <button className="btn btn-primary" onClick={onBuy}>{skill.price_cents ? 'Get access' : 'Get Free Access'}</button>
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
    .sp-cover { aspect-ratio:16/9; border-radius:var(--r-lg); background:var(--surface-alt) center/cover no-repeat; display:flex; align-items:center; justify-content:center; font-size:44px; margin-bottom:18px; }
    .sp-title { font-size:28px; font-weight:700; font-family:var(--font-display); line-height:1.15; }
    .sp-outcome { font-size:16px; color:var(--text-secondary); margin-top:8px; line-height:1.5; }
    .sp-desc { font-size:15px; color:var(--text-secondary); margin-top:14px; line-height:1.6; }
    .sp-reportline { margin:26px 0 0; text-align:center; }
    .sp-reportbtn { display:inline-flex; align-items:center; gap:5px; min-width:0; width:auto; padding:4px 8px; border:none; background:none; font-size:12px; font-weight:600; color:var(--text-muted); cursor:pointer; }
    .sp-reportbtn:hover { color:var(--danger); }

    .sp-stars { color:var(--accent); letter-spacing:1px; font-size:15px; }
    .sp-stars-off { color:var(--border-strong); }
    .sp-ratingline { display:flex; align-items:center; gap:8px; margin-top:12px; }
    .sp-ratingnum { font-weight:800; color:var(--text); font-size:14px; }
    .sp-ratingcount { color:var(--text-muted); font-size:13px; }

    .sp-promo { aspect-ratio:16/9; border-radius:var(--r-lg); overflow:hidden; background:#000; margin-top:18px; }
    .sp-promo iframe { width:100%; height:100%; border:0; display:block; }

    .sp-reviews { margin-top:26px; }
    .sp-review { padding:14px 0; border-top:1px solid var(--border); }
    .sp-review-top { display:flex; align-items:center; justify-content:space-between; gap:10px; }
    .sp-review-name { font-weight:700; color:var(--text); font-size:14px; }
    .sp-review-body { margin-top:6px; color:var(--text-secondary); font-size:14px; line-height:1.55; }

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
