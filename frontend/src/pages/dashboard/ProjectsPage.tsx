import { useEffect, useRef, useState, type FormEvent } from 'react';
import { projectsApi } from '../../api/endpoints';
import type { Project, ProjectInput } from '../../api/types';
import { useToken } from '../../auth/AuthContext';
import { Alert, EmptyState, ErrorAlert, LoadingState } from '../../components/Feedback';
import { TextAreaField, TextField } from '../../components/FormField';
import { ProjectSummary } from '../../components/ProjectSummary';
import { useApiData } from '../../hooks/useApiData';
import { focusFirstInvalid } from '../../utils/focus';
import { toNullable, urlProblem } from '../../utils/validation';

interface ProjectFormState {
  title: string;
  description: string;
  githubUrl: string;
  demoUrl: string;
}

const emptyForm: ProjectFormState = { title: '', description: '', githubUrl: '', demoUrl: '' };

function fromProject(project: Project): ProjectFormState {
  return {
    title: project.title,
    description: project.description ?? '',
    githubUrl: project.githubUrl ?? '',
    demoUrl: project.demoUrl ?? '',
  };
}

function validateProject(form: ProjectFormState) {
  const errors: Partial<Record<keyof ProjectFormState, string>> = {};
  const title = form.title.trim();
  if (title.length < 3) errors.title = 'Title must be at least 3 characters.';
  else if (title.length > 150) errors.title = 'Title must be 150 characters or fewer.';
  if (form.description.trim().length > 2000) {
    errors.description = 'Description must be 2,000 characters or fewer.';
  }
  const github = urlProblem(form.githubUrl, true);
  if (github) errors.githubUrl = github;
  const demo = urlProblem(form.demoUrl, false);
  if (demo) errors.demoUrl = demo;
  return errors;
}

