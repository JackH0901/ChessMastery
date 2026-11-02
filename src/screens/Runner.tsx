import { useMemo, useRef, useState } from 'react';
import { PuzzleBoard } from '../components/PuzzleBoard';
import { recordResult, SESSION_LENGTH, type AppState, type ResultSummary } from '../lib/store';
import { nextForSession, nextForSkill, nextReview, type Pick } from '../lib/trainer';
import { SKILL_BY_ID, THEME_LABEL } from '../lib/skills';
import type { Mode } from '../lib/types';

interface Props {
  state: AppState;
  setState: (s: AppState) => void;
  mode: Exclude<Mode, 'ladder'>;
  skill?: string;
  onExit: () => void;
}

interface Done {
  ok: boolean;
  ms: number;
  summary: ResultSummary;
}

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

export function Runner({ state, setState, mode, skill, onExit }: Props) {
  const startIndex = useRef(mode === 'session' ? state.day.done : 0).current;
  const length = mode === 'session' ? Math.max(1, SESSION_LENGTH - startIndex) : mode === 'review' ? 50 : 10;
  const used = useRef(new Set<string>());
  const startRating = useRef(Math.round(state.ratings.tactics.r));
  const [n, setN] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [done, setDone] = useState<Done | null>(null);

  const choose = (s: AppState, i: number): Pick | null => {
    if (mode === 'session') return nextForSession(s, startIndex + i, used.current);
    if (mode === 'review') return nextReview(s, used.current);
    return nextForSkill(s, skill!, used.current);
  };
  const [pick, setPick] = useState<Pick | null>(() => {
    const p = choose(state, 0);
    if (p) used.current.add(p.puzzle.id);
    return p;
  });

  const onResult = (ok: boolean, info: { ms: number }) => {
    const { state: next, summary } = recordResult(state, pick!.puzzle, ok, mode);
    setState(next);
    setResults((r) => [...r, ok]);
    setDone({ ok, ms: info.ms, summary });
  };

  const advance = () => {
    const i = n + 1;
    if (i >= length) {
      setPick(null);
      setN(i);
      return;
    }
    const p = choose(state, i);
    if (p) used.current.add(p.puzzle.id);
    setPick(p);
    setN(i);
    setDone(null);
  };

  const title = mode === 'session' ? 'Daily session' : mode === 'review' ? 'Review' : SKILL_BY_ID[skill!].name;
  const progress = mode === 'session' ? `Puzzle ${Math.min(startIndex + n + 1, SESSION_LENGTH)} of ${SESSION_LENGTH}` : `${results.length} done`;

  const finished = !pick;
  const solved = results.filter(Boolean).length;
  const ratingNow = Math.round(state.ratings.tactics.r);

  const mainDelta = useMemo(() => done?.summary.deltas.find((d) => d.skill === 'tactics'), [done]);

  if (finished) {
    return (
      <section className="runner">
        <header className="runner-head">
          <button className="btn ghost" onClick={onExit}>← Back</button>
          <h2>{title}</h2>
        </header>
        <div className="card summary">
          <p className="eyebrow">{results.length ? 'Finished' : 'Nothing to do'}</p>
          {results.length ? (
            <>
              <h3>
                {solved} of {results.length} solved first time
              </h3>
              <p className="big-num">
                {ratingNow} <span className={ratingNow - startRating.current >= 0 ? 'up' : 'down'}>{signed(ratingNow - startRating.current)}</span>
              </p>
              <p className="muted">Tactical vision rating after this run.</p>
            </>
          ) : (
            <h3>No reviews are due. Missed puzzles come back here on a schedule.</h3>
          )}
          <button className="btn primary" onClick={onExit}>Done</button>
        </div>
      </section>
    );
  }

  const p = pick!.puzzle;
  return (
    <section className="runner">
      <header className="runner-head">
        <button className="btn ghost" onClick={onExit}>← Back</button>
        <h2>{title}</h2>
        <span className="muted tabular">{progress}</span>
      </header>
      <div className="runner-body">
        <PuzzleBoard key={`${p.id}-${n}`} puzzle={p} onResult={onResult} />
        <aside className="runner-side">
          <div className="card">
            <p className="eyebrow">{pick!.reason}</p>
            <p className="puzzle-rating tabular">Puzzle {p.rating}</p>
            {done ? (
              <div className="themes">
                {p.themes.map((t) => (
                  <span key={t} className="chip">{THEME_LABEL[t] ?? t}</span>
                ))}
              </div>
            ) : (
              <p className="muted small">Themes are revealed after you solve it.</p>
            )}
          </div>
          {done && (
            <div className={`card result ${done.ok ? 'ok' : 'miss'}`}>
              <h3>{done.ok ? 'Solved' : 'Missed'}</h3>
              <p className="muted small tabular">{(done.ms / 1000).toFixed(1)}s</p>
              {mainDelta && (
                <ul className="deltas">
                  {done.summary.deltas.map((d) => (
                    <li key={d.skill}>
                      <span>{SKILL_BY_ID[d.skill].name}</span>
                      <span className={`tabular ${d.after - d.before >= 0 ? 'up' : 'down'}`}>
                        {Math.round(d.after)} ({signed(Math.round(d.after - d.before))})
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {!done.ok && <p className="small">Added to your reviews. It comes back tomorrow.</p>}
              {done.summary.dialChange !== 0 && (
                <p className="small dial-note">
                  {done.summary.dialChange > 0
                    ? 'You’re solving over 90%: puzzles get a little harder.'
                    : 'Under 70% recently: puzzles ease off a little.'}
                </p>
              )}
              <button className="btn primary" onClick={advance} autoFocus>
                Next puzzle
              </button>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
