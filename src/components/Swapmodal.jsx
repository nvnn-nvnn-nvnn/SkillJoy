import { useState, useEffect } from 'react';

function initials(name) {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function starString(stars) {
    return '★'.repeat(stars) + '☆'.repeat(5 - stars);
}

export default function SwapModal({ match, onClose, onSubmit, submitting }) {
    const [swapTeach, setSwapTeach] = useState('');
    const [swapLearn, setSwapLearn] = useState('');
    const [swapMessage, setSwapMessage] = useState('');

    useEffect(() => {
        if (!match) return;
        const teach = match.iCanTeach[0]?.name ?? '';
        const learn = match.theyCanTeach[0]?.name ?? '';
        setSwapTeach(teach);
        setSwapLearn(learn);
        setSwapMessage(
            `Hey ${match.full_name}! I'd love to swap skills — I can teach you ${teach} and I'm keen to learn ${learn} from you. Want to set something up?`
        );
    }, [match]);

    if (!match) return null;

    function handleSubmit() {
        onSubmit({ swapTeach, swapLearn, swapMessage });
    }

    return (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()} role="dialog" aria-modal="true">
            <div className="modal">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                    <div className="avatar">{initials(match.full_name)}</div>
                    <div>
                        <h2 style={{ fontSize: 22 }}>Propose a swap</h2>
                        <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>with {match.full_name}</p>
                    </div>
                </div>

                <div className="field" style={{ marginBottom: 16 }}>
                    <label>You'll teach</label>
                    <select value={swapTeach} onChange={e => setSwapTeach(e.target.value)}>
                        {match.iCanTeach.map(s => (
                            <option key={s.name} value={s.name}>{s.name} ({starString(s.stars)})</option>
                        ))}
                    </select>
                </div>

                <div className="field" style={{ marginBottom: 16 }}>
                    <label>You'll learn</label>
                    <select value={swapLearn} onChange={e => setSwapLearn(e.target.value)}>
                        {match.theyCanTeach.map(s => (
                            <option key={s.name} value={s.name}>{s.name} ({starString(s.stars)})</option>
                        ))}
                    </select>
                </div>

                <div className="field" style={{ marginBottom: 24 }}>
                    <label>Message</label>
                    <textarea
                        value={swapMessage}
                        onChange={e => setSwapMessage(e.target.value)}
                        rows={4}
                        style={{ resize: 'vertical' }}
                    />
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                    <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleSubmit} disabled={submitting || !swapTeach || !swapLearn}>
                        {submitting && (
                            <span className="spinner" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white', width: 16, height: 16 }} />
                        )}
                        Send proposal
                    </button>
                </div>
            </div>
        </div>
    );
}