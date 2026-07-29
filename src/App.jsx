import React, { useEffect, useState, useCallback } from 'react';
import logo from './assets/logo.png';
import Connect from './pages/Connect.jsx';
import Workout from './pages/Workout.jsx';
import Progress from './pages/Progress.jsx';
import Setup from './pages/Setup.jsx';
import { getStoredConfig } from './lib/supabase.js';
import { loadAll } from './lib/store.js';

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="clock">
      <span className="clock-date">
        {now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
      </span>
      <span className="clock-time">
        {now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
      </span>
    </div>
  );
}

export default function App() {
  const [phase, setPhase] = useState(getStoredConfig() ? 'loading' : 'connect');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('workout');

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const d = await loadAll();
      setData(d);
      setPhase('ready');
    } catch (e) {
      setError(e.message);
      setPhase('error');
    }
  }, []);

  useEffect(() => {
    if (phase === 'loading') refresh();
  }, [phase, refresh]);

  if (phase === 'connect') {
    return <Connect onConnected={() => setPhase('loading')} />;
  }
  if (phase === 'loading') {
    return <div className="center-screen">Loading your program…</div>;
  }
  if (phase === 'error') {
    return (
      <div className="center-screen">
        <div className="card error-card">
          <h2>Couldn't load data</h2>
          <p>{error}</p>
          <p className="muted">
            Make sure you ran <code>schema.sql</code> and <code>seed.sql</code> in your Supabase
            project's SQL editor.
          </p>
          <div className="row">
            <button onClick={() => setPhase('loading')}>Retry</button>
            <button className="secondary" onClick={() => setPhase('connect')}>
              Change connection
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <img className="logo" src={logo} alt="SBS Linear Progression" />
        <Clock />
      </header>
      <nav className="main-nav">
        <button className={tab === 'workout' ? 'active' : ''} onClick={() => setTab('workout')}>
          <span className="nav-icon">🏋️</span>
          Workout
        </button>
        <button className={tab === 'progress' ? 'active' : ''} onClick={() => setTab('progress')}>
          <span className="nav-icon">📈</span>
          Progress
        </button>
        <button className={tab === 'setup' ? 'active' : ''} onClick={() => setTab('setup')}>
          <span className="nav-icon">⚙️</span>
          Setup
        </button>
      </nav>
      {tab === 'workout' ? (
        <Workout data={data} setData={setData} />
      ) : tab === 'progress' ? (
        <Progress data={data} />
      ) : (
        <Setup data={data} setData={setData} onReconnect={() => setPhase('connect')} onReload={refresh} />
      )}
    </div>
  );
}
