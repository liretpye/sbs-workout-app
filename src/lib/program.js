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

// logs: all log rows; returns {week: {...}} for one lift in one variant
export function logsForLift(logs, variant, liftId) {
  const out = {};
  for (const l of logs) {
    if (l.variant === variant && l.lift_id === liftId) {
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

export function planForLift(lift, logs, variant, settings) {
  const program = programFromLift(lift, settings);
  const logsByWeek = logsForLift(logs, variant, lift.id);
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
