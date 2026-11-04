import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  Validate,
} from 'class-validator';
import { PasswordByteLength } from '../validators/password-byte-length.validator';

export class RegisterDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Za-z])(?=.*[0-9])[\s\S]*$/, {
    message: 'password must contain at least one English letter and one number',
  })
  @Validate(PasswordByteLength)
  password!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(150)
  fullName!: string;
}
