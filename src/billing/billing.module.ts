import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { AsaasService } from './asaas.service';
import { SubscriptionsService } from './subscriptions.service';
import { BillingWebhookHandler } from './webhook.handler';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../common/redis/redis.module';

@Module({
  imports: [PrismaModule, RedisModule, HttpModule],
  controllers: [BillingController],
  providers: [
    BillingService,
    AsaasService,
    SubscriptionsService,
    BillingWebhookHandler,
  ],
  exports: [BillingService, SubscriptionsService, AsaasService],
})
export class BillingModule {}
