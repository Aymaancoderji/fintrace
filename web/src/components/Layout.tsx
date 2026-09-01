import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function Layout() {
  const { username, role, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const navLinks = (
    <>
      <NavLink to="/alerts" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')} onClick={() => setMenuOpen(false)}>
        Alerts
      </NavLink>
      <NavLink to="/cases" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')} onClick={() => setMenuOpen(false)}>
        Cases
      </NavLink>
      <NavLink to="/risk" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')} onClick={() => setMenuOpen(false)}>
        Risk
      </NavLink>
    </>
  );

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
        <nav className="nav nav-desktop">{navLinks}</nav>
        <Link to="/cases/new" className="btn-primary btn-compact nav-desktop-only">
          + New case
        </Link>
        <div className="user-info nav-desktop-only">
          <span>
            {username} <span className="role-badge">{role}</span>
          </span>
          <button type="button" className="btn-link" onClick={logout}>
            Log out
          </button>
        </div>
        <button
          type="button"
          className="menu-toggle"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
            {menuOpen ? (
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            ) : (
              <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </header>

      {menuOpen && (
        <div className="mobile-menu">
          <nav className="nav-mobile">{navLinks}</nav>
          <Link to="/cases/new" className="btn-primary btn-compact" onClick={() => setMenuOpen(false)}>
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
        </div>
      )}

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
