import { useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { authApi } from '../../api/endpoints';
import { homePathFor, useAuth } from '../../auth/AuthContext';
import { ErrorAlert } from '../../components/Feedback';
import { TextField } from '../../components/FormField';
import { focusFirstInvalid } from '../../utils/focus';
import { isValidEmail, passwordProblems } from '../../utils/validation';

export function CompanyRegisterPage() {
  const { isAuthenticated, role, login } = useAuth();
  const navigate = useNavigate();
  const [companyName, setCompanyName] = useState('');
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
    const name = companyName.trim();
    if (name.length < 2) next.companyName = 'Enter the company name (at least 2 characters).';
    else if (name.length > 150) next.companyName = 'Company name must be 150 characters or fewer.';
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
      await authApi.registerCompany({ companyName: companyName.trim(), ...credentials });
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setErrors({ email: 'An account with this email already exists. Try logging in.' });
        focusFirstInvalid(formRef.current);
      } else {
        setSubmitError(error);
      }
      setSubmitting(false);
      return;
    }
    try {
      await login(credentials);
      navigate('/company', { replace: true, state: { welcome: true } });
    } catch {
      navigate('/login', { replace: true });
    }
  };

  return (
    <div className="container auth-page">
      <div className="card auth-card">
        <h1 className="h2">Create a company account</h1>
        <p className="muted">
          Discover published student profiles and send students private feedback. Feedback is
          visible only to your company and the student.
        </p>
        {!!submitError && <ErrorAlert error={submitError} />}
        <form ref={formRef} onSubmit={handleSubmit} noValidate className="form">
          <TextField
            id="company-name"
            label="Company name"
            autoComplete="organization"
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            error={errors.companyName}
            maxLength={150}
            required
          />
          <TextField
            id="company-email"
            label="Work email"
            type="email"
            autoComplete="email"
            hint="Used to log in."
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={errors.email}
            maxLength={255}
            required
          />
          <TextField
            id="company-password"
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
            id="company-confirm"
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            error={errors.confirm}
            required
          />
          <button type="submit" className="button button-primary button-block" disabled={submitting}>
            {submitting ? 'Creating account…' : 'Create company account'}
          </button>
        </form>
        <p className="auth-switch">
          Already registered? <Link to="/login">Log in</Link>
        </p>
        <p className="auth-switch">
          Are you a student? <Link to="/register">Create a student account</Link>
        </p>
      </div>
    </div>
  );
}
