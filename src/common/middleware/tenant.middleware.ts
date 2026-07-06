import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

declare global {
  namespace Express {
    interface Request {
      salonId?: string;
    }
  }
}

/**
 * TenantMiddleware — resolve salonId automaticamente pelo subdomínio.
 * Exemplo: barbearia-do-ze.beautyflow.app → resolve para o salonId correspondente.
 * Fallback: usa req.user.salonId (injetado pelo JwtAuthGuard).
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantMiddleware.name);
  private readonly cache = new Map<string, string>(); // subdomain → salonId

  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const host = req.hostname ?? '';
    const parts = host.split('.');

    // Formato: {subdomain}.beautyflow.app ou {subdomain}.localhost
    if (parts.length >= 2) {
      const subdomain = parts[0];
      // Ignorar subdomínios conhecidos do sistema
      if (!['www', 'api', 'app', 'localhost'].includes(subdomain)) {
        if (this.cache.has(subdomain)) {
          req.salonId = this.cache.get(subdomain);
        } else {
          try {
            const salon = await this.prisma.salon.findFirst({
              where: { slug: subdomain },
              select: { id: true },
            });
            if (salon) {
              this.cache.set(subdomain, salon.id);
              req.salonId = salon.id;
            }
          } catch (err) {
            this.logger.error('Erro ao resolver tenant', err);
          }
        }
      }
    }

    next();
  }
}
