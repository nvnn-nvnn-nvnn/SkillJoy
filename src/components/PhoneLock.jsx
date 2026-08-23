import { useState } from 'react';
import { Lock, Phone, ShieldCheck, Rocket, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useUser, useProfile, useAuth } from '@/lib/stores';

// ── Products-dashboard lock screen ──────────────────────────────────────────
//
// Phone became OPTIONAL at signup (see auth/Onboarding.jsx). It is still
// required before anyone can sell — backend/routes/skills.js refuses to publish
// without it — so the requirement had to move somewhere, and this is it.
//
// Why here and not back in onboarding: at signup the creator has invested
// nothing and a mandatory field is pure friction, measured in abandoned
// accounts. By the time they open /services they came here wanting to build
// something, so the ask lands when it can be paid for with a reason ("this is
// what unlocks selling") instead of just demanded.
//
// It is a LOCK, not a nag: the dashboard behind it genuinely cannot be used yet,
// so a dismissible banner would be a lie. Saving the number swaps this out for
// the real dashboard immediately, with no reload.
export default function PhoneLock({ onSaved }) {
  const user = useUser();
  const profile = useProfile();
  const { setProfile } = useAuth();
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Deliberately permissive: 7+ digits after stripping formatting. Real numbers
  // vary wildly by country, and a strict regex here would reject valid users to
  // catch typos it can't actually detect. Verification is a separate concern.
  const digits = phone.replace(/\D/g, '');
  const valid = digits.length >= 7;

  async function save(e) {
    e?.preventDefault();
    if (!valid) { setErr('Enter a phone number with at least 7 digits.'); return; }
    setBusy(true); setErr('');
    try {
      const { error } = await supabase
        .from('profiles').update({ phone: phone.trim() }).eq('id', user.id);
      if (error) throw error;
      // Update the shared store so every other surface (Settings, Profile,
      // the publish gate's local check) sees it without a refetch.
      if (profile) setProfile({ ...profile, phone: phone.trim() });
      onSaved?.(phone.trim());
    } catch (e2) {
      setErr(e2.message || 'Could not save your number. Try again.');
      setBusy(false);
    }
  }

  return (
    <div className="pl">
      <div className="pl-card">
        <span className="pl-badge"><Lock size={20} /></span>

        <h1 className="pl-title">One step before you can sell</h1>
        <p className="pl-lede">
          Add a phone number to unlock the product builder. It’s used to verify your account and
          keep payouts secure — it’s never shown on your page or given to buyers.
        </p>

        <form className="pl-form" onSubmit={save}>
          <label className="pl-label" htmlFor="pl-phone">Phone number</label>
          <div className="pl-inputwrap">
            <span className="pl-inputicon"><Phone size={16} /></span>
            <input
              id="pl-phone"
              type="tel"
              autoComplete="tel"
              autoFocus
              value={phone}
              onChange={e => { setPhone(e.target.value); if (err) setErr(''); }}
              placeholder="e.g. +1 555 123 4567"
              aria-invalid={!!err}
              aria-describedby={err ? 'pl-err' : undefined}
            />
          </div>
          {err && <p className="pl-err" id="pl-err" role="alert">{err}</p>}

          <button className="pl-save" type="submit" disabled={busy || !valid}>
            {busy ? 'Saving…' : 'Save & unlock'}
          </button>
        </form>

        <div className="pl-perks">
          <p className="pl-perkshead">What unlocks</p>
          <ul>
            <li><span className="pl-tick"><Check size={13} /></span> The full product builder — courses, digital products, coaching, and more</li>
            <li><span className="pl-tick"><Check size={13} /></span> <strong>14 days free</strong> once you publish — card captured then, first charge on day 14</li>
            <li><span className="pl-tick"><Check size={13} /></span> Your storefront goes live at your own link</li>
          </ul>
        </div>

        <div className="pl-foot">
          <span className="pl-footitem"><ShieldCheck size={14} /> Never shown publicly</span>
          <span className="pl-footitem"><Rocket size={14} /> Takes about 10 seconds</span>
        </div>
      </div>

      <Styles />
    </div>
  );
}

function Styles() {
  return <style>{`
    .pl { display:flex; justify-content:center; padding:44px 20px 96px; }
    .pl-card { width:100%; max-width:520px; background:var(--surface); border:1px solid var(--border);
      border-radius:var(--r-lg); padding:34px 30px 26px; box-shadow:var(--shadow-lg); text-align:left; }
    .pl-badge { display:inline-flex; align-items:center; justify-content:center; width:48px; height:48px;
      border-radius:var(--r-full); background:var(--accent-light); color:var(--accent-hover); margin-bottom:18px; }
    .pl-title { font-size:24px; font-weight:800; letter-spacing:-.015em; color:var(--text); margin:0 0 10px;
      font-family:var(--font-display); line-height:1.25; }
    .pl-lede { font-size:14.5px; line-height:1.65; color:var(--text-secondary); margin:0 0 24px; }

    .pl-form { display:flex; flex-direction:column; }
    .pl-label { font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.05em;
      color:var(--text-muted); margin-bottom:7px; }
    /* Icon sits inside the field: the input's own left padding is enlarged
       rather than wrapping it in a flex row, so the global input styling in
       App.css (border, focus ring, radius) still applies to the real element. */
    .pl-inputwrap { position:relative; }
    .pl-inputicon { position:absolute; left:13px; top:50%; transform:translateY(-50%);
      display:inline-flex; color:var(--text-muted); pointer-events:none; }
    .pl-inputwrap input { padding-left:38px; }
    .pl-err { color:var(--danger); font-size:13px; font-weight:600; margin:8px 0 0; }
    .pl-save { margin-top:14px; width:100%; padding:13px 22px; border-radius:var(--r-full); border:none;
      background:var(--accent); color:var(--accent-foreground); font-size:15px; font-weight:700;
      font-family:inherit; cursor:pointer; }
    .pl-save:hover:not(:disabled) { background:var(--accent-hover); }
    .pl-save:disabled { opacity:.5; cursor:default; }

    .pl-perks { margin-top:26px; padding-top:22px; border-top:1px solid var(--border); }
    .pl-perkshead { font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.05em;
      color:var(--text-muted); margin:0 0 12px; }
    .pl-perks ul { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:10px; }
    .pl-perks li { display:flex; gap:10px; align-items:flex-start; font-size:13.5px; line-height:1.55;
      color:var(--text-secondary); }
    .pl-perks strong { color:var(--text); font-weight:700; }
    .pl-tick { flex-shrink:0; display:inline-flex; align-items:center; justify-content:center;
      width:19px; height:19px; margin-top:1px; border-radius:var(--r-full);
      background:var(--accent-light); color:var(--accent-hover); }

    .pl-foot { display:flex; flex-wrap:wrap; gap:14px; margin-top:22px; padding-top:16px;
      border-top:1px solid var(--border); }
    .pl-footitem { display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:600;
      color:var(--text-muted); }

    @media (max-width:540px) { .pl { padding:24px 14px 72px; } .pl-card { padding:26px 20px 20px; } .pl-title { font-size:21px; } }
  `}</style>;
}
