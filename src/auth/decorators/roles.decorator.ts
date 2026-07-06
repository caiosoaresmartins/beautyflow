import { SetMetadata } from '@nestjs/common';
import { ProfessionalRole } from '@prisma/client';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: ProfessionalRole[]) => SetMetadata(ROLES_KEY, roles);
