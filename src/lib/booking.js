import { supabase } from './supabase';

// ── Native booking data layer (v3, Phase 8) ─────────────────────────────────
// Creator weekly availability lives on profiles.booking_availability; bookings
// in the bookings table. Slot times are stored as true UTC instants (timestamptz)
// so every viewer sees them in their own local time.

export const DAYS = [
  { key: 'sun', label: 'Sun' }, { key: 'mon', label: 'Mon' }, { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' }, { key: 'thu', label: 'Thu' }, { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
];

export const DEFAULT_AVAILABILITY = {
  slot_minutes: 30,
  weekly: { mon: [{ start: '09:00', end: '17:00' }], tue: [{ start: '09:00', end: '17:00' }],
            wed: [{ start: '09:00', end: '17:00' }], thu: [{ start: '09:00', end: '17:00' }],
            fri: [{ start: '09:00', end: '17:00' }] },
};

export function localTimezone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
}

export async function saveAvailability(userId, availability, timezone) {
  const { error } = await supabase
    .from('profiles')
    .update({ booking_availability: availability, booking_timezone: timezone })
    .eq('id', userId);
  if (error) throw error;
}

// Convert a wall-clock time in `tz` to the true UTC Date (offset round-trip trick).
function zonedWallClockToUtc(tz, y, mZero, d, hh, mm) {
  const utcGuess = new Date(Date.UTC(y, mZero, d, hh, mm));
  const inv = new Date(utcGuess.toLocaleString('en-US', { timeZone: tz }));
  const diff = utcGuess.getTime() - inv.getTime();
  return new Date(utcGuess.getTime() + diff);
}

/**
 * Open slots for the next `daysAhead` days given a creator's availability.
 * @returns array of { start: Date, end: Date } sorted ascending, future-only,
 *          excluding times already in `bookedISO` (a Set of ISO start strings).
 */
export function generateSlots(availability, tz, daysAhead = 14, bookedISO = new Set(), minutesOverride) {
  const av = availability || DEFAULT_AVAILABILITY;
  const minutes = minutesOverride || av.slot_minutes || 30;
  const now = Date.now();
  const out = [];

  // Iterate calendar days starting today (in the creator's tz).
  const nowParts = new Date().toLocaleString('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  const [mm0, dd0, yy0] = nowParts.split(/[/,]/).map(s => parseInt(s, 10));
  const base = Date.UTC(yy0, mm0 - 1, dd0);

  for (let i = 0; i < daysAhead; i++) {
    const cur = new Date(base + i * 86400000);
    const y = cur.getUTCFullYear(), mZero = cur.getUTCMonth(), d = cur.getUTCDate();
    const dayKey = DAYS[cur.getUTCDay()].key;
    const rules = av.weekly?.[dayKey] || [];
    for (const r of rules) {
      const [sh, sm] = r.start.split(':').map(Number);
      const [eh, em] = r.end.split(':').map(Number);
      let t = sh * 60 + sm;
      const end = eh * 60 + em;
      while (t + minutes <= end) {
        const start = zonedWallClockToUtc(tz, y, mZero, d, Math.floor(t / 60), t % 60);
        if (start.getTime() > now && !bookedISO.has(start.toISOString())) {
          out.push({ start, end: new Date(start.getTime() + minutes * 60000) });
        }
        t += minutes;
      }
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

// ── Queries ──────────────────────────────────────────────────────────────────
export async function listBlockBookings(skillId, blockId) {
  const { data, error } = await supabase
    .from('bookings')
    .select('start_time')
    .eq('skill_id', skillId).eq('block_id', blockId).eq('status', 'booked');
  if (error) throw error;
  return data;
}

export async function listMyBookings(buyerId) {
  const { data, error } = await supabase
    .from('bookings')
    .select('id, start_time, end_time, status, skill:skills(title), block:content_blocks(title)')
    .eq('buyer_id', buyerId).eq('status', 'booked')
    .gte('start_time', new Date().toISOString())
    .order('start_time', { ascending: true });
  if (error) throw error;
  return data;
}

export async function listCreatorBookings(creatorId) {
  const { data, error } = await supabase
    .from('bookings')
    .select('id, start_time, end_time, status, buyer:profiles!bookings_buyer_id_fkey(full_name), skill:skills(title)')
    .eq('creator_id', creatorId).eq('status', 'booked')
    .gte('start_time', new Date().toISOString())
    .order('start_time', { ascending: true });
  if (error) throw error;
  return data;
}

export async function createBooking({ skillId, blockId, creatorId, buyerId, start, end }) {
  const { data, error } = await supabase
    .from('bookings')
    .insert({ skill_id: skillId, block_id: blockId, creator_id: creatorId, buyer_id: buyerId,
              start_time: start.toISOString(), end_time: end.toISOString() })
    .select().single();
  if (error) {
    // Unique-index violation = slot taken between fetch and book.
    if (/duplicate|unique/i.test(error.message)) throw new Error('That slot was just taken — pick another.');
    throw error;
  }
  // Best-effort notify the creator (client notification inserts are allowed by RLS).
  supabase.from('notifications').insert({
    user_id: creatorId, type: 'booking_confirmed', title: 'New booking 📅',
    message: `Someone booked a session for ${start.toLocaleString()}.`,
    related_id: skillId, related_type: null,
  }).then(() => {});
  return data;
}

export async function cancelBooking(id, otherPartyId, whenISO) {
  const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id);
  if (error) throw error;
  if (otherPartyId) {
    supabase.from('notifications').insert({
      user_id: otherPartyId, type: 'booking_cancelled', title: 'Booking cancelled',
      message: `A session${whenISO ? ` on ${new Date(whenISO).toLocaleString()}` : ''} was cancelled.`,
      related_type: null,
    }).then(() => {});
  }
}
