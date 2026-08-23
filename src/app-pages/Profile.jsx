import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useUser, useAuth } from '@/lib/stores';
import { listPublishedSkills } from '@/lib/skills';
import { apiFetch } from '@/lib/api';
import ReportModal from '@/components/ReportModal';
import BlockButton from '@/components/BlockButton';
import { Camera, Check, Pencil, ExternalLink, Store, Settings, LogOut, Flag, RefreshCw, Eye, EyeOff, Mail, Phone } from 'lucide-react';
import { PROFILE_CARD_COLORS, cardColorVars } from '@/lib/profileCard';

// Partial masks. These keep enough shape to identify WHICH value is on file
// (the domain, the last four digits) while hiding the part that identifies the
// person. Fully-dotted values would tell the owner nothing, so they'd reveal
// and leave it revealed — a privacy control people turn off isn't one.
function maskEmail(email) {
    if (!email) return '—';
    const [name, domain] = String(email).split('@');
    if (!domain) return '••••••••';
    // First character only; the rest is a fixed-length run so the mask never
    // leaks how long the local part actually is.
    return `${name.slice(0, 1)}••••••@${domain}`;
}

function maskPhone(phone) {
    const digits = String(phone || '').replace(/\D/g, '');
    if (digits.length < 4) return '••••••••';
    return `••• ••• ${digits.slice(-4)}`;
}

