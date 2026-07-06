import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppWebhookHandler } from './webhook.handler';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../common/redis/redis.module';

@Module({
  imports: [PrismaModule, RedisModule, HttpModule],
  controllers: [WhatsAppController],
  providers: [WhatsAppService, WhatsAppWebhookHandler],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
