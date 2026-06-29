import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useUser } from '@/lib/stores';
import { getProfileByUsername } from '@/lib/profiles';
import { listPublishedSkills } from '@/lib/skills';
import { resolveTheme, listLinks, SOCIAL_TYPES } from '@/lib/storefront';
import { recordEvent } from '@/lib/analytics';
import { initials } from '@/lib/stores';
import SubscribeForm from '@/components/SubscribeForm';
import Seo from '@/components/Seo';
import { injectPixels } from '@/lib/pixels';

const SOCIAL_ICON = Object.fromEntries(SOCIAL_TYPES.map(s => [s.type, s.icon]));

// Phase 3/7 — public, mobile-first link-in-bio storefront at /@username, themed.
export default function Storefront() {
  const { handle = '' } = useParams();
  const username = handle.replace(/^@/, '');
  const user = useUser();
  const [state, setState] = useState({ status: 'loading', profile: null, skills: [], links: [] });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const profile = await getProfileByUsername(username);
        if (!alive) return;
        if (!profile) { setState({ status: 'notfound' }); return; }
        const [skills, links] = await Promise.all([
          listPublishedSkills(profile.id),
          listLinks(profile.id).catch(() => []),
        ]);
        if (!alive) return;
        setState({ status: 'ready', profile, skills, links });
        recordEvent('storefront_view', { creatorId: profile.id });
        injectPixels(profile.tracking_pixels);
      } catch {
        if (alive) setState({ status: 'notfound' });
      }
    })();
    return () => { alive = false; };
  }, [username]);

  if (state.status === 'loading') return <div className="sf-wrap"><p className="sf-muted">Loading…</p></div>;
  if (state.status === 'notfound') return (
    <div className="sf-wrap sf-center">
      <p style={{ fontSize: 40 }}>🤔</p>
      <h1 className="sf-h1">@{username}</h1>
      <p className="sf-muted">We couldn’t find this storefront.</p>
      <StoreStyles />
    </div>
  );

  const { profile, skills, links } = state;
  const theme = resolveTheme(profile.storefront_theme);
  const isOwner = user && user.id === profile.id;
  const socials = (theme.socials || []).filter(s => s.url);

  return (
    <div className="sf-wrap" style={{ '--accent': theme.accent }}>
      <Seo
        title={`${profile.full_name || '@' + profile.username} — SkillJoy`}
        description={profile.bio || `Shop ${profile.full_name || '@' + profile.username}'s Skills on SkillJoy.`}
        image={theme.banner_url || profile.avatar_url || undefined}
        url={typeof window !== 'undefined' ? window.location.href : undefined}
        type="profile"
      />

      {isOwner && (
        <Link to="/storefront/edit" className="sf-editbtn">✎ Edit storefront</Link>
      )}

      {theme.banner_url && <div className="sf-banner" style={{ backgroundImage: `url(${theme.banner_url})` }} />}

      <header className={`sf-head${theme.banner_url ? ' sf-head-overlap' : ''}`}>
        <div className="sf-avatar" style={profile.avatar_url ? { backgroundImage: `url(${profile.avatar_url})` } : {}}>
          {!profile.avatar_url && initials(profile.full_name)}
        </div>
        <h1 className="sf-name">{profile.full_name || `@${profile.username}`}</h1>
        <p className="sf-handle">@{profile.username}</p>
        {profile.bio && <p className="sf-bio">{profile.bio}</p>}
        {socials.length > 0 && (
          <div className="sf-socials">
            {socials.map((s, i) => (
              <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="sf-social" title={s.type}>
                {SOCIAL_ICON[s.type] || '🔗'}
              </a>
            ))}
          </div>
        )}
      </header>

      {skills.length === 0 && links.length === 0 ? (
        <p className="sf-muted sf-center">Nothing here yet — check back soon.</p>
      ) : (
        <div className={`sf-list${theme.layout === 'grid' ? ' sf-grid' : ''}`}>
          {skills.map(s => (
            <Link key={s.id} to={`/@${profile.username}/${s.id}`} className="sf-card">
              <div className="sf-cover" style={s.cover_url ? { backgroundImage: `url(${s.cover_url})` } : {}}>
                {!s.cover_url && <span>🧩</span>}
              </div>
              <div className="sf-card-body">
                <p className="sf-card-title">{s.title}</p>
                {s.outcome && <p className="sf-card-outcome">{s.outcome}</p>}
                <div className="sf-card-foot">
                  <span className="sf-price">{s.price_cents ? `$${(s.price_cents / 100).toFixed(2)}` : 'Free'}</span>
                  {s.pricing_type === 'membership' && <span className="sf-tag">Membership</span>}
                </div>
              </div>
            </Link>
          ))}

          {/* External / affiliate link buttons */}
          {links.filter(l => l.url).map(l => (
            <a key={l.id} href={l.url} target="_blank" rel={l.is_affiliate ? 'noopener noreferrer sponsored' : 'noopener noreferrer'} className="sf-linkbtn">
              <span className="sf-linkbtn-label">🔗 {l.label}</span>
              <span className="sf-linkbtn-arrow">↗</span>
            </a>
          ))}
        </div>
      )}

      <SubscribeForm creatorId={profile.id} name={profile.full_name || `@${profile.username}`} />
      <StoreStyles />
    </div>
  );
}

