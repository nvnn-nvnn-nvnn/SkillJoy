import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useUser } from '@/lib/stores';
import { getProfileByUsername } from '@/lib/profiles';
import { listPublishedSkills } from '@/lib/skills';
import { resolveTheme, listLinks } from '@/lib/storefront';
import { recordEvent } from '@/lib/metrics';
import { initials } from '@/lib/stores';
import { Pencil, Puzzle, Link2, ArrowUpRight, Sparkles, Search } from 'lucide-react';
import { BrandIcon } from '@/lib/brandIcons';
import SubscribeForm from '@/components/SubscribeForm';
import Seo from '@/components/Seo';
import { injectPixels } from '@/lib/pixels';

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
      <div style={{ color: 'var(--text-muted)', marginBottom: 12 }}><Search size={44} strokeWidth={1.5} /></div>
      <h1 className="sf-h1">@{username}</h1>
      <p className="sf-muted">We couldn’t find this storefront.</p>
      <StoreStyles />
    </div>
  );

  const { profile, skills, links } = state;
  const theme = resolveTheme(profile.storefront_theme);
  const isOwner = user && user.id === profile.id;
  const socials = (theme.socials || []).filter(s => s.url);

  // Full-page background layer. 'canvas' falls through to the mode palette's --bg.
  const bgStyle =
    theme.bg === 'solid'    ? { background: theme.bg_color } :
    theme.bg === 'gradient' ? { background: `linear-gradient(160deg, ${theme.bg_color}, ${theme.bg_color2})` } :
    (theme.bg === 'image' && theme.bg_image) ? { backgroundImage: `url(${theme.bg_image})`, backgroundSize: 'cover', backgroundPosition: 'center' } :
    undefined;
  const wrapClass = [
    'sf-wrap', `sf-mode-${theme.mode}`, `sf-btn-${theme.button_style}`,
    `sf-glow-${theme.product_glow || 'none'}`,
    theme.bg === 'image' && theme.bg_image ? 'sf-has-bgimg' : '',
    theme.mono_icons ? 'sf-mono' : '',
    theme.animated_name ? 'sf-anim-name' : '',
  ].filter(Boolean).join(' ');

  const wrapStyle = {
    '--accent': theme.accent,
    '--sf-panel-bg': `color-mix(in srgb, var(--surface) ${theme.card_opacity ?? 100}%, transparent)`,
    '--sf-panel-blur': `${theme.card_blur ?? 0}px`,
  };
  if (theme.text_color) {
    wrapStyle['--text'] = theme.text_color;
    wrapStyle['--text-secondary'] = `color-mix(in srgb, ${theme.text_color} 72%, transparent)`;
    wrapStyle['--text-muted'] = `color-mix(in srgb, ${theme.text_color} 50%, transparent)`;
  }
  if (theme.title_color) wrapStyle['--sf-title'] = theme.title_color;
  if (theme.cursor_url) wrapStyle.cursor = `url(${theme.cursor_url}), auto`;

  return (
    <div className={wrapClass} style={wrapStyle}>
      <div className="sf-bg" style={bgStyle} aria-hidden="true" />
      <Seo
        title={`${profile.full_name || '@' + profile.username} — SkillJoy`}
        description={profile.bio || `Shop ${profile.full_name || '@' + profile.username}'s Skills on SkillJoy.`}
        image={theme.banner_url || profile.avatar_url || undefined}
        url={typeof window !== 'undefined' ? window.location.href : undefined}
        type="profile"
      />

      {isOwner && (
        <Link to="/storefront/edit" className="sf-editbtn"><Pencil size={15} /> Edit storefront</Link>
      )}

      <div className={`sf-panel${theme.banner_url ? ' sf-panel-hasbanner' : ''}${theme.card_opacity === 0 ? ' sf-panel-ghost' : ''}`}>
      {theme.banner_url && <div className="sf-panelbanner" style={{ backgroundImage: `url(${theme.banner_url})` }} />}
      <header className="sf-head">
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
                <BrandIcon type={s.type} size={18} />
              </a>
            ))}
          </div>
        )}
      </header>
      </div>

      {skills.length === 0 && links.length === 0 ? (
        <p className="sf-muted sf-center">Nothing here yet — check back soon.</p>
      ) : (
        <div className={`sf-list${theme.layout === 'grid' ? ' sf-grid' : ''}`}>
          {skills.map(s => (
            <Link key={s.id} to={`/@${profile.username}/${s.id}`} className="sf-card">
              <div className="sf-cover" style={s.cover_url ? { backgroundImage: `url(${s.cover_url})` } : {}}>
                {!s.cover_url && <Puzzle size={28} strokeWidth={1.5} />}
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
              <span className="sf-linkbtn-label"><Link2 size={16} /> {l.label}</span>
              <ArrowUpRight size={18} className="sf-linkbtn-arrow" />
            </a>
          ))}
        </div>
      )}

      <SubscribeForm creatorId={profile.id} name={profile.full_name || `@${profile.username}`} />

      <footer className="sf-foot">
        <Link to="/"><Sparkles size={12} /> Built on SkillJoy</Link>
      </footer>
      <StoreStyles />
    </div>
  );
}

