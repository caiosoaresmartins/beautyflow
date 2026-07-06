import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface WhatsAppTextMessage {
  to: string;
  text: string;
}

export interface WhatsAppTemplateMessage {
  to: string;
  templateName: string;
  languageCode: string;
  components?: any[];
}

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly baseUrl = `https://graph.facebook.com/v18.0/${process.env.META_PHONE_NUMBER_ID}/messages`;
  private readonly headers = {
    Authorization: `Bearer ${process.env.META_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  };

  constructor(private readonly http: HttpService) {}

  /** Envia mensagem de texto simples (dentro da janela 24h) */
  async sendText(msg: WhatsAppTextMessage): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(
          this.baseUrl,
          {
            messaging_product: 'whatsapp',
            to: msg.to,
            type: 'text',
            text: { body: msg.text },
          },
          { headers: this.headers },
        ),
      );
    } catch (err: any) {
      this.logger.error(`Erro ao enviar texto para ${msg.to}`, err?.response?.data);
      throw err;
    }
  }

  /** Envia template aprovado (fora da janela 24h) */
  async sendTemplate(msg: WhatsAppTemplateMessage): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(
          this.baseUrl,
          {
            messaging_product: 'whatsapp',
            to: msg.to,
            type: 'template',
            template: {
              name: msg.templateName,
              language: { code: msg.languageCode },
              components: msg.components ?? [],
            },
          },
          { headers: this.headers },
        ),
      );
    } catch (err: any) {
      this.logger.error(`Erro ao enviar template para ${msg.to}`, err?.response?.data);
      throw err;
    }
  }

  /** Marca mensagem como lida */
  async markAsRead(messageId: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(
          this.baseUrl,
          {
            messaging_product: 'whatsapp',
            status: 'read',
            message_id: messageId,
          },
          { headers: this.headers },
        ),
      );
    } catch {
      // não crítico — ignorar falha de marcação
    }
  }

  /** Download de mídia (áudio) pelo URL retornado pelo webhook */
  async downloadMedia(mediaId: string): Promise<Buffer> {
    const urlRes = await firstValueFrom(
      this.http.get(`https://graph.facebook.com/v18.0/${mediaId}`, {
        headers: this.headers,
      }),
    );
    const mediaUrl: string = urlRes.data.url;
    const mediaRes = await firstValueFrom(
      this.http.get(mediaUrl, {
        headers: this.headers,
        responseType: 'arraybuffer',
      }),
    );
    return Buffer.from(mediaRes.data);
  }
}
