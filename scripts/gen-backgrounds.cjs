// Generates the shipped template backgrounds into public/templates/.
//
// SVG rather than JPG/PNG, deliberately:
//   · a few KB each instead of a few hundred — these load on every page view
//   · resolution-independent, so they are sharp on a 5K monitor and on a phone
//   · editable in a text editor, so you can recolour one without a design tool
//   · no binary blobs in git history
//
// They are authored at 1600x1000 and rendered with background-size:cover, so
// the aspect ratio only decides how much gets cropped, never the sharpness.
//
// Run:  node scripts/gen-backgrounds.cjs

const fs = require('node:fs');
const path = require('node:path');

const OUT = path.join(__dirname, '..', 'public', 'templates');
const W = 1600, H = 1000;

// A soft colour blob. Stacked at low opacity these read as a mesh gradient —
// the same look design tools produce, at ~1KB.
const blob = (cx, cy, r, color, op = 0.85) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" opacity="${op}" filter="url(#blur)"/>`;

const wrap = (base, inner, extraDefs = '') => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">
<defs>
<filter id="blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="150"/></filter>
${extraDefs}
</defs>
<rect width="${W}" height="${H}" fill="${base}"/>
${inner}
</svg>`;

const BACKGROUNDS = {
  // ── Mesh gradients ───────────────────────────────────────────────────────
  'aurora': wrap('#070B18', [
    blob(300, 200, 420, '#1E3A8A'),
    blob(1250, 300, 460, '#0E7490'),
    blob(800, 850, 500, '#4C1D95'),
    blob(1450, 900, 340, '#0F766E', 0.7),
  ].join('\n')),

  'dusk': wrap('#160A1E', [
    blob(250, 780, 460, '#7C2D6B'),
    blob(1150, 220, 480, '#B4456B'),
    blob(820, 560, 420, '#4C1D95', 0.75),
    blob(1500, 780, 320, '#E8743B', 0.6),
  ].join('\n')),

  'mint': wrap('#F2FBF7', [
    blob(280, 260, 420, '#A7E8CF', 0.9),
    blob(1300, 380, 460, '#BFD9F2', 0.85),
    blob(760, 880, 440, '#D9CFF5', 0.8),
  ].join('\n')),

  'peach': wrap('#FFF6EF', [
    blob(320, 300, 430, '#FFD3B8', 0.95),
    blob(1280, 260, 420, '#FFC2D4', 0.85),
    blob(880, 880, 460, '#FFE8A8', 0.8),
  ].join('\n')),

  'ink': wrap('#0A0A0C', [
    blob(400, 300, 400, '#1F1F26', 0.95),
    blob(1200, 700, 460, '#2A2A33', 0.9),
    blob(900, 150, 320, '#15151A', 0.9),
  ].join('\n')),

  // ── Patterns ─────────────────────────────────────────────────────────────
  'grid': wrap('#080D14', `
<rect width="${W}" height="${H}" fill="url(#g)"/>
<rect width="${W}" height="${H}" fill="url(#fade)"/>`, `
<pattern id="g" width="48" height="48" patternUnits="userSpaceOnUse">
  <path d="M48 0H0V48" fill="none" stroke="#1E3A5F" stroke-width="1"/>
</pattern>
<radialGradient id="fade" cx="50%" cy="35%" r="75%">
  <stop offset="0%" stop-color="#0EA5E9" stop-opacity="0.22"/>
  <stop offset="100%" stop-color="#080D14" stop-opacity="0.92"/>
</radialGradient>`),

  'dots': wrap('#FAF8F4', `
<rect width="${W}" height="${H}" fill="url(#d)"/>
<rect width="${W}" height="${H}" fill="url(#warm)"/>`, `
<pattern id="d" width="30" height="30" patternUnits="userSpaceOnUse">
  <circle cx="15" cy="15" r="2" fill="#D8CFC0"/>
</pattern>
<radialGradient id="warm" cx="50%" cy="30%" r="80%">
  <stop offset="0%" stop-color="#FFE6CC" stop-opacity="0.55"/>
  <stop offset="100%" stop-color="#FAF8F4" stop-opacity="0.15"/>
</radialGradient>`),

  'waves': wrap('#0B1A2B', `
<path d="M0 620 C 300 540, 500 700, 800 620 S 1300 540, 1600 620 L1600 1000 L0 1000Z" fill="#123A5C" opacity="0.85"/>
<path d="M0 720 C 320 650, 520 800, 820 720 S 1320 650, 1600 720 L1600 1000 L0 1000Z" fill="#1B5E85" opacity="0.8"/>
<path d="M0 830 C 340 770, 540 900, 840 830 S 1340 770, 1600 830 L1600 1000 L0 1000Z" fill="#2A8CA8" opacity="0.75"/>
${blob(1200, 200, 380, '#0E7490', 0.5)}`),

  'topo': wrap('#12100E', `
<g fill="none" stroke="#3A3128" stroke-width="1.6" opacity="0.9">
${Array.from({ length: 14 }, (_, i) => {
    const y = 80 + i * 68;
    return `<path d="M-50 ${y} C 250 ${y - 42}, 480 ${y + 46}, 800 ${y} S 1350 ${y - 46}, 1650 ${y}"/>`;
  }).join('\n')}
</g>
${blob(1150, 760, 420, '#5B3A1E', 0.45)}`),

  'stars': wrap('#04060F', `
<g fill="#FFFFFF">
${Array.from({ length: 160 }, (_, i) => {
    // Deterministic scatter — a seeded hash, so regenerating produces the same
    // file and git shows no diff when nothing changed.
    const h = (i * 2654435761) >>> 0;
    const x = h % W;
    const y = ((h >>> 8) % H);
    const r = ((h >>> 16) % 10) / 8 + 0.4;
    const o = (((h >>> 20) % 60) + 25) / 100;
    return `<circle cx="${x}" cy="${y}" r="${r.toFixed(2)}" opacity="${o.toFixed(2)}"/>`;
  }).join('')}
</g>
${blob(1250, 250, 420, '#312E81', 0.6)}
${blob(350, 800, 380, '#4C1D95', 0.5)}`),
};

fs.mkdirSync(OUT, { recursive: true });
let total = 0;
for (const [name, svg] of Object.entries(BACKGROUNDS)) {
  const file = path.join(OUT, `${name}.svg`);
  fs.writeFileSync(file, svg.replace(/\n{2,}/g, '\n').trim() + '\n');
  const kb = (fs.statSync(file).size / 1024).toFixed(1);
  total += fs.statSync(file).size;
  console.log(`  ${name.padEnd(10)} ${kb.padStart(6)} KB`);
}
console.log(`\n${Object.keys(BACKGROUNDS).length} backgrounds, ${(total / 1024).toFixed(1)} KB total`);
