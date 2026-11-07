// Types mirror the backend response DTOs in src/swagger-responses.ts.

export interface Skill {
  id: string;
  name: string;
}

export interface RegisterRequest {
  fullName: string;
  email: string;
  password: string;
}

export interface RegisterResponse {
  /** Account (user) ID — never used for public profile routes. */
  id: string;
  email: string;
  profile: {
    /** Student profile ID. */
    id: string;
    fullName: string;
    isPublic: boolean;
  };
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
}

/** Shape returned by GET/PATCH /students/me and in discovery results. */
export interface StudentProfile {
  /** Student profile ID (not the account user ID). */
  id: string;
  fullName: string;
  bio: string | null;
  location: string | null;
  contactEmail: string | null;
  githubUrl: string | null;
  portfolioUrl: string | null;
  isPublic: boolean;
  skills: Skill[];
}

export interface UpdateProfileRequest {
  fullName?: string;
  bio?: string | null;
  location?: string | null;
  contactEmail?: string | null;
  githubUrl?: string | null;
  portfolioUrl?: string | null;
  isPublic?: boolean;
}

export interface Project {
  id: string;
  title: string;
  description: string | null;
  githubUrl: string | null;
  demoUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectInput {
  title: string;
  description: string | null;
  githubUrl: string | null;
  demoUrl: string | null;
}

export interface PublicStudentDetail extends StudentProfile {
  projects: Project[];
}

export interface DiscoveryMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface DiscoveryResponse {
  data: StudentProfile[];
  meta: DiscoveryMeta;
}

export interface DiscoveryQuery {
  skillIds?: string[];
  page?: number;
  limit?: number;
}
