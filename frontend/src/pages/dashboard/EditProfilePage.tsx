import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { myProfileApi } from '../../api/endpoints';
import type { StudentProfile } from '../../api/types';
import { useToken } from '../../auth/AuthContext';
import { Alert, ErrorAlert, LoadingState } from '../../components/Feedback';
import { TextAreaField, TextField } from '../../components/FormField';
import { useApiData } from '../../hooks/useApiData';
import { focusFirstInvalid } from '../../utils/focus';
import {
  JOB_TITLE_MAX_LENGTH,
  isValidEmail,
  toNullable,
  urlProblem,
} from '../../utils/validation';

interface FormState {
  fullName: string;
  jobTitle: string;
  bio: string;
  location: string;
  contactEmail: string;
  githubUrl: string;
  portfolioUrl: string;
  isPublic: boolean;
}

function toFormState(profile: StudentProfile): FormState {
  return {
    fullName: profile.fullName,
    jobTitle: profile.jobTitle ?? '',
    bio: profile.bio ?? '',
    location: profile.location ?? '',
    contactEmail: profile.contactEmail ?? '',
    githubUrl: profile.githubUrl ?? '',
    portfolioUrl: profile.portfolioUrl ?? '',
    isPublic: profile.isPublic,
  };
}

function validate(form: FormState): Partial<Record<keyof FormState, string>> {
  const errors: Partial<Record<keyof FormState, string>> = {};
  const name = form.fullName.trim();
  if (name.length < 2) errors.fullName = 'Enter your full name (at least 2 characters).';
  else if (name.length > 150) errors.fullName = 'Full name must be 150 characters or fewer.';
  if (form.jobTitle.trim().length > JOB_TITLE_MAX_LENGTH) {
    errors.jobTitle = 'Job title must be 100 characters or fewer.';
  }
  if (form.bio.trim().length > 1000) errors.bio = 'Bio must be 1,000 characters or fewer.';
  if (form.location.trim().length > 150) {
    errors.location = 'Location must be 150 characters or fewer.';
  }
  const email = form.contactEmail.trim();
  if (email && !isValidEmail(email)) errors.contactEmail = 'Enter a valid email address.';
  else if (email.length > 255) errors.contactEmail = 'Email must be 255 characters or fewer.';
  else if (form.isPublic && !email) {
    errors.contactEmail = 'A contact email is required to publish your profile.';
  }
  const github = urlProblem(form.githubUrl, true);
  if (github) errors.githubUrl = github;
  const portfolio = urlProblem(form.portfolioUrl, false);
  if (portfolio) errors.portfolioUrl = portfolio;
  return errors;
}

