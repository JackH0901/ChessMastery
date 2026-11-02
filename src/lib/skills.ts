export type Domain = 'Tactics' | 'Calculation' | 'Endgames' | 'Openings';

export interface Skill {
  id: string;
  name: string;
  domain: Domain;
  blurb: string;
  /** Puzzle themes that count as evidence for this skill. */
  themes: string[];
}

// Phase 0 covers the skills that tactics puzzles can measure.
// Strategy, endgame technique and practical play arrive with lessons and game analysis.
export const SKILLS: Skill[] = [
  { id: 'tactics', name: 'Tactical vision', domain: 'Tactics', blurb: 'Your overall puzzle strength.', themes: [] },
  { id: 'loose-pieces', name: 'Loose pieces', domain: 'Tactics', blurb: 'Spotting and grabbing undefended material.', themes: ['hangingPiece'] },
  { id: 'forks', name: 'Forks', domain: 'Tactics', blurb: 'One piece attacking two targets at once.', themes: ['fork'] },
  { id: 'pins', name: 'Pins', domain: 'Tactics', blurb: 'Pinning a piece to its king and exploiting it.', themes: ['pin'] },
  { id: 'discovered', name: 'Discovered attacks', domain: 'Tactics', blurb: 'Moving one piece to unleash another.', themes: ['discoveredAttack'] },
  { id: 'sacrifices', name: 'Sacrifices', domain: 'Tactics', blurb: 'Giving material to win more back.', themes: ['sacrifice'] },
  { id: 'mating', name: 'Mating patterns', domain: 'Tactics', blurb: 'Forcing checkmate.', themes: ['mate'] },
  { id: 'back-rank', name: 'Back rank', domain: 'Tactics', blurb: 'Mates against a king trapped by its own pawns.', themes: ['backRankMate'] },
  { id: 'quiet-moves', name: 'Quiet moves', domain: 'Calculation', blurb: 'Winning moves that are not a check or capture.', themes: ['quietMove'] },
  { id: 'depth', name: 'Calculation depth', domain: 'Calculation', blurb: 'Lines of three or more of your own moves.', themes: ['long'] },
  { id: 'promotion', name: 'Promotion', domain: 'Endgames', blurb: 'Pushing a pawn through to queen.', themes: ['promotion'] },
  { id: 'endgame-tactics', name: 'Endgame tactics', domain: 'Endgames', blurb: 'Tactics with few pieces left.', themes: ['endgame'] },
  { id: 'opening-tactics', name: 'Opening traps', domain: 'Openings', blurb: 'Punishing early mistakes.', themes: ['opening'] },
];

export const SKILL_BY_ID: Record<string, Skill> = Object.fromEntries(SKILLS.map((s) => [s.id, s]));

export function skillsForThemes(themes: string[]): string[] {
  const out = ['tactics'];
  for (const s of SKILLS) {
    if (s.themes.some((t) => themes.includes(t))) out.push(s.id);
  }
  return out;
}

export const THEME_LABEL: Record<string, string> = {
  hangingPiece: 'Loose piece',
  fork: 'Fork',
  pin: 'Pin',
  discoveredAttack: 'Discovered attack',
  sacrifice: 'Sacrifice',
  mate: 'Mate',
  mateIn1: 'Mate in 1',
  mateIn2: 'Mate in 2',
  mateIn3: 'Mate in 3',
  mateIn4: 'Mate in 4',
  backRankMate: 'Back-rank mate',
  quietMove: 'Quiet move',
  long: 'Long line',
  short: 'Two moves',
  oneMove: 'One move',
  promotion: 'Promotion',
  endgame: 'Endgame',
  middlegame: 'Middlegame',
  opening: 'Opening',
};
