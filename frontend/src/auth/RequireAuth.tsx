import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

/** Sends unauthenticated visitors to the login page, remembering where they were going. */
export function RequireAuth() {
  const { isAuthenticated, sessionEndReason } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    // A deliberate logout from a protected page returns to the public home page.
    if (sessionEndReason === 'logout') return <Navigate to="/" replace />;
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}
