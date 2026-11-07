import { useState, type MouseEvent } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function Layout() {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the mobile menu whenever one of its links is followed.
  const closeMenuOnLink = (event: MouseEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest('a')) setMenuOpen(false);
  };

  const handleLogout = () => {
    setMenuOpen(false);
    logout();
    // On protected pages RequireAuth also redirects to "/" after a logout.
    navigate('/', { replace: true });
  };

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `nav-link${isActive ? ' nav-link-active' : ''}`;

  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="site-header">
        <div className="container header-inner">
          <Link to="/" className="brand" aria-label="Gaza Talent Connect home">
            <img src="/favicon.svg" alt="" width="30" height="30" />
            <span>
              Gaza <strong>Talent Connect</strong>
            </span>
          </Link>
          <button
            type="button"
            className="menu-toggle"
            aria-expanded={menuOpen}
            aria-controls="primary-nav"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="visually-hidden">{menuOpen ? 'Close menu' : 'Open menu'}</span>
            <span className="menu-icon" aria-hidden="true" />
          </button>
          <nav
            id="primary-nav"
            className={`primary-nav${menuOpen ? ' primary-nav-open' : ''}`}
            aria-label="Main"
            onClick={closeMenuOnLink}
          >
            <NavLink to="/" end className={navClass}>
              Discover talent
            </NavLink>
            {isAuthenticated ? (
              <>
                <NavLink to="/dashboard" className={navClass}>
                  My dashboard
                </NavLink>
                <button type="button" className="button button-secondary" onClick={handleLogout}>
                  Log out
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login" className={navClass}>
                  Log in
                </NavLink>
                <Link to="/register" className="button button-primary">
                  Join as a student
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main id="main" className="site-main" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="container footer-inner">
          <p>
            <strong>Gaza Talent Connect</strong> — connecting students from Gaza with opportunities.
          </p>
          <p className="muted small">Only profiles that students choose to publish are shown.</p>
        </div>
      </footer>
    </div>
  );
}