function StoreStyles() {
  return <style>{`
    .sf-wrap { max-width:520px; margin:0 auto; padding:0 16px 80px; position:relative; }
    .sf-center { text-align:center; padding-top:32px; }
    .sf-h1 { font-size:24px; font-weight:700; }
    .sf-muted { color:var(--text-muted); }

    .sf-editbtn { position:absolute; top:16px; right:16px; z-index:5; background:var(--surface); border:1px solid var(--border-strong); color:var(--text); text-decoration:none; font-size:13px; font-weight:600; padding:6px 12px; border-radius:var(--r-full); box-shadow:var(--shadow-sm); }

    .sf-banner { height:150px; margin:0 -16px; background:var(--surface-alt) center/cover no-repeat; }

    .sf-head { text-align:center; margin:32px 0 28px; }
    .sf-head-overlap { margin-top:-44px; }
    .sf-avatar { width:84px; height:84px; border-radius:50%; margin:0 auto 12px; background:var(--accent-light) center/cover no-repeat; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:28px; color:var(--accent); border:3px solid var(--surface); }
    .sf-name { font-size:24px; font-weight:700; font-family:var(--font-display); }
    .sf-handle { color:var(--text-muted); font-size:14px; margin-top:2px; }
    .sf-bio { color:var(--text-secondary); font-size:15px; margin-top:10px; line-height:1.5; }
    .sf-socials { display:flex; gap:10px; justify-content:center; margin-top:14px; }
    .sf-social { width:38px; height:38px; border-radius:50%; background:var(--surface-alt); border:1px solid var(--border); display:flex; align-items:center; justify-content:center; font-size:18px; text-decoration:none; }
    .sf-social:hover { border-color:var(--accent); }

    .sf-list { display:flex; flex-direction:column; gap:14px; }
    .sf-grid { display:grid; grid-template-columns:repeat(2, 1fr); gap:12px; }
    .sf-card { display:flex; gap:14px; align-items:center; padding:12px; border:1px solid var(--border); border-radius:var(--r-lg); background:var(--surface); text-decoration:none; box-shadow:var(--shadow-sm); transition:transform .12s ease, box-shadow .12s ease; }
    .sf-card:hover { transform:translateY(-2px); box-shadow:var(--shadow); }
    .sf-grid .sf-card { flex-direction:column; align-items:stretch; gap:10px; }
    .sf-cover { width:84px; height:84px; flex-shrink:0; border-radius:var(--r); background:var(--surface-alt) center/cover no-repeat; display:flex; align-items:center; justify-content:center; font-size:30px; }
    .sf-grid .sf-cover { width:100%; height:auto; aspect-ratio:16/10; }
    .sf-card-body { flex:1; min-width:0; }
    .sf-card-title { font-weight:700; color:var(--text); }
    .sf-card-outcome { font-size:13px; color:var(--text-secondary); margin-top:2px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
    .sf-card-foot { display:flex; align-items:center; gap:8px; margin-top:8px; }
    .sf-price { font-weight:700; color:var(--text); }
    .sf-tag { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:var(--accent); background:var(--accent-light); padding:2px 8px; border-radius:var(--r-full); }

    .sf-linkbtn { display:flex; align-items:center; justify-content:space-between; padding:16px; border:1px solid var(--border); border-radius:var(--r-lg); background:var(--surface); text-decoration:none; color:var(--text); font-weight:600; box-shadow:var(--shadow-sm); transition:transform .12s ease; }
    .sf-linkbtn:hover { transform:translateY(-2px); border-color:var(--accent); }
    .sf-grid .sf-linkbtn { justify-content:center; gap:6px; }
    .sf-linkbtn-arrow { color:var(--text-muted); }
  `}</style>;
}
