import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function Layout() {
  const { username, role, logout } = useAuth();

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/alerts" className="brand">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" width="20" height="20">
              <circle cx="9" cy="23" r="3.2" fill="var(--accent)" />
              <circle cx="23" cy="9" r="3.2" fill="var(--success)" />
              <circle cx="23" cy="23" r="3.2" fill="var(--warning)" />
              <path d="M11.5 21 20.5 11M11.5 22h9" stroke="var(--border)" strokeWidth="2" fill="none" />
            </svg>
          </span>
          FinTrace
        </Link>
        <nav className="nav">
          <NavLink to="/alerts" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
            Alerts
          </NavLink>
          <NavLink to="/cases" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
            Cases
          </NavLink>
          <NavLink to="/risk" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
            Risk
          </NavLink>
        </nav>
        <Link to="/cases/new" className="btn-primary btn-compact">
          + New case
        </Link>
        <div className="user-info">
          <span>
            {username} <span className="role-badge">{role}</span>
          </span>
          <button type="button" className="btn-link" onClick={logout}>
            Log out
          </button>
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
