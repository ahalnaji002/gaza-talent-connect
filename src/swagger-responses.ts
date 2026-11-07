import { ApiProperty } from '@nestjs/swagger';

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
}

export class StudentProfileResponseDto {
  @ApiProperty({
    format: 'uuid',
    example: 'b71594fd-980a-41cc-8cf2-7b37fa298f11',
  })
  id!: string;

  @ApiProperty({ example: 'Student Example' })
  fullName!: string;

  @ApiProperty({ nullable: true, example: null })
  bio!: string | null;

  @ApiProperty({ nullable: true, example: null })
  location!: string | null;

  @ApiProperty({ nullable: true, format: 'email', example: null })
  contactEmail!: string | null;

  @ApiProperty({ nullable: true, format: 'uri', example: null })
  githubUrl!: string | null;

  @ApiProperty({ nullable: true, format: 'uri', example: null })
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

  @ApiProperty({ nullable: true, example: null })
  description!: string | null;

  @ApiProperty({ nullable: true, format: 'uri', example: null })
  githubUrl!: string | null;

  @ApiProperty({ nullable: true, format: 'uri', example: null })
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
