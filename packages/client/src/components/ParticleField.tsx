const particles = [
  ['call', 'particle--one'],
  ['<>', 'particle--two'],
  ['code', 'particle--three'],
  ['/', 'particle--four'],
  ['cc', 'particle--five'],
  ['{ }', 'particle--six'],
  ['call', 'particle--seven'],
  [';', 'particle--eight'],
  ['code', 'particle--nine'],
  ['//', 'particle--ten'],
  ['()', 'particle--eleven'],
  ['cc', 'particle--twelve'],
] as const;

export function ParticleField() {
  return (
    <div className="particle-field" aria-hidden="true">
      {particles.map(([label, className], index) => (
        <span key={`${label}-${index}`} className={`particle ${className}`}>
          {label}
        </span>
      ))}
    </div>
  );
}
