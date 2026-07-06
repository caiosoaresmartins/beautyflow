import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * TenantMiddleware — garante que o salonId da rota bate com o salonId do JWT.
 * Aplica em rotas que contêm :salonId no path.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request & { user?: any }, res: Response, next: NextFunction) {
    const salonIdFromPath = req.params?.salonId;
    const salonIdFromJwt = req.user?.salonId;

    if (!salonIdFromPath) return next(); // rota sem :salonId, pular
    if (!salonIdFromJwt) return next(); // sem JWT (rota pública), pular

    if (salonIdFromPath !== salonIdFromJwt) {
      throw new BadRequestException(
        'O salonId da rota não corresponde ao salão do token JWT.',
      );
    }
    next();
  }
}

/**
 * Helper para usar em guards/services — extrai salonId com garantia
 */
export function withTenant(req: Request & { user?: any }): string {
  const salonId = req.user?.salonId;
  if (!salonId) throw new BadRequestException('salonId ausente no JWT.');
  return salonId;
}
