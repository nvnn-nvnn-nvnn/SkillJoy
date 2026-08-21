// ── Server-side slot validation ─────────────────────────────────────────────
//
// The browser's generateSlots() (src/lib/booking.js) PRODUCES the list of times
// a buyer may click. This VALIDATES one time that came back. They are separate
// jobs, and the distinction matters: the browser's list is a convenience, and
// anything a browser sends can be edited. Without a check here, a hand-rolled
// POST could book 3am on a day the host marked unavailable.
//
// One deliberate divergence from the client: there is NO fallback to a default
// Mon–Fri 9–5. On the client that fallback is a nicety; on the write path it
// would mean "host never configured availability" silently equals "host is free
// 9–5", which is precisely the trap the publish gate exists to close.

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const toMinutes = (hhmm) => {
    const [h, m] = String(hhmm).split(':').map(Number);
    return h * 60 + m;
};

/**
 * Wall-clock weekday + minute-of-day for an instant, as seen in `tz`.
 * Intl does the timezone and DST maths; hand-rolled offset arithmetic is where
 * scheduling code traditionally goes wrong (it works all year, then breaks on
 * the last Sunday in March).
 */
function zonedDayAndMinutes(date, tz) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(date).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
    let hour = parseInt(parts.hour, 10);
    if (hour === 24) hour = 0; // some ICU builds render midnight as 24 under hour12:false
    return {
        dayKey: String(parts.weekday || '').slice(0, 3).toLowerCase(),
        minutes: hour * 60 + parseInt(parts.minute, 10),
    };
}

/**
 * @returns {string|null} an error message for the buyer, or null if bookable.
 */
function slotProblem({ availability, tz, start, end, minNoticeMinutes = 0, now = Date.now() }) {
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 'Invalid time.';
    if (endDate <= startDate) return 'Invalid time range.';
    if (startDate.getTime() < now) return 'That time is in the past.';
    if (startDate.getTime() < now + minNoticeMinutes * 60000) {
        return 'That time is too soon — the host requires more notice.';
    }
    if (!availability?.weekly) return 'This host hasn’t published their availability yet.';

    const { dayKey, minutes } = zonedDayAndMinutes(startDate, tz);
    const durationMinutes = Math.round((endDate - startDate) / 60000);
    // Comparing start+duration against the window (rather than converting the
    // END instant separately) means a session running past midnight simply
    // fails to fit, instead of wrapping to minute 0 of the next day and looking
    // perfectly valid.
    const finish = minutes + durationMinutes;
    const windows = availability.weekly[dayKey] || [];
    const fits = windows.some(w => minutes >= toMinutes(w.start) && finish <= toMinutes(w.end));
    return fits ? null : 'That time is outside the host’s available hours.';
}

module.exports = { slotProblem, zonedDayAndMinutes, DAY_KEYS, toMinutes };
