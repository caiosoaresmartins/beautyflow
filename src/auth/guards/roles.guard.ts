import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { ProfessionalRole } from '@prisma/client';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<ProfessionalRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Se nenhum @Roles() definido, apenas autenticação é necessária
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) throw new ForbiddenException('Sem permissão');

    const hasRole = requiredRoles.includes(user.role as ProfessionalRole);
    if (!hasRole) {
      throw new ForbiddenException(
        `Acesso negado. Role necessário: ${requiredRoles.join(' ou ')}. Seu role: ${user.role}`,
      );
    }
    return true;
  }
}
