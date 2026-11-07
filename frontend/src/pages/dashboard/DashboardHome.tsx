import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { myProfileApi, projectsApi } from '../../api/endpoints';
import { useToken } from '../../auth/AuthContext';
import { Alert, ErrorAlert, LoadingState } from '../../components/Feedback';
import { Avatar, SkillTags } from '../../components/StudentBits';
import { useApiData } from '../../hooks/useApiData';

export function DashboardHome() {
  const token = useToken();
  const location = useLocation();
  const [welcome] = useState(
    Boolean((location.state as { welcome?: boolean } | null)?.welcome),
  );

  const profile = useApiData((signal) => myProfileApi.get(token, signal), 'me');
  const projects = useApiData((signal) => projectsApi.listMine(token, signal), 'my-projects');

  if (profile.loading) return <LoadingState label="Loading your dashboard…" />;
  if (profile.error || !profile.data) {
    return <ErrorAlert error={profile.error} onRetry={profile.reload} />;
  }

  const me = profile.data;
  const projectCount = projects.data?.length ?? 0;
  const checklist = [
    { done: Boolean(me.bio), label: 'Write a short bio', to: '/dashboard/profile' },
    { done: Boolean(me.contactEmail), label: 'Add a contact email', to: '/dashboard/profile' },
    { done: me.skills.length > 0, label: 'Select your skills', to: '/dashboard/skills' },
    { done: projectCount > 0, label: 'Add a project', to: '/dashboard/projects' },
    { done: me.isPublic, label: 'Publish your profile', to: '/dashboard/profile' },
  ];

  return (
    <div className="stack-lg">
      {welcome && (
        <Alert variant="success" title="Your account is ready">
          Complete your profile below, then publish it when you are ready to be discovered.
        </Alert>
      )}

      <section className="card dashboard-hero" aria-labelledby="dashboard-name">
        <Avatar name={me.fullName} size="lg" />
        <div className="dashboard-hero-text">
          <h1 id="dashboard-name" className="h2">
            {me.fullName}
          </h1>
          {me.jobTitle && <p className="job-title">{me.jobTitle}</p>}
          {me.location && <p className="muted">{me.location}</p>}
          <p>
            <span className={`status-pill ${me.isPublic ? 'status-public' : 'status-hidden'}`}>
              {me.isPublic ? 'Public profile' : 'Hidden profile'}
            </span>
          </p>
          <p className="muted small">
            {me.isPublic
              ? 'Visitors can find your profile in talent discovery.'
              : 'Only you can see your profile. Publish it from Edit profile when ready.'}
          </p>
        </div>
        <div className="dashboard-hero-actions">
          <Link to="/dashboard/profile" className="button button-primary">
            Edit profile
          </Link>
          {me.isPublic && (
            <Link to={`/students/${me.id}`} className="button button-secondary">
              View public profile
            </Link>
          )}
        </div>
      </section>

      <div className="dashboard-grid">
        <section className="card" aria-labelledby="checklist-heading">
          <h2 id="checklist-heading" className="h3">
            Profile checklist
          </h2>
          <ul className="checklist">
            {checklist.map((item) => (
              <li key={item.label} className={item.done ? 'checklist-done' : undefined}>
                <span className="checklist-mark" aria-hidden="true">
                  {item.done ? '✓' : ''}
                </span>
                {item.done ? (
                  <span>
                    {item.label}
                    <span className="visually-hidden"> (done)</span>
                  </span>
                ) : (
                  <Link to={item.to}>{item.label}</Link>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="card" aria-labelledby="skills-overview-heading">
          <div className="card-heading-row">
            <h2 id="skills-overview-heading" className="h3">
              Skills
            </h2>
            <Link to="/dashboard/skills" className="small">
              Manage
            </Link>
          </div>
          <SkillTags skills={me.skills} emptyText="You have not selected any skills yet." />
        </section>

        <section className="card" aria-labelledby="projects-overview-heading">
          <div className="card-heading-row">
            <h2 id="projects-overview-heading" className="h3">
              Projects
            </h2>
            <Link to="/dashboard/projects" className="small">
              Manage
            </Link>
          </div>
          {projects.loading && <LoadingState label="Loading projects…" />}
          {!!projects.error && <ErrorAlert error={projects.error} onRetry={projects.reload} />}
          {projects.data && projects.data.length === 0 && (
            <p className="muted">You have not added any projects yet.</p>
          )}
          {projects.data && projects.data.length > 0 && (
            <ul className="plain-list">
              {projects.data.slice(0, 4).map((project) => (
                <li key={project.id}>{project.title}</li>
              ))}
              {projects.data.length > 4 && (
                <li className="muted small">and {projects.data.length - 4} more</li>
              )}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
