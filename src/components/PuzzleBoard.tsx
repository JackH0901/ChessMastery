import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess, type Square } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import type { Puzzle } from '../lib/types';

type Phase = 'intro' | 'play' | 'wrong' | 'solved' | 'shown';

interface Props {
  puzzle: Puzzle;
  /** Called once, when the outcome is final. */
  onResult: (ok: boolean, info: { ms: number; hint: boolean }) => void;
  /** Ladder mode: one wrong move ends the puzzle. */
  oneTry?: boolean;
}

const uciOf = (m: { from: string; to: string; promotion?: string }) => m.from + m.to + (m.promotion ?? '');

export function PuzzleBoard({ puzzle, onResult, oneTry }: Props) {
  const game = useRef(new Chess(puzzle.fen));
  const [fen, setFen] = useState(puzzle.fen);
  const [phase, setPhase] = useState<Phase>('intro');
  const [idx, setIdx] = useState(1);
  const [failed, setFailed] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [usedHint, setUsedHint] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [last, setLast] = useState<[string, string] | null>(null);
  const [flash, setFlash] = useState<'good' | 'bad' | null>(null);
  const started = useRef(0);
  const reported = useRef(false);
  const timers = useRef<number[]>([]);
  const busy = useRef(false);

  const player = useMemo(() => (new Chess(puzzle.fen).turn() === 'w' ? 'b' : 'w'), [puzzle.fen]);
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));

  const apply = (uci: string) => {
    const m = game.current.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    setLast([m.from, m.to]);
    setFen(game.current.fen());
  };

  const report = (ok: boolean) => {
    if (reported.current) return;
    reported.current = true;
    onResult(ok, { ms: Date.now() - started.current, hint: usedHint });
  };

  useEffect(() => {
    later(() => {
      apply(puzzle.moves[0]);
      setPhase('play');
      started.current = Date.now();
    }, 650);
    const t = timers.current;
    return () => t.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const playSolution = (from: number) => {
    setPhase('shown');
    setSelected(null);
    puzzle.moves.slice(from).forEach((mv, i) => later(() => apply(mv), 650 * (i + 1)));
    later(() => report(false), 650 * (puzzle.moves.length - from) + 150);
  };

  const tryMove = (from: string, to: string): boolean => {
    if (phase !== 'play' || busy.current) return false;
    const expected = puzzle.moves[idx];
    const probe = new Chess(game.current.fen());
    let promo: string | undefined;
    const piece = probe.get(from as Square);
    if (piece?.type === 'p' && (to[1] === '8' || to[1] === '1')) {
      promo = expected.slice(0, 4) === from + to && expected[4] ? expected[4] : 'q';
    }
    let mv;
    try {
      mv = probe.move({ from, to, promotion: promo });
    } catch {
      return false;
    }
    setSelected(null);
    setHint(null);
    const uci = uciOf(mv);
    const correct = uci === expected || probe.isCheckmate();
    if (correct) {
      apply(uci);
      setFlash('good');
      later(() => setFlash(null), 500);
      const next = idx + 1;
      if (probe.isCheckmate() || next >= puzzle.moves.length) {
        setPhase('solved');
        report(!failed && !usedHint);
      } else {
        busy.current = true;
        later(() => {
          apply(puzzle.moves[next]);
          busy.current = false;
        }, 380);
        setIdx(next + 1);
      }
      return true;
    }
    // Wrong move: show it, then take it back.
    setFailed(true);
    setFlash('bad');
    apply(uci);
    setPhase('wrong');
    later(() => {
      game.current.undo();
      setFen(game.current.fen());
      setLast(null);
      setFlash(null);
      if (oneTry) playSolution(idx);
      else setPhase('play');
    }, 650);
    return true;
  };

  const legalTargets = useMemo(() => {
    if (!selected) return [] as string[];
    return new Chess(fen).moves({ square: selected as Square, verbose: true }).map((m) => m.to);
  }, [selected, fen]);

  const squareStyles: Record<string, React.CSSProperties> = {};
  if (last) {
    const tint = flash === 'bad' ? 'var(--sq-bad)' : flash === 'good' ? 'var(--sq-good)' : 'var(--sq-last)';
    squareStyles[last[0]] = { background: tint };
    squareStyles[last[1]] = { background: tint };
  }
  if (selected) squareStyles[selected] = { background: 'var(--sq-select)' };
  for (const t of legalTargets) {
    const occupied = !!new Chess(fen).get(t as Square);
    squareStyles[t] = {
      ...squareStyles[t],
      backgroundImage: occupied
        ? 'radial-gradient(circle, transparent 58%, var(--sq-dot) 60%)'
        : 'radial-gradient(circle, var(--sq-dot) 18%, transparent 20%)',
    };
  }
  if (hint) squareStyles[hint] = { ...squareStyles[hint], boxShadow: 'inset 0 0 0 4px var(--accent)' };

  const onSquareClick = ({ square, piece }: { square: string; piece: { pieceType: string } | null }) => {
    if (phase !== 'play' || busy.current) return;
    if (selected && legalTargets.includes(square)) {
      tryMove(selected, square);
      return;
    }
    if (piece && piece.pieceType[0] === player) setSelected(square === selected ? null : square);
    else setSelected(null);
  };

  const sideName = player === 'w' ? 'White' : 'Black';
  const status: Record<Phase, string> = {
    intro: 'Watch your opponent’s move…',
    play: failed ? 'Try again, or show the solution' : idx > 1 ? 'Good. Keep going' : `${sideName} to play. Find the best move`,
    wrong: 'Not that one',
    solved: failed || usedHint ? 'Solved, but not first time' : 'Solved',
    shown: 'Here’s the line',
  };

  return (
    <div className="puzzle">
      <div className={`status status-${phase}${failed && phase === 'play' ? ' status-retry' : ''}`}>
        <span className={`turn-dot ${player === 'w' ? 'white' : 'black'}`} aria-hidden="true" />
        <span>{status[phase]}</span>
      </div>
      <div className="board-wrap">
        <Chessboard
          options={{
            id: `p-${puzzle.id}`,
            position: fen,
            boardOrientation: player === 'w' ? 'white' : 'black',
            animationDurationInMs: 220,
            allowDrawingArrows: true,
            squareStyles,
            darkSquareStyle: { backgroundColor: 'var(--sq-dark)' },
            lightSquareStyle: { backgroundColor: 'var(--sq-light)' },
            darkSquareNotationStyle: { color: 'var(--sq-light)', fontWeight: 600 },
            lightSquareNotationStyle: { color: 'var(--sq-dark)', fontWeight: 600 },
            boardStyle: { borderRadius: '6px', overflow: 'hidden' },
            canDragPiece: ({ piece }) => phase === 'play' && piece.pieceType[0] === player,
            onPieceDrop: ({ sourceSquare, targetSquare }) => (targetSquare ? tryMove(sourceSquare, targetSquare) : false),
            onSquareClick,
          }}
        />
      </div>
      {!oneTry && (
        <div className="puzzle-actions">
          {phase === 'play' && !hint && (
            <button
              className="btn ghost"
              onClick={() => {
                setHint(puzzle.moves[idx].slice(0, 2));
                setUsedHint(true);
              }}
            >
              Hint <span className="muted">(counts as a miss)</span>
            </button>
          )}
          {phase === 'play' && failed && (
            <button className="btn ghost" onClick={() => playSolution(idx)}>
              Show solution
            </button>
          )}
        </div>
      )}
    </div>
  );
}
