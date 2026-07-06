import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { AsaasService } from './asaas.service';
import { addMonths } from 'date-fns';

/** Eventos Asaas relevantes para o BeautyFlow */
const HANDLED_EVENTS = new Set([
  'PAYMENT_RECEIVED',
  'PAYMENT_CONFIRMED',
  'PAYMENT_OVERDUE',
  'PAYMENT_DELETED',
  'PAYMENT_REFUNDED',
  'SUBSCRIPTION_CREATED',
  'SUBSCRIPTION_UPDATED',
  'SUBSCRIPTION_DELETED',
  'SUBSCRIPTION_RENEWED',
]);

@Injectable()
export class BillingWebhookHandler {
  private readonly logger = new Logger(BillingWebhookHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly asaas: AsaasService,
  ) {}

  /** Valida token Bearer do webhook Asaas (delegado ao AsaasService) */
  validateToken(token: string): boolean {
    return this.asaas.validateWebhookSignature(token);
  }

  async handle(payload: any): Promise<void> {
    const eventId: string = payload?.id ?? payload?.payment?.id ?? `${Date.now()}`;
    const eventType: string = payload?.event;

    if (!HANDLED_EVENTS.has(eventType)) {
      this.logger.debug(`Evento Asaas ignorado: ${eventType}`);
      return;
    }

    // Idempotência via Redis SET NX — garante processamento único por evento
    const dedupKey = `asaas:event:${eventId}:${eventType}`;
    const isNew = await this.redis.setNx(dedupKey, '1', 86400 * 7); // TTL 7 dias
    if (!isNew) {
      this.logger.warn(`Evento Asaas duplicado ignorado: ${dedupKey}`);
      return;
    }

    // Persistir webhook bruto para auditoria
    await this.prisma.webhookEvent.upsert({
      where: { externalId: `asaas:${eventId}:${eventType}` },
      create: {
        source: 'ASAAS',
        externalId: `asaas:${eventId}:${eventType}`,
        payload,
        processedAt: new Date(),
      },
      update: { processedAt: new Date() },
    });

    // Roteamento de eventos
    switch (eventType) {
      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_CONFIRMED':
        await this.handlePaymentReceived(payload);
        break;
      case 'PAYMENT_OVERDUE':
        await this.handlePaymentOverdue(payload);
        break;
      case 'PAYMENT_REFUNDED':
      case 'PAYMENT_DELETED':
        await this.handlePaymentCancelled(payload);
        break;
      case 'SUBSCRIPTION_RENEWED':
        await this.handleSubscriptionRenewed(payload);
        break;
      case 'SUBSCRIPTION_DELETED':
        await this.handleSubscriptionDeleted(payload);
        break;
    }
  }

  private async handlePaymentReceived(payload: any): Promise<void> {
    const externalId: string = payload?.payment?.id;
    if (!externalId) return;

    // Atualiza Charge local
    const charge = await this.prisma.charge.findFirst({ where: { externalId } });
    if (charge) {
      await this.prisma.charge.update({
        where: { id: charge.id },
        data: { status: 'RECEIVED', paidAt: new Date() },
      });
      // Marca todos os splits como liquidados
      await this.prisma.chargeSplit.updateMany({
        where: { chargeId: charge.id },
        data: { status: 'SETTLED', settledAt: new Date() },
      });
    }

    // Se for cobrança de assinatura — recarrega créditos
    const externalRef: string = payload?.payment?.externalReference ?? '';
    if (externalRef.includes(':')) {
      const [clientId, planId] = externalRef.split(':');
      const plan = await this.prisma.plan.findFirst({ where: { id: planId } });
      if (plan && clientId) {
        await this.prisma.subscription.updateMany({
          where: { clientId, planId, status: { not: 'CANCELLED' } },
          data: {
            status: 'ACTIVE',
            creditsLeft: { increment: plan.bookingsPerMonth ?? 0 },
            currentPeriodEnd: addMonths(new Date(), 1),
          },
        });
        this.logger.log(
          `Créditos recarregados: cliente ${clientId} | plano ${plan.name} | +${plan.bookingsPerMonth} créditos`,
        );
      }
    }
  }

  private async handlePaymentOverdue(payload: any): Promise<void> {
    const externalId: string = payload?.payment?.id;
    if (!externalId) return;

    await this.prisma.charge.updateMany({
      where: { externalId },
      data: { status: 'OVERDUE' },
    });

    // Bloqueia agendamentos — marca assinatura como PAST_DUE
    const externalRef: string = payload?.payment?.externalReference ?? '';
    if (externalRef.includes(':')) {
      const [clientId, planId] = externalRef.split(':');
      const updated = await this.prisma.subscription.updateMany({
        where: { clientId, planId, status: 'ACTIVE' },
        data: { status: 'PAST_DUE' },
      });
      if (updated.count > 0) {
        this.logger.warn(
          `Assinatura bloqueada PAST_DUE: cliente ${clientId} | plano ${planId}`,
        );
      }
    }
  }

  private async handlePaymentCancelled(payload: any): Promise<void> {
    const externalId: string = payload?.payment?.id;
    if (!externalId) return;
    await this.prisma.charge.updateMany({
      where: { externalId },
      data: { status: 'CANCELLED' },
    });
  }

  private async handleSubscriptionRenewed(payload: any): Promise<void> {
    const asaasSubId: string = payload?.subscription?.id;
    if (!asaasSubId) return;
    await this.prisma.subscription.updateMany({
      where: { externalId: asaasSubId },
      data: {
        status: 'ACTIVE',
        currentPeriodEnd: addMonths(new Date(), 1),
      },
    });
    this.logger.log(`Assinatura renovada: ${asaasSubId}`);
  }

  private async handleSubscriptionDeleted(payload: any): Promise<void> {
    const asaasSubId: string = payload?.subscription?.id;
    if (!asaasSubId) return;
    await this.prisma.subscription.updateMany({
      where: { externalId: asaasSubId },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
    this.logger.log(`Assinatura cancelada pelo Asaas: ${asaasSubId}`);
  }
}
