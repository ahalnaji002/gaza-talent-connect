import { Link, Route, Routes } from 'react-router-dom';
import { RequireAuth } from './auth/RequireAuth';
import { EmptyState } from './components/Feedback';
import { Layout } from './components/Layout';
import { LoginPage, RegisterPage } from './pages/AuthPages';
import { DiscoverPage } from './pages/DiscoverPage';
import { StudentProfilePage } from './pages/StudentProfilePage';
import { DashboardHome } from './pages/dashboard/DashboardHome';
import { DashboardLayout } from './pages/dashboard/DashboardLayout';
import { EditProfilePage } from './pages/dashboard/EditProfilePage';
import { ProjectsPage } from './pages/dashboard/ProjectsPage';
import { SkillsPage } from './pages/dashboard/SkillsPage';

function NotFoundPage() {
  return (
    <div className="container narrow page">
      <EmptyState
        title="Page not found"
        action={
          <Link to="/" className="button button-primary">
            Go to discovery
          </Link>
        }
      >
        The page you are looking for does not exist.
      </EmptyState>
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DiscoverPage />} />
        <Route path="students/:id" element={<StudentProfilePage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route element={<RequireAuth />}>
          <Route path="dashboard" element={<DashboardLayout />}>
            <Route index element={<DashboardHome />} />
            <Route path="profile" element={<EditProfilePage />} />
            <Route path="skills" element={<SkillsPage />} />
            <Route path="projects" element={<ProjectsPage />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
