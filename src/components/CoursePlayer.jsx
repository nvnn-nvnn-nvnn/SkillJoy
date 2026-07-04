import { useState, useEffect } from 'react';
import { listSections, listMyProgress, markLesson, unmarkLesson } from '@/lib/course';
import BlockRenderer from '@/components/BlockRenderer';

// Buyer-side course view: sections → lessons + a progress bar. Lessons are the
// skill's content_blocks grouped by section_id; each renders with BlockRenderer.
export default function CoursePlayer({ skill, user }) {
  const [sections, setSections] = useState(null); // null = loading
  const [done, setDone] = useState(new Set());

  useEffect(() => {
    Promise.all([listSections(skill.id), listMyProgress(skill.id)])
      .then(([secs, prog]) => { setSections(secs); setDone(prog); })
      .catch(() => { setSections([]); setDone(new Set()); });
  }, [skill.id]);

  if (sections === null) return <p className="cp-muted">Loading course…</p>;

  const lessonsOf = (secId) => (skill.blocks || [])
    .filter(b => b.section_id === secId).sort((a, b) => a.position - b.position);
  const allLessons = (skill.blocks || []).filter(b => b.section_id);
  const total = allLessons.length;
  const completed = allLessons.filter(b => done.has(b.id)).length;
  const pct = total ? Math.round((completed / total) * 100) : 0;

  async function toggle(blockId) {
    const wasDone = done.has(blockId);
    setDone(prev => { const n = new Set(prev); wasDone ? n.delete(blockId) : n.add(blockId); return n; });
    try {
      if (wasDone) await unmarkLesson(user.id, blockId);
      else await markLesson(user.id, skill.id, blockId);
    } catch {
      setDone(prev => { const n = new Set(prev); wasDone ? n.add(blockId) : n.delete(blockId); return n; }); // revert
    }
  }

  return (
    <div className="cp">
      <div className="cp-progress">
        <div className="cp-bar"><div className="cp-fill" style={{ width: `${pct}%` }} /></div>
        <span className="cp-pct">{completed}/{total} lessons · {pct}%{pct === 100 && total > 0 ? ' 🎉' : ''}</span>
      </div>

      {sections.length === 0 && <p className="cp-muted">This course has no sections yet.</p>}

      {sections.map((sec, si) => {
        const lessons = lessonsOf(sec.id);
        return (
          <section key={sec.id} className="cp-section">
            <h3 className="cp-section-title">
              <span className="cp-section-num">{si + 1}</span>
              {sec.title || `Section ${si + 1}`}
            </h3>
            {lessons.length === 0 && <p className="cp-muted">No lessons yet.</p>}
            {lessons.map(b => (
              <div key={b.id} className={`cp-lesson${done.has(b.id) ? ' done' : ''}`}>
                <BlockRenderer block={b} skillId={skill.id} creatorId={skill.creator_id} buyerId={user.id} />
                <button className="cp-complete" onClick={() => toggle(b.id)}>
                  {done.has(b.id) ? '✓ Completed' : 'Mark complete'}
                </button>
              </div>
            ))}
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
        .cp-section { margin-bottom:26px; }
        .cp-section-title { display:flex; align-items:center; gap:10px; font-size:17px; font-weight:800; margin-bottom:12px; }
        .cp-section-num { flex-shrink:0; width:26px; height:26px; border-radius:var(--r-full); background:var(--accent-light); color:var(--accent-hover); font-size:13px; font-weight:800; display:flex; align-items:center; justify-content:center; }
        .cp-lesson { position:relative; }
        .cp-lesson.done { opacity:.72; }
        .cp-complete { margin:-4px 0 14px; border:1px solid var(--border-strong); background:var(--surface); border-radius:var(--r-full); padding:6px 14px; font-size:13px; font-weight:700; color:var(--text-secondary); cursor:pointer; }
        .cp-complete:hover { border-color:var(--accent); color:var(--accent); }
        .cp-lesson.done .cp-complete { border-color:var(--accent-mid); background:var(--accent-light); color:var(--accent-hover); }
      `}</style>
    </div>
  );
}
