import {
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProjectDto {
  @ApiProperty({ minLength: 3, maxLength: 150, example: 'Portfolio Website' })
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  title!: string;

  @ApiPropertyOptional({
    nullable: true,
    maxLength: 2000,
    example: 'A portfolio built with NestJS.',
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
