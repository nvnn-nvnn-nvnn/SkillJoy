import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/lib/stores';

/**
 * MyOrders - Track gig orders with escrow payment system
 * 
 * PAYMENT FLOW (Fiverr-style):
 * 1. Buyer places order -> payment_status: 'pending'
 * 2. Buyer pays -> payment_status: 'escrowed' (money held by platform)
 * 3. Provider delivers work -> status: 'delivered'
 * 4. Buyer has 3 days to review:
 *    - Accept -> payment_status: 'released' (money goes to provider)
 *    - Dispute -> payment_status: 'disputed' (support intervenes)
 *    - No action -> auto-release after 3 days
 * 5. After release, 14-day clearing period before withdrawal
 * 
 * BACKEND INTEGRATION POINTS:
 * - handleAcceptOrder(): Call Stripe Payment Intent API
 * - handleReleasePayment(): Release funds from escrow
 * - handleDispute(): Create dispute record
 * - Auto-release cron job: Check auto_release_date daily
 */

export default function MyOrders() {
    const user = useUser();
    const navigate = useNavigate();

    const [tab, setTab] = useState('buying'); // 'buying' or 'selling'
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState('');
    const [toastType, setToastType] = useState('success');
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);

    useEffect(() => {
        if (!user) { navigate('/login'); return; }
        loadOrders();
    }, [user, tab]);

    async function loadOrders() {
        setLoading(true);
        const column = tab === 'buying' ? 'requester_id' : 'provider_id';

        const { data, error } = await supabase
            .from('gig_requests')
            .select(`
                *,
                gig:gigs(id, title, price, category),
                requester:profiles!requester_id(id, full_name),
                provider:profiles!provider_id(id, full_name)
            `)
            .eq(column, user.id)
            .order('created_at', { ascending: false });

        if (!error && data) setOrders(data);
        setLoading(false);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PAYMENT ACTIONS - BACKEND INTEGRATION NEEDED
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * STEP 1: Buyer accepts order and pays
     * BACKEND TODO:
     * - Create Stripe Payment Intent
     * - Charge buyer's card
     * - Update payment_status to 'escrowed'
     * - Store payment_intent_id
     * - Set escrow_date to now
     */
    async function handleAcceptOrder(order) {
        setSelectedOrder(order);
        setShowPaymentModal(true);
    }

    async function confirmPayment() {
        if (!selectedOrder) return;

        // PLACEHOLDER: Call your backend endpoint to process payment
        // Example: POST /api/payments/create-intent
        // Body: { orderId: selectedOrder.id, amount: selectedOrder.gig.price }

        try {
            // TODO: Replace with actual Stripe integration
            const paymentIntentId = 'pi_placeholder_' + Date.now();

            const { error } = await supabase
                .from('gig_requests')
                .update({
                    payment_status: 'escrowed',
                    payment_amount: selectedOrder.gig.price,
                    payment_intent_id: paymentIntentId,
                    escrow_date: new Date().toISOString(),
                    status: 'accepted'
                })
                .eq('id', selectedOrder.id);

            if (error) throw error;

            showToast('Payment processed! Funds are in escrow.', 'success');
            setShowPaymentModal(false);
            setSelectedOrder(null);
            loadOrders();
        } catch (err) {
            showToast(err.message, 'error');
        }
    }

    /**
     * STEP 4a: Buyer releases payment after reviewing work
     * BACKEND TODO:
     * - Transfer funds from escrow to provider's balance
     * - Update payment_status to 'released'
     * - Set release_date to now
     * - Start 14-day clearing period
     */
    async function handleReleasePayment(orderId) {
        // PLACEHOLDER: Call backend to release funds
        // Example: POST /api/payments/release
        // Body: { orderId }

        try {
            const { error } = await supabase
                .from('gig_requests')
                .update({
                    payment_status: 'released',
                    release_date: new Date().toISOString()
                })
                .eq('id', orderId);

            if (error) throw error;

            showToast('Payment released to provider!', 'success');
            loadOrders();
        } catch (err) {
            showToast(err.message, 'error');
        }
    }

    /**
     * STEP 4b: Buyer disputes the order
     * BACKEND TODO:
     * - Create dispute record
     * - Update payment_status to 'disputed'
     * - Notify support team
     * - Hold funds until resolution
     */
    async function handleDispute(orderId, reason) {
        // PLACEHOLDER: Call backend to create dispute
        // Example: POST /api/disputes/create
        // Body: { orderId, reason }

        try {
            const { error } = await supabase
                .from('gig_requests')
                .update({
                    payment_status: 'disputed',
                    dispute_reason: reason,
                    dispute_date: new Date().toISOString()
                })
                .eq('id', orderId);

            if (error) throw error;

            showToast('Dispute filed. Support will review.', 'success');
            navigate('/disputes');
        } catch (err) {
            showToast(err.message, 'error');
        }
    }

    /**
     * AUTO-RELEASE LOGIC (Backend Cron Job)
     * BACKEND TODO:
     * - Run daily cron job to check orders where:
     *   - payment_status = 'escrowed'
     *   - status = 'delivered'
     *   - auto_release_date <= NOW()
     * - Automatically call handleReleasePayment() for those orders
     */

    // ═══════════════════════════════════════════════════════════════════════════
    // UI HELPERS
    // ═══════════════════════════════════════════════════════════════════════════

    function showToast(msg, type = 'success') {
        setToast(msg);
        setToastType(type);
        setTimeout(() => setToast(''), 3500);
    }

    function getStatusBadge(order) {
        const { status, payment_status } = order;

        if (payment_status === 'disputed') return { text: 'Disputed', color: '#ef4444' };
        if (payment_status === 'released') return { text: 'Completed', color: '#10b981' };
        if (payment_status === 'escrowed' && status === 'delivered') return { text: 'Review Pending', color: '#f59e0b' };
        if (payment_status === 'escrowed') return { text: 'In Progress', color: '#3b82f6' };
        if (status === 'pending') return { text: 'Awaiting Payment', color: '#6b7280' };

        return { text: status, color: '#6b7280' };
    }

    function getDaysUntilAutoRelease(order) {
        if (!order.auto_release_date) return null;
        const now = new Date();
        const releaseDate = new Date(order.auto_release_date);
        const diffMs = releaseDate - now;
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        return diffDays > 0 ? diffDays : 0;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════════════════════

    return (
        <>
            <title>My Orders — SkillJoy</title>

            <div className="page">
                <div className="swaps-hero-section">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                        <div>
                            <h1 className="page-title">My Orders</h1>
                            <p className="page-subtitle" style={{ color: '#000' }}>Track your gig orders and payments</p>
                        </div>
                        <button className="btn btn-secondary" style={{ backgroundColor: '#fff', border: '1px solid #000', alignSelf: 'flex-start' }} onClick={() => navigate('/gigs')}>
                            ← Back to Gigs
                        </button>
                    </div>

                    <div className="tabs" style={{ border: '1px solid #000', backgroundColor: '#ec9146' }}>
                        <button className={`tab ${tab === 'selling' ? 'active' : ''}`} onClick={() => setTab('selling')}>
                            Listing
                        </button>
                        <button className={`tab ${tab === 'buying' ? 'active' : ''}`} onClick={() => setTab('buying')}>
                            Buying
                        </button>

                    </div>
                </div>

                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
                        <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
                    </div>
                ) : orders.length === 0 ? (
                    <div className="empty-state">
                        <span className="empty-icon">📦</span>
                        <h3>No orders yet</h3>
                        <p>Your {tab === 'buying' ? 'purchases' : 'sales'} will appear here.</p>
                        <button className="btn btn-primary" onClick={() => navigate('/gigs')} style={{ marginTop: 16 }}>
                            Browse Gigs
                        </button>
                    </div>
                ) : (
                    <div className="orders-list">
                        {orders.map(order => {
                            const badge = getStatusBadge(order);
                            const daysLeft = getDaysUntilAutoRelease(order);
                            const isBuyer = tab === 'buying';
                            const otherUser = isBuyer ? order.provider : order.requester;

                            return (
                                <div key={order.id} className="order-card">
                                    <div className="order-header">
                                        <div>
                                            <h3 className="order-title">{order.gig.title}</h3>
                                            <p className="order-meta">
                                                {isBuyer ? 'Seller' : 'Buyer'}: {otherUser.full_name}
                                            </p>
                                        </div>
                                        <span className="order-badge" style={{ backgroundColor: badge.color }}>
                                            {badge.text}
                                        </span>
                                    </div>

                                    <div className="order-details">
                                        <div className="order-detail-row">
                                            <span className="order-label">Amount:</span>
                                            <span className="order-value">${order.payment_amount?.toFixed(2) || order.gig.price?.toFixed(2)}</span>
                                        </div>
                                        <div className="order-detail-row">
                                            <span className="order-label">Payment Status:</span>
                                            <span className="order-value">{order.payment_status || 'pending'}</span>
                                        </div>
                                        {order.escrow_date && (
                                            <div className="order-detail-row">
                                                <span className="order-label">Escrowed:</span>
                                                <span className="order-value">{new Date(order.escrow_date).toLocaleDateString()}</span>
                                            </div>
                                        )}
                                        {daysLeft !== null && order.payment_status === 'escrowed' && (
                                            <div className="order-detail-row">
                                                <span className="order-label">Auto-release in:</span>
                                                <span className="order-value" style={{ color: '#f59e0b', fontWeight: 600 }}>
                                                    {daysLeft} day{daysLeft !== 1 ? 's' : ''}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="order-actions">
                                        {/* BUYER ACTIONS */}
                                        {isBuyer && order.status === 'pending' && order.payment_status === 'pending' && (
                                            <button className="btn btn-primary" onClick={() => handleAcceptOrder(order)}>
                                                Accept & Pay
                                            </button>
                                        )}

                                        {isBuyer && order.payment_status === 'escrowed' && order.status === 'delivered' && (
                                            <>
                                                <button className="btn btn-primary" onClick={() => handleReleasePayment(order.id)}>
                                                    Release Payment
                                                </button>
                                                <button className="btn btn-secondary" onClick={() => {
                                                    const reason = prompt('Please describe the issue:');
                                                    if (reason) handleDispute(order.id, reason);
                                                }}>
                                                    File Dispute
                                                </button>
                                            </>
                                        )}

                                        {/* SELLER ACTIONS */}
                                        {!isBuyer && order.payment_status === 'released' && (
                                            <div className="order-info-box" style={{ background: '#d1fae5', padding: '12px', borderRadius: '8px' }}>
                                                <p style={{ margin: 0, fontSize: '14px', color: '#065f46' }}>
                                                    ✓ Payment released! Funds will be available for withdrawal after 14-day clearing period.
                                                </p>
                                            </div>
                                        )}

                                        {/* COMMON ACTIONS */}
                                        <button className="btn btn-secondary" onClick={() => navigate(`/chat?gig=${order.gig.id}`)}>
                                            View Chat
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* PAYMENT MODAL */}
            {showPaymentModal && selectedOrder && (
                <div className="modal-overlay" onClick={() => setShowPaymentModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h2 className="modal-title">Accept Order & Pay</h2>
                        <div className="modal-body">
                            <p><strong>Gig:</strong> {selectedOrder.gig.title}</p>
                            <p><strong>Amount:</strong> ${selectedOrder.gig.price?.toFixed(2)}</p>
                            <div style={{ background: '#fef3c7', padding: '12px', borderRadius: '8px', marginTop: '16px' }}>
                                <p style={{ margin: 0, fontSize: '14px' }}>
                                    💡 Your payment will be held in escrow until you approve the work.
                                    You'll have 3 days to review after delivery.
                                </p>
                            </div>

                            {/* PLACEHOLDER: Stripe Payment Element would go here */}
                            <div style={{ background: '#f3f4f6', padding: '24px', borderRadius: '8px', marginTop: '16px', textAlign: 'center' }}>
                                <p style={{ color: '#6b7280', margin: 0 }}>
                                    [Stripe Payment Element Placeholder]
                                </p>
                                <p style={{ color: '#6b7280', fontSize: '12px', marginTop: '8px' }}>
                                    Backend integration needed: Create Payment Intent
                                </p>
                            </div>
                        </div>
                        <div className="modal-actions">
                            <button className="btn btn-secondary" onClick={() => setShowPaymentModal(false)}>
                                Cancel
                            </button>
                            <button className="btn btn-primary" onClick={confirmPayment}>
                                Confirm Payment
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

                .orders-list {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }

                .order-card {
                    background: var(--surface);
                    border: 1px solid var(--border);
                    border-radius: 12px;
                    padding: 20px;
                    transition: box-shadow 0.2s;
                }

                .order-card:hover {
                    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
                }

                .order-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 16px;
                }

                .order-title {
                    font-size: 18px;
                    font-weight: 600;
                    margin: 0 0 4px 0;
                    color: var(--text-primary);
                }

                .order-meta {
                    font-size: 14px;
                    color: var(--text-muted);
                    margin: 0;
                }

                .order-badge {
                    padding: 4px 12px;
                    border-radius: 100px;
                    font-size: 12px;
                    font-weight: 600;
                    color: white;
                }

                .order-details {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    margin-bottom: 16px;
                    padding: 12px;
                    background: var(--surface-alt);
                    border-radius: 8px;
                }

                .order-detail-row {
                    display: flex;
                    justify-content: space-between;
                    font-size: 14px;
                }

                .order-label {
                    color: var(--text-muted);
                }

                .order-value {
                    font-weight: 500;
                    color: var(--text-primary);
                }

                .order-actions {
                    display: flex;
                    gap: 12px;
                    flex-wrap: wrap;
                }

                .order-info-box {
                    width: 100%;
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
                    max-width: 500px;
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

                .modal-body p {
                    margin: 8px 0;
                }

                .modal-actions {
                    display: flex;
                    gap: 12px;
                    justify-content: flex-end;
                }
            `}</style>
        </>
    );
}
