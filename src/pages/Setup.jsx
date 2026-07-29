import React, { useMemo, useState } from 'react';
import { saveSettings, saveLift, resetProgram, wipePastCycles } from '../lib/store.js';
import { clearConfig } from '../lib/supabase.js';
import { planForLift, detectCurrentWeek } from '../lib/program.js';

export default function Setup({ data, setData, onReconnect, onReload }) {
  const { settings, lifts, programDays } = data;

  return (
    <div className="page">
      <ProgramSettings settings={settings} setData={setData} />
      <LiftsTable lifts={lifts} settings={settings} setData={setData} />
      <ProgressionTable lifts={lifts} setData={setData} />
      <TargetTables lifts={lifts} setData={setData} />
      <DayLayout programDays={programDays} lifts={lifts} variant={settings.days_per_week} />
      <ResetCard data={data} setData={setData} />
      <WipeCard data={data} setData={setData} />
      <div className="card">
        <h3>Connection</h3>
        <p className="muted">Supabase credentials are stored in this browser only.</p>
        <button
          className="secondary"
          onClick={() => {
            clearConfig();
            onReconnect();
          }}
        >
          Change Supabase connection
        </button>{' '}
        <button className="secondary" onClick={onReload}>
          Reload data
        </button>
      </div>
    </div>
  );
}

