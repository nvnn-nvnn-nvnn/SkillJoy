import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useUser } from '@/lib/stores';
import { getProfileByUsername } from '@/lib/profiles';
import { listPublishedSkills } from '@/lib/skills';
import { resolveTheme, listLinks, MODE_PALETTES, SITE_AUDIO_VOLUME } from '@/lib/storefront';
import { getDemoStore } from '@/lib/demoStores';
import { recordEvent } from '@/lib/metrics';
import { initials } from '@/lib/stores';
import { Pencil, Puzzle, Link2, ArrowUpRight, Sparkles, Search, Volume2, VolumeX, MapPin } from 'lucide-react';
import { BrandIcon } from '@/lib/brandIcons';
import { TYPE_BY_ID } from '@/lib/productTypes';
import SubscribeForm from '@/components/SubscribeForm';
import Seo from '@/components/Seo';
import { injectPixels } from '@/lib/pixels';

// Phase 3/7 — public, mobile-first link-in-bio storefront at /@username, themed.
export default function Storefront() {
  const { handle = '' } = useParams();
  const username = handle.replace(/^@/, '');
  const user = useUser();
  const [state, setState] = useState({ status: 'loading', profile: null, skills: [], links: [] });
  const [entered, setEntered] = useState(false); // splash: has the visitor clicked through?

  // Resolve the theme BEFORE the early returns so the hooks below are
  // unconditional (rules of hooks). Safe on a null profile — resolveTheme
  // falls back to DEFAULT_THEME.
  const theme = resolveTheme(state.profile?.storefront_theme);
  const tiltRef = useTilt(state.status === 'ready' && theme.tilt_enabled, theme.tilt_max);

  useEffect(() => {
    let alive = true;
    // Placeholder/demo storefronts (landing-page testimonial links) resolve
    // from static data — no DB round-trip, no metrics/pixels.
    const demo = getDemoStore(username);
    if (demo) { setState({ status: 'ready', ...demo }); return () => { alive = false; }; }
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

  // Dead-centered in the visible area, and it renders StoreStyles — the old
  // version shipped neither, so it was a bare left-aligned line of text at the
  // top of the page with none of the storefront CSS even loaded.
  if (state.status === 'loading') return (
    <div className="sf-loading" role="status" aria-live="polite">
      <span className="sf-spinner" aria-hidden="true" />
      <p className="sf-muted">Loading…</p>
      <StoreStyles />
    </div>
  );
  if (state.status === 'notfound') return (
    <div className="sf-wrap sf-center">
      <div style={{ color: 'var(--text-muted)', marginBottom: 12 }}><Search size={44} strokeWidth={1.5} /></div>
      <h1 className="sf-h1">@{username}</h1>
      <p className="sf-muted">We couldn’t find this storefront.</p>
      <StoreStyles />
    </div>
  );

  const { profile, skills, links } = state;
  const isOwner = user && user.id === profile.id;
  const splashOn = theme.splash_enabled && !entered;
  const socials = (theme.socials || []).filter(s => s.url);
  // Master switch for the name + social-icon halo. `!== false` on purpose:
  // stores saved before this key existed have it undefined and must keep glowing.
  const glowOn = theme.glow_enabled !== false;

  // Bucket products by group_label, preserving first-seen order (= sort_order).
  // '' (no label) is one anonymous group rendered without a heading.
  const skillGroups = [];
  const groupIndex = new Map();
  for (const s of skills) {
    const key = (s.group_label || '').trim();
    if (!groupIndex.has(key)) { groupIndex.set(key, skillGroups.length); skillGroups.push({ label: key, items: [] }); }
    skillGroups[groupIndex.get(key)].items.push(s);
  }

  // Full-page background layer. 'canvas' falls through to the mode palette's --bg.
  // 'video' renders a separate <video> element below (bgStyle stays undefined).
  const bgStyle =
    theme.bg === 'solid'    ? { background: theme.bg_color } :
    theme.bg === 'gradient' ? { background: `linear-gradient(160deg, ${theme.bg_color}, ${theme.bg_color2})` } :
    (theme.bg === 'image' && theme.bg_image) ? { backgroundImage: `url(${theme.bg_image})`, backgroundSize: 'cover', backgroundPosition: 'center' } :
    undefined;
  const hasBgVideo = theme.bg === 'video' && !!theme.bg_video;
  const wrapClass = [
    'sf-wrap', `sf-mode-${theme.mode}`, `sf-btn-${theme.button_style}`,
    `sf-glow-${theme.product_glow || 'none'}`,
    (theme.bg === 'image' && theme.bg_image) || hasBgVideo ? 'sf-has-bgimg' : '',
    theme.mono_icons ? 'sf-mono' : '',
    // Gated on glowOn too: sfNameGlow animates a hardcoded 18px text-shadow, so
    // unlike everything else it would NOT go away when --sf-glow collapses to 0.
    glowOn && theme.animated_name ? 'sf-anim-name' : '',
    theme.name_fx && theme.name_fx !== 'none' ? `sf-fx-${theme.name_fx}` : '',
  ].filter(Boolean).join(' ');

  const wrapStyle = {
    '--accent': theme.accent,
    '--sf-panel-bg': `color-mix(in srgb, var(--surface) ${theme.card_opacity ?? 100}%, transparent)`,
    '--sf-panel-blur': `${theme.card_blur ?? 0}px`,
    '--sf-item-bg': `color-mix(in srgb, var(--surface) ${theme.product_opacity ?? 100}%, transparent)`,
    '--sf-item-blur': `${theme.product_blur ?? 0}px`,
    '--sf-avatar-size': `${theme.avatar_size ?? 96}px`,
    '--sf-avatar-radius': theme.avatar_shape === 'square' ? '14%' : theme.avatar_shape === 'rounded' ? '26%' : '50%',
    '--sf-bio-size': `${theme.bio_size ?? 15}px`,
    '--sf-bio-weight': theme.bio_weight ?? 400,
    '--sf-bio-glow': `${theme.bio_glow ?? 0}px`,
    // Glow OFF collapses these to 0 rather than clearing the stored values, so
    // toggling back restores the creator's exact sliders.
    '--sf-glow': glowOn ? `${theme.glow_intensity ?? 0}px` : '0px',
    '--sf-glow-strong': glowOn ? `${(theme.glow_intensity ?? 0) * 2.4}px` : '0px',
    '--sf-icon-glow': glowOn ? `${theme.icon_glow ?? 10}px` : '0px',
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
      {hasBgVideo && (
        <video
          className="sf-bgvideo"
          src={theme.bg_video}
          autoPlay muted loop playsInline
          aria-hidden="true"
          style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: -1 }}
        />
      )}
      {theme.overlay && theme.overlay !== 'none' && (
        <div className={`sf-overlay sf-overlay-${theme.overlay}`} aria-hidden="true" />
      )}
      {/* Splash gates the page AND the music: mounting AudioPill only after the
          enter click means the browser already has user activation, so autoplay
          actually works instead of being blocked (see note 139). */}
      {splashOn && <Splash text={theme.splash_text} onEnter={() => setEntered(true)} />}
      {theme.audio_tracks?.length > 0 && !splashOn && <AudioPill tracks={theme.audio_tracks} />}
      {theme.cursor_fx && theme.cursor_fx !== 'none' && (
        <CursorFx kind={theme.cursor_fx} color={theme.cursor_fx_color || theme.accent} />
      )}
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

      {/* Tilt lives on a WRAPPER, not the panel — .sf-pfx-float already animates
          the panel's transform, and two rules can't own the same property. */}
      <div ref={tiltRef} className={theme.tilt_enabled ? 'sf-tiltwrap' : undefined}>
      <div className={`sf-panel${theme.banner_url ? ' sf-panel-hasbanner' : ''}${theme.card_opacity === 0 ? ' sf-panel-ghost' : ''}${theme.profile_fx && theme.profile_fx !== 'none' ? ` sf-pfx-${theme.profile_fx}` : ''}`}>
      {theme.banner_url && <div className="sf-panelbanner" style={{ backgroundImage: `url(${theme.banner_url})` }} />}
      <header className="sf-head">
        {theme.show_avatar !== false && (
          <div className="sf-avatar" style={profile.avatar_url ? { backgroundImage: `url(${profile.avatar_url})` } : {}}>
            {!profile.avatar_url && initials(profile.full_name)}
          </div>
        )}
        <h1 className="sf-name">{profile.full_name || `@${profile.username}`}</h1>
        <p className="sf-handle">@{profile.username}</p>
        {profile.location && (
          <p className="sf-location"><MapPin size={13} strokeWidth={2.4} aria-hidden="true" />{profile.location}</p>
        )}
        {profile.bio && <p className="sf-bio">{profile.bio}</p>}
        {socials.length > 0 && (
          <div className="sf-socials">
            {socials.map((s, i) => (
              <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="sf-social" title={s.type}>
                <BrandIcon type={s.type} size={23} />
              </a>
            ))}
          </div>
        )}
        {/* Link buttons live INSIDE the profile space — part of "who you are",
            visually distinct from the products section below. */}
        {links.filter(l => l.url).length > 0 && (
          <div className="sf-links">
            {links.filter(l => l.url).map(l => (
              <a key={l.id} href={l.url} target="_blank" rel={l.is_affiliate ? 'noopener noreferrer sponsored' : 'noopener noreferrer'} className="sf-linkbtn">
                <span className="sf-linkbtn-label"><Link2 size={16} /> {l.label}</span>
                {/* Visible disclosure. rel="sponsored" above is a crawler hint only —
                    a human sees nothing from it, and an affiliate relationship has to
                    be disclosed to the READER, not just to Google. */}
                {l.is_affiliate && <span className="sf-afftag">Affiliate</span>}
                <ArrowUpRight size={18} className="sf-linkbtn-arrow" />
              </a>
            ))}
          </div>
        )}
      </header>
      </div>
      </div>

      {skills.length > 0 && skillGroups.map((g, gi) => (
        <div key={gi} className="sf-group">
          {g.label && theme.show_group_headers !== false && (
            <div className="sf-grouphead">
              <h2 className="sf-grouptitle">{g.label}</h2>
              <span className="sf-groupline" aria-hidden="true" />
              <span className="sf-groupcount">{g.items.length}</span>
            </div>
          )}
          <div className={`sf-list${theme.layout === 'grid' ? ' sf-grid' : ''}`}>
            {g.items.map(s => (
              <Link key={s.id} to={`/@${profile.username}/${s.id}`} className="sf-card">
                <div className="sf-cover" style={s.cover_url ? { backgroundImage: `url(${s.cover_url})` } : {}}>
                  {!s.cover_url && <Puzzle size={28} strokeWidth={1.5} />}
                </div>
                <div className="sf-card-body">
                  <p className="sf-card-title">{s.title}</p>
                  {s.outcome && <p className="sf-card-outcome">{s.outcome}</p>}
                  <div className="sf-card-foot">
                    <span className="sf-price">{s.price_cents ? `$${(s.price_cents / 100).toFixed(2)}` : 'Free'}</span>
                    {theme.show_type_badges !== false && <TypeTag skill={s} />}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}

      {skills.length === 0 && links.length === 0 && (
        <p className="sf-muted sf-center">Nothing here yet — check back soon.</p>
      )}

      <SubscribeForm creatorId={profile.id} name={profile.full_name || `@${profile.username}`} />

      <footer className="sf-foot">
        <Link to="/"><Sparkles size={12} /> Built on SkillJoy</Link>
      </footer>
      <StoreStyles />
    </div>
  );
}

// ── Site music: plays a PLAYLIST automatically (unmuted) where the browser
// allows it. React owns ONE <audio> element (no hand-rolled `new Audio()` → no
// StrictMode double-instance leaks). The icon tracks the element's REAL
// play/pause events, so it can never desync. Autoplay is attempted on mount; if
// the browser blocks it (policy for first-time visitors), we start on the first
// interaction — UNLESS the user has already taken manual control (`interacted`),
// so pausing never gets undone by the auto-starter. A single track loops; a
// multi-track playlist advances on `ended` and wraps back to the first.

function AudioPill({ tracks }) {
  const audioRef = useRef(null);
  const interacted = useRef(false);
  const didMount = useRef(false);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const single = tracks.length <= 1;
  const current = tracks[idx] || tracks[0];

  // Mount: attempt autoplay; if blocked, start on the first user gesture.
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return undefined;
    a.volume = SITE_AUDIO_VOLUME;   // BEFORE any play() so the first note is already at 85%
    let cancelled = false;
    const start = () => {
      removeListeners();
      if (!interacted.current) a.play().catch(() => {});
    };
    function removeListeners() {
      window.removeEventListener('pointerdown', start);
      window.removeEventListener('keydown', start);
    }
    a.play().catch(() => {
      if (cancelled || interacted.current) return;   // blocked → wait for a gesture
      window.addEventListener('pointerdown', start);
      window.addEventListener('keydown', start);
    });
    return () => { cancelled = true; removeListeners(); a.pause(); };
  }, []);

  // When the track advances (incl. wrapping back to 0), keep playing the new
  // src. Skip the initial mount so we don't fight the autoplay/gesture logic.
  useEffect(() => {
    if (!didMount.current) { didMount.current = true; return; }
    const a = audioRef.current;
    if (a) a.play().catch(() => {});
  }, [idx]);

  // pointerdown fires before the window auto-starter sees this same click, so
  // flagging here means clicking the pill is treated as manual control.
  const markInteracted = () => { interacted.current = true; };
  function toggle() {
    interacted.current = true;
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) a.play().catch(() => {}); else a.pause();
  }
  function onEnded() {
    if (single) return;                       // single track loops via the `loop` attr
    setIdx(i => (i + 1) % tracks.length);     // advance; the idx effect resumes playback
  }

  return (
    <>
      <audio ref={audioRef} src={current?.url} loop={single} onEnded={onEnded}
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />
      <button className="sf-audiopill" onPointerDown={markInteracted} onClick={toggle}
        aria-label={playing ? 'Pause music' : 'Play music'} title={current?.name || undefined}>
        {playing ? <Volume2 size={16} /> : <VolumeX size={16} />}
      </button>
    </>
  );
}

// ── Product-type badge — differentiates card kinds (Course · Download · …).
// `skills.kind` matches PRODUCT_TYPES ids; legacy rows without a kind fall back
// to membership (by pricing_type) or digital.
function TypeTag({ skill }) {
  const t = TYPE_BY_ID[skill.kind]
    || (skill.pricing_type === 'membership' ? TYPE_BY_ID.membership : TYPE_BY_ID.digital);
  const Icon = t.icon;
  return <span className="sf-tag"><Icon size={11} strokeWidth={2.4} /> {t.label}</span>;
}

// ── Splash / "click to enter" ────────────────────────────────────────────────
// A full-screen gate. Beyond the vibe, the click gives the document "user
// activation", which is what lets the music actually autoplay afterwards.
function Splash({ text, onEnter }) {
  return (
    <div
      className="sf-splash"
      role="button"
      tabIndex={0}
      onClick={onEnter}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEnter(); } }}
    >
      <span className="sf-splash-text">{text || 'click to enter'}</span>
    </div>
  );
}

