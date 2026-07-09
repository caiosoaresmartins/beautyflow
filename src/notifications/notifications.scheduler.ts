import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

@Injectable()
export class NotificationsScheduler {
  private readonly logger = new Logger(NotificationsScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // ----------------------------------------------------------------
  // Roda todo dia as 08h (horario de Brasilia = UTC-3 = 11h UTC)
  // Busca agendamentos com startsAt entre 23h e 25h a partir de agora
  // (janela de 24h +-1h para tolerar pequenas variacoes de execucao)
  // ----------------------------------------------------------------
  @Cron('0 11 * * *', { timeZone: 'UTC' })
  async sendDailyReminders(): Promise<void> {
    const now = new Date();
    const from = new Date(now.getTime() + 23 * 60 * 60 * 1000); // +23h
    const until = new Date(now.getTime() + 25 * 60 * 60 * 1000); // +25h

    this.logger.log(`Cron lembretes 24h | janela: ${from.toISOString()} -> ${until.toISOString()}`);

    const bookings = await this.prisma.booking.findMany({
      where: {
        startsAt: { gte: from, lte: until },
        status: { not: 'CANCELLED' },
        reminderSentAt: null, // ainda nao enviado
      },
      include: {
        client: { select: { name: true, whatsappId: true } },
        professional: { select: { name: true } },
        service: { select: { name: true } },
        salon: { select: { name: true } },
      },
    });

    this.logger.log(`${bookings.length} agendamentos para lembrete`);

    let enviados = 0;
    let falhas = 0;

    for (const booking of bookings) {
      // Pula se client nao tiver whatsappId ou tiver optado por nao receber
      if (!booking.client?.whatsappId) {
        this.logger.warn(`Booking ${booking.id}: cliente sem whatsappId, pulando`);
        continue;
      }

      const sent = await this.notifications.sendReminder({
        bookingId: booking.id,
        clientName: booking.client.name,
        clientWhatsapp: booking.client.whatsappId,
        professionalName: booking.professional?.name ?? 'Profissional',
        serviceName: booking.service?.name ?? 'Servico',
        startsAt: booking.startsAt,
        salonName: booking.salon?.name ?? 'Salao',
      });

      if (sent) {
        // Marca reminderSentAt para nao enviar duplicado
        await this.prisma.booking.update({
          where: { id: booking.id },
          data: { reminderSentAt: new Date() },
        });
        enviados++;
      } else {
        falhas++;
      }
    }

    this.logger.log(`Lembretes concluidos | enviados=${enviados} falhas=${falhas}`);
  }
}