function ProgramSettings({ settings, setData }) {
  const [v, setV] = useState({
    days_per_week: settings.days_per_week,
    current_week: settings.current_week,
    rounding: settings.rounding,
    units: settings.units,
    weeks: settings.weeks,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const s = await saveSettings({
        days_per_week: Number(v.days_per_week),
        current_week: Number(v.current_week),
        rounding: Number(v.rounding),
        units: v.units,
        weeks: Number(v.weeks),
      });
      setData((d) => ({ ...d, settings: s }));
      setSaved(true);
    } catch (e) {
      alert(`Save failed: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  function upd(k, val) {
    setV((s) => ({ ...s, [k]: val }));
    setSaved(false);
  }

  return (
    <div className="card">
      <h3>Program</h3>
      <div className="inputs">
        <label>
          Days per week
          <select value={v.days_per_week} onChange={(e) => upd('days_per_week', e.target.value)}>
            {[3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}x
              </option>
            ))}
          </select>
        </label>
        <label>
          Current week
          <input type="number" min="1" max={v.weeks} value={v.current_week} onChange={(e) => upd('current_week', e.target.value)} />
        </label>
        <label>
          Rounding
          <input type="number" step="any" value={v.rounding} onChange={(e) => upd('rounding', e.target.value)} />
        </label>
        <label>
          Units
          <select value={v.units} onChange={(e) => upd('units', e.target.value)}>
            <option value="lbs">lbs</option>
            <option value="kg">kg</option>
          </select>
        </label>
        <label>
          Weeks
          <input type="number" min="1" max="30" value={v.weeks} onChange={(e) => upd('weeks', e.target.value)} />
        </label>
      </div>
      <div className="card-foot">
        <button onClick={save} disabled={saving}>
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save program settings'}
        </button>
      </div>
    </div>
  );
}

function LiftsTable({ lifts, settings, setData }) {
  return (
    <div className="card">
      <h3>Lifts</h3>
      <p className="muted">
        Max is your training max (≈ e1RM). Intensity is the % of TM used for work sets each week.
        Changing a max only affects weeks with no logged results (past TMs are derived from your logs).
      </p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Lift</th>
              <th>Role</th>
              <th>Max ({settings.units})</th>
              <th>Single @8 %</th>
              <th>Set goal</th>
              <th>Intensity</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lifts.map((l) => (
              <LiftRow key={l.id} lift={l} setData={setData} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LiftRow({ lift, setData }) {
  const intensities = Object.values(lift.weekly_intensity || {}).map(Number);
  const uniform = intensities.every((x) => x === intensities[0]);
  const [v, setV] = useState({
    max: lift.max,
    single_at8_pct: lift.single_at8_pct,
    set_goal: lift.set_goal,
    intensity: uniform ? intensities[0] : '',
  });
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  function upd(k, val) {
    setV((s) => ({ ...s, [k]: val }));
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    try {
      const patch = {
        max: Number(v.max),
        single_at8_pct: Number(v.single_at8_pct),
        set_goal: Number(v.set_goal),
      };
      if (v.intensity !== '' && !Number.isNaN(Number(v.intensity))) {
        const wi = {};
        for (const k of Object.keys(lift.weekly_intensity || {})) wi[k] = Number(v.intensity);
        patch.weekly_intensity = wi;
      }
      const row = await saveLift(lift.id, patch);
      setData((d) => ({ ...d, lifts: d.lifts.map((x) => (x.id === row.id ? row : x)) }));
      setDirty(false);
    } catch (e) {
      alert(`Save failed: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr>
      <td>{lift.name}</td>
      <td className="muted">{lift.role}</td>
      <td>
        <input type="number" step="any" value={v.max} onChange={(e) => upd('max', e.target.value)} />
      </td>
      <td>
        <input type="number" step="any" value={v.single_at8_pct} onChange={(e) => upd('single_at8_pct', e.target.value)} />
      </td>
      <td>
        <input type="number" value={v.set_goal} onChange={(e) => upd('set_goal', e.target.value)} />
      </td>
      <td>
        <input
          type="number"
          step="any"
          value={v.intensity}
          placeholder={uniform ? '' : 'varies'}
          onChange={(e) => upd('intensity', e.target.value)}
        />
      </td>
      <td>
        <button className="small" onClick={save} disabled={saving || !dirty}>
          {saving ? '…' : 'Save'}
        </button>
      </td>
    </tr>
  );
}

const ADJ_FIELDS = [
  ['minus2plus', '2+ fewer sets'],
  ['minus1_or_lowRIR', '1 fewer set / RIR below target'],
  ['at_target', 'Hit target'],
  ['plus1', '+1 RIR'],
  ['plus2', '+2 RIR'],
  ['plus3', '+3 RIR'],
  ['plus4', '+4 RIR'],
  ['plus5', '+5 RIR'],
];

function ProgressionTable({ lifts, setData }) {
  const shared = lifts[0]?.adj || {};
  const [v, setV] = useState(Object.fromEntries(ADJ_FIELDS.map(([k]) => [k, shared[k]])));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function saveAll() {
    setSaving(true);
    try {
      const adj = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, Number(x)]));
      const updated = [];
      for (const l of lifts) {
        updated.push(await saveLift(l.id, { adj: { ...l.adj, ...adj } }));
      }
      setData((d) => ({ ...d, lifts: updated }));
      setSaved(true);
    } catch (e) {
      alert(`Save failed: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <h3>Weekly TM adjustment</h3>
      <p className="muted">
        Applied to next week's training max based on this week's result. Values are fractions
        (−0.05 = −5%). Applies to all lifts.
      </p>
      <div className="inputs wrap">
        {ADJ_FIELDS.map(([k, label]) => (
          <label key={k}>
            {label}
            <input
              type="number"
              step="0.01"
              value={v[k]}
              onChange={(e) => {
                setV((s) => ({ ...s, [k]: e.target.value }));
                setSaved(false);
              }}
            />
          </label>
        ))}
      </div>
      <div className="card-foot">
        <button onClick={saveAll} disabled={saving}>
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save adjustments'}
        </button>
      </div>
    </div>
  );
}

function TargetTables({ lifts, setData }) {
  const repT = lifts[0]?.rep_targets || {};
  const rirT = lifts[0]?.rir_targets || {};
  const keys = useMemo(
    () => Object.keys(repT).sort((a, b) => Number(a) - Number(b)),
    [repT]
  );
  const [reps, setReps] = useState({ ...repT });
  const [rirs, setRirs] = useState({ ...rirT });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function saveAll() {
    setSaving(true);
    try {
      const rep = Object.fromEntries(Object.entries(reps).map(([k, x]) => [k, Number(x)]));
      const rir = Object.fromEntries(Object.entries(rirs).map(([k, x]) => [k, Number(x)]));
      const updated = [];
      for (const l of lifts) {
        updated.push(await saveLift(l.id, { rep_targets: rep, rir_targets: rir }));
      }
      setData((d) => ({ ...d, lifts: updated }));
      setSaved(true);
    } catch (e) {
      alert(`Save failed: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <h3>Targets by intensity</h3>
      <p className="muted">Reps per set and last-set RIR target for each intensity. Applies to all lifts.</p>
      <div className="table-scroll">
        <table className="targets">
          <thead>
            <tr>
              <th>Intensity</th>
              {keys.map((k) => (
                <th key={k}>{(Number(k) * 100).toFixed(1).replace(/\.0$/, '')}%</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Reps/set</td>
              {keys.map((k) => (
                <td key={k}>
                  <input
                    type="number"
                    value={reps[k]}
                    onChange={(e) => {
                      setReps((s) => ({ ...s, [k]: e.target.value }));
                      setSaved(false);
                    }}
                  />
                </td>
              ))}
            </tr>
            <tr>
              <td>RIR target</td>
              {keys.map((k) => (
                <td key={k}>
                  <input
                    type="number"
                    value={rirs[k]}
                    onChange={(e) => {
                      setRirs((s) => ({ ...s, [k]: e.target.value }));
                      setSaved(false);
                    }}
                  />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <div className="card-foot">
        <button onClick={saveAll} disabled={saving}>
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save targets'}
        </button>
      </div>
    </div>
  );
}

function ResetCard({ data, setData }) {
  const { settings, lifts, programDays, logs, accessories } = data;
  const variant = settings.days_per_week;
  const [arm, setArm] = useState(false);
  const [busy, setBusy] = useState(false);

  const currentWeek = useMemo(
    () => detectCurrentWeek({ logs, variant, programDays, settings }),
    [logs, variant, programDays, settings]
  );
  const newMaxes = useMemo(
    () =>
      lifts.map((l) => {
        const plan = planForLift(l, logs, variant, settings);
        const tm = plan[currentWeek - 1].tm;
        return { id: l.id, name: l.name, oldMax: Number(l.max), max: Math.round(tm * 100) / 100 };
      }),
    [lifts, logs, variant, settings, currentWeek]
  );

  function downloadBackup() {
    const backup = {
      exported_at: new Date().toISOString(),
      settings, lifts, logs, accessories,
    };
    const blob = new Blob([JSON.stringify(backup, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `sbs-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function doReset() {
    setBusy(true);
    try {
      const endingCycle = settings.cycle ?? 1;
      const snapshotMaxes = Object.fromEntries(lifts.map((l) => [l.id, Number(l.max)]));
      const s = await resetProgram({
        endingCycle,
        snapshotMaxes,
        newMaxes: newMaxes.map(({ id, max }) => ({ id, max })),
      });
      setData((d) => ({
        ...d,
        settings: s,
        lifts: d.lifts.map((l) => {
          const nm = newMaxes.find((x) => x.id === l.id);
          return nm ? { ...l, max: nm.max } : l;
        }),
        cycles: [
          ...(d.cycles || []).filter((c) => c.cycle !== endingCycle),
          { cycle: endingCycle, maxes: snapshotMaxes, ended_at: new Date().toISOString() },
        ],
      }));
      setArm(false);
    } catch (e) {
      alert(`Reset failed: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card reset-card">
      <h3>Restart program</h3>
      <p className="muted">
        Start cycle {(settings.cycle ?? 1) + 1} at week 1, carrying your current training
        maxes over as the new starting maxes. Nothing is deleted — this cycle's history is
        archived and stays browsable in Progress.
      </p>
      {!arm ? (
        <button className="secondary" onClick={() => setArm(true)}>Restart at week 1…</button>
      ) : (
        <>
          <div className="table-scroll">
            <table>
              <thead>
                <tr><th>Lift</th><th>Old max</th><th>New max ({settings.units})</th></tr>
              </thead>
              <tbody>
                {newMaxes.map((m) => (
                  <tr key={m.id}>
                    <td>{m.name}</td>
                    <td className="muted">{m.oldMax}</td>
                    <td><strong>{m.max}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted" style={{ marginTop: 10 }}>
            Cycle {settings.cycle ?? 1} (through week {currentWeek}) will be archived.
          </p>
          <div className="row">
            <button onClick={doReset} disabled={busy}>
              {busy ? 'Restarting…' : `Start cycle ${(settings.cycle ?? 1) + 1}`}
            </button>
            <button className="secondary" onClick={() => setArm(false)} disabled={busy}>Cancel</button>
          </div>
        </>
      )}
    </div>
  );
}

function WipeCard({ data, setData }) {
  const { settings, logs, accessories, cycles = [], lifts } = data;
  const currentCycle = settings.cycle ?? 1;
  const pastCount = cycles.filter((c) => c.cycle < currentCycle).length;
  const pastLogs = logs.filter((l) => (l.cycle ?? 1) < currentCycle).length;
  const [arm, setArm] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!pastCount && !pastLogs) return null;

  function downloadBackup() {
    const backup = { exported_at: new Date().toISOString(), settings, lifts, cycles, logs, accessories };
    const blob = new Blob([JSON.stringify(backup, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `sbs-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function doWipe() {
    setBusy(true);
    try {
      downloadBackup();
      await wipePastCycles(currentCycle);
      setData((d) => ({
        ...d,
        logs: d.logs.filter((l) => (l.cycle ?? 1) >= currentCycle),
        accessories: d.accessories.filter((a) => (a.cycle ?? 1) >= currentCycle),
        cycles: (d.cycles || []).filter((c) => c.cycle >= currentCycle),
      }));
      setArm(false);
    } catch (e) {
      alert(`Wipe failed: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h3>Past-cycle history</h3>
      <p className="muted">
        {pastCount} archived cycle{pastCount === 1 ? '' : 's'} · {pastLogs} logged workout
        rows. Deleting them frees the Progress cycle list; the active cycle is untouched.
      </p>
      {!arm ? (
        <button className="secondary" onClick={() => setArm(true)}>Delete past cycles…</button>
      ) : (
        <>
          <p className="error">
            This permanently deletes all history from cycles before cycle {currentCycle}. A
            backup file downloads first.
          </p>
          <div className="row">
            <button className="danger" onClick={doWipe} disabled={busy}>
              {busy ? 'Deleting…' : 'Yes — delete past cycles'}
            </button>
            <button className="secondary" onClick={() => setArm(false)} disabled={busy}>Cancel</button>
          </div>
        </>
      )}
    </div>
  );
}

function DayLayout({ programDays, lifts, variant }) {
  const liftById = Object.fromEntries(lifts.map((l) => [l.id, l]));
  const days = new Map();
  for (const pd of programDays.filter((p) => p.variant === variant)) {
    if (!days.has(pd.day)) days.set(pd.day, []);
    days.get(pd.day).push(liftById[pd.lift_id]?.name || '?');
  }
  return (
    <div className="card">
      <h3>Day layout ({variant}x)</h3>
      <div className="day-layout">
        {[...days.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([d, names]) => (
            <div key={d}>
              <strong>Day {d}</strong>
              <ul>
                {names.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </div>
          ))}
      </div>
    </div>
  );
}
