import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { AsaasService } from './asaas.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [BillingController],
  providers: [BillingService, AsaasService],
  exports: [BillingService, AsaasService],
})
export class BillingModule {}
