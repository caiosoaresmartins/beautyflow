import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { ProfessionalRole } from '@prisma/client';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<ProfessionalRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Sem @Roles() decorator — acesso livre (mas ainda exige JWT)
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user?.role) throw new ForbiddenException('Sem permissão para acessar este recurso.');

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        `Requer perfil: ${requiredRoles.join(' ou ')}. Seu perfil: ${user.role}.`,
      );
    }
    return true;
  }
}
