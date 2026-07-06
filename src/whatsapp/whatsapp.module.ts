import { Module } from '@nestjs/common';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppService } from './whatsapp.service';
import { WebhookHandler } from './webhook.handler';
import { AiOrchestratorModule } from '../ai-orchestrator/ai-orchestrator.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ClientsModule } from '../clients/clients.module';
import { BookingsModule } from '../bookings/bookings.module';
import { AvailabilityModule } from '../common/availability/availability.module';

@Module({
  imports: [
    PrismaModule,
    AiOrchestratorModule,
    ClientsModule,
    BookingsModule,
    AvailabilityModule,
  ],
  controllers: [WhatsAppController],
  providers: [WhatsAppService, WebhookHandler],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
