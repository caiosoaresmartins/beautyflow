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

@Controller('webhook/whatsapp')
export class WhatsAppController {
  private readonly logger = new Logger(WhatsAppController.name);

  constructor(
    private readonly handler: WhatsAppWebhookHandler,
    private readonly whatsappService: WhatsAppService,
  ) {}

  /** Verificação do webhook pela Meta */
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
    return res.status(403).send('Forbidden');
  }

  /** Recebimento de eventos da Meta */
  @Post()
  @HttpCode(HttpStatus.OK)
  async receive(@Req() req: Request, @Res() res: Response, @Body() body: any) {
    // Validar assinatura HMAC-SHA256 (CRÍTICO-09 auditoria)
    const signature = req.headers['x-hub-signature-256'] as string;
    if (!this.validateSignature(req.rawBody as Buffer, signature)) {
      this.logger.warn('Assinatura inválida no webhook Meta');
      return res.status(401).send('Invalid signature');
    }

    // Responder imediatamente para a Meta (< 20s SLA)
    res.status(200).send('EVENT_RECEIVED');

    // Processar de forma assíncrona
    this.handler.handle(body).catch((err) =>
      this.logger.error('Erro ao processar webhook Meta', err),
    );
  }

  private validateSignature(rawBody: Buffer, signature: string): boolean {
    if (!signature || !rawBody) return false;
    const appSecret = process.env.META_APP_SECRET;
    if (!appSecret) return false;
    const expected = `sha256=${crypto
      .createHmac('sha256', appSecret)
      .update(rawBody)
      .digest('hex')}`;
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signature),
    );
  }
}
