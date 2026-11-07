import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../generated/prisma/client';

export const ROLES_KEY = 'roles';

/** Restricts a route to the given account roles. Use together with RolesGuard. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
