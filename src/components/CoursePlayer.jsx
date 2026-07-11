import { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { listModules, listLessons, listMyProgress, markLesson, unmarkLesson } from '@/lib/course';
import BlockRenderer from '@/components/BlockRenderer';
import Markdown from '@/components/Markdown';

// Buyer-side course view: Modules → Lessons (title + description) → content, with
// a per-lesson progress bar. Lessons are course_lessons rows; a lesson's content
// is the skill's content_blocks with that lesson_id.
export default function CoursePlayer({ skill, user }) {
  const [modules, setModules] = useState(null); // null = loading
  const [lessons, setLessons] = useState([]);
  const [done, setDone] = useState(new Set());
  const [open, setOpen] = useState(new Set()); // collapsible modules — first open by default

  useEffect(() => {
    Promise.all([listModules(skill.id), listLessons(skill.id), listMyProgress(skill.id)])
      .then(([mods, less, prog]) => {
        setModules(mods); setLessons(less); setDone(prog);
        setOpen(new Set(mods.length ? [mods[0].id] : []));
      })
      .catch(() => { setModules([]); setLessons([]); setDone(new Set()); });
  }, [skill.id]);

  function toggleModule(modId) {
    setOpen(prev => { const n = new Set(prev); n.has(modId) ? n.delete(modId) : n.add(modId); return n; });
  }

  if (modules === null) return <p className="cp-muted">Loading course…</p>;

  const lessonsOf = (modId) => lessons.filter(l => l.section_id === modId).sort((a, b) => a.position - b.position);
  const blocksOf = (lessonId) => (skill.blocks || []).filter(b => b.lesson_id === lessonId).sort((a, b) => a.position - b.position);
  const total = lessons.length;
  const completed = lessons.filter(l => done.has(l.id)).length;
  const pct = total ? Math.round((completed / total) * 100) : 0;

  async function toggle(lessonId) {
    const wasDone = done.has(lessonId);
    setDone(prev => { const n = new Set(prev); wasDone ? n.delete(lessonId) : n.add(lessonId); return n; });
    try {
      if (wasDone) await unmarkLesson(user.id, lessonId);
      else await markLesson(user.id, skill.id, lessonId);
    } catch {
      setDone(prev => { const n = new Set(prev); wasDone ? n.add(lessonId) : n.delete(lessonId); return n; }); // revert
    }
  }

  return (
    <div className="cp">
      <div className="cp-progress">
        <div className="cp-bar"><div className="cp-fill" style={{ width: `${pct}%` }} /></div>
        <span className="cp-pct">{completed}/{total} lessons · {pct}%{pct === 100 && total > 0 ? ' 🎉' : ''}</span>
      </div>

      {modules.length === 0 && <p className="cp-muted">This course has no modules yet.</p>}

      {modules.map((mod, mi) => {
        const isOpen = open.has(mod.id);
        const modLessons = lessonsOf(mod.id);
        return (
        <section key={mod.id} className="cp-module">
          <button type="button" className="cp-module-title" onClick={() => toggleModule(mod.id)} aria-expanded={isOpen}>
            <span className="cp-module-num">{mi + 1}</span>
            <span className="cp-module-name">{mod.title || `Module ${mi + 1}`}</span>
            <span className="cp-module-count">{modLessons.filter(l => done.has(l.id)).length}/{modLessons.length}</span>
            <ChevronDown size={17} className={`cp-caret${isOpen ? ' open' : ''}`} />
          </button>
          {isOpen && (
            <>
              {modLessons.length === 0 && <p className="cp-muted">No lessons yet.</p>}
              {modLessons.map(lesson => (
                <div key={lesson.id} className={`cp-lesson${done.has(lesson.id) ? ' done' : ''}`}>
                  <div className="cp-lesson-head">
                    <div>
                      <p className="cp-lesson-title">{lesson.title?.trim() || 'Untitled lesson'}</p>
                      {lesson.description && <Markdown className="cp-lesson-desc">{lesson.description}</Markdown>}
                    </div>
                    <button className="cp-complete" onClick={() => toggle(lesson.id)}>
                      {done.has(lesson.id) ? '✓ Completed' : 'Mark complete'}
                    </button>
                  </div>
                  {blocksOf(lesson.id).map(b => (
                    <BlockRenderer key={b.id} block={b} skillId={skill.id} creatorId={skill.creator_id} buyerId={user.id} />
                  ))}
                </div>
              ))}
            </>
          )}
        </section>
        );
      })}

      <style>{`
        .cp { margin-top:4px; }
        .cp-muted { color:var(--text-muted); font-size:14px; }
        .cp-progress { display:flex; align-items:center; gap:12px; margin-bottom:22px; }
        .cp-bar { flex:1; height:9px; border-radius:var(--r-full); background:var(--surface-alt); overflow:hidden; }
        .cp-fill { height:100%; background:var(--accent); border-radius:var(--r-full); transition:width .25s ease; }
        .cp-pct { flex-shrink:0; font-size:13px; font-weight:700; color:var(--text-secondary); }
        .cp-module { margin-bottom:20px; }
        .cp-module-title { display:flex; align-items:center; gap:10px; width:100%; min-width:0; text-align:left;
          font-size:17px; font-weight:800; margin-bottom:14px; padding:10px 12px; cursor:pointer;
          border:1px solid var(--border); border-radius:var(--r-lg); background:var(--surface); color:var(--text); }
        .cp-module-title:hover { border-color:var(--accent-mid); }
        .cp-module-name { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .cp-module-count { flex-shrink:0; font-size:12.5px; font-weight:700; color:var(--text-muted); }
        .cp-caret { flex-shrink:0; color:var(--text-muted); transition:transform .18s ease; }
        .cp-caret.open { transform:rotate(180deg); }
        .cp-module-num { flex-shrink:0; width:26px; height:26px; border-radius:var(--r-full); background:var(--accent-light); color:var(--accent-hover); font-size:13px; font-weight:800; display:flex; align-items:center; justify-content:center; }
        .cp-lesson { border:1px solid var(--border); border-radius:var(--r-lg); background:var(--surface); padding:16px; margin-bottom:14px; }
        .cp-lesson.done { border-color:var(--accent-mid); }
        .cp-lesson-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:12px; }
        .cp-lesson-title { font-weight:700; font-size:15px; color:var(--text); }
        .cp-lesson-desc { font-size:13px; color:var(--text-secondary); margin-top:4px; line-height:1.5; }
        .cp-complete { flex-shrink:0; border:1px solid var(--border-strong); background:var(--surface); border-radius:var(--r-full); padding:6px 14px; font-size:13px; font-weight:700; color:var(--text-secondary); cursor:pointer; }
        .cp-complete:hover { border-color:var(--accent); color:var(--accent); }
        .cp-lesson.done .cp-complete { border-color:var(--accent-mid); background:var(--accent-light); color:var(--accent-hover); }
      `}</style>
    </div>
  );
}
