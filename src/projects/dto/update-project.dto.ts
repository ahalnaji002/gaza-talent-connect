import {
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProjectDto {
  @ApiPropertyOptional({
    minLength: 3,
    maxLength: 150,
    example: 'Portfolio Website',
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  title?: string;

  @ApiPropertyOptional({
    nullable: true,
    maxLength: 2000,
    example: 'Updated project summary.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    format: 'uri',
    description: 'HTTPS URL only.',
    example: 'https://github.com/student/portfolio',
  })
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  githubUrl?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    format: 'uri',
    description: 'HTTP or HTTPS URL.',
    example: 'https://portfolio.example.com',
  })
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  demoUrl?: string | null;
}
