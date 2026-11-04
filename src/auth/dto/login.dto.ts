import { IsEmail, IsString, MaxLength, Validate } from 'class-validator';
import { PasswordByteLength } from '../validators/password-byte-length.validator';

export class LoginDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @Validate(PasswordByteLength)
  password!: string;
}
