import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { UserRole } from '../api/types';
import { homePathFor, useAuth } from './AuthContext';

/**
 * Sends unauthenticated visitors to the login page, remembering where they were
 * going, and keeps each account type in its own area. This only shapes the UI:
 * the API enforces every role and ownership rule on its own.
 */
export function RequireAuth({ role }: { role: UserRole }) {
  const { isAuthenticated, role: currentRole, sessionEndReason } = useAuth();
  const location = useLocation();

  if (!isAuthenticated || !currentRole) {
    // A deliberate logout from a protected page returns to the public home page.
    if (sessionEndReason === 'logout') return <Navigate to="/" replace />;
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (currentRole !== role) {
    return <Navigate to={homePathFor(currentRole)} replace />;
  }
  return <Outlet />;
}
