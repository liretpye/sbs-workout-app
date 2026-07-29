import React, { useMemo, useRef, useState } from 'react';
import { planForLift, detectCurrentWeek } from '../lib/program.js';

// Chart palette — validated (dataviz six checks) against surface #191f26.
const C = { series: '#3987e5', grid: 'rgba(145,160,173,0.16)', axis: '#91a0ad' };

const epley = (w, r) => w * (1 + r / 30);

export default function Progress({ data }) {
  const { settings, lifts, programDays, logs, cycles = [] } = data;
  const variant = settings.days_per_week;
  const activeCycle = settings.cycle ?? 1;
  const [selCycle, setSelCycle] = useState(activeCycle);
  const isPast = selCycle !== activeCycle;
  const pastMeta = cycles.find((c) => c.cycle === selCycle);

  // lifts with the selected cycle's starting maxes (current cycle = lifts.max as-is)
  const cycleLifts = useMemo(
    () =>
      isPast && pastMeta
        ? lifts.map((l) => ({ ...l, max: Number(pastMeta.maxes?.[l.id] ?? l.max) }))
        : lifts,
    [lifts, isPast, pastMeta]
  );

  const currentWeek = useMemo(() => {
    if (!isPast) return detectCurrentWeek({ logs, variant, programDays, settings });
    const wks = logs
      .filter((l) => (l.cycle ?? 1) === selCycle && l.variant === variant && l.sets_completed !== null)
      .map((l) => l.week);
    return wks.length ? Math.max(...wks) : 1;
  }, [logs, variant, programDays, settings, isPast, selCycle]);

  const u = settings.units;
  const [view, setView] = useState('est'); // 'est' | 'rec'

  const seriesByLift = useMemo(() => {
    const out = {};
    for (const lift of cycleLifts) {
      const plan = planForLift(lift, logs, variant, settings, selCycle);
      out[lift.id] = plan.slice(0, currentWeek).map((e) => {
        const logged = e.log.setsCompleted !== null && e.log.setsCompleted !== undefined;
        return {
          week: e.week, tm: e.tm, weight: e.weight, reps: e.repsPerSet, setGoal: e.setGoal,
          logged, sets: e.log.setsCompleted ?? null,
          rm: logged && e.log.setsCompleted > 0 ? epley(e.weight, e.repsPerSet) : null,
        };
      });
    }
    return out;
  }, [cycleLifts, logs, variant, settings, currentWeek, selCycle]);

  const mains = useMemo(
    () => cycleLifts.filter((l) => (l.role || '').includes('main') || (l.role || '').includes('Primary')),
    [cycleLifts]
  );

  const weekly = useMemo(() => {
    const pds = programDays.filter((p) => p.variant === variant);
    const clifts = cycleLifts;
    const daysInVariant = new Set(pds.map((p) => p.day)).size;
    const rows = [];
    for (let w = 1; w <= currentWeek; w++) {
      let tonnage = 0;
      const daysLogged = new Set();
      for (const lift of clifts) {
        const e = seriesByLift[lift.id][w - 1];
        if (e && e.logged && e.sets) {
          tonnage += e.sets * e.reps * e.weight;
          const pd = pds.find((p) => p.lift_id === lift.id);
          if (pd) daysLogged.add(pd.day);
        }
      }
      rows.push({ week: w, tonnage: Math.round(tonnage), sessions: daysLogged.size, daysInVariant });
    }
    return rows;
  }, [cycleLifts, seriesByLift, programDays, variant, currentWeek]);

  const [selLift, setSelLift] = useState(mains[0]?.id ?? lifts[0]?.id);
  const sel = seriesByLift[selLift] || [];

  return (
    <div className="page">
      <h2 className="progress-title">
        Progress · {isPast ? `cycle ${selCycle}` : `cycle ${activeCycle}`} · through week {currentWeek}
      </h2>

      {(cycles.length > 0) && (
        <div className="lift-chips cycle-chips">
          {[...cycles.map((c) => c.cycle), activeCycle].map((c) => (
            <button key={c} className={`chip pick wide ${c === selCycle ? 'on' : ''}`}
              onClick={() => setSelCycle(c)}>
              Cycle {c}{c === activeCycle ? ' · active' : ''}
            </button>
          ))}
        </div>
      )}

      <div className="seg-control">
        <button className={view === 'est' ? 'active' : ''} onClick={() => setView('est')}>
          Estimated
        </button>
        <button className={view === 'rec' ? 'active' : ''} onClick={() => setView('rec')}>
          Recorded
        </button>
      </div>
      <p className="muted view-sub">
        {view === 'est'
          ? "The program's running estimate of your 1RM (SBS training max)."
          : 'Only what you actually logged: best sets, rep-max equivalents, tonnage.'}
      </p>

      <div className="tile-grid">
        {mains.map((l) => (
          <StatTile key={l.id} lift={l} series={seriesByLift[l.id]} units={u} view={view} />
        ))}
      </div>

      <div className="card chart-card">
        <h3>{view === 'est' ? 'Estimated 1RM by week' : 'Recorded rep max by week'}</h3>
        {view === 'rec' && (
          <p className="muted chart-sub">Epley estimate from each week's logged work sets</p>
        )}
        <div className="lift-chips">
          {cycleLifts.map((l) => (
            <button key={l.id} className={`chip pick wide ${l.id === selLift ? 'on' : ''}`}
              onClick={() => setSelLift(l.id)}>
              {l.name}
            </button>
          ))}
        </div>
        <LineChart
          points={
            view === 'est'
              ? sel.map((s) => ({ week: s.week, value: s.tm, marker: s.logged }))
              : sel.filter((s) => s.rm !== null).map((s) => ({ week: s.week, value: s.rm, marker: true }))
          }
          domainWeeks={currentWeek}
          tip={(pt) => {
            const s = sel[pt.week - 1];
            return view === 'est'
              ? `est. 1RM ${fmt(s.tm)} ${u} · work ${fmt(s.weight)} ${u}${s.logged ? ` · ${s.sets}×${s.reps} done` : ' · not logged'}`
              : `${s.sets}×${s.reps} @ ${fmt(s.weight)} ${u} → RM ≈ ${fmt(s.rm)} ${u}`;
          }}
        />
      </div>

      {view === 'rec' && (
        <div className="card chart-card">
          <h3>Weekly volume</h3>
          <p className="muted chart-sub">Logged main-lift tonnage (sets × reps × weight)</p>
          <VolumeChart rows={weekly} units={u} />
        </div>
      )}
    </div>
  );
}

