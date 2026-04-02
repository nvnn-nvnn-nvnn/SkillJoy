import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useUser, useProfile, useAuth, getSkillName, normalizeSkills, DAYS_OF_WEEK, TIME_PERIODS } from '@/lib/stores';
import { apiFetch } from '@/lib/api';
import SkillEditor from '@/components/Skillededitor';

export default function ProfilePage() {
    const user = useUser();
    const myProfile = useProfile();
    const { setProfile } = useAuth();
    const navigate = useNavigate();
    const { userId } = useParams();
    const [AllGigs, setAllGigs] = useState([]);
    const [busy, setBusy] = useState(false);

    const [profile, setProfileData] = useState(null);
    const [stats, setStats] = useState({ swapsCompleted: 0, gigsCompleted: 0, avgRating: 0, totalRatings: 0 });
    const [ratings, setRatings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editMode, setEditMode] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const [fullName, setFullName] = useState('');
    const [bio, setBio] = useState('');
    const [skillsTeach, setSkillsTeach] = useState([]);
    const [skillsLearn, setSkillsLearn] = useState([]);
    const [availability, setAvailability] = useState([]);


    // Avatar
    const [avatarUrl, setAvatarUrl] = useState('');
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const avatarInputRef = useRef(null);

    // Stripe Status
    const [stripeStatus, setStripeStatus] = useState(null);
    const [stripeBalance, setStripeBalance] = useState(null);

    // College verification
    const [collegeEmail, setCollegeEmail] = useState('');
    const [collegeSending, setCollegeSending] = useState(false);
    const [collegeSent, setCollegeSent] = useState(false);
    const [collegeError, setCollegeError] = useState('');





    const isOwnProfile = !userId || userId === user?.id;





    async function loadProfile() {
        setLoading(true);
        const targetId = userId || user.id;

        const { data: profileData, error: profileErr } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', targetId)
            .single();

        if (profileErr) { setError(profileErr.message); setLoading(false); return; }

        setProfileData(profileData);
        setFullName(profileData.full_name || '');
        setBio(profileData.bio || '');
        setAvatarUrl(profileData.avatar_url || '');
        setSkillsTeach(normalizeSkills(profileData.skills_teach || []));
        setSkillsLearn((profileData.skills_learn || []).map(s => getSkillName(s)));
        // Filter out old plural time periods
        const cleanAvailability = (profileData.availability || []).filter(slot =>
            !['Mornings', 'Afternoons', 'Evenings'].includes(slot)
        );
        setAvailability(cleanAvailability);

        const [swapsRes, gigsRes, ratingsRes] = await Promise.all([
            supabase.from('swaps').select('id').or(`requester_id.eq.${targetId},receiver_id.eq.${targetId}`).eq('status', 'completed'),
            supabase.from('gig_requests').select('id').or(`requester_id.eq.${targetId},provider_id.eq.${targetId}`).eq('status', 'completed'),
            supabase.from('ratings').select('rating, comment, created_at, rater:profiles!rater_id(full_name)').eq('rated_id', targetId).order('created_at', { ascending: false })
        ]);

        const swapsCompleted = swapsRes.data?.length || 0;
        const gigsCompleted = gigsRes.data?.length || 0;
        const ratingsData = ratingsRes.data || [];
        const avgRating = ratingsData.length > 0 ? ratingsData.reduce((sum, r) => sum + r.rating, 0) / ratingsData.length : 0;

        setStats({ swapsCompleted, gigsCompleted, avgRating, totalRatings: ratingsData.length });
        setRatings(ratingsData);
        setLoading(false);
    }


    async function handleAvatarUpload(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) { setError('Image must be under 2MB'); return; }
        setUploadingAvatar(true);
        const ext = file.name.split('.').pop();
        const path = `${user.id}/avatar.${ext}`;
        const { error: uploadErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
        if (uploadErr) { setError(uploadErr.message); setUploadingAvatar(false); return; }
        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
        setAvatarUrl(publicUrl);
        setUploadingAvatar(false);
    }

    async function checkStripeStatus() {
        const res = await apiFetch('/api/stripe-connect/status');
        const data = await res.json();
        if (!res.ok) { console.error(data.error); return; }
        setStripeStatus(data);
        if (data.onboarded) {
            const balRes = await apiFetch('/api/stripe-connect/balance');
            const balData = await balRes.json();
            if (balRes.ok) setStripeBalance(balData);
        }
    }

    useEffect(() => {
        if (!isOwnProfile) return;
        const params = new URLSearchParams(window.location.search);
        if (params.get('stripe') === 'success' || params.get('stripe') === 'refresh') {
            window.history.replaceState({}, '', '/profile');
        }
        checkStripeStatus(); // eslint-disable-line react-hooks/set-state-in-effect
    }, [isOwnProfile]);

    async function handleStripeOnboard() {
        const res = await apiFetch('/api/stripe-connect/onboard', { method: 'POST' });
        const data = await res.json();
        if (!res.ok) { console.error(data.error); return; }
        window.location.href = data.url;
    }












// Stripe Load End

    async function loadGigs() {
        setBusy(true);
        const targetId = userId || user.id;

        const { data, error } = await supabase
            .from('gigs')
            .select('*, profile:profiles!user_id(id, full_name, bio, service_type)')
            .eq('user_id', targetId)
            .order('created_at', { ascending: false });

        if (!error && data) {
            setAllGigs(data);
        }
        setBusy(false);
    }

    useEffect(() => {
        if (!user) { navigate('/login'); return; }
        loadProfile(); // eslint-disable-line react-hooks/set-state-in-effect
        loadGigs();
    }, [user, userId]); // eslint-disable-line react-hooks/exhaustive-deps

    async function handleSendCollegeVerification() {
        setCollegeError('');
        if (!collegeEmail.trim()) { setCollegeError('Enter your .edu email.'); return; }
        if (!collegeEmail.toLowerCase().endsWith('.edu')) { setCollegeError('Must be a .edu email address.'); return; }
        setCollegeSending(true);
        const res = await apiFetch('/api/verify-college/send', {
            method: 'POST',
            body: JSON.stringify({ collegeEmail }),
        });
        const data = await res.json();
        setCollegeSending(false);
        if (!res.ok) { setCollegeError(data.error || 'Failed to send.'); return; }
        setCollegeSent(true);
    }

    async function handleSave() {
        if (!fullName.trim()) { setError('Name is required'); return; }
        if (!skillsTeach.length) { setError('Add at least one skill you can teach'); return; }
        if (!skillsLearn.length) { setError('Add at least one skill you want to learn'); return; }

        setSaving(true);
        setError('');

        // Filter out old plural time periods (Mornings, Afternoons, Evenings)
        const cleanedAvailability = availability.filter(slot =>
            !['Mornings', 'Afternoons', 'Evenings'].includes(slot)
        );

        const { error: e } = await supabase.from('profiles').update({
            full_name: fullName,
            bio: bio,
            skills_teach: skillsTeach,
            skills_learn: skillsLearn,
            availability: cleanedAvailability,
            avatar_url: avatarUrl || null,
        }).eq('id', user.id);

        setSaving(false);

        if (e) { setError('Could not save profile. Please try again.'); return; }

        const { data: updated } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (updated) {
            setProfile(updated);
            setProfileData(updated);
        }

        setEditMode(false);
    }

    function cancelEdit() {
        setEditMode(false);
        setFullName(profile.full_name || '');
        setBio(profile.bio || '');
        setSkillsTeach(normalizeSkills(profile.skills_teach || []));
        setSkillsLearn((profile.skills_learn || []).map(s => getSkillName(s)));
        setAvailability(profile.availability || []);
        setAvatarUrl(profile.avatar_url || '');
        setError('');
    }

    function toggleAvailability(slot) {
        console.log('Toggling availability:', slot);
        setAvailability(prev => {
            const newAvail = prev.includes(slot) ? prev.filter(s => s !== slot) : [...prev, slot];
            console.log('Previous availability:', prev);
            console.log('New availability:', newAvail);
            return newAvail;
        });
    }

    if (loading) {
        return (
            <div className="page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="page">
                <div className="empty-state">
                    <span className="empty-icon">👤</span>
                    <h3>Profile not found</h3>
                    <button className="btn btn-primary" onClick={() => navigate('/')}>Go Home</button>
                </div>
            </div>
        );
    }

    return (
        <>
            <title>{profile.full_name} — SkillJoy</title>

            <div className="page">
                <div style={{
                    margin: '24px 0',
                }}>
                    <Link to="/"
                    className='btn btn-secondary'
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '14px',
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                        textDecoration: 'none',
                        transition: 'color 0.15s',
                        backgroundColor:  "#fff",
                        border: "solid 1px #000",
                        padding: "10px",
                        borderRadius: "10px"

                    
                    }}>
                        ← Back to Home
                    </Link>
                </div>
                <div className="profile-header" style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid var(--border)' }}>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                        {profile.avatar_url || avatarUrl ? (
                            <img
                                src={avatarUrl || profile.avatar_url}
                                alt={profile.full_name}
                                style={{ width: 120, height: 120, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }}
                            />
                        ) : (
                            <div className="avatar avatar-xl">{profile.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'}</div>
                        )}
                        {editMode && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => avatarInputRef.current?.click()}
                                    disabled={uploadingAvatar}
                                    style={{
                                        position: 'absolute', bottom: 0, right: 0,
                                        width: 32, height: 32, borderRadius: '50%',
                                        background: 'var(--primary)', border: '2px solid #fff',
                                        color: '#fff', fontSize: 14, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}
                                >
                                    {uploadingAvatar ? '…' : '✏️'}
                                </button>
                                <input
                                    ref={avatarInputRef}
                                    type="file"
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                    onChange={handleAvatarUpload}
                                />
                            </>
                        )}
                    </div>
                    <div className="profile-header-info">
                        {editMode ? (
                            <input
                                type="text"
                                value={fullName}
                                onChange={e => setFullName(e.target.value)}
                                className="profile-name-input"
                                placeholder="Your name"
                            />
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                <h1 className="profile-name" style={{ margin: 0 }}>{profile.full_name}</h1>
                                {profile.stripe_onboarded && (
                                    <span style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        background: '#f0fdf4',
                                        border: '1px solid #86efac',
                                        color: '#15803d',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        padding: '3px 10px',
                                        borderRadius: '20px',
                                    }}>
                                        ✓ Verified Seller
                                    </span>
                                )}
                            </div>
                        )}
                        <div className="profile-stats">
                            <div className="stat">
                                <span className="stat-value">{profile.points || 0}</span>
                                <span className="stat-label">Points</span>
                            </div>
                            <div className="stat">
                                <span className="stat-value">{stats.swapsCompleted}</span>
                                <span className="stat-label">Swaps</span>
                            </div>
                            <div className="stat">
                                <span className="stat-value">{stats.gigsCompleted}</span>
                                <span className="stat-label">Gigs</span>
                            </div>
                            <div className="stat">
                                <span className="stat-value">
                                    {stats.avgRating > 0 ? stats.avgRating.toFixed(1) : 'N/A'}
                                </span>
                                <span className="stat-label">⭐ {stats.totalRatings} ratings</span>
                            </div>
                        </div>
                    </div>
                    {isOwnProfile && !editMode && (
                        <div className="profile-header-actions" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                            <button className="btn btn-secondary" onClick={() => setEditMode(true)}>
                                Edit Profile
                            </button>
                            <button className="btn btn-secondary" onClick={() => navigate('/settings')}>
                                ⚙️ Settings
                            </button>
                            <button className="btn btn-secondary" onClick={async () => {
                                await supabase.auth.signOut();
                                navigate('/login');
                            }}>
                                Sign Out
                            </button>
                        </div>
                    )}
                    
                </div>

                {error && <div className="toast error">{error}</div>}

                {isOwnProfile && profile?.offers_gigs && (
                    <div style={{
                        padding: '16px 20px',
                        background: stripeStatus?.onboarded ? '#f0fdf4' : '#fff7ed',
                        border: `1px solid ${stripeStatus?.onboarded ? '#86efac' : '#fdba74'}`,
                        borderRadius: 10,
                        marginBottom: 20
                    }}>
                        {stripeStatus?.onboarded ? (
                            <div>
                                <p style={{ color: '#15803d', fontWeight: 600, margin: '0 0 10px' }}>
                                    ✅ Payouts active — you'll receive funds when buyers release payment.
                                </p>
                                {stripeBalance && (
                                    <div style={{ display: 'flex', flexDirection:"column", gap: '16px', flexWrap: 'wrap' }}>
                                        <div style={{ background: '#fff', border: '1px solid #86efac', borderRadius: 8, padding: '10px 16px' }}>
                                            <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 500, marginBottom: 2 }}>AVAILABLE</div>
                                            <div style={{ fontSize: '20px', fontWeight: 700, color: '#15803d' }}>${stripeBalance.available.toFixed(2)}</div>
                                        </div>
                                        <div style={{ background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, padding: '10px 16px' }}>
                                            <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 500, marginBottom: 2 }}>PENDING</div>
                                            <div style={{ fontSize: '20px', fontWeight: 700, color: '#374151' }}>${stripeBalance.pending.toFixed(2)}</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <>
                                <p style={{ color: '#92400e', fontWeight: 600, margin: '0 0 10px' }}>
                                    ⚠️ Set up payouts to receive money from completed orders.
                                </p>
                                <button className="btn btn-primary" onClick={handleStripeOnboard}>
                                    Set Up Payouts with Stripe
                                </button>
                            </>
                        )}
                    </div>
                )}

                {isOwnProfile && (
                    <div style={{
                        padding: '16px 20px',
                        background: profile?.college_verified ? '#f0fdf4' : '#fff7ed',
                        border: `1px solid ${profile?.college_verified ? '#86efac' : '#fdba74'}`,
                        borderRadius: 10,
                        marginBottom: 20,
                    }}>
                        {profile?.college_verified ? (
                            <p style={{ color: '#15803d', fontWeight: 600, margin: 0 }}>
                                🎓 College verified — {profile.university_domain}. You're seeing students at your school.
                            </p>
                        ) : collegeSent ? (
                            <div>
                                <p style={{ color: '#92400e', fontWeight: 600, margin: '0 0 4px' }}>📧 Verification email sent!</p>
                                <p style={{ color: '#92400e', fontSize: 13, margin: 0 }}>Check your .edu inbox and click the link to verify.</p>
                            </div>
                        ) : (
                            <>
                                <p style={{ color: '#92400e', fontWeight: 600, margin: '0 0 10px' }}>
                                    🎓 Verify your college email to connect with students at your university.
                                </p>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    <input
                                        type="email"
                                        value={collegeEmail}
                                        onChange={e => setCollegeEmail(e.target.value)}
                                        placeholder="you@university.edu"
                                        style={{ flex: 1, minWidth: 200, padding: '8px 12px', borderRadius: 8, border: '1px solid #fdba74', fontSize: 14 }}
                                    />
                                    <button className="btn btn-primary" onClick={handleSendCollegeVerification} disabled={collegeSending}>
                                        {collegeSending ? 'Sending…' : 'Send verification'}
                                    </button>
                                </div>
                                {collegeError && <p style={{ color: '#ef4444', fontSize: 13, margin: '8px 0 0' }}>{collegeError}</p>}
                            </>
                        )}
                    </div>
                )}

                <div className="profile-section">
                    <h2 className="section-title">About</h2>
                    {editMode ? (
                        <textarea
                            value={bio}
                            onChange={e => setBio(e.target.value)}
                            placeholder="Tell others about yourself..."
                            className="profile-bio-input"
                            rows={4}
                        />
                    ) : (
                        <p className="profile-bio">{profile.bio || 'No bio yet.'}</p>
                    )}
                </div>

                <div className="profile-section">
                    <h2 className="section-title">Availability</h2>
                    {editMode ? (
                        <div>
                            <div style={{ marginBottom: '20px' }}>
                                <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '10px', color: 'var(--text-primary)' }}>Days of the Week</h3>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {DAYS_OF_WEEK.map(day => (
                                        <button
                                            key={day}
                                            onClick={() => toggleAvailability(day)}
                                            style={{
                                                padding: '8px 16px',
                                                background: availability.includes(day) ? 'var(--primary)' : 'var(--surface-alt)',
                                                color: availability.includes(day) ? '#fff' : 'var(--text-primary)',
                                                border: '1px solid',
                                                borderColor: availability.includes(day) ? 'var(--primary)' : 'var(--border)',
                                                borderRadius: '8px',
                                                fontSize: '13px',
                                                fontWeight: 500,
                                                cursor: 'pointer',
                                                transition: 'all 0.15s'
                                            }}
                                        >
                                            {day}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '10px', color: 'var(--text-primary)' }}>Time Periods</h3>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {TIME_PERIODS.map(time => (
                                        <button
                                            key={time}
                                            onClick={() => toggleAvailability(time)}
                                            style={{
                                                padding: '8px 16px',
                                                background: availability.includes(time) ? 'var(--primary)' : 'var(--surface-alt)',
                                                color: availability.includes(time) ? '#fff' : 'var(--text-primary)',
                                                border: '1px solid',
                                                borderColor: availability.includes(time) ? 'var(--primary)' : 'var(--border)',
                                                borderRadius: '8px',
                                                fontSize: '13px',
                                                fontWeight: 500,
                                                cursor: 'pointer',
                                                transition: 'all 0.15s'
                                            }}
                                        >
                                            {time}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        profile?.availability && profile.availability.length > 0 ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {profile.availability.map((time, i) => (
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
                        ) : (
                            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No availability set yet.</p>
                        )
                    )}
                </div>

                <div className="profile-section">
                    <h2 className="section-title">Can Teach</h2>
                    {editMode ? (
                        <SkillEditor
                            skills={skillsTeach}
                            onChange={setSkillsTeach}
                            type="teach"
                        />
                    ) : (
                        <div className="skill-tags">
                            {skillsTeach.map((s, i) => (
                                <span key={i} className="skill-tag skill-teach">
                                    {getSkillName(s)}
                                    {typeof s === 'object' && s.stars && (
                                        <span className="skill-stars"> {'⭐'.repeat(s.stars)}</span>
                                    )}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                <div className="profile-section">
                    <h2 className="section-title">Wants to Learn</h2>
                    {editMode ? (
                        <SkillEditor
                            skills={skillsLearn}
                            onChange={setSkillsLearn}
                            type="learn"
                        />
                    ) : (
                        <div className="skill-tags">
                            {skillsLearn.map((s, i) => (
                                <span key={i} className="skill-tag skill-learn">{s}</span>
                            ))}
                        </div>
                    )}
                </div>

                {AllGigs.length > 0 && (
                    <div className="profile-section">
                        <h2 className="section-title">{isOwnProfile ? 'My Gigs' : 'Gigs'} ({AllGigs.length})</h2>
                        <div className="profile-gigs-grid">
                            {AllGigs.map((gig) => (
                                <div
                                    key={gig.id}
                                    className="profile-gig-card"
                                    onClick={() => navigate(`/gigs/${gig.id}`)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <div className="profile-gig-header">
                                        <h3 className="profile-gig-title">{gig.title}</h3>
                                        {gig.category && (
                                            <span className="profile-gig-category">{gig.category}</span>
                                        )}
                                    </div>
                                    {gig.description && (
                                        <p className="profile-gig-desc">{gig.description.slice(0, 120)}{gig.description.length > 120 ? '...' : ''}</p>
                                    )}
                                    <div className="profile-gig-footer">
                                        <span className="profile-gig-price">${gig.price?.toFixed(2)}</span>
                                        <span className="profile-gig-arrow">→</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}



                {ratings.length > 0 && (
                    <div className="profile-section">
                        <h2 className="section-title">Reviews ({ratings.length})</h2>
                        <div className="ratings-list">
                            {ratings.map((rating, i) => (
                                <div key={i} className="rating-card">
                                    <div className="rating-header">
                                        <span className="rating-stars">{'⭐'.repeat(rating.rating)}</span>
                                        <span className="rating-date">{new Date(rating.created_at).toLocaleDateString()}</span>
                                    </div>
                                    {rating.comment && <p className="rating-comment">{rating.comment}</p>}
                                    <p className="rating-author">— {rating.rater?.full_name || 'Anonymous'}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {editMode && (
                    <div className="profile-actions">
                        <button className="btn btn-secondary" onClick={cancelEdit} disabled={saving}>
                            Cancel
                        </button>
                        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                )}
            </div>

            <style>{`
                .profile-header {
                    display: flex;
                    flex-direction: row;
                    align-items: flex-start;
                    gap: 24px;
                    margin-bottom: 40px;
                    padding-bottom: 24px;
                    border-bottom: 1px solid var(--border);
                }
                .avatar-xl {
                    width: 120px !important;
                    height: 120px !important;
                    font-size: 36px !important;
                    flex-shrink: 0;
                }
                .profile-header-info {
                    flex: 1;
                }
                .profile-name {
                    font-size: 32px;
                    font-weight: 700;
                    margin: 0 0 16px;
                }
                .profile-name-input {
                    width: 100%;
                    max-width: 400px;
                    font-size: 28px;
                    font-weight: 700;
                    padding: 8px 12px;
                    border: 2px solid var(--border);
                    border-radius: var(--r);
                    margin-bottom: 16px;
                }
                .profile-stats {
                    display: flex;
                    gap: 32px;
                }
                .stat {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                .stat-value {
                    font-size: 24px;
                    font-weight: 700;
                    color: var(--primary);
                }
                .stat-label {
                    font-size: 12px;
                    color: var(--text-secondary);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .profile-section {
                    margin-bottom: 24px;
                    background: #f0ede8;
                    padding: 24px;
                    border-radius: 16px;
                }
                .section-title {
                    font-size: 18px;
                    font-weight: 600;
                    margin-bottom: 16px;
                    color: var(--text);
                }
                .profile-bio {
                    color: var(--text-secondary);
                    line-height: 1.6;
                    white-space: pre-wrap;
                }
                .profile-bio-input {
                    width: 100%;
                    padding: 12px;
                    border: 1px solid var(--border);
                    border-radius: var(--r);
                    font-family: var(--font-body);
                    font-size: 14px;
                    resize: vertical;
                }
                .skill-tags {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                }
                .skill-stars {
                    margin-left: 4px;
                    font-size: 10px;
                }
                .ratings-list {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }
                .rating-card {
                    padding: 16px;
                    background: var(--surface);
                    border: 1px solid var(--border);
                    border-radius: var(--r-lg);
                }
                .rating-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                }
                .rating-stars {
                    font-size: 16px;
                }
                .rating-date {
                    font-size: 12px;
                    color: var(--text-muted);
                }
                .rating-comment {
                    color: var(--text-secondary);
                    line-height: 1.5;
                    margin: 8px 0;
                }
                .rating-author {
                    font-size: 13px;
                    color: var(--text-muted);
                    font-style: italic;
                    margin: 0;
                }
                .profile-actions {
                    display: flex;
                    gap: 12px;
                    justify-content: flex-end;
                    padding-top: 24px;
                    border-top: 1px solid var(--border);
                }
                .profile-gigs-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                    gap: 16px;
                }
                .profile-gig-card {
                    background: var(--surface);
                    border: 1px solid var(--border);
                    border-radius: var(--r-lg);
                    padding: 16px;
                    transition: all 0.2s;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                .profile-gig-card:hover {
                    box-shadow: var(--shadow);
                    transform: translateY(-2px);
                    border-color: var(--primary);
                }
                .profile-gig-header {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }
                .profile-gig-title {
                    font-size: 16px;
                    font-weight: 600;
                    margin: 0;
                    color: var(--text);
                }
                .profile-gig-category {
                    display: inline-block;
                    padding: 4px 10px;
                    border-radius: 100px;
                    font-size: 11px;
                    font-weight: 600;
                    background: #FFF7ED;
                    color: #C2410C;
                    border: 1px solid #FDBA74;
                    width: fit-content;
                }
                .profile-gig-desc {
                    font-size: 13px;
                    color: var(--text-secondary);
                    line-height: 1.5;
                    margin: 0;
                    flex: 1;
                }
                .profile-gig-footer {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding-top: 8px;
                    border-top: 1px solid var(--border);
                }
                .profile-gig-price {
                    font-size: 18px;
                    font-weight: 700;
                    color: var(--primary);
                }
                .profile-gig-arrow {
                    font-size: 18px;
                    color: var(--text-muted);
                    transition: transform 0.2s;
                }
                .profile-gig-card:hover .profile-gig-arrow {
                    transform: translateX(4px);
                    color: var(--primary);
                }
                @media (max-width: 768px) {
                    .profile-header {
                        flex-direction: column;
                        align-items: center;
                        text-align: center;
                        padding: 16px;
                    }
                    .profile-name { font-size: 22px; }
                    .profile-name-input { font-size: 20px; max-width: 100%; }
                    .profile-stats {
                        justify-content: center;
                        gap: 16px;
                    }
                    .stat-value { font-size: 18px; }
                    .profile-header-actions {
                        width: 100%;
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                    }
                    .profile-section { padding: 16px; }
                    .profile-actions {
                        flex-direction: column-reverse;
                    }
                    .profile-actions .btn { width: 100%; }
                    .profile-gigs-grid {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
        </>
    );
}
