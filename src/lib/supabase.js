import { createClient } from '@supabase/supabase-js';

const LS_KEY = 'sbs.supabase.config';

const DEFAULT_CONFIG = {
  url: 'https://nyztolzbtfsphbhyjpnv.supabase.co',
  anonKey: 'sb_publishable_cYDS2NUdm9fx1jEjD0jXxA_oc8iIH3z',
};

export function getStoredConfig() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return DEFAULT_CONFIG;
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

// ---------- auth (Sign in with GitHub) ----------

export async function getSession() {
  const { data } = await getClient().auth.getSession();
  return data.session;
}

export function onAuthChange(cb) {
  const { data } = getClient().auth.onAuthStateChange((_event, session) => cb(session));
  return () => data.subscription.unsubscribe();
}

export async function signInWithGitHub() {
  // Return to exactly this page (works on GitHub Pages subpaths and localhost).
  const redirectTo = window.location.origin + window.location.pathname;
  const { error } = await getClient().auth.signInWithOAuth({
    provider: 'github',
    options: { redirectTo },
  });
  if (error) throw new Error(error.message);
}

export async function signOut() {
  await getClient().auth.signOut();
}
