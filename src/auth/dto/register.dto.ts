import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  Validate,
} from 'class-validator';
import { PasswordByteLength } from '../validators/password-byte-length.validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({
    format: 'email',
    maxLength: 255,
    example: 'student@example.com',
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

  @ApiProperty({ minLength: 2, maxLength: 150, example: 'Student Example' })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  fullName!: string;
}
