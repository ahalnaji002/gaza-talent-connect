import { Request } from 'express';
import { UserRole } from '../../generated/prisma/client';

/** The identity attached to a request by JwtStrategy after a database lookup. */
export interface AuthenticatedUser {
  userId: string;
  role: UserRole;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
