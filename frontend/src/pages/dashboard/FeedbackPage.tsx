import { useSearchParams } from 'react-router-dom';
import { feedbackApi } from '../../api/endpoints';
import { useToken } from '../../auth/AuthContext';
import { EmptyState, ErrorAlert, LoadingState } from '../../components/Feedback';
import { Pagination } from '../../components/Pagination';
import { formatDate } from '../../components/ProjectSummary';
import { useApiData } from '../../hooks/useApiData';

const PAGE_SIZE = 10;

/** Private feedback addressed to the signed-in student. Never shown publicly. */
export function FeedbackPage() {
  const token = useToken();
  const [searchParams, setSearchParams] = useSearchParams();
  const pageParam = Number(searchParams.get('page'));
  const page = Number.isInteger(pageParam) && pageParam >= 1 ? pageParam : 1;
  const feedback = useApiData(
    (signal) => feedbackApi.listReceived(token, page, PAGE_SIZE, signal),
    `received-feedback-${page}`,
  );

  return (
    <div className="stack-lg">
      <div>
        <h1 className="h2">Company feedback</h1>
        <p className="muted">
          Private messages from companies, newest first. Only you can see feedback addressed to
          you; it never appears on your public profile.
        </p>
      </div>

      {feedback.loading && !feedback.data && <LoadingState label="Loading feedback…" />}
      {!!feedback.error && <ErrorAlert error={feedback.error} onRetry={feedback.reload} />}

      {feedback.data && feedback.data.data.length === 0 && (
        <EmptyState title="No feedback yet">
          When a company sends you private feedback, it will appear here. Publishing your profile
          lets companies find you.
        </EmptyState>
      )}

      {feedback.data && feedback.data.data.length > 0 && (
        <div className={`stack${feedback.loading ? ' is-refreshing' : ''}`}>
          {feedback.data.data.map((item) => (
            <article key={item.id} className="card feedback-card">
              <header className="feedback-card-header">
                <h2 className="project-title">{item.company.name}</h2>
                <p className="muted small">
                  <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
                  {item.updatedAt !== item.createdAt && ` · edited ${formatDate(item.updatedAt)}`}
                </p>
              </header>
              <p className="prewrap">{item.message}</p>
            </article>
          ))}
        </div>
      )}

      {feedback.data && (
        <Pagination
          page={feedback.data.meta.page}
          totalPages={feedback.data.meta.totalPages}
          onChange={(next) => setSearchParams(next > 1 ? { page: String(next) } : {})}
          disabled={feedback.loading}
        />
      )}
    </div>
  );
}
