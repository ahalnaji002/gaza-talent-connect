import { useMemo, useState } from 'react';
import { myProfileApi, skillsApi } from '../../api/endpoints';
import type { Skill } from '../../api/types';
import { useToken } from '../../auth/AuthContext';
import { Alert, EmptyState, ErrorAlert, LoadingState } from '../../components/Feedback';
import { useApiData } from '../../hooks/useApiData';

const MAX_SKILLS = 20;

function sameSelection(a: Set<string>, b: Set<string>) {
  return a.size === b.size && [...a].every((id) => b.has(id));
}

function SkillsEditor({
  catalog,
  initial,
  token,
}: {
  catalog: Skill[];
  initial: Skill[];
  token: string;
}) {
  const [saved, setSaved] = useState(() => new Set(initial.map((skill) => skill.id)));
  const [selected, setSelected] = useState(() => new Set(initial.map((skill) => skill.id)));
  const [filter, setFilter] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const dirty = !sameSelection(saved, selected);
  const atLimit = selected.size >= MAX_SKILLS;
  const visible = useMemo(() => {
    const term = filter.trim().toLowerCase();
    return term ? catalog.filter((skill) => skill.name.toLowerCase().includes(term)) : catalog;
  }, [catalog, filter]);

  const toggle = (id: string) => {
    setSuccess(null);
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_SKILLS) next.add(id);
      return next;
    });
  };

  const save = async () => {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    setSuccess(null);
    try {
      // PUT replaces the full list; an empty array clears every skill.
      const result = await myProfileApi.replaceSkills(token, [...selected]);
      const ids = new Set(result.map((skill) => skill.id));
      setSaved(ids);
      setSelected(new Set(ids));
      setSuccess(
        ids.size === 0
          ? 'All skills were removed from your profile.'
          : `Saved ${ids.size} ${ids.size === 1 ? 'skill' : 'skills'}.`,
      );
    } catch (error) {
      setSubmitError(error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="card form" aria-labelledby="skills-heading">
      <div className="card-heading-row">
        <h1 id="skills-heading" className="h2">
          Manage skills
        </h1>
        <p className={`counter${atLimit ? ' counter-full' : ''}`} aria-live="polite">
          {selected.size} / {MAX_SKILLS} selected
        </p>
      </div>
      <p className="muted">
        Choose up to {MAX_SKILLS} skills from the catalog. Employers can filter students by these
        skills.
      </p>

      {success && <Alert variant="success">{success}</Alert>}
      {!!submitError && <ErrorAlert error={submitError} />}
      {atLimit && (
        <Alert variant="info">You reached the limit. Unselect a skill to choose another.</Alert>
      )}

      {catalog.length > 8 && (
        <div className="field">
          <label htmlFor="skill-filter" className="field-label">
            Search skills
          </label>
          <input
            id="skill-filter"
            className="input"
            type="search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="e.g. React"
          />
        </div>
      )}

      <fieldset className="fieldset">
        <legend className="visually-hidden">Skills catalog</legend>
        {visible.length === 0 ? (
          <p className="muted">No skills match “{filter}”.</p>
        ) : (
          <div className="skill-options">
            {visible.map((skill) => {
              const checked = selected.has(skill.id);
              return (
                <label
                  key={skill.id}
                  className={`skill-option${checked ? ' skill-option-checked' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!checked && atLimit}
                    onChange={() => toggle(skill.id)}
                  />
                  <span>{skill.name}</span>
                </label>
              );
            })}
          </div>
        )}
      </fieldset>

      <div className="form-actions">
        <button
          type="button"
          className="button button-primary"
          onClick={save}
          disabled={submitting || !dirty}
        >
          {submitting ? 'Saving…' : 'Save skills'}
        </button>
        <button
          type="button"
          className="button button-ghost"
          disabled={submitting || selected.size === 0}
          onClick={() => {
            setSelected(new Set());
            setSuccess(null);
          }}
        >
          Clear selection
        </button>
        {dirty && !submitting && <span className="muted small">You have unsaved changes.</span>}
      </div>
    </section>
  );
}

export function SkillsPage() {
  const token = useToken();
  const catalog = useApiData((signal) => skillsApi.list(signal), 'skills');
  const profile = useApiData((signal) => myProfileApi.get(token, signal), 'me');

  if (catalog.loading || profile.loading) return <LoadingState label="Loading skills…" />;
  if (catalog.error || !catalog.data) {
    return <ErrorAlert error={catalog.error} onRetry={catalog.reload} />;
  }
  if (profile.error || !profile.data) {
    return <ErrorAlert error={profile.error} onRetry={profile.reload} />;
  }
  if (catalog.data.length === 0 && profile.data.skills.length === 0) {
    return (
      <EmptyState title="The skills catalog is empty">
        Skills will appear here once an administrator adds them.
      </EmptyState>
    );
  }
  return <SkillsEditor catalog={catalog.data} initial={profile.data.skills} token={token} />;
}
