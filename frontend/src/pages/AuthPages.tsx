import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { authApi } from '../api/endpoints';
import type { UserRole } from '../api/types';
import { homePathFor, useAuth } from '../auth/AuthContext';
import { Alert, ErrorAlert } from '../components/Feedback';
import { TextField } from '../components/FormField';
import { focusFirstInvalid } from '../utils/focus';
import { isValidEmail, passwordProblems, utf8ByteLength } from '../utils/validation';

function useRequestedPath(): string | null {
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  return from && from.startsWith('/') && !from.startsWith('//') ? from : null;
}

/** Returns to the requested page unless it belongs to the other account type. */
function destinationFor(role: UserRole, requested: string | null): string {
  if (!requested) return homePathFor(role);
  const otherArea = role === 'COMPANY' ? '/dashboard' : '/company';
  return requested === otherArea || requested.startsWith(otherArea + '/')
    ? homePathFor(role)
    : requested;
}

export function LoginPage() {
  const { isAuthenticated, role, login, sessionEndReason, clearSessionEndReason } = useAuth();
  const navigate = useNavigate();
  const requested = useRequestedPath();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);
  const [expiredNotice, setExpiredNotice] = useState(sessionEndReason === 'expired');

  useEffect(() => {
    if (sessionEndReason) clearSessionEndReason();
  }, [sessionEndReason, clearSessionEndReason]);

  if (isAuthenticated && role && !submitting) {
    return <Navigate to={destinationFor(role, requested)} replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const nextErrors: typeof errors = {};
    if (!isValidEmail(email)) nextErrors.email = 'Enter a valid email address.';
    if (!password) nextErrors.password = 'Enter your password.';
    else if (utf8ByteLength(password) > 72) nextErrors.password = 'Password is too long.';
    setErrors(nextErrors);
    setExpiredNotice(false);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const signedInRole = await login({ email: email.trim(), password });
      navigate(destinationFor(signedInRole, requested), { replace: true });
    } catch (error) {
      setSubmitError(error);
      setSubmitting(false);
    }
  };

  return (
    <div className="container auth-page">
      <div className="card auth-card">
        <h1 className="h2">Welcome back</h1>
        <p className="muted">
          Students and companies both log in here with their account email.
        </p>
        {expiredNotice && (
          <Alert variant="info">Your session has ended. Please log in again.</Alert>
        )}
        {!!submitError && <ErrorAlert error={submitError} />}
        <form onSubmit={handleSubmit} noValidate className="form">
          <TextField
            id="login-email"
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={errors.email}
            required
          />
          <TextField
            id="login-password"
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={errors.password}
            required
          />
          <button type="submit" className="button button-primary button-block" disabled={submitting}>
            {submitting ? 'Logging in…' : 'Log in'}
          </button>
        </form>
        <p className="auth-switch">
          New here? <Link to="/register">Create a student account</Link> or{' '}
          <Link to="/register/company">register a company</Link>
        </p>
      </div>
    </div>
  );
}

export function RegisterPage() {
  const { isAuthenticated, role, login } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  if (isAuthenticated && role && !submitting) return <Navigate to={homePathFor(role)} replace />;

  const validate = () => {
    const next: Record<string, string> = {};
    const name = fullName.trim();
    if (name.length < 2) next.fullName = 'Enter your full name (at least 2 characters).';
    else if (name.length > 150) next.fullName = 'Full name must be 150 characters or fewer.';
    if (!isValidEmail(email)) next.email = 'Enter a valid email address.';
    else if (email.trim().length > 255) next.email = 'Email must be 255 characters or fewer.';
    const problems = passwordProblems(password);
    if (problems.length > 0) next.password = problems.join(' ');
    if (confirm !== password) next.confirm = 'Passwords do not match.';
    return next;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      focusFirstInvalid(formRef.current);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    const credentials = { email: email.trim(), password };
    try {
      await authApi.register({ fullName: fullName.trim(), ...credentials });
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setErrors({ email: 'An account with this email already exists. Try logging in.' });
      } else {
        setSubmitError(error);
      }
      setSubmitting(false);
      return;
    }
    try {
      await login(credentials);
      navigate('/dashboard', { replace: true, state: { welcome: true } });
    } catch {
      // The account exists; send the student to log in manually.
      navigate('/login', { replace: true });
    }
  };

  return (
    <div className="container auth-page">
      <div className="card auth-card">
        <h1 className="h2">Create your student account</h1>
        <p className="muted">
          Your profile starts hidden. You decide when to publish it for others to discover.
        </p>
        {!!submitError && <ErrorAlert error={submitError} />}
        <form ref={formRef} onSubmit={handleSubmit} noValidate className="form">
          <TextField
            id="register-name"
            label="Full name"
            autoComplete="name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            error={errors.fullName}
            maxLength={150}
            required
          />
          <TextField
            id="register-email"
            label="Email"
            type="email"
            autoComplete="email"
            hint="Used to log in. It is never shown on your public profile."
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={errors.email}
            maxLength={255}
            required
          />
          <TextField
            id="register-password"
            label="Password"
            type="password"
            autoComplete="new-password"
            hint="At least 8 characters, including an English letter and a number."
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={errors.password}
            required
          />
          <TextField
            id="register-confirm"
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            error={errors.confirm}
            required
          />
          <button type="submit" className="button button-primary button-block" disabled={submitting}>
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        <p className="auth-switch">
          Already registered? <Link to="/login">Log in</Link>
        </p>
        <p className="auth-switch">
          Hiring? <Link to="/register/company">Create a company account</Link>
        </p>
      </div>
    </div>
  );
}
