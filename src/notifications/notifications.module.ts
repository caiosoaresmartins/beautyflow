import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { PrismaModule } from '../prisma/prisma.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [PrismaModule, WhatsAppModule],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
