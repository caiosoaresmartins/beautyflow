import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import * as crypto from 'crypto';
import { WebhookHandler } from './webhook.handler';
import { SkipThrottle } from '@nestjs/throttler';

@SkipThrottle()
@Controller('webhooks/whatsapp')
export class WhatsAppController {
  private readonly logger = new Logger(WhatsAppController.name);

  constructor(private readonly webhookHandler: WebhookHandler) {}

  /** Verificação do webhook pela Meta */
  @Get()
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    const verifyToken = process.env.META_VERIFY_TOKEN;
    if (mode === 'subscribe' && token === verifyToken) {
      this.logger.log('Webhook Meta verificado com sucesso.');
      return res.status(HttpStatus.OK).send(challenge);
    }
    return res.status(HttpStatus.FORBIDDEN).send('Verification failed');
  }

  /** Recepção de eventos do webhook Meta */
  @Post()
  @HttpCode(HttpStatus.OK)
  async receive(@Req() req: Request, @Body() body: any) {
    // Validação HMAC-SHA256
    const appSecret = process.env.META_APP_SECRET;
    if (appSecret) {
      const signature = (req.headers['x-hub-signature-256'] as string) ?? '';
      const rawBody: Buffer = (req as any).rawBody ?? Buffer.from(JSON.stringify(body));

      if (rawBody.length > 5 * 1024 * 1024) {
        this.logger.warn('Payload do webhook excede 5MB — ignorado.');
        return { status: 'ignored' };
      }

      const expected = `sha256=${crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;
      const sigBuffer = Buffer.from(signature.padEnd(expected.length, '0'));
      const expBuffer = Buffer.from(expected);

      if (sigBuffer.length !== expBuffer.length || !crypto.timingSafeEqual(sigBuffer, expBuffer)) {
        throw new UnauthorizedException('Assinatura HMAC inválida.');
      }
    }

    // Processar de forma assíncrona — responde 200 imediatamente para a Meta
    setImmediate(() => this.webhookHandler.handle(body).catch((e) => this.logger.error('Webhook error:', e.message)));
    return { status: 'ok' };
  }
}
