import {
  Injectable,
  Logger,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, timeout } from 'rxjs';
import * as crypto from 'crypto';

export interface AsaasCustomerInput {
  name: string;
  cpfCnpj?: string;
  email?: string;
  phone?: string;
  externalReference?: string; // clientId interno
}

export interface AsaasChargeInput {
  customerId: string;
  billingType: 'PIX' | 'CREDIT_CARD' | 'BOLETO';
  value: number;
  dueDate: string;         // YYYY-MM-DD
  description?: string;
  externalReference?: string;
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
  private readonly isSandbox: boolean;

  constructor(private readonly http: HttpService) {
    const env = process.env.ASAAS_ENV ?? 'sandbox';
    this.isSandbox = env !== 'production';
    this.baseUrl = this.isSandbox
      ? 'https://sandbox.asaas.com/api/v3'
      : 'https://www.asaas.com/api/v3';
    this.headers = {
      'access_token': process.env.ASAAS_API_KEY ?? '',
      'Content-Type': 'application/json',
    };

    if (!process.env.ASAAS_API_KEY) {
      this.logger.warn('ASAAS_API_KEY não definida — integrações de pagamento desabilitadas');
    }
    if (this.isSandbox) {
      this.logger.log('AsaasService iniciado em modo SANDBOX');
    }
  }

  /** Cria ou busca cliente no Asaas por externalReference */
  async upsertCustomer(input: AsaasCustomerInput): Promise<string> {
    if (!process.env.ASAAS_API_KEY) throw new ServiceUnavailableException('Gateway de pagamento não configurado');

    if (input.externalReference) {
      try {
        const res = await firstValueFrom(
          this.http
            .get(`${this.baseUrl}/customers`, {
              headers: this.headers,
              params: { externalReference: input.externalReference },
            })
            .pipe(timeout(8_000)),
        );
        const data = res.data?.data?.[0];
        if (data?.id) return data.id;
      } catch {
        // Não encontrado — vai criar
      }
    }

    const res = await firstValueFrom(
      this.http
        .post(
          `${this.baseUrl}/customers`,
          {
            name: input.name,
            cpfCnpj: input.cpfCnpj,
            email: input.email,
            phone: input.phone,
            externalReference: input.externalReference,
          },
          { headers: this.headers },
        )
        .pipe(timeout(8_000)),
    );
    return res.data.id;
  }

  /** Cria cobrança avulsa (PIX, boleto ou cartão) com split opcional */
  async createCharge(input: AsaasChargeInput): Promise<{
    chargeId: string;
    invoiceUrl: string;
    pixCode?: string;
    status: string;
  }> {
    try {
      const res = await firstValueFrom(
        this.http
          .post(
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
          )
          .pipe(timeout(8_000)),
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
        this.http
          .post(
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
          )
          .pipe(timeout(8_000)),
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

  /** Cancela assinatura no Asaas */
  async cancelSubscription(asaasSubscriptionId: string): Promise<void> {
    await firstValueFrom(
      this.http
        .delete(`${this.baseUrl}/subscriptions/${asaasSubscriptionId}`, {
          headers: this.headers,
        })
        .pipe(timeout(8_000)),
    );
  }

  /** Retorna URL de pagamento de uma cobrança */
  async getPaymentLink(asaasChargeId: string): Promise<string> {
    const res = await firstValueFrom(
      this.http
        .get(`${this.baseUrl}/payments/${asaasChargeId}`, { headers: this.headers })
        .pipe(timeout(8_000)),
    );
    return res.data.invoiceUrl ?? res.data.bankSlipUrl ?? '';
  }

  /** Busca status de uma cobrança */
  async getChargeStatus(asaasChargeId: string): Promise<string> {
    const res = await firstValueFrom(
      this.http
        .get(`${this.baseUrl}/payments/${asaasChargeId}`, { headers: this.headers })
        .pipe(timeout(8_000)),
    );
    return res.data.status;
  }

  /**
   * Valida assinatura HMAC-SHA256 do webhook Asaas
   * Asaas envia o token configurado no painel em header "asaas-access-token"
   * Para validação mais robusta configure ASAAS_WEBHOOK_TOKEN diferente da API key
   */
  validateWebhookSignature(token: string): boolean {
    const expected = process.env.ASAAS_WEBHOOK_TOKEN;
    if (!expected) {
      this.logger.warn('ASAAS_WEBHOOK_TOKEN não configurado — aceitando todos os webhooks');
      return true;
    }
    // Comparação em tempo constante para evitar timing attacks
    try {
      return crypto.timingSafeEqual(
        Buffer.from(token ?? ''),
        Buffer.from(expected),
      );
    } catch {
      return false;
    }
  }
}
