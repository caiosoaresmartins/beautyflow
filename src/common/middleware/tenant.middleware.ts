import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * TenantMiddleware — garante que o salonId da rota coincide com o do JWT.
 * Registrar em módulos que tenham rotas /salons/:salonId/*
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request & { user?: { salonId: string; role: string } }, _res: Response, next: NextFunction) {
    const routeSalonId = req.params?.salonId;
    if (routeSalonId && req.user) {
      if (req.user.role !== 'OWNER' && req.user.salonId !== routeSalonId) {
        throw new ForbiddenException('Acesso negado: salonId não corresponde ao token.');
      }
    }
    next();
  }
}
