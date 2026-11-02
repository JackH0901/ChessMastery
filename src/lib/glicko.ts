// Glicko-2 rating for a single result against a puzzle (or opponent).
export interface Rating {
  r: number;
  rd: number;
  vol: number;
}

const SCALE = 173.7178;
const TAU = 0.5;
export const RD_FLOOR = 50;

export const newRating = (r = 1200, rd = 300): Rating => ({ r, rd, vol: 0.06 });

const g = (phi: number) => 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));

/** Probability that a player rated `r` solves a puzzle rated `opp`. */
export function expected(r: number, rd: number, opp: number, oppRd = 80): number {
  const phi = Math.sqrt(rd * rd + oppRd * oppRd) / SCALE;
  return 1 / (1 + Math.exp(-g(phi) * ((r - opp) / SCALE)));
}

export function update(p: Rating, oppR: number, oppRd: number, score: number): Rating {
  const mu = (p.r - 1500) / SCALE;
  const phi = p.rd / SCALE;
  const muJ = (oppR - 1500) / SCALE;
  const gJ = g(oppRd / SCALE);
  const E = 1 / (1 + Math.exp(-gJ * (mu - muJ)));
  const v = 1 / (gJ * gJ * E * (1 - E));
  const delta = v * gJ * (score - E);

  const a = Math.log(p.vol * p.vol);
  const f = (x: number) => {
    const ex = Math.exp(x);
    return (ex * (delta * delta - phi * phi - v - ex)) / (2 * (phi * phi + v + ex) ** 2) - (x - a) / (TAU * TAU);
  };
  let A = a;
  let B: number;
  if (delta * delta > phi * phi + v) {
    B = Math.log(delta * delta - phi * phi - v);
  } else {
    let k = 1;
    while (f(a - k * TAU) < 0 && k < 50) k++;
    B = a - k * TAU;
  }
  let fA = f(A);
  let fB = f(B);
  for (let i = 0; i < 100 && Math.abs(B - A) > 1e-6; i++) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else {
      fA = fA / 2;
    }
    B = C;
    fB = fC;
  }
  const vol = Math.exp(A / 2);
  const phiStar = Math.sqrt(phi * phi + vol * vol);
  const phiNew = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const muNew = mu + phiNew * phiNew * gJ * (score - E);
  return {
    r: muNew * SCALE + 1500,
    rd: Math.min(350, Math.max(RD_FLOOR, phiNew * SCALE)),
    vol: Math.min(0.15, vol),
  };
}
