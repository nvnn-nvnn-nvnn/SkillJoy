import { useState, useEffect, useMemo, useRef } from 'react';
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
    { label: 'Photography & Headshots', emoji: '📷', query: 'photography' },
    { label: 'Graphic Design & Logos', emoji: '🎨', query: 'design' },
    { label: 'Resume & Cover Letter', emoji: '📄', query: 'resume' },
    { label: 'Moving & Heavy Lifting', emoji: '🛻', query: 'moving' },
    { label: 'Cooking & Meal Prep', emoji: '🍳', query: 'cooking' },
    { label: 'Tech Support & Setup', emoji: '💻', query: 'tech' },
    { label: 'Rides & Airport Trips', emoji: '🚗', query: 'rides' },
    { label: 'Pet Sitting & Dog Walking', emoji: '🐶', query: 'pet' },
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
    const [categoryFilter, setCategoryFilter] = useState('');
    const [toast, setToast] = useState('');
    const [toastType, setToastType] = useState('success');
    const [sendingId, setSendingId] = useState(null);
    const [paymentModal, setPaymentModal] = useState(null);
    const [customAmount, setCustomAmount] = useState('');
    const [profileModal, setProfileModal] = useState(null);
    const [profileRatings, setProfileRatings] = useState([]);
    const [loadingRatings, setLoadingRatings] = useState(false);
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
    const [favorites, setFavorites] = useState([]);
    const [recentSearches, setRecentSearches] = useState([]);

    // Filters
    const [showFilters, setShowFilters] = useState(false);
    const [availabilityDays, setAvailabilityDays] = useState([]);
    const [timeFilter, setTimeFilter] = useState('');
    const filterInnerRef = useRef(null);
    const [panelHeight, setPanelHeight] = useState(0);

    const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const TIMES = ['Mornings', 'Midday', 'Afternoon', 'Evening', 'Night', 'No preference'];

    useEffect(() => {
        if (filterInnerRef.current) {
            setPanelHeight(filterInnerRef.current.scrollHeight);
        }
    }, [showFilters, availabilityDays, timeFilter]);

    const hasActiveFilters = availabilityDays.length > 0 || (timeFilter && timeFilter !== 'No preference');

    function toggleDay(day) {
        setAvailabilityDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
    }

    function clearFilters() {
        setAvailabilityDays([]);
        setTimeFilter('');
    }

    async function loadFavorites() {
        if (!user) return;
        const { data } = await supabase.from('favorites').select('favorited_id').eq('user_id', user.id).eq('type', 'gig');
        if (data) setFavorites(data.map(f => f.favorited_id));
    }

    async function toggleFavorite(odId) {
        if (!user) return;
        const isFav = favorites.includes(odId);
        if (isFav) {
            await supabase.from('favorites').delete().eq('user_id', user.id).eq('favorited_id', odId).eq('type', 'gig');
            setFavorites(favorites.filter(id => id !== odId));
        } else {
            await supabase.from('favorites').insert({ user_id: user.id, favorited_id: odId, type: 'gig' });
            setFavorites([...favorites, odId]);
        }
    }

    function loadRecentSearches() {
        const saved = localStorage.getItem('gig_recent_searches');
        if (saved) setRecentSearches(JSON.parse(saved));
    }

    function addRecentSearch(query) {
        if (!query?.trim()) return;
        const updated = [query, ...recentSearches.filter(s => s !== query)].slice(0, 5);
        setRecentSearches(updated);
        localStorage.setItem('gig_recent_searches', JSON.stringify(updated));
    }

    function clearRecentSearches() {
        setRecentSearches([]);
        localStorage.removeItem('gig_recent_searches');
    }

    async function loadGigs(universityDomain) {
        setBusy(true);
        let query = supabase
            .from('gigs')
            .select('*, profile:profiles!user_id(id, full_name, bio, service_type, availability)')
            .order('created_at', { ascending: false });
        if (profile?.college_verified && universityDomain) query = query.eq('university_domain', universityDomain);
        const { data, error } = await query;

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

    useEffect(() => {
        if (!user) { navigate('/login'); return; }
        loadGigs(profile?.university_domain); // eslint-disable-line react-hooks/set-state-in-effect
        loadFavorites();
        loadRecentSearches();
    }, [user, profile?.university_domain, profile?.college_verified]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleCategorySelect = (category) => {
        setSearchQuery(category);
        // You can add logic here to filter gigs by category
    };

    const browseGigs = useMemo(() => {
        let gigs = allGigs.filter(g => g.user_id !== user?.id);

        // Favorites filter
        if (showFavoritesOnly) {
            gigs = gigs.filter(g => favorites.includes(g.id));
        }

        // Search filter with relevance scoring
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            gigs = gigs
                .map(g => {
                    let score = 0;
                    if (g.title?.toLowerCase().includes(q)) score += 4;
                    if (g.tags?.some(t => t.toLowerCase().includes(q))) score += 3;
                    if (g.category?.toLowerCase().includes(q)) score += 2;
                    if (g.description?.toLowerCase().includes(q)) score += 1;
                    if (g.profile?.full_name?.toLowerCase().includes(q)) score += 1;
                    return { ...g, _score: score };
                })
                .filter(g => g._score > 0)
                .sort((a, b) => b._score - a._score);
        }

        // Availability days filter
        if (availabilityDays.length > 0) {
            gigs = gigs.filter(g =>
                availabilityDays.some(day =>
                    g.profile?.availability?.some(slot => slot.toLowerCase().includes(day.toLowerCase()))
                )
            );
        }

        // Time filter
        if (timeFilter && timeFilter !== 'No preference') {
            gigs = gigs.filter(g =>
                g.profile?.availability?.some(slot => slot.toLowerCase().includes(timeFilter.toLowerCase()))
            );
        }

        // Category filter
        if (categoryFilter) {
            gigs = gigs.filter(g => g.category === categoryFilter);
        }

        return gigs;
    }, [allGigs, user, searchQuery, showFavoritesOnly, favorites, availabilityDays, timeFilter, categoryFilter]);

    function showToast(msg, type = 'success') {
        setToast(msg);
        setToastType(type);
        setTimeout(() => setToast(''), 3500);
    }

    const SERVICE_FEE = 6.00;

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

        // Check for existing active request (not completed/cancelled)
        const { data: existingRequest } = await supabase
            .from('gig_requests')
            .select('id, status, payment_status')
            .eq('gig_id', gig.id)
            .eq('requester_id', user.id)
            .not('status', 'in', '("completed","cancelled","declined","withdrawn")')
            .not('payment_status', 'in', '("withdrawn","refunded")')
            .maybeSingle();

        if (existingRequest) {
            setSendingId(null);
            setPaymentModal(null);
            showToast('You already have an active request for this gig', 'error');
            return;
        }

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
            showToast(error.message, 'error');
            return;
        }
        showToast('Hire request sent!', 'success');
    }

    return (
        <>
            <title>Gigs — SkillJoy</title>

            <div className="page">
                {/* Hero + Search merged section */}
                <div className="gigs-hero-section">
                    <div className="page-header" style={{ marginBottom: '20px' }}>
                        <div>
                            <h1 className="page-title">Gigs</h1>
                            <p className="page-subtitle" style={{ color: '#000', fontSize: '1rem' }}>Find freelancers at your University</p>
                        </div>
                        <Link to="/my-listings" className="btn btn-secondary" style={{ background: '#fff', border: '2px solid #c99772' }}>My Listings</Link>
                    </div>

                    {/* Search row */}
                    <div className="gigs-search-row" style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '12px' }}>
                        <div className="search-box" style={{ flex: 1 }}>
                            <input
                                type="text"
                                placeholder="Search gigs..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') addRecentSearch(searchQuery); }}
                                style={{ background: '#fff' }}
                            />
                        </div>
                        <button
                            className={`btn btn-secondary sj-filter-btn ${showFilters ? 'sj-filter-btn-open' : ''}`}
                            onClick={() => setShowFilters(v => !v)}
                            style={{ background: '#fff' }}
                        >
                            {hasActiveFilters && <span className="sj-filter-dot" />}
                            🔍 Filters
                            <span className={`sj-chevron ${showFilters ? 'sj-chevron-up' : ''}`}>▾</span>
                        </button>
                        <button
                            className={`btn ${showFavoritesOnly ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setShowFavoritesOnly(v => !v)}
                            style={{ padding: '10px 16px', backgroundColor: "#fff" }}
                        >
                            ⭐ Favorites {showFavoritesOnly ? '✓' : ''}
                        </button>
                    </div>

                    {/* Recent searches */}
                    {recentSearches.length > 0 && !searchQuery && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                            <span style={{ fontSize: '13px', color: '#000', fontWeight: 500 }}>Recent:</span>
                            {recentSearches.map((s, i) => (
                                <button key={i} className="sj-recent-chip" onClick={() => setSearchQuery(s)}>{s}</button>
                            ))}
                            <button className="sj-clear-btn" style={{ color: "#000" }} onClick={clearRecentSearches}>Clear</button>
                        </div>
                    )}

                    {/* Slide-down filter panel */}
                    <div
                        className="sj-filter-panel"
                        style={{ maxHeight: showFilters ? `${panelHeight}px` : '0px' }}
                    >
                        <div className="sj-filter-inner" ref={filterInnerRef}>
                            <div className="sj-filter-group">
                                <label className="sj-filter-label">Availability</label>
                                <div className="sj-chips">
                                    {DAYS.map(day => (
                                        <button
                                            key={day}
                                            className={`sj-chip ${availabilityDays.includes(day) ? 'sj-chip-on' : ''}`}
                                            onClick={() => toggleDay(day)}
                                        >
                                            {day.slice(0, 3)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="sj-filter-group">
                                <label className="sj-filter-label">Time of day</label>
                                <div className="sj-chips">
                                    {TIMES.map(time => (
                                        <button
                                            key={time}
                                            className={`sj-chip ${timeFilter === time ? 'sj-chip-on' : ''}`}
                                            onClick={() => setTimeFilter(timeFilter === time ? '' : time)}
                                        >
                                            {time}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {hasActiveFilters && (
                                <button className="sj-clear-filters-btn" onClick={clearFilters}>
                                    Clear all filters
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Category slider */}
                {/* <SliderSearch onCategorySelect={handleCategorySelect} categories={GIG_CATEGORIES} /> */}

                {/* Category filter pills */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: 12 }}>
                    {GIG_CATEGORIES.map(cat => (
                        <button
                            key={cat.label}
                            onClick={() => setCategoryFilter(prev => prev === cat.label ? '' : cat.label)}
                            style={{
                                padding: '5px 12px',
                                borderRadius: 20,
                                border: '1px solid',
                                borderColor: categoryFilter === cat.label ? 'var(--primary)' : 'var(--border)',
                                background: categoryFilter === cat.label ? 'var(--primary)' : '#fff',
                                color: categoryFilter === cat.label ? '#fff' : 'var(--text-secondary)',
                                fontSize: 13,
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {cat.emoji} {cat.label}
                        </button>
                    ))}
                </div>

                {busy ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: 16 }}>
                        <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
                        <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>Loading gigs…</p>
                    </div>
                ) : browseGigs.length === 0 ? (
                    <div className="empty-state">
                        <span className="empty-icon">💼</span>
                        <h3>No gigs found</h3>
                        <p style={{color: "#fff"}}>Be the first to list a paid service!</p>
                        <Link to="/my-listings" className="btn btn-primary" style={{ marginTop: 16 }}>
                            Create a gig
                        </Link>
                    </div>
                ) : (
                    <div className="gigs-grid" style={{ marginTop: '2rem' }}>
                        {browseGigs.map((gig, i) => (
                            <div
                                key={gig.id}
                                className="gig-card fade-up"
                                style={{ animationDelay: `${i * 0.04}s`, position: 'relative', cursor: 'pointer' }}
                                onClick={() => navigate(`/gigs/${gig.id}`)}
                            >
                                <button
                                    className={`sj-fav-btn ${favorites.includes(gig.id) ? 'sj-fav-btn-active' : ''}`}
                                    onClick={e => { e.stopPropagation(); toggleFavorite(gig.id); }}
                                    title={favorites.includes(gig.id) ? 'Remove from favorites' : 'Add to favorites'}
                                >
                                    {favorites.includes(gig.id) ? '⭐' : '☆'}
                                </button>
                                <div className="gig-card-header">
                                    <div className="avatar">{initials(gig.profile?.full_name)}</div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                            <p className="gig-author" style={{ cursor: 'pointer', textDecoration: 'underline', margin: 0 }} onClick={e => { e.stopPropagation(); navigate(`/profile/${gig.profile?.id}`); }}>
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
                                {gig.images?.[0] && (
                                    <img
                                        src={gig.images[0]}
                                        alt={gig.title}
                                        style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '8px', marginBottom: '10px' }}
                                    />
                                )}
                                <h3 className="gig-title">{gig.title}</h3>
                                {gig.description && <p className="gig-desc">{gig.description}</p>}
                                {gig.tags?.length > 0 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                                        {gig.tags.slice(0, 4).map(tag => (
                                            <span key={tag} onClick={e => { e.stopPropagation(); setSearchQuery(tag); }} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'var(--surface-alt)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                <div className="gig-footer">
                                    <span className="gig-price">${gig.price?.toFixed(2)}</span>
                                    <button
                                        className="btn btn-primary btn-sm"
                                        onClick={e => { e.stopPropagation(); navigate(`/gigs/${gig.id}`); }}
                                    >
                                        View Details
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
        .gigs-hero-section {
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

        /* ── Filter button ── */
        .sj-filter-btn {
            position: relative;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 10px 16px;
            white-space: nowrap;
        }
        .sj-filter-btn-open {
            border-color: var(--primary) !important;
            color: var(--primary) !important;
        }
        .sj-filter-dot {
            width: 6px; height: 6px;
            background: var(--primary);
            border-radius: 50%;
            flex-shrink: 0;
        }
        .sj-chevron {
            font-size: 12px;
            display: inline-block;
            transition: transform 0.22s ease;
            margin-left: 2px;
        }
        .sj-chevron-up { transform: rotate(180deg); }

        /* ── Slide-down panel ── */
        .sj-filter-panel {
            overflow: hidden;
            transition: max-height 0.30s cubic-bezier(0.4, 0, 0.2, 1);
            max-height: 0;
        }
        .sj-filter-inner {
            padding: 20px;
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 12px;
            margin-bottom: 12px;
            display: flex;
            flex-direction: column;
            gap: 18px;
        }
        .sj-filter-group { display: flex; flex-direction: column; gap: 8px; }
        .sj-filter-label {
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            color: var(--text-muted);
        }

        /* ── Chips ── */
        .sj-chips { display: flex; flex-wrap: wrap; gap: 8px; }
        .sj-chip {
            padding: 6px 14px;
            border-radius: 100px;
            border: 1.5px solid var(--border);
            background: var(--surface-alt, #f5f4f0);
            font-size: 13px;
            font-weight: 500;
            color: var(--text-secondary);
            cursor: pointer;
            font-family: inherit;
            transition: background 0.14s, border-color 0.14s, color 0.14s, transform 0.1s;
        }
        .sj-chip:hover {
            border-color: var(--primary);
            color: var(--primary);
            transform: translateY(-1px);
        }
        .sj-chip-on {
            background: var(--primary);
            border-color: var(--primary);
            color: #fff;
            transform: translateY(-1px);
        }
        .sj-chip-on:hover { opacity: 0.88; color: #fff; }

        /* ── Clear filters ── */
        .sj-clear-filters-btn {
            align-self: flex-start;
            padding: 6px 14px;
            border: 1px solid var(--border);
            border-radius: 8px;
            background: transparent;
            font-size: 13px;
            color: var(--text-secondary);
            cursor: pointer;
            font-family: inherit;
            transition: border-color 0.14s, color 0.14s;
        }
        .sj-clear-filters-btn:hover {
            border-color: var(--text-secondary);
            color: var(--text-primary);
        }

        /* ── Recent searches ── */
        .sj-recent-chip {
            padding: 4px 10px;
            background: var(--surface-alt);
            border: 1px solid var(--border);
            border-radius: 6px;
            font-size: 13px;
            cursor: pointer;
            color: var(--text-secondary);
            font-family: inherit;
            transition: border-color 0.14s;
        }
        .sj-recent-chip:hover { border-color: var(--text-secondary); }
        .sj-clear-btn {
            padding: 4px 8px;
            background: transparent;
            border: none;
            font-size: 12px;
            cursor: pointer;
            color: var(--text-muted);
            font-family: inherit;
        }
        .sj-clear-btn:hover { color: var(--text-primary); }

        /* ── Favorite button ── */
        .sj-fav-btn {
            position: absolute;
            top: 12px; right: 12px;
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 50%;
            width: 32px; height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            font-size: 16px;
            z-index: 10;
            box-shadow: 0 2px 4px rgba(0,0,0,0.08);
            transition: transform 0.12s, background 0.14s;
        }
        .sj-fav-btn:hover { transform: scale(1.12); }
        .sj-fav-btn-active { background: #fbbf24; border-color: #fbbf24; }
      `}</style>
        </>
    );
}