// v3 — a modern "account hub": identity + payouts + quick links. The swap-era
// profile (teach/learn skills, availability, profile ratings/comments,
// verified-seller escrow copy) was removed — the public identity is the
// storefront (/@handle); detailed account controls live in Settings.
export default function ProfilePage() {
    const user = useUser();
    const { setProfile, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const { userId } = useParams();

    const [profile, setProfileData] = useState(null);
    const [stats, setStats] = useState({ skillsCount: 0 });
    const [loading, setLoading] = useState(true);
    const [editMode, setEditMode] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const [fullName, setFullName] = useState('');
    const [bio, setBio] = useState('');
    const [username, setUsername] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const avatarInputRef = useRef(null);
    const [cardColor, setCardColor] = useState('default');

    // Contact details start HIDDEN on every load, and this is deliberately not
    // persisted. Screen-sharing and screenshots are the actual threat here, and
    // a remembered "shown" preference would defeat the whole control the first
    // time someone demos their dashboard on a call.
    const [showContact, setShowContact] = useState(false);

    const [stripeStatus, setStripeStatus] = useState(null);
    const [stripeEarnings, setStripeEarnings] = useState(null);

    const isOwnProfile = !userId || userId === user?.id;
    const [showReport, setShowReport] = useState(false);
    const [isBlocked, setIsBlocked] = useState(false);

    async function loadProfile() {
        setLoading(true);
        const targetId = userId || user.id;

        let profileData;
        try {
            if (isOwnProfile) {
                const { data, error: profileErr } = await supabase
                    .from('profiles').select('*').eq('id', targetId).single();
                if (profileErr) { setError(profileErr.message); setLoading(false); return; }
                profileData = data;
            } else {
                const res = await apiFetch(`/api/users/profile/${targetId}`);
                if (res.status === 403) { setError('blocked_by_owner'); setLoading(false); return; }
                if (!res.ok) { setError('Profile not found.'); setLoading(false); return; }
                profileData = await res.json();
            }
        } catch {
            setError('Could not load profile. Please try again.');
            setLoading(false);
            return;
        }

        setProfileData(profileData);
        setFullName(profileData.full_name || '');
        setBio(profileData.bio || '');
        setUsername(profileData.username || '');
        setAvatarUrl(profileData.avatar_url || '');
        setCardColor(profileData.profile_card_color || 'default');

        const skills = await listPublishedSkills(targetId).catch(() => []);
        setStats({ skillsCount: skills?.length || 0 });

        if (!isOwnProfile) {
            const res = await apiFetch('/api/blocks');
            if (res.ok) {
                const blocks = await res.json();
                setIsBlocked(blocks.some(b => b.blocked_id === targetId));
            }
        }

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
        const bustUrl = `${publicUrl}?t=${Date.now()}`;
        await supabase.from('profiles').update({ avatar_url: bustUrl }).eq('id', user.id);
        setAvatarUrl(bustUrl);
        setUploadingAvatar(false);
    }

    async function checkStripeStatus() {
        const res = await apiFetch('/api/stripe-connect/status');
        const data = await res.json();
        if (!res.ok) { console.error(data.error); return; }
        setStripeStatus(data);
        if (data.onboarded) {
            const balRes = await apiFetch('/api/stripe-connect/earnings');
            const balData = await balRes.json();
            if (balRes.ok) setStripeEarnings(balData);
        }
    }

    async function handleStripeOnboard() {
        const res = await apiFetch('/api/stripe-connect/onboard', { method: 'POST' });
        const data = await res.json();
        if (!res.ok) { console.error(data.error); return; }
        window.location.href = data.url;
    }

    // Handle-change cooldown (server-enforced; this is display logic only).
    const USERNAME_COOLDOWN_DAYS = 15;
    const nextUsernameChange = profile?.username_changed_at
        ? new Date(new Date(profile.username_changed_at).getTime() + USERNAME_COOLDOWN_DAYS * 86400000)
        : null;
    const usernameLocked = !!nextUsernameChange && Date.now() < nextUsernameChange.getTime();
    const normalizeHandle = (raw) => (raw || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);

    async function handleSave() {
        if (!fullName.trim()) { setError('Name is required'); return; }
        setSaving(true);
        setError('');

        // Username first (its own server-authoritative endpoint) — abort on failure
        // so the user sees the error and nothing half-saves silently.
        const newHandle = normalizeHandle(username);
        if (!usernameLocked && newHandle && newHandle !== (profile.username || '')) {
            try {
                const res = await apiFetch('/api/users/username', {
                    method: 'POST',
                    body: JSON.stringify({ username: newHandle }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                    // Surface the real cause: server message if present, else the status
                    // (404 = route/backend stale, 500 = migration 024 not applied, etc.).
                    console.error('Username change failed', res.status, data);
                    setError(data.error || `Could not change username (HTTP ${res.status}).`);
                    setSaving(false);
                    return;
                }
            } catch (err) {
                // fetch threw → the request never reached the backend (server down,
                // wrong VITE_API_URL, or CORS). apiFetch does NOT throw on HTTP errors.
                console.error('Username change request could not reach the server:', err);
                setError('Couldn’t reach the server. Make sure you’re online and signed in, then try again.');
                setSaving(false);
                return;
            }
        }

        const { error: e } = await supabase.from('profiles').update({
            full_name: fullName, bio, avatar_url: avatarUrl || null,
            // 'default' is stored as NULL so the column's meaning stays "an
            // explicit override exists", not "someone once opened the picker".
            profile_card_color: cardColor === 'default' ? null : cardColor,
        }).eq('id', user.id);
        setSaving(false);
        if (e) { setError('Could not save profile. Please try again.'); return; }
        const { data: updated } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (updated) { setProfile(updated); setProfileData(updated); setUsername(updated.username || ''); }
        setEditMode(false);
    }

    function cancelEdit() {
        setEditMode(false);
        setFullName(profile.full_name || '');
        setBio(profile.bio || '');
        setUsername(profile.username || '');
        setAvatarUrl(profile.avatar_url || '');
        setCardColor(profile.profile_card_color || 'default');
        setError('');
    }

    useEffect(() => {
        if (!isOwnProfile) return;
        const params = new URLSearchParams(window.location.search);
        if (params.get('stripe') === 'success' || params.get('stripe') === 'refresh') {
            window.history.replaceState({}, '', '/profile');
        }
        checkStripeStatus(); // eslint-disable-line react-hooks/set-state-in-effect
    }, [isOwnProfile]);

    useEffect(() => {
        if (authLoading) return;
        if (!user) { navigate('/login'); return; }
        loadProfile(); // eslint-disable-line react-hooks/set-state-in-effect
    }, [user, userId, authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

    if (loading) {
        return (
            <div className="pf" style={{ display: 'flex', justifyContent: 'center', minHeight: '60vh', alignItems: 'center' }}>
                <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
                <Styles />
            </div>
        );
    }

    if (error === 'blocked_by_owner' || !profile) {
        return (
            <div className="pf" style={{ textAlign: 'center', paddingTop: 60 }}>
                <div style={{ fontSize: 44, marginBottom: 10 }}>{error === 'blocked_by_owner' ? '🚫' : '👤'}</div>
                <h2 style={{ margin: '0 0 8px', fontWeight: 800 }}>{error === 'blocked_by_owner' ? 'Profile not available' : 'Profile not found'}</h2>
                <button className="btn btn-secondary" onClick={() => navigate(-1)} style={{ marginTop: 12 }}>Go back</button>
                <Styles />
            </div>
        );
    }

    const avatarSrc = avatarUrl || profile.avatar_url;
    const initials = (profile.full_name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

    return (
        <>
            <title>{profile.full_name || 'Profile'} — SkillJoy</title>

            <div className="pf">
                {/* ── Hero ──
                    Tinted per the creator's chosen preset. The style attribute
                    only sets CSS VARIABLES; which pair (light/dark) actually
                    applies is decided in the stylesheet, because a style
                    attribute can't hold a media query. */}
                <div className={`pf-hero${cardColor !== 'default' ? ' pf-hero-tinted' : ''}`}
                     style={cardColorVars(cardColor)}>
                    <div className="pf-avwrap">
                        {avatarSrc
                            ? <img className="pf-av" src={avatarSrc} alt={profile.full_name} />
                            : <div className="pf-av pf-av-fb">{initials}</div>}
                        {isOwnProfile && editMode && (
                            <>
                                <button type="button" className="pf-avedit" onClick={() => avatarInputRef.current?.click()} disabled={uploadingAvatar} aria-label="Change photo">
                                    {uploadingAvatar ? '…' : <Camera size={15} />}
                                </button>
                                <input ref={avatarInputRef} type="file" accept="image/*" hidden onChange={handleAvatarUpload} />
                            </>
                        )}
                    </div>

                    <div className="pf-id">
                        {isOwnProfile && editMode ? (
                            <input className="pf-nameinput" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your name" />
                        ) : (
                            <div className="pf-namerow">
                                <h1 className="pf-name">{profile.full_name || 'Unnamed'}</h1>
                                {profile.stripe_onboarded && <span className="pf-verified"><Check size={12} /> Verified</span>}
                            </div>
                        )}
                        {profile.username && !editMode && (
                            <Link to={`/@${profile.username}`} className="pf-handle">@{profile.username}</Link>
                        )}
                        {isOwnProfile && editMode && (
                            <div className="pf-handlefield">
                                <div className={`pf-handlewrap${usernameLocked ? ' locked' : ''}`}>
                                    <span className="pf-handleprefix">skilljoy.me/@</span>
                                    <input
                                        value={username}
                                        onChange={e => setUsername(normalizeHandle(e.target.value))}
                                        readOnly={usernameLocked}
                                        placeholder="yourhandle"
                                        autoCapitalize="none"
                                        spellCheck={false}
                                    />
                                </div>
                                <p className="pf-handlenote">
                                    {usernameLocked
                                        ? `You can change your username again on ${nextUsernameChange.toLocaleDateString()}.`
                                        : 'Changing your handle breaks old links to your page. Once every 15 days.'}
                                </p>
                            </div>
                        )}
                        {isOwnProfile && editMode ? (
                            <textarea className="pf-bioinput" rows={3} value={bio} onChange={e => setBio(e.target.value)} placeholder="A short bio…" />
                        ) : (
                            profile.bio && <p className="pf-bio">{profile.bio}</p>
                        )}
                        {isOwnProfile && editMode && (
                            <div className="pf-colorfield">
                                <span className="pf-colorlabel">Card colour</span>
                                <div className="pf-swatches" role="radiogroup" aria-label="Profile card colour">
                                    {PROFILE_CARD_COLORS.map(c => (
                                        <button
                                            key={c.key}
                                            type="button"
                                            role="radio"
                                            aria-checked={cardColor === c.key}
                                            aria-label={c.label}
                                            title={c.label}
                                            className={`pf-swatch${cardColor === c.key ? ' on' : ''}`}
                                            style={{ '--sw': c.light.tint, '--swe': c.light.edge }}
                                            onClick={() => setCardColor(c.key)}
                                        >
                                            {cardColor === c.key && <Check size={13} />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="pf-stats">
                            <div className="pf-stat"><span className="pf-statv">{stats.skillsCount}</span><span className="pf-statl">Products</span></div>
                        </div>
                    </div>
                </div>

                {error && error !== 'blocked_by_owner' && <p className="pf-err">{error}</p>}

                {/* ── Actions ── */}
                {isOwnProfile ? (
                    editMode ? (
                        <div className="pf-editbar">
                            <button className="btn btn-secondary" onClick={cancelEdit} disabled={saving}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
                        </div>
                    ) : (
                        <div className="pf-actions">
                            <button className="pf-actbtn" onClick={() => setEditMode(true)}><Pencil size={15} /> Edit profile</button>
                            {profile.username && <Link className="pf-actbtn" to={`/@${profile.username}`}><ExternalLink size={15} /> View my page</Link>}
                            <Link className="pf-actbtn" to="/storefront/edit"><Store size={15} /> Edit my page</Link>
                            <Link className="pf-actbtn" to="/settings"><Settings size={15} /> Settings</Link>
                            <button className="pf-actbtn" onClick={async () => { await supabase.auth.signOut(); navigate('/login'); }}><LogOut size={15} /> Sign out</button>
                        </div>
                    )
                ) : (
                    <div className="pf-actions">
                        <button className="pf-actbtn pf-actbtn-danger" onClick={() => setShowReport(true)}><Flag size={15} /> Report</button>
                        <BlockButton userId={profile?.id} initialState={isBlocked} onBlock={() => setIsBlocked(true)} onUnblock={() => setIsBlocked(false)} />
                    </div>
                )}

                {/* ── Contact details (own only) ──
                    Masked by default. The mask keeps the shape of the value
                    (domain, last 4 digits) so you can confirm WHICH address or
                    number is on file without exposing it — full dots would make
                    the row useless while hidden, and people would just leave it
                    revealed, which defeats the point. */}
                {isOwnProfile && (
                    <section className="pf-card">
                        <div className="pf-contacthead">
                            <h2 className="pf-cardtitle" style={{ margin: 0 }}>Contact details</h2>
                            <button
                                type="button"
                                className="pf-eye"
                                onClick={() => setShowContact(v => !v)}
                                aria-pressed={showContact}
                                aria-label={showContact ? 'Hide contact details' : 'Show contact details'}
                                title={showContact ? 'Hide' : 'Show'}
                            >
                                {showContact ? <EyeOff size={16} /> : <Eye size={16} />}
                                <span>{showContact ? 'Hide' : 'Show'}</span>
                            </button>
                        </div>

                        <div className="pf-contactrow">
                            <span className="pf-contacticon"><Mail size={15} /></span>
                            <span className="pf-contactlabel">Email</span>
                            <span className={`pf-contactval${showContact ? '' : ' masked'}`}>
                                {showContact ? (user?.email || '—') : maskEmail(user?.email)}
                            </span>
                        </div>

                        <div className="pf-contactrow">
                            <span className="pf-contacticon"><Phone size={15} /></span>
                            <span className="pf-contactlabel">Phone</span>
                            {profile.phone ? (
                                <span className={`pf-contactval${showContact ? '' : ' masked'}`}>
                                    {showContact ? profile.phone : maskPhone(profile.phone)}
                                </span>
                            ) : (
                                <Link to="/settings" className="pf-contactadd">Add a number</Link>
                            )}
                        </div>

                        <p className="pf-contacthint">
                            Only you can see this. Hidden by default so it stays private while you’re
                            screen-sharing. Change either in <Link to="/settings">Settings</Link>.
                        </p>
                    </section>
                )}

                {/* ── Payouts (own only) ── */}
                {isOwnProfile && (
                    <section className="pf-card">
                        <h2 className="pf-cardtitle">Payouts</h2>
                        {stripeStatus?.onboarded ? (
                            <>
                                <div className="pf-payhead">
                                    <span className="pf-ok"><Check size={14} /> Payouts active</span>
                                    <button className="pf-icobtn" onClick={checkStripeStatus} title="Refresh"><RefreshCw size={14} /></button>
                                </div>
                                {stripeEarnings && (
                                    <div className="pf-earn">
                                        {[
                                            ['In escrow', stripeEarnings.inEscrow, 'held until release'],
                                            ['Clearing', stripeEarnings.pendingClearance, 'clears soon'],
                                            ['Available', stripeEarnings.stripeAvailable, 'ready to pay out'],
                                            ['In transit', stripeEarnings.stripePending, 'arriving soon'],
                                        ].map(([label, val, sub]) => (
                                            <div key={label} className="pf-earntile">
                                                <div className="pf-earnl">{label}</div>
                                                <div className="pf-earnv">${(val ?? 0).toFixed(2)}</div>
                                                <div className="pf-earnsub">{sub}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <button className="pf-stripe" onClick={async () => {
                                    const res = await apiFetch('/api/stripe-connect/dashboard-link', { method: 'POST' });
                                    const data = await res.json();
                                    if (data.url) window.open(data.url, '_blank');
                                }}>Open Stripe dashboard <ExternalLink size={13} /></button>
                            </>
                        ) : (
                            <>
                                <p className="pf-muted">Connect Stripe to receive money from your sales — it handles bank transfers for you.</p>
                                <button className="btn btn-primary" onClick={handleStripeOnboard}>Set up payouts</button>
                            </>
                        )}
                    </section>
                )}
            </div>

            <ReportModal isOpen={showReport} onClose={() => setShowReport(false)} reportedType="user" reportedId={profile?.id} reportedName={profile?.full_name} />
            <Styles />
        </>
    );
}

function Styles() {
    return <style>{`
        .pf { max-width: 720px; margin: 0 auto; padding: 32px 20px 80px; }
        .pf-hero { display: flex; gap: 22px; align-items: flex-start; }
        /* Tinted hero. Only applied when a preset is chosen, so the default
           profile keeps its existing borderless layout exactly as it was. */
        .pf-hero-tinted { background: var(--pfc-tint); border: 1px solid var(--pfc-edge);
            border-radius: var(--r-lg); padding: 22px 24px; }
        .pf-hero-tinted .pf-handle,
        .pf-hero-tinted .pf-statv { color: var(--pfc-accent); }
        /* The style attribute carries both palettes; the media query picks. */
        @media (prefers-color-scheme: dark) {
            .pf-hero-tinted { background: var(--pfc-tint-dark); border-color: var(--pfc-edge-dark); }
            .pf-hero-tinted .pf-handle,
            .pf-hero-tinted .pf-statv { color: var(--pfc-accent-dark); }
        }

        .pf-colorfield { margin-top: 14px; }
        .pf-colorlabel { display: block; font-size: 11px; font-weight: 700; text-transform: uppercase;
            letter-spacing: .04em; color: var(--text-muted); margin-bottom: 7px; }
        .pf-swatches { display: flex; flex-wrap: wrap; gap: 7px; }
        .pf-swatch { width: 28px; height: 28px; padding: 0; flex: 0 0 28px; border-radius: var(--r-full);
            background: var(--sw); border: 1.5px solid var(--swe); cursor: pointer;
            display: inline-flex; align-items: center; justify-content: center; color: var(--text);
            transition: transform .12s ease, box-shadow .12s ease; }
        .pf-swatch:hover { transform: scale(1.1); }
        .pf-swatch.on { box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--text); }
        .pf-swatch:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--accent); }

        .pf-contacthead { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
        .pf-eye { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; width: auto;
            border: 1px solid var(--border-strong); border-radius: var(--r-full); background: var(--surface);
            color: var(--text-secondary); font-size: 12.5px; font-weight: 700; font-family: inherit; cursor: pointer; }
        .pf-eye:hover { border-color: var(--accent); color: var(--accent); }
        .pf-contactrow { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-top: 1px solid var(--border); }
        .pf-contactrow:first-of-type { border-top: none; padding-top: 0; }
        .pf-contacticon { display: inline-flex; color: var(--text-muted); flex-shrink: 0; }
        .pf-contactlabel { flex: 0 0 62px; font-size: 13px; font-weight: 600; color: var(--text-muted); }
        .pf-contactval { flex: 1; min-width: 0; font-size: 14px; color: var(--text); overflow: hidden;
            text-overflow: ellipsis; white-space: nowrap; }
        /* Tabular figures keep the visible last-4 from shifting as the dots
           render, and user-select:none stops a "hidden" value being copied. */
        .pf-contactval.masked { color: var(--text-secondary); letter-spacing: .04em;
            font-variant-numeric: tabular-nums; user-select: none; }
        .pf-contactadd { flex: 1; font-size: 13px; font-weight: 700; color: var(--accent); text-decoration: none; }
        .pf-contactadd:hover { text-decoration: underline; }
        .pf-contacthint { margin: 12px 0 0; font-size: 12px; line-height: 1.55; color: var(--text-muted); }
        .pf-contacthint a { color: var(--accent); font-weight: 600; }
        .pf-avwrap { position: relative; flex-shrink: 0; }
        .pf-av { width: 104px; height: 104px; border-radius: 50%; object-fit: cover; border: 1px solid var(--border); background: var(--surface-alt); }
        .pf-av-fb { display: flex; align-items: center; justify-content: center; font-size: 34px; font-weight: 800; color: var(--text-muted); }
        .pf-avedit { position: absolute; bottom: 2px; right: 2px; width: 32px; height: 32px; min-width: 0; padding: 0; display: flex; align-items: center; justify-content: center; border-radius: 50%; border: 2px solid var(--surface); background: var(--accent); color: #fff; cursor: pointer; }
        .pf-id { flex: 1; min-width: 0; padding-top: 4px; }
        .pf-namerow { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .pf-name { font-size: 28px; font-weight: 800; letter-spacing: -0.02em; margin: 0; color: var(--text); }
        .pf-verified { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 700; color: var(--accent-hover); background: var(--accent-light); border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent); padding: 3px 10px; border-radius: var(--r-full); }
        .pf-handle { display: inline-block; margin-top: 5px; font-size: 14px; font-weight: 600; color: var(--accent); text-decoration: none; }
        .pf-handle:hover { text-decoration: underline; }
        .pf-bio { margin: 12px 0 0; color: var(--text-secondary); line-height: 1.6; white-space: pre-wrap; }
        .pf-nameinput { width: 100%; font-size: 22px; font-weight: 800; padding: 8px 12px; border: 1.5px solid var(--border-strong); border-radius: var(--r); background: var(--surface); color: var(--text); }
        .pf-bioinput { width: 100%; margin-top: 10px; padding: 10px 12px; border: 1.5px solid var(--border-strong); border-radius: var(--r); font: inherit; font-size: 14px; resize: vertical; background: var(--surface); color: var(--text); }
        .pf-handlefield { margin-top: 10px; }
        .pf-handlewrap { display: flex; align-items: center; border: 1.5px solid var(--border-strong); border-radius: var(--r); background: var(--surface); overflow: hidden; }
        .pf-handlewrap:focus-within { border-color: var(--accent); }
        .pf-handlewrap.locked { background: var(--surface-alt); opacity: 0.75; }
        .pf-handleprefix { padding: 0 2px 0 12px; font-size: 14px; color: var(--text-muted); white-space: nowrap; user-select: none; }
        .pf-handlewrap input { flex: 1; border: none; outline: none; box-shadow: none; padding: 10px 10px 10px 0; background: transparent; font-size: 14px; font-weight: 600; color: var(--text); }
        .pf-handlenote { margin: 6px 0 0; font-size: 12px; color: var(--text-muted); }
        .pf-stats { display: flex; gap: 26px; margin-top: 16px; }
        .pf-stat { display: flex; flex-direction: column; gap: 2px; }
        .pf-statv { font-size: 22px; font-weight: 800; color: var(--text); }
        .pf-statl { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); }
        .pf-err { margin-top: 16px; color: #dc2626; font-size: 14px; }

        .pf-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 24px; }
        .pf-actbtn { display: inline-flex; align-items: center; gap: 7px; min-width: 0; width: auto; padding: 9px 16px; border-radius: var(--r-full); border: 1px solid var(--border-strong); background: var(--surface); color: var(--text); font-size: 13.5px; font-weight: 600; cursor: pointer; text-decoration: none; transition: border-color .14s, color .14s, transform .14s; }
        .pf-actbtn:hover { border-color: var(--accent); color: var(--accent); transform: translateY(-1px); }
        .pf-actbtn-danger:hover { border-color: #ef4444; color: #ef4444; }
        .pf-editbar { display: flex; justify-content: flex-end; gap: 10px; margin-top: 22px; }

        .pf-card { margin-top: 26px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg); padding: 22px 24px; box-shadow: var(--shadow-sm); }
        .pf-cardtitle { font-size: 15px; font-weight: 800; margin: 0 0 14px; color: var(--text); }
        .pf-muted { font-size: 14px; color: var(--text-secondary); line-height: 1.55; margin: 0 0 14px; }
        .pf-payhead { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
        .pf-ok { display: inline-flex; align-items: center; gap: 5px; font-size: 13.5px; font-weight: 700; color: var(--accent-hover); }
        .pf-icobtn { width: 30px; height: 30px; min-width: 0; padding: 0; display: flex; align-items: center; justify-content: center; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text-muted); cursor: pointer; }
        .pf-icobtn:hover { color: var(--text); }
        .pf-earn { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 14px; }
        .pf-earntile { background: var(--surface-alt); border: 1px solid var(--border); border-radius: var(--r); padding: 11px 13px; }
        .pf-earnl { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); }
        .pf-earnv { font-size: 19px; font-weight: 800; color: var(--text); margin-top: 3px; }
        .pf-earnsub { font-size: 11px; color: var(--text-muted); margin-top: 1px; }
        .pf-stripe { display: inline-flex; align-items: center; justify-content: center; gap: 7px; width: 100%; padding: 11px; border-radius: var(--r); border: none; background: #635bff; color: #fff; font-size: 13.5px; font-weight: 700; cursor: pointer; }
        .pf-stripe:hover { opacity: 0.92; }

        @media (max-width: 640px) {
            .pf-hero { flex-direction: column; align-items: center; text-align: center; }
            .pf-namerow, .pf-stats, .pf-actions { justify-content: center; }
        }
    `}</style>;
}
