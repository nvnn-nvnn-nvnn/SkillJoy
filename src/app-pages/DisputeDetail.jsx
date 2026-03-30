import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/lib/stores';
import { apiFetch } from '@/lib/api';

const ADMIN_EMAIL = 'techkage@proton.me';

function initials(name) {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function formatTime(ts) {
    return new Date(ts).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

export default function DisputeDetail() {
    const { disputeId } = useParams();
    const user = useUser();
    const navigate = useNavigate();

    const [dispute, setDispute] = useState(null);
    const [evidence, setEvidence] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newEvidence, setNewEvidence] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [resolving, setResolving] = useState(false);
    const [toast, setToast] = useState('');
    const [toastType, setToastType] = useState('success');

    const isAdmin = user?.email === ADMIN_EMAIL;

    useEffect(() => {
        if (!user) { navigate('/login'); return; }
        loadDispute();
    }, [disputeId, user]);

    async function loadDispute() {
        setLoading(true);
        const [disputeRes, evidenceRes] = await Promise.all([
            supabase
                .from('gig_requests')
                .select(`
                    *,
                    gig:gigs(id, title, price, category),
                    requester:profiles!requester_id(id, full_name),
                    provider:profiles!provider_id(id, full_name)
                `)
                .eq('id', disputeId)
                .single(),
            supabase
                .from('dispute_evidence')
                .select('*, submitter:profiles!user_id(id, full_name)')
                .eq('dispute_id', disputeId)
                .order('created_at', { ascending: true }),
        ]);

        if (disputeRes.error || !disputeRes.data) {
            showToast('Dispute not found', 'error');
            navigate('/disputes');
            return;
        }

        // Access check: must be buyer, seller, or admin
        const d = disputeRes.data;
        if (!isAdmin && d.requester_id !== user.id && d.provider_id !== user.id) {
            navigate('/disputes');
            return;
        }

        setDispute(d);
        if (evidenceRes.data) setEvidence(evidenceRes.data);
        setLoading(false);
    }

    async function submitEvidence() {
        if (!newEvidence.trim()) { showToast('Please write something first.', 'error'); return; }
        setSubmitting(true);

        const { error } = await supabase
            .from('dispute_evidence')
            .insert({ dispute_id: disputeId, user_id: user.id, content: newEvidence.trim() });

        setSubmitting(false);
        if (error) { showToast(error.message, 'error'); return; }

        setNewEvidence('');
        showToast('Evidence submitted.');
        loadDispute();
    }

    async function resolveDispute(resolution) {
        setResolving(true);
        try {
            const res = await apiFetch('/api/admin/resolve-dispute', {
                method: 'POST',
                body: JSON.stringify({ orderId: disputeId, resolution }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed');
            showToast(resolution === 'refund' ? '↩ Refunded to buyer.' : '✓ Released to seller.');
            loadDispute();
        } catch (err) {
            showToast(err.message, 'error');
        }
        setResolving(false);
    }

    function showToast(msg, type = 'success') {
        setToast(msg); setToastType(type);
        setTimeout(() => setToast(''), 3500);
    }

    if (loading) return (
        <div className="page" style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
            <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
        </div>
    );

    if (!dispute) return null;

    const isBuyer = dispute.requester_id === user.id;
    const isResolved = dispute.payment_status === 'refunded' || dispute.payment_status === 'released';
    const resolvedInBuyerFavor = dispute.payment_status === 'refunded';
    const daysOpen = dispute.dispute_date
        ? Math.floor((Date.now() - new Date(dispute.dispute_date)) / 86400000)
        : 0;

    return (
        <>
            <title>Dispute — {dispute.gig?.title} — SkillJoy</title>

            <div className="page dd-page">

                {/* Back */}
                <button className="dd-back" onClick={() => navigate('/disputes')}>
                    ← Back to Disputes
                </button>

                {/* Header */}
                <div className="dd-header">
                    <div className="dd-header-left">
                        <div className="dd-meta-row">
                            {dispute.gig?.category && (
                                <span className="dd-category">{dispute.gig.category}</span>
                            )}
                            <span className="dd-id">#{dispute.id.slice(0, 8)}</span>
                        </div>
                        <h1 className="dd-title">{dispute.gig?.title}</h1>
                        <div className="dd-parties">
                            <span>Buyer: <strong>{dispute.requester?.full_name}</strong></span>
                            <span className="dd-dot">·</span>
                            <span>Seller: <strong>{dispute.provider?.full_name}</strong></span>
                            <span className="dd-dot">·</span>
                            <span className="dd-amount">${dispute.payment_amount?.toFixed(2)}</span>
                        </div>
                    </div>
                    <div className="dd-status-block">
                        {isResolved ? (
                            <span className="dd-badge dd-badge-resolved">
                                {resolvedInBuyerFavor ? '✓ Refunded' : '✓ Released to Seller'}
                            </span>
                        ) : (
                            <span className="dd-badge dd-badge-active">Under Review</span>
                        )}
                        <span className="dd-days">{daysOpen} day{daysOpen !== 1 ? 's' : ''} open</span>
                    </div>
                </div>

                <div className="dd-layout">

                    {/* ── LEFT: Evidence thread ── */}
                    <div className="dd-main">

                        {/* Original dispute reason */}
                        <div className="dd-section">
                            <h3 className="dd-section-label">Dispute Reason</h3>
                            <div className="dd-original-reason">
                                <div className="dd-evidence-avatar">{initials(dispute.requester?.full_name)}</div>
                                <div className="dd-evidence-body">
                                    <div className="dd-evidence-meta">
                                        <strong>{dispute.requester?.full_name}</strong>
                                        <span className="dd-evidence-tag">Filed dispute</span>
                                        <span className="dd-evidence-time">{dispute.dispute_date ? formatTime(dispute.dispute_date) : '—'}</span>
                                    </div>
                                    <p className="dd-evidence-text">{dispute.dispute_reason}</p>
                                </div>
                            </div>
                        </div>

                        {/* Evidence thread */}
                        <div className="dd-section">
                            <h3 className="dd-section-label">
                                Evidence Submitted
                                {evidence.length > 0 && <span className="dd-count">{evidence.length}</span>}
                            </h3>

                            {evidence.length === 0 ? (
                                <p className="dd-empty">No evidence submitted yet.</p>
                            ) : (
                                <div className="dd-evidence-list">
                                    {evidence.map(e => (
                                        <div key={e.id} className={`dd-evidence-item ${e.user_id === user.id ? 'dd-evidence-mine' : ''}`}>
                                            <div className="dd-evidence-avatar">{initials(e.submitter?.full_name)}</div>
                                            <div className="dd-evidence-body">
                                                <div className="dd-evidence-meta">
                                                    <strong>{e.submitter?.full_name}</strong>
                                                    {e.user_id === dispute.requester_id && <span className="dd-evidence-tag">Buyer</span>}
                                                    {e.user_id === dispute.provider_id && <span className="dd-evidence-tag dd-tag-seller">Seller</span>}
                                                    <span className="dd-evidence-time">{formatTime(e.created_at)}</span>
                                                </div>
                                                <p className="dd-evidence-text">{e.content}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Submit new evidence — only if active */}
                        {!isResolved && (
                            <div className="dd-section">
                                <h3 className="dd-section-label">Submit Evidence</h3>
                                <textarea
                                    className="dd-textarea"
                                    placeholder="Describe your side of the situation, include any relevant details..."
                                    value={newEvidence}
                                    onChange={e => setNewEvidence(e.target.value)}
                                    rows={5}
                                />
                                <button
                                    className="btn btn-primary dd-submit-btn"
                                    disabled={submitting || !newEvidence.trim()}
                                    onClick={submitEvidence}
                                >
                                    {submitting ? 'Submitting…' : 'Submit Evidence'}
                                </button>
                            </div>
                        )}

                        {/* Resolution note */}
                        {isResolved && dispute.dispute_resolution && (
                            <div className="dd-section dd-resolution-note" style={{
                                borderColor: resolvedInBuyerFavor ? '#86efac' : '#bfdbfe',
                                background: resolvedInBuyerFavor ? '#f0fdf4' : '#eff6ff',
                            }}>
                                <h3 className="dd-section-label">Resolution</h3>
                                <p style={{ margin: 0, fontWeight: 600, color: resolvedInBuyerFavor ? '#166534' : '#1e40af' }}>
                                    {dispute.dispute_resolution}
                                </p>
                                {dispute.dispute_resolved_date && (
                                    <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                                        Resolved on {formatTime(dispute.dispute_resolved_date)}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ── RIGHT: Sidebar ── */}
                    <div className="dd-sidebar">

                        {/* Order details */}
                        <div className="dd-card">
                            <h3 className="dd-card-title">Order Details</h3>
                            <div className="dd-detail-rows">
                                <div className="dd-detail-row">
                                    <span>Order ID</span>
                                    <span className="dd-mono">#{dispute.id.slice(0, 8)}</span>
                                </div>
                                <div className="dd-detail-row">
                                    <span>Amount</span>
                                    <span>${dispute.payment_amount?.toFixed(2)}</span>
                                </div>
                                <div className="dd-detail-row">
                                    <span>Order Status</span>
                                    <span className="dd-chip">{dispute.status?.replace(/_/g, ' ')}</span>
                                </div>
                                <div className="dd-detail-row">
                                    <span>Payment</span>
                                    <span className="dd-chip">{dispute.payment_status}</span>
                                </div>
                                <div className="dd-detail-row">
                                    <span>Filed</span>
                                    <span>{dispute.dispute_date ? new Date(dispute.dispute_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Info banner */}
                        {!isResolved && (
                            <div className="dd-card dd-info-banner">
                                <p>🛡️ Payment is safely held in escrow while support reviews this case.</p>
                            </div>
                        )}

                        {/* Admin actions */}
                        {isAdmin && !isResolved && (
                            <div className="dd-card dd-admin-card">
                                <h3 className="dd-card-title">Admin Resolution</h3>
                                <p className="dd-admin-hint">Review all evidence before resolving.</p>
                                <div className="dd-admin-actions">
                                    <button
                                        className="btn btn-primary"
                                        style={{ flex: 1 }}
                                        disabled={resolving}
                                        onClick={() => resolveDispute('release')}
                                    >
                                        ✓ Release to Seller
                                    </button>
                                    <button
                                        className="dd-refund-btn"
                                        disabled={resolving}
                                        onClick={() => resolveDispute('refund')}
                                    >
                                        ↩ Refund to Buyer
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Quick links */}
                        <div className="dd-card">
                            <h3 className="dd-card-title">Quick Links</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <button className="btn btn-secondary" onClick={() => navigate(`/chat?gig=${dispute.gig?.id}`)}>
                                    View Chat
                                </button>
                                <button className="btn btn-secondary" onClick={() => navigate('/my-orders')}>
                                    View Order
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {toast && <div className={`toast ${toastType}`}>{toast}</div>}

            <style>{`
                .dd-page { padding-bottom: 80px; max-width: 1100px; }

                .dd-back {
                    display: inline-flex; align-items: center; gap: 6px;
                    padding: 7px 14px; margin-bottom: 24px;
                    background: transparent; border: 1px solid var(--border);
                    border-radius: 8px; font-size: 13px; font-weight: 500;
                    color: var(--text-secondary); cursor: pointer; font-family: inherit;
                    transition: border-color 0.14s, color 0.14s;
                }
                .dd-back:hover { border-color: var(--text-secondary); color: var(--text-primary); }

                .dd-header {
                    display: flex; justify-content: space-between; align-items: flex-start;
                    gap: 20px; background: var(--surface); border: 1px solid #fca5a5;
                    border-left: 4px solid #ef4444; border-radius: 14px;
                    padding: 22px 24px; margin-bottom: 24px;
                }
                .dd-meta-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
                .dd-category {
                    font-size: 11px; font-weight: 600; text-transform: uppercase;
                    letter-spacing: 0.05em; background: #f0ede8; color: #6b5e4e;
                    padding: 2px 9px; border-radius: 100px; border: 1px solid #e2d9ce;
                }
                .dd-id { font-size: 11px; color: var(--text-muted); font-family: monospace; }
                .dd-title { font-size: 22px; font-weight: 700; margin: 0 0 10px; letter-spacing: -0.02em; }
                .dd-parties { display: flex; align-items: center; gap: 8px; font-size: 14px; color: var(--text-muted); flex-wrap: wrap; }
                .dd-dot { color: var(--border); }
                .dd-amount { font-weight: 700; color: var(--text-primary); }
                .dd-status-block { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0; }
                .dd-badge {
                    padding: 5px 14px; border-radius: 100px;
                    font-size: 12px; font-weight: 700; white-space: nowrap;
                }
                .dd-badge-active { background: #fef3c7; color: #92400e; }
                .dd-badge-resolved { background: #f0fdf4; color: #166534; }
                .dd-days { font-size: 12px; color: var(--text-muted); }

                .dd-layout {
                    display: grid;
                    grid-template-columns: 1fr 300px;
                    gap: 20px;
                    align-items: start;
                }
                @media (max-width: 800px) { .dd-layout { grid-template-columns: 1fr; } }

                .dd-section {
                    background: var(--surface); border: 1px solid var(--border);
                    border-radius: 14px; padding: 20px 22px; margin-bottom: 16px;
                }
                .dd-section-label {
                    font-size: 11px; font-weight: 600; text-transform: uppercase;
                    letter-spacing: 0.07em; color: var(--text-muted); margin: 0 0 14px;
                    display: flex; align-items: center; gap: 8px;
                }
                .dd-count {
                    background: var(--border); color: var(--text-muted);
                    font-size: 10px; font-weight: 700; padding: 1px 6px;
                    border-radius: 100px;
                }
                .dd-empty { font-size: 14px; color: var(--text-muted); margin: 0; }

                .dd-original-reason { display: flex; gap: 12px; }
                .dd-evidence-list { display: flex; flex-direction: column; gap: 14px; }
                .dd-evidence-item { display: flex; gap: 12px; }
                .dd-evidence-mine .dd-evidence-body { background: #fef9f0; border-color: #fde8c7; }
                .dd-evidence-avatar {
                    width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;
                    background: #e0d9f0; color: #5b21b6;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 12px; font-weight: 700;
                }
                .dd-evidence-body {
                    flex: 1; background: var(--surface-alt, #f9f8f6);
                    border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px;
                }
                .dd-evidence-meta {
                    display: flex; align-items: center; gap: 8px;
                    margin-bottom: 8px; flex-wrap: wrap;
                }
                .dd-evidence-meta strong { font-size: 13px; color: var(--text-primary); }
                .dd-evidence-tag {
                    font-size: 10px; font-weight: 600; text-transform: uppercase;
                    letter-spacing: 0.04em; padding: 1px 7px; border-radius: 100px;
                    background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe;
                }
                .dd-tag-seller { background: #f0fdf4; color: #166534; border-color: #86efac; }
                .dd-evidence-time { font-size: 11px; color: var(--text-muted); margin-left: auto; }
                .dd-evidence-text { font-size: 14px; color: var(--text-primary); line-height: 1.6; margin: 0; white-space: pre-wrap; }

                .dd-textarea {
                    width: 100%; padding: 12px 14px; border: 1.5px solid var(--border);
                    border-radius: 10px; font-family: inherit; font-size: 14px;
                    line-height: 1.6; resize: vertical; box-sizing: border-box;
                    color: var(--text-primary); background: var(--surface);
                    transition: border-color 0.15s; margin-bottom: 12px; display: block;
                }
                .dd-textarea:focus { outline: none; border-color: var(--primary); }
                .dd-submit-btn:disabled { opacity: 0.45; cursor: not-allowed; }

                .dd-resolution-note { border-width: 1px; }

                /* Sidebar */
                .dd-sidebar { position: sticky; top: 20px; }
                .dd-card {
                    background: var(--surface); border: 1px solid var(--border);
                    border-radius: 14px; padding: 18px 20px; margin-bottom: 14px;
                }
                .dd-card-title { font-size: 13px; font-weight: 700; margin: 0 0 14px; }
                .dd-detail-rows { display: flex; flex-direction: column; gap: 0; }
                .dd-detail-row {
                    display: flex; justify-content: space-between; align-items: center;
                    padding: 9px 0; border-bottom: 1px solid var(--border);
                    font-size: 13px; color: var(--text-muted);
                }
                .dd-detail-row:last-child { border-bottom: none; }
                .dd-detail-row span:last-child { font-weight: 500; color: var(--text-primary); }
                .dd-mono { font-family: monospace; font-size: 12px; }
                .dd-chip {
                    font-size: 11px; font-weight: 600; text-transform: capitalize;
                    padding: 2px 8px; border-radius: 100px;
                    background: var(--surface-alt, #f9f8f6); border: 1px solid var(--border);
                }
                .dd-info-banner { background: #dbeafe; border-color: #bfdbfe; }
                .dd-info-banner p { margin: 0; font-size: 13px; color: #1e40af; line-height: 1.5; }

                .dd-admin-card { border-color: #fde68a; background: #fffbeb; }
                .dd-admin-hint { font-size: 12px; color: #92400e; margin: -8px 0 12px; }
                .dd-admin-actions { display: flex; flex-direction: column; gap: 8px; }
                .dd-refund-btn {
                    width: 100%; background: #fff5f5; border: 1.5px solid #fca5a5;
                    color: #dc2626; padding: 11px; border-radius: 8px;
                    font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.15s; font-family: inherit;
                }
                .dd-refund-btn:hover { background: #fee2e2; }
                .dd-refund-btn:disabled { opacity: 0.45; cursor: not-allowed; }
            `}</style>
        </>
    );
}
