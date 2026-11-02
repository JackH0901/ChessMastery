import { useEffect, useState } from 'react';
import { load, onboard, rollover, save, type AppState } from './lib/store';
import { Home } from './screens/Home';
import { Runner } from './screens/Runner';
import { Ladder } from './screens/Ladder';
import { Skills } from './screens/Skills';
import { Onboarding } from './screens/Onboarding';

type Tab = 'today' | 'skills';
type Run = { mode: 'session' | 'review' | 'skill' | 'ladder'; skill?: string } | null;

export default function App() {
  const [state, setStateRaw] = useState<AppState>(load);
  const [tab, setTab] = useState<Tab>('today');
  const [run, setRun] = useState<Run>(null);

  const setState = (s: AppState) => setStateRaw(rollover(s));
  useEffect(() => save(state), [state]);

  if (!state.onboarded) return <Shell><Onboarding onPick={(r) => setState(onboard(r))} /></Shell>;

  const exit = () => {
    setRun(null);
    window.scrollTo(0, 0);
  };

  let body;
  if (run?.mode === 'ladder') body = <Ladder state={state} setState={setState} onExit={exit} />;
  else if (run) body = <Runner key={`${run.mode}-${run.skill ?? ''}`} state={state} setState={setState} mode={run.mode} skill={run.skill} onExit={exit} />;
  else if (tab === 'skills') body = <Skills state={state} train={(skill) => setRun({ mode: 'skill', skill })} />;
  else body = <Home state={state} go={setRun} />;

  return (
    <Shell
      nav={
        !run && (
          <nav className="tabs" aria-label="Sections">
            <button className={tab === 'today' ? 'on' : ''} onClick={() => setTab('today')}>Today</button>
            <button className={tab === 'skills' ? 'on' : ''} onClick={() => setTab('skills')}>Skills</button>
          </nav>
        )
      }
    >
      {body}
    </Shell>
  );
}

function Shell({ children, nav }: { children: React.ReactNode; nav?: React.ReactNode }) {
  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <rect x="2" y="2" width="10" height="10" rx="2" fill="var(--sq-dark)" />
            <rect x="12" y="12" width="10" height="10" rx="2" fill="var(--sq-dark)" />
            <rect x="12" y="2" width="10" height="10" rx="2" fill="var(--sq-light)" />
            <rect x="2" y="12" width="10" height="10" rx="2" fill="var(--sq-light)" />
            <path d="M17 6.5v-0.5M15 9.5h4" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Chess Mastery
        </span>
        {nav}
      </header>
      <main>{children}</main>
    </div>
  );
}
