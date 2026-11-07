import { describe, expect, it } from 'vitest';
import { parseErrorBody } from '../api/client';
import { buildDiscoveryQuery } from '../api/endpoints';
import { safeHref } from '../components/StudentBits';
import { isUuid, passwordProblems, toNullable, urlProblem } from './validation';

describe('parseErrorBody', () => {
  it('uses a string message from the backend', () => {
    expect(parseErrorBody(409, { statusCode: 409, message: 'Email is already registered' })).toEqual({
      message: 'Email is already registered',
      details: [],
    });
  });

  it('collects validation message arrays as details', () => {
    const result = parseErrorBody(400, {
      statusCode: 400,
      message: ['title must be longer than or equal to 3 characters'],
      error: 'Bad Request',
    });
    expect(result.details).toEqual(['title must be longer than or equal to 3 characters']);
  });

  it('falls back to a status-based message', () => {
    expect(parseErrorBody(500, undefined).message).toMatch(/server/i);
  });
});

describe('buildDiscoveryQuery', () => {
  it('omits skillIds when none are selected', () => {
    expect(buildDiscoveryQuery({ skillIds: [], page: 1, limit: 12 })).toBe('?page=1&limit=12');
  });

  it('joins skill IDs with commas', () => {
    expect(buildDiscoveryQuery({ skillIds: ['a', 'b'], page: 2 })).toBe(
      '?skillIds=a%2Cb&page=2',
    );
  });
});

describe('validation helpers', () => {
  it('mirrors the registration password rules', () => {
    expect(passwordProblems('Password1')).toEqual([]);
    expect(passwordProblems('short1')).toContain('Use at least 8 characters.');
    expect(passwordProblems('onlyletters')).toContain('Include at least one number.');
    expect(passwordProblems('12345678')).toContain('Include at least one English letter.');
  });

  it('enforces https for GitHub-style links', () => {
    expect(urlProblem('', true)).toBeNull();
    expect(urlProblem('https://github.com/student', true)).toBeNull();
    expect(urlProblem('http://github.com/student', true)).toMatch(/https/);
    expect(urlProblem('http://example.com', false)).toBeNull();
    expect(urlProblem('not a url', false)).not.toBeNull();
  });

  it('turns blank strings into null', () => {
    expect(toNullable('   ')).toBeNull();
    expect(toNullable(' Gaza ')).toBe('Gaza');
  });

  it('recognises UUIDs', () => {
    expect(isUuid('9d5df266-8597-4d68-8eb5-8c52927079c1')).toBe(true);
    expect(isUuid('42')).toBe(false);
  });
});

describe('safeHref', () => {
  it('only allows http and https links', () => {
    expect(safeHref('https://example.com/a')).toBe('https://example.com/a');
    expect(safeHref('javascript:alert(1)')).toBeNull();
    expect(safeHref(null)).toBeNull();
  });
});
