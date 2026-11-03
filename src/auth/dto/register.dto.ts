import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'PasswordByteLength', async: false })
class PasswordByteLength implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && Buffer.byteLength(value, 'utf8') <= 72;
  }

  defaultMessage(): string {
    return 'password must not exceed 72 UTF-8 bytes';
  }
}

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
