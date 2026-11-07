import type { ReactNode } from 'react';
import { ApiError } from '../api/client';

type AlertVariant = 'error' | 'success' | 'info';

interface AlertProps {
  variant: AlertVariant;
  title?: string;
  children?: ReactNode;
  details?: string[];
}

export function Alert({ variant, title, children, details }: AlertProps) {
  // Errors interrupt assistive tech; success and info are announced politely.
  const role = variant === 'error' ? 'alert' : 'status';
  return (
    <div className={`alert alert-${variant}`} role={role}>
      {title && <p className="alert-title">{title}</p>}
      {children && <div>{children}</div>}
      {details && details.length > 0 && (
        <ul className="alert-details">
          {details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Renders any thrown value from the API layer as a consistent error alert. */
export function ErrorAlert({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message =
    error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';
  const details = error instanceof ApiError ? error.details : [];
  return (
    <Alert variant="error" details={details}>
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="button button-secondary button-small" onClick={onRetry}>
          Try again
        </button>
      )}
    </Alert>
  );
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="loading-state" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ title, children, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <p className="empty-state-title">{title}</p>
      {children && <div className="empty-state-text">{children}</div>}
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
}
