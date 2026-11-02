import { dueReviews, SESSION_LENGTH, weeklyTarget, type AppState } from '../lib/store';
import { focusSkills, mastery, PUZZLES } from '../lib/trainer';
import { SKILL_BY_ID } from '../lib/skills';
import { Trend } from '../components/Trend';

interface Props {
  state: AppState;
  go: (to: { mode: 'session' | 'review' | 'skill' | 'ladder'; skill?: string }) => void;
}

export function Home({ state, go }: Props) {
  const r = Math.round(state.ratings.tactics.r);
  const rd = Math.round(state.ratings.tactics.rd);
  const target = weeklyTarget(state);
  const start = state.week.startRating;
  const pct = Math.max(0, Math.min(1, (r - start) / Math.max(1, target - start)));
  const due = dueReviews(state).length;
  const focus = focusSkills(state);
  const sessionDone = state.day.done >= SESSION_LENGTH;
  const recent = state.recent.length ? `${state.recent.filter(Boolean).length} of ${state.recent.length}` : 'no puzzles yet';
  const dial = state.offset;
  const date = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <section className="home">
      <div className="hero">
        <div>
          <p className="eyebrow">{date}</p>
          <h1 className="rating tabular">
            {r}
            <span className="rd">±{rd}</span>
          </h1>
          <p className="muted">Tactical vision rating{state.streak.days > 1 ? ` · ${state.streak.days}-day streak` : ''}</p>
        </div>
        <Trend points={state.hist} />
      </div>

      <div className="grid">
        <article className="card today">
          <p className="eyebrow">Today</p>
          <h3>{sessionDone ? 'Session complete' : `Daily session · ${SESSION_LENGTH} puzzles`}</h3>
          <div className="pips" aria-label={`${state.day.done} of ${SESSION_LENGTH} done`}>
            {Array.from({ length: SESSION_LENGTH }, (_, i) => (
              <span key={i} className={i < state.day.done ? 'on' : ''} />
            ))}
          </div>
          <p className="muted small">Reviews of past misses, your weakest skills, and mixed tactics, all pitched just above your level.</p>
          <button className="btn primary" onClick={() => go({ mode: 'session' })}>
            {sessionDone ? 'Keep going' : state.day.done ? 'Continue session' : 'Start session'}
          </button>
        </article>

        <article className="card week">
          <p className="eyebrow">This week’s 1%</p>
          <h3 className="tabular">
            {start} → {target}
          </h3>
          <div className="bar" role="progressbar" aria-valuenow={Math.round(pct * 100)} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${pct * 100}%` }} />
          </div>
          <p className="muted small tabular">
            {r >= target ? 'Target reached. Next week’s target will be 1% higher again.' : `${target - r} points to go. Now ${r}.`}
          </p>
        </article>

        <article className="card focus">
          <p className="eyebrow">Focus skills</p>
          <ul className="skill-list">
            {focus.map((id) => (
              <li key={id}>
                <button className="skill-row" onClick={() => go({ mode: 'skill', skill: id })}>
                  <span>
                    <strong>{SKILL_BY_ID[id].name}</strong>
                    <span className="muted small"> · {mastery(state, id)}</span>
                  </span>
                  <span className="tabular">{Math.round(state.ratings[id].r)}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="muted small">Ranked by how far each sits below your overall rating, and how sure the app is about it.</p>
        </article>

        <article className="card">
          <p className="eyebrow">Reviews</p>
          <h3>{due ? `${due} due` : 'All caught up'}</h3>
          <p className="muted small">Every puzzle you miss comes back on a spaced schedule until it sticks.</p>
          <button className="btn" disabled={!due} onClick={() => go({ mode: 'review' })}>
            Review now
          </button>
        </article>

        <article className="card">
          <p className="eyebrow">Difficulty dial</p>
          <h3 className="tabular">{dial === 0 ? 'At your rating' : `${Math.abs(dial)} ${dial < 0 ? 'below' : 'above'} your rating`}</h3>
          <p className="muted small">Last 10 solved: {recent}. Over 90% and puzzles get harder; under 70% and they ease off. The aim is about 80%.</p>
        </article>

        <article className="card">
          <p className="eyebrow">Ladder sprint</p>
          <h3>Best rung: {state.ladderBest}</h3>
          <p className="muted small">Five minutes, climbing in difficulty with every puzzle you solve.</p>
          <button className="btn" onClick={() => go({ mode: 'ladder' })}>
            Start a sprint
          </button>
        </article>
      </div>
      <p className="footnote muted small">
        Prototype · {PUZZLES.length} puzzles generated and checked with Stockfish · Progress is saved in this browser only.
      </p>
    </section>
  );
}
