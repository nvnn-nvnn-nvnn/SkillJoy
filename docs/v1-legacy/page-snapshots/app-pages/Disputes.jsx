import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/lib/stores';
import { apiFetch } from '@/lib/api';

/**
 * Disputes - Payment dispute resolution page
 * 
 * DISPUTE FLOW:
 * 1. Buyer files dispute -> payment_status: 'disputed'
 * 2. Support team reviews evidence from both parties
 * 3. Support decides outcome:
 *    - Refund buyer -> payment_status: 'refunded'
 *    - Release to seller -> payment_status: 'released'
 * 
 * BACKEND INTEGRATION POINTS:
 * - submitEvidence(): Upload files/messages to support ticket
 * - resolveDispute(): Admin action to resolve dispute
 * - Notification system: Alert both parties of resolution
 */

export default function Disputes() {
    const user = useUser();
    const navigate = useNavigate();

    const [disputes, setDisputes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState('');
    const [toastType, setToastType] = useState('success');
    const [selectedDispute, setSelectedDispute] = useState(null);
    const [evidenceText, setEvidenceText] = useState('');
    const [evidenceImage, setEvidenceImage] = useState(null); // File object
    const [uploadingEvidence, setUploadingEvidence] = useState(false);
    const [cancelTarget, setCancelTarget] = useState(null);

    useEffect(() => {
        if (!user) { navigate('/login'); return; }
        loadDisputes();
    }, [user]);

    async function loadDisputes() {
        setLoading(true);

        // Load all disputes (active and resolved) where user is buyer or seller
        const { data, error } = await supabase
            .from('gig_requests')
            .select(`
                *,
                gig:gigs(id, title, price, category),
                requester:profiles!requester_id(id, full_name),
                provider:profiles!provider_id(id, full_name)
            `)
            .not('dispute_date', 'is', null)
            .or(`requester_id.eq.${user.id},provider_id.eq.${user.id}`)
            .order('dispute_date', { ascending: false });

        if (!error && data) setDisputes(data);
        setLoading(false);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // DISPUTE ACTIONS - BACKEND INTEGRATION NEEDED
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Submit evidence for dispute
     * BACKEND TODO:
     * - Create support ticket system
     * - Store evidence (text, files, screenshots)
     * - Notify support team
     * - Allow file uploads
     */
    async function submitEvidence(disputeId) {
        if (!evidenceText.trim()) {
            showToast('Please provide evidence details', 'error');
            return;
        }

        setUploadingEvidence(true);
        try {
            let imageUrl = null;

            // Upload image to Supabase Storage if provided
            if (evidenceImage) {
                const ext = evidenceImage.name.split('.').pop();
                const path = `${user.id}/${disputeId}/${Date.now()}.${ext}`;
                const { error: upErr } = await supabase.storage.from('dispute-evidence').upload(path, evidenceImage);
                if (upErr) throw new Error('Image upload failed: ' + upErr.message);
                const { data } = supabase.storage.from('dispute-evidence').getPublicUrl(path);
                imageUrl = data.publicUrl;
            }

            const res = await apiFetch('/api/payments/submit-evidence', {
                method: 'POST',
                body: JSON.stringify({ orderId: disputeId, content: evidenceText.trim(), imageUrl }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to submit evidence');

            showToast('Evidence submitted.', 'success');
            setEvidenceText('');
            setEvidenceImage(null);
            setSelectedDispute(null);
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setUploadingEvidence(false);
        }
    }

    /**
     * Cancel dispute (before support review)
     * BACKEND TODO:
     * - Allow cancellation only if not yet reviewed
     * - Return payment_status to 'escrowed'
     * - Notify other party
     */
    async function cancelDispute(disputeId) {
        try {
            const res = await apiFetch('/api/payments/cancel-dispute', {
                method: 'POST',
                body: JSON.stringify({ orderId: disputeId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to cancel dispute');
            showToast('Dispute cancelled — order marked as completed.', 'success');
            loadDisputes();
        } catch (err) {
            showToast(err.message, 'error');
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // UI HELPERS
    // ═══════════════════════════════════════════════════════════════════════════

    function showToast(msg, type = 'success') {
        setToast(msg);
        setToastType(type);
        setTimeout(() => setToast(''), 3500);
    }

    function getDaysOpen(dispute) {
        if (!dispute.dispute_date) return 0;
        const now = new Date();
        const disputeDate = new Date(dispute.dispute_date);
        const diffMs = now - disputeDate;
        return Math.floor(diffMs / (1000 * 60 * 60 * 24));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════════════════════

    return (
        <>
            <title>Payment Disputes — SkillJoy</title>

            <div className="page">
                <div className="swaps-hero-section">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                        <div>
                            <h1 className="page-title">Payment Disputes</h1>
                            <p className="page-subtitle" style={{ color: '#000' }}>Manage and resolve payment disputes</p>
                        </div>
                        <button className="btn btn-secondary" style={{ backgroundColor: '#fff', border: '1px solid #000', alignSelf: 'flex-start' }} onClick={() => navigate('/my-orders')}>
                            ← Back to Orders
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
                        <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
                    </div>
                ) : disputes.length === 0 ? (
                    <div className="empty-state">
                        <span className="empty-icon">⚖️</span>
                        <h3>No active disputes</h3>
                        <p>Your payment disputes will appear here.</p>
                    </div>
                ) : (
                    <div className="disputes-list">
                        {disputes.map(dispute => {
                            const isBuyer = dispute.requester_id === user.id;
                            const otherUser = isBuyer ? dispute.provider : dispute.requester;
                            const daysOpen = getDaysOpen(dispute);
                            const isResolved = dispute.payment_status === 'refunded' || dispute.payment_status === 'released';
                            const resolvedInBuyerFavor = dispute.payment_status === 'refunded';

                            return (
                                <div key={dispute.id} className="dispute-card" style={isResolved ? { borderColor: '#d1d5db', opacity: 0.85 } : {}}>
                                    <div className="dispute-header">
                                        <div>
                                            <h3 className="dispute-title">{dispute.gig.title}</h3>
                                            <p className="dispute-meta">
                                                {isBuyer ? 'Seller' : 'Buyer'}: {otherUser.full_name}
                                            </p>
                                        </div>
                                        {isResolved ? (
                                            <span className="dispute-badge" style={{
                                                background: resolvedInBuyerFavor ? '#f0fdf4' : '#eff6ff',
                                                color: resolvedInBuyerFavor ? '#166534' : '#1e40af',
                                            }}>
                                                {resolvedInBuyerFavor ? '✓ Refunded' : '✓ Released to Seller'}
                                            </span>
                                        ) : (
                                            <span className="dispute-badge">Under Review</span>
                                        )}
                                    </div>

                                    <div className="dispute-details">
                                        <div className="dispute-detail-row">
                                            <span className="dispute-label">Amount in Dispute:</span>
                                            <span className="dispute-value">${dispute.payment_amount?.toFixed(2) || dispute.gig.price?.toFixed(2)}</span>
                                        </div>
                                        <div className="dispute-detail-row">
                                            <span className="dispute-label">Filed:</span>
                                            <span className="dispute-value">
                                                {new Date(dispute.dispute_date).toLocaleDateString()} ({daysOpen} day{daysOpen !== 1 ? 's' : ''} ago)
                                            </span>
                                        </div>
                                        {dispute.dispute_reason && (
                                            <div className="dispute-reason-box">
                                                <strong>Reason:</strong>
                                                <p>{dispute.dispute_reason}</p>
                                            </div>
                                        )}
                                    </div>

                                    {isResolved ? (
                                        <div className="dispute-info-banner" style={{
                                            background: resolvedInBuyerFavor ? '#f0fdf4' : '#eff6ff',
                                        }}>
                                            <p style={{ color: resolvedInBuyerFavor ? '#166534' : '#1e40af' }}>
                                                {resolvedInBuyerFavor
                                                    ? isBuyer
                                                        ? '✓ This dispute was resolved in your favor. A full refund has been issued.'
                                                        : '✗ This dispute was resolved in the buyer\'s favor. The payment was refunded.'
                                                    : isBuyer
                                                        ? '✓ This dispute was reviewed and payment was released to the seller.'
                                                        : '✓ This dispute was resolved in your favor. Payment has been released to you.'
                                                }
                                            </p>
                                            {dispute.dispute_resolution && (
                                                <p style={{ margin: '4px 0 0', fontSize: 13, opacity: 0.8 }}>
                                                    Resolution: {dispute.dispute_resolution}
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="dispute-info-banner">
                                            <p>
                                                🛡️ Your payment is safely held while our support team reviews this case.
                                                Both parties will be notified of the resolution.
                                            </p>
                                        </div>
                                    )}

                                    <div className="dispute-actions">
                                        <button
                                            className="btn btn-primary"
                                            onClick={() => navigate(`/disputes/${dispute.id}`)}
                                        >
                                            View Details
                                        </button>
                                        {!isResolved && isBuyer && (
                                            <button
                                                className="btn btn-secondary"
                                                onClick={() => setCancelTarget(dispute)}
                                                style={{ marginLeft: 'auto' }}
                                            >
                                                Cancel Dispute
                                            </button>
                                        )}
                                    </div>

                                    {/* ADMIN ACTIONS (Hidden for regular users) */}
                                    {/* TODO: Show only if user.role === 'admin' */}
                                    {false && (
                                        <div className="admin-actions">
                                            <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>Admin Actions:</p>
                                            <button 
                                                className="btn btn-sm" 
                                                style={{ background: '#10b981', color: 'white' }}
                                                onClick={() => resolveDispute(dispute.id, 'release')}
                                            >
                                                Release to Seller
                                            </button>
                                            <button 
                                                className="btn btn-sm" 
                                                style={{ background: '#ef4444', color: 'white' }}
                                                onClick={() => resolveDispute(dispute.id, 'refund')}
                                            >
                                                Refund Buyer
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* EVIDENCE SUBMISSION MODAL */}
            {selectedDispute && (
                <div className="modal-overlay" onClick={() => setSelectedDispute(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h2 className="modal-title">Submit Evidence</h2>
                        <div className="modal-body">
                            <p style={{ marginBottom: '16px' }}>
                                Provide details to support your case. Include any relevant information, 
                                screenshots, or communication history.
                            </p>
                            
                            <textarea
                                className="evidence-textarea"
                                placeholder="Describe the issue and provide evidence..."
                                value={evidenceText}
                                onChange={e => setEvidenceText(e.target.value)}
                                rows={6}
                            />

                            {/* Optional image attachment */}
                            <div style={{ marginTop: 12 }}>
                                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                                    Attach image (optional)
                                </label>
                                {evidenceImage ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <img src={URL.createObjectURL(evidenceImage)} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }} />
                                        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{evidenceImage.name}</span>
                                        <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setEvidenceImage(null)}>Remove</button>
                                    </div>
                                ) : (
                                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '8px 14px', border: '1px dashed var(--border)', borderRadius: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                                        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => setEvidenceImage(e.target.files[0] || null)} />
                                        📎 Choose image
                                    </label>
                                )}
                            </div>

                            {/* PLACEHOLDER: File upload would go here */}
                            <div style={{ background: '#f3f4f6', padding: '16px', borderRadius: '8px', marginTop: '16px', textAlign: 'center' }}>
                                <p style={{ color: '#6b7280', margin: 0, fontSize: '14px' }}>
                                    📎 [File Upload Placeholder]
                                </p>
                                <p style={{ color: '#6b7280', fontSize: '12px', marginTop: '4px' }}>
                                    Backend integration needed: File upload to support ticket
                                </p>
                            </div>
                        </div>
                        <div className="modal-actions">
                            <button className="btn btn-secondary" onClick={() => setSelectedDispute(null)}>
                                Cancel
                            </button>
                            <button className="btn btn-primary" onClick={() => submitEvidence(selectedDispute.id)} disabled={uploadingEvidence}>
                                {uploadingEvidence ? 'Uploading...' : 'Submit Evidence'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CANCEL DISPUTE MODAL */}
            {cancelTarget && (
                <div className="modal-overlay" onClick={() => setCancelTarget(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
                        <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
                            <div style={{ fontSize: 40, marginBottom: 12 }}>🚫</div>
                            <h2 className="modal-title">Cancel Dispute?</h2>
                            <p style={{ fontSize: 15, color: '#374151', margin: '0 0 6px', lineHeight: 1.5 }}>
                                This will cancel the dispute for <strong>{cancelTarget.gig?.title}</strong> and return the payment to escrow.
                            </p>
                            <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 24px' }}>
                                You can re-file a dispute later if needed.
                            </p>
                        </div>
                        <div className="modal-actions" style={{ justifyContent: 'center', gap: 12 }}>
                            <button className="btn btn-secondary" onClick={() => setCancelTarget(null)}>
                                Go Back
                            </button>
                            <button
                                className="btn btn-primary"
                                style={{ background: '#ef4444' }}
                                onClick={() => { cancelDispute(cancelTarget.id); setCancelTarget(null); }}
                            >
                                Yes, Cancel Dispute
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {toast && <div className={`toast ${toastType}`}>{toast}</div>}

            <style>{`
                .swaps-hero-section {
                    background: #f0ede8;
                    padding: 24px;
                    border-radius: 16px;
                    margin-bottom: 24px;
                }

                .disputes-list {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }

                .dispute-card {
                    background: var(--surface);
                    border: 2px solid #f59e0b;
                    border-radius: 12px;
                    padding: 20px;
                }

                .dispute-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 16px;
                }

                .dispute-title {
                    font-size: 18px;
                    font-weight: 600;
                    margin: 0 0 4px 0;
                    color: var(--text-primary);
                }

                .dispute-meta {
                    font-size: 14px;
                    color: var(--text-muted);
                    margin: 0;
                }

                .dispute-badge {
                    padding: 4px 12px;
                    border-radius: 100px;
                    font-size: 12px;
                    font-weight: 600;
                    background: #fef3c7;
                    color: #92400e;
                }

                .dispute-details {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    margin-bottom: 16px;
                    padding: 12px;
                    background: var(--surface-alt);
                    border-radius: 8px;
                }

                .dispute-detail-row {
                    display: flex;
                    justify-content: space-between;
                    font-size: 14px;
                }

                .dispute-label {
                    color: var(--text-muted);
                }

                .dispute-value {
                    font-weight: 500;
                    color: var(--text-primary);
                }

                .dispute-reason-box {
                    margin-top: 12px;
                    padding: 12px;
                    background: #fef3c7;
                    border-radius: 8px;
                    font-size: 14px;
                }

                .dispute-reason-box p {
                    margin: 4px 0 0 0;
                    color: #78350f;
                }

                .dispute-info-banner {
                    background: #dbeafe;
                    padding: 12px;
                    border-radius: 8px;
                    margin-bottom: 16px;
                }

                .dispute-info-banner p {
                    margin: 0;
                    font-size: 14px;
                    color: #1e40af;
                }

                .dispute-actions {
                    display: flex;
                    gap: 12px;
                    flex-wrap: wrap;
                }

                .admin-actions {
                    margin-top: 16px;
                    padding-top: 16px;
                    border-top: 1px solid var(--border);
                    display: flex;
                    gap: 12px;
                    flex-wrap: wrap;
                }

                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                }

                .modal-content {
                    background: var(--surface);
                    border-radius: 16px;
                    padding: 24px;
                    max-width: 600px;
                    width: 90%;
                    max-height: 90vh;
                    overflow-y: auto;
                }

                .modal-title {
                    font-size: 20px;
                    font-weight: 600;
                    margin: 0 0 16px 0;
                }

                .modal-body {
                    margin-bottom: 24px;
                }

                .evidence-textarea {
                    width: 100%;
                    padding: 12px;
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    font-family: inherit;
                    font-size: 14px;
                    resize: vertical;
                    box-sizing: border-box;
                }

                .evidence-textarea:focus {
                    outline: none;
                    border-color: var(--primary);
                }

                .modal-actions {
                    display: flex;
                    gap: 12px;
                    justify-content: flex-end;
                }

                .btn-sm {
                    padding: 6px 12px;
                    font-size: 13px;
                }
            `}</style>
        </>
    );
}
