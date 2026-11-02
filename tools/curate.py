"""Merge generated puzzle files into src/data/puzzles.json, de-duplicated and balanced.

Usage: python3 tools/curate.py out_*.jsonl
"""
import json, random, sys

random.seed(7)
seen, ps = set(), []
for path in sys.argv[1:]:
    for line in open(path):
        line = line.strip()
        if not line:
            continue
        p = json.loads(line)
        key = p["fen"].split(" ")[0] + p["moves"][0]
        if key in seen:
            continue
        seen.add(key)
        ps.append(p)

easy = [p for p in ps if "oneMove" in p["themes"] and "hangingPiece" in p["themes"]]
rest = [p for p in ps if p not in easy]
cap = int(0.3 * len(rest) / 0.7)  # easy grabs at most 30% of the set
random.shuffle(easy)
out = rest + easy[:cap]
out.sort(key=lambda p: p["rating"])
json.dump(out, open("src/data/puzzles.json", "w"), separators=(",", ":"))
print(f"{len(ps)} generated, {len(out)} kept ({len(easy)} easy grabs, {min(cap, len(easy))} kept)")
