// Client-side checks mirror the backend DTO rules so users get feedback
// before submitting. The backend remains the source of truth.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

/** Mirrors RegisterDto: 8+ characters, max 72 UTF-8 bytes, a letter and a number. */
export function passwordProblems(password: string): string[] {
  const problems: string[] = [];
  if (password.length < 8) problems.push('Use at least 8 characters.');
  if (utf8ByteLength(password) > 72) problems.push('Use at most 72 bytes.');
  if (!/[A-Za-z]/.test(password)) problems.push('Include at least one English letter.');
  if (!/[0-9]/.test(password)) problems.push('Include at least one number.');
  return problems;
}

/** Validates an optional URL; returns an error message or null. */
export function urlProblem(value: string, httpsOnly: boolean): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return 'Enter a full URL, including https://';
  }
  if (httpsOnly && url.protocol !== 'https:') return 'This link must start with https://';
  if (!httpsOnly && url.protocol !== 'https:' && url.protocol !== 'http:') {
    return 'This link must start with http:// or https://';
  }
  if (!url.hostname.includes('.')) return 'Enter a valid web address.';
  if (trimmed.length > 2048) return 'This link is too long (2,048 characters max).';
  return null;
}

/** Empty or whitespace-only text becomes null so nullable fields are cleared. */
export function toNullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
