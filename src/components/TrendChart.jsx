import { useState, useEffect, useRef, useMemo } from 'react';
import { getCreatorEvents } from '@/lib/metrics';

// ── Creator analytics: a single-metric daily trend line ─────────────────────
// One metric at a time (views / checkouts / purchases) so there's never a
// dual-axis scale clash — the three differ by orders of magnitude. Single
// series → brand accent, no legend (the title names it). Inline SVG (no chart
// dep); theme-aware via CSS vars; crosshair + tooltip on hover.

const METRICS = [
  { id: 'views', label: 'Views', types: ['storefront_view', 'skill_view'] },
  { id: 'checkouts', label: 'Checkouts', types: ['checkout_start'] },
  { id: 'purchases', label: 'Purchases', types: ['purchase'] },
];
const RANGES = [
  { id: 7, label: '7d' },
  { id: 30, label: '30d' },
  { id: 90, label: '90d' },
];

// SVG viewBox geometry (responsive via preserveAspectRatio).
const W = 720, H = 260;
const PAD = { top: 16, right: 18, bottom: 26, left: 40 };
const IW = W - PAD.left - PAD.right;
const IH = H - PAD.top - PAD.bottom;

function dayKey(d) { return d.toISOString().slice(0, 10); }

export default function TrendChart({ creatorId }) {
  const [events, setEvents] = useState(null);
  const [err, setErr] = useState('');
  const [metric, setMetric] = useState('views');
  const [days, setDays] = useState(30);
  const [hover, setHover] = useState(null); // index into series
  const svgRef = useRef(null);

  useEffect(() => {
    setEvents(null); setErr('');
    const since = new Date(Date.now() - (days - 1) * 86400000);
    since.setHours(0, 0, 0, 0);
    getCreatorEvents(creatorId, since.toISOString()).then(setEvents).catch(e => setErr(e.message));
  }, [creatorId, days]);

  // Bucket the selected metric into one count per calendar day across the range.
  const series = useMemo(() => {
    const m = METRICS.find(x => x.id === metric);
    const buckets = new Map();
    const start = new Date(); start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));
    for (let i = 0; i < days; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      buckets.set(dayKey(d), { date: d, value: 0 });
    }
    (events ?? []).forEach(e => {
      if (!m.types.includes(e.type)) return;
      const k = e.created_at.slice(0, 10);
      if (buckets.has(k)) buckets.get(k).value += 1;
    });
    return [...buckets.values()];
  }, [events, metric, days]);

  const total = series.reduce((s, p) => s + p.value, 0);
  const yMax = Math.max(1, ...series.map(p => p.value));
  const niceMax = niceCeil(yMax);

  const x = (i) => PAD.left + (series.length <= 1 ? IW / 2 : (i / (series.length - 1)) * IW);
  const y = (v) => PAD.top + IH - (v / niceMax) * IH;

  const linePath = series.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
  const areaPath = series.length
    ? `${linePath} L ${x(series.length - 1).toFixed(1)} ${(PAD.top + IH).toFixed(1)} L ${x(0).toFixed(1)} ${(PAD.top + IH).toFixed(1)} Z`
    : '';

  const gridVals = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(niceMax * f));
  const xTickIdx = tickIndices(series.length, 5);

  function onMove(e) {
    const svg = svgRef.current; if (!svg || !series.length) return;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;      // to viewBox space
    const i = Math.round(((px - PAD.left) / IW) * (series.length - 1));
    setHover(Math.max(0, Math.min(series.length - 1, i)));
  }

  const hp = hover != null ? series[hover] : null;

  return (
    <div className="tc">
      <div className="tc-head">
        <div>
          <p className="tc-title">{METRICS.find(m => m.id === metric).label} over time</p>
          <p className="tc-total">{total.toLocaleString()} <span>in the last {days} days</span></p>
        </div>
        <div className="tc-controls">
          <div className="tc-seg">
            {METRICS.map(m => (
              <button key={m.id} className={`tc-segbtn${metric === m.id ? ' on' : ''}`} onClick={() => { setMetric(m.id); setHover(null); }}>{m.label}</button>
            ))}
          </div>
          <div className="tc-seg tc-seg-range">
            {RANGES.map(r => (
              <button key={r.id} className={`tc-segbtn${days === r.id ? ' on' : ''}`} onClick={() => { setDays(r.id); setHover(null); }}>{r.label}</button>
            ))}
          </div>
        </div>
      </div>

      {err ? (
        <p className="tc-muted">Couldn’t load analytics: {err}</p>
      ) : events === null ? (
        <p className="tc-muted">Loading…</p>
      ) : total === 0 ? (
        <div className="tc-empty">
          <p className="tc-muted">No {METRICS.find(m => m.id === metric).label.toLowerCase()} yet in this window.</p>
          <p className="tc-muted-sm">Share your storefront link to start seeing traffic here.</p>
        </div>
      ) : (
        <div className="tc-plotwrap">
          <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="tc-svg" preserveAspectRatio="none"
            onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img"
            aria-label={`${METRICS.find(m => m.id === metric).label} per day, last ${days} days`}>
            {/* gridlines + y labels (recessive) */}
            {gridVals.map((gv, i) => {
              const gy = y(gv);
              return (
                <g key={i}>
                  <line x1={PAD.left} x2={W - PAD.right} y1={gy} y2={gy} className="tc-grid" />
                  <text x={PAD.left - 8} y={gy + 3} className="tc-ylabel" textAnchor="end">{gv}</text>
                </g>
              );
            })}
            {/* x labels */}
            {xTickIdx.map(i => (
              <text key={i} x={x(i)} y={H - 8} className="tc-xlabel" textAnchor="middle">
                {series[i].date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </text>
            ))}
            {/* area + line */}
            <defs>
              <linearGradient id="tc-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {areaPath && <path d={areaPath} fill="url(#tc-fill)" />}
            <path d={linePath} className="tc-line" fill="none" />
            {/* hover crosshair + point */}
            {hp && (
              <g>
                <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + IH} className="tc-cross" />
                <circle cx={x(hover)} cy={y(hp.value)} r="4.5" className="tc-dot" />
              </g>
            )}
          </svg>

          {hp && (
            <div className="tc-tip" style={{ left: `${(x(hover) / W) * 100}%` }}>
              <span className="tc-tip-v">{hp.value.toLocaleString()}</span>
              <span className="tc-tip-d">{hp.date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
            </div>
          )}
        </div>
      )}

      <style>{`
        .tc { border:1px solid var(--border); border-radius:var(--r-lg); background:var(--surface); padding:18px 18px 12px; box-shadow:var(--shadow-sm); }
        .tc-head { display:flex; align-items:flex-start; justify-content:space-between; gap:14px; flex-wrap:wrap; margin-bottom:14px; }
        .tc-title { font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:var(--text-muted); margin:0; }
        .tc-total { font-size:26px; font-weight:800; color:var(--text); margin:3px 0 0; }
        .tc-total span { font-size:13px; font-weight:600; color:var(--text-muted); }
        .tc-controls { display:flex; gap:8px; flex-wrap:wrap; }
        .tc-seg { display:inline-flex; background:var(--surface-alt); border:1px solid var(--border); border-radius:var(--r-full); padding:2px; }
        .tc-segbtn { min-width:0; width:auto; border:none; background:none; border-radius:var(--r-full); padding:5px 12px; font-size:12.5px; font-weight:700; color:var(--text-muted); cursor:pointer; }
        .tc-segbtn.on { background:var(--surface); color:var(--text); box-shadow:var(--shadow-sm); }
        .tc-muted { color:var(--text-muted); font-size:14px; }
        .tc-muted-sm { color:var(--text-muted); font-size:12.5px; margin-top:4px; }
        .tc-empty { padding:40px 0; text-align:center; }
        .tc-plotwrap { position:relative; }
        .tc-svg { width:100%; height:auto; display:block; overflow:visible; }
        .tc-grid { stroke:var(--border); stroke-width:1; }
        .tc-ylabel, .tc-xlabel { fill:var(--text-muted); font-size:11px; font-weight:600; }
        .tc-line { stroke:var(--accent); stroke-width:2.5; stroke-linejoin:round; stroke-linecap:round; }
        .tc-cross { stroke:var(--accent); stroke-width:1; stroke-dasharray:3 3; opacity:.55; }
        .tc-dot { fill:var(--accent); stroke:var(--surface); stroke-width:2.5; }
        .tc-tip { position:absolute; top:-4px; transform:translateX(-50%); background:var(--text); color:var(--surface); border-radius:8px; padding:5px 9px; font-size:12px; white-space:nowrap; pointer-events:none; box-shadow:var(--shadow); display:flex; flex-direction:column; line-height:1.25; }
        .tc-tip-v { font-weight:800; }
        .tc-tip-d { opacity:.8; font-size:10.5px; }
      `}</style>
    </div>
  );
}

// Round a max up to a clean tick value so the axis reads nicely.
function niceCeil(n) {
  if (n <= 5) return 5;
  const pow = Math.pow(10, Math.floor(Math.log10(n)));
  const f = n / pow;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nice * pow;
}
// Evenly-spaced x-tick indices, at most `count`.
function tickIndices(n, count) {
  if (n <= count) return Array.from({ length: n }, (_, i) => i);
  const step = (n - 1) / (count - 1);
  return Array.from({ length: count }, (_, i) => Math.round(i * step));
}
