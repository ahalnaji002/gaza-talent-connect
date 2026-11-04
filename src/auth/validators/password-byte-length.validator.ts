import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'PasswordByteLength', async: false })
export class PasswordByteLength implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && Buffer.byteLength(value, 'utf8') <= 72;
  }

  defaultMessage(): string {
    return 'password must not exceed 72 UTF-8 bytes';
  }
}
