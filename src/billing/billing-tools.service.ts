/**
 * BillingToolsService — funções expostas como tool calls para o AiOrchestratorService.
 * Importado dinamicamente pelo AI Orchestrator para evitar dependência circular.
 */
import { Injectable } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { AsaasService } from './asaas.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BillingToolsService {
  constructor(
    private readonly subscriptions: SubscriptionsService,
    private readonly asaas: AsaasService,
    private readonly prisma: PrismaService,
  ) {}

  /** Tool: check_subscription_status */
  async checkSubscriptionStatus(clientId: string, salonId: string) {
    const result = await this.subscriptions.getSubscriptionStatus(clientId, salonId);
    const canBook = await this.subscriptions.canBook(clientId, salonId);
    return { ...result, canBook: canBook.allowed, blockReason: canBook.reason };
  }

  /** Tool: create_subscription */
  async createSubscription(
    clientId: string,
    salonId: string,
    planName: string,
    billingType: 'PIX' | 'CREDIT_CARD' | 'BOLETO' = 'PIX',
  ) {
    // Buscar plano pelo nome
    const plan = await this.prisma.plan.findFirst({
      where: { salonId, active: true, name: { contains: planName, mode: 'insensitive' } },
    });
    if (!plan) return { error: `Plano "${planName}" não encontrado` };
    return this.subscriptions.createSubscription({
      salonId,
      clientId,
      planId: plan.id,
      billingType,
    });
  }

  /** Tool: get_payment_link — retorna link para regularizar inadimplência */
  async getPaymentLink(clientId: string, salonId: string): Promise<any> {
    const lastCharge = await this.prisma.charge.findFirst({
      where: { clientId, salonId, status: { in: ['PENDING', 'FAILED'] } },
      orderBy: { createdAt: 'desc' },
    });
    if (!lastCharge) return { message: 'Nenhuma cobrança pendente encontrada' };
    return {
      chargeId: lastCharge.id,
      amount: Number(lastCharge.amount),
        status: lastCharge.status,
    };
  }

  /** Lista planos disponíveis no salão */
  async listPlans(salonId: string) {
    const plans = await this.prisma.plan.findMany({
      where: { salonId, active: true },
      select: { id: true, name: true, price: true, bookingsPerMonth: true, description: true },
    });
    return plans.map((p) => ({ ...p, price: Number(p.price) }));
  }
}
