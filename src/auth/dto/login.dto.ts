import { IsEmail, IsString, MaxLength, Validate } from 'class-validator';
import { PasswordByteLength } from '../validators/password-byte-length.validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    format: 'email',
    maxLength: 255,
    example: 'student@example.com',
  })
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({
    maxLength: 72,
    description: 'Maximum 72 UTF-8 bytes; invalid credentials return 401.',
    example: 'ExamplePass123',
  })
  @IsString()
  @Validate(PasswordByteLength)
  password!: string;
}
