// Regression tests for the .ics encoder.  Run: node backend/lib/ics.test.js
//
// No test framework in this project, so this is a plain script that exits
// non-zero on failure — runnable by hand or from CI as-is.
//
// These invariants are worth pinning precisely BECAUSE every one of them fails
// silently in production: a file that folds a line one byte too long, or splits
// a UTF-8 character, is not "slightly wrong" — strict parsers (Outlook) reject
// the whole calendar, and the user just sees no invite. Nothing logs an error.
const { buildBookingIcs } = require('./ics');

// Unfold per RFC 5545: CRLF followed by a single space/tab is a continuation.
const unfold = (s) => s.replace(/\r\n[ \t]/g, '');
const getProp = (ics, name) => {
  const line = unfold(ics).split('\r\n').find(l => l.startsWith(name + ':'));
  // Explicit, because the common cause is line endings — if the file used bare
  // LF, splitting on CRLF yields one giant line and every lookup misses. A raw
  // "cannot read properties of undefined" sends you hunting in the wrong place.
  if (line === undefined) {
    throw new Error(
      `property ${name} not found — ${/[^\r]\n/.test(ics) ? 'file contains bare LF (must be CRLF)' : 'property genuinely absent'}`
    );
  }
  return line.slice(name.length + 1);
};

let fails = 0;
const check = (name, cond, extra = '') => {
  if (!cond) fails++;
  console.log((cond ? 'PASS' : 'FAIL').padEnd(5) + '| ' + name + (extra ? '  ' + extra : ''));
};

const base = {
  uid: 'u@x', sequence: 0, method: 'REQUEST',
  start: '2026-08-27T14:00:00Z', end: '2026-08-27T15:00:00Z',
  organizer: { name: 'O', email: 'o@x.com' },
  attendee: { name: 'A', email: 'a@x.com' },
};

// ── Structural checks first ─────────────────────────────────────────────────
// Line endings are checked BEFORE any property lookup, because every lookup
// splits on CRLF: if the file used bare LF, everything downstream fails with a
// confusing error that points at the test rather than at the encoder.
{
  const probe = buildBookingIcs({ ...base, title: 'probe' });
  check('CRLF between properties (no bare LF)', !/[^\r]\n/.test(probe));
  check('ends with CRLF', probe.endsWith('\r\n'));
  check('wrapped in VCALENDAR/VEVENT', probe.startsWith('BEGIN:VCALENDAR\r\n') && probe.includes('BEGIN:VEVENT\r\n') && probe.trimEnd().endsWith('END:VCALENDAR'));
}

// Walk a multi-byte char across EVERY offset spanning the fold boundary.
// If folding split a character, the recovered string would not equal the input.
for (const [label, ch] of [['2-byte é', 'é'], ['3-byte →', '→'], ['4-byte 🎯', '🎯']]) {
  let broke = null;
  for (let pad = 55; pad <= 100; pad++) {
    const title = 'A'.repeat(pad) + ch + 'TAIL';
    const ics = buildBookingIcs({ ...base, title });
    const over = ics.split('\r\n').filter(l => Buffer.from(l, 'utf8').length > 75);
    const recovered = getProp(ics, 'SUMMARY');
    if (over.length || recovered !== title) {
      broke = { pad, linesOver: over.length, ok: recovered === title };
      break;
    }
  }
  check(label + ' intact at every fold offset 55..100', broke === null, broke ? JSON.stringify(broke) : '');
}

// Everything hostile at once.
const nasty = 'Coaching; part 2, "deep" work — café → 🎯 ' + 'x'.repeat(120);
const ics = buildBookingIcs({
  ...base,
  title: nasty,
  description: 'line one\nline two; with, commas',
});

const sum = getProp(ics, 'SUMMARY');
// Reverse the RFC 5545 escaping: \n -> newline, \X -> X for ; , \
const unescaped = sum.replace(/\\n/g, '\n').replace(/\\([;,\\])/g, '$1');
check('hostile SUMMARY round-trips byte-exact', unescaped === nasty);

const desc = getProp(ics, 'DESCRIPTION');
check('DESCRIPTION newline encoded as literal backslash-n', desc.includes('\\n') && !desc.includes('\n'));
check('semicolon and comma escaped in SUMMARY', sum.includes('\\;') && sum.includes('\\,'));
check('every line <= 75 octets', ics.split('\r\n').every(l => Buffer.from(l, 'utf8').length <= 75));
check('no bare LF (CRLF only)', !/[^\r]\n/.test(ics));

// SEQUENCE / UID behaviour across a reschedule — the pairing that decides
// whether a calendar updates the event or duplicates it.
const booked = buildBookingIcs({ ...base, uid: 'booking-abc@skilljoy.app', sequence: 0, title: 'S' });
const moved = buildBookingIcs({ ...base, uid: 'booking-abc@skilljoy.app', sequence: 1, title: 'S', start: '2026-08-28T14:00:00Z', end: '2026-08-28T15:00:00Z' });
const killed = buildBookingIcs({ ...base, uid: 'booking-abc@skilljoy.app', sequence: 2, method: 'CANCEL', title: 'S' });

check('UID identical across book/move/cancel',
  getProp(booked, 'UID') === getProp(moved, 'UID') && getProp(moved, 'UID') === getProp(killed, 'UID'));
check('SEQUENCE strictly increases 0 -> 1 -> 2',
  Number(getProp(booked, 'SEQUENCE')) === 0 && Number(getProp(moved, 'SEQUENCE')) === 1 && Number(getProp(killed, 'SEQUENCE')) === 2);
check('DTSTART actually moved on reschedule', getProp(booked, 'DTSTART') !== getProp(moved, 'DTSTART'));
check('CANCEL sets METHOD:CANCEL + STATUS:CANCELLED',
  killed.includes('METHOD:CANCEL') && getProp(killed, 'STATUS') === 'CANCELLED');
check('CANCEL carries no VALARM', !killed.includes('BEGIN:VALARM'));
check('REQUEST carries a VALARM', booked.includes('BEGIN:VALARM'));

console.log(fails ? '\n' + fails + ' FAILURE(S)' : '\nall ics encoding + sequencing checks pass');
process.exit(fails ? 1 : 0);
