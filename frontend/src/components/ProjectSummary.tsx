import type { ReactNode } from 'react';
import type { Project } from '../api/types';
import { ExternalLink, safeHref } from './StudentBits';

const dateFormatter = new Intl.DateTimeFormat('en', { dateStyle: 'medium' });

export function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : dateFormatter.format(date);
}

export function ProjectSummary({ project, actions }: { project: Project; actions?: ReactNode }) {
  const hasLinks = safeHref(project.githubUrl) !== null || safeHref(project.demoUrl) !== null;
  return (
    <article className="card project-card">
      <div className="project-card-header">
        <h3 className="project-title">{project.title}</h3>
        {actions && <div className="project-actions">{actions}</div>}
      </div>
      {project.description && <p className="prewrap">{project.description}</p>}
      <div className="project-footer">
        {hasLinks && (
          <ul className="inline-links">
            {safeHref(project.githubUrl) && (
              <li>
                <ExternalLink href={project.githubUrl}>Source code</ExternalLink>
              </li>
            )}
            {safeHref(project.demoUrl) && (
              <li>
                <ExternalLink href={project.demoUrl}>Live demo</ExternalLink>
              </li>
            )}
          </ul>
        )}
        <p className="muted small">Added {formatDate(project.createdAt)}</p>
      </div>
    </article>
  );
}
