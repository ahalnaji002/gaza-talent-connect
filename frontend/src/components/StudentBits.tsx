import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Skill, StudentProfile } from '../api/types';

/** Only http(s) links are rendered as anchors, so stored values can never run script URLs. */
export function safeHref(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export function ExternalLink({ href, children }: { href: string | null; children: ReactNode }) {
  const safe = safeHref(href);
  if (!safe) return null;
  return (
    <a href={safe} target="_blank" rel="noopener noreferrer" className="external-link">
      {children}
      <span className="visually-hidden"> (opens in a new tab)</span>
    </a>
  );
}

export function SkillTags({
  skills,
  highlight,
  emptyText = 'No skills listed yet.',
}: {
  skills: Skill[];
  highlight?: Set<string>;
  emptyText?: string;
}) {
  if (skills.length === 0) return <p className="muted small">{emptyText}</p>;
  const sorted = [...skills].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <ul className="tag-list" aria-label="Skills">
      {sorted.map((skill) => (
        <li key={skill.id} className={`tag${highlight?.has(skill.id) ? ' tag-match' : ''}`}>
          {skill.name}
        </li>
      ))}
    </ul>
  );
}

export function Avatar({ name, size = 'md' }: { name: string; size?: 'md' | 'lg' }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <span className={`avatar avatar-${size}`} aria-hidden="true">
      {initials || '?'}
    </span>
  );
}

export function StudentCard({
  student,
  highlight,
}: {
  student: StudentProfile;
  highlight?: Set<string>;
}) {
  return (
    <article className="card student-card">
      <header className="student-card-header">
        <Avatar name={student.fullName} />
        <div>
          <h3 className="student-card-name">
            <Link to={`/students/${student.id}`} className="stretched-link">
              {student.fullName}
            </Link>
          </h3>
          {student.jobTitle && <p className="job-title small">{student.jobTitle}</p>}
          {student.location && <p className="muted small">{student.location}</p>}
        </div>
      </header>
      {student.bio && <p className="student-card-bio">{student.bio}</p>}
      <SkillTags skills={student.skills} highlight={highlight} />
      <p className="student-card-cta" aria-hidden="true">
        View profile →
      </p>
    </article>
  );
}
