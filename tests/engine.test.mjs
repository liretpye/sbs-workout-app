// Verifies the JS progression engine reproduces the original spreadsheet's
// computed training maxes and weights for every logged lift-week (3x and 5x tabs).
// Run: node tests/engine.test.mjs
import { readFileSync } from 'fs';
import { computeLiftPlan } from '../src/lib/engine.js';

const ext = JSON.parse(readFileSync(new URL('./extracted.json', import.meta.url), 'utf8'));
const verify = JSON.parse(readFileSync(new URL('./verify_data.json', import.meta.url), 'utf8'));
const liftByName = Object.fromEntries(ext.lifts.map((l) => [l.name, l]));

let checked = 0;
const mismatches = [];
for (const variant of ['3x', '5x']) {
  const v = ext.variants[variant];
  for (const d of v.days) {
    for (const lf of d.lifts) {
      const lift = liftByName[lf.name];
      const logs = {};
      for (const h of v.history) {
        if (h.day === d.day && h.lift === lf.name) {
          logs[h.week] = {
            setsCompleted: h.sets_completed === null ? null : Number(h.sets_completed),
            rirLastSet: h.rir_last_set === null ? null : Number(h.rir_last_set),
            singleAt8: h.single_at8 === null ? null : Number(h.single_at8),
          };
        }
      }
      const program = {
        weeks: 21,
        rounding: Number(ext.config.rounding),
        weeklyIntensity: Object.fromEntries(
          Object.entries(ext.weekly_intensity[lf.name]).map(([k, x]) => [k, Number(x)])
        ),
        repTargets: ext.rep_targets[lf.name],
        rirTargets: ext.rir_targets[lf.name],
        adjustments: Object.fromEntries(
          Object.entries(ext.adjustments[lf.name]).map(([k, x]) => [k, Number(x)])
        ),
      };
      const plan = computeLiftPlan(
        { ...lift, max: Number(lift.max), single_at8_pct: Number(lift.single_at8_pct) },
        logs,
        program
      );
      for (const row of verify.filter(
        (r) => r.variant === variant && r.day === d.day && r.lift === lf.name
      )) {
        const p = plan[row.week - 1];
        checked++;
        if (
          Math.abs(p.tm - Number(row.tm)) > 1e-6 ||
          Math.abs(p.weight - Number(row.weight)) > 1e-6 ||
          Number(row.reps) !== p.repsPerSet ||
          Number(row.set_goal) !== p.setGoal ||
          Number(row.rir_target) !== p.rirTarget
        ) {
          mismatches.push({ variant, day: d.day, lift: lf.name, week: row.week, got: p, want: row });
        }
      }
    }
  }
}
console.log(`checked ${checked} lift-weeks, mismatches: ${mismatches.length}`);
if (mismatches.length) {
  console.log(JSON.stringify(mismatches.slice(0, 5), null, 2));
  process.exit(1);
}
