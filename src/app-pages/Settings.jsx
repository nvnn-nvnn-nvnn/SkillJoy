import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useUser, useProfile } from '@/lib/stores';

export default function SettingsPage() {
    const user = useUser();
    const profile = useProfile();
    const navigate = useNavigate();

    const [email, setEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [notificationPrefs, setNotificationPrefs] = useState({
        swapRequests: true,
        gigRequests: true,
        messages: true,
        reviews: true,
    });
    const [privacySettings, setPrivacySettings] = useState({
        showEmail: false,
        showAvailability: true,
        allowMessages: true,
    });
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState('');
    const [toastType, setToastType] = useState('success');

    useEffect(() => {
        if (!user) { navigate('/login'); return; }
        setEmail(user.email || '');
        loadPreferences();
    }, [user]);

    async function loadPreferences() {
        if (profile?.notification_prefs) setNotificationPrefs(profile.notification_prefs);
        if (profile?.privacy_settings) setPrivacySettings(profile.privacy_settings);
    }

    async function updateEmail() {
        if (!email || email === user.email) { showToast('Please enter a new email address', 'error'); return; }
        setSaving(true);
        const { error } = await supabase.auth.updateUser({ email });
        setSaving(false);
        error ? showToast(error.message, 'error') : showToast('Check your inbox to confirm the change.', 'success');
    }

    async function updatePassword() {
        if (!newPassword || newPassword.length < 6) { showToast('Password must be at least 6 characters', 'error'); return; }
        if (newPassword !== confirmPassword) { showToast('Passwords do not match', 'error'); return; }
        setSaving(true);
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        setSaving(false);
        if (error) { showToast(error.message, 'error'); } else {
            showToast('Password updated!', 'success');
            setNewPassword(''); setConfirmPassword('');
        }
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

    function showToast(msg, type = 'success') {
        setToast(msg); setToastType(type);
        setTimeout(() => setToast(''), 3000);
    }

    return (
        <div className="sj-settings-page">
            <div className="sj-settings-header">
                <h1>Settings</h1>
                <p>Manage your account preferences</p>
            </div>

            {/* Account */}
            <section className="sj-card">
                <h2 className="sj-section-title">Account</h2>

                <div className="sj-field">
                    <label className="sj-label">Email address</label>
                    <div className="sj-row">
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="sj-input" />
                        <button className="sj-btn sj-btn-ghost" onClick={updateEmail} disabled={saving || email === user?.email}>
                            Update
                        </button>
                    </div>
                    <span className="sj-hint">You'll receive a confirmation email to verify the change.</span>
                </div>

                <div className="sj-divider" />

                <div className="sj-field">
                    <label className="sj-label">Change password</label>
                    <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="New password" className="sj-input" style={{ marginBottom: 8 }} />
                    <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm new password" className="sj-input" style={{ marginBottom: 12 }} />
                    <button className="sj-btn sj-btn-ghost" onClick={updatePassword} disabled={saving || !newPassword}>
                        Update password
                    </button>
                </div>
            </section>

            {/* Notifications */}
            <section className="sj-card">
                <h2 className="sj-section-title">Notifications</h2>

                {[
                    { key: 'swapRequests', label: 'Swap requests', hint: 'When someone wants to swap skills with you' },
                    { key: 'gigRequests', label: 'Gig requests', hint: 'When someone requests your gig services' },
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
                    color: var(--text-primary);
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

                .sj-section-title {
                    font-size: 15px;
                    font-weight: 600;
                    color: var(--text-primary);
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
                    color: var(--text-primary);
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
                    background: var(--primary);
                    color: #fff;
                    border-color: var(--primary);
                }
                .sj-btn-primary:hover:not(:disabled) { opacity: 0.88; }

                .sj-btn-ghost {
                    background: transparent;
                    color: var(--text-primary);
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
                    color: var(--text-primary);
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
                .sj-switch input:checked + .sj-slider { background: var(--primary); }
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
        </div>
    );
}