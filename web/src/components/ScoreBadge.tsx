export function ScoreBadge({ score }: { score: number }) {
  const level = score >= 0.7 ? 'high' : score >= 0.35 ? 'medium' : 'low';
  return (
    <span className={`score-badge score-${level}`} title={`Risk score: ${score.toFixed(2)}`}>
      {score.toFixed(2)}
    </span>
  );
}
