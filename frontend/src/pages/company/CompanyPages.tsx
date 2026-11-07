import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useLocation, useSearchParams } from 'react-router-dom';
import { companyApi, feedbackApi } from '../../api/endpoints';
import type { SentFeedback } from '../../api/types';
import { useToken } from '../../auth/AuthContext';
import { Alert, EmptyState, ErrorAlert, LoadingState } from '../../components/Feedback';
import { TextAreaField } from '../../components/FormField';
import { Pagination } from '../../components/Pagination';
import { formatDate } from '../../components/ProjectSummary';
import { Avatar } from '../../components/StudentBits';
import { useApiData } from '../../hooks/useApiData';
import { FEEDBACK_MAX_LENGTH, feedbackProblem } from '../../utils/validation';

const PAGE_SIZE = 10;

const tabs = [
  { to: '/company', label: 'Overview', end: true },
  { to: '/company/feedback', label: 'Sent feedback', end: false },
];

export function CompanyLayout() {
  return (
    <div className="container page">
      <nav className="tabs" aria-label="Company dashboard">
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

export function CompanyHome() {
  const token = useToken();
  const location = useLocation();
  const [welcome] = useState(Boolean((location.state as { welcome?: boolean } | null)?.welcome));
  const company = useApiData((signal) => companyApi.me(token, signal), 'company-me');
  const sent = useApiData(
    (signal) => feedbackApi.listSent(token, 1, 3, signal),
    'company-sent-preview',
  );

  if (company.loading) return <LoadingState label="Loading your company dashboard…" />;
  if (company.error || !company.data) {
    return <ErrorAlert error={company.error} onRetry={company.reload} />;
  }

  return (
    <div className="stack-lg">
      {welcome && (
        <Alert variant="success" title="Your company account is ready">
          Browse published student profiles and leave private feedback from any profile page.
        </Alert>
      )}

      <section className="card dashboard-hero" aria-labelledby="company-name">
        <Avatar name={company.data.name} size="lg" />
        <div className="dashboard-hero-text">
          <p className="eyebrow eyebrow-dark">Company account</p>
          <h1 id="company-name" className="h2">
            {company.data.name}
          </h1>
          <p className="muted small">
            Feedback you write is private: only your company and the student can read it. It never
            appears on public profiles.
          </p>
        </div>
        <div className="dashboard-hero-actions">
          <Link to="/" className="button button-primary">
            Discover students
          </Link>
          <Link to="/company/feedback" className="button button-secondary">
            Sent feedback
          </Link>
        </div>
      </section>

      <section className="card" aria-labelledby="recent-feedback-heading">
        <div className="card-heading-row">
          <h2 id="recent-feedback-heading" className="h3">
            Recent feedback
          </h2>
          {sent.data && sent.data.meta.total > 0 && (
            <Link to="/company/feedback" className="small">
              View all ({sent.data.meta.total})
            </Link>
          )}
        </div>
        {sent.loading && <LoadingState label="Loading feedback…" />}
        {!!sent.error && <ErrorAlert error={sent.error} onRetry={sent.reload} />}
        {sent.data && sent.data.data.length === 0 && (
          <p className="muted">
            You have not written any feedback yet. Open a student&apos;s profile from{' '}
            <Link to="/">Discover talent</Link> to write one.
          </p>
        )}
        {sent.data && sent.data.data.length > 0 && (
          <ul className="plain-list">
            {sent.data.data.map((item) => (
              <li key={item.id}>
                <Link to={`/students/${item.student.id}`}>{item.student.fullName}</Link>
                <span className="muted small"> · {formatDate(item.createdAt)}</span>
                <p className="feedback-snippet">{item.message}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function EditFeedbackForm({
  item,
  onSave,
  onCancel,
}: {
  item: SentFeedback;
  onSave: (message: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [message, setMessage] = useState(item.message);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const problem = feedbackProblem(message);
    setError(problem);
    if (problem) return;
    setSaving(true);
    setSubmitError(null);
    try {
      await onSave(message.trim());
    } catch (caught) {
      setSubmitError(caught);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="form">
      {!!submitError && <ErrorAlert error={submitError} />}
      <TextAreaField
        ref={ref}
        id={`edit-feedback-${item.id}`}
        label="Feedback message"
        rows={4}
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        error={error}
        maxLength={FEEDBACK_MAX_LENGTH}
        hint={`${message.length}/${FEEDBACK_MAX_LENGTH} characters`}
      />
      <div className="form-actions">
        <button type="submit" className="button button-primary button-small" disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        <button
          type="button"
          className="button button-ghost button-small"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function DeleteFeedbackControl({ onDelete }: { onDelete: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const keepRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirming) keepRef.current?.focus();
  }, [confirming]);

  if (!confirming) {
    return (
      <button
        type="button"
        className="button button-danger-ghost button-small"
        onClick={() => setConfirming(true)}
      >
        Delete
      </button>
    );
  }
  return (
    <span className="confirm-inline" role="group" aria-label="Confirm deleting this feedback">
      <span className="small">Delete this feedback?</span>
      <button
        type="button"
        className="button button-danger button-small"
        disabled={deleting}
        onClick={async () => {
          setDeleting(true);
          try {
            await onDelete();
          } finally {
            setDeleting(false);
            setConfirming(false);
          }
        }}
      >
        {deleting ? 'Deleting…' : 'Yes, delete'}
      </button>
      <button
        ref={keepRef}
        type="button"
        className="button button-ghost button-small"
        disabled={deleting}
        onClick={() => setConfirming(false)}
      >
        Keep
      </button>
    </span>
  );
}

export function SentFeedbackPage() {
  const token = useToken();
  const [searchParams, setSearchParams] = useSearchParams();
  const pageParam = Number(searchParams.get('page'));
  const page = Number.isInteger(pageParam) && pageParam >= 1 ? pageParam : 1;
  const sent = useApiData(
    (signal) => feedbackApi.listSent(token, page, PAGE_SIZE, signal),
    `company-sent-${page}`,
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);

  if (sent.loading && !sent.data) return <LoadingState label="Loading sent feedback…" />;
  if (sent.error || !sent.data) return <ErrorAlert error={sent.error} onRetry={sent.reload} />;
  const result = sent.data;

  const goToPage = (next: number) => {
    setNotice(null);
    setSearchParams(next > 1 ? { page: String(next) } : {});
  };

  const handleSave = async (item: SentFeedback, message: string) => {
    const updated = await feedbackApi.update(token, item.id, message);
    sent.setData({
      ...result,
      data: result.data.map((entry) => (entry.id === item.id ? updated : entry)),
    });
    setEditingId(null);
    setActionError(null);
    setNotice(`Feedback for ${updated.student.fullName} was updated.`);
  };

  const handleDelete = async (item: SentFeedback) => {
    setNotice(null);
    setActionError(null);
    try {
      await feedbackApi.remove(token, item.id);
      setNotice(`Feedback for ${item.student.fullName} was deleted.`);
      // Reload so totals and pagination stay accurate.
      if (result.data.length === 1 && page > 1) goToPage(page - 1);
      else sent.reload();
    } catch (error) {
      setActionError(error);
    }
  };

  return (
    <div className="stack-lg">
      <div className="page-heading-row">
        <div>
          <h1 className="h2">Sent feedback</h1>
          <p className="muted">
            Private messages your company has written, newest first. Only you and each student can
            read them.
          </p>
        </div>
        <Link to="/" className="button button-primary">
          Discover students
        </Link>
      </div>

      {notice && <Alert variant="success">{notice}</Alert>}
      {!!actionError && <ErrorAlert error={actionError} />}

      {result.data.length === 0 ? (
        <EmptyState
          title="No feedback yet"
          action={
            <Link to="/" className="button button-primary">
              Find students
            </Link>
          }
        >
          Open a published student profile to write private feedback.
        </EmptyState>
      ) : (
        <div className={`stack${sent.loading ? ' is-refreshing' : ''}`}>
          {result.data.map((item) => (
            <article key={item.id} className="card feedback-card">
              <div className="project-card-header">
                <div>
                  <h2 className="project-title">
                    <Link to={`/students/${item.student.id}`}>{item.student.fullName}</Link>
                  </h2>
                  <p className="muted small">
                    Sent {formatDate(item.createdAt)}
                    {item.updatedAt !== item.createdAt && ` · edited ${formatDate(item.updatedAt)}`}
                  </p>
                </div>
                {editingId !== item.id && (
                  <div className="project-actions">
                    <button
                      type="button"
                      className="button button-secondary button-small"
                      onClick={() => {
                        setEditingId(item.id);
                        setNotice(null);
                      }}
                    >
                      Edit
                    </button>
                    <DeleteFeedbackControl onDelete={() => handleDelete(item)} />
                  </div>
                )}
              </div>
              {editingId === item.id ? (
                <EditFeedbackForm
                  item={item}
                  onSave={(message) => handleSave(item, message)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <p className="prewrap">{item.message}</p>
              )}
            </article>
          ))}
        </div>
      )}

      <Pagination
        page={result.meta.page}
        totalPages={result.meta.totalPages}
        onChange={goToPage}
        disabled={sent.loading}
      />
    </div>
  );
}
