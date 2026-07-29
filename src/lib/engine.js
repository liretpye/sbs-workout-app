// SBS Linear Progression engine — faithful port of the spreadsheet formulas.

// Excel MROUND: round to nearest multiple, ties away from zero.
export function mround(value, multiple) {
  if (!multiple) return value;
  return Math.round(value / multiple + 1e-9) * multiple;
}

// Look up a value keyed by intensity from a {intensity(4dp-string): value} table,
// mirroring the sheet's nested-if chain: exact match on listed intensities,
// falling through to the last column's value when no match.
export function lookupByIntensity(table, intensity) {
  const keys = Object.keys(table).map(Number).sort((a, b) => a - b);
  for (const k of keys) {
    if (Math.abs(k - intensity) < 1e-6) return tableGet(table, k);
  }
  // fall through: highest intensity column (mirrors the sheet's final else branch)
  return tableGet(table, keys[keys.length - 1]);
}

function tableGet(table, num) {
  // keys were serialized with round(x,4) in Python: e.g. "0.55", "0.5750", "1.0"
  for (const key of Object.keys(table)) {
    if (Math.abs(Number(key) - num) < 1e-6) return table[key];
  }
  return undefined;
}

// One week-over-week TM adjustment, exactly matching the sheet formula order.
// prevLog: { setsCompleted, rirLastSet } (nulls = blank cells)
// prevTargets: { setGoal, rirTarget }
// adj: {minus2plus, minus1_or_lowRIR, at_target, plus1..plus5}
export function nextTM(prevTM, prevLog, prevTargets, adj) {
  const sets = prevLog?.setsCompleted;
  if (sets === null || sets === undefined || sets === '') return prevTM;
  const rir = numOrZero(prevLog.rirLastSet); // blank compares as 0, like Excel
  const goal = prevTargets.setGoal;
  const target = prevTargets.rirTarget;
  const ds = sets - goal;
  if (ds < -1.9) return prevTM * (1 + adj.minus2plus);
  if (ds === -1) return prevTM * (1 + adj.minus1_or_lowRIR);
  if (rir < target) return prevTM * (1 + adj.minus1_or_lowRIR);
  if (rir === target) return prevTM * (1 + adj.at_target);
  const dr = rir - target;
  if (dr === 1) return prevTM * (1 + adj.plus1);
  if (dr === 2) return prevTM * (1 + adj.plus2);
  if (dr === 3) return prevTM * (1 + adj.plus3);
  if (dr === 4) return prevTM * (1 + adj.plus4);
  if (dr > 4.1) return prevTM * (1 + adj.plus5);
  return prevTM;
}

function numOrZero(v) {
  return v === null || v === undefined || v === '' ? 0 : Number(v);
}

// Compute the full 21-week plan for one lift.
// lift: {name, max, single_at8_pct}
// logsByWeek: { [week]: {setsCompleted, rirLastSet, singleAt8, video, notes} }
// program: { weeks, rounding, weeklyIntensity: {week: pct}, repTargets, rirTargets, adjustments: {sets, ...pcts} }
export function computeLiftPlan(lift, logsByWeek, program) {
  const weeks = [];
  const adj = program.adjustments;
  let tm = null;
  for (let w = 1; w <= program.weeks; w++) {
    const log = logsByWeek[w] || {};
    const intensity = program.weeklyIntensity[w];
    const repsPerSet = lookupByIntensity(program.repTargets, intensity);
    const rirTarget = lookupByIntensity(program.rirTargets, intensity);
    const setGoal = adj.sets;

    if (log.singleAt8 !== null && log.singleAt8 !== undefined && log.singleAt8 !== '') {
      tm = Number(log.singleAt8) / lift.single_at8_pct;
    } else if (w === 1) {
      tm = lift.max;
    } else {
      const prev = weeks[w - 2];
      tm = nextTM(prev.tm, {
        setsCompleted: prev.log.setsCompleted,
        rirLastSet: prev.log.rirLastSet,
      }, { setGoal: prev.setGoal, rirTarget: prev.rirTarget }, adj);
    }

    weeks.push({
      week: w,
      tm,
      intensity,
      weight: mround(tm * intensity, program.rounding),
      repsPerSet,
      rirTarget,
      setGoal,
      log,
    });
  }
  return weeks;
}
