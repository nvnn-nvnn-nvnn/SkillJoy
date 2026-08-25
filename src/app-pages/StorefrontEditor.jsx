import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useUser, useProfile, useAuth } from '@/lib/stores';
import { listMySkills, reorderSkills, updateSkill } from '@/lib/skills';
import { initials } from '@/lib/stores';
import {
  resolveTheme, updateStorefront, SOCIAL_TYPES,
  listLinks,
  THEME_PRESETS, PRESET_CATEGORIES, presetsByCategory, sanitizeThemeImport, portableTheme, SITE_AUDIO_VOLUME,
} from '@/lib/storefront';
import { uploadBanner, uploadBgVideo, uploadAudio } from '@/lib/storage';
import { validateUpload, LIMITS, formatBytes } from '@/lib/uploadLimits';
import { MAX_AUDIO_TRACKS, GLOW_TARGETS, glowVars } from '@/lib/storefront';
import {
  Palette, Link2, Eye, ImagePlus, X, Plus, ChevronUp, ChevronDown,
  ExternalLink, Check, MousePointer2, Type, Video, Music, Wand2, SlidersHorizontal,
  Image as ImageIcon, Camera, AtSign, User, Sparkles, LayoutGrid, ListMusic,
  Upload, Download, Layers, MapPin, Star,
} from 'lucide-react';
import { BrandIcon } from '@/lib/brandIcons';
import LinkBlockEditor from '@/components/LinkBlockEditor';
import { listBlocks, resolveBlockLayout, LINK_SHAPES } from '@/lib/blocks';
import { listTemplates, saveTemplate, deleteTemplate } from '@/lib/templates';
import { useDialog } from '@/components/Dialog';

// Same constant the Admin page uses. Gating the SAVE UI here is convenience,
// not security — the backend re-checks ADMIN_EMAIL, which is the check that
// actually matters. A client-side constant is a hint, never a boundary.
const ADMIN_EMAIL = 'techkage@proton.me';

const ACCENT_PRESETS = ['#F5634A', '#2563EB', '#7C3AED', '#DB2777', '#F59E0B', '#EF4444', '#0D9488', '#F8FAFC'];

const SUBTAB_HEADS = { customize: 'Site Customization', themes: 'Templates', links: 'Links' };

// ── Theme-card helpers ───────────────────────────────────────────────────────
// Paint a preset's ACTUAL background so the card previews the look, not an emoji.
function swatchStyle(t) {
  // Scenic presets ARE their background, so a swatch that painted a flat colour
  // would show every one of them as the same grey tile.
  if ((t.bg === 'image' || t.bg === 'video') && t.bg_image) {
    return { backgroundImage: `url(${t.bg_image})`, backgroundSize: 'cover', backgroundPosition: 'center' };
  }
  // Motion presets: a static approximation of the composite — the ground with
  // both moving colours bloomed over it. Not animated at swatch size (eight
  // looping tiles in a grid is noise, not information), but it shows the palette.
  if (t.bg === 'animated') {
    return { background: `radial-gradient(60% 70% at 22% 24%, ${t.bg_color2 || t.accent} 0%, transparent 62%),`
      + ` radial-gradient(58% 66% at 78% 74%, ${t.accent} 0%, transparent 60%), ${t.bg_color}` };
  }
  if (t.bg === 'gradient') return { background: `linear-gradient(160deg, ${t.bg_color}, ${t.bg_color2})` };
  if (t.bg === 'solid') return { background: t.bg_color };
  return { background: t.mode === 'dark' ? '#121316' : '#FBF8F2' };
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
// Three-word summary of what makes a preset distinct.
function presetTags(t) {
  const bits = [t.mode === 'dark' ? 'Dark' : 'Light'];
  if (t.overlay && t.overlay !== 'none') bits.push(cap(t.overlay));
  if (t.name_fx && t.name_fx !== 'none') bits.push(cap(t.name_fx));
  if (t.tilt_enabled) bits.push('Tilt');
  if (t.glow_intensity >= 24) bits.push('Glow');
  return bits.slice(0, 3).join(' · ');
}

// ── Small reusable controls ───────────────────────────────────────────────────
function Panel({ icon: Icon, title, soon, children }) {
  return (
    <section className={`std-panel${soon ? ' std-panel-soon' : ''}`}>
      <div className="std-panel-head">
        <span className="std-panel-icon"><Icon size={16} strokeWidth={2.2} /></span>
        <h2 className="std-panel-title">{title}</h2>
        {soon && <span className="std-soon">Soon</span>}
      </div>
      {children}
    </section>
  );
}
function Field({ label, children }) {
  return <div className="std-field"><span className="std-flabel">{label}</span>{children}</div>;
}
function Seg({ value, onChange, options }) {
  return (
    <div className="std-seg">
      {options.map(o => (
        <button key={o.v} className={value === o.v ? 'on' : ''} onClick={() => onChange(o.v)}>{o.label}</button>
      ))}
    </div>
  );
}
function Slider({ value, min, max, step = 1, suffix = '', onChange }) {
  return (
    <div className="std-slider">
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} />
      <span className="std-slider-val">{value}{suffix}</span>
    </div>
  );
}
function Toggle({ on, onChange, label, hint }) {
  return (
    <button className={`std-toggle-row${on ? ' on' : ''}`} onClick={() => onChange(!on)}>
      <span className="std-toggle-txt"><span className="std-toggle-label">{label}</span>{hint && <span className="std-toggle-hint">{hint}</span>}</span>
      <span className="std-toggle"><span className="std-toggle-knob" /></span>
    </button>
  );
}

// Multi-select. Deliberately NOT <Seg>, which is one-of-N — these are five
// independent on/off answers, and a segmented control would imply they're
// exclusive. Each chip carries its own checked state.
function Chips({ value, onChange, options, allLabel }) {
  const set = new Set(Array.isArray(value) ? value : options.map(o => o.id));
  const flip = (id) => {
    const next = new Set(set);
    next.has(id) ? next.delete(id) : next.add(id);
    onChange(options.filter(o => next.has(o.id)).map(o => o.id));
  };
  return (
    <div className="std-chips">
      {options.map(o => (
        <button key={o.id} className={`std-chip${set.has(o.id) ? ' on' : ''}`}
          onClick={() => flip(o.id)} aria-pressed={set.has(o.id)}>
          {set.has(o.id) ? <Check size={12} strokeWidth={3} /> : <span className="std-chipdot" />}
          {o.label}
        </button>
      ))}
      {allLabel && set.size < options.length && (
        <button className="std-chipall" onClick={() => onChange(options.map(o => o.id))}>{allLabel}</button>
      )}
    </div>
  );
}

// ── Live preview — a faithful mini-storefront that reflects the draft theme ────
// One block's links, at preview scale. Deliberately NOT a reuse of LinkBlock:
// that component carries its own full-size stylesheet, and dropping it into a
// ~65%-scale phone frame would render at the wrong size while overriding the
// preview's own CSS. This mirrors the SHAPE — style, colours, title — which is
// what the controls actually change.
// Preview mirrors of the page's link geometry. Kept as literals rather than
// imported from Storefront.jsx because the preview is deliberately decoupled
// from the live renderer (see note 180 §8) — but the VALUES must match, so if
// one changes, change both.
const LP_LINK_RADIUS = { rounded: '14px', oval: '999px', sharp: '4px', full: '0px' };

// The preview frame is ~65% of the live page, so every glow length is too.
// Rewriting --sf-* to --lp-* keeps ONE source of truth for which targets are
// on: the same glowVars the live page calls.
function scaleGlow(vars, factor) {
  const out = {};
  for (const [k, v] of Object.entries(vars)) {
    const px = parseFloat(v) || 0;
    out[k.replace('--sf-', '--lp-')] = `${px * factor}px`;
  }
  return out;
}

// Emits only the featured_* keys that are set; everything else falls through
// to the --lp-link-* vars on the preview root. Same cascade as the live page.
function lpFeaturedVars(theme) {
  const v = {};
  const fill = theme.featured_link_color;
  const op = theme.featured_link_opacity ?? theme.link_opacity ?? theme.product_opacity ?? 100;
  if (fill) v['--lp-link-bg'] = `color-mix(in srgb, ${fill} ${op}%, transparent)`;
  if (theme.featured_link_text_color) v['--lp-link-fg'] = theme.featured_link_text_color;
  if (theme.featured_link_shape) v['--lp-link-radius'] = LP_LINK_RADIUS[theme.featured_link_shape] ?? LP_LINK_RADIUS.oval;
  return v;
}

