import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BillingController } from './billing.controller';
import { WebhookController } from './webhook.controller';
import { PlansController } from './plans.controller';
import { BillingService } from './billing.service';
import { AsaasService } from './asaas.service';
import { SubscriptionsService } from './subscriptions.service';
import { BillingWebhookHandler } from './webhook.handler';
import { BillingToolsService } from './billing-tools.service';
import { PlansService } from './plans.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../common/redis/redis.module';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    HttpModule.register({
      timeout: 10_000,
      maxRedirects: 3,
    }),
  ],
  controllers: [
    BillingController,
    WebhookController,
    PlansController,
  ],
  providers: [
    BillingService,
    AsaasService,
    SubscriptionsService,
    BillingWebhookHandler,
    BillingToolsService,
    PlansService,
  ],
  exports: [
    BillingService,
    SubscriptionsService,
    AsaasService,
    BillingToolsService,
    PlansService,
  ],
})
export class BillingModule {}
