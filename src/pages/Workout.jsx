import React, { useMemo, useState } from 'react';
import { planForLift, previewNextTM, mround } from '../lib/program.js';
import { upsertLog, upsertAccessory, deleteAccessory, saveSettings } from '../lib/store.js';

export default function Workout({ data, setData }) {
  const { settings, lifts, programDays, logs, accessories } = data;
  const variant = settings.days_per_week;
  const [week, setWeek] = useState(settings.current_week || 1);
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

  async function changeWeek(w) {
    const wk = Math.min(Math.max(1, w), settings.weeks);
    setWeek(wk);
    try {
      const s = await saveSettings({ current_week: wk });
      setData((d) => ({ ...d, settings: s }));
    } catch {
      /* non-critical */
    }
  }

  return (
    <div className="page">
      <div className="week-nav">
        <button onClick={() => changeWeek(week - 1)} disabled={week <= 1}>
          ‹
        </button>
        <select value={week} onChange={(e) => changeWeek(Number(e.target.value))}>
          {Array.from({ length: settings.weeks }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              Week {i + 1}
            </option>
          ))}
        </select>
        <button onClick={() => changeWeek(week + 1)} disabled={week >= settings.weeks}>
          ›
        </button>
      </div>

      <div className="day-tabs">
        {days.map(([d]) => (
          <button key={d} className={d === day ? 'active' : ''} onClick={() => setDay(d)}>
            Day {d}
          </button>
        ))}
      </div>

      {dayLifts.map((lift) => (
        <LiftCard
          key={lift.id}
          lift={lift}
          week={week}
          day={day}
          variant={variant}
          settings={settings}
          logs={logs}
          setData={setData}
        />
      ))}

      <AccessorySection
        variant={variant}
        week={week}
        day={day}
        accessories={accessories}
        setData={setData}
        units={settings.units}
      />
    </div>
  );
}

