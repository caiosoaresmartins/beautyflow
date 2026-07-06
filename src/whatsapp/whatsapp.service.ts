import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface WhatsAppTextMessage {
  to: string;
  text: string;
  phoneNumberId?: string; // permite multi-tenant (salão específico)
}

export interface WhatsAppTemplateMessage {
  to: string;
  templateName: string;
  languageCode: string;
  components?: any[];
  phoneNumberId?: string;
}

/** Meta Graph API version — atualizar aqui quando Meta deprecar */
const META_API_VERSION = 'v21.0';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(private readonly http: HttpService) {}

  // fix: baseUrl e headers lazy (process.env não está disponível no momento
  // da definição da classe — só após o módulo ser inicializado)
  private messagesUrl(phoneNumberId?: string): string {
    const id = phoneNumberId ?? process.env.META_PHONE_NUMBER_ID;
    return `https://graph.facebook.com/${META_API_VERSION}/${id}/messages`;
  }

  private get authHeaders() {
    return {
      Authorization: `Bearer ${process.env.META_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    };
  }

  /** Envia mensagem de texto simples (dentro da janela 24h) */
  async sendText(msg: WhatsAppTextMessage): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(
          this.messagesUrl(msg.phoneNumberId),
          {
            messaging_product: 'whatsapp',
            to: msg.to,
            type: 'text',
            text: { body: msg.text },
          },
          { headers: this.authHeaders },
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
          this.messagesUrl(msg.phoneNumberId),
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
          { headers: this.authHeaders },
        ),
      );
    } catch (err: any) {
      this.logger.error(`Erro ao enviar template para ${msg.to}`, err?.response?.data);
      throw err;
    }
  }

  /** Marca mensagem como lida */
  async markAsRead(messageId: string, phoneNumberId?: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(
          this.messagesUrl(phoneNumberId),
          {
            messaging_product: 'whatsapp',
            status: 'read',
            message_id: messageId,
          },
          { headers: this.authHeaders },
        ),
      );
    } catch {
      // não crítico — ignorar falha de marcação
    }
  }

  /** Download de mídia (áudio) pelo mediaId retornado pelo webhook */
  async downloadMedia(mediaId: string): Promise<Buffer> {
    // Passo 1: obter URL temporária da mídia
    const urlRes = await firstValueFrom(
      this.http.get(
        `https://graph.facebook.com/${META_API_VERSION}/${mediaId}`,
        { headers: this.authHeaders },
      ),
    );
    const mediaUrl: string = urlRes.data.url;

    // Passo 2: baixar o conteúdo binário
    const mediaRes = await firstValueFrom(
      this.http.get(mediaUrl, {
        headers: this.authHeaders,
        responseType: 'arraybuffer',
      }),
    );
    return Buffer.from(mediaRes.data);
  }
}
