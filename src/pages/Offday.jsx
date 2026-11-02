import React, { useEffect, useMemo, useRef, useState } from 'react';
import { saveOffday, deleteOffday, saveSettings } from '../lib/store.js';
import {
  ADDUCTOR, DEFAULT_ACTIVITIES, isoDate, addDays, adductorWeek, adductorPhase,
  lastBefore, weekStart, prettyDate,
} from '../lib/offday.js';

export default function Offday({ data, setData }) {
  const { settings, offday = [], offdayMissing } = data;
  const today = isoDate();
  const [date, setDate] = useState(today);

  if (offdayMissing) {
    return (
      <div className="page">
        <div className="card">
          <h3>Off-day workouts</h3>
          <p className="muted">
            The database table for off-day workouts isn't set up yet. Run{' '}
            <code>supabase/migration-004-offday.sql</code> in the Supabase SQL editor, then reload.
          </p>
        </div>
      </div>
    );
  }

  const rows = offday.filter((r) => r.date === date);

  // Replace or add a row in local state after a save.
  function put(row) {
    setData((d) => ({ ...d, offday: [...d.offday.filter((r) => r.id !== row.id), row] }));
  }
  function drop(id) {
    setData((d) => ({ ...d, offday: d.offday.filter((r) => r.id !== id) }));
  }

  return (
    <div className="page">
      <div className="workout-head">
        <div className="week-nav">
          <button aria-label="Previous day" onClick={() => setDate(addDays(date, -1))}>‹</button>
          <div className="date-label">{prettyDate(date, { weekday: 'long', month: 'short', day: 'numeric' })}</div>
          {date === today ? (
            <span className="now-pill current">today</span>
          ) : (
            <button className="now-pill jump" onClick={() => setDate(today)}>→ today</button>
          )}
          <button aria-label="Next day" onClick={() => setDate(addDays(date, 1))} disabled={date >= today}>›</button>
        </div>
      </div>

      <PushupCard key={`p-${date}`} date={date} rows={offday} goal={settings.pushup_goal ?? 100}
        row={rows.find((r) => r.kind === 'pushups')} put={put} />
      <AdductorCard key={`a-${date}`} date={date} rows={offday} settings={settings} setData={setData}
        row={rows.find((r) => r.kind === 'adductor')} put={put} />
      <ActivityCard key={`x-${date}`} date={date} all={offday}
        rows={rows.filter((r) => r.kind === 'activity').sort((a, b) => a.id - b.id)} put={put} drop={drop} />
    </div>
  );
}

/* ---------- push-ups ---------- */

function PushupCard({ date, rows, row, goal, put }) {
  const [sets, setSets] = useState(row?.data?.sets ?? 0);
  const [saveState, setSaveState] = useState('idle');
  const idRef = useRef(row?.id ?? null);
  const goalSets = Math.max(1, Math.round(goal / 10));
  const count = sets * 10;

  const weekTotal = useMemo(() => {
    const ws = weekStart(date);
    return rows
      .filter((r) => r.kind === 'pushups' && r.date >= ws && r.date <= addDays(ws, 6) && r.date !== date)
      .reduce((n, r) => n + (r.data?.sets ?? 0) * 10, 0) + count;
  }, [rows, date, count]);

  // Saves run one after another so fast taps can't create two rows for the day.
  const chain = useRef(Promise.resolve());
  const want = useRef(sets);

  function set(n) {
    const next = Math.max(0, n);
    setSets(next);
    want.current = next;
    setSaveState('saving');
    chain.current = chain.current.then(async () => {
      if (want.current !== next) return; // a newer tap supersedes this one
      try {
        const saved = await saveOffday({ id: idRef.current, date, kind: 'pushups', data: { sets: next } });
        idRef.current = saved.id;
        put(saved);
        if (want.current === next) setSaveState('saved');
      } catch {
        setSaveState('error');
      }
    });
  }

  const done = count >= goal;

  return (
    <div className="card offday-card">
      <div className="oc-head">
        <h3>Push-ups</h3>
        <span className="muted small">this week {weekTotal}</span>
      </div>
      <div className="pu-hero">
        <div className={`pu-count ${done ? 'done' : ''}`}>
          {count}<span className="pu-goal"> / {goal}</span>
        </div>
        <div className="pu-actions">
          <button className="secondary" onClick={() => set(sets - 1)} disabled={sets === 0} aria-label="Remove a set of 10">−10</button>
          <button className="pu-add" onClick={() => set(sets + 1)}>+10</button>
        </div>
      </div>
      <div className="pu-bar" role="img" aria-label={`${sets} of ${goalSets} sets of 10`}>
        {Array.from({ length: Math.max(goalSets, sets) }, (_, i) => (
          <button key={i} className={`pu-seg ${i < sets ? 'on' : ''} ${i >= goalSets ? 'extra' : ''}`}
            aria-label={`Set ${i + 1}`}
            onClick={() => set(i + 1 === sets ? i : i + 1)} />
        ))}
      </div>
      <div className="card-foot">
        <span className="muted small">{done ? 'Goal hit' : `${goal - count} to go · tap +10 after each set`}</span>
        <SaveState s={saveState} />
      </div>
    </div>
  );
}

