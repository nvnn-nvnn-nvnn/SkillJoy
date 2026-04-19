import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useUser, useAuth } from '@/lib/stores';
import { apiFetch } from '@/lib/api';

const ADMIN_EMAIL = 'techkage@proton.me';

const STATUS_COLORS = {
    escrowed:    { bg: '#fffbeb', color: '#92400e', border: '#fde68a' },
    released:    { bg: '#f0fdf4', color: '#166534', border: '#86efac' },
    disputed:    { bg: '#fef2f2', color: '#991b1b', border: '#fca5a5' },
    refunded:    { bg: '#f3f4f6', color: '#374151', border: '#d1d5db' },
    withdrawn:   { bg: '#f3f4f6', color: '#374151', border: '#d1d5db' },
    pending:     { bg: '#f0f9ff', color: '#075985', border: '#bae6fd' },
    unpaid:      { bg: '#f0f9ff', color: '#075985', border: '#bae6fd' },
    completed:   { bg: '#f0fdf4', color: '#166534', border: '#86efac' },
    delivered:   { bg: '#faf5ff', color: '#6b21a8', border: '#d8b4fe' },
    accepted:    { bg: '#eff6ff', color: '#1e40af', border: '#bfdbfe' },
    in_progress: { bg: '#eff6ff', color: '#1e40af', border: '#bfdbfe' },
    declined:    { bg: '#fef2f2', color: '#991b1b', border: '#fca5a5' },
    cancelled:   { bg: '#fef2f2', color: '#991b1b', border: '#fca5a5' },
    chargebacked:    { bg: '#fdf2f8', color: '#86198f', border: '#f0abfc' },
    chargeback_won:  { bg: '#f0fdf4', color: '#166534', border: '#86efac' },
    chargeback_lost: { bg: '#fef2f2', color: '#991b1b', border: '#fca5a5' },
};

function StatusChip({ value }) {
    const s = STATUS_COLORS[value] ?? { bg: '#f0ede8', color: '#6b5e4e', border: '#e2d9ce' };
    return (
        <span style={{
            fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 100,
            background: s.bg, color: s.color, border: `1px solid ${s.border}`,
            textTransform: 'capitalize', whiteSpace: 'nowrap',
            letterSpacing: '0.02em',
        }}>
            {value?.replace(/_/g, ' ') ?? '—'}
        </span>
    );
}

