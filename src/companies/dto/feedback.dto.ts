import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export const FEEDBACK_MESSAGE_MAX_LENGTH = 2000;

export class CreateFeedbackDto {
  @ApiProperty({
    format: 'uuid',
    description:
      'Student profile ID (not the account user ID) of a published profile.',
    example: 'b71594fd-980a-41cc-8cf2-7b37fa298f11',
  })
  @IsUUID('all')
  studentProfileId!: string;

  @ApiProperty({
    minLength: 1,
    maxLength: FEEDBACK_MESSAGE_MAX_LENGTH,
    description: 'Private message; surrounding whitespace is trimmed.',
    example: 'Great API design in your portfolio project.',
  })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(FEEDBACK_MESSAGE_MAX_LENGTH)
  message!: string;
}

export class UpdateFeedbackDto {
  @ApiProperty({
    minLength: 1,
    maxLength: FEEDBACK_MESSAGE_MAX_LENGTH,
    description: 'Replacement message; surrounding whitespace is trimmed.',
    example: 'Updated feedback message.',
  })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(FEEDBACK_MESSAGE_MAX_LENGTH)
  message!: string;
}

export class FeedbackPageQueryDto {
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
