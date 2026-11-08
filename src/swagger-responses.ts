import { ApiProperty, ApiResponseOptions } from '@nestjs/swagger';
import { RATE_LIMITS } from './config/runtime-config';

export class SkillResponseDto {
  @ApiProperty({
    format: 'uuid',
    example: '9d5df266-8597-4d68-8eb5-8c52927079c1',
  })
  id!: string;

  @ApiProperty({ example: 'TypeScript' })
  name!: string;
}

export class RegisteredProfileSummaryDto {
  @ApiProperty({
    format: 'uuid',
    example: 'b71594fd-980a-41cc-8cf2-7b37fa298f11',
  })
  id!: string;

  @ApiProperty({ example: 'Student Example' })
  fullName!: string;

  @ApiProperty({ example: false })
  isPublic!: boolean;
}

export class RegisterResponseDto {
  @ApiProperty({
    format: 'uuid',
    example: '411cf357-ea9c-4eef-a693-e7add70bf043',
  })
  id!: string;

  @ApiProperty({ format: 'email', example: 'student@example.com' })
  email!: string;

  @ApiProperty({ type: RegisteredProfileSummaryDto })
  profile!: RegisteredProfileSummaryDto;
}

export class LoginResponseDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example.signature',
  })
  accessToken!: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType!: string;

  @ApiProperty({ example: 3600 })
  expiresIn!: number;

  @ApiProperty({
    enum: ['STUDENT', 'COMPANY'],
    example: 'STUDENT',
    description:
      'Account role, for choosing client pages only. Authorization is always enforced on the server.',
  })
  role!: 'STUDENT' | 'COMPANY';
}

export class CompanySummaryDto {
  @ApiProperty({
    format: 'uuid',
    example: 'c1a2b3c4-d5e6-4f70-8a9b-0c1d2e3f4a5b',
  })
  id!: string;

  @ApiProperty({ example: 'Example Tech Ltd' })
  name!: string;
}

export class CompanyRegisterResponseDto {
  @ApiProperty({
    format: 'uuid',
    example: '5e9c2b1a-4f3d-4c2b-9a1e-7d6c5b4a3f2e',
  })
  id!: string;

  @ApiProperty({ format: 'email', example: 'hiring@example.com' })
  email!: string;

  @ApiProperty({ enum: ['COMPANY'], example: 'COMPANY' })
  role!: 'COMPANY';

  @ApiProperty({ type: CompanySummaryDto })
  companyProfile!: CompanySummaryDto;
}

export class StudentProfileResponseDto {
  @ApiProperty({
    format: 'uuid',
    example: 'b71594fd-980a-41cc-8cf2-7b37fa298f11',
  })
  id!: string;

  @ApiProperty({ example: 'Student Example' })
  fullName!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    maxLength: 100,
    example: 'Backend Developer',
  })
  jobTitle!: string | null;

  @ApiProperty({ type: String, nullable: true, example: null })
  bio!: string | null;

  @ApiProperty({ type: String, nullable: true, example: null })
  location!: string | null;

  @ApiProperty({ type: String, nullable: true, format: 'email', example: null })
  contactEmail!: string | null;

  @ApiProperty({ type: String, nullable: true, format: 'uri', example: null })
  githubUrl!: string | null;

  @ApiProperty({ type: String, nullable: true, format: 'uri', example: null })
  portfolioUrl!: string | null;

  @ApiProperty({ example: false })
  isPublic!: boolean;

  @ApiProperty({ type: [SkillResponseDto], example: [] })
  skills!: SkillResponseDto[];
}

export class ProjectResponseDto {
  @ApiProperty({
    format: 'uuid',
    example: '4f3f4027-a226-46c2-b4f6-5520e07a31e1',
  })
  id!: string;

  @ApiProperty({ example: 'Portfolio Website' })
  title!: string;

  @ApiProperty({ type: String, nullable: true, example: null })
  description!: string | null;

  @ApiProperty({ type: String, nullable: true, format: 'uri', example: null })
  githubUrl!: string | null;

  @ApiProperty({ type: String, nullable: true, format: 'uri', example: null })
  demoUrl!: string | null;

  @ApiProperty({ format: 'date-time', example: '2026-01-01T12:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time', example: '2026-01-01T12:00:00.000Z' })
  updatedAt!: string;
}

export class PublicStudentResponseDto extends StudentProfileResponseDto {}

export class PublicStudentDetailResponseDto extends PublicStudentResponseDto {
  @ApiProperty({ type: [ProjectResponseDto], example: [] })
  projects!: ProjectResponseDto[];
}

export class DiscoveryMetaResponseDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 10 })
  limit!: number;

  @ApiProperty({ example: 24 })
  total!: number;

  @ApiProperty({ example: 3 })
  totalPages!: number;
}

