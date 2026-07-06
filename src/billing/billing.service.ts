import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AsaasService } from './asaas.service';
import { toNumber } from '../common/helpers/decimal.helper';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private prisma: PrismaService,
    private asaas: AsaasService,
  ) {}

  /** Cria assinatura recorrente para o cliente (ex: Clube da Barba) */
  async createSubscription(salonId: string, clientId: string, planId: string) {
    const plan = await this.prisma.plan.findFirstOrThrow({ where: { id: planId, salonId } });

    const existing = await this.prisma.subscription.findFirst({
      where: { clientId, planId, status: { in: ['ACTIVE', 'PENDING'] } },
    });
    if (existing) throw new ConflictException('Cliente já possui assinatura ativa neste plano.');

    const client = await this.prisma.client.findFirstOrThrow({ where: { id: clientId, salonId, deletedAt: null } });

    // Criar ou recuperar customer no Asaas
    let gatewayCustomerId = (client as any).gatewayCustomerId as string | undefined;
    if (!gatewayCustomerId) {
      const customer = await this.asaas.createCustomer({
        name: client.name,
        email: client.email ?? undefined,
        phone: client.phone ?? undefined,
        cpfCnpj: client.cpf ?? undefined,
      });
      gatewayCustomerId = customer.id;
      await this.prisma.client.update({ where: { id: clientId }, data: { gatewayCustomerId } as any });
    }

    const nextDueDate = new Date();
    nextDueDate.setDate(nextDueDate.getDate() + 1);
    const dueDateStr = nextDueDate.toISOString().slice(0, 10);

    const gwSubscription = await this.asaas.createSubscription({
      customer: gatewayCustomerId,
      billingType: 'PIX',
      value: toNumber(plan.price),
      nextDueDate: dueDateStr,
      cycle: 'MONTHLY',
      description: plan.name,
      externalReference: `${salonId}:${clientId}:${planId}`,
    });

    const subscription = await this.prisma.subscription.create({
      data: {
        salonId,
        clientId,
        planId,
        status: 'PENDING',
        gatewaySubscriptionId: gwSubscription.id,
        currentPeriodStart: new Date(),
        currentPeriodEnd: nextDueDate,
      },
    });

    return subscription;
  }

  /** Processa webhook do Asaas com idempotência */
  async handleAsaasWebhook(event: any, idempotencyKey: string): Promise<void> {
    // Verificar se já processamos este evento
    const existing = await this.prisma.webhookEvent.findFirst({
      where: { gatewayEventId: idempotencyKey },
    });
    if (existing) {
      this.logger.debug(`Webhook ${idempotencyKey} já processado — ignorando.`);
      return;
    }

    // Salvar evento
    await this.prisma.webhookEvent.create({
      data: {
        gatewayEventId: idempotencyKey,
        type: event.event,
        payload: JSON.stringify(event),
        processedAt: new Date(),
      },
    });

    const eventType = event.event as string;
    const payment = event.payment;

    if (eventType === 'PAYMENT_RECEIVED' || eventType === 'PAYMENT_CONFIRMED') {
      await this.handlePaymentReceived(payment);
    } else if (eventType === 'PAYMENT_OVERDUE') {
      await this.handlePaymentOverdue(payment);
    } else if (eventType === 'PAYMENT_DELETED' || eventType === 'PAYMENT_REFUNDED') {
      await this.handlePaymentCancelled(payment);
    }
  }

  private async handlePaymentReceived(payment: any) {
    const externalRef = payment?.externalReference as string | undefined;
    if (!externalRef) return;

    // externalReference: "salonId:clientId:planId"
    const parts = externalRef.split(':');
    if (parts.length < 3) return;
    const [, clientId, planId] = parts;

    await this.prisma.subscription.updateMany({
      where: { clientId, planId, status: { in: ['PENDING', 'PAST_DUE'] } },
      data: {
        status: 'ACTIVE',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    // Criar registro de charge
    await this.prisma.charge.create({
      data: {
        gatewayChargeId: payment.id,
        salonId: parts[0],
        clientId,
        amount: payment.value,
        status: 'CONFIRMED',
        paidAt: new Date(),
      } as any,
    });

    this.logger.log(`Pagamento confirmado para cliente ${clientId}.`);
  }

  private async handlePaymentOverdue(payment: any) {
    const externalRef = payment?.externalReference as string | undefined;
    if (!externalRef) return;
    const [, clientId, planId] = externalRef.split(':');

    await this.prisma.subscription.updateMany({
      where: { clientId, planId, status: 'ACTIVE' },
      data: { status: 'PAST_DUE' },
    });
    this.logger.warn(`Assinatura marcada como PAST_DUE para cliente ${clientId}.`);
  }

  private async handlePaymentCancelled(payment: any) {
    const externalRef = payment?.externalReference as string | undefined;
    if (!externalRef) return;
    const [, clientId, planId] = externalRef.split(':');

    await this.prisma.subscription.updateMany({
      where: { clientId, planId },
      data: { status: 'CANCELLED' },
    });
  }

  /** Verifica se cliente pode agendar (assinatura ativa ou pagamento avulso) */
  async canClientBook(clientId: string, salonId: string): Promise<boolean> {
    const blocked = await this.prisma.subscription.findFirst({
      where: { clientId, salonId, status: 'PAST_DUE' },
    });
    return !blocked;
  }

  /** Calcula e registra split de comissão */
  async processSplit(bookingId: string): Promise<void> {
    const booking = await this.prisma.booking.findFirstOrThrow({
      where: { id: bookingId },
      include: {
        service: { include: { commissionRules: true } },
        professional: true,
      },
    });

    for (const rule of booking.service?.commissionRules ?? []) {
      if (rule.professionalId !== booking.professionalId) continue;
      const amount = toNumber(booking.service?.priceDefault) * (rule.percentage / 100);

      await this.prisma.chargeSplit.create({
        data: {
          bookingId,
          recipientId: booking.professionalId,
          recipientType: 'PROFESSIONAL',
          amount,
          percentage: rule.percentage,
          status: 'PENDING',
        } as any,
      });
    }
  }
}
