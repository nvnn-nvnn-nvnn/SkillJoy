import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useUser, useProfile, useAuth } from '@/lib/stores';
import { listMySkills, reorderSkills } from '@/lib/skills';
import { initials } from '@/lib/stores';
import {
  resolveTheme, updateStorefront, SOCIAL_TYPES,
  listLinks, addLink, updateLink, deleteLink,
} from '@/lib/storefront';
import { uploadBanner } from '@/lib/storage';
import {
  Palette, Link2, LayoutTemplate, Eye, ImagePlus, X, Plus, ChevronUp, ChevronDown,
  ExternalLink, Check, Upload, MousePointer2, Type, Video, Music, Wand2, SlidersHorizontal,
  Image as ImageIcon, Sparkles, Camera, AtSign, User,
} from 'lucide-react';
import { BrandIcon } from '@/lib/brandIcons';

const ACCENT_PRESETS = ['#00CC99', '#2563EB', '#7C3AED', '#DB2777', '#F59E0B', '#EF4444', '#0D9488', '#F8FAFC'];

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

// ── Live preview — a faithful mini-storefront that reflects the draft theme ────
function LivePreview({ theme, name, handle, avatar, bio, socials, skills, links }) {
  const bgStyle =
    theme.bg === 'solid' ? { background: theme.bg_color } :
    theme.bg === 'gradient' ? { background: `linear-gradient(160deg, ${theme.bg_color}, ${theme.bg_color2})` } :
    (theme.bg === 'image' && theme.bg_image) ? { backgroundImage: `url(${theme.bg_image})`, backgroundSize: 'cover', backgroundPosition: 'center' } :
    undefined;
  const cls = [
    'lp', `lp-mode-${theme.mode}`, `lp-btn-${theme.button_style}`, `lp-glow-${theme.product_glow || 'none'}`,
    theme.mono_icons ? 'lp-mono' : '', theme.animated_name ? 'lp-anim' : '',
  ].filter(Boolean).join(' ');
  const style = {
    '--accent': theme.accent,
    '--lp-card-bg': `color-mix(in srgb, var(--lp-surface) ${theme.card_opacity ?? 100}%, transparent)`,
    '--lp-card-blur': `${theme.card_blur ?? 0}px`,
    '--lp-item-bg': `color-mix(in srgb, var(--lp-surface) ${theme.product_opacity ?? 100}%, transparent)`,
    '--lp-item-blur': `${theme.product_blur ?? 0}px`,
    '--lp-bio-size': `${theme.bio_size ?? 15}px`,
    '--lp-bio-weight': theme.bio_weight ?? 400,
    '--lp-bio-glow': `${theme.bio_glow ?? 0}px`,
  };
  if (theme.text_color) style['--lp-text'] = theme.text_color;
  if (theme.title_color) style['--lp-title'] = theme.title_color;
  const shown = (skills || []).filter(s => s.status === 'published').slice(0, 2);

  return (
    <div className={cls} style={style}>
      <div className="lp-bg" style={bgStyle} />
      <div className={`lp-inner${theme.banner_url ? ' lp-hasbanner' : ''}${theme.card_opacity === 0 ? ' lp-ghost' : ''}`}>
        {theme.banner_url && <div className="lp-panelbanner" style={{ backgroundImage: `url(${theme.banner_url})` }} />}
        <div className="lp-avatar" style={avatar ? { backgroundImage: `url(${avatar})` } : {}}>{!avatar && initials(name)}</div>
        <div className="lp-name">{name}</div>
        <div className="lp-handle">@{handle}</div>
        {bio && <div className="lp-bio">{bio}</div>}
        {(socials || []).filter(s => s.url).length > 0 && (
          <div className="lp-socials">
            {(socials || []).filter(s => s.url).map((s, i) => <span key={i} className="lp-social"><BrandIcon type={s.type} size={20} /></span>)}
          </div>
        )}
      </div>
      <div className={`lp-list${theme.layout === 'grid' ? ' lp-grid' : ''}`}>
          {shown.length === 0 && <div className="lp-card lp-empty">Your products appear here</div>}
          {shown.map(s => (
            <div key={s.id} className="lp-card">
              <div className="lp-cover" style={s.cover_url ? { backgroundImage: `url(${s.cover_url})` } : {}} />
              <div className="lp-card-body"><div className="lp-card-title">{s.title || 'Untitled'}</div><div className="lp-price">{s.price_cents ? `$${(s.price_cents / 100).toFixed(2)}` : 'Free'}</div></div>
            </div>
          ))}
          {(links || []).filter(l => l.url).slice(0, 2).map(l => (
            <div key={l.id} className="lp-linkbtn"><Link2 size={14} /> {l.label || 'Link'}</div>
          ))}
        </div>
    </div>
  );
}

