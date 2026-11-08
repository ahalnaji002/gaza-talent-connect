import { isIP } from 'node:net';
import { DEFAULT_IPV6_SUBNET_PREFIX, normalizeIp } from '@nestjs/throttler';

/**
 * Production runtime configuration. Everything here is a pure function of the
 * environment so it can be unit tested and fail fast at startup. Messages may
 * name variables and non-secret values (such as origins) but never secrets.
 */

export type AppEnvironment = 'production' | 'development' | 'test';

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

/** NODE_ENV=production enables production rules; test is used by the E2E runner. */
export function resolveEnvironment(
  nodeEnv: string | undefined,
): AppEnvironment {
  const value = nodeEnv?.trim().toLowerCase();
  if (value === 'production') return 'production';
  if (value === 'test') return 'test';
  return 'development';
}

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

/** Vite dev (5173) and preview (4173) servers, used only outside production. */
export const DEFAULT_DEVELOPMENT_CORS_ORIGINS: readonly string[] = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
];

/**
 * Validates one configured origin and returns its canonical form
 * (scheme://host[:port], lowercase host, no trailing slash).
 */
export function normalizeOrigin(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '');

  if (!trimmed) {
    throw new ConfigurationError('CORS_ORIGIN contains an empty origin');
  }
  if (trimmed.includes('*')) {
    throw new ConfigurationError(
      'CORS_ORIGIN must list exact origins; wildcards are not allowed',
    );
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new ConfigurationError(
      `CORS_ORIGIN has an invalid origin: "${trimmed}"`,
    );
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new ConfigurationError(
      `CORS_ORIGIN origins must use http or https: "${trimmed}"`,
    );
  }
  if (
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new ConfigurationError(
      `CORS_ORIGIN entries must be bare origins without paths, queries or credentials: "${trimmed}"`,
    );
  }

  return url.origin;
}

/**
 * Parses CORS_ORIGIN (comma-separated). Production requires at least one
 * HTTPS origin; development falls back to the local Vite origins.
 */
