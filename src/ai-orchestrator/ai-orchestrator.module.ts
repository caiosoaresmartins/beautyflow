import { Module } from '@nestjs/common';
import { AiOrchestratorService } from './ai-orchestrator.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AvailabilityModule } from '../common/availability/availability.module';
import { BookingsModule } from '../bookings/bookings.module';

@Module({
  imports: [PrismaModule, AvailabilityModule, BookingsModule],
  providers: [AiOrchestratorService],
  exports: [AiOrchestratorService],
})
export class AiOrchestratorModule {}
