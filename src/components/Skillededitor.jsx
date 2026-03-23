import SkillStars from '@/components/Skillstars';

// ── Helpers (mirror Svelte store utils) ───────────────────────────────────────
export function hasSkill(list, name) {
    return list.some(s => (typeof s === 'string' ? s : s.name) === name);
}
export function setSkillStars(list, name, stars) {
    const exists = hasSkill(list, name);
    if (exists) return list.map(s => (typeof s === 'string' ? s : s.name) === name ? { name, stars } : s);
    return [...list, { name, stars }];
}
export function removeSkill(list, name) {
    return list.filter(s => (typeof s === 'string' ? s : s.name) !== name);
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function SkillEditor({ skills, onChange }) {
    function updateStars(name, stars) {
        onChange(setSkillStars(skills, name, stars));
    }
    function remove(name) {
        onChange(removeSkill(skills, name));
    }

    if (!skills.length) return null;

    return (
        <>
            <div className="selected-preview">
                <p className="section-label" style={{ marginBottom: 12 }}>
                    Rate your level ({skills.length} selected)
                </p>
                <div className="rated-skill-editor">
                    {skills.map((s) => {
                        const name = typeof s === 'string' ? s : s.name;
                        const stars = typeof s === 'string' ? 3 : (s.stars ?? 3);
                        return (
                            <div key={name} className="rated-row">
                                <span className="skill-tag skill-teach rated-name">{name}</span>
                                <SkillStars stars={stars} readonly={false} size="md" onChange={v => updateStars(name, v)} />
                                <button className="remove-btn" onClick={() => remove(name)} aria-label={`Remove ${name}`}>✕</button>
                            </div>
                        );
                    })}
                </div>
            </div>

            <style>{`
        .selected-preview { margin-top: 24px; padding: 20px; background: var(--surface-alt); border-radius: var(--r); border: 1px solid var(--border); }
        .rated-skill-editor { display: flex; flex-direction: column; gap: 10px; }
        .rated-row { display: flex; align-items: center; gap: 12px; padding: 10px 14px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r); transition: border-color 0.15s; }
        .rated-row:hover { border-color: var(--border-strong); }
        .rated-name { flex-shrink: 0; }
        .remove-btn { margin-left: auto; background: none; border: none; font-size: 13px; color: var(--text-muted); cursor: pointer; padding: 2px 4px; border-radius: 4px; line-height: 1; flex-shrink: 0; }
        .remove-btn:hover { color: var(--accent); background: var(--accent-light); }
      `}</style>
        </>
    );
}
