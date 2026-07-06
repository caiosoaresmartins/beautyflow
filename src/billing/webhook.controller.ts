/**
 * WebhookController — rota global /api/v1/webhook/asaas
 * Separado do BillingController para não ficar aninhado em /salons/:salonId
 */
import {
  Controller,
  Post,
  Body,
  Res,
  HttpCode,
  HttpStatus,
  Logger,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { BillingWebhookHandler } from './webhook.handler';

@ApiTags('Webhooks')
@Controller('webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly webhookHandler: BillingWebhookHandler) {}

  /**
   * POST /api/v1/webhook/asaas
   * Autenticado via header "asaas-access-token" com valor do ASAAS_WEBHOOK_TOKEN
   * Responde 200 imediatamente e processa de forma assíncrona (requisito Asaas <5s)
   */
  @Post('asaas')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Webhook Asaas — recebe eventos de pagamento e assinatura',
    description:
      'Validado via header `asaas-access-token`. ' +
      'Eventos suportados: PAYMENT_RECEIVED, PAYMENT_CONFIRMED, PAYMENT_OVERDUE, ' +
      'PAYMENT_REFUNDED, PAYMENT_DELETED, SUBSCRIPTION_RENEWED, SUBSCRIPTION_DELETED. ' +
      'Idempotência garantida via Redis SET NX (chave expira em 7 dias).',
  })
  async asaasWebhook(
    @Headers('asaas-access-token') token: string,
    @Body() body: any,
    @Res() res: Response,
  ) {
    if (!this.webhookHandler.validateToken(token)) {
      this.logger.warn(
        `Webhook Asaas rejeitado — token inválido. Event: ${body?.event ?? 'unknown'}`,
      );
      return res.status(HttpStatus.UNAUTHORIZED).send('Unauthorized');
    }

    // Responde imediatamente (Asaas exige resposta em menos de 5s)
    res.status(HttpStatus.OK).send('OK');

    // Processa de forma assíncrona — falhas são logadas, não afetam a resposta
    this.webhookHandler.handle(body).catch((err) =>
      this.logger.error('Erro ao processar webhook Asaas', err),
    );
  }
}
