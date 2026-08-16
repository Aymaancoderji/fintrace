import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function Layout() {
  const { username, role, logout } = useAuth();

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">FinTrace</div>
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
