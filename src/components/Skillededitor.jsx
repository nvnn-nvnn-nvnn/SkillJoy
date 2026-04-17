import { useState } from 'react';
import SkillStars from '@/components/Skillstars';
import { setSkillStars, removeSkill } from '@/lib/stores';

export default function SkillEditor({ skills, onChange, type = 'teach' }) {
    const [inputValue, setInputValue] = useState('');

    function updateStars(name, stars) {
        onChange(setSkillStars(skills, name, stars));
    }

    function remove(name) {
        onChange(removeSkill(skills, name));
    }

    function addSkill() {
        const name = inputValue.trim();
        if (!name) return;
        const exists = skills.some(s =>
            (typeof s === 'string' ? s : s.name).toLowerCase() === name.toLowerCase()
        );
        if (exists) { setInputValue(''); return; }
        onChange(type === 'teach' ? [...skills, { name, stars: 3 }] : [...skills, name]);
        setInputValue('');
    }

    return (
        <>
            <div style={{ display: 'flex', gap: 8 }}>
                <input
                    type="text"
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
                    placeholder={type === 'teach' ? 'Add a skill you can teach…' : 'Add a skill you want to learn…'}
                    style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', background: 'var(--surface)' }}
                />
                <button
                    type="button"
                    onClick={addSkill}
                    disabled={!inputValue.trim()}
                    style={{
                        padding: '8px 16px', background: 'var(--primary)', color: '#fff',
                        border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
                        cursor: inputValue.trim() ? 'pointer' : 'default',
                        opacity: inputValue.trim() ? 1 : 0.45, fontFamily: 'inherit',
                    }}
                >
                    Add
                </button>
            </div>

            {skills.length > 0 && (
                <div className="selected-preview">
                    <p className="section-label" style={{ marginBottom: 12 }}>
                        {type === 'teach'
                            ? `Rate your level (${skills.length} skill${skills.length !== 1 ? 's' : ''})`
                            : `Want to learn (${skills.length} skill${skills.length !== 1 ? 's' : ''})`}
                    </p>
                    <div className="rated-skill-editor">
                        {skills.map((s, idx) => {
                            const name = typeof s === 'string' ? s : s.name;
                            const stars = typeof s === 'string' ? 3 : (s.stars ?? 3);
                            return (
                                <div key={`${name}-${idx}`} className="rated-row">
                                    <span className="skill-tag skill-teach rated-name">{name}</span>
                                    {type === 'teach' && (
                                        <SkillStars stars={stars} readonly={false} size="md" onChange={v => updateStars(name, v)} />
                                    )}
                                    <button className="remove-btn" onClick={() => remove(name)} aria-label={`Remove ${name}`}>✕</button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <style>{`
        .selected-preview { margin-top: 16px; padding: 20px; background: var(--surface-alt); border-radius: var(--r); border: 1px solid var(--border); }
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
