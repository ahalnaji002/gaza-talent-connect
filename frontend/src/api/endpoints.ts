import { apiRequest } from './client';
import type {
  DiscoveryQuery,
  DiscoveryResponse,
  LoginRequest,
  LoginResponse,
  Project,
  ProjectInput,
  PublicStudentDetail,
  RegisterRequest,
  RegisterResponse,
  Skill,
  StudentProfile,
  UpdateProfileRequest,
} from './types';

// The 12 backend endpoints, grouped by area. Paths are relative to API_BASE_URL.

export const authApi = {
  register: (body: RegisterRequest) =>
    apiRequest<RegisterResponse>('/auth/register', { method: 'POST', body }),
  login: (body: LoginRequest) =>
    apiRequest<LoginResponse>('/auth/login', { method: 'POST', body }),
};

export const skillsApi = {
  list: (signal?: AbortSignal) => apiRequest<Skill[]>('/skills', { signal }),
};

export const myProfileApi = {
  get: (token: string, signal?: AbortSignal) =>
    apiRequest<StudentProfile>('/students/me', { token, signal }),
  update: (token: string, body: UpdateProfileRequest) =>
    apiRequest<StudentProfile>('/students/me', { method: 'PATCH', token, body }),
  replaceSkills: (token: string, skillIds: string[]) =>
    apiRequest<Skill[]>('/students/me/skills', {
      method: 'PUT',
      token,
      body: { skillIds },
    }),
};

export const projectsApi = {
  listMine: (token: string, signal?: AbortSignal) =>
    apiRequest<Project[]>('/projects/me', { token, signal }),
  create: (token: string, body: ProjectInput) =>
    apiRequest<Project>('/projects', { method: 'POST', token, body }),
  update: (token: string, id: string, body: ProjectInput) =>
    apiRequest<Project>(`/projects/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      token,
      body,
    }),
  remove: (token: string, id: string) =>
    apiRequest<void>(`/projects/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      token,
    }),
};

export function buildDiscoveryQuery({ skillIds, page, limit }: DiscoveryQuery): string {
  const params = new URLSearchParams();
  // The backend rejects an empty skillIds value, so omit it when none are chosen.
  if (skillIds && skillIds.length > 0) params.set('skillIds', skillIds.join(','));
  if (page !== undefined) params.set('page', String(page));
  if (limit !== undefined) params.set('limit', String(limit));
  const query = params.toString();
  return query ? `?${query}` : '';
}

export const publicStudentsApi = {
  discover: (query: DiscoveryQuery, signal?: AbortSignal) =>
    apiRequest<DiscoveryResponse>(`/students${buildDiscoveryQuery(query)}`, { signal }),
  /** Uses the student profile ID, not the account user ID. */
  getById: (profileId: string, signal?: AbortSignal) =>
    apiRequest<PublicStudentDetail>(`/students/${encodeURIComponent(profileId)}`, {
      signal,
    }),
};
