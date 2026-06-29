import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { generateSlots, createBooking, cancelBooking, listBlockBookings, localTimezone } from '@/lib/booking';

// ── Buyer-side slot picker for a native coaching block (v3, Phase 8) ────────
export default function BookingWidget({ block, skillId, creatorId, buyerId }) {
  const [avail, setAvail] = useState(null);   // {availability, tz}
  const [slots, setSlots] = useState([]);
  const [mine, setMine] = useState(null);     // existing future booking for this block
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setErr('');
    try {
      const { data: creator } = await supabase
        .from('profiles').select('booking_availability, booking_timezone').eq('id', creatorId).single();
      const tz = creator?.booking_timezone || localTimezone();
      const [{ data: existing }, booked] = await Promise.all([
        supabase.from('bookings').select('id, start_time')
          .eq('buyer_id', buyerId).eq('block_id', block.id).eq('status', 'booked')
          .gte('start_time', new Date().toISOString()).order('start_time').limit(1),
        listBlockBookings(skillId, block.id),
      ]);
      setMine(existing?.[0] || null);
      setAvail({ availability: creator?.booking_availability, tz });
      const bookedSet = new Set((booked || []).map(b => new Date(b.start_time).toISOString()));
      setSlots(generateSlots(creator?.booking_availability, tz, 14, bookedSet, block.booking_minutes));
    } catch (e) { setErr(e.message); }
  }, [block.id, block.booking_minutes, skillId, creatorId, buyerId]);

  useEffect(() => { load(); }, [load]);

  async function book(slot) {
    setBusy(true); setErr('');
    try {
      await createBooking({ skillId, blockId: block.id, creatorId, buyerId, start: slot.start, end: slot.end });
      await load();
    } catch (e) { setErr(e.message); await load(); }
    finally { setBusy(false); }
  }

  async function cancel() {
    if (!mine || !confirm('Cancel this booking?')) return;
    setBusy(true);
    try { await cancelBooking(mine.id, creatorId, mine.start_time); await load(); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  if (avail === null && !err) return <p className="bw-muted">Loading times…</p>;

  if (mine) {
    return (
      <div className="bw">
        <div className="bw-booked">
          <span>✅ Booked: <b>{new Date(mine.start_time).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</b></span>
          <button className="btn btn-ghost btn-sm" onClick={cancel} disabled={busy}>Cancel</button>
        </div>
        {err && <p className="bw-err">{err}</p>}
        <BWStyles />
      </div>
    );
  }

  // Group upcoming slots by local date.
  const byDay = {};
  for (const s of slots.slice(0, 60)) {
    const k = s.start.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    (byDay[k] ||= []).push(s);
  }
  const days = Object.entries(byDay);

  return (
    <div className="bw">
      {days.length === 0 && <p className="bw-muted">No times available right now — check back soon.</p>}
      {days.slice(0, 5).map(([day, daySlots]) => (
        <div key={day} className="bw-day">
          <span className="bw-daylabel">{day}</span>
          <div className="bw-slots">
            {daySlots.map(s => (
              <button key={s.start.toISOString()} className="bw-slot" disabled={busy}
                onClick={() => book(s)}>
                {s.start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              </button>
            ))}
          </div>
        </div>
      ))}
      {err && <p className="bw-err">{err}</p>}
      <BWStyles />
    </div>
  );
}

function BWStyles() {
  return <style>{`
    .bw { margin-top:4px; }
    .bw-muted { color:var(--text-muted); font-size:14px; }
    .bw-err { color:var(--accent); font-size:13px; margin-top:6px; }
    .bw-booked { display:flex; align-items:center; justify-content:space-between; gap:10px; background:var(--green-light); border:1px solid var(--green-mid); border-radius:var(--r); padding:10px 12px; font-size:14px; color:var(--green); }
    .bw-day { display:flex; gap:10px; align-items:flex-start; padding:8px 0; border-top:1px solid var(--border); }
    .bw-day:first-child { border-top:none; }
    .bw-daylabel { flex:0 0 110px; font-size:13px; font-weight:700; color:var(--text-secondary); padding-top:6px; }
    .bw-slots { display:flex; flex-wrap:wrap; gap:6px; }
    .bw-slot { border:1px solid var(--border-strong); background:var(--surface); border-radius:var(--r-sm); padding:6px 12px; font-size:13px; font-weight:600; cursor:pointer; }
    .bw-slot:hover:not(:disabled) { border-color:var(--accent); color:var(--accent); }
    .bw-slot:disabled { opacity:.5; }
  `}</style>;
}
