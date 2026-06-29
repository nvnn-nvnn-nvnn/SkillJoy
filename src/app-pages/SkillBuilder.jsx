import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useUser } from '@/lib/stores';
import {
  listMySkills, getSkillWithBlocks, createSkill, updateSkill, deleteSkill,
  addBlock, updateBlock, deleteBlock, reorderBlocks, publishSkill, publishUpdate,
} from '@/lib/skills';
import { uploadCover } from '@/lib/storage';
import { BLOCK_TYPES } from '@/lib/blockTypes';
import BlockEditor from '@/components/BlockEditor';

// Phase 2 — the make-or-break screen. /build lists my Skills; /build/:skillId
// edits one (meta + cover + price + reorderable mixed blocks + publish).
export default function SkillBuilder() {
  const { skillId } = useParams();
  const user = useUser();
  if (!user) return null;
  return skillId
    ? <SkillEditor key={skillId} skillId={skillId} userId={user.id} />
    : <SkillList userId={user.id} />;
}

// ── List view ───────────────────────────────────────────────────────────────
function SkillList({ userId }) {
  const navigate = useNavigate();
  const [skills, setSkills] = useState(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => { listMySkills(userId).then(setSkills).catch(() => setSkills([])); }, [userId]);

  async function newSkill() {
    setCreating(true);
    try {
      const s = await createSkill(userId, { title: 'Untitled Skill' });
      navigate(`/build/${s.id}`);
    } catch (e) { alert(e.message); setCreating(false); }
  }

  return (
    <div className="sb-wrap">
      <div className="sb-listhead">
        <div>
          <h1 className="sb-h1">Your Skills</h1>
          <p className="sb-sub">Each Skill is one thing you sell — mix video, files, prompts, guides & coaching.</p>
        </div>
        <button className="btn btn-primary" onClick={newSkill} disabled={creating}>
          {creating ? 'Creating…' : '+ New Skill'}
        </button>
      </div>

      {skills === null && <p className="sb-muted">Loading…</p>}
      {skills?.length === 0 && (
        <div className="sb-empty">
          <p style={{ fontSize: 40 }}>🧩</p>
          <p className="sb-empty-t">No Skills yet</p>
          <p className="sb-muted">Create your first Skill and drop in some content blocks.</p>
        </div>
      )}

      <div className="sb-grid">
        {skills?.map(s => (
          <Link key={s.id} to={`/build/${s.id}`} className="sb-card">
            <div className="sb-cover" style={s.cover_url ? { backgroundImage: `url(${s.cover_url})` } : {}}>
              {!s.cover_url && <span>🧩</span>}
            </div>
            <div className="sb-card-body">
              <div className="sb-card-top">
                <span className={`sb-pill ${s.status}`}>{s.status === 'published' ? 'Published' : 'Draft'}</span>
                <span className="sb-price">{s.price_cents ? `$${(s.price_cents / 100).toFixed(2)}` : 'Free'}</span>
              </div>
              <p className="sb-card-title">{s.title || 'Untitled Skill'}</p>
              {s.outcome && <p className="sb-card-outcome">{s.outcome}</p>}
            </div>
          </Link>
        ))}
      </div>
      <BuilderStyles />
    </div>
  );
}

