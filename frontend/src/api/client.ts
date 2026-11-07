const rawBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api';
export const API_BASE_URL = rawBaseUrl.replace(/\/+$/, '');

/** Error raised for any failed API call, including network failures. */
export class ApiError extends Error {
  readonly status: number;
  /** Individual validation messages returned by the backend, if any. */
  readonly details: string[];

  constructor(status: number, message: string, details: string[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }

  get isNetworkError(): boolean {
    return this.status === 0;
  }
}

/**
 * Converts a NestJS error body ({ statusCode, message, error }) into a
 * readable summary plus the individual validation messages.
 */
export function parseErrorBody(
  status: number,
  body: unknown,
): { message: string; details: string[] } {
  if (body && typeof body === 'object' && 'message' in body) {
    const raw = (body as { message: unknown }).message;
    if (Array.isArray(raw)) {
      const details = raw.filter((item): item is string => typeof item === 'string');
      if (details.length > 0) {
        return { message: 'Please correct the highlighted information.', details };
      }
    }
    if (typeof raw === 'string' && raw.trim()) {
      return { message: raw, details: [] };
    }
  }
  return { message: fallbackMessage(status), details: [] };
}

function fallbackMessage(status: number): string {
  if (status === 401) return 'Your session is not valid. Please log in again.';
  if (status === 403) return 'You do not have permission to do that.';
  if (status === 404) return 'The requested item was not found.';
  if (status >= 500) return 'The server had a problem. Please try again shortly.';
  return 'The request could not be completed.';
}

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

/** Registered by the auth provider so expired sessions are cleared globally. */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
  signal?: AbortSignal;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token, signal } = options;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(
      0,
      'Unable to reach the server. Check your connection and that the API is running.',
    );
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let data: unknown = undefined;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = undefined;
    }
  }

  if (!response.ok) {
    if (response.status === 401 && token && unauthorizedHandler) {
      unauthorizedHandler();
    }
    const { message, details } = parseErrorBody(response.status, data);
    throw new ApiError(response.status, message, details);
  }

  return data as T;
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'Something went wrong. Please try again.';
}
