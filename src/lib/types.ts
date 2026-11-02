export interface Puzzle {
  id: string;
  /** Position before the opponent's mistake. */
  fen: string;
  /** moves[0] is the opponent's mistake; then player, reply, player... (UCI). */
  moves: string[];
  rating: number;
  themes: string[];
}

export type Mode = 'session' | 'skill' | 'review' | 'ladder';