// ── Studio ────────────────────────────────────────────────────────────────────
export default function StorefrontEditor() {
  const user = useUser();
  const profile = useProfile();
  const { setProfile } = useAuth();

  const [bio, setBio] = useState('');
  const [name, setName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [theme, setTheme] = useState(resolveTheme());
  const [pixels, setPixels] = useState({ meta: '', tiktok: '', ga4: '' });
  const [webhookUrl, setWebhookUrl] = useState('');
  const [skills, setSkills] = useState([]);
  const [links, setLinks] = useState([]);
  const [savingBanner, setSavingBanner] = useState(false);
  const [savingBg, setSavingBg] = useState(false);
  const [savingCursor, setSavingCursor] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState('');
  const [subTab, setSubTab] = useState('customize');
  const [dropOpen, setDropOpen] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!profile) return;
    setBio(profile.bio ?? '');
    setName(profile.full_name ?? '');
    setAvatarUrl(profile.avatar_url ?? '');
    setTheme(resolveTheme(profile.storefront_theme));
    setPixels({ meta: '', tiktok: '', ga4: '', ...(profile.tracking_pixels || {}) });
    setWebhookUrl(profile.automation_webhook_url ?? '');
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    listMySkills(user.id).then(s => setSkills(s.filter(x => x.status === 'published'))).catch(() => {});
    listLinks(user.id).then(setLinks).catch(() => {});
  }, [user]);

  if (!user || !profile) return <div className="std-loading">Loading…<Styles /></div>;

  const set = (patch) => setTheme(t => ({ ...t, ...patch }));
  const ping = (m) => { setToast(m); setTimeout(() => setToast(''), 2400); };

  async function save() {
    setErr('');
    const tp = Object.fromEntries(Object.entries(pixels).filter(([, v]) => v && v.trim()));
    const patch = {
      bio: bio.trim(), storefront_theme: theme,
      full_name: name.trim() || profile.full_name,
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

  async function uploadTo(file, setBusy, apply) {
    if (!file) return;
    setBusy(true);
    try { const url = await uploadBanner(user.id, file); apply(url); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }
  const onBanner = (e) => uploadTo(e.target.files?.[0], setSavingBanner, (url) => set({ banner_url: url }));
  const onBgImage = (e) => uploadTo(e.target.files?.[0], setSavingBg, (url) => set({ bg_image: url, bg: 'image' }));
  const onCursor = (e) => uploadTo(e.target.files?.[0], setSavingCursor, (url) => set({ cursor_url: url }));
  const onAvatar = (e) => uploadTo(e.target.files?.[0], setSavingAvatar, (url) => setAvatarUrl(url));

  function setSocial(i, patch) { setTheme(t => ({ ...t, socials: t.socials.map((s, j) => j === i ? { ...s, ...patch } : s) })); }
  function addSocial() { setTheme(t => ({ ...t, socials: [...(t.socials || []), { type: 'instagram', url: '' }] })); }
  function removeSocial(i) { setTheme(t => ({ ...t, socials: t.socials.filter((_, j) => j !== i) })); }

  async function createLink() { try { const l = await addLink(user.id, { label: 'New link', url: '', position: links.length }); setLinks([...links, l]); } catch (e) { setErr(e.message); } }
  function patchLinkLocal(id, patch) { setLinks(ls => ls.map(l => l.id === id ? { ...l, ...patch } : l)); }
  async function saveLink(id, patch) { try { await updateLink(id, patch); } catch (e) { setErr(e.message); } }
  async function removeLinkRow(id) { setLinks(ls => ls.filter(l => l.id !== id)); try { await deleteLink(id); } catch (e) { setErr(e.message); } }

  async function moveSkill(i, dir) {
    const j = i + dir; if (j < 0 || j >= skills.length) return;
    const next = [...skills]; [next[i], next[j]] = [next[j], next[i]];
    setSkills(next);
    try { await reorderSkills(next.map(s => s.id)); } catch (e) { setErr(e.message); }
  }

  return (
    <div className="std">
      <title>Customize — SkillJoy</title>
      <div className="std-bgfx" aria-hidden="true" />

      {/* ── Top header ── */}
      <header className="std-top">
        <div className="std-top-tabs">
          <div className="std-tabwrap">
            <button className="std-tab on" onClick={() => setDropOpen(o => !o)}>
              Storefront <ChevronDown size={15} className={`std-caret${dropOpen ? ' open' : ''}`} />
            </button>
            {dropOpen && (
              <>
                <div className="std-dropbg" onClick={() => setDropOpen(false)} />
                <div className="std-drop">
                  <button className={`std-dropitem${subTab === 'customize' ? ' on' : ''}`} onClick={() => { setSubTab('customize'); setDropOpen(false); }}><Palette size={15} /> Site Customization</button>
                  <button className={`std-dropitem${subTab === 'links' ? ' on' : ''}`} onClick={() => { setSubTab('links'); setDropOpen(false); }}><Link2 size={15} /> Links</button>
                  <button className="std-dropitem std-dropitem-wip" onClick={() => ping('Templates — work in progress')}><LayoutTemplate size={15} /> Templates <span className="std-wip">WIP</span></button>
                </div>
              </>
            )}
          </div>
          <button className="std-tab" onClick={() => ping('Analytics — coming soon')}>Analytics</button>
          <button className="std-tab" onClick={() => ping('Settings — coming soon')}>Settings</button>
        </div>
        <div className="std-top-actions">
          {profile.username && <Link to={`/@${profile.username}`} className="std-ghost"><ExternalLink size={15} /> View live</Link>}
          <button className="std-save" onClick={save}>{saved ? <><Check size={15} /> Saved</> : 'Save changes'}</button>
        </div>
      </header>
      {err && <p className="std-err">{err}</p>}

      <div className="std-body">
        {/* ── Main controls ── */}
        <main className="std-main">
          <div className="std-mainhead">{subTab === 'customize' ? 'Site Customization' : 'Links'}</div>
          {subTab === 'customize' && (
            <>
              <Panel icon={User} title="Profile">
                <Field label="Profile picture">
                  <div className="std-avatarrow">
                    <div className="std-avatar" style={avatarUrl ? { backgroundImage: `url(${avatarUrl})` } : {}}>{!avatarUrl && (name ? name[0] : '?')}</div>
                    <label className="std-addbtn">
                      <input type="file" accept="image/*" hidden onChange={onAvatar} />
                      {savingAvatar ? 'Uploading…' : <><Camera size={14} /> {avatarUrl ? 'Change' : 'Upload'}</>}
                    </label>
                    {avatarUrl && <button className="std-removebtn" onClick={() => setAvatarUrl('')}><X size={13} /> Remove</button>}
                  </div>
                </Field>
                <Field label="Display name">
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" />
                </Field>
                <Field label="Bio">
                  <textarea rows={3} value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell visitors what you offer…" />
                </Field>
                <p className="std-note">Your handle: skilljoy.me/@{profile.username}</p>
              </Panel>

              <Panel icon={ImageIcon} title="Assets">
                <Field label="Background">
                  <Seg value={theme.bg} onChange={v => set({ bg: v })} options={[{ v: 'canvas', label: 'Canvas' }, { v: 'solid', label: 'Solid' }, { v: 'gradient', label: 'Gradient' }, { v: 'image', label: 'Image' }]} />
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

                <Field label="Banner">
                  <label className="std-upload std-upload-wide" style={theme.banner_url ? { backgroundImage: `url(${theme.banner_url})` } : {}}>
                    <input type="file" accept="image/*" hidden onChange={onBanner} />
                    <span>{savingBanner ? 'Uploading…' : <><ImagePlus size={15} /> {theme.banner_url ? 'Change banner' : 'Add banner'}</>}</span>
                  </label>
                  {theme.banner_url && <button className="std-removebtn" onClick={() => set({ banner_url: '' })}><X size={13} /> Remove banner</button>}
                </Field>

                <Field label="Custom cursor">
                  <label className="std-upload std-upload-sm" style={theme.cursor_url ? { backgroundImage: `url(${theme.cursor_url})`, backgroundSize: 'contain' } : {}}>
                    <input type="file" accept="image/*" hidden onChange={onCursor} />
                    <span>{savingCursor ? '…' : <><MousePointer2 size={14} /> {theme.cursor_url ? 'Change' : 'Upload'}</>}</span>
                  </label>
                  {theme.cursor_url && <button className="std-removebtn" onClick={() => set({ cursor_url: '' })}><X size={13} /> Remove</button>}
                </Field>

                <div className="std-soontiles">
                  <div className="std-soontile"><Video size={15} /> Video / GIF background <span className="std-soon">Soon</span></div>
                  <div className="std-soontile"><Music size={15} /> Audio + waveform <span className="std-soon">Soon</span></div>
                </div>
              </Panel>

              <Panel icon={SlidersHorizontal} title="General">
                <Field label="Profile opacity"><Slider value={theme.card_opacity ?? 100} min={0} max={100} suffix="%" onChange={v => set({ card_opacity: v })} /></Field>
                <Field label="Profile blur (glass)"><Slider value={theme.card_blur ?? 0} min={0} max={24} suffix="px" onChange={v => set({ card_blur: v })} /></Field>
                <p className="std-note">Lower opacity + more blur = frosted glass over your background.</p>


                {/* Bio size */}

                <Field label="Bio Size"> <Slider value={theme.bio_size ?? 15} min={11} max={25} suffix="px" onChange={v => set({ bio_size: v })} /></Field>
                <Field label="Bio weight"><Slider value={theme.bio_weight ?? 400} min={300} max={800} step={100} onChange={v => set({ bio_weight: v })} /></Field>
                <Field label="Bio glow"><Slider value={theme.bio_glow ?? 0} min={0} max={20} suffix="px" onChange={v => set({ bio_glow: v })} /></Field>
                <p className="std-note">Size, boldness &amp; accent glow for your bio.</p>
              </Panel>

              <Panel icon={Palette} title="Color &amp; Theme">
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
                {/* Bio Size */}
                {/* <Field label="Bio Size">
                  <div className="std-colorrow">

                  </div>

                </Field> */}




                <Field label="Title Color">
                  <div className="std-colorrow">
                    <input type="color" value={theme.title_color || '#fff'} onChange={e => set({title_color: e.target.value})}/>
                    <span>{theme.title_color || 'Default'}</span>
                    {theme.title_color && <button className="std-textbtn" onClick={() => set({ title_color: '' })}>Reset</button>}
                  </div>

                </Field>
                
              </Panel>

              <Panel icon={Wand2} title="Animations &amp; Effects">
                <Field label="Button style"><Seg value={theme.button_style} onChange={v => set({ button_style: v })} options={[{ v: 'rounded', label: 'Rounded' }, { v: 'pill', label: 'Pill' }, { v: 'sharp', label: 'Sharp' }]} /></Field>
                <Field label="Product layout"><Seg value={theme.layout} onChange={v => set({ layout: v })} options={[{ v: 'list', label: 'List' }, { v: 'grid', label: 'Grid' }]} /></Field>
                <Field label="Product glow"><Seg value={theme.product_glow || 'none'} onChange={v => set({ product_glow: v })} options={[{ v: 'none', label: 'None' }, { v: 'soft', label: 'Soft' }, { v: 'strong', label: 'Strong' }]} /></Field>
                <Field label="Product opacity (glass)"><Slider value={theme.product_opacity ?? 100} min={40} max={100} suffix="%" onChange={v => set({ product_opacity: v })} /></Field>
                <Field label="Product blur (glass)"><Slider value={theme.product_blur ?? 0} min={0} max={24} suffix="px" onChange={v => set({ product_blur: v })} /></Field>
                <Toggle on={!!theme.mono_icons} onChange={v => set({ mono_icons: v })} label="Monochrome icons" hint="Grayscale social icons" />
                <Toggle on={!!theme.animated_name} onChange={v => set({ animated_name: v })} label="Animated username" hint="Subtle accent glow" />
                <div className="std-soontiles">
                  <div className="std-soontile"><Sparkles size={15} /> Particle effects <span className="std-soon">Soon</span></div>
                  <div className="std-soontile"><Type size={15} /> Custom fonts <span className="std-soon">Soon</span></div>
                </div>
              </Panel>

              <Panel icon={Wand2} title="Product order">
                {skills.length === 0 && <p className="std-note">No published products yet.</p>}
                {skills.map((s, i) => (
                  <div key={s.id} className="std-orderrow">
                    <span className="std-ordername">{s.title || 'Untitled'}</span>
                    <div className="std-orderbtns">
                      <button className="std-icobtn" disabled={i === 0} onClick={() => moveSkill(i, -1)}><ChevronUp size={16} /></button>
                      <button className="std-icobtn" disabled={i === skills.length - 1} onClick={() => moveSkill(i, 1)}><ChevronDown size={16} /></button>
                    </div>
                  </div>
                ))}
                <p className="std-note"><Upload size={13} /> Drag-and-drop reordering — coming soon.</p>
              </Panel>
            </>
          )}

          {subTab === 'links' && (
            <>
              <Panel icon={AtSign} title="Social links">
                {(theme.socials || []).map((s, i) => (
                  <div key={i} className="std-row">
                    <select value={s.type} onChange={e => setSocial(i, { type: e.target.value })}>
                      {SOCIAL_TYPES.map(t => <option key={t.type} value={t.type}>{t.label}</option>)}
                    </select>
                    <input value={s.url} onChange={e => setSocial(i, { url: e.target.value })} placeholder="https://…" />
                    <button className="std-icobtn" onClick={() => removeSocial(i)}><X size={15} /></button>
                  </div>
                ))}
                <button className="std-addbtn" onClick={addSocial}><Plus size={15} /> Add social</button>
              </Panel>

              <Panel icon={Link2} title="Link buttons">
                {links.map(l => (
                  <div key={l.id} className="std-linkcard">
                    <div className="std-row">
                      <input value={l.label} onChange={e => patchLinkLocal(l.id, { label: e.target.value })} onBlur={e => saveLink(l.id, { label: e.target.value })} placeholder="Label" />
                      <button className="std-icobtn" onClick={() => removeLinkRow(l.id)}><X size={15} /></button>
                    </div>
                    <input value={l.url} onChange={e => patchLinkLocal(l.id, { url: e.target.value })} onBlur={e => saveLink(l.id, { url: e.target.value })} placeholder="https://…" />
                    <label className="std-check"><input type="checkbox" checked={!!l.is_affiliate} onChange={e => { patchLinkLocal(l.id, { is_affiliate: e.target.checked }); saveLink(l.id, { is_affiliate: e.target.checked }); }} /> Affiliate link</label>
                  </div>
                ))}
                <button className="std-addbtn" onClick={createLink}><Plus size={15} /> Add link</button>
              </Panel>
            </>
          )}
        </main>

        {/* ── Live preview ── */}
        <aside className="std-preview">
          <div className="std-preview-label"><Eye size={13} /> Live preview</div>
          <div className="std-preview-frame">
            <LivePreview theme={theme} name={name || `@${profile.username}`} handle={profile.username} avatar={avatarUrl} bio={bio} socials={theme.socials} skills={skills} links={links} />
          </div>
          <p className="std-preview-note">Updates as you edit · Save to publish</p>
        </aside>
      </div>

      {toast && <div className="std-toast">{toast}</div>}
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
      padding:10px 14px; border-radius:var(--r-lg); margin-bottom:16px; position:sticky; top:12px; z-index:30; }
    .std-top-tabs { display:flex; gap:4px; }
    .std-tab { width:auto; min-width:0; padding:9px 18px; border-radius:var(--r-full); border:none; background:transparent;
      color:var(--text-secondary); font-size:14px; font-weight:700; cursor:pointer; transition:all .15s; }
    .std-tab:hover { background:var(--surface-alt); color:var(--text); }
    .std-tab.on { background:var(--accent); color:#fff; box-shadow:0 4px 14px color-mix(in srgb, var(--accent) 34%, transparent); }
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
    .std-mainhead { font-size:13px; font-weight:800; text-transform:uppercase; letter-spacing:.06em; color:var(--text-muted); padding:2px; }
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
    .std-err { color:#b91c1c; background:#fef2f2; border:1px solid #fecaca; border-radius:var(--r); padding:9px 13px; font-size:13px; margin-bottom:12px; }

    /* Body: subnav | main | preview */
    .std-body { display:grid; grid-template-columns:minmax(0,1fr) 380px; gap:16px; align-items:start; }

    .std-sub { border-radius:var(--r-lg); padding:10px; display:flex; flex-direction:column; gap:4px; position:sticky; top:78px; }
    .std-subitem { width:100%; display:flex; align-items:center; gap:10px; padding:11px 13px; border:none; border-radius:var(--r);
      background:transparent; color:var(--text-secondary); font-size:14px; font-weight:600; cursor:pointer; text-align:left; transition:all .14s; }
    .std-subitem:hover { background:var(--surface-alt); color:var(--text); }
    .std-subitem.on { background:color-mix(in srgb, var(--accent) 14%, transparent); color:var(--accent); }
    .std-subitem-wip { opacity:.7; }
    .std-wip { margin-left:auto; font-size:9px; font-weight:800; letter-spacing:.05em; padding:2px 6px; border-radius:var(--r-full); background:var(--surface-alt); color:var(--text-muted); }

    .std-main { display:flex; flex-direction:column; gap:16px; min-width:0; }
    .std-panel { border-radius:var(--r-lg); padding:20px; }
    .std-panel-head { display:flex; align-items:center; gap:10px; margin-bottom:16px; }
    .std-panel-icon { display:inline-flex; align-items:center; justify-content:center; width:32px; height:32px; border-radius:var(--r-sm);
      background:color-mix(in srgb, var(--accent) 15%, transparent); color:var(--accent); }
    .std-panel-title { font-size:16px; font-weight:800; letter-spacing:-.01em; margin:0; }
    .std-soon { font-size:9px; font-weight:800; letter-spacing:.05em; text-transform:uppercase; padding:2px 7px; border-radius:var(--r-full);
      background:var(--surface-alt); color:var(--text-muted); }

    .std-field { margin-bottom:16px; }
    .std-field:last-child { margin-bottom:0; }
    .std-flabel { display:block; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.05em; color:var(--text-muted); margin-bottom:8px; }
    .std-note { font-size:12px; color:var(--text-muted); margin:10px 0 0; display:flex; align-items:center; gap:6px; }

    .std-seg { display:flex; gap:4px; padding:4px; background:var(--surface-alt); border-radius:var(--r-full); }
    .std-seg button { flex:1; width:auto; min-width:0; border:none; border-radius:var(--r-full); background:transparent; padding:8px 10px;
      font-size:13px; font-weight:700; color:var(--text-secondary); cursor:pointer; transition:all .14s; }
    .std-seg button.on { background:var(--accent); color:#fff; }

    .std-slider { display:flex; align-items:center; gap:12px; }
    .std-slider input[type=range] { flex:1; accent-color:var(--accent); }
    .std-slider-val { font-size:13px; font-weight:800; color:var(--text); min-width:44px; text-align:right; }

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
    .std-removebtn { width:auto; display:inline-flex; align-items:center; gap:5px; margin-top:9px; padding:6px 12px; border-radius:var(--r-full); border:1px solid var(--border-strong, var(--border)); background:var(--surface); color:var(--text-secondary); font-size:12px; font-weight:700; cursor:pointer; transition:border-color .13s ease, color .13s ease, background .13s ease; }
    .std-removebtn:hover { border-color:#ef4444; color:#ef4444; background:color-mix(in srgb, #ef4444 8%, transparent); }
    .std-removebtn svg { flex-shrink:0; }

    .std-soontiles { display:flex; flex-wrap:wrap; gap:8px; margin-top:14px; }
    .std-soontile { display:inline-flex; align-items:center; gap:7px; padding:9px 13px; border:1px dashed var(--border-strong); border-radius:var(--r);
      background:var(--surface-alt); color:var(--text-muted); font-size:12.5px; font-weight:600; }

    .std-toggle-row { width:100%; display:flex; align-items:center; justify-content:space-between; gap:12px; padding:11px 0; border:none; background:none; cursor:pointer; }
    .std-toggle-txt { display:flex; flex-direction:column; gap:2px; text-align:left; }
    .std-toggle-label { font-size:14px; font-weight:700; color:var(--text); }
    .std-toggle-hint { font-size:12px; color:var(--text-muted); }
    .std-toggle { width:42px; height:24px; border-radius:var(--r-full); background:var(--border-strong); position:relative; transition:background .16s; flex-shrink:0; }
    .std-toggle-knob { position:absolute; top:3px; left:3px; width:18px; height:18px; border-radius:50%; background:#fff; transition:transform .16s; box-shadow:var(--shadow-sm); }
    .std-toggle-row.on .std-toggle { background:var(--accent); }
    .std-toggle-row.on .std-toggle-knob { transform:translateX(18px); }

    .std-orderrow { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 0; border-top:1px solid var(--border); }
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
    .std-linkcard { border:1px solid var(--border); border-radius:var(--r); padding:14px; margin-bottom:10px; background:var(--surface-alt); }
    .std-linkcard input { width:100%; margin-bottom:8px; }
    .std-check { display:flex; align-items:center; gap:7px; font-size:13px; color:var(--text-secondary); font-weight:500; }
    .std-check input { width:16px; height:16px; accent-color:var(--accent); }
    .std-addbtn { width:auto; min-width:0; display:inline-flex; align-items:center; gap:6px; padding:9px 16px; border-radius:var(--r-full);
      border:1.5px solid var(--border-strong); background:var(--surface); color:var(--text); font-size:13px; font-weight:700; cursor:pointer; }
    .std-addbtn:hover { border-color:var(--accent); color:var(--accent); }

    /* Live preview */
    .std-preview { position:sticky; top:78px; display:flex; flex-direction:column; gap:8px; }
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
    .lp-inner { position:relative; z-index:1; margin:20px 14px; padding:24px 16px 22px; border-radius:20px; overflow:hidden;
      background:var(--lp-card-bg, var(--lp-surface)); -webkit-backdrop-filter:blur(var(--lp-card-blur,0px)); backdrop-filter:blur(var(--lp-card-blur,0px));
      border:1px solid color-mix(in srgb, var(--lp-text,#000) 12%, transparent); box-shadow:var(--shadow-lg);
      display:flex; flex-direction:column; align-items:center; }
    .lp-panelbanner { height:78px; margin:-24px -16px 12px; background:var(--surface-alt) center/cover no-repeat; align-self:stretch; }
    .lp-hasbanner .lp-avatar { margin-top:-42px; position:relative; z-index:1; }
    .lp-avatar { width:74px; height:74px; border-radius:50%; background:color-mix(in srgb, var(--accent) 16%, #fff) center/cover no-repeat;
      display:flex; align-items:center; justify-content:center; font-weight:800; font-size:26px; color:var(--accent); border:3px solid var(--lp-surface); box-shadow:var(--shadow); }
    .lp-name { font-size:20px; font-weight:800; letter-spacing:-.01em; margin-top:12px; color:var(--lp-title, inherit); }
    .lp-anim .lp-name { animation:sfNameGlow 2.6s ease-in-out infinite; }
    .lp-handle { font-size:13px; font-weight:600; color:var(--accent); margin-top:2px; }
    .lp-bio { font-size:var(--lp-bio-size, 15px); font-weight:var(--lp-bio-weight, 400); color:color-mix(in srgb, var(--lp-text, #5b574e) 75%, transparent); margin-top:10px; max-width:34ch; line-height:1.5;
      filter:drop-shadow(0 0 var(--lp-bio-glow, 0px) color-mix(in srgb, var(--accent) 70%, transparent)); }
    .lp-socials { display:flex; gap:8px; justify-content:center; margin-top:14px; color:var(--lp-text, #5b574e) }
    .lp-social { display:inline-flex; align-items:center; justify-content:center; padding:3px; color:var(--lp-text, #1a1916);
      filter:drop-shadow(0 0 6px color-mix(in srgb, var(--accent) 55%, transparent)); }
    .lp-mono .lp-social svg { filter:grayscale(1); opacity:.8; }
    .lp-ghost { border-color:transparent; box-shadow:none; }
    .lp-list { display:flex; flex-direction:column; gap:11px; margin:14px 14px 20px; }
    .lp-glow-soft .lp-card { box-shadow:0 0 16px color-mix(in srgb, var(--accent) 32%, transparent); }
    .lp-glow-strong .lp-card { box-shadow:0 0 26px color-mix(in srgb, var(--accent) 55%, transparent); }
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
    .lp-linkbtn { display:flex; align-items:center; justify-content:center; gap:8px; padding:12px; border-radius:999px; font-size:13px; font-weight:700;
      backdrop-filter:blur(var(--lp-item-blur, 0px)); -webkit-backdrop-filter:blur(var(--lp-item-blur, 0px));
      background:color-mix(in srgb, var(--accent) 12%, var(--lp-item-bg, transparent)); border:1.5px solid color-mix(in srgb, var(--accent) 32%, transparent); }
    .lp-btn-pill .lp-card, .lp-btn-pill .lp-cover { border-radius:999px; }
    .lp-btn-sharp .lp-card, .lp-btn-sharp .lp-cover { border-radius:5px; }

    @keyframes sfNameGlow { 0%,100% { text-shadow:0 0 0 transparent; } 50% { text-shadow:0 0 16px color-mix(in srgb, var(--accent) 65%, transparent); } }

    @media (max-width: 1100px) {
      .std-body { grid-template-columns:1fr; }
      .std-preview { display:none; }
    }
    @media (max-width: 780px) {
      .std { padding:14px 12px 60px; }
      .std-top { flex-wrap:wrap; }
    }
  `}</style>;
}
