import { computeLiftPlan, nextTM, lookupByIntensity, mround } from './engine.js';

// Build the engine's program params from a lifts-table row.
export function programFromLift(lift, settings) {
  return {
    weeks: settings.weeks,
    rounding: Number(settings.rounding),
    weeklyIntensity: numMap(lift.weekly_intensity),
    repTargets: lift.rep_targets,
    rirTargets: lift.rir_targets,
    adjustments: { sets: Number(lift.set_goal), ...numMap(lift.adj) },
  };
}

// logs: all log rows; returns {week: {...}} for one lift in one variant+cycle
export function logsForLift(logs, variant, liftId, cycle = 1) {
  const out = {};
  for (const l of logs) {
    if (l.variant === variant && l.lift_id === liftId && (l.cycle ?? 1) === cycle) {
      out[l.week] = {
        setsCompleted: nn(l.sets_completed),
        rirLastSet: nn(l.rir_last_set),
        singleAt8: nn(l.single_at8),
        video: l.video,
        notes: l.notes,
      };
    }
  }
  return out;
}

export function planForLift(lift, logs, variant, settings, cycle = settings.cycle ?? 1) {
  const program = programFromLift(lift, settings);
  const logsByWeek = logsForLift(logs, variant, lift.id, cycle);
  return computeLiftPlan(
    { ...lift, max: Number(lift.max), single_at8_pct: Number(lift.single_at8_pct) },
    logsByWeek,
    program
  );
}

// Preview next week's TM given this week's (possibly unsaved) inputs.
export function previewNextTM(weekEntry, lift, settings) {
  const program = programFromLift(lift, settings);
  const tm = nextTM(
    weekEntry.tm,
    { setsCompleted: weekEntry.log.setsCompleted, rirLastSet: weekEntry.log.rirLastSet },
    { setGoal: weekEntry.setGoal, rirTarget: weekEntry.rirTarget },
    program.adjustments
  );
  return tm;
}

export { lookupByIntensity, mround };

function numMap(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) out[k] = Number(v);
  return out;
}

function nn(v) {
  return v === null || v === undefined || v === '' ? null : Number(v);
}

// Derive the current program week from workout timestamps.
// Rule: take the most recently saved log's week; if that week's full session
// list is logged, or the last save was over 7 days ago, you're on the next week.
// settings.current_week acts as a floor (covers the initial spreadsheet import).
export function detectCurrentWeek({ logs, variant, programDays, settings, now = Date.now() }) {
  const cycle = settings.cycle ?? 1;
  const vlogs = logs.filter(
    (l) => l.variant === variant && (l.cycle ?? 1) === cycle &&
      l.sets_completed !== null && l.sets_completed !== undefined && l.updated_at
  );
  const floor = settings.current_week || 1;
  if (!vlogs.length) return Math.min(floor, settings.weeks);
  const last = vlogs.reduce((a, b) => (new Date(a.updated_at) > new Date(b.updated_at) ? a : b));
  let wk = last.week;
  const ageDays = (now - new Date(last.updated_at).getTime()) / 86400000;
  const pds = programDays.filter((p) => p.variant === variant);
  const complete =
    pds.length > 0 &&
    pds.every((pd) =>
      vlogs.some((l) => l.week === wk && l.day === pd.day && l.lift_id === pd.lift_id)
    );
  if (ageDays > 7 || complete) wk += 1;
  return Math.min(Math.max(wk, floor), settings.weeks);
}
