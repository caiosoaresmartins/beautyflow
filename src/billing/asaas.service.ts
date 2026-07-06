import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface AsaasCustomerInput {
  name: string;
  cpfCnpj?: string;
  email?: string;
  phone?: string;
  externalReference?: string; // clientId
}

export interface AsaasChargeInput {
  customerId: string;      // id Asaas do cliente
  billingType: 'PIX' | 'CREDIT_CARD' | 'BOLETO';
  value: number;
  dueDate: string;         // YYYY-MM-DD
  description?: string;
  externalReference?: string; // bookingId ou subscriptionId
  split?: AsaasSplitItem[];
}

export interface AsaasSplitItem {
  walletId: string;
  fixedValue?: number;
  percentualValue?: number;
}

export interface AsaasSubscriptionInput {
  customerId: string;
  billingType: 'PIX' | 'CREDIT_CARD' | 'BOLETO';
  value: number;
  nextDueDate: string;     // YYYY-MM-DD
  cycle: 'MONTHLY' | 'WEEKLY' | 'BIMONTHLY' | 'QUARTERLY' | 'SEMIANNUALLY' | 'YEARLY';
  description?: string;
  externalReference?: string;
  split?: AsaasSplitItem[];
}

@Injectable()
export class AsaasService {
  private readonly logger = new Logger(AsaasService.name);
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;

  constructor(private readonly http: HttpService) {
    this.baseUrl = process.env.ASAAS_BASE_URL ?? 'https://sandbox.asaas.com/api/v3';
    this.headers = {
      'access_token': process.env.ASAAS_API_KEY ?? '',
      'Content-Type': 'application/json',
    };
  }

  /** Cria ou busca cliente no Asaas */
  async upsertCustomer(input: AsaasCustomerInput): Promise<string> {
    // Buscar por externalReference primeiro
    if (input.externalReference) {
      try {
        const res = await firstValueFrom(
          this.http.get(`${this.baseUrl}/customers`, {
            headers: this.headers,
            params: { externalReference: input.externalReference },
          }),
        );
        const data = res.data?.data?.[0];
        if (data?.id) return data.id;
      } catch {}
    }

    // Criar novo
    const res = await firstValueFrom(
      this.http.post(
        `${this.baseUrl}/customers`,
        {
          name: input.name,
          cpfCnpj: input.cpfCnpj,
          email: input.email,
          phone: input.phone,
          externalReference: input.externalReference,
        },
        { headers: this.headers },
      ),
    );
    return res.data.id;
  }

  /** Cria cobrança avulsa (PIX, boleto ou cartão) */
  async createCharge(input: AsaasChargeInput): Promise<{
    chargeId: string;
    invoiceUrl: string;
    pixCode?: string;
    status: string;
  }> {
    try {
      const res = await firstValueFrom(
        this.http.post(
          `${this.baseUrl}/payments`,
          {
            customer: input.customerId,
            billingType: input.billingType,
            value: input.value,
            dueDate: input.dueDate,
            description: input.description,
            externalReference: input.externalReference,
            split: input.split,
            postalService: false,
          },
          { headers: this.headers },
        ),
      );
      const d = res.data;
      return {
        chargeId: d.id,
        invoiceUrl: d.invoiceUrl,
        pixCode: d.pixTransaction?.payload,
        status: d.status,
      };
    } catch (err: any) {
      this.logger.error('Erro ao criar cobrança Asaas', err?.response?.data);
      throw new InternalServerErrorException('Erro ao processar pagamento');
    }
  }

  /** Cria assinatura recorrente (Clube da Barba) */
  async createSubscription(input: AsaasSubscriptionInput): Promise<{
    subscriptionId: string;
    status: string;
  }> {
    try {
      const res = await firstValueFrom(
        this.http.post(
          `${this.baseUrl}/subscriptions`,
          {
            customer: input.customerId,
            billingType: input.billingType,
            value: input.value,
            nextDueDate: input.nextDueDate,
            cycle: input.cycle,
            description: input.description,
            externalReference: input.externalReference,
            split: input.split,
          },
          { headers: this.headers },
        ),
      );
      return {
        subscriptionId: res.data.id,
        status: res.data.status,
      };
    } catch (err: any) {
      this.logger.error('Erro ao criar assinatura Asaas', err?.response?.data);
      throw new InternalServerErrorException('Erro ao criar assinatura');
    }
  }

  /** Cancela assinatura */
  async cancelSubscription(asaasSubscriptionId: string): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${this.baseUrl}/subscriptions/${asaasSubscriptionId}`, {
        headers: this.headers,
      }),
    );
  }

  /** Gera link de pagamento para a fatura em aberto */
  async getPaymentLink(asaasChargeId: string): Promise<string> {
    const res = await firstValueFrom(
      this.http.get(`${this.baseUrl}/payments/${asaasChargeId}`, {
        headers: this.headers,
      }),
    );
    return res.data.invoiceUrl ?? res.data.bankSlipUrl ?? '';
  }

  /** Busca status de cobrança */
  async getChargeStatus(asaasChargeId: string): Promise<string> {
    const res = await firstValueFrom(
      this.http.get(`${this.baseUrl}/payments/${asaasChargeId}`, {
        headers: this.headers,
      }),
    );
    return res.data.status;
  }
}
