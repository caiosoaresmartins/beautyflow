import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AsaasService, AsaasSplitItem } from './asaas.service';
import { format, addMonths } from 'date-fns';
import { Decimal } from '@prisma/client/runtime/library';

export interface CreateSubscriptionInput {
  salonId: string;
  clientId: string;
  planId: string;
  billingType: 'PIX' | 'CREDIT_CARD' | 'BOLETO';
}

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly asaas: AsaasService,
  ) {}

  /** Cria assinatura recorrente para o cliente (Clube da Barba) */
  async createSubscription(input: CreateSubscriptionInput): Promise<any> {
    const [client, plan] = await Promise.all([
      this.prisma.client.findFirst({
        where: { id: input.clientId, salonId: input.salonId, deletedAt: null },
      }),
      this.prisma.plan.findFirst({
        where: { id: input.planId, salonId: input.salonId, active: true },
      }),
    ]);

    if (!client) throw new NotFoundException('Cliente não encontrado');
    if (!plan) throw new NotFoundException('Plano não encontrado');

    // Verificar se já tem assinatura ativa
    const existing = await this.prisma.subscription.findFirst({
      where: {
        clientId: input.clientId,
        planId: input.planId,
        status: { in: ['ACTIVE', 'PENDING'] },
      },
    });
    if (existing) throw new BadRequestException('Cliente já possui assinatura ativa neste plano');

    // Criar/buscar cliente Asaas
    const asaasCustomerId = await this.asaas.upsertCustomer({
      name: client.name,
      cpfCnpj: client.cpf ?? undefined,
      email: client.email ?? undefined,
      phone: client.phone ?? undefined,
      externalReference: client.id,
    });

    // Split do salão (sem split por ora — salão fica com 100%)
    // Expandir quando o salão tiver gatewayRecipientId
    const split: AsaasSplitItem[] = [];

    const nextDueDate = format(new Date(), 'yyyy-MM-dd');
    const result = await this.asaas.createSubscription({
      customerId: asaasCustomerId,
      billingType: input.billingType,
      value: Number(plan.price as Decimal),
      nextDueDate,
      cycle: 'MONTHLY',
      description: `${plan.name} — ${client.name}`,
      externalReference: `${input.clientId}:${input.planId}`,
      split: split.length > 0 ? split : undefined,
    });

    // Persistir no banco
    const subscription = await this.prisma.subscription.create({
      data: {
        salonId: input.salonId,
        clientId: input.clientId,
        planId: input.planId,
        externalId: result.subscriptionId,
        status: 'PENDING',
        currentPeriodStart: new Date(),
        currentPeriodEnd: addMonths(new Date(), 1),
        creditsLeft: 0, // será incrementado quando PAYMENT_RECEIVED chegar
      },
    });

    return {
      subscriptionId: subscription.id,
      externalId: result.subscriptionId,
      status: result.status,
      plan: plan.name,
      value: Number(plan.price as Decimal),
      nextDueDate,
    };
  }

  /** Cancela assinatura */
  async cancelSubscription(subscriptionId: string, salonId: string): Promise<void> {
    const sub = await this.prisma.subscription.findFirst({
      where: { id: subscriptionId, salonId },
    });
    if (!sub) throw new NotFoundException('Assinatura não encontrada');
    if (sub.externalId) {
      try {
        await this.asaas.cancelSubscription(sub.externalId);
      } catch (err) {
        this.logger.warn(`Falha ao cancelar no Asaas: ${sub.externalId}`, err);
      }
    }
    await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
  }

  /** Lista assinaturas de um salão */
  async listSubscriptions(salonId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.subscription.findMany({
        where: { salonId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          client: { select: { name: true, phone: true } },
          plan: { select: { name: true, price: true } },
        },
      }),
      this.prisma.subscription.count({ where: { salonId } }),
    ]);
    return { data, total, page, lastPage: Math.ceil(total / limit) };
  }

  /**
   * Verifica se o cliente está inadimplente.
   * Retorna true se pode agendar, false se deve ser bloqueado.
   */
  async canBook(clientId: string, salonId: string): Promise<{
    allowed: boolean;
    reason?: string;
    paymentLink?: string;
  }> {
    // Busca assinaturas PAST_DUE ou OVERDUE
    const overdueSubscription = await this.prisma.subscription.findFirst({
      where: {
        clientId,
        salonId,
        status: { in: ['PAST_DUE', 'OVERDUE'] },
      },
      include: { plan: true },
    });

    if (!overdueSubscription) return { allowed: true };

    // Buscar última cobrança em aberto para gerar link
    const lastCharge = await this.prisma.charge.findFirst({
      where: {
        clientId,
        salonId,
        status: { in: ['PENDING', 'OVERDUE'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    const paymentLink = lastCharge?.invoiceUrl ?? undefined;

    return {
      allowed: false,
      reason: `Assinatura "${overdueSubscription.plan.name}" com pagamento pendente. Regularize para continuar agendando.`,
      paymentLink,
    };
  }

  /** Status resumido de assinatura para tool call da IA */
  async getSubscriptionStatus(clientId: string, salonId: string): Promise<any> {
    const subs = await this.prisma.subscription.findMany({
      where: { clientId, salonId, status: { not: 'CANCELLED' } },
      include: { plan: { select: { name: true, price: true } } },
      orderBy: { createdAt: 'desc' },
    });

    if (subs.length === 0) return { hasSubscription: false };

    return {
      hasSubscription: true,
      subscriptions: subs.map((s) => ({
        id: s.id,
        plan: s.plan.name,
        status: s.status,
        creditsLeft: s.creditsLeft,
        currentPeriodEnd: s.currentPeriodEnd?.toISOString(),
      })),
    };
  }
}
