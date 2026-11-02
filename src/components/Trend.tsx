interface Props {
  points: { d: string; r: number }[];
}

/** Small rating trend line. Draws nothing until there are two days of data. */
export function Trend({ points }: Props) {
  if (points.length < 2) {
    return <p className="trend-empty muted small">Your trend line appears after your second day.</p>;
  }
  const w = 220;
  const h = 64;
  const rs = points.map((p) => p.r);
  const lo = Math.min(...rs) - 10;
  const hi = Math.max(...rs) + 10;
  const x = (i: number) => 4 + (i / (points.length - 1)) * (w - 8);
  const y = (r: number) => h - 6 - ((r - lo) / (hi - lo)) * (h - 12);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.r).toFixed(1)}`).join('');
  const last = points.at(-1)!;
  return (
    <svg className="trend" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Rating trend, ${points[0].r} to ${last.r}`}>
      <path d={`${d}L${x(points.length - 1)} ${h}L${x(0)} ${h}Z`} fill="var(--accent)" fillOpacity="0.1" />
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
      <circle cx={x(points.length - 1)} cy={y(last.r)} r="3.5" fill="var(--accent)" />
    </svg>
  );
}
