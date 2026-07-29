import { getClient } from './supabase.js';

// Loads everything the app needs in one pass.
export async function loadAll() {
  const sb = getClient();
  const [settings, lifts, programDays, logs, accessories, cycles] = await Promise.all([
    sb.from('settings').select('*').eq('id', 1).single(),
    sb.from('lifts').select('*').order('sort'),
    sb.from('program_days').select('*').order('variant').order('day').order('position'),
    sb.from('logs').select('*'),
    sb.from('accessories').select('*'),
    sb.from('cycles').select('*').order('cycle'),
  ]);
  for (const r of [settings, lifts, programDays, logs, accessories, cycles]) {
    if (r.error) throw new Error(r.error.message);
  }
  return {
    settings: settings.data,
    lifts: lifts.data,
    programDays: programDays.data,
    logs: logs.data,
    accessories: accessories.data,
    cycles: cycles.data,
  };
}

export async function saveSettings(patch) {
  const sb = getClient();
  const { data, error } = await sb.from('settings').update(patch).eq('id', 1).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function saveLift(id, patch) {
  const sb = getClient();
  const { data, error } = await sb.from('lifts').update(patch).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function upsertLog(row) {
  const sb = getClient();
  const { data, error } = await sb
    .from('logs')
    .upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: 'cycle,variant,week,day,lift_id' })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function upsertAccessory(row) {
  const sb = getClient();
  const { data, error } = await sb
    .from('accessories')
    .upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: 'cycle,variant,week,day,slot' })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteAccessory(id) {
  const sb = getClient();
  const { error } = await sb.from('accessories').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// Restart the program: archive the finishing cycle, start the next one at week 1
// with new starting maxes. History is kept, keyed by cycle number.
export async function resetProgram({ endingCycle, snapshotMaxes, newMaxes }) {
  const sb = getClient();
  const ins = await sb.from('cycles').upsert(
    { cycle: endingCycle, maxes: snapshotMaxes, ended_at: new Date().toISOString() },
    { onConflict: 'cycle' }
  );
  if (ins.error) throw new Error(ins.error.message);
  for (const { id, max } of newMaxes) {
    const { error } = await sb.from('lifts').update({ max }).eq('id', id);
    if (error) throw new Error(error.message);
  }
  const { data, error } = await sb.from('settings')
    .update({ current_week: 1, cycle: endingCycle + 1 }).eq('id', 1).select().single();
  if (error) throw new Error(error.message);
  return data;
}

// Permanently delete all past-cycle history (keeps the active cycle untouched).
export async function wipePastCycles(currentCycle) {
  const sb = getClient();
  let r = await sb.from('logs').delete().lt('cycle', currentCycle);
  if (r.error) throw new Error(r.error.message);
  r = await sb.from('accessories').delete().lt('cycle', currentCycle);
  if (r.error) throw new Error(r.error.message);
  r = await sb.from('cycles').delete().lt('cycle', currentCycle);
  if (r.error) throw new Error(r.error.message);
}
