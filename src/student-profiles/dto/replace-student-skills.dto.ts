import { ArrayMaxSize, ArrayUnique, IsArray, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReplaceStudentSkillsDto {
  @ApiProperty({
    type: [String],
    format: 'uuid',
    maxItems: 20,
    uniqueItems: true,
    example: ['9d5df266-8597-4d68-8eb5-8c52927079c1'],
  })
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  skillIds!: string[];
}
