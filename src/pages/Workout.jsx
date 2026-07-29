import React, { useEffect, useMemo, useRef, useState } from 'react';
import { planForLift, previewNextTM, mround, detectCurrentWeek } from '../lib/program.js';
import { upsertLog, upsertAccessory, deleteAccessory } from '../lib/store.js';

export default function Workout({ data, setData }) {
  const { settings, lifts, programDays, logs, accessories } = data;
  const variant = settings.days_per_week;
  const cycle = settings.cycle ?? 1;
  const autoWeek = useMemo(
    () => detectCurrentWeek({ logs, variant, programDays, settings }),
    [logs, variant, programDays, settings]
  );
  const [week, setWeek] = useState(autoWeek);
  const [day, setDay] = useState(1);

  const days = useMemo(() => {
    const byDay = new Map();
    for (const pd of programDays.filter((p) => p.variant === variant)) {
      if (!byDay.has(pd.day)) byDay.set(pd.day, []);
      byDay.get(pd.day).push(pd);
    }
    return [...byDay.entries()].sort((a, b) => a[0] - b[0]);
  }, [programDays, variant]);

  const liftById = useMemo(() => Object.fromEntries(lifts.map((l) => [l.id, l])), [lifts]);
  const dayLifts = (days.find(([d]) => d === day)?.[1] || []).map((pd) => liftById[pd.lift_id]);

  // completion per day for the current week (all lifts logged)
  const dayDone = useMemo(() => {
    const done = {};
    for (const [d, pds] of days) {
      done[d] =
        pds.length > 0 &&
        pds.every((pd) =>
          logs.some(
            (l) =>
              (l.cycle ?? 1) === cycle && l.variant === variant && l.week === week && l.day === d &&
              l.lift_id === pd.lift_id && l.sets_completed !== null && l.sets_completed !== undefined
          )
        );
    }
    return done;
  }, [days, logs, variant, cycle, week]);

  // land on the first unfinished day of the week (once, on mount)
  const autoDayRef = useRef(false);
  useEffect(() => {
    if (autoDayRef.current) return;
    autoDayRef.current = true;
    const firstOpen = days.find(([d]) => !dayDone[d]);
    if (firstOpen) setDay(firstOpen[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function changeWeek(w) {
    setWeek(Math.min(Math.max(1, w), settings.weeks));
  }

  return (
    <div className="page">
      <div className="workout-head">
        <div className="week-nav">
          <button aria-label="Previous week" onClick={() => changeWeek(week - 1)} disabled={week <= 1}>‹</button>
          <select value={week} onChange={(e) => changeWeek(Number(e.target.value))}>
            {Array.from({ length: settings.weeks }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                Week {i + 1}{i + 1 === autoWeek ? ' · current' : ''}
              </option>
            ))}
          </select>
          {week === autoWeek ? (
            <span className="now-pill current">current</span>
          ) : (
            <button className="now-pill jump" onClick={() => changeWeek(autoWeek)}>
              → W{autoWeek}
            </button>
          )}
          <button aria-label="Next week" onClick={() => changeWeek(week + 1)} disabled={week >= settings.weeks}>›</button>
        </div>
        <div className="day-tabs">
          {days.map(([d]) => (
            <button key={d} className={d === day ? 'active' : ''} onClick={() => setDay(d)}>
              Day {d}
              {dayDone[d] && <span className="done-dot" aria-label="completed" />}
            </button>
          ))}
        </div>
      </div>

      <DaySummary day={day} week={week} variant={variant} cycle={cycle} dayLifts={dayLifts}
        logs={logs} settings={settings} />

      {dayLifts.map((lift) => (
        <LiftCard key={`${cycle}-${variant}-${week}-${day}-${lift.id}`} lift={lift} week={week} day={day}
          variant={variant} cycle={cycle} settings={settings} logs={logs} setData={setData} />
      ))}

      <AccessorySection variant={variant} cycle={cycle} week={week} day={day}
        accessories={accessories} setData={setData} units={settings.units} />
    </div>
  );
}

/* ---------- day summary ---------- */

function DaySummary({ day, week, variant, cycle, dayLifts, logs, settings }) {
  const rows = dayLifts.map((lift) => {
    const entry = planForLift(lift, logs, variant, settings)[week - 1];
    const log = logs.find(
      (l) => (l.cycle ?? 1) === cycle && l.variant === variant && l.week === week && l.day === day && l.lift_id === lift.id
    );
    const done = log && log.sets_completed !== null && log.sets_completed !== undefined;
    return { lift, entry, done };
  });
  const doneCount = rows.filter((r) => r.done).length;
  const u = settings.units;

  function jump(liftId) {
    document.getElementById(`lift-${liftId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="card day-summary">
      <div className="ds-head">
        <span className="ds-title">Day {day} session</span>
        <span className={`ds-progress ${doneCount === rows.length && rows.length ? 'all-done' : ''}`}>
          {doneCount}/{rows.length} logged
        </span>
      </div>
      <div className="ds-bar">
        <div className="ds-bar-fill" style={{ width: rows.length ? `${(doneCount / rows.length) * 100}%` : 0 }} />
      </div>
      <ul className="ds-list">
        {rows.map(({ lift, entry, done }) => (
          <li key={lift.id}>
            <button className="ds-row" onClick={() => jump(lift.id)}>
              <span className={`ds-check ${done ? 'done' : ''}`}>{done ? '✓' : ''}</span>
              <span className="ds-name">{lift.name}</span>
              <span className="ds-rx">{fmt(entry.weight)} {u} · {entry.setGoal}×{entry.repsPerSet}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- lift card ---------- */

function LiftCard({ lift, week, day, variant, cycle, settings, logs, setData }) {
  const plan = useMemo(() => planForLift(lift, logs, variant, settings), [lift, logs, variant, settings]);
  const entry = plan[week - 1];
  const log = entry.log;
  const logged = log.setsCompleted !== null && log.setsCompleted !== undefined;

  const [open, setOpen] = useState(!logged);
  const [sets, setSets] = useState(log.setsCompleted ?? null);
  const [rir, setRir] = useState(log.rirLastSet ?? null);
  const [single, setSingle] = useState(log.singleAt8 ?? '');
  const [notes, setNotes] = useState(log.notes ?? '');
  const [video, setVideo] = useState(log.video ?? '');
  const [more, setMore] = useState(false);
  const [plates, setPlates] = useState(false);
  const [saveState, setSaveState] = useState('idle'); // idle | saving | saved | error

  // ----- autosave (debounced) -----
  const timerRef = useRef(null);
  const latest = useRef({});
  latest.current = { sets, rir, single, notes, video };

  function queueSave(next = {}) {
    Object.assign(latest.current, next);
    setSaveState('saving');
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(doSave, 700);
  }

  async function doSave() {
    const v = latest.current;
    try {
      const row = await upsertLog({
        cycle, variant, week, day, lift_id: lift.id,
        sets_completed: v.sets ?? null,
        rir_last_set: v.rir ?? null,
        single_at8: v.single === '' ? null : Number(v.single),
        notes: v.notes || null,
        video: v.video || null,
      });
      setSaveState('saved');
      setData((d) => {
        const rest = d.logs.filter(
          (l) => !((l.cycle ?? 1) === cycle && l.variant === variant && l.week === week && l.day === day && l.lift_id === lift.id)
        );
        return { ...d, logs: [...rest, row] };
      });
    } catch {
      setSaveState('error');
    }
  }

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const preview = useMemo(() => {
    if (sets === null || week >= settings.weeks) return null;
    const tm = previewNextTM(
      { ...entry, log: { setsCompleted: Number(sets), rirLastSet: rir } },
      lift, settings
    );
    const pct = ((tm - entry.tm) / entry.tm) * 100;
    return { tm, pct };
  }, [sets, rir, entry, lift, settings, week]);

  const u = settings.units;
  const singleSuggested = mround(entry.tm * Number(lift.single_at8_pct), Number(settings.rounding));
  const maxSets = Math.max(entry.setGoal + 3, sets ?? 0);

  const resultChip = sets !== null ? summarize(sets, rir, entry) : null;

  return (
    <div id={`lift-${lift.id}`} className={`card lift-card ${open ? 'open' : 'closed'}`}>
      <button className="lift-summary" onClick={() => setOpen(!open)} aria-expanded={open}>
        <div className="ls-left">
          <span className="ls-name">{lift.name}</span>
          <span className="ls-rx">{fmt(entry.weight)} {u} · {entry.setGoal}×{entry.repsPerSet}</span>
        </div>
        <div className="ls-right">
          {resultChip && <span className={`chip ${resultChip.tone}`}>{resultChip.text}</span>}
          <span className="chev">{open ? '▾' : '▸'}</span>
        </div>
      </button>

      {open && (
        <div className="lift-body">
          <div className="rx-hero">
            <button className="rx-weight" onClick={() => setPlates(!plates)} title="Show plate math">
              {fmt(entry.weight)}<span className="rx-unit">{u}</span>
            </button>
            <div className="rx-detail">
              <div className="rx-scheme">{entry.setGoal} sets × {entry.repsPerSet} reps</div>
              <div className="rx-sub">RIR target {entry.rirTarget} · TM {fmt(entry.tm)} · single @8 ≈ {fmt(singleSuggested)}</div>
            </div>
          </div>
          {plates && <PlateMath weight={entry.weight} units={u} />}

          <div className="field-label">Sets completed</div>
          <div className="set-dots">
            {Array.from({ length: maxSets }, (_, i) => i + 1).map((n) => (
              <button key={n}
                className={`set-dot ${sets !== null && n <= sets ? 'on' : ''} ${n > entry.setGoal ? 'extra' : ''}`}
                onClick={() => {
                  const next = sets === n ? (n - 1 === 0 ? null : n - 1) : n;
                  setSets(next);
                  queueSave({ sets: next });
                }}>
                {n}
              </button>
            ))}
          </div>

          <div className="field-label">RIR on last set</div>
          <div className="chip-row">
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <button key={n}
                className={`chip pick ${rir !== null && Number(rir) === n ? 'on' : ''}`}
                onClick={() => {
                  const next = rir !== null && Number(rir) === n ? null : n;
                  setRir(next);
                  queueSave({ rir: next });
                }}>
                {n === 5 ? '5+' : n}
              </button>
            ))}
          </div>

          <button className="more-toggle" onClick={() => setMore(!more)}>
            {more ? '− less' : '+ single @8, notes, video'}
          </button>
          {more && (
            <div className="more-fields">
              <label>
                Single @8 ({u})
                <input type="number" inputMode="decimal" step="any" value={single} placeholder={`~${fmt(singleSuggested)}`}
                  onChange={(e) => { setSingle(e.target.value); queueSave({ single: e.target.value }); }} />
              </label>
              <label>
                Notes
                <input type="text" value={notes} placeholder="optional"
                  onChange={(e) => { setNotes(e.target.value); queueSave({ notes: e.target.value }); }} />
              </label>
              <label>
                Video link
                <input type="text" value={video} placeholder="optional"
                  onChange={(e) => { setVideo(e.target.value); queueSave({ video: e.target.value }); }} />
              </label>
            </div>
          )}

          <div className="card-foot">
            {preview && (
              <span className={`preview ${preview.pct > 0 ? 'up' : preview.pct < 0 ? 'down' : ''}`}>
                next week {fmt(mround(preview.tm * entry.intensity, Number(settings.rounding)))} {u} ({preview.pct >= 0 ? '+' : ''}{preview.pct.toFixed(1)}%)
              </span>
            )}
            <span className={`save-state ${saveState}`}>
              {saveState === 'saving' ? 'saving…' : saveState === 'saved' ? 'saved ✓' : saveState === 'error' ? "couldn't save — will retry on next change" : ''}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function summarize(sets, rir, entry) {
  if (sets === null || sets === undefined) return { text: 'not logged', tone: 'muted' };
  const ds = sets - entry.setGoal;
  const r = rir === null || rir === undefined ? 0 : Number(rir);
  if (ds < -1.9) return { text: `${sets} sets · −5%`, tone: 'down' };
  if (ds === -1 || r < entry.rirTarget) return { text: `${sets} sets · −2%`, tone: 'down' };
  const dr = r - entry.rirTarget;
  const pct = dr <= 0 ? 0 : dr === 1 ? 1 : dr === 2 ? 3 : 5;
  return { text: `${sets}×${entry.repsPerSet} @ RIR ${r} · ${pct > 0 ? `+${pct}%` : '0%'}`, tone: pct > 0 ? 'up' : 'even' };
}

function PlateMath({ weight, units }) {
  const bar = units === 'kg' ? 20 : 45;
  const sizes = units === 'kg' ? [25, 20, 15, 10, 5, 2.5, 1.25] : [45, 25, 15, 10, 5, 2.5, 1.25];
  if (weight < bar) {
    return <div className="plate-math">below bar weight ({bar} {units} bar)</div>;
  }
  let per = (weight - bar) / 2;
  const out = [];
  for (const s of sizes) {
    while (per >= s - 1e-9) { out.push(s); per -= s; }
  }
  return (
    <div className="plate-math">
      {bar} {units} bar · per side:{' '}
      {out.length ? out.map((p, i) => <span key={i} className="plate">{p}</span>) : 'empty bar'}
      {per > 1e-9 && <span className="muted"> (+{per.toFixed(2)} unrounded)</span>}
    </div>
  );
}

/* ---------- accessories ---------- */

function AccessorySection({ variant, cycle, week, day, accessories, setData, units }) {
  const rows = accessories
    .filter((a) => (a.cycle ?? 1) === cycle && a.variant === variant && a.week === week && a.day === day)
    .sort((a, b) => a.slot - b.slot);

  const prior = useMemo(() => {
    const bySlot = {};
    for (const a of accessories) {
      if ((a.cycle ?? 1) === cycle && a.variant === variant && a.day === day && a.week < week && a.name) {
        if (!bySlot[a.slot] || a.week > bySlot[a.slot].week) bySlot[a.slot] = a;
      }
    }
    return bySlot;
  }, [accessories, variant, cycle, day, week]);

  const usedSlots = new Set(rows.map((r) => r.slot));
  const ghostSlots = Object.keys(prior).map(Number).filter((s) => !usedSlots.has(s)).sort((a, b) => a - b);
  const nextSlot = Math.max(0, ...rows.map((r) => r.slot + 1), ...Object.keys(prior).map((s) => Number(s) + 1));

  async function addRow(fromPrior) {
    const base = fromPrior
      ? { slot: fromPrior.slot, name: fromPrior.name, weight: fromPrior.weight, reps_per_set: fromPrior.reps_per_set, set_goal: fromPrior.set_goal }
      : { slot: nextSlot, name: '' };
    try {
      const row = await upsertAccessory({ cycle, variant, week, day, ...base });
      setData((d) => ({ ...d, accessories: [...d.accessories, row] }));
    } catch (e) {
      alert(`Save failed: ${e.message}`);
    }
  }

  return (
    <div className="card accessory-section">
      <h3>Additional workouts</h3>
      {rows.length === 0 && ghostSlots.length === 0 && (
        <p className="muted">Nothing extra logged today.</p>
      )}
      {rows.map((row) => (
        <AccessoryRow key={row.id} row={row} setData={setData} units={units} />
      ))}
      {ghostSlots.map((s) => (
        <div key={`ghost-${s}`} className="accessory-ghost">
          <span>
            {prior[s].name} · {prior[s].weight ?? '—'} {units} × {prior[s].reps_per_set ?? '—'} × {prior[s].sets_completed ?? prior[s].set_goal ?? '—'}
          </span>
          <button className="secondary small" onClick={() => addRow(prior[s])}>Do again</button>
        </div>
      ))}
      <button className="secondary add-btn" onClick={() => addRow(null)}>+ Add workout</button>
    </div>
  );
}

function AccessoryRow({ row, setData, units }) {
  const [v, setV] = useState({
    name: row.name ?? '', weight: row.weight ?? '', reps_per_set: row.reps_per_set ?? '',
    set_goal: row.set_goal ?? '', sets_completed: row.sets_completed ?? '',
    rir_last_set: row.rir_last_set ?? '', notes: row.notes ?? '',
  });
  const [saveState, setSaveState] = useState('idle');
  const timerRef = useRef(null);
  const latest = useRef(v);
  latest.current = v;

  function upd(k, val) {
    setV((s) => ({ ...s, [k]: val }));
    setSaveState('saving');
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(save, 700);
  }

  async function save() {
    const s = latest.current;
    try {
      const saved = await upsertAccessory({
        cycle: row.cycle ?? 1, variant: row.variant, week: row.week, day: row.day, slot: row.slot,
        name: s.name || null, weight: numOrNull(s.weight), reps_per_set: numOrNull(s.reps_per_set),
        set_goal: numOrNull(s.set_goal), sets_completed: numOrNull(s.sets_completed),
        rir_last_set: numOrNull(s.rir_last_set), notes: s.notes || null,
      });
      setSaveState('saved');
      setData((d) => ({
        ...d,
        accessories: d.accessories.map((a) => (a.id === saved.id || samePlace(a, saved) ? saved : a)),
      }));
    } catch {
      setSaveState('error');
    }
  }

  useEffect(() => () => clearTimeout(timerRef.current), []);

  async function remove() {
    if (!confirm(`Remove "${row.name || 'this workout'}" for this week?`)) return;
    try {
      await deleteAccessory(row.id);
      setData((d) => ({ ...d, accessories: d.accessories.filter((a) => a.id !== row.id) }));
    } catch (e) {
      alert(`Delete failed: ${e.message}`);
    }
  }

  return (
    <div className="accessory-row">
      <div className="inputs">
        <label className="grow">Exercise
          <input type="text" value={v.name} onChange={(e) => upd('name', e.target.value)} />
        </label>
        <label>Weight ({units})
          <input type="number" inputMode="decimal" step="any" value={v.weight} onChange={(e) => upd('weight', e.target.value)} />
        </label>
      </div>
      <div className="inputs">
        <label>Reps/set
          <input type="number" inputMode="numeric" value={v.reps_per_set} onChange={(e) => upd('reps_per_set', e.target.value)} />
        </label>
        <label>Sets done
          <input type="number" inputMode="numeric" value={v.sets_completed} onChange={(e) => upd('sets_completed', e.target.value)} />
        </label>
        <label>RIR
          <input type="number" inputMode="numeric" value={v.rir_last_set} onChange={(e) => upd('rir_last_set', e.target.value)} />
        </label>
      </div>
      <div className="inputs">
        <label className="grow">Notes
          <input type="text" value={v.notes} onChange={(e) => upd('notes', e.target.value)} />
        </label>
      </div>
      <div className="card-foot">
        <button className="danger-link" onClick={remove}>Remove</button>
        <span className={`save-state ${saveState}`}>
          {saveState === 'saving' ? 'saving…' : saveState === 'saved' ? 'saved ✓' : ''}
        </span>
      </div>
    </div>
  );
}

function samePlace(a, b) {
  return (a.cycle ?? 1) === (b.cycle ?? 1) && a.variant === b.variant && a.week === b.week && a.day === b.day && a.slot === b.slot;
}

function numOrNull(v) {
  return v === '' || v === null || v === undefined ? null : Number(v);
}

function fmt(n) {
  if (n === null || n === undefined) return '—';
  const r = Math.round(n * 100) / 100;
  return String(r);
}
