import { FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { createCase } from '../api/endpoints';
import { ApiError } from '../api/client';
import { ErrorMessage } from '../components/StatusMessage';

interface PrefillState {
  title?: string;
  accountIds?: string[];
  alertIds?: string[];
}

export function NewCasePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const prefill = (location.state as PrefillState | null) ?? {};

  const [title, setTitle] = useState(prefill.title ?? '');
  const [accountIds] = useState<string[]>(prefill.accountIds ?? []);
  const [alertIds] = useState<string[]>(prefill.alertIds ?? []);
  const [assignedTo, setAssignedTo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const created = await createCase({
        title,
        accountIds,
        alertIds,
        assignedTo: assignedTo || undefined
      });
      navigate(`/cases/${created.id}`, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create case.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <Link to="/cases" className="btn-link back-link">
        ← Back to cases
      </Link>
      <h1>New case</h1>
      <form className="form-card" onSubmit={handleSubmit}>
        <label className="field">
          <span>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
        </label>

        {accountIds.length > 0 && (
          <div className="field">
            <span>Linked accounts</span>
            <div>{accountIds.join(', ')}</div>
          </div>
        )}

        {alertIds.length > 0 && (
          <div className="field">
            <span>Linked alerts</span>
            <div>{alertIds.length} alert(s)</div>
          </div>
        )}

        <label className="field">
          <span>Assign to (optional)</span>
          <input value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} placeholder="analyst username" />
        </label>

        {error && <ErrorMessage message={error} />}

        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create case'}
          </button>
          <Link to="/cases" className="btn-link">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
