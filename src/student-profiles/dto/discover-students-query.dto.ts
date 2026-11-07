import { Transform, Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class DiscoverStudentsQueryDto {
  @ApiPropertyOptional({
    type: String,
    description: 'Comma-separated UUIDs; matches any requested skill.',
    example:
      '9d5df266-8597-4d68-8eb5-8c52927079c1,7f408d47-6bcd-44d7-a9f1-338291e962bb',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined) return undefined;
    return typeof value === 'string'
      ? value.split(',').map((skillId: string) => skillId.trim())
      : [];
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('all', { each: true })
  skillIds?: string[];

  @ApiPropertyOptional({ minimum: 1, default: 1, example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 10, example: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 10;
}
