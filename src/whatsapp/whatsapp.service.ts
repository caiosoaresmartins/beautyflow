import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

const META_API_VERSION = 'v21.0';

export interface WhatsAppTextMessage {
  to: string;
  text: string;
}

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  private get accessToken(): string {
    return process.env.META_ACCESS_TOKEN ?? '';
  }

  private get phoneNumberId(): string {
    return process.env.META_PHONE_NUMBER_ID ?? '';
  }

  private messagesUrl(): string {
    return `https://graph.facebook.com/${META_API_VERSION}/${this.phoneNumberId}/messages`;
  }

  private get authHeaders() {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  async sendText(to: string, text: string): Promise<void> {
    try {
      await axios.post(
        this.messagesUrl(),
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'text',
          text: { preview_url: false, body: text },
        },
        { headers: this.authHeaders, timeout: 10_000 },
      );
    } catch (err: any) {
      this.logger.error(`Erro ao enviar mensagem para ${to}: ${err?.response?.data?.error?.message ?? err.message}`);
      throw err;
    }
  }

  async sendTemplate(to: string, templateName: string, languageCode = 'pt_BR', components: unknown[] = []): Promise<void> {
    try {
      await axios.post(
        this.messagesUrl(),
        {
          messaging_product: 'whatsapp',
          to,
          type: 'template',
          template: { name: templateName, language: { code: languageCode }, components },
        },
        { headers: this.authHeaders, timeout: 10_000 },
      );
    } catch (err: any) {
      this.logger.error(`Erro ao enviar template ${templateName} para ${to}: ${err?.message}`);
      throw err;
    }
  }

  async markAsRead(messageId: string): Promise<void> {
    try {
      await axios.post(
        this.messagesUrl(),
        { messaging_product: 'whatsapp', status: 'read', message_id: messageId },
        { headers: this.authHeaders, timeout: 5_000 },
      );
    } catch {
      // Não crítico — apenas log
      this.logger.warn(`Não foi possível marcar ${messageId} como lido.`);
    }
  }
}
