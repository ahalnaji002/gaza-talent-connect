import { Link, useParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { publicStudentsApi } from '../api/endpoints';
import { EmptyState, ErrorAlert, LoadingState } from '../components/Feedback';
import { Avatar, ExternalLink, SkillTags, safeHref } from '../components/StudentBits';
import { ProjectSummary } from '../components/ProjectSummary';
import { useApiData } from '../hooks/useApiData';
import { isUuid } from '../utils/validation';

function NotAvailable() {
  return (
    <div className="container narrow page">
      <EmptyState
        title="This profile is not available"
        action={
          <Link to="/" className="button button-primary">
            Back to discovery
          </Link>
        }
      >
        The student may have hidden their profile, or the link may be incorrect.
      </EmptyState>
    </div>
  );
}

export function StudentProfilePage() {
  const { id = '' } = useParams();
  const validId = isUuid(id);
  const profile = useApiData(
    (signal) =>
      validId
        ? publicStudentsApi.getById(id, signal)
        : Promise.reject(new ApiError(404, 'Not found')),
    id,
  );

  if (!validId) return <NotAvailable />;
  if (profile.loading) {
    return (
      <div className="container page">
        <LoadingState label="Loading profile…" />
      </div>
    );
  }
  // Hidden, unpublished and nonexistent profiles all return 404 from the API.
  if (profile.error instanceof ApiError && profile.error.status === 404) return <NotAvailable />;
  if (profile.error || !profile.data) {
    return (
      <div className="container page">
        <ErrorAlert error={profile.error} onRetry={profile.reload} />
      </div>
    );
  }

  const student = profile.data;
  const hasLinks =
    safeHref(student.githubUrl) !== null || safeHref(student.portfolioUrl) !== null;

  return (
    <div className="container page">
      <Link to="/" className="back-link">
        ← Back to all students
      </Link>
      <div className="profile-layout">
        <section className="card profile-summary" aria-labelledby="student-name">
          <Avatar name={student.fullName} size="lg" />
          <h1 id="student-name" className="profile-name">
            {student.fullName}
          </h1>
          {student.location && <p className="muted">{student.location}</p>}
          {student.contactEmail && (
            <a className="button button-primary button-block" href={`mailto:${student.contactEmail}`}>
              Contact {student.fullName.split(' ')[0]}
            </a>
          )}
          {student.contactEmail && <p className="muted small break-all">{student.contactEmail}</p>}
          {hasLinks && (
            <ul className="link-list">
              {safeHref(student.githubUrl) && (
                <li>
                  <ExternalLink href={student.githubUrl}>GitHub profile</ExternalLink>
                </li>
              )}
              {safeHref(student.portfolioUrl) && (
                <li>
                  <ExternalLink href={student.portfolioUrl}>Portfolio</ExternalLink>
                </li>
              )}
            </ul>
          )}
        </section>

        <div className="profile-main">
          <section className="card" aria-labelledby="about-heading">
            <h2 id="about-heading" className="h3">
              About
            </h2>
            {student.bio ? (
              <p className="prewrap">{student.bio}</p>
            ) : (
              <p className="muted">This student has not added a bio yet.</p>
            )}
          </section>

          <section className="card" aria-labelledby="skills-heading">
            <h2 id="skills-heading" className="h3">
              Skills
            </h2>
            <SkillTags skills={student.skills} />
          </section>

          <section aria-labelledby="projects-heading">
            <h2 id="projects-heading" className="h3 section-title">
              Projects
            </h2>
            {student.projects.length === 0 ? (
              <div className="card">
                <p className="muted">No projects have been added yet.</p>
              </div>
            ) : (
              <div className="stack">
                {student.projects.map((project) => (
                  <ProjectSummary key={project.id} project={project} />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
