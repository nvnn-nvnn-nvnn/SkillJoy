import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/lib/stores';

function initials(name) {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function GigDetailsPage() {
    const { gigId } = useParams();
    const user = useUser();
    const navigate = useNavigate();

    const [gig, setGig] = useState(null);
    const [loading, setLoading] = useState(true);
    const [lightbox, setLightbox] = useState(null); // index of open image
    const [profileRatings, setProfileRatings] = useState([]);
    const [loadingRatings, setLoadingRatings] = useState(false);
    const [customAmount, setCustomAmount] = useState('');
    const [sendingRequest, setSendingRequest] = useState(false);
    const [toast, setToast] = useState('');
    const [toastType, setToastType] = useState('success');

    const SERVICE_FEE = 6.00;

    useEffect(() => {
        if (!user) { navigate('/login'); return; }
        loadGigDetails();
    }, [gigId, user]);

    async function loadGigDetails() {
        setLoading(true);
        const { data, error } = await supabase
            .from('gigs')
            .select('*, profile:profiles!user_id(id, full_name, bio, service_type, availability)')
            .eq('id', gigId)
            .single();

        if (!error && data) {
            const { data: ratings } = await supabase
                .from('ratings').select('rating').eq('rated_id', data.user_id);
            const avgRating = ratings?.length ? ratings.reduce((s, r) => s + r.rating, 0) / ratings.length : null;
            const ratingCount = ratings?.length || 0;
            setGig({ ...data, avgRating, ratingCount });
            setCustomAmount(data.price?.toFixed(2) ?? '');
            loadProfileRatings(data.user_id);
        } else {
            showToast('Gig not found', 'error');
            navigate('/gigs');
        }
        setLoading(false);
    }

    async function loadProfileRatings(userId) {
        setLoadingRatings(true);
        const { data, error } = await supabase
            .from('ratings')
            .select('id, rating, comment, created_at, rater:profiles!rater_id(id, full_name)')
            .eq('rated_id', userId)
            .order('created_at', { ascending: false });
        setLoadingRatings(false);
        if (!error && data) setProfileRatings(data);
    }

    async function confirmHireRequest() {
        if (!gig) return;
        const amount = parseFloat(customAmount);
        if (isNaN(amount) || amount <= 0) { showToast('Please enter a valid amount', 'error'); return; }
        setSendingRequest(true);

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
            setSendingRequest(false);
            showToast('You already have an active request for this gig', 'error');
            return;
        }

        const { error } = await supabase.from('gig_requests').insert({
            gig_id: gig.id, requester_id: user.id, provider_id: gig.user_id, status: 'pending',
        });
        setSendingRequest(false);
        if (error) {
            showToast(error.message, 'error');
            return;
        }
        showToast('Hire request sent!', 'success');
        setTimeout(() => navigate('/my-orders'), 1500);
    }

    function showToast(msg, type = 'success') {
        setToast(msg); setToastType(type);
        setTimeout(() => setToast(''), 3500);
    }

    if (loading) {
        return (
            <div className="page">
                <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
                    <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
                </div>
            </div>
        );
    }

    if (!gig) return null;

    const avgScore = profileRatings.length
        ? profileRatings.reduce((s, r) => s + r.rating, 0) / profileRatings.length
        : null;

    return (
        <>
            <title>{gig.title} — SkillJoy</title>

            <div className="page gd-page">

                {/* Back */}
                <button onClick={() => navigate('/gigs')} className="gd-back" style={{backgroundColor: "#fff"}}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                    Back to Gigs
                </button>

                <div className="gd-layout">

                    {/* ── LEFT COLUMN ── */}
                    <div className="gd-main">

                        {/* Hero */}
                        <div className="gd-hero">
                            {gig.category && <span className="gd-badge">{gig.category}</span>}
                            <h1 className="gd-title">{gig.title}</h1>
                            <div className="gd-meta">
                                <span className="gd-price">${gig.price?.toFixed(2)}</span>
                                {gig.avgRating && (
                                    <span className="gd-rating-pill">
                                        ★ {gig.avgRating.toFixed(1)}
                                        <span className="gd-rating-count">({gig.ratingCount})</span>
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Sections */}
                        {gig.description && (
                            <div className="gd-section">
                                <h3 className="gd-section-label">About this gig</h3>
                                <p className="gd-section-body">{gig.description}</p>
                            </div>
                        )}

                        {gig.commitments && (
                            <div className="gd-section">
                                <h3 className="gd-section-label">What I commit to</h3>
                                <p className="gd-section-body">{gig.commitments}</p>
                            </div>
                        )}

                        {gig.requirements && (
                            <div className="gd-section">
                                <h3 className="gd-section-label">Requirements</h3>
                                <p className="gd-section-body">{gig.requirements}</p>
                            </div>
                        )}

                        {gig.images?.length > 0 && (
                            <div className="gd-section">
                                <h3 className="gd-section-label">Portfolio</h3>
                                <div className="gd-portfolio">
                                    {gig.images.map((url, i) => (
                                        <img key={i} src={url} alt={`Portfolio ${i + 1}`} className="gd-portfolio-img" onClick={() => setLightbox(i)} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {lightbox !== null && gig.images?.length > 0 && (
                            <div className="gd-lightbox-backdrop" onClick={() => setLightbox(null)}>
                                <button className="gd-lb-nav gd-lb-prev" onClick={e => { e.stopPropagation(); setLightbox((lightbox - 1 + gig.images.length) % gig.images.length); }}>‹</button>
                                <img src={gig.images[lightbox]} alt="" className="gd-lb-img" onClick={e => e.stopPropagation()} />
                                <button className="gd-lb-nav gd-lb-next" onClick={e => { e.stopPropagation(); setLightbox((lightbox + 1) % gig.images.length); }}>›</button>
                                <button className="gd-lb-close" onClick={() => setLightbox(null)}>✕</button>
                                <span className="gd-lb-counter">{lightbox + 1} / {gig.images.length}</span>
                            </div>
                        )}

                        {gig.faqs?.length > 0 && (
                            <div className="gd-section">
                                <h3 className="gd-section-label">Frequently Asked Questions</h3>
                                <div className="gd-faqs">
                                    {gig.faqs.map((faq, i) => (
                                        <div key={i} className="gd-faq-item">
                                            <div className="gd-faq-question">
                                                <span style={{ color: 'var(--primary)', marginRight: '8px' }}>Q:</span>
                                                {faq.question}
                                            </div>
                                            <div className="gd-faq-answer">
                                                <span style={{ color: 'var(--text-muted)', marginRight: '8px' }}>A:</span>
                                                {faq.answer}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Reviews — below content on mobile, here on desktop */}
                        <div className="gd-section gd-reviews">
                            <h3 className="gd-section-label">
                                Reviews
                                {!loadingRatings && profileRatings.length > 0 && (
                                    <span className="gd-reviews-count">{profileRatings.length}</span>
                                )}
                            </h3>

                            {loadingRatings ? (
                                <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
                                    <div className="spinner" style={{ width: 22, height: 22, borderWidth: 2 }} />
                                </div>
                            ) : profileRatings.length === 0 ? (
                                <p className="gd-empty-reviews">No reviews yet — be the first to hire!</p>
                            ) : (
                                <>
                                    {avgScore && (
                                        <div className="gd-score-bar">
                                            <span className="gd-score-big">{avgScore.toFixed(1)}</span>
                                            <div className="gd-score-stars">
                                                {[1, 2, 3, 4, 5].map(s => (
                                                    <span key={s} style={{ color: s <= Math.round(avgScore) ? '#fbbf24' : 'var(--color-border-secondary)', fontSize: 20 }}>★</span>
                                                ))}
                                                <span className="gd-score-label">{profileRatings.length} {profileRatings.length === 1 ? 'review' : 'reviews'}</span>
                                            </div>
                                        </div>
                                    )}
                                    <div className="gd-review-list">
                                        {profileRatings.map(r => (
                                            <div key={r.id} className="gd-review-item">
                                                <div className="gd-review-top">
                                                    <div className="gd-review-avatar">{initials(r.rater?.full_name)}</div>
                                                    <div style={{ flex: 1 }}>
                                                        <p className="gd-review-name">{r.rater?.full_name ?? 'Anonymous'}</p>
                                                        <div style={{ display: 'flex', gap: 2 }}>
                                                            {[1, 2, 3, 4, 5].map(s => (
                                                                <span key={s} style={{ color: s <= r.rating ? '#fbbf24' : 'var(--color-border-secondary)', fontSize: 13 }}>★</span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <span className="gd-review-date">
                                                        {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                    </span>
                                                </div>
                                                {r.comment && <p className="gd-review-body">{r.comment}</p>}
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* ── RIGHT COLUMN / SIDEBAR ── */}
                    <div className="gd-sidebar">

                        {/* Provider card */}
                        <div className="gd-card gd-provider">
                            <div className="gd-provider-top">
                                <div className="gd-provider-avatar">{initials(gig.profile?.full_name)}</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <Link to={`/profile/${gig.profile?.id}`} className="gd-provider-name">
                                        {gig.profile?.full_name ?? 'Unknown'}
                                    </Link>
                                    {gig.avgRating && (
                                        <div className="gd-provider-rating">
                                            <span style={{ color: '#fbbf24' }}>★</span>
                                            <span>{gig.avgRating.toFixed(1)}</span>
                                            <span className="gd-rating-muted">({gig.ratingCount} reviews)</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {gig.profile?.bio && <p className="gd-provider-bio">{gig.profile.bio}</p>}

                            {gig.profile?.availability?.length > 0 && (
                                <div className="gd-avail">
                                    <p className="gd-avail-label">📅 Availability</p>
                                    <div className="gd-avail-chips">
                                        {gig.profile.availability.map((t, i) => (
                                            <span key={i} className="gd-avail-chip">{t}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Hire card */}
                        {gig.user_id !== user?.id && (
                            <div className="gd-card gd-hire">
                                <h3 className="gd-hire-title">Hire {gig.profile?.full_name?.split(' ')[0]}</h3>

                                <div className="gd-offer-wrap">
                                    <label className="gd-offer-label">{gig.profile?.full_name?.split(' ')[0]}'s pricing</label>
                                    <div className="gd-offer-input">
                                        <span className="gd-offer-currency">$</span>
                                        {/* <input
                                            type="number" min="0" step="0.01"
                                            value={customAmount}
                                            onChange={e => setCustomAmount(e.target.value)}
                                            placeholder="0.00"
                                            className="gd-offer-field"
                                        /> */}
                                        <p className='gd-offer-field'>
                                            {customAmount}
                                        </p>
                                    </div>
                                    <p className="gd-offer-hint">Suggested: ${gig.price?.toFixed(2)}</p>
                                </div>

                                <div className="gd-breakdown">
                                    <div className="gd-breakdown-row">
                                        <span>Your offer</span>
                                        <span>${(parseFloat(customAmount) || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="gd-breakdown-row">
                                        <span>Service fee</span>
                                        <span>${SERVICE_FEE.toFixed(2)}</span>
                                    </div>
                                    <div className="gd-breakdown-row gd-breakdown-total">
                                        <span>Total</span>
                                        <span>${((parseFloat(customAmount) || 0) + SERVICE_FEE).toFixed(2)}</span>
                                    </div>
                                </div>

                                <div className="gd-escrow-note">
                                    <span>🔒</span>
                                    <p>Stripe integration coming soon. Coordinate payment directly after they accept.</p>
                                </div>

                                <button
                                    className="btn btn-primary gd-hire-btn"
                                    disabled={sendingRequest || !customAmount || parseFloat(customAmount) <= 0}
                                    onClick={confirmHireRequest}
                                >
                                    {sendingRequest ? 'Sending…' : 'Send Hire Request'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {toast && <div className={`toast ${toastType}`}>{toast}</div>}

            <style>{`
                .gd-page { padding-bottom: 80px; }

                .gd-back {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 7px 14px;
                    margin-bottom: 28px;
                    background: transparent;
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    font-size: 13px;
                    font-weight: 500;
                    color: var(--text-secondary);
                    cursor: pointer;
                    font-family: inherit;
                    transition: border-color 0.14s, color 0.14s;
                }
                .gd-back:hover { border-color: var(--text-secondary); color: var(--text-primary); }

                /* Layout */
                .gd-layout {
                    display: grid;
                    grid-template-columns: 1fr 360px;
                    gap: 28px;
                    align-items: start;
                }
                @media (max-width: 900px) {
                    .gd-layout { grid-template-columns: 1fr; }
                }

                /* Hero */
                .gd-hero {
                    padding: 28px;
                    background: var(--surface);
                    border: 1px solid var(--border);
                    border-radius: 14px;
                    margin-bottom: 16px;
                }
                .gd-badge {
                    display: inline-block;
                    padding: 4px 12px;
                    border-radius: 100px;
                    font-size: 11px;
                    font-weight: 600;
                    letter-spacing: 0.04em;
                    text-transform: uppercase;
                    background: #FFF7ED;
                    color: #C2410C;
                    border: 1px solid #FDBA74;
                    margin-bottom: 14px;
                }
                .gd-title {
                    font-size: 28px;
                    font-weight: 700;
                    letter-spacing: -0.02em;
                    margin: 0 0 16px;
                    line-height: 1.2;
                    color: var(--text-primary);
                }
                .gd-meta {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    flex-wrap: wrap;
                }
                .gd-price {
                    font-size: 32px;
                    font-weight: 700;
                    letter-spacing: -0.02em;
                    color: var(--text-primary);
                }
                .gd-rating-pill {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    padding: 5px 12px;
                    background: #FFFBEB;
                    border: 1px solid #FDE68A;
                    border-radius: 100px;
                    font-size: 13px;
                    font-weight: 600;
                    color: #92400E;
                }
                .gd-rating-count { font-weight: 400; opacity: 0.7; }

                /* Sections */
                .gd-section {
                    padding: 24px;
                    background: var(--surface);
                    border: 1px solid var(--border);
                    border-radius: 14px;
                    margin-bottom: 16px;
                }
                .gd-section-label {
                    font-size: 11px;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.07em;
                    color: var(--text-muted);
                    margin: 0 0 12px;
                }
                .gd-section-body {
                    font-size: 15px;
                    line-height: 1.65;
                    color: var(--text-secondary);
                    margin: 0;
                    white-space: pre-wrap;
                }

                /* Portfolio */
                .gd-portfolio {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
                    gap: 10px;
                }
                .gd-portfolio-img {
                    width: 100%;
                    height: 130px;
                    object-fit: cover;
                    border-radius: 8px;
                    border: 1px solid var(--border);
                    transition: transform 0.18s;
                }
                .gd-portfolio-img { cursor: zoom-in; }
                .gd-portfolio-img:hover { transform: scale(1.02); }

                .gd-lightbox-backdrop {
                    position: fixed; inset: 0; background: rgba(0,0,0,0.88);
                    z-index: 1000; display: flex; align-items: center; justify-content: center;
                }
                .gd-lb-img {
                    max-width: 90vw; max-height: 85vh; object-fit: contain;
                    border-radius: 8px; box-shadow: 0 8px 40px rgba(0,0,0,0.5);
                }
                .gd-lb-nav {
                    position: absolute; top: 50%; transform: translateY(-50%);
                    background: rgba(255,255,255,0.15); border: none; color: #fff;
                    font-size: 48px; line-height: 1; padding: 8px 18px; cursor: pointer;
                    border-radius: 8px; transition: background 0.15s;
                }
                .gd-lb-nav:hover { background: rgba(255,255,255,0.3); }
                .gd-lb-prev { left: 16px; }
                .gd-lb-next { right: 16px; }
                .gd-lb-close {
                    position: absolute; top: 16px; right: 16px;
                    background: rgba(255,255,255,0.15); border: none; color: #fff;
                    font-size: 20px; width: 36px; height: 36px; border-radius: 50%;
                    cursor: pointer; display: flex; align-items: center; justify-content: center;
                    transition: background 0.15s;
                }
                .gd-lb-close:hover { background: rgba(255,255,255,0.3); }
                .gd-lb-counter {
                    position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%);
                    color: rgba(255,255,255,0.7); font-size: 13px;
                }

                /* Reviews */
                .gd-reviews-count {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    margin-left: 8px;
                    width: 20px;
                    height: 20px;
                    background: var(--color-background-tertiary);
                    border-radius: 50%;
                    font-size: 11px;
                    font-weight: 700;
                    color: var(--text-secondary);
                }
                .gd-empty-reviews { font-size: 14px; color: var(--text-muted); margin: 0; }
                .gd-score-bar {
                    display: flex;
                    align-items: center;
                    gap: 14px;
                    padding: 16px;
                    background: var(--color-background-tertiary);
                    border-radius: 10px;
                    margin-bottom: 20px;
                }
                .gd-score-big {
                    font-size: 40px;
                    font-weight: 700;
                    letter-spacing: -0.03em;
                    line-height: 1;
                    color: var(--text-primary);
                }
                .gd-score-stars { display: flex; align-items: center; gap: 3px; flex-wrap: wrap; }
                .gd-score-label { font-size: 13px; color: var(--text-muted); margin-left: 6px; }
                .gd-review-list { display: flex; flex-direction: column; gap: 14px; }
                .gd-review-item {
                    padding: 16px;
                    border: 1px solid var(--border);
                    border-radius: 10px;
                    background: var(--color-background-tertiary);
                }
                .gd-review-top { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
                .gd-review-avatar {
                    width: 32px; height: 32px;
                    border-radius: 50%;
                    background: var(--color-background-info);
                    color: var(--color-text-info);
                    display: flex; align-items: center; justify-content: center;
                    font-size: 11px; font-weight: 700; flex-shrink: 0;
                }
                .gd-review-name { font-size: 13px; font-weight: 600; margin: 0 0 2px; color: var(--text-primary); }
                .gd-review-date { font-size: 11px; color: var(--text-muted); white-space: nowrap; align-self: flex-start; }
                .gd-review-body { font-size: 14px; color: var(--text-secondary); line-height: 1.5; margin: 0; }

                /* Sidebar cards */
                .gd-card {
                    background: var(--surface);
                    border: 1px solid var(--border);
                    border-radius: 14px;
                    padding: 22px;
                    margin-bottom: 16px;
                }
                .gd-sidebar { position: sticky; top: 20px; }

                /* Provider */
                .gd-provider-top { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
                .gd-provider-avatar {
                    width: 48px; height: 48px; border-radius: 50%;
                    background: var(--color-background-info);
                    color: var(--color-text-info);
                    display: flex; align-items: center; justify-content: center;
                    font-size: 16px; font-weight: 700; flex-shrink: 0;
                }
                .gd-provider-name {
                    font-size: 15px; font-weight: 600;
                    color: var(--text-primary); text-decoration: none;
                    display: block; margin-bottom: 3px;
                }
                .gd-provider-name:hover { text-decoration: underline; }
                .gd-provider-rating { display: flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 600; color: var(--text-primary); }
                .gd-rating-muted { font-weight: 400; color: var(--text-muted); font-size: 12px; }
                .gd-provider-bio { font-size: 13px; line-height: 1.5; color: var(--text-secondary); margin: 0 0 16px; }
                .gd-avail { padding-top: 14px; border-top: 1px solid var(--border); }
                .gd-avail-label { font-size: 12px; font-weight: 600; color: var(--text-secondary); margin: 0 0 8px; }
                .gd-avail-chips { display: flex; flex-wrap: wrap; gap: 6px; }
                .gd-avail-chip {
                    padding: 3px 10px;
                    background: var(--color-background-tertiary);
                    border: 1px solid var(--border);
                    border-radius: 6px;
                    font-size: 12px;
                    color: var(--text-secondary);
                }

                /* Hire */
                .gd-hire-title { font-size: 17px; font-weight: 700; margin: 0 0 18px; letter-spacing: -0.01em; }
                .gd-offer-wrap { margin-bottom: 16px; }
                .gd-offer-label { display: block; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); margin-bottom: 8px; }
                .gd-offer-input { display: flex; align-items: center; border: 1.5px solid var(--border); border-radius: 10px; overflow: hidden; background: var(--surface); transition: border-color 0.15s; }
                .gd-offer-input:focus-within { border-color: var(--primary); }
                .gd-offer-currency { padding: 12px 14px; font-size: 18px; font-weight: 700; color: var(--text-primary); background: var(--color-background-tertiary); border-right: 1px solid var(--border); }
                .gd-offer-field { flex: 1; border: none; outline: none; padding: 12px 14px; font-size: 20px; font-weight: 700; font-family: inherit; color: var(--text-primary); background: transparent; }
                .gd-offer-field::placeholder { color: var(--text-muted); font-weight: 400; font-size: 16px; }
                .gd-offer-hint { font-size: 12px; color: var(--text-muted); margin: 6px 0 0; }

                .gd-breakdown {
                    border: 1px solid var(--border);
                    border-radius: 10px;
                    overflow: hidden;
                    margin-bottom: 14px;
                    font-size: 14px;
                }
                .gd-breakdown-row { display: flex; justify-content: space-between; padding: 11px 14px; }
                .gd-breakdown-row + .gd-breakdown-row { border-top: 1px solid var(--border); }
                .gd-breakdown-total { background: var(--color-background-tertiary); font-weight: 700; font-size: 15px; }

                .gd-escrow-note {
                    display: flex; align-items: flex-start; gap: 8px;
                    padding: 11px 13px;
                    background: #FFF7ED;
                    border: 1px solid #FDBA74;
                    border-radius: 9px;
                    margin-bottom: 14px;
                    font-size: 12px;
                }
                .gd-escrow-note p { margin: 0; color: #92400E; line-height: 1.5; }

                .gd-hire-btn { width: 100%; padding: 13px; font-size: 15px; font-weight: 600; border-radius: 10px; }
                .gd-hire-btn:not(:disabled):hover { opacity: 0.9; transform: translateY(-1px); }
                .gd-hire-btn:disabled { opacity: 0.45; cursor: not-allowed; }

                /* FAQs */
                .gd-faqs { display: flex; flex-direction: column; gap: 16px; }
                .gd-faq-item {
                    padding: 16px;
                    border: 1px solid var(--border);
                    border-radius: 10px;
                    background: var(--color-background-tertiary);
                }
                .gd-faq-question {
                    font-size: 15px;
                    font-weight: 600;
                    color: var(--text-primary);
                    margin-bottom: 8px;
                    line-height: 1.4;
                }
                .gd-faq-answer {
                    font-size: 14px;
                    color: var(--text-secondary);
                    line-height: 1.5;
                    white-space: pre-wrap;
                }
            `}</style>
        </>
    );
}