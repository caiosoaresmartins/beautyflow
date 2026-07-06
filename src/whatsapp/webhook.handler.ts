import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiOrchestratorService } from '../ai-orchestrator/ai-orchestrator.service';
import { WhatsAppService } from './whatsapp.service';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';

@Injectable()
export class WebhookHandler {
  private readonly logger = new Logger(WebhookHandler.name);

  constructor(
    private prisma: PrismaService,
    private ai: AiOrchestratorService,
    private whatsapp: WhatsAppService,
    @Inject(REDIS_CLIENT) private redis: Redis,
  ) {}

  async handle(body: any): Promise<void> {
    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value?.messages?.length) return;

    const message = value.messages[0];
    const from = message.from as string;
    const messageId = message.id as string;
    const phoneNumberId = value?.metadata?.phone_number_id as string;

    // Deduplicação via Redis — TTL 24h
    const dedupKey = `wa:msg:${messageId}`;
    const already = await this.redis.set(dedupKey, '1', 'EX', 86400, 'NX');
    if (!already) {
      this.logger.debug(`Mensagem duplicada ignorada: ${messageId}`);
      return;
    }

    // Marcar como lido
    await this.whatsapp.markAsRead(messageId);

    // Resolver salão pelo phoneNumberId
    const salon = await this.prisma.salon.findFirst({
      where: { whatsappPhoneNumberId: phoneNumberId },
    });
    if (!salon) {
      this.logger.warn(`Salão não encontrado para phoneNumberId: ${phoneNumberId}`);
      return;
    }

    // Resolver ou criar cliente
    let client = await this.prisma.client.findFirst({
      where: { whatsappId: from, salonId: salon.id, deletedAt: null },
    });
    if (!client) {
      const contact = value?.contacts?.[0];
      client = await this.prisma.client.create({
        data: {
          salonId: salon.id,
          whatsappId: from,
          name: contact?.profile?.name ?? from,
        },
      });
    }

    if (client.optedOut) {
      this.logger.log(`Cliente ${from} optou por não receber mensagens.`);
      return;
    }

    // Extrair texto ou áudio
    let userMessage = '';
    if (message.type === 'text') {
      userMessage = message.text?.body ?? '';
    } else if (message.type === 'audio') {
      userMessage = await this.ai.transcribeAudio(message.audio?.id ?? '');
    } else {
      await this.whatsapp.sendText(from, 'Desculpe, só consigo processar mensagens de texto ou áudio 😊');
      return;
    }

    // Salvar mensagem no histórico
    await this.prisma.conversationMessage.create({
      data: {
        clientId: client.id,
        salonId: salon.id,
        role: 'user',
        content: userMessage,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 dias
      },
    });

    // Processar com IA
    const reply = await this.ai.process({
      salonId: salon.id,
      clientId: client.id,
      clientName: client.name,
      whatsappId: from,
      message: userMessage,
    });

    // Salvar resposta da IA
    await this.prisma.conversationMessage.create({
      data: {
        clientId: client.id,
        salonId: salon.id,
        role: 'assistant',
        content: reply,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    await this.whatsapp.sendText(from, reply);
  }
}
