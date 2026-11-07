import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { feedbackApi } from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';
import { FEEDBACK_MAX_LENGTH, feedbackProblem } from '../utils/validation';
import { Alert, ErrorAlert } from './Feedback';
import { TextAreaField } from './FormField';

/**
 * Private feedback box on a public student profile. Only signed-in companies
 * see the form; the API independently rejects anyone else.
 */
export function WriteFeedback({
  studentProfileId,
  studentName,
}: {
  studentProfileId: string;
  studentName: string;
}) {
  const { role, token } = useAuth();
  const location = useLocation();
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (role === 'STUDENT') return null;

  if (role !== 'COMPANY' || !token) {
    return (
      <section className="card feedback-invite" aria-labelledby="feedback-invite-heading">
        <h2 id="feedback-invite-heading" className="h3">
          Hiring?
        </h2>
        <p className="muted">
          Companies can send {studentName} private feedback.{' '}
          <Link to="/login" state={{ from: location.pathname }}>
            Log in
          </Link>{' '}
          or <Link to="/register/company">create a company account</Link>.
        </p>
      </section>
    );
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const problem = feedbackProblem(message);
    setError(problem);
    setSuccess(false);
    if (problem) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      await feedbackApi.create(token, studentProfileId, message.trim());
      setMessage('');
      setSuccess(true);
    } catch (caught) {
      setSubmitError(caught);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="card feedback-compose" aria-labelledby="feedback-heading">
      <h2 id="feedback-heading" className="h3">
        Send private feedback
      </h2>
      <p className="muted small">
        Only {studentName} and your company can read this message. It is never shown on public
        pages.
      </p>
      <form onSubmit={handleSubmit} noValidate className="form">
        <TextAreaField
          id="feedback-message"
          label="Your feedback"
          rows={5}
          value={message}
          onChange={(event) => {
            setMessage(event.target.value);
            setSuccess(false);
          }}
          error={error}
          maxLength={FEEDBACK_MAX_LENGTH}
          hint={`${message.length}/${FEEDBACK_MAX_LENGTH} characters`}
          placeholder="What stood out in this student's skills or projects?"
        />
        {success && (
          <Alert variant="success">
            Feedback sent. You can review it in{' '}
            <Link to="/company/feedback">Sent feedback</Link>.
          </Alert>
        )}
        {!!submitError && <ErrorAlert error={submitError} />}
        <div className="form-actions">
          <button type="submit" className="button button-primary" disabled={submitting}>
            {submitting ? 'Sending…' : 'Send feedback'}
          </button>
        </div>
      </form>
    </section>
  );
}