function ProfileForm({ initial, token }: { initial: StudentProfile; token: string }) {
  const [saved, setSaved] = useState<StudentProfile>(initial);
  const [form, setForm] = useState<FormState>(() => toFormState(initial));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    setSuccess(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const nextErrors = validate(form);
    setErrors(nextErrors);
    setSuccess(null);
    if (Object.keys(nextErrors).length > 0) {
      focusFirstInvalid(formRef.current);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      // Empty optional fields are sent as null so the backend clears them.
      const updated = await myProfileApi.update(token, {
        fullName: form.fullName.trim(),
        jobTitle: toNullable(form.jobTitle),
        bio: toNullable(form.bio),
        location: toNullable(form.location),
        contactEmail: toNullable(form.contactEmail),
        githubUrl: toNullable(form.githubUrl),
        portfolioUrl: toNullable(form.portfolioUrl),
        isPublic: form.isPublic,
      });
      setSaved(updated);
      setForm(toFormState(updated));
      setSuccess(
        updated.isPublic
          ? 'Profile saved. Your profile is public and can be discovered.'
          : 'Profile saved. Your profile is hidden from public discovery.',
      );
    } catch (error) {
      setSubmitError(error);
    } finally {
      setSubmitting(false);
    }
  };

  const publishBlocked = form.isPublic && !isValidEmail(form.contactEmail);

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="form card">
      <div className="card-heading-row">
        <h1 className="h2">Edit profile</h1>
        {saved.isPublic && (
          <Link to={`/students/${saved.id}`} className="small">
            View public profile
          </Link>
        )}
      </div>

      <fieldset className="fieldset">
        <legend className="h3">About you</legend>
        <TextField
          id="profile-name"
          label="Full name"
          value={form.fullName}
          onChange={(event) => update('fullName', event.target.value)}
          error={errors.fullName}
          maxLength={150}
          autoComplete="name"
          required
        />
        <TextField
          id="profile-job-title"
          label="Job title"
          optional
          value={form.jobTitle}
          onChange={(event) => update('jobTitle', event.target.value)}
          error={errors.jobTitle}
          maxLength={JOB_TITLE_MAX_LENGTH}
          placeholder="e.g. Backend Developer"
          hint="Shown on your public profile and discovery card. Not required to publish."
        />
        <TextField
          id="profile-location"
          label="Location"
          optional
          value={form.location}
          onChange={(event) => update('location', event.target.value)}
          error={errors.location}
          maxLength={150}
          placeholder="e.g. Gaza City"
        />
        <TextAreaField
          id="profile-bio"
          label="Bio"
          optional
          rows={5}
          value={form.bio}
          onChange={(event) => update('bio', event.target.value)}
          error={errors.bio}
          maxLength={1000}
          hint={`${form.bio.length}/1000 characters`}
          placeholder="What do you study, build, or want to work on?"
        />
      </fieldset>

      <fieldset className="fieldset">
        <legend className="h3">Contact and links</legend>
        <TextField
          id="profile-contact"
          label="Contact email"
          optional
          type="email"
          value={form.contactEmail}
          onChange={(event) => update('contactEmail', event.target.value)}
          error={errors.contactEmail}
          maxLength={255}
          hint="Shown on your public profile. It can differ from your login email, which is never shown."
        />
        <TextField
          id="profile-github"
          label="GitHub URL"
          optional
          type="url"
          value={form.githubUrl}
          onChange={(event) => update('githubUrl', event.target.value)}
          error={errors.githubUrl}
          hint="Must start with https://"
          placeholder="https://github.com/your-name"
        />
        <TextField
          id="profile-portfolio"
          label="Portfolio URL"
          optional
          type="url"
          value={form.portfolioUrl}
          onChange={(event) => update('portfolioUrl', event.target.value)}
          error={errors.portfolioUrl}
          placeholder="https://your-portfolio.com"
        />
      </fieldset>

      <fieldset className="fieldset">
        <legend className="h3">Visibility</legend>
        <label className="toggle">
          <input
            type="checkbox"
            checked={form.isPublic}
            onChange={(event) => update('isPublic', event.target.checked)}
            aria-describedby="visibility-help"
          />
          <span className="toggle-track" aria-hidden="true" />
          <span>Make my profile public</span>
        </label>
        <p id="visibility-help" className="field-hint">
          Public profiles appear in talent discovery with your bio, skills, projects, links and
          contact email. Publishing requires a valid contact email. You can hide your profile
          again at any time.
        </p>
        {publishBlocked && !errors.contactEmail && (
          <p className="field-error">Add a valid contact email above to publish.</p>
        )}
      </fieldset>

      {/* Save results sit next to the Save button so they are seen on long forms. */}
      {success && <Alert variant="success">{success}</Alert>}
      {!!submitError && <ErrorAlert error={submitError} />}

      <div className="form-actions">
        <button type="submit" className="button button-primary" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save profile'}
        </button>
        <button
          type="button"
          className="button button-ghost"
          disabled={submitting}
          onClick={() => {
            setForm(toFormState(saved));
            setErrors({});
            setSuccess(null);
            setSubmitError(null);
          }}
        >
          Discard changes
        </button>
      </div>
    </form>
  );
}

export function EditProfilePage() {
  const token = useToken();
  const profile = useApiData((signal) => myProfileApi.get(token, signal), 'me');

  if (profile.loading) return <LoadingState label="Loading your profile…" />;
  if (profile.error || !profile.data) {
    return <ErrorAlert error={profile.error} onRetry={profile.reload} />;
  }
  return <ProfileForm initial={profile.data} token={token} />;
}
