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

export class DiscoverStudentsQueryDto {
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

  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 10;
}
