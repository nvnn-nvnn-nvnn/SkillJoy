import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

/**
 * BlockButton — renders a block/unblock control for a given userId.
 * Manages its own blocked state; optionally accepts an initial value.
 *
 * Props:
 *   userId       string   — the user to block/unblock
 *   initialState boolean  — whether already blocked (optional)
 *   onBlock      fn()     — called after a successful block
 *   onUnblock    fn()     — called after a successful unblock
 */
export default function BlockButton({ userId, initialState = false, onBlock, onUnblock }) {
    const [blocked, setBlocked] = useState(initialState);
    const [loading, setLoading] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    useEffect(() => { setBlocked(initialState); }, [initialState]);

    async function handleBlock() {
        setLoading(true);
        try {
            const res = await apiFetch('/api/blocks/block', {
                method: 'POST',
                body: JSON.stringify({ blockedId: userId }),
            });
            if (res.ok) {
                setBlocked(true);
                onBlock?.();
            }
        } finally {
            setLoading(false);
            setShowConfirm(false);
        }
    }

    async function handleUnblock() {
        setLoading(true);
        try {
            const res = await apiFetch('/api/blocks/unblock', {
                method: 'POST',
                body: JSON.stringify({ blockedId: userId }),
            });
            if (res.ok) {
                setBlocked(false);
                onUnblock?.();
            }
        } finally {
            setLoading(false);
        }
    }

    if (blocked) {
        return (
            <button
                onClick={handleUnblock}
                disabled={loading}
                style={{
                    background: '#f3f4f6', border: '1px solid #d1d5db',
                    borderRadius: 8, padding: '7px 14px', fontSize: 13,
                    color: '#6b7280', cursor: loading ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit', transition: 'all 0.15s',
                    opacity: loading ? 0.6 : 1,
                }}
                onMouseOver={e => { if (!loading) e.currentTarget.style.borderColor = '#9ca3af'; }}
                onMouseOut={e => { e.currentTarget.style.borderColor = '#d1d5db'; }}
            >
                {loading ? 'Unblocking…' : '🚫 Unblock user'}
            </button>
        );
    }

    return (
        <>
            <button
                onClick={() => setShowConfirm(true)}
                style={{
                    background: 'none', border: '1px solid var(--border)',
                    borderRadius: 8, padding: '7px 14px', fontSize: 13,
                    color: 'var(--text-muted)', cursor: 'pointer',
                    fontFamily: 'inherit', transition: 'color 0.15s, border-color 0.15s',
                }}
                onMouseOver={e => { e.currentTarget.style.color = '#dc2626'; e.currentTarget.style.borderColor = '#fca5a5'; }}
                onMouseOut={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
            >
                🚫 Block user
            </button>

            {showConfirm && (
                <div className="modal-backdrop" onClick={() => setShowConfirm(false)}>
                    <div className="modal" style={{ maxWidth: 400, textAlign: 'center', padding: '32px 28px 24px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ fontSize: 36, marginBottom: 12 }}>🚫</div>
                        <h2 style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 700 }}>Block this user?</h2>
                        <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                            They won't be able to see your profile or contact you. You can unblock them at any time.
                        </p>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowConfirm(false)}>
                                Cancel
                            </button>
                            <button
                                disabled={loading}
                                onClick={handleBlock}
                                style={{
                                    flex: 1, background: '#dc2626', border: 'none', color: '#fff',
                                    padding: '10px 18px', borderRadius: 8, fontSize: 14,
                                    fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
                                    opacity: loading ? 0.6 : 1,
                                }}
                            >
                                {loading ? 'Blocking…' : 'Block'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
