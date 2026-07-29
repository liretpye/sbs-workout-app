import { createClient } from '@supabase/supabase-js';

const LS_KEY = 'sbs.supabase.config';

export function getStoredConfig() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return null;
}

export function storeConfig(url, anonKey) {
  localStorage.setItem(LS_KEY, JSON.stringify({ url, anonKey }));
}

export function clearConfig() {
  localStorage.removeItem(LS_KEY);
}

let client = null;

export function getClient() {
  if (client) return client;
  const cfg = getStoredConfig();
  if (!cfg) return null;
  client = createClient(cfg.url, cfg.anonKey);
  return client;
}

export function resetClient() {
  client = null;
}

export async function testConnection(url, anonKey) {
  const c = createClient(url, anonKey);
  const { error } = await c.from('settings').select('id').limit(1);
  if (error) throw new Error(error.message);
  return true;
}
