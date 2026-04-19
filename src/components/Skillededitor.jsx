import { useState } from 'react';
import SkillStars from '@/components/Skillstars';
import { setSkillStars, removeSkill, hasSkill, SKILL_CATEGORIES } from '@/lib/stores';

export default function SkillEditor({ skills, onChange, type = 'teach' }) {
    const [inputValue, setInputValue] = useState('');
    const [showModal, setShowModal] = useState(false);

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

    function toggleFromModal(name) {
        if (type === 'teach') {
            onChange(hasSkill(skills, name) ? removeSkill(skills, name) : setSkillStars(skills, name, 3));
        } else {
            const selected = skills.includes(name);
            onChange(selected ? skills.filter(s => s !== name) : [...skills, name]);
        }
    }

    function isSelected(name) {
        return type === 'teach' ? hasSkill(skills, name) : skills.includes(name);
    }

    return (
        <>
            {/* Input row + Browse button */}
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
                        padding: '8px 14px', background: 'var(--primary)', color: '#fff',
                        border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
                        cursor: inputValue.trim() ? 'pointer' : 'default',
                        opacity: inputValue.trim() ? 1 : 0.45, fontFamily: 'inherit',
                        whiteSpace: 'nowrap',
                    }}
                >
                    Add
                </button>
                <button
                    type="button"
                    onClick={() => setShowModal(true)}
                    style={{
                        padding: '8px 14px', background: 'var(--surface)', color: 'var(--text)',
                        border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, fontWeight: 600,
                        cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                        transition: 'border-color 0.15s',
                    }}
                    onMouseOver={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                    onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                    Browse ✦
                </button>
            </div>

            {/* Current skills list */}
            {skills.length > 0 && (
                <div className="sked-preview">
                    <p className="section-label" style={{ marginBottom: 12 }}>
                        {type === 'teach'
                            ? `Rate your level (${skills.length} skill${skills.length !== 1 ? 's' : ''})`
                            : `Want to learn (${skills.length} skill${skills.length !== 1 ? 's' : ''})`}
                    </p>
                    <div className="sked-list">
                        {skills.map((s, idx) => {
                            const name = typeof s === 'string' ? s : s.name;
                            const stars = typeof s === 'string' ? 3 : (s.stars ?? 3);
                            return (
                                <div key={`${name}-${idx}`} className="sked-row">
                                    <span className="skill-tag skill-teach sked-name">{name}</span>
                                    {type === 'teach' && (
                                        <SkillStars stars={stars} readonly={false} size="md" onChange={v => updateStars(name, v)} />
                                    )}
                                    <button className="sked-remove" onClick={() => remove(name)} aria-label={`Remove ${name}`}>✕</button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Browse Skills Modal */}
            {showModal && (
                <div
                    style={{
                        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 1000, padding: '20px',
                    }}
                    onClick={() => setShowModal(false)}
                >
                    <div
                        style={{
                            position: 'relative',
                            background: 'var(--surface)', borderRadius: 20,
                            width: '100%', maxWidth: 560,
                            maxHeight: '80vh', display: 'flex', flexDirection: 'column',
                            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
                            overflow: 'hidden',
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>

                        {/* Modal header */}
                        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                                {type === 'teach' ? 'Skills you can teach' : 'Skills you want to learn'}
                            </h2>
                            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                                {skills.length} selected — tap any skill to toggle
                            </p>
                        </div>

                        {/* Scrollable categories */}
                        <div style={{ overflowY: 'auto', padding: '20px 24px', flex: 1 }}>
                            {SKILL_CATEGORIES.map(cat => (
                                <div key={cat.label} style={{ marginBottom: 24 }}>
                                    <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 10 }}>
                                        {cat.label}
                                    </p>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                        {cat.skills.map(name => {
                                            const selected = isSelected(name);
                                            return (
                                                <button
                                                    key={name}
                                                    onClick={() => toggleFromModal(name)}
                                                    style={{
                                                        padding: '7px 14px', borderRadius: 100,
                                                        border: `1.5px solid ${selected ? 'var(--primary)' : 'var(--border)'}`,
                                                        background: selected ? 'var(--primary)' : 'var(--surface-alt)',
                                                        color: selected ? '#fff' : 'var(--text)',
                                                        fontSize: 13, fontWeight: 500,
                                                        cursor: 'pointer', fontFamily: 'inherit',
                                                        transition: 'all 0.13s',
                                                    }}
                                                >
                                                    {selected && <span style={{ marginRight: 4 }}>✓</span>}{name}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Modal footer */}
                        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
                            <button
                                onClick={() => setShowModal(false)}
                                className="btn btn-primary"
                                style={{ width: '100%' }}
                            >
                                Done — {skills.length} skill{skills.length !== 1 ? 's' : ''} selected
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .sked-preview { margin-top: 16px; padding: 20px; background: var(--surface-alt); border-radius: var(--r); border: 1px solid var(--border); }
                .sked-list { display: flex; flex-direction: column; gap: 10px; }
                .sked-row { display: flex; align-items: center; gap: 12px; padding: 10px 14px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r); transition: border-color 0.15s; }
                .sked-row:hover { border-color: var(--border-strong); }
                .sked-name { flex-shrink: 0; }
                .sked-remove { margin-left: auto; background: none; border: none; font-size: 13px; color: var(--text-muted); cursor: pointer; padding: 2px 4px; border-radius: 4px; line-height: 1; flex-shrink: 0; }
                .sked-remove:hover { color: var(--accent); background: var(--accent-light); }
            `}</style>
        </>
    );
}
