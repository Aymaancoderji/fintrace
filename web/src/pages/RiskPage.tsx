import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listTopRisk } from '../api/endpoints';
import { RiskScore } from '../api/types';
import { ApiError } from '../api/client';
import { EmptyState, ErrorMessage, Loading } from '../components/StatusMessage';
import { ScoreBadge } from '../components/ScoreBadge';
import { StatCards } from '../components/StatCards';

export function RiskPage() {
  const [scores, setScores] = useState<RiskScore[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listTopRisk(50)
      .then((res) => setScores(res.scores))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load risk scores.'));
  }, []);

  return (
    <div>
      <h1>Top risk accounts</h1>

      {scores && scores.length > 0 && (
        <StatCards
          stats={[
            { label: 'Accounts scored', value: scores.length },
            { label: 'High risk (≥0.70)', value: scores.filter((s) => s.score >= 0.7).length, tone: 'high' },
            {
              label: 'Avg score',
              value: (scores.reduce((sum, s) => sum + s.score, 0) / scores.length).toFixed(2)
            }
          ]}
        />
      )}

      {error && <ErrorMessage message={error} />}
      {!error && scores === null && <Loading />}
      {!error && scores !== null && scores.length === 0 && (
        <EmptyState message="No risk scores yet — run detection from the Alerts page first." />
      )}

      {!error && scores && scores.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Account</th>
              <th>Score</th>
              <th>Contributing rules</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {scores.map((s) => (
              <tr key={s.accountId}>
                <td>
                  <Link to={`/accounts/${encodeURIComponent(s.accountId)}/subgraph`}>{s.accountId}</Link>
                </td>
                <td>
                  <ScoreBadge score={s.score} />
                </td>
                <td>
                  {Object.entries(s.contributingRules)
                    .map(([rule, ruleScore]) => `${rule} (${ruleScore.toFixed(2)})`)
                    .join(', ')}
                </td>
                <td>{new Date(s.updatedAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
