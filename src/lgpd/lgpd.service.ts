import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LgpdService {
  private readonly logger = new Logger(LgpdService.name);

  constructor(private prisma: PrismaService) {}

  // ─── OPT-OUT ────────────────────────────────────────────────────────────────

  async optOut(clientId: string, salonId: string): Promise<void> {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, salonId, deletedAt: null },
    });
    if (!client) throw new NotFoundException('Cliente não encontrado.');

    await this.prisma.client.update({
      where: { id: clientId },
      data: { optedOut: true, optedOutAt: new Date() },
    });
    this.logger.log(`Opt-out registrado para cliente ${clientId}.`);
  }

  // ─── EXPORTAÇÃO DE DADOS (Art. 18 LGPD) ───────────────────────────────────

  async exportClientData(clientId: string, salonId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, salonId, deletedAt: null },
      include: {
        bookings: {
          select: {
            id: true, startsAt: true, endsAt: true, status: true,
            service: { select: { name: true } },
            professional: { select: { name: true } },
          },
          where: { deletedAt: null },
          orderBy: { startsAt: 'desc' },
        },
        conversations: {
          select: { role: true, content: true, createdAt: true },
          where: { expiresAt: { gt: new Date() } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!client) throw new NotFoundException('Cliente não encontrado.');

    // Remover dados sensíveis do export
    const { cpf: _, ...safeClient } = client as any;
    return safeClient;
  }

  // ─── ANONIMIZAÇÃO HARD DELETE (Art. 16 LGPD) ───────────────────────────────

  async anonymizeClient(clientId: string, salonId: string): Promise<void> {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, salonId },
    });
    if (!client) throw new NotFoundException('Cliente não encontrado.');

    await this.prisma.$transaction([
      // Apagar histórico de conversa
      this.prisma.conversationMessage.deleteMany({ where: { clientId } }),

      // Anonimizar dados pessoais — manter agendamentos (histórico financeiro)
      this.prisma.client.update({
        where: { id: clientId },
        data: {
          name: 'REMOVIDO',
          whatsappId: null,
          email: null,
          phone: null,
          cpf: null,
          notes: null,
          optedOut: true,
          deletedAt: new Date(),
        },
      }),
    ]);
    this.logger.log(`Cliente ${clientId} anonimizado conforme LGPD.`);
  }

  // ─── CRON: ANONIMIZAR CLIENTES COM SOFT DELETE > 30 DIAS ────────────────────

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanDeletedClients(): Promise<void> {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const toAnonymize = await this.prisma.client.findMany({
      where: { deletedAt: { lte: cutoff }, name: { not: 'REMOVIDO' } },
      select: { id: true, salonId: true },
      take: 100,
    });

    for (const client of toAnonymize) {
      await this.anonymizeClient(client.id, client.salonId).catch((e) =>
        this.logger.error(`Erro ao anonimizar ${client.id}: ${e.message}`),
      );
    }

    if (toAnonymize.length > 0) {
      this.logger.log(`LGPD: ${toAnonymize.length} clientes anonimizados.`);
    }
  }

  // ─── CRON: DELETAR MENSAGENS EXPIRADAS ──────────────────────────────────────

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async cleanExpiredConversations(): Promise<void> {
    const result = await this.prisma.conversationMessage.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });
    if (result.count > 0) {
      this.logger.log(`LGPD: ${result.count} mensagens expiradas removidas.`);
    }
  }
}