// ── 3D tilt / parallax ───────────────────────────────────────────────────────
// Returns a ref to attach to the element you want to tilt. On pointer move we
// map the cursor's position INSIDE the element to two rotations and write them
// to CSS custom properties — CSS owns the actual transform. Writing vars (not
// .style.transform) keeps it declarative and lets a CSS transition smooth it
// for free. Full walkthrough: notes/143-3d-tilt-parallax/README.md
function useTilt(enabled, max = 10) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;

    let frame = 0;
    function onMove(e) {
      if (frame) return;                    // throttle: at most one write per frame
      frame = requestAnimationFrame(() => {
        frame = 0;
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;   // 0 → 1 across the element
        const py = (e.clientY - r.top) / r.height;   // 0 → 1 down the element
        // Recenter to -0.5→0.5, double to -1→1, scale to degrees. Y is inverted:
        // pointer near the TOP should tip the top edge away from the viewer.
        el.style.setProperty('--tilt-x', `${(0.5 - py) * 2 * max}deg`);
        el.style.setProperty('--tilt-y', `${(px - 0.5) * 2 * max}deg`);
      });
    }
    function reset() {
      if (frame) { cancelAnimationFrame(frame); frame = 0; }
      el.style.setProperty('--tilt-x', '0deg');
      el.style.setProperty('--tilt-y', '0deg');
    }
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', reset);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', reset);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [enabled, max]);
  return ref;
}

