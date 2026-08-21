// ── iCalendar (.ics) generation for bookings — RFC 5545 ──────────────────────
//
// An .ics file is the universal "add to calendar" format: Google, Apple, and
// Outlook all import it, and mail clients that recognise a text/calendar
// attachment show an inline RSVP strip instead of a file to download.
//
// Three details do all the real work here, and each one is a silent bug if you
// get it wrong:
//
//   UID       Stable, permanent identity for the event. Reuse the SAME uid when
//             a booking moves and the calendar UPDATES that event. Generate a
//             fresh one and the attendee ends up with two sessions on two days
//             and no idea which is live.
//   SEQUENCE  Revision counter. Clients ignore an update whose SEQUENCE is not
//             HIGHER than what they already hold, so a reschedule that forgets
//             to bump it appears to do nothing.
//   METHOD    REQUEST = "this is happening / it moved", CANCEL = "remove it".
//             CANCEL is what makes a cancelled session actually disappear from
//             the attendee's calendar rather than lingering.

// Timestamps are emitted as UTC (the trailing Z form): 20260821T143000Z.
// Deliberately no VTIMEZONE block — bookings are stored as absolute instants,
// and UTC sidesteps having to ship a timezone database in the file.
function toIcsDate(value) {
    return new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

// RFC 5545 §3.3.11: backslash, semicolon and comma are delimiters inside a
// property value and must be escaped; literal newlines become \n.
function escapeText(value) {
    return String(value ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\r?\n/g, '\\n');
}

// RFC 5545 §3.1: lines must not exceed 75 octets. Longer ones are "folded" —
// split with CRLF + a single leading space, which parsers rejoin. Long
// description text and meeting URLs routinely cross this, and a client that
// enforces the limit will reject the whole file rather than truncate a line.
// Folding on octets (not characters) keeps multi-byte UTF-8 safe.
function foldLine(line) {
    const bytes = Buffer.from(line, 'utf8');
    if (bytes.length <= 75) return line;
    const parts = [];
    let start = 0;
    while (start < bytes.length) {
        // 74 to leave room for the leading space on continuation lines.
        const size = start === 0 ? 75 : 74;
        let end = Math.min(start + size, bytes.length);
        // Never split mid-character: UTF-8 continuation bytes are 10xxxxxx.
        while (end > start && end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
        parts.push((start === 0 ? '' : ' ') + bytes.slice(start, end).toString('utf8'));
        start = end;
    }
    return parts.join('\r\n');
}

/**
 * Build an .ics document for one booking.
 *
 * @param {object}  o
 * @param {string}  o.uid            stable id — pass the SAME value for updates
 * @param {number}  o.sequence       revision; MUST increase on every change
 * @param {string}  o.method         'REQUEST' (new/moved) | 'CANCEL' (dropped)
 * @param {string}  o.title          event summary
 * @param {string}  o.description
 * @param {string}  o.start          ISO instant
 * @param {string}  o.end            ISO instant
 * @param {string}  [o.meetingUrl]   becomes both LOCATION and a clickable URL
 * @param {object}  o.organizer      { name, email }
 * @param {object}  o.attendee       { name, email }
 * @returns {string} CRLF-delimited iCalendar text
 */
function buildBookingIcs({
    uid, sequence = 0, method = 'REQUEST', title, description = '',
    start, end, meetingUrl = '', organizer, attendee,
}) {
    const cancelled = method === 'CANCEL';
    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//SkillJoy//Booking//EN',
        'CALSCALE:GREGORIAN',
        `METHOD:${method}`,
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `SEQUENCE:${sequence}`,
        // DTSTAMP = when this VERSION of the event was produced (always now),
        // as opposed to DTSTART which is when the session happens.
        `DTSTAMP:${toIcsDate(Date.now())}`,
        `DTSTART:${toIcsDate(start)}`,
        `DTEND:${toIcsDate(end)}`,
        `SUMMARY:${escapeText(title)}`,
        `DESCRIPTION:${escapeText(description)}`,
        `STATUS:${cancelled ? 'CANCELLED' : 'CONFIRMED'}`,
    ];

    if (meetingUrl) {
        // LOCATION is what most calendar UIs surface on the event chip; URL is
        // what "join" buttons key off. Setting both covers both behaviours.
        lines.push(`LOCATION:${escapeText(meetingUrl)}`);
        lines.push(`URL:${escapeText(meetingUrl)}`);
    }

    if (organizer?.email) {
        lines.push(`ORGANIZER;CN=${escapeText(organizer.name || 'Host')}:mailto:${organizer.email}`);
    }
    if (attendee?.email) {
        lines.push(
            `ATTENDEE;CN=${escapeText(attendee.name || 'Attendee')};ROLE=REQ-PARTICIPANT;` +
            `PARTSTAT=${cancelled ? 'DECLINED' : 'ACCEPTED'};RSVP=FALSE:mailto:${attendee.email}`
        );
    }

    // A 15-minute popup. Skipped on CANCEL — an alarm on a cancelled event is
    // both pointless and, in some clients, still capable of firing.
    if (!cancelled) {
        lines.push(
            'BEGIN:VALARM', 'ACTION:DISPLAY',
            `DESCRIPTION:${escapeText(`Starting soon: ${title}`)}`,
            'TRIGGER:-PT15M', 'END:VALARM',
        );
    }

    lines.push('END:VEVENT', 'END:VCALENDAR');

    // CRLF is mandatory per spec — LF-only files are rejected by strict parsers
    // (Outlook among them).
    return lines.map(foldLine).join('\r\n') + '\r\n';
}

/** Stable per-booking UID. Derived, so it survives without its own column. */
function bookingUid(bookingId) {
    return `booking-${bookingId}@skilljoy.app`;
}

module.exports = { buildBookingIcs, bookingUid };
