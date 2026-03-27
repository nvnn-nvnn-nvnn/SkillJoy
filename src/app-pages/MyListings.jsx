import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useUser, useProfile } from '@/lib/stores';
import FAQSection from '@/components/FAQsection';
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";

const GIG_CATEGORIES = [
    'Errands & Delivery',
    'Laundry & Cleaning',
    'Tutoring & Homework Help',
    'Photography & Headshots',
    'Graphic Design & Logos',
    'Resume & Cover Letter',
    'Moving & Heavy Lifting',
    'Cooking & Meal Prep',
    'Tech Support & Setup',
    'Rides & Airport Trips',
    'Pet Sitting & Dog Walking',
    'Event Help & Setup',
    'Music Lessons',
    'Fitness & Personal Training',
    'Video & Content Editing',
    'Other',
];

function initials(name) {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function MyListingsPage() {
    const user = useUser();
    const profile = useProfile();
    const navigate = useNavigate();

    const [tab, setTab] = useState('listings');
    const [myGigs, setMyGigs] = useState([]);
    const [incoming, setIncoming] = useState([]);
    const [sentRequests, setSentRequests] = useState([]);
    const [completed, setCompleted] = useState([]);
    const [busy, setBusy] = useState(true);
    const [toast, setToast] = useState('');
    const [toastType, setToastType] = useState('success');

    // Create gig form
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [price, setPrice] = useState('');
    const [category, setCategory] = useState('');
    const [commitments, setCommitments] = useState('');
    const [requirements, setRequirements] = useState('');
    const [imageUrls, setImageUrls] = useState('');
    const [faqs, setFaqs] = useState([]); // ← Change from string to array
    const [submitting, setSubmitting] = useState(false);
    const [gigDetailModal, setGigDetailModal] = useState(null);
    // Faqs


    useEffect(() => {
        if (!user) { navigate('/login'); return; }
        loadData();
    }, [user]);

    async function loadData() {
        setBusy(true);
        const [gigsRes, incomingRes, sentRes, completedRes] = await Promise.all([
            supabase
                .from('gigs')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false }),
            supabase
                .from('gig_requests')
                .select('*, gig:gigs!gig_id(id, title, price, category), requester:profiles!requester_id(id, full_name)')
                .eq('provider_id', user.id)
                .order('created_at', { ascending: false }),
            supabase
                .from('gig_requests')
                .select('*, gig:gigs!gig_id(id, title, price, category), provider:profiles!provider_id(id, full_name)')
                .eq('requester_id', user.id)
                .order('created_at', { ascending: false }),
            supabase
                .from('gig_requests')
                .select('*, gig:gigs!gig_id(id, title, price, category), requester:profiles!requester_id(id, full_name), provider:profiles!provider_id(id, full_name)')
                .or(`requester_id.eq.${user.id},provider_id.eq.${user.id}`)
                .eq('status', 'completed')
                .order('created_at', { ascending: false }),
        ]);

        if (!gigsRes.error && gigsRes.data) setMyGigs(gigsRes.data);
        if (!incomingRes.error && incomingRes.data) setIncoming(incomingRes.data);
        if (!sentRes.error && sentRes.data) setSentRequests(sentRes.data);
        if (!completedRes.error && completedRes.data) setCompleted(completedRes.data);
        setBusy(false);
    }

    function showToast(msg, type = 'success') {
        setToast(msg);
        setToastType(type);
        setTimeout(() => setToast(''), 3500);
    }

    // ── Create Gig ──
    async function handleCreateGig(e) {
        e.preventDefault();
        if (!title.trim() || !price) {
            showToast('Please fill in title and price', 'error');
            return;
        }

        setSubmitting(true);
        const images = imageUrls.trim() ? imageUrls.split(',').map(url => url.trim()).filter(Boolean) : [];
        const validFaqs = faqs.filter(faq => faq.question.trim() && faq.answer.trim());
        const { error } = await supabase.from('gigs').insert({
            user_id: user.id,
            title: title.trim(),
            description: description.trim(),
            price: parseFloat(price),
            category: category || null,
            commitments: commitments.trim() || null,
            requirements: requirements.trim() || null,
            images: images.length > 0 ? images : null,
            faqs: validFaqs.length > 0 ? validFaqs : null,
        });
        setSubmitting(false);

        if (error) { showToast(error.message, 'error'); return; }

        setTitle(''); setDescription(''); setPrice(''); setCategory(''); setCommitments(''); setRequirements(''); setImageUrls(''); setFaqs([]);
        showToast('Gig listed!', 'success');
        loadData();
        setTab('listings');
    }

    // ── Delete Gig ──
    async function handleDeleteGig(gigId) {
        if (!window.confirm('Remove this gig listing?')) return;

        const { data, error } = await supabase
            .from('gigs')
            .delete()
            .eq('id', gigId)
            .eq('user_id', user.id)
            .select();

        if (error) { showToast(error.message, 'error'); return; }
        if (!data || data.length === 0) { showToast('Failed to delete — check RLS policies', 'error'); return; }

        setMyGigs(prev => prev.filter(g => g.id !== gigId));
        showToast('Gig removed', 'success');
    }

    // ── Respond to incoming request ──
    async function respondToRequest(requestId, status) {
        const { error } = await supabase
            .from('gig_requests')
            .update({ status })
            .eq('id', requestId)
            .eq('provider_id', user.id);

        if (error) { showToast(error.message, 'error'); return; }

        setIncoming(prev => prev.map(r => r.id === requestId ? { ...r, status } : r));
        showToast(status === 'accepted' ? 'Request accepted!' : 'Request declined', 'success');
    }

    // ── Cancel sent request ──
    async function cancelRequest(requestId) {
        if (!window.confirm('Cancel this hire request?')) return;

        const { data, error } = await supabase
            .from('gig_requests')
            .delete()
            .eq('id', requestId)
            .eq('requester_id', user.id)
            .select();

        if (error) { showToast(error.message, 'error'); return; }
        if (!data || data.length === 0) { showToast('Failed to cancel — check RLS policies', 'error'); return; }

        setSentRequests(prev => prev.filter(r => r.id !== requestId));
        showToast('Request cancelled', 'success');
    }

    const pendingIncoming = incoming.filter(r => r.status === 'pending').length;

    return (
        <>
            <title>My Listings — SkillJoy</title>

            <div className="page">
                <div className="swaps-hero-section">
                    <div className="page-header" style={{ marginBottom: '20px' }}>
                        <div>
                            <h1 className="page-title">My Listings</h1>
                            <p className="page-subtitle" style={{ color: '#000' }}>Manage your gigs and hire requests.</p>
                        </div>
                        <Link to="/gigs" className="btn btn-secondary" style={{ backgroundColor: '#fff', border: '2px solid #c99772' }}>Browse Gigs</Link>
                    </div>

                    {(profile?.service_type !== 'gigs' && profile?.service_type !== 'both') && (
                        <div className="gig-notice">
                            <p>Your profile is set to <strong>Skill Swap</strong> only. Update to "Paid Services" or "Both" so others know you're available for hire.</p>
                            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/onboarding')}>
                                Update Profile
                            </button>
                        </div>
                    )}

                    <div className="tabs">
                        <button className={`tab ${tab === 'listings' ? 'active' : ''}`} onClick={() => setTab('listings')}>
                            My Gigs ({myGigs.length})
                        </button>
                        <button className={`tab ${tab === 'incoming' ? 'active' : ''}`} onClick={() => setTab('incoming')}>
                            Incoming {pendingIncoming > 0 && <span className="tab-badge">{pendingIncoming}</span>}
                        </button>
                        <button className={`tab ${tab === 'sent' ? 'active' : ''}`} onClick={() => setTab('sent')}>
                            Sent ({sentRequests.length})
                        </button>
                        <button className={`tab ${tab === 'completed' ? 'active' : ''}`} onClick={() => setTab('completed')}>
                            Completed ({completed.length})
                        </button>
                        <button className={`tab ${tab === 'create' ? 'active' : ''}`} onClick={() => setTab('create')}>
                            + New Gig
                        </button>
                    </div>


                </div>

                {busy ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
                        <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
                    </div>
                ) : (
                    <>
                        {/* ── My Gigs Tab ── */}
                        {tab === 'listings' && (
                            myGigs.length === 0 ? (
                                <div className="empty-state">
                                    <span className="empty-icon">📋</span>
                                    <h3>No gigs yet</h3>
                                    <p>List your first service to start earning.</p>
                                    <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setTab('create')}>
                                        Create a gig
                                    </button>
                                </div>
                            ) : (
                                <div className="gigs-grid">
                                    {myGigs.map((gig, i) => (
                                        <div key={gig.id} className="gig-card fade-up" style={{ animationDelay: `${i * 0.04}s` }}>
                                            <h3 className="gig-title gig-title-link" onClick={() => setGigDetailModal(gig)}>{gig.title}</h3>
                                            {gig.category && <span className="gig-category">{gig.category}</span>}
                                            {gig.description && <p className="gig-desc">{gig.description}</p>}
                                            <div className="gig-footer">
                                                <span className="gig-price">${gig.price?.toFixed(2)}</span>
                                                <button className="btn btn-decline btn-sm" onClick={() => handleDeleteGig(gig.id)}>
                                                    Remove
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )
                        )}

                        {/* ── Incoming Hire Requests Tab ── */}
                        {tab === 'incoming' && (
                            incoming.length === 0 ? (
                                <div className="empty-state">
                                    <span className="empty-icon">📥</span>
                                    <h3>No hire requests yet</h3>
                                    <p>When someone wants to hire you, their request will show up here.</p>
                                </div>
                            ) : (
                                <div className="requests-list">
                                    {incoming.map((req, i) => (
                                        <div key={req.id} className="request-card fade-up" style={{ animationDelay: `${i * 0.04}s` }}>
                                            <div className="request-header">
                                                <div className="avatar">{initials(req.requester?.full_name)}</div>
                                                <div>
                                                    <p className="request-name">{req.requester?.full_name ?? 'Unknown'}</p>
                                                    <p className="request-detail">wants to hire you for</p>
                                                </div>
                                            </div>
                                            <div className="request-gig">
                                                <strong className="gig-title-link" onClick={() => setGigDetailModal(req.gig)}>{req.gig?.title}</strong>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <span className="gig-price" style={{ fontSize: 16 }}>${req.gig?.price?.toFixed(2)}</span>
                                                    {req.payment_status && <span className={`payment-badge payment-${req.payment_status}`}>{req.payment_status === 'authorized' ? '🔒 Held' : req.payment_status === 'captured' ? '✅ Paid' : req.payment_status === 'refunded' ? '↩ Refunded' : req.payment_status}</span>}
                                                </div>
                                            </div>
                                            {req.status === 'pending' ? (
                                                <div className="request-actions">
                                                    <button className="btn btn-accept btn-sm" onClick={() => respondToRequest(req.id, 'accepted')}>
                                                        Accept
                                                    </button>
                                                    <button className="btn btn-decline btn-sm" onClick={() => respondToRequest(req.id, 'declined')}>
                                                        Decline
                                                    </button>
                                                </div>
                                            ) : req.status === 'accepted' ? (
                                                <div className="request-actions">
                                                    <span className="request-status status-accepted">Accepted</span>
                                                    <button className="btn btn-primary btn-sm" onClick={() => navigate('/chat')}>
                                                        Go to Chat
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className={`request-status status-${req.status}`}>
                                                    Declined
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )
                        )}

                        {/* ── Sent Requests Tab ── */}
                        {tab === 'sent' && (
                            sentRequests.length === 0 ? (
                                <div className="empty-state">
                                    <span className="empty-icon">📤</span>
                                    <h3>No sent requests</h3>
                                    <p>When you hire someone from the <Link to="/gigs">Gigs</Link> page, your request shows here.</p>
                                </div>
                            ) : (
                                <div className="requests-list">
                                    {sentRequests.map((req, i) => (
                                        <div key={req.id} className="request-card fade-up" style={{ animationDelay: `${i * 0.04}s` }}>
                                            <div className="request-header">
                                                <div className="avatar">{initials(req.provider?.full_name)}</div>
                                                <div>
                                                    <p className="request-name">{req.provider?.full_name ?? 'Unknown'}</p>
                                                    <p className="request-detail">for <strong>{req.gig?.title}</strong></p>
                                                </div>
                                            </div>
                                            <div className="request-gig">
                                                {req.gig?.category && <span className="gig-category">{req.gig.category}</span>}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <span className="gig-price" style={{ fontSize: 16 }}>${req.gig?.price?.toFixed(2)}</span>
                                                    {req.payment_status && <span className={`payment-badge payment-${req.payment_status}`}>{req.payment_status === 'authorized' ? '🔒 Held' : req.payment_status === 'captured' ? '✅ Paid' : req.payment_status === 'refunded' ? '↩ Refunded' : req.payment_status}</span>}
                                                </div>
                                            </div>
                                            {req.status === 'pending' ? (
                                                <div className="request-actions">
                                                    <span className="request-status status-pending">Pending</span>
                                                    <button className="btn btn-decline btn-sm" onClick={() => cancelRequest(req.id)}>
                                                        Cancel
                                                    </button>
                                                </div>
                                            ) : req.status === 'accepted' ? (
                                                <div className="request-actions">
                                                    <span className="request-status status-accepted">Accepted</span>
                                                    <button className="btn btn-primary btn-sm" onClick={() => navigate('/chat')}>
                                                        Go to Chat
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className={`request-status status-${req.status}`}>
                                                    Declined
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )
                        )}

                        {/* ── Completed Tab ── */}
                        {tab === 'completed' && (
                            completed.length === 0 ? (
                                <div className="empty-state">
                                    <span className="empty-icon">✅</span>
                                    <h3>No completed gigs yet</h3>
                                    <p>Once you mark a gig as completed, it will appear here.</p>
                                </div>
                            ) : (
                                <div className="requests-list">
                                    {completed.map((req, i) => {
                                        const isProvider = req.provider_id === user.id;
                                        const otherPerson = isProvider ? req.requester : req.provider;
                                        return (
                                            <div key={req.id} className="request-card fade-up" style={{ animationDelay: `${i * 0.04}s` }}>
                                                <div className="request-header">
                                                    <div className="avatar">{initials(otherPerson?.full_name)}</div>
                                                    <div>
                                                        <p className="request-name">{otherPerson?.full_name ?? 'Unknown'}</p>
                                                        <p className="request-detail">{isProvider ? 'hired you for' : 'you hired for'}</p>
                                                    </div>
                                                </div>
                                                <div className="request-gig">
                                                    <strong>{req.gig?.title}</strong>
                                                    <span className="gig-price" style={{ fontSize: 16 }}>${req.gig?.price?.toFixed(2)}</span>
                                                </div>
                                                <span className="request-status status-completed">✓ Completed</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )
                        )}

                        {/* ── Create Gig Tab ── */}
                        {tab === 'create' && (
                            <form onSubmit={handleCreateGig} className="gig-form">
                                <div className="field">
                                    <label htmlFor="gig-title">Gig Title</label>
                                    <input
                                        id="gig-title"
                                        type="text"
                                        value={title}
                                        onChange={e => setTitle(e.target.value)}
                                        placeholder="e.g. Laundry pickup & delivery"
                                    />
                                </div>

                                <div className="field">
                                    <label htmlFor="gig-category">Category</label>
                                    <select
                                        id="gig-category"
                                        value={category}
                                        onChange={e => setCategory(e.target.value)}
                                    >
                                        <option value="">Select a category...</option>
                                        {GIG_CATEGORIES.map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="field">
                                    <label htmlFor="gig-desc">Description <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                                    <textarea
                                        id="gig-desc"
                                        value={description}
                                        onChange={e => setDescription(e.target.value)}
                                        placeholder="Describe what you offer..."
                                        rows={3}
                                        style={{ resize: 'vertical' }}
                                    />
                                </div>

                                <div className="field">
                                    <label htmlFor="gig-price">Price ($)</label>
                                    <input
                                        id="gig-price"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={price}
                                        onChange={e => setPrice(e.target.value)}
                                        placeholder="e.g. 15.00"
                                    />
                                </div>

                                <div className="field">
                                    <label htmlFor="gig-commitments">What I Commit To <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                                    <textarea
                                        id="gig-commitments"
                                        value={commitments}
                                        onChange={e => setCommitments(e.target.value)}
                                        placeholder="e.g. Fast turnaround, quality work, responsive communication..."
                                        rows={3}
                                        style={{ resize: 'vertical' }}
                                    />
                                </div>

                                <div className="field">
                                    <label htmlFor="gig-requirements">Requirements <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                                    <textarea
                                        id="gig-requirements"
                                        value={requirements}
                                        onChange={e => setRequirements(e.target.value)}
                                        placeholder="e.g. Must provide materials, available weekdays only, requires 24hr notice..."
                                        rows={3}
                                        style={{ resize: 'vertical' }}
                                    />
                                </div>

                                <div className="field">
                                    <label htmlFor="gig-images">Portfolio Images <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                                    <input
                                        id="gig-images"
                                        type="text"
                                        value={imageUrls}
                                        onChange={e => setImageUrls(e.target.value)}
                                        placeholder="Paste image URLs separated by commas"
                                    />
                                    <small style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '4px', display: 'block' }}>
                                        Add URLs to showcase your work (e.g., from Imgur, Google Drive, etc.)
                                    </small>
                                </div>


                                <div className="field">
                                    <label>FAQs <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>

                                    {/* FAQ List */}
                                    <div style={{ marginBottom: '12px' }}>
                                        {faqs.map((faq, index) => (
                                            <div key={index} style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '8px',
                                                marginBottom: '12px',
                                                padding: '12px',
                                                border: '1px solid var(--border)',
                                                borderRadius: '8px',
                                                background: 'var(--surface-alt)'
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)' }}>
                                                        FAQ {index + 1}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setFaqs(faqs.filter((_, i) => i !== index))}
                                                        style={{
                                                            background: 'none',
                                                            border: 'none',
                                                            color: 'var(--color-error)',
                                                            cursor: 'pointer',
                                                            padding: '4px'
                                                        }}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                                <input
                                                    type="text"
                                                    placeholder="Question"
                                                    value={faq.question}
                                                    onChange={e => {
                                                        const newFaqs = [...faqs];
                                                        newFaqs[index].question = e.target.value;
                                                        setFaqs(newFaqs);
                                                    }}
                                                    style={{
                                                        padding: '8px',
                                                        border: '1px solid var(--border)',
                                                        borderRadius: '4px',
                                                        fontSize: '14px'
                                                    }}
                                                />
                                                <textarea
                                                    placeholder="Answer"
                                                    value={faq.answer}
                                                    onChange={e => {
                                                        const newFaqs = [...faqs];
                                                        newFaqs[index].answer = e.target.value;
                                                        setFaqs(newFaqs);
                                                    }}
                                                    rows={3}
                                                    style={{
                                                        padding: '8px',
                                                        border: '1px solid var(--border)',
                                                        borderRadius: '4px',
                                                        fontSize: '14px',
                                                        resize: 'vertical'
                                                    }}
                                                />
                                            </div>
                                        ))}
                                    </div>

                                    {/* Add FAQ Button */}
                                    <button
                                        type="button"
                                        onClick={() => setFaqs([...faqs, { question: '', answer: '' }])}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            padding: '8px 12px',
                                            border: '1px dashed var(--border)',
                                            borderRadius: '6px',
                                            background: 'transparent',
                                            color: 'var(--text-secondary)',
                                            fontSize: '13px',
                                            cursor: 'pointer',
                                            transition: 'border-color 0.14s'
                                        }}
                                        onMouseOver={(e) => e.target.style.borderColor = 'var(--text-secondary)'}
                                        onMouseOut={(e) => e.target.style.borderColor = 'var(--border)'}
                                    >
                                        <Plus size={14} />
                                        Add FAQ
                                    </button>

                                    <small style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '8px', display: 'block' }}>
                                        Add frequently asked questions about your gig
                                    </small>
                                </div>

                                <button className="btn btn-primary" type="submit" disabled={submitting || !title.trim() || !price}>
                                    {submitting ? 'Listing...' : 'List Gig'}
                                </button>
                            </form>
                        )}
                    </>
                )}
            </div >

            {/* ── Gig Detail Modal ── */}
            {
                gigDetailModal && (
                    <div className="modal-backdrop" onClick={() => setGigDetailModal(null)}>
                        <div className="modal" onClick={e => e.stopPropagation()}>
                            <button className="modal-close" onClick={() => setGigDetailModal(null)}>✕</button>
                            <h2 style={{ marginBottom: 16, fontSize: 22 }}>{gigDetailModal.title}</h2>
                            {gigDetailModal.category && (
                                <span className="gig-category" style={{ marginBottom: 12, display: 'inline-block' }}>{gigDetailModal.category}</span>
                            )}
                            {gigDetailModal.images && gigDetailModal.images.length > 0 && (
                                <div className="modal-section">
                                    <h3>Portfolio</h3>
                                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '8px' }}>
                                        {gigDetailModal.images.map((url, i) => (
                                            <img key={i} src={url} alt={`Portfolio ${i + 1}`} style={{ width: '150px', height: '150px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border)' }} />
                                        ))}
                                    </div>
                                </div>
                            )}
                            {gigDetailModal.description ? (
                                <div className="modal-section">
                                    <h3>Description</h3>
                                    <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{gigDetailModal.description}</p>
                                </div>
                            ) : (
                                <div className="modal-section">
                                    <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No description provided.</p>
                                </div>
                            )}
                            {gigDetailModal.commitments && (
                                <div className="modal-section">
                                    <h3>What I Commit To</h3>
                                    <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{gigDetailModal.commitments}</p>
                                </div>
                            )}
                            {gigDetailModal.requirements && (
                                <div className="modal-section">
                                    <h3>Requirements</h3>
                                    <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{gigDetailModal.requirements}</p>
                                </div>
                            )}
                            <div className="modal-section">
                                <h3>Price</h3>
                                <span className="gig-price" style={{ fontSize: 24 }}>${gigDetailModal.price?.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                )
            }

            {toast && <div className={`toast ${toastType}`}>{toast}</div>}

            <style>{`

                     .swaps-hero-section {
                    background: #f0ede8;
                    padding: 24px;
                    border-radius: 16px;
                    margin-bottom: 24px;
                }
        .gigs-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 20px;
        }
        .gig-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--r-lg);
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          box-shadow: var(--shadow-sm);
          transition: all 0.2s;
        }
        .gig-card:hover { box-shadow: var(--shadow); transform: translateY(-2px); }
        .gig-category {
          display: inline-block;
          padding: 2px 8px;
          border-radius: var(--r-full);
          font-size: 11px;
          font-weight: 500;
          background: #FFF7ED;
          color: #C2410C;
          border: 1px solid #FDBA74;
          width: fit-content;
        }
        .gig-title { font-size: 17px; font-weight: 600; }
        .gig-desc { font-size: 13px; color: var(--text-secondary); line-height: 1.5; }
        .gig-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: auto;
          padding-top: 12px;
          border-top: 1px solid var(--border);
        }
        .gig-price { font-size: 20px; font-weight: 700; color: var(--text); }
        .gig-form {
          max-width: 500px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .gig-notice {
          padding: 16px 20px;
          background: #FFF7ED;
          border: 1px solid #FDBA74;
          border-radius: var(--r);
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 24px;
          font-size: 14px;
        }
        .gig-notice p { flex: 1; }
        .requests-list {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .request-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--r-lg);
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          box-shadow: var(--shadow-sm);
        }
        .request-header { display: flex; align-items: center; gap: 10px; }
        .request-name { font-weight: 600; font-size: 15px; }
        .request-detail { font-size: 13px; color: var(--text-secondary); }
        .request-gig {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
          background: var(--surface-alt);
          border-radius: var(--r-sm);
        }
        .request-actions { display: flex; gap: 8px; align-items: center; }
        .request-status {
          display: inline-block;
          padding: 4px 12px;
          border-radius: var(--r-full);
          font-size: 12px;
          font-weight: 500;
          width: fit-content;
        }
        .status-pending { background: #FEF3C7; color: #92400E; border: 1px solid #FCD34D; }
        .status-accepted { background: var(--green-light); color: var(--green); border: 1px solid var(--green-mid); }
        .status-declined { background: var(--accent-light); color: var(--accent); border: 1px solid var(--accent-mid); }
        .status-completed { background: #E0E7FF; color: #3730A3; border: 1px solid #A5B4FC; }
        .tab-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: var(--accent);
          color: white;
          font-size: 11px;
          font-weight: 600;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          margin-left: 6px;
        }
        .payment-badge {
          display: inline-block;
          padding: 3px 8px;
          border-radius: var(--r-full);
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
        }
        .payment-authorized { background: #FEF3C7; color: #92400E; border: 1px solid #FCD34D; }
        .payment-captured { background: var(--green-light); color: var(--green); border: 1px solid var(--green-mid); }
        .payment-refunded { background: #E0E7FF; color: #3730A3; border: 1px solid #A5B4FC; }
        .payment-disputed { background: var(--accent-light); color: var(--accent); border: 1px solid var(--accent-mid); }
        .gig-title-link { cursor: pointer; color: var(--primary); transition: color 0.15s; }
        .gig-title-link:hover { color: var(--accent); text-decoration: underline; }
        .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 500; }
        .modal { position: relative; background: var(--surface); border-radius: var(--r-lg); padding: 32px; max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
        .modal-close { position: absolute; top: 1rem; right: 1rem; background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-secondary); }
        .modal-section { margin-bottom: 20px; }
        .modal-section h3 { font-size: 13px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
      `}</style>
        </>
    );
}
