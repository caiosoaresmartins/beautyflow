import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  Query,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
  Logger,
  Headers,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BillingService, CreateChargeDto } from './billing.service';
import { SubscriptionsService, CreateSubscriptionInput } from './subscriptions.service';
import { BillingWebhookHandler } from './webhook.handler';
import { IsString, IsEnum, IsOptional, IsNumber, IsPositive } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class CreateChargeBodyDto {
  @ApiProperty({ example: 'client-id-uuid' })
  @IsString()
  clientId: string;

  @ApiProperty({ example: 150.0 })
  @IsNumber()
  @IsPositive()
  value: number;

  @ApiProperty({ enum: ['PIX', 'CREDIT_CARD', 'BOLETO'] })
  @IsEnum(['PIX', 'CREDIT_CARD', 'BOLETO'])
  billingType: 'PIX' | 'CREDIT_CARD' | 'BOLETO';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  bookingId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false, example: '2026-08-01' })
  @IsOptional()
  @IsString()
  dueDate?: string;
}

class CreateSubscriptionBodyDto {
  @ApiProperty()
  @IsString()
  clientId: string;

  @ApiProperty()
  @IsString()
  planId: string;

  @ApiProperty({ enum: ['PIX', 'CREDIT_CARD', 'BOLETO'] })
  @IsEnum(['PIX', 'CREDIT_CARD', 'BOLETO'])
  billingType: 'PIX' | 'CREDIT_CARD' | 'BOLETO';
}

@ApiTags('Billing')
@ApiBearerAuth()
@Controller('salons/:salonId/billing')
export class BillingController {
  private readonly logger = new Logger(BillingController.name);

  constructor(
    private readonly billing: BillingService,
    private readonly subscriptions: SubscriptionsService,
    private readonly webhookHandler: BillingWebhookHandler,
  ) {}

  // ─── Cobranças ────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post('charges')
  @ApiOperation({ summary: 'Cria cobrança com split automático' })
  async createCharge(
    @Param('salonId') salonId: string,
    @Body() body: CreateChargeBodyDto,
  ) {
    return this.billing.createCharge({ ...body, salonId });
  }

  @UseGuards(JwtAuthGuard)
  @Get('charges')
  @ApiOperation({ summary: 'Lista cobranças do salão' })
  async listCharges(
    @Param('salonId') salonId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.billing.listCharges(salonId, page, limit);
  }

  @UseGuards(JwtAuthGuard)
  @Post('charges/:chargeId/sync')
  @ApiOperation({ summary: 'Sincroniza status da cobrança com Asaas' })
  async syncCharge(
    @Param('salonId') salonId: string,
    @Param('chargeId') chargeId: string,
  ) {
    return this.billing.syncChargeStatus(chargeId, salonId);
  }

  // ─── Assinaturas ──────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post('subscriptions')
  @ApiOperation({ summary: 'Cria assinatura recorrente (Clube da Barba)' })
  async createSubscription(
    @Param('salonId') salonId: string,
    @Body() body: CreateSubscriptionBodyDto,
  ) {
    return this.subscriptions.createSubscription({ ...body, salonId });
  }

  @UseGuards(JwtAuthGuard)
  @Get('subscriptions')
  @ApiOperation({ summary: 'Lista assinaturas do salão' })
  async listSubscriptions(
    @Param('salonId') salonId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.subscriptions.listSubscriptions(salonId, page, limit);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('subscriptions/:subscriptionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancela assinatura' })
  async cancelSubscription(
    @Param('salonId') salonId: string,
    @Param('subscriptionId') subscriptionId: string,
  ) {
    return this.subscriptions.cancelSubscription(subscriptionId, salonId);
  }

  // ─── Webhook Asaas ────────────────────────────────────────────────────────

  @Post('/../../webhook/asaas')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook Asaas (validação por Bearer token)' })
  async asaasWebhook(
    @Headers('asaas-access-token') token: string,
    @Body() body: any,
    @Res() res: Response,
  ) {
    if (!this.webhookHandler.validateToken(token)) {
      this.logger.warn('Token inválido no webhook Asaas');
      return res.status(401).send('Unauthorized');
    }

    // Responder imediatamente
    res.status(200).send('OK');

    // Processar de forma assíncrona
    this.webhookHandler.handle(body).catch((err) =>
      this.logger.error('Erro ao processar webhook Asaas', err),
    );
  }
}
