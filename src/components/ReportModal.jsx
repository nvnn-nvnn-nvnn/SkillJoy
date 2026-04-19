import { useState } from 'react';
import { apiFetch } from '@/lib/api';

const GIG_REASONS  = ['Spam or misleading', 'Inappropriate content', 'Scam or fraud', 'Copyright violation', 'Other'];
const USER_REASONS = ['Harassment', 'Spam or misleading', 'Fake profile', 'Scam or fraud', 'Inappropriate behavior', 'Other'];

export default function ReportModal({ isOpen, onClose, reportedType, reportedId, reportedName }) {
    const [reason, setReason] = useState('');
    const [description, setDescription] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const reasons = reportedType === 'gig' ? GIG_REASONS : USER_REASONS;

    function handleClose() {
        setReason('');
        setDescription('');
        setError('');
        setDone(false);
        onClose();
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (!reason) { setError('Please select a reason.'); return; }
        setSubmitting(true);
        setError('');
        try {
            const res = await apiFetch('/api/reports', {
                method: 'POST',
                body: JSON.stringify({ reportedType, reportedId, reason, description }),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error || 'Failed to submit report.'); return; }
            setDone(true);
        } catch (err) {
            setError('Network error. Please try again.');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="modal-backdrop" onClick={handleClose}>
            <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
                <button className="modal-close" onClick={handleClose}>✕</button>

                {done ? (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                        <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700 }}>Report submitted</h2>
                        <p style={{ margin: '0 0 20px', fontSize: 14, color: 'var(--text-muted)' }}>
                            Our team will review your report. Thanks for helping keep SkillJoy safe.
                        </p>
                        <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleClose}>Done</button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700 }}>
                            Report {reportedType === 'gig' ? 'gig' : 'user'}
                        </h2>
                        <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text-muted)' }}>
                            Reporting: <strong style={{ color: 'var(--text-primary)' }}>{reportedName}</strong>
                        </p>

                        <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
                            Reason <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <select
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            style={{
                                width: '100%', padding: '9px 12px', borderRadius: 8,
                                border: '1px solid var(--border)', fontSize: 14,
                                fontFamily: 'inherit', background: 'var(--surface)',
                                color: 'var(--text-primary)', marginBottom: 14,
                                boxSizing: 'border-box',
                            }}
                        >
                            <option value="">Select a reason…</option>
                            {reasons.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>

                        <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
                            Additional details <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
                        </label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            maxLength={1000}
                            rows={3}
                            placeholder="Describe what happened…"
                            style={{
                                width: '100%', padding: '9px 12px', borderRadius: 8,
                                border: '1px solid var(--border)', fontSize: 14,
                                fontFamily: 'inherit', resize: 'vertical',
                                marginBottom: 4, boxSizing: 'border-box',
                            }}
                        />
                        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16, textAlign: 'right' }}>
                            {description.length}/1000
                        </p>

                        {error && (
                            <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{error}</p>
                        )}

                        <div style={{ display: 'flex', gap: 10 }}>
                            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={handleClose}>
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={submitting || !reason}
                                style={{
                                    flex: 1, background: '#dc2626', border: 'none', color: '#fff',
                                    padding: '10px 18px', borderRadius: 8, fontSize: 14,
                                    fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer',
                                    opacity: submitting || !reason ? 0.6 : 1,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                }}
                            >
                                {submitting && <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />}
                                {submitting ? 'Submitting…' : 'Submit Report'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
