"""Generate tactics puzzles by engine self-play with injected human-like errors.

Each puzzle: the position before the opponent's mistake, then the mistake,
then the player's forced winning line (every player move must be clearly best).
Output: JSON lines on stdout.
"""
import chess, chess.engine, random, json, sys, math, hashlib, time

SF = "/usr/games/stockfish"
VAL = {chess.PAWN: 1, chess.KNIGHT: 3, chess.BISHOP: 3, chess.ROOK: 5, chess.QUEEN: 9, chess.KING: 0}
L = chess.engine.Limit


def wc(cp):
    return 2 / (1 + math.exp(-0.00368208 * cp)) - 1


def cp_of(score):
    return score.score(mate_score=100000)


def material(b, colour):
    return sum(VAL[p.piece_type] * (1 if p.color == colour else -1) for p in b.piece_map().values())


def non_pawn(b):
    return sum(VAL[p.piece_type] for p in b.piece_map().values() if p.piece_type not in (chess.PAWN, chess.KING))


def play_game(eng, rng):
    b = chess.Board()
    fens, moves = [], []
    while not b.is_game_over() and b.ply() < 130:
        legal = list(b.legal_moves)
        if b.ply() < 10:
            infos = eng.analyse(b, L(depth=7), multipv=5)
            mv = rng.choice(infos)["pv"][0]
        else:
            r = rng.random()
            if r < 0.03:
                mv = rng.choice(legal)
            elif r < 0.13:
                # Human-like error: the move a shallow search likes best.
                mv = eng.analyse(b, L(depth=rng.choice([1, 2, 3, 4])))["pv"][0]
            elif r < 0.20:
                infos = eng.analyse(b, L(depth=6), multipv=6)
                mv = rng.choice(infos[1:] or infos)["pv"][0]
            else:
                infos = eng.analyse(b, L(depth=7), multipv=2)
                mv = infos[0]["pv"][0] if (len(infos) < 2 or rng.random() < 0.75) else infos[1]["pv"][0]
        fens.append(b.fen())
        moves.append(mv)
        b.push(mv)
    fens.append(b.fen())
    return fens, moves


def unique_best(eng, b, player, depth):
    infos = eng.analyse(b, L(depth=depth), multipv=2)
    s1 = infos[0]["score"].pov(player)
    m1 = infos[0]["pv"][0]
    if len(infos) < 2:
        return m1, s1, True, True  # only legal move
    s2 = infos[1]["score"].pov(player)
    if s1.is_mate() and s1.mate() > 0:
        if s2.is_mate() and s2.mate() > 0 and s2.mate() <= s1.mate() + 1:
            return m1, s1, False, False
        return m1, s1, True, False
    c1, c2 = cp_of(s1), cp_of(s2)
    ok = wc(c1) >= 0.5 and wc(c1) - wc(c2) >= 0.3
    return m1, s1, ok, False


def find_depth(eng, b, m1):
    for d in range(2, 17, 2):
        info = eng.analyse(b, L(depth=d))
        if info["pv"][0] == m1:
            return d
    return 18


def themes_for(start_board, line, player, eng):
    """start_board: position after opponent mistake (player to move). line: player/opp alternating, ends on player."""
    t = set()
    b = start_board.copy()
    m0 = line[0]
    pm = (len(line) + 1) // 2
    t.add({1: "oneMove", 2: "short"}.get(pm, "long"))
    first_capture = b.is_capture(m0)
    first_check = b.gives_check(m0)
    if not first_capture and not first_check:
        t.add("quietMove")
    if first_capture and pm == 1:
        cap_sq = m0.to_square
        if b.is_en_passant(m0) or not b.attackers(not player, cap_sq):
            t.add("hangingPiece")
    start_mat = material(b, player)
    pinned_before = sum(1 for sq, p in b.piece_map().items() if p.color != player and b.is_pinned(not player, sq))
    for i, mv in enumerate(line):
        is_player = i % 2 == 0
        if is_player:
            if mv.promotion:
                t.add("promotion")
            before_attacks = {sq: b.attacks(sq) for sq, p in b.piece_map().items() if p.color == player}
            moving = b.piece_at(mv.from_square)
            b.push(mv)
            # fork: moved piece attacks 2+ valuable targets
            targets = 0
            for sq in b.attacks(mv.to_square):
                p = b.piece_at(sq)
                if p and p.color != player:
                    if p.piece_type == chess.KING or VAL[p.piece_type] > VAL[moving.piece_type] or not b.attackers(not player, sq):
                        if p.piece_type != chess.PAWN:
                            targets += 1
            if targets >= 2 and moving.piece_type != chess.KING:
                t.add("fork")
            # discovered attack: another piece newly hits king/queen/rook
            for sq, p in b.piece_map().items():
                if p.color == player and sq != mv.to_square and p.piece_type in (chess.BISHOP, chess.ROOK, chess.QUEEN):
                    new = b.attacks(sq) & ~before_attacks.get(sq, chess.BB_EMPTY)
                    for tsq in chess.SquareSet(new):
                        tp = b.piece_at(tsq)
                        if tp and tp.color != player and tp.piece_type in (chess.KING, chess.QUEEN, chess.ROOK):
                            t.add("discoveredAttack")
            if i == 0:
                pinned_after = sum(1 for sq, p in b.piece_map().items() if p.color != player and b.is_pinned(not player, sq))
                if pinned_after > pinned_before:
                    t.add("pin")
        else:
            b.push(mv)
            if material(b, player) <= start_mat - 2:
                t.add("sacrifice")
    if b.is_checkmate():
        t.add("mate")
        t.add(f"mateIn{pm}")
        ksq = b.king(not player)
        back = 0 if (not player) == chess.WHITE else 7
        if chess.square_rank(ksq) == back:
            last = b.peek()
            mp = b.piece_at(last.to_square)
            if mp and mp.piece_type in (chess.ROOK, chess.QUEEN) and chess.square_rank(last.to_square) == back:
                t.add("backRankMate")
    np = non_pawn(start_board)
    if start_board.fullmove_number <= 12:
        t.add("opening")
    elif np <= 14:
        t.add("endgame")
    else:
        t.add("middlegame")
    return t, b


