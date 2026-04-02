import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/lib/stores';
import { apiFetch } from '@/lib/api';
import { loadStripe } from '@stripe/stripe-js';
import {
    CardNumberElement,
    CardExpiryElement,
    CardCvcElement,
    Elements,
    useStripe,
    useElements
} from '@stripe/react-stripe-js';
import GigModalInfo from '../components/GigModalInfo';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

// ── Payment Form ──────────────────────────────────────────────────────────────

function PaymentForm({ order, onSuccess, onError, onClose }) {
    const stripe = useStripe();
    const elements = useElements();
    const [processing, setProcessing] = useState(false);
    const [cardName, setCardName] = useState('');
    const [zipCode, setZipCode] = useState('');

    const SERVICE_FEE = 6.00; // Keep in sync with backend/config/fees.js
    const total = (parseFloat(order.gig.price) || 0) + SERVICE_FEE;

    async function handleSubmit(e) {
        e.preventDefault();
        if (!stripe || !elements) return;
        setProcessing(true);

        try {
            const response = await apiFetch('/api/payments/create-intent', {
                method: 'POST',
                body: JSON.stringify({
                    orderId: order.id,
                    amount: order.gig.price + SERVICE_FEE
                }),
            });

            const { clientSecret, error: intentError } = await response.json();
            console.log('🔍 Payment intent response:', { clientSecret, intentError });
            if (intentError) throw new Error(intentError);

            const { error: paymentError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
                payment_method: {
                    card: elements.getElement(CardNumberElement),
                    billing_details: {
                        name: cardName || order.buyer_email || 'Anonymous User',
                        email: order.buyer_email || '',
                        address: {
                            postal_code: zipCode || undefined,
                        },
                    },
                }
            });
            console.log('🔍 Stripe payment response:', { paymentError, paymentIntent });

            if (paymentError) throw new Error(paymentError.message);
            if (paymentIntent.status === 'succeeded') {
                console.log('✅ Payment succeeded:', paymentIntent);

                // Immediately update database via API (bypass webhook for now)
                try {
                    const confirmRes = await apiFetch('/api/payments/confirm', {
                        method: 'POST',
                        body: JSON.stringify({
                            orderId: order.id,
                            paymentIntentId: paymentIntent.id
                        }),
                    });
                    const confirmData = await confirmRes.json();
                    console.log('✅ Database updated:', confirmData);
                } catch (err) {
                    console.log('⚠️ Could not update database immediately:', err);
                }

                onSuccess('escrow_success');
            } else {
                console.log('⚠️ Payment not succeeded:', paymentIntent.status);
                throw new Error(`Payment status: ${paymentIntent.status}`);
            }
        } catch (error) {
            onError(error.message);
        } finally {
            setProcessing(false);
        }
    }

    const cardStyle = {
        style: {
            base: {
                fontSize: '15px',
                color: 'var(--text-primary, #1a1a1a)',
                fontFamily: 'inherit',
                '::placeholder': { color: '#b0a898' },
            },
            invalid: { color: '#ef4444' },
        }
    };

    return (
        <form onSubmit={handleSubmit}>

            {/* Order summary */}
            <div className="pf-summary">
                <div className="pf-summary-row">
                    <span className="pf-summary-label">Gig</span>
                    <span className="pf-summary-value">{order.gig.title}</span>
                </div>
                <div className="pf-summary-row">
                    <span className="pf-summary-label">Provider</span>
                    <Link
                        to={`/profile/${order.provider?.id}`}
                        className="pf-summary-value"
                        style={{ textDecoration: 'underline', color: 'var(--primary)' }}
                    >
                        {order.provider?.full_name ?? order.provider_email}
                    </Link>
                </div>
            </div>

            {/* Price breakdown */}
            <div className="pf-breakdown">
                <div className="pf-breakdown-row">
                    <span>Gig price</span>
                    <span>${parseFloat(order.gig.price).toFixed(2)}</span>
                </div>
                <div className="pf-breakdown-row">
                    <span>Service fee</span>
                    <span>${SERVICE_FEE.toFixed(2)}</span>
                </div>
                <div className="pf-breakdown-row pf-breakdown-total">
                    <span>Total due</span>
                    <span>${total.toFixed(2)}</span>
                </div>
            </div>

            {/* Card fields */}
            <div className="pf-card-section">
                <p className="pf-card-heading">Card details</p>

                <div className="pf-field-group">
                    <label className="pf-field-label">Card number</label>
                    <div className="pf-field-wrap">
                        <CardNumberElement options={cardStyle} />
                    </div>
                </div>

                <div className="pf-field-row">
                    <div className="pf-field-group">
                        <label className="pf-field-label">Expiry date</label>
                        <div className="pf-field-wrap">
                            <CardExpiryElement options={cardStyle} />
                        </div>
                    </div>
                    <div className="pf-field-group">
                        <label className="pf-field-label">CVC</label>
                        <div className="pf-field-wrap">
                            <CardCvcElement options={cardStyle} />
                        </div>
                    </div>
                </div>

                <div className="pf-field-group">
                    <label className="pf-field-label">Name on card</label>
                    <div className="pf-field-wrap">
                        <input
                            type="text"
                            placeholder="Jane Smith"
                            value={cardName}
                            onChange={e => setCardName(e.target.value)}
                            className="pf-plain-input"
                        />
                    </div>
                </div>

                <div className="pf-field-group">
                    <label className="pf-field-label">ZIP / Postal code</label>
                    <div className="pf-field-wrap">
                        <input
                            type="text"
                            placeholder="10001"
                            maxLength={5}
                            value={zipCode}
                            onChange={e => setZipCode(e.target.value)}
                            className="pf-plain-input"
                        />
                    </div>
                </div>

                <p className="pf-secure-note">🔒 Secured by Stripe. Funds held in escrow until job is complete.</p>
            </div>

            {/* Actions */}
            <div className="pf-actions">
                <button
                    type="submit"
                    className="btn btn-primary pf-pay-btn"
                    disabled={processing || !stripe}
                >
                    {processing
                        ? <><span className="pf-spinner" /> Processing…</>
                        : `Pay $${total.toFixed(2)}`
                    }
                </button>
                <button
                    type="button"
                    className="pf-cancel-btn"
                    onClick={onClose}
                    disabled={processing}
                >
                    Cancel
                </button>
            </div>

            <style>{`
                .pf-summary {
                    background: var(--color-background-tertiary, #f5f4f0);
                    border-radius: 10px;
                    padding: 14px 16px;
                    margin-bottom: 14px;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .pf-summary-row { display: flex; flex-direction: column; gap: 2px; }
                .pf-summary-label {
                    font-size: 11px;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.06em;
                    color: var(--text-muted, #a0998a);
                }
                .pf-summary-value {
                    font-size: 14px;
                    font-weight: 500;
                    color: var(--text-primary, #1a1a1a);
                }
                .pf-breakdown {
                    border: 1px solid var(--border, #e2e0d8);
                    border-radius: 10px;
                    overflow: hidden;
                    margin-bottom: 22px;
                    font-size: 14px;
                }
                .pf-breakdown-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 11px 14px;
                    color: var(--text-secondary, #5a5650);
                }
                .pf-breakdown-row + .pf-breakdown-row { border-top: 1px solid var(--border, #e2e0d8); }
                .pf-breakdown-total {
                    background: var(--color-background-tertiary, #f5f4f0);
                    font-weight: 700;
                    font-size: 15px;
                    color: var(--text-primary, #1a1a1a);
                }
                .pf-card-section { margin-bottom: 22px; }
                .pf-card-heading {
                    font-size: 13px;
                    font-weight: 600;
                    color: var(--text-primary, #1a1a1a);
                    margin: 0 0 14px;
                }
                .pf-field-group {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                    flex: 1;
                    margin-bottom: 12px;
                }
                .pf-field-group:last-of-type { margin-bottom: 0; }
                .pf-field-label {
                    font-size: 11px;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.06em;
                    color: var(--text-muted, #a0998a);
                }
                .pf-field-wrap {
                    border: 1.5px solid var(--border, #e2e0d8);
                    border-radius: 9px;
                    padding: 12px 14px;
                    background: #fff;
                    transition: border-color 0.15s, box-shadow 0.15s;
                    min-height: 44px;
                }
                .pf-field-wrap:focus-within {
                    border-color: var(--primary, #6c63ff);
                    box-shadow: 0 0 0 3px rgba(108,99,255,0.08);
                }
                .pf-field-wrap iframe {
                    pointer-events: auto !important;
                }
                .pf-plain-input {
                    border: none;
                    outline: none;
                    width: 100%;
                    font-size: 15px;
                    font-family: inherit;
                    color: #1a1a1a;
                    background: transparent;
                    padding: 0;
                    margin: 0;
                }
                .pf-plain-input::placeholder { color: #b0a898; }
                .pf-field-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 12px;
                    margin-bottom: 12px;
                }
                .pf-field-row .pf-field-group { margin-bottom: 0; }
                .pf-secure-note {
                    font-size: 12px;
                    color: var(--text-muted, #a0998a);
                    margin: 14px 0 0;
                    line-height: 1.5;
                }
                .pf-actions { display: flex; flex-direction: column; gap: 10px; }
                .pf-pay-btn {
                    width: 100%;
                    padding: 13px;
                    font-size: 15px;
                    font-weight: 600;
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    transition: opacity 0.15s, transform 0.12s;
                }
                .pf-pay-btn:not(:disabled):hover { opacity: 0.9; transform: translateY(-1px); }
                .pf-pay-btn:disabled { opacity: 0.45; cursor: not-allowed; }
                .pf-cancel-btn {
                    width: 100%;
                    padding: 11px;
                    background: transparent;
                    border: 1px solid var(--border, #e2e0d8);
                    border-radius: 10px;
                    font-size: 14px;
                    font-weight: 500;
                    color: var(--text-secondary, #5a5650);
                    cursor: pointer;
                    font-family: inherit;
                    transition: border-color 0.14s, color 0.14s;
                }
                .pf-cancel-btn:hover:not(:disabled) {
                    border-color: var(--text-secondary);
                    color: var(--text-primary, #1a1a1a);
                }
                .pf-cancel-btn:disabled { opacity: 0.4; cursor: not-allowed; }
                @keyframes pf-spin { to { transform: rotate(360deg); } }
                .pf-spinner {
                    width: 14px; height: 14px;
                    border: 2px solid rgba(255,255,255,0.35);
                    border-top-color: #fff;
                    border-radius: 50%;
                    animation: pf-spin 0.7s linear infinite;
                    flex-shrink: 0;
                }
            `}</style>
        </form>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MyOrders() {
    const user = useUser();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const [tab, setTab] = useState('buying');
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState('');
    const [toastType, setToastType] = useState('success');
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [showEscrowModal, setShowEscrowModal] = useState(false);

    // Info modal
    const [infoModal, setInfoModal] = useState(false);

    // Confirmation modals
    const [showWithdrawModal, setShowWithdrawModal] = useState(false);
    const [showDeliverModal, setShowDeliverModal] = useState(false);
    const [showReleaseFundsModal, setShowReleaseFundsModal] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [showBuyerCancelModal, setShowBuyerCancelModal] = useState(false);
    const [showDisputeModal, setShowDisputeModal] = useState(false);
    const [disputeReason, setDisputeReason] = useState('');
    const [pendingOrderId, setPendingOrderId] = useState(null);

    useEffect(() => {
        if (!user) { navigate('/login'); return; }
        loadOrders();
    }, [user, tab]);

    useEffect(() => {
        if (!user) return;
        const column = tab === 'buying' ? 'requester_id' : 'provider_id';
        const channel = supabase
            .channel(`my-orders-${user.id}-${tab}`)
            .on('postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'gig_requests', filter: `${column}=eq.${user.id}` },
                (payload) => {
                    setOrders(prev => prev.map(o =>
                        o.id === payload.new.id ? { ...o, ...payload.new } : o
                    ));
                }
            )
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [user, tab]);


    useEffect(() => {
        if (!user) return;


    }, []);

    async function loadOrders() {
        setLoading(true);
        const column = tab === 'buying' ? 'requester_id' : 'provider_id';
        const { data, error } = await supabase
            .from('gig_requests')
            .select(`
                *,
                gig:gigs(id, title, description, price, category, commitments, requirements),
                requester:profiles!requester_id(id, full_name),
                provider:profiles!provider_id(id, full_name)
            `)
            .eq(column, user.id)
            .order('created_at', { ascending: false });

        if (!error && data) {
            console.log('📦 Orders loaded:', data.map(o => ({ id: o.id, status: o.status, payment_status: o.payment_status })));
            setOrders(data);
            const payId = searchParams.get('pay');
            if (payId) {
                const target = data.find(o => o.id === payId);
                if (target && target.payment_status === 'unpaid') {
                    setSelectedOrder(target);
                    setShowPaymentModal(true);
                }
            }
        } else {
            console.error('❌ Error loading orders:', error);
        }
        setLoading(false);
    }

    async function handleAcceptOrder(order) {
        setSelectedOrder(order);
        setShowPaymentModal(true);
    }

    async function handleRespondToRequest(orderId, status) {
        try {
            const res = await apiFetch('/api/payments/respond', {
                method: 'POST',
                body: JSON.stringify({ orderId, status }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to respond');
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
            showToast(status === 'accepted' ? 'Request accepted!' : 'Request declined.');
        } catch (err) {
            showToast(err.message, 'error');
        }
    }

    function handleDispute(orderId) {
        setPendingOrderId(orderId);
        setDisputeReason('');
        setInfoModal(false);
        setShowDisputeModal(true);
    }

    async function confirmDispute() {
        if (!disputeReason.trim()) { showToast('Please describe the issue.', 'error'); return; }
        setShowDisputeModal(false);
        try {
            const res = await apiFetch('/api/payments/dispute', {
                method: 'POST',
                body: JSON.stringify({ orderId: pendingOrderId, reason: disputeReason }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to file dispute');
            showToast('Dispute filed. Support will review.', 'success');
            setDisputeReason('');
            setPendingOrderId(null);
            navigate('/disputes');
        } catch (err) {
            showToast(err.message, 'error');
        }
    }

    async function handleRefund(orderId) {
        setPendingOrderId(orderId);
        setInfoModal(false);
        setShowWithdrawModal(true);
    }

    async function confirmWithdraw() {
        setShowWithdrawModal(false);
        try {
            const res = await apiFetch('/api/payments/refund', {
                method: 'POST',
                body: JSON.stringify({ orderId: pendingOrderId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to process withdrawal');
            showToast('Withdrawal processed. Order marked as withdrawn.', 'success');
            loadOrders();
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setPendingOrderId(null);
        }
    }

    async function handleMarkDelivered(orderId) {
        setPendingOrderId(orderId);
        setShowDeliverModal(true);
    }

    async function confirmDeliver() {
        setShowDeliverModal(false);
        try {
            const res = await apiFetch('/api/payments/deliver', {
                method: 'POST',
                body: JSON.stringify({ orderId: pendingOrderId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to mark as delivered');
            showToast('Services marked as delivered!', 'success');
            loadOrders();
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setPendingOrderId(null);
        }
    }

    async function handleReleaseFunds(orderId) {
        setPendingOrderId(orderId);
        setShowReleaseFundsModal(true);
    }

    async function confirmReleaseFunds() {
        setShowReleaseFundsModal(false);
        try {
            const res = await apiFetch('/api/payments/release', {
                method: 'POST',
                body: JSON.stringify({ orderId: pendingOrderId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to release payment');
            showToast('Payment released to provider!', 'success');
            loadOrders();
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setPendingOrderId(null);
        }
    }

    async function handleRevertDelivery(orderId) {
        const { error } = await supabase
            .from('gig_requests')
            .update({ status: 'accepted', provider_completed: false })
            .eq('id', orderId)
            .eq('provider_id', user.id);
        if (error) { showToast(error.message, 'error'); return; }
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'accepted', provider_completed: false } : o));
        showToast('Delivery reverted. Order back to accepted.');
    }

    function handleBuyerCancel(orderId) {
        setPendingOrderId(orderId);
        setShowBuyerCancelModal(true);
    }

    async function confirmBuyerCancel() {
        setShowBuyerCancelModal(false);
        try {
            const res = await apiFetch('/api/payments/buyer-cancel', {
                method: 'POST',
                body: JSON.stringify({ orderId: pendingOrderId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to cancel order');
            showToast('Order cancelled.', 'success');
            loadOrders();
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setPendingOrderId(null);
        }
    }

    function handleCancelOrder(orderId) {
        setPendingOrderId(orderId);
        setShowCancelModal(true);
    }

    async function confirmCancelOrder() {
        setShowCancelModal(false);
        try {
            const res = await apiFetch('/api/payments/cancel', {
                method: 'POST',
                body: JSON.stringify({ orderId: pendingOrderId, reason: 'Cancelled by seller' }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to cancel order');
            showToast('Order cancelled.', 'success');
            loadOrders();
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setPendingOrderId(null);
        }
    }

    function showToast(msg, type = 'success') {
        setToast(msg); setToastType(type);
        setTimeout(() => setToast(''), 3500);
    }

    function getStatusBadge(order) {
        const { status, payment_status } = order;
        if (status === 'withdrawn' || payment_status === 'withdrawn') return { text: 'Withdrawn', color: '#6b7280' };
        if (payment_status === 'refunded') return { text: 'Refunded', color: '#6b7280' };
        if (payment_status === 'disputed') return { text: 'Disputed', color: '#ef4444' };
        if (payment_status === 'cleared') return { text: 'Cleared', color: '#10b981' };
        if (payment_status === 'released') return { text: 'Pending Clearance', color: '#b45309' };
        if (status === 'cancelled') return { text: 'Cancelled', color: '#6b7280' };
        if (payment_status === 'escrowed' && status === 'delivered') return { text: 'Review Pending', color: '#f59e0b' };
        if (payment_status === 'escrowed') return { text: 'In Progress', color: '#3b82f6' };
        if (status === 'pending') return { text: 'Waiting for seller to accept', color: '#6b7280' };
        if (status === 'accepted') return { text: 'Awaiting Payment', color: '#6b7280' };
        return { text: status, color: '#6b7280' };
    }

    function getDaysUntilAutoRelease(order) {
        if (!order.auto_release_date) return null;
        const diffMs = new Date(order.auto_release_date) - new Date();
        const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        return days > 0 ? days : 0;
    }

    return (
        <>
            <title>My Orders — SkillJoy</title>

            <div className="page">

                {/* Header */}
                <div className="mo-hero">
                    <div>
                        <h1 className="page-title">My Orders</h1>
                        <p className="page-subtitle" style={{ color: '#000' }}>Track your gig orders and payments</p>
                    </div>
                    <button
                        className="btn btn-secondary"
                        style={{ backgroundColor: '#fff', border: '1px solid #000', alignSelf: 'flex-start' }}
                        onClick={() => navigate('/gigs')}
                    >
                        ← Back to Gigs
                    </button>

                    {/* Tabs — Buying first, then Listing */}
                    <div className="tabs" style={{ border: '1px solid #000', backgroundColor: '#ec9146' }}>
                        <button className={`tab ${tab === 'buying' ? 'active' : ''}`} onClick={() => setTab('buying')}>
                            Buying
                        </button>
                        <button className={`tab ${tab === 'selling' ? 'active' : ''}`} onClick={() => setTab('selling')}>
                            Listing
                        </button>
                    </div>
                </div>

                {/* Orders */}
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
                        <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
                    </div>
                ) : orders.length === 0 ? (
                    <div className="empty-state">
                        <span className="empty-icon">📦</span>
                        <h3>No orders yet</h3>
                        <p style={{color: '#fff'}}>Your {tab === 'buying' ? 'purchases' : 'sales'} will appear here.</p>
                        <button className="btn btn-primary" onClick={() => navigate('/gigs')} style={{ marginTop: 16 }}>
                            Browse Gigs
                        </button>
                    </div>
                ) : (
                    <div className="mo-list">
                        {orders.map(order => {
                            const badge = getStatusBadge(order);
                            const daysLeft = getDaysUntilAutoRelease(order);
                            const isBuyer = tab === 'buying';
                            const otherUser = isBuyer ? order.provider : order.requester;

                            return (
                                <div key={order.id} className="mo-card">
                                    <div className="mo-card-header">
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div className="mo-card-top">
                                                {order.gig.category && (
                                                    <span className="mo-category-tag">{order.gig.category}</span>
                                                )}
                                                <span className="mo-order-id">#{order.id.slice(0, 8)}</span>
                                            </div>
                                            <h3 className="mo-card-title">{order.gig.title}</h3>
                                            <p className="mo-card-meta">
                                                {isBuyer ? 'Provider' : 'Buyer'}: <strong>{otherUser?.full_name ?? '—'}</strong>
                                            </p>
                                        </div>
                                        <span className="mo-badge" style={{ background: badge.color }}>
                                            {badge.text}
                                        </span>
                                    </div>

                                    <div className="mo-details">
                                        <div className="mo-detail-row">
                                            <span>Amount</span>
                                            <span style={{ fontWeight: 700, color: '#111' }}>${(order.payment_amount ?? order.gig.price)?.toFixed(2)}</span>
                                        </div>
                                        <div className="mo-detail-row">
                                            <span>Ordered</span>
                                            <span>{new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                        </div>
                                        {order.escrow_date && (
                                            <div className="mo-detail-row">
                                                <span>Payment secured</span>
                                                <span>{new Date(order.escrow_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                            </div>
                                        )}
                                        {daysLeft !== null && order.payment_status === 'escrowed' && (
                                            <div className="mo-detail-row">
                                                <span>Auto-releases in</span>
                                                <span style={{ color: '#f59e0b', fontWeight: 600 }}>
                                                    {daysLeft} day{daysLeft !== 1 ? 's' : ''}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="mo-actions">
                                        {/* NEXT STEP INDICATORS */}

                                        {/* Buyer: waiting for seller to accept */}
                                        {isBuyer && order.status === 'pending' && (
                                            <>
                                                <div className="mo-next-step mo-next-step-waiting">
                                                    <span className="mo-next-step-icon">⏳</span>
                                                    <span>Waiting for seller to accept your request...</span>
                                                </div>
                                                <button className="btn btn-danger" onClick={() => handleBuyerCancel(order.id)}>
                                                    Cancel Request
                                                </button>
                                            </>
                                        )}

                                        {/* Buyer: needs to pay */}
                                        {isBuyer && order.status === 'accepted' && order.payment_status === 'unpaid' && (
                                            <>
                                                <div className="mo-next-step">
                                                    <span className="mo-next-step-icon">💳</span>
                                                    <span>Next: Pay to start the work</span>
                                                </div>
                                                <button className="btn btn-primary" onClick={() => handleAcceptOrder(order)}>
                                                    Accept & Pay
                                                </button>
                                                <button className="btn btn-danger" onClick={() => handleBuyerCancel(order.id)}>
                                                    Cancel Order
                                                </button>
                                                <div style={{ marginTop: 10, padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: 12, color: '#92400e', lineHeight: 1.5 }}>
                                                    ⚠️ Please ensure you have properly vetted and communicated with the seller before purchasing their services. SkillJoy is not responsible for any injury, loss, or damages arising from communications or transactions between freelancers and clients.
                                                </div>
                                            </>
                                        )}

                                        {/* Buyer: payment processing */}
                                        {isBuyer && order.payment_status === 'paid' && (
                                            <div className="mo-next-step mo-next-step-waiting">
                                                <span className="mo-next-step-icon">⏳</span>
                                                <span>Payment processing...</span>
                                            </div>
                                        )}

                                        {/* Buyer: waiting for provider to start work */}
                                        {isBuyer && order.payment_status === 'escrowed' && order.status === 'accepted' && (
                                            <div className="mo-next-step mo-next-step-waiting">
                                                <span className="mo-next-step-icon">⏳</span>
                                                <span>Payment received! Waiting for provider to start work...</span>
                                            </div>
                                        )}

                                        {/* Buyer: waiting for delivery */}
                                        {isBuyer && order.payment_status === 'escrowed' && order.status === 'in_progress' && (
                                            <>
                                                <div className="mo-next-step mo-next-step-waiting">
                                                    <span className="mo-next-step-icon">🔨</span>
                                                    <span>Provider is working on your order...</span>
                                                </div>
                                                {order.payment_status !== 'disputed' && (
                                                    <button className="btn btn-outline-danger" onClick={() => handleDispute(order.id)}>
                                                        Report Issue
                                                    </button>
                                                )}
                                            </>
                                        )}

                                        {/* Buyer: review delivered work */}
                                        {isBuyer && order.payment_status === 'escrowed' && order.status === 'delivered' && (
                                            <>
                                                <div className="mo-next-step mo-next-step-action">
                                                    <span className="mo-next-step-icon">✅</span>
                                                    <span>Work delivered! Review and release payment</span>
                                                </div>
                                                <button className="btn btn-primary" onClick={() => handleReleaseFunds(order.id)}>
                                                    Release Funds
                                                </button>
                                                {order.payment_status !== 'disputed' && (
                                                    <button className="btn btn-secondary" onClick={() => handleDispute(order.id)}>
                                                        File Dispute
                                                    </button>
                                                )}
                                            </>
                                        )}

                                        {/* SELLER INDICATORS */}

                                        {/* Seller: pending — needs to accept or decline */}
                                        {!isBuyer && order.status === 'pending' && (
                                            <>
                                                <div className="mo-next-step mo-next-step-action">
                                                    <span className="mo-next-step-icon">📥</span>
                                                    <span><strong>New request!</strong> Accept or decline this order</span>
                                                </div>
                                                <button className="btn btn-primary" onClick={() => handleRespondToRequest(order.id, 'accepted')}>
                                                    Accept
                                                </button>
                                                <button className="btn btn-danger" onClick={() => handleRespondToRequest(order.id, 'declined')}>
                                                    Decline
                                                </button>
                                            </>
                                        )}

                                        {/* Seller: waiting for buyer payment */}
                                        {!isBuyer && order.status === 'accepted' && order.payment_status !== 'escrowed' && (
                                            <>
                                                <div className="mo-next-step mo-next-step-waiting">
                                                    <span className="mo-next-step-icon">💰</span>
                                                    <span>Waiting for buyer to submit payment...</span>
                                                </div>
                                                <button className="btn btn-danger" onClick={() => handleCancelOrder(order.id)}>
                                                    Cancel Order
                                                </button>
                                            </>
                                        )}

                                        {/* Seller: payment received, start work */}
                                        {!isBuyer && order.payment_status === 'escrowed' && order.status === 'accepted' && (
                                            <>
                                                <div className="mo-next-step mo-next-step-action">
                                                    <span className="mo-next-step-icon">💵</span>
                                                    <span><strong>Payment received!</strong> Start working on this order</span>
                                                </div>
                                                <button className="btn btn-primary" onClick={() => handleMarkDelivered(order.id)}>
                                                    Services Delivered
                                                </button>
                                                <button className="btn btn-danger" onClick={() => handleCancelOrder(order.id)}>
                                                    Cancel Order
                                                </button>
                                            </>
                                        )}

                                        {/* Seller: working on order */}
                                        {!isBuyer && order.payment_status === 'escrowed' && order.status === 'in_progress' && (
                                            <>
                                                <div className="mo-next-step">
                                                    <span className="mo-next-step-icon">🔨</span>
                                                    <span>Working... Deliver when complete</span>
                                                </div>
                                                <button className="btn btn-primary" onClick={() => handleMarkDelivered(order.id)}>
                                                    Services Delivered
                                                </button>
                                                <button className="btn btn-danger" onClick={() => handleCancelOrder(order.id)}>
                                                    Cancel Order
                                                </button>
                                            </>
                                        )}

                                        {/* Seller: delivered, waiting for approval */}
                                        {!isBuyer && order.payment_status === 'escrowed' && order.status === 'delivered' && (
                                            <>
                                                <div className="mo-next-step mo-next-step-waiting">
                                                    <span className="mo-next-step-icon">📦</span>
                                                    <span>Delivered! Waiting for buyer approval...</span>
                                                </div>
                                                <button className="btn btn-secondary" onClick={() => handleRevertDelivery(order.id)}>
                                                    Revert Delivery
                                                </button>
                                            </>
                                        )}

                                        {/* Seller: pending clearance */}
                                        {!isBuyer && order.payment_status === 'released' && order.clearance_date && (
                                            <div className="mo-success-note" style={{ background: '#fffbeb', color: '#92400e' }}>
                                                🕐 Pending clearance — funds available {new Date(order.clearance_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ({Math.max(0, Math.ceil((new Date(order.clearance_date) - Date.now()) / (1000 * 60 * 60 * 24)))}d left)
                                            </div>
                                        )}

                                        {/* Seller: cleared */}
                                        {!isBuyer && order.payment_status === 'cleared' && (
                                            <div className="mo-success-note">
                                                ✓ Funds cleared and sent to your Stripe account.
                                            </div>
                                        )}

                                        {/* Seller: dispute refunded to buyer */}
                                        {!isBuyer && order.payment_status === 'refunded' && (
                                            <div className="mo-success-note" style={{ background: '#fef2f2', color: '#991b1b' }}>
                                                ✗ Dispute resolved — payment was refunded to the buyer.
                                            </div>
                                        )}

                                        {/* Both: order under dispute review */}
                                        {order.status === 'disputed' && order.payment_status === 'disputed' && (
                                            <div className="mo-next-step mo-next-step-waiting" style={{ background: '#fef2f2', borderColor: '#fca5a5', color: '#991b1b' }}>
                                                <span className="mo-next-step-icon">⚠️</span>
                                                <span>Dispute under review. <button className="btn-link" onClick={() => navigate('/disputes')}>View dispute</button></span>
                                            </div>
                                        )}

                                        {/* Buyer: refunded after dispute */}
                                        {isBuyer && order.payment_status === 'refunded' && (
                                            <div className="mo-success-note" style={{ background: '#f0fdf4', color: '#166534' }}>
                                                ✓ Dispute resolved — full refund has been issued.
                                            </div>
                                        )}

                                        {/* Buyer: withdrawn (seller cancel) */}
                                        {isBuyer && (order.status === 'withdrawn' || order.payment_status === 'withdrawn') && order.payment_status !== 'refunded' && (
                                            <div className="mo-success-note" style={{ background: '#f3f4f6', color: '#4b5563' }}>
                                                ✓ Order withdrawn. Payment has been returned.
                                            </div>
                                        )}

                                        <button
                                            className="btn btn-secondary"
                                            style={{ color: '#fff', fontWeight: 'bold', backgroundColor: '#ec9146' }}
                                            onClick={() => { setSelectedOrder(order); setInfoModal(true); }}>
                                            View Details
                                        </button>
                                        {order.status !== 'pending' && (
                                            <button className="btn btn-secondary" onClick={() => navigate(`/chat?gig=${order.gig.id}`)}>
                                                View Chat
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Payment modal */}
            {showPaymentModal && selectedOrder && (
                <div className="modal-backdrop" onClick={() => setShowPaymentModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
                        <button className="modal-close" onClick={() => setShowPaymentModal(false)}>✕</button>
                        <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 20px' }}>Accept Order & Pay</h2>
                        <Elements stripe={stripePromise}>
                            <PaymentForm
                                order={selectedOrder}
                                onSuccess={msg => {
                                    if (msg === 'escrow_success') {
                                        setShowPaymentModal(false);
                                        setShowEscrowModal(true);
                                        // Update the order in the list directly
                                        setOrders(prev => prev.map(o =>
                                            o.id === selectedOrder?.id
                                                ? { ...o, payment_status: 'escrowed', status: 'accepted' }
                                                : o
                                        ));
                                        // Refresh from database
                                        loadOrders();
                                        setTimeout(() => loadOrders(), 2000);
                                    } else {
                                        showToast(msg, 'success');
                                        setShowPaymentModal(false);
                                        loadOrders();
                                    }
                                }}
                                onError={msg => showToast(msg, 'error')}
                                onClose={() => setShowPaymentModal(false)}
                            />
                        </Elements>
                    </div>
                </div>
            )}

            {/* Escrow Success Modal */}
            {showEscrowModal && selectedOrder && (
                <div className="modal-backdrop" onClick={() => setShowEscrowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
                        <button className="modal-close" onClick={() => setShowEscrowModal(false)}>✕</button>

                        <div style={{ textAlign: 'center', padding: '10px 0 20px' }}>
                            <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
                            <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px', color: '#166534' }}>
                                Payment Secured in Escrow
                            </h2>
                            <p style={{ color: '#6b7280', margin: 0, fontSize: 14 }}>
                                Your funds are safely held until the job is complete
                            </p>
                        </div>

                        <div className="escrow-info-box">
                            <h3>What happens next?</h3>
                            <ol>
                                <li><strong>Connect with your provider</strong> — Use the chat to discuss requirements, timeline, and deliverables</li>
                                <li><strong>Provider completes the work</strong> — They'll mark it as delivered when done</li>
                                <li><strong>Review & approve</strong> — You have 3 days to review the work</li>
                            </ol>
                        </div>

                        <div className="escrow-options">
                            <div className="escrow-option escrow-option-success">
                                <span className="escrow-option-icon">✅</span>
                                <div>
                                    <strong>Happy with the work?</strong>
                                    <p>Release payment to the provider</p>
                                </div>
                            </div>
                            <div className="escrow-option escrow-option-warning">
                                <span className="escrow-option-icon">⚠️</span>
                                <div>
                                    <strong>Issues with the work?</strong>
                                    <p>File a dispute and our team will review</p>
                                </div>
                            </div>
                            <div className="escrow-option escrow-option-danger">
                                <span className="escrow-option-icon">💸</span>
                                <div>
                                    <strong>Need to cancel?</strong>
                                    <p>Request a refund before work begins</p>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
                            <button
                                className="btn btn-primary"
                                style={{ flex: 1, minWidth: 140 }}
                                onClick={() => {
                                    setShowEscrowModal(false);
                                    navigate(`/chat?gig=${selectedOrder.gig.id}`);
                                }}
                            >
                                Chat with Provider
                            </button>
                            <button
                                className="btn btn-secondary"
                                style={{ flex: 1, minWidth: 140 }}
                                onClick={() => setShowEscrowModal(false)}
                            >
                                View Orders
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {toast && <div className={`toast ${toastType}`}>{toast}</div>}

            {/* Withdraw Confirmation Modal */}
            {showWithdrawModal && (
                <div className="modal-backdrop" onClick={() => setShowWithdrawModal(false)}>
                    <div className="modal confirm-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
                        <div className="confirm-modal-icon">⚠️</div>
                        <h2 className="confirm-modal-title">Withdraw Order?</h2>
                        <p className="confirm-modal-body">
                            This will <strong>cancel the order</strong> and return your payment. Once withdrawn, this cannot be undone.
                        </p>
                        <div className="confirm-modal-actions">
                            <button className="btn btn-secondary" onClick={() => setShowWithdrawModal(false)}>
                                Cancel
                            </button>
                            <button className="btn btn-danger" onClick={confirmWithdraw}>
                                Yes, Withdraw
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Services Delivered Confirmation Modal */}
            {showDeliverModal && (
                <div className="modal-backdrop" onClick={() => setShowDeliverModal(false)}>
                    <div className="modal confirm-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
                        <div className="confirm-modal-icon">📦</div>
                        <h2 className="confirm-modal-title">Mark as Delivered?</h2>
                        <p className="confirm-modal-body">
                            <strong>Only deliver services when it's complete.</strong>
                        </p>
                        <p className="confirm-modal-sub">
                            The buyer will be notified and asked to review and release funds.
                        </p>
                        <div className="confirm-modal-actions">
                            <button className="btn btn-secondary" onClick={() => setShowDeliverModal(false)}>
                                Cancel
                            </button>
                            <button className="btn btn-primary" onClick={confirmDeliver}>
                                Confirm Delivery
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Release Funds Confirmation Modal */}
            {showReleaseFundsModal && (
                <div className="modal-backdrop" onClick={() => setShowReleaseFundsModal(false)}>
                    <div className="modal confirm-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
                        <div className="confirm-modal-icon">💸</div>
                        <h2 className="confirm-modal-title">Release Funds?</h2>
                        <p className="confirm-modal-body">
                            <strong>Only release funds once you've received the service.</strong>
                        </p>
                        <p className="confirm-modal-sub">
                            This will release payment to the provider and complete the order. This cannot be undone.
                        </p>
                        <div className="confirm-modal-actions">
                            <button className="btn btn-secondary" onClick={() => setShowReleaseFundsModal(false)}>
                                Cancel
                            </button>
                            <button className="btn btn-primary" onClick={confirmReleaseFunds}>
                                Release Funds
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Dispute Modal */}
            {showDisputeModal && (
                <div className="modal-backdrop" onClick={() => setShowDisputeModal(false)}>
                    <div className="modal confirm-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
                        <button className="modal-close" onClick={() => setShowDisputeModal(false)}>✕</button>
                        <div className="confirm-modal-icon">⚠️</div>
                        <h2 className="confirm-modal-title">File a Dispute</h2>
                        <p className="confirm-modal-body">Describe the issue. Our support team will review and mediate.</p>
                        <textarea
                            value={disputeReason}
                            onChange={e => setDisputeReason(e.target.value)}
                            placeholder="Describe the issue in detail..."
                            rows={4}
                            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, resize: 'vertical', marginBottom: 16, boxSizing: 'border-box' }}
                        />
                        <div className="confirm-modal-actions">
                            <button className="btn btn-secondary" onClick={() => setShowDisputeModal(false)}>Cancel</button>
                            <button className="btn btn-danger" onClick={confirmDispute}>Submit Dispute</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Cancel Order Confirmation Modal */}
            {showCancelModal && (
                <div className="modal-backdrop" onClick={() => setShowCancelModal(false)}>
                    <div className="modal confirm-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
                        <div className="confirm-modal-icon">🚫</div>
                        <h2 className="confirm-modal-title">Cancel Order?</h2>
                        <p className="confirm-modal-body">
                            This will <strong>cancel the order</strong>. If the buyer already paid, their payment will be fully refunded.
                        </p>
                        <p className="confirm-modal-sub">This cannot be undone.</p>
                        <div className="confirm-modal-actions">
                            <button className="btn btn-secondary" onClick={() => setShowCancelModal(false)}>
                                Go Back
                            </button>
                            <button className="btn btn-danger" onClick={confirmCancelOrder}>
                                Yes, Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Buyer Cancel Confirmation Modal */}
            {showBuyerCancelModal && (
                <div className="modal-backdrop" onClick={() => setShowBuyerCancelModal(false)}>
                    <div className="modal confirm-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
                        <div className="confirm-modal-icon">🚫</div>
                        <h2 className="confirm-modal-title">Cancel Order?</h2>
                        <p className="confirm-modal-body">
                            This will <strong>cancel your order request</strong>. The seller will be notified.
                        </p>
                        <p className="confirm-modal-sub">This cannot be undone.</p>
                        <div className="confirm-modal-actions">
                            <button className="btn btn-secondary" onClick={() => setShowBuyerCancelModal(false)}>
                                Go Back
                            </button>
                            <button className="btn btn-danger" onClick={confirmBuyerCancel}>
                                Yes, Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Order Info Modal */}
            {infoModal && selectedOrder && (
                <GigModalInfo
                    order={selectedOrder}
                    isOpen={infoModal}
                    onClose={() => setInfoModal(false)}
                    isBuyer={tab === 'buying'}
                    onWithdraw={tab === 'buying' ? handleRefund : null}
                    onRefund={tab === 'buying' ? handleRefund : null}
                    onDispute={tab === 'buying' ? handleDispute : null}
                />
            )}

            <style>{`
                .confirm-modal { text-align: center; padding: 32px 28px 24px; }
                .confirm-modal-icon { font-size: 40px; margin-bottom: 12px; }
                .confirm-modal-title { font-size: 20px; font-weight: 700; margin: 0 0 12px; }
                .confirm-modal-body { font-size: 15px; color: #374151; margin: 0 0 6px; line-height: 1.5; }
                .confirm-modal-sub { font-size: 13px; color: #6b7280; margin: 0 0 24px; line-height: 1.5; }
                .confirm-modal-actions { display: flex; gap: 12px; justify-content: center; }
                .confirm-modal-actions .btn { min-width: 130px; }
                .btn-danger {
                    background: #ef4444;
                    color: #fff;
                    border: none;
                    padding: 13px 28px;
                    border-radius: 8px;
                    font-size: 15px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: background 0.15s;
                }
                .btn-danger:hover { background: #dc2626; }
                .mo-hero {
                    background: #f0ede8;
                    padding: 24px;
                    border-radius: 16px;
                    margin-bottom: 24px;
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }

                .mo-list {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }

                .mo-card {
                    background: var(--surface);
                    border: 1px solid var(--border);
                    border-radius: 12px;
                    padding: 20px;
                    transition: box-shadow 0.2s;
                }
                .mo-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); }

                .mo-card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 14px;
                    gap: 12px;
                }
                .mo-card-top {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 6px;
                }
                .mo-category-tag {
                    font-size: 11px;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                    background: #f0ede8;
                    color: #6b5e4e;
                    padding: 2px 8px;
                    border-radius: 100px;
                    border: 1px solid #e2d9ce;
                }
                .mo-order-id {
                    font-size: 11px;
                    color: var(--text-muted);
                    font-family: monospace;
                }
                .mo-card-title {
                    font-size: 17px;
                    font-weight: 600;
                    margin: 0 0 4px;
                    color: var(--text-primary);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .mo-card-meta {
                    font-size: 13px;
                    color: var(--text-muted);
                    margin: 0;
                }
                .mo-badge {
                    padding: 4px 12px;
                    border-radius: 100px;
                    font-size: 12px;
                    font-weight: 600;
                    color: #fff;
                    white-space: nowrap;
                    flex-shrink: 0;
                }

                .mo-details {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    padding: 12px 14px;
                    background: var(--surface-alt);
                    border-radius: 9px;
                    margin-bottom: 16px;
                    font-size: 14px;
                }
                .mo-detail-row {
                    display: flex;
                    justify-content: space-between;
                }
                .mo-detail-row span:first-child { color: var(--text-muted); }
                .mo-detail-row span:last-child { font-weight: 500; color: var(--text-primary); }

                .mo-actions {
                    display: flex;
                    gap: 10px;
                    flex-wrap: wrap;
                    align-items: center;
                }

                .btn-link {
                    background: none; border: none; padding: 0;
                    color: #991b1b; font-weight: 600; cursor: pointer;
                    font-size: inherit; text-decoration: underline;
                }
                .btn-link:hover { color: #7f1d1d; }

                .btn-outline-danger {
                    background: transparent;
                    border: 1px solid #ef4444;
                    color: #ef4444;
                    padding: 8px 16px;
                    border-radius: 8px;
                    font-size: 13px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.15s;
                }
                .btn-outline-danger:hover {
                    background: #fef2f2;
                    border-color: #dc2626;
                    color: #dc2626;
                }

                .mo-success-note {
                    flex: 1;
                    padding: 10px 14px;
                    background: #d1fae5;
                    border-radius: 8px;
                    font-size: 13px;
                    font-weight: 500;
                    color: #065f46;
                }

                .mo-next-step {
                    width: 100%;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 12px 14px;
                    background: #f0f9ff;
                    border: 1px solid #bae6fd;
                    border-radius: 8px;
                    font-size: 13px;
                    color: #0369a1;
                    margin-bottom: 8px;
                }
                .mo-next-step-icon {
                    font-size: 18px;
                    flex-shrink: 0;
                }
                .mo-next-step-waiting {
                    background: #fefce8;
                    border-color: #fde047;
                    color: #a16207;
                }
                .mo-next-step-action {
                    background: #f0fdf4;
                    border-color: #86efac;
                    color: #166534;
                }

                /* Escrow Modal Styles */
                .escrow-info-box {
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 10px;
                    padding: 16px;
                    margin-bottom: 16px;
                }
                .escrow-info-box h3 {
                    font-size: 14px;
                    font-weight: 600;
                    margin: 0 0 12px;
                    color: #1e293b;
                }
                .escrow-info-box ol {
                    margin: 0;
                    padding-left: 20px;
                    font-size: 13px;
                    color: #475569;
                    line-height: 1.6;
                }
                .escrow-info-box li {
                    margin-bottom: 8px;
                }
                .escrow-info-box li:last-child {
                    margin-bottom: 0;
                }
                .escrow-options {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                .escrow-option {
                    display: flex;
                    align-items: flex-start;
                    gap: 12px;
                    padding: 12px 14px;
                    border-radius: 8px;
                    font-size: 13px;
                }
                .escrow-option-icon {
                    font-size: 18px;
                    flex-shrink: 0;
                }
                .escrow-option strong {
                    display: block;
                    margin-bottom: 2px;
                }
                .escrow-option p {
                    margin: 0;
                    opacity: 0.8;
                }
                .escrow-option-success {
                    background: #f0fdf4;
                    border: 1px solid #bbf7d0;
                    color: #166534;
                }
                .escrow-option-warning {
                    background: #fffbeb;
                    border: 1px solid #fde68a;
                    color: #92400e;
                }
                .escrow-option-danger {
                    background: #fef2f2;
                    border: 1px solid #fecaca;
                    color: #991b1b;
                }

                @media (max-width: 768px) {
                    .mo-hero { padding: 16px; }
                    .mo-card { padding: 14px; }
                    .mo-card-title { white-space: normal; font-size: 15px; }
                    .mo-actions { flex-direction: column; align-items: stretch; }
                    .mo-actions .btn,
                    .mo-actions .btn-danger,
                    .mo-actions .btn-outline-danger { width: 100%; }
                    .mo-success-note { width: 100%; box-sizing: border-box; }
                    .confirm-modal { padding: 24px 16px 20px; }
                    .confirm-modal-actions { flex-direction: column-reverse; }
                    .confirm-modal-actions .btn { width: 100%; min-width: unset; }
                }
            `}</style>
        </>
    );
}