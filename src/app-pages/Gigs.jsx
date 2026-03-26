import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useUser, useProfile } from '@/lib/stores';
import SliderSearch from '@/components/SliderSearch';

function initials(name) {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

const GIG_CATEGORIES = [
    { label: 'Errands & Delivery', emoji: '📦', query: 'errands' },
    { label: 'Laundry & Cleaning', emoji: '🧺', query: 'laundry' },
    { label: 'Tutoring & Homework Help', emoji: '📚', query: 'tutoring' },
    { label: 'Photography & Headshots', emoji: '�', query: 'photography' },
    { label: 'Graphic Design & Logos', emoji: '🎨', query: 'design' },
    { label: 'Resume & Cover Letter', emoji: '📄', query: 'resume' },
    { label: 'Moving & Heavy Lifting', emoji: '�', query: 'moving' },
    { label: 'Cooking & Meal Prep', emoji: '🍳', query: 'cooking' },
    { label: 'Tech Support & Setup', emoji: '💻', query: 'tech' },
    { label: 'Rides & Airport Trips', emoji: '🚗', query: 'rides' },
    { label: 'Pet Sitting & Dog Walking', emoji: '�', query: 'pet' },
    { label: 'Event Help & Setup', emoji: '🎉', query: 'event' },
    { label: 'Music Lessons', emoji: '🎵', query: 'music' },
    { label: 'Fitness & Personal Training', emoji: '💪', query: 'fitness' },
    { label: 'Video & Content Editing', emoji: '🎥', query: 'video' },
    { label: 'Other', emoji: '✨', query: 'other' },
];

export default function GigsPage() {
    const user = useUser();
    const profile = useProfile();
    const navigate = useNavigate();

    const [allGigs, setAllGigs] = useState([]);
    const [busy, setBusy] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [toast, setToast] = useState('');
    const [toastType, setToastType] = useState('success');
    const [sendingId, setSendingId] = useState(null);
    const [paymentModal, setPaymentModal] = useState(null);
    const [customAmount, setCustomAmount] = useState('');
    const [profileModal, setProfileModal] = useState(null);
    const [profileRatings, setProfileRatings] = useState([]);
    const [loadingRatings, setLoadingRatings] = useState(false);

    useEffect(() => {
        if (!user) { navigate('/login'); return; }
        loadGigs();
    }, [user]);

    async function loadGigs() {
        setBusy(true);
        const { data, error } = await supabase
            .from('gigs')
            .select('*, profile:profiles!user_id(id, full_name, bio, service_type)')
            .order('created_at', { ascending: false });

        if (!error && data) {
            // Fetch ratings for each provider
            const gigsWithRatings = await Promise.all(data.map(async (gig) => {
                const { data: ratings } = await supabase
                    .from('ratings')
                    .select('rating')
                    .eq('rated_id', gig.user_id);

                const avgRating = ratings && ratings.length > 0
                    ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
                    : null;
                const ratingCount = ratings?.length || 0;

                return { ...gig, avgRating, ratingCount };
            }));

            setAllGigs(gigsWithRatings);
        }
        setBusy(false);
    }



    const handleCategorySelect = (category) => {
        setSearchQuery(category);
        // You can add logic here to filter gigs by category
    };

    const browseGigs = useMemo(() => {
        const others = allGigs.filter(g => g.user_id !== user?.id);
        if (!searchQuery) return others;
        const q = searchQuery.toLowerCase();
        return others.filter(g =>
            g.title?.toLowerCase().includes(q) ||
            g.category?.toLowerCase().includes(q) ||
            g.profile?.full_name?.toLowerCase().includes(q)
        );
    }, [allGigs, user, searchQuery]);

    function showToast(msg, type = 'success') {
        setToast(msg);
        setToastType(type);
        setTimeout(() => setToast(''), 3500);
    }

    const SERVICE_FEE = 3.00;

    function openPaymentModal(gig) {
        setPaymentModal(gig);
        setCustomAmount(gig.price?.toFixed(2) ?? '');
    }

    async function openProfileModal(profile) {
        if (!profile) return;
        setProfileModal(profile);
        setLoadingRatings(true);
        setProfileRatings([]);

        const { data, error } = await supabase
            .from('ratings')
            .select('id, rating, comment, created_at, rater:profiles!rater_id(id, full_name)')
            .eq('rated_id', profile.id)
            .order('created_at', { ascending: false });

        setLoadingRatings(false);
        if (!error && data) setProfileRatings(data);
    }

    async function confirmHireRequest() {
        if (!paymentModal) return;
        const amount = parseFloat(customAmount);
        if (isNaN(amount) || amount <= 0) {
            showToast('Please enter a valid amount', 'error');
            return;
        }
        const gig = paymentModal;
        setSendingId(gig.id);
        const { error } = await supabase.from('gig_requests').insert({
            gig_id: gig.id,
            requester_id: user.id,
            provider_id: gig.user_id,
            status: 'pending',
        });
        setSendingId(null);
        setPaymentModal(null);
        setCustomAmount('');

        if (error) {
            if (error.code === '23505') {
                showToast('You already sent a request for this gig', 'error');
            } else {
                showToast(error.message, 'error');
            }
            return;
        }
        showToast('Hire request sent!', 'success');
    }

    return (
        <>
            <title>Gigs — SkillJoy</title>

            <div className="page">
                <div className="page-header" style={{ marginBottom: '20px', }}>
                    <div>
                        <h1 className="page-title">Gigs</h1>
                        <p className="page-subtitle" style={{ color: '#fff' }}>Find someone to hire for paid services.</p>
                    </div>
                    <Link to="/my-listings" className="btn btn-secondary" style={{ background: '#fff', border: '2px solid #c99772' }}>My Listings</Link>
                </div>

                <div className="search-box" style={{ marginBottom: 24 }}>
                    <input
                        type="text"
                        placeholder="Search gigs..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>
                <div style={{ marginBottom: '20px' }}>
                    <SliderSearch onCategorySelect={handleCategorySelect} categories={GIG_CATEGORIES} />
                </div>

                {busy ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
                        <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
                    </div>
                ) : browseGigs.length === 0 ? (
                    <div className="empty-state">
                        <span className="empty-icon">💼</span>
                        <h3>No gigs found</h3>
                        <p>Be the first to list a paid service!</p>
                        <Link to="/my-listings" className="btn btn-primary" style={{ marginTop: 16 }}>
                            Create a gig
                        </Link>
                    </div>
                ) : (
                    <div className="gigs-grid">
                        {browseGigs.map((gig, i) => (
                            <div key={gig.id} className="gig-card fade-up" style={{ animationDelay: `${i * 0.04}s` }}>
                                <div className="gig-card-header">
                                    <div className="avatar">{initials(gig.profile?.full_name)}</div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                            <p className="gig-author" style={{ cursor: 'pointer', textDecoration: 'underline', margin: 0 }} onClick={() => openProfileModal(gig.profile)}>
                                                {gig.profile?.full_name ?? 'Unknown'}
                                            </p>
                                            {gig.avgRating && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                    <span style={{ color: '#fbbf24', fontSize: '14px' }}>★</span>
                                                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                                        {gig.avgRating.toFixed(1)}
                                                    </span>
                                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                                        ({gig.ratingCount})
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        {gig.category && <span className="gig-category">{gig.category}</span>}
                                    </div>
                                </div>
                                <h3 className="gig-title">{gig.title}</h3>
                                {gig.description && <p className="gig-desc">{gig.description}</p>}
                                <div className="gig-footer">
                                    <span className="gig-price">${gig.price?.toFixed(2)}</span>
                                    <button
                                        className="btn btn-primary btn-sm"
                                        disabled={sendingId === gig.id}
                                        onClick={() => openPaymentModal(gig)}
                                    >
                                        {sendingId === gig.id ? 'Sending...' : 'Hire'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Stripe Payment Placeholder */}
                <div className="stripe-placeholder">
                    <div className="stripe-icon">💳</div>
                    <div className="stripe-info">
                        <h3>Payments powered by Stripe</h3>
                        <p>Secure payments coming soon. For now, coordinate payment directly with your gig provider.</p>
                        <button className="btn btn-secondary btn-sm" disabled style={{ opacity: 0.6, cursor: 'not-allowed', marginTop: 8 }}>
                            Connect Stripe Account (Coming Soon)
                        </button>
                    </div>
                </div>
            </div >

            {/* ── Payment / Hire Modal ── */}
            {paymentModal && (
                <div className="modal-backdrop" onClick={() => setPaymentModal(null)}>
                    <div className="modal payment-modal" onClick={e => e.stopPropagation()}>
                        <button className="modal-close" onClick={() => setPaymentModal(null)}>✕</button>
                        <div className="payment-modal-header">
                            <span style={{ fontSize: 36 }}>�</span>
                            <h2>Hire {paymentModal.profile?.full_name}</h2>
                        </div>

                        <div className="payment-gig-info">
                            <div className="avatar">{initials(paymentModal.profile?.full_name)}</div>
                            <div>
                                <p style={{ fontWeight: 600 }}>{paymentModal.title}</p>
                                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{paymentModal.category ?? 'No category'}</p>
                            </div>
                        </div>

                        {paymentModal.images && paymentModal.images.length > 0 && (
                            <div style={{ marginBottom: 16 }}>
                                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Portfolio</p>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    {paymentModal.images.map((url, i) => (
                                        <img key={i} src={url} alt={`Portfolio ${i + 1}`} style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border)' }} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {paymentModal.description && (
                            <div style={{ marginBottom: 16 }}>
                                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Description</p>
                                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{paymentModal.description}</p>
                            </div>
                        )}

                        {paymentModal.commitments && (
                            <div style={{ marginBottom: 16 }}>
                                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>What They Commit To</p>
                                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{paymentModal.commitments}</p>
                            </div>
                        )}

                        {paymentModal.requirements && (
                            <div style={{ marginBottom: 16 }}>
                                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Requirements</p>
                                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{paymentModal.requirements}</p>
                            </div>
                        )}

                        <div className="payment-amount-section">
                            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>Your offer</label>
                            <div className="payment-amount-input">
                                <span className="payment-currency">$</span>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={customAmount}
                                    onChange={e => setCustomAmount(e.target.value)}
                                    placeholder="0.00"
                                    className="amount-input"
                                />
                            </div>
                            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Suggested: ${paymentModal.price?.toFixed(2)}</p>
                        </div>

                        <div className="payment-breakdown">
                            <div className="payment-line">
                                <span>Your offer</span>
                                <span>${(parseFloat(customAmount) || 0).toFixed(2)}</span>
                            </div>
                            <div className="payment-line">
                                <span>Service fee</span>
                                <span>${SERVICE_FEE.toFixed(2)}</span>
                            </div>
                            <div className="payment-line payment-total">
                                <span>Total</span>
                                <span>${((parseFloat(customAmount) || 0) + SERVICE_FEE).toFixed(2)}</span>
                            </div>
                        </div>

                        <div className="payment-escrow-note">
                            <span style={{ fontSize: 16 }}>�</span>
                            <p>Stripe integration coming soon. For now, coordinate payment directly with the provider after they accept.</p>
                        </div>

                        <div className="payment-actions">
                            <button className="btn btn-secondary" onClick={() => setPaymentModal(null)}>Cancel</button>
                            <button
                                className="btn btn-primary"
                                disabled={sendingId === paymentModal.id || !customAmount || parseFloat(customAmount) <= 0}
                                onClick={confirmHireRequest}
                            >
                                {sendingId === paymentModal.id ? 'Sending...' : 'Send Hire Request'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Profile Modal with Ratings ── */}
            {profileModal && (
                <div className="modal-backdrop" onClick={() => setProfileModal(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                        <button className="modal-close" onClick={() => setProfileModal(null)}>✕</button>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                            <div className="avatar" style={{ width: '64px', height: '64px', fontSize: '24px' }}>
                                {initials(profileModal.full_name)}
                            </div>
                            <div style={{ flex: 1 }}>
                                <h2 style={{ marginBottom: '4px', fontSize: '24px' }}>{profileModal.full_name}</h2>
                                {profileRatings.length > 0 && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                        <div style={{ display: 'flex', gap: '2px' }}>
                                            {[1, 2, 3, 4, 5].map(star => (
                                                <span key={star} style={{
                                                    color: star <= (profileRatings.reduce((sum, r) => sum + r.rating, 0) / profileRatings.length) ? '#fbbf24' : '#d1d5db',
                                                    fontSize: '18px'
                                                }}>
                                                    ★
                                                </span>
                                            ))}
                                        </div>
                                        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                            {(profileRatings.reduce((sum, r) => sum + r.rating, 0) / profileRatings.length).toFixed(1)}
                                        </span>
                                        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                            ({profileRatings.length} {profileRatings.length === 1 ? 'review' : 'reviews'})
                                        </span>
                                    </div>
                                )}
                                {profileModal.bio && <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>{profileModal.bio}</p>}
                            </div>
                        </div>

                        {profileModal.availability && profileModal.availability.length > 0 && (
                            <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: 'var(--surface-alt)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span>📅</span>
                                    Availability
                                </h3>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {profileModal.availability.map((time, i) => (
                                        <span key={i} style={{
                                            padding: '4px 10px',
                                            backgroundColor: 'var(--surface)',
                                            border: '1px solid var(--border)',
                                            borderRadius: '6px',
                                            fontSize: '13px',
                                            color: 'var(--text-secondary)'
                                        }}>
                                            {time}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="modal-section">
                            <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span>⭐</span>
                                Ratings & Reviews
                                {!loadingRatings && profileRatings.length > 0 && (
                                    <span style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: 400 }}>
                                        ({profileRatings.length} {profileRatings.length === 1 ? 'review' : 'reviews'})
                                    </span>
                                )}
                            </h3>

                            {loadingRatings ? (
                                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                                    <div className="spinner" style={{ width: 24, height: 24, borderWidth: 2 }} />
                                </div>
                            ) : profileRatings.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                                    <p style={{ fontSize: '14px' }}>No ratings yet</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    {profileRatings.map(rating => (
                                        <div key={rating.id} style={{
                                            padding: '16px',
                                            border: '1px solid var(--border)',
                                            borderRadius: '8px',
                                            backgroundColor: 'var(--surface)'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                                                <div>
                                                    <p style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>
                                                        {rating.rater?.full_name ?? 'Anonymous'}
                                                    </p>
                                                    <div style={{ display: 'flex', gap: '2px' }}>
                                                        {[1, 2, 3, 4, 5].map(star => (
                                                            <span key={star} style={{ color: star <= rating.rating ? '#fbbf24' : '#d1d5db', fontSize: '16px' }}>
                                                                ★
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                                    {new Date(rating.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                </span>
                                            </div>
                                            {rating.comment && (
                                                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                                    {rating.comment}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {toast && <div className={`toast ${toastType}`}>{toast}</div>
            }

            <style>{`
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
        .gig-card-header { display: flex; align-items: center; gap: 10px; }
        .gig-author { font-weight: 600; font-size: 14px; }
        .gig-category {
          display: inline-block;
          padding: 2px 8px;
          border-radius: var(--r-full);
          font-size: 11px;
          font-weight: 500;
          background: #FFF7ED;
          color: #C2410C;
          border: 1px solid #FDBA74;
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
        .gig-price {
          font-size: 20px;
          font-weight: 700;
          color: var(--text);
        }
        .stripe-placeholder {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          margin-top: 40px;
          padding: 24px;
          background: var(--surface);
          border: 2px dashed var(--border-strong);
          border-radius: var(--r-lg);
        }
        .stripe-icon { font-size: 32px; }
        .stripe-info h3 { font-size: 16px; font-weight: 600; margin-bottom: 4px; }
        .stripe-info p { font-size: 13px; color: var(--text-secondary); line-height: 1.5; }

        /* Payment Modal */
        .payment-modal { max-width: 440px; }
        .payment-modal-header { text-align: center; margin-bottom: 20px; }
        .payment-modal-header h2 { margin: 8px 0 0; font-size: 22px; }
        .payment-gig-info { display: flex; align-items: center; gap: 12px; padding: 14px 16px; background: var(--surface-alt); border-radius: var(--r); margin-bottom: 20px; }
        .payment-breakdown { border: 1px solid var(--border); border-radius: var(--r); overflow: hidden; margin-bottom: 16px; }
        .payment-line { display: flex; justify-content: space-between; padding: 12px 16px; font-size: 14px; }
        .payment-line + .payment-line { border-top: 1px solid var(--border); }
        .payment-total { background: var(--surface-alt); font-weight: 700; font-size: 16px; }
        .payment-escrow-note { display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; background: #FFF7ED; border: 1px solid #FDBA74; border-radius: var(--r); margin-bottom: 20px; }
        .payment-escrow-note p { font-size: 12px; color: #92400E; line-height: 1.5; margin: 0; }
        .payment-actions { display: flex; gap: 12px; justify-content: flex-end; }
        .payment-amount-section { margin-bottom: 16px; }
        .payment-amount-input { display: flex; align-items: center; border: 1.5px solid var(--border); border-radius: var(--r); overflow: hidden; background: var(--surface); }
        .payment-currency { padding: 10px 12px; font-size: 18px; font-weight: 700; color: var(--text); background: var(--surface-alt); border-right: 1px solid var(--border); }
        .amount-input { flex: 1; border: none; outline: none; padding: 10px 14px; font-size: 18px; font-weight: 600; font-family: var(--font-body); color: var(--text); background: transparent; width: 100%; }
        .amount-input::placeholder { color: var(--text-muted); font-weight: 400; }
      `}</style>
        </>
    );
}
