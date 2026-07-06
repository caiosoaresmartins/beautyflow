import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { AvailabilityService } from './availability.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

export interface OrchestrateInput {
  salonId: string;
  clientId: string;
  clientPhone: string;
  userMessage: string;
  inWindow: boolean;
}

const TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'check_availability',
      description: 'Verifica horários disponíveis para um serviço e profissional em uma data.',
      parameters: {
        type: 'object',
        properties: {
          service_id: { type: 'string', description: 'ID do serviço' },
          professional_id: { type: 'string', description: 'ID do profissional (opcional)' },
          date: { type: 'string', description: 'Data YYYY-MM-DD' },
        },
        required: ['service_id', 'date'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_booking',
      description: 'Cria agendamento confirmado para o cliente.',
      parameters: {
        type: 'object',
        properties: {
          service_id: { type: 'string' },
          professional_id: { type: 'string' },
          starts_at: { type: 'string', description: 'ISO 8601 datetime' },
        },
        required: ['service_id', 'professional_id', 'starts_at'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_services',
      description: 'Lista os serviços ativos do salão.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_client_bookings',
      description: 'Lista os próximos agendamentos do cliente.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancel_booking',
      description: 'Cancela um agendamento futuro do cliente.',
      parameters: {
        type: 'object',
        properties: { booking_id: { type: 'string' } },
        required: ['booking_id'],
      },
    },
  },
  // ── Billing tools (Fase 3) ─────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'check_subscription_status',
      description: 'Verifica se o cliente tem assinatura ativa e se pode agendar.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_plans',
      description: 'Lista os planos de assinatura disponíveis no salão (ex: Clube da Barba).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_subscription',
      description: 'Cria uma assinatura recorrente para o cliente.',
      parameters: {
        type: 'object',
        properties: {
          plan_name: { type: 'string', description: 'Nome do plano' },
          billing_type: {
            type: 'string',
            enum: ['PIX', 'CREDIT_CARD', 'BOLETO'],
            description: 'Forma de pagamento, padrão PIX',
          },
        },
        required: ['plan_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_payment_link',
      description: 'Retorna link de pagamento para regularizar inadimplência do cliente.',
      parameters: { type: 'object', properties: {} },
    },
  },
];

@Injectable()
export class AiOrchestratorService {
  private readonly logger = new Logger(AiOrchestratorService.name);
  private readonly openai: OpenAI;
  private readonly RATE_LIMIT_MAX = 10;
  private readonly RATE_LIMIT_WINDOW = 60;

  // BillingToolsService injetado dinamicamente para evitar dependência circular
  public billingTools: any;

  constructor(
    private readonly availability: AvailabilityService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {
    const useGroq = process.env.USE_GROQ === 'true';
    this.openai = new OpenAI({
      apiKey: useGroq ? process.env.GROQ_API_KEY : process.env.OPENAI_API_KEY,
      baseURL: useGroq ? 'https://api.groq.com/openai/v1' : undefined,
    });
  }

  async orchestrate(input: OrchestrateInput): Promise<string> {
    // Rate limiting por cliente
    const rateLimitKey = `ai:ratelimit:${input.clientId}`;
    const count = await this.redis.incr(rateLimitKey);
    if (count === 1) await this.redis.expire(rateLimitKey, this.RATE_LIMIT_WINDOW);
    if (count > this.RATE_LIMIT_MAX) {
      return 'Por favor, aguarde um momento antes de enviar mais mensagens 🙏';
    }

    // Verificar inadimplência antes de processar (fast path)
    if (this.billingTools) {
      const canBook = await this.billingTools.checkSubscriptionStatus(
        input.clientId,
        input.salonId,
      );
      if (canBook.hasSubscription && !canBook.canBook) {
        const link = canBook.paymentLink ? `\n\nPague aqui: ${canBook.paymentLink}` : '';
        return `${canBook.blockReason}${link}`;
      }
    }

    // Histórico recente
    const history = await this.prisma.conversationMessage.findMany({
      where: { clientId: input.clientId, salonId: input.salonId, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const salon = await this.prisma.salon.findUnique({ where: { id: input.salonId } });

    const systemPrompt = `Você é o assistente virtual do salão "${salon?.name ?? 'Salão'}".
Seu objetivo é ajudar clientes a agendar, reagendar e cancelar serviços de beleza via WhatsApp.
Sempre seja cordial, objetivo e use linguagem informal mas profissional.
Antes de agendar, verifique disponibilidade. Confirme detalhes antes de criar o booking.
Se o cliente perguntar sobre planos/assinaturas, liste os planos disponíveis.
Fuso horário: America/Sao_Paulo.`;

    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...history.reverse().map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: input.userMessage },
    ];

    const model = process.env.USE_GROQ === 'true' ? 'llama-3.3-70b-versatile' : 'gpt-4o';
    let iterations = 0;

    while (iterations < 5) {
      iterations++;
      const response = await this.openai.chat.completions.create({
        model,
        messages,
        tools: TOOLS,
        tool_choice: 'auto',
        temperature: 0.3,
        max_tokens: 1024,
      });

      const choice = response.choices[0];
      const assistantMessage = choice.message;
      messages.push(assistantMessage);

      if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
        return assistantMessage.content ?? 'Desculpe, não entendi. Pode repetir?';
      }

      const toolResults = await Promise.all(
        assistantMessage.tool_calls.map(async (tc) => {
          const result = await this.executeTool(
            tc.function.name,
            JSON.parse(tc.function.arguments),
            input,
          );
          return { role: 'tool' as const, tool_call_id: tc.id, content: JSON.stringify(result) };
        }),
      );
      messages.push(...toolResults);
    }

    return 'Desculpe, estou com dificuldades no momento. Por favor, ligue para o salão.';
  }

  private async executeTool(name: string, args: Record<string, any>, ctx: OrchestrateInput) {
    this.logger.log(`Tool: ${name}`, args);
    switch (name) {
      // ── Agendamento ───────────────────────────────────────────────────────
      case 'check_availability':
        return this.availability.checkAvailability({
          salonId: ctx.salonId,
          serviceId: args.service_id,
          professionalId: args.professional_id,
          date: args.date,
        });

      case 'create_booking':
        return this.availability.createBookingAtomic({
          salonId: ctx.salonId,
          clientId: ctx.clientId,
          serviceId: args.service_id,
          professionalId: args.professional_id,
          startsAt: new Date(args.starts_at),
        });

      case 'list_services': {
        const services = await this.prisma.service.findMany({
          where: { salonId: ctx.salonId, active: true },
          select: { id: true, name: true, durationMinutes: true, priceDefault: true },
        });
        return services.map((s) => ({ ...s, priceDefault: Number(s.priceDefault) }));
      }

      case 'get_client_bookings': {
        const bookings = await this.prisma.booking.findMany({
          where: {
            clientId: ctx.clientId,
            salonId: ctx.salonId,
            startsAt: { gt: new Date() },
            status: { not: 'CANCELLED' },
          },
          include: {
            service: { select: { name: true } },
            professional: { select: { name: true } },
          },
          orderBy: { startsAt: 'asc' },
          take: 5,
        });
        return bookings.map((b) => ({
          id: b.id,
          service: b.service.name,
          professional: b.professional.name,
          startsAt: b.startsAt.toISOString(),
        }));
      }

      case 'cancel_booking': {
        const booking = await this.prisma.booking.findFirst({
          where: { id: args.booking_id, clientId: ctx.clientId, status: { not: 'CANCELLED' } },
        });
        if (!booking) return { error: 'Agendamento não encontrado' };
        if (booking.startsAt < new Date()) return { error: 'Não é possível cancelar agendamentos passados' };
        await this.prisma.booking.update({ where: { id: booking.id }, data: { status: 'CANCELLED' } });
        return { success: true };
      }

      // ── Billing ───────────────────────────────────────────────────────────
      case 'check_subscription_status':
        if (!this.billingTools) return { error: 'Billing não disponível' };
        return this.billingTools.checkSubscriptionStatus(ctx.clientId, ctx.salonId);

      case 'list_plans':
        if (!this.billingTools) return { error: 'Billing não disponível' };
        return this.billingTools.listPlans(ctx.salonId);

      case 'create_subscription': {
        if (!this.billingTools) return { error: 'Billing não disponível' };
        const billingType = args.billing_type ?? 'PIX';
        return this.billingTools.createSubscription(
          ctx.clientId,
          ctx.salonId,
          args.plan_name,
          billingType,
        );
      }

      case 'get_payment_link':
        if (!this.billingTools) return { error: 'Billing não disponível' };
        return this.billingTools.getPaymentLink(ctx.clientId, ctx.salonId);

      default:
        return { error: `Tool desconhecida: ${name}` };
    }
  }

  async transcribeAudio(buffer: Buffer): Promise<string> {
    const useGroq = process.env.USE_GROQ === 'true';
    const client = new OpenAI({
      apiKey: useGroq ? process.env.GROQ_API_KEY : process.env.OPENAI_API_KEY,
      baseURL: useGroq ? 'https://api.groq.com/openai/v1' : undefined,
    });
    const { Readable } = await import('stream');
    const stream = Readable.from(buffer) as any;
    stream.name = 'audio.ogg';
    stream.type = 'audio/ogg';
    const transcription = await client.audio.transcriptions.create({
      model: 'whisper-1',
      file: stream,
      language: 'pt',
    });
    return transcription.text;
  }
}
