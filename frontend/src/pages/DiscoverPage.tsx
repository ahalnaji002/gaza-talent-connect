import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { publicStudentsApi, skillsApi } from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';
import { EmptyState, ErrorAlert, LoadingState } from '../components/Feedback';
import { Pagination } from '../components/Pagination';
import { StudentCard } from '../components/StudentBits';
import { useApiData } from '../hooks/useApiData';
import { isUuid } from '../utils/validation';

const PAGE_SIZE = 12;

function readPage(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

export function DiscoverPage() {
  const { isAuthenticated } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Filter state lives in the URL (?skills=…&page=…) so results can be shared.
  const selectedIds = useMemo(
    () =>
      [...new Set((searchParams.get('skills') ?? '').split(',').filter(isUuid))].sort(),
    [searchParams],
  );
  const page = readPage(searchParams.get('page'));
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const skills = useApiData((signal) => skillsApi.list(signal), 'skills');
  const results = useApiData(
    (signal) =>
      publicStudentsApi.discover({ skillIds: selectedIds, page, limit: PAGE_SIZE }, signal),
    `${selectedIds.join(',')}|${page}`,
  );

  const updateParams = (ids: string[], nextPage: number) => {
    const next = new URLSearchParams();
    if (ids.length > 0) next.set('skills', ids.join(','));
    if (nextPage > 1) next.set('page', String(nextPage));
    setSearchParams(next);
  };

  const toggleSkill = (id: string) => {
    const ids = selectedSet.has(id)
      ? selectedIds.filter((existing) => existing !== id)
      : [...selectedIds, id];
    updateParams(ids, 1); // A new filter always starts from the first page.
  };

  const changePage = (nextPage: number) => {
    updateParams(selectedIds, nextPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const meta = results.data?.meta;

  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <p className="eyebrow">Student talent from Gaza</p>
          <h1>Find skilled students and see what they have built</h1>
          <p className="hero-lead">
            Browse public student profiles, filter by the skills you need, and reach out directly
            through each student&apos;s published contact details.
          </p>
          {!isAuthenticated && (
            <div className="hero-actions">
              <Link to="/register" className="button button-primary button-large">
                Create your student profile
              </Link>
              <Link to="/login" className="button button-ghost button-large">
                I already have an account
              </Link>
            </div>
          )}
          {!isAuthenticated && (
            <p className="hero-note">
              Hiring? <Link to="/register/company">Create a company account</Link> to send
              students private feedback.
            </p>
          )}
        </div>
      </section>

      <div className="container discover-layout">
        <aside className="filters card" aria-labelledby="filters-heading">
          <div className="filters-header">
            <h2 id="filters-heading" className="h3">
              Filter by skill
            </h2>
            {selectedIds.length > 0 && (
              <button
                type="button"
                className="link-button"
                onClick={() => updateParams([], 1)}
              >
                Clear
              </button>
            )}
          </div>
          <p className="muted small">
            Students with any selected skill are shown, best matches first.
          </p>
          {skills.loading && <LoadingState label="Loading skills…" />}
          {!!skills.error && <ErrorAlert error={skills.error} onRetry={skills.reload} />}
          {skills.data && skills.data.length === 0 && (
            <p className="muted small">No skills are available yet.</p>
          )}
          {skills.data && skills.data.length > 0 && (
            <div className="chip-group" role="group" aria-label="Skills">
              {skills.data.map((skill) => {
                const active = selectedSet.has(skill.id);
                return (
                  <button
                    key={skill.id}
                    type="button"
                    className={`chip${active ? ' chip-active' : ''}`}
                    aria-pressed={active}
                    onClick={() => toggleSkill(skill.id)}
                  >
                    {skill.name}
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        <section className="results" aria-labelledby="results-heading">
          <div className="results-header">
            <h2 id="results-heading" className="h2">
              Students
            </h2>
            {meta && (
              <p className="muted" aria-live="polite">
                {meta.total === 1 ? '1 student' : `${meta.total} students`}
                {selectedIds.length > 0
                  ? meta.total === 1
                    ? ' matches your filters'
                    : ' match your filters'
                  : ''}
              </p>
            )}
          </div>

          {results.loading && !results.data && <LoadingState label="Finding students…" />}
          {!!results.error && <ErrorAlert error={results.error} onRetry={results.reload} />}

          {results.data && results.data.data.length === 0 && (
            <EmptyState
              title={
                selectedIds.length > 0
                  ? 'No students match these skills yet'
                  : 'No public profiles yet'
              }
              action={
                selectedIds.length > 0 ? (
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() => updateParams([], 1)}
                  >
                    Clear filters
                  </button>
                ) : undefined
              }
            >
              {selectedIds.length > 0
                ? 'Try removing a skill to broaden your search.'
                : 'Profiles appear here once students publish them.'}
            </EmptyState>
          )}

          {results.data && results.data.data.length > 0 && (
            <div className={`card-grid${results.loading ? ' is-refreshing' : ''}`}>
              {results.data.data.map((student) => (
                <StudentCard key={student.id} student={student} highlight={selectedSet} />
              ))}
            </div>
          )}

          {meta && (
            <Pagination
              page={meta.page}
              totalPages={meta.totalPages}
              onChange={changePage}
              disabled={results.loading}
            />
          )}
        </section>
      </div>
    </>
  );
}
