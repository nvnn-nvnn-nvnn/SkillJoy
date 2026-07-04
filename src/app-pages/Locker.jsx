import { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useUser } from '@/lib/stores';
import { listMyPurchases, hasPurchased } from '@/lib/purchases';
import { getSkillWithBlocks } from '@/lib/skills';
import { getMyReview, upsertReview, deleteReview } from '@/lib/reviews';
import BlockRenderer from '@/components/BlockRenderer';
import CoursePlayer from '@/components/CoursePlayer';
import CommunityThread from '@/components/CommunityThread';
import BackLink from '@/components/BackLink';

// Phase 3 — buyer's permanent locker (/locker) + consumption view (/locker/:id).
export default function Locker() {
  const { skillId } = useParams();
  const user = useUser();
  if (!user) return <div className="lk-wrap"><p className="lk-muted">Please log in to view your Locker.</p><LockerStyles /></div>;
  return skillId
    ? <SkillConsume key={skillId} skillId={skillId} user={user} />
    : <LockerList userId={user.id} />;
}

// ── Locker list ───────────────────────────────────────────────────────────────
function LockerList({ userId }) {
  const [items, setItems] = useState(null);
  useEffect(() => { listMyPurchases(userId).then(setItems).catch(() => setItems([])); }, [userId]);

  return (
    <div className="lk-wrap">
      <h1 className="lk-h1">Your Locker</h1>
      <p className="lk-sub">Everything you’ve bought — yours forever, always the latest version.</p>

      {items === null && <p className="lk-muted">Loading…</p>}
      {items?.length === 0 && (
        <div className="lk-empty">
          <p style={{ fontSize: 40 }}>📦</p>
          <p className="lk-empty-t">Nothing here yet</p>
          <p className="lk-muted">Skills you purchase will appear here.</p>
        </div>
      )}

      <div className="lk-list">
        {items?.map(p => (
          <Link key={p.id} to={`/locker/${p.skill_id}`} className="lk-card">
            <div className="lk-cover" style={p.skill?.cover_url ? { backgroundImage: `url(${p.skill.cover_url})` } : {}}>
              {!p.skill?.cover_url && <span>🧩</span>}
            </div>
            <div className="lk-card-body">
              <p className="lk-card-title">{p.skill?.title || 'Skill'}</p>
              {p.skill?.outcome && <p className="lk-card-outcome">{p.skill.outcome}</p>}
              {p.skill && p.skill.version > p.version_at_purchase && (
                <span className="lk-updated">Updated to v{p.skill.version}</span>
              )}
            </div>
          </Link>
        ))}
      </div>
      <LockerStyles />
    </div>
  );
}

// ── Consumption view ──────────────────────────────────────────────────────────
function SkillConsume({ skillId, user }) {
  const [searchParams] = useSearchParams();
  const justSubscribed = searchParams.get('sub') === 'success';
  const [skill, setSkill] = useState(null);
  const [purchase, setPurchase] = useState(undefined); // undefined = checking
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // After a subscription checkout the webhook may take a beat to grant
        // access — retry a few times before showing "locked".
        let p = await hasPurchased(user.id, skillId);
        if (justSubscribed && !p) {
          for (let i = 0; i < 5 && !p; i++) {
            await new Promise(r => setTimeout(r, 1500));
            if (!alive) return;
            p = await hasPurchased(user.id, skillId);
          }
        }
        if (!alive) return;
        setPurchase(p);
        const s = await getSkillWithBlocks(skillId);
        if (!alive) return;
        // Allow the creator to preview their own Skill even without a purchase.
        if (!p && s.creator_id !== user.id) { setStatus('locked'); return; }
        setSkill(s); setStatus('ready');
      } catch { if (alive) setStatus('locked'); }
    })();
    return () => { alive = false; };
  }, [skillId, user.id, justSubscribed]);

  if (status === 'loading') return <div className="lk-wrap"><p className="lk-muted">Loading…</p><LockerStyles /></div>;
  if (status === 'locked') return (
    <div className="lk-wrap lk-center">
      <p style={{ fontSize: 40 }}>🔒</p>
      <p className="lk-muted">You don’t have access to this Skill.</p>
      <BackLink to="/locker">Back to Locker</BackLink>
      <LockerStyles />
    </div>
  );

  const isCreatorPreview = !purchase && skill.creator_id === user.id;
  const updated = purchase && skill.version > purchase.version_at_purchase;

  return (
    <div className="lk-wrap">
      <title>{`${skill.title} — SkillJoy`}</title>
      <BackLink to="/locker">Locker</BackLink>

      {isCreatorPreview && <div className="lk-banner">👀 Creator preview — this is how buyers see your Skill.</div>}
      {updated && <div className="lk-banner lk-update">✨ Updated to v{skill.version} since you bought it.</div>}

      <div className="lk-cover lk-cover-lg" style={skill.cover_url ? { backgroundImage: `url(${skill.cover_url})` } : {}}>
        {!skill.cover_url && <span>🧩</span>}
      </div>
      <h1 className="lk-h1">{skill.title}</h1>
      {skill.outcome && <p className="lk-sub">{skill.outcome}</p>}

      <div className="lk-blocks">
        {skill.kind === 'course' ? (
          <CoursePlayer skill={skill} user={user} />
        ) : (
          <>
            {skill.blocks?.length === 0 && <p className="lk-muted">No content yet.</p>}
            {skill.blocks?.map(b => (
              <BlockRenderer key={b.id} block={b} skillId={skill.id} creatorId={skill.creator_id} buyerId={user.id} />
            ))}
          </>
        )}
      </div>

      {purchase && skill.reviews_enabled !== false && (
        <ReviewBox skillId={skill.id} userId={user.id} />
      )}

      <div className="lk-community">
        <CommunityThread skillId={skill.id} creatorId={skill.creator_id} user={user} />
      </div>

      <LockerStyles />
    </div>
  );
}

