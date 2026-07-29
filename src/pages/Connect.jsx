import React, { useState } from 'react';
import { getStoredConfig, storeConfig, testConnection, resetClient } from '../lib/supabase.js';

export default function Connect({ onConnected }) {
  const existing = getStoredConfig();
  const [url, setUrl] = useState(existing?.url || '');
  const [key, setKey] = useState(existing?.anonKey || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function connect(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await testConnection(url.trim(), key.trim());
      storeConfig(url.trim(), key.trim());
      resetClient();
      onConnected();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center-screen">
      <form className="card connect-card" onSubmit={connect}>
        <h1>SBS Linear Progression</h1>
        <p className="muted">
          Connect your Supabase project. In the Supabase dashboard go to{' '}
          <strong>Project Settings → API</strong> and copy the Project URL and the{' '}
          <strong>anon public</strong> key. This is stored only in your browser.
        </p>
        <label>
          Project URL
          <input
            type="url"
            placeholder="https://xxxx.supabase.co"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
          />
        </label>
        <label>
          Anon public key
          <input
            type="password"
            placeholder="eyJhbGciOi…"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            required
          />
        </label>
        {error && <p className="error">Connection failed: {error}</p>}
        <button disabled={busy}>{busy ? 'Connecting…' : 'Connect'}</button>
      </form>
    </div>
  );
}
