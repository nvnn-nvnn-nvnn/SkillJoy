import { useState, useEffect, useRef } from 'react';
import { useUser, useProfile, useAuth } from '@/lib/stores';
import { DAYS, DEFAULT_AVAILABILITY, localTimezone, saveAvailability } from '@/lib/booking';
import GoogleCalendarConnect from '@/components/GoogleCalendarConnect';

// All IANA timezones where supported (modern browsers), else fall back to the
// creator's current zone only.
const ZONES = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];

// ── Creator weekly availability editor (v3, Phase 8) ────────────────────────
// One time-window per weekday (MVP) + slot length. Powers native coaching
// booking. Times are wall-clock in the creator's timezone.
export default function AvailabilityEditor() {
  const user = useUser();
  const profile = useProfile();
  const { setProfile } = useAuth();
  const [av, setAv] = useState(() => profile?.booking_availability || DEFAULT_AVAILABILITY);
  const [tz, setTz] = useState(profile?.booking_timezone || localTimezone());
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState('');

  // Hydrate from the profile ONCE it arrives (it may be null on first render).
  // Without this, a slow/late profile load leaves the editor on defaults and a
  // Save would overwrite the creator's real availability. Runs once, so it never
  // clobbers in-progress edits.
  const hydrated = useRef(false);
  useEffect(() => {
    if (profile && !hydrated.current) {
      hydrated.current = true;
      /* eslint-disable react-hooks/set-state-in-effect -- one-time hydration from an async prop */
      if (profile.booking_availability) setAv(profile.booking_availability);
      if (profile.booking_timezone) setTz(profile.booking_timezone);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [profile]);

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

      <div style={{ margin: '4px 0 16px' }}><GoogleCalendarConnect /></div>

      <label className="av-tz">
        <span className="av-tz-label">Timezone</span>
        <select value={tz} onChange={e => setTz(e.target.value)}>
          {(ZONES.length ? ZONES : [tz]).map(z => <option key={z} value={z}>{z}</option>)}
        </select>
        <span className="av-tz-hint">All your booking times are shown in this zone.</span>
      </label>
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
        .av-tz { display:flex; flex-direction:column; gap:5px; margin-bottom:16px; }
        .av-tz-label { font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.03em; color:var(--text-muted); }
        .av-tz select { padding:8px 10px; border:1.5px solid var(--border-strong); border-radius:var(--r-sm); background:var(--surface); font-size:14px; font-weight:600; color:var(--text); font-family:inherit; cursor:pointer; max-width:320px; }
        .av-tz select:focus { outline:none; border-color:var(--accent); }
        .av-tz-hint { font-size:12px; color:var(--text-muted); }
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
