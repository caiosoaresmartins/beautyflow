import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AsaasService, AsaasSplitItem } from './asaas.service';
import { addDays, format } from 'date-fns';
import { Decimal } from '@prisma/client/runtime/library';

export interface CreateChargeDto {
  salonId: string;
  clientId: string;
  bookingId?: string;
  value: number;
  billingType: 'PIX' | 'CREDIT_CARD' | 'BOLETO';
  description?: string;
  dueDate?: string; // YYYY-MM-DD, default: hoje + 1 dia
}

export interface CreateSubscriptionDto {
  salonId: string;
  clientId: string;
  planId: string;
  billingType: 'PIX' | 'CREDIT_CARD' | 'BOLETO';
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly asaas: AsaasService,
  ) {}

  /** Cria cobrança avulsa com split automático por CommissionRule */
  async createCharge(dto: CreateChargeDto): Promise<any> {
    const client = await this.prisma.client.findFirst({
      where: { id: dto.clientId, salonId: dto.salonId, deletedAt: null },
    });
    if (!client) throw new NotFoundException('Cliente não encontrado');

    // Garantir cliente no Asaas
    const asaasCustomerId = await this.asaas.upsertCustomer({
      name: client.name,
      cpfCnpj: client.cpf ?? undefined,
      email: client.email ?? undefined,
      phone: client.phone ?? undefined,
      externalReference: client.id,
    });

    // Calcular split se vier de um booking com serviço
    const split: AsaasSplitItem[] = [];
    if (dto.bookingId) {
      const booking = await this.prisma.booking.findFirst({
        where: { id: dto.bookingId, salonId: dto.salonId },
        include: {
          service: { include: { commissionRules: true } },
          professional: true,
        },
      });
      if (booking) {
        for (const rule of booking.service.commissionRules) {
          // Só splitar para o profissional do booking
          if (rule.professionalId !== booking.professionalId) continue;
          const prof = booking.professional;
          if (!prof.gatewayRecipientId) continue;

          if (rule.type === 'PERCENTAGE') {
            split.push({
              walletId: prof.gatewayRecipientId,
              percentualValue: Number(rule.value),
            });
          } else {
            split.push({
              walletId: prof.gatewayRecipientId,
              fixedValue: Number(rule.value as Decimal),
            });
          }
        }
      }
    }

    const dueDate = dto.dueDate ?? format(addDays(new Date(), 1), 'yyyy-MM-dd');

    const result = await this.asaas.createCharge({
      customerId: asaasCustomerId,
      billingType: dto.billingType,
      value: dto.value,
      dueDate,
      description: dto.description,
      externalReference: dto.bookingId ?? dto.clientId,
      split: split.length > 0 ? split : undefined,
    });

    // Persistir Charge no banco
    const charge = await this.prisma.charge.create({
      data: {
        salonId: dto.salonId,
        clientId: dto.clientId,
        bookingId: dto.bookingId,
        externalId: result.chargeId,
        amount: dto.value,
        status: result.status as any,
        billingType: dto.billingType,
        dueDate: new Date(dueDate),
        invoiceUrl: result.invoiceUrl,
        pixCode: result.pixCode,
      },
    });

    // Persistir splits
    if (split.length > 0 && dto.bookingId) {
      const booking = await this.prisma.booking.findUnique({
        where: { id: dto.bookingId },
        include: { professional: true },
      });
      if (booking) {
        for (const s of split) {
          await this.prisma.chargeSplit.create({
            data: {
              chargeId: charge.id,
              recipientType: 'PROFESSIONAL',
              walletId: s.walletId,
              fixedValue: s.fixedValue ? new Decimal(s.fixedValue) : null,
              percentualValue: s.percentualValue ? new Decimal(s.percentualValue) : null,
              status: 'PENDING',
            },
          });
        }
      }
    }

    return {
      chargeId: charge.id,
      externalId: result.chargeId,
      invoiceUrl: result.invoiceUrl,
      pixCode: result.pixCode,
      status: result.status,
    };
  }

  /** Lista cobranças de um salão com paginação */
  async listCharges(
    salonId: string,
    page = 1,
    limit = 20,
  ): Promise<{ data: any[]; total: number; page: number; lastPage: number }> {
    const skip = (page - 1) * limit;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.charge.findMany({
        where: { salonId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          client: { select: { name: true } },
          booking: { select: { startsAt: true } },
        },
      }),
      this.prisma.charge.count({ where: { salonId } }),
    ]);
    return { data, total, page, lastPage: Math.ceil(total / limit) };
  }

  /** Busca status atualizado de uma cobrança */
  async syncChargeStatus(chargeId: string, salonId: string): Promise<any> {
    const charge = await this.prisma.charge.findFirst({
      where: { id: chargeId, salonId },
    });
    if (!charge) throw new NotFoundException('Cobrança não encontrada');
    const status = await this.asaas.getChargeStatus(charge.externalId);
    return this.prisma.charge.update({
      where: { id: chargeId },
      data: { status: status as any },
    });
  }
}
