interface Props {
  onPick: (level: number) => void;
}

const LEVELS = [
  { r: 800, label: 'New to chess', note: 'I know how the pieces move' },
  { r: 1000, label: 'Under 1000', note: 'Online rapid or blitz' },
  { r: 1300, label: '1000 to 1500', note: 'Comfortable with basic tactics' },
  { r: 1650, label: '1500 to 1800', note: 'Club player' },
  { r: 1950, label: '1800 and up', note: 'Strong club player' },
];

export function Onboarding({ onPick }: Props) {
  return (
    <section className="onboarding">
      <p className="eyebrow">Chess Mastery</p>
      <h1>Train at the edge of your ability, one per cent at a time.</h1>
      <p className="muted">
        Roughly where are you now? This only sets the starting difficulty. Your skill ratings settle within the first 20 or so puzzles.
      </p>
      <div className="levels">
        {LEVELS.map((l) => (
          <button key={l.r} className="level" onClick={() => onPick(l.r)}>
            <strong>{l.label}</strong>
            <span className="muted small">{l.note}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