// ── Cursor particle effects (trail / sparkle). Distinct from the static
// cursor_url. Spawns short-lived absolutely-positioned dots at the pointer,
// capped + cleaned up on unmount. Cheap: plain DOM nodes + CSS animation.
const CURSOR_FX_MAX = 24;
function CursorFx({ kind, color }) {
  useEffect(() => {
    const layer = document.createElement('div');
    layer.className = 'sf-fxlayer';
    // The layer lives on <body>, OUTSIDE the storefront wrapper — so the
    // creator's pinned --accent doesn't reach it. Pin the color here instead
    // (also what makes the custom cursor_fx_color work).
    layer.style.setProperty('--sf-fx-color', color);
    document.body.appendChild(layer);
    let last = 0;
    function onMove(e) {
      const now = performance.now();
      if (now - last < 28) return; // throttle spawn rate
      last = now;
      if (layer.childElementCount >= CURSOR_FX_MAX) layer.firstChild?.remove();
      const p = document.createElement('div');
      p.className = `sf-fxp sf-fxp-${kind}`;
      p.style.left = `${e.clientX}px`;
      p.style.top = `${e.clientY}px`;
      if (kind === 'sparkle') p.textContent = '✦';
      layer.appendChild(p);
      setTimeout(() => p.remove(), 650);
    }
    window.addEventListener('mousemove', onMove);
    return () => { window.removeEventListener('mousemove', onMove); layer.remove(); };
  }, [kind, color]);
  return null;
}

