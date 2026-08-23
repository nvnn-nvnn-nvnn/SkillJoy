import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useUser } from '@/lib/stores';
import { getLesson, updateLesson } from '@/lib/course';
import { listLessonBlocks, addBlock, updateBlock, deleteBlock, reorderBlocks } from '@/lib/skills';
import { BLOCK_TYPES } from '@/lib/blockTypes';
import BlockEditor from '@/components/BlockEditor';
import BackLink from '@/components/BackLink';
import SaveStatus from '@/components/SaveStatus';
import { useSaveState } from '@/lib/useSaveState';
import { useDialog } from '@/components/Dialog';
import { useAuthGate } from '@/lib/useAuthGate';

// A lesson's own page: title + description + its content blocks. Reached from the
// course builder's module view (/build/:skillId → click a lesson). Same debounced
// save pattern as SkillBuilder. Coaching isn't a lesson content type.
const LESSON_TYPES = BLOCK_TYPES.filter(t => t.type !== 'coaching');

export default function LessonEditor() {
  const { skillId, lessonId } = useParams();
  const user = useUser();
  const { alert } = useDialog();
  const [lesson, setLesson] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [loadErr, setLoadErr] = useState('');
  const save = useSaveState();
  const [menuOpen, setMenuOpen] = useState(false);
  const lessonTimer = useRef(null);
  const blockTimers = useRef({});
  const pendingLesson = useRef({});
  const pendingBlock = useRef({});

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [l, b] = await Promise.all([getLesson(lessonId), listLessonBlocks(lessonId)]);
        if (!alive) return;
        setLesson(l); setBlocks(b);
      } catch (e) { if (alive) setLoadErr(e.message); }
    })();
    return () => { alive = false; };
  }, [lessonId]);

  // Same restore-on-failure contract as SkillBuilder: a rejected save puts its
  // patch back in the queue instead of dropping it, and the indicator reports
  // the failure rather than continuing to claim "Saved ✓".
  const flushLesson = useCallback(async () => {
    const toSave = pendingLesson.current;
    if (!Object.keys(toSave).length) return;
    pendingLesson.current = {};
    save.markSaving();
    try {
      await updateLesson(lessonId, toSave);
      if (Object.keys(pendingLesson.current).length) save.markDirty();
      else save.markSaved();
    } catch (e) {
      pendingLesson.current = { ...toSave, ...pendingLesson.current };
      save.markError(e.message);
    }
  }, [lessonId, save]);

  const patchLesson = useCallback((patch) => {
    setLesson(prev => ({ ...prev, ...patch }));
    pendingLesson.current = { ...pendingLesson.current, ...patch };
    save.markDirty();
    clearTimeout(lessonTimer.current);
    lessonTimer.current = setTimeout(flushLesson, 600);
  }, [flushLesson, save]);

  const flushBlock = useCallback(async (blockId) => {
    const toSave = pendingBlock.current[blockId];
    if (!toSave || !Object.keys(toSave).length) return;
    delete pendingBlock.current[blockId];
    save.markSaving();
    try {
      await updateBlock(blockId, toSave);
      if (Object.keys(pendingBlock.current).length) save.markDirty();
      else save.markSaved();
    } catch (e) {
      pendingBlock.current[blockId] = { ...toSave, ...(pendingBlock.current[blockId] || {}) };
      save.markError(e.message);
    }
  }, [save]);

  const patchBlock = useCallback((blockId, patch) => {
    setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, ...patch } : b));
    pendingBlock.current[blockId] = { ...(pendingBlock.current[blockId] || {}), ...patch };
    save.markDirty();
    clearTimeout(blockTimers.current[blockId]);
    blockTimers.current[blockId] = setTimeout(() => flushBlock(blockId), 600);
  }, [flushBlock, save]);

  const retrySave = useCallback(() => {
    flushLesson();
    Object.keys(pendingBlock.current).forEach(id => flushBlock(id));
  }, [flushLesson, flushBlock]);

  // Flush pending saves on unmount so navigating away never drops the last edit.
  // Cannot surface an error (the component is gone) — logs loudly instead.
  useEffect(() => () => {
    clearTimeout(lessonTimer.current);
    Object.values(blockTimers.current).forEach(clearTimeout);
    if (Object.keys(pendingLesson.current).length) {
      updateLesson(lessonId, pendingLesson.current)
        .catch(e => console.error('[lesson-editor] lost unsaved lesson edit on unmount:', e.message));
    }
    Object.entries(pendingBlock.current).forEach(([id, patch]) =>
      updateBlock(id, patch)
        .catch(e => console.error(`[lesson-editor] lost unsaved block ${id} on unmount:`, e.message)));
  }, [lessonId]);

  const unsaved = save.status === 'dirty' || save.status === 'saving' || save.status === 'error';
  useEffect(() => {
    if (!unsaved) return;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [unsaved]);

  async function addContent(type) {
    setMenuOpen(false);
    try {
      const created = await addBlock(skillId, { type, lesson_id: lessonId, position: blocks.length, title: '' });
      setBlocks(prev => [...prev, created]);
    } catch (e) { alert({ title: 'Couldn’t add content', message: e.message, tone: 'danger' }); }
  }
  // Optimistic but reversible — see CourseStructure for the reasoning.
  async function removeBlock(id) {
    const prev = blocks;
    setBlocks(cur => cur.filter(b => b.id !== id));
    try { await deleteBlock(id); save.markSaved(); }
    catch (e) { setBlocks(prev); save.markError(`Couldn’t delete that block — ${e.message}`); }
  }
  async function moveBlock(idx, dir) {
    const j = idx + dir;
    if (j < 0 || j >= blocks.length) return;
    const prev = blocks;
    const next = [...blocks];
    [next[idx], next[j]] = [next[j], next[idx]];
    setBlocks(next);
    try { await reorderBlocks(next.map(b => b.id)); save.markSaved(); }
    catch (e) { setBlocks(prev); save.markError(`Couldn’t reorder — ${e.message}`); }
  }

  const gate = useAuthGate();
  if (gate) return gate;
  if (loadErr) return <div className="le-wrap"><p className="le-muted">Couldn’t load this lesson: {loadErr}</p><BackLink to={`/build/${skillId}`}>Back to course</BackLink><LEStyles /></div>;
  if (!lesson) return <div className="le-wrap"><p className="le-muted">Loading…</p><LEStyles /></div>;

  return (
    <div className="le-wrap">
      <title>Edit lesson — SkillJoy</title>
      <div className="le-top">
        <BackLink to={`/build/${skillId}`} className="bl-inline">Back to course</BackLink>
        <span className="le-saved"><SaveStatus status={save.status} error={save.error} onRetry={retrySave} /></span>
      </div>

      <input className="le-title" value={lesson.title ?? ''}
        onChange={e => patchLesson({ title: e.target.value })} placeholder="Lesson title" />
      <textarea className="le-desc" rows={3} value={lesson.description ?? ''}
        onChange={e => patchLesson({ description: e.target.value })}
        placeholder="Lesson description — what this lesson covers (optional)." />

      <div className="le-contenthead">
        <h2 className="le-h2">Lesson content</h2>
        <span className="le-muted">{blocks.length} item{blocks.length === 1 ? '' : 's'}</span>
      </div>

      {blocks.map((b, i) => (
        <BlockEditor key={b.id} block={b} index={i} total={blocks.length} creatorId={user.id} skillId={skillId}
          onPatch={patch => patchBlock(b.id, patch)} onRemove={() => removeBlock(b.id)} onMove={dir => moveBlock(i, dir)} />
      ))}

      <div className="le-add">
        {!menuOpen ? (
          <button className="le-addtrigger" onClick={() => setMenuOpen(true)}>+ Add content</button>
        ) : (
          <div className="le-picker">
            <div className="le-picker-head"><span>Add content</span><button className="le-picker-cancel" onClick={() => setMenuOpen(false)}>Cancel</button></div>
            <div className="le-picker-grid">
              {LESSON_TYPES.map(t => (
                <button key={t.type} className="le-tile" onClick={() => addContent(t.type)}>
                  <span className="le-tile-icon">{t.icon}</span>
                  <span className="le-tile-label">{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <LEStyles />
    </div>
  );
}

function LEStyles() {
  return <style>{`
    .le-wrap { max-width:680px; margin:0 auto; padding:28px 20px 96px; }
    .le-muted { color:var(--text-muted); font-size:14px; }
    .le-top { display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; }
    .le-saved { font-size:13px; color:var(--green); font-weight:600; }
    .le-title { width:100%; font-size:26px; font-weight:800; font-family:var(--font-display); border:none; padding:4px 0; background:transparent; }
    .le-title:focus { outline:none; }
    .le-desc { width:100%; font-size:15px; color:var(--text-secondary); border:none; padding:6px 0 16px; background:transparent; resize:vertical; font-family:inherit; line-height:1.5; }
    .le-desc:focus { outline:none; }
    .le-contenthead { display:flex; justify-content:space-between; align-items:baseline; margin:12px 0 14px; padding-top:16px; border-top:1px solid var(--border); }
    .le-h2 { font-size:18px; font-weight:700; }
    .le-add { margin-top:6px; }
    .le-addtrigger { width:100%; border:1.5px dashed var(--border-strong); border-radius:var(--r); background:var(--surface); padding:11px 16px; font-size:14px; font-weight:700; color:var(--text-secondary); cursor:pointer; }
    .le-addtrigger:hover { border-color:var(--accent); color:var(--accent); }
    .le-picker { border:1px solid var(--border); border-radius:var(--r-lg); background:var(--surface-alt); padding:14px; }
    .le-picker-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:.04em; color:var(--text-muted); }
    .le-picker-cancel { border:none; background:none; color:var(--text-muted); font-size:13px; font-weight:600; cursor:pointer; }
    .le-picker-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(130px,1fr)); gap:8px; }
    .le-tile { display:flex; align-items:center; gap:8px; white-space:normal; border:1.5px solid var(--border); border-radius:var(--r-sm); background:var(--surface); padding:10px 12px; font-size:13px; font-weight:600; color:var(--text); cursor:pointer; }
    .le-tile:hover { border-color:var(--accent-mid); }
    .le-tile-icon { font-size:17px; }
  `}</style>;
}