/* ---------- stat tile ---------- */

function StatTile({ lift, series, units, view }) {
  if (!series || !series.length) return null;

  if (view === 'est') {
    const first = series[0].tm;
    const cur = series[series.length - 1].tm;
    const d = cur - first;
    const pct = first ? (d / first) * 100 : 0;
    return (
      <div className="card stat-tile">
        <div className="st-label">{lift.name}</div>
        <div className="st-value">{fmt(cur)}<span className="st-unit">{units} est. 1RM</span></div>
        <div className={`st-delta ${d > 0 ? 'up' : d < 0 ? 'down' : 'even'}`}>
          {d >= 0 ? '+' : ''}{fmt(d)} ({pct >= 0 ? '+' : ''}{pct.toFixed(1)}%)
        </div>
        <Sparkline values={series.map((s) => s.tm)} />
      </div>
    );
  }

  // recorded view: best performed set → rep max
  const rec = series.filter((s) => s.rm !== null);
  if (!rec.length) {
    return (
      <div className="card stat-tile">
        <div className="st-label">{lift.name}</div>
        <div className="st-value muted">—</div>
        <div className="st-best">no sets logged yet</div>
      </div>
    );
  }
  let best = rec[0];
  for (const s of rec) if (s.rm > best.rm) best = s;
  const d = rec[rec.length - 1].rm - rec[0].rm;
  const pct = rec[0].rm ? (d / rec[0].rm) * 100 : 0;
  return (
    <div className="card stat-tile">
      <div className="st-label">{lift.name}</div>
      <div className="st-value">{fmt(best.rm)}<span className="st-unit">{units} best RM</span></div>
      <div className={`st-delta ${d > 0 ? 'up' : d < 0 ? 'down' : 'even'}`}>
        {d >= 0 ? '+' : ''}{fmt(d)} ({pct >= 0 ? '+' : ''}{pct.toFixed(1)}%) first→last
      </div>
      <div className="st-best">{fmt(best.weight)}×{best.reps} in week {best.week}</div>
      <Sparkline values={rec.map((s) => s.rm)} />
    </div>
  );
}