function ProjectForm({
  idPrefix,
  initial,
  heading,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  idPrefix: string;
  initial: ProjectFormState;
  heading: string;
  submitLabel: string;
  onSubmit: (input: ProjectInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof ProjectFormState, string>>>({});
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const update = (key: keyof ProjectFormState, value: string) =>
    setForm((previous) => ({ ...previous, [key]: value }));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const nextErrors = validateProject(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      focusFirstInvalid(formRef.current);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit({
        title: form.title.trim(),
        description: toNullable(form.description),
        githubUrl: toNullable(form.githubUrl),
        demoUrl: toNullable(form.demoUrl),
      });
    } catch (error) {
      setSubmitError(error);
      setSubmitting(false);
    }
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="card form project-form">
      <h2 className="h3">{heading}</h2>
      {!!submitError && <ErrorAlert error={submitError} />}
      <TextField
        ref={titleRef}
        id={`${idPrefix}-title`}
        label="Title"
        value={form.title}
        onChange={(event) => update('title', event.target.value)}
        error={errors.title}
        maxLength={150}
        required
      />
      <TextAreaField
        id={`${idPrefix}-description`}
        label="Description"
        optional
        rows={4}
        value={form.description}
        onChange={(event) => update('description', event.target.value)}
        error={errors.description}
        maxLength={2000}
        hint={`${form.description.length}/2000 characters`}
      />
      <div className="field-row">
        <TextField
          id={`${idPrefix}-github`}
          label="Source code URL"
          optional
          type="url"
          value={form.githubUrl}
          onChange={(event) => update('githubUrl', event.target.value)}
          error={errors.githubUrl}
          hint="Must start with https://"
          placeholder="https://github.com/you/project"
        />
        <TextField
          id={`${idPrefix}-demo`}
          label="Live demo URL"
          optional
          type="url"
          value={form.demoUrl}
          onChange={(event) => update('demoUrl', event.target.value)}
          error={errors.demoUrl}
          placeholder="https://project.example.com"
        />
      </div>
      <div className="form-actions">
        <button type="submit" className="button button-primary" disabled={submitting}>
          {submitting ? 'Saving…' : submitLabel}
        </button>
        <button type="button" className="button button-ghost" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function DeleteControl({
  project,
  onDelete,
}: {
  project: Project;
  onDelete: (project: Project) => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Focus the safe choice first so a stray Enter never deletes anything.
  const keepRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirming) keepRef.current?.focus();
  }, [confirming]);

  if (!confirming) {
    return (
      <button type="button" className="button button-danger-ghost button-small" onClick={() => setConfirming(true)}>
        Delete
      </button>
    );
  }
  return (
    <span className="confirm-inline" role="group" aria-label={`Confirm deleting ${project.title}`}>
      <span className="small">Delete this project?</span>
      <button
        type="button"
        className="button button-danger button-small"
        disabled={deleting}
        onClick={async () => {
          setDeleting(true);
          try {
            await onDelete(project);
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

export function ProjectsPage() {
  const token = useToken();
  const projects = useApiData((signal) => projectsApi.listMine(token, signal), 'my-projects');
  const [mode, setMode] = useState<{ type: 'idle' } | { type: 'create' } | { type: 'edit'; id: string }>(
    { type: 'idle' },
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);

  if (projects.loading && !projects.data) return <LoadingState label="Loading projects…" />;
  if (projects.error || !projects.data) {
    return <ErrorAlert error={projects.error} onRetry={projects.reload} />;
  }
  const list = projects.data;

  const handleCreate = async (input: ProjectInput) => {
    const created = await projectsApi.create(token, input);
    projects.setData([created, ...list]);
    setMode({ type: 'idle' });
    setActionError(null);
    setNotice(`“${created.title}” was added.`);
  };

  const handleUpdate = async (id: string, input: ProjectInput) => {
    const updated = await projectsApi.update(token, id, input);
    projects.setData(list.map((project) => (project.id === id ? updated : project)));
    setMode({ type: 'idle' });
    setActionError(null);
    setNotice(`“${updated.title}” was updated.`);
  };

  const handleDelete = async (project: Project) => {
    setNotice(null);
    setActionError(null);
    try {
      await projectsApi.remove(token, project.id);
      projects.setData(list.filter((item) => item.id !== project.id));
      setNotice(`“${project.title}” was deleted.`);
    } catch (error) {
      setActionError(error);
    }
  };

  return (
    <div className="stack-lg">
      <div className="page-heading-row">
        <div>
          <h1 className="h2">My projects</h1>
          <p className="muted">Projects appear on your public profile, newest first.</p>
        </div>
        {mode.type !== 'create' && (
          <button
            type="button"
            className="button button-primary"
            onClick={() => {
              setMode({ type: 'create' });
              setNotice(null);
            }}
          >
            + Add project
          </button>
        )}
      </div>

      {notice && <Alert variant="success">{notice}</Alert>}
      {!!actionError && <ErrorAlert error={actionError} />}

      {mode.type === 'create' && (
        <ProjectForm
          idPrefix="new-project"
          initial={emptyForm}
          heading="New project"
          submitLabel="Add project"
          onSubmit={handleCreate}
          onCancel={() => setMode({ type: 'idle' })}
        />
      )}

      {list.length === 0 && mode.type !== 'create' && (
        <EmptyState
          title="No projects yet"
          action={
            <button type="button" className="button button-primary" onClick={() => setMode({ type: 'create' })}>
              Add your first project
            </button>
          }
        >
          Show what you have built — class work, personal projects or open-source contributions.
        </EmptyState>
      )}

      <div className="stack">
        {list.map((project) =>
          mode.type === 'edit' && mode.id === project.id ? (
            <ProjectForm
              key={project.id}
              idPrefix={`edit-${project.id}`}
              initial={fromProject(project)}
              heading={`Edit “${project.title}”`}
              submitLabel="Save changes"
              onSubmit={(input) => handleUpdate(project.id, input)}
              onCancel={() => setMode({ type: 'idle' })}
            />
          ) : (
            <ProjectSummary
              key={project.id}
              project={project}
              actions={
                <>
                  <button
                    type="button"
                    className="button button-secondary button-small"
                    onClick={() => {
                      setMode({ type: 'edit', id: project.id });
                      setNotice(null);
                    }}
                  >
                    Edit
                  </button>
                  <DeleteControl project={project} onDelete={handleDelete} />
                </>
              }
            />
          ),
        )}
      </div>
    </div>
  );
}
