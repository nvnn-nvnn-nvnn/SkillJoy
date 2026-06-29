import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiFetch } from '@/lib/api';

// Phase 12 — public unsubscribe landing (from broadcast email links).
export default function Unsubscribe() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState('working'); // working | done | error
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const c = params.get('c'), e = params.get('e'), t = params.get('t');
    if (!c || !e || !t) { setStatus('error'); setMsg('This unsubscribe link is incomplete.'); return; }
    (async () => {
      try {
        const res = await apiFetch('/api/public/unsubscribe', { method: 'POST', body: JSON.stringify({ c, e, t }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not unsubscribe.');
        setStatus('done');
      } catch (err) { setStatus('error'); setMsg(err.message); }
    })();
  }, [params]);

  return (
    <div style={{ maxWidth: 420, margin: '0 auto', padding: '80px 20px', textAlign: 'center' }}>
      <title>Unsubscribe — SkillJoy</title>
      <p style={{ fontSize: 40 }}>{status === 'done' ? '✓' : status === 'error' ? '⚠️' : '…'}</p>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
        {status === 'working' ? 'Unsubscribing…' : status === 'done' ? 'You’re unsubscribed' : 'Hmm'}
      </h1>
      <p style={{ color: 'var(--text-secondary)' }}>
        {status === 'done' ? 'You won’t receive further emails from this creator.' : msg}
      </p>
    </div>
  );
}
