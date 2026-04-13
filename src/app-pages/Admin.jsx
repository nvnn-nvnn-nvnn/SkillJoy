import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
    const [tab, setTab] = useState('disputes');
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState('');
    const [toastType, setToastType] = useState('success');

    useEffect(() => {
        if (authLoading) return;
        if (!user) { navigate('/login'); return; }
        if (user.email !== ADMIN_EMAIL) { navigate('/'); return; }
        loadAll();
    }, [user, authLoading]);

    async function loadAll() {
        setLoading(true);
        const [ordersRes, disputesRes, usersRes] = await Promise.all([
            supabase
                .from('gig_requests')
                .select(`*, gig:gigs(id, title, price), requester:profiles!requester_id(id, full_name), provider:profiles!provider_id(id, full_name)`)
                .order('created_at', { ascending: false })
                .limit(100),
            supabase
                .from('gig_requests')
                .select(`*, gig:gigs(id, title), requester:profiles!requester_id(id, full_name), provider:profiles!provider_id(id, full_name)`)
                .eq('payment_status', 'disputed')
                .order('dispute_date', { ascending: false }),
            supabase
                .from('profiles')
                .select('id, full_name, created_at')
                .order('created_at', { ascending: false })
                .limit(100),
        ]);

        if (ordersRes.data) setOrders(ordersRes.data);
        if (disputesRes.data) setDisputes(disputesRes.data);
        if (usersRes.data) setUsers(usersRes.data);
        setLoading(false);
    }

    async function runClearance() {
        try {
            const res = await apiFetch('/api/admin/run-clearance', { method: 'POST' });
            const data = await res.json();
            if (!res.ok) { showToast('Error: ' + (data.error || 'Failed'), 'error'); return; }
            const msg = data.processed === 0
                ? 'No orders ready for clearance.'
                : `Cleared ${data.processed} order(s).`;
            showToast(msg);
            loadAll();
        } catch (err) {
            showToast('Error: ' + err.message, 'error');
        }
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <span style={{ fontSize: 22 }}>🛡️</span>
                        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>Admin Panel</h1>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: '#000' }}>SkillJoy Platform Management</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                        onClick={runClearance}
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
            <div style={{ display: 'flex', gap: 6, marginBottom: 20, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 6 }}>
                {[
                    { key: 'disputes', label: 'Disputes', count: disputes.length },
                    { key: 'orders',   label: 'Orders',   count: orders.length },
                    { key: 'users',    label: 'Users',     count: users.length },
                ].map(t => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        style={{
                            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                            padding: '9px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                            fontSize: 14, fontWeight: 600, transition: 'all 0.15s',
                            background: tab === t.key ? '#1a1a1a' : 'transparent',
                            color: tab === t.key ? '#fff' : 'var(--text-muted)',
                        }}>
                        {t.label}
                        <span style={{
                            fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 100,
                            background: tab === t.key
                                ? (t.key === 'disputes' && t.count > 0 ? '#ef4444' : 'rgba(255,255,255,0.2)')
                                : (t.key === 'disputes' && t.count > 0 ? '#ef4444' : 'var(--border)'),
                            color: tab === t.key ? '#fff' : (t.key === 'disputes' && t.count > 0 ? '#fff' : 'var(--text-muted)'),
                        }}>
                            {t.count}
                        </span>
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
                                            {['Gig', 'Buyer', 'Seller', 'Amount', 'Order Status', 'Payment', 'Date'].map(h => (
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
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
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

            {toast && <div className={`toast ${toastType}`}>{toast}</div>}
        </div>
    );
}