// ── Post-purchase review box ──────────────────────────────────────────────────
function ReviewBox({ skillId, userId }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [body, setBody] = useState('');
  const [saved, setSaved] = useState(false);
  const [existing, setExisting] = useState(null); // null = loading, false = none
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getMyReview(skillId, userId)
      .then(r => { setExisting(r || false); if (r) { setRating(r.rating); setBody(r.body || ''); } })
      .catch(() => setExisting(false));
  }, [skillId, userId]);

  async function save() {
    if (!rating) return;
    setBusy(true);
    try {
      const r = await upsertReview(skillId, userId, { rating, body });
      setExisting(r); setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch { /* RLS or network — silently ignore for v1 */ }
    finally { setBusy(false); }
  }

  async function remove() {
    if (!existing?.id) return;
    setBusy(true);
    try { await deleteReview(existing.id); setExisting(false); setRating(0); setBody(''); }
    catch { /* ignore */ }
    finally { setBusy(false); }
  }

  if (existing === null) return null; // still loading

  return (
    <div className="lk-review">
      <p className="lk-review-h">{existing ? 'Your review' : 'Leave a review'}</p>
      <div className="lk-stars" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} type="button" className={`lk-star${(hover || rating) >= n ? ' on' : ''}`}
            onMouseEnter={() => setHover(n)} onClick={() => setRating(n)} aria-label={`${n} star${n === 1 ? '' : 's'}`}>★</button>
        ))}
      </div>
      <textarea className="lk-review-body" rows={3} value={body} onChange={e => setBody(e.target.value)}
        placeholder="Share what you thought (optional)…" />
      <div className="lk-review-actions">
        <button className="btn btn-primary btn-sm" onClick={save} disabled={!rating || busy}>
          {saved ? 'Saved ✓' : existing ? 'Update review' : 'Post review'}
        </button>
        {existing && <button className="btn btn-ghost btn-sm" onClick={remove} disabled={busy}>Delete</button>}
      </div>
    </div>
  );
}

function LockerStyles() {
  return <style>{`
    .lk-wrap { max-width:600px; margin:0 auto; padding:24px 16px 80px; }
    .lk-center { text-align:center; }
    .lk-h1 { font-size:26px; font-weight:700; font-family:var(--font-display); }
    .lk-sub { color:var(--text-secondary); margin-top:4px; }
    .lk-muted { color:var(--text-muted); }

    .lk-empty { text-align:center; padding:48px 0; }
    .lk-empty-t { font-weight:700; font-size:18px; margin-top:8px; }

    .lk-list { display:flex; flex-direction:column; gap:14px; margin-top:20px; }
    .lk-card { display:flex; gap:14px; align-items:center; padding:12px; border:1px solid var(--border); border-radius:var(--r-lg); background:var(--surface); text-decoration:none; box-shadow:var(--shadow-sm); transition:transform .12s ease, box-shadow .12s ease; }
    .lk-card:hover { transform:translateY(-2px); box-shadow:var(--shadow); }
    .lk-cover { width:80px; height:80px; flex-shrink:0; border-radius:var(--r); background:var(--surface-alt) center/cover no-repeat; display:flex; align-items:center; justify-content:center; font-size:30px; }
    .lk-cover-lg { width:100%; height:auto; aspect-ratio:16/9; margin:8px 0 16px; border-radius:var(--r-lg); font-size:44px; }
    .lk-card-body { flex:1; min-width:0; }
    .lk-card-title { font-weight:700; color:var(--text); }
    .lk-card-outcome { font-size:13px; color:var(--text-secondary); margin-top:2px; }
    .lk-updated { display:inline-block; margin-top:8px; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:var(--accent); background:var(--accent-light); padding:3px 9px; border-radius:var(--r-full); }

    .lk-banner { background:var(--surface-alt); border:1px solid var(--border); border-radius:var(--r); padding:10px 14px; font-size:14px; margin-bottom:14px; }
    .lk-update { background:var(--accent-light); border-color:var(--accent-mid); color:var(--accent); font-weight:600; }

    .lk-blocks { margin-top:22px; }

    .lk-review { margin-top:28px; padding-top:24px; border-top:1px solid var(--border); }
    .lk-review-h { font-weight:700; font-size:15px; margin-bottom:10px; }
    .lk-stars { display:flex; gap:2px; margin-bottom:10px; }
    .lk-star { border:none; background:none; padding:0 2px; font-size:26px; line-height:1; cursor:pointer; color:var(--border-strong); transition:color .1s ease; }
    .lk-star.on { color:var(--accent); }
    .lk-review-body { width:100%; resize:vertical; font-family:inherit; }
    .lk-review-actions { display:flex; gap:8px; margin-top:10px; }

    .lk-community { margin-top:28px; padding-top:24px; border-top:1px solid var(--border); }
  `}</style>;
}
