import { Module, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { AiOrchestratorService } from './ai-orchestrator.service';
import { AvailabilityService } from './availability.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../common/redis/redis.module';

@Module({
  imports: [PrismaModule, RedisModule],
  providers: [AiOrchestratorService, AvailabilityService],
  exports: [AiOrchestratorService],
})
export class AiOrchestratorModule implements OnModuleInit {
  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly ai: AiOrchestratorService,
  ) {}

  /**
   * Injeta BillingToolsService de forma lazy após todos os módulos
   * serem inicializados (evita dependência circular).
   */
  async onModuleInit() {
    try {
      const { BillingToolsService } = await import('../billing/billing-tools.service');
      const billingTools = this.moduleRef.get(BillingToolsService, { strict: false });
      if (billingTools) {
        this.ai.billingTools = billingTools;
      }
    } catch {
      // BillingModule pode não estar carregado em testes unitários
    }
  }
}
