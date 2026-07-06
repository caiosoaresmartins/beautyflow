import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppWebhookHandler } from './webhook.handler';
import { AiOrchestratorModule } from '../ai-orchestrator/ai-orchestrator.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../common/redis/redis.module';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    AiOrchestratorModule,   // fix: handler depende de AiOrchestratorService
    HttpModule.register({ timeout: 10_000, maxRedirects: 3 }),
  ],
  controllers: [WhatsAppController],
  providers: [WhatsAppService, WhatsAppWebhookHandler],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
