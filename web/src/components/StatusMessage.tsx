export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="status-message status-loading">
      <span className="spinner" aria-hidden="true" />
      {label}
    </div>
  );
}

export function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="status-message status-error">
      <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
        <circle cx="10" cy="10" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 6v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="10" cy="13.5" r="1" fill="currentColor" />
      </svg>
      {message}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="status-message status-empty">
      <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
        <rect x="2.5" y="4.5" width="15" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.3" />
        <path d="M2.5 8h15" stroke="currentColor" strokeWidth="1.3" />
        <path d="M6 11.5h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
      {message}
    </div>
  );
}