function StoreStyles() {
  return <style>{`
    .sf-wrap { max-width:540px; margin:0 auto; padding:0 18px 96px; position:relative; }
    .sf-center { text-align:center; padding-top:40px; }
    .sf-h1 { font-size:26px; font-weight:800; letter-spacing:-.02em; }
    .sf-muted { color:var(--text-muted); }

    /* ── Deeper theming: background layer, light/dark palette, button styles ── */
    .sf-bg { position:fixed; inset:0; z-index:-1; background:var(--bg); }
    .sf-mode-dark {
      --bg:#121316; --surface:#1b1c20; --surface-alt:#24262b;
      --text:#f2f0ea; --text-secondary:#b6b3ab; --text-muted:#85817a;
      --border:#2c2e34; --border-strong:#3a3d45;
    }
    /* Explicit dark canvas so it never falls back to the app's light bg. */
    .sf-mode-dark .sf-bg { background:#121316; }
    .sf-has-bgimg .sf-name, .sf-has-bgimg .sf-handle, .sf-has-bgimg .sf-bio { text-shadow:0 1px 14px rgba(0,0,0,.5); }
    .sf-btn-pill .sf-card, .sf-btn-pill .sf-cover { border-radius:var(--r-2xl); }
    .sf-btn-pill .sf-linkbtn, .sf-btn-pill .sf-social { border-radius:var(--r-full); }
    .sf-btn-sharp .sf-card, .sf-btn-sharp .sf-cover, .sf-btn-sharp .sf-linkbtn { border-radius:6px; }
    .sf-btn-sharp .sf-social { border-radius:8px; }

    /* Main glass panel — wraps the profile info so the background never bleeds
       into the text. Opacity + blur sliders drive --sf-panel-bg / --sf-panel-blur. */
    .sf-panel { position:relative; z-index:1; margin-top:28px; padding:32px 22px 26px; border-radius:var(--r-2xl); overflow:hidden;
      background:var(--sf-panel-bg, var(--surface));
      -webkit-backdrop-filter:blur(var(--sf-panel-blur, 0px)); backdrop-filter:blur(var(--sf-panel-blur, 0px));
      border:1px solid color-mix(in srgb, var(--border-strong) 55%, transparent);
      box-shadow:var(--shadow-xl), inset 0 1px 0 color-mix(in srgb, #fff 30%, transparent); }
    /* Banner lives inside the panel — negative margins pull it edge-to-edge, the
       panel's overflow:hidden rounds its top corners to match. */
    .sf-panelbanner { height:150px; margin:-32px -22px 16px; background:var(--surface-alt) center/cover no-repeat; position:relative; }
    .sf-panelbanner::after { content:''; position:absolute; inset:0; background:linear-gradient(180deg, transparent 50%, rgba(20,18,12,.28)); }
    .sf-panel-hasbanner .sf-avatar { margin-top:-58px; position:relative; z-index:1; }
    /* Opacity 0 → the panel becomes an invisible container (info floats on the bg). */
    .sf-panel-ghost { border-color:transparent; box-shadow:none; }

    /* Product glow — resting accent glow on cards/link buttons, stronger on hover. */
    .sf-glow-soft .sf-card, .sf-glow-soft .sf-linkbtn { box-shadow:0 0 22px color-mix(in srgb, var(--accent) 24%, transparent), var(--shadow-sm); }
    .sf-glow-strong .sf-card, .sf-glow-strong .sf-linkbtn { box-shadow:0 0 38px color-mix(in srgb, var(--accent) 48%, transparent), var(--shadow); }
    .sf-glow-soft .sf-card:hover, .sf-glow-strong .sf-card:hover, .sf-glow-soft .sf-linkbtn:hover, .sf-glow-strong .sf-linkbtn:hover { box-shadow:0 0 46px color-mix(in srgb, var(--accent) 60%, transparent), 0 12px 26px color-mix(in srgb, var(--accent) 20%, transparent); }

    .sf-mono .sf-social svg { filter:grayscale(1); opacity:.82; }
    .sf-anim-name .sf-name { animation:sfNameGlow 2.6s ease-in-out infinite; }
    @keyframes sfNameGlow { 0%,100% { text-shadow:0 0 0 transparent; } 50% { text-shadow:0 0 18px color-mix(in srgb, var(--accent) 65%, transparent); } }
    @media (prefers-reduced-motion: reduce) { .sf-anim-name .sf-name { animation:none; } }

    /* Owner edit button — floats over everything. */
    .sf-editbtn { position:fixed; top:16px; right:16px; z-index:20; display:inline-flex; align-items:center; gap:6px; background:var(--surface); border:1px solid var(--border-strong); color:var(--text); text-decoration:none; font-size:13px; font-weight:700; padding:9px 15px; border-radius:var(--r-full); box-shadow:var(--shadow); transition:transform .14s ease, box-shadow .14s ease; }
    .sf-editbtn:hover { transform:translateY(-1px); box-shadow:var(--shadow-lg); }

    /* Header / hero — sits inside the glass panel */
    .sf-head { text-align:center; margin:0 0 22px; }
    .sf-avatar { width:100px; height:100px; border-radius:50%; margin:0 auto 14px; background:color-mix(in srgb, var(--accent) 14%, white) center/cover no-repeat; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:34px; color:var(--accent); border:4px solid var(--surface); box-shadow:var(--shadow-lg); }
    .sf-name { font-size:27px; font-weight:800; font-family:var(--font-display); letter-spacing:-.02em; line-height:1.15; color:var(--sf-title, inherit); }
    .sf-handle { color:var(--accent); font-size:14px; font-weight:600; margin-top:3px; }
    .sf-bio { color:var(--text-secondary); font-size:15px; margin:12px auto 0; line-height:1.55; max-width:42ch; }
    .sf-socials { display:flex; gap:10px; justify-content:center; margin-top:18px; }
    .sf-social { width:42px; height:42px; border-radius:50%; background:var(--surface); border:1px solid var(--border); display:flex; align-items:center; justify-content:center; font-size:18px; text-decoration:none; box-shadow:var(--shadow-sm); transition:transform .14s ease, border-color .14s ease, box-shadow .14s ease; }
    .sf-social:hover { transform:translateY(-2px); border-color:var(--accent); box-shadow:var(--shadow); }

    /* Product cards + link buttons — a separate section below the profile panel */
    .sf-list { display:flex; flex-direction:column; gap:14px; margin-top:18px; }
    .sf-grid { display:grid; grid-template-columns:repeat(2, 1fr); gap:12px; }
    .sf-card { display:flex; gap:14px; align-items:center; padding:12px; border:1px solid var(--border); border-radius:var(--r-lg); background:var(--surface); text-decoration:none; box-shadow:var(--shadow-sm); transition:transform .16s cubic-bezier(.34,1.4,.64,1), box-shadow .16s ease, border-color .16s ease; }
    .sf-card:hover { transform:translateY(-3px); border-color:color-mix(in srgb, var(--accent) 45%, var(--border)); box-shadow:0 12px 26px color-mix(in srgb, var(--accent) 16%, transparent), var(--shadow); }
    .sf-grid .sf-card { flex-direction:column; align-items:stretch; gap:10px; padding:10px; }
    .sf-cover { width:88px; height:88px; flex-shrink:0; border-radius:var(--r); background:var(--surface-alt) center/cover no-repeat; display:flex; align-items:center; justify-content:center; font-size:30px; }
    .sf-grid .sf-cover { width:100%; height:auto; aspect-ratio:16/10; }
    .sf-card-body { flex:1; min-width:0; }
    .sf-card-title { font-weight:700; color:var(--text); font-size:15.5px; }
    .sf-card-outcome { font-size:13px; color:var(--text-secondary); margin-top:3px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
    .sf-card-foot { display:flex; align-items:center; gap:8px; margin-top:10px; }
    .sf-price { font-weight:800; color:var(--text); font-size:15px; }
    .sf-tag { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:var(--accent); background:color-mix(in srgb, var(--accent) 12%, white); padding:3px 9px; border-radius:var(--r-full); }

    .sf-linkbtn { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:16px 18px; border:1px solid var(--border); border-radius:var(--r-lg); background:var(--surface); text-decoration:none; color:var(--text); font-weight:700; box-shadow:var(--shadow-sm); transition:transform .16s cubic-bezier(.34,1.4,.64,1), box-shadow .16s ease, border-color .16s ease; }
    .sf-linkbtn:hover { transform:translateY(-3px); border-color:var(--accent); box-shadow:0 12px 26px color-mix(in srgb, var(--accent) 16%, transparent); }
    .sf-grid .sf-linkbtn { justify-content:center; gap:6px; }
    .sf-linkbtn-label { display:inline-flex; align-items:center; gap:9px; }
    .sf-linkbtn-arrow { color:var(--accent); flex-shrink:0; }

    /* Brand footer */
    .sf-foot { text-align:center; margin-top:36px; }
    .sf-foot a { display:inline-flex; align-items:center; gap:5px; font-size:12px; font-weight:700; color:var(--text-muted); text-decoration:none; letter-spacing:.02em; transition:color .14s ease; }
    .sf-foot a:hover { color:var(--accent); }
  `}</style>;
}
