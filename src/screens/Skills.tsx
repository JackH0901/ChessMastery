import type { AppState } from '../lib/store';
import { SKILLS, type Domain } from '../lib/skills';
import { mastery, puzzleCount } from '../lib/trainer';

interface Props {
  state: AppState;
  train: (skill: string) => void;
}

const DOMAINS: Domain[] = ['Tactics', 'Calculation', 'Endgames', 'Openings'];
const LO = 400;
const HI = 2600;

export function Skills({ state, train }: Props) {
  const base = state.ratings.tactics.r;
  const pos = (r: number) => `${Math.max(0, Math.min(100, ((r - LO) / (HI - LO)) * 100))}%`;
  return (
    <section className="skills">
      <header className="page-head">
        <h2>Skill graph</h2>
        <p className="muted">
          Every puzzle counts as evidence for the skills it tests. The bar shows each rating with its uncertainty; the line marks your overall level.
        </p>
      </header>
      {DOMAINS.map((dom) => (
        <div key={dom} className="domain">
          <h3 className="eyebrow">{dom}</h3>
          <ul>
            {SKILLS.filter((s) => s.domain === dom).map((s) => {
              const r = state.ratings[s.id];
              const c = state.counts[s.id];
              const m = mastery(state, s.id);
              const n = puzzleCount(s.id);
              return (
                <li key={s.id}>
                  <button className="skill-card" onClick={() => train(s.id)} disabled={n < 3}>
                    <div className="skill-top">
                      <span>
                        <strong>{s.name}</strong>
                        <span className={`chip m-${m.toLowerCase()}`}>{m}</span>
                      </span>
                      <span className="tabular">{Math.round(r.r)}</span>
                    </div>
                    <p className="muted small">{s.blurb}</p>
                    <div className="scale" aria-hidden="true">
                      <span className="band" style={{ left: pos(r.r - r.rd), right: `calc(100% - ${pos(r.r + r.rd)})` }} />
                      <span className="dot" style={{ left: pos(r.r) }} />
                      <span className="base" style={{ left: pos(base) }} />
                    </div>
                    <p className="muted small tabular">
                      {c ? `${c.ok} of ${c.n} solved` : 'Not tested yet'} · {n} puzzles
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <p className="muted small footnote">Strategy, endgame technique and practical play join the graph with lessons and game analysis.</p>
    </section>
  );
}
