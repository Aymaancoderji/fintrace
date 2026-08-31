import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { addCaseNote, getCase, updateCase } from '../api/endpoints';
import { CaseDetail, CaseStatus } from '../api/types';
import { ApiError } from '../api/client';
import { ErrorMessage, Loading } from '../components/StatusMessage';

const STATUSES: CaseStatus[] = ['open', 'in_review', 'closed'];

export function CaseDetailPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [caseDetail, setCaseDetail] = useState<CaseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noteBody, setNoteBody] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);

  async function load() {
    if (!caseId) return;
    setError(null);
    try {
      const result = await getCase(caseId);
      setCaseDetail(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load case.');
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  async function handleStatusChange(status: CaseStatus) {
    if (!caseId) return;
    try {
      await updateCase(caseId, { status });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update case.');
    }
  }

  async function handleAddNote(e: FormEvent) {
    e.preventDefault();
    if (!caseId || !noteBody.trim()) return;
    setSubmittingNote(true);
    try {
      await addCaseNote(caseId, noteBody.trim());
      setNoteBody('');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add note.');
    } finally {
      setSubmittingNote(false);
    }
  }

  if (error) return <ErrorMessage message={error} />;
  if (!caseDetail) return <Loading />;

  return (
    <div>
      <Link to="/cases" className="btn-link back-link">
        ← Back to cases
      </Link>
      <div className="page-header">
        <h1>{caseDetail.title}</h1>
        <label className="field-inline">
          <span>Status</span>
          <select value={caseDetail.status} onChange={(e) => handleStatusChange(e.target.value as CaseStatus)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="detail-row">
        <span className="detail-label">Assigned to</span>
        <span>{caseDetail.assignedTo ?? '—'}</span>
      </div>
      <div className="detail-row">
        <span className="detail-label">Accounts</span>
        <span>
          {caseDetail.accountIds.map((id) => (
            <Link key={id} to={`/accounts/${encodeURIComponent(id)}/subgraph`} className="chip-link">
              {id}
            </Link>
          ))}
        </span>
      </div>
      <div className="detail-row">
        <span className="detail-label">Opened</span>
        <span>{new Date(caseDetail.createdAt).toLocaleString()}</span>
      </div>

      <h2>Notes</h2>
      {caseDetail.notes.length === 0 && <p className="hint">No notes yet.</p>}
      <ul className="note-list">
        {caseDetail.notes.map((note) => (
          <li key={note.id} className="note-item">
            <div className="note-meta">
              <strong>{note.author}</strong> · {new Date(note.createdAt).toLocaleString()}
            </div>
            <div>{note.body}</div>
          </li>
        ))}
      </ul>

      <form className="form-card" onSubmit={handleAddNote}>
        <label className="field">
          <span>Add a note</span>
          <textarea value={noteBody} onChange={(e) => setNoteBody(e.target.value)} rows={3} required />
        </label>
        <button type="submit" className="btn-primary" disabled={submittingNote}>
          {submittingNote ? 'Saving…' : 'Add note'}
        </button>
      </form>
    </div>
  );
}
