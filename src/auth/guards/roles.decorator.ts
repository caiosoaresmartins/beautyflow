import { SetMetadata } from '@nestjs/common';
import { ProfessionalRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Decorador para restringir endpoints a roles específicos.
 *
 * @example
 * @Roles(ProfessionalRole.OWNER)
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Delete(':id')
 * remove(...) {}
 */
export const Roles = (...roles: ProfessionalRole[]) => SetMetadata(ROLES_KEY, roles);
