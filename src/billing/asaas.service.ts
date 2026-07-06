import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class AsaasService {
  private readonly logger = new Logger(AsaasService.name);
  private readonly http: AxiosInstance;

  constructor() {
    const env = process.env.ASAAS_ENVIRONMENT ?? 'sandbox';
    const baseURL = env === 'production'
      ? 'https://api.asaas.com/v3'
      : 'https://sandbox.asaas.com/api/v3';

    this.http = axios.create({
      baseURL,
      headers: {
        'access_token': process.env.ASAAS_API_KEY ?? '',
        'Content-Type': 'application/json',
      },
      timeout: 15_000,
    });
  }

  async createCustomer(data: { name: string; cpfCnpj?: string; email?: string; phone?: string }) {
    const res = await this.http.post('/customers', data);
    return res.data as { id: string; name: string };
  }

  async createSubscription(data: {
    customer: string;
    billingType: 'CREDIT_CARD' | 'PIX' | 'BOLETO';
    value: number;
    nextDueDate: string; // YYYY-MM-DD
    cycle: 'MONTHLY' | 'WEEKLY' | 'YEARLY';
    description?: string;
    externalReference?: string;
  }) {
    const res = await this.http.post('/subscriptions', data);
    return res.data as { id: string; status: string; value: number };
  }

  async createCharge(data: {
    customer: string;
    billingType: 'PIX' | 'CREDIT_CARD' | 'BOLETO';
    value: number;
    dueDate: string;
    description?: string;
    externalReference?: string;
    split?: Array<{ walletId: string; value?: number; percentualValue?: number }>;
  }) {
    const res = await this.http.post('/payments', data);
    return res.data as { id: string; status: string; invoiceUrl: string; pixQrCode?: string };
  }

  async getSubscription(subscriptionId: string) {
    const res = await this.http.get(`/subscriptions/${subscriptionId}`);
    return res.data as { id: string; status: string; value: number; nextDueDate: string };
  }

  async cancelSubscription(subscriptionId: string) {
    const res = await this.http.delete(`/subscriptions/${subscriptionId}`);
    return res.data;
  }

  async getPaymentLink(chargeId: string) {
    const res = await this.http.get(`/payments/${chargeId}`);
    return (res.data as { invoiceUrl: string }).invoiceUrl;
  }
}