function PreviewLinkGroup({ block, items, featured }) {
  const layout = resolveBlockLayout(block.layout);
  // '' means inherit, so the var must not be emitted at all — an empty default
  // that IS a value would silently override every level above it.
  const shapeRadius = layout.shape ? LINK_SHAPES.find(x => x.id === layout.shape)?.radius : null;
  const style = {
    '--lpb-cols': layout.columns || 2,
    ...(shapeRadius ? { '--lpb-shape': shapeRadius } : null),
    ...(layout.bg ? { '--lpb-bg': layout.bg } : null),
    ...(layout.fg ? { '--lpb-fg': layout.fg } : null),
    ...(layout.headingColor ? { '--lpb-head': layout.headingColor } : null),
  };
  return (
    <div className={[
      'lpb', `lpb-${layout.style}`, `lpb-size-${layout.size}`, `lpb-align-${layout.align}`,
      layout.outline ? 'lpb-outline' : '', layout.shadow ? 'lpb-shadow' : '',
      featured ? 'lpb-featured' : '',
    ].filter(Boolean).join(' ')} style={style}>
      {block.title?.trim() && <span className="lpb-title">{block.title}</span>}
      {block.subtitle?.trim() && <span className="lpb-sub">{block.subtitle}</span>}
      <div className="lpb-items">
        {items.slice(0, 4).map(l => (
          <div key={l.id} className={`lpb-item${l.cover_url ? '' : ' lpb-noimg'}`}>
            {/* Same two-part shape as the live card: a row, then a button that
                spans the whole thing. */}
            <span className="lpb-main">
              {l.cover_url && <span className="lpb-thumb" style={{ backgroundImage: `url(${l.cover_url})` }} />}
              <span className="lpb-txt">
                <span className="lpb-label">{l.label || 'Link'}</span>
                {l.description && <span className="lpb-desc">{l.description}</span>}
              </span>
            </span>
            {l.cta_label?.trim() && <span className="lpb-cta">{l.cta_label}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function LivePreview({ theme, name, handle, avatar, bio, location, socials, skills, links, blocks }) {
  // Mirrors Storefront.jsx exactly — if the preview ignored glow_enabled the
  // toggle would look like it did nothing until you opened the live page.
  const glowOn = theme.glow_enabled !== false;

  // Same split as the live page: profile links stay in the card, featured ones
  // move out above the products. Grouped by block so each carries its own
  // layout and colours.
  const withUrl = (links || []).filter(l => l.url && l.visible !== false);
  // Placement is the BLOCK's (033), not the link's — same rule as the live
  // page, so the preview can't imply a split the page doesn't make.
  const groupsFor = (placement) => (blocks || [])
    .filter(b => b.visible && (b.placement || 'profile') === placement)
    .map(b => ({ block: b, items: withUrl.filter(l => l.block_id === b.id) }))
    .filter(g => g.items.length > 0);
  const profileGroups = groupsFor('profile');
  const featuredGroups = groupsFor('featured');
  // Links predating blocks still render, as plain profile buttons.
  const orphanLinks = withUrl.filter(l => !l.block_id);
  if (orphanLinks.length) profileGroups.push({ block: { id: '__none__', layout: {} }, items: orphanLinks });
  // Same static approximation as the editor swatch. The preview frame is small
  // and always on screen while you scrub sliders; eight animated layers there
  // would fight the thing you are actually adjusting.
  const animatedBg = theme.bg === 'animated'
    ? { background: `radial-gradient(60% 70% at 22% 24%, ${theme.bg_color2 || theme.accent} 0%, transparent 62%),`
        + ` radial-gradient(58% 66% at 78% 74%, ${theme.accent} 0%, transparent 60%), ${theme.bg_color}` }
    : null;
  const bgStyle = animatedBg ??
    theme.bg === 'solid' ? { background: theme.bg_color } :
    theme.bg === 'gradient' ? { background: `linear-gradient(160deg, ${theme.bg_color}, ${theme.bg_color2})` } :
    (theme.bg === 'image' && theme.bg_image) ? { backgroundImage: `url(${theme.bg_image})`, backgroundSize: 'cover', backgroundPosition: 'center' } :
    undefined;
  const cls = [
    'lp', `lp-mode-${theme.mode}`, `lp-btn-${theme.button_style}`, `lp-glow-${theme.product_glow || 'none'}`,
    theme.mono_icons ? 'lp-mono' : '', glowOn && theme.animated_name ? 'lp-anim' : '',
    theme.name_fx && theme.name_fx !== 'none' ? `lp-fx-${theme.name_fx}` : '',
  ].filter(Boolean).join(' ');
  const style = {
    '--accent': theme.accent,
    '--lp-card-bg': `color-mix(in srgb, ${theme.card_color || 'var(--lp-surface)'} ${theme.card_opacity ?? 100}%, transparent)`,
    '--lp-card-blur': `${theme.card_blur ?? 0}px`,
    '--lp-item-bg': `color-mix(in srgb, ${theme.item_color || 'var(--lp-surface)'} ${theme.product_opacity ?? 100}%, transparent)`,
    '--lp-link-bg': theme.link_color
      ? `color-mix(in srgb, ${theme.link_color} ${theme.link_opacity ?? theme.product_opacity ?? 100}%, transparent)`
      : `color-mix(in srgb, var(--lp-accent, var(--accent)) 10%, var(--lp-surface))`,
    ...(theme.link_text_color ? { '--lp-link-fg': theme.link_text_color } : null),
    '--lp-link-radius': LP_LINK_RADIUS[theme.link_shape] ?? LP_LINK_RADIUS.oval,
    '--lp-item-blur': `${theme.product_blur ?? 0}px`,
    '--lp-avatar-size': `${Math.round((theme.avatar_size ?? 96) * 0.7)}px`, // preview is ~70% scale
    '--lp-avatar-radius': theme.avatar_shape === 'square' ? '14%' : theme.avatar_shape === 'rounded' ? '26%' : '50%',
    '--lp-bio-size': `${theme.bio_size ?? 15}px`,
    '--lp-bio-weight': theme.bio_weight ?? 400,
    '--lp-bio-glow': `${theme.bio_glow ?? 0}px`,
    '--lp-glow': glowOn ? `${(theme.glow_intensity ?? 0) * 0.65}px` : '0px',
    '--lp-glow-strong': glowOn ? `${(theme.glow_intensity ?? 0) * 1.4}px` : '0px',
    // Per-surface, scaled. glowVars returns the live-page pixel values, so each
    // is re-scaled to the preview here rather than duplicating the target logic.
    ...scaleGlow(glowVars(theme, glowOn), 0.65),
    // Cover-banner height at preview scale. Set here rather than in CSS so it
    // stays next to the other preview-scale factors — 150 is ~0.5 of the live
    // 300px, matching the preview frame's own reduction.
    '--lp-cover-h': '150px',
  };
  if (theme.text_color) style['--lp-text'] = theme.text_color;
  if (theme.title_color) style['--lp-title'] = theme.title_color;
  const shown = (skills || []).filter(s => s.status === 'published').slice(0, 2);

  return (
    <div className={cls} style={style}>
      <div className="lp-bg" style={bgStyle} />
      {theme.bg === 'video' && theme.bg_video && (
        <video className="lp-bgvideo" src={theme.bg_video} autoPlay muted loop playsInline aria-hidden="true" />
      )}
      {theme.overlay && theme.overlay !== 'none' && <div className={`lp-overlay lp-overlay-${theme.overlay}`} aria-hidden="true" />}
      {/* Cursor FX (cursor_fx) intentionally NOT simulated in the preview — control only. */}
      {theme.audio_tracks?.length > 0 && <span className="lp-audiopill" aria-hidden="true"><Music size={11} /></span>}
      {/* Cover banner mirrors the live page: outside the card, full width, faded
          at the bottom. Same mask technique, scaled to the preview. */}
      {theme.banner_url && theme.banner_style === 'cover' && (
        <div className="lp-coverbanner" style={{ backgroundImage: `url(${theme.banner_url})` }} aria-hidden="true" />
      )}
      <div className={`lp-inner${theme.banner_url && theme.banner_style !== 'cover' ? ' lp-hasbanner' : ''}${theme.banner_url && theme.banner_style === 'cover' ? ' lp-inner-cover' : ''}${theme.card_opacity === 0 ? ' lp-ghost' : ''}${theme.profile_fx && theme.profile_fx !== 'none' ? ` lp-pfx-${theme.profile_fx}` : ''}`}>
        {theme.banner_url && theme.banner_style !== 'cover' && (
          <div className="lp-panelbanner" style={{ backgroundImage: `url(${theme.banner_url})` }} />
        )}
        {theme.show_avatar !== false && <div className="lp-avatar" style={avatar ? { backgroundImage: `url(${avatar})` } : {}}>{!avatar && initials(name)}</div>}
        <div className="lp-name" style={theme.name_color && (!theme.name_fx || theme.name_fx === 'none') ? { color: theme.name_color } : undefined}>{name}</div>
        <div className="lp-handle">@{handle}</div>
        {location && <div className="lp-location"><MapPin size={11} strokeWidth={2.4} />{location}</div>}
        {bio && <div className="lp-bio">{bio}</div>}
        {(socials || []).filter(s => s.url).length > 0 && (
          <div className="lp-socials">
            {(socials || []).filter(s => s.url).map((s, i) => <span key={i} className="lp-social"><BrandIcon type={s.type} size={20} /></span>)}
          </div>
        )}
        {/* PROFILE links, grouped by block so each shows its own layout and
            colours. Previously this was one flat list, which meant the entire
            Layouts tab had no live feedback — the thing note 175 argued is
            worse than having no preview at all. */}
        {profileGroups.map(g => (
          <PreviewLinkGroup key={g.block.id} block={g.block} items={g.items} />
        ))}
      </div>
      {/* FEATURED links — outside the card, above products, matching the live
          page's ordering so the preview doesn't imply a different layout. */}
      {featuredGroups.length > 0 && (
        <div className="lp-featured" style={lpFeaturedVars(theme)}>
          {featuredGroups.map(g => (
            <PreviewLinkGroup key={g.block.id} block={g.block} items={g.items} featured />
          ))}
        </div>
      )}

      <div className={`lp-list${theme.layout === 'grid' ? ' lp-grid' : ''}`}>
          {shown.length === 0 && <div className="lp-card lp-empty">Your products appear here</div>}
          {shown.map(s => (
            <div key={s.id} className="lp-card">
              <div className="lp-cover" style={s.cover_url ? { backgroundImage: `url(${s.cover_url})` } : {}} />
              <div className="lp-card-body"><div className="lp-card-title">{s.title || 'Untitled'}</div><div className="lp-price">{s.price_cents ? `$${(s.price_cents / 100).toFixed(2)}` : 'Free'}</div></div>
            </div>
          ))}
        </div>
    </div>
  );
}

// ── Studio ────────────────────────────────────────────────────────────────────
export default function StorefrontEditor() {
  const user = useUser();
  const { confirm } = useDialog();
  const profile = useProfile();
  const { setProfile } = useAuth();

  const [bio, setBio] = useState('');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');   // public storefront field, not a Settings/private one
  const [avatarUrl, setAvatarUrl] = useState('');
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [theme, setTheme] = useState(resolveTheme());
  const [pixels, setPixels] = useState({ meta: '', tiktok: '', ga4: '' });
  const [webhookUrl, setWebhookUrl] = useState('');
  const [skills, setSkills] = useState([]);
  const [links, setLinks] = useState([]);
  const [blocks, setBlocks] = useState([]);
  // Templates saved from real pages (migration 034), merged into the same
  // picker as the hand-authored presets.
  const [savedTpls, setSavedTpls] = useState([]);
  const [tplForm, setTplForm] = useState({ name: '', blurb: '', category: 'showcase', emoji: '🎨', includeAudio: true });
  const [tplBusy, setTplBusy] = useState(false);
  const [tplMsg, setTplMsg] = useState(null);
  const [savingBanner, setSavingBanner] = useState(false);
  const [savingBg, setSavingBg] = useState(false);
  const [savingBgVideo, setSavingBgVideo] = useState(false);
  const [savingAudio, setSavingAudio] = useState(false);
  const [savingCursor, setSavingCursor] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState('');
  // Section comes from the URL, not state. The sidebar's "My Page" group links
  // directly to each one (see Header.jsx), so this component no longer owns the
  // switcher at all — it just renders whichever section the route names.
  const { pathname } = useLocation();
  const subTab = pathname.endsWith('/templates') ? 'themes'
    : pathname.endsWith('/links') ? 'links'
    : 'customize';
  const [musicOpen, setMusicOpen] = useState(false); // site-music modal
  const [dragId, setDragId] = useState(null);       // id of the product being dragged
  const [dragOver, setDragOver] = useState(null);   // section key currently hovered
  const [extraSections, setExtraSections] = useState([]); // named but still empty (no products yet)

  useEffect(() => {
    if (!profile) return;
    setBio(profile.bio ?? '');
    setName(profile.full_name ?? '');
    setLocation(profile.location ?? '');
    setAvatarUrl(profile.avatar_url ?? '');
    setTheme(resolveTheme(profile.storefront_theme));
    setPixels({ meta: '', tiktok: '', ga4: '', ...(profile.tracking_pixels || {}) });
    setWebhookUrl(profile.automation_webhook_url ?? '');
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    listMySkills(user.id).then(s => setSkills(s.filter(x => x.status === 'published'))).catch(() => {});
    listLinks(user.id).then(setLinks).catch(() => {});
    listBlocks(user.id).then(setBlocks).catch(() => {});
    listTemplates().then(setSavedTpls);
  }, [user]);

  if (!user || !profile) return <div className="std-loading">Loading…<Styles /></div>;

  const set = (patch) => setTheme(t => ({ ...t, ...patch }));

  async function save() {
    setErr('');
    const tp = Object.fromEntries(Object.entries(pixels).filter(([, v]) => v && v.trim()));
    // Keep the legacy single audio_url pointed at the first track for back-compat.
    const tracks = theme.audio_tracks || [];
    const themeToSave = { ...theme, audio_tracks: tracks, audio_url: tracks[0]?.url || '' };
    const patch = {
      bio: bio.trim(), storefront_theme: themeToSave,
      full_name: name.trim() || profile.full_name,
      location: location.trim() || null,
      avatar_url: avatarUrl || null,
      tracking_pixels: Object.keys(tp).length ? tp : null,
      automation_webhook_url: webhookUrl.trim() || null,
    };
    try {
      await updateStorefront(user.id, patch);
      setProfile({ ...profile, ...patch });
      setSaved(true); setTimeout(() => setSaved(false), 1600);
    } catch (e) { setErr(e.message); }
  }

  // Every storefront upload funnels through here, so the size/type gate goes in
  // ONE place — each caller just names which rule in LIMITS applies to it.
  // These five were previously unguarded: any size, any type.
  async function uploadTo(file, setBusy, apply, uploader = uploadBanner, kind = 'banner') {
    if (!file) return;
    const check = validateUpload(kind, file);
    if (!check.ok) { setErr(check.error); return; }
    setErr('');
    setBusy(true);
    try { const url = await uploader(user.id, file); apply(url); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }
  const onBanner = (e) => uploadTo(e.target.files?.[0], setSavingBanner, (url) => set({ banner_url: url }), uploadBanner, 'banner');
  const onBgImage = (e) => uploadTo(e.target.files?.[0], setSavingBg, (url) => set({ bg_image: url, bg: 'image' }), uploadBanner, 'bgImage');
  const onCursor = (e) => uploadTo(e.target.files?.[0], setSavingCursor, (url) => set({ cursor_url: url }), uploadBanner, 'cursor');
  const onAvatar = (e) => uploadTo(e.target.files?.[0], setSavingAvatar, (url) => setAvatarUrl(url), uploadBanner, 'avatar');
  const onBgVideo = (e) => uploadTo(e.target.files?.[0], setSavingBgVideo, (url) => set({ bg_video: url, bg: 'video' }), uploadBgVideo, 'bgVideo');

  // Site music is a playlist — each upload APPENDS a track (keep the filename as its label).
  async function onAudioAdd(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Has its own path (it appends to a playlist rather than replacing a value),
    // so it needs the gate applied separately from uploadTo.
    // Cap checked BEFORE the upload — no point spending a round trip and a
    // storage object on a track that can't be added.
    if ((theme.audio_tracks || []).length >= MAX_AUDIO_TRACKS) {
      setErr(`Playlist is full — ${MAX_AUDIO_TRACKS} tracks max. Remove one first.`);
      if (e.target) e.target.value = '';
      return;
    }
    const check = validateUpload('audio', file);
    if (!check.ok) { setErr(check.error); if (e.target) e.target.value = ''; return; }
    setErr('');
    setSavingAudio(true);
    try {
      const url = await uploadAudio(user.id, file);
      const name = file.name.replace(/\.[^.]+$/, '');
      setTheme(t => ({ ...t, audio_tracks: [...(t.audio_tracks || []), { url, name }] }));
    } catch (err) { setErr(err.message); }
    finally { setSavingAudio(false); if (e.target) e.target.value = ''; } // reset so the same file can be re-added
  }
  function removeTrack(i) { setTheme(t => ({ ...t, audio_tracks: (t.audio_tracks || []).filter((_, j) => j !== i) })); }
  // Playlist order IS play order on the storefront, and track 1 is also what the
  // legacy `audio_url` back-compat field points at (see save()), so moving a
  // track to the top genuinely changes what a visitor hears first.
  function moveTrack(i, dir) {
    setTheme(t => {
      const tracks = [...(t.audio_tracks || [])];
      const j = i + dir;
      if (j < 0 || j >= tracks.length) return t;
      [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
      return { ...t, audio_tracks: tracks };
    });
  }

  // ── Templates: presets + import/export ───────────────────────────────────
  // Presets MERGE over the current theme, so name/bio/avatar/socials/links and
  // uploaded assets survive — a preset only restyles.
  function applyPreset(p) { setTheme(t => ({ ...t, ...p.theme })); setErr(''); }

  const isAdmin = user?.email === ADMIN_EMAIL;

  // Saves the theme AS ALREADY PERSISTED, not the unsaved draft — the backend
  // reads storefront_theme from the profile row. So an unsaved tweak would be
  // silently left out, which is worse than refusing.
  async function onSaveTemplate() {
    if (!tplForm.name.trim()) { setTplMsg({ bad: true, text: 'Give it a name first.' }); return; }
    setTplBusy(true); setTplMsg(null);
    try {
      // Persist first. The backend cuts the template from storefront_theme in
      // the profile row, so an unsaved tweak would be silently missing from the
      // template — the kind of gap you would not notice until someone applied it.
      await save();
      const { assetCount, bytes } = await saveTemplate(tplForm);
      setSavedTpls(await listTemplates());
      setTplForm(f => ({ ...f, name: '', blurb: '' }));
      setTplMsg({ text: assetCount
        ? `Saved — ${assetCount} asset${assetCount === 1 ? '' : 's'} copied (${(bytes / 1048576).toFixed(1)}MB).`
        : 'Saved. No uploaded assets on this look, so nothing to copy.' });
    } catch (e) {
      setTplMsg({ bad: true, text: e.message });
    } finally { setTplBusy(false); }
  }

  async function onDeleteTemplate(t) {
    if (!(await confirm({
      title: `Delete "${t.name}"?`,
      message: 'Removes the template and its copied files. Pages already using this look keep it — they hold their own copy of the theme.',
      confirmLabel: 'Delete', danger: true,
    }))) return;
    try {
      await deleteTemplate(t.dbId);
      setSavedTpls(await listTemplates());
    } catch (e) { setTplMsg({ bad: true, text: e.message }); }
  }

  function exportTheme() {
    // portableTheme() drops socials/music/uploads — look only, so the file is
    // safe to share and can't hotlink this creator's storage.
    const blob = new Blob([JSON.stringify(portableTheme(theme), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `skilljoy-theme-${profile.username || 'me'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onImportTheme(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const clean = sanitizeThemeImport(JSON.parse(await file.text()));
      if (Object.keys(clean).length === 0) throw new Error('no recognizable theme settings in that file');
      setTheme(t => ({ ...t, ...clean }));
      setErr('');
    } catch (err) {
      setErr(`Import failed — ${err.message}`);
    } finally { if (e.target) e.target.value = ''; }
  }

  function setSocial(i, patch) { setTheme(t => ({ ...t, socials: t.socials.map((s, j) => j === i ? { ...s, ...patch } : s) })); }
  function addSocial(type = 'instagram') { setTheme(t => ({ ...t, socials: [...(t.socials || []), { type, url: '' }] })); }
  function removeSocial(i) { setTheme(t => ({ ...t, socials: t.socials.filter((_, j) => j !== i) })); }

  // The block editor writes links directly; this refreshes the copy that feeds
  // the live preview so the two never disagree.
  // Reloads BOTH — the preview renders links through their block, so a block
  // edit with stale block data would show the old layout.
  const reloadLinks = () => {
    listLinks(user.id).then(setLinks).catch(() => {});
    listBlocks(user.id).then(setBlocks).catch(() => {});
  };

  // (createLink / patchLinkLocal / saveLink / onLinkCover / removeLinkRow lived
  // here for the old flat link panel. LinkBlockEditor owns link writes now.)

  // ── Sections ──────────────────────────────────────────────────────────────
  // A "section" is just a distinct `group_label` across the creator's products —
  // there's no sections table. Renaming one re-labels every product in it;
  // moving a product between sections rewrites that product's label. Section
  // ORDER is derived from product order (first-seen), exactly like the public
  // storefront buckets them, so the editor can never disagree with the page.
  const lbl = (s) => (s.group_label || '').trim();
  const sections = (() => {
    const map = new Map();
    for (const s of skills) { const k = lbl(s); if (!map.has(k)) map.set(k, []); map.get(k).push(s); }
    for (const name of extraSections) if (!map.has(name)) map.set(name, []);
    return [...map.entries()].map(([label, items]) => ({ label, items }));
  })();

  /** Move a product into `targetLabel`, optionally before `beforeId`. Persists label + order. */
  async function moveSkillTo(skillId, targetLabel, beforeId = null) {
    const moving = skills.find(s => s.id === skillId);
    if (!moving) return;
    const rest = skills.filter(s => s.id !== skillId);
    const updated = { ...moving, group_label: targetLabel };
    let next;
    if (beforeId && beforeId !== skillId) {
      const at = rest.findIndex(s => s.id === beforeId);
      next = at < 0 ? [...rest, updated] : [...rest.slice(0, at), updated, ...rest.slice(at)];
    } else {
      // No anchor → append after the section's current last item (keeps sections contiguous).
      const last = rest.map(lbl).lastIndexOf(targetLabel);
      next = last < 0 ? [...rest, updated] : [...rest.slice(0, last + 1), updated, ...rest.slice(last + 1)];
    }
    setSkills(next);
    setExtraSections(xs => xs.filter(x => x !== targetLabel)); // it has a product now — no longer "empty"
    try {
      if (lbl(moving) !== targetLabel) await updateSkill(skillId, { group_label: targetLabel || null });
      await reorderSkills(next.map(s => s.id));
    } catch (e) { setErr(e.message); }
  }

  async function renameSection(oldLabel, raw) {
    const next = raw.trim();
    if (next === oldLabel) return;
    const affected = skills.filter(s => lbl(s) === oldLabel);
    setSkills(ss => ss.map(s => (lbl(s) === oldLabel ? { ...s, group_label: next } : s)));
    setExtraSections(xs => xs.map(x => (x === oldLabel ? next : x)));
    try { await Promise.all(affected.map(s => updateSkill(s.id, { group_label: next || null }))); }
    catch (e) { setErr(e.message); }
  }

  /** Remove the heading — products drop into Ungrouped, nothing is deleted. */
  async function deleteSection(label) {
    const affected = skills.filter(s => lbl(s) === label);
    setSkills(ss => ss.map(s => (lbl(s) === label ? { ...s, group_label: '' } : s)));
    setExtraSections(xs => xs.filter(x => x !== label));
    try { await Promise.all(affected.map(s => updateSkill(s.id, { group_label: null }))); }
    catch (e) { setErr(e.message); }
  }

  function addSection() {
    const taken = new Set(sections.map(s => s.label));
    let name = 'New section', n = 2;
    while (taken.has(name)) name = `New section ${n++}`;
    setExtraSections(xs => [...xs, name]);
  }

  /** Keyboard/touch fallback for ordering (drag isn't reachable on either). */
  async function nudge(skillId, dir) {
    const i = skills.findIndex(s => s.id === skillId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= skills.length) return;
    const next = [...skills];
    [next[i], next[j]] = [next[j], next[i]];
    setSkills(next);
    try { await reorderSkills(next.map(s => s.id)); } catch (e) { setErr(e.message); }
  }

  return (
    <div className="std">
      <title>Customize — SkillJoy</title>
      <div className="std-bgfx" aria-hidden="true" />

      {/* ── Top header ── */}
      {/* Top bar is now ACTIONS ONLY. Section nav moved to the left rail below —
          Customize is a long scrolling column, and a horizontal tab row above it
          means the way out of that column scrolls off the top. A rail stays put. */}
      {/* Section tabs live here AND in the sidebar's "My Page" group. That's
          deliberate duplication, not an oversight: the sidebar is app-wide
          wayfinding, these are the sections of the page you're already on, and
          reaching the sidebar means moving away from the work. Both point at
          the same ROUTES, so they can't disagree about what's selected. */}
      <header className="std-top">
        <nav className="std-top-tabs">
          {[
            { to: '/storefront/edit', id: 'customize', icon: Palette, label: 'Customize' },
            { to: '/storefront/links', id: 'links', icon: Link2, label: 'Links' },
            { to: '/storefront/templates', id: 'themes', icon: Layers, label: 'Templates' },
          ].map(t => {
            const Icon = t.icon;
            return (
              <Link key={t.id} to={t.to} className={`std-tab${subTab === t.id ? ' on' : ''}`}
                aria-current={subTab === t.id ? 'page' : undefined}>
                <Icon size={15} /> {t.label}
              </Link>
            );
          })}
        </nav>
        <div className="std-top-actions">
          {profile.username && <Link to={`/@${profile.username}`} className="std-ghost"><ExternalLink size={15} /> View live</Link>}
          <button className="std-save" onClick={save}>{saved ? <><Check size={15} /> Saved</> : 'Save changes'}</button>
        </div>
      </header>
      {err && <p className="std-err">{err}</p>}

      <div className="std-body">
        {/* No section switcher here any more — it lives in the app sidebar under
            "My Page" (Header.jsx). One nav, one place, and each section is a
            real URL. */}

        {/* ── Main controls ── */}
        <main className="std-main">
          <div className="std-mainhead">{SUBTAB_HEADS[subTab]}</div>
          {subTab === 'customize' && (
            <>
              {/* ── PROFILE — who you are: picture, name, bio, and the profile card itself ── */}
              <Panel icon={User} title="Profile">
                <Field label="Profile picture">
                  <div className="std-avatarrow">
                    <div className="std-avatar" style={{ ...(avatarUrl ? { backgroundImage: `url(${avatarUrl})` } : {}), borderRadius: theme.avatar_shape === 'square' ? '14%' : theme.avatar_shape === 'rounded' ? '26%' : '50%' }}>{!avatarUrl && (name ? name[0] : '?')}</div>
                    <label className="std-addbtn">
                      <input type="file" accept="image/*" hidden onChange={onAvatar} />
                      {savingAvatar ? 'Uploading…' : <><Camera size={14} /> {avatarUrl ? 'Change' : 'Upload'}</>}
                    </label>
                    {avatarUrl && <button className="std-removebtn" onClick={() => setAvatarUrl('')}><X size={13} /> Remove</button>}
                  </div>
                </Field>
                <Toggle on={theme.show_avatar !== false} onChange={v => set({ show_avatar: v })} label="Show profile picture" hint="Hide it to lead with your name" />
                {theme.show_avatar !== false && (
                  <>
                    <Field label="Picture shape"><Seg value={theme.avatar_shape || 'circle'} onChange={v => set({ avatar_shape: v })} options={[{ v: 'circle', label: 'Circle' }, { v: 'rounded', label: 'Rounded' }, { v: 'square', label: 'Square' }]} /></Field>
                    <Field label="Picture size"><Slider value={theme.avatar_size ?? 96} min={64} max={160} suffix="px" onChange={v => set({ avatar_size: v })} /></Field>
                  </>
                )}
                <Field label="Display name">
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" />
                </Field>
                <Field label="Location">
                  <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Austin, TX" maxLength={60} />
                  <p className="std-note">Public — shows under your name. Leave blank to hide it.</p>
                </Field>
                <Field label="Bio">
                  <textarea rows={3} value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell visitors what you offer…" />
                </Field>
                <Field label="Bio size"><Slider value={theme.bio_size ?? 15} min={11} max={25} suffix="px" onChange={v => set({ bio_size: v })} /></Field>
                <Field label="Bio weight"><Slider value={theme.bio_weight ?? 400} min={300} max={800} step={100} onChange={v => set({ bio_weight: v })} /></Field>
                <Field label="Bio glow"><Slider value={theme.bio_glow ?? 0} min={0} max={20} suffix="px" onChange={v => set({ bio_glow: v })} /></Field>
                <p className="std-note">Size, boldness &amp; accent glow for your bio.</p>
                <Field label="Profile card colour">
                  <div className="std-colorrow">
                    <input type="color" value={theme.card_color || (theme.mode === 'dark' ? '#191B1F' : '#FFFFFF')}
                      onChange={e => set({ card_color: e.target.value })} />
                    <span>{theme.card_color || 'Theme surface'}</span>
                    {theme.card_color && (
                      <button className="std-removebtn" onClick={() => set({ card_color: '' })}><X size={13} /> Reset</button>
                    )}
                  </div>
                  <p className="std-note" style={{ marginTop: 6 }}>
                    {theme.card_color
                      ? 'Fixed colour — it no longer follows light/dark mode, so check both.'
                      : 'Following your theme surface, which adapts to light and dark.'}
                  </p>
                </Field>
                <Field label="Profile card opacity"><Slider value={theme.card_opacity ?? 100} min={0} max={100} suffix="%" onChange={v => set({ card_opacity: v })} /></Field>
                <Field label="Profile card blur (glass)"><Slider value={theme.card_blur ?? 0} min={0} max={24} suffix="px" onChange={v => set({ card_blur: v })} /></Field>
                <Field label="Profile card motion"><Seg value={theme.profile_fx || 'none'} onChange={v => set({ profile_fx: v })} options={[{ v: 'none', label: 'None' }, { v: 'glow', label: 'Glow' }, { v: 'float', label: 'Float' }]} /></Field>
                <Toggle on={!!theme.tilt_enabled} onChange={v => set({ tilt_enabled: v })} label="3D tilt" hint="Card leans toward the visitor’s cursor" />
                {theme.tilt_enabled && (
                  <Field label="Tilt strength"><Slider value={theme.tilt_max ?? 10} min={2} max={20} suffix="°" onChange={v => set({ tilt_max: v })} /></Field>
                )}
                <p className="std-note">Lower opacity + more blur = frosted glass over your background.</p>
                <p className="std-note">Your handle: skilljoy.me/@{profile.username}</p>
              </Panel>

              {/* ── BACKGROUND — the canvas behind everything ── */}
              <Panel icon={ImageIcon} title="Background">
                <Field label="Background type">
                  <Seg value={theme.bg} onChange={v => set({ bg: v })} options={[{ v: 'canvas', label: 'Canvas' }, { v: 'solid', label: 'Solid' }, { v: 'gradient', label: 'Gradient' }, { v: 'image', label: 'Image' }, { v: 'video', label: 'Video' }]} />
                </Field>
                {theme.bg === 'solid' && <div className="std-colorrow"><input type="color" value={theme.bg_color} onChange={e => set({ bg_color: e.target.value })} /><span>{theme.bg_color}</span></div>}
                {theme.bg === 'gradient' && <div className="std-colorrow"><input type="color" value={theme.bg_color} onChange={e => set({ bg_color: e.target.value })} /><span>→</span><input type="color" value={theme.bg_color2} onChange={e => set({ bg_color2: e.target.value })} /></div>}
                {theme.bg === 'image' && (
                  <>
                    <label className="std-upload" style={theme.bg_image ? { backgroundImage: `url(${theme.bg_image})` } : {}}>
                      <input type="file" accept="image/*" hidden onChange={onBgImage} />
                      <span>{savingBg ? 'Uploading…' : <><ImagePlus size={15} /> {theme.bg_image ? 'Change image' : 'Upload image'}</>}</span>
                    </label>
                    {theme.bg_image && <button className="std-removebtn" onClick={() => set({ bg_image: '' })}><X size={13} /> Remove background</button>}
                  </>
                )}
                {theme.bg === 'video' && (
                  <>
                    <label className="std-upload">
                      <input type="file" accept="video/*" hidden onChange={onBgVideo} />
                      <span>{savingBgVideo ? 'Uploading…' : <><Video size={15} /> {theme.bg_video ? 'Change video' : 'Upload video'}</>}</span>
                    </label>
                    <p className="std-note">Max {formatBytes(LIMITS.bgVideo.max)} — but keep it well under that, big files load slowly on phones.</p>
                    {theme.bg_video && <button className="std-removebtn" onClick={() => set({ bg_video: '' })}><X size={13} /> Remove video</button>}
                  </>
                )}
                <Field label="Banner">
                  <label className="std-upload std-upload-wide" style={theme.banner_url ? { backgroundImage: `url(${theme.banner_url})` } : {}}>
                    <input type="file" accept="image/*" hidden onChange={onBanner} />
                    <span>{savingBanner ? 'Uploading…' : <><ImagePlus size={15} /> {theme.banner_url ? 'Change banner' : 'Add banner'}</>}</span>
                  </label>
                  {theme.banner_url && <button className="std-removebtn" onClick={() => set({ banner_url: '' })}><X size={13} /> Remove banner</button>}
                </Field>
                {/* Only meaningful once a banner exists — showing it on an empty
                    banner would be a control with no visible effect. */}
                {theme.banner_url && (
                  <Field label="Banner style">
                    <Seg
                      value={theme.banner_style || 'panel'}
                      onChange={v => set({ banner_style: v })}
                      options={[{ v: 'panel', label: 'In card' }, { v: 'cover', label: 'Cover + fade' }]}
                    />
                    <p className="std-note" style={{ marginTop: 6 }}>
                      {(theme.banner_style || 'panel') === 'cover'
                        ? 'Spans the full width at the top of the page and fades out into your background.'
                        : 'A strip inside your profile card, clipped to its edges.'}
                    </p>
                  </Field>
                )}
              </Panel>

              {/* ── GENERAL — ambiance: background effects, music, cursor, glow ── */}
              <Panel icon={Sparkles} title="General">
                <Toggle on={!!theme.splash_enabled} onChange={v => set({ splash_enabled: v })} label="Click-to-enter splash" hint="A gate before your page — also lets your music autoplay" />
                {theme.splash_enabled && (
                  <Field label="Splash text">
                    <input value={theme.splash_text ?? ''} onChange={e => set({ splash_text: e.target.value })} placeholder="click to enter" maxLength={40} />
                  </Field>
                )}
                <Field label="Overlay effect"><Seg value={theme.overlay || 'none'} onChange={v => set({ overlay: v })} options={[{ v: 'none', label: 'None' }, { v: 'rain', label: 'Rain' }, { v: 'snow', label: 'Snow' }, { v: 'vhs', label: 'VHS' }, { v: 'stars', label: 'Stars' }, { v: 'particles', label: 'Particles' }, { v: 'matrix', label: 'Matrix' }]} /></Field>
                {/* One switch for the whole halo. The sliders stay mounted-but-hidden
                    rather than reset, so turning it back on restores the exact look. */}
                <Toggle
                  on={theme.glow_enabled !== false}
                  onChange={v => set({ glow_enabled: v })}
                  label="Glow effects"
                  hint="Accent halo on your name, icons, links and cards"
                />
                {theme.glow_enabled !== false && (
                  <div className="std-subgroup">
                    <Field label="Glow intensity"><Slider value={theme.glow_intensity ?? 0} min={0} max={80} suffix="px" onChange={v => set({ glow_intensity: v })} /></Field>
                    <p className="std-note">Master accent glow across your name, picture, card &amp; links.</p>
                    <Field label="Icon glow"><Slider value={theme.icon_glow ?? 10} min={0} max={60} suffix="px" onChange={v => set({ icon_glow: v })} /></Field>
                    <p className="std-note">Neon halo on every icon — socials, link buttons and block arrows. Crank it for a full burst, 0 to turn it off.</p>
                    {/* One slider used to light all five surfaces at once, so
                        tuning it for links also lit the name and avatar. Each
                        target collapses its own variable to 0 — nothing else
                        changes. */}
                    <Field label="Glow applies to">
                      <Chips value={theme.glow_targets} onChange={v => set({ glow_targets: v })}
                        options={GLOW_TARGETS} allLabel="Select all" />
                      <p className="std-note">Untick a surface to leave it flat while the rest still glow.</p>
                    </Field>
                    {/* Lives inside the group because it is ALSO a name glow and is
                        suppressed with the rest — outside, it would look broken. */}
                    <Toggle on={!!theme.animated_name} onChange={v => set({ animated_name: v })} label="Pulse the name" hint="Slow accent breathe on your display name" />
                  </div>
                )}
                <Field label="Name effect"><Seg value={theme.name_fx || 'none'} onChange={v => set({ name_fx: v })} options={[{ v: 'none', label: 'None' }, { v: 'gradient', label: 'Gradient' }, { v: 'rainbow', label: 'Rainbow' }, { v: 'shimmer', label: 'Shine' }, { v: 'glitch', label: 'Glitch' }]} /></Field>

                {/* Hidden while an effect owns the name: gradient/rainbow/shimmer
                    paint it with background-clip, so a solid colour underneath
                    does nothing. Offering a control that visibly can't work is
                    worse than not offering it. */}
                {(!theme.name_fx || theme.name_fx === 'none') && (
                  <Field label="Name colour">
                    <div className="std-colorrow">
                      <input
                        type="color"
                        value={theme.name_color || (theme.mode === 'dark' ? '#f2f0ea' : '#1a1916')}
                        onChange={e => set({ name_color: e.target.value })}
                      />
                      <span>{theme.name_color || 'Theme default'}</span>
                      {theme.name_color && (
                        <button className="std-removebtn" onClick={() => set({ name_color: '' })}>
                          <X size={13} /> Reset
                        </button>
                      )}
                    </div>
                    <p className="std-note" style={{ marginTop: 6 }}>
                      {theme.name_color
                        ? 'Fixed colour — it stays the same in light and dark mode, so check both.'
                        : 'Following your theme text colour, which adapts to light and dark.'}
                    </p>
                  </Field>
                )}
                <Toggle on={!!theme.mono_icons} onChange={v => set({ mono_icons: v })} label="Monochrome icons" hint="Grayscale social icons" />

                <Field label="Site music">
                  <button className="std-musicbtn" onClick={() => setMusicOpen(true)}>
                    <span className="std-musicbtn-l"><Music size={15} /> {theme.audio_tracks?.length ? `${theme.audio_tracks.length} track${theme.audio_tracks.length > 1 ? 's' : ''}` : 'Add music'}</span>
                    <span className="std-musicbtn-r">Manage</span>
                  </button>
                  <p className="std-note">Build a playlist — it plays on your storefront with a play/mute button. Max {formatBytes(LIMITS.audio.max)} per track.</p>
                </Field>

                <Field label="Cursor effect"><Seg value={theme.cursor_fx || 'none'} onChange={v => set({ cursor_fx: v })} options={[{ v: 'none', label: 'None' }, { v: 'trail', label: 'Trail' }, { v: 'sparkle', label: 'Sparkle' }]} /></Field>
                {theme.cursor_fx && theme.cursor_fx !== 'none' && (
                  <Field label="Effect color">
                    <div className="std-colorrow">
                      <input type="color" value={theme.cursor_fx_color || theme.accent} onChange={e => set({ cursor_fx_color: e.target.value })} />
                      <span>{theme.cursor_fx_color || 'Accent'}</span>
                      {theme.cursor_fx_color && <button className="std-textbtn" onClick={() => set({ cursor_fx_color: '' })}>Reset</button>}
                    </div>
                  </Field>
                )}
                <Field label="Custom cursor">
                  <label className="std-upload std-upload-sm" style={theme.cursor_url ? { backgroundImage: `url(${theme.cursor_url})`, backgroundSize: 'contain' } : {}}>
                    <input type="file" accept="image/*" hidden onChange={onCursor} />
                    <span>{savingCursor ? '…' : <><MousePointer2 size={14} /> {theme.cursor_url ? 'Change' : 'Upload'}</>}</span>
                  </label>
                  {theme.cursor_url && <button className="std-removebtn" onClick={() => set({ cursor_url: '' })}><X size={13} /> Remove</button>}
                </Field>

                <div className="std-soontiles">
                  <div className="std-soontile"><Wand2 size={15} /> Name overlays <span className="std-soon">Soon</span></div>
                  <div className="std-soontile"><Type size={15} /> Custom fonts <span className="std-soon">Soon</span></div>
                </div>
              </Panel>

              {/* ── COLOR — accent, text & title colors, light/dark ── */}
              <Panel icon={Palette} title="Color">
                <Field label="Mode"><Seg value={theme.mode} onChange={v => set({ mode: v })} options={[{ v: 'light', label: 'Light' }, { v: 'dark', label: 'Dark' }]} /></Field>
                <Field label="Accent">
                  <div className="std-swatches">
                    {ACCENT_PRESETS.map(c => <button key={c} className={`std-swatch${theme.accent === c ? ' on' : ''}`} style={{ background: c }} onClick={() => set({ accent: c })} aria-label={c} />)}
                    <input type="color" value={theme.accent} onChange={e => set({ accent: e.target.value })} className="std-colorpick" />
                  </div>
                </Field>
                <Field label="Text color">
                  <div className="std-colorrow">
                    <input type="color" value={theme.text_color || '#1a1916'} onChange={e => set({ text_color: e.target.value })} />
                    <span>{theme.text_color || 'Default'}</span>
                    {theme.text_color && <button className="std-textbtn" onClick={() => set({ text_color: '' })}>Reset</button>}
                  </div>
                </Field>
                <Field label="Title color">
                  <div className="std-colorrow">
                    <input type="color" value={theme.title_color || '#ffffff'} onChange={e => set({ title_color: e.target.value })} />
                    <span>{theme.title_color || 'Default'}</span>
                    {theme.title_color && <button className="std-textbtn" onClick={() => set({ title_color: '' })}>Reset</button>}
                  </div>
                </Field>
              </Panel>

              {/* ── PRODUCTS — how product cards look & stack ── */}
              {/* ── LINKS and PRODUCTS are separate panels ──
                  They're distinct block types on the page, and they were sharing
                  one "Products" panel — so a creator styling their links had to
                  find the controls among product settings, and the two sets of
                  colours sat next to each other looking like one system. Split,
                  each with its own fill AND text colour. */}
              <Panel icon={Link2} title="Profile links">
                <p className="std-panel-lede">
                  The link buttons inside your profile card. Featured links and products each have their own settings below.
                </p>
                <Field label="Button shape">
                  <Seg value={theme.link_shape || 'oval'} onChange={v => set({ link_shape: v })}
                    options={[
                      { v: 'rounded', label: 'Rounded' },
                      { v: 'oval', label: 'Oval' },
                      { v: 'sharp', label: 'Sharp' },
                      { v: 'full', label: 'Full width' },
                    ]} />
                  <p className="std-note">
                    Rounded is a soft card · Oval is the classic pill · Sharp is square-cornered ·
                    Full width removes the side margins so buttons run edge to edge.
                  </p>
                </Field>
                <Field label="Button colour">
                  <div className="std-colorrow">
                    <input type="color" value={theme.link_color || theme.accent}
                      onChange={e => set({ link_color: e.target.value })} />
                    <span>{theme.link_color || 'Accent tint'}</span>
                    {theme.link_color && (
                      <button className="std-removebtn" onClick={() => set({ link_color: '' })}><X size={13} /> Reset</button>
                    )}
                  </div>
                </Field>
                <Field label="Button text colour">
                  <div className="std-colorrow">
                    <input type="color" value={theme.link_text_color || (theme.mode === 'dark' ? '#F1EFEA' : '#1A1916')}
                      onChange={e => set({ link_text_color: e.target.value })} />
                    <span>{theme.link_text_color || 'Theme text'}</span>
                    {theme.link_text_color && (
                      <button className="std-removebtn" onClick={() => set({ link_text_color: '' })}><X size={13} /> Reset</button>
                    )}
                  </div>
                  <p className="std-note">Individual blocks can override this in Links → Layouts.</p>
                </Field>
                {/* Own opacity/blur, not the product values. A glassy product
                    grid used to force glassy link buttons — null means "follow
                    products", so nothing changes until you move the slider. */}
                <Field label="Button opacity (glass)">
                  <Slider value={theme.link_opacity ?? theme.product_opacity ?? 100} min={40} max={100} suffix="%"
                    onChange={v => set({ link_opacity: v })} />
                </Field>
                <Field label="Button blur (glass)">
                  <Slider value={theme.link_blur ?? theme.card_blur ?? 0} min={0} max={24} suffix="px"
                    onChange={v => set({ link_blur: v })} />
                </Field>
                <p className="std-note std-xref">
                  Glow lives in <strong>General &rarr; Glow effects</strong> above.
                  <em>Glow intensity</em> is the halo around the button; <em>Icon glow</em> is the bloom on its icon.
                </p>
              </Panel>

              {/* ── FEATURED links are a third category ──
                  Same object as a profile link, different job: promoted out of
                  the card into its own section above the products. Every control
                  here defaults to "Follow profile links", so an untouched
                  storefront is pixel-identical — this adds a cascade level, it
                  doesn't fork the styling. */}
              <Panel icon={Star} title="Featured links">
                <p className="std-panel-lede">
                  Links you've promoted out of the profile card. Leave anything unset to follow your profile links.
                </p>
                <Field label="Button shape">
                  <Seg value={theme.featured_link_shape || ''} onChange={v => set({ featured_link_shape: v })}
                    options={[
                      { v: '', label: 'Follow' },
                      { v: 'rounded', label: 'Rounded' },
                      { v: 'oval', label: 'Oval' },
                      { v: 'sharp', label: 'Sharp' },
                    ]} />
                  <p className="std-note">Follow uses whatever your profile links use.</p>
                </Field>
                <Field label="Button colour">
                  <div className="std-colorrow">
                    <input type="color" value={theme.featured_link_color || theme.link_color || theme.accent}
                      onChange={e => set({ featured_link_color: e.target.value })} />
                    <span>{theme.featured_link_color || 'Follow profile links'}</span>
                    {theme.featured_link_color && (
                      <button className="std-removebtn" onClick={() => set({ featured_link_color: '' })}><X size={13} /> Reset</button>
                    )}
                  </div>
                </Field>
                <Field label="Button text colour">
                  <div className="std-colorrow">
                    <input type="color" value={theme.featured_link_text_color || theme.link_text_color || (theme.mode === 'dark' ? '#F1EFEA' : '#1A1916')}
                      onChange={e => set({ featured_link_text_color: e.target.value })} />
                    <span>{theme.featured_link_text_color || 'Follow profile links'}</span>
                    {theme.featured_link_text_color && (
                      <button className="std-removebtn" onClick={() => set({ featured_link_text_color: '' })}><X size={13} /> Reset</button>
                    )}
                  </div>
                  <p className="std-note">A block can still override this in Links &rarr; Layouts.</p>
                </Field>
                <Field label="Button opacity (glass)">
                  <Slider value={theme.featured_link_opacity ?? theme.link_opacity ?? theme.product_opacity ?? 100}
                    min={40} max={100} suffix="%" onChange={v => set({ featured_link_opacity: v })} />
                </Field>
                <Field label="Button blur (glass)">
                  <Slider value={theme.featured_link_blur ?? theme.link_blur ?? theme.card_blur ?? 0}
                    min={0} max={24} suffix="px" onChange={v => set({ featured_link_blur: v })} />
                </Field>
              </Panel>

              <Panel icon={LayoutGrid} title="Products">
                <p className="std-panel-lede">
                  How the things you sell look. Plain links are configured above.
                </p>
                <Field label="Product layout"><Seg value={theme.layout} onChange={v => set({ layout: v })} options={[{ v: 'list', label: 'List' }, { v: 'grid', label: 'Grid' }]} /></Field>
                <Field label="Card shape"><Seg value={theme.button_style} onChange={v => set({ button_style: v })} options={[{ v: 'rounded', label: 'Rounded' }, { v: 'pill', label: 'Oval' }, { v: 'sharp', label: 'Sharp' }]} /></Field>
                <Field label="Product glow"><Seg value={theme.product_glow || 'none'} onChange={v => set({ product_glow: v })} options={[{ v: 'none', label: 'None' }, { v: 'soft', label: 'Soft' }, { v: 'strong', label: 'Strong' }]} /></Field>
                <Field label="Card colour">
                  <div className="std-colorrow">
                    <input type="color" value={theme.item_color || (theme.mode === 'dark' ? '#191B1F' : '#FFFFFF')}
                      onChange={e => set({ item_color: e.target.value })} />
                    <span>{theme.item_color || 'Theme surface'}</span>
                    {theme.item_color && (
                      <button className="std-removebtn" onClick={() => set({ item_color: '' })}><X size={13} /> Reset</button>
                    )}
                  </div>
                </Field>
                <Field label="Card text colour">
                  <div className="std-colorrow">
                    <input type="color" value={theme.item_text_color || (theme.mode === 'dark' ? '#F1EFEA' : '#1A1916')}
                      onChange={e => set({ item_text_color: e.target.value })} />
                    <span>{theme.item_text_color || 'Theme text'}</span>
                    {theme.item_text_color && (
                      <button className="std-removebtn" onClick={() => set({ item_text_color: '' })}><X size={13} /> Reset</button>
                    )}
                  </div>
                </Field>
                <Field label="Product opacity (glass)"><Slider value={theme.product_opacity ?? 100} min={40} max={100} suffix="%" onChange={v => set({ product_opacity: v })} /></Field>
                <Field label="Product blur (glass)"><Slider value={theme.product_blur ?? 0} min={0} max={24} suffix="px" onChange={v => set({ product_blur: v })} /></Field>
                <Toggle on={theme.show_group_headers !== false} onChange={v => set({ show_group_headers: v })} label="Section headers" hint="Titled dividers above each product group" />
                <Toggle on={theme.show_type_badges !== false} onChange={v => set({ show_type_badges: v })} label="Product-type badges" hint="Course · Download · Coaching chips on cards" />
              </Panel>

              <Panel icon={SlidersHorizontal} title="Sections &amp; product order">
                <p className="std-panel-lede">
                  Group products under your own headings — “My favorite products”, “Essentials”.
                  Type to rename a section, drag a product to move it between them.
                </p>
                {skills.length === 0 && <p className="std-note">No published products yet.</p>}

                {sections.map(sec => {
                  const key = sec.label || '__none';
                  return (
                    <div
                      key={key}
                      className={`std-sec${dragOver === key ? ' dragover' : ''}`}
                      onDragOver={e => { e.preventDefault(); if (dragOver !== key) setDragOver(key); }}
                      onDragLeave={() => setDragOver(o => (o === key ? null : o))}
                      onDrop={e => { e.preventDefault(); if (dragId) moveSkillTo(dragId, sec.label); setDragId(null); setDragOver(null); }}
                    >
                      <div className="std-sechead">
                        {sec.label === '' ? (
                          <span className="std-secname std-secname-none">Ungrouped</span>
                        ) : (
                          <input
                            className="std-secname"
                            /* key on label so an external rename re-seeds the uncontrolled input */
                            key={sec.label}
                            defaultValue={sec.label}
                            placeholder="Section name"
                            aria-label="Section name"
                            onBlur={e => renameSection(sec.label, e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                          />
                        )}
                        <span className="std-seccount">{sec.items.length}</span>
                        {sec.label !== '' && (
                          <button className="std-icobtn" onClick={() => deleteSection(sec.label)} aria-label={`Remove section ${sec.label}`}>
                            <X size={14} />
                          </button>
                        )}
                      </div>

                      {sec.items.length === 0 && <p className="std-secempty">Drag a product here</p>}

                      {sec.items.map(s => (
                        <div
                          key={s.id}
                          className={`std-orderrow${dragId === s.id ? ' dragging' : ''}`}
                          draggable
                          onDragStart={() => setDragId(s.id)}
                          onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                          onDrop={e => {
                            e.preventDefault(); e.stopPropagation();
                            if (dragId && dragId !== s.id) moveSkillTo(dragId, sec.label, s.id);
                            setDragId(null); setDragOver(null);
                          }}
                          onDragEnd={() => { setDragId(null); setDragOver(null); }}
                        >
                          <span className="std-grip" aria-hidden="true">⠿</span>
                          <span className="std-ordername">{s.title || 'Untitled'}</span>
                          {/* Touch/keyboard fallback — drag reaches neither. */}
                          <select
                            className="std-secpick"
                            value={sec.label}
                            aria-label={`Section for ${s.title || 'product'}`}
                            onChange={e => moveSkillTo(s.id, e.target.value)}
                          >
                            <option value="">Ungrouped</option>
                            {sections.filter(x => x.label !== '').map(x => (
                              <option key={x.label} value={x.label}>{x.label}</option>
                            ))}
                          </select>
                          <div className="std-orderbtns">
                            <button className="std-icobtn" onClick={() => nudge(s.id, -1)} aria-label="Move up"><ChevronUp size={16} /></button>
                            <button className="std-icobtn" onClick={() => nudge(s.id, 1)} aria-label="Move down"><ChevronDown size={16} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}

                <button className="std-addbtn" onClick={addSection}><Plus size={15} /> Add section</button>
                <p className="std-note">Headings show on your page when “Section headers” is on (above).</p>
              </Panel>
            </>
          )}

          {subTab === 'themes' && (
            <>
              <Panel icon={Layers} title="One-tap themes">
                <p className="std-panel-lede">Pick a look and it applies instantly — watch the preview. Your name, bio, socials, links, products and uploads all stay exactly as they are.</p>
                {PRESET_CATEGORIES.map(cat => (
                <div key={cat.id} className="std-tplcat">
                <div className="std-tplcathead">
                  <span className="std-tplcatname">{cat.label}</span>
                  <span className="std-tplcatblurb">{cat.blurb}</span>
                </div>
                <div className="std-themegrid">
                  {[...presetsByCategory(cat.id), ...savedTpls.filter(t => t.category === cat.id)].map(p => (
                    <div key={p.id} className="std-themewrap">
                    <button className="std-theme" onClick={() => applyPreset(p)} title={`Apply ${p.name}`}>
                      {/* color: drives the muted line via currentColor so it stays
                          legible on the preset's own light/dark background. */}
                      <span className="std-theme-swatch" style={{ ...swatchStyle(p.theme), color: p.theme.mode === 'dark' ? '#f2f0ea' : '#1a1916' }}>
                        <span className="std-theme-dot" style={{ background: p.theme.accent, boxShadow: `0 0 12px ${p.theme.accent}` }} />
                        <span className="std-theme-lines">
                          <span className="std-theme-line" style={{ background: p.theme.accent }} />
                          <span className="std-theme-line short" />
                        </span>
                      </span>
                      <span className="std-theme-meta">
                        <span className="std-theme-name">{p.emoji} {p.name}</span>
                        <span className="std-theme-blurb">{p.blurb}</span>
                        <span className="std-theme-tags">
                          {presetTags(p.theme)}
                          {p.saved && <span className="std-theme-saved">Saved</span>}
                        </span>
                      </span>
                      {/* Nested inside the tile's <button> would be invalid HTML
                          and would break the tile's own click, so it is a sibling
                          positioned over it. */}
                    </button>
                    {p.saved && isAdmin && (
                      <button className="std-theme-del" title={`Delete ${p.name}`}
                        onClick={() => onDeleteTemplate(p)}><X size={13} /></button>
                    )}
                    </div>
                  ))}
                </div>
                </div>
                ))}
              </Panel>

              {/* ── Save this page as a template — admin only ──
                  A preset with a video cannot be hand-written in presets.js,
                  because the asset has to be uploaded first. So the only way to
                  author one is to build a real page and cut the look from it.

                  The gate here is convenience; the backend re-checks
                  ADMIN_EMAIL, which is the check that actually matters. */}
              {isAdmin && (
              <Panel icon={Layers} title="Save this page as a template">
                <p className="std-panel-lede">
                  Publishes your current look — background, video, music and every effect —
                  as a template anyone can pick. Your name, bio, links, products and socials
                  are never included.
                </p>
                <Field label="Name">
                  <input value={tplForm.name} maxLength={60} placeholder="e.g. Midnight Studio"
                    onChange={e => setTplForm(f => ({ ...f, name: e.target.value }))} />
                </Field>
                <Field label="Blurb">
                  <input value={tplForm.blurb} maxLength={160} placeholder="One line: who is this for?"
                    onChange={e => setTplForm(f => ({ ...f, blurb: e.target.value }))} />
                </Field>
                <div className="std-tplmeta">
                  <Field label="Category">
                    <select value={tplForm.category}
                      onChange={e => setTplForm(f => ({ ...f, category: e.target.value }))}>
                      {PRESET_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Emoji">
                    <input value={tplForm.emoji} maxLength={8} className="std-tplemoji"
                      onChange={e => setTplForm(f => ({ ...f, emoji: e.target.value }))} />
                  </Field>
                </div>
                <Toggle on={tplForm.includeAudio}
                  onChange={v => setTplForm(f => ({ ...f, includeAudio: v }))}
                  label="Include my music"
                  hint="Your tracks get copied onto every page that uses this template — only include music you have the right to share" />
                <button className="std-tplsave" onClick={onSaveTemplate} disabled={tplBusy}>
                  {tplBusy ? 'Saving…' : 'Save as template'}
                </button>
                {tplMsg && (
                  <p className={`std-tplmsg${tplMsg.bad ? ' bad' : ''}`}>{tplMsg.text}</p>
                )}
                <p className="std-note">
                  Saving publishes your page first, then cuts the template from the saved
                  version — so what you see is exactly what gets captured.
                </p>
              </Panel>
              )}

              <Panel icon={Upload} title="Import &amp; export">
                <div className="std-tplrow">
                  <label className="std-addbtn">
                    <input type="file" accept="application/json,.json" hidden onChange={onImportTheme} />
                    <Upload size={15} /> Import theme
                  </label>
                  <button className="std-addbtn" onClick={exportTheme}><Download size={15} /> Export my theme</button>
                </div>
                <p className="std-note">Export saves your look as a <code>.json</code> you can share or back up. Import applies someone else’s.</p>
                <p className="std-note">Theme files carry <b>look only</b> — colors, effects, layout, glow. Your socials, music and uploaded images never travel in one (they’re yours, and links to them would break on someone else’s page).</p>
              </Panel>
            </>
          )}

          {subTab === 'links' && (
            <>
              <Panel icon={AtSign} title="Social links">
                <span className="std-flabel">Choose a platform</span>
                <div className="std-platgrid">
                  {SOCIAL_TYPES.map(t => {
                    const added = (theme.socials || []).some(s => s.type === t.type);
                    return (
                      <button key={t.type} className={`std-plattile${added ? ' on' : ''}`} onClick={() => addSocial(t.type)} title={`Add ${t.label}`}>
                        <span className="std-platicon"><BrandIcon type={t.type} size={22} /></span>
                        <span className="std-platlabel">{t.label}</span>
                      </button>
                    );
                  })}
                </div>
                {(theme.socials || []).length > 0 ? (
                  <div className="std-sociallist">
                    {(theme.socials || []).map((s, i) => {
                      const meta = SOCIAL_TYPES.find(t => t.type === s.type);
                      return (
                        <div key={i} className="std-socialrow">
                          <span className="std-socialicon"><BrandIcon type={s.type} size={18} /></span>
                          <input value={s.url} onChange={e => setSocial(i, { url: e.target.value })} placeholder={`Your ${meta?.label || 'profile'} URL`} />
                          <button className="std-icobtn" onClick={() => removeSocial(i)} aria-label={`Remove ${meta?.label || 'social'}`}><X size={15} /></button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="std-note">Tap an icon above to add it, then paste your link.</p>
                )}
              </Panel>

              {/* In its own Panel, like Social links above it. Without the
                  wrapper the block list ran straight on from the social icons
                  with no boundary, so two unrelated things read as one list.
                  See src/components/LinkBlockEditor.jsx for the sub-pages. */}
              <Panel icon={Link2} title="Link blocks">
                <p className="std-note" style={{ marginTop: -4, marginBottom: 14 }}>
                  Each block is a group of links with its own title, layout and visibility.
                  Drag order here is the order they appear on your page.
                </p>
                <LinkBlockEditor creatorId={user.id} onChange={reloadLinks} />
              </Panel>
            </>
          )}
        </main>

        {/* ── Live preview ── */}
        <aside className="std-preview">
          <div className="std-preview-label"><Eye size={13} /> Live preview</div>
          <div className="std-preview-frame">
            <LivePreview theme={theme} name={name || `@${profile.username}`} handle={profile.username} avatar={avatarUrl} bio={bio} location={location} socials={theme.socials} skills={skills} links={links} blocks={blocks} />
          </div>
          <p className="std-preview-note">Updates as you edit · Save to publish</p>
        </aside>
      </div>

      {/* ── Site-music modal — visual list of the submitted tracks ── */}
      {musicOpen && (
        <div className="std-modal-backdrop" onClick={() => setMusicOpen(false)}>
          <div className="std-modal" onClick={e => e.stopPropagation()}>
            <div className="std-modal-head">
              <span className="std-modal-title"><ListMusic size={17} /> Site music</span>
              <button className="std-icobtn" onClick={() => setMusicOpen(false)} aria-label="Close"><X size={16} /></button>
            </div>
            <p className="std-modal-sub">
              Tracks play top to bottom, then loop — use the arrows to set the order.
              Up to {MAX_AUDIO_TRACKS} tracks. Visitors get a play/mute button and a volume
              slider; browsers block autoplay until they tap.
            </p>

            {(theme.audio_tracks || []).length === 0 ? (
              <div className="std-modal-empty"><Music size={26} strokeWidth={1.5} /><p>No tracks yet</p></div>
            ) : (
              <div className="std-tracklist">
                {(theme.audio_tracks || []).map((tr, i, arr) => (
                  // Keyed by url, NOT index: with an index key React would keep each
                  // <audio> element in place and just swap its src on reorder, so a
                  // playing preview would jump to a different song. A stable key moves
                  // the actual DOM node instead.
                  <div key={tr.url || i} className="std-track">
                    <span className="std-track-idx">{i + 1}</span>
                    <div className="std-track-main">
                      <span className="std-track-name" title={tr.name}>{tr.name || `Track ${i + 1}`}</span>
                      {/* Matches the live page's 85% so you audition at the level
                          visitors actually hear. Ref callback, not a prop — see
                          SITE_AUDIO_VOLUME. Native controls still override it. */}
                      <audio className="std-track-audio" src={tr.url} controls preload="none"
                        ref={el => { if (el) el.volume = SITE_AUDIO_VOLUME; }} />
                    </div>
                    <div className="std-track-move">
                      <button className="std-icobtn" disabled={i === 0}
                        onClick={() => moveTrack(i, -1)} aria-label={`Move ${tr.name || 'track'} up`}><ChevronUp size={14} /></button>
                      <button className="std-icobtn" disabled={i === arr.length - 1}
                        onClick={() => moveTrack(i, 1)} aria-label={`Move ${tr.name || 'track'} down`}><ChevronDown size={14} /></button>
                    </div>
                    <button className="std-icobtn" onClick={() => removeTrack(i)} aria-label={`Remove ${tr.name || 'track'}`}><X size={15} /></button>
                  </div>
                ))}
              </div>
            )}

            {(theme.audio_tracks || []).length < MAX_AUDIO_TRACKS ? (
              <label className="std-addbtn std-track-add">
                <input type="file" accept="audio/*" hidden onChange={onAudioAdd} />
                {savingAudio ? 'Uploading…' : <><Plus size={15} /> Upload track ({(theme.audio_tracks || []).length}/{MAX_AUDIO_TRACKS})</>}
              </label>
            ) : (
              // Removed rather than disabled: a dead button invites clicking to
              // find out why. The sentence says what to do instead.
              <p className="std-note std-track-full">
                Playlist full — {MAX_AUDIO_TRACKS} tracks max. Remove one to add another.
              </p>
            )}
            {err && <p className="std-note std-track-err">{err}</p>}
            <p className="std-note">Changes apply when you hit “Save changes”.</p>
          </div>
        </div>
      )}

      <Styles />
    </div>
  );
}

function Styles() {
  return <style>{`
    /* ══ Customization studio — glassmorphic dashboard ══ */
    .std-loading { padding:60px; text-align:center; color:var(--text-muted); }
    .std { position:relative; min-height:100vh; padding:20px 22px 60px; }
    .std-bgfx { position:fixed; inset:0; z-index:-1; pointer-events:none;
      background:
        radial-gradient(60% 50% at 15% 0%, color-mix(in srgb, var(--accent) 16%, transparent), transparent 70%),
        radial-gradient(55% 45% at 95% 10%, color-mix(in srgb, #7C3AED 12%, transparent), transparent 70%),
        var(--bg); }

    /* Glass base */
    .std-panel, .std-sub, .std-preview-frame, .std-top {
      background: color-mix(in srgb, var(--surface) 72%, transparent);
      -webkit-backdrop-filter: blur(16px); backdrop-filter: blur(16px);
      border: 1px solid color-mix(in srgb, var(--border-strong) 60%, transparent);
      box-shadow: 0 8px 30px rgba(20,18,12,.08), inset 0 1px 0 rgba(255,255,255,.5);
    }

    /* Top header */
    .std-top { display:flex; align-items:center; justify-content:space-between; gap:12px;
      padding:10px 14px; border-radius:var(--r-lg); margin-bottom:16px; z-index:30;
      /* Holds the Save button. Parks below the mobile app header instead of
         scrolling underneath it — .sb-topbar is 60px at z-index 190, so a bare
         top:12px put this INSIDE that band and the header painted over it.
         --app-header-h is 0 on desktop, where nothing sits above the page. */
      position:sticky; top:calc(var(--app-header-h, 0px) + 12px);
      scroll-margin-top:calc(var(--app-header-h, 0px) + 12px); }
    .std-tabwrap { position:relative; }
    .std-caret { transition:transform .18s ease; opacity:.9; }
    .std-caret.open { transform:rotate(180deg); }
    .std-dropbg { position:fixed; inset:0; z-index:80; }
    .std-drop { position:absolute; top:calc(100% + 8px); left:0; z-index:90; min-width:232px; padding:6px;
      background:color-mix(in srgb, var(--surface) 90%, transparent); -webkit-backdrop-filter:blur(18px); backdrop-filter:blur(18px);
      border:1px solid color-mix(in srgb, var(--border-strong) 60%, transparent); border-radius:var(--r-lg);
      box-shadow:0 16px 42px rgba(20,18,12,.17); animation:stdDrop .16s ease; }
    @keyframes stdDrop { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
    .std-dropitem { width:100%; display:flex; align-items:center; gap:10px; padding:11px 13px; border:none; border-radius:var(--r);
      background:transparent; color:var(--text-secondary); font-size:14px; font-weight:600; cursor:pointer; text-align:left; transition:all .13s; }
    .std-dropitem:hover { background:var(--surface-alt); color:var(--text); }
    .std-dropitem.on { background:color-mix(in srgb, var(--accent) 14%, transparent); color:var(--accent); }
    .std-dropitem-wip { opacity:.75; }
    .std-mainhead { font-size:14px; font-weight:800; text-transform:uppercase; letter-spacing:.06em; color:var(--text-muted); padding:2px; }
    .std-avatarrow { display:flex; align-items:center; gap:12px; }
    .std-avatar { width:56px; height:56px; border-radius:50%; flex-shrink:0; background:color-mix(in srgb, var(--accent) 16%, #fff) center/cover no-repeat;
      display:flex; align-items:center; justify-content:center; font-weight:800; font-size:22px; color:var(--accent); border:2px solid var(--border-strong); text-transform:uppercase; }
    .std-top-actions { display:flex; gap:8px; align-items:center; }
    .std-ghost { display:inline-flex; align-items:center; gap:6px; padding:9px 15px; border-radius:var(--r-full); border:1px solid var(--border-strong);
      background:var(--surface); color:var(--text); font-size:13px; font-weight:700; text-decoration:none; }
    .std-ghost:hover { background:var(--surface-alt); }
    .std-save { width:auto; min-width:0; display:inline-flex; align-items:center; gap:6px; padding:10px 20px; border-radius:var(--r-full); border:none;
      background:var(--accent); color:#fff; font-size:14px; font-weight:700; cursor:pointer; box-shadow:0 6px 18px color-mix(in srgb, var(--accent) 32%, transparent); }
    .std-save:hover { background:var(--accent-hover); }
    .std-err { color:#b91c1c; background:var(--danger-light); border:1px solid #fecaca; border-radius:var(--r); padding:9px 13px; font-size:13px; margin-bottom:12px; }

    /* Body: subnav | main | preview */
    .std-body { display:grid; grid-template-columns:minmax(0,1fr) 396px; gap:22px; align-items:start; }

    .std-top-tabs { display:flex; gap:4px; min-width:0; flex-wrap:wrap; }
    .std-tab { display:inline-flex; align-items:center; gap:7px; width:auto; padding:9px 16px;
      border-radius:var(--r-full); border:none; background:transparent; color:var(--text-secondary);
      font-size:14px; font-weight:700; font-family:inherit; text-decoration:none; cursor:pointer;
      transition:background .13s ease, color .13s ease; }
    .std-tab:hover { background:var(--surface-alt); color:var(--text); text-decoration:none; }
    .std-tab.on { background:var(--accent); color:var(--accent-foreground);
      box-shadow:0 4px 14px color-mix(in srgb, var(--accent) 34%, transparent); }
    .std-tab.on:hover { background:var(--accent-hover); color:var(--accent-foreground); }

    /* Same offset chain as .std-top, one bar lower, so the subnav never tucks
       under the app header either. */
    .std-sub { border-radius:var(--r-lg); padding:10px; display:flex; flex-direction:column; gap:4px;
      position:sticky; top:calc(var(--app-header-h, 0px) + 78px); }
    .std-subitem { width:100%; display:flex; align-items:center; gap:11px; padding:13px 15px; border:none; border-radius:var(--r);
      background:transparent; color:var(--text-secondary); font-size:15px; font-weight:600; cursor:pointer; text-align:left; transition:all .14s; }
    .std-subitem:hover { background:var(--surface-alt); color:var(--text); }
    .std-subitem.on { background:color-mix(in srgb, var(--accent) 14%, transparent); color:var(--accent); }
    .std-subitem-wip { opacity:.7; }
    .std-wip { margin-left:auto; font-size:9px; font-weight:800; letter-spacing:.05em; padding:2px 6px; border-radius:var(--r-full); background:var(--surface-alt); color:var(--text-muted); }

    .std-main { display:flex; flex-direction:column; gap:20px; min-width:0; }
    .std-panel { border-radius:var(--r-lg); padding:26px; }
    .std-panel-head { display:flex; align-items:center; gap:12px; margin-bottom:22px; }
    .std-panel-icon { display:inline-flex; align-items:center; justify-content:center; width:36px; height:36px; border-radius:var(--r-sm);
      background:color-mix(in srgb, var(--accent) 15%, transparent); color:var(--accent); }
    .std-panel-title { font-size:18px; font-weight:800; letter-spacing:-.01em; margin:0; }
    .std-soon { font-size:9px; font-weight:800; letter-spacing:.05em; text-transform:uppercase; padding:2px 7px; border-radius:var(--r-full);
      background:var(--surface-alt); color:var(--text-muted); }

    .std-field { margin-bottom:22px; }
    .std-field:last-child { margin-bottom:0; }
    .std-flabel { display:block; font-size:12.5px; font-weight:800; text-transform:uppercase; letter-spacing:.05em; color:var(--text-muted); margin-bottom:10px; }
    .std-note { font-size:13px; line-height:1.5; color:var(--text-muted); margin:9px 0 0; display:flex; align-items:center; gap:6px; }

    /* wrap:  the overlay seg now has 7 options — let them flow to a 2nd row
       instead of squeezing each label to nothing. */
    .std-seg { display:flex; flex-wrap:wrap; gap:4px; padding:4px; background:var(--surface-alt); border-radius:var(--r-full); }
    .std-seg button { flex:1 1 auto; width:auto; min-width:66px; border:none; border-radius:var(--r-full); background:transparent; padding:10px 14px;
      font-size:14px; font-weight:700; color:var(--text-secondary); cursor:pointer; transition:all .14s; }
    .std-seg button.on { background:var(--accent); color:#fff; }

    .std-slider { display:flex; align-items:center; gap:12px; }
    .std-slider input[type=range] { flex:1; accent-color:var(--accent); }
    .std-slider-val { font-size:14px; font-weight:800; color:var(--text); min-width:48px; text-align:right; }

    .std-colorrow { display:flex; align-items:center; gap:10px; }
    .std-colorrow input[type=color] { width:40px; height:34px; padding:0; border:1.5px solid var(--border-strong); border-radius:8px; background:none; cursor:pointer; }
    .std-colorrow span { font-size:13px; font-weight:600; color:var(--text-secondary); }
    .std-swatches { display:flex; flex-wrap:wrap; gap:9px; align-items:center; }
    .std-swatch { width:30px; height:30px; min-width:0; border-radius:50%; border:2px solid transparent; cursor:pointer; box-shadow:var(--shadow-sm); transition:transform .12s; }
    .std-swatch:hover { transform:scale(1.1); }
    .std-swatch.on { border-color:var(--surface); box-shadow:0 0 0 2.5px var(--text); }
    .std-colorpick { width:36px; height:30px; padding:0; border:1.5px solid var(--border-strong); border-radius:8px; background:none; cursor:pointer; }

    .std-upload { display:flex; align-items:center; justify-content:center; aspect-ratio:16/6; border:1.5px dashed var(--border-strong); border-radius:var(--r);
      background:var(--surface-alt) center/cover no-repeat; cursor:pointer; }
    .std-upload-sm { aspect-ratio:auto; height:44px; width:150px; }
    .std-upload span { display:inline-flex; align-items:center; gap:7px; background:rgba(0,0,0,.6); color:#fff; padding:8px 14px; border-radius:var(--r-full); font-size:13px; font-weight:600; }
    .std-textbtn { width:auto; background:none; border:none; color:var(--text-muted); font-size:12px; cursor:pointer; margin-left:10px; padding:0; }
    .std-textbtn:hover { color:var(--accent); }
    /* Right-aligned + fit-content so it tucks to the end of the upload row/field
       (margin-left:auto pushes it right in both the flex avatar row and block fields). */
    .std-removebtn { width:fit-content; display:flex; align-items:center; gap:5px; margin:9px 0 0 auto; padding:5px 11px; border-radius:var(--r-full); border:1px solid var(--border-strong, var(--border)); background:var(--surface); color:var(--text-muted); font-size:11.5px; font-weight:700; cursor:pointer; transition:border-color .13s ease, color .13s ease, background .13s ease; }
    .std-removebtn:hover { border-color:#ef4444; color:#ef4444; background:color-mix(in srgb, #ef4444 8%, transparent); }
    .std-removebtn svg { flex-shrink:0; }

    .std-soontiles { display:flex; flex-wrap:wrap; gap:8px; margin-top:14px; }
    .std-soontile { display:inline-flex; align-items:center; gap:7px; padding:9px 13px; border:1px dashed var(--border-strong); border-radius:var(--r);
      background:var(--surface-alt); color:var(--text-muted); font-size:12.5px; font-weight:600; }

    .std-toggle-row { width:100%; display:flex; align-items:center; justify-content:space-between; gap:14px; padding:14px 0; border:none; background:none; cursor:pointer; }
    .std-toggle-txt { display:flex; flex-direction:column; gap:2px; text-align:left; }
    .std-toggle-label { font-size:15px; font-weight:700; color:var(--text); }
    .std-toggle-hint { font-size:13px; line-height:1.45; color:var(--text-muted); }
    .std-toggle { width:46px; height:26px; border-radius:var(--r-full); background:var(--border-strong); position:relative; transition:background .16s; flex-shrink:0; }
    .std-toggle-knob { position:absolute; top:3px; left:3px; width:20px; height:20px; border-radius:50%; background:#fff; transition:transform .16s; box-shadow:var(--shadow-sm); }
    .std-toggle-row.on .std-toggle { background:var(--accent); }
    .std-toggle-row.on .std-toggle-knob { transform:translateX(20px); }

    /* Settings that only exist while their parent toggle is ON. The rule + inset
       make the dependency visible instead of leaving orphaned sliders floating
       at the same level as the switch that controls them. */
    /* Settings that only exist while their parent toggle/mode is active.
       Reads as a contained block, not just indented text: solid accent rule,
       real padding on all sides, rounded outer corners, and a darker fill so it
       separates from whatever it sits inside.
       The fill is a black OVERLAY rather than a fixed colour because this is
       used inside two different parents (the glass .std-panel and the
       --surface-alt .std-linkcard) — an overlay darkens both correctly instead
       of matching one and clashing with the other. */
    .std-subgroup { margin:10px 0 2px; padding:16px 16px 4px;
      border-left:3px solid var(--accent); border-radius:0 var(--r) var(--r) 0;
      background:rgb(0 0 0 / 0.055); }
    /* A 5% black wash is invisible on an already-dark surface, so dark mode
       needs a much heavier overlay to read as the same amount of separation. */
    :root[data-theme="dark"] .std-subgroup { background:rgb(0 0 0 / 0.26); }
    .std-subgroup .std-field:last-child { margin-bottom:12px; }

    /* ── Sections (creator-named product groups) ── */
    .std-sec { border:1.5px solid var(--border); border-radius:var(--r); padding:10px 12px 6px; margin-bottom:10px; transition:border-color .13s ease, background .13s ease; }
    .std-sec.dragover { border-color:var(--accent); background:color-mix(in srgb, var(--accent) 7%, transparent); border-style:dashed; }
    .std-sechead { display:flex; align-items:center; gap:8px; margin-bottom:2px; }
    /* Reads as a heading until focused, so it doesn't look like a form field. */
    .std-secname { flex:1; min-width:0; width:auto; padding:5px 8px; border:1px solid transparent; border-radius:var(--r-sm);
      background:transparent; color:var(--text); font-size:14px; font-weight:800; letter-spacing:-.01em; }
    .std-secname:hover { border-color:var(--border-strong); }
    .std-secname:focus { border-color:var(--accent); background:var(--surface); outline:none; }
    .std-secname-none { color:var(--text-muted); font-weight:700; }
    .std-seccount { flex-shrink:0; font-size:11px; font-weight:800; color:var(--accent); background:color-mix(in srgb, var(--accent) 13%, transparent);
      border:1px solid color-mix(in srgb, var(--accent) 28%, transparent); padding:2px 8px; border-radius:var(--r-full); }
    .std-secempty { font-size:12px; color:var(--text-muted); font-style:italic; padding:8px 6px 10px; margin:0; }
    .std-secpick { flex-shrink:0; max-width:132px; font-size:12px; padding:5px 8px; }

    .std-orderrow { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 6px; border-top:1px solid var(--border); cursor:grab; border-radius:8px; }
    .std-orderrow:active { cursor:grabbing; }
    .std-orderrow.dragging { opacity:.45; }
    .std-orderrow.dragover { background:color-mix(in srgb, var(--accent) 9%, transparent); outline:1.5px dashed color-mix(in srgb, var(--accent) 45%, transparent); outline-offset:-1.5px; }
    .std-grip { color:var(--text-muted); font-size:13px; cursor:grab; user-select:none; flex-shrink:0; }
    .std-orderrow:first-of-type { border-top:none; }
    .std-ordername { font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .std-orderbtns { display:flex; gap:6px; }
    .std-icobtn { display:inline-flex; align-items:center; justify-content:center; width:34px; height:34px; min-width:0; flex-shrink:0; border-radius:var(--r-sm);
      border:1.5px solid var(--border-strong); background:var(--surface); color:var(--text-secondary); cursor:pointer; transition:all .12s; }
    .std-icobtn:hover:not(:disabled) { background:var(--surface-alt); color:var(--text); }
    .std-icobtn:disabled { opacity:.35; cursor:default; }

    .std-row { display:flex; gap:8px; align-items:center; margin-bottom:8px; }
    .std-row select { flex:0 0 128px; }
    .std-row input { flex:1; }

    /* ── Platform picker (click an icon → adds a social row) ── */
    .std-platgrid { display:grid; grid-template-columns:repeat(auto-fill, minmax(80px, 1fr)); gap:8px; margin-bottom:6px; }
    .std-plattile { display:flex; flex-direction:column; align-items:center; gap:7px; padding:12px 6px; min-width:0;
      border:1.5px solid var(--border-strong); border-radius:var(--r); background:var(--surface); color:var(--text-secondary);
      cursor:pointer; transition:transform .13s ease, border-color .13s ease, color .13s ease, background .13s ease, box-shadow .13s ease; }
    .std-plattile:hover { transform:translateY(-2px); border-color:var(--accent); color:var(--accent);
      background:color-mix(in srgb, var(--accent) 8%, var(--surface)); box-shadow:0 6px 16px color-mix(in srgb, var(--accent) 16%, transparent); }
    .std-plattile.on { border-color:var(--accent); color:var(--accent); background:color-mix(in srgb, var(--accent) 12%, transparent); }
    .std-platicon { display:inline-flex; align-items:center; justify-content:center; }
    .std-platlabel { font-size:11px; font-weight:700; letter-spacing:-.01em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%; }

    /* Added socials — icon chip + URL field + remove */
    .std-sociallist { display:flex; flex-direction:column; gap:8px; margin-top:14px; padding-top:14px; border-top:1px solid var(--border); }
    .std-socialrow { display:flex; align-items:center; gap:9px; }
    .std-socialicon { display:inline-flex; align-items:center; justify-content:center; width:34px; height:34px; flex-shrink:0;
      border-radius:var(--r-sm); background:var(--surface-alt); color:var(--text); border:1px solid var(--border); }
    .std-socialrow input { flex:1; min-width:0; }
    .std-linkcard { border:1px solid var(--border); border-radius:var(--r); padding:14px; margin-bottom:10px; background:var(--surface-alt); }

    /* ── Classes that were used in markup but never had a rule ──────────────
       All of these rendered unstyled. The two visible ones were the affiliate
       checkbox (label + box on the text baseline, so the box sat low and the
       text ran into it) and the Add-link button. */

    /* Checkbox + label as one aligned unit. align-items:center on the FLEX
       parent is what "connects" them; the checkbox also needs its width fixed
       and margin zeroed, because the global "input" rule in App.css sets
       width:100% + padding:12px 16px and would otherwise blow it up. */
    .std-check { display:flex; align-items:center; gap:8px; margin-top:10px; cursor:pointer;
      font-size:13px; font-weight:600; color:var(--text-secondary); user-select:none; }
    .std-check input[type="checkbox"] { width:16px; height:16px; flex:0 0 16px; margin:0; padding:0;
      accent-color:var(--accent); cursor:pointer; }
    .std-check:hover { color:var(--text); }

    /* Add-link / add-section / upload triggers.
       This class is applied to BOTH button and label elements. App.css
       styles a bare "button" (pill radius, inline-flex, border:none) but not
       "label", so with no rule of its own the two rendered completely
       differently — the button as a borderless pill with no padding, the label
       as plain text. Everything below is restated so the element type stops
       mattering, and it is scoped tightly enough to beat the global. */
    .std-addbtn { display:inline-flex; align-items:center; justify-content:center; gap:7px;
      padding:9px 16px; margin-top:4px; width:auto; white-space:nowrap;
      border:1.5px dashed var(--border-strong); border-radius:var(--r); background:var(--surface);
      color:var(--text-secondary); font-family:inherit; font-size:13px; font-weight:700;
      cursor:pointer; transition:border-color .14s ease, color .14s ease, background .14s ease; }
    .std-addbtn:hover { border-color:var(--accent); color:var(--accent);
      background:color-mix(in srgb, var(--accent) 7%, var(--surface)); }
    .std-addbtn input[type="file"] { display:none; }

    /* Placement control inside a link card — label above, segmented below. */
    .std-linkplace { display:flex; flex-direction:column; gap:6px; margin-top:12px;
      padding-top:12px; border-top:1px solid var(--border); }

    /* Cover row: a live preview beside the actions, so the icon fallback is
       visible BEFORE uploading rather than being a surprise on the live page. */
    .std-linkcover { display:flex; align-items:center; gap:12px; }
    .std-linkcover-prev { flex-shrink:0; width:64px; height:64px; border-radius:var(--r);
      background:var(--surface-alt) center/cover no-repeat; border:1px solid var(--border); }
    .std-linkcover-prev.empty { display:flex; align-items:center; justify-content:center;
      color:var(--text-muted); border-style:dashed; }
    .std-linkcover-actions { display:flex; flex-direction:column; gap:6px; min-width:0; }
    .std-linkcover-btn { width:auto; padding:8px 14px; }
    /* The shared .std-removebtn right-aligns itself with margin-left:auto, which
       shoves it off in this narrow column — pin it back to the left edge. */
    .std-linkcover-actions .std-removebtn { margin:0; }

    /* Multi-select chips. Checked state is carried by fill + a tick, not by
       fill alone — a colour-only difference at 3:1 is exactly the contrast
       problem this pass is fixing. */
    .std-chips { display:flex; flex-wrap:wrap; gap:7px; }
    .std-chip { display:inline-flex; align-items:center; gap:6px; padding:7px 13px;
      border-radius:var(--r-full); border:1.5px solid var(--border-strong);
      background:var(--surface); color:var(--text-secondary);
      font-size:12.5px; font-weight:700; cursor:pointer; white-space:nowrap;
      transition:background .14s ease, border-color .14s ease, color .14s ease; }
    .std-chip:hover { border-color:var(--accent-mid); color:var(--text); }
    .std-chip.on { background:var(--accent); border-color:var(--accent); color:#fff; }
    .std-chipdot { width:12px; height:12px; border-radius:50%; border:1.5px solid var(--border-strong); }
    .std-chipall { padding:7px 13px; border-radius:var(--r-full); border:1.5px dashed var(--border-strong);
      background:transparent; color:var(--text-muted); font-size:12.5px; font-weight:700; cursor:pointer; }
    .std-chipall:hover { border-color:var(--accent); color:var(--accent); }

    .std-xref { margin-top:12px; padding:9px 11px; border-radius:8px;
      border-left:2px solid color-mix(in srgb, var(--accent) 60%, transparent);
      background:color-mix(in srgb, var(--accent) 8%, transparent); }
    .std-xref em { font-style:normal; font-weight:700; color:var(--text); }
    .std-panel-lede { font-size:13px; color:var(--text-secondary); line-height:1.55; margin:0 0 14px; }
    .std-upload-wide { width:100%; aspect-ratio:3 / 1; }

    /* Theme preset cards. NOTE: the .std-theme rule's opening was destroyed by
       a bad paste — the file carried a stray "r-lg); background:..." fragment
       with no selector, plus a duplicated socials block and an orphaned tail of
       .std-platlabel. Reconstructed from its surviving children + :hover. */
    /* Category headings. The blurb answers "is this section for me?" before
       any swatch has to be interpreted — 20 unlabelled tiles is a wall. */
    .std-themewrap { position:relative; display:flex; }
    .std-themewrap > .std-theme { flex:1; }
    /* Over the tile, not inside it — a <button> inside a <button> is invalid
       HTML and swallows the parent's click. */
    .std-theme-del { position:absolute; top:6px; right:6px; width:22px; height:22px; padding:0;
      display:flex; align-items:center; justify-content:center; border-radius:999px;
      border:1px solid rgba(255,255,255,.3); background:rgba(0,0,0,.62); color:#fff;
      cursor:pointer; opacity:0; transition:opacity .14s ease; }
    .std-themewrap:hover .std-theme-del { opacity:1; }
    .std-theme-del:hover { background:var(--danger); border-color:var(--danger); }
    .std-theme-saved { display:inline-block; margin-left:6px; padding:1px 7px; border-radius:999px;
      background:var(--accent); color:#fff; font-size:9.5px; font-weight:800;
      text-transform:uppercase; letter-spacing:.05em; }
    .std-tplmeta { display:grid; grid-template-columns:1fr 90px; gap:12px; }
    .std-tplemoji { text-align:center; font-size:17px; }
    .std-tplsave { width:100%; margin-top:14px; padding:14px 18px; border-radius:var(--r-full);
      border:none; background:var(--accent); color:#fff; font-size:14px; font-weight:800;
      cursor:pointer; }
    .std-tplsave:disabled { opacity:.6; cursor:default; }
    .std-tplmsg { margin-top:10px; font-size:12.5px; line-height:1.45; color:var(--green); }
    .std-tplmsg.bad { color:var(--danger); }
    .std-tplcat { margin-top:22px; }
    .std-tplcat:first-of-type { margin-top:10px; }
    .std-tplcathead { display:flex; flex-direction:column; gap:2px; margin-bottom:10px;
      padding-left:11px; border-left:3px solid var(--accent); }
    .std-tplcatname { font-size:14.5px; font-weight:800; color:var(--text); }
    .std-tplcatblurb { font-size:12.5px; line-height:1.4; color:var(--text-secondary); }
    .std-theme-blurb { font-size:11.5px; line-height:1.4; color:var(--text-secondary);
      display:-webkit-box; -webkit-box-orient:vertical; overflow:hidden;
      -webkit-line-clamp:2; line-clamp:2; }
    .std-themegrid { display:grid; grid-template-columns:repeat(auto-fill, minmax(190px, 1fr)); gap:12px; }
    .std-theme { display:flex; flex-direction:column; align-items:stretch; text-align:left; padding:0; overflow:hidden;
      border:1.5px solid var(--border); border-radius:var(--r-lg); background:var(--surface); cursor:pointer;
      transition:transform .14s ease, border-color .14s ease, box-shadow .14s ease; }
    .std-theme:hover { transform:translateY(-3px); border-color:var(--accent);
      box-shadow:0 10px 24px color-mix(in srgb, var(--accent) 20%, transparent); }
    /* The swatch paints the preset's real background + accent — a look you can read at a glance. */
    .std-theme-swatch { position:relative; height:78px; display:flex; align-items:center; gap:8px; padding:0 12px; }
    .std-theme-dot { width:22px; height:22px; border-radius:50%; flex-shrink:0; }
    .std-theme-lines { display:flex; flex-direction:column; gap:5px; flex:1; min-width:0; }
    .std-theme-line { height:5px; border-radius:var(--r-full); width:70%; opacity:.9; }
    .std-theme-line.short { width:44%; background:currentColor; opacity:.32; }
    .std-theme-meta { display:flex; flex-direction:column; gap:2px; padding:10px 12px 12px; border-top:1px solid var(--border); }
    .std-theme-name { font-size:13px; font-weight:800; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .std-theme-tags { font-size:11px; font-weight:600; color:var(--text-muted); }
    .std-tplrow { display:flex; gap:8px; flex-wrap:wrap; }
    .std-panel code { font-size:11.5px; background:var(--surface-alt); padding:1px 5px; border-radius:4px; }

    /* ── Site-music: trigger button + modal ── */
    .std-musicbtn { width:100%; display:flex; align-items:center; justify-content:space-between; gap:10px; padding:11px 14px; border-radius:var(--r);
      border:1.5px solid var(--border-strong); background:var(--surface); color:var(--text); font-size:14px; font-weight:700; cursor:pointer; transition:border-color .13s ease; }
    .std-musicbtn:hover { border-color:var(--accent); }
    .std-musicbtn-l { display:inline-flex; align-items:center; gap:8px; }
    .std-musicbtn-r { font-size:12px; font-weight:800; color:var(--accent); }

    .std-modal-backdrop { position:fixed; inset:0; z-index:200; display:flex; align-items:center; justify-content:center; padding:20px;
      background:rgba(12,10,16,.55); -webkit-backdrop-filter:blur(4px); backdrop-filter:blur(4px); animation:stdFade .16s ease; }
    @keyframes stdFade { from { opacity:0; } to { opacity:1; } }
    .std-modal { width:100%; max-width:440px; max-height:82vh; overflow-y:auto; padding:20px; border-radius:var(--r-lg);
      background:color-mix(in srgb, var(--surface) 96%, transparent); -webkit-backdrop-filter:blur(18px); backdrop-filter:blur(18px);
      border:1px solid var(--border-strong); box-shadow:0 24px 60px rgba(20,18,12,.28); animation:stdDrop .18s ease; }
    .std-modal-head { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:5px; }
    .std-modal-title { display:flex; align-items:center; gap:9px; font-size:17px; font-weight:800; letter-spacing:-.01em; }
    .std-modal-sub { font-size:12.5px; color:var(--text-muted); margin:0 0 16px; line-height:1.5; }
    .std-modal-empty { display:flex; flex-direction:column; align-items:center; gap:8px; padding:28px; color:var(--text-muted);
      border:1.5px dashed var(--border-strong); border-radius:var(--r); margin-bottom:14px; }
    .std-modal-empty p { margin:0; font-size:13px; font-weight:600; }
    .std-tracklist { display:flex; flex-direction:column; gap:10px; margin-bottom:14px; }
    .std-track { display:flex; align-items:center; gap:11px; padding:11px; border:1px solid var(--border); border-radius:var(--r); background:var(--surface-alt); }
    .std-track-idx { flex-shrink:0; width:24px; height:24px; display:flex; align-items:center; justify-content:center; border-radius:50%;
      background:color-mix(in srgb, var(--accent) 16%, transparent); color:var(--accent); font-size:12px; font-weight:800; }
    /* Reorder arrows, stacked so the row height doesn't grow. Disabled at the
       ends rather than hidden — buttons that vanish make the row jump width. */
    .std-track-move { display:flex; flex-direction:column; gap:2px; flex-shrink:0; }
    .std-track-move .std-icobtn { width:24px; height:20px; padding:0; }
    .std-track-move .std-icobtn:disabled { opacity:.32; cursor:default; }
    .std-track-full { text-align:center; padding:11px; border:1px dashed var(--border-strong); border-radius:var(--r); }
    .std-track-err { color:var(--danger, var(--danger)); }
    .std-track-main { flex:1; min-width:0; display:flex; flex-direction:column; gap:7px; }
    .std-track-name { font-size:13.5px; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .std-track-audio { width:100%; height:32px; }
    .std-track-add { width:100%; justify-content:center; }

    /* Live preview */
    /* Hidden below 1100px so it never meets the mobile header today, but it uses
       the same offset chain so it stays correct if that breakpoint ever moves. */
    .std-preview { position:sticky; top:calc(var(--app-header-h, 0px) + 78px); display:flex; flex-direction:column; gap:8px; }
    .std-preview-label { display:flex; align-items:center; gap:6px; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.06em; color:var(--text-muted); padding-left:4px; }
    .std-preview-frame { border-radius:var(--r-xl); padding:0; overflow:hidden; height:600px; }
    .std-preview-note { text-align:center; font-size:11px; color:var(--text-muted); margin:0; }

    /* Toast */
    .std-toast { position:fixed; bottom:24px; left:50%; transform:translateX(-50%); z-index:600; background:var(--text); color:var(--bg);
      padding:11px 20px; border-radius:var(--r); font-size:14px; font-weight:600; box-shadow:var(--shadow-lg); }

    /* ── Mini live-preview storefront ── */
    .lp { --lp-surface:#fff; position:relative; height:100%; overflow-y:auto; text-align:center; color:var(--lp-text, #1a1916); }
    .lp::-webkit-scrollbar { width:0; }
    .lp-mode-dark { --lp-surface:#1b1c20; color:var(--lp-text, #f2f0ea); }
    .lp-bg { position:absolute; inset:0; z-index:0; background:var(--bg); }
    .lp-mode-dark .lp-bg { background:#121316; }
    .lp-bgvideo { position:absolute; inset:0; z-index:0; width:100%; height:100%; object-fit:cover; }
    /* Overlay effect mirrors (scaled-down versions of the storefront's) */
    .lp-overlay { position:absolute; inset:0; z-index:1; pointer-events:none; }
    .lp-overlay-rain { background-image:linear-gradient(107deg, transparent 0 45%, color-mix(in srgb, var(--lp-text, #000) 42%, transparent) 47% 51%, transparent 53% 100%); background-size:8px 56px; animation:lpRain .55s linear infinite; opacity:.55; }
    @keyframes lpRain { to { background-position:-8px 56px; } }
    .lp-overlay-snow { --lpsnow:color-mix(in srgb, var(--lp-text, #000) 60%, transparent); background-image:radial-gradient(2px 2px at 20% 15%, var(--lpsnow) 60%, transparent), radial-gradient(1.5px 1.5px at 65% 40%, var(--lpsnow) 60%, transparent), radial-gradient(2px 2px at 40% 70%, var(--lpsnow) 60%, transparent), radial-gradient(1.5px 1.5px at 85% 20%, var(--lpsnow) 60%, transparent); background-size:140px 140px; animation:lpSnow 8s linear infinite; opacity:.55; }
    @keyframes lpSnow { from { background-position:0 -140px; } to { background-position:18px 140px; } }
    .lp-overlay-vhs { background:repeating-linear-gradient(to bottom, transparent 0 2px, rgba(0,0,0,.14) 2px 3px); mix-blend-mode:overlay; animation:lpVhs 4s steps(2) infinite; }
    @keyframes lpVhs { 0%,100% { opacity:.9; } 50% { opacity:.65; } }
    .lp-overlay-stars { --lpstar:color-mix(in srgb, var(--lp-text, #000) 80%, transparent);
      background-image:
        radial-gradient(1.4px 1.4px at 14% 20%, var(--lpstar) 60%, transparent),
        radial-gradient(1px 1px at 40% 60%, var(--lpstar) 60%, transparent),
        radial-gradient(1.8px 1.8px at 70% 30%, var(--lpstar) 60%, transparent),
        radial-gradient(1.2px 1.2px at 86% 72%, var(--lpstar) 60%, transparent),
        radial-gradient(1.4px 1.4px at 26% 86%, var(--lpstar) 60%, transparent);
      background-size:180px 180px; animation:lpStars 4.5s ease-in-out infinite; }
    @keyframes lpStars { 0%,100% { opacity:.4; } 50% { opacity:.95; } }
    .lp-overlay-particles { --lpp:color-mix(in srgb, var(--accent) 78%, transparent);
      background-image:
        radial-gradient(2.5px 2.5px at 16% 90%, var(--lpp) 60%, transparent),
        radial-gradient(1.8px 1.8px at 46% 72%, var(--lpp) 60%, transparent),
        radial-gradient(2px 2px at 72% 86%, var(--lpp) 60%, transparent),
        radial-gradient(2.4px 2.4px at 32% 44%, var(--lpp) 60%, transparent);
      background-size:180px 180px; animation:lpParticles 12s linear infinite; opacity:.7; }
    @keyframes lpParticles { from { background-position:0 0; } to { background-position:14px -180px; } }
    .lp-overlay-matrix {
      background-image:
        repeating-linear-gradient(90deg, transparent 0 10px, color-mix(in srgb, var(--accent) 20%, transparent) 10px 11px, transparent 11px 22px),
        linear-gradient(180deg, transparent 0 42%, color-mix(in srgb, var(--accent) 50%, transparent) 72%, transparent 100%);
      background-size:22px 100%, 22px 170px; animation:lpMatrix 1.8s linear infinite; opacity:.5; }
    @keyframes lpMatrix { from { background-position:0 0, 0 0; } to { background-position:0 0, 0 170px; } }
    .lp-audiopill { position:absolute; right:9px; bottom:9px; z-index:3; width:22px; height:22px; display:flex; align-items:center; justify-content:center; border-radius:50%; border:1px solid color-mix(in srgb, var(--accent) 40%, transparent); background:color-mix(in srgb, var(--accent) 14%, var(--lp-surface)); color:var(--lp-text, #1a1916); }
    /* Profile FX mirrors */
    .lp-pfx-glow { animation:lpPfxGlow 2.6s ease-in-out infinite; }
    @keyframes lpPfxGlow { 0%,100% { box-shadow:0 0 12px color-mix(in srgb, var(--accent) 22%, transparent); } 50% { box-shadow:0 0 24px color-mix(in srgb, var(--accent) 48%, transparent); } }
    .lp-pfx-float { animation:lpPfxFloat 4.5s ease-in-out infinite; }
    @keyframes lpPfxFloat { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-4px); } }
    .lp-inner { position:relative; z-index:1; margin:20px 14px; padding:24px 16px 22px; border-radius:20px; overflow:hidden;
      background:var(--lp-card-bg, var(--lp-surface)); -webkit-backdrop-filter:blur(var(--lp-card-blur,0px)); backdrop-filter:blur(var(--lp-card-blur,0px));
      border:1px solid color-mix(in srgb, var(--lp-text,#000) 12%, transparent);
      box-shadow:var(--shadow-lg), 0 0 var(--lp-glow-card, 0px) color-mix(in srgb, var(--accent) 62%, transparent);
      display:flex; flex-direction:column; align-items:center; }
    .lp-panelbanner { height:78px; margin:-24px -16px 12px; background:var(--surface-alt) center/cover no-repeat; align-self:stretch; }
    /* Mirrors .sf-coverbanner on the live page, at preview scale. Same single
       driving variable and the same 0.62 card offset, so what the creator sees
       here is the proportion they'll get — a preview with different geometry is
       worse than no preview, because it's confidently wrong.
       No 100vw breakout needed: the preview frame is already the full width of
       its own container, so left/right:0 IS full bleed here. */
    .lp-coverbanner { position:absolute; top:0; left:0; right:0; height:var(--lp-cover-h); z-index:0;
      background-position:center center; background-size:cover; background-repeat:no-repeat;
      pointer-events:none;
      -webkit-mask-image:linear-gradient(180deg, #000 0%, #000 46%, transparent 100%);
              mask-image:linear-gradient(180deg, #000 0%, #000 46%, transparent 100%); }
    /* Overrides the margin shorthand on .lp-inner. Same specificity, declared
       later, so it wins on order — no !important needed. */
    .lp-inner-cover { margin-top:calc(var(--lp-cover-h) * 0.62); }
    .lp-hasbanner .lp-avatar { margin-top:-42px; position:relative; z-index:1; }
    .lp-avatar { width:var(--lp-avatar-size, 67px); height:var(--lp-avatar-size, 67px); border-radius:var(--lp-avatar-radius, 50%); background:color-mix(in srgb, var(--accent) 16%, #fff) center/cover no-repeat;
      display:flex; align-items:center; justify-content:center; font-weight:800; font-size:calc(var(--lp-avatar-size, 67px) * 0.35); color:var(--accent); border:3px solid var(--lp-surface); box-shadow:var(--shadow), 0 0 var(--lp-glow-avatar, 0px) color-mix(in srgb, var(--accent) 85%, transparent); }
    .lp-name { font-size:20px; font-weight:800; letter-spacing:-.01em; margin-top:12px; color:var(--lp-title, inherit); filter:drop-shadow(0 0 var(--lp-glow-name, 0px) color-mix(in srgb, var(--accent) 100%, transparent)) drop-shadow(0 0 var(--lp-glow-name-strong, 0px) color-mix(in srgb, var(--accent) 55%, transparent)); }
    .lp-anim .lp-name { animation:sfNameGlow 2.6s ease-in-out infinite; }
    .lp-handle { font-size:13px; font-weight:600; color:var(--accent); margin-top:2px; }
    .lp-location { display:inline-flex; align-items:center; gap:4px; margin-top:5px; font-size:11px; font-weight:600;
      color:color-mix(in srgb, var(--lp-text, #5b574e) 58%, transparent); }
    .lp-location svg { flex-shrink:0; opacity:.85; }
    .lp-bio { font-size:var(--lp-bio-size, 15px); font-weight:var(--lp-bio-weight, 400); color:color-mix(in srgb, var(--lp-text, #5b574e) 75%, transparent); margin-top:10px; max-width:34ch; line-height:1.5;
      filter:drop-shadow(0 0 var(--lp-bio-glow, 0px) color-mix(in srgb, var(--accent) 70%, transparent)); }
    .lp-socials { display:flex; gap:8px; justify-content:center; margin-top:14px; color:var(--lp-text, #5b574e) }
    .lp-social { display:inline-flex; align-items:center; justify-content:center; padding:3px; color:var(--lp-text, #1a1916);
      filter:
        drop-shadow(0 0 calc(var(--lp-icon-glow, 6px) * 0.3) color-mix(in srgb, var(--accent) 90%, transparent))
        drop-shadow(0 0 var(--lp-icon-glow, 6px) color-mix(in srgb, var(--accent) 55%, transparent))
        drop-shadow(0 0 calc(var(--lp-icon-glow, 6px) * 2.2) color-mix(in srgb, var(--accent) 38%, transparent)); }
    .lp-mono .lp-social svg { filter:grayscale(1); opacity:.8; }
    .lp-ghost { border-color:transparent; box-shadow:none; }
    /* Featured sits between the profile card and the products, inset to the
       same gutter as both. */
    .lp-featured { margin:16px 14px 0; }
    .lp-featured .lpb:first-child { margin-top:0; }
    .lp-list { display:flex; flex-direction:column; gap:11px; margin:14px 14px 20px; }
    .lp-glow-soft .lp-card { box-shadow:0 0 18px color-mix(in srgb, var(--accent) 45%, transparent); }
    .lp-glow-strong .lp-card { box-shadow:0 0 26px color-mix(in srgb, var(--accent) 70%, transparent), 0 0 44px color-mix(in srgb, var(--accent) 38%, transparent); }
    .lp-grid { display:grid; grid-template-columns:1fr 1fr; }
    .lp-card { display:flex; gap:11px; align-items:center; text-align:left; padding:10px; border-radius:16px;
      backdrop-filter:blur(var(--lp-item-blur, 0px)); -webkit-backdrop-filter:blur(var(--lp-item-blur, 0px));
      background:color-mix(in srgb, var(--lp-text,#000) 6%, var(--lp-item-bg, transparent)); border:1px solid color-mix(in srgb, var(--lp-text, #000) 10%, transparent); }
    .lp-grid .lp-card { flex-direction:column; align-items:stretch; }
    .lp-empty { justify-content:center; color:color-mix(in srgb, var(--lp-text,#000) 45%, transparent); font-size:12px; font-weight:600; padding:22px; }
    .lp-cover { width:52px; height:52px; flex-shrink:0; border-radius:11px; background:color-mix(in srgb, var(--lp-text,#000) 8%, transparent) center/cover no-repeat; }
    .lp-grid .lp-cover { width:100%; height:auto; aspect-ratio:16/10; }
    .lp-card-body { min-width:0; }
    .lp-card-title { font-size:13.5px; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .lp-price { font-size:13px; font-weight:800; margin-top:3px; }
    /* Display-name effects mirror (matches Storefront .sf-fx-*) */
    .lp-fx-gradient .lp-name, .lp-fx-rainbow .lp-name, .lp-fx-shimmer .lp-name { color:transparent; -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; }
    .lp-fx-gradient .lp-name { background-image:linear-gradient(92deg, var(--accent), color-mix(in srgb, var(--accent) 45%, #fff)); }
    .lp-fx-rainbow .lp-name { background-image:linear-gradient(92deg, #ff2d75, #ff8c00, #ffd400, #00cc99, #00b3ff, #7a5cff, #ff2d75); background-size:220% auto; animation:lpRainbow 4.5s linear infinite; }
    @keyframes lpRainbow { to { background-position:220% center; } }
    .lp-fx-shimmer .lp-name { background-image:linear-gradient(100deg, var(--accent) 0 42%, #fff 50%, var(--accent) 58% 100%); background-size:250% auto; animation:lpShine 3.2s linear infinite; }
    @keyframes lpShine { to { background-position:-250% center; } }
    .lp-fx-glitch .lp-name { animation:lpGlitch 2.2s infinite steps(1); }
    @keyframes lpGlitch { 0%,88%,100% { text-shadow:none; } 90% { text-shadow:-2px 0 #ff2d75, 2px 0 #00c8ff; } 96% { text-shadow:1px 0 #ff2d75, -1px 0 #00c8ff; } }

    /* ── Preview link blocks ──
       Mirrors LinkBlock at preview scale. Colours fall through the same
       cascade as the live page: block -> page -> theme. */
    .lpb { width:100%; margin-top:10px; }
    .lpb-align-left .lpb-txt { text-align:left; align-items:flex-start; }
    .lpb-align-center .lpb-txt { text-align:center; align-items:center; }
    .lpb-align-right .lpb-txt { text-align:right; align-items:flex-end; }
    .lpb-align-center .lpb-title, .lpb-align-center .lpb-sub { text-align:center; }
    .lpb-align-right .lpb-title, .lpb-align-right .lpb-sub { text-align:right; }
    .lpb-align-left .lpb-noimg .lpb-txt { text-align:center; align-items:center; }
    .lpb-align-left .lpb-noimg .lpb-main { justify-content:center; }
    .lpb-outline .lpb-item { border-color:var(--lpb-fg, color-mix(in srgb, var(--lp-text, #000) 45%, transparent)); }
    .lpb-shadow .lpb-item { box-shadow:0 2px 6px color-mix(in srgb, #000 22%, transparent),
      0 0 var(--lp-glow-links, 0px) color-mix(in srgb, var(--accent) 78%, transparent); }
    .lpb-size-small { --lpb-thumb:30px; }
    .lpb-size-small .lpb-item { padding:7px 9px; }
    .lpb-size-small .lpb-label { font-size:10px; }
    .lpb-size-large { --lpb-thumb:42px; }
    .lpb-size-large .lpb-item { padding:11px 11px; }
    .lpb-size-large .lpb-label { font-size:11.5px; }
    .lpb-classic .lpb-cta { padding:6px 9px; }
    .lpb-featured { margin-top:14px; }
    .lpb-title { display:block; font-size:12.5px; font-weight:800; text-align:left;
      color:var(--lpb-head, var(--lp-text, inherit)); margin-bottom:2px; }
    .lpb-sub { display:block; font-size:11px; text-align:left; opacity:.75;
      color:var(--lpb-head, var(--lp-text, inherit)); margin-bottom:6px; }
    .lpb-items { display:flex; flex-direction:column; gap:8px; }
    .lpb-item { display:flex; flex-direction:column; align-items:stretch; gap:0; padding:9px 10px;
      border-radius:var(--lpb-shape, var(--lp-link-radius, 999px));
      font-size:11.5px; font-weight:700; overflow:hidden;
      background:var(--lpb-bg, var(--lp-link-bg, color-mix(in srgb, var(--accent) 12%, var(--lp-item-bg, transparent))));
      color:var(--lpb-fg, var(--lp-link-fg, var(--lp-text, inherit)));
      border:1px solid color-mix(in srgb, var(--accent) 30%, transparent);
      /* Mirrors .lkb-item — the Glow slider has to move something here too. */
      box-shadow:0 0 var(--lp-glow-links, 0px) color-mix(in srgb, var(--accent) 78%, transparent); }
    .lpb-main { display:flex; align-items:center; gap:8px; width:100%; min-width:0; }
    .lpb-txt { display:flex; flex-direction:column; gap:2px; min-width:0; flex:1; }
    .lpb-label { font-size:11px; font-weight:800; line-height:1.3; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .lpb-desc { font-size:10.5px; line-height:1.45; opacity:.72; font-weight:500;
      display:-webkit-box; -webkit-box-orient:vertical; overflow:hidden;
      -webkit-line-clamp:2; line-clamp:2; }
    .lpb-cta { display:block; width:100%; margin-top:6px; padding:7px 9px;
      border-radius:calc(var(--lpb-shape, var(--lp-link-radius, 999px)) * 0.6);
      font-size:10px; font-weight:800; letter-spacing:.05em; text-transform:uppercase;
      text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
      background:color-mix(in srgb, var(--lpb-fg, var(--lp-link-fg, var(--accent))) 88%, black);
      color:#fff; }
    .lpb-thumb { flex-shrink:0; width:var(--lpb-thumb, 35px); height:var(--lpb-thumb, 35px); border-radius:5px;
      background:var(--lp-surface) center/cover no-repeat; }
    /* Style variants — the same four shapes the Layouts tab offers. */
    .lpb-classic .lpb-thumb { width:calc(var(--lpb-thumb, 35px) * 0.9); height:calc(var(--lpb-thumb, 35px) * 0.9); border-radius:50%; }
    .lpb-grid .lpb-items { display:grid; grid-template-columns:repeat(var(--lpb-cols, 2), minmax(0,1fr)); gap:6px; }
    .lpb-grid .lpb-item, .lpb-carousel .lpb-item { text-align:center; border-radius:10px; padding:8px; }
    .lpb-grid .lpb-main, .lpb-carousel .lpb-main { flex-direction:column; align-items:stretch; gap:6px; }
    .lpb-grid .lpb-thumb, .lpb-carousel .lpb-thumb { width:100%; height:66px; border-radius:6px; }
    .lpb-carousel .lpb-items { display:flex; flex-direction:row; overflow-x:auto;
      scrollbar-width:none; }
    .lpb-carousel .lpb-items::-webkit-scrollbar { display:none; }
    .lpb-carousel .lpb-item { flex:0 0 96px; }
    .lpb-cards .lpb-item { border-radius:10px; padding:9px; }
    .lpb-cards .lpb-main { align-items:flex-start; }
    .lpb-cards .lpb-thumb { width:var(--lpb-thumb, 35px); height:var(--lpb-thumb, 35px); border-radius:7px; }
    .lp-btn-pill .lp-card, .lp-btn-pill .lp-cover { border-radius:999px; }
    .lp-btn-sharp .lp-card, .lp-btn-sharp .lp-cover { border-radius:5px; }

    @keyframes sfNameGlow { 0%,100% { text-shadow:0 0 0 transparent; } 50% { text-shadow:0 0 16px color-mix(in srgb, var(--accent) 65%, transparent); } }

    /* Preview goes first, rail stays beside the controls — at this width there's
       still room for 200px of nav, and losing it would put the section switcher
       back on top of a long scrolling column. */
    @media (max-width: 1100px) {
      .std-body { grid-template-columns:1fr; }
      .std-preview { display:none; }
    }
    @media (max-width: 780px) {
      .std { padding:14px 12px 60px; }
      .std-top { flex-wrap:wrap; }
      .std-body { gap:14px; }
    }
  `}</style>;
}
