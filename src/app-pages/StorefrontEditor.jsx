import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useUser, useProfile, useAuth } from '@/lib/stores';
import { listMySkills, reorderSkills } from '@/lib/skills';
import {
  resolveTheme, updateStorefront, SOCIAL_TYPES,
  listLinks, addLink, updateLink, deleteLink,
} from '@/lib/storefront';
import { uploadBanner } from '@/lib/storage';

const ACCENT_PRESETS = ['#D4522A', '#2A7A4B', '#2563EB', '#7C3AED', '#DB2777', '#0D9488', '#1A1916'];

// Phase 7 — storefront editor / design control. Edit theme, banner, bio, social
// links, link buttons, and Skill order. See docs/v3-skill-platform/08.
export default function StorefrontEditor() {
  const user = useUser();
  const profile = useProfile();
  const { setProfile } = useAuth();

  const [bio, setBio] = useState('');
  const [theme, setTheme] = useState(resolveTheme());
  const [pixels, setPixels] = useState({ meta: '', tiktok: '', ga4: '' });
  const [webhookUrl, setWebhookUrl] = useState('');
  const [skills, setSkills] = useState([]);
  const [links, setLinks] = useState([]);
  const [savingBanner, setSavingBanner] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!profile) return;
    setBio(profile.bio ?? '');
    setTheme(resolveTheme(profile.storefront_theme));
    setPixels({ meta: '', tiktok: '', ga4: '', ...(profile.tracking_pixels || {}) });
    setWebhookUrl(profile.automation_webhook_url ?? '');
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    listMySkills(user.id).then(s => setSkills(s.filter(x => x.status === 'published'))).catch(() => {});
    listLinks(user.id).then(setLinks).catch(() => {});
  }, [user]);

  if (!user || !profile) return <div className="se-wrap"><p className="se-muted">Loading…</p><EditorStyles /></div>;

  async function save() {
    setErr('');
    const tp = Object.fromEntries(Object.entries(pixels).filter(([, v]) => v && v.trim()));
    const patch = {
      bio: bio.trim(),
      storefront_theme: theme,
      tracking_pixels: Object.keys(tp).length ? tp : null,
      automation_webhook_url: webhookUrl.trim() || null,
    };
    try {
      await updateStorefront(user.id, patch);
      setProfile({ ...profile, ...patch });
      setSaved(true); setTimeout(() => setSaved(false), 1500);
    } catch (e) { setErr(e.message); }
  }

  async function onBanner(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSavingBanner(true);
    try {
      const url = await uploadBanner(user.id, file);
      setTheme(t => ({ ...t, banner_url: url }));
    } catch (e2) { setErr(e2.message); }
    finally { setSavingBanner(false); }
  }

  // ── Socials ──
  function setSocial(i, patch) { setTheme(t => ({ ...t, socials: t.socials.map((s, j) => j === i ? { ...s, ...patch } : s) })); }
  function addSocial() { setTheme(t => ({ ...t, socials: [...t.socials, { type: 'instagram', url: '' }] })); }
  function removeSocial(i) { setTheme(t => ({ ...t, socials: t.socials.filter((_, j) => j !== i) })); }

  // ── Link buttons (persist immediately) ──
  async function createLink() {
    try { const l = await addLink(user.id, { label: 'New link', url: '', position: links.length }); setLinks([...links, l]); }
    catch (e) { setErr(e.message); }
  }
  function patchLinkLocal(id, patch) { setLinks(ls => ls.map(l => l.id === id ? { ...l, ...patch } : l)); }
  async function saveLink(id, patch) { try { await updateLink(id, patch); } catch (e) { setErr(e.message); } }
  async function removeLinkRow(id) { setLinks(ls => ls.filter(l => l.id !== id)); try { await deleteLink(id); } catch (e) { setErr(e.message); } }

  // ── Skill order ──
  async function moveSkill(i, dir) {
    const j = i + dir; if (j < 0 || j >= skills.length) return;
    const next = [...skills]; [next[i], next[j]] = [next[j], next[i]];
    setSkills(next);
    try { await reorderSkills(next.map(s => s.id)); } catch (e) { setErr(e.message); }
  }

  return (
    <div className="se-wrap">
      <title>Customize storefront — SkillJoy</title>
      <div className="se-head">
        <div>
          <h1 className="se-h1">Customize your store</h1>
          <p className="se-muted">skilljoy.me/@{profile.username}</p>
        </div>
        <div className="se-head-actions">
          {profile.username && <Link to={`/@${profile.username}`} className="btn btn-ghost btn-sm">Preview ↗</Link>}
          <button className="btn btn-primary btn-sm" onClick={save}>{saved ? 'Saved ✓' : 'Save'}</button>
        </div>
      </div>
      {err && <p className="se-err">{err}</p>}

      {/* Branding */}
      <section className="se-card">
        <h2 className="se-h2">Branding</h2>

        <label className="se-label">Accent color</label>
        <div className="se-swatches">
          {ACCENT_PRESETS.map(c => (
            <button key={c} className={`se-swatch${theme.accent === c ? ' on' : ''}`} style={{ background: c }}
              onClick={() => setTheme(t => ({ ...t, accent: c }))} aria-label={c} />
          ))}
          <input type="color" value={theme.accent} onChange={e => setTheme(t => ({ ...t, accent: e.target.value }))} className="se-colorpick" />
        </div>

        <label className="se-label">Layout</label>
        <div className="se-seg">
          <button className={theme.layout === 'list' ? 'on' : ''} onClick={() => setTheme(t => ({ ...t, layout: 'list' }))}>List</button>
          <button className={theme.layout === 'grid' ? 'on' : ''} onClick={() => setTheme(t => ({ ...t, layout: 'grid' }))}>Grid</button>
        </div>

        <label className="se-label">Banner</label>
        <label className="se-banner" style={theme.banner_url ? { backgroundImage: `url(${theme.banner_url})` } : {}}>
          <input type="file" accept="image/*" hidden onChange={onBanner} />
          <span className="se-banner-cta">{savingBanner ? 'Uploading…' : theme.banner_url ? 'Change banner' : '+ Add banner'}</span>
        </label>
        {theme.banner_url && <button className="se-textbtn" onClick={() => setTheme(t => ({ ...t, banner_url: '' }))}>Remove banner</button>}

        <label className="se-label" htmlFor="se-bio">Bio</label>
        <textarea id="se-bio" rows={3} value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell visitors what you offer…" />
      </section>

      {/* Socials */}
      <section className="se-card">
        <h2 className="se-h2">Social links</h2>
        {theme.socials.map((s, i) => (
          <div key={i} className="se-row">
            <select value={s.type} onChange={e => setSocial(i, { type: e.target.value })}>
              {SOCIAL_TYPES.map(t => <option key={t.type} value={t.type}>{t.label}</option>)}
            </select>
            <input value={s.url} onChange={e => setSocial(i, { url: e.target.value })} placeholder="https://…" />
            <button className="se-iconbtn" onClick={() => removeSocial(i)} aria-label="Remove">✕</button>
          </div>
        ))}
        <button className="btn btn-secondary btn-sm" onClick={addSocial}>+ Add social</button>
      </section>

      {/* Link buttons */}
      <section className="se-card">
        <h2 className="se-h2">Link buttons</h2>
        <p className="se-muted se-hint">External or affiliate links shown on your store.</p>
        {links.map(l => (
          <div key={l.id} className="se-linkrow">
            <div className="se-row">
              <input value={l.label} onChange={e => patchLinkLocal(l.id, { label: e.target.value })} onBlur={e => saveLink(l.id, { label: e.target.value })} placeholder="Label" />
              <button className="se-iconbtn" onClick={() => removeLinkRow(l.id)} aria-label="Remove">✕</button>
            </div>
            <input className="se-fullinput" value={l.url} onChange={e => patchLinkLocal(l.id, { url: e.target.value })} onBlur={e => saveLink(l.id, { url: e.target.value })} placeholder="https://…" />
            <label className="se-check">
              <input type="checkbox" checked={!!l.is_affiliate} onChange={e => { patchLinkLocal(l.id, { is_affiliate: e.target.checked }); saveLink(l.id, { is_affiliate: e.target.checked }); }} />
              Affiliate link
            </label>
          </div>
        ))}
        <button className="btn btn-secondary btn-sm" onClick={createLink}>+ Add link</button>
      </section>

      {/* Skill order */}
      <section className="se-card">
        <h2 className="se-h2">Skill order</h2>
        {skills.length === 0 && <p className="se-muted">No published Skills yet.</p>}
        {skills.map((s, i) => (
          <div key={s.id} className="se-orderrow">
            <span className="se-ordername">{s.title || 'Untitled'}</span>
            <div className="se-orderbtns">
              <button className="se-iconbtn" disabled={i === 0} onClick={() => moveSkill(i, -1)}>↑</button>
              <button className="se-iconbtn" disabled={i === skills.length - 1} onClick={() => moveSkill(i, 1)}>↓</button>
            </div>
          </div>
        ))}
      </section>

      {/* Integrations: pixels + automation webhook */}
      <section className="se-card">
        <h2 className="se-h2">Tracking & automation</h2>
        <label className="se-label">Meta (Facebook) Pixel ID</label>
        <input value={pixels.meta} onChange={e => setPixels(p => ({ ...p, meta: e.target.value }))} placeholder="e.g. 123456789012345" />
        <label className="se-label">TikTok Pixel ID</label>
        <input value={pixels.tiktok} onChange={e => setPixels(p => ({ ...p, tiktok: e.target.value }))} placeholder="e.g. CXXXXXXXXXXXXXXXXX" />
        <label className="se-label">Google Analytics (GA4) ID</label>
        <input value={pixels.ga4} onChange={e => setPixels(p => ({ ...p, ga4: e.target.value }))} placeholder="e.g. G-XXXXXXXXXX" />
        <p className="se-hint">Pixels fire on your public storefront & sales pages — great for retargeting.</p>

        <label className="se-label">Automation webhook URL</label>
        <input value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} placeholder="https://hooks.zapier.com/…" />
        <p className="se-hint">We POST a JSON event here on each sale — connect Zapier/Make for auto-DMs, sheets, etc.</p>
      </section>

      <EditorStyles />
    </div>
  );
}

