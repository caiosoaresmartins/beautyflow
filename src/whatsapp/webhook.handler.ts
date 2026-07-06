import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from './whatsapp.service';
import { AiOrchestratorService } from '../ai-orchestrator/ai-orchestrator.service';
import { RedisService } from '../common/redis/redis.service';

@Injectable()
export class WhatsAppWebhookHandler {
  private readonly logger = new Logger(WhatsAppWebhookHandler.name);
  // Janela Meta: 24 horas em segundos
  private readonly META_WINDOW_SECONDS = 24 * 60 * 60;

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsAppService,
    private readonly ai: AiOrchestratorService,
    private readonly redis: RedisService,
  ) {}

  async handle(payload: any): Promise<void> {
    const entries: any[] = payload?.entry ?? [];
    for (const entry of entries) {
      for (const change of entry.changes ?? []) {
        if (change.field !== 'messages') continue;
        const value = change.value;
        for (const message of value?.messages ?? []) {
          await this.processMessage(message, value);
        }
      }
    }
  }

  private async processMessage(message: any, value: any): Promise<void> {
    const messageId: string = message.id;
    const fromNumber: string = message.from; // E.164 sem +
    const phoneNumberId: string = value?.metadata?.phone_number_id;

    // Deduplicação Redis SET NX (idempotência)
    const dedupKey = `whatsapp:msg:${messageId}`;
    const isNew = await this.redis.setNx(dedupKey, '1', this.META_WINDOW_SECONDS * 2);
    if (!isNew) {
      this.logger.warn(`Mensagem duplicada ignorada: ${messageId}`);
      return;
    }

    // Persistir evento de webhook
    await this.prisma.webhookEvent.upsert({
      where: { externalId: messageId },
      create: {
        source: 'META',
        externalId: messageId,
        payload: message,
        processedAt: new Date(),
      },
      update: { processedAt: new Date() },
    });

    // Identificar salonId pelo phoneNumberId
    const salon = await this.prisma.salon.findFirst({
      where: { metaPhoneNumberId: phoneNumberId },
    });
    if (!salon) {
      this.logger.warn(`Salonão encontrado para phoneNumberId: ${phoneNumberId}`);
      return;
    }

    // Buscar ou criar cliente
    let client = await this.prisma.client.findFirst({
      where: { salonId: salon.id, whatsappId: fromNumber, deletedAt: null },
    });
    if (!client) {
      client = await this.prisma.client.create({
        data: {
          salonId: salon.id,
          whatsappId: fromNumber,
          name: value?.contacts?.[0]?.profile?.name ?? fromNumber,
        },
      });
    }

    // Ignorar clientes que fizeram opt-out
    if (client.optedOut) {
      this.logger.log(`Cliente ${fromNumber} optedOut — mensagem ignorada`);
      return;
    }

    // Verificar janela 24h (Meta exige template fora da janela)
    const windowKey = `whatsapp:window:${fromNumber}`;
    const inWindow = await this.redis.get(windowKey);
    // Renovar janela a cada mensagem recebida do cliente
    await this.redis.set(windowKey, '1', this.META_WINDOW_SECONDS);

    // Extrair texto ou áudio
    let userText = '';
    if (message.type === 'text') {
      userText = message.text?.body ?? '';
    } else if (message.type === 'audio') {
      try {
        const audioBuffer = await this.whatsapp.downloadMedia(message.audio.id);
        userText = await this.ai.transcribeAudio(audioBuffer);
      } catch (err) {
        this.logger.error('Erro ao transcrever áudio', err);
        await this.whatsapp.sendText({
          to: fromNumber,
          text: 'Desculpe, não consegui processar o áudio. Pode digitar sua mensagem?',
        });
        return;
      }
    } else {
      // Tipo não suportado
      await this.whatsapp.sendText({
        to: fromNumber,
        text: 'Por enquanto só consigo processar mensagens de texto e áudio 😊',
      });
      return;
    }

    // Persistir mensagem do cliente
    await this.prisma.conversationMessage.create({
      data: {
        clientId: client.id,
        salonId: salon.id,
        role: 'user',
        content: userText,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 dias LGPD
      },
    });

    // Marcar como lida
    await this.whatsapp.markAsRead(messageId);

    // Delegar ao AI Orchestrator
    const reply = await this.ai.orchestrate({
      salonId: salon.id,
      clientId: client.id,
      clientPhone: fromNumber,
      userMessage: userText,
      inWindow: !!inWindow,
    });

    // Persistir resposta da IA
    await this.prisma.conversationMessage.create({
      data: {
        clientId: client.id,
        salonId: salon.id,
        role: 'assistant',
        content: reply,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      },
    });

    // Enviar resposta
    if (inWindow) {
      await this.whatsapp.sendText({ to: fromNumber, text: reply });
    } else {
      // Fora da janela 24h — usar template aprovado
      await this.whatsapp.sendTemplate({
        to: fromNumber,
        templateName: 'ai_response',
        languageCode: 'pt_BR',
        components: [
          { type: 'body', parameters: [{ type: 'text', text: reply }] },
        ],
      });
    }
  }
}
