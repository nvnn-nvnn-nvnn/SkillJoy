// Guard against the trap that has broken this build four times.
//
//   node scripts/check-style-backticks.cjs
//
// .cjs, not .js: package.json sets "type": "module", so a .js here would be
// parsed as ESM and require() would not exist.
//
// Components in this codebase carry their CSS as:
//
//     <style>{`  .foo { … }  `}</style>
//
// A backtick anywhere inside that block TERMINATES the template literal early.
// Everything after it is then parsed as JavaScript, and the file explodes with
// an error pointing at a line that looks fine. It has happened four times in
// one session — always in a CSS *comment*, where writing `property-name` in
// prose is a completely natural thing to do.
//
// A rule you have to remember while writing is a rule you will break. This is
// the check instead.
//
// Exits 1 on a finding so it can go in CI or a pre-commit hook.

const fs = require('fs');
const path = require('path');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      walk(p, out);
    } else if (/\.jsx?$/.test(entry.name)) {
      out.push(p);
    }
  }
  return out;
}

const BACKTICK = String.fromCharCode(96);
const OPEN = '<style>{' + BACKTICK;

let findings = 0;

for (const file of walk('src')) {
  const src = fs.readFileSync(file, 'utf8');
  let from = 0;

  while (true) {
    const start = src.indexOf(OPEN, from);
    if (start === -1) break;

    const bodyStart = start + OPEN.length;
    // Where the literal ACTUALLY ends (first unescaped backtick)...
    let end = bodyStart;
    while (end < src.length) {
      if (src[end] === BACKTICK && src[end - 1] !== '\\') break;
      end++;
    }
    // ...versus where the author clearly intended it to end.
    const intended = src.indexOf(BACKTICK + '}</style>', bodyStart);

    if (intended !== -1 && end < intended) {
      const line = src.slice(0, end).split('\n').length;
      const context = src.slice(Math.max(bodyStart, end - 60), end + 20)
        .replace(/\n/g, ' ')
        .trim();
      console.error(
        `${file}:${line}  stray backtick closes the <style> literal early\n` +
        `    …${context}…`
      );
      findings++;
    }

    from = intended !== -1 ? intended + 1 : bodyStart;
  }
}

if (findings) {
  console.error(
    `\n${findings} stray backtick(s) inside <style> blocks.\n` +
    'Use straight quotes in CSS comments — "margin", not a backticked one.'
  );
  process.exit(1);
}
console.log('OK — no stray backticks in <style> template literals.');