function StoreStyles() {
  return <style>{`
    .sf-wrap { max-width:540px; margin:0 auto; padding:0 18px 96px; position:relative; }
    .sf-center { text-align:center; padding-top:40px; }
    .sf-h1 { font-size:26px; font-weight:800; letter-spacing:-.02em; }
    .sf-muted { color:var(--text-muted); }

    /* ── Deeper theming: background layer, light/dark palette, button styles ── */
    .sf-bg { position:fixed; inset:0; z-index:-1; background:var(--bg); }

    /* ── Overlay effects (rain / snow / vhs) — fixed, non-interactive, above bg,
       below content (content is in normal flow above the z-indexed layers). */
    .sf-overlay { position:fixed; inset:0; z-index:0; pointer-events:none; }
    /* Rain: a single slanted streak in a 9x64 tile, scrolled by exactly one tile
       (−9px, 64px) each cycle → perfectly seamless, thin, crisp streaks. */
    .sf-overlay-rain {
      background-image:linear-gradient(107deg, transparent 0 45%, color-mix(in srgb, var(--text) 42%, transparent) 47% 51%, transparent 53% 100%);
      background-size:9px 64px;
      animation:sfRain .55s linear infinite;
      opacity:.6;
    }
    @keyframes sfRain { to { background-position:-9px 64px; } }
    .sf-overlay-snow {
      --snow:color-mix(in srgb, var(--text) 60%, transparent);
      background-image:
        radial-gradient(2.5px 2.5px at 20% 15%, var(--snow) 60%, transparent),
        radial-gradient(2px 2px at 65% 40%, var(--snow) 60%, transparent),
        radial-gradient(3px 3px at 40% 70%, var(--snow) 60%, transparent),
        radial-gradient(2px 2px at 85% 20%, var(--snow) 60%, transparent),
        radial-gradient(2.5px 2.5px at 10% 55%, var(--snow) 60%, transparent),
        radial-gradient(2px 2px at 50% 10%, var(--snow) 60%, transparent);
      background-size:220px 220px;
      animation:sfSnow 9s linear infinite;
      opacity:.55;
    }
    @keyframes sfSnow { from { background-position:0 -220px; } to { background-position:28px 220px; } }
    .sf-overlay-vhs {
      background:repeating-linear-gradient(to bottom, transparent 0 2px, rgba(0,0,0,.14) 2px 3px);
      mix-blend-mode:overlay;
      animation:sfVhs 4s steps(2) infinite;
    }
    @keyframes sfVhs { 0%,100% { opacity:.9; } 50% { opacity:.65; } }
    /* Stars: fixed dots that twinkle together (cheap — one opacity animation). */
    .sf-overlay-stars {
      --sfstar:color-mix(in srgb, var(--text) 82%, transparent);
      background-image:
        radial-gradient(1.5px 1.5px at 12% 18%, var(--sfstar) 60%, transparent),
        radial-gradient(1px 1px at 38% 62%, var(--sfstar) 60%, transparent),
        radial-gradient(2px 2px at 68% 28%, var(--sfstar) 60%, transparent),
        radial-gradient(1.2px 1.2px at 84% 74%, var(--sfstar) 60%, transparent),
        radial-gradient(1.6px 1.6px at 24% 84%, var(--sfstar) 60%, transparent),
        radial-gradient(1px 1px at 56% 12%, var(--sfstar) 60%, transparent),
        radial-gradient(1.4px 1.4px at 92% 44%, var(--sfstar) 60%, transparent);
      background-size:260px 260px;
      animation:sfStars 4.5s ease-in-out infinite;
    }
    @keyframes sfStars { 0%,100% { opacity:.4; } 50% { opacity:.95; } }
    /* Particles: accent motes drifting up; one tile scrolled by exactly its
       height (-260px) so the loop is seamless. */
    .sf-overlay-particles {
      --sfp:color-mix(in srgb, var(--accent) 78%, transparent);
      background-image:
        radial-gradient(3px 3px at 15% 92%, var(--sfp) 60%, transparent),
        radial-gradient(2px 2px at 45% 74%, var(--sfp) 60%, transparent),
        radial-gradient(2.5px 2.5px at 70% 88%, var(--sfp) 60%, transparent),
        radial-gradient(2px 2px at 88% 60%, var(--sfp) 60%, transparent),
        radial-gradient(3px 3px at 30% 42%, var(--sfp) 60%, transparent),
        radial-gradient(1.8px 1.8px at 60% 20%, var(--sfp) 60%, transparent);
      background-size:260px 260px;
      animation:sfParticles 12s linear infinite;
      opacity:.7;
    }
    @keyframes sfParticles { from { background-position:0 0; } to { background-position:18px -260px; } }
    /* Matrix: accent column grid + a falling light band, scrolled one tile. */
    .sf-overlay-matrix {
      background-image:
        repeating-linear-gradient(90deg, transparent 0 12px, color-mix(in srgb, var(--accent) 20%, transparent) 12px 13px, transparent 13px 26px),
        linear-gradient(180deg, transparent 0 42%, color-mix(in srgb, var(--accent) 50%, transparent) 72%, transparent 100%);
      background-size:26px 100%, 26px 220px;
      background-repeat:repeat, repeat;
      animation:sfMatrix 1.8s linear infinite;
      opacity:.5;
    }
    @keyframes sfMatrix { from { background-position:0 0, 0 0; } to { background-position:0 0, 0 220px; } }

    /* ── Splash / click-to-enter ── */
    /* left:var(--shell-offset) instead of inset:0 — a logged-in visitor has the
       248px app rail on screen, and a viewport-wide fixed layer ignores it, so
       the text centered ~124px left of where the page visually centers. The rail
       also paints OVER this at z-index 200, so the gate is inset beside it. */
    .sf-splash { position:fixed; top:0; right:0; bottom:0; left:var(--shell-offset, 0px);
      z-index:100; display:flex; align-items:center; justify-content:center;
      cursor:pointer; background:rgba(8,8,12,.55); -webkit-backdrop-filter:blur(14px); backdrop-filter:blur(14px);
      animation:sfSplashIn .28s ease; }
    /* Full-height centered loader, matched to the splash so both agree. */
    .sf-loading { position:fixed; top:0; right:0; bottom:0; left:var(--shell-offset, 0px);
      display:flex; flex-direction:column; align-items:center; justify-content:center; gap:13px; }
    .sf-spinner { width:30px; height:30px; border-radius:50%;
      border:3px solid color-mix(in srgb, var(--accent) 20%, transparent);
      border-top-color:var(--accent); animation:sfSpin .8s linear infinite; }
    @keyframes sfSpin { to { transform:rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .sf-spinner { animation-duration:2.6s; } }
    @keyframes sfSplashIn { from { opacity:0; } to { opacity:1; } }
    .sf-splash-text { font-size:14px; font-weight:800; letter-spacing:.24em; text-transform:uppercase; color:#fff;
      text-shadow:0 0 20px color-mix(in srgb, var(--accent) 85%, transparent); animation:sfSplashPulse 2.2s ease-in-out infinite; }
    @keyframes sfSplashPulse { 0%,100% { opacity:.6; } 50% { opacity:1; } }
    @media (prefers-reduced-motion: reduce) { .sf-splash-text { animation:none; opacity:1; } }

    /* ── 3D tilt wrapper — the hook writes --tilt-x / --tilt-y, CSS does the rest ── */
    .sf-tiltwrap { transform:perspective(900px) rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg));
      transform-style:preserve-3d; will-change:transform; transition:transform .14s ease-out; }
    @media (prefers-reduced-motion: reduce) { .sf-tiltwrap { transform:none; } }

    /* ── Site audio pill ── */
    .sf-audiopill {
      position:fixed; right:18px; bottom:18px; z-index:5;
      width:38px; height:38px; min-width:0; padding:0;
      display:flex; align-items:center; justify-content:center;
      border-radius:50%; cursor:pointer;
      /* Dark glass so it's visible on ANY background/theme (not a white blob on
         a dark storefront). Accent-tinted border keeps the brand cue. */
      border:1.5px solid color-mix(in srgb, var(--accent) 55%, rgba(255,255,255,0.25));
      background:rgba(18,18,22,0.5);
      -webkit-backdrop-filter:blur(10px); backdrop-filter:blur(10px);
      color:#fff;
      box-shadow:0 4px 16px rgba(0,0,0,0.32);
      transition:transform .15s ease, box-shadow .15s ease;
    }
    .sf-audiopill:hover { transform:scale(1.08); box-shadow:0 6px 22px color-mix(in srgb, var(--accent) 40%, transparent); }

    /* ── Cursor particle FX ── */
    .sf-fxlayer { position:fixed; inset:0; z-index:60; pointer-events:none; overflow:hidden; }
    .sf-fxp { position:absolute; transform:translate(-50%,-50%); animation:sfFxFade .65s ease-out forwards; }
    .sf-fxp-trail { width:7px; height:7px; border-radius:50%; background:var(--sf-fx-color, var(--accent)); box-shadow:0 0 8px var(--sf-fx-color, var(--accent)); }
    .sf-fxp-sparkle { color:var(--sf-fx-color, var(--accent)); font-size:12px; line-height:1; text-shadow:0 0 6px var(--sf-fx-color, var(--accent)); }
    @keyframes sfFxFade { from { opacity:.9; scale:1; } to { opacity:0; scale:.2; } }

    /* ── Profile panel FX (respect reduced motion) ── */
    @media (prefers-reduced-motion: no-preference) {
      .sf-pfx-glow { animation:sfPfxGlow 2.6s ease-in-out infinite; }
      @keyframes sfPfxGlow {
        0%,100% { box-shadow:0 0 18px color-mix(in srgb, var(--accent) 22%, transparent); }
        50%     { box-shadow:0 0 34px color-mix(in srgb, var(--accent) 48%, transparent); }
      }
      .sf-pfx-float { animation:sfPfxFloat 4.5s ease-in-out infinite; }
      @keyframes sfPfxFloat { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-7px); } }
      .sf-overlay-rain, .sf-overlay-snow, .sf-overlay-vhs { /* animated above */ }
    }
    @media (prefers-reduced-motion: reduce) {
      .sf-overlay-rain, .sf-overlay-snow, .sf-overlay-vhs { animation:none; }
      .sf-pfx-glow { box-shadow:0 0 24px color-mix(in srgb, var(--accent) 32%, transparent); }
    }
    /* The storefront pins BOTH palettes explicitly so a visitor's site-wide
       dark mode (data-theme on <html>) can never override a creator's chosen
       page mode — the public page always reflects the creator's setting. */
    .sf-mode-light {
      --bg:${MODE_PALETTES.light.bg}; --surface:${MODE_PALETTES.light.surface}; --surface-alt:${MODE_PALETTES.light.surfaceAlt};
      --text:${MODE_PALETTES.light.text}; --text-secondary:${MODE_PALETTES.light.textSecondary}; --text-muted:${MODE_PALETTES.light.textMuted};
      --border:${MODE_PALETTES.light.border}; --border-strong:${MODE_PALETTES.light.borderStrong};
    }
    .sf-mode-dark {
      --bg:${MODE_PALETTES.dark.bg}; --surface:${MODE_PALETTES.dark.surface}; --surface-alt:${MODE_PALETTES.dark.surfaceAlt};
      --text:${MODE_PALETTES.dark.text}; --text-secondary:${MODE_PALETTES.dark.textSecondary}; --text-muted:${MODE_PALETTES.dark.textMuted};
      --border:${MODE_PALETTES.dark.border}; --border-strong:${MODE_PALETTES.dark.borderStrong};
    }
    /* Explicit dark canvas so it never falls back to the app's light bg. */
    .sf-mode-dark .sf-bg { background:${MODE_PALETTES.dark.bg}; }
    .sf-has-bgimg .sf-name, .sf-has-bgimg .sf-handle, .sf-has-bgimg .sf-bio { text-shadow:0 1px 14px rgba(0,0,0,.5); }
    /* Button-style + glow apply to PRODUCTS only — links have their own look below. */
    .sf-btn-pill .sf-card, .sf-btn-pill .sf-cover { border-radius:var(--r-2xl); }
    .sf-btn-sharp .sf-card, .sf-btn-sharp .sf-cover { border-radius:6px; }

    /* Main glass panel — wraps the profile info so the background never bleeds
       into the text. Opacity + blur sliders drive --sf-panel-bg / --sf-panel-blur. */
    .sf-panel { position:relative; z-index:1; margin-top:28px; padding:32px 22px 26px; border-radius:var(--r-2xl); overflow:hidden;
      background:var(--sf-panel-bg, var(--surface));
      -webkit-backdrop-filter:blur(var(--sf-panel-blur, 0px)); backdrop-filter:blur(var(--sf-panel-blur, 0px));
      border:1px solid color-mix(in srgb, var(--border-strong) 55%, transparent);
      box-shadow:var(--shadow-xl), inset 0 1px 0 color-mix(in srgb, #fff 30%, transparent),
        0 0 var(--sf-glow-strong, 0px) color-mix(in srgb, var(--accent) 62%, transparent); }
    /* Banner lives inside the panel — negative margins pull it edge-to-edge, the
       panel's overflow:hidden rounds its top corners to match. */
    .sf-panelbanner { height:150px; margin:-32px -22px 16px; background:var(--surface-alt) center/cover no-repeat; position:relative; }
    .sf-panelbanner::after { content:''; position:absolute; inset:0; background:linear-gradient(180deg, transparent 50%, rgba(20,18,12,.28)); }
    .sf-panel-hasbanner .sf-avatar { margin-top:-58px; position:relative; z-index:1; }
    /* Opacity 0 → the panel becomes an invisible container (info floats on the bg). */
    .sf-panel-ghost { border-color:transparent; box-shadow:none; }

    /* Product glow — resting accent glow on product cards only, stronger on hover. */
    .sf-glow-soft .sf-card { box-shadow:0 0 26px color-mix(in srgb, var(--accent) 38%, transparent), var(--shadow-sm); }
    .sf-glow-strong .sf-card { box-shadow:0 0 34px color-mix(in srgb, var(--accent) 62%, transparent), 0 0 60px color-mix(in srgb, var(--accent) 34%, transparent), var(--shadow); }
    .sf-glow-soft .sf-card:hover { box-shadow:0 0 40px color-mix(in srgb, var(--accent) 55%, transparent), 0 10px 24px color-mix(in srgb, var(--accent) 20%, transparent); }
    .sf-glow-strong .sf-card:hover { box-shadow:0 0 54px color-mix(in srgb, var(--accent) 78%, transparent), 0 0 90px color-mix(in srgb, var(--accent) 40%, transparent), 0 12px 26px color-mix(in srgb, var(--accent) 24%, transparent); }

    .sf-mono .sf-social svg { filter:grayscale(1); opacity:.82; }
    .sf-anim-name .sf-name { animation:sfNameGlow 2.6s ease-in-out infinite; }
    @keyframes sfNameGlow { 0%,100% { text-shadow:0 0 0 transparent; } 50% { text-shadow:0 0 18px color-mix(in srgb, var(--accent) 65%, transparent); } }
    @media (prefers-reduced-motion: reduce) { .sf-anim-name .sf-name { animation:none; } }

    /* ── Display-name text effects (guns.lol-style, background-clip:text) ── */
    .sf-fx-gradient .sf-name, .sf-fx-rainbow .sf-name, .sf-fx-shimmer .sf-name {
      color:transparent; -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; }
    .sf-fx-gradient .sf-name { background-image:linear-gradient(92deg, var(--accent), color-mix(in srgb, var(--accent) 45%, #fff)); }
    .sf-fx-rainbow .sf-name {
      background-image:linear-gradient(92deg, #ff2d75, #ff8c00, #ffd400, #00cc99, #00b3ff, #7a5cff, #ff2d75);
      background-size:220% auto; animation:sfNameRainbow 4.5s linear infinite; }
    @keyframes sfNameRainbow { to { background-position:220% center; } }
    .sf-fx-shimmer .sf-name {
      background-image:linear-gradient(100deg, var(--accent) 0 42%, #fff 50%, var(--accent) 58% 100%);
      background-size:250% auto; animation:sfNameShimmer 3.2s linear infinite; }
    @keyframes sfNameShimmer { to { background-position:-250% center; } }
    .sf-fx-glitch .sf-name { animation:sfNameGlitch 2.2s infinite steps(1); }
    @keyframes sfNameGlitch {
      0%,88%,100% { text-shadow:none; }
      90% { text-shadow:-2px 0 #ff2d75, 2px 0 #00c8ff; }
      93% { text-shadow:2px 0 #ff2d75, -2px 0 #00c8ff; transform:translateX(1px); }
      96% { text-shadow:-1px 0 #ff2d75, 1px 0 #00c8ff; transform:translateX(-1px); }
    }
    @media (prefers-reduced-motion: reduce) {
      .sf-fx-rainbow .sf-name, .sf-fx-shimmer .sf-name, .sf-fx-glitch .sf-name { animation:none; }
    }

    /* Owner edit button — floats over everything. */
    /* Dark glass — visible on any background/theme (was a solid white pill that
       vanished on a dark storefront). */
    .sf-editbtn { position:fixed; top:16px; right:16px; z-index:20; display:inline-flex; align-items:center; gap:6px; background:rgba(18,18,22,0.55); -webkit-backdrop-filter:blur(10px); backdrop-filter:blur(10px); border:1px solid rgba(255,255,255,0.18); color:#fff; text-decoration:none; font-size:13px; font-weight:700; padding:9px 15px; border-radius:var(--r-full); box-shadow:0 4px 16px rgba(0,0,0,0.3); transition:transform .14s ease, box-shadow .14s ease; }
    .sf-editbtn:hover { transform:translateY(-1px); box-shadow:0 8px 24px rgba(0,0,0,0.4); }

    /* Header / hero — sits inside the glass panel */
    .sf-head { text-align:center; margin:0 0 22px; }
    .sf-avatar { width:var(--sf-avatar-size, 96px); height:var(--sf-avatar-size, 96px); border-radius:var(--sf-avatar-radius, 50%); margin:0 auto 14px; background:color-mix(in srgb, var(--accent) 14%, white) center/cover no-repeat; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:calc(var(--sf-avatar-size, 96px) * 0.34); color:var(--accent); border:4px solid var(--surface); box-shadow:var(--shadow-lg), 0 0 var(--sf-glow-strong, 0px) color-mix(in srgb, var(--accent) 85%, transparent); }
    .sf-name { font-size:27px; font-weight:800; font-family:var(--font-display); letter-spacing:-.02em; line-height:1.15; color:var(--sf-title, inherit); filter:drop-shadow(0 0 var(--sf-glow, 0px) color-mix(in srgb, var(--accent) 100%, transparent)) drop-shadow(0 0 var(--sf-glow-strong, 0px) color-mix(in srgb, var(--accent) 55%, transparent)); }
    .sf-handle { color:var(--accent); font-size:14px; font-weight:600; margin-top:3px; }
    /* Muted, not accent — the handle already owns the accent here; a second
       accent line directly under it competes with the display name. */
    .sf-location { display:inline-flex; align-items:center; gap:5px; margin-top:7px;
      color:var(--text-muted); font-size:13px; font-weight:600; }
    .sf-location svg { flex-shrink:0; opacity:.85; }
    .sf-bio { color:var(--text-secondary); font-size:var(--sf-bio-size, 15px); font-weight:var(--sf-bio-weight, 400); margin:12px auto 0; line-height:1.55; max-width:42ch;
      filter:drop-shadow(0 0 var(--sf-bio-glow, 0px) color-mix(in srgb, var(--accent) 70%, transparent)); }
    .sf-socials { display:flex; gap:16px; justify-content:center; margin-top:20px; }
    /* Bare icons (no circle) with a shape-hugging glow via filter:drop-shadow.
       Driven by --sf-icon-glow (0–60px slider): triple layered bloom — tight
       core + halo + wide outer wash — so cranked all the way it reads as a
       full neon burst, and at 0px it's invisible. */
    .sf-social { display:inline-flex; align-items:center; justify-content:center; padding:5px; color:var(--text); text-decoration:none;
      transition:transform .18s cubic-bezier(.34,1.4,.64,1), color .14s ease, filter .18s ease;
      filter:
        drop-shadow(0 0 calc(var(--sf-icon-glow, 10px) * 0.3) color-mix(in srgb, var(--accent) 90%, transparent))
        drop-shadow(0 0 var(--sf-icon-glow, 10px) color-mix(in srgb, var(--accent) 55%, transparent))
        drop-shadow(0 0 calc(var(--sf-icon-glow, 10px) * 2.2) color-mix(in srgb, var(--accent) 38%, transparent)); }
    .sf-social:hover { transform:translateY(-3px) scale(1.14); color:var(--accent);
      filter:
        drop-shadow(0 0 calc(var(--sf-icon-glow, 10px) * 0.4) var(--accent))
        drop-shadow(0 0 calc(var(--sf-icon-glow, 10px) * 1.3) color-mix(in srgb, var(--accent) 75%, transparent))
        drop-shadow(0 0 calc(var(--sf-icon-glow, 10px) * 2.8) color-mix(in srgb, var(--accent) 50%, transparent)); }

    /* Product cards + link buttons — a separate section below the profile panel */
    /* Links sit inside the profile panel — full width, stacked under the socials. */
    .sf-links { display:flex; flex-direction:column; gap:10px; margin-top:18px; width:100%; }
    .sf-group { margin-top:22px; }
    /* Section header: title + accent-fading rule + item-count pill. */
    .sf-grouphead { display:flex; align-items:center; gap:12px; margin:0 4px 2px; }
    .sf-grouptitle { font-size:15px; font-weight:800; letter-spacing:-.01em; color:var(--sf-title, var(--text)); margin:0; white-space:nowrap;
      filter:drop-shadow(0 0 var(--sf-glow, 0px) color-mix(in srgb, var(--accent) 70%, transparent)); }
    .sf-groupline { flex:1; height:1px; background:linear-gradient(90deg, color-mix(in srgb, var(--accent) 55%, transparent), color-mix(in srgb, var(--border-strong) 50%, transparent)); }
    .sf-groupcount { font-size:11px; font-weight:800; color:var(--accent); background:color-mix(in srgb, var(--accent) 13%, transparent); border:1px solid color-mix(in srgb, var(--accent) 28%, transparent); padding:2px 8px; border-radius:var(--r-full); }
    .sf-group .sf-list { margin-top:12px; }
    .sf-list { display:flex; flex-direction:column; gap:14px; margin-top:22px; }
    .sf-grid { display:grid; grid-template-columns:repeat(2, 1fr); gap:12px; }
    .sf-card { display:flex; gap:14px; align-items:center; padding:12px; border:1px solid var(--border); border-radius:var(--r-lg); background:var(--sf-item-bg, var(--surface)); backdrop-filter:blur(var(--sf-item-blur, 0px)); -webkit-backdrop-filter:blur(var(--sf-item-blur, 0px)); text-decoration:none; box-shadow:var(--shadow-sm); transition:transform .16s cubic-bezier(.34,1.4,.64,1), box-shadow .16s ease, border-color .16s ease; }
    .sf-card:hover { transform:translateY(-3px); border-color:color-mix(in srgb, var(--accent) 45%, var(--border)); box-shadow:0 12px 26px color-mix(in srgb, var(--accent) 16%, transparent), var(--shadow); }
    .sf-grid .sf-card { flex-direction:column; align-items:stretch; gap:10px; padding:10px; }
    .sf-cover { width:88px; height:88px; flex-shrink:0; border-radius:var(--r); background:var(--surface-alt) center/cover no-repeat; display:flex; align-items:center; justify-content:center; font-size:30px; }
    .sf-grid .sf-cover { width:100%; height:auto; aspect-ratio:16/10; }
    .sf-card-body { flex:1; min-width:0; }
    .sf-card-title { font-weight:700; color:var(--text); font-size:15.5px; }
    .sf-card-outcome { font-size:13px; color:var(--text-secondary); margin-top:3px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
    .sf-card-foot { display:flex; align-items:center; gap:8px; margin-top:10px; }
    .sf-price { font-weight:800; color:var(--text); font-size:15px; }
    .sf-tag { display:inline-flex; align-items:center; gap:4px; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:var(--accent); background:color-mix(in srgb, var(--accent) 16%, transparent); border:1px solid color-mix(in srgb, var(--accent) 30%, transparent); padding:3px 9px; border-radius:var(--r-full); white-space:nowrap; }
    .sf-tag svg { flex-shrink:0; }

    /* Link buttons — deliberately distinct from product cards: pill, accent-tinted,
       centered label, no cover/border-box. */
    /* Visible affiliate disclosure. Deliberately legible, not a whisper — the
       point is that a visitor can actually see it. */
    .sf-afftag { flex-shrink:0; font-size:9.5px; font-weight:800; letter-spacing:.07em; text-transform:uppercase;
      padding:3px 8px; border-radius:var(--r-full); color:var(--accent);
      background:color-mix(in srgb, var(--accent) 14%, transparent);
      border:1px solid color-mix(in srgb, var(--accent) 32%, transparent); }
    .sf-linkbtn { display:flex; align-items:center; justify-content:center; gap:9px; padding:14px 18px; border:1.5px solid color-mix(in srgb, var(--accent) 32%, transparent); border-radius:var(--r-full); background:color-mix(in srgb, var(--accent) 10%, var(--sf-item-bg, var(--surface))); backdrop-filter:blur(var(--sf-item-blur, 0px)); -webkit-backdrop-filter:blur(var(--sf-item-blur, 0px)); text-decoration:none; color:var(--text); font-weight:700; box-shadow:0 0 var(--sf-glow, 0px) color-mix(in srgb, var(--accent) 78%, transparent); transition:transform .16s cubic-bezier(.34,1.4,.64,1), background .16s ease, border-color .16s ease, box-shadow .16s ease; }
    .sf-linkbtn:hover { transform:translateY(-2px); background:color-mix(in srgb, var(--accent) 18%, var(--surface)); border-color:var(--accent); box-shadow:0 8px 22px color-mix(in srgb, var(--accent) 22%, transparent), 0 0 var(--sf-glow, 0px) color-mix(in srgb, var(--accent) 60%, transparent); }
    .sf-linkbtn-label { display:inline-flex; align-items:center; gap:9px; }
    .sf-linkbtn-arrow { color:var(--accent); flex-shrink:0; }

    /* Brand footer */
    .sf-foot { text-align:center; margin-top:36px; }
    .sf-foot a { display:inline-flex; align-items:center; gap:5px; font-size:12px; font-weight:700; color:var(--text-muted); text-decoration:none; letter-spacing:.02em; transition:color .14s ease; }
    .sf-foot a:hover { color:var(--accent); }
  `}</style>;
}
