export function Loading({ label = 'Loading…' }: { label?: string }) {
  return <div className="status-message status-loading">{label}</div>;
}

export function ErrorMessage({ message }: { message: string }) {
  return <div className="status-message status-error">{message}</div>;
}

export function EmptyState({ message }: { message: string }) {
  return <div className="status-message status-empty">{message}</div>;
}
