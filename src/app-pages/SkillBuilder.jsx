import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useUser } from '@/lib/stores';
import {
  listMySkills, getSkillWithBlocks, updateSkill, deleteSkill,
  addBlock, updateBlock, deleteBlock, reorderBlocks, publishSkill, publishUpdate,
} from '@/lib/skills';
import { Trash2, Send, EyeOff, Puzzle } from 'lucide-react';
import { uploadCover } from '@/lib/storage';
import { startSubscription } from '@/lib/billing';
import { BLOCK_TYPES } from '@/lib/blockTypes';
import { PRODUCT_TYPES, TYPE_BY_ID } from '@/lib/productTypes';
import BlockEditor from '@/components/BlockEditor';
import MarkdownEditor from '@/components/MarkdownEditor';
import CourseStructure from '@/components/CourseStructure';
import BackLink from '@/components/BackLink';
import { useDialog } from '@/components/Dialog';

// Product `kind` (what a Skill *is*) is picked from the shared PRODUCT_TYPES
// catalog — same source as the /build/new picker. Independent of pricing_type.
// Keep in sync with the skills.kind CHECK in migration 011_service_kinds.sql.

// Per-kind copy that makes the builder feel type-aware. `content` nudges the
// creator toward the block(s) that matter for that product type. Keyed by
// skills.kind; falls back to `digital`.
const KIND_HINTS = {
  digital:    { content: 'Add a File block for the download buyers get, plus any guide or video that explains it.' },
  coaching:   { content: 'Add a Coaching block with your booking link so buyers can schedule after paying.' },
  course:     { content: 'Break your course into sections, then add video, guide, or file lessons inside each — in the order students should follow.' },
  membership: { content: 'Add the content members get ongoing access to — you can push updates any time.' },
  webinar:    { content: 'Add a Video block for the recording or a Guide with the join link and details.' },
  lead:       { content: 'Keep it light — a single File or Guide block is enough for a free lead magnet.' },
  bundle:     { content: 'Add everything included in the bundle as separate blocks.' },
};

// The 5 builder steps. The middle step (index 1) is type-aware: its label +
// heading swap by product kind, so a digital product walks through "Delivery"
// while coaching walks through "Scheduling" — same shell, different body.
const MIDDLE_LABEL = { digital: 'Delivery', coaching: 'Scheduling', course: 'Curriculum', lead: "Freebie", webinar: 'Access'  };
const stepsFor = (kind) => ['Basics', MIDDLE_LABEL[kind] || 'Content', 'Pricing', 'Options', 'Publish'];

// Post-purchase / marketing features that need dedicated backend passes
// (money + 3rd-party). Shown as "Soon" cards in the Options tab for now.
const SOON_OPTIONS = [
  ['🤝', 'Affiliate share', 'Let others promote this for a commission.'],
  ['📧', 'Email integration', 'Sync buyers to Mailchimp, ConvertKit & more.'],
];