function EditorStyles() {
  return <style>{`
    .se-wrap { max-width:600px; margin:0 auto; padding:24px 16px 80px; }
    .se-head { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:18px; }
    .se-head-actions { display:flex; gap:8px; }
    .se-h1 { font-size:24px; font-weight:700; font-family:var(--font-display); }
    .se-h2 { font-size:16px; font-weight:700; margin-bottom:14px; }
    .se-muted { color:var(--text-muted); font-size:14px; }
    .se-hint { margin-top:-8px; margin-bottom:12px; }
    .se-err { color:var(--accent); background:var(--accent-light); border:1px solid var(--accent-mid); border-radius:var(--r-sm); padding:8px 12px; font-size:13px; margin-bottom:12px; }
    .se-card { border:1px solid var(--border); border-radius:var(--r-lg); background:var(--surface); padding:18px; margin-bottom:16px; }
    .se-label { display:block; font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:var(--text-muted); margin:16px 0 8px; }
    .se-label:first-of-type { margin-top:0; }
    .se-card > input { width:100%; }
    .se-hint { font-size:12px; color:var(--text-muted); margin:6px 0 4px; }

    .se-swatches { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
    .se-swatch { width:30px; height:30px; border-radius:50%; border:2px solid transparent; cursor:pointer; }
    .se-swatch.on { border-color:var(--text); box-shadow:0 0 0 2px var(--surface) inset; }
    .se-colorpick { width:36px; height:32px; padding:0; border:1px solid var(--border-strong); border-radius:8px; background:none; cursor:pointer; }

    .se-seg { display:flex; border:1px solid var(--border-strong); border-radius:var(--r-full); overflow:hidden; width:fit-content; }
    .se-seg button { border:none; background:var(--surface); padding:7px 20px; font-size:13px; font-weight:600; color:var(--text-muted); cursor:pointer; }
    .se-seg button.on { background:var(--accent); color:#fff; }

    .se-banner { display:flex; align-items:center; justify-content:center; aspect-ratio:16/5; border:1.5px dashed var(--border-strong); border-radius:var(--r); background:var(--surface-alt) center/cover no-repeat; cursor:pointer; }
    .se-banner-cta { background:rgba(0,0,0,.55); color:#fff; padding:6px 14px; border-radius:var(--r-full); font-size:13px; font-weight:600; }
    .se-textbtn { background:none; border:none; color:var(--text-muted); font-size:13px; cursor:pointer; margin-top:6px; padding:0; }
    .se-textbtn:hover { color:var(--accent); }

    .se-row { display:flex; gap:8px; align-items:center; margin-bottom:8px; }
    .se-row select { flex:0 0 120px; }
    .se-row input { flex:1; }
    .se-fullinput { width:100%; margin-bottom:8px; }
    .se-check { display:flex; align-items:center; gap:6px; font-size:13px; color:var(--text-secondary); }
    .se-linkrow { border:1px solid var(--border); border-radius:var(--r); padding:12px; margin-bottom:10px; }
    .se-iconbtn { width:34px; height:34px; flex-shrink:0; border-radius:8px; border:1px solid var(--border-strong); background:var(--surface); color:var(--text-secondary); cursor:pointer; }
    .se-iconbtn:hover:not(:disabled) { background:var(--surface-alt); }
    .se-iconbtn:disabled { opacity:.35; }

    .se-orderrow { display:flex; align-items:center; justify-content:space-between; padding:10px 0; border-top:1px solid var(--border); }
    .se-orderrow:first-of-type { border-top:none; }
    .se-ordername { font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .se-orderbtns { display:flex; gap:6px; }
  `}</style>;
}
