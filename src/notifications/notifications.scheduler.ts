import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificationsService } from './notifications.service';

@Injectable()
export class NotificationsScheduler {
  private readonly logger = new Logger(NotificationsScheduler.name);

  constructor(private readonly notifications: NotificationsService) {}

  // ----------------------------------------------------------------
  // Roda todo dia as 08h (horario de Brasilia = UTC-3 = 11h UTC)
  // ----------------------------------------------------------------
  @Cron('0 11 * * *', { timeZone: 'UTC' })
  async sendDailyReminders(): Promise<void> {
    this.logger.log('Cron lembretes 24h iniciado');
    await this.notifications.sendReminders();
    this.logger.log('Cron lembretes 24h concluido');
  }
}
