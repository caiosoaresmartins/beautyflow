import { Module } from '@nestjs/common';
import { AiOrchestratorService } from './ai-orchestrator.service';
import { AvailabilityService } from './availability.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../common/redis/redis.module';

@Module({
  imports: [PrismaModule, RedisModule],
  providers: [AiOrchestratorService, AvailabilityService],
  exports: [AiOrchestratorService],
})
export class AiOrchestratorModule {}
