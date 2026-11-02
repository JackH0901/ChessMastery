import type { AppState } from './store';
import { dueReviews } from './store';
import { SKILLS, skillsForThemes, SKILL_BY_ID } from './skills';
import type { Puzzle } from './types';
import raw from '../data/puzzles.json';

export const PUZZLES = raw as Puzzle[];
export const PUZZLE_BY_ID: Record<string, Puzzle> = Object.fromEntries(PUZZLES.map((p) => [p.id, p]));

const BY_SKILL: Record<string, Puzzle[]> = {};
for (const p of PUZZLES) for (const id of skillsForThemes(p.themes)) (BY_SKILL[id] ??= []).push(p);
export const puzzleCount = (skill: string) => BY_SKILL[skill]?.length ?? 0;

/** Higher = more in need of work. Uncertain skills get a bonus so they get tested. */
export function weakness(s: AppState, id: string): number {
  const base = s.ratings.tactics.r;
  const r = s.ratings[id];
  return base - r.r + 0.4 * (r.rd - 100);
}

export function focusSkills(s: AppState, n = 3): string[] {
  return SKILLS.filter((k) => k.id !== 'tactics' && puzzleCount(k.id) >= 8)
    .map((k) => k.id)
    .sort((a, b) => weakness(s, b) - weakness(s, a))
    .slice(0, n);
}

export function targetFor(s: AppState, skill: string) {
  return Math.round(s.ratings[skill].r + s.offset);
}

export function pickPuzzle(s: AppState, skill: string, exclude: Set<string>, target = targetFor(s, skill)): Puzzle {
  const pool = BY_SKILL[skill]?.length ? BY_SKILL[skill] : PUZZLES;
  const week = 7 * 864e5;
  const now = Date.now();
  let cands = pool.filter((p) => !exclude.has(p.id) && !(s.seen[p.id] && now - s.seen[p.id] < week));
  if (cands.length < 6) cands = pool.filter((p) => !exclude.has(p.id));
  if (!cands.length) cands = pool;
  const ranked = [...cands].sort((a, b) => Math.abs(a.rating - target) - Math.abs(b.rating - target));
  const top = ranked.slice(0, 6);
  return top[Math.floor(Math.random() * top.length)];
}

export interface Pick {
  puzzle: Puzzle;
  reason: string;
  kind: 'review' | 'focus' | 'mixed' | 'skill';
}

/** The daily session: reviews of past misses, then work on weak skills, with mixed puzzles in between. */
export function nextForSession(s: AppState, index: number, exclude: Set<string>): Pick {
  const due = dueReviews(s).filter((id) => !exclude.has(id) && PUZZLE_BY_ID[id]);
  if (due.length && index % 3 === 0) {
    return { puzzle: PUZZLE_BY_ID[due[0]], reason: 'Review: you missed this one before', kind: 'review' };
  }
  const focus = focusSkills(s);
  if (focus.length && Math.random() < 0.6) {
    const skill = focus[index % focus.length];
    return { puzzle: pickPuzzle(s, skill, exclude), reason: `Focus: ${SKILL_BY_ID[skill].name}`, kind: 'focus' };
  }
  return { puzzle: pickPuzzle(s, 'tactics', exclude), reason: 'Mixed tactics', kind: 'mixed' };
}

export function nextForSkill(s: AppState, skill: string, exclude: Set<string>): Pick {
  return { puzzle: pickPuzzle(s, skill, exclude), reason: SKILL_BY_ID[skill].name, kind: 'skill' };
}

export function nextReview(s: AppState, exclude: Set<string>): Pick | null {
  const due = dueReviews(s).filter((id) => !exclude.has(id) && PUZZLE_BY_ID[id]);
  if (!due.length) return null;
  return { puzzle: PUZZLE_BY_ID[due[0]], reason: 'Review', kind: 'review' };
}

export type Mastery = 'Unseen' | 'Learning' | 'Practising' | 'Secure' | 'Mastered';

export function mastery(s: AppState, id: string): Mastery {
  const n = s.counts[id]?.n ?? 0;
  const r = s.ratings[id];
  const base = s.ratings.tactics.r;
  if (n === 0) return 'Unseen';
  if (n < 5) return 'Learning';
  if (id !== 'tactics' && r.r >= base + 75 && r.rd < 110) return 'Mastered';
  if (r.r >= base - 50 && r.rd < 140) return 'Secure';
  return 'Practising';
}