function initials(name) {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function AdminPage() {
    const user = useUser();
    const { loading: authLoading } = useAuth();
    const navigate = useNavigate();

    const [orders, setOrders] = useState([]);
    const [disputes, setDisputes] = useState([]);
    const [users, setUsers] = useState([]);
    const [gigs, setGigs] = useState([]);
    const [finances, setFinances] = useState(null);
    const [financesLoading, setFinancesLoading] = useState(false);
    const [reports, setReports] = useState([]);
    const [reportsLoading, setReportsLoading] = useState(false);
    const [tab, setTab] = useState('disputes');
    const [removeGigId, setRemoveGigId] = useState(null);
    const [removeReason, setRemoveReason] = useState('');
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState('');
    const [toastType, setToastType] = useState('success');

    // Auth guard + initial full load
    useEffect(() => {
        if (authLoading) return;
        if (!user) { navigate('/login'); return; }
        if (user.email !== ADMIN_EMAIL) { navigate('/'); return; }
        loadAll();
        loadReports(); // seed badge count immediately
    }, [user, authLoading]);

    // Refresh active tab's data whenever the tab changes
    useEffect(() => {
        if (!user || user.email !== ADMIN_EMAIL || authLoading) return;
        if (tab === 'orders')    loadOrders();
        if (tab === 'disputes')  loadDisputes();
        if (tab === 'users')     loadUsers();
        if (tab === 'gigs')      loadGigs();
        if (tab === 'finances')  loadFinances();
        if (tab === 'reports')   loadReports();
    }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

    async function loadOrders() {
        const { data } = await supabase
            .from('gig_requests')
            .select(`*, gig:gigs(id, title, price), requester:profiles!requester_id(id, full_name), provider:profiles!provider_id(id, full_name)`)
            .order('created_at', { ascending: false })
            .limit(100);
        if (data) setOrders(data);
    }

    async function loadDisputes() {
        const { data } = await supabase
            .from('gig_requests')
            .select(`*, gig:gigs(id, title), requester:profiles!requester_id(id, full_name), provider:profiles!provider_id(id, full_name)`)
            .eq('payment_status', 'disputed')
            .order('dispute_date', { ascending: false });
        if (data) setDisputes(data);
    }

    async function loadUsers() {
        const { data } = await supabase
            .from('profiles')
            .select('id, full_name, created_at')
            .order('created_at', { ascending: false })
            .limit(100);
        if (data) setUsers(data);
    }

    async function loadGigs() {
        const { data } = await supabase
            .from('gigs')
            .select('id, title, category, price, created_at, profile:profiles!user_id(id, full_name)')
            .order('created_at', { ascending: false })
            .limit(200);
        if (data) setGigs(data);
    }

    async function loadAll() {
        setLoading(true);
        await Promise.all([loadOrders(), loadDisputes(), loadUsers(), loadGigs()]);
        setLoading(false);
    }

    async function runClearance(orderId = null) {
        try {
            const res = await apiFetch('/api/admin/run-clearance', {
                method: 'POST',
                body: JSON.stringify(orderId ? { orderId } : {}),
            });
            const data = await res.json();
            if (!res.ok) { showToast('Error: ' + (data.error || 'Failed'), 'error'); return; }
            if (data.processed === 0) {
                showToast('No orders ready for clearance.', 'error');
            } else {
                const failed = data.results?.filter(r => r.status === 'failed') ?? [];
                const succeeded = data.results?.filter(r => r.status === 'cleared') ?? [];
                if (failed.length > 0) {
                    showToast(`${succeeded.length} cleared, ${failed.length} failed: ${failed[0].reason}`, 'error');
                } else {
                    showToast(`✅ Cleared ${succeeded.length} order(s).`);
                }
            }
            loadAll();
        } catch (err) {
            showToast('Error: ' + err.message, 'error');
        }
    }

    async function loadReports() {
        setReportsLoading(true);
        try {
            const res = await apiFetch('/api/admin/reports');
            const data = await res.json();
            if (res.ok) setReports(data);
            else showToast('Failed to load reports: ' + data.error, 'error');
        } catch (err) {
            showToast('Error: ' + err.message, 'error');
        }
        setReportsLoading(false);
    }

    async function dismissReport(reportId) {
        try {
            const res = await apiFetch('/api/admin/dismiss-report', {
                method: 'POST',
                body: JSON.stringify({ reportId }),
            });
            const data = await res.json();
            if (!res.ok) { showToast('Error: ' + (data.error || 'Failed'), 'error'); return; }
            setReports(prev => prev.filter(r => r.id !== reportId));
            showToast('Report dismissed.');
        } catch (err) {
            showToast('Error: ' + err.message, 'error');
        }
    }

    async function loadFinances() {
        setFinancesLoading(true);
        try {
            const res = await apiFetch('/api/admin/finances');
            const data = await res.json();
            if (res.ok) setFinances(data);
            else showToast('Failed to load finances: ' + data.error, 'error');
        } catch (err) {
            showToast('Error: ' + err.message, 'error');
        }
        setFinancesLoading(false);
    }

    async function resolveDispute(orderId, resolution) {
        try {
            const res = await apiFetch('/api/admin/resolve-dispute', {
                method: 'POST',
                body: JSON.stringify({ orderId, resolution }),
            });
            const data = await res.json();
            if (!res.ok) { showToast('Error: ' + (data.error || 'Failed'), 'error'); return; }
            showToast(resolution === 'refund' ? '↩ Refunded to buyer.' : '✓ Released to seller.');
            loadAll();
        } catch (err) {
            showToast('Error: ' + err.message, 'error');
        }
    }

    async function removeGig() {
        if (!removeGigId) return;
        try {
            const res = await apiFetch('/api/admin/remove-gig', {
                method: 'POST',
                body: JSON.stringify({ gigId: removeGigId, reason: removeReason.trim() || undefined }),
            });
            const data = await res.json();
            if (!res.ok) { showToast('Error: ' + (data.error || 'Failed'), 'error'); return; }
            setGigs(prev => prev.filter(g => g.id !== removeGigId));
            showToast('Gig removed.');
        } catch (err) {
            showToast('Error: ' + err.message, 'error');
        } finally {
            setRemoveGigId(null);
            setRemoveReason('');
        }
    }

    function showToast(msg, type = 'success') {
        setToast(msg); setToastType(type);
        setTimeout(() => setToast(''), 3000);
    }

    if (authLoading) return null;
    if (!user || user.email !== ADMIN_EMAIL) return null;

    const stats = [
        { label: 'Total Users',  value: users.length,                                      icon: '👥', accent: '#3b82f6' },
        { label: 'Total Orders', value: orders.length,                                     icon: '📦', accent: '#8b5cf6' },
        { label: 'In Escrow',    value: orders.filter(o => o.payment_status === 'escrowed').length, icon: '🔒', accent: '#f59e0b' },
        { label: 'Completed',    value: orders.filter(o => o.payment_status === 'released').length, icon: '✅', accent: '#10b981' },
        { label: 'Disputes',     value: disputes.length,                                   icon: '⚠️', accent: disputes.length > 0 ? '#ef4444' : '#10b981' },
    ];

    const revenue = orders
        .filter(o => o.payment_status === 'released')
        .reduce((sum, o) => sum + (o.payment_amount ?? 0), 0);

    return (
        <div className="page" style={{ maxWidth: 1200 }}>
            <title>Admin — SkillJoy</title>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <span style={{ fontSize: 22 }}>🛡️</span>
                        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>Admin Panel</h1>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: '#000' }}>SkillJoy Platform Management</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                        onClick={() => runClearance()}
                        style={{
                            background: '#f0fdf4', border: '1.5px solid #86efac', color: '#15803d',
                            padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                            cursor: 'pointer', whiteSpace: 'nowrap',
                        }}
                        onMouseOver={e => e.currentTarget.style.background = '#dcfce7'}
                        onMouseOut={e => e.currentTarget.style.background = '#f0fdf4'}>
                        ⚡ Run Clearance
                    </button>
                    <div style={{ textAlign: 'right' }}>
                        <p style={{ margin: 0, fontSize: 12, color: '#000' }}>Signed in as</p>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, fontFamily: 'monospace', color: 'var(--text-primary)' }}>{ADMIN_EMAIL}</p>
                    </div>
                    <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#1a1a1a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 }}>A</div>
                </div>
            </div>

            {/* Stats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 32 }}>
                {stats.map(s => (
                    <div key={s.label} style={{
                        background: 'var(--surface)', border: '1px solid var(--border)',
                        borderRadius: 14, padding: '18px 20px',
                        borderTop: `3px solid ${s.accent}`,
                    }}>
                        <div style={{ fontSize: 22, marginBottom: 8 }}>{s.icon}</div>
                        <div style={{ fontSize: 30, fontWeight: 800, color: s.accent, lineHeight: 1, marginBottom: 4 }}>{s.value}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
                    </div>
                ))}
                <div style={{
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 14, padding: '18px 20px',
                    borderTop: '3px solid #10b981',
                }}>
                    <div style={{ fontSize: 22, marginBottom: 8 }}>💰</div>
                    <div style={{ fontSize: 30, fontWeight: 800, color: '#10b981', lineHeight: 1, marginBottom: 4 }}>${revenue.toFixed(0)}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Revenue Processed</div>
                </div>
            </div>

            {/* Tabs */}
            <div className="admin-tabs-bar">
                {[
                    { key: 'disputes', label: 'Disputes', count: disputes.length },
                    { key: 'orders',   label: 'Orders',   count: orders.length },
                    { key: 'gigs',     label: 'Gigs',     count: gigs.length },
                    { key: 'users',    label: 'Users',    count: users.length },
                    { key: 'finances', label: 'Finances', count: null },
                    { key: 'reports',  label: 'Reports',  count: reports.filter(r => r.status === 'pending').length },
                ].map(t => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={`admin-tab${tab === t.key ? ' admin-tab-active' : ''}`}>
                        {t.label}
                        {t.count !== null && (
                            <span className={`admin-tab-badge${(t.key === 'disputes' || t.key === 'reports') && t.count > 0 ? ' admin-tab-badge-alert' : ''}`}>
                                {t.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
                    <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
                </div>
            ) : (
                <>
                    {/* ── Disputes ── */}
                    {tab === 'disputes' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {disputes.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                                    <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                                    <p style={{ fontWeight: 600, margin: 0 }}>No active disputes</p>
                                </div>
                            ) : disputes.map(d => (
                                <div key={d.id} style={{
                                    background: 'var(--surface)', border: '1px solid #fca5a5',
                                    borderRadius: 14, padding: '20px 22px',
                                    borderLeft: '4px solid #ef4444',
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                        <div>
                                            <p style={{ fontWeight: 700, fontSize: 16, margin: '0 0 4px' }}>{d.gig?.title ?? '—'}</p>
                                            <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--text-muted)' }}>
                                                <span>Buyer: <strong style={{ color: 'var(--text-primary)' }}>{d.requester?.full_name ?? '—'}</strong></span>
                                                <span>·</span>
                                                <span>Seller: <strong style={{ color: 'var(--text-primary)' }}>{d.provider?.full_name ?? '—'}</strong></span>
                                                <span>·</span>
                                                <span>Amount: <strong style={{ color: 'var(--text-primary)' }}>${d.payment_amount?.toFixed(2) ?? '—'}</strong></span>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                                            <StatusChip value="disputed" />
                                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                {d.dispute_date ? new Date(d.dispute_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                                            </span>
                                        </div>
                                    </div>

                                    {d.dispute_reason && (
                                        <div style={{
                                            background: '#fef2f2', border: '1px solid #fecaca',
                                            borderRadius: 8, padding: '10px 14px', marginBottom: 14,
                                            fontSize: 14, color: '#7f1d1d', fontStyle: 'italic', lineHeight: 1.5,
                                        }}>
                                            "{d.dispute_reason}"
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', gap: 10 }}>
                                        <button
                                            className="btn btn-secondary"
                                            style={{ flex: 1 }}
                                            onClick={() => navigate(`/disputes/${d.id}`)}>
                                            View Details
                                        </button>
                                        <button
                                            className="btn btn-primary"
                                            style={{ flex: 1 }}
                                            onClick={() => resolveDispute(d.id, 'release')}>
                                            ✓ Release to Seller
                                        </button>
                                        <button
                                            style={{
                                                flex: 1, background: '#fff5f5', border: '1.5px solid #fca5a5',
                                                color: '#dc2626', padding: '10px 18px', borderRadius: 8,
                                                fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                                            }}
                                            onMouseOver={e => e.currentTarget.style.background = '#fee2e2'}
                                            onMouseOut={e => e.currentTarget.style.background = '#fff5f5'}
                                            onClick={() => resolveDispute(d.id, 'refund')}>
                                            ↩ Refund to Buyer
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* ── Orders ── */}
                    {tab === 'orders' && (
                        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
                            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>All Orders</p>
                                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Showing {orders.length} orders</span>
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                    <thead>
                                        <tr style={{ background: 'var(--surface-alt, #f9f8f6)' }}>
                                            {['Gig', 'Buyer', 'Seller', 'Amount', 'Order Status', 'Payment', 'Date', ''].map(h => (
                                                <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {orders.map((o, i) => (
                                            <tr key={o.id} style={{ borderTop: '1px solid var(--border)' }}
                                                onMouseOver={e => e.currentTarget.style.background = 'var(--surface-alt, #f9f8f6)'}
                                                onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                                                <td style={{ padding: '12px 16px', fontWeight: 500, maxWidth: 200 }}>
                                                    <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.gig?.title ?? '—'}</span>
                                                </td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#e0d9f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#5b21b6', flexShrink: 0 }}>
                                                            {initials(o.requester?.full_name)}
                                                        </div>
                                                        {o.requester?.full_name ?? '—'}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#065f46', flexShrink: 0 }}>
                                                            {initials(o.provider?.full_name)}
                                                        </div>
                                                        {o.provider?.full_name ?? '—'}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '12px 16px', fontWeight: 700 }}>{o.payment_amount ? `$${o.payment_amount.toFixed(2)}` : '—'}</td>
                                                <td style={{ padding: '12px 16px' }}><StatusChip value={o.status} /></td>
                                                <td style={{ padding: '12px 16px' }}><StatusChip value={o.payment_status} /></td>
                                                <td style={{ padding: '12px 16px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{new Date(o.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    {o.payment_status === 'released' && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); runClearance(o.id); }}
                                                            style={{
                                                                background: '#f0fdf4', border: '1.5px solid #86efac',
                                                                color: '#15803d', padding: '5px 10px', borderRadius: 6,
                                                                fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                                                            }}>
                                                            ⚡ Force Clear
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* ── Finances ── */}
                    {tab === 'finances' && (
                        <div>
                            {financesLoading ? (
                                <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
                                    <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
                                </div>
                            ) : finances ? (
                                <>
                                    {/* Balance cards */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
                                        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px', borderTop: '3px solid #6366f1' }}>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Stripe Balance (Total)</div>
                                            <div style={{ fontSize: 28, fontWeight: 800, color: '#6366f1' }}>${finances.stripeTotal.toFixed(2)}</div>
                                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>${finances.stripeAvailable.toFixed(2)} available · ${finances.stripePending.toFixed(2)} pending</div>
                                        </div>
                                        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px', borderTop: '3px solid #f59e0b' }}>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Owed to Sellers</div>
                                            <div style={{ fontSize: 28, fontWeight: 800, color: '#92400e' }}>${finances.owedToSellers.toFixed(2)}</div>
                                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{finances.pendingTransfers.length} order(s) in clearance</div>
                                        </div>
                                        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 14, padding: '18px 20px', borderTop: '3px solid #10b981' }}>
                                            <div style={{ fontSize: 11, color: '#166534', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Your Actual Profit</div>
                                            <div style={{ fontSize: 28, fontWeight: 800, color: '#15803d' }}>${finances.actualProfit.toFixed(2)}</div>
                                            <div style={{ fontSize: 12, color: '#166534', marginTop: 4 }}>Stripe balance minus owed to sellers</div>
                                        </div>
                                        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px', borderTop: '3px solid #8b5cf6' }}>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>All-Time Fees Collected</div>
                                            <div style={{ fontSize: 28, fontWeight: 800, color: '#6d28d9' }}>${finances.totalFeesEarned.toFixed(2)}</div>
                                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>From cleared orders ($6 each)</div>
                                        </div>
                                    </div>

                                    {/* How this works explanation */}
                                    <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px', marginBottom: 24, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                                        <strong style={{ color: 'var(--text-primary)' }}>How to read this:</strong> Your Stripe balance holds both your profit ($6 fees) and funds reserved for sellers. <strong style={{ color: '#92400e' }}>Owed to Sellers</strong> is money that must go out once clearance windows expire. <strong style={{ color: '#15803d' }}>Actual Profit</strong> is what's truly yours right now.
                                    </div>

                                    {/* Pending transfers list */}
                                    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
                                        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>Pending Transfers</p>
                                            <button
                                                onClick={loadFinances}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-muted)', padding: '2px 6px' }}
                                                title="Refresh">↻</button>
                                        </div>
                                        {finances.pendingTransfers.length === 0 ? (
                                            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                                                <p style={{ fontWeight: 600, margin: 0 }}>No pending transfers</p>
                                            </div>
                                        ) : (
                                            finances.pendingTransfers.map((o, i) => (
                                                <div key={o.id} style={{
                                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                    padding: '12px 20px', borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                                                    gap: 12,
                                                }}>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <p style={{ margin: 0, fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.gig?.title ?? '—'}</p>
                                                        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>Seller: {o.provider?.full_name ?? '—'}</p>
                                                    </div>
                                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                        <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>${((o.payment_amount ?? 0) - 6).toFixed(2)} to seller</p>
                                                        <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>
                                                            Clears {o.clearance_date ? new Date(o.clearance_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                                    <p>Failed to load finances.</p>
                                    <button className="btn btn-primary" onClick={loadFinances}>Retry</button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Gigs ── */}
                    {tab === 'gigs' && (
                        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
                            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>All Gigs</p>
                                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Showing {gigs.length} gigs</span>
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                    <thead>
                                        <tr style={{ background: 'var(--surface-alt, #f9f8f6)' }}>
                                            {['Title', 'Seller', 'Category', 'Price', 'Listed', ''].map(h => (
                                                <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {gigs.map((g) => (
                                            <tr key={g.id} style={{ borderTop: '1px solid var(--border)' }}
                                                onMouseOver={e => e.currentTarget.style.background = 'var(--surface-alt, #f9f8f6)'}
                                                onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                                                <td style={{ padding: '12px 16px', fontWeight: 500, maxWidth: 220 }}>
                                                    <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.title}</span>
                                                </td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#e0d9f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#5b21b6', flexShrink: 0 }}>
                                                            {initials(g.profile?.full_name)}
                                                        </div>
                                                        {g.profile?.full_name ?? '—'}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>{g.category ?? '—'}</td>
                                                <td style={{ padding: '12px 16px', fontWeight: 700 }}>{g.price != null ? `$${g.price.toFixed(2)}` : '—'}</td>
                                                <td style={{ padding: '12px 16px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                                    {new Date(g.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                </td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    <button
                                                        onClick={() => { setRemoveGigId(g.id); setRemoveReason(''); }}
                                                        style={{
                                                            background: '#fff5f5', border: '1.5px solid #fca5a5',
                                                            color: '#dc2626', padding: '5px 12px', borderRadius: 6,
                                                            fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                                                        }}>
                                                        🗑 Remove
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* ── Reports ── */}
                    {tab === 'reports' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
                                    {reports.filter(r => r.status === 'pending').length} pending · {reports.filter(r => r.status === 'dismissed').length} dismissed
                                </p>
                                <button
                                    onClick={loadReports}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-muted)', padding: '2px 6px' }}
                                    title="Refresh">↻</button>
                            </div>
                            {reportsLoading ? (
                                <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
                                    <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
                                </div>
                            ) : reports.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                                    <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                                    <p style={{ fontWeight: 600, margin: 0 }}>No reports yet</p>
                                </div>
                            ) : reports.map(r => (
                                <div key={r.id} style={{
                                    background: 'var(--surface)', border: '1px solid var(--border)',
                                    borderRadius: 14, padding: '18px 20px',
                                    borderLeft: `4px solid ${r.status === 'dismissed' ? '#d1d5db' : '#f97316'}`,
                                    opacity: r.status === 'dismissed' ? 0.6 : 1,
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                                <span style={{
                                                    fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 100, textTransform: 'uppercase',
                                                    background: r.reported_type === 'gig' ? '#eff6ff' : '#faf5ff',
                                                    color: r.reported_type === 'gig' ? '#1e40af' : '#6b21a8',
                                                    border: `1px solid ${r.reported_type === 'gig' ? '#bfdbfe' : '#d8b4fe'}`,
                                                }}>
                                                    {r.reported_type}
                                                </span>
                                                <span style={{
                                                    fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 100, textTransform: 'uppercase',
                                                    background: r.status === 'dismissed' ? '#f3f4f6' : '#fff7ed',
                                                    color: r.status === 'dismissed' ? '#6b7280' : '#c2410c',
                                                    border: `1px solid ${r.status === 'dismissed' ? '#e5e7eb' : '#fdba74'}`,
                                                }}>
                                                    {r.status}
                                                </span>
                                            </div>
                                            <Link
                                                to={r.reported_type === 'gig' ? `/gigs/${r.reported_id}` : `/profile/${r.reported_id}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 15, color: 'var(--primary)', textDecoration: 'none', display: 'block' }}
                                                onMouseOver={e => e.currentTarget.style.textDecoration = 'underline'}
                                                onMouseOut={e => e.currentTarget.style.textDecoration = 'none'}
                                            >
                                                {r.reported_name} ↗
                                            </Link>
                                            {r.reported_owner && (
                                                <p style={{ margin: '0 0 4px', fontSize: 12, color: 'var(--text-muted)' }}>by {r.reported_owner}</p>
                                            )}
                                            <p style={{ margin: '0 0 6px', fontSize: 13, color: '#c2410c', fontWeight: 600 }}>Reason: {r.reason}</p>
                                            {r.description && (
                                                <p style={{ margin: '0 0 6px', fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic' }}>"{r.description}"</p>
                                            )}
                                            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                                                Reported by{' '}
                                                <Link
                                                    to={`/profile/${r.reporter?.id}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{ fontWeight: 600, color: 'var(--text-primary)', textDecoration: 'none' }}
                                                    onMouseOver={e => e.currentTarget.style.textDecoration = 'underline'}
                                                    onMouseOut={e => e.currentTarget.style.textDecoration = 'none'}
                                                >
                                                    {r.reporter?.full_name ?? '—'}
                                                </Link>
                                                {' '}· {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </p>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                                            {r.reported_type === 'gig' && r.status === 'pending' && (
                                                <button
                                                    onClick={() => { setRemoveGigId(r.reported_id); setRemoveReason(''); }}
                                                    style={{
                                                        background: '#fff5f5', border: '1.5px solid #fca5a5',
                                                        color: '#dc2626', padding: '6px 14px', borderRadius: 8,
                                                        fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                                                    }}>
                                                    🗑 Remove Gig
                                                </button>
                                            )}
                                            {r.status === 'pending' && (
                                                <button
                                                    onClick={() => dismissReport(r.id)}
                                                    style={{
                                                        background: '#f3f4f6', border: '1px solid #e5e7eb',
                                                        color: '#6b7280', padding: '6px 14px', borderRadius: 8,
                                                        fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                                                    }}>
                                                    Dismiss
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* ── Users ── */}
                    {tab === 'users' && (
                        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
                            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>All Users</p>
                                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{users.length} registered</span>
                            </div>
                            <div>
                                {users.map((u, i) => (
                                    <div key={u.id} style={{
                                        display: 'flex', alignItems: 'center', gap: 14,
                                        padding: '14px 20px', borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                                        transition: 'background 0.1s',
                                    }}
                                        onMouseOver={e => e.currentTarget.style.background = 'var(--surface-alt, #f9f8f6)'}
                                        onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                                        <div style={{
                                            width: 38, height: 38, borderRadius: '50%',
                                            background: `hsl(${(u.full_name?.charCodeAt(0) ?? 0) * 15 % 360}, 60%, 85%)`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: 13, fontWeight: 700,
                                            color: `hsl(${(u.full_name?.charCodeAt(0) ?? 0) * 15 % 360}, 60%, 30%)`,
                                            flexShrink: 0,
                                        }}>
                                            {initials(u.full_name)}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{u.full_name ?? '—'}</p>
                                            <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{u.id}</p>
                                        </div>
                                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                            Joined {new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* ── Remove Gig Confirm Modal ── */}
            {removeGigId && (
                <div className="modal-backdrop" onClick={() => { setRemoveGigId(null); setRemoveReason(''); }}>
                    <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
                        <button className="modal-close" onClick={() => { setRemoveGigId(null); setRemoveReason(''); }}>✕</button>
                        <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700 }}>Remove gig?</h2>
                        <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--text-muted)' }}>
                            The gig will be permanently deleted and the owner will be notified.
                        </p>
                        <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
                            Reason <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional — sent to user)</span>
                        </label>
                        <textarea
                            value={removeReason}
                            onChange={e => setRemoveReason(e.target.value)}
                            placeholder="e.g. Violates community guidelines"
                            rows={3}
                            style={{ width: '100%', borderRadius: 8, border: '1px solid var(--border)', padding: '10px 12px', fontSize: 14, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
                        />
                        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setRemoveGigId(null); setRemoveReason(''); }}>Cancel</button>
                            <button
                                onClick={removeGig}
                                style={{ flex: 1, background: '#dc2626', border: 'none', color: '#fff', padding: '10px 18px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                                Remove Gig
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {toast && <div className={`toast ${toastType}`}>{toast}</div>}

            <style>{`
                .admin-tabs-bar {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px;
                    margin-bottom: 20px;
                    background: var(--surface);
                    border: 1px solid var(--border);
                    border-radius: 12px;
                    padding: 6px;
                }
                .admin-tab {
                    flex: 1 1 auto;
                    min-width: 80px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 7px;
                    padding: 9px 14px;
                    border-radius: 8px;
                    border: none;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 600;
                    transition: all 0.15s;
                    background: transparent;
                    color: var(--text-muted);
                    white-space: nowrap;
                    font-family: inherit;
                }
                .admin-tab-active {
                    background: #1a1a1a;
                    color: #fff;
                }
                .admin-tab-badge {
                    font-size: 11px;
                    font-weight: 700;
                    padding: 1px 6px;
                    border-radius: 100px;
                    background: var(--border);
                    color: var(--text-muted);
                }
                .admin-tab-active .admin-tab-badge {
                    background: rgba(255,255,255,0.2);
                    color: #fff;
                }
                .admin-tab-badge-alert {
                    background: #ef4444 !important;
                    color: #fff !important;
                }
                @media (max-width: 600px) {
                    .admin-tabs-bar {
                        gap: 4px;
                        padding: 4px;
                    }
                    .admin-tab {
                        flex: 1 1 calc(33% - 8px);
                        min-width: 0;
                        font-size: 12px;
                        padding: 8px 6px;
                        gap: 4px;
                    }
                }
            `}</style>
        </div>
    );
}
