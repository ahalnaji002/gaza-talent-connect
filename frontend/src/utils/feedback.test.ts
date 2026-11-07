import { afterEach, describe, expect, it, vi } from 'vitest';
import { feedbackApi } from '../api/endpoints';
import { homePathFor } from '../auth/AuthContext';
import { FEEDBACK_MAX_LENGTH, feedbackProblem } from './validation';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('feedbackProblem', () => {
  it('rejects blank messages', () => {
    expect(feedbackProblem('')).not.toBeNull();
    expect(feedbackProblem('   \n ')).not.toBeNull();
  });

  it('accepts up to the backend limit after trimming', () => {
    expect(feedbackProblem(`  ${'a'.repeat(FEEDBACK_MAX_LENGTH)}  `)).toBeNull();
    expect(feedbackProblem('a'.repeat(FEEDBACK_MAX_LENGTH + 1))).toMatch(/2,000/);
  });
});

describe('homePathFor', () => {
  it('sends each account type to its own area', () => {
    expect(homePathFor('STUDENT')).toBe('/dashboard');
    expect(homePathFor('COMPANY')).toBe('/company');
  });
});

describe('feedbackApi', () => {
  it('uses the company and student feedback routes with pagination and bearer auth', async () => {
    // A Response body can be read once, so each call gets a fresh one.
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ data: [], meta: { page: 1, limit: 5, total: 0, totalPages: 0 } }),
          { status: 200 },
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await feedbackApi.listSent('company-token', 2, 5);
    await feedbackApi.listReceived('student-token', 1, 10);

    const calls = fetchMock.mock.calls as Array<[string, RequestInit]>;
    expect(calls[0][0]).toBe('/api/feedback/sent?page=2&limit=5');
    expect((calls[0][1].headers as Record<string, string>).Authorization).toBe(
      'Bearer company-token',
    );
    expect(calls[1][0]).toBe('/api/students/me/feedback?page=1&limit=10');
  });

  it('posts new feedback with only the student profile ID and message', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);

    await feedbackApi.create('company-token', 'profile-id', 'Nice work');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/feedback');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      studentProfileId: 'profile-id',
      message: 'Nice work',
    });
  });
});
