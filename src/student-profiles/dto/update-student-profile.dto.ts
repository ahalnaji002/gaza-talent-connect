import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateStudentProfileDto {
  @ApiPropertyOptional({
    minLength: 2,
    maxLength: 150,
    example: 'Student Example',
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  fullName?: string;

  @ApiPropertyOptional({
    nullable: true,
    maxLength: 1000,
    example: 'Backend developer',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bio?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 150, example: 'Gaza' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  location?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    format: 'email',
    maxLength: 255,
    example: 'contact@example.com',
  })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  contactEmail?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    format: 'uri',
    maxLength: 2048,
    description: 'HTTPS URL only.',
    example: 'https://github.com/student',
  })
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  githubUrl?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    format: 'uri',
    maxLength: 2048,
    description: 'HTTP or HTTPS URL.',
    example: 'https://portfolio.example.com',
  })
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  portfolioUrl?: string | null;

  @ApiPropertyOptional({ example: false })
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  isPublic?: boolean;
}
