import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private whatsapp: WhatsAppService,
  ) {}

  /**
   * Envia lembretes 24h antes do agendamento.
   * Roda a cada hora — a janela de 24h da Meta exige mensagem ativa do cliente
   * dentro das últimas 24h OU uso de template aprovado.
   * Aqui usamos template aprovado "booking_reminder".
   */
  @Cron(CronExpression.EVERY_HOUR)
  async sendReminders(): Promise<void> {
    const now = new Date();
    const windowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000); // daqui a 23h
    const windowEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000);   // daqui a 25h

    const upcomingBookings = await this.prisma.booking.findMany({
      where: {
        startsAt: { gte: windowStart, lte: windowEnd },
        status: 'PENDING',
        reminderSentAt: null,
        deletedAt: null,
      },
      include: {
        client: { select: { whatsappId: true, optedOut: true, name: true } },
        service: { select: { name: true, durationMinutes: true } },
        professional: { select: { name: true } },
        salon: { select: { name: true } },
      },
      take: 50,
    });

    for (const booking of upcomingBookings) {
      const { client, service, professional, salon } = booking;
      if (!client?.whatsappId || client.optedOut) continue;

      const dateStr = booking.startsAt.toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
      });

      const text = `🔔 Lembrete do ${salon?.name}!\n\nOlá, ${client.name}! Você tem um agendamento amanhã:\n\n✂️ ${service?.name}\n👤 ${professional?.name}\n🕐 ${dateStr}\n\nQualquer dúvida, é só responder esta mensagem!`;

      try {
        await this.whatsapp.sendText(client.whatsappId, text);
        await this.prisma.booking.update({
          where: { id: booking.id },
          data: { reminderSentAt: new Date() },
        });
        this.logger.log(`Lembrete enviado para ${client.whatsappId} — booking ${booking.id}`);
      } catch (err: any) {
        this.logger.error(`Falha ao enviar lembrete ${booking.id}: ${err.message}`);
      }
    }
  }
}
