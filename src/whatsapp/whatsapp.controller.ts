import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { WhatsAppWebhookHandler } from './webhook.handler';
import { WhatsAppService } from './whatsapp.service';
import * as crypto from 'crypto';

/**
 * Webhook WhatsApp Meta
 *
 * IMPORTANTE — rawBody:
 * Para validar a assinatura HMAC-SHA256 o Express precisa ter acesso ao body
 * cru (Buffer) antes do JSON.parse. Configure no main.ts:
 *
 *   app.use('/api/v1/webhook/whatsapp', express.raw({ type: 'application/json' }));
 *
 * antes do app.use(express.json()). O body raw fica disponível em req.body
 * (Buffer) para esta rota específica. O NestJS extrai @Body() do body parseado
 * pelo GlobalPipe, por isso usamos @Req() para acessar o raw e parseamos
 * manualmente aqui.
 */
@Controller('webhook/whatsapp')
export class WhatsAppController {
  private readonly logger = new Logger(WhatsAppController.name);

  constructor(
    private readonly handler: WhatsAppWebhookHandler,
    private readonly whatsappService: WhatsAppService,
  ) {}

  /** Verificação do webhook pela Meta (GET) */
  @Get()
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    const expected = process.env.META_WEBHOOK_VERIFY_TOKEN;
    if (mode === 'subscribe' && token === expected) {
      this.logger.log('Webhook Meta verificado com sucesso');
      return res.status(200).send(challenge);
    }
    this.logger.warn('Tentativa de verificação de webhook Meta com token inválido');
    return res.status(403).send('Forbidden');
  }

  /** Recebimento de eventos da Meta (POST) */
  @Post()
  @HttpCode(HttpStatus.OK)
  async receive(@Req() req: Request, @Res() res: Response) {
    // fix: rawBody — req.body é Buffer quando express.raw() está configurado
    // para esta rota no main.ts (ver comentário acima)
    const rawBody: Buffer = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(JSON.stringify(req.body));

    const signature = req.headers['x-hub-signature-256'] as string;

    if (!this.validateSignature(rawBody, signature)) {
      this.logger.warn('Assinatura inválida no webhook Meta — request rejeitado');
      return res.status(401).send('Invalid signature');
    }

    // Parsear body (pode ser raw Buffer ou objeto já parseado)
    let body: any;
    try {
      body = Buffer.isBuffer(req.body) ? JSON.parse(rawBody.toString('utf8')) : req.body;
    } catch {
      return res.status(400).send('Invalid JSON');
    }

    // Responder imediatamente para a Meta (SLA < 20s)
    res.status(200).send('EVENT_RECEIVED');

    // Processar de forma assíncrona
    this.handler.handle(body).catch((err) =>
      this.logger.error('Erro ao processar webhook Meta', err),
    );
  }

  private validateSignature(rawBody: Buffer, signature: string): boolean {
    if (!signature || !rawBody?.length) return false;
    const appSecret = process.env.META_APP_SECRET;
    if (!appSecret) {
      this.logger.warn('META_APP_SECRET não configurado — ignorando validação de assinatura');
      return true; // em dev sem secret configurado, aceita
    }
    const expected = `sha256=${crypto
      .createHmac('sha256', appSecret)
      .update(rawBody)
      .digest('hex')}`;
    try {
      // Garantir tamanhos iguais antes do timingSafeEqual (exige buffers do mesmo tamanho)
      if (Buffer.byteLength(expected) !== Buffer.byteLength(signature)) return false;
      return crypto.timingSafeEqual(
        Buffer.from(expected),
        Buffer.from(signature),
      );
    } catch {
      return false;
    }
  }
}
