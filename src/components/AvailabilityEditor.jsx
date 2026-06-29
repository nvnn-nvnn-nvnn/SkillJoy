import { useState } from 'react';
import { useUser, useProfile, useAuth } from '@/lib/stores';
import { DAYS, DEFAULT_AVAILABILITY, localTimezone, saveAvailability } from '@/lib/booking';

// ── Creator weekly availability editor (v3, Phase 8) ────────────────────────
// One time-window per weekday (MVP) + slot length. Powers native coaching
// booking. Times are wall-clock in the creator's timezone.
export default function AvailabilityEditor() {
  const user = useUser();
  const profile = useProfile();
  const { setProfile } = useAuth();
  const [av, setAv] = useState(() => profile?.booking_availability || DEFAULT_AVAILABILITY);
  const tz = profile?.booking_timezone || localTimezone();
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState('');

  function dayWindow(key) { return av.weekly?.[key]?.[0]; }
  function toggleDay(key) {
    setAv(prev => {
      const weekly = { ...prev.weekly };
      if (weekly[key]) delete weekly[key];
      else weekly[key] = [{ start: '09:00', end: '17:00' }];
      return { ...prev, weekly };
    });
  }
  function setTime(key, field, value) {
    setAv(prev => ({ ...prev, weekly: { ...prev.weekly, [key]: [{ ...prev.weekly[key][0], [field]: value }] } }));
  }
  function setMinutes(m) { setAv(prev => ({ ...prev, slot_minutes: m })); }

  async function save() {
    setErr('');
    try {
      await saveAvailability(user.id, av, tz);
      if (profile) setProfile({ ...profile, booking_availability: av, booking_timezone: tz });
      setSaved(true); setTimeout(() => setSaved(false), 1500);
    } catch (e) { setErr(e.message); }
  }

  return (
    <div className="av">
      <div className="av-head">
        <h2 className="av-h">Booking availability</h2>
        <button className="btn btn-primary btn-sm" onClick={save}>{saved ? 'Saved ✓' : 'Save'}</button>
      </div>
      <p className="av-sub">Weekly hours for native coaching bookings · times in {tz}</p>

      <div className="av-slot">
        <span>Session length</span>
        <select value={av.slot_minutes || 30} onChange={e => setMinutes(Number(e.target.value))}>
          {[15, 30, 45, 60, 90].map(m => <option key={m} value={m}>{m} min</option>)}
        </select>
      </div>

      <div className="av-days">
        {DAYS.map(d => {
          const w = dayWindow(d.key);
          return (
            <div key={d.key} className={`av-day${w ? ' on' : ''}`}>
              <label className="av-daytoggle">
                <input type="checkbox" checked={!!w} onChange={() => toggleDay(d.key)} />
                <span>{d.label}</span>
              </label>
              {w ? (
                <div className="av-times">
                  <input type="time" value={w.start} onChange={e => setTime(d.key, 'start', e.target.value)} />
                  <span>–</span>
                  <input type="time" value={w.end} onChange={e => setTime(d.key, 'end', e.target.value)} />
                </div>
              ) : <span className="av-off">Unavailable</span>}
            </div>
          );
        })}
      </div>
      {err && <p className="av-err">{err}</p>}

      <style>{`
        .av { border:1px solid var(--border); border-radius:var(--r-lg); background:var(--surface); padding:18px; }
        .av-head { display:flex; justify-content:space-between; align-items:center; }
        .av-h { font-size:18px; font-weight:700; }
        .av-sub { color:var(--text-muted); font-size:13px; margin:2px 0 14px; }
        .av-slot { display:flex; align-items:center; gap:10px; margin-bottom:14px; font-size:14px; font-weight:600; }
        .av-days { display:flex; flex-direction:column; gap:8px; }
        .av-day { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:8px 10px; border:1px solid var(--border); border-radius:var(--r); }
        .av-day.on { border-color:var(--accent-mid); background:var(--accent-light); }
        .av-daytoggle { display:flex; align-items:center; gap:8px; font-weight:600; cursor:pointer; }
        .av-times { display:flex; align-items:center; gap:6px; }
        .av-times input { padding:5px 8px; }
        .av-off { color:var(--text-muted); font-size:13px; }
        .av-err { color:var(--accent); font-size:13px; margin-top:10px; }
      `}</style>
    </div>
  );
}
