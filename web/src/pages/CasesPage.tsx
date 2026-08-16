import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listCases } from '../api/endpoints';
import { Case, CaseStatus } from '../api/types';
import { ApiError } from '../api/client';
import { EmptyState, ErrorMessage, Loading } from '../components/StatusMessage';

const STATUSES: CaseStatus[] = ['open', 'in_review', 'closed'];

export function CasesPage() {
  const [cases, setCases] = useState<Case[] | null>(null);
  const [status, setStatus] = useState<CaseStatus | ''>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    listCases({ status: status || undefined })
      .then((res) => setCases(res.cases))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load cases.'));
  }, [status]);

  return (
    <div>
      <div className="page-header">
        <h1>Cases</h1>
        <Link to="/cases/new" className="btn-primary">
          New case
        </Link>
      </div>

      <div className="toolbar">
        <label className="field-inline">
          <span>Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value as CaseStatus | '')}>
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <ErrorMessage message={error} />}
      {!error && cases === null && <Loading />}
      {!error && cases !== null && cases.length === 0 && (
        <EmptyState message="No cases yet — open one from an alert, or use New case." />
      )}

      {!error && cases && cases.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Status</th>
              <th>Assigned to</th>
              <th>Accounts</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {cases.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link to={`/cases/${c.id}`}>{c.title}</Link>
                </td>
                <td>
                  <span className={`status-badge status-${c.status}`}>{c.status}</span>
                </td>
                <td>{c.assignedTo ?? '—'}</td>
                <td>{c.accountIds.join(', ') || '—'}</td>
                <td>{new Date(c.updatedAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
