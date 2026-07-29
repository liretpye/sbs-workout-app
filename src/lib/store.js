import { getClient } from './supabase.js';

// Loads everything the app needs in one pass.
export async function loadAll() {
  const sb = getClient();
  const [settings, lifts, programDays, logs, accessories] = await Promise.all([
    sb.from('settings').select('*').eq('id', 1).single(),
    sb.from('lifts').select('*').order('sort'),
    sb.from('program_days').select('*').order('variant').order('day').order('position'),
    sb.from('logs').select('*'),
    sb.from('accessories').select('*'),
  ]);
  for (const r of [settings, lifts, programDays, logs, accessories]) {
    if (r.error) throw new Error(r.error.message);
  }
  return {
    settings: settings.data,
    lifts: lifts.data,
    programDays: programDays.data,
    logs: logs.data,
    accessories: accessories.data,
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
    .upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: 'variant,week,day,lift_id' })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function upsertAccessory(row) {
  const sb = getClient();
  const { data, error } = await sb
    .from('accessories')
    .upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: 'variant,week,day,slot' })
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
