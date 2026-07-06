import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface ReminderPayload {
  bookingId: string;
  clientName: string;
  clientWhatsapp: string;  // formato: 5511999998888
  professionalName: string;
  serviceName: string;
  startsAt: Date;
  salonName: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  private readonly phoneNumberId = process.env.META_PHONE_NUMBER_ID;
  private readonly accessToken   = process.env.META_ACCESS_TOKEN;
  private readonly apiUrl = `https://graph.facebook.com/v19.0/${process.env.META_PHONE_NUMBER_ID}/messages`;

  constructor(private readonly http: HttpService) {}

  // ------------------------------------------------------------------
  // Envia lembrete 24h antes via Meta Cloud API (template "reminder")
  // ------------------------------------------------------------------
  async sendReminder(payload: ReminderPayload): Promise<boolean> {
    const dateStr = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      weekday: 'long', day: '2-digit', month: 'long',
      hour: '2-digit', minute: '2-digit',
    }).format(payload.startsAt);

    try {
      await firstValueFrom(
        this.http.post(
          this.apiUrl,
          {
            messaging_product: 'whatsapp',
            to: payload.clientWhatsapp,
            type: 'template',
            template: {
              name: 'booking_reminder_24h',
              language: { code: 'pt_BR' },
              components: [
                {
                  type: 'body',
                  parameters: [
                    { type: 'text', text: payload.clientName },
                    { type: 'text', text: payload.serviceName },
                    { type: 'text', text: payload.professionalName },
                    { type: 'text', text: dateStr },
                    { type: 'text', text: payload.salonName },
                  ],
                },
              ],
            },
          },
          {
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );
      this.logger.log(`Lembrete enviado: bookingId=${payload.bookingId} -> ${payload.clientWhatsapp}`);
      return true;
    } catch (err: any) {
      this.logger.error(
        `Falha ao enviar lembrete: bookingId=${payload.bookingId} erro=${err?.response?.data?.error?.message ?? err.message}`,
      );
      return false;
    }
  }

  // ------------------------------------------------------------------
  // Confirmação de agendamento criado
  // ------------------------------------------------------------------
  async sendConfirmation(payload: ReminderPayload): Promise<boolean> {
    const dateStr = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      weekday: 'long', day: '2-digit', month: 'long',
      hour: '2-digit', minute: '2-digit',
    }).format(payload.startsAt);

    try {
      await firstValueFrom(
        this.http.post(
          this.apiUrl,
          {
            messaging_product: 'whatsapp',
            to: payload.clientWhatsapp,
            type: 'template',
            template: {
              name: 'booking_confirmation',
              language: { code: 'pt_BR' },
              components: [
                {
                  type: 'body',
                  parameters: [
                    { type: 'text', text: payload.clientName },
                    { type: 'text', text: payload.serviceName },
                    { type: 'text', text: dateStr },
                    { type: 'text', text: payload.salonName },
                  ],
                },
              ],
            },
          },
          {
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );
      this.logger.log(`Confirmação enviada: bookingId=${payload.bookingId} -> ${payload.clientWhatsapp}`);
      return true;
    } catch (err: any) {
      this.logger.error(`Falha ao enviar confirmação: bookingId=${payload.bookingId} erro=${err?.response?.data?.error?.message ?? err.message}`);
      return false;
    }
  }

  // ------------------------------------------------------------------
  // Notificação de cancelamento
  // ------------------------------------------------------------------
  async sendCancellation(payload: ReminderPayload): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.post(
          this.apiUrl,
          {
            messaging_product: 'whatsapp',
            to: payload.clientWhatsapp,
            type: 'template',
            template: {
              name: 'booking_cancellation',
              language: { code: 'pt_BR' },
              components: [
                {
                  type: 'body',
                  parameters: [
                    { type: 'text', text: payload.clientName },
                    { type: 'text', text: payload.serviceName },
                    { type: 'text', text: payload.salonName },
                  ],
                },
              ],
            },
          },
          {
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );
      this.logger.log(`Cancelamento enviado: bookingId=${payload.bookingId} -> ${payload.clientWhatsapp}`);
      return true;
    } catch (err: any) {
      this.logger.error(`Falha ao enviar cancelamento: bookingId=${payload.bookingId} erro=${err?.response?.data?.error?.message ?? err.message}`);
      return false;
    }
  }
}