function LiftCard({ lift, week, day, variant, settings, logs, setData }) {
  const plan = useMemo(
    () => planForLift(lift, logs, variant, settings),
    [lift, logs, variant, settings]
  );
  const entry = plan[week - 1];
  const log = entry.log;

  const [sets, setSets] = useState(log.setsCompleted ?? '');
  const [rir, setRir] = useState(log.rirLastSet ?? '');
  const [single, setSingle] = useState(log.singleAt8 ?? '');
  const [notes, setNotes] = useState(log.notes ?? '');
  const [video, setVideo] = useState(log.video ?? '');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);

  // Re-sync local inputs when navigating to another week/day
  const navKey = `${variant}|${week}|${day}|${lift.id}`;
  const [lastNav, setLastNav] = useState(navKey);
  if (navKey !== lastNav) {
    setLastNav(navKey);
    setSets(log.setsCompleted ?? '');
    setRir(log.rirLastSet ?? '');
    setSingle(log.singleAt8 ?? '');
    setNotes(log.notes ?? '');
    setVideo(log.video ?? '');
  }

  async function save() {
    setSaving(true);
    try {
      const row = await upsertLog({
        variant,
        week,
        day,
        lift_id: lift.id,
        sets_completed: sets === '' ? null : Number(sets),
        rir_last_set: rir === '' ? null : Number(rir),
        single_at8: single === '' ? null : Number(single),
        notes: notes || null,
        video: video || null,
      });
      setData((d) => {
        const rest = d.logs.filter(
          (l) => !(l.variant === variant && l.week === week && l.day === day && l.lift_id === lift.id)
        );
        return { ...d, logs: [...rest, row] };
      });
      setSavedAt(Date.now());
    } catch (e) {
      alert(`Save failed: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  // Live next-week preview using unsaved inputs
  const preview = useMemo(() => {
    if (sets === '' || week >= settings.weeks) return null;
    const tm = previewNextTM(
      {
        ...entry,
        log: {
          setsCompleted: Number(sets),
          rirLastSet: rir === '' ? null : Number(rir),
        },
      },
      lift,
      settings
    );
    const pct = ((tm - entry.tm) / entry.tm) * 100;
    return { tm, pct };
  }, [sets, rir, entry, lift, settings, week]);

  const singleSuggested = mround(entry.tm * Number(lift.single_at8_pct), Number(settings.rounding));
  const u = settings.units;

  return (
    <div className="card lift-card">
      <div className="lift-head">
        <h3>{lift.name}</h3>
        <span className="tm">
          TM {fmt(entry.tm)} {u}
        </span>
      </div>
      <div className="prescription">
        <div className="rx-main">
          <span className="rx-weight">
            {fmt(entry.weight)} {u}
          </span>
          <span className="rx-scheme">
            {entry.setGoal} × {entry.repsPerSet} reps
          </span>
        </div>
        <div className="rx-sub">
          Last-set RIR target: <strong>{entry.rirTarget}</strong> · Single @8 ≈ {fmt(singleSuggested)} {u}
        </div>
      </div>

      <div className="inputs">
        <label>
          Sets completed
          <input
            type="number"
            inputMode="decimal"
            min="0"
            value={sets}
            onChange={(e) => setSets(e.target.value)}
            placeholder={String(entry.setGoal)}
          />
        </label>
        <label>
          RIR on last set
          <input
            type="number"
            inputMode="decimal"
            min="0"
            value={rir}
            onChange={(e) => setRir(e.target.value)}
            placeholder={String(entry.rirTarget)}
          />
        </label>
        <label>
          Single @8 ({u})
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={single}
            onChange={(e) => setSingle(e.target.value)}
            placeholder="optional"
            title="If you worked up to a single @ RPE 8, enter the weight — it recalibrates your training max for this week."
          />
        </label>
      </div>
      <div className="inputs">
        <label className="grow">
          Notes
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="optional" />
        </label>
        <label className="grow">
          Video link
          <input type="text" value={video} onChange={(e) => setVideo(e.target.value)} placeholder="optional" />
        </label>
      </div>

      <div className="card-foot">
        {preview && (
          <span className={`preview ${preview.pct > 0 ? 'up' : preview.pct < 0 ? 'down' : ''}`}>
            Next week TM: {fmt(preview.tm)} {u} ({preview.pct >= 0 ? '+' : ''}
            {preview.pct.toFixed(1)}%)
          </span>
        )}
        <button onClick={save} disabled={saving}>
          {saving ? 'Saving…' : savedAt ? 'Saved ✓' : 'Save'}
        </button>
      </div>
    </div>
  );
}

function AccessorySection({ variant, week, day, accessories, setData, units }) {
  const rows = accessories
    .filter((a) => a.variant === variant && a.week === week && a.day === day)
    .sort((a, b) => a.slot - b.slot);

  // carry-forward candidates: latest prior week per slot
  const prior = useMemo(() => {
    const bySlot = {};
    for (const a of accessories) {
      if (a.variant === variant && a.day === day && a.week < week && a.name) {
        if (!bySlot[a.slot] || a.week > bySlot[a.slot].week) bySlot[a.slot] = a;
      }
    }
    return bySlot;
  }, [accessories, variant, day, week]);

  const usedSlots = new Set(rows.map((r) => r.slot));
  const ghostSlots = Object.keys(prior)
    .map(Number)
    .filter((s) => !usedSlots.has(s))
    .sort((a, b) => a - b);
  const nextSlot = Math.max(0, ...rows.map((r) => r.slot + 1), ...Object.keys(prior).map((s) => Number(s) + 1));

  async function addRow(fromPrior) {
    const base = fromPrior
      ? {
          slot: fromPrior.slot,
          name: fromPrior.name,
          weight: fromPrior.weight,
          reps_per_set: fromPrior.reps_per_set,
          set_goal: fromPrior.set_goal,
        }
      : { slot: nextSlot, name: '' };
    try {
      const row = await upsertAccessory({ variant, week, day, ...base });
      setData((d) => ({ ...d, accessories: [...d.accessories, row] }));
    } catch (e) {
      alert(`Save failed: ${e.message}`);
    }
  }

  return (
    <div className="card accessory-section">
      <h3>Additional workouts</h3>
      {rows.length === 0 && ghostSlots.length === 0 && (
        <p className="muted">Nothing logged yet — add anything extra you did today.</p>
      )}
      {rows.map((row) => (
        <AccessoryRow key={row.id} row={row} setData={setData} units={units} />
      ))}
      {ghostSlots.map((s) => (
        <div key={`ghost-${s}`} className="accessory-ghost">
          <span>
            {prior[s].name} — last time: {prior[s].weight ?? '—'} {units} × {prior[s].reps_per_set ?? '—'} reps ×{' '}
            {prior[s].sets_completed ?? prior[s].set_goal ?? '—'} sets
          </span>
          <button className="secondary" onClick={() => addRow(prior[s])}>
            Do again
          </button>
        </div>
      ))}
      <button className="secondary add-btn" onClick={() => addRow(null)}>
        + Add workout
      </button>
    </div>
  );
}

function AccessoryRow({ row, setData, units }) {
  const [v, setV] = useState({
    name: row.name ?? '',
    weight: row.weight ?? '',
    reps_per_set: row.reps_per_set ?? '',
    set_goal: row.set_goal ?? '',
    sets_completed: row.sets_completed ?? '',
    rir_last_set: row.rir_last_set ?? '',
    notes: row.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function upd(k, val) {
    setV((s) => ({ ...s, [k]: val }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    try {
      const patch = {
        variant: row.variant,
        week: row.week,
        day: row.day,
        slot: row.slot,
        name: v.name || null,
        weight: numOrNull(v.weight),
        reps_per_set: numOrNull(v.reps_per_set),
        set_goal: numOrNull(v.set_goal),
        sets_completed: numOrNull(v.sets_completed),
        rir_last_set: numOrNull(v.rir_last_set),
        notes: v.notes || null,
      };
      const saved_ = await upsertAccessory(patch);
      setData((d) => ({
        ...d,
        accessories: d.accessories.map((a) => (a.id === saved_.id || samePlace(a, saved_) ? saved_ : a)),
      }));
      setSaved(true);
    } catch (e) {
      alert(`Save failed: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

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
        <label className="grow">
          Exercise
          <input type="text" value={v.name} onChange={(e) => upd('name', e.target.value)} />
        </label>
        <label>
          Weight ({units})
          <input type="number" inputMode="decimal" step="any" value={v.weight} onChange={(e) => upd('weight', e.target.value)} />
        </label>
      </div>
      <div className="inputs">
        <label>
          Reps/set
          <input type="number" inputMode="decimal" value={v.reps_per_set} onChange={(e) => upd('reps_per_set', e.target.value)} />
        </label>
        <label>
          Set goal
          <input type="number" inputMode="decimal" value={v.set_goal} onChange={(e) => upd('set_goal', e.target.value)} />
        </label>
        <label>
          Sets done
          <input type="number" inputMode="decimal" value={v.sets_completed} onChange={(e) => upd('sets_completed', e.target.value)} />
        </label>
        <label>
          RIR last set
          <input type="number" inputMode="decimal" value={v.rir_last_set} onChange={(e) => upd('rir_last_set', e.target.value)} />
        </label>
      </div>
      <div className="inputs">
        <label className="grow">
          Notes
          <input type="text" value={v.notes} onChange={(e) => upd('notes', e.target.value)} />
        </label>
      </div>
      <div className="card-foot">
        <button className="danger-link" onClick={remove}>
          Remove
        </button>
        <button onClick={save} disabled={saving}>
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
        </button>
      </div>
    </div>
  );
}

function samePlace(a, b) {
  return a.variant === b.variant && a.week === b.week && a.day === b.day && a.slot === b.slot;
}

function numOrNull(v) {
  return v === '' || v === null || v === undefined ? null : Number(v);
}

function fmt(n) {
  if (n === null || n === undefined) return '—';
  const r = Math.round(n * 100) / 100;
  return Number.isInteger(r) ? String(r) : String(r);
}
