import { useEffect, useRef, useState } from 'react';
import { PuzzleBoard } from '../components/PuzzleBoard';
import { recordResult, type AppState } from '../lib/store';
import { pickPuzzle } from '../lib/trainer';
import type { Puzzle } from '../lib/types';

const DURATION = 5 * 60;
const STEP = 60;

interface Props {
  state: AppState;
  setState: (s: AppState) => void;
  onExit: () => void;
}

export function Ladder({ state, setState, onExit }: Props) {
  const base = useRef(Math.max(500, Math.round(state.ratings.tactics.r) - 350));
  const used = useRef(new Set<string>());
  const live = useRef(state);
  live.current = state;
  const [running, setRunning] = useState(false);
  const [left, setLeft] = useState(DURATION);
  const [rung, setRung] = useState(0);
  const [best, setBest] = useState(0);
  const [solved, setSolved] = useState(0);
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [count, setCount] = useState(0);
  const over = running && left <= 0;

  const serve = (r: number) => {
    const p = pickPuzzle(live.current, 'tactics', used.current, base.current + r * STEP);
    used.current.add(p.id);
    setPuzzle(p);
    setCount((c) => c + 1);
  };

  useEffect(() => {
    if (!running || over) return;
    const t = window.setInterval(() => setLeft((l) => l - 1), 1000);
    return () => clearInterval(t);
  }, [running, over]);

  useEffect(() => {
    if (over && best > live.current.ladderBest) setState({ ...live.current, ladderBest: best });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [over]);

  const start = () => {
    setRunning(true);
    setLeft(DURATION);
    setRung(0);
    setBest(0);
    setSolved(0);
    used.current.clear();
    serve(0);
  };

  const onResult = (ok: boolean) => {
    setState(recordResult(live.current, puzzle!, ok, 'ladder').state);
    const next = ok ? rung + 1 : Math.max(0, rung - 2);
    if (ok) setSolved((s) => s + 1);
    setRung(next);
    setBest((b) => Math.max(b, next));
    window.setTimeout(() => serve(next), ok ? 250 : 900);
  };

  const mm = `${Math.floor(Math.max(0, left) / 60)}:${String(Math.max(0, left) % 60).padStart(2, '0')}`;

  return (
    <section className="runner">
      <header className="runner-head">
        <button className="btn ghost" onClick={onExit}>← Back</button>
        <h2>Ladder sprint</h2>
        {running && !over && <span className="clock tabular">{mm}</span>}
      </header>
      {!running && (
        <div className="card summary">
          <p className="eyebrow">Five minutes</p>
          <h3>Each puzzle you solve climbs a rung and gets harder. A miss drops you two.</h3>
          <p className="muted">Sprints don’t change your skill ratings, but misses still go into your reviews. Best so far: rung {state.ladderBest}.</p>
          <button className="btn primary" onClick={start}>Start sprint</button>
        </div>
      )}
      {running && over && (
        <div className="card summary">
          <p className="eyebrow">Time</p>
          <h3>Highest rung: {best}</h3>
          <p className="muted">{solved} solved. Rung {best} is roughly a {base.current + best * STEP} puzzle.</p>
          <div className="row">
            <button className="btn primary" onClick={start}>Go again</button>
            <button className="btn ghost" onClick={onExit}>Done</button>
          </div>
        </div>
      )}
      {running && !over && puzzle && (
        <div className="runner-body">
          <PuzzleBoard key={`${puzzle.id}-${count}`} puzzle={puzzle} onResult={onResult} oneTry />
          <aside className="runner-side">
            <div className="card ladder">
              <p className="eyebrow">Rung</p>
              <p className="big-num tabular">{rung}</p>
              <div className="rungs" aria-hidden="true">
                {Array.from({ length: 12 }, (_, i) => 11 - i).map((i) => (
                  <span key={i} className={i < rung ? 'on' : i === rung ? 'here' : ''} />
                ))}
              </div>
              <p className="muted small tabular">Best this sprint: {best} · Solved: {solved}</p>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}
