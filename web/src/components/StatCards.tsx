export interface StatCard {
  label: string;
  value: string | number;
  tone?: 'high' | 'medium' | 'low' | 'default';
}

export function StatCards({ stats }: { stats: StatCard[] }) {
  return (
    <div className="stat-cards">
      {stats.map((s) => (
        <div key={s.label} className={`stat-card${s.tone ? ` stat-${s.tone}` : ''}`}>
          <div className="stat-value">{s.value}</div>
          <div className="stat-label">{s.label}</div>
        </div>
      ))}
    </div>
  );
}
