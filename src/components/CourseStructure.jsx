import { useState } from 'react';
import { BLOCK_TYPES } from '@/lib/blockTypes';
import BlockEditor from '@/components/BlockEditor';

// Course builder middle step — Sections → Lessons. Presentational: the parent
// (SkillEditor) owns sections + blocks + all handlers so state stays consistent.
// A "lesson" is a content_block with section_id set; we reuse BlockEditor for it.
// Coaching isn't offered as a lesson type (it's its own product).
const LESSON_TYPES = BLOCK_TYPES.filter(t => t.type !== 'coaching');

export default function CourseStructure({
  skillId, creatorId, sections, blocks,
  onAddSection, onPatchSection, onRemoveSection, onMoveSection,
  onAddLesson, patchBlock, onRemoveLesson, onMoveLesson,
}) {
  const [pickFor, setPickFor] = useState(null); // sectionId whose lesson-picker is open

  return (
    <div className="cs">
      {sections.length === 0 && (
        <p className="cs-empty">No sections yet. Add your first section to start building the curriculum.</p>
      )}

      {sections.map((sec, si) => {
        const lessons = blocks.filter(b => b.section_id === sec.id).sort((a, b) => a.position - b.position);
        return (
          <div key={sec.id} className="cs-section">
            <div className="cs-section-head">
              <span className="cs-section-num">{si + 1}</span>
              <input className="cs-section-title" value={sec.title ?? ''}
                onChange={e => onPatchSection(sec.id, { title: e.target.value })}
                placeholder={`Section ${si + 1} title`} />
              <div className="cs-section-actions">
                <button className="cs-ic" disabled={si === 0} onClick={() => onMoveSection(sec.id, -1)} aria-label="Move section up">↑</button>
                <button className="cs-ic" disabled={si === sections.length - 1} onClick={() => onMoveSection(sec.id, 1)} aria-label="Move section down">↓</button>
                <button className="cs-ic cs-del" onClick={() => onRemoveSection(sec.id)} aria-label="Delete section">✕</button>
              </div>
            </div>

            <div className="cs-lessons">
              {lessons.length === 0 && <p className="cs-lesson-empty">No lessons yet.</p>}
              {lessons.map((b, li) => (
                <BlockEditor key={b.id} block={b} index={li} total={lessons.length}
                  creatorId={creatorId} skillId={skillId}
                  onPatch={(patch) => patchBlock(b.id, patch)}
                  onRemove={() => onRemoveLesson(b.id)}
                  onMove={(dir) => onMoveLesson(b.id, dir)} />
              ))}

              {pickFor === sec.id ? (
                <div className="cs-picker">
                  <div className="cs-picker-head">
                    <span>Add a lesson</span>
                    <button className="cs-picker-cancel" onClick={() => setPickFor(null)}>Cancel</button>
                  </div>
                  <div className="cs-picker-grid">
                    {LESSON_TYPES.map(t => (
                      <button key={t.type} className="cs-picker-tile"
                        onClick={() => { onAddLesson(sec.id, t.type); setPickFor(null); }}>
                        <span className="cs-picker-icon">{t.icon}</span>
                        <span className="cs-picker-label">{t.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <button className="cs-addlesson" onClick={() => setPickFor(sec.id)}>+ Add lesson</button>
              )}
            </div>
          </div>
        );
      })}

      <button className="cs-addsection" onClick={onAddSection}>+ Add section</button>

      <style>{`
        .cs { display:flex; flex-direction:column; gap:16px; }
        .cs-empty { color:var(--text-muted); font-size:14px; }
        .cs-section { border:1px solid var(--border); border-radius:var(--r-lg); background:var(--surface); overflow:hidden; }
        .cs-section-head { display:flex; align-items:center; gap:10px; padding:12px 14px; background:var(--surface-alt); border-bottom:1px solid var(--border); }
        .cs-section-num { flex-shrink:0; width:24px; height:24px; border-radius:var(--r-full); background:var(--accent); color:var(--accent-foreground); font-size:12px; font-weight:800; display:flex; align-items:center; justify-content:center; }
        .cs-section-title { flex:1; min-width:0; font-size:15px; font-weight:700; border:none; background:transparent; color:var(--text); padding:4px 0; }
        .cs-section-title:focus { outline:none; }
        .cs-section-actions { display:flex; gap:4px; flex-shrink:0; }
        .cs-ic { width:28px; height:28px; border-radius:var(--r-sm); border:1px solid var(--border-strong); background:var(--surface); color:var(--text-secondary); font-size:13px; cursor:pointer; display:flex; align-items:center; justify-content:center; }
        .cs-ic:hover:not(:disabled) { background:var(--surface-alt); }
        .cs-ic:disabled { opacity:.35; cursor:default; }
        .cs-del:hover { background:#FBE4E0; color:#CE4A3E; border-color:#f0b8b0; }
        .cs-lessons { padding:14px; display:flex; flex-direction:column; gap:10px; }
        .cs-lesson-empty { color:var(--text-muted); font-size:13px; margin:0; }
        .cs-addlesson { align-self:flex-start; border:1.5px dashed var(--border-strong); background:var(--surface); border-radius:var(--r); padding:8px 16px; font-size:13px; font-weight:700; color:var(--text-secondary); cursor:pointer; }
        .cs-addlesson:hover { border-color:var(--accent); color:var(--accent); }
        .cs-addsection { border:1.5px dashed var(--border-strong); background:var(--surface); border-radius:var(--r); padding:12px 16px; font-size:14px; font-weight:700; color:var(--text-secondary); cursor:pointer; }
        .cs-addsection:hover { border-color:var(--accent); color:var(--accent); }
        .cs-picker { border:1px solid var(--border); border-radius:var(--r); background:var(--surface-alt); padding:12px; }
        .cs-picker-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:.04em; color:var(--text-muted); }
        .cs-picker-cancel { border:none; background:none; color:var(--text-muted); font-size:13px; font-weight:600; cursor:pointer; }
        .cs-picker-cancel:hover { color:var(--accent); }
        .cs-picker-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(120px,1fr)); gap:8px; }
        .cs-picker-tile { display:flex; align-items:center; gap:8px; text-align:left; white-space:normal; border:1.5px solid var(--border); border-radius:var(--r-sm); background:var(--surface); padding:10px 12px; font-size:13px; font-weight:600; color:var(--text); cursor:pointer; }
        .cs-picker-tile:hover { border-color:var(--accent-mid); }
        .cs-picker-icon { font-size:17px; }
      `}</style>
    </div>
  );
}
