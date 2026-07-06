import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  listModules, createModule, updateModule, deleteModule, reorderModules,
  listLessons, createLesson, deleteLesson, reorderLessons,
} from '@/lib/course';
import { useDialog } from '@/components/Dialog';

// Course builder middle step — Modules → Lessons. Self-manages modules + lesson
// rows via course.js; a lesson's content is edited on its own page
// (/build/:skillId/lesson/:lessonId). Reports "has ≥1 lesson" up via onReadyChange
// so the parent's publish gate/checklist stay accurate.
export default function CourseStructure({ skillId, onReadyChange }) {
  const navigate = useNavigate();
  const { confirm, alert } = useDialog();
  const [modules, setModules] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const titleTimers = useRef({});

  const reportReady = useCallback((mods, less) => {
    onReadyChange?.(mods.some(m => less.some(l => l.section_id === m.id)));
  }, [onReadyChange]);

  useEffect(() => {
    let alive = true;
    Promise.all([listModules(skillId), listLessons(skillId)])
      .then(([m, l]) => { if (!alive) return; setModules(m); setLessons(l); setLoading(false); reportReady(m, l); })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [skillId, reportReady]);

  // ── Modules ──
  async function addModule() {
    try {
      const m = await createModule(skillId, modules.length);
      const next = [...modules, m]; setModules(next); reportReady(next, lessons);
    } catch (e) { alert({ title: 'Couldn’t add module', message: e.message, tone: 'danger' }); }
  }
  function patchModuleTitle(id, title) {
    setModules(prev => prev.map(m => m.id === id ? { ...m, title } : m));
    clearTimeout(titleTimers.current[id]);
    titleTimers.current[id] = setTimeout(() => updateModule(id, { title }).catch(e => console.warn(e.message)), 500);
  }
  async function removeModule(id) {
    const ok = await confirm({ title: 'Delete this module?', message: 'This removes the module and every lesson inside it. This cannot be undone.', confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    const nextM = modules.filter(m => m.id !== id);
    const nextL = lessons.filter(l => l.section_id !== id);
    setModules(nextM); setLessons(nextL); reportReady(nextM, nextL);
    try { await deleteModule(id); } catch (e) { console.warn(e.message); }
  }
  async function moveModule(id, dir) {
    const idx = modules.findIndex(m => m.id === id); const j = idx + dir;
    if (j < 0 || j >= modules.length) return;
    const next = [...modules]; [next[idx], next[j]] = [next[j], next[idx]]; setModules(next);
    try { await reorderModules(next.map(m => m.id)); } catch (e) { console.warn(e.message); }
  }

  // ── Lessons ──
  async function addLesson(sectionId) {
    try {
      const pos = lessons.filter(l => l.section_id === sectionId).length;
      const l = await createLesson(skillId, sectionId, pos);
      const next = [...lessons, l]; setLessons(next); reportReady(modules, next);
      navigate(`/build/${skillId}/lesson/${l.id}`); // jump straight into the new lesson
    } catch (e) { alert({ title: 'Couldn’t add lesson', message: e.message, tone: 'danger' }); }
  }
  async function removeLesson(id) {
    const ok = await confirm({ title: 'Delete this lesson?', message: 'This removes the lesson and all its content. This cannot be undone.', confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    const next = lessons.filter(l => l.id !== id); setLessons(next); reportReady(modules, next);
    try { await deleteLesson(id); } catch (e) { console.warn(e.message); }
  }
  async function moveLesson(id, sectionId, dir) {
    const sibs = lessons.filter(l => l.section_id === sectionId).sort((a, b) => a.position - b.position);
    const idx = sibs.findIndex(l => l.id === id); const j = idx + dir;
    if (j < 0 || j >= sibs.length) return;
    [sibs[idx], sibs[j]] = [sibs[j], sibs[idx]];
    const posById = new Map(sibs.map((l, i) => [l.id, i]));
    setLessons(prev => prev.map(l => posById.has(l.id) ? { ...l, position: posById.get(l.id) } : l));
    try { await reorderLessons(sibs.map(l => l.id)); } catch (e) { console.warn(e.message); }
  }

  if (loading) return <p className="cs-muted">Loading…</p>;

  return (
    <div className="cs">
      {modules.length === 0 && (
        <p className="cs-empty">No modules yet. Add your first module to start building the curriculum.</p>
      )}

      {modules.map((mod, mi) => {
        const modLessons = lessons.filter(l => l.section_id === mod.id).sort((a, b) => a.position - b.position);
        return (
          <div key={mod.id} className="cs-section">
            <div className="cs-section-head">
              <span className="cs-section-num">{mi + 1}</span>
              <input className="cs-section-title" value={mod.title ?? ''}
                onChange={e => patchModuleTitle(mod.id, e.target.value)}
                placeholder={`Module ${mi + 1} title`} />
              <div className="cs-section-actions">
                <button className="cs-ic" disabled={mi === 0} onClick={() => moveModule(mod.id, -1)} aria-label="Move module up">↑</button>
                <button className="cs-ic" disabled={mi === modules.length - 1} onClick={() => moveModule(mod.id, 1)} aria-label="Move module down">↓</button>
                <button className="cs-ic cs-del" onClick={() => removeModule(mod.id)} aria-label="Delete module">✕</button>
              </div>
            </div>

            <div className="cs-lessons">
              {modLessons.length === 0 && <p className="cs-lesson-empty">No lessons yet.</p>}
              {modLessons.map((l, li) => (
                <div key={l.id} className="cs-lrow">
                  <button className="cs-lopen" onClick={() => navigate(`/build/${skillId}/lesson/${l.id}`)}>
                    <span className="cs-ldot" />
                    <span className="cs-ltitle">{l.title?.trim() || 'Untitled lesson'}</span>
                    <span className="cs-ledit">Edit →</span>
                  </button>
                  <div className="cs-lactions">
                    <button className="cs-ic" disabled={li === 0} onClick={() => moveLesson(l.id, mod.id, -1)} aria-label="Move lesson up">↑</button>
                    <button className="cs-ic" disabled={li === modLessons.length - 1} onClick={() => moveLesson(l.id, mod.id, 1)} aria-label="Move lesson down">↓</button>
                    <button className="cs-ic cs-del" onClick={() => removeLesson(l.id)} aria-label="Delete lesson">✕</button>
                  </div>
                </div>
              ))}
              <button className="cs-addlesson" onClick={() => addLesson(mod.id)}>+ Add lesson</button>
            </div>
          </div>
        );
      })}

      <button className="cs-addsection" onClick={addModule}>+ Add module</button>

      <style>{`
        .cs { display:flex; flex-direction:column; gap:16px; }
        .cs-muted, .cs-empty { color:var(--text-muted); font-size:14px; }
        .cs-section { border:1px solid var(--border); border-radius:var(--r-lg); background:var(--surface); overflow:hidden; }
        .cs-section-head { display:flex; align-items:center; gap:10px; padding:12px 14px; background:var(--surface-alt); border-bottom:1px solid var(--border); }
        .cs-section-num { flex-shrink:0; width:24px; height:24px; border-radius:var(--r-full); background:var(--accent); color:var(--accent-foreground); font-size:12px; font-weight:800; display:flex; align-items:center; justify-content:center; }
        .cs-section-title { flex:1; min-width:0; font-size:15px; font-weight:700; border:none; background:transparent; color:var(--text); padding:4px 0; }
        .cs-section-title:focus { outline:none; }
        .cs-section-actions, .cs-lactions { display:flex; gap:4px; flex-shrink:0; }
        .cs-ic { width:28px; height:28px; border-radius:var(--r-sm); border:1px solid var(--border-strong); background:var(--surface); color:var(--text-secondary); font-size:13px; cursor:pointer; display:flex; align-items:center; justify-content:center; }
        .cs-ic:hover:not(:disabled) { background:var(--surface-alt); }
        .cs-ic:disabled { opacity:.35; cursor:default; }
        .cs-del:hover { background:#FBE4E0; color:#CE4A3E; border-color:#f0b8b0; }
        .cs-lessons { padding:12px 14px; display:flex; flex-direction:column; gap:8px; }
        .cs-lesson-empty { color:var(--text-muted); font-size:13px; margin:0; }
        .cs-lrow { display:flex; align-items:center; gap:8px; }
        .cs-lopen { flex:1; min-width:0; display:flex; align-items:center; gap:10px; text-align:left; white-space:normal; border:1px solid var(--border); border-radius:var(--r); background:var(--surface); padding:11px 14px; cursor:pointer; }
        .cs-lopen:hover { border-color:var(--accent-mid); background:var(--surface-alt); }
        .cs-ldot { flex-shrink:0; width:8px; height:8px; border-radius:var(--r-full); background:var(--accent-mid); }
        .cs-ltitle { flex:1; min-width:0; font-size:14px; font-weight:600; color:var(--text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .cs-ledit { flex-shrink:0; font-size:12px; font-weight:700; color:var(--accent-hover); }
        .cs-addlesson { align-self:flex-start; border:1.5px dashed var(--border-strong); background:var(--surface); border-radius:var(--r); padding:8px 16px; font-size:13px; font-weight:700; color:var(--text-secondary); cursor:pointer; }
        .cs-addlesson:hover { border-color:var(--accent); color:var(--accent); }
        .cs-addsection { border:1.5px dashed var(--border-strong); background:var(--surface); border-radius:var(--r); padding:12px 16px; font-size:14px; font-weight:700; color:var(--text-secondary); cursor:pointer; }
        .cs-addsection:hover { border-color:var(--accent); color:var(--accent); }
      `}</style>
    </div>
  );
}