export function parseCorsOrigins(
  raw: string | undefined,
  environment: AppEnvironment,
): string[] {
  const entries = (raw ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (entries.length === 0) {
    if (environment === 'production') {
      throw new ConfigurationError(
        'CORS_ORIGIN is required in production (comma-separated HTTPS origins of the frontend)',
      );
    }
    return [...DEFAULT_DEVELOPMENT_CORS_ORIGINS];
  }

  const origins = [...new Set(entries.map(normalizeOrigin))];

  if (environment === 'production') {
    const insecure = origins.filter((origin) => !origin.startsWith('https://'));
    if (insecure.length > 0) {
      throw new ConfigurationError(
        `CORS_ORIGIN must use https in production: ${insecure.join(', ')}`,
      );
    }
  }

  return origins;
}

/** Exact-match allowlist check used by the CORS middleware. */
export function isAllowedOrigin(
  requestOrigin: string | undefined,
  allowedOrigins: readonly string[],
): boolean {
  return requestOrigin !== undefined && allowedOrigins.includes(requestOrigin);
}

// ---------------------------------------------------------------------------
// Swagger
// ---------------------------------------------------------------------------

export function parseBooleanFlag(
  name: string,
  raw: string | undefined,
  defaultValue: boolean,
): boolean {
  const value = raw?.trim().toLowerCase();
  if (value === undefined || value === '') return defaultValue;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  throw new ConfigurationError(`${name} must be "true" or "false"`);
}

/** Swagger is on by default locally and off by default in production. */
export function isSwaggerEnabled(
  raw: string | undefined,
  environment: AppEnvironment,
): boolean {
  return parseBooleanFlag('SWAGGER_ENABLED', raw, environment !== 'production');
}

// ---------------------------------------------------------------------------
// JWT secret
// ---------------------------------------------------------------------------

export const MIN_PRODUCTION_JWT_SECRET_LENGTH = 32;

/**
 * Returns the JWT secret or throws. Production requires at least 32
 * characters and rejects the .env.example placeholder. The secret itself is
 * never included in an error message.
 */
export function validateJwtSecret(
  raw: string | undefined,
  environment: AppEnvironment,
): string {
  if (!raw || raw.trim().length === 0) {
    throw new ConfigurationError('JWT_SECRET is not configured');
  }

  if (environment === 'production') {
    if (raw.length < MIN_PRODUCTION_JWT_SECRET_LENGTH) {
      throw new ConfigurationError(
        `JWT_SECRET must be at least ${MIN_PRODUCTION_JWT_SECRET_LENGTH} characters in production`,
      );
    }
    if (/REPLACE_WITH/i.test(raw)) {
      throw new ConfigurationError(
        'JWT_SECRET still contains the .env.example placeholder',
      );
    }
  }

  return raw;
}

// ---------------------------------------------------------------------------
// Client IP for rate limiting
// ---------------------------------------------------------------------------

/**
 * The only supported trusted client-IP header. Render documents that, for
 * public web services, Cloudflare writes CF-Connecting-IP on every request and
 * overwrites any value the caller sent.
 *
 * Not supported:
 * - X-Forwarded-For: proxies such as Render's append to it, so its leftmost
 *   entries are client-controlled.
 * - True-Client-IP: Render does not document that it is overwritten, so a
 *   client-supplied value could reach the application unchanged.
 */
export const SUPPORTED_CLIENT_IP_HEADERS = ['cf-connecting-ip'] as const;

export type ClientIpHeader = (typeof SUPPORTED_CLIENT_IP_HEADERS)[number];

/**
 * Parses CLIENT_IP_HEADER. Unset keeps the TCP peer address. A trusted header
 * is accepted only for a production deployment on Render (NODE_ENV=production
 * and RENDER=true, which Render sets automatically).
 *
 * The RENDER check guards against accidentally enabling the header locally or
 * on another host. It is not proof that requests passed through Cloudflare: if
 * the application is reachable directly, clients can still choose the header
 * value, so the header must only be enabled on a public Render web service.
 */
export function parseClientIpHeader(
  raw: string | undefined,
  environment: AppEnvironment,
  renderFlag: string | undefined,
): ClientIpHeader | null {
  const value = raw?.trim().toLowerCase();
  if (!value) return null;

  if (value === 'x-forwarded-for') {
    throw new ConfigurationError(
      'CLIENT_IP_HEADER cannot be X-Forwarded-For because clients can forge its entries; use cf-connecting-ip on a public Render web service',
    );
  }
  if (value === 'true-client-ip') {
    throw new ConfigurationError(
      'CLIENT_IP_HEADER cannot be True-Client-IP because Render does not document that it is overwritten; use cf-connecting-ip',
    );
  }
  if (!(SUPPORTED_CLIENT_IP_HEADERS as readonly string[]).includes(value)) {
    throw new ConfigurationError(
      `CLIENT_IP_HEADER must be ${SUPPORTED_CLIENT_IP_HEADERS.join(', ')} or unset`,
    );
  }
  if (
    environment !== 'production' ||
    renderFlag?.trim().toLowerCase() !== 'true'
  ) {
    throw new ConfigurationError(
      'CLIENT_IP_HEADER is only allowed when NODE_ENV=production and RENDER=true (a public Render web service); leave it unset elsewhere',
    );
  }

  return value as ClientIpHeader;
}

/** Express app setting that carries the configured header to the throttler. */
export const CLIENT_IP_HEADER_SETTING = 'gtc.clientIpHeader';

interface TrackableRequest {
  headers?: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
  app?: { get?: (setting: string) => unknown };
}

/**
 * Rate-limit key for a request. Uses the configured edge header only when it
 * holds exactly one valid IP; otherwise the TCP peer address. Express
 * `trust proxy` stays off, so X-Forwarded-For never influences the key.
 * IPv6 addresses are grouped by /64 so a client cannot rotate within its block.
 */
export function resolveClientIp(req: TrackableRequest): string {
  const header = req.app?.get?.(CLIENT_IP_HEADER_SETTING);

  if (typeof header === 'string') {
    const raw = req.headers?.[header];
    const value = typeof raw === 'string' ? raw.trim() : undefined;
    if (value && !value.includes(',') && isIP(value) !== 0) {
      return normalizeIp(value, DEFAULT_IPV6_SUBNET_PREFIX);
    }
  }

  const peer = req.socket?.remoteAddress;
  return peer
    ? normalizeIp(peer, DEFAULT_IPV6_SUBNET_PREFIX)
    : 'unknown-client';
}

// ---------------------------------------------------------------------------
// Rate limits (in-memory, per instance; reset on restart)
// ---------------------------------------------------------------------------

const MINUTE = 60_000;

export const RATE_LIMITS = {
  /** Every API route unless overridden: 120 requests per minute per client. */
  default: { ttl: MINUTE, limit: 120 },
  /** Login: 10 attempts per 15 minutes per client. */
  login: { ttl: 15 * MINUTE, limit: 10 },
  /** Student and company registration: 5 attempts per hour per client, per route. */
  registration: { ttl: 60 * MINUTE, limit: 5 },
  /** Company feedback creation: 20 requests per hour per client. */
  feedback: { ttl: 60 * MINUTE, limit: 20 },
} as const;
