import { apiRequest } from './client';
import type {
  CompanySummary,
  DiscoveryQuery,
  DiscoveryResponse,
  LoginRequest,
  LoginResponse,
  Page,
  Project,
  ProjectInput,
  PublicStudentDetail,
  ReceivedFeedback,
  RegisterCompanyRequest,
  RegisterCompanyResponse,
  RegisterRequest,
  RegisterResponse,
  SentFeedback,
  Skill,
  StudentProfile,
  UpdateProfileRequest,
} from './types';

// The backend endpoints, grouped by area. Paths are relative to API_BASE_URL.

export const authApi = {
  register: (body: RegisterRequest) =>
    apiRequest<RegisterResponse>('/auth/register', { method: 'POST', body }),
  registerCompany: (body: RegisterCompanyRequest) =>
    apiRequest<RegisterCompanyResponse>('/auth/register/company', {
      method: 'POST',
      body,
    }),
  login: (body: LoginRequest) =>
    apiRequest<LoginResponse>('/auth/login', { method: 'POST', body }),
};

function pageQuery(page: number, limit: number): string {
  return `?page=${encodeURIComponent(String(page))}&limit=${encodeURIComponent(String(limit))}`;
}

export const companyApi = {
  me: (token: string, signal?: AbortSignal) =>
    apiRequest<CompanySummary>('/companies/me', { token, signal }),
};

/** Private feedback. Company routes and the student route are role-checked by the server. */
export const feedbackApi = {
  create: (token: string, studentProfileId: string, message: string) =>
    apiRequest<SentFeedback>('/feedback', {
      method: 'POST',
      token,
      body: { studentProfileId, message },
    }),
  listSent: (token: string, page: number, limit: number, signal?: AbortSignal) =>
    apiRequest<Page<SentFeedback>>(`/feedback/sent${pageQuery(page, limit)}`, {
      token,
      signal,
    }),
  update: (token: string, id: string, message: string) =>
    apiRequest<SentFeedback>(`/feedback/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      token,
      body: { message },
    }),
  remove: (token: string, id: string) =>
    apiRequest<void>(`/feedback/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      token,
    }),
  listReceived: (token: string, page: number, limit: number, signal?: AbortSignal) =>
    apiRequest<Page<ReceivedFeedback>>(
      `/students/me/feedback${pageQuery(page, limit)}`,
      { token, signal },
    ),
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
