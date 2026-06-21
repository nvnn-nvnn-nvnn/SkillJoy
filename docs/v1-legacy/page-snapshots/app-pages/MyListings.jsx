import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useUser, useProfile } from '@/lib/stores';
import { Plus, Trash2 } from "lucide-react";

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

const PAYMENT_LABELS = {
    escrowed: { label: 'Escrowed', cls: 'pay-escrowed' },
    authorized: { label: 'Held', cls: 'pay-held' },
    captured: { label: 'Paid', cls: 'pay-paid' },
    released: { label: 'Released', cls: 'pay-released' },
    refunded: { label: 'Refunded', cls: 'pay-refunded' },
    cleared: { label: 'Cleared', cls: 'pay-cleared' },
};

function PayBadge({ status }) {
    if (!status) return null;
    const info = PAYMENT_LABELS[status] || { label: status, cls: '' };
    return <span className={`ml-pay-badge ${info.cls}`}>{info.label}</span>;
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

    // Create / edit gig form
    const [editingGig, setEditingGig] = useState(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [price, setPrice] = useState('');
    const [category, setCategory] = useState('');
    const [commitments, setCommitments] = useState('');
    const [requirements, setRequirements] = useState('');
    const [images, setImages] = useState([]);
    const [urlInput, setUrlInput] = useState('');
    const [uploadingImage, setUploadingImage] = useState(false);
    const [faqs, setFaqs] = useState([]);
    const [tags, setTags] = useState([]);
    const [tagInput, setTagInput] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [gigDetailModal, setGigDetailModal] = useState(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [pendingDeleteId, setPendingDeleteId] = useState(null);


    // Gig Active

    const [gigActive, setGigActive] = useState(true);

    // state varibles. 

    useEffect(() => {
        if (!user) { navigate('/login'); return; }
        loadData(); // eslint-disable-line react-hooks/immutability
    }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

    async function loadData() {
        setBusy(true);
        const [gigsRes, incomingRes, sentRes, completedRes] = await Promise.all([
            supabase.from('gigs').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
            supabase.from('gig_requests').select('*, gig:gigs!gig_id(id, title, price, category, description, commitments, requirements, images), requester:profiles!requester_id(id, full_name)').eq('provider_id', user.id).order('created_at', { ascending: false }),
            supabase.from('gig_requests').select('*, gig:gigs!gig_id(id, title, price, category, description, commitments, requirements, images), provider:profiles!provider_id(id, full_name)').eq('requester_id', user.id).order('created_at', { ascending: false }),
            supabase.from('gig_requests').select('*, gig:gigs!gig_id(id, title, price, category, description, commitments, requirements, images), requester:profiles!requester_id(id, full_name), provider:profiles!provider_id(id, full_name)').or(`requester_id.eq.${user.id},provider_id.eq.${user.id}`).eq('status', 'completed').order('created_at', { ascending: false }),
        ]);
        if (!gigsRes.error && gigsRes.data) setMyGigs(gigsRes.data);
        if (!incomingRes.error && incomingRes.data) setIncoming(incomingRes.data);
        if (!sentRes.error && sentRes.data) setSentRequests(sentRes.data);
        if (!completedRes.error && completedRes.data) setCompleted(completedRes.data);
        setBusy(false);
    }

    function showToast(msg, type = 'success') {
        setToast(msg); setToastType(type);
        setTimeout(() => setToast(''), 3500);
    }

    // ── Image helpers ──
    async function handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        setUploadingImage(true);
        const ext = file.name.split('.').pop();
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('gig-images').upload(path, file);
        if (upErr) { showToast('Upload failed: ' + upErr.message, 'error'); setUploadingImage(false); return; }
        const { data } = supabase.storage.from('gig-images').getPublicUrl(path);
        setImages(prev => [...prev, data.publicUrl]);
        setUploadingImage(false);
        e.target.value = '';
    }

    function addImageUrl() {
        const url = urlInput.trim();
        if (!url) return;
        setImages(prev => [...prev, url]);
        setUrlInput('');
    }

    // ── Open edit mode ──
    function handleEditGig(gig) {
        setEditingGig(gig);
        setTitle(gig.title || ''); setDescription(gig.description || '');
        setPrice(gig.price?.toString() || ''); setCategory(gig.category || '');
        setCommitments(gig.commitments || ''); setRequirements(gig.requirements || '');
        setImages(gig.images || []); setFaqs(gig.faqs || []);
        setTags(gig.tags || []); setUrlInput('');
        setTab('create');
        setGigActive(gig.active ?? true)

    }

    function resetForm() {
        setEditingGig(null);
        setTitle(''); setDescription(''); setPrice(''); setCategory('');
        setCommitments(''); setRequirements(''); setImages([]); setFaqs([]); setUrlInput(''); setTags([]); setTagInput('');
        setGigActive(true);
    }

    async function setActiveGig(gigId, active) {
        const { error } = await supabase.from('gigs').update({ active }).eq('id', gigId).eq('user_id', user.id);
        if (error) { showToast(error.message, 'error'); return; }
        setMyGigs(prev => prev.map(g => g.id === gigId ? { ...g, active } : g));
        showToast(active ? 'Gig activated' : 'Gig deactivated', 'success');
    }

    // ── Create / Update Gig ──
    async function handleCreateGig(e) {
        e.preventDefault();
        if (!profile?.stripe_onboarded || !profile?.offers_gigs) { showToast('Set up Stripe payouts and enable gig services before listing.', 'error'); return; }
        if (!title.trim() || !price) { showToast('Please fill in title and price', 'error'); return; }

        setSubmitting(true);
        const validFaqs = faqs.filter(faq => faq.question.trim() && faq.answer.trim());
        const payload = {
            title: title.trim(), description: description.trim(),
            price: parseFloat(price), category: category || null,
            commitments: commitments.trim() || null, requirements: requirements.trim() || null,
            images: images.length > 0 ? images : null,
            faqs: validFaqs.length > 0 ? validFaqs : null,
            tags: tags.length > 0 ? tags : null,
            active: gigActive,
        };

        const universityDomain = (profile?.college_verified && profile?.university_domain) ? profile.university_domain : null;
        const payloadWithDomain = { ...payload, university_domain: universityDomain };

        if (editingGig) {
            const { error } = await supabase.from('gigs').update(payloadWithDomain).eq('id', editingGig.id).eq('user_id', user.id);
            setSubmitting(false);
            if (error) { showToast(error.message, 'error'); return; }
            showToast('Gig updated!', 'success');
        } else {
            const { error } = await supabase.from('gigs').insert({ user_id: user.id, ...payloadWithDomain });
            setSubmitting(false);
            if (error) { showToast(error.message, 'error'); return; }
            showToast('Gig listed!', 'success');
        }

        resetForm(); loadData(); setTab('listings');
    }

    // ── Delete Gig ──
    function handleDeleteGig(gigId) { setPendingDeleteId(gigId); setShowDeleteModal(true); }

    async function confirmDeleteGig() {
        setShowDeleteModal(false);
        const { data, error } = await supabase.from('gigs').delete().eq('id', pendingDeleteId).eq('user_id', user.id).select();
        setPendingDeleteId(null);
        if (error) { showToast(error.message, 'error'); return; }
        if (!data || data.length === 0) { showToast('Failed to delete — check RLS policies', 'error'); return; }
        setMyGigs(prev => prev.filter(g => g.id !== pendingDeleteId));
        showToast('Gig removed', 'success');
    }

    // ── Respond to incoming request ──
    async function respondToRequest(requestId, status) {
        const { error } = await supabase.from('gig_requests').update({ status }).eq('id', requestId).eq('provider_id', user.id);
        if (error) { showToast(error.message, 'error'); return; }
        setIncoming(prev => prev.map(r => r.id === requestId ? { ...r, status } : r));
        showToast(status === 'accepted' ? 'Request accepted!' : 'Request declined', 'success');
    }

    // ── Cancel sent request ──
    async function cancelRequest(requestId) {
        if (!window.confirm('Cancel this hire request?')) return;
        const { data, error } = await supabase.from('gig_requests').delete().eq('id', requestId).eq('requester_id', user.id).select();
        if (error) { showToast(error.message, 'error'); return; }
        if (!data || data.length === 0) { showToast('Failed to cancel — check RLS policies', 'error'); return; }
        setSentRequests(prev => prev.filter(r => r.id !== requestId));
        showToast('Request cancelled', 'success');
    }

    const pendingIncoming = incoming.filter(r => r.status === 'pending').length;

    const TABS = [
        { id: 'listings', label: 'My Gigs', count: myGigs.length },
        { id: 'incoming', label: 'Incoming', badge: pendingIncoming || null },
        { id: 'sent', label: 'Sent', count: sentRequests.length },
        { id: 'completed', label: 'Completed', count: completed.length },
    ];

    return (
        <>
            <title>My Listings — SkillJoy</title>

            <div className="page ml-page">

                {/* ── Hero ── */}
                <div className="ml-hero">
                    <div className="ml-hero-top">
                        <div>
                            <h1 className="ml-title">My Listings</h1>
                            <p className="ml-subtitle">Manage your gigs, requests, and orders.</p>
                        </div>
                        <div className="ml-hero-actions">
                            <button className="ml-btn-create" onClick={() => { resetForm(); setTab('create'); }}>
                                <Plus size={16} /> New Gig
                            </button>
                            <Link to="/gigs" className="ml-btn-browse">Browse Gigs</Link>
                        </div>
                    </div>

                    {/* Stats row */}
                    {!busy && (
                        <div className="ml-stats">
                            <div className="ml-stat">
                                <span className="ml-stat-val">{myGigs.length}</span>
                                <span className="ml-stat-label">Listed</span>
                            </div>
                            <div className="ml-stat-divider" />
                            <div className="ml-stat">
                                <span className="ml-stat-val">{pendingIncoming}</span>
                                <span className="ml-stat-label">Pending</span>
                            </div>
                            <div className="ml-stat-divider" />
                            <div className="ml-stat">
                                <span className="ml-stat-val">{completed.length}</span>
                                <span className="ml-stat-label">Completed</span>
                            </div>
                        </div>
                    )}

                    {/* Notices */}
                    {(profile?.service_type !== 'gigs' && profile?.service_type !== 'both') && (
                        <div className="ml-notice ml-notice-warn">
                            <p>Your profile is set to <strong>Skill Swap only</strong>. Update to "Paid Services" or "Both" so others know you're available for hire.</p>
                            <button className="ml-notice-btn" onClick={() => navigate('/onboarding')}>Update Profile</button>
                        </div>
                    )}
                </div>

                {/* ── Tabs ── */}
                <div className="ml-tabs">
                    {TABS.map(t => (
                        <button
                            key={t.id}
                            className={`ml-tab ${tab === t.id ? 'active' : ''}`}
                            onClick={() => setTab(t.id)}
                        >
                            {t.label}
                            {t.badge ? <span className="ml-tab-badge">{t.badge}</span> : null}
                            {t.count != null && !t.badge ? <span className="ml-tab-count">{t.count}</span> : null}
                        </button>
                    ))}
                </div>

                {busy ? (
                    <div className="ml-loading">
                        <div className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
                    </div>
                ) : (
                    <div className="ml-body">

                        {/* ── My Gigs ── */}
                        {tab === 'listings' && (
                            myGigs.length === 0 ? (
                                <div className="ml-empty">
                                    <div className="ml-empty-icon">🛍️</div>
                                    <h3>No gigs listed yet</h3>
                                    <p>Create your first gig to start earning.</p>
                                    <button className="ml-btn-create" onClick={() => { resetForm(); setTab('create'); }}>
                                        <Plus size={16} /> Create a Gig
                                    </button>
                                </div>
                            ) : (
                                <div className="ml-gig-grid">
                                    {myGigs.map((gig, i) => (
                                        <div key={gig.id} className="ml-gig-card fade-up" style={{ animationDelay: `${i * 0.04}s` }}>
                                            {/* Image preview */}
                                            {gig.images?.[0] && (
                                                <div className="ml-gig-thumb" onClick={() => setGigDetailModal(gig)}>
                                                    <img src={gig.images[0]} alt="" />
                                                </div>
                                            )}
                                            <div className="ml-gig-body">
                                                <div className="ml-gig-top">
                                                    {gig.category && <span className="ml-gig-cat">{gig.category}</span>}
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        {gig.active === false && <span className="ml-gig-inactive-badge">Inactive</span>}
                                                        <span className="ml-gig-price">${gig.price?.toFixed(2)}</span>
                                                    </div>
                                                </div>
                                                <h3 className="ml-gig-title" onClick={() => setGigDetailModal(gig)}>{gig.title}</h3>
                                                {gig.description && <p className="ml-gig-desc">{gig.description}</p>}
                                                {gig.tags?.length > 0 && (
                                                    <div className="ml-gig-tags">
                                                        {gig.tags.slice(0, 3).map(t => <span key={t} className="ml-gig-tag">{t}</span>)}
                                                        {gig.tags.length > 3 && <span className="ml-gig-tag ml-gig-tag-more">+{gig.tags.length - 3}</span>}
                                                    </div>
                                                )}
                                                <div className="ml-gig-actions">
                                                    <button className="ml-btn-edit" onClick={() => handleEditGig(gig)}>Edit</button>
                                                    <button
                                                        className={`ml-btn-toggle ${gig.active === false ? 'ml-btn-toggle-off' : ''}`}
                                                        onClick={() => setActiveGig(gig.id, gig.active === false)}
                                                        title={gig.active === false ? 'Activate gig' : 'Deactivate gig'}
                                                    >
                                                        {gig.active === false ? 'Activate' : 'Deactivate'}
                                                    </button>
                                                    <button className="ml-btn-delete" onClick={() => handleDeleteGig(gig.id)}>Remove</button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )
                        )}

                        {/* ── Incoming ── */}
                        {tab === 'incoming' && (
                            incoming.length === 0 ? (
                                <div className="ml-empty">
                                    <div className="ml-empty-icon">📥</div>
                                    <h3>No hire requests yet</h3>
                                    <p>When someone wants to hire you, their request will show up here.</p>
                                </div>
                            ) : (
                                <div className="ml-req-list">
                                    {incoming.map((req, i) => (
                                        <div key={req.id} className="ml-req-card fade-up" style={{ animationDelay: `${i * 0.04}s` }}>
                                            <div className="ml-req-left">
                                                <div className="ml-avatar">{initials(req.requester?.full_name)}</div>
                                                <div className="ml-req-info">
                                                    <p className="ml-req-name">{req.requester?.full_name ?? 'Unknown'}</p>
                                                    <p className="ml-req-sub">wants to hire you for <strong className="ml-req-gig-link" onClick={() => setGigDetailModal(req.gig)}>{req.gig?.title}</strong></p>
                                                </div>
                                            </div>
                                            <div className="ml-req-right">
                                                <div className="ml-req-meta">
                                                    <span className="ml-req-price">${req.gig?.price?.toFixed(2)}</span>
                                                    <PayBadge status={req.payment_status} />
                                                </div>
                                                {req.status === 'pending' ? (
                                                    <div className="ml-req-actions">
                                                        <button className="ml-btn-accept" onClick={() => respondToRequest(req.id, 'accepted')}>Accept</button>
                                                        <button className="ml-btn-decline" onClick={() => respondToRequest(req.id, 'declined')}>Decline</button>
                                                    </div>
                                                ) : req.status === 'accepted' ? (
                                                    <div className="ml-req-actions">
                                                        <span className="ml-status ml-status-accepted">Accepted</span>
                                                        <button className="ml-btn-chat" onClick={() => navigate('/chat')}>Chat</button>
                                                    </div>
                                                ) : (
                                                    <span className="ml-status ml-status-declined">Declined</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )
                        )}

                        {/* ── Sent ── */}
                        {tab === 'sent' && (
                            sentRequests.length === 0 ? (
                                <div className="ml-empty">
                                    <div className="ml-empty-icon">📤</div>
                                    <h3>No sent requests</h3>
                                    <p>When you hire someone from the <Link to="/gigs" style={{ color: 'var(--accent)', fontWeight: 600 }}>Gigs</Link> page, your request shows here.</p>
                                </div>
                            ) : (
                                <div className="ml-req-list">
                                    {sentRequests.map((req, i) => (
                                        <div key={req.id} className="ml-req-card fade-up" style={{ animationDelay: `${i * 0.04}s` }}>
                                            <div className="ml-req-left">
                                                <div className="ml-avatar">{initials(req.provider?.full_name)}</div>
                                                <div className="ml-req-info">
                                                    <p className="ml-req-name">{req.provider?.full_name ?? 'Unknown'}</p>
                                                    <p className="ml-req-sub">for <strong className="ml-req-gig-link" onClick={() => setGigDetailModal(req.gig)}>{req.gig?.title}</strong></p>
                                                </div>
                                            </div>
                                            <div className="ml-req-right">
                                                <div className="ml-req-meta">
                                                    <span className="ml-req-price">${req.gig?.price?.toFixed(2)}</span>
                                                    <PayBadge status={req.payment_status} />
                                                </div>
                                                {req.status === 'pending' ? (
                                                    <div className="ml-req-actions">
                                                        <span className="ml-status ml-status-pending">Pending</span>
                                                        <button className="ml-btn-decline" onClick={() => cancelRequest(req.id)}>Cancel</button>
                                                    </div>
                                                ) : req.status === 'accepted' ? (
                                                    <div className="ml-req-actions">
                                                        <span className="ml-status ml-status-accepted">Accepted</span>
                                                        <button className="ml-btn-chat" onClick={() => navigate('/chat')}>Chat</button>
                                                    </div>
                                                ) : (
                                                    <span className="ml-status ml-status-declined">Declined</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )
                        )}

                        {/* ── Completed ── */}
                        {tab === 'completed' && (
                            completed.length === 0 ? (
                                <div className="ml-empty">
                                    <div className="ml-empty-icon">✅</div>
                                    <h3>No completed gigs yet</h3>
                                    <p>Once a gig is marked complete, it will appear here.</p>
                                </div>
                            ) : (
                                <div className="ml-req-list">
                                    {completed.map((req, i) => {
                                        const isProvider = req.provider_id === user.id;
                                        const other = isProvider ? req.requester : req.provider;
                                        return (
                                            <div key={req.id} className="ml-req-card fade-up" style={{ animationDelay: `${i * 0.04}s` }}>
                                                <div className="ml-req-left">
                                                    <div className="ml-avatar">{initials(other?.full_name)}</div>
                                                    <div className="ml-req-info">
                                                        <p className="ml-req-name">{other?.full_name ?? 'Unknown'}</p>
                                                        <p className="ml-req-sub">{isProvider ? 'hired you for' : 'you hired for'} <strong>{req.gig?.title}</strong></p>
                                                    </div>
                                                </div>
                                                <div className="ml-req-right">
                                                    <span className="ml-req-price">${req.gig?.price?.toFixed(2)}</span>
                                                    <span className="ml-status ml-status-done">Completed</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )
                        )}

                        {/* ── Create / Edit Gig ── */}
                        {tab === 'create' && (
                            <div className="ml-form-wrap">
                                <div className="ml-form-header">
                                    <h2>{editingGig ? 'Edit Gig' : 'Create New Gig'}</h2>
                                    {editingGig && (
                                        <button className="ml-btn-ghost" onClick={() => { resetForm(); setTab('listings'); }}>Cancel</button>
                                    )}
                                </div>

                                {(!profile?.stripe_onboarded || !profile?.offers_gigs) && (
                                    <div className="ml-notice ml-notice-warn" style={{ marginBottom: 24 }}>
                                        <p style={{ fontWeight: 700, marginBottom: 8 }}>Before you can list a gig:</p>
                                        <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                            {!profile?.stripe_onboarded && (
                                                <li>Connect Stripe to receive payments — <Link to="/profile" style={{ fontWeight: 600 }}>Set up payouts</Link></li>
                                            )}
                                            {!profile?.offers_gigs && (
                                                <li>Enable gig services in your settings — <Link to="/settings" style={{ fontWeight: 600 }}>Go to Settings</Link></li>
                                            )}
                                        </ul>
                                    </div>
                                )}

                                <form onSubmit={handleCreateGig} className="ml-form">
                                    <div className="ml-form-section">
                                        <h3 className="ml-form-section-title">Basic Info</h3>
                                        <div className="ml-form-row">
                                            <div className="field" style={{ flex: 2 }}>
                                                <label htmlFor="gig-title">Title</label>
                                                <input id="gig-title" type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Laundry pickup & delivery" />
                                            </div>
                                            <div className="field" style={{ flex: 1 }}>
                                                <label htmlFor="gig-price">Price ($)</label>
                                                <input id="gig-price" type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="15.00" />
                                            </div>
                                        </div>
                                        <div className="field">
                                            <label htmlFor="gig-category">Category</label>
                                            <select id="gig-category" value={category} onChange={e => setCategory(e.target.value)}>
                                                <option value="">Select a category...</option>
                                                {GIG_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                            </select>
                                        </div>
                                        <div className="field">
                                            <label htmlFor="gig-desc">Description <span className="ml-optional">optional</span></label>
                                            <textarea id="gig-desc" value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe what you offer..." rows={3} style={{ resize: 'vertical' }} />
                                        </div>

                                        
                                    </div>

                                    <div className="ml-form-section">
                                        <h3 className="ml-form-section-title">Details</h3>
                                        <div className="field">
                                            <label htmlFor="gig-commitments">What I Commit To <span className="ml-optional">optional</span></label>
                                            <textarea id="gig-commitments" value={commitments} onChange={e => setCommitments(e.target.value)} placeholder="e.g. Fast turnaround, quality work..." rows={3} style={{ resize: 'vertical' }} />
                                        </div>
                                        <div className="field">
                                            <label htmlFor="gig-requirements">Requirements <span className="ml-optional">optional</span></label>
                                            <textarea id="gig-requirements" value={requirements} onChange={e => setRequirements(e.target.value)} placeholder="e.g. Must provide materials, 24hr notice..." rows={3} style={{ resize: 'vertical' }} />
                                        </div>
                                    </div>

                                    <div className="ml-form-section">
                                        <h3 className="ml-form-section-title">Media</h3>
                                        <div className="field">
                                            <label>Portfolio Images <span className="ml-optional">optional</span></label>
                                            {images.length > 0 && (
                                                <div className="ml-img-grid">
                                                    {images.map((url, i) => (
                                                        <div key={i} className="ml-img-thumb">
                                                            <img src={url} alt="" />
                                                            <button type="button" className="ml-img-remove" onClick={() => setImages(prev => prev.filter((_, j) => j !== i))}>✕</button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            <div className="ml-img-actions">
                                                <label className="ml-upload-btn">
                                                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileUpload} disabled={uploadingImage} />
                                                    {uploadingImage ? 'Uploading...' : 'Upload file'}
                                                </label>
                                                <div className="ml-url-row">
                                                    <input type="text" value={urlInput} onChange={e => setUrlInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addImageUrl())} placeholder="Or paste image URL..." style={{ flex: 1 }} />
                                                    <button type="button" className="ml-btn-sm" onClick={addImageUrl}>Add</button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="ml-form-section">
                                        <h3 className="ml-form-section-title">FAQs <span className="ml-optional">optional</span></h3>
                                        {faqs.map((faq, index) => (
                                            <div key={index} className="ml-faq-item">
                                                <div className="ml-faq-header">
                                                    <span className="ml-faq-num">Q{index + 1}</span>
                                                    <button type="button" className="ml-faq-remove" onClick={() => setFaqs(faqs.filter((_, i) => i !== index))}><Trash2 size={14} /></button>
                                                </div>
                                                <input type="text" placeholder="Question" value={faq.question} onChange={e => { const n = [...faqs]; n[index].question = e.target.value; setFaqs(n); }} />
                                                <textarea placeholder="Answer" value={faq.answer} onChange={e => { const n = [...faqs]; n[index].answer = e.target.value; setFaqs(n); }} rows={2} style={{ resize: 'vertical' }} />
                                            </div>
                                        ))}
                                        <button type="button" className="ml-add-btn" onClick={() => setFaqs([...faqs, { question: '', answer: '' }])}>
                                            <Plus size={14} /> Add FAQ
                                        </button>
                                    </div>

                                    <div className="ml-form-section">
                                        <h3 className="ml-form-section-title">Tags <span className="ml-optional">optional, max 8</span></h3>
                                        {tags.length > 0 && (
                                            <div className="ml-tag-list">
                                                {tags.map(tag => (
                                                    <span key={tag} className="ml-tag">
                                                        {tag}
                                                        <button type="button" onClick={() => setTags(tags.filter(t => t !== tag))}>×</button>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        <div className="ml-url-row">
                                            <input type="text" value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => {
                                                if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
                                                    e.preventDefault();
                                                    const t = tagInput.trim().toLowerCase().replace(/,/g, '');
                                                    if (t && !tags.includes(t) && tags.length < 8) setTags([...tags, t]);
                                                    setTagInput('');
                                                }
                                            }} placeholder="e.g. fast delivery, remote" style={{ flex: 1 }} />
                                            <button type="button" className="ml-btn-sm" onClick={() => {
                                                const t = tagInput.trim().toLowerCase().replace(/,/g, '');
                                                if (t && !tags.includes(t) && tags.length < 8) { setTags([...tags, t]); setTagInput(''); }
                                            }}>Add</button>
                                        </div>
                                        {/* Set Active */}

                                        <div>
                                             <h3 className="ml-form-section-title"> Set Active </h3>
                                
                                            <button
                                                type='button'
                                                className='ml-btn-ghost'
                                                style={{
                                                    marginTop: '15px'
                                                }}
                                                onClick={() => {
                                                    setGigActive(prev => !prev)
                                                }}
                                            >
                                                 {gigActive ? "Deactivate Gig" : "Activate Gig"}
                                           
                                            </button>
                                            <p
                                                className= 'ml-active-note'
                                            >
                                                Gigs are set to active by default. Please deactivate any gig you do not wish to be currently active.
                                            </p>
                                        </div>


                                    </div>

                                    <div className="ml-form-footer">
                                        <button className="ml-btn-create" type="submit" disabled={submitting || !title.trim() || !price || !profile?.stripe_onboarded || !profile?.offers_gigs}>
                                            {submitting ? (editingGig ? 'Saving...' : 'Listing...') : (editingGig ? 'Save Changes' : 'List Gig')}
                                        </button>
                                        {editingGig && (
                                            <button type="button" className="ml-btn-ghost" onClick={() => { resetForm(); setTab('listings'); }}>Cancel</button>
                                        )}
                                    </div>
                                </form>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── Gig Detail Modal ── */}
            {gigDetailModal && (
                <div className="ml-modal-bg" onClick={() => setGigDetailModal(null)}>
                    <div className="ml-modal" onClick={e => e.stopPropagation()}>
                        <button className="modal-close" onClick={() => setGigDetailModal(null)}>✕</button>
                        <h2 className="ml-modal-title">{gigDetailModal.title}</h2>
                        <div className="ml-modal-meta">
                            {gigDetailModal.category && <span className="ml-gig-cat">{gigDetailModal.category}</span>}
                            <span className="ml-gig-price">${gigDetailModal.price?.toFixed(2)}</span>
                        </div>
                        {gigDetailModal.images?.length > 0 && (
                            <div className="ml-modal-section">
                                <h4>Portfolio</h4>
                                <div className="ml-modal-images">
                                    {gigDetailModal.images.map((url, i) => (
                                        <img key={i} src={url} alt={`Portfolio ${i + 1}`} />
                                    ))}
                                </div>
                            </div>
                        )}
                        {gigDetailModal.description ? (
                            <div className="ml-modal-section">
                                <h4>Description</h4>
                                <p>{gigDetailModal.description}</p>
                            </div>
                        ) : (
                            <div className="ml-modal-section">
                                <p style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>No description provided.</p>
                            </div>
                        )}
                        {gigDetailModal.commitments && (
                            <div className="ml-modal-section"><h4>What I Commit To</h4><p>{gigDetailModal.commitments}</p></div>
                        )}
                        {gigDetailModal.requirements && (
                            <div className="ml-modal-section"><h4>Requirements</h4><p>{gigDetailModal.requirements}</p></div>
                        )}
                        <Link to={`/gigs/${gigDetailModal.id}`} className="ml-modal-link" onClick={() => setGigDetailModal(null)}>
                            View full gig page &rarr;
                        </Link>
                    </div>
                </div>
            )}

            {/* ── Delete Confirm ── */}
            {showDeleteModal && (
                <div className="ml-modal-bg" onClick={() => setShowDeleteModal(false)}>
                    <div className="ml-modal ml-modal-sm" onClick={e => e.stopPropagation()}>
                        <div style={{ fontSize: 40, marginBottom: 8, textAlign: 'center' }}>🗑️</div>
                        <h2 style={{ fontSize: 20, fontWeight: 700, textAlign: 'center', margin: '0 0 8px' }}>Remove Gig?</h2>
                        <p style={{ fontSize: 14, color: 'var(--text-secondary)', textAlign: 'center', margin: '0 0 24px', lineHeight: 1.5 }}>
                            This will permanently remove the listing. Active orders won't be affected.
                        </p>
                        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                            <button className="ml-btn-ghost" onClick={() => setShowDeleteModal(false)}>Cancel</button>
                            <button className="btn btn-danger" onClick={confirmDeleteGig}>Yes, Remove</button>
                        </div>
                    </div>
                </div>
            )}

            {toast && <div className={`toast ${toastType}`}>{toast}</div>}

            <style>{`
                .ml-page { padding-bottom: 80px; }

                /* ── Hero ── */
                .ml-hero {
                    background: var(--surface);
                    border: 1px solid var(--border);
                    border-radius: 16px;
                    padding: 28px;
                    margin-bottom: 0;
                }
                .ml-hero-top {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 16px;
                    flex-wrap: wrap;
                }
                .ml-title {
                    font-size: 28px;
                    font-weight: 700;
                    letter-spacing: -0.02em;
                    margin: 0 0 4px;
                }
                .ml-subtitle {
                    font-size: 15px;
                    color: var(--text-secondary);
                    margin: 0;
                }
                .ml-hero-actions { display: flex; gap: 10px; flex-shrink: 0; }

                /* ── Stats ── */
                .ml-stats {
                    display: flex;
                    gap: 0;
                    margin-top: 24px;
                    padding-top: 20px;
                    border-top: 1px solid var(--border);
                }
                .ml-stat {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    flex: 1;
                }
                .ml-stat-val { font-size: 24px; font-weight: 700; letter-spacing: -0.02em; }
                .ml-stat-label { font-size: 12px; color: var(--text-muted); font-weight: 500; margin-top: 2px; }
                .ml-stat-divider { width: 1px; background: var(--border); margin: 0; }

                /* ── Notices ── */
                .ml-notice {
                    padding: 14px 18px;
                    border-radius: 10px;
                    font-size: 14px;
                    line-height: 1.5;
                    margin-top: 20px;
                    display: flex;
                    align-items: center;
                    gap: 14px;
                    flex-wrap: wrap;
                }
                .ml-notice p { flex: 1; margin: 0; min-width: 200px; }
                .ml-notice-warn { background: #FFF7ED; border: 1px solid #FDBA74; color: #78350f; }
                .ml-notice-btn {
                    padding: 7px 16px;
                    border-radius: 8px;
                    border: 1px solid #FDBA74;
                    background: #fff;
                    color: #92400E;
                    font-size: 13px;
                    font-weight: 600;
                    cursor: pointer;
                    font-family: inherit;
                    white-space: nowrap;
                    transition: background 0.14s;
                }
                .ml-notice-btn:hover { background: #FEF3C7; }

                /* ── Tabs ── */
                .ml-tabs {
                    display: flex;
                    gap: 4px;
                    padding: 6px;
                    background: var(--surface-alt);
                    border-radius: 12px;
                    margin: 16px 0;
                    overflow-x: auto;
                    -webkit-overflow-scrolling: touch;
                }
                .ml-tab {
                    flex: 1;
                    min-width: max-content;
                    padding: 10px 16px;
                    border: none;
                    border-radius: 8px;
                    background: transparent;
                    color: var(--text-secondary);
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    font-family: inherit;
                    transition: all 0.15s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    white-space: nowrap;
                }
                .ml-tab:hover { color: var(--text); background: var(--surface); }
                .ml-tab.active {
                    background: var(--surface);
                    color: var(--text);
                    font-weight: 600;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
                }
                .ml-tab-badge {
                    display: inline-flex; align-items: center; justify-content: center;
                    background: var(--accent); color: white;
                    font-size: 11px; font-weight: 700;
                    min-width: 18px; height: 18px; padding: 0 5px;
                    border-radius: 9px;
                }
                .ml-tab-count {
                    font-size: 12px;
                    color: var(--text-muted);
                    font-weight: 400;
                }

                /* ── Loading / Empty ── */
                .ml-loading { display: flex; justify-content: center; padding: 80px 0; }
                .ml-body { min-height: 200px; }
                .ml-empty {
                    text-align: center;
                    padding: 64px 20px;
                    background: var(--surface);
                    border: 1px dashed var(--border-strong);
                    border-radius: 14px;
                }
                .ml-empty-icon { font-size: 48px; margin-bottom: 12px; }
                .ml-empty h3 { font-size: 18px; font-weight: 600; margin: 0 0 6px; }
                .ml-empty p { font-size: 14px; color: var(--text-secondary); margin: 0 0 20px; }

                /* ── Buttons ── */
                .ml-btn-create {
                    display: inline-flex; align-items: center; gap: 6px;
                    padding: 10px 22px;
                    background: var(--accent); color: #fff;
                    border: none; border-radius: 10px;
                    font-size: 14px; font-weight: 600;
                    cursor: pointer; font-family: inherit;
                    transition: background 0.15s;
                }

                    /* Mini warning box for active toggle */
                .ml-active-note {
                background: #FFFBEB;
                border-left: 3px solid #F59E0B;
                padding: 8px 12px;
                border-radius: 8px;
                font-size: 12px;
                color: #B45309;
                margin-top: 12px;
                line-height: 1.4;
                display: flex;
                align-items: center;
                gap: 8px;
                }
                .ml-active-note::before {
                content: "ℹ️";
                font-size: 14px;
                flex-shrink: 0;
                }
                .ml-btn-create:hover { background: var(--accent-hover); }
                .ml-btn-create:disabled { opacity: 0.4; cursor: not-allowed; }
                .ml-btn-browse {
                    display: inline-flex; align-items: center;
                    padding: 10px 20px;
                    background: var(--surface); color: var(--text);
                    border: 1.5px solid var(--border-strong);
                    border-radius: 10px;
                    font-size: 14px; font-weight: 600;
                    text-decoration: none; font-family: inherit;
                    transition: border-color 0.14s;
                }
                .ml-btn-browse:hover { border-color: var(--text); }
                .ml-btn-edit, .ml-btn-delete {
                    padding: 6px 14px;
                    border-radius: 8px;
                    font-size: 13px;
                    font-weight: 500;
                    cursor: pointer;
                    font-family: inherit;
                    border: 1px solid var(--border);
                    transition: all 0.14s;
                }
                .ml-btn-edit { background: var(--surface); color: var(--text); }
                .ml-btn-edit:hover { border-color: var(--text); }
                .ml-btn-delete { background: var(--surface); color: var(--accent); border-color: var(--accent-mid); }
                .ml-btn-delete:hover { background: var(--accent-light); }
                .ml-btn-accept {
                    padding: 7px 18px; border-radius: 8px; border: none;
                    background: #15803d; color: #fff;
                    font-size: 13px; font-weight: 600;
                    cursor: pointer; font-family: inherit;
                }
                .ml-btn-decline {
                    padding: 7px 18px; border-radius: 8px;
                    border: 1px solid var(--accent-mid); background: var(--surface); color: var(--accent);
                    font-size: 13px; font-weight: 600;
                    cursor: pointer; font-family: inherit;
                }
                .ml-btn-decline:hover { background: var(--accent-light); }
                .ml-btn-chat {
                    padding: 7px 18px; border-radius: 8px; border: none;
                    background: var(--accent); color: #fff;
                    font-size: 13px; font-weight: 600;
                    cursor: pointer; font-family: inherit;
                    transition: background 0.14s;
                }
                .ml-btn-chat:hover { background: var(--accent-hover); }
                .ml-btn-ghost {
                    padding: 8px 18px; border-radius: 8px;
                    border: 1px solid var(--border-strong); background: var(--surface); color: var(--text);
                    font-size: 14px; font-weight: 500;
                    cursor: pointer; font-family: inherit;
                }
                .ml-btn-ghost:hover { border-color: var(--text); }
                .ml-btn-sm {
                    padding: 8px 16px; border-radius: 8px;
                    border: 1.5px solid var(--border-strong); background: var(--surface-alt); color: var(--text-secondary);
                    font-size: 13px; font-weight: 600;
                    cursor: pointer; font-family: inherit;
                    transition: all 0.14s;
                }
                .ml-btn-sm:hover { border-color: var(--accent-mid); color: var(--text); background: var(--primary-light); }

                /* ── Gig Cards ── */
                .ml-gig-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                    gap: 16px;
                }
                .ml-gig-card {
                    background: var(--surface);
                    border: 1px solid var(--border);
                    border-radius: 14px;
                    overflow: hidden;
                    transition: box-shadow 0.2s, transform 0.2s;
                }
                .ml-gig-card:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.06); transform: translateY(-2px); }
                .ml-gig-thumb {
                    height: 160px;
                    overflow: hidden;
                    cursor: pointer;
                    background: var(--surface-alt);
                }
                .ml-gig-thumb img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.25s; }
                .ml-gig-card:hover .ml-gig-thumb img { transform: scale(1.03); }
                .ml-gig-body { padding: 18px; display: flex; flex-direction: column; gap: 10px; }
                .ml-gig-top { display: flex; justify-content: space-between; align-items: center; }
                .ml-gig-cat {
                    padding: 3px 10px;
                    border-radius: 100px;
                    font-size: 11px; font-weight: 600;
                    background: #FFF7ED; color: #C2410C; border: 1px solid #FDBA74;
                    letter-spacing: 0.02em;
                }
                .ml-gig-price { font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }
                .ml-gig-title {
                    font-size: 17px; font-weight: 600; margin: 0;
                    cursor: pointer; transition: color 0.14s;
                }
                .ml-gig-title:hover { color: var(--accent); }
                .ml-gig-desc {
                    font-size: 13px; color: var(--text-secondary); line-height: 1.5;
                    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
                }
                .ml-gig-tags { display: flex; flex-wrap: wrap; gap: 6px; }
                .ml-gig-tag {
                    padding: 2px 8px; border-radius: 6px;
                    font-size: 11px; font-weight: 500;
                    background: var(--surface-alt); color: var(--text-secondary); border: 1px solid var(--border);
                }
                .ml-gig-tag-more { color: var(--text-muted); }
                .ml-gig-actions {
                    display: flex; gap: 8px;
                    padding-top: 12px; margin-top: auto;
                    border-top: 1px solid var(--border);
                }
                .ml-gig-inactive-badge {
                    padding: 2px 8px; border-radius: 100px;
                    font-size: 11px; font-weight: 600;
                    background: #f3f4f6; color: #6b7280; border: 1px solid #d1d5db;
                }
                .ml-btn-toggle {
                    padding: 6px 14px; border-radius: 8px;
                    font-size: 13px; font-weight: 500;
                    cursor: pointer; font-family: inherit;
                    border: 1px solid #d1d5db;
                    background: #f9fafb; color: #374151;
                    transition: all 0.14s;
                }
                .ml-btn-toggle:hover { border-color: #374151; }
                .ml-btn-toggle-off {
                    border-color: #86efac; background: #f0fdf4; color: #15803d;
                }
                .ml-btn-toggle-off:hover { background: #dcfce7; border-color: #15803d; }

                /* ── Request Cards ── */
                .ml-req-list { display: flex; flex-direction: column; gap: 12px; }
                .ml-req-card {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 16px;
                    padding: 18px 22px;
                    background: var(--surface);
                    border: 1px solid var(--border);
                    border-radius: 14px;
                    transition: box-shadow 0.15s;
                }
                .ml-req-card:hover { box-shadow: 0 2px 12px rgba(0,0,0,0.04); }
                .ml-req-left { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; }
                .ml-avatar {
                    width: 40px; height: 40px; border-radius: 50%;
                    background: var(--surface-alt); border: 1.5px solid var(--border);
                    display: flex; align-items: center; justify-content: center;
                    font-size: 13px; font-weight: 700; color: var(--text-secondary); flex-shrink: 0;
                }
                .ml-req-info { min-width: 0; }
                .ml-req-name { font-size: 15px; font-weight: 600; margin: 0 0 2px; }
                .ml-req-sub { font-size: 13px; color: var(--text-secondary); margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .ml-req-gig-link { color: var(--text); cursor: pointer; }
                .ml-req-gig-link:hover { color: var(--accent); text-decoration: underline; }
                .ml-req-right { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; flex-shrink: 0; }
                .ml-req-meta { display: flex; align-items: center; gap: 8px; }
                .ml-req-price { font-size: 17px; font-weight: 700; }
                .ml-req-actions { display: flex; gap: 8px; }

                /* ── Statuses ── */
                .ml-status {
                    display: inline-block;
                    padding: 4px 12px;
                    border-radius: 100px;
                    font-size: 12px;
                    font-weight: 600;
                }
                .ml-status-pending { background: #FEF3C7; color: #92400E; }
                .ml-status-accepted { background: #dcfce7; color: #15803d; }
                .ml-status-declined { background: var(--accent-light); color: var(--accent); }
                .ml-status-done { background: #E0E7FF; color: #3730A3; }
                .ml-pay-badge {
                    padding: 3px 8px; border-radius: 100px;
                    font-size: 11px; font-weight: 600; white-space: nowrap;
                }
                .pay-escrowed { background: #DBEAFE; color: #1E40AF; }
                .pay-held { background: #FEF3C7; color: #92400E; }
                .pay-paid { background: #dcfce7; color: #15803d; }
                .pay-released { background: #E0E7FF; color: #3730A3; }
                .pay-refunded { background: #F3E8FF; color: #6B21A8; }
                .pay-cleared { background: #dcfce7; color: #166534; }

                /* ── Form ── */
                .ml-form-wrap {
                    max-width: 640px;
                    background: var(--surface);
                    border: 1px solid var(--border);
                    border-radius: 16px;
                    padding: 28px 32px 32px;
                }
                .ml-form-header {
                    display: flex; justify-content: space-between; align-items: center;
                    margin-bottom: 8px;
                    padding-bottom: 20px;
                    border-bottom: 1px solid var(--border);
                }
                .ml-form-header h2 { font-size: 22px; font-weight: 700; margin: 0; }
                .ml-form { display: flex; flex-direction: column; gap: 0; }
                .ml-form-section {
                    padding: 24px 0;
                    border-bottom: 1px solid var(--border);
                    display: flex; flex-direction: column; gap: 16px;
                }
                .ml-form-section:last-of-type { border-bottom: none; }
                .ml-form-section-title {
                    font-size: 12px; font-weight: 700; text-transform: uppercase;
                    letter-spacing: 0.06em; color: var(--text-secondary); margin: 0;
                    padding: 6px 12px;
                    background: var(--surface-alt);
                    border-radius: 6px;
                    width: fit-content;
                }
                .ml-form-row { display: flex; gap: 16px; }
                .ml-optional {
                    font-size: 11px; font-weight: 500; color: var(--text-muted);
                    text-transform: none; letter-spacing: 0;
                    margin-left: 4px;
                }

                /* Images */
                .ml-img-grid { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
                .ml-img-thumb {
                    position: relative; width: 88px; height: 88px;
                    border-radius: 10px; overflow: hidden;
                    border: 1.5px solid var(--border);
                    transition: border-color 0.14s;
                }
                .ml-img-thumb:hover { border-color: var(--border-strong); }
                .ml-img-thumb img { width: 100%; height: 100%; object-fit: cover; }
                .ml-img-remove {
                    position: absolute; top: 4px; right: 4px;
                    width: 22px; height: 22px; border-radius: 50%;
                    background: rgba(0,0,0,0.6); color: #fff; border: none;
                    font-size: 11px; cursor: pointer;
                    display: flex; align-items: center; justify-content: center;
                    opacity: 0; transition: opacity 0.15s;
                }
                .ml-img-thumb:hover .ml-img-remove { opacity: 1; }
                .ml-img-actions { display: flex; flex-direction: column; gap: 10px; }
                .ml-upload-btn {
                    display: inline-flex; align-items: center; gap: 6px;
                    padding: 10px 18px;
                    border: 1.5px dashed var(--border-strong); border-radius: 10px;
                    cursor: pointer; font-size: 13px; font-weight: 500;
                    color: var(--text-secondary); background: var(--surface-alt);
                    font-family: inherit; transition: all 0.14s;
                    width: fit-content;
                }
                .ml-upload-btn:hover { border-color: var(--accent-mid); color: var(--text); background: var(--primary-light); }
                .ml-url-row { display: flex; gap: 8px; }

                /* FAQs */
                .ml-faq-item {
                    display: flex; flex-direction: column; gap: 10px;
                    padding: 16px; background: var(--surface-alt);
                    border: 1px solid var(--border); border-radius: 12px;
                }
                .ml-faq-header { display: flex; justify-content: space-between; align-items: center; }
                .ml-faq-num {
                    font-size: 11px; font-weight: 700;
                    color: var(--accent); background: var(--accent-light);
                    padding: 2px 8px; border-radius: 4px;
                }
                .ml-faq-remove { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 4px; border-radius: 4px; }
                .ml-faq-remove:hover { color: var(--accent); background: var(--accent-light); }
                .ml-add-btn {
                    display: inline-flex; align-items: center; gap: 6px;
                    padding: 9px 16px;
                    border: 1.5px dashed var(--border-strong); border-radius: 10px;
                    background: var(--surface-alt); color: var(--text-secondary);
                    font-size: 13px; font-weight: 500;
                    cursor: pointer; font-family: inherit;
                    width: fit-content; transition: all 0.14s;
                }
                .ml-add-btn:hover { border-color: var(--accent-mid); color: var(--text); background: var(--primary-light); }

                /* Tags */
                .ml-tag-list { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
                .ml-tag {
                    display: inline-flex; align-items: center; gap: 5px;
                    padding: 5px 14px;
                    background: var(--primary-light); border: 1px solid var(--primary-mid);
                    border-radius: 100px; font-size: 13px; color: var(--text);
                }
                .ml-tag button { background: none; border: none; cursor: pointer; color: var(--text-muted); font-size: 15px; line-height: 1; padding: 0; }
                .ml-tag button:hover { color: var(--accent); }

                /* Form footer */
                .ml-form-footer {
                    display: flex; gap: 12px; padding-top: 24px;
                    margin-top: 8px;
                    border-top: 1px solid var(--border);
                }

                /* ── Modal ── */
                .ml-modal-bg {
                    position: fixed; inset: 0; background: rgba(0,0,0,0.5);
                    display: flex; align-items: center; justify-content: center;
                    z-index: 500; padding: 16px;
                }
                .ml-modal {
                    position: relative;
                    background: var(--surface);
                    border-radius: 16px;
                    padding: 32px;
                    max-width: 540px;
                    width: 100%;
                    max-height: 85vh;
                    overflow-y: auto;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.2);
                }
                .ml-modal-sm { max-width: 400px; padding: 28px; }
                .ml-modal-title { font-size: 22px; font-weight: 700; margin: 0 0 12px; }
                .ml-modal-meta { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
                .ml-modal-section { margin-bottom: 18px; }
                .ml-modal-section h4 {
                    font-size: 11px; font-weight: 700; text-transform: uppercase;
                    letter-spacing: 0.06em; color: var(--text-muted); margin: 0 0 8px;
                }
                .ml-modal-section p { font-size: 15px; color: var(--text-secondary); line-height: 1.6; margin: 0; }
                .ml-modal-images { display: flex; gap: 10px; flex-wrap: wrap; }
                .ml-modal-images img {
                    width: 120px; height: 120px; object-fit: cover;
                    border-radius: 8px; border: 1px solid var(--border);
                }
                .ml-modal-link {
                    display: inline-flex; align-items: center; gap: 4px;
                    margin-top: 8px; padding: 10px 18px;
                    background: var(--surface-alt); border: 1px solid var(--border);
                    border-radius: 10px;
                    font-size: 14px; font-weight: 600; color: var(--accent);
                    text-decoration: none; width: fit-content;
                    transition: all 0.14s;
                }
                .ml-modal-link:hover { background: var(--accent-light); border-color: var(--accent-mid); }

                /* ── Responsive ── */
                @media (max-width: 768px) {
                    .ml-hero { padding: 20px; border-radius: 12px; }
                    .ml-hero-top { flex-direction: column; }
                    .ml-hero-actions { width: 100%; }
                    .ml-hero-actions > * { flex: 1; text-align: center; justify-content: center; }
                    .ml-stats { gap: 0; }
                    .ml-gig-grid { grid-template-columns: 1fr; }
                    .ml-req-card { flex-direction: column; align-items: stretch; }
                    .ml-req-right { flex-direction: row; justify-content: space-between; align-items: center; }
                    .ml-form-row { flex-direction: column; }
                    .ml-url-row { flex-direction: column; }
                    .ml-form-footer { flex-direction: column; }
                    .ml-form-footer .ml-btn-create { width: 100%; justify-content: center; }
                    .ml-form-wrap { padding: 20px 18px 24px; }
                    .ml-modal { padding: 20px 16px; border-radius: 12px; }
                }
            `}</style>
        </>
    );
}
