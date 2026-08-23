import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useUser, useProfile, useAuth } from '@/lib/stores';
import { apiFetch } from '@/lib/api';
import { getBillingStatus, openBillingPortal, startSubscription, trialDaysLeft } from '@/lib/billing';
import BillingSetupModal from '@/components/BillingSetupModal';
import { Eye, EyeOff } from 'lucide-react';
import { getTheme, setTheme } from '@/lib/theme';

export default function SettingsPage() {
    const user = useUser();
    const profile = useProfile();
    const { setProfile } = useAuth();
    const navigate = useNavigate();

    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [offersGigs, setOffersGigs] = useState(false);
    const [notificationPrefs, setNotificationPrefs] = useState({
        swapRequests: true, gigRequests: true, messages: true, reviews: true,
    });
    const [privacySettings, setPrivacySettings] = useState({
        showEmail: false, showAvailability: true, allowMessages: true,
    });
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState('');
    const [toastType, setToastType] = useState('success');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteInput, setDeleteInput] = useState('');
    const [blockedUsers, setBlockedUsers] = useState([]);
    const [unblockingId, setUnblockingId] = useState(null);
    const [billing, setBilling] = useState(null);      // null = loading, {status:'none'|...}
    const [billingBusy, setBillingBusy] = useState(false);
    // Same default-hidden contract as the Profile page: contact details are
    // obscured until asked for, and the choice is never persisted so a
    // screen-share always starts safe. Editable fields can't use a text mask
    // (you'd be typing into dots), so this flips the input TYPE instead —
    // the familiar password-reveal affordance, applied to both at once.
    const [showContact, setShowContact] = useState(false);
    // Separate from showContact on purpose: revealing your email is a much
    // smaller exposure than revealing a password you're mid-way through typing,
    // so one control shouldn't unmask both.
    const [showPasswords, setShowPasswords] = useState(false);
    const [billingModal, setBillingModal] = useState(null); // null | 'no-account' | 'has-products'
    const [billingErr, setBillingErr] = useState('');
    const [theme, setThemeState] = useState(getTheme());

    useEffect(() => {
        if (!user) { navigate('/login'); return; }
        setEmail(user.email || '');
        if (profile) {
            setPhone(profile.phone ?? '');
            setOffersGigs(profile.offers_gigs || false);
            if (profile.notification_prefs) setNotificationPrefs(profile.notification_prefs);
            if (profile.privacy_settings) setPrivacySettings(profile.privacy_settings);
        }
        loadBlockedUsers();
        getBillingStatus().then(setBilling).catch(() => setBilling({ status: 'error' }));
    }, [user, profile]);

    async function manageSubscription() {
        setBillingBusy(true);
        try { await openBillingPortal(); } // redirects on success
        catch (err) {
            setBillingBusy(false);
            // "No billing account yet — subscribe first." is accurate and
            // unhelpful: it doesn't say that the platform plan is a different
            // thing from Connect payouts, or how to start one. Show the
            // explainer instead of a toast that vanishes.
            if (/no billing account/i.test(err.message)) setBillingModal('no-account');
            else showToast(err.message, 'error');
        }
    }

    async function startPlanFromModal() {
        setBillingBusy(true); setBillingErr('');
        try { await startSubscription(); }  // redirects away on success
        catch (err) { setBillingErr(err.message); setBillingBusy(false); }
    }

    async function loadBlockedUsers() {
        const res = await apiFetch('/api/blocks');
        if (res.ok) setBlockedUsers(await res.json());
    }

    async function handleUnblock(blockedId) {
        setUnblockingId(blockedId);
        const res = await apiFetch('/api/blocks/unblock', { method: 'POST', body: JSON.stringify({ blockedId }) });
        if (res.ok) setBlockedUsers(prev => prev.filter(b => b.blocked_id !== blockedId));
        setUnblockingId(null);
    }

    async function updateEmail() {
        if (!email || email === user.email) { showToast('Please enter a new email address', 'error'); return; }
        setSaving(true);
        const { error } = await supabase.auth.updateUser({ email });
        setSaving(false);
        error ? showToast(error.message, 'error') : showToast('Check your inbox to confirm the change.', 'success');
    }

    async function savePhone() {
        setSaving(true);
        const { error } = await supabase.from('profiles').update({ phone: phone.trim() || null }).eq('id', user.id);
        setSaving(false);
        if (error) { showToast(error.message, 'error'); return; }
        const { data: updated } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (updated) setProfile(updated);
        showToast('Phone number saved!', 'success');
    }

    async function updatePassword() {
        if (!currentPassword) { showToast('Enter your current password', 'error'); return; }
        if (!newPassword || newPassword.length < 6) { showToast('New password must be at least 6 characters', 'error'); return; }
        if (newPassword !== confirmPassword) { showToast('Passwords do not match', 'error'); return; }
        setSaving(true);
        // Re-authenticate with current password first
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
        if (signInError) { setSaving(false); showToast('Current password is incorrect', 'error'); return; }
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        setSaving(false);
        if (error) { showToast(error.message, 'error'); } else {
            showToast('Password updated!', 'success');
            setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
        }
    }

    async function saveGigSettings() {
        setSaving(true);
        const turningOff = profile?.offers_gigs === true && offersGigs === false;
        const { error } = await supabase.from('profiles').update({ offers_gigs: offersGigs }).eq('id', user.id);
        setSaving(false);
        if (error) { showToast(error.message, 'error'); return; }
        const { data: updated } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (updated) setProfile(updated);
        if (turningOff) {
            await supabase.from('notifications').insert({
                user_id: user.id,
                type: 'order_update',
                title: 'Selling is now paused',
                message: 'Your storefront is no longer visible to buyers. No new sales will come in until you re-enable selling in Settings. Your Skills and payout info are safe.',
            });
        }
        showToast('Settings saved!', 'success');
    }

    async function saveNotificationPrefs() {
        setSaving(true);
        const { error } = await supabase.from('profiles').update({ notification_prefs: notificationPrefs }).eq('id', user.id);
        setSaving(false);
        error ? showToast(error.message, 'error') : showToast('Notification preferences saved!', 'success');
    }

    async function savePrivacySettings() {
        setSaving(true);
        const { error } = await supabase.from('profiles').update({ privacy_settings: privacySettings }).eq('id', user.id);
        setSaving(false);
        error ? showToast(error.message, 'error') : showToast('Privacy settings saved!', 'success');
    }

    async function deleteAccount() {
        if (deleteInput !== 'DELETE') return;
        setSaving(true);
        try {
            const res = await apiFetch('/api/users/account', { method: 'DELETE' });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || 'Failed to delete account');
            }
            await supabase.auth.signOut();
            navigate('/login');
        } catch (err) {
            showToast(err.message, 'error');
            setSaving(false);
        }
    }

    function showToast(msg, type = 'success') {
        setToast(msg); setToastType(type);
        setTimeout(() => setToast(''), 3000);
    }

    return (
        <div className="sj-settings-page">
            <div className="sj-settings-header">
                <h1>Settings</h1>
                <p style={{ color: 'var(--text-muted)' }}>Manage your account preferences</p>
            </div>

            {/* Account */}
            <section className="sj-card">
                <div className="sj-section-head">
                    <h2 className="sj-section-title" style={{ margin: 0 }}>Account</h2>
                    <button
                        type="button"
                        className="sj-eye"
                        onClick={() => setShowContact(v => !v)}
                        aria-pressed={showContact}
                        aria-label={showContact ? 'Hide email and phone' : 'Show email and phone'}
                    >
                        {showContact ? <EyeOff size={15} /> : <Eye size={15} />}
                        {showContact ? 'Hide' : 'Show'}
                    </button>
                </div>

                <div className="sj-field">
                    <label className="sj-label">Email address</label>
                    <div className="sj-row">
                        <input type={showContact ? 'email' : 'password'} value={email} onChange={e => setEmail(e.target.value)} className="sj-input" autoComplete="email" />
                        <button className="sj-btn sj-btn-ghost" onClick={updateEmail} disabled={saving || email === user?.email}>
                            Update
                        </button>
                    </div>
                    <span className="sj-hint">You'll receive a confirmation email to verify the change.</span>
                </div>

                <div className="sj-divider" />

                <div className="sj-field">
                    <label className="sj-label">Phone number</label>
                    <div className="sj-row">
                        <input type={showContact ? 'tel' : 'password'} value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. +1 555 123 4567" className="sj-input" autoComplete="tel" />
                        <button className="sj-btn sj-btn-ghost" onClick={savePhone} disabled={saving}>Save</button>
                    </div>
                    <span className="sj-hint">Private — required to publish your storefront, used for account verification. Never shown publicly.</span>
                </div>

                <div className="sj-divider" />

                <div className="sj-field">
                    <div className="sj-section-head" style={{ marginBottom: 8 }}>
                        <label className="sj-label" style={{ margin: 0 }}>Change password</label>
                        {/* One toggle for all three fields. Revealing only "new"
                            while "confirm" stays masked is the worst of both — you
                            still can't verify they match, which is the actual reason
                            people want to see a password in the first place. */}
                        <button
                            type="button"
                            className="sj-eye"
                            onClick={() => setShowPasswords(v => !v)}
                            aria-pressed={showPasswords}
                            aria-label={showPasswords ? 'Hide passwords' : 'Show passwords'}
                        >
                            {showPasswords ? <EyeOff size={15} /> : <Eye size={15} />}
                            {showPasswords ? 'Hide' : 'Show'}
                        </button>
                    </div>
                    <input type={showPasswords ? 'text' : 'password'} value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="Current password" className="sj-input" autoComplete="current-password" style={{ marginBottom: 8 }} />
                    <input type={showPasswords ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="New password" className="sj-input" autoComplete="new-password" style={{ marginBottom: 8 }} />
                    <input type={showPasswords ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm new password" className="sj-input" autoComplete="new-password" style={{ marginBottom: 12 }} />
                    <button className="sj-btn sj-btn-ghost" onClick={updatePassword} disabled={saving || !currentPassword || !newPassword}>
                        Update password
                    </button>
                </div>

                {profile?.tos_accepted_at && (
                    <>
                        <div className="sj-divider" />
                        <p className="sj-hint" style={{ margin: 0 }}>
                            Terms accepted on {new Date(profile.tos_accepted_at).toLocaleDateString()}
                            {profile.tos_version ? ` (v${profile.tos_version})` : ''}
                        </p>
                    </>
                )}
            </section>

            {/* Appearance — site-wide light/dark */}
            <section className="sj-card">
                <h2 className="sj-section-title">Appearance</h2>
                <div className="sj-toggle-row" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                    <div>
                        <p className="sj-toggle-label">Theme</p>
                        <p className="sj-hint">Choose light or dark for your dashboard.</p>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        {['light', 'dark'].map(t => (
                            <button
                                key={t}
                                className={`sj-btn ${theme === t ? 'sj-btn-primary' : 'sj-btn-ghost'}`}
                                onClick={() => { setTheme(t); setThemeState(t); }}
                                style={{ textTransform: 'capitalize', minWidth: 74 }}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            {/* Subscription (platform billing — manage/cancel via Stripe portal) */}
            <section className="sj-card">
                <h2 className="sj-section-title">Subscription</h2>
                {billing === null ? (
                    <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>Loading…</p>
                ) : billing.status === 'error' ? (
                    <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>Couldn't load your subscription right now.</p>
                ) : billing.status === 'none' ? (
                    // Was a dead sentence. It's now the one place in Settings a
                    // creator can start the plan deliberately, instead of only
                    // discovering it as a blocker at publish time.
                    <>
                        <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 12px' }}>
                            You’re not subscribed yet. Your storefront goes live once your platform plan starts —
                            14 days free, and you’re not charged today.
                        </p>
                        <button className="sj-btn sj-btn-ghost" onClick={() => setBillingModal('has-products')} disabled={billingBusy}>
                            Set up billing
                        </button>
                        <p className="sj-hint" style={{ marginTop: 8 }}>
                            This is separate from your payout account — that one pays <em>you</em>. Building and
                            customizing stay free either way.
                        </p>
                    </>
                ) : (
                    <>
                        <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 14 }}>
                            {billing.status === 'trialing' && (
                                <p style={{ margin: 0 }}>
                                    <strong style={{ color: 'var(--text)' }}>Free trial</strong>
                                    {billing.trial_ends_at ? ` — ${trialDaysLeft(billing.trial_ends_at)} day${trialDaysLeft(billing.trial_ends_at) === 1 ? '' : 's'} left` : ''}
                                </p>
                            )}
                            {billing.status === 'active' && (
                                <p style={{ margin: 0 }}>
                                    <strong style={{ color: 'var(--text)' }}>Active</strong>
                                    {billing.current_period_end ? ` — renews ${new Date(billing.current_period_end).toLocaleDateString()}` : ''}
                                </p>
                            )}
                            {billing.status === 'past_due' && (
                                <p style={{ margin: 0, color: 'var(--danger)' }}>
                                    <strong>Payment issue</strong> — your storefront is paused. Update your card to bring it back.
                                </p>
                            )}
                            {!['trialing', 'active', 'past_due'].includes(billing.status) && (
                                <p style={{ margin: 0 }}>Status: {billing.status}</p>
                            )}
                        </div>
                        <button className="sj-btn sj-btn-ghost" onClick={manageSubscription} disabled={billingBusy}>
                            {billingBusy ? 'Opening…' : 'Manage / cancel subscription'}
                        </button>
                        <p className="sj-hint" style={{ marginTop: 8 }}>Opens Stripe's secure billing portal — update your card, view invoices, or cancel.</p>
                    </>
                )}
            </section>

            {/* Selling */}
            <section className="sj-card">
                <h2 className="sj-section-title">Selling</h2>
                <div className="sj-toggle-row">
                    <div>
                        <p className="sj-toggle-label">Enable selling</p>
                        <p className="sj-hint">Publish your storefront and let people buy your Skills</p>
                    </div>
                    <label className="sj-switch">
                        <input type="checkbox" checked={offersGigs} onChange={e => setOffersGigs(e.target.checked)} />
                        <span className="sj-slider" />
                    </label>
                </div>
                <button className="sj-btn sj-btn-primary" onClick={saveGigSettings} disabled={saving} style={{ marginTop: 16 }}>
                    {saving ? 'Saving…' : 'Save'}
                </button>
            </section>

            {/* Notifications */}
            <section className="sj-card">
                <h2 className="sj-section-title">Notifications</h2>

                {[
                    { key: 'swapRequests', label: 'New sales', hint: 'When someone buys one of your Skills' },
                    { key: 'gigRequests', label: 'Booking requests', hint: 'When someone books a coaching call or session' },
                    { key: 'messages', label: 'New messages', hint: 'When you receive a direct message' },
                    { key: 'reviews', label: 'Reviews & ratings', hint: 'When someone leaves you a review' },
                ].map(({ key, label, hint }) => (
                    <div className="sj-toggle-row" key={key}>
                        <div>
                            <p className="sj-toggle-label">{label}</p>
                            <p className="sj-hint">{hint}</p>
                        </div>
                        <label className="sj-switch">
                            <input
                                type="checkbox"
                                checked={notificationPrefs[key]}
                                onChange={e => setNotificationPrefs({ ...notificationPrefs, [key]: e.target.checked })}
                            />
                            <span className="sj-slider" />
                        </label>
                    </div>
                ))}

                <button className="sj-btn sj-btn-primary" onClick={saveNotificationPrefs} disabled={saving} style={{ marginTop: 8 }}>
                    {saving ? 'Saving…' : 'Save preferences'}
                </button>
            </section>

            {/* Privacy */}
            <section className="sj-card">
                <h2 className="sj-section-title">Privacy</h2>

                {[
                    { key: 'showEmail', label: 'Show email on profile', hint: 'Let others see your email address' },
                    { key: 'showAvailability', label: 'Show availability', hint: 'Display your schedule to other users' },
                    { key: 'allowMessages', label: 'Allow direct messages', hint: 'Let other users message you directly' },
                ].map(({ key, label, hint }) => (
                    <div className="sj-toggle-row" key={key}>
                        <div>
                            <p className="sj-toggle-label">{label}</p>
                            <p className="sj-hint">{hint}</p>
                        </div>
                        <label className="sj-switch">
                            <input
                                type="checkbox"
                                checked={privacySettings[key]}
                                onChange={e => setPrivacySettings({ ...privacySettings, [key]: e.target.checked })}
                            />
                            <span className="sj-slider" />
                        </label>
                    </div>
                ))}

                <button className="sj-btn sj-btn-primary" onClick={savePrivacySettings} disabled={saving} style={{ marginTop: 8 }}>
                    {saving ? 'Saving…' : 'Save settings'}
                </button>
            </section>

            {/* Blocked Users */}
            <section className="sj-card">
                <h2 className="sj-section-title">Blocked Users</h2>
                {blockedUsers.length === 0 ? (
                    <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>You haven't blocked anyone.</p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {blockedUsers.map(b => (
                            <div key={b.blocked_id} style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    {b.blocked?.avatar_url
                                        ? <img src={b.blocked.avatar_url} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                                        : <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>
                                            {b.blocked?.full_name?.[0]?.toUpperCase() ?? '?'}
                                          </div>
                                    }
                                    <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{b.blocked?.full_name ?? 'Unknown user'}</span>
                                </div>
                                <button
                                    className="sj-btn"
                                    style={{ fontSize: 13, padding: '5px 14px' }}
                                    disabled={unblockingId === b.blocked_id}
                                    onClick={() => handleUnblock(b.blocked_id)}
                                >
                                    {unblockingId === b.blocked_id ? 'Unblocking…' : 'Unblock'}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Danger Zone */}
            <section className="sj-card" style={{ borderColor: 'var(--danger-mid)' }}>
                <h2 className="sj-section-title" style={{ color: 'var(--danger)' }}>Danger Zone</h2>
                {!showDeleteConfirm ? (
                    <div>
                        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>
                            Permanently delete your account and all associated data. This cannot be undone.
                        </p>
                        <button className="sj-btn" style={{ background: 'var(--danger-light)', color: 'var(--danger)', border: '1px solid var(--danger-mid)' }} onClick={() => setShowDeleteConfirm(true)}>
                            Delete account
                        </button>
                    </div>
                ) : (
                    <div>
                        <p style={{ fontSize: 14, color: 'var(--danger)', fontWeight: 600, marginBottom: 8 }}>
                            Type DELETE to confirm
                        </p>
                        <div className="sj-row">
                            <input
                                className="sj-input"
                                value={deleteInput}
                                onChange={e => setDeleteInput(e.target.value)}
                                placeholder="DELETE"
                            />
                            <button
                                className="sj-btn"
                                style={{ background: 'var(--danger-solid)', color: '#fff', border: 'none' }}
                                onClick={deleteAccount}
                                disabled={deleteInput !== 'DELETE' || saving}
                            >
                                Confirm
                            </button>
                            <button className="sj-btn sj-btn-ghost" onClick={() => { setShowDeleteConfirm(false); setDeleteInput(''); }}>
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </section>

            {toast && <div className={`sj-toast sj-toast-${toastType}`}>{toast}</div>}

            <style>{`
                .sj-settings-page {
                    max-width: 640px;
                    margin: 0 auto;
                    padding: 40px 24px 80px;
                }

                .sj-settings-header {
                    margin-bottom: 32px;
                }
                .sj-settings-header h1 {
                    font-size: 26px;
                    font-weight: 600;
                    color: var(--text);
                    margin: 0 0 4px;
                }
                .sj-settings-header p {
                    font-size: 14px;
                    color: var(--text-muted);
                    margin: 0;
                }

                .sj-card {
                    background: var(--surface);
                    border: 1px solid var(--border);
                    border-radius: 14px;
                    padding: 28px;
                    margin-bottom: 20px;
                }

                .sj-section-head {
                    display: flex; align-items: center; justify-content: space-between;
                    gap: 12px; margin-bottom: 18px;
                }
                .sj-eye {
                    display: inline-flex; align-items: center; gap: 6px; width: auto; flex-shrink: 0;
                    padding: 6px 12px; border: 1px solid var(--border-strong); border-radius: var(--r-full);
                    background: var(--surface); color: var(--text-secondary);
                    font-size: 12.5px; font-weight: 700; font-family: inherit; cursor: pointer;
                }
                .sj-eye:hover { border-color: var(--accent); color: var(--accent); }
                .sj-section-title {
                    font-size: 15px;
                    font-weight: 600;
                    color: var(--text);
                    margin: 0 0 20px;
                    letter-spacing: -0.01em;
                }

                .sj-field { margin-bottom: 4px; }

                .sj-label {
                    display: block;
                    font-size: 13px;
                    font-weight: 500;
                    color: var(--text-secondary);
                    margin-bottom: 8px;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                }

                .sj-row {
                    display: flex;
                    gap: 10px;
                    align-items: center;
                    margin-bottom: 6px;
                }

                .sj-input {
                    flex: 1;
                    width: 100%;
                    padding: 10px 14px;
                    border: 1px solid var(--border);
                    border-radius: 9px;
                    background: var(--surface-alt, #f9f8f5);
                    color: var(--text);
                    font-size: 14px;
                    font-family: inherit;
                    transition: border-color 0.15s;
                    box-sizing: border-box;
                }
                .sj-input:focus {
                    outline: none;
                    border-color: var(--primary);
                    background: var(--surface);
                }
                .sj-input::placeholder { color: var(--text-muted); }

                .sj-hint {
                    font-size: 12px;
                    color: var(--text-muted);
                    margin: 4px 0 0;
                    line-height: 1.5;
                }

                .sj-divider {
                    height: 1px;
                    background: var(--border);
                    margin: 20px 0;
                }

                .sj-btn {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    padding: 9px 18px;
                    border-radius: 9px;
                    font-size: 13px;
                    font-weight: 500;
                    font-family: inherit;
                    cursor: pointer;
                    transition: background 0.15s, opacity 0.15s, border-color 0.15s;
                    border: 1px solid transparent;
                    white-space: nowrap;
                }
                .sj-btn:disabled { opacity: 0.45; cursor: not-allowed; }

                .sj-btn-primary {
                    background: var(--accent);
                    color: var(--accent-foreground);
                    border-color: var(--accent);
                }
                .sj-btn-primary:hover:not(:disabled) { opacity: 0.88; }

                .sj-btn-ghost {
                    background: transparent;
                    color: var(--text);
                    border-color: var(--border);
                }
                .sj-btn-ghost:hover:not(:disabled) {
                    background: var(--surface-alt, #f5f4f0);
                    border-color: var(--text-secondary);
                }

                .sj-toggle-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 16px;
                    padding: 14px 0;
                    border-bottom: 1px solid var(--border);
                }
                .sj-toggle-row:last-of-type { border-bottom: none; }

                .sj-toggle-label {
                    font-size: 14px;
                    font-weight: 500;
                    color: var(--text);
                    margin: 0 0 2px;
                }

                .sj-switch {
                    position: relative;
                    display: inline-block;
                    width: 40px;
                    height: 22px;
                    flex-shrink: 0;
                    cursor: pointer;
                }
                .sj-switch input { opacity: 0; width: 0; height: 0; }
                .sj-slider {
                    position: absolute;
                    inset: 0;
                    background: var(--border);
                    border-radius: 100px;
                    transition: background 0.2s;
                }
                .sj-slider:before {
                    content: '';
                    position: absolute;
                    width: 16px;
                    height: 16px;
                    left: 3px;
                    top: 3px;
                    background: #fff;
                    border-radius: 50%;
                    transition: transform 0.2s;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.15);
                }
                .sj-switch input:checked + .sj-slider { background: var(--accent); }
                .sj-switch input:checked + .sj-slider:before { transform: translateX(18px); }

                .sj-toast {
                    position: fixed;
                    bottom: 28px;
                    left: 50%;
                    transform: translateX(-50%);
                    padding: 11px 22px;
                    border-radius: 100px;
                    font-size: 13px;
                    font-weight: 500;
                    white-space: nowrap;
                    z-index: 999;
                    box-shadow: 0 4px 16px rgba(0,0,0,0.12);
                }
                .sj-toast-success { background: #1a1a1a; color: #fff; }
                .sj-toast-error   { background: #ef4444; color: #fff; }
            `}</style>

            <BillingSetupModal
                open={!!billingModal}
                reason={billingModal || 'no-account'}
                busy={billingBusy}
                error={billingErr}
                onStart={startPlanFromModal}
                onClose={() => { setBillingModal(null); setBillingErr(''); setBillingBusy(false); }}
            />
        </div>
    );
}