function Sparkline({ values }) {
  if (!values.length) return null;
  const w = 120, h = 30, p = 3;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = p + (i / Math.max(1, values.length - 1)) * (w - 2 * p);
    const y = h - p - ((v - min) / span) * (h - 2 * p);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg className="sparkline" viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <polyline points={pts.join(' ')} fill="none" stroke={C.series} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ---------- line chart ---------- */

function LineChart({ points, domainWeeks, tip }) {
  const W = 360, H = 190, ML = 40, MR = 12, MT = 12, MB = 24;
  const [hover, setHover] = useState(null);
  const svgRef = useRef(null);
  if (!points.length) return <p className="muted">Nothing logged yet for this lift.</p>;

  const vals = points.map((p) => p.value);
  let min = Math.min(...vals), max = Math.max(...vals);
  const pad = (max - min || max * 0.05 || 1) * 0.15;
  min = Math.max(0, min - pad); max = max + pad;

  const x = (w) => ML + ((w - 1) / Math.max(1, domainWeeks - 1)) * (W - ML - MR);
  const y = (v) => MT + (1 - (v - min) / (max - min)) * (H - MT - MB);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.week).toFixed(1)},${y(p.value).toFixed(1)}`).join('');

  const yTicks = niceTicks(min, max, 4);
  const xEvery = domainWeeks > 12 ? 4 : domainWeeks > 6 ? 2 : 1;

  function locate(clientX) {
    const rect = svgRef.current.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * W;
    let best = 0, bd = Infinity;
    points.forEach((p, i) => { const d = Math.abs(x(p.week) - px); if (d < bd) { bd = d; best = i; } });
    setHover(best);
  }

  const h = hover !== null ? points[hover] : null;

  return (
    <div className="chart-wrap">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="chart"
        onPointerMove={(e) => locate(e.clientX)} onPointerLeave={() => setHover(null)}
        onPointerDown={(e) => locate(e.clientX)}>
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={ML} x2={W - MR} y1={y(t)} y2={y(t)} stroke={C.grid} strokeWidth="1" />
            <text x={ML - 6} y={y(t) + 3} textAnchor="end" fontSize="9" fill={C.axis}>{fmt(t)}</text>
          </g>
        ))}
        {Array.from({ length: domainWeeks }, (_, i) => i + 1).map((w) => w % xEvery === (1 % xEvery) && (
          <text key={w} x={x(w)} y={H - 8} textAnchor="middle" fontSize="9" fill={C.axis}>W{w}</text>
        ))}
        <path d={path} fill="none" stroke={C.series} strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => p.marker && (
          <circle key={i} cx={x(p.week)} cy={y(p.value)} r="3"
            fill={C.series} stroke="var(--surface)" strokeWidth="2" />
        ))}
        {h && (
          <g>
            <line x1={x(h.week)} x2={x(h.week)} y1={MT} y2={H - MB} stroke={C.axis} strokeWidth="1" strokeDasharray="2 3" />
            <circle cx={x(h.week)} cy={y(h.value)} r="4.5" fill={C.series} stroke="var(--surface)" strokeWidth="2" />
          </g>
        )}
      </svg>
      <div className="chart-tip" style={{ visibility: h ? 'visible' : 'hidden' }}>
        {h && (<><strong>Week {h.week}</strong> · {tip(h)}</>)}
      </div>
    </div>
  );
}

/* ---------- volume bars ---------- */

function VolumeChart({ rows, units }) {
  const W = 360, H = 170, ML = 44, MR = 8, MT = 10, MB = 24;
  const [hover, setHover] = useState(null);
  const svgRef = useRef(null);
  if (!rows.length) return null;

  const max = Math.max(...rows.map((r) => r.tonnage), 1);
  const iw = (W - ML - MR) / rows.length;
  const bw = Math.max(3, Math.min(22, iw - 2));
  const y = (v) => MT + (1 - v / max) * (H - MT - MB);
  const yTicks = niceTicks(0, max, 3);
  const xEvery = rows.length > 12 ? 4 : rows.length > 6 ? 2 : 1;

  function locate(clientX) {
    const rect = svgRef.current.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * W;
    const i = Math.min(rows.length - 1, Math.max(0, Math.floor((px - ML) / iw)));
    setHover(i);
  }

  const h = hover !== null ? rows[hover] : null;

  return (
    <div className="chart-wrap">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="chart"
        onPointerMove={(e) => locate(e.clientX)} onPointerLeave={() => setHover(null)}
        onPointerDown={(e) => locate(e.clientX)}>
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={ML} x2={W - MR} y1={y(t)} y2={y(t)} stroke={C.grid} strokeWidth="1" />
            <text x={ML - 6} y={y(t) + 3} textAnchor="end" fontSize="9" fill={C.axis}>{compact(t)}</text>
          </g>
        ))}
        {rows.map((r, i) => {
          const bx = ML + i * iw + (iw - bw) / 2;
          const by = y(r.tonnage);
          const bh = Math.max(0, H - MB - by);
          return (
            <g key={r.week}>
              {r.tonnage > 0 && (
                <path d={roundedTop(bx, by, bw, bh, 3)}
                  fill={C.series} opacity={hover === null || hover === i ? 1 : 0.45} />
              )}
              {(r.week - 1) % xEvery === 0 && (
                <text x={ML + i * iw + iw / 2} y={H - 8} textAnchor="middle" fontSize="9" fill={C.axis}>
                  W{r.week}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="chart-tip" style={{ visibility: h ? 'visible' : 'hidden' }}>
        {h && (
          <>
            <strong>Week {h.week}</strong> · {h.tonnage.toLocaleString()} {units} ·{' '}
            {h.sessions}/{h.daysInVariant} sessions
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- helpers ---------- */

function roundedTop(x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h} Z`;
}

function niceTicks(min, max, n) {
  const span = max - min || 1;
  const step = Math.pow(10, Math.floor(Math.log10(span / n)));
  const err = span / n / step;
  const mult = err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1;
  const s = mult * step;
  const ticks = [];
  for (let v = Math.ceil(min / s) * s; v <= max + 1e-9; v += s) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

function compact(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(Math.round(n));
}

function fmt(n) {
  if (n === null || n === undefined) return '—';
  const r = Math.round(n * 10) / 10;
  return String(r);
}
