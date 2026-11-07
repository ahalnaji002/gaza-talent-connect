import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  Validate,
} from 'class-validator';
import { PasswordByteLength } from '../validators/password-byte-length.validator';

export class RegisterCompanyDto {
  @ApiProperty({ minLength: 2, maxLength: 150, example: 'Example Tech Ltd' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  companyName!: string;

  @ApiProperty({
    format: 'email',
    maxLength: 255,
    example: 'hiring@example.com',
  })
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({
    minLength: 8,
    maxLength: 72,
    description:
      '8–72 UTF-8 bytes; must contain an English letter and a number.',
    example: 'ExamplePass123',
  })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Za-z])(?=.*[0-9])[\s\S]*$/, {
    message: 'password must contain at least one English letter and one number',
  })
  @Validate(PasswordByteLength)
  password!: string;
}
