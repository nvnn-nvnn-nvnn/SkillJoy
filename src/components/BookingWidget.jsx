import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  generateSlots, createBooking, cancelBooking, rescheduleBooking,
  downloadBookingIcs, listBlockBookings, localTimezone,
} from '@/lib/booking';
import { getCreatorFreebusy } from '@/lib/google';
import { useDialog } from '@/components/Dialog';

// ── Buyer-side slot picker for a native coaching block (v3, Phase 8) ────────
export default function BookingWidget({ block, skillId, creatorId, buyerId }) {
  const { confirm } = useDialog();
  const [avail, setAvail] = useState(null);   // {availability, tz}
  const [slots, setSlots] = useState([]);
  const [mine, setMine] = useState(null);     // existing future booking for this block
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  // Reschedule reuses the ENTIRE slot picker rather than duplicating it — the
  // only difference between booking and moving is which function the click
  // calls, so this is a mode flag, not a second component.
  const [moving, setMoving] = useState(false);

  const load = useCallback(async () => {
    setErr('');
    try {
      const { data: creator } = await supabase
        .from('profiles').select('booking_availability, booking_timezone').eq('id', creatorId).single();
      const tz = creator?.booking_timezone || localTimezone();
      const [{ data: existing }, booked] = await Promise.all([
        supabase.from('bookings').select('id, start_time, end_time, meeting_url')
          .eq('buyer_id', buyerId).eq('block_id', block.id).eq('status', 'booked')
          .gte('start_time', new Date().toISOString()).order('start_time').limit(1),
        listBlockBookings(skillId, block.id),
      ]);
      setMine(existing?.[0] || null);
      setAvail({ availability: creator?.booking_availability, tz });
      const bookedIntervals = (booked || []).map(b => ({ start: b.start_time, end: b.end_time }));
      let gen = generateSlots(creator?.booking_availability, tz, {
        daysAhead: 14,
        minutes: block.booking_minutes,
        bufferMinutes: block.buffer_minutes || 0,
        minNoticeMinutes: block.min_notice_minutes || 0,
        booked: bookedIntervals,
      });

      // Subtract the creator's real Google Calendar busy times (fail-open — a
      // Google/network hiccup just falls back to native availability).
      try {
        const startISO = new Date().toISOString();
        const endISO = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();
        const { busy } = await getCreatorFreebusy(creatorId, startISO, endISO);
        if (busy?.length) {
          const intervals = busy.map(b => [new Date(b.start).getTime(), new Date(b.end).getTime()]);
          gen = gen.filter(s => {
            const ss = s.start.getTime(), se = s.end.getTime();
            return !intervals.some(([bs, be]) => ss < be && se > bs); // drop overlaps
          });
        }
      } catch { /* ignore — keep native slots */ }

      setSlots(gen);
    } catch (e) { setErr(e.message); }
  }, [block.id, block.booking_minutes, block.buffer_minutes, block.min_notice_minutes, skillId, creatorId, buyerId]);

  useEffect(() => { load(); }, [load]);

  // One click handler for both modes. In `moving` mode the existing row is
  // MOVED rather than cancelled-and-recreated, which is what lets the calendar
  // invite keep its UID and update the event already sitting in both calendars
  // instead of leaving a stale one behind next to a new one.
  async function pickSlot(slot) {
    setBusy(true); setErr('');
    try {
      if (moving && mine) await rescheduleBooking(mine.id, slot.start, slot.end);
      else await createBooking({ skillId, blockId: block.id, start: slot.start, end: slot.end });
      setMoving(false);
      await load();
    } catch (e) { setErr(e.message); await load(); }
    finally { setBusy(false); }
  }

  async function cancel() {
    if (!mine) return;
    if (!(await confirm({
      title: 'Cancel this booking?',
      message: 'Your host is notified and the session is removed from both calendars. If you just need a different time, reschedule instead — it keeps your slot until you pick the new one.',
      confirmLabel: 'Cancel booking', danger: true,
    }))) return;
    setBusy(true);
    try { await cancelBooking(mine.id); setMoving(false); await load(); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  async function addToCalendar() {
    setErr('');
    try { await downloadBookingIcs(mine.id); }
    catch (e) { setErr(e.message); }
  }

  if (avail === null && !err) return <p className="bw-muted">Loading times…</p>;

  // Booked, and NOT currently picking a new time. While `moving` is true we
  // fall through to the slot grid below — the booking is still held, so an
  // abandoned reschedule loses nothing.
  if (mine && !moving) {
    return (
      <div className="bw">
        <div className="bw-booked">
          {/* timeZoneName is the whole point here — this line is what the buyer
              screenshots or writes down, so it has to be unambiguous on its own. */}
          <span>✅ Booked: <b>{new Date(mine.start_time).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}</b></span>
        </div>

        {mine.meeting_url && (
          <a className="bw-join" href={mine.meeting_url} target="_blank" rel="noopener noreferrer">
            🎥 Join the call
          </a>
        )}

        <div className="bw-actions">
          <button className="btn btn-secondary btn-sm" onClick={addToCalendar} disabled={busy}>Add to calendar</button>
          <button className="btn btn-ghost btn-sm" onClick={() => { setErr(''); setMoving(true); }} disabled={busy}>Reschedule</button>
          <button className="btn btn-ghost btn-sm bw-cancel" onClick={cancel} disabled={busy}>Cancel</button>
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
  // Slots are true UTC instants rendered with toLocaleTimeString(), so they are
  // ALREADY in the buyer's zone — the risk isn't a wrong time, it's a buyer who
  // assumes the times are the creator's and books 3am their own time. Naming the
  // zone is what removes the ambiguity, so it can't be left implicit.
  const viewerTz = localTimezone();
  const creatorTz = avail?.tz;

  return (
    <div className="bw">
      {moving && mine && (
        <div className="bw-moving">
          <span>
            Moving your <b>{new Date(mine.start_time).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</b> session — pick a new time.
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => setMoving(false)} disabled={busy}>Keep it</button>
        </div>
      )}
      {days.length > 0 && (
        <p className="bw-tz">
          Times shown in <b>{viewerTz.replace(/_/g, ' ')}</b> (your timezone)
          {creatorTz && creatorTz !== viewerTz && <> · host is in {creatorTz.replace(/_/g, ' ')}</>}
        </p>
      )}
      {days.length === 0 && <p className="bw-muted">No times available right now — check back soon.</p>}
      {days.slice(0, 5).map(([day, daySlots]) => (
        <div key={day} className="bw-day">
          <span className="bw-daylabel">{day}</span>
          <div className="bw-slots">
            {daySlots.map(s => (
              <button key={s.start.toISOString()} className="bw-slot" disabled={busy}
                onClick={() => pickSlot(s)}>
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
    .bw-tz { font-size:12.5px; color:var(--text-muted); margin:0 0 10px; line-height:1.5; }
    .bw-tz b { color:var(--text-secondary); font-weight:700; }
    .bw-err { color:var(--accent); font-size:13px; margin-top:6px; }
    .bw-booked { display:flex; align-items:center; justify-content:space-between; gap:10px; background:var(--green-light); border:1px solid var(--green-mid); border-radius:var(--r); padding:10px 12px; font-size:14px; color:var(--green); }
    .bw-join { display:inline-flex; align-items:center; gap:8px; margin-top:10px; padding:10px 16px; border-radius:var(--r);
               background:var(--accent); color:var(--accent-foreground); font-size:14px; font-weight:700; text-decoration:none; }
    .bw-join:hover { background:var(--accent-hover); }
    .bw-actions { display:flex; flex-wrap:wrap; gap:8px; margin-top:10px; }
    .bw-cancel:hover { color:#CE4A3E; }
    .bw-moving { display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap;
                 background:var(--accent-light); border:1px solid var(--accent-mid); border-radius:var(--r);
                 padding:10px 12px; margin-bottom:12px; font-size:13.5px; color:var(--accent-hover); }
    .bw-day { display:flex; gap:10px; align-items:flex-start; padding:8px 0; border-top:1px solid var(--border); }
    .bw-day:first-child { border-top:none; }
    .bw-daylabel { flex:0 0 110px; font-size:13px; font-weight:700; color:var(--text-secondary); padding-top:6px; }
    .bw-slots { display:flex; flex-wrap:wrap; gap:6px; }
    .bw-slot { border:1px solid var(--border-strong); background:var(--surface); border-radius:var(--r-sm); padding:6px 12px; font-size:13px; font-weight:600; cursor:pointer; }
    .bw-slot:hover:not(:disabled) { border-color:var(--accent); color:var(--accent); }
    .bw-slot:disabled { opacity:.5; }
  `}</style>;
}