def estimate_rating(themes, pm, depth, rng):
    r = 950 + 230 * (pm - 1)
    if "quietMove" in themes:
        r += 220
    if "sacrifice" in themes:
        r += 180
    if "hangingPiece" in themes:
        r -= 200
    if "mateIn1" in themes:
        r -= 150
    r += 30 * max(0, depth - 4)
    r += rng.randint(-60, 60)
    return int(max(500, min(2500, r)))


def scan(eng, fens, moves, rng, seen):
    out = []
    evals = []
    for f in fens:
        b = chess.Board(f)
        if b.is_game_over():
            evals.append(None)
            continue
        info = eng.analyse(b, L(depth=11))
        evals.append(cp_of(info["score"].white()))
    for i, mv in enumerate(moves):
        before, after = evals[i], evals[i + 1]
        if before is None or after is None:
            continue
        bb = chess.Board(fens[i])
        player = not bb.turn  # side to move after the mistake
        sgn = 1 if player == chess.WHITE else -1
        e_before, e_after = before * sgn, after * sgn
        if not (e_before <= 150 and e_after >= 250):
            continue
        if bb.legal_moves.count() < 2:
            continue
        start = chess.Board(fens[i + 1])
        key = start.board_fen()
        if key in seen:
            continue
        b = start.copy()
        line = []
        m1, s1, ok, only = unique_best(eng, b, player, 16)
        if not ok or only:
            continue
        while True:
            line.append(m1)
            b.push(m1)
            if b.is_game_over() or (len(line) + 1) // 2 >= 4:
                break
            reply = eng.analyse(b, L(depth=14))["pv"][0]
            b.push(reply)
            m_next, s_next, ok_next, only_next = unique_best(eng, b, player, 16)
            if not ok_next:
                b.pop()
                break
            line.append(reply)
            m1 = m_next
        # check result: mate, or material gained after opponent's best reply
        end = b.copy()
        if not end.is_checkmate():
            if end.is_game_over():
                continue
            reply = eng.analyse(end, L(depth=12))["pv"][0]
            end.push(reply)
            gain = material(end, player) - material(start, player)
            if gain < 2:
                continue
        themes, _ = themes_for(start, line, player, eng)
        pm = (len(line) + 1) // 2
        depth = find_depth(eng, start, line[0])
        rating = estimate_rating(themes, pm, depth, rng)
        seen.add(key)
        uci = [mv.uci()] + [m.uci() for m in line]
        pid = hashlib.sha1((fens[i] + " ".join(uci)).encode()).hexdigest()[:8]
        out.append({"id": pid, "fen": fens[i], "moves": uci, "rating": rating, "themes": sorted(themes)})
    return out


def main():
    seed = int(sys.argv[1])
    deadline = time.time() + float(sys.argv[2])
    rng = random.Random(seed)
    eng = chess.engine.SimpleEngine.popen_uci(SF)
    eng.configure({"Threads": 1, "Hash": 64})
    seen = set()
    n = 0
    while time.time() < deadline:
        fens, moves = play_game(eng, rng)
        for p in scan(eng, fens, moves, rng, seen):
            print(json.dumps(p), flush=True)
            n += 1
    eng.quit()
    print(f"done {n}", file=sys.stderr)


if __name__ == "__main__":
    main()