// ── Editor view ───────────────────────────────────────────────────────────────
function SkillEditor({ skillId, userId }) {
  const navigate = useNavigate();
  const [skill, setSkill] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [loadErr, setLoadErr] = useState('');
  const [savingCover, setSavingCover] = useState(false);
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const skillTimer = useRef(null);
  const blockTimers = useRef({});
  const pendingSkill = useRef({});   // accumulated, unsaved skill-meta patches
  const pendingBlock = useRef({});   // { [blockId]: accumulated patch }
  const addMenu = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    getSkillWithBlocks(skillId)
      .then(s => { setSkill(s); setBlocks(s.blocks ?? []); })
      .catch(e => setLoadErr(e.message));
  }, [skillId]);

  // Debounced skill-meta save. Accumulate patches so editing several fields
  // within the debounce window persists ALL of them, not just the last one.
  const patchSkill = useCallback((patch) => {
    setSkill(prev => ({ ...prev, ...patch }));
    pendingSkill.current = { ...pendingSkill.current, ...patch };
    clearTimeout(skillTimer.current);
    skillTimer.current = setTimeout(async () => {
      const toSave = pendingSkill.current;
      pendingSkill.current = {};
      try { await updateSkill(skillId, toSave); setSavedAt(Date.now()); }
      catch (e) { console.warn('save skill', e.message); }
    }, 600);
  }, [skillId]);

  // Debounced per-block save — same accumulation, keyed per block.
  const patchBlock = useCallback((blockId, patch) => {
    setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, ...patch } : b));
    pendingBlock.current[blockId] = { ...(pendingBlock.current[blockId] || {}), ...patch };
    clearTimeout(blockTimers.current[blockId]);
    blockTimers.current[blockId] = setTimeout(async () => {
      const toSave = pendingBlock.current[blockId];
      delete pendingBlock.current[blockId];
      try { await updateBlock(blockId, toSave); setSavedAt(Date.now()); }
      catch (e) { console.warn('save block', e.message); }
    }, 600);
  }, []);

  // On unmount, clear timers AND best-effort flush anything still pending so a
  // quick navigate-away within the debounce window doesn't drop the last edit.
  useEffect(() => () => {
    clearTimeout(skillTimer.current);
    Object.values(blockTimers.current).forEach(clearTimeout);
    if (Object.keys(pendingSkill.current).length) updateSkill(skillId, pendingSkill.current).catch(() => {});
    Object.entries(pendingBlock.current).forEach(([id, patch]) => updateBlock(id, patch).catch(() => {}));
  }, [skillId]);

  async function onCover(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSavingCover(true);
    try {
      const url = await uploadCover(userId, skillId, file);
      await updateSkill(skillId, { cover_url: url });
      setSkill(prev => ({ ...prev, cover_url: url }));
    } catch (err) { alert(err.message); }
    finally { setSavingCover(false); }
  }

  async function addContentBlock(type) {
    setMenuOpen(false);
    try {
      const created = await addBlock(skillId, { type, position: blocks.length, title: '' });
      setBlocks(prev => [...prev, created]);
    } catch (e) { alert(e.message); }
  }

  async function removeBlock(blockId) {
    setBlocks(prev => prev.filter(b => b.id !== blockId));
    try { await deleteBlock(blockId); } catch (e) { console.warn(e.message); }
  }

  async function moveBlock(idx, dir) {
    const next = [...blocks];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    setBlocks(next);
    try { await reorderBlocks(next.map(b => b.id)); } catch (e) { console.warn(e.message); }
  }

  async function togglePublish() {
    if (skill.status !== 'published') {
      if (!skill.title?.trim()) { alert('Add a title before publishing.'); return; }
      if (blocks.length === 0) { alert('Add at least one content block before publishing.'); return; }
    }
    setBusy(true);
    try {
      const updated = skill.status === 'published'
        ? await updateSkill(skillId, { status: 'draft' })
        : await publishSkill(skillId);
      setSkill(prev => ({ ...prev, status: updated.status }));
    } catch (e) { alert(e.message); }
    finally { setBusy(false); }
  }

  async function pushUpdate() {
    if (!confirm('Push an update? Everyone who bought this Skill gets the new version and a notification.')) return;
    setBusy(true);
    try {
      const { version } = await publishUpdate(skillId);
      setSkill(prev => ({ ...prev, version }));
      alert(`Update pushed — buyers are now on v${version}.`);
    } catch (e) { alert(e.message); }
    finally { setBusy(false); }
  }

  async function removeSkill() {
    if (!confirm('Delete this Skill and all its content? This cannot be undone.')) return;
    try { await deleteSkill(skillId); navigate('/build'); }
    catch (e) { alert(e.message); }
  }

  if (loadErr) return <div className="sb-wrap"><p className="sb-muted">Couldn’t load this Skill: {loadErr}</p><Link to="/build" className="btn btn-secondary">← Back</Link></div>;
  if (!skill) return <div className="sb-wrap"><p className="sb-muted">Loading…</p></div>;

  return (
    <div className="sb-wrap">
      <div className="sb-editbar">
        <Link to="/build" className="btn btn-ghost btn-sm">← All Skills</Link>
        <span className="sb-saved">
          {skill.status === 'published' && <span className="sb-ver">v{skill.version}</span>}
          {savedAt ? 'Saved ✓' : ''}
        </span>
        <div className="sb-editbar-actions">
          <button className="btn btn-ghost btn-sm sb-danger" onClick={removeSkill}>Delete</button>
          {skill.status === 'published' && (
            <button className="btn btn-secondary btn-sm" onClick={pushUpdate} disabled={busy} title="Bump version + notify buyers">
              Push update
            </button>
          )}
          <button className="btn btn-primary btn-sm" onClick={togglePublish} disabled={busy}>
            {skill.status === 'published' ? 'Unpublish' : 'Publish'}
          </button>
        </div>
      </div>

      {/* Cover */}
      <label className="sb-coveredit" style={skill.cover_url ? { backgroundImage: `url(${skill.cover_url})` } : {}}>
        <input type="file" accept="image/*" hidden onChange={onCover} />
        <span className="sb-cover-cta">{savingCover ? 'Uploading…' : skill.cover_url ? 'Change cover' : '+ Add cover image'}</span>
      </label>

      {/* Meta */}
      <input className="sb-titleinput" value={skill.title ?? ''}
        onChange={e => patchSkill({ title: e.target.value })} placeholder="Skill title" />
      <input className="sb-outcomeinput" value={skill.outcome ?? ''}
        onChange={e => patchSkill({ outcome: e.target.value })}
        placeholder="One-line promise (e.g. “Ship your first AI app in a weekend”)" />

      <div className="sb-pricerow">
        <div className="sb-pricefield">
          <span className="sb-dollar">$</span>
          <input type="number" min="0" step="1" className="sb-price-in"
            value={skill.price_cents ? skill.price_cents / 100 : ''}
            onChange={e => patchSkill({ price_cents: Math.max(0, Math.round((parseFloat(e.target.value) || 0) * 100)) })}
            placeholder="0" />
        </div>
        <div className="sb-segmented">
          <button className={skill.pricing_type === 'onetime' ? 'on' : ''} onClick={() => patchSkill({ pricing_type: 'onetime' })}>One-time</button>
          <button className={skill.pricing_type === 'membership' ? 'on' : ''} onClick={() => patchSkill({ pricing_type: 'membership' })}>Membership</button>
        </div>
      </div>

      {/* Blocks */}
      <div className="sb-blockshead">
        <h2 className="sb-h2">Content</h2>
        <span className="sb-muted">{blocks.length} block{blocks.length === 1 ? '' : 's'}</span>
      </div>

      {blocks.map((b, i) => (
        <BlockEditor key={b.id} block={b} index={i} total={blocks.length}
          creatorId={userId} skillId={skillId}
          onPatch={(patch) => patchBlock(b.id, patch)}
          onRemove={() => removeBlock(b.id)}
          onMove={(dir) => moveBlock(i, dir)} />
      ))}

      {/* Add block */}
      <div className="sb-add" ref={addMenu}>
        <button className="btn btn-secondary sb-addbtn" onClick={() => setMenuOpen(o => !o)}>+ Add content block</button>
        {menuOpen && (
          <div className="sb-addmenu">
            {BLOCK_TYPES.map(t => (
              <button key={t.type} className="sb-addmenu-item" onClick={() => addContentBlock(t.type)}>
                <span className="sb-addmenu-icon">{t.icon}</span>
                <span><b>{t.label}</b><span className="sb-addmenu-hint">{t.hint}</span></span>
              </button>
            ))}
          </div>
        )}
      </div>

      <BuilderStyles />
    </div>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────
function BuilderStyles() {
  return <style>{`
    .sb-wrap { max-width:680px; margin:0 auto; padding:24px 16px 80px; }
    .sb-h1 { font-size:26px; font-weight:700; color:var(--text); }
    .sb-h2 { font-size:18px; font-weight:700; color:var(--text); }
    .sb-sub { color:var(--text-secondary); font-size:14px; margin-top:4px; max-width:42ch; }
    .sb-muted { color:var(--text-muted); font-size:14px; }
    .sb-listhead { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom:24px; }

    .sb-empty { text-align:center; padding:48px 0; }
    .sb-empty-t { font-weight:700; font-size:18px; margin-top:8px; }

    .sb-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:16px; }
    .sb-card { display:flex; flex-direction:column; border:1px solid var(--border); border-radius:var(--r-lg); overflow:hidden; background:var(--surface); text-decoration:none; box-shadow:var(--shadow-sm); transition:transform .12s ease, box-shadow .12s ease; }
    .sb-card:hover { transform:translateY(-2px); box-shadow:var(--shadow); }
    .sb-cover { aspect-ratio:16/9; background:var(--surface-alt) center/cover no-repeat; display:flex; align-items:center; justify-content:center; font-size:32px; }
    .sb-card-body { padding:12px 14px 14px; }
    .sb-card-top { display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; }
    .sb-pill { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; padding:3px 8px; border-radius:var(--r-full); }
    .sb-pill.published { background:var(--green-light); color:var(--green); }
    .sb-pill.draft { background:var(--surface-alt); color:var(--text-muted); }
    .sb-price { font-weight:700; color:var(--text); font-size:14px; }
    .sb-card-title { font-weight:700; color:var(--text); }
    .sb-card-outcome { font-size:13px; color:var(--text-secondary); margin-top:2px; }

    .sb-editbar { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:16px; }
    .sb-editbar-actions { display:flex; gap:8px; }
    .sb-saved { font-size:13px; color:var(--green); font-weight:600; flex:1; text-align:center; display:flex; gap:8px; justify-content:center; align-items:center; }
    .sb-ver { font-size:11px; font-weight:700; color:var(--text-muted); background:var(--surface-alt); padding:2px 8px; border-radius:var(--r-full); }
    .sb-danger { color:var(--accent); }

    .sb-coveredit { display:flex; align-items:center; justify-content:center; aspect-ratio:16/7; border:1.5px dashed var(--border-strong); border-radius:var(--r-lg); background:var(--surface-alt) center/cover no-repeat; cursor:pointer; margin-bottom:16px; }
    .sb-cover-cta { background:rgba(0,0,0,.55); color:#fff; padding:8px 16px; border-radius:var(--r-full); font-size:14px; font-weight:600; }

    .sb-titleinput { width:100%; font-size:24px; font-weight:700; font-family:var(--font-display); border:none; padding:6px 0; background:transparent; }
    .sb-titleinput:focus { outline:none; }
    .sb-outcomeinput { width:100%; font-size:15px; color:var(--text-secondary); border:none; padding:4px 0 14px; background:transparent; }
    .sb-outcomeinput:focus { outline:none; }

    .sb-pricerow { display:flex; gap:12px; align-items:center; padding:14px 0 8px; border-top:1px solid var(--border); flex-wrap:wrap; }
    .sb-pricefield { display:flex; align-items:center; border:1.5px solid var(--border-strong); border-radius:var(--r); padding-left:12px; }
    .sb-dollar { color:var(--text-muted); font-weight:700; }
    .sb-price-in { border:none; width:90px; padding:8px 12px 8px 4px; background:transparent; }
    .sb-price-in:focus { outline:none; }
    .sb-segmented { display:flex; border:1px solid var(--border-strong); border-radius:var(--r-full); overflow:hidden; }
    .sb-segmented button { border:none; background:var(--surface); padding:8px 18px; font-size:13px; font-weight:600; color:var(--text-muted); cursor:pointer; }
    .sb-segmented button.on { background:var(--accent); color:#fff; }

    .sb-blockshead { display:flex; justify-content:space-between; align-items:baseline; margin:24px 0 12px; }

    .sb-add { position:relative; margin-top:8px; }
    .sb-addbtn { width:100%; }
    .sb-addmenu { position:absolute; left:0; right:0; bottom:calc(100% + 6px); background:var(--surface); border:1px solid var(--border-strong); border-radius:var(--r); box-shadow:var(--shadow-lg); padding:6px; z-index:20; }
    .sb-addmenu-item { display:flex; gap:12px; align-items:center; width:100%; text-align:left; border:none; background:transparent; padding:10px 12px; border-radius:var(--r-sm); cursor:pointer; }
    .sb-addmenu-item:hover { background:var(--surface-alt); }
    .sb-addmenu-icon { font-size:20px; }
    .sb-addmenu-hint { display:block; font-size:12px; color:var(--text-muted); font-weight:400; }

    @media (max-width:600px) {
      .sb-listhead { flex-direction:column; }
      .sb-titleinput { font-size:21px; }
    }
  `}</style>;
}
