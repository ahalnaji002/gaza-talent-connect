import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { feedbackApi } from '../../api/endpoints';
import { useToken } from '../../auth/AuthContext';
import { useApiData } from '../../hooks/useApiData';
import { feedbackBadgeText } from '../../utils/feedbackBadge';

const FEEDBACK_PATH = '/dashboard/feedback';

const tabs = [
  { to: '/dashboard', label: 'Overview', end: true },
  { to: '/dashboard/profile', label: 'Edit profile', end: false },
  { to: '/dashboard/skills', label: 'Skills', end: false },
  { to: '/dashboard/projects', label: 'Projects', end: false },
  { to: FEEDBACK_PATH, label: 'Company feedback', end: false },
];

/** Student-only layout: RequireAuth renders it only for STUDENT sessions. */
export function DashboardLayout() {
  const token = useToken();
  const location = useLocation();

  // Total feedback count from the existing student-only endpoint. limit=1
  // keeps the request tiny: only meta.total is used. Re-fetched on each
  // dashboard navigation so the badge stays current; a full page refresh
  // also refetches. A failed request simply hides the badge.
  const count = useApiData(
    (signal) => feedbackApi.listReceived(token, 1, 1, signal),
    `feedback-count:${location.pathname}${location.search}`,
  );
  const badge = feedbackBadgeText(count.data?.meta.total);

  return (
    <div className="container page">
      <nav className="tabs" aria-label="Dashboard">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) => `tab${isActive ? ' tab-active' : ''}`}
          >
            {tab.label}
            {tab.to === FEEDBACK_PATH && badge && (
              <>
                <span className="tab-badge" aria-hidden="true">
                  {badge.visible}
                </span>
                <span className="visually-hidden"> ({badge.accessible})</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