// A digital product must deliver something: a File block with either an
// uploaded file (file_key) or a VALID external link (a malformed link would
// ship a broken download, so it doesn't count).
const hasDelivery = (blocks) => blocks.some(b =>
  b.type === 'file' && (b.file_key || /^https?:\/\/.+/i.test((b.external_url || '').trim())));

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
  const [skills, setSkills] = useState(null);
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => { listMySkills(userId).then(setSkills).catch(() => setSkills([])); }, [userId]);

  // Types the creator actually has (for the filter bar) + the filtered view.
  const presentTypes = [...new Set((skills ?? []).map(s => s.kind))];
  const visible = (skills ?? []).filter(s => typeFilter === 'all' || s.kind === typeFilter);

  return (
    <div className="sb-wrap">
      <div className="sb-listhead">
        <div>
          <h1 className="sb-h1">Your Skills</h1>
          <p className="sb-sub">Each Skill is one thing you sell — mix video, files, prompts, guides & coaching.</p>
        </div>
        <Link to="/build/new" className="btn btn-primary">+ New product</Link>
      </div>

      {skills === null && <p className="sb-muted">Loading…</p>}
      {skills?.length === 0 && (
        <div className="sb-empty">
          <Puzzle size={40} strokeWidth={1.5} style={{ color: 'var(--text-muted)' }} />
          <p className="sb-empty-t">No Skills yet</p>
          <p className="sb-muted">Create your first Skill and drop in some content blocks.</p>
          <Link to="/build/new" className="btn btn-primary" style={{ marginTop: 16 }}>+ New product</Link>
        </div>
      )}

      {skills && skills.length > 0 && presentTypes.length > 1 && (
        <div className="sb-filterbar">
          <button className={`sb-filterchip${typeFilter === 'all' ? ' on' : ''}`} onClick={() => setTypeFilter('all')}>
            All <span className="sb-filtercount">{skills.length}</span>
          </button>
          {presentTypes.map(t => (
            <button key={t} className={`sb-filterchip${typeFilter === t ? ' on' : ''}`} onClick={() => setTypeFilter(t)}>
              {TYPE_BY_ID[t]?.label ?? t}
            </button>
          ))}
        </div>
      )}

      <div className="sb-grid">
        {visible.map(s => (
          <Link key={s.id} to={`/build/${s.id}`} className="sb-card">
            <div className="sb-cover" style={s.cover_url ? { backgroundImage: `url(${s.cover_url})` } : {}}>
              {!s.cover_url && <Puzzle size={26} strokeWidth={1.5} style={{ color: 'var(--text-muted)' }} />}
            </div>
            <div className="sb-card-body">
              <div className="sb-card-top">
                <span className={`sb-pill ${s.status}`}>{s.status === 'published' ? 'Published' : 'Draft'}</span>
                <span className="sb-price">{s.price_cents ? `$${(s.price_cents / 100).toFixed(2)}` : 'Free'}</span>

              </div>
              <p className="sb-card-title">{s.title || 'Untitled Skill'}</p>
              {s.outcome && <p className="sb-card-outcome">{s.outcome}</p>}
              <div className="sb-card-type">
                <span className="sb-card-type-label">Type</span>
                <span className="sb-card-type-val">{TYPE_BY_ID[s.kind]?.label ?? s.kind}</span>
              </div>
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
  const { confirm, alert } = useDialog();
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
  const [step, setStep] = useState(0);
  const [courseHasLesson, setCourseHasLesson] = useState(false); // reported by CourseStructure
  const [bumpOptions, setBumpOptions] = useState([]); // creator's other published one-time products, for order bumps

  // Load the products this one could offer as an order bump: the creator's other
  // published, one-time skills (a membership/lead can't be a bump; neither can self).
  useEffect(() => {
    listMySkills(userId)
      .then(list => setBumpOptions((list || []).filter(s =>
        s.id !== skillId && s.status === 'published' && s.pricing_type === 'onetime')))
      .catch(() => setBumpOptions([]));
  }, [userId, skillId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const s = await getSkillWithBlocks(skillId);
        if (!alive) return;
        let loaded = s.blocks ?? [];
        // Coaching products always need a booking block — seed one if missing.
        // (Creators can still add other blocks; this just guarantees the core.)
        if (s.kind === 'coaching' && !loaded.some(b => b.type === 'coaching')) {
          const created = await addBlock(skillId, { type: 'coaching', position: loaded.length, title: '', booking_minutes: 30 });
          if (!alive) return;
          loaded = [...loaded, created];
        }
        setSkill(s);
        setBlocks(loaded);
      } catch (e) { if (alive) setLoadErr(e.message); }
    })();
    return () => { alive = false; };
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
    } catch (err) { alert({ title: 'Upload failed', message: err.message, tone: 'danger' }); }
    finally { setSavingCover(false); }
  }

  async function addContentBlock(type) {
    setMenuOpen(false);
    try {
      const created = await addBlock(skillId, { type, position: blocks.length, title: '' });
      setBlocks(prev => [...prev, created]);
    } catch (e) { alert({ title: 'Couldn’t add block', message: e.message, tone: 'danger' }); }
  }

  async function removeBlock(blockId) {
    // A coaching product must keep at least one coaching block (the booking core).
    const target = blocks.find(b => b.id === blockId);
    if (skill.kind === 'coaching' && target?.type === 'coaching'
        && blocks.filter(b => b.type === 'coaching').length <= 1) {
      await alert({ title: 'Keep the booking block', message: 'Coaching products need a coaching block so buyers can book a time. You can add other blocks around it, but this one has to stay.', tone: 'warning' });
      return;
    }
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
    const publishing = skill.status !== 'published';
    if (publishing) {
      const k = skill.kind ?? 'digital';
      if (!skill.title?.trim()) { await alert({ title: 'Add a title first', message: 'Give your product a title before publishing.', tone: 'warning' }); return; }
      if (k === 'course') {
        if (!courseHasLesson) {
          await alert({ title: 'Add a lesson', message: 'A course needs at least one module with a lesson inside it before publishing.', tone: 'warning' });
          return;
        }
      } else if (blocks.length === 0) {
        await alert({ title: 'Add some content', message: 'Add at least one content block before publishing.', tone: 'warning' }); return;
      }
      if (k === 'digital' && !hasDelivery(blocks)) {
        await alert({ title: 'Add your download', message: 'A digital product needs a File block with an uploaded file or a link, so buyers actually get something after paying.', tone: 'warning' });
        return;
      }

      if (k === 'lead' && !hasDelivery(blocks)) {
        await alert({ title: 'Add your freebie', message: 'A lead magnet needs a File block with an uploaded file or a link, so people get something after signing up.', tone: 'warning' });
        return;
      }


      // if (k === 'membership' )




    }

    // Confirm the state change (reflects what will happen).
    const ok = await confirm(publishing
      ? { title: 'Publish this product?', message: 'It’ll go live on your storefront and anyone can buy it.', confirmLabel: 'Publish' }
      : { title: 'Unpublish this product?', message: 'It’ll be hidden from your storefront and can’t be bought. Existing buyers keep their access.', confirmLabel: 'Unpublish', danger: true });
    if (!ok) return;

    setBusy(true);
    try {
      const updated = publishing
        ? await publishSkill(skillId)
        : await updateSkill(skillId, { status: 'draft' });
      setSkill(prev => ({ ...prev, status: updated.status }));
      // Reflect the new state.
      await alert(publishing
        ? { title: 'You’re live! 🎉', message: `“${skill.title || 'Your product'}” is now on your storefront.` }
        : { title: 'Unpublished', message: `“${skill.title || 'Your product'}” is hidden from your storefront.`, tone: 'warning' });
    } catch (e) {
      // The paywall: publishing needs a live platform subscription. Offer to
      // start the free trial (card captured now, first charge on day 14).
      if (e.code === 'SUBSCRIPTION_REQUIRED') {
        const go = await confirm({
          title: 'Start your free trial to go live',
          message: 'Publishing your storefront starts a free 14-day trial — add a card now, and you won’t be charged until the trial ends. Building and customizing stay free.',
          confirmLabel: 'Start free trial',
        });
        if (go) {
          try { await startSubscription(); }
          catch (se) { alert({ title: 'Couldn’t start trial', message: se.message, tone: 'danger' }); }
        }
      } else if (e.code === 'PROFILE_INCOMPLETE') {
        const go = await confirm({
          title: 'Finish your profile first',
          message: e.message,
          confirmLabel: 'Go to settings',
        });
        if (go) navigate('/settings');
      } else {
        alert({ title: 'Couldn’t publish', message: e.message, tone: 'danger' });
      }
    }
    finally { setBusy(false); }
  }

  async function pushUpdate() {
    const ok = await confirm({
      title: 'Push an update?',
      message: 'Everyone who bought this product gets the new version and a notification.',
      confirmLabel: 'Push update',
    });
    if (!ok) return;
    setBusy(true);
    try {
      const { version } = await publishUpdate(skillId);
      setSkill(prev => ({ ...prev, version }));
      await alert({ title: 'Update pushed', message: `Buyers are now on v${version}.` });
    } catch (e) { alert({ title: 'Couldn’t push update', message: e.message, tone: 'danger' }); }
    finally { setBusy(false); }
  }

  async function removeSkill() {
    const ok = await confirm({
      title: 'Delete this product?',
      message: 'This deletes the product and all its content. This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try { await deleteSkill(skillId); navigate('/build'); }
    catch (e) { alert({ title: 'Couldn’t delete', message: e.message, tone: 'danger' }); }
  }

  if (loadErr) return <div className="sb-wrap"><p className="sb-muted">Couldn’t load this Skill: {loadErr}</p><BackLink to="/build">All products</BackLink></div>;
  if (!skill) return <div className="sb-wrap"><p className="sb-muted">Loading…</p></div>;

  const kind = skill.kind ?? 'digital';
  const contentOk = kind === 'course' ? courseHasLesson : blocks.length > 0;
  const ready = !!skill.title?.trim() && contentOk && (kind !== 'digital' || hasDelivery(blocks));
  const steps = stepsFor(kind);
  const last = steps.length - 1;
  const midHeading = steps[1]; // Delivery | Scheduling | Content

  return (
    <div className="sb-wrap">
      <div className="sb-editbar">
        <BackLink to="/build" className="bl-inline">All products</BackLink>
        <span className="sb-saved">
          {skill.status === 'published' && <span className="sb-ver">v{skill.version}</span>}
          {savedAt ? 'Saved ✓' : ''}
        </span>
        <div className="sb-editbar-actions">
          <button className="sb-actbtn sb-act-delete" onClick={removeSkill}>
            <Trash2 size={16} /> Delete
          </button>
          {skill.status === 'published' && (
            <button className="sb-actbtn sb-act-update" onClick={togglePublish} disabled={busy} title="Hide from your storefront">
              <EyeOff size={16} /> Unpublish
            </button>
          )}
        </div>
      </div>

      {/* Stepper — the middle step is type-aware; save engine unchanged. */}
      <nav className="sb-steps">
        {steps.map((label, i) => (
          <button key={label} type="button"
            className={`sb-step${i === step ? ' on' : ''}${i < step ? ' done' : ''}`}
            onClick={() => setStep(i)}>
            <span className="sb-step-num">{i < step ? '✓' : i + 1}</span>
            <span className="sb-step-label">{label}</span>
          </button>
        ))}
      </nav>

      {/* ── 0 · Basics ── */}
      {step === 0 && (
        <div className="sb-panel">
          <label className="sb-coveredit" style={skill.cover_url ? { backgroundImage: `url(${skill.cover_url})` } : {}}>
            <input type="file" accept="image/*" hidden onChange={onCover} />
            <span className="sb-cover-cta">{savingCover ? 'Uploading…' : skill.cover_url ? 'Change cover' : '+ Add cover image'}</span>
          </label>

          <input className="sb-titleinput" value={skill.title ?? ''}
            onChange={e => patchSkill({ title: e.target.value })} placeholder="Product title" />
          <input className="sb-outcomeinput" value={skill.outcome ?? ''}
            onChange={e => patchSkill({ outcome: e.target.value })}
            placeholder="One-line header (e.g. “Ship your first AI app in a weekend”)" />

          <div className="sb-typefield">
            <span className="sb-fieldlabel">Description</span>
            <MarkdownEditor rows={10} value={skill.description ?? ''}
              onChange={v => patchSkill({ description: v })}
              placeholder="Tell buyers what this is, who it’s for, and what they’ll get. This is your pitch on the sales page." />
            <p className="sb-fieldhint">Supports markdown — **bold**, - lists, ## headings, [links](url).</p>
          </div>

          <div className="sb-typefield">
            <span className="sb-fieldlabel">Group <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0, color: 'var(--text-muted)' }}>(optional)</span></span>
            <input className="sb-field" value={skill.group_label ?? ''}
              onChange={e => patchSkill({ group_label: e.target.value })}
              placeholder="e.g. Start here · Bookings · Digital products"
              list="sb-group-suggestions" />
            <datalist id="sb-group-suggestions">
              <option value="Start here" /><option value="Bookings" /><option value="Digital products" /><option value="Coaching" /><option value="Courses" />
            </datalist>
            <p className="sb-fieldhint">Products with the same group are shown together on your page under this heading.</p>
          </div>

          {/* Read-only display of the chosen product type (set on /build/new). */}
          <div className="sb-typefield">
            <span className="sb-fieldlabel">Type</span>
            {(() => {
              const t = PRODUCT_TYPES.find(x => x.id === kind) || PRODUCT_TYPES[0];
              const Icon = t.icon;
              return (
                <div className="sb-typedisplay">
                  <span className="sb-typedisplay-icon"><Icon size={18} /></span>
                  <span>{t.label}</span>
                </div>
              );
            })()}
          </div>

          {/* Type SELECTOR — commented out for now (may re-introduce so creators
              can re-classify from the builder). Kept intentionally, do not delete.
          <div className="sb-typefield">
            <span className="sb-fieldlabel">Type</span>
            <div className="sb-typegrid">
              {PRODUCT_TYPES.map(t => {
                const Icon = t.icon;
                return (
                  <button key={t.id} type="button"
                    className={`sb-typetile${kind === t.id ? ' on' : ''}`}
                    onClick={() => patchSkill({ kind: t.id })}>
                    <span className="sb-typetile-icon"><Icon size={17} /></span>
                    <span className="sb-typetile-label">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          */}
        </div>
      )}

      {/* ── 1 · Delivery / Scheduling / Curriculum / Content (type-aware) ── */}
      {step === 1 && (
        <div className="sb-panel">
          <div className="sb-blockshead">
            <h2 className="sb-h2">{midHeading}</h2>
            {kind !== 'course' && (
              <span className="sb-muted">{blocks.length} block{blocks.length === 1 ? '' : 's'}</span>
            )}
          </div>
          <p className="sb-hint">{KIND_HINTS[kind]?.content ?? KIND_HINTS.digital.content}</p>

          {kind === 'course' ? (
            <CourseStructure skillId={skillId} onReadyChange={setCourseHasLesson} />
          ) : (
            <>
              {blocks.map((b, i) => (
                <BlockEditor key={b.id} block={b} index={i} total={blocks.length}
                  creatorId={userId} skillId={skillId}
                  onPatch={(patch) => patchBlock(b.id, patch)}
                  onRemove={() => removeBlock(b.id)}
                  onMove={(dir) => moveBlock(i, dir)} />
              ))}

              <div className="sb-add" ref={addMenu}>
                {!menuOpen ? (
                  <button className="sb-addtrigger" onClick={() => setMenuOpen(true)}>+ Add content block</button>
                ) : (
                  <div className="sb-addpicker">
                    <div className="sb-addpicker-head">
                      <span className="sb-addpicker-title">Add a content block</span>
                      <button className="sb-addpicker-cancel" onClick={() => setMenuOpen(false)}>Cancel</button>
                    </div>
                    <div className="sb-addgrid">
                      {BLOCK_TYPES.map(t => (
                        <button key={t.type} className="sb-addtile" onClick={() => addContentBlock(t.type)}>
                          <span className="sb-addtile-icon">{t.icon}</span>
                          <span className="sb-addtile-label">{t.label}</span>
                          <span className="sb-addtile-hint">{t.hint}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── 2 · Pricing ── */}
      {step === 2 && (
        <div className="sb-panel">
          <h2 className="sb-h2">Pricing</h2>
            { kind === "lead" ? (
              <div className="sb-hint">
                 <p className="sb-hint sb-hint-muted">Leads are automatically free</p>
              </div>
            ) : 
            
            kind === "membership" ? (
              // Membership is locked to recurring — pricing_type is forced to
              // 'membership' at creation, so there's no toggle to get wrong.
              <div className="sb-pricerow">
                <div className="sb-pricefield">
                  <span className="sb-dollar">$</span>
                  <input type="number" min="0" step="1" className="sb-price-in"
                    value={skill.price_cents ? skill.price_cents / 100 : ""}
                    onChange={e => patchSkill({ price_cents: Math.max(0, Math.round((parseFloat(e.target.value) || 0) * 100)) })}
                    placeholder="0"
                  />
                </div>
                <span className="sb-permonth">/ month</span>
              </div>
            ):
            
            (
            <div className="sb-pricerow">
              <div className="sb-pricefield">
                <span className="sb-dollar">$</span>
                <input type="number" min="0" step="1" className="sb-price-in"
                  value={skill.price_cents ? skill.price_cents / 100 : ''}
                  onChange={e => patchSkill({ price_cents: Math.max(0, Math.round((parseFloat(e.target.value) || 0) * 100)) })}
                  placeholder="0" />
              </div>
              {/* Only membership *kinds* bill recurring — a one-time product
                  can't be toggled into a subscription, so no segmented control. */}
              <span className="sb-permonth">one-time</span>
            </div>
            ) } 
            { kind !== 'lead' && (
              <p className="sb-hint">
                {!skill.price_cents
                  ? 'Free — buyers get instant access with no payment.'
                  : skill.pricing_type === 'membership'
                    ? 'Members are billed monthly until they cancel.'
                    : 'A single one-time payment for lifetime access.'}
                  
              
              </p>
            )}
            <p className="sb-hint sb-hint-muted">Promo codes are managed per-creator on your dashboard, not here.</p>
          </div>
      )}

      {/* ── 3 · Checkout & Options (post-purchase / marketing) ── */}
      {step === 3 && (
        <div className="sb-panel">
          {/* Promo video */}
          <div className="sb-typefield">
            <span className="sb-fieldlabel">Promo video</span>
            <input className="sb-field" value={skill.promo_video_url ?? ''}
              onChange={e => patchSkill({ promo_video_url: e.target.value })}
              placeholder="https://youtube.com/watch?v=… or vimeo.com/…" />
            <p className="sb-hint sb-hint-muted">Shown at the top of your sales page to warm buyers up.</p>
          </div>

          {/* Confirmation message */}
          <div className="sb-typefield">
            <span className="sb-fieldlabel">Confirmation email message</span>
            <textarea className="sb-field sb-textarea" rows={4} value={skill.confirmation_message ?? ''}
              onChange={e => patchSkill({ confirmation_message: e.target.value })}
              placeholder="Add a personal note buyers see in their receipt — e.g. “Thanks! Reply here if you get stuck.”" />
            <p className="sb-hint sb-hint-muted">Buyers always get a receipt with a link to their Locker; this adds your message to it.</p>
          </div>

          {/* Reviews toggle */}
          <div className="sb-optrow">
            <div>
              <span className="sb-fieldlabel">Customer reviews</span>
              <p className="sb-opthint">Let buyers rate this product; show the average on your sales page.</p>
            </div>
            <button type="button" role="switch" aria-checked={skill.reviews_enabled !== false}
              className={`sb-toggle${skill.reviews_enabled !== false ? ' on' : ''}`}
              onClick={() => patchSkill({ reviews_enabled: !(skill.reviews_enabled !== false) })}>
              <span className="sb-toggle-knob" />
            </button>
          </div>

          {/* Order bump — offer another product as an add-on at checkout.
              Only meaningful for products with a one-time checkout. */}
          {kind !== 'lead' && skill.pricing_type !== 'membership' && (
            <div className="sb-typefield">
              <span className="sb-fieldlabel">Order bump</span>
              <p className="sb-opthint">Offer one of your other one-time products as an add-on at this product’s checkout — a one-click upsell.</p>
              {bumpOptions.length === 0 ? (
                <p className="sb-hint sb-hint-muted">Publish another one-time product first to offer it as a bump.</p>
              ) : (
                <>
                  <select className="sb-field" value={skill.order_bump_skill_id || ''}
                    onChange={e => patchSkill({ order_bump_skill_id: e.target.value || null })}>
                    <option value="">No order bump</option>
                    {bumpOptions.map(o => (
                      <option key={o.id} value={o.id}>{o.title || 'Untitled'} — ${((o.price_cents || 0) / 100).toFixed(2)}</option>
                    ))}
                  </select>
                  {skill.order_bump_skill_id && (
                    <>
                      <div className="sb-pricefield" style={{ marginTop: 10 }}>
                        <span className="sb-dollar">$</span>
                        <input type="number" min="0" step="1" className="sb-price-in"
                          value={skill.order_bump_price_cents != null ? skill.order_bump_price_cents / 100 : ''}
                          onChange={e => patchSkill({ order_bump_price_cents: e.target.value === '' ? null : Math.max(0, Math.round((parseFloat(e.target.value) || 0) * 100)) })}
                          placeholder="Discounted bump price" />
                      </div>
                      <p className="sb-hint sb-hint-muted">Leave blank to charge the product’s normal price.</p>
                      <input className="sb-field" style={{ marginTop: 10 }} value={skill.order_bump_blurb || ''}
                        onChange={e => patchSkill({ order_bump_blurb: e.target.value })}
                        placeholder="Offer headline — e.g. “Add the templates pack and save”" />
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {/* Coming soon */}
          <div>
            <span className="sb-fieldlabel">More, soon</span>
            <div className="sb-typegrid" style={{ marginTop: 10 }}>
              {SOON_OPTIONS.map(([icon, label, blurb]) => (
                <div key={label} className="sb-addtile sb-soontile">
                  <span className="sb-addtile-icon">{icon}</span>
                  <span className="sb-addtile-label">{label}<span className="sb-soonchip">Soon</span></span>
                  <span className="sb-addtile-hint">{blurb}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── 4 · Publish ── */}
      {step === 4 && (
        <div className="sb-panel">
          <h2 className="sb-h2">Publish</h2>
          <ul className="sb-checklist sb-publishlist">
            <li className={skill.title?.trim() ? 'ok' : ''}>{skill.title?.trim() ? '✓' : '○'} Product has a title</li>
            {kind === 'course' ? (
              <li className={courseHasLesson ? 'ok' : ''}>{courseHasLesson ? '✓' : '○'} A module with at least one lesson</li>
            ) : (
              <li className={blocks.length > 0 ? 'ok' : ''}>{blocks.length > 0 ? '✓' : '○'} At least one content block</li>
            )}
            {kind === 'digital' && (
              <li className={hasDelivery(blocks) ? 'ok' : ''}>{hasDelivery(blocks) ? '✓' : '○'} A download to deliver (file or link)</li>
            )}
            <li className="ok">✓ {skill.price_cents ? `$${(skill.price_cents / 100).toFixed(2)} ${skill.pricing_type === 'membership' ? '/mo' : 'one-time'}` : 'Free'}</li>
          </ul>
          <p className="sb-hint">
            {skill.status === 'published'
              ? `This product is live (v${skill.version}). Use “Push update” below to send changes to existing buyers, or “Unpublish” up top to take it down.`
              : ready
                ? 'You’re ready — hit Publish below to make this product live on your storefront.'
                : 'Finish the checklist above, then Publish becomes meaningful.'}
          </p>
        </div>
      )}

      {/* Step footer */}
      <div className="sb-stepnav">
        {step > 0
          ? <button className="btn btn-ghost" onClick={() => setStep(s => Math.max(0, s - 1))}>← Back</button>
          : <span />}
        {step < last
          ? <button className="btn btn-primary" onClick={() => setStep(s => Math.min(last, s + 1))}>Next →</button>
          : skill.status === 'published'
            ? <button className="btn btn-primary" onClick={pushUpdate} disabled={busy}>Push update</button>
            : <button className="btn btn-primary" onClick={togglePublish} disabled={busy}>Publish</button>}
      </div>

      <BuilderStyles />
    </div>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────
function BuilderStyles() {
  return <style>{`
    .sb-wrap { max-width:680px; margin:0 auto; padding:28px 20px 96px; }
    .sb-h1 { font-size:26px; font-weight:700; color:var(--text); }
    .sb-h2 { font-size:18px; font-weight:700; color:var(--text); }
    .sb-sub { color:var(--text-secondary); font-size:14px; margin-top:4px; max-width:42ch; }
    .sb-muted { color:var(--text-muted); font-size:14px; }
    .sb-listhead { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom:24px; }

    .sb-empty { text-align:center; padding:48px 0; }
    .sb-empty-t { font-weight:700; font-size:18px; margin-top:8px; }

    .sb-filterbar { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:20px; }
    .sb-filterchip { width:auto; min-width:0; display:inline-flex; align-items:center; gap:7px; padding:7px 15px; border-radius:var(--r-full); border:1.5px solid var(--border); background:var(--surface); color:var(--text-secondary); font-size:13px; font-weight:600; cursor:pointer; transition:background .14s ease, border-color .14s ease, color .14s ease; }
    .sb-filterchip:hover { border-color:var(--border-strong); color:var(--text); }
    .sb-filterchip.on { background:var(--accent); color:#fff; border-color:var(--accent); box-shadow:var(--shadow-sm); }
    .sb-filtercount { font-size:11px; font-weight:800; padding:1px 7px; border-radius:var(--r-full); background:var(--surface-alt); color:var(--text-muted); }
    .sb-filterchip.on .sb-filtercount { background:rgba(255,255,255,.25); color:#fff; }

    .sb-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:16px; }
    .sb-card { display:flex; flex-direction:column; border:1px solid var(--border); border-radius:var(--r-lg); overflow:hidden; background:var(--surface); text-decoration:none; box-shadow:var(--shadow-sm); transition:transform .12s ease, box-shadow .12s ease; }
    .sb-card:hover { transform:translateY(-2px); box-shadow:var(--shadow); }
    .sb-cover { aspect-ratio:16/9; background:var(--surface-alt) center/cover no-repeat; display:flex; align-items:center; justify-content:center; font-size:32px; }
    .sb-card-body { padding:12px 14px 14px; display:flex; flex-direction:column; gap:5px; }
    .sb-card-top { display:flex; justify-content:space-between; align-items:center; }
    .sb-card-type { margin-top:10px; padding-top:10px; display:flex; align-items:center; gap:8px; border-top:1px solid var(--border); }
    .sb-card-type-label { font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:.06em; color:var(--text-muted); }
    .sb-card-type-val { font-size:12px; font-weight:700; color:var(--accent); background:var(--accent-light); padding:2px 9px; border-radius:var(--r-full); }
    .sb-pill { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; padding:3px 8px; border-radius:var(--r-full); }
    .sb-pill.published { background:var(--green-light); color:var(--green); }
    .sb-pill.draft { background:var(--surface-alt); color:var(--text-muted); }
    .sb-price { font-weight:700; color:var(--text); font-size:14px; }
    .sb-card-title { font-weight:700; color:var(--text); }
    .sb-card-outcome { font-size:13px; color:var(--text-secondary); display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }

    .sb-editbar { display:flex; align-items:center; justify-content:space-between; gap:12px; row-gap:12px; margin-bottom:24px; padding-bottom:18px; border-bottom:1px solid var(--border); flex-wrap:wrap; }
    .sb-editbar-actions { display:flex; gap:8px; flex-wrap:wrap; }
    .sb-saved { font-size:13px; color:var(--green); font-weight:600; flex:1; min-width:80px; text-align:center; display:flex; gap:8px; justify-content:center; align-items:center; }
    .sb-ver { font-size:11px; font-weight:700; color:var(--text-muted); background:var(--surface-alt); padding:2px 8px; border-radius:var(--r-full); }


    /* Bigger, distinct action buttons (override the global button reset). */
    .sb-actbtn { display:inline-flex; align-items:center; gap:7px; padding:11px 20px; font-size:14.5px; font-weight:700; border-radius:var(--r-full); border:1.5px solid transparent; cursor:pointer; white-space:nowrap; transition:transform .1s ease, background .12s ease, border-color .12s ease, color .12s ease; }
    .sb-actbtn:disabled { opacity:.55; cursor:default; }
    .sb-act-publish { background:var(--accent); color:var(--accent-foreground); }
    .sb-act-publish:hover:not(:disabled) { background:var(--accent-hover); transform:translateY(-1px); box-shadow:var(--shadow-accent); }
    .sb-act-update { background:var(--surface); color:var(--text); border-color:var(--border-strong); }
    .sb-act-update:hover:not(:disabled) { border-color:var(--accent); color:var(--accent); }
    .sb-act-delete { background:none; color:var(--text-muted); padding-left:14px; padding-right:14px; }
    .sb-act-delete:hover:not(:disabled) { background:#FBE4E0; color:#CE4A3E; }

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
    .sb-permonth { font-size:13px; font-weight:600; color:var(--text-secondary); }

    /* Type selector — tile grid (same language as the block picker + /build/new). */
    .sb-typefield { display:flex; flex-direction:column; gap:10px; min-height:100px }
    .sb-fieldlabel { font-size:13px; font-weight:800; text-transform:uppercase; letter-spacing:.04em; color:var(--text-muted); }
    .sb-fieldhint { font-size:12px; color:var(--text-muted); margin:7px 0 0; }
    .sb-typegrid { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:8px; }
    .sb-typetile { display:flex; align-items:center; gap:9px; text-align:left; white-space:normal; padding:10px 12px; border:1.5px solid var(--border); border-radius:var(--r); background:var(--surface); color:var(--text-secondary); font-size:13px; font-weight:600; cursor:pointer; transition:border-color .1s ease, background .1s ease, color .1s ease; }
    .sb-typetile:hover { border-color:var(--accent-mid); }
    .sb-typetile.on { border-color:var(--accent); background:var(--accent-light); color:var(--accent-hover); }
    .sb-typetile-icon { display:flex; flex-shrink:0; }
    .sb-typetile-label { min-width:0; }
    .sb-typedisplay { display:inline-flex; align-items:center; gap:9px; width:fit-content; padding:9px 15px; border:1.5px solid var(--border); border-radius:var(--r); background:var(--surface-alt); font-size:14px; font-weight:700; color:var(--text); }
    .sb-typedisplay-icon { display:flex; color:var(--accent-hover); }

    /* ── Options tab ── */
    .sb-field { width:100%; }
    .sb-textarea { resize:vertical; font-family:inherit; line-height:1.5; }
    .sb-optrow { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:16px; border:1px solid var(--border); border-radius:var(--r-lg); background:var(--surface); }
    .sb-opthint { font-size:13px; color:var(--text-secondary); margin-top:4px; max-width:42ch; line-height:1.45; }
    .sb-toggle { flex-shrink:0; width:46px; height:27px; border-radius:var(--r-full); border:none; background:var(--border-strong); padding:0; cursor:pointer; position:relative; transition:background .15s ease; }
    .sb-toggle.on { background:var(--accent); }
    .sb-toggle-knob { position:absolute; top:3px; left:3px; width:21px; height:21px; border-radius:var(--r-full); background:#fff; box-shadow:var(--shadow-sm); transition:transform .15s ease; }
    .sb-toggle.on .sb-toggle-knob { transform:translateX(19px); }
    .sb-soontile { cursor:default; opacity:.72; background:var(--surface-alt); box-shadow:none; }
    .sb-soontile:hover { transform:none; box-shadow:none; border-color:var(--border); }
    .sb-soonchip { margin-left:7px; font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:.06em; color:var(--text-muted); background:var(--border); padding:2px 7px; border-radius:var(--r-full); vertical-align:middle; }

    .sb-blockshead { display:flex; justify-content:space-between; align-items:baseline; margin:24px 0 12px; }

    .sb-add { margin-top:4px; }

    /* Trigger — a slim dashed "add" bar (overrides the global button reset). */
    .sb-addtrigger { width:100%; border:1.5px dashed var(--border-strong); border-radius:var(--r); background:var(--surface); padding:11px 16px; font-size:14px; font-weight:700; color:var(--text-secondary); cursor:pointer; white-space:normal; transition:border-color .12s ease, color .12s ease; }
    .sb-addtrigger:hover { border-color:var(--accent); color:var(--accent); }

    /* Picker — inline card with a grid of block-type tiles. */
    .sb-addpicker { border:1px solid var(--border); border-radius:var(--r-lg); background:var(--surface-alt); padding:14px; }
    .sb-addpicker-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
    .sb-addpicker-title { font-size:13px; font-weight:800; text-transform:uppercase; letter-spacing:.04em; color:var(--text-muted); }
    .sb-addpicker-cancel { border:none; background:none; border-radius:var(--r-sm); padding:2px 6px; font-size:13px; font-weight:600; color:var(--text-muted); cursor:pointer; }
    .sb-addpicker-cancel:hover { color:var(--accent); }

    .sb-addgrid { display:grid; grid-template-columns:repeat(auto-fill,minmax(148px,1fr)); gap:10px; }
    /* Tile — full override of the global button styles (radius/center/nowrap). */
    .sb-addtile { display:flex; flex-direction:column; align-items:flex-start; gap:5px; text-align:left; white-space:normal; padding:14px 14px 15px; border:1.5px solid var(--border); border-radius:var(--r); background:var(--surface); cursor:pointer; box-shadow:var(--shadow-sm); transition:transform .1s ease, box-shadow .1s ease, border-color .1s ease; }
    .sb-addtile:hover { transform:translateY(-2px); box-shadow:var(--shadow); border-color:var(--accent-mid); }
    .sb-addtile-icon { font-size:22px; line-height:1; }
    .sb-addtile-label { width:100%; font-size:14px; font-weight:700; color:var(--text); }
    .sb-addtile-hint { width:100%; font-size:12px; color:var(--text-muted); line-height:1.4; }

    /* ── Stepper + panels ── */
    .sb-steps { display:flex; gap:4px; margin-bottom:28px; overflow-x:auto; padding-bottom:4px; }
    .sb-step { display:inline-flex; align-items:center; gap:8px; border:none; background:none; padding:8px 10px; cursor:pointer; white-space:nowrap; color:var(--text-muted); border-radius:var(--r-full); }
    .sb-step-num { display:inline-flex; align-items:center; justify-content:center; width:24px; height:24px; border-radius:var(--r-full); background:var(--surface-alt); color:var(--text-muted); font-size:12px; font-weight:800; flex-shrink:0; }
    .sb-step-label { font-size:14px; font-weight:700; }
    .sb-step:hover { color:var(--text-secondary); }
    .sb-step.done { color:var(--text-secondary); }
    .sb-step.done .sb-step-num { background:var(--accent-light); color:var(--accent-hover); }
    .sb-step.on { color:var(--text); }
    .sb-step.on .sb-step-num { background:var(--accent); color:var(--accent-foreground); }

    .sb-stepnav { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:28px; padding-top:20px; border-top:1px solid var(--border); }

    /* Panel = vertical stack with consistent rhythm so nothing crowds. */
    .sb-panel { display:flex; flex-direction:column; gap:20px; animation:sb-fade .16s ease; }
    @keyframes sb-fade { from { opacity:0; transform:translateY(3px); } to { opacity:1; transform:none; } }

    .sb-panel > .sb-coveredit { margin-bottom:0; }
    .sb-panel .sb-pricerow { border-top:none; padding:0; }
    .sb-panel .sb-blockshead { margin:0; }
    .sb-panel .sb-h2 { margin:0; }
    .sb-panel .sb-add { margin-top:0; }
    /* Title/tagline sit tighter together as one unit. */
    .sb-panel .sb-titleinput { padding:0; }
    .sb-panel .sb-outcomeinput { padding:6px 0 0; }

    .sb-hint { font-size:13px; color:var(--text-secondary); line-height:1.6; margin:0; padding:14px 16px; background:var(--surface-alt); border-radius:var(--r); }
    .sb-hint-muted { background:none; padding:0 2px; color:var(--text-muted); font-size:12px; }

    .sb-checklist { list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:12px; }
    .sb-checklist li { font-size:14px; font-weight:600; color:var(--text-muted); display:flex; gap:10px; align-items:center; }
    .sb-checklist li.ok { color:var(--text); }

    @media (max-width:600px) {
      .sb-listhead { flex-direction:column; }
      .sb-titleinput { font-size:21px; }
    }
  `}</style>;
}
