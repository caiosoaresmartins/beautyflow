import {
  Controller,
  Post,
  Body,
  Param,
  Headers,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  Logger,
  UseGuards,
  Request,
} from '@nestjs/common';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import * as crypto from 'crypto';

@ApiTags('billing')
@Controller('billing')
export class BillingController {
  private readonly logger = new Logger(BillingController.name);

  constructor(private readonly billingService: BillingService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('salons/:salonId/subscriptions')
  async createSubscription(
    @Param('salonId') salonId: string,
    @Body() body: { clientId: string; planId: string },
    @Request() req: any,
  ) {
    return this.billingService.createSubscription(salonId, body.clientId, body.planId);
  }

  /** Webhook Asaas — sem JWT, mas com validação de token */
  @SkipThrottle()
  @Post('webhooks/asaas')
  @HttpCode(HttpStatus.OK)
  async asaasWebhook(
    @Headers('asaas-access-token') token: string,
    @Body() body: any,
  ) {
    const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN;
    if (expectedToken && token !== expectedToken) {
      throw new UnauthorizedException('Token do webhook Asaas inválido.');
    }

    // Chave de idempotência = ID do evento ou hash do payload
    const idempotencyKey = body?.payment?.id ?? crypto.randomUUID();

    setImmediate(() =>
      this.billingService.handleAsaasWebhook(body, idempotencyKey).catch((e) =>
        this.logger.error('Asaas webhook error:', e.message),
      ),
    );

    return { received: true };
  }
}
