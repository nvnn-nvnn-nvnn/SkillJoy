import { useState, useEffect, useCallback, useRef, useId } from 'react';
import {
  Link2, Plus, X, Star, Eye, EyeOff, ChevronUp, ChevronDown, ChevronLeft,
  GripVertical, Trash2, HelpCircle, ChevronRight,
  AlignLeft, AlignCenter, AlignRight, BarChart2, Upload, Loader2,
} from 'lucide-react';
import {
  listBlocksResult, createBlock, updateBlock, updateBlockLayout, deleteBlock,
  reorderBlocks, resolveBlockLayout, LINK_STYLES, LINK_SIZES, LINK_SHAPES, PLACEMENTS, contrast, contrastVerdict,
} from '@/lib/blocks';
import { listLinks, addLink, updateLink, deleteLink, reorderLinks } from '@/lib/storefront';
import { useDialog } from '@/components/Dialog';
import { uploadLinkThumb } from '@/lib/storage';

// ── Image picker ────────────────────────────────────────────────────────────
//
// Adding an image used to mean finding a URL somewhere else and pasting it,
// which is a dead end for most people — they have a FILE, not a URL. This
// accepts all four ways someone actually has an image to hand:
//
//   click  → file picker        drop   → drag from the desktop
//   paste  → Ctrl+V a file OR a URL    type → the URL box, still there
//
// The upload goes straight to the public covers bucket and hands back a URL,
// so everything downstream still only ever sees cover_url. That's the point:
// the storage shape doesn't change, only how a value gets into it.
function ImagePick({ value, onChange, creatorId, size = 'sm', hint }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [over, setOver] = useState(false);
  const fileRef = useRef(null);
  const inputId = useId();

  async function take(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setErr('That is not an image file.'); return; }
    // 5MB. Enforced here as well as in the bucket so the failure is instant and
    // explains itself, rather than a 413 after a slow upload.
    if (file.size > 5 * 1024 * 1024) { setErr('Image is over 5MB — try a smaller one.'); return; }
    if (!creatorId) { setErr('Still loading your account — try again in a second.'); return; }
    setErr(''); setBusy(true);
    try {
      onChange(await uploadLinkThumb(creatorId, file));
    } catch (e) {
      setErr(e?.message || 'Upload failed.');
    } finally {
      setBusy(false);
    }
  }

  function onPaste(e) {
    const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'));
    if (item) { e.preventDefault(); take(item.getAsFile()); return; }
    const text = e.clipboardData?.getData('text')?.trim();
    if (text && /^https?:\/\//i.test(text)) { e.preventDefault(); onChange(text); }
  }

  return (
    <div className={`ip ip-${size}`}>
      <div
        className={`ip-tile${value ? ' ip-has' : ''}${over ? ' ip-over' : ''}`}
        style={value ? { backgroundImage: `url(${value})` } : undefined}
        onClick={() => !busy && fileRef.current?.click()}
        onPaste={onPaste}
        onDragOver={e => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={e => { e.preventDefault(); setOver(false); take(e.dataTransfer?.files?.[0]); }}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current?.click(); } }}
        role="button"
        tabIndex={0}
        aria-label={value ? 'Replace image' : 'Add an image'}
        title="Click, drop a file, or paste an image"
      >
        {busy
          ? <span className="ip-state"><Loader2 size={18} className="ip-spin" /></span>
          : !value && <span className="ip-state"><Upload size={size === 'lg' ? 20 : 17} /><span className="ip-cta">Add image</span></span>}
        {value && !busy && (
          <button className="ip-clear" title="Remove image"
            onClick={e => { e.stopPropagation(); onChange(''); setErr(''); }}>
            <X size={12} />
          </button>
        )}
      </div>
      <input ref={fileRef} id={inputId} type="file" accept="image/*" hidden
        onChange={e => { take(e.target.files?.[0]); e.target.value = ''; }} />
      <input className="ip-url" value={value ?? ''} onChange={e => onChange(e.target.value)}
        placeholder="or paste a URL" aria-label="Image URL" spellCheck={false} />
      {err && <span className="ip-err">{err}</span>}
      {hint && !err && <span className="ip-hint">{hint}</span>}
    </div>
  );
}

// ── Links block editor ──────────────────────────────────────────────────────
//
// Two levels, and only one is on screen at a time:
//
//   BLOCK LIST   the page as a vertical stack — pick one to edit
//   BLOCK EDIT   Links / Layouts / Settings for that block
//
// Drilling in rather than showing both is deliberate. The block list mirrors
// page order (position 1 = first thing a visitor sees), and the editor is a
// focused surface with a Back link — the same shape the reference UI uses, and
// it keeps the third level (a single link's fields) from being a third column.
//
// Every option still carries a blurb; the difference from a plain settings form
// is that Layouts is a set of DIAGRAMS. A layout question is about shape, and a
// shape is recognised faster than a word is read.

const ORPHAN_ID = '__orphans__';
const TABS = [
  { id: 'links', label: 'Links' },
  { id: 'layouts', label: 'Layouts' },
  { id: 'settings', label: 'Settings' },
];

