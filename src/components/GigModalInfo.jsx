import { Link } from 'react-router-dom';

export default function GigModalInfo({ order, isOpen, onClose, isBuyer, onWithdraw, onDispute }) {
    if (!isOpen || !order) return null;

    const otherUser = isBuyer ? order.provider : order.requester;
    const otherName = otherUser?.full_name;

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal gmi-modal" onClick={e => e.stopPropagation()}>
                <button className="modal-close" onClick={onClose}>✕</button>

                {/* Header */}
                <div className="gmi-header">
                    <div className="gmi-header-meta">
                        {order.gig.category && <span className="gmi-category">{order.gig.category}</span>}
                        <span className="gmi-order-id">#{order.id.slice(0, 8)}</span>
                    </div>
                    <h2 className="gmi-title">{order.gig.title}</h2>
                    <p className="gmi-subtitle">
                        {isBuyer ? 'Provider' : 'Buyer'}:{' '}
                        <Link to={`/profile/${otherUser?.id}`} style={{ fontWeight: 700, color: 'var(--primary)', textDecoration: 'underline' }}>
                            {otherName ?? '—'}
                        </Link>
                    </p>
                </div>

                {/* Status row */}
                <div className="gmi-status-row">
                    <div className="gmi-status-pill">
                        <span className="gmi-status-label">Order</span>
                        <span className="gmi-status-value">{order.status === 'withdrawn' ? 'Withdrawn' : order.status?.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="gmi-status-pill">
                        <span className="gmi-status-label">Payment</span>
                        <span className="gmi-status-value">{order.payment_status === 'withdrawn' ? 'Withdrawn' : order.payment_status?.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="gmi-status-pill">
                        <span className="gmi-status-label">Amount</span>
                        <span className="gmi-status-value gmi-amount">${(order.payment_amount ?? order.gig.price)?.toFixed(2)}</span>
                    </div>
                </div>

                {/* Description */}
                {order.gig.description && (
                    <div className="gmi-section">
                        <h3>About this gig</h3>
                        <p className="gmi-body-text">{order.gig.description}</p>
                    </div>
                )}

                {/* Commitments */}
                {order.gig.commitments && (
                    <div className="gmi-section">
                        <h3>Commitments</h3>
                        <p className="gmi-body-text">{order.gig.commitments}</p>
                    </div>
                )}

                {/* Requirements */}
                {order.gig.requirements && (
                    <div className="gmi-section">
                        <h3>Requirements</h3>
                        <p className="gmi-body-text">{order.gig.requirements}</p>
                    </div>
                )}

                {/* Actions - hidden if withdrawn */}
                {order.status !== 'withdrawn' && order.payment_status !== 'withdrawn' && (
                    <div className="gmi-actions">
{isBuyer && order.payment_status === 'escrowed' && order.status === 'accepted' && onWithdraw && (
                            <button className="btn gmi-withdraw-btn" onClick={() => onWithdraw(order.id)}>
                                <span>↩</span> Withdraw & Cancel
                            </button>
                        )}

                        {isBuyer && ['escrowed', 'released'].includes(order.payment_status) &&
                            ['delivered', 'completed'].includes(order.status) && onDispute &&
                            order.payment_status !== 'disputed' && (
                                <button className="btn btn-secondary" onClick={() => onDispute(order.id)}>

                                    File Dispute
                                </button>
                            )}

                        <button className="btn btn-primary" onClick={onClose}>Close</button>
                    </div>
                )}

                {/* Withdrawn message */}
                {(order.status === 'withdrawn' || order.payment_status === 'withdrawn') && (
                    <div className="gmi-withdrawn-note">
                        <span>✓</span> Order withdrawn. Payment has been returned.
                        <button className="btn btn-primary" onClick={onClose} style={{ marginTop: 12, width: '100%' }}>
                            Close
                        </button>
                    </div>
                )}

                <style>{`
                    .gmi-modal { max-width: 480px; padding: 28px 28px 24px; }

                    .gmi-header { margin-bottom: 20px; }
                    .gmi-header-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
                    .gmi-category {
                        font-size: 11px; font-weight: 600; text-transform: uppercase;
                        letter-spacing: 0.05em; background: #f0ede8; color: #6b5e4e;
                        padding: 2px 9px; border-radius: 100px; border: 1px solid #e2d9ce;
                    }
                    .gmi-order-id { font-size: 11px; color: var(--text-muted); font-family: monospace; }
                    .gmi-title { font-size: 20px; font-weight: 700; margin: 0 0 4px; color: var(--text-primary); }
                    .gmi-subtitle { font-size: 13px; color: var(--text-muted); margin: 0; }

                    .gmi-status-row {
                        display: flex; gap: 10px; margin-bottom: 20px;
                    }
                    .gmi-status-pill {
                        flex: 1; display: flex; flex-direction: column; gap: 3px;
                        background: var(--surface-alt, #f9f8f6); border: 1px solid var(--border, #e5e2da);
                        border-radius: 10px; padding: 10px 12px;
                    }
                    .gmi-status-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); }
                    .gmi-status-value { font-size: 13px; font-weight: 600; color: var(--text-primary); text-transform: capitalize; }
                    .gmi-amount { color: #111; }

                    .gmi-section { margin-bottom: 16px; }
                    .gmi-section h3 { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); margin: 0 0 6px; }
                    .gmi-body-text { font-size: 14px; color: var(--text-primary); line-height: 1.6; margin: 0; }

                    .gmi-actions { display: flex; gap: 10px; margin-top: 24px; flex-wrap: wrap; }
                    .gmi-actions .btn { flex: 1; min-width: 130px; }

                    .gmi-withdrawn-note {
                        margin-top: 20px; padding: 12px 16px; background: #f3f4f6;
                        border: 1px solid #d1d5db; border-radius: 10px;
                        font-size: 14px; color: #4b5563; display: flex; flex-direction: column;
                    }

                    .btn-outline-danger {
                        background: transparent; border: 1px solid #ef4444; color: #ef4444;
                        padding: 10px 16px; border-radius: 8px; font-size: 14px; font-weight: 500;
                        cursor: pointer; transition: all 0.15s;
                    }
                    .btn-outline-danger:hover { background: #fef2f2; border-color: #dc2626; color: #dc2626; }

                    .gmi-withdraw-btn {
                        display: flex; align-items: center; gap: 7px;
                        background: #fff5f5; border: 1.5px solid #fca5a5; color: #dc2626;
                        padding: 10px 18px; border-radius: 10px; font-size: 14px; font-weight: 600;
                        cursor: pointer; transition: all 0.15s; letter-spacing: 0.01em;
                    }
                    .gmi-withdraw-btn:hover {
                        background: #fee2e2; border-color: #ef4444; color: #b91c1c;
                        box-shadow: 0 2px 8px rgba(239,68,68,0.15);
                    }
                `}</style>
            </div>
        </div>
    );
}
