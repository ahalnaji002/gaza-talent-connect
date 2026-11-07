import { NavLink, Outlet } from 'react-router-dom';

const tabs = [
  { to: '/dashboard', label: 'Overview', end: true },
  { to: '/dashboard/profile', label: 'Edit profile', end: false },
  { to: '/dashboard/skills', label: 'Skills', end: false },
  { to: '/dashboard/projects', label: 'Projects', end: false },
];

export function DashboardLayout() {
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
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