export default function LinkBlockEditor({ creatorId, onChange }) {
  const { confirm } = useDialog();
  const [blocks, setBlocks] = useState(null);
  const [links, setLinks] = useState([]);
  const [openId, setOpenId] = useState(null);   // null = showing the block list
  const [tab, setTab] = useState('links');
  const [err, setErr] = useState('');
  const [diag, setDiag] = useState(null);

  const load = useCallback(async () => {
    if (!creatorId) return;
    const res = await listBlocksResult(creatorId);
    setDiag(res.status === 'ok' ? null : res);
    try {
      const l = await listLinks(creatorId);
      setLinks(Array.isArray(l) ? l : []);
    } catch (e) {
      setDiag({ status: 'error', error: { code: e.code || '(no code)', message: e.message, hint: e.hint || null } });
      setLinks([]);
    }
    setBlocks(Array.isArray(res.blocks) ? res.blocks : []);
  }, [creatorId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const touch = () => onChange?.();

  if (blocks === null) return <p className="lb-muted">Loading…</p>;

  const orphans = links.filter(l => !l.block_id).sort((a, b) => a.position - b.position);
  const viewingOrphans = openId === ORPHAN_ID;
  const open = viewingOrphans ? null : blocks.find(b => b.id === openId) || null;
  const openLinks = viewingOrphans
    ? orphans
    : links.filter(l => l.block_id === openId).sort((a, b) => a.position - b.position);
  const layout = resolveBlockLayout(open?.layout);

  // ── Blocks ──
  async function addBlockRow(placement = 'profile') {
    try {
      const b = await createBlock(creatorId, blocks.length, placement);
      setBlocks(prev => [...prev, b]);
      setOpenId(b.id); setTab('links'); touch();
    } catch (e) { setErr(e.message); }
  }

  async function removeBlock(id) {
    const count = links.filter(l => l.block_id === id).length;
    if (!(await confirm({
      title: 'Delete this block?',
      message: count
        ? `This also deletes the ${count} link${count === 1 ? '' : 's'} inside it. This cannot be undone.`
        : 'This cannot be undone.',
      confirmLabel: 'Delete', danger: true,
    }))) return;
    setBlocks(prev => prev.filter(b => b.id !== id));
    setLinks(prev => prev.filter(l => l.block_id !== id));
    setOpenId(null);
    try { await deleteBlock(id); touch(); } catch (e) { setErr(e.message); load(); }
  }

  async function moveBlock(id, dir) {
    const me = blocks.find(b => b.id === id);
    if (!me) return;
    const place = me.placement || 'profile';
    // Neighbour within the same section, then translated back to a global index
    // — the arrows are section-local but the stored order is one list.
    const siblings = blocks.filter(b => (b.placement || 'profile') === place);
    const si = siblings.findIndex(b => b.id === id);
    const target = siblings[si + dir];
    if (!target) return;
    const idx = blocks.findIndex(b => b.id === id);
    const j = blocks.findIndex(b => b.id === target.id);
    const next = [...blocks];
    [next[idx], next[j]] = [next[j], next[idx]];
    setBlocks(next.map((b, i) => ({ ...b, position: i })));
    try { await reorderBlocks(next.map(b => b.id)); touch(); }
    catch (e) { setErr(e.message); load(); }
  }

  async function patchBlock(patch) {
    if (!open) return;
    setBlocks(prev => prev.map(b => b.id === open.id ? { ...b, ...patch } : b));
    try { await updateBlock(open.id, patch); touch(); }
    catch (e) { setErr(e.message); load(); }
  }

  async function patchLayout(patch) {
    if (!open) return;
    setBlocks(prev => prev.map(b => b.id === open.id ? { ...b, layout: { ...layout, ...patch } } : b));
    try { await updateBlockLayout(open.id, open.layout, patch); touch(); }
    catch (e) { setErr(e.message); load(); }
  }

  // ── Links ──
  async function addRow() {
    try {
      const l = await addLink(creatorId, {
        label: 'New link', url: '', position: openLinks.length,
        block_id: viewingOrphans ? null : openId,
      });
      setLinks(prev => [...prev, l]); touch();
    } catch (e) { setErr(e.message); }
  }
  const patchLinkLocal = (id, patch) => setLinks(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
  async function saveLink(id, patch) {
    try { await updateLink(id, patch); touch(); } catch (e) { setErr(e.message); }
  }
  async function removeRow(id) {
    setLinks(prev => prev.filter(l => l.id !== id));
    try { await deleteLink(id); touch(); } catch (e) { setErr(e.message); load(); }
  }
  async function move(id, dir) {
    const idx = openLinks.findIndex(l => l.id === id);
    const j = idx + dir;
    if (j < 0 || j >= openLinks.length) return;
    const next = [...openLinks];
    [next[idx], next[j]] = [next[j], next[idx]];
    const posById = new Map(next.map((l, i) => [l.id, i]));
    setLinks(prev => prev.map(l => posById.has(l.id) ? { ...l, position: posById.get(l.id) } : l));
    try { await reorderLinks(next.map(l => l.id)); touch(); }
    catch (e) { setErr(e.message); load(); }
  }

  const diagnostic = diag && (
    <div className="lb-diag" role="alert">
      <p className="lb-diag-t">
        {diag.status === 'not-installed'
          ? 'Link blocks aren’t available on this database yet'
          : 'Couldn’t load link blocks'}
      </p>
      <p className="lb-diag-m">{diag.error?.message}</p>
      <code className="lb-diag-c">{diag.error?.code}{diag.error?.hint ? ` · ${diag.error.hint}` : ''}</code>
      {diag.status === 'not-installed' && (
        <ul className="lb-diag-steps">
          <li>Run <code>032_store_blocks.sql</code> (and <code>029_link_placement.sql</code> first).</li>
          <li>Already ran them? The API layer is stale: <code>notify pgrst, &apos;reload schema&apos;;</code></li>
        </ul>
      )}
      <p className="lb-diag-f">Your links are safe and still on your page — they show under <strong>Unsorted</strong>.</p>
    </div>
  );

  // ══════════════ BLOCK LIST ══════════════
  if (!open && !viewingOrphans) {
    return (
      <div className="lb">
        {diagnostic}
        {err && <p className="lb-err">{err}</p>}

        {/* ── Two lists, not one ──
            Placement used to be a per-LINK star inside a shared list, so one
            block could feed two page regions at once — printing its title in
            both, with one layout applied to two unrelated groups. Placement is
            a property of the container now (migration 033), so the editor shows
            the page's actual structure: these render here, those render there. */}
        {PLACEMENTS.map(pl => {
          const mine = blocks.filter(b => (b.placement || 'profile') === pl.id);
          return (
            <div key={pl.id} className="lb-sect">
              <div className="lb-secthead">
                <span className="lb-sectico">{pl.id === 'featured' ? <Star size={14} /> : <Link2 size={14} />}</span>
                <div className="lb-secttext">
                  <span className="lb-secttitle">{pl.label}</span>
                  <span className="lb-sectblurb">{pl.blurb}</span>
                </div>
                <button className="lb-sectadd" onClick={() => addBlockRow(pl.id)}>
                  <Plus size={14} /> Add block
                </button>
              </div>

              {mine.length === 0 ? (
                <p className="lb-sectempty">No {pl.label.toLowerCase()} yet.</p>
              ) : (
                <div className="lb-list">
                  {mine.map((b, i) => {
                    const rows = links.filter(l => l.block_id === b.id);
                    const st = LINK_STYLES.find(x => x.id === resolveBlockLayout(b.layout).style);
                    return (
                      <div key={b.id} className={`lb-row2${b.visible ? '' : ' off'}`}>
                        <div className="lb-rank">
                          <button className="lb-nudge" disabled={i === 0} onClick={() => moveBlock(b.id, -1)} aria-label="Move up"><ChevronUp size={15} /></button>
                          <span className="lb-num">{i + 1}</span>
                          <button className="lb-nudge" disabled={i === mine.length - 1} onClick={() => moveBlock(b.id, 1)} aria-label="Move down"><ChevronDown size={15} /></button>
                        </div>

                        <button className="lb-open" onClick={() => { setOpenId(b.id); setTab('links'); }}>
                          <span className="lb-t">
                            {b.title?.trim() || 'Untitled block'}
                            {!b.visible && <span className="lb-pill lb-pill-off"><EyeOff size={10} /> Hidden</span>}
                          </span>
                          <span className="lb-chips">
                            <span className="lb-chip">{st?.label}</span>
                            <span className="lb-chip">{rows.length} link{rows.length === 1 ? '' : 's'}</span>
                            {rows.length === 0 && <span className="lb-chip lb-chip-warn">No links yet</span>}
                          </span>
                        </button>

                        <span className="lb-go" aria-hidden="true"><ChevronRight size={17} /></span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        <div className="lb-list">
          {orphans.length > 0 && (
            <div className="lb-row2 lb-row2-orphan">
              <div className="lb-rank"><span className="lb-num lb-num-dash">—</span></div>
              <button className="lb-open" onClick={() => { setOpenId(ORPHAN_ID); setTab('links'); }}>
                <span className="lb-t">Unsorted links</span>
                <span className="lb-chips">
                  <span className="lb-chip">{orphans.length} link{orphans.length === 1 ? '' : 's'}</span>
                  <span className="lb-chip lb-chip-warn">Not in a block</span>
                </span>
              </button>
              <span className="lb-go" aria-hidden="true"><ChevronRight size={17} /></span>
            </div>
          )}
        </div>

        {/* Self-diagnosing empty state. "Nothing here" is ambiguous between
            "you have no links", "they didn't load", and "they loaded but are
            attached to something this screen isn't showing" — so it says which.
            Guessing at that from the outside cost several rounds. */}
        {blocks.length === 0 && orphans.length === 0 && (
          <div className="lb-empty">
            <span className="lb-emptyicon"><Link2 size={24} /></span>
            <p className="lb-empty-t">No link blocks yet</p>
            <p className="lb-empty-s">
              A block is a group of links with its own title, layout and visibility.
              Most pages start with one.
            </p>
            <button className="lb-primary" onClick={() => addBlockRow('profile')}>
              <Plus size={17} /> Create your first block
            </button>
            {/* Only worth showing when the two numbers disagree — links that
                exist but sit in no block is the one state a creator can't
                diagnose from the screen alone. */}
            {links.length > 0 && (
              <p className="lb-empty-d">
                Found <strong>{links.length}</strong> link{links.length === 1 ? '' : 's'} not attached to
                any block. That usually means migration 032’s backfill hasn’t run.
              </p>
            )}
          </div>
        )}

        {/* MUST be in this branch too. The component has two top-level returns
            and the stylesheet lives in the JSX, so leaving it out of one branch
            renders that entire branch with NO css — which looks like a broken
            layout rather than a missing element. That's what shipped. */}
        <Styles />
      </div>
    );
  }

  // ══════════════ BLOCK EDITOR ══════════════
  return (
    <div className="lb">
      {/* Header — name, and the three actions that apply to the whole block. */}
      <div className="lb-head">
        <button className="lb-back" onClick={() => setOpenId(null)}><ChevronLeft size={15} /> Back</button>
      </div>
      <div className="lb-headmain">
        <span className="lb-headicon"><Link2 size={16} /></span>
        {open ? (
          <input
            className="lb-headname"
            value={open.title ?? ''}
            onChange={e => setBlocks(prev => prev.map(b => b.id === open.id ? { ...b, title: e.target.value } : b))}
            onBlur={e => patchBlock({ title: e.target.value })}
            placeholder="Links"
            aria-label="Block name"
          />
        ) : <span className="lb-headname lb-headname-static">Unsorted</span>}
        {open && (
          <div className="lb-headacts">
            <button className="lb-ic" title="These settings apply to this block only" aria-label="Help"><HelpCircle size={15} /></button>
            <button className="lb-ic lb-del" onClick={() => removeBlock(open.id)} aria-label="Delete block"><Trash2 size={15} /></button>
            <button className={`lb-ic${open.visible ? '' : ' on'}`} onClick={() => patchBlock({ visible: !open.visible })}
              aria-pressed={!open.visible} title={open.visible ? 'Visible — hide this block' : 'Hidden — show this block'}>
              {open.visible ? <Eye size={15} /> : <EyeOff size={15} />}
            </button>
          </div>
        )}
      </div>

      <div className="lb-tabs" role="tablist">
        {TABS.filter(t => open || t.id === 'links').map(t => (
          <button key={t.id} role="tab" aria-selected={tab === t.id}
            className={`lb-tab${tab === t.id ? ' on' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {diagnostic}
      {err && <p className="lb-err">{err}</p>}

      {/* ══ LINKS ══ */}
      {tab === 'links' && (
        <div className="lb-panel">
          {/* Primary action at the TOP. Adding is the most frequent job here,
              and a button below a long list moves further away the more links
              you have — the opposite of what frequency should do. */}
          <button className="lb-primary lb-full" onClick={addRow}><Plus size={17} /> Add link</button>

          {viewingOrphans && (
            <p className="lb-blurb">
              These links aren’t in a block yet, so they use your page’s default look.
              Make a block to give them a title and their own layout.
            </p>
          )}
          {openLinks.length === 0 && <p className="lb-muted">No links yet.</p>}

          {/* The two categories now render in different PLACES with different
              rules, so the editor has to say so — starring a link moves it. */}
          {openLinks.length > 0 && (
            <p className="lb-blurb">
              <strong>Profile links</strong> sit inside your profile card.{' '}
              <strong>Featured links</strong> (★) move out into the page above your
              products, and keep this block’s layout, colours and title.
            </p>
          )}

          {openLinks.map((l, i) => (
            <div key={l.id} className={`lb-card${l.visible === false ? ' off' : ''}`}>
              <span className="lb-drag" aria-hidden="true"><GripVertical size={15} /></span>

              <div className="lb-cardbody">
                <input className="lb-in lb-in-title" value={l.label ?? ''}
                  onChange={e => patchLinkLocal(l.id, { label: e.target.value })}
                  onBlur={e => saveLink(l.id, { label: e.target.value })}
                  placeholder="Link title" />
                <input className="lb-in lb-in-desc" value={l.description ?? ''}
                  onChange={e => patchLinkLocal(l.id, { description: e.target.value })}
                  onBlur={e => saveLink(l.id, { description: e.target.value })}
                  placeholder="Description" />
                <input className="lb-in lb-in-url" value={l.url ?? ''}
                  onChange={e => patchLinkLocal(l.id, { url: e.target.value })}
                  onBlur={e => saveLink(l.id, { url: e.target.value })}
                  placeholder="https://…" />

                <div className="lb-cardacts">
                  <button className={`lb-ic${l.is_affiliate ? ' on' : ''}`}
                    onClick={() => { patchLinkLocal(l.id, { is_affiliate: !l.is_affiliate }); saveLink(l.id, { is_affiliate: !l.is_affiliate }); }}
                    aria-pressed={!!l.is_affiliate} title="Affiliate link — adds a disclosure tag and rel=sponsored">
                    <BarChart2 size={14} />
                  </button>
                  <span className="lb-cardspacer" />
                  <button className="lb-ic" disabled={i === 0} onClick={() => move(l.id, -1)} aria-label="Move up"><ChevronUp size={14} /></button>
                  <button className="lb-ic" disabled={i === openLinks.length - 1} onClick={() => move(l.id, 1)} aria-label="Move down"><ChevronDown size={14} /></button>
                  <span className="lb-carddiv" />
                  <button className="lb-ic" onClick={() => { const v = l.visible === false; patchLinkLocal(l.id, { visible: v }); saveLink(l.id, { visible: v }); }}
                    aria-pressed={l.visible === false} title={l.visible === false ? 'Hidden — show it' : 'Visible — hide it'}>
                    {l.visible === false ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button className="lb-ic lb-del" onClick={() => removeRow(l.id)} aria-label="Delete link"><X size={14} /></button>
                </div>
              </div>

              {/* Thumbnail on the right, where the reference puts it — it reads
                  as a preview of the destination rather than a form field. */}
              <ImagePick
                value={l.cover_url ?? ''}
                creatorId={creatorId}
                onChange={v => { patchLinkLocal(l.id, { cover_url: v }); saveLink(l.id, { cover_url: v }); }}
              />
            </div>
          ))}
        </div>
      )}

      {/* ══ LAYOUTS ══ */}
      {tab === 'layouts' && open && (
        <div className="lb-panel">
          <span className="lb-h">Layout</span>
          <div className="lb-tiles">
            {LINK_STYLES.map(s => (
              <button key={s.id} className={`lb-tile${layout.style === s.id ? ' on' : ''}`}
                onClick={() => patchLayout({ style: s.id })} title={s.blurb} aria-pressed={layout.style === s.id}>
                <span className="lb-tileart"><StyleArt id={s.id} /></span>
                <span className="lb-tilelabel">{s.label}</span>
              </button>
            ))}
          </div>
          <p className="lb-hint">{LINK_STYLES.find(s => s.id === layout.style)?.blurb}</p>

          {layout.style === 'grid' && (
            <>
              <span className="lb-h">Columns</span>
              <div className="lb-sq">
                {[2, 3].map(c => (
                  <button key={c} className={`lb-sqbtn${layout.columns === c ? ' on' : ''}`}
                    onClick={() => patchLayout({ columns: c })}>{c}</button>
                ))}
              </div>
            </>
          )}

          <span className="lb-h">Link block size</span>
          <div className="lb-sq">
            {LINK_SIZES.map(s => (
              <button key={s.id} className={`lb-sqbtn${layout.size === s.id ? ' on' : ''}`}
                onClick={() => patchLayout({ size: s.id })} title={s.blurb}>{s.label}</button>
            ))}
          </div>

          <span className="lb-h">Text alignment</span>
          <div className="lb-sq">
            {[['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]].map(([a, Ico]) => (
              <button key={a} className={`lb-sqbtn${layout.align === a ? ' on' : ''}`}
                onClick={() => patchLayout({ align: a })} aria-label={`Align ${a}`} aria-pressed={layout.align === a}>
                <Ico size={17} />
              </button>
            ))}
          </div>

          <span className="lb-h">Block shape</span>
          <div className="lb-sq">
            <button className={`lb-sqbtn${!layout.shape ? ' on' : ''}`}
              onClick={() => patchLayout({ shape: '' })} title="Follow the page-level link shape"
              aria-pressed={!layout.shape}>Page</button>
            {LINK_SHAPES.map(sh => (
              <button key={sh.id} className={`lb-sqbtn lb-shapebtn${layout.shape === sh.id ? ' on' : ''}`}
                onClick={() => patchLayout({ shape: sh.id })} title={sh.blurb} aria-pressed={layout.shape === sh.id}>
                <span className="lb-shapeart" style={{ borderRadius: sh.radius }} />
              </button>
            ))}
          </div>
          <p className="lb-hint">{layout.shape ? LINK_SHAPES.find(sh => sh.id === layout.shape)?.blurb : 'Using the shape set in Customize → Link buttons.'}</p>

          <Switch on={!!layout.outline} onChange={v => patchLayout({ outline: v })}
            label="Link outline" blurb="A border around each link. Helps them read as buttons on a busy background." />
          <Switch on={!!layout.shadow} onChange={v => patchLayout({ shadow: v })}
            label="Link shadow" blurb="Lifts each link off the page. Subtle depth, or skip it for a flat look." />

          <span className="lb-h">Colours</span>
          <p className="lb-hint">
            Per block, so two blocks can look completely different. Leave any of them
            on <strong>Theme</strong> to follow your page colours.
          </p>

          <ColorRow label="Link background" value={layout.bg} onChange={v => patchLayout({ bg: v })} fallback="#ffffff" />
          <ColorRow label="Link text" value={layout.fg} onChange={v => patchLayout({ fg: v })} fallback="#1a1916" />
          <ColorRow label="Title & subtitle" value={layout.headingColor} onChange={v => patchLayout({ headingColor: v })} fallback="#1a1916" />

          {/* Live verdict on the pair that actually decides readability. Only
              shown when BOTH are set — with either inheriting the theme we
              can't resolve the real value, and a confident wrong warning is
              worse than none. */}
          <ContrastNote bg={layout.bg} fg={layout.fg} />
        </div>
      )}

      {/* ══ SETTINGS ══ */}
      {tab === 'settings' && open && (
        <div className="lb-panel">
          {/* Placement first, because it decides WHERE everything below lands.
              It's a block property (033) — the whole block moves, links and all,
              so there is never a title rendered in two regions at once. */}
          <span className="lb-h">Where this block appears</span>
          <div className="lb-places">
            {PLACEMENTS.map(pl => {
              const on = (open.placement || 'profile') === pl.id;
              return (
                <button key={pl.id} className={`lb-place${on ? ' on' : ''}`}
                  onClick={() => patchBlock({ placement: pl.id })} aria-pressed={on}>
                  <span className="lb-placeico">{pl.id === 'featured' ? <Star size={15} /> : <Link2 size={15} />}</span>
                  <span className="lb-placetext">
                    <span className="lb-placelabel">{pl.label}</span>
                    <span className="lb-placeblurb">{pl.blurb}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <span className="lb-h">Title <span className="lb-opt">(optional)</span></span>
          <p className="lb-hint">
            Help your audience find the link they’re looking for by adding a title and
            description to this links block.
          </p>
          <input className="lb-in lb-boxed" value={open.title ?? ''}
            onChange={e => setBlocks(prev => prev.map(b => b.id === open.id ? { ...b, title: e.target.value } : b))}
            onBlur={e => patchBlock({ title: e.target.value })} placeholder="Title" />
          <input className="lb-in lb-boxed" value={open.subtitle ?? ''}
            onChange={e => setBlocks(prev => prev.map(b => b.id === open.id ? { ...b, subtitle: e.target.value } : b))}
            onBlur={e => patchBlock({ subtitle: e.target.value })} placeholder="Subtitle" />

          <span className="lb-h">Links block visibility</span>
          {/* Two tiles rather than a toggle: "exposed" and "collapsed" are two
              different SHAPES on the page, and showing the shapes answers the
              question faster than the words do. */}
          <div className="lb-tiles lb-tiles-2">
            <button className={`lb-tile${!open.collapsible ? ' on' : ''}`}
              onClick={() => patchBlock({ collapsible: false })} aria-pressed={!open.collapsible}>
              <span className="lb-tileart"><VisArt kind="exposed" /></span>
              <span className="lb-tilelabel">Exposed</span>
            </button>
            <button className={`lb-tile${open.collapsible ? ' on' : ''}`}
              onClick={() => patchBlock({ collapsible: true, default_collapsed: true })} aria-pressed={!!open.collapsible}>
              <span className="lb-tileart"><VisArt kind="collapsed" /></span>
              <span className="lb-tilelabel">Collapsed</span>
            </button>
          </div>
          <p className="lb-hint">
            {open.collapsible
              ? 'Visitors tap to open it. Keeps a long page short — but anything collapsed gets far fewer clicks.'
              : 'Always open. Every link is visible as soon as the page loads.'}
          </p>

          {open.collapsible && (
            <>
              <Switch on={!!open.default_collapsed} onChange={v => patchBlock({ default_collapsed: v })}
                label="Start collapsed" blurb="Closed when someone lands on your page." />

              <span className="lb-h">Collapsed thumbnail image</span>
              <div className="lb-thumbrow">
                <ImagePick
                  value={open.collapsed_thumb_url ?? ''}
                  creatorId={creatorId}
                  size="lg"
                  onChange={v => { setBlocks(prev => prev.map(b => b.id === open.id ? { ...b, collapsed_thumb_url: v } : b)); patchBlock({ collapsed_thumb_url: v }); }}
                />
                <p className="lb-hint lb-thumbside">Square, at least 600&times;600px, JPG/PNG/GIF. Shown on the closed row, so a collapsed block still gives people a reason to open it.</p>
              </div>
            </>
          )}
        </div>
      )}

      <Styles />
    </div>
  );
}

// Small diagrams of each layout. Pure CSS boxes — an icon font or SVG asset
// would be more precise and much harder to keep in sync with the real styles.
function StyleArt({ id }) {
  if (id === 'classic') return <span className="art art-classic"><i /><i /><i /><i /></span>;
  if (id === 'carousel') return <span className="art art-carousel"><i /><i /><i /></span>;
  if (id === 'grid') return <span className="art art-grid">{Array.from({ length: 9 }, (_, i) => <i key={i} />)}</span>;
  return <span className="art art-cards"><i /><i /><i /><i /></span>;
}

function VisArt({ kind }) {
  if (kind === 'exposed') return <span className="art art-classic art-dim"><i /><i /><i /><i /></span>;
  return <span className="art art-collapsed"><i /></span>;
}

// A colour with an explicit "follow the theme" state. The swatch is the control
// AND the preview; "Theme" is a real, resettable value rather than the absence
// of one, which is what makes it obvious you can go back.
function ColorRow({ label, value, onChange, fallback }) {
  const set = !!value;
  return (
    <div className="lb-colorrow">
      <label className="lb-swatchwrap" title={label}>
        <span className={`lb-swatch${set ? '' : ' lb-swatch-theme'}`}
          style={set ? { background: value } : undefined} />
        <input type="color" value={value || fallback} onChange={e => onChange(e.target.value)} aria-label={label} />
      </label>
      <span className="lb-colortext">
        <span className="lb-colorlabel">{label}</span>
        <span className="lb-colorval">{set ? value.toUpperCase() : 'Theme default'}</span>
      </span>
      {set && (
        <button className="lb-reset" onClick={() => onChange('')}>Reset</button>
      )}
    </div>
  );
}

function ContrastNote({ bg, fg }) {
  const ratio = contrast(bg, fg);
  const verdict = contrastVerdict(ratio);
  if (!verdict) return null;
  return (
    <div className={`lb-contrast lb-contrast-${verdict.level}`}>
      <span className="lb-contrastswatch" style={{ background: bg, color: fg }}>Aa</span>
      <span className="lb-contrasttext">
        <span className="lb-contrastlabel">{verdict.label}</span>
        <span className="lb-hint">
          {ratio.toFixed(1)}:1 · {ratio >= 4.5 ? 'passes' : 'fails'} the 4.5:1 standard for body text
        </span>
      </span>
    </div>
  );
}

function Switch({ on, onChange, label, blurb }) {
  return (
    <label className="lb-switch">
      <span className={`lb-track${on ? ' on' : ''}`}>
        <input type="checkbox" checked={on} onChange={e => onChange(e.target.checked)} />
        <span className="lb-knob" />
      </span>
      <span className="lb-switchtext">
        <span className="lb-switchlabel">{label}</span>
        <span className="lb-hint">{blurb}</span>
      </span>
    </label>
  );
}

function Styles() {
  return <style>{`
    .lb { display:flex; flex-direction:column; gap:12px; }
    .lb-muted { color:var(--text-muted); font-size:14px; }
    .lb-err { margin:0; padding:9px 12px; border-radius:var(--r-sm); font-size:13px; font-weight:600;
      color:var(--danger); background:var(--danger-light); border:1px solid var(--danger-mid); }

    .lb-diag { padding:14px 16px; border-radius:var(--r-lg); background:var(--danger-light); border:1px solid var(--danger-mid); }
    .lb-diag-t { margin:0 0 6px; font-size:14px; font-weight:800; color:var(--danger); }
    .lb-diag-m { margin:0 0 8px; font-size:13px; line-height:1.55; color:var(--text-secondary); }
    .lb-diag-c { display:inline-block; padding:3px 8px; border-radius:var(--r-sm); background:var(--surface);
      border:1px solid var(--border); font-family:ui-monospace,monospace; font-size:11.5px; color:var(--text-secondary); word-break:break-all; }
    .lb-diag-steps { margin:10px 0 0; padding-left:18px; display:flex; flex-direction:column; gap:6px;
      font-size:12.5px; line-height:1.55; color:var(--text-secondary); }
    .lb-diag-steps code { padding:1px 5px; border-radius:3px; background:var(--surface); border:1px solid var(--border); font-size:11.5px; }
    .lb-diag-f { margin:10px 0 0; font-size:12px; color:var(--text-muted); }

    /* ── Block list ── */
    /* ── Block rows ──
       Solid --surface on purpose. The parent .std-panel is GLASS (72% surface
       + blur), so a translucent or shadow-only row is nearly the same tone as
       the panel behind it and reads as nothing. Opaque fill + a real border is
       what makes these read as objects sitting ON the panel. */
    /* ── Placement sections ──
       Two lists that must read as two PLACES, not two groups of the same
       thing. So each gets a solid header band and a left rule tying its rows
       to that header — the same visual grammar the page itself uses. */
    .lb-sect { margin-bottom:22px; }
    .lb-secthead { display:flex; align-items:flex-start; gap:11px; padding:12px 14px;
      border:1px solid var(--border); border-radius:var(--r) var(--r) 0 0;
      background:var(--surface-alt); border-bottom:none; }
    .lb-sectico { flex-shrink:0; width:28px; height:28px; border-radius:8px; display:flex;
      align-items:center; justify-content:center; background:var(--accent); color:#fff; }
    .lb-secttext { flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }
    .lb-secttitle { font-size:14.5px; font-weight:800; color:var(--text); }
    .lb-sectblurb { font-size:12.5px; line-height:1.45; color:var(--text-secondary); }
    .lb-sectadd { flex-shrink:0; display:inline-flex; align-items:center; gap:6px; padding:7px 13px;
      border-radius:var(--r-full); border:1px solid var(--accent); background:transparent;
      color:var(--accent); font-size:12.5px; font-weight:800; cursor:pointer; white-space:nowrap;
      transition:background .14s ease, color .14s ease; }
    .lb-sectadd:hover { background:var(--accent); color:#fff; }
    .lb-sectempty { margin:0; padding:16px 14px; border:1px solid var(--border); border-top:none;
      border-radius:0 0 var(--r) var(--r); background:var(--surface);
      font-size:12.5px; color:var(--text-muted); }
    .lb-sect .lb-list { padding:10px; border:1px solid var(--border); border-top:none;
      border-radius:0 0 var(--r) var(--r); background:var(--surface); }

    /* Placement picker in Settings. */
    .lb-places { display:flex; flex-direction:column; gap:9px; }
    .lb-place { display:flex; align-items:flex-start; gap:11px; width:100%; text-align:left;
      padding:13px 14px; border-radius:var(--r); border:1.5px solid var(--border);
      background:var(--surface); cursor:pointer; white-space:normal;
      transition:border-color .14s ease, background .14s ease; }
    .lb-place:hover { border-color:var(--accent-mid); }
    .lb-place.on { border-color:var(--accent); background:var(--accent-light); }
    .lb-placeico { flex-shrink:0; width:30px; height:30px; border-radius:8px; display:flex;
      align-items:center; justify-content:center; background:var(--surface-alt);
      border:1px solid var(--border); color:var(--text-secondary); }
    .lb-place.on .lb-placeico { background:var(--accent); border-color:var(--accent); color:#fff; }
    .lb-placetext { display:flex; flex-direction:column; gap:2px; min-width:0; }
    .lb-placelabel { font-size:14px; font-weight:800; color:var(--text); }
    .lb-placeblurb { font-size:12.5px; line-height:1.45; color:var(--text-secondary); }

    .lb-list { display:flex; flex-direction:column; gap:10px; }

    /* Empty state. Generous vertical rhythm on purpose — this is the first
       thing a new creator sees, and three lines stacked tight reads as an error
       message rather than an invitation. */
    .lb-empty { display:flex; flex-direction:column; align-items:center; text-align:center;
      padding:44px 28px; border:1.5px dashed var(--border-strong); border-radius:16px;
      background:var(--surface); }
    .lb-emptyicon { display:inline-flex; align-items:center; justify-content:center;
      width:56px; height:56px; border-radius:16px; margin-bottom:18px;
      background:var(--green-light); color:var(--green); }
    .lb-empty-t { font-size:18px; font-weight:800; color:var(--text); margin:0 0 10px; }
    .lb-empty-s { font-size:14px; line-height:1.65; color:var(--text-secondary);
      margin:0 0 24px; max-width:38ch; }
    .lb-empty-d { margin:24px 0 0; padding:12px 15px; border-radius:var(--r);
      background:var(--danger-light); border:1px solid var(--danger-mid);
      font-size:12.5px; line-height:1.6; color:var(--text-secondary); max-width:44ch; }

    .lb-row2 { display:flex; align-items:stretch; gap:0;
      background:var(--surface); border:1.5px solid var(--border-strong);
      border-radius:14px; overflow:hidden;
      transition:border-color .13s ease, box-shadow .13s ease, transform .13s ease; }
    .lb-row2:hover { border-color:var(--accent); box-shadow:0 6px 18px rgb(var(--accent-rgb) / .13); transform:translateY(-1px); }
    .lb-row2.off { opacity:.62; }
    .lb-row2-orphan { border-style:dashed; border-color:var(--border-strong); }

    /* Rank rail: position and the two nudges, grouped so order controls sit
       together instead of at opposite ends of the row. */
    .lb-rank { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px;
      flex-shrink:0; width:48px; padding:8px 0; background:var(--surface-alt);
      border-right:1px solid var(--border); }
    .lb-num { font-size:15px; font-weight:800; color:var(--text-secondary); line-height:1; }
    .lb-num-dash { color:var(--text-muted); }
    .lb-nudge { width:24px; height:20px; padding:0; display:inline-flex; align-items:center;
      justify-content:center; border:none; background:none; color:var(--text-muted);
      cursor:pointer; border-radius:4px; }
    .lb-nudge:hover:not(:disabled) { background:var(--surface); color:var(--text); }
    .lb-nudge:disabled { opacity:.25; cursor:default; }

    .lb-open { flex:1; min-width:0; display:flex; flex-direction:column; gap:9px; align-items:flex-start;
      padding:18px 18px; border:none; background:none; text-align:left; font-family:inherit;
      cursor:pointer; color:inherit; }
    .lb-t { display:flex; align-items:center; gap:8px; flex-wrap:wrap; font-size:17px; font-weight:750;
      color:var(--text); line-height:1.25; }

    /* Chips carry the summary. Separate pills rather than a dot-joined string
       so the warning states can be coloured independently. */
    .lb-chips { display:flex; flex-wrap:wrap; gap:5px; }
    .lb-chip { display:inline-flex; align-items:center; gap:5px; padding:4px 11px; border-radius:var(--r-full);
      background:var(--surface-alt); border:1px solid var(--border);
      font-size:12px; font-weight:700; color:var(--text-secondary); white-space:nowrap; }
    .lb-chip-star { background:var(--accent); border-color:var(--accent); color:#fff; }
    .lb-chip-warn { background:var(--danger); border-color:var(--danger); color:#fff; }
    .lb-pill-off { display:inline-flex; align-items:center; gap:4px; padding:2px 8px; border-radius:var(--r-full);
      background:var(--surface-alt); border:1px solid var(--border); font-size:10px; font-weight:800;
      text-transform:uppercase; letter-spacing:.05em; color:var(--text-muted); }

    .lb-go { display:flex; align-items:center; padding-right:14px; color:var(--text-muted); flex-shrink:0; }
    .lb-row2:hover .lb-go { color:var(--accent); }

    .lb-tag { display:inline-flex; align-items:center; gap:3px; font-size:9.5px; font-weight:800;
      text-transform:uppercase; letter-spacing:.05em; color:var(--text-muted);
      background:var(--surface-alt); border:1px solid var(--border); padding:2px 6px; border-radius:var(--r-full); }

    /* ── Header ── */
    .lb-head { display:flex; }
    .lb-back { display:inline-flex; align-items:center; gap:3px; width:auto; padding:5px 9px 5px 5px;
      border:none; background:none; color:var(--text-secondary); font-size:13px; font-weight:700;
      font-family:inherit; cursor:pointer; border-radius:var(--r-sm); }
    .lb-back:hover { background:var(--surface-alt); color:var(--text); }
    .lb-headmain { display:flex; align-items:center; gap:11px; }
    .lb-headicon { flex-shrink:0; display:inline-flex; align-items:center; justify-content:center;
      width:32px; height:32px; border-radius:9px; background:var(--green-light); color:var(--green); }
    .lb-headname { flex:1; min-width:0; padding:9px 11px; border:1.5px solid transparent; border-radius:var(--r-sm);
      background:transparent; font-size:17px; font-weight:800; color:var(--text); font-family:inherit; }
    .lb-headname:hover { border-color:var(--border); }
    .lb-headname:focus { outline:none; border-color:var(--accent); background:var(--surface); }
    .lb-headname-static { border-color:transparent; }
    .lb-headacts { display:flex; gap:4px; flex-shrink:0; }

    /* ── Tabs: quiet text, active gets a soft pill ── */
    .lb-tabs { display:flex; gap:2px; }
    .lb-tab { width:auto; padding:7px 13px; border:none; border-radius:var(--r-sm); background:transparent;
      color:var(--text-muted); font-size:13.5px; font-weight:700; font-family:inherit; cursor:pointer; }
    .lb-tab:hover { color:var(--text); background:var(--surface-alt); }
    .lb-tab.on { background:var(--surface-alt); color:var(--text); }

    .lb-panel { display:flex; flex-direction:column; gap:12px; }
    .lb-h { font-size:14px; font-weight:800; color:var(--text); margin-top:4px; }
    .lb-opt { font-size:12px; font-weight:600; color:var(--text-muted); }
    .lb-hint { font-size:12.5px; line-height:1.55; color:var(--text-muted); margin:-4px 0 0; }
    .lb-blurb { margin:0; padding:11px 13px; border-radius:var(--r); font-size:12.5px; line-height:1.6;
      color:var(--text-secondary); background:var(--surface-alt); border:1px solid var(--border); }

    .lb-primary { display:inline-flex; align-items:center; justify-content:center; gap:8px; padding:14px 22px;
      border:none; border-radius:var(--r); background:var(--text); color:var(--bg);
      font-size:15px; font-weight:750; font-family:inherit; cursor:pointer; }
    .lb-primary:hover { opacity:.88; }
    .lb-full { width:100%; }

    /* ── Link card ── */
    .lb-card { display:flex; align-items:flex-start; gap:11px; padding:14px;
      border:1px solid var(--border); border-radius:var(--r-lg); background:var(--surface); }
    .lb-card.off { opacity:.6; }
    .lb-drag { flex-shrink:0; padding-top:9px; color:var(--text-muted); cursor:grab; }
    .lb-cardbody { flex:1; min-width:0; display:flex; flex-direction:column; gap:4px; }
    .lb-in { width:100%; padding:6px 8px; border:1.5px solid transparent; border-radius:var(--r-sm);
      background:transparent; color:var(--text); font-family:inherit; font-size:13.5px; }
    .lb-in:hover { border-color:var(--border); }
    .lb-in:focus { outline:none; border-color:var(--accent); background:var(--surface-alt); }
    .lb-in-title { font-size:15px; font-weight:750; }
    .lb-in-desc { color:var(--text-secondary); }
    .lb-in-url { color:var(--accent-hover); }
    .lb-boxed { border-color:var(--border-strong); background:var(--surface); padding:10px 12px; }
    .lb-cardacts { display:flex; align-items:center; gap:3px; margin-top:5px; flex-wrap:wrap; }
    .lb-cardspacer { flex:1; }
    .lb-carddiv { width:1px; height:18px; background:var(--border); margin:0 4px; }

    /* ── Image picker ──
       The tile IS the control: click, drop, or paste. The URL box stays but is
       demoted to a fallback, because a URL is the thing people are least likely
       to already have. */
    .ip { flex-shrink:0; display:flex; flex-direction:column; gap:5px; width:84px; }
    .ip-lg { width:110px; }
    .ip-tile { position:relative; width:84px; height:84px; border-radius:var(--r);
      background:var(--surface-alt) center/cover no-repeat; border:1px dashed var(--border-strong);
      display:flex; align-items:center; justify-content:center; cursor:pointer; color:var(--text-muted);
      transition:border-color .14s ease, background-color .14s ease, transform .14s ease; }
    .ip-lg .ip-tile { width:110px; height:110px; }
    .ip-tile:hover, .ip-tile:focus-visible { border-color:var(--accent); color:var(--accent); outline:none; }
    .ip-over { border-color:var(--accent); border-style:solid; transform:scale(1.03);
      background-color:color-mix(in srgb, var(--accent) 14%, var(--surface-alt)); }
    .ip-has { border-style:solid; border-color:var(--border); }
    .ip-state { display:flex; flex-direction:column; align-items:center; gap:3px; pointer-events:none; }
    .ip-cta { font-size:9.5px; font-weight:700; letter-spacing:.02em; }
    .ip-spin { animation:ipSpin .9s linear infinite; }
    @keyframes ipSpin { to { transform:rotate(360deg); } }
    /* Sits on the image, so it needs its own contrast rather than the theme's. */
    .ip-clear { position:absolute; top:4px; right:4px; width:20px; height:20px; padding:0;
      display:flex; align-items:center; justify-content:center; border-radius:999px;
      border:1px solid rgba(255,255,255,.35); background:rgba(0,0,0,.62); color:#fff;
      cursor:pointer; opacity:0; transition:opacity .14s ease; }
    .ip-tile:hover .ip-clear, .ip-tile:focus-within .ip-clear { opacity:1; }
    .ip-clear:hover { background:var(--danger); border-color:var(--danger); }
    .ip-url { width:100%; padding:4px 6px; border:1px solid var(--border); border-radius:4px;
      background:var(--surface); font-size:10.5px; color:var(--text-secondary); font-family:inherit; }
    .ip-url:focus { outline:none; border-color:var(--accent); }
    .ip-err { font-size:10px; line-height:1.35; color:var(--danger); }
    .ip-hint { font-size:10px; line-height:1.35; color:var(--text-muted); }

    .lb-thumbrow { display:flex; gap:14px; align-items:flex-start; }
    .lb-thumbside { flex:1; min-width:0; display:flex; flex-direction:column; gap:7px; }

    .lb-ic { width:34px; height:34px; padding:0; flex-shrink:0; display:inline-flex; align-items:center;
      justify-content:center; border:none; border-radius:var(--r-sm); background:transparent;
      color:var(--text-muted); cursor:pointer; }
    .lb-ic:hover:not(:disabled) { background:var(--surface-alt); color:var(--text); }
    .lb-ic:disabled { opacity:.3; cursor:default; }
    .lb-ic.on { background:var(--accent-light); color:var(--accent-hover); }
    .lb-del:hover { background:var(--danger-light); color:var(--danger); }

    /* ── Layout tiles ── */
    .lb-tiles { display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:10px; }
    .lb-tiles-2 { grid-template-columns:repeat(2, minmax(0,1fr)); max-width:340px; }
    .lb-tile { display:flex; flex-direction:column; align-items:center; gap:9px; padding:0;
      border:none; background:none; font-family:inherit; cursor:pointer; }
    .lb-tileart { display:flex; align-items:center; justify-content:center; width:100%; aspect-ratio:1;
      border:2px solid var(--border); border-radius:var(--r); background:var(--surface); transition:border-color .13s ease; }
    .lb-tile:hover .lb-tileart { border-color:var(--border-strong); }
    .lb-tile.on .lb-tileart { border-color:var(--text); background:var(--accent-light); box-shadow:0 0 0 3px rgb(var(--accent-rgb) / .18); }
    .lb-tilelabel { font-size:12.5px; font-weight:650; color:var(--text-muted); }
    .lb-tile.on .lb-tilelabel { color:var(--text); font-weight:750; }

    /* Diagram primitives. Grey by default, ink when selected — the same
       selected/unselected language as the tile border. */
    .art { display:flex; gap:4px; width:58%; }
    .art i { background:var(--border-strong); border-radius:2px; display:block; transition:background .13s ease; }
    .lb-tile.on .art i { background:var(--text); }
    .art-classic { flex-direction:column; }
    .art-classic i { height:7px; width:100%; }
    .art-carousel i { height:22px; flex:1; }
    .art-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:3px; }
    .art-grid i { aspect-ratio:1; }
    .art-cards { display:grid; grid-template-columns:repeat(2,1fr); gap:4px; }
    .art-cards i { aspect-ratio:1; }
    .art-collapsed i { height:9px; width:100%; border-radius:3px; }
    .art-dim i { opacity:.55; }

    /* ── Square option buttons (size, columns, alignment) ── */
    .lb-sq { display:flex; gap:8px; }
    .lb-sqbtn { width:46px; height:46px; padding:0; flex-shrink:0; display:inline-flex; align-items:center;
      justify-content:center; border:2px solid var(--border); border-radius:var(--r); background:var(--surface);
      color:var(--text-secondary); font-size:14px; font-weight:750; font-family:inherit; cursor:pointer; }
    .lb-sqbtn:hover { border-color:var(--border-strong); }
    .lb-sqbtn.on { border-color:var(--text); color:var(--text); background:var(--accent-light); box-shadow:0 0 0 3px rgb(var(--accent-rgb) / .18); }


    /* ── Colour rows ── */
    .lb-colorrow { display:flex; align-items:center; gap:13px; padding:11px 13px;
      border:1.5px solid var(--border); border-radius:var(--r); background:var(--surface); }
    .lb-swatchwrap { position:relative; flex-shrink:0; width:40px; height:40px; cursor:pointer; }
    .lb-swatchwrap input { position:absolute; inset:0; opacity:0; width:100%; height:100%; cursor:pointer; padding:0; border:none; }
    .lb-swatch { display:block; width:40px; height:40px; border-radius:10px;
      border:1.5px solid var(--border-strong); box-shadow:inset 0 1px 2px rgb(0 0 0 / .08); }
    /* Unset reads as a checkerboard, not as a colour — so "inheriting" is
       visibly different from "someone chose white". */
    .lb-swatch-theme { background:
      linear-gradient(45deg, var(--border) 25%, transparent 25%, transparent 75%, var(--border) 75%) 0 0/12px 12px,
      linear-gradient(45deg, var(--border) 25%, var(--surface) 25%, var(--surface) 75%, var(--border) 75%) 6px 6px/12px 12px; }
    .lb-colortext { display:flex; flex-direction:column; gap:2px; flex:1; min-width:0; }
    .lb-colorlabel { font-size:14px; font-weight:700; color:var(--text); }
    .lb-colorval { font-size:11.5px; font-family:ui-monospace,monospace; color:var(--text-muted); }
    .lb-reset { width:auto; flex-shrink:0; padding:6px 12px; border:1px solid var(--border-strong);
      border-radius:var(--r-full); background:var(--surface); color:var(--text-secondary);
      font-size:12px; font-weight:700; font-family:inherit; cursor:pointer; }
    .lb-reset:hover { border-color:var(--accent); color:var(--accent); }

    /* ── Contrast verdict ── */
    .lb-contrast { display:flex; align-items:center; gap:13px; padding:12px 14px; border-radius:var(--r);
      border:1.5px solid var(--border); background:var(--surface-alt); }
    .lb-contrast-great, .lb-contrast-ok { border-color:var(--green-mid); background:var(--green-light); }
    .lb-contrast-warn { border-color:var(--accent-mid); background:var(--accent-light); }
    .lb-contrast-bad { border-color:var(--danger-mid); background:var(--danger-light); }
    /* Renders the ACTUAL pair, so the judgement is visible as well as stated. */
    .lb-contrastswatch { flex-shrink:0; display:inline-flex; align-items:center; justify-content:center;
      width:44px; height:44px; border-radius:10px; border:1.5px solid var(--border-strong);
      font-size:16px; font-weight:800; }
    .lb-contrasttext { display:flex; flex-direction:column; gap:2px; min-width:0; }
    .lb-contrastlabel { font-size:14px; font-weight:750; color:var(--text); }
    .lb-shapebtn { padding:8px; }
    .lb-shapeart { display:block; width:26px; height:20px; border:2.5px solid currentColor; }

    /* ── Switch ── */
    .lb-switch { display:flex; gap:11px; align-items:flex-start; cursor:pointer; }
    .lb-track { position:relative; flex-shrink:0; width:38px; height:22px; margin-top:1px;
      border-radius:var(--r-full); background:var(--border-strong); transition:background .16s ease; }
    .lb-track.on { background:var(--text); }
    .lb-track input { position:absolute; opacity:0; width:100%; height:100%; margin:0; cursor:pointer; }
    .lb-knob { position:absolute; top:3px; left:3px; width:16px; height:16px; border-radius:var(--r-full);
      background:#fff; box-shadow:0 1px 3px rgba(0,0,0,.2); transition:transform .16s ease; pointer-events:none; }
    .lb-track.on .lb-knob { transform:translateX(16px); }
    .lb-switchtext { display:flex; flex-direction:column; gap:2px; min-width:0; }
    .lb-switchlabel { font-size:14px; font-weight:750; color:var(--text); }

    @media (max-width:560px) {
      .lb-tiles { grid-template-columns:repeat(2, minmax(0,1fr)); }
      .lb-card { flex-wrap:wrap; }
      .ip { order:-1; }
    }
    @media (prefers-reduced-motion: reduce) { .lb-knob, .lb-track { transition:none; } }
  `}</style>;
}