/* ---------- inner-thigh routine ---------- */

function AdductorCard({ date, rows, row, settings, setData, put }) {
  const start = settings.offday_start;
  const week = adductorWeek(start, date);
  const [reps, setReps] = useState(row?.data ?? {});
  const [saveState, setSaveState] = useState('idle');
  const idRef = useRef(row?.id ?? null);
  const timer = useRef(null);
  const latest = useRef(reps);
  latest.current = reps;
  useEffect(() => () => clearTimeout(timer.current), []);

  async function startNow() {
    try {
      const s = await saveSettings({ offday_start: date });
      setData((d) => ({ ...d, settings: s }));
    } catch (e) {
      setSaveState('error');
    }
  }

  if (!start || week === null) {
    return (
      <div className="card offday-card">
        <h3>Inner thigh</h3>
        <p className="muted">
          {start ? `The routine starts ${prettyDate(start)}.` : 'Week 1 of the routine starts the day you choose.'}
        </p>
        {!start && <button onClick={startNow}>Start week 1 on {prettyDate(date)}</button>}
      </div>
    );
  }

  const { idx, sets } = adductorPhase(week);
  const prev = lastBefore(rows, 'adductor', date);

  function upd(name, i, v) {
    setReps((r) => {
      const arr = [...(r[name] ?? [])];
      arr[i] = v === '' ? null : Number(v);
      return { ...r, [name]: arr };
    });
    setSaveState('saving');
    clearTimeout(timer.current);
    timer.current = setTimeout(save, 700);
  }

  async function save() {
    // drop trailing empties so "not done" stays empty
    const clean = {};
    for (const [k, arr] of Object.entries(latest.current)) {
      const a = [...arr];
      while (a.length && (a[a.length - 1] === null || a[a.length - 1] === undefined)) a.pop();
      if (a.length) clean[k] = a;
    }
    try {
      const saved = await saveOffday({ id: idRef.current, date, kind: 'adductor', data: clean });
      idRef.current = saved.id;
      put(saved);
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  }

  const doneSets = ADDUCTOR.reduce(
    (n, ex) => n + (reps[ex.name] ?? []).slice(0, sets).filter((v) => v !== null && v !== undefined).length, 0
  );
  const totalSets = ADDUCTOR.length * sets;

  return (
    <div className="card offday-card">
      <div className="oc-head">
        <h3>Inner thigh</h3>
        <span className="muted small">week {week} · {sets} set{sets > 1 ? 's' : ''} each · {doneSets}/{totalSets} done</span>
      </div>
      {ADDUCTOR.map((ex) => {
        const last = prev?.data?.[ex.name];
        const lastBest = last && last.length ? Math.max(...last.filter((v) => v != null)) : null;
        return (
          <div key={ex.name} className="ad-row">
            <div className="ad-name">
              <span>{ex.name}</span>
              <span className="muted small">
                {ex.targets[idx]} reps{lastBest != null && isFinite(lastBest) ? ` · last ${lastBest}` : ''}
              </span>
            </div>
            <div className="ad-sets">
              {Array.from({ length: sets }, (_, i) => (
                <input key={i} type="number" inputMode="numeric" min="0" className="ad-input"
                  aria-label={`${ex.name} set ${i + 1} reps`}
                  placeholder={idx === 2 && lastBest != null && isFinite(lastBest) ? String(lastBest) : ex.targets[idx].replace('+', '').split('-').pop()}
                  value={reps[ex.name]?.[i] ?? ''}
                  onChange={(e) => upd(ex.name, i, e.target.value)} />
              ))}
            </div>
          </div>
        );
      })}
      <div className="card-foot">
        <span className="muted small">Enter reps for each set you do.</span>
        <SaveState s={saveState} />
      </div>
    </div>
  );
}

/* ---------- activities ---------- */

function ActivityCard({ date, all, rows, put, drop }) {
  const names = useMemo(() => {
    const seen = new Set(DEFAULT_ACTIVITIES);
    for (const r of all) if (r.kind === 'activity' && r.data?.name) seen.add(r.data.name);
    return [...seen];
  }, [all]);
  const [custom, setCustom] = useState('');

  async function add(name) {
    if (!name.trim()) return;
    try {
      const saved = await saveOffday({ date, kind: 'activity', data: { name: name.trim(), minutes: null } });
      put(saved);
      setCustom('');
    } catch (e) {
      alert(`Save failed: ${e.message}`);
    }
  }

  return (
    <div className="card offday-card">
      <h3>Activities</h3>
      {rows.map((r) => <ActivityRow key={r.id} row={r} put={put} drop={drop} />)}
      <div className="chip-row act-chips">
        {names.map((n) => (
          <button key={n} className="chip pick" onClick={() => add(n)}>+ {n}</button>
        ))}
      </div>
      <form className="act-custom" onSubmit={(e) => { e.preventDefault(); add(custom); }}>
        <input type="text" placeholder="Something else…" value={custom} onChange={(e) => setCustom(e.target.value)} />
        <button className="secondary" disabled={!custom.trim()}>Add</button>
      </form>
    </div>
  );
}

function ActivityRow({ row, put, drop }) {
  const [v, setV] = useState({ minutes: row.data?.minutes ?? '', notes: row.data?.notes ?? '' });
  const [saveState, setSaveState] = useState('idle');
  const timer = useRef(null);
  const latest = useRef(v);
  latest.current = v;
  useEffect(() => () => clearTimeout(timer.current), []);

  function upd(k, val) {
    setV((s) => ({ ...s, [k]: val }));
    setSaveState('saving');
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const s = latest.current;
      try {
        const saved = await saveOffday({
          id: row.id, date: row.date, kind: 'activity',
          data: { name: row.data.name, minutes: s.minutes === '' ? null : Number(s.minutes), notes: s.notes || null },
        });
        put(saved);
        setSaveState('saved');
      } catch {
        setSaveState('error');
      }
    }, 700);
  }

  async function remove() {
    try {
      await deleteOffday(row.id);
      drop(row.id);
    } catch (e) {
      alert(`Delete failed: ${e.message}`);
    }
  }

  return (
    <div className="act-row">
      <div className="act-top">
        <span className="act-name">{row.data.name}</span>
        <button className="danger-link small" onClick={remove} aria-label={`Remove ${row.data.name}`}>Remove</button>
      </div>
      <div className="inputs">
        <label>Minutes
          <input type="number" inputMode="numeric" min="0" value={v.minutes} onChange={(e) => upd('minutes', e.target.value)} />
        </label>
        <label className="grow">Notes
          <input type="text" placeholder="optional" value={v.notes} onChange={(e) => upd('notes', e.target.value)} />
        </label>
      </div>
      <div className="card-foot"><span /><SaveState s={saveState} /></div>
    </div>
  );
}

function SaveState({ s }) {
  return (
    <span className={`save-state ${s}`}>
      {s === 'saving' ? 'saving…' : s === 'saved' ? 'saved ✓' : s === 'error' ? "couldn't save" : ''}
    </span>
  );
}
