import { createEmptyCard, fsrs, Rating as Grade, type Card, type CardInput } from 'ts-fsrs';
import { newRating, update, type Rating } from './glicko';
import { SKILLS, skillsForThemes } from './skills';
import type { Mode, Puzzle } from './types';

export interface Attempt {
  id: string;
  t: number;
  ok: boolean;
  pr: number;
  mode: Mode;
}

export interface AppState {
  v: 1;
  onboarded: boolean;
  ratings: Record<string, Rating>;
  counts: Record<string, { n: number; ok: number }>;
  /** Difficulty dial: puzzles are served at skill rating + offset. */
  offset: number;
  recent: boolean[];
  sinceDial: number;
  attempts: Attempt[];
  seen: Record<string, number>;
  review: Record<string, CardInput>;
  week: { start: string; startRating: number };
  day: { date: string; done: number; ok: number };
  streak: { last: string; days: number };
  ladderBest: number;
  /** End-of-day tactics rating, for the trend line. */
  hist: { d: string; r: number }[];
}

const KEY = 'chess-mastery.v1';
export const SESSION_LENGTH = 15;
export const DIAL_MIN = -400;
export const DIAL_MAX = 150;
const scheduler = fsrs({ enable_short_term: false, request_retention: 0.9 });

export const todayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function mondayKey(d = new Date()) {
  const m = new Date(d);
  const day = (m.getDay() + 6) % 7;
  m.setDate(m.getDate() - day);
  return todayKey(m);
}

export function freshState(base = 1200): AppState {
  const ratings: Record<string, Rating> = {};
  for (const s of SKILLS) ratings[s.id] = newRating(base, s.id === 'tactics' ? 250 : 300);
  return {
    v: 1,
    onboarded: false,
    ratings,
    counts: {},
    offset: -150,
    recent: [],
    sinceDial: 0,
    attempts: [],
    seen: {},
    review: {},
    week: { start: mondayKey(), startRating: base },
    day: { date: todayKey(), done: 0, ok: 0 },
    streak: { last: '', days: 0 },
    ladderBest: 0,
    hist: [],
  };
}

export function load(): AppState {
  let s: AppState | null = null;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) s = JSON.parse(raw) as AppState;
  } catch {
    s = null;
  }
  if (!s || s.v !== 1) s = freshState();
  s.hist ??= [];
  for (const sk of SKILLS) if (!s.ratings[sk.id]) s.ratings[sk.id] = newRating(s.ratings.tactics?.r ?? 1200, 300);
  return rollover(s);
}

export function save(s: AppState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable: the app still works for this visit */
  }
}

/** Start a new day or week when the date has moved on. */
export function rollover(s: AppState): AppState {
  const out = { ...s };
  const today = todayKey();
  if (out.day.date !== today) out.day = { date: today, done: 0, ok: 0 };
  const mon = mondayKey();
  if (out.week.start !== mon) out.week = { start: mon, startRating: Math.round(out.ratings.tactics.r) };
  return out;
}

export function onboard(level: number): AppState {
  const s = freshState(level);
  s.onboarded = true;
  s.hist = [{ d: todayKey(), r: level }];
  return s;
}

export const weeklyTarget = (s: AppState) => Math.round(s.week.startRating * 1.01);

export function dueReviews(s: AppState, now = Date.now()): string[] {
  return Object.entries(s.review)
    .filter(([, c]) => new Date(c.due as string).getTime() <= now)
    .sort((a, b) => new Date(a[1].due as string).getTime() - new Date(b[1].due as string).getTime())
    .map(([id]) => id);
}

export interface ResultSummary {
  deltas: { skill: string; before: number; after: number }[];
  dialChange: number;
}

export function recordResult(prev: AppState, p: Puzzle, ok: boolean, mode: Mode): { state: AppState; summary: ResultSummary } {
  const s: AppState = structuredClone(prev);
  const now = new Date();
  const summary: ResultSummary = { deltas: [], dialChange: 0 };
  const rated = mode !== 'ladder';

  if (rated) {
    for (const id of skillsForThemes(p.themes)) {
      const before = s.ratings[id];
      const after = update(before, p.rating, 80, ok ? 1 : 0);
      s.ratings[id] = after;
      const c = s.counts[id] ?? { n: 0, ok: 0 };
      s.counts[id] = { n: c.n + 1, ok: c.ok + (ok ? 1 : 0) };
      summary.deltas.push({ skill: id, before: before.r, after: after.r });
    }
    // Progressive overload: keep success near 80% by nudging the dial.
    s.recent = [...s.recent, ok].slice(-10);
    s.sinceDial += 1;
    if (s.sinceDial >= 5 && s.recent.length >= 10) {
      const rate = s.recent.filter(Boolean).length / s.recent.length;
      let change = 0;
      if (rate > 0.9) change = 25;
      else if (rate < 0.7) change = -25;
      if (change) {
        const next = Math.max(DIAL_MIN, Math.min(DIAL_MAX, s.offset + change));
        summary.dialChange = next - s.offset;
        s.offset = next;
      }
      s.sinceDial = 0;
    }
    s.day = { ...s.day, done: s.day.done + 1, ok: s.day.ok + (ok ? 1 : 0) };
    const today = todayKey();
    if (s.streak.last !== today) {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      s.streak = { last: today, days: s.streak.last === todayKey(y) ? s.streak.days + 1 : 1 };
    }
  }

  // Spaced repetition for anything missed.
  const existing = s.review[p.id];
  if (!ok) {
    const card: CardInput | Card = existing ?? createEmptyCard(now);
    s.review[p.id] = toStored(scheduler.next(card, now, Grade.Again).card);
  } else if (existing) {
    const next = scheduler.next(existing, now, Grade.Good).card;
    if (next.stability > 40) delete s.review[p.id];
    else s.review[p.id] = toStored(next);
  }

  if (rated) {
    const d = todayKey();
    const r = Math.round(s.ratings.tactics.r);
    s.hist = [...s.hist.filter((h) => h.d !== d), { d, r }].slice(-120);
  }
  s.seen[p.id] = now.getTime();
  s.attempts = [...s.attempts, { id: p.id, t: now.getTime(), ok, pr: p.rating, mode }].slice(-3000);
  return { state: s, summary };
}

function toStored(c: Card): CardInput {
  return { ...c, due: c.due.toISOString(), last_review: c.last_review ? c.last_review.toISOString() : null };
}
