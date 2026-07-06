import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PlansService, CreatePlanDto, UpdatePlanDto } from './plans.service';

@ApiTags('Billing — Planos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('salons/:salonId/plans')
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  @Post()
  @ApiOperation({ summary: 'Cria plano de assinatura (ex: Clube da Barba)' })
  create(@Param('salonId') salonId: string, @Body() dto: CreatePlanDto) {
    return this.plans.create(salonId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista planos do salão' })
  @ApiQuery({ name: 'onlyActive', required: false, type: Boolean })
  findAll(
    @Param('salonId') salonId: string,
    @Query('onlyActive') onlyActive?: string,
  ) {
    return this.plans.findAll(salonId, onlyActive === 'true');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe de um plano' })
  findOne(@Param('salonId') salonId: string, @Param('id') id: string) {
    return this.plans.findOne(id, salonId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza plano' })
  update(
    @Param('salonId') salonId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePlanDto,
  ) {
    return this.plans.update(id, salonId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Desativa plano (soft delete — assinaturas ativas continuam)' })
  deactivate(@Param('salonId') salonId: string, @Param('id') id: string) {
    return this.plans.deactivate(id, salonId);
  }
}