export class StudentDiscoveryResponseDto {
  @ApiProperty({ type: [PublicStudentResponseDto] })
  data!: PublicStudentResponseDto[];

  @ApiProperty({ type: DiscoveryMetaResponseDto })
  meta!: DiscoveryMetaResponseDto;
}

export class FeedbackStudentSummaryDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Student profile ID (not the account user ID)',
    example: 'b71594fd-980a-41cc-8cf2-7b37fa298f11',
  })
  id!: string;

  @ApiProperty({ example: 'Student Example' })
  fullName!: string;
}

export class FeedbackCompanySummaryDto {
  @ApiProperty({ example: 'Example Tech Ltd' })
  name!: string;
}

/** Feedback as seen by the company that wrote it. */
export class SentFeedbackResponseDto {
  @ApiProperty({
    format: 'uuid',
    example: '0d8f3c2a-1b4e-4a6d-9c7b-2e5f8a1d3c4b',
  })
  id!: string;

  @ApiProperty({ example: 'Great API design in your portfolio project.' })
  message!: string;

  @ApiProperty({ format: 'date-time', example: '2026-01-01T12:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time', example: '2026-01-01T12:00:00.000Z' })
  updatedAt!: string;

  @ApiProperty({ type: FeedbackStudentSummaryDto })
  student!: FeedbackStudentSummaryDto;
}

/** Feedback as seen by the student it is addressed to. */
export class ReceivedFeedbackResponseDto {
  @ApiProperty({
    format: 'uuid',
    example: '0d8f3c2a-1b4e-4a6d-9c7b-2e5f8a1d3c4b',
  })
  id!: string;

  @ApiProperty({ example: 'Great API design in your portfolio project.' })
  message!: string;

  @ApiProperty({ format: 'date-time', example: '2026-01-01T12:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time', example: '2026-01-01T12:00:00.000Z' })
  updatedAt!: string;

  @ApiProperty({ type: FeedbackCompanySummaryDto })
  company!: FeedbackCompanySummaryDto;
}

export class SentFeedbackPageResponseDto {
  @ApiProperty({ type: [SentFeedbackResponseDto] })
  data!: SentFeedbackResponseDto[];

  @ApiProperty({ type: DiscoveryMetaResponseDto })
  meta!: DiscoveryMetaResponseDto;
}

export class ReceivedFeedbackPageResponseDto {
  @ApiProperty({ type: [ReceivedFeedbackResponseDto] })
  data!: ReceivedFeedbackResponseDto[];

  @ApiProperty({ type: DiscoveryMetaResponseDto })
  meta!: DiscoveryMetaResponseDto;
}

export class ApiErrorResponseDto {
  @ApiProperty()
  statusCode!: number;

  @ApiProperty({
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
  })
  message!: string | string[];

  @ApiProperty()
  error!: string;
}

// ---------------------------------------------------------------------------
// HTTP 429 documentation, generated from the enforced throttler settings so
// the documented limits always match RATE_LIMITS.
// ---------------------------------------------------------------------------

type RateLimit = { ttl: number; limit: number };

/** Human-readable limit, for example "10 requests per 15 minutes". */
export function describeRateLimit({ ttl, limit }: RateLimit): string {
  const minutes = ttl / 60_000;
  const window =
    minutes === 1
      ? 'minute'
      : minutes % 60 === 0
        ? minutes === 60
          ? 'hour'
          : `${minutes / 60} hours`
        : `${minutes} minutes`;
  return `${limit} requests per ${window}`;
}

function tooManyRequests(reason: string): ApiResponseOptions {
  return {
    type: ApiErrorResponseDto,
    description: `${reason} Wait for the number of seconds in the Retry-After header before retrying.`,
    headers: {
      'Retry-After': {
        description: 'Seconds to wait before the next request is accepted.',
        schema: { type: 'integer' },
      },
    },
  };
}

/** Every throttled route without a stricter limit. */
export const GENERAL_RATE_LIMIT_RESPONSE = tooManyRequests(
  `Rate limit exceeded: the general limit is ${describeRateLimit(RATE_LIMITS.default)} per client.`,
);

export const LOGIN_RATE_LIMIT_RESPONSE = tooManyRequests(
  `Rate limit exceeded: login allows ${describeRateLimit(RATE_LIMITS.login)} per client, and failed attempts count.`,
);

export const REGISTRATION_RATE_LIMIT_RESPONSE = tooManyRequests(
  `Rate limit exceeded: this registration route allows ${describeRateLimit(RATE_LIMITS.registration)} per client.`,
);

export const FEEDBACK_RATE_LIMIT_RESPONSE = tooManyRequests(
  `Rate limit exceeded: feedback creation allows ${describeRateLimit(RATE_LIMITS.feedback)} per client.`,
);
