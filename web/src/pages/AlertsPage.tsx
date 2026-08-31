import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listAlerts, runDetection } from '../api/endpoints';
import { Alert } from '../api/types';
import { ApiError } from '../api/client';
import { EmptyState, ErrorMessage, Loading } from '../components/StatusMessage';
import { ScoreBadge } from '../components/ScoreBadge';
import { StatCards } from '../components/StatCards';

const RULES = ['structuring', 'cycle', 'fan-in-fan-out', 'mule-network'];
const PAGE_SIZE = 25;

export function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rule, setRule] = useState<string>('');
  const [offset, setOffset] = useState(0);
  const [running, setRunning] = useState(false);
  const [runSummary, setRunSummary] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const result = await listAlerts({ rule: rule || undefined, limit: PAGE_SIZE, offset });
      setAlerts(result.alerts);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load alerts.');
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rule, offset]);

  async function handleRunDetection() {
    setRunning(true);
    setRunSummary(null);
    try {
      const result = await runDetection();
      setRunSummary(
        `${result.alertCount} new alert(s): ` +
          result.summary.map((s) => `${s.rule}=${s.alertsCreated}`).join(', ')
      );
      setOffset(0);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Detection run failed.');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Alerts</h1>
        <button type="button" className="btn-primary" onClick={handleRunDetection} disabled={running}>
          {running ? 'Running detection…' : 'Run detection'}
        </button>
      </div>

      {runSummary && <div className="status-message status-info">{runSummary}</div>}

      {alerts && alerts.length > 0 && (
        <StatCards
          stats={[
            { label: 'On this page', value: alerts.length },
            { label: 'High risk (≥0.70)', value: alerts.filter((a) => a.score >= 0.7).length, tone: 'high' },
            {
              label: 'Medium risk (0.35–0.69)',
              value: alerts.filter((a) => a.score >= 0.35 && a.score < 0.7).length,
              tone: 'medium'
            },
            { label: 'Low risk (<0.35)', value: alerts.filter((a) => a.score < 0.35).length, tone: 'low' }
          ]}
        />
      )}

      <div className="toolbar">
        <label className="field-inline">
          <span>Rule</span>
          <select
            value={rule}
            onChange={(e) => {
              setRule(e.target.value);
              setOffset(0);
            }}
          >
            <option value="">All rules</option>
            {RULES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <ErrorMessage message={error} />}
      {!error && alerts === null && <Loading />}
      {!error && alerts !== null && alerts.length === 0 && (
        <EmptyState message="No alerts yet — try Run detection, or ingest some transactions first." />
      )}

      {!error && alerts && alerts.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Rule</th>
              <th>Score</th>
              <th>Accounts</th>
              <th>Created</th>
              <th>Case</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((alert) => (
              <tr key={alert.id}>
                <td>{alert.ruleName}</td>
                <td>
                  <ScoreBadge score={alert.score} />
                </td>
                <td>
                  {alert.accountIds.map((id) => (
                    <Link key={id} to={`/accounts/${encodeURIComponent(id)}/subgraph`} className="chip-link">
                      {id}
                    </Link>
                  ))}
                </td>
                <td>{new Date(alert.createdAt).toLocaleString()}</td>
                <td>
                  <Link
                    to="/cases/new"
                    state={{ accountIds: alert.accountIds, alertIds: [alert.id], title: `${alert.ruleName} on ${alert.accountIds[0]}` }}
                    className="btn-link"
                  >
                    Open case
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="pagination">
        <button type="button" onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))} disabled={offset === 0}>
          Previous
        </button>
        <button
          type="button"
          onClick={() => setOffset(offset + PAGE_SIZE)}
          disabled={!alerts || alerts.length < PAGE_SIZE}
        >
          Next
        </button>
      </div>
    </div>
  );
}
