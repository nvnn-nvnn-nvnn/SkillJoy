import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch } from '@/lib/api';
import { useAuth, useProfile } from '@/lib/stores';
import { supabase } from '@/lib/supabase';

export default function VerifyCollegePage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { setProfile } = useAuth();
    const profile = useProfile();
    const [status, setStatus] = useState('verifying'); // verifying | success | error
    const [message, setMessage] = useState('');

    useEffect(() => {
        const token = searchParams.get('token');
        if (!token) { setStatus('error'); setMessage('No verification token found.'); return; }
        confirm(token);
    }, []);

    async function confirm(token) {
        const res = await apiFetch('/api/verify-college/confirm', {
            method: 'POST',
            body: JSON.stringify({ token }),
        });
        const data = await res.json();

        if (!res.ok) {
            setStatus('error');
            setMessage(data.error || 'Verification failed.');
            return;
        }

        // Refresh profile in store
        if (profile) {
            const { data: updated } = await supabase.from('profiles').select('*').eq('id', profile.id).single();
            if (updated) setProfile(updated);
        }

        setStatus('success');
    }

    return (
        <div className="page" style={{ maxWidth: 480, margin: '80px auto', textAlign: 'center' }}>
            {status === 'verifying' && (
                <>
                    <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3, margin: '0 auto 24px' }} />
                    <p style={{ color: 'var(--text-secondary)' }}>Verifying your college email…</p>
                </>
            )}

            {status === 'success' && (
                <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 16, padding: '40px 32px' }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>🎓</div>
                    <h2 style={{ fontWeight: 700, marginBottom: 8 }}>College verified!</h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
                        You're now connected to your university network. You'll see gigs and swaps from students at your school.
                    </p>
                    <button className="btn btn-primary" onClick={() => navigate('/gigs')}>
                        Browse your campus
                    </button>
                </div>
            )}

            {status === 'error' && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 16, padding: '40px 32px' }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
                    <h2 style={{ fontWeight: 700, marginBottom: 8 }}>Verification failed</h2>
                    <p style={{ color: '#991b1b', marginBottom: 24 }}>{message}</p>
                    <button className="btn btn-secondary" onClick={() => navigate('/profile')}>
                        Back to Profile
                    </button>
                </div>
            )}
        </div>
    );
}